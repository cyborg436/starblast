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

## État actuel — Phase 4 : système de combat complet

Tout vit dans `src/systems/combat/` (un fichier par système, valeurs
numériques commentées pour être retouchées) :

- **ComboSystem** : combo léger ×3 (fenêtre = derniers 40 % de l'anim,
  input buffering 0,15 s, coup 3 plus fort + knockback) ; **lourde
  chargée** au clic droit maintenu (barre de charge, dégâts 30→80 et
  stagger scalés, cap 1,5 s, coût stamina, non annulable)
- **DodgeSystem** : esquive directionnelle (arrière par défaut),
  **i-frames sur les 60 % centraux**, coût 20 stamina, **essoufflement**
  si insuffisant, **dodge cancel** des attaques légères uniquement
- **StaminaSystem** : sprint/esquive/lourde, régén plus rapide hors combat
- **SkillSystem** : compétence élémentaire (E, cooldown affiché) — 4
  éléments interchangeables (touches 1-4) dont la Chaîne d'éclairs qui
  saute sur 3 cibles ; **énergie** chargée en frappant/subissant →
  **ultime** (R) : nova de zone
- **elementalReactions** : table déclarative — Vaporisation (feu↔eau,
  ×2), Surcharge (eau↔foudre, AoE), Diffusion (élément+vent, propage)
- **HitDetection** : fenêtres de hitbox synchronisées aux timestamps de
  chaque animation, sphere-cast balayé le long du couloir de la lame
- **EnemyAI + StaggerSystem** : patrol → aggro → attack (télégraphe
  0,55 s) → staggered (jauge de poise, ×1,5 dégâts) → dead ; ennemis du
  bestiaire 2D (`mobs.json`), spawn par biome
- **LockOn** : Tab/clic molette, réticule projeté, cycle de cible,
  biais caméra doux (renforcé pendant les attaques)
- **Juice** : hit-stop 70-130 ms (timeScale 0.07), screen shake, damage
  numbers DOM flottants, particules élémentaires (THREE.Points, pool 512)

## Phase 3 : personnage jouable (physique)

- **Modèle du héros** (`entities/HeroModel.js`) : charge un `.glb` riggé
  **Mixamo** depuis `public/models/hero.glb` (auto-échelle 1,80 m,
  animations en clips) ; **fallback** héros low-poly procédural si absent
  (voir `public/models/README.md` pour préparer l'export)
- **State machine d'animations** (`entities/AnimationController.js`) :
  états `idle/walk/run/jump/fall/swim/attack_light_1-3/attack_heavy/
  dodge/hit/dead`, crossfade 0,18 s, API unique `play(état, options)` ;
  deux backends interchangeables (`MixerBackend` .glb / `ProceduralBackend`)
- **Contrôleur physique** (`entities/Player.js`, `core/Physics.js`) :
  capsule cinématique **rapier3d** + `KinematicCharacterController`
  (autostep marches ≤ 55 cm, pente max 52°, snap-to-ground) sur des
  colliders **trimesh par chunk** identiques au maillage de rendu →
  suivi exact du relief, **0 clipping** ; déplacement relatif caméra,
  saut/gravité, sprint & esquive à **stamina**, nage
- **Combat de base** : combo attaque légère ×3 (avec buffering
  d'enchaînement), attaque lourde, esquive-roulade avec **i-frames**
- **Caméra 3ᵉ personne** (`core/CameraController.js`) : orbite type
  Genshin/BOTW, pointer lock, zoom molette 2,5–16 m, **collision par
  raycast physique** (se rapproche si le terrain coupe la vue), suivi amorti
- **Entrées rebindables** (`input/InputManager.js`) : couche d'actions
  `isActionDown('sprint')` / `wasActionPressed('dodge')` + `rebind()`,
  boutons souris virtualisés — aucune touche codée en dur dans le gameplay

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
