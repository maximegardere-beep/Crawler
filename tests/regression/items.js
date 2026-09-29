// items.js — tests régression : Objets : qualificatifs (catalogue, tirage, effets en combat), icône élite, badges.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L478-625 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Qualificatifs (chantier "refonte des objets", voir itemQualifiers dans items.js)
// ===================================================================
function freshAttacker(overrides = {}) {
    return Object.assign({ name: "Cobaye", hp: 200, maxHp: 200, atk: 10, def: 5, status: {} }, overrides);
}
const withRandom = (value, fn) => {
    const original = Math.random;
    Math.random = typeof value === 'function' ? value : () => value;
    try { return fn(); } finally { Math.random = original; }
};
const qItem = (category, qualifiers, extra = {}) => Object.assign({ name: "Objet d'Essai", category, baseDmg: 10, baseArmor: 10, qualifiers, mechanics: qualifiers.map(q => q.key) }, extra);

// Catalogue : chaque qualificatif est complet, décrit par des chiffres, et a sa couleur.
{
    const keys = Object.keys(itemQualifiers);
    assert(keys.length >= 30, `itemQualifiers : au moins 30 qualificatifs (${keys.length})`);
    keys.forEach(key => {
        const q = itemQualifiers[key];
        const targets = ['weapon', 'armor', 'spell'].filter(t => q[t]);
        assert(q.name && q.icon && [1, 2, 3].includes(q.tier) && ['proc', 'passive', 'malus'].includes(q.kind), `${key} : nom, icône, tier et type valides`);
        assert(targets.length > 0, `${key} : au moins un type d'objet ciblé`);
        assert(ENCHANT_COLORS[key], `${key} : couleur d'enchantement (ENCHANT_COLORS) définie`);
        targets.forEach(target => {
            const ranks = q.kind === 'malus' ? [1] : [1, 2, 3];
            ranks.forEach(rank => {
                const text = describeQualifier(key, target, rank);
                assert(text.length > 10 && !/undefined|NaN/.test(text), `${key}/${target} rang ${rank} : texte d'inspection complet (${text})`);
                assert(/\d/.test(text) || ['stun', 'random'].includes(key), `${key}/${target} rang ${rank} : le texte donne un chiffre`);
            });
            Object.entries(q[target]).forEach(([field, raw]) => {
                if (Array.isArray(raw)) assert(raw.length === (q.kind === 'malus' ? 1 : 3), `${key}/${target}.${field} : une valeur par rang`);
            });
        });
        if (q.kind !== 'malus') {
            ['weapon', 'armor', 'spell'].filter(t => q[t]).forEach(target => {
                const v1 = getQualifierValues(key, target, 1), v3 = getQualifierValues(key, target, 3);
                const grows = Object.keys(v1).some(f => typeof v1[f] === 'number' && v3[f] > v1[f]);
                assert(grows || key === 'stun' && target === 'armor' || v1.passive === undefined && Object.keys(v1).every(f => typeof v1[f] !== 'number' || v3[f] >= v1[f]), `${key}/${target} : le rang III est au moins aussi fort que le rang I`);
            });
        }
    });
    assert(describeQualifier('bleed', 'weapon', 3).includes('35 %') && describeQualifier('bleed', 'weapon', 1).includes('20 %'), "describeQualifier() : les chiffres suivent le rang");
    assert(formatQualifierLabel('bleed', 2) === 'Tranchant II' && formatQualifierLabel('rusty', 1) === 'Rouillé', "formatQualifierLabel() : rang en chiffres romains, jamais sur un défaut");
    // Plus aucun qualificatif purement cosmétique : Vibrant, Explosif et Ténébreux ont un vrai effet,
    // et Électrique ne double plus Lourd.
    assert(itemQualifiers.pleasure_or_pain.weapon && itemQualifiers.aoe.weapon && itemQualifiers.darkness.armor, "Vibrant, Explosif et Ténébreux ont un effet réel");
    assert(itemQualifiers.shock.weapon && !itemQualifiers.shock.weapon.text({ chance: 1, pct: 1 }).includes('étourdi'), "Électrique n'est plus un doublon de Lourd");
}

// Tirage : un qualificatif par slot, au rang de la rareté, jamais de défaut hors Camelote.
{
    for (let i = 0; i < 200; i++) {
        const rare = rollQualifiers(getRarityByKey('rare'), 'weapon');
        assert(rare.length === 1 && rare[0].rank === 1 && itemQualifiers[rare[0].key].tier === 1 && itemQualifiers[rare[0].key].weapon, "rollQualifiers() : Rare = 1 qualificatif de tier 1, rang I, valable sur une arme");
        const legend = rollQualifiers(getRarityByKey('legendaire'), 'armor');
        assert(legend.length === 3 && new Set(legend.map(q => q.key)).size === 3 && legend.every(q => q.rank === 3 && itemQualifiers[q.key].armor && itemQualifiers[q.key].kind !== 'malus'), "rollQualifiers() : Légendaire = 3 qualificatifs distincts, rang III, valables sur une armure, jamais un défaut");
        const junk = rollJunkMalus('weapon');
        assert(junk.length <= 1 && junk.every(q => itemQualifiers[q.key].kind === 'malus'), "rollJunkMalus() : au plus un défaut");
    }
    const base = baseItems.weapons.find(b => b.name === "Pied-de-biche");
    const rusty = buildItem(base, 'weapons', getRarityByKey('commun'), 5, { jitter: false, qualifiers: [{ key: 'rusty', rank: 1 }] });
    const clean = buildItem(base, 'weapons', getRarityByKey('commun'), 5, { jitter: false, qualifiers: [] });
    assert(rusty.baseDmg === Math.round(clean.baseDmg * 0.85) && rusty.name === "Pied-de-biche Rouillé", "Rouillé : dégâts −15 % comptés dans les stats, nom complété");
    const junkItems = Array.from({ length: 100 }, () => generateItem({ floor: 3, category: 'armors', rarityKey: 'camelote' }));
    assert(junkItems.every(i => getItemQualifierList(i).every(q => itemQualifiers[q.key].kind === 'malus')), "Camelote : seulement des défauts, jamais de qualificatif positif");
    assert(junkItems.some(i => i.qualifiers), "Camelote : porte parfois un défaut");

    const template = Object.values(districtBosses).find(b => b.signatureItem).signatureItem;
    const signature = buildSignatureItem(template, 3);
    assert(signature.qualifiers.length === template.mechanics.length && signature.qualifiers.every(q => q.rank === 3), "Objet signature : son mécanisme fixe au rang III");
}

// Effets déclenchés : valeurs exactes du rang.
{
    const a = freshAttacker();
    resolveQualifierEffect('bleed', getQualifierValues('bleed', 'armor', 1), a, 20, 'armor');
    assert(a.status.bleed && a.status.bleed.rounds === 3 && a.status.bleed.dmgPerRound === 4, "Tranchant I (armure) : 3 tours, 20 % des dégâts encaissés par tour");
    const b = freshAttacker();
    resolveQualifierEffect('poison', getQualifierValues('poison', 'weapon', 3), b, 50);
    assert(b.status.bleed.rounds === 5 && b.status.bleed.dmgPerRound === 8, "Empoisonné III : 5 tours, 16 % des dégâts du coup par tour");
    const c = freshAttacker();
    resolveQualifierEffect('stun', getQualifierValues('stun', 'weapon', 1), c, 10);
    assert(c.status.stunned === true, "Lourd : étourdit la cible");
    ['slow', 'light', 'corrode', 'fear'].forEach(key => {
        const foe = freshAttacker();
        const v = getQualifierValues(key, 'weapon', 2);
        resolveQualifierEffect(key, v, foe, 10);
        const statusKey = { slow: 'slowed', light: 'blinded', corrode: 'corroded', fear: 'feared' }[key];
        assert(foe.status[statusKey] && foe.status[statusKey].rounds === v.rounds, `${itemQualifiers[key].name} : pose l'état ${statusKey} pour ${v.rounds} tours`);
    });
    const d = freshAttacker();
    resolveQualifierEffect('pleasure_or_pain', getQualifierValues('pleasure_or_pain', 'weapon', 1), d, 10);
    assert(d.status.distracted && d.status.distracted.miss === 30, "Vibrant : la cible est déconcentrée (30 % de rater)");
    const e = freshAttacker({ atk: 100 });
    for (let i = 0; i < 10; i++) resolveQualifierEffect('drain', getQualifierValues('drain', 'weapon', 3), e, 10);
    assert(e.drainedPct === 40 && e.atk === 60, `Drainant : ATQ −12 % de l'ATQ d'origine par déclenchement, plafonné à −40 % (atk ${e.atk})`);

    resetTransientState();
    gameState.hp = 50;
    resolveQualifierEffect('heal', getQualifierValues('heal', 'armor', 2), freshAttacker(), 20, 'armor');
    assert(gameState.hp === 56, "Régénérant II : soigne 6 % des PV max");
    gameState.hp = 50;
    resolveQualifierEffect('lifesteal', getQualifierValues('lifesteal', 'armor', 1), freshAttacker(), 40, 'armor');
    assert(gameState.hp === 58, "Vampirique I (armure) : récupère 20 % des dégâts encaissés");
    resolveQualifierEffect('adrenaline', getQualifierValues('adrenaline', 'weapon', 3), freshAttacker(), 10);
    assert(gameState.status.adrenaline && Math.abs(gameState.status.adrenaline.mult - 1.35) < 1e-9, "Galvanisant III : dégâts +35 %");
}

// Déclenchement : chaque qualificatif a sa propre chance ; Vampirique d'arme agit à chaque coup ;
// Chaotique pioche un vrai effet.
{
    resetTransientState();
    const armor = qItem('armors', [{ key: 'bleed', rank: 1 }]);
    gameState.equipment.armor = armor;
    let triggered = 0;
    for (let i = 0; i < 400; i++) {
        const a = freshAttacker();
        applyArmorMechanic(a, 20);
        if (a.status.bleed) triggered++;
    }
    assert(triggered > 40 && triggered < 130, `applyArmorMechanic() : Tranchant I se déclenche ~20 % du temps (${triggered}/400)`);
    gameState.equipment.armor = null;
    const none = freshAttacker();
    applyArmorMechanic(none, 20);
    assert(!none.status.bleed && !none.status.stunned, "applyArmorMechanic() ne fait rien sans armure équipée");

    gameState.equipment.armor = qItem('armors', [{ key: 'thorns', rank: 3 }]);
    const t = freshAttacker({ hp: 100 });
    applyArmorMechanic(t, 50);
    assert(t.hp === 90, "Épineux III : renvoie 20 % des dégâts encaissés");
    const dying = freshAttacker({ hp: 3 });
    applyArmorMechanic(dying, 500);
    assert(dying.hp === 1, "Épineux : n'achève jamais l'attaquant");
    gameState.equipment.armor = null;

    resetTransientState();
    gameState.hp = 50;
    gameState.inCombat = true;
    gameState.currentEnemy = freshAttacker();
    gameState._lastPlayerDamage = 50;
    applyWeaponMechanic(qItem('weapons', [{ key: 'lifesteal', rank: 3 }]));
    assert(gameState.hp === 58, "Vampirique III (arme) : chaque coup soigne 16 % des dégâts infligés, sans jet");

    const foe = freshAttacker();
    withRandom(0, () => triggerItemQualifiers(qItem('weapons', [{ key: 'random', rank: 2 }]), 'weapon', foe, 30));
    const pool = getRandomizableQualifiers('weapon');
    assert(!pool.includes('random') && !pool.includes('shock') && pool.includes(pool[0]), "Chaotique : pioche parmi les vrais effets déclenchés");
    assert(Object.values(foe.status).some(Boolean) || gameState.hp !== 58 || foe.atk !== 10, "Chaotique : déclenche bien un effet");
    gameState.inCombat = false;
    gameState.currentEnemy = null;
}

// Effets permanents et défauts, via l'équipement porté.
{
    resetTransientState();
    const baseline = getStealthChance();
    gameState.equipment.weapon = qItem('weapons', [{ key: 'stealth', rank: 3 }]);
    gameState.equipment.armor = qItem('armors', [{ key: 'squeaky', rank: 1 }]);
    assert(getStealthChance() === baseline + 16 - 10, "Silencieux III (+16) et Grinçant (−10) s'additionnent sur la furtivité");
    gameState.equipment.weapon = null;

    gameState.equipment.armor = qItem('armors', [{ key: 'sturdy', rank: 2 }]);
    recomputeMaxHp();
    assert(gameState.maxHp === Math.round(gameState.baseMaxHp * 1.12), "Robuste II : PV max +12 %");
    gameState.equipment.armor = null;
    recomputeMaxHp();
    assert(gameState.maxHp === gameState.baseMaxHp, "Robuste : retiré avec l'armure");

    gameState.equipment.armor = qItem('armors', [{ key: 'swift', rank: 3 }]);
    assert(sumEquippedQualifier('swift', 'bonus') === 3, "Véloce III : +3 aux jets de distance");
    gameState.equipment.armor = qItem('armors', [{ key: 'darkness', rank: 1 }]);
    assert(withRandom(0, () => rollPlayerDodge(freshAttacker())) === true && withRandom(0.99, () => rollPlayerDodge(freshAttacker())) === false, "Ténébreux : esquive selon sa chance");
    gameState.equipment.armor = null;

    const spell = qItem('scrolls', [{ key: 'thrifty', rank: 3 }], { manaCost: 20 });
    assert(getSpellManaCost(spell) === 16 && getSpellManaCost({ manaCost: 20 }) === 20, "Économe III : coût en mana −20 %");

    const debuffed = freshAttacker({ status: { slowed: { rounds: 1 }, feared: { rounds: 2 } } });
    const { mult } = consumeEnemyAttackDebuffs(debuffed);
    assert(Math.abs(mult - 0.325) < 1e-9 && debuffed.status.slowed === null && debuffed.status.feared.rounds === 1, "Gelé + Terrifiant : dégâts ×0,5 ×0,65, un tour consommé");
}

// Qualificatifs d'attaque (performPlayerAttack(), options.gear) : Aiguisé, Perforant, Électrique, Bancal.
{
    const hitWith = (gear, foeDef = 0, random = 0.5) => {
        resetTransientState();
        gameState.inCombat = true;
        gameState.combatDistance = 0;
        gameState.currentEnemy = freshAttacker({ hp: 10000, maxHp: 10000, def: foeDef, atk: 1 });
        withRandom(random, () => performPlayerAttack(100, { gear }, "à l'essai"));
        const dealt = 10000 - gameState.currentEnemy.hp;
        gameState.inCombat = false;
        gameState.currentEnemy = null;
        return dealt;
    };
    const plain = hitWith(qItem('weapons', []));
    assert(hitWith(qItem('weapons', [{ key: 'keen', rank: 3 }])) === Math.round(plain * 1.16), "Aiguisé III : dégâts +16 %");
    assert(hitWith(qItem('weapons', [{ key: 'pierce', rank: 3 }]), 100) > hitWith(qItem('weapons', []), 100), "Perforant : ignore une part de la DEF");
    const shocked = hitWith(qItem('weapons', [{ key: 'shock', rank: 1 }]), 0, 0.01);
    assert(shocked > hitWith(qItem('weapons', []), 0, 0.01), "Électrique : dégâts bonus quand il se déclenche");
    assert(hitWith(qItem('weapons', [{ key: 'wobbly', rank: 1 }]), 0, 0) === 0, "Bancal : coup complètement raté quand le défaut se déclenche");
}

// Vibrant : un ennemi déconcentré peut rater complètement sa riposte.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.combatDistance = 0;
    gameState.currentEnemy = freshAttacker({ atk: 50, status: { distracted: { rounds: 1, miss: 30 } } });
    const hpBefore = gameState.hp;
    withRandom(0, () => resolveEnemyCounterAttack());
    assert(gameState.hp === hpBefore && gameState.currentEnemy.status.distracted === null, "Vibrant : riposte ratée, état consommé");
    gameState.inCombat = false;
    gameState.currentEnemy = null;
}

// ===================================================================
// Icône élite 💀
// ===================================================================
{
    const weakMob = { name: "Faible", isBoss: false, threatMultiplier: 1.0 };
    const eliteMob = { name: "Fort", isBoss: false, threatMultiplier: 3.6 };
    const boss = { name: "Boss", isBoss: true };
    assert(isEliteMob(weakMob) === false, "isEliteMob() : pas de bonus -> pas élite");
    assert(isEliteMob(eliteMob) === true, "isEliteMob() : threatMultiplier=3.6 -> élite");
    assert(isEliteMob(boss) === false, "isEliteMob() : un boss n'est jamais élite (déjà signalé par 👑)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = eliteMob;
    updateUI();
    assert(ui.enemyName.innerText.startsWith('💀'), "En-tête de combat : 💀 pour un mob élite");

    gameState.currentEnemy = boss;
    updateUI();
    assert(ui.enemyName.innerText.startsWith('👑') && !ui.enemyName.innerText.includes('💀'), "Un boss garde uniquement la couronne");

    gameState.currentEnemy = weakMob;
    updateUI();
    assert(!ui.enemyName.innerText.includes('💀') && !ui.enemyName.innerText.includes('👑'), "Un mob normal n'affiche ni couronne ni crâne");
}
{
    resetTransientState();
    gameState.currentFloor = 1;
    let sawAboveOne = true, allPositive = true;
    for (let i = 0; i < 200; i++) {
        const mob = generateMob("Tunnels de Métro Abandonnés");
        if (typeof mob.threatMultiplier !== 'number' || mob.threatMultiplier <= 0) allPositive = false;
    }
    assert(allPositive, "generateMob() pose toujours un threatMultiplier numérique positif (200 générations)");
}

// ===================================================================
// Badges de qualificatifs : nom, rang, effet exact en infobulle ; défaut en rouge
// ===================================================================
{
    const armor = qItem('armors', [{ key: 'bleed', rank: 2 }, { key: 'darkness', rank: 2 }]);
    const html = buildQualifierBadgesHtml(armor);
    assert(html.includes('🩸') && html.includes('Tranchant II') && html.includes(describeQualifier('bleed', 'armor', 2).slice(0, 20)), "Badge : icône, nom + rang, texte d'inspection en infobulle");
    assert(html.includes('Ténébreux II') && !html.includes('cosmétique'), "Badge : plus aucun qualificatif « cosmétique »");
    assert(buildQualifierBadgesHtml(qItem('weapons', [{ key: 'rusty', rank: 1 }])).includes('bg-red-100'), "Badge : un défaut de Camelote s'affiche en rouge");
    assert(buildQualifierBadgesHtml(null) === '', "buildQualifierBadgesHtml() ne plante pas sans objet");
}

// ===================================================================
// Panneau d'inspection (openItemInspect()) : stats, rareté, niveau d'objet, qualificatifs avec effet
// exact, valeur, comparaison avec l'objet porté ; actions du contexte ; la boutique passe par lui.
// ===================================================================
{
    resetTransientState();
    const worn = buildItem(baseItems.weapons.find(b => b.name === "Pied-de-biche"), 'weapons', getRarityByKey('commun'), 1, { jitter: false, qualifiers: [] });
    const found = buildItem(baseItems.weapons.find(b => b.name === "Hache à Viande"), 'weapons', getRarityByKey('epique'), 4, { jitter: false, qualifiers: [{ key: 'bleed', rank: 2 }, { key: 'precise', rank: 2 }] });
    gameState.equipment.weapon = worn;
    const html = buildItemInspectHtml(found);
    assert(html.includes(found.name) && html.includes('Épique') && html.includes("Niveau d'objet 4"), "Inspection : nom, rareté et niveau d'objet");
    assert(html.includes(describeQualifier('bleed', 'weapon', 2)) && html.includes(describeQualifier('precise', 'weapon', 2)), "Inspection : l'effet exact de chaque qualificatif");
    assert(html.includes(`${getItemValue(found)} PO`) && html.includes(`${getSellPrice(found)} PO`), "Inspection : valeur et prix de revente");
    assert(html.includes('Actuellement porté') && html.includes(`▲ +${found.baseDmg - worn.baseDmg}`), "Inspection : comparaison chiffrée avec l'arme portée");
    assert(!buildItemInspectHtml(worn).includes('Actuellement porté'), "Inspection : l'objet porté ne se compare pas à lui-même");
    const junk = buildItem(baseItems.weapons.find(b => b.name === "Pied-de-biche"), 'weapons', getRarityByKey('camelote'), 1, { jitter: false, qualifiers: [{ key: 'wobbly', rank: 1 }] });
    assert(buildItemInspectHtml(junk).includes('défaut'), "Inspection : un défaut de Camelote est signalé comme tel");
    const potion = buildItem(baseItems.consumables[0], 'consumables', getRarityByKey('commun'), 1, { jitter: false });
    assert(buildItemInspectHtml(potion).includes('Soin') && buildItemInspectHtml(potion).includes('jamais de qualificatif'), "Inspection : un consommable montre son soin");
    const spell = buildSpellScroll(spellCatalog[0], getRarityByKey('rare'), 2, { jitter: false, qualifiers: [{ key: 'thrifty', rank: 1 }] });
    assert(buildItemInspectHtml(spell, { compareTo: null }).includes(`${getSpellManaCost(spell)}`), "Inspection : un sort montre son coût en mana effectif");

    let called = 0;
    openItemInspect(found, { actions: [{ label: 'Équiper', onClick: () => { called++; } }] });
    assert(!ui.itemInspectOverlay.classList.contains('hidden'), "openItemInspect() : affiche le panneau");
    const buttons = ui.itemInspectActions.children;
    assert(buttons.length === 2 && buttons[1].innerText === 'Fermer', "openItemInspect() : les actions du contexte + « Fermer »");
    buttons[0].dispatch('click');
    assert(called === 1 && ui.itemInspectOverlay.classList.contains('hidden'), "openItemInspect() : une action s'exécute et referme le panneau");
    gameState.equipment.weapon = null;
}
{
    // Boutique : toucher une ligne inspecte, l'achat passe par le bouton du panneau.
    resetTransientState();
    const item = buildItem(baseItems.armors[0], 'armors', getRarityByKey('rare'), 3, { jitter: false, qualifiers: [{ key: 'thorns', rank: 1 }] });
    item.price = 10;
    const city = { id: 'c-inspect', role: 'merchant', specialty: 'armors', stock: [item] };
    const previousMap = gameState.urbanMap;
    gameState.urbanMap = { citiesById: { 'c-inspect': city }, theme: gameState.currentDistrict };
    gameState.pendingShopCityId = 'c-inspect';
    gameState.gold = 50;
    gameState.inventory = [];
    updateShopUI();
    ui.shopStockList.children[0].dispatch('click');
    assert(gameState.gold === 50 && city.stock.length === 1 && !ui.itemInspectOverlay.classList.contains('hidden'), "Boutique : toucher une ligne ouvre l'inspection sans rien acheter");
    ui.itemInspectActions.children[0].dispatch('click');
    assert(gameState.gold === 40 && gameState.inventory.includes(item), "Boutique : le bouton Acheter du panneau achète l'objet");
    gameState.urbanMap = previousMap;
    gameState.pendingShopCityId = null;
    gameState.inventory = [];
    closeItemInspect();
}
