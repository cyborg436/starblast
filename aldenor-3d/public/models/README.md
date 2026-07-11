# public/models/

Déposez ici les modèles `.glb` servis tels quels par Vite (chemin runtime
`/<base>models/…`).

## hero.glb — le personnage jouable

Placez votre export **Mixamo** sous le nom exact `hero.glb`. Tant que ce
fichier est absent, le jeu utilise automatiquement le héros low-poly
procédural de secours (mêmes états d'animation).

### Comment préparer le .glb depuis Mixamo

1. Choisissez un personnage sur [mixamo.com](https://www.mixamo.com).
2. Téléchargez les animations souhaitées en **FBX** (With Skin pour la
   première, Without Skin pour les suivantes) : Idle, Walking, Running,
   Jump, Falling Idle, Slash (×2-3), une attaque lourde (Great Sword
   Slash…), une roulade (Roll / Dodge), une réaction de coup (Hit
   Reaction) et une mort (Dying).
3. Fusionnez-les en un seul `.glb` avec les clips nommés — le plus simple
   est [Blender](https://blender.org) (import FBX successifs → chaque
   action dans le NLA) ou un outil comme
   [gltf-transform](https://gltf-transform.dev).
4. Nommez les clips (la correspondance est **insensible à la casse et par
   inclusion**, voir `src/entities/AnimationController.js`) :

   | État moteur       | Noms de clip acceptés                     |
   |-------------------|-------------------------------------------|
   | `idle`            | idle, breathing                           |
   | `walk`            | walk                                      |
   | `run`             | run, sprint, jog                          |
   | `jump`            | jump                                      |
   | `fall`            | fall, falling                             |
   | `swim`            | swim, tread                               |
   | `attack_light_1`  | attack_light_1, attack1, slash1, slash, attack |
   | `attack_light_2`  | attack_light_2, attack2, slash2           |
   | `attack_light_3`  | attack_light_3, attack3, slash3           |
   | `attack_heavy`    | attack_heavy, heavy, smash, strong        |
   | `dodge`           | dodge, roll, dive                         |
   | `hit`             | hit, impact, react                        |
   | `dead`            | dead, death, dying                        |

Le modèle est automatiquement mis à l'échelle à 1,80 m et posé pieds à
`y = 0`. Un clip manquant retombe sur un voisin plausible (ex. `walk` →
`run`).
