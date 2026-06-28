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
├── index.html   — Structure HTML, placeholders publicitaires
├── style.css    — Thème spatial sombre, UI responsive
├── game.js      — Moteur de jeu complet (14 sections commentées)
└── README.md    — Ce fichier
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
