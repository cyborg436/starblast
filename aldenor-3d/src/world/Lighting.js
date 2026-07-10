import * as THREE from 'three';

/**
 * Lighting — soleil directionnel (ombres) + hemisphere light.
 * setTimeOfDay(t, focus) : hook du cycle jour/nuit — l'arc du soleil,
 * ses couleurs/intensités, et la zone d'ombre qui SUIT le joueur
 * (indispensable en open world : la shadow camera ne couvre que 120 m).
 * Retourne { dir, day, dusk } pour synchroniser ciel, brouillard et eau.
 */
export class Lighting {
  constructor(scene) {
    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 500;
    const S = 60;
    this.sun.shadow.camera.left = -S;
    this.sun.shadow.camera.right = S;
    this.sun.shadow.camera.top = S;
    this.sun.shadow.camera.bottom = -S;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd5e8, 0x3a5228, 0.8);
    scene.add(this.hemi);

    this._dir = new THREE.Vector3();
    this._state = { dir: this._dir, day: 1, dusk: 0 };
  }

  setTimeOfDay(t, focus) {
    const angle = (t - 0.25) * Math.PI * 2; // lever ~6 h, coucher ~18 h
    const elev = Math.sin(angle);
    const azim = Math.cos(angle);
    this._dir.set(azim * 0.6, elev, 0.35).normalize();

    const day = THREE.MathUtils.clamp(elev * 3, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 5, 0, 1);

    // la zone d'ombre suit le joueur
    const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this._dir.x * 160, this._dir.y * 160 + 20, fz + this._dir.z * 160);

    this.sun.intensity = THREE.MathUtils.lerp(0.06, 3.0, day);
    this.sun.color.setHSL(0.09, THREE.MathUtils.lerp(0.1, 0.9, dusk), THREE.MathUtils.lerp(1.0, 0.6, dusk));
    this.hemi.intensity = THREE.MathUtils.lerp(0.18, 0.85, day);

    this._state.day = day;
    this._state.dusk = dusk;
    return this._state;
  }
}
