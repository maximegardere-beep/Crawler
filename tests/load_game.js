// load_game.js — charge bestiary/items/districts/safehouses/generator/app dans le contexte global
// courant (via vm), dans l'ordre requis par leurs dépendances. Utilisé par tous les fichiers de
// /tests : centralise la liste des fichiers sources pour ne pas la dupliquer partout.
// Attention : app.js exécute generateFloorMap()+updateUI() à son chargement (comportement normal
// du jeu) — chaque test qui a besoin d'un état précis doit réinitialiser gameState après l'appel.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_FILES = ['bestiary.js', 'items.js', 'spells.js', 'districts.js', 'safehouses.js', 'generator.js', 'anomalies.js', 'app.js'];
const REPO_ROOT = path.join(__dirname, '..');

function loadGame() {
    const src = GAME_FILES
        .map(f => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'))
        .join('\n;\n');
    vm.runInThisContext(src, { filename: 'crawler-bundle.js' });
}

module.exports = { loadGame, GAME_FILES, REPO_ROOT };
