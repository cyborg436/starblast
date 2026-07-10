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

  attachPlayer(player) {
    this._player = player;
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
        let txt = `${this._world.debugInfo} · ${String(h).padStart(2, '0')}h${String(mn).padStart(2, '0')}`;
        if (this._player) {
          const p = this._player.position;
          txt += ` · (${Math.round(p.x)}, ${Math.round(p.z)})${this._player.swimming ? ' · 🏊' : ''}`;
        }
        this.infoEl.textContent = txt;
      }
      this._frames = 0;
      this._acc = 0;
    }
  }
}
