/**
 * InputManager — entrées clavier/souris avec COUCHE D'ACTIONS abstraite.
 *
 * Les systèmes de jeu n'interrogent jamais une touche en dur : ils
 * demandent `isActionDown('sprint')` / `wasActionPressed('dodge')`.
 * Les liaisons vivent dans un seul mapping rebindable (`rebind()`),
 * prêt pour un futur écran d'options et le support manette (l'API
 * Gamepad alimentera les mêmes actions).
 *
 * Les boutons souris sont des codes virtuels 'Mouse0' (gauche),
 * 'Mouse1' (molette), 'Mouse2' (droit), traités comme des touches.
 */

export const DEFAULT_BINDINGS = {
  jump:         ['Space'],
  sprint:       ['ShiftLeft', 'ShiftRight'],
  dodge:        ['ControlLeft', 'ControlRight', 'KeyC'],
  attack_light: ['Mouse0'],
  attack_heavy: ['Mouse2'],
  skill:        ['KeyE'],           // compétence élémentaire
  ultimate:     ['KeyR'],           // ultime (jauge d'énergie pleine)
  lockon:       ['Mouse1', 'Tab'],  // verrouillage de cible (clic molette / Tab)
  interact:     ['KeyF'],
};

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    /** Touches/boutons maintenus (par code). */
    this.keys = new Set();
    /** Fronts montants de CETTE frame (vidé par endFrame()). */
    this.pressed = new Set();

    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: new Set(), wheel: 0 };

    /** true quand une UI modale (dialogue/journal) a le focus : gèle le
     *  gameplay (déplacement, actions de combat), pas la nav menu (raw). */
    this.uiActive = false;

    this.bindings = structuredClone(DEFAULT_BINDINGS);

    this._down = (code) => {
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    };
    this._up = (code) => this.keys.delete(code);

    this._handlers = [
      ['keydown', (e) => {
        if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); // pas de défocus / scroll
        this._down(e.code);
      }],
      ['keyup', (e) => this._up(e.code)],
      ['blur', () => { this.keys.clear(); this.mouse.buttons.clear(); }],
    ];
    for (const [ev, fn] of this._handlers) window.addEventListener(ev, fn);

    this._domHandlers = [
      ['mousemove', (e) => {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }],
      ['mousedown', (e) => { this.mouse.buttons.add(e.button); this._down('Mouse' + e.button); }],
      ['mouseup', (e) => { this.mouse.buttons.delete(e.button); this._up('Mouse' + e.button); }],
      ['wheel', (e) => { this.mouse.wheel += e.deltaY; }],
      ['contextmenu', (e) => e.preventDefault()],
    ];
    for (const [ev, fn] of this._domHandlers) domElement.addEventListener(ev, fn);
  }

  /* ---------- couche d'actions ---------- */

  /** L'action est-elle maintenue ? (gelée quand une UI modale est active) */
  isActionDown(action) {
    if (this.uiActive) return false;
    const binds = this.bindings[action];
    if (!binds) return false;
    for (const code of binds) if (this.keys.has(code)) return true;
    return false;
  }

  /** L'action vient-elle d'être déclenchée cette frame (front montant) ? */
  wasActionPressed(action) {
    if (this.uiActive) return false;
    const binds = this.bindings[action];
    if (!binds) return false;
    for (const code of binds) if (this.pressed.has(code)) return true;
    return false;
  }

  /** Re-lie une action à d'autres touches (futur écran d'options). */
  rebind(action, codes) {
    this.bindings[action] = [...codes];
  }

  /* ---------- accès bas niveau (mouvement, caméra) ---------- */

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Axe de déplacement normalisé [-1..1] — ZQSD + WASD + flèches. */
  moveAxes() {
    if (this.uiActive) return { x: 0, z: 0 };
    let x = 0, z = 0;
    if (this.isDown('KeyA') || this.isDown('KeyQ') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('KeyZ') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (x !== 0 && z !== 0) { x *= Math.SQRT1_2; z *= Math.SQRT1_2; }
    return { x, z };
  }

  /** À appeler en fin de frame : purge deltas souris et fronts montants. */
  endFrame() {
    this.pressed.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }

  dispose() {
    for (const [ev, fn] of this._handlers) window.removeEventListener(ev, fn);
    for (const [ev, fn] of this._domHandlers) this.domElement.removeEventListener(ev, fn);
  }
}
