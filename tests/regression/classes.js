// classes.js — tests régression : chantier 13, lot 3 (passifs de style et capacités actives des 6 classes, synergies race × classe).
// Voir app.js (section « CLASSE : PASSIFS DE STYLE ET CAPACITÉS ACTIVES »), origins.js et CHANTIERS.md (chantier 13).
const { assert, resetTransientState } = require('./_helpers.js');

const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const setup = (race, cls, extra = {}) => {
    resetTransientState();
    gameState.currentFloor = 3;
    gameState.baseMaxHp = 1000; gameState.def = 5; gameState.equipment = { weapon: null, ranged: null, armor: null, spell: null };
    if (race) applyRace(race);
    gameState.crawlerClass = cls || null;
    recomputeMaxHp(); gameState.hp = gameState.maxHp;
    Object.assign(gameState.equipment, extra.equipment || {});
};
const WEAPON = () => ({ name: 'Épée', category: 'weapons', baseDmg: 10 });
const GUN = () => ({ name: 'Pistolet', category: 'ranged', baseDmg: 10 });
const duel = (extra = {}, distance = 0) => {
    const mob = Object.assign({ name: 'Cobaye', hp: 99999, maxHp: 99999, atk: 20, def: 0, xpReward: 1, status: {}, effect: null, ranged: distance > 0 }, extra);
    withRand(0.5, () => initiateCombat(mob));
    gameState.combatDistance = distance;
    return gameState.currentEnemy;
};
// Capture les options passées à performPlayerAttack() (sans rien jouer) par `run`.
const capture = (run) => {
    const calls = [];
    const original = performPlayerAttack;
    performPlayerAttack = (atk, options, label) => { calls.push({ atk, options, label }); return true; };
    try { run(); } finally { performPlayerAttack = original; }
    return calls;
};

// --- Catalogue ---
{
    assert(Object.keys(ORIGIN_CLASSES).sort().join() === Object.keys(config.origins.classes).sort().join(), "Chaque classe du catalogue a ses réglages (config.origins.classes)");
    assert(Object.keys(ORIGIN_CLASSES).sort().join() === Object.keys(CLASS_ABILITIES).sort().join(), "Chaque classe a sa capacité codée (CLASS_ABILITIES)");
    assert(Object.values(ORIGIN_CLASSES).every(c => c.abilityName && c.ability.startsWith(c.abilityName)), "Chaque classe a un nom de capacité qui ouvre sa description");
    assert(ORIGIN_SYNERGIES.every(s => config.origins.synergies[`${s.race}+${s.cls}`]) && Object.keys(config.origins.synergies).length === ORIGIN_SYNERGIES.length, "Chaque synergie du catalogue a ses chiffres, et inversement");
    setup(null, null);
    assert(Object.keys(originClassEffects()).length === 0 && activeSynergy() === null, "Sans classe : aucun effet, aucune synergie");
    setup('troll', 'brawler');
    assert(activeSynergy() && activeSynergy().stunTurns === 2 && originAbilityValues().abilityMult === 2 && originAbilityValues().stunTurns === 2, "Troll + Bagarreur : la synergie remplace le nombre de tours d'étourdissement, garde le reste");
    setup('troll', 'duelist');
    assert(activeSynergy() === null && originAbilityValues().abilityMult === 1.8, "Troll + Duelliste : pas de synergie");
}

// --- Passifs de style ---
{
    setup(null, 'punchingBag');
    assert(gameState.maxHp === 1100, `Sac de frappe : PV max +10 % (${gameState.maxHp})`);
    setup('troll', 'punchingBag');
    assert(gameState.maxHp === Math.round(1000 * 1.25 * 1.1), "Race et classe se cumulent en multiplicatif sur les PV max");

    const mult = (race, cls) => { setup(race, cls); duel(); return capture(() => withRand(0.5, () => attackUnarmed()))[0].options.atkMultiplier; };
    assert(near(mult(null, null), 0.75) && near(mult(null, 'brawler'), 0.75 * 1.15), "Bagarreur : mains nues +15 %");
    assert(near(mult('troll', 'brawler'), 0.75 * 1.15 * 1.15), "Troll + Bagarreur : cumul multiplicatif (×1,15 × ×1,15)");
    assert(near(mult(null, 'duelist'), 0.75), "Une autre classe : mains nues inchangées");

    const weapon = (cls) => { setup(null, cls, { equipment: { weapon: WEAPON() } }); duel(); return capture(() => withRand(0.5, () => attackWeapon()))[0].options.atkMultiplier; };
    assert(near(weapon(null), 1) && near(weapon('duelist'), 1.1) && near(weapon('gunslinger'), 1), "Duelliste : arme +10 % (seule classe concernée)");
    setup(null, 'duelist', { equipment: { weapon: WEAPON() } }); gameState.skills.weapon.level = 3; duel();
    assert(near(capture(() => withRand(0.5, () => attackWeapon()))[0].options.atkMultiplier, (1 + 0.04 * 2) * 1.1), "Duelliste : se cumule avec le niveau d'Arme");
    const ranged = (cls) => { setup(null, cls, { equipment: { ranged: GUN() } }); duel({}, 3); return capture(() => withRand(0.5, () => attackRanged()))[0].options.atkMultiplier; };
    assert(near(ranged(null), 1) && near(ranged('gunslinger'), 1.1) && near(ranged('duelist'), 1), "Franc-tireur : tir +10 %");

    setup(null, null); const spell = generateTestKitSpell(); const base = getSpellManaCost(spell);
    setup(null, 'occultist');
    assert(getSpellManaCost(spell) === Math.max(1, Math.round(base * 0.9)) && getSpellManaCost(spell) < base, `Occultiste : coût en mana −10 % (${base} -> ${getSpellManaCost(spell)})`);

    setup(null, null); const stealth0 = getStealthChance(); const level0 = effectiveStealthLevel();
    setup(null, 'trickster');
    assert(effectiveStealthLevel() === level0 + 1 && getStealthChance() === stealth0 + 6, `Filou : Furtivité +1 niveau (+6 pts de détection : ${stealth0} -> ${getStealthChance()})`);
    assert(stealthSkillLevel() === level0 + 1, "Filou : le niveau compte aussi pour le crochetage");
}

// --- Disponibilité de la capacité ---
{
    setup(null, null); duel();
    assert(classAbilityStatus().usable === false && useClassAbility() === false, "Sans classe : pas de capacité");
    setup(null, 'brawler');
    assert(classAbilityStatus().reason === "Seulement en combat.", "Hors combat : indisponible");
    duel();
    assert(classAbilityStatus().usable === true, "Bagarreur au contact : disponible");
    gameState.combatDistance = 3;
    assert(classAbilityStatus().usable === false, "Bagarreur loin : indisponible");
    gameState.combatDistance = 0;
    gameState.classAbilityUsed = true;
    assert(classAbilityStatus().reason === "Déjà utilisée dans ce combat." && useClassAbility() === false, "Capacité déjà utilisée : refusée");
    setup(null, 'duelist'); duel();
    assert(classAbilityStatus().reason === "Aucune arme équipée.", "Duelliste sans arme : indisponible");
    gameState.equipment.weapon = WEAPON();
    assert(classAbilityStatus().usable, "Duelliste armé : disponible");
    gameState.status.disarmed = { rounds: 2 };
    assert(classAbilityStatus().reason === "Arme arrachée.", "Duelliste désarmé : indisponible");
    setup(null, 'gunslinger'); duel({}, 3);
    assert(classAbilityStatus().reason === "Aucune arme à distance.", "Franc-tireur sans arme à distance : indisponible");
    gameState.equipment.ranged = GUN();
    duel({}, 0);
    assert(classAbilityStatus().usable, "Franc-tireur : disponible même au contact (à toute distance)");
    setup(null, 'occultist'); duel();
    assert(classAbilityStatus().reason === "Aucun sort équipé.", "Occultiste sans sort : indisponible");
    ['trickster', 'punchingBag'].forEach(c => { setup(null, c); duel({}, 4); assert(classAbilityStatus().usable, `${c} : toujours disponible en combat`); });
    // Le bouton suit la disponibilité.
    setup(null, 'duelist'); duel(); updateClassAbilityUI();
    assert(!ui.btnClassAbility.classList.contains('hidden') && ui.btnClassAbility.disabled === true && ui.btnClassAbility.innerHTML.includes('Fendre') && ui.btnClassAbility.innerHTML.includes('Aucune arme'), "Bouton : visible en combat, grisé avec la raison");
    gameState.equipment.weapon = WEAPON(); updateClassAbilityUI();
    assert(ui.btnClassAbility.disabled === false && ui.btnClassAbility.innerHTML.includes('1 fois par combat'), "Bouton : actif quand la capacité est disponible");
    gameState.inCombat = false; gameState.currentEnemy = null; updateClassAbilityUI();
    assert(ui.btnClassAbility.classList.contains('hidden'), "Bouton : masqué hors combat");
    setup(null, null); updateClassAbilityUI();
    assert(ui.btnClassAbility.classList.contains('hidden'), "Bouton : masqué sans classe");
}

// --- Uppercut du dimanche (Bagarreur) ---
{
    setup(null, 'brawler');
    duel();
    const calls = capture(() => useClassAbility());
    assert(calls.length === 1 && near(calls[0].options.atkMultiplier, 0.75 * 1.15 * 2) && calls[0].label.includes('Uppercut'), "Uppercut : mains nues ×2 (par-dessus le style +15 %)");
    assert(gameState.classAbilityUsed === true && gameState.lastAttackKind === 'unarmed', "Uppercut : capacité consommée, posture de poings");
    // Vrai coup : l'ennemi est étourdi AVANT sa riposte — le joueur ne perd aucun PV.
    setup(null, 'brawler'); const mob = duel({ atk: 500 });
    const hp0 = gameState.hp;
    withRand(0.5, () => useClassAbility());
    assert(mob.hp < 99999 && gameState.hp === hp0, "Uppercut : dégâts infligés, riposte annulée par l'étourdissement");
    assert(mob.status.stunned === false, "Uppercut : l'étourdissement d'un tour est consommé par la riposte supprimée");
    // Synergie Troll : 2 tours.
    setup('troll', 'brawler'); const mob2 = duel({ atk: 500 });
    const hp1 = gameState.hp;
    withRand(0.5, () => useClassAbility());
    assert(gameState.hp === hp1 && mob2.status.stunned === 1, "Troll + Bagarreur : un tour d'étourdissement encore en réserve après la première riposte annulée");
    withRand(0.5, () => attackUnarmed());
    assert(gameState.hp === hp1 && mob2.status.stunned === false, "Troll + Bagarreur : la seconde riposte est annulée aussi");
    // Boss : jamais étourdi ; « exposé » seulement avec la synergie.
    setup(null, 'brawler'); const boss = duel({ isBoss: true, hp: 1000, maxHp: 1000, atk: 1, def: 0 });
    withRand(0.5, () => useClassAbility());
    assert(!boss.status.stunned && !boss.status.exposed, "Boss : ni étourdi, ni exposé sans la synergie");
    setup('troll', 'brawler'); const boss2 = duel({ isBoss: true, hp: 1000, maxHp: 1000, atk: 1, def: 0 });
    withRand(0.5, () => useClassAbility());
    assert(!boss2.status.stunned && boss2.status.exposed && boss2.status.exposed.rounds === 1, "Boss + synergie Troll : garde ouverte (exposé)");
    resetTransientState();
}

// --- Fendre (Duelliste) ---
{
    setup(null, 'duelist', { equipment: { weapon: WEAPON() } });
    duel();
    const calls = capture(() => useClassAbility());
    assert(calls.length === 1 && near(calls[0].options.atkMultiplier, 1.1 * 1.8) && calls[0].options.defReduction === 0.5 && calls[0].atk === gameState.atk + 10 && calls[0].options.gear.name === 'Épée', "Fendre : ×1,8 (par-dessus le style), ignore 50 % de la DEF, arme équipée");
    assert(gameState.lastAttackKind === 'weapon' && gameState.classAbilityUsed, "Fendre : posture d'arme, capacité consommée");
    // Plus fort qu'une attaque normale, à jet égal.
    setup(null, 'duelist', { equipment: { weapon: WEAPON() } }); let mob = duel({ def: 20, hp: 99999 });
    withRand(0.5, () => attackWeapon()); const normal = 99999 - mob.hp;
    setup(null, 'duelist', { equipment: { weapon: WEAPON() } }); mob = duel({ def: 20, hp: 99999 });
    withRand(0.5, () => useClassAbility()); const fendre = 99999 - mob.hp;
    assert(fendre > normal * 1.8, `Fendre inflige nettement plus qu'une attaque normale (${fendre} contre ${normal})`);
    resetTransientState();
}

// --- Tir de barrage (Franc-tireur) ---
{
    setup(null, 'gunslinger', { equipment: { ranged: GUN() } });
    duel({}, 3);
    const calls = capture(() => useClassAbility());
    assert(calls.length === 2 && calls.every(c => near(c.options.atkMultiplier, 1.1 * 0.8) && c.options.gear.name === 'Pistolet'), "Tir de barrage : 2 tirs à ×0,8 (par-dessus le style +10 %)");
    assert(calls[0].options.skipReaction === true && calls[1].options.skipReaction === false, "Tir de barrage : une seule riposte, après le dernier tir");
    // Au contact aussi (à toute distance).
    setup(null, 'gunslinger', { equipment: { ranged: GUN() } }); duel({}, 0);
    assert(capture(() => useClassAbility()).length === 2, "Tir de barrage : utilisable au contact");
    // Vrai jeu : deux tirs, UNE riposte.
    setup(null, 'gunslinger', { equipment: { ranged: GUN() } });
    const mob = duel({ atk: 100, ranged: false }, 3);
    let reactions = 0; const originalReact = resolveEnemyReaction; resolveEnemyReaction = () => { reactions++; };
    try { withRand(0.5, () => useClassAbility()); } finally { resolveEnemyReaction = originalReact; }
    assert(reactions === 1 && mob.hp < 99999 - 5, `Tir de barrage : deux tirs portés, une seule riposte (${reactions})`);
    // Un premier tir qui achève l'ennemi : pas de second tir.
    setup(null, 'gunslinger', { equipment: { ranged: GUN() } });
    const frail = duel({ hp: 1, maxHp: 1 }, 3);
    let shots = 0; const originalAttack = performPlayerAttack;
    performPlayerAttack = (atk, options, label) => { shots++; frail.hp = 0; return true; };
    try { useClassAbility(); } finally { performPlayerAttack = originalAttack; }
    assert(shots === 1, "Tir de barrage : jamais de second tir sur un ennemi déjà tombé");
    resetTransientState();
}

// --- Surcharge (Occultiste) ---
{
    setup(null, 'occultist'); const spell = generateTestKitSpell(); spell.qualifiers = []; spell.mechanics = [];
    gameState.equipment.spell = spell; gameState.mana = 50;
    duel({ ranged: spell.spellCategory === 'ranged' }, spell.spellCategory === 'ranged' ? 3 : 0);
    withRand(0.5, () => useClassAbility());
    assert(gameState.status.overcharge === true && gameState.mana === 50 && gameState.classAbilityUsed, "Surcharge : armée, aucun mana dépensé, tour consommé");
    // Le sort suivant : gratuit, ×1,6, jamais de backfire (même sur un jet catastrophique).
    gameState.mana = 0;
    const calls = capture(() => withRand(0, () => attackMagic()));
    assert(calls.length === 1 && gameState.mana === 0 && gameState.status.overcharge === null, "Surcharge : le sort suivant est gratuit (mana 0 suffit) et consomme la charge");
    assert(!gameState.lastPlayerActionWasBackfire, "Surcharge : aucun backfire, même avec un jet à 0");
    // Dégâts ×1,6 : comparaison avec le même sort sans surcharge.
    const mult = (over) => { setup(null, 'occultist'); gameState.equipment.spell = spell; gameState.mana = 100; duel({}, spell.spellCategory === 'ranged' ? 3 : 0); if (over) gameState.status.overcharge = true; return capture(() => withRand(0.99, () => attackMagic()))[0].options.atkMultiplier; };
    assert(near(mult(true) / mult(false), 1.6), "Surcharge : le sort suivant porte ×1,6");
    setup('elf', 'occultist'); gameState.equipment.spell = spell; gameState.mana = 20; duel({}, spell.spellCategory === 'ranged' ? 3 : 0);
    withRand(0.5, () => useClassAbility());
    assert(gameState.mana === 40, `Elfe + Occultiste : la Surcharge rend 20 mana (${gameState.mana})`);
    gameState.mana = 100;
    const synMult = capture(() => withRand(0.99, () => attackMagic()))[0].options.atkMultiplier;
    setup('elf', 'occultist'); gameState.equipment.spell = spell; gameState.mana = 100; duel({}, spell.spellCategory === 'ranged' ? 3 : 0);
    const plain = capture(() => withRand(0.99, () => attackMagic()))[0].options.atkMultiplier;
    assert(near(synMult / plain, 1.8), `Elfe + Occultiste : Surcharge ×1,8 (×${(synMult / plain).toFixed(3)})`);
    resetTransientState();
}

// --- Disparition (Filou) ---
{
    setup(null, 'trickster');
    const mob = duel({ atk: 500 });
    const hp0 = gameState.hp;
    withRand(0.5, () => useClassAbility());
    assert(gameState.hp === hp0 && gameState.classAbilityUsed, "Disparition : la riposte qui suit est esquivée (aucun PV perdu)");
    assert(gameState.status.vanish && gameState.status.vanish.nextAttack === true && gameState.status.vanish.turns === 0, "Disparition : la charge d'esquive est consommée, le bonus d'attaque attend");
    const calls = capture(() => withRand(0.5, () => attackUnarmed()));
    assert(near(calls[0].options.atkMultiplier, 0.75) && gameState.status.vanish && gameState.status.vanish.nextAttack === true, "(contrôle) l'attaque capturée n'a pas consommé le bonus : il vit dans performPlayerAttack()");
    // Vrai coup : ×2 sur la prochaine attaque, une seule fois.
    setup(null, 'trickster'); const m = duel({ atk: 1, def: 0, hp: 999999, maxHp: 999999 });
    withRand(0.5, () => useClassAbility());
    const dmg = (fn) => { const before = m.hp; withRand(0.5, fn); return before - m.hp; };
    const doubled = dmg(() => attackUnarmed());
    const normal = dmg(() => attackUnarmed());
    assert(doubled >= normal * 1.8 && gameState.status.vanish === null, `Disparition : prochaine attaque ×2 (${doubled} contre ${normal}), une seule fois`);
    // Une riposte suivante n'est plus esquivée.
    setup(null, 'trickster'); duel({ atk: 500 });
    withRand(0.5, () => useClassAbility());
    const hp1 = gameState.hp;
    withRand(0.5, () => attackUnarmed());
    assert(gameState.hp < hp1, "Disparition : la riposte du tour suivant frappe normalement");
    // Synergie Gobelin : 2 ripostes esquivées.
    setup('goblin', 'trickster'); duel({ atk: 500 });
    const hp2 = gameState.hp;
    withRand(0.5, () => useClassAbility());
    withRand(0.5, () => attackUnarmed());
    assert(gameState.hp === hp2, "Gobelin + Filou : deux ripostes esquivées de suite");
    withRand(0.5, () => attackUnarmed());
    assert(gameState.hp < hp2, "Gobelin + Filou : la troisième riposte frappe");
    // Boss multi-coups : tout le tour est esquivé.
    setup(null, 'trickster'); const boss = duel({ isBoss: true, hp: 1000, maxHp: 1000, atk: 500, def: 0, status: {} });
    boss.hp = 500; // phase 2 : frappes multiples
    const hp3 = gameState.hp;
    withRand(0.5, () => useClassAbility());
    assert(gameState.hp === hp3, "Boss à frappes multiples : toutes les frappes du tour sont esquivées");
    resetTransientState();
}

// --- Encaisser (Sac de frappe) ---
{
    const taken = (race, cls, use) => {
        setup(race, cls); const mob = duel({ atk: 60, def: 0, hp: 5000, maxHp: 5000 });
        const hp0 = gameState.hp;
        if (use) withRand(0.5, () => useClassAbility()); else withRand(0.5, () => attackUnarmed());
        return { lost: hp0 - gameState.hp, mob };
    };
    const normal = taken(null, 'punchingBag', false);
    const braced = taken(null, 'punchingBag', true);
    assert(braced.lost > 0 && braced.lost < normal.lost, `Encaisser : DEF ×2, la riposte coûte moins (${braced.lost} contre ${normal.lost})`);
    assert(braced.mob.hp < 5000 && 5000 - braced.mob.hp === Math.round(braced.lost * 0.5), `Encaisser : 50 % des dégâts reçus renvoyés (${5000 - braced.mob.hp} pour ${braced.lost})`);
    const syn = taken('dwarf', 'punchingBag', true);
    assert(5000 - syn.mob.hp === Math.round(syn.lost * 0.75), `Nain + Sac de frappe : 75 % renvoyés (${5000 - syn.mob.hp} pour ${syn.lost})`);
    // DEF doublée seulement pendant la riposte.
    setup(null, 'punchingBag'); duel({ atk: 1 }); const def0 = getEffectiveDef();
    withRand(0.5, () => useClassAbility());
    assert(gameState.status.brace === null && getEffectiveDef() === def0, "Encaisser : la DEF redevient normale après la riposte");
    gameState.status.brace = true;
    assert(getEffectiveDef() === def0 * 2, "Encaisser : DEF ×2 tant que la posture est active");
    gameState.status.brace = null;
    // Jamais de coup fatal renvoyé.
    setup(null, 'punchingBag'); const weak = duel({ atk: 400, def: 0, hp: 3, maxHp: 3000 });
    gameState.status.brace = true;
    const back = applyBraceReflect(weak, 400);
    assert(weak.hp === 1 && back === 2, "Encaisser : le renvoi laisse toujours au moins 1 PV à l'attaquant");
    assert(applyBraceReflect(weak, 400) === 0 && weak.hp === 1, "Encaisser : rien à renvoyer sur un ennemi à 1 PV");
    gameState.status.brace = null;
    assert(applyBraceReflect(weak, 100) === 0, "Sans posture : aucun renvoi");
    resetTransientState();
}

// --- Un nouveau combat remet la capacité à zéro ---
{
    setup(null, 'trickster'); duel();
    withRand(0.5, () => useClassAbility());
    assert(gameState.classAbilityUsed === true, "Capacité utilisée dans le combat");
    gameState.inCombat = false; gameState.currentEnemy = null;
    duel();
    assert(gameState.classAbilityUsed === false && classAbilityStatus().usable, "Nouveau combat : la capacité est de nouveau disponible");
    assert(gameState.status.vanish === undefined || gameState.status.vanish === null, "Nouveau combat : plus de statut de capacité");
    resetTransientState();
}
