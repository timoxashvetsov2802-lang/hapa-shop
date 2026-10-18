import fs from 'node:fs';
import { config } from './config.js';

// Единый асинхронный интерфейс: q.get / q.all / q.run / tx(async (t) => ...).
// Локально — встроенный node:sqlite (файл data/shop.db), на хостинге — Turso (тот же SQLite, но в облаке).
export const now = () => Math.floor(Date.now() / 1000);
export let q, tx;

if (config.tursoUrl) {
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url: config.tursoUrl, authToken: config.tursoToken });
  const objs = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
  const wrap = (x) => ({
    get: async (sql, ...args) => objs(await x.execute({ sql, args }))[0],
    all: async (sql, ...args) => objs(await x.execute({ sql, args })),
    run: async (sql, ...args) => {
      const rs = await x.execute({ sql, args });
      return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
    },
  });
  q = wrap(client);
  tx = async (fn) => {
    const t = await client.transaction('write');
    try { const r = await fn(wrap(t)); await t.commit(); return r; }
    catch (e) { await t.rollback().catch(() => {}); throw e; }
    finally { t.close(); }
  };
} else {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync('data', { recursive: true });
  const db = new DatabaseSync('data/shop.db');
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  const cache = new Map();
  const st = (sql) => { let s = cache.get(sql); if (!s) cache.set(sql, (s = db.prepare(sql))); return s; };
  q = {
    get: async (sql, ...a) => st(sql).get(...a),
    all: async (sql, ...a) => st(sql).all(...a),
    run: async (sql, ...a) => { const r = st(sql).run(...a); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; },
  };
  let lock = Promise.resolve();
  tx = (fn) => {
    const run = lock.then(async () => {
      db.exec('BEGIN IMMEDIATE');
      try { const r = await fn(q); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    });
    lock = run.catch(() => {});
    return run;
  };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT, first_name TEXT,
    balance REAL NOT NULL DEFAULT 0, purchases INTEGER NOT NULL DEFAULT 0, spent REAL NOT NULL DEFAULT 0,
    ref_by INTEGER, ref_income REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '📁', sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER,
    title TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '✨', icon TEXT, image TEXT, image_type TEXT, color TEXT,
    description TEXT NOT NULL DEFAULT '', price REAL NOT NULL,
    unlimited INTEGER NOT NULL DEFAULT 0, wide INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0, cost_cur TEXT NOT NULL DEFAULT 'RUB', markup REAL, auto_price INTEGER NOT NULL DEFAULT 0,
    hit INTEGER NOT NULL DEFAULT 0, old_price REAL)`,
  `CREATE TABLE IF NOT EXISTS ref_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, from_user INTEGER NOT NULL, order_id INTEGER NOT NULL,
    level INTEGER NOT NULL, amount REAL NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ref_rewards_user ON ref_rewards(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS users_ref ON users(ref_by)`,
  `CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, content TEXT NOT NULL, order_id INTEGER)`,
  `CREATE INDEX IF NOT EXISTS stock_free ON stock(product_id, order_id)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_title TEXT NOT NULL,
    qty INTEGER NOT NULL, price REAL NOT NULL, content TEXT, status TEXT NOT NULL DEFAULT 'done', created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', ext_id TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS menu_msgs (chat_id INTEGER PRIMARY KEY, message_id INTEGER NOT NULL)`,
];

export async function initDb() {
  for (const s of SCHEMA) await q.run(s);
  if (!(await q.get('SELECT 1 AS x FROM products LIMIT 1'))) await (await import('./seed.js')).seed();
}

export const getSetting = async (k) => (await q.get('SELECT value FROM settings WHERE key = ?', k))?.value ?? null;
export const setSetting = (k, v) => q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, v);
