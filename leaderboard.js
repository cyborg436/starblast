'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   leaderboard.js  —  Classement mondial via Supabase
   Auth + lecture publique de la table "leaderboard", insertion sécurisée
   via Edge Function "submit-score" pour anti-triche basique.
───────────────────────────────────────────────────────────────────────── */

// ── CONFIGURATION : à remplir avec vos identifiants Supabase ─────────
// (voir README — section "Leaderboard Supabase" pour la création du projet)
const SUPABASE_CONFIG = {
  url:     'https://YOUR-PROJECT.supabase.co',   // ← remplacer
  anonKey: 'YOUR_SUPABASE_ANON_KEY',              // ← remplacer
  edgeFn:  'submit-score',                        // nom de la Edge Function
};

// Heuristique anti-triche côté client (l'autorité reste l'Edge Function)
const MAX_SCORE_PER_SECOND = 1500;

// ── LeaderboardManager ──────────────────────────────────────────────
class LeaderboardManager {
  constructor() {
    this.client = null;
    this.ready  = false;
    this.user   = null;
    this._cache = { survie: { rows: [], at: 0 }, histoire: { rows: [], at: 0 } };
    this._init();
  }

  async _init() {
    // Si le SDK Supabase n'est pas chargé, ou que la config est encore vide,
    // on désactive proprement le système — pas d'erreurs runtime.
    if (typeof window === 'undefined' || !window.supabase) {
      console.info('[Leaderboard] SDK Supabase non chargé — leaderboard désactivé.');
      return;
    }
    if (!SUPABASE_CONFIG.url.startsWith('https://') ||
        SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY' ||
        !SUPABASE_CONFIG.anonKey) {
      console.info('[Leaderboard] SUPABASE_CONFIG incomplet — leaderboard désactivé. Voir README.');
      return;
    }
    try {
      this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      this.ready  = true;
      const { data } = await this.client.auth.getUser();
      this.user = data?.user || null;
    } catch (e) {
      console.warn('[Leaderboard] init failed:', e?.message);
    }
  }

  /** Récupère le top 100 pour un mode donné. Cache 30 s. */
  async fetchTop100(mode) {
    if (!this.ready) return [];
    const c = this._cache[mode];
    if (c && c.rows.length > 0 && Date.now() - c.at < 30_000) return c.rows;
    const { data, error } = await this.client
      .from('leaderboard')
      .select('id, player_id, pseudo, score, wave_reached, mode, skin_used, created_at')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(100);
    if (error) { console.warn('[Leaderboard] fetch error:', error.message); return []; }
    this._cache[mode] = { rows: data || [], at: Date.now() };
    return this._cache[mode].rows;
  }

  /** Invalide les caches (utile après un submit). */
  invalidate() {
    this._cache.survie.at   = 0;
    this._cache.histoire.at = 0;
  }

  /** Vrai si `score` se qualifie pour le top 100 (ou s'il en reste de la place). */
  async isTop100(mode, score) {
    const top = await this.fetchTop100(mode);
    if (top.length < 100) return true;
    return score > top[top.length - 1].score;
  }

  /** Email de l'utilisateur connecté (avant @) ou null. */
  defaultPseudo() {
    const email = this.user?.email;
    if (!email) return '';
    const at = email.indexOf('@');
    return at > 0 ? email.slice(0, at).slice(0, 20) : email.slice(0, 20);
  }

  /** Soumet un score via Edge Function. Retourne { ok, error?, data? }. */
  async submit({ pseudo, score, wave, mode, skinUsed, playtime }) {
    if (!this.ready) return { ok: false, error: 'service-unavailable' };

    pseudo = String(pseudo || '').slice(0, 20).trim() || 'Anonyme';
    score   = Math.max(0, Math.floor(score || 0));
    wave    = Math.max(0, Math.floor(wave || 0));
    playtime = Math.max(0, Math.floor(playtime || 0));

    // Pré-validation côté client (le serveur revalide)
    if (score > playtime * MAX_SCORE_PER_SECOND && score > 1000) {
      return { ok: false, error: 'score-suspect' };
    }
    if (!['survie', 'histoire'].includes(mode)) {
      return { ok: false, error: 'mode-invalide' };
    }

    const url = `${SUPABASE_CONFIG.url}/functions/v1/${SUPABASE_CONFIG.edgeFn}`;
    const headers = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
      'apikey':        SUPABASE_CONFIG.anonKey,
    };
    // Token utilisateur si connecté → l'Edge Function lit player_id
    try {
      const { data: session } = await this.client.auth.getSession();
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      }
    } catch(e) {}

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ pseudo, score, wave_reached: wave, mode, skin_used: skinUsed || 'starter', playtime }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `http-${res.status}` };
      this.invalidate();
      return { ok: true, data: json };
    } catch (e) {
      return { ok: false, error: e?.message || 'network-error' };
    }
  }
}

// ── LeaderboardUI ────────────────────────────────────────────────────
class LeaderboardUI {
  constructor(manager) {
    this.manager  = manager;
    this.mode     = 'survie';
    this.page     = 0;
    this.perPage  = 25;
    this._rows    = [];
    this._timer   = null;
  }

  async open() {
    this.mode = 'survie';
    this.page = 0;
    this._bindTabs();
    await this.refresh();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refresh(), 60_000);  // auto-refresh 60 s
  }

  close() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _bindTabs() {
    document.querySelectorAll('.lb-tab').forEach(btn => {
      btn.onclick = () => {
        this.mode = btn.dataset.mode;
        this.page = 0;
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.toggle('active', b === btn));
        this.refresh();
      };
    });
  }

  async refresh() {
    const $loading = document.getElementById('lb-loading');
    const $empty   = document.getElementById('lb-empty');
    const $body    = document.getElementById('lb-body');
    if ($loading) $loading.classList.remove('hidden');
    if ($empty)   $empty.classList.add('hidden');

    if (!this.manager.ready) {
      this._rows = [];
      if ($loading) $loading.classList.add('hidden');
      if ($empty)   { $empty.classList.remove('hidden'); $empty.textContent = 'Leaderboard hors-ligne — configuration Supabase manquante.'; }
      if ($body)    $body.innerHTML = '';
      return;
    }

    this._rows = await this.manager.fetchTop100(this.mode);
    this._render();
    if ($loading) $loading.classList.add('hidden');
    if (this._rows.length === 0 && $empty) {
      $empty.classList.remove('hidden');
      $empty.textContent = 'Aucun score pour le moment. Sois le premier !';
    }
  }

  _render() {
    const $body = document.getElementById('lb-body');
    const $page = document.getElementById('lb-page-info');
    if (!$body) return;
    $body.innerHTML = '';
    const pageCount = Math.max(1, Math.ceil(this._rows.length / this.perPage));
    this.page = Math.min(this.page, pageCount - 1);
    const start = this.page * this.perPage;
    const slice = this._rows.slice(start, start + this.perPage);
    const myId  = this.manager.user?.id || null;

    slice.forEach((row, idx) => {
      const rank = start + idx + 1;
      const li = document.createElement('div');
      li.className = 'lb-row';
      if (rank === 1) li.classList.add('lb-row-gold');
      else if (rank === 2) li.classList.add('lb-row-silver');
      else if (rank === 3) li.classList.add('lb-row-bronze');
      if (myId && row.player_id === myId) li.classList.add('lb-row-me');

      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
      const date = new Date(row.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      li.innerHTML = `
        <div class="lb-cell lb-rank">${medal || ('#' + rank)}</div>
        <div class="lb-cell lb-pseudo" title="${this._escape(row.pseudo)}">${this._escape(row.pseudo)}</div>
        <div class="lb-cell lb-score">${(row.score || 0).toLocaleString('fr-FR')}</div>
        <div class="lb-cell lb-wave">V.${row.wave_reached || 0}</div>
        <div class="lb-cell lb-date">${date}</div>
      `;
      $body.appendChild(li);
    });

    if ($page) $page.textContent = `Page ${this.page + 1} / ${pageCount}`;
    const $prev = document.getElementById('lb-prev');
    const $next = document.getElementById('lb-next');
    if ($prev) $prev.disabled = this.page <= 0;
    if ($next) $next.disabled = this.page >= pageCount - 1;
  }

  _escape(s) {
    return String(s || '').replace(/[<>&"]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]));
  }

  nextPage() { this.page++; this._render(); }
  prevPage() { this.page--; this._render(); }
}

// ── ScoreSubmitModal — affichée à Game Over si top 100 ──────────────
// Renvoie une Promise<string|null> : pseudo soumis, ou null si "Passer".
function showScoreSubmitModal(defaultPseudo, scoreInfo) {
  return new Promise(resolve => {
    const $overlay  = document.getElementById('lb-modal-overlay');
    const $input    = document.getElementById('lb-pseudo-input');
    const $score    = document.getElementById('lb-modal-score');
    const $submit   = document.getElementById('lb-submit-btn');
    const $skip     = document.getElementById('lb-skip-btn');
    const $error    = document.getElementById('lb-modal-error');
    if (!$overlay || !$input || !$submit || !$skip) { resolve(null); return; }

    $input.value = (defaultPseudo || '').slice(0, 20);
    $input.maxLength = 20;
    if ($error) $error.textContent = '';
    if ($score) $score.textContent = `Score : ${(scoreInfo?.score || 0).toLocaleString('fr-FR')} · Vague ${scoreInfo?.wave || 0}`;
    $overlay.classList.remove('hidden');
    setTimeout(() => $input.focus(), 50);

    const cleanup = () => {
      $overlay.classList.add('hidden');
      $submit.onclick = null;
      $skip.onclick   = null;
      $input.onkeydown = null;
    };
    $submit.onclick = () => {
      const v = ($input.value || '').trim();
      if (v.length === 0) { if ($error) $error.textContent = 'Le pseudo ne peut pas être vide.'; return; }
      cleanup(); resolve(v);
    };
    $skip.onclick = () => { cleanup(); resolve(null); };
    $input.onkeydown = e => {
      if (e.key === 'Enter') $submit.click();
      else if (e.key === 'Escape') $skip.click();
    };
  });
}
