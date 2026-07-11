import * as THREE from 'three';

/**
 * Interaction — choisit le PNJ interactif visé et affiche l'invite "E".
 *
 * Un PNJ est ciblable si TOUS ces critères sont réunis :
 *  1. distance joueur→PNJ < PORTEE (4 m)
 *  2. le joueur le REGARDE à peu près : dot(direction caméra au sol,
 *     direction vers le PNJ) > 0.55 — évite de parler à un PNJ dans le dos
 *  3. LIGNE DE VUE dégagée : un raycast terrain ne doit pas heurter le
 *     relief avant le PNJ (pas de déclenchement à travers une colline)
 * Le meilleur candidat (le plus proche parmi les visés) reçoit l'invite ;
 * la touche d'interaction ouvre son dialogue.
 */
const PORTEE = 4;
const _camDir = new THREE.Vector3();
const _to = new THREE.Vector3();
const _org = new THREE.Vector3();

export class Interaction {
  constructor({ input, camera, player, npcs, physics, dialogue }) {
    this.input = input;
    this.camera = camera;
    this.player = player;
    this.npcs = npcs;
    this.physics = physics;
    this.dialogue = dialogue;
    this.target = null;
    this.promptEl = document.getElementById('interact-prompt');
  }

  update(_dt) {
    if (this.dialogue.active) { this.target = null; this._hidePrompt(); return; }

    this.target = this._pick();
    if (this.target) {
      this._showPrompt(this.target);
      if (this.input.wasActionPressed('interact')) {
        this.dialogue.open(this.target);
        this._hidePrompt();
      }
    } else {
      this._hidePrompt();
    }
  }

  _pick() {
    this.camera.getWorldDirection(_camDir);
    _camDir.y = 0; _camDir.normalize();
    _org.set(this.player.position.x, this.player.position.y + 1.4, this.player.position.z);

    let best = null, bestD = PORTEE;
    for (const npc of this.npcs.all) {
      if (!npc.object3d.visible) continue;
      const d = this.player.position.distanceTo(npc.position);
      if (d > PORTEE) continue;
      // regard
      _to.set(npc.position.x - this.player.position.x, 0, npc.position.z - this.player.position.z).normalize();
      if (_to.dot(_camDir) < 0.55) continue;
      // ligne de vue (terrain)
      if (this.physics) {
        _to.set(npc.position.x - _org.x, (npc.position.y + 1.2) - _org.y, npc.position.z - _org.z);
        const dist = _to.length(); _to.normalize();
        const hit = this.physics.raycastTerrain({ x: _org.x, y: _org.y, z: _org.z }, { x: _to.x, y: _to.y, z: _to.z }, dist);
        if (hit !== null && hit < dist - 0.6) continue; // relief entre les deux
      }
      if (d < bestD) { bestD = d; best = npc; }
    }
    return best;
  }

  _showPrompt(npc) {
    if (!this.promptEl) return;
    _to.copy(npc.position); _to.y += 2.0; _to.project(this.camera);
    if (_to.z > 1) { this._hidePrompt(); return; }
    this.promptEl.style.display = 'flex';
    this.promptEl.style.left = `${(_to.x * 0.5 + 0.5) * 100}%`;
    this.promptEl.style.top = `${(-_to.y * 0.5 + 0.5) * 100}%`;
    this.promptEl.querySelector('.who').textContent = npc.nom;
  }
  _hidePrompt() { if (this.promptEl) this.promptEl.style.display = 'none'; }
}
