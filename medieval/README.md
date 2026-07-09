# Chroniques d'Aldenor ⚔️

Open world médiéval en 2D style rétro (pixel-art), jouable au clavier sur PC.
100 % HTML5 Canvas + Vanilla JS — **zéro dépendance, zéro asset externe** :
tous les sprites, tuiles, sons et musiques sont générés procéduralement.

## Démarrage rapide

```bash
# Ouvrir directement dans le navigateur
open medieval/index.html   # macOS
start medieval\index.html  # Windows

# Ou serveur local
npx serve .
# puis http://localhost:3000/medieval/
```

## Le monde

Chaque partie génère un continent unique (seed aléatoire) de 320×320 tuiles :

- **7 biomes** : plaines, forêt de Sombrebois, désert de Cendrelune, marais
  putrides, terres gelées du nord, monts Grisepierre, mer intérieure
- **6 villages** nommés et reliés par des routes (ponts sur les rivières),
  avec forgeron, marchand, alchimiste, auberge, gardes et villageois
- **Points d'intérêt** : camp de bandits, cimetière et sa crypte, mine
  infestée, ruines anciennes, tour de la mystique, antre du dragon
- **3 donjons générés** (Crypte Oubliée, Mine de Grisepierre, Antre de
  Vermithrax) avec salles, couloirs, coffres, lave et boss
- **Cycle jour/nuit** (8 min/jour) avec éclairage dynamique (torches,
  feux de camp, lave), météo (pluie)

## Systèmes de jeu

- **Combat** : mêlée (épées, haches), arc à distance, 3 sorts débloqués en
  montant de niveau (Boule de feu, Soin, Éclair), ruée avec endurance,
  coups critiques, recul
- **23 types de monstres** avec IA (errance, aggro, poursuite, tirs,
  invocations du nécromancien, souffle du dragon) et niveau qui augmente
  en s'éloignant de la capitale (zones niv. 1 → 12)
- **5 boss** : Garrok le Balafré, Gardien des Ruines, Malakar le
  Nécromancien, le Yéti… et Vermithrax, Terreur d'Aldenor
- **Progression** : XP/niveaux, statistiques, ~50 objets (armes, armures,
  casques, anneaux, potions, matériaux), inventaire, équipement visible
  sur le personnage
- **Quête principale en 6 actes** (des loups jusqu'au dragon, avec la forge
  de la Lame stellaire) + **quêtes annexes générées** dans chaque village
  (chasse, collecte, livraisons entre villages)
- **Économie** : or, boutiques d'achat/vente, butin, coffres, minage,
  cueillette, nuit à l'auberge
- **Sauvegarde** : localStorage (auberge, menu pause + auto-save 45 s)
- **Audio** : effets sonores et musique de ménestrel synthétisés en Web Audio

## Contrôles

| Touche | Action |
|---|---|
| ZQSD / WASD / Flèches | Se déplacer |
| Espace / Clic | Attaquer |
| E | Parler / ouvrir / interagir |
| Maj | Ruée |
| 1–5 | Potions & sorts |
| I / C / J / M | Inventaire / Personnage / Quêtes / Carte |
| H | Aide · P/Échap : pause |

## Fichiers

```
medieval/
├── index.html      — structure & panneaux d'interface
├── style.css       — thème rétro (parchemin & pixel)
└── js/
    ├── core.js     — RNG déterministe, bruit fractal, entrées, audio chiptune
    ├── sprites.js  — pixel-art procédural (tuiles, monstres, humanoïdes, icônes)
    ├── items.js    — objets, équipement, butin, boutiques
    ├── world.js    — génération du monde, villages, routes, POI, donjons
    ├── entities.js — joueur, bestiaire, IA, projectiles, particules
    ├── quests.js   — quête principale, quêtes annexes, dialogues
    ├── ui.js       — HUD, inventaire, boutiques, cartes, journal
    └── main.js     — boucle de jeu, rendu, jour/nuit, sauvegarde
```
