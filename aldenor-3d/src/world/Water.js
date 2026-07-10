import * as THREE from 'three';
import { WATER_LEVEL } from './Biomes.js';

/**
 * Eau stylisée : plan par chunk au niveau de l'eau, shader simple —
 * vagues de vertex animées + dégradé rive/profondeur + glint du soleil.
 * Pas de réflexion : direction cartoon assumée.
 */

const waterMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  // fog: true exige les uniforms de brouillard de three.js (fogColor…)
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 1, 0.3) },
      uShallow: { value: new THREE.Color('#4fc3d9') },
      uDeep: { value: new THREE.Color('#1f6e9c') },
      uLight: { value: 1.0 }, // facteur jour/nuit
    },
  ]),
  fog: true,
  vertexShader: /* glsl */ `
    #include <fog_pars_vertex>
    uniform float uTime;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying float vWave;

    void main() {
      vec3 p = position;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      float w1 = sin(wp.x * 0.35 + uTime * 1.4);
      float w2 = cos(wp.z * 0.28 + uTime * 1.1);
      float w3 = sin((wp.x + wp.z) * 0.12 + uTime * 0.7);
      wp.y += (w1 + w2) * 0.09 + w3 * 0.12;
      vWave = w3 * 0.5 + 0.5;

      // normale approchée des vagues (dérivées analytiques)
      float dx = 0.35 * cos(wp.x * 0.35 + uTime * 1.4) * 0.09 + 0.12 * cos((wp.x + wp.z) * 0.12 + uTime * 0.7) * 0.12;
      float dz = -0.28 * sin(wp.z * 0.28 + uTime * 1.1) * 0.09 + 0.12 * cos((wp.x + wp.z) * 0.12 + uTime * 0.7) * 0.12;
      vNormalW = normalize(vec3(-dx, 1.0, -dz));
      vViewDir = normalize(cameraPosition - wp.xyz);

      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    #include <fog_pars_fragment>
    uniform vec3 uSunDir;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform float uLight;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying float vWave;

    void main() {
      // fresnel simple : rasant → plus opaque et plus profond
      float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 2.0);
      vec3 col = mix(uShallow, uDeep, clamp(fres * 1.2 + vWave * 0.25, 0.0, 1.0));

      // reflet du soleil
      vec3 r = reflect(-normalize(uSunDir), vNormalW);
      float glint = pow(max(dot(r, vViewDir), 0.0), 90.0);
      col += vec3(1.0, 0.95, 0.8) * glint * 0.9 * uLight;

      col *= mix(0.25, 1.0, uLight); // assombrit la nuit
      gl_FragColor = vec4(col, 0.78);
      #include <fog_fragment>
    }
  `,
});

/** Uniforms vivants du matériau (mis à jour chaque frame par World). */
export const waterUniforms = waterMaterial.uniforms;

/** Crée le plan d'eau d'un chunk (ou null si le chunk n'a pas d'eau). */
export function makeWaterTile(chunkX, chunkZ, size, minHeight) {
  if (minHeight > WATER_LEVEL + 0.4) return null;
  const geo = new THREE.PlaneGeometry(size, size, 12, 12);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, waterMaterial);
  mesh.position.set(chunkX * size + size / 2, WATER_LEVEL, chunkZ * size + size / 2);
  mesh.renderOrder = 2;
  return mesh;
}
