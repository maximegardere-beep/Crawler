// bump-version.js — `npm run bump` : incrémente le `?v=N` de TOUS les <script> d'index.html (convention 4 de CLAUDE.md).
// Un seul numéro pour tous (la valeur maximale actuelle + 1) ; affiche l'ancien et le nouveau.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const nums = [...html.matchAll(/\.js\?v=(\d+)/g)].map(m => parseInt(m[1], 10));
if (nums.length === 0) { console.log('Aucun ?v= trouvé.'); process.exit(1); }
const next = Math.max(...nums) + 1;
html = html.replace(/(\.js\?v=)\d+/g, `$1${next}`);
fs.writeFileSync(file, html);
console.log(`?v= : ${Math.max(...nums)} -> ${next} (${nums.length} scripts).`);
