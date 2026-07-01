'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons.js  —  Système d'armes évolutif StarBlast (6 armes)
   Slots 1-3 : Blaster, Twin Cannon, Spread Shot
   Slots 4-6 : Storm Blaster (burst), Nova Spread (5-way), Devastator (beam)
   - Persistance localStorage (armes déverrouillées + arme sélectionnée)
   - La couleur de laser équipée s'applique à toutes les armes sauf Devastator
     (qui garde son rouge caractéristique).
───────────────────────────────────────────────────────────────────────── */

const WEAPON_DEFS = [
  { id:'blaster', name:'BLASTER',        icon:'🔫', wave:0,  maxAmmo:Infinity,
    fireRate:0.21, damage:1 },
  { id:'twin',    name:'TWIN CANNON',    icon:'⚔',  wave:5,  maxAmmo:Infinity,
    fireRate:0.21, damage:1 },
  { id:'spread',  name:'SPREAD SHOT',    icon:'🔱', wave:10, maxAmmo:Infinity,
    fireRate:0.30, damage:1 },
  // ── Storm Blaster : burst 8 tirs en 0.5s + pause 0.8s ──
  { id:'railgun', name:'STORM BLASTER',  icon:'⚡', wave:15, maxAmmo:Infinity,
    fireRate:0.0625,                        // temps entre tirs d'un burst (0.5s / 8)
    damage:2,
    burstCount:8, burstPause:0.8 },
  // ── Nova Spread : tir en éventail 5 directions ──
  { id:'missile', name:'NOVA SPREAD',    icon:'🚀', wave:20, maxAmmo:Infinity,
    fireRate:0.21, damage:1.5 },
  // ── Devastator : rayon laser continu avec surchauffe ──
  { id:'plasma',  name:'DEVASTATOR',     icon:'💥', wave:25, maxAmmo:Infinity,
    isBeam:true, damagePerSec:8,
    heatMax:3.0, heatCooldown:1.5 },
];

// ── WeaponManager ────────────────────────────────────────────────────
class WeaponManager {
  constructor() {
    this.current   = 0;
    this.unlocked  = new Set(['blaster']);
    this.ammo     = {};
    this.reloadCd = {};
    this._wasFiring = false;

    // Burst state (Storm Blaster)
    this._burstShotsLeft = 0;         // tirs restants dans le burst en cours
    this._burstTimer     = 0;         // temps avant le prochain tir du burst
    this._burstPauseT    = 0;         // pause après un burst complet

    // Beam state (Devastator)
    this._beamHeat       = 0;         // 0..heatMax
    this._beamOverheated = false;     // vrai pendant heatCooldown
    this._beamOverheatT  = 0;         // temps restant en surchauffe

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
    if (Array.isArray(raw.unlocked)) raw.unlocked.forEach(id => this.unlocked.add(id));
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
  /** Ratio de charge (obsolète — armes rapides). Conservé pour compat HUD. */
  chargeProgress() { return 0; }

  /** Devastator : ratio de surchauffe 0..1. */
  heatRatio() {
    const d = this.def();
    if (!d.isBeam) return 0;
    return Math.min(1, this._beamHeat / d.heatMax);
  }
  /** Vrai si Devastator actuellement en surchauffe. */
  isOverheated() { return this._beamOverheated; }

  /** Recharge complète — reset des états spéciaux. */
  rechargeAll() {
    for (const d of WEAPON_DEFS) {
      if (isFinite(d.maxAmmo)) {
        this.ammo[d.id] = d.maxAmmo;
        this.reloadCd[d.id] = 0;
      }
    }
    this._burstShotsLeft = 0; this._burstTimer = 0; this._burstPauseT = 0;
    this._beamHeat = 0; this._beamOverheated = false; this._beamOverheatT = 0;
  }

  /** Déverrouille les armes selon la vague atteinte. */
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

  select(idx) {
    if (idx < 0 || idx >= WEAPON_DEFS.length) return false;
    if (!this.unlocked.has(WEAPON_DEFS[idx].id)) return false;
    this.current = idx;
    // Reset des états spécifiques
    this._burstShotsLeft = 0; this._burstTimer = 0; this._burstPauseT = 0;
    this._beamHeat = 0; this._beamOverheated = false; this._beamOverheatT = 0;
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

  // ── Update : gestion du burst Storm Blaster + surchauffe Devastator ──
  /**
   * @param dt        delta-time
   * @param isFiring  bouton de tir maintenu
   * @returns 'fire' si un tir doit être déclenché ce frame, sinon null
   *
   * Pour Devastator, le rendu et les dégâts du rayon sont gérés directement
   * par le Game via getBeamState() — ce tick renvoie null.
   */
  tick(dt, isFiring) {
    const d = this.def();

    // Devastator (beam) : gestion chaleur / surchauffe
    if (d.isBeam) {
      if (this._beamOverheated) {
        this._beamOverheatT -= dt;
        if (this._beamOverheatT <= 0) {
          this._beamOverheated = false;
          this._beamHeat = 0;
        }
      } else if (isFiring) {
        this._beamHeat += dt;
        if (this._beamHeat >= d.heatMax) {
          this._beamOverheated = true;
          this._beamOverheatT  = d.heatCooldown;
          this._beamHeat       = d.heatMax;
        }
      } else {
        // Refroidit à ~2× la vitesse quand on ne tire pas
        this._beamHeat = Math.max(0, this._beamHeat - dt * 1.6);
      }
      this._wasFiring = isFiring;
      return null;   // pas de projectile
    }

    // Storm Blaster : burst automatique
    if (d.burstCount) {
      if (this._burstPauseT > 0) {
        this._burstPauseT -= dt;
        this._wasFiring = isFiring;
        return null;
      }
      // Décrémente le timer entre tirs du burst
      if (this._burstShotsLeft > 0) {
        this._burstTimer -= dt;
        if (this._burstTimer <= 0) {
          this._burstShotsLeft--;
          this._burstTimer = d.fireRate;
          if (this._burstShotsLeft === 0) {
            this._burstPauseT = d.burstPause;
          }
          this._wasFiring = isFiring;
          return 'fire';
        }
      } else if (isFiring) {
        // Démarre un nouveau burst
        this._burstShotsLeft = d.burstCount - 1;
        this._burstTimer     = d.fireRate;
        this._wasFiring = isFiring;
        return 'fire';   // 1er tir immédiat
      }
      this._wasFiring = isFiring;
      return null;
    }

    // Autres armes : gérées via Player.fire (cooldown classique)
    this._wasFiring = isFiring;
    return null;
  }

  /** Beam state pour le Game. Retourne null si l'arme actuelle n'est pas Devastator. */
  getBeamState(player, isFiring) {
    const d = this.def();
    if (!d.isBeam) return null;
    const active = isFiring && !this._beamOverheated;
    return {
      active,
      overheated:  this._beamOverheated,
      heatRatio:   this.heatRatio(),
      damagePerSec: d.damagePerSec,
      x:      player ? player.x : 0,
      yStart: player ? player.y - player.h * 0.46 : 0,
    };
  }

  consumeAmmo() {
    const d = this.def();
    if (!isFinite(d.maxAmmo)) return true;
    const cost = d.perShotAmmo || 1;
    if (this.ammo[d.id] < cost) return false;
    this.ammo[d.id] -= cost;
    return true;
  }

  /**
   * Tire avec l'arme courante. Pousse les projectiles dans `bullets`.
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
        [-0.26, 0, 0.26].forEach(a => {
          const b = makeBullet(px, py, Math.sin(a) * s, -Math.cos(a) * s, color, lt, damage, player.surcharge);
          b.w *= 1.5;
          bullets.push(b);
        });
        audio.shoot(); audio.shoot();
        return 3;
      }
      case 'railgun': {
        // Storm Blaster : projectile bleu épais rapide qui traverse les faibles ennemis
        const s = CFG.BULLET_SPEED * 1.6;
        const b = makeBullet(px, py, 0, -s, '#66ccff', lt, damage, player.surcharge);
        b.w *= 3.0; b.h *= 1.4;
        b.pierce = true;
        b.pierceWeakOnly = true;   // stoppe sur ennemis de 2 PV+
        b._hitSet = new Set();
        b.isStorm = true;
        bullets.push(b);
        // Son de mitrailleuse (shoot rapide)
        audio.shoot();
        return 1;
      }
      case 'missile': {
        // Nova Spread : 5 projectiles en éventail (0, ±30°, ±60°)
        const s = CFG.BULLET_SPEED;
        const angles = [-Math.PI/3, -Math.PI/6, 0, Math.PI/6, Math.PI/3];
        angles.forEach(a => {
          const b = makeBullet(px, py, Math.sin(a) * s, -Math.cos(a) * s, color, lt, damage, player.surcharge);
          b.w *= 1.8;
          b.isNova = true;
          bullets.push(b);
        });
        audio.shootDouble();
        return 5;
      }
      case 'plasma': {
        // Devastator : rendu par beam, pas de projectile
        return 0;
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

// ── DevastatorBeam : rayon continu appliqué chaque frame par Game ──
// Non-classe : décrit par WeaponManager.getBeamState() + logique dans Game.
