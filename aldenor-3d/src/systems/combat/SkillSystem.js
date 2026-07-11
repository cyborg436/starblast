/**
 * SkillSystem — compétences élémentaires (touche E) + ultime (touche R)
 * + jauge d'ÉNERGIE.
 *
 * COMPÉTENCE (E) : chaque arme/personnage a une compétence assignée ;
 * cooldown propre affiché au HUD. Ici : 4 compétences, une par élément,
 * interchangeables avec les touches 1-4 (placeholder de loadout — plus
 * tard, l'arme équipée déterminera la compétence).
 *
 * ÉNERGIE : +6 par coup léger touché, +10 lourde, +5 compétence,
 * +4 en subissant des dégâts. À 100, la touche R déclenche l'ULTIME :
 * nova de zone à forts dégâts qui applique l'élément courant.
 *
 * Toutes les valeurs sont dans SKILLS / ULTIME.
 */

const SKILLS = {
  feu: {
    nom: 'Éruption', cd: 6, degats: 34, poise: 25,
    portee: 3.2, rayon: 2.6, arc: 1.2, // cône enflammé devant soi
    desc: 'Cône de flammes — applique Feu.',
  },
  eau: {
    nom: 'Vague', cd: 6, degats: 28, poise: 20, kb: 4,
    portee: 3.2, rayon: 2.8, arc: 1.3,
    desc: 'Déferlante qui repousse — applique Eau.',
  },
  foudre: {
    nom: 'Chaîne d\'éclairs', cd: 7, degats: 30, poise: 18,
    portee: 8, chaine: 3, // frappe la cible + saute sur 2 ennemis proches
    desc: 'Foudroie jusqu\'à 3 ennemis — applique Foudre.',
  },
  vent: {
    nom: 'Lame de tempête', cd: 5, degats: 22, poise: 15, kb: 3,
    portee: 4.5, rayon: 3.2, arc: 1.5,
    desc: 'Bourrasque tranchante — déclenche la Diffusion.',
  },
};

const ULTIME = {
  cout: 100,          // énergie requise (jauge pleine)
  degats: 95,
  poise: 100,         // stagger quasi garanti
  rayon: 7,           // nova autour du joueur
  duree: 0.7,         // verrouillage pendant l'anim
  hitStopMs: 130,
  shake: 0.9,
};

const DUREE_SKILL = 0.5; // verrouillage pendant le cast de la compétence

export class SkillSystem {
  constructor(cs) {
    this.cs = cs;
    this.element = 'foudre';   // compétence équipée par défaut
    this.cooldown = 0;
    this.energie = 0;
    this.energieMax = ULTIME.cout;
    this.lock = null;          // 'skill' | 'ultime' | null
    this.t = 0;
  }

  get skill() {
    return SKILLS[this.element];
  }

  gainEnergie(n) {
    this.energie = Math.min(this.energieMax, this.energie + n);
  }

  update(dt) {
    const { input, player } = this.cs;
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.lock) {
      this.t += dt;
      if (this.t >= (this.lock === 'ultime' ? ULTIME.duree : DUREE_SKILL)) this.lock = null;
      return;
    }

    // changement de compétence (placeholder loadout : touches 1-4)
    const ordres = ['feu', 'eau', 'foudre', 'vent'];
    for (let i = 0; i < 4; i++) {
      if (input.wasPressed('Digit' + (i + 1))) {
        this.element = ordres[i];
        this.cs.juice.annonce(`Compétence : ${SKILLS[this.element].nom} (${this.element})`);
      }
    }

    if (this.cs.lock || !player.grounded || player.swimming || player.dead) return;

    if (input.wasActionPressed('skill') && this.cooldown <= 0) this._cast();
    else if (input.wasActionPressed('ultimate') && this.energie >= ULTIME.cout) this._ultime();
  }

  _cast() {
    const s = this.skill;
    this.cooldown = s.cd;
    this.lock = 'skill';
    this.t = 0;
    const player = this.cs.player;
    player.anim.play('attack_light_3', { force: true, timeScale: 1.2 }); // anim de cast provisoire
    this.cs.juice.skillBurst(player.position, this.element);

    if (s.chaine) {
      // foudre : la cible la plus proche devant, puis saute d'ennemi en ennemi
      let cible = this.cs.nearestEnemyInFront(s.portee);
      const touchees = [];
      for (let i = 0; i < s.chaine && cible; i++) {
        touchees.push(cible);
        this.cs.applyHit(cible, { degats: s.degats, poise: s.poise, element: this.element, energie: 5, tag: 'skill' });
        const from = cible;
        cible = this.cs.enemies.find(e => !e.dead && !touchees.includes(e) &&
          e.position.distanceTo(from.position) < 7);
        if (cible) this.cs.juice.eclairEntre(from, cible);
      }
    } else {
      // cône devant soi via une fenêtre de hit courte
      this.cs.hits.queue({
        debut: 0.08, fin: 0.3,
        portee: s.portee * 0.6, rayon: s.rayon, arc: s.arc,
        onHit: (e) => this.cs.applyHit(e, {
          degats: s.degats, poise: s.poise, kb: s.kb ?? 0,
          element: this.element, energie: 5, tag: 'skill',
        }),
      });
    }
  }

  _ultime() {
    this.energie = 0;
    this.lock = 'ultime';
    this.t = 0;
    const player = this.cs.player;
    player.anim.play('attack_heavy', { force: true, timeScale: 1.3 });
    this.cs.juice.hitStop(ULTIME.hitStopMs);
    this.cs.juice.shake(ULTIME.shake);
    this.cs.juice.nova(player.position, this.element);
    for (const e of this.cs.enemies) {
      if (e.dead) continue;
      const d = e.position.distanceTo(player.position);
      if (d < ULTIME.rayon) {
        this.cs.applyHit(e, {
          degats: ULTIME.degats, poise: ULTIME.poise, kb: 6,
          element: this.element, tag: 'ultime',
        });
      }
    }
  }
}
