# systems/

Un fichier par système de gameplay, branché sur les données de `src/data/` :

| Système (à venir)   | Fichier prévu       | Données source            |
|---------------------|---------------------|---------------------------|
| Combat              | `CombatSystem.js`   | `mobs.json` (reglesCombat, reglesNiveau) |
| Quêtes              | `QuestSystem.js`    | `quests.json`             |
| Inventaire          | `InventorySystem.js`| `items.json`              |
| Dialogue            | `DialogueSystem.js` | `dialogues.json`          |
| Économie/boutiques  | `EconomySystem.js`  | `items.json` (boutiques)  |

Contrat : chaque système expose `update(dt)` si besoin d'un tick, et est
enregistré dans `Game.updatables`. Les systèmes ne touchent jamais au
rendu directement — ils émettent des événements que `ui/` et `world/`
consomment.
