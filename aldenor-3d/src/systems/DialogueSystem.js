import trees from '../data/dialogueTrees.json';

/**
 * DialogueSystem — dialogues arborescents (data/dialogueTrees.json).
 *
 * À l'ouverture, on choisit le nœud d'entrée via les `rules` du PNJ
 * (première condition satisfaite). Chaque nœud affiche un texte + des
 * choix ; un choix peut être conditionné (cond) et déclencher des
 * actions (accept/turnin/give/flag/rest/toast), puis mène à `next`.
 *
 * Conditions : état de quête (QuestSystem), possession d'objet
 * (Inventory), drapeaux (SaveSystem.flags). Interface 100 % HTML/CSS
 * par-dessus le canvas — jamais en 3D.
 */
export class DialogueSystem {
  constructor({ quests, inventory, flags, player }) {
    this.quests = quests;
    this.inventory = inventory;
    this.flags = flags;         // objet simple { nom: true }
    this.player = player;
    this.trees = trees;

    this.active = false;
    this.npc = null;
    this.node = null;

    this.root = document.getElementById('dialogue');
    this.nameEl = document.getElementById('dlg-nom');
    this.textEl = document.getElementById('dlg-texte');
    this.choicesEl = document.getElementById('dlg-choix');

    /** hooks : rest (auberge), toast (notif). */
    this.onRest = null;
    this.onToast = null;
  }

  canTalk(role) {
    return !!this.trees[role];
  }

  /** Ouvre le dialogue d'un PNJ (par son rôle). */
  open(npc) {
    const tree = this.trees[npc.role];
    if (!tree) return;
    this.active = true;
    this.npc = npc;
    npc.talking = true;
    // libère le curseur pour cliquer les choix
    if (document.pointerLockElement) document.exitPointerLock?.();

    // NB : on ne complète PAS l'objectif "parler" ni le rendu à
    // l'ouverture — c'est un CHOIX du joueur (action talk/turnin) qui le
    // fait, pour que l'intro de quête s'affiche bien.
    const entry = this._pickEntry(tree);
    this._goto(tree, entry);
    this.root.classList.add('on');
  }

  close() {
    if (this.npc) this.npc.talking = false;
    this.active = false;
    this.npc = null;
    this.node = null;
    this.root.classList.remove('on');
  }

  _pickEntry(tree) {
    for (const rule of tree.rules) {
      if (!rule.cond || this._testCond(rule.cond)) return rule.node;
    }
    return tree.rules[tree.rules.length - 1].node;
  }

  _testCond(c) {
    if (!c) return true;
    if (c.quest && c.state && this.quests.state(c.quest) !== c.state) return false;
    if (c.hasItem && this.inventory.count(c.hasItem) < (c.minItem || 1)) return false;
    if (c.flag && !this.flags[c.flag]) return false;
    if (c.flagNot && this.flags[c.flagNot]) return false;
    return true;
  }

  _goto(tree, nodeId) {
    if (!nodeId) { this.close(); return; }
    const node = tree.nodes[nodeId];
    if (!node) { this.close(); return; }
    this.node = nodeId;
    this.nameEl.textContent = tree.nom;
    this.textEl.textContent = node.text;
    this.choicesEl.innerHTML = '';

    const visibles = node.choices.filter(ch => this._testCond(ch.cond));
    visibles.forEach((ch, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-choix';
      b.textContent = `${i + 1}. ${ch.text}`;
      b.onclick = () => this._choose(tree, ch);
      this.choicesEl.appendChild(b);
    });
    if (visibles.length === 0) {
      const b = document.createElement('button');
      b.className = 'dlg-choix';
      b.textContent = '1. …';
      b.onclick = () => this.close();
      this.choicesEl.appendChild(b);
    }
  }

  _choose(tree, ch) {
    if (ch.action) this._runAction(ch.action);
    if (ch.next) this._goto(tree, ch.next);
    else this.close();
  }

  _runAction(a) {
    if (a.accept) this.quests.accept(a.accept);
    // "talk" (objectif parler) et "turnin" (rendu) passent par notifyTalk,
    // qui complète l'objectif talk actif et/ou rend une quête readyToTurnIn
    if (a.talk || a.turnin) this.quests.notifyTalk(this.npc.role);
    if (a.give) { this.inventory.add(a.give.id, a.give.n || 1); this.onToast?.(`Reçu : ${this.inventory.nom(a.give.id)} ×${a.give.n || 1}`); }
    if (a.flag) this.flags[a.flag] = true;
    if (a.rest) this.onRest?.();
    if (a.toast) this.onToast?.(a.toast);
  }

  /** Sélection au clavier (1-4). */
  key(code) {
    if (!this.active) return;
    if (code === 'Escape') { this.close(); return; }
    const m = code.match(/^Digit([1-9])$/);
    if (m) {
      const btns = this.choicesEl.querySelectorAll('.dlg-choix');
      const b = btns[parseInt(m[1], 10) - 1];
      if (b) b.click();
    }
  }
}
