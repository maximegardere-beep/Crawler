// demon-access.js — tests régression : chantier 17, lot 1 (accès à Gorgoth le Concierge) — salle de la porte
// colossale au carrefour central des étages classiques (floorgen.js), clés = boss de quartier vaincus
// (demonKeysCount()), branches de la porte dans enterRoom(), scellage (sealDemonGate()), badge #keys-status,
// repères de carte, migration de sauvegarde (FLOOR_MAP_VERSION 3) et Sortie de l'étage 18 (startDemonFight()
// du lot 2, simulé ici par un faux installé puis retiré).
const { assert, resetTransientState } = require('./_helpers.js');

function captureLog(fn) {
    const lines = [];
    const original = logEvent;
    logEvent = (m) => { lines.push(String(m)); };
    try { fn(); } finally { logEvent = original; }
    return lines;
}

// Faux startDemonFight() (lot 2) : enregistre ses appels, retiré à la fin quoi qu'il arrive.
function withFakeDemonFight(fn) {
    const had = Object.prototype.hasOwnProperty.call(global, 'startDemonFight');
    const previous = global.startDemonFight;
    const calls = [];
    global.startDemonFight = (opts) => { calls.push(opts); };
    try { fn(calls); } finally {
        if (had) global.startDemonFight = previous; else delete global.startDemonFight;
    }
}

// Tant que le lot 2 n'est pas fusionné, startDemonFight n'existe pas : on teste aussi le repli. Une fois fusionné,
// on le masque le temps du test de repli.
function withoutDemonFight(fn) {
    const had = Object.prototype.hasOwnProperty.call(global, 'startDemonFight');
    const previous = global.startDemonFight;
    if (had) global.startDemonFight = undefined;
    try { fn(); } finally { if (had) global.startDemonFight = previous; }
}

function freshClassicFloor(floor = 1) {
    resetTransientState();
    gameState.currentFloor = floor;
    generateFloorMap();
    gameState.timeLeft = 100;
    return gameState.floorMap;
}

function defeatBosses(fm, n) {
    fm.quadrants.slice(0, n).forEach(q => { fm.roomsById[q.bossRoomId].defeated = true; });
}

// --- Générateur pur : une porte au carrefour central, sur 25 graines ---
{
    const problems = [];
    for (let seed = 1; seed <= 25; seed++) {
        const floor = generateBorough({ rng: createFloorRng(seed) });
        const gate = floor.roomsById[BOROUGH_GATE_ROOM_ID];
        const center = floor.geometry.intersections.find(it => it.i === 1 && it.j === 1);
        const rooms = Object.values(floor.roomsById);
        if (!gate) { problems.push(`${seed}: pas de porte`); continue; }
        if (floor.gateRoomId !== BOROUGH_GATE_ROOM_ID) problems.push(`${seed}: gateRoomId absent`);
        if (gate.type !== 'gate' || gate.zone !== 'gate' || gate.quadrant !== null) problems.push(`${seed}: type/zone/quadrant`);
        if (gate.x !== center.x || gate.y !== center.y || gate.w !== center.w || gate.h !== center.h) problems.push(`${seed}: géométrie hors carrefour central`);
        const linked = gate.neighbors.map(n => n.to).sort().join(',');
        if (linked !== 'av_h1_0,av_h1_1,av_v1_0,av_v1_1') problems.push(`${seed}: voisins ${linked}`);
        if (!gate.neighbors.every(n => n.kind === 'avenue' && floor.roomsById[n.to].neighbors.some(e => e.to === gate.id))) problems.push(`${seed}: couloirs non avenue ou non réciproques`);
        if (rooms.filter(r => r.zone === 'avenue').length !== 12) problems.push(`${seed}: avenues != 12`);
        if (rooms.filter(r => r.type === 'gate').length !== 1) problems.push(`${seed}: plusieurs portes`);
        if (floor.startRoomId === gate.id) problems.push(`${seed}: départ sur la porte`);
        const m = measureBorough(floor);
        if (!m.connected || m.gateLinks !== 4) problems.push(`${seed}: mesure ${JSON.stringify({ c: m.connected, g: m.gateLinks })}`);
    }
    assert(problems.length === 0, `generateBorough() : une porte colossale (zone gate) au carrefour central, reliée aux 4 tronçons, jamais départ (${problems.join(' ; ')})`);

    const a = generateBorough({ rng: createFloorRng(7) });
    const b = generateBorough({ rng: createFloorRng(7) });
    assert(JSON.stringify(a.roomsById[BOROUGH_GATE_ROOM_ID]) === JSON.stringify(b.roomsById[BOROUGH_GATE_ROOM_ID]), "Porte colossale : même graine, même porte");
    const edge = a.roomsById[BOROUGH_GATE_ROOM_ID].neighbors[0];
    assert(Math.abs(edge.cost - edge.length / FLOOR_LAYOUT.cellsPerDistanceUnit * ZONE_TYPES.gate.travelMult) < 0.02 && ZONE_TYPES.gate.travelMult === ZONE_TYPES.avenue.travelMult, "Porte : trajet aussi rapide qu'une avenue");
    assert(ROOM_TYPES.gate && ROOM_TYPES.gate.onEnter === 'gate' && !!ROOM_TYPES.gate.mapIcon && !!ROOM_TYPES.gate.mapStyle, "ROOM_TYPES.gate : icône, style de carte, entrée 'gate'");
    assert(pickSafeStartRoom({ [BOROUGH_GATE_ROOM_ID]: { id: BOROUGH_GATE_ROOM_ID, type: 'gate', neighbors: [] }, x: { id: 'x', type: 'normal', neighbors: [] } }, () => 0) === 'x', "pickSafeStartRoom() ne choisit jamais la porte");
}

// --- Moteur : clés, zone, libellé ---
{
    const fm = freshClassicFloor();
    assert(fm.version === FLOOR_MAP_VERSION && FLOOR_MAP_VERSION === 3, "FLOOR_MAP_VERSION passe à 3 (porte colossale)");
    const gate = demonGateRoom();
    assert(gate && gate.id === BOROUGH_GATE_ROOM_ID && fm.startRoomId !== gate.id, "generateFloorMap() : la porte existe et n'est jamais le départ");
    assert(demonKeysCount() === 0, "Aucune clé en début d'étage");
    defeatBosses(fm, 2);
    assert(demonKeysCount() === 2, "Deux boss de quartier vaincus : 2 clés");
    defeatBosses(fm, 4);
    assert(demonKeysCount() === 4, "Quatre boss vaincus (gardien d'escalier compris) : 4 clés");
    fm.currentRoomId = gate.id;
    assert(getZoneEventTable() === config.avenueChances, "Zone gate : table d'événements des avenues (calme)");
    assert(/Porte colossale/.test(floorRoomLabel(gate)), "Libellé de la porte sur la carte");
    assert(demonKeysCount({ floorMap: { kind: 'urban', quadrants: [], roomsById: {} } }) === 0 && demonKeysCount({ floorMap: null }) === 0, "Aucune clé sur un étage urbain ni sans carte");
}

// --- Clé annoncée à la victoire sur un boss de quartier (winCombat()) ---
{
    const fm = freshClassicFloor();
    const q = fm.quadrants[0];
    gameState.inCombat = true;
    gameState.currentEnemy = generateMob(q.district);
    gameState.pendingBossRoomId = q.bossRoomId;
    let lines = captureLog(() => winCombat());
    assert(lines.some(l => l.includes('🗝️ Clé 1/4')), `winCombat() : boss de quartier vaincu → « 🗝️ Clé 1/4 » (${lines.join(' | ')})`);
    gameState.inCombat = true;
    gameState.currentEnemy = generateMob(q.district);
    gameState.pendingBossRoomId = null;
    lines = captureLog(() => winCombat());
    assert(!lines.some(l => l.includes('🗝️')), "winCombat() : un combat ordinaire ne donne aucune clé");
    resetTransientState();
}

// --- Branches de la porte dans enterRoom() ---
{
    let fm = freshClassicFloor();
    let gate = demonGateRoom();
    defeatBosses(fm, 1);
    let lines = [];
    withFakeDemonFight(calls => {
        lines = captureLog(() => enterRoom(gate));
        assert(calls.length === 0, "Moins de 4 clés : aucun combat lancé");
    });
    assert(lines.some(l => l.includes('Quatre serrures. Tu as 1 clé. Le Concierge ne fait pas crédit.')), `Moins de 4 clés : message sarcastique (${lines.join(' | ')})`);
    assert(gate.visited && !isActionBlocked(), "La porte fermée ne bloque rien");

    defeatBosses(fm, 4);
    withoutDemonFight(() => { lines = captureLog(() => enterRoom(gate)); });
    assert(lines.some(l => l.includes('Bientôt')) && !isActionBlocked(), "4 clés sans combat du lot 2 : la porte s'entrouvre puis se referme, rien de bloqué");

    withFakeDemonFight(calls => {
        captureLog(() => enterRoom(gate));
        assert(calls.length === 1 && calls[0].final === false, "4 clés : startDemonFight({ final: false })");
    });

    sealDemonGate();
    assert(gameState.demonGateSealedFloor === gameState.currentFloor && isDemonGateSealed(), "sealDemonGate() rescelle la porte pour l'étage courant");
    withFakeDemonFight(calls => {
        lines = captureLog(() => enterRoom(gate));
        assert(calls.length === 0 && lines.some(l => l.includes('Fermé pour l')), "Porte rescellée : message, aucun combat");
    });
    assert(listFloorLandmarks().find(m => m.roomId === gate.id).icon === '⛓️', "Repère ⛓️ de la porte rescellée");
    gameState.currentFloor += 1;
    assert(!isDemonGateSealed(), "Le scellage ne vaut que pour son étage");
    gameState.currentFloor -= 1;

    // Gorgoth déjà assommé sur cet étage (gameState.demon, lot 2) : antre vide.
    fm = freshClassicFloor();
    gate = demonGateRoom();
    defeatBosses(fm, 4);
    const hadDemon = Object.prototype.hasOwnProperty.call(gameState, 'demon');
    const previousDemon = gameState.demon;
    gameState.demon = Object.assign({}, previousDemon || {}, { lastFloorFought: gameState.currentFloor });
    try {
        withFakeDemonFight(calls => {
            lines = captureLog(() => enterRoom(gate));
            assert(calls.length === 0 && lines.some(l => l.includes("L'antre est vide")), "Gorgoth déjà mis au tapis sur cet étage : antre vide, aucun combat");
        });
    } finally {
        if (hadDemon) gameState.demon = previousDemon; else delete gameState.demon;
    }
    resetTransientState();
}

// --- Repères et carte ---
{
    const fm = freshClassicFloor();
    const gate = demonGateRoom();
    // Le départ peut tomber sur une avenue voisine de la porte : on repart d'une carte où seule une salle de bloc est visitée.
    Object.values(fm.roomsById).forEach(r => { r.visited = false; });
    const blockRoom = Object.values(fm.roomsById).find(r => r.zone === 'block' && r.type === 'normal');
    blockRoom.visited = true;
    fm.currentRoomId = blockRoom.id;
    assert(!listFloorLandmarks().some(m => m.roomId === gate.id), "Porte inconnue : aucun repère");
    fm.roomsById['av_h1_0'].visited = true;
    let mark = listFloorLandmarks().find(m => m.roomId === gate.id);
    assert(mark && mark.icon === '🔒', "Porte aperçue, moins de 4 clés : repère 🔒");
    defeatBosses(fm, 4);
    mark = listFloorLandmarks().find(m => m.roomId === gate.id);
    assert(mark && mark.icon === '🚪', "4 clés : repère 🚪");
    const svg = buildFloorMapSvg(fm, { landmarks: listFloorLandmarks() });
    assert(svg.includes(`data-room-id="${gate.id}"`) && svg.includes('floor-map-gate'), "Carte : la porte aperçue est dessinée et touchable");
    const c = { x: (gate.x + gate.w / 2) * FLOOR_MAP_CELL, y: (gate.y + gate.h / 2) * FLOOR_MAP_CELL };
    assert(floorMapHitTest(fm, c.x, c.y) === gate.id, "floorMapHitTest() : toucher la porte la sélectionne");
    fm.currentRoomId = 'av_h1_0';
    const plan = planTravelToRoom(gate.id);
    assert(!!plan && plan.exploreStep, "La porte aperçue se rejoint depuis la carte (pas d'exploration)");
    assert(demonVignette('vignetteQuiNExistePas') === undefined && demonVignette('demonGateLocked') === (EXPLORE_VIGNETTES.demonGateLocked ? 'demonGateLocked' : undefined), "demonVignette() : nom seulement si la vignette existe");
}

// --- Badge #keys-status ---
{
    const fm = freshClassicFloor();
    updateKeysStatusUI();
    assert(ui.keysStatus.classList.contains('hidden'), "Badge clés masqué sans clé");
    defeatBosses(fm, 2);
    updateKeysStatusUI();
    assert(!ui.keysStatus.classList.contains('hidden') && ui.keysStatus.innerText === '🗝️ 2/4' && /porte colossale/i.test(ui.keysStatus.title), "Badge clés : 🗝️ 2/4 avec explication");
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    updateKeysStatusUI();
    assert(ui.keysStatus.classList.contains('hidden'), "Badge clés masqué sur un étage urbain");
    resetTransientState();
}

// --- Sauvegarde : migration et carte d'un format antérieur ---
{
    freshClassicFloor(4);
    localStorage.clear();
    gameState.playerName = "Porteur De Clés";
    gameState.saveEnabled = true;
    saveGame();
    gameState.saveEnabled = false;
    const key = saveKeyForName("Porteur De Clés");
    const saved = JSON.parse(localStorage.getItem(key));
    delete saved.demonGateSealedFloor;
    saved.floorMap.version = 2;
    delete saved.floorMap.roomsById[BOROUGH_GATE_ROOM_ID];
    localStorage.setItem(key, JSON.stringify(saved));
    gameState.demonGateSealedFloor = 9;
    assert(restoreSaveForName("Porteur De Clés") === true, "Restauration d'une sauvegarde d'avant le chantier 17");
    assert(gameState.demonGateSealedFloor === 0, "Migration : demonGateSealedFloor absent → 0");
    assert(gameState.floorMap.version === FLOOR_MAP_VERSION && !!demonGateRoom() && gameState.currentFloor === 4, "Carte v2 classique : étage regénéré avec sa porte colossale");

    // Étage urbain v2 : format inchangé, simplement remis à la version courante (ni regénéré, ni changé en étage classique).
    resetTransientState();
    gameState.currentFloor = 6;
    generateUrbanFloorMap();
    gameState.playerName = "Citadin";
    gameState.saveEnabled = true;
    saveGame();
    gameState.saveEnabled = false;
    const ukey = saveKeyForName("Citadin");
    const usaved = JSON.parse(localStorage.getItem(ukey));
    usaved.floorMap.version = 2;
    const cityIds = Object.keys(usaved.floorMap.citiesById).sort().join(',');
    localStorage.setItem(ukey, JSON.stringify(usaved));
    assert(restoreSaveForName("Citadin") === true && isUrbanFloor() && gameState.floorMap.version === FLOOR_MAP_VERSION
        && Object.keys(gameState.floorMap.citiesById).sort().join(',') === cityIds, "Étage urbain v2 : gardé tel quel, jamais remplacé par un étage classique");
    gameState.saveEnabled = false;
    localStorage.clear();
    resetTransientState();
}

// --- Étage 18 : la Sortie appelle startDemonFight({ final: true }) si le combat existe ---
{
    const setupFinal = () => {
        resetTransientState();
        gameState.hasWon = false;
        gameState.currentFloor = config.urbanFloors.finalFloor;
        generateUrbanFloorMap();
        return Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    };
    let exit = setupFinal();
    assert(exit && exit.isExit && exit.guarded, "Étage final : Sortie gardée");
    withFakeDemonFight(calls => {
        captureLog(() => enterUrbanStairs(exit));
        assert(calls.length === 1 && calls[0].final === true && typeof calls[0].onVictory === 'function' && !gameState.bossChoicePending, "Sortie : startDemonFight({ final: true, onVictory }) à la place du gardien");
        captureLog(() => calls[0].onVictory());
        assert(gameState.hasWon && exit.defeated, "Victoire sur Gorgoth en forme finale : winGame()");
        captureLog(() => enterUrbanStairs(exit));
        assert(calls.length === 1, "Partie déjà gagnée : aucun nouveau combat");
    });
    exit = setupFinal();
    withoutDemonFight(() => captureLog(() => enterUrbanStairs(exit)));
    assert(gameState.bossChoicePending && !!exit.bossInstance, "Sans combat du lot 2 : gardien habituel de la Sortie (inchangé)");
    gameState.hasWon = false;
    gameState.inCombat = false;
    if (ui.winOverlay) ui.winOverlay.classList.add('hidden');
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
}
