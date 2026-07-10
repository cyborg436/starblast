import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './Noise.js';
import poisData from '../data/pois.json';

/**
 * POIManager — points d'intérêt définis à la main (data/pois.json),
 * insérés dans le monde procédural :
 *  1. adapte le terrain : plateau aplani + transition douce (heightModifier)
 *  2. exclut les props procéduraux du rayon
 *  3. construit un décor stylisé par type (ruines, campement, autel, grotte)
 */

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

function paint(geo, color) {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function mergedMesh(parts) {
  const soup = parts.map(p => (p.index ? p.toNonIndexed() : p));
  const geo = mergeGeometries(soup, false);
  for (const p of parts) p.dispose();
  for (const p of soup) p.dispose();
  return new THREE.Mesh(geo, MAT);
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export class POIManager {
  constructor(gen) {
    this.gen = gen;
    this.pois = poisData.pois.map(p => ({ tampon: 18, ...p }));

    // hauteur de plateau : hauteur naturelle au centre (AVANT modification)
    for (const p of this.pois) p.h = gen.heightRaw(p.x, p.z);

    // branche l'adaptation de terrain dans le générateur
    gen.heightModifier = (x, z, h) => this._modifyHeight(x, z, h);
  }

  _modifyHeight(x, z, h) {
    for (const p of this.pois) {
      const dx = x - p.x, dz = z - p.z;
      const reach = p.rayon + p.tampon;
      if (dx * dx + dz * dz > reach * reach) continue;
      const d = Math.sqrt(dx * dx + dz * dz);
      const k = (1 - smoothstep(p.rayon, reach, d)) * p.aplanir;
      h = h + (p.h - h) * k;
    }
    return h;
  }

  /** Zone réservée : les props procéduraux n'y poussent pas. */
  blocked(x, z) {
    for (const p of this.pois) {
      const dx = x - p.x, dz = z - p.z;
      const r = p.rayon + 3;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /** Construit les décors de tous les POI (peu nombreux → ajoutés une fois). */
  build(scene) {
    for (const p of this.pois) {
      const group = new THREE.Group();
      group.name = 'poi_' + p.id;
      const rng = mulberry32(p.x * 31 + p.z * 17 + 977);
      const builder = { ruines: buildRuines, campement: buildCampement, autel: buildAutel, grotte: buildGrotte }[p.type];
      if (builder) builder(group, p, rng);
      group.position.set(p.x, p.h, p.z);
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(group);
    }
  }
}

/* ---------- décors stylisés par type ---------- */

function buildRuines(group, p, rng) {
  const parts = [];
  const nCol = 6;
  for (let i = 0; i < nCol; i++) {
    const a = (i / nCol) * Math.PI * 2;
    const r = p.rayon * 0.55;
    const brisee = rng() < 0.45;
    const hcol = brisee ? 1.2 + rng() * 1.5 : 4 + rng() * 0.8;
    const col = paint(new THREE.CylinderGeometry(0.45, 0.55, hcol, 7).translate(Math.cos(a) * r, hcol / 2, Math.sin(a) * r), '#b8b2a4');
    if (brisee) col.rotateY(rng());
    parts.push(col);
    if (brisee) parts.push(paint(new THREE.BoxGeometry(1.2, 0.5, 2.2).translate(Math.cos(a) * r + 1.2, 0.25, Math.sin(a) * r + (rng() - 0.5) * 2).rotateY(rng() * 3), '#a8a294'));
  }
  parts.push(paint(new THREE.CylinderGeometry(p.rayon * 0.7, p.rayon * 0.75, 0.5, 16).translate(0, 0.25, 0), '#9a948a'));
  parts.push(paint(new THREE.BoxGeometry(2.2, 1.4, 1.2).translate(0, 1.2, 0), '#b0aa9c'));
  group.add(mergedMesh(parts));
}

function buildCampement(group, p, rng) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const r = p.rayon * 0.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    parts.push(paint(new THREE.ConeGeometry(2.2, 2.8, 7).translate(x, 1.4, z).rotateY(rng() * 2), '#8a6a3a'));
    parts.push(paint(new THREE.ConeGeometry(0.4, 0.9, 5).translate(x, 3.0, z), '#6e5230'));
  }
  // feu de camp central
  parts.push(paint(new THREE.CylinderGeometry(1.0, 1.2, 0.3, 9).translate(0, 0.15, 0), '#6a625a'));
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    parts.push(paint(new THREE.CylinderGeometry(0.09, 0.12, 1.3, 4).translate(0, 0.65, 0).rotateZ(1.1).rotateY(a), '#5c4626'));
  }
  parts.push(paint(new THREE.BoxGeometry(1, 1, 1).translate(3.2, 0.5, -1.5).rotateY(0.4), '#8a6a40'));
  parts.push(paint(new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(3.9, 0.45, -0.4).rotateY(0.9), '#7a5c36'));
  group.add(mergedMesh(parts));

  // flamme émissive (stylisée)
  const flamme = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: '#ff9a30', emissive: '#ff6a10', emissiveIntensity: 2.2 }),
  );
  flamme.position.set(0, 0.9, 0);
  flamme.castShadow = false;
  group.add(flamme);
}

function buildAutel(group, p, _rng) {
  const parts = [];
  parts.push(paint(new THREE.CylinderGeometry(p.rayon * 0.5, p.rayon * 0.58, 0.6, 12).translate(0, 0.3, 0), '#aab4be'));
  parts.push(paint(new THREE.CylinderGeometry(p.rayon * 0.32, p.rayon * 0.36, 0.5, 10).translate(0, 0.85, 0), '#b8c2cc'));
  parts.push(paint(new THREE.BoxGeometry(1.6, 1.1, 1.0).translate(0, 1.65, 0), '#c4ccd4'));
  for (const s of [-1, 1]) {
    parts.push(paint(new THREE.CylinderGeometry(0.35, 0.4, 3.4, 7).translate(s * 3.2, 1.7, 0), '#aab4be'));
    parts.push(paint(new THREE.BoxGeometry(1.1, 0.4, 1.1).translate(s * 3.2, 3.6, 0), '#98a2ac'));
  }
  group.add(mergedMesh(parts));

  const cristal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: '#7ad8ff', emissive: '#3aa0e8', emissiveIntensity: 1.8 }),
  );
  cristal.position.set(0, 2.9, 0);
  group.add(cristal);
}

function buildGrotte(group, p, rng) {
  const parts = [];
  // amas de gros rochers formant une entrée
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8 + Math.PI;
    const r = 3.2;
    const s = 1.6 + rng() * 1.6;
    parts.push(paint(
      new THREE.DodecahedronGeometry(s, 0).scale(1.2, 1 + rng() * 0.6, 1).translate(Math.cos(a) * r, s * 0.6, Math.sin(a) * r).rotateY(rng() * 3),
      i % 2 ? '#7d8a97' : '#8d99a6',
    ));
  }
  parts.push(paint(new THREE.DodecahedronGeometry(2.6, 0).scale(1.5, 1.1, 1).translate(0, 3.2, -3.4), '#8d99a6'));
  group.add(mergedMesh(parts));

  // bouche sombre de la grotte
  const bouche = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 16),
    new THREE.MeshBasicMaterial({ color: '#06080c' }),
  );
  bouche.position.set(0, 1.7, -2.1);
  group.add(bouche);
}
