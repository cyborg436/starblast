import * as THREE from 'three';

/**
 * CameraController — caméra troisième personne type Action-RPG :
 * orbite autour du joueur à la souris (pointer lock au clic, ou
 * glisser-clic en secours), zoom à la molette, jamais sous le terrain,
 * suivi amorti. Remplace les OrbitControls de debug.
 */
export class CameraController {
  constructor(camera, canvas, input, world, target, physics = null) {
    this.camera = camera;
    this.canvas = canvas;
    this.input = input;
    this.world = world;
    this.physics = physics;
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
    const ox = Math.sin(this.yaw) * cosP, oz = Math.cos(this.yaw) * cosP, oy = Math.sin(this.pitch);

    // collision : raycast tête du joueur → position idéale ; si le
    // terrain (colline, falaise) coupe la ligne, la caméra se rapproche
    let dist = this.distance;
    let collision = false;
    if (this.physics) {
      const hit = this.physics.raycastTerrain(
        { x: this.target.x, y: focusY, z: this.target.z },
        { x: ox, y: oy, z: oz },
        this.distance + 0.4,
      );
      if (hit !== null && hit < this.distance) {
        dist = Math.max(0.9, hit - 0.35);
        collision = true;
      }
    }

    this._pos.set(this.target.x + ox * dist, focusY + oy * dist, this.target.z + oz * dist);

    // filet de sécurité : jamais sous la surface du terrain
    const sol = this.world.getHeightAt(this._pos.x, this._pos.z);
    if (this._pos.y < sol + 0.4) this._pos.y = sol + 0.4;

    // amortissement — plus nerveux quand la caméra évite un obstacle,
    // instantané à la première frame
    const k = this._first ? 1 : Math.min(dt * (collision ? 22 : 10), 1);
    this._first = false;
    this.camera.position.lerp(this._pos, k);

    this._lookAt.set(this.target.x, focusY, this.target.z);
    this.camera.lookAt(this._lookAt);
  }
}
