import { DATA } from '../data/index.js';

/**
 * Equipment — emplacements d'équipement + STATS DÉRIVÉES réellement
 * utilisées par le combat (Phase 4).
 *
 * Emplacements (types de items.json) : arme, armure, casque, anneau.
 * Stats des objets (items.json) : atk, def, pv, pm. Mapping 3D :
 *  - atk (arme + anneau) → multiplicateur de dégâts sortants (+4 %/point)
 *  - pv                  → PV max bonus (plat)
 *  - pm                  → stamina max bonus (la 3D utilise la stamina)
 *  - def                 → réduction de dégâts subis (plat) + un peu de
 *                          résistance à TOUS les éléments
 *  - resist{element}     → résistance élémentaire en % (overlay EQUIP_EXTRA
 *                          ci-dessous — items.json n'en contient pas)
 *
 * AMÉLIORATION D'ARME : chaque arme a un niveau (0→MAX). Chaque niveau
 * ajoute +3 atk effectif. Coût par niveau : (niv+1)×2 minerai + (niv+1)×15 or.
 */

// résistances élémentaires ajoutées à certains équipements (0..1)
const EQUIP_EXTRA = {
  arm4: { resist: { feu: 0.4 } },      // armure draconique → résiste au feu
  csq3: { resist: { foudre: 0.2 } },   // heaume d'acier → un peu à la foudre
  ann2: { resist: { eau: 0.2, foudre: 0.2 } },
};

const UPGRADE_MAX = 5;
const ATK_PAR_NIVEAU = 3;

export class Equipment {
  constructor({ player, combat, inventory }) {
    this.player = player;
    this.combat = combat;
    this.inventory = inventory;
    this.slots = { arme: null, armure: null, casque: null, anneau: null };
    this.upgrades = {}; // itemId → niveau
    this.onChange = null;

    // stats dérivées (recalculées à chaque changement)
    this.derived = { damageMult: 1, pvBonus: 0, staminaBonus: 0, def: 0, resist: {} };
  }

  def(id) { return DATA.items.objets.find(o => o.id === id); }
  slotFor(id) { const t = this.def(id)?.type; return ['arme', 'armure', 'casque', 'anneau'].includes(t) ? t : null; }
  level(id) { return this.upgrades[id] || 0; }

  /** atk effectif d'une arme (base + amélioration). */
  effAtk(id) {
    const s = this.def(id)?.stats || {};
    return (s.atk || 0) + this.level(id) * ATK_PAR_NIVEAU;
  }

  /** Équipe un objet du sac (retire l'ancien vers le sac). */
  equip(id) {
    const slot = this.slotFor(id);
    if (!slot || this.inventory.count(id) <= 0) return false;
    this.inventory.remove(id, 1);
    if (this.slots[slot]) this.inventory.add(this.slots[slot], 1);
    this.slots[slot] = id;
    this.apply();
    this.onChange?.();
    return true;
  }

  unequip(slot) {
    if (!this.slots[slot]) return;
    this.inventory.add(this.slots[slot], 1);
    this.slots[slot] = null;
    this.apply();
    this.onChange?.();
  }

  /** Coût d'amélioration de l'arme équipée, ou null si max/rien. */
  upgradeCost() {
    const id = this.slots.arme;
    if (!id) return null;
    const niv = this.level(id);
    if (niv >= UPGRADE_MAX) return null;
    return { minerai: (niv + 1) * 2, or: (niv + 1) * 15, niv, next: niv + 1 };
  }

  canUpgrade() {
    const c = this.upgradeCost();
    return !!c && this.inventory.count('minerai') >= c.minerai && this.inventory.or >= c.or;
  }

  upgradeWeapon() {
    const c = this.upgradeCost();
    if (!c || !this.canUpgrade()) return false;
    this.inventory.remove('minerai', c.minerai);
    this.inventory.addGold(-c.or);
    this.upgrades[this.slots.arme] = c.next;
    this.apply();
    this.onChange?.();
    return true;
  }

  /** Recalcule les stats dérivées et les applique au joueur / combat. */
  apply() {
    let atk = 0, pv = 0, pm = 0, def = 0;
    const resist = { feu: 0, eau: 0, foudre: 0, vent: 0 };
    for (const [slot, id] of Object.entries(this.slots)) {
      if (!id) continue;
      const s = this.def(id)?.stats || {};
      atk += slot === 'arme' ? this.effAtk(id) : (s.atk || 0);
      pv += s.pv || 0; pm += s.pm || 0; def += s.def || 0;
      const extra = EQUIP_EXTRA[id]?.resist;
      if (extra) for (const el in extra) resist[el] = Math.min(0.85, (resist[el] || 0) + extra[el]);
    }
    // def donne aussi une petite résistance à tous les éléments (2 %/point, cap 40 %)
    const defResist = Math.min(0.4, def * 0.02);
    for (const el in resist) resist[el] = Math.min(0.85, resist[el] + defResist);

    this.derived = {
      damageMult: 1 + atk * 0.04,
      pvBonus: pv, staminaBonus: pm, def, resist,
      atk,
    };

    // applique au joueur / combat
    const oldMax = this.player.pvmax;
    this.player.pvmax = 100 + pv;
    if (this.player.pvmax > oldMax) this.player.pv += this.player.pvmax - oldMax; // gagne le bonus
    this.player.pv = Math.min(this.player.pv, this.player.pvmax);
    if (this.combat) {
      this.combat.stamina.max = 100 + pm;
      this.combat.stamina.val = Math.min(this.combat.stamina.val, this.combat.stamina.max);
    }
  }

  damageMult() { return this.derived.damageMult; }
  /** Réduction de dégâts subis pour un élément (null = physique). */
  mitigate(montant, element) {
    let m = Math.max(1, montant - this.derived.def);
    if (element && this.derived.resist[element]) m *= (1 - this.derived.resist[element]);
    return Math.max(1, Math.round(m));
  }

  /* ---- persistance ---- */
  serialize() { return { slots: this.slots, upgrades: this.upgrades }; }
  load(data) {
    if (!data) return;
    this.slots = { arme: null, armure: null, casque: null, anneau: null, ...data.slots };
    this.upgrades = data.upgrades || {};
    this.apply();
    this.onChange?.();
  }
}
