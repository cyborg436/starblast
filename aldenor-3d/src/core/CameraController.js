import * as THREE from 'three';

/**
 * CameraController — caméra troisième personne type Action-RPG :
 * orbite autour du joueur à la souris (pointer lock au clic, ou
 * glisser-clic en secours), zoom à la molette, jamais sous le terrain,
 * suivi amorti. Remplace les OrbitControls de debug.
 */
export class CameraController {
  constructor(camera, canvas, input, world, target) {
    this.camera = camera;
    this.canvas = canvas;
    this.input = input;
    this.world = world;
    this.target = target; // Vector3 vivant (position du joueur)

    this.yaw = Math.PI;    // caméra derrière le joueur au départ (regarde vers -Z... voir Player)
    this.pitch = 0.35;
    this.distance = 7;
    this.minDistance = 2.5;
    this.maxDistance = 16;

    this._pos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._first = true;

    // pointer lock au clic (Échap pour libérer — géré par le navigateur)
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  update(dt) {
    const m = this.input.mouse;

    // rotation : pointer lock, ou bouton gauche maintenu en secours
    if (this.locked || m.buttons.has(0)) {
      this.yaw -= m.dx * 0.0028;
      this.pitch += m.dy * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.35, 1.25);
    }
    // zoom molette
    if (m.wheel !== 0) {
      this.distance = THREE.MathUtils.clamp(this.distance * (1 + m.wheel * 0.001), this.minDistance, this.maxDistance);
    }

    // position idéale sur l'orbite
    const focusY = this.target.y + 1.7;
    const cosP = Math.cos(this.pitch);
    const px = this.target.x + Math.sin(this.yaw) * cosP * this.distance;
    const pz = this.target.z + Math.cos(this.yaw) * cosP * this.distance;
    const py = focusY + Math.sin(this.pitch) * this.distance;

    this._pos.set(px, py, pz);

    // ne jamais passer sous le terrain (ni sous l'eau de justesse)
    const sol = this.world.getHeightAt(px, pz);
    if (this._pos.y < sol + 0.5) this._pos.y = sol + 0.5;

    // amortissement (téléportation instantanée à la première frame)
    const k = this._first ? 1 : Math.min(dt * 10, 1);
    this._first = false;
    this.camera.position.lerp(this._pos, k);

    this._lookAt.set(this.target.x, focusY, this.target.z);
    this.camera.lookAt(this._lookAt);
  }
}
