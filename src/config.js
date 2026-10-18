import fs from 'node:fs';

// Минимальный .env-парсер, без зависимостей
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  }
}
const env = (k, d = '') => process.env[k] || d;

export const config = {
  token: env('BOT_TOKEN'),
  adminId: Number(env('ADMIN_ID', 0)),
  shopName: env('SHOP_NAME', 'Хапа Shop'),
  tagline: env('SHOP_TAGLINE', 'хапнул — и доволен'),
  about: env('SHOP_ABOUT', 'Нейросети, игры и Telegram по ценам ниже рынка. Выдача сразу после оплаты, замена по гарантии.'),
  port: Number(env('PORT', 3001)),
  // публичный адрес: свой WEBAPP_URL, адрес Render или туннель (подставится при запуске)
  webappUrl: env('WEBAPP_URL') || env('RENDER_EXTERNAL_URL'),
  webhook: env('WEBHOOK') === '1' || !!env('RENDER_EXTERNAL_URL'),
  tunnel: env('TUNNEL') === '1',
  // мини-аппка на GitHub Pages (постоянный адрес) + gist, куда бот пишет текущий адрес туннеля
  pagesUrl: env('PAGES_URL').replace(/\/?$/, '/').replace(/^\/$/, ''),
  gistId: env('GIST_ID'),
  tursoUrl: env('TURSO_URL'),
  tursoToken: env('TURSO_TOKEN'),
  cryptoPayToken: env('CRYPTOPAY_TOKEN'),
  // ручное пополнение: текст-инструкция (\n — перенос строки) и название кнопки
  manualPay: env('MANUAL_PAY'),
  manualTitle: env('MANUAL_TITLE', 'Перевод вручную'),
  // канал/чат, куда бот пишет об изменении цен (бот должен быть там админом)
  newsChat: env('NEWS_CHAT_ID'),
  links: {
    support: env('SUPPORT_URL'),
    channel: env('CHANNEL_URL'),
    youtube: env('YOUTUBE_URL'),
    tips: env('TIPS_URL'),
  },
};
if (!config.token) throw new Error('BOT_TOKEN не задан в .env');
config.secret = config.token.split(':')[1].slice(0, 24).replace(/[^A-Za-z0-9_-]/g, '');
