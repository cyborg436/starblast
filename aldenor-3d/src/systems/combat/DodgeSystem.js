import * as THREE from 'three';

/**
 * DodgeSystem — esquive-roulade directionnelle.
 *
 *  - direction = input courant, sinon PAS EN ARRIÈRE (recul du perso)
 *  - i-frames sur les ~60 % CENTRAUX de la roulade : [20 %, 80 %]
 *  - coût stamina 20 ; si insuffisant → "essoufflement" (petite anim,
 *    PAS d'i-frames, pas de déplacement)
 *  - DODGE CANCEL : annule les attaques légères en cours ; jamais la
 *    lourde (charge ou frappe)
 *
 * Valeurs de départ :
 */
const DUREE = 0.42;            // durée de la roulade (s)
const IFRAMES = [0.2, 0.8];    // fenêtre d'invincibilité (fractions de DUREE)
const VITESSE = 11;            // vitesse initiale (décélère jusqu'à ~15 %)
const COUT = 20;               // stamina
const COOLDOWN = 0.12;         // anti-spam entre deux esquives

export class DodgeSystem {
  constructor(cs) {
    this.cs = cs;
    this.lock = null;          // 'dodge' | 'tired' | null
    this.t = 0;
    this._cd = 0;
    this.dir = new THREE.Vector3();
  }

  get iframesActive() {
    return this.lock === 'dodge' && this.t >= DUREE * IFRAMES[0] && this.t <= DUREE * IFRAMES[1];
  }

  update(dt) {
    const { input, player, combo } = this.cs;
    this._cd = Math.max(0, this._cd - dt);

    if (this.lock) {
      this.t += dt;
      const duree = this.lock === 'dodge' ? DUREE : 0.5; // essoufflement : 0,5 s
      if (this.t >= duree) this.lock = null;
      return;
    }

    if (!input.wasActionPressed('dodge')) return;
    if (this._cd > 0 || !player.grounded || player.swimming || player.dead) return;
    // dodge cancel : autorisé sur les attaques légères uniquement
    if (combo.lock) {
      if (!combo.cancelableParEsquive) return;
      combo.cancel();
    }
    if (this.cs.skills.lock) return;

    if (!this.cs.stamina.spend(COUT)) {
      // essoufflement : feedback clair, aucune i-frame
      this.lock = 'tired';
      this.t = 0;
      player.anim.play('tired', { force: true });
      return;
    }

    // direction : input courant, sinon vers l'arrière du personnage
    this.lock = 'dodge';
    this.t = 0;
    this._cd = DUREE + COOLDOWN;
    if (player.inputDir.lengthSq() > 0.01) this.dir.copy(player.inputDir).normalize();
    else this.dir.set(-Math.sin(player.facing.rotation.y), 0, -Math.cos(player.facing.rotation.y));
    player.anim.play('dodge', { force: true });
    this.cs.juice.swing(0.4);
  }

  /** Contrainte de déplacement pendant la roulade. */
  get moveOverride() {
    if (this.lock === 'dodge') {
      const p = 1 - this.t / DUREE;
      return { vitesse: VITESSE * Math.max(p, 0.15), dir: this.dir };
    }
    if (this.lock === 'tired') return { vitesse: 0 };
    return null;
  }
}
