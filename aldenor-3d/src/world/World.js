import * as THREE from 'three';
import { Lighting } from './Lighting.js';
import { SkyDome } from './Sky.js';
import { WorldGen } from './Biomes.js';
import { TerrainSystem } from './TerrainSystem.js';
import { POIManager } from './POIManager.js';
import { waterUniforms } from './Water.js';

/**
 * World — orchestre le monde ouvert :
 * génération (WorldGen), streaming de chunks (TerrainSystem),
 * points d'intérêt (POIManager), ciel/éclairage/cycle jour-nuit,
 * ambiance par biome (brouillard progressif + hook musique).
 */
export class World {
  constructor(scene, _assets, _maxAnisotropy, seed = 1337) {
    this.scene = scene;

    this.gen = new WorldGen(seed);
    this.pois = new POIManager(this.gen); // branche l'aplanissement AVANT le premier chunk
    this.terrain = new TerrainSystem(scene, this.gen, this.pois);
    this.lighting = new Lighting(scene);
    this.sky = new SkyDome(scene);

    /** Point suivi par le streaming (référence vive : la cible caméra, puis le joueur). */
    this.focus = new THREE.Vector3();

    /** Cycle jour/nuit : 0 = minuit, 0.5 = midi. Un jour = 20 min réelles. */
    this.timeOfDay = 0.35;
    this.dayLength = 1200;

    /** Hook musique d'ambiance : appelé à chaque changement de biome dominant. */
    this.onBiomeChange = (biome) => console.info(`[ambiance] biome : ${biome.nom} → musique "${biome.musique}"`);
    this._biome = null;

    this._fogCible = { couleur: new THREE.Color(), near: 90, far: 380 };
    scene.fog = new THREE.Fog(0xcfe8d8, 90, 380);

    // zone de spawn générée immédiatement (le reste streame à la volée)
    this.terrain.warmup(0, 0, 1);
    this.pois.build(scene);
  }

  /** Suit une cible vivante (Vector3 muté ailleurs : cible caméra ou joueur). */
  track(target) {
    this._tracked = target;
  }

  getHeightAt(x, z) {
    return this.terrain.heightAt(x, z);
  }

  update(dt, elapsed) {
    if (this._tracked) this.focus.copy(this._tracked);

    // --- cycle jour/nuit ---
    if (this.dayLength > 0) this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;
    const sun = this.lighting.setTimeOfDay(this.timeOfDay, this.focus);
    this.sky.updateFromSun(sun.dir, sun.day, sun.dusk, this.focus);

    // --- eau ---
    waterUniforms.uTime.value = elapsed;
    waterUniforms.uSunDir.value.copy(sun.dir);
    waterUniforms.uLight.value = Math.max(sun.day, 0.12);

    // --- streaming de chunks ---
    this.terrain.update(this.focus);

    // --- ambiance de biome : brouillard progressif + hook musique ---
    this.gen.ambianceAt(this.focus.x, this.focus.z, this._fogCible);
    const fog = this.scene.fog;
    const lum = THREE.MathUtils.lerp(0.14, 1, sun.day); // brouillard assombri la nuit
    const k = Math.min(dt * 1.5, 1);
    fog.color.lerp(this._fogCibleCouleurNuit(lum), k);
    fog.near += (this._fogCible.near - fog.near) * k;
    fog.far += (this._fogCible.far - fog.far) * k;

    const biome = this.gen.dominantAt(this.focus.x, this.focus.z);
    if (biome !== this._biome) {
      this._biome = biome;
      if (this.onBiomeChange) this.onBiomeChange(biome);
    }
  }

  _fogCibleCouleurNuit(lum) {
    if (!this._tmpFog) this._tmpFog = new THREE.Color();
    return this._tmpFog.copy(this._fogCible.couleur).multiplyScalar(lum);
  }

  /** Force une heure (0..1) — debug & futurs événements scénarisés. */
  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
  }

  /** Infos de debug pour le HUD. */
  get debugInfo() {
    return `${this._biome ? this._biome.nom : '…'} · ${this.terrain.loadedCount} chunks`;
  }
}
