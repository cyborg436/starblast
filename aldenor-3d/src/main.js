import { Game } from './core/Game.js';

const canvas = document.getElementById('app');
const game = new Game(canvas);

game.init().then(() => game.start());

// Accès console/tests : window.__game.world.setTimeOfDay(0.9), etc.
window.__game = game;
