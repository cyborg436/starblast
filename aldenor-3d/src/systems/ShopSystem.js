import { DATA } from '../data/index.js';
import { iconFor } from '../ui/ItemIcons.js';

/**
 * ShopSystem — boutique d'un PNJ marchand, ouverte depuis le dialogue
 * (Phase 5) via l'action { shop:'<clé>' }. Stocks = boutiques de
 * items.json (marchand/forgeron/alchimiste/mystique). Achat : paie en or ;
 * vente : rend 40 % du prix (règle items.json). UI HTML onglets
 * Acheter/Vendre. Gèle le gameplay comme les autres UI modales.
 */
const REPRISE = 0.4; // valeur de revente

export class ShopSystem {
  constructor({ inventory, input }) {
    this.inv = inventory;
    this.input = input;
    this.open = false;
    this.mode = 'acheter';
    this.stockKey = null;

    this.panel = document.getElementById('shop');
    this.titleEl = document.getElementById('shop-title');
    this.tabsEl = document.getElementById('shop-tabs');
    this.listEl = document.getElementById('shop-list');
    this.goldEl = document.getElementById('shop-gold');
    this.onToast = null;

    this.tabsEl.querySelectorAll('button').forEach(b => {
      b.onclick = () => { this.mode = b.dataset.mode; this._renderTabs(); this._renderList(); };
    });
    document.getElementById('shop-close').onclick = () => this.close();
  }

  def(id) { return DATA.items.objets.find(o => o.id === id); }
  sellPrice(id) { return Math.max(1, Math.floor((this.def(id)?.prix || 0) * REPRISE)); }

  openShop(stockKey, nom) {
    if (!DATA.items.boutiques[stockKey]) return;
    this.stockKey = stockKey;
    this.open = true;
    this.mode = 'acheter';
    this.titleEl.textContent = nom || 'Marchand';
    this.panel.classList.add('on');
    if (document.pointerLockElement) document.exitPointerLock?.();
    this._renderTabs();
    this._renderList();
  }

  close() { this.open = false; this.panel.classList.remove('on'); }

  _renderTabs() {
    this.tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    this.goldEl.textContent = `🪙 ${this.inv.or} or`;
  }

  _row(id, prix, action, label, dispo) {
    const d = this.def(id);
    return `<div class="shop-row${dispo ? '' : ' cant'}" data-id="${id}" data-act="${action}">
      <img src="${iconFor(id)}">
      <span class="sr-nom">${d.nom}</span>
      <span class="sr-desc">${d.description || ''}</span>
      <span class="sr-prix">${prix} or</span>
      <button ${dispo ? '' : 'disabled'}>${label}</button>
    </div>`;
  }

  _renderList() {
    this.goldEl.textContent = `🪙 ${this.inv.or} or`;
    if (this.mode === 'acheter') {
      const stock = DATA.items.boutiques[this.stockKey];
      this.listEl.innerHTML = stock.map(id => {
        const prix = this.def(id).prix;
        return this._row(id, prix, 'buy', 'Acheter', this.inv.or >= prix);
      }).join('');
    } else {
      const vendables = [...this.inv.items.entries()].filter(([id, n]) => n > 0 && (this.def(id)?.prix || 0) > 0 && this.def(id)?.type !== 'quete');
      this.listEl.innerHTML = vendables.length
        ? vendables.map(([id, n]) => this._row(id, this.sellPrice(id), 'sell', `Vendre (${n})`, true)).join('')
        : '<p class="vide">Rien à vendre.</p>';
    }
    this.listEl.querySelectorAll('.shop-row button').forEach(btn => {
      const row = btn.closest('.shop-row');
      btn.onclick = () => (row.dataset.act === 'buy' ? this._buy(row.dataset.id) : this._sell(row.dataset.id));
    });
  }

  _buy(id) {
    const prix = this.def(id).prix;
    if (this.inv.or < prix) return;
    this.inv.addGold(-prix);
    this.inv.add(id, 1);
    this.onToast?.(`Acheté : ${this.def(id).nom}`);
    this._renderList();
  }

  _sell(id) {
    if (this.inv.count(id) <= 0) return;
    const gain = this.sellPrice(id);
    this.inv.remove(id, 1);
    this.inv.addGold(gain);
    this.onToast?.(`Vendu : ${this.def(id).nom} (+${gain} or)`);
    this._renderList();
  }
}
