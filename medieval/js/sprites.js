'use strict';
/* ============================================================
   sprites.js — pixel-art 100% procédural (aucun asset externe)
   ============================================================ */

G.mkCanvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return c;
};

function R(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function P(ctx, x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }

/* Sprite depuis une carte de caractères */
G.spriteFromMap = function (rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = G.mkCanvas(w, h), ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch !== '.' && pal[ch]) P(ctx, x, y, pal[ch]);
  }
  return c;
};

/* ============================================================
   HUMANOÏDES — générateur (joueur, PNJ, bandits, squelettes…)
   opts: {peau, cheveux, haut, bas, coiffe, robe, oreilles, yeux}
   Retourne { d:[3], u:[3], r:[3] } (gauche = miroir de r au rendu)
   ============================================================ */
G.makeHumanoid = function (o) {
  const peau = o.peau || '#e8b088', chev = o.cheveux || '#6a4a2a';
  const haut = o.haut || '#7a4a3a', bas = o.bas || '#4a3a5a';
  const yeux = o.yeux || '#201814', botte = '#2a2018';
  const out = { d: [], u: [], r: [] };

  function tete(ctx, dir, coiffe) {
    if (dir === 'u') { R(ctx, 5, 1, 6, 6, chev); }
    else {
      R(ctx, 5, 2, 6, 5, peau);
      R(ctx, 5, 1, 6, 2, chev);
      if (dir === 'd') { P(ctx, 4, 2, chev); P(ctx, 11, 2, chev); P(ctx, 4, 3, chev); P(ctx, 11, 3, chev); }
      if (dir === 'r') { R(ctx, 5, 2, 2, 4, chev); }
      if (dir === 'd') { P(ctx, 6, 4, yeux); P(ctx, 9, 4, yeux); }
      if (dir === 'r') { P(ctx, 9, 4, yeux); }
    }
    if (o.oreilles && dir !== 'u') { P(ctx, 3, 3, peau); P(ctx, 12, 3, peau); P(ctx, 2, 2, peau); P(ctx, 13, 2, peau); }
    if (coiffe === 'casque') { R(ctx, 5, 1, 6, 3, '#9aa0aa'); R(ctx, 4, 2, 1, 3, '#9aa0aa'); R(ctx, 11, 2, 1, 3, '#9aa0aa'); }
    if (coiffe === 'capuche') { R(ctx, 4, 1, 8, 3, haut); R(ctx, 4, 2, 1, 4, haut); R(ctx, 11, 2, 1, 4, haut); }
    if (coiffe === 'couronne') { R(ctx, 5, 0, 6, 2, '#e8c020'); P(ctx, 5, -0 + 0, '#e8c020'); }
    if (coiffe === 'chapeau') { R(ctx, 4, 1, 8, 2, '#3a5a2a'); R(ctx, 6, 0, 4, 1, '#3a5a2a'); }
  }

  function frame(dir, f) {
    const c = G.mkCanvas(16, 16), ctx = c.getContext('2d');
    const bob = f === 0 ? 0 : 0; // corps stable, jambes animées
    if (o.robe) {
      tete(ctx, dir, o.coiffe);
      // longue robe
      const rx = dir === 'r' ? 6 : 5, rw = dir === 'r' ? 5 : 6;
      R(ctx, rx, 7, rw, 8, haut);
      R(ctx, rx, 14, rw, 1, bas);
      if (f === 1) P(ctx, rx, 14, '#00000000');
      // bras
      if (dir !== 'r') { R(ctx, rx - 1, 7, 1, 3, haut); R(ctx, rx + rw, 7, 1, 3, haut); }
      return c;
    }
    // jambes (animées)
    const lx = dir === 'r' ? 6 : 5, rx2 = dir === 'r' ? 8 : 9;
    if (f === 0) { R(ctx, lx, 11, 2, 4, bas); R(ctx, rx2, 11, 2, 4, bas); }
    if (f === 1) { R(ctx, lx, 11, 2, 3, bas); R(ctx, rx2, 11, 2, 4, bas); }
    if (f === 2) { R(ctx, lx, 11, 2, 4, bas); R(ctx, rx2, 11, 2, 3, bas); }
    R(ctx, lx, f === 1 ? 13 : 14, 2, 1, botte);
    R(ctx, rx2, f === 2 ? 13 : 14, 2, 1, botte);
    // torse
    const bx = dir === 'r' ? 6 : 5, bw = dir === 'r' ? 5 : 6;
    R(ctx, bx, 7 + bob, bw, 4, haut);
    // bras
    if (dir === 'r') {
      const ay = f === 1 ? 8 : f === 2 ? 6 : 7;
      R(ctx, 8, ay, 2, 3, haut); P(ctx, 8, ay + 3, peau); P(ctx, 9, ay + 3, peau);
    } else {
      const aL = f === 1 ? 8 : 7, aR = f === 2 ? 8 : 7;
      R(ctx, bx - 1, aL, 1, 3, haut); P(ctx, bx - 1, aL + 3, peau);
      R(ctx, bx + bw, aR, 1, 3, haut); P(ctx, bx + bw, aR + 3, peau);
    }
    tete(ctx, dir, o.coiffe);
    return c;
  }

  for (const dir of ['d', 'u', 'r']) for (let f = 0; f < 3; f++) out[dir === 'd' ? 'd' : dir === 'u' ? 'u' : 'r'].push(frame(dir, f));
  return out;
};

/* ============================================================
   MONSTRES — cartes de pixels + dessins procéduraux
   ============================================================ */
G.monsterSprites = {};

const MAP_SLIME = [
  '................', '................', '................', '................', '................',
  '.....AAAAAA.....',
  '....ABBBBBBA....',
  '...ABBBBBBBBA...',
  '..ABBDBBBBDBBA..',
  '..ABBBBWWBBBBA..',
  '.ABBBBBBBBBBBBA.',
  '.ABBBBBBBBBBBBA.',
  '.ABBBBBBBBBBBBA.',
  '..AABBBBBBBBAA..',
  '...AAAAAAAAAA...',
  '................'];

const MAP_LOUP = [
  '................', '................', '................', '................',
  '............AA..',
  '...........ABDA.',
  '..A........ABBAA',
  '..BA....AABBBB..',
  '..BBA.ABBBBBBB..',
  '...BBBBBBBBBB...',
  '...BBBBBBBBBB...',
  '....BBBBBBBB....',
  '....BB....BB....',
  '....BB....BB....',
  '....AA....AA....',
  '................'];

const MAP_GOLEM = [
  '................',
  '....AAAAAAAA....',
  '...ABBBBBBBBA...',
  '...ABDBBBBDBA...',
  '...ABBBBBBBBA...',
  '..AABBBBBBBBAA..',
  '.ABBAABBBBAABBA.',
  '.ABBA.ABBA.ABBA.',
  '.ABBA.ABBA.ABBA.',
  '.AAAA.ABBA.AAAA.',
  '......ABBA......',
  '.....AABBAA.....',
  '....ABBAABBA....',
  '....ABBA.ABBA...',
  '....AAAA.AAAA...',
  '................'];

const MAP_SERPENT = [
  '................', '................', '................',
  '......AAA.......',
  '.....ABDBA......',
  '.....ABBBA......',
  '......ABBA......',
  '.......ABBA.....',
  '........ABBA....',
  '.....AABBBBA....',
  '....ABBBBBA.....',
  '...ABBAAA.......',
  '...ABBA..AAA....',
  '....ABBAABBA....',
  '.....AABBBA.....',
  '................'];

const MAP_SCORPION = [
  '................', '................', '................',
  '..........AA....',
  '..........ABA...',
  '...........ABA..',
  '..AA......ABA...',
  '.ABBA....ABBA...',
  '.ABBA..ABBBBA...',
  '..AABBBBBBBBA...',
  '..ABBDBBBBBA....',
  '..ABBBBBBBBA....',
  '...AABBBBAA.....',
  '...A.A..A.A.....',
  '................', '................'];

const MAP_DRAGON = [
  '........................',
  '......AA................',
  '.....ABBA...............',
  '....ABDBBA..............',
  '....ABBBBAA.............',
  '.....ABBBBBA......AAA...',
  '......ABBBBBA....ABBBA..',
  '.......ABBBBBAAAABBBBBA.',
  '....AAAABBBBBBBBBBBBBA..',
  '..AABBBBBBBBBBBBBBBBA...',
  '.ABBBBBBBBBBBBBBBBBA....',
  '.ABWBBBBBBBBBBBBBBA.....',
  '..AABBBBBBBBBBBBBBA.....',
  '....ABBBBBBBBBBBBBBA....',
  '...ABBBBBBBBBBBBBBBBA...',
  '...ABBAABBBBBBBAABBBA...',
  '...ABA..ABBBBBA..ABBA...',
  '...AA...ABBBBBA...AA....',
  '........AABBAA..........',
  '.........ABBA...........',
  '..........ABBA..........',
  '...........ABBA.........',
  '............AAA.........',
  '........................'];

function progMonster(name) {
  const c = G.mkCanvas(16, 16), x = c.getContext('2d');
  switch (name) {
    case 'chauvesouris': {
      const w = '#4a3a5a', wd = '#32284a';
      R(x, 1, 6, 4, 2, w); R(x, 11, 6, 4, 2, w);
      R(x, 2, 5, 3, 1, wd); R(x, 11, 5, 3, 1, wd);
      R(x, 3, 8, 3, 1, w); R(x, 10, 8, 3, 1, w);
      R(x, 6, 5, 4, 5, '#5a4a6a'); P(x, 6, 6, '#e83030'); P(x, 9, 6, '#e83030');
      P(x, 6, 4, wd); P(x, 9, 4, wd);
      break;
    }
    case 'araignee': {
      const b = '#2a2420', p = '#1a1512';
      R(x, 5, 7, 6, 5, b); R(x, 6, 4, 4, 4, b);
      P(x, 6, 5, '#e83030'); P(x, 9, 5, '#e83030');
      for (const [px1, py1] of [[2, 5], [1, 8], [2, 11], [13, 5], [14, 8], [13, 11]]) R(x, px1, py1, 3, 1, p);
      R(x, 3, 6, 2, 1, p); R(x, 11, 6, 2, 1, p);
      break;
    }
    case 'fantome': {
      const b = 'rgba(210,225,245,0.85)', d = 'rgba(160,180,215,0.85)';
      R(x, 4, 3, 8, 9, b); R(x, 5, 2, 6, 1, b); R(x, 3, 5, 1, 6, b); R(x, 12, 5, 1, 6, b);
      R(x, 4, 12, 2, 2, b); R(x, 7, 12, 2, 1, b); R(x, 10, 12, 2, 2, b);
      P(x, 6, 6, '#182030'); P(x, 9, 6, '#182030'); R(x, 7, 9, 2, 2, d);
      break;
    }
    case 'yeti': {
      const f = '#e8ecf4', d = '#b8c0d0';
      R(x, 4, 2, 8, 6, f); R(x, 3, 8, 10, 6, f);
      R(x, 1, 8, 2, 4, f); R(x, 13, 8, 2, 4, f);
      R(x, 4, 14, 3, 1, d); R(x, 9, 14, 3, 1, d);
      P(x, 6, 4, '#3050a0'); P(x, 9, 4, '#3050a0'); R(x, 6, 6, 4, 1, d);
      break;
    }
  }
  return c;
}

G.buildMonsterSprites = function () {
  const M = G.monsterSprites;
  M.slime = G.spriteFromMap(MAP_SLIME, { A: '#2a5a1a', B: '#5ab83a', D: '#183a0a', W: '#a8e888' });
  M.slimetox = G.spriteFromMap(MAP_SLIME, { A: '#4a1a5a', B: '#a03ab8', D: '#2a0a3a', W: '#e088e8' });
  M.loup = G.spriteFromMap(MAP_LOUP, { A: '#2a2422', B: '#6a5e52', D: '#e8b030' });
  M.loupblanc = G.spriteFromMap(MAP_LOUP, { A: '#8a94a4', B: '#e0e6ee', D: '#4090e0' });
  M.golem = G.spriteFromMap(MAP_GOLEM, { A: '#3a3630', B: '#8a8276', D: '#e87820' });
  M.golemglace = G.spriteFromMap(MAP_GOLEM, { A: '#3a5a8a', B: '#a8cce8', D: '#ffffff' });
  M.golemancien = G.spriteFromMap(MAP_GOLEM, { A: '#4a3210', B: '#c8a040', D: '#e83030' });
  M.serpent = G.spriteFromMap(MAP_SERPENT, { A: '#1a3a14', B: '#4a9a3a', D: '#e8e030' });
  M.scorpion = G.spriteFromMap(MAP_SCORPION, { A: '#5a3a10', B: '#c88830', D: '#201408' });
  M.chauvesouris = progMonster('chauvesouris');
  M.araignee = progMonster('araignee');
  M.fantome = progMonster('fantome');
  M.yeti = progMonster('yeti');
  M.dragon = G.spriteFromMap(MAP_DRAGON, { A: '#4a1008', B: '#b83020', D: '#e8d020', W: '#e87850' });
  // humanoïdes ennemis
  M.gobelin = G.makeHumanoid({ peau: '#6aa040', cheveux: '#4a7828', haut: '#5a4630', bas: '#3a2e20', oreilles: true, yeux: '#c02020' });
  M.orc = G.makeHumanoid({ peau: '#4a7838', cheveux: '#2a4820', haut: '#5a3020', bas: '#302018', oreilles: true, yeux: '#e0d020' });
  M.bandit = G.makeHumanoid({ peau: '#d8a078', cheveux: '#3a2a1a', haut: '#4a3a30', bas: '#2a241e', coiffe: 'capuche' });
  M.chefbandit = G.makeHumanoid({ peau: '#d8a078', cheveux: '#1a140e', haut: '#6a1a1a', bas: '#241e18', coiffe: 'capuche' });
  M.squelette = G.makeHumanoid({ peau: '#e0dcd0', cheveux: '#e0dcd0', haut: '#c8c4b8', bas: '#b0aca0', yeux: '#101010' });
  M.zombi = G.makeHumanoid({ peau: '#8aa878', cheveux: '#4a5a3a', haut: '#5a5a48', bas: '#3a3a30', yeux: '#e03030' });
  M.necromancien = G.makeHumanoid({ peau: '#c8b8d8', cheveux: '#2a1a3a', haut: '#3a2050', bas: '#241432', robe: true, coiffe: 'capuche', yeux: '#a030e0' });
  M.momie = G.makeHumanoid({ peau: '#d8cca8', cheveux: '#c8bc98', haut: '#c8bc98', bas: '#b8ac88', yeux: '#2a70e0' });
};

/* ============================================================
   TUILES
   ============================================================ */
G.T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, DIRT: 4, ROCK: 5, SNOW: 6, SWAMP: 7, PATH: 8, FLOOR: 9, WALLW: 10, WALLS: 11, FARM: 12, BRIDGE: 13, CAVEF: 14, CAVEW: 15, LAVA: 16, MTN: 17, CRYPTF: 18, CRYPTW: 19 };
G.SOLID = new Set([G.T.DEEP, G.T.WATER, G.T.MTN, G.T.WALLW, G.T.WALLS, G.T.CAVEW, G.T.LAVA, G.T.CRYPTW]);

const TILE_BASE = {
  [G.T.DEEP]: '#16325c', [G.T.WATER]: '#2a5a9a', [G.T.SAND]: '#d8c078', [G.T.GRASS]: '#4a8a38',
  [G.T.DIRT]: '#8a6a42', [G.T.ROCK]: '#7a7268', [G.T.SNOW]: '#e4e9ef', [G.T.SWAMP]: '#4a6a40',
  [G.T.PATH]: '#b09468', [G.T.FLOOR]: '#9a7648', [G.T.WALLW]: '#5c4224', [G.T.WALLS]: '#6a6a74',
  [G.T.FARM]: '#7a5a32', [G.T.BRIDGE]: '#8a6a3a', [G.T.CAVEF]: '#4a4048', [G.T.CAVEW]: '#262030',
  [G.T.LAVA]: '#d84a10', [G.T.MTN]: '#514c46', [G.T.CRYPTF]: '#4c4658', [G.T.CRYPTW]: '#2a2438'
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = G.clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = G.clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = G.clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}
G.shade = shade;

function drawTileVariant(type, seed, frame) {
  const c = G.mkCanvas(16, 16), x = c.getContext('2d');
  const base = TILE_BASE[type]; const rng = G.mulberry32(seed * 7919 + type * 131 + 1);
  R(x, 0, 0, 16, 16, base);
  const T = G.T;
  if (type === T.GRASS || type === T.SWAMP) {
    for (let i = 0; i < 14; i++) { const px1 = G.rint(rng, 0, 15), py = G.rint(rng, 0, 15); P(x, px1, py, shade(base, rng() < 0.5 ? 0.85 : 1.15)); }
    for (let i = 0; i < 4; i++) { const px1 = G.rint(rng, 1, 14), py = G.rint(rng, 1, 14); P(x, px1, py, shade(base, 1.3)); P(x, px1, py - 1, shade(base, 1.2)); }
    if (type === T.SWAMP) for (let i = 0; i < 3; i++) R(x, G.rint(rng, 0, 12), G.rint(rng, 0, 13), 4, 2, 'rgba(30,50,60,0.5)');
  } else if (type === T.WATER || type === T.DEEP) {
    for (let i = 0; i < 5; i++) {
      const py = (G.rint(rng, 0, 15) + (frame ? 3 : 0)) % 16;
      R(x, G.rint(rng, 0, 10), py, G.rint(rng, 3, 6), 1, shade(base, 1.25));
    }
  } else if (type === T.SAND || type === T.SNOW) {
    for (let i = 0; i < 10; i++) P(x, G.rint(rng, 0, 15), G.rint(rng, 0, 15), shade(base, rng() < 0.5 ? 0.9 : 1.08));
  } else if (type === T.PATH || type === T.DIRT || type === T.CAVEF || type === T.CRYPTF) {
    for (let i = 0; i < 12; i++) P(x, G.rint(rng, 0, 15), G.rint(rng, 0, 15), shade(base, rng() < 0.5 ? 0.82 : 1.12));
    if (type === T.PATH) for (let i = 0; i < 3; i++) R(x, G.rint(rng, 1, 12), G.rint(rng, 1, 13), 2, 1, shade(base, 0.75));
  } else if (type === T.ROCK || type === T.MTN) {
    for (let i = 0; i < 10; i++) P(x, G.rint(rng, 0, 15), G.rint(rng, 0, 15), shade(base, rng() < 0.5 ? 0.8 : 1.2));
    if (type === T.MTN) { R(x, 0, 0, 16, 2, shade(base, 1.35)); R(x, 0, 14, 16, 2, shade(base, 0.6)); }
  } else if (type === T.WALLS || type === T.CAVEW || type === T.CRYPTW) {
    // briques
    x.fillStyle = shade(base, 0.65);
    for (let by = 0; by < 16; by += 4) { R(x, 0, by, 16, 1, shade(base, 0.6)); const off = (by / 4) % 2 ? 4 : 0; for (let bx = off; bx < 16; bx += 8) R(x, bx, by, 1, 4, shade(base, 0.6)); }
    R(x, 0, 0, 16, 1, shade(base, 1.3));
  } else if (type === T.WALLW || type === T.FLOOR || type === T.BRIDGE) {
    // planches
    for (let by = 0; by < 16; by += 4) R(x, 0, by, 16, 1, shade(base, 0.7));
    for (let i = 0; i < 5; i++) P(x, G.rint(rng, 0, 15), G.rint(rng, 0, 15), shade(base, 0.85));
    if (type === T.BRIDGE) { R(x, 0, 0, 2, 16, shade(base, 0.6)); R(x, 14, 0, 2, 16, shade(base, 0.6)); }
  } else if (type === T.FARM) {
    for (let by = 1; by < 16; by += 4) R(x, 0, by, 16, 2, shade(base, 0.75));
    for (let i = 0; i < 4; i++) P(x, G.rint(rng, 1, 14), G.rint(rng, 0, 3) * 4, '#5a9a30');
  } else if (type === T.LAVA) {
    for (let i = 0; i < 6; i++) { const px1 = G.rint(rng, 0, 13), py = G.rint(rng, 0, 13); R(x, px1, (py + (frame ? 2 : 0)) % 14, 3, 2, '#f8a030'); }
    for (let i = 0; i < 3; i++) P(x, G.rint(rng, 0, 15), G.rint(rng, 0, 15), '#701808');
  }
  return c;
}

G.tiles = {}; // type -> [ [v0f0,v0f1], [v1f0,v1f1], ... ] 4 variantes × 2 frames
G.buildTiles = function () {
  for (const t of Object.values(G.T)) {
    G.tiles[t] = [];
    for (let v = 0; v < 4; v++) G.tiles[t].push([drawTileVariant(t, v, 0), drawTileVariant(t, v, 1)]);
  }
};

/* ============================================================
   OBJETS DU MONDE (ancre = bas-centre)
   ============================================================ */
G.objs = {};

function mkObj(w, h, fn) { const c = G.mkCanvas(w, h); fn(c.getContext('2d'), w, h); return c; }

G.buildObjects = function () {
  const O = G.objs;
  O.pin = mkObj(16, 26, x => {
    R(x, 7, 20, 2, 6, '#5a3a1a');
    R(x, 3, 14, 10, 6, '#1e5a22'); R(x, 4, 8, 8, 6, '#256a28'); R(x, 5, 3, 6, 6, '#2e7a30'); R(x, 7, 1, 2, 3, '#2e7a30');
    R(x, 3, 14, 10, 1, '#38883a'); R(x, 4, 8, 8, 1, '#42984a');
  });
  O.sapinneige = mkObj(16, 26, x => {
    R(x, 7, 20, 2, 6, '#4a3018');
    R(x, 3, 14, 10, 6, '#2a5a40'); R(x, 4, 8, 8, 6, '#356a4c'); R(x, 5, 3, 6, 6, '#3e7a58');
    R(x, 3, 14, 10, 2, '#e8eef4'); R(x, 4, 8, 8, 2, '#e8eef4'); R(x, 5, 3, 6, 2, '#e8eef4'); R(x, 7, 1, 2, 2, '#e8eef4');
  });
  O.chene = mkObj(18, 24, x => {
    R(x, 8, 17, 3, 7, '#5c3c1c'); R(x, 7, 19, 1, 2, '#5c3c1c');
    R(x, 3, 4, 13, 12, '#2e7a28'); R(x, 1, 7, 2, 7, '#2e7a28'); R(x, 16, 7, 2, 7, '#2e7a28'); R(x, 5, 2, 9, 2, '#2e7a28');
    R(x, 4, 4, 6, 3, '#48a038'); R(x, 11, 6, 4, 3, '#3c8c30'); R(x, 3, 10, 4, 3, '#256820');
  });
  O.palmier = mkObj(18, 26, x => {
    R(x, 8, 10, 2, 16, '#8a6a3a'); P(x, 9, 14, '#7a5a30'); P(x, 8, 19, '#7a5a30');
    R(x, 2, 6, 6, 2, '#3a9a40'); R(x, 10, 6, 6, 2, '#3a9a40'); R(x, 1, 8, 4, 2, '#2e8434');
    R(x, 13, 8, 4, 2, '#2e8434'); R(x, 5, 3, 8, 3, '#48ac4c'); R(x, 7, 8, 4, 2, '#256a28');
  });
  O.arbremort = mkObj(14, 22, x => {
    R(x, 6, 8, 2, 14, '#4c4038'); R(x, 3, 5, 2, 2, '#4c4038'); R(x, 4, 6, 3, 2, '#4c4038');
    R(x, 9, 3, 2, 3, '#4c4038'); R(x, 8, 5, 2, 3, '#4c4038'); R(x, 6, 5, 2, 4, '#4c4038');
  });
  O.arbremarais = mkObj(18, 24, x => {
    R(x, 8, 16, 3, 8, '#3c3424'); R(x, 3, 3, 13, 12, '#2c4c28');
    R(x, 5, 5, 5, 3, '#38602c'); R(x, 4, 14, 2, 6, '#2c4c28'); R(x, 13, 13, 2, 5, '#2c4c28');
  });
  O.cactus = mkObj(12, 18, x => {
    R(x, 5, 2, 3, 16, '#3a8a3a'); R(x, 1, 6, 2, 5, '#3a8a3a'); R(x, 1, 6, 4, 2, '#3a8a3a');
    R(x, 9, 4, 2, 5, '#3a8a3a'); R(x, 8, 4, 3, 2, '#3a8a3a');
    P(x, 6, 4, '#68b868'); P(x, 6, 9, '#68b868'); P(x, 2, 7, '#68b868');
  });
  O.rocher = mkObj(14, 11, x => {
    R(x, 2, 3, 10, 7, '#7a7268'); R(x, 4, 1, 6, 3, '#7a7268'); R(x, 1, 6, 12, 4, '#6a6258');
    R(x, 4, 2, 4, 2, '#948c80'); R(x, 2, 9, 10, 1, '#524c44');
  });
  O.mineraifer = mkObj(14, 11, x => {
    R(x, 2, 3, 10, 7, '#6a6258'); R(x, 4, 1, 6, 3, '#6a6258'); R(x, 1, 6, 12, 4, '#5a544c');
    P(x, 5, 4, '#d88030'); P(x, 8, 3, '#d88030'); P(x, 4, 7, '#d88030'); P(x, 9, 7, '#d88030'); P(x, 7, 5, '#f0a050');
  });
  O.buisson = mkObj(12, 9, x => {
    R(x, 1, 3, 10, 6, '#2e7228'); R(x, 3, 1, 6, 3, '#2e7228'); R(x, 2, 3, 4, 2, '#409838');
  });
  O.buissonbaies = mkObj(12, 9, x => {
    R(x, 1, 3, 10, 6, '#2e7228'); R(x, 3, 1, 6, 3, '#2e7228');
    P(x, 3, 4, '#d83048'); P(x, 7, 3, '#d83048'); P(x, 5, 6, '#d83048'); P(x, 9, 5, '#d83048');
  });
  O.fleur = mkObj(8, 9, x => {
    R(x, 3, 4, 1, 5, '#3a7a2a'); P(x, 2, 2, '#e85a78'); P(x, 4, 2, '#e85a78'); P(x, 3, 1, '#e85a78'); P(x, 3, 3, '#e85a78'); P(x, 3, 2, '#f8d848');
  });
  O.fleurbleue = mkObj(8, 9, x => {
    R(x, 3, 4, 1, 5, '#3a7a2a'); P(x, 2, 2, '#5878e8'); P(x, 4, 2, '#5878e8'); P(x, 3, 1, '#5878e8'); P(x, 3, 3, '#5878e8'); P(x, 3, 2, '#e8e8f8');
  });
  O.champi = mkObj(9, 9, x => {
    R(x, 3, 5, 3, 4, '#e0d8c0'); R(x, 1, 2, 7, 3, '#c04030'); R(x, 2, 1, 5, 1, '#c04030'); P(x, 3, 2, '#f0e8e0'); P(x, 6, 3, '#f0e8e0');
  });
  O.tombe = mkObj(10, 12, x => {
    R(x, 2, 2, 6, 10, '#8a8a90'); R(x, 3, 1, 4, 1, '#8a8a90'); R(x, 3, 4, 4, 1, '#5a5a60'); R(x, 4, 3, 2, 3, '#5a5a60'); R(x, 1, 11, 8, 1, '#6a6a70');
  });
  O.coffre = mkObj(14, 12, x => {
    R(x, 1, 3, 12, 9, '#8a5a24'); R(x, 1, 3, 12, 3, '#a06c2c'); R(x, 1, 6, 12, 1, '#5c3a14');
    R(x, 6, 5, 2, 4, '#e8c030'); R(x, 1, 3, 1, 9, '#5c3a14'); R(x, 12, 3, 1, 9, '#5c3a14');
  });
  O.coffreouvert = mkObj(14, 12, x => {
    R(x, 1, 1, 12, 3, '#6a4418'); R(x, 1, 6, 12, 6, '#8a5a24'); R(x, 2, 5, 10, 2, '#241a0c');
    R(x, 1, 6, 1, 6, '#5c3a14'); R(x, 12, 6, 1, 6, '#5c3a14');
  });
  O.puits = mkObj(18, 20, x => {
    R(x, 2, 12, 14, 8, '#7a7268'); R(x, 4, 13, 10, 5, '#1a2a4a');
    R(x, 3, 4, 2, 9, '#5c3c1c'); R(x, 13, 4, 2, 9, '#5c3c1c'); R(x, 1, 2, 16, 3, '#8a4a20'); R(x, 3, 0, 12, 2, '#8a4a20');
    R(x, 8, 5, 2, 6, '#3a2a14');
  });
  O.pancarte = mkObj(12, 13, x => {
    R(x, 5, 7, 2, 6, '#5c3c1c'); R(x, 1, 1, 10, 6, '#8a5e2c'); R(x, 2, 2, 8, 1, '#6a4620'); R(x, 2, 4, 8, 1, '#6a4620');
  });
  O.barriere = mkObj(16, 12, x => {
    R(x, 1, 2, 2, 10, '#7a5a2c'); R(x, 13, 2, 2, 10, '#7a5a2c'); R(x, 0, 4, 16, 2, '#8a6a34'); R(x, 0, 8, 16, 2, '#8a6a34');
  });
  O.feudecamp = mkObj(14, 10, x => {
    R(x, 2, 7, 10, 3, '#5c4024'); R(x, 1, 8, 3, 2, '#6a4c2c'); R(x, 10, 8, 3, 2, '#6a4c2c');
  });
  O.tente = mkObj(22, 18, x => {
    for (let i = 0; i < 9; i++) { R(x, 10 - i, 2 + i * 1.8 | 0, 2 + i * 2, 2, i % 2 ? '#8a6a3a' : '#7a5c30'); }
    R(x, 9, 10, 4, 8, '#241a10'); R(x, 1, 16, 20, 2, '#6a5028');
  });
  O.statue = mkObj(14, 22, x => {
    R(x, 3, 18, 8, 4, '#7a7a82'); R(x, 5, 8, 4, 10, '#9a9aa2'); R(x, 4, 4, 6, 5, '#9a9aa2');
    R(x, 3, 9, 2, 6, '#8a8a92'); R(x, 9, 9, 2, 6, '#8a8a92'); P(x, 5, 6, '#5a5a62'); P(x, 8, 6, '#5a5a62');
  });
  O.escalierbas = mkObj(16, 16, x => {
    R(x, 0, 0, 16, 16, '#3a3440'); R(x, 2, 2, 12, 12, '#141018');
    R(x, 3, 3, 10, 3, '#4a4450'); R(x, 4, 6, 8, 3, '#38323e'); R(x, 5, 9, 6, 3, '#26202c'); R(x, 6, 12, 4, 2, '#181420');
  });
  O.escalierhaut = mkObj(16, 16, x => {
    R(x, 0, 0, 16, 16, '#3a3440'); R(x, 2, 2, 12, 12, '#5a5464');
    R(x, 3, 11, 10, 3, '#8a94a0'); R(x, 4, 8, 8, 3, '#7a8490'); R(x, 5, 5, 6, 3, '#6a7480'); R(x, 6, 3, 4, 2, '#5a6470');
  });
  O.torche = mkObj(6, 14, x => { R(x, 2, 4, 2, 10, '#5c3c1c'); R(x, 1, 3, 4, 2, '#8a6a34'); });
  O.tonneau = mkObj(12, 13, x => {
    R(x, 1, 1, 10, 12, '#8a5e2c'); R(x, 0, 3, 12, 2, '#5c3a14'); R(x, 0, 8, 12, 2, '#5c3a14'); R(x, 3, 1, 1, 12, '#a0722c');
  });
  O.enclume = mkObj(14, 10, x => {
    R(x, 3, 7, 8, 3, '#3a3a42'); R(x, 5, 4, 4, 3, '#4a4a52'); R(x, 1, 1, 12, 3, '#5a5a64'); R(x, 1, 1, 12, 1, '#7a7a84');
  });
  O.cristal = mkObj(12, 14, x => {
    R(x, 4, 2, 4, 10, '#68c8e8'); R(x, 5, 0, 2, 3, '#a8e8f8'); R(x, 2, 6, 2, 6, '#48a8d8'); R(x, 8, 5, 2, 7, '#48a8d8');
    R(x, 1, 12, 10, 2, '#5a5a62'); P(x, 5, 3, '#e8f8ff');
  });
  O.lit = mkObj(12, 17, x => {
    R(x, 1, 1, 10, 15, '#6a4a24'); R(x, 2, 2, 8, 5, '#e8e0d0'); R(x, 2, 7, 8, 8, '#a03040'); R(x, 2, 7, 8, 1, '#c05060'); R(x, 3, 3, 6, 2, '#f4f0e8');
  });
  O.table = mkObj(16, 12, x => {
    R(x, 1, 1, 14, 7, '#8a5e2c'); R(x, 1, 1, 14, 2, '#a0722c'); R(x, 2, 8, 2, 4, '#5c3a14'); R(x, 12, 8, 2, 4, '#5c3a14');
  });
  O.souche = mkObj(10, 8, x => { R(x, 2, 2, 6, 6, '#6a4a24'); R(x, 3, 3, 4, 3, '#8a6a3a'); P(x, 4, 4, '#6a4a24'); });
  O.autel = mkObj(16, 14, x => {
    R(x, 2, 6, 12, 8, '#5a5a64'); R(x, 1, 4, 14, 3, '#6a6a74'); R(x, 6, 1, 4, 4, '#e8c030'); P(x, 7, 2, '#fff8d0');
  });
  O.osdebris = mkObj(12, 7, x => { R(x, 1, 3, 6, 1, '#d8d4c8'); P(x, 0, 2, '#d8d4c8'); P(x, 7, 4, '#d8d4c8'); R(x, 8, 1, 1, 5, '#c8c4b8'); });
};

/* ============================================================
   ICÔNES D'OBJETS (inventaire) 16×16
   ============================================================ */
G.makeIcon = function (kind, col, col2) {
  const c = G.mkCanvas(16, 16), x = c.getContext('2d');
  col = col || '#c8c8d0'; col2 = col2 || '#7a5a2c';
  switch (kind) {
    case 'epee':
      for (let i = 0; i < 8; i++) { P(x, 12 - i, 2 + i, col); P(x, 11 - i, 2 + i, shade2(col, 1.25)); }
      R(x, 3, 10, 4, 1, col2); R(x, 4, 9, 1, 3, col2); R(x, 2, 12, 2, 2, '#4a3418'); break;
    case 'hache':
      R(x, 7, 3, 2, 11, '#7a5a2c'); R(x, 9, 2, 4, 6, col); R(x, 12, 3, 2, 4, shade2(col, 1.2)); R(x, 9, 2, 1, 6, shade2(col, 0.7)); break;
    case 'arc':
      for (let i = 0; i < 11; i++) P(x, 4 + Math.round(3 * Math.sin(i / 10 * Math.PI)), 2 + i, '#8a5e2c');
      for (let i = 0; i < 11; i++) P(x, 4, 2 + i, '#d8d4c8');
      R(x, 5, 7, 7, 1, col); P(x, 12, 6, col); P(x, 12, 8, col); break;
    case 'baton':
      R(x, 7, 3, 2, 11, '#6a4a24'); R(x, 6, 1, 4, 4, col); P(x, 7, 2, '#ffffff'); break;
    case 'casque':
      R(x, 4, 5, 8, 6, col); R(x, 5, 3, 6, 3, col); R(x, 4, 8, 2, 4, col); R(x, 10, 8, 2, 4, col); R(x, 5, 4, 2, 1, shade2(col, 1.3)); break;
    case 'armure':
      R(x, 4, 3, 8, 9, col); R(x, 2, 3, 2, 4, col); R(x, 12, 3, 2, 4, col); R(x, 6, 3, 4, 2, shade2(col, 0.6)); R(x, 5, 5, 2, 3, shade2(col, 1.25)); break;
    case 'anneau':
      R(x, 5, 6, 6, 7, col2); R(x, 7, 8, 2, 3, '#181008'); R(x, 6, 3, 4, 3, col); P(x, 7, 4, '#ffffff'); break;
    case 'potion':
      R(x, 6, 2, 4, 2, '#b8a888'); R(x, 5, 4, 6, 2, '#d8e8f0'); R(x, 4, 6, 8, 8, '#d8e8f0'); R(x, 5, 8, 6, 5, col); P(x, 6, 9, shade2(col, 1.5)); break;
    case 'viande':
      R(x, 3, 5, 8, 6, '#b84838'); R(x, 4, 6, 4, 3, '#d87858'); R(x, 11, 8, 4, 2, '#e8e0d0'); break;
    case 'pain':
      R(x, 3, 6, 10, 5, '#c89040'); R(x, 4, 5, 8, 2, '#d8a858'); P(x, 5, 7, '#a87830'); P(x, 8, 7, '#a87830'); P(x, 11, 7, '#a87830'); break;
    case 'peau':
      R(x, 4, 3, 8, 10, col); R(x, 3, 5, 2, 5, col); R(x, 11, 5, 2, 5, col); R(x, 5, 4, 3, 4, shade2(col, 1.2)); break;
    case 'os':
      for (let i = 0; i < 7; i++) P(x, 4 + i, 10 - i, '#e0dcd0');
      R(x, 3, 10, 2, 2, '#e0dcd0'); R(x, 10, 3, 2, 2, '#e0dcd0'); R(x, 11, 4, 2, 2, '#e0dcd0'); R(x, 4, 11, 2, 2, '#e0dcd0'); break;
    case 'gelee':
      R(x, 4, 8, 8, 5, col); R(x, 5, 6, 6, 3, col); P(x, 6, 8, shade2(col, 1.5)); break;
    case 'minerai':
      R(x, 4, 7, 8, 6, '#6a6258'); R(x, 5, 5, 5, 3, '#6a6258'); P(x, 6, 8, col); P(x, 9, 9, col); P(x, 7, 6, col); break;
    case 'lingot':
      R(x, 3, 8, 10, 4, col); R(x, 4, 6, 8, 3, shade2(col, 1.2)); R(x, 3, 8, 10, 1, shade2(col, 0.8)); break;
    case 'gemme':
      R(x, 6, 4, 4, 8, col); R(x, 4, 6, 8, 4, col); P(x, 7, 5, '#ffffff'); P(x, 6, 6, shade2(col, 1.4)); break;
    case 'parchemin':
      R(x, 4, 2, 8, 12, '#e8dcb8'); R(x, 4, 2, 8, 2, '#c8b888'); R(x, 4, 12, 8, 2, '#c8b888'); R(x, 6, 6, 4, 1, '#8a7040'); R(x, 6, 8, 4, 1, '#8a7040'); break;
    case 'lettre':
      R(x, 3, 4, 10, 8, '#f0e8d8'); R(x, 3, 4, 10, 1, '#c8b888'); P(x, 7, 7, '#c03030'); P(x, 8, 7, '#c03030'); P(x, 7, 8, '#c03030'); P(x, 8, 8, '#c03030'); break;
    case 'cle':
      R(x, 4, 3, 4, 4, col); R(x, 5, 4, 2, 2, '#181008'); R(x, 6, 7, 2, 6, col); R(x, 8, 10, 2, 1, col); R(x, 8, 12, 2, 1, col); break;
    case 'piece':
      R(x, 5, 4, 6, 8, '#e8c030'); R(x, 4, 5, 8, 6, '#e8c030'); R(x, 6, 6, 2, 4, '#c89818'); P(x, 6, 5, '#fff0a0'); break;
    case 'croc':
      for (let i = 0; i < 6; i++) R(x, 6 + (i >> 1), 3 + i, 2, 1, '#f0ece0'); P(x, 9, 9, '#d8d0c0'); break;
    case 'essence':
      R(x, 5, 5, 6, 7, col); R(x, 6, 3, 4, 3, col); P(x, 7, 6, '#ffffff'); R(x, 4, 7, 1, 3, col); R(x, 11, 7, 1, 3, col); break;
    case 'ecaille':
      R(x, 5, 3, 6, 8, col); R(x, 4, 5, 8, 5, col); R(x, 6, 11, 4, 2, col); P(x, 6, 5, shade2(col, 1.35)); break;
    case 'fragment':
      P(x, 8, 2, col); R(x, 7, 3, 3, 2, col); R(x, 5, 5, 7, 3, col); R(x, 6, 8, 5, 2, col); R(x, 7, 10, 2, 3, col); P(x, 5, 11, col); P(x, 11, 10, col); P(x, 8, 5, '#ffffff'); break;
    case 'sceau':
      R(x, 4, 4, 8, 8, '#8a2020'); R(x, 6, 2, 4, 3, '#c8a040'); R(x, 6, 6, 4, 4, '#c8a040'); P(x, 7, 7, '#8a2020'); break;
    case 'plume':
      for (let i = 0; i < 8; i++) R(x, 9 - i, 3 + i, 3, 1, col); R(x, 3, 11, 2, 3, '#8a7040'); break;
    case 'anneaux2':
      R(x, 4, 5, 5, 6, '#c8a040'); R(x, 6, 7, 1, 2, '#181008'); R(x, 8, 6, 5, 6, '#b8c0c8'); R(x, 10, 8, 1, 2, '#181008'); break;
  }
  return c;
};
function shade2(hex, f) { return shade(hex, f); }

/* Étoiles/effets de projectiles */
G.buildFx = function () {
  G.fx = {};
  G.fx.boulefeu = mkObj(10, 10, x => {
    R(x, 2, 2, 6, 6, '#f89030'); R(x, 3, 1, 4, 8, '#f89030'); R(x, 1, 3, 8, 4, '#f89030'); R(x, 3, 3, 4, 4, '#ffd860'); R(x, 4, 4, 2, 2, '#fff8d0');
  });
  G.fx.fleche = mkObj(12, 4, x => {
    R(x, 0, 1, 9, 1, '#8a6a3a'); R(x, 9, 0, 3, 3, '#b8bcc4'); R(x, 0, 0, 2, 3, '#d8d4c8');
  });
  G.fx.eclair = mkObj(10, 10, x => {
    R(x, 4, 0, 3, 4, '#a8d8ff'); R(x, 2, 3, 4, 3, '#e8f4ff'); R(x, 5, 5, 3, 5, '#a8d8ff');
  });
  G.fx.crachefeu = mkObj(12, 12, x => {
    R(x, 2, 2, 8, 8, '#e84010'); R(x, 3, 3, 6, 6, '#f89030'); R(x, 4, 4, 4, 4, '#ffd860');
  });
  G.fx.toile = mkObj(8, 8, x => {
    R(x, 2, 2, 4, 4, '#e8e8e0'); P(x, 1, 1, '#e8e8e0'); P(x, 6, 6, '#e8e8e0'); P(x, 1, 6, '#e8e8e0'); P(x, 6, 1, '#e8e8e0');
  });
  G.fx.ombre = mkObj(10, 10, x => {
    R(x, 2, 2, 6, 6, '#5a2a8a'); R(x, 3, 3, 4, 4, '#8a48c8'); R(x, 4, 4, 2, 2, '#c8a0f0');
  });
};

G.buildSprites = function () {
  G.buildTiles();
  G.buildObjects();
  G.buildMonsterSprites();
  G.buildFx();
};
