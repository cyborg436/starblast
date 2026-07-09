'use strict';
/* ============================================================
   main.js — boucle de jeu, rendu, interactions, sauvegarde
   ============================================================ */

G.state = 'titre';   // titre | jeu | pause | mort | victoire
G.JOUR = 480;        // durée d'un jour en secondes
G.time = G.JOUR * 0.3;
G.meteo = 'clair';
let meteoT = 60;

const cv = document.getElementById('game');
const cx = cv.getContext('2d');
let nightCv = null, nightCx = null;

function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
  cx.imageSmoothingEnabled = false;
  nightCv = G.mkCanvas(innerWidth, innerHeight);
  nightCx = nightCv.getContext('2d');
}
addEventListener('resize', resize);
resize();

G.cam = { x: 0, y: 0 };
G.flags = null;
G.dungeonCache = {};
G.seed = 0;

/* ============================================================
   Cycle de vie de la partie
   ============================================================ */
const SAVE_KEY = 'aldenor_save_v1';

G.newGame = function (seed) {
  G.seed = seed || ((Math.random() * 1e9) | 0);
  G.flags = { mq: 0, mqProg: 0, boss: {}, coffres: {}, veines: {}, autelT: -999 };
  G.time = G.JOUR * 0.3;
  G.dungeonCache = {};
  G.overworld = G.genOverworld(G.seed);
  G.prerenderMap(G.overworld);
  G.genSideQuests(G.seed);
  G.player = G.newPlayer();
  G.recalcStats(); G.player.pv = G.player.pvmax; G.player.pm = G.player.pmmax;
  G.addItem('ppv1', 2); G.addItem('pain', 3);
  G.enterMap('monde');
  const c = G.overworld.capitale;
  G.player.x = c.cx * G.TILE + 8; G.player.y = (c.cy + 4) * G.TILE;
  demarrerJeu();
  G.toast('Bienvenue à Aldenor ! Parlez à l\'ancien du village (marqueur sur la carte).', 'quest');
  G.toast('Appuyez sur H pour l\'aide.', '');
};

G.sauver = function () {
  if (!G.player) return;
  const p = G.player;
  const data = {
    v: 1, seed: G.seed, time: G.time, mapId: G.world.id,
    player: {
      x: p.x, y: p.y, pv: p.pv, pm: p.pm, lvl: p.lvl, xp: p.xp, or: p.or,
      morts: p.morts, tues: p.tues, tempsJeu: p.tempsJeu,
    },
    inv: p.inv, equip: p.equip, flags: G.flags,
    quests: G.quests.map(q => ({ id: q.id, etat: q.etat, prog: q.prog })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* stockage plein */ }
};

G.charger = function () {
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!data || data.v !== 1) return false;
  G.seed = data.seed;
  G.flags = data.flags;
  G.time = data.time;
  G.dungeonCache = {};
  G.overworld = G.genOverworld(G.seed);
  G.prerenderMap(G.overworld);
  G.genSideQuests(G.seed);
  for (const qs of data.quests) {
    const q = G.quests.find(x => x.id === qs.id);
    if (q) { q.etat = qs.etat; q.prog = qs.prog; }
  }
  G.player = G.newPlayer();
  Object.assign(G.player, data.player);
  G.player.inv = data.inv;
  G.player.equip = data.equip;
  G.recalcStats();
  G.enterMap(data.mapId);
  if (data.mapId === 'monde') { G.player.x = data.player.x; G.player.y = data.player.y; }
  demarrerJeu();
  G.toast('Partie chargée. Bon retour à Aldenor !', 'quest');
  return true;
};

function demarrerJeu() {
  G.state = 'jeu';
  document.getElementById('title').classList.add('hidden');
  document.getElementById('death').classList.add('hidden');
  document.getElementById('victory').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('minimap').classList.remove('hidden');
  document.getElementById('hotbar').classList.remove('hidden');
  G.refreshPlayerSprite();
  G.uiDirty = true;
}

/* ---------- Changement de carte ---------- */
G.enterMap = function (id, fromDungeon) {
  G.clearEntities();
  if (id === 'monde') {
    G.world = G.overworld;
    G.instancierNPCs(G.world);
    if (fromDungeon && G.overworld.pois[fromDungeon]) {
      const s = G.overworld.pois[fromDungeon];
      G.player.x = s.x * G.TILE + 8; G.player.y = (s.y + 1) * G.TILE + 8;
    }
  } else {
    if (!G.dungeonCache[id]) {
      G.dungeonCache[id] = G.genDonjon(id, G.seed);
      G.prerenderMap(G.dungeonCache[id]);
    }
    G.world = G.dungeonCache[id];
    G.player.x = G.world.entree.x * G.TILE + 8;
    G.player.y = (G.world.entree.y + 1) * G.TILE + 8;
  }
  // coffres déjà ouverts / veines minées
  for (const [k, o] of G.world.objects) {
    if (o.type === 'coffre' && o.cid && G.flags.coffres[o.cid]) o.type = 'coffreouvert';
    if (o.type === 'mineraifer' && o.vid && G.flags.veines[o.vid]) G.world.objects.delete(k);
  }
  G.instancierSpawns(G.world);
  G.uiDirty = true;
};

/* ---------- Mort & victoire ---------- */
G.mortJoueur = function () {
  const p = G.player;
  p.morts++;
  G.state = 'mort';
  const perte = Math.floor(p.or * 0.1);
  p.or -= perte;
  document.getElementById('deathtxt').textContent = perte > 0 ? `Vous perdez ${perte} pièces d'or dans votre chute…` : 'Le monde devient noir…';
  document.getElementById('death').classList.remove('hidden');
  G.fermerPanneaux(); G.closeDlg();
};

document.getElementById('btnrespawn').onclick = () => {
  const p = G.player, c = G.overworld.capitale;
  G.enterMap('monde');
  p.x = c.cx * G.TILE + 8; p.y = (c.cy + 4) * G.TILE;
  p.pv = p.pvmax; p.pm = p.pmmax; p.end = p.endmax;
  demarrerJeu();
};

G.victoire = function () {
  G.state = 'victoire';
  G.flags.mq = 6;
  const p = G.player;
  document.getElementById('victorystats').textContent =
    `Niveau ${p.lvl} · ${p.tues} monstres vaincus · ${Math.floor(p.tempsJeu / 60)} minutes de jeu · ${p.morts} mort(s)`;
  document.getElementById('victory').classList.remove('hidden');
  G.sauver();
};
document.getElementById('btnfree').onclick = () => { demarrerJeu(); };

/* ============================================================
   Interactions (touche E)
   ============================================================ */
function interagir() {
  const p = G.player, w = G.world;
  const pcx = p.x + 8, pcy = p.y + 4;
  // PNJ le plus proche
  let bestN = null, bd = 52;
  for (const n of G.npcsE) {
    const d = G.dist(pcx, pcy, n.x + 8, n.y);
    if (d < bd) { bd = d; bestN = n; }
  }
  if (bestN) { G.initAudio(); G.startMusic(); return G.startDialogue(bestN); }
  // objet interactif le plus proche (3×3 tuiles autour)
  const tx = Math.floor(pcx / G.TILE), ty = Math.floor(pcy / G.TILE);
  let bestO = null; bd = 60;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const o = w.objects.get((ty + dy) * w.w + (tx + dx));
    if (!o) continue;
    const def = G.OBJDEF[o.type];
    if (!def || !def.inter) continue;
    const d = G.dist(pcx, pcy, o.x * G.TILE + 16, o.y * G.TILE + 16);
    if (d < bd) { bd = d; bestO = o; }
  }
  if (bestO) return interagirObjet(bestO);
}

function interagirObjet(o) {
  const p = G.player, w = G.world;
  const inter = G.OBJDEF[o.type].inter;
  switch (inter) {
    case 'coffre': {
      if (o.garde && !G.flags.boss[o.garde]) return G.toast('Le coffre est scellé par une magie puissante…', 'combat');
      o.type = 'coffreouvert';
      if (o.cid) G.flags.coffres[o.cid] = true;
      G.sfx('ouvrir');
      ouvrirCoffre(o);
      break;
    }
    case 'minerai': {
      G.addItem('minerai', G.rint(Math.random, 1, 2));
      G.sfx('forge');
      G.toast('Vous extrayez du minerai de fer.', '');
      if (o.vid) G.flags.veines[o.vid] = true;
      w.objects.delete(o.y * w.w + o.x);
      if (G.flags.mq === 4) G.uiDirty = true;
      break;
    }
    case 'baies':
      G.addItem('baie', G.rint(Math.random, 1, 3));
      G.sfx('objet');
      w.objects.set(o.y * w.w + o.x, { type: 'buisson', x: o.x, y: o.y });
      break;
    case 'champi':
      G.addItem('champignon', 1);
      G.sfx('objet');
      w.objects.delete(o.y * w.w + o.x);
      break;
    case 'puits':
      if (p.pv < p.pvmax) { p.pv = Math.min(p.pvmax, p.pv + 15); G.sfx('boire'); G.addDmgText(p.x + 8, p.y - 16, '+15', '#60e880'); }
      else G.toast('L\'eau est fraîche et claire.', '');
      G.uiDirty = true;
      break;
    case 'pancarte':
      G.showDlg('Pancarte', o.msg || '…', [{ t: 'Fermer.', fn: () => G.closeDlg() }]);
      break;
    case 'statue':
      G.showDlg('Statue ancienne', 'Une statue érodée par les siècles. Ses yeux de pierre semblent vous suivre.', [{ t: 'Reculer lentement.', fn: () => G.closeDlg() }]);
      break;
    case 'autel': {
      if (G.time - G.flags.autelT > G.JOUR * 0.5) {
        G.flags.autelT = G.time;
        p.pv = p.pvmax; p.pm = p.pmmax;
        G.sfx('quete');
        G.burst(p.x + 8, p.y - 8, '#f8e060', 16);
        G.toast('L\'autel vous accorde sa bénédiction : PV et PM restaurés !', 'quest');
      } else G.toast('L\'autel reste silencieux. Revenez plus tard.', '');
      G.uiDirty = true;
      break;
    }
    case 'descendre': {
      if (o.verrou && G.countItem(o.verrou) <= 0) return G.showDlg('Entrée scellée', o.msg || 'C\'est verrouillé.', [{ t: 'Reculer.', fn: () => G.closeDlg() }]);
      G.sfx('porte');
      const nomD = G.DONJONS[o.dest].nom;
      G.enterMap(o.dest);
      G.toast(`— ${nomD} —`, 'quest');
      if (o.dest === 'antre') G.sfx('boss');
      break;
    }
    case 'monter': {
      G.sfx('porte');
      const from = G.world.id;
      G.enterMap('monde', from);
      G.toast('Vous retrouvez l\'air libre.', '');
      break;
    }
  }
}

function ouvrirCoffre(o) {
  const w = G.world;
  const tier = o.tier || G.clamp(Math.round(G.lvlAt(w, o.x, o.y) / 3), 1, 4);
  const or = G.rint(Math.random, 10, 25) * tier * tier;
  G.player.or += or;
  G.addDmgText(o.x * G.TILE + 16, o.y * G.TILE - 8, '+' + or + ' or', '#f0d060');
  G.sfx('or');
  const LOOT_TIER = {
    1: ['ppv1', 'pain', 'ppm1', 'baie'],
    2: ['ppv1', 'ppv2', 'ppm1', 'csq1', 'arm1', 'gemme'],
    3: ['ppv2', 'ppm2', 'epee3', 'arm2', 'csq2', 'ann1', 'ann2', 'gemme'],
    4: ['epee4', 'arm3', 'csq3', 'ann3', 'ppv2', 'gemme', 'hache3', 'arc3'],
    5: ['ann4'],
  };
  const table = LOOT_TIER[tier] || LOOT_TIER[1];
  const id = table[Math.floor(Math.random() * table.length)];
  G.addItem(id, 1);
  G.toast(`Coffre : ${G.ITEMS[id].nom} + ${or} or !`, 'quest');
  G.uiDirty = true;
}

/* ============================================================
   Entrées
   ============================================================ */
G.onKey = function (code, e) {
  if (G.state === 'titre' || G.state === 'mort' || G.state === 'victoire') return;
  // dialogue ouvert : choix au clavier
  if (G.dlgOpen) {
    if (code === 'Escape' || code === 'KeyE') G.closeDlg();
    if (code.startsWith('Digit')) G.dlgChoice(parseInt(code.slice(5)) - 1);
    return;
  }
  if (G.state === 'pause') {
    if (code === 'Escape' || code === 'KeyP') togglePause();
    return;
  }
  switch (code) {
    case 'Escape':
      if (G.panneauOuvert()) { G.fermerPanneaux(); }
      else togglePause();
      break;
    case 'KeyP': togglePause(); break;
    case 'KeyI': G.togglePanel('inv'); break;
    case 'KeyC': G.togglePanel('perso'); break;
    case 'KeyJ': G.togglePanel('quetes'); break;
    case 'KeyM': G.togglePanel('carte'); break;
    case 'KeyH': G.togglePanel('aide'); break;
    case 'KeyE': G.initAudio(); interagir(); break;
    case 'Space': G.initAudio(); G.startMusic(); G.playerAttack(); break;
    case 'ShiftLeft': case 'ShiftRight': G.dash(); break;
    case 'Digit1': G.useHotbar(0); break;
    case 'Digit2': G.useHotbar(1); break;
    case 'Digit3': G.useHotbar(2); break;
    case 'Digit4': G.useHotbar(3); break;
    case 'Digit5': G.useHotbar(4); break;
  }
};

cv.addEventListener('mousedown', () => {
  G.initAudio(); G.startMusic();
  if (G.state === 'jeu' && !G.dlgOpen && !G.panneauOuvert()) G.playerAttack();
});
document.querySelectorAll('.hslot').forEach(el => {
  el.onclick = () => { G.initAudio(); G.useHotbar(parseInt(el.dataset.slot)); };
});

/* ---------- Pause ---------- */
function togglePause() {
  if (G.state === 'jeu') {
    G.state = 'pause';
    document.getElementById('pause').classList.remove('hidden');
  } else if (G.state === 'pause') {
    G.state = 'jeu';
    document.getElementById('pause').classList.add('hidden');
  }
}
document.getElementById('btnresume').onclick = togglePause;
document.getElementById('btnsave').onclick = () => { G.sauver(); G.toast('Partie sauvegardée.', 'quest'); togglePause(); };
document.getElementById('btnmusic').onclick = function () {
  G.audio.musicOn = !G.audio.musicOn;
  this.textContent = 'Musique : ' + (G.audio.musicOn ? 'ON' : 'OFF');
  if (G.audio.musicOn) { G.initAudio(); G.startMusic(); } else G.stopMusic();
};
document.getElementById('btnquit').onclick = () => {
  G.sauver();
  location.reload();
};

/* ---------- Écran titre ---------- */
document.getElementById('btnnew').onclick = () => {
  G.initAudio(); G.startMusic();
  G.newGame();
};
document.getElementById('btncontinue').onclick = () => {
  G.initAudio(); G.startMusic();
  if (!G.charger()) { G.toast('Sauvegarde illisible — nouvelle partie.', 'combat'); G.newGame(); }
};
if (localStorage.getItem(SAVE_KEY)) document.getElementById('btncontinue').classList.remove('hidden');

/* ============================================================
   Jour / nuit & météo
   ============================================================ */
G.estNuit = function () {
  const t = (G.time % G.JOUR) / G.JOUR;
  return t < 0.2 || t > 0.85;
};
function obscurite() {
  const t = (G.time % G.JOUR) / G.JOUR;
  // 0 = plein jour, 1 = nuit noire
  if (t > 0.25 && t < 0.75) return 0;
  if (t >= 0.75) return Math.min(1, (t - 0.75) / 0.13);
  return Math.max(0, 1 - t / 0.25 * 1.3);
}

/* ============================================================
   Sprite du joueur
   ============================================================ */
G.refreshPlayerSprite = function () {
  const p = G.player;
  const coiffe = p.equip.casque ? 'casque' : null;
  const haut = p.equip.armure ? (G.ITEMS[p.equip.armure].ic[1] || '#3a5a8a') : '#3a5a8a';
  G.playerSpr = G.makeHumanoid({ peau: '#e8b088', cheveux: '#8a5a2a', haut, bas: '#4a3a2a', coiffe });
};

/* ============================================================
   RENDU
   ============================================================ */
let waterFrame = 0, waterT = 0;

function drawHumanoid(spr, x, y, dir, frame, scale = 2) {
  const fl = dir === 'l';
  const frames = spr[fl ? 'r' : dir === 'r' ? 'r' : dir];
  const img = frames[frame];
  cx.save();
  if (fl) { cx.translate(Math.round(x + 16), Math.round(y - 32 * scale / 2)); cx.scale(-1, 1); cx.translate(-16, 0); }
  else cx.translate(Math.round(x), Math.round(y - 32 * scale / 2));
  cx.drawImage(img, -8 * (scale - 2) , -32 + 32 * scale / 2 - (scale - 2) * 8, 16 * scale, 16 * scale);
  cx.restore();
}

function shadow(x, y, w) {
  cx.fillStyle = 'rgba(0,0,0,0.25)';
  cx.beginPath();
  cx.ellipse(x, y, w, w * 0.4, 0, 0, 7);
  cx.fill();
}

function render(dt) {
  const w = G.world, p = G.player, TL = G.TILE;
  waterT += dt;
  if (waterT > 0.55) { waterT = 0; waterFrame = 1 - waterFrame; }

  // caméra
  G.cam.x = G.clamp(p.x + 8 - cv.width / 2, 0, Math.max(0, w.w * TL - cv.width));
  G.cam.y = G.clamp(p.y - cv.height / 2, 0, Math.max(0, w.h * TL - cv.height));
  const camX = Math.round(G.cam.x), camY = Math.round(G.cam.y);

  cx.fillStyle = w.exterieur ? '#16325c' : '#0a080e';
  cx.fillRect(0, 0, cv.width, cv.height);

  const x0 = Math.max(0, Math.floor(camX / TL)), y0 = Math.max(0, Math.floor(camY / TL));
  const x1 = Math.min(w.w - 1, Math.ceil((camX + cv.width) / TL)), y1 = Math.min(w.h - 1, Math.ceil((camY + cv.height) / TL));

  // --- sol ---
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * w.w + tx;
      const t = w.tiles[i];
      const anim = (t === G.T.WATER || t === G.T.DEEP || t === G.T.LAVA) ? waterFrame : 0;
      cx.drawImage(G.tiles[t][w.variant[i]][anim], tx * TL - camX, ty * TL - camY, TL, TL);
    }
  }

  // --- entités triées par y ---
  const list = [];
  for (let ty = y0 - 1; ty <= y1 + 1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const o = w.objects.get(ty * w.w + tx);
      if (o) list.push({ y: ty * TL + TL, obj: o });
    }
  }
  for (const d of G.drops) if (d.x > camX - 20 && d.x < camX + cv.width + 20 && d.y > camY - 20 && d.y < camY + cv.height + 20) list.push({ y: d.y, drop: d });
  for (const e of G.enemies) if (e.x > camX - 80 && e.x < camX + cv.width + 80 && e.y > camY - 80 && e.y < camY + cv.height + 80) list.push({ y: e.y, ene: e });
  for (const n of G.npcsE) if (n.x > camX - 60 && n.x < camX + cv.width + 60 && n.y > camY - 60 && n.y < camY + cv.height + 60) list.push({ y: n.y, npc: n });
  list.push({ y: p.y + p.h, joueur: true });
  list.sort((a, b) => a.y - b.y);

  const tRel = performance.now() / 1000;

  for (const it of list) {
    if (it.obj) {
      const o = it.obj, spr = G.objs[o.type];
      if (!spr) continue;
      const sx = o.x * TL + TL / 2 - spr.width, sy = (o.y + 1) * TL - spr.height * 2;
      cx.drawImage(spr, Math.round(sx - camX), Math.round(sy - camY), spr.width * 2, spr.height * 2);
      // flammes animées
      if (o.type === 'torche' || o.type === 'feudecamp') {
        const fx = o.x * TL + TL / 2 - camX, fy = (o.y + 1) * TL - spr.height * 2 - camY;
        const fl = Math.sin(tRel * 10 + o.x * 7 + o.y * 13) * 2;
        cx.fillStyle = '#f8a030';
        cx.fillRect(fx - 3, fy - 6 + fl, 6, 7);
        cx.fillStyle = '#ffd860';
        cx.fillRect(fx - 1.5, fy - 3 + fl, 3, 4);
      }
    } else if (it.drop) {
      const d = it.drop;
      const bob = Math.sin(tRel * 4 + d.x) * 2;
      if (d.or) {
        cx.fillStyle = '#e8c030'; cx.fillRect(d.x - camX - 3, d.y - camY - 3 + bob, 7, 7);
        cx.fillStyle = '#fff0a0'; cx.fillRect(d.x - camX - 1, d.y - camY - 1 + bob, 2, 2);
      } else {
        cx.drawImage(G.ITEMS[d.id].icon, d.x - camX - 8, d.y - camY - 8 + bob, 16, 16);
      }
    } else if (it.ene) {
      const e = it.ene, def = e.def;
      const sc = 2 * (def.taille || 1);
      const ex = e.x - camX, ey = e.y - camY + (def.vole ? Math.sin(tRel * 5 + e.x) * 4 : 0);
      shadow(ex + 8, e.y - camY + 8, 8 * (def.taille || 1));
      if (def.humanoide) {
        drawHumanoid(G.monsterSprites[def.spr], ex + 8 - 8 * (def.taille || 1), ey + 8, e.dir, e.state === 'chasse' ? 1 + (Math.floor(e.animT) % 2) : 0, sc);
      } else {
        const img = G.monsterSprites[def.spr];
        const squash = 1 + Math.sin(e.animT * 2) * 0.06;
        const iw = img.width * sc, ih = img.height * sc * squash;
        cx.save();
        cx.translate(ex + 8, ey + 8);
        if (e.dir === 'l') cx.scale(-1, 1);
        cx.drawImage(img, -iw / 2, -ih + 8, iw, ih);
        cx.restore();
      }
      // barre de vie
      if (e.pv < e.pvmax) {
        const bw = 26 * (def.taille || 1);
        cx.fillStyle = '#201010'; cx.fillRect(ex + 8 - bw / 2, ey - 16 * sc / 2 - 14, bw, 4);
        cx.fillStyle = e.boss ? '#e04060' : '#d04030';
        cx.fillRect(ex + 8 - bw / 2, ey - 16 * sc / 2 - 14, bw * e.pv / e.pvmax, 4);
      }
      if (e.boss) {
        cx.fillStyle = '#ffd040'; cx.font = 'bold 11px Courier New'; cx.textAlign = 'center';
        cx.fillText(e.nom, ex + 8, ey - 16 * sc / 2 - 18);
        cx.textAlign = 'left';
      }
    } else if (it.npc) {
      const n = it.npc;
      const nx = n.x - camX, ny = n.y - camY;
      shadow(nx + 8, ny + 8, 8);
      drawHumanoid(n.spr, nx, ny + 8, n.dir, n.frame, 2);
      // marqueurs de quête
      const marker = npcMarker(n);
      if (marker) {
        cx.fillStyle = marker === '!' ? '#ffd040' : '#80c8ff';
        cx.font = 'bold 16px Courier New'; cx.textAlign = 'center';
        cx.fillText(marker, nx + 8, ny - 30 + Math.sin(tRel * 3) * 2);
        cx.textAlign = 'left';
      }
    } else if (it.joueur) {
      const px = p.x - camX, py = p.y - camY;
      shadow(px + 8, py + 8, 8);
      if (p.hurtT > 0 && Math.floor(p.hurtT * 12) % 2 === 0) cx.globalAlpha = 0.4;
      drawHumanoid(G.playerSpr, px, py + 8, p.dir, p.frame, 2);
      cx.globalAlpha = 1;
      // arc de coup d'épée
      if (p.swing > 0) {
        const prog = 1 - p.swing / 0.18;
        const base = { d: 1.57, u: -1.57, l: 3.14, r: 0 }[p.swingDir];
        const a = base - 1.1 + prog * 2.2;
        cx.strokeStyle = 'rgba(255,255,230,' + (0.8 - prog * 0.5) + ')';
        cx.lineWidth = 3;
        cx.beginPath();
        cx.arc(px + 8, py - 2, 24, a - 0.5, a + 0.5);
        cx.stroke();
      }
    }
  }

  // --- projectiles ---
  for (const pr of G.projs) {
    const img = G.fx[pr.spr];
    if (!img) continue;
    cx.save();
    cx.translate(pr.x - camX, pr.y - camY);
    if (pr.ang !== undefined) cx.rotate(pr.ang);
    cx.drawImage(img, -img.width, -img.height, img.width * 2, img.height * 2);
    cx.restore();
  }

  // --- particules ---
  for (const pt of G.parts) {
    cx.globalAlpha = Math.min(1, pt.ttl * 3);
    cx.fillStyle = pt.col;
    cx.fillRect(pt.x - camX, pt.y - camY, pt.taille, pt.taille);
  }
  cx.globalAlpha = 1;

  // --- textes de dégâts ---
  cx.font = 'bold 13px Courier New'; cx.textAlign = 'center';
  for (const t of G.dmgTexts) {
    cx.globalAlpha = Math.min(1, t.ttl * 2);
    cx.fillStyle = '#000'; cx.fillText(t.txt, t.x - camX + 1, t.y - camY + 1);
    cx.fillStyle = t.col; cx.fillText(t.txt, t.x - camX, t.y - camY);
  }
  cx.globalAlpha = 1; cx.textAlign = 'left';

  // --- pluie ---
  if (G.meteo === 'pluie' && w.exterieur) {
    cx.strokeStyle = 'rgba(160,190,230,0.4)';
    cx.lineWidth = 1;
    cx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 97 + tRel * 500) % (cv.width + 40)) - 20;
      const ry = (i * 61 + tRel * 700) % cv.height;
      cx.moveTo(rx, ry); cx.lineTo(rx - 3, ry + 12);
    }
    cx.stroke();
  }

  // --- nuit / obscurité des donjons ---
  let dark = w.exterieur ? obscurite() * 0.78 : 0.62;
  if (G.meteo === 'pluie' && w.exterieur) dark = Math.max(dark, 0.25);
  if (dark > 0.02) {
    nightCx.clearRect(0, 0, nightCv.width, nightCv.height);
    nightCx.fillStyle = w.exterieur ? `rgba(8,8,38,${dark})` : `rgba(4,2,10,${dark})`;
    nightCx.fillRect(0, 0, nightCv.width, nightCv.height);
    nightCx.globalCompositeOperation = 'destination-out';
    // lumière du joueur
    lum(p.x + 8 - camX, p.y - camY, 130);
    // sources de lumière
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const o = w.objects.get(ty * w.w + tx);
      if (o && G.OBJDEF[o.type] && G.OBJDEF[o.type].lum) lum(tx * TL + TL / 2 - camX, ty * TL - camY, 110 + Math.sin(tRel * 8 + tx) * 8);
      const t = w.tiles[ty * w.w + tx];
      if (t === G.T.LAVA) lum(tx * TL + TL / 2 - camX, ty * TL + TL / 2 - camY, 70);
    }
    for (const pr of G.projs) if (pr.spr === 'boulefeu' || pr.spr === 'crachefeu') lum(pr.x - camX, pr.y - camY, 80);
    nightCx.globalCompositeOperation = 'source-over';
    cx.drawImage(nightCv, 0, 0);
  }

  // --- indication d'interaction ---
  hintInteraction(camX, camY);

  // --- HUD boss ---
  let boss = null;
  for (const e of G.enemies) if (e.boss && G.dist(e.x, e.y, p.x, p.y) < 14 * TL) { boss = e; break; }
  const bh = document.getElementById('bosshud');
  if (boss) {
    bh.classList.remove('hidden');
    document.getElementById('bossname').textContent = boss.nom + ' — niv. ' + boss.lvl;
    document.getElementById('barboss').style.width = (boss.pv / boss.pvmax * 100) + '%';
  } else bh.classList.add('hidden');
}

function lum(x, y, r) {
  const g = nightCx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  nightCx.fillStyle = g;
  nightCx.beginPath(); nightCx.arc(x, y, r, 0, 7); nightCx.fill();
}

function npcMarker(n) {
  const f = G.flags;
  if (n.role === 'ancien') {
    if (f.mq === 0 || (f.mq === 1 && f.mqProg >= 5) || (f.mq === 2 && G.countItem('sceauvole') > 0)) return '!';
  }
  if (n.role === 'forgeron' && n.vi === 0) {
    if ((f.mq === 3 && G.countItem('fragment') > 0) || (f.mq === 4 && G.countItem('minerai') >= 5)) return '!';
  }
  for (const q of G.quests) {
    if (q.giver === n.nom && q.etat === 'dispo') return '?';
    if (q.giver === n.nom && (q.etat === 'rendre' || (q.etat === 'active' && q.type === 'collecte' && G.countItem(q.cible) >= q.n))) return '!';
    if (q.type === 'livraison' && q.etat === 'active' && q.cible === n.nom) return '!';
  }
  return null;
}

function hintInteraction(camX, camY) {
  const p = G.player;
  if (G.dlgOpen) return;
  let best = null, bd = 52, bx = 0, by = 0;
  for (const n of G.npcsE) {
    const d = G.dist(p.x + 8, p.y + 4, n.x + 8, n.y);
    if (d < bd) { bd = d; best = 'Parler'; bx = n.x + 8; by = n.y - 36; }
  }
  if (!best) {
    const tx = Math.floor((p.x + 8) / G.TILE), ty = Math.floor((p.y + 4) / G.TILE);
    bd = 60;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = G.world.objects.get((ty + dy) * G.world.w + (tx + dx));
      if (!o || !G.OBJDEF[o.type] || !G.OBJDEF[o.type].inter) continue;
      const d = G.dist(p.x + 8, p.y + 4, o.x * G.TILE + 16, o.y * G.TILE + 16);
      if (d < bd) {
        bd = d;
        best = { coffre: 'Ouvrir', minerai: 'Miner', baies: 'Cueillir', champi: 'Cueillir', puits: 'Boire', pancarte: 'Lire', statue: 'Examiner', autel: 'Prier', descendre: 'Descendre', monter: 'Remonter' }[G.OBJDEF[o.type].inter] || 'Utiliser';
        bx = o.x * G.TILE + 16; by = o.y * G.TILE - 18;
      }
    }
  }
  if (best) {
    cx.font = 'bold 12px Courier New'; cx.textAlign = 'center';
    const txt = '[E] ' + best;
    const tw = cx.measureText(txt).width;
    cx.fillStyle = 'rgba(10,8,4,0.8)';
    cx.fillRect(bx - camX - tw / 2 - 5, by - camY - 12, tw + 10, 17);
    cx.fillStyle = '#ffd040';
    cx.fillText(txt, bx - camX, by - camY);
    cx.textAlign = 'left';
  }
}

/* ============================================================
   BOUCLE PRINCIPALE
   ============================================================ */
let lastT = performance.now();
let hudT = 0, saveT = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.1) dt = 0.1;

  if (G.state === 'jeu') {
    G.time += dt;
    // météo
    meteoT -= dt;
    if (meteoT <= 0) {
      G.meteo = Math.random() < 0.25 ? 'pluie' : 'clair';
      meteoT = 60 + Math.random() * 120;
      if (G.meteo === 'pluie' && G.world.exterieur) G.toast('La pluie se met à tomber…', '');
    }
    if (!G.dlgOpen && !G.panneauOuvert()) {
      G.updatePlayer(dt);
      // attaque maintenue
      if (G.keys.Space) G.playerAttack();
    }
    G.updateEnemies(dt);
    G.updateNPCs(dt);
    G.updateProjs(dt);
    G.updateParts(dt);
    G.ambientSpawn(dt);
    // décrémente le délai anti-ramassage des objets jetés
    for (const d of G.drops) if (d.noPickup) d.noPickup -= dt;

    saveT += dt;
    if (saveT > 45) { saveT = 0; G.sauver(); }
  } else if (G.state !== 'titre') {
    G.updateParts(dt);
  }

  if (G.state !== 'titre') {
    render(dt);
    G.renderMinimap();
    hudT -= dt;
    if (hudT <= 0 || G.uiDirty) {
      hudT = 0.12;
      G.updateHUD();
      G.updateHotbar();
      if (G.uiDirty) {
        if (!document.getElementById('inv').classList.contains('hidden')) G.renderInv();
        if (!document.getElementById('quetes').classList.contains('hidden')) G.renderQuetes();
        if (!document.getElementById('perso').classList.contains('hidden')) G.renderPerso();
      }
      G.uiDirty = false;
    }
  }
}

/* ============================================================
   Démarrage
   ============================================================ */
G.buildSprites();
G.buildItemIcons();
addEventListener('beforeunload', () => { if (G.state === 'jeu' || G.state === 'pause') G.sauver(); });
requestAnimationFrame(loop);
