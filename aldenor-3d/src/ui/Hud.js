import { ELEMENT_INFO } from '../systems/combat/elementalReactions.js';

/**
 * Hud — interface DOM par-dessus le canvas WebGL (jamais en 3D).
 * Barres : PV, énergie (ultime), stamina, charge de la lourde ;
 * boîtes compétence (E, cooldown) et ultime (R) ; barre de la cible
 * verrouillée ; FPS + infos debug.
 */
export class Hud {
  constructor() {
    this.fpsEl = document.getElementById('fps');
    this.infoEl = document.getElementById('info');
    this.pvEl = document.getElementById('pv');
    this.energieEl = document.getElementById('energie');
    this.staminaWrap = document.getElementById('stamina-wrap');
    this.staminaEl = document.getElementById('stamina');
    this.chargeWrap = document.getElementById('charge-wrap');
    this.chargeEl = document.getElementById('charge');
    this.skillNom = document.getElementById('skill-nom');
    this.skillCd = document.getElementById('skill-cd');
    this.ultBox = document.getElementById('ult-box');
    this.ultEtat = document.getElementById('ult-etat');
    this.targetWrap = document.getElementById('target-wrap');
    this.targetNom = document.getElementById('target-nom');
    this.targetBar = document.getElementById('target-bar');
    this._frames = 0;
    this._acc = 0;
    this._world = null;
    this._player = null;
    this._combat = null;
  }

  attachWorld(world) { this._world = world; }
  attachPlayer(player) { this._player = player; }
  attachCombat(combat) { this._combat = combat; }

  update(dt, _elapsed) {
    const p = this._player, c = this._combat;

    /* --- chaque frame : barres réactives --- */
    if (p && this.pvEl) {
      this.pvEl.style.width = `${(p.pv / p.pvmax) * 100}%`;
    }
    if (c) {
      const s = c.stamina;
      this.staminaEl.style.width = `${(s.val / s.max) * 100}%`;
      this.staminaWrap.style.opacity = s.val < s.max - 0.5 ? '1' : '0';

      const sk = c.skills;
      this.energieEl.style.width = `${(sk.energie / sk.energieMax) * 100}%`;
      this.energieEl.classList.toggle('pleine', sk.energie >= sk.energieMax);

      // charge de la lourde
      const ratio = c.combo.chargeRatio;
      this.chargeWrap.style.display = ratio > 0 ? 'block' : 'none';
      if (ratio > 0) this.chargeEl.style.width = `${ratio * 100}%`;

      // compétence + ultime
      const info = ELEMENT_INFO[sk.element];
      this.skillNom.textContent = sk.skill.nom;
      this.skillNom.style.color = info.couleur;
      this.skillCd.textContent = sk.cooldown > 0 ? sk.cooldown.toFixed(1) + 's' : 'prêt';
      this.skillCd.style.color = sk.cooldown > 0 ? '#8a8270' : '#a8e88a';
      const pret = sk.energie >= sk.energieMax;
      this.ultBox.classList.toggle('pret', pret);
      this.ultEtat.textContent = pret ? 'ULTIME PRÊT' : `${Math.floor(sk.energie)}/${sk.energieMax}`;

      // cible verrouillée
      const cible = c.lockOn.target;
      this.targetWrap.style.display = cible ? 'block' : 'none';
      if (cible) {
        this.targetNom.textContent = `${cible.def.nom} — niv. ${cible.lvl}`;
        this.targetBar.style.width = `${(cible.pv / cible.pvmax) * 100}%`;
      }
    }

    /* --- 2×/s : FPS + infos --- */
    this._frames++;
    this._acc += dt;
    if (this._acc >= 0.5) {
      const fps = Math.round(this._frames / this._acc);
      this.fpsEl.textContent = `${fps} FPS`;
      this.fpsEl.style.color = fps >= 55 ? '#80c880' : fps >= 30 ? '#e8c860' : '#e06050';
      if (this._world && this.infoEl) {
        const h = Math.floor(this._world.timeOfDay * 24);
        const mn = Math.floor((this._world.timeOfDay * 24 % 1) * 60);
        let txt = `${this._world.debugInfo} · ${String(h).padStart(2, '0')}h${String(mn).padStart(2, '0')}`;
        if (p) txt += ` · (${Math.round(p.position.x)}, ${Math.round(p.position.z)})${p.swimming ? ' · 🏊' : ''}`;
        if (c) txt += ` · ${c.enemies.filter(e => !e.dead).length} ennemis${c.enCombat ? ' ⚔' : ''}`;
        this.infoEl.textContent = txt;
      }
      this._frames = 0;
      this._acc = 0;
    }
  }
}
