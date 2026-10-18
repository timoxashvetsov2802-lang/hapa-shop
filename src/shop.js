import crypto from 'node:crypto';
import { q, tx, now } from './db.js';
import { config } from './config.js';
import { cfg, costRub, rankOf, RANKS } from './pricing.js';

export class ShopError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}
const r2 = (n) => Math.round(n * 100) / 100;
const floor2 = (n) => Math.floor(n * 100) / 100;

// Возвращает пользователя; isNew = true, если пришёл впервые (для уведомления пригласившему)
export async function upsertUser(u, refBy = null) {
  const ex = await q.get('SELECT * FROM users WHERE id = ?', u.id);
  if (ex) {
    if (ex.username !== (u.username ?? null) || ex.first_name !== (u.first_name ?? '')) {
      await q.run('UPDATE users SET username = ?, first_name = ? WHERE id = ?', u.username ?? null, u.first_name ?? '', u.id);
    }
    return { ...ex, username: u.username ?? null, first_name: u.first_name ?? '' };
  }
  const ref = refBy && refBy !== u.id && (await q.get('SELECT id FROM users WHERE id = ?', refBy)) ? refBy : null;
  await q.run('INSERT OR IGNORE INTO users (id, username, first_name, ref_by, created_at) VALUES (?,?,?,?,?)',
    u.id, u.username ?? null, u.first_name ?? '', ref, now());
  return { ...(await q.get('SELECT * FROM users WHERE id = ?', u.id)), isNew: true };
}

export const getUser = (id) => q.get('SELECT * FROM users WHERE id = ?', id);

const STOCK_SQL = `SELECT p.*, CASE WHEN p.unlimited = 1 THEN NULL ELSE COALESCE(s.n, 0) END AS stock
  FROM products p LEFT JOIN (SELECT product_id, COUNT(*) AS n FROM stock WHERE order_id IS NULL GROUP BY product_id) s
  ON s.product_id = p.id`;

const ver = (s) => crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8);
// file_id из Telegram и закупочные цены наружу не отдаём
export const publicProduct = (p) => ({
  id: p.id, category_id: p.category_id, title: p.title, emoji: p.emoji, color: p.color,
  description: p.description, price: p.price, stock: p.stock, wide: p.wide, hit: p.hit,
  old_price: p.old_price > p.price ? p.old_price : null,
  icon: p.icon ? `/api/sticker?p=${p.id}&v=${ver(p.icon)}` : null,
  image: p.image ? { url: `/api/media/p${p.id}?v=${ver(p.image)}`, type: p.image_type } : null,
});

export async function listCatalog() {
  const [cats, products] = await Promise.all([
    q.all('SELECT * FROM categories ORDER BY sort, id'),
    q.all(`${STOCK_SQL} WHERE p.active = 1 AND p.price > 0 ORDER BY p.hit DESC, p.sort, p.id`),
  ]);
  return { cats, products: products.map(publicProduct) };
}

export const getProduct = (id) => q.get(`${STOCK_SQL} WHERE p.id = ?`, id);

// Скидка новичку, пришедшему по реф-ссылке: не больше, чем позволяет минимальная прибыль
function firstDiscount(p, u, total, qty, c) {
  if (!u.ref_by || u.purchases > 0 || !(c.first_disc > 0)) return 0;
  const want = total * c.first_disc / 100;
  const cost = costRub(p, c);
  if (!(cost > 0)) return floor2(want);
  const room = total - (cost + c.min_profit) * qty / (1 - c.fee_pct / 100);
  return Math.max(0, floor2(Math.min(want, room)));
}

export async function buy(userId, productId, qty = 1) {
  qty = Math.floor(qty);
  if (!(qty >= 1 && qty <= 100)) throw new ShopError('Некорректное количество');
  const c = await cfg();
  return tx(async (t) => {
    const p = await t.get(`${STOCK_SQL} WHERE p.id = ?`, productId);
    if (!p || !p.active) throw new ShopError('Товар не найден');
    const u = await t.get('SELECT * FROM users WHERE id = ?', userId);
    const total = r2(p.price * qty);
    const discount = firstDiscount(p, u, total, qty, c);
    const charged = r2(total - discount);

    // Защита от минуса: если закупка подорожала, а цена ещё старая — не продаём
    let profit = charged * (1 - c.fee_pct / 100);
    if (p.cost > 0) {
      profit -= costRub(p, c) * qty;
      if (!(profit >= 0)) throw new ShopError('Цена на этот товар обновляется — загляните через пару минут', 'loss');
    }

    if (u.balance < charged) throw new ShopError(`Не хватает ${fmt(charged - u.balance)} ₽ на балансе`);
    let items = [];
    if (!p.unlimited) {
      if (p.stock < qty) throw new ShopError(p.stock ? `В наличии только ${p.stock} шт.` : 'Товар закончился');
      items = await t.all('SELECT id, content FROM stock WHERE product_id = ? AND order_id IS NULL ORDER BY id LIMIT ?', productId, qty);
      if (userId !== config.adminId && items.some((i) => i.content.startsWith('DEMO-'))) {
        throw new ShopError('Товар скоро появится в наличии — загляните позже');
      }
    }
    const status = p.unlimited ? 'pending' : 'done';
    const content = p.unlimited ? null : items.map((i) => i.content).join('\n');
    const { lastInsertRowid: oid } = await t.run(
      'INSERT INTO orders (user_id, product_id, product_title, qty, price, content, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
      userId, productId, p.title, qty, charged, content, status, now());
    for (const i of items) await t.run('UPDATE stock SET order_id = ? WHERE id = ?', oid, i.id);
    await t.run('UPDATE users SET balance = balance - ?, purchases = purchases + ?, spent = spent + ? WHERE id = ?', charged, qty, charged, userId);

    const rewards = await payReferrals(t, u, oid, charged, profit, c);
    return {
      orderId: oid, product: p, qty, total: charged, discount, content, status, rewards,
      balance: r2(u.balance - charged), stockLeft: p.unlimited ? null : p.stock - qty,
    };
  });
}

// Рефка с покупки: 1-я линия по рангу пригласившего, 2-я — фикс. Всё вместе не больше ref_cap% прибыли заказа.
async function payReferrals(t, buyer, orderId, charged, profit, c) {
  if (!buyer.ref_by) return [];
  const l1 = await t.get('SELECT id, ref_by FROM users WHERE id = ?', buyer.ref_by);
  if (!l1) return [];
  const paid = (await t.get('SELECT COUNT(*) AS n FROM users WHERE ref_by = ? AND purchases > 0', l1.id)).n;
  const list = [{ to: l1.id, level: 1, amount: charged * rankOf(paid).pct / 100 }];
  if (l1.ref_by && l1.ref_by !== buyer.id) list.push({ to: l1.ref_by, level: 2, amount: charged * c.ref_l2 / 100 });
  const cap = Math.max(0, profit * c.ref_cap / 100);
  const sum = list.reduce((a, x) => a + x.amount, 0);
  const k = sum > cap ? cap / sum : 1;
  const out = [];
  for (const x of list) {
    const amount = floor2(x.amount * k);
    if (amount <= 0) continue;
    await t.run('UPDATE users SET balance = balance + ?, ref_income = ref_income + ? WHERE id = ?', amount, amount, x.to);
    await t.run('INSERT INTO ref_rewards (user_id, from_user, order_id, level, amount, created_at) VALUES (?,?,?,?,?,?)',
      x.to, buyer.id, orderId, x.level, amount, now());
    out.push({ ...x, amount });
  }
  return out;
}

// Пополнение баланса. Рефка начисляется с покупок, а не с пополнений — так её нельзя накрутить.
export async function credit(userId, amount) {
  await q.run('UPDATE users SET balance = balance + ? WHERE id = ?', amount, userId);
  return null;
}

export async function transfer(fromId, toRef, amount) {
  amount = r2(Number(amount));
  if (!(amount > 0)) throw new ShopError('Укажите сумму');
  const ref = String(toRef || '').trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
  if (!ref) throw new ShopError('Укажите получателя');
  return tx(async (t) => {
    const to = /^\d+$/.test(ref)
      ? await t.get('SELECT * FROM users WHERE id = ?', Number(ref))
      : await t.get('SELECT * FROM users WHERE lower(username) = lower(?)', ref);
    if (!to) throw new ShopError('Получатель не найден — он должен хотя бы раз запустить бота');
    if (to.id === fromId) throw new ShopError('Нельзя переводить самому себе');
    const me = await t.get('SELECT balance FROM users WHERE id = ?', fromId);
    if (me.balance < amount) throw new ShopError('Недостаточно средств');
    await t.run('UPDATE users SET balance = balance - ? WHERE id = ?', amount, fromId);
    await t.run('UPDATE users SET balance = balance + ? WHERE id = ?', amount, to.id);
    return { to, amount, balance: r2(me.balance - amount) };
  });
}

// «Тим***» — в топе показываем имена не целиком
export const maskName = (u) => {
  const n = String(u.first_name || u.username || 'Кот').trim();
  return n.length <= 3 ? n + '***' : n.slice(0, 3) + '***';
};

export async function refInfo(userId) {
  const c = await cfg();
  const month = now() - 30 * 86400;
  const [u, friends, paid, l2, top, recent] = await Promise.all([
    getUser(userId),
    q.get('SELECT COUNT(*) AS n FROM users WHERE ref_by = ?', userId),
    q.get('SELECT COUNT(*) AS n FROM users WHERE ref_by = ? AND purchases > 0', userId),
    q.get('SELECT COUNT(*) AS n FROM users WHERE ref_by IN (SELECT id FROM users WHERE ref_by = ?)', userId),
    q.all(`SELECT r.user_id, SUM(r.amount) AS s, u.first_name, u.username FROM ref_rewards r JOIN users u ON u.id = r.user_id
      WHERE r.created_at > ? GROUP BY r.user_id ORDER BY s DESC LIMIT 10`, month),
    q.all(`SELECT r.amount, r.level, r.created_at, u.first_name, u.username FROM ref_rewards r JOIN users u ON u.id = r.from_user
      WHERE r.user_id = ? ORDER BY r.id DESC LIMIT 10`, userId),
  ]);
  return {
    friends: friends.n, paid: paid.n, l2: l2.n, income: u?.ref_income || 0,
    rank: rankOf(paid.n), ranks: RANKS, l2pct: c.ref_l2, firstDisc: c.first_disc, prize: c.ref_prize,
    top: top.map((x, i) => ({ place: i + 1, name: maskName(x), sum: r2(x.s), me: x.user_id === userId })),
    recent: recent.map((x) => ({ name: maskName(x), amount: x.amount, level: x.level, at: x.created_at })),
  };
}

export const userOrders = (id) => q.all('SELECT id, product_id, product_title, qty, price, content, status, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100', id);
export const refStats = async (id) => (await q.get('SELECT COUNT(*) AS n FROM users WHERE ref_by = ?', id)).n;
export const fmt = (n) => r2(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

// Описание товара: абзацы через пустую строку, **жирный**. Для бота → HTML с цитатами.
export function descToHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(text || '').split(/\n\s*\n/).filter((b) => b.trim())
    .map((b) => `<blockquote>${esc(b.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</blockquote>`).join('\n');
}
