'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons.js  —  Système d'armes évolutif StarBlast (6 armes)
   Slots 1-3 : Blaster, Twin Cannon, Spread Shot
   Slots 4-6 : Storm Blaster (burst), Nova Spread (5-way), Devastator (beam)
   - Persistance localStorage (armes déverrouillées + arme sélectionnée)
   - La couleur de laser équipée s'applique à toutes les armes sauf Devastator
     (qui garde son rouge caractéristique).
───────────────────────────────────────────────────────────────────────── */

// ═════════════════════════════════════════════════════════════════════
// ARMES BOUTIQUE (PREMIUM) — 6 mécaniques radicales + Void conservé
// Slots 7-13 (indices 6-12 dans le tableau global des armes).
// Chaque arme est définie dans son propre fichier weapons/<id>.js
// et s'enregistre dans PREMIUM_WEAPON_HOOKS via registerPremiumWeapon().
// ═════════════════════════════════════════════════════════════════════

// Registre des mécaniques (rempli par les modules weapons/*.js)
window.PREMIUM_WEAPON_HOOKS = window.PREMIUM_WEAPON_HOOKS || {};

/** API pour un module weapons/*.js — enregistre les hooks d'une arme. */
window.registerPremiumWeapon = function(id, hooks) {
  window.PREMIUM_WEAPON_HOOKS[id] = hooks;
};

const PREMIUM_WEAPONS = [
  { id:'parasite',   name:'PARASITE',           icon:'🦠', price:50000,  rarity:'rare',
    desc:'Infecte les ennemis — chaînes de contagion illimitées', fireRate:0.35, damage:0, custom:true },
  { id:'mirror-time',name:'MIROIR TEMPOREL',    icon:'⏳', price:80000,  rarity:'rare',
    desc:'Alt = replay 6s de tirs en 2s (déluge doré)', fireRate:0.21, damage:1, custom:true },
  { id:'architect',  name:'ARCHITECTE',         icon:'🔷', price:120000, rarity:'epic',
    desc:'Pose des tourelles autonomes (6 max, 8s de durée)', fireRate:0.35, damage:0, custom:true },
  { id:'singularity',name:'SINGULARITÉ NOIRE',  icon:'⚫', price:180000, rarity:'epic',
    desc:'Micro trous noirs qui aspirent tout puis explosent', fireRate:0.5, damage:0, custom:true },
  { id:'void',       name:'VOID RIPPER',        icon:'🌑', price:350000, rarity:'legendary',
    desc:'Ignore boucliers/blindages + déchirure spatiale', fireRate:0.35, damage:12 },
  { id:'echo',       name:'ÉCHO QUANTIQUE',     icon:'👥', price:350000, rarity:'legendary',
    desc:'Alt = fantôme quantique qui rejoue vos actions (2 max)', fireRate:0.21, damage:1, custom:true },
  { id:'wargod',     name:'DIEU DE LA GUERRE',  icon:'🔱', price:999999, rarity:'legendary',
    desc:'Alt (100 IRE) = transformation divine 10s (invincible + 8-way)', fireRate:0.15, damage:1.5, custom:true },
];

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

/**
 * Helper : retourne l'arme au slot combiné (0-5 = tactique, 6-11 = premium).
 */
function getWeaponAt(idx) {
  if (idx < WEAPON_DEFS.length) return WEAPON_DEFS[idx];
  return PREMIUM_WEAPONS[idx - WEAPON_DEFS.length];
}
/** Nombre total de slots (tactiques + premium). */
function totalWeaponSlots() { return WEAPON_DEFS.length + PREMIUM_WEAPONS.length; }
function isPremiumIdx(idx) { return idx >= WEAPON_DEFS.length; }

// ── WeaponManager ────────────────────────────────────────────────────
class WeaponManager {
  constructor() {
    this.current   = 0;
    this.unlocked  = new Set(['blaster']);          // armes tactiques débloquées par vague
    this.ownedPremium = new Set();                  // armes boutique possédées
    this.ammo     = {};
    this.reloadCd = {};
    this._wasFiring = false;

    // Burst state (Storm Blaster)
    this._burstShotsLeft = 0;
    this._burstTimer     = 0;
    this._burstPauseT    = 0;

    // Beam state (Devastator)
    this._beamHeat       = 0;
    this._beamOverheated = false;
    this._beamOverheatT  = 0;

    // Solar Flare Cannon state
    this._solarMode      = 'pulse';    // 'pulse' | 'corona'
    this._solarCharge    = 0;          // 0..1.5s pour Corona
    this._solarAmmo      = 3;          // charges Corona
    this._solarReloadT   = 0;          // recharge Corona

    for (const d of WEAPON_DEFS) {
      this.ammo[d.id]     = isFinite(d.maxAmmo) ? d.maxAmmo : 0;
      this.reloadCd[d.id] = 0;
    }
    this._load();
    this._loadPremium();
  }

  // ── Persistance ────────────────────────────────────────────────
  _save() {
    localStorage.setItem('starblast_weapons', JSON.stringify({
      unlocked: [...this.unlocked],
      selected: getWeaponAt(this.current)?.id || 'blaster',
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
  _savePremium() {
    localStorage.setItem('starblast_weapons_shop', JSON.stringify({
      owned: [...this.ownedPremium],
    }));
  }
  _loadPremium() {
    const raw = JSON.parse(localStorage.getItem('starblast_weapons_shop') || 'null');
    if (!raw || !Array.isArray(raw.owned)) return;
    raw.owned.forEach(id => this.ownedPremium.add(id));
  }
  /** Achète une arme boutique (Game l'appelle après validation des pièces). */
  buyPremium(id) {
    if (!PREMIUM_WEAPONS.some(w => w.id === id)) return false;
    this.ownedPremium.add(id);
    this._savePremium();
    return true;
  }
  /** Est-ce que le joueur possède l'arme boutique donnée ? */
  ownsPremium(id) { return this.ownedPremium.has(id); }

  // ── Helpers ────────────────────────────────────────────────────
  def(idx = this.current) { return getWeaponAt(idx); }
  isUnlocked(id) {
    if (this.unlocked.has(id)) return true;
    return this.ownedPremium.has(id);
  }
  /** Vrai si le slot idx est activable maintenant. */
  isSlotUsable(idx) {
    const d = getWeaponAt(idx);
    if (!d) return false;
    if (idx < WEAPON_DEFS.length) return this.unlocked.has(d.id);
    return this.ownedPremium.has(d.id);
  }
  hasAmmo(idx = this.current) {
    const d = this.def(idx);
    if (!d) return false;
    if (!isFinite(d.maxAmmo) && !d.maxAmmo) return true;   // undefined maxAmmo → infinite
    if (!isFinite(d.maxAmmo)) return true;
    return this.ammo[d.id] > 0;
  }
  chargeProgress() {
    // Solar Flare : progression de charge Corona
    const d = this.def();
    if (d && d.hasCorona && this._solarMode === 'corona') return this._solarCharge / 1.5;
    return 0;
  }

  heatRatio() {
    const d = this.def();
    if (!d || !d.isBeam) return 0;
    // Photon Lance n'a pas de heatMax (permanent) → 0
    if (!d.heatMax) return 0;
    return Math.min(1, this._beamHeat / d.heatMax);
  }
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
    this._solarAmmo = 3; this._solarReloadT = 0; this._solarCharge = 0;
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
    if (idx < 0 || idx >= totalWeaponSlots()) return false;
    if (!this.isSlotUsable(idx)) return false;
    this.current = idx;
    // Reset des états spécifiques (transition d'arme)
    this._burstShotsLeft = 0; this._burstTimer = 0; this._burstPauseT = 0;
    this._beamHeat = 0; this._beamOverheated = false; this._beamOverheatT = 0;
    this._solarCharge = 0;
    this._wasFiring = false;
    this._save();
    return true;
  }
  switchBy(delta) {
    const n = totalWeaponSlots();
    let next = this.current;
    for (let i = 0; i < n; i++) {
      next = (next + delta + n) % n;
      if (this.isSlotUsable(next)) { this.select(next); return true; }
    }
    return false;
  }
  /** Bascule mode Pulse/Corona pour Solar Flare (touche Alt). */
  toggleSolarMode() {
    const d = this.def();
    if (!d || !d.hasCorona) return false;
    this._solarMode = this._solarMode === 'pulse' ? 'corona' : 'pulse';
    this._solarCharge = 0;
    return true;
  }
  solarMode() { return this._solarMode; }
  solarAmmo() { return this._solarAmmo; }
  solarReloadRatio() { return this._solarReloadT > 0 ? 1 - (this._solarReloadT / 20) : 1; }

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

    // Devastator ou Photon Lance (beam) : gestion chaleur / surchauffe (Photon = pas de surchauffe)
    if (d.isBeam) {
      if (d.heatMax) {
        // Devastator (surchauffe)
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
          this._beamHeat = Math.max(0, this._beamHeat - dt * 1.6);
        }
      }
      // Photon Lance : pas de surchauffe, rien à faire
      this._wasFiring = isFiring;
      return null;
    }

    // Solar Flare Cannon : gestion du mode Pulse/Corona + charge + recharge
    if (d.hasCorona) {
      // Recharge des munitions Corona (1 charge / 20 s)
      if (this._solarAmmo < 3) {
        this._solarReloadT -= dt;
        if (this._solarReloadT <= 0) {
          this._solarAmmo++;
          this._solarReloadT = this._solarAmmo < 3 ? 20 : 0;
        }
      } else {
        this._solarReloadT = 0;
      }
      // Mode Corona : charge en maintenant tir
      if (this._solarMode === 'corona') {
        if (isFiring && this._solarAmmo > 0) {
          this._solarCharge += dt;
          if (this._solarCharge >= 1.5) {
            // Nova prête !
            this._solarCharge = 0;
            this._solarAmmo--;
            if (this._solarAmmo < 3 && this._solarReloadT <= 0) this._solarReloadT = 20;
            this._wasFiring = isFiring;
            return 'nova';   // signal spécial pour Game
          }
        } else {
          this._solarCharge = Math.max(0, this._solarCharge - dt * 2);
        }
        this._wasFiring = isFiring;
        return null;
      }
      // Mode Pulse : fire cadence normale via Player.fire
      this._wasFiring = isFiring;
      return null;
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

  /** Beam state pour le Game. Retourne null si l'arme actuelle n'est pas un beam. */
  getBeamState(player, isFiring) {
    const d = this.def();
    if (!d || !d.isBeam) return null;
    // Photon Lance = pas d'overheat
    const active = isFiring && (d.heatMax ? !this._beamOverheated : true);
    return {
      id:          d.id,                    // 'plasma' (Devastator) ou 'photon' (Photon Lance)
      isPhoton:    d.id === 'photon',       // détruit les balles ennemies
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

      // ── VOID RIPPER (conservé tel quel) ─────────────────────
      case 'void': {
        const b = makeBullet(px, py, 0, -CFG.BULLET_SPEED * 1.3, color, lt, damage, false);
        b.w *= 1.6; b.h *= 1.8;
        b.isVoid = true;
        b.pierce = true;
        b._hitSet = new Set();
        b._voidTrail = [];
        b.color = '#0a0014';
        bullets.push(b);
        audio.shoot();
        return 1;
      }

      // ── ARMES BOUTIQUE À MÉCANIQUE (délèguent aux modules weapons/*.js) ──
      default: {
        const hooks = window.PREMIUM_WEAPON_HOOKS && window.PREMIUM_WEAPON_HOOKS[d.id];
        if (hooks && hooks.onFire) {
          return hooks.onFire(this, player, bullets, audio, window.game) || 0;
        }
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
