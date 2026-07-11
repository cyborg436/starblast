import questData from '../data/questDefs.json';
import { DATA } from '../data/index.js';

/**
 * QuestSystem — moteur de quêtes data-driven (data/questDefs.json).
 *
 * Types d'objectif : talk, kill, collect, reach, escort.
 * États d'une quête : locked → available → active → readyToTurnIn →
 * completed. Une quête peut en débloquer une autre (champ next) : c'est
 * l'enchaînement. Progression suivie par objectif ; sauvegarde via
 * serialize()/load().
 *
 * Événements poussés par le reste du jeu :
 *  - notifyKill(mobId)        (hook combat.onKill)
 *  - notifyCollect(itemId)    (inventory.onChange)
 *  - notifyTalk(role, npc)    (DialogueSystem à l'ouverture)
 *  - update(dt)               (reach / escort, testés en continu)
 */
export class QuestSystem {
  constructor({ player, world, inventory, npcs }) {
    this.player = player;
    this.world = world;
    this.inventory = inventory;
    this.npcs = npcs;            // NpcManager (positions, escorte)
    this.defs = questData.quests;

    /** id → { state, progress:{objIndex:count} } */
    this.quests = {};
    for (const id in this.defs) this.quests[id] = { state: 'locked', progress: {} };

    /** notifications UI : (type, texte) */
    this.onEvent = null;
    /** rafraîchissement du journal / marqueurs */
    this.onChange = null;

    // démarrage : quêtes autoStart + annexes rendues disponibles chez leur donneur
    for (const id in this.defs) {
      if (this.defs[id].autoStart) this._start(id);
      else if (this.defs[id].giver) this.quests[id].state = 'available';
    }
  }

  /* ---------- interrogation ---------- */
  state(id) { return this.quests[id]?.state || 'locked'; }
  isActive(id) { return this.state(id) === 'active'; }
  isDone(id) { return this.state(id) === 'completed'; }
  isReadyToTurnIn(id) { return this.state(id) === 'readyToTurnIn'; }

  /** Quêtes visibles au journal (actives + prêtes + terminées). */
  journal() {
    const list = [];
    for (const id in this.defs) {
      const s = this.quests[id].state;
      if (s === 'locked' || s === 'available') continue;
      list.push({ id, def: this.defs[id], state: s, objectifs: this._objProgress(id) });
    }
    // actives d'abord, terminées ensuite
    return list.sort((a, b) => (a.state === 'completed') - (b.state === 'completed'));
  }

  _objProgress(id) {
    const def = this.defs[id], st = this.quests[id];
    return def.objectifs.map((o, i) => ({
      desc: o.desc, type: o.type, n: o.n || 1,
      cur: Math.min(st.progress[i] || 0, o.n || 1),
      done: (st.progress[i] || 0) >= (o.n || 1),
    }));
  }

  /* ---------- cycle de vie ---------- */
  _start(id) {
    const q = this.quests[id];
    if (!q || q.state === 'active' || q.state === 'completed') return;
    q.state = 'active';
    q.progress = {};
    // objectifs collect : pré-remplis avec l'inventaire courant
    this.defs[id].objectifs.forEach((o, i) => {
      if (o.type === 'collect') q.progress[i] = this.inventory.count(o.cible);
      if (o.type === 'escort') this.npcs?.enableEscort?.(o.npc);
    });
    this._checkComplete(id);
    this.onEvent?.('quete', `Nouvelle quête : ${this.defs[id].titre}`);
    this.onChange?.();
  }

  /** Rendre une quête disponible dispo au dialogue → la lancer. */
  accept(id) { this._start(id); }

  _reward(id) {
    const r = this.defs[id].recompenses || {};
    if (r.or) this.inventory.addGold(r.or);
    if (r.xp) this.player.gainXP?.(r.xp);
    for (const it of r.items || []) this.inventory.add(it.id, it.n);
  }

  _complete(id) {
    const q = this.quests[id];
    if (q.state === 'completed') return;
    q.state = 'completed';
    this._reward(id);
    const r = this.defs[id].recompenses || {};
    const gain = [r.or ? `${r.or} or` : null, r.xp ? `${r.xp} XP` : null].filter(Boolean).join(', ');
    this.onEvent?.('quete', `Quête terminée : ${this.defs[id].titre}${gain ? ' (' + gain + ')' : ''}`);
    const next = this.defs[id].next;
    if (next) this._start(next);
    this.onChange?.();
  }

  /* ---------- progression ---------- */
  _bump(id, i, to) {
    const q = this.quests[id];
    q.progress[i] = to;
    this._checkComplete(id);
    this.onChange?.();
  }

  _checkComplete(id) {
    const def = this.defs[id], q = this.quests[id];
    if (q.state !== 'active' && q.state !== 'readyToTurnIn') return;
    const tousFaits = def.objectifs.every((o, i) => (q.progress[i] || 0) >= (o.n || 1));
    if (!tousFaits) { q.state = 'active'; return; }
    // objectifs remplis : rendu chez un PNJ, ou complétion directe
    if (def.renduA) {
      if (q.state !== 'readyToTurnIn') {
        q.state = 'readyToTurnIn';
        this.onEvent?.('quete', `Objectif atteint — retournez voir le ${def.renduA}`);
      }
    } else {
      this._complete(id);
    }
  }

  notifyKill(mobId) {
    for (const id in this.defs) {
      if (!this.isActive(id)) continue;
      this.defs[id].objectifs.forEach((o, i) => {
        if (o.type === 'kill' && o.cible === mobId && (this.quests[id].progress[i] || 0) < o.n) {
          const to = (this.quests[id].progress[i] || 0) + 1;
          this._bump(id, i, to);
          this.onEvent?.('progres', `${this.defs[id].titre} : ${Math.min(to, o.n)}/${o.n} ${this._mobNom(mobId)}`);
        }
      });
    }
  }

  notifyCollect(itemId) {
    for (const id in this.defs) {
      if (!this.isActive(id)) continue;
      this.defs[id].objectifs.forEach((o, i) => {
        if (o.type === 'collect' && o.cible === itemId) {
          this._bump(id, i, this.inventory.count(itemId));
        }
      });
    }
  }

  /** Retourne la liste des rôles/quêtes pertinents pour ce PNJ (marqueur). */
  notifyTalk(role) {
    let acted = false;
    for (const id in this.defs) {
      const def = this.defs[id], q = this.quests[id];
      // objectif talk
      if (this.isActive(id)) {
        def.objectifs.forEach((o, i) => {
          if (o.type === 'talk' && o.cible === role && (q.progress[i] || 0) < 1) {
            this._bump(id, i, 1); acted = true;
          }
        });
      }
      // rendu de quête
      if (q.state === 'readyToTurnIn' && def.renduA === role) {
        this._complete(id); acted = true;
      }
    }
    if (acted) this.onChange?.();
    return acted;
  }

  /** Marqueur au-dessus d'un PNJ : '!' à donner/rendre, '?' dispo, null. */
  markerFor(role) {
    for (const id in this.defs) {
      const def = this.defs[id], s = this.quests[id].state;
      if (s === 'readyToTurnIn' && def.renduA === role) return '!';
      if (s === 'active' && def.objectifs.some(o => o.type === 'talk' && o.cible === role)) return '!';
    }
    for (const id in this.defs) {
      const def = this.defs[id];
      if (this.quests[id].state === 'available' && def.giver === role) return '?';
    }
    return null;
  }

  /* ---------- reach / escort (continus) ---------- */
  update(dt) {
    void dt;
    for (const id in this.defs) {
      if (!this.isActive(id)) continue;
      this.defs[id].objectifs.forEach((o, i) => {
        if ((this.quests[id].progress[i] || 0) >= 1) return;
        if (o.type === 'reach') {
          const pos = this._poiPos(o);
          if (pos && this._distXZ(this.player.position, pos) < (o.rayon || 14)) {
            this._bump(id, i, 1);
            this.onEvent?.('progres', `Lieu atteint : ${this.defs[id].titre}`);
          }
        } else if (o.type === 'escort') {
          const npc = this.npcs?.get?.(o.npc);
          const dest = this._poiPos(o);
          if (npc && dest && this._distXZ(npc.position, dest) < 16) {
            this._bump(id, i, 1);
            this.npcs?.stopEscort?.(o.npc);
          }
        }
      });
    }
  }

  _poiPos(o) {
    if (o.x !== undefined) return { x: o.x, z: o.z };
    if (o.poi === 'village_centre') return this.npcs?.center || { x: 0, z: 22 };
    const poi = DATA.pois.pois.find(p => p.id === o.poi);
    return poi ? { x: poi.x, z: poi.z } : null;
  }
  _distXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  _mobNom(id) { return DATA.mobs.mobs.find(m => m.id === id)?.nom || id; }

  /** Objectif actif à pister sur le HUD/carte (le plus prioritaire). */
  trackedObjective() {
    // priorité aux principales actives
    const ordre = [...Object.keys(this.defs)];
    ordre.sort((a, b) => (this.defs[a].type === 'principale' ? 0 : 1) - (this.defs[b].type === 'principale' ? 0 : 1));
    for (const id of ordre) {
      const s = this.quests[id].state;
      if (s !== 'active' && s !== 'readyToTurnIn') continue;
      const def = this.defs[id];
      if (s === 'readyToTurnIn' && def.renduA) {
        return { titre: def.titre, desc: `Retourner voir le ${def.renduA}`, pos: this.npcs?.rolePos?.(def.renduA) };
      }
      const st = this.quests[id];
      const idx = def.objectifs.findIndex((o, i) => (st.progress[i] || 0) < (o.n || 1));
      if (idx < 0) continue;
      const o = def.objectifs[idx];
      let pos = null;
      if (o.type === 'reach' || o.type === 'escort') pos = this._poiPos(o);
      if (o.type === 'talk') pos = this.npcs?.rolePos?.(o.cible);
      const prog = o.n ? ` (${Math.min(st.progress[idx] || 0, o.n)}/${o.n})` : '';
      return { titre: def.titre, desc: o.desc + prog, pos };
    }
    return null;
  }

  /* ---------- persistance ---------- */
  serialize() {
    const out = {};
    for (const id in this.quests) out[id] = { state: this.quests[id].state, progress: this.quests[id].progress };
    return out;
  }
  load(data) {
    if (!data) return;
    for (const id in data) if (this.quests[id]) this.quests[id] = data[id];
    this.onChange?.();
  }
}
