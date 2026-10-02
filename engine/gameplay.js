// engine/gameplay.js — Boucle de gameplay, écran de départ et cadeau de bienvenue.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// 2. BOUCLE DE GAMEPLAY
// ==========================================
// Salle aperçue (inconnue, voisine d'une salle visitée) la plus proche en distance de trajet depuis la
// salle courante, en ne passant que par des salles visitées (voir planTravelToRoom()). À égalité, au hasard.
function findNearestSeenRoom() {
    const fm = gameState.floorMap;
    let best = [];
    let bestDist = Infinity;
    Object.values(fm.roomsById).forEach(room => {
        if (!isRoomSeen(room)) return;
        const plan = planTravelToRoom(room.id);
        if (!plan) return;
        if (plan.distance < bestDist - 1e-9) { best = [room.id]; bestDist = plan.distance; }
        else if (Math.abs(plan.distance - bestDist) < 1e-9) best.push(room.id);
    });
    return best.length > 0 ? best[Math.floor(Math.random() * best.length)] : null;
}

// Étape d'exploration proprement dite : consomme le temps et avance vers un voisin non visité au
// hasard (ou vers `targetRoomId`, voisin inconnu choisi sur la carte). Appelée directement dès qu'un voisin non visité existe (bifurcation ou non) ; sinon,
// c'est autoTravelToNearestFrontier() qui prend le relais.
function performExploreStep(targetRoomId = null) {
    const roomsById = gameState.floorMap.roomsById;
    const current = roomsById[gameState.floorMap.currentRoomId];

    gameState.timeLeft -= 1;
    applyTimeElapsedRegen(1);
    gameState.cardsDrawnThisFloor += 1;

    playSceneDrawAnimation();

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return;
    }

    const unvisitedNeighbors = current.neighbors.filter(edge => !roomsById[edge.to].visited);
    if (unvisitedNeighbors.length === 0) {
        // Ne devrait plus arriver (explore() ne l'appelle plus dans ce cas), sécurité
        updateUI();
        return;
    }
    // `targetRoomId` (exploration depuis la carte, voir exploreFromMap()) : une salle voisine inconnue précise,
    // sinon une au hasard.
    const chosen = targetRoomId && unvisitedNeighbors.find(edge => edge.to === targetRoomId);
    const nextRoomId = chosen ? chosen.to : unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)].to;
    const nextRoom = roomsById[nextRoomId];
    announceZoneChange(current, nextRoom, moveToFloorRoom(nextRoom));

    enterRoom(nextRoom);
    recordRunEvent('explore'); // Réévalue les succès liés à l'état (PO en poche, réserve pleine…)
    updateUI();
}

// Annonce le passage d'une zone à l'autre (bloc -> avenue, avenue -> bloc, bloc -> autre quartier ; ville ->
// route sur un étage urbain).
function announceZoneChange(from, to, changedQuadrant) {
    if (isUrbanFloor()) {
        if (roomZone(to) === 'road' && roomZone(from) === 'city') logEvent("Vous quittez la ville : la route est à découvert, restez sur vos gardes.", "info");
        return;
    }
    if (roomZone(to) === 'avenue' && roomZone(from) !== 'avenue') {
        logEvent("Vous débouchez sur une avenue : large, éclairée, et pleine de monde.", "info");
    } else if (roomZone(to) === 'block' && (changedQuadrant || roomZone(from) === 'avenue')) {
        logEvent(`Vous franchissez une porte. Vous entrez dans : ${gameState.currentDistrict}.`, "info");
    }
}

// Si la salle courante n'a plus aucun voisin inconnu, part automatiquement vers la salle aperçue la plus
// proche (même trajet qu'un voyage sur carte, voir travelToRoom() : temps et embuscades selon la distance,
// puis le pas dans l'inconnu), sans demander confirmation.
function autoTravelToNearestFrontier() {
    const targetId = findNearestSeenRoom();
    if (!targetId) {
        setSceneHeader('🗺️', 'Étage Entièrement Exploré', 'Exploration', 'floorCleared');
        logEvent("Vous avez arpenté chaque recoin accessible de cet étage. Direction l'escalier ?", "info");
        updateUI();
        return;
    }
    logEvent("Ce secteur est entièrement connu : vous filez vers la zone inexplorée la plus proche.", "info");
    travelToRoom(targetId);
}

function explore() {
    if (isActionBlocked()) return; // Sécurité si combat en cours ou décision en attente
    if (gameState.hp <= 0 || gameState.timeLeft <= 0) return; // Jeu terminé
    if (!gameState.floorMap) return; // Sécurité si la carte de l'étage n'est pas encore prête

    const roomsById = gameState.floorMap.roomsById;
    const current = roomsById[gameState.floorMap.currentRoomId];
    const hasUnvisited = current.neighbors.some(edge => !roomsById[edge.to].visited);

    if (hasUnvisited) {
        // De l'inconnu à proximité (bifurcation ou non) : on explore, sans jamais demander confirmation
        performExploreStep();
        return;
    }

    // Plus rien d'inconnu ici : on file automatiquement vers la zone inexplorée la plus proche
    autoTravelToNearestFrontier();
}

// ==========================================
// ÉCRAN DE DÉPART ET CADEAU DE BIENVENUE
// ==========================================
// Poids du cadeau de bienvenue (#start-screen-overlay -> #gift-reveal-overlay) : on repart presque
// toujours avec QUELQUE CHOSE (« Rien » n'est plus qu'une mauvaise blague à 5 %), mais toujours de la
// Camelote (voir generateWelcomeGiftItem() dans generator.js) : le premier vrai équipement se gagne.
const WELCOME_GIFT_WEIGHTS = { weapon: 38, ranged: 25, armor: 17, spell: 15, nothing: 5 };

function rollWelcomeGiftType() {
    const total = Object.values(WELCOME_GIFT_WEIGHTS).reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (const type in WELCOME_GIFT_WEIGHTS) {
        if (roll < WELCOME_GIFT_WEIGHTS[type]) return type;
        roll -= WELCOME_GIFT_WEIGHTS[type];
    }
    return 'nothing';
}

// Confirme le nom du crawler (écran de départ). Le nom EST l'identifiant de sauvegarde (voir
// saveKeyForName()) : s'il correspond à une partie déjà sauvegardée, on la restaure directement
// (aucun cadeau de bienvenue pour une partie reprise) ; sinon on enchaîne sur le cadeau de bienvenue
// d'un nouveau crawler, comme avant. Le reste de la partie (carte d'étage, etc.) est déjà initialisé
// en arrière-plan (voir le lancement du jeu en bas de ce fichier) dans les deux cas.
function confirmPlayerName() {
    const raw = ui.startNameInput ? ui.startNameInput.value.trim() : "";
    // Un crawler mort (sauvegarde à 0 PV) ne revient pas : son nom repart sur un nouveau crawler.
    const buried = eraseDeadSaveForName(raw);

    if (raw && hasSaveForName(raw) && restoreSaveForName(raw)) {
        if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
        showFloorArrivalScene();
        logEvent(`Sauvegarde de [${gameState.playerName}] restaurée. Bon retour dans le Donjon.`, "success");
        updateUI();
        updateInventoryUI();
        updateSpellbookUI();
        return;
    }

    gameState.playerName = raw || gameState.playerName || "CRAWLER_01";
    if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
    gameState.saveEnabled = true;
    if (buried) logEvent(`⚰️ L'ancien [${gameState.playerName}] est mort pour de bon. Un nouveau crawler reprend son nom.`, "info");
    updateUI();
    revealWelcomeGift();
}

// Tire le cadeau de bienvenue, l'équipe directement (aucun inventaire à gérer : tout est vide à cet
// instant) et affiche l'écran de révélation avec sa blague sarcastique. Un sort de bienvenue suit la
// même règle qu'un premier équipement normal (voir equipSpell()) : le mana démarre plein.
function revealWelcomeGift() {
    const type = rollWelcomeGiftType();
    const item = type === 'nothing' ? null : generateWelcomeGiftItem(type);
    giveStarterBuffForGift(type);

    if (type === 'weapon') gameState.equipment.weapon = item;
    else if (type === 'ranged') gameState.equipment.ranged = item;
    else if (type === 'armor') {
        gameState.equipment.armor = item;
        recomputeMaxHp();
    } else if (type === 'spell') {
        gameState.equipment.spell = item;
        gameState.mana = gameState.maxMana;
    }

    if (ui.giftRevealTitle) {
        const labels = { weapon: "Une arme", ranged: "Une arme à distance", armor: "Une armure", spell: "Un parchemin de sort", nothing: "Rien du tout" };
        const icons = { weapon: '⚔️', ranged: '🏹', armor: '🛡️', spell: '📜', nothing: '🎁' };
        ui.giftRevealIcon.innerText = icons[type];
        ui.giftRevealTitle.innerText = labels[type];
        ui.giftRevealItemName.innerText = item ? formatItemDisplayName(item) : "";
        ui.giftRevealItemName.classList.toggle('hidden', !item);
        ui.giftRevealJoke.innerText = pick(flavorText.welcomeGift[type]);
        ui.giftRevealOverlay.classList.remove('hidden');
    }

    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
}

// Referme l'écran de révélation du cadeau : le joueur atterrit enfin sur l'écran de jeu habituel.
function dismissGiftReveal() {
    if (ui.giftRevealOverlay) ui.giftRevealOverlay.classList.add('hidden');
}

// Kit de test (bouton discret, voir index.html) : équipe directement 1 arme, 1 arme à distance et 1
// sort, tous au palier Légendaire (pleinement enchantés, mana au max), pour tester les mécaniques de
// combat sans dépendre du loot aléatoire. Outil de développement uniquement, sans lien avec la
// progression normale d'une run — voir generateTestKitItem()/generateTestKitSpell() (generator.js).
function giveTestKit() {
    gameState.equipment.weapon = generateTestKitItem('weapons');
    gameState.equipment.ranged = generateTestKitItem('ranged');
    gameState.equipment.spell = generateTestKitSpell();
    gameState.mana = gameState.maxMana;
    endStarterBuff();

    logEvent("🧪 Kit de test : arme, arme à distance et sort légendaires équipés.", "info");
    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
}

// DEV uniquement (menu déroulant, voir index.html) : saute directement à l'étage 3 (premier étage
// urbain), pour tester le réseau de villes sans traverser les étages précédents. Réinitialise tout
// état bloquant en cours (combat/boss/furtivité/compagnon) avant le saut, comme resetTransientState()
// le fait dans les tests — jamais d'étage à moitié configuré ni de combat fantôme après coup.
function devJumpToUrbanFloor() {
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.bossChoicePending = false;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.companionChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.pendingTravel = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;
    ui.combatZone.classList.add('hidden');
    if (ui.stairsChoiceZone) ui.stairsChoiceZone.classList.add('hidden');
    ui.bossChoiceZone.classList.add('hidden');
    ui.stealthChoiceZone.classList.add('hidden');
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.add('hidden');

    if (!gameState.race) rollDevOrigin(); // Race et classe au hasard : jamais les deux écrans de choix (chantier 13)
    hideOriginOverlays();
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    gameState.currentFloor = 2; // advanceToNextFloor() incrémente : atterrit bien sur l'étage 3 (urbain)
    advanceToNextFloor(); // Raccourci DEV : saute délibérément l'écran d'escalier
    logEvent("🛠️ DEV : saut direct à l'étage 3 (urbain).", "info");
}

// `killer` précise la cause du décès quand timeout est faux : 'trap', 'bleed', un objet ennemi
// (riposte de combat — voir resolveEnemyCounterAttack()), ou omis (filet de sécurité). Sert
// uniquement à generateEpitaph() : n'affecte aucune autre logique de fin de partie.
function gameOver(timeout = false, killer = null) {
    gameState.inCombat = true; // Bloque toute action supplémentaire
    ui.combatZone.classList.add('hidden'); // Cache la zone de combat
    triggerHeavyImpact(); // Chantier 4 : la mort du joueur est l'un des 4 moments à hiérarchie forte

    const reason = timeout
        ? "Le temps est écoulé. Le donjon s'effondre sur vous..."
        : "Vos signes vitaux sont à zéro. Fin de transmission.";

    let cause = 'timeout';
    let enemyName = null;
    if (!timeout) {
        if (killer === 'trap') {
            cause = 'trap';
        } else if (killer === 'bleed') {
            cause = 'bleed';
        } else if (killer && typeof killer === 'object') {
            // Un backfire de sort ce même tour rend la riposte qui suit responsable de la mort (voir
            // attackMagic()/tryPlayerAction() pour la pose/le reset de ce drapeau).
            cause = gameState.lastPlayerActionWasBackfire ? 'backfire' : 'combat';
            enemyName = killer.name;
        } else {
            cause = 'combat'; // Filet de sécurité si jamais appelé sans tueur précisé
        }
    }
    const bountyHunter = !!(killer && typeof killer === 'object' && killer.isBountyHunter); // Chantier 3 : épitaphe dédiée
    const epitaph = generateEpitaph({ cause, enemyName, bountyHunter });
    recordEpitaph(epitaph, { cause });
    // Succès posthumes (chantier 2) : même règle « mob très inférieur » que la nécrologie.
    const weakMob = cause === 'combat' && (gameState.level - getMobLevelEquivalent()) >= NECROLOGIE_WEAK_MOB_DELTA;
    recordRunEvent('death', { cause, weakMob });

    logEvent(reason, "danger");
    logEvent("--- GAME OVER ---", "danger");
    triggerHaptic('heavy');

    // Remplissage et affichage de l'écran Game Over (recouvre toute l'interface)
    ui.gameOverReason.innerText = reason;
    ui.gameOverFloor.innerText = gameState.currentFloor;
    ui.gameOverLevel.innerText = gameState.level;
    ui.gameOverDistrict.innerText = gameState.currentDistrict;
    if (ui.gameOverEpitaph) ui.gameOverEpitaph.innerText = epitaph;
    if (ui.gameOverAchievements) ui.gameOverAchievements.innerText = buildRunAchievementsSummary();
    renderScene('gameOver', { cause });
    ui.gameOverOverlay.classList.remove('hidden');

    updateUI();
    eraseSaveOnDeath(); // Après updateUI() (qui autosauvegarde) : le crawler mort ne sera jamais restauré
}

// Écran de victoire : déclenché en franchissant la Sortie de l'étage final (config.urbanFloors.finalFloor),
// une fois son gardien vaincu ou si elle n'était pas gardée. Même structure que gameOver(), en positif.
function winGame() {
    gameState.inCombat = true; // Bloque toute action supplémentaire, même logique que gameOver()
    gameState.hasWon = true;
    ui.combatZone.classList.add('hidden');

    logEvent("🎉 Vous franchissez la Sortie et quittez le Donjon, vivant !", "success");
    logEvent("--- VICTOIRE ---", "success");
    triggerHaptic('heavy');

    ui.winFloor.innerText = gameState.currentFloor;
    ui.winLevel.innerText = gameState.level;
    recordRunEvent('victory'); // Sortie de secours (chantier 2)
    if (ui.winAchievements) ui.winAchievements.innerText = buildRunAchievementsSummary();
    ui.winOverlay.classList.remove('hidden');

    updateUI();
}

// Redémarre entièrement une nouvelle partie. On recharge la page plutôt que de réinitialiser
// gameState champ par champ : c'est plus robuste (aucun risque d'oublier un champ imbriqué comme
// les compétences, l'équipement ou les statuts de combat) et parfaitement adapté à un rogue-like
// où une "run" terminée n'a de toute façon rien à conserver d'une partie à l'autre.
function resetGame() {
    location.reload();
}
