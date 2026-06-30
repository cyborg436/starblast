'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   achievements.js  —  Système de succès StarBlast (20 succès)
───────────────────────────────────────────────────────────────────────── */

// ── Définition des 20 succès ─────────────────────────────────────────
// metric : clé dans this.stats (pour les succès de progression)
// goal   : seuil à atteindre
// manual : true → vérifié explicitement par un event handler
const ACHIEVEMENT_DEFS = [
  // ── Combat ────────────────────────────────────────────────────────
  { id:'first-blood',  cat:'combat',    icon:'⚔', name:'Premiers Pas',    desc:'Tuer 10 ennemis',                reward:50,   metric:'totalKills',     goal:10 },
  { id:'hunter',       cat:'combat',    icon:'🎯', name:'Chasseur',        desc:'Tuer 100 ennemis',               reward:150,  metric:'totalKills',     goal:100 },
  { id:'exterminator', cat:'combat',    icon:'💀', name:'Exterminateur',   desc:'Tuer 1000 ennemis',              reward:500,  metric:'totalKills',     goal:1000 },
  { id:'no-mercy',     cat:'combat',    icon:'🔥', name:'Sans Pitié',      desc:'50 kills en une partie',         reward:200,  metric:'runKills',       goal:50 },
  { id:'sniper',       cat:'combat',    icon:'🏹', name:'Sniper',          desc:'Précision 100% (min 20 tirs)',   reward:300,  manual:true },
  // ── Combo ─────────────────────────────────────────────────────────
  { id:'on-fire',      cat:'combo',     icon:'🔥', name:'En Feu',          desc:'Atteindre le combo ×2',          reward:100,  metric:'maxComboEver',   goal:2 },
  { id:'unstoppable',  cat:'combo',     icon:'⚡', name:'Inarrêtable',     desc:'Atteindre le combo ×3',          reward:200,  metric:'maxComboEver',   goal:3 },
  { id:'god-mode',     cat:'combo',     icon:'👑', name:'GOD MODE',        desc:'Atteindre le combo ×5',          reward:500,  metric:'maxComboEver',   goal:5 },
  { id:'chainer',      cat:'combo',     icon:'⏱', name:'Enchaîneur',      desc:'Combo ×3 maintenu 30 secondes',  reward:400,  metric:'maxComboX3Time', goal:30 },
  // ── Survie ────────────────────────────────────────────────────────
  { id:'survivor',     cat:'survival',  icon:'🛡', name:'Survivant',       desc:'Atteindre la vague 5',           reward:100,  metric:'maxWaveEver',    goal:5 },
  { id:'veteran',      cat:'survival',  icon:'🎖', name:'Vétéran',         desc:'Atteindre la vague 15',          reward:300,  metric:'maxWaveEver',    goal:15 },
  { id:'legend',       cat:'survival',  icon:'⭐', name:'Légende',         desc:'Atteindre la vague 30',          reward:1000, metric:'maxWaveEver',    goal:30 },
  { id:'invincible',   cat:'survival',  icon:'💎', name:'Invincible',      desc:'Terminer une partie sans mourir',reward:500,  manual:true },
  // ── Histoire ──────────────────────────────────────────────────────
  { id:'explorer',     cat:'story',     icon:'🚀', name:'Explorateur',     desc:'Terminer le niveau 1',           reward:100,  manual:true },
  { id:'commander',    cat:'story',     icon:'🏆', name:'Commandant',      desc:'Terminer les 10 niveaux',        reward:2000, manual:true },
  { id:'perfectionist',cat:'story',     icon:'✨', name:'Perfectionniste', desc:'3 étoiles sur tous les niveaux', reward:3000, manual:true },
  { id:'boss-hunter',  cat:'story',     icon:'⚜', name:'Chasseur de Boss',desc:'Vaincre les 3 boss',             reward:1000, metric:'bossesDefeatedCount', goal:3 },
  // ── Collection ────────────────────────────────────────────────────
  { id:'collector',    cat:'collection',icon:'🎨', name:'Collectionneur',  desc:'Posséder 5 skins',               reward:500,  metric:'skinsOwnedCount',goal:5 },
  { id:'arsenal',      cat:'collection',icon:'🔫', name:'Arsenal',         desc:'Posséder tous les lasers',       reward:800,  manual:true },
  { id:'master',       cat:'collection',icon:'🌟', name:'Maître',          desc:'Atteindre le niveau de jeu 50',  reward:2000, metric:'playerLevel',    goal:50 },
];

const ACH_CATEGORIES = [
  { id:'combat',     label:'Combat'     },
  { id:'combo',      label:'Combo'      },
  { id:'survival',   label:'Survie'     },
  { id:'story',      label:'Histoire'   },
  { id:'collection', label:'Collection' },
];

// ── AchievementManager — état & déblocages ───────────────────────────
class AchievementManager {
  constructor() {
    this.unlocked   = new Set();   // ids déverrouillés
    this.newUnread  = new Set();   // ids débloqués mais non vus
    this.stats = {
      totalKills:        0,
      maxWaveEver:       0,
      maxComboEver:      1,
      maxComboX3Time:    0,
      bossesDefeatedIds: [],   // sérialisé en array
      // ── runtime (réinitialisé à chaque partie) ──
      runKills:          0,
      comboX3Time:       0,
      livesLostInRun:    0,
      shotsFired:        0,
      shotsHit:          0,
    };
    this._listeners = [];       // callbacks (achievement) — UI s'abonne pour les toasts
    this._coinsCb   = null;     // callback(amount) — Game crédite les pièces
    this._load();
  }

  // ── Abonnements ───────────────────────────────────────────────────
  /** Enregistre un callback appelé à chaque nouveau déblocage. */
  onUnlock(cb) { this._listeners.push(cb); }
  setCoinsCallback(cb) { this._coinsCb = cb; }

  // ── Helpers ───────────────────────────────────────────────────────
  isUnlocked(id) { return this.unlocked.has(id); }
  hasUnread()    { return this.newUnread.size > 0; }
  markAllRead()  { this.newUnread.clear(); this._save(); }

  count()           { return this.unlocked.size; }
  totalEarnedCoins(){
    let total = 0;
    for (const id of this.unlocked) {
      const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
      if (def) total += def.reward;
    }
    return total;
  }

  /** Progression actuelle pour un succès donné. */
  getProgress(def) {
    if (!def.metric) return null;
    if (def.metric === 'bossesDefeatedCount') return { current: this.stats.bossesDefeatedIds.length, goal: def.goal };
    if (def.metric === 'skinsOwnedCount')   return { current: this._skinsOwnedCount(), goal: def.goal };
    if (def.metric === 'playerLevel')       return { current: this._playerLevel,       goal: def.goal };
    const v = this.stats[def.metric] ?? 0;
    return { current: Math.min(v, def.goal), goal: def.goal };
  }

  // Référence externes (lazy)
  setRefs({ shop, story, progression, audio }) {
    this._shop = shop;
    this._story = story;
    this._progression = progression;
    this._audio = audio;
  }

  _skinsOwnedCount() {
    if (!this._shop) return 0;
    // Compte les skins possédés en excluant 'starter'
    if (typeof SKIN_DATA === 'undefined') return 0;
    return SKIN_DATA.filter(s => s.id !== 'starter' && this._shop.owned.has(s.id)).length;
  }

  get _playerLevel() { return this._progression?.level ?? 1; }

  // ── Cœur du système : check + unlock ──────────────────────────────
  _check(def) {
    if (this.unlocked.has(def.id)) return;
    let unlocked = false;
    if (def.metric) {
      const p = this.getProgress(def);
      if (p && p.current >= def.goal) unlocked = true;
    }
    if (unlocked) this._unlock(def);
  }

  _unlock(def) {
    if (this.unlocked.has(def.id)) return;
    this.unlocked.add(def.id);
    this.newUnread.add(def.id);
    this._save();
    if (this._coinsCb) this._coinsCb(def.reward);
    if (this._audio?.achievement) this._audio.achievement();
    this._listeners.forEach(cb => { try { cb(def); } catch(e){} });
  }

  /** Re-vérifie tous les succès basés sur metric (utile après onShopBuy/onLevelUp/etc.) */
  recheckAll() {
    for (const def of ACHIEVEMENT_DEFS) if (def.metric) this._check(def);
  }

  // ════════════════════════════════════════════════════════════════════
  //  EVENT HANDLERS — appelés depuis Game
  // ════════════════════════════════════════════════════════════════════

  onRunStart() {
    this.stats.runKills        = 0;
    this.stats.comboX3Time     = 0;
    this.stats.livesLostInRun  = 0;
    this.stats.shotsFired      = 0;
    this.stats.shotsHit        = 0;
    this._save();
  }

  /** Appelé à chaque kill (ennemi ou météorite). */
  onKill() {
    this.stats.totalKills++;
    this.stats.runKills++;
    this._save();
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'first-blood'));
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'hunter'));
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'exterminator'));
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'no-mercy'));
  }

  /** Appelé à chaque tir joueur. */
  onShotFired() { this.stats.shotsFired++; }
  onShotHit()   { this.stats.shotsHit++; }

  /** Appelé quand le multiplicateur de combo change (uniquement quand il monte). */
  onComboChanged(mult) {
    if (mult > this.stats.maxComboEver) {
      this.stats.maxComboEver = mult;
      this._save();
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'on-fire'));
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'unstoppable'));
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'god-mode'));
    }
  }

  /** Appelé chaque frame : si combo ≥ 3, accumule le temps. */
  onComboTick(dt, mult) {
    if (mult >= 3) {
      this.stats.comboX3Time += dt;
      if (this.stats.comboX3Time > this.stats.maxComboX3Time) {
        this.stats.maxComboX3Time = this.stats.comboX3Time;
        this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'chainer'));
      }
    } else {
      this.stats.comboX3Time = 0;
    }
  }

  onLifeLost() { this.stats.livesLostInRun++; }

  /** Survie : vague atteinte. */
  onWaveReached(level) {
    if (level > this.stats.maxWaveEver) {
      this.stats.maxWaveEver = level;
      this._save();
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'survivor'));
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'veteran'));
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'legend'));
    }
  }

  /** Histoire : niveau terminé avec X étoiles. */
  onStoryLevelComplete(levelId, stars, story) {
    if (levelId === 1) this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'explorer'));
    // Commandant : 10 niveaux tous complétés (étoiles >= 1)
    if (story) {
      const allDone = [...Array(10)].every((_, i) => story.getStars(i + 1) >= 1);
      if (allDone) this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'commander'));
      // Perfectionniste : 30 étoiles sur 30
      const all3 = [...Array(10)].every((_, i) => story.getStars(i + 1) >= 3);
      if (all3) this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'perfectionist'));
    }
  }

  /** Boss : type unique ajouté à l'ensemble. */
  onBossDefeated(bossType /* 'SENTINELLE'|'CHASSEUR'|'TITAN' */) {
    const t = String(bossType || '').toUpperCase();
    if (!t) return;
    if (!this.stats.bossesDefeatedIds.includes(t)) {
      this.stats.bossesDefeatedIds.push(t);
      this._save();
      this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'boss-hunter'));
    }
  }

  /** Achat boutique : déclenche la recheck Collection. */
  onShopBuy() {
    // Collectionneur
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'collector'));
    // Arsenal : tous les lasers non-BP possédés
    if (typeof COLOR_DATA !== 'undefined' && this._shop) {
      const targetLasers = COLOR_DATA.filter(c => !c.bpOnly);
      const allOwned = targetLasers.every(c => this._shop.owned.has(c.id));
      if (allOwned) this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'arsenal'));
    }
  }

  /** XP : niveau de jeu monté. */
  onPlayerLevelUp() {
    this._check(ACHIEVEMENT_DEFS.find(d => d.id === 'master'));
  }

  /** Fin de partie Survie — vérifie Invincible et Sniper. */
  onSurvivalRunEnd() {
    if (this.stats.livesLostInRun === 0) {
      this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'invincible'));
    }
    if (this.stats.shotsFired >= 20 && this.stats.shotsHit === this.stats.shotsFired) {
      this._unlock(ACHIEVEMENT_DEFS.find(d => d.id === 'sniper'));
    }
  }

  // ── Persistance ───────────────────────────────────────────────────
  _save() {
    localStorage.setItem('starblast_achievements', JSON.stringify({
      unlocked: [...this.unlocked],
      unread:   [...this.newUnread],
      stats: {
        totalKills:        this.stats.totalKills,
        maxWaveEver:       this.stats.maxWaveEver,
        maxComboEver:      this.stats.maxComboEver,
        maxComboX3Time:    this.stats.maxComboX3Time,
        bossesDefeatedIds: this.stats.bossesDefeatedIds,
      },
    }));
  }

  _load() {
    const raw = JSON.parse(localStorage.getItem('starblast_achievements') || 'null');
    if (!raw) return;
    this.unlocked  = new Set(raw.unlocked || []);
    this.newUnread = new Set(raw.unread   || []);
    Object.assign(this.stats, {
      totalKills:        raw.stats?.totalKills        || 0,
      maxWaveEver:       raw.stats?.maxWaveEver       || 0,
      maxComboEver:      raw.stats?.maxComboEver      || 1,
      maxComboX3Time:    raw.stats?.maxComboX3Time    || 0,
      bossesDefeatedIds: raw.stats?.bossesDefeatedIds || [],
    });
  }
}

// ── AchievementUI — toast in-game + écran liste ──────────────────────
class AchievementUI {
  constructor(am) {
    this.am = am;
    this._toastQueue = [];
    this._currentToast = null;
    this._toastTimer = 0;
    am.onUnlock(def => this._enqueueToast(def));
  }

  // ── Toast notification ────────────────────────────────────────────
  _enqueueToast(def) { this._toastQueue.push(def); this._showNextToast(); }

  _showNextToast() {
    if (this._currentToast || this._toastQueue.length === 0) return;
    const def = this._toastQueue.shift();
    this._currentToast = def;
    const host = document.getElementById('achievement-toast-host');
    if (!host) { this._currentToast = null; return; }
    const el = document.createElement('div');
    el.className = `ach-toast ach-toast-${def.cat}`;
    el.innerHTML = `
      <div class="ach-toast-icon">🏆</div>
      <div class="ach-toast-body">
        <div class="ach-toast-title">SUCCÈS DÉBLOQUÉ</div>
        <div class="ach-toast-name">${def.icon} ${def.name}</div>
        <div class="ach-toast-reward">+${def.reward} <span class="coin-star">★</span></div>
      </div>
    `;
    host.appendChild(el);
    setTimeout(() => el.classList.add('ach-toast-out'), 2700);
    setTimeout(() => {
      el.remove();
      this._currentToast = null;
      this._showNextToast();
    }, 3200);
  }

  // ── Badge "nouveau" sur le bouton du menu ─────────────────────────
  updateMenuBadge() {
    const badge = document.getElementById('btn-ach-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', !this.am.hasUnread());
  }

  // ── Rendu de l'écran principal ────────────────────────────────────
  renderScreen() {
    const am = this.am;

    // Statistiques globales
    const $count = document.getElementById('ach-count');
    const $coins = document.getElementById('ach-coins-total');
    if ($count) $count.textContent = `${am.count()} / ${ACHIEVEMENT_DEFS.length}`;
    if ($coins) $coins.textContent = am.totalEarnedCoins().toLocaleString('fr-FR');

    // Grille des cartes — groupées par catégorie
    const $grid = document.getElementById('ach-grid');
    if (!$grid) return;
    $grid.innerHTML = '';

    ACH_CATEGORIES.forEach(cat => {
      const defs = ACHIEVEMENT_DEFS.filter(d => d.cat === cat.id);
      if (defs.length === 0) return;
      const section = document.createElement('div');
      section.className = 'ach-section';
      const hdr = document.createElement('div');
      hdr.className = 'ach-section-title';
      hdr.textContent = cat.label.toUpperCase();
      section.appendChild(hdr);

      const row = document.createElement('div');
      row.className = 'ach-row';
      defs.forEach(def => row.appendChild(this._renderCard(def)));
      section.appendChild(row);
      $grid.appendChild(section);
    });

    // Marquer tous les succès comme vus
    am.markAllRead();
    this.updateMenuBadge();
  }

  _renderCard(def) {
    const am = this.am;
    const unlocked = am.isUnlocked(def.id);
    const card = document.createElement('div');
    card.className = `ach-card ${unlocked ? 'ach-card-unlocked' : 'ach-card-locked'} ach-cat-${def.cat}`;

    const icon = document.createElement('div');
    icon.className = 'ach-card-icon';
    icon.textContent = unlocked ? def.icon : '?';
    card.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'ach-card-body';
    const name = document.createElement('div');
    name.className = 'ach-card-name';
    name.textContent = def.name;
    body.appendChild(name);
    const desc = document.createElement('div');
    desc.className = 'ach-card-desc';
    desc.textContent = def.desc;
    body.appendChild(desc);
    const reward = document.createElement('div');
    reward.className = 'ach-card-reward';
    reward.innerHTML = `<span class="coin-star">★</span> ${def.reward}`;
    body.appendChild(reward);

    // Barre de progression si applicable
    if (def.metric) {
      const p = am.getProgress(def);
      if (p) {
        const wrap = document.createElement('div');
        wrap.className = 'ach-card-bar';
        const fill = document.createElement('div');
        fill.className = 'ach-card-bar-fill';
        fill.style.width = `${Math.min(100, (p.current / p.goal) * 100)}%`;
        wrap.appendChild(fill);
        body.appendChild(wrap);
        const txt = document.createElement('div');
        txt.className = 'ach-card-progress';
        txt.textContent = `${Math.min(p.current, p.goal)} / ${p.goal}`;
        body.appendChild(txt);
      }
    }
    card.appendChild(body);
    return card;
  }
}
