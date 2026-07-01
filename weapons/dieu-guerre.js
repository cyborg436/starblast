'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/dieu-guerre.js — DIEU DE LA GUERRE
   Tir de base = Blaster × 1.5 dégâts. Accumule de l'IRE à chaque kill.
   Alt (coût 100 IRE) = TRANSFORMATION 10 s : forme divine (2× taille,
   tir 8-directions, invincibilité, attraction, dévoration).
   IRE gain : 5 normal / 15 spécial / 50 boss (max 100)
───────────────────────────────────────────────────────────────────────── */

const WARGOD_IRE_MAX     = 100;
const WARGOD_FORM_DURATION = 10.0;
const WARGOD_ACTIVATE_COST = 100;

function _state(game) {
  if (!game._wargodState) {
    game._wargodState = {
      ire: 0,
      godForm: false,
      godTimer: 0,
      transformAnim: 0,   // 0..1.5 (durée transformation visuelle)
      fireTimer: 0,
      omniFireTimer: 0,
    };
  }
  return game._wargodState;
}

/** Appelé par le Game à chaque kill lorsque l'arme Wargod est équipée. */
window.wargodOnKill = function(game, enemy) {
  const st = _state(game);
  if (!enemy) return;
  let gain = 5;
  if (enemy.isBoss)         gain = 50;
  else if (enemy._infected || enemy.type === 'kamikaze' || enemy.type === 'armored'
        || enemy.type === 'healer'  || enemy.type === 'bomber')
    gain = 15;
  if (st.godForm) {
    // Dévoration : chaque kill restaure 1% de la durée
    st.godTimer = Math.min(WARGOD_FORM_DURATION, st.godTimer + WARGOD_FORM_DURATION * 0.01);
  } else {
    st.ire = Math.min(WARGOD_IRE_MAX, st.ire + gain);
  }
};

/** Alt : déclenche la transformation si 100 IRE dispo. */
window.wargodTryTransform = function(game) {
  const st = _state(game);
  if (st.godForm) return false;
  if (st.ire < WARGOD_ACTIVATE_COST) return false;
  st.ire = 0;
  st.godForm = true;
  st.godTimer = WARGOD_FORM_DURATION;
  st.transformAnim = 1.5;
  // Invincibilité totale pendant la forme
  if (game.player) {
    game.player.invincible = true;
    game.player.invTimer   = WARGOD_FORM_DURATION;
    game.player.blinkTimer = 0;
  }
  if (game.audio) game.audio.levelUp();
  if (game.ui)    game.ui.flash('#FFD700', 1.0);
  return true;
};

window.registerPremiumWeapon('wargod', {
  onFire(wm, player, bullets, audio, game) {
    const st = _state(game);
    // En forme Dieu : tir omnidirectionnel 8 directions
    if (st.godForm) {
      const spd = CFG.BULLET_SPEED * 1.1;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 - Math.PI / 2;
        const b = new Bullet(player.x, player.y, Math.cos(a) * spd, Math.sin(a) * spd, '#ffee88', true, '');
        b.damage = 2;
        b.isWargodShot = true;
        bullets.push(b);
      }
      if (audio && audio.shoot) audio.shoot();
      return 8;
    }
    // Forme normale : Blaster amélioré (dégâts 1.5)
    const px = player.x, py = player.y - player.h * 0.46;
    const color = player.bulletColor || '#ffcc44';
    const b = new Bullet(px, py, 0, -CFG.BULLET_SPEED, color, true, player.laserType);
    b.damage = 1.5;
    bullets.push(b);
    if (audio && audio.shoot) audio.shoot();
    return 1;
  },
  onAlt(wm, game) {
    return window.wargodTryTransform(game);
  },
  tick(dt, game) {
    const st = _state(game);
    if (st.transformAnim > 0) st.transformAnim = Math.max(0, st.transformAnim - dt);
    if (st.godForm) {
      st.godTimer -= dt;
      // Attraction des ennemis vers le joueur
      for (const e of game.enemies) {
        if (e.dead || e.dying || e.isBoss) continue;
        const dx = game.player.x - e.x, dy = game.player.y - e.y;
        const d  = Math.hypot(dx, dy) || 1;
        if (d < 350) {
          e.x += (dx / d) * 80 * dt;
          e.y += (dy / d) * 80 * dt;
        }
      }
      // Tir omnidirectionnel continu
      st.omniFireTimer -= dt;
      if (st.omniFireTimer <= 0) {
        st.omniFireTimer = 0.18;
        // Emit via onFire directement
        const wm2 = game.weapons;
        const hooks = window.PREMIUM_WEAPON_HOOKS['wargod'];
        if (hooks && hooks.onFire) hooks.onFire(wm2, game.player, game.playerBullets, game.audio, game);
      }
      // Fin de forme divine
      if (st.godTimer <= 0) {
        st.godForm = false;
        st.godTimer = 0;
        // Onde de fin : 50 dégâts à tous les ennemis à l'écran
        for (const e of game.enemies) {
          if (e.dead || e.dying) continue;
          const killed = e.hit && e.hit(50);
          if (killed && !e.isBoss && !e.dead) e.dead = true;
        }
        spawnExplosion(game.particles, game.player.x, game.player.y, '#FFD700', 40, true);
        game._triggerShake && game._triggerShake(0.5, 12);
        if (game.ui) game.ui.flash('#FFD700', 0.9);
        // Fin invincibilité (si non déjà expirée)
        if (game.player && game.player.invTimer > 0.1) game.player.invTimer = 0.1;
      }
    }
  },
  draw(ctx, game) {
    const st = _state(game);
    if (!game.player) return;
    // Aura d'IRE quand la barre monte (forme normale)
    if (!st.godForm && st.ire > 0) {
      const ratio = st.ire / WARGOD_IRE_MAX;
      ctx.save();
      ctx.strokeStyle = `rgba(255,${100 + 100 * ratio},0,${0.25 + 0.3 * ratio})`;
      ctx.lineWidth = 2 + 2 * ratio;
      ctx.beginPath();
      ctx.arc(game.player.x, game.player.y, game.player.w * 0.7 + 4 * ratio, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Forme Dieu : overlay rouge sang sur le fond + aura dorée massive
    if (st.godForm) {
      // Overlay rouge
      const t = Date.now() * 0.003;
      ctx.save();
      ctx.fillStyle = `rgba(100,0,0,${0.14 + 0.06 * Math.sin(t)})`;
      ctx.fillRect(0, 0, game.W, game.H);
      // Aura dorée autour du joueur (grande — 2× taille)
      const cx = game.player.x, cy = game.player.y;
      const auraR = game.player.w * 1.6 * (1 + 0.08 * Math.sin(t * 3));
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraR);
      g.addColorStop(0, 'rgba(255,215,0,0.6)');
      g.addColorStop(0.5, 'rgba(255,140,20,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
      // Ailes d'énergie
      ctx.strokeStyle = `rgba(255,215,0,${0.7 + 0.3 * Math.sin(t * 5)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 20;
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + sign * 40, cy - 30, cx + sign * 55 + Math.sin(t * 4) * 6, cy - 5);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // Yeux rouges
      ctx.fillStyle = '#ff2244';
      ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    // Transformation flash
    if (st.transformAnim > 0) {
      const a = st.transformAnim / 1.5;
      ctx.save();
      ctx.fillStyle = `rgba(255,215,0,${a * 0.4})`;
      ctx.fillRect(0, 0, game.W, game.H);
      ctx.restore();
    }
  },
  getHUDInfo(wm, game) {
    const st = _state(game);
    if (st.godForm) {
      return { text: `DIEU ${st.godTimer.toFixed(1)}s`, color: '#FFD700', ratio: st.godTimer / WARGOD_FORM_DURATION };
    }
    return { text: `IRE ${Math.floor(st.ire)}`, color: '#ff2244', ratio: st.ire / WARGOD_IRE_MAX };
  },
});
