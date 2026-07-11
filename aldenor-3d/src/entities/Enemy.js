import * as THREE from 'three';
import { Entity } from './Entity.js';
import { DATA } from '../data/index.js';
import { initPoise } from '../systems/combat/StaggerSystem.js';

/**
 * Enemy — un mob du bestiaire 2D (src/data/mobs.json) incarné en 3D.
 * Stats (pv, dégâts, vitesse, aggro) et mise à l'échelle par niveau
 * viennent directement des données extraites — rien de codé en dur ici.
 *
 * Modèles low-poly par ARCHÉTYPE (placeholder avant de vrais .glb) :
 *  blob (slimes), bete (loups, araignées…), humanoide (gobelins,
 *  bandits…), brute (golems, yétis). Teinte par mob.
 */

const ARCHETYPES = {
  slime: 'blob', slimetox: 'blob',
  loup: 'bete', loupblanc: 'bete', serpent: 'bete', scorpion: 'bete',
  araignee: 'bete', chauvesouris: 'bete',
  gobelin: 'humanoide', orc: 'humanoide', bandit: 'humanoide',
  squelette: 'humanoide', zombi: 'humanoide', momie: 'humanoide', fantome: 'humanoide',
  golem: 'brute', golemglace: 'brute', yeti: 'brute',
};
const TEINTES = {
  slime: '#5ec24a', slimetox: '#a04ac2', loup: '#7a6a55', loupblanc: '#e8edf2',
  serpent: '#4a9a3a', scorpion: '#c28a3a', araignee: '#3a3230', chauvesouris: '#5a4a6a',
  gobelin: '#6aa040', orc: '#4a7838', bandit: '#8a6a4a', squelette: '#e0dcd0',
  zombi: '#8aa878', momie: '#d8cca8', fantome: '#c8d8ea',
  golem: '#8a8276', golemglace: '#a8cce8', yeti: '#e8ecf4',
};

function flat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

export class Enemy extends Entity {
  constructor(id, lvl, x, z, world) {
    super('ennemi_' + id);
    this.id = id;
    this.world = world;
    this.def = DATA.mobs.mobs.find(m => m.id === id) || DATA.mobs.mobs[0];
    this.lvl = Math.max(1, lvl);

    // formules de mobs.json → reglesNiveau
    const k = this.lvl - 1;
    this.pvmax = Math.round(this.def.pv * (1 + 0.45 * k));
    this.pv = this.pvmax;
    this.degats = Math.round(this.def.degats * (1 + 0.30 * k));
    this.vitesse = (this.def.vitesse / 32) * 3.2 * (1 + 0.02 * k); // px/s 2D → m/s (échelle jouable)
    this.aggroDist = this.def.aggro * 3.0;  // "tuiles" 2D → mètres
    this.xp = Math.round(this.def.xp * (1 + 0.5 * k));

    const taille = this.def.taille || 1;
    this.hauteur = 1.4 * taille;
    this.rayon = 0.55 * taille;
    this.porteeAttaque = 1.8 + this.rayon;

    // combat
    this.element = null;      // { type, ttl } — réactions élémentaires
    this.dead = false;
    this.mortT = 0;           // fondu après la mort
    this.kbVel = new THREE.Vector3();
    initPoise(this);

    // IA (machine à états dans EnemyAI.js)
    this.state = 'patrol';
    this.home = new THREE.Vector3(x, 0, z);
    this.errT = 0;
    this.errDir = new THREE.Vector3();
    this.atkCd = 0;
    this.windupT = 0;         // télégraphe avant frappe
    this.hitFlash = 0;

    this._buildModel(taille);
    const h = world.getHeightAt(x, z);
    this.position.set(x, h, z);
  }

  _buildModel(taille) {
    const teinte = TEINTES[this.id] || '#a05a5a';
    const arche = ARCHETYPES[this.id] || 'humanoide';
    const g = new THREE.Group();
    this.model = g;
    this.object3d.add(g);
    this.mats = [];
    const mat = (c) => { const m = flat(c); this.mats.push(m); return m; };

    if (arche === 'blob') {
      const corps = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), mat(teinte));
      corps.scale.set(1.25, 0.9, 1.25);
      corps.position.y = 0.55;
      const oeilG = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat('#181414'));
      const oeilD = oeilG.clone();
      oeilG.position.set(-0.2, 0.72, 0.52); oeilD.position.set(0.2, 0.72, 0.52);
      g.add(corps, oeilG, oeilD);
      this.hauteur = 1.0 * taille;
    } else if (arche === 'bete') {
      const corps = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.15), mat(teinte));
      corps.position.y = 0.62;
      const tete = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.45), mat(teinte));
      tete.position.set(0, 0.85, 0.72);
      const museau = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.22), mat('#3a322a'));
      museau.position.set(0, 0.78, 0.98);
      g.add(corps, tete, museau);
      for (const [px, pz] of [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]]) {
        const patte = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.5, 5), mat('#4a3f33'));
        patte.position.set(px, 0.25, pz);
        g.add(patte);
      }
    } else if (arche === 'brute') {
      const corps = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.7), mat(teinte));
      corps.position.y = 1.15;
      const tete = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), mat(teinte));
      tete.position.y = 1.95;
      g.add(corps, tete);
      for (const s of [-1, 1]) {
        const bras = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), mat('#6a625a'));
        bras.position.set(s * 0.7, 1.1, 0);
        const jambe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.65, 0.34), mat('#5a544c'));
        jambe.position.set(s * 0.26, 0.33, 0);
        g.add(bras, jambe);
      }
      this.hauteur = 2.2 * taille;
    } else { // humanoide
      const torse = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 6), mat(teinte));
      torse.position.y = 0.95;
      const tete = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), mat(TEINTES[this.id] || '#d8a078'));
      tete.position.y = 1.45;
      g.add(torse, tete);
      for (const s of [-1, 1]) {
        const bras = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5, 5), mat('#4a4038'));
        bras.position.set(s * 0.27, 0.95, 0);
        const jambe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.62, 5), mat('#3a342c'));
        jambe.position.set(s * 0.11, 0.34, 0);
        g.add(bras, jambe);
      }
    }
    g.scale.setScalar(taille);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // anneau d'élément appliqué (visible quand un élément marque le mob)
    this.ringEl = new THREE.Mesh(
      new THREE.TorusGeometry(this.rayon + 0.25, 0.05, 6, 18),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }),
    );
    this.ringEl.rotation.x = -Math.PI / 2;
    this.ringEl.position.y = 0.12;
    this.ringEl.visible = false;
    this.object3d.add(this.ringEl);
  }

  /** Feedback visuel : flash blanc au coup, teinte de télégraphe/stagger. */
  updateVisuals(dt, elapsed) {
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    const windup = this.windupT > 0 ? Math.min(this.windupT * 2.2, 1) : 0;
    for (const m of this.mats) {
      m.emissive ??= new THREE.Color();
      m.emissive.setRGB(
        this.hitFlash + windup * 0.55,
        this.hitFlash * 0.9 + windup * 0.08,
        this.hitFlash * 0.8,
      );
    }
    // stagger : titubement
    if (this.staggerT > 0) {
      this.model.rotation.z = Math.sin(elapsed * 22) * 0.16;
      this.model.rotation.x = 0.12;
    } else {
      this.model.rotation.z *= 0.85;
      this.model.rotation.x *= 0.85;
    }
    // idle/marche : petit rebond
    const bounce = this.state === 'attack' || this.state === 'aggro' ? 7 : 3.5;
    this.model.position.y = Math.abs(Math.sin(elapsed * bounce + this.home.x)) * 0.06;
    // anneau d'élément
    if (this.element) {
      this.ringEl.visible = true;
      this.ringEl.material.opacity = 0.4 + Math.sin(elapsed * 6) * 0.25;
    } else this.ringEl.visible = false;
    // mort : bascule + fondu
    if (this.dead) {
      this.mortT += dt;
      this.model.rotation.x = -Math.min(this.mortT * 3, Math.PI / 2);
      const fade = Math.max(0, 1 - Math.max(this.mortT - 1.2, 0) / 0.8);
      for (const m of this.mats) { m.transparent = true; m.opacity = fade; }
    }
  }
}
