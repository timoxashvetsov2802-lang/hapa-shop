'use strict';
// Говнюша — маскот Govno Shop: довольная какашка с золотой цепью и пахучими волнами.
// mascot(mood): 'hi' — подмигивает, 'money' — глаза-монеты и мешок, 'wow' — удивлён, 'sad' — грустит.
function mascot(mood = 'hi', cls = '') {
  const eyes = {
    hi: '<circle cx="80" cy="140" r="12" fill="#fff"/><circle cx="82" cy="141" r="6.5" fill="#1a0f0a"/><circle cx="85" cy="138" r="2.2" fill="#fff"/>'
      + '<path d="M108 141q12-10 24 0" stroke="#1a0f0a" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    wow: '<circle cx="80" cy="139" r="14" fill="#fff"/><circle cx="120" cy="139" r="14" fill="#fff"/><circle cx="80" cy="139" r="7.5" fill="#1a0f0a"/><circle cx="120" cy="139" r="7.5" fill="#1a0f0a"/><circle cx="84" cy="135" r="2.6" fill="#fff"/><circle cx="124" cy="135" r="2.6" fill="#fff"/>',
    sad: '<circle cx="80" cy="142" r="11" fill="#fff"/><circle cx="120" cy="142" r="11" fill="#fff"/><circle cx="80" cy="145" r="6" fill="#1a0f0a"/><circle cx="120" cy="145" r="6" fill="#1a0f0a"/><path d="M66 126l22 6M134 126l-22 6" stroke="#1a0f0a" stroke-width="4" stroke-linecap="round"/><path d="M128 152q4 8 0 12q-4-4 0-12z" fill="#7dd3fc"/>',
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
  <g class="stink" fill="none" stroke="#a3c45a" stroke-width="4" stroke-linecap="round" opacity=".75">
    <path d="M70 44q-8-8 0-16t0-16"/><path d="M100 30q-8-8 0-16t0-16"/><path d="M130 44q-8-8 0-16t0-16"/>
  </g>
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
