// check.js — `npm run check` : vérifie la syntaxe de TOUS les fichiers sources (une seule commande au lieu de
// `node --check` fichier par fichier), puis lance la suite rapide. `npm run check -- --long` ajoute la simulation longue.
// Sortie minimale : une ligne par échec, un résumé final.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { GAME_FILES, REPO_ROOT } = require('../load_game.js');

let bad = 0;
GAME_FILES.forEach(f => {
    try { new vm.Script(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), { filename: f }); }
    catch (e) { bad++; console.log(`SYNTAXE ${f} : ${e.message}`); }
});
if (bad) { console.log(`${bad} fichier(s) avec une erreur de syntaxe.`); process.exit(1); }
console.log(`Syntaxe OK (${GAME_FILES.length} fichiers).`);

const steps = [['tests/regression.test.js']];
if (process.argv.includes('--long')) steps.push(['tests/long_playthrough.js']);
for (const [file] of steps) {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, file)], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    const lines = out.split('\n').filter(Boolean);
    // Échecs + dernières lignes (le résumé) seulement.
    console.log(lines.filter(l => /^FAIL|Error|OK|échec|invariant/i.test(l)).slice(-12).join('\n') || lines.slice(-3).join('\n'));
    if (r.status !== 0) process.exit(r.status || 1);
}
