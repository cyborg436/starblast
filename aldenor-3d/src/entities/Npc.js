import * as THREE from 'three';
import { Entity } from './Entity.js';

/**
 * Npc — personnage non joueur.
 * Modèle low-poly humanoïde (même montage que le héros procédural,
 * palette par rôle issue de data/npcs.json). Deux "animations" simples :
 * idle (respiration + léger balancement) et talk (se tourne vers le
 * joueur, hoche la tête). Peut aussi ESCORTER le joueur (suit + s'arrête
 * à destination). Marqueur de quête billboard (!/?) au-dessus de la tête.
 *
 * Le pipeline Mixamo de la Phase 3 s'applique tel quel : si un
 * public/models/npc_<role>.glb existe un jour, NpcManager le passera à
 * la place du modèle procédural — l'interface (idle/talk) est identique.
 */
function flat(c) { return new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }); }

export class Npc extends Entity {
  constructor({ role, nom, apparence, x, z, world }) {
    super('pnj_' + role);
    this.role = role;
    this.nom = nom;
    this.world = world;
    this.talking = false;
    this.escorting = false;
    this._t = Math.random() * 10;

    this.facing = new THREE.Group();
    this.object3d.add(this.facing);
    this._build(apparence || {});

    const h = world.getHeightAt(x, z);
    this.position.set(x, h, z);
    this.home = new THREE.Vector3(x, h, z);
    this.baseAngle = Math.random() * Math.PI * 2;
    this.facing.rotation.y = this.baseAngle;
  }

  _build(ap) {
    const peau = ap.peau || '#e8b088', cheveux = ap.cheveux || '#3a2a1a';
    const haut = ap.haut || '#6a5a7a', bas = ap.bas || '#4a4058';
    const m = new THREE.Group();
    this.model = m;
    this.facing.add(m);

    // jambes (pivots pour le balancement de marche en escorte)
    this.legL = new THREE.Group(); this.legL.position.set(-0.12, 0.8, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.12, 0.8, 0);
    for (const leg of [this.legL, this.legR]) {
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.72, 5), flat(bas));
      j.position.y = -0.36;
      leg.add(j); m.add(leg);
    }
    // torse (robe si le rôle en a une)
    if (ap.robe) {
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 1.1, 7), flat(haut));
      robe.position.y = 0.95; m.add(robe);
    } else {
      const torse = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 6), flat(haut));
      torse.position.y = 1.15; m.add(torse);
    }
    // bras
    this.armL = new THREE.Group(); this.armL.position.set(-0.28, 1.42, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.28, 1.42, 0);
    for (const arm of [this.armL, this.armR]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.55, 5), flat(haut));
      b.position.y = -0.26;
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), flat(peau));
      main.position.y = -0.55;
      arm.add(b, main); m.add(arm);
    }
    // tête
    this.head = new THREE.Group(); this.head.position.y = 1.72;
    const crane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), flat(peau));
    const chev = new THREE.Mesh(new THREE.SphereGeometry(0.21, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), flat(cheveux));
    chev.position.y = 0.04;
    this.head.add(crane, chev);
    // coiffe (casque du garde, chapeau…)
    if (ap.coiffe === 'casque') {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), flat('#9aa0aa'));
      c.position.y = 0.05; this.head.add(c);
    } else if (ap.coiffe === 'chapeau') {
      const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 8), flat('#3a5a2a'));
      bord.position.y = 0.12;
      const haut2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 7), flat('#3a5a2a'));
      haut2.position.y = 0.26; this.head.add(bord, haut2);
    } else if (ap.coiffe === 'capuche') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 7, 6, 0, Math.PI * 2, 0, Math.PI * 0.7), flat(haut));
      cap.position.y = 0.02; this.head.add(cap);
    }
    m.add(this.head);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // marqueur de quête billboard (sprite ! / ?) — canvas texture
    this._buildMarker();
  }

  _buildMarker() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    this._markCtx = cv.getContext('2d');
    this._markTex = new THREE.CanvasTexture(cv);
    this._markTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: this._markTex, transparent: true, depthTest: false });
    this.marker = new THREE.Sprite(mat);
    this.marker.scale.set(0.7, 0.7, 0.7);
    this.marker.position.y = 2.5;
    this.marker.visible = false;
    this.marker.renderOrder = 10;
    this.object3d.add(this.marker);
    this._markSym = null;
  }

  /** Affiche/masque le marqueur ('!' jaune à rendre, '?' argent dispo, null). */
  setMarker(sym) {
    if (sym === this._markSym) return;
    this._markSym = sym;
    this.marker.visible = !!sym;
    if (!sym) return;
    const ctx = this._markCtx;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a140a';
    ctx.fillStyle = sym === '!' ? '#ffd24a' : '#cfe0ea';
    ctx.strokeText(sym, 32, 34);
    ctx.fillText(sym, 32, 34);
    this._markTex.needsUpdate = true;
  }

  update(dt, elapsed, player) {
    this._t += dt;
    const dToPlayer = player ? this.position.distanceTo(player.position) : 999;

    // marqueur : rebond + face caméra (Sprite l'est déjà)
    if (this.marker.visible) this.marker.position.y = 2.5 + Math.sin(elapsed * 3) * 0.08;

    if (this.escorting && player) {
      this._doEscort(dt, player);
    } else if (this.talking || dToPlayer < 3.2) {
      // se tourne vers le joueur, hoche la tête (talk idle)
      const a = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
      this._turnTo(a, dt);
      this.head.rotation.x = Math.sin(this._t * (this.talking ? 4 : 1.5)) * (this.talking ? 0.12 : 0.04);
      this._resetLimbs(dt);
    } else {
      // idle : léger balancement, retour à l'angle de repos
      this._turnTo(this.baseAngle, dt * 0.4);
      this.head.rotation.x = Math.sin(this._t * 1.2) * 0.03;
      this.model.position.y = Math.sin(this._t * 1.6) * 0.02;
      this._resetLimbs(dt);
    }
  }

  _doEscort(dt, player) {
    // suit le joueur à ~2,5 m, s'arrête s'il est proche
    const d = this.position.distanceTo(player.position);
    if (d > 2.5) {
      const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z;
      const len = Math.hypot(dx, dz);
      const spd = Math.min(4.5, d) ;
      const nx = this.position.x + (dx / len) * spd * dt;
      const nz = this.position.z + (dz / len) * spd * dt;
      const h = this.world.getHeightAt(nx, nz);
      if (h > -0.4) this.position.set(nx, h, nz);
      this._turnTo(Math.atan2(dx, dz), dt * 3);
      // balancement de marche
      const sw = Math.sin(this._t * 9) * 0.6;
      this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
      this.armL.rotation.x = -sw * 0.7; this.armR.rotation.x = sw * 0.7;
    } else {
      this._resetLimbs(dt);
    }
  }

  _turnTo(angle, k) {
    let d = angle - this.facing.rotation.y;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.facing.rotation.y += d * Math.min(k * 8, 1);
  }
  _resetLimbs(dt) {
    const k = Math.min(dt * 8, 1);
    for (const l of [this.legL, this.legR, this.armL, this.armR]) l.rotation.x += (0 - l.rotation.x) * k;
    this.model.position.y += (0 - this.model.position.y) * k;
  }
}
