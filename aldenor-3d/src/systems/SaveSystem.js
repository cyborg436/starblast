/**
 * SaveSystem — persistance localStorage de l'état RPG (quêtes, drapeaux,
 * inventaire, position). Sauvegarde auto périodique + à la fermeture ;
 * chargement au démarrage si une partie existe. Le monde étant
 * procédural (même seed → même monde), on ne sauvegarde QUE l'état,
 * pas la géométrie.
 */
const KEY = 'aldenor3d_save_v1';

export class SaveSystem {
  constructor({ quests, inventory, flags, player }) {
    this.quests = quests;
    this.inventory = inventory;
    this.flags = flags;
    this.player = player;
    this._acc = 0;
  }

  hasSave() {
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  }

  save() {
    const p = this.player.position;
    const data = {
      v: 1,
      quests: this.quests.serialize(),
      inventory: this.inventory.serialize(),
      flags: this.flags,
      player: { x: p.x, y: p.y, z: p.z, pv: this.player.pv, lvl: this.player.lvl, xp: this.player.xp },
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
  }

  load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { return false; }
    if (!data || data.v !== 1) return false;
    this.quests.load(data.quests);
    this.inventory.load(data.inventory);
    Object.assign(this.flags, data.flags || {});
    if (data.player) {
      this.player.pv = data.player.pv ?? this.player.pv;
      if (this.player.lvl !== undefined) { this.player.lvl = data.player.lvl ?? 1; this.player.xp = data.player.xp ?? 0; }
      // repositionne la capsule
      if (this.player.body && data.player.x !== undefined) {
        this.player.body.setNextKinematicTranslation({ x: data.player.x, y: data.player.y + 0.5, z: data.player.z });
      }
    }
    return true;
  }

  update(dt) {
    this._acc += dt;
    if (this._acc >= 20) { this._acc = 0; this.save(); } // auto-save ~20 s
  }
}
