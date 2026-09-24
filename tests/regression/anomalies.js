// anomalies.js — tests régression : Anomalies d'étage (anomalies.js) : tirage, incompatibilités, stacking, appliquerAnomalie(), câblage dans app.js, + validation Tâche 5 (régén=0, robustesse, migration).
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L1631-1844 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Anomalies d'étage (anomalies.js) : tirage par tranche, incompatibilités, stacking des effets,
// hook appliquerAnomalie(), et câblage dans app.js (dégâts, PV max, furtivité, XP, PACTE_DU_CRAWLER).
// ===================================================================

// rollFloorAnomalies() : règles d'intensité par tranche d'étage.
{
    for (const floor of [1, 2]) {
        assert(rollFloorAnomalies(floor).length === 0, `rollFloorAnomalies(${floor}) : aucune anomalie sur les étages tuto`);
    }
    for (let i = 0; i < 30; i++) {
        const rolled = rollFloorAnomalies(3 + (i % 4)); // étages 3 à 6
        assert(rolled.length === 1, "rollFloorAnomalies() : exactement 1 anomalie sur les étages 3-6");
        assert(rolled[0].intensiteMin <= 3, "rollFloorAnomalies() : étages 3-6 -> uniquement le pool restreint (intensiteMin <= 3)");
    }
    for (let i = 0; i < 30; i++) {
        const rolled = rollFloorAnomalies(7 + (i % 5)); // étages 7 à 11
        assert(rolled.length === 1, "rollFloorAnomalies() : exactement 1 anomalie sur les étages 7-11");
    }
    let sawFullPoolAnomaly = false;
    for (let i = 0; i < 60; i++) {
        const rolled = rollFloorAnomalies(12);
        if (rolled.some(a => a.intensiteMin > 3)) sawFullPoolAnomaly = true;
    }
    assert(sawFullPoolAnomaly, "rollFloorAnomalies() : étages 7-11 -> pool complet (pas seulement intensiteMin <= 3), constaté sur 60 tirages");
}

// rollFloorAnomalies() : étages 12+ -> 2 anomalies, toujours compatibles, jamais 2 bonus purs.
{
    for (let i = 0; i < 60; i++) {
        const rolled = rollFloorAnomalies(12 + (i % 6));
        assert(rolled.length === 1 || rolled.length === 2, "rollFloorAnomalies() : étages 12+ -> 1 (repli) ou 2 anomalies, jamais plus");
        if (rolled.length === 2) {
            assert(anomaliesAreCompatible(rolled[0], rolled[1]), "rollFloorAnomalies() : la paire tirée est toujours compatible (table d'incompatibilités)");
            const atLeastOneNonPositif = rolled.some(a => a.tags.includes('negatif') || a.tags.includes('mixte'));
            assert(atLeastOneNonPositif, "rollFloorAnomalies() : au moins une des deux anomalies n'est pas purement positive");
        }
    }
}

// anomaliesAreCompatible() : les deux paires explicitement interdites par la consigne le sont bien,
// dans les deux sens.
{
    const secheresse = findAnomalyById('SECHERESSE');
    const zoneMagique = findAnomalyById('ZONE_MAGIQUE');
    const peauDeVerre = findAnomalyById('PEAU_DE_VERRE');
    const adrenaline = findAnomalyById('ADRENALINE');
    assert(anomaliesAreCompatible(secheresse, zoneMagique) === false, "anomaliesAreCompatible() : SECHERESSE + ZONE_MAGIQUE interdit");
    assert(anomaliesAreCompatible(zoneMagique, secheresse) === false, "anomaliesAreCompatible() : interdiction symétrique (ZONE_MAGIQUE + SECHERESSE)");
    assert(anomaliesAreCompatible(peauDeVerre, adrenaline) === false, "anomaliesAreCompatible() : PEAU_DE_VERRE + ADRENALINE interdit");
    assert(anomaliesAreCompatible(adrenaline, peauDeVerre) === false, "anomaliesAreCompatible() : interdiction symétrique (ADRENALINE + PEAU_DE_VERRE)");
    assert(anomaliesAreCompatible(secheresse, adrenaline) === true, "anomaliesAreCompatible() : une paire non listée reste compatible");
    assert(anomaliesAreCompatible(secheresse, secheresse) === false, "anomaliesAreCompatible() : une anomalie n'est jamais compatible avec elle-même");
}

// computeAnomalyEffects() : stacking multiplicatif sur une même stat (2 anomalies ATK-mult -> produit
// des deux), additif sur les bonus en points, fonction PURE (hors gameState).
{
    const doubleAdrenaline = computeAnomalyEffects([
        { effects: { allDamageMult: 1.4 } },
        { effects: { allDamageMult: 1.2 } }
    ]);
    assert(Math.abs(doubleAdrenaline.allDamageMult - 1.68) < 1e-9, "computeAnomalyEffects() : stacking multiplicatif exact (1.4 × 1.2 = 1.68)");

    const stackedPoints = computeAnomalyEffects([
        { effects: { stealthCapBonus: 10, detectionBonus: 10 } },
        { effects: { stealthCapBonus: 5 } }
    ]);
    assert(stackedPoints.stealthCapBonus === 15, "computeAnomalyEffects() : stacking additif sur les bonus en points");
    assert(stackedPoints.detectionBonus === 10, "computeAnomalyEffects() : un champ non partagé n'est pas affecté par l'autre anomalie");

    const neutral = computeAnomalyEffects([]);
    assert(neutral.allDamageMult === 1 && neutral.playerMaxHpMult === 1 && neutral.forcedPactChoice === false,
        "computeAnomalyEffects() : une liste vide renvoie des effets strictement neutres");
}

// appliquerAnomalie() : hook UNIQUE, mute bien gameState.anomalyEffects (jamais un objet séparé).
{
    resetTransientState();
    const mobEnrage = findAnomalyById('MOB_ENRAGE');
    appliquerAnomalie(5, mobEnrage);
    assert(gameState.anomalyEffects.mobAtkMult === 1.15, "appliquerAnomalie() : applique l'effet ATQ de MOB_ENRAGE sur gameState.anomalyEffects");
    assert(gameState.anomalyEffects.xpMult === 1.3, "appliquerAnomalie() : applique l'effet XP de MOB_ENRAGE sur gameState.anomalyEffects");
}

// Intégration : rollDamage() applique allDamageMult (ADRENALINE) symétriquement joueur/mobs.
{
    resetTransientState();
    const before = rollDamage(100, 20, { varianceRange: 0 });
    gameState.anomalyEffects.allDamageMult = 1.4;
    const after = rollDamage(100, 20, { varianceRange: 0 });
    assert(Math.abs(after - before * 1.4) <= 1, "rollDamage() : ADRENALINE (allDamageMult) multiplie bien le résultat final");
}

// Intégration : gainXp() applique xpMult (MOB_ENRAGE).
{
    resetTransientState();
    gameState.anomalyEffects.xpMult = 1.3;
    gainXp(100);
    assert(gameState.xp + (gameState.level > 1 ? gameState.xpToNextLevel : 0) >= 129, "gainXp() : xpMult multiplie bien le montant gagné (100 -> 130)");
}

// Intégration : recomputeMaxHp() (PEAU_DE_VERRE) — PV max dérivé de baseMaxHp, jamais l'inverse.
{
    resetTransientState();
    gameState.baseMaxHp = 100;
    gameState.hp = 100;
    gameState.anomalyEffects.playerMaxHpMult = 0.7;
    recomputeMaxHp();
    assert(gameState.maxHp === 70, "recomputeMaxHp() : applique playerMaxHpMult à baseMaxHp (100 -> 70)");
    assert(gameState.hp === 70, "recomputeMaxHp() : clampe gameState.hp au nouveau maximum s'il le dépasse");

    gameState.anomalyEffects.playerMaxHpMult = 1;
    recomputeMaxHp();
    assert(gameState.maxHp === 100, "recomputeMaxHp() : revient à la vraie base une fois l'anomalie retombée à neutre");
}

// Intégration : applyPlayerHeal() (PEAU_DE_VERRE : healingMult) — soin réellement appliqué renvoyé,
// toujours clampé à gameState.maxHp.
{
    resetTransientState();
    gameState.hp = 50;
    gameState.anomalyEffects.healingMult = 1.5;
    const healed = applyPlayerHeal(20);
    assert(healed === 30, "applyPlayerHeal() : applique healingMult (20 × 1.5 = 30)");
    assert(gameState.hp === 80, "applyPlayerHeal() : PV effectivement augmentés du montant boosté");

    gameState.hp = gameState.maxHp - 5;
    const clamped = applyPlayerHeal(50);
    assert(clamped === 5, "applyPlayerHeal() : le soin RENVOYÉ reste clampé à gameState.maxHp, jamais le montant brut boosté");
}

// Intégration : getStealthChance()/attemptStealthEvasion() (NOCTURNE : stealthCapBonus/detectionBonus).
{
    resetTransientState();
    gameState.skills.stealth.level = 20; // Sature largement le plafond de base (60%)
    const baseline = getStealthChance();
    assert(baseline === 60, "getStealthChance() : plafonne à 60% sans anomalie");

    gameState.anomalyEffects.stealthCapBonus = 10;
    gameState.anomalyEffects.detectionBonus = 10;
    const withNocturne = getStealthChance();
    assert(withNocturne === 70, "getStealthChance() (NOCTURNE) : à compétence saturée, le plafond relevé (+10) domine malgré la pénalité de détection");

    gameState.skills.stealth.level = 1; // Chance de base faible : la pénalité de détection doit mordre
    const lowSkillPenalized = getStealthChance();
    const withoutAnomaly = (() => { gameState.anomalyEffects.stealthCapBonus = 0; gameState.anomalyEffects.detectionBonus = 0; return getStealthChance(); })();
    assert(lowSkillPenalized === withoutAnomaly - 10, "getStealthChance() (NOCTURNE) : pénalise bien un faible investissement en Furtivité");
}

// Intégration : gainSkillXp() (TEMPO_CREE : skillXpPerActionBonus).
{
    resetTransientState();
    gameState.skills.weapon.xp = 0;
    gainSkillXp('weapon', 3);
    const withoutBonus = gameState.skills.weapon.xp;

    resetTransientState();
    gameState.skills.weapon.xp = 0;
    gameState.anomalyEffects.skillXpPerActionBonus = 1;
    gainSkillXp('weapon', 3);
    assert(gameState.skills.weapon.xp === withoutBonus + 1, "gainSkillXp() (TEMPO_CREE) : +1 XP de compétence supplémentaire par action");
}

// PACTE_DU_CRAWLER : choix forcé, delta appliqué directement puis annulé au tout début du PROCHAIN
// advanceToNextFloor() — jamais un multiplicateur permanent.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.atk = 10;
    gameState.baseMaxHp = 100;
    recomputeMaxHp();
    triggerPactChoice();
    assert(gameState.pactChoicePending === true, "triggerPactChoice() : pose le flag dédié");
    assert(isActionBlocked() === true, "triggerPactChoice() : isActionBlocked() vrai tant que le choix est en attente");

    choosePactBlessing('atk');
    assert(gameState.pactChoicePending === false, "choosePactBlessing() : referme le choix");
    assert(gameState.atk === 10 + PACT_BLESSING_ATK_BONUS, "choosePactBlessing('atk') : applique le bonus d'ATQ");
    assert(gameState.baseMaxHp === 100 - PACT_BLESSING_ATK_HP_PENALTY, "choosePactBlessing('atk') : applique le malus de PV max");
    assert(gameState.pactBlessingDelta.atk === PACT_BLESSING_ATK_BONUS && gameState.pactBlessingDelta.hp === -PACT_BLESSING_ATK_HP_PENALTY,
        "choosePactBlessing('atk') : mémorise le delta exact pour la réversion");

    // La réversion se fait au tout début du PROCHAIN advanceToNextFloor(), avant même le tirage des
    // nouvelles anomalies de cet étage (étage 2, tuto -> generateFloorMap() classique).
    advanceToNextFloor();
    assert(gameState.atk === 10, "advanceToNextFloor() : annule le bonus d'ATQ du Pacte de l'étage précédent");
    assert(gameState.baseMaxHp === 100, "advanceToNextFloor() : annule le malus de PV max du Pacte de l'étage précédent");
    assert(gameState.pactBlessingDelta === null, "advanceToNextFloor() : le delta est consommé, jamais réappliqué deux fois");
}

// CAFET_ASSOMBRIE : une pièce taguée room.cafetRoom déclenche piège + trésor à la première visite,
// jamais aux visites suivantes (déjà consommé par enterRoom()/triggerCafetRoom()).
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'normal' && !r.visited);
    room.cafetRoom = true;
    gameState.floorMap.currentRoomId = room.id;
    gameState.inventory = [];

    const hpBefore = gameState.hp;
    enterRoom(room);
    assert(gameState.hp < hpBefore, "triggerCafetRoom() : inflige bien des dégâts de piège à la première visite");
    assert(room.visited === true, "enterRoom() : marque la pièce visitée comme n'importe quelle autre pièce");

    const hpAfterFirst = gameState.hp;
    enterRoom(room); // Deuxième visite : chemin connu normal, plus de piège
    assert(gameState.hp === hpAfterFirst, "enterRoom() : ne redéclenche jamais le piège de CAFET_ASSOMBRIE à une visite ultérieure");
    gameState.inventory = [];
}

// ===================================================================
// Tâche 5 — Validation supplémentaire : régénération=0 gérée dans le code de soin existant (pas un
// cas spécial dans l'anomalie elle-même), robustesse du tirage sur un grand nombre d'étages, et
// migration douce d'une sauvegarde ANTÉRIEURE À TOUTES les Tâches 1-4 (aucun des nouveaux champs).
// ===================================================================

// REPAS_DE_FAMILLE : régénération PV passive à zéro hors salle sécurisée — le "cas spécial" vit dans
// applyTimeElapsedRegen() (un simple garde-fou sur un flag lu depuis gameState.anomalyEffects), jamais
// une branche dédiée dans anomalies.js : l'anomalie ne fait que poser le drapeau.
{
    resetTransientState();
    gameState.hp = 10; // Largement sous le max : sans le drapeau, la régén tenterait de soigner
    gameState.anomalyEffects.regenOutsideSafehouseZero = true;
    applyTimeElapsedRegen(5); // 5h qui, normalement, régénéreraient des PV (voir HP_REGEN_TIERS)
    assert(gameState.hp === 10, "applyTimeElapsedRegen() (REPAS_DE_FAMILLE) : aucune régénération PV hors salle sécurisée");

    gameState.anomalyEffects.regenOutsideSafehouseZero = false;
    applyTimeElapsedRegen(5);
    assert(gameState.hp > 10, "applyTimeElapsedRegen() : la régénération normale reprend dès que le drapeau retombe");
}

// Robustesse : aucun tirage/application d'anomalie ne doit jamais planter ni boucler indéfiniment,
// sur une large plage d'étages (tuto, pool restreint, pool complet, deux-anomalies).
{
    for (let floor = 1; floor <= 40; floor++) {
        for (let i = 0; i < 10; i++) {
            const rolled = rollFloorAnomalies(floor);
            assert(Array.isArray(rolled) && rolled.length <= 2, `rollFloorAnomalies(${floor}) : renvoie toujours un tableau de 0 à 2 entrées`);
            const fx = computeAnomalyEffects(rolled);
            assert(fx && !Number.isNaN(fx.allDamageMult) && !Number.isNaN(fx.playerMaxHpMult),
                `computeAnomalyEffects() : jamais de NaN pour un tirage de l'étage ${floor}`);
        }
    }
}

// Migration douce : une sauvegarde brute antérieure à TOUTES les Tâches 1-4 (aucun des champs
// introduits par ce plan) doit rester chargeable normalement, avec des valeurs par défaut saines
// partout — jamais un écran bloqué ni un champ undefined.
{
    resetTransientState();
    const veryOldSave = {
        playerName: "Fossile",
        currentFloor: 4,
        level: 3,
        hp: 80,
        maxHp: 100,
        atk: 14,
        def: 6
        // Rien d'autre : ni lastSavedAt/floorStats (Tâche 2), ni fleesThisRun/necrologie (Tâche 3),
        // ni baseMaxHp/anomalyEffects/activeAnomalies/pactChoicePending (Tâche 4).
    };
    localStorage.setItem(saveKeyForName("Fossile"), JSON.stringify(veryOldSave));

    resetTransientState();
    const ok = restoreSaveForName("fossile");
    assert(ok === true, "restoreSaveForName() : charge une sauvegarde antérieure à toutes les Tâches 1-4");
    assert(gameState.floorStats && gameState.floorStats.mobsKilled === 0, "Migration douce : floorStats retombe sur des zéros (Tâche 2)");
    assert(gameState.fleesThisRun === 0 && Array.isArray(gameState.necrologie) && gameState.necrologie.length === 0,
        "Migration douce : fleesThisRun/necrologie retombent sur leurs défauts (Tâche 3)");
    assert(gameState.baseMaxHp === 100, "Migration douce : baseMaxHp migré depuis l'ancien maxHp (Tâche 4)");
    assert(gameState.anomalyEffects.allDamageMult === 1 && gameState.activeAnomalies.length === 0,
        "Migration douce : anomalyEffects/activeAnomalies neutres (Tâche 4)");
    assert(isActionBlocked() === false, "Migration douce : le joueur atterrit toujours sur l'écran d'exploration normal, jamais bloqué");
}
