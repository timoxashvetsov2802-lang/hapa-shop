'use strict';
// Говнюша — маскот Govno Shop: довольная какашка с золотой цепью.
// mascot(mood): 'hi' — подмигивает, 'money' — глаза-монеты и мешок, 'wow' — удивлён, 'sad' — грустит.
function mascot(mood = 'hi', cls = '') {
  // глаз: белок + зрачок с бликом; зрачок (.pupil) двигает трекинг взгляда внизу файла
  const eye = (x, y, r, pr, dy = 0) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`
    + `<g class="pupil" data-x="${x}" data-y="${y}" data-max="${r - pr - 1}"><circle cx="${x}" cy="${y + dy}" r="${pr}" fill="#1a0f0a"/>`
    + `<circle cx="${x + pr * 0.45}" cy="${y + dy - pr * 0.45}" r="${pr * 0.34}" fill="#fff"/></g>`;
  const eyes = {
    // правый глаз время от времени подмигивает (анимация .wink в style.css)
    hi: eye(80, 140, 12, 6.5)
      + `<g class="wink">${eye(120, 140, 12, 6.5)}</g>`
      + '<path class="wink-lid" d="M108 141q12-10 24 0" stroke="#1a0f0a" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    wow: eye(80, 139, 14, 7.5) + eye(120, 139, 14, 7.5),
    sad: eye(80, 142, 11, 6, 3) + eye(120, 142, 11, 6, 3) + '<path d="M66 126l22 6M134 126l-22 6" stroke="#1a0f0a" stroke-width="4" stroke-linecap="round"/><path d="M128 152q4 8 0 12q-4-4 0-12z" fill="#7dd3fc"/>',
    money: '<circle cx="80" cy="140" r="13" fill="#ffd36b" stroke="#a86b12" stroke-width="2.5"/><circle cx="120" cy="140" r="13" fill="#ffd36b" stroke="#a86b12" stroke-width="2.5"/><text x="80" y="146" font-size="17" font-weight="900" text-anchor="middle" fill="#7a4a00" font-family="Arial">₽</text><text x="120" y="146" font-size="17" font-weight="900" text-anchor="middle" fill="#7a4a00" font-family="Arial">₽</text>',
  }[mood] || '';
  const mouth = {
    hi: '<path d="M84 160q16 16 32 0z" fill="#3b0d0d" stroke="#1a0f0a" stroke-width="3" stroke-linejoin="round"/><path d="M95 166q5 6 10 0z" fill="#f472b6"/>',
    money: '<path d="M82 159q18 20 36 0z" fill="#3b0d0d" stroke="#1a0f0a" stroke-width="3" stroke-linejoin="round"/><path d="M88 160h24l-2 5h-20z" fill="#fff"/>',
    wow: '<ellipse cx="100" cy="166" rx="7" ry="9" fill="#3b0d0d" stroke="#1a0f0a" stroke-width="3"/>',
    sad: '<path d="M88 170q12-9 24 0" stroke="#1a0f0a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  }[mood] || '';
  const prop = mood === 'money'
    ? '<g class="bag"><path d="M156 150q-12 0-14 20t18 24h14q20-4 18-24t-14-20z" fill="#e7c48a" stroke="#8a6a3a" stroke-width="3"/><path d="M158 150l-5-9h26l-5 9z" fill="#d4ad6c" stroke="#8a6a3a" stroke-width="3" stroke-linejoin="round"/><text x="167" y="182" font-size="22" font-weight="900" text-anchor="middle" fill="#5b3d10" font-family="Arial">₽</text></g>'
    : '';
  return `<svg class="hapa ${mood} ${cls}" viewBox="0 0 200 200" aria-hidden="true">
  <path d="M26 172q0-34 38-38h72q38 4 38 38q0 24-74 24t-74-24z" fill="#6e3f22"/>
  <path d="M44 136q0-28 34-31h44q34 3 34 31q0 14-56 14t-56-14z" fill="#80492a"/>
  <path d="M64 106q0-22 26-25q2-20 24-26q-6 14 2 22q22 4 20 29q0 10-36 10t-36-10z" fill="#925634"/>
  <path d="M40 170q10-18 34-22M58 134q8-12 26-16M76 102q6-10 18-12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".16"/>
  <ellipse cx="62" cy="158" rx="9" ry="5.5" fill="#f472b6" opacity=".45"/><ellipse cx="138" cy="158" rx="9" ry="5.5" fill="#f472b6" opacity=".45"/>
  ${eyes}
  ${mouth}
  <path d="M50 180q50 24 100 0" stroke="#ffd36b" stroke-width="4" fill="none" stroke-dasharray="5 3"/>
  <circle cx="100" cy="190" r="8" fill="#ffd36b" stroke="#a86b12" stroke-width="2"/><text x="100" y="194" font-size="10" font-weight="900" text-anchor="middle" fill="#7a4a00" font-family="Arial">G</text>
  ${prop}
</svg>`;
}

// Взгляд Говнюши: на ПК зрачки следят за курсором, на телефоне смотрят туда, куда тапнули или ведут пальцем.
(() => {
  if (typeof addEventListener !== 'function') return;
  let px = 0, py = 0, raf = 0, idle = 0;
  const pupils = () => document.querySelectorAll('.hapa .pupil');
  const look = () => {
    raf = 0;
    for (const g of pupils()) {
      const m = g.ownerSVGElement?.getScreenCTM();
      if (!m) continue;
      const x = +g.dataset.x, y = +g.dataset.y, max = +g.dataset.max;
      const sx = m.a * x + m.c * y + m.e, sy = m.b * x + m.d * y + m.f; // центр глаза на экране
      const dx = px - sx, dy = py - sy, dist = Math.hypot(dx, dy) || 1;
      const k = (Math.min(1, dist / 160) * max) / dist; // курсор рядом с глазом — смещение меньше
      g.style.transform = `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px)`;
    }
  };
  const aim = (e) => {
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(look);
    if (e.pointerType !== 'mouse') { // на телефоне через пару секунд снова смотрит прямо
      clearTimeout(idle);
      idle = setTimeout(() => { for (const g of pupils()) g.style.transform = ''; }, 2500);
    }
  };
  addEventListener('pointermove', aim, { passive: true });
  addEventListener('pointerdown', aim, { passive: true });
})();
