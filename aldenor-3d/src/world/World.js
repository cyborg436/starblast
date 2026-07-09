import * as THREE from 'three';
import { Lighting } from './Lighting.js';
import { SkyDome } from './Sky.js';

/**
 * World — le monde 3D.
 * Phase 1 : sol plat + grille de debug + un cube témoin, pour valider
 * renderer / ombres / boucle. Ce fichier accueillera ensuite le terrain
 * par heightmap, les biomes et le streaming de chunks.
 */
export class World {
  constructor(scene, _assets, maxAnisotropy = 4) {
    this.scene = scene;
    this.maxAnisotropy = maxAnisotropy;

    this.lighting = new Lighting(scene);
    this.sky = new SkyDome(scene);

    // Heure de départ : matin (0 = minuit, 0.5 = midi) — même convention
    // que le cycle jour/nuit du jeu 2D.
    this.timeOfDay = 0.35;
    /** Durée d'un jour complet en secondes (8 min, comme en 2D). Mettre 0 pour figer. */
    this.dayLength = 480;
    this._applyTimeOfDay();

    this._buildGround();
    this._buildDebugProps();
  }

  _buildGround() {
    // Sol temporaire 1000×1000 — sera remplacé par le terrain streamé.
    // La grille de debug est DANS la texture du sol (et non une GridHelper) :
    // pas de z-fighting possible, anti-aliasing par mipmaps, et les
    // primitives lignes WebGL sont mal rastérisées par certains renderers
    // logiciels (SwiftShader).
    const geo = new THREE.PlaneGeometry(1000, 1000);
    const mat = new THREE.MeshStandardMaterial({
      map: this._makeGridTexture(),
      roughness: 1.0,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  /**
   * Texture de grille : une tuile = 100 m, subdivisée en cases de 10 m.
   * Lignes mineures discrètes, ligne majeure marquée tous les 100 m.
   */
  _makeGridTexture() {
    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4a7a38';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // lignes mineures (10 m)
    ctx.strokeStyle = 'rgba(240, 228, 160, 0.22)';
    ctx.lineWidth = 3;
    const step = SIZE / 10;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) {
      ctx.moveTo(i * step, 0); ctx.lineTo(i * step, SIZE);
      ctx.moveTo(0, i * step); ctx.lineTo(SIZE, i * step);
    }
    ctx.stroke();

    // ligne majeure (100 m) sur les bords de la tuile
    ctx.strokeStyle = 'rgba(240, 228, 160, 0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, SIZE, SIZE);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10); // 10 tuiles de 100 m sur les 1000 m du sol
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAnisotropy;
    return tex;
  }

  _buildDebugProps() {
    // Cube témoin : valide les ombres portées et l'animation de la boucle.
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.5 }),
    );
    cube.position.set(0, 1.6, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    this.scene.add(cube);
    this.debugCube = cube;
  }

  update(dt, _elapsed) {
    // Cycle jour/nuit : avance l'heure et met à jour soleil + ciel.
    if (this.dayLength > 0) {
      this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;
      this._applyTimeOfDay();
    }

    if (this.debugCube) {
      this.debugCube.rotation.y += dt * 0.6;
      this.debugCube.position.y = 1.6 + Math.sin(_elapsed * 1.5) * 0.3;
    }
  }

  /** Force une heure (0..1). Hook central du futur cycle jour/nuit complet. */
  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this._applyTimeOfDay();
  }

  _applyTimeOfDay() {
    const sunDir = this.lighting.setTimeOfDay(this.timeOfDay);
    this.sky.setSunDirection(sunDir, this.timeOfDay);
  }
}
