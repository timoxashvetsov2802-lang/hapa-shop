import express from 'express';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { q, getSetting } from './db.js';
import * as shop from './shop.js';
import * as pay from './payments.js';
import { cfg } from './pricing.js';
import { fileBuffer, ensureFile, emojiFileId } from './media.js';

function verifyInitData(initData) {
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(config.token).digest();
  const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date')) > 86400) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}

// Версия статики (хэш файлов public/) — бот добавляет её в ссылку мини-аппки (?v=), чтобы сбрасывать кэш
export function assetsVersion() {
  const h = crypto.createHash('md5');
  for (const f of ['index.html', 'style.css', 'app.js', 'mascot.js']) h.update(fs.readFileSync(path.join('public', f)));
  return h.digest('hex').slice(0, 8);
}

export function createServer({ notifyUser, afterBuy, onLoss, botUsername, webhook }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json({ limit: '20kb' }));

  // Мини-аппка с GitHub Pages ходит в API на другом домене. Куки не используем, авторизация — по initData.
  app.use('/api', (req, res, next) => {
    res.set({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-init-data', 'access-control-allow-methods': 'GET, POST' });
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  if (webhook) app.post(`/tg/${config.secret}`, webhook);
  app.get('/health', (_, res) => res.send('ok'));

  const sendIndex = (_, res) => res.set('cache-control', 'no-cache').sendFile(path.resolve('public/index.html'));
  app.get('/', sendIndex);
  app.get('/index.html', sendIndex);
  app.use(express.static('public', { maxAge: '7d', index: false }));

  // Анимированные эмодзи: ?e=✨ (набор Telegram) или ?p=ID (свой стикер товара, задаётся /seticon)
  app.get('/api/sticker', async (req, res) => {
    try {
      let fid = null;
      if (req.query.p) fid = (await q.get('SELECT icon FROM products WHERE id = ?', Number(req.query.p)))?.icon;
      else if (req.query.e) fid = await emojiFileId(String(req.query.e));
      if (!fid) return res.status(404).end();
      const buf = await fileBuffer(fid);
      res.set({ 'content-type': 'application/json', 'content-encoding': 'gzip', 'cache-control': 'public, max-age=604800' }).end(buf);
    } catch { res.status(404).end(); }
  });

  // Картинки/гифки товаров и шапки (загружаются админом через бота)
  app.get('/api/media/:key', async (req, res) => {
    try {
      let fid, type;
      if (req.params.key === 'hero') { fid = await getSetting('hero'); type = await getSetting('hero_type'); }
      else {
        const p = await q.get('SELECT image, image_type FROM products WHERE id = ?', Number(req.params.key.slice(1)));
        fid = p?.image; type = p?.image_type;
      }
      if (!fid) return res.status(404).end();
      res.set('cache-control', 'public, max-age=604800').type(type === 'video' ? 'video/mp4' : 'image/jpeg');
      res.sendFile(path.resolve(await ensureFile(fid)));
    } catch { res.status(404).end(); }
  });

  const api = express.Router();
  const known = new Set();
  api.use(async (req, res, next) => {
    const u = verifyInitData(req.get('x-init-data') || '');
    if (!u) return res.status(401).json({ error: 'Откройте магазин из Telegram' });
    req.tgUser = u;
    req.uid = u.id;
    try {
      if (!known.has(u.id)) { await shop.upsertUser(u); known.add(u.id); }
      next();
    } catch (e) { next(e); }
  });
  const wrap = (fn) => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) {
      if (e instanceof shop.ShopError) return res.status(400).json({ error: e.message });
      console.error(e); res.status(500).json({ error: 'Ошибка сервера, попробуйте ещё раз' });
    }
  };

  // Всё для старта мини-аппки одним запросом
  api.get('/init', wrap(async (req) => {
    const u = await shop.upsertUser(req.tgUser);
    const [catalog, orders, ref, hero, heroType, c] = await Promise.all([
      shop.listCatalog(), shop.userOrders(u.id), shop.refInfo(u.id), getSetting('hero'), getSetting('hero_type'), cfg(),
    ]);
    return {
      user: { ...u, isNew: undefined, photo: req.tgUser.photo_url || null },
      shop: {
        name: config.shopName, tagline: config.tagline, about: config.about, bot: botUsername(), links: config.links,
        hero: hero ? { url: `/api/media/hero?v=${hero.slice(-8)}`, type: heroType } : null,
        firstDisc: c.first_disc,
      },
      methods: pay.methods(u.id), ref, orders, ...catalog,
    };
  }));
  api.get('/state', wrap(async (req) => {
    const [user, orders] = await Promise.all([shop.getUser(req.uid), shop.userOrders(req.uid)]);
    return { user: { ...user, photo: req.tgUser.photo_url || null }, orders };
  }));
  api.get('/ref', wrap((req) => shop.refInfo(req.uid)));
  api.post('/buy', wrap(async (req) => {
    const productId = Number(req.body.productId);
    let r;
    try { r = await shop.buy(req.uid, productId, Number(req.body.qty || 1)); }
    catch (e) { if (e.code === 'loss') onLoss(productId).catch(() => {}); throw e; }
    afterBuy(r, req.tgUser).catch(() => {});
    return { orderId: r.orderId, content: r.content, status: r.status, total: r.total, discount: r.discount, balance: r.balance };
  }));
  api.post('/topup', wrap((req) => pay.createTopup(req.uid, req.body.amount, req.body.method)));
  api.post('/transfer', wrap(async (req) => {
    const r = await shop.transfer(req.uid, req.body.to, req.body.amount);
    notifyUser(r.to.id, `💸 Вам перевели ${shop.fmt(r.amount)} ₽ от ${req.tgUser.username ? '@' + req.tgUser.username : req.tgUser.first_name}`);
    return { to: r.to.username ? '@' + r.to.username : String(r.to.id), balance: r.balance };
  }));
  app.use('/api', api);
  return app;
}
