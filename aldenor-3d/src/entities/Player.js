import * as THREE from 'three';
import { Entity } from './Entity.js';
import { WATER_LEVEL } from '../world/Biomes.js';

/**
 * Player — le héros : modèle low-poly stylisé 100 % procédural,
 * déplacement relatif à la caméra (ZQSD/WASD), sprint, saut avec
 * gravité, nage dans les lacs, animation de marche procédurale.
 * Collé au terrain via world.getHeightAt (aucune physique lourde).
 */

const VITESSE_MARCHE = 5.5;
const VITESSE_SPRINT = 9.5;
const VITESSE_NAGE = 3.2;
const GRAVITE = -28;
const IMPULSION_SAUT = 9.5;
const NIVEAU_NAGE = WATER_LEVEL - 0.75; // le corps flotte sous la surface

function flat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

export class Player extends Entity {
  constructor(world, input) {
    super('joueur');
    this.world = world;
    this.input = input;
    this.cameraCtrl = null; // fourni par Game (le déplacement suit le yaw caméra)

    this.velY = 0;
    this.grounded = true;
    this.swimming = false;
    this.speed = 0;          // vitesse horizontale courante (pour l'animation)
    this._dir = new THREE.Vector3();
    this._targetAngle = 0;
    this._animT = 0;

    this._buildModel();

    const h = world.getHeightAt(0, 0);
    this.position.set(0, h, 0);
  }

  /* ---------- modèle : héros low-poly articulé ---------- */
  _buildModel() {
    const PEAU = '#f2c18e', TUNIQUE = '#3a7bd8', PANTALON = '#5a4632',
      CHEVEUX = '#8a5a2a', CUIR = '#7a5230', METAL = '#c8d2dc';

    this.model = new THREE.Group();
    this.object3d.add(this.model);

    // jambes (pivot à la hanche)
    this.legL = new THREE.Group(); this.legL.position.set(-0.13, 0.85, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.13, 0.85, 0);
    for (const leg of [this.legL, this.legR]) {
      const cuisse = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), flat(PANTALON));
      cuisse.position.y = -0.38;
      const botte = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), flat(CUIR));
      botte.position.set(0, -0.78, 0.05);
      leg.add(cuisse, botte);
      this.model.add(leg);
    }

    // torse + ceinture
    const torse = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.72, 7), flat(TUNIQUE));
    torse.position.y = 1.24;
    const ceinture = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.255, 0.1, 7), flat(CUIR));
    ceinture.position.y = 0.95;
    this.model.add(torse, ceinture);

    // bras (pivot à l'épaule)
    this.armL = new THREE.Group(); this.armL.position.set(-0.3, 1.52, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.3, 1.52, 0);
    for (const arm of [this.armL, this.armR]) {
      const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.6, 6), flat(TUNIQUE));
      manche.position.y = -0.28;
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), flat(PEAU));
      main.position.y = -0.6;
      arm.add(manche, main);
      this.model.add(arm);
    }

    // tête + cheveux
    this.head = new THREE.Group(); this.head.position.y = 1.78;
    const crane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), flat(PEAU));
    crane.position.y = 0.1;
    const cheveux = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), flat(CHEVEUX));
    cheveux.position.y = 0.14;
    cheveux.scale.set(1.05, 1, 1.05);
    this.head.add(crane, cheveux);
    this.model.add(this.head);

    // épée dans le dos (décorative pour l'instant — le combat viendra)
    const epee = new THREE.Group();
    const lame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.012), flat(METAL));
    lame.position.y = 0.45;
    const garde = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), flat(CUIR));
    const poignee = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), flat(CUIR));
    poignee.position.y = -0.1;
    epee.add(lame, garde, poignee);
    epee.position.set(0, 1.35, -0.28);
    epee.rotation.z = 0.45;
    this.model.add(epee);

    this.object3d.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  /* ---------- boucle ---------- */
  update(dt, _elapsed) {
    const input = this.input, pos = this.position;
    const yaw = this.cameraCtrl ? this.cameraCtrl.yaw : 0;

    // axe d'entrée → direction monde relative à la caméra
    // (avant du joueur = opposé de la caméra ; droite = cross(vue, up))
    const { x: ax, z: az } = input.moveAxes();
    const s = Math.sin(yaw), c = Math.cos(yaw);
    this._dir.set(s * az + c * ax, 0, c * az - s * ax);
    const bouge = this._dir.lengthSq() > 0.001;

    const groundH = this.world.getHeightAt(pos.x, pos.z);
    this.swimming = groundH < NIVEAU_NAGE - 0.2;

    // vitesse cible
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const cible = bouge ? (this.swimming ? VITESSE_NAGE : sprint ? VITESSE_SPRINT : VITESSE_MARCHE) : 0;
    this.speed += (cible - this.speed) * Math.min(dt * 10, 1);

    if (bouge) {
      this._dir.normalize();
      pos.x += this._dir.x * this.speed * dt;
      pos.z += this._dir.z * this.speed * dt;
      // le modèle se tourne vers la direction de déplacement
      this._targetAngle = Math.atan2(this._dir.x, this._dir.z);
    }
    // rotation douce (chemin le plus court)
    let dA = this._targetAngle - this.model.rotation.y;
    dA = ((dA + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.model.rotation.y += dA * Math.min(dt * 12, 1);

    // pentes trop raides : on glisse vers le bas (pas d'escalade verticale)
    const newGroundH = this.world.getHeightAt(pos.x, pos.z);

    if (this.swimming) {
      // nage : flotte au niveau de l'eau, pas de gravité ni de saut
      this.velY = 0;
      this.grounded = false;
      pos.y += (NIVEAU_NAGE - pos.y) * Math.min(dt * 6, 1);
    } else {
      // gravité + saut
      if (this.grounded && input.wasPressed('Space')) {
        this.velY = IMPULSION_SAUT;
        this.grounded = false;
      }
      this.velY += GRAVITE * dt;
      pos.y += this.velY * dt;
      if (pos.y <= newGroundH) {
        pos.y = newGroundH;
        this.velY = 0;
        this.grounded = true;
      }
    }

    this._animate(dt, bouge);
  }

  /* ---------- animation procédurale ---------- */
  _animate(dt, bouge) {
    const k = this.speed / VITESSE_MARCHE;
    this._animT += dt * (4 + this.speed * 1.4);
    const t = this._animT;

    if (this.swimming) {
      // brasse stylisée
      const s = Math.sin(t * 0.8);
      this.model.rotation.x = 0.9;
      this.armL.rotation.x = -1.2 + s * 0.8;
      this.armR.rotation.x = -1.2 - s * 0.8;
      this.legL.rotation.x = s * 0.5;
      this.legR.rotation.x = -s * 0.5;
      this.position.y += Math.sin(t * 0.5) * 0.01;
      return;
    }
    this.model.rotation.x = 0;

    if (!this.grounded) {
      // saut : bras levés, jambes fléchies
      this.armL.rotation.x = -2.4;
      this.armR.rotation.x = -2.4;
      this.legL.rotation.x = 0.5;
      this.legR.rotation.x = -0.3;
      return;
    }
    if (bouge && k > 0.05) {
      const swing = Math.sin(t) * Math.min(k, 1.4) * 0.8;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = swing * 0.8;
      this.model.position.y = Math.abs(Math.sin(t)) * 0.06 * k;
    } else {
      // idle : respiration
      const b = Math.sin(t * 0.4) * 0.03;
      this.legL.rotation.x += (0 - this.legL.rotation.x) * Math.min(dt * 8, 1);
      this.legR.rotation.x += (0 - this.legR.rotation.x) * Math.min(dt * 8, 1);
      this.armL.rotation.x += (b - this.armL.rotation.x) * Math.min(dt * 8, 1);
      this.armR.rotation.x += (b - this.armR.rotation.x) * Math.min(dt * 8, 1);
      this.model.position.y *= 0.9;
    }
  }
}
