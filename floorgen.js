// ==========================================
// GÉNÉRATION DES ÉTAGES CLASSIQUES (chantier 5 « rework de la carte », voir NOTES_CARTE.md et CHANTIERS.md)
// ==========================================
// Module PUR (aucun DOM, aucun gameState) : génère la géométrie d'un étage « borough » — 4 blocs de
// quartier (2 × 2) séparés par des avenues (une croix + un anneau). Chaque bloc est un dédale de salles
// rectangulaires reliées par des couloirs courts ; les avenues sont une zone à part entière, découpée en
// tronçons. Le moteur (generateFloorMap(), app.js) ne fait qu'habiller ce résultat (types de salles sûres,
// escalier, anomalies) : TOUT réglage de forme vit ici, dans FLOOR_LAYOUT.
//
// Plateforme flexible : ajouter un type de salle = une entrée de ROOM_TYPES (+ son effet dans enterRoom()),
// ajouter une zone = une entrée de ZONE_TYPES (+ sa table d'événements dans config.eventTables).
//
// Hasard injectable (`rng`, fonction () => [0, 1[) pour des tests et une simulation reproductibles
// (createFloorRng(seed)). Chargé avant app.js (même ordre dans index.html et tests/load_game.js).

// Réglages de forme (en cases). Changer une taille, un nombre de salles ou de boucles = une valeur ici.
const FLOOR_LAYOUT = {
    blockWidth: 21,            // Taille d'un bloc de quartier (cases), agrandie par LABYRINTHE (voir blockSize())
    blockHeight: 15,
    avenueWidth: 3,            // Largeur des avenues (croix + anneau)
    blockMargin: 1,            // Aucune salle ne touche le bord du bloc
    roomGap: 1,                // Écart minimal entre deux salles (jamais collées)
    roomsPerBlock: [12, 14],   // Salles par bloc, salle de boss et salles sûres comprises
    roomShapes: [              // Formes possibles d'une salle ordinaire (largeur × hauteur) et leur poids
        { w: 1, h: 1, weight: 2 }, { w: 2, h: 1, weight: 3 }, { w: 1, h: 2, weight: 3 },
        { w: 2, h: 2, weight: 4 }, { w: 3, h: 2, weight: 3 }, { w: 2, h: 3, weight: 2 },
        { w: 3, h: 3, weight: 1 }, { w: 4, h: 2, weight: 1 }, { w: 4, h: 3, weight: 1 }
    ],
    sizeThresholds: { M: 3, L: 7 }, // Surface (cases) à partir de laquelle une salle est M, puis L (carte)
    loopsPerBlock: [1, 3],     // Boucles COURTES ajoutées à l'arbre couvrant
    loopMaxLength: 9,          // Longueur max d'une boucle (entre centres, en cases)
    loopMinTreeHops: 3,        // Une boucle relie deux salles éloignées dans l'arbre (sinon elle ne sert à rien)
    doorsPerBlock: [2, 3],     // Portes du bloc sur les avenues
    doorMaxGap: 4,             // Une salle-porte est à au plus 4 cases du bord de son bloc
    bossMinDoorHops: 3,        // La salle de boss est au moins à 3 salles de toute porte
    startMinBossHops: 3,       // Le départ est au moins à 3 salles de toute salle de boss
    cellsPerDistanceUnit: 4,   // Conversion longueur (cases) -> unité de distance de trajet (temps, risque)
    maxBlockAttempts: 60       // Essais par bloc avant d'assouplir le nombre de salles (jamais de boucle infinie)
};

// Types de salles. `size` : forme imposée ; `perBlock` : [min, max] par bloc ; `placement` : où la placer
// (profondeur depuis les portes) ; `onEnter` : ce que le moteur fait à l'entrée (enterRoom(), app.js) ;
// `mapIcon`/`mapStyle` : rendu sur la carte.
const ROOM_TYPES = {
    normal: { key: 'normal', label: 'Salle', mapIcon: null, mapStyle: 'room', onEnter: 'event' },
    boss: { key: 'boss', label: 'Antre du boss', mapIcon: '👑', mapStyle: 'boss', size: { w: 5, h: 4 }, perBlock: [1, 1], onEnter: 'boss' },
    safe: { key: 'safe', label: 'Salle sûre', mapIcon: '🛏️', mapStyle: 'safe', maxArea: 4, perBlock: [1, 2], placement: 'middle', onEnter: 'safe' },
    // Étages urbains (chantier 12, generateMetropolis()) : la place d'une ville est une salle `normal` (cityRole
    // 'plaza'), ses ruelles aussi ('alley') ; l'auberge est une salle `safe` (repos existant).
    shop: { key: 'shop', label: 'Boutique', mapIcon: '🛒', mapStyle: 'shop', onEnter: 'shop' },
    trainer: { key: 'trainer', label: 'Professeur', mapIcon: '🎓', mapStyle: 'shop', onEnter: 'shop' },
    stairs: { key: 'stairs', label: 'Escalier', mapIcon: '🪜', mapStyle: 'boss', onEnter: 'stairs' },
    lair: { key: 'lair', label: 'Repaire', mapIcon: '💀', mapStyle: 'lair', onEnter: 'lair' }
};

// Zones. `eventTable` : clé de config.eventTables (app.js) ; `travelMult` : multiplicateur du temps ET du
// risque d'un trajet sur les couloirs de la zone ; `hunterMult` : fréquence des chasseurs de primes
// (appliquée dès config.bounty.avenueHunterMinBounty de prime).
const ZONE_TYPES = {
    block: { key: 'block', label: 'Quartier', eventTable: 'room', travelMult: 1, hunterMult: 1 },
    avenue: { key: 'avenue', label: 'Avenue', eventTable: 'avenue', travelMult: 0.5, hunterMult: 2 },
    // Étages urbains (chantier 12) : ville calme (jamais de combat), routes dangereuses, repaire en impasse.
    city: { key: 'city', label: 'Ville', eventTable: 'city', travelMult: 1, hunterMult: 1 },
    road: { key: 'road', label: 'Route', eventTable: 'road', travelMult: 1, hunterMult: 1.5 },
    lair: { key: 'lair', label: 'Repaire', eventTable: 'road', travelMult: 1, hunterMult: 1 }
};

// Réglages de forme des étages urbains (en cases, generateMetropolis()). Une ville est un carré de côté
// 2 × cityHalf centré sur sa case de grille ; la place au centre, les autres salles autour, aux angles
// INTERMÉDIAIRES (22,5° + k × 45°) pour ne jamais gêner les routes, qui partent dans les 8 directions
// principales.
const METRO_LAYOUT = {
    cityCell: 24,              // Distance entre les centres de deux villes voisines (en ligne droite)
    cityHalf: 6.5,             // Demi-côté du bloc d'une ville
    plazaSize: 3,              // Place centrale (carrée)
    roomSize: 2,               // Autres salles de la ville (carrées)
    roomRadius: 4.6,           // Distance du centre de la ville au centre d'une salle
    roomsPerCity: [3, 5],      // Salles par ville, place, auberge, boutique/professeur et escalier compris
    roadSegments: { straight: [2, 3], diagonal: [3, 4] }, // Tronçons par route
    roadWidth: 2,              // Largeur de la bande d'asphalte (rendu, zone de toucher)
    lairSize: 3,               // Repaire (carré)
    lairOffset: 4.5            // Écart du centre du repaire à l'axe de la route
};

// Les 8 directions de grille (voisins d'une ville) et les 8 angles intermédiaires des salles d'une ville.
const METRO_NEIGHBOR_OFFSETS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const METRO_ROOM_ANGLES = [0, 1, 2, 3, 4, 5, 6, 7].map(k => (22.5 + k * 45) * Math.PI / 180);

// Hasard reproductible (mulberry32) pour les tests et la simulation.
function createFloorRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fgRandInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function fgPick(rng, list) { return list[Math.floor(rng() * list.length)]; }
function fgShuffle(rng, list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function fgWeighted(rng, list) {
    const total = list.reduce((s, e) => s + e.weight, 0);
    let r = rng() * total;
    for (const e of list) { if (r < e.weight) return e; r -= e.weight; }
    return list[list.length - 1];
}

// Taille d'un bloc : LABYRINTHE (+50 % de salles) agrandit la surface d'autant, pour garder la même densité.
function blockSize(extraRoomsPct = 0, layout = FLOOR_LAYOUT) {
    const k = Math.sqrt(1 + extraRoomsPct);
    return { w: Math.round(layout.blockWidth * k), h: Math.round(layout.blockHeight * k) };
}

function roomSizeClass(w, h, layout = FLOOR_LAYOUT) {
    const area = w * h;
    return area >= layout.sizeThresholds.L ? 'L' : area >= layout.sizeThresholds.M ? 'M' : 'S';
}

function rectCenter(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

// Deux rectangles (agrandis de `gap`) se chevauchent-ils ?
function rectsOverlap(a, b, gap = 0) {
    return a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;
}

// Les segments [p1,p2] et [p3,p4] se croisent-ils (hors extrémités communes) ?
function segmentsCross(p1, p2, p3, p4) {
    const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Le segment [p, q] traverse-t-il le rectangle r (test par échantillonnage, suffisant pour des salles de
// quelques cases) ?
function segmentHitsRect(p, q, r) {
    const steps = 24;
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    return false;
}

function fgDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Nombre de salles (sauts) entre `from` et toutes les autres, sur une liste d'adjacence { id: [id…] }.
function hopDistances(adjacency, fromIds) {
    const dist = {};
    const queue = [];
    fromIds.forEach(id => { dist[id] = 0; queue.push(id); });
    while (queue.length > 0) {
        const id = queue.shift();
        (adjacency[id] || []).forEach(n => {
            if (dist[n] === undefined) { dist[n] = dist[id] + 1; queue.push(n); }
        });
    }
    return dist;
}

// ---------- Géométrie globale : blocs et avenues ----------
// Borough = 3 avenues verticales (anneau gauche, croix, anneau droit) × 3 horizontales ; les 9
// intersections sont les carrefours, les 12 portions entre deux carrefours sont les tronçons (salles de la
// zone avenue). Bloc (c, r) = entre les avenues verticales c et c+1 et horizontales r et r+1.
function computeBoroughGeometry(extraRoomsPct = 0, layout = FLOOR_LAYOUT) {
    const { w: bw, h: bh } = blockSize(extraRoomsPct, layout);
    const aw = layout.avenueWidth;
    const colX = i => i * (bw + aw);   // bord gauche de l'avenue verticale i
    const rowY = j => j * (bh + aw);   // bord haut de l'avenue horizontale j
    const blocks = [];
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            blocks.push({ index: r * 2 + c, col: c, row: r, x: colX(c) + aw, y: rowY(r) + aw, w: bw, h: bh });
        }
    }
    const intersections = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) intersections.push({ i, j, x: colX(i), y: rowY(j), w: aw, h: aw });
    const segments = [];
    for (let j = 0; j < 3; j++) {
        for (let c = 0; c < 2; c++) {
            segments.push({ id: `av_h${j}_${c}`, dir: 'h', ends: [[c, j], [c + 1, j]], x: colX(c) + aw, y: rowY(j), w: bw, h: aw });
        }
    }
    for (let i = 0; i < 3; i++) {
        for (let r = 0; r < 2; r++) {
            segments.push({ id: `av_v${i}_${r}`, dir: 'v', ends: [[i, r], [i, r + 1]], x: colX(i), y: rowY(r) + aw, w: aw, h: bh });
        }
    }
    return { width: colX(2) + aw, height: rowY(2) + aw, blockWidth: bw, blockHeight: bh, avenueWidth: aw, blocks, intersections, segments };
}

// Tronçon d'avenue qui longe le côté `side` du bloc (c, r).
function segmentForBlockSide(block, side) {
    const { col: c, row: r } = block;
    if (side === 'left') return `av_v${c}_${r}`;
    if (side === 'right') return `av_v${c + 1}_${r}`;
    if (side === 'top') return `av_h${r}_${c}`;
    return `av_h${r + 1}_${c}`;
}

// Distance (cases) d'une salle au côté `side` de son bloc.
function gapToBlockSide(room, block, side) {
    if (side === 'left') return room.x - block.x;
    if (side === 'right') return block.x + block.w - (room.x + room.w);
    if (side === 'top') return room.y - block.y;
    return block.y + block.h - (room.y + room.h);
}

// ---------- Un bloc de quartier ----------
// Renvoie { rooms: [{ localId, x, y, w, h, type }], edges: [[a, b]], doors: [{ room, side }], bossIndex }
// ou null si les garde-fous échouent (le générateur réessaie).
function tryGenerateBlock(block, targetRooms, rng, layout) {
    const m = layout.blockMargin;
    const inner = { x: block.x + m, y: block.y + m, w: block.w - 2 * m, h: block.h - 2 * m };
    const rooms = [];
    const fits = r => r.x >= inner.x && r.y >= inner.y && r.x + r.w <= inner.x + inner.w && r.y + r.h <= inner.y + inner.h
        && rooms.every(o => !rectsOverlap(r, o, layout.roomGap + 0.001));

    // 1. Salle de boss d'abord (grande, forme imposée).
    const bossShape = ROOM_TYPES.boss.size;
    let placedBoss = false;
    for (let t = 0; t < 40 && !placedBoss; t++) {
        const r = { x: inner.x + fgRandInt(rng, 0, inner.w - bossShape.w), y: inner.y + fgRandInt(rng, 0, inner.h - bossShape.h), w: bossShape.w, h: bossShape.h, type: 'boss' };
        if (fits(r)) { rooms.push(r); placedBoss = true; }
    }
    if (!placedBoss) return null;

    // 2. Salles ordinaires, jamais collées.
    for (let t = 0; t < 600 && rooms.length < targetRooms; t++) {
        const shape = fgWeighted(rng, layout.roomShapes);
        const r = { x: inner.x + fgRandInt(rng, 0, inner.w - shape.w), y: inner.y + fgRandInt(rng, 0, inner.h - shape.h), w: shape.w, h: shape.h, type: 'normal' };
        if (fits(r)) rooms.push(r);
    }
    if (rooms.length < targetRooms) return null;
    rooms.forEach((r, i) => { r.localId = i; r.c = rectCenter(r); });

    // 3. Couloirs : arbre couvrant minimal (Prim, distance entre centres — un arbre couvrant euclidien
    // ne se croise jamais lui-même), en évitant qu'un couloir traverse une autre salle.
    const edges = [];
    const blocked = (a, b) => rooms.some(o => o !== a && o !== b && segmentHitsRect(a.c, b.c, o));
    const inTree = new Set([0]);
    while (inTree.size < rooms.length) {
        let best = null;
        for (const i of inTree) {
            for (let j = 0; j < rooms.length; j++) {
                if (inTree.has(j)) continue;
                const d = fgDistance(rooms[i].c, rooms[j].c) * (blocked(rooms[i], rooms[j]) ? 3 : 1);
                if (!best || d < best.d) best = { i, j, d };
            }
        }
        edges.push([best.i, best.j]);
        inTree.add(best.j);
    }

    // 4. Boucles courtes : entre salles proches mais éloignées dans l'arbre, sans croiser un autre couloir
    // ni traverser une salle.
    const adjacency = () => {
        const adj = {};
        rooms.forEach(r => { adj[r.localId] = []; });
        edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
        return adj;
    };
    const loops = fgRandInt(rng, layout.loopsPerBlock[0], layout.loopsPerBlock[1]);
    const candidates = [];
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const d = fgDistance(rooms[i].c, rooms[j].c);
            if (d <= layout.loopMaxLength) candidates.push({ i, j, d });
        }
    }
    let added = 0;
    for (const cand of fgShuffle(rng, candidates)) {
        if (added >= loops) break;
        const { i, j } = cand;
        if (edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
        const hops = hopDistances(adjacency(), [i])[j];
        if (hops < layout.loopMinTreeHops) continue;
        if (blocked(rooms[i], rooms[j])) continue;
        const crosses = edges.some(([a, b]) => a !== i && a !== j && b !== i && b !== j && segmentsCross(rooms[i].c, rooms[j].c, rooms[a].c, rooms[b].c));
        if (crosses) continue;
        edges.push([i, j]);
        added++;
    }

    // 5. Portes sur les avenues : salles proches d'un bord, jamais le boss, toujours à bossMinDoorHops salles
    // au moins du boss ; de préférence sur des côtés différents.
    const adj = adjacency();
    const fromBoss = hopDistances(adj, [0]);
    const doorCount = fgRandInt(rng, layout.doorsPerBlock[0], layout.doorsPerBlock[1]);
    const doors = [];
    const used = new Set();
    for (const side of fgShuffle(rng, ['left', 'right', 'top', 'bottom'])) {
        if (doors.length >= doorCount) break;
        const options = rooms
            .filter(r => r.type !== 'boss' && !used.has(r.localId) && (fromBoss[r.localId] || 0) >= layout.bossMinDoorHops)
            .map(r => ({ r, gap: gapToBlockSide(r, block, side) }))
            .filter(o => o.gap <= layout.doorMaxGap)
            .sort((a, b) => a.gap - b.gap);
        if (options.length === 0) continue;
        const pick = options[Math.min(options.length - 1, Math.floor(rng() * Math.min(2, options.length)))];
        doors.push({ room: pick.r.localId, side, gap: pick.gap });
        used.add(pick.r.localId);
    }
    if (doors.length < layout.doorsPerBlock[0]) return null;

    // 6. Salles sûres : petites, à mi-profondeur depuis les portes (ni porte, ni boss).
    const fromDoors = hopDistances(adj, doors.map(d => d.room));
    const safeCount = fgRandInt(rng, ROOM_TYPES.safe.perBlock[0], ROOM_TYPES.safe.perBlock[1]);
    const depthOf = r => fromDoors[r.localId] || 0;
    const maxDepth = Math.max(...rooms.map(depthOf));
    const safeOptions = rooms.filter(r => r.type === 'normal' && !used.has(r.localId) && r.w * r.h <= ROOM_TYPES.safe.maxArea);
    const middle = safeOptions.filter(r => depthOf(r) >= 1 && depthOf(r) <= Math.max(1, maxDepth - 1));
    const safePool = fgShuffle(rng, middle.length >= safeCount ? middle : safeOptions);
    if (safePool.length < ROOM_TYPES.safe.perBlock[0]) return null;
    safePool.slice(0, safeCount).forEach(r => { r.type = 'safe'; });

    return { rooms, edges, doors, bossIndex: 0 };
}

function generateBlock(block, rng, extraRoomsPct, layout) {
    const [minRooms, maxRooms] = layout.roomsPerBlock;
    let target = Math.round(fgRandInt(rng, minRooms, maxRooms) * (1 + extraRoomsPct));
    for (let attempt = 0; attempt < layout.maxBlockAttempts; attempt++) {
        // Assouplissement progressif : une salle de moins tous les 15 essais ratés (jamais sous 6).
        const wanted = Math.max(6, target - Math.floor(attempt / 15));
        const result = tryGenerateBlock(block, wanted, rng, layout);
        if (result) { result.attempts = attempt + 1; return result; }
    }
    return null;
}

// ---------- Étage complet ----------
// options : { rng, districts: [4 noms], extraRoomsPct, layout }. Renvoie { geometry, quadrants, roomsById,
// startRoomId } — salles au format attendu par le moteur :
// { id, zone, quadrant, x, y, w, h, size, type, neighbors: [{ to, length, cost, kind }], visited,
//   isDoor?, doorSide? }. `length` en cases, `cost` = distance de trajet (length / cellsPerDistanceUnit ×
// travelMult de la zone du couloir), utilisée par computeDistance().
function generateBorough(options = {}) {
    const rng = options.rng || Math.random;
    const layout = options.layout || FLOOR_LAYOUT;
    const extraRoomsPct = options.extraRoomsPct || 0;
    const districtNames = options.districts || ['Quartier A', 'Quartier B', 'Quartier C', 'Quartier D'];
    const geometry = computeBoroughGeometry(extraRoomsPct, layout);
    const roomsById = {};
    const quadrants = [];

    const unitCost = (length, zone) => Math.round(length / layout.cellsPerDistanceUnit * ZONE_TYPES[zone].travelMult * 100) / 100;
    const link = (aId, bId, length, kind, zone) => {
        const len = Math.max(1, Math.round(length * 10) / 10);
        const cost = unitCost(len, zone);
        roomsById[aId].neighbors.push({ to: bId, length: len, cost, kind });
        roomsById[bId].neighbors.push({ to: aId, length: len, cost, kind });
    };

    // Avenues : un tronçon = une salle de la zone avenue ; deux tronçons qui partagent un carrefour sont voisins.
    geometry.segments.forEach(s => {
        roomsById[s.id] = { id: s.id, zone: 'avenue', quadrant: null, x: s.x, y: s.y, w: s.w, h: s.h, size: 'avenue', dir: s.dir, type: 'normal', visited: false, neighbors: [] };
    });
    for (let a = 0; a < geometry.segments.length; a++) {
        for (let b = a + 1; b < geometry.segments.length; b++) {
            const sa = geometry.segments[a], sb = geometry.segments[b];
            const shared = sa.ends.find(e => sb.ends.some(f => f[0] === e[0] && f[1] === e[1]));
            if (!shared) continue;
            const inter = geometry.intersections.find(it => it.i === shared[0] && it.j === shared[1]);
            const ic = rectCenter(inter);
            link(sa.id, sb.id, fgDistance(rectCenter(sa), ic) + fgDistance(ic, rectCenter(sb)), 'avenue', 'avenue');
        }
    }

    // Blocs de quartier.
    let totalAttempts = 0;
    geometry.blocks.forEach((block, q) => {
        const result = generateBlock(block, rng, extraRoomsPct, layout);
        if (!result) throw new Error(`floorgen : bloc ${q} impossible à générer`);
        totalAttempts += result.attempts;
        const idOf = local => `q${q}_r${local}`;
        result.rooms.forEach(r => {
            roomsById[idOf(r.localId)] = {
                id: idOf(r.localId), zone: 'block', quadrant: q, x: r.x, y: r.y, w: r.w, h: r.h,
                size: roomSizeClass(r.w, r.h, layout), type: r.type, visited: false, neighbors: []
            };
        });
        result.edges.forEach(([a, b]) => link(idOf(a), idOf(b), fgDistance(result.rooms[a].c, result.rooms[b].c), 'corridor', 'block'));
        result.doors.forEach(d => {
            const room = roomsById[idOf(d.room)];
            room.isDoor = true;
            room.doorSide = d.side;
            // Longueur de la porte : du centre de la salle au bord du bloc, puis la moitié de l'avenue.
            const reach = d.gap + (d.side === 'left' || d.side === 'right' ? room.w : room.h) / 2 + geometry.avenueWidth / 2;
            link(room.id, segmentForBlockSide(block, d.side), reach, 'door', 'block');
        });
        const roomIds = result.rooms.map(r => idOf(r.localId));
        quadrants.push({
            district: districtNames[q],
            block: { x: block.x, y: block.y, w: block.w, h: block.h, col: block.col, row: block.row },
            bossRoomId: idOf(result.bossIndex),
            entryRoomId: idOf(result.doors[0].room),
            doorRoomIds: result.doors.map(d => idOf(d.room)),
            roomIds
        });
    });

    const startRoomId = pickSafeStartRoom(roomsById, rng, layout);
    return { geometry, quadrants, roomsById, startRoomId, attempts: totalAttempts };
}

// Liste d'adjacence { id: [voisins] } d'un roomsById.
function roomsAdjacency(roomsById) {
    const adj = {};
    Object.values(roomsById).forEach(r => { adj[r.id] = r.neighbors.map(n => n.to); });
    return adj;
}

// Départ aléatoire HORS DE DANGER : une salle ordinaire ou un tronçon d'avenue, jamais une salle de boss ni
// une salle sûre, et au moins à startMinBossHops salles de toute salle de boss.
function pickSafeStartRoom(roomsById, rng = Math.random, layout = FLOOR_LAYOUT) {
    const all = Object.values(roomsById);
    const fromBoss = hopDistances(roomsAdjacency(roomsById), all.filter(r => r.type === 'boss').map(r => r.id));
    const ok = all.filter(r => r.type === 'normal' && (fromBoss[r.id] ?? Infinity) >= layout.startMinBossHops);
    const pool = ok.length > 0 ? ok : all.filter(r => r.type === 'normal');
    return fgPick(rng, pool.sort((a, b) => (a.id < b.id ? -1 : 1))).id;
}

// ---------- Étage urbain : villes explorables (chantier 12, voir NOTES_VILLES.md) ----------
// Région de grille CONNEXE par construction : chaque nouvelle ville est tirée à côté (8 directions) d'une ville
// déjà choisie ; cells[0] est la ville de départ.
function generateCityGrid(cityCount, rng = Math.random) {
    const chosen = [{ gx: 0, gy: 0 }];
    const keys = new Set(['0,0']);
    while (chosen.length < cityCount) {
        const candidates = [];
        chosen.forEach(c => METRO_NEIGHBOR_OFFSETS.forEach(([dx, dy]) => {
            const gx = c.gx + dx, gy = c.gy + dy, key = `${gx},${gy}`;
            if (!keys.has(key)) candidates.push({ gx, gy, key });
        }));
        if (candidates.length === 0) break;
        const picked = candidates[Math.floor(rng() * candidates.length)];
        chosen.push({ gx: picked.gx, gy: picked.gy });
        keys.add(picked.key);
    }
    return chosen;
}

// Routes : toutes les paires de villes voisines (8 directions), sauf qu'un carré de grille dont les DEUX
// diagonales existent n'en garde qu'une (deux routes ne se croisent jamais ; les 4 côtés du carré existent
// alors forcément, la connexité est intacte).
function cityGridRoads(cells, rng = Math.random) {
    const pairs = [];
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            const dx = Math.abs(cells[i].gx - cells[j].gx), dy = Math.abs(cells[i].gy - cells[j].gy);
            if (dx <= 1 && dy <= 1) pairs.push([i, j]);
        }
    }
    const isDiag = ([i, j]) => cells[i].gx !== cells[j].gx && cells[i].gy !== cells[j].gy;
    const squareOf = ([i, j]) => `${Math.min(cells[i].gx, cells[j].gx)},${Math.min(cells[i].gy, cells[j].gy)}`;
    const bySquare = {};
    pairs.filter(isDiag).forEach(p => { (bySquare[squareOf(p)] = bySquare[squareOf(p)] || []).push(p); });
    const dropped = new Set();
    Object.values(bySquare).forEach(list => { if (list.length > 1) dropped.add(list[Math.floor(rng() * list.length)]); });
    return pairs.filter(p => !dropped.has(p));
}

// Distance d'un point au segment [a, b].
function pointSegmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Génère un étage urbain (PUR). options : { rng, cityCount, lairCount, specializedChance (%), layout }.
 * Renvoie { kind: 'urban', geometry: { width, height, cities, roads }, roomsById, startRoomId, stairsRoomId,
 * cities: [{ id, index, gx, gy, x, y, w, h, cx, cy, role, isStairs, plazaRoomId, roomIds }], lairs: [{ id,
 * roomId, roadId }] } — salles au même format que generateBorough() (zone 'city' | 'road' | 'lair', quadrant
 * null, cityId pour une salle de ville, roadId + seg { x1, y1, x2, y2 } pour un tronçon de route).
 * La ville de l'escalier (jamais le départ) a une salle `stairs` ; un marchand et un professeur garantis (ni le
 * départ ni l'escalier), d'autres selon specializedChance ; chaque ville a sa place et son auberge.
 */
function generateMetropolis(options = {}) {
    const rng = options.rng || Math.random;
    const L = options.layout || METRO_LAYOUT;
    const cityCount = options.cityCount || 6;
    const cells = generateCityGrid(cityCount, rng);
    const roadPairs = cityGridRoads(cells, rng);
    const minGx = Math.min(...cells.map(c => c.gx)), minGy = Math.min(...cells.map(c => c.gy));
    const margin = L.cityHalf + 4;
    const cityCenter = c => ({ x: margin + (c.gx - minGx) * L.cityCell, y: margin + (c.gy - minGy) * L.cityCell });
    const roomsById = {};
    const unitCost = (length, zone) => Math.round(length / FLOOR_LAYOUT.cellsPerDistanceUnit * ZONE_TYPES[zone].travelMult * 100) / 100;
    const link = (aId, bId, length, kind, zone) => {
        const len = Math.max(1, Math.round(length * 10) / 10);
        const cost = unitCost(len, zone);
        roomsById[aId].neighbors.push({ to: bId, length: len, cost, kind });
        roomsById[bId].neighbors.push({ to: aId, length: len, cost, kind });
    };
    const addRoom = room => { roomsById[room.id] = { quadrant: null, visited: false, neighbors: [], ...room }; return roomsById[room.id]; };

    // Villes : rôles (escalier, marchand, professeur, autres).
    const cities = cells.map((c, index) => {
        const center = cityCenter(c);
        return {
            id: `city${index}`, index, gx: c.gx, gy: c.gy, cx: center.x, cy: center.y,
            x: center.x - L.cityHalf, y: center.y - L.cityHalf, w: 2 * L.cityHalf, h: 2 * L.cityHalf,
            role: null, isStairs: false, plazaRoomId: null, roomIds: [], roadDirs: []
        };
    });
    const others = fgShuffle(rng, cities.slice(1));
    const stairsCity = others[0];
    stairsCity.isStairs = true;
    const services = others.slice(1);
    if (services[0]) services[0].role = 'merchant';
    if (services[1]) services[1].role = 'trainer';
    services.slice(2).forEach(city => {
        if (rng() * 100 < (options.specializedChance || 0)) city.role = rng() < 0.5 ? 'merchant' : 'trainer';
    });
    roadPairs.forEach(([i, j]) => {
        cities[i].roadDirs.push(Math.atan2(cities[j].cy - cities[i].cy, cities[j].cx - cities[i].cx));
        cities[j].roadDirs.push(Math.atan2(cities[i].cy - cities[j].cy, cities[i].cx - cities[j].cx));
    });

    // Salles d'une ville : place au centre, puis auberge, boutique/professeur, escalier, ruelles, aux angles
    // intermédiaires tirés au hasard.
    cities.forEach(city => {
        const p = L.plazaSize, r = L.roomSize;
        const plaza = addRoom({ id: `${city.id}_plaza`, zone: 'city', cityId: city.id, cityRole: 'plaza', type: 'normal',
            x: city.cx - p / 2, y: city.cy - p / 2, w: p, h: p, size: 'M' });
        city.plazaRoomId = plaza.id;
        city.roomIds.push(plaza.id);
        const kinds = [{ type: 'safe', role: 'inn' }];
        if (city.role === 'merchant') kinds.push({ type: 'shop', role: 'merchant' });
        if (city.role === 'trainer') kinds.push({ type: 'trainer', role: 'trainer' });
        if (city.isStairs) kinds.push({ type: 'stairs', role: 'stairs' });
        const [minRooms, maxRooms] = L.roomsPerCity;
        const total = Math.max(kinds.length + 1, fgRandInt(rng, minRooms, maxRooms));
        while (kinds.length + 1 < total) kinds.push({ type: 'normal', role: 'alley' });
        const angles = fgShuffle(rng, METRO_ROOM_ANGLES);
        kinds.forEach((k, n) => {
            const a = angles[n];
            const cx = city.cx + Math.cos(a) * L.roomRadius, cy = city.cy + Math.sin(a) * L.roomRadius;
            const room = addRoom({ id: `${city.id}_${k.role}${k.role === 'alley' ? n : ''}`, zone: 'city', cityId: city.id,
                cityRole: k.role, type: k.type, x: cx - r / 2, y: cy - r / 2, w: r, h: r, size: 'S' });
            city.roomIds.push(room.id);
            link(plaza.id, room.id, fgDistance(rectCenter(plaza), rectCenter(room)), 'corridor', 'city');
        });
    });

    // Routes : bande entre les bords des deux villes, découpée en tronçons ; la porte relie la place au premier
    // tronçon (le bout de rue dans la ville est compté dans sa longueur).
    const roads = roadPairs.map(([i, j], n) => {
        const a = cities[i], b = cities[j];
        const diagonal = a.gx !== b.gx && a.gy !== b.gy;
        const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const edge = diagonal ? L.cityHalf * Math.SQRT2 : L.cityHalf;
        const start = { x: a.cx + ux * edge, y: a.cy + uy * edge }, end = { x: b.cx - ux * edge, y: b.cy - uy * edge };
        const [minSeg, maxSeg] = diagonal ? L.roadSegments.diagonal : L.roadSegments.straight;
        const count = fgRandInt(rng, minSeg, maxSeg);
        const road = { id: `road${n}`, a: a.id, b: b.id, diagonal, x1: start.x, y1: start.y, x2: end.x, y2: end.y, segmentIds: [] };
        for (let k = 0; k < count; k++) {
            const p1 = { x: start.x + (end.x - start.x) * k / count, y: start.y + (end.y - start.y) * k / count };
            const p2 = { x: start.x + (end.x - start.x) * (k + 1) / count, y: start.y + (end.y - start.y) * (k + 1) / count };
            const hw = L.roadWidth / 2;
            const seg = addRoom({ id: `${road.id}_s${k}`, zone: 'road', roadId: road.id, type: 'normal', size: 'road',
                seg: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
                x: Math.min(p1.x, p2.x) - hw, y: Math.min(p1.y, p2.y) - hw,
                w: Math.abs(p2.x - p1.x) + 2 * hw, h: Math.abs(p2.y - p1.y) + 2 * hw });
            road.segmentIds.push(seg.id);
            if (k > 0) link(road.segmentIds[k - 1], seg.id, fgDistance(rectCenter(roomsById[road.segmentIds[k - 1]]), rectCenter(seg)), 'road', 'road');
        }
        const first = roomsById[road.segmentIds[0]], last = roomsById[road.segmentIds[count - 1]];
        link(a.plazaRoomId, first.id, fgDistance(rectCenter(roomsById[a.plazaRoomId]), rectCenter(first)), 'door', 'road');
        link(b.plazaRoomId, last.id, fgDistance(rectCenter(roomsById[b.plazaRoomId]), rectCenter(last)), 'door', 'road');
        return road;
    });

    // Repaires : une salle en impasse accrochée au milieu d'un tronçon, sur le côté de la route, jamais sur une
    // ville, une autre route ou un autre repaire.
    const lairs = [];
    const lairCount = Math.min(options.lairCount || 0, roads.length);
    const clearOf = rect => cities.every(c => !rectsOverlap(rect, c, 1))
        && roads.every(rd => pointSegmentDistance(rectCenter(rect), { x: rd.x1, y: rd.y1 }, { x: rd.x2, y: rd.y2 }) > L.lairSize / 2 + L.roadWidth)
        && lairs.every(l => !rectsOverlap(rect, roomsById[l.roomId], 1));
    const roadOrder = fgShuffle(rng, roads);
    for (let t = 0; t < roadOrder.length * 2 && lairs.length < lairCount; t++) {
        const road = roadOrder[t % roadOrder.length];
        if (lairs.some(l => l.roadId === road.id)) continue;
        const segId = road.segmentIds[Math.floor(road.segmentIds.length / 2)];
        const seg = roomsById[segId];
        const c = rectCenter(seg);
        const len = Math.hypot(road.x2 - road.x1, road.y2 - road.y1);
        const nx = -(road.y2 - road.y1) / len, ny = (road.x2 - road.x1) / len;
        const side = (t < roadOrder.length ? 1 : -1) * (rng() < 0.5 ? 1 : -1);
        const s = L.lairSize;
        const lc = { x: c.x + nx * L.lairOffset * side, y: c.y + ny * L.lairOffset * side };
        const rect = { x: lc.x - s / 2, y: lc.y - s / 2, w: s, h: s };
        if (!clearOf(rect)) continue;
        const id = `lair${lairs.length}`;
        addRoom({ id: `${id}_room`, zone: 'lair', type: 'lair', lairId: id, roadId: road.id, size: 'M', ...rect });
        link(segId, `${id}_room`, fgDistance(c, lc), 'door', 'lair');
        lairs.push({ id, roomId: `${id}_room`, roadId: road.id });
    }

    const all = Object.values(roomsById);
    const width = Math.max(...all.map(r => r.x + r.w)) + margin / 2;
    const height = Math.max(...all.map(r => r.y + r.h)) + margin / 2;
    cities.forEach(c => { delete c.roadDirs; });
    const stairsRoom = all.find(r => r.type === 'stairs');
    return {
        kind: 'urban',
        geometry: { width, height, cities, roads },
        cities, lairs, roomsById,
        startRoomId: cities[0].plazaRoomId,
        stairsRoomId: stairsRoom ? stairsRoom.id : null
    };
}

// Mesures pures d'un étage urbain (tests, npm run sim:floors) : connexité, tronçons par route, salles par
// ville, chevauchements (salles d'une même ville, repaires), temps de trajet départ -> escalier.
function measureMetropolis(floor) {
    const rooms = Object.values(floor.roomsById);
    const adj = roomsAdjacency(floor.roomsById);
    const reach = hopDistances(adj, [floor.startRoomId]);
    let overlaps = 0;
    floor.cities.forEach(c => {
        for (let i = 0; i < c.roomIds.length; i++) for (let j = i + 1; j < c.roomIds.length; j++) {
            if (rectsOverlap(floor.roomsById[c.roomIds[i]], floor.roomsById[c.roomIds[j]], 0)) overlaps++;
        }
    });
    let roadCrossings = 0;
    const roads = floor.geometry.roads;
    for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
        const a = roads[i], b = roads[j];
        if (segmentsCross({ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 })) roadCrossings++;
    }
    const dist = {};
    const queue = [[floor.startRoomId, 0]];
    dist[floor.startRoomId] = 0;
    while (queue.length) {
        queue.sort((x, y) => x[1] - y[1]);
        const [id, d] = queue.shift();
        if (d > dist[id]) continue;
        floor.roomsById[id].neighbors.forEach(n => {
            const nd = d + n.cost;
            if (dist[n.to] === undefined || nd < dist[n.to]) { dist[n.to] = nd; queue.push([n.to, nd]); }
        });
    }
    return {
        rooms: rooms.length,
        cities: floor.cities.length,
        roomsPerCity: floor.cities.map(c => c.roomIds.length),
        segmentsPerRoad: roads.map(r => r.segmentIds.length),
        lairs: floor.lairs.length,
        overlaps,
        roadCrossings,
        connected: rooms.every(r => reach[r.id] !== undefined),
        stairsCost: floor.stairsRoomId ? Math.round(dist[floor.stairsRoomId] * 10) / 10 : null,
        stairsHops: floor.stairsRoomId ? reach[floor.stairsRoomId] : null
    };
}

// ---------- Mesures (tests, npm run sim:floors) ----------
// Mesures pures d'un étage généré : salles par bloc, culs-de-sac, degré max, profondeur du boss depuis les
// portes, portes par bloc, croisements de couloirs, connexité.
function measureBorough(floor) {
    const rooms = Object.values(floor.roomsById);
    const adj = roomsAdjacency(floor.roomsById);
    const reach = hopDistances(adj, [floor.startRoomId]);
    const blockRooms = rooms.filter(r => r.zone === 'block');
    const perBlock = floor.quadrants.map(q => q.roomIds.length);
    const deadEnds = blockRooms.filter(r => r.neighbors.length === 1).length;
    const bossDoorHops = floor.quadrants.map(q => {
        const d = hopDistances(adj, q.doorRoomIds);
        return d[q.bossRoomId];
    });
    let crossings = 0;
    floor.quadrants.forEach(q => {
        const segs = [];
        q.roomIds.forEach(id => floor.roomsById[id].neighbors.forEach(n => {
            if (n.kind === 'corridor' && id < n.to) segs.push([rectCenter(floor.roomsById[id]), rectCenter(floor.roomsById[n.to]), id, n.to]);
        }));
        for (let i = 0; i < segs.length; i++) {
            for (let j = i + 1; j < segs.length; j++) {
                const [a1, a2, ia, ib] = segs[i], [b1, b2, ja, jb] = segs[j];
                if (ia === ja || ia === jb || ib === ja || ib === jb) continue;
                if (segmentsCross(a1, a2, b1, b2)) crossings++;
            }
        }
    });
    const duplicateEdges = rooms.reduce((n, r) => n + (r.neighbors.length - new Set(r.neighbors.map(e => e.to)).size), 0);
    const overlaps = floor.quadrants.reduce((n, q) => {
        let k = 0;
        for (let i = 0; i < q.roomIds.length; i++) for (let j = i + 1; j < q.roomIds.length; j++) {
            if (rectsOverlap(floor.roomsById[q.roomIds[i]], floor.roomsById[q.roomIds[j]], 0)) k++;
        }
        return n + k;
    }, 0);
    return {
        rooms: rooms.length,
        perBlock,
        deadEndPct: Math.round(deadEnds / blockRooms.length * 100),
        maxDegree: Math.max(...blockRooms.map(r => r.neighbors.length)),
        bossDoorHops,
        doorsPerBlock: floor.quadrants.map(q => q.doorRoomIds.length),
        safePerBlock: floor.quadrants.map(q => q.roomIds.filter(id => floor.roomsById[id].type === 'safe').length),
        crossings,
        duplicateEdges,
        overlaps,
        connected: rooms.every(r => reach[r.id] !== undefined),
        startBossHops: Math.min(...floor.quadrants.map(q => hopDistances(adj, [q.bossRoomId])[floor.startRoomId]))
    };
}

if (typeof module !== 'undefined') {
    module.exports = {
        FLOOR_LAYOUT, ROOM_TYPES, ZONE_TYPES, createFloorRng, generateBorough, computeBoroughGeometry,
        measureBorough, pickSafeStartRoom, roomSizeClass, segmentsCross, rectsOverlap, hopDistances, roomsAdjacency,
        METRO_LAYOUT, generateMetropolis, measureMetropolis, generateCityGrid, cityGridRoads
    };
}
