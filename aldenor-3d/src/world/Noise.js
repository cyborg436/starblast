import { createNoise2D } from 'simplex-noise';

/** PRNG déterministe (même seed → même monde). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash 2D → [0,1) — pour le placement déterministe des props par cellule. */
export function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Champ de bruit de Simplex seedé, avec fbm multi-octaves. */
export class NoiseField {
  constructor(seed) {
    this.noise2D = createNoise2D(mulberry32(seed));
  }

  /** Bruit brut ∈ [-1, 1]. */
  at(x, y) {
    return this.noise2D(x, y);
  }

  /** Bruit fractal ∈ [-1, 1] : octaves = relief général + détail fin. */
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      total += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / total;
  }

  /** fbm remappé ∈ [0, 1]. */
  fbm01(x, y, octaves = 4) {
    return this.fbm(x, y, octaves) * 0.5 + 0.5;
  }

  /** Bruit "ridged" ∈ [0, 1] : crêtes marquées, pour les montagnes. */
  ridged(x, y) {
    const v = 1 - Math.abs(this.noise2D(x, y));
    return v * v;
  }
}
