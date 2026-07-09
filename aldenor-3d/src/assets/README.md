# assets/

Assets binaires du jeu, chargés via `core/AssetManager.js` :

```
assets/
  models/     — modèles .glb (personnages, props, végétation)
  textures/   — textures (terrain, atlas)
  sounds/     — sons et musiques
```

Convention : référencer les fichiers avec
`new URL('./models/xxx.glb', import.meta.url).href` pour que Vite les
inclue au build.
