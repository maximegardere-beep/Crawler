// urban-floors.js — tests régression : Étages urbains (multiples de 3) : generateUrbanFloorMap()/travelToCity()/ triggerUrbanBossEncounter().
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L1909 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Étages urbains (multiples de 3 — voir generateUrbanFloorMap()/travelToCity()/
// triggerUrbanBossEncounter() dans app.js, config.urbanFloors).
// ===================================================================

// generateUrbanFloorMap() : thème correct par étage, une seule ville gardienne (escalier hors étage
// final, Sortie TOUJOURS gardée à l'étage final), réseau entièrement connexe.
{
    [3, 6, 9, 12, 15].forEach(floor => {
        resetTransientState();
        gameState.currentFloor = floor;
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        assert(um !== null, `generateUrbanFloorMap() : urbanMap défini à l'étage ${floor}`);
        assert(um.isFinalFloor === false, `generateUrbanFloorMap() : étage ${floor} n'est pas l'étage final`);
        assert(um.theme === config.urbanFloors.themes[floor], `generateUrbanFloorMap() : thème correct à l'étage ${floor}`);
        assert(gameState.currentDistrict === um.theme, `generateUrbanFloorMap() : currentDistrict aligné sur le thème à l'étage ${floor}`);

        const cities = Object.values(um.citiesById);
        assert(cities.filter(c => c.isStairs).length === 1, `generateUrbanFloorMap() : exactement une ville d'escalier à l'étage ${floor}`);
        assert(cities.filter(c => c.isExit).length === 0, `generateUrbanFloorMap() : aucune Sortie sur un étage non final (${floor})`);

        const allReachable = cities.every(c => computeCityDistance(um.currentCityId, c.id) !== null);
        assert(allReachable, `generateUrbanFloorMap() : réseau entièrement connexe à l'étage ${floor}`);
    });

    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const finalMap = gameState.urbanMap;
    assert(finalMap.isFinalFloor === true, "generateUrbanFloorMap() : étage final correctement marqué");
    const finalCities = Object.values(finalMap.citiesById);
    assert(finalCities.filter(c => c.isExit).length === 1, "generateUrbanFloorMap() : exactement une Sortie à l'étage final");
    assert(finalCities.filter(c => c.isStairs).length === 0, "generateUrbanFloorMap() : aucun escalier classique à l'étage final");
    assert(finalCities.find(c => c.isExit).guarded === true, "generateUrbanFloorMap() : la Sortie est TOUJOURS gardée");
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
            if (Object.values(gameState.urbanMap.citiesById).find(c => c.isStairs).guarded) guardedCount++;
        }
        const observed = (guardedCount / trials) * 100;
        assert(Math.abs(observed - expectedChance) < 15, `Probabilité de garde à l'étage ${floor} : attendu ~${expectedChance}%, observé ${observed.toFixed(1)}% sur ${trials} tirages`);
    });
}

// computeCityDistance() : plus court chemin pondéré, y compris via une route de bouclage plus rapide
// qu'un détour par l'arbre couvrant.
{
    resetTransientState();
    gameState.urbanMap = {
        theme: "Test", isFinalFloor: false, currentCityId: 'a',
        citiesById: {
            a: { id: 'a', roads: [{ to: 'b', distance: 5 }, { to: 'c', distance: 1 }] },
            b: { id: 'b', roads: [{ to: 'a', distance: 5 }] },
            c: { id: 'c', roads: [{ to: 'a', distance: 1 }, { to: 'b', distance: 1 }] }
        }
    };
    assert(computeCityDistance('a', 'a') === 0, "computeCityDistance() : distance nulle vers soi-même");
    assert(computeCityDistance('a', 'b') === 2, "computeCityDistance() : emprunte le détour par 'c' (1+1=2) plutôt que la route directe (5)");
    assert(computeCityDistance('a', 'c') === 1, "computeCityDistance() : route directe la plus courte");
}

// travelToCity() : bloqué vers une ville pas encore connue, consomme du temps + régénère (voir
// applyTimeElapsedRegen()) vers une ville connue atteignable.
{
    // Le voisin ciblé doit être une ville "normale" (ni escalier ni Sortie) : y arriver quand elle
    // n'est pas gardée déclenche triggerFloorTransition() (voir arriveAtCity()), qui affiche l'écran
    // d'escalier plutôt que d'avancer directement — sans lien avec l'assertion "consomme du temps"
    // ci-dessous, mais évité quand même pour rester sur le cas nominal testé ici. Il faut aussi une
    // ville pas encore connue pour le premier test (bloqué) — sur un petit réseau (6 villes), la ville
    // de départ peut parfois se retrouver reliée directement à TOUTES les autres (aucune ville
    // inconnue restante) : on retente simplement dans ce cas plutôt que de planter sur .find()...id.
    let um, unknownCityId, safeNeighborId;
    for (let attempt = 0; attempt < 20 && !safeNeighborId; attempt++) {
        resetTransientState();
        gameState.currentFloor = 3;
        generateUrbanFloorMap();
        um = gameState.urbanMap;
        const unknownCity = Object.values(um.citiesById).find(c => !c.known);
        if (!unknownCity) continue;
        unknownCityId = unknownCity.id;
        const safeRoad = um.citiesById[um.currentCityId].roads.find(r => !um.citiesById[r.to].isStairs && !um.citiesById[r.to].isExit);
        if (safeRoad) safeNeighborId = safeRoad.to;
    }
    assert(!!safeNeighborId, "travelToCity() test : une carte urbaine avec un voisin non-escalier ET une ville encore inconnue doit être trouvable");

    const timeBefore = gameState.timeLeft;
    travelToCity(unknownCityId);
    assert(gameState.timeLeft === timeBefore, "travelToCity() : aucun effet vers une ville pas encore connue");
    assert(um.currentCityId !== unknownCityId, "travelToCity() : n'arrive pas dans une ville inconnue");

    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade (jamais sous ambushBaseChance avec un tirage haut)
    gameState.hp = gameState.maxHp - 50;
    travelToCity(safeNeighborId);
    Math.random = originalRandom;
    assert(gameState.timeLeft < timeBefore, "travelToCity() : consomme du temps");
    assert(gameState.hp > gameState.maxHp - 50, "travelToCity() : la régénération passive s'applique au temps du trajet");
}

// Gardien urbain : combattre ouvre l'étage suivant ; repérer laisse la ville re-tentable plus tard
// (aucun registre séparé, contrairement au donjon classique — voir retreatFromUrbanBoss()).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const um = gameState.urbanMap;
    const stairsCity = Object.values(um.citiesById).find(c => c.isStairs);
    stairsCity.guarded = true; // Force la garde, indépendamment du tirage

    triggerUrbanBossEncounter(stairsCity);
    assert(gameState.bossChoicePending === true, "triggerUrbanBossEncounter() : ouvre le choix combattre/repérer");
    assert(stairsCity.bossInstance !== null, "triggerUrbanBossEncounter() : génère et met en cache le boss");

    retreatFromBoss(); // Dispatché vers retreatFromUrbanBoss()
    assert(gameState.bossChoicePending === false, "retreatFromBoss() (dispatch urbain) : referme le choix");
    assert(stairsCity.defeated === false, "retreatFromUrbanBoss() : la ville reste non vaincue, re-tentable plus tard");

    triggerUrbanBossEncounter(stairsCity);
    fightBossNow(); // Dispatché vers fightUrbanBossNow()
    assert(gameState.inCombat === true, "fightBossNow() (dispatch urbain) : lance bien le combat");
    assert(gameState.pendingUrbanAdvanceAfterCombat === 'nextFloor', "fightUrbanBossNow() : victoire ouvrira l'étage suivant (pas la Sortie)");

    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.currentFloor === floorBefore, "winCombat() : n'avance pas encore l'étage, l'écran d'escalier s'affiche d'abord (voir triggerFloorTransition())");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === false, "winCombat() : affiche bien l'écran d'escalier");
    assert(stairsCity.defeated === true, "winCombat() : marque déjà la ville gardienne vaincue à ce stade");

    continueFromFloorTransition();
    assert(gameState.currentFloor === floorBefore + 1, "continueFromFloorTransition() : fait bien passer à l'étage suivant");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === true, "continueFromFloorTransition() : referme l'écran d'escalier");
}

// Gardien de la Sortie (étage final) : la victoire déclenche winGame(), jamais nextFloor().
{
    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exitCity = Object.values(gameState.urbanMap.citiesById).find(c => c.isExit);

    triggerUrbanBossEncounter(exitCity);
    fightBossNow();
    assert(gameState.pendingUrbanAdvanceAfterCombat === 'win', "fightUrbanBossNow() : la Sortie de l'étage final déclenchera la victoire");

    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.hasWon === true, "winCombat() : défaite du gardien de la Sortie déclenche winGame()");
    assert(gameState.currentFloor === floorBefore, "winCombat() : la victoire n'avance jamais vers un étage au-delà de l'étage final");
}

// advanceToNextFloor() : bascule correctement entre étage classique et étage urbain selon le
// multiple de 3, jamais les deux structures définies en même temps.
{
    resetTransientState();
    gameState.currentFloor = 1; // Le prochain (2) reste classique
    advanceToNextFloor();
    assert(gameState.floorMap !== null && gameState.urbanMap === null, "advanceToNextFloor() : étage 2 reste un donjon classique");

    resetTransientState();
    gameState.currentFloor = 2; // Le prochain (3) est urbain
    advanceToNextFloor();
    assert(gameState.urbanMap !== null && gameState.floorMap === null, "advanceToNextFloor() : étage 3 devient un étage urbain");
}

// UI : "Lieux connus"/overlay "Carte Urbaine" mutuellement exclusifs, invite "Touchez la carte"
// masquée sur un étage urbain, et l'overlay se masque bien dès qu'une "situation" est en cours
// (combat/boss/furtivité/compagnon) pour laisser la carte redevenir visible (voir updateUI() dans
// app.js).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === false, "updateUI() : overlay Carte Urbaine visible sur un étage urbain hors situation");
    assert(ui.knownLocationsSection.classList.contains('hidden') === true, "updateUI() : panneau Lieux connus masqué sur un étage urbain");
    assert(ui.advanceHint.classList.contains('hidden') === true, "updateUI() : invite d'exploration masquée sur un étage urbain");

    gameState.inCombat = true;
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué en combat (situation)");
    gameState.inCombat = false;

    gameState.bossChoicePending = true;
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué pendant un choix de boss (situation)");
    gameState.bossChoicePending = false;

    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === false, "updateUI() : overlay Carte Urbaine réapparaît une fois la situation résolue");

    resetTransientState();
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué sur un étage classique");
    assert(ui.knownLocationsSection.classList.contains('hidden') === false, "updateUI() : panneau Lieux connus visible sur un étage classique");
}

// devJumpToUrbanFloor() (menu DEV) : saute directement à l'étage 3 (urbain), quel que soit l'état
// bloquant en cours, sans jamais laisser de combat/choix fantôme derrière lui.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye DEV", hp: 10, maxHp: 10, atk: 1, def: 1, xpReward: 1, status: {} };
    devJumpToUrbanFloor();
    assert(gameState.currentFloor === 3, "devJumpToUrbanFloor() : atterrit bien sur l'étage 3");
    assert(gameState.urbanMap !== null && gameState.floorMap === null, "devJumpToUrbanFloor() : génère bien un étage urbain");
    assert(gameState.inCombat === false && gameState.currentEnemy === null, "devJumpToUrbanFloor() : ne laisse aucun combat en cours derrière lui");
    assert(gameState.bossChoicePending === false, "devJumpToUrbanFloor() : ne laisse aucun choix de boss en attente");
}

// computeGraphLayout() (générique, réutilisable — voir app.js) : toutes les positions retournées
// restent dans le cadre normalisé [0,1], un graphe sans arêtes reste malgré tout disposé (pas de
// crash), et repartir des positions déjà calculées ne les fait pas dériver loin (stabilité d'un
// rendu à l'autre, condition nécessaire pour ne pas "sauter" visuellement).
{
    const nodeIds = ['a', 'b', 'c', 'd'];
    const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'a' }];
    const positions = computeGraphLayout(nodeIds, edges, {});
    nodeIds.forEach(id => {
        assert(positions[id] && positions[id].x >= 0 && positions[id].x <= 1 && positions[id].y >= 0 && positions[id].y <= 1,
            `computeGraphLayout() : la position de '${id}' reste dans le cadre normalisé [0,1]`);
    });

    const isolated = computeGraphLayout(['solo'], [], {});
    assert(!!isolated.solo, "computeGraphLayout() : un graphe sans arêtes dispose quand même son unique nœud");

    const stabilized = computeGraphLayout(nodeIds, edges, positions);
    nodeIds.forEach(id => {
        const dx = stabilized[id].x - positions[id].x;
        const dy = stabilized[id].y - positions[id].y;
        assert(Math.sqrt(dx * dx + dy * dy) < 0.05,
            `computeGraphLayout() : repartir d'une disposition déjà stable ne fait pas dériver '${id}'`);
    });

    const withNewNode = computeGraphLayout([...nodeIds, 'e'], [...edges, { from: 'a', to: 'e' }], positions);
    nodeIds.forEach(id => {
        const dx = withNewNode[id].x - positions[id].x;
        const dy = withNewNode[id].y - positions[id].y;
        assert(Math.sqrt(dx * dx + dy * dy) < 0.35,
            `computeGraphLayout() : l'arrivée d'un nouveau nœud ('e') ne bouscule pas trop les nœuds déjà en place ('${id}')`);
    });
    assert(!!withNewNode.e, "computeGraphLayout() : le nouveau nœud reçoit bien une position");
}

// buildUrbanMapGraphData() : adaptateur urbain -> format générique nœuds/arêtes, et
// updateUrbanMapUI() : la mini carte graphique (SVG) est bien peuplée, avec un nœud par ville
// connue et un clic sur un nœud (autre que la ville courante) déclenchant le voyage.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const um = gameState.urbanMap;
    const stairsCity = Object.values(um.citiesById).find(c => c.isStairs);
    stairsCity.guarded = true; // Force la garde pour vérifier l'icône/variant 'guarded'
    stairsCity.known = true; // Garantit sa présence dans le graphe pour cette vérification ciblée

    const { nodes, edges, positions } = buildUrbanMapGraphData(um);
    const knownCount = Object.values(um.citiesById).filter(c => c.known).length;
    assert(nodes.length === knownCount, "buildUrbanMapGraphData() : un nœud par ville connue, ni plus ni moins");
    assert(edges.every(e => nodes.some(n => n.id === e.from) && nodes.some(n => n.id === e.to)),
        "buildUrbanMapGraphData() : aucune arête ne pointe vers une ville pas encore connue");
    assert(Object.keys(positions).length === nodes.length, "buildUrbanMapGraphData() : une position (fixe) par nœud connu");
    const stairsNode = nodes.find(n => n.id === stairsCity.id);
    assert(stairsNode.variant === 'guarded' && stairsNode.icon === '🏙️' && stairsNode.goalIcon === '👑',
        "buildUrbanMapGraphData() : une ville-escalier gardée garde une icône normale + un goalIcon 'guarded' à part");

    updateUrbanMapUI();
    assert(ui.urbanMapSvg._children.length === 3, "updateUrbanMapUI() : le SVG contient un fond, un groupe d'arêtes et un groupe de nœuds");
    const nodesGroup = ui.urbanMapSvg._children[2];
    // +1 : le marqueur de gardien (goalIcon) de la ville-escalier s'ajoute au groupe des nœuds, en
    // plus de son propre nœud — voir renderGraphMiniMap().
    assert(nodesGroup._children.length === nodes.length + 1, "updateUrbanMapUI() : un élément SVG par nœud du graphe, plus le marqueur de gardien");

    // Clic sur un nœud autre que la ville courante : doit déclencher travelToCity() (même mécanisme
    // que la liste précédente, juste porté par le graphe désormais). La Carte Urbaine est toujours en
    // mode pan (updateUrbanMapUI() fournit toujours onCameraChange) : le tap est résolu par
    // pointerdown/pointerup à la position MONDE du nœud (voir renderGraphMiniMap()), jamais par un
    // `click` natif (aucun listener de ce type n'est attaché aux nœuds dans ce mode).
    const otherNode = nodes.find(n => n.id !== um.currentCityId);
    const cityBefore = um.currentCityId;
    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade pour un trajet direct et prévisible
    const [vbX, vbY] = ui.urbanMapSvg.getAttribute('viewBox').split(' ').map(Number);
    const targetWorld = positions[otherNode.id];
    // scale 1:1 et rect.left/top = 0 (test_stub.js n'expose pas getBoundingClientRect(), voir son
    // fallback dans renderGraphMiniMap()) : clientX/Y = position monde - origine du viewBox.
    const clientX = targetWorld.x - vbX, clientY = targetWorld.y - vbY;
    ui.urbanMapSvg.dispatch('pointerdown', { clientX, clientY, pointerId: 1 });
    ui.urbanMapSvg.dispatch('pointerup', { clientX, clientY, pointerId: 1 });
    Math.random = originalRandom;
    // Troisième issue possible depuis PR "Repaires sur les routes" : si la route directe est un
    // repaire non nettoyé, le clic ouvre le choix plonger/poursuivre plutôt que de bouger ou combattre.
    assert(um.currentCityId !== cityBefore || gameState.inCombat || gameState.lairChoicePending,
        "updateUrbanMapUI() : cliquer un nœud du graphe déplace bien le joueur (ou déclenche une embuscade / un choix de repaire)");
}
