// load-order.js — tests régression : index.html et tests/load_game.js (GAME_FILES) chargent les MÊMES fichiers dans le MÊME ordre
// (le moteur est découpé en engine/*.js : un oubli dans l'un des deux casserait le jeu ou les tests sans bruit), avec un seul `?v=`.
const fs = require('fs');
const path = require('path');
const { assert } = require('./_helpers.js');
const { GAME_FILES, REPO_ROOT } = require('../load_game.js');

{
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"?]+)\?v=(\d+)"/g)];
    const files = scripts.map(m => m[1]);
    assert(JSON.stringify(files) === JSON.stringify(GAME_FILES), `index.html et GAME_FILES : mêmes fichiers, même ordre (index.html : ${files.length}, GAME_FILES : ${GAME_FILES.length})`);
    assert(new Set(scripts.map(m => m[2])).size === 1, "index.html : un seul numéro ?v= pour tous les scripts");
    assert(GAME_FILES[GAME_FILES.length - 1] === 'app.js', "app.js (initialisation) est chargé en dernier");
    const missing = GAME_FILES.filter(f => !fs.existsSync(path.join(REPO_ROOT, f)));
    assert(missing.length === 0, `Tous les fichiers de GAME_FILES existent (manquants : ${missing.join(', ')})`);
    const engineOnDisk = fs.readdirSync(path.join(REPO_ROOT, 'engine')).filter(f => f.endsWith('.js')).map(f => 'engine/' + f);
    const orphan = engineOnDisk.filter(f => !GAME_FILES.includes(f));
    assert(orphan.length === 0, `Aucun fichier engine/*.js oublié dans GAME_FILES (oubliés : ${orphan.join(', ')})`);
}
