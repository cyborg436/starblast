/**
 * InputManager — état clavier/souris interrogeable à chaque frame.
 * (Support manette prévu plus tard via l'API Gamepad : même interface,
 * les systèmes de jeu ne liront que isDown()/wasPressed()/axes.)
 */
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    /** Touches maintenues (par e.code : 'KeyW', 'Space'…). */
    this.keys = new Set();
    /** Touches pressées durant CETTE frame (vidé par endFrame()). */
    this.pressed = new Set();

    this.mouse = {
      x: 0, y: 0,          // position en pixels
      dx: 0, dy: 0,        // delta depuis la dernière frame
      buttons: new Set(),  // 0 = gauche, 1 = molette, 2 = droit
      wheel: 0,
    };

    this._handlers = [
      ['keydown', (e) => {
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
      }],
      ['keyup', (e) => this.keys.delete(e.code)],
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
      ['mousedown', (e) => this.mouse.buttons.add(e.button)],
      ['mouseup', (e) => this.mouse.buttons.delete(e.button)],
      ['wheel', (e) => { this.mouse.wheel += e.deltaY; }],
      ['contextmenu', (e) => e.preventDefault()],
    ];
    for (const [ev, fn] of this._domHandlers) domElement.addEventListener(ev, fn);
  }

  /** Touche maintenue ? */
  isDown(code) {
    return this.keys.has(code);
  }

  /** Touche pressée cette frame (front montant) ? */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Axe de déplacement normalisé [-1..1] — ZQSD + WASD + flèches. */
  moveAxes() {
    let x = 0, z = 0;
    if (this.isDown('KeyA') || this.isDown('KeyQ') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('KeyZ') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (x !== 0 && z !== 0) { x *= Math.SQRT1_2; z *= Math.SQRT1_2; }
    return { x, z };
  }

  /** À appeler en fin de frame : remet à zéro les deltas et les fronts. */
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
