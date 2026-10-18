import { q, getSetting, setSetting, now } from './db.js';

// Настройки экономики (меняются в боте: /set ключ значение). Проценты — числом: 3 = 3%.
export const DEFAULTS = {
  fee_pct: 3,        // комиссия приёма платежей
  markup_pct: 20,    // наценка по умолчанию для автоцены
  min_profit: 30,    // минимальная прибыль с одной штуки, ₽ — ниже не продаём
  p2p_pct: 2,        // запас на курс P2P при закупке USDT за рубли
  low_stock: 3,      // предупреждать, когда на складе осталось столько или меньше
  first_disc: 10,    // скидка новичку по реф-ссылке на первую покупку
  ref_l2: 3,         // процент со второй линии
  ref_cap: 50,       // максимум прибыли с заказа, который уходит на рефку
};
export const RANKS = [
  { min: 0, name: 'Котёнок', pct: 10 },
  { min: 3, name: 'Барыга', pct: 12 },
  { min: 10, name: 'Хапуга', pct: 15 },
  { min: 30, name: 'Босс котов', pct: 20 },
];
export const rankOf = (paid) => {
  let i = 0;
  while (i + 1 < RANKS.length && paid >= RANKS[i + 1].min) i++;
  return { ...RANKS[i], level: i, next: RANKS[i + 1] || null };
};

export async function cfg() {
  const rows = await q.all('SELECT key, value FROM settings');
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const c = {};
  for (const [k, d] of Object.entries(DEFAULTS)) c[k] = s[k] != null && s[k] !== '' ? Number(s[k]) : d;
  c.usdt_rate = Number(s.usdt_rate) || 0;
  c.rate_manual = s.rate_manual === '1';
  c.rate_at = Number(s.rate_at) || 0;
  c.ref_prize = s.ref_prize || '';
  return c;
}

// Себестоимость одной штуки в рублях (USDT пересчитываем по курсу + запас на P2P)
export function costRub(p, c) {
  if (!(p.cost > 0)) return 0;
  if (p.cost_cur === 'USDT') return c.usdt_rate ? p.cost * c.usdt_rate * (1 + c.p2p_pct / 100) : NaN;
  return p.cost;
}
// Прибыль с одной штуки по цене price (после комиссии приёма)
export const profitOf = (p, price, c) => price * (1 - c.fee_pct / 100) - costRub(p, c);

// «Красивая» цена: вверх до числа на 9 (1873 → 1879, 204 → 209)
const nice = (x) => Math.ceil((x + 1) / 10) * 10 - 1;
export function autoPrice(p, c) {
  const cost = costRub(p, c);
  if (!(cost > 0)) return null;
  const fee = c.fee_pct / 100, m = (p.markup ?? c.markup_pct) / 100;
  const byMarkup = cost / Math.max(0.05, 1 - fee - m);
  const byMin = (cost + c.min_profit) / (1 - fee);
  return nice(Math.max(byMarkup, byMin));
}

// Пересчитать цены всех товаров с автоценой. Возвращает список изменений.
export async function repriceAll() {
  const c = await cfg();
  const rows = await q.all('SELECT * FROM products WHERE auto_price = 1 AND cost > 0');
  const changes = [];
  for (const p of rows) {
    const np = autoPrice(p, c);
    if (!np || np === p.price) continue;
    await q.run('UPDATE products SET old_price = ?, price = ? WHERE id = ?', p.price, np, p.id);
    changes.push({ id: p.id, title: p.title, emoji: p.emoji, from: p.price, to: np, active: p.active });
  }
  return changes;
}

// Товары, которые при текущей цене уходят в минус (для ручных цен — автоцена их чинит сама)
export async function lossMakers() {
  const c = await cfg();
  const rows = await q.all('SELECT * FROM products WHERE cost > 0 AND active = 1');
  return rows.filter((p) => !(profitOf(p, p.price, c) >= 0)).map((p) => ({ ...p, cost_rub: costRub(p, c) }));
}

// Курс USDT → RUB. Берём с CoinGecko, при ошибке оставляем прошлый.
export async function updateRate() {
  if ((await getSetting('rate_manual')) === '1') return null;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub', { signal: AbortSignal.timeout(10000) });
    const rate = (await r.json())?.tether?.rub;
    if (!(rate > 10 && rate < 1000)) throw new Error('bad rate ' + rate);
    await setSetting('usdt_rate', String(rate));
    await setSetting('rate_at', String(now()));
    return rate;
  } catch (e) {
    console.error('курс USDT:', e.message);
    return null;
  }
}

export function startPricing(onChanges, everyMin = 15) {
  const tick = async () => {
    try {
      await updateRate();
      const changes = await repriceAll();
      const loss = await lossMakers();
      if (changes.length || loss.length) onChanges(changes, loss);
    } catch (e) { console.error('pricing', e.message); }
  };
  tick();
  setInterval(tick, everyMin * 60 * 1000);
}
