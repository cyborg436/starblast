import * as THREE from 'three';
import { DATA } from '../data/index.js';
import { iconKind } from '../ui/ItemIcons.js';

/**
 * LootSystem — butin AU SOL.
 * À la mort d'un ennemi, tire dans sa table de loot (mobs.json) et fait
 * apparaître des objets physiques : petit mesh coloré flottant + étiquette.
 * Le joueur les ramasse au CONTACT (aimant de proximité) — pas de touche
 * nécessaire. L'or apparaît en pièces dorées.
 *
 * Valeurs : aimant à 3 m, collecte à 1,2 m, éjection initiale ~2 m,
 * durée de vie 45 s.
 */
const AIMANT = 3, COLLECTE = 1.3, VIE = 45;

// couleur du mesh de butin par genre d'icône
const COL = {
  epee: 0xc8d0dc, hache: 0xc8d0dc, arc: 0x9a7040, baton: 0x9a70e0,
  armure: 0x9aa4b4, casque: 0x9aa4b4, anneau: 0xe0c050,
  potion: 0xe05060, nourriture: 0xd08040, minerai: 0xc08050,
  gemme: 0x60d0e0, quete: 0xf0e080, materiau: 0x90b070, objet: 0xb0b0b0,
};

export class LootSystem {
  constructor(scene, world, player, inventory) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.drops = [];
    this.onPickup = null; // (id|null, n, or) → toast

    // géométries partagées
    this._boxGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    this._coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8);
    this._coinMat = new THREE.MeshStandardMaterial({ color: 0xf0c840, metalness: 0.3, roughness: 0.4, emissive: 0x3a2e00 });
    this._mats = new Map();
  }

  _matFor(id) {
    const k = iconKind(id);
    if (!this._mats.has(k)) this._mats.set(k, new THREE.MeshStandardMaterial({ color: COL[k] || 0xb0b0b0, roughness: 0.6, emissive: new THREE.Color(COL[k] || 0xb0b0b0).multiplyScalar(0.12) }));
    return this._mats.get(k);
  }

  /** Fait apparaître le butin d'un ennemi mort (tables mobs.json). */
  dropFor(mobId, pos) {
    const def = DATA.mobs.mobs.find(m => m.id === mobId);
    if (!def?.loot) return;
    for (const l of def.loot) {
      if (Math.random() > l.probabilite) continue;
      const q = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
      if (l.or) this._spawn(pos, { or: q });
      else this._spawn(pos, { id: l.objet, n: q });
    }
  }

  _spawn(pos, payload) {
    const mesh = payload.or
      ? new THREE.Mesh(this._coinGeo, this._coinMat)
      : new THREE.Mesh(this._boxGeo, this._matFor(payload.id));
    mesh.castShadow = true;
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.6;
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    mesh.position.set(x, this.world.getHeightAt(x, z) + 0.4, z);
    this.scene.add(mesh);
    this.drops.push({ mesh, ...payload, t: 0, vy: 3 + Math.random() * 2, grounded: false });
  }

  update(dt, elapsed) {
    const p = this.player.position;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      // petite chute puis flottement/rotation
      if (!d.grounded) {
        d.vy -= 14 * dt;
        d.mesh.position.y += d.vy * dt;
        const sol = this.world.getHeightAt(d.mesh.position.x, d.mesh.position.z) + 0.4;
        if (d.mesh.position.y <= sol) { d.mesh.position.y = sol; d.grounded = true; }
      } else {
        d.mesh.position.y += Math.sin(elapsed * 3 + i) * 0.003;
      }
      d.mesh.rotation.y += dt * 2;

      const dist = Math.hypot(d.mesh.position.x - p.x, d.mesh.position.z - p.z);
      // aimant : glisse vers le joueur
      if (dist < AIMANT && d.grounded) {
        const k = Math.min(dt * 6, 1);
        d.mesh.position.x += (p.x - d.mesh.position.x) * k;
        d.mesh.position.z += (p.z - d.mesh.position.z) * k;
        d.mesh.position.y += (p.y + 0.8 - d.mesh.position.y) * k;
      }
      // collecte
      if (dist < COLLECTE || d.t > VIE) {
        if (dist < COLLECTE) {
          if (d.or) { this.inventory.addGold(d.or); this.onPickup?.(null, 0, d.or); }
          else { this.inventory.add(d.id, d.n); this.onPickup?.(d.id, d.n, 0); }
        }
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
      }
    }
  }
}
