'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/singularite.js — SINGULARITÉ NOIRE
   Chaque tir crée un micro trou noir à l'impact (3 s de vie).
   Aspire ennemis + balles ennemies. Fusion si 2 trous noirs se touchent.
   Explosion finale : 10 × nb ennemis aspirés.
───────────────────────────────────────────────────────────────────────── */

const BH_LIFE       = 3.0;
const BH_RADIUS     = 120;
const BH_DPS        = 5;         // dégâts / s aux ennemis aspirés
const BH_MAX        = 3;
const BH_PULL_FORCE = 220;

class BlackHole {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.life = BH_LIFE;
    this.radius = BH_RADIUS;
    this.absorbed = 0;
    this.dead = false;
    this._t = 0;
    this._dmgAccum = 0;
  }
  update(dt, game) {
    this._t += dt;
    this.life -= dt;
    this._dmgAccum += dt;
    // Attire les ennemis + inflige des dégâts continus
    for (const e of game.enemies) {
      if (e.dead || e.dying) continue;
      const dx = this.x - e.x, dy = this.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) continue;
      // Force d'attraction croissante vers le centre
      const strength = BH_PULL_FORCE * (1 - d / this.radius) + 40;
      if (d > 5) {
        e.x += (dx / d) * strength * dt;
        e.y += (dy / d) * strength * dt;
      }
      // Dégâts par palier
      if (this._dmgAccum >= 1) {
        const killed = e.hit && e.hit(BH_DPS);
        if (killed && !e.isBoss && !e.dead) { e.dead = true; this.absorbed++; }
      }
    }
    // Attire les balles ennemies (les annule)
    for (const eb of game.enemyBullets) {
      if (eb.dead) continue;
      const dx = this.x - eb.x, dy = this.y - eb.y;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) continue;
      const s = BH_PULL_FORCE * 1.5;
      if (d > 3) {
        eb.x += (dx / d) * s * dt;
        eb.y += (dy / d) * s * dt;
      }
      if (d < 15) { eb.dead = true; this.absorbed++; }
    }
    if (this._dmgAccum >= 1) this._dmgAccum = 0;

    // Explosion en fin de vie
    if (this.life <= 0 && !this.dead) {
      this._explode(game);
      this.dead = true;
    }
  }
  _explode(game) {
    const dmg = 10 * Math.max(1, this.absorbed);
    spawnExplosion(game.particles, this.x, this.y, '#ffffff', 30, true);
    spawnBoom(game.particles, this.x, this.y, 'heavy', (d, i) => game._triggerShake(d, i));
    // Zone AoE
    const r2 = (this.radius * 1.1) * (this.radius * 1.1);
    for (const e of game.enemies) {
      if (e.dead || e.dying) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      if (dx * dx + dy * dy > r2) continue;
      const killed = e.hit && e.hit(dmg);
      if (killed && !e.isBoss && !e.dead) e.dead = true;
    }
    // Onde de choc visuelle
    game._triggerShake && game._triggerShake(0.2, 6);
  }
  draw(ctx) {
    ctx.save();
    // Distorsion : gradient noir avec anneau blanc/violet
    const p = Math.max(0.1, this.life / BH_LIFE);
    const t = this._t;
    // Halo violet
    const g1 = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, this.radius);
    g1.addColorStop(0, `rgba(0,0,0,${p})`);
    g1.addColorStop(0.4, `rgba(60,20,120,${p * 0.55})`);
    g1.addColorStop(0.8, `rgba(150,80,220,${p * 0.15})`);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    // Cœur noir
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(this.x, this.y, 18 + Math.sin(t * 6) * 3, 0, Math.PI * 2); ctx.fill();
    // Anneau blanc/violet
    ctx.strokeStyle = `rgba(200,140,255,${0.8 * p})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(this.x, this.y, 26 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Compteur d'absorption
    if (this.absorbed > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px Orbitron, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.absorbed, this.x, this.y);
    }
    ctx.restore();
  }
}

/** Vérifie les fusions entre trous noirs. */
function mergeBlackHoles(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      const a = list[i], b = list[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < (a.radius + b.radius) * 0.4) {
        // Fusion
        b.radius = Math.min(200, (a.radius + b.radius) * 0.7);
        b.absorbed += a.absorbed;
        b.life = Math.max(a.life, b.life);
        list.splice(i, 1);
        break;
      }
    }
  }
}

class BlackHoleBullet extends Bullet {
  constructor(x, y) {
    super(x, y, 0, -CFG.BULLET_SPEED * 1.1, '#000', true, '');
    this.w = 10; this.h = 12;
    this.damage = 0;
    this.isBlackHoleBullet = true;
  }
  draw(ctx) {
    ctx.save();
    const t = Date.now() * 0.02;
    ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(180,120,255,${0.7 + 0.3 * Math.sin(t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

window.registerPremiumWeapon('singularity', {
  onFire(wm, player, bullets, audio, game) {
    if (!game._blackHoles) game._blackHoles = [];
    // Max 3 simultanés — attention : compté au moment de la CRÉATION (pas du tir)
    // On tire toujours mais le trou noir n'apparaît qu'à l'impact
    const px = player.x, py = player.y - player.h * 0.46;
    bullets.push(new BlackHoleBullet(px, py));
    if (audio && audio.shoot) audio.shoot();
    return 1;
  },
  onHit(bullet, enemy, game) {
    if (!bullet.isBlackHoleBullet) return;
    bullet.dead = true;
    if (!game._blackHoles) game._blackHoles = [];
    // Limite : max 3 trous noirs
    if (game._blackHoles.length >= BH_MAX) {
      // Détruit le plus ancien
      const oldest = game._blackHoles.shift();
      if (oldest) { oldest._explode(game); oldest.dead = true; }
    }
    game._blackHoles.push(new BlackHole(bullet.x, bullet.y));
    if (enemy && !enemy.isBoss) enemy.hit && enemy.hit(1);
  },
  tick(dt, game) {
    if (!game._blackHoles) game._blackHoles = [];
    for (let i = game._blackHoles.length - 1; i >= 0; i--) {
      const bh = game._blackHoles[i];
      bh.update(dt, game);
      if (bh.dead) game._blackHoles.splice(i, 1);
    }
    mergeBlackHoles(game._blackHoles);
  },
  draw(ctx, game) {
    if (!game._blackHoles) return;
    for (const bh of game._blackHoles) bh.draw(ctx);
  },
  getHUDInfo(wm, game) {
    const n = (game && game._blackHoles) ? game._blackHoles.length : 0;
    return { text: `${n}/${BH_MAX}`, color: '#aa66ff', ratio: n / BH_MAX };
  },
});
