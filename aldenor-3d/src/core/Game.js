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

    // ---- Phase 5 : PNJ, dialogues, quêtes, sauvegarde ----
    const { Inventory } = await import('../systems/Inventory.js');
    const { NpcManager } = await import('../systems/NpcManager.js');
    const { QuestSystem } = await import('../systems/QuestSystem.js');
    const { DialogueSystem } = await import('../systems/DialogueSystem.js');
    const { Interaction } = await import('../systems/Interaction.js');
    const { SaveSystem } = await import('../systems/SaveSystem.js');
    const { QuestJournal } = await import('../ui/QuestJournal.js');
    // ---- Phase 6 : inventaire, équipement, loot, boutiques ----
    const { Equipment } = await import('../systems/Equipment.js');
    const { LootSystem } = await import('../systems/LootSystem.js');
    const { InventoryUI } = await import('../ui/InventoryUI.js');
    const { ShopSystem } = await import('../systems/ShopSystem.js');

    this.flags = {};
    this.inventory = new Inventory();
    this.npcs = new NpcManager(this.scenes.scene, this.world);
    this.quests = new QuestSystem({ player: this.player, world: this.world, inventory: this.inventory, npcs: this.npcs });
    this.npcs.quests = this.quests;
    // progression des quêtes de collecte quand le sac change
    this.inventory.onChange = (id) => { if (id !== 'or') this.quests.notifyCollect(id); };

    // équipement (stats réelles) + loot au sol + UI sac/boutique
    this.equipment = new Equipment({ player: this.player, combat: this.combat, inventory: this.inventory });
    this.combat.equipment = this.equipment;
    this.loot = new LootSystem(this.scenes.scene, this.world, this.player, this.inventory);
    this.inventoryUI = new InventoryUI({ inventory: this.inventory, equipment: this.equipment, player: this.player, combat: this.combat });
    this.shop = new ShopSystem({ inventory: this.inventory, input: this.input });

    this.dialogue = new DialogueSystem({ quests: this.quests, inventory: this.inventory, flags: this.flags, player: this.player });
    this.interaction = new Interaction({
      input: this.input, camera: this.scenes.camera, player: this.player,
      npcs: this.npcs, physics: this.physics, dialogue: this.dialogue,
    });
    this.journal = new QuestJournal(this.quests, this.scenes.camera);
    this.dialogue.onToast = (t) => this.journal.toast(t);
    this.dialogue.onRest = () => { this.player.pv = this.player.pvmax; this.combat.stamina.val = this.combat.stamina.max; this.journal.toast('Vous vous reposez : PV et endurance restaurés.', 'quete'); };
    // ouverture de boutique depuis un dialogue de PNJ marchand
    this.dialogue.onShop = (key, nom) => this.shop.openShop(key, nom);
    this.inventoryUI.onToast = (t, k) => this.journal.toast(t, k);
    this.shop.onToast = (t) => this.journal.toast(t);
    this.loot.onPickup = (id, n, or) => this.journal.toast(or ? `+${or} or` : `Ramassé : ${this.inventory.nom(id)}${n > 1 ? ' ×' + n : ''}`);

    // butin AU SOL à la mort d'un ennemi + progression des quêtes de chasse
    this.combat.onKill = (e) => { this.loot.dropFor(e.id, e.position); this.quests.notifyKill(e.id); };

    // équipement de départ : épée rouillée + quelques provisions
    this.inventory.add('epee1', 1); this.equipment.equip('epee1');
    this.inventory.add('ppv1', 3); this.inventory.add('arm1', 1);

    // sauvegarde (inclut l'équipement)
    this.save = new SaveSystem({ quests: this.quests, inventory: this.inventory, equipment: this.equipment, flags: this.flags, player: this.player });
    if (this.save.hasSave()) { this.save.load(); this.journal.toast('Partie chargée.', 'quete'); }

    // routage clavier UI (journal J, fermeture/choix de dialogue) +
    // synchro du gel gameplay. Placé EN TÊTE de frame.
    const uiInput = {
      update: () => {
        const modaleAutre = this.dialogue.active || this.shop.open;
        // bascule inventaire (I) / journal (J) — pas pendant dialogue/boutique
        if (this.input.wasPressed('KeyI') && !modaleAutre) this.inventoryUI.toggle();
        if (this.input.wasPressed('KeyJ') && !modaleAutre && !this.inventoryUI.open) this.journal.toggle();
        // routage des touches vers le dialogue actif
        if (this.dialogue.active) {
          for (const code of this.input.pressed) this.dialogue.key(code);
        } else if (this.input.wasPressed('Escape')) {
          if (this.shop.open) this.shop.close();
          else if (this.inventoryUI.open) this.inventoryUI.toggle();
          else if (this.journal.open) this.journal.toggle();
        }
        // gèle le gameplay tant qu'une UI modale est ouverte
        this.input.uiActive = this.dialogue.active || this.journal.open || this.inventoryUI.open || this.shop.open;
      },
    };

    // ordre d'une frame : uiInput → physique → joueur → combat → PNJ →
    // interaction → quêtes → loot → caméra → monde → journal → sauvegarde → HUD
    this.updatables.push(
      uiInput,
      { update: (dt) => this.physics.step(dt) },
      this.player, this.combat,
      { update: (dt, el) => this.npcs.update(dt, el, this.player) },
      this.interaction, this.quests, this.loot, this.cameraCtrl, this.world,
      this.journal, this.save, this.hud,
    );

    // sauvegarde à la fermeture de l'onglet
    window.addEventListener('beforeunload', () => this.save.save());

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
