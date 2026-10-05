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
    addLoot();
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
    addLoot();
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
    assert(gameState.stairsChoicePending === true && gameState.floorTransitionPending === false, "winCombat() (gardien) : propose d'abord Descendre / Rester");
    descendStairs();
    assert(gameState.floorTransitionPending === true, "descendStairs() : affiche l'écran d'escalier");

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

// Choix « Descendre / Rester sur l'étage » (offerStairsChoice()) : escalier classique laissé pour plus
// tard, repère de carte, retour dans la salle, sauvegarde restaurée.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const stairsRoom = Object.values(gameState.floorMap.roomsById).find(r => r.guardsStairs);
    gameState.floorMap.currentRoomId = stairsRoom.id;
    gameState.pendingBossRoomId = stairsRoom.id;
    gameState.pendingStairAfterCombat = true;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Gardien Test", hp: -9999, maxHp: 50, atk: 5, def: 2, xpReward: 20, status: {}, isBoss: true };
    winCombat();

    assert(gameState.stairsChoicePending === true && isActionBlocked() === true, "Victoire sur le gardien : choix d'escalier en attente, actions bloquées");
    assert(gameState.pendingStairsChoice.kind === 'room' && gameState.pendingStairsChoice.roomId === stairsRoom.id, "Le choix mémorise la salle de l'escalier");
    assert(ui.stairsChoiceZone.classList.contains('hidden') === false, "#stairs-choice-zone est affichée");
    assert(listFloorLandmarks().some(m => m.roomId === stairsRoom.id && m.kind === 'stairs'), "L'escalier libre est tout de suite marqué 🪜 sur la carte");
    assert(!listFloorLandmarks().some(m => m.roomId === stairsRoom.id && m.kind === 'stairsGuarded'), "L'ancien repère « escalier gardé » a disparu");

    const timeBefore = gameState.timeLeft;
    stayOnFloor();
    assert(gameState.stairsChoicePending === false && gameState.pendingStairsChoice === null && isActionBlocked() === false, "Rester sur l'étage : referme le choix, le jeu reprend");
    assert(ui.stairsChoiceZone.classList.contains('hidden') === true, "Rester sur l'étage : masque la zone");
    assert(gameState.currentFloor === 1 && gameState.floorTransitionPending === false, "Rester sur l'étage : on reste bien à l'étage 1");
    assert(gameState.timeLeft === timeBefore, "Rester sur l'étage : ne coûte rien en soi");
    assert(listFloorLandmarks().some(m => m.roomId === stairsRoom.id && m.kind === 'stairs'), "Rester sur l'étage : l'escalier reste marqué sur la carte");

    enterRoom(stairsRoom);
    assert(gameState.stairsChoicePending === true, "Revenir dans la salle du gardien vaincu repropose le choix (plus d'« antre silencieuse »)");
    descendStairs();
    assert(gameState.floorTransitionPending === true && gameState.stairsChoicePending === false, "Descendre au retour : écran d'escalier");
    continueFromFloorTransition();
    assert(gameState.currentFloor === 2, "Puis l'étage suivant");

    // Un boss de quartier vaincu (pas l'escalier) garde son antre silencieuse
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const bossRoom = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'boss' && !r.guardsStairs);
    bossRoom.defeated = true;
    enterRoom(bossRoom);
    assert(gameState.stairsChoicePending === false, "Antre d'un boss de quartier vaincu : aucun choix d'escalier");

    // Boutons appelés hors choix : aucun effet
    descendStairs();
    stayOnFloor();
    assert(gameState.floorTransitionPending === false && gameState.currentFloor === 1, "descendStairs()/stayOnFloor() sans choix en attente : aucun effet");
}

// Étage urbain (villes explorables, chantier 12) : salle de l'escalier sans gardien -> choix ; rester la laisse
// marquée, y revenir repropose ; la Sortie de l'étage final reste une victoire immédiate.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    const stairsRoom = Object.values(fm.roomsById).find(r => r.type === 'stairs');
    stairsRoom.guarded = false;
    moveToFloorRoom(stairsRoom);
    enterRoom(stairsRoom);
    assert(gameState.stairsChoicePending === true && gameState.pendingStairsChoice.kind === 'room' && gameState.pendingStairsChoice.roomId === stairsRoom.id, "Escalier urbain libre : propose Descendre / Rester");
    assert(gameState.floorTransitionPending === false, "Escalier urbain libre : pas d'écran d'escalier direct");
    stayOnFloor();
    assert(gameState.stairsChoicePending === false && fm.currentRoomId === stairsRoom.id && gameState.currentFloor === 3, "Rester : on reste près de l'escalier, sur l'étage 3");
    assert(listFloorLandmarks().some(m => m.roomId === stairsRoom.id && m.icon === '🪜'), "Rester : l'escalier libre reste marqué 🪜 sur la carte");
    enterRoom(stairsRoom);
    assert(gameState.stairsChoicePending === true, "Revenir à l'escalier repropose le choix");
    descendStairs();
    assert(gameState.floorTransitionPending === true, "Descendre : écran d'escalier");

    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exitRoom = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    assert(exitRoom.isExit === true && exitRoom.guarded === true, "Étage final : la Sortie est toujours gardée");
    exitRoom.guarded = false;
    exitRoom.defeated = true; // chantier 17 : Gorgoth déjà vaincu, sinon il garde la Sortie
    gameState.hasWon = false;
    moveToFloorRoom(exitRoom);
    enterRoom(exitRoom);
    assert(gameState.hasWon === true && gameState.stairsChoicePending === false, "Sortie de l'étage final : victoire immédiate, sans choix");
    gameState.hasWon = false;
    gameState.inCombat = false;
    ui.winOverlay.classList.add('hidden');
}
