'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   bossrush.js  —  Mode Boss Rush StarBlast
   - 10 boss en séquence, tous nouveaux, Canvas pur
   - BossRushManager : gestion de l'enchaînement + intermission 5s
   - Doit être chargé APRÈS game.js (extends BossBase)
───────────────────────────────────────────────────────────────────────── */

// ── Constantes mode Boss Rush ───────────────────────────────────────
const BR_INTERMISSION_DURATION = 5.0;
const BR_STARTING_LIVES        = 5;
const BR_VICTORY_REWARD_COINS  = 10000;
const BR_VICTORY_REWARD_XP     = 5000;

// ─────────────────────────────────────────────────────────────────────
// BOSS 1 — SENTINEL — Cube rotatif gris à 4 canons
// ─────────────────────────────────────────────────────────────────────
class BRSentinel extends BossBase {
  constructor(x, y, W) {
    super(x, y, 300, W);
    this.bossName = 'SENTINEL';
    this.w = 130; this.h = 130;
    this.color = '#aaaaaa';
    this.score = 1500;
    this.vx = 60;
    this.targetY = 140;
    this.crossTimer = 2.0;
    this.rotation = 0;
  }
  _move(dt, W) {
    this.x += this.vx * dt;
    if (this.x < this.w / 2 + 16) { this.x = this.w / 2 + 16; this.vx = Math.abs(this.vx); }
    if (this.x > W - this.w / 2 - 16) { this.x = W - this.w / 2 - 16; this.vx = -Math.abs(this.vx); }
    this.y += (this.targetY - this.y) * 1.2 * dt;
    this.rotation += dt * 0.4;
  }
  _attack(dt, enemyBullets) {
    this.crossTimer -= dt;
    if (this.crossTimer <= 0) {
      this.crossTimer = 2.0;
      const spd = CFG.ENEMY_BULLET_SPEED * 1.1;
      // Tir en croix : haut/bas/gauche/droite (selon rotation)
      for (let i = 0; i < 4; i++) {
        const a = this.rotation + i * Math.PI / 2;
        enemyBullets.push(new Bullet(this.x, this.y,
          Math.cos(a) * spd, Math.sin(a) * spd, '#ffeebb', false));
      }
    }
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    ctx.rotate(this.rotation);
    // Cube principal
    const g = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
    g.addColorStop(0, '#5c6470'); g.addColorStop(0.5, '#9aa3b0'); g.addColorStop(1, '#3a4250');
    ctx.fillStyle = g;
    ctx.shadowColor = '#cccccc'; ctx.shadowBlur = 16;
    ctx.fillRect(-w*0.4, -h*0.4, w*0.8, h*0.8);
    ctx.strokeStyle = '#dde'; ctx.lineWidth = 2;
    ctx.strokeRect(-w*0.4, -h*0.4, w*0.8, h*0.8);
    // Canons aux 4 coins
    ctx.fillStyle = '#222';
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([cx,cy]) => {
      ctx.fillRect(cx*w*0.4 - 6, cy*h*0.4 - 6, 12, 12);
      ctx.fillStyle = '#ff4422';
      ctx.beginPath(); ctx.arc(cx*w*0.4, cy*h*0.4, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#222';
    });
    // Noyau central pulsant
    ctx.shadowColor = '#ff6644'; ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(255,80,40,${0.7 + 0.3 * Math.sin(this.t * 5)})`;
    ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(this.t * 6) * 3, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 2 — HYDRA — 3 têtes de canon indépendantes
// ─────────────────────────────────────────────────────────────────────
class BRHydra extends BossBase {
  constructor(x, y, W) {
    super(x, y, 500, W);
    this.bossName = 'HYDRA';
    this.w = 170; this.h = 100;
    this.color = '#22cc77';
    this.score = 2500;
    this.heads = [
      { offX: -55, hp: 100, alive: true, timer: 1.5 },
      { offX:   0, hp: 100, alive: true, timer: 1.0 },
      { offX:  55, hp: 100, alive: true, timer: 1.7 },
    ];
    this.baseY = 130;
  }
  hit(damage = 1) {
    if (this.dying) return false;
    // Cible la tête vivante la plus proche du tir
    const alive = this.heads.filter(h => h.alive);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      target.hp -= damage;
      if (target.hp <= 0) {
        target.alive = false;
        target.hp = 0;
      }
    }
    this.hp = Math.max(0, this.hp - damage);
    this.flashTimer = 0.08;
    if (this.hp <= 0) {
      this.dying = true;
      this.deathTimer = this.deathDuration;
    }
    return false;
  }
  _move(dt, W) {
    this.x = W / 2 + Math.sin(this.t * 0.9) * (W * 0.32);
    this.y = this.baseY + Math.cos(this.t * 1.5) * 18;
  }
  _attack(dt, enemyBullets, player) {
    const aliveCount = this.heads.filter(h => h.alive).length;
    const speedMult = aliveCount < 3 ? 1.5 : 1.0;
    this.heads.forEach(head => {
      if (!head.alive) return;
      head.timer -= dt * speedMult;
      if (head.timer <= 0) {
        head.timer = 1.5;
        const hx = this.x + head.offX;
        const hy = this.y + this.h * 0.2;
        let vx = 0, vy = CFG.ENEMY_BULLET_SPEED;
        if (player) {
          const dx = player.x - hx, dy = player.y - hy;
          const d = Math.hypot(dx, dy) || 1;
          vx = (dx / d) * CFG.ENEMY_BULLET_SPEED;
          vy = (dy / d) * CFG.ENEMY_BULLET_SPEED;
        }
        enemyBullets.push(new Bullet(hx, hy, vx, vy, '#33ff88', false));
      }
    });
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    // Corps central
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#1a6633'); g.addColorStop(1, '#0a3318');
    ctx.fillStyle = g;
    ctx.shadowColor = '#33ff88'; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-w*0.5, h*0.4); ctx.lineTo(w*0.5, h*0.4);
    ctx.lineTo(w*0.35, -h*0.1); ctx.lineTo(-w*0.35, -h*0.1);
    ctx.closePath(); ctx.fill();
    // 3 têtes
    this.heads.forEach(head => {
      const hx = head.offX;
      if (!head.alive) {
        // Moignon
        ctx.fillStyle = '#220a0a';
        ctx.fillRect(hx - 8, -h*0.1, 16, 8);
        return;
      }
      // Cou
      ctx.fillStyle = '#208844';
      ctx.fillRect(hx - 8, -h*0.4, 16, h*0.3);
      // Tête (losange)
      ctx.fillStyle = '#2faa55';
      ctx.beginPath();
      ctx.moveTo(hx, -h*0.55); ctx.lineTo(hx + 18, -h*0.35);
      ctx.lineTo(hx, -h*0.15); ctx.lineTo(hx - 18, -h*0.35);
      ctx.closePath(); ctx.fill();
      // Œil rouge
      ctx.fillStyle = '#ff2244';
      ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(hx, -h*0.35, 4, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // Barre PV de la tête
      const ratio = head.hp / 100;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(hx - 14, -h*0.62, 28, 3);
      ctx.fillStyle = ratio > 0.5 ? '#33ff88' : '#ffaa33';
      ctx.fillRect(hx - 14, -h*0.62, 28 * ratio, 3);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 3 — PHANTOM — Téléportation + invincible en phase fantôme
// ─────────────────────────────────────────────────────────────────────
class BRPhantom extends BossBase {
  constructor(x, y, W) {
    super(x, y, 700, W);
    this.bossName = 'PHANTOM';
    this.w = 130; this.h = 90;
    this.color = '#bb88ff';
    this.score = 3500;
    this.phaseTimer = 5.0;
    this.isGhost = false;
    this.ghostDuration = 3.0;
    this.fireTimer = 2.0;
    this.teleportTimer = 0.8;
  }
  hit(damage = 1) {
    if (this.isGhost || this.dying) return false;
    return super.hit(damage);
  }
  _move(dt, W, H) {
    if (this.isGhost) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 0.8;
        this.x = 60 + Math.random() * (W - 120);
        this.y = 90 + Math.random() * 220;
      }
    } else {
      this.x += Math.sin(this.t * 1.4) * 80 * dt;
      this.y = 140 + Math.cos(this.t * 0.8) * 20;
      this.x = clamp(this.x, this.w/2 + 20, W - this.w/2 - 20);
    }
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      this.isGhost = !this.isGhost;
      this.phaseTimer = this.isGhost ? this.ghostDuration : 5.0;
    }
  }
  _attack(dt, enemyBullets) {
    if (this.isGhost) return;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 2.0;
      // Salve circulaire 8 projectiles
      const spd = CFG.ENEMY_BULLET_SPEED * 0.9;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        enemyBullets.push(new Bullet(this.x, this.y,
          Math.cos(a) * spd, Math.sin(a) * spd, '#dd99ff', false));
      }
    }
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    ctx.globalAlpha *= this.isGhost ? 0.5 : 1.0;
    // Silhouette spectrale
    ctx.shadowColor = '#bb88ff'; ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(0, 0, 5, 0, 0, w/2);
    g.addColorStop(0, '#ddaaff'); g.addColorStop(0.7, '#5522aa'); g.addColorStop(1, 'rgba(40,0,80,0.6)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h*0.55);
    ctx.bezierCurveTo(w*0.5, -h*0.4, w*0.6, h*0.2, w*0.2, h*0.5);
    ctx.lineTo(-w*0.2, h*0.5);
    ctx.bezierCurveTo(-w*0.6, h*0.2, -w*0.5, -h*0.4, 0, -h*0.55);
    ctx.closePath(); ctx.fill();
    // Yeux
    ctx.fillStyle = this.isGhost ? '#ffffff' : '#ff2266';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(-12, -10, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 12, -10, 5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    if (this.isGhost) {
      // Marqueur "invincible"
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, w*0.6, 0, Math.PI*2); ctx.stroke();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 4 — LEVIATHAN — Serpent à 5 segments
// ─────────────────────────────────────────────────────────────────────
class BRLeviathan extends BossBase {
  constructor(x, y, W) {
    super(x, y, 1000, W);
    this.bossName = 'LEVIATHAN';
    this.w = 100; this.h = 80;
    this.color = '#ff8833';
    this.score = 5000;
    this.segCount = 5;
    this.segments = [];
    for (let i = 0; i < this.segCount; i++) {
      this.segments.push({ x, y: y - i * 36, dx: 0, dy: 0 });
    }
    this.fireTimer = 1.0;
  }
  get hitbox() {
    return { x: this.x - 26, y: this.y - 26, w: 52, h: 52 };
  }
  _move(dt, W, H) {
    // Ondulation serpentine, traverse l'écran
    this.x = W/2 + Math.sin(this.t * 0.7) * (W * 0.4);
    this.y = 160 + Math.sin(this.t * 1.3) * 80;
    // Segments suivent avec délai
    this.segments[0].x = this.x; this.segments[0].y = this.y;
    for (let i = 1; i < this.segCount; i++) {
      const prev = this.segments[i-1];
      const cur  = this.segments[i];
      const dx = prev.x - cur.x, dy = prev.y - cur.y;
      const d = Math.hypot(dx, dy);
      const target = 34;
      if (d > target) {
        cur.x += (dx / d) * (d - target);
        cur.y += (dy / d) * (d - target);
      }
    }
  }
  _attack(dt, enemyBullets, player) {
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 1.0;
      // Crachat depuis la tête vers le joueur
      let vx = 0, vy = CFG.ENEMY_BULLET_SPEED;
      if (player) {
        const dx = player.x - this.x, dy = player.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        vx = (dx / d) * CFG.ENEMY_BULLET_SPEED * 1.1;
        vy = (dy / d) * CFG.ENEMY_BULLET_SPEED * 1.1;
      }
      enemyBullets.push(new Bullet(this.x, this.y, vx, vy, '#ffaa44', false));
    }
  }
  // Le corps fait des dégâts au contact : ajoute des hitbox de segments
  bodyHitboxes() {
    return this.segments.map(s => ({ x: s.x - 22, y: s.y - 22, w: 44, h: 44 }));
  }
  // La queue détruit les balles joueur
  tailHitbox() {
    const t = this.segments[this.segCount - 1];
    return { x: t.x - 26, y: t.y - 26, w: 52, h: 52 };
  }
  draw(ctx) {
    // Override pour dessiner tous les segments
    if (this.dying) {
      const p = Math.max(0, this.deathTimer / this.deathDuration);
      ctx.save(); ctx.globalAlpha = p * p;
    }
    // Segments du dernier au premier
    for (let i = this.segCount - 1; i >= 0; i--) {
      const s = this.segments[i];
      const size = i === 0 ? 32 : 26 - i * 2;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (this.flashTimer > 0) ctx.filter = 'brightness(3)';
      // Segment
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, size);
      g.addColorStop(0, i === 0 ? '#ffcc66' : '#cc7733');
      g.addColorStop(0.7, '#883311');
      g.addColorStop(1, '#220800');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ff8833'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
      // Épines
      ctx.fillStyle = '#552200';
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + this.t * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size, Math.sin(a) * size);
        ctx.lineTo(Math.cos(a) * size * 1.3, Math.sin(a) * size * 1.3);
        ctx.lineTo(Math.cos(a + 0.3) * size, Math.sin(a + 0.3) * size);
        ctx.closePath(); ctx.fill();
      }
      // Yeux sur la tête
      if (i === 0) {
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(-9, -6, 4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( 9, -6, 4, 0, Math.PI*2); ctx.fill();
      }
      ctx.filter = 'none'; ctx.shadowBlur = 0;
      ctx.restore();
    }
    if (this.dying) ctx.restore();
    if (!this.dying) this._drawHPBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 5 — NOVA — Étoile à 6 branches, 2 phases
// ─────────────────────────────────────────────────────────────────────
class BRNova extends BossBase {
  constructor(x, y, W) {
    super(x, y, 1200, W);
    this.bossName = 'NOVA';
    this.w = 160; this.h = 160;
    this.color = '#ffee88';
    this.score = 6000;
    this.phase = 1;
    this.spinTimer = 0;
    this.fireTimer = 0.4;
    this.superNovaTimer = 4.0;
    this.empTimer = 8.0;
    this.empActive = 0;
    this.entrance = 1.0;  // flash blanc à l'apparition
  }
  isEMPActive() { return this.empActive > 0; }
  _move(dt, W) {
    this.x = W/2 + Math.sin(this.t * 0.5) * (W * 0.2);
    this.y = 150 + Math.cos(this.t * 0.4) * 18;
    this.spinTimer += dt;
    if (this.entrance > 0) this.entrance -= dt;
    if (this.empActive > 0) this.empActive -= dt;
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) this.phase = 2;
  }
  _attack(dt, enemyBullets) {
    if (this.phase === 1) {
      // Lasers en rotation depuis chaque branche
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 0.55;
        const spd = CFG.ENEMY_BULLET_SPEED * 0.85;
        for (let i = 0; i < 6; i++) {
          const a = this.spinTimer * 1.1 + i * Math.PI / 3;
          enemyBullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * spd, Math.sin(a) * spd, '#ffee88', false));
        }
      }
    } else {
      // Phase 2 : SUPERNOVA 36 directions toutes les 4s
      this.superNovaTimer -= dt;
      if (this.superNovaTimer <= 0) {
        this.superNovaTimer = 4.0;
        const spd = CFG.ENEMY_BULLET_SPEED * 1.0;
        for (let i = 0; i < 36; i++) {
          const a = i * Math.PI * 2 / 36;
          enemyBullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * spd, Math.sin(a) * spd, '#ffffff', false));
        }
      }
    }
    // EMP toutes les 8s
    this.empTimer -= dt;
    if (this.empTimer <= 0) {
      this.empTimer = 8.0;
      this.empActive = 2.0;
    }
  }
  _drawBody(ctx) {
    const w = this.w;
    // Flash d'apparition
    if (this.entrance > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.entrance})`;
      ctx.fillRect(-this.W, -this.W, this.W * 2, this.W * 2);
    }
    // Halo
    ctx.shadowColor = '#ffee88'; ctx.shadowBlur = 35;
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.55);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ffee44'); g.addColorStop(1, 'rgba(200,140,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.5, 0, Math.PI*2); ctx.fill();
    // 6 branches
    ctx.rotate(this.spinTimer * 0.6);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      const grad = ctx.createLinearGradient(0, 0, 0, -w*0.55);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, 'rgba(255,200,0,0.3)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -w*0.55); ctx.lineTo(8, -w*0.25); ctx.lineTo(0, 0);
      ctx.lineTo(-8, -w*0.25); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Cœur pulsant
    ctx.fillStyle = `rgba(255,255,255,${0.8 + 0.2 * Math.sin(this.t * 8)})`;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
    if (this.phase === 2) {
      ctx.fillStyle = `rgba(255,80,80,${0.5 + 0.5 * Math.sin(this.t * 9)})`;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Indicateur EMP
    if (this.empActive > 0) {
      ctx.strokeStyle = `rgba(80,200,255,${this.empActive / 2})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, w * 0.7 * (1 + (2 - this.empActive) * 0.3), 0, Math.PI*2); ctx.stroke();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 6 — REAPER — Faux géante, invocations
// ─────────────────────────────────────────────────────────────────────
class BRReaper extends BossBase {
  constructor(x, y, W) {
    super(x, y, 1500, W);
    this.bossName = 'REAPER';
    this.w = 140; this.h = 160;
    this.color = '#9933ff';
    this.score = 8000;
    this.trailQueue = [];
    this.trailTimer = 0.3;
    this.miniSpawned = false;
    this.minis = [];
    this.dashTimer = 7.0;
    this.dashing = false;
    this.dashVx = 0; this.dashVy = 0;
    this.dashElapsed = 0;
  }
  _move(dt, W, H) {
    if (this.dashing) {
      this.dashElapsed += dt;
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;
      if (this.dashElapsed > 0.8) {
        this.dashing = false;
        this.x = clamp(this.x, this.w/2, W - this.w/2);
        this.y = clamp(this.y, this.h/2, H * 0.5);
      }
      return;
    }
    this.x = W/2 + Math.sin(this.t * 0.7) * (W * 0.32);
    this.y = 150 + Math.cos(this.t * 1.0) * 30;
  }
  _attack(dt, enemyBullets, player, W, H) {
    // Spawn 3 mini-faux une seule fois
    if (!this.miniSpawned && this.hp < this.maxHp * 0.9) {
      this.miniSpawned = true;
      for (let i = 0; i < 3; i++) {
        this.minis.push({
          angle: i * Math.PI * 2 / 3, radius: 90, fireTimer: 1.5 + i * 0.4, alive: true,
        });
      }
    }
    // Met à jour les mini-faux (orbitent + tirent)
    this.minis.forEach(m => {
      if (!m.alive) return;
      m.angle += dt * 1.4;
      m.fireTimer -= dt;
      if (m.fireTimer <= 0) {
        m.fireTimer = 1.5;
        const mx = this.x + Math.cos(m.angle) * m.radius;
        const my = this.y + Math.sin(m.angle) * m.radius;
        if (player) {
          const dx = player.x - mx, dy = player.y - my;
          const d = Math.hypot(dx, dy) || 1;
          enemyBullets.push(new Bullet(mx, my,
            (dx/d) * CFG.ENEMY_BULLET_SPEED, (dy/d) * CFG.ENEMY_BULLET_SPEED, '#cc66ff', false));
        }
      }
    });
    // Traînée fantôme : projectile qui suit le joueur avec 2s de délai
    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && player) {
      this.trailTimer = 0.7;
      this.trailQueue.push({ delay: 2.0, x: player.x, y: player.y, fromX: this.x, fromY: this.y });
    }
    for (let i = this.trailQueue.length - 1; i >= 0; i--) {
      const tq = this.trailQueue[i];
      tq.delay -= dt;
      if (tq.delay <= 0) {
        const dx = tq.x - tq.fromX, dy = tq.y - tq.fromY;
        const d = Math.hypot(dx, dy) || 1;
        const spd = CFG.ENEMY_BULLET_SPEED * 0.85;
        enemyBullets.push(new Bullet(tq.fromX, tq.fromY,
          (dx/d) * spd, (dy/d) * spd, '#aa44ff', false));
        this.trailQueue.splice(i, 1);
      }
    }
    // Dash
    this.dashTimer -= dt;
    if (this.dashTimer <= 0 && !this.dashing && player) {
      this.dashTimer = 7.0;
      this.dashing = true;
      this.dashElapsed = 0;
      // Diagonal direction
      this.dashVx = (Math.random() < 0.5 ? -1 : 1) * 280;
      this.dashVy = 180;
    }
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    // Capuche
    ctx.shadowColor = '#9933ff'; ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, -h*0.5, 0, h*0.3);
    g.addColorStop(0, '#330055'); g.addColorStop(0.5, '#5a1a99'); g.addColorStop(1, '#110022');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h*0.55);
    ctx.bezierCurveTo(w*0.6, -h*0.3, w*0.45, h*0.35, w*0.2, h*0.5);
    ctx.lineTo(-w*0.2, h*0.5);
    ctx.bezierCurveTo(-w*0.45, h*0.35, -w*0.6, -h*0.3, 0, -h*0.55);
    ctx.closePath(); ctx.fill();
    // Visage squelette (vide)
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, -h*0.2, w*0.18, 0, Math.PI*2); ctx.fill();
    // Yeux brillants
    ctx.fillStyle = '#ff44ff';
    ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(-8, -h*0.22, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 8, -h*0.22, 3, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Faux
    ctx.save();
    ctx.rotate(Math.sin(this.t * 0.7) * 0.2);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-w*0.4, h*0.4); ctx.lineTo(w*0.55, -h*0.45); ctx.stroke();
    ctx.fillStyle = '#dd66ff';
    ctx.shadowColor = '#dd66ff'; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(w*0.55, -h*0.45);
    ctx.bezierCurveTo(w*0.85, -h*0.4, w*0.85, -h*0.05, w*0.5, h*0.05);
    ctx.lineTo(w*0.45, -h*0.3);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Mini-faux
    this.minis.forEach(m => {
      if (!m.alive) return;
      const mx = Math.cos(m.angle) * m.radius;
      const my = Math.sin(m.angle) * m.radius;
      ctx.fillStyle = '#aa44ff';
      ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 7 — FORTRESS — Hexagone avec 6 tourelles
// ─────────────────────────────────────────────────────────────────────
class BRFortress extends BossBase {
  constructor(x, y, W) {
    super(x, y, 2000, W);
    this.bossName = 'FORTRESS';
    this.w = 200; this.h = 180;
    this.color = '#888899';
    this.score = 10000;
    this.turrets = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      this.turrets.push({
        ax: Math.cos(a), ay: Math.sin(a),
        offsetX: Math.cos(a) * 70, offsetY: Math.sin(a) * 70,
        hp: 300, alive: true, fireTimer: 1.0 + i * 0.3,
      });
    }
    this.shieldTimer = 5.0;
    this.shieldActive = 0;
    this.missileTimer = 8.0;
    this.targetY = 160;
    this.vx = 50;
  }
  hit(damage = 1) {
    if (this.dying) return false;
    // Si bouclier actif : annule les dégâts
    if (this.shieldActive > 0) return false;
    const alive = this.turrets.filter(t => t.alive);
    if (alive.length > 0 && Math.random() < 0.6) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      target.hp -= damage;
      if (target.hp <= 0) {
        target.alive = false;
        target.hp = 0;
      }
    }
    return super.hit(damage);
  }
  _move(dt, W) {
    this.x += this.vx * dt;
    if (this.x < this.w/2 + 18) { this.x = this.w/2 + 18; this.vx = Math.abs(this.vx); }
    if (this.x > W - this.w/2 - 18) { this.x = W - this.w/2 - 18; this.vx = -Math.abs(this.vx); }
    this.y += (this.targetY - this.y) * 1.0 * dt;
  }
  _attack(dt, enemyBullets, player) {
    if (this.shieldActive > 0) this.shieldActive -= dt;
    // Tourelles tirent indépendamment
    this.turrets.forEach(t => {
      if (!t.alive) return;
      t.fireTimer -= dt;
      if (t.fireTimer <= 0) {
        t.fireTimer = 1.8;
        const tx = this.x + t.offsetX, ty = this.y + t.offsetY;
        const spd = CFG.ENEMY_BULLET_SPEED;
        if (player) {
          const dx = player.x - tx, dy = player.y - ty;
          const d = Math.hypot(dx, dy) || 1;
          enemyBullets.push(new Bullet(tx, ty, (dx/d) * spd, (dy/d) * spd, '#ccccdd', false));
        }
      }
    });
    // Bouclier énergétique
    this.shieldTimer -= dt;
    if (this.shieldTimer <= 0) {
      this.shieldTimer = 9.0;
      this.shieldActive = 3.0;
    }
    // Missile à verrouillage
    this.missileTimer -= dt;
    if (this.missileTimer <= 0 && player) {
      this.missileTimer = 8.0;
      enemyBullets.push(new BRHomingMissile(this.x, this.y + 30, player));
    }
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    // Bouclier énergétique
    if (this.shieldActive > 0) {
      ctx.strokeStyle = `rgba(100,200,255,${0.5 + 0.5 * Math.sin(this.t * 12)})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(0, 0, w * 0.65, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Hexagone principal
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, w/2);
    g.addColorStop(0, '#666677'); g.addColorStop(1, '#222230');
    ctx.fillStyle = g;
    ctx.shadowColor = '#888899'; ctx.shadowBlur = 18;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI/2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * 60, Math.sin(a) * 60);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#aabbcc'; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Tourelles aux 6 sommets
    this.turrets.forEach(t => {
      ctx.fillStyle = t.alive ? '#445' : '#220';
      ctx.beginPath(); ctx.arc(t.offsetX, t.offsetY, 18, 0, Math.PI*2); ctx.fill();
      if (t.alive) {
        ctx.fillStyle = '#ff4422';
        ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(t.offsetX, t.offsetY, 5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        // Barre PV
        const ratio = t.hp / 300;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(t.offsetX - 12, t.offsetY - 24, 24, 3);
        ctx.fillStyle = ratio > 0.5 ? '#88ff44' : '#ffaa33';
        ctx.fillRect(t.offsetX - 12, t.offsetY - 24, 24 * ratio, 3);
      }
    });
    // Cœur central
    ctx.fillStyle = `rgba(255,200,80,${0.7 + 0.3 * Math.sin(this.t * 4)})`;
    ctx.shadowColor = '#ffcc44'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── Missile à tête chercheuse pour Fortress / Nemesis Prime ────────
class BRHomingMissile extends Bullet {
  constructor(x, y, target) {
    super(x, y, 0, 80, '#ff8844', false);
    this.target = target;
    this.life = 5.0;
    this.angle = Math.PI / 2;
    this.speed = 160;
    this.w = 10; this.h = 14;
  }
  update(dt, W, H) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.target && !this.target.dead) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const desired = Math.atan2(dy, dx);
      let diff = desired - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
    }
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -30 || this.y > H + 30 || this.x < -30 || this.x > W + 30) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.fillStyle = '#ff5522';
    ctx.shadowColor = '#ff8844'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(4, 6); ctx.lineTo(-4, 6);
    ctx.closePath(); ctx.fill();
    // Traînée
    ctx.fillStyle = `rgba(255,200,50,${0.5 + 0.5 * Math.sin(Date.now() * 0.02)})`;
    ctx.beginPath(); ctx.arc(0, 8, 3, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 8 — ECLIPSE — Disque noir, trous noirs, laser rotatif
// ─────────────────────────────────────────────────────────────────────
class BRBlackHole {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 22;
    this.life = 5.0;
    this.dead = false;
  }
  get hitbox() { return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 }; }
  update(dt, W, H, playerBullets) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    // Attire les balles joueur
    if (playerBullets) {
      playerBullets.forEach(b => {
        if (b.dead) return;
        const dx = this.x - b.x, dy = this.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 140 && d > 0) {
          const pull = 200 / Math.max(20, d);
          b.vx += (dx / d) * pull * dt * 30;
          b.vy += (dy / d) * pull * dt * 30;
        }
      });
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Disque d'accrétion
    const t = Date.now() * 0.003;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, this.r * 2);
    g.addColorStop(0, '#000'); g.addColorStop(0.3, '#220033'); g.addColorStop(0.8, 'rgba(100,180,255,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 1.8, 0, Math.PI*2); ctx.fill();
    // Anneau lumineux
    ctx.rotate(t);
    ctx.strokeStyle = 'rgba(150,220,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 1.2, 0, Math.PI * 1.6); ctx.stroke();
    ctx.restore();
  }
}

class BREclipse extends BossBase {
  constructor(x, y, W) {
    super(x, y, 2500, W);
    this.bossName = 'ECLIPSE';
    this.w = 180; this.h = 180;
    this.color = '#222233';
    this.score = 12500;
    this.blackHoleTimer = 4.0;
    this.laserTimer = 6.0;
    this.laserActive = 0;
    this.laserAngle = 0;
    this.blackHoles = [];
    this.darknessLevel = 0;  // 0 → 0.6
  }
  _move(dt, W) {
    this.x = W/2 + Math.cos(this.t * 0.5) * (W * 0.25);
    this.y = 160 + Math.sin(this.t * 0.7) * 25;
    // Assombrissement progressif jusqu'à 60% à mi-vie
    const target = (1 - this.hp / this.maxHp) * 0.6;
    this.darknessLevel += (target - this.darknessLevel) * dt;
  }
  _attack(dt, enemyBullets, player) {
    if (this.laserActive > 0) {
      this.laserActive -= dt;
      this.laserAngle += dt * 2.0;
    } else {
      this.laserTimer -= dt;
      if (this.laserTimer <= 0) {
        this.laserTimer = 9.0;
        this.laserActive = 3.0;
        this.laserAngle = 0;
      }
    }
    this.blackHoleTimer -= dt;
    if (this.blackHoleTimer <= 0) {
      this.blackHoleTimer = 5.0;
      this.blackHoles.push(new BRBlackHole(
        100 + Math.random() * (this.W - 200),
        140 + Math.random() * 200
      ));
    }
  }
  _drawBody(ctx) {
    const w = this.w;
    // Disque noir
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, w * 0.5);
    g.addColorStop(0, '#000'); g.addColorStop(0.7, '#0a0014'); g.addColorStop(1, '#110022');
    ctx.fillStyle = g;
    ctx.shadowColor = '#0066aa'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, 0, w*0.45, 0, Math.PI*2); ctx.fill();
    // Anneau cyan pulsant
    ctx.strokeStyle = `rgba(80,220,255,${0.7 + 0.3 * Math.sin(this.t * 3)})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, w*0.48, 0, Math.PI*2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(80,220,255,${0.3 + 0.3 * Math.sin(this.t * 3 + 1)})`;
    ctx.beginPath(); ctx.arc(0, 0, w*0.54, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Laser rotatif 360°
    if (this.laserActive > 0) {
      ctx.save();
      ctx.rotate(this.laserAngle);
      const grad = ctx.createLinearGradient(0, 0, this.W, 0);
      grad.addColorStop(0, 'rgba(255,80,200,0.9)');
      grad.addColorStop(1, 'rgba(255,80,200,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, -3, this.W, 6);
      ctx.restore();
    }
  }
  // Test du laser (collision avec un point)
  laserHitsPoint(px, py) {
    if (this.laserActive <= 0) return false;
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 60 || dist > this.W) return false;
    const angle = Math.atan2(dy, dx);
    let diff = angle - this.laserAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < 0.04;
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 9 — COLOSSUS — Titan mécanique, 2 bras + torse
// ─────────────────────────────────────────────────────────────────────
class BRColossus extends BossBase {
  constructor(x, y, W) {
    super(x, y, 3500, W);
    this.bossName = 'COLOSSUS';
    this.w = Math.round(W * 0.6); this.h = 200;
    this.color = '#dd9933';
    this.score = 17500;
    this.targetY = 130;
    this.slamTimer = 4.0;
    this.clawTimer = 5.0;
    this.clawY = -80;
    this.clawActive = false;
    this.beamTimer = 7.0;
    this.beamActive = 0;
    this.beamCharge = 0;
    this.shockwave = null;
  }
  isRage() { return this.hp < this.maxHp * 0.3; }
  _move(dt, W) {
    this.x = W/2;
    this.y += (this.targetY - this.y) * 0.8 * dt;
  }
  _attack(dt, enemyBullets, player, W, H) {
    const rage = this.isRage();
    const rageMult = rage ? 0.5 : 1.0;
    // Slam droit → onde de choc horizontale
    this.slamTimer -= dt;
    if (this.slamTimer <= 0) {
      this.slamTimer = 5.0 * rageMult;
      this.shockwave = { x: this.x, y: this.y + 60, vx: 200, life: 2.0 };
    }
    if (this.shockwave) {
      this.shockwave.x += this.shockwave.vx * dt;
      this.shockwave.life -= dt;
      if (this.shockwave.life <= 0) this.shockwave = null;
    }
    // Griffe gauche descend
    this.clawTimer -= dt;
    if (this.clawTimer <= 0 && !this.clawActive) {
      this.clawTimer = 5.0 * rageMult;
      this.clawActive = true;
      this.clawY = -100;
    }
    if (this.clawActive) {
      this.clawY += 400 * dt;
      if (this.clawY > 350) {
        this.clawY = -100;
        this.clawActive = false;
      }
    }
    // Méga laser vertical
    if (this.beamActive > 0) {
      this.beamActive -= dt;
    } else {
      this.beamTimer -= dt;
      this.beamCharge = Math.max(0, 1.5 - this.beamTimer);
      if (this.beamTimer <= 0) {
        this.beamTimer = 6.0 * rageMult;
        this.beamActive = 1.2;
        this.beamCharge = 0;
      }
    }
    // En rage, torse tire en continu
    if (rage) {
      if (Math.random() < 0.04) {
        if (player) {
          const dx = player.x - this.x, dy = player.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          enemyBullets.push(new Bullet(this.x, this.y + 30,
            (dx/d) * CFG.ENEMY_BULLET_SPEED * 1.2,
            (dy/d) * CFG.ENEMY_BULLET_SPEED * 1.2, '#ffaa44', false));
        }
      }
    }
  }
  shockwaveHits(px, py) {
    if (!this.shockwave) return false;
    return Math.abs(px - this.shockwave.x) < 30 && Math.abs(py - this.shockwave.y) < 18;
  }
  clawHits(px, py) {
    if (!this.clawActive) return false;
    return Math.abs(px - (this.x - this.w * 0.3)) < 26 && Math.abs(py - this.clawY) < 30;
  }
  beamHits(px, py) {
    if (this.beamActive <= 0) return false;
    return Math.abs(px - this.x) < 22;
  }
  _drawBody(ctx) {
    const w = this.w, h = this.h;
    // Torse
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#aa7722'); g.addColorStop(0.5, '#dd9933'); g.addColorStop(1, '#553311');
    ctx.fillStyle = g;
    ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 20;
    ctx.fillRect(-w*0.18, -h*0.5, w*0.36, h);
    // Tête
    ctx.fillStyle = '#664422';
    ctx.fillRect(-w*0.12, -h*0.65, w*0.24, h*0.18);
    ctx.fillStyle = '#ff4422';
    ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(-w*0.05, -h*0.56, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( w*0.05, -h*0.56, 4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Bras droit (poing)
    ctx.fillStyle = '#aa7722';
    ctx.fillRect(w*0.18, -h*0.35, w*0.12, h*0.5);
    ctx.fillRect(w*0.28, h*0.08, w*0.12, h*0.18);  // poing
    // Bras gauche (griffe)
    ctx.fillRect(-w*0.3, -h*0.35, w*0.12, h*0.5);
    // Canon torse
    ctx.fillStyle = '#332211';
    ctx.fillRect(-w*0.08, -h*0.05, w*0.16, h*0.3);
    // Indicateur de charge laser
    if (this.beamCharge > 0) {
      ctx.fillStyle = `rgba(255,80,80,${this.beamCharge / 1.5})`;
      ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, h*0.1, 10 * this.beamCharge, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Onde de choc
    if (this.shockwave) {
      const dx = this.shockwave.x - this.x;
      ctx.strokeStyle = `rgba(255,200,80,${this.shockwave.life / 2})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(dx, this.shockwave.y - this.y);
      ctx.lineTo(dx + 30, this.shockwave.y - this.y);
      ctx.stroke();
    }
    // Griffe descendante
    if (this.clawActive) {
      ctx.save();
      ctx.fillStyle = '#aa7722';
      ctx.fillRect(-w*0.3, 0, w*0.12, this.clawY);
      // 3 griffes
      ctx.fillStyle = '#dd9933';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-w*0.3 + i*8, this.clawY);
        ctx.lineTo(-w*0.3 + i*8 - 3, this.clawY + 18);
        ctx.lineTo(-w*0.3 + i*8 + 3, this.clawY + 18);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // Méga laser vertical
    if (this.beamActive > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.W);
      grad.addColorStop(0, 'rgba(255,80,80,0.95)');
      grad.addColorStop(1, 'rgba(255,80,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-18, 0, 36, this.W);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, 0, 12, this.W);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS 10 — NEMESIS PRIME — Boss final 4 phases
// ─────────────────────────────────────────────────────────────────────
class BRNemesisPrime extends BossBase {
  constructor(x, y, W) {
    super(x, y, 5000, W);
    this.bossName = 'NEMESIS PRIME';
    this.w = Math.round(W * 0.7); this.h = 220;
    this.color = '#FFD700';
    this.score = 25000;
    this.isFinal = true;
    this.phase = 1;
    this.fireTimer = 1.5;
    this.missileTimer = 4.0;
    this.fragments = [];  // pour la phase 3
    this.spiralTimer = 0;
    this.lastStandLaserTimer = 8.0;
    this.lastStandLaserWarn = 0;
    this.lastStandLaserActive = 0;
    this.victoryTimer = 0;
    this.victoryStarted = false;
    this.drones = [];
    this.targetY = 140;
  }
  isFragmented() { return this.phase === 3; }
  _move(dt, W, H) {
    if (this.phase === 3) {
      // Fragments se déplacent indépendamment
      this.fragments.forEach(f => {
        if (!f.alive) return;
        f.angle += dt * 0.7;
        f.x = this.W/2 + Math.cos(f.angle + f.phaseOff) * (this.W * 0.32);
        f.y = 160 + Math.sin(f.angle * 1.3 + f.phaseOff) * 80;
      });
      return;
    }
    if (this.phase === 4) {
      // Copie miroir du joueur
      if (this._mirror && this._mirror.player) {
        this.x = this.W - this._mirror.player.x;
        this.y = clamp(this._mirror.player.y - 240, 80, this.W * 0.5);
      }
      return;
    }
    this.x = this.W/2 + Math.sin(this.t * 0.5) * (this.W * 0.2);
    this.y += (this.targetY - this.y) * 0.8 * dt;
  }
  setPlayerMirror(player) { this._mirror = { player }; }
  hit(damage = 1) {
    if (this.dying) return false;
    // Phase 3 : redirige les dégâts vers les fragments vivants
    if (this.phase === 3) {
      const alive = this.fragments.filter(f => f.alive);
      if (alive.length === 0) return false;
      const target = alive[Math.floor(Math.random() * alive.length)];
      target.hp -= damage;
      if (target.hp <= 0) { target.alive = false; }
      this.hp = Math.max(500, this.hp - damage);
      // Tous fragments détruits → entrer en phase 4
      if (alive.length === 1 && target.hp <= 0) {
        this.hp = 500;
        this.phase = 4;
      }
      this.flashTimer = 0.08;
      return false;
    }
    return super.hit(damage);
  }
  _attack(dt, enemyBullets, player, W, H) {
    // Vérifications de transitions de phase
    if (this.phase === 1 && this.hp <= 3500) {
      this.phase = 2;
      // Drones de défense (phase 1 conservés ou re-spawn)
      this.drones = [];
    }
    if (this.phase === 2 && this.hp <= 2000) {
      this.phase = 3;
      // Fragmentation
      for (let i = 0; i < 4; i++) {
        this.fragments.push({
          alive: true, hp: 500, angle: 0,
          phaseOff: i * Math.PI / 2,
          x: this.W/2, y: 150 + i * 12,
          fireTimer: 1.0 + i * 0.3,
        });
      }
    }
    // Phase 1 — AWAKENING
    if (this.phase === 1) {
      // Drones de défense
      if (this.drones.length < 4 && Math.random() < 0.02) {
        this.drones.push({
          angle: Math.random() * Math.PI * 2,
          radius: 100, fireTimer: 1.5,
        });
      }
      this.drones.forEach(d => {
        d.angle += dt * 1.3;
        d.fireTimer -= dt;
        if (d.fireTimer <= 0) {
          d.fireTimer = 2.0;
          const dx = this.x + Math.cos(d.angle) * d.radius;
          const dy = this.y + Math.sin(d.angle) * d.radius;
          if (player) {
            const ddx = player.x - dx, ddy = player.y - dy;
            const dd = Math.hypot(ddx, ddy) || 1;
            enemyBullets.push(new Bullet(dx, dy,
              (ddx/dd) * CFG.ENEMY_BULLET_SPEED, (ddy/dd) * CFG.ENEMY_BULLET_SPEED, '#FFD700', false));
          }
        }
      });
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 1.5;
        const spd = CFG.ENEMY_BULLET_SPEED;
        for (let i = -2; i <= 2; i++) {
          const a = Math.PI/2 + i * 0.2;
          enemyBullets.push(new Bullet(this.x, this.y + 30,
            Math.cos(a) * spd, Math.sin(a) * spd, '#FFD700', false));
        }
      }
    }
    // Phase 2 — UNLEASHED
    if (this.phase === 2) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 1.0;
        const spd = CFG.ENEMY_BULLET_SPEED * 0.9;
        for (let i = 0; i < 8; i++) {
          const a = this.t * 1.5 + i * Math.PI / 4;
          enemyBullets.push(new Bullet(this.x, this.y,
            Math.cos(a) * spd, Math.sin(a) * spd, '#ff8800', false));
        }
      }
      this.missileTimer -= dt;
      if (this.missileTimer <= 0 && player) {
        this.missileTimer = 4.0;
        for (let i = 0; i < 6; i++) {
          const offX = (i - 2.5) * 22;
          enemyBullets.push(new BRHomingMissile(this.x + offX, this.y + 50, player));
        }
      }
    }
    // Phase 3 — RAMPAGE : fragments tirent indépendamment
    if (this.phase === 3) {
      this.fragments.forEach(f => {
        if (!f.alive) return;
        f.fireTimer -= dt;
        if (f.fireTimer <= 0) {
          f.fireTimer = 1.3;
          if (player) {
            const dx = player.x - f.x, dy = player.y - f.y;
            const d = Math.hypot(dx, dy) || 1;
            enemyBullets.push(new Bullet(f.x, f.y,
              (dx/d) * CFG.ENEMY_BULLET_SPEED * 1.1,
              (dy/d) * CFG.ENEMY_BULLET_SPEED * 1.1, '#ff3366', false));
          }
        }
      });
    }
    // Phase 4 — LAST STAND
    if (this.phase === 4) {
      // Tir en spirale permanent
      this.spiralTimer += dt;
      if (this.spiralTimer >= 0.12) {
        this.spiralTimer = 0;
        const spd = CFG.ENEMY_BULLET_SPEED * 0.85;
        const a = this.t * 3;
        for (let i = 0; i < 3; i++) {
          const aa = a + i * Math.PI * 2 / 3;
          enemyBullets.push(new Bullet(this.x, this.y,
            Math.cos(aa) * spd, Math.sin(aa) * spd, '#ffffff', false));
        }
      }
      // Laser mortel 8s
      if (this.lastStandLaserActive > 0) {
        this.lastStandLaserActive -= dt;
      } else if (this.lastStandLaserWarn > 0) {
        this.lastStandLaserWarn -= dt;
        if (this.lastStandLaserWarn <= 0) {
          this.lastStandLaserActive = 1.2;
        }
      } else {
        this.lastStandLaserTimer -= dt;
        if (this.lastStandLaserTimer <= 0) {
          this.lastStandLaserTimer = 8.0;
          this.lastStandLaserWarn = 2.0;
        }
      }
    }
  }
  lastStandLaserHits(px, py) {
    if (this.lastStandLaserActive <= 0) return false;
    return Math.abs(px - this.x) < 30;
  }
  _drawBody(ctx) {
    const w = this.w;
    // Background overlay rouge en phase 2+
    if (this.phase >= 2) {
      ctx.save();
      ctx.translate(-this.x, -this.y);
      const a = 0.15 + 0.08 * Math.sin(this.t * 2);
      ctx.fillStyle = `rgba(120,0,0,${a})`;
      ctx.fillRect(0, 0, this.W, this.W * 1.5);
      ctx.restore();
    }
    if (this.phase === 1) {
      this._drawAwakening(ctx, w);
    } else if (this.phase === 2) {
      this._drawUnleashed(ctx, w);
    } else if (this.phase === 3) {
      this._drawFragments(ctx);
    } else if (this.phase === 4) {
      this._drawLastStand(ctx);
    }
    // Drones (phase 1)
    if (this.phase === 1) {
      this.drones.forEach(d => {
        const dx = Math.cos(d.angle) * d.radius;
        const dy = Math.sin(d.angle) * d.radius;
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
  }
  _drawAwakening(ctx, w) {
    // Forme compacte dorée
    const g = ctx.createLinearGradient(0, -100, 0, 100);
    g.addColorStop(0, '#FFD700'); g.addColorStop(0.5, '#aa7700'); g.addColorStop(1, '#332200');
    ctx.fillStyle = g;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.moveTo(0, -100);
    ctx.lineTo(w * 0.2, -50); ctx.lineTo(w * 0.18, 50);
    ctx.lineTo(0, 80);
    ctx.lineTo(-w * 0.18, 50); ctx.lineTo(-w * 0.2, -50);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    // Cœur
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  _drawUnleashed(ctx, w) {
    // Ailes d'énergie déployées
    ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255,80,40,${0.7 + 0.3 * Math.sin(this.t * 4)})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.5, -60); ctx.lineTo(w * 0.4, 40); ctx.lineTo(0, 30);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-w * 0.5, -60); ctx.lineTo(-w * 0.4, 40); ctx.lineTo(0, 30);
    ctx.closePath(); ctx.fill();
    // Corps principal noir/doré
    const g = ctx.createLinearGradient(0, -100, 0, 100);
    g.addColorStop(0, '#FFD700'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#FFD700');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(w * 0.22, -40); ctx.lineTo(w * 0.18, 70);
    ctx.lineTo(-w * 0.18, 70); ctx.lineTo(-w * 0.22, -40);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    // Cœur rouge
    ctx.fillStyle = `rgba(255,40,40,${0.8 + 0.2 * Math.sin(this.t * 8)})`;
    ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  _drawFragments(ctx) {
    // Dessine chaque fragment vivant
    this.fragments.forEach(f => {
      if (!f.alive) return;
      ctx.save();
      ctx.translate(f.x - this.x, f.y - this.y);
      ctx.rotate(f.angle * 2);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
      g.addColorStop(0, '#FFD700'); g.addColorStop(0.7, '#aa3333'); g.addColorStop(1, '#220000');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 2 / 5 - Math.PI/2;
        const r = k % 2 === 0 ? 26 : 14;
        ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      // PV barre
      const ratio = f.hp / 500;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-18, -40, 36, 4);
      ctx.fillStyle = ratio > 0.5 ? '#ff4422' : '#ffaa33';
      ctx.fillRect(-18, -40, 36 * ratio, 4);
      ctx.restore();
    });
  }
  _drawLastStand(ctx) {
    // Forme finale plus petite, ultra-rapide
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 26;
    const g = ctx.createRadialGradient(0, 0, 5, 0, 0, 50);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#FFD700'); g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI * 2 / 8 - Math.PI/2;
      const r = k % 2 === 0 ? 50 : 26;
      ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Avertissement laser
    if (this.lastStandLaserWarn > 0) {
      const blink = Math.floor(this.lastStandLaserWarn * 8) % 2 === 0;
      if (blink) {
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, this.W);
        ctx.setLineDash([8, 8]); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Laser actif
    if (this.lastStandLaserActive > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.W);
      grad.addColorStop(0, 'rgba(255,80,80,0.95)');
      grad.addColorStop(1, 'rgba(255,80,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-30, 0, 60, this.W);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, 0, 20, this.W);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// BOSS RUSH MANAGER — orchestre la séquence
// ─────────────────────────────────────────────────────────────────────
const BR_BOSS_FACTORIES = [
  (W, H) => new BRSentinel(W/2, 140, W),
  (W, H) => new BRHydra(W/2, 130, W),
  (W, H) => new BRPhantom(W/2, 140, W),
  (W, H) => new BRLeviathan(W/2, 160, W),
  (W, H) => new BRNova(W/2, 150, W),
  (W, H) => new BRReaper(W/2, 150, W),
  (W, H) => new BRFortress(W/2, 160, W),
  (W, H) => new BREclipse(W/2, 160, W),
  (W, H) => new BRColossus(W/2, 140, W),
  (W, H) => new BRNemesisPrime(W/2, 140, W),
];

class BossRushManager {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.reset();
  }
  reset() {
    this.bossIndex = -1;
    this.boss = null;
    this.intermission = 0;
    this.intermissionDuration = BR_INTERMISSION_DURATION;
    this.startTime = 0;
    this.totalTime = 0;
    this.done = false;
    this.failed = false;
    this.entranceFlash = 0;
  }
  start() {
    this.reset();
    this.startTime = Date.now();
    this._spawnNext();
  }
  _spawnNext() {
    this.bossIndex++;
    if (this.bossIndex >= BR_BOSS_FACTORIES.length) {
      this.done = true;
      this.totalTime = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
      this.boss = null;
      return;
    }
    this.boss = BR_BOSS_FACTORIES[this.bossIndex](this.W, this.H);
    this.entranceFlash = 0.5;
    if (this.boss instanceof BRNova) this.entranceFlash = 1.2;  // flash spécial
  }
  /** Appelé chaque frame ; renvoie 'next' quand un boss meurt. */
  update(dt, player) {
    if (this.done || this.failed) return null;
    if (this.entranceFlash > 0) this.entranceFlash -= dt;
    // Pendant l'intermission
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) {
        this._spawnNext();
      }
      return null;
    }
    // Boss vivant
    if (!this.boss) return null;
    // Synchro mirror pour Nemesis Prime phase 4
    if (this.boss instanceof BRNemesisPrime) this.boss.setPlayerMirror(player);
    // Boss mort
    if (this.boss.dead) {
      const wasFinal = this.bossIndex >= BR_BOSS_FACTORIES.length - 1;
      const finishedBoss = this.boss;
      this.boss = null;
      if (wasFinal) {
        this.done = true;
        this.totalTime = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
        return { event: 'victory', boss: finishedBoss };
      }
      this.intermission = this.intermissionDuration;
      return { event: 'killed', bossIndex: this.bossIndex };
    }
    return null;
  }
  fail() {
    this.failed = true;
    this.totalTime = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
  }
  // ── Helpers d'UI ──
  bossReached() { return Math.min(this.bossIndex + 1, BR_BOSS_FACTORIES.length); }
  intermissionRemaining() { return Math.ceil(this.intermission); }
}

// ─────────────────────────────────────────────────────────────────────
// NEMESIS SKIN — Renderer pour le skin débloqué après victoire
// ─────────────────────────────────────────────────────────────────────
if (typeof SKIN_RENDERERS !== 'undefined') {
  SKIN_RENDERERS.nemesis = function(ctx, w, h) {
    const t = Date.now() * 0.001;
    // Corps noir/doré effilé
    ctx.beginPath();
    ctx.moveTo(0, -h*0.55);
    ctx.lineTo(w*0.18, -h*0.2); ctx.lineTo(w*0.42, h*0.35);
    ctx.lineTo(w*0.2, h*0.5); ctx.lineTo(-w*0.2, h*0.5);
    ctx.lineTo(-w*0.42, h*0.35); ctx.lineTo(-w*0.18, -h*0.2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h*0.5, 0, h*0.5);
    g.addColorStop(0, '#FFD700'); g.addColorStop(0.45, '#000');
    g.addColorStop(0.55, '#000'); g.addColorStop(1, '#FFD700');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    // Ailes énergétiques (latérales)
    ctx.fillStyle = `rgba(255,200,80,${0.45 + 0.25 * Math.sin(t * 3)})`;
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
    [1, -1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s * w*0.18, -h*0.05);
      ctx.lineTo(s * w*0.58, h*0.15);
      ctx.lineTo(s * w*0.45, h*0.42);
      ctx.lineTo(s * w*0.2, h*0.3);
      ctx.closePath(); ctx.fill();
    });
    ctx.shadowBlur = 0;
    // Cœur central blanc
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(0, 0, w*0.1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, w*0.05, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Lignes de détail dorées
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w*0.1, h*0.05); ctx.lineTo(-w*0.25, h*0.42);
    ctx.moveTo( w*0.1, h*0.05); ctx.lineTo( w*0.25, h*0.42);
    ctx.stroke();
  };
}
