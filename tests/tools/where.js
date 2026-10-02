// where.js — `npm run where -- nom [nom2 …]` : où est défini ce symbole ? (fichier:ligne + signature)
// Remplace une série de Grep/Read dans engine/*.js, generator.js, scene.js… : une seule commande, quelques lignes de sortie.
// Cherche function nom / const nom / let nom (au début de ligne) dans les fichiers de GAME_FILES, puis les usages (compte seulement).
const fs = require('fs');
const path = require('path');
const { GAME_FILES, REPO_ROOT } = require('../load_game.js');

const names = process.argv.slice(2);
if (names.length === 0) { console.log('Usage : npm run where -- nomDeFonction [autre …]'); process.exit(1); }

const sources = GAME_FILES.map(f => ({ f, lines: fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').split('\n') }));
for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const def = new RegExp(`^(?:async\\s+)?(?:function\\s+${esc}\\b|(?:const|let|var)\\s+${esc}\\b)`);
    const use = new RegExp(`\\b${esc}\\b`);
    let found = 0, uses = 0;
    for (const { f, lines } of sources) {
        lines.forEach((line, i) => {
            if (def.test(line)) { found++; console.log(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`); }
            else if (use.test(line)) uses++;
        });
    }
    if (!found) console.log(`${name} : aucune définition de premier niveau trouvée (${uses} mention(s))`);
    else console.log(`  (${uses} autre(s) mention(s))`);
}
