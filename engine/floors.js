// engine/floors.js — Carte d'étage (borough), étages urbains, repaires.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// 4. CARTE DE L'ÉTAGE (BOROUGH : 4 BLOCS DE QUARTIER + AVENUES)
// ==========================================
// Chantier 5 « rework de la carte » (voir NOTES_CARTE.md) : la géométrie vient du générateur PUR
// floorgen.js (generateBorough()) — 4 blocs de quartier (2 × 2) séparés par des avenues (croix +
// anneau), des salles rectangulaires reliées par des couloirs courts, 2-3 portes par bloc sur les
// avenues. Ici, on ne fait qu'habiller ce résultat pour le jeu : quartiers tirés, types de salles sûres,
// escalier, anomalies. Le reste du jeu ne voit l'étage qu'à travers roomsById / neighbors / type /
// visited, computeDistance() et enterRoom().

// Version du format de gameState.floorMap : une sauvegarde d'un format plus ancien ne peut pas reprendre
// son étage (voir restoreSaveForName()).
const FLOOR_MAP_VERSION = 2;

// Salle courante de l'étage classique (null hors étage classique).
function currentFloorRoom() {
    const fm = gameState.floorMap;
    return fm ? fm.roomsById[fm.currentRoomId] || null : null;
}

// Zone de la salle (ZONE_TYPES, floorgen.js) : 'block' ou 'avenue'.
function roomZone(room) {
    return (room && room.zone) || 'block';
}

// Quartier d'une salle : celui de son bloc ; une avenue n'appartient à aucun quartier.
function roomDistrict(room) {
    const fm = gameState.floorMap;
    if (fm && fm.kind === 'urban') return fm.theme; // Étage urbain : un seul thème pour tout l'étage
    if (!fm || !room || room.quadrant === null || room.quadrant === undefined) return null;
    return fm.quadrants[room.quadrant] ? fm.quadrants[room.quadrant].district : null;
}

// Se place dans une salle de l'étage. Le quartier courant (décor, mobs) suit le bloc où l'on se trouve ;
// sur une avenue, on garde le dernier quartier traversé. Renvoie vrai si le quartier vient de changer.
function moveToFloorRoom(room) {
    const fm = gameState.floorMap;
    fm.currentRoomId = room.id;
    if (room.cityId) fm.currentCityId = room.cityId; // Étage urbain : dernière ville traversée
    if (room.quadrant === null || room.quadrant === undefined || room.quadrant === fm.currentQuadrant) return false;
    fm.currentQuadrant = room.quadrant;
    gameState.currentDistrict = fm.quadrants[room.quadrant].district;
    return true;
}

// Génère l'étage classique : 4 quartiers distincts tirés au hasard, un bloc chacun ; l'escalier est gardé
// par le boss de l'un des 4 blocs ; départ aléatoire hors de danger (voir pickSafeStartRoom(), floorgen.js).
function generateFloorMap() {
    const pool = [...Object.keys(districts)];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // LABYRINTHE (anomalies.js) : +50 % de salles par bloc (bloc agrandi d'autant, même densité).
    const floor = generateBorough({ districts: pool.slice(0, 4), extraRoomsPct: gameState.anomalyEffects.extraRoomsPct || 0 });
    const { roomsById, quadrants } = floor;

    Object.values(roomsById).forEach(room => {
        if (room.type === 'safe') room.safehouse = pickSafehouseType();
    });

    const stairsQuadrant = Math.floor(Math.random() * 4);
    roomsById[quadrants[stairsQuadrant].bossRoomId].guardsStairs = true;

    // Départ : si c'est un tronçon d'avenue, le quartier « courant » (décor, mobs) est celui du bloc le
    // plus proche, jusqu'au premier bloc traversé.
    const start = roomsById[floor.startRoomId];
    let startQuadrant = start.quadrant;
    if (startQuadrant === null) {
        const hops = hopDistances(roomsAdjacency(roomsById), [start.id]);
        const nearest = Object.values(roomsById)
            .filter(r => r.zone === 'block')
            .sort((a, b) => (hops[a.id] - hops[b.id]) || (a.id < b.id ? -1 : 1))[0];
        startQuadrant = nearest.quadrant;
    }

    gameState.floorMap = {
        version: FLOOR_MAP_VERSION,
        geometry: floor.geometry,
        quadrants,
        roomsById,
        stairsQuadrant,
        currentQuadrant: startQuadrant,
        currentRoomId: start.id,
        startRoomId: start.id
    };
    start.visited = true;
    gameState.currentDistrict = quadrants[startQuadrant].district;

    // CAFET_ASSOMBRIE (anomalies.js) : une salle ordinaire d'un bloc au hasard (jamais le départ, un boss ou
    // une salle sûre) cache un piège sévère + un trésor nettement supérieur — voir enterRoom().
    if (gameState.anomalyEffects.cafetRoom) {
        const candidates = Object.values(roomsById).filter(r => r.type === 'normal' && r.zone === 'block' && r.id !== start.id);
        if (candidates.length > 0) {
            candidates[Math.floor(Math.random() * candidates.length)].cafetRoom = true;
        }
    }
}

// Distance de trajet (Dijkstra) entre deux salles de l'étage, tous quartiers et avenues confondus : somme
// des `cost` des couloirs empruntés — longueur réelle du couloir convertie en unités de trajet, × 0,5 sur les
// avenues (ZONE_TYPES.avenue.travelMult, floorgen.js), plus rapides et plus sûres. Le temps et le risque
// d'embuscade d'un trajet en dépendent (voir travelToRoom()). Arrondie au dixième. null si aucun chemin
// (ne devrait pas arriver, l'étage est connexe par construction).
function computeDistance(fromRoomId, toRoomId) {
    if (fromRoomId === toRoomId) return 0;
    const path = computeFloorPath(fromRoomId, toRoomId);
    return path ? Math.round(path.cost * 10) / 10 : null;
}

// Plus court chemin (Dijkstra sur les `cost`) : { cost, rooms: [ids, départ et arrivée compris] } ou null.
// `canPass(id)` limite les salles intermédiaires (ex. seulement les salles visitées, voir planTravelToRoom()).
function computeFloorPath(fromRoomId, toRoomId, canPass = null) {
    const roomsById = gameState.floorMap.roomsById;
    const dist = { [fromRoomId]: 0 };
    const prev = {};
    const visited = new Set();

    while (true) {
        let currentId = null;
        let currentCost = Infinity;
        for (const id in dist) {
            if (!visited.has(id) && dist[id] < currentCost) {
                currentCost = dist[id];
                currentId = id;
            }
        }
        if (currentId === null) return null;
        if (currentId === toRoomId) {
            const rooms = [toRoomId];
            while (rooms[0] !== fromRoomId) rooms.unshift(prev[rooms[0]]);
            return { cost: currentCost, rooms };
        }

        visited.add(currentId);
        const room = roomsById[currentId];
        if (!room) continue;
        room.neighbors.forEach(edge => {
            // `canPass` (optionnel) : salles traversables en chemin (la destination l'est toujours).
            if (canPass && edge.to !== toRoomId && !canPass(edge.to)) return;
            const weight = edge.cost !== undefined ? edge.cost : (edge.kind === 'artery' ? 1 : 2);
            const newCost = currentCost + weight;
            if (dist[edge.to] === undefined || newCost < dist[edge.to]) {
                dist[edge.to] = newCost;
                prev[edge.to] = currentId;
            }
        });
    }
}

// ==========================================
// ÉTAGES URBAINS : VILLES EXPLORABLES (multiples de 3 — chantier 12, voir NOTES_VILLES.md)
// ==========================================
// Géométrie PURE dans floorgen.js (generateMetropolis()) : villes de 3 à 5 salles (place, auberge, boutique
// ou professeur, escalier, ruelles), routes découpées en tronçons explorés pas à pas, repaires en impasse.
// L'étage passe ensuite par EXACTEMENT la même machinerie qu'un étage classique : gameState.floorMap
// (kind 'urban'), travelToRoom()/performExploreStep()/enterRoom(), carte stylisée floormap.js.

// Noms de villes génériques, piochés sans répétition à chaque génération d'étage urbain.
const URBAN_CITY_NAMES = [
    "Vieille Ville", "Quartier Nord", "Quartier Sud", "Zone Industrielle", "Cité-Dortoir",
    "Centre Commercial Abandonné", "Faubourg", "Le Ghetto", "Quartier des Affaires",
    "Banlieue Résidentielle", "Port Fluvial", "Terminus"
];

// Vrai sur un étage urbain (villes et routes).
function isUrbanFloor() {
    const fm = gameState.floorMap;
    return !!(fm && fm.kind === 'urban');
}

// Ville d'une salle urbaine (null pour une route, un repaire ou hors étage urbain).
function roomCity(room) {
    const fm = gameState.floorMap;
    return fm && fm.citiesById && room && room.cityId ? fm.citiesById[room.cityId] || null : null;
}

// Ville par identifiant (boutique ou professeur en cours de visite, voir triggerShopEncounter()).
function urbanCityById(cityId) {
    const fm = gameState.floorMap;
    return fm && fm.citiesById && cityId ? fm.citiesById[cityId] || null : null;
}

// Génère l'étage urbain : réseau de villes (generateMetropolis(), floorgen.js), puis habillage de jeu — noms
// des villes, spécialité du marchand / du professeur, thème de chaque auberge, gardien de l'escalier (ou de
// la Sortie à l'étage final, toujours gardée), état des repaires. Départ sur la place de la première ville.
function generateUrbanFloorMap() {
    const floor = gameState.currentFloor;
    const isFinal = floor === config.urbanFloors.finalFloor;
    const theme = config.urbanFloors.themes[floor] || config.urbanFloors.themes[3];
    const metro = generateMetropolis({
        cityCount: 6 + Math.floor(floor / 9), // Légère croissance avec la profondeur
        lairCount: isFinal ? config.urbanFloors.lairRoadsFinalFloor : config.urbanFloors.lairRoadsPerFloor,
        specializedChance: config.urbanFloors.specializedCityChance,
        arcadeCount: config.urbanFloors.arcadeCitiesMin + Math.floor(Math.random() * (config.urbanFloors.arcadeCitiesMax - config.urbanFloors.arcadeCitiesMin + 1))
    });
    const namePool = [...URBAN_CITY_NAMES];
    const citiesById = {};
    metro.cities.forEach((city, i) => {
        city.name = namePool.splice(Math.floor(Math.random() * namePool.length), 1)[0] || `Secteur ${i + 1}`;
        city.specialty = city.role === 'merchant' ? pick(['weapons', 'ranged', 'armors', 'scrolls'])
            : city.role === 'trainer' ? pick(['weapon', 'unarmed', 'magic', 'stealth']) : null;
        city.stock = null; // Stock du marchand : généré une seule fois, à la première visite (triggerShopEncounter())
        city.visited = false;
        citiesById[city.id] = city;
    });
    const roomsById = metro.roomsById;
    const guardChance = config.urbanFloors.stairsGuardChanceByFloor[floor] || 50;
    Object.values(roomsById).forEach(room => {
        if (room.type === 'safe') room.safehouse = pickSafehouseType(); // Auberge : même repos qu'une salle sûre
        if (room.type === 'stairs') {
            room.isExit = isFinal;
            room.guardsStairs = true;
            room.guarded = isFinal || Math.random() * 100 < guardChance; // La Sortie est toujours gardée
            room.bossInstance = null;
            room.defeated = false;
        }
    });
    const lairsById = {};
    metro.lairs.forEach(l => {
        lairsById[l.id] = { ...l, cleared: false, combatsRemaining: 2 + Math.floor(Math.random() * 2), bossInstance: null };
    });
    const start = roomsById[metro.startRoomId];
    gameState.floorMap = {
        kind: 'urban',
        version: FLOOR_MAP_VERSION,
        theme,
        isFinalFloor: isFinal,
        geometry: { width: metro.geometry.width, height: metro.geometry.height, roads: metro.geometry.roads },
        quadrants: [],
        roomsById,
        citiesById,
        lairsById,
        currentQuadrant: null,
        currentRoomId: start.id,
        startRoomId: start.id,
        currentCityId: start.cityId
    };
    start.visited = true;
    citiesById[start.cityId].visited = true;
    // Thématique unique de l'étage : generateMob()/generateBoss() la reçoivent comme un nom de quartier.
    gameState.currentDistrict = theme;
}

// Entrée dans une salle d'un étage urbain (appelée par enterRoom()) : renvoie vrai si la salle a été gérée
// ici (place, boutique, professeur, escalier, repaire), faux pour l'auberge, les ruelles et les tronçons
// de route, qui suivent le comportement commun (repos, événement de la zone, chemin connu).
function enterUrbanRoom(room, firstVisit) {
    const city = roomCity(room);
    if (city) {
        gameState.floorMap.currentCityId = city.id;
        city.visited = true;
    }
    if (room.type === 'stairs') {
        enterUrbanStairs(room);
        return true;
    }
    if ((room.type === 'shop' || room.type === 'trainer') && city) {
        triggerShopEncounter(city);
        return true;
    }
    if (room.type === 'arcade' && city) {
        triggerArcade(city);
        return true;
    }
    if (room.type === 'lair') {
        enterLair(room);
        return true;
    }
    if (room.cityRole === 'plaza' && city) {
        setSceneHeader('🏙️', city.name, 'Ville sûre', { key: 'citySafe', cityName: city.name });
        logEvent(
            firstVisit
                ? `Vous découvrez ${city.name}. Les rues sont calmes ici — vous pouvez souffler.`
                : `Vous retrouvez la place de ${city.name}, toujours aussi tranquille.`,
            "success"
        );
        return true;
    }
    return false;
}

// Salle de l'escalier (ou de la Sortie) au fond de sa ville : gardien à combattre ou à laisser pour plus
// tard (même choix qu'un boss de quartier, triggerBossEncounter()), sinon escalier libre (choix Descendre /
// Rester) ou victoire immédiate pour la Sortie de l'étage final.
function enterUrbanStairs(room) {
    if (room.guarded && !room.defeated) {
        triggerBossEncounter(room);
        return;
    }
    if (room.isExit) {
        logEvent("La Sortie est là, grande ouverte.", "info");
        winGame();
        return;
    }
    logEvent("La voie est libre !", "success");
    offerStairsChoice({ kind: 'room', roomId: room.id });
}

// Montant volé par un pickpocket (pure) : config.pickpocket.pct % des PO, au moins `min`, au plus `max`,
// jamais plus que ce qu'on a.
function computePickpocketLoss(gold) {
    const cfg = config.pickpocket;
    if (!gold || gold <= 0) return 0;
    return Math.min(gold, Math.max(cfg.min, Math.min(cfg.max, Math.round(gold * cfg.pct / 100))));
}

// ==========================================
// REPAIRES (impasses accrochées à une route, voir generateMetropolis())
// ==========================================

// Entrée dans un repaire : choix plonger / ressortir, ou repaire déjà nettoyé.
function enterLair(room) {
    const lair = gameState.floorMap.lairsById[room.lairId];
    if (!lair || lair.cleared) {
        setSceneHeader('🏆', 'Repaire Nettoyé', 'Route', 'emptyLair');
        logEvent("Le repaire est désert : vous l'avez déjà nettoyé.", "normal");
        return;
    }
    triggerLairChoice(lair);
}

// Présente le choix "plonger / ressortir". Toujours optionnel : ressortir laisse le repaire intact, il sera
// reproposé au prochain passage.
function triggerLairChoice(lair) {
    gameState.lairChoicePending = true;
    gameState.pendingLairId = lair.id;
    setSceneHeader('💀', 'Repaire', 'Route', 'lairSpotted');
    logEvent("Un repaire hostile s'ouvre au bord de la route. Plonger dedans (combats enchaînés, butin garanti), ou ressortir sans l'affronter ?", "danger");
    ui.lairChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Plonger" : lance le premier combat forcé de la séquence (voir winCombat() pour
// l'enchaînement combats → boss → butin garanti, et attemptFlee() pour une fuite en cours de route).
function diveIntoLair() {
    const lairId = gameState.pendingLairId;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    ui.lairChoiceZone.classList.add('hidden');
    const lair = gameState.floorMap && gameState.floorMap.lairsById[lairId];
    if (!lair) return;

    gameState.pendingLairDive = { lairId, combatsLeft: lair.combatsRemaining, stage: 'trash' };
    logEvent("Vous plongez dans le repaire...", "danger");
    initiateCombat();
}

// Bouton "Ressortir" : le repaire reste intact (reproposé au prochain passage).
function declineLair() {
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    ui.lairChoiceZone.classList.add('hidden');
    setSceneHeader('💀', 'Repaire', 'Route', 'lairSpotted');
    logEvent("Vous ressortez du repaire sans bruit. Il vous attendra.", "info");
    updateUI();
}
