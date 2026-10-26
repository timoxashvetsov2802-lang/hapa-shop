'use strict';
// Фирменная фишка Govno Shop: пук на каждый тап + облачко 💨 из точки касания.
// Звук синтезируется в Web Audio (без аудиофайлов), каждый раз немного разный. Выключатель запоминается на устройстве.
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

  // big = длинный «праздничный» пук (после покупки)
  function play(big = false) {
    if (muted) return;
    const now = performance.now();
    if (!big && now - last < 90) return; // не строчим пулемётом при быстрых тапах
    last = now;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const d = big ? 0.9 + Math.random() * 0.4 : 0.16 + Math.random() * 0.3;
    const f0 = (big ? 55 : 70) + Math.random() * 60;

    // «голос»: пила с дрожащей частотой
    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.45 + Math.random() * 0.2), t + d);
    const lfo = a.createOscillator();
    lfo.frequency.value = 14 + Math.random() * 26;
    const lfoAmp = a.createGain();
    lfoAmp.gain.value = f0 * (0.25 + Math.random() * 0.25);
    lfo.connect(lfoAmp).connect(osc.frequency);

    // «воздух»: шум
    const len = Math.ceil(a.sampleRate * d);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const noise = a.createBufferSource();
    noise.buffer = buf;
    const noiseAmp = a.createGain();
    noiseAmp.gain.value = 0.18 + Math.random() * 0.15;

    const filt = a.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 5 + Math.random() * 6;
    filt.frequency.setValueAtTime(700 + Math.random() * 500, t);
    filt.frequency.exponentialRampToValueAtTime(220, t + d);

    const env = a.createGain();
    const vol = big ? 0.55 : 0.35;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    env.gain.setValueAtTime(vol * 0.85, t + d * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + d);

    osc.connect(filt);
    noise.connect(noiseAmp).connect(filt);
    filt.connect(env).connect(a.destination);
    for (const n of [osc, lfo, noise]) { n.start(t); n.stop(t + d + 0.02); }
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
