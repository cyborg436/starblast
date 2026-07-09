'use strict';
/* ============================================================
   ui.js — HUD, inventaire, boutiques, carte, journal, infobulles
   ============================================================ */

const $ = id => document.getElementById(id);
G.uiDirty = true;

/* ---------- Toasts ---------- */
G.toast = function (txt, cls) {
  const t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.textContent = txt;
  $('toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .5s'; }, 3200);
  setTimeout(() => t.remove(), 3800);
  while ($('toasts').children.length > 6) $('toasts').firstChild.remove();
};

/* ---------- HUD ---------- */
G.updateHUD = function () {
  const p = G.player;
  $('barpv').style.width = (p.pv / p.pvmax * 100) + '%';
  $('txtpv').textContent = `PV ${Math.ceil(p.pv)}/${p.pvmax}`;
  $('barpm').style.width = (p.pm / p.pmmax * 100) + '%';
  $('txtpm').textContent = `PM ${Math.floor(p.pm)}/${p.pmmax}`;
  $('barxp').style.width = (p.xp / G.xpNeeded(p.lvl) * 100) + '%';
  $('txtxp').textContent = '';
  $('hudlvl').textContent = `Niv. ${p.lvl}`;
  $('hudor').textContent = `🪙 ${p.or}`;
  const h = Math.floor((G.time % G.JOUR) / G.JOUR * 24), mn = Math.floor(((G.time % G.JOUR) / G.JOUR * 24 % 1) * 60);
  const jour = Math.floor(G.time / G.JOUR) + 1;
  $('hudclock').textContent = `J${jour} ${String(h).padStart(2, '0')}h${String(mn).padStart(2, '0')} ${G.estNuit() ? '🌙' : '☀️'}`;
  $('hudzone').textContent = G.zoneNom();
};

G.zoneNom = function () {
  const w = G.world, p = G.player;
  if (!w.exterieur) return w.nom + ` (niv. ${w.lvlFixe})`;
  const tx = Math.floor(p.x / G.TILE), ty = Math.floor(p.y / G.TILE);
  for (const v of w.villages) if (G.dist(tx, ty, v.cx, v.cy) < 15) return v.nom + (v.capitale ? ' ★' : '');
  const reg = w.region[G.clamp(ty, 0, w.h - 1) * w.w + G.clamp(tx, 0, w.w - 1)];
  return `${G.REG_NOMS[reg]} (niv. ${G.lvlAt(w, tx, ty)})`;
};

/* ---------- Hotbar (1: potion PV, 2: potion PM, 3: feu, 4: soin, 5: éclair) ---------- */
const HOT_DEFS = [
  { type: 'item', id: 'ppv1' }, { type: 'item', id: 'ppm1' },
  { type: 'sort', id: 'feu', lvl: 3, ic: () => G.fx.boulefeu },
  { type: 'sort', id: 'soin', lvl: 5, ic: () => G.makeIcon('potion', '#40e880') },
  { type: 'sort', id: 'eclair', lvl: 8, ic: () => G.fx.eclair },
];
let hotIcons = null;

G.updateHotbar = function () {
  const p = G.player;
  if (!hotIcons) hotIcons = HOT_DEFS.map(d => d.type === 'item' ? G.ITEMS[d.id].icon : d.ic());
  document.querySelectorAll('.hslot').forEach((el, i) => {
    const d = HOT_DEFS[i];
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    let dispo = true, qty = '';
    if (d.type === 'item') {
      const n = G.countItem(d.id);
      qty = n || ''; dispo = n > 0;
    } else {
      dispo = p.lvl >= d.lvl;
      qty = dispo ? '' : 'n' + d.lvl;
      el.classList.toggle('cd', dispo && p.sortCd[d.id] > 0);
    }
    ctx.globalAlpha = dispo ? 1 : 0.3;
    ctx.drawImage(hotIcons[i], 0, 0, 32, 32);
    ctx.globalAlpha = 1;
    el.querySelector('.hqty').textContent = qty;
  });
};

G.useHotbar = function (i) {
  const d = HOT_DEFS[i];
  if (!d) return;
  if (d.type === 'item') G.usePotion(d.id);
  else if (d.id === 'feu') G.castFeu();
  else if (d.id === 'soin') G.castSoin();
  else if (d.id === 'eclair') G.castEclair();
};

/* ---------- Panneaux ---------- */
G.panneaux = ['inv', 'perso', 'quetes', 'boutique', 'carte', 'aide'];
G.togglePanel = function (id) {
  const el = $(id);
  const wasHidden = el.classList.contains('hidden');
  G.fermerPanneaux();
  if (wasHidden) {
    el.classList.remove('hidden');
    if (id === 'inv') G.renderInv();
    if (id === 'perso') G.renderPerso();
    if (id === 'quetes') G.renderQuetes();
    if (id === 'carte') G.renderBigMap();
    G.sfx('ouvrir');
  }
};
G.fermerPanneaux = function () {
  for (const id of G.panneaux) $(id).classList.add('hidden');
  G.hideTooltip();
};
G.panneauOuvert = function () {
  return G.panneaux.some(id => !$(id).classList.contains('hidden'));
};

document.querySelectorAll('.pclose').forEach(el => {
  el.onclick = () => { $(el.dataset.close).classList.add('hidden'); G.hideTooltip(); };
});

/* ---------- Infobulle ---------- */
G.showTooltip = function (ev, it, opts = {}) {
  const def = G.ITEMS[it.id];
  const tt = $('tooltip');
  let html = `<div class="tname">${def.nom}</div>`;
  const stats = [];
  if (def.atk) stats.push(`+${def.atk} attaque`);
  if (def.mag) stats.push(`+${def.mag} magie`);
  if (def.def) stats.push(`+${def.def} défense`);
  if (def.pv) stats.push(`+${def.pv} PV max`);
  if (def.pm) stats.push(`+${def.pm} PM max`);
  if (stats.length) html += `<div class="tstat">${stats.join(' · ')}</div>`;
  if (def.desc) html += `<div class="tdesc">${def.desc}</div>`;
  if (opts.prix !== undefined) html += `<div class="tprix">${opts.prix} or</div>`;
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  const px = Math.min(ev.clientX + 14, innerWidth - 260), py = Math.min(ev.clientY + 10, innerHeight - 120);
  tt.style.left = px + 'px'; tt.style.top = py + 'px';
};
G.hideTooltip = function () { $('tooltip').classList.add('hidden'); };

/* ---------- Inventaire ---------- */
G.renderInv = function () {
  const p = G.player;
  const grid = $('invgrid');
  grid.innerHTML = '';
  p.inv.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'islot';
    if (s) {
      const cv = G.mkCanvas(32, 32), ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(G.ITEMS[s.id].icon, 0, 0, 32, 32);
      d.appendChild(cv);
      if (s.n > 1) { const q = document.createElement('span'); q.className = 'qty'; q.textContent = s.n; d.appendChild(q); }
      d.onmousemove = ev => G.showTooltip(ev, s);
      d.onmouseleave = G.hideTooltip;
      d.onclick = () => { G.clickInvSlot(i); };
      d.oncontextmenu = ev => { ev.preventDefault(); G.dropInvSlot(i); };
    }
    grid.appendChild(d);
  });
  // équipement
  document.querySelectorAll('.eslot').forEach(el => {
    const slot = el.dataset.eslot;
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    const id = p.equip[slot];
    if (id) {
      ctx.drawImage(G.ITEMS[id].icon, 0, 0, 32, 32);
      cv.onmousemove = ev => G.showTooltip(ev, { id });
      cv.onmouseleave = G.hideTooltip;
      cv.onclick = () => { G.unequip(slot); };
    } else { cv.onclick = null; cv.onmousemove = null; }
  });
};

G.clickInvSlot = function (i) {
  const p = G.player, s = p.inv[i];
  if (!s) return;
  const def = G.ITEMS[s.id];
  // mode vente ?
  if (!$('boutique').classList.contains('hidden') && G.shopMode === 'vendre') return G.vendre(i);
  if (def.type === 'conso') { G.usePotion(s.id); G.renderInv(); return; }
  if (['arme', 'armure', 'casque', 'anneau'].includes(def.type)) {
    const slot = def.type;
    const old = p.equip[slot];
    p.equip[slot] = s.id;
    s.n--; if (s.n <= 0) p.inv[i] = null;
    if (old) G.addItem(old, 1);
    G.recalcStats();
    if (G.refreshPlayerSprite) G.refreshPlayerSprite();
    G.sfx('objet');
    G.renderInv(); G.uiDirty = true;
  }
};
G.unequip = function (slot) {
  const p = G.player;
  if (!p.equip[slot]) return;
  if (G.addItem(p.equip[slot], 1)) {
    p.equip[slot] = null;
    G.recalcStats();
    if (G.refreshPlayerSprite) G.refreshPlayerSprite();
    G.sfx('clic');
    G.renderInv(); G.uiDirty = true;
  }
};
G.dropInvSlot = function (i) {
  const p = G.player, s = p.inv[i];
  if (!s) return;
  if (G.ITEMS[s.id].type === 'quete') return G.toast('Impossible de jeter un objet de quête.', 'combat');
  G.drops.push({ x: p.x + 8 + (Math.random() * 30 - 15), y: p.y + 14 + Math.random() * 8, id: s.id, n: 1, noPickup: 1.5 });
  s.n--; if (s.n <= 0) p.inv[i] = null;
  G.renderInv();
};

/* ---------- Personnage ---------- */
G.renderPerso = function () {
  const p = G.player;
  $('persobody').innerHTML = `
    <p><b>Niveau</b> ${p.lvl} — ${p.xp}/${G.xpNeeded(p.lvl)} XP</p>
    <p><b>PV</b> ${Math.ceil(p.pv)}/${p.pvmax} · <b>PM</b> ${Math.floor(p.pm)}/${p.pmmax}</p>
    <p><b>Attaque</b> ${G.playerAtk()} · <b>Défense</b> ${G.playerDef()} · <b>Magie</b> ${G.playerMag()}</p>
    <p><b>Or</b> ${p.or} 🪙</p>
    <hr style="border-color:#4c3a22">
    <p><b>Monstres tués</b> : ${p.tues}</p>
    <p><b>Morts</b> : ${p.morts}</p>
    <p><b>Temps de jeu</b> : ${Math.floor(p.tempsJeu / 60)} min</p>
    <p><b>Sorts</b> : ${p.lvl >= 3 ? 'Boule de feu' : '—'}${p.lvl >= 5 ? ', Soin' : ''}${p.lvl >= 8 ? ', Éclair' : ''}</p>`;
};

/* ---------- Journal de quêtes ---------- */
G.renderQuetes = function () {
  let html = '';
  const mq = G.mqEntry();
  if (mq) html += `<div class="quete"><div class="qtitre main">★ ${mq.titre}</div><div class="qdesc">${mq.desc}</div></div>`;
  else html += `<div class="quete done"><div class="qtitre main">★ Vermithrax est vaincu — Aldenor est libre !</div></div>`;
  for (const q of G.quests) {
    if (q.etat === 'dispo') continue;
    const done = q.etat === 'finie';
    html += `<div class="quete${done ? ' done' : ''}"><div class="qtitre">${done ? '✓ ' : ''}${q.titre}</div>`;
    if (!done) {
      html += `<div class="qdesc">${q.desc}</div>`;
      if (q.type === 'chasse') html += `<div class="qprog">${q.prog}/${q.n}</div>`;
      if (q.type === 'collecte') html += `<div class="qprog">${Math.min(G.countItem(q.cible), q.n)}/${q.n}</div>`;
      if (q.etat === 'rendre') html += `<div class="qprog">→ Retournez voir ${q.giver} (${q.village}).</div>`;
    }
    html += '</div>';
  }
  if (!G.quests.some(q => q.etat !== 'dispo') && !mq) html += '<p style="color:#907850">Aucune quête en cours.</p>';
  $('quetesbody').innerHTML = html;
};

/* ---------- Boutique ---------- */
G.shopMode = 'acheter';
G.shopType = null;

G.openShop = function (type, npc) {
  G.shopType = type;
  G.shopMode = 'acheter';
  G.fermerPanneaux();
  $('boutique').classList.remove('hidden');
  $('shoptitle').childNodes[0].textContent = (npc ? npc.nom : 'Boutique') + ' ';
  $('tabacheter').classList.add('ton'); $('tabvendre').classList.remove('ton');
  G.renderShop();
};
$('tabacheter').onclick = () => { G.shopMode = 'acheter'; $('tabacheter').classList.add('ton'); $('tabvendre').classList.remove('ton'); G.renderShop(); };
$('tabvendre').onclick = () => { G.shopMode = 'vendre'; $('tabvendre').classList.add('ton'); $('tabacheter').classList.remove('ton'); G.renderShop(); };

G.renderShop = function () {
  const body = $('shopbody');
  body.innerHTML = '';
  const p = G.player;
  if (G.shopMode === 'acheter') {
    for (const id of G.SHOPS[G.shopType]) {
      const def = G.ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shoprow';
      const cv = G.mkCanvas(24, 24); const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.drawImage(def.icon, 0, 0, 24, 24);
      row.appendChild(cv);
      const nm = document.createElement('span'); nm.className = 'sname'; nm.textContent = def.nom; row.appendChild(nm);
      const pr = document.createElement('span'); pr.className = 'sprix'; pr.textContent = def.prix + ' or'; row.appendChild(pr);
      row.onmousemove = ev => G.showTooltip(ev, { id }, { prix: def.prix });
      row.onmouseleave = G.hideTooltip;
      row.onclick = () => {
        if (p.or < def.prix) { G.sfx('erreur'); return G.toast('Pas assez d\'or !', 'combat'); }
        if (!G.addItem(id, 1)) return;
        p.or -= def.prix;
        G.sfx('or'); G.uiDirty = true;
      };
      body.appendChild(row);
    }
  } else {
    let any = false;
    p.inv.forEach((s, i) => {
      if (!s) return;
      const def = G.ITEMS[s.id];
      if (def.type === 'quete' || def.prix <= 0) return;
      any = true;
      const prixV = Math.max(1, Math.floor(def.prix * 0.4));
      const row = document.createElement('div');
      row.className = 'shoprow';
      const cv = G.mkCanvas(24, 24); const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.drawImage(def.icon, 0, 0, 24, 24);
      row.appendChild(cv);
      const nm = document.createElement('span'); nm.className = 'sname'; nm.textContent = def.nom + (s.n > 1 ? ' ×' + s.n : ''); row.appendChild(nm);
      const pr = document.createElement('span'); pr.className = 'sprix'; pr.textContent = '+' + prixV + ' or'; row.appendChild(pr);
      row.onmousemove = ev => G.showTooltip(ev, s, { prix: prixV });
      row.onmouseleave = G.hideTooltip;
      row.onclick = () => { G.vendre(i); };
      body.appendChild(row);
    });
    if (!any) body.innerHTML = '<p style="color:#907850;padding:8px">Rien à vendre.</p>';
  }
};

G.vendre = function (i) {
  const p = G.player, s = p.inv[i];
  if (!s) return;
  const def = G.ITEMS[s.id];
  if (def.type === 'quete' || def.prix <= 0) return;
  p.or += Math.max(1, Math.floor(def.prix * 0.4));
  s.n--; if (s.n <= 0) p.inv[i] = null;
  G.sfx('or'); G.uiDirty = true;
  G.renderShop();
};

/* ---------- Minimap & grande carte ---------- */
G.miniMapCv = null;

G.prerenderMap = function (world) {
  const cv = G.mkCanvas(world.w, world.h), ctx = cv.getContext('2d');
  const COLS = {
    [G.T.DEEP]: '#122a50', [G.T.WATER]: '#2a5a9a', [G.T.SAND]: '#d8c078', [G.T.GRASS]: '#4a8a38',
    [G.T.DIRT]: '#8a6a42', [G.T.ROCK]: '#7a7268', [G.T.SNOW]: '#e4e9ef', [G.T.SWAMP]: '#44604a',
    [G.T.PATH]: '#c0a070', [G.T.FLOOR]: '#9a7648', [G.T.WALLW]: '#5c4224', [G.T.WALLS]: '#7a7a84',
    [G.T.FARM]: '#7a5a32', [G.T.BRIDGE]: '#8a6a3a', [G.T.CAVEF]: '#4a4048', [G.T.CAVEW]: '#1a1620',
    [G.T.LAVA]: '#d84a10', [G.T.MTN]: '#3e3a34', [G.T.CRYPTF]: '#4c4658', [G.T.CRYPTW]: '#201c2c',
  };
  const img = ctx.createImageData(world.w, world.h);
  for (let i = 0; i < world.w * world.h; i++) {
    let col = COLS[world.tiles[i]] || '#000';
    // forêt plus sombre
    if (world.region && world.tiles[i] === G.T.GRASS && world.region[i] === G.REG.FORET) col = '#356a28';
    const n = parseInt(col.slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  world.mapCv = cv;
};

G.renderMinimap = function () {
  const w = G.world, p = G.player;
  if (!w.mapCv) return;
  const cv = $('minimap'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const VIEW = 88; // tuiles visibles
  const cx = p.x / G.TILE, cy = p.y / G.TILE;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  const sx = G.clamp(cx - VIEW / 2, 0, Math.max(0, w.w - VIEW));
  const sy = G.clamp(cy - VIEW / 2, 0, Math.max(0, w.h - VIEW));
  ctx.drawImage(w.mapCv, sx, sy, VIEW, VIEW, 0, 0, cv.width, cv.height);
  const k = cv.width / VIEW;
  if (w.exterieur) {
    ctx.fillStyle = '#ffd040';
    for (const v of w.villages) {
      const vx = (v.cx - sx) * k, vy = (v.cy - sy) * k;
      if (vx >= 0 && vy >= 0 && vx < cv.width && vy < cv.height) ctx.fillRect(vx - 2, vy - 2, 4, 4);
    }
    // marqueur de quête principale
    const m = G.mqMarker();
    if (m) {
      const mx = (m.x - sx) * k, my = (m.y - sy) * k;
      ctx.fillStyle = '#ff8030';
      ctx.fillRect(G.clamp(mx, 2, cv.width - 4) - 2, G.clamp(my, 2, cv.height - 4) - 2, 5, 5);
    }
  }
  // joueur
  ctx.fillStyle = '#fff';
  ctx.fillRect((cx - sx) * k - 2, (cy - sy) * k - 2, 4, 4);
};

G.mqMarker = function () {
  const f = G.flags, w = G.overworld;
  if (G.world !== w) return null;
  const pois = w.pois;
  if (f.mq === 0) return { x: w.capitale.cx, y: w.capitale.cy };
  if (f.mq === 2) return pois.camp && { x: pois.camp.x, y: pois.camp.y };
  if (f.mq === 3) return pois.crypte && { x: pois.crypte.x, y: pois.crypte.y };
  if (f.mq === 4) return pois.mine && { x: pois.mine.x, y: pois.mine.y };
  if (f.mq === 5) return pois.antre && { x: pois.antre.x, y: pois.antre.y };
  if (f.mq === 1) return { x: w.capitale.cx, y: w.capitale.cy };
  return null;
};

G.renderBigMap = function () {
  const w = G.overworld, p = G.player;
  const cv = $('bigmap'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!w.mapCv) return;
  ctx.drawImage(w.mapCv, 0, 0, cv.width, cv.height);
  const k = cv.width / w.w;
  ctx.font = 'bold 11px Courier New';
  for (const v of w.villages) {
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(v.cx * k - 2, v.cy * k - 2, 5, 5);
    ctx.fillStyle = '#fff';
    ctx.fillText(v.nom, v.cx * k - ctx.measureText(v.nom).width / 2, v.cy * k - 6);
  }
  const m = G.mqMarker() || (G.flags.mq < 6 && mqPoiHint(w));
  if (m) {
    ctx.fillStyle = '#ff8030';
    ctx.beginPath(); ctx.arc(m.x * k, m.y * k, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('★', m.x * k - 4, m.y * k + 4);
  }
  if (G.world === w) {
    ctx.fillStyle = '#fff';
    const px = p.x / G.TILE * k, py = p.y / G.TILE * k;
    ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.strokeStyle = '#000'; ctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
  }
  $('maplegend').innerHTML = '⬛ Vous · 🟨 Villages · 🟧 Objectif de quête principale';
};
function mqPoiHint(w) {
  const f = G.flags, pois = w.pois;
  if (f.mq === 2) return pois.camp;
  if (f.mq === 3) return pois.crypte;
  if (f.mq === 4) return pois.mine;
  if (f.mq === 5) return pois.antre;
  return null;
}
