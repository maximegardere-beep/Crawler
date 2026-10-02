// engine/saves.js — Sauvegarde localStorage et nettoyage des sauvegardes.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// SAUVEGARDE (localStorage, une entrée par nom de crawler)
// ==========================================
// Une sauvegarde par nom de crawler (saisi sur l'écran de départ, voir confirmPlayerName()) :
// c'est le nom qui identifie la partie, pas un slot numéroté. Clé normalisée (espaces + casse
// ignorés) pour que "Barbara" et "barbara " pointent vers la même sauvegarde, tout en conservant la
// casse d'origine dans gameState.playerName (restaurée depuis le JSON, jamais depuis la saisie).
const SAVE_KEY_PREFIX = 'crawler-save::';

function saveKeyForName(name) {
    return SAVE_KEY_PREFIX + name.trim().toLowerCase();
}

// Sauvegarde tout gameState tel quel (y compris un éventuel combat en cours) : restoreSaveForName()
// se charge de nettoyer l'état transitoire au chargement plutôt que d'essayer de ne jamais sauver
// en pleine action, ce qui serait bien plus fragile (nombreux points d'appel à traquer).
function saveGame() {
    if (!gameState.saveEnabled || !gameState.playerName) return;
    gameState.lastSavedAt = Date.now();
    try {
        localStorage.setItem(saveKeyForName(gameState.playerName), JSON.stringify(gameState));
    } catch (e) {
        // Quota dépassé ou localStorage indisponible (navigation privée, contexte restreint...) :
        // on continue à jouer sans persistance plutôt que de planter.
    }
}

function hasSaveForName(name) {
    if (!name || !name.trim()) return false;
    try {
        return localStorage.getItem(saveKeyForName(name)) !== null;
    } catch (e) {
        return false;
    }
}

// Rogue-like : un crawler mort ne se restaure jamais. Une sauvegarde à 0 PV (mort pendant une partie, ou
// sauvegarde écrite avant ce correctif, qui se restaurait vivante à 0 PV) est simplement effacée — sans
// copie dans le slot de secours (SAVE_BACKUP_KEY) : une copie d'un crawler mort ne serait jamais jouable,
// et elle écraserait le backup d'un nettoyage manuel.
function isDeadSave(saved) {
    return !!saved && typeof saved.hp === 'number' && saved.hp <= 0;
}

// Efface la sauvegarde de `name` si c'est celle d'un crawler mort ; renvoie true si elle a été effacée.
function eraseDeadSaveForName(name) {
    if (!name || !name.trim()) return false;
    try {
        const key = saveKeyForName(name);
        const raw = localStorage.getItem(key);
        if (raw === null) return false;
        let saved = null;
        try { saved = JSON.parse(raw); } catch (e) { return false; }
        if (!isDeadSave(saved)) return false;
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

// À la mort (gameOver()) : la sauvegarde du crawler est effacée et l'autosauvegarde coupée, pour que
// retaper son nom lance un nouveau crawler plutôt qu'un cadavre à 0 PV.
function eraseSaveOnDeath() {
    if (!gameState.saveEnabled || !gameState.playerName) return;
    gameState.saveEnabled = false;
    try {
        localStorage.removeItem(saveKeyForName(gameState.playerName));
    } catch (e) {
        // Stockage indisponible : rien à effacer
    }
}

// Restaure une sauvegarde par-dessus le gameState courant (Object.assign, pas un remplacement pur :
// un champ absent d'une ancienne sauvegarde garde sa valeur par défaut plutôt que de devenir
// undefined). Atterrit TOUJOURS sur l'écran d'exploration normal, jamais en plein combat ni sur un
// choix bloquant, même si la sauvegarde datait d'un de ces instants.
function restoreSaveForName(name) {
    let raw;
    try {
        raw = localStorage.getItem(saveKeyForName(name));
    } catch (e) {
        return false;
    }
    if (!raw) return false;

    let saved;
    try {
        saved = JSON.parse(raw);
    } catch (e) {
        return false; // Sauvegarde corrompue : on ignore plutôt que de planter
    }
    if (isDeadSave(saved)) return false; // Crawler mort : jamais restauré (voir eraseDeadSaveForName())

    // Migration douce : une sauvegarde antérieure au système d'anomalies (Tâche 4) n'a pas
    // baseMaxHp — son maxHp EST alors la vraie base (aucun multiplicateur d'anomalie n'a jamais pu
    // s'y appliquer). anomalyEffects/activeAnomalies n'ont pas besoin de migration explicite : Object.assign
    // ne touche pas les clés absentes de `saved`, qui gardent donc leurs valeurs neutres déjà posées à
    // l'initialisation de gameState.
    const needsBaseMaxHpMigration = saved.baseMaxHp === undefined;
    // Sauvegarde en plein étage urbain d'avant les villes explorables (chantier 12) : ancien réseau
    // gameState.urbanMap, regénéré plus bas au nouveau format (même numéro d'étage).
    const legacyUrbanFloor = !!saved.urbanMap;

    Object.assign(gameState, saved);
    // Champs de l'ancien réseau urbain (chantier 12) : n'existent plus.
    ['urbanMap', 'pendingUrbanTravel', 'pendingUrbanBossEncounter', 'pendingUrbanBossCityId', 'pendingUrbanAdvanceAfterCombat']
        .forEach(key => { delete gameState[key]; });
    if (needsBaseMaxHpMigration) gameState.baseMaxHp = saved.maxHp || gameState.maxHp;
    // Champs de crawler absents d'une ancienne sauvegarde : jamais ceux du crawler précédemment chargé dans cette page (Object.assign ne les écrase pas).
    if (saved.starterBuff === undefined) gameState.starterBuff = null;
    if (saved.raceLastStandFloor === undefined) gameState.raceLastStandFloor = 0;
    if (saved.plotArmorFloor === undefined) gameState.plotArmorFloor = 0;
    if (saved.eliteConventionEnded === undefined) gameState.eliteConventionEnded = (saved.currentFloor || 1) > config.earlyGame.maxFloor;
    if (!saved.race || !config.origins.races[saved.race]) gameState.race = null; // ancienne sauvegarde ou clé inconnue : aucune race
    if (!saved.crawlerClass || !ORIGIN_CLASSES[saved.crawlerClass]) gameState.crawlerClass = null;
    recomputeRaceDerived();
    // Compagnon d'une sauvegarde antérieure au rework (leaveChance, pas de loyauté ni d'équipement).
    if (gameState.companion) gameState.companion = normalizeCompanion(gameState.companion);
    // Chronique / succès (chantier 2) : complétés pour une sauvegarde antérieure ou partielle.
    gameState.runStats = normalizeRunStats(saved.runStats);
    if (!gameState.runStats.maxFloor || gameState.runStats.maxFloor < gameState.currentFloor) gameState.runStats.maxFloor = gameState.currentFloor;
    if (!gameState.achievements || typeof gameState.achievements !== 'object') gameState.achievements = {};
    // Prime (chantier 3) : complétée pour une sauvegarde antérieure ; une escouade en cours est abandonnée
    // comme tout combat (on atterrit toujours sur l'exploration).
    gameState.bounty = { ...createEmptyBounty(), ...(saved.bounty || {}) };
    gameState.pendingBountySquad = 0;
    // Émission DeathWatch en cours : abandonnée comme tout choix bloquant (celle de cet étage est perdue).
    gameState.showChoicePending = false;
    gameState.pendingShow = null;
    gameState.pendingShowAfterPact = null;
    abortMinigame(); // Mini-jeu (chantier 6) ouvert à la sauvegarde : jamais restauré
    gameState.occasion = Object.assign(createOccasionState(), { pity: (saved.occasion && saved.occasion.pity) || 0 }); // Occasion en cours : jamais restaurée, la garantie oui

    // Nettoyage de l'état transitoire/bloquant
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.combatDistance = 0;
    gameState.bossChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.pendingSneakAttack = false;
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    gameState.pendingTravel = null;
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    gameState.pendingArcadeCityId = null;
    gameState.arcadeSession = null;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    gameState.pendingLairDive = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    // Choix de race/classe sauvegardé en cours : l'écran concerné est rouvert à la fin de la restauration (jamais perdu : sans lui le crawler resterait sans origine).
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    gameState.pendingPactAfterOrigin = false;
    gameState.classAbilityUsed = false;
    hideOriginOverlays();
    gameState.pendingNextFloorAnomalies = null;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    // Escalier en attente : la salle du gardien vaincu est marquée 🪜 sur la carte (listFloorLandmarks()), et une
    // ville-escalier reste sur la Carte Urbaine — le choix sera reproposé en y retournant.
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;

    // Carte d'un format antérieur (chantier 5, FLOOR_MAP_VERSION) : l'étage en cours est regénéré au nouveau
    // format (même numéro d'étage, mêmes anomalies) ; le crawler garde tout le reste.
    if (legacyUrbanFloor) {
        generateUrbanFloorMap();
        logEvent("La ville s'est réaménagée pendant votre absence : cet étage a été entièrement redessiné.", "info");
    } else if (gameState.floorMap && gameState.floorMap.version !== FLOOR_MAP_VERSION) {
        generateFloorMap();
        logEvent("Le Donjon s'est réaménagé pendant votre absence : cet étage a été entièrement redessiné.", "info");
    }

    gameState.saveEnabled = true; // Réactive l'autosave après une restauration réussie
    if (saved.classChoicePending && gameState.race) triggerClassChoice();
    else if (saved.raceChoicePending || saved.classChoicePending) triggerRaceChoice();
    return true;
}

// Noms des crawlers ayant une sauvegarde (indice affiché sur l'écran de départ) : on relit
// directement gameState.playerName DANS chaque sauvegarde plutôt que la clé normalisée, pour
// afficher la casse d'origine.
function listSavedCrawlerNames() {
    const names = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                if (saved && saved.playerName && !isDeadSave(saved)) names.push(saved.playerName);
            } catch (e) {
                // Entrée corrompue : ignorée plutôt que de faire échouer toute la liste
            }
        }
    } catch (e) {
        // localStorage indisponible : liste vide, pas d'erreur
    }
    return names;
}

// Variante détaillée de listSavedCrawlerNames() pour l'écran "Nettoyer les sauvegardes"
// (openManageSaves()) : nom, clé localStorage, étage atteint et horodatage de dernière sauvegarde.
// `floor`/`savedAt` retombent sur des valeurs neutres pour une entrée corrompue ou antérieure à
// l'ajout de `lastSavedAt` (migration douce, jamais une erreur qui casserait toute la liste).
function listSavedCrawlersDetailed() {
    const entries = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                if (saved && saved.playerName) {
                    entries.push({ name: saved.playerName, key, floor: saved.currentFloor || 1, savedAt: saved.lastSavedAt || null });
                }
            } catch (e) {
                // Entrée corrompue : ignorée plutôt que de faire échouer toute la liste
            }
        }
    } catch (e) {
        // localStorage indisponible : liste vide, pas d'erreur
    }
    return entries;
}

// Formatage d'affichage d'un horodatage de sauvegarde (voir listSavedCrawlersDetailed()) — "date
// inconnue" pour une sauvegarde antérieure à lastSavedAt, ou si l'environnement ne sait pas formater
// de date localisée (jamais une exception qui casserait l'écran de gestion des sauvegardes).
function formatSaveTimestamp(ts) {
    if (!ts) return "date inconnue";
    try {
        return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "date inconnue";
    }
}

// Rafraîchit l'indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames()) —
// extrait en fonction pour pouvoir être rappelé après une suppression/restauration depuis l'écran
// "Nettoyer les sauvegardes", en plus de l'appel initial au chargement du jeu.
function refreshStartSavesHint() {
    if (!ui.startSavesHint) return;
    const savedNames = listSavedCrawlerNames();
    ui.startSavesHint.classList.toggle('hidden', savedNames.length === 0);
    ui.startSavesHint.innerText = savedNames.length ? `Sauvegardes disponibles : ${savedNames.join(', ')}` : '';
}

// ==========================================
// GESTION DES SAUVEGARDES (écran de départ -> "Nettoyer les sauvegardes")
// ==========================================
// Slot de backup UNIQUE (pas un historique) : écrasé à chaque nettoyage (suppression individuelle ou
// totale), toujours au format { savedAt, entries: [{key, data}] } où `data` est le JSON brut de la
// sauvegarde (round-trip exact, sans re-sérialiser gameState). `pendingSaveDeletion` retient l'action
// en attente de confirmation ({ mode: 'single', name } ou { mode: 'all' }) — jamais de suppression
// sans passer par cet état, la confirmation est donc structurellement obligatoire.
const SAVE_BACKUP_KEY = 'crawler-save-backup';
let pendingSaveDeletion = null;

// Ouvre l'écran de gestion des sauvegardes depuis l'écran de départ.
function openManageSaves() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    updateManageSavesUI();
    if (ui.manageSavesOverlay) ui.manageSavesOverlay.classList.remove('hidden');
}

function closeManageSaves() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    if (ui.manageSavesOverlay) ui.manageSavesOverlay.classList.add('hidden');
}

// Reconstruit la liste des sauvegardes + la visibilité du bouton "Restaurer le backup" (masqué tant
// qu'aucun backup n'existe).
function updateManageSavesUI() {
    if (!ui.manageSavesList) return;
    const entries = listSavedCrawlersDetailed();

    ui.manageSavesList.innerHTML = "";
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic text-center py-2";
        empty.innerText = "Aucune sauvegarde sur cet appareil.";
        ui.manageSavesList.appendChild(empty);
    }
    entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center gap-2 px-2 py-1.5 bg-gray-950/80 border border-gray-800 rounded";
        row.innerHTML = `
            <div class="flex flex-col overflow-hidden text-left">
                <span class="text-gray-200 font-bold text-[11px] truncate">${entry.name}</span>
                <span class="text-gray-600 text-[9px]">Étage ${entry.floor} · ${formatSaveTimestamp(entry.savedAt)}</span>
            </div>
        `;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = "shrink-0 text-red-500 hover:text-red-300 text-sm px-1 transition-colors";
        deleteBtn.innerText = "🗑️";
        deleteBtn.addEventListener('click', () => requestDeleteSave(entry.name));
        row.appendChild(deleteBtn);
        ui.manageSavesList.appendChild(row);
    });

    if (ui.btnManageSavesRestoreBackup) {
        let hasBackup = false;
        try { hasBackup = localStorage.getItem(SAVE_BACKUP_KEY) !== null; } catch (e) { /* indisponible */ }
        ui.btnManageSavesRestoreBackup.classList.toggle('hidden', !hasBackup);
    }
}

// Demande confirmation avant de supprimer UNE sauvegarde (bouton 🗑️ d'une ligne).
function requestDeleteSave(name) {
    pendingSaveDeletion = { mode: 'single', name };
    if (ui.manageSavesConfirmText) {
        ui.manageSavesConfirmText.innerText = `Supprimer définitivement la sauvegarde de "${name}" ? Cette action est irréversible (un backup sera conservé, voir "Restaurer le dernier backup").`;
    }
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.remove('hidden');
}

// Demande confirmation avant de supprimer TOUTES les sauvegardes (bouton "Tout supprimer").
function requestDeleteAllSaves() {
    pendingSaveDeletion = { mode: 'all' };
    if (ui.manageSavesConfirmText) {
        ui.manageSavesConfirmText.innerText = "Supprimer DÉFINITIVEMENT toutes les sauvegardes de cet appareil ? Cette action est irréversible (un backup sera conservé, voir \"Restaurer le dernier backup\").";
    }
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.remove('hidden');
}

function cancelSaveDeletion() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
}

// Exécute la suppression (individuelle ou totale) demandée, après confirmation explicite. Sauvegarde
// d'abord TOUTES les entrées concernées dans le slot de backup unique (écrase un backup précédent —
// "écrasé à chaque nettoyage"), puis les retire réellement de localStorage.
function confirmSaveDeletion() {
    if (!pendingSaveDeletion) return;
    const allEntries = listSavedCrawlersDetailed();
    const toDelete = pendingSaveDeletion.mode === 'all'
        ? allEntries
        : allEntries.filter(e => e.name === pendingSaveDeletion.name);

    if (toDelete.length > 0) {
        try {
            const backup = {
                savedAt: Date.now(),
                entries: toDelete.map(e => ({ key: e.key, data: localStorage.getItem(e.key) }))
            };
            localStorage.setItem(SAVE_BACKUP_KEY, JSON.stringify(backup));
            toDelete.forEach(e => localStorage.removeItem(e.key));
            logEvent(
                pendingSaveDeletion.mode === 'all'
                    ? `🧹 ${toDelete.length} sauvegarde(s) supprimée(s) (backup conservé).`
                    : `🧹 Sauvegarde de "${pendingSaveDeletion.name}" supprimée (backup conservé).`,
                "info"
            );
        } catch (e) {
            logEvent("Échec de la suppression (stockage indisponible).", "danger");
        }
    }

    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    updateManageSavesUI();
    refreshStartSavesHint();
}

// Restaure le backup unique (voir confirmSaveDeletion()) : réécrit chaque entrée à sa clé d'origine,
// écrasant une éventuelle sauvegarde du même nom recréée depuis. N'efface pas le backup lui-même
// (restaurable plusieurs fois de suite sans repasser par une suppression).
function restoreSavesBackup() {
    let raw;
    try {
        raw = localStorage.getItem(SAVE_BACKUP_KEY);
    } catch (e) {
        return;
    }
    if (!raw) return;

    let backup;
    try {
        backup = JSON.parse(raw);
    } catch (e) {
        return; // Backup corrompu : on ignore plutôt que de planter
    }
    if (!backup || !Array.isArray(backup.entries)) return;

    let restoredCount = 0;
    backup.entries.forEach(entry => {
        if (!entry || !entry.key || entry.data === undefined) return;
        try {
            localStorage.setItem(entry.key, entry.data);
            restoredCount++;
        } catch (e) {
            // Une entrée en échec ne doit pas bloquer les suivantes
        }
    });

    logEvent(`♻️ ${restoredCount} sauvegarde(s) restaurée(s) depuis le backup.`, "success");
    updateManageSavesUI();
    refreshStartSavesHint();
}
