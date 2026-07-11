import { Chunk, CHUNK_SIZE } from './Chunk.js';

/**
 * TerrainSystem — streaming de chunks autour du joueur.
 * Charge les chunks dans LOAD_RADIUS (en anneaux, du plus proche au plus
 * lointain), en génère au plus un par frame (pas de à-coups), décharge
 * au-delà de UNLOAD_RADIUS. Tout est régénéré à la demande avec la même
 * seed : revenir dans une zone redonne exactement le même monde.
 */

const LOAD_RADIUS = 3;   // chunks chargés : (2×3+1)² = 49 → ~350 m de vue
const UNLOAD_RADIUS = 4; // marge anti-oscillation avant déchargement

export class TerrainSystem {
  constructor(scene, gen, poiManager, physics = null) {
    this.scene = scene;
    this.gen = gen;
    this.poiManager = poiManager;
    this.physics = physics;
    this.chunks = new Map(); // "cx,cz" → Chunk
    this._queue = [];
  }

  /** Hauteur du monde — API publique (placement du joueur, IA, POI…). */
  heightAt(x, z) {
    return this.gen.height(x, z);
  }

  /** Génère immédiatement la zone de spawn (appelé une fois à l'init). */
  warmup(x, z, radius = 1) {
    const ccx = Math.floor(x / CHUNK_SIZE), ccz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this._load(ccx + dx, ccz + dz);
      }
    }
  }

  update(focus) {
    const ccx = Math.floor(focus.x / CHUNK_SIZE);
    const ccz = Math.floor(focus.z / CHUNK_SIZE);

    // décharge les chunks trop lointains
    for (const [key, chunk] of this.chunks) {
      if (Math.max(Math.abs(chunk.cx - ccx), Math.abs(chunk.cz - ccz)) > UNLOAD_RADIUS) {
        chunk.dispose(this.scene);
        this.chunks.delete(key);
      }
    }

    // liste des chunks manquants, triés du plus proche au plus lointain
    this._queue.length = 0;
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (!this.chunks.has(cx + ',' + cz)) this._queue.push([cx, cz, dx * dx + dz * dz]);
      }
    }
    if (this._queue.length > 0) {
      this._queue.sort((a, b) => a[2] - b[2]);
      const [cx, cz] = this._queue[0];
      this._load(cx, cz); // 1 chunk max par frame
    }
  }

  _load(cx, cz) {
    const key = cx + ',' + cz;
    if (this.chunks.has(key)) return;
    const chunk = new Chunk(this.gen, cx, cz, this.poiManager, this.physics);
    chunk.addTo(this.scene);
    this.chunks.set(key, chunk);
  }

  get loadedCount() {
    return this.chunks.size;
  }
}
