/**
 * ComboSystem — combo d'attaques légères ×3 + attaque lourde chargée.
 *
 * COMBO LÉGER
 *  - la "fenêtre de combo" ouvre sur les DERNIERS 40 % de l'animation ;
 *    un clic pendant la fenêtre enchaîne le coup suivant à la fin du coup
 *  - INPUT BUFFERING : un clic jusqu'à 0,15 s AVANT l'ouverture de la
 *    fenêtre compte quand même (on ne punit pas un clic 50 ms trop tôt)
 *  - un clic après la fin du coup enchaîne encore pendant GRACE_APRES ;
 *    au-delà → reset au coup 1
 *  - coup 3 : plus de dégâts + knockback
 *
 * LOURDE CHARGÉE
 *  - clic droit MAINTENU = charge (barre visible au HUD), relâché =
 *    frappe ; dégâts/poise scalés sur le temps de charge (cap 1,5 s)
 *  - coûte de la stamina au relâché ; stagger renforcé
 *  - PAS annulable par l'esquive (risque/récompense)
 *
 * Toutes les valeurs sont regroupées dans COUPS / LOURDE ci-dessous.
 */

const COUPS = {
  // duree = durée de l'anim ; hit = fenêtre de hitbox [début, fin] ;
  // degats / poise = infligés ; kb = impulsion de recul sur l'ennemi (m/s)
  attack_light_1: { duree: 0.42, hit: [0.10, 0.26], degats: 20, poise: 14, kb: 1.5, arc: 1.1 },
  attack_light_2: { duree: 0.42, hit: [0.10, 0.26], degats: 22, poise: 14, kb: 1.5, arc: 1.1 },
  attack_light_3: { duree: 0.60, hit: [0.22, 0.42], degats: 34, poise: 26, kb: 5.0, arc: 0.7 },
};
const FENETRE_PART = 0.60;   // la fenêtre de combo ouvre à 60 % du coup (40 % restants)
const BUFFER_AVANCE = 0.15;  // clic accepté jusqu'à 0,15 s avant la fenêtre
const GRACE_APRES = 0.45;    // délai après un coup pour continuer le combo
const PORTEE = 2.1;          // distance de la sphère de lame devant le joueur
const RAYON = 1.25;          // rayon de la sphère de lame

const LOURDE = {
  chargeMax: 1.5,            // cap de charge (s)
  duree: 0.85,               // durée de l'anim de frappe
  hit: [0.16, 0.38],
  degatsMin: 30, degatsMax: 80,
  poiseMin: 30, poiseMax: 90, // stagger renforcé à pleine charge
  kb: 4.0,
  stamina: 25,
  vitesseCharge: 1.4,        // m/s de déplacement autorisé pendant la charge
};

export class ComboSystem {
  constructor(cs) {
    this.cs = cs;
    this.lock = null;        // 'attack_light_N' | 'heavy_charge' | 'attack_heavy' | null
    this.combo = 0;          // dernier coup lancé (0 = aucun)
    this.t = 0;              // temps dans le coup courant
    this._buffer = false;    // clic léger mémorisé
    this._grace = 0;         // fenêtre post-coup
    this.chargeT = 0;        // temps de charge de la lourde
  }

  get chargeRatio() {
    return this.lock === 'heavy_charge' ? Math.min(this.chargeT / LOURDE.chargeMax, 1) : 0;
  }

  /** L'esquive peut-elle annuler l'état courant ? (lourde : non) */
  get cancelableParEsquive() {
    return this.lock !== 'heavy_charge' && this.lock !== 'attack_heavy';
  }

  /** Annulation (dodge cancel) : coupe le coup et ses hitbox. */
  cancel() {
    this.lock = null;
    this._buffer = false;
    this.cs.hits.clear();
  }

  update(dt) {
    const input = this.cs.input;
    const player = this.cs.player;
    this._grace = Math.max(0, this._grace - dt);
    if (this._grace <= 0 && !this.lock) this.combo = 0;

    /* ---------- lourde : charge maintenue ---------- */
    if (this.lock === 'heavy_charge') {
      this.chargeT = Math.min(this.chargeT + dt, LOURDE.chargeMax);
      if (!input.isActionDown('attack_heavy')) this._releaseHeavy();
      return;
    }

    /* ---------- coup en cours ---------- */
    if (this.lock) {
      const def = this.lock === 'attack_heavy' ? LOURDE : COUPS[this.lock];
      this.t += dt;
      const fenetreOuvre = this.lock.startsWith('attack_light') ? def.duree * FENETRE_PART : Infinity;
      // buffering : clic pendant la fenêtre, ou ≤ 0,15 s avant son ouverture
      if (input.wasActionPressed('attack_light')) {
        if (this.t >= fenetreOuvre - BUFFER_AVANCE) this._buffer = true;
      }
      if (this.t >= def.duree) {
        this.lock = null;
        this._grace = GRACE_APRES;
        if (this._buffer) { this._buffer = false; this._lancerLeger(); }
      }
      return;
    }

    /* ---------- au repos : départs ---------- */
    if (!player.grounded || player.swimming || this.cs.lock) return;
    if (input.wasActionPressed('attack_light')) {
      this._lancerLeger();
    } else if (input.wasActionPressed('attack_heavy')) {
      this.lock = 'heavy_charge';
      this.chargeT = 0;
      player.anim.play('charge', { force: true });
    }
  }

  _lancerLeger() {
    this.combo = this._grace > 0 || this.lock ? (this.combo % 3) + 1 : 1;
    if (this.combo === 0) this.combo = 1;
    const etat = `attack_light_${this.combo}`;
    const def = COUPS[etat];
    this.lock = etat;
    this.t = 0;
    this.cs.player.anim.play(etat, { force: true });
    this.cs.juice.swing();
    this.cs.hits.queue({
      debut: def.hit[0], fin: def.hit[1],
      portee: PORTEE, rayon: RAYON, arc: def.arc,
      onHit: (e) => this.cs.applyHit(e, {
        degats: def.degats, poise: def.poise, kb: def.kb,
        energie: 6, tag: etat,
      }),
    });
  }

  _releaseHeavy() {
    const ratio = Math.min(this.chargeT / LOURDE.chargeMax, 1);
    if (!this.cs.stamina.spend(LOURDE.stamina)) {
      // pas de stamina : le coup part quand même mais à charge nulle ? Non —
      // choix : la charge s'annule (feedback essoufflement), pas de coup gratuit.
      this.lock = null;
      this.cs.player.anim.play('tired', { force: true });
      return;
    }
    this.lock = 'attack_heavy';
    this.t = 0;
    this.cs.player.anim.play('attack_heavy', { force: true });
    this.cs.hits.queue({
      debut: LOURDE.hit[0], fin: LOURDE.hit[1],
      portee: PORTEE + 0.3, rayon: RAYON + 0.35, arc: 0.9,
      onHit: (e) => this.cs.applyHit(e, {
        degats: Math.round(LOURDE.degatsMin + (LOURDE.degatsMax - LOURDE.degatsMin) * ratio),
        poise: Math.round(LOURDE.poiseMin + (LOURDE.poiseMax - LOURDE.poiseMin) * ratio),
        kb: LOURDE.kb, energie: 10, lourd: true, tag: 'attack_heavy',
      }),
    });
  }

  /** Contrainte de déplacement pendant les états du combo. */
  get moveOverride() {
    if (this.lock === 'heavy_charge') return { vitesse: LOURDE.vitesseCharge, libre: true };
    if (this.lock) return { vitesse: 1.6, avant: true }; // léger pas en avant pendant le coup
    return null;
  }
}
