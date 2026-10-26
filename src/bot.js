import { Bot, InlineKeyboard, InputFile, webhookCallback } from 'grammy';
import fs from 'node:fs';
import { config } from './config.js';
import { q, setSetting } from './db.js';
import * as shop from './shop.js';
import * as pay from './payments.js';
import * as pricing from './pricing.js';
import { customEmojiFileId } from './media.js';
import { assetsVersion } from './server.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => shop.fmt(n) + ' ₽';
const who = (u) => esc(u.first_name || '') + (u.username ? ` (@${esc(u.username)})` : '');
export const bot = new Bot(config.token);
export const notifyAdmin = (t) => config.adminId && bot.api.sendMessage(config.adminId, t, { parse_mode: 'HTML' }).catch(() => {});
export const notifyUser = (id, t) => bot.api.sendMessage(id, t, { parse_mode: 'HTML' }).catch(() => {});
// Мини-аппка: GitHub Pages (адрес не меняется) + текущий адрес API и gist с ним; без PAGES_URL — сам сервер
const VER = assetsVersion();
export const appUrl = () => (config.pagesUrl && config.webappUrl
  ? config.pagesUrl + '?v=' + VER + '&api=' + encodeURIComponent(config.webappUrl) + (config.gistId ? '&g=' + config.gistId : '')
  : config.webappUrl);
const docUrl = (f) => (config.pagesUrl || config.webappUrl + '/') + f;
const refLink = (id) => `https://t.me/${bot.botInfo.username}?start=ref_${id}`;

// ---------- баннеры с Говнюшей (PNG из scripts/banners.js; file_id кэшируем, чтобы не заливать каждый раз) ----------
const FILE_IDS = 'data/banners.json';
const ids = fs.existsSync(FILE_IDS) ? JSON.parse(fs.readFileSync(FILE_IDS, 'utf8')) : {};
function banner(name) {
  if (ids[name]) return { type: 'photo', media: ids[name], name };
  const p = `assets/${name}.png`;
  return fs.existsSync(p) ? { type: 'photo', media: new InputFile(p), name } : null;
}
function remember(m, name) {
  const fid = m?.photo?.at(-1)?.file_id;
  if (name && fid && !ids[name]) { ids[name] = fid; fs.writeFileSync(FILE_IDS, JSON.stringify(ids)); }
}

// Экран: по кнопке — меняем медиа и подпись в том же сообщении, иначе шлём новое
async function screen(ctx, media, text, kb, isMain = false) {
  const m = await render(ctx, media, text, kb);
  // запоминаем сообщения с главным меню: при смене адреса туннеля обновим в них кнопку «Открыть шоп»
  const mid = m?.message_id ?? ctx.callbackQuery?.message?.message_id;
  if (mid && ctx.chat) {
    if (isMain) await q.run('INSERT INTO menu_msgs (chat_id, message_id) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET message_id = excluded.message_id', ctx.chat.id, mid);
    else await q.run('DELETE FROM menu_msgs WHERE chat_id = ? AND message_id = ?', ctx.chat.id, mid);
  }
  return m;
}
async function render(ctx, media, text, kb) {
  const opts = { parse_mode: 'HTML', reply_markup: kb };
  if (!media) return ctx.callbackQuery ? ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts)) : ctx.reply(text, opts);
  if (ctx.callbackQuery) {
    try {
      const m = await ctx.editMessageMedia({ type: media.type, media: media.media, caption: text, parse_mode: 'HTML' }, { reply_markup: kb });
      remember(m, media.name);
      return m;
    } catch (e) {
      if (/not modified/i.test(e.message)) return null;
    }
  }
  const send = { photo: 'replyWithPhoto', video: 'replyWithAnimation', animation: 'replyWithAnimation' }[media.type];
  const m = await ctx[send](media.media, { caption: text, ...opts });
  remember(m, media.name);
  return m;
}
const productMedia = (p) => p.image ? { type: p.image_type === 'video' ? 'animation' : 'photo', media: p.image } : banner('products');

function mainKb() {
  const kb = new InlineKeyboard();
  if (config.webappUrl) kb.webApp('💩 Открыть шоп', appUrl()).row();
  kb.text('📦 Каталог', 'products').text('👤 Профиль', 'profile').row()
    .text('🤑 Рефка · до 20%', 'ref').row()
    .text('ℹ️ О шопе', 'about');
  if (config.links.support) kb.url('💬 Поддержка', config.links.support); else kb.text('💬 Поддержка', 'nolink');
  return kb;
}
const mainText = () => `💩 <b>${esc(config.shopName)}</b> — ${esc(config.tagline)}\n\n<blockquote>${esc(config.about)}</blockquote>\n\n🤑 Приводи друзей — получай <b>до 20%</b> с каждой их покупки. Навсегда.`;
const showMain = (ctx) => screen(ctx, banner('start'), mainText(), mainKb(), true);

// ---------- /start ----------
bot.command('start', async (ctx) => {
  const arg = ctx.match || '';
  const ref = arg.startsWith('ref_') ? Number(arg.slice(4)) || null : null;
  const u = await shop.upsertUser(ctx.from, ref);
  if (u.isNew && u.ref_by) {
    const c = await pricing.cfg();
    notifyUser(u.ref_by, `💩 По твоей ссылке пришёл <b>${esc(ctx.from.first_name)}</b>!\nКак только он что-нибудь купит — тебе капнет процент на баланс.`);
    await ctx.reply(`🎁 Тебя пригласил друг — на первую покупку скидка <b>${c.first_disc}%</b>, она применится сама.`, { parse_mode: 'HTML' });
  }
  if (arg.startsWith('p_')) return productCard(ctx, Number(arg.slice(2)));
  if (arg === 'ref') return refScreen(ctx);
  if (arg.startsWith('proof_')) return askProof(ctx, Number(arg.slice(6)));
  await showMain(ctx);
});
bot.callbackQuery('main', async (ctx) => { await ctx.answerCallbackQuery(); await showMain(ctx); });
bot.callbackQuery('nolink', (ctx) => ctx.answerCallbackQuery({ text: 'Ссылка ещё не настроена', show_alert: true }));

// ---------- каталог ----------
async function productsList(ctx, catId = null) {
  const { cats, products } = await shop.listCatalog();
  const kb = new InlineKeyboard();
  const line = (p) => `${p.hit ? '🔥 ' : ''}${p.emoji} ${p.title} · ${money(p.price)}`;
  if (catId === null) {
    for (const p of products.filter((p) => p.hit)) kb.text(line(p), `p:${p.id}`).row();
    for (const c of cats) {
      const n = products.filter((p) => p.category_id === c.id).length;
      if (n) kb.text(`${c.emoji} ${c.title} · ${n}`, `c:${c.id}`).row();
    }
    for (const p of products.filter((p) => !p.hit && !cats.some((c) => c.id === p.category_id))) kb.text(line(p), `p:${p.id}`).row();
  } else {
    for (const p of products.filter((p) => p.category_id === catId)) kb.text(line(p), `p:${p.id}`).row();
  }
  kb.text('◁ Назад', catId === null ? 'main' : 'products');
  const cat = cats.find((c) => c.id === catId);
  const title = catId === null ? '🔥 Хиты и категории' : `${esc(cat?.emoji || '')} ${esc(cat?.title || '')}`;
  await screen(ctx, banner('products'), `<blockquote><b>${title}</b></blockquote>`, kb);
}
bot.callbackQuery('products', async (ctx) => { await ctx.answerCallbackQuery(); await productsList(ctx); });
bot.callbackQuery(/^c:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await productsList(ctx, Number(ctx.match[1])); });

async function productCard(ctx, id) {
  const p = await shop.getProduct(id);
  if (!p || !p.active || !(p.price > 0)) return ctx.reply('Товар не найден');
  const u = await shop.getUser(ctx.from.id);
  const c = await pricing.cfg();
  const stock = p.unlimited ? '∞' : `${p.stock} шт.`;
  const old = p.old_price > p.price ? ` <s>${money(p.old_price)}</s>` : '';
  const first = u?.ref_by && !u.purchases && c.first_disc ? `\n🎁 <b>Твоя скидка на первую покупку: −${c.first_disc}%</b>` : '';
  const text = `${p.emoji} <b>${esc(p.title)}</b>\n\n${shop.descToHtml(p.description)}\n\n💰 <b>Цена:</b> ${money(p.price)}${old}\n📦 <b>В наличии:</b> ${stock}${first}`;
  const kb = new InlineKeyboard();
  if (p.unlimited || p.stock > 0) kb.text('💳 Купить', `buy:${p.id}`).row();
  kb.text('◁ Назад', p.category_id ? `c:${p.category_id}` : 'products');
  await screen(ctx, productMedia(p), text.slice(0, 1024), kb);
}
bot.callbackQuery(/^p:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await productCard(ctx, Number(ctx.match[1])); });

const waiting = new Map(); // userId -> { type, id }
bot.callbackQuery(/^buy:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const p = await shop.getProduct(Number(ctx.match[1]));
  if (!p) return;
  const kb = new InlineKeyboard();
  const max = p.unlimited ? 5 : Math.min(5, p.stock);
  for (let n = 1; n <= max; n++) kb.text(`${n} шт · ${money(p.price * n)}`, `bq:${p.id}:${n}`).row();
  kb.text('◁ Назад', `p:${p.id}`);
  waiting.set(ctx.from.id, { type: 'qty', id: p.id });
  await screen(ctx, productMedia(p), `<blockquote>🧮 Сколько берём? Выбери кнопкой или напиши число.</blockquote>`, kb);
});
bot.callbackQuery(/^bq:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  waiting.delete(ctx.from.id);
  await doBuy(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
});

// После покупки (из бота или мини-аппки): рефка, остаток склада, заказы без склада
export async function afterBuy(r, buyer) {
  const c = await pricing.cfg();
  for (const x of r.rewards || []) {
    notifyUser(x.to, x.level === 1
      ? `🤑 <b>+${money(x.amount)}</b> на баланс!\nТвой друг ${esc(buyer.first_name)} купил «${esc(r.product.title)}».`
      : `🤑 <b>+${money(x.amount)}</b> со второй линии — друг твоего друга купил «${esc(r.product.title)}».`);
  }
  if (r.status === 'pending') {
    notifyAdmin(`🛎 Новый заказ #${r.orderId} (без склада)\n${esc(r.product.title)} × ${r.qty} = ${money(r.total)}\nПокупатель: ${who(buyer)} <code>${buyer.id}</code>\nВыдать: <code>/done ${r.orderId} текст</code>`);
  }
  if (r.stockLeft != null && r.stockLeft <= c.low_stock) {
    notifyAdmin(`📦 «${esc(r.product.title)}» (#${r.product.id}): осталось <b>${r.stockLeft} шт</b> — пора докупить.\nДобавить: <code>/addstock ${r.product.id}</code>`);
  }
}
// Покупка упёрлась в защиту от минуса — пересчитываем цены и зовём админа
export async function onLoss(productId) {
  await announcePrices(await pricing.repriceAll());
  const p = await shop.getProduct(productId);
  notifyAdmin(`⛔️ Продажа «${esc(p?.title)}» (#${productId}) заблокирована: по текущей цене уходим в минус.\nЗакупка или курс выросли. Проверь <code>/plist</code>, поменяй цену <code>/setprice ${productId} цена</code> или включи автоцену <code>/auto ${productId} on</code>`);
}

async function doBuy(ctx, productId, qty) {
  try {
    const r = await shop.buy(ctx.from.id, productId, qty);
    let text = `✅ <b>Заказ #${r.orderId} оплачен</b>\n${esc(r.product.title)} × ${r.qty} — ${money(r.total)}`;
    if (r.discount) text += `\n🎁 Скидка новичка: −${money(r.discount)}`;
    text += r.content ? `\n\n<b>Ваш товар:</b>\n<code>${esc(r.content)}</code>` : '\n\nОператор свяжется с вами в ближайшее время.';
    text += '\n\n🤑 Понравилось? Кинь другу свою ссылку — получишь % с его покупок: /ref';
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('◁ В меню', 'main') });
    afterBuy(r, ctx.from).catch(() => {});
  } catch (e) {
    if (!(e instanceof shop.ShopError)) throw e;
    if (e.code === 'loss') onLoss(productId).catch(() => {});
    await ctx.reply('⚠️ ' + e.message, { reply_markup: new InlineKeyboard().text('💰 Пополнить', 'topup').text('◁ Назад', 'products') });
  }
}

// ---------- профиль / рефка / пополнение ----------
async function profileScreen(ctx) {
  const u = (await shop.getUser(ctx.from.id)) || (await shop.upsertUser(ctx.from));
  const d = new Date(u.created_at * 1000).toLocaleDateString('ru-RU');
  const text = `👤 <b>Профиль</b>\n\n<blockquote>🆔 ID: <code>${u.id}</code>\n💼 Баланс: <b>${money(u.balance)}</b>\n📦 Покупок: ${u.purchases}\n💸 Потрачено: ${money(u.spent)}\n🤑 С рефки: ${money(u.ref_income)}\n🗓 С нами с ${d}</blockquote>`;
  const kb = new InlineKeyboard().text('💰 Пополнить', 'topup').text('🤑 Рефка', 'ref').row()
    .text('💸 Передать баланс', 'transfer').text('📜 Покупки', 'orders').row().text('◁ Назад', 'main');
  await screen(ctx, banner('profile'), text, kb);
}
bot.callbackQuery('profile', async (ctx) => { await ctx.answerCallbackQuery(); await profileScreen(ctx); });

async function refScreen(ctx) {
  await shop.upsertUser(ctx.from);
  const i = await shop.refInfo(ctx.from.id);
  const link = refLink(ctx.from.id);
  const next = i.rank.next ? `\nДо ранга «${i.rank.next.name}» (${i.rank.next.pct}%): ещё ${i.rank.next.min - i.paid} покупающих друзей` : '\n👑 Максимальный ранг!';
  const top = i.top.slice(0, 5).map((t) => `${['🥇', '🥈', '🥉'][t.place - 1] || t.place + '.'} ${esc(t.name)} — ${money(t.sum)}${t.me ? ' ← ты' : ''}`).join('\n');
  const text = '🤑 <b>Рефка Govno Shop</b>\n\n'
    + `Твой ранг: <b>${esc(i.rank.name)} · ${i.rank.pct}%</b> с каждой покупки друга${next}\n`
    + `Вторая линия: <b>${i.l2pct}%</b> с покупок друзей твоих друзей\n`
    + `Другу — <b>скидка ${i.firstDisc}%</b> на первую покупку\n\n`
    + `<blockquote>👥 Друзей: ${i.friends} (покупали: ${i.paid})\n🌿 Вторая линия: ${i.l2}\n💰 Заработано: <b>${money(i.income)}</b></blockquote>\n`
    + (top ? `\n🏆 <b>Топ за 30 дней</b>\n${top}\n` : '')
    + (i.prize ? `\n🎁 ${esc(i.prize)}\n` : '')
    + `\nТвоя ссылка:\n<code>${link}</code>`;
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`💩 ${config.shopName}: ChatGPT, Claude и Gemini дешевле. По моей ссылке −${i.firstDisc}% на первую покупку`)}`;
  const kb = new InlineKeyboard().url('📤 Позвать друга', share).row().text('◁ Назад', 'profile');
  await screen(ctx, banner('ref'), text.slice(0, 1024), kb);
}
bot.callbackQuery('ref', async (ctx) => { await ctx.answerCallbackQuery(); await refScreen(ctx); });
bot.command('ref', refScreen);

bot.callbackQuery('transfer', async (ctx) => {
  await ctx.answerCallbackQuery();
  waiting.set(ctx.from.id, { type: 'transfer' });
  await screen(ctx, banner('profile'), '💸 <b>Передать баланс</b>\n\nОтправьте сообщением: <code>получатель сумма</code>\nНапример: <code>@username 100</code> или <code>123456789 50</code>', new InlineKeyboard().text('◁ Назад', 'profile'));
});

bot.callbackQuery('orders', async (ctx) => {
  await ctx.answerCallbackQuery();
  const list = (await shop.userOrders(ctx.from.id)).slice(0, 10);
  const text = list.length
    ? '📜 <b>Последние покупки</b>\n\n' + list.map((o) => `#${o.id} · ${esc(o.product_title)} × ${o.qty} · ${money(o.price)}${o.status === 'pending' ? ' · ⏳ ожидает выдачи' : ''}${o.content ? `\n<code>${esc(o.content)}</code>` : ''}`).join('\n\n')
    : '📜 Покупок пока нет — Говнюша грустит 💩';
  await screen(ctx, banner('profile'), text.slice(0, 1024), new InlineKeyboard().text('◁ Назад', 'profile'));
});

bot.callbackQuery('topup', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard();
  for (const m of pay.methods(ctx.from.id)) kb.text(m.title, `tm:${m.id}`).row();
  kb.text('◁ Назад', 'profile');
  await screen(ctx, banner('profile'), '💰 <b>Пополнение баланса</b>\n\nВыберите способ оплаты:', kb);
});
bot.callbackQuery(/^tm:(\w+)$/, async (ctx) => {
  const m = pay.methods(ctx.from.id).find((x) => x.id === ctx.match[1]);
  if (!m?.enabled) return ctx.answerCallbackQuery({ text: `${m?.title || 'Способ'} скоро будет доступен`, show_alert: true });
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard();
  for (const a of [100, 300, 500, 1000, 2000]) kb.text(`${a} ₽`, `ta:${m.id}:${a}`);
  kb.row().text('◁ Назад', 'topup');
  waiting.set(ctx.from.id, { type: 'amount', method: m.id });
  await screen(ctx, banner('profile'), '💰 Выберите сумму или напишите свою числом:', kb);
});
async function startTopup(ctx, method, amount) {
  try {
    const r = await pay.createTopup(ctx.from.id, amount, method);
    if (r.paid) return profileScreen(ctx);
    if (r.manual) {
      return ctx.reply(`🧾 <b>Заявка #${r.paymentId} на ${money(r.amount)}</b>\n\n${esc(r.text)}\n\nПосле оплаты нажмите кнопку ниже и пришлите подтверждение (скрин или номер перевода).`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('✅ Я оплатил', `proof:${r.paymentId}`) });
    }
    await ctx.reply('Оплатите счёт по кнопке ниже — баланс пополнится автоматически.', { reply_markup: new InlineKeyboard().url('💳 Оплатить', r.url) });
  } catch (e) {
    if (!(e instanceof shop.ShopError)) throw e;
    await ctx.reply('⚠️ ' + e.message);
  }
}
bot.callbackQuery(/^ta:(\w+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  waiting.delete(ctx.from.id);
  await startTopup(ctx, ctx.match[1], Number(ctx.match[2]));
});

// подтверждение ручной оплаты: следующее сообщение (фото/текст) пересылаем админу
async function askProof(ctx, pid) {
  const p = await pay.getPayment(pid);
  if (!p || p.user_id !== ctx.from.id || p.status !== 'pending') return ctx.reply('Заявка не найдена или уже обработана');
  waiting.set(ctx.from.id, { type: 'proof', id: pid });
  await ctx.reply(`Пришлите одним сообщением скрин или номер перевода по заявке #${pid}.`);
}
bot.callbackQuery(/^proof:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await askProof(ctx, Number(ctx.match[1])); });

bot.callbackQuery('about', async (ctx) => {
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard();
  const L = config.links;
  if (L.channel) kb.url('📣 Наш канал', L.channel);
  if (L.tips) kb.url('☕ Кинуть на чай', L.tips);
  kb.row();
  if (config.webappUrl) {
    kb.url('📄 Пользовательское соглашение', docUrl('terms.html')).row();
    kb.url('🔒 Политика конфиденциальности', docUrl('privacy.html')).row();
  }
  kb.text('◁ Назад', 'main');
  await screen(ctx, banner('about'), `💩 <b>${esc(config.shopName)}</b>\n\n<blockquote>${esc(config.about)}</blockquote>`, kb);
});

// ---------- объявление о новых ценах: админу и в канал ----------
export async function announcePrices(changes) {
  if (!changes?.length) return;
  const lines = changes.map((x) => `${x.emoji} ${esc(x.title)}: ${money(x.from)} → <b>${money(x.to)}</b> ${x.to > x.from ? '📈' : '📉'}`).join('\n');
  notifyAdmin(`💱 Цены пересчитаны по курсу/закупке:\n${lines}`);
  const visible = changes.filter((x) => x.active && x.from > 0);
  if (config.newsChat && visible.length) {
    const text = `💩 <b>Обновление цен</b>\n\n${visible.map((x) => `${x.emoji} ${esc(x.title)} — <b>${money(x.to)}</b>${x.to < x.from ? ' 🔻' : ''}`).join('\n')}`;
    bot.api.sendMessage(config.newsChat, text, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().url('💩 В шоп', `https://t.me/${bot.botInfo.username}`) })
      .catch((e) => console.error('news', e.message));
  }
}

// ---------- админка ----------
const isAdmin = (ctx) => ctx.from?.id === config.adminId;
const admin = (name, fn) => bot.command(name, (ctx) => (isAdmin(ctx) ? fn(ctx) : undefined));

admin('admin', (ctx) => ctx.reply(
`<b>Товары</b>
/plist — все товары: цена, закупка, прибыль, остаток
/addprod Название | эмодзи | цена | описание
/addunl … — то же, но услуга без склада (выдаёшь сам)
/addstock ID — затем пришли позиции, по одной в строке
/cleardemo — удалить все DEMO-заглушки со склада
/setprice ID цена · /setdesc ID · /hide ID · /show ID · /hit ID
/seticon ID — анимированный стикер/премиум-эмодзи как иконка
/setimg ID · /delimg ID · /sethero — обложки

<b>Закупка и автоцена</b>
/setcost ID сумма [usdt|rub] — закупочная цена
/auto ID on|off — автоцена от закупки и курса
/markup ID % — своя наценка (off — по умолчанию)
/rate — курс USDT; /rate 92.5 — вручную; /rate auto
/reprice — пересчитать цены сейчас
/cfg — настройки экономики; /set ключ значение

<b>Деньги</b>
/pay номер [сумма] — подтвердить ручное пополнение
/nopay номер — отклонить
/addbal userId сумма — начислить (минус — списать)

<b>Остальное</b>
/orders — заказы без склада · /done номер текст
/prize текст — приз для топа рефки (пусто — убрать)
/stats · /say текст — рассылка всем`, { parse_mode: 'HTML' }));

admin('plist', async (ctx) => {
  const c = await pricing.cfg();
  const rows = await q.all('SELECT p.*, (SELECT COUNT(*) FROM stock s WHERE s.product_id = p.id AND s.order_id IS NULL) AS st FROM products p ORDER BY p.category_id, p.sort, p.id');
  const line = (p) => {
    const cost = pricing.costRub(p, c);
    const pr = p.cost > 0 ? ` · закуп ${p.cost}${p.cost_cur === 'USDT' ? '$' : '₽'}${cost ? ` (${Math.round(cost)}₽)` : ''} · прибыль ${Math.round(pricing.profitOf(p, p.price, c))}₽` : '';
    return `#${p.id} ${p.hit ? '🔥' : ''}${p.emoji} ${esc(p.title)} — <b>${p.price}₽</b>${p.auto_price ? ' (авто)' : ''}${pr} — ${p.unlimited ? '∞' : p.st + ' шт'}${p.active ? '' : ' (скрыт)'}`;
  };
  const text = rows.map(line).join('\n') || 'Пусто';
  for (let i = 0; i < text.length; i += 3800) await ctx.reply(text.slice(i, i + 3800), { parse_mode: 'HTML' });
});

async function addProd(ctx, unl) {
  const [title, emoji, price, ...d] = ctx.match.split('|').map((s) => s.trim());
  if (!title || !emoji || !(Number(price) > 0)) return ctx.reply('Формат: /addprod Название | эмодзи | цена | описание');
  const { lastInsertRowid: id } = await q.run('INSERT INTO products (title, emoji, price, description, unlimited, sort) VALUES (?,?,?,?,?,100)', title, emoji, Number(price), d.join('|'), unl);
  await ctx.reply(`Создан товар #${id}.` + (unl ? '' : ` Добавь позиции: /addstock ${id}`) + `\nЗакупка: /setcost ${id} сумма usdt\nИконка: /seticon ${id}, обложка: /setimg ${id}`);
}
admin('addprod', (ctx) => addProd(ctx, 0));
admin('addunl', (ctx) => addProd(ctx, 1));

const needProduct = async (ctx, type) => {
  const id = Number(ctx.match);
  if (!(await q.get('SELECT 1 AS x FROM products WHERE id = ?', id))) return ctx.reply('Нет такого товара. Список: /plist');
  waiting.set(ctx.from.id, { type, id });
  const hint = { stock: 'позиции, по одной в строке', desc: 'новое описание', icon: 'анимированный стикер или премиум-эмодзи', img: 'фото или гифку' }[type];
  await ctx.reply(`Пришли ${hint} для #${id}. Отмена: /cancel`);
};
admin('addstock', (ctx) => needProduct(ctx, 'stock'));
admin('setdesc', (ctx) => needProduct(ctx, 'desc'));
admin('seticon', (ctx) => needProduct(ctx, 'icon'));
admin('setimg', (ctx) => needProduct(ctx, 'img'));
admin('sethero', (ctx) => { waiting.set(ctx.from.id, { type: 'hero' }); return ctx.reply('Пришли фото или гифку для шапки. Отмена: /cancel'); });
admin('delimg', async (ctx) => { await q.run('UPDATE products SET image = NULL, image_type = NULL WHERE id = ?', Number(ctx.match)); await ctx.reply('Обложка убрана'); });
admin('cleardemo', async (ctx) => {
  const r = await q.run("DELETE FROM stock WHERE order_id IS NULL AND content LIKE 'DEMO-%'");
  await ctx.reply(`Удалено заглушек: ${r.changes}`);
});
bot.command('cancel', (ctx) => { waiting.delete(ctx.from.id); return ctx.reply('Ок'); });
admin('setprice', async (ctx) => {
  const [id, price] = ctx.match.split(/\s+/).map(Number);
  if (!id || !(price > 0)) return ctx.reply('Формат: /setprice ID цена');
  const p = await q.get('SELECT * FROM products WHERE id = ?', id);
  if (!p) return ctx.reply('Нет такого товара');
  await q.run('UPDATE products SET old_price = ?, price = ?, auto_price = 0 WHERE id = ?', p.price, price, id);
  const c = await pricing.cfg();
  const warn = p.cost > 0 && pricing.profitOf(p, price, c) < 0 ? '\n⚠️ По этой цене ты в минусе — покупки будут заблокированы.' : '';
  await ctx.reply(`Готово, автоцена для #${id} выключена.${warn}`);
});
admin('hide', async (ctx) => { await q.run('UPDATE products SET active = 0 WHERE id = ?', Number(ctx.match)); await ctx.reply('Скрыт'); });
admin('show', async (ctx) => { await q.run('UPDATE products SET active = 1 WHERE id = ?', Number(ctx.match)); await ctx.reply('Показан'); });
admin('hit', async (ctx) => {
  const id = Number(ctx.match);
  await q.run('UPDATE products SET hit = 1 - hit WHERE id = ?', id);
  const p = await q.get('SELECT hit FROM products WHERE id = ?', id);
  await ctx.reply(p ? (p.hit ? '🔥 Теперь хит' : 'Больше не хит') : 'Нет такого товара');
});

// закупка и автоцена
admin('setcost', async (ctx) => {
  const [id, sum, cur] = ctx.match.split(/\s+/);
  const cost = Number(String(sum).replace(',', '.'));
  if (!Number(id) || !(cost >= 0)) return ctx.reply('Формат: /setcost ID сумма [usdt|rub]\nНапример: /setcost 1 16.7 usdt');
  const cc = String(cur || 'rub').toUpperCase() === 'USDT' ? 'USDT' : 'RUB';
  await q.run('UPDATE products SET cost = ?, cost_cur = ? WHERE id = ?', cost, cc, Number(id));
  await announcePrices(await pricing.repriceAll());
  const p = await q.get('SELECT * FROM products WHERE id = ?', Number(id));
  const c = await pricing.cfg();
  await ctx.reply(`Закупка #${id}: ${cost} ${cc} ≈ ${Math.round(pricing.costRub(p, c))} ₽\nЦена: ${p.price} ₽${p.auto_price ? ' (авто)' : ''} · прибыль ${Math.round(pricing.profitOf(p, p.price, c))} ₽` + (p.auto_price ? '' : `\nВключить автоцену: /auto ${id} on`));
});
admin('auto', async (ctx) => {
  const [id, v] = ctx.match.split(/\s+/);
  const on = v !== 'off' ? 1 : 0;
  await q.run('UPDATE products SET auto_price = ? WHERE id = ?', on, Number(id));
  await announcePrices(await pricing.repriceAll());
  const p = await q.get('SELECT price, cost FROM products WHERE id = ?', Number(id));
  await ctx.reply(on ? `Автоцена #${id} включена. Цена сейчас: ${p?.price} ₽${p?.cost > 0 ? '' : '\n⚠️ Укажи закупку: /setcost'}` : `Автоцена #${id} выключена`);
});
admin('markup', async (ctx) => {
  const [id, v] = ctx.match.split(/\s+/);
  await q.run('UPDATE products SET markup = ? WHERE id = ?', v === 'off' ? null : Number(v), Number(id));
  await announcePrices(await pricing.repriceAll());
  await ctx.reply('Готово');
});
admin('rate', async (ctx) => {
  const v = ctx.match.trim().replace(',', '.');
  if (v === 'auto') { await setSetting('rate_manual', '0'); await pricing.updateRate(); }
  else if (Number(v) > 0) { await setSetting('rate_manual', '1'); await setSetting('usdt_rate', String(Number(v))); }
  else if (v) return ctx.reply('Формат: /rate 92.5 или /rate auto');
  else await pricing.updateRate();
  await announcePrices(await pricing.repriceAll());
  const c = await pricing.cfg();
  await ctx.reply(`Курс USDT: ${c.usdt_rate || '—'} ₽ (${c.rate_manual ? 'вручную' : 'авто, CoinGecko'})\nС запасом на P2P ${c.p2p_pct}%: ${(c.usdt_rate * (1 + c.p2p_pct / 100)).toFixed(2)} ₽`);
});
admin('reprice', async (ctx) => {
  await pricing.updateRate();
  const changes = await pricing.repriceAll();
  await announcePrices(changes);
  const loss = await pricing.lossMakers();
  await ctx.reply((changes.length ? `Изменено цен: ${changes.length}` : 'Цены актуальны') + (loss.length ? `\n⛔️ В минусе: ${loss.map((p) => '#' + p.id).join(', ')}` : ''));
});
admin('cfg', async (ctx) => {
  const c = await pricing.cfg();
  const H = { fee_pct: 'комиссия приёма, %', markup_pct: 'наценка по умолчанию, %', min_profit: 'мин. прибыль со штуки, ₽', p2p_pct: 'запас на курс P2P, %', low_stock: 'предупреждать при остатке, шт', first_disc: 'скидка новичку по рефке, %', ref_l2: 'рефка 2-я линия, %', ref_cap: 'макс. доля прибыли на рефку, %' };
  await ctx.reply(Object.entries(H).map(([k, h]) => `<code>${k}</code> = <b>${c[k]}</b> — ${h}`).join('\n')
    + `\n\nРанги рефки: ${pricing.RANKS.map((r) => `${r.name} ${r.pct}% (от ${r.min})`).join(', ')}\nКурс USDT: ${c.usdt_rate || '—'}\n\nИзменить: <code>/set fee_pct 5</code>`, { parse_mode: 'HTML' });
});
admin('set', async (ctx) => {
  const [k, v] = ctx.match.split(/\s+/);
  if (!(k in pricing.DEFAULTS) || !(Number(v) >= 0)) return ctx.reply('Формат: /set ключ значение. Ключи: /cfg');
  await setSetting(k, String(Number(v)));
  await announcePrices(await pricing.repriceAll());
  await ctx.reply(`${k} = ${Number(v)}`);
});
admin('prize', async (ctx) => { await setSetting('ref_prize', ctx.match.trim()); await ctx.reply(ctx.match.trim() ? 'Приз сохранён' : 'Приз убран'); });

admin('pay', async (ctx) => {
  const [id, amt] = ctx.match.split(/\s+/).map(Number);
  try {
    const p = await pay.confirmManual(id, amt);
    notifyUser(p.user_id, `✅ Заявка #${p.id}: баланс пополнен на <b>${money(p.amount)}</b>`);
    await ctx.reply(`Зачислено ${money(p.amount)} пользователю ${p.user_id}`);
  } catch (e) { await ctx.reply('⚠️ ' + e.message); }
});
admin('nopay', async (ctx) => {
  try {
    const p = await pay.declineManual(Number(ctx.match));
    notifyUser(p.user_id, `❌ Заявка #${p.id} на ${money(p.amount)} отклонена. Если это ошибка — напишите в поддержку.`);
    await ctx.reply('Отклонено');
  } catch (e) { await ctx.reply('⚠️ ' + e.message); }
});
admin('addbal', async (ctx) => {
  const [id, amt] = ctx.match.split(/\s+/).map(Number);
  if (!(await shop.getUser(id)) || !amt) return ctx.reply('Формат: /addbal userId сумма (юзер должен был запустить бота)');
  await q.run('UPDATE users SET balance = balance + ? WHERE id = ?', amt, id);
  await ctx.reply('Готово');
  if (amt > 0) notifyUser(id, `💰 Баланс пополнен на ${money(amt)}`);
});
admin('orders', async (ctx) => {
  const rows = await q.all("SELECT * FROM orders WHERE status = 'pending' ORDER BY id");
  await ctx.reply(rows.map((o) => `#${o.id} ${o.product_title} ×${o.qty} — user ${o.user_id}`).join('\n') || 'Нет ожидающих');
});
admin('done', async (ctx) => {
  const m = ctx.match.match(/^(\d+)\s+([\s\S]+)/);
  if (!m) return ctx.reply('Формат: /done номер текст');
  const o = await q.get("SELECT * FROM orders WHERE id = ? AND status = 'pending'", Number(m[1]));
  if (!o) return ctx.reply('Заказ не найден');
  await q.run("UPDATE orders SET status = 'done', content = ? WHERE id = ?", m[2], o.id);
  notifyUser(o.user_id, `✅ <b>Заказ #${o.id} выполнен</b>\n${esc(o.product_title)}\n\n<code>${esc(m[2])}</code>`);
  await ctx.reply('Выдано');
});
admin('stats', async (ctx) => {
  const day = Math.floor(Date.now() / 1000) - 86400;
  const [s, o, p, r, d, refs] = await Promise.all([
    q.get('SELECT COUNT(*) AS users, SUM(balance) AS bal FROM users'),
    q.get('SELECT COUNT(*) AS n, SUM(price) AS sum FROM orders'),
    q.get("SELECT SUM(amount) AS sum FROM payments WHERE status = 'paid' AND method != 'test'"),
    q.get('SELECT SUM(amount) AS sum FROM ref_rewards'),
    q.get('SELECT COUNT(*) AS n, SUM(price) AS sum FROM orders WHERE created_at > ?', day),
    q.get('SELECT COUNT(*) AS n FROM users WHERE ref_by IS NOT NULL'),
  ]);
  await ctx.reply(`Юзеров: ${s.users} (по рефке: ${refs.n})\nНа балансах: ${money(s.bal || 0)}\nЗаказов: ${o.n} на ${money(o.sum || 0)}\nЗа сутки: ${d.n} на ${money(d.sum || 0)}\nПополнено: ${money(p.sum || 0)}\nВыплачено рефки: ${money(r.sum || 0)}`);
});
admin('say', async (ctx) => {
  if (!ctx.match) return ctx.reply('Формат: /say текст');
  const users = await q.all('SELECT id FROM users');
  await ctx.reply(`Рассылка на ${users.length} юзеров запущена`);
  (async () => { // не держим вебхук, шлём в фоне
    let ok = 0;
    for (const u of users) {
      try { await bot.api.sendMessage(u.id, ctx.match); ok++; } catch {}
      await new Promise((r) => setTimeout(r, 40));
    }
    notifyAdmin(`Рассылка завершена: ${ok}/${users.length}`);
  })();
});

// ---------- ответы на ожидания ----------
bot.on('message', async (ctx, next) => {
  const w = waiting.get(ctx.from.id);
  if (!w) return next();
  const msg = ctx.message;
  const text = msg.text?.trim() || '';

  if (isAdmin(ctx)) {
    if (w.type === 'stock' && text) {
      const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const l of lines) await q.run('INSERT INTO stock (product_id, content) VALUES (?, ?)', w.id, l);
      waiting.delete(ctx.from.id);
      return ctx.reply(`Добавлено позиций: ${lines.length}`);
    }
    if (w.type === 'desc' && text) {
      await q.run('UPDATE products SET description = ? WHERE id = ?', msg.text, w.id);
      waiting.delete(ctx.from.id);
      return ctx.reply('Описание обновлено');
    }
    if (w.type === 'icon') {
      let fileId = null;
      if (msg.sticker) {
        if (!msg.sticker.is_animated) return ctx.reply('Нужен анимированный стикер (не видео-стикер и не статичный)');
        fileId = msg.sticker.file_id;
      } else {
        const ce = msg.entities?.find((e) => e.type === 'custom_emoji');
        if (ce) {
          const s = await customEmojiFileId(ce.custom_emoji_id);
          if (!s?.animated) return ctx.reply('Этот эмодзи не анимированный (или видео-формат) — выбери другой');
          fileId = s.fileId;
        }
      }
      if (!fileId) return ctx.reply('Пришли анимированный стикер или премиум-эмодзи');
      await q.run('UPDATE products SET icon = ? WHERE id = ?', fileId, w.id);
      waiting.delete(ctx.from.id);
      return ctx.reply('Иконка обновлена ✨');
    }
    if (w.type === 'img' || w.type === 'hero') {
      const fid = msg.photo?.at(-1).file_id || msg.animation?.file_id || msg.video?.file_id;
      if (!fid) return ctx.reply('Пришли фото или гифку');
      const type = msg.photo ? 'photo' : 'video';
      if (w.type === 'hero') { await setSetting('hero', fid); await setSetting('hero_type', type); }
      else await q.run('UPDATE products SET image = ?, image_type = ? WHERE id = ?', fid, type, w.id);
      waiting.delete(ctx.from.id);
      return ctx.reply('Готово 🖼');
    }
  }
  if (w.type === 'qty' && text) {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) return ctx.reply('Введите целое число, например 1');
    waiting.delete(ctx.from.id);
    return doBuy(ctx, w.id, n);
  }
  if (w.type === 'amount' && text) {
    const n = Number(text.replace(',', '.').replace(/\s/g, ''));
    if (!(n >= 10)) return ctx.reply('Введите сумму числом, от 10 ₽');
    waiting.delete(ctx.from.id);
    return startTopup(ctx, w.method, n);
  }
  if (w.type === 'proof') {
    waiting.delete(ctx.from.id);
    const p = await pay.getPayment(w.id);
    if (!p || p.status !== 'pending') return ctx.reply('Заявка уже обработана');
    await notifyAdmin(`🧾 Подтверждение по заявке <b>#${p.id}</b> на ${money(p.amount)}\nОт: ${who(ctx.from)} <code>${ctx.from.id}</code>\n\nЗачислить: <code>/pay ${p.id}</code> (или <code>/pay ${p.id} сумма</code>)\nОтклонить: <code>/nopay ${p.id}</code>`);
    if (config.adminId) await ctx.forwardMessage(config.adminId).catch(() => {});
    return ctx.reply('✅ Отправили на проверку. Обычно это занимает до 15 минут — бот напишет, когда баланс пополнится.');
  }
  if (w.type === 'transfer' && text) {
    const [to, amt] = text.split(/\s+/);
    try {
      const r = await shop.transfer(ctx.from.id, to, Number(String(amt).replace(',', '.')));
      waiting.delete(ctx.from.id);
      notifyUser(r.to.id, `💸 Вам перевели ${money(r.amount)} от ${esc(ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name)}`);
      return ctx.reply(`✅ Переведено ${money(r.amount)}. Остаток: ${money(r.balance)}`);
    } catch (e) {
      if (!(e instanceof shop.ShopError)) throw e;
      return ctx.reply('⚠️ ' + e.message);
    }
  }
  return next();
});

bot.catch((e) => console.error('bot error', e.error?.message || e));

// Новый адрес мини-аппки → обновляем кнопку «Открыть шоп» в уже отправленных главных меню
export async function refreshMenus() {
  const rows = await q.all('SELECT chat_id, message_id FROM menu_msgs');
  let ok = 0;
  for (const r of rows) {
    try { await bot.api.editMessageReplyMarkup(r.chat_id, r.message_id, { reply_markup: mainKb() }); ok++; }
    catch (e) {
      if (!/not modified/i.test(e.message)) await q.run('DELETE FROM menu_msgs WHERE chat_id = ?', r.chat_id);
    }
    await new Promise((res) => setTimeout(res, 50));
  }
  if (rows.length) console.log(`Обновлено меню: ${ok}/${rows.length}`);
}

export async function setupMenu() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Главное меню' },
    { command: 'ref', description: 'Рефка — до 20% с покупок друзей' },
  ]).catch(() => {});
  if (config.webappUrl) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Шоп', web_app: { url: appUrl() } } }).catch((e) => console.error('menu', e.message));
  }
}

export async function startBot() {
  await bot.init();
  await setupMenu();
  if (config.webhook) {
    await bot.api.setWebhook(`${config.webappUrl}/tg/${config.secret}`, { secret_token: config.secret, drop_pending_updates: false });
    console.log('Бот на вебхуке: @' + bot.botInfo.username);
  } else {
    await bot.api.deleteWebhook();
    // если поллинг остановился (сеть, конфликт) — выходим, start.bat перезапустит
    bot.start({ onStart: (me) => console.log('Бот запущен (polling): @' + me.username) })
      .catch((e) => { console.error(new Date().toISOString(), 'polling остановлен:', e.message); process.exit(1); });
  }
}

export const webhookHandler = () => webhookCallback(bot, 'express', { secretToken: config.secret, onTimeout: 'return', timeoutMilliseconds: 9000 });
