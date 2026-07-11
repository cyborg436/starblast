/**
 * StaggerSystem — jauge de POISE, distincte de la vie.
 *
 *  - chaque coup vide la poise (valeur "poise" du coup)
 *  - la poise se régénère lentement (8/s) après 1,5 s sans coup
 *  - à zéro → état "staggered" : l'ennemi titube DUREE_STAGGER secondes,
 *    n'agit plus, et subit ×1,5 dégâts (vulnérabilité)
 *  - à la sortie du stagger, la poise repart pleine
 *
 * La poise max d'un ennemi est proportionnelle à sa vie max (les gros
 * mobs encaissent plus avant de tituber) : poiseMax = 30 + pvMax × 0.5.
 */

export const DUREE_STAGGER = 1.4;
export const MULT_DEGATS_STAGGER = 1.5;
const REGEN_POISE = 8;
const DELAI_REGEN = 1.5;

export function initPoise(ennemi) {
  ennemi.poiseMax = Math.round(30 + ennemi.pvmax * 0.5);
  ennemi.poise = ennemi.poiseMax;
  ennemi.staggerT = 0;       // > 0 → staggered
  ennemi._poiseDelai = 0;
}

/** Inflige des dégâts de poise. Retourne true si le stagger se déclenche. */
export function damagePoise(ennemi, montant) {
  if (ennemi.staggerT > 0) return false; // déjà au sol
  ennemi.poise -= montant;
  ennemi._poiseDelai = DELAI_REGEN;
  if (ennemi.poise <= 0) {
    ennemi.staggerT = DUREE_STAGGER;
    ennemi.poise = 0;
    return true;
  }
  return false;
}

export function updatePoise(ennemi, dt) {
  if (ennemi.staggerT > 0) {
    ennemi.staggerT -= dt;
    if (ennemi.staggerT <= 0) ennemi.poise = ennemi.poiseMax; // récupère debout
    return;
  }
  ennemi._poiseDelai = Math.max(0, ennemi._poiseDelai - dt);
  if (ennemi._poiseDelai <= 0) {
    ennemi.poise = Math.min(ennemi.poiseMax, ennemi.poise + REGEN_POISE * dt);
  }
}
