// magic.js — tests régression : Magie : sort équipé + mana (spells.js/generateSpellScroll()/equipSpell()/attackMagic()).
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L724 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Magie : rework en sort équipé + mana (voir spells.js, generateSpellScroll() dans generator.js,
// equipSpell()/attackMagic() dans app.js).
// ===================================================================

// generateSpellScroll() : un sort plus rare coûte plus de mana ET frappe plus fort, comme une arme ;
// le niveau d'objet ne fait grimper que les dégâts (chantier "refonte des objets").
{
    const originalRandom = Math.random;
    Math.random = () => 0; // Premier sort accessible à l'étage 1 : "Toucher Électrique" (melee)
    let scroll = generateSpellScroll({ floor: 1, rarityKey: 'commun', jitter: false });
    Math.random = originalRandom;
    const base = spellCatalog.find(s => s.name === "Toucher Électrique");
    assert(scroll.category === 'scrolls', "generateSpellScroll() : catégorie 'scrolls' (pour le tri addLoot())");
    assert(scroll.spellCategory === 'melee', "generateSpellScroll() : conserve la catégorie melee/ranged du sort de base");
    assert(scroll.spellName === "Toucher Électrique", "generateSpellScroll() : conserve le nom du sort de base");
    assert(scroll.name === "Parchemin : Toucher Électrique", "generateSpellScroll() : nom d'affichage préfixé");
    assert(scroll.rarity === "Commun" && scroll.itemLevel === 1, "generateSpellScroll() : rareté et niveau d'objet imposés");
    assert(scroll.baseDmg === base.baseDmg && scroll.manaCost === base.manaCost, "generateSpellScroll() : stats de base inchangées au palier Commun, niveau 1");
    assert(scroll.value === base.baseValue, "generateSpellScroll() : valeur = baseValue du sort au palier Commun, niveau 1");

    Math.random = () => 0;
    const legend = generateSpellScroll({ floor: 1, rarityKey: 'legendaire', jitter: false });
    const deep = generateSpellScroll({ floor: 1, itemLevel: 10, rarityKey: 'commun', jitter: false });
    Math.random = originalRandom;
    assert(legend.baseDmg > scroll.baseDmg && legend.manaCost > scroll.manaCost, "generateSpellScroll() : un sort plus rare inflige plus ET coûte plus de mana");
    assert(legend.value >= scroll.value * 10, "generateSpellScroll() : un parchemin Légendaire vaut bien plus qu'un Commun (Backlog : prix des parchemins)");
    assert(deep.baseDmg > scroll.baseDmg && deep.manaCost === scroll.manaCost, "generateSpellScroll() : le niveau d'objet fait grimper les dégâts, jamais le coût en mana");
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
    addLoot();
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

// ===================================================================
// Grimoire regroupé : un emplacement par sort, raretés cumulées, exemplaires équipables et vendables
// séparément (groupSpellbook(), updateSpellbookUI(), boutique).
// ===================================================================
{
    resetTransientState();
    const mk = (spellName, rarity, baseDmg, extra = {}) => ({ name: `Parchemin : ${spellName}`, spellName, rarity, baseDmg, manaCost: 10, baseValue: 20, category: 'scrolls', spellCategory: 'melee', icon: '🔥', ...extra });
    const fireC = mk('Boule de Feu', 'Commun', 10);
    const fireL = mk('Boule de Feu', 'Légendaire', 30);
    const fireR = mk('Boule de Feu', 'Rare', 14);
    const ice = mk('Pic de Glace', 'Épique', 20, { icon: '🧊' });
    const equippedFire = mk('Boule de Feu', 'Épique', 22);

    const groups = groupSpellbook([fireC, ice, fireL, fireR]);
    assert(groups.length === 2 && groups[0].spellName === 'Boule de Feu' && groups[1].spellName === 'Pic de Glace', "groupSpellbook : un groupe par sort, dans l'ordre de première apparition");
    assert(groups[0].copies.map(c => c.spell.rarity).join(',') === 'Légendaire,Rare,Commun', "groupSpellbook : exemplaires de la meilleure rareté à la moins bonne");
    assert(groups[0].copies.map(c => c.index).join(',') === '2,3,0', "groupSpellbook : chaque exemplaire garde son index dans le grimoire");
    const twins = groupSpellbook([mk('Boule de Feu', 'Rare', 12), mk('Boule de Feu', 'Rare', 15)]);
    assert(twins[0].copies.length === 2 && twins[0].copies[0].spell.baseDmg === 15, "groupSpellbook : deux exemplaires de même rareté restent deux lignes, le plus fort d'abord");

    const withEquipped = groupSpellbook([fireC, ice], equippedFire);
    assert(withEquipped[0].copies[0].spell === equippedFire && withEquipped[0].copies[0].equipped && withEquipped[0].copies[0].index === -1, "groupSpellbook : le sort équipé rejoint son groupe, marqué équipé (index -1)");
    assert(withEquipped[0].copies.filter(c => c.equipped).length === 1 && withEquipped[1].copies.every(c => !c.equipped), "groupSpellbook : seul l'exemplaire équipé est marqué équipé");
    const onlyEquipped = groupSpellbook([], equippedFire);
    assert(onlyEquipped.length === 1 && onlyEquipped[0].copies.length === 1, "groupSpellbook : le sort équipé s'affiche même seul");
    assert(groupSpellbook([]).length === 0, "groupSpellbook : grimoire vide -> aucun groupe");

    // Affichage : une carte par sort, la copie équipée signalée
    gameState.spellbook = [fireC, ice, fireL];
    gameState.equipment.spell = equippedFire;
    updateSpellbookUI();
    const cards = ui.spellbookCards.children;
    assert(cards.length === 2, "Grimoire : une carte par sort (3 exemplaires de Boule de Feu + 1 Pic de Glace -> 2 cartes)");
    assert(cards[0].innerHTML.includes('Équipé') && cards[0].innerHTML.includes('3 exemplaires') && !cards[1].innerHTML.includes('Équipé'), "Grimoire : la carte du sort équipé le signale et compte ses exemplaires");

    // Équiper un exemplaire précis depuis son index
    equipSpell(groupSpellbook(gameState.spellbook)[0].copies[0].index);
    assert(gameState.equipment.spell === fireL && gameState.spellbook.includes(equippedFire) && !gameState.spellbook.includes(fireL), "Équiper l'exemplaire Légendaire : l'ancien équipé retourne au grimoire");

    // Vente séparée d'un exemplaire
    const target = groupSpellbook(gameState.spellbook)[0].copies.find(c => c.spell === fireC);
    const goldBefore = gameState.gold;
    sellSpell(target.index);
    assert(!gameState.spellbook.includes(fireC) && gameState.spellbook.includes(equippedFire) && gameState.gold > goldBefore, "Vente d'un exemplaire : seul celui-ci quitte le grimoire, les autres raretés restent");
    gameState.spellbook = [];
    gameState.equipment.spell = null;
}

// ===================================================================
// Chantier 11 « nouveaux sorts » : effets intrinsèques (SPELL_EFFECTS) et sorts utilitaires (catégorie any).
// ===================================================================
function withRandomValue(value, fn) {
    const original = Math.random;
    Math.random = () => value;
    try { return fn(); } finally { Math.random = original; }
}

function castSpellInCombat(spellName, { distance = 0, rarityKey = 'commun', random = 0.99, enemyHp = 500 } = {}) {
    resetTransientState();
    const base = spellCatalog.find(s => s.name === spellName);
    const scroll = buildSpellScroll(base, getRarityByKey(rarityKey), 1, { jitter: false, qualifiers: [] });
    gameState.equipment.spell = scroll;
    gameState.mana = gameState.maxMana;
    const enemy = { name: "Mannequin", hp: enemyHp, maxHp: enemyHp, atk: 1, def: 0, xpReward: 1, status: {} };
    gameState.inCombat = true;
    gameState.currentEnemy = enemy;
    gameState.combatDistance = distance;
    withRandomValue(random, () => attackMagic());
    return { scroll, enemy };
}

{
    assert(spellCatalog.filter(s => s.spellEffect).length >= 10, "Au moins 10 sorts à effet (chantier 11)");
    assert(spellCatalog.every(s => !s.spellEffect || (SPELL_EFFECTS[s.spellEffect.kind] && describeSpellEffect(s.spellEffect).length > 10)), "Chaque effet de sort est décrit (SPELL_EFFECTS)");
    assert(spellCatalog.filter(s => s.category === 'any').every(s => s.baseDmg === 0 && s.spellEffect), "Sorts utilitaires : aucun dégât, un effet");
    const heal = spellCatalog.find(s => s.name === "Soin Express");
    const common = buildSpellScroll(heal, getRarityByKey('commun'), 1, { jitter: false, qualifiers: [] });
    const legend = buildSpellScroll(heal, getRarityByKey('legendaire'), 1, { jitter: false, qualifiers: [] });
    assert(common.spellEffect.pct === 20 && legend.spellEffect.pct > common.spellEffect.pct, "Soin Express : la part soignée suit la rareté");
    assert(heal.spellEffect.pct === 20, "Le catalogue n'est jamais modifié par la construction d'un parchemin");
    assert(buildItemInspectHtml(common).includes('Effet du sort') && buildItemInspectHtml(common).toLowerCase().includes('partout'), "Inspection : effet du sort et portée « Partout »");
    assert(!describeItemStats(common).some(st => st.key === 'dmg'), "Sort utilitaire : pas de ligne de dégâts");
    assert(spellRangeLabel('any') === 'Partout' && spellRangeLabel('melee') === 'Corps à corps', "Libellés de portée");
    for (let i = 0; i < 30; i++) {
        const gift = generateWelcomeGiftItem('spell');
        const kit = generateTestKitSpell();
        if (gift.spellCategory === 'any' || kit.spellCategory === 'any') { assert(false, "Cadeau de départ / kit de test : toujours un sort offensif"); break; }
    }
}

{
    // Utilitaires : utilisables au contact comme à distance, consomment mana et tour.
    gameState.hp = 10;
    let r = castSpellInCombat("Soin Express", { distance: 0 });
    assert(gameState.hp > 10 || gameState.maxHp <= 10, "Soin Express au contact : soigne");
    assert(gameState.mana < gameState.maxMana, "Soin Express : coûte du mana");

    r = castSpellInCombat("Pas de l'Ombre", { distance: 0 });
    assert(gameState.combatDistance === 2, "Pas de l'Ombre : recule de 2 cases sans jet");
    r = castSpellInCombat("Pas de l'Ombre", { distance: config.rangedCombat.maxDistance - 1 });
    assert(gameState.combatDistance === config.rangedCombat.maxDistance, "Pas de l'Ombre : jamais au-delà de l'écart maximal");

    r = castSpellInCombat("Bouclier de Mana", { distance: 3 });
    assert(gameState.status.manaShield && gameState.status.manaShield.pct === 40, "Bouclier de Mana : posé à distance");
    gameState.companion = null;
    const hit = companionInterceptHit(100);
    assert(hit.playerDamage === 60 && hit.note.includes('bouclier'), "Bouclier de Mana : −40 % sur le coup encaissé");
    tryPlayerAction();
    assert(gameState.status.manaShield && gameState.status.manaShield.rounds === 1, "Bouclier : couvre encore la riposte suivante");
    tryPlayerAction();
    assert(!gameState.status.manaShield, "Bouclier : dissipé après 2 tours");
    assert(companionInterceptHit(100).playerDamage === 100, "Sans bouclier : coup plein");
}

{
    // Effets offensifs.
    gameState.hp = 20;
    let r = castSpellInCombat("Étreinte Vampirique", { distance: 0 });
    assert(gameState.hp > 20 || r.enemy.hp === 500, "Étreinte Vampirique : rend des PV");
    r = castSpellInCombat("Main de Rouille", { distance: 0 });
    assert(r.enemy.hp < 500 && r.enemy.status.corroded && r.enemy.status.corroded.rounds === 3, "Main de Rouille : corrode 3 tours");
    r = castSpellInCombat("Flash Aveuglant", { distance: 3 });
    assert(r.enemy.status.distracted && r.enemy.status.distracted.miss === 40, "Flash Aveuglant : 40 % de ratés");
    r = castSpellInCombat("Nuée de Guêpes", { distance: 3 });
    assert(r.enemy.status.bleed && r.enemy.status.bleed.rounds === 3, "Nuée de Guêpes : saignement");
    r = castSpellInCombat("Cri de Terreur", { distance: 3 });
    assert(r.enemy.status.feared, "Cri de Terreur : terreur");
    r = castSpellInCombat("Gifle Sonique", { distance: 0, random: 0.99 });
    assert(!r.enemy.status.stunned, "Gifle Sonique : pas d'étourdissement sur un mauvais jet (30 %)");
    const withChain = castSpellInCombat("Chaîne d'Éclairs", { distance: 3 });
    const lostWithChain = 500 - withChain.enemy.hp;
    const plain = buildSpellScroll(spellCatalog.find(s => s.name === "Chaîne d'Éclairs"), getRarityByKey('commun'), 1, { jitter: false, qualifiers: [] });
    assert(lostWithChain > 0 && withChain.scroll.spellEffect.kind === 'chain', "Chaîne d'Éclairs : frappe (second éclair compris)");
    r = castSpellInCombat("Main de Rouille", { distance: 3 });
    assert(r.enemy.hp === 500, "Sort de mêlée : refusé à distance (pas de changement de règle)");
    gameState.inCombat = false;
    gameState.currentEnemy = null;
}
