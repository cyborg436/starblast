'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   battlepass.js  —  Battle Pass saisonnier (50 paliers, 2 voies)
───────────────────────────────────────────────────────────────────────── */

const BP_XP_PER_TIER   = 1000;
const BP_MAX_TIER      = 50;
const BP_SEASON_DAYS   = 60;
const BP_PRICE_LABEL   = '4,99 €';
const BP_PREMIUM_BONUS = 1.2;  // +20% XP

// Lien Stripe — remplace par ton Payment Link réel.
// Le succès doit rediriger vers starblast.vercel.app?battlepass=unlocked
const BP_STRIPE_URL = 'https://buy.stripe.com/test_BATTLEPASS_4_99';

// ── Définition des 50 paliers (FREE & PREMIUM) ────────────────────────
// type : 'coins' | 'skin' | 'color' | 'cosmetic'
const BP_REWARDS = {
  free: {
    1:  { type:'coins',    amount:200 },
    3:  { type:'color',    id:'neon_pink',  label:'Néon Rose' },
    5:  { type:'coins',    amount:500 },
    8:  { type:'skin',     id:'interceptor',label:'Interceptor' },
    10: { type:'coins',    amount:800 },
    13: { type:'color',    id:'turquoise',  label:'Turquoise' },
    15: { type:'coins',    amount:1000 },
    18: { type:'skin',     id:'raptor',     label:'Raptor' },
    20: { type:'coins',    amount:1500 },
    23: { type:'color',    id:'magma',      label:'Magma' },
    25: { type:'coins',    amount:2000 },
    28: { type:'skin',     id:'eclipse',    label:'Eclipse' },
    30: { type:'coins',    amount:2500 },
    33: { type:'color',    id:'lightning',  label:'Foudre' },
    35: { type:'coins',    amount:3000 },
    38: { type:'skin',     id:'polaris',    label:'Polaris' },
    40: { type:'coins',    amount:4000 },
    45: { type:'coins',    amount:5000 },
    50: { type:'skin',     id:'sentinel',   label:'Sentinel' },
  },
  premium: {
    1:  { type:'color',    id:'crystal',    label:'Cristal' },
    2:  { type:'coins',    amount:300 },
    3:  { type:'skin',     id:'wraith',     label:'Wraith' },
    4:  { type:'coins',    amount:400 },
    5:  { type:'color',    id:'darksun',    label:'Soleil Noir' },
    6:  { type:'coins',    amount:500 },
    7:  { type:'skin',     id:'ironclad',   label:'Ironclad' },
    8:  { type:'coins',    amount:600 },
    9:  { type:'color',    id:'redplasma',  label:'Plasma Rouge' },
    10: { type:'skin',     id:'mirage',     label:'Mirage' },
    11: { type:'coins',    amount:700 },
    12: { type:'color',    id:'abyssal',    label:'Abyssal' },
    13: { type:'skin',     id:'comet',      label:'Comet' },
    14: { type:'coins',    amount:800 },
    15: { type:'color',    id:'meteor',     label:'Étoile filante' },
    16: { type:'coins',    amount:1000 },
    17: { type:'skin',     id:'hydra',      label:'Hydra' },
    18: { type:'coins',    amount:1200 },
    19: { type:'color',    id:'cosmos',     label:'Cosmos' },
    20: { type:'skin',     id:'seraph',     label:'Seraph' },
    21: { type:'coins',    amount:800 },
    22: { type:'color',    id:'starfall',   label:'Étoile Bleue' },
    23: { type:'coins',    amount:1000 },
    24: { type:'color',    id:'firestorm',  label:'Tempête de Feu' },
    25: { type:'coins',    amount:1200 },
    26: { type:'coins',    amount:1300 },
    27: { type:'color',    id:'vortex',     label:'Vortex Pourpre' },
    28: { type:'coins',    amount:1400 },
    29: { type:'coins',    amount:1500 },
    30: { type:'skin',     id:'dreadnought',label:'Dreadnought' },
    31: { type:'coins',    amount:900 },
    32: { type:'coins',    amount:1000 },
    33: { type:'coins',    amount:1100 },
    34: { type:'coins',    amount:1200 },
    35: { type:'coins',    amount:1300 },
    36: { type:'coins',    amount:1400 },
    37: { type:'coins',    amount:1500 },
    38: { type:'coins',    amount:1600 },
    39: { type:'coins',    amount:1700 },
    40: { type:'skin',     id:'sovereign',  label:'Sovereign' },
    41: { type:'coins',    amount:1800 },
    42: { type:'coins',    amount:1900 },
    43: { type:'coins',    amount:2000 },
    44: { type:'coins',    amount:2200 },
    45: { type:'color',    id:'apocalypse', label:'Apocalypse' },
    46: { type:'coins',    amount:2500 },
    47: { type:'coins',    amount:2800 },
    48: { type:'coins',    amount:3000 },
    49: { type:'coins',    amount:10000 },
    50: { type:'skin',     id:'genesis',    label:'GENESIS' },
  },
};

// ── Renderers d'aperçu par type de récompense ────────────────────────
function _bpDrawCoinIcon(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r * .35, y - r * .35, 0, x, y, r);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(.7, '#ffd700'); g.addColorStop(1, '#a37800');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#8a6000'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#8a6000';
  ctx.font = `bold ${(r * 1.1) | 0}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', x, y + 1);
}

function _bpDrawColorPreview(ctx, x, y, color) {
  let col = color;
  if (color === 'rainbow') {
    const hue = (Date.now() / 8) % 360;
    col = `hsl(${hue},100%,65%)`;
  }
  ctx.shadowColor = col; ctx.shadowBlur = 10;
  ctx.fillStyle   = col;
  ctx.fillRect(x - 4, y - 16, 8, 32);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(x - 1, y - 16, 2, 32);
}

// ── BattlePass : état ────────────────────────────────────────────────
class BattlePass {
  constructor(shop) {
    this.shop = shop;
    const raw = JSON.parse(localStorage.getItem('starblast_battlepass') || 'null');
    const now = Date.now();
    if (raw) {
      this.xp           = Math.max(0, raw.xp || 0);
      this.claimedFree  = new Set(raw.claimedFree    || []);
      this.claimedPrem  = new Set(raw.claimedPremium || []);
      this.seasonStart  = raw.seasonStart || now;
    } else {
      this.xp           = 0;
      this.claimedFree  = new Set();
      this.claimedPrem  = new Set();
      this.seasonStart  = now;
    }
    this.premium = localStorage.getItem('starblast_bp_premium') === '1';
    this._save();
  }

  // ── Calculs de progression ───────────────────────────────
  get tier()      { return Math.min(BP_MAX_TIER, Math.floor(this.xp / BP_XP_PER_TIER) + 1); }
  get tierXP()    { return this.xp % BP_XP_PER_TIER; }
  get tierRatio() { return this.tier > BP_MAX_TIER ? 1 : this.tierXP / BP_XP_PER_TIER; }

  // ── XP & multiplicateur premium ──────────────────────────
  addXP(amount) {
    const gain = Math.floor((amount || 0) * (this.premium ? BP_PREMIUM_BONUS : 1));
    if (gain <= 0) return 0;
    this.xp = Math.min(this.xp + gain, BP_MAX_TIER * BP_XP_PER_TIER);
    this._save();
    return gain;
  }

  // ── Saison ──────────────────────────────────────────────
  daysRemaining() {
    const elapsed = (Date.now() - this.seasonStart) / 86400000;
    return Math.max(0, Math.ceil(BP_SEASON_DAYS - elapsed));
  }

  seasonOver() { return this.daysRemaining() <= 0; }

  // ── Statut d'un palier ──────────────────────────────────
  // Retourne 'unlocked' | 'available' | 'claimed' | 'locked-premium'
  status(tier, track) {
    const reached = this.tier > tier || (this.tier === tier && false);
    const isReached = tier <= this.tier - 1 || (tier === this.tier && this.tierRatio >= 1);
    if (track === 'premium' && !this.premium) return 'locked-premium';
    const claimed = track === 'free' ? this.claimedFree.has(tier) : this.claimedPrem.has(tier);
    if (claimed) return 'claimed';
    if (isReached) return 'available';
    return 'locked';
  }

  // ── Récupère la définition de récompense ──────────────────
  reward(tier, track) {
    return BP_REWARDS[track]?.[tier] || null;
  }

  // ── Réclamer un palier ───────────────────────────────────
  // Retourne { ok, reward } ou { ok:false, reason }
  claim(tier, track, onCoins) {
    if (this.status(tier, track) !== 'available') return { ok: false, reason: 'unavailable' };
    const reward = this.reward(tier, track);
    if (!reward) return { ok: false, reason: 'no-reward' };

    if (reward.type === 'coins') {
      onCoins(reward.amount);
    } else if (reward.type === 'skin' || reward.type === 'color') {
      this.shop.owned.add(reward.id);
      this.shop._persistOwned();
    }

    if (track === 'free') this.claimedFree.add(tier);
    else                  this.claimedPrem.add(tier);
    this._save();
    return { ok: true, reward };
  }

  // ── Active le premium (Stripe success) ───────────────────
  activatePremium() {
    this.premium = true;
    localStorage.setItem('starblast_bp_premium', '1');
    this._save();
  }

  // ── Persistance ──────────────────────────────────────────
  _save() {
    localStorage.setItem('starblast_battlepass', JSON.stringify({
      xp:              this.xp,
      claimedFree:     [...this.claimedFree],
      claimedPremium:  [...this.claimedPrem],
      seasonStart:     this.seasonStart,
    }));
  }
}

// ── BattlePassUI : rendu de la grille de paliers ─────────────────────
class BattlePassUI {
  constructor(bp, getCoins, addCoins, refreshHUD) {
    this.bp           = bp;
    this.getCoins     = getCoins;
    this.addCoins     = addCoins;
    this.refreshHUD   = refreshHUD;
    this._animId      = null;
    this._previewIds  = [];
  }

  // ── Stripe : déclenche le checkout ───────────────────────
  launchStripeCheckout() {
    window.location.href = BP_STRIPE_URL;
  }

  // ── Rendu complet de l'écran ─────────────────────────────
  render() {
    this._stopAnims();
    this._updateHeader();
    this._renderGrid();
    this._startAnims();
  }

  _updateHeader() {
    const bp = this.bp;
    const tierEl  = document.getElementById('bp-tier');
    const xpEl    = document.getElementById('bp-xp-text');
    const fillEl  = document.getElementById('bp-xp-fill');
    const daysEl  = document.getElementById('bp-days');
    const premEl  = document.getElementById('bp-premium-banner');
    const badgeEl = document.getElementById('bp-premium-badge');

    if (tierEl)  tierEl.textContent  = bp.tier > BP_MAX_TIER ? `MAX` : `Palier ${bp.tier} / ${BP_MAX_TIER}`;
    if (xpEl)    xpEl.textContent    = `${bp.tierXP} / ${BP_XP_PER_TIER} XP`;
    if (fillEl)  fillEl.style.width  = `${Math.round(bp.tierRatio * 100)}%`;
    if (daysEl)  daysEl.textContent  = bp.seasonOver()
      ? 'Saison terminée'
      : `Fin de saison dans ${bp.daysRemaining()} jour${bp.daysRemaining() > 1 ? 's' : ''}`;
    if (premEl)  premEl.classList.toggle('owned', bp.premium);
    if (badgeEl) badgeEl.classList.toggle('hidden', !bp.premium);
  }

  // ── Construction de la grille horizontale ────────────────
  _renderGrid() {
    const grid = document.getElementById('bp-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this._previewIds = [];

    for (let t = 1; t <= BP_MAX_TIER; t++) {
      const col = document.createElement('div');
      col.className = 'bp-col';
      if (t === this.bp.tier) col.classList.add('bp-col-current');

      col.appendChild(this._renderCell(t, 'premium'));

      const numWrap = document.createElement('div');
      numWrap.className = 'bp-col-num';
      numWrap.textContent = t;
      col.appendChild(numWrap);

      col.appendChild(this._renderCell(t, 'free'));
      grid.appendChild(col);
    }

    // Auto-scroll vers le palier courant
    const curEl = grid.querySelector('.bp-col-current');
    if (curEl) {
      const rect = curEl.getBoundingClientRect();
      const gRect = grid.getBoundingClientRect();
      grid.scrollLeft = Math.max(0, curEl.offsetLeft - gRect.width / 2 + rect.width / 2);
    }
  }

  // ── Cellule d'un palier (free ou premium) ────────────────
  _renderCell(tier, track) {
    const cell = document.createElement('div');
    cell.className = `bp-cell bp-cell-${track}`;
    const status = this.bp.status(tier, track);
    const reward = this.bp.reward(tier, track);
    cell.classList.add(`bp-${status}`);

    // Aperçu de la récompense
    const cv = document.createElement('canvas');
    cv.className = 'bp-cell-preview';
    cv.width = 64; cv.height = 56;
    this._drawPreview(cv, reward, status);
    if (reward && (reward.type === 'skin' || reward.type === 'color')) {
      cv.dataset.bpId = reward.id;
      cv.dataset.bpKind = reward.type;
      this._previewIds.push(reward.id);
    }
    cell.appendChild(cv);

    // Libellé
    const lbl = document.createElement('div');
    lbl.className = 'bp-cell-label';
    if (!reward) {
      lbl.textContent = '—';
    } else if (reward.type === 'coins') {
      lbl.textContent = `${reward.amount}`;
    } else {
      lbl.textContent = reward.label;
    }
    cell.appendChild(lbl);

    // Statut visuel
    if (status === 'available') {
      const btn = document.createElement('button');
      btn.className = 'bp-claim-btn bp-claim-blink';
      btn.textContent = 'RÉCUPÉRER';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const res = this.bp.claim(tier, track, n => this.addCoins(n));
        if (res.ok) {
          this.refreshHUD();
          this.render();
        }
      });
      cell.appendChild(btn);
    } else if (status === 'claimed') {
      const ck = document.createElement('div');
      ck.className = 'bp-claimed-tag';
      ck.textContent = '✓ RÉCUPÉRÉ';
      cell.appendChild(ck);
    } else if (status === 'locked-premium') {
      const lock = document.createElement('div');
      lock.className = 'bp-lock-tag';
      lock.textContent = '🔒 PREMIUM';
      cell.appendChild(lock);
    } else {
      const lock = document.createElement('div');
      lock.className = 'bp-lock-tag';
      lock.textContent = '🔒';
      cell.appendChild(lock);
    }

    return cell;
  }

  // ── Dessine l'aperçu d'une récompense sur son canvas ─────
  _drawPreview(cv, reward, status) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (status === 'locked' || status === 'locked-premium') ctx.globalAlpha = 0.45;
    if (!reward) { ctx.globalAlpha = 1; return; }

    if (reward.type === 'coins') {
      _bpDrawCoinIcon(ctx, W / 2, H / 2, 18);
      // Le montant est affiché dans le label
    } else if (reward.type === 'color') {
      const data = (typeof COLOR_DATA !== 'undefined') ? COLOR_DATA.find(c => c.id === reward.id) : null;
      _bpDrawColorPreview(ctx, W / 2, H / 2, data?.color || '#ffffff');
    } else if (reward.type === 'skin') {
      const r = (typeof SKIN_RENDERERS !== 'undefined') ? SKIN_RENDERERS[reward.id] : null;
      if (r) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        r(ctx, 44, 50);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Animation des skins légendaires + couleurs animées ───
  _startAnims() {
    const step = () => {
      const canvases = document.querySelectorAll('.bp-cell-preview[data-bp-id]');
      if (!canvases.length) return;
      canvases.forEach(cv => {
        const id   = cv.dataset.bpId;
        const kind = cv.dataset.bpKind;
        if (!id) return;
        // Skin animé (genesis, sovereign, mirage, eclipse, polaris, comet, etc.) — toujours redraw
        if (kind === 'skin') {
          const r = (typeof SKIN_RENDERERS !== 'undefined') ? SKIN_RENDERERS[id] : null;
          if (!r) return;
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          const W = cv.width, H = cv.height;
          // Conserver l'opacité du status
          const dimmed = cv.parentElement?.classList.contains('bp-locked') ||
                         cv.parentElement?.classList.contains('bp-locked-premium');
          ctx.clearRect(0, 0, W, H);
          if (dimmed) ctx.globalAlpha = 0.45;
          ctx.save(); ctx.translate(W / 2, H / 2);
          r(ctx, 44, 50);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else if (kind === 'color' && id === 'cosmos') {
          const data = (typeof COLOR_DATA !== 'undefined') ? COLOR_DATA.find(c => c.id === id) : null;
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, cv.width, cv.height);
          _bpDrawColorPreview(ctx, cv.width / 2, cv.height / 2, data?.color || '#ffffff');
        }
      });
      this._animId = requestAnimationFrame(step);
    };
    this._animId = requestAnimationFrame(step);
  }

  _stopAnims() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }
}
