'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/echo-quantique.js — ÉCHO QUANTIQUE
   Alt = crée un fantôme du vaisseau qui rejoue vos actions avec 1.5s de délai.
   Max 2 fantômes (délais 1.5s et 3.0s). 70% de puissance de tir.
   Chaque fantôme absorbe 5 tirs ennemis avant de disparaître.
───────────────────────────────────────────────────────────────────────── */

const GHOST_MAX          = 2;
const GHOST_DELAY_BASE   = 1.5;   // 1er fantôme
const GHOST_HP           = 5;
const GHOST_COOLDOWN     = 5.0;
const GHOST_RECORD_MAX_S = 6.5;   // taille max du buffer d'actions (au-delà : trim)

/**
 * Fantôme quantique. Enregistre son propre buffer d'actions (position, fire).
 */
class QuantumGhost {
  constructor(delay) {
    this.delay = delay;        // décalage temporel (1.5 ou 3.0)
    this.hp = GHOST_HP;
    this.dead = false;
    this.x = 0; this.y = 0;
  }
  update(dt, game, recordBuffer) {
    if (this.dead) return;
    // Cherche l'échantillon à t = now - delay
    const targetT = game._echoT - this.delay;
    let idx = 0;
    for (let i = 0; i < recordBuffer.length; i++) {
      if (recordBuffer[i].t >= targetT) { idx = i; break; }
    }
    const sample = recordBuffer[idx] || recordBuffer[recordBuffer.length - 1];
    if (!sample) return;
    this.x = sample.x; this.y = sample.y;
    // Tir : à chaque échantillon "fire=true" et que ce n'est pas déjà tiré
    if (sample.fired && !sample.__ghostFired) {
      sample.__ghostFired = true;   // marqueur pour empêcher double tir
      // 70% des dégâts réels
      const b = new Bullet(this.x, sample.py, 0, -CFG.BULLET_SPEED, '#88ccff', true, '');
      b.damage = 0.7 * (sample.damage || 1);
      b.isGhostShot = true;
      game.playerBullets.push(b);
    }
    // Prend un tir si dans le rayon d'une balle ennemie ? Simplement : on décrémente hp quand touché.
  }
  hit() {
    this.hp--;
    if (this.hp <= 0) this.dead = true;
  }
  draw(ctx, game) {
    if (this.dead) return;
    const player = game.player;
    if (!player) return;
    ctx.save();
    ctx.globalAlpha = 0.42;
    // Traînée entre le vrai vaisseau et le fantôme
    ctx.strokeStyle = 'rgba(100,200,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Rendu fantôme avec teinte bleue
    ctx.translate(this.x, this.y);
    ctx.filter = 'hue-rotate(180deg) brightness(1.4)';
    const renderer = SKIN_RENDERERS[player.skin] || SKIN_RENDERERS.starter;
    renderer(ctx, player.w, player.h);
    ctx.filter = 'none';
    // Barre HP du fantôme
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-15, -player.h * 0.6 - 4, 30, 3);
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(-15, -player.h * 0.6 - 4, 30 * (this.hp / GHOST_HP), 3);
    ctx.restore();
  }
}

function _state(game) {
  if (!game._echoState) {
    game._echoState = {
      recordBuffer: [],      // [{ t, x, y, py, fired, damage }, ...]
      ghosts: [],
      cooldown: 0,
    };
    game._echoT = 0;
  }
  return game._echoState;
}

/** Alt : crée un fantôme quantique (jusqu'à 2). */
window.echoQuantiqueSpawnGhost = function(game) {
  const st = _state(game);
  if (st.ghosts.length >= GHOST_MAX) return false;
  if (st.cooldown > 0) return false;
  const delay = GHOST_DELAY_BASE * (st.ghosts.length + 1);
  st.ghosts.push(new QuantumGhost(delay));
  st.cooldown = GHOST_COOLDOWN;
  if (game.audio) game.audio.powerup();
  if (game.ui) game.ui.flash('#88ccff', 0.5);
  return true;
};

window.registerPremiumWeapon('echo', {
  onFire(wm, player, bullets, audio, game) {
    // Tir standard type Blaster
    const px = player.x, py = player.y - player.h * 0.46;
    const color = player.bulletColor || '#ffffff';
    const b = new Bullet(px, py, 0, -CFG.BULLET_SPEED, color, true, player.laserType);
    b.damage = 1;
    bullets.push(b);
    // Enregistre le tir dans le buffer pour les fantômes
    const st = _state(game);
    if (st.recordBuffer.length > 0) {
      st.recordBuffer[st.recordBuffer.length - 1].fired = true;
      st.recordBuffer[st.recordBuffer.length - 1].damage = 1;
    }
    if (audio && audio.shoot) audio.shoot();
    return 1;
  },
  onAlt(wm, game) {
    return window.echoQuantiqueSpawnGhost(game);
  },
  tick(dt, game) {
    if (!game.player) return;
    const st = _state(game);
    game._echoT = (game._echoT || 0) + dt;
    st.cooldown = Math.max(0, st.cooldown - dt);
    // Enregistre la position actuelle du joueur (60 Hz max, buffer léger)
    st.recordBuffer.push({
      t: game._echoT,
      x: game.player.x,
      y: game.player.y,
      py: game.player.y - game.player.h * 0.46,
      fired: false,
    });
    // Purge le buffer au-delà de GHOST_RECORD_MAX_S
    const cutoff = game._echoT - GHOST_RECORD_MAX_S;
    while (st.recordBuffer.length > 0 && st.recordBuffer[0].t < cutoff) st.recordBuffer.shift();
    // Update ghosts
    for (let i = st.ghosts.length - 1; i >= 0; i--) {
      const g = st.ghosts[i];
      g.update(dt, game, st.recordBuffer);
      // Un tir ennemi proche → ghost hit
      for (const eb of game.enemyBullets) {
        if (eb.dead) continue;
        if (Math.hypot(eb.x - g.x, eb.y - g.y) < 20) {
          eb.dead = true;
          g.hit();
        }
      }
      if (g.dead) {
        spawnExplosion(game.particles, g.x, g.y, '#88ccff', 14);
        st.ghosts.splice(i, 1);
      }
    }
  },
  draw(ctx, game) {
    const st = _state(game);
    for (const g of st.ghosts) g.draw(ctx, game);
  },
  getHUDInfo(wm, game) {
    const st = _state(game);
    const n = st.ghosts ? st.ghosts.length : 0;
    if (st.cooldown > 0) return { text: 'CD ' + st.cooldown.toFixed(1), color: '#88ccff', ratio: 1 - st.cooldown / GHOST_COOLDOWN };
    return { text: `${n}/${GHOST_MAX}`, color: '#88ccff', ratio: n / GHOST_MAX };
  },
});
