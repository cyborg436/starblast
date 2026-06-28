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
  PLAYER_SPEED_X: 725,        // px/s latéral (290 × 2.5)
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
  { id: 'starter', name: 'Starter', price: 0    },
  { id: 'stealth', name: 'Stealth', price: 150  },
  { id: 'brute',   name: 'Brute',   price: 300  },
  { id: 'viper',   name: 'Viper',   price: 500  },
  { id: 'phoenix', name: 'Phoenix', price: 800  },
  { id: 'shadow',  name: 'Shadow',  price: 1200 },
  { id: 'titan',   name: 'Titan',   price: 2000 },
];

const COLOR_DATA = [
  { id: 'white',   name: 'Laser Blanc',   price: 0,   color: '#ffffff' },
  { id: 'blue',    name: 'Laser Bleu',    price: 100, color: '#00BFFF' },
  { id: 'green',   name: 'Laser Vert',    price: 100, color: '#39FF14' },
  { id: 'red',     name: 'Laser Rouge',   price: 200, color: '#FF3131' },
  { id: 'purple',  name: 'Laser Violet',  price: 300, color: '#BF00FF' },
  { id: 'rainbow', name: 'Arc-en-ciel',   price: 500, color: 'rainbow' },
];

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

  /** Utilise une bombe : détruit tous les ennemis à l'écran. */
  useBomb(enemies, particles, audio) {
    if (this.bombs <= 0) return false;
    this.bombs--;
    audio.bomb();
    enemies.forEach(e => spawnExplosion(particles, e.x, e.y, e.color, 14, true));
    enemies.length = 0;
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
    }
    this._thrustParticles = this._thrustParticles.filter(p => { p.update(dt); return !p.dead; });
  }

  /** Tire une ou deux balles selon le power-up actif. */
  fire(bullets, audio) {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = CFG.PLAYER_FIRE_RATE;
    const c = this.bulletColor;

    if (this.doubleShot) {
      bullets.push(new Bullet(this.x - 12, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true));
      bullets.push(new Bullet(this.x + 12, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true));
      audio.shootDouble();
    } else {
      bullets.push(new Bullet(this.x, this.y - this.h * 0.46, 0, -CFG.BULLET_SPEED, c, true));
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
  constructor(x, y, vx, vy, color, fromPlayer) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color      = color;
    this.fromPlayer = fromPlayer;
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
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = this.color;
      ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(255,255,255,0.65)';
      ctx.fillRect(this.x - 1, this.y - this.h/2, 2, this.h);
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

    // Flash blanc à l'impact
    if (this.flashTimer > 0) ctx.filter = 'brightness(3.5) saturate(0)';
    this._render(ctx, this.w, this.h, this.t);
    ctx.filter = 'none';

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
    ['start','gameover','pause','shop'].forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.toggle('active', id === name);
    });
  }

  hideScreens() {
    ['start','gameover','pause','shop'].forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.remove('active');
    });
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

    this._tab   = 'skins';  // onglet actif
    this._coins = 0;        // snapshot pour re-render sans argument
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
  }

  _renderGrid(coins) {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = this._tab === 'skins' ? SKIN_DATA : COLOR_DATA;
    items.forEach(item => this._renderCard(grid, item, coins));
  }

  _renderCard(grid, item, coins) {
    const owned    = this.owned.has(item.id);
    const equipped = this.equippedSkin === item.id || this.equippedColor === item.id;
    const isSkin   = SKIN_DATA.some(s => s.id === item.id);
    const canBuy   = coins >= item.price;

    // Classe d'état de la carte
    const stateClass = equipped ? 'equipped' : owned ? 'owned' : 'locked';
    const card = document.createElement('div');
    card.className = `shop-card ${stateClass}`;

    // Canvas aperçu
    const cv = document.createElement('canvas');
    cv.className = 'card-preview';
    cv.width  = 64;
    cv.height = isSkin ? 76 : 36;
    this._drawPreview(cv, item, isSkin);
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
// SECTION 12 — MOTEUR DE JEU PRINCIPAL
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this.W = CFG.CANVAS_W;
    this.H = CFG.CANVAS_H;

    this.audio = new AudioManager();
    this.ui    = new UIManager();
    this.input = new InputManager();
    this.stars = new StarField(this.W, this.H);
    this.wave  = new WaveManager();
    this.shop  = new ShopManager();

    this.player       = null;
    this.enemies      = [];
    this.playerBullets = [];
    this.enemyBullets  = [];
    this.particles    = [];
    this.powerups     = [];

    // États : 'start' | 'playing' | 'paused' | 'gameover'
    this.state     = 'start';
    this.highscore = parseInt(localStorage.getItem('starblast_hs')    || '0', 10);
    this.coins     = parseInt(localStorage.getItem('starblast_coins') || '0', 10);
    this.lastTime  = 0;

    this._setupCanvas();
    this._bindUI();
    this._detectMobile();

    this.ui.updateStartHS(this.highscore);
    this.ui.updateStartCoins(this.coins);
    this.ui.updateCoins(this.coins);
    this.ui.showScreen('start');

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

    on('btn-start',     'click', () => this._startGame());
    on('btn-replay',    'click', () => this._startGame());
    on('btn-resume',    'click', () => this._togglePause());
    on('btn-quit',      'click', () => { this.state = 'start'; this.ui.showScreen('start'); });

    // ── Boutique ─────────────────────────────────────────
    on('btn-open-shop', 'click', () => {
      this.shop.refresh(this.coins);
      this.ui.showScreen('shop');
    });

    on('btn-shop-back', 'click', () => this.ui.showScreen('start'));

    // Onglets de la boutique
    document.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shop._tab = btn.dataset.tab;
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
        if (this.state === 'playing' || this.state === 'paused') this._togglePause();
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

    // Bombe mobile
    on('btn-bomb', 'touchstart', e => {
      e.preventDefault();
      if (this.state === 'playing' && this.player) {
        if (this.player.useBomb(this.enemies, this.particles, this.audio)) {
          this.ui.flash('#ff6b35', 0.5);
        }
      }
    });
  }

  _showModal() { document.getElementById('modal-overlay')?.classList.remove('hidden'); }
  _hideModal() { document.getElementById('modal-overlay')?.classList.add('hidden'); }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showScreen('pause');
    } else if (this.state === 'paused') {
      this.state    = 'playing';
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
    this.wave   = new WaveManager();
    this.wave.start(1, this.W);

    this.state    = 'playing';
    this.lastTime = performance.now();

    this.ui.hideScreens();
    this.ui.showLevelNotif(1);
    this.ui.updateHUD(0, 1, CFG.LIVES, this.highscore);
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
  }

  // ============================================================
  // BOUCLE DE JEU : UPDATE
  // ============================================================
  _update(dt) {
    if (this.state !== 'playing') return;

    this.input.update();
    const inp = this.input;

    // ── Fond étoilé ──────────────────────────────────────
    this.stars.update(dt);

    // ── Joueur ───────────────────────────────────────────
    // Mise à jour couleur balle chaque frame (gère le rainbow live)
    this.player.bulletColor = this.shop.getBulletColor();
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
        spawnExplosion(this.particles, b.x, b.y, '#00bbdd', 5);

        if (e.hit()) {
          // Ennemi tué
          this.player.score += e.score * this.wave.level;
          this.wave.enemyKilled();
          spawnExplosion(this.particles, e.x, e.y, e.color, e.type === 'heavy' ? 22 : 14, e.type === 'heavy');
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
    this.particles     = this.particles.filter(    p => !p.dead);

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

    // Étoiles (toujours dessinées, y compris sur les menus)
    this.stars.update(0.016);   // avancement minimal même en pause / menu
    this.stars.draw(ctx);

    if (this.state === 'playing' || this.state === 'paused') {
      // Power-ups
      this.powerups.forEach(p => p.draw(ctx));

      // Balles joueur
      this.playerBullets.forEach(b => b.draw(ctx));

      // Balles ennemies
      this.enemyBullets.forEach(b => b.draw(ctx));

      // Ennemis
      this.enemies.forEach(e => e.draw(ctx));

      // Joueur
      this.player.draw(ctx);

      // Particules (par-dessus tout le reste)
      this.particles.forEach(p => p.draw(ctx));

      // Message "Prochaine vague" entre les niveaux
      if (this.wave.betweenWave) {
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
    }
  }

  // ============================================================
  // BOUCLE PRINCIPALE (requestAnimationFrame)
  // ============================================================
  _loop(timestamp) {
    // Calcul du delta-time, plafonné à 50 ms pour éviter les sauts
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = timestamp;

    // Les étoiles s'animent toujours (y compris dans les menus)
    if (this.state !== 'playing') this.stars.update(dt);

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
