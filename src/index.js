import { config } from './config.js';
import { initDb, q } from './db.js';
import { createServer } from './server.js';
import { bot, startBot, setupMenu, refreshMenus, notifyAdmin, notifyUser, webhookHandler, afterBuy, onLoss, announcePrices } from './bot.js';
import { startPolling } from './payments.js';
import { startPricing } from './pricing.js';
import { startTunnel } from './tunnel.js';
import { warmup } from './media.js';
import { execFile } from 'node:child_process';

process.on('unhandledRejection', (e) => console.error(new Date().toISOString(), 'unhandled', e?.message || e));
process.on('uncaughtException', (e) => { console.error(new Date().toISOString(), 'fatal', e?.stack || e); process.exit(1); });

await initDb();

const app = createServer({
  notifyUser, afterBuy, onLoss,
  botUsername: () => (bot.isInited() ? bot.botInfo.username : ''),
  webhook: config.webhook ? webhookHandler() : null,
});
// Сначала занимаем порт: если бот уже запущен (второй start.bat), тихо выходим с кодом 3,
// чтобы два экземпляра не дрались за getUpdates
await new Promise((resolve) => {
  app.listen(config.port, resolve).on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.error(`Порт ${config.port} занят — бот уже запущен`); process.exit(3); }
    throw e;
  });
});
console.log(new Date().toLocaleString('ru-RU'), 'Мини-апка: http://localhost:' + config.port);

startPolling((userId, amount) => notifyUser(userId, `✅ Баланс пополнен на ${amount} ₽`));

// Текущий адрес туннеля → в gist: мини-аппка на GitHub Pages берёт его оттуда, если кнопка в чате устарела.
// gh берёт токен из своего хранилища, в файлах проекта его нет.
function publishApi(url) {
  if (!config.gistId) return;
  const content = JSON.stringify({ api: url, at: new Date().toISOString() });
  execFile('gh', ['api', '-X', 'PATCH', 'gists/' + config.gistId, '-f', 'files[api.json][content]=' + content], { windowsHide: true },
    (e) => e && console.error('gist:', e.message.split('\n')[0]));
}

if (config.tunnel && !config.webhook) {
  startTunnel(config.port, (url) => {
    config.webappUrl = url;
    publishApi(url);
    console.log(new Date().toLocaleString('ru-RU'), 'Публичный адрес:', url);
    setupMenu();
    if (bot.isInited()) refreshMenus().catch((e) => console.error('refreshMenus', e.message));
  });
}
await startBot();
if (config.webappUrl) refreshMenus().catch((e) => console.error('refreshMenus', e.message));

// Курс USDT и автоцены каждые 15 минут. О товарах в минусе пишем админу один раз, пока не починят.
const lossAlerted = new Set();
startPricing(async (changes, loss) => {
  await announcePrices(changes);
  const cur = new Set(loss.map((p) => p.id));
  for (const id of lossAlerted) if (!cur.has(id)) lossAlerted.delete(id);
  const fresh = loss.filter((p) => !lossAlerted.has(p.id));
  if (fresh.length) {
    fresh.forEach((p) => lossAlerted.add(p.id));
    notifyAdmin(`⛔️ В минусе по текущей цене (покупки заблокированы):\n${fresh.map((p) => `#${p.id} ${p.title}: цена ${p.price} ₽, закупка ≈ ${Math.round(p.cost_rub) || '?'} ₽`).join('\n')}\n\nПоправь: /setprice ID цена или /auto ID on`);
  }
});

// эмодзи интерфейса + иконки товаров
const UI = ['🛍', '💰', '💸', '🎉', '📂', '🛒', '🤑', '📣', '📺', '☕', '💬', '🔥', '🏆', '🎁'];
const rows = await q.all('SELECT emoji, icon FROM products WHERE active = 1 UNION ALL SELECT emoji, NULL FROM categories');
warmup([...new Set([...rows.map((r) => r.emoji), ...UI])], rows.map((r) => r.icon).filter(Boolean));

// Render (free) засыпает без входящих запросов — пингуем себя, чтобы бот и оплаты работали 24/7
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => fetch(process.env.RENDER_EXTERNAL_URL + '/health').catch(() => {}), 10 * 60 * 1000);
}
