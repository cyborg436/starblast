'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/parasite.js — PARASITE
   Infecte les ennemis touchés → ils tirent sur leurs alliés pendant 4s
   → mort par infection = contagion à l'ennemi tueur (chaîne illimitée)
   Boss : immunisés à l'infection mais reçoivent 20 dégâts directs.
   Chargé APRÈS game.js et weapons.js.
───────────────────────────────────────────────────────────────────────── */

const PARASITE_INFECTION_DURATION = 4.0;
const PARASITE_FIRE_RATE_MULT     = 2.0;   // cadence de tir doublée pendant l'infection
const PARASITE_BOSS_DAMAGE        = 20;

/** Bullet subclass : projectile organique lent (1 seul à l'écran max). */
class ParasiteBullet extends Bullet {
  constructor(x, y) {
    super(x, y, 0, -280, '#aa1122', true, '');
    this.isParasite = true;
    this.w = 8; this.h = 14;
    this.damage = 1;   // dégât nominal (infection déclenchée à part)
    this._t = 0;
  }
  draw(ctx) {
    this._t += 0.04;
    const pulse = 1 + 0.3 * Math.sin(this._t * 10);
    ctx.save();
    // Halo rouge/noir pulsant
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.w * 2.5 * pulse);
    g.addColorStop(0, '#ff4488');
    g.addColorStop(0.4, '#8b0022');
    g.addColorStop(1, 'rgba(30,0,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.w * 2.5 * pulse, 0, Math.PI * 2); ctx.fill();
    // Cœur pulsant
    ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff2244';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.w * 0.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/** Infecte un ennemi : le marque, tourne son tir vers les alliés, cadence x2. */
function infectEnemy(enemy, game) {
  if (!enemy || enemy.isBoss || enemy._infected || enemy.dead || enemy.dying) return false;
  enemy._infected     = true;
  enemy._infectTimer  = PARASITE_INFECTION_DURATION;
  enemy._origFireRate = enemy.fireRate;
  enemy.fireRate      = (enemy.fireRate || 3) / PARASITE_FIRE_RATE_MULT;
  return true;
}

/** Tick : gère les infections en cours (dégâts, tir sur alliés, propagation). */
function tickInfections(dt, game) {
  if (!game || !game.enemies) return;
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (!e._infected || e.dead) continue;
    e._infectTimer -= dt;

    // Tire sur les alliés proches (au lieu du joueur)
    if (!e._infectShootTimer) e._infectShootTimer = 0.5;
    e._infectShootTimer -= dt;
    if (e._infectShootTimer <= 0) {
      e._infectShootTimer = (e._origFireRate || 3) / PARASITE_FIRE_RATE_MULT;
      // Cible : ennemi vivant non infecté le plus proche
      let best = null, bestD = Infinity;
      for (const other of game.enemies) {
        if (other === e || other.dead || other.dying || other._infected) continue;
        const dx = other.x - e.x, dy = other.y - e.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD) { bestD = d2; best = other; }
      }
      if (best) {
        const dx = best.x - e.x, dy = best.y - e.y;
        const d  = Math.hypot(dx, dy) || 1;
        const spd = CFG.ENEMY_BULLET_SPEED * 1.2;
        const b = new Bullet(e.x, e.y, (dx/d) * spd, (dy/d) * spd, '#ff2244', false);
        b._parasiteShot = true;   // marqueur pour propagation
        b._infectSource = e;
        game.enemyBullets.push(b);
      }
    }

    // Fin de l'infection : mort par le parasite
    if (e._infectTimer <= 0) {
      e.dead = true;
      spawnExplosion(game.particles, e.x, e.y, '#ff2244', 18, true);
      // Score + coin normal
      if (game._survivalMode && game.wave) {
        game.player.score += game.combo.addKill((e.score || 100) * game.wave.level);
        game.achievements.onKill();
        game.wave.enemyKilled();
        game._maybeSurvivalDrop && game._maybeSurvivalDrop(e.x, e.y);
      }
    }
  }
}

/** Vérifie les balles _parasiteShot qui touchent un ennemi → infecte. */
function handleInfectionChain(bullet, enemy, game) {
  if (!bullet._parasiteShot) return false;
  return infectEnemy(enemy, game);
}

// ── Enregistrement ────────────────────────────────────────────
window.registerPremiumWeapon('parasite', {
  onFire(wm, player, bullets, audio, game) {
    // 1 seul projectile à l'écran max
    const alreadyOne = bullets.some(b => b instanceof ParasiteBullet && !b.dead);
    if (alreadyOne) return 0;
    const px = player.x, py = player.y - player.h * 0.46;
    bullets.push(new ParasiteBullet(px, py));
    if (audio && audio.shoot) audio.shoot();
    return 1;
  },
  onHit(bullet, enemy, game) {
    if (!bullet.isParasite) return;
    // Boss : dégâts directs 20 PV
    if (enemy.isBoss) {
      enemy.hit && enemy.hit(PARASITE_BOSS_DAMAGE);
      spawnExplosion(game.particles, bullet.x, bullet.y, '#ff2244', 12, true);
    } else {
      infectEnemy(enemy, game);
    }
    bullet.dead = true;
  },
  tick(dt, game) {
    tickInfections(dt, game);
  },
});

// Export helper pour la vérification de balle ennemie qui infecte
window.handleParasiteInfectionChain = handleInfectionChain;

/** Draw override pour ennemis infectés : veines rouges + halo pulsant. */
window.drawInfectedOverlay = function(ctx, enemy) {
  if (!enemy._infected || enemy.dead) return;
  const t = Date.now() * 0.006;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  // Halo rouge
  ctx.strokeStyle = `rgba(255,40,80,${0.6 + 0.3 * Math.sin(t * 4)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, (enemy.w || 30) * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  // Veines
  ctx.strokeStyle = 'rgba(255,20,40,0.7)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + t;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (enemy.w || 30) * 0.35, Math.sin(a) * (enemy.h || 30) * 0.35);
    ctx.stroke();
  }
  ctx.restore();
};
