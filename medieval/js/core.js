'use strict';
/* ============================================================
   Chroniques d'Aldenor — core.js
   RNG déterministe, bruit procédural, entrées, audio, utilitaires
   ============================================================ */
const G = window.G = {};

/* ---------- RNG ---------- */
G.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

G.hash2 = function (x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* Bruit de valeur lissé */
G.noise2 = function (x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const sm = t => t * t * (3 - 2 * t);
  const a = G.hash2(xi, yi, s), b = G.hash2(xi + 1, yi, s);
  const c = G.hash2(xi, yi + 1, s), d = G.hash2(xi + 1, yi + 1, s);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/* Bruit fractal (fbm) */
G.fbm = function (x, y, s, oct = 4) {
  let val = 0, amp = 0.5, freq = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    val += amp * G.noise2(x * freq, y * freq, s + i * 1013);
    tot += amp; amp *= 0.5; freq *= 2;
  }
  return val / tot;
};

/* ---------- Utilitaires ---------- */
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
G.choice = (rng, arr) => arr[Math.floor(rng() * arr.length)];
G.rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

/* ---------- Entrées ---------- */
G.keys = {};
G.mouse = { x: 0, y: 0, down: false };
G.onKey = null; // hook (défini dans main.js)

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyE']);

addEventListener('keydown', e => {
  if (PREVENT.has(e.code)) e.preventDefault();
  const first = !G.keys[e.code];
  G.keys[e.code] = true;
  if (first && G.onKey) G.onKey(e.code, e);
});
addEventListener('keyup', e => { G.keys[e.code] = false; });
addEventListener('blur', () => { G.keys = {}; G.mouse.down = false; });

/* Axes de déplacement : ZQSD + WASD + flèches */
G.moveAxis = function () {
  const k = G.keys;
  let dx = 0, dy = 0;
  if (k.KeyA || k.KeyQ || k.ArrowLeft) dx -= 1;
  if (k.KeyD || k.ArrowRight) dx += 1;
  if (k.KeyW || k.KeyZ || k.ArrowUp) dy -= 1;
  if (k.KeyS || k.ArrowDown) dy += 1;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  return [dx, dy];
};

/* ============================================================
   AUDIO — synthèse chiptune (WebAudio), aucun asset externe
   ============================================================ */
G.audio = { ctx: null, on: true, musicOn: true, mgain: null, mtimer: null };

G.initAudio = function () {
  if (G.audio.ctx) { if (G.audio.ctx.state === 'suspended') G.audio.ctx.resume(); return; }
  try {
    G.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    G.audio.mgain = G.audio.ctx.createGain();
    G.audio.mgain.gain.value = 0.14;
    G.audio.mgain.connect(G.audio.ctx.destination);
  } catch (e) { G.audio.on = false; }
};

function tone(freq, dur, type, vol, slide = 0, delay = 0) {
  const A = G.audio; if (!A.ctx || !A.on) return;
  const t0 = A.ctx.currentTime + delay;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(A.ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, delay = 0) {
  const A = G.audio; if (!A.ctx || !A.on) return;
  const t0 = A.ctx.currentTime + delay;
  const len = Math.floor(A.ctx.sampleRate * dur);
  const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = A.ctx.createBufferSource(); src.buffer = buf;
  const g = A.ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(A.ctx.destination); src.start(t0);
}

G.sfx = function (name) {
  if (!G.audio.ctx || !G.audio.on) return;
  switch (name) {
    case 'coup':    tone(220, 0.08, 'square', 0.12, -80); noiseBurst(0.05, 0.08); break;
    case 'touche':  tone(160, 0.12, 'sawtooth', 0.14, -60); break;
    case 'mal':     tone(140, 0.2, 'sawtooth', 0.18, -70); noiseBurst(0.1, 0.1); break;
    case 'mort':    tone(200, 0.4, 'sawtooth', 0.16, -160); noiseBurst(0.25, 0.12); break;
    case 'or':      tone(880, 0.06, 'square', 0.1); tone(1320, 0.09, 'square', 0.1, 0, 0.06); break;
    case 'objet':   tone(520, 0.08, 'triangle', 0.14); tone(780, 0.1, 'triangle', 0.12, 0, 0.07); break;
    case 'boire':   tone(300, 0.1, 'sine', 0.14, 120); tone(500, 0.12, 'sine', 0.12, 150, 0.09); break;
    case 'niveau':  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.12, 0, i * 0.1)); break;
    case 'quete':   [392, 523, 659].forEach((f, i) => tone(f, 0.14, 'triangle', 0.13, 0, i * 0.09)); break;
    case 'sort':    tone(600, 0.18, 'sawtooth', 0.1, 500); noiseBurst(0.08, 0.05); break;
    case 'fleche':  tone(900, 0.1, 'square', 0.06, -500); noiseBurst(0.04, 0.05); break;
    case 'ouvrir':  tone(240, 0.1, 'square', 0.1); tone(360, 0.12, 'square', 0.1, 0, 0.09); break;
    case 'porte':   tone(120, 0.18, 'square', 0.1, 40); break;
    case 'ruee':    noiseBurst(0.12, 0.09); tone(400, 0.1, 'sine', 0.06, 300); break;
    case 'boss':    tone(80, 0.6, 'sawtooth', 0.2, -30); tone(83, 0.6, 'sawtooth', 0.15, -30, 0.05); break;
    case 'victoire':[523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, 0, i * 0.14)); break;
    case 'clic':    tone(700, 0.04, 'square', 0.06); break;
    case 'erreur':  tone(180, 0.12, 'square', 0.1, -40); break;
    case 'forge':   tone(1100, 0.1, 'square', 0.1, -200); noiseBurst(0.12, 0.12); break;
  }
};

/* ---------- Musique : boucle médiévale procédurale ---------- */
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
// Mélodie en la mineur dorien, ambiance ménestrel
const MELODY = [
  [69,1],[72,1],[74,2],[76,1],[74,1],[72,2],[69,1],[67,1],[69,4],
  [69,1],[72,1],[74,2],[77,1],[76,1],[74,2],[72,1],[74,1],[76,4],
  [76,1],[77,1],[79,2],[77,1],[76,1],[74,2],[72,1],[69,1],[71,4],
  [69,1],[67,1],[64,2],[67,1],[69,1],[72,2],[71,1],[67,1],[69,4],
];
const BASSLINE = [57, 57, 62, 62, 64, 64, 60, 57]; // par mesure de 4 temps

G.startMusic = function () {
  const A = G.audio;
  if (!A.ctx || !A.musicOn || A.mtimer) return;
  const BPM = 92, beat = 60 / BPM;
  let idx = 0, bar = 0, nextT = A.ctx.currentTime + 0.1;

  function playNote(midi, dur, when, type, vol) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.value = NOTE(midi);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur * 0.95);
    o.connect(g); g.connect(A.mgain);
    o.start(when); o.stop(when + dur);
  }

  A.mtimer = setInterval(() => {
    if (!A.musicOn) return;
    while (nextT < A.ctx.currentTime + 0.6) {
      const [midi, len] = MELODY[idx];
      const dur = len * beat * 0.5;
      playNote(midi, dur, nextT, 'triangle', 0.5);              // mélodie
      playNote(midi - 12, dur, nextT, 'sine', 0.18);            // doublure octave
      // basse bourdon par demi-mesure
      if (idx % 2 === 0) {
        const b = BASSLINE[bar % BASSLINE.length];
        playNote(b - 12, beat, nextT, 'sine', 0.4);
        bar++;
      }
      nextT += dur;
      idx = (idx + 1) % MELODY.length;
    }
  }, 200);
};

G.stopMusic = function () {
  if (G.audio.mtimer) { clearInterval(G.audio.mtimer); G.audio.mtimer = null; }
};
