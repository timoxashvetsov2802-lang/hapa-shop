'use strict';
// Хапа — рыжий кот-барыга в чёрном худи и с золотой цепью. Маскот шопа.
// mascot(mood): 'hi' — наглый прищур и машет лапой, 'money' — глаза-монеты и мешок, 'wow' — удивлён, 'sad' — грустит.
function mascot(mood = 'hi', cls = '') {
  const eye = (x, lid) => `<ellipse cx="${x}" cy="90" rx="12" ry="9.5" fill="#bef264"/><ellipse cx="${x}" cy="90" rx="3" ry="8" fill="#111"/>`
    + (lid ? `<path d="M${x - 14} 90q14-16 28 0v-14h-28z" fill="#fb923c"/><path d="M${x - 13} 88q13-7 26 0" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<circle cx="${x + 3}" cy="86" r="2" fill="#fff"/>`);
  const eyes = {
    hi: eye(74, true) + eye(126, true),
    wow: '<circle cx="74" cy="89" r="13" fill="#bef264"/><circle cx="126" cy="89" r="13" fill="#bef264"/><circle cx="74" cy="89" r="7.5" fill="#111"/><circle cx="126" cy="89" r="7.5" fill="#111"/><circle cx="78" cy="85" r="2.6" fill="#fff"/><circle cx="130" cy="85" r="2.6" fill="#fff"/>',
    sad: eye(74, true) + eye(126, true) + '<path d="M60 74l22 8M140 74l-22 8" stroke="#7c2d12" stroke-width="4" stroke-linecap="round"/><path d="M134 100q4 8 0 12q-4-4 0-12z" fill="#7dd3fc"/>',
    money: '<circle cx="74" cy="90" r="12" fill="#ffc93c" stroke="#b7791f" stroke-width="2.5"/><circle cx="126" cy="90" r="12" fill="#ffc93c" stroke="#b7791f" stroke-width="2.5"/><text x="74" y="95.5" font-size="16" font-weight="900" text-anchor="middle" fill="#8a5a00" font-family="Arial">₽</text><text x="126" y="95.5" font-size="16" font-weight="900" text-anchor="middle" fill="#8a5a00" font-family="Arial">₽</text>',
  }[mood] || '';
  const mouth = {
    hi: '<path d="M100 110q-5 8-12 4M100 110q6 9 14 2" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M107 113l1 6 4-3z" fill="#fff"/>',
    money: '<path d="M86 112q14 18 28 0z" fill="#7f1d1d" stroke="#7c2d12" stroke-width="3" stroke-linejoin="round"/><path d="M91 113h18l-2 4h-14z" fill="#fff"/>',
    wow: '<ellipse cx="100" cy="117" rx="6" ry="8" fill="#7f1d1d" stroke="#7c2d12" stroke-width="3"/>',
    sad: '<path d="M89 121q11-9 22 0" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>',
  }[mood] || '';
  const paw = mood === 'hi'
    ? '<g class="wave"><path d="M156 150q14-22 10-44" stroke="#1c1c1f" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="166" cy="100" r="12" fill="#fb923c"/><circle cx="160" cy="93" r="3.2" fill="#fda4af"/><circle cx="166" cy="91" r="3.2" fill="#fda4af"/><circle cx="172" cy="93" r="3.2" fill="#fda4af"/><ellipse cx="166" cy="102" rx="5" ry="4" fill="#fda4af"/></g>'
    : mood === 'money'
      ? '<g class="bag"><path d="M150 148q-14 0-16 22t20 26h18q22-4 20-26t-16-22z" fill="#c8a165" stroke="#8a6a3a" stroke-width="3"/><path d="M152 148l-6-10h30l-6 10z" fill="#b08b52" stroke="#8a6a3a" stroke-width="3" stroke-linejoin="round"/><text x="163" y="183" font-size="24" font-weight="900" text-anchor="middle" fill="#5b3d10" font-family="Arial">₽</text></g>'
      : '';
  return `<svg class="hapa ${mood} ${cls}" viewBox="0 0 200 200" aria-hidden="true">
  <path d="M38 200c0-46 28-72 62-72s62 26 62 72z" fill="#1c1c1f" stroke="#3f3f46" stroke-width="2"/>
  <path d="M62 140q38 26 76 0" stroke="#2e2e33" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M86 150v26M114 150v26" stroke="#ff7a1a" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="86" cy="178" r="3.5" fill="#ff7a1a"/><circle cx="114" cy="178" r="3.5" fill="#ff7a1a"/>
  <path d="M66 136q34 30 68 0" stroke="#ffc93c" stroke-width="4" fill="none" stroke-dasharray="5 3"/>
  <circle cx="100" cy="160" r="9" fill="#ffc93c" stroke="#b7791f" stroke-width="2"/><text x="100" y="164.5" font-size="12" font-weight="900" text-anchor="middle" fill="#8a5a00" font-family="Arial">Х</text>
  <path d="M46 74L54 20L92 50z" fill="#fb923c"/><path d="M154 74L146 20L108 50z" fill="#fb923c"/>
  <path d="M55 62L59 34L80 52z" fill="#fda4af"/><path d="M145 62L141 34L120 52z" fill="#fda4af"/>
  <ellipse cx="100" cy="92" rx="61" ry="50" fill="#fb923c"/>
  <path d="M100 43v15M87 45l3 12M113 45l-3 12" stroke="#ea580c" stroke-width="5" stroke-linecap="round"/>
  <path d="M40 88h14M42 99h12M160 88h-14M158 99h-12" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round"/>
  <ellipse cx="100" cy="112" rx="27" ry="18" fill="#ffedd5"/>
  ${eyes}
  <path d="M93 102h14l-7 7z" fill="#f472b6" stroke="#be185d" stroke-width="1.5" stroke-linejoin="round"/>
  ${mouth}
  <path d="M74 110l-28-5M74 116l-28 2M126 110l28-5M126 116l28 2" stroke="#fff7ed" stroke-width="2" stroke-linecap="round" opacity=".85"/>
  ${paw}
</svg>`;
}
