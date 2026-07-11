import * as THREE from 'three';

/**
 * QuestJournal — UI DOM des quêtes :
 *  - journal (touche J) : liste actives/terminées avec progression
 *  - tracker HUD : la quête pistée + son objectif courant, en permanence
 *  - marqueur d'objectif 3D projeté à l'écran (flèche vers le lieu actif ;
 *    la vraie carte/minimap arrive en Phase 8)
 *  - notifications (toasts) de progression
 */
const _v = new THREE.Vector3();

export class QuestJournal {
  constructor(quests, camera) {
    this.quests = quests;
    this.camera = camera;
    this.panel = document.getElementById('journal');
    this.listEl = document.getElementById('journal-list');
    this.trackEl = document.getElementById('quest-track');
    this.markerEl = document.getElementById('obj-marker');
    this.toastRoot = document.getElementById('toasts');
    this.open = false;

    quests.onChange = () => { this._renderTrack(); if (this.open) this._renderJournal(); };
    quests.onEvent = (type, txt) => this.toast(txt, type);
    this._renderTrack();
  }

  toggle() {
    this.open = !this.open;
    this.panel.classList.toggle('on', this.open);
    if (this.open) this._renderJournal();
  }

  toast(txt, type = '') {
    if (!this.toastRoot) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'quete' ? ' quete' : '');
    el.textContent = txt;
    this.toastRoot.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 3400);
    while (this.toastRoot.children.length > 5) this.toastRoot.firstChild.remove();
  }

  _renderJournal() {
    const j = this.quests.journal();
    if (j.length === 0) { this.listEl.innerHTML = '<p class="vide">Aucune quête pour l\'instant.</p>'; return; }
    this.listEl.innerHTML = j.map(q => {
      const fini = q.state === 'completed';
      const objs = q.objectifs.map(o =>
        `<li class="${o.done ? 'ok' : ''}">${o.done ? '✔' : '•'} ${o.desc}${o.n > 1 ? ` — ${o.cur}/${o.n}` : ''}</li>`,
      ).join('');
      const tag = fini ? '<span class="tag fini">Terminée</span>'
        : q.state === 'readyToTurnIn' ? '<span class="tag rendu">À rendre</span>'
          : q.def.type === 'principale' ? '<span class="tag princ">Principale</span>' : '<span class="tag annexe">Annexe</span>';
      return `<div class="q ${fini ? 'fini' : ''}">
        <div class="q-tit">${q.def.titre} ${tag}</div>
        <div class="q-res">${q.def.resume || ''}</div>
        <ul class="q-obj">${objs}</ul>
      </div>`;
    }).join('');
  }

  _renderTrack() {
    const t = this.quests.trackedObjective();
    if (!t) { this.trackEl.classList.remove('on'); this._tracked = null; return; }
    this._tracked = t;
    this.trackEl.classList.add('on');
    this.trackEl.innerHTML = `<div class="t-tit">${t.titre}</div><div class="t-obj">▸ ${t.desc}</div>`;
  }

  /** Marqueur 3D de l'objectif pisté (chaque frame). */
  update(_dt) {
    const t = this._tracked;
    if (!t || !t.pos || !this.markerEl) { if (this.markerEl) this.markerEl.style.display = 'none'; return; }
    _v.set(t.pos.x, 3, t.pos.z).project(this.camera);
    const devant = _v.z < 1;
    // clamp au bord de l'écran si hors champ, sinon au-dessus du lieu
    let x = _v.x, y = _v.y;
    if (!devant) { x = -x; y = -1; }
    x = Math.max(-0.92, Math.min(0.92, x));
    y = Math.max(-0.9, Math.min(0.9, y));
    this.markerEl.style.display = 'block';
    this.markerEl.style.left = `${(x * 0.5 + 0.5) * 100}%`;
    this.markerEl.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
    const dist = Math.round(Math.hypot(t.pos.x - this.camera.position.x, t.pos.z - this.camera.position.z));
    this.markerEl.querySelector('.d').textContent = `${dist} m`;
  }
}
