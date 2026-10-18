import { q, now } from './db.js';
import { config } from './config.js';
import { credit, ShopError } from './shop.js';

// Способы пополнения. enabled=false — кнопка видна, но пишет «скоро».
// CryptoBot — автоматически (CRYPTOPAY_TOKEN), manual — перевод по инструкции из MANUAL_PAY, админ подтверждает /pay номер.
export function methods(userId) {
  const list = [
    { id: 'cryptobot', title: 'CryptoBot', sub: 'USDT, TON и другие монеты', enabled: !!config.cryptoPayToken },
  ];
  if (config.manualPay) list.push({ id: 'manual', title: config.manualTitle, sub: 'Подтверждение вручную', enabled: true });
  if (!config.cryptoPayToken && !config.manualPay) list.push({ id: 'sbp', title: 'СБП', sub: 'Через приложение банка', enabled: false });
  if (userId === config.adminId) list.push({ id: 'test', title: 'Тестовое пополнение', sub: 'Видно только админу', enabled: true });
  return list;
}

export async function createTopup(userId, amount, method) {
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount >= 10 && amount <= 100000)) throw new ShopError('Сумма от 10 до 100 000 ₽');
  const m = methods(userId).find((x) => x.id === method);
  if (!m) throw new ShopError('Способ оплаты недоступен');
  if (!m.enabled) throw new ShopError(`${m.title} скоро будет доступен`);

  if (method === 'test') {
    await q.run('INSERT INTO payments (user_id, amount, method, status, created_at) VALUES (?,?,?,?,?)', userId, amount, 'test', 'paid', now());
    await credit(userId, amount);
    return { paid: true };
  }

  const { lastInsertRowid: pid } = await q.run('INSERT INTO payments (user_id, amount, method, created_at) VALUES (?,?,?,?)', userId, amount, method, now());
  if (method === 'manual') return { manual: true, paymentId: pid, amount, text: config.manualPay };

  const r = await fetch('https://pay.crypt.bot/api/createInvoice', {
    method: 'POST',
    headers: { 'Crypto-Pay-API-Token': config.cryptoPayToken, 'content-type': 'application/json' },
    body: JSON.stringify({
      currency_type: 'fiat', fiat: 'RUB', amount: String(amount),
      description: `Пополнение баланса ${config.shopName}`, payload: String(pid), expires_in: 3600,
    }),
  });
  const j = await r.json();
  if (!j.ok) throw new ShopError('CryptoBot: ' + (j.error?.name || 'ошибка'));
  await q.run('UPDATE payments SET ext_id = ? WHERE id = ?', String(j.result.invoice_id), pid);
  return { url: j.result.bot_invoice_url, paymentId: pid };
}

// Ручная заявка: админ подтверждает (/pay) или отклоняет (/nopay). pending → paid атомарно.
export async function confirmManual(pid, amount = null) {
  const p = await q.get("SELECT * FROM payments WHERE id = ? AND method = 'manual'", pid);
  if (!p) throw new ShopError('Заявка не найдена');
  const sum = amount > 0 ? amount : p.amount;
  if (!(await q.run("UPDATE payments SET status = 'paid', amount = ? WHERE id = ? AND status = 'pending'", sum, pid)).changes) {
    throw new ShopError(`Заявка #${pid} уже ${p.status === 'paid' ? 'зачислена' : 'закрыта'}`);
  }
  await credit(p.user_id, sum);
  return { ...p, amount: sum };
}
export async function declineManual(pid) {
  const p = await q.get("SELECT * FROM payments WHERE id = ? AND method = 'manual' AND status = 'pending'", pid);
  if (!p) throw new ShopError('Заявка не найдена или уже закрыта');
  await q.run("UPDATE payments SET status = 'declined' WHERE id = ?", pid);
  return p;
}
export const getPayment = (pid) => q.get('SELECT * FROM payments WHERE id = ?', pid);

// Опрос оплаченных инвойсов CryptoBot (вебхуки не нужны)
export function startPolling(onPaid) {
  if (!config.cryptoPayToken) return;
  setInterval(async () => {
    try {
      const pend = await q.all("SELECT * FROM payments WHERE status = 'pending' AND method = 'cryptobot' AND ext_id IS NOT NULL");
      if (!pend.length) return;
      const r = await fetch('https://pay.crypt.bot/api/getInvoices?invoice_ids=' + pend.map((p) => p.ext_id).join(','), {
        headers: { 'Crypto-Pay-API-Token': config.cryptoPayToken },
      });
      const j = await r.json();
      if (!j.ok) return;
      for (const inv of j.result.items) {
        const p = pend.find((x) => x.ext_id === String(inv.invoice_id));
        if (!p) continue;
        if (inv.status === 'paid') {
          if ((await q.run("UPDATE payments SET status = 'paid' WHERE id = ? AND status = 'pending'", p.id)).changes) {
            await credit(p.user_id, p.amount);
            onPaid(p.user_id, p.amount);
          }
        } else if (inv.status === 'expired') {
          await q.run("UPDATE payments SET status = 'expired' WHERE id = ?", p.id);
        }
      }
    } catch (e) { console.error('poll', e.message); }
  }, 15000);
}
