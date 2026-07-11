/**
 * elementalReactions.js — table des ÉLÉMENTS et des RÉACTIONS (façon
 * Genshin, simplifié). Fichier volontairement autonome et déclaratif :
 * pour ajouter une réaction, une entrée dans REACTIONS suffit.
 *
 * Modèle :
 *  - un ennemi porte AU PLUS un élément appliqué : { type, ttl }
 *  - appliquer un élément sur un ennemi déjà marqué consulte la table
 *    avec la clé "elementExistant+elementApplique"
 *  - la réaction retourne un descripteur ; CombatSystem exécute les
 *    effets (multiplicateur, AoE, propagation, particules)
 */

export const ELEMENTS = ['feu', 'eau', 'foudre', 'vent'];

export const ELEMENT_INFO = {
  feu:    { nom: 'Feu',    couleur: '#ff7a30', particule: '#ff9a40' },
  eau:    { nom: 'Eau',    couleur: '#4fc3ff', particule: '#7ad8ff' },
  foudre: { nom: 'Foudre', couleur: '#c48cff', particule: '#e0b8ff' },
  vent:   { nom: 'Vent',   couleur: '#7de8b8', particule: '#a8f0d0' },
};

/** Durée de vie d'un élément appliqué sur un ennemi (secondes). */
export const DUREE_ELEMENT = 6;

/**
 * Table des réactions. Clé : "existant+applique".
 * Champs du descripteur :
 *  - nom        : affiché en gros au-dessus de la cible
 *  - mult       : multiplicateur appliqué aux dégâts du coup déclencheur
 *  - aoe        : { rayon, degats } dégâts de zone autour de la cible
 *  - propage    : { rayon } copie l'élément EXISTANT sur les ennemis proches
 *  - consomme   : true → l'élément de la cible est retiré après la réaction
 *  - couleur    : teinte des particules/nombre de dégâts
 *
 * NB : "vent" ne se dépose jamais comme marque — il ne sert qu'à
 * déclencher la Diffusion de l'élément déjà présent (cf. '*+vent').
 */
export const REACTIONS = {
  // Feu + Eau (dans les deux sens) → Vaporisation : gros bonus de dégâts
  'feu+eau':    { nom: 'Vaporisation', mult: 2.0, consomme: true, couleur: '#e8f4ff' },
  'eau+feu':    { nom: 'Vaporisation', mult: 2.0, consomme: true, couleur: '#e8f4ff' },
  // Eau + Foudre (dans les deux sens) → Surcharge : explosion de zone
  'eau+foudre': { nom: 'Surcharge', mult: 1.25, aoe: { rayon: 4.5, degats: 30 }, consomme: true, couleur: '#d8a8ff' },
  'foudre+eau': { nom: 'Surcharge', mult: 1.25, aoe: { rayon: 4.5, degats: 30 }, consomme: true, couleur: '#d8a8ff' },
  // N'importe quel élément + Vent → Diffusion : propage l'élément existant
  // (la spec cible foudre+vent ; on généralise, c'est plus riche et cohérent)
  'feu+vent':    { nom: 'Diffusion', mult: 1.15, propage: { rayon: 6 }, consomme: false, couleur: '#a8f0d0' },
  'eau+vent':    { nom: 'Diffusion', mult: 1.15, propage: { rayon: 6 }, consomme: false, couleur: '#a8f0d0' },
  'foudre+vent': { nom: 'Diffusion', mult: 1.15, propage: { rayon: 6 }, consomme: false, couleur: '#a8f0d0' },
};

/**
 * Applique un élément sur une cible. Mute cible.element.
 * Retourne le descripteur de réaction déclenchée, ou null.
 */
export function appliquerElement(cible, element) {
  if (!element) return null;
  const existant = cible.element?.ttl > 0 ? cible.element.type : null;

  if (existant && existant !== element) {
    const reaction = REACTIONS[`${existant}+${element}`];
    if (reaction) {
      const elementPropage = existant; // pour la Diffusion
      if (reaction.consomme) cible.element = null;
      else cible.element = { type: existant, ttl: DUREE_ELEMENT }; // rafraîchit
      return { ...reaction, elementPropage };
    }
  }
  // le vent ne se dépose pas ; les autres éléments marquent/rafraîchissent
  if (element !== 'vent') cible.element = { type: element, ttl: DUREE_ELEMENT };
  return null;
}

/** Tick des durées de vie d'élément (à appeler pour chaque ennemi). */
export function updateElement(cible, dt) {
  if (cible.element) {
    cible.element.ttl -= dt;
    if (cible.element.ttl <= 0) cible.element = null;
  }
}
