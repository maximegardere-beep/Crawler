// loot.js — tests régression : refonte des objets (voir NOTES_ITEMS.md) — raretés par étage, niveau
// d'objet, valeur marchande, butin des boss et objets signature (items.js/itemBalance, generator.js).
const { assert, resetTransientState } = require('./_helpers.js');

const rarityIndex = (key) => itemRarities.findIndex(r => r.key === key);
const withRandom = (value, fn) => {
    const original = Math.random;
    Math.random = typeof value === 'function' ? value : () => value;
    try { return fn(); } finally { Math.random = original; }
};

// Paliers : ordre croissant de stats, de valeur et de qualificatifs ; la Camelote en premier.
{
    assert(itemRarities[0].key === 'camelote' && itemRarities[itemRarities.length - 1].key === 'legendaire', "itemRarities : Camelote en bas, Légendaire en haut");
    for (let i = 1; i < itemRarities.length; i++) {
        const [lo, hi] = [itemRarities[i - 1], itemRarities[i]];
        assert(hi.statMult > lo.statMult && hi.valueMult > lo.valueMult && hi.slots >= lo.slots, `itemRarities : ${hi.name} au-dessus de ${lo.name} (stats, valeur, qualificatifs)`);
    }
    assert(getRarityByKey('legendaire').valueMult >= 15 * getRarityByKey('commun').valueMult, "itemRarities : un Légendaire vaut au moins 15× un Commun");
}

// Tables de rareté par étage : aucun Légendaire aux étages 1-2, Légendaire de plus en plus fréquent en profondeur.
{
    assert(getLootRarityWeights(1).legendaire === 0 && getLootRarityWeights(2).legendaire === 0, "getLootRarityWeights() : aucun Légendaire aux étages 1-2");
    let previous = -1;
    [1, 3, 6, 10, 15, 18, 40].forEach(floor => {
        const w = getLootRarityWeights(floor);
        assert(w.legendaire >= previous, `getLootRarityWeights() : Légendaire jamais moins fréquent en descendant (étage ${floor})`);
        previous = w.legendaire;
    });
    const early = getLootRarityWeights(1);
    assert(early.commun > early.rare + early.epique + early.legendaire, "getLootRarityWeights() : au début, le Commun domine");
}

// rollLootRarity() : exploration d'étage 1 jamais Légendaire ; boss jamais sous Rare et rarement Légendaire à l'étage 1.
{
    let legendary = 0, bossLegendary = 0, bossBelowRare = 0;
    for (let i = 0; i < 2000; i++) {
        if (rollLootRarity({ source: 'explore', floor: 1 }).key === 'legendaire') legendary++;
        const boss = rollLootRarity({ source: 'boss', floor: 1 });
        if (rarityIndex(boss.key) < rarityIndex('rare')) bossBelowRare++;
        if (boss.key === 'legendaire') bossLegendary++;
    }
    assert(legendary === 0, "rollLootRarity() : jamais de Légendaire en explorant l'étage 1");
    assert(bossBelowRare === 0, "rollLootRarity() : un boss lâche toujours au moins du Rare");
    assert(bossLegendary / 2000 < 0.08, `rollLootRarity() : Légendaire rare sur un boss d'étage 1 (${(bossLegendary / 20).toFixed(1)} %)`);

    // Jet 0 -> premier palier (Camelote) ; un boss monte d'un palier puis applique le plancher Rare.
    assert(withRandom(0, () => rollLootRarity({ source: 'explore', floor: 1 })).key === 'camelote', "rollLootRarity() : jet 0 -> Camelote");
    assert(withRandom(0, () => rollLootRarity({ source: 'boss', floor: 1 })).key === 'rare', "rollLootRarity() : boss, jet 0 -> Camelote +1 palier, plancher Rare");
    assert(withRandom(0, () => rollLootRarity({ source: 'treasure', floor: 1 })).key === 'commun', "rollLootRarity() : trésor -> toujours un palier au-dessus");
    assert(withRandom(0, () => rollLootRarity({ source: 'elite', floor: 1 })).key === 'commun', "rollLootRarity() : élite, jet de montée réussi -> un palier au-dessus");
    assert(withRandom(0.99, () => rollLootRarity({ source: 'boss', floor: 18 })).key === 'legendaire', "rollLootRarity() : jamais au-delà de Légendaire");
    assert(withRandom(0, () => rollLootRarity({ source: 'explore', floor: 1, minRarityKey: 'epique' })).key === 'epique', "rollLootRarity() : minRarityKey sert de plancher");
}

// Objets de base : `minFloor` respecté, objets blagues seulement au palier Camelote.
{
    resetTransientState();
    let tooDeep = 0, jokeOutsideJunk = 0, junkWithJoke = 0;
    for (let i = 0; i < 400; i++) {
        const item = generateItem({ floor: 1 });
        if (item.category === 'scrolls') {
            if ((spellCatalog.find(s => s.name === item.spellName).minFloor || 1) > 1) tooDeep++;
            continue;
        }
        const base = baseItems[item.category].find(b => b.name === item.baseName);
        if ((base.minFloor || 1) > 1) tooDeep++;
        if (item.jokeItem && item.rarityKey !== 'camelote') jokeOutsideJunk++;
    }
    for (let i = 0; i < 200; i++) {
        if (generateItem({ floor: 1, category: 'weapons', rarityKey: 'camelote' }).jokeItem) junkWithJoke++;
    }
    assert(tooDeep === 0, "generateItem() : aucun objet de base au-delà de sa profondeur minimale (minFloor)");
    assert(jokeOutsideJunk === 0, "generateItem() : un objet blague ne tombe jamais qu'au palier Camelote");
    assert(junkWithJoke > 0, "generateItem() : le palier Camelote peut tirer un objet blague");
}

// Niveau d'objet : les stats grimpent avec le niveau d'objet (pas le coût en mana d'un sort) ; tous les
// objets générés portent itemLevel = étage par défaut.
{
    resetTransientState();
    const base = baseItems.weapons.find(b => b.name === "Pied-de-biche");
    const low = buildItem(base, 'weapons', getRarityByKey('commun'), 1, { jitter: false });
    const high = buildItem(base, 'weapons', getRarityByKey('commun'), 9, { jitter: false });
    assert(low.baseDmg === base.baseDmg && low.itemLevel === 1, "buildItem() : Commun niveau 1 = stats de base");
    assert(high.baseDmg === Math.round(base.baseDmg * getItemLevelMult(9)), "buildItem() : stats × multiplicateur de niveau d'objet");
    assert(high.value > low.value, "buildItem() : un objet de plus haut niveau vaut plus cher");

    const potion = baseItems.consumables.find(b => b.name === "Café Froid");
    const p1 = buildItem(potion, 'consumables', getRarityByKey('legendaire'), 1, { jitter: false });
    assert(!p1.mechanics && p1.name === potion.name, "buildItem() : un consommable n'a jamais de qualificatif, même Légendaire");
    assert(p1.heal === Math.round(potion.heal * getRarityByKey('legendaire').statMult), "buildItem() : le soin suit la rareté");

    const deep = generateItem({ floor: 7, category: 'armors' });
    assert(deep.itemLevel === 7, "generateItem() : niveau d'objet = étage par défaut");
}

// Courbe de puissance (cibles de NOTES_ITEMS.md) : un Légendaire d'étage 4 est dépassé par un Commun
// d'étage ~10 ; un Commun d'étage 10 frappe nettement plus fort qu'un Commun d'étage 1.
{
    const avgBaseAt = (floor) => {
        const pool = baseItems.weapons.filter(b => !b.jokeItem && (b.minFloor || 1) <= floor);
        return pool.reduce((s, b) => s + b.baseDmg, 0) / pool.length;
    };
    const legend4 = computeItemStat(avgBaseAt(4), 'legendaire', 4);
    assert(computeItemStat(avgBaseAt(7), 'commun', 7) < legend4, "Courbe : un Légendaire d'étage 4 reste au-dessus d'un Commun d'étage 7");
    assert(computeItemStat(avgBaseAt(12), 'commun', 12) > legend4, "Courbe : un Légendaire d'étage 4 finit dépassé par un Commun d'étage 12");
    assert(computeItemStat(avgBaseAt(10), 'commun', 10) > 3 * computeItemStat(avgBaseAt(1), 'commun', 1), "Courbe : un Commun d'étage 10 vaut plus de 3× un Commun d'étage 1");
}

// Valeur marchande : croît fortement avec la rareté, avec le niveau d'objet et les qualificatifs.
{
    const v = (rarity, lvl = 1, enchants = 0) => computeItemValue(20, rarity, lvl, enchants);
    assert(v('commun') === 20, "computeItemValue() : Commun niveau 1 sans qualificatif = baseValue");
    assert(v('legendaire', 1, 3) > 20 * v('commun'), "computeItemValue() : un Légendaire vaut plus de 20× un Commun");
    assert(v('rare', 5) > v('rare', 1) && v('rare', 1, 1) > v('rare', 1, 0), "computeItemValue() : niveau d'objet et qualificatifs font grimper la valeur");
    assert(getSellPrice({ value: 100 }) === Math.round(100 * SELL_VALUE_RATIO) && getSellPrice({ baseValue: 10 }) === Math.round(10 * SELL_VALUE_RATIO), "getSellPrice() : value en priorité, baseValue en repli");
}

// Butin d'un boss : au moins un objet de rareté >= Rare, objet signature garanti la première fois
// seulement, au niveau d'objet de l'étage (+1 pour le boss d'un repaire).
{
    resetTransientState();
    gameState.currentFloor = 4;
    gameState.inventory = [];
    gameState.spellbook = [];
    const template = Object.values(districtBosses).find(b => b.signatureItem && b.signatureItem.category === 'weapons');
    const boss = { ...JSON.parse(JSON.stringify(template)), baseName: template.name };

    awardBossSignatureItem(boss, 4);
    const signature = gameState.inventory.find(i => i.signature);
    assert(signature && signature.rarityKey === 'legendaire' && signature.itemLevel === 4, "awardBossSignatureItem() : première victoire -> objet signature Légendaire au niveau d'objet demandé");
    assert(signature.baseDmg === Math.round(template.signatureItem.baseDmg * getRarityByKey('legendaire').statMult * getItemLevelMult(4)), "buildSignatureItem() : stats de base × Légendaire × niveau d'objet, sans aléa");
    assert(gameState.signaturesAwarded.includes(template.name), "awardBossSignatureItem() : boss mémorisé dans signaturesAwarded");

    gameState.inventory = [];
    withRandom(0.99, () => awardBossSignatureItem(boss, 4));
    assert(gameState.inventory.length === 0, "awardBossSignatureItem() : déjà obtenu -> plus garanti (jet raté)");
    withRandom(0, () => awardBossSignatureItem(boss, 4));
    assert(gameState.inventory.length === 1, "awardBossSignatureItem() : déjà obtenu -> reste possible (jet réussi)");

    resetTransientState();
    gameState.currentFloor = 4;
    gameState.inventory = [];
    gameState.spellbook = [];
    gameState.inCombat = true;
    gameState.currentEnemy = { ...boss, hp: 0, maxHp: 100, status: {}, isBoss: true };
    winCombat();
    const drops = [...gameState.inventory, ...gameState.spellbook].filter(i => !i.signature);
    assert(drops.length >= 1 && drops.every(i => rarityIndex(i.rarityKey) >= rarityIndex('rare') && i.itemLevel === 4), "winCombat() : un boss lâche au moins un objet Rare ou mieux, au niveau d'objet de l'étage");
    if (typeof continueFromFloorTransition === 'function' && gameState.floorTransitionPending) continueFromFloorTransition();
    resetTransientState();
    gameState.inventory = [];
    gameState.spellbook = [];
    gameState.currentFloor = 1;
}

// Marchand : prix = valeur de l'objet × SHOP_MARKUP ; un parchemin a une vraie valeur.
{
    resetTransientState();
    gameState.currentFloor = 6;
    ['weapons', 'scrolls'].forEach(specialty => {
        generateShopStock(specialty).forEach(item => {
            assert(item.price === Math.max(1, Math.round(getItemValue(item) * SHOP_MARKUP)), `generateShopStock('${specialty}') : prix = valeur × SHOP_MARKUP`);
            assert(item.itemLevel === 6, `generateShopStock('${specialty}') : niveau d'objet = étage courant`);
        });
    });
    gameState.currentFloor = 1;
}

// Sorts : la rareté fait grimper le coût en mana moitié moins vite que les dégâts — un sort rare est
// aussi plus rentable par point de mana.
{
    const base = spellCatalog.find(s => s.name === "Poing de Glace");
    const commun = buildSpellScroll(base, getRarityByKey('commun'), 1, { jitter: false, qualifiers: [] });
    const legend = buildSpellScroll(base, getRarityByKey('legendaire'), 1, { jitter: false, qualifiers: [] });
    assert(legend.manaCost === Math.round(base.manaCost * (1 + (getRarityByKey('legendaire').statMult - 1) * itemBalance.spellManaRarityWeight)), "buildSpellScroll() : coût en mana × (1 + (statMult − 1) × spellManaRarityWeight)");
    assert(legend.baseDmg / legend.manaCost > commun.baseDmg / commun.manaCost, "buildSpellScroll() : un Légendaire fait plus de dégâts par point de mana qu'un Commun");
}
