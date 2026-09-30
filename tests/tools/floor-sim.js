// Outil de calibrage (jamais lancé par la CI) : génère des centaines d'étages avec floorgen.js et affiche
// les mêmes mesures que le diagnostic du chantier 5 (voir NOTES_CARTE.md). `npm run sim:floors [n] [labyrinthe]`,
// ou `npm run sim:floors [n] urbain` pour les étages urbains (chantier 12, voir NOTES_VILLES.md).
const { generateBorough, measureBorough, createFloorRng, generateMetropolis, measureMetropolis } = require('../../floorgen.js');

const count = parseInt(process.argv[2], 10) || 500;
const extra = process.argv[3] === 'labyrinthe' ? 0.5 : 0;

if (process.argv[3] === 'urbain') {
    const u = { rooms: [], perCity: [], segments: [], cost: [], hops: [], lairs: [], ms: [] };
    let crossings = 0, overlaps = 0, disconnected = 0, failures = 0;
    for (let i = 0; i < count; i++) {
        const t0 = Date.now();
        let floor;
        const floorNumber = [3, 6, 9, 12, 15, 18][i % 6];
        try {
            floor = generateMetropolis({ rng: createFloorRng(1000 + i), cityCount: 6 + Math.floor(floorNumber / 9), lairCount: floorNumber === 18 ? 2 : 1, specializedChance: 18 });
        } catch (e) { failures++; continue; }
        u.ms.push(Date.now() - t0);
        const m = measureMetropolis(floor);
        u.rooms.push(m.rooms); u.perCity.push(...m.roomsPerCity); u.segments.push(...m.segmentsPerRoad);
        u.cost.push(m.stairsCost); u.hops.push(m.stairsHops); u.lairs.push(m.lairs);
        crossings += m.roadCrossings; overlaps += m.overlaps; if (!m.connected) disconnected++;
    }
    const stat = (a) => {
        const s = [...a].sort((x, y) => x - y);
        return `moy ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} · min ${s[0]} · max ${s[s.length - 1]}`;
    };
    console.log(`${count} étages urbains — échecs : ${failures}, non connexes : ${disconnected}, chevauchements : ${overlaps}, routes croisées : ${crossings}`);
    console.log(`Salles / étage       : ${stat(u.rooms)}`);
    console.log(`Salles / ville       : ${stat(u.perCity)}`);
    console.log(`Tronçons / route     : ${stat(u.segments)}`);
    console.log(`Repaires / étage     : ${stat(u.lairs)}`);
    console.log(`Départ → escalier    : ${stat(u.cost)} (distance de trajet) · ${stat(u.hops)} (salles)`);
    console.log(`Temps (ms)           : ${stat(u.ms)}`);
    process.exit(0);
}
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
