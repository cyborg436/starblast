# StarBlast 🚀

Jeu de tir spatial vertical en HTML5 Canvas — Vanilla JS, zéro dépendance.

## Démarrage rapide

```bash
# Ouvrir directement dans le navigateur
open index.html   # macOS
start index.html  # Windows

# Ou serveur local (recommandé pour éviter les restrictions CORS)
npx serve .
# puis http://localhost:3000
```

---

## Structure des fichiers

```
starblast/
├── index.html         — Structure HTML, placeholders publicitaires
├── style.css          — Thème spatial sombre, UI responsive
├── game.js            — Moteur de jeu complet (14 sections commentées)
├── music.js           — Musique procédurale (Web Audio API, 7 morceaux)
├── battlepass.js      — Battle Pass saisonnier (50 paliers, voies gratuite et premium)
├── achievements.js    — Système de 20 succès avec toasts et persistance
├── leaderboard.js     — Classement mondial via Supabase + Edge Function
├── weapons.js         — Système d'armes évolutif (6 armes)
├── bossrush.js        — Mode Boss Rush (10 boss en séquence)
└── README.md          — Ce fichier
```

---

## Déploiement sur Vercel

1. Initialisez un dépôt Git et poussez les 3 fichiers :
   ```bash
   git init && git add . && git commit -m "init starblast"
   git remote add origin https://github.com/votre-user/starblast.git
   git push -u origin main
   ```

2. Sur [vercel.com](https://vercel.com) → **New Project** → importez le dépôt.  
   Vercel détecte automatiquement un site statique — aucune configuration requise.

3. Cliquez **Deploy**. Le jeu est en ligne en ~30 secondes.

> **Alternative rapide** : glissez le dossier `starblast/` directement dans
> [vercel.com/new](https://vercel.com/new) (drag & drop sans Git).

---

## Intégration Google AdSense

Le HTML contient deux emplacements prêts à l'emploi :

| Emplacement | ID HTML | Description |
|---|---|---|
| Bannière bas de page | `#ad-banner` | 728×90, hors canvas |
| Interstitiel Game Over | `#ad-interstitiel` | Dans l'écran Game Over |

### Étapes

1. Créez un compte sur [adsense.google.com](https://adsense.google.com).
2. Ajoutez votre site, validez la propriété.
3. Dans `index.html`, remplacez les `<div class="ad-inner">` par votre code AdSense généré :

```html
<!-- Remplacez le contenu de #ad-banner -->
<div id="ad-banner" class="ad-slot ad-banner-slot">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
```

4. Répétez pour `#ad-interstitiel` (format rectangle recommandé : 320×100).

---

## Intégration Stripe (suppression des pubs)

La modale "Supprimer les pubs" appelle `_launchStripe()` dans `game.js`.

### Option A — Payment Link (sans backend, le plus simple)

1. Dans votre [Dashboard Stripe](https://dashboard.stripe.com/payment-links), créez un Payment Link à 2,99 €.
2. Dans `game.js`, remplacez dans `_launchStripe()` :
   ```js
   window.location.href = 'https://buy.stripe.com/VOTRE_PAYMENT_LINK';
   ```
3. Pour détecter le retour après paiement, vérifiez `?payment=success` dans l'URL et masquez les publicités.

### Option B — Stripe Checkout (avec backend)

> Nécessite une serverless function (Vercel API route, Netlify Function, etc.)

1. Installez le SDK Stripe côté serveur : `npm install stripe`
2. Créez `/api/create-checkout-session.js` :
   ```js
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   module.exports = async (req, res) => {
     const session = await stripe.checkout.sessions.create({
       line_items: [{ price: 'price_VOTRE_PRICE_ID', quantity: 1 }],
       mode: 'payment',
       success_url: `${req.headers.origin}?payment=success`,
       cancel_url:  `${req.headers.origin}?payment=cancel`,
     });
     res.redirect(303, session.url);
   };
   ```
3. Dans `game.js`, décommentez le bloc "Option B" dans `_launchStripe()`.
4. Ajoutez `STRIPE_SECRET_KEY=sk_live_...` dans les variables d'environnement Vercel.
5. Décommentez `<script src="https://js.stripe.com/v3/">` dans `index.html`.

### Variables d'environnement à configurer sur Vercel

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (`sk_live_...`) |

La clé publique (`pk_...`) est dans `game.js` → `CFG.STRIPE_KEY` — modifiable directement.

---

## Battle Pass (Saison 1) — Configuration Stripe

Le Battle Pass est un produit séparé à **4,99 €** qui débloque la voie premium (50 paliers
exclusifs) et un bonus permanent de +20 % XP en jeu.

### Étapes

1. Dans votre [Dashboard Stripe → Payment Links](https://dashboard.stripe.com/payment-links),
   créez un produit **"Battle Pass StarBlast — Saison 1"** au prix unique de **4,99 €**.

2. Configurez l'URL de succès du Payment Link sur :
   ```
   https://votre-domaine.vercel.app/?battlepass=unlocked
   ```
   (en production, remplacez `votre-domaine` par votre déploiement Vercel)

3. Copiez l'URL de paiement (`https://buy.stripe.com/...`) et collez-la dans `battlepass.js` :
   ```js
   const BP_STRIPE_URL = 'https://buy.stripe.com/VOTRE_PAYMENT_LINK';
   ```

4. Lorsque le joueur revient depuis Stripe avec `?battlepass=unlocked`, le jeu détecte le
   paramètre, active automatiquement le premium, persiste l'état en `localStorage` (clé
   `starblast_bp_premium`) et nettoie l'URL.

### Persistance et état

| Clé `localStorage` | Contenu |
|---|---|
| `starblast_battlepass`    | XP, paliers réclamés (free / premium), date début de saison |
| `starblast_bp_premium`    | `'1'` si le pass premium est actif |

La saison dure **60 jours** à compter de la première ouverture du Battle Pass — modifiable
via `BP_SEASON_DAYS` dans `battlepass.js`.

### Récompenses

- **Voie gratuite** : 9 packs de pièces + 4 lasers + 5 skins (Interceptor → Sentinel)
- **Voie premium** : 9 skins (Wraith, Comet, Mirage, Seraph, Dreadnought, Sovereign,
  **GENESIS**…) + 11 lasers (Cristal, Soleil Noir, Apocalypse…) + packs de pièces
- Progression : **1000 XP par palier**, l'XP gagnée en Survie et Histoire alimente
  automatiquement le Battle Pass

Voir `BP_REWARDS` dans `battlepass.js` pour la table complète.

---

## Mode Boss Rush

Accessible depuis le menu principal via le bouton **👹 BOSS RUSH**. Le joueur affronte
**10 boss en séquence** sans interruption (pas d'ennemis normaux), avec 5 vies au départ
et 5 secondes de répit entre chaque boss.

### Les 10 boss

1. **SENTINEL** (300 PV) — Cube rotatif gris, tir en croix
2. **HYDRA** (500 PV) — 3 têtes indépendantes, accélèrent quand on en détruit
3. **PHANTOM** (700 PV) — Mode fantôme invincible + téléportation
4. **LEVIATHAN** (1000 PV) — Serpent à 5 segments, queue détruit les balles
5. **NOVA** (1200 PV, mi-parcours) — Étoile à 6 branches, 2 phases, EMP périodique
6. **REAPER** (1500 PV) — Faux géante, mini-faux orbitales, dash diagonal
7. **FORTRESS** (2000 PV) — 6 tourelles destructibles, bouclier + missile à tête chercheuse
8. **ECLIPSE** (2500 PV) — Trous noirs miniatures, laser rotatif à 360°
9. **COLOSSUS** (3500 PV) — Titan mécanique, ondes de choc, griffe, méga laser
10. **NEMESIS PRIME** (5000 PV, boss final) — 4 phases distinctes, fragmentation, miroir

### Récompenses

- Chaque boss tué : pièces = `maxHp / 2` (150 → 2500)
- Compléter les 10 boss : **10 000 pièces + 5000 XP + skin exclusif NEMESIS**
  (noir/doré, inspiré du boss final)
- Score soumis au classement avec `mode = 'bossrush'` (onglet dédié dans le leaderboard)

### Musique

Track procédural dédié `bossrush` (175 BPM, ultra-intense) via le `MusicManager` existant.

---

## Contrôles

| Action | Clavier | Mobile |
|---|---|---|
| Déplacement | ← → ↑ ↓ ou WASD | Joystick gauche |
| Tir | Espace (maintenu) | Bouton 🔥 |
| Bombe | B | Bouton 💣 |
| Pause | P ou Échap | — |

---

## Mécanique de jeu

- **3 types d'ennemis** : Basic (1 HP), Medium (3 HP), Heavy (8 HP)
- **3 power-ups** : Bouclier 🛡️ · Tir double ⚡ · Bombe 💣
- **Progression** : chaque vague augmente la vitesse et la densité des ennemis
- **Vies** : 3 vies, invincibilité de 2 secondes après impact
- **Record** : sauvegardé dans `localStorage` (persistent entre sessions)

---

## Performance

- Cible : 60 fps stables via `requestAnimationFrame`
- Delta-time plafonné à 50 ms — pas de saut physique si l'onglet perd le focus
- Canvas 480×720 (logique), mis à l'échelle via CSS — aucune re-création du canvas au resize
- Aucune dépendance externe — chargement instantané (hormis Google Fonts)

---

## Leaderboard mondial — Configuration Supabase

Le classement utilise [Supabase](https://supabase.com) avec lecture publique et
insertion sécurisée via Edge Function (anti-triche basique).

### 1. Créer la table `leaderboard`

Dans **Supabase → SQL Editor**, exécute :

```sql
-- Table principale du classement
create table public.leaderboard (
  id            uuid          primary key default gen_random_uuid(),
  player_id     uuid          references auth.users(id) on delete set null,
  pseudo        text          not null check (char_length(pseudo) between 1 and 20),
  score         integer       not null check (score >= 0),
  wave_reached  integer       not null default 0 check (wave_reached >= 0),
  mode          text          not null check (mode in ('survie','histoire','bossrush')),
  skin_used     text          not null default 'starter',
  created_at    timestamptz   not null default now()
);

-- Index pour les tris du top 100
create index idx_leaderboard_score on public.leaderboard (mode, score desc);
create index idx_leaderboard_player on public.leaderboard (player_id);
```

### 2. Activer RLS et créer les policies

```sql
-- Active RLS
alter table public.leaderboard enable row level security;

-- Lecture : publique (anonymes inclus)
create policy "Leaderboard est public en lecture"
  on public.leaderboard for select
  using ( true );

-- Écriture : interdite aux clients (anon + authenticated)
-- → seules les Edge Functions avec service_role pourront insérer.
-- Aucune policy d'INSERT créée volontairement.
```

### 3. Créer l'Edge Function `submit-score`

Crée le fichier `supabase/functions/submit-score/index.ts` :

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Anti-triche : limite raisonnable de score par seconde de jeu
const MAX_SCORE_PER_SECOND = 1500;
const MAX_SCORE_ABSOLUTE   = 99_999_999;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const { pseudo, score, wave_reached, mode, skin_used, playtime } = body;

  // Validations strictes
  if (typeof score !== "number" || score < 0 || score > MAX_SCORE_ABSOLUTE)  return json({ error: "score invalide" }, 400);
  if (!["survie","histoire","bossrush"].includes(mode))                      return json({ error: "mode invalide" }, 400);
  if (typeof playtime !== "number" || playtime <= 0 || playtime > 86400)     return json({ error: "playtime invalide" }, 400);
  if (typeof wave_reached !== "number" || wave_reached < 0 || wave_reached > 999) return json({ error: "wave invalide" }, 400);
  if (score > playtime * MAX_SCORE_PER_SECOND)                               return json({ error: "score suspect (ratio score/temps)" }, 400);

  const cleanPseudo = String(pseudo || "Anonyme").slice(0, 20).trim() || "Anonyme";
  const cleanSkin   = String(skin_used || "starter").slice(0, 30);

  // service_role pour bypass RLS (l'insert est uniquement déclenché depuis cette function)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Détection d'un utilisateur authentifié (token Bearer transmis par le client)
  let playerId: string | null = null;
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const jwt = auth.slice(7);
    const { data } = await admin.auth.getUser(jwt);
    playerId = data.user?.id ?? null;
  }

  const { error } = await admin.from("leaderboard").insert({
    player_id:    playerId,
    pseudo:       cleanPseudo,
    score:        Math.floor(score),
    wave_reached: Math.floor(wave_reached),
    mode,
    skin_used:    cleanSkin,
  });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 4. Déployer l'Edge Function

```bash
# Installer le CLI si nécessaire
npm install -g supabase

# Lier le projet local au projet Supabase
supabase link --project-ref VOTRE_PROJECT_REF

# Déployer
supabase functions deploy submit-score
```

L'Edge Function a accès à `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` qui sont
automatiquement injectées par Supabase — aucune configuration supplémentaire.

### 5. Configurer le client

Dans `leaderboard.js`, remplace les placeholders en haut du fichier :

```js
const SUPABASE_CONFIG = {
  url:     'https://VOTRE-PROJECT.supabase.co',
  anonKey: 'VOTRE_ANON_KEY',           // dispo dans Project Settings → API
  edgeFn:  'submit-score',
};
```

Tant que ces valeurs restent à `YOUR_*`, le leaderboard se désactive proprement
(l'écran affiche "Leaderboard hors-ligne") sans planter le reste du jeu.

### Flux de soumission

1. À chaque Game Over en **mode Survie**, le client interroge le top 100.
2. Si le score s'y qualifie, une modale demande le pseudo (max 20 caractères,
   pré-rempli avec la partie avant `@` de l'email si l'utilisateur est connecté).
3. Le client `POST` vers `/functions/v1/submit-score` avec son JWT (si connecté)
   ou la clé anonyme. L'Edge Function revalide le ratio score/temps puis insère
   avec `service_role`.
4. La table cache est invalidée → le score apparaît au prochain refresh
   (auto-refresh toutes les 60 s sur l'écran Classement).

### Anti-triche

- **Côté client** : pré-validation `score / playtime ≤ 1500 pts/s`
- **Côté serveur (autoritaire)** : même validation + bornes absolues
  (score ≤ 99 999 999, playtime ≤ 86 400 s, wave ≤ 999)
- **RLS** : aucune policy d'INSERT côté client — seule la Edge Function avec
  `service_role` peut écrire
- **Pseudo** : tronqué à 20 caractères, sanitisé (échappé à l'affichage côté
  client pour éviter le XSS)
