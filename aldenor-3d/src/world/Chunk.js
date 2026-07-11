import * as THREE from 'three';
import { placeProps } from './Props.js';
import { makeWaterTile } from './Water.js';

/**
 * Chunk — une dalle de terrain de CHUNK_SIZE × CHUNK_SIZE mètres :
 * mesh de terrain déplacé par la heightmap (couleurs par vertex),
 * props instanciés, plan d'eau éventuel.
 *
 * Les normales sont calculées par différences finies sur la FONCTION de
 * hauteur (pas sur le mesh) : elles sont identiques des deux côtés d'une
 * frontière de chunk → aucune couture visible.
 */

export const CHUNK_SIZE = 100;
export const CHUNK_SEGS = 50; // 1 vertex / 2 m

const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1.0,
  metalness: 0,
});

export class Chunk {
  constructor(gen, cx, cz, poiManager, physics = null) {
    this.cx = cx;
    this.cz = cz;
    this.physics = physics;
    this.group = new THREE.Group();
    this.group.name = `chunk_${cx}_${cz}`;

    const size = CHUNK_SIZE, segs = CHUNK_SEGS;
    const n = segs + 1;
    const x0 = cx * size, z0 = cz * size;

    // --- grille de hauteurs avec bordure d'1 anneau (pour les normales) ---
    const gh = new Float32Array((n + 2) * (n + 2));
    const step = size / segs;
    let minH = Infinity;
    for (let j = -1; j <= n; j++) {
      for (let i = -1; i <= n; i++) {
        const h = gen.height(x0 + i * step, z0 + j * step);
        gh[(j + 1) * (n + 2) + (i + 1)] = h;
        if (h < minH) minH = h;
      }
    }
    const H = (i, j) => gh[(j + 1) * (n + 2) + (i + 1)];

    // --- géométrie ---
    const positions = new Float32Array(n * n * 3);
    const normals = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const idx = [];

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const wx = x0 + i * step, wz = z0 + j * step;
        const h = H(i, j);
        positions[k * 3] = wx;
        positions[k * 3 + 1] = h;
        positions[k * 3 + 2] = wz;

        // normale et pente par différences centrées sur la grille étendue
        const dhdx = (H(i + 1, j) - H(i - 1, j)) / (2 * step);
        const dhdz = (H(i, j + 1) - H(i, j - 1)) / (2 * step);
        const inv = 1 / Math.hypot(dhdx, 1, dhdz);
        normals[k * 3] = -dhdx * inv;
        normals[k * 3 + 1] = inv;
        normals[k * 3 + 2] = -dhdz * inv;

        const w = gen.weights(wx, wz);
        const col = gen.colorAt(wx, wz, h, w, Math.hypot(dhdx, dhdz));
        colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(idx);

    this.terrain = new THREE.Mesh(geo, terrainMaterial);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = false;
    this.group.add(this.terrain);

    // collider physique : le MÊME maillage que le rendu (fidélité exacte)
    this.terrainCollider = physics ? physics.addTerrainMesh(positions, new Uint32Array(idx)) : null;

    // --- eau ---
    this.water = makeWaterTile(cx, cz, size, minH);
    if (this.water) this.group.add(this.water);

    // --- props instanciés ---
    const blocked = poiManager ? (x, z) => poiManager.blocked(x, z) : null;
    this.props = placeProps(gen, cx, cz, size, (x, z) => gen.height(x, z), blocked);
    for (const im of this.props) this.group.add(im);
  }

  addTo(scene) {
    scene.add(this.group);
  }

  dispose(scene) {
    scene.remove(this.group);
    if (this.physics) this.physics.removeCollider(this.terrainCollider);
    this.terrain.geometry.dispose();
    if (this.water) this.water.geometry.dispose();
    for (const im of this.props) im.dispose(); // géométries de props partagées : non disposées
  }
}
