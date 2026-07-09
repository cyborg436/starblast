import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * SkyDome — ciel physique (shader Sky de three.js, diffusion Rayleigh/Mie).
 * Rend le lever/coucher de soleil crédible avec le tone mapping ACES.
 * La couleur du brouillard de la scène est synchronisée sur l'heure.
 */
export class SkyDome {
  constructor(scene) {
    this.scene = scene;

    this.sky = new Sky();
    this.sky.scale.setScalar(4500); // à l'intérieur du far de la caméra (2000 × ... le shader est en espace clip, l'échelle importe peu)
    scene.add(this.sky);

    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.8;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;

    this._fogDay = new THREE.Color(0xbfd5e8);
    this._fogDusk = new THREE.Color(0xd8a068);
    this._fogNight = new THREE.Color(0x0e1424);
  }

  /** Aligne le ciel sur la direction du soleil ; teinte le brouillard selon l'heure. */
  setSunDirection(dir, timeOfDay) {
    this.sky.material.uniforms.sunPosition.value.copy(dir);

    if (this.scene.fog) {
      const elev = dir.y;
      const day = THREE.MathUtils.clamp(elev * 3, 0, 1);
      const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 5, 0, 1);
      this.scene.fog.color
        .copy(this._fogNight)
        .lerp(this._fogDay, day)
        .lerp(this._fogDusk, dusk * 0.7);
    }
    // timeOfDay disponible pour de futurs effets (étoiles, lune…)
    void timeOfDay;
  }
}
