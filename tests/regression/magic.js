// magic.js — tests régression : Magie : sort équipé + mana (spells.js/generateSpellScroll()/equipSpell()/attackMagic()).
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L724 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Magie : rework en sort équipé + mana (voir spells.js, generateSpellScroll() dans generator.js,
// equipSpell()/attackMagic() dans app.js).
// ===================================================================

// generateSpellScroll() : un sort plus rare coûte plus de mana ET frappe plus fort, comme une arme.
{
    const originalRandom = Math.random;
    // [index du sort (0 -> "Toucher Électrique", melee), jet de rareté (0 -> Commun), jitter du
    // multiplicateur de stats (0.5 -> exactement 1.0, sans le ±10% aléatoire)]
    let commonSeq = [0, 0, 0.5];
    let commonIdx = 0;
    Math.random = () => commonSeq[(commonIdx++) % commonSeq.length];
    let scroll = generateSpellScroll(0);
    Math.random = originalRandom;
    assert(scroll.category === 'scrolls', "generateSpellScroll() : catégorie 'scrolls' (pour le tri addLoot())");
    assert(scroll.spellCategory === 'melee', "generateSpellScroll() : conserve la catégorie melee/ranged du sort de base");
    assert(scroll.spellName === "Toucher Électrique", "generateSpellScroll() : conserve le nom du sort de base");
    assert(scroll.name === "Parchemin : Toucher Électrique", "generateSpellScroll() : nom d'affichage préfixé");
    assert(scroll.rarity === "Commun", "generateSpellScroll() : rareté Commun avec un jet à 0");
    assert(scroll.baseDmg === 9 && scroll.manaCost === 12, "generateSpellScroll() : stats de base inchangées au palier Commun (statMult ~1.0)");

    const seq = [0, 0.999, 0.5];
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    scroll = generateSpellScroll(0);
    Math.random = originalRandom;
    assert(scroll.rarity === "Légendaire", "generateSpellScroll() : rareté Légendaire avec un jet au plus haut");
    assert(scroll.baseDmg > 9 && scroll.manaCost > 12, "generateSpellScroll() : un sort plus rare inflige plus ET coûte plus de mana");
}

// equipSpell() : équipe depuis le grimoire, renvoie l'ancien sort équipé dedans, initialise le mana
// à plein UNIQUEMENT à la toute première équipe (jamais lors d'un changement de sort).
{
    resetTransientState();
    const scrollA = { name: "Parchemin : Toucher Électrique", spellName: "Toucher Électrique", spellCategory: 'melee', baseDmg: 9, manaCost: 12, category: 'scrolls', rarity: 'Commun' };
    const scrollB = { name: "Parchemin : Foudre", spellName: "Foudre", spellCategory: 'ranged', baseDmg: 15, manaCost: 22, category: 'scrolls', rarity: 'Rare' };
    gameState.spellbook = [scrollA];
    gameState.mana = 0;
    equipSpell(0);
    assert(gameState.equipment.spell === scrollA, "equipSpell() : équipe bien le sort choisi");
    assert(gameState.spellbook.length === 0, "equipSpell() : le sort équipé quitte le grimoire");
    assert(gameState.mana === gameState.maxMana, "equipSpell() : première équipe -> mana plein");

    gameState.mana = 40; // Simule une dépense entre-temps
    gameState.spellbook = [scrollB];
    equipSpell(0);
    assert(gameState.equipment.spell === scrollB, "equipSpell() : change bien de sort équipé");
    assert(gameState.spellbook.includes(scrollA), "equipSpell() : l'ancien sort équipé retourne dans le grimoire");
    assert(gameState.mana === 40, "equipSpell() : un changement de sort (pas une première équipe) ne réinitialise pas le mana");
}

// addLoot() : un parchemin (catégorie 'scrolls') rejoint gameState.spellbook, jamais gameState.inventory.
{
    resetTransientState();
    gameState.inventory = [];
    gameState.spellbook = [];
    const originalRandom = Math.random;
    // [catégorie -> 'scrolls' (5e sur 5, index 4), index du sort, jet de rareté, jitter statMult]
    const seq = [0.9, 0, 0, 0.5];
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    addLoot(0);
    Math.random = originalRandom;
    assert(gameState.spellbook.length === 1, "addLoot() : un parchemin rejoint le grimoire (spellbook)");
    assert(gameState.inventory.length === 0, "addLoot() : un parchemin ne rejoint jamais l'inventaire classique");
}

// attackMagic() : grisé/bloqué exactement comme Arme/Tir selon la catégorie du sort équipé et l'écart,
// plus une garde propre au mana (insuffisant -> pas de dégâts, pas de dépense).
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 9999, maxHp: 9999, atk: 5, def: 2, status: {} };
    gameState.pendingSneakAttack = false;

    // Aucun sort équipé : bloqué, aucune conséquence.
    gameState.combatDistance = 0;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Magie grisée sans aucun sort équipé");
    let hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas sans sort équipé");

    // Sort de corps à corps équipé, mais à distance : bloqué comme Arme le serait.
    gameState.equipment.spell = { spellName: "Toucher Électrique", spellCategory: 'melee', baseDmg: 9, manaCost: 12, category: 'scrolls' };
    gameState.mana = 100;
    gameState.combatDistance = config.rangedCombat.initialDistance;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort de corps à corps grisé à distance");
    hpBefore = gameState.currentEnemy.hp;
    const manaBefore = gameState.mana;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas un sort de corps à corps à distance");
    assert(gameState.mana === manaBefore, "attackMagic() ne consomme pas de mana quand le sort est indisponible");

    // Même sort, de retour au corps à corps, mais mana insuffisant : toujours bloqué.
    gameState.combatDistance = 0;
    gameState.mana = 5; // < manaCost (12)
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort grisé si le mana restant est insuffisant");
    hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas sans assez de mana");
    assert(gameState.mana === 5, "attackMagic() ne consomme aucun mana quand il en manque déjà");

    // Mana suffisant, bon écart : le sort porte et consomme son coût en mana.
    gameState.mana = 100;
    updateUI();
    assert(ui.btnAttackMagic.disabled === false, "Sort de corps à corps utilisable au contact avec assez de mana");
    const originalRandom = Math.random;
    Math.random = () => 0.5; // Évite tout backfire (15% de base au niveau 1)
    hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    Math.random = originalRandom;
    assert(gameState.currentEnemy.hp < hpBefore, "attackMagic() inflige des dégâts quand le sort est utilisable");
    assert(gameState.mana === 100 - 12, "attackMagic() consomme le coût en mana du sort lancé");

    // Sort à distance équipé : symétrique (bloqué au contact, utilisable à distance).
    gameState.equipment.spell = { spellName: "Foudre", spellCategory: 'ranged', baseDmg: 15, manaCost: 20, category: 'scrolls' };
    gameState.mana = 100;
    gameState.combatDistance = 0;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort à distance grisé au corps à corps");
    gameState.combatDistance = config.rangedCombat.initialDistance;
    updateUI();
    assert(ui.btnAttackMagic.disabled === false, "Sort à distance utilisable une fois l'écart repris");
}

// useConsumable() : restaure aussi du mana quand l'objet en porte (voir items.js).
{
    resetTransientState();
    gameState.inventory = [{ name: "Flasque d'Essence Arcanique", heal: 0, mana: 45, category: 'consumables' }];
    gameState.hp = gameState.maxHp - 50;
    gameState.mana = 10;
    useConsumable(0);
    assert(gameState.mana === 55, "useConsumable() : restaure le mana porté par l'objet");
    assert(gameState.inventory.length === 0, "useConsumable() : l'objet disparaît après usage");
}

// applyTimeElapsedRegen() : régénère PV (taux DÉGRESSIF selon le % de PV restants, voir
// HP_REGEN_TIERS) et mana (12/h, seulement si un sort est équipé) au prorata des heures écoulées,
// les deux jauges régénérant indépendamment l'une de l'autre.
{
    // Palier < 50% des PV max : taux plein (10/h)
    resetTransientState();
    gameState.hp = 40; // 40% de 100
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 60, "applyTimeElapsedRegen() : palier <50% PV -> 10 PV/h");

    // Palier 50-80% : taux intermédiaire (4/h)
    resetTransientState();
    gameState.hp = 75; // 75% de 100
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 83, "applyTimeElapsedRegen() : palier 50-80% PV -> 4 PV/h");

    // Palier >= 80% : simple filet d'eau (1/h)
    resetTransientState();
    gameState.hp = 90; // 90% de 100
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'melee', baseDmg: 5, manaCost: 5, category: 'scrolls' };
    gameState.mana = 0;
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 92, "applyTimeElapsedRegen() : palier >=80% PV -> 1 PV/h");
    assert(gameState.mana === 24, "applyTimeElapsedRegen() : régénère 12 mana par heure écoulée (sort équipé)");

    gameState.hp = gameState.maxHp; // PV déjà pleins : ne doit pas bloquer la régén de mana
    gameState.mana = gameState.maxMana - 10;
    applyTimeElapsedRegen(1);
    assert(gameState.hp === gameState.maxHp, "applyTimeElapsedRegen() : PV pleins -> aucun débordement au-delà de maxHp");
    assert(gameState.mana === gameState.maxMana, "applyTimeElapsedRegen() : régénère le mana même PV pleins (jauges indépendantes)");

    resetTransientState();
    gameState.equipment.spell = null; // Aucun sort équipé : rien à régénérer, jamais de mana fantôme
    gameState.mana = 0;
    applyTimeElapsedRegen(5);
    assert(gameState.mana === 0, "applyTimeElapsedRegen() : aucune régénération de mana sans sort équipé");

    resetTransientState();
    gameState.hp = gameState.maxHp - 100;
    applyTimeElapsedRegen(0);
    assert(gameState.hp === gameState.maxHp - 100, "applyTimeElapsedRegen(0) : aucun effet sans heure écoulée");
}
