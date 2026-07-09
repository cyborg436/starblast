'use strict';
/* ============================================================
   quests.js — quête principale, quêtes annexes, dialogues
   ============================================================ */

/* Étapes de la quête principale (G.flags.mq) :
   0 : parler à Aldric (l'ancien d'Aldenor)
   1 : tuer 5 loups
   2 : tuer Garrok au camp des bandits
   3 : vaincre Malakar dans la crypte (clé donnée)
   4 : apporter 5 minerais de fer au forgeron → Lame stellaire
   5 : tuer Vermithrax
   6 : terminé                                              */

G.MQ_TITRES = [
  'L\'Aube d\'Aldenor', 'La meute affamée', 'Le camp des bandits',
  'La Crypte Oubliée', 'La Lame stellaire', 'Vermithrax',
];
G.MQ_DESCS = [
  'Parlez à Aldric, l\'ancien du village d\'Aldenor.',
  'Tuez 5 loups qui rôdent autour du village.',
  'Retrouvez le camp des bandits et éliminez Garrok le Balafré.',
  'Entrez dans la crypte au cimetière et vainquez Malakar le Nécromancien.',
  'Apportez 5 minerais de fer et le fragment d\'étoile au forgeron d\'Aldenor.',
  'Armé de la Lame stellaire, affrontez Vermithrax dans son antre au nord.',
];

G.quests = []; // quêtes annexes

/* ---------- Génération des quêtes annexes ---------- */
const CHASSE_CIBLES = {
  [G.REG.PLAINE]: ['slime', 'loup', 'gobelin'],
  [G.REG.FORET]: ['loup', 'araignee', 'bandit'],
  [G.REG.DESERT]: ['scorpion', 'serpent'],
  [G.REG.MARAIS]: ['slimetox', 'zombi', 'fantome'],
  [G.REG.NEIGE]: ['loupblanc', 'yeti'],
  [G.REG.MONTAGNE]: ['golem', 'orc'],
};
const COLLECTE_ITEMS = ['gelee', 'peauloup', 'croc', 'os', 'soie', 'venin'];

G.genSideQuests = function (seed) {
  G.quests.length = 0;
  const rng = G.mulberry32(seed + 4242);
  const w = G.overworld;
  let qid = 0;
  w.villages.forEach((v, vi) => {
    const reg = w.region[v.cy * w.w + v.cx];
    const dif = Math.max(1, Math.round(G.dist(v.cx, v.cy, w.capitale.cx, w.capitale.cy) / 30));
    const givers = v.npcs.filter(n => ['villageois', 'aubergiste', 'alchimiste'].includes(n.role));
    const nQ = Math.min(givers.length, 2 + (vi === 0 ? 1 : 0));
    for (let k = 0; k < nQ; k++) {
      const giver = givers[k];
      const type = G.choice(rng, ['chasse', 'collecte', 'livraison']);
      const q = { id: 'sq' + (qid++), type, giver: giver.nom, village: v.nom, etat: 'dispo', prog: 0 };
      if (type === 'chasse') {
        const table = CHASSE_CIBLES[reg] || CHASSE_CIBLES[G.REG.PLAINE];
        q.cible = G.choice(rng, table);
        q.n = G.rint(rng, 4, 8);
        q.titre = 'Chasse : ' + G.ENNEMIS[q.cible].nom;
        q.desc = `${giver.nom} de ${v.nom} vous demande de tuer ${q.n} ${G.ENNEMIS[q.cible].nom.toLowerCase()}(s).`;
        q.recOr = 20 * dif + q.n * 6; q.recXp = 20 * dif + q.n * 8;
      } else if (type === 'collecte') {
        q.cible = G.choice(rng, COLLECTE_ITEMS);
        q.n = G.rint(rng, 3, 6);
        q.titre = 'Collecte : ' + G.ITEMS[q.cible].nom;
        q.desc = `Rapportez ${q.n} × ${G.ITEMS[q.cible].nom} à ${giver.nom} (${v.nom}).`;
        q.recOr = 15 * dif + q.n * 10; q.recXp = 15 * dif + q.n * 6;
      } else {
        const autres = w.villages.filter(o => o !== v);
        const dest = autres[G.rint(rng, 0, autres.length - 1)];
        const destN = dest.npcs.find(n => n.role === 'aubergiste') || dest.npcs[0];
        q.cible = destN.nom; q.destVillage = dest.nom; q.n = 1;
        q.titre = 'Livraison : ' + dest.nom;
        q.desc = `Portez une lettre de ${giver.nom} à ${destN.nom}, à ${dest.nom}.`;
        q.recOr = 30 * dif + 20; q.recXp = 30 * dif;
      }
      G.quests.push(q);
    }
  });
};

/* ---------- Hooks de progression ---------- */
G.onKill = function (id) {
  // quête principale : loups
  if (G.flags.mq === 1 && id === 'loup') {
    G.flags.mqProg++;
    if (G.flags.mqProg <= 5) G.toast(`Loups tués : ${G.flags.mqProg}/5`, 'quest');
    if (G.flags.mqProg === 5) { G.toast('Retournez voir Aldric à Aldenor.', 'quest'); G.sfx('quete'); }
  }
  if (G.flags.mq === 2 && id === 'chefbandit') {
    G.addItem('sceauvole', 1);
    G.toast('Vous récupérez le sceau du bourgmestre. Retournez voir Aldric.', 'quest');
    G.sfx('quete');
  }
  if (G.flags.mq === 3 && id === 'necromancien') {
    G.addItem('fragment', 1);
    G.toast('Un fragment d\'étoile ! Apportez-le au forgeron d\'Aldenor.', 'quest');
    G.sfx('quete');
  }
  // annexes
  for (const q of G.quests) {
    if (q.etat === 'active' && q.type === 'chasse' && q.cible === id && q.prog < q.n) {
      q.prog++;
      G.toast(`${q.titre} : ${q.prog}/${q.n}`, 'quest');
      if (q.prog >= q.n) { q.etat = 'rendre'; G.toast(`Retournez voir ${q.giver} (${q.village}).`, 'quest'); G.sfx('quete'); }
      G.uiDirty = true;
    }
  }
};

/* ============================================================
   DIALOGUES
   ============================================================ */
G.dlgOpen = false;
let dlgOpts = [];

G.showDlg = function (nom, texte, opts) {
  G.dlgOpen = true;
  document.getElementById('dlg').classList.remove('hidden');
  document.getElementById('dlgname').textContent = nom;
  document.getElementById('dlgtext').textContent = texte;
  const oDiv = document.getElementById('dlgopts');
  oDiv.innerHTML = '';
  dlgOpts = opts;
  opts.forEach((o, i) => {
    const d = document.createElement('div');
    d.textContent = (i + 1) + '. ' + o.t;
    d.onclick = () => { G.sfx('clic'); o.fn(); };
    oDiv.appendChild(d);
  });
};
G.closeDlg = function () {
  G.dlgOpen = false;
  document.getElementById('dlg').classList.add('hidden');
};
G.dlgChoice = function (i) {
  if (G.dlgOpen && dlgOpts[i]) { G.sfx('clic'); dlgOpts[i].fn(); }
};

const AUREVOIR = { t: 'Au revoir.', fn: () => G.closeDlg() };

/* ---------- Dialogue par PNJ ---------- */
G.startDialogue = function (npc) {
  const p = G.player;
  switch (npc.role) {
    case 'ancien': return dlgAncien(npc);
    case 'forgeron': return dlgForgeron(npc);
    case 'marchand':
      return G.showDlg(npc.nom + ', marchand', 'Bienvenue dans mon échoppe, voyageur ! J\'ai tout ce qu\'il faut pour survivre dehors.', [
        { t: 'Voir vos marchandises.', fn: () => { G.closeDlg(); G.openShop('marchand', npc); } },
        AUREVOIR,
      ]);
    case 'alchimiste':
      return dlgAvecQuetes(npc, npc.nom + ', alchimiste', 'Hmm ? Ah, un client. Attention où vous mettez les pieds, certaines fioles explosent.', [
        { t: 'Voir vos potions.', fn: () => { G.closeDlg(); G.openShop('alchimiste', npc); } },
      ]);
    case 'mystique':
      return G.showDlg('Zephyrine la Mystique', 'Peu de mortels trouvent ma tour. Les étoiles m\'ont parlé de vous… et de la bête au nord. Mes trésors ne sont pas donnés.', [
        { t: 'Voir vos trésors.', fn: () => { G.closeDlg(); G.openShop('mystique', npc); } },
        AUREVOIR,
      ]);
    case 'aubergiste':
      return dlgAvecQuetes(npc, npc.nom + ', aubergiste', 'Bienvenue à l\'auberge ! Une chambre pour la nuit ? Cela vous remettra d\'aplomb, et je garderai vos affaires en sécurité.', [
        { t: 'Se reposer (5 or) — soigne et sauvegarde.', fn: () => dormir(npc) },
      ]);
    case 'garde': {
      const lignes = [
        'Restez sur les routes la nuit, voyageur. Les monstres y sont plus hardis.',
        'Le nord est infesté de golems. N\'y allez pas sans une bonne armure.',
        'On dit qu\'une mystérieuse tour se dresse loin des villages…',
        'Les marais rendent fou. Ou mort. Souvent les deux.',
      ];
      return G.showDlg('Garde ' + npc.nom, lignes[Math.floor(Math.random() * lignes.length)], [AUREVOIR]);
    }
    default: return dlgVillageois(npc);
  }
};

function dlgAvecQuetes(npc, titre, texte, baseOpts) {
  const opts = [...baseOpts];
  ajouterOptsQuetes(npc, opts);
  opts.push(AUREVOIR);
  G.showDlg(titre, texte, opts);
}

function dlgVillageois(npc) {
  const lignes = [
    'Belle journée, n\'est-ce pas ? Enfin, tant que les loups restent loin.',
    'Mon grand-père disait que les ruines au loin sont maudites.',
    'Vous avez vu la taille des slimes cette année ? C\'est la pluie, je vous dis.',
    'Un dragon au nord, des bandits partout… où va le monde, je vous le demande.',
    'Si vous trouvez des baies, gardez-les. On ne sait jamais.',
  ];
  const opts = [];
  ajouterOptsQuetes(npc, opts);
  opts.push(AUREVOIR);
  G.showDlg(npc.nom, lignes[Math.floor(Math.random() * lignes.length)], opts);
}

function ajouterOptsQuetes(npc, opts) {
  for (const q of G.quests) {
    if (q.giver !== npc.nom) {
      // destinataire d'une livraison ?
      if (q.type === 'livraison' && q.etat === 'active' && q.cible === npc.nom) {
        opts.push({ t: `Remettre la lettre de ${q.giver}.`, fn: () => {
          G.removeItem('lettre', 1);
          q.etat = 'rendre';
          G.showDlg(npc.nom, 'Une lettre pour moi ? Merci infiniment ! Dites à ' + q.giver + ' que la réponse est oui. Repassez le voir, il saura vous récompenser.', [AUREVOIR]);
        } });
      }
      continue;
    }
    if (q.etat === 'dispo') {
      opts.push({ t: `[Quête] ${q.titre}`, fn: () => {
        q.etat = 'active';
        if (q.type === 'livraison') G.addItem('lettre', 1);
        G.sfx('quete'); G.uiDirty = true;
        G.showDlg(npc.nom, q.desc + `\n\nRécompense : ${q.recOr} or, ${q.recXp} XP.`, [{ t: 'J\'accepte.', fn: () => G.closeDlg() }]);
      } });
    } else if (q.etat === 'active' && q.type === 'collecte' && G.countItem(q.cible) >= q.n) {
      opts.push({ t: `[Rendre] ${q.titre} (${q.n} × ${G.ITEMS[q.cible].nom})`, fn: () => {
        G.removeItem(q.cible, q.n);
        finirQuete(q, npc);
      } });
    } else if (q.etat === 'rendre' && q.type !== 'livraison') {
      opts.push({ t: `[Rendre] ${q.titre}`, fn: () => finirQuete(q, npc) });
    } else if (q.etat === 'rendre' && q.type === 'livraison') {
      opts.push({ t: `[Rendre] ${q.titre} — lettre remise.`, fn: () => finirQuete(q, npc) });
    } else if (q.etat === 'active') {
      opts.push({ t: `(En cours) ${q.titre}`, fn: () => G.showDlg(npc.nom, q.desc, [AUREVOIR]) });
    }
  }
}

function finirQuete(q, npc) {
  q.etat = 'finie';
  G.player.or += q.recOr;
  G.gainXP(q.recXp);
  G.sfx('quete');
  G.uiDirty = true;
  G.showDlg(npc.nom, `Merveilleux travail ! Voici votre dû : ${q.recOr} pièces d'or.`, [AUREVOIR]);
}

function dormir(npc) {
  const p = G.player;
  if (p.or < 5) return G.showDlg(npc.nom, 'Désolé, c\'est 5 pièces d\'or la nuit. Revenez quand votre bourse sera moins légère.', [AUREVOIR]);
  p.or -= 5;
  p.pv = p.pvmax; p.pm = p.pmmax; p.end = p.endmax;
  G.time = (Math.floor(G.time / G.JOUR) + 1) * G.JOUR + G.JOUR * 0.28; // réveil au matin
  G.sauver();
  G.sfx('boire');
  G.closeDlg();
  G.toast('Vous vous réveillez frais et dispos. Partie sauvegardée.', 'quest');
  G.uiDirty = true;
}

/* ---------- Quête principale : l'ancien ---------- */
function dlgAncien(npc) {
  const f = G.flags;
  const nom = 'Aldric, ancien d\'Aldenor';
  switch (f.mq) {
    case 0:
      return G.showDlg(nom,
        'Ah, un aventurier ! Les dieux vous envoient. Aldenor traverse des heures sombres : les loups attaquent les fermes, des bandits pillent nos routes, et l\'on murmure que Vermithrax, le dragon des légendes, s\'est réveillé dans les montagnes du nord.\n\nAiderez-vous notre village ?', [
          { t: 'Je vous aiderai. Par où commencer ?', fn: () => {
            f.mq = 1; f.mqProg = 0; G.sfx('quete'); G.uiDirty = true;
            G.showDlg(nom, 'Commencez par la meute de loups qui rôde autour du village. Tuez-en cinq, cela les fera fuir un temps. Revenez me voir ensuite.', [AUREVOIR]);
          } },
          { t: 'Je vais y réfléchir.', fn: () => G.closeDlg() },
        ]);
    case 1:
      if (f.mqProg >= 5) {
        return G.showDlg(nom, 'Les hurlements se sont tus… Vous avez fait du bon travail !\n\nHélas, un mal plus grand nous frappe : des bandits ont volé le sceau du bourgmestre. Sans lui, nous ne pouvons plus commercer. Leur camp est à l\'est. Leur chef, Garrok le Balafré, est dangereux — préparez-vous.', [
          { t: 'Garrok est un homme mort.', fn: () => { f.mq = 2; G.sfx('quete'); G.uiDirty = true; G.closeDlg(); } },
        ]);
      }
      return G.showDlg(nom, `Les loups rôdent toujours… (${f.mqProg}/5 tués). Cherchez-les dans les plaines et les bois alentour.`, [AUREVOIR]);
    case 2:
      if (G.countItem('sceauvole') > 0) {
        G.removeItem('sceauvole', 1);
        f.mq = 3; G.player.or += 100; G.gainXP(80); G.addItem('clecrypte', 1); G.sfx('quete'); G.uiDirty = true;
        return G.showDlg(nom, 'Le sceau ! Vous êtes notre héros. Voici 100 pièces d\'or.\n\nMais écoutez : pour vaincre Vermithrax, il vous faudra une arme céleste. La légende parle d\'un fragment d\'étoile gardé par le nécromancien Malakar, dans la crypte au sud. Prenez cette clé — et que l\'Aube vous protège.', [
          { t: 'Je reviendrai avec le fragment.', fn: () => G.closeDlg() },
        ]);
      }
      return G.showDlg(nom, 'Le camp des bandits se trouve à l\'est du village. Récupérez notre sceau des mains de Garrok.', [AUREVOIR]);
    case 3:
      return G.showDlg(nom, 'La crypte se trouve au cimetière, au sud. Malakar y règne sur les morts. Le fragment d\'étoile doit revenir à notre forgeron.', [AUREVOIR]);
    case 4:
      return G.showDlg(nom, 'Apportez le fragment et cinq minerais de fer à notre forgeron. La mine de Grisepierre en regorge… si vous survivez à ce qui y grouille.', [AUREVOIR]);
    case 5:
      return G.showDlg(nom, 'La Lame stellaire chante entre vos mains… Vermithrax vous attend dans son antre, au nord, dans les terres gelées. Tout Aldenor prie pour vous.', [AUREVOIR]);
    default:
      return G.showDlg(nom, 'Le tueur de dragon ! Les bardes chantent déjà vos exploits. Aldenor vous doit tout.', [AUREVOIR]);
  }
}

/* ---------- Quête principale : le forgeron ---------- */
function dlgForgeron(npc) {
  const f = G.flags;
  const nom = npc.nom + ', forgeron';
  const opts = [
    { t: 'Voir vos armes et armures.', fn: () => { G.closeDlg(); G.openShop('forgeron', npc); } },
  ];
  if (npc.vi === 0 && f.mq === 3 && G.countItem('fragment') > 0) {
    opts.unshift({ t: 'Montrer le fragment d\'étoile.', fn: () => {
      f.mq = 4; G.sfx('quete'); G.uiDirty = true;
      G.showDlg(nom, 'Par tous les feux de la forge… un fragment d\'étoile ! Avec ça, je peux forger une lame de légende. Apportez-moi 5 minerais de fer — la mine de Grisepierre en est pleine — et je m\'y mets sur-le-champ.', [AUREVOIR]);
    } });
  }
  if (npc.vi === 0 && f.mq === 4) {
    if (G.countItem('minerai') >= 5 && G.countItem('fragment') > 0) {
      opts.unshift({ t: '⚒ Forger la Lame stellaire (5 minerais + fragment).', fn: () => {
        G.removeItem('minerai', 5); G.removeItem('fragment', 1);
        G.addItem('epee5', 1);
        f.mq = 5; G.sfx('forge'); G.gainXP(150); G.uiDirty = true;
        G.showDlg(nom, '*Le marteau frappe, les étincelles fusent, le métal céleste chante*\n\nVoilà. La Lame stellaire. Je n\'ai jamais rien forgé de tel, et je ne le referai jamais. Allez, tuez ce dragon — et revenez me raconter.', [AUREVOIR]);
      } });
    } else {
      opts.unshift({ t: `(Il me faut 5 minerais de fer — j'en ai ${G.countItem('minerai')}.)`, fn: () => G.closeDlg() });
    }
  }
  opts.push(AUREVOIR);
  G.showDlg(nom, 'Le métal ne ment jamais, voyageur. Besoin d\'une lame ?', opts);
}

/* ---------- Résumé du journal ---------- */
G.mqEntry = function () {
  const f = G.flags;
  if (f.mq >= 6) return null;
  let desc = G.MQ_DESCS[f.mq];
  if (f.mq === 1) desc += ` (${f.mqProg}/5)`;
  if (f.mq === 4) desc += ` (minerai : ${G.countItem('minerai')}/5)`;
  return { titre: G.MQ_TITRES[f.mq], desc };
};
