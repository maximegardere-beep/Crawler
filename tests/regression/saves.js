// saves.js — tests régression : Sauvegarde (localStorage) : saveGame()/restoreSaveForName()/hasSaveForName()/ listSavedCrawlerNames(), et l'écran de gestion (Nettoyer les sauvegardes).
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L1047-1185 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Sauvegarde (localStorage, une entrée par nom de crawler) : saveGame()/restoreSaveForName()/
// hasSaveForName()/listSavedCrawlerNames() dans app.js, identification par le nom saisi sur l'écran
// de départ (voir confirmPlayerName()).
// ===================================================================
{
    localStorage.clear();

    // saveKeyForName() : espaces superflus et casse ignorés
    assert(saveKeyForName("  Barbara  ") === saveKeyForName("BARBARA"), "saveKeyForName() : espaces et casse ignorés");

    // saveGame() : no-op tant que saveEnabled est faux
    resetTransientState();
    gameState.playerName = "Test Sauvegarde";
    gameState.saveEnabled = false;
    saveGame();
    assert(!hasSaveForName("Test Sauvegarde"), "saveGame() : aucune écriture tant que saveEnabled est faux");

    // saveGame() : écrit bien sous la clé du nom une fois activé
    gameState.saveEnabled = true;
    gameState.currentFloor = 4;
    gameState.level = 7;
    saveGame();
    assert(hasSaveForName("Test Sauvegarde"), "saveGame() : écrit sous la clé du nom du crawler une fois activé");
    assert(hasSaveForName("  test sauvegarde  "), "hasSaveForName() : casse et espaces ignorés à la lecture aussi");
}

// restoreSaveForName() : restaure l'état sauvegardé, mais nettoie systématiquement tout état
// transitoire/bloquant (jamais de restauration en plein combat ou sur un choix en attente).
{
    resetTransientState();
    gameState.playerName = "Mordicaï le Sauvé";
    gameState.saveEnabled = true;
    gameState.currentFloor = 5;
    gameState.level = 9;
    gameState.hp = 42;
    gameState.equipment.weapon = { name: "Hache de Sauvegarde", baseDmg: 20, category: 'weapons' };
    // État transitoire volontairement "sale" au moment de la sauvegarde
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Ne devrait jamais revenir", hp: 50, maxHp: 50, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 5;
    gameState.bossChoicePending = true;
    saveGame();

    resetTransientState(); // Simule un rechargement de page : repart d'un état neuf
    const ok = restoreSaveForName("mordicaï le sauvé");
    assert(ok === true, "restoreSaveForName() : réussit pour un nom sauvegardé (insensible à la casse)");
    assert(gameState.playerName === "Mordicaï le Sauvé", "restoreSaveForName() : conserve la casse d'origine du nom sauvegardé");
    assert(gameState.currentFloor === 5 && gameState.level === 9 && gameState.hp === 42, "restoreSaveForName() : restaure bien la progression sauvegardée");
    assert(gameState.equipment.weapon && gameState.equipment.weapon.name === "Hache de Sauvegarde", "restoreSaveForName() : restaure bien l'équipement sauvegardé");
    assert(gameState.inCombat === false && gameState.currentEnemy === null, "restoreSaveForName() : ne restaure jamais en plein combat");
    assert(gameState.combatDistance === 0, "restoreSaveForName() : réinitialise l'écart de combat");
    assert(gameState.bossChoicePending === false, "restoreSaveForName() : ne restaure jamais sur un choix de boss en attente");
    assert(gameState.saveEnabled === true, "restoreSaveForName() : réactive l'autosauvegarde");
}

// restoreSaveForName() : migration douce d'une sauvegarde ANTÉRIEURE au système d'anomalies
// (Tâche 4) — pas de baseMaxHp dans le JSON brut : son maxHp d'alors devient la vraie base, jamais
// silencieusement retombé sur 100 (ce qui léserait un personnage déjà bien monté en niveau).
{
    resetTransientState();
    const rawOldSave = {
        playerName: "Ancien Crawler",
        currentFloor: 6,
        level: 12,
        hp: 200,
        maxHp: 250, // Ancienne sauvegarde : maxHp EST la base, aucun système d'anomalies n'existait
        atk: 30,
        def: 15
        // baseMaxHp, anomalyEffects, activeAnomalies : absents, comme toute sauvegarde pré-Tâche-4
    };
    localStorage.setItem(saveKeyForName("Ancien Crawler"), JSON.stringify(rawOldSave));

    resetTransientState();
    const ok = restoreSaveForName("ancien crawler");
    assert(ok === true, "restoreSaveForName() : restaure bien une sauvegarde brute sans baseMaxHp");
    assert(gameState.baseMaxHp === 250, "restoreSaveForName() : migration douce -> baseMaxHp reprend l'ancien maxHp (250), jamais le défaut 100");
    assert(gameState.maxHp === 250, "restoreSaveForName() : maxHp reste cohérent (aucune anomalie active à la restauration)");
    assert(gameState.activeAnomalies.length === 0 && gameState.anomalyEffects.allDamageMult === 1,
        "restoreSaveForName() : anomalyEffects/activeAnomalies retombent sur leurs valeurs neutres, jamais undefined");
    assert(gameState.pactChoicePending === false, "restoreSaveForName() : ne restaure jamais sur un Pacte du Crawler en attente");
}

// restoreSaveForName() : échec propre pour un nom sans sauvegarde, sans toucher au gameState.
{
    resetTransientState();
    gameState.playerName = "Inchangé";
    const ok = restoreSaveForName("Ce Crawler N'Existe Pas");
    assert(ok === false, "restoreSaveForName() : renvoie false pour un nom sans sauvegarde");
    assert(gameState.playerName === "Inchangé", "restoreSaveForName() : ne touche pas au gameState en cas d'échec");
}

// listSavedCrawlerNames() : recense les sauvegardes existantes, ignore les entrées corrompues.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Chip Cachalot";
    gameState.saveEnabled = true;
    saveGame();
    resetTransientState();
    gameState.playerName = "Nadia Sans-Peur";
    gameState.saveEnabled = true;
    saveGame();
    localStorage.setItem(SAVE_KEY_PREFIX + "corrompu", "{ceci n'est pas du JSON valide");

    const names = listSavedCrawlerNames();
    assert(names.includes("Chip Cachalot") && names.includes("Nadia Sans-Peur"), "listSavedCrawlerNames() : recense toutes les sauvegardes valides");
    assert(names.length === 2, "listSavedCrawlerNames() : ignore silencieusement l'entrée corrompue");
}

// confirmPlayerName() : reprend une partie existante (pas de cadeau) si le nom saisi correspond à
// une sauvegarde, sinon démarre un nouveau crawler (avec cadeau) comme avant.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Gunther l'Endurci";
    gameState.saveEnabled = true;
    gameState.currentFloor = 3;
    saveGame();

    resetTransientState();
    ui.startNameInput.value = "gunther l'endurci"; // Casse différente : doit quand même reprendre
    ui.startScreenOverlay.classList.remove('hidden');
    ui.giftRevealOverlay.classList.add('hidden');
    confirmPlayerName();
    assert(gameState.playerName === "Gunther l'Endurci", "confirmPlayerName() : reprend la sauvegarde existante (casse d'origine)");
    assert(gameState.currentFloor === 3, "confirmPlayerName() : restaure bien la progression de la sauvegarde reprise");
    assert(ui.startScreenOverlay.classList.contains('hidden'), "confirmPlayerName() : masque l'écran de départ même en reprenant une partie");
    assert(ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : aucun cadeau de bienvenue pour une partie reprise");

    resetTransientState();
    ui.startNameInput.value = "Un Tout Nouveau Crawler";
    confirmPlayerName();
    assert(gameState.playerName === "Un Tout Nouveau Crawler", "confirmPlayerName() : nom inédit -> nouveau crawler");
    assert(!ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : cadeau de bienvenue bien déclenché pour un nouveau crawler");
    assert(gameState.saveEnabled === true, "confirmPlayerName() : active l'autosauvegarde pour un nouveau crawler aussi");
}

// ===================================================================
// Gestion des sauvegardes (écran "Nettoyer les sauvegardes") : listSavedCrawlersDetailed(),
// requestDeleteSave()/requestDeleteAllSaves()/cancelSaveDeletion()/confirmSaveDeletion(),
// restoreSavesBackup(). Voir CLAUDE.md.
// ===================================================================

// listSavedCrawlersDetailed() : nom + étage + horodatage par sauvegarde, entrée corrompue ignorée.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Detail Un";
    gameState.saveEnabled = true;
    gameState.currentFloor = 6;
    saveGame();
    resetTransientState();
    gameState.playerName = "Detail Deux";
    gameState.saveEnabled = true;
    gameState.currentFloor = 11;
    saveGame();
    localStorage.setItem(SAVE_KEY_PREFIX + "corrompu", "{pas du json");

    const entries = listSavedCrawlersDetailed();
    assert(entries.length === 2, "listSavedCrawlersDetailed() : ignore l'entrée corrompue");
    const one = entries.find(e => e.name === "Detail Un");
    assert(!!one && one.floor === 6 && typeof one.savedAt === 'number', "listSavedCrawlersDetailed() : étage et horodatage corrects");
}

// formatSaveTimestamp() : jamais d'exception, "date inconnue" pour une valeur absente.
{
    assert(formatSaveTimestamp(null) === "date inconnue", "formatSaveTimestamp() : null -> date inconnue");
    assert(formatSaveTimestamp(undefined) === "date inconnue", "formatSaveTimestamp() : undefined -> date inconnue");
    assert(typeof formatSaveTimestamp(Date.now()) === 'string' && formatSaveTimestamp(Date.now()) !== "date inconnue",
        "formatSaveTimestamp() : un horodatage valide produit une date formatée");
}

// requestDeleteSave()/confirmSaveDeletion() : supprime UNE sauvegarde après confirmation, sauvegarde
// d'abord son contenu dans le slot de backup unique (jamais de suppression sans passer par
// pendingSaveDeletion, donc jamais sans confirmation explicite de l'appelant).
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "À Supprimer";
    gameState.saveEnabled = true;
    gameState.currentFloor = 4;
    saveGame();
    resetTransientState();
    gameState.playerName = "À Garder";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteSave("À Supprimer");
    assert(pendingSaveDeletion && pendingSaveDeletion.mode === 'single' && pendingSaveDeletion.name === "À Supprimer",
        "requestDeleteSave() : pose l'action en attente, ne supprime rien tout de suite");
    assert(hasSaveForName("À Supprimer"), "requestDeleteSave() : la sauvegarde existe toujours avant confirmation");

    confirmSaveDeletion();
    assert(!hasSaveForName("À Supprimer"), "confirmSaveDeletion() : supprime bien la sauvegarde visée après confirmation");
    assert(hasSaveForName("À Garder"), "confirmSaveDeletion() : ne touche jamais aux autres sauvegardes (suppression individuelle)");
    assert(pendingSaveDeletion === null, "confirmSaveDeletion() : referme l'action en attente");

    const backupRaw = localStorage.getItem(SAVE_BACKUP_KEY);
    assert(!!backupRaw, "confirmSaveDeletion() : écrit un backup avant de supprimer");
    const backup = JSON.parse(backupRaw);
    assert(backup.entries.length === 1 && backup.entries[0].key === saveKeyForName("À Supprimer"),
        "confirmSaveDeletion() : le backup contient exactement la sauvegarde supprimée");
}

// cancelSaveDeletion() : n'importe quelle suppression en attente peut être annulée sans effet.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Jamais Supprimé";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteSave("Jamais Supprimé");
    cancelSaveDeletion();
    assert(pendingSaveDeletion === null, "cancelSaveDeletion() : referme l'action en attente");
    assert(hasSaveForName("Jamais Supprimé"), "cancelSaveDeletion() : la sauvegarde n'est jamais supprimée");
}

// requestDeleteAllSaves()/confirmSaveDeletion() : supprime TOUTES les sauvegardes, toutes présentes
// dans le backup (écrasant un backup précédent).
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Tous Un";
    gameState.saveEnabled = true;
    saveGame();
    resetTransientState();
    gameState.playerName = "Tous Deux";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteAllSaves();
    assert(pendingSaveDeletion && pendingSaveDeletion.mode === 'all', "requestDeleteAllSaves() : pose l'action 'all' en attente");
    confirmSaveDeletion();
    assert(listSavedCrawlerNames().length === 0, "confirmSaveDeletion() (mode 'all') : supprime bien toutes les sauvegardes");
    const backup = JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY));
    assert(backup.entries.length === 2, "confirmSaveDeletion() (mode 'all') : le backup contient bien les DEUX sauvegardes supprimées");
}

// restoreSavesBackup() : réécrit chaque entrée du backup à sa clé d'origine, jamais d'exception sur
// un backup absent/corrompu.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Restaurable";
    gameState.saveEnabled = true;
    gameState.currentFloor = 9;
    saveGame();
    requestDeleteAllSaves();
    confirmSaveDeletion();
    assert(!hasSaveForName("Restaurable"), "setup : la sauvegarde est bien supprimée avant de tester la restauration");

    restoreSavesBackup();
    assert(hasSaveForName("Restaurable"), "restoreSavesBackup() : la sauvegarde réapparaît après restauration");
    const ok = restoreSaveForName("Restaurable");
    assert(ok && gameState.currentFloor === 9, "restoreSavesBackup() : le contenu restauré est bien celui d'avant suppression");

    localStorage.removeItem(SAVE_BACKUP_KEY);
    restoreSavesBackup(); // Aucun backup : ne doit jamais lever d'exception
    localStorage.setItem(SAVE_BACKUP_KEY, "{pas du json");
    restoreSavesBackup(); // Backup corrompu : idem
}
