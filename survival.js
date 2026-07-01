'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   survival.js  —  Enrichissement du mode Survie StarBlast
   - AdrenalineManager  : jauge d'adrénaline + activation Shift
   - FormationSpawner   : formations d'ennemis à partir de la vague 5
   - DangerZoneManager  : zones dangereuses toutes les 2 min
   - SurvivalEventManager : événements aléatoires tous les 5 vagues
   - 4 nouveaux types d'ennemis : Kamikaze, Blindé, Soigneur, Bombardier

   Doit être chargé APRÈS game.js (extend Enemy, référence Player, PowerUp,
   Bullet, CFG, spawnExplosion, rand).
───────────────────────────────────────────────────────────────────────── */

// ═════════════════════════════════════════════════════════════════════
// SECTION 1 — SYSTÈME D'ADRÉNALINE
// ═════════════════════════════════════════════════════════════════════
const ADRENALINE_MAX          = 100;
const ADRENALINE_DURATION     = 6.0;     // s
const ADRENALINE_INV_ON_ACT   = 0.5;     // s d'invincibilité à l'activation
const ADRENALINE_KILL_GAIN    = 8;       // par ennemi tué
const ADRENALINE_DODGE_TICK   = 0.5;     // gain / sec en "dodge mode"
const ADRENALINE_HIT_LOSS     = 35;      // pertes lors d'un impact
const ADRENALINE_DODGE_WINDOW = 60;      // px : distance min pour "esquiver" une balle
const ADRENALINE_DAMAGE_MULT  = 2;
const ADRENALINE_SPEED_MULT   = 1.5;

class AdrenalineManager {
  constructor() {
    this.value       = 0;        // 0..ADRENALINE_MAX
    this.active      = false;
    this.remaining   = 0;        // durée restante en s (mode actif)
    this._dodgeTick  = 0;
  }
  reset() {
    this.value = 0; this.active = false;
    this.remaining = 0; this._dodgeTick = 0;
  }
  get ratio()      { return this.value / ADRENALINE_MAX; }
  get isFull()     { return this.value >= ADRENALINE_MAX; }
  get isActive()   { return this.active; }
  get damageMult() { return this.active ? ADRENALINE_DAMAGE_MULT : 1; }
  get speedMult()  { return this.active ? ADRENALINE_SPEED_MULT  : 1; }

  onKill()       { if (!this.active) this.value = Math.min(ADRENALINE_MAX, this.value + ADRENALINE_KILL_GAIN); }
  onPlayerHit()  { this.value = Math.max(0, this.value - ADRENALINE_HIT_LOSS); }
  onDodge()      { if (!this.active) this.value = Math.min(ADRENALINE_MAX, this.value + 5); }

  /** Bonus de dodging passif : détecte balles frôlant le joueur. */
  tickDodgeGain(dt, player, enemyBullets) {
    if (this.active) return;
    if (!player || !enemyBullets || enemyBullets.length === 0) return;
    // 1 tick / 0.5s pour éviter d'exploser en granularité
    this._dodgeTick += dt;
    if (this._dodgeTick < ADRENALINE_DODGE_TICK) return;
    this._dodgeTick = 0;
    // Compte les balles proches (frôlées) ce tick
    let closeCount = 0;
    for (const b of enemyBullets) {
      if (b.dead) continue;
      const dx = b.x - player.x, dy = b.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < ADRENALINE_DODGE_WINDOW && d > 25) closeCount++;
    }
    if (closeCount > 0) {
      this.value = Math.min(ADRENALINE_MAX, this.value + Math.min(closeCount, 3) * 1.5);
    }
  }

  /** Tente d'activer le mode Adrénaline. Retourne true si activé. */
  activate(player) {
    if (this.active) return false;
    if (this.value < ADRENALINE_MAX) return false;
    this.active    = true;
    this.remaining = ADRENALINE_DURATION;
    // Invincibilité de 0.5s à l'activation
    if (player && !player.invincible) {
      player.invincible = true;
      player.invTimer   = ADRENALINE_INV_ON_ACT;
      player.blinkTimer = 0;
    }
    return true;
  }

  tick(dt) {
    if (!this.active) return;
    this.remaining -= dt;
    // Se vide progressivement pendant l'activation
    this.value = Math.max(0, this.value - (ADRENALINE_MAX / ADRENALINE_DURATION) * dt);
    if (this.remaining <= 0) {
      this.active = false; this.remaining = 0; this.value = 0;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 2 — FORMATIONS D'ENNEMIS (vagues ≥ 5)
// ═════════════════════════════════════════════════════════════════════
const FORMATION_TYPES = ['v', 'wall', 'pincer', 'spiral', 'elite'];

class FormationSpawner {
  /**
   * Construit une file de spawn (compatible WaveManager.spawnQueue) pour
   * une formation donnée. Renvoie { queue, name } où name est le libellé
   * à afficher dans la bannière.
   */
  static build(type, W, level) {
    const types = ['basic'];
    if (level >= 3) types.push('medium');
    if (level >= 6) types.push('heavy');
    const heaviest = types[types.length - 1];
    const spacing  = 46;
    const queue = [];
    let name = '';

    switch (type) {
      case 'v': {
        name = 'V';
        const n = 9;
        const centerX = W / 2;
        const step    = 34;
        for (let i = 0; i < n; i++) {
          const offset = i - Math.floor(n / 2);
          const x = centerX + offset * step;
          const y = -60 - Math.abs(offset) * 30;
          queue.push({ type: 'basic', x, y, delay: 0.05 * i });
        }
        break;
      }
      case 'wall': {
        name = 'MUR';
        const n = 8;
        const step = (W - 60) / (n - 1);
        for (let i = 0; i < n; i++) {
          const x = 30 + i * step;
          queue.push({ type: types[Math.min(1, types.length-1)], x, y: -60, delay: 0.08 * i });
        }
        break;
      }
      case 'pincer': {
        name = 'PINCE';
        // 2 groupes de 4 qui arrivent depuis les deux bords
        for (let i = 0; i < 4; i++) {
          queue.push({ type: 'basic', x: 40, y: -60 - i * 44, delay: 0.05 * i });
          queue.push({ type: 'basic', x: W - 40, y: -60 - i * 44, delay: 0.05 * i });
        }
        break;
      }
      case 'spiral': {
        name = 'SPIRALE';
        // 12 ennemis en spirale : décalage angulaire + rayon décroissant
        const cx = W / 2;
        const cy = -80;
        const n  = 12;
        const startR = W * 0.42;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = startR - i * (startR / (n * 1.4));
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.4;
          queue.push({ type: 'basic', x: clamp(x, 30, W - 30), y, delay: 0.10 * i });
        }
        break;
      }
      case 'elite': {
        name = 'ÉLITE';
        // 3 ennemis lourds centrés — marqués elite (3× PV appliqué au spawn)
        const positions = [W * 0.3, W * 0.5, W * 0.7];
        positions.forEach((x, i) => {
          queue.push({ type: heaviest, x, y: -80 - i * 40, delay: 0.25 * i, elite: true });
        });
        break;
      }
    }
    return { queue, name };
  }

  static pickRandom(level) {
    // À partir du niveau 8, chances accrues pour spirale / élite
    if (level < 8) {
      return FORMATION_TYPES[Math.floor(Math.random() * 3)];  // v/wall/pincer
    }
    return FORMATION_TYPES[Math.floor(Math.random() * FORMATION_TYPES.length)];
  }
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 3 — ZONES DE DANGER DYNAMIQUES
// ═════════════════════════════════════════════════════════════════════
const DANGER_INTERVAL      = 120;   // s entre spawns
const DANGER_WARN_DURATION = 3.0;
const DANGER_ACTIVE_DURATION = 8.0;
const DANGER_DAMAGE_TICK   = 1.0;   // 1 PV par seconde

class DangerZoneManager {
  constructor() {
    this.zones      = [];
    this.spawnTimer = 60;    // premier spawn après 1 min
  }
  reset() { this.zones = []; this.spawnTimer = 60; }

  _spawnZone(W, H) {
    // Rectangle aléatoire couvrant 30-50 % de la largeur, 20-35 % de la hauteur
    const zw = W * (0.30 + Math.random() * 0.20);
    const zh = H * (0.20 + Math.random() * 0.15);
    const zx = 10 + Math.random() * (W - zw - 20);
    const zy = 60 + Math.random() * (H - zh - 120);
    this.zones.push({
      x: zx, y: zy, w: zw, h: zh,
      warn: DANGER_WARN_DURATION,
      active: 0,
      lifespan: DANGER_ACTIVE_DURATION,
      damageTick: 0,
    });
  }

  update(dt, W, H, player, particles, audio, onPlayerHit) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = DANGER_INTERVAL;
      this._spawnZone(W, H);
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (z.warn > 0) {
        z.warn -= dt;
        if (z.warn <= 0) z.active = z.lifespan;
        continue;
      }
      z.active -= dt;
      if (z.active <= 0) { this.zones.splice(i, 1); continue; }
      // Dégâts si le joueur est dedans
      if (player && !player.invincible &&
          player.x > z.x && player.x < z.x + z.w &&
          player.y > z.y && player.y < z.y + z.h) {
        z.damageTick -= dt;
        if (z.damageTick <= 0) {
          z.damageTick = DANGER_DAMAGE_TICK;
          if (player.hit(particles, audio) && onPlayerHit) onPlayerHit();
        }
      }
    }
  }

  draw(ctx) {
    this.zones.forEach(z => {
      ctx.save();
      if (z.warn > 0) {
        // Phase avertissement : contour rouge clignotant
        const blink = Math.floor(Date.now() / 180) % 2 === 0;
        ctx.strokeStyle = blink ? '#ff2222' : '#ff8844';
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 3;
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.setLineDash([]);
        // Texte "ZONE DE DANGER"
        if (blink) {
          ctx.fillStyle = '#ffcccc';
          ctx.font = '900 12px Orbitron, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
          ctx.fillText('⚠ ZONE DE DANGER', z.x + z.w / 2, z.y + 4);
          ctx.shadowBlur = 0;
        }
      } else {
        // Phase active : rectangle rouge semi-transparent + hachures
        const t = Date.now() * 0.002;
        const pulse = 0.18 + 0.08 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(255,40,40,${pulse})`;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        // Hachures animées
        ctx.strokeStyle = 'rgba(255,80,80,0.6)';
        ctx.lineWidth = 1.2;
        const step = 20;
        const off  = (Date.now() * 0.04) % step;
        for (let sx = -z.h + off; sx < z.w; sx += step) {
          ctx.beginPath();
          ctx.moveTo(z.x + sx, z.y);
          ctx.lineTo(z.x + sx + z.h, z.y + z.h);
          ctx.stroke();
        }
        // Contour vif
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 2;
        ctx.strokeRect(z.x, z.y, z.w, z.h);
      }
      ctx.restore();
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 4 — ÉVÉNEMENTS ALÉATOIRES (tous les 5 vagues)
// ═════════════════════════════════════════════════════════════════════
const SURVIVAL_EVENTS = [
  { id:'elite',   name:'VAGUE ÉLITE',       icon:'💀', desc:'Ennemis +100 % PV, +100 % pièces', kind:'neg' },
  { id:'purain',  name:'PLUIE DE POWER-UPS', icon:'🎁', desc:'8 power-ups apparaissent',        kind:'pos' },
  { id:'fog',     name:'BROUILLARD DE GUERRE', icon:'🌫️', desc:'Visibilité réduite 20 s',      kind:'neg' },
  { id:'double',  name:'DOUBLE SCORE',      icon:'⭐', desc:'×2 points pendant 30 s',           kind:'pos' },
  { id:'invasion',name:'INVASION',          icon:'👾', desc:'×3 ennemis pendant 1 vague',       kind:'neg' },
];

class SurvivalEventManager {
  constructor() {
    this.reset();
  }
  reset() {
    this.activeEventId = null;
    this.activeTimer   = 0;      // durée restante d'un effet temporel
    this.pendingEliteWave = false;
    this.pendingInvasion  = false;
    this.doubleScoreActive = false;
    this.doubleScoreTimer  = 0;
    this.fogActive         = false;
    this.fogTimer          = 0;
    this.announce          = null;   // { id, name, icon, desc, kind, life, maxLife }
    this._lastAnnouncedWave = 0;
  }

  /** Appelé quand une nouvelle vague démarre. Peut déclencher un événement. */
  onWaveStart(level, game) {
    if (level % 5 !== 0 || level <= 0 || level === this._lastAnnouncedWave) return;
    this._lastAnnouncedWave = level;
    // Alterne pos/neg pour équilibrage 50/50
    const positive = (Math.floor(level / 5) % 2 === 0);
    const pool = SURVIVAL_EVENTS.filter(e => positive ? e.kind === 'pos' : e.kind === 'neg');
    const evt = pool[Math.floor(Math.random() * pool.length)];
    this._triggerEvent(evt, game);
  }

  _triggerEvent(evt, game) {
    this.activeEventId = evt.id;
    this.announce = { ...evt, life: 2.0, maxLife: 2.0 };
    switch (evt.id) {
      case 'elite':
        this.pendingEliteWave = true;
        break;
      case 'purain':
        // Spawn immédiatement 8 power-ups
        for (let i = 0; i < 8; i++) {
          const x = 40 + Math.random() * (game.W - 80);
          const y = 60 + Math.random() * (game.H * 0.3);
          const type = _pickPowerupType();
          game.powerups.push(new PowerUp(x, y, type));
        }
        break;
      case 'fog':
        this.fogActive = true; this.fogTimer = 20.0;
        break;
      case 'double':
        this.doubleScoreActive = true; this.doubleScoreTimer = 30.0;
        break;
      case 'invasion':
        this.pendingInvasion = true;
        break;
    }
  }

  tick(dt) {
    if (this.announce) {
      this.announce.life -= dt;
      if (this.announce.life <= 0) this.announce = null;
    }
    if (this.fogActive) {
      this.fogTimer -= dt;
      if (this.fogTimer <= 0) { this.fogActive = false; }
    }
    if (this.doubleScoreActive) {
      this.doubleScoreTimer -= dt;
      if (this.doubleScoreTimer <= 0) { this.doubleScoreActive = false; }
    }
  }

  /** Modificateur de score appliqué aux kills. */
  scoreMult() { return this.doubleScoreActive ? 2 : 1; }
  /** Modificateur de pièces (le Game consulte wave._eliteBonus). */
  coinMult()  { return 1; }

  drawFogOverlay(ctx, W, H) {
    if (!this.fogActive) return;
    // Vignette + fog gris/bleu sombre couvrant 50 % de visibilité
    const t = Date.now() * 0.0006;
    const a = 0.50 + 0.05 * Math.sin(t * 2);
    ctx.save();
    ctx.fillStyle = `rgba(100,120,150,${a * 0.5})`;
    ctx.fillRect(0, 0, W, H);
    // Vignette darker en bordure
    const g = ctx.createRadialGradient(W/2, H/2, W * 0.15, W/2, H/2, W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${a * 0.7})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 5 — 4 NOUVEAUX ENNEMIS
// ═════════════════════════════════════════════════════════════════════

// ── Ennemi KAMIKAZE ─────────────────────────────────────────────────
class KamikazeEnemy extends Enemy {
  constructor(x, y, speedScale, target) {
    super('basic', x, y, speedScale);   // hérite du type "basic" pour le rendu de secours
    this.type    = 'kamikaze';
    this.w = 26; this.h = 28;
    this.hp = 1; this.maxHp = 1;
    this.score = 180;
    this.dropChance = 0.20;
    this.color = '#ff3366';
    this._render = null;
    this._target = target;
    // Kamikaze : très rapide et fonce en ligne droite vers le joueur
    this.vy = 100 + speedScale * 25;
    this.vx = 0;
    this.fireRate = 999;   // ne tire pas
    this.fireTimer = 999;
    this.explosionRadius = 60;
    this.explosionDamage = 1;
    this._locked = false;   // trajectoire figée au 1er update
  }
  update(dt, W, H, enemyBullets) {
    // Verrouille direction à la cible au premier tick
    if (!this._locked && this._target) {
      const dx = this._target.x - this.x;
      const dy = this._target.y - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      const spd = 200 + Math.min(30, (this.vy || 100)) * 0.5;
      this.vx = (dx / d) * spd;
      this.vy = (dy / d) * spd;
      this._locked = true;
    }
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.y > H + this.h || this.y < -80 || this.x < -60 || this.x > W + 60) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Rotation vers la direction
    const ang = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    ctx.rotate(ang);
    if (this.flashTimer > 0) ctx.filter = 'brightness(3)';
    // Corps triangulaire rouge vif avec traînée
    ctx.shadowColor = '#ff3366'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.moveTo(0, -this.h / 2);
    ctx.lineTo(this.w / 2, this.h / 2);
    ctx.lineTo(-this.w / 2, this.h / 2);
    ctx.closePath(); ctx.fill();
    // Cœur pulsant
    ctx.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * Math.sin(this.t * 12)})`;
    ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI * 2); ctx.fill();
    // Traînée
    ctx.fillStyle = `rgba(255,150,80,${0.5 + 0.5 * Math.sin(this.t * 20)})`;
    ctx.beginPath();
    ctx.moveTo(-4, this.h / 2);
    ctx.lineTo(0, this.h / 2 + 10);
    ctx.lineTo(4, this.h / 2);
    ctx.closePath(); ctx.fill();
    ctx.filter = 'none'; ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── Ennemi BLINDÉ ───────────────────────────────────────────────────
class ArmoredEnemy extends Enemy {
  constructor(x, y, speedScale) {
    super('heavy', x, y, speedScale);
    this.type = 'armored';
    this.w = 52; this.h = 46;
    this.hp = 5; this.maxHp = 5;
    this.score = 700;
    this.dropChance = 0.55;
    this.vy *= 0.55;   // très lent
    this.fireRate = 3.2;
    this.fireTimer = rand(0.5, this.fireRate);
    this.color = '#889'; this._render = null;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flashTimer > 0) ctx.filter = 'brightness(3)';
    const w = this.w, h = this.h;
    const dmg = 1 - (this.hp / this.maxHp);  // 0 → 1

    // Corps blindé (plaques métalliques)
    ctx.shadowColor = '#aabbcc'; ctx.shadowBlur = 12;
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#889');
    g.addColorStop(0.5, '#556677');
    g.addColorStop(1, '#223344');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.4);
    ctx.lineTo(w * 0.45, -h * 0.4);
    ctx.lineTo(w * 0.5, h * 0.35);
    ctx.lineTo(w * 0.2, h * 0.5);
    ctx.lineTo(-w * 0.2, h * 0.5);
    ctx.lineTo(-w * 0.5, h * 0.35);
    ctx.closePath(); ctx.fill();
    // Rivets
    ctx.fillStyle = '#334455';
    [[-w*0.35,-h*0.25],[w*0.35,-h*0.25],[-w*0.35,h*0.25],[w*0.35,h*0.25]].forEach(([rx,ry]) => {
      ctx.beginPath(); ctx.arc(rx, ry, 2, 0, Math.PI * 2); ctx.fill();
    });
    // Œil central
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Dégradation visible : fissures + noircissement croissant
    if (dmg > 0.15) {
      ctx.strokeStyle = `rgba(0,0,0,${dmg * 0.8})`;
      ctx.lineWidth = 1.5;
      // Fissures selon dégâts (1 crack par tranche de 20 %)
      const cracks = Math.min(4, Math.floor(dmg * 5));
      for (let c = 0; c < cracks; c++) {
        ctx.beginPath();
        const sx = -w * 0.3 + c * (w * 0.2);
        const sy = -h * 0.3;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 4, sy + h * 0.25);
        ctx.lineTo(sx - 3, sy + h * 0.5);
        ctx.stroke();
      }
      // Taches noires
      ctx.fillStyle = `rgba(0,0,0,${dmg * 0.4})`;
      ctx.beginPath(); ctx.arc(w * 0.15, -h * 0.1, w * 0.15 * dmg, 0, Math.PI * 2); ctx.fill();
    }
    ctx.filter = 'none';
    // Barre PV
    const bw = w * 0.9, bh = 3.5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2, -h/2 - 9, bw, bh);
    const ratio = this.hp / this.maxHp;
    ctx.fillStyle = ratio > 0.5 ? '#00ff88' : ratio > 0.25 ? '#ffcc00' : '#ff3355';
    ctx.fillRect(-bw/2, -h/2 - 9, bw * ratio, bh);
    ctx.restore();
  }
}

// ── Ennemi SOIGNEUR ─────────────────────────────────────────────────
class HealerEnemy extends Enemy {
  constructor(x, y, speedScale) {
    super('medium', x, y, speedScale);
    this.type = 'healer';
    this.w = 40; this.h = 40;
    this.hp = 3; this.maxHp = 3;
    this.score = 600;
    this.dropChance = 0.50;
    this.vy *= 0.6;   // reste en arrière
    this.color = '#33ff88';
    this.fireRate = 6;   // rarement
    this.fireTimer = 3;
    this.healTimer = 2.0;
    this._render = null;
  }
  /** Répare les ennemis proches. Appelé par Game._update. */
  healNearby(enemies, dt) {
    this.healTimer -= dt;
    if (this.healTimer > 0) return null;
    this.healTimer = 2.0;
    // Cherche le plus proche allié blessé (hors soi, hors boss)
    let best = null, bestDist = 180;
    for (const e of enemies) {
      if (e === this || e.dead || e.dying) continue;
      if (e.isBoss) continue;
      if (e.hp >= e.maxHp) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) { best = e; bestDist = d; }
    }
    if (best) {
      best.hp = Math.min(best.maxHp, best.hp + 1);
      return { from: this, to: best };
    }
    return null;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flashTimer > 0) ctx.filter = 'brightness(3)';
    // Corps rond vert
    ctx.shadowColor = '#33ff88'; ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, this.w / 2);
    g.addColorStop(0, '#88ffaa');
    g.addColorStop(0.7, '#33cc66');
    g.addColorStop(1, '#0a3319');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.w * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#88ffaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Croix médicale (au centre)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -10, 6, 20);
    ctx.fillRect(-10, -3, 20, 6);
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    // Icône ⚕ flottante (priorité #1)
    ctx.font = '900 12px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#88ffaa';
    ctx.shadowColor = '#00ff44'; ctx.shadowBlur = 10;
    ctx.fillText('✚', 0, -this.h / 2 - 4);
    ctx.shadowBlur = 0;
    // Barre PV
    if (this.hp < this.maxHp) {
      const bw = this.w * 0.9, bh = 3.5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2, -this.h/2 - 20, bw, bh);
      ctx.fillStyle = '#88ffaa';
      ctx.fillRect(-bw/2, -this.h/2 - 20, bw * (this.hp / this.maxHp), bh);
    }
    ctx.restore();
  }
}

// ── Ennemi BOMBARDIER ───────────────────────────────────────────────
class BomberEnemy extends Enemy {
  constructor(x, y, speedScale, target) {
    super('medium', x, y, speedScale);
    this.type = 'bomber';
    this.w = 44; this.h = 38;
    this.hp = 2; this.maxHp = 2;
    this.score = 380;
    this.dropChance = 0.40;
    this.vy *= 0.75;
    this._target = target;
    this.dropTimer = rand(2.2, 3.5);
    this.fireRate = 999; this.fireTimer = 999;   // ne tire pas
    this.color = '#ffaa22';
    this._render = null;
  }
  /** Retourne une bombe prête si une doit être lâchée ce tick, sinon null. */
  maybeDropBomb(dt) {
    this.dropTimer -= dt;
    if (this.dropTimer > 0 || !this._target) return null;
    this.dropTimer = rand(2.8, 4.2);
    return new BomberBomb(this.x, this.y + this.h / 2, this._target.x, this._target.y);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flashTimer > 0) ctx.filter = 'brightness(3)';
    const w = this.w, h = this.h;
    // Fuselage
    ctx.shadowColor = '#ffaa22'; ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#ffcc55');
    g.addColorStop(1, '#aa5500');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.42);
    ctx.lineTo(w * 0.45, 0);
    ctx.lineTo(w * 0.3, h * 0.45);
    ctx.lineTo(-w * 0.3, h * 0.45);
    ctx.lineTo(-w * 0.45, 0);
    ctx.closePath(); ctx.fill();
    // Soutes à bombes visibles
    ctx.fillStyle = '#553311';
    ctx.fillRect(-w * 0.25, h * 0.25, w * 0.5, h * 0.15);
    ctx.fillStyle = '#ff5500';
    ctx.beginPath(); ctx.arc(-w * 0.15, h * 0.32, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.15, h * 0.32, 3, 0, Math.PI * 2); ctx.fill();
    // Cockpit
    ctx.fillStyle = 'rgba(120,220,255,0.6)';
    ctx.beginPath(); ctx.arc(0, -h * 0.15, 5, 0, Math.PI * 2); ctx.fill();
    ctx.filter = 'none'; ctx.shadowBlur = 0;
    // Barre PV
    if (this.hp < this.maxHp) {
      const bw = w * 0.82, bh = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2, -h/2 - 9, bw, bh);
      ctx.fillStyle = '#ffaa22';
      ctx.fillRect(-bw/2, -h/2 - 9, bw * (this.hp / this.maxHp), bh);
    }
    ctx.restore();
  }
}

// ── Projectile BOMBE (retardée) ──────────────────────────────────────
class BomberBomb {
  constructor(x, y, targetX, targetY) {
    this.x = x; this.y = y;
    this.targetX = targetX; this.targetY = targetY;
    this.fuse = 3.0;        // 3 s avant explosion
    this.radius = 55;
    this.dead = false;
    // Marqueur de zone
    this.zoneX = targetX; this.zoneY = targetY;
  }
  update(dt, W, H, player, particles, audio, onHit) {
    this.fuse -= dt;
    // Trajectoire parabolique douce vers le point de largage
    const t = 1 - Math.max(0, this.fuse) / 3.0;
    this.x = this.zoneX + (this.x - this.zoneX) * (1 - t);
    this.y += 60 * dt;
    if (this.fuse <= 0) {
      // Explosion !
      this.dead = true;
      if (particles) spawnExplosion(particles, this.zoneX, this.zoneY, '#ff5500', 22, true);
      if (audio) audio.explosion(true);
      if (player && !player.invincible) {
        const dx = player.x - this.zoneX;
        const dy = player.y - this.zoneY;
        if (Math.hypot(dx, dy) < this.radius) {
          if (player.hit(particles, audio) && onHit) onHit();
        }
      }
    }
  }
  draw(ctx) {
    // Zone rouge indiquant l'impact
    const alpha = Math.max(0, this.fuse) / 3.0;
    ctx.save();
    // Cercle d'impact
    ctx.fillStyle = `rgba(255,50,50,${(1 - alpha) * 0.28 + 0.06})`;
    ctx.beginPath(); ctx.arc(this.zoneX, this.zoneY, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,50,50,${0.9})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(this.zoneX, this.zoneY, this.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Countdown texte
    const remaining = Math.max(0, this.fuse).toFixed(1);
    ctx.fillStyle = '#ffdd44';
    ctx.font = '900 12px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 10;
    ctx.fillText(remaining, this.zoneX, this.zoneY);
    ctx.shadowBlur = 0;
    // Bombe qui tombe
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,${100 + Math.sin(Date.now() * 0.015) * 80 | 0},0,1)`;
    ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════
// Helper : sélection pondérée d'un type d'ennemi spécial pour la Survie
// (utilisé par WaveManager patch en Survie)
// ═════════════════════════════════════════════════════════════════════
function _pickSpecialEnemyType(level) {
  if (level < 4) return null;
  // 20 % de chance d'ennemi spécial à partir du niveau 4, 35 % à partir de v10
  const chance = level < 10 ? 0.20 : 0.35;
  if (Math.random() > chance) return null;
  const pool = [];
  pool.push('kamikaze');
  if (level >= 6) pool.push('armored');
  if (level >= 8) pool.push('healer');
  if (level >= 10) pool.push('bomber');
  return pool[Math.floor(Math.random() * pool.length)];
}
