import * as THREE from 'three';

/**
 * AnimationController — state machine d'animations avec crossfade.
 *
 * États : idle, walk, run, jump, fall, attack_light_1/2/3, attack_heavy,
 * dodge, hit, dead. Les autres systèmes (mouvement, combat) n'appellent
 * que `play(nom, options)` — jamais le mixer directement.
 *
 * Deux backends interchangeables :
 *  - MixerBackend : clips d'un .glb riggé (Mixamo) via THREE.AnimationMixer,
 *    crossfade natif 0.15–0.2 s.
 *  - ProceduralBackend : poses codées du héros low-poly (fallback tant
 *    qu'aucun modèle n'est déposé dans public/models/hero.glb).
 */

export const ANIM_STATES = [
  'idle', 'walk', 'run', 'jump', 'fall', 'swim',
  'attack_light_1', 'attack_light_2', 'attack_light_3', 'attack_heavy',
  'charge', 'dodge', 'hit', 'tired', 'dead',
];

/** États joués une seule fois (non bouclés) → onFinished. */
const ONCE = new Set(['jump', 'attack_light_1', 'attack_light_2', 'attack_light_3', 'attack_heavy', 'dodge', 'hit', 'tired', 'dead']);

export class AnimationController {
  constructor(backend) {
    this.backend = backend;
    this.current = null;
  }

  /**
   * Joue un état. options :
   *  - force     : rejoue même si déjà actif
   *  - fade      : durée du crossfade (défaut 0.18 s)
   *  - timeScale : vitesse de lecture
   *  - onFinished: callback pour les états non bouclés
   */
  play(name, options = {}) {
    if (this.current === name && !options.force) return;
    this.current = name;
    this.backend.play(name, {
      fade: options.fade ?? 0.18,
      once: ONCE.has(name),
      timeScale: options.timeScale ?? 1,
      onFinished: options.onFinished ?? null,
    });
  }

  update(dt, ctx) {
    this.backend.update(dt, ctx);
  }
}

/* ============================================================
   Backend .glb (Mixamo) — clips → actions avec crossfade
   ============================================================ */

/** Alias tolérants : Mixamo nomme ses clips librement. */
const CLIP_ALIASES = {
  idle: ['idle', 'breathing'],
  walk: ['walk'],
  run: ['run', 'sprint', 'jog'],
  jump: ['jump'],
  fall: ['fall', 'falling'],
  swim: ['swim', 'tread'],
  attack_light_1: ['attack_light_1', 'attack1', 'slash1', 'slash', 'attack'],
  attack_light_2: ['attack_light_2', 'attack2', 'slash2'],
  attack_light_3: ['attack_light_3', 'attack3', 'slash3'],
  attack_heavy: ['attack_heavy', 'heavy', 'smash', 'strong'],
  charge: ['charge', 'windup', 'chargeloop'],
  dodge: ['dodge', 'roll', 'dive'],
  hit: ['hit', 'impact', 'react'],
  tired: ['tired', 'exhaust', 'catchbreath'],
  dead: ['dead', 'death', 'dying'],
};

/** Si un clip manque, on retombe sur un voisin plausible. */
const FALLBACKS = {
  walk: 'run', run: 'walk', fall: 'jump', swim: 'idle',
  attack_light_2: 'attack_light_1', attack_light_3: 'attack_light_1',
  attack_heavy: 'attack_light_1', charge: 'idle', dodge: 'jump',
  hit: 'idle', tired: 'hit', dead: 'idle',
};

export class MixerBackend {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    this._active = null;

    // résout chaque état vers un clip par alias (insensible à la casse)
    const lower = clips.map(c => ({ clip: c, name: c.name.toLowerCase() }));
    const resolve = (state) => {
      for (const alias of CLIP_ALIASES[state] || [state]) {
        const found = lower.find(e => e.name.includes(alias));
        if (found) return found.clip;
      }
      return null;
    };
    for (const state of ANIM_STATES) {
      let clip = resolve(state);
      if (!clip && FALLBACKS[state]) clip = resolve(FALLBACKS[state]);
      if (clip) this.actions[state] = this.mixer.clipAction(clip);
      else console.warn(`[anim] clip manquant pour l'état "${state}"`);
    }

    this.mixer.addEventListener('finished', () => {
      if (this._onFinished) { const f = this._onFinished; this._onFinished = null; f(); }
    });
  }

  play(name, { fade, once, timeScale, onFinished }) {
    const action = this.actions[name] || this.actions.idle;
    if (!action) return;
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      this._onFinished = onFinished;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      this._onFinished = null;
    }
    action.reset();
    action.timeScale = timeScale;
    action.enabled = true;
    if (this._active && this._active !== action) {
      action.crossFadeFrom(this._active, fade, true);
    }
    action.play();
    this._active = action;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}

/* ============================================================
   Backend procédural — poses du héros low-poly (fallback)
   ============================================================ */

const DUREES = {
  jump: 0.5, attack_light_1: 0.42, attack_light_2: 0.42, attack_light_3: 0.6,
  attack_heavy: 0.85, dodge: 0.42, hit: 0.3, tired: 0.5, dead: 1.1,
};

export class ProceduralBackend {
  /** parts : { model, legL, legR, armL, armR, head } du héros low-poly. */
  constructor(parts) {
    this.p = parts;
    this.state = 'idle';
    this.t = 0;
    this._once = false;
    this._onFinished = null;
    this._timeScale = 1;
  }

  play(name, { once, timeScale, onFinished }) {
    this.state = name;
    this.t = 0;
    this._once = once;
    this._timeScale = timeScale;
    this._onFinished = onFinished;
  }

  update(dt, ctx = {}) {
    this.t += dt * this._timeScale;
    if (this._once && this.t >= (DUREES[this.state] ?? 0.5)) {
      const f = this._onFinished;
      this._once = false;
      this._onFinished = null;
      if (f) f();
    }
    this._pose(dt, ctx);
  }

  _pose(dt, ctx) {
    const { model, legL, legR, armL, armR } = this.p;
    const t = this.t;
    const k = Math.min(dt * 14, 1);
    const to = (obj, prop, v) => { obj.rotation[prop] += (v - obj.rotation[prop]) * k; };
    const vitesse = ctx.speed ?? 0;

    // remise à plat progressive des axes secondaires
    to(model, 'x', ['dodge', 'dead'].includes(this.state) ? model.rotation.x : 0);
    to(model, 'z', 0);

    switch (this.state) {
      case 'idle': {
        const b = Math.sin(t * 2.2) * 0.04;
        to(legL, 'x', 0); to(legR, 'x', 0);
        to(armL, 'x', b); to(armR, 'x', -b);
        model.position.y *= 0.9;
        break;
      }
      case 'walk':
      case 'run': {
        const kv = this.state === 'run' ? 1.35 : 0.8;
        const phase = t * (5 + vitesse * 1.3);
        const swing = Math.sin(phase) * kv * 0.75;
        legL.rotation.x = swing; legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.85; armR.rotation.x = swing * 0.85;
        model.position.y = Math.abs(Math.sin(phase)) * 0.07 * kv;
        break;
      }
      case 'jump':
        to(armL, 'x', -2.3); to(armR, 'x', -2.3);
        to(legL, 'x', 0.55); to(legR, 'x', -0.3);
        break;
      case 'fall':
        to(armL, 'x', -2.6); to(armR, 'x', -2.6);
        to(legL, 'x', 0.25); to(legR, 'x', 0.25);
        break;
      case 'attack_light_1': { // taille horizontale droite→gauche
        const p = Math.min(t / 0.42, 1);
        armR.rotation.x = -1.6;
        model.rotation.y += 0; // le corps est orienté par Player
        armR.rotation.z = -1.2 + p * 2.2;
        to(armL, 'x', 0.4);
        break;
      }
      case 'attack_light_2': { // revers gauche→droite
        const p = Math.min(t / 0.42, 1);
        armR.rotation.x = -1.6;
        armR.rotation.z = 1.0 - p * 2.2;
        to(armL, 'x', 0.4);
        break;
      }
      case 'attack_light_3': { // estoc plongeant
        const p = Math.min(t / 0.6, 1);
        armR.rotation.x = -2.6 + p * 2.4;
        armR.rotation.z = 0;
        to(armL, 'x', -0.6);
        model.position.y = Math.sin(p * Math.PI) * 0.1;
        break;
      }
      case 'attack_heavy': { // coup à deux mains par-dessus la tête
        const p = Math.min(t / 0.85, 1);
        const lift = p < 0.5 ? p * 2 : 1;
        const smash = p < 0.5 ? 0 : (p - 0.5) * 2;
        armL.rotation.x = -2.8 * lift + smash * 3.4;
        armR.rotation.x = -2.8 * lift + smash * 3.4;
        model.position.y = smash * -0.12;
        break;
      }
      case 'dodge': { // roulade avant
        const p = Math.min(t / 0.42, 1);
        model.rotation.x = p * Math.PI * 2;
        to(legL, 'x', 0.9); to(legR, 'x', 0.9);
        to(armL, 'x', -0.9); to(armR, 'x', -0.9);
        break;
      }
      case 'charge': { // lourde en charge : arquée, épée levée qui tremble
        const tremble = Math.sin(t * 30) * Math.min(t * 0.06, 0.08);
        to(armL, 'x', -2.7 + tremble); to(armR, 'x', -2.7 - tremble);
        to(model, 'x', 0.12);
        to(legL, 'x', 0.25); to(legR, 'x', -0.25);
        break;
      }
      case 'hit':
        to(model, 'x', -0.25);
        to(armL, 'x', -0.8); to(armR, 'x', -0.8);
        break;
      case 'tired': { // essoufflement : plié en deux, souffle court
        to(model, 'x', 0.5);
        const souffle = Math.sin(t * 14) * 0.15;
        to(armL, 'x', 0.6 + souffle); to(armR, 'x', 0.6 + souffle);
        break;
      }
      case 'dead': {
        const p = Math.min(t / 1.1, 1);
        model.rotation.x = -p * Math.PI / 2;
        model.position.y = -p * 0.4;
        break;
      }
      case 'swim': { // état bonus du fallback (nage)
        const s = Math.sin(t * 5);
        model.rotation.x = 0.9;
        armL.rotation.x = -1.2 + s * 0.8; armR.rotation.x = -1.2 - s * 0.8;
        legL.rotation.x = s * 0.5; legR.rotation.x = -s * 0.5;
        break;
      }
    }
    // reset latéral hors attaques
    if (!this.state.startsWith('attack')) {
      armR.rotation.z += (0 - armR.rotation.z) * k;
    }
  }
}
