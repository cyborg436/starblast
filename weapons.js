'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons.js  —  Système d'armes évolutif StarBlast (6 armes)
   - Blaster (départ), Twin Cannon, Spread Shot, Railgun, Missile Swarm, Plasma Cannon
   - Persistance localStorage (armes déverrouillées + arme sélectionnée)
   - La couleur de laser équipée s'applique à tous les types de tirs.
───────────────────────────────────────────────────────────────────────── */

const WEAPON_DEFS = [
  { id:'blaster', name:'BLASTER',       icon:'🔫', wave:0,  maxAmmo:Infinity,
    fireRate:0.21, damage:1, chargeTime:0 },
  { id:'twin',    name:'TWIN CANNON',   icon:'⚔', wave:5,  maxAmmo:Infinity,
    fireRate:0.21, damage:1 },
  { id:'spread',  name:'SPREAD SHOT',   icon:'🔱', wave:10, maxAmmo:Infinity,
    fireRate:0.30, damage:1 },
  { id:'railgun', name:'RAILGUN',       icon:'⚡', wave:15, maxAmmo:3,
    fireRate:1.5,  damage:5, ammoReload:8.0, ammoPerReload:1 },
  { id:'missile', name:'MISSILE SWARM', icon:'🚀', wave:20, maxAmmo:6,
    fireRate:0.6,  damage:3, ammoReload:10.0, ammoPerReload:2, perShotAmmo:2 },
  { id:'plasma',  name:'PLASMA CANNON', icon:'💚', wave:25, maxAmmo:3,
    fireRate:0.4,  damage:15, ammoReload:12.0, ammoPerReload:1, chargeTime:0.8, explosionRadius:80 },
];

// ── WeaponManager ────────────────────────────────────────────────────
class WeaponManager {
  constructor() {
    this.current   = 0;                              // index dans WEAPON_DEFS
    this.unlocked  = new Set(['blaster']);           // toujours débloqué
    this.ammo     = {};                              // par id → munitions restantes
    this.reloadCd = {};                              // par id → cooldown rechargement
    this.charge   = 0;                               // charge plasma 0..chargeTime
    this._wasFiring = false;
    for (const d of WEAPON_DEFS) {
      this.ammo[d.id]     = isFinite(d.maxAmmo) ? d.maxAmmo : 0;
      this.reloadCd[d.id] = 0;
    }
    this._load();
  }

  // ── Persistance ────────────────────────────────────────────────
  _save() {
    localStorage.setItem('starblast_weapons', JSON.stringify({
      unlocked: [...this.unlocked],
      selected: WEAPON_DEFS[this.current]?.id || 'blaster',
    }));
  }
  _load() {
    const raw = JSON.parse(localStorage.getItem('starblast_weapons') || 'null');
    if (!raw) return;
    if (Array.isArray(raw.unlocked)) {
      raw.unlocked.forEach(id => this.unlocked.add(id));
    }
    if (raw.selected) {
      const idx = WEAPON_DEFS.findIndex(w => w.id === raw.selected);
      if (idx >= 0 && this.unlocked.has(raw.selected)) this.current = idx;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────
  def(idx = this.current) { return WEAPON_DEFS[idx]; }
  isUnlocked(id) { return this.unlocked.has(id); }
  hasAmmo(idx = this.current) {
    const d = this.def(idx);
    if (!isFinite(d.maxAmmo)) return true;
    return this.ammo[d.id] > 0;
  }
  chargeProgress() {
    const d = this.def();
    if (!d.chargeTime) return 0;
    return Math.min(1, this.charge / d.chargeTime);
  }

  /** Recharge complète (power-up RECHARGEMENT). */
  rechargeAll() {
    for (const d of WEAPON_DEFS) {
      if (isFinite(d.maxAmmo)) {
        this.ammo[d.id] = d.maxAmmo;
        this.reloadCd[d.id] = 0;
      }
    }
  }

  /** Déverrouille les armes selon la vague atteinte. Retourne les nouvelles armes déverrouillées. */
  unlockUpToWave(waveLevel) {
    const newly = [];
    for (const d of WEAPON_DEFS) {
      if (!this.unlocked.has(d.id) && waveLevel >= d.wave && d.wave > 0) {
        this.unlocked.add(d.id);
        newly.push(d);
      }
    }
    if (newly.length > 0) this._save();
    return newly;
  }

  /** Switch d'arme par index, par delta (molette), ou par id. */
  select(idx) {
    if (idx < 0 || idx >= WEAPON_DEFS.length) return false;
    if (!this.unlocked.has(WEAPON_DEFS[idx].id)) return false;
    this.current  = idx;
    this.charge   = 0;
    this._wasFiring = false;
    this._save();
    return true;
  }
  switchBy(delta) {
    const n = WEAPON_DEFS.length;
    let next = this.current;
    for (let i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      if (this.unlocked.has(WEAPON_DEFS[next].id)) { this.select(next); return true; }
    }
    return false;
  }

  // ── Update : recharge ammo + tick charge ──────────────────────
  /**
   * @param dt        delta-time
   * @param isFiring  bouton de tir maintenu
   * @returns 'fire' si un tir doit être déclenché ce frame, sinon null
   */
  tick(dt, isFiring) {
    // Recharge automatique des armes à munitions
    for (const d of WEAPON_DEFS) {
      if (!isFinite(d.maxAmmo) || !d.ammoReload) continue;
      if (this.ammo[d.id] >= d.maxAmmo) { this.reloadCd[d.id] = 0; continue; }
      this.reloadCd[d.id] += dt;
      if (this.reloadCd[d.id] >= d.ammoReload) {
        this.reloadCd[d.id] -= d.ammoReload;
        this.ammo[d.id] = Math.min(d.maxAmmo, this.ammo[d.id] + (d.ammoPerReload || 1));
      }
    }

    // Gestion de la charge (Plasma)
    const def = this.def();
    if (def.chargeTime) {
      if (isFiring && this.hasAmmo()) {
        this.charge += dt;
        if (this.charge >= def.chargeTime) {
          this.charge = 0;
          this._wasFiring = isFiring;
          return 'fire';   // déclenche le tir une fois la charge complète
        }
      } else {
        // relâche → reset
        this.charge = 0;
      }
      this._wasFiring = isFiring;
      return null;
    }

    // Autres armes : gérée par Player.fire via cooldown classique
    this._wasFiring = isFiring;
    return null;
  }

  /** Consomme 1 munition (ou perShotAmmo) pour l'arme courante. Retourne false si vide. */
  consumeAmmo() {
    const d = this.def();
    if (!isFinite(d.maxAmmo)) return true;
    const cost = d.perShotAmmo || 1;
    if (this.ammo[d.id] < cost) return false;
    this.ammo[d.id] -= cost;
    return true;
  }

  /**
   * Tire avec l'arme courante. Pousse les bullets/missiles dans `bullets`.
   * @returns nombre de projectiles tirés (0 si rien)
   */
  fire(player, bullets, audio) {
    const d = this.def();
    if (!this.hasAmmo()) return 0;
    const color = player.bulletColor || '#ffffff';
    const lt    = player.laserType;
    const px = player.x, py = player.y - player.h * 0.46;
    const damage = d.damage;

    switch (d.id) {
      case 'blaster': {
        bullets.push(makeBullet(px, py, 0, -CFG.BULLET_SPEED, color, lt, damage, player.surcharge));
        audio.shoot();
        return 1;
      }
      case 'twin': {
        bullets.push(makeBullet(px - 12, py, 0, -CFG.BULLET_SPEED, color, lt, damage, player.surcharge));
        bullets.push(makeBullet(px + 12, py, 0, -CFG.BULLET_SPEED, color, lt, damage, player.surcharge));
        audio.shootDouble();
        return 2;
      }
      case 'spread': {
        const s = CFG.BULLET_SPEED;
        // Éventail : -15°, 0°, +15°
        [-0.26, 0, 0.26].forEach(a => {
          const b = makeBullet(px, py, Math.sin(a) * s, -Math.cos(a) * s, color, lt, damage, player.surcharge);
          b.w *= 1.5;                                            // projectiles plus épais
          bullets.push(b);
        });
        audio.shoot(); audio.shoot();
        return 3;
      }
      case 'railgun': {
        if (!this.consumeAmmo()) return 0;
        const b = makeBullet(px, py, 0, -CFG.BULLET_SPEED * 2.2, color, lt, damage, false);
        b.pierce    = true;
        b.isRailgun = true;
        b._hitSet   = new Set();
        b.w = 8; b.h = 36;
        bullets.push(b);
        audio.bossAlert();                                        // bruit de décharge énergétique
        return 1;
      }
      case 'missile': {
        if (!this.consumeAmmo()) return 0;
        // Spawn 2 missiles (perShotAmmo = 2)
        bullets.push(new Missile(px - 8, py, color, damage, /* targetSide */ -1));
        bullets.push(new Missile(px + 8, py, color, damage, +1));
        audio.shoot();
        return 2;
      }
      case 'plasma': {
        if (!this.consumeAmmo()) return 0;
        bullets.push(new PlasmaBall(px, py, color, damage, d.explosionRadius));
        audio.bomb();
        return 1;
      }
    }
    return 0;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function makeBullet(x, y, vx, vy, color, laserType, damage, surcharge) {
  const b = new Bullet(x, y, vx, vy, color, true, laserType);
  b.damage = damage || 1;
  if (surcharge) { b.w *= 2.2; b.h *= 1.35; }
  return b;
}

// ── Missile : projectile à tête chercheuse + AoE à l'impact ─────────
class Missile extends Bullet {
  constructor(x, y, color, damage, sideHint) {
    super(x, y, sideHint * 60, -260, color, true, '');
    this.damage = damage;
    this.w = 4; this.h = 12;
    this.isMissile = true;
    this.explosionRadius = 36;
    this.maxSpeed = 360;
    this.turnRate = 4.5;        // rad/s
    this.target   = null;
    this._smokeCd = 0;
    this.life     = 4.0;        // durée maximum
  }

  /** Recherche d'une cible parmi les ennemis vivants. */
  _findTarget(enemies) {
    let best = null, bestD2 = Infinity;
    for (const e of enemies) {
      if (e.dead || e.dying) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  update(dt, W, H, enemies, particles) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // Cible si encore vivante
    if (!this.target || this.target.dead || this.target.dying) {
      this.target = enemies ? this._findTarget(enemies) : null;
    }

    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const desired = Math.atan2(dy, dx);
      const cur = Math.atan2(this.vy, this.vx);
      let diff = desired - cur;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = clamp(diff, -this.turnRate * dt, this.turnRate * dt);
      const newAngle = cur + step;
      // Accélère jusqu'à maxSpeed
      const curSpeed = Math.hypot(this.vx, this.vy);
      const newSpeed = Math.min(this.maxSpeed, curSpeed + 280 * dt);
      this.vx = Math.cos(newAngle) * newSpeed;
      this.vy = Math.sin(newAngle) * newSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Traînée de fumée
    this._smokeCd -= dt;
    if (this._smokeCd <= 0 && particles && particles.length < 280) {
      this._smokeCd = 0.04;
      particles.push(new Particle(
        this.x + rand(-1, 1), this.y + 6,
        rand(-10, 10), rand(20, 60),
        Math.random() < 0.5 ? 'rgba(220,220,220,0.5)' : 'rgba(255,180,100,0.6)',
        rand(0.3, 0.55), rand(1.5, 3.2)
      ));
    }

    if (this.y < -30 || this.y > H + 30 || this.x < -30 || this.x > W + 30) this.dead = true;
  }

  /** Explose en AoE et endommage les ennemis dans le rayon. */
  explode(enemies, particles, audio, onKill) {
    const r2 = this.explosionRadius * this.explosionRadius;
    for (const e of enemies) {
      if (e.dead || e.dying) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy > r2) continue;
      if (e.hit(this.damage)) {
        e.dead = true;
        if (onKill) onKill(e);
      }
    }
    spawnExplosion(particles, this.x, this.y, '#ffaa55', 16, true);
    audio.explosion(false);
    this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    // Corps blanc
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.color; ctx.shadowBlur = 8;
    ctx.fillRect(-2, -6, 4, 12);
    // Nose
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(-2, -5); ctx.lineTo(2, -5); ctx.closePath();
    ctx.fillStyle = this.color; ctx.fill();
    // Flame
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(-1.5, 6, 3, 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── PlasmaBall : projectile en arc + explosion AoE ──────────────────
class PlasmaBall extends Bullet {
  constructor(x, y, color, damage, explosionRadius) {
    super(x, y, 0, -340, color, true, '');
    this.damage = damage;
    this.w = 20; this.h = 20;
    this.isPlasma = true;
    this.explosionRadius = explosionRadius;
    this.life = 2.0;
    this.t = 0;
  }

  update(dt, W, H) {
    this.t += dt;
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.life <= 0 || this.y < -40) this.dead = true;
  }

  explode(enemies, particles, audio, onKill) {
    const r2 = this.explosionRadius * this.explosionRadius;
    for (const e of enemies) {
      if (e.dead || e.dying) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy > r2) continue;
      if (e.hit(this.damage)) {
        e.dead = true;
        if (onKill) onKill(e);
      }
    }
    spawnBoom(particles, this.x, this.y, 'medium', null);
    spawnExplosion(particles, this.x, this.y, this.color, 24, true);
    audio.bomb();
    this.dead = true;
  }

  draw(ctx) {
    const t = this.t;
    const pulse = 1 + 0.18 * Math.sin(t * 18);
    const r = (this.w / 2) * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Halo extérieur
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
    grad.addColorStop(0,    this.color);
    grad.addColorStop(0.4,  '#00ffaa');
    grad.addColorStop(0.75, 'rgba(0,255,170,0.3)');
    grad.addColorStop(1,    'rgba(0,255,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill();
    // Noyau brillant
    ctx.shadowColor = this.color; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
