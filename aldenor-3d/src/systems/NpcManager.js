import { Npc } from '../entities/Npc.js';
import npcsData from '../data/npcs.json';

/**
 * NpcManager — peuple le village de départ (Aldenor) selon data/npcs.json.
 *
 * npcs.json décrit des RÔLES (gabarits : fonction, apparence, nom fixe) et
 * des règles de peuplement. Ici on instancie un village concret autour
 * d'un centre proche du spawn (le joueur apparaît en 0,0 ; le village est
 * à ~22 m au nord pour ne pas spawner dessus). Les apparences viennent
 * directement des palettes de npcs.json.
 *
 * Cas spéciaux :
 *  - noms fixes : Aldric (ancien), Zephyrine (mystique)
 *  - villageois_egare : le PNJ de la quête d'escorte, placé LOIN du
 *    village, désactivé jusqu'à ce qu'on accepte la quête
 */

// disposition du village : rôle → offset (x,z) autour du centre
const LAYOUT = [
  { role: 'ancien', x: 0, z: -6 },
  { role: 'forgeron', x: -10, z: -2 },
  { role: 'marchand', x: 9, z: -3 },
  { role: 'alchimiste', x: -8, z: 6 },
  { role: 'aubergiste', x: 7, z: 6 },
  { role: 'garde', x: -3, z: 10 },
  { role: 'villageois', x: 4, z: 9 },
];

export class NpcManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.byRole = new Map();
    this.center = { x: 0, z: 22 };
    this.quests = null; // câblé par Game pour les marqueurs

    for (const spot of LAYOUT) this._spawn(spot.role, this.center.x + spot.x, this.center.z + spot.z);

    // PNJ égaré de la quête d'escorte : loin, au sud-est (le joueur doit
    // aller le trouver). Rôle dédié 'egare' → son propre arbre de dialogue.
    this.egare = this._spawn('egare', 60, -55, { id: 'villageois_egare', nom: 'Villageois égaré' });
  }

  _spawn(role, x, z, opts = {}) {
    const def = npcsData.roles.find(r => r.role === role);
    const nom = opts.nom || def?.nomFixe || this._genNom(role, x, z);
    const npc = new Npc({ role, nom, apparence: this._apparence(def), x, z, world: this.world });
    npc.id = opts.id || ('npc_' + role + '_' + this.list.length);
    npc.addTo(this.scene);
    this.list.push(npc);
    if (!this.byRole.has(role)) this.byRole.set(role, npc); // premier de chaque rôle = référence
    return npc;
  }

  _apparence(def) {
    const a = def?.apparence;
    if (!a) return { peau: '#d8a078', cheveux: '#5a3a1a', haut: '#7a6a4a', bas: '#3a3028' };
    // villageois : palette "notes" (tableaux) → on prend une variante stable
    if (Array.isArray(a.peau)) {
      return { peau: a.peau[0], cheveux: a.cheveux[0], haut: a.haut[0], bas: a.bas[0] };
    }
    return a;
  }

  _genNom(role, x, z) {
    const s1 = npcsData.generationNoms.pnjSyllabe1;
    const s2 = npcsData.generationNoms.pnjSyllabe2;
    const seed = Math.abs(Math.round(x * 31 + z * 17));
    return s1[seed % s1.length] + s2[(seed >> 3) % s2.length];
  }

  /* ---------- accès ---------- */
  get(id) { return this.list.find(n => n.id === id); }
  rolePos(role) { const n = this.byRole.get(role); return n ? { x: n.position.x, z: n.position.z } : null; }

  /* ---------- escorte ---------- */
  enableEscort(npcId) { const n = this.get(npcId); if (n) { n.escorting = true; } }
  stopEscort(npcId) { const n = this.get(npcId); if (n) { n.escorting = false; } }

  /* ---------- boucle ---------- */
  update(dt, elapsed, player) {
    for (const n of this.list) {
      // gel des PNJ lointains (hors escorte)
      if (!n.escorting && n.position.distanceTo(player.position) > 60) { n.object3d.visible = false; continue; }
      n.object3d.visible = true;
      n.update(dt, elapsed, player);
      // marqueur de quête
      if (this.quests) n.setMarker(this.quests.markerFor(n.role));
    }
  }

  /** PNJ interactif visé (proximité + regard + ligne de vue) — délégué à Interaction. */
  get all() { return this.list; }
}
