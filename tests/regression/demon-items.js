// demon-items.js — tests régression : chantier 17, lot 4 — objets démoniaques de Gorgoth le Concierge (demon-items.js,
// buildDemonicItem() dans generator.js, section « OBJETS DÉMONIAQUES » d'app.js) et armurerie openDemonArmory().
const { assert, resetTransientState, withPlotArmor } = require('./_helpers.js');

const withRand = (v, fn) => { const o = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return fn(); } finally { Math.random = o; } };
const qKeys = (item) => (item.qualifiers || []).map(q => q.key);
function fresh(floor = 5) {
    resetTransientState();
    gameState.currentFloor = floor;
    gameState.inventory = [];
    gameState.spellbook = [];
    gameState.equipment = { weapon: null, armor: null, ranged: null, spell: null };
    gameState.demonArmory = { heldKey: null };
}
// Combat minimal contre un mannequin (aucun écran de rencontre dans les tests).
function startDummyFight(extra = {}) {
    const mob = Object.assign({ name: "Mannequin", hp: 5000, maxHp: 5000, atk: 1, def: 0, xpReward: 1, status: {}, effect: null }, extra);
    withRand(0.5, () => initiateCombat(mob));
    return mob;
}

// --- Catalogue et rareté ------------------------------------------------------------------------------------------------
{
    assert(DEMONIC_ITEM_KEYS.length === 4 && DEMONIC_ITEM_KEYS.every(k => DEMONIC_ITEMS[k]), "DEMONIC_ITEMS : 4 objets (blade, overalls, keyLauncher, rulebook)");
    assert(demonicItemName('blade') === 'Trousseau Ardent de Gorgoth' && demonicItemName('overalls') === 'Bleu de Travail Ignifugé'
        && demonicItemName('keyLauncher') === 'Lance-Clés Infernal' && demonicItemName('rulebook') === 'Règlement Intérieur', "Noms exacts du contrat partagé");
    assert(!itemRarities.includes(DEMONIC_RARITY) && itemRarities[itemRarities.length - 1].key === 'legendaire', "Rareté Démoniaque hors d'itemRarities, Légendaire reste le dernier palier");
    assert(getRarityByKey('demoniaque') === DEMONIC_RARITY && DEMONIC_RARITY.statMult === 2.2, "getRarityByKey('demoniaque') résout la rareté Démoniaque (×2,2)");
    assert(shiftRarity(getRarityByKey('legendaire'), 1).key === 'legendaire', "shiftRarity() ne dépasse jamais Légendaire");
    Object.keys(itemQualifiers).filter(k => itemQualifiers[k].demonic || itemQualifiers[k].curse).forEach(k => {
        assert(ENCHANT_COLORS[k], `${k} : couleur d'enchantement`);
    });
}

// --- Construction : stats ×2,2 × niveau d'objet, qualificatifs effet + malédiction ----------------------------------------
{
    fresh();
    const lvl = 6, levelMult = getItemLevelMult(lvl, 'equipment');
    const blade = buildDemonicItem('blade', lvl);
    assert(blade.category === 'weapons' && blade.baseDmg === Math.round(13 * 2.2 * levelMult) && blade.itemLevel === lvl, `Trousseau : ATK = 13 × 2,2 × niveau (${blade.baseDmg})`);
    assert(blade.name === 'Trousseau Ardent de Gorgoth' && blade.baseName === blade.name && blade.rarityKey === 'demoniaque' && blade.rarityColor === DEMONIC_RARITY.color, "Trousseau : nom fixe, rareté Démoniaque");
    assert(qKeys(blade).join() === 'demon_lifesteal,curse_potions' && blade.qualifiers.every(q => q.rank === 3), "Trousseau : Ardent + Gosier brûlé, rang III");
    const overalls = buildDemonicItem('overalls', lvl);
    assert(overalls.category === 'armors' && overalls.baseArmor === Math.round(11 * 2.2 * levelMult) && qKeys(overalls).join() === 'demon_last_breath,curse_no_regen', "Bleu de travail : armure ×2,2, Ignifugé + Étouffant");
    const launcher = buildDemonicItem('keyLauncher', lvl);
    assert(launcher.category === 'ranged' && launcher.baseDmg === Math.round(12 * 2.2 * levelMult) && qKeys(launcher).join() === 'demon_souls,curse_soul_hunger', "Lance-Clés : distance ×2,2, Faucheur d'âmes + Affamé");
    const rulebook = buildDemonicItem('rulebook', lvl);
    assert(rulebook.category === 'scrolls' && rulebook.spellCategory === 'ranged' && rulebook.spellName === 'Règlement Intérieur' && rulebook.baseDmg === Math.round(13 * 2.2 * levelMult), "Règlement : sort à distance ×2,2");
    assert(qKeys(rulebook).join() === 'demon_decree,curse_blood_price' && rulebook.icon === '📜', "Règlement : Réglementaire + Prix du sang, icône 📜 (effet du lot 5)");
    const best = Math.max(...spellCatalog.map(s => s.baseDmg));
    assert(DEMONIC_ITEMS.rulebook.spell.baseDmg >= 1.5 * best && DEMONIC_ITEMS.rulebook.spell.baseDmg <= 1.7 * best, "Règlement : ~1,6× le meilleur sort de base");
    [blade, overalls, launcher, rulebook].forEach(i => assert(i.demonic && isDemonicItem(i) && i.demonKey, `${i.name} : marqué démoniaque`));
    assert(buildDemonicItem('inconnu', 3) === null, "buildDemonicItem() : clé inconnue → null");
    // Affichage : icône générique de catégorie (le lot 5 dessinera les sprites), inspection complète.
    [blade, overalls, launcher].forEach(i => assert(typeof itemIconSvg(i, 40) === 'string' && itemIconSvg(i, 40).length > 0, `${i.name} : icône générique`));
    const html = buildItemInspectHtml(blade, { compareTo: null });
    assert(/malédiction/.test(html) && /démoniaque/.test(html) && /Invendable/.test(html) && /Démoniaque/.test(html), "Inspection : badges effet + malédiction, rareté, invendable");
    assert(/fuchsia/.test(buildQualifierBadgesHtml(blade)), "Badge de malédiction en pourpre");
    assert(/Coût en PV/.test(buildItemInspectHtml(rulebook, { compareTo: null })), "Règlement : coût en PV affiché à l'inspection");
}

// --- Jamais tirés par le loot normal --------------------------------------------------------------------------------------
{
    fresh(15);
    let leaked = 0;
    for (let i = 0; i < 2000; i++) {
        const item = generateItem({ floor: 1 + (i % 18), source: ['explore', 'mob', 'elite', 'boss', 'treasure'][i % 5] });
        if (item.demonic || item.rarityKey === 'demoniaque' || (item.qualifiers || []).some(q => isReservedQualifier(q.key))) leaked++;
    }
    for (let i = 0; i < 200; i++) {
        const sig = buildSignatureItem(districtBosses[Object.keys(districtBosses)[0]].signatureItem, 10, 'legendaire', { extraQualifier: true });
        if ((sig.qualifiers || []).some(q => isReservedQualifier(q.key))) leaked++;
    }
    assert(leaked === 0, `2000 tirages de loot + 200 forges : aucun objet ni qualificatif démoniaque (${leaked})`);
}

// --- Invendable, jamais donné, un seul à la fois ------------------------------------------------------------------------
{
    fresh();
    gameState.gold = 0;
    const blade = buildDemonicItem('blade', 5);
    assert(storeLootItem(blade) === true && gameState.inventory.includes(blade) && gameState.demonArmory.heldKey === 'blade', "storeLootItem() : premier objet démoniaque rangé, heldKey posé");
    sellItem(gameState.inventory.indexOf(blade));
    assert(gameState.inventory.includes(blade) && gameState.gold === 0, "sellItem() : invendable");
    const second = buildDemonicItem('overalls', 5);
    assert(storeLootItem(second) === false && !gameState.inventory.includes(second) && gameState.gold === 0, "Un seul objet démoniaque : le second est refusé, jamais revendu d'office");
    // Réserve pleine : un objet démoniaque n'est jamais revendu d'office.
    fresh();
    gameState.gold = 0;
    for (let i = 0; i < gameState.maxInventory; i++) gameState.inventory.push(generateItem({ category: 'weapons', floor: 1 }));
    const book = buildDemonicItem('overalls', 5);
    assert(storeLootItem(book) === true && gameState.inventory.includes(book) && gameState.gold === 0, "Réserve pleine : l'objet démoniaque est rangé quand même");
    // Sort : invendable, jamais confié à un compagnon.
    fresh();
    const rule = buildDemonicItem('rulebook', 5);
    storeLootItem(rule);
    sellSpell(gameState.spellbook.indexOf(rule));
    assert(gameState.spellbook.includes(rule), "sellSpell() : invendable");
    gameState.companion = normalizeCompanion(generateCompanionCandidate(5));
    assert(giveSpellToCompanion(gameState.spellbook.indexOf(rule)) === false && gameState.spellbook.includes(rule), "giveSpellToCompanion() : refusé");
    assert(companionGiveAction(() => {}, rule).length === 0 && companionGiveAction(() => {}, null).length === 1, "Action « Donner à » absente pour un objet démoniaque");
    fresh();
    const b2 = buildDemonicItem('blade', 5);
    gameState.inventory.push(b2);
    gameState.companion = normalizeCompanion(generateCompanionCandidate(5));
    assert(giveItemToCompanion(0) === false && gameState.inventory.includes(b2), "giveItemToCompanion() : refusé");
    gameState.companion = null;
}

// --- Trousseau : vol de vie 15 % ; malédiction : potions −50 % --------------------------------------------------------------
{
    fresh();
    const blade = buildDemonicItem('blade', 5);
    gameState.equipment.weapon = blade;
    gameState.hp = 10; gameState.maxHp = 1000;
    const mob = startDummyFight();
    applyDemonLifesteal(blade, 'weapon', 100, mob);
    assert(gameState.hp === 25, `Ardent : 15 % de 100 dégâts = 15 PV (${gameState.hp})`);
    gameState.hp = 500;
    const hpBefore = mob.hp;
    const heals = [];
    const origHeal = applyPlayerHeal;
    applyPlayerHeal = (n) => { heals.push(n); return origHeal(n); };
    withRand(0.5, () => attackWeapon());
    applyPlayerHeal = origHeal;
    const dealt = hpBefore - mob.hp;
    assert(dealt > 0 && heals.includes(Math.round(dealt * 0.15)), `Ardent en combat : soin de 15 % après un coup (${dealt} dégâts, soins ${heals})`);
    resetTransientState();
    fresh();
    gameState.inventory = [buildDemonicItem('blade', 5), { name: "Potion", category: 'consumables', heal: 40 }];
    gameState.hp = 10; gameState.maxHp = 200;
    useConsumable(1);
    assert(gameState.hp === 30, `Gosier brûlé (Trousseau en réserve) : potion de 40 → 20 PV (${gameState.hp})`);
    fresh();
    gameState.inventory = [{ name: "Potion", category: 'consumables', heal: 40 }];
    gameState.hp = 10; gameState.maxHp = 200;
    useConsumable(0);
    assert(gameState.hp === 50, "Sans Trousseau : potion pleine");
}

// --- Bleu de travail : premier coup mortel de chaque combat annulé ; malédiction : régén nulle -------------------------------
{
    fresh();
    gameState.equipment.armor = buildDemonicItem('overalls', 5);
    recomputeMaxHp();
    gameState.hp = 20;
    startDummyFight();
    assert(applyPlayerDamage(500) === 19 && gameState.hp === 1, "Ignifugé : coup mortel → 1 PV");
    gameState.hp = 20;
    applyPlayerDamage(500);
    assert(gameState.hp === 0, "Ignifugé : une seule fois par combat");
    resetTransientState();
    fresh();
    gameState.equipment.armor = buildDemonicItem('overalls', 5);
    gameState.hp = 20;
    startDummyFight();
    applyPlayerDamage(500);
    assert(gameState.hp === 1, "Ignifugé : rechargé au combat suivant");
    resetTransientState();
    fresh();
    gameState.equipment.armor = buildDemonicItem('overalls', 5);
    gameState.hp = 20;
    applyPlayerDamage(500);
    assert(gameState.hp === 0, "Ignifugé : jamais hors combat");
    // Ordre : Armure de scénario d'abord (la charge du combat est gardée).
    fresh(1);
    gameState.equipment.armor = buildDemonicItem('overalls', 1);
    gameState.hp = 20;
    const mob = startDummyFight();
    withPlotArmor(() => applyPlayerDamage(500));
    assert(gameState.hp >= 1 && !mob._demonOverallsSpent, "Armure de scénario avant Ignifugé : la charge du Bleu de travail reste disponible");
    resetTransientState();
    fresh();
    gameState.inventory = [buildDemonicItem('overalls', 5)]; // possédé, même en réserve
    gameState.hp = 10;
    applyTimeElapsedRegen(5);
    assert(gameState.hp === 10, "Étouffant : aucune régénération passive de PV");
    fresh();
    gameState.hp = 10;
    applyTimeElapsedRegen(5);
    assert(gameState.hp > 10, "Sans Bleu de travail : régénération normale");
}

// --- Lance-Clés : âmes (max 3, +100 % chacune) ; malédiction : tir sans âme = 3 % des PV max, jamais mortel -----------------
{
    fresh();
    const launcher = buildDemonicItem('keyLauncher', 5);
    gameState.equipment.ranged = launcher;
    for (let i = 0; i < 5; i++) { startDummyFight({ hp: 1 }); winCombat(); }
    assert(launcher.souls === 3, `Faucheur d'âmes : une âme par victoire, 3 au plus (${launcher.souls})`);
    gameState.hp = gameState.maxHp;
    assert(consumeDemonSouls(launcher) === 4 && launcher.souls === 0 && gameState.hp === gameState.maxHp, "3 âmes : tir ×4, âmes consommées, aucun coût en PV");
    gameState.maxHp = 200; gameState.hp = 200;
    assert(consumeDemonSouls(launcher) === 1 && gameState.hp === 194, `Affamé : tir sans âme = 3 % des PV max (${gameState.hp})`);
    gameState.hp = 1;
    consumeDemonSouls(launcher);
    assert(gameState.hp === 1, "Affamé : jamais mortel (1 PV)");
    assert(consumeDemonSouls(buildItem(baseItems.ranged[0], 'ranged', getRarityByKey('commun'), 1, { jitter: false })) === 1, "Arme ordinaire : aucun effet");
    // En combat réel : le tir consomme les âmes.
    fresh();
    gameState.equipment.ranged = launcher;
    launcher.souls = 2;
    startDummyFight({ ranged: true });
    gameState.combatDistance = 3;
    withRand(0.5, () => attackRanged());
    assert(launcher.souls === 0, "attackRanged() : les âmes sont consommées");
    resetTransientState();
}

// --- Règlement : coût en PV (8 %), jamais mortel ----------------------------------------------------------------------------
{
    fresh();
    const rule = buildDemonicItem('rulebook', 5);
    gameState.equipment.spell = rule;
    gameState.maxHp = 200; gameState.hp = 200; gameState.mana = 0;
    assert(getSpellManaCost(rule) === 0 && getSpellHpCost(rule) === 16, "Prix du sang : 0 mana, 8 % des PV max");
    const mob = startDummyFight({ ranged: true });
    gameState.combatDistance = 3;
    const before = mob.hp;
    withRand(0.99, () => attackMagic());
    assert(gameState.hp <= 184 && mob.hp < before, `Règlement lancé sans mana, payé en PV (${gameState.hp} PV)`);
    gameState.hp = 16;
    const hpMob = mob.hp;
    attackMagic();
    assert(gameState.hp === 16 && mob.hp === hpMob, "Prix du sang : impossible si les PV n'y suffisent pas");
    resetTransientState();
}

// --- Armurerie : ouverture, prendre, garder (+2 niveaux), échanger ----------------------------------------------------------
{
    fresh(7);
    let done = 0;
    assert(openDemonArmory(() => { done++; }) === true && gameState.demonArmoryChoicePending && isActionBlocked(), "openDemonArmory() : état bloquant posé");
    assert(demonArmoryRack.length === 4 && demonArmoryRack.every(i => i.itemLevel === 7), "Râtelier : 4 objets au niveau de l'étage");
    assert(done === 0, "Callback jamais appelé avant le choix");
    const recorded = [];
    const origRecord = recordRunEvent;
    recordRunEvent = (type, data) => { recorded.push({ type, data }); return origRecord(type, data); };
    takeDemonicItem('blade');
    assert(done === 1 && !gameState.demonArmoryChoicePending && gameState.equipment.weapon && gameState.equipment.weapon.demonKey === 'blade', "Prendre : objet équipé, callback appelé, état levé");
    assert(gameState.demonArmory.heldKey === 'blade', "heldKey = blade");
    assert(recorded.some(r => r.type === 'demonArmory' && r.data.itemKey === 'blade' && r.data.kept === false), "Chronique : demonArmory { itemKey, kept: false }");
    // Garder : +2 niveaux.
    gameState.currentFloor = 12;
    openDemonArmory(() => { done++; });
    assert(demonArmoryRack.includes(gameState.equipment.weapon), "Râtelier : l'objet possédé y figure à la place du sien");
    keepDemonicItem();
    assert(gameState.equipment.weapon.itemLevel === 9 && gameState.equipment.weapon.baseDmg === Math.round(13 * 2.2 * getItemLevelMult(9)) && done === 2, "Garder : +2 niveaux d'objet, stats recalculées");
    assert(recorded.some(r => r.type === 'demonArmory' && r.data.kept === true), "Chronique : kept: true");
    // Échanger : l'ancien retourne au râtelier.
    const old = gameState.equipment.weapon;
    openDemonArmory(() => { done++; });
    takeDemonicItem('overalls');
    assert(!gameState.equipment.weapon && gameState.equipment.armor.demonKey === 'overalls' && demonArmoryRack.includes(old) && listHeldDemonicItems().length === 1, "Échanger : l'ancien retourne au râtelier, un seul objet démoniaque possédé");
    assert(gameState.demonArmory.heldKey === 'overalls' && done === 3, "Échanger : heldKey mis à jour, callback appelé");
    recordRunEvent = origRecord;
    // Sans callback / repartir les mains vides.
    fresh();
    openDemonArmory(null);
    leaveDemonArmory();
    assert(!gameState.demonArmoryChoicePending && listHeldDemonicItems().length === 0, "Partir les mains vides");
    // Chronique (lot 9) : un objet emporté du râtelier est compté.
    const before = gameState.runStats.demonArmoryPicks || 0;
    recordRunEvent('demonArmory', { itemKey: 'blade', kept: true });
    assert(gameState.runStats.demonArmoryPicks === before + 1, "recordRunEvent('demonArmory') : compté par la chronique");
    assert(typeof devOpenDemonArmory === 'function', "devOpenDemonArmory() exposé");
    resetTransientState();
}
