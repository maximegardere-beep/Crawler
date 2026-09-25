// safehouses.js — tests régression : Salle sécurisée à choix explicite (chantier "QoL/équilibrage")
// — enterRoom()/restAtSafehouse()/leaveSafehouse() dans app.js. Nouveau domaine (voir CLAUDE.md,
// section Tests) : ajouté à la liste de require() de regression.test.js.
const { assert, resetTransientState } = require('./_helpers.js');

function findSafeRoom() {
    return Object.values(gameState.floorMap.roomsById).find(r => r.type === 'safe');
}

// enterRoom() sur une salle sécurisée : plus de soin/coût de temps automatique — pose le choix en
// attente, affiche la zone, enregistre le lieu connu, isActionBlocked() devient vrai.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.hp = 50; // PV manquants : si un soin auto avait lieu, ça se verrait immédiatement
    const hpBefore = gameState.hp;
    const timeBefore = gameState.timeLeft;

    enterRoom(room);
    assert(gameState.hp === hpBefore, "enterRoom() sur une salle sécurisée ne soigne plus automatiquement");
    assert(gameState.timeLeft === timeBefore, "enterRoom() sur une salle sécurisée ne coûte rien à l'entrée elle-même");
    assert(gameState.safehouseChoicePending === true, "enterRoom() pose safehouseChoicePending");
    assert(gameState.pendingSafehouseRoomId === room.id, "enterRoom() mémorise la salle en attente");
    assert(room.visited === true, "enterRoom() marque la salle visitée comme les autres");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === false, "enterRoom() affiche #safehouse-choice-zone");
    assert(isActionBlocked() === true, "isActionBlocked() est vrai tant que le choix de salle sécurisée est en attente");
    assert(gameState.knownLocations.some(l => l.id === `safe-${room.id}`), "enterRoom() enregistre la salle comme lieu connu dès l'entrée");
}

// restAtSafehouse() : coûte config.safehouse.restCost en temps, soigne dans la fourchette configurée,
// restaure du mana à la même échelle si un sort est équipé, referme le choix.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.hp = 10;
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'melee', baseDmg: 5, manaCost: 5, category: 'scrolls' };
    gameState.mana = 10;
    const timeBefore = gameState.timeLeft;

    enterRoom(room);
    restAtSafehouse();

    assert(gameState.timeLeft === timeBefore - config.safehouse.restCost, "restAtSafehouse() déduit exactement restCost du temps");
    assert(gameState.hp > 10 && gameState.hp <= gameState.maxHp, "restAtSafehouse() soigne le joueur (clampé au max)");
    const healedAmount = gameState.hp - 10;
    assert(healedAmount >= config.safehouse.restHpMin - 1 && healedAmount <= config.safehouse.restHpMax, "restAtSafehouse() soigne dans la fourchette configurée (±1 pour l'arrondi)");
    assert(gameState.mana > 10, "restAtSafehouse() restaure aussi du mana quand un sort est équipé");
    assert(gameState.safehouseChoicePending === false, "restAtSafehouse() referme le choix");
    assert(gameState.pendingSafehouseRoomId === null, "restAtSafehouse() efface la salle en attente");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === true, "restAtSafehouse() masque #safehouse-choice-zone");
}

// leaveSafehouse() : gratuit, aucun effet, referme le choix — la salle reste un lieu connu réutilisable.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.hp = 10;
    const timeBefore = gameState.timeLeft;

    enterRoom(room);
    leaveSafehouse();

    assert(gameState.hp === 10, "leaveSafehouse() n'a aucun effet sur les PV");
    assert(gameState.timeLeft === timeBefore, "leaveSafehouse() ne coûte aucun temps");
    assert(gameState.safehouseChoicePending === false, "leaveSafehouse() referme le choix");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === true, "leaveSafehouse() masque #safehouse-choice-zone");
    assert(gameState.knownLocations.some(l => l.id === `safe-${room.id}`), "leaveSafehouse() : la salle reste un lieu connu (repartir n'annule pas l'enregistrement)");
}

// Garde-fou : le bouton Repos est désactivé (et restAtSafehouse() reste un no-op) si le coût ferait
// tomber timeLeft à 0 ou moins — le repos ne doit JAMAIS déclencher gameOver(true).
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.timeLeft = config.safehouse.restCost; // - restCost tomberait exactement à 0
    gameState.hp = 10;

    enterRoom(room);
    assert(ui.btnRestSafehouse.disabled === true, "Le bouton Repos est désactivé si le coût ferait tomber timeLeft à 0");

    restAtSafehouse(); // Appelé directement malgré le bouton désactivé : doit rester un no-op protégé
    assert(gameState.hp === 10, "restAtSafehouse() reste un no-op si le garde-fou de temps est actif");
    assert(gameState.timeLeft === config.safehouse.restCost, "restAtSafehouse() ne déduit rien si le garde-fou de temps est actif");
    assert(gameState.safehouseChoicePending === true, "restAtSafehouse() bloqué ne referme pas le choix (aucune action n'a eu lieu)");
    assert(ui.gameOverOverlay.classList.contains('hidden') === true, "Le repos ne doit jamais déclencher l'écran Game Over");
}

// REPAS_DE_FAMILLE (anomalies.js) : le repos devient gratuit en temps, jamais bloqué par le garde-fou.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.anomalyEffects.freeSafehouseMeals = true;
    gameState.timeLeft = 1; // Coût normal (2H) ferait tomber sous 0, mais gratuit ici
    gameState.hp = 10;

    enterRoom(room);
    assert(ui.btnRestSafehouse.disabled === false, "REPAS_DE_FAMILLE : le bouton Repos reste actif même à timeLeft très bas");
    restAtSafehouse();
    assert(gameState.timeLeft === 1, "REPAS_DE_FAMILLE : restAtSafehouse() ne déduit aucun temps");
    assert(gameState.hp > 10, "REPAS_DE_FAMILLE : le soin s'applique normalement malgré la gratuité");
}
