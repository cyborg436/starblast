import * as THREE from 'three';
import { NoiseField } from './Noise.js';

/**
 * Biomes & WorldGen — le cœur de la génération.
 *
 * Deux cartes climatiques basse fréquence (température, humidité)
 * découpent le monde en régions. Chaque point reçoit un POIDS par biome
 * (gaussienne de distance dans l'espace climat) : les transitions sont
 * donc progressives — hauteur, couleurs, densité de props et ambiance
 * sont toutes des moyennes pondérées, jamais des murs nets.
 */

export const WATER_LEVEL = 0;

/* Palette stylisée saturée (direction cartoon). */
export const BIOMES = [
  {
    id: 'prairie', nom: 'Prairie d\'Aldenor',
    t: 0.50, m: 0.32,
    sol: new THREE.Color('#74c94e'), solVar: new THREE.Color('#8fdc60'),
    fog: { couleur: new THREE.Color('#cfe8d8'), near: 90, far: 380 },
    musique: 'theme_prairie',
    props: { feuillu: 0.045, pin: 0.008, buisson: 0.05, rocher: 0.012 },
  },
  {
    id: 'foret', nom: 'Forêt de Sombrebois',
    t: 0.42, m: 0.68,
    sol: new THREE.Color('#3f9142'), solVar: new THREE.Color('#57a84f'),
    fog: { couleur: new THREE.Color('#a8ccae'), near: 55, far: 300 },
    musique: 'theme_foret',
    props: { pin: 0.30, feuillu: 0.16, buisson: 0.06, rocher: 0.02, champignon: 0.02 },
  },
  {
    id: 'desert', nom: 'Désert de Cendrelune',
    t: 0.86, m: 0.14,
    sol: new THREE.Color('#e9c86a'), solVar: new THREE.Color('#f2d98a'),
    fog: { couleur: new THREE.Color('#f4dfae'), near: 110, far: 420 },
    musique: 'theme_desert',
    props: { cactus: 0.035, rocher: 0.045, osdesert: 0.006 },
  },
  {
    id: 'neige', nom: 'Terres Gelées',
    t: 0.10, m: 0.50,
    sol: new THREE.Color('#eef3f7'), solVar: new THREE.Color('#dbe7f0'),
    fog: { couleur: new THREE.Color('#dfe9f2'), near: 70, far: 340 },
    musique: 'theme_neige',
    props: { pinneige: 0.13, rocher: 0.05 },
  },
  {
    id: 'marais', nom: 'Marais Putrides',
    t: 0.62, m: 0.88,
    sol: new THREE.Color('#5d7a44'), solVar: new THREE.Color('#6e8a50'),
    fog: { couleur: new THREE.Color('#93a684'), near: 40, far: 240 },
    musique: 'theme_marais',
    props: { arbremort: 0.09, roseau: 0.14, buisson: 0.03, rocher: 0.01, champignon: 0.03 },
  },
];

const SIGMA2 = 2 * 0.14 * 0.14; // largeur de la zone tampon entre biomes

const ROCHE = new THREE.Color('#8d99a6');
const ROCHE_CHAUDE = new THREE.Color('#a68a6e');
const RIVAGE = new THREE.Color('#c9b070');
const VASE = new THREE.Color('#7a7048');

export class WorldGen {
  constructor(seed = 1337) {
    this.seed = seed;
    this.nTemp = new NoiseField(seed + 101);   // température
    this.nHum = new NoiseField(seed + 202);    // humidité
    this.nBase = new NoiseField(seed + 303);   // relief général
    this.nDetail = new NoiseField(seed + 404); // détail fin
    this.nRidge = new NoiseField(seed + 505);  // crêtes de montagne
    this.nDune = new NoiseField(seed + 606);   // dunes
    this.nBasin = new NoiseField(seed + 707);  // cuvettes → lacs
    this.nJitter = new NoiseField(seed + 808); // variation de couleur du sol

    /** Modificateur de hauteur externe (POI : aplanissement). Signature (x, z, h) → h. */
    this.heightModifier = null;

    this._w = new Float32Array(BIOMES.length);
    this._col = new THREE.Color();
  }

  /** Climat (t, m) ∈ [0,1]² — biaisé vers la prairie autour du spawn (0,0). */
  climate(x, z) {
    let t = this.nTemp.fbm01(x / 900, z / 900, 3);
    let m = this.nHum.fbm01(x / 700, z / 700, 3);
    const d2 = x * x + z * z;
    const haven = Math.exp(-d2 / (260 * 260)); // rayon de ~260 m
    t += (BIOMES[0].t - t) * haven;
    m += (BIOMES[0].m - m) * haven;
    return { t, m };
  }

  /**
   * Poids normalisés des biomes au point (x,z).
   * ATTENTION : retourne un tableau interne réutilisé (copier si conservé).
   */
  weights(x, z) {
    const { t, m } = this.climate(x, z);
    const w = this._w;
    let sum = 0;
    for (let i = 0; i < BIOMES.length; i++) {
      const b = BIOMES[i];
      const dt = t - b.t, dm = m - b.m;
      w[i] = Math.exp(-(dt * dt + dm * dm) / SIGMA2);
      sum += w[i];
    }
    for (let i = 0; i < w.length; i++) w[i] /= sum;
    return w;
  }

  /** Hauteur du terrain SANS modificateur POI. */
  heightRaw(x, z) {
    const w = this.weights(x, z);
    const base = this.nBase.fbm(x / 480, z / 480, 5);        // [-1,1] relief général
    const detail = this.nDetail.fbm(x / 38, z / 38, 2);      // détail fin
    const ridge = this.nRidge.ridged(x / 320, z / 320);      // crêtes
    const dune = 1 - Math.abs(this.nDune.at(x / 90, z / 55)); // dunes allongées

    // hauteur par biome (plaines douces → vraies montagnes)
    const hPrairie = 2.5 + base * 5 + detail * 0.9;
    const hForet = 4.0 + base * 9 + detail * 1.6;
    const hDesert = 3.0 + base * 4 + dune * 5.5 + detail * 0.5;
    const hNeige = 7.0 + base * 12 + ridge * 58 + detail * 2.2;
    const hMarais = -0.6 + base * 1.4 + detail * 0.35;

    let h = w[0] * hPrairie + w[1] * hForet + w[2] * hDesert + w[3] * hNeige + w[4] * hMarais;

    // cuvettes → lacs (atténuées dans le désert : oasis rares)
    const basin = this.nBasin.fbm01(x / 620, z / 620, 2);
    if (basin > 0.64) {
      const carve = (basin - 0.64) / 0.36;
      h -= carve * carve * 38 * (1 - w[2] * 0.7);
    }
    return h;
  }

  /** Hauteur finale (avec adaptation locale des POI). API publique du monde. */
  height(x, z) {
    let h = this.heightRaw(x, z);
    if (this.heightModifier) h = this.heightModifier(x, z, h);
    return h;
  }

  /**
   * Couleur stylisée du sol au point (x,z).
   * slope = ‖gradient‖ ; retourne une Color interne réutilisée (copier).
   */
  colorAt(x, z, h, w, slope) {
    const col = this._col.setRGB(0, 0, 0);
    // mélange des sols de biomes, avec variation locale
    const v = this.nJitter.fbm01(x / 23, z / 23, 2);
    for (let i = 0; i < BIOMES.length; i++) {
      if (w[i] < 0.01) continue;
      const b = BIOMES[i];
      const r = b.sol.r + (b.solVar.r - b.sol.r) * v;
      const g = b.sol.g + (b.solVar.g - b.sol.g) * v;
      const bl = b.sol.b + (b.solVar.b - b.sol.b) * v;
      col.r += r * w[i]; col.g += g * w[i]; col.b += bl * w[i];
    }
    // pentes raides → roche (chaude en désert, grise ailleurs)
    if (slope > 0.55) {
      const k = Math.min((slope - 0.55) / 0.5, 1);
      const roche = w[2] > 0.5 ? ROCHE_CHAUDE : ROCHE;
      col.lerp(roche, k * 0.85);
    }
    // rivages : sable/vase près du niveau de l'eau
    if (h < WATER_LEVEL + 0.9) {
      const k = Math.min(Math.max((WATER_LEVEL + 0.9 - h) / 1.6, 0), 1);
      col.lerp(w[4] > 0.4 ? VASE : RIVAGE, k * 0.8);
    }
    return col;
  }

  /** Biome dominant au point (x,z). */
  dominantAt(x, z) {
    const w = this.weights(x, z);
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return BIOMES[best];
  }

  /** Ambiance (brouillard) pondérée au point (x,z) — pour la transition douce. */
  ambianceAt(x, z, out) {
    const w = this.weights(x, z);
    out.couleur.setRGB(0, 0, 0);
    out.near = 0; out.far = 0;
    for (let i = 0; i < BIOMES.length; i++) {
      const f = BIOMES[i].fog;
      out.couleur.r += f.couleur.r * w[i];
      out.couleur.g += f.couleur.g * w[i];
      out.couleur.b += f.couleur.b * w[i];
      out.near += f.near * w[i];
      out.far += f.far * w[i];
    }
    return out;
  }
}
