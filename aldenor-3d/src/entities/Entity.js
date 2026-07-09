import * as THREE from 'three';

/**
 * Entity — classe de base de tout ce qui vit dans le monde
 * (joueur, ennemis, PNJ). Possède un THREE.Group racine ; les classes
 * dérivées y attachent leur modèle et implémentent update(dt).
 *
 * Les stats viennent des données extraites de la 2D (src/data) :
 * mobs.json pour les ennemis, npcs.json pour les PNJ.
 */
export class Entity {
  constructor(name = 'entity') {
    this.name = name;
    this.object3d = new THREE.Group();
    this.object3d.name = name;

    this.alive = true;
    this.velocity = new THREE.Vector3();
  }

  get position() {
    return this.object3d.position;
  }

  addTo(scene) {
    scene.add(this.object3d);
    return this;
  }

  update(_dt, _elapsed) {
    // implémenté par les sous-classes (Player, Enemy, Npc…)
  }

  dispose(scene) {
    this.alive = false;
    scene.remove(this.object3d);
    this.object3d.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
  }
}
