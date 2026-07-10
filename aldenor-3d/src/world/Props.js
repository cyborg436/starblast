import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from './Noise.js';
import { BIOMES, WATER_LEVEL } from './Biomes.js';

/**
 * Props — végétation et rochers low-poly stylisés, 100 % procéduraux
 * (primitives fusionnées + couleurs par vertex, flat shading).
 * Rendu en THREE.InstancedMesh : un seul draw call par type et par chunk.
 * Placement pseudo-aléatoire mais déterministe : grille de cellules de 4 m
 * hashée par la seed → revenir dans une zone redonne le même résultat.
 */

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function merged(parts) {
  // certaines primitives (polyèdres) sont non-indexées, d'autres indexées :
  // mergeGeometries exige l'homogénéité → tout passer en non-indexé
  const soup = parts.map(p => (p.index ? p.toNonIndexed() : p));
  const geo = mergeGeometries(soup, false);
  for (const p of parts) p.dispose();
  for (const p of soup) p.dispose();
  return geo;
}

function mkPin(neige = false) {
  const tronc = paint(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 5).translate(0, 0.8, 0), '#7a5230');
  const c1 = paint(new THREE.ConeGeometry(1.7, 2.6, 6).translate(0, 2.6, 0), neige ? '#4e7a63' : '#2f7a3a');
  const c2 = paint(new THREE.ConeGeometry(1.25, 2.2, 6).translate(0, 4.1, 0), neige ? '#5d8a72' : '#3a8c44');
  const c3 = paint(new THREE.ConeGeometry(0.8, 1.8, 6).translate(0, 5.5, 0), neige ? '#e8eef4' : '#48a052');
  return merged([tronc, c1, c2, c3]);
}

function mkFeuillu() {
  const tronc = paint(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 5).translate(0, 1.1, 0), '#6e4a28');
  const f1 = paint(new THREE.IcosahedronGeometry(1.9, 0).translate(0, 3.6, 0), '#4fae3d');
  const f2 = paint(new THREE.IcosahedronGeometry(1.2, 0).translate(1.1, 2.9, 0.4), '#5cc248');
  const f3 = paint(new THREE.IcosahedronGeometry(1.0, 0).translate(-1.0, 3.1, -0.4), '#43a136');
  return merged([tronc, f1, f2, f3]);
}

function mkCactus() {
  const c = paint(new THREE.CylinderGeometry(0.45, 0.5, 3.2, 7).translate(0, 1.6, 0), '#3d9448');
  const b1 = paint(new THREE.CylinderGeometry(0.28, 0.3, 1.4, 6).translate(0.85, 1.9, 0), '#46a352');
  const b2 = paint(new THREE.CylinderGeometry(0.26, 0.28, 1.1, 6).translate(-0.8, 1.5, 0), '#46a352');
  const top = paint(new THREE.SphereGeometry(0.45, 7, 5).translate(0, 3.2, 0), '#3d9448');
  return merged([c, b1, b2, top]);
}

function mkRocher() {
  const r1 = paint(new THREE.DodecahedronGeometry(1.1, 0).scale(1.25, 0.8, 1), '#8d99a6');
  const r2 = paint(new THREE.DodecahedronGeometry(0.65, 0).translate(1.0, -0.15, 0.35), '#7d8a97');
  return merged([r1, r2]);
}

function mkBuisson() {
  const b1 = paint(new THREE.IcosahedronGeometry(0.75, 0).scale(1.25, 0.85, 1.25), '#3f9c3a');
  const b2 = paint(new THREE.IcosahedronGeometry(0.5, 0).translate(0.6, 0.1, 0.3), '#4cb045');
  return merged([b1, b2]);
}

function mkArbreMort() {
  const tronc = paint(new THREE.CylinderGeometry(0.16, 0.32, 3.6, 5).translate(0, 1.8, 0), '#4c4238');
  const b1 = paint(new THREE.CylinderGeometry(0.07, 0.12, 1.5, 4).translate(0, 0.7, 0).rotateZ(0.8).translate(0.5, 2.6, 0), '#4c4238');
  const b2 = paint(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 4).translate(0, 0.55, 0).rotateZ(-0.9).translate(-0.4, 3.0, 0.1), '#453b32');
  return merged([tronc, b1, b2]);
}

function mkRoseau() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const t = paint(
      new THREE.CylinderGeometry(0.035, 0.05, 1.5 + (i % 2) * 0.5, 4)
        .translate(Math.cos(a) * 0.22, 0.8 + (i % 2) * 0.25, Math.sin(a) * 0.22)
        .rotateZ((i % 2 ? -1 : 1) * 0.08),
      '#7a9a4a',
    );
    parts.push(t);
    if (i < 2) parts.push(paint(new THREE.SphereGeometry(0.09, 4, 3).scale(1, 2.6, 1).translate(Math.cos(a) * 0.22, 1.75 + (i % 2) * 0.4, Math.sin(a) * 0.22), '#6e5a34'));
  }
  return merged(parts);
}

function mkChampignon() {
  const pied = paint(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 5).translate(0, 0.2, 0), '#e8dcc4');
  const tete = paint(new THREE.SphereGeometry(0.28, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.38, 0), '#c8452e');
  return merged([pied, tete]);
}

function mkOsDesert() {
  const c1 = paint(new THREE.TorusGeometry(0.9, 0.09, 4, 8, Math.PI).rotateZ(0.1).translate(0, 0.05, 0), '#e3dcc8');
  const c2 = paint(new THREE.TorusGeometry(0.7, 0.08, 4, 8, Math.PI).translate(0.5, 0.02, 0.4), '#d8d0ba');
  return merged([c1, c2]);
}

/**
 * Types de props. slopeMax : pente max acceptée ; hMin/hMax : plage
 * d'altitude ; echelle : [min, max] ; ombre : cast shadow.
 */
export const PROP_TYPES = {
  pin:        { geo: mkPin(false),  slopeMax: 0.55, hMin: WATER_LEVEL + 0.6, echelle: [0.8, 1.5], ombre: true },
  pinneige:   { geo: mkPin(true),   slopeMax: 0.6,  hMin: WATER_LEVEL + 0.6, echelle: [0.8, 1.5], ombre: true },
  feuillu:    { geo: mkFeuillu(),   slopeMax: 0.5,  hMin: WATER_LEVEL + 0.6, echelle: [0.8, 1.4], ombre: true },
  cactus:     { geo: mkCactus(),    slopeMax: 0.5,  hMin: WATER_LEVEL + 0.6, echelle: [0.7, 1.3], ombre: true },
  rocher:     { geo: mkRocher(),    slopeMax: 2.0,  hMin: -999,              echelle: [0.5, 1.9], ombre: true },
  buisson:    { geo: mkBuisson(),   slopeMax: 0.6,  hMin: WATER_LEVEL + 0.4, echelle: [0.7, 1.3], ombre: false },
  arbremort:  { geo: mkArbreMort(), slopeMax: 0.45, hMin: WATER_LEVEL - 0.3, echelle: [0.8, 1.4], ombre: true },
  roseau:     { geo: mkRoseau(),    slopeMax: 0.3,  hMin: WATER_LEVEL - 0.4, hMax: WATER_LEVEL + 1.6, echelle: [0.8, 1.4], ombre: false },
  champignon: { geo: mkChampignon(),slopeMax: 0.5,  hMin: WATER_LEVEL + 0.3, echelle: [0.8, 1.6], ombre: false },
  osdesert:   { geo: mkOsDesert(),  slopeMax: 0.4,  hMin: WATER_LEVEL + 0.5, echelle: [0.8, 1.4], ombre: false },
};

const CELL = 4; // 1 candidat max par cellule de 4 m → pas de chevauchement
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/**
 * Place les props d'un chunk. Retourne une liste d'InstancedMesh.
 * gen : WorldGen ; heightAt(x,z) : échantillonneur ; blocked(x,z) : zones POI.
 */
export function placeProps(gen, chunkX, chunkZ, size, heightAt, blocked) {
  const placements = new Map(); // type → [{x,y,z,rot,scale,tilt}]
  const c0x = Math.floor((chunkX * size) / CELL);
  const c0z = Math.floor((chunkZ * size) / CELL);
  const n = Math.floor(size / CELL);

  for (let cz = 0; cz < n; cz++) {
    for (let cx = 0; cx < n; cx++) {
      const cellX = c0x + cx, cellZ = c0z + cz;
      const r1 = hash2(cellX, cellZ, gen.seed);
      const r2 = hash2(cellX, cellZ, gen.seed + 7);
      const r3 = hash2(cellX, cellZ, gen.seed + 13);
      const r4 = hash2(cellX, cellZ, gen.seed + 29);

      const wx = (cellX + 0.5) * CELL + (r2 - 0.5) * (CELL - 1.2);
      const wz = (cellZ + 0.5) * CELL + (r3 - 0.5) * (CELL - 1.2);

      // densités mélangées par les poids de biomes → transitions douces
      const w = gen.weights(wx, wz);
      let cumul = 0, pick = null;
      for (const [type, def] of Object.entries(PROP_TYPES)) {
        let d = 0;
        for (let i = 0; i < BIOMES.length; i++) d += (BIOMES[i].props[type] || 0) * w[i];
        cumul += d;
        if (pick === null && r1 < cumul) pick = { type, def };
      }
      if (!pick) continue;

      const h = heightAt(wx, wz);
      const { def } = pick;
      if (h < def.hMin || (def.hMax !== undefined && h > def.hMax)) continue;
      // pente par différences finies
      const slope = Math.hypot(heightAt(wx + 1.2, wz) - heightAt(wx - 1.2, wz), heightAt(wx, wz + 1.2) - heightAt(wx, wz - 1.2)) / 2.4;
      if (slope > def.slopeMax) continue;
      if (blocked && blocked(wx, wz)) continue;

      let list = placements.get(pick.type);
      if (!list) { list = []; placements.set(pick.type, list); }
      const [eMin, eMax] = def.echelle;
      list.push({
        x: wx, y: h - 0.05, z: wz,
        rot: r4 * Math.PI * 2,
        scale: eMin + (hash2(cellX, cellZ, gen.seed + 31)) * (eMax - eMin),
        tilt: pick.type === 'rocher' ? (r2 - 0.5) * 0.3 : (r2 - 0.5) * 0.06,
      });
    }
  }

  const meshes = [];
  for (const [type, list] of placements) {
    const def = PROP_TYPES[type];
    const im = new THREE.InstancedMesh(def.geo, MAT, list.length);
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      _p.set(it.x, it.y, it.z);
      _q.setFromEuler(_e.set(it.tilt, it.rot, 0));
      _s.setScalar(it.scale);
      _m.compose(_p, _q, _s);
      im.setMatrixAt(i, _m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = def.ombre;
    im.receiveShadow = false;
    meshes.push(im);
  }
  return meshes;
}
