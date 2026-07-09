import * as THREE from 'three';

/**
 * Crée le renderer WebGL configuré pour un rendu "filmique" cohérent :
 * - tone mapping ACES Filmic (indispensable avec des intensités lumineuses physiques)
 * - sortie en sRGB
 * - ombres douces PCF
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}
