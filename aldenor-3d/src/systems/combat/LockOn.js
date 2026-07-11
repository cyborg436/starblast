import * as THREE from 'three';

/**
 * LockOn — verrouillage de cible (clic molette ou Tab).
 *
 *  - acquiert l'ennemi le plus proche DANS LE CHAMP DE VISION
 *    (dot(direction caméra, direction ennemi) > 0.25, distance < 28 m)
 *  - ré-appuyer : passe à la cible suivante (tri par distance)
 *  - se désactive si la cible meurt ou dépasse 34 m
 *  - le réticule DOM est projeté au-dessus de la tête de la cible
 *  - la caméra reçoit un léger biais vers la cible (renforcé pendant
 *    les attaques), SANS bloquer la souris — voir CameraController
 */

const PORTEE_ACQUISITION = 28;
const PORTEE_PERTE = 34;
const _v = new THREE.Vector3();
const _f = new THREE.Vector3();

export class LockOn {
  constructor(cs) {
    this.cs = cs;
    this.target = null;
    this.reticle = document.getElementById('reticle');
  }

  update(_dt) {
    const { input, camera, player } = this.cs;

    if (input.wasActionPressed('lockon')) {
      if (this.target) this._cycle();
      else this._acquire();
    }

    // validité de la cible
    if (this.target) {
      const d = this.target.position.distanceTo(player.position);
      if (this.target.dead || d > PORTEE_PERTE) this.target = null;
    }

    // réticule projeté à l'écran
    if (this.reticle) {
      if (this.target) {
        _v.copy(this.target.position);
        _v.y += this.target.hauteur + 0.5;
        _v.project(camera);
        const visible = _v.z < 1;
        this.reticle.style.display = visible ? 'block' : 'none';
        if (visible) {
          this.reticle.style.left = `${(_v.x * 0.5 + 0.5) * 100}%`;
          this.reticle.style.top = `${(-_v.y * 0.5 + 0.5) * 100}%`;
        }
      } else this.reticle.style.display = 'none';
    }
  }

  _candidats() {
    const { camera, player } = this.cs;
    camera.getWorldDirection(_f);
    return this.cs.enemies
      .filter(e => {
        if (e.dead) return false;
        _v.subVectors(e.position, player.position);
        const d = _v.length();
        if (d > PORTEE_ACQUISITION) return false;
        _v.normalize();
        return _v.dot(_f) > 0.25; // dans le champ de vision
      })
      .sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position));
  }

  _acquire() {
    this.target = this._candidats()[0] || null;
  }

  /** Cible suivante (re-presser la touche). */
  _cycle() {
    const list = this._candidats();
    if (list.length === 0) { this.target = null; return; }
    const i = list.indexOf(this.target);
    this.target = list[(i + 1) % list.length];
  }
}
