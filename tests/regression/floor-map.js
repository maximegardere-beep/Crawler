// floor-map.js — tests régression : étages classiques du chantier 5 « rework de la carte » (voir
// NOTES_CARTE.md) — générateur pur floorgen.js (borough : 4 blocs + avenues), branchement moteur
// (generateFloorMap(), distance réelle, table d'événements par zone, chasseurs sur les avenues, sauvegarde
// versionnée), voyage sur carte (travelToRoom(), M1) et exploration depuis la carte (P1), repères.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = original; }
}

function freshFloor() {
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    gameState.timeLeft = 100;
    return gameState.floorMap;
}

// --- Générateur pur : forme et garde-fous, sur plusieurs graines ---
{
    let allOk = true, details = '';
    for (let seed = 1; seed <= 25; seed++) {
        const floor = generateBorough({ rng: createFloorRng(seed) });
        const m = measureBorough(floor);
        const ok = m.connected && m.overlaps === 0 && m.crossings === 0 && m.duplicateEdges === 0
            && m.perBlock.every(n => n >= 12 && n <= 14)
            && m.bossDoorHops.every(h => h >= FLOOR_LAYOUT.bossMinDoorHops)
            && m.doorsPerBlock.every(n => n >= 2 && n <= 3)
            && m.safePerBlock.every(n => n >= 1 && n <= 2)
            && m.startBossHops >= FLOOR_LAYOUT.startMinBossHops;
        if (!ok && allOk) details = ` (graine ${seed} : ${JSON.stringify(m)})`;
        allOk = allOk && ok;
    }
    assert(allOk, `generateBorough() : connexe, sans chevauchement ni couloir croisé ni doublon, 12-14 salles, 2-3 portes, 1-2 salles sûres par bloc, boss à 3 salles des portes, départ loin des boss${details}`);

    const a = generateBorough({ rng: createFloorRng(42) });
    const b = generateBorough({ rng: createFloorRng(42) });
    assert(JSON.stringify(a.roomsById) === JSON.stringify(b.roomsById), "generateBorough() : même graine, même étage (hasard injectable)");

    const rooms = Object.values(a.roomsById);
    const avenues = rooms.filter(r => r.zone === 'avenue');
    assert(avenues.length === 12 && avenues.every(r => r.quadrant === null), "12 tronçons d'avenue (croix + anneau), hors de tout quartier");
    assert(a.quadrants.length === 4 && a.quadrants.every(q => a.roomsById[q.bossRoomId].type === 'boss' && a.roomsById[q.bossRoomId].size === 'L'), "4 blocs, chacun avec sa grande salle de boss");
    assert(a.quadrants.every(q => q.doorRoomIds.every(id => a.roomsById[id].isDoor && a.roomsById[id].neighbors.some(e => e.kind === 'door' && a.roomsById[e.to].zone === 'avenue'))),
        "Chaque porte relie une salle du bloc à une avenue");
    assert(rooms.filter(r => r.zone === 'block').every(r => r.neighbors.filter(e => e.kind === 'door').length === (r.isDoor ? 1 : 0)), "Seules les salles-portes touchent une avenue");
    assert(!rooms.some(r => r.type === 'boss' && r.isDoor), "Jamais de porte dans une salle de boss");
    const avenueEdge = avenues[0].neighbors.find(e => e.kind === 'avenue');
    assert(Math.abs(avenueEdge.cost - avenueEdge.length / FLOOR_LAYOUT.cellsPerDistanceUnit * ZONE_TYPES.avenue.travelMult) < 0.02, "Coût d'un couloir d'avenue = longueur × 0,5 (plus rapide et plus sûr)");
    const corridor = rooms.find(r => r.zone === 'block').neighbors.find(e => e.kind === 'corridor');
    assert(Math.abs(corridor.cost - corridor.length / FLOOR_LAYOUT.cellsPerDistanceUnit) < 0.02, "Coût d'un couloir de bloc = longueur réelle");
    assert(['S', 'M', 'L'].every(sz => rooms.some(r => r.size === sz)), "Salles de 3 tailles (S / M / L) pour la carte");

    const laby = generateBorough({ rng: createFloorRng(42), extraRoomsPct: 0.5 });
    assert(laby.quadrants.every(q => q.roomIds.length >= 17), "LABYRINTHE : +50 % de salles par bloc");
    assert(laby.geometry.blockWidth > a.geometry.blockWidth, "LABYRINTHE : blocs agrandis d'autant");
}

// --- generateFloorMap() : habillage moteur ---
{
    const fm = freshFloor();
    const rooms = Object.values(fm.roomsById);
    const start = fm.roomsById[fm.currentRoomId];
    assert(fm.version === FLOOR_MAP_VERSION && !!fm.geometry, "floorMap au nouveau format (version + géométrie pour la carte)");
    assert(start.visited && start.type === 'normal' && fm.startRoomId === start.id, "Départ : une salle ordinaire (ou une avenue) déjà visitée");
    assert(gameState.currentDistrict === fm.quadrants[fm.currentQuadrant].district, "Quartier courant aligné sur le bloc de départ (ou le plus proche)");
    assert(rooms.filter(r => r.guardsStairs).length === 1 && rooms.find(r => r.guardsStairs).type === 'boss', "Un seul gardien d'escalier, un boss de bloc");
    assert(rooms.filter(r => r.type === 'safe').every(r => r.safehouse && r.safehouse.name), "Chaque salle sûre a son thème (safehouses.js)");
    assert(new Set(fm.quadrants.map(q => q.district)).size === 4, "4 quartiers distincts");

    gameState.anomalyEffects.cafetRoom = true;
    generateFloorMap();
    const cafet = Object.values(gameState.floorMap.roomsById).filter(r => r.cafetRoom);
    assert(cafet.length === 1 && cafet[0].zone === 'block' && cafet[0].type === 'normal' && cafet[0].id !== gameState.floorMap.startRoomId, "CAFET_ASSOMBRIE : une salle ordinaire d'un bloc, jamais le départ");
    gameState.anomalyEffects.cafetRoom = false;
}

// --- Distance réelle ---
{
    const fm = freshFloor();
    const ids = Object.keys(fm.roomsById);
    const a = ids[3], b = ids[40];
    assert(computeDistance(a, a) === 0, "computeDistance() : 0 vers soi-même");
    assert(computeDistance(a, b) === computeDistance(b, a) && computeDistance(a, b) > 0, "computeDistance() : symétrique et positive");
    const path = computeFloorPath(a, b);
    assert(path.rooms[0] === a && path.rooms[path.rooms.length - 1] === b, "computeFloorPath() : chemin de bout en bout");
}

// --- Table d'événements par zone, chasseurs ×2 sur les avenues ---
{
    const sum = t => Object.values(t).reduce((x, y) => x + y, 0);
    assert(sum(config.chances) === 100 && sum(config.avenueChances) === 100, "Tables d'événements salles / avenues : 100 % chacune");
    assert(Object.keys(config.avenueChances).join() === Object.keys(config.chances).join(), "Même clés, même ordre dans les deux tables");
    const fm = freshFloor();
    const avenue = Object.values(fm.roomsById).find(r => r.zone === 'avenue');
    const block = Object.values(fm.roomsById).find(r => r.zone === 'block' && r.type === 'normal');
    fm.currentRoomId = avenue.id;
    assert(getZoneEventTable() === config.avenueChances, "Sur une avenue : table des avenues");
    // Rencontre sur avenue : 12 % de combats (contre 25) et 12 % de crawlers (contre 3).
    let combats = 0;
    const originalStealth = handleStealthEncounter;
    handleStealthEncounter = () => { combats++; };
    withRandom(0.55, () => resolveCardEvent()); // d100 = 55 : combat dans les salles (37-62), trésor sur une avenue (52-56)
    fm.currentRoomId = block.id;
    assert(getZoneEventTable() === config.chances, "Dans un bloc : table des salles");
    withRandom(0.55, () => resolveCardEvent());
    handleStealthEncounter = originalStealth;
    assert(combats === 1, "Même jet (55) : combat dans une salle, pas sur une avenue");

    resetTransientState();
    generateFloorMap();
    gameState.bounty.value = config.bounty.tiers.hunters;
    gameState.bounty.combatsSinceHunter = 99;
    const fm2 = gameState.floorMap;
    const r15 = (config.bounty.encounterChance.hunters * 1.5) / 100; // entre 1× et 2× la chance de base
    fm2.currentRoomId = Object.values(fm2.roomsById).find(r => r.zone === 'block').id;
    assert(withRandom(r15, () => maybeSpawnBountyHunter()) === null, "Dans un bloc : chance de chasseur normale");
    fm2.currentRoomId = Object.values(fm2.roomsById).find(r => r.zone === 'avenue').id;
    const hunter = withRandom(r15, () => maybeSpawnBountyHunter());
    assert(!!hunter && hunter.isBountyHunter, "Sur une avenue : chasseurs deux fois plus fréquents");
    gameState.bounty = createEmptyBounty();
    gameState.pendingBountySquad = 0;
}

// --- Voyage sur carte (M1) et exploration depuis la carte (P1) ---
{
    const fm = freshFloor();
    const start = fm.roomsById[fm.currentRoomId];
    const seenNeighbor = start.neighbors.map(e => fm.roomsById[e.to]).find(r => !r.visited && r.type === 'normal');
    assert(isRoomSeen(seenNeighbor), "Une salle voisine du départ est « aperçue »");
    const far = Object.values(fm.roomsById).find(r => !r.visited && !isRoomSeen(r));
    assert(planTravelToRoom(far.id) === null && travelToRoom(far.id) === null, "Salle inconnue et non aperçue : pas de voyage possible");
    assert(planTravelToRoom(start.id) === null, "Pas de voyage vers la salle courante");

    const plan = planTravelToRoom(seenNeighbor.id);
    assert(plan.exploreStep && plan.viaRoomId === start.id && plan.timeCost === 0, "Salle aperçue voisine : un simple pas d'exploration");
    const t0 = gameState.timeLeft;
    // Événement « rien » (Math.random haut pour la table… 0.01 = Silence)
    withRandom(0.01, () => travelToRoom(seenNeighbor.id));
    assert(gameState.floorMap.currentRoomId === seenNeighbor.id && seenNeighbor.visited, "P1 : on entre dans la salle aperçue choisie");
    assert(gameState.timeLeft === t0 - 1, "P1 voisin : coûte un pas d'exploration (-1 H)");

    // Revenir au départ (salle visitée) : voyage M1, arrivée par enterRoom().
    const t1 = gameState.timeLeft;
    const back = withRandom(0.99, () => travelToRoom(start.id)); // 0.99 : aucune embuscade
    assert(back && !back.exploreStep && gameState.floorMap.currentRoomId === start.id, "M1 : voyage vers une salle visitée");
    assert(gameState.timeLeft === t1 - back.timeCost && back.timeCost >= 1, "M1 : coûte du temps selon la distance");
    assert(gameState.pendingTravel === null, "M1 : trajet terminé");

    // Salle aperçue loin de soi : trajet jusqu'à la salle visitée voisine, puis le pas dans l'inconnu.
    const beyond = seenNeighbor.neighbors.map(e => gameState.floorMap.roomsById[e.to]).find(r => !r.visited && r.type !== 'boss' && r.type !== 'safe');
    if (beyond) {
        const planFar = planTravelToRoom(beyond.id);
        assert(planFar.exploreStep && planFar.viaRoomId === seenNeighbor.id && planFar.timeCost >= 1, "P1 lointain : trajet jusqu'à la salle voisine connue");
        withRandom(0.99, () => travelToRoom(beyond.id));
        assert(gameState.floorMap.currentRoomId === beyond.id && beyond.visited, "P1 lointain : puis le pas dans la salle aperçue, en un seul geste");
    }

    // Le chemin ne passe que par des salles visitées.
    const fm2 = freshFloor();
    const visited = [fm2.currentRoomId];
    let cur = fm2.roomsById[fm2.currentRoomId];
    for (let i = 0; i < 3; i++) {
        const next = cur.neighbors.map(e => fm2.roomsById[e.to]).find(r => !r.visited);
        if (!next) break;
        next.visited = true; visited.push(next.id); cur = next;
    }
    const target = fm2.roomsById[visited[visited.length - 1]];
    const p = computeFloorPath(fm2.currentRoomId, target.id, id => fm2.roomsById[id].visited);
    assert(p && p.rooms.every(id => fm2.roomsById[id].visited), "Le trajet ne traverse que des salles visitées");
    const plan2 = planTravelToRoom(target.id);
    assert(Math.abs(plan2.distance - Math.round(p.cost * 10) / 10) < 1e-9, "planTravelToRoom() : distance du chemin connu");

    // Plus rien d'inconnu autour : explore() file vers la salle aperçue la plus proche.
    const fm3 = freshFloor();
    const here = fm3.roomsById[fm3.currentRoomId];
    here.neighbors.forEach(e => { fm3.roomsById[e.to].visited = true; });
    const expected = findNearestSeenRoom();
    assert(!!expected && isRoomSeen(fm3.roomsById[expected]), "findNearestSeenRoom() : une salle aperçue");
    withRandom(0.99, () => explore());
    const now = fm3.roomsById[gameState.floorMap.currentRoomId];
    assert(now.visited && now.id !== here.id && gameState.pendingTravel === null, "explore() sans voisin inconnu : trajet puis pas dans l'inconnu");
}

// --- Repères de la carte (anciens « Lieux connus ») ---
{
    const fm = freshFloor();
    assert(listFloorLandmarks().length === 0, "Aucun repère au départ");
    const boss = Object.values(fm.roomsById).find(r => r.type === 'boss' && !r.guardsStairs);
    const stairs = Object.values(fm.roomsById).find(r => r.guardsStairs);
    const safe = Object.values(fm.roomsById).find(r => r.type === 'safe');
    boss.visited = true; safe.visited = true; stairs.visited = true;
    const marks = listFloorLandmarks();
    assert(marks.some(m => m.roomId === boss.id && m.kind === 'boss'), "Boss repéré : 👑");
    assert(marks.some(m => m.roomId === stairs.id && m.kind === 'stairsGuarded'), "Escalier gardé repéré");
    assert(marks.some(m => m.roomId === safe.id && m.kind === 'safe'), "Salle sûre visitée");
    boss.defeated = true; stairs.defeated = true;
    const after = listFloorLandmarks();
    assert(!after.some(m => m.roomId === boss.id) && after.some(m => m.roomId === stairs.id && m.kind === 'stairs'), "Boss vaincu : repère retiré ; gardien vaincu : 🪜 escalier libre");
    assert(floorRoomLabel(safe) === safe.safehouse.name, "Libellé d'une salle repérée : son repère");
}

// --- Sauvegarde d'un format de carte antérieur : l'étage est regénéré ---
{
    resetTransientState();
    localStorage.clear();
    gameState.currentFloor = 4;
    generateFloorMap();
    gameState.playerName = "Carte Ancienne";
    gameState.saveEnabled = true;
    saveGame();
    gameState.saveEnabled = false;
    const key = saveKeyForName("Carte Ancienne");
    const saved = JSON.parse(localStorage.getItem(key));
    saved.floorMap = { quadrants: [], roomsById: { q0_r0: { id: 'q0_r0', neighbors: [] } }, currentRoomId: 'q0_r0', currentQuadrant: 0, stairsQuadrant: 0 };
    localStorage.setItem(key, JSON.stringify(saved));
    gameState.floorMap = null;
    assert(restoreSaveForName("Carte Ancienne") === true, "Restauration d'une sauvegarde à l'ancienne carte");
    assert(gameState.floorMap.version === FLOOR_MAP_VERSION && gameState.currentFloor === 4, "Ancienne carte : étage regénéré au nouveau format, même numéro d'étage");
    gameState.saveEnabled = false;
    localStorage.clear();
}
