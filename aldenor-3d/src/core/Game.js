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
    this.updatables.push(this.world, this.hud);

    // Caméra libre de debug — remplacée plus tard par la caméra troisième
    // personne accrochée au joueur. Le streaming de terrain suit sa cible.
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const h0 = this.world.getHeightAt(0, 0);
    this.controls = new OrbitControls(this.scenes.camera, this.canvas);
    this.controls.target.set(0, h0 + 2, 0);
    this.scenes.camera.position.set(35, h0 + 28, 55);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.maxDistance = 400;
    this.controls.panSpeed = 1.6;
    this.controls.screenSpacePanning = false; // le pan glisse sur le plan du sol
    this.updatables.push({ update: () => this.controls.update() });
    this.world.track(this.controls.target);

    this.hud.attachWorld(this.world);
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
