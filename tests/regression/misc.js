// misc.js — tests régression : Divers : salles sécurisées (comptage), écran de départ + cadeau de bienvenue, kit de test.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L596-1008 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// Compagnons : voir tests/regression/companions.js (chantier "rework des compagnons").

// ===================================================================
// Salles sécurisées : 1 à 2 par quartier (jamais 0, jamais plus de 2) — voir generateBorough() (floorgen.js).
// ===================================================================
{
    let sawZero = false, sawMoreThanTwo = false, sawTwo = false;
    for (let i = 0; i < 15; i++) {
        const floor = generateBorough({ rng: createFloorRng(500 + i) });
        floor.quadrants.forEach(q => {
            const safeCount = q.roomIds.filter(id => floor.roomsById[id].type === 'safe').length;
            if (safeCount === 0) sawZero = true;
            if (safeCount > 2) sawMoreThanTwo = true;
            if (safeCount === 2) sawTwo = true;
        });
    }
    assert(!sawZero, "generateBorough() : au moins 1 salle sécurisée par quartier (jamais 0), sur 60 blocs");
    assert(!sawMoreThanTwo, "generateBorough() : jamais plus de 2 salles sécurisées par quartier");
    assert(sawTwo, "generateBorough() : 2 salles sécurisées effectivement possibles (60 blocs)");
}

// ===================================================================
// Écran de départ + cadeau de bienvenue : nom du crawler puis tirage pondéré (Arme > Tir > Armure >
// Magie > Rien), toujours au palier Camelote (voir WELCOME_GIFT_WEIGHTS/rollWelcomeGiftType()/
// generateWelcomeGiftItem() dans generator.js/app.js) — chantier "refonte des objets" : on démarre
// presque toujours équipé, mais d'objets nuls.
// ===================================================================

// rollWelcomeGiftType() : bornes exactes du tirage pondéré (poids 38/25/17/15/5 sur 100).
{
    const cases = [[0, 'weapon'], [0.40, 'ranged'], [0.70, 'armor'], [0.85, 'spell'], [0.97, 'nothing']];
    const originalRandom = Math.random;
    cases.forEach(([roll, expected]) => {
        Math.random = () => roll;
        assert(rollWelcomeGiftType() === expected, `rollWelcomeGiftType() : jet ${roll} -> ${expected}`);
    });
    Math.random = originalRandom;

    const w = WELCOME_GIFT_WEIGHTS;
    const total = Object.values(w).reduce((sum, x) => sum + x, 0);
    assert(w.weapon > w.ranged && w.ranged > w.armor && w.armor > w.spell && w.spell > w.nothing,
        "WELCOME_GIFT_WEIGHTS : ordre Arme > Tir > Armure > Magie > Rien respecté");
    assert(w.nothing / total <= 0.05, "WELCOME_GIFT_WEIGHTS : repartir les mains vides est devenu rare (≤ 5 %)");
    assert(Object.values(w).every(x => x > 0), "WELCOME_GIFT_WEIGHTS : tous les poids restent strictement positifs");
}

// generateWelcomeGiftItem() : toujours Camelote, niveau d'objet 1, jamais de qualificatif positif.
{
    for (let i = 0; i < 60; i++) {
        ['weapon', 'ranged', 'armor', 'spell'].forEach(type => {
            const item = generateWelcomeGiftItem(type);
            const expectedCategory = { weapon: 'weapons', ranged: 'ranged', armor: 'armors', spell: 'scrolls' }[type];
            assert(item.category === expectedCategory && item.rarity === 'Camelote' && item.itemLevel === 1,
                `generateWelcomeGiftItem('${type}') : ${expectedCategory}, Camelote, niveau d'objet 1`);
            assert(getItemQualifierList(item).every(q => itemQualifiers[q.key].kind === 'malus'),
                `generateWelcomeGiftItem('${type}') : au plus un défaut, jamais un vrai qualificatif`);
        });
    }
    const spell = generateWelcomeGiftItem('spell');
    assert(['melee', 'ranged'].includes(spell.spellCategory), "generateWelcomeGiftItem('spell') : catégorie de sort valide");
    assert(generateWelcomeGiftItem('nothing') === null, "generateWelcomeGiftItem('nothing') : aucun objet généré");
    assert(flavorText.welcomeGift.armor && flavorText.welcomeGift.armor.length > 0, "Cadeau de bienvenue : blagues dédiées à l'armure");
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
    Math.random = () => 0.5; // -> 'ranged'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.ranged !== null, "revealWelcomeGift('ranged') : équipe directement une arme à distance");

    resetTransientState();
    Math.random = () => 0.7; // -> 'armor'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.armor !== null && gameState.equipment.weapon === null, "revealWelcomeGift('armor') : équipe directement une armure");
    gameState.equipment.armor = null;

    resetTransientState();
    gameState.mana = 0;
    Math.random = () => 0.85; // -> 'spell'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.spell !== null, "revealWelcomeGift('spell') : équipe directement un sort");
    assert(gameState.mana === gameState.maxMana, "revealWelcomeGift('spell') : première équipe -> mana plein, comme equipSpell()");

    resetTransientState();
    Math.random = () => 0.97; // -> 'nothing'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.weapon === null && gameState.equipment.ranged === null && gameState.equipment.armor === null && gameState.equipment.spell === null, "revealWelcomeGift('nothing') : aucun équipement, comme annoncé");
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
            // (le trait fixe d'un gros objet — chantier 10 — s'ajoute aux emplacements, il n'en occupe aucun)
            const rolled = (weapon.qualifiers || []).filter(q => !q.fixed);
            assert(rolled.length === legendaire.slots, "generateTestKitItem('weapons') : tous les slots d'enchantement du palier Légendaire sont remplis");
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
