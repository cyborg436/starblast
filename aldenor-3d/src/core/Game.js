import * as THREE from 'three';
import { createRenderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { AssetManager } from './AssetManager.js';
import { World } from '../world/World.js';
import { InputManager } from '../input/InputManager.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { Hud } from '../ui/Hud.js';

/**
 * Game — point d'entrée du moteur.
 * Possède la boucle requestAnimationFrame (delta time via THREE.Clock,
 * indépendant du framerate), le renderer, la scène et les sous-systèmes.
 *
 * Ordre d'une frame : input → update(dt) des systèmes → render.
 */
export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = createRenderer(canvas);
    this.scenes = new SceneManager();
    this.input = new InputManager(canvas);
    this.loading = new LoadingScreen();
    this.assets = new AssetManager(this.loading);
    this.hud = new Hud();

    this.clock = new THREE.Clock();
    this.running = false;
    /** Hit-stop : timeScale global très bas pendant quelques ms à l'impact. */
    this.timeScale = 1;
    this._hitStopT = 0;
    /** Systèmes mis à jour chaque frame : tout objet avec une méthode update(dt, elapsed). */
    this.updatables = [];

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  /** Chargement des assets puis construction de la scène. Async pour accueillir les .glb à venir. */
  async init() {
    // Phase 1 : aucun modèle à charger ; les données de jeu (JSON de la Phase 0)
    // sont importées statiquement par src/data/index.js et disponibles immédiatement.
    await this.assets.preload([
      // { type: 'gltf', name: 'player', url: new URL('../assets/models/player.glb', import.meta.url).href },
    ]);

    // physique rapier3d (WASM) — avant le monde : les chunks enregistrent
    // leur collider trimesh à la génération
    const { Physics } = await import('./Physics.js');
    this.physics = await Physics.create();

    this.world = new World(this.scenes.scene, this.assets, this.physics);

    // Joueur (capsule + character controller) + caméra 3e personne avec collision
    const { loadHeroModel } = await import('../entities/HeroModel.js');
    const { Player } = await import('../entities/Player.js');
    const { CameraController } = await import('./CameraController.js');
    const hero = await loadHeroModel(this.assets);
    this.player = new Player(this.world, this.input, this.physics, hero);
    this.player.addTo(this.scenes.scene);
    this.cameraCtrl = new CameraController(this.scenes.camera, this.canvas, this.input, this.world, this.player.position, this.physics);
    this.player.cameraCtrl = this.cameraCtrl;
    this.world.track(this.player.position);

    // système de combat (ennemis, combo, esquive, compétences, lock-on, juice)
    const { CombatSystem } = await import('../systems/combat/CombatSystem.js');
    this.combat = new CombatSystem({
      game: this, scene: this.scenes.scene, camera: this.scenes.camera,
      world: this.world, player: this.player, input: this.input,
    });
    this.player.combat = this.combat;
    this.cameraCtrl.combat = this.combat;

    // ordre d'une frame : physique → joueur → combat → caméra → monde → HUD
    this.updatables.push(
      { update: (dt) => this.physics.step(dt) },
      this.player, this.combat, this.cameraCtrl, this.world, this.hud,
    );

    this.hud.attachWorld(this.world);
    this.hud.attachPlayer(this.player);
    this.hud.attachCombat(this.combat);
    this.loading.hide();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /** Micro-ralenti d'impact (60-130 ms) — donne du poids aux coups. */
  hitStop(ms = 70) {
    this._hitStopT = Math.max(this._hitStopT, ms / 1000);
  }

  _tick() {
    // Delta borné : évite les téléportations après un onglet en arrière-plan.
    const raw = Math.min(this.clock.getDelta(), 0.05);
    // hit-stop : ralenti à 7 % puis retour souple à 1
    if (this._hitStopT > 0) {
      this._hitStopT -= raw;
      this.timeScale = 0.07;
    } else {
      this.timeScale += (1 - this.timeScale) * Math.min(raw * 18, 1);
    }
    const dt = raw * this.timeScale;
    const elapsed = this.clock.elapsedTime;

    for (const u of this.updatables) u.update(dt, elapsed);
    this.input.endFrame();

    this.renderer.render(this.scenes.scene, this.scenes.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scenes.resize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}
