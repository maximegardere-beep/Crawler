// floor-transition.js — tests régression : Écran d'escalier (félicitations) : floorStats, triggerFloorTransition()/ continueFromFloorTransition().
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L1311 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Écran d'escalier (félicitations) : applyPlayerDamage()/gainXp()/addLoot()/winCombat() alimentent
// gameState.floorStats, triggerFloorTransition()/continueFromFloorTransition() dans app.js.
// ===================================================================

// applyPlayerDamage() : point de passage unique pour toute perte de PV — clampe à 0, alimente
// floorStats.damageTaken, aucun effet pour un montant nul/négatif.
{
    resetTransientState();
    gameState.hp = 50;
    applyPlayerDamage(20);
    assert(gameState.hp === 30, "applyPlayerDamage() : réduit bien les PV du montant donné");
    assert(gameState.floorStats.damageTaken === 20, "applyPlayerDamage() : alimente floorStats.damageTaken");

    applyPlayerDamage(1000);
    assert(gameState.hp === 0, "applyPlayerDamage() : clampe à 0, jamais négatif");
    assert(gameState.floorStats.damageTaken === 1020, "applyPlayerDamage() : cumule bien plusieurs appels");

    const before = gameState.floorStats.damageTaken;
    applyPlayerDamage(0);
    applyPlayerDamage(-5);
    assert(gameState.floorStats.damageTaken === before, "applyPlayerDamage() : aucun effet pour un montant nul ou négatif");
}

// gainXp()/addLoot()/winCombat() : alimentent bien gameState.floorStats (xpGained/itemsFound/mobsKilled).
{
    resetTransientState();
    gainXp(30);
    assert(gameState.floorStats.xpGained === 30, "gainXp() : alimente floorStats.xpGained");

    resetTransientState();
    addLoot(0.5);
    assert(gameState.floorStats.itemsFound === 1, "addLoot() : alimente floorStats.itemsFound (objet effectivement conservé)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Tally", hp: -9999, maxHp: 30, atk: 5, def: 2, xpReward: 10, status: {} };
    winCombat();
    assert(gameState.floorStats.mobsKilled === 1, "winCombat() : alimente floorStats.mobsKilled");
    continueFromFloorTransition(); // Reprend la main normalement (l'écran d'escalier n'est PAS testé ici)
}

// addLoot() : réserve d'équipement pleine -> l'objet n'est pas conservé, ne compte donc pas dans le tally.
{
    resetTransientState();
    gameState.inventory = [];
    for (let i = 0; i < gameState.maxInventory; i++) gameState.inventory.push({ name: `Filler ${i}`, category: 'weapons' });

    const originalRandom = Math.random;
    Math.random = () => 0; // categories[0] = 'weapons' (voir generator.js) : jamais un consommable, toujours limité
    addLoot(0);
    Math.random = originalRandom;
    assert(gameState.floorStats.itemsFound === 0, "addLoot() : réserve pleine -> objet non conservé, jamais compté dans le tally");
    gameState.inventory = []; // Ne pas polluer l'inventaire pour les tests suivants (resetTransientState() ne le touche pas)
}

// getUpcomingAnomalyAnnouncement() : tire réellement l'anomalie du PROCHAIN étage (voir anomalies.js)
// et la mémorise (gameState.pendingNextFloorAnomalies) pour rollAndApplyFloorAnomalies() — couverture
// complète du tirage/stacking/incompatibilités dans la section "Anomalies d'étage" plus bas.
{
    assert(getUpcomingAnomalyAnnouncement(1) === null, "getUpcomingAnomalyAnnouncement() : aucune anomalie annoncée pour l'étage 1 (tuto)");
    assert(getUpcomingAnomalyAnnouncement(2) === null, "getUpcomingAnomalyAnnouncement() : aucune anomalie annoncée pour l'étage 2 (tuto)");

    const announcement = getUpcomingAnomalyAnnouncement(4);
    assert(announcement !== null && typeof announcement.name === 'string' && typeof announcement.description === 'string',
        "getUpcomingAnomalyAnnouncement() : renvoie {name, description} dès qu'une anomalie est tirée (étage 4)");
    assert(gameState.pendingNextFloorAnomalies && gameState.pendingNextFloorAnomalies.floor === 4 && gameState.pendingNextFloorAnomalies.anomalies.length === 1,
        "getUpcomingAnomalyAnnouncement() : mémorise le tirage exact pour rollAndApplyFloorAnomalies()");
    gameState.pendingNextFloorAnomalies = null;
}

// triggerFloorTransition() : affiche l'écran avec le résumé de l'étage QUI VIENT DE SE TERMINER
// (avant qu'advanceToNextFloor() ne remette floorStats à zéro), bloque via floorTransitionPending
// (isActionBlocked()) — jamais gameState.inCombat, qui collisionnerait avec la logique générique
// "combat sans ennemi" ailleurs dans le code (voir commentaire dans app.js).
{
    resetTransientState();
    gameState.currentFloor = 1; // Prochain étage = 2 (tuto) : jamais d'anomalie, voir rollFloorAnomalies()
    gameState.floorStats = { mobsKilled: 3, damageTaken: 12, itemsFound: 2, xpGained: 80 };

    triggerFloorTransition();
    assert(gameState.floorTransitionPending === true, "triggerFloorTransition() : pose le flag dédié");
    assert(isActionBlocked() === true, "triggerFloorTransition() : isActionBlocked() vrai tant que l'écran est affiché");
    assert(gameState.inCombat === false, "triggerFloorTransition() : n'utilise PAS gameState.inCombat pour bloquer");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === false, "triggerFloorTransition() : affiche l'overlay");
    assert(ui.floorTransitionTitle.innerText.includes("1"), "triggerFloorTransition() : le titre mentionne l'étage qui vient de se terminer (1)");
    assert(String(ui.floorTransitionMobs.innerText) === "3" && String(ui.floorTransitionDamage.innerText) === "12"
        && String(ui.floorTransitionItems.innerText) === "2" && String(ui.floorTransitionXp.innerText) === "80",
        "triggerFloorTransition() : affiche le tally exact de l'étage qui vient de se terminer");
    assert(ui.floorTransitionAnomaly.classList.contains('hidden') === true,
        "triggerFloorTransition() : le bloc anomalie reste masqué quand getUpcomingAnomalyAnnouncement() renvoie null (étage 2, tuto)");
}

// triggerFloorTransition() : le bloc anomalie s'affiche et se remplit dès qu'une anomalie est
// annoncée pour le prochain étage (voir getUpcomingAnomalyAnnouncement()).
{
    resetTransientState();
    gameState.currentFloor = 3; // Prochain étage = 4 : anomalie garantie (pool restreint non vide)
    gameState.floorStats = { mobsKilled: 0, damageTaken: 0, itemsFound: 0, xpGained: 0 };

    triggerFloorTransition();
    assert(ui.floorTransitionAnomaly.classList.contains('hidden') === false,
        "triggerFloorTransition() : affiche le bloc anomalie dès qu'une anomalie est annoncée");
    assert(ui.floorTransitionAnomalyText.innerText.includes("Bon courage"),
        "triggerFloorTransition() : le texte d'annonce suit le gabarit attendu");
    continueFromFloorTransition();
    assert(gameState.activeAnomalies.length === 1, "continueFromFloorTransition() : applique exactement l'anomalie annoncée sur l'écran d'escalier");
}

// continueFromFloorTransition() : referme l'écran, débloque, et fait RÉELLEMENT avancer l'étage
// (advanceToNextFloor()) — jamais l'inverse (l'étage n'avance jamais avant le clic explicite).
{
    resetTransientState();
    gameState.currentFloor = 4;
    gameState.floorStats = { mobsKilled: 3, damageTaken: 12, itemsFound: 2, xpGained: 80 };
    triggerFloorTransition();

    continueFromFloorTransition();
    assert(gameState.currentFloor === 5, "continueFromFloorTransition() : fait bien passer à l'étage suivant");
    assert(gameState.floorTransitionPending === false, "continueFromFloorTransition() : referme le flag de blocage");
    assert(isActionBlocked() === false, "continueFromFloorTransition() : isActionBlocked() redevient false");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === true, "continueFromFloorTransition() : masque l'overlay");
    assert(gameState.floorStats.mobsKilled === 0 && gameState.floorStats.damageTaken === 0
        && gameState.floorStats.itemsFound === 0 && gameState.floorStats.xpGained === 0,
        "continueFromFloorTransition() (via advanceToNextFloor()) : le tally repart à zéro pour le nouvel étage");
}

// winCombat() : une victoire sur un gardien d'escalier (classique ou urbain) affiche l'écran
// d'escalier AVANT de faire avancer l'étage — jamais d'avance synchrone directe.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.pendingStairAfterCombat = true;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Gardien Test", hp: -9999, maxHp: 50, atk: 5, def: 2, xpReward: 20, status: {}, isBoss: true };

    winCombat();
    assert(gameState.currentFloor === 1, "winCombat() (gardien) : n'avance PAS l'étage directement");
    assert(gameState.floorTransitionPending === true, "winCombat() (gardien) : affiche l'écran d'escalier à la place");

    continueFromFloorTransition();
    assert(gameState.currentFloor === 2, "continueFromFloorTransition() : fait avancer l'étage après coup");
}

// advanceToNextFloor() : budget temps croissant par étage (chantier "QoL/équilibrage", Chantier E —
// voir NOTES_QOL_EQUILIBRAGE.md), config.floorTimeBudget.base + perFloor × profondeur, timeLeft
// remis EXACTEMENT à ce nouveau maxTime (comportement de reset conservé).
{
    resetTransientState();
    gameState.currentFloor = 1;
    advanceToNextFloor(); // -> étage 2
    assert(gameState.maxTime === config.floorTimeBudget.base + config.floorTimeBudget.perFloor * 1,
        "advanceToNextFloor() : maxTime suit base + perFloor × (étage - 1)");
    assert(gameState.timeLeft === gameState.maxTime, "advanceToNextFloor() : timeLeft remis exactement à maxTime");

    advanceToNextFloor(); // -> étage 3
    assert(gameState.maxTime === config.floorTimeBudget.base + config.floorTimeBudget.perFloor * 2,
        "advanceToNextFloor() : maxTime continue de grandir à chaque étage suivant");
}

// updateUI() : bandeau d'alerte escalier affiché dès timeLeft/maxTime <= 25%, masqué au-dessus,
// jamais affiché en combat même sous le seuil (chantier "QoL/équilibrage", Chantier E).
{
    resetTransientState();
    gameState.maxTime = 100;
    gameState.timeLeft = 30; // 30% : au-dessus du seuil
    gameState.inCombat = false;
    updateUI();
    assert(ui.stairAlertBanner.classList.contains('hidden') === true, "updateUI() : bandeau masqué au-dessus du seuil de 25%");

    gameState.timeLeft = 25; // Exactement 25% : sous le seuil (<=)
    updateUI();
    assert(ui.stairAlertBanner.classList.contains('hidden') === false, "updateUI() : bandeau affiché dès 25% de temps restant");

    gameState.timeLeft = 10;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Test", hp: 10, maxHp: 10, atk: 1, def: 1, status: {} };
    updateUI();
    assert(ui.stairAlertBanner.classList.contains('hidden') === true, "updateUI() : bandeau jamais affiché en combat, même sous le seuil");
}
