// Outil de calibrage (jamais lancé par la CI) : génère des centaines d'étages avec floorgen.js et affiche
// les mêmes mesures que le diagnostic du chantier 5 (voir NOTES_CARTE.md). `npm run sim:floors [n] [labyrinthe]`.
const { generateBorough, measureBorough, createFloorRng } = require('../../floorgen.js');

const count = parseInt(process.argv[2], 10) || 500;
const extra = process.argv[3] === 'labyrinthe' ? 0.5 : 0;
const acc = { rooms: [], perBlock: [], deadEnd: [], maxDegree: [], bossDoorHops: [], doors: [], safe: [], attempts: [], startBoss: [], ms: [] };
let crossings = 0, duplicates = 0, overlaps = 0, disconnected = 0, failures = 0;

for (let i = 0; i < count; i++) {
    const t0 = Date.now();
    let floor;
    try { floor = generateBorough({ rng: createFloorRng(1000 + i), extraRoomsPct: extra }); } catch (e) { failures++; continue; }
    acc.ms.push(Date.now() - t0);
    const m = measureBorough(floor);
    acc.rooms.push(m.rooms); acc.perBlock.push(...m.perBlock); acc.deadEnd.push(m.deadEndPct); acc.maxDegree.push(m.maxDegree);
    acc.bossDoorHops.push(...m.bossDoorHops); acc.doors.push(...m.doorsPerBlock); acc.safe.push(...m.safePerBlock);
    acc.attempts.push(floor.attempts); acc.startBoss.push(m.startBossHops);
    crossings += m.crossings; duplicates += m.duplicateEdges; overlaps += m.overlaps; if (!m.connected) disconnected++;
}

const stat = (a) => {
    if (a.length === 0) return '—';
    const s = [...a].sort((x, y) => x - y);
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return `moy ${mean.toFixed(1)} · min ${s[0]} · max ${s[s.length - 1]}`;
};
console.log(`${count} étages${extra ? ' (LABYRINTHE)' : ''} — échecs : ${failures}, non connexes : ${disconnected}, chevauchements : ${overlaps}, couloirs croisés : ${crossings}, doublons : ${duplicates}`);
console.log(`Salles / étage      : ${stat(acc.rooms)}`);
console.log(`Salles / bloc       : ${stat(acc.perBlock)}`);
console.log(`Culs-de-sac (%)     : ${stat(acc.deadEnd)}`);
console.log(`Degré max           : ${stat(acc.maxDegree)}`);
console.log(`Boss ← portes (sauts): ${stat(acc.bossDoorHops)}`);
console.log(`Portes / bloc       : ${stat(acc.doors)}`);
console.log(`Salles sûres / bloc : ${stat(acc.safe)}`);
console.log(`Départ ← boss (sauts): ${stat(acc.startBoss)}`);
console.log(`Essais / étage      : ${stat(acc.attempts)}`);
console.log(`Temps (ms)          : ${stat(acc.ms)}`);
