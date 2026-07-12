import { DATA } from '../data/index.js';

/**
 * ItemIcons — icônes d'objets dessinées au canvas (le JSON extrait ne
 * contient pas les sprites pixel de la 2D). Le "genre" d'icône est
 * déduit de l'id/type ; la couleur monte avec le tier pour l'équipement.
 * Cache par (genre|couleur) → dataURL réutilisable en <img> dans l'UI.
 */

const CACHE = new Map();

/** id d'objet → genre d'icône. */
export function iconKind(id) {
  const t = DATA.items.objets.find(o => o.id === id);
  if (id.startsWith('epee')) return 'epee';
  if (id.startsWith('hache')) return 'hache';
  if (id.startsWith('arc')) return 'arc';
  if (id.startsWith('baton')) return 'baton';
  if (id.startsWith('arm')) return 'armure';
  if (id.startsWith('csq')) return 'casque';
  if (id.startsWith('ann')) return 'anneau';
  if (id.startsWith('ppv') || id.startsWith('ppm')) return 'potion';
  if (id === 'pain' || id === 'viande' || id === 'baie' || id === 'champignon') return 'nourriture';
  if (id === 'minerai') return 'minerai';
  if (id === 'gemme') return 'gemme';
  if (['fragment', 'sceauvole', 'lettre', 'clecrypte'].includes(id)) return 'quete';
  if (t?.type === 'mat') return 'materiau';
  return 'objet';
}

/** couleur de base par genre, éclaircie selon le tier (équipement). */
function iconColor(id) {
  const t = DATA.items.objets.find(o => o.id === id);
  const tier = t?.tier || 1;
  const base = {
    epee: [150, 160, 180], hache: [150, 160, 180], arc: [150, 120, 70], baton: [120, 90, 170],
    armure: [130, 140, 160], casque: [130, 140, 160], anneau: [220, 180, 70],
    potion: id.startsWith('ppm') ? [70, 110, 220] : [210, 70, 80],
    nourriture: [200, 140, 70], minerai: [180, 130, 90], gemme: [90, 200, 220],
    quete: [230, 210, 120], materiau: [150, 170, 130], objet: [160, 160, 160],
  }[iconKind(id)];
  const k = 1 + (tier - 1) * 0.12;
  return `rgb(${Math.min(255, base[0] * k | 0)},${Math.min(255, base[1] * k | 0)},${Math.min(255, base[2] * k | 0)})`;
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }

function draw(kind, col) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 48;
  const x = cv.getContext('2d');
  x.lineCap = 'round'; x.lineJoin = 'round';
  const dark = 'rgba(0,0,0,.55)';
  switch (kind) {
    case 'epee':
      x.strokeStyle = dark; x.lineWidth = 8; x.beginPath(); x.moveTo(14, 36); x.lineTo(36, 12); x.stroke();
      x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.moveTo(14, 36); x.lineTo(36, 12); x.stroke();
      x.strokeStyle = '#7a5a2c'; x.lineWidth = 5; x.beginPath(); x.moveTo(10, 34); x.lineTo(18, 42); x.stroke();
      x.beginPath(); x.moveTo(9, 30); x.lineTo(18, 39); x.lineWidth = 4; x.stroke(); break;
    case 'hache':
      x.strokeStyle = '#7a5a2c'; x.lineWidth = 5; x.beginPath(); x.moveTo(16, 40); x.lineTo(30, 12); x.stroke();
      x.fillStyle = col; x.beginPath(); x.moveTo(26, 10); x.quadraticCurveTo(42, 14, 34, 26); x.quadraticCurveTo(30, 20, 24, 18); x.fill(); break;
    case 'arc':
      x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.arc(30, 24, 16, 2.3, 4.0); x.stroke();
      x.strokeStyle = '#d8d0c0'; x.lineWidth = 2; x.beginPath(); x.moveTo(18, 13); x.lineTo(18, 35); x.stroke(); break;
    case 'baton':
      x.strokeStyle = '#6a4a24'; x.lineWidth = 5; x.beginPath(); x.moveTo(16, 40); x.lineTo(30, 12); x.stroke();
      x.fillStyle = col; x.beginPath(); x.arc(32, 10, 7, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.globalAlpha = .7; x.beginPath(); x.arc(30, 8, 2.5, 0, 7); x.fill(); x.globalAlpha = 1; break;
    case 'armure':
      x.fillStyle = col; x.beginPath();
      x.moveTo(24, 8); x.lineTo(38, 14); x.lineTo(36, 34); x.quadraticCurveTo(24, 44, 12, 34); x.lineTo(10, 14); x.closePath(); x.fill();
      x.fillStyle = dark; rr(x, 22, 14, 4, 22, 2); break;
    case 'casque':
      x.fillStyle = col; x.beginPath(); x.arc(24, 26, 14, Math.PI, 0); x.fill(); x.fillRect(10, 26, 28, 8);
      x.fillStyle = dark; x.fillRect(22, 20, 4, 14); break;
    case 'anneau':
      x.strokeStyle = col; x.lineWidth = 6; x.beginPath(); x.arc(24, 28, 11, 0, 7); x.stroke();
      x.fillStyle = '#7ad8ff'; x.beginPath(); x.arc(24, 15, 5, 0, 7); x.fill(); break;
    case 'potion':
      x.fillStyle = '#cfe0ea'; rr(x, 20, 8, 8, 8, 2);
      x.fillStyle = 'rgba(200,220,235,.5)'; x.beginPath(); x.moveTo(18, 16); x.lineTo(30, 16); x.lineTo(34, 40); x.quadraticCurveTo(24, 46, 14, 40); x.closePath(); x.fill();
      x.fillStyle = col; x.beginPath(); x.moveTo(16, 28); x.lineTo(32, 28); x.lineTo(34, 40); x.quadraticCurveTo(24, 46, 14, 40); x.closePath(); x.fill(); break;
    case 'nourriture':
      x.fillStyle = col; x.beginPath(); x.ellipse(24, 28, 14, 10, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(20, 24, 5, 3, -.5, 0, 7); x.fill(); break;
    case 'minerai':
      x.fillStyle = '#6a625a'; x.beginPath(); x.moveTo(12, 34); x.lineTo(20, 16); x.lineTo(34, 20); x.lineTo(36, 36); x.closePath(); x.fill();
      x.fillStyle = col; for (const [px, py] of [[18, 28], [28, 24], [30, 32]]) { x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); } break;
    case 'gemme':
      x.fillStyle = col; x.beginPath(); x.moveTo(24, 8); x.lineTo(38, 22); x.lineTo(24, 42); x.lineTo(10, 22); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(24, 8); x.lineTo(31, 22); x.lineTo(24, 26); x.closePath(); x.fill(); break;
    case 'quete':
      x.fillStyle = col; rr(x, 12, 10, 24, 28, 3);
      x.fillStyle = dark; x.font = 'bold 18px Georgia'; x.textAlign = 'center'; x.fillText('✦', 24, 30); break;
    default: // materiau / objet
      x.fillStyle = col; x.beginPath(); x.arc(24, 26, 13, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.arc(19, 21, 4, 0, 7); x.fill();
  }
  return cv.toDataURL();
}

/** URL data d'icône pour un objet (mémoïsée). */
export function iconFor(id) {
  const kind = iconKind(id), col = iconColor(id);
  const key = kind + '|' + col;
  if (!CACHE.has(key)) CACHE.set(key, draw(kind, col));
  return CACHE.get(key);
}
