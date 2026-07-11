import * as THREE from 'three';

/**
 * HitDetection — fenêtres de hitbox synchronisées sur l'animation.
 *
 * AUCUNE détection permanente : chaque attaque enregistre une fenêtre
 * [début, fin] (en secondes depuis le départ de l'animation — timestamps
 * codés par animation dans ComboSystem/SkillSystem). Pendant la fenêtre
 * uniquement, un SPHERE-CAST est balayé le long de la trajectoire de
 * l'arme : la sphère est placée devant le joueur (portée × direction du
 * coup) à chaque frame de la fenêtre — le balayage temporel couvre
 * l'arc du coup. Un ennemi n'est touché qu'UNE fois par fenêtre.
 *
 * Descripteur de fenêtre :
 *  { debut, fin,            — bornes en s depuis le début du coup
 *    portee, rayon,         — sphère de la lame (m)
 *    arc,                   — demi-angle balayé (rad) autour de la direction
 *    onHit(ennemi) }        — callback : CombatSystem.applyHit(...)
 */
export class HitDetection {
  constructor(cs) {
    this.cs = cs; // hub CombatSystem
    this.windows = [];
    this._v = new THREE.Vector3();
  }

  /** Enregistre une fenêtre pour le coup en cours. */
  queue(desc) {
    this.windows.push({ ...desc, t: 0, touches: new Set() });
  }

  /** Annule toutes les fenêtres (dodge cancel, mort…). */
  clear() {
    this.windows.length = 0;
  }

  update(dt) {
    const player = this.cs.player;
    const enemies = this.cs.enemies;
    for (let i = this.windows.length - 1; i >= 0; i--) {
      const w = this.windows[i];
      w.t += dt;
      if (w.t > w.fin) { this.windows.splice(i, 1); continue; }
      if (w.t < w.debut) continue;

      // sphère de la lame, balayée dans l'arc pendant la fenêtre.
      // La détection teste le COULOIR joueur → pointe de lame (distance au
      // segment), pas seulement la sphère au bout : un ennemi au corps à
      // corps (dans lequel on avance pendant le combo) est toujours touché.
      const prog = (w.t - w.debut) / Math.max(w.fin - w.debut, 1e-4); // 0..1
      const balayage = (prog - 0.5) * 2 * (w.arc ?? 0);               // -arc..+arc
      const angle = this.cs.attackFacing() + balayage;
      const px = player.position.x, pz = player.position.z;
      const sx = Math.sin(angle) * w.portee, sz = Math.cos(angle) * w.portee; // segment lame
      const oy = player.position.y + 1.1;
      const len2 = sx * sx + sz * sz;

      for (const e of enemies) {
        if (e.dead || w.touches.has(e)) continue;
        // point le plus proche du mob sur le segment [joueur → pointe]
        const ex = e.position.x - px, ez = e.position.z - pz;
        const t01 = Math.min(Math.max((ex * sx + ez * sz) / len2, 0), 1);
        const dx = ex - sx * t01, dz = ez - sz * t01;
        const dy = (e.position.y + e.hauteur * 0.5) - oy;
        const r = (w.rayon ?? 1.2) + e.rayon;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < 2.6) {
          w.touches.add(e);
          w.onHit(e);
        }
      }
    }
  }
}
