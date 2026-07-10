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

    this.world = new World(this.scenes.scene, this.assets, this.renderer.capabilities.getMaxAnisotropy());

    // Joueur + caméra troisième personne (le streaming de terrain suit le joueur)
    const { Player } = await import('../entities/Player.js');
    const { CameraController } = await import('./CameraController.js');
    this.player = new Player(this.world, this.input);
    this.player.addTo(this.scenes.scene);
    this.cameraCtrl = new CameraController(this.scenes.camera, this.canvas, this.input, this.world, this.player.position);
    this.player.cameraCtrl = this.cameraCtrl;
    this.world.track(this.player.position);

    // ordre d'une frame : joueur → caméra → monde (streaming/ambiance) → HUD
    this.updatables.push(this.player, this.cameraCtrl, this.world, this.hud);

    this.hud.attachWorld(this.world);
    this.hud.attachPlayer(this.player);
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

  _tick() {
    // Delta borné : évite les téléportations après un onglet en arrière-plan.
    const dt = Math.min(this.clock.getDelta(), 0.05);
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
