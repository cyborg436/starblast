# Chroniques d'Aldenor 3D 🐉

Action-RPG open world en **Three.js + Vite** — réécriture 3D du jeu 2D
(`../medieval/`), à partir des données de jeu extraites en Phase 0
(`src/data/*.json`).

## Démarrage

```bash
npm install
npm run dev       # serveur de dev → http://localhost:5173
npm run build     # build de production dans dist/
npm run preview   # sert le build
npm run lint      # ESLint sur src/
```

## État actuel — Phase 1 : fondations techniques

Base qui tourne à 60 fps, sans gameplay :

- Boucle de jeu `requestAnimationFrame` avec `THREE.Clock`, delta borné
  (indépendant du framerate)
- Renderer WebGL : tone mapping **ACES Filmic**, sortie **sRGB**, ombres
  **PCFSoftShadowMap**
- Caméra perspective FOV 60, near/far 0.1/2000 + OrbitControls de debug
- Éclairage : soleil directionnel avec ombres + hemisphere light, **hook
  jour/nuit fonctionnel** (`world.setTimeOfDay(0..1)`, cycle de 8 min
  actif par défaut, ciel physique `Sky` synchronisé)
- Sol plat 1000×1000 + grille de debug + cube témoin animé (ombres)
- Resize propre, pixel ratio plafonné à 2
- `AssetManager` centralisé (GLTFLoader + LoadingManager) avec écran de
  chargement HTML et barre de progression
- Compteur FPS (HUD DOM)

## Architecture

```
src/
  core/      Game (boucle), Renderer, SceneManager, AssetManager
  world/     World (sol, futur terrain/chunks), Lighting (soleil + hook jour/nuit), Sky
  entities/  Entity (classe de base) — Player/Enemy/Npc à venir
  systems/   combat, quêtes, inventaire, dialogue, économie (à venir, voir README)
  input/     InputManager (clavier/souris, manette prévue)
  ui/        HUD & menus en DOM par-dessus le canvas (jamais en 3D)
  assets/    modèles .glb, textures, sons
  data/      JSON de la Phase 0 (quêtes, dialogues, objets, mobs, PNJ)
```

Principes :
- L'ordre d'une frame : input → `update(dt)` de chaque système → render.
- Tout objet avec `update(dt, elapsed)` s'enregistre dans `Game.updatables`.
- L'UI est en HTML/CSS au-dessus du canvas ; le monde 3D ne rend jamais d'interface.
- Les valeurs de gameplay viennent de `src/data/` (source de vérité héritée de la 2D), jamais codées en dur.
