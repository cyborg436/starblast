import * as THREE from 'three';
import { Entity } from './Entity.js';
import { WATER_LEVEL } from '../world/Biomes.js';

/**
 * Player — LOCOMOTION uniquement (capsule rapier + character controller) :
 * déplacement relatif caméra, sprint, saut/gravité, nage, synchronisation
 * du modèle. Tout le COMBAT (attaques, esquive, stamina, énergie, dégâts)
 * vit dans systems/combat/ — le joueur lit simplement :
 *  - combat.lock          → verrou d'action (bloque la locomotion libre)
 *  - combat.moveOverride  → vitesse/direction imposées (roulade, coups)
 *  - combat.invincible    → i-frames de l'esquive
 */

const VITESSE_MARCHE = 5.5;
const VITESSE_SPRINT = 9.5;
const VITESSE_NAGE = 3.2;
const GRAVITE = -28;
const IMPULSION_SAUT = 9.5;
const NIVEAU_NAGE = WATER_LEVEL - 0.75;
const PV_MAX = 100;

// Escalade (climbing)
const CLIMB_ANGLE_MIN = 70; // degrés : parois ≥ 70° de la verticale
const CLIMB_STAMINA_DRAIN = 30; // stamina/sec en escalade
const CLIMB_SPEED = 4; // vitesse verticale d'ascension

// Planeur (gliding)
const GLIDE_MIN_HEIGHT = 2; // hauteur minimale pour activer le planeur
const GLIDE_DRAG = 0.15; // ralentissement vertical en planeur

export class Player extends Entity {
  constructor(world, input, physics, hero) {
    super('joueur');
    this.world = world;
    this.input = input;
    this.physics = physics;
    this.cameraCtrl = null; // fourni par Game
    this.combat = null;     // fourni par Game (CombatSystem)

    // visuel : object3d (pieds) → facing (orientation) → modèle animé
    this.hero = hero;
    this.anim = hero.anim;
    this.facing = new THREE.Group();
    this.facing.add(hero.group);
    this.object3d.add(this.facing);

    // physique : capsule cinématique
    const h = world.getHeightAt(0, 0);
    const phy = physics.createPlayerBody(0, h + 1.2, 0);
    this.body = phy.body;
    this.collider = phy.collider;
    this.controller = phy.controller;
    this.capsuleOffset = phy.capsuleOffset;

    this.pv = PV_MAX;
    this.pvmax = PV_MAX;
    this.dead = false;
    this._deadT = 0;
    this.hurtT = 0;              // brève invulnérabilité après un coup reçu
    this.stamina = { val: 100, max: 100 }; // remplacé par StaminaSystem au câblage

    this.velY = 0;
    this.grounded = true;
    this.swimming = false;
    this.climbing = false;
    this.gliding = false;
    this.speed = 0;
    this.inputDir = new THREE.Vector3(); // direction d'entrée monde (lue par DodgeSystem)
    this._kb = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._targetAngle = 0;
    this._climbNormal = new THREE.Vector3(); // normale de la paroi
    this._jumpStart = 0; // position Y au saut pour déterminer hauteur

    this.anim.play('idle');
    this.position.set(0, h, 0);
  }

  get invincible() {
    return (this.combat && this.combat.invincible) || this.hurtT > 0;
  }

  applyKnockback(vx, vz) {
    this._kb.set(vx, 0, vz);
  }

  _detectWall() {
    if (this.grounded || this.swimming) return null;
    const t = this.body.translation();
    const rayDir = new THREE.Vector3(this.inputDir.x, 0, this.inputDir.z).normalize();
    const hit = this.physics.raycastTerrainNormal(
      { x: t.x, y: t.y, z: t.z },
      { x: rayDir.x, y: 0, z: rayDir.z },
      0.5 // courte portée pour tester la paroi adjacente
    );
    if (!hit) return null;
    const angle = Math.acos(Math.abs(hit.normal.y)) * (180 / Math.PI);
    return angle >= CLIMB_ANGLE_MIN ? { hit, angle } : null;
  }

  _startClimbing(wall) {
    this.climbing = true;
    this._climbNormal.set(wall.hit.normal.x, wall.hit.normal.y, wall.hit.normal.z);
    this.velY = 0;
    this.grounded = false;
  }

  _stopClimbing() {
    this.climbing = false;
  }

  _startGliding() {
    this.gliding = true;
    this.anim.play('glide');
  }

  _stopGliding() {
    this.gliding = false;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this._deadT = 0;
    this.anim.play('dead', { force: true });
  }

  _respawn() {
    this.dead = false;
    this.pv = this.pvmax;
    if (this.combat) { this.combat.stamina.val = this.combat.stamina.max; this.combat.skills.energie = 0; }
    const h = this.world.getHeightAt(0, 0);
    this.body.setNextKinematicTranslation({ x: 0, y: h + 1.2, z: 0 });
    this.velY = 0;
    this.anim.play('idle', { force: true });
  }

  update(dt, _elapsed) {
    const input = this.input;
    const t = this.body.translation();
    const yaw = this.cameraCtrl ? this.cameraCtrl.yaw : 0;
    this.hurtT = Math.max(0, this.hurtT - dt);

    if (this.dead) {
      this._deadT += dt;
      this.anim.update(dt, { speed: 0 });
      this.position.set(t.x, t.y - this.capsuleOffset, t.z);
      if (this._deadT > 2.6) this._respawn();
      return;
    }

    /* --- direction d'entrée (relatif caméra) --- */
    const { x: ax, z: az } = input.moveAxes();
    const s = Math.sin(yaw), c = Math.cos(yaw);
    this.inputDir.set(s * az + c * ax, 0, c * az - s * ax);
    const bouge = this.inputDir.lengthSq() > 0.001;
    if (bouge) this.inputDir.normalize();

    /* --- nage ? --- */
    const fond = this.world.getHeightAt(t.x, t.z);
    this.swimming = fond < NIVEAU_NAGE - 0.2;

    /* --- vitesse horizontale : action en cours > locomotion libre --- */
    const ov = this.combat ? this.combat.moveOverride : null;
    let cible = 0;
    let dirX = this.inputDir.x, dirZ = this.inputDir.z;
    if (ov) {
      cible = ov.vitesse;
      if (ov.dir) { dirX = ov.dir.x; dirZ = ov.dir.z; this._targetAngle = Math.atan2(dirX, dirZ); }
      else if (ov.avant) {
        this._targetAngle = this.combat.attackFacing();
        dirX = Math.sin(this._targetAngle); dirZ = Math.cos(this._targetAngle);
      } else if (ov.libre && bouge) {
        this._targetAngle = Math.atan2(dirX, dirZ); // charge : marche lente libre
      } else if (!bouge) { dirX = 0; dirZ = 0; }
    } else if (bouge) {
      const veutSprinter = input.isActionDown('sprint') && this.grounded && !this.swimming
        && this.combat && this.combat.stamina.val > 0;
      if (veutSprinter) this.combat.stamina.drain(dt);
      cible = this.swimming ? VITESSE_NAGE : veutSprinter ? VITESSE_SPRINT : VITESSE_MARCHE;
      this._targetAngle = Math.atan2(dirX, dirZ);
    }
    this.speed += (cible - this.speed) * Math.min(dt * 10, 1);

    /* --- rotation douce du modèle --- */
    let dA = this._targetAngle - this.facing.rotation.y;
    dA = ((dA + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.facing.rotation.y += dA * Math.min(dt * 12, 1);

    /* --- vertical --- */
    let dy;
    if (this.swimming) {
      this.velY = 0;
      this.grounded = false;
      dy = (NIVEAU_NAGE + this.capsuleOffset - t.y) * Math.min(dt * 6, 1);
    } else {
      const lock = this.combat ? this.combat.lock : null;
      if (this.grounded && !lock && input.wasActionPressed('jump')) {
        this.velY = IMPULSION_SAUT;
        this.grounded = false;
        this.anim.play('jump');
        this._jumpStart = t.y;
      }

      /* --- escalade --- */
      if (this.climbing) {
        const upInput = bouge && this.inputDir.z > 0.3; // input forward = climb
        if (upInput) {
          this.velY = CLIMB_SPEED;
          if (this.combat) this.combat.stamina.drain(dt * CLIMB_STAMINA_DRAIN);
        } else {
          this.velY = -CLIMB_SPEED * 0.4; // descendre lentement si pas d'input
        }
        const wall = this._detectWall();
        if (!wall) this._stopClimbing();
      } else {
        /* --- planeur --- */
        const heightGain = Math.max(0, this._jumpStart - t.y);
        if (!this.grounded && !this.gliding && heightGain > GLIDE_MIN_HEIGHT &&
            input.isActionDown('jump') && this.velY < 0) {
          this._startGliding();
        }
        if (this.gliding) {
          this.velY = Math.max(this.velY + GRAVITE * dt, -CLIMB_SPEED * 0.5);
          if (this.grounded) this._stopGliding();
        } else {
          this.velY += GRAVITE * dt;
        }
      }

      if (this.grounded && !this.climbing && this.velY < -2) this.velY = -2;
      dy = this.velY * dt;

      /* --- tentative d'escalade (si pas déjà en escalade) --- */
      if (!this.climbing && !this.grounded && this.inputDir.lengthSq() > 0.001) {
        const wall = this._detectWall();
        if (wall) this._startClimbing(wall);
      }
    }

    /* --- résolution physique --- */
    this._desired.set(dirX * this.speed * dt + this._kb.x * dt, dy, dirZ * this.speed * dt + this._kb.z * dt);
    this._kb.multiplyScalar(Math.max(1 - dt * 6, 0));
    this.controller.computeColliderMovement(this.collider, this._desired);
    const move = this.controller.computedMovement();
    this.body.setNextKinematicTranslation({ x: t.x + move.x, y: t.y + move.y, z: t.z + move.z });

    if (!this.swimming) {
      const wasGrounded = this.grounded;
      this.grounded = this.controller.computedGrounded();
      if (this.grounded && !wasGrounded) this.velY = 0;
      if (move.y < dy - 0.001 && this.velY > 0) this.velY = 0;
    }

    /* --- synchronisation visuelle --- */
    this.position.set(t.x + move.x, t.y + move.y - this.capsuleOffset, t.z + move.z);

    /* --- animation de locomotion (le combat joue les siennes) --- */
    if (!(this.combat && this.combat.lock)) {
      let etat;
      if (this.swimming) etat = 'swim';
      else if (this.climbing) etat = 'climb';
      else if (this.gliding) etat = 'glide';
      else if (!this.grounded) etat = this.velY > 1 ? 'jump' : 'fall';
      else if (this.speed > 0.3) etat = cible >= VITESSE_SPRINT - 0.5 ? 'run' : 'walk';
      else etat = 'idle';
      this.anim.play(etat);
    }
    this.anim.update(dt, { speed: this.speed });
  }
}
