'use strict';
// Фирменная фишка Govno Shop: пук на каждый тап + облачко 💨 из точки касания.
// Звук синтезируется в Web Audio (без аудиофайлов): чистый тон с трелью, каждый раз чуть разный. Выключатель запоминается на устройстве.
const Fart = (() => {
  const KEY = 'gs:mute';
  let ctx = null, last = 0;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Чистый мультяшный пук: тон (треугольник) съезжает вниз + ровная «трель» по громкости, почти без шума.
  // big = длинный «праздничный» вариант (после покупки)
  function play(big = false) {
    if (muted) return;
    const now = performance.now();
    if (!big && now - last < 90) return; // не строчим пулемётом при быстрых тапах
    last = now;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const d = big ? 0.7 + Math.random() * 0.25 : 0.14 + Math.random() * 0.12;
    const f0 = (big ? 150 : 170) + Math.random() * 70;

    const osc = a.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + d);

    // трель: громкость мягко «дрожит» 26–36 раз в секунду
    const trem = a.createGain();
    trem.gain.value = 0.6;
    const lfo = a.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 26 + Math.random() * 10;
    const depth = a.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(trem.gain);

    const tone = a.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1400;
    tone.Q.value = 0.7;

    const env = a.createGain();
    const vol = big ? 0.32 : 0.24;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    env.gain.setValueAtTime(vol, t + d * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);

    osc.connect(trem).connect(tone).connect(env).connect(a.destination);
    for (const n of [osc, lfo]) { n.start(t); n.stop(t + d + 0.02); }
  }

  // облачко из точки касания
  function puff(x, y, big = false) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const n = big ? 6 : 1;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'puff';
      el.textContent = '💨';
      el.style.left = x + (big ? (Math.random() - 0.5) * 120 : 0) + 'px';
      el.style.top = y + (big ? (Math.random() - 0.5) * 60 : 0) + 'px';
      el.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
      el.style.animationDelay = (i * 70) + 'ms';
      document.body.append(el);
      setTimeout(() => el.remove(), 1100 + i * 70);
    }
  }

  // любой тап по кнопке/карточке/ссылке
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('button, a, label, [data-p], .cat');
    if (!t || t.closest('[data-nofart]')) return;
    play();
    puff(e.clientX, e.clientY);
  }, { capture: true, passive: true });

  return {
    play, puff,
    celebrate() { play(true); puff(innerWidth / 2, innerHeight * 0.45, true); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
      if (!muted) play();
      return muted;
    },
  };
})();
