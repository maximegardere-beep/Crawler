// regression.test.js — suite RAPIDE (quelques secondes), à lancer avant CHAQUE push touchant
// app.js/generator.js/anomalies.js. AGRÉGATEUR depuis la Tâche 2 (voir CLAUDE.md) : le contenu vit
// dans tests/regression/*.js, regroupé par domaine — ce fichier se contente d'exécuter chaque module
// dans l'ordre ci-dessous (position de sa PREMIÈRE section dans l'ancien fichier monolithique, pour
// rester aussi proche que possible de l'ordre d'exécution d'origine) puis d'afficher le résumé final.
// Étendre une feature existante : ajouter la section au module de domaine concerné. Nouveau domaine :
// nouveau fichier dans tests/regression/, puis l'ajouter à la liste de require() ci-dessous.
// Pour un changement touchant la boucle de jeu elle-même (combat/distance/compagnon/génération
// d'étage), lancer aussi long_playthrough.js une fois.
const { counts } = require('./regression/_helpers.js');
require('./regression/meta-reset.js');
require('./regression/combat.js');
require('./regression/combat-scaling.js');
require('./regression/combat-boss.js');
require('./regression/combat-enrage.js');
require('./regression/items.js');
require('./regression/misc.js');
require('./regression/magic.js');
require('./regression/saves.js');
require('./regression/floor-transition.js');
require('./regression/necrologie.js');
require('./regression/anomalies.js');
require('./regression/urban-floors.js');
require('./regression/balance.js');
require('./regression/urban-map.js');
require('./regression/urban-shops.js');
require('./regression/urban-lairs.js');

console.log(`${counts.passed} test(s) OK, ${counts.failures} échec(s).`);
process.exit(counts.failures === 0 ? 0 : 1);
