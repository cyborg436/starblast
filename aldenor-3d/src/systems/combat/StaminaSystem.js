/**
 * StaminaSystem — endurance du joueur.
 *
 * Consommée par : sprint (drain continu), esquive, attaque lourde.
 * Régénération automatique après un court délai sans dépense,
 * PLUS RAPIDE hors combat (le drapeau enCombat vient de CombatSystem).
 *
 * Valeurs de départ (à retoucher librement) :
 *  - MAX 100
 *  - sprint : 12 / s
 *  - esquive : 20 (DodgeSystem)
 *  - attaque lourde : 25 (ComboSystem)
 *  - régén : 22 / s hors combat, 11 / s en combat
 *  - délai avant régén après une dépense : 0,7 s
 */

const MAX = 100;
const REGEN_HORS_COMBAT = 22;
const REGEN_EN_COMBAT = 11;
const DELAI_REGEN = 0.7;

export const COUT_SPRINT_PAR_S = 12;

export class StaminaSystem {
  constructor() {
    this.val = MAX;
    this.max = MAX;
    this._delai = 0;
  }

  /** A-t-on de quoi payer ? */
  canSpend(cost) {
    return this.val >= cost;
  }

  /** Dépense ponctuelle (esquive, lourde). Retourne false si insuffisant. */
  spend(cost) {
    if (this.val < cost) return false;
    this.val -= cost;
    this._delai = DELAI_REGEN;
    return true;
  }

  /** Drain continu (sprint). Retourne false quand la jauge est vide. */
  drain(dt, parSeconde = COUT_SPRINT_PAR_S) {
    this.val = Math.max(0, this.val - parSeconde * dt);
    this._delai = DELAI_REGEN;
    return this.val > 0;
  }

  update(dt, enCombat) {
    this._delai = Math.max(0, this._delai - dt);
    if (this._delai <= 0) {
      this.val = Math.min(this.max, this.val + (enCombat ? REGEN_EN_COMBAT : REGEN_HORS_COMBAT) * dt);
    }
  }
}
