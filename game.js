/* ============================================================
   STARBLAST — game.js
   Jeu de tir spatial vertical, Canvas HTML5, Vanilla JS
   ============================================================ */

'use strict';

// ============================================================
// SECTION 0 — CONFIGURATION GLOBALE
// ============================================================
const CFG = {
  // Canvas logique (mis à l'échelle selon la fenêtre)
  CANVAS_W: 480,
  CANVAS_H: 720,

  // Joueur
  PLAYER_SPEED: 290,          // px/s (vertical)
  PLAYER_SPEED_X: 850,        // px/s latéral — légèrement augmenté pour un jeu plus frénétique
  PLAYER_FIRE_RATE: 0.22,     // secondes entre tirs
  BULLET_SPEED: 620,          // px/s balles joueur
  ENEMY_BULLET_SPEED: 190,    // px/s balles ennemies

  // Power-ups
  POWERUP_DURATION: 9,        // secondes d'effet
  STAR_COUNT: 130,

  // Vies & invincibilité
  LIVES: 3,
  INVINCIBILITY: 2.2,         // secondes d'invincibilité après un impact

  // Clé Stripe (remplacez par votre clé publiable)
  STRIPE_KEY: 'https://buy.stripe.com/test_14A00j5WG8qE1wMaLOdQQ00',
};

// ============================================================
// SECTION 0b — DONNÉES DE LA BOUTIQUE
// ============================================================
const SKIN_DATA = [
  // ── Commun ──
  { id: 'starter',    name: 'Starter',    price: 0,    rarity: 'common'    },
  { id: 'stealth',    name: 'Stealth',    price: 150,  rarity: 'common'    },
  { id: 'brute',      name: 'Brute',      price: 300,  rarity: 'common'    },
  { id: 'scout',      name: 'Scout',      price: 200,  rarity: 'common'    },
  { id: 'rustbucket', name: 'Rustbucket', price: 250,  rarity: 'common'    },
  { id: 'dart',       name: 'Dart',       price: 300,  rarity: 'common'    },
  { id: 'wedge',      name: 'Wedge',      price: 350,  rarity: 'common'    },
  // ── Rare ──
  { id: 'viper',      name: 'Viper',      price: 500,  rarity: 'rare'      },
  { id: 'falcon',     name: 'Falcon',     price: 600,  rarity: 'rare'      },
  { id: 'hornet',     name: 'Hornet',     price: 700,  rarity: 'rare'      },
  { id: 'nova',       name: 'Nova',       price: 800,  rarity: 'rare'      },
  { id: 'specter',    name: 'Specter',    price: 900,  rarity: 'rare'      },
  // ── Épique ──
  { id: 'phoenix',    name: 'Phoenix',    price: 800,  rarity: 'epic'      },
  { id: 'shadow',     name: 'Shadow',     price: 1200, rarity: 'epic'      },
  { id: 'inferno',    name: 'Inferno',    price: 1500, rarity: 'epic'      },
  { id: 'kraken',     name: 'Kraken',     price: 1800, rarity: 'epic'      },
  { id: 'quantum',    name: 'Quantum',    price: 2000, rarity: 'epic'      },
  { id: 'nebula',     name: 'Nébula',     price: 2200, rarity: 'epic'      },
  // ── Légendaire ──
  { id: 'titan',      name: 'Titan',      price: 2000, rarity: 'legendary' },
  { id: 'celestial',  name: 'Céleste',    price: 5000, rarity: 'legendary' },
  { id: 'void',       name: 'Void',       price: 5000, rarity: 'legendary' },
  { id: 'aurora',     name: 'Aurora',     price: 5000, rarity: 'legendary' },
];

const COLOR_DATA = [
  // ── Commun ──
  { id: 'white',   name: 'Laser Blanc',   price: 0,    color: '#ffffff', rarity: 'common'    },
  { id: 'blue',    name: 'Laser Bleu',    price: 100,  color: '#00BFFF', rarity: 'common'    },
  { id: 'green',   name: 'Laser Vert',    price: 100,  color: '#39FF14', rarity: 'common'    },
  { id: 'red',     name: 'Laser Rouge',   price: 200,  color: '#FF3131', rarity: 'common'    },
  // ── Rare ──
  { id: 'purple',  name: 'Laser Violet',  price: 300,  color: '#BF00FF', rarity: 'rare'      },
  { id: 'rainbow', name: 'Arc-en-ciel',   price: 500,  color: 'rainbow', rarity: 'rare'      },
  { id: 'golden',  name: 'Laser Doré',    price: 400,  color: '#FFD700', rarity: 'rare'      },
  { id: 'plasma',  name: 'Laser Plasma',  price: 600,  color: '#00FF88', rarity: 'rare'      },
  // ── Épique ──
  { id: 'phantom', name: 'Laser Fantôme', price: 1000, color: '#C0C8FF', rarity: 'epic'      },
  // ── Légendaire ──
  { id: 'solar',   name: 'Laser Solaire', price: 1500, color: '#FFFDE7', rarity: 'legendary' },
];

// ============================================================
// SECTION 0c — CONSTANTES DE PROGRESSION XP
// ============================================================
let XP_MULTIPLIER = 1; // Mode Histoire passera cette valeur à 2

const LEVEL_UNLOCKS = [
  { level: 10,  type: 'skin',  id: 'stealth' },
  { level: 25,  type: 'color', id: 'purple'  },
  { level: 50,  type: 'skin',  id: 'phoenix' },
  { level: 75,  type: 'skin',  id: 'shadow'  },
  { level: 100, type: 'skin',  id: 'titan'   },
];

// ── 10 niveaux du mode Histoire (architecture extensible) ──
const STORY_LEVELS = [
  { id: 1,  name: 'Premiers Contacts', waves: [
    { count: 5,  types: { basic: 1 },                       speed: 0.65, formation: 'random' },
    { count: 5,  types: { basic: 1 },                       speed: 0.65, formation: 'random' },
    { count: 5,  types: { basic: 1 },                       speed: 0.70, formation: 'random' },
  ]},
  { id: 2,  name: 'Escadron', waves: [
    { count: 5,  types: { basic: 1 },                       speed: 1.2, formation: 'v' },
    { count: 6,  types: { basic: 1 },                       speed: 1.2, formation: 'v' },
    { count: 6,  types: { basic: 1, medium: 0.4 },          speed: 1.2, formation: 'v' },
    { count: 7,  types: { basic: 1, medium: 0.4 },          speed: 1.3, formation: 'v' },
  ]},
  { id: 3,  name: 'Embuscade', waves: [
    { count: 5,  types: { basic: 1 },                       speed: 1.1, formation: 'sides' },
    { count: 6,  types: { basic: 1 },                       speed: 1.1, formation: 'sides' },
    { count: 6,  types: { basic: 1, medium: 0.5 },          speed: 1.2, formation: 'sides' },
    { count: 7,  types: { basic: 1, medium: 0.5 },          speed: 1.2, formation: 'random' },
    { count: 7,  types: { basic: 1, medium: 0.5 },          speed: 1.3, formation: 'sides' },
  ]},
  { id: 4,  name: 'Défense Rapprochée', waves: [
    { count: 5,  types: { medium: 1 },                      speed: 1.0, formation: 'random' },
    { count: 6,  types: { medium: 1 },                      speed: 1.0, formation: 'random' },
    { count: 6,  types: { medium: 1, basic: 0.5 },          speed: 1.1, formation: 'random' },
    { count: 7,  types: { medium: 1, heavy: 0.3 },          speed: 1.0, formation: 'random' },
    { count: 8,  types: { medium: 1, heavy: 0.3 },          speed: 1.1, formation: 'random' },
    { count: 8,  types: { medium: 1, heavy: 0.5 },          speed: 1.1, formation: 'random' },
  ]},
  { id: 5,  name: 'Tempête', waves: [
    { count: 8,  types: { basic: 1, medium: 0.5, heavy: 0.2 }, speed: 1.2, formation: 'random' },
    { count: 8,  types: { basic: 1, medium: 0.5, heavy: 0.2 }, speed: 1.2, formation: 'random' },
    { count: 9,  types: { basic: 1, medium: 0.8, heavy: 0.3 }, speed: 1.3, formation: 'random' },
    { count: 9,  types: { basic: 1, medium: 0.8, heavy: 0.3 }, speed: 1.3, formation: 'v' },
    { count: 10, types: { basic: 1, medium: 1,   heavy: 0.5 }, speed: 1.3, formation: 'random' },
    { count: 10, types: { basic: 1, medium: 1,   heavy: 0.5 }, speed: 1.4, formation: 'random' },
    { count: 10, types: { basic: 1, medium: 1,   heavy: 0.8 }, speed: 1.4, formation: 'random' },
  ]},
  { id: 6,  name: 'Infiltration', waves: [
    { count: 6,  types: { basic: 1 },                       speed: 1.1, formation: 'random', stealth: true },
    { count: 6,  types: { basic: 1 },                       speed: 1.2, formation: 'random', stealth: true },
    { count: 7,  types: { basic: 1, medium: 0.5 },          speed: 1.2, formation: 'random', stealth: true },
    { count: 7,  types: { basic: 1, medium: 0.5 },          speed: 1.3, formation: 'random', stealth: true },
    { count: 8,  types: { basic: 1, medium: 0.8 },          speed: 1.3, formation: 'random', stealth: true },
    { count: 8,  types: { medium: 1, heavy: 0.5 },          speed: 1.2, formation: 'random', stealth: true },
  ]},
  { id: 7,  name: 'Assaut Massif', waves: [
    { count: 10, types: { basic: 1, medium: 0.5 },          speed: 1.2, formation: 'random' },
    { count: 10, types: { basic: 1, medium: 0.5 },          speed: 1.2, formation: 'random' },
    { count: 12, types: { basic: 1, medium: 0.8 },          speed: 1.3, formation: 'random' },
    { count: 12, types: { basic: 1, medium: 0.8 },          speed: 1.3, formation: 'random' },
    { count: 12, types: { basic: 1, medium: 1, heavy: 0.3}, speed: 1.3, formation: 'random' },
    { count: 12, types: { basic: 1, medium: 1, heavy: 0.3}, speed: 1.4, formation: 'random' },
    { count: 14, types: { basic: 1, medium: 1, heavy: 0.5}, speed: 1.4, formation: 'random' },
    { count: 14, types: { basic: 1, medium: 1, heavy: 0.5}, speed: 1.5, formation: 'random' },
  ]},
  { id: 8,  name: 'Gardiens', waves: [
    { count: 6,  types: { medium: 1, heavy: 0.5 },          speed: 1.2, formation: 'random' },
    { count: 7,  types: { medium: 1, heavy: 0.5 },          speed: 1.3, formation: 'random' },
    { count: 8,  types: { medium: 1, heavy: 0.8 },          speed: 1.3, formation: 'random' },
    { count: 8,  types: { medium: 1, heavy: 0.8 },          speed: 1.4, formation: 'random' },
    { count: 10, types: { medium: 1, heavy: 1 },            speed: 1.4, formation: 'random',
      boss: { type: 'sentinelle', hp: 200 } },
  ]},
  { id: 9,  name: 'Avant-Garde', waves: [
    { count: 10, types: { basic: 1, medium: 0.8 },          speed: 1.8, formation: 'random' },
    { count: 10, types: { basic: 1, medium: 0.8 },          speed: 1.8, formation: 'v' },
    { count: 12, types: { medium: 1, heavy: 0.5 },          speed: 1.7, formation: 'random' },
    { count: 12, types: { medium: 1, heavy: 0.5 },          speed: 1.7, formation: 'random',
      boss: { type: 'sentinelle', hp: 250 } },
    { count: 12, types: { medium: 1, heavy: 0.8 },          speed: 1.8, formation: 'random' },
    { count: 12, types: { medium: 1, heavy: 0.8 },          speed: 1.8, formation: 'random' },
    { count: 14, types: { medium: 1, heavy: 1 },            speed: 1.8, formation: 'random' },
    { count: 14, types: { medium: 1, heavy: 1 },            speed: 1.9, formation: 'random',
      boss: { type: 'chasseur', hp: 350 } },
  ]},
  { id: 10, name: 'Le Titan', waves: [
    { count: 8,  types: { heavy: 1 },                       speed: 1.5, formation: 'random' },
    { count: 10, types: { medium: 1, heavy: 1 },            speed: 1.5, formation: 'random' },
    { count: 12, types: { medium: 1, heavy: 1 },            speed: 1.5, formation: 'random',
      boss: { type: 'titan', hp: 1000, isFinal: true } },
  ]},
];

function getLevelColor(level) {
  if (level >= 100) return '#FFD700';
  if (level >= 75)  return '#FF8C00';
  if (level >= 50)  return '#BF00FF';
  if (level >= 25)  return '#00BFFF';
  return '#ffffff';
}

// ============================================================
// SECTION 1 — GESTIONNAIRE AUDIO (Web Audio API)
// ============================================================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.38;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      /* Audio non disponible sur ce navigateur */
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Oscillateur simple
  _osc(freq, type, duration, vol = 0.28, delay = 0) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.master);
    const t = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  // Bruit blanc filtré (explosions)
  _noise(duration, cutoff = 700, vol = 0.5, delay = 0) {
    if (!this.ctx) return;
    const sr  = this.ctx.sampleRate;
    const len = Math.ceil(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src    = this.ctx.createBufferSource();
    src.buffer   = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.value = cutoff;
    const gain   = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    const t = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  shoot()      { this._osc(900, 'square', 0.07, 0.18); this._osc(450, 'square', 0.05, 0.1, 0.04); }
  shootDouble(){ this.shoot(); this._osc(1150, 'square', 0.07, 0.13, 0.02); }
  enemyShoot() { this._osc(210, 'sawtooth', 0.1, 0.08); }
  explosion(big = false) { this._noise(big ? 0.65 : 0.22, big ? 280 : 650, big ? 0.55 : 0.28); }
  shieldHit()  { this._osc(140, 'sawtooth', 0.32, 0.28); }
  powerup()    { [524, 660, 784, 1047].forEach((f, i) => this._osc(f, 'sine', 0.14, 0.18, i * 0.08)); }
  levelUp()    { [524, 660, 784, 1047, 1320].forEach((f, i) => this._osc(f, 'sine', 0.18, 0.22, i * 0.1)); }
  bomb()       { this._noise(0.9, 180, 0.75); this._noise(0.5, 400, 0.38, 0.2); }

  bossAlert() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [55, 42, 68].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now + i * 0.1);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, now + 1.8);
      o.connect(g); g.connect(this.master);
      g.gain.setValueAtTime(0.22, now + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      o.start(now + i * 0.1);
      o.stop(now + 2.1);
    });
    this._noise(0.35, 120, 0.55);
    this._osc(220, 'square', 0.3, 0.25, 0.05);
  }

  titanDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noise(2.0, 80, 0.9);
    this._noise(1.2, 160, 0.6, 0.3);
    [80, 60, 45].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(g); g.connect(this.master);
      g.gain.setValueAtTime(0.35, now + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
      o.start(now + i * 0.2); o.stop(now + 3.1);
    });
  }
}

// ============================================================
// SECTION 2 — UTILITAIRES MATHÉMATIQUES
// ============================================================
const lerp     = (a, b, t) => a + (b - a) * t;
const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand     = (a, b) => a + Math.random() * (b - a);
const randInt  = (a, b) => Math.floor(rand(a, b + 1));
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

// Collision AABB (axially aligned bounding boxes)
const aabb = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

// ============================================================
// SECTION 3 — FOND ÉTOILÉ EN PARALLAXE
// ============================================================
class StarField {
  constructor(w, h) {
    // 3 couches : lente (fond), moyenne, rapide (avant-plan)
    this.layers = [
      { stars: [], speed: 28,  r: 0.8, alpha: 0.35 },
      { stars: [], speed: 65,  r: 1.3, alpha: 0.6  },
      { stars: [], speed: 110, r: 1.8, alpha: 0.9  },
    ];
    this.w = w; this.h = h;
    const n = Math.ceil(CFG.STAR_COUNT / 3);
    this.layers.forEach(l => {
      for (let i = 0; i < n; i++)
        l.stars.push({ x: rand(0, w), y: rand(0, h), tw: rand(0, Math.PI * 2) });
    });
  }

  update(dt) {
    this.layers.forEach(l => {
      l.stars.forEach(s => {
        s.y  += l.speed * dt;
        s.tw += dt * 0.8;
        if (s.y > this.h + 2) { s.y = -2; s.x = rand(0, this.w); }
      });
    });
  }

  draw(ctx) {
    this.layers.forEach(l => {
      l.stars.forEach(s => {
        // Légère pulsation alpha
        const a = l.alpha * (0.7 + 0.3 * Math.sin(s.tw));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, l.r, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }
}

// ============================================================
// SECTION 4 — PARTICULES (explosions, traînées)
// ============================================================
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color   = color;
    this.life    = life;
    this.maxLife = life;
    this.size    = size;
    this.dead    = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += 50 * dt;   // micro-gravité vers le bas
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const pct = this.life / this.maxLife;
    ctx.globalAlpha = pct;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.1, this.size * pct), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Crée une explosion de particules à (x,y)
function spawnExplosion(pool, x, y, color, count, big = false) {
  const speed    = big ? 200 : 130;
  const life     = big ? 0.85 : 0.5;
  const size     = big ? 4.5 : 3;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.4, 0.4);
    const spd   = rand(speed * 0.3, speed);
    pool.push(new Particle(
      x, y,
      Math.cos(angle) * spd, Math.sin(angle) * spd,
      color,
      rand(life * 0.4, life),
      rand(size * 0.4, size)
    ));
  }

  // Éclats blancs pour les grosses explosions
  if (big) {
    for (let i = 0; i < 10; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd   = rand(30, 80);
      pool.push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
        '#ffffff', rand(0.15, 0.45), rand(2, 5)));
    }
  }
}

// ============================================================
// SECTION 4a-bis — SYSTÈME FX : PARTICULES AMÉLIORÉES + ONDES DE CHOC
// ============================================================

class FXParticle {
  constructor() {
    this.dead = true;
    this.x=0; this.y=0; this.vx=0; this.vy=0;
    this.color='#fff'; this.life=0; this.maxLife=1;
    this.size=3; this.friction=3; this.keepSize=false; this.shape='circle';
  }

  reset(x, y, vx, vy, color, life, size, friction=3, keepSize=false, shape='circle') {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.color=color; this.life=life; this.maxLife=life;
    this.size=size; this.friction=friction;
    this.keepSize=keepSize; this.shape=shape;
    this.dead=false;
  }

  update(dt) {
    const f = 1 - this.friction * dt;
    this.vx *= f; this.vy *= f;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const pct = this.life / this.maxLife;
    ctx.globalAlpha = pct;
    const r = this.keepSize ? this.size : Math.max(0.2, this.size * Math.sqrt(pct));
    ctx.fillStyle = this.color;
    if (this.shape === 'rect') {
      ctx.fillRect(this.x - r * 0.7, this.y - r * 0.7, r * 1.4, r * 1.4);
    } else {
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class ShockWave {
  constructor(x, y, maxR, color, duration) {
    this.x=x; this.y=y; this.maxR=maxR;
    this.color = color || 'rgba(255,200,100,0.8)';
    this.life  = duration || 0.4;
    this.maxLife = this.life;
    this.dead  = false;
  }

  update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; }

  draw(ctx) {
    if (this.dead) return;
    const pct = this.life / this.maxLife;
    const r   = this.maxR * (1 - pct);
    ctx.save();
    ctx.globalAlpha  = pct * 0.78;
    ctx.strokeStyle  = this.color;
    ctx.lineWidth    = 3 * pct + 0.5;
    ctx.shadowColor  = this.color;
    ctx.shadowBlur   = 14;
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

const _fxPool = [];
function _acquireFX() { return _fxPool.length > 0 ? _fxPool.pop() : new FXParticle(); }

const _BOOM_COLORS = {
  basic:  ['#ff6600','#ff3300','#ff8800','#ffaa44'],
  medium: ['#ff7700','#ffaa00','#ffdd00','#ffffff','#ff5500'],
  heavy:  ['#ff3300','#ff7700','#ffcc00','#ffffff','#ff9944','#ffeeaa'],
  boss:   ['#ff3300','#ff8800','#ffcc00','#ffffff','#00ffdd','#ff88ff','#ffaaaa'],
  titan:  ['#FFD700','#ff8800','#ffffff','#ff3300','#00bbff','#ffee00','#aaffff'],
};

function spawnBoom(pool, x, y, tier, shakeCb) {
  if (pool.length > 290) return;
  const cols = _BOOM_COLORS[tier] || _BOOM_COLORS.basic;

  const addFX = (vspd, life, size, friction=3, keepSize=false, shape='circle') => {
    const p = _acquireFX();
    const a = Math.random() * Math.PI * 2;
    const s = rand(vspd * 0.28, vspd);
    p.reset(x, y, Math.cos(a)*s, Math.sin(a)*s,
      cols[randInt(0, cols.length - 1)], rand(life * 0.6, life),
      size, friction, keepSize, shape);
    pool.push(p);
  };

  switch (tier) {
    case 'basic':
      for (let i = 0; i < 8; i++) addFX(160, 0.65, rand(2, 4), 4.0);
      break;

    case 'medium':
      for (let i = 0; i < 16; i++) addFX(230, 0.9, rand(3, 6), 3.5);
      pool.push(new ShockWave(x, y, 55, 'rgba(255,170,70,0.7)', 0.36));
      break;

    case 'heavy':
      for (let i = 0; i < 28; i++) {
        const sh = Math.random() < 0.28 ? 'rect' : 'circle';
        addFX(310, 1.1, rand(4, 8), 2.8, false, sh);
      }
      pool.push(new ShockWave(x, y, 80, 'rgba(255,130,40,0.85)', 0.4));
      break;

    case 'boss':
      for (let i = 0; i < 50; i++) {
        const sh = Math.random() < 0.3 ? 'rect' : 'circle';
        addFX(400, 1.4, rand(5, 12), 2.2, false, sh);
      }
      [85, 135, 185].forEach((r, i) =>
        pool.push(new ShockWave(x, y, r, 'rgba(255,195,90,0.88)', 0.46 + i * 0.18))
      );
      if (shakeCb) shakeCb(0.5, 8);
      break;

    case 'titan':
      // Vague 1 (immédiate) — 40 particules + 5 ondes de choc
      for (let i = 0; i < 40; i++) {
        const sh = Math.random() < 0.35 ? 'rect' : 'circle';
        addFX(520, rand(1.5, 3.0), rand(6, 14), 1.8, true, sh);
      }
      [65, 125, 185, 245, 310].forEach((r, i) =>
        pool.push(new ShockWave(x, y, r, 'rgba(255,215,0,0.9)', 0.52 + i * 0.13))
      );
      if (shakeCb) shakeCb(2.0, 16);
      break;
  }
}

// Nettoyage en place : recycle les FXParticle mortes dans le pool
function cleanParticles(arr) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.dead) {
      if (p instanceof FXParticle) _fxPool.push(p);
    } else {
      arr[j++] = p;
    }
  }
  arr.length = j;
  return arr;
}

// ============================================================
// SECTION 4b — RENDERERS DE SKINS (joueur)
// Chaque fonction dessine le corps du vaisseau centré sur (0,0).
// Utilisée à la fois en jeu et dans les aperçus de la boutique.
// ============================================================
const SKIN_RENDERERS = {

  // ── 1. Starter : design cyan original ──
  starter(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.5,h*.22); ctx.lineTo(w*.3,h*.5);
    ctx.lineTo(-w*.3,h*.5); ctx.lineTo(-w*.5,h*.22); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.5,0,h*.5);
    g.addColorStop(0,'#00e5ff'); g.addColorStop(.5,'#006688'); g.addColorStop(1,'#002233');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.5,h*.22); ctx.lineTo(s*w*.78,h*.5); ctx.lineTo(s*w*.3,h*.5); ctx.closePath();
      ctx.fillStyle = '#004455'; ctx.fill();
    });
    ctx.beginPath(); ctx.ellipse(0,-h*.1,w*.15,h*.18,0,0,Math.PI*2);
    ctx.fillStyle = 'rgba(150,255,255,.38)'; ctx.fill();
  },

  // ── 2. Stealth : fin, noir, contours cyan ──
  stealth(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.22,h*.1); ctx.lineTo(w*.42,h*.5);
    ctx.lineTo(-w*.42,h*.5); ctx.lineTo(-w*.22,h*.1); ctx.closePath();
    ctx.fillStyle = '#050510'; ctx.fill();
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(0,-h*.4); ctx.lineTo(0,h*.4);
    ctx.strokeStyle = 'rgba(0,229,255,.32)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w*.2,h*.15); ctx.lineTo(-w*.38,h*.38);
    ctx.moveTo( w*.2,h*.15); ctx.lineTo( w*.38,h*.38);
    ctx.strokeStyle = 'rgba(0,229,255,.22)'; ctx.lineWidth = 1; ctx.stroke();
  },

  // ── 3. Brute : trapu, métal gris, rivets ──
  brute(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.38); ctx.lineTo(w*.58,-h*.08); ctx.lineTo(w*.52,h*.5);
    ctx.lineTo(-w*.52,h*.5); ctx.lineTo(-w*.58,-h*.08); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.38,0,h*.5);
    g.addColorStop(0,'#aaaaaa'); g.addColorStop(1,'#444444');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.rect(-w*.34,-h*.04,w*.68,h*.35);
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; ctx.stroke();
    [[-w*.28,-h*.1],[w*.28,-h*.1],[-w*.28,h*.2],[w*.28,h*.2],[0,h*.08]].forEach(([rx,ry]) => {
      ctx.beginPath(); ctx.arc(rx,ry,2.2,0,Math.PI*2);
      ctx.fillStyle = '#e0e0e0'; ctx.fill();
    });
    ctx.beginPath(); ctx.rect(-w*.08,-h*.3,w*.16,h*.16);
    ctx.fillStyle = 'rgba(100,200,255,.28)'; ctx.fill();
  },

  // ── 4. Viper : en V inversé, vert néon ──
  viper(ctx, w, h) {
    [[-1],[1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(0,-h*.18); ctx.lineTo(s*w*.5,h*.5);
      ctx.lineTo(s*w*.18,h*.15); ctx.lineTo(0,h*.38); ctx.closePath();
      ctx.fillStyle = 'rgba(0,18,0,.9)'; ctx.fill();
      ctx.strokeStyle = '#39FF14'; ctx.lineWidth = 1.8;
      ctx.shadowColor = '#39FF14'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    });
    ctx.beginPath(); ctx.arc(0,-h*.08,w*.1,0,Math.PI*2);
    ctx.fillStyle = '#39FF14'; ctx.shadowColor = '#39FF14';
    ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
  },

  // ── 5. Phoenix : ailes arrondies orange/rouge ──
  phoenix(ctx, w, h) {
    [[-1],[1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(s*w*.18,h*.1);
      ctx.quadraticCurveTo(s*w*.72,-h*.2, s*w*.48,h*.5);
      ctx.lineTo(s*w*.14,h*.5); ctx.closePath();
      ctx.fillStyle = 'rgba(200,60,0,.65)'; ctx.fill();
      ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.2,h*.08); ctx.lineTo(w*.14,h*.5);
    ctx.lineTo(-w*.14,h*.5); ctx.lineTo(-w*.2,h*.08); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.5,0,h*.5);
    g.addColorStop(0,'#ffaa44'); g.addColorStop(1,'#cc2200');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(0,-h*.1,w*.1,h*.14,0,0,Math.PI*2);
    ctx.fillStyle = 'rgba(255,200,100,.5)'; ctx.fill();
  },

  // ── 6. Shadow : asymétrique, violet sombre ──
  shadow(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w*.12,-h*.5);
    ctx.lineTo(w*.52,h*.02); ctx.lineTo(w*.38,h*.5);
    ctx.lineTo(-w*.22,h*.5); ctx.lineTo(-w*.58,h*.18); ctx.lineTo(-w*.12,-h*.18);
    ctx.closePath();
    const g = ctx.createLinearGradient(-w*.5,0,w*.5,0);
    g.addColorStop(0,'#2a0044'); g.addColorStop(1,'#6600aa');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#aa44ff'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(w*.1,-h*.4); ctx.lineTo(-w*.08,h*.35);
    ctx.strokeStyle = 'rgba(200,100,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-w*.34,h*.22,w*.1,h*.08,.4,0,Math.PI*2);
    ctx.fillStyle = 'rgba(150,50,220,.55)'; ctx.fill();
  },

  // ── 7. Titan : imposant, doré, détails complexes ──
  titan(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.38,-h*.1); ctx.lineTo(w*.52,h*.32);
    ctx.lineTo(w*.22,h*.5); ctx.lineTo(-w*.22,h*.5);
    ctx.lineTo(-w*.52,h*.32); ctx.lineTo(-w*.38,-h*.1); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.5,0,h*.5);
    g.addColorStop(0,'#ffe566'); g.addColorStop(.5,'#cc8800'); g.addColorStop(1,'#885500');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.38,-h*.1); ctx.lineTo(s*w*.68,h*.08);
      ctx.lineTo(s*w*.56,h*.42); ctx.lineTo(s*w*.52,h*.32); ctx.closePath();
      ctx.fillStyle = '#996600'; ctx.fill();
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,-h*.08,w*.13,0,Math.PI*2);
    ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.rect(-w*.3,h*.1,w*.6,h*.08);
    ctx.fillStyle = 'rgba(255,215,0,.28)'; ctx.fill();
  },

  // ── 8. Scout : slim avant-poste bleu pâle ──
  scout(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.52); ctx.lineTo(w*.22,h*.1); ctx.lineTo(w*.14,h*.5);
    ctx.lineTo(-w*.14,h*.5); ctx.lineTo(-w*.22,h*.1); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.5,0,h*.5);
    g.addColorStop(0,'#80d4ff'); g.addColorStop(1,'#1a4d66');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#80d4ff'; ctx.lineWidth=1; ctx.shadowColor='#80d4ff'; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.22,h*.1); ctx.lineTo(s*w*.56,h*.38); ctx.lineTo(s*w*.14,h*.5); ctx.closePath();
      ctx.fillStyle='rgba(100,200,255,.2)'; ctx.fill();
      ctx.strokeStyle='rgba(128,212,255,.45)'; ctx.lineWidth=.8; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,-h*.16,w*.09,0,Math.PI*2);
    ctx.fillStyle='rgba(180,240,255,.4)'; ctx.fill();
  },

  // ── 9. Rustbucket : épave carrée rouille ──
  rustbucket(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(-w*.36,-h*.4); ctx.lineTo(w*.34,-h*.42);
    ctx.lineTo(w*.44,-h*.06); ctx.lineTo(w*.42,h*.5);
    ctx.lineTo(-w*.4,h*.5); ctx.lineTo(-w*.44,-h*.08); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.4,0,h*.5);
    g.addColorStop(0,'#8B6046'); g.addColorStop(.5,'#5E3A1C'); g.addColorStop(1,'#3D1C0A');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#9A7050'; ctx.lineWidth=1.5; ctx.stroke();
    [[w*.22,h*.12,'#9A4A18'],[-w*.24,h*.25,'#7A3A10']].forEach(([rx,ry,c]) => {
      ctx.beginPath(); ctx.ellipse(rx,ry,w*.09,h*.06,.3,0,Math.PI*2);
      ctx.fillStyle=c; ctx.fill();
    });
    [[w*.28,-h*.28],[-w*.26,-h*.28],[w*.3,h*.18],[-w*.3,h*.2]].forEach(([rx,ry]) => {
      ctx.beginPath(); ctx.arc(rx,ry,2,0,Math.PI*2); ctx.fillStyle='#CCAA80'; ctx.fill();
    });
    ctx.beginPath(); ctx.rect(-w*.14,-h*.28,w*.28,h*.2);
    ctx.fillStyle='rgba(60,110,80,.35)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w*.04,-h*.28); ctx.lineTo(w*.09,-h*.1);
    ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=1; ctx.stroke();
  },

  // ── 10. Dart : flèche effilée, argent ──
  dart(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.58); ctx.lineTo(w*.18,h*.28); ctx.lineTo(w*.1,h*.5);
    ctx.lineTo(-w*.1,h*.5); ctx.lineTo(-w*.18,h*.28); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.55,0,h*.5);
    g.addColorStop(0,'#e8e8f0'); g.addColorStop(.6,'#8888aa'); g.addColorStop(1,'#333348');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#ccccee'; ctx.lineWidth=1.2; ctx.shadowColor='#aaaacc'; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.18,h*.28); ctx.lineTo(s*w*.46,h*.5); ctx.lineTo(s*w*.1,h*.5); ctx.closePath();
      ctx.fillStyle='rgba(160,160,200,.3)'; ctx.fill();
    });
  },

  // ── 11. Wedge : coin large biseauté gris-vert ──
  wedge(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.38); ctx.lineTo(w*.52,h*.24); ctx.lineTo(w*.44,h*.5);
    ctx.lineTo(-w*.44,h*.5); ctx.lineTo(-w*.52,h*.24); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.38,0,h*.5);
    g.addColorStop(0,'#6aaa80'); g.addColorStop(1,'#223322');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#88cc99'; ctx.lineWidth=1.4; ctx.shadowColor='#66bb77'; ctx.shadowBlur=7; ctx.stroke(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.moveTo(-w*.4,h*.08); ctx.lineTo(w*.4,h*.08);
    ctx.strokeStyle='rgba(150,255,170,.22)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,h*.02,w*.12,h*.1,0,0,Math.PI*2);
    ctx.fillStyle='rgba(100,220,130,.32)'; ctx.fill();
  },

  // ── 12. Falcon : chasseur agile doré-brun ──
  falcon(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.14,h*.04); ctx.lineTo(w*.48,h*.22);
    ctx.lineTo(w*.32,h*.5); ctx.lineTo(-w*.32,h*.5); ctx.lineTo(-w*.48,h*.22);
    ctx.lineTo(-w*.14,h*.04); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.5,0,h*.5);
    g.addColorStop(0,'#e8b040'); g.addColorStop(.5,'#9c6010'); g.addColorStop(1,'#5a3000');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#e8b040'; ctx.lineWidth=1.5; ctx.shadowColor='#ffcc44'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.14,h*.04); ctx.lineTo(s*w*.62,h*.44); ctx.lineTo(s*w*.48,h*.22); ctx.closePath();
      ctx.fillStyle='rgba(200,140,40,.3)'; ctx.fill(); ctx.strokeStyle='rgba(230,180,60,.5)'; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,-h*.12,w*.1,0,Math.PI*2); ctx.fillStyle='rgba(255,200,80,.45)'; ctx.fill();
  },

  // ── 13. Hornet : compact jaune-noir, ailes en V ──
  hornet(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.44); ctx.lineTo(w*.28,h*.08); ctx.lineTo(w*.22,h*.5);
    ctx.lineTo(-w*.22,h*.5); ctx.lineTo(-w*.28,h*.08); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.44,0,h*.5);
    g.addColorStop(0,'#FFE000'); g.addColorStop(.45,'#CC8800'); g.addColorStop(1,'#111100');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#FFE000'; ctx.lineWidth=1.5; ctx.shadowColor='#FFDD00'; ctx.shadowBlur=9; ctx.stroke(); ctx.shadowBlur=0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.1,-h*.04); ctx.lineTo(s*w*.58,-h*.28); ctx.lineTo(s*w*.52,h*.12); ctx.closePath();
      ctx.fillStyle='rgba(255,220,0,.18)'; ctx.fill(); ctx.strokeStyle='rgba(255,220,0,.5)'; ctx.lineWidth=1; ctx.stroke();
    });
    [[-w*.14,-h*.1,h*.24],[w*.14,-h*.1,h*.24]].forEach(([rx,ry,rh]) => {
      ctx.beginPath(); ctx.rect(rx-3,ry,6,rh); ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fill();
    });
  },

  // ── 14. Nova : sphérique, auras cyan ──
  nova(ctx, w, h) {
    const g = ctx.createRadialGradient(0,-h*.1,w*.05,0,0,w*.56);
    g.addColorStop(0,'#e8f8ff'); g.addColorStop(.4,'#22aacc'); g.addColorStop(1,'#003344');
    ctx.beginPath(); ctx.ellipse(0,h*.04,w*.5,h*.44,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#44ddff'; ctx.lineWidth=1.5; ctx.shadowColor='#00e5ff'; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.moveTo(0,-h*.5); ctx.lineTo(0,-h*.08);
    ctx.strokeStyle='rgba(0,229,255,.65)'; ctx.lineWidth=2; ctx.stroke();
    [1,-1].forEach(s => {
      ctx.beginPath(); ctx.moveTo(s*w*.5,h*.04); ctx.lineTo(s*w*.78,h*.12); ctx.lineTo(s*w*.56,h*.32); ctx.closePath();
      ctx.fillStyle='rgba(0,200,240,.22)'; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(0,0,w*.18,0,Math.PI*2);
    ctx.fillStyle='rgba(200,248,255,.38)'; ctx.fill();
  },

  // ── 15. Specter : filaire transparent violet sombre ──
  specter(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.38,-h*.02); ctx.lineTo(w*.28,h*.5);
    ctx.lineTo(-w*.28,h*.5); ctx.lineTo(-w*.38,-h*.02); ctx.closePath();
    ctx.fillStyle='rgba(80,0,120,.35)'; ctx.fill();
    ctx.strokeStyle='#aa44ff'; ctx.lineWidth=1.5; ctx.shadowColor='#8800ff'; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
    [[0,-h*.38,w*.06],[0,h*.1,w*.12]].forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.strokeStyle='rgba(180,80,255,.6)'; ctx.lineWidth=1; ctx.stroke();
    });
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.38,-h*.02); ctx.lineTo(s*w*.62,h*.3); ctx.lineTo(s*w*.28,h*.5); ctx.closePath();
      ctx.fillStyle='rgba(140,0,220,.18)'; ctx.fill(); ctx.strokeStyle='rgba(180,80,255,.4)'; ctx.lineWidth=1; ctx.stroke();
    });
  },

  // ── 16. Inferno : flammes animées orange-rouge ──
  inferno(ctx, w, h) {
    const t = Date.now() * 0.004;
    ctx.beginPath();
    ctx.moveTo(0,-h*.48); ctx.lineTo(w*.32,h*.02); ctx.lineTo(w*.42,h*.5);
    ctx.lineTo(-w*.42,h*.5); ctx.lineTo(-w*.32,h*.02); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.48,0,h*.5);
    g.addColorStop(0,'#ff8800'); g.addColorStop(.5,'#cc2200'); g.addColorStop(1,'#440000');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5; ctx.shadowColor='#ff6600'; ctx.shadowBlur=12; ctx.stroke(); ctx.shadowBlur=0;
    // Flammes animées
    for (let i=0;i<5;i++) {
      const fx = (i-2)*w*.16;
      const fh = h*.18 + h*.1*Math.sin(t*2.5+i*1.1);
      ctx.beginPath();
      ctx.moveTo(fx,h*.52); ctx.quadraticCurveTo(fx+w*.08*Math.sin(t+i),h*.3-fh,fx,h*.5-fh*1.4);
      ctx.quadraticCurveTo(fx-w*.08*Math.sin(t+i),h*.3-fh,fx,h*.52); ctx.closePath();
      const gf = ctx.createLinearGradient(0,h*.52,0,h*.5-fh*1.4);
      gf.addColorStop(0,'rgba(255,100,0,0)'); gf.addColorStop(.5,'rgba(255,160,0,.7)'); gf.addColorStop(1,'rgba(255,240,180,.9)');
      ctx.fillStyle=gf; ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0,h*.0,w*.1,h*.14,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,220,100,.5)'; ctx.fill();
  },

  // ── 17. Kraken : 6 tentacules sombres ──
  kraken(ctx, w, h) {
    const t = Date.now() * 0.003;
    // Corps central
    const g = ctx.createRadialGradient(0,0,w*.08,0,h*.1,w*.48);
    g.addColorStop(0,'#1a0033'); g.addColorStop(1,'#000011');
    ctx.beginPath(); ctx.ellipse(0,h*.08,w*.38,h*.36,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#6600aa'; ctx.lineWidth=1.5; ctx.shadowColor='#8800cc'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
    // Tentacules (6)
    for (let i=0;i<6;i++) {
      const baseA = (i/6)*Math.PI*2 - Math.PI*.1;
      const wave  = Math.sin(t*1.6+i*1.05)*0.22;
      const x1 = Math.cos(baseA)*w*.38, y1 = Math.sin(baseA)*h*.36*.85+h*.08;
      const x2 = x1 + Math.cos(baseA+wave)*w*.32, y2 = y1 + Math.sin(baseA+wave)*h*.28+h*.1;
      ctx.beginPath(); ctx.moveTo(x1,y1);
      ctx.quadraticCurveTo(x1+Math.cos(baseA+wave)*.5*w*.2, y1+h*.12, x2, y2);
      ctx.strokeStyle=`rgba(140,0,220,.75)`; ctx.lineWidth=3.5-i*.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x2,y2,2.5,0,Math.PI*2); ctx.fillStyle='#8800cc'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0,h*.0,w*.12,0,Math.PI*2);
    ctx.fillStyle='rgba(180,80,255,.45)'; ctx.fill();
    ctx.beginPath(); ctx.arc(-w*.1,h*.0,w*.05,0,Math.PI*2); ctx.arc(w*.1,h*.0,w*.05,0,Math.PI*2);
    ctx.fillStyle='rgba(220,80,255,.9)'; ctx.fill();
  },

  // ── 18. Quantum : alterne entre 2 états ──
  quantum(ctx, w, h) {
    const phase = Math.floor(Date.now()/600)%2;
    if (phase === 0) {
      // État solide : bleu électrique
      ctx.beginPath();
      ctx.moveTo(0,-h*.5); ctx.lineTo(w*.36,-h*.06); ctx.lineTo(w*.46,h*.5);
      ctx.lineTo(-w*.46,h*.5); ctx.lineTo(-w*.36,-h*.06); ctx.closePath();
      ctx.fillStyle='rgba(0,40,120,.9)'; ctx.fill();
      ctx.strokeStyle='#00aaff'; ctx.lineWidth=2; ctx.shadowColor='#00aaff'; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
      [[0,-h*.22],[w*.2,h*.16],[-w*.2,h*.16]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x,y,w*.07,0,Math.PI*2); ctx.fillStyle='rgba(0,200,255,.6)'; ctx.fill();
      });
    } else {
      // État plasma : cyan translucide
      ctx.save(); ctx.globalAlpha=0.72;
      ctx.beginPath();
      ctx.moveTo(0,-h*.5); ctx.lineTo(w*.36,-h*.06); ctx.lineTo(w*.46,h*.5);
      ctx.lineTo(-w*.46,h*.5); ctx.lineTo(-w*.36,-h*.06); ctx.closePath();
      ctx.fillStyle='rgba(0,220,220,.35)'; ctx.fill();
      ctx.strokeStyle='#00ffee'; ctx.lineWidth=1.5; ctx.shadowColor='#00ffee'; ctx.shadowBlur=18; ctx.stroke(); ctx.shadowBlur=0;
      ctx.restore();
      for (let i=0;i<6;i++) {
        const a=(i/6)*Math.PI*2; ctx.beginPath();
        ctx.arc(Math.cos(a)*w*.28,h*.04+Math.sin(a)*h*.22,2.5,0,Math.PI*2);
        ctx.fillStyle='rgba(0,255,230,.8)'; ctx.fill();
      }
    }
  },

  // ── 19. Nébula : nébuleuse colorée dans la coque ──
  nebula(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.4,-h*.04); ctx.lineTo(w*.5,h*.5);
    ctx.lineTo(-w*.5,h*.5); ctx.lineTo(-w*.4,-h*.04); ctx.closePath();
    ctx.fillStyle='#050018'; ctx.fill();
    // Nébuleuse intérieure (clip)
    ctx.save(); ctx.clip();
    const t = Date.now()*0.0008;
    [['#6600aa',-.3],['#002299',.5],['#cc0066',.1]].forEach(([c,off]) => {
      const gn = ctx.createRadialGradient(w*(-.1+off+Math.sin(t+off)*.15),h*(.1+Math.cos(t*.7+off)*.2),0,0,h*.05,w*.55);
      gn.addColorStop(0,c+'aa'); gn.addColorStop(1,'transparent');
      ctx.fillStyle=gn; ctx.fillRect(-w*.6,-h*.6,w*1.2,h*1.2);
    });
    // Étoiles mini
    for (let i=0;i<14;i++) {
      const sx=(i*.618%1-.5)*w*.9, sy=(i*.382%1-.5)*h*.9;
      ctx.beginPath(); ctx.arc(sx,sy,1,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.7)'; ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.4,-h*.04); ctx.lineTo(w*.5,h*.5);
    ctx.lineTo(-w*.5,h*.5); ctx.lineTo(-w*.4,-h*.04); ctx.closePath();
    ctx.strokeStyle='#aa44ff'; ctx.lineWidth=1.5; ctx.shadowColor='#8800ff'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
  },

  // ── 20. Céleste : doré avec halo lumineux ──
  celestial(ctx, w, h) {
    const t = Date.now()*0.002;
    // Halo animé
    ctx.beginPath(); ctx.arc(0,0,w*.72,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,215,0,${0.15+0.1*Math.sin(t)})`; ctx.lineWidth=3; ctx.shadowColor='#FFD700'; ctx.shadowBlur=20; ctx.stroke(); ctx.shadowBlur=0;
    // Corps
    ctx.beginPath();
    ctx.moveTo(0,-h*.52); ctx.lineTo(w*.3,h*.0); ctx.lineTo(w*.42,h*.5);
    ctx.lineTo(-w*.42,h*.5); ctx.lineTo(-w*.3,h*.0); ctx.closePath();
    const g = ctx.createLinearGradient(0,-h*.52,0,h*.5);
    g.addColorStop(0,'#fff8c0'); g.addColorStop(.4,'#FFD700'); g.addColorStop(1,'#885500');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=1.5; ctx.shadowColor='#ffe060'; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
    // Ailes
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.3,h*.0); ctx.lineTo(s*w*.7,-h*.1); ctx.lineTo(s*w*.6,h*.4); ctx.lineTo(s*w*.42,h*.5); ctx.closePath();
      ctx.fillStyle='rgba(255,215,0,.2)'; ctx.fill(); ctx.strokeStyle='rgba(255,215,0,.55)'; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,-h*.1,w*.12,0,Math.PI*2);
    ctx.fillStyle='rgba(255,248,180,.55)'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
  },

  // ── 21. Void : noir avec fissures cyan ──
  void(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.38,-h*.04); ctx.lineTo(w*.5,h*.5);
    ctx.lineTo(-w*.5,h*.5); ctx.lineTo(-w*.38,-h*.04); ctx.closePath();
    ctx.fillStyle='#000000'; ctx.fill();
    ctx.strokeStyle='#00FFDC'; ctx.lineWidth=1.5; ctx.shadowColor='#00FFDC'; ctx.shadowBlur=12; ctx.stroke(); ctx.shadowBlur=0;
    // Fissures
    const cracks = [[0,-h*.5,w*.18,h*.0],[w*.1,h*.0,w*.38,h*.42],[-w*.14,h*.06,-w*.44,h*.46]];
    cracks.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      ctx.strokeStyle='rgba(0,255,220,.6)'; ctx.lineWidth=1.2; ctx.shadowColor='#00FFDC'; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
    });
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.38,-h*.04); ctx.lineTo(s*w*.68,h*.12); ctx.lineTo(s*w*.5,h*.5); ctx.closePath();
      ctx.fillStyle='rgba(0,255,220,.07)'; ctx.fill(); ctx.strokeStyle='rgba(0,255,220,.35)'; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,h*.04,w*.1,0,Math.PI*2);
    ctx.fillStyle='rgba(0,255,220,.25)'; ctx.fill();
  },

  // ── 22. Aurora : nacre irisée arc-en-ciel ──
  aurora(ctx, w, h) {
    const t = Date.now()*0.0015;
    ctx.beginPath();
    ctx.moveTo(0,-h*.5); ctx.lineTo(w*.34,-h*.02); ctx.lineTo(w*.46,h*.5);
    ctx.lineTo(-w*.46,h*.5); ctx.lineTo(-w*.34,-h*.02); ctx.closePath();
    const hue = (t*40)%360;
    const g = ctx.createLinearGradient(-w*.5,-h*.5,w*.5,h*.5);
    g.addColorStop(0,`hsl(${hue},90%,65%)`);
    g.addColorStop(.35,`hsl(${(hue+90)%360},90%,60%)`);
    g.addColorStop(.7,`hsl(${(hue+200)%360},90%,60%)`);
    g.addColorStop(1,`hsl(${(hue+310)%360},90%,55%)`);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=`hsl(${hue},100%,78%)`; ctx.lineWidth=1.5; ctx.shadowColor=`hsl(${hue},100%,70%)`; ctx.shadowBlur=12; ctx.stroke(); ctx.shadowBlur=0;
    [1,-1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s*w*.34,-h*.02); ctx.lineTo(s*w*.66,h*.18); ctx.lineTo(s*w*.46,h*.5); ctx.closePath();
      ctx.fillStyle=`hsla(${(hue+120)%360},80%,60%,.25)`; ctx.fill();
      ctx.strokeStyle=`hsla(${(hue+120)%360},90%,70%,.5)`; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,-h*.1,w*.11,0,Math.PI*2);
    ctx.fillStyle=`hsla(${(hue+180)%360},100%,80%,.5)`; ctx.fill();
  },
};

// ============================================================
// SECTION 5 — VAISSEAU JOUEUR
// ============================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 38; this.h = 46;

    this.lives = CFG.LIVES;
    this.score = 0;

    // Power-ups
    this.shield      = false;
    this.doubleShot  = false;
    this.bombs       = 0;
    this.puTimers    = { shield: 0, doubleShot: 0 };

    // Cosmétiques (définis par le jeu avant chaque partie)
    this.skin        = 'starter';
    this.bulletColor = '#ffffff';
    this.laserType   = '';

    // Tir
    this.fireCooldown = 0;

    // Invincibilité après impact
    this.invincible = false;
    this.invTimer   = 0;
    this.blinkTimer = 0;
    this.visible    = true;

    // Traînée moteur
    this._thrustParticles = [];
    this._thrustCd = 0;
  }

  // Hitbox réduite (plus fair pour le joueur)
  get hitbox() {
    return {
      x: this.x - this.w * 0.32,
      y: this.y - this.h * 0.38,
      w: this.w * 0.64,
      h: this.h * 0.76,
    };
  }

  /** Reçoit un impact. Retourne true si une vie est perdue. */
  hit(particles, audio) {
    if (this.invincible) return false;

    if (this.shield) {
      this.shield = false;
      this.puTimers.shield = 0;
      audio.shieldHit();
      spawnExplosion(particles, this.x, this.y - 10, '#00ff88', 14);
      return false;
    }

    this.lives--;
    this.invincible = true;
    this.invTimer   = CFG.INVINCIBILITY;
    this.blinkTimer = 0;
    audio.explosion(false);
    spawnExplosion(particles, this.x, this.y, '#ff6b35', 18);
    return true;
  }

  /** Active un power-up ramassé. */
  activatePowerup(type, audio) {
    audio.powerup();
    if      (type === 'shield') { this.shield     = true; this.puTimers.shield    = CFG.POWERUP_DURATION; }
    else if (type === 'double') { this.doubleShot = true; this.puTimers.doubleShot = CFG.POWERUP_DURATION; }
    else if (type === 'bomb')   { this.bombs++;  }
  }

  /** Utilise une bombe : inflige 25 dégâts fixes à chaque ennemi à l'écran. */
  useBomb(enemies, particles, audio) {
    if (this.bombs <= 0) return false;
    this.bombs--;
    audio.bomb();
    const BOMB_DAMAGE = 25;
    enemies.forEach(e => {
      if (e.dead || e.dying) return;
      e.hp = Math.max(0, (e.hp ?? 1) - BOMB_DAMAGE);
      spawnExplosion(particles, e.x, e.y, e.color, 14, true);
      if (e.hp <= 0) {
        if (e.isBoss) {
          e.dying = true;
          e.deathTimer = e.deathDuration;
        } else {
          e.dead = true;
        }
      } else if (typeof e.flashTimer !== 'undefined') {
        e.flashTimer = 0.08;
      }
    });
    return true;
  }

  update(dt, inp, W, H) {
    // Déplacement
    this.x = clamp(this.x + inp.dx * this.w * 0.5 * dt * (CFG.PLAYER_SPEED_X / 140), this.w / 2, W - this.w / 2);
    this.y = clamp(this.y + inp.dy * this.h * 0.5 * dt * (CFG.PLAYER_SPEED / 140), this.h / 2 + 40, H - this.h / 2 - 10);

    // Cooldowns
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Power-up timers
    if (this.puTimers.shield > 0) {
      this.puTimers.shield -= dt;
      if (this.puTimers.shield <= 0) this.shield = false;
    }
    if (this.puTimers.doubleShot > 0) {
      this.puTimers.doubleShot -= dt;
      if (this.puTimers.doubleShot <= 0) this.doubleShot = false;
    }

    // Clignotement pendant l'invincibilité
    if (this.invincible) {
      this.invTimer   -= dt;
      this.blinkTimer += dt;
      this.visible     = (Math.floor(this.blinkTimer * 9) % 2 === 0);
      if (this.invTimer <= 0) { this.invincible = false; this.visible = true; }
    }

    // Particules traînée moteur
    this._thrustCd -= dt;
    if (this._thrustCd <= 0) {
      this._thrustCd = 0.035;
      this._thrustParticles.push(new Particle(
        this.x + rand(-7, 7),
        this.y + this.h * 0.44,
        rand(-25, 25), rand(90, 170),
        Math.random() > 0.5 ? '#00e5ff' : '#ff6b35',
        rand(0.08, 0.22), rand(1.5, 3.2)
      ));
      // Effets traînée skins légendaires
      if (this.skin === 'celestial') {
        this._thrustParticles.push(new Particle(
          this.x + rand(-14, 14), this.y + this.h * 0.4,
          rand(-20, 20), rand(65, 125),
          Math.random() > 0.5 ? '#FFD700' : '#FFAA00',
          rand(0.18, 0.42), rand(2.5, 5)
        ));
      } else if (this.skin === 'aurora') {
        const hue = Math.floor(Date.now() / 55) % 360;
        this._thrustParticles.push(new Particle(
          this.x + rand(-14, 14), this.y + this.h * 0.4,
          rand(-25, 25), rand(70, 130),
          `hsl(${hue},100%,65%)`,
          rand(0.18, 0.4), rand(2, 4.5)
        ));
      }
    }
    this._thrustParticles = this._thrustParticles.filter(p => { p.update(dt); return !p.dead; });
  }

  /** Tire une ou deux balles selon le power-up actif. */
  fire(bullets, audio) {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = CFG.PLAYER_FIRE_RATE;
    const c = this.bulletColor;
    const lt = this.laserType;

    if (this.doubleShot) {
      bullets.push(new Bullet(this.x - 12, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true, lt));
      bullets.push(new Bullet(this.x + 12, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true, lt));
      audio.shootDouble();
    } else {
      bullets.push(new Bullet(this.x, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true, lt));
      audio.shoot();
    }
  }

  draw(ctx) {
    // Traînée moteur
    this._thrustParticles.forEach(p => p.draw(ctx));

    if (!this.visible) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Corps selon le skin équipé
    const renderer = SKIN_RENDERERS[this.skin] || SKIN_RENDERERS.starter;
    renderer(ctx, this.w, this.h);

    // Void : distorsion spatiale animée
    if (this.skin === 'void') {
      const tv = Date.now() * 0.003;
      for (let i = 0; i < 3; i++) {
        const a = tv * (0.6 + i * 0.35) + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 3, Math.sin(a) * 3, this.w * 0.68 + i * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,220,${0.14 - i * 0.04})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, this.w * 0.52, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,220,${0.28 + 0.12 * Math.sin(Date.now() * 0.005)})`;
      ctx.lineWidth = 1.5; ctx.shadowColor = '#00FFDC'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    }

    // Bouclier actif (commun à tous les skins)
    if (this.shield) {
      const t = Date.now() * 0.005;
      ctx.beginPath();
      ctx.arc(0, 0, this.w * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,136,${0.45 + 0.3 * Math.sin(t)})`;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

// ============================================================
// SECTION 6 — BALLES
// ============================================================
class Bullet {
  constructor(x, y, vx, vy, color, fromPlayer, laserType = '') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color      = color;
    this.fromPlayer = fromPlayer;
    this.laserType  = laserType;
    this.w = fromPlayer ? 4 : 7;
    this.h = fromPlayer ? 18 : 9;
    this.dead = false;
  }

  get hitbox() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -30 || this.y > H + 30 || this.x < -30 || this.x > W + 30) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    if (this.fromPlayer) {
      // Laser coloré : corps + noyau blanc
      const isPhantom = this.laserType === 'phantom';
      const isSolar   = this.laserType === 'solar';
      if (isPhantom) ctx.globalAlpha = 0.7;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = isSolar ? 18 : 10;
      ctx.fillStyle   = this.color;
      ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = isSolar ? 'rgba(255,255,220,0.85)' : 'rgba(255,255,255,0.65)';
      ctx.fillRect(this.x - 1, this.y - this.h/2, 2, this.h);
      if (isPhantom) ctx.globalAlpha = 1;
    } else {
      // Projectile ennemi : orbe rouge pulsant
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.w);
      grad.addColorStop(0, '#ff9999');
      grad.addColorStop(1, '#cc0022');
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.w/2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================
// SECTION 7 — ENNEMIS (3 types)
// ============================================================

// Fonctions de dessin séparées pour chaque type d'ennemi
const enemyRenderers = {

  // ── Basic : triangle rouge inversé ──
  basic(ctx, w, h, t) {
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo( w/2, -h/2);
    ctx.lineTo(-w/2, -h/2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#ff7788'); g.addColorStop(1, '#880011');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ff4455';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff4455';
    ctx.shadowBlur  = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Oeil
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,0,${0.7 + 0.3 * Math.sin(t * 4)})`;
    ctx.fill();
  },

  // ── Medium : étoile à 5 branches orange (rotation lente) ──
  medium(ctx, w, h, t) {
    ctx.rotate(t * 0.6);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 === 0) ? w/2 : w/4;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#cc5500';
    ctx.fill();
    ctx.strokeStyle = '#ff9922';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Noyau
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffaa00';
    ctx.fill();
  },

  // ── Heavy : hexagone violet avec noyau pulsant ──
  heavy(ctx, w, h, t) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      ctx.lineTo(Math.cos(a) * w/2, Math.sin(a) * h/2);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w/2);
    g.addColorStop(0, '#cc77ff'); g.addColorStop(1, '#440088');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#aa44ff';
    ctx.shadowBlur  = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Noyau pulsant
    const pulse = 7 + 3 * Math.sin(t * 3.5);
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,160,255,${0.65 + 0.3 * Math.sin(t * 3)})`;
    ctx.fill();
  },
};

const ENEMY_DEFS = {
  basic:  { w: 32, h: 30, hp: 1, score: 100, color: '#ff4455', fireRate: 3.8, dropChance: 0.18 },
  medium: { w: 42, h: 36, hp: 3, score: 260, color: '#ff8800', fireRate: 2.6, dropChance: 0.32 },
  heavy:  { w: 54, h: 46, hp: 8, score: 550, color: '#aa44ff', fireRate: 1.9, dropChance: 0.52 },
};

class Enemy {
  constructor(type, x, y, speedScale) {
    const def     = ENEMY_DEFS[type];
    this.type     = type;
    this.x = x; this.y = y;
    this.w        = def.w;
    this.h        = def.h;
    this.hp       = def.hp;
    this.maxHp    = def.hp;
    this.score    = def.score;
    this.color    = def.color;
    this.fireRate = def.fireRate;
    this.dropChance = def.dropChance;
    this._render  = enemyRenderers[type];

    // Vitesse verticale + léger drift latéral
    this.vy      = (50 + speedScale * 18) * (1 + Math.random() * 0.3);
    this.vx      = rand(-1, 1) * this.vy * 0.25;

    this.fireTimer  = rand(0.5, def.fireRate);
    this.flashTimer = 0;
    this.t          = rand(0, 10);   // phase aléatoire pour animations
    this.dead       = false;

    // Extensions mode Histoire
    this.stealth  = false;  // clignotement furtif (niveau 6)
    this.isBoss   = false;  // mini-boss ou boss final
    this.isFinal  = false;  // boss final uniquement
  }

  get hitbox() {
    return { x: this.x - this.w*0.42, y: this.y - this.h*0.42, w: this.w*0.84, h: this.h*0.84 };
  }

  hit() {
    this.hp--;
    this.flashTimer = 0.1;
    return this.hp <= 0;
  }

  update(dt, W, H, enemyBullets) {
    this.t  += dt;
    this.y  += this.vy * dt;
    this.x  += this.vx * dt;

    // Rebond sur les bords
    if (this.x < this.w/2 + 4)  { this.x = this.w/2 + 4;  this.vx = Math.abs(this.vx); }
    if (this.x > W - this.w/2 - 4) { this.x = W - this.w/2 - 4; this.vx = -Math.abs(this.vx); }

    // Tir
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireRate;
      enemyBullets.push(new Bullet(
        this.x, this.y + this.h/2,
        rand(-40, 40), CFG.ENEMY_BULLET_SPEED,
        '#ff3355', false
      ));
    }

    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.y > H + this.h) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Effet furtif (stealth) : opacité sinusoïdale
    if (this.stealth) {
      ctx.globalAlpha = 0.18 + 0.38 * Math.abs(Math.sin(Date.now() * 0.0034 + this.t));
    }

    // Flash blanc à l'impact
    if (this.flashTimer > 0) ctx.filter = 'brightness(3.5) saturate(0)';
    this._render(ctx, this.w, this.h, this.t);
    ctx.filter = 'none';

    // Halo boss
    if (this.isBoss) {
      const gc = this.isFinal ? '#FFD700' : '#ff6600';
      ctx.shadowColor = gc;
      ctx.shadowBlur  = 44;
      ctx.beginPath();
      ctx.arc(0, 0, this.w * 0.56, 0, Math.PI * 2);
      ctx.strokeStyle = this.isFinal ? 'rgba(255,215,0,0.32)' : 'rgba(255,100,0,0.32)';
      ctx.lineWidth   = 5;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    ctx.globalAlpha = 1;

    // Barre de vie (ennemis à plusieurs points de vie)
    if (this.maxHp > 1) {
      const bw = this.w * 0.82;
      const bh = 3.5;
      const bx = -bw / 2;
      const by = -this.h/2 - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, bw, bh);
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = ratio > 0.5 ? '#00ff88' : ratio > 0.25 ? '#ffcc00' : '#ff3355';
      ctx.fillRect(bx, by, bw * ratio, bh);
    }

    ctx.restore();
  }
}

// ============================================================
// SECTION 8 — POWER-UPS
// ============================================================
const PU_DEFS = {
  shield: { emoji: '🛡️', color: '#00ff88', glow: '#00ff88' },
  double: { emoji: '⚡', color: '#ffcc00', glow: '#ffdd44' },
  bomb:   { emoji: '💣', color: '#ff6b35', glow: '#ff6b35' },
};

class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    const d   = PU_DEFS[type];
    this.color = d.color;
    this.glow  = d.glow;
    this.emoji = d.emoji;
    this.r    = 16;
    this.vy   = 82;
    this.t    = rand(0, Math.PI * 2);
    this.dead = false;
  }

  get hitbox() { return { x: this.x-this.r, y: this.y-this.r, w: this.r*2, h: this.r*2 }; }

  update(dt, H) {
    this.y += this.vy * dt;
    this.t += dt;
    if (this.y > H + 30) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.t * 2.2) * 4.5);

    ctx.shadowColor = this.glow;
    ctx.shadowBlur  = 14 + 7 * Math.sin(this.t * 2.8);

    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2;
    ctx.fillStyle   = 'rgba(0,0,0,0.52)';
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font       = `${this.r * 1.05}px serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 1);

    ctx.restore();
  }
}

// ============================================================
// SECTION 9 — GESTIONNAIRE DE VAGUES
// ============================================================
class WaveManager {
  constructor() {
    this.level         = 1;
    this.spawnQueue    = [];   // { type, x, y, delay }
    this.spawnTimer    = 0;
    this.betweenWave   = false;
    this.betweenTimer  = 0;
    this._spawned      = 0;   // total apparu dans la vague
    this._killed       = 0;   // total éliminés
    this._done         = false;
  }

  /** Vitesse de base des ennemis pour le niveau courant. */
  _speedScale() { return this.level; }

  /** Construit la file de spawn pour un niveau donné. */
  _buildWave(level, W) {
    const queue  = [];
    const cols   = Math.min(2 + Math.floor(level * 0.7), 7);
    const rows   = 1 + Math.floor((level - 1) / 3);

    const types  = ['basic'];
    if (level >= 3) types.push('medium');
    if (level >= 6) types.push('heavy');

    const spacing = (W - 60) / (cols + 1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Ennemis plus lourds dans les dernières lignes aux niveaux élevés
        const typeIdx = clamp(
          Math.floor((row / rows) * types.length + Math.random() * (level / 4)),
          0, types.length - 1
        );
        queue.push({
          type:  types[typeIdx],
          x:     spacing * (col + 1) + 30,
          y:     -60 - row * 90,
          delay: row * 0.55 + col * 0.14,
        });
      }
    }
    return queue;
  }

  /** Démarre un niveau. */
  start(level, W) {
    this.level        = level;
    this.spawnQueue   = this._buildWave(level, W);
    this.spawnTimer   = 0;
    this.betweenWave  = false;
    this._spawned     = this.spawnQueue.length;
    this._killed      = 0;
    this._done        = false;
  }

  /** Notifie qu'un ennemi a été détruit. */
  enemyKilled() { this._killed++; }

  /**
   * Met à jour la gestion de vague. Retourne 'next' si on passe au niveau suivant,
   * sinon undefined.
   */
  update(dt, enemies, W) {
    if (this.betweenWave) {
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0) {
        this.betweenWave = false;
        this.start(this.level, W);
      }
      return;
    }

    // Spawn des ennemis depuis la file avec délai
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].delay) {
        const s = this.spawnQueue.shift();
        enemies.push(new Enemy(s.type, s.x, s.y, this._speedScale()));
      }
    }

    // Vague terminée : file vide + tous les ennemis apparus ont été éliminés ou sont sortis
    if (!this._done && this.spawnQueue.length === 0 && enemies.length === 0) {
      this._done        = true;
      this.level++;
      this.betweenWave  = true;
      this.betweenTimer = 2.8;
      return 'next';
    }
  }
}

// ============================================================
// SECTION 10 — GESTION DES ENTRÉES (clavier + joystick tactile)
// ============================================================
class InputManager {
  constructor() {
    this._keys = {};
    // État normalisé [-1..1] pour chaque axe
    this.dx    = 0;
    this.dy    = 0;
    this.fire  = false;
    this.bomb  = false;

    this._joystick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this._fireHeld = false;

    this._bindKeyboard();
    this._bindMobile();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); this.fire = true; }
      if (e.code === 'KeyB')  { this.bomb = true; }
    });
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
      if (e.code === 'Space') this.fire = false;
      if (e.code === 'KeyB')  this.bomb = false;
    });
  }

  _bindMobile() {
    const base  = document.getElementById('joystick-base');
    const knob  = document.getElementById('joystick-knob');
    const fire  = document.getElementById('btn-fire');
    const bomb  = document.getElementById('btn-bomb');
    const MAX   = 44; // rayon max du joystick

    if (base) {
      base.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this._joystick = { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
      }, { passive: false });

      base.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== this._joystick.id) continue;
          const rawX = t.clientX - this._joystick.ox;
          const rawY = t.clientY - this._joystick.oy;
          const dist = Math.sqrt(rawX*rawX + rawY*rawY);
          const norm = dist > 6 ? Math.min(dist, MAX) / MAX : 0;
          const ang  = Math.atan2(rawY, rawX);
          this._joystick.dx = norm * Math.cos(ang);
          this._joystick.dy = norm * Math.sin(ang);
          // Déplace le knob visuellement
          if (knob) {
            const kx = clamp(rawX, -MAX, MAX);
            const ky = clamp(rawY, -MAX, MAX);
            knob.style.transform = `translate(${kx}px,${ky}px)`;
          }
        }
      }, { passive: false });

      const endJoy = e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== this._joystick.id) continue;
          this._joystick.active = false;
          this._joystick.dx = 0;
          this._joystick.dy = 0;
          if (knob) knob.style.transform = '';
        }
      };
      base.addEventListener('touchend',    endJoy, { passive: false });
      base.addEventListener('touchcancel', endJoy, { passive: false });
    }

    if (fire) {
      fire.addEventListener('touchstart', e => { e.preventDefault(); this._fireHeld = true;  }, { passive: false });
      fire.addEventListener('touchend',   e => { e.preventDefault(); this._fireHeld = false; }, { passive: false });
    }

    if (bomb) {
      bomb.addEventListener('touchstart', e => { e.preventDefault(); this.bomb = true; }, { passive: false });
      bomb.addEventListener('touchend',   e => { e.preventDefault(); this.bomb = false; }, { passive: false });
    }
  }

  /** Calcule l'état d'entrée normalisé pour ce frame. */
  update() {
    const k = this._keys;

    // Axe X : clavier ou joystick
    if (this._joystick.active) {
      this.dx = this._joystick.dx;
      this.dy = this._joystick.dy;
    } else {
      this.dx = (k['ArrowRight'] || k['KeyD'] ? 1 : 0) - (k['ArrowLeft'] || k['KeyA'] ? 1 : 0);
      this.dy = (k['ArrowDown']  || k['KeyS'] ? 1 : 0) - (k['ArrowUp']   || k['KeyW'] ? 1 : 0);
      // Normalise la diagonale
      const len = Math.sqrt(this.dx*this.dx + this.dy*this.dy);
      if (len > 1) { this.dx /= len; this.dy /= len; }
    }

    // Tir : clavier OU bouton tactile maintenu
    this.fire = this._keys['Space'] || this._fireHeld;
  }
}

// ============================================================
// SECTION 11 — GESTIONNAIRE D'INTERFACE (UI)
// ============================================================
class UIManager {
  constructor() {
    this.$score      = document.getElementById('hud-score');
    this.$level      = document.getElementById('hud-level');
    this.$lives      = document.getElementById('hud-lives');
    this.$hs         = document.getElementById('hud-highscore');
    this.$coinsVal   = document.getElementById('hud-coins-val');
    this.$piShield   = document.getElementById('pi-shield');
    this.$piDouble   = document.getElementById('pi-double');
    this.$piBombs    = document.getElementById('pi-bombs');
    this.$bombCnt    = document.getElementById('pi-bomb-count');
    this.$notif      = document.getElementById('level-notif');
    this.$flash      = document.getElementById('flash-overlay');
    this._coinAnimId = null;   // RAF id de l'animation de comptage
  }

  // ── HUD ──────────────────────────────────────────────────
  updateHUD(score, level, lives, hs) {
    this.$score.textContent = score.toLocaleString('fr-FR');
    this.$level.textContent = level;
    this.$hs.textContent    = hs.toLocaleString('fr-FR');

    // Icônes vies
    this.$lives.innerHTML = '';
    for (let i = 0; i < CFG.LIVES; i++) {
      const d = document.createElement('div');
      d.className = 'life-icon' + (i >= lives ? ' lost' : '');
      this.$lives.appendChild(d);
    }
  }

  updatePowerupBar(player) {
    this._updatePI(this.$piShield, 'shield-fill', player.shield,     player.puTimers.shield);
    this._updatePI(this.$piDouble, 'double-fill', player.doubleShot, player.puTimers.doubleShot);
    if (player.bombs > 0) {
      this.$piBombs.classList.remove('hidden');
      this.$bombCnt.textContent = player.bombs;
    } else {
      this.$piBombs.classList.add('hidden');
    }
  }

  _updatePI(el, fillId, active, timer) {
    if (!active) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const fill = el.querySelector('.pi-timer-fill');
    if (fill) fill.style.width = `${(timer / CFG.POWERUP_DURATION) * 100}%`;
  }

  // ── Écrans ───────────────────────────────────────────────
  showScreen(name) {
    ['start','gameover','pause','shop','story-select','story-victory','story-failed','final-victory'].forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.toggle('active', id === name);
    });
  }

  hideScreens() {
    ['start','gameover','pause','shop','story-select','story-victory','story-failed','final-victory'].forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.remove('active');
    });
  }

  // ── Sélection des niveaux histoire ───────────────────────
  refreshStorySelect(storyManager) {
    const grid = document.getElementById('story-level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    STORY_LEVELS.forEach(lvl => {
      const unlocked = lvl.id <= storyManager.unlocked;
      const stars    = storyManager.getStars(lvl.id);
      const card     = document.createElement('div');
      card.className = `story-card ${unlocked ? 'unlocked' : 'locked'}`;
      if (!unlocked) {
        card.innerHTML = `<div class="story-card-lock">🔒</div><div class="story-card-num">${lvl.id}</div>`;
      } else {
        const filledStar = '★', emptyStar = '☆';
        const starsHtml  = filledStar.repeat(stars) + emptyStar.repeat(3 - stars);
        card.innerHTML = `
          <div class="story-card-num">${lvl.id}</div>
          <div class="story-card-name">${lvl.name}</div>
          <div class="story-card-stars" data-stars="${stars}">${starsHtml}</div>`;
        card.addEventListener('click', () =>
          document.dispatchEvent(new CustomEvent('starblast-story-play', { detail: { id: lvl.id } }))
        );
      }
      grid.appendChild(card);
    });
  }

  // ── Écran Victoire Histoire ──────────────────────────────
  showStoryVictory(levelId, stars, score, xpAdded, coinsEarned, hasNext) {
    const $ = id => document.getElementById(id);
    const titleEl = $('vs-title');
    if (titleEl) titleEl.textContent = `NIVEAU ${levelId} TERMINÉ !`;
    const starsEl = $('vs-stars');
    if (starsEl) { starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); starsEl.dataset.stars = stars; }
    const scoreEl = $('vs-score');
    if (scoreEl) scoreEl.textContent = score.toLocaleString('fr-FR');
    const xpEl = $('vs-xp');
    if (xpEl) xpEl.textContent = `+${xpAdded.toLocaleString('fr-FR')} XP`;
    const coinsEl = $('vs-coins');
    if (coinsEl) coinsEl.textContent = `+${coinsEarned}`;
    const btnNext = $('btn-next-level');
    if (btnNext) btnNext.style.display = hasNext ? '' : 'none';
    this.showScreen('story-victory');
  }

  // ── Écran Échec Histoire ──────────────────────────────────
  showStoryFailed(levelId) {
    const el = document.getElementById('sf-level');
    if (el) el.textContent = `Niveau ${levelId} — ${STORY_LEVELS.find(l => l.id === levelId)?.name || ''}`;
    this.showScreen('story-failed');
  }

  // ── Victoire Finale (après TITAN) ────────────────────────
  showFinalVictory(storyManager, coinsEarned, xpEarned) {
    const recap = document.getElementById('fv-stars-recap');
    if (recap) {
      recap.innerHTML = '';
      for (let i = 1; i <= 10; i++) {
        const s = storyManager.getStars(i);
        const stars = ['☆☆☆', '★☆☆', '★★☆', '★★★'][s] || '☆☆☆';
        const div = document.createElement('div');
        div.className = `fv-level-row${s > 0 ? ' fv-level-done' : ''}`;
        div.innerHTML = `<span>Niveau ${i}</span><span class="fv-stars-cell" data-s="${s}">${stars}</span>`;
        recap.appendChild(div);
      }
    }
    const stats = document.getElementById('fv-stats');
    if (stats) {
      stats.innerHTML = `
        <div class="result-row"><span>PIÈCES GAGNÉES</span><span class="result-value coins-value">+${coinsEarned}</span></div>
        <div class="result-row"><span>XP GAGNÉE (×2)</span><span class="result-value xp-value">+${xpEarned} XP</span></div>
      `;
    }
    this.showScreen('final-victory');
  }

  // ── Notifications ────────────────────────────────────────
  showLevelNotif(level) {
    if (!this.$notif) return;
    this.$notif.textContent = `NIVEAU ${level}`;
    this.$notif.classList.remove('show');
    void this.$notif.offsetWidth; // force reflow pour relancer l'animation CSS
    this.$notif.classList.add('show');
  }

  flash(color = 'white', opacity = 0.45) {
    if (!this.$flash) return;
    this.$flash.style.background = color;
    this.$flash.style.opacity    = opacity;
    setTimeout(() => { if (this.$flash) this.$flash.style.opacity = 0; }, 75);
  }

  // ── Game Over ────────────────────────────────────────────
  showGameOver(score, hs, level) {
    document.getElementById('go-score').textContent     = score.toLocaleString('fr-FR');
    document.getElementById('go-highscore').textContent = hs.toLocaleString('fr-FR');
    document.getElementById('go-level').textContent     = level;
    this.showScreen('gameover');
  }

  updateStartHS(hs) {
    const el = document.getElementById('start-hs');
    if (el) el.textContent = hs.toLocaleString('fr-FR');
  }

  // ── Pièces ───────────────────────────────────────────────

  /** Met à jour l'affichage permanent des pièces dans le HUD. */
  updateCoins(total) {
    if (this.$coinsVal) this.$coinsVal.textContent = total.toLocaleString('fr-FR');
  }

  /** Met à jour l'affichage des pièces sur l'écran d'accueil. */
  updateStartCoins(total) {
    const el = document.getElementById('start-coins-val');
    if (el) el.textContent = total.toLocaleString('fr-FR');
  }

  /**
   * Affiche le résultat pièces sur l'écran Game Over avec animation de comptage.
   * @param {number} earned  – pièces gagnées cette partie
   * @param {number} total   – total cumulé après ajout
   */
  showGameOverCoins(earned, total) {
    const elEarned = document.getElementById('go-coins-earned');
    const elTotal  = document.getElementById('go-coins-total-val');
    if (elTotal) elTotal.textContent = total.toLocaleString('fr-FR');
    if (!elEarned) return;

    // Annule un éventuel comptage précédent
    if (this._coinAnimId) cancelAnimationFrame(this._coinAnimId);

    const DURATION = 1500;  // ms
    const startTs  = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTs) / DURATION, 1);
      // Ease-out cubique
      const eased   = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * earned);

      elEarned.textContent = `+${current.toLocaleString('fr-FR')}`;

      // Petite animation CSS à chaque incrément
      elEarned.classList.remove('counting');
      void elEarned.offsetWidth;
      elEarned.classList.add('counting');

      if (progress < 1) {
        this._coinAnimId = requestAnimationFrame(tick);
      } else {
        elEarned.textContent = `+${earned.toLocaleString('fr-FR')}`;
        this._coinAnimId = null;
      }
    };

    this._coinAnimId = requestAnimationFrame(tick);
  }

  // ── Niveau de progression dans le HUD ──────────────────────
  updateXPLevel(level) {
    const el = document.getElementById('hud-xlvl');
    if (!el) return;
    el.textContent = level;
    el.style.color = getLevelColor(level);
    el.style.animation = level >= 100 ? 'xlvl-gold-glow 1.5s ease-in-out infinite alternate' : '';
  }

  // ── Barre XP (bas du canvas) ────────────────────────────────
  updateXPBar(level, ratio) {
    const fill = document.getElementById('xp-bar-fill');
    if (!fill) return;
    const color = getLevelColor(level);
    fill.style.width      = `${Math.min(ratio * 100, 100)}%`;
    fill.style.background = color;
    fill.style.boxShadow  = `0 0 5px ${color}`;
  }

  // ── XP gagnée + niveau + level-up (Game Over) ──────────────
  showGameOverXP(xpAdded, level, levelsGained) {
    const lvlEl = document.getElementById('go-xlvl');
    if (lvlEl) { lvlEl.textContent = level; lvlEl.style.color = getLevelColor(level); }

    const lvUpEl = document.getElementById('go-levelup');
    if (lvUpEl) lvUpEl.classList.add('hidden');

    const earnedEl = document.getElementById('go-xp-earned');
    if (!earnedEl) return;
    earnedEl.textContent = '+0 XP';

    if (this._xpAnimId) cancelAnimationFrame(this._xpAnimId);
    const DURATION = 1200;
    const startTs  = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTs) / DURATION, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      earnedEl.textContent = `+${Math.floor(eased * xpAdded).toLocaleString('fr-FR')} XP`;
      if (progress < 1) {
        this._xpAnimId = requestAnimationFrame(tick);
      } else {
        earnedEl.textContent = `+${xpAdded.toLocaleString('fr-FR')} XP`;
        this._xpAnimId = null;
        if (levelsGained.length > 0 && lvUpEl) {
          const highest = levelsGained[levelsGained.length - 1];
          lvUpEl.textContent = `NIVEAU ${highest} ATTEINT !`;
          lvUpEl.style.color = getLevelColor(highest);
          lvUpEl.classList.remove('hidden');
        }
      }
    };
    this._xpAnimId = requestAnimationFrame(tick);
  }

  // ── Badge LÉGENDE niveau 100 ────────────────────────────────
  updateLegendBadge(level) {
    const el = document.getElementById('legend-badge');
    if (!el) return;
    if (level >= 100) el.classList.remove('hidden');
    else              el.classList.add('hidden');
  }
}

// ============================================================
// SECTION 11c — GESTIONNAIRE DE PROGRESSION XP
// ============================================================
class ProgressionManager {
  constructor() {
    const saved = JSON.parse(localStorage.getItem('starblast_progression') || '{"totalXP":0}');
    this.totalXP = Math.max(0, saved.totalXP || 0);
    const { level, xpInLevel } = ProgressionManager.computeLevel(this.totalXP);
    this.level    = level;
    this.xpInLevel = xpInLevel;
  }

  static xpForLevel(n) {
    if (n >= 100) return Infinity;
    return Math.round(100 * Math.pow(n, 1.5));
  }

  static computeLevel(totalXP) {
    let level = 1;
    let remaining = totalXP;
    while (level < 100) {
      const needed = ProgressionManager.xpForLevel(level);
      if (remaining < needed) break;
      remaining -= needed;
      level++;
    }
    return { level, xpInLevel: remaining };
  }

  get progressRatio() {
    if (this.level >= 100) return 1;
    return Math.min(this.xpInLevel / ProgressionManager.xpForLevel(this.level), 1);
  }

  /**
   * Ajoute de l'XP (multiplié par XP_MULTIPLIER global).
   * Retourne { xpAdded, levelsGained[], unlocks[] }.
   */
  addXP(rawXP, shop) {
    const amount = Math.max(0, Math.floor(rawXP * XP_MULTIPLIER));
    if (amount === 0 || this.level >= 100) return { xpAdded: 0, levelsGained: [], unlocks: [] };

    const prevLevel = this.level;
    this.totalXP += amount;
    const { level, xpInLevel } = ProgressionManager.computeLevel(this.totalXP);
    this.level    = level;
    this.xpInLevel = xpInLevel;

    const levelsGained = [];
    const unlocks      = [];
    for (let lv = prevLevel + 1; lv <= level; lv++) {
      levelsGained.push(lv);
      LEVEL_UNLOCKS.filter(u => u.level === lv).forEach(u => {
        shop.owned.add(u.id);
        unlocks.push(u);
      });
    }

    if (unlocks.length > 0) shop._persistOwned();
    this._save();

    return { xpAdded: amount, levelsGained, unlocks };
  }

  _save() {
    localStorage.setItem('starblast_progression', JSON.stringify({ totalXP: this.totalXP }));
  }
}

// ============================================================
// SECTION 11b — GESTIONNAIRE DE LA BOUTIQUE
// ============================================================
class ShopManager {
  constructor() {
    // Chargement de l'état depuis localStorage
    const raw = JSON.parse(localStorage.getItem('starblast_shop') || '{"owned":[]}');
    this.owned = new Set(['starter', 'white', ...(raw.owned || [])]);

    const eq = JSON.parse(localStorage.getItem('starblast_equipped') || '{}');
    this.equippedSkin  = this.owned.has(eq.skin)  ? eq.skin  : 'starter';
    this.equippedColor = this.owned.has(eq.color) ? eq.color : 'white';

    this._tab          = 'skins';  // onglet actif
    this._rarityFilter = 'all';    // filtre rareté actif
    this._coins        = 0;        // snapshot pour re-render sans argument
    this._shopAnimId   = null;     // rAF pour particules légendaires
  }

  // ── Couleur de balle courante (gère le rainbow) ──────────
  getBulletColor() {
    if (this.equippedColor === 'rainbow') {
      const step = Math.floor(Date.now() / 500) % 6;
      return `hsl(${step * 60}, 100%, 62%)`;
    }
    return COLOR_DATA.find(c => c.id === this.equippedColor)?.color ?? '#ffffff';
  }

  // ── Achat (appelé par Game après déduction des pièces) ───
  buy(id) {
    this.owned.add(id);
    this._persistOwned();
  }

  // ── Équiper ──────────────────────────────────────────────
  equip(id) {
    if (SKIN_DATA.some(s => s.id === id))   this.equippedSkin  = id;
    if (COLOR_DATA.some(c => c.id === id))  this.equippedColor = id;
    this._persistEquipped();
    this.refresh(this._coins);  // re-render avec snapshot
  }

  // ── Persistance ──────────────────────────────────────────
  _persistOwned() {
    const extras = [...this.owned].filter(id => id !== 'starter' && id !== 'white');
    localStorage.setItem('starblast_shop', JSON.stringify({ owned: extras }));
    this._persistEquipped();
  }

  _persistEquipped() {
    localStorage.setItem('starblast_equipped', JSON.stringify({
      skin: this.equippedSkin, color: this.equippedColor,
    }));
  }

  // ── Rafraîchit le solde affiché ──────────────────────────
  _updateBalance(coins) {
    const el = document.getElementById('shop-coins-val');
    if (el) el.textContent = coins.toLocaleString('fr-FR');
  }

  // ── Reconstruit la grille complète ───────────────────────
  refresh(coins) {
    this._coins = coins;
    this._updateBalance(coins);
    this._renderGrid(coins);
    document.querySelectorAll('.shop-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === this._tab)
    );
    document.querySelectorAll('.rarity-filter-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.rarity === this._rarityFilter)
    );
  }

  _renderGrid(coins) {
    // Stop legendary particle animation
    if (this._shopAnimId) { cancelAnimationFrame(this._shopAnimId); this._shopAnimId = null; }

    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };
    let items = (this._tab === 'skins' ? SKIN_DATA : COLOR_DATA).slice();
    if (this._rarityFilter !== 'all') items = items.filter(i => i.rarity === this._rarityFilter);
    items.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0));

    items.forEach(item => this._renderCard(grid, item, coins));

    // Start legendary animation if any visible
    if (items.some(i => i.rarity === 'legendary')) this._startShopAnims();
  }

  _renderCard(grid, item, coins) {
    const owned    = this.owned.has(item.id);
    const equipped = this.equippedSkin === item.id || this.equippedColor === item.id;
    const isSkin   = SKIN_DATA.some(s => s.id === item.id);
    const canBuy   = coins >= item.price;
    const rarity   = item.rarity || 'common';

    const stateClass = equipped ? 'equipped' : owned ? 'owned' : 'locked';
    const card = document.createElement('div');
    card.className = `shop-card ${stateClass} rarity-${rarity}`;
    card.dataset.rarity = rarity;

    // Badge de rareté
    const RARITY_LABELS = { common: 'COMMUN', rare: 'RARE', epic: 'ÉPIQUE', legendary: 'LÉGEND.' };
    const badge = document.createElement('div');
    badge.className = `card-rarity-badge rarity-badge-${rarity}`;
    badge.textContent = RARITY_LABELS[rarity] || rarity.toUpperCase();
    card.appendChild(badge);

    // Canvas aperçu
    const cv = document.createElement('canvas');
    cv.className = 'card-preview';
    cv.width  = 64;
    cv.height = isSkin ? 76 : 36;
    this._drawPreview(cv, item, isSkin);
    // Pour les légendaires, les particules sont animées directement sur ce canvas
    if (rarity === 'legendary') {
      cv.dataset.legendaryCard = '1';
      cv.dataset.skinId  = item.id;
      cv.dataset.isSkin  = isSkin ? '1' : '0';
    }
    card.appendChild(cv);

    // Nom
    const nameEl = document.createElement('div');
    nameEl.className   = 'card-name';
    nameEl.textContent = item.name;
    card.appendChild(nameEl);

    // Prix
    const priceEl = document.createElement('div');
    priceEl.className = 'card-price';
    if (item.price === 0) {
      priceEl.innerHTML = '<span class="card-free">GRATUIT</span>';
    } else {
      priceEl.innerHTML = `<span class="coin-star">★</span> ${item.price.toLocaleString('fr-FR')}`;
    }
    card.appendChild(priceEl);

    // Bouton action
    const btn = document.createElement('button');
    if (equipped) {
      btn.className   = 'card-btn card-btn-equipped';
      btn.textContent = '✓ ÉQUIPÉ';
      btn.disabled    = true;
    } else if (owned) {
      btn.className   = 'card-btn card-btn-equip';
      btn.textContent = 'ÉQUIPER';
      btn.addEventListener('click', () => this.equip(item.id));
    } else if (canBuy) {
      btn.className   = 'card-btn card-btn-buy';
      btn.textContent = 'ACHETER';
      btn.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent('starblast-shop-buy', { detail: { id: item.id, price: item.price } }))
      );
    } else {
      btn.className   = 'card-btn card-btn-nocoins';
      btn.textContent = 'Pièces insuf.';
      btn.disabled    = true;
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }

  // ── Animation particules pour cartes légendaires ──────────
  // Redessine le skin + les particules orbitales directement sur le canvas aperçu.
  // Pas de canvas overlay séparé : évite la perte de contexte GPU en vue "Tous".
  _startShopAnims() {
    const step = () => {
      const canvases = document.querySelectorAll('[data-legendary-card]');
      if (!canvases.length) return;
      const t = Date.now() / 1000;
      canvases.forEach(cv => {
        const ctx2 = cv.getContext('2d');
        if (!ctx2) return;
        const W = cv.width, H = cv.height;
        ctx2.clearRect(0, 0, W, H);

        // 1. Redessiner le skin (animated skins like aurora/celestial bénéficient de ça)
        if (cv.dataset.isSkin === '1') {
          const renderer = SKIN_RENDERERS[cv.dataset.skinId];
          if (renderer) {
            ctx2.save();
            ctx2.translate(W / 2, H / 2);
            renderer(ctx2, 46, 58);
            ctx2.restore();
          }
        }

        // 2. Particules orbitales arc-en-ciel sur le canvas (pas d'overlay)
        const cx = W / 2, cy = H / 2;
        const rx = W * 0.50, ry = H * 0.48;
        for (let i = 0; i < 8; i++) {
          const a = t * 1.6 + i * Math.PI * 2 / 8;
          const px = cx + Math.cos(a) * rx;
          const py = cy + Math.sin(a) * ry;
          const hue = ((t * 80 + i * 45) % 360);
          const sz  = 2.0 + Math.sin(t * 3.5 + i) * 0.6;
          ctx2.save();
          ctx2.fillStyle   = `hsl(${hue},100%,70%)`;
          ctx2.shadowColor = `hsl(${hue},100%,70%)`;
          ctx2.shadowBlur  = 7;
          ctx2.globalAlpha = 0.82 + 0.18 * Math.sin(t * 4 + i);
          ctx2.beginPath(); ctx2.arc(px, py, sz, 0, Math.PI * 2); ctx2.fill();
          ctx2.restore();
        }
      });
      this._shopAnimId = requestAnimationFrame(step);
    };
    this._shopAnimId = requestAnimationFrame(step);
  }

  // Dessine l'aperçu dans un mini-canvas
  _drawPreview(canvas, item, isSkin) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isSkin) {
      const renderer = SKIN_RENDERERS[item.id];
      if (!renderer) return;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      renderer(ctx, 46, 58);
      ctx.restore();
    } else {
      // Aperçu laser : barre colorée avec noyau blanc
      const cx    = canvas.width / 2;
      const color = item.id === 'rainbow' ? 'hsl(200,100%,62%)' : item.color;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = color;
      ctx.fillRect(cx - 3, 4, 6, canvas.height - 8);
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(255,255,255,0.7)';
      ctx.fillRect(cx - 1, 4, 2, canvas.height - 8);
      // Label "x6" pour rainbow
      if (item.id === 'rainbow') {
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('×6', cx, canvas.height - 3);
      }
      ctx.restore();
    }
  }
}

// ============================================================
// SECTION 11b-bis — SCÈNE TITRE (Fond animé écran d'accueil)
// ============================================================
class TitleScene {
  constructor(W, H) {
    this.W = W; this.H = H;
    this._raf   = null;
    this._last  = 0;
    this._t     = 0;
    this._stars = null;
    this._asteroids = null;
  }

  start() {
    const cv = document.getElementById('title-canvas');
    if (!cv || this._raf) return;
    cv.width  = this.W;
    cv.height = this.H;
    this._cv  = cv;
    this._ctx = cv.getContext('2d');
    if (!this._stars) this._init();
    this._last = performance.now();
    const step = ts => {
      if (!this._raf) return;
      const dt = Math.min((ts - this._last) / 1000, 0.05);
      this._last = ts;
      this._t   += dt;
      this._draw(dt);
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _init() {
    const { W, H } = this;
    const PI2 = Math.PI * 2;
    this._stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * W,  y: Math.random() * H,
      sz:  0.5 + Math.random() * 2.2,
      bop: 0.3 + Math.random() * 0.7,
      twk: 0.6 + Math.random() * 2.4,
      ph:  Math.random() * PI2,
      spd: 0.004 + Math.random() * 0.038,
    }));
    this._asteroids = Array.from({ length: 7 }, (_, i) => {
      const nv    = 5 + (Math.random() * 4 | 0);
      const sz    = 8  + Math.random() * 18;
      const verts = Array.from({ length: nv }, (_, j) => {
        const a = (j / nv) * PI2;
        const r = sz * (0.62 + 0.38 * Math.random());
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      const orange = i < 3;
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 11,
        verts, rot: Math.random() * PI2,
        rotV: (Math.random() - 0.5) * 0.9,
        fill: orange
          ? `rgba(${170 + (Math.random() * 60 | 0)},${60 + (Math.random() * 40 | 0)},0,0.80)`
          : `rgba(${100 + (Math.random() * 50 | 0)},${100 + (Math.random() * 50 | 0)},${120 + (Math.random() * 55 | 0)},0.80)`,
        stroke: orange ? 'rgba(220,110,20,0.55)' : 'rgba(140,140,160,0.50)',
      };
    });
  }

  _draw(dt) {
    const { _ctx: ctx, W, H, _t: t } = this;
    const PI2 = Math.PI * 2;

    // ── Couche 0 : fond ──────────────────────────────────────
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // ── Couche 1 : nébuleuse (4 gradients radiaux pulsants) ──
    [
      { x: W * 0.28, y: H * 0.28, r: W * 0.65, c: [80, 0, 130],   ph: 0.0, sp: 0.22 },
      { x: W * 0.72, y: H * 0.15, r: W * 0.50, c: [0,  22, 110],  ph: 2.1, sp: 0.17 },
      { x: W * 0.44, y: H * 0.65, r: W * 0.55, c: [110, 0, 60],   ph: 4.2, sp: 0.19 },
      { x: W * 0.14, y: H * 0.78, r: W * 0.42, c: [28,  0, 88],   ph: 1.0, sp: 0.14 },
    ].forEach(n => {
      const a = 0.07 + 0.04 * Math.sin(t * n.sp + n.ph);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(${n.c[0]},${n.c[1]},${n.c[2]},${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });

    // ── Couche 2 : étoiles (parallaxe + scintillement) ───────
    this._stars.forEach(s => {
      s.x -= s.spd * dt * 1000;
      if (s.x < -4) s.x = W + 4;
      const op = Math.max(0, s.bop * (0.5 + 0.5 * Math.sin(t * s.twk + s.ph)));
      ctx.save();
      ctx.globalAlpha = op;
      if (s.sz > 1.5) {
        ctx.fillStyle   = '#ffffff';
        ctx.shadowColor = '#aaddff';
        ctx.shadowBlur  = s.sz * 2.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, PI2); ctx.fill();
        ctx.shadowBlur  = 0;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, s.sz, s.sz);
      }
      ctx.restore();
    });

    // ── Couche 3 : planète enflammée (bas-droite) ────────────
    const pcx = W * 0.84, pcy = H * 1.08, R = H * 0.42;

    // Halo atmosphère
    const atmo = ctx.createRadialGradient(pcx, pcy, R * 0.72, pcx, pcy, R * 1.35);
    atmo.addColorStop(0,    'rgba(255,90,0,0.30)');
    atmo.addColorStop(0.35, 'rgba(255,45,0,0.13)');
    atmo.addColorStop(0.75, 'rgba(180,15,0,0.05)');
    atmo.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = atmo;
    ctx.beginPath(); ctx.arc(pcx, pcy, R * 1.35, 0, PI2); ctx.fill();

    // Sphère clippée
    ctx.save();
    ctx.beginPath(); ctx.arc(pcx, pcy, R, 0, PI2); ctx.clip();

    // Gradient lave de base
    const lava = ctx.createRadialGradient(pcx - R * 0.18, pcy - R * 0.16, 0, pcx, pcy, R);
    lava.addColorStop(0,    '#FFBB00');
    lava.addColorStop(0.32, '#FF6600');
    lava.addColorStop(0.68, '#DD1800');
    lava.addColorStop(1,    '#660000');
    ctx.fillStyle = lava;
    ctx.fillRect(pcx - R, pcy - R, R * 2, R * 2);

    // Blobs de turbulence
    for (let i = 0; i < 8; i++) {
      const a  = t * (0.055 + i * 0.007) + i * PI2 / 8;
      const bx = pcx + Math.cos(a) * R * 0.40;
      const by = pcy + Math.sin(a * 0.73) * R * 0.30;
      const br = R * (0.13 + 0.09 * Math.sin(t * 0.11 + i * 0.8));
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0,    'rgba(255,185,0,0.38)');
      bg.addColorStop(0.55, 'rgba(255,95,0,0.12)');
      bg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, PI2); ctx.fill();
    }

    // Taches sombres (rotation simulée)
    for (let i = 0; i < 5; i++) {
      const a  = t * 0.04 + i * PI2 / 5;
      const sx = pcx + Math.cos(a) * R * 0.46;
      const sy = pcy + Math.sin(a * 0.62) * R * 0.33;
      const sr = R * (0.075 + 0.038 * Math.sin(t * 0.16 + i));
      ctx.fillStyle = 'rgba(70,4,0,0.30)';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, PI2); ctx.fill();
    }
    ctx.restore(); // fin clip sphère

    // Contour lumineux
    ctx.beginPath(); ctx.arc(pcx, pcy, R, 0, PI2);
    ctx.strokeStyle = 'rgba(255,100,20,0.30)'; ctx.lineWidth = 2.5; ctx.stroke();

    // Anneaux diagonaux
    ctx.save(); ctx.translate(pcx, pcy);
    [
      { rx: R * 1.42, ry: R * 0.13, ang: -0.18, col: 'rgba(255,135,30,0.22)', lw: 14 },
      { rx: R * 1.72, ry: R * 0.09, ang: -0.18, col: 'rgba(255,80,10,0.13)',  lw:  9 },
    ].forEach(ring => {
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx, ring.ry, ring.ang, 0, PI2);
      ctx.strokeStyle = ring.col; ctx.lineWidth = ring.lw; ctx.stroke();
    });
    ctx.restore();

    // ── Couche 4 : astéroïdes ────────────────────────────────
    this._asteroids.forEach(ast => {
      ast.x   += ast.vx   * dt;
      ast.y   += ast.vy   * dt;
      ast.rot += ast.rotV * dt;
      if (ast.x < -60) ast.x = W + 60;
      if (ast.x > W + 60) ast.x = -60;
      if (ast.y < -60) ast.y = H + 60;
      if (ast.y > H + 60) ast.y = -60;

      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.rotate(ast.rot);
      ctx.beginPath();
      ctx.moveTo(ast.verts[0][0], ast.verts[0][1]);
      for (let vi = 1; vi < ast.verts.length; vi++) ctx.lineTo(ast.verts[vi][0], ast.verts[vi][1]);
      ctx.closePath();
      ctx.fillStyle = ast.fill;   ctx.fill();
      ctx.strokeStyle = ast.stroke; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    });
  }
}

// ============================================================
// SECTION 11c-bis — CLASSES BOSS (Sentinelle, Chasseur, Titan)
// ============================================================

class BossBase {
  constructor(x, y, hp, W) {
    this.x = x; this.y = y;
    this.hp = hp; this.maxHp = hp;
    this.W = W;
    this.w = 120; this.h = 80;
    this.dead = false;
    this.dying = false;
    this.deathTimer = 0;
    this.deathDuration = 2.5;
    this.isBoss = true;
    this.isFinal = false;
    this.color = '#ff6600';
    this.type = 'boss';
    this.score = 0;
    this.dropChance = 1.0;
    this.flashTimer = 0;
    this.t = 0;
    this._rewardGiven = false;
    // Seuils de drop de powerups (en ratio HP/maxHP) — combat boss long
    this._dropThresholds = [0.75, 0.50, 0.25];
  }

  get hitbox() {
    return { x: this.x - this.w * 0.42, y: this.y - this.h * 0.42, w: this.w * 0.84, h: this.h * 0.84 };
  }

  hit() {
    if (this.dying) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.flashTimer = 0.08;
    if (this.hp <= 0) {
      this.dying = true;
      this.deathTimer = this.deathDuration;
    }
    return false;
  }

  update(dt, W, H, enemyBullets, player, particles) {
    this.t += dt;
    if (this.dying) {
      this.deathTimer -= dt;
      if (particles && Math.random() < 0.55) {
        const ox = (Math.random() - 0.5) * this.w * 0.9;
        const oy = (Math.random() - 0.5) * this.h * 0.9;
        spawnExplosion(particles, this.x + ox, this.y + oy, this.color, 12, true);
      }
      if (this.deathTimer <= 0) this.dead = true;
      return;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;
    this._move(dt, W, H);
    this._attack(dt, enemyBullets, player, W, H);
  }

  _move(dt, W, H) {}
  _attack(dt, enemyBullets, player, W, H) {}

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dying) {
      const p = Math.max(0, this.deathTimer / this.deathDuration);
      ctx.globalAlpha = p * p;
      if (Math.random() < 0.6) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 60; }
    } else if (this.flashTimer > 0) {
      ctx.filter = 'brightness(4) saturate(0)';
    }
    this._drawBody(ctx);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
    if (!this.dying) this._drawHPBar(ctx);
  }

  _drawBody(ctx) {}

  _drawHPBar(ctx) {
    const barW = this.w * 1.5;
    const barH = 9;
    const barX = this.x - barW / 2;
    const barY = this.y + this.h / 2 + 16;
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.save();
    // Fond
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    // Remplissage couleur
    let col;
    if (ratio > 0.5) col = '#ff3333';
    else if (ratio > 0.2) col = '#ff7700';
    else col = Math.floor(Date.now() / 180) % 2 === 0 ? '#ff0000' : '#ffaa00';
    ctx.fillStyle = col;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    // Texte
    ctx.font = 'bold 8px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.fillText(`${this.bossName || 'BOSS'} — ${this.hp} / ${this.maxHp} PV`, this.x, barY - 4);
    ctx.restore();
  }
}

// ── Mini-Boss Sentinelle ──────────────────────────────────────
class BossSentinelle extends BossBase {
  constructor(x, y, hp, W) {
    super(x, y, hp, W);
    this.bossName = 'SENTINELLE';
    this.w = 148; this.h = 84;
    this.score = hp * 10;
    this.color = '#778899';
    this.vx = 58;
    this.targetY = 145;
    this.fireTimer = 1.5;
    this.specialTimer = 8.0;
    this.patternIdx = 0;
    this.burstQueue = [];
  }

  _move(dt, W) {
    this.x += this.vx * dt;
    if (this.x < this.w / 2 + 18) { this.x = this.w / 2 + 18; this.vx = Math.abs(this.vx); }
    if (this.x > W - this.w / 2 - 18) { this.x = W - this.w / 2 - 18; this.vx = -Math.abs(this.vx); }
    // Léger wobble vertical pour casser la répétition (sans changer la difficulté)
    const ty = this.targetY + Math.sin(this.t * 0.7) * 16;
    this.y += (ty - this.y) * 1.4 * dt;
  }

  _attack(dt, enemyBullets) {
    // Décharge des tirs en rafale différée
    for (let i = this.burstQueue.length - 1; i >= 0; i--) {
      this.burstQueue[i].t -= dt;
      if (this.burstQueue[i].t <= 0) {
        const b = this.burstQueue[i];
        enemyBullets.push(new Bullet(b.x, b.y, b.vx, b.vy, b.color, false));
        this.burstQueue.splice(i, 1);
      }
    }

    // Feu simple régulier
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 1.5;
      enemyBullets.push(new Bullet(this.x, this.y + this.h / 2 + 4, 0, CFG.ENEMY_BULLET_SPEED, '#aaddff', false));
    }

    // Attaque spéciale — alterne entre 3 patterns (éventail / rafale / couronne)
    this.specialTimer -= dt;
    if (this.specialTimer <= 0) {
      this.specialTimer = 8.0;
      const spd = CFG.ENEMY_BULLET_SPEED;
      const p = this.patternIdx++ % 3;
      if (p === 0) {
        // Eventail 5 balles devant
        for (let i = 0; i < 5; i++) {
          const a = (i - 2) * 24 * Math.PI / 180;
          enemyBullets.push(new Bullet(
            this.x, this.y + this.h / 2,
            Math.sin(a) * spd, Math.cos(a) * spd, '#ff9900', false
          ));
        }
      } else if (p === 1) {
        // Rafale 3 tirs droits depuis les 2 canons latéraux
        [-this.w * 0.42, this.w * 0.42].forEach(ox => {
          for (let r = 0; r < 3; r++) {
            this.burstQueue.push({
              t: r * 0.12,
              x: this.x + ox, y: this.y + this.h / 2,
              vx: 0, vy: spd, color: '#ffcc44'
            });
          }
        });
      } else {
        // Couronne tournante 8 balles en arc avant
        for (let i = 0; i < 8; i++) {
          const a = (i - 3.5) * 16 * Math.PI / 180 + Math.sin(this.t * 0.4) * 0.3;
          enemyBullets.push(new Bullet(
            this.x, this.y + this.h / 2,
            Math.sin(a) * spd * 0.85, Math.cos(a) * spd * 0.85,
            '#ffaaaa', false
          ));
        }
      }
    }
  }

  _drawBody(ctx) {
    const w = this.w, h = this.h, t = this.t;
    // Coque principale
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#445566'); g.addColorStop(1, '#1a2a38');
    ctx.fillStyle = g;
    ctx.shadowColor = '#6699cc'; ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h / 2);
    ctx.lineTo( w * 0.34, -h / 2);
    ctx.lineTo( w * 0.38,  h * 0.38);
    ctx.lineTo(-w * 0.38,  h * 0.38);
    ctx.closePath(); ctx.fill();
    // Ailes latérales
    ctx.fillStyle = '#334455';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38,  h * 0.38);
    ctx.lineTo(-w * 0.50,  h * 0.48);
    ctx.lineTo(-w * 0.48, -h * 0.12);
    ctx.lineTo(-w * 0.34, -h / 2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo( w * 0.38,  h * 0.38);
    ctx.lineTo( w * 0.50,  h * 0.48);
    ctx.lineTo( w * 0.48, -h * 0.12);
    ctx.lineTo( w * 0.34, -h / 2);
    ctx.closePath(); ctx.fill();
    // Canon gauche
    ctx.fillStyle = '#556677';
    ctx.fillRect(-w * 0.50, -h * 0.08, w * 0.14, h * 0.38);
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(-w * 0.50 - 3, h * 0.22, 12, 18);
    // Canon droit
    ctx.fillRect( w * 0.36, -h * 0.08, w * 0.14, h * 0.38);
    ctx.fillRect( w * 0.36 + w * 0.14 - 9, h * 0.22, 12, 18);
    // Moteurs
    ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(0,160,255,${0.55 + 0.35 * Math.sin(t * 9)})`;
    ctx.fillRect(-w * 0.28, h * 0.32, w * 0.56, h * 0.1);
    // Capteur central
    ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 14;
    ctx.fillStyle = `rgba(255,50,50,${0.75 + 0.25 * Math.sin(t * 5.5)})`;
    ctx.beginPath(); ctx.arc(0, -h * 0.1, 9, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── Mini-Boss Chasseur ───────────────────────────────────────
class BossChasseur extends BossBase {
  constructor(x, y, hp, W) {
    super(x, y, hp, W);
    this.bossName = 'CHASSEUR';
    this.w = 162; this.h = 114;
    this.score = hp * 10;
    this.color = '#cc1122';
    this.baseX = x;
    this.baseY = 155;
    this.vx = 44;
    this.fireTimer = 1.0;
    this.chargeTimer = 6.0;
    this.charging = false;
    this.chargeVx = 0; this.chargeVy = 0;
    this.chargePhase = 0;
    this.chargeElapsed = 0;
  }

  _move(dt, W) {
    if (this.charging) {
      this.chargeElapsed += dt;
      const spd = this.chargeElapsed < 0.45 ? 8 : (this.chargeElapsed < 0.9 ? -5 : 0);
      if (spd !== 0) {
        this.x += this.chargeVx * Math.abs(spd) * dt;
        this.y += this.chargeVy * Math.abs(spd) * dt;
      }
      if (this.chargeElapsed > 1.1) { this.charging = false; }
      this.x = clamp(this.x, this.w / 2, W - this.w / 2);
      this.y = clamp(this.y, this.h / 2 + 10, W * 0.5);
      return;
    }
    const sp = this.hp < this.maxHp * 0.5 ? 1.5 : 1.0;
    this.baseX += this.vx * sp * dt;
    if (this.baseX < this.w / 2 + 18) { this.baseX = this.w / 2 + 18; this.vx = Math.abs(this.vx); }
    if (this.baseX > W - this.w / 2 - 18) { this.baseX = W - this.w / 2 - 18; this.vx = -Math.abs(this.vx); }
    this.x = this.baseX;
    this.y = this.baseY + Math.sin(this.t * 1.3) * 42;
  }

  _attack(dt, enemyBullets, player) {
    const sp = this.hp < this.maxHp * 0.5 ? 0.75 : 1.0;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 1.0 * sp;
      const spd = CFG.ENEMY_BULLET_SPEED * 1.15;
      enemyBullets.push(new Bullet(this.x - 22, this.y + this.h / 2, -18, spd, '#ff2244', false));
      enemyBullets.push(new Bullet(this.x + 22, this.y + this.h / 2,  18, spd, '#ff2244', false));
    }
    this.chargeTimer -= dt;
    if (this.chargeTimer <= 0 && !this.charging && player) {
      this.chargeTimer = 6.0;
      this.charging = true;
      this.chargeElapsed = 0;
      const dx = player.x - this.x, dy = player.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.chargeVx = (dx / d) * 115;
      this.chargeVy = (dy / d) * 115;
    }
  }

  _drawBody(ctx) {
    const w = this.w, h = this.h, t = this.t;
    const rage = this.hp < this.maxHp * 0.5;
    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = rage ? 32 : 18;
    // Corps en croix — barre verticale
    const cg = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
    cg.addColorStop(0, '#88000a'); cg.addColorStop(0.5, '#cc1a1a'); cg.addColorStop(1, '#330005');
    ctx.fillStyle = cg;
    ctx.fillRect(-w * 0.17, -h / 2, w * 0.34, h);
    // Barre horizontale
    ctx.fillRect(-w / 2, -h * 0.22, w, h * 0.44);
    // Pointe gauche
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.06); ctx.lineTo(-w * 0.55, 0); ctx.lineTo(-w / 2, h * 0.06);
    ctx.closePath(); ctx.fill();
    // Pointe droite
    ctx.beginPath();
    ctx.moveTo( w / 2, -h * 0.06); ctx.lineTo( w * 0.55, 0); ctx.lineTo( w / 2, h * 0.06);
    ctx.closePath(); ctx.fill();
    // Core pulsant
    const pr = rage ? 15 + 6 * Math.abs(Math.sin(t * 9)) : 11 + 4 * Math.sin(t * 5);
    ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255,${rage ? 0 : 55},0,${0.82 + 0.18 * Math.sin(t * 7)})`;
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
    // Sortie moteur
    ctx.fillStyle = `rgba(255,110,0,${0.55 + 0.4 * Math.sin(t * 13)})`;
    ctx.fillRect(-w * 0.11, h * 0.38, w * 0.22, h * 0.13);
    ctx.shadowBlur = 0;
  }
}

// ── Boss Final Titan ──────────────────────────────────────────
class BossTitan extends BossBase {
  constructor(x, y, hp, W) {
    super(x, y, hp, W);
    this.bossName = 'TITAN';
    this.w = Math.round(W * 0.42);
    this.h = Math.round(this.w * 0.58);
    this.score = hp * 8;
    this.color = '#FFD700';
    this.isFinal = true;
    this.vx = 28;
    this.dirTimer = 3.2;
    this.fireTimer = 1.6;
    this.specialTimer = 15.0;
    this.laserWarning = false;
    this.laserActive  = false;
    this.laserTimer   = 0;
    this.laserX       = W / 2;
    this.laserW       = 50;
    this.deathDuration = 3.5;
    this._deathSoundPlayed = false;
  }

  get phase() {
    const r = this.hp / this.maxHp;
    return r > 0.6 ? 1 : r > 0.3 ? 2 : 3;
  }

  _move(dt, W) {
    this.x += this.vx * dt;
    if (this.x < this.w / 2 + 8)  { this.x = this.w / 2 + 8;  this.vx =  Math.abs(this.vx); }
    if (this.x > W - this.w / 2 - 8) { this.x = W - this.w / 2 - 8; this.vx = -Math.abs(this.vx); }
    this.dirTimer -= dt;
    if (this.dirTimer <= 0) {
      this.dirTimer = 3.2 - (this.phase === 3 ? 1.0 : 0);
      const spd = 24 + this.phase * 10;
      this.vx = (Math.random() < 0.5 ? 1 : -1) * spd;
    }
    const ty = 100 + (this.phase - 1) * 25;
    this.y += (ty - this.y) * 0.6 * dt;
  }

  _attack(dt, enemyBullets, player, W) {
    // Laser spécial
    this.specialTimer -= dt;
    if (this.specialTimer <= 0 && !this.laserWarning && !this.laserActive) {
      this.specialTimer = 15.0;
      this.laserWarning = true;
      this.laserTimer   = 2.0;
      this.laserX = player ? clamp(player.x, 35, W - 35) : W / 2;
      this.laserW = 44 + this.phase * 12;
    }
    if (this.laserWarning) {
      this.laserTimer -= dt;
      if (this.laserTimer <= 0) {
        this.laserWarning = false;
        this.laserActive  = true;
        this.laserTimer   = 0.45;
      }
    } else if (this.laserActive) {
      this.laserTimer -= dt;
      if (this.laserTimer <= 0) this.laserActive = false;
    }
    // Tirs réguliers
    const rate = this.phase === 1 ? 1.6 : this.phase === 2 ? 1.0 : 0.55;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = rate;
      const spd = CFG.ENEMY_BULLET_SPEED * (this.phase >= 2 ? 1.35 : 1.0);
      if (this.phase === 3) {
        const a0 = this.t * 2.1;
        for (let i = 0; i < 4; i++) {
          const a = a0 + i * Math.PI / 2;
          enemyBullets.push(new Bullet(
            this.x, this.y + this.h / 2,
            Math.sin(a) * spd * 0.55,
            Math.abs(Math.cos(a)) * spd + spd * 0.35,
            '#ff4400', false
          ));
        }
      } else {
        const cnt = this.phase === 2 ? 4 : 3;
        const sp2 = this.w * 0.33;
        const offsets = cnt === 3
          ? [-sp2, 0, sp2]
          : [-sp2, -sp2 * 0.35, sp2 * 0.35, sp2];
        offsets.forEach(ox => {
          enemyBullets.push(new Bullet(
            this.x + ox, this.y + this.h / 2,
            ox * 0.6, spd, '#ffbb00', false
          ));
        });
      }
    }
  }

  update(dt, W, H, enemyBullets, player, particles) {
    this.t += dt;
    if (this.dying) {
      this.deathTimer -= dt;
      if (!this._deathSoundPlayed) { this._deathSoundPlayed = true; }

      // Vague 2 à ~2,3 s restantes
      if (particles && this.deathTimer <= 2.3 && !this._wave2Done) {
        this._wave2Done = true;
        for (let i = 0; i < 40; i++) {
          const p = _acquireFX();
          const a = Math.random() * Math.PI * 2;
          const s = rand(350, 600);
          const cols = _BOOM_COLORS.titan;
          p.reset(this.x + rand(-this.w*0.4, this.w*0.4),
                  this.y + rand(-this.h*0.4, this.h*0.4),
                  Math.cos(a)*s, Math.sin(a)*s,
                  cols[randInt(0, cols.length-1)], rand(1.2, 2.5),
                  rand(5, 12), 1.9, true, Math.random()<0.35?'rect':'circle');
          particles.push(p);
        }
        [90, 155].forEach((r, i) =>
          particles.push(new ShockWave(this.x, this.y, r, 'rgba(255,215,0,0.85)', 0.48 + i*0.16))
        );
      }

      // Vague 3 à ~1,0 s restantes
      if (particles && this.deathTimer <= 1.0 && !this._wave3Done) {
        this._wave3Done = true;
        for (let i = 0; i < 40; i++) {
          const p = _acquireFX();
          const a = Math.random() * Math.PI * 2;
          const s = rand(200, 480);
          const cols = _BOOM_COLORS.titan;
          p.reset(this.x + rand(-this.w*0.5, this.w*0.5),
                  this.y + rand(-this.h*0.5, this.h*0.5),
                  Math.cos(a)*s, Math.sin(a)*s,
                  cols[randInt(0, cols.length-1)], rand(0.8, 2.0),
                  rand(4, 10), 2.2, false, Math.random()<0.4?'rect':'circle');
          particles.push(p);
        }
        particles.push(new ShockWave(this.x, this.y, 280, 'rgba(255,255,255,0.95)', 0.6));
      }

      // Petites explosions continues
      if (particles && Math.random() < 0.55) {
        const ox = (Math.random() - 0.5) * this.w;
        const oy = (Math.random() - 0.5) * this.h;
        spawnExplosion(particles, this.x + ox, this.y + oy, this.color, 8, true);
      }

      if (this.deathTimer <= 0) this.dead = true;
      return;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;
    this._move(dt, W, H);
    this._attack(dt, enemyBullets, player, W);
  }

  drawLaserEffect(ctx, H) {
    if (this.laserWarning) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.016);
      ctx.save();
      ctx.fillStyle = `rgba(255,0,0,${0.10 + 0.08 * pulse})`;
      ctx.fillRect(this.laserX - this.laserW / 2, 0, this.laserW, H);
      ctx.strokeStyle = `rgba(255,60,60,${0.45 + 0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(this.laserX - this.laserW / 2, 0, this.laserW, H);
      ctx.setLineDash([]);
      ctx.restore();
    } else if (this.laserActive) {
      ctx.save();
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(255,90,0,0.88)';
      ctx.fillRect(this.laserX - this.laserW / 2, 0, this.laserW, H);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(this.laserX - 5, 0, 10, H);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  _drawBody(ctx) {
    const w = this.w, h = this.h, t = this.t, ph = this.phase;
    const glow = ph === 3 ? 38 + 14 * Math.sin(t * 8) : 22;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = glow;

    // Coque principale trapézoïdale
    const hg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    hg.addColorStop(0, '#886600'); hg.addColorStop(0.3, '#FFD700');
    hg.addColorStop(0.65, '#BB8800'); hg.addColorStop(1, '#775500');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-w * 0.44,  h * 0.46);
    ctx.lineTo( w * 0.44,  h * 0.46);
    ctx.lineTo( w * 0.50, -h * 0.12);
    ctx.lineTo( w * 0.30, -h * 0.50);
    ctx.lineTo(-w * 0.30, -h * 0.50);
    ctx.lineTo(-w * 0.50, -h * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();

    // Ailes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#442200';
    [[-1], [1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.44,  h * 0.46);
      ctx.lineTo(s * w * 0.62,  h * 0.56);
      ctx.lineTo(s * w * 0.58,  h * 0.08);
      ctx.lineTo(s * w * 0.50, -h * 0.12);
      ctx.closePath(); ctx.fill();
    });

    // 4 canons
    const cnt = ph === 1 ? 3 : 4;
    const sp = w * 0.34;
    const offs = cnt === 3 ? [-sp, 0, sp] : [-sp, -sp * 0.36, sp * 0.36, sp];
    offs.forEach(ox => {
      ctx.fillStyle = ph >= 2 ? '#aa2200' : '#334455';
      ctx.shadowColor = ph >= 2 ? '#ff4400' : '#335566'; ctx.shadowBlur = 10;
      ctx.fillRect(ox - 7, h * 0.28, 14, h * 0.22);
      ctx.fillStyle = ph >= 2 ? '#ff5500' : '#556677';
      ctx.fillRect(ox - 6, h * 0.46, 12, 7);
    });
    ctx.shadowBlur = 0;

    // Symbole crâne (centre)
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = ph === 3 ? 22 + 10 * Math.sin(t * 6) : 10;
    ctx.fillStyle = `rgba(180,0,0,${0.68 + 0.32 * Math.sin(t * 3.2)})`;
    ctx.beginPath(); ctx.arc(0, -h * 0.06, w * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-w * 0.032, -h * 0.08, w * 0.026, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( w * 0.032, -h * 0.08, w * 0.026, 0, Math.PI * 2); ctx.fill();
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * w * 0.031 - w * 0.011, -h * 0.02, w * 0.022, h * 0.032);

    // Moteurs arrière
    for (let i = -2; i <= 2; i++) {
      const ex = i * w * 0.17;
      const pls = 0.5 + 0.5 * Math.sin(t * 11 + i * 1.6);
      ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 16;
      ctx.fillStyle = `rgba(0,140,255,${0.5 + 0.45 * pls})`;
      ctx.beginPath(); ctx.ellipse(ex, h * 0.44, w * 0.055, h * 0.065, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

function createBoss(type, x, y, hp, W) {
  switch (type) {
    case 'chasseur':   return new BossChasseur(x, y, hp, W);
    case 'titan':      return new BossTitan(x, y, hp, W);
    default:           return new BossSentinelle(x, y, hp, W); // sentinelle + fallback
  }
}

// ============================================================
// SECTION 11d — GESTIONNAIRE DE PROGRESSION HISTOIRE
// ============================================================
class StoryManager {
  constructor() {
    const saved   = JSON.parse(localStorage.getItem('starblast_story') || '{"unlocked":1,"stars":[]}');
    this.unlocked = Math.max(1, saved.unlocked || 1);
    this.stars    = saved.stars || [];
  }

  getStars(levelId) { return this.stars[levelId - 1] || 0; }

  completeLevel(levelId, starsEarned) {
    const prev = this.getStars(levelId);
    if (starsEarned > prev) this.stars[levelId - 1] = starsEarned;
    if (levelId < 10 && levelId >= this.unlocked) this.unlocked = levelId + 1;
    this._save();
  }

  _save() {
    localStorage.setItem('starblast_story', JSON.stringify({ unlocked: this.unlocked, stars: this.stars }));
  }
}

// ============================================================
// SECTION 11e — CONTRÔLEUR DE VAGUES (Mode Histoire)
// ============================================================
class StoryWaveController {
  constructor(levelDef, canvasW) {
    this.waves           = levelDef.waves;
    this.W               = canvasW;
    this.waveIdx         = 0;
    this.timer           = 0;
    this.queue           = [];
    this.betweenTimer    = 0;
    this.bossSpawned     = false;
    this.done            = false;
    this.bossAlertTimer  = 0;   // countdown avant spawn boss
    this.needsBossAlert  = false; // signal audio vers Game
    this._pendingBoss    = null;
  }

  get waveNum()    { return this.waveIdx + 1; }
  get totalWaves() { return this.waves.length; }

  start() { this._buildQueue(0); }

  _buildQueue(idx) {
    this.waveIdx     = idx;
    this.timer       = 0;
    this.bossSpawned = false;
    const def        = this.waves[idx];
    const W          = this.W;
    const entries    = Object.entries(def.types);
    const totalW     = entries.reduce((s, [, w]) => s + w, 0);
    const queue      = [];

    for (let i = 0; i < def.count; i++) {
      // Tirage du type ennemi
      let r = Math.random() * totalW, type = entries[0][0];
      for (const [t, w] of entries) { r -= w; if (r <= 0) { type = t; break; } }

      // Position et délai selon formation
      let x, delay;
      if (def.formation === 'v') {
        const side = (i % 2 === 0 ? 1 : -1);
        const rank = Math.floor(i / 2);
        x     = clamp(W / 2 + side * rank * 44, 30, W - 30);
        delay = rank * 0.38;
      } else if (def.formation === 'sides') {
        x     = (i % 2 === 0) ? 30 : W - 30;
        delay = Math.floor(i / 2) * 0.42;
      } else {
        x     = 36 + Math.random() * (W - 72);
        delay = i * 0.36;
      }
      queue.push({ type, x, delay, speedMult: def.speed, stealth: !!def.stealth });
    }
    this.queue = queue.sort((a, b) => a.delay - b.delay);
  }

  update(dt, enemies) {
    if (this.done) return;

    if (this.betweenTimer > 0) {
      this.betweenTimer -= dt;
      return;
    }

    // Spawn depuis la file
    this.timer += dt;
    while (this.queue.length > 0 && this.queue[0].delay <= this.timer) {
      const s  = this.queue.shift();
      const sc = Math.max(0, (s.speedMult * 68 - 50) / 18);
      const e  = new Enemy(s.type, s.x, -40, sc);
      if (s.stealth) e.stealth = true;
      enemies.push(e);
    }

    // Alerte boss en cours → attendre fin du countdown
    if (this.bossAlertTimer > 0) {
      this.bossAlertTimer -= dt;
      if (this.bossAlertTimer <= 0 && this._pendingBoss) {
        this.bossSpawned = true;
        enemies.push(createBoss(this._pendingBoss.type, this.W / 2, -80, this._pendingBoss.hp, this.W));
        this._pendingBoss = null;
      }
      return;
    }

    // Fin de vague : file vide ET plus d'ennemis à l'écran
    if (this.queue.length === 0 && enemies.length === 0) {
      const def = this.waves[this.waveIdx];
      if (def.boss && !this.bossSpawned) {
        // Déclenchement de l'alerte boss (2,5 s)
        this._pendingBoss   = def.boss;
        this.bossAlertTimer = 2.5;
        this.needsBossAlert = true;
      } else {
        const next = this.waveIdx + 1;
        if (next >= this.waves.length) {
          this.done = true;
        } else {
          this._buildQueue(next);
          this.betweenTimer = 2.5;
        }
      }
    }
  }

  get bossAlertActive() { return this.bossAlertTimer > 0; }
}

// ============================================================
// SECTION 12 — MOTEUR DE JEU PRINCIPAL
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this.W = CFG.CANVAS_W;
    this.H = CFG.CANVAS_H;

    this.audio       = new AudioManager();
    this.ui          = new UIManager();
    this.input       = new InputManager();
    this.stars       = new StarField(this.W, this.H);
    this.wave        = new WaveManager();
    this.shop        = new ShopManager();
    this.progression = new ProgressionManager();
    this.story       = new StoryManager();
    this.titleScene  = new TitleScene(this.W, this.H);

    this.player       = null;
    this.enemies      = [];
    this.playerBullets = [];
    this.enemyBullets  = [];
    this.particles    = [];
    this.powerups     = [];
    this._shakeTimer     = 0;
    this._shakeIntensity = 0;

    // Contrôleur de vague histoire (actif seulement en mode histoire)
    this.storyCtrl   = null;
    this.storyLevelId = 0;

    // États : 'start' | 'playing' | 'paused' | 'gameover'
    //         'story-select' | 'story-playing' | 'story-victory' | 'story-failed'
    this.state     = 'start';
    this._playMode = 'survival'; // 'survival' | 'story'
    this.highscore = parseInt(localStorage.getItem('starblast_hs')    || '0', 10);
    this.coins     = parseInt(localStorage.getItem('starblast_coins') || '0', 10);
    this.lastTime  = 0;

    this._setupCanvas();
    this._bindUI();
    this._detectMobile();

    this.ui.updateStartHS(this.highscore);
    this.ui.updateStartCoins(this.coins);
    this.ui.updateCoins(this.coins);
    this.ui.updateXPLevel(this.progression.level);
    this.ui.updateXPBar(this.progression.level, this.progression.progressRatio);
    this.ui.updateLegendBadge(this.progression.level);
    this.ui.showScreen('start');
    this.titleScene.start();

    // Auto start/stop titleScene quand l'écran d'accueil est affiché/masqué
    const _startEl = document.getElementById('screen-start');
    if (_startEl) {
      new MutationObserver(() => {
        if (_startEl.classList.contains('active')) this.titleScene.start();
        else this.titleScene.stop();
      }).observe(_startEl, { attributes: true, attributeFilter: ['class'] });
    }

    // Démarre la boucle de rendu (étoiles animées sur les écrans de menu)
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Configuration responsive du canvas ──────────────────
  _setupCanvas() {
    const resize = () => {
      const maxW    = window.innerWidth;
      const maxH    = window.innerHeight - 42; // espace pour la bannière pub
      const scale   = Math.min(maxW / this.W, maxH / this.H, 1.6);
      const displayW = Math.round(this.W * scale);
      const displayH = Math.round(this.H * scale);

      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      this.canvas.style.width  = `${displayW}px`;
      this.canvas.style.height = `${displayH}px`;

      const c = document.getElementById('game-container');
      if (c) { c.style.width = `${displayW}px`; c.style.height = `${displayH}px`; }
    };
    resize();
    window.addEventListener('resize', resize);
  }

  // ── Détection mobile ─────────────────────────────────────
  _detectMobile() {
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        'ontouchstart' in window || navigator.maxTouchPoints > 1) {
      document.body.classList.add('is-mobile');
    }
  }

  // ── Binding UI ───────────────────────────────────────────
  _bindUI() {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    on('btn-start',     'click', () => { this._playMode = 'survival'; this._startGame(); });
    on('btn-replay',    'click', () => { this._playMode = 'survival'; this._startGame(); });
    on('btn-go-menu',   'click', () => { this.state = 'start'; this.ui.showScreen('start'); });
    on('btn-resume',    'click', () => this._togglePause());
    on('btn-quit', 'click', () => {
      if (this._playMode === 'story') { this._openStorySelect(); }
      else { this.state = 'start'; this.ui.showScreen('start'); }
    });

    // ── Mode Histoire ─────────────────────────────────────
    on('btn-open-story',   'click', () => this._openStorySelect());
    on('btn-story-back',   'click', () => { this.state = 'start'; this.ui.showScreen('start'); });
    on('btn-retry-story',  'click', () => this._startStoryLevel(this.storyLevelId));
    on('btn-story-select', 'click', () => this._openStorySelect());
    on('btn-story-select2','click', () => this._openStorySelect());
    on('btn-next-level',   'click', () => {
      const next = this.storyLevelId + 1;
      if (next <= 10 && next <= this.story.unlocked) this._startStoryLevel(next);
      else this._openStorySelect();
    });
    on('btn-final-back',   'click', () => { this.state = 'start'; this.ui.showScreen('start'); });

    document.addEventListener('starblast-story-play', ({ detail: { id } }) => {
      this._startStoryLevel(id);
    });

    // ── Boutique ─────────────────────────────────────────
    on('btn-open-shop', 'click', () => {
      this.shop.refresh(this.coins);
      this.ui.showScreen('shop');
    });

    on('btn-shop-back', 'click', () => {
      if (this.shop._shopAnimId) { cancelAnimationFrame(this.shop._shopAnimId); this.shop._shopAnimId = null; }
      this.ui.showScreen('start');
    });

    // Onglets de la boutique
    document.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shop._tab = btn.dataset.tab;
        this.shop._rarityFilter = 'all';
        this.shop.refresh(this.coins);
      });
    });

    // Filtres de rareté
    document.querySelectorAll('.rarity-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shop._rarityFilter = btn.dataset.rarity;
        this.shop.refresh(this.coins);
      });
    });

    // Achat déclenché par ShopManager via CustomEvent
    document.addEventListener('starblast-shop-buy', ({ detail: { id, price } }) => {
      if (this.coins < price) return;
      this.coins -= price;
      localStorage.setItem('starblast_coins', this.coins.toString());
      this.shop.buy(id);
      this.shop.refresh(this.coins);
      this.ui.updateCoins(this.coins);
      this.ui.updateStartCoins(this.coins);
    });

    // Touche Pause (P / Échap)
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'playing' || this.state === 'paused' || this.state === 'story-playing') {
          this._togglePause();
        }
      }
    });

    // Boutons "Supprimer les pubs"
    ['btn-remove-ads-start', 'btn-remove-ads-go', 'btn-remove-ads-persistent'].forEach(id =>
      on(id, 'click', () => this._showModal())
    );

    on('btn-close-modal', 'click', () => this._hideModal());
    on('btn-stripe',      'click', () => this._launchStripe());

    // Clic en dehors de la modale pour fermer
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) this._hideModal(); });

    // Bombe mobile : le déclenchement est géré par InputManager._bindMobile()
    // (flag `input.bomb` consommé dans _update / _updateStory au frame suivant).
    // Ne PAS ajouter ici un second listener touchstart : cela consommerait
    // deux bombes par tap (une via useBomb() direct, une via input.bomb=true).
  }

  _showModal() { document.getElementById('modal-overlay')?.classList.remove('hidden'); }
  _hideModal() { document.getElementById('modal-overlay')?.classList.add('hidden'); }

  _triggerShake(duration, intensity) {
    if (duration > this._shakeTimer) {
      this._shakeTimer     = duration;
      this._shakeIntensity = intensity;
    }
  }

  _togglePause() {
    if (this.state === 'playing' || this.state === 'story-playing') {
      this._pausedFrom = this.state;
      this.state = 'paused';
      this.ui.showScreen('pause');
    } else if (this.state === 'paused') {
      this.state    = this._pausedFrom || 'playing';
      this.lastTime = performance.now();
      this.ui.hideScreens();
    }
  }

  // ── Intégration Stripe ───────────────────────────────────
  _launchStripe() {
    window.location.href = 'https://buy.stripe.com/test_14A00j5WG8qE1wMaLOdQQ00';
  }

  // ── Démarrer / redémarrer une partie ────────────────────
  _startGame() {
    this.audio.resume();

    this.enemies       = [];
    this.playerBullets = [];
    this.enemyBullets  = [];
    this.particles     = [];
    this.powerups      = [];

    this.player             = new Player(this.W / 2, this.H - 90);
    this.player.skin        = this.shop.equippedSkin;
    this.player.bulletColor = this.shop.getBulletColor();
    this.player.laserType   = this.shop.equippedColor;
    this.wave   = new WaveManager();
    this.wave.start(1, this.W);

    this._playMode = 'survival';
    this.state     = 'playing';
    this.lastTime  = performance.now();

    this.ui.hideScreens();
    this.ui.showLevelNotif(1);
    this.ui.updateHUD(0, 1, CFG.LIVES, this.highscore);
    this.ui.updateXPLevel(this.progression.level);
    this.ui.updateXPBar(this.progression.level, this.progression.progressRatio);
  }

  // ── Mode Histoire : ouvrir la sélection ──────────────────
  _openStorySelect() {
    this.state = 'story-select';
    this.ui.refreshStorySelect(this.story);
    this.ui.showScreen('story-select');
  }

  // ── Mode Histoire : démarrer un niveau ───────────────────
  _startStoryLevel(levelId) {
    this.audio.resume();

    this.enemies        = [];
    this.playerBullets  = [];
    this.enemyBullets   = [];
    this.particles      = [];
    this.powerups       = [];

    this.player             = new Player(this.W / 2, this.H - 90);
    this.player.skin        = this.shop.equippedSkin;
    this.player.bulletColor = this.shop.getBulletColor();
    this.player.laserType   = this.shop.equippedColor;

    this.storyLevelId = levelId;
    const levelDef    = STORY_LEVELS.find(l => l.id === levelId);
    this.storyCtrl    = new StoryWaveController(levelDef, this.W);
    this.storyCtrl.start();

    this._playMode = 'story';
    this.state     = 'story-playing';
    this.lastTime  = performance.now();

    this.ui.hideScreens();
    this.ui.showLevelNotif(levelId);
    this.ui.updateHUD(0, 1, CFG.LIVES, this.highscore);
    this.ui.updateXPLevel(this.progression.level);
    this.ui.updateXPBar(this.progression.level, this.progression.progressRatio);
  }

  // ── Mode Histoire : victoire ──────────────────────────────
  _storyVictory() {
    this.state = 'story-victory';
    const score     = this.player.score;
    const livesLost = CFG.LIVES - this.player.lives;
    const stars     = livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;

    this.story.completeLevel(this.storyLevelId, stars);

    if (score > this.highscore) {
      this.highscore = score;
      localStorage.setItem('starblast_hs', score.toString());
    }

    // Bonus boss (niveaux 8-10)
    const bossBonus = { 8: { coins: 500, xp: 300 }, 9: { coins: 800, xp: 500 }, 10: { coins: 2000, xp: 1000 } };
    const bonus = bossBonus[this.storyLevelId] || { coins: 0, xp: 0 };

    // Déblocage skin Titan sur victoire niveau 10
    if (this.storyLevelId === 10) {
      this.shop.owned.add('titan');
      this.shop._persistOwned();
    }

    const coinsEarned = Math.floor(score / 8) + bonus.coins;
    this.coins += coinsEarned;
    localStorage.setItem('starblast_coins', this.coins.toString());
    this.ui.updateCoins(this.coins);
    this.ui.updateStartCoins(this.coins);
    this.ui.updateStartHS(this.highscore);

    // XP × 2 + bonus boss
    XP_MULTIPLIER = 2;
    const rawXP = Math.floor(score / 5) + bonus.xp;
    const { xpAdded, levelsGained } = this.progression.addXP(rawXP, this.shop);
    XP_MULTIPLIER = 1;

    this.ui.updateXPLevel(this.progression.level);
    this.ui.updateXPBar(this.progression.level, this.progression.progressRatio);
    this.ui.updateLegendBadge(this.progression.level);

    // Écran victoire finale pour TITAN
    if (this.storyLevelId === 10) {
      this.state = 'final-victory';
      this.ui.showFinalVictory(this.story, coinsEarned, xpAdded);
      return;
    }

    const hasNext = this.storyLevelId < 10 && this.storyLevelId < this.story.unlocked + 1;
    this.ui.showStoryVictory(this.storyLevelId, stars, score, xpAdded, coinsEarned, hasNext);
  }

  // ── Mode Histoire : échec ────────────────────────────────
  _storyFailed() {
    this.state = 'story-failed';
    this.ui.showStoryFailed(this.storyLevelId);
  }

  // ── Game Over ────────────────────────────────────────────
  _gameOver() {
    this.state = 'gameover';
    const score = this.player.score;

    // Meilleur score
    if (score > this.highscore) {
      this.highscore = score;
      localStorage.setItem('starblast_hs', score.toString());
    }

    // Pièces : score / 10, arrondi inférieur
    const earned  = Math.floor(score / 10);
    this.coins   += earned;
    localStorage.setItem('starblast_coins', this.coins.toString());

    // Mise à jour de tous les affichages pièces
    this.ui.updateCoins(this.coins);
    this.ui.updateStartCoins(this.coins);
    this.ui.updateStartHS(this.highscore);
    this.ui.showGameOver(score, this.highscore, this.wave.level);
    this.ui.showGameOverCoins(earned, this.coins);

    // XP : score / 5 (mode Survie, multiplié par XP_MULTIPLIER)
    const rawXP = Math.floor(score / 5);
    const { xpAdded, levelsGained } = this.progression.addXP(rawXP, this.shop);

    // Mise à jour barre XP + HUD niveau
    this.ui.updateXPLevel(this.progression.level);
    this.ui.updateXPBar(this.progression.level, this.progression.progressRatio);
    this.ui.updateLegendBadge(this.progression.level);
    this.ui.showGameOverXP(xpAdded, this.progression.level, levelsGained);
  }

  // ============================================================
  // BOUCLE DE JEU : UPDATE MODE HISTOIRE
  // ============================================================
  _updateStory(dt) {
    this.input.update();
    const inp = this.input;

    this.stars.update(dt);
    this.player.bulletColor = this.shop.getBulletColor();
    this.player.laserType   = this.shop.equippedColor;
    this.player.update(dt, inp, this.W, this.H);

    if (inp.fire) this.player.fire(this.playerBullets, this.audio);
    if (inp.bomb) {
      if (this.player.useBomb(this.enemies, this.particles, this.audio)) {
        this.ui.flash('#ff6b35', 0.5);
        this.input.bomb = false;
      }
    }

    if (this._shakeTimer > 0) this._shakeTimer = Math.max(0, this._shakeTimer - dt);

    this.playerBullets.forEach(b => b.update(dt, this.W, this.H));
    this.enemyBullets.forEach( b => b.update(dt, this.W, this.H));
    this.enemies.forEach(      e => e.update(dt, this.W, this.H, this.enemyBullets, this.player, this.particles));
    this.powerups.forEach(     p => p.update(dt, this.H));
    this.particles.forEach(    p => p.update(dt));

    // Déclenchement alerte boss (son)
    if (this.storyCtrl.needsBossAlert) {
      this.storyCtrl.needsBossAlert = false;
      this.audio.bossAlert();
    }

    // Récompense boss (transition alive → dying)
    for (const e of this.enemies) {
      if (e.isBoss && e.dying && !e._rewardGiven) {
        e._rewardGiven = true;
        this.player.score += e.score;
        spawnExplosion(this.particles, e.x, e.y, e.color, 28, true);
        if (e instanceof BossTitan) this.audio.titanDeath();
        else this.audio.explosion(true);
      }
    }

    // Drops powerups durant les combats boss aux seuils 75/50/25 % PV
    for (const e of this.enemies) {
      if (!e.isBoss || e.dying || !e._dropThresholds) continue;
      while (e._dropThresholds.length > 0 && e.hp / e.maxHp <= e._dropThresholds[0]) {
        e._dropThresholds.shift();
        const types = ['shield', 'double', 'bomb'];
        const t = types[randInt(0, 2)];
        const dx = (Math.random() - 0.5) * 80;
        this.powerups.push(new PowerUp(clamp(e.x + dx, 30, this.W - 30), e.y + 24, t));
      }
    }

    // Laser TITAN → dégâts joueur
    const titan = this.enemies.find(e => e instanceof BossTitan && !e.dying);
    if (titan && titan.laserActive) {
      const lx = titan.laserX, lw = titan.laserW;
      if (this.player.x > lx - lw / 2 && this.player.x < lx + lw / 2 && !this._laserHit) {
        this._laserHit = true;
        if (this.player.hit(this.particles, this.audio)) this.ui.flash('#ff0000', 0.7);
      }
    } else {
      this._laserHit = false;
    }

    // Collisions : balles joueur → ennemis
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      if (b.dead) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.dying || !aabb(b.hitbox, e.hitbox)) continue;
        b.dead = true;
        if (b.laserType === 'solar') spawnBoom(this.particles, b.x, b.y, 'basic', null);
        else spawnExplosion(this.particles, b.x, b.y, '#00bbdd', 5);
        if (e.hit()) {
          this.player.score += e.score;
          const tier = e instanceof BossTitan ? 'titan' : e.isBoss ? 'boss' : e.type;
          spawnBoom(this.particles, e.x, e.y, tier, (d, i) => this._triggerShake(d, i));
          this.audio.explosion(e.type === 'heavy' || e.isBoss);
          e.dead = true;
          if (Math.random() < e.dropChance) {
            this.powerups.push(new PowerUp(e.x, e.y, ['shield','double','bomb'][randInt(0, 2)]));
          }
        }
        break;
      }
    }

    // Balles ennemies → joueur
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      if (b.dead || !aabb(b.hitbox, this.player.hitbox)) continue;
      b.dead = true;
      if (this.player.hit(this.particles, this.audio)) this.ui.flash('#ff3355', 0.5);
    }

    // Ennemis → joueur (collision directe — seulement ennemis normaux)
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.dying || !aabb(e.hitbox, this.player.hitbox)) continue;
      if (this.player.hit(this.particles, this.audio)) { this.ui.flash('#ff3355', 0.6); e.dead = true; }
    }

    // Joueur → power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (!aabb(p.hitbox, this.player.hitbox)) continue;
      this.player.activatePowerup(p.type, this.audio);
      spawnExplosion(this.particles, p.x, p.y, p.color, 12);
      this.powerups.splice(i, 1);
    }

    // Nettoyage
    this.playerBullets = this.playerBullets.filter(b => !b.dead);
    this.enemyBullets  = this.enemyBullets.filter( b => !b.dead);
    this.enemies       = this.enemies.filter(      e => !e.dead);
    this.powerups      = this.powerups.filter(     p => !p.dead);
    cleanParticles(this.particles);

    // Contrôleur de vagues histoire
    this.storyCtrl.update(dt, this.enemies);

    // HUD
    this.ui.updateHUD(this.player.score, this.storyCtrl.waveNum, this.player.lives, this.highscore);
    this.ui.updatePowerupBar(this.player);

    // Conditions de fin
    if (this.storyCtrl.done)        this._storyVictory();
    else if (this.player.lives <= 0) this._storyFailed();
  }

  // ============================================================
  // BOUCLE DE JEU : UPDATE MODE SURVIE
  // ============================================================
  _update(dt) {
    if (this.state === 'story-playing') { this._updateStory(dt); return; }
    if (this.state !== 'playing') return;

    this.input.update();
    const inp = this.input;

    // ── Fond étoilé ──────────────────────────────────────
    this.stars.update(dt);

    // ── Joueur ───────────────────────────────────────────
    // Mise à jour couleur balle chaque frame (gère le rainbow live)
    this.player.bulletColor = this.shop.getBulletColor();
    this.player.laserType   = this.shop.equippedColor;
    this.player.update(dt, inp, this.W, this.H);

    // Tir (clavier ou tactile)
    if (inp.fire) this.player.fire(this.playerBullets, this.audio);

    // Bombe clavier
    if (inp.bomb) {
      if (this.player.useBomb(this.enemies, this.particles, this.audio)) {
        this.ui.flash('#ff6b35', 0.5);
        this.input.bomb = false;   // consommé
      }
    }

    if (this._shakeTimer > 0) this._shakeTimer = Math.max(0, this._shakeTimer - dt);

    // ── Mise à jour des entités ──────────────────────────
    this.playerBullets.forEach(b => b.update(dt, this.W, this.H));
    this.enemyBullets.forEach( b => b.update(dt, this.W, this.H));
    this.enemies.forEach(      e => e.update(dt, this.W, this.H, this.enemyBullets));
    this.powerups.forEach(     p => p.update(dt, this.H));
    this.particles.forEach(    p => p.update(dt));

    // ── Détection de collisions ──────────────────────────

    // Balles joueur → Ennemis
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      if (b.dead) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!aabb(b.hitbox, e.hitbox)) continue;

        b.dead = true;
        if (b.laserType === 'solar') spawnBoom(this.particles, b.x, b.y, 'basic', null);
        else spawnExplosion(this.particles, b.x, b.y, '#00bbdd', 5);

        if (e.hit()) {
          // Ennemi tué
          this.player.score += e.score * this.wave.level;
          this.wave.enemyKilled();
          spawnBoom(this.particles, e.x, e.y, e.type, (d, i) => this._triggerShake(d, i));
          this.audio.explosion(e.type === 'heavy');
          e.dead = true;

          // Drop power-up aléatoire
          if (Math.random() < e.dropChance) {
            const types = ['shield','double','bomb'];
            this.powerups.push(new PowerUp(e.x, e.y, types[randInt(0, 2)]));
          }
        }
        break;
      }
    }

    // Balles ennemies → Joueur
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      if (b.dead || !aabb(b.hitbox, this.player.hitbox)) continue;
      b.dead = true;
      if (this.player.hit(this.particles, this.audio)) {
        this.ui.flash('#ff3355', 0.5);
      }
    }

    // Ennemis → Joueur (collision directe)
    for (const e of this.enemies) {
      if (e.dead || !aabb(e.hitbox, this.player.hitbox)) continue;
      if (this.player.hit(this.particles, this.audio)) {
        this.ui.flash('#ff3355', 0.6);
        e.dead = true;
      }
    }

    // Joueur → Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (!aabb(p.hitbox, this.player.hitbox)) continue;
      this.player.activatePowerup(p.type, this.audio);
      spawnExplosion(this.particles, p.x, p.y, p.color, 12);
      this.powerups.splice(i, 1);
    }

    // ── Nettoyage des entités mortes ─────────────────────
    this.playerBullets = this.playerBullets.filter(b => !b.dead);
    this.enemyBullets  = this.enemyBullets.filter( b => !b.dead);
    this.enemies       = this.enemies.filter(      e => !e.dead);
    this.powerups      = this.powerups.filter(     p => !p.dead);
    cleanParticles(this.particles);

    // ── Gestion des vagues ───────────────────────────────
    const waveResult = this.wave.update(dt, this.enemies, this.W);
    if (waveResult === 'next') {
      this.audio.levelUp();
      this.ui.showLevelNotif(this.wave.level);
    }

    // ── HUD ──────────────────────────────────────────────
    this.ui.updateHUD(this.player.score, this.wave.level, this.player.lives, this.highscore);
    this.ui.updatePowerupBar(this.player);

    // ── Fin de partie ────────────────────────────────────
    if (this.player.lives <= 0) this._gameOver();
  }

  // ============================================================
  // BOUCLE DE JEU : DRAW
  // ============================================================
  _draw() {
    const ctx = this.ctx;

    // Fond noir spatial
    ctx.fillStyle = '#00000d';
    ctx.fillRect(0, 0, this.W, this.H);

    // Screen shake
    const shaking = this._shakeTimer > 0;
    if (shaking) {
      const sx = (Math.random() - 0.5) * this._shakeIntensity;
      const sy = (Math.random() - 0.5) * this._shakeIntensity;
      ctx.save();
      ctx.translate(sx, sy);
    }

    // Étoiles (toujours dessinées, y compris sur les menus)
    this.stars.update(0.016);   // avancement minimal même en pause / menu
    this.stars.draw(ctx);

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'story-playing') {
      // Overlay rouge TITAN phase 3 (avant les entités)
      if (this.state === 'story-playing') {
        const titan = this.enemies.find(e => e instanceof BossTitan && !e.dying);
        if (titan) {
          if (titan.phase === 3) {
            const redAlpha = 0.12 + 0.07 * Math.sin(Date.now() * 0.009);
            ctx.fillStyle = `rgba(100,0,0,${redAlpha})`;
            ctx.fillRect(0, 0, this.W, this.H);
          }
          // Laser TITAN (dessiné derrière les entités)
          titan.drawLaserEffect(ctx, this.H);
        }
      }

      // Power-ups
      this.powerups.forEach(p => p.draw(ctx));

      // Balles joueur
      this.playerBullets.forEach(b => b.draw(ctx));

      // Balles ennemies
      this.enemyBullets.forEach(b => b.draw(ctx));

      // Ennemis (y compris boss)
      this.enemies.forEach(e => e.draw(ctx));

      // Joueur
      this.player.draw(ctx);

      // Particules (par-dessus tout le reste)
      this.particles.forEach(p => p.draw(ctx));

      // Message "Prochaine vague" — mode Survie
      if ((this.state === 'playing' || this.state === 'paused') && this.wave.betweenWave) {
        const prog = 1 - (this.wave.betweenTimer / 2.8);
        const alpha = Math.sin(prog * Math.PI);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle   = '#ffcc00';
        ctx.font        = 'bold 22px Orbitron, monospace';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur  = 20;
        ctx.fillText(`— VAGUE ${this.wave.level} EN APPROCHE —`, this.W/2, this.H/2 + 40);
        ctx.restore();
      }

      // Message entre vagues — mode Histoire
      if (this.state === 'story-playing' && this.storyCtrl?.betweenTimer > 0) {
        const prog  = 1 - (this.storyCtrl.betweenTimer / 2.5);
        const alpha = Math.sin(prog * Math.PI);
        ctx.save();
        ctx.globalAlpha  = alpha * 0.85;
        ctx.fillStyle    = '#00e5ff';
        ctx.font         = 'bold 20px Orbitron, monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = '#00e5ff';
        ctx.shadowBlur   = 20;
        ctx.fillText(
          `— VAGUE ${this.storyCtrl.waveNum}/${this.storyCtrl.totalWaves} —`,
          this.W / 2, this.H / 2 + 40
        );
        ctx.restore();
      }

      // Alerte boss — texte clignotant
      if (this.state === 'story-playing' && this.storyCtrl?.bossAlertActive) {
        const blink = Math.floor(Date.now() / 280) % 2 === 0;
        if (blink) {
          ctx.save();
          ctx.fillStyle    = '#ff2200';
          ctx.font         = 'bold 26px Orbitron, monospace';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor  = '#ff4400';
          ctx.shadowBlur   = 28;
          ctx.fillText('⚠ BOSS INCOMING ⚠', this.W / 2, this.H / 2);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    }

    if (shaking) ctx.restore();
  }

  // ============================================================
  // BOUCLE PRINCIPALE (requestAnimationFrame)
  // ============================================================
  _loop(timestamp) {
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = timestamp;

    // Les étoiles s'animent en dehors des états "en jeu actif"
    if (this.state !== 'playing' && this.state !== 'story-playing') this.stars.update(dt);

    this._update(dt);
    this._draw();

    requestAnimationFrame(ts => this._loop(ts));
  }
}

// ============================================================
// SECTION 13 — BOOTSTRAP : initialisation au chargement du DOM
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
