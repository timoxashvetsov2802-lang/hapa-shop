'use strict';
const tg = window.Telegram?.WebApp;
try {
  tg.ready(); tg.expand();
  tg.setHeaderColor('#1a0f0a'); tg.setBackgroundColor('#1a0f0a'); tg.setBottomBarColor?.('#1a0f0a');
  tg.disableVerticalSwipes?.();
} catch {}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Math.round(n * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
const H = {
  tap: () => tg?.HapticFeedback?.impactOccurred('light'),
  sel: () => tg?.HapticFeedback?.selectionChanged(),
  ok: () => tg?.HapticFeedback?.notificationOccurred('success'),
  err: () => tg?.HapticFeedback?.notificationOccurred('error'),
};
const ICON = {
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"/></svg>',
  plane: '<svg viewBox="0 0 24 24"><path d="M21.4 3.2L2.9 10.4c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.4c.3.9 1.4 1.1 2 .4l2.5-2.6 4.7 3.5c.7.5 1.7.1 1.9-.7l3.2-15.2c.2-1-.8-1.8-1.7-1.5zM9.2 13.4l8.4-5.6-6.7 6.9-.3 3z"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4.4 0-8 2.2-8 5v1.5h16V19c0-2.8-3.6-5-8-5z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
};
const METHOD_ICON = {
  sbp: '<svg class="mi" viewBox="0 0 36 36"><path d="M7 6l7 4v16l-7 4z" fill="#5b57a2"/><path d="M14 10l15-4-8 12z" fill="#d90751"/><path d="M14 26l15 4-8-12z" fill="#0a8f3e"/><path d="M21 18L7 30h14z" fill="#fab619" opacity=".9"/><path d="M21 18L7 6h14z" fill="#1ab5e8" opacity=".9"/></svg>',
  crypto: '<svg class="mi" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#26a17b"/><path d="M10 10.5h16v4h-6v3.1c3.6.2 6.3 1 6.3 2s-2.7 1.8-6.3 2V28h-4v-6.4c-3.6-.2-6.3-1-6.3-2s2.7-1.8 6.3-2v-3.1h-6zm6 8.3c-2.4.1-4.2.5-4.2.9s1.8.8 4.2.9c.7 0 1.3.1 2 .1s1.3 0 2-.1c2.4-.1 4.2-.5 4.2-.9s-1.8-.8-4.2-.9v1.8c-.6 0-1.3.1-2 .1s-1.4 0-2-.1z" fill="#fff"/></svg>',
  cryptobot: '<svg class="mi" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#2aa2ff"/><path d="M10 12l8 14 8-14h-5l-3 6-3-6z" fill="#fff"/></svg>',
  manual: '<svg class="mi" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ff7a1a"/><path d="M11 13h14v10H11zM11 17h14M14 21h4" stroke="#000" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  test: '<svg class="mi" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#3a3a3f"/><path d="M14 9h8M15 9v7l-5 9a2 2 0 001.8 3h12.4a2 2 0 001.8-3l-5-9V9" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
};

const S = { user: null, shop: {}, methods: [], ref: null, orders: [], cats: [], products: [], tab: 'shop', cat: 0, query: '' };
const byId = (id) => S.products.find((p) => p.id === id);

// ---------- API ----------
// Мини-аппка лежит на GitHub Pages, а API — на ПК за туннелем, адрес которого меняется.
// Адрес приходит параметром ?api= из кнопки бота; если он уже мёртв — берём свежий из gist (?g=), который обновляет бот.
const QS = new URLSearchParams(location.search);
const API_RE = /^https:\/\/[a-z0-9-]+\.(lhr\.life|trycloudflare\.com|onrender\.com)$/;
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const ON_PAGES = location.hostname.endsWith('github.io');
let API = '';
if (ON_PAGES) {
  const p = QS.get('api'), saved = ls.get('hapa:api');
  API = API_RE.test(p) ? p : API_RE.test(saved) ? saved : '';
}
const GIST = /^[0-9a-f]{20,40}$/.test(QS.get('g') || '') ? QS.get('g') : ls.get('hapa:gist');
if (GIST) ls.set('hapa:gist', GIST);
const U = (p) => (p && p.startsWith('/') ? API + p : p); // путь сервера → полный адрес
async function discoverApi() {
  if (!ON_PAGES || !GIST) return false;
  try {
    const j = await fetch('https://api.github.com/gists/' + GIST, { cache: 'no-store' }).then((r) => r.json());
    const u = JSON.parse(j.files['api.json'].content).api;
    if (API_RE.test(u) && u !== API) { API = u; ls.set('hapa:api', u); return true; }
  } catch {}
  return false;
}
const RECONNECT = 'Связь с магазином обновилась — закройте его и откройте заново кнопкой «Открыть»';
async function api(path, body, retry = true) {
  const again = async () => (retry && (await discoverApi()) ? api(path, body, false) : null);
  let r;
  try {
    r = await fetch(API + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-init-data': tg?.initData || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { const x = await again(); if (x) return x; throw new Error(RECONNECT); }
  const j = await r.json().catch(() => null);
  if (!j) { const x = await again(); if (x) return x; throw new Error(RECONNECT); } // ответил не наш сервер (туннель сменил адрес)
  if (ON_PAGES) ls.set('hapa:api', API);
  if (!r.ok) throw new Error(j.error || 'Нет связи с сервером');
  return j;
}
function toast(msg, err) {
  const t = $('#toast');
  t.hidden = true; void t.offsetWidth;
  t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
const confirmTg = (message) => new Promise((res) => (tg?.showConfirm ? tg.showConfirm(message, res) : res(confirm(message))));
const popup = (title, message, okText) => new Promise((res) => {
  if (!tg?.showPopup) return res(confirm(message));
  tg.showPopup({ title, message, buttons: [{ id: 'ok', type: 'default', text: okText }, { type: 'cancel' }] }, (id) => res(id === 'ok'));
});
function openLink(url) {
  if (!url) return toast('Ссылка ещё не настроена');
  if (/^https:\/\/t\.me\//.test(url)) tg?.openTelegramLink ? tg.openTelegramLink(url) : window.open(url);
  else tg?.openLink ? tg.openLink(url) : window.open(url);
}
function copy(text, msg = 'Скопировано') {
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => { toast(msg); H.ok(); }, () => toast('Не удалось скопировать', true));
}

// ---------- анимированные эмодзи (Lottie на canvas: быстро, паузятся вне экрана) ----------
const Lot = {
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  text: new Map(),
  live: new Set(),
  io: new IntersectionObserver((es) => es.forEach((e) => {
    const a = e.target._a;
    if (!a) return;
    if (e.isIntersecting) { if (!e.target._sized) { a.resize(); e.target._sized = 1; } a.play(); } else a.pause();
  }), { rootMargin: '80px' }),
  src: (emoji, icon) => U(icon || '/api/sticker?e=' + encodeURIComponent(emoji)),
  load(url) {
    const get = () => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))));
    if (!this.text.has(url)) {
      this.text.set(url, get().catch(() => new Promise((r) => setTimeout(r, 1500)).then(get)).catch((e) => { this.text.delete(url); throw e; }));
    }
    return this.text.get(url);
  },
  mount(root) {
    if (!window.lottie) return void setTimeout(() => this.mount(root), 50);
    for (const el of $$('.lot[data-src]:not([data-m])', root)) {
      el.dataset.m = 1;
      this.load(el.dataset.src).then((txt) => {
        if (!el.isConnected) return;
        el.textContent = '';
        const a = lottie.loadAnimation({
          container: el, renderer: 'canvas', loop: true, autoplay: false,
          animationData: JSON.parse(txt), rendererSettings: { dpr: this.dpr, clearCanvas: true, preserveAspectRatio: 'xMidYMid meet' },
        });
        a.setSubframe(false);
        el._a = a; this.live.add(a); this.io.observe(el);
      }).catch(() => {});
    }
  },
  gc() {
    for (const a of this.live) if (!a.wrapper?.isConnected) { this.io.unobserve(a.wrapper); a.destroy(); this.live.delete(a); }
  },
};
const lot = (emoji, cls = '', icon = null) => `<span class="lot ${cls}" data-src="${esc(Lot.src(emoji, icon))}">${esc(emoji)}</span>`;
document.addEventListener('visibilitychange', () => (document.hidden ? lottie?.freeze?.() : lottie?.unfreeze?.()));

// ---------- навигация: вкладки + страницы поверх ----------
const scrolls = {};
function setTab(tab) {
  if (tab === S.tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
  scrolls[S.tab] = window.scrollY;
  S.tab = tab;
  $$('#app .tab').forEach((s) => (s.hidden = s.dataset.tab !== tab));
  $$('#nav button').forEach((b, i) => { b.classList.toggle('on', b.dataset.tab === tab); if (b.dataset.tab === tab) $('#nav .ind').style.transform = `translateX(${i * 62}px)`; });
  window.scrollTo(0, scrolls[tab] || 0);
  H.tap();
}
$$('#nav button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

const pages = [];
function openPage(html, mount) {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = html;
  $('#pages').append(el);
  pages.push(el);
  document.body.classList.add('sub');
  tg?.BackButton?.show();
  Lot.mount(el);
  mount?.(el);
  return el;
}
function back() {
  if ($('#sheet').firstChild) return closeSheet();
  const el = pages.pop();
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => { el.remove(); Lot.gc(); }, 220);
  if (!pages.length) { document.body.classList.remove('sub'); tg?.BackButton?.hide(); }
}
tg?.BackButton?.onClick(back);
document.addEventListener('keydown', (e) => e.key === 'Escape' && back());

function openSheet(html, mount) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-bg"><div class="sh"><div class="grab"></div>${html}</div></div>`;
  s.firstChild.addEventListener('click', (e) => e.target === s.firstChild && closeSheet());
  tg?.BackButton?.show();
  Lot.mount(s);
  mount?.(s);
}
function closeSheet() {
  $('#sheet').innerHTML = '';
  Lot.gc();
  if (!pages.length) tg?.BackButton?.hide();
}

// ---------- общие куски разметки ----------
const avatar = (u) => (u.photo ? `<img class="ava" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="ava">${esc((u.first_name || '?')[0].toUpperCase())}</span>`);
function stockInfo(p) {
  if (p.stock == null) return { txt: '∞', pct: 100, low: false, out: false };
  return { txt: p.stock > 0 ? `${p.stock} шт` : 'нет', pct: Math.min(100, 12 + p.stock * 1.6), low: p.stock > 0 && p.stock <= 5, out: p.stock <= 0 };
}
function productCard(p) {
  const s = stockInfo(p);
  const old = p.old_price ? `<s class="old">${money(p.old_price)}</s>` : '';
  const price = `<span class="pr num">${money(p.price)} <i>₽</i>${old}${p.wide ? '' : `<span class="st ${s.low ? 'low' : ''}">${s.txt}</span>`}</span>`;
  const hit = p.hit ? '<span class="hit">ХИТ</span>' : '';
  const bar = `<span class="bar"><s class="${s.low ? 'low' : ''}" style="width:${s.pct}%"></s></span>`;
  if (p.wide) {
    return `<button class="pc wide ${s.out ? 'out' : ''}" data-p="${p.id}">${hit}${lot(p.emoji, '', p.icon)}<span class="mid"><span class="pt">${esc(p.title)}</span>${bar}</span>${price}</button>`;
  }
  return `<button class="pc ${s.out ? 'out' : ''}" data-p="${p.id}">${hit}${lot(p.emoji, '', p.icon)}<span class="pt">${esc(p.title)}</span><span>${price}${bar}</span></button>`;
}
const grid = (list) => `<div class="grid">${list.filter((p) => !p.wide).map(productCard).join('')}${list.filter((p) => p.wide).map(productCard).join('')}</div>`;
function bindCards(root) {
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-p]');
    if (c) { H.tap(); openProduct(byId(Number(c.dataset.p))); }
  });
}
function heroBg() {
  const h = S.shop.hero;
  if (!h) return '<div class="bg gen"></div>';
  return h.type === 'video'
    ? `<div class="bg dim"><video src="${esc(U(h.url))}" autoplay muted loop playsinline></video></div>`
    : `<div class="bg dim"><img src="${esc(U(h.url))}" alt=""></div>`;
}

// ---------- вкладка «Магазин»: шапка с Говнюшей, поиск, фильтр по категориям ----------
function renderShop() {
  const el = $('[data-tab=shop]');
  const cats = S.cats.map((c) => ({ c, n: S.products.filter((p) => p.category_id === c.id).length })).filter((x) => x.n);
  el.innerHTML = `
    <div class="card hero">${heroBg()}${S.shop.hero ? '' : mascot('hi', 'hero-m')}
      <div class="top"><span class="name">${esc(S.shop.name)}</span><span class="tr"><button class="snd" id="snd" data-nofart aria-label="Звук">${Fart.muted ? '🔇' : '💨'}</button>${avatar(S.user)}</span></div>
      <div class="slogan">Говно<br><b>вопрос</b></div>
      <div><div class="lbl">Баланс</div><div class="bal num"><span data-bind="balance">${money(S.user.balance)}</span><i>₽</i><button class="plus" id="plus" aria-label="Пополнить">${ICON.plus}</button></div></div>
    </div>
    <label class="search">${ICON.search}<input id="q" placeholder="Найти: чат гпт, клод, гемини…" value="${esc(S.query)}" autocomplete="off" spellcheck="false"></label>
    ${cats.length > 1 ? `<div class="cats"><button class="cat ${S.cat ? '' : 'on'}" data-c="0">Всё <i>${S.products.length}</i></button>${cats.map(({ c, n }) => `<button class="cat ${S.cat === c.id ? 'on' : ''}" data-c="${c.id}">${esc(c.emoji)} ${esc(c.title)} <i>${n}</i></button>`).join('')}</div>` : ''}
    <div id="list"></div>`;
  $('#plus', el).onclick = () => { H.tap(); openTopup(); };
  $('#snd', el).onclick = (e) => { const m = Fart.toggle(); e.currentTarget.textContent = m ? '🔇' : '💨'; toast(m ? 'Пуки выключены 🤐' : 'Пуки включены 💨'); };
  $$('.cat', el).forEach((b) => (b.onclick = () => { H.sel(); S.cat = Number(b.dataset.c); $$('.cat', el).forEach((x) => x.classList.toggle('on', x === b)); renderList(); }));
  $('#q', el).addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
  renderList();
}
function renderList() {
  const box = $('[data-tab=shop] #list');
  if (!box) return;
  const q = S.query.trim().toLowerCase().replace(/ё/g, 'е');
  const alias = { 'чат гпт': 'chatgpt', 'чатгпт': 'chatgpt', 'гпт': 'gpt', 'клод': 'claude', 'гемини': 'gemini', 'стим': 'steam', 'звезд': 'stars', 'курсор': 'cursor', 'грок': 'grok' };
  const words = q ? [q, ...Object.entries(alias).filter(([k]) => q.includes(k)).map(([, v]) => v)] : [];
  const list = S.products.filter((p) => (!S.cat || p.category_id === S.cat)
    && (!words.length || words.some((w) => (p.title + ' ' + p.description).toLowerCase().replace(/ё/g, 'е').includes(w))));
  box.innerHTML = list.length ? grid(list) : `<div class="empty">${mascot('sad', 'em')}<div>${S.products.length ? 'Ничего не нашёл' : 'Товаров пока нет'}</div></div>`;
  Lot.mount(box); Lot.gc();
}

// ---------- страница товара ----------
function descHtml(text) {
  return String(text || '').split(/\n\s*\n/).filter((b) => b.trim()).map((b) => {
    let h = esc(b.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" data-link>$1</a>');
    return `<div class="q">${h}</div>`;
  }).join('');
}
function openProduct(p) {
  if (!p) return;
  const s = stockInfo(p);
  const max = p.stock == null ? 50 : Math.min(p.stock, 50);
  let qty = 1;
  const cover = p.image
    ? (p.image.type === 'video' ? `<video src="${esc(U(p.image.url))}" autoplay muted loop playsinline></video>` : `<img src="${esc(U(p.image.url))}" alt="">`)
    : lot(p.emoji, 'cov', p.icon);
  openPage(`
    <div class="in">
      <div class="cover" style="--c:${esc(p.color || '#5b6cff')}">${cover}</div>
      <div class="ptl">${lot(p.emoji, 'm', p.icon)}<span>${esc(p.title)}</span></div>
      <div class="pprice num">${money(p.price)} ₽${p.old_price ? ` <s class="old">${money(p.old_price)} ₽</s>` : ''} <span class="stk">${ICON.box}${s.txt}</span></div>
      <div class="qs">${descHtml(p.description)}</div>
    </div>
    <div class="buybar">
      <div class="step"><button data-d="-1" aria-label="Меньше">−</button><span class="num" id="qty">1</span><button data-d="1" aria-label="Больше">+</button></div>
      <button class="buy" id="buy" ${s.out ? 'disabled' : ''}>${lot('🛍', 's')}<span id="buyt">${s.out ? 'Нет в наличии' : `Купить · ${money(p.price)} ₽`}</span></button>
      <button class="share" id="share" aria-label="Поделиться">${ICON.plane}</button>
    </div>`, (el) => {
    const upd = () => {
      $('#qty', el).textContent = qty;
      $('[data-d="-1"]', el).disabled = qty <= 1;
      $('[data-d="1"]', el).disabled = qty >= max;
      if (!s.out) $('#buyt', el).textContent = `Купить · ${money(p.price * qty)} ₽`;
    };
    upd();
    $$('[data-d]', el).forEach((b) => (b.onclick = () => { qty = Math.min(max, Math.max(1, qty + Number(b.dataset.d))); H.sel(); upd(); }));
    $('#share', el).onclick = () => {
      const link = `https://t.me/${S.shop.bot}?start=p_${p.id}`;
      openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(p.title)}`);
    };
    el.addEventListener('click', (e) => { const a = e.target.closest('[data-link]'); if (a) { e.preventDefault(); openLink(a.href); } });
    $('#buy', el).onclick = () => buyFlow(p, qty);
  });
}

async function buyFlow(p, qty) {
  const total = Math.round(p.price * qty * 100) / 100;
  if (S.user.balance < total) {
    const need = Math.ceil(total - S.user.balance);
    H.err();
    if (await popup('Недостаточно средств', `Не хватает ${money(need)} ₽. Пополнить баланс?`, 'Пополнить')) openTopup(Math.max(need, 50));
    return;
  }
  if (!(await confirmTg(`Купить «${p.title}»${qty > 1 ? ` × ${qty}` : ''} за ${money(total)} ₽?`))) return;
  const btn = $('#buy', pages.at(-1));
  btn.disabled = true;
  try {
    const r = await api('/buy', { productId: p.id, qty });
    H.ok();
    Fart.celebrate();
    S.user.balance = r.balance;
    if (p.stock != null) p.stock -= qty;
    refreshState();
    bindBalance();
    renderShopStock(p);
    openSheet(`
      <div class="ctr">${mascot('wow', 'sm')}</div>
      <h3>Говно вопрос! Заказ #${r.orderId}</h3>
      ${r.discount ? `<p class="disc">🎁 Скидка новичка: −${money(r.discount)} ₽</p>` : ''}
      ${r.content
        ? `<p>Ваш товар — он также сохранён во вкладке «Покупки»</p><div class="key"><code>${esc(r.content)}</code><button id="cp">Копировать</button></div>`
        : '<p>Оператор свяжется с вами в Telegram в ближайшее время</p>'}
      <button class="btn" id="ok" style="margin-top:16px">Готово</button>
      <button class="btn ghost" id="inv">🎁 Позвать друга — +100 ₽ тебе</button>`, (sh) => {
      $('#cp', sh)?.addEventListener('click', () => copy(r.content));
      $('#ok', sh).onclick = () => { closeSheet(); back(); };
      $('#inv', sh).onclick = () => { closeSheet(); back(); openInvite(); };
    });
  } catch (e) {
    H.err(); toast(e.message, true);
  } finally { btn.disabled = false; }
}

function renderShopStock(p) {
  const card = $(`[data-tab=shop] [data-p="${p.id}"]`);
  if (!card) return;
  const s = stockInfo(p);
  const st = $('.st', card); if (st) { st.textContent = s.txt; st.classList.toggle('low', s.low); }
  const bar = $('.bar s', card); if (bar) { bar.style.width = s.pct + '%'; bar.classList.toggle('low', s.low); }
  card.classList.toggle('out', s.out);
}
function bindBalance() { $$('[data-bind=balance]').forEach((e) => (e.textContent = money(S.user.balance))); }

// ---------- пополнение ----------
function amountField(el, initial, onChange) {
  const box = $('.amt', el), inp = $('input', box);
  const set = (v, fromInput) => {
    v = Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
    if (!fromInput || inp.value !== String(v || '')) inp.value = v ? String(v) : (fromInput ? '' : '0');
    inp.style.width = Math.max(1, inp.value.length || 1) + 0.15 + 'ch';
    box.classList.toggle('zero', !v);
    onChange(v);
    return v;
  };
  inp.addEventListener('input', () => set(inp.value.replace(/\D/g, ''), true));
  inp.addEventListener('blur', () => { if (!inp.value) set(0); });
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && inp.blur());
  set(initial);
  return set;
}
function openTopup(preset = 100) {
  let amount = preset, method = null;
  const legal = `<p class="legal">Оплачивая, вы принимаете <a href="terms.html" data-doc>пользовательское соглашение</a> и <a href="privacy.html" data-doc>политику конфиденциальности</a></p>`;
  openPage(`
    <div class="in">
      <div class="ptitle">Пополнение</div>
      <div class="glow">${lot('💰', 'xl')}</div>
      <div class="amt num"><input inputmode="numeric" aria-label="Сумма"><i>₽</i></div>
      <div class="hint" id="hint"></div>
      <div class="chips">${[100, 300, 500, 1000].map((a) => `<button class="chip num" data-a="${a}">${money(a)}<i>₽</i></button>`).join('')}</div>
      <div class="sec">Способ оплаты</div>
      <div class="list">${S.methods.map((m) => `<button class="meth ${m.enabled ? '' : 'off'}" data-m="${m.id}">${METHOD_ICON[m.id] || ''}<span class="mid"><span class="t" style="display:block">${esc(m.title)}</span><span class="s msub" style="display:block"></span></span><span class="chev">›</span></button>`).join('')}</div>
      ${legal}
    </div>`, (el) => {
    const set = amountField(el, amount, (v) => {
      amount = v;
      $('#hint', el).textContent = v ? `Баланс станет ${money(S.user.balance + v)} ₽` : `На балансе ${money(S.user.balance)} ₽`;
      $$('.chip', el).forEach((c) => c.classList.toggle('on', Number(c.dataset.a) === v));
      $$('.msub', el).forEach((s) => (s.textContent = v ? `Счёт на ${money(v)} ₽` : 'Укажите сумму'));
    });
    $$('.chip', el).forEach((c) => (c.onclick = () => { H.sel(); set(Number(c.dataset.a)); }));
    el.addEventListener('click', (e) => { const d = e.target.closest('[data-doc]'); if (d) { e.preventDefault(); openLink(new URL(d.getAttribute('href'), location.href).href); } });
    $$('.meth', el).forEach((b) => (b.onclick = async () => {
      const m = S.methods.find((x) => x.id === b.dataset.m);
      if (!m.enabled) { H.err(); return toast(`${m.title} скоро будет доступен`); }
      if (amount < 10) { H.err(); return toast('Минимальная сумма — 10 ₽', true); }
      if (method) return;
      method = m.id; b.style.opacity = .5;
      try {
        const r = await api('/topup', { amount, method: m.id });
        if (r.paid) {
          H.ok(); S.user.balance += amount; bindBalance(); refreshState();
          toast(`Баланс пополнен на ${money(amount)} ₽`); back();
        } else if (r.manual) {
          openSheet(`<div class="ctr">${mascot('money', 'sm')}</div><h3>Заявка #${r.paymentId} на ${money(r.amount)} ₽</h3>
            <div class="q" style="margin:4px 0 14px">${esc(r.text)}</div>
            <p>После оплаты нажмите кнопку — бот попросит скрин или номер перевода. Баланс пополнится после проверки.</p>
            <button class="btn" id="pr">✅ Я оплатил — отправить подтверждение</button>`, (sh) => {
            $('#pr', sh).onclick = () => { openLink(`https://t.me/${S.shop.bot}?start=proof_${r.paymentId}`); closeSheet(); pollBalance(); };
          });
        } else {
          openLink(r.url);
          toast('После оплаты баланс обновится автоматически');
          pollBalance();
        }
      } catch (e) { H.err(); toast(e.message, true); }
      finally { method = null; b.style.opacity = ''; }
    }));
  });
}
function pollBalance() {
  clearInterval(pollBalance.t);
  let n = 0;
  const start = S.user.balance;
  pollBalance.t = setInterval(async () => {
    if (++n > 60) return clearInterval(pollBalance.t);
    await refreshState();
    if (S.user.balance > start) { clearInterval(pollBalance.t); H.ok(); toast(`Баланс пополнен: ${money(S.user.balance)} ₽`); }
  }, 5000);
}

// ---------- перевод баланса: чипы складываются (100 + 100 = 200) ----------
function openTransfer() {
  let amount = 0;
  const steps = [50, 100, 500];
  openPage(`
    <div class="in">
      <div class="ptitle">Передать баланс</div>
      <div class="glow">${lot('💸', 'xl')}</div>
      <div class="amt num zero"><input inputmode="numeric" aria-label="Сумма"><i>₽</i></div>
      <div class="hint">Можно передать <span data-bind="balance">${money(S.user.balance)}</span> ₽</div>
      <div class="ctr"><button class="reset" id="reset" hidden>Сбросить</button></div>
      <div class="chips">${steps.map((a) => `<button class="chip num" data-a="${a}">+${money(a)}<i>₽</i></button>`).join('')}<button class="chip" data-all>Всё</button></div>
      <div class="sec">Получатель</div>
      <label class="field">${ICON.user}<span style="flex:1"><input id="to" placeholder="ID или @username" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="s">ID есть в профиле шопа</span></span></label>
    </div>
    <button class="mainbtn" id="send" disabled>Нечего передавать</button>`, (el) => {
    const bal = () => Math.floor(S.user.balance);
    const btn = $('#send', el), to = $('#to', el);
    const upd = () => {
      const has = bal() > 0;
      $$('.chip', el).forEach((c) => (c.disabled = !has));
      $('#reset', el).hidden = !amount;
      btn.disabled = !has || !amount || !to.value.trim();
      btn.textContent = !has ? 'Нечего передавать' : !amount ? 'Укажите сумму' : !to.value.trim() ? 'Укажите получателя' : `Передать ${money(amount)} ₽`;
    };
    const set = amountField(el, 0, (v) => {
      if (v > bal()) { v = bal(); setTimeout(() => set(v)); H.err(); toast('Больше нет на балансе'); }
      amount = v; upd();
    });
    $$('.chip[data-a]', el).forEach((c) => (c.onclick = () => { H.sel(); set(amount + Number(c.dataset.a)); }));
    $('[data-all]', el).onclick = () => { H.sel(); set(bal()); };
    $('#reset', el).onclick = () => { H.sel(); set(0); };
    to.addEventListener('input', upd);
    btn.onclick = async () => {
      if (!(await confirmTg(`Передать ${money(amount)} ₽ пользователю ${to.value.trim()}?`))) return;
      btn.disabled = true;
      try {
        const r = await api('/transfer', { to: to.value, amount });
        H.ok(); S.user.balance = r.balance; bindBalance(); refreshState();
        toast(`Переведено ${money(amount)} ₽ → ${r.to}`); back();
      } catch (e) { H.err(); toast(e.message, true); upd(); }
    };
    upd();
  });
}

// ---------- вкладка «Покупки» ----------
function renderOrders() {
  const el = $('[data-tab=orders]');
  const n = S.orders.length;
  const head = `<div class="card hero" style="min-height:170px"><div class="bg gen"></div>
      <div class="top"><span class="name">Покупки</span><span class="pill">${n ? `${n} ${plural(n, 'заказ', 'заказа', 'заказов')}` : 'Пока пусто'}</span></div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px">
        <div style="font-size:${n ? 22 : 26}px;font-weight:800;line-height:1.15">${n ? 'Ваши заказы<br>и ключи' : 'Здесь будут<br>ваши покупки'}</div>${mascot(n ? 'hi' : 'sad', 'hm')}</div></div>`;
  if (!n) {
    el.innerHTML = `${head}<div class="sec">Советуем начать с</div>${grid(S.products.filter((p) => !p.wide && !p.category_id).slice(0, 4))}<div class="ctr"><button class="btn mid" id="toshop">В магазин</button></div>`;
    $('#toshop', el).onclick = () => setTab('shop');
    return;
  }
  el.innerHTML = `${head}<div class="list" style="margin-top:10px">${S.orders.map((o) => `
    <div class="order">
      <div class="h"><div><div class="t">${esc(o.product_title)}${o.qty > 1 ? ` × ${o.qty}` : ''}</div>
        <div class="s num">#${o.id} · ${new Date(o.created_at * 1000).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${money(o.price)} ₽</div></div>
        <span class="badge ${o.status === 'pending' ? 'pend' : ''}">${o.status === 'pending' ? 'ожидает выдачи' : 'выдано'}</span></div>
      ${o.content ? `<div class="key"><code>${esc(o.content)}</code><button data-copy="${o.id}">Копировать</button></div>` : ''}
    </div>`).join('')}</div>`;
  el.onclick = (e) => { const b = e.target.closest('[data-copy]'); if (b) copy(S.orders.find((o) => o.id === Number(b.dataset.copy)).content); };
}

// ---------- «Пригласи друга»: бонус за покупки друга, шторка из профиля ----------
const refLink = () => `https://t.me/${S.shop.bot}?start=ref_${S.user.id}`;
function shareRef() {
  const text = `💩 ${S.shop.name}: ChatGPT, Claude и Gemini — подписка за минуту`;
  openLink(`https://t.me/share/url?url=${encodeURIComponent(refLink())}&text=${encodeURIComponent(text)}`);
}
function openInvite() {
  const r = S.ref || { friends: 0, bonuses: 0, income: 0, bonus: S.shop.refBonus || 100, min: S.shop.refMin || 1000 };
  openSheet(`
    <div class="ctr">${mascot('money', 'sm')}</div>
    <h3>Пригласи друга</h3>
    <p>За каждую его покупку от ${money(r.min)} ₽ тебе на баланс — <b class="gold">${money(r.bonus)} ₽</b></p>
    <div class="stats" style="margin-top:0">
      <div class="stat"><div class="k">Друзей</div><div class="v num">${r.friends}</div></div>
      <div class="stat"><div class="k">Получено</div><div class="v num">${money(r.income)} ₽</div><div class="h">${r.bonuses} ${plural(r.bonuses, 'бонус', 'бонуса', 'бонусов')}</div></div>
    </div>
    <div class="key"><code>${esc(refLink())}</code><button id="cp">Копировать</button></div>
    <button class="btn" id="sh" style="margin-top:14px">Отправить другу</button>`, (sh) => {
    $('#cp', sh).onclick = () => copy(refLink(), 'Ссылка скопирована');
    $('#sh', sh).onclick = () => shareRef();
  });
  api('/ref').then((x) => { S.ref = x; renderProfile(); }).catch(() => {});
}

// ---------- вкладка «Профиль» ----------
function renderProfile() {
  const el = $('[data-tab=profile]');
  const u = S.user;
  const L = S.shop.links || {};
  const days = Math.max(0, Math.floor((Date.now() / 1000 - u.created_at) / 86400));
  const last = S.orders[0];
  const tile = (emoji, t, s, url) => `<button class="tile" data-url="${esc(url || '')}">${lot(emoji, 'm')}<span class="arr">↗</span><span><span class="t" style="display:block">${t}</span><span class="s" style="display:block">${s}</span></span></button>`;
  el.innerHTML = `
    <div class="card hero" style="min-height:180px"><div class="bg gen"></div>
      <div class="me">${avatar(u)}<div><div class="nm">${esc(u.first_name)}</div><div class="un">${u.username ? '@' + esc(u.username) : ''}</div></div></div>
      <div><div class="lbl">Баланс</div><div class="bal num"><span data-bind="balance">${money(u.balance)}</span><i>₽</i></div></div>
    </div>
    <div class="acts">
      <button class="act" id="top">${lot('💰', 'm')}Пополнить</button>
      <button class="act" id="tr">${lot('💸', 'm')}Передать</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="k">Покупок</div><div class="v num">${u.purchases}</div><div class="h">за всё время</div></div>
      <div class="stat"><div class="k">Потрачено</div><div class="v num">${money(u.spent)} ₽</div><div class="h">${u.spent ? 'спасибо, что с нами' : 'пока без покупок'}</div></div>
      <div class="stat"><div class="k">С нами</div><div class="v num">${days} ${plural(days, 'день', 'дня', 'дней')}</div><div class="h">с ${new Date(u.created_at * 1000).toLocaleDateString('ru-RU')}</div></div>
      <button class="stat" id="cpid" style="text-align:left"><svg class="cp" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/></svg><div class="k">ID</div><div class="v num">${u.id}</div><div class="h">нужен для поддержки</div></button>
    </div>
    <div class="list" style="margin-top:10px">
      <button class="row" id="hist">${lot('🛒', 'm')}<span class="mid"><span class="t" style="display:block">${last ? 'Мои покупки' : 'Покупок пока нет'}</span><span class="s" style="display:block">${last ? `Последняя: ${esc(last.product_title)}` : 'Самое время заглянуть в магазин'}</span></span><span class="go">${ICON.arrow}</span></button>
      <button class="row" id="ref">${lot('🎁', 'm')}<span class="mid"><span class="t" style="display:block">Пригласи друга</span><span class="s" style="display:block">+${money(S.shop.refBonus || 100)} ₽ за каждую его покупку от ${money(S.shop.refMin || 1000)} ₽</span></span><span class="go">${ICON.arrow}</span></button>
    </div>
    <div class="sec">${esc(S.shop.name)} — ${esc(S.shop.tagline)}</div>
    <div class="tiles" style="margin-top:0">
      ${tile('💬', 'Поддержка', 'Помощь и замены', L.support)}
      ${tile('📣', 'Наш канал', 'Новости и поставки', L.channel)}
    </div>
    <div class="list" style="margin-top:10px">
      <button class="row" data-url="${new URL('terms.html', location.href).href}"><span class="ico">${ICON.doc}</span><span class="mid"><span class="t" style="display:block">Пользовательское соглашение</span></span><span class="go">${ICON.arrow}</span></button>
      <button class="row" data-url="${new URL('privacy.html', location.href).href}"><span class="ico">${ICON.shield}</span><span class="mid"><span class="t" style="display:block">Политика конфиденциальности</span></span><span class="go">${ICON.arrow}</span></button>
    </div>`;
  $('#top', el).onclick = () => { H.tap(); openTopup(); };
  $('#tr', el).onclick = () => { H.tap(); openTransfer(); };
  $('#cpid', el).onclick = () => copy(String(u.id), 'ID скопирован');
  $('#hist', el).onclick = () => setTab(last ? 'orders' : 'shop');
  $('#ref', el).onclick = () => { H.tap(); openInvite(); };
  el.onclick = (e) => { const b = e.target.closest('[data-url]'); if (b) { H.tap(); openLink(b.dataset.url); } };
}

// ---------- загрузка данных ----------
const CACHE_KEY = 'shop:init:' + (tg?.initDataUnsafe?.user?.id || 0);
const store = { get: () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } }, set: (v) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch {} } };
let lastJson = '';
function apply(data) {
  const json = JSON.stringify(data);
  if (json === lastJson) return false;
  lastJson = json;
  Object.assign(S, data);
  return true;
}
function renderAll() {
  renderShop(); renderOrders(); renderProfile();
  Lot.mount($('#app'));
  Lot.gc();
  document.title = S.shop.name;
}
let stateBusy = null;
function refreshState() {
  stateBusy ||= api('/state').then((r) => {
    const changedOrders = JSON.stringify(r.orders) !== JSON.stringify(S.orders);
    S.user = r.user; S.orders = r.orders; bindBalance();
    if (changedOrders) { renderOrders(); renderProfile(); Lot.mount($('#app')); Lot.gc(); }
    store.set({ ...S, tab: undefined });
  }).catch(() => {}).finally(() => (stateBusy = null));
  return stateBusy;
}

(async function boot() {
  if (!tg?.initData) {
    $('[data-tab=shop]').innerHTML = '<div class="empty">Откройте магазин через Telegram-бота 🙂</div>';
    return;
  }
  const cached = store.get();
  if (cached?.user) { apply(cached); renderAll(); }
  try {
    const fresh = await api('/init');
    if (apply(fresh)) renderAll();
    store.set(fresh);
  } catch (e) {
    if (!cached) $('[data-tab=shop]').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    else toast(e.message, true);
  }
  const sp = tg.initDataUnsafe?.start_param || '';
  if (sp.startsWith('p_')) openProduct(byId(Number(sp.slice(2))));
  if (sp === 'ref') openInvite();
})();
bindCards($('[data-tab=shop]'));
bindCards($('[data-tab=orders]'));
window.addEventListener('focus', () => S.user && refreshState());
