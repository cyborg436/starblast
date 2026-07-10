/**
 * Hud — interface DOM par-dessus le canvas WebGL (jamais en 3D).
 * Phase 1 : uniquement un compteur FPS pour valider les performances.
 * Accueillera ensuite barres de vie/mana, hotbar, minimap…
 */
export class Hud {
  constructor() {
    this.fpsEl = document.getElementById('fps');
    this.infoEl = document.getElementById('info');
    this._frames = 0;
    this._acc = 0;
    this._world = null;
  }

  attachWorld(world) {
    this._world = world;
  }

  update(dt, _elapsed) {
    this._frames++;
    this._acc += dt;
    if (this._acc >= 0.5) {
      const fps = Math.round(this._frames / this._acc);
      this.fpsEl.textContent = `${fps} FPS`;
      this.fpsEl.style.color = fps >= 55 ? '#80c880' : fps >= 30 ? '#e8c860' : '#e06050';
      if (this._world && this.infoEl) {
        const h = Math.floor(this._world.timeOfDay * 24);
        const mn = Math.floor((this._world.timeOfDay * 24 % 1) * 60);
        this.infoEl.textContent = `${this._world.debugInfo} · ${String(h).padStart(2, '0')}h${String(mn).padStart(2, '0')}`;
      }
      this._frames = 0;
      this._acc = 0;
    }
  }
}
