import * as THREE from 'three';

/**
 * EnemyAI — machine à états des ennemis :
 *
 *   patrol ──(joueur < aggroDist)──▶ aggro ──(à portée)──▶ attack
 *     ▲                                │                      │
 *     └──(joueur trop loin 1.6×)───────┘   windup → frappe → cooldown
 *   staggered : poise vidée → n'agit plus, ×1,5 dégâts (StaggerSystem)
 *   dead      : bascule + fondu, retiré après ~2 s
 *
 * Valeurs de départ :
 *  - WINDUP 0,55 s de télégraphe (le mob "s'arme", teinte rouge)
 *  - cooldown d'attaque 1,6 s
 *  - désengagement à 1,6 × la distance d'aggro
 */

const WINDUP = 0.55;
const COOLDOWN_ATTAQUE = 1.6;
const _v = new THREE.Vector3();

export function updateEnemyAI(e, dt, cs) {
  const player = cs.player;
  const world = cs.world;

  if (e.dead) return;

  // recul (knockback) appliqué par les coups
  if (e.kbVel.lengthSq() > 0.01) {
    e.position.x += e.kbVel.x * dt;
    e.position.z += e.kbVel.z * dt;
    e.kbVel.multiplyScalar(Math.max(1 - dt * 7, 0));
  }

  // stagger : immobile et vulnérable (géré par StaggerSystem)
  if (e.staggerT > 0) {
    e.windupT = 0;
    snapGround(e, world);
    return;
  }

  e.atkCd = Math.max(0, e.atkCd - dt);
  const dPlayer = _v.subVectors(player.position, e.position).setY(0).length();

  switch (e.state) {
    case 'patrol': {
      // errance autour du point d'origine
      e.errT -= dt;
      if (e.errT <= 0) {
        e.errT = 1.5 + Math.random() * 3;
        if (Math.random() < 0.45) e.errDir.set(0, 0, 0);
        else {
          const a = Math.random() * Math.PI * 2;
          e.errDir.set(Math.sin(a), 0, Math.cos(a));
          // revient vers la maison s'il s'éloigne trop
          if (e.position.distanceTo(e.home) > 12) {
            e.errDir.subVectors(e.home, e.position).setY(0).normalize();
          }
        }
      }
      deplacer(e, e.errDir, e.vitesse * 0.4, dt, world);
      if (dPlayer < e.aggroDist && !player.dead) e.state = 'aggro';
      break;
    }
    case 'aggro': {
      if (dPlayer > e.aggroDist * 1.6 || player.dead) { e.state = 'patrol'; break; }
      if (dPlayer < e.porteeAttaque) { e.state = 'attack'; e.windupT = 0; break; }
      _v.subVectors(player.position, e.position).setY(0).normalize();
      deplacer(e, _v, e.vitesse, dt, world);
      break;
    }
    case 'attack': {
      if (player.dead) { e.state = 'patrol'; e.windupT = 0; break; }
      // face au joueur
      _v.subVectors(player.position, e.position).setY(0);
      if (_v.lengthSq() > 0.001) e.model.rotation.y = Math.atan2(_v.x, _v.z);

      if (dPlayer > e.porteeAttaque * 1.35) { e.state = 'aggro'; e.windupT = 0; break; }

      if (e.windupT > 0) {
        // télégraphe en cours → frappe à terme
        e.windupT -= dt;
        if (e.windupT <= 0) {
          e.atkCd = COOLDOWN_ATTAQUE;
          if (dPlayer < e.porteeAttaque * 1.15) {
            cs.playerTakeDamage(e.degats, e.position);
          }
        }
      } else if (e.atkCd <= 0) {
        e.windupT = WINDUP; // arme le coup (teinte rouge sur le modèle)
      }
      snapGround(e, world);
      break;
    }
  }
}

function deplacer(e, dir, vitesse, dt, world) {
  if (dir.lengthSq() < 0.001) { snapGround(e, world); return; }
  const nx = e.position.x + dir.x * vitesse * dt;
  const nz = e.position.z + dir.z * vitesse * dt;
  const h = world.getHeightAt(nx, nz);
  // refuse l'eau profonde et les pentes raides
  const pente = Math.abs(h - e.position.y);
  if (h > -0.4 && pente < vitesse * dt * 2 + 0.6) {
    e.position.set(nx, h, nz);
    e.model.rotation.y += (Math.atan2(dir.x, dir.z) - e.model.rotation.y) * Math.min(dt * 8, 1);
  }
}

function snapGround(e, world) {
  e.position.y = world.getHeightAt(e.position.x, e.position.z);
}
