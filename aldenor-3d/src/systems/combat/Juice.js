import * as THREE from 'three';
import { ELEMENT_INFO } from './elementalReactions.js';

/**
 * Juice — tout le feedback qui fait "vibrer" le combat :
 *
 *  - HIT-STOP : ralenti global (timeScale 0.07) pendant 60-130 ms au
 *    moment de l'impact (Game.hitStop) — pas d'arrêt total
 *  - SCREEN SHAKE : amplitude décroissante appliquée par la caméra
 *  - DAMAGE NUMBERS : divs DOM projetés au-dessus des cibles, animés en
 *    CSS (montée + fondu) ; gros et colorés pour crits/réactions
 *  - PARTICULES : un unique THREE.Points de 512 particules recyclées —
 *    étincelles d'impact, teintes par élément, vapeur, novas
 *
 * Valeurs de départ :
 *  - hit-stop léger 70 ms, lourd 110 ms, ultime 130 ms
 *  - shake léger 0.15, lourd 0.5, ultime 0.9
 */

const MAX_PARTICULES = 512;

export class Juice {
  constructor(game, scene, camera) {
    this.game = game;
    this.scene = scene;
    this.camera = camera;
    this.dmgRoot = document.getElementById('dmg-root');
    this.annonceEl = document.getElementById('annonce');
    this._annonceT = null;

    // pool de particules (positions + couleurs dynamiques)
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    this._pos = new Float32Array(MAX_PARTICULES * 3);
    this._col = new Float32Array(MAX_PARTICULES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this._pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this._col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
    this._v = new THREE.Vector3();
  }

  /* ---------- temps & caméra ---------- */
  hitStop(ms = 70) { this.game.hitStop(ms); }
  shake(amp = 0.15) { this.game.cameraCtrl?.addShake(amp); }
  swing(_amp = 0.2) { /* hook woosh sonore futur */ }

  /* ---------- impacts ---------- */
  /** Feedback complet d'un coup qui touche. */
  impact(pos, { element = null, lourd = false, reaction = null, kill = false } = {}) {
    this.hitStop(reaction ? 120 : lourd ? 110 : 70);
    this.shake(reaction ? 0.6 : lourd ? 0.5 : 0.15);
    const teinte = reaction?.couleur || (element ? ELEMENT_INFO[element].particule : '#ffe9b0');
    this.burst(pos, teinte, lourd || reaction ? 26 : 14, { vitesse: lourd ? 7 : 5 });
    if (kill) this.burst(pos, '#ffffff', 20, { vitesse: 8, montee: 3 });
    if (reaction?.nom === 'Vaporisation') this.burst(pos, '#f0f6ff', 30, { vitesse: 1.5, montee: 2.5, vie: 1.2 }); // vapeur
    if (reaction?.nom === 'Surcharge') this.burst(pos, '#d8a8ff', 40, { vitesse: 9 });
    if (reaction?.nom === 'Diffusion') this.burst(pos, '#a8f0d0', 28, { vitesse: 6, montee: 1.5 });
  }

  skillBurst(pos, element) {
    this.burst(this._v.set(pos.x, pos.y + 1.2, pos.z), ELEMENT_INFO[element].particule, 24, { vitesse: 6 });
    this.shake(0.25);
  }

  nova(pos, element) {
    // anneau expansif de l'ultime
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      this._spawn(pos.x, pos.y + 0.6, pos.z,
        Math.cos(a) * 11, 1.5, Math.sin(a) * 11,
        ELEMENT_INFO[element].particule, 0.7);
    }
  }

  eclairEntre(a, b) {
    // pointillé de foudre entre deux ennemis (chaîne d'éclairs)
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      this._spawn(
        a.position.x + (b.position.x - a.position.x) * t + (Math.random() - 0.5) * 0.5,
        a.position.y + 1 + (Math.random() - 0.5) * 0.5,
        a.position.z + (b.position.z - a.position.z) * t + (Math.random() - 0.5) * 0.5,
        0, 1, 0, '#e0b8ff', 0.35,
      );
    }
  }

  burst(pos, couleur, n, { vitesse = 5, montee = 1, vie = 0.55 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = vitesse * (0.4 + Math.random() * 0.6);
      this._spawn(pos.x, pos.y + 1.0, pos.z,
        Math.cos(a) * v, montee + Math.random() * 2.5, Math.sin(a) * v,
        couleur, vie * (0.7 + Math.random() * 0.6));
    }
  }

  _spawn(x, y, z, vx, vy, vz, couleur, vie) {
    if (this.parts.length >= MAX_PARTICULES) this.parts.shift();
    this._c.set(couleur);
    this.parts.push({ x, y, z, vx, vy, vz, vie, vieMax: vie, r: this._c.r, g: this._c.g, b: this._c.b });
  }

  /* ---------- damage numbers (DOM projeté) ---------- */
  dmgNumber(pos, texte, { couleur = '#fff', gros = false } = {}) {
    if (!this.dmgRoot) return;
    this._v.set(pos.x, pos.y + 1.6, pos.z).project(this.camera);
    if (this._v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'dmg' + (gros ? ' gros' : '');
    el.textContent = texte;
    el.style.color = couleur;
    el.style.left = `${(this._v.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-this._v.y * 0.5 + 0.5) * 100}%`;
    this.dmgRoot.appendChild(el);
    // animation CSS (montée + fondu), retiré ensuite
    requestAnimationFrame(() => el.classList.add('go'));
    setTimeout(() => el.remove(), 950);
    while (this.dmgRoot.children.length > 30) this.dmgRoot.firstChild.remove();
  }

  /** Bandeau d'annonce (changement de compétence, etc.). */
  annonce(txt) {
    if (!this.annonceEl) return;
    this.annonceEl.textContent = txt;
    this.annonceEl.classList.add('on');
    clearTimeout(this._annonceT);
    this._annonceT = setTimeout(() => this.annonceEl.classList.remove('on'), 1600);
  }

  /* ---------- tick particules ---------- */
  update(dt) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vie -= dt;
      if (p.vie <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 9 * dt; // gravité légère
      const fade = p.vie / p.vieMax;
      this._pos[n * 3] = p.x; this._pos[n * 3 + 1] = p.y; this._pos[n * 3 + 2] = p.z;
      this._col[n * 3] = p.r * fade; this._col[n * 3 + 1] = p.g * fade; this._col[n * 3 + 2] = p.b * fade;
      n++;
    }
    this.points.geometry.setDrawRange(0, n);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
