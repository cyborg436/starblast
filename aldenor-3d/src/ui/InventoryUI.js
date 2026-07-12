import { DATA } from '../data/index.js';
import { iconFor } from './ItemIcons.js';

/**
 * InventoryUI — panneau d'inventaire (touche I) : grille d'objets
 * empilables, emplacements d'équipement, stats du joueur, amélioration
 * de l'arme équipée. Clic sur un objet = équiper / consommer ; clic sur
 * un emplacement = déséquiper. HTML/CSS, pas de drag & drop (clic suffit).
 */
export class InventoryUI {
  constructor({ inventory, equipment, player, combat }) {
    this.inv = inventory;
    this.eq = equipment;
    this.player = player;
    this.combat = combat;
    this.open = false;

    this.panel = document.getElementById('inventory');
    this.gridEl = document.getElementById('inv-grid');
    this.slotsEl = document.getElementById('inv-slots');
    this.statsEl = document.getElementById('inv-stats');
    this.goldEl = document.getElementById('inv-gold');
    this.upgradeEl = document.getElementById('inv-upgrade');

    this.onToast = null;
    equipment.onChange = () => { if (this.open) this.render(); this._syncHudGold(); };
    // enveloppe le onChange existant (progression des quêtes de collecte)
    // pour aussi rafraîchir l'UI et l'or du HUD
    const prev = inventory.onChange;
    inventory.onChange = (id, delta) => { prev?.(id, delta); if (this.open) this.render(); this._syncHudGold(); };
    this._syncHudGold();
  }

  _syncHudGold() {
    const el = document.getElementById('hud-gold');
    if (el) el.textContent = `🪙 ${this.inv.or}`;
  }

  toggle() {
    this.open = !this.open;
    this.panel.classList.toggle('on', this.open);
    if (this.open) this.render();
  }

  def(id) { return DATA.items.objets.find(o => o.id === id); }

  _statLine(id) {
    const s = this.def(id)?.stats || {};
    const parts = [];
    if (id === this.eq.slots.arme) { const a = this.eq.effAtk(id); if (a) parts.push(`atk ${a}`); }
    else if (s.atk) parts.push(`atk ${s.atk}`);
    if (s.def) parts.push(`déf ${s.def}`);
    if (s.pv) parts.push(`+${s.pv} PV`);
    if (s.pm) parts.push(`+${s.pm} stam`);
    const lvl = this.eq.level(id);
    if (lvl) parts.push(`✦${lvl}`);
    return parts.join(' · ');
  }

  render() {
    // équipement
    const slotNoms = { arme: 'Arme', armure: 'Armure', casque: 'Casque', anneau: 'Anneau' };
    this.slotsEl.innerHTML = Object.entries(this.eq.slots).map(([slot, id]) => {
      const inner = id
        ? `<img src="${iconFor(id)}"><span class="s-nom">${this.def(id).nom}</span><span class="s-stat">${this._statLine(id)}</span>`
        : `<span class="s-vide">— ${slotNoms[slot]} —</span>`;
      return `<div class="eq-slot" data-slot="${slot}" title="${id ? 'Clic : déséquiper' : ''}">${inner}</div>`;
    }).join('');
    this.slotsEl.querySelectorAll('.eq-slot').forEach(el => {
      el.onclick = () => { if (this.eq.slots[el.dataset.slot]) { this.eq.unequip(el.dataset.slot); } };
    });

    // grille du sac
    const entries = [...this.inv.items.entries()].filter(([, n]) => n > 0);
    this.gridEl.innerHTML = entries.map(([id, n]) => {
      const d = this.def(id);
      const eqp = ['arme', 'armure', 'casque', 'anneau'].includes(d?.type);
      const conso = d?.type === 'conso';
      const act = eqp ? 'Équiper' : conso ? 'Utiliser' : '';
      return `<div class="inv-cell${act ? ' act' : ''}" data-id="${id}" title="${d?.nom || id}${act ? ' — clic : ' + act.toLowerCase() : ''}">
        <img src="${iconFor(id)}">
        ${n > 1 ? `<span class="qty">${n}</span>` : ''}
        <span class="cell-nom">${d?.nom || id}</span>
        ${this._statLine(id) ? `<span class="cell-stat">${this._statLine(id)}</span>` : ''}
      </div>`;
    }).join('') || '<p class="vide">Sac vide.</p>';
    this.gridEl.querySelectorAll('.inv-cell').forEach(el => {
      el.onclick = () => this._use(el.dataset.id);
    });

    // stats joueur
    const der = this.eq.derived;
    const res = Object.entries(der.resist).filter(([, v]) => v > 0.001).map(([e, v]) => `${e} ${Math.round(v * 100)}%`).join(' ');
    this.statsEl.innerHTML = `
      <div>PV max <b>${this.player.pvmax}</b></div>
      <div>Stamina max <b>${this.combat.stamina.max}</b></div>
      <div>Dégâts <b>×${der.damageMult.toFixed(2)}</b></div>
      <div>Défense <b>${der.def}</b></div>
      ${res ? `<div>Résist. <b>${res}</b></div>` : ''}`;
    this.goldEl.textContent = `🪙 ${this.inv.or} or`;

    // amélioration d'arme
    const c = this.eq.upgradeCost();
    if (!c) {
      this.upgradeEl.innerHTML = this.eq.slots.arme ? '<span class="dim">Arme au niveau max.</span>' : '<span class="dim">Aucune arme équipée.</span>';
    } else {
      const ok = this.eq.canUpgrade();
      this.upgradeEl.innerHTML = `<button id="btn-upgrade" ${ok ? '' : 'disabled'}>Améliorer l'arme → ✦${c.next}</button>
        <span class="cost ${ok ? '' : 'manque'}">${c.minerai} minerai · ${c.or} or</span>`;
      const btn = document.getElementById('btn-upgrade');
      if (btn) btn.onclick = () => {
        if (this.eq.upgradeWeapon()) this.onToast?.(`Arme améliorée au niveau ✦${this.eq.level(this.eq.slots.arme)} !`, 'quete');
      };
    }
  }

  _use(id) {
    const d = this.def(id);
    if (!d) return;
    if (['arme', 'armure', 'casque', 'anneau'].includes(d.type)) {
      this.eq.equip(id);
      this.onToast?.(`Équipé : ${d.nom}`);
    } else if (d.type === 'conso') {
      const e = d.effet || {};
      if (e.soin) { this.player.pv = Math.min(this.player.pvmax, this.player.pv + e.soin); }
      if (e.mana) { this.combat.stamina.val = Math.min(this.combat.stamina.max, this.combat.stamina.val + e.mana); }
      this.inv.remove(id, 1);
      this.onToast?.(`${d.nom} utilisé.`);
    }
  }
}
