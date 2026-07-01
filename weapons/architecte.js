'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/architecte.js — ARCHITECTE
   Le joueur ne tire plus : il pose des tourelles autonomes (6 max, 8 s).
   Types selon modifieur clavier :
   - Tir normal : tourelle LASER (dégâts rapides)
   - Shift+tir : tourelle BOUCLIER (absorbe 3 tirs ennemis dans un rayon 80 px)
   - Ctrl+tir  : tourelle RÉPARATRICE (soigne 1 vie si joueur proche 5 s)
───────────────────────────────────────────────────────────────────────── */

const TURRET_MAX          = 6;
const TURRET_LIFETIME     = 8.0;
const TURRET_RANGE        = 200;
const TURRET_FIRE_RATE    = 0.28;
const TURRET_DAMAGE       = 1;
const TURRET_PLACE_COOLDOWN = 0.35;

class Turret {
  constructor(x, y, type = 'laser') {
    this.x = x; this.y = y;
    this.type = type;      // 'laser' | 'shield' | 'repair'
    this.life = TURRET_LIFETIME;
    this.fireTimer = 0.2;
    this.angle = -Math.PI / 2;
    this.dead = false;
    this._t = 0;
    // Bouclier : absorbe 3 tirs
    this.shieldAbsorb = 3;
    // Répair : soigne toutes les 5 s
    this.repairTimer = 5.0;
  }
  update(dt, game) {
    this._t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    if (this.type === 'laser') {
      // Cible : ennemi vivant le plus proche dans la portée
      let best = null, bestD = TURRET_RANGE;
      for (const e of game.enemies) {
        if (e.dead || e.dying) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        const dx = best.x - this.x, dy = best.y - this.y;
        this.angle = Math.atan2(dy, dx);
        this._target = best;
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.fireTimer = TURRET_FIRE_RATE;
          const spd = 480;
          const b = new Bullet(this.x, this.y, Math.cos(this.angle) * spd, Math.sin(this.angle) * spd, '#66ccff', true, '');
          b.damage = TURRET_DAMAGE;
          b.isTurretShot = true;
          game.playerBullets.push(b);
        }
      } else {
        this._target = null;
      }
    } else if (this.type === 'shield') {
      // Absorbe les balles ennemies dans un rayon de 80 px
      for (const eb of game.enemyBullets) {
        if (eb.dead) continue;
        const d = Math.hypot(eb.x - this.x, eb.y - this.y);
        if (d < 80) {
          eb.dead = true;
          this.shieldAbsorb--;
          spawnExplosion(game.particles, eb.x, eb.y, '#66ccff', 5);
          if (this.shieldAbsorb <= 0) { this.dead = true; break; }
        }
      }
    } else if (this.type === 'repair') {
      // Soigne le joueur si dans la portée toutes les 5 s
      if (game.player) {
        const d = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        if (d < TURRET_RANGE) {
          this.repairTimer -= dt;
          if (this.repairTimer <= 0) {
            this.repairTimer = 5.0;
            if (game.player.lives < CFG.LIVES) game.player.lives++;
            spawnExplosion(game.particles, this.x, this.y, '#00ff88', 12);
            spawnExplosion(game.particles, game.player.x, game.player.y, '#00ff88', 8);
          }
        }
      }
    }
  }
  draw(ctx) {
    const t = this._t;
    const p = Math.min(1, this.life / TURRET_LIFETIME);
    ctx.save();
    ctx.translate(this.x, this.y);
    // Halo selon type
    const col = this.type === 'laser' ? '#66ccff'
              : this.type === 'shield' ? '#88ffdd'
              : '#00ff88';
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    // Hexagone
    ctx.strokeStyle = col;
    ctx.fillStyle = 'rgba(20,40,60,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + t * 0.5;
      const r = 14 * (0.9 + 0.1 * Math.sin(t * 4));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // Canon (laser)
    if (this.type === 'laser') {
      ctx.rotate(this.angle);
      ctx.fillStyle = col;
      ctx.fillRect(0, -2, 16, 4);
      // Ligne de visée vers la cible
      if (this._target && !this._target.dead) {
        ctx.strokeStyle = `rgba(102,204,255,${0.15 + 0.1 * Math.sin(t * 6)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        const targetDist = Math.hypot(this._target.x - this.x, this._target.y - this.y);
        ctx.lineTo(targetDist, 0);
        ctx.stroke();
      }
      ctx.rotate(-this.angle);
    } else if (this.type === 'shield') {
      // Anneau de protection
      ctx.strokeStyle = `rgba(136,255,221,${0.25 + 0.15 * Math.sin(t * 5)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
      // Compteur d'absorption restante
      ctx.fillStyle = '#88ffdd';
      ctx.font = '700 10px Orbitron, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.shieldAbsorb, 0, 0);
    } else if (this.type === 'repair') {
      // Croix médicale
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    }
    // Compte à rebours de durée
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Pose une tourelle. Type selon les modifieurs clavier détectés via game._archInputMod. */
function placeTurret(game, player) {
  if (!game._architectTurrets) game._architectTurrets = [];
  const turrets = game._architectTurrets;
  if (turrets.length >= TURRET_MAX) {
    turrets.shift();   // détruit la plus ancienne
  }
  const type = game._archInputMod || 'laser';
  turrets.push(new Turret(player.x, player.y - 20, type));
  return 1;
}

window.registerPremiumWeapon('architect', {
  onFire(wm, player, bullets, audio, game) {
    if (!game) return 0;
    game._architectCooldown = (game._architectCooldown ?? 0);
    if (game._architectCooldown > 0) return 0;
    game._architectCooldown = TURRET_PLACE_COOLDOWN;
    placeTurret(game, player);
    if (audio && audio.powerup) audio.powerup();
    return 1;
  },
  tick(dt, game) {
    if (!game._architectTurrets) game._architectTurrets = [];
    game._architectCooldown = Math.max(0, (game._architectCooldown || 0) - dt);
    for (let i = game._architectTurrets.length - 1; i >= 0; i--) {
      const t = game._architectTurrets[i];
      t.update(dt, game);
      if (t.dead) game._architectTurrets.splice(i, 1);
    }
  },
  draw(ctx, game) {
    if (!game._architectTurrets) return;
    for (const t of game._architectTurrets) t.draw(ctx);
  },
  getHUDInfo(wm, game) {
    const n = (game && game._architectTurrets) ? game._architectTurrets.length : 0;
    return { text: `${n}/${TURRET_MAX}`, color: '#66ccff', ratio: n / TURRET_MAX };
  },
});
