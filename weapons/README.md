# Armes boutique — Mécaniques radicales

Chaque arme est définie dans son propre fichier et enregistre ses hooks dans
`window.PREMIUM_WEAPON_HOOKS[id]` via `registerPremiumWeapon(id, hooks)`.

## Interface d'un module

```js
window.registerPremiumWeapon('mon-arme', {
  onFire(wm, player, bullets, audio, game) { ... return N; },  // tir principal
  onHit(bullet, enemy, game)  { ... },                          // impact d'une balle de cette arme
  onAlt(wm, game)             { ... },                          // touche Alt (bascule, transformation, etc.)
  tick(dt, game)              { ... },                          // par-frame
  draw(ctx, game)             { ... },                          // rendu spécifique
  getHUDInfo(wm, game)        { return { text, color, ratio }; },// info affichée dans la barre HUD
});
```

## Les 6 armes

### 🦠 PARASITE — 50 000 pièces — RARE
Infection en chaîne. Le tir n'inflige pas de dégâts : il transforme l'ennemi
touché en agent infecté qui tire sur ses alliés pendant 4 s. Une mort par
tir d'infecté = propagation instantanée. Chaîne illimitée. Boss immunisés
mais reçoivent 20 dégâts directs.

- 1 seul projectile à l'écran (rafraîchit dès que le précédent atterrit)
- Cadence de tir doublée pour les ennemis infectés
- Visuel : projectile organique rouge/noir pulsant, ennemis infectés
  affichés avec veines rouges (`drawInfectedOverlay`)

### ⏳ MIROIR TEMPOREL — 80 000 pièces — RARE
Manipulation du temps. Enregistre chaque tir des 6 dernières secondes.
Alt = REPLAY : compresse la fenêtre entière en 2 s (tirs dorés) depuis
la position actuelle du vaisseau. Cooldown : 8 s après un replay.

- Tirs de base : Blaster standard
- Tirs de replay : couleur `#ffd700`, `isMirrorReplay: true`
- Buffer purgé automatiquement au-delà de 6 s

### 🔷 ARCHITECTE — 120 000 pièces — ÉPIQUE
Construction de tourelles. Le tir POSE une tourelle autonome à la position
du vaisseau (max 6, 8 s de durée, poser une 7e détruit la plus ancienne).

- **Tir normal** (`game._archInputMod = 'laser'`) : tourelle LASER, 480 px/s,
  cadence 0.28 s, portée 200 px, dégâts 1
- **Shift + tir** (`= 'shield'`) : tourelle BOUCLIER, absorbe 3 tirs ennemis
  dans un rayon 80 px
- **Ctrl + tir** (`= 'repair'`) : tourelle RÉPARATRICE, soigne +1 vie toutes
  les 5 s si le joueur est dans la portée (200 px)

Le modificateur est lu depuis `game._archInputMod` mis à jour par le handler
clavier de `game.js` (voir intégration).

### ⚫ SINGULARITÉ NOIRE — 180 000 pièces — ÉPIQUE
Manipulation gravitationnelle. Chaque tir crée un projectile noir qui,
à l'impact, invoque un micro trou noir (3 s de vie, rayon 120 px).

- Aspire ennemis et balles ennemies
- Inflige 5 dps aux ennemis dans la zone
- Deux trous noirs qui se touchent fusionnent (rayon × 0.7 additionné)
- Explosion finale : `10 × ennemis_absorbés` dégâts en zone
- Max 3 simultanés (le plus ancien explose)

### 🌑 VOID RIPPER — 350 000 pièces — LÉGENDAIRE (conservé)
Non touché — même mécanique qu'auparavant (pierce tout, laisse une déchirure).

### 👥 ÉCHO QUANTIQUE — 350 000 pièces — LÉGENDAIRE
Dédoublement quantique. Alt crée un fantôme du vaisseau qui **rejoue toutes
vos actions avec 1.5 s de délai** (2e fantôme = 3.0 s).

- Max 2 fantômes simultanés
- 70 % des dégâts réels
- Chaque fantôme absorbe 5 tirs ennemis avant de disparaître
- Cooldown de re-création : 5 s
- Le fantôme adopte le skin équipé avec teinte cyan (`filter: hue-rotate(180deg)`)

Buffer de replay : enregistre position + tir à chaque frame, purgé au-delà de 6.5 s.

### 🔱 DIEU DE LA GUERRE — 999 999 pièces — LÉGENDAIRE
Transformation totale. **Forme normale** : Blaster × 1.5 dégâts. Chaque
kill accumule de l'IRE :

- Ennemi normal : +5 IRE
- Ennemi spécial (kamikaze, blindé, healer, bomber, infecté) : +15 IRE
- Boss : +50 IRE
- Max 100 IRE

**Alt (coût 100 IRE)** : transformation en **FORME DIEU** pendant 10 s :
- Tir omnidirectionnel 8 directions (cadence 0.18 s)
- **Invincibilité totale** (`player.invincible = true`)
- **Attraction** : tous les ennemis à moins de 350 px sont aspirés vers le joueur
- **Dévoration** : chaque kill restaure 1 % de la durée
- **Onde de fin** à l'expiration : 50 dégâts à tous les ennemis à l'écran

Visuel forme Dieu : overlay rouge sang, aura dorée massive (2× taille), ailes
d'énergie latérales, yeux rouges, flash doré à la transformation.

## Intégration Game

Le Game (`game.js`) appelle les hooks du registre :

- `WeaponManager.fire()` — dispatche `onFire` pour les IDs custom
- `Game._update()` — appelle `tick(dt, game)` pour chaque arme équipée qui a un tick
- Collision loop — appelle `onHit(bullet, enemy, game)` pour les balles marquées
- Handler Alt — appelle `onAlt(wm, game)` quand pertinent
- `_drawWeaponsBar` — utilise `getHUDInfo` pour afficher l'état sous l'icône
