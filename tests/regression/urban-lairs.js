// urban-lairs.js — tests régression : repaires des étages urbains (chantier 12, villes explorables) — une salle
// en impasse accrochée à un tronçon de route ; y entrer propose plonger / ressortir ; la plongée enchaîne
// 2-3 sbires puis le boss (winCombat()), une fuite laisse le repaire intact.
const { assert, resetTransientState } = require('./_helpers.js');

function lairSetup() {
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    const room = Object.values(fm.roomsById).find(r => r.type === 'lair');
    return { fm, room, lair: fm.lairsById[room.lairId] };
}

// Génération : état de chaque repaire (2 ou 3 combats forcés, jamais nettoyé), salle en impasse sur une route.
{
    const { fm, room, lair } = lairSetup();
    assert(lair && lair.cleared === false && (lair.combatsRemaining === 2 || lair.combatsRemaining === 3) && lair.bossInstance === null, "Repaire : 2 ou 3 combats forcés, pas encore nettoyé, boss généré plus tard");
    assert(room.neighbors.length === 1 && fm.roomsById[room.neighbors[0].to].zone === 'road', "Repaire : impasse accrochée à un tronçon de route");
}

// Entrer : choix plonger / ressortir (bloquant) ; ressortir laisse le repaire intact, reproposé ensuite.
{
    const { room, lair } = lairSetup();
    moveToFloorRoom(room);
    enterRoom(room);
    assert(gameState.lairChoicePending === true && gameState.pendingLairId === lair.id && isActionBlocked(), "Entrer dans un repaire : choix plonger / ressortir, actions bloquées");
    assert(!ui.lairChoiceZone.classList.contains('hidden'), "Entrer dans un repaire : zone de choix affichée");
    declineLair();
    assert(gameState.lairChoicePending === false && !lair.cleared && ui.lairChoiceZone.classList.contains('hidden'), "Ressortir : repaire intact, choix refermé");
    enterRoom(room);
    assert(gameState.lairChoicePending === true, "Revenir : le choix est reproposé");
    declineLair();
    resetTransientState();
}

// Plonger : exactement combatsRemaining sbires, puis un boss (généré à ce moment-là) ; sa victoire nettoie le
// repaire (🏆), avec le butin d'un boss.
{
    const { room, lair } = lairSetup();
    lair.combatsRemaining = 2;
    moveToFloorRoom(room);
    enterRoom(room);
    diveIntoLair();
    assert(gameState.inCombat && gameState.pendingLairDive.stage === 'trash', "Plonger : premier sbire");
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat && gameState.pendingLairDive.stage === 'trash' && gameState.pendingLairDive.combatsLeft === 1, "Plonger : second sbire enchaîné");
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat && gameState.pendingLairDive.stage === 'boss' && lair.bossInstance && gameState.currentEnemy === lair.bossInstance, "Plonger : le boss du repaire, généré maintenant");
    gameState.inventory = [];
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(lair.cleared === true && gameState.pendingLairDive === null && !gameState.inCombat, "Boss vaincu : repaire nettoyé");
    enterRoom(room);
    assert(gameState.lairChoicePending === false && ui.sceneTitle.innerText === 'Repaire Nettoyé', "Repaire nettoyé : plus de choix en y revenant");
    resetTransientState();
}

// Fuir en pleine plongée : repaire intact, plongée annulée.
{
    const { room, lair } = lairSetup();
    moveToFloorRoom(room);
    enterRoom(room);
    diveIntoLair();
    const original = Math.random;
    Math.random = () => 0;
    try { attemptFlee(); } finally { Math.random = original; }
    assert(gameState.pendingLairDive === null && lair.cleared === false, "Fuite en pleine plongée : repaire intact, plongée annulée");
    resetTransientState();
}
