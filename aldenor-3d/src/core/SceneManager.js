import * as THREE from 'three';

/**
 * SceneManager — possède la THREE.Scene active et la caméra.
 * À terme : gèrera plusieurs scènes (monde extérieur, donjons) avec
 * transitions, comme les cartes du jeu 2D.
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();

    // Brouillard : masque la limite de vue — cohérent avec far=2000
    this.scene.fog = new THREE.Fog(0xbfd5e8, 250, 1400);

    // Caméra open world : FOV 60, near/far larges.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    this.camera.position.set(14, 10, 18);
    this.camera.lookAt(0, 1, 0);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
