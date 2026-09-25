// balance.js — tests régression : Équilibrage (issues validées "Vibe") : kiting, courbe XP, métrique d'élite, furtivité, magie, items blagues. Voir CLAUDE.md pour le détail des correctifs.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L2217 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Équilibrage (issues validées "Vibe") : kiting (ruée + coût en temps), courbe XP, métrique d'élite,
// furtivité, magie, items blagues. Voir CLAUDE.md pour le détail des correctifs.
// ===================================================================

// Ruée (1B) : un mob de MÊLÉE qui gagne un jet de rapprochement avec une marge >= rushMarginThreshold
// comble l'écart d'un coup, même depuis un écart que le delta normal (borné par dieSides-1) ne
// pourrait jamais combler en une seule manche — sans quoi un joueur y parvenant devient
// mathématiquement increvable. Un mob à DISTANCE, lui, n'en profite jamais.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse Enragé", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 7; // Sous-maximal : un delta normal (max 5 avec dieSides=6) ne peut PAS combler seul
    let originalRandom = Math.random;
    let seq = [0, 0.999]; // playerRoll bas (1), mobRoll haut (6) -> marge 5, largement au-dessus du seuil (3)
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    const timeBefore = gameState.timeLeft;
    // Témoin de riposte : PV perdus plutôt que le verrouillage des boutons (chantier "lisibilité
    // combat" — voir le commentaire équivalent dans combat.js : sous le stub global.setTimeout de
    // _helpers.js, toute la séquence de beats se déroule en synchrone avant que cette ligne ne
    // s'exécute, donc les boutons sont déjà déverrouillés).
    const hpBefore = gameState.hp;
    resolveEnemyReaction();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "Ruée (resolveEnemyReaction) : comble tout l'écart d'un coup malgré un delta normal insuffisant");
    assert(gameState.hp < hpBefore, "Ruée (resolveEnemyReaction) : le mob frappe immédiatement");
    assert(gameState.timeLeft < timeBefore, "Ruée : la manche contestée consomme quand même du temps (timeCostPerRound)");

    // attemptRetreat() avantage le joueur (deux dés, le meilleur gardé) : il faut donc deux tirages
    // bas pour le joueur avant le tirage haut du mob, pour obtenir la même marge de 5.
    const retreatSeq = [0, 0, 0.999];
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse Enragé 2", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 7;
    originalRandom = Math.random;
    idx = 0;
    Math.random = () => retreatSeq[(idx++) % retreatSeq.length];
    const hpBefore2 = gameState.hp;
    attemptRetreat();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "Ruée (attemptRetreat) : le mob vous rattrape brutalement malgré la tentative de fuite");
    assert(gameState.hp < hpBefore2, "Ruée (attemptRetreat) : riposte immédiate");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Tireur d'Élite", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: true };
    gameState.combatDistance = 7;
    originalRandom = Math.random;
    idx = 0;
    Math.random = () => retreatSeq[(idx++) % retreatSeq.length];
    attemptRetreat();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 2, "Pas de ruée pour un mob à distance : l'écart évolue selon le delta normal (7-5=2), jamais forcé à 0");
}

// Coût en temps des manches de distance CONTESTÉES (1A) : attemptSprint() et attemptRetreat()
// déduisent chacun config.rangedCombat.timeCostPerRound, jamais les tours d'attaque standards.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Distance", hp: 9999, maxHp: 9999, atk: 1, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 4;
    const timeBefore1 = gameState.timeLeft;
    attemptSprint();
    assert(gameState.timeLeft < timeBefore1, "attemptSprint() : consomme le coût d'une manche de distance");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Distance 2", hp: 9999, maxHp: 9999, atk: 1, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 4;
    const timeBefore2 = gameState.timeLeft;
    attemptRetreat();
    assert(gameState.timeLeft < timeBefore2, "attemptRetreat() : consomme le coût d'une manche de distance");
}

// gainXp() (2) : courbe de niveau ×1.25 (au lieu de ×1.4), gains ATQ/DEF croissants avec le niveau
// ATTEINT (2+floor(niveau/4) / 1+floor(niveau/5)), PV max inchangé (15).
{
    resetTransientState();
    gameState.xp = 0;
    gameState.xpToNextLevel = 50;
    const hpMaxBefore = gameState.maxHp;
    gainXp(50); // Passe niveau 1 -> 2 (atkGain/defGain encore au plancher à ce niveau)
    assert(gameState.level === 2, "gainXp() : passe bien au niveau 2");
    assert(gameState.xpToNextLevel === 63, "gainXp() : xpToNextLevel suit désormais ×1.25 (round(50*1.25)=63)");
    assert(gameState.maxHp === hpMaxBefore + 15, "gainXp() : gain PV max inchangé (15)");

    resetTransientState();
    gameState.level = 3; // Le prochain niveau (4) doit donner atkGain=2+floor(4/4)=3 (première hausse)
    gameState.xp = 0;
    gameState.xpToNextLevel = 10;
    const atkBefore = gameState.atk;
    gainXp(10);
    assert(gameState.level === 4, "gainXp() : passe au niveau 4");
    assert(gameState.atk === atkBefore + 3, "gainXp() : gain ATQ croissant à partir du niveau 4 (2+floor(4/4)=3)");

    resetTransientState();
    gameState.level = 4; // Le prochain niveau (5) doit donner defGain=1+floor(5/5)=2 (première hausse)
    gameState.xp = 0;
    gameState.xpToNextLevel = 10;
    const defBefore = gameState.def;
    gainXp(10);
    assert(gameState.level === 5, "gainXp() : passe au niveau 5");
    assert(gameState.def === defBefore + 2, "gainXp() : gain DEF croissant à partir du niveau 5 (1+floor(5/5)=2)");
}

// computeThreatMultiplier() (4, generator.js) : la DEF entre désormais dans le calcul avec un poids
// modéré (0.5) — un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
// ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule.
{
    // "Syndiqué" (atk x0.9, def x1.5, hp x1.2) sur un mob de base 10/10/10 : preModifierPower=100
    const withDef = computeThreatMultiplier(9, 12, 15, 100, 10);
    assert(Math.abs(withDef - 1.35) < 0.001, "computeThreatMultiplier() : pondère bien la DEF (attendu 1.35, voir 'Syndiqué')");

    // DEF inchangée (defFactor=1) : doit redonner exactement l'ancienne formule (ATQxPV/preModifierPower)
    const noDefChange = computeThreatMultiplier(15, 15, 10, 100, 10);
    assert(Math.abs(noDefChange - 2.25) < 0.001, "computeThreatMultiplier() : DEF inchangée -> formule ATQ×PV pure (2.25)");

    // Garde-fous : aucune division par zéro
    assert(computeThreatMultiplier(10, 10, 10, 0, 10) === 1, "computeThreatMultiplier() : preModifierPower nul -> 1 (pas de crash)");
    assert(Number.isFinite(computeThreatMultiplier(10, 10, 10, 100, 0)), "computeThreatMultiplier() : preModifierDef nul -> pas de division par zéro");
}

// Furtivité (5) : plafonds abaissés (détection 60%, évitement 70%), XP réduite (5), et un mob qui
// repère le joueur au dernier moment reste "alerted" pour tout le combat : attemptFlee() y est bloqué.
{
    resetTransientState();
    gameState.skills.stealth.level = 20; // Niveau très élevé : doit quand même plafonner
    assert(getStealthChance() === 60, "getStealthChance() : plafonne désormais à 60% (au lieu de 75%)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.pendingStealthEncounter = { name: "Ombre", hp: 20, maxHp: 20, atk: 5, def: 2, xpReward: 10, status: {} };
    gameState.stealthChoicePending = true;
    gameState.skills.stealth.level = 20; // Plafonne l'évitement à 70% quel que soit le niveau
    const originalRandom = Math.random;
    Math.random = () => 0.75; // > 70% (nouveau plafond) mais < 85% (ancien) : doit désormais ÉCHOUER
    attemptStealthEvasion();
    Math.random = originalRandom;
    assert(gameState.inCombat === true && gameState.currentEnemy !== null, "attemptStealthEvasion() : plafonne désormais à 70% (au lieu de 85%), échoue ici à 75%");
    assert(gameState.currentEnemy.alerted === true, "attemptStealthEvasion() (échec) : le mob reste 'alerted' pour tout le combat");

    attemptFlee();
    assert(gameState.inCombat === true, "attemptFlee() : bloqué face à un mob 'alerted'");
    updateUI();
    assert(ui.btnFlee.disabled === true, "updateUI() : bouton Fuir grisé face à un mob 'alerted'");

    // Évitement réussi : XP réduite (8 -> 5)
    resetTransientState();
    gameState.stealthChoicePending = true;
    gameState.pendingStealthEncounter = { name: "Ombre 2", hp: 20, maxHp: 20, atk: 5, def: 2, xpReward: 10, status: {} };
    gameState.skills.stealth.xp = 0;
    const xpBefore = gameState.skills.stealth.xp;
    Math.random = () => 0; // Toujours sous le plafond : évitement garanti
    attemptStealthEvasion();
    Math.random = originalRandom;
    assert(gameState.skills.stealth.xp - xpBefore === 5, "attemptStealthEvasion() (succès) : XP de Furtivité réduite à 5 (au lieu de 8)");
}

// attackMagic() (6, retouché au Chantier C "QoL/équilibrage" — voir NOTES_QOL_EQUILIBRAGE.md) :
// plancher de backfire ABAISSÉ à 3% (config.magicBalance.backfireMin, plus punitif à haut niveau
// qu'avant pour continuer à justifier le risque une fois la compétence Magie montée), defReduction
// non nul (0.15) — les sorts ignorent un peu de DEF sans l'ignorer entièrement.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.skills.magic.level = 50; // Niveau très élevé : le backfire doit quand même plancher à 3%
    gameState.currentEnemy = { name: "Cobaye Magie", hp: 9999, maxHp: 9999, atk: 1, def: 50, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance;
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 };
    gameState.mana = 100;
    const originalRandom = Math.random;
    Math.random = () => 0.075; // 7.5% : au-dessus du nouveau plancher (3%) -> pas de backfire, le sort porte
    attackMagic();
    Math.random = originalRandom;
    assert(gameState.currentEnemy.hp < 9999, "attackMagic() : plancher de backfire abaissé à 3% (un tirage à 7.5% ne backfire plus)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.skills.magic.level = 50;
    gameState.currentEnemy = { name: "Cobaye Magie 2", hp: 9999, maxHp: 9999, atk: 1, def: 50, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance;
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 };
    gameState.mana = 100;
    Math.random = () => 0.025; // 2.5% : sous le nouveau plancher (3%) -> backfire, même à très haut niveau
    attackMagic();
    Math.random = originalRandom;
    assert(gameState.currentEnemy.hp === 9999, "attackMagic() : le plancher de backfire (3%) reste incompressible, même à très haut niveau");
}

// Items blagues (7) : jokeItem exclu du loot normal (generateItem()), et poids de rareté bas de
// fourchette redistribués (moins de Commun, plus de Rare/Épique/Légendaire).
{
    for (let i = 0; i < 150; i++) {
        const item = generateItem(0); // powerScore=0 : bas de fourchette, le plus favorable aux objets faibles
        assert(item.jokeItem !== true, `generateItem() : ne tire jamais un objet 'jokeItem' (obtenu: ${item.name})`);
    }
    const weights = getRarityWeights(0);
    assert(weights.commun === 60, "getRarityWeights() : poids Commun bas de fourchette réduit à 60");
    assert(weights.rare === 30, "getRarityWeights() : poids Rare bas de fourchette relevé à 30");
    assert(Math.abs(weights.epique - 5.5) < 0.001, "getRarityWeights() : poids Épique bas de fourchette relevé à 5.5");
    assert(Math.abs(weights.legendaire - 1.5) < 0.001, "getRarityWeights() : poids Légendaire bas de fourchette relevé à 1.5");

    const rideau = baseItems.armors.find(i => i.name === "Rideau de Douche Camouflage");
    assert(rideau.baseValue === 8, "items.js : Rideau de Douche Camouflage n'est plus le pire objet ET le plus cher (baseValue 50 -> 8)");
}
