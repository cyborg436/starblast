'use strict';
/* ============================================================
   items.js — objets, équipement, butin, boutiques
   type: arme | armure | casque | anneau | conso | mat | quete
   ============================================================ */

G.ITEMS = {
  /* ---- Armes (melee) ---- */
  epee1:  { nom: 'Épée rouillée',    type: 'arme', cat: 'melee', atk: 4,  cd: 0.45, prix: 25,  ic: ['epee', '#9a8f7f'], desc: 'Elle a connu des jours meilleurs.' },
  epee2:  { nom: 'Épée de fer',      type: 'arme', cat: 'melee', atk: 8,  cd: 0.45, prix: 90,  ic: ['epee', '#b8bcc4'], desc: 'Fiable et bien équilibrée.' },
  epee3:  { nom: 'Lame d\'acier',    type: 'arme', cat: 'melee', atk: 14, cd: 0.42, prix: 260, ic: ['epee', '#d8e0e8'], desc: 'Forgée par un maître.' },
  epee4:  { nom: 'Épée runique',     type: 'arme', cat: 'melee', atk: 22, cd: 0.4,  prix: 700, ic: ['epee', '#78c8e8'], desc: 'Des runes anciennes luisent sur la lame.' },
  epee5:  { nom: 'Lame stellaire',   type: 'arme', cat: 'melee', atk: 34, cd: 0.35, prix: 0,   ic: ['epee', '#e8d060'], desc: 'Forgée dans un fragment d\'étoile. Seule arme capable de percer les écailles de Vermithrax.', quete: true },
  hache1: { nom: 'Hache de bûcheron',type: 'arme', cat: 'melee', atk: 6,  cd: 0.6,  prix: 40,  ic: ['hache', '#9a9088'], desc: 'Lente mais brutale.' },
  hache2: { nom: 'Hache de guerre',  type: 'arme', cat: 'melee', atk: 12, cd: 0.6,  prix: 180, ic: ['hache', '#c8ccd4'], desc: 'Fend les boucliers comme du bois.' },
  hache3: { nom: 'Hache berserker',  type: 'arme', cat: 'melee', atk: 19, cd: 0.55, prix: 520, ic: ['hache', '#e89050'], desc: 'Elle réclame du sang.' },
  /* ---- Armes (arc) ---- */
  arc1:   { nom: 'Arc court',        type: 'arme', cat: 'arc', atk: 3,  cd: 0.55, prix: 45,  ic: ['arc', '#d8d4c8'], desc: 'Attaque à distance.' },
  arc2:   { nom: 'Arc long',         type: 'arme', cat: 'arc', atk: 7,  cd: 0.5,  prix: 160, ic: ['arc', '#e8e4d8'], desc: 'Portée et puissance accrues.' },
  arc3:   { nom: 'Arc elfique',      type: 'arme', cat: 'arc', atk: 13, cd: 0.42, prix: 480, ic: ['arc', '#80e890'], desc: 'Léger comme une plume, mortel comme l\'hiver.' },
  /* ---- Armes (bâton, bonus magie) ---- */
  baton1: { nom: 'Bâton de novice',  type: 'arme', cat: 'melee', atk: 3,  mag: 3, cd: 0.5, prix: 50,  ic: ['baton', '#68c8e8'], desc: '+3 puissance magique.' },
  baton2: { nom: 'Bâton d\'arcane',  type: 'arme', cat: 'melee', atk: 6,  mag: 8, cd: 0.5, prix: 300, ic: ['baton', '#a868e8'], desc: '+8 puissance magique.' },
  /* ---- Armures ---- */
  arm1: { nom: 'Tunique de cuir',    type: 'armure', def: 2,  prix: 30,  ic: ['armure', '#8a5e34'], desc: 'Mieux que rien.' },
  arm2: { nom: 'Cotte de mailles',   type: 'armure', def: 5,  prix: 120, ic: ['armure', '#9aa0aa'], desc: 'Un millier d\'anneaux de fer.' },
  arm3: { nom: 'Plastron d\'acier',  type: 'armure', def: 9,  prix: 340, ic: ['armure', '#c8d0d8'], desc: 'Armure de chevalier.' },
  arm4: { nom: 'Armure draconique',  type: 'armure', def: 14, prix: 900, ic: ['armure', '#c04030'], desc: 'Faite d\'écailles de dragon.' },
  /* ---- Casques ---- */
  csq1: { nom: 'Capuche de cuir',    type: 'casque', def: 1, prix: 20,  ic: ['casque', '#8a5e34'], desc: 'Discrète et confortable.' },
  csq2: { nom: 'Casque de fer',      type: 'casque', def: 3, prix: 80,  ic: ['casque', '#9aa0aa'], desc: 'Protège l\'essentiel.' },
  csq3: { nom: 'Heaume d\'acier',    type: 'casque', def: 6, prix: 260, ic: ['casque', '#c8d0d8'], desc: 'Vision réduite, crâne intact.' },
  /* ---- Anneaux ---- */
  ann1: { nom: 'Anneau de vigueur',  type: 'anneau', pv: 20,  prix: 150, ic: ['anneau', '#e04848'], desc: '+20 PV max.' },
  ann2: { nom: 'Anneau de sagesse',  type: 'anneau', pm: 15,  prix: 150, ic: ['anneau', '#4878e0'], desc: '+15 PM max.' },
  ann3: { nom: 'Anneau de force',    type: 'anneau', atk: 4,  prix: 220, ic: ['anneau', '#e0a030'], desc: '+4 attaque.' },
  ann4: { nom: 'Sceau du dragon',    type: 'anneau', atk: 6, def: 4, pv: 30, prix: 0, ic: ['anneau', '#e04010'], desc: 'Trésor de l\'antre de Vermithrax.', quete: false },
  /* ---- Consommables ---- */
  ppv1: { nom: 'Potion de soin',        type: 'conso', soin: 30,  prix: 15,  ic: ['potion', '#d83848'], stack: 9, desc: 'Rend 30 PV.' },
  ppv2: { nom: 'Grande potion de soin', type: 'conso', soin: 80,  prix: 45,  ic: ['potion', '#f06060'], stack: 9, desc: 'Rend 80 PV.' },
  ppm1: { nom: 'Potion de mana',        type: 'conso', mana: 25,  prix: 18,  ic: ['potion', '#3858d8'], stack: 9, desc: 'Rend 25 PM.' },
  ppm2: { nom: 'Grande potion de mana', type: 'conso', mana: 60,  prix: 50,  ic: ['potion', '#6080f0'], stack: 9, desc: 'Rend 60 PM.' },
  pain: { nom: 'Pain de seigle',        type: 'conso', soin: 12,  prix: 5,   ic: ['pain'], stack: 9, desc: 'Rend 12 PV. Croustillant.' },
  viande:{ nom: 'Gigot rôti',           type: 'conso', soin: 25,  prix: 12,  ic: ['viande'], stack: 9, desc: 'Rend 25 PV.' },
  baie: { nom: 'Baies sauvages',        type: 'conso', soin: 6,   prix: 2,   ic: ['gelee', '#d83048'], stack: 9, desc: 'Rend 6 PV. Cueillies dans les buissons.' },
  champignon: { nom: 'Champignon',      type: 'conso', soin: 8, mana: 5, prix: 4, ic: ['gelee', '#c04030'], stack: 9, desc: 'Rend 8 PV et 5 PM.' },
  /* ---- Matériaux ---- */
  gelee:   { nom: 'Gelée visqueuse',   type: 'mat', prix: 3,  ic: ['gelee', '#5ab83a'], stack: 20, desc: 'Reste gluant de slime.' },
  peauloup:{ nom: 'Peau de loup',      type: 'mat', prix: 8,  ic: ['peau', '#8a7050'], stack: 20, desc: 'Fourrure épaisse.' },
  croc:    { nom: 'Croc acéré',        type: 'mat', prix: 6,  ic: ['croc'], stack: 20, desc: 'Encore humide.' },
  os:      { nom: 'Ossements',         type: 'mat', prix: 5,  ic: ['os'], stack: 20, desc: 'Ça ferait un bon bouillon. Ou pas.' },
  minerai: { nom: 'Minerai de fer',    type: 'mat', prix: 12, ic: ['minerai', '#d88030'], stack: 20, desc: 'Extrait des veines de la montagne.' },
  soie:    { nom: 'Soie d\'araignée',  type: 'mat', prix: 7,  ic: ['essence', '#e8e8e0'], stack: 20, desc: 'Résistante et légère.' },
  essence: { nom: 'Essence spectrale', type: 'mat', prix: 15, ic: ['essence', '#a0c8f0'], stack: 20, desc: 'Le souffle d\'un fantôme, en bouteille.' },
  ecaille: { nom: 'Écaille de dragon', type: 'mat', prix: 60, ic: ['ecaille', '#c04030'], stack: 20, desc: 'Dure comme l\'acier.' },
  venin:   { nom: 'Poche de venin',    type: 'mat', prix: 9,  ic: ['gelee', '#a03ab8'], stack: 20, desc: 'À manipuler avec précaution.' },
  plume:   { nom: 'Plume noire',       type: 'mat', prix: 4,  ic: ['plume', '#3a3a4a'], stack: 20, desc: 'Tombée d\'une aile membraneuse.' },
  gemme:   { nom: 'Gemme brute',       type: 'mat', prix: 40, ic: ['gemme', '#68c8e8'], stack: 20, desc: 'Elle brille de mille feux.' },
  /* ---- Objets de quête ---- */
  sceauvole:  { nom: 'Sceau du bourgmestre', type: 'quete', prix: 0, ic: ['sceau'], desc: 'Le sceau volé par les bandits.' },
  fragment:   { nom: 'Fragment d\'étoile',   type: 'quete', prix: 0, ic: ['fragment', '#e8e080'], desc: 'Un éclat de métal céleste, chaud au toucher.' },
  lettre:     { nom: 'Lettre scellée',       type: 'quete', prix: 0, ic: ['lettre'], desc: 'À remettre à son destinataire.' },
  clecrypte:  { nom: 'Clé de la crypte',     type: 'quete', prix: 0, ic: ['cle', '#b8bcc4'], desc: 'Ouvre la crypte oubliée.' },
};

/* icônes construites après buildSprites() */
G.buildItemIcons = function () {
  for (const id in G.ITEMS) {
    const it = G.ITEMS[id];
    it.icon = G.makeIcon(it.ic[0], it.ic[1], it.ic[2]);
    it.id = id;
  }
};

/* ---- Tables de butin : [itemId | 'or', proba, min, max] ---- */
G.LOOT = {
  slime:      [['gelee', 0.8, 1, 2], ['or', 0.5, 1, 4]],
  slimetox:   [['gelee', 0.6, 1, 2], ['venin', 0.5, 1, 1], ['or', 0.5, 2, 6]],
  loup:       [['peauloup', 0.7, 1, 1], ['croc', 0.4, 1, 2], ['or', 0.4, 2, 5]],
  loupblanc:  [['peauloup', 0.8, 1, 2], ['croc', 0.5, 1, 2], ['or', 0.5, 4, 9]],
  gobelin:    [['or', 0.8, 3, 8], ['croc', 0.25, 1, 1], ['ppv1', 0.12, 1, 1]],
  orc:        [['or', 0.8, 6, 14], ['ppv1', 0.15, 1, 1], ['minerai', 0.2, 1, 1]],
  bandit:     [['or', 0.9, 4, 12], ['ppv1', 0.15, 1, 1], ['pain', 0.2, 1, 1]],
  chefbandit: [['or', 1, 40, 60], ['ppv2', 1, 1, 2]],
  squelette:  [['os', 0.8, 1, 2], ['or', 0.5, 3, 8]],
  zombi:      [['os', 0.5, 1, 1], ['or', 0.5, 3, 7], ['essence', 0.1, 1, 1]],
  fantome:    [['essence', 0.6, 1, 1], ['or', 0.4, 4, 10]],
  araignee:   [['soie', 0.7, 1, 2], ['venin', 0.3, 1, 1]],
  chauvesouris:[['plume', 0.6, 1, 2], ['or', 0.3, 1, 3]],
  scorpion:   [['venin', 0.6, 1, 1], ['or', 0.4, 3, 8]],
  serpent:    [['venin', 0.5, 1, 1], ['peauloup', 0.3, 1, 1], ['or', 0.4, 2, 6]],
  golem:      [['minerai', 0.8, 1, 3], ['gemme', 0.25, 1, 1], ['or', 0.6, 8, 16]],
  golemglace: [['gemme', 0.4, 1, 1], ['minerai', 0.5, 1, 2], ['or', 0.6, 10, 18]],
  golemancien:[['gemme', 1, 1, 2], ['or', 1, 60, 90]],
  yeti:       [['peauloup', 0.9, 2, 3], ['or', 0.6, 10, 20]],
  momie:      [['essence', 0.4, 1, 1], ['or', 0.6, 6, 14]],
  necromancien:[['or', 1, 80, 120], ['ppm2', 1, 1, 2]],
  dragon:     [['ecaille', 1, 3, 5], ['or', 1, 400, 600], ['gemme', 1, 2, 3]],
};

/* ---- Stocks des marchands ---- */
G.SHOPS = {
  marchand:   ['ppv1', 'ppm1', 'pain', 'viande', 'ppv2', 'ppm2', 'arc1', 'csq1', 'ann1', 'ann2'],
  forgeron:   ['epee1', 'epee2', 'hache1', 'hache2', 'arm1', 'arm2', 'csq2', 'epee3', 'arm3', 'csq3', 'hache3', 'arc2', 'ann3'],
  alchimiste: ['ppv1', 'ppm1', 'ppv2', 'ppm2', 'champignon', 'baton1', 'baton2', 'baie'],
  mystique:   ['epee4', 'arc3', 'arm4', 'ann3', 'ppv2', 'ppm2'],
};

/* ============================================================
   Inventaire du joueur (24 cases)
   ============================================================ */
G.INV_SIZE = 24;

G.addItem = function (id, n = 1) {
  const def = G.ITEMS[id]; if (!def) return false;
  const inv = G.player.inv;
  if (def.stack) {
    for (const s of inv) {
      if (s && s.id === id && s.n < def.stack) {
        const add = Math.min(n, def.stack - s.n);
        s.n += add; n -= add;
        if (n <= 0) { G.uiDirty = true; return true; }
      }
    }
  }
  while (n > 0) {
    const i = inv.indexOf(null);
    if (i === -1) { G.toast('Inventaire plein !', 'combat'); return false; }
    const put = def.stack ? Math.min(n, def.stack) : 1;
    inv[i] = { id, n: put };
    n -= put;
  }
  G.uiDirty = true;
  return true;
};

G.countItem = function (id) {
  return G.player.inv.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0);
};

G.removeItem = function (id, n = 1) {
  const inv = G.player.inv;
  for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i];
    if (s && s.id === id) {
      const take = Math.min(n, s.n);
      s.n -= take; n -= take;
      if (s.n <= 0) inv[i] = null;
    }
  }
  G.uiDirty = true;
  return n <= 0;
};
