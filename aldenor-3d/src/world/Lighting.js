import * as THREE from 'three';

/**
 * Lighting — éclairage global du monde.
 * - Directionnelle (soleil) avec ombres PCF sur une zone de 120 m autour de l'origine.
 *   (À terme : la cible suivra le joueur pour que les ombres suivent la caméra.)
 * - HemisphereLight pour l'ambiance ciel/sol.
 * - setTimeOfDay(t) : hook du cycle jour/nuit — position et couleur du soleil.
 */
export class Lighting {
  constructor(scene) {
    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 500;
    const S = 60; // demi-étendue de la zone d'ombre (m)
    this.sun.shadow.camera.left = -S;
    this.sun.shadow.camera.right = S;
    this.sun.shadow.camera.top = S;
    this.sun.shadow.camera.bottom = -S;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd5e8, 0x3a5228, 0.8);
    scene.add(this.hemi);

    this._sunDir = new THREE.Vector3();
  }

  /**
   * Positionne le soleil pour une heure donnée (0 = minuit, 0.5 = midi).
   * Retourne la direction du soleil (unitaire) pour synchroniser le ciel.
   */
  setTimeOfDay(t) {
    // Arc est → zénith → ouest ; sous l'horizon la nuit.
    const angle = (t - 0.25) * Math.PI * 2; // lever ~6 h, coucher ~18 h
    const elev = Math.sin(angle);
    const azim = Math.cos(angle);

    this._sunDir.set(azim * 0.6, elev, 0.35).normalize();
    this.sun.position.copy(this._sunDir).multiplyScalar(160);
    this.sun.target.position.set(0, 0, 0);

    // Intensités : plein jour → crépuscule chaud → nuit lunaire.
    const day = THREE.MathUtils.clamp(elev * 3, 0, 1);          // 1 en journée
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 5, 0, 1); // pic à l'horizon

    this.sun.intensity = THREE.MathUtils.lerp(0.05, 3.0, day);
    this.sun.color.setHSL(0.09, THREE.MathUtils.lerp(0.1, 0.9, dusk), THREE.MathUtils.lerp(1.0, 0.6, dusk));
    this.hemi.intensity = THREE.MathUtils.lerp(0.15, 0.8, day);

    return this._sunDir;
  }
}
