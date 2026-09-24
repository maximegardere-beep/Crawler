// misc.js — tests régression : Divers : compagnon (abandon probabiliste), salles sécurisées (comptage), écran de départ + cadeau de bienvenue, kit de test.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L596-1008 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Compagnon : abandon probabiliste
// ===================================================================
{
    const candidate = generateCompanionCandidate();
    assert(typeof candidate.leaveChance === 'number' && candidate.leaveChance === 0, "generateCompanionCandidate() initialise leaveChance à 0");
    assert(candidate.aggressiveness === undefined, "Le champ 'aggressiveness' n'existe plus");
}
{
    resetTransientState();
    gameState.companion = { name: "Doc Ferraille", xp: 0, level: 1, xpToNext: 1, leaveChance: 50, specialty: { type: 'strike', label: 'Frappe' }, hp: 40, maxHp: 40 };
    const originalRandom = Math.random;
    Math.random = () => 0.01;
    gainCompanionXp(10);
    Math.random = originalRandom;
    assert(gameState.companion === null, "Le compagnon abandonne quand le jet contre leaveChance réussit");
}
{
    resetTransientState();
    gameState.companion = { name: "Nadia Sans-Peur", xp: 25, level: 1, xpToNext: 30, leaveChance: 0, specialty: { type: 'guard', label: 'Garde' }, hp: 40, maxHp: 40 };
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    gainCompanionXp(10);
    Math.random = originalRandom;
    assert(gameState.companion !== null, "Le compagnon reste si le jet d'abandon échoue");
    assert(gameState.companion.leaveChance > 0, "leaveChance augmente après une montée de niveau");
}
assert(typeof triggerCompanionHostileTurn === 'undefined', "L'ancien mécanisme triggerCompanionHostileTurn() a bien été retiré");

// ===================================================================
// Salles sécurisées : 1 à 2 par quartier (jamais 0, jamais plus de 2) — voir generateQuadrant().
// ===================================================================
{
    let sawZero = false, sawMoreThanTwo = false, sawTwo = false;
    for (let i = 0; i < 60; i++) {
        const roomsById = {};
        generateQuadrant(0, "Quartier de Test", roomsById);
        const safeCount = Object.values(roomsById).filter(r => r.type === 'safe').length;
        if (safeCount === 0) sawZero = true;
        if (safeCount > 2) sawMoreThanTwo = true;
        if (safeCount === 2) sawTwo = true;
    }
    assert(!sawZero, "generateQuadrant() : au moins 1 salle sécurisée par quartier (jamais 0), sur 60 générations");
    assert(!sawMoreThanTwo, "generateQuadrant() : jamais plus de 2 salles sécurisées par quartier");
    assert(sawTwo, "generateQuadrant() : 2 salles sécurisées effectivement possibles (60 générations)");
}

// ===================================================================
// Écran de départ + cadeau de bienvenue : nom du crawler puis tirage pondéré (Arme > Rien > Tir >
// Magie), toujours au palier Commun (voir WELCOME_GIFT_WEIGHTS/rollWelcomeGiftType()/
// generateWelcomeGiftItem() dans generator.js/app.js).
// ===================================================================

// rollWelcomeGiftType() : vérifie les 4 bornes exactes du tirage pondéré (poids 40/30/20/10 sur 100).
{
    const originalRandom = Math.random;
    Math.random = () => 0; // roll = 0 -> tout premier bloc (weapon, [0, 40))
    assert(rollWelcomeGiftType() === 'weapon', "rollWelcomeGiftType() : Arme en bas de plage (poids le plus fort)");
    Math.random = () => 0.45; // roll = 45 -> [40, 70) = nothing
    assert(rollWelcomeGiftType() === 'nothing', "rollWelcomeGiftType() : Rien au 2e rang de poids");
    Math.random = () => 0.75; // roll = 75 -> [70, 90) = ranged
    assert(rollWelcomeGiftType() === 'ranged', "rollWelcomeGiftType() : Tir au 3e rang de poids");
    Math.random = () => 0.95; // roll = 95 -> [90, 100) = spell
    assert(rollWelcomeGiftType() === 'spell', "rollWelcomeGiftType() : Magie au poids le plus faible");
    Math.random = originalRandom;

    const weights = Object.values(WELCOME_GIFT_WEIGHTS);
    assert(WELCOME_GIFT_WEIGHTS.weapon > WELCOME_GIFT_WEIGHTS.nothing
        && WELCOME_GIFT_WEIGHTS.nothing > WELCOME_GIFT_WEIGHTS.ranged
        && WELCOME_GIFT_WEIGHTS.ranged > WELCOME_GIFT_WEIGHTS.spell,
        "WELCOME_GIFT_WEIGHTS : ordre Arme > Rien > Tir > Magie respecté");
    assert(weights.every(w => w > 0), "WELCOME_GIFT_WEIGHTS : tous les poids restent strictement positifs");
}

// generateWelcomeGiftItem() : toujours au palier Commun (aucun enchantement), quel que soit le type.
{
    const originalRandom = Math.random;
    Math.random = () => 0;
    const weapon = generateWelcomeGiftItem('weapon');
    const ranged = generateWelcomeGiftItem('ranged');
    const spell = generateWelcomeGiftItem('spell');
    Math.random = originalRandom;

    assert(weapon.category === 'weapons' && weapon.rarity === 'Commun' && !weapon.mechanics, "generateWelcomeGiftItem('weapon') : arme Commune, sans enchantement");
    assert(ranged.category === 'ranged' && ranged.rarity === 'Commun' && !ranged.mechanics, "generateWelcomeGiftItem('ranged') : arme à distance Commune, sans enchantement");
    assert(spell.category === 'scrolls' && spell.rarity === 'Commun' && ['melee', 'ranged'].includes(spell.spellCategory), "generateWelcomeGiftItem('spell') : parchemin Commun, catégorie de sort valide");
    assert(generateWelcomeGiftItem('nothing') === null, "generateWelcomeGiftItem('nothing') : aucun objet généré");
}

// confirmPlayerName() : nom saisi (ou repli sur l'existant si vide), masque l'écran de départ, puis
// enchaîne sur revealWelcomeGift().
{
    resetTransientState();
    gameState.playerName = "CRAWLER_01";
    ui.startScreenOverlay.classList.remove('hidden');
    ui.giftRevealOverlay.classList.add('hidden');
    ui.startNameInput.value = "  Mordicaï-Deux  ";
    confirmPlayerName();
    assert(gameState.playerName === "Mordicaï-Deux", "confirmPlayerName() : nom saisi (avec espaces superflus retirés) adopté");
    assert(ui.startScreenOverlay.classList.contains('hidden'), "confirmPlayerName() : masque l'écran de départ");
    assert(!ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : enchaîne sur la révélation du cadeau");

    resetTransientState();
    gameState.playerName = "CRAWLER_01";
    ui.startNameInput.value = "   ";
    confirmPlayerName();
    assert(gameState.playerName === "CRAWLER_01", "confirmPlayerName() : nom vide -> repli sur le nom déjà existant");
}

// revealWelcomeGift() : équipe directement le bon emplacement selon le type tiré (aucun inventaire à
// gérer, tout est vide en tout début de partie) ; "nothing" ne touche à rien.
{
    resetTransientState();
    const originalRandom = Math.random;
    Math.random = () => 0; // -> 'weapon'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.weapon !== null, "revealWelcomeGift('weapon') : équipe directement une arme");
    assert(gameState.equipment.ranged === null && gameState.equipment.spell === null, "revealWelcomeGift('weapon') : ne touche à aucun autre emplacement");

    resetTransientState();
    Math.random = () => 0.75; // -> 'ranged'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.ranged !== null, "revealWelcomeGift('ranged') : équipe directement une arme à distance");

    resetTransientState();
    gameState.mana = 0;
    Math.random = () => 0.95; // -> 'spell'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.spell !== null, "revealWelcomeGift('spell') : équipe directement un sort");
    assert(gameState.mana === gameState.maxMana, "revealWelcomeGift('spell') : première équipe -> mana plein, comme equipSpell()");

    resetTransientState();
    Math.random = () => 0.45; // -> 'nothing'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.weapon === null && gameState.equipment.ranged === null && gameState.equipment.spell === null, "revealWelcomeGift('nothing') : aucun équipement, comme annoncé");
}

// dismissGiftReveal() : referme l'écran de révélation.
{
    ui.giftRevealOverlay.classList.remove('hidden');
    dismissGiftReveal();
    assert(ui.giftRevealOverlay.classList.contains('hidden'), "dismissGiftReveal() : masque l'écran de révélation du cadeau");
}

// ===================================================================
// Kit de test (bouton discret "🧪 Kit de Test", remplace l'ancien export de logs) : équipe 1 arme,
// 1 arme à distance et 1 sort, tous au palier Légendaire, pour tester les mécaniques sans dépendre
// du loot aléatoire (voir generateTestKitItem()/generateTestKitSpell() dans generator.js).
// ===================================================================
{
    const legendaire = itemRarities[itemRarities.length - 1];
    assert(legendaire.name === "Légendaire", "Sanity : le dernier palier d'itemRarities est bien Légendaire");

    for (let i = 0; i < 20; i++) {
        const weapon = generateTestKitItem('weapons');
        assert(weapon.category === 'weapons' && weapon.rarity === 'Légendaire', "generateTestKitItem('weapons') : catégorie et rareté forcées");
        if (weapon.canEnchant !== false) {
            assert(weapon.mechanics && weapon.mechanics.length === legendaire.slots, "generateTestKitItem('weapons') : tous les slots d'enchantement du palier Légendaire sont remplis");
        }

        const ranged = generateTestKitItem('ranged');
        assert(ranged.category === 'ranged' && ranged.rarity === 'Légendaire', "generateTestKitItem('ranged') : catégorie et rareté forcées");

        const spell = generateTestKitSpell();
        assert(spell.category === 'scrolls' && spell.rarity === 'Légendaire', "generateTestKitSpell() : catégorie et rareté forcées");
        assert(['melee', 'ranged'].includes(spell.spellCategory), "generateTestKitSpell() : catégorie de sort valide");
    }
}

// giveTestKit() : équipe directement les 3 emplacements et remplit le mana, en un seul appel.
{
    resetTransientState();
    gameState.equipment.weapon = null;
    gameState.equipment.ranged = null;
    gameState.equipment.spell = null;
    gameState.mana = 0;
    giveTestKit();
    assert(gameState.equipment.weapon !== null && gameState.equipment.weapon.rarity === 'Légendaire', "giveTestKit() : équipe une arme légendaire");
    assert(gameState.equipment.ranged !== null && gameState.equipment.ranged.rarity === 'Légendaire', "giveTestKit() : équipe une arme à distance légendaire");
    assert(gameState.equipment.spell !== null && gameState.equipment.spell.rarity === 'Légendaire', "giveTestKit() : équipe un sort légendaire");
    assert(gameState.mana === gameState.maxMana, "giveTestKit() : remplit le mana au maximum");
}
