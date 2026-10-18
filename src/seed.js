import { q } from './db.js';

// Витрина для первого запуска. Цены и закупки — ПРИМЕРЫ, поправь под себя (/setcost, /setprice).
// Позиции склада — заглушки DEMO-…: обычным покупателям они не продаются (только админу для теста).
// Удалить все заглушки: /cleardemo, добавить реальные: /addstock ID.
const REPLACE = '🎥 **Замена 24 часа:** запишите видео без склеек — от нажатия «Купить» до проверки подписки. Не активировалась — пришлите видео в поддержку в течение 24 часов: заменим или вернём деньги.';
const ACC = '⚠️ **Важно:** активируйте на своём аккаунте сразу после покупки. Логин и пароль нам не нужны — никогда никому их не отправляйте.';

const CATS = [
  { title: 'Нейросети', emoji: '🤖', items: [
    { title: 'ChatGPT Plus 1 месяц', emoji: '🤖', color: '#10a37f', cost: 16.7, cost_cur: 'USDT', auto: 1, hit: 1, stock: 12,
      description: `❓ **Что входит:** ChatGPT Plus на месяц на ваш аккаунт: новые модели, генерация картинок, голосовой режим.\n\n🔑 **Как получить:** после оплаты бот сразу выдаст код и ссылку на страницу активации с инструкцией.\n\n${ACC}\n\n${REPLACE}` },
    { title: 'Gemini Pro 18 месяцев', emoji: '✨', color: '#5b6cff', price: 199, hit: 1, stock: 50,
      description: `❓ **Что входит:** Gemini Pro, генерация видео и фото, Deep Research, облако.\n\n🔑 **Как получить:** оплачиваете — бот выдаёт ссылку. Открываете её в браузере, где вошли в свой Google-аккаунт.\n\n${ACC}\n\n${REPLACE}` },
    { title: 'Claude Pro 1 месяц', emoji: '☀️', color: '#d9774a', price: 2190, stock: 6,
      description: `❓ **Что входит:** Claude Pro на месяц на ваш аккаунт.\n\n🔑 **Как получить:** после оплаты бот выдаст ссылку на страницу активации с инструкцией.\n\n${ACC}\n\n${REPLACE}` },
    { title: 'Cursor Pro 1 месяц', emoji: '💻', color: '#3b82f6', price: 2690, stock: 4,
      description: `❓ **Что входит:** Cursor Pro на месяц — AI-редактор кода.\n\n🔑 **Как получить:** после оплаты бот выдаст данные для активации.\n\n${REPLACE}` },
    { title: 'SuperGrok 1 месяц', emoji: '⚡', color: '#a855f7', price: 2990, stock: 3,
      description: `❓ **Что входит:** SuperGrok на месяц на ваш аккаунт.\n\n🔑 **Как получить:** после оплаты бот выдаст ссылку активации.\n\n${ACC}` },
    { title: 'CapCut Pro Team 1 месяц', emoji: '🎬', color: '#14b8a6', price: 299, stock: 20,
      description: '❓ **Что входит:** Pro-функции CapCut через место в командной подписке, аккаунт остаётся ваш.\n\n🔑 **Как получить:** после оплаты бот выдаст ссылку на вступление в команду.' },
  ] },
  { title: 'Игры', emoji: '🎮', items: [
    { title: 'Пополнение Steam 500 ₽', emoji: '🎮', color: '#1b2838', price: 549, unlimited: 1, hit: 1,
      description: '❓ **Что входит:** 500 ₽ на ваш Steam-кошелёк. Работает для регионов РФ и СНГ.\n\n🔑 **Как получить:** после оплаты напишите в поддержку свой **логин** Steam (не ник!) — зачислим в течение 15 минут.' },
    { title: 'Brawl Stars 30 гемов', emoji: '💎', color: '#f59e0b', price: 199, unlimited: 1,
      description: '❓ **Что входит:** 30 гемов на ваш аккаунт.\n\n🔑 **Как получить:** после оплаты оператор свяжется с вами в Telegram.' },
    { title: 'Fortnite 1000 В-баксов', emoji: '🪂', color: '#6366f1', price: 699, unlimited: 1,
      description: '❓ **Что входит:** 1000 V-Bucks на ваш аккаунт Epic Games.\n\n🔑 **Как получить:** после оплаты оператор свяжется с вами в Telegram.' },
  ] },
  { title: 'Telegram', emoji: '✈️', items: [
    { title: 'Telegram Stars 100 ⭐', emoji: '⭐', color: '#eab308', price: 179, unlimited: 1, hit: 1,
      description: '❓ **Что входит:** 100 звёзд на ваш аккаунт.\n\n🔑 **Как получить:** после оплаты звёзды придут подарком в течение 15 минут.' },
    { title: 'Telegram Premium 3 месяца', emoji: '🌟', color: '#8b5cf6', price: 1290, unlimited: 1,
      description: '❓ **Что входит:** Telegram Premium на 3 месяца подарком на ваш аккаунт. Вход в аккаунт не нужен.\n\n🔑 **Как получить:** после оплаты подарок придёт в течение 15 минут.' },
  ] },
];

export async function seed() {
  for (const [ci, c] of CATS.entries()) {
    const { lastInsertRowid: cat } = await q.run('INSERT INTO categories (title, emoji, sort) VALUES (?, ?, ?)', c.title, c.emoji, ci);
    for (const [i, p] of c.items.entries()) {
      const { lastInsertRowid: id } = await q.run(
        `INSERT INTO products (category_id, title, emoji, color, description, price, unlimited, sort, cost, cost_cur, auto_price, hit)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        cat, p.title, p.emoji, p.color, p.description, p.price || 0, p.unlimited ? 1 : 0, i,
        p.cost || 0, p.cost_cur || 'RUB', p.auto ? 1 : 0, p.hit ? 1 : 0);
      for (let k = 0; k < (p.stock || 0); k++) {
        await q.run('INSERT INTO stock (product_id, content) VALUES (?, ?)', id, `DEMO-${id}-${k + 1}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
      }
    }
  }
}
