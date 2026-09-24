// urban-lairs.js — tests régression : Repaires sur les routes : generateUrbanFloorMap()/triggerLairChoice()/ diveIntoLair()/declineLair()/winCombat().
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L2847 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Repaires sur les routes : generateUrbanFloorMap()/triggerLairChoice()/diveIntoLair()/
// declineLair()/winCombat() (enchaînement combats → boss → butin). Voir CLAUDE.md.
// ===================================================================

// generateUrbanFloorMap() : exactement lairRoadsPerFloor (ou lairRoadsFinalFloor à l'étage final)
// routes marquées repaire, symétriquement dans les deux sens (isLair/lairId identiques), avec un
// lairsById cohérent (2 ou 3 combats forcés, jamais nettoyé à la génération).
{
    resetTransientState();
    for (let i = 0; i < 15; i++) {
        gameState.currentFloor = 3;
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        const lairs = Object.values(um.lairsById);
        assert(lairs.length === config.urbanFloors.lairRoadsPerFloor,
            "generateUrbanFloorMap() : exactement lairRoadsPerFloor repaires sur un étage normal");

        lairs.forEach(lair => {
            assert(lair.cleared === false, "generateUrbanFloorMap() : un repaire n'est jamais nettoyé à la génération");
            assert([2, 3].includes(lair.combatsRemaining), "generateUrbanFloorMap() : 2 ou 3 combats forcés avant le boss");
            const roadAtoB = um.citiesById[lair.cityAId].roads.find(r => r.to === lair.cityBId);
            const roadBtoA = um.citiesById[lair.cityBId].roads.find(r => r.to === lair.cityAId);
            assert(roadAtoB && roadAtoB.isLair && roadAtoB.lairId === lair.id, "generateUrbanFloorMap() : isLair posé dans le sens A→B");
            assert(roadBtoA && roadBtoA.isLair && roadBtoA.lairId === lair.id, "generateUrbanFloorMap() : isLair posé aussi dans le sens B→A");
        });
    }

    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    assert(Object.values(gameState.urbanMap.lairsById).length === config.urbanFloors.lairRoadsFinalFloor,
        "generateUrbanFloorMap() : lairRoadsFinalFloor repaires à l'étage final");
}

// travelToCity() : un repaire sur la route DIRECTEMENT empruntée déclenche le choix AVANT toute
// embuscade normale ; le trajet interrompu reste en attente, isActionBlocked() masque la Carte
// Urbaine (voir updateUI()). declineLair() reprend le trajet normalement, sans marquer le repaire
// nettoyé (re-proposé à un futur trajet).
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    const start = { id: 'lair-start', name: 'Départ Test', known: true, visited: true, roads: [] };
    const neighbor = { id: 'lair-neighbor', name: 'Voisine Test', known: true, visited: false, roads: [] };
    const lairId = 'lair-test-0';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.urbanMap = {
        theme: gameState.currentDistrict, isFinalFloor: false,
        citiesById: { [start.id]: start, [neighbor.id]: neighbor },
        currentCityId: start.id, lairsById: { [lairId]: lair }
    };

    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade normale sur ce trajet
    travelToCity(neighbor.id);
    Math.random = originalRandom;

    assert(gameState.lairChoicePending === true, "travelToCity() : un repaire sur la route directe déclenche le choix AVANT toute embuscade normale");
    assert(gameState.pendingUrbanTravel && gameState.pendingUrbanTravel.destinationCityId === neighbor.id, "travelToCity() : le trajet interrompu reste en attente pendant le choix");
    assert(isActionBlocked() === true, "isActionBlocked() : vrai tant que le choix du repaire est en attente");

    declineLair();
    assert(gameState.lairChoicePending === false, "declineLair() : referme le choix");
    assert(lair.cleared === false, "declineLair() : le repaire reste intact, re-proposé plus tard");
    assert(gameState.urbanMap.currentCityId === neighbor.id, "declineLair() : le trajet interrompu reprend et aboutit normalement");
}

// diveIntoLair() + winCombat() : enchaîne exactement combatsRemaining combats de sbires (stage
// 'trash'), puis un unique combat de boss (stage 'boss', généré seulement à ce moment-là) ; sa
// victoire marque le repaire nettoyé et fait reprendre le trajet interrompu jusqu'à destination.
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    const start = { id: 'lair-start-2', name: 'Départ Test 2', known: true, visited: true, roads: [] };
    const neighbor = { id: 'lair-neighbor-2', name: 'Voisine Test 2', known: true, visited: false, roads: [] };
    const lairId = 'lair-test-1';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.urbanMap = {
        theme: gameState.currentDistrict, isFinalFloor: false,
        citiesById: { [start.id]: start, [neighbor.id]: neighbor },
        currentCityId: start.id, lairsById: { [lairId]: lair }
    };

    const originalRandom = Math.random;
    Math.random = () => 0.99;
    travelToCity(neighbor.id);
    Math.random = originalRandom;
    assert(gameState.lairChoicePending === true, "setup : choix du repaire bien déclenché");

    diveIntoLair();
    assert(gameState.inCombat === true, "diveIntoLair() : lance immédiatement le premier combat forcé");
    assert(gameState.pendingLairDive && gameState.pendingLairDive.stage === 'trash', "diveIntoLair() : commence par la vague de sbires (stage 'trash')");
    assert(gameState.pendingLairDive.combatsLeft === lair.combatsRemaining, "diveIntoLair() : combatsLeft initialisé au nombre de combats du repaire");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat === true, "winCombat() (repaire) : enchaîne directement sur le combat suivant");
    assert(gameState.pendingLairDive.stage === 'trash', "winCombat() (repaire) : reste en stage 'trash' tant qu'il reste des sbires");
    assert(gameState.pendingLairDive.combatsLeft === 1, "winCombat() (repaire) : décrémente combatsLeft");
    assert(lair.bossInstance === null, "winCombat() (repaire) : le boss n'est pas encore généré pendant la vague de sbires");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat === true, "winCombat() (repaire) : lance le combat de boss une fois les sbires épuisés");
    assert(gameState.pendingLairDive.stage === 'boss', "winCombat() (repaire) : bascule en stage 'boss'");
    assert(lair.bossInstance !== null, "winCombat() (repaire) : génère le boss du repaire à ce moment-là");
    assert(gameState.currentEnemy === lair.bossInstance, "winCombat() (repaire) : le combat en cours est bien celui du boss du repaire");
    assert(lair.cleared === false, "winCombat() (repaire) : pas encore nettoyé tant que le boss n'est pas vaincu");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(lair.cleared === true, "winCombat() (repaire) : marque le repaire nettoyé après la victoire sur son boss");
    assert(gameState.pendingLairDive === null, "winCombat() (repaire) : la plongée est terminée");
    assert(gameState.urbanMap.currentCityId === neighbor.id, "winCombat() (repaire) : le trajet interrompu reprend et aboutit après la plongée");
}

// attemptFlee() : fuir en pleine plongée laisse le repaire intact (jamais marqué nettoyé), sans
// forcer la reprise du trajet interrompu — même comportement passif qu'une fuite d'embuscade urbaine
// normale (voir pendingUrbanTravel, pas de reprise automatique non plus dans ce cas).
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Sbire Test", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    const lair = { id: 'lair-flee-0', cityAId: 'a', cityBId: 'b', cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.pendingLairDive = { lairId: lair.id, combatsLeft: 2, stage: 'trash' };
    gameState.urbanMap = { theme: gameState.currentDistrict, isFinalFloor: false, citiesById: {}, currentCityId: 'a', lairsById: { [lair.id]: lair } };

    const originalRandom = Math.random;
    Math.random = () => 0.01; // Réussite garantie (60% de base, voir attemptFlee())
    attemptFlee();
    Math.random = originalRandom;

    assert(gameState.inCombat === false, "attemptFlee() (repaire) : fuite réussie, combat terminé");
    assert(gameState.pendingLairDive === null, "attemptFlee() (repaire) : la plongée est annulée");
    assert(lair.cleared === false, "attemptFlee() (repaire) : le repaire reste intact après une fuite");
}

// buildUrbanMapGraphData() : une route repaire porte un edges[].marker dédié — rouge/💀 tant qu'elle
// n'est pas nettoyée, gris/🏆 une fois vaincue (jamais un goalIcon : une route reste franchissable).
{
    const start = { id: 'lair-map-a', name: 'A', known: true, visited: true, roads: [], x: 0.3, y: 0.5 };
    const neighbor = { id: 'lair-map-b', name: 'B', known: true, visited: false, roads: [], x: 0.7, y: 0.5 };
    const lairId = 'lair-map-0';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    const urbanMap = { theme: "Rue des Illusions", isFinalFloor: false, citiesById: { [start.id]: start, [neighbor.id]: neighbor }, currentCityId: start.id, lairsById: { [lairId]: lair } };

    let graph = buildUrbanMapGraphData(urbanMap);
    let edge = graph.edges.find(e => (e.from === start.id && e.to === neighbor.id) || (e.from === neighbor.id && e.to === start.id));
    assert(!!edge && !!edge.marker, "buildUrbanMapGraphData() : une route repaire porte un edges[].marker");
    assert(edge.marker.icon === '💀' && edge.marker.variant === 'guarded', "buildUrbanMapGraphData() : marqueur rouge/💀 tant que le repaire n'est pas nettoyé");
    assert(edge.goalIcon === undefined && graph.nodes.every(n => n.goalIcon === null || n.goalIcon === undefined),
        "buildUrbanMapGraphData() : un repaire n'est jamais un goalIcon, une route reste franchissable");

    lair.cleared = true;
    graph = buildUrbanMapGraphData(urbanMap);
    edge = graph.edges.find(e => (e.from === start.id && e.to === neighbor.id) || (e.from === neighbor.id && e.to === start.id));
    assert(edge.marker.icon === '🏆' && edge.marker.variant === 'default', "buildUrbanMapGraphData() : marqueur 🏆 une fois le repaire nettoyé");
}
