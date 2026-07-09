/**
 * LoadingScreen — barre de progression HTML affichée pendant le préchargement.
 * Alimentée par le LoadingManager de l'AssetManager.
 */
export class LoadingScreen {
  constructor() {
    this.root = document.getElementById('loading');
    this.bar = document.getElementById('loading-bar');
    this.status = document.getElementById('loading-status');
  }

  setProgress(ratio, label = '') {
    this.bar.style.width = `${Math.round(ratio * 100)}%`;
    if (label) this.status.textContent = label;
  }

  hide() {
    this.setProgress(1, 'Prêt.');
    this.root.classList.add('done');
    // retiré du DOM après la transition CSS
    setTimeout(() => this.root.remove(), 600);
  }
}
