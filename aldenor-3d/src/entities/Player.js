import * as THREE from 'three';
import { Entity } from './Entity.js';
import { WATER_LEVEL } from '../world/Biomes.js';

/**
 * Player — contrôleur de personnage physique :
 *  - capsule cinématique rapier3d + KinematicCharacterController
 *    (autostep : marches, pente max 52°, snap-to-ground : aucun
 *    flottement ni clipping sur le terrain streamé)
 *  - déplacement relatif à la caméra, sprint (stamina), saut, nage
 *  - actions de combat branchées sur la state machine d'animations :
 *    combo attaque légère ×3, attaque lourde, esquive-roulade (i-frames)
 *
 * Toutes les entrées passent par la couche d'actions de l'InputManager
 * (isActionDown/wasActionPressed) — aucune touche codée en dur ici.
 */

const VITESSE_MARCHE = 5.5;
const VITESSE_SPRINT = 9.5;
const VITESSE_NAGE = 3.2;
const GRAVITE = -28;
const IMPULSION_SAUT = 9.5;
const NIVEAU_NAGE = WATER_LEVEL - 0.75;

const COUT_ESQUIVE = 20;
const COUT_SPRINT_PAR_S = 12;
const REGEN_STAMINA_PAR_S = 16;

const DUREE_ATTAQUES = { attack_light_1: 0.42, attack_light_2: 0.42, attack_light_3: 0.6, attack_heavy: 0.85 };

export class Player extends Entity {
  constructor(world, input, physics, hero) {
    super('joueur');
    this.world = world;
    this.input = input;
    this.physics = physics;
    this.cameraCtrl = null; // fourni par Game

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

    this.velY = 0;
    this.grounded = true;
    this.swimming = false;
    this.speed = 0;
    this.invincible = false;              // i-frames de l'esquive (utilisé par le combat en Phase 4)
    this.stamina = { val: 100, max: 100 };
    this._staminaDelai = 0;

    this.state = 'idle';
    this._lock = null;                    // action en cours qui verrouille le mouvement
    this._combo = 0;                      // étape du combo d'attaque légère
    this._comboFenetre = 0;               // temps restant pour enchaîner
    this._bufferAttaque = false;
    this._dodgeT = 0;
    this._dodgeDir = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._targetAngle = 0;

    this.anim.play('idle');
    this.position.set(0, h, 0);
  }

  /* ---------- boucle ---------- */
  update(dt, _elapsed) {
    const input = this.input;
    const t = this.body.translation();
    const yaw = this.cameraCtrl ? this.cameraCtrl.yaw : 0;

    /* --- stamina --- */
    this._staminaDelai = Math.max(0, this._staminaDelai - dt);
    if (this._staminaDelai <= 0) {
      this.stamina.val = Math.min(this.stamina.max, this.stamina.val + REGEN_STAMINA_PAR_S * dt);
    }

    /* --- entrées de déplacement (relatif caméra) --- */
    const { x: ax, z: az } = input.moveAxes();
    const s = Math.sin(yaw), c = Math.cos(yaw);
    this._dir.set(s * az + c * ax, 0, c * az - s * ax);
    const bouge = this._dir.lengthSq() > 0.001 && !this._lock;
    if (bouge) this._dir.normalize();

    /* --- nage ? --- */
    const fond = this.world.getHeightAt(t.x, t.z);
    this.swimming = fond < NIVEAU_NAGE - 0.2;

    /* --- actions : esquive / attaques / saut --- */
    if (!this._lock && !this.swimming) {
      if (input.wasActionPressed('dodge') && this.grounded && this.stamina.val >= COUT_ESQUIVE) {
        this._startDodge(bouge);
      } else if (input.wasActionPressed('attack_light') && this.grounded) {
        this._startAttack(false);
      } else if (input.wasActionPressed('attack_heavy') && this.grounded) {
        this._startAttack(true);
      }
    } else if (this._lock && this._lock.startsWith('attack_light') && input.wasActionPressed('attack_light')) {
      this._bufferAttaque = true; // enchaîne le combo à la fin du coup courant
    }
    this._comboFenetre = Math.max(0, this._comboFenetre - dt);
    if (this._comboFenetre <= 0 && !this._lock) this._combo = 0;

    /* --- vitesse horizontale --- */
    let cible = 0;
    if (this._lock === 'dodge') {
      this._dodgeT -= dt;
      cible = 11 * Math.max(this._dodgeT / 0.42, 0.15); // roulade décélérante
      this._dir.copy(this._dodgeDir);
    } else if (this._lock && this._lock.startsWith('attack')) {
      cible = 1.6; // léger pas en avant pendant le coup
      this._dir.set(Math.sin(this._targetAngle), 0, Math.cos(this._targetAngle));
    } else if (bouge) {
      const veutSprinter = input.isActionDown('sprint') && this.grounded && this.stamina.val > 0;
      if (veutSprinter) {
        this.stamina.val = Math.max(0, this.stamina.val - COUT_SPRINT_PAR_S * dt);
        this._staminaDelai = 0.8;
      }
      cible = this.swimming ? VITESSE_NAGE : veutSprinter ? VITESSE_SPRINT : VITESSE_MARCHE;
      this._targetAngle = Math.atan2(this._dir.x, this._dir.z);
    }
    this.speed += (cible - this.speed) * Math.min(dt * 10, 1);

    /* --- rotation douce du modèle vers la direction --- */
    let dA = this._targetAngle - this.facing.rotation.y;
    dA = ((dA + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.facing.rotation.y += dA * Math.min(dt * 12, 1);

    /* --- vertical : gravité / saut / flottaison --- */
    let dy;
    if (this.swimming) {
      this.velY = 0;
      this.grounded = false;
      const cibleY = NIVEAU_NAGE + this.capsuleOffset;
      dy = (cibleY - t.y) * Math.min(dt * 6, 1);
    } else {
      if (this.grounded && !this._lock && input.wasActionPressed('jump')) {
        this.velY = IMPULSION_SAUT;
        this.grounded = false;
        this.anim.play('jump');
      }
      this.velY += GRAVITE * dt;
      if (this.grounded && this.velY < -2) this.velY = -2; // colle au sol
      dy = this.velY * dt;
    }

    /* --- résolution physique (capsule vs terrain) --- */
    this._desired.set(this._dir.x * this.speed * dt, dy, this._dir.z * this.speed * dt);
    this.controller.computeColliderMovement(this.collider, this._desired);
    const move = this.controller.computedMovement();
    this.body.setNextKinematicTranslation({ x: t.x + move.x, y: t.y + move.y, z: t.z + move.z });

    if (!this.swimming) {
      const wasGrounded = this.grounded;
      this.grounded = this.controller.computedGrounded();
      if (this.grounded && !wasGrounded) this.velY = 0; // atterrissage
      // plafonne la vitesse verticale résiduelle contre les plafonds/pentes
      if (move.y < dy - 0.001 && this.velY > 0) this.velY = 0;
    }

    /* --- synchronisation visuelle (pieds de la capsule) --- */
    this.position.set(t.x + move.x, t.y + move.y - this.capsuleOffset, t.z + move.z);

    /* --- choix de l'état d'animation --- */
    if (!this._lock) {
      let etat;
      if (this.swimming) etat = 'swim';
      else if (!this.grounded) etat = this.velY > 1 ? 'jump' : 'fall';
      else if (this.speed > 0.3) etat = (cible >= VITESSE_SPRINT - 0.5) ? 'run' : 'walk';
      else etat = 'idle';
      this.anim.play(etat);
      this.state = etat;
    }
    this.anim.update(dt, { speed: this.speed });
  }

  /* ---------- actions ---------- */
  _startDodge(bouge) {
    this._lock = 'dodge';
    this.state = 'dodge';
    this._dodgeT = 0.42;
    this.invincible = true;
    this.stamina.val -= COUT_ESQUIVE;
    this._staminaDelai = 0.8;
    // roulade dans la direction d'entrée, sinon vers l'avant du perso
    if (bouge) this._dodgeDir.copy(this._dir);
    else this._dodgeDir.set(Math.sin(this.facing.rotation.y), 0, Math.cos(this.facing.rotation.y));
    this._targetAngle = Math.atan2(this._dodgeDir.x, this._dodgeDir.z);
    this.anim.play('dodge', { force: true, onFinished: () => this._unlock() });
  }

  _startAttack(lourde) {
    let etat;
    if (lourde) {
      etat = 'attack_heavy';
      this._combo = 0;
    } else {
      this._combo = this._comboFenetre > 0 ? (this._combo % 3) + 1 : 1;
      etat = `attack_light_${this._combo}`;
    }
    this._lock = etat;
    this.state = etat;
    // le coup part face à la caméra
    if (this.cameraCtrl) this._targetAngle = this.cameraCtrl.yaw + Math.PI;
    this.anim.play(etat, {
      force: true,
      onFinished: () => {
        this._comboFenetre = 0.55;
        this._unlock();
        if (this._bufferAttaque) {
          this._bufferAttaque = false;
          this._startAttack(false);
        }
      },
    });
    // durée de secours si le backend ne notifie pas (clip manquant)
    const duree = DUREE_ATTAQUES[etat] ?? 0.5;
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => { if (this._lock === etat) { this._comboFenetre = 0.55; this._unlock(); } }, duree * 1000 + 250);
  }

  _unlock() {
    this._lock = null;
    this.invincible = false;
  }
}
