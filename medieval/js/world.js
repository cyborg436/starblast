'use strict';
/* ============================================================
   world.js — génération du monde ouvert, villages, donjons
   ============================================================ */

G.TILE = 32;          // taille écran d'une tuile (16px art ×2)
G.WORLD_W = 320;
G.WORLD_H = 320;

/* Régions (pour spawns, ambiance, carte) */
G.REG = { PLAINE: 0, FORET: 1, DESERT: 2, MARAIS: 3, NEIGE: 4, MONTAGNE: 5, MER: 6 };
G.REG_NOMS = ['Plaines d\'Aldenor', 'Forêt de Sombrebois', 'Désert de Cendrelune', 'Marais Putrides', 'Terres Gelées du Nord', 'Monts Grisepierre', 'Mer Intérieure'];

/* Objets du décor : solidité + interaction */
G.OBJDEF = {
  pin: { solid: 1 }, chene: { solid: 1 }, palmier: { solid: 1 }, arbremort: { solid: 1 },
  sapinneige: { solid: 1 }, arbremarais: { solid: 1 }, cactus: { solid: 1 },
  rocher: { solid: 1 }, mineraifer: { solid: 1, inter: 'minerai' },
  buisson: { solid: 0 }, buissonbaies: { solid: 0, inter: 'baies' },
  fleur: { solid: 0 }, fleurbleue: { solid: 0 }, champi: { solid: 0, inter: 'champi' },
  tombe: { solid: 1 }, coffre: { solid: 1, inter: 'coffre' }, coffreouvert: { solid: 1 },
  puits: { solid: 1, inter: 'puits' }, pancarte: { solid: 1, inter: 'pancarte' },
  barriere: { solid: 1 }, feudecamp: { solid: 1, lum: 1 }, tente: { solid: 1 },
  statue: { solid: 1, inter: 'statue' }, escalierbas: { solid: 0, inter: 'descendre' },
  escalierhaut: { solid: 0, inter: 'monter' }, torche: { solid: 0, lum: 1 },
  tonneau: { solid: 1 }, enclume: { solid: 1 }, cristal: { solid: 1, lum: 1 },
  lit: { solid: 1 }, table: { solid: 1 }, souche: { solid: 1 },
  autel: { solid: 1, inter: 'autel' }, osdebris: { solid: 0 },
};

const SYLL1 = ['Bel', 'Mor', 'Ald', 'Var', 'Thor', 'Gal', 'Ren', 'Osk', 'Bram', 'Cael', 'Dun', 'Fen'];
const SYLL2 = ['ric', 'wen', 'dor', 'mir', 'gan', 'wyn', 'ald', 'nor', 'iel', 'mund', 'bert', 'ra'];
const VILL1 = ['Pont', 'Val', 'Mont', 'Bois', 'Clair', 'Haut', 'Roche', 'Vert'];
const VILL2 = ['brume', 'doré', 'les-Eaux', 'fontaine', 'lune', 'ferme', 'garde', 'colline'];

G.nomPerso = rng => G.choice(rng, SYLL1) + G.choice(rng, SYLL2);
G.nomVillage = rng => G.choice(rng, VILL1) + '-' + G.choice(rng, VILL2);

/* ============================================================
   Génération du monde extérieur
   ============================================================ */
G.genOverworld = function (seed) {
  const W = G.WORLD_W, H = G.WORLD_H, T = G.T;
  const tiles = new Uint8Array(W * H);
  const variant = new Uint8Array(W * H);
  const region = new Uint8Array(W * H);
  const rng = G.mulberry32(seed);

  /* --- terrain par bruit --- */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      variant[i] = (G.hash2(x, y, seed + 42) * 4) | 0;
      // altitude avec océan sur les bords
      const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2;
      const edge = Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 3);
      let e = G.fbm(x / 55, y / 55, seed, 5) - edge * 0.55;
      const m = G.fbm(x / 42, y / 42, seed + 999, 4);       // humidité
      const t = G.fbm(x / 68, y / 68, seed + 555, 3) * 0.5 + (y / H) * 0.5; // température (nord froid)

      let tile, reg;
      if (e < 0.30) { tile = T.DEEP; reg = G.REG.MER; }
      else if (e < 0.37) { tile = T.WATER; reg = G.REG.MER; }
      else if (e < 0.405) { tile = T.SAND; reg = t > 0.62 ? G.REG.DESERT : G.REG.PLAINE; }
      else if (e > 0.78) { tile = T.MTN; reg = G.REG.MONTAGNE; }
      else if (e > 0.68) { tile = T.ROCK; reg = G.REG.MONTAGNE; }
      else if (t < 0.30) { tile = T.SNOW; reg = G.REG.NEIGE; }
      else if (t > 0.66 && m < 0.45) { tile = T.SAND; reg = G.REG.DESERT; }
      else if (m > 0.62 && e < 0.52 && t > 0.42) { tile = T.SWAMP; reg = G.REG.MARAIS; }
      else { tile = T.GRASS; reg = m > 0.52 ? G.REG.FORET : G.REG.PLAINE; }
      tiles[i] = tile; region[i] = reg;
    }
  }

  const world = {
    id: 'monde', w: W, h: H, tiles, variant, region,
    objects: new Map(), npcs: [], staticSpawns: [], villages: [], pois: {},
    exterieur: true,
  };
  const idx = (x, y) => y * W + x;
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.DEEP : tiles[idx(x, y)];
  const setObj = (x, y, type, extra) => { world.objects.set(idx(x, y), Object.assign({ type, x, y }, extra)); };
  const clearObj = (x, y) => world.objects.delete(idx(x, y));

  /* --- végétation & décor par région --- */
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y), r = G.hash2(x, y, seed + 77);
      const tl = tiles[i], reg = region[i];
      if (G.SOLID.has(tl)) continue;
      if (tl === T.GRASS) {
        const dens = reg === G.REG.FORET ? 0.22 : 0.035;
        if (r < dens) setObj(x, y, G.hash2(x, y, seed + 3) < 0.6 ? 'pin' : 'chene');
        else if (r < dens + 0.012) setObj(x, y, G.hash2(x, y, seed + 4) < 0.3 ? 'buissonbaies' : 'buisson');
        else if (r < dens + 0.022) setObj(x, y, G.hash2(x, y, seed + 5) < 0.5 ? 'fleur' : 'fleurbleue');
        else if (r < dens + 0.027) setObj(x, y, 'rocher');
        else if (reg === G.REG.FORET && r < dens + 0.033) setObj(x, y, 'champi');
      } else if (tl === T.SNOW) {
        if (r < 0.12) setObj(x, y, 'sapinneige');
        else if (r < 0.135) setObj(x, y, 'rocher');
      } else if (tl === T.SAND && reg === G.REG.DESERT) {
        if (r < 0.03) setObj(x, y, 'cactus');
        else if (r < 0.04) setObj(x, y, 'rocher');
        else if (r < 0.045) setObj(x, y, 'osdebris');
      } else if (tl === T.SWAMP) {
        if (r < 0.10) setObj(x, y, 'arbremarais');
        else if (r < 0.13) setObj(x, y, 'arbremort');
        else if (r < 0.14) setObj(x, y, 'champi');
      } else if (tl === T.ROCK) {
        if (r < 0.05) setObj(x, y, 'rocher');
        else if (r < 0.075) setObj(x, y, 'mineraifer');
      }
    }
  }

  /* --- placement des villages --- */
  const sites = [];
  let tries = 0;
  while (sites.length < 6 && tries < 4000) {
    tries++;
    const x = G.rint(rng, 40, W - 40), y = G.rint(rng, 40, H - 40);
    if (tileAt(x, y) !== T.GRASS) continue;
    // vérifie un carré de terrain praticable
    let ok = true;
    for (let dy = -9; dy <= 9 && ok; dy += 3) for (let dx = -9; dx <= 9 && ok; dx += 3) {
      const tl = tileAt(x + dx, y + dy);
      if (tl !== T.GRASS && tl !== T.SAND && tl !== T.SWAMP) ok = false;
    }
    if (!ok) continue;
    for (const s of sites) if (G.dist(x, y, s.x, s.y) < 52) { ok = false; break; }
    if (ok) sites.push({ x, y });
  }
  // capitale = site le plus proche du centre
  sites.sort((a, b) => G.dist(a.x, a.y, W / 2, H / 2) - G.dist(b.x, b.y, W / 2, H / 2));

  sites.forEach((s, vi) => buildVillage(world, s.x, s.y, vi, rng, setObj, clearObj));
  world.capitale = world.villages[0];

  /* --- routes entre villages --- */
  for (let i = 1; i < world.villages.length; i++) {
    // relie au village le plus proche parmi les précédents
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) {
      const d = G.dist(world.villages[i].cx, world.villages[i].cy, world.villages[j].cx, world.villages[j].cy);
      if (d < bd) { bd = d; best = j; }
    }
    carveRoad(world, world.villages[i], world.villages[best], seed);
  }

  /* --- points d'intérêt --- */
  placePOIs(world, rng, seed, setObj, clearObj);

  /* --- coffres épars --- */
  let placed = 0; tries = 0;
  while (placed < 40 && tries < 6000) {
    tries++;
    const x = G.rint(rng, 12, W - 12), y = G.rint(rng, 12, H - 12);
    const tl = tileAt(x, y);
    if (G.SOLID.has(tl) || tl === T.PATH || world.objects.has(idx(x, y))) continue;
    let nearV = false;
    for (const v of world.villages) if (G.dist(x, y, v.cx, v.cy) < 20) { nearV = true; break; }
    if (nearV) continue;
    setObj(x, y, 'coffre', { cid: 'monde_' + x + '_' + y });
    placed++;
  }

  return world;
};

/* Niveau de zone selon la distance à la capitale */
G.lvlAt = function (world, x, y) {
  if (world.lvlFixe) return world.lvlFixe;
  const c = G.overworld.capitale;
  const d = G.dist(x, y, c.cx, c.cy);
  return G.clamp(Math.round(1 + d / 26), 1, 12);
};

/* Table de spawn selon la région */
G.SPAWN_TABLES = {
  [G.REG.PLAINE]:   ['slime', 'slime', 'loup', 'gobelin'],
  [G.REG.FORET]:    ['loup', 'gobelin', 'araignee', 'bandit', 'loup'],
  [G.REG.DESERT]:   ['scorpion', 'serpent', 'bandit', 'momie'],
  [G.REG.MARAIS]:   ['slimetox', 'serpent', 'zombi', 'fantome'],
  [G.REG.NEIGE]:    ['loupblanc', 'yeti', 'golemglace'],
  [G.REG.MONTAGNE]: ['golem', 'chauvesouris', 'orc'],
  [G.REG.MER]:      [],
};

/* ============================================================
   Villages
   ============================================================ */
function buildVillage(world, cx, cy, vi, rng, setObj, clearObj) {
  const T = G.T, W = world.w;
  const RAD = 13;
  const nom = vi === 0 ? 'Aldenor' : G.nomVillage(rng);
  const vill = { cx, cy, nom, capitale: vi === 0 };
  world.villages.push(vill);

  // déblaie et aplanit
  for (let y = cy - RAD; y <= cy + RAD; y++) for (let x = cx - RAD; x <= cx + RAD; x++) {
    if (x < 1 || y < 1 || x >= W - 1 || y >= world.h - 1) continue;
    if (G.dist(x, y, cx, cy) > RAD + 0.5) continue;
    clearObj(x, y);
    const tl = world.tiles[y * W + x];
    if (tl !== T.WATER && tl !== T.DEEP) world.tiles[y * W + x] = T.GRASS;
  }
  // place du village
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) world.tiles[y * W + x] = T.PATH;
  setObj(cx, cy, 'puits');
  setObj(cx - 2, cy + 2, 'torche'); setObj(cx + 2, cy + 2, 'torche');
  setObj(cx + 3, cy - 3, 'pancarte', { msg: `— ${nom} —\n${vi === 0 ? 'Capitale de la région. Que l\'Aube vous garde.' : 'Village paisible d\'Aldenor.'}` });

  /* bâtiment : murs pierre/bois, sol plancher, porte au sud */
  function maison(bx, by, bw, bh, pierre) {
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
      clearObj(x, y);
      const bord = (x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1);
      world.tiles[y * W + x] = bord ? (pierre ? T.WALLS : T.WALLW) : T.FLOOR;
    }
    const dx = bx + (bw >> 1);
    world.tiles[(by + bh - 1) * W + dx] = T.FLOOR;  // porte
    // chemin vers la place
    return { dx, dy: by + bh - 1, bx, by, bw, bh };
  }
  function chemin(x0, y0, x1, y1) {
    let x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      const tl = world.tiles[y * W + x];
      if (tl === T.GRASS) world.tiles[y * W + x] = T.PATH;
      if (x !== x1) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    }
  }

  const roles = vi === 0
    ? ['forgeron', 'marchand', 'alchimiste', 'aubergiste', 'maison', 'maison']
    : ['marchand', 'aubergiste', G.choice(rng, ['forgeron', 'alchimiste']), 'maison'];

  const spots = [[-11, -9, 7, 6], [4, -9, 7, 6], [-11, 2, 8, 7], [5, 2, 7, 6], [-3, -11, 6, 5], [7, -3, 6, 5]];
  const npcsV = [];

  roles.forEach((role, k) => {
    if (k >= spots.length) return;
    const [ox, oy, bw, bh] = spots[k];
    const m = maison(cx + ox, cy + oy, bw, bh, role === 'forgeron' || vi === 0);
    chemin(m.dx, m.dy + 1, cx, cy);
    setObj(m.dx - 1, m.dy, 'torche');
    const ix = m.bx + 1 + G.rint(rng, 0, m.bw - 3), iy = m.by + 1;
    if (role === 'forgeron') { setObj(m.bx + 1, m.by + 1, 'enclume'); setObj(m.bx + m.bw - 2, m.by + 1, 'tonneau'); }
    if (role === 'aubergiste') { setObj(m.bx + 1, m.by + 1, 'lit'); setObj(m.bx + m.bw - 2, m.by + 1, 'lit'); setObj(m.bx + 2, m.by + 2, 'table'); }
    if (role === 'marchand') { setObj(m.bx + 1, m.by + 1, 'tonneau'); setObj(m.bx + m.bw - 2, m.by + 1, 'table'); }
    if (role === 'alchimiste') { setObj(m.bx + 1, m.by + 1, 'champi'); setObj(m.bx + m.bw - 2, m.by + 1, 'table'); }
    if (role !== 'maison') {
      npcsV.push({ role, x: m.dx, y: m.dy - 1 });
    } else {
      npcsV.push({ role: 'villageois', x: ix, y: iy + 1 });
    }
  });

  // l'ancien (donneur de quête principale) et gardes dans la capitale
  if (vi === 0) {
    npcsV.push({ role: 'ancien', x: cx - 1, y: cy - 3 });
    npcsV.push({ role: 'garde', x: cx - 4, y: cy + 4 });
    npcsV.push({ role: 'garde', x: cx + 4, y: cy + 4 });
  } else {
    npcsV.push({ role: 'villageois', x: cx + 1, y: cy + 3 });
  }
  // petite ferme au sud
  for (let y = cy + 7; y <= cy + 9; y++) for (let x = cx - 4; x <= cx + 1; x++) {
    if (world.tiles[y * W + x] === T.GRASS) { world.tiles[y * W + x] = T.FARM; clearObj(x, y); }
  }
  setObj(cx + 2, cy + 8, 'barriere');

  for (const n of npcsV) {
    n.village = nom; n.vi = vi;
    n.nom = G.nomPerso(rng);
    world.npcs.push(n);
  }
  vill.npcs = npcsV;
}

/* ============================================================
   Routes
   ============================================================ */
function carveRoad(world, a, b, seed) {
  const T = G.T, W = world.w;
  let x = a.cx, y = a.cy + 3;
  let guard = 0;
  while ((x !== b.cx || y !== b.cy) && guard++ < 2000) {
    const i = y * W + x;
    const tl = world.tiles[i];
    if (tl === T.WATER || tl === T.DEEP) world.tiles[i] = T.BRIDGE;
    else if (tl === T.GRASS || tl === T.SAND || tl === T.SNOW || tl === T.SWAMP || tl === T.ROCK || tl === T.DIRT) {
      world.tiles[i] = T.PATH;
      world.objects.delete(i);
    }
    // avance en biais avec un peu de bruit
    const h = G.hash2(x, y, seed + 31);
    if (Math.abs(b.cx - x) > Math.abs(b.cy - y)) { x += Math.sign(b.cx - x); if (h < 0.25 && y !== b.cy) y += Math.sign(b.cy - y); }
    else { y += Math.sign(b.cy - y); if (h < 0.25 && x !== b.cx) x += Math.sign(b.cx - x); }
  }
}

/* ============================================================
   Points d'intérêt
   ============================================================ */
function placePOIs(world, rng, seed, setObj, clearObj) {
  const T = G.T, W = world.w, H = world.h;
  const cap = world.capitale;
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.DEEP : world.tiles[y * W + x];

  function findSpot(minD, maxD, pred) {
    for (let t = 0; t < 5000; t++) {
      const x = G.rint(rng, 15, W - 15), y = G.rint(rng, 15, H - 15);
      const d = G.dist(x, y, cap.cx, cap.cy);
      if (d < minD || d > maxD) continue;
      if (!pred(tileAt(x, y), x, y)) continue;
      let nearV = false;
      for (const v of world.villages) if (G.dist(x, y, v.cx, v.cy) < 22) { nearV = true; break; }
      if (!nearV) return { x, y };
    }
    return null;
  }
  const clearZone = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) clearObj(x + dx, y + dy); };

  /* Camp de bandits (quête principale 2) */
  let s = findSpot(35, 70, tl => tl === T.GRASS);
  if (!s) s = { x: cap.cx + 40, y: cap.cy };
  clearZone(s.x, s.y, 5);
  world.pois.camp = s;
  setObj(s.x, s.y, 'feudecamp');
  setObj(s.x - 3, s.y - 2, 'tente'); setObj(s.x + 3, s.y - 2, 'tente'); setObj(s.x, s.y - 4, 'tente');
  setObj(s.x - 3, s.y + 2, 'tonneau'); setObj(s.x + 3, s.y + 2, 'osdebris');
  for (let i = 0; i < 4; i++) world.staticSpawns.push({ id: 'bandit', x: s.x - 3 + i * 2, y: s.y + 1 + (i % 2), lvl: 3 });
  world.staticSpawns.push({ id: 'chefbandit', x: s.x, y: s.y - 2, lvl: 4, boss: true, nom: 'Garrok le Balafré', flag: 'chefbandit' });

  /* Cimetière + crypte (quête principale 3) */
  s = findSpot(45, 90, tl => tl === T.GRASS || tl === T.SWAMP);
  if (!s) s = { x: cap.cx, y: cap.cy + 45 };
  clearZone(s.x, s.y, 5);
  world.pois.crypte = s;
  for (let i = 0; i < 8; i++) setObj(s.x - 4 + (i % 4) * 2, s.y - 3 + ((i / 4) | 0) * 2, 'tombe');
  setObj(s.x, s.y + 1, 'escalierbas', { dest: 'crypte', verrou: 'clecrypte', msg: 'La grille est verrouillée. Il faut la clé de la crypte.' });
  setObj(s.x - 2, s.y + 2, 'arbremort'); setObj(s.x + 2, s.y + 2, 'arbremort');
  world.staticSpawns.push({ id: 'zombi', x: s.x - 3, y: s.y + 3, lvl: 4 });
  world.staticSpawns.push({ id: 'fantome', x: s.x + 3, y: s.y + 3, lvl: 4 });

  /* Mine (minerai pour la forge) */
  s = findSpot(30, 110, tl => tl === T.ROCK);
  if (!s) s = findSpot(20, 140, tl => tl === T.GRASS) || { x: cap.cx - 40, y: cap.cy };
  clearZone(s.x, s.y, 2);
  world.pois.mine = s;
  setObj(s.x, s.y, 'escalierbas', { dest: 'mine' });
  setObj(s.x - 1, s.y + 1, 'pancarte', { msg: 'Mine de Grisepierre.\nDANGER : infestée depuis l\'Effondrement.' });

  /* Ruines anciennes (boss golem + coffre) */
  s = findSpot(60, 120, tl => tl === T.GRASS || tl === T.SAND);
  if (!s) s = { x: cap.cx, y: cap.cy - 50 };
  clearZone(s.x, s.y, 4);
  world.pois.ruines = s;
  setObj(s.x - 3, s.y - 2, 'statue'); setObj(s.x + 3, s.y - 2, 'statue');
  setObj(s.x - 3, s.y + 2, 'statue'); setObj(s.x + 3, s.y + 2, 'statue');
  setObj(s.x, s.y - 1, 'autel');
  setObj(s.x, s.y + 2, 'coffre', { cid: 'ruines', tier: 3 });
  world.staticSpawns.push({ id: 'golemancien', x: s.x, y: s.y + 4, lvl: 8, boss: true, nom: 'Gardien des Ruines', flag: 'golemancien' });

  /* Tour du mystique (marchand haut niveau) */
  s = findSpot(70, 130, tl => tl === T.GRASS || tl === T.SNOW || tl === T.ROCK);
  if (s) {
    clearZone(s.x, s.y, 3);
    world.pois.tour = s;
    for (let y = s.y - 2; y <= s.y + 1; y++) for (let x = s.x - 2; x <= s.x + 2; x++) {
      const bord = (x === s.x - 2 || x === s.x + 2 || y === s.y - 2 || y === s.y + 1);
      world.tiles[y * W + x] = bord ? T.WALLS : T.FLOOR;
    }
    world.tiles[(s.y + 1) * W + s.x] = T.FLOOR;
    setObj(s.x - 1, s.y - 1, 'cristal'); setObj(s.x + 1, s.y - 1, 'cristal');
    world.npcs.push({ role: 'mystique', nom: 'Zephyrine', x: s.x, y: s.y, village: 'la tour', vi: -1 });
  }

  /* Antre du dragon (finale) — au nord, en montagne/neige */
  s = findSpot(80, 160, (tl, x, y) => (tl === T.ROCK || tl === T.SNOW) && y < H * 0.45);
  if (!s) s = findSpot(60, 200, tl => tl === T.ROCK || tl === T.SNOW) || { x: cap.cx, y: 30 };
  clearZone(s.x, s.y, 3);
  world.pois.antre = s;
  setObj(s.x, s.y, 'escalierbas', { dest: 'antre' });
  setObj(s.x - 2, s.y + 1, 'osdebris'); setObj(s.x + 2, s.y + 1, 'osdebris');
  setObj(s.x - 1, s.y - 1, 'torche'); setObj(s.x + 1, s.y - 1, 'torche');
  setObj(s.x, s.y + 2, 'pancarte', { msg: 'ANTRE DE VERMITHRAX.\nFuyez, pauvres fous.' });
}

/* ============================================================
   Donjons (générés à la demande, mis en cache)
   ============================================================ */
G.DONJONS = {
  crypte: { nom: 'Crypte Oubliée', taille: 42, sol: G.T.CRYPTF, mur: G.T.CRYPTW, lvl: 5,
    ennemis: ['squelette', 'squelette', 'zombi', 'fantome'], nEnnemis: 16,
    boss: { id: 'necromancien', nom: 'Malakar le Nécromancien', lvl: 7, flag: 'necromancien' } },
  mine: { nom: 'Mine de Grisepierre', taille: 48, sol: G.T.CAVEF, mur: G.T.CAVEW, lvl: 6,
    ennemis: ['chauvesouris', 'araignee', 'gobelin', 'golem'], nEnnemis: 18, veines: 12 },
  antre: { nom: 'Antre de Vermithrax', taille: 40, sol: G.T.CAVEF, mur: G.T.CAVEW, lava: true, lvl: 11,
    ennemis: ['golem', 'orc', 'chauvesouris'], nEnnemis: 12,
    boss: { id: 'dragon', nom: 'Vermithrax, Terreur d\'Aldenor', lvl: 13, flag: 'dragon' } },
};

G.genDonjon = function (did, seed) {
  const def = G.DONJONS[did];
  const S = def.taille, T = G.T;
  const rng = G.mulberry32(seed + did.length * 7877 + did.charCodeAt(0) * 131);
  const tiles = new Uint8Array(S * S).fill(def.mur);
  const variant = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) variant[i] = (rng() * 4) | 0;

  /* salles reliées en chaîne */
  const rooms = [];
  let tries = 0;
  while (rooms.length < 9 && tries++ < 400) {
    const w = G.rint(rng, 5, 9), h = G.rint(rng, 5, 9);
    const x = G.rint(rng, 2, S - w - 2), y = G.rint(rng, 2, S - h - 2);
    let ok = true;
    for (const r of rooms) if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) { ok = false; break; }
    if (!ok) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const carve = (x, y) => { if (x > 0 && y > 0 && x < S - 1 && y < S - 1) tiles[y * S + x] = def.sol; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
  for (let i = 1; i < rooms.length; i++) {
    let { cx, cy } = rooms[i - 1];
    const { cx: tx, cy: ty } = rooms[i];
    while (cx !== tx) { carve(cx, cy); carve(cx, cy + 1); cx += Math.sign(tx - cx); }
    while (cy !== ty) { carve(cx, cy); carve(cx + 1, cy); cy += Math.sign(ty - cy); }
  }

  const world = {
    id: did, w: S, h: S, tiles, variant, region: null,
    objects: new Map(), npcs: [], staticSpawns: [], villages: [],
    exterieur: false, lvlFixe: def.lvl, nom: def.nom,
  };
  const setObj = (x, y, type, extra) => world.objects.set(y * S + x, Object.assign({ type, x, y }, extra));

  /* entrée = première salle ; boss = dernière */
  const ent = rooms[0], last = rooms[rooms.length - 1];
  world.entree = { x: ent.cx, y: ent.cy };
  setObj(ent.cx, ent.cy, 'escalierhaut', { dest: 'monde' });
  setObj(ent.cx - 1, ent.cy - 1, 'torche'); setObj(ent.cx + 1, ent.cy - 1, 'torche');

  /* ennemis */
  for (let i = 0; i < def.nEnnemis; i++) {
    const r = rooms[G.rint(rng, 1, rooms.length - 1)];
    world.staticSpawns.push({
      id: G.choice(rng, def.ennemis),
      x: G.rint(rng, r.x + 1, r.x + r.w - 2), y: G.rint(rng, r.y + 1, r.y + r.h - 2),
      lvl: def.lvl + G.rint(rng, -1, 1),
    });
  }
  /* boss + trésor */
  if (def.boss) {
    world.staticSpawns.push({ id: def.boss.id, x: last.cx, y: last.cy, lvl: def.boss.lvl, boss: true, nom: def.boss.nom, flag: def.boss.flag });
    setObj(last.x + 1, last.y + 1, 'coffre', { cid: did + '_boss', tier: 4, garde: def.boss.flag });
    if (did === 'antre') {
      setObj(last.x + last.w - 2, last.y + 1, 'coffre', { cid: 'antre_tresor', tier: 5, garde: def.boss.flag });
      for (let k = 0; k < 4; k++) setObj(G.rint(rng, last.x, last.x + last.w - 1), G.rint(rng, last.y, last.y + last.h - 1), 'osdebris');
    }
  }
  /* veines de minerai (mine) */
  if (def.veines) {
    for (let i = 0; i < def.veines; i++) {
      const r = rooms[G.rint(rng, 1, rooms.length - 1)];
      const x = G.rint(rng, r.x, r.x + r.w - 1), y = G.rint(rng, r.y, r.y + r.h - 1);
      if (!world.objects.has(y * S + x)) setObj(x, y, 'mineraifer', { vid: did + '_' + x + '_' + y });
    }
  }
  /* coffres intermédiaires + torches + lave */
  for (let i = 1; i < rooms.length - 1; i++) {
    const r = rooms[i];
    if (rng() < 0.4) setObj(r.cx, r.y + 1, 'coffre', { cid: did + '_' + i, tier: 2 });
    setObj(r.x + 1, r.y + 1, 'torche');
    if (def.lava && rng() < 0.5) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) {
        const lx = r.x + r.w - 2 - dx, ly = r.y + r.h - 2 - dy;
        if (tiles[ly * S + lx] === def.sol && !world.objects.has(ly * S + lx) && !(lx === ent.cx && ly === ent.cy)) tiles[ly * S + lx] = T.LAVA;
      }
    }
    if (did === 'crypte' && rng() < 0.5) setObj(r.x + r.w - 2, r.y + 1, 'tombe');
    if (did === 'crypte' && rng() < 0.4) setObj(r.cx + 1, r.cy, 'osdebris');
  }
  return world;
};

/* ============================================================
   Collision
   ============================================================ */
G.tileSolid = function (world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  if (G.SOLID.has(world.tiles[ty * world.w + tx])) return true;
  const o = world.objects.get(ty * world.w + tx);
  if (o && G.OBJDEF[o.type] && G.OBJDEF[o.type].solid) return true;
  return false;
};

/* Boîte de collision en pixels (pieds) */
G.boxFree = function (world, px, py, w, h) {
  const TL = G.TILE;
  const x0 = Math.floor(px / TL), y0 = Math.floor(py / TL);
  const x1 = Math.floor((px + w - 1) / TL), y1 = Math.floor((py + h - 1) / TL);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (G.tileSolid(world, tx, ty)) return false;
  }
  return true;
};

/* La lave brûle */
G.onLava = function (world, px, py, w, h) {
  const TL = G.TILE;
  const tx = Math.floor((px + w / 2) / TL), ty = Math.floor((py + h / 2) / TL);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return false;
  return world.tiles[ty * world.w + tx] === G.T.LAVA;
};
