'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   weapons/miroir-temporel.js — MIROIR TEMPOREL
   Tir de base = Blaster. Enregistre tous les tirs des 6 dernières secondes.
   Alt = REPLAY : rejoue les 6s en 2s (×3) depuis la position actuelle.
   Cooldown replay : 8s. Tirs pendant replay = teinte dorée.
───────────────────────────────────────────────────────────────────────── */

const MIRROR_RECORD_DURATION = 6.0;
const MIRROR_REPLAY_DURATION = 2.0;
const MIRROR_COOLDOWN        = 8.0;

class MirrorTimeState {
  constructor() {
    this.recording = [];      // [{ t, dx, dy, speed, damage, color, laserType }, ...]
    this.replaying = false;
    this.replayT   = 0;
    this.replayIdx = 0;
    this.cooldown  = 0;
    this.t         = 0;       // horloge cumulée
  }
  reset() {
    this.recording.length = 0;
    this.replaying = false;
    this.replayT = 0; this.replayIdx = 0;
    this.cooldown = 0; this.t = 0;
  }
}

/** Retourne l'état de l'arme (créé à la volée sur le WeaponManager). */
function _state(wm) {
  if (!wm._mirrorState) wm._mirrorState = new MirrorTimeState();
  return wm._mirrorState;
}

/** Alt : déclenche le replay si dispo. */
window.mirrorTemporelTryReplay = function(wm, game) {
  const st = _state(wm);
  if (st.replaying || st.cooldown > 0 || st.recording.length === 0) return false;
  st.replaying = true;
  st.replayT   = 0;
  st.replayIdx = 0;
  if (game && game.ui) game.ui.flash('#ffd700', 0.5);
  return true;
};

window.registerPremiumWeapon('mirror-time', {
  onFire(wm, player, bullets, audio, game) {
    const st = _state(wm);
    const px = player.x, py = player.y - player.h * 0.46;
    const color = player.bulletColor || '#ffffff';
    // Tir normal (Blaster)
    const b = new Bullet(px, py, 0, -CFG.BULLET_SPEED, color, true, player.laserType);
    b.damage = 1;
    b.isMirrorTime = true;
    bullets.push(b);
    // Enregistre le tir (position relative au vaisseau : 0, -offset)
    st.recording.push({ t: st.t, ox: 0, oy: -player.h * 0.46, damage: 1, color });
    if (audio && audio.shoot) audio.shoot();
    return 1;
  },
  tick(dt, game) {
    if (!game || !game.weapons) return;
    const wm = game.weapons;
    const st = _state(wm);
    st.t += dt;
    if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
    // Purge les enregistrements > 6s
    const cutoff = st.t - MIRROR_RECORD_DURATION;
    while (st.recording.length > 0 && st.recording[0].t < cutoff) st.recording.shift();
    // Replay en cours ?
    if (st.replaying) {
      st.replayT += dt;
      // Compresse toute la fenêtre d'enregistrement dans MIRROR_REPLAY_DURATION
      const progress = st.replayT / MIRROR_REPLAY_DURATION;
      const targetIdx = Math.floor(progress * st.recording.length);
      while (st.replayIdx < targetIdx && st.replayIdx < st.recording.length) {
        const shot = st.recording[st.replayIdx++];
        // Tire depuis la position actuelle du joueur avec teinte dorée
        const player = game.player;
        if (player) {
          const b = new Bullet(player.x + shot.ox, player.y + shot.oy, 0, -CFG.BULLET_SPEED, '#ffd700', true, '');
          b.damage = shot.damage;
          b.isMirrorReplay = true;
          game.playerBullets.push(b);
        }
      }
      if (st.replayT >= MIRROR_REPLAY_DURATION) {
        st.replaying = false;
        st.cooldown  = MIRROR_COOLDOWN;
        st.replayIdx = 0; st.replayT = 0;
      }
    }
  },
  onAlt(wm, game) {
    return window.mirrorTemporelTryReplay(wm, game);
  },
  getHUDInfo(wm) {
    const st = _state(wm);
    if (st.replaying) return { text: 'REPLAY', color: '#ffd700', ratio: 1 - st.replayT / MIRROR_REPLAY_DURATION };
    if (st.cooldown > 0) return { text: 'CD ' + st.cooldown.toFixed(1), color: '#8888ff', ratio: 1 - st.cooldown / MIRROR_COOLDOWN };
    return { text: `${st.recording.length} shots`, color: '#ffffff', ratio: Math.min(1, st.recording.length / 30) };
  },
});
