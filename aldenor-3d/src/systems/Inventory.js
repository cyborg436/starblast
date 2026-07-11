import { DATA } from '../data/index.js';

/**
 * Inventory — sac léger (itemId → quantité) + or.
 * S'appuie sur data/items.json (Phase 0) pour les noms/prix, et sur les
 * tables de butin de data/mobs.json pour le loot à la mort d'un ennemi.
 * Pas d'UI de sac dédiée ici (Phase 6) : juste ce qu'il faut aux
 * objectifs de collecte, aux dons de PNJ et aux récompenses de quête.
 */
export class Inventory {
  constructor() {
    this.items = new Map();   // itemId → count
    this.or = 30;             // même départ que le jeu 2D
    /** Notifié à chaque ramassage/don : (itemId, delta) → void. */
    this.onChange = null;
  }

  count(id) {
    return this.items.get(id) || 0;
  }

  add(id, n = 1) {
    if (n <= 0) return;
    this.items.set(id, this.count(id) + n);
    this.onChange?.(id, n);
  }

  remove(id, n = 1) {
    const have = this.count(id);
    const take = Math.min(have, n);
    if (take <= 0) return 0;
    if (take === have) this.items.delete(id);
    else this.items.set(id, have - take);
    this.onChange?.(id, -take);
    return take;
  }

  addGold(n) {
    this.or = Math.max(0, this.or + n);
    this.onChange?.('or', n);
  }

  nom(id) {
    return DATA.items.objets.find(o => o.id === id)?.nom || id;
  }

  /** Loot probabiliste à la mort d'un mob (tables de mobs.json). */
  rollLoot(mobId) {
    const def = DATA.mobs.mobs.find(m => m.id === mobId);
    if (!def?.loot) return [];
    const gagnes = [];
    for (const l of def.loot) {
      if (Math.random() > l.probabilite) continue;
      const q = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
      if (l.or) { this.addGold(q); gagnes.push({ or: q }); }
      else { this.add(l.objet, q); gagnes.push({ id: l.objet, n: q }); }
    }
    return gagnes;
  }

  /* ---- persistance ---- */
  serialize() {
    return { or: this.or, items: Object.fromEntries(this.items) };
  }
  load(data) {
    if (!data) return;
    this.or = data.or ?? 30;
    this.items = new Map(Object.entries(data.items || {}));
  }
}
