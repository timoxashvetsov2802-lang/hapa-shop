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
