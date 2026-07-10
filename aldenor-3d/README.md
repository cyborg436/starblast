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

## État actuel — Phase 3 : joueur jouable

- **Héros low-poly procédural** (`entities/Player.js`) : modèle articulé
  (jambes/bras/tête pivotés), épée dans le dos, animations procédurales
  (marche, sprint, idle respiration, saut, brasse)
- **Contrôleur** : ZQSD/WASD relatifs à la caméra, sprint (Maj 9,5 m/s),
  saut avec gravité, collé au terrain via `getHeightAt`, **nage**
  automatique dans les lacs (flottaison, vitesse réduite)
- **Caméra 3ᵉ personne** (`core/CameraController.js`) : pointer lock au
  clic (ou glisser-clic), tangage borné, zoom molette 2,5–16 m, jamais
  sous le terrain, suivi amorti — le streaming de chunks suit le joueur

## Phase 2 : monde ouvert

Direction artistique **stylisée/cartoon** (low-poly, flat shading,
couleurs saturées). Base Phase 1 : boucle `THREE.Clock` delta borné,
renderer ACES Filmic/sRGB/PCFSoftShadowMap, caméra FOV 60 (0.1/2000),
AssetManager (GLTFLoader + barre de chargement), resize, ESLint.

- **Terrain procédural** (`WorldGen`) : heightmap simplex multi-octaves
  (relief général + détail fin + crêtes ridged + dunes + cuvettes→lacs),
  cartes climat (température/humidité) basse fréquence → régions
- **5 biomes** (prairie, forêt, désert, neige/montagne, marais) : poids
  gaussiens dans l'espace climat → **transitions progressives** de la
  hauteur, des couleurs (vertex colors), de la densité de props et du
  brouillard ; hook musique d'ambiance par biome (`world.onBiomeChange`)
- **Props instanciés** : arbres/rochers/cactus/roseaux… low-poly
  procéduraux, `THREE.InstancedMesh` par type et par chunk, placement
  déterministe par seed (grille hashée de 4 m — pas de chevauchement),
  filtré par pente/altitude/POI
- **Chunk streaming** : dalles de 100 m (50×50 segments, normales
  analytiques → aucune couture), rayon de charge 3 chunks (~350 m),
  1 génération max/frame, déchargement au-delà de 4 — même seed →
  même monde au retour ; `world.getHeightAt(x, z)` en API publique
- **POI** (`data/pois.json`, définis à la main) : ruines, campements,
  autel, grotte — aplanissement progressif du terrain, exclusion des
  props, décor stylisé par type
- **Cycle jour/nuit 20 min** : arc solaire + couleurs/intensités, ciel
  **dégradé en shader** (zénith/horizon + disque et halo solaires),
  brouillard assombri la nuit, zone d'ombre qui suit le joueur
- **Eau stylisée** : plan par chunk au niveau 0, shader vagues de vertex
  + fresnel rive/profondeur + reflet du soleil (pas de réflexion)

## Architecture

```
src/
  core/      Game (boucle), Renderer, SceneManager, AssetManager
  world/     World (orchestration), Biomes (WorldGen), TerrainSystem (streaming),
             Chunk, Props (InstancedMesh), Water, POIManager, Lighting, Sky, Noise
  entities/  Entity (classe de base) — Player/Enemy/Npc à venir
  systems/   combat, quêtes, inventaire, dialogue, économie (à venir, voir README)
  input/     InputManager (clavier/souris, manette prévue)
  ui/        HUD & menus en DOM par-dessus le canvas (jamais en 3D)
  assets/    modèles .glb, textures, sons
  data/      JSON de la Phase 0 (quêtes, dialogues, objets, mobs, PNJ) + pois.json
```

Principes :
- L'ordre d'une frame : input → `update(dt)` de chaque système → render.
- Tout objet avec `update(dt, elapsed)` s'enregistre dans `Game.updatables`.
- L'UI est en HTML/CSS au-dessus du canvas ; le monde 3D ne rend jamais d'interface.
- Les valeurs de gameplay viennent de `src/data/` (source de vérité héritée de la 2D), jamais codées en dur.
