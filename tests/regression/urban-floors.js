// urban-floors.js — tests régression : étages urbains (multiples de 3) en villes explorables (chantier 12,
// voir NOTES_VILLES.md) — generateUrbanFloorMap() (habillage de generateMetropolis()), exploration et voyage
// par la carte comme un étage classique, tables d'événements ville / route, pickpocket, gardien de l'escalier
// et de la Sortie, bascule classique / urbain, menu DEV, sauvegarde de l'ancien format.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = original; }
}

// generateUrbanFloorMap() : thème par étage, étage urbain dans gameState.floorMap (kind 'urban'), départ sur la
// place de la première ville, un seul escalier (Sortie à l'étage final, toujours gardée), une auberge par ville.
{
    [3, 6, 9, 12, 15].forEach(floor => {
        resetTransientState();
        gameState.currentFloor = floor;
        generateUrbanFloorMap();
        const fm = gameState.floorMap;
        assert(fm.kind === 'urban' && isUrbanFloor() && fm.version === FLOOR_MAP_VERSION, `generateUrbanFloorMap() : étage ${floor} urbain dans floorMap`);
        assert(fm.theme === config.urbanFloors.themes[floor] && gameState.currentDistrict === fm.theme, `generateUrbanFloorMap() : thème de l'étage ${floor}`);
        assert(fm.isFinalFloor === false, `generateUrbanFloorMap() : étage ${floor} n'est pas l'étage final`);
        const rooms = Object.values(fm.roomsById);
        const stairs = rooms.filter(r => r.type === 'stairs');
        assert(stairs.length === 1 && stairs[0].guardsStairs && !stairs[0].isExit, `generateUrbanFloorMap() : un seul escalier à l'étage ${floor}`);
        assert(fm.roomsById[fm.startRoomId].visited && fm.roomsById[fm.startRoomId].cityRole === 'plaza', "generateUrbanFloorMap() : départ visité, sur une place");
        assert(Object.values(fm.citiesById).every(c => c.name && c.roomIds.some(id => fm.roomsById[id].type === 'safe' && fm.roomsById[id].safehouse)), "generateUrbanFloorMap() : chaque ville a un nom et une auberge (thème de repos)");
        assert(Object.values(fm.lairsById).length === config.urbanFloors.lairRoadsPerFloor, "generateUrbanFloorMap() : repaires par étage");
    });
    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exit = Object.values(gameState.floorMap.roomsById).filter(r => r.type === 'stairs');
    assert(gameState.floorMap.isFinalFloor && exit.length === 1 && exit[0].isExit && exit[0].guarded, "generateUrbanFloorMap() : étage final, une Sortie toujours gardée");
    assert(Object.values(gameState.floorMap.lairsById).length === config.urbanFloors.lairRoadsFinalFloor, "generateUrbanFloorMap() : repaires de l'étage final");
}

// Probabilité de garde de l'escalier croissante avec la profondeur (statistique, nombreuses générations).
{
    Object.entries(config.urbanFloors.stairsGuardChanceByFloor).forEach(([floorStr, expectedChance]) => {
        const floor = Number(floorStr);
        let guardedCount = 0;
        const trials = 300;
        for (let i = 0; i < trials; i++) {
            resetTransientState();
            gameState.currentFloor = floor;
            generateUrbanFloorMap();
            if (Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs').guarded) guardedCount++;
        }
        const observed = (guardedCount / trials) * 100;
        assert(Math.abs(observed - expectedChance) < 15, `Probabilité de garde à l'étage ${floor} : attendu ~${expectedChance}%, observé ${observed.toFixed(1)}% sur ${trials} tirages`);
    });
}

// Tables d'événements : ville calme (jamais de combat ni de piège), route dangereuse — tables validées
// (chantier 12, variante « routes plus dures »), toutes de somme 100.
{
    const sum = t => Object.values(t).reduce((a, b) => a + b, 0);
    assert(sum(config.cityChances) === 100 && sum(config.roadChances) === 100, "Tables ville / route : somme 100");
    assert(config.cityChances.combat === 0 && config.cityChances.trap === 0 && config.cityChances.timeLoss === 0, "Table ville : jamais de combat, de piège ni de contretemps");
    assert(config.roadChances.combat === 40 && config.roadChances.trap === 14, "Table route : combat 40, piège 14");
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    assert(getZoneEventTable() === config.cityChances, "getZoneEventTable() : table des villes sur la place");
    const seg = Object.values(fm.roomsById).find(r => r.zone === 'road');
    moveToFloorRoom(seg);
    assert(getZoneEventTable() === config.roadChances, "getZoneEventTable() : table des routes sur un tronçon");
    assert(ZONE_TYPES.road.hunterMult === 1.5, "Routes : chasseurs de primes ×1,5");
    resetTransientState();
}

// Pickpocket : 10 % des PO, au moins 5, au plus 50, jamais plus que ce qu'on a ; tiré seulement en ville.
{
    assert(computePickpocketLoss(0) === 0 && computePickpocketLoss(3) === 3 && computePickpocketLoss(30) === 5
        && computePickpocketLoss(200) === 20 && computePickpocketLoss(2000) === 50, "computePickpocketLoss() : 10 %, bornes 5 et 50, jamais plus que la bourse");
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    gameState.gold = 200;
    // Jet dans la tranche du pickpocket (95-100 de la table ville : tout le reste passe avant, sauf Ambiance).
    const before = config.cityChances.nothing + config.cityChances.combat + config.cityChances.loot + config.cityChances.trap
        + config.cityChances.timeLoss + config.cityChances.minorFind + config.cityChances.goldFind + config.cityChances.audienceGift
        + config.cityChances.companionEncounter;
    withRandom((before + 1) / 100, () => resolveCardEvent());
    assert(gameState.gold === 180 && ui.sceneTitle.innerText === 'Pickpocket', "resolveCardEvent() en ville : pickpocket, -10 % des PO");
    resetTransientState();
}

// Exploration et voyage : une ville et ses routes s'explorent comme un étage classique (performExploreStep(),
// travelToRoom() par le chemin connu, avec le temps du trajet).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    const plaza = fm.roomsById[fm.startRoomId];
    const road = plaza.neighbors.find(n => fm.roomsById[n.to].zone === 'road');
    const time = gameState.timeLeft;
    withRandom(0, () => performExploreStep(road.to)); // Jet 0 sur la table route : « Rien »
    assert(fm.currentRoomId === road.to && fm.roomsById[road.to].visited && gameState.timeLeft === time - 1, "performExploreStep() : un pas sur la route (-1 H)");
    const plan = planTravelToRoom(plaza.id);
    assert(plan && !plan.exploreStep && plan.distance > 0, "planTravelToRoom() : retour à la place par le chemin connu");
    withRandom(0.99, () => travelToRoom(plaza.id));
    assert(fm.currentRoomId === plaza.id && gameState.timeLeft === time - 1 - plan.timeCost, "travelToRoom() : retour à la place, temps du trajet décompté");
    assert(floorRoomLabel(fm.roomsById[road.to]) === 'Route', "floorRoomLabel() : un tronçon visité est une « Route »");
    resetTransientState();
}

// Gardien de l'escalier : combattre ouvre le choix d'escalier ; repérer laisse la salle re-tentable ; la
// victoire marque la salle vaincue (🪜 sur la carte).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const stairs = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    stairs.guarded = true;
    moveToFloorRoom(stairs);
    enterRoom(stairs);
    assert(gameState.bossChoicePending === true && stairs.bossInstance, "Escalier gardé : choix combattre / repérer, boss mis en cache");
    retreatFromBoss();
    assert(gameState.bossChoicePending === false && !stairs.defeated, "Repérer : la salle reste gardée, re-tentable");
    enterRoom(stairs);
    fightBossNow();
    assert(gameState.inCombat === true && gameState.pendingStairAfterCombat === true, "Combattre : combat du gardien de l'escalier");
    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(stairs.defeated === true && gameState.stairsChoicePending === true && gameState.pendingStairsChoice.roomId === stairs.id, "Victoire : escalier libre, choix Descendre / Rester");
    descendStairs();
    continueFromFloorTransition();
    assert(gameState.currentFloor === floorBefore + 1 && !isUrbanFloor(), "Descendre : étage suivant (classique)");
    resetTransientState();
}

// Gardien de la Sortie (étage final) : la victoire déclenche winGame(), jamais un étage de plus.
{
    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exit = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    moveToFloorRoom(exit);
    enterRoom(exit);
    // Chantier 17 : Gorgoth le Concierge, en forme finale, garde la Sortie à la place du gardien habituel.
    assert(gameState.inCombat === true && gameState.currentEnemy && gameState.currentEnemy.isDemon && gameState.currentEnemy.demonFinal === true, "Sortie gardée : Gorgoth en forme finale");
    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.hasWon === true && gameState.currentFloor === floorBefore, "Victoire sur Gorgoth à la Sortie : winGame(), aucun étage de plus");
    gameState.hasWon = false;
    gameState.inCombat = false;
    ui.winOverlay.classList.add('hidden');
    resetTransientState();
}

// advanceToNextFloor() : étage classique ou urbain selon le multiple de 3.
{
    resetTransientState();
    gameState.currentFloor = 1;
    advanceToNextFloor();
    assert(gameState.floorMap && !isUrbanFloor(), "advanceToNextFloor() : étage 2 reste un donjon classique");
    resetTransientState();
    gameState.currentFloor = 2;
    advanceToNextFloor();
    assert(isUrbanFloor(), "advanceToNextFloor() : étage 3 devient un étage urbain");
    resetTransientState();
}

// devJumpToUrbanFloor() (menu DEV) : saute directement à l'étage 3 (urbain), sans combat ni choix fantôme.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye DEV", hp: 10, maxHp: 10, atk: 1, def: 1, xpReward: 1, status: {} };
    devJumpToUrbanFloor();
    assert(gameState.currentFloor === 3 && isUrbanFloor(), "devJumpToUrbanFloor() : étage 3 urbain");
    assert(gameState.inCombat === false && gameState.currentEnemy === null && gameState.bossChoicePending === false, "devJumpToUrbanFloor() : aucun combat ni choix en attente");
    resetTransientState();
}

// Sauvegarde d'avant les villes explorables (ancien gameState.urbanMap) : l'étage urbain en cours est regénéré
// au nouveau format, les anciens champs disparaissent.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Ancien Urbain";
    gameState.currentFloor = 6;
    gameState.floorMap = null;
    const legacy = JSON.parse(JSON.stringify(gameState));
    legacy.urbanMap = { theme: 'x', citiesById: {}, currentCityId: 'city-0' };
    legacy.pendingUrbanTravel = { destinationCityId: 'city-1' };
    legacy.saveEnabled = true;
    localStorage.setItem(saveKeyForName("Ancien Urbain"), JSON.stringify(legacy));
    resetTransientState();
    assert(restoreSaveForName("Ancien Urbain") === true, "Ancienne sauvegarde urbaine : restaurée");
    assert(isUrbanFloor() && gameState.currentFloor === 6 && !('urbanMap' in gameState) && !('pendingUrbanTravel' in gameState), "Ancienne sauvegarde urbaine : étage 6 regénéré en villes explorables, anciens champs retirés");
    gameState.saveEnabled = false;
    localStorage.clear();
    resetTransientState();
}
