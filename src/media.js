import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from './config.js';

// Файлы из Telegram (анимированные стикеры .tgs, фото, гифки) скачиваем один раз и держим в кэше.
// .tgs — это уже gzip-сжатый Lottie JSON: отдаём его как есть с Content-Encoding: gzip, без распаковки на сервере.
const dir = 'data/media';
fs.mkdirSync(dir, { recursive: true });
const mem = new Map();
const pending = new Map();
const SET = 'AnimatedEmojies';
const norm = (e) => String(e).replace(/️/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, params = {}, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params),
      });
      const j = await r.json();
      if (j.ok) return j.result;
      if (j.error_code !== 429 || i >= tries) throw new Error(j.description);
      await sleep((j.parameters?.retry_after || 1) * 1000);
    } catch (e) {
      if (i >= tries || /not found|invalid/i.test(e.message)) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

// не больше 3 загрузок одновременно — Telegram не любит залпы запросов
let active = 0;
const queue = [];
const limit = async (fn) => {
  if (active >= 3) await new Promise((r) => queue.push(r));
  active++;
  try { return await fn(); } finally { active--; queue.shift()?.(); }
};

// Скачивает файл (один раз) и возвращает путь на диске
export async function ensureFile(fileId) {
  const key = crypto.createHash('md5').update(fileId).digest('hex');
  const path = `${dir}/${key}`;
  if (fs.existsSync(path)) return path;
  if (pending.has(key)) return pending.get(key);
  const p = limit(async () => {
    const f = await api('getFile', { file_id: fileId });
    const r = await fetch(`https://api.telegram.org/file/bot${config.token}/${f.file_path}`);
    if (!r.ok) throw new Error('download ' + r.status);
    fs.writeFileSync(path + '.tmp', Buffer.from(await r.arrayBuffer()));
    fs.renameSync(path + '.tmp', path);
    return path;
  }).finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

export async function fileBuffer(fileId) {
  if (mem.has(fileId)) return mem.get(fileId);
  const buf = fs.readFileSync(await ensureFile(fileId));
  if (buf.length < 400_000) mem.set(fileId, buf);
  return buf;
}

let emojiMap = null;
export async function emojiFileId(emoji) {
  if (!emojiMap) {
    emojiMap = (async () => {
      const set = await api('getStickerSet', { name: SET });
      const m = new Map();
      for (const s of set.stickers) if (!m.has(norm(s.emoji))) m.set(norm(s.emoji), s.file_id);
      return m;
    })().catch((e) => { emojiMap = null; throw e; });
  }
  return (await emojiMap).get(norm(emoji)) || null;
}

// Кастомный эмодзи (из премиум-паков) → file_id его стикера
export async function customEmojiFileId(id) {
  const [s] = await api('getCustomEmojiStickers', { custom_emoji_ids: [id] });
  return s ? { fileId: s.file_id, animated: s.is_animated } : null;
}

// Прогрев кэша при старте, чтобы первые открытия мини-аппки были мгновенными
export async function warmup(emojis, fileIds) {
  for (const e of emojis) { try { const f = await emojiFileId(e); if (f) await fileBuffer(f); } catch (x) { console.error('warmup', e, x.message); } }
  for (const f of fileIds) { try { await fileBuffer(f); } catch {} }
}
