import * as THREE from 'three';

/**
 * SkyDome — dôme de ciel en shader dégradé (zénith → horizon) avec
 * disque solaire et halo. Léger et stylisé — remplace la skybox.
 * Les couleurs sont pilotées par le cycle jour/nuit (updateFromSun).
 */

const KEY = {
  jour:  { haut: new THREE.Color('#3a9de8'), horizon: new THREE.Color('#bfe6f2') },
  crepuscule: { haut: new THREE.Color('#37447e'), horizon: new THREE.Color('#ff9a5a') },
  nuit:  { haut: new THREE.Color('#0a1030'), horizon: new THREE.Color('#182848') },
};

export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      uHaut: { value: KEY.jour.haut.clone() },
      uHorizon: { value: KEY.jour.horizon.clone() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color('#fff2c8') },
      uSunGlow: { value: 1.0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w; // toujours à la profondeur max
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHaut;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunGlow;
        varying vec3 vDir;

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uHaut, pow(h, 0.55));

          float s = dot(d, normalize(uSunDir));
          col += uSunColor * smoothstep(0.9993, 0.9998, s) * 2.0 * uSunGlow;  // disque
          col += uSunColor * pow(clamp(s, 0.0, 1.0), 24.0) * 0.28 * uSunGlow; // halo

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Met à jour couleurs et soleil depuis l'état du cycle (Lighting). */
  updateFromSun(sunDir, day, dusk, focus) {
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunGlow.value = Math.max(day, dusk * 0.8);

    const u = this.uniforms;
    // nuit → jour, puis injection du crépuscule
    u.uHaut.value.copy(KEY.nuit.haut).lerp(KEY.jour.haut, day).lerp(KEY.crepuscule.haut, dusk * 0.8);
    u.uHorizon.value.copy(KEY.nuit.horizon).lerp(KEY.jour.horizon, day).lerp(KEY.crepuscule.horizon, dusk * 0.9);
    u.uSunColor.value.setHSL(0.11, 0.7 * dusk + 0.15, 0.92 - dusk * 0.25);

    // le dôme suit le joueur : l'horizon est toujours à l'infini
    if (focus) this.mesh.position.set(focus.x, 0, focus.z);
  }
}
