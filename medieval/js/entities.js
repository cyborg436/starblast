'use strict';
/* ============================================================
   entities.js — joueur, ennemis, PNJ, projectiles, particules
   ============================================================ */

/* ---- Bestiaire : stats de base (niveau 1), mises à l'échelle ---- */
G.ENNEMIS = {
  slime:        { nom: 'Slime',            pv: 12,  atk: 3,  vit: 40,  xp: 6,   aggro: 5,  spr: 'slime' },
  slimetox:     { nom: 'Slime toxique',    pv: 16,  atk: 5,  vit: 45,  xp: 9,   aggro: 5,  spr: 'slimetox' },
  loup:         { nom: 'Loup',             pv: 16,  atk: 5,  vit: 95,  xp: 9,   aggro: 7,  spr: 'loup' },
  loupblanc:    { nom: 'Loup des neiges',  pv: 22,  atk: 7,  vit: 105, xp: 13,  aggro: 8,  spr: 'loupblanc' },
  gobelin:      { nom: 'Gobelin',          pv: 18,  atk: 5,  vit: 70,  xp: 10,  aggro: 6,  spr: 'gobelin', humanoide: true },
  orc:          { nom: 'Orc',              pv: 34,  atk: 9,  vit: 60,  xp: 20,  aggro: 6,  spr: 'orc', humanoide: true },
  bandit:       { nom: 'Bandit',           pv: 24,  atk: 7,  vit: 75,  xp: 14,  aggro: 7,  spr: 'bandit', humanoide: true },
  chefbandit:   { nom: 'Chef bandit',      pv: 90,  atk: 10, vit: 80,  xp: 60,  aggro: 8,  spr: 'chefbandit', humanoide: true, taille: 1.3 },
  squelette:    { nom: 'Squelette',        pv: 20,  atk: 6,  vit: 55,  xp: 12,  aggro: 6,  spr: 'squelette', humanoide: true },
  zombi:        { nom: 'Zombi',            pv: 28,  atk: 7,  vit: 35,  xp: 13,  aggro: 6,  spr: 'zombi', humanoide: true },
  momie:        { nom: 'Momie',            pv: 30,  atk: 8,  vit: 40,  xp: 16,  aggro: 6,  spr: 'momie', humanoide: true },
  fantome:      { nom: 'Fantôme',          pv: 18,  atk: 6,  vit: 65,  xp: 14,  aggro: 8,  spr: 'fantome', vole: true },
  araignee:     { nom: 'Araignée géante',  pv: 15,  atk: 5,  vit: 85,  xp: 10,  aggro: 6,  spr: 'araignee', tir: 'toile', portee: 4, tcool: 2.2 },
  chauvesouris: { nom: 'Chauve-souris',    pv: 10,  atk: 4,  vit: 110, xp: 7,   aggro: 7,  spr: 'chauvesouris', vole: true },
  scorpion:     { nom: 'Scorpion géant',   pv: 20,  atk: 7,  vit: 65,  xp: 12,  aggro: 6,  spr: 'scorpion' },
  serpent:      { nom: 'Serpent des sables', pv: 14, atk: 6, vit: 90,  xp: 10,  aggro: 6,  spr: 'serpent' },
  golem:        { nom: 'Golem de pierre',  pv: 50,  atk: 11, vit: 40,  xp: 28,  aggro: 5,  spr: 'golem' },
  golemglace:   { nom: 'Golem de glace',   pv: 55,  atk: 12, vit: 42,  xp: 32,  aggro: 5,  spr: 'golemglace' },
  golemancien:  { nom: 'Golem ancien',     pv: 160, atk: 14, vit: 45,  xp: 120, aggro: 7,  spr: 'golemancien', taille: 1.5 },
  yeti:         { nom: 'Yéti',             pv: 60,  atk: 13, vit: 70,  xp: 35,  aggro: 6,  spr: 'yeti', taille: 1.2 },
  necromancien: { nom: 'Nécromancien',     pv: 140, atk: 12, vit: 55,  xp: 150, aggro: 9,  spr: 'necromancien', humanoide: true, taille: 1.3, tir: 'ombre', portee: 7, tcool: 1.6, invoque: 'squelette' },
  dragon:       { nom: 'Dragon',           pv: 450, atk: 22, vit: 65,  xp: 500, aggro: 10, spr: 'dragon', taille: 1.6, tir: 'crachefeu', portee: 8, tcool: 2.0, gros: true },
};

G.enemies = []; G.npcsE = []; G.projs = []; G.parts = []; G.drops = []; G.dmgTexts = [];

/* ============================================================
   JOUEUR
   ============================================================ */
G.newPlayer = function () {
  return {
    x: 0, y: 0, w: 16, h: 10,           // boîte de collision (pieds)
    dir: 'd', frame: 0, animT: 0, bouge: false,
    pv: 50, pvmax: 50, pm: 20, pmmax: 20, end: 100, endmax: 100,
    lvl: 1, xp: 0, or: 30,
    inv: new Array(G.INV_SIZE).fill(null),
    equip: { arme: 'epee1', armure: null, casque: null, anneau: null },
    atkT: 0, swing: 0, swingDir: 'd', hurtT: 0, dashT: 0, dashCd: 0,
    sortCd: { feu: 0, soin: 0, eclair: 0 },
    morts: 0, tues: 0, tempsJeu: 0,
  };
};

G.xpNeeded = lvl => Math.round(40 * Math.pow(lvl, 1.5));

G.playerAtk = function () {
  const p = G.player, a = p.equip.arme ? G.ITEMS[p.equip.arme] : null;
  return 2 + p.lvl + (a ? a.atk : 0) + (p.equip.anneau && G.ITEMS[p.equip.anneau].atk || 0);
};
G.playerDef = function () {
  const p = G.player;
  let d = 0;
  for (const s of ['armure', 'casque', 'anneau']) if (p.equip[s]) d += G.ITEMS[p.equip[s]].def || 0;
  return d;
};
G.playerMag = function () {
  const p = G.player, a = p.equip.arme ? G.ITEMS[p.equip.arme] : null;
  return Math.floor(p.lvl * 1.5) + (a && a.mag || 0);
};
G.playerStatBonus = function (stat) {
  const p = G.player; let v = 0;
  for (const s of ['armure', 'casque', 'anneau', 'arme']) if (p.equip[s]) v += G.ITEMS[p.equip[s]][stat] || 0;
  return v;
};
G.recalcStats = function () {
  const p = G.player;
  const pvm = 40 + p.lvl * 10 + G.playerStatBonus('pv');
  const pmm = 15 + p.lvl * 5 + G.playerStatBonus('pm');
  p.pv = Math.min(p.pv, pvm); p.pm = Math.min(p.pm, pmm);
  p.pvmax = pvm; p.pmmax = pmm;
};

G.gainXP = function (n) {
  const p = G.player;
  p.xp += n;
  while (p.xp >= G.xpNeeded(p.lvl)) {
    p.xp -= G.xpNeeded(p.lvl);
    p.lvl++;
    G.recalcStats();
    p.pv = p.pvmax; p.pm = p.pmmax;
    G.sfx('niveau');
    G.toast(`✨ Niveau ${p.lvl} !`, 'quest');
    burst(p.x + 8, p.y - 10, '#f8e060', 14);
    if (p.lvl === 3) G.toast('Sort appris : Boule de feu (touche 3)', 'quest');
    if (p.lvl === 5) G.toast('Sort appris : Soin (touche 4)', 'quest');
    if (p.lvl === 8) G.toast('Sort appris : Éclair (touche 5)', 'quest');
  }
  G.uiDirty = true;
};

G.damagePlayer = function (raw, srcX, srcY) {
  const p = G.player;
  if (p.hurtT > 0 || p.dashT > 0 || G.state !== 'jeu') return;
  const dmg = Math.max(1, Math.round(raw - G.playerDef() * 0.6));
  p.pv -= dmg;
  p.hurtT = 0.6;
  G.sfx('mal');
  G.addDmgText(p.x + 8, p.y - 14, '-' + dmg, '#ff6050');
  burst(p.x + 8, p.y - 6, '#d84030', 6);
  // recul
  if (srcX !== undefined) {
    const d = Math.max(8, G.dist(srcX, srcY, p.x, p.y));
    p.kbx = (p.x - srcX) / d * 160; p.kby = (p.y - srcY) / d * 160; p.kbT = 0.12;
  }
  if (p.pv <= 0) { p.pv = 0; G.mortJoueur(); }
  G.uiDirty = true;
};

/* Déplacement avec glissement le long des murs */
G.moveBox = function (world, e, dx, dy) {
  if (dx && G.boxFree(world, e.x + dx, e.y, e.w, e.h)) e.x += dx;
  else if (dx) { // glisse par pas de 1px
    const s = Math.sign(dx);
    for (let i = 0; i < Math.abs(dx); i++) { if (G.boxFree(world, e.x + s, e.y, e.w, e.h)) e.x += s; else break; }
  }
  if (dy && G.boxFree(world, e.x, e.y + dy, e.w, e.h)) e.y += dy;
  else if (dy) {
    const s = Math.sign(dy);
    for (let i = 0; i < Math.abs(dy); i++) { if (G.boxFree(world, e.x, e.y + s, e.w, e.h)) e.y += s; else break; }
  }
};

G.updatePlayer = function (dt) {
  const p = G.player, w = G.world;
  p.tempsJeu += dt;
  p.atkT = Math.max(0, p.atkT - dt);
  p.swing = Math.max(0, p.swing - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  for (const k in p.sortCd) p.sortCd[k] = Math.max(0, p.sortCd[k] - dt);
  p.end = Math.min(p.endmax, p.end + dt * 18);
  p.pm = Math.min(p.pmmax, p.pm + dt * 0.6);

  // recul
  if (p.kbT > 0) {
    p.kbT -= dt;
    G.moveBox(w, p, p.kbx * dt, p.kby * dt);
  }

  let [dx, dy] = G.moveAxis();
  p.bouge = !!(dx || dy);
  if (p.bouge) {
    if (Math.abs(dx) >= Math.abs(dy)) p.dir = dx < 0 ? 'l' : 'r';
    else p.dir = dy < 0 ? 'u' : 'd';
    p.animT += dt * 8;
  } else p.animT = 0;
  p.frame = p.bouge ? (1 + (Math.floor(p.animT) % 2)) : 0;

  let vit = 130;
  if (p.dashT > 0) { p.dashT -= dt; vit = 340; if (!dx && !dy) { [dx, dy] = DIRV[p.dir]; } }
  G.moveBox(w, p, dx * vit * dt, dy * vit * dt);

  // lave
  if (G.onLava(w, p.x, p.y, p.w, p.h)) { p.hurtT = 0; G.damagePlayer(8 + p.lvl); }

  // ramassage
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    if (d.noPickup > 0) continue;
    const dd = G.dist(d.x, d.y, p.x + p.w / 2, p.y + p.h / 2);
    if (dd < 34) { d.x += (p.x + 8 - d.x) * dt * 8; d.y += (p.y + 4 - d.y) * dt * 8; }
    if (dd < 12) {
      if (d.or) { p.or += d.or; G.sfx('or'); G.addDmgText(d.x, d.y - 8, '+' + d.or + ' or', '#f0d060'); }
      else if (G.addItem(d.id, d.n)) { G.sfx('objet'); G.addDmgText(d.x, d.y - 8, G.ITEMS[d.id].nom, '#a0e0a0'); if (G.onCollect) G.onCollect(d.id); }
      else continue;
      G.drops.splice(i, 1);
      G.uiDirty = true;
    }
  }
};

const DIRV = { d: [0, 1], u: [0, -1], l: [-1, 0], r: [1, 0] };

/* ---- Attaque de mêlée / arc ---- */
G.playerAttack = function () {
  const p = G.player;
  if (p.atkT > 0 || G.state !== 'jeu') return;
  const arme = p.equip.arme ? G.ITEMS[p.equip.arme] : null;
  const cd = arme ? arme.cd : 0.5;
  p.atkT = cd;
  if (arme && arme.cat === 'arc') {
    const [vx, vy] = DIRV[p.dir];
    G.sfx('fleche');
    G.projs.push({ x: p.x + 8, y: p.y - 2, vx: vx * 380, vy: vy * 380, dmg: G.playerAtk(), ami: true, spr: 'fleche', ttl: 1.2, ang: Math.atan2(vy, vx) });
    p.swing = 0.15; p.swingDir = p.dir;
    return;
  }
  // mêlée : cône devant le joueur
  G.sfx('coup');
  p.swing = 0.18; p.swingDir = p.dir;
  const [fx, fy] = DIRV[p.dir];
  const cx = p.x + 8 + fx * 22, cy = p.y - 2 + fy * 22;
  let hit = false;
  for (const e of G.enemies) {
    if (e.pv <= 0) continue;
    const ex = e.x + 8, ey = e.y;
    if (G.dist(cx, cy, ex, ey) < 26 + (e.def.taille || 1) * 6) {
      G.hitEnemy(e, G.playerAtk(), true);
      hit = true;
    }
  }
  if (hit) G.sfx('touche');
};

G.hitEnemy = function (e, raw, melee) {
  const crit = Math.random() < 0.1;
  let dmg = Math.max(1, Math.round(raw * (0.9 + Math.random() * 0.2) * (crit ? 1.8 : 1)));
  e.pv -= dmg;
  e.aggroT = 6; // riposte
  G.addDmgText(e.x + 8, e.y - 18, (crit ? '✦' : '') + dmg, crit ? '#ffd040' : '#ffffff');
  burst(e.x + 8, e.y - 8, '#e8e0d0', 4);
  // recul léger
  if (melee) {
    const p = G.player, d = Math.max(8, G.dist(p.x, p.y, e.x, e.y));
    e.x += (e.x - p.x) / d * 6; e.y += (e.y - p.y) / d * 6;
  }
  if (e.pv <= 0) G.killEnemy(e);
};

G.killEnemy = function (e) {
  e.pv = 0; e.mort = true;
  G.player.tues++;
  G.sfx('mort');
  burst(e.x + 8, e.y - 8, '#a03030', 10);
  G.gainXP(Math.round(e.def.xp * (1 + (e.lvl - 1) * 0.5)));
  // butin
  const table = G.LOOT[e.id] || [];
  for (const [what, prob, mn, mx] of table) {
    if (Math.random() < prob) {
      const n = G.rint(Math.random, mn, mx);
      if (what === 'or') G.drops.push({ x: e.x + 8 + (Math.random() * 16 - 8), y: e.y + (Math.random() * 10 - 5), or: Math.round(n * (1 + e.lvl * 0.15)) });
      else G.drops.push({ x: e.x + 8 + (Math.random() * 16 - 8), y: e.y + (Math.random() * 10 - 5), id: what, n });
    }
  }
  if (e.boss) {
    G.flags.boss[e.flag] = true;
    G.sfx('victoire');
    G.toast(`☠ ${e.nom} est vaincu !`, 'quest');
    if (e.flag === 'dragon') setTimeout(() => G.victoire(), 800);
  }
  if (G.onKill) G.onKill(e.id);
};

/* ---- Sorts ---- */
G.castFeu = function () {
  const p = G.player;
  if (p.lvl < 3) return G.toast('Boule de feu : niveau 3 requis.', 'combat');
  if (p.sortCd.feu > 0) return;
  if (p.pm < 8) { G.sfx('erreur'); return G.toast('Pas assez de mana.', 'combat'); }
  p.pm -= 8; p.sortCd.feu = 1.2;
  const [vx, vy] = DIRV[p.dir];
  G.sfx('sort');
  G.projs.push({ x: p.x + 8, y: p.y - 4, vx: vx * 300, vy: vy * 300, dmg: 8 + G.playerMag() * 2, ami: true, spr: 'boulefeu', ttl: 1.4, explose: true });
  G.uiDirty = true;
};
G.castSoin = function () {
  const p = G.player;
  if (p.lvl < 5) return G.toast('Soin : niveau 5 requis.', 'combat');
  if (p.sortCd.soin > 0) return;
  if (p.pm < 10) { G.sfx('erreur'); return G.toast('Pas assez de mana.', 'combat'); }
  p.pm -= 10; p.sortCd.soin = 4;
  const soin = 20 + G.playerMag() * 2;
  p.pv = Math.min(p.pvmax, p.pv + soin);
  G.sfx('boire');
  G.addDmgText(p.x + 8, p.y - 16, '+' + soin, '#60e880');
  burst(p.x + 8, p.y - 8, '#60e880', 10);
  G.uiDirty = true;
};
G.castEclair = function () {
  const p = G.player;
  if (p.lvl < 8) return G.toast('Éclair : niveau 8 requis.', 'combat');
  if (p.sortCd.eclair > 0) return;
  if (p.pm < 15) { G.sfx('erreur'); return G.toast('Pas assez de mana.', 'combat'); }
  // frappe l'ennemi le plus proche à 7 tuiles
  let best = null, bd = 7 * G.TILE;
  for (const e of G.enemies) {
    if (e.pv <= 0) continue;
    const d = G.dist(p.x, p.y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return G.toast('Aucune cible à portée.', 'combat');
  p.pm -= 15; p.sortCd.eclair = 3;
  G.sfx('sort');
  for (let i = 0; i < 6; i++) G.parts.push({ x: G.lerp(p.x + 8, best.x + 8, i / 5) + (Math.random() * 8 - 4), y: G.lerp(p.y - 6, best.y - 8, i / 5), vx: 0, vy: -20, ttl: 0.25, col: '#a8d8ff', taille: 3 });
  G.hitEnemy(best, 14 + G.playerMag() * 3);
  G.uiDirty = true;
};
G.dash = function () {
  const p = G.player;
  if (p.dashCd > 0 || p.end < 25) return;
  p.end -= 25; p.dashT = 0.16; p.dashCd = 0.6;
  G.sfx('ruee');
  burst(p.x + 8, p.y, '#c8c8d8', 5);
};

G.usePotion = function (id) {
  const p = G.player, def = G.ITEMS[id];
  if (G.countItem(id) <= 0) { G.sfx('erreur'); return; }
  if (def.soin && p.pv >= p.pvmax && !def.mana) return G.toast('PV déjà au maximum.', '');
  G.removeItem(id, 1);
  if (def.soin) { p.pv = Math.min(p.pvmax, p.pv + def.soin); G.addDmgText(p.x + 8, p.y - 16, '+' + def.soin, '#60e880'); }
  if (def.mana) { p.pm = Math.min(p.pmmax, p.pm + def.mana); G.addDmgText(p.x + 8, p.y - 22, '+' + def.mana + ' PM', '#6090f0'); }
  G.sfx('boire');
  G.uiDirty = true;
};

/* ============================================================
   ENNEMIS
   ============================================================ */
G.spawnEnemy = function (id, tx, ty, lvl, opts = {}) {
  const def = G.ENNEMIS[id]; if (!def) return null;
  lvl = Math.max(1, lvl || 1);
  const e = {
    id, def, lvl,
    x: tx * G.TILE + 8, y: ty * G.TILE + 16,
    w: 16, h: 10, dir: 'd', frame: 0, animT: Math.random() * 10,
    pvmax: Math.round(def.pv * (1 + (lvl - 1) * 0.45)),
    atk: Math.round(def.atk * (1 + (lvl - 1) * 0.3)),
    state: 'errer', errT: 0, errDx: 0, errDy: 0, atkCd: 0, tirCd: 0, invT: 0,
    home: { x: tx * G.TILE + 8, y: ty * G.TILE + 16 },
    boss: !!opts.boss, nom: opts.nom || def.nom, flag: opts.flag,
    ambiant: !!opts.ambiant, aggroT: 0,
  };
  e.pv = e.pvmax;
  G.enemies.push(e);
  return e;
};

G.updateEnemies = function (dt) {
  const p = G.player, w = G.world;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.mort) { G.enemies.splice(i, 1); continue; }
    const pd = G.dist(e.x, e.y, p.x, p.y);
    // despawn des ennemis ambiants trop loin
    if (e.ambiant && pd > 34 * G.TILE) { G.enemies.splice(i, 1); continue; }
    if (pd > 26 * G.TILE) continue; // gel hors écran
    e.animT += dt * 6;
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.tirCd = Math.max(0, e.tirCd - dt);
    e.aggroT = Math.max(0, e.aggroT - dt);

    const aggroR = e.def.aggro * G.TILE;
    const chasse = (pd < aggroR || e.aggroT > 0) && p.pv > 0;

    let vx = 0, vy = 0;
    if (chasse) {
      e.state = 'chasse';
      const dhome = G.dist(e.x, e.y, e.home.x, e.home.y);
      if (!e.ambiant && !e.boss && dhome > 20 * G.TILE) { e.state = 'retour'; }
      const portee = e.def.tir ? e.def.portee * G.TILE * 0.7 : 22;
      if (pd > portee) {
        vx = (p.x - e.x) / pd; vy = (p.y - e.y) / pd;
      }
      // attaque de mêlée
      if (pd < 26 + (e.def.taille || 1) * 6 && e.atkCd <= 0) {
        e.atkCd = 1.0;
        G.damagePlayer(e.atk * (0.9 + Math.random() * 0.2), e.x, e.y);
      }
      // tir
      if (e.def.tir && pd < e.def.portee * G.TILE && e.tirCd <= 0) {
        e.tirCd = e.def.tcool;
        const d = Math.max(1, pd);
        const spd = 220;
        const shots = e.def.gros ? 3 : 1;
        for (let s = 0; s < shots; s++) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x) + (s - (shots - 1) / 2) * 0.25;
          G.projs.push({ x: e.x + 8, y: e.y - 8, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: e.atk * 0.8, ami: false, spr: e.def.tir, ttl: 2.2 });
        }
        G.sfx('sort');
      }
      // invocation (nécromancien)
      if (e.def.invoque && e.tirCd <= 0.1 && G.enemies.length < 40 && Math.random() < 0.25) {
        const tx = Math.floor(e.x / G.TILE) + G.rint(Math.random, -2, 2);
        const ty = Math.floor(e.y / G.TILE) + G.rint(Math.random, -2, 2);
        if (!G.tileSolid(w, tx, ty)) { const m = G.spawnEnemy(e.def.invoque, tx, ty, e.lvl - 2, { ambiant: true }); if (m) m.aggroT = 10; }
      }
    } else if (e.state === 'retour') {
      const dh = G.dist(e.x, e.y, e.home.x, e.home.y);
      if (dh < 8) { e.state = 'errer'; e.pv = e.pvmax; }
      else { vx = (e.home.x - e.x) / dh; vy = (e.home.y - e.y) / dh; }
    } else {
      // errance
      e.errT -= dt;
      if (e.errT <= 0) {
        e.errT = 1 + Math.random() * 2.5;
        if (Math.random() < 0.5) { e.errDx = 0; e.errDy = 0; }
        else { const a = Math.random() * Math.PI * 2; e.errDx = Math.cos(a); e.errDy = Math.sin(a); }
      }
      vx = e.errDx * 0.35; vy = e.errDy * 0.35;
    }
    const vit = e.def.vit * (1 + (e.lvl - 1) * 0.02);
    if (vx || vy) {
      e.dir = Math.abs(vx) >= Math.abs(vy) ? (vx < 0 ? 'l' : 'r') : (vy < 0 ? 'u' : 'd');
      if (e.def.vole) { e.x += vx * vit * dt; e.y += vy * vit * dt; }
      else G.moveBox(w, e, vx * vit * dt, vy * vit * dt);
    }
  }
};

/* Instancie les spawns fixes d'une carte */
G.instancierSpawns = function (world) {
  for (const s of world.staticSpawns) {
    if (s.flag && G.flags.boss[s.flag]) continue; // boss déjà tué
    G.spawnEnemy(s.id, s.x, s.y, s.lvl, { boss: s.boss, nom: s.nom, flag: s.flag });
  }
};

/* Spawn ambiant autour du joueur (monde extérieur) */
let spawnTimer = 0;
G.ambientSpawn = function (dt) {
  const w = G.world, p = G.player;
  if (!w.exterieur) return;
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  spawnTimer = 2.2;
  let near = 0;
  for (const e of G.enemies) if (G.dist(e.x, e.y, p.x, p.y) < 22 * G.TILE) near++;
  if (near >= 8 || G.enemies.length > 45) return;
  const a = Math.random() * Math.PI * 2, r = (11 + Math.random() * 7) * G.TILE;
  const tx = Math.floor((p.x + Math.cos(a) * r) / G.TILE), ty = Math.floor((p.y + Math.sin(a) * r) / G.TILE);
  if (tx < 2 || ty < 2 || tx >= w.w - 2 || ty >= w.h - 2) return;
  if (G.tileSolid(w, tx, ty)) return;
  for (const v of w.villages) if (G.dist(tx, ty, v.cx, v.cy) < 18) return;
  const reg = w.region[ty * w.w + tx];
  const table = G.SPAWN_TABLES[reg];
  if (!table || !table.length) return;
  const id = table[Math.floor(Math.random() * table.length)];
  const lvl = G.clamp(G.lvlAt(w, tx, ty) + G.rint(Math.random, -1, 1), 1, 13);
  G.spawnEnemy(id, tx, ty, lvl, { ambiant: true });
};

/* ============================================================
   PNJ
   ============================================================ */
const NPC_PAL = {
  ancien:     { peau: '#e0c0a0', cheveux: '#e8e4dc', haut: '#6a5a7a', bas: '#4a4058', robe: true },
  forgeron:   { peau: '#c08858', cheveux: '#3a2a1a', haut: '#7a3020', bas: '#3a3028' },
  marchand:   { peau: '#e8b088', cheveux: '#8a5a2a', haut: '#3a6a4a', bas: '#4a3a2a', coiffe: 'chapeau' },
  alchimiste: { peau: '#d8a888', cheveux: '#5a3a6a', haut: '#5a3a7a', bas: '#3a2a4a', robe: true, coiffe: 'capuche' },
  aubergiste: { peau: '#e8b890', cheveux: '#a8682a', haut: '#8a5a30', bas: '#5a4630' },
  garde:      { peau: '#d8a878', cheveux: '#4a3a2a', haut: '#7a8a9a', bas: '#4a5060', coiffe: 'casque' },
  mystique:   { peau: '#c8b8d8', cheveux: '#d8d0e8', haut: '#2a4a8a', bas: '#1a2a5a', robe: true, coiffe: 'capuche' },
};

G.instancierNPCs = function (world) {
  for (const n of world.npcs) {
    let pal = NPC_PAL[n.role];
    if (!pal) { // villageois : palette variée déterministe
      const r = G.mulberry32(n.nom.charCodeAt(0) * 131 + n.nom.length);
      pal = {
        peau: G.choice(r, ['#e8b088', '#d8a078', '#c08858', '#e8c0a0']),
        cheveux: G.choice(r, ['#3a2a1a', '#8a5a2a', '#c8a040', '#1a140e', '#a04028']),
        haut: G.choice(r, ['#7a4a3a', '#4a6a3a', '#3a5a7a', '#8a7040', '#6a3a5a']),
        bas: G.choice(r, ['#4a3a5a', '#3a3028', '#5a4630']),
      };
    }
    G.npcsE.push({
      role: n.role, nom: n.nom, village: n.village, vi: n.vi,
      x: n.x * G.TILE + 8, y: n.y * G.TILE + 16, w: 16, h: 10,
      dir: 'd', frame: 0, animT: 0,
      spr: G.makeHumanoid(pal),
      home: { x: n.x * G.TILE + 8, y: n.y * G.TILE + 16 },
      errT: Math.random() * 3, errDx: 0, errDy: 0,
      quetes: n.quetes || [],
    });
  }
};

G.updateNPCs = function (dt) {
  const p = G.player;
  for (const n of G.npcsE) {
    const pd = G.dist(n.x, n.y, p.x, p.y);
    if (pd > 20 * G.TILE) continue;
    if (pd < 48) { // face au joueur
      n.dir = Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x < n.x ? 'l' : 'r') : (p.y < n.y ? 'u' : 'd');
      n.frame = 0; continue;
    }
    n.errT -= dt;
    if (n.errT <= 0) {
      n.errT = 2 + Math.random() * 4;
      if (Math.random() < 0.6 || G.dist(n.x, n.y, n.home.x, n.home.y) > 3 * G.TILE) {
        const dh = Math.max(1, G.dist(n.x, n.y, n.home.x, n.home.y));
        n.errDx = dh > 20 ? (n.home.x - n.x) / dh : 0; n.errDy = dh > 20 ? (n.home.y - n.y) / dh : 0;
      } else { const a = Math.random() * Math.PI * 2; n.errDx = Math.cos(a); n.errDy = Math.sin(a); }
      if (Math.random() < 0.4) { n.errDx = 0; n.errDy = 0; }
    }
    if (n.errDx || n.errDy) {
      n.dir = Math.abs(n.errDx) >= Math.abs(n.errDy) ? (n.errDx < 0 ? 'l' : 'r') : (n.errDy < 0 ? 'u' : 'd');
      n.animT += dt * 6; n.frame = 1 + (Math.floor(n.animT) % 2);
      G.moveBox(G.world, n, n.errDx * 30 * dt, n.errDy * 30 * dt);
    } else n.frame = 0;
  }
};

/* ============================================================
   PROJECTILES & PARTICULES
   ============================================================ */
G.updateProjs = function (dt) {
  const p = G.player, w = G.world;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const pr = G.projs[i];
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.ttl -= dt;
    let dead = pr.ttl <= 0;
    const tx = Math.floor(pr.x / G.TILE), ty = Math.floor(pr.y / G.TILE);
    if (G.tileSolid(w, tx, ty)) dead = true;
    if (!dead && pr.ami) {
      for (const e of G.enemies) {
        if (e.pv <= 0) continue;
        if (Math.abs(e.x + 8 - pr.x) < 14 && Math.abs(e.y - 4 - pr.y) < 16) {
          G.hitEnemy(e, pr.dmg); dead = true;
          if (pr.explose) {
            burst(pr.x, pr.y, '#f89030', 12);
            for (const e2 of G.enemies) if (e2 !== e && e2.pv > 0 && G.dist(e2.x, e2.y, pr.x, pr.y) < 40) G.hitEnemy(e2, pr.dmg * 0.5);
          }
          break;
        }
      }
    } else if (!dead && !pr.ami) {
      if (Math.abs(p.x + 8 - pr.x) < 12 && Math.abs(p.y - pr.y) < 14) {
        G.damagePlayer(pr.dmg, pr.x - pr.vx, pr.y - pr.vy);
        dead = true;
      }
    }
    if (dead) {
      if (pr.spr === 'boulefeu' || pr.spr === 'crachefeu') burst(pr.x, pr.y, '#f89030', 8);
      G.projs.splice(i, 1);
    }
  }
};

function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 70;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, ttl: 0.3 + Math.random() * 0.3, col, taille: 2 + (Math.random() < 0.3 ? 1 : 0) });
  }
}
G.burst = burst;

G.updateParts = function (dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const pt = G.parts[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 120 * dt; pt.ttl -= dt;
    if (pt.ttl <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.dmgTexts.length - 1; i >= 0; i--) {
    const t = G.dmgTexts[i];
    t.y -= 28 * (1 / 60); t.ttl -= dt;
    if (t.ttl <= 0) G.dmgTexts.splice(i, 1);
  }
};

G.addDmgText = function (x, y, txt, col) {
  G.dmgTexts.push({ x, y, txt, col, ttl: 0.9 });
};

G.clearEntities = function () {
  G.enemies.length = 0; G.npcsE.length = 0; G.projs.length = 0;
  G.parts.length = 0; G.drops.length = 0; G.dmgTexts.length = 0;
};
