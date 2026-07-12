import { StaminaSystem } from './StaminaSystem.js';
import { ComboSystem } from './ComboSystem.js';
import { DodgeSystem } from './DodgeSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { HitDetection } from './HitDetection.js';
import { LockOn } from './LockOn.js';
import { Juice } from './Juice.js';
import { updateEnemyAI } from './EnemyAI.js';
import { appliquerElement, updateElement, ELEMENT_INFO } from './elementalReactions.js';
import { damagePoise, updatePoise, MULT_DEGATS_STAGGER } from './StaggerSystem.js';
import { Enemy } from '../../entities/Enemy.js';
import { DATA } from '../../data/index.js';

/**
 * CombatSystem — hub : possède les sous-systèmes, la liste d'ennemis,
 * le spawn par biome (tables de mobs.json) et TOUTE la résolution d'un
 * coup (applyHit) : stagger → réaction élémentaire → dégâts → juice.
 *
 * Spawn (valeurs de départ) :
 *  - max 9 ennemis vivants, 1 tentative / 2,5 s
 *  - anneau 22-40 m autour du joueur, jamais dans l'eau
 *  - niveau = 1 + distance au spawn / 150 (cap 5)
 *  - despawn > 90 m
 */

const MAX_ENNEMIS = 9;
const INTERVALLE_SPAWN = 2.5;
const DIST_DESPAWN = 90;

// biome 3D → clé de table de spawn 2D (mobs.json)
const REGION_2D = { prairie: 'plaines', foret: 'foret', desert: 'desert', neige: 'neige', marais: 'marais' };
// mobs volants/spéciaux non incarnés pour l'instant
const EXCLUS = new Set(['chauvesouris', 'fantome']);

export class CombatSystem {
  constructor({ game, scene, camera, world, player, input }) {
    this.game = game;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.input = input;

    this.stamina = new StaminaSystem();
    player.stamina = this.stamina; // compat HUD/sprint
    this.juice = new Juice(game, scene, camera);
    this.hits = new HitDetection(this);
    this.combo = new ComboSystem(this);
    this.dodge = new DodgeSystem(this);
    this.skills = new SkillSystem(this);
    this.lockOn = new LockOn(this);

    this.enemies = [];
    this.enCombat = false;
    this._combatT = 0;   // temps restant "en combat" après le dernier échange
    this._spawnT = 1.5;
    this._elapsed = 0;
  }

  /** Verrou d'action global du joueur (mouvement contraint). */
  get lock() {
    return this.dodge.lock || this.combo.lock || this.skills.lock || null;
  }

  /** Contrainte de déplacement de l'action en cours (ou null). */
  get moveOverride() {
    return this.dodge.moveOverride || this.combo.moveOverride ||
      (this.skills.lock ? { vitesse: 0 } : null);
  }

  /** i-frames actives (esquive) — lu par playerTakeDamage. */
  get invincible() {
    return this.dodge.iframesActive;
  }

  /** Direction des coups du joueur : cible verrouillée sinon caméra. */
  attackFacing() {
    const t = this.lockOn.target;
    if (t) {
      return Math.atan2(t.position.x - this.player.position.x, t.position.z - this.player.position.z);
    }
    return this.player.cameraCtrl ? this.player.cameraCtrl.yaw + Math.PI : this.player.facing.rotation.y;
  }

  nearestEnemyInFront(portee) {
    const face = this.attackFacing();
    const fx = Math.sin(face), fz = Math.cos(face);
    let best = null, bd = portee;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.position.x - this.player.position.x;
      const dz = e.position.z - this.player.position.z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.15) { bd = d; best = e; }
    }
    return best;
  }

  /* ============================================================
     Résolution d'un coup du joueur sur un ennemi
     ============================================================ */
  applyHit(e, { degats, poise = 10, kb = 0, element = null, energie = 0, lourd = false, tag = '' }) {
    if (e.dead) return;

    // 1. réaction élémentaire (avant les dégâts : le mult s'applique au coup)
    const reaction = element ? appliquerElement(e, element) : null;
    let mult = reaction?.mult ?? 1;

    // 2. stagger : vulnérabilité + la lourde chargée vide plus de poise
    if (e.staggerT > 0) mult *= MULT_DEGATS_STAGGER;
    const stagger = damagePoise(e, poise + (lourd ? 10 : 0));

    // 3. dégâts — multipliés par le bonus d'arme équipée (Equipment)
    if (this.equipment) mult *= this.equipment.damageMult();
    const total = Math.max(1, Math.round(degats * mult));
    e.pv -= total;
    e.hitFlash = 1;
    e.state = e.state === 'patrol' ? 'aggro' : e.state; // riposte
    this._combatT = 5;

    // 4. knockback
    if (kb > 0) {
      const d = Math.max(e.position.distanceTo(this.player.position), 0.3);
      e.kbVel.set((e.position.x - this.player.position.x) / d * kb, 0, (e.position.z - this.player.position.z) / d * kb);
    }

    // 5. énergie (touche → charge l'ultime)
    if (energie) this.skills.gainEnergie(energie);

    // 6. juice : hit-stop, shake, particules, nombres
    const kill = e.pv <= 0;
    this.juice.impact(e.position, { element, lourd, reaction, kill });
    const couleur = reaction ? reaction.couleur : element ? ELEMENT_INFO[element].couleur : (lourd ? '#ffd24a' : '#ffffff');
    this.juice.dmgNumber(e.position, String(total), { couleur, gros: lourd || !!reaction });
    if (reaction) this.juice.dmgNumber(e.position, reaction.nom + ' !', { couleur: reaction.couleur, gros: true });
    if (stagger) this.juice.dmgNumber(e.position, 'Déséquilibré !', { couleur: '#ffe28a' });

    // 7. effets de réaction : zone / propagation
    if (reaction?.aoe) {
      for (const autre of this.enemies) {
        if (autre === e || autre.dead) continue;
        if (autre.position.distanceTo(e.position) < reaction.aoe.rayon) {
          this.applyHit(autre, { degats: reaction.aoe.degats, poise: 15, tag: 'surcharge' });
        }
      }
    }
    if (reaction?.propage) {
      for (const autre of this.enemies) {
        if (autre === e || autre.dead) continue;
        if (autre.position.distanceTo(e.position) < reaction.propage.rayon) {
          appliquerElement(autre, reaction.elementPropage);
          this.juice.burst(autre.position, ELEMENT_INFO[reaction.elementPropage].particule, 10, { vitesse: 3 });
        }
      }
    }

    if (kill) this._tuer(e, tag);
  }

  _tuer(e) {
    e.dead = true;
    e.pv = 0;
    this.skills.gainEnergie(8); // récompense d'exécution
    // XP vers la future progression (Phase 5) : hook
    if (this.onKill) this.onKill(e);
  }

  /* ---------- dégâts subis par le joueur ---------- */
  playerTakeDamage(montant, fromPos, element = null) {
    const p = this.player;
    if (p.dead || this.invincible || p.hurtT > 0) return;
    // mitigation par l'équipement : défense (plat) + résistance élémentaire
    const recu = this.equipment ? this.equipment.mitigate(montant, element) : Math.round(montant);
    p.pv = Math.max(0, p.pv - recu);
    p.hurtT = 0.55; // invulnérabilité post-coup
    this._combatT = 5;
    this.skills.gainEnergie(4); // "un peu" d'énergie en subissant
    this.juice.shake(0.35);
    this.juice.dmgNumber(p.position, '-' + recu, { couleur: '#ff7060' });
    this.juice.burst(p.position, '#ff6050', 10, { vitesse: 4 });
    if (fromPos) {
      const d = Math.max(p.position.distanceTo(fromPos), 0.3);
      p.applyKnockback((p.position.x - fromPos.x) / d * 5, (p.position.z - fromPos.z) / d * 5);
    }
    if (p.pv <= 0) p.die();
    else if (!this.lock) p.anim.play('hit', { force: true });
  }

  /* ============================================================
     Boucle
     ============================================================ */
  update(dt, elapsed) {
    this._elapsed = elapsed;
    this._combatT = Math.max(0, this._combatT - dt);
    this.enCombat = this._combatT > 0;

    // actions du joueur (priorité : esquive — peut annuler — puis combo, puis skills)
    if (!this.player.dead) {
      this.dodge.update(dt);
      this.combo.update(dt);
      this.skills.update(dt);
    }
    this.stamina.update(dt, this.enCombat);
    this.hits.update(dt);
    this.lockOn.update(dt);

    // ennemis : IA + poise + éléments + visuel
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      updateEnemyAI(e, dt, this);
      updatePoise(e, dt);
      updateElement(e, dt);
      e.updateVisuals(dt, elapsed);
      if ((e.dead && e.mortT > 2.1) || e.position.distanceTo(this.player.position) > DIST_DESPAWN) {
        e.dispose(this.scene);
        this.enemies.splice(i, 1);
      }
      if (!e.dead && e.position.distanceTo(this.player.position) < e.aggroDist + 4) this._combatT = Math.max(this._combatT, 1.2);
    }

    this._spawner(dt);
    this.juice.update(dt);
  }

  _spawner(dt) {
    this._spawnT -= dt;
    if (this._spawnT > 0 || this.enemies.filter(e => !e.dead).length >= MAX_ENNEMIS) return;
    this._spawnT = INTERVALLE_SPAWN;

    const p = this.player.position;
    const a = Math.random() * Math.PI * 2;
    const r = 22 + Math.random() * 18;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    const h = this.world.getHeightAt(x, z);
    if (h < 0.2) return; // pas dans l'eau / la berge
    if (this.world.pois?.blocked?.(x, z)) return;

    const biome = this.world.gen.dominantAt(x, z);
    const table = (DATA.mobs.tablesSpawnParRegion[REGION_2D[biome.id]] || []).filter(id => !EXCLUS.has(id));
    if (table.length === 0) return;
    const id = table[Math.floor(Math.random() * table.length)];
    const lvl = Math.min(5, 1 + Math.floor(Math.hypot(x, z) / 150));

    const e = new Enemy(id, lvl, x, z, this.world);
    e.addTo(this.scene);
    this.enemies.push(e);
  }
}
