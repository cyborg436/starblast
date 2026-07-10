/**
 * Données de jeu extraites de la version 2D (Phase 0).
 * Import statique : bundlé par Vite, disponible de façon synchrone.
 * La clé `_doc` de chaque fichier est sa documentation de schéma.
 */
import quests from './quests.json';
import dialogues from './dialogues.json';
import items from './items.json';
import mobs from './mobs.json';
import npcs from './npcs.json';
import pois from './pois.json';

export const DATA = Object.freeze({ quests, dialogues, items, mobs, npcs, pois });
