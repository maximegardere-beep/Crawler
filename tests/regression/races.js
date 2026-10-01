// races.js — tests régression : chantier 13, lot 1 (passifs de race : gameState.race, config.origins.races, un point de lecture par effet).
// Voir app.js (section « RACE : PASSIFS »), origins.js et CHANTIERS.md (chantier 13).
const { assert, resetTransientState } = require('./_helpers.js');

const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const asRace = (key) => { resetTransientState(); gameState.currentFloor = 3; if (key) applyRace(key); };
const duel = (extra = {}) => {
    const mob = Object.assign({ name: "Cobaye", hp: 99999, maxHp: 99999, atk: 1, def: 0, xpReward: 1, status: {}, effect: null }, extra);
    withRand(0.5, () => initiateCombat(mob));
    return mob;
};
// Capture le multiplicateur d'attaque passé à performPlayerAttack() par `run`.
const captureMult = (run) => {
    let captured = null;
    const original = performPlayerAttack;
    performPlayerAttack = (atk, options) => { captured = options.atkMultiplier; return true; };
    try { run(); } finally { performPlayerAttack = original; }
    return captured;
};

// --- Catalogue : chaque race d'origins.js a ses passifs, et inversement ---
{
    assert(Object.keys(ORIGIN_RACES).sort().join() === Object.keys(config.origins.races).sort().join(), "Chaque race du catalogue a ses passifs (config.origins.races), et inversement");
    asRace(null);
    assert(applyRace('inconnue') === false && gameState.race === null, "applyRace() : une race inconnue est refusée");
    assert(Object.keys(originRaceEffects()).length === 0, "Sans race : aucun effet");
    assert(gameState.maxHp === 100 && gameState.maxMana === 100 && gameState.maxInventory === config.inventory.maxEquipment, "Sans race : valeurs de base (100 PV, 100 mana, réserve normale)");
}

// --- PV max : Goule +20 %, Gobelin −10 %, Troll +25 %, Cafard −15 % ---
{
    [['ghoul', 120], ['goblin', 90], ['troll', 125], ['roach', 85], ['human', 100], ['elf', 100], ['dwarf', 100]].forEach(([k, hp]) => {
        asRace(k);
        assert(gameState.maxHp === hp, `Race ${k} : PV max ${hp} (${gameState.maxHp})`);
    });
    asRace('ghoul');
    gameState.baseMaxHp = 215; recomputeMaxHp();
    assert(gameState.maxHp === Math.round(215 * 1.2), "Les PV max suivent la progression (baseMaxHp × race)");
    gameState.hp = gameState.maxHp;
    asRace('roach'); gameState.hp = 100; recomputeMaxHp();
    assert(gameState.hp === 85, "Les PV actuels sont ramenés au nouveau maximum");
}

// --- Humain : XP +10 %, +1 emplacement de réserve ---
{
    asRace('human');
    gameState.xp = 0; gameState.xpToNextLevel = 100000;
    gainXp(100);
    assert(gameState.xp === 110, `Humain : XP +10 % (${gameState.xp})`);
    assert(gameState.maxInventory === config.inventory.maxEquipment + 1, "Humain : +1 emplacement de réserve");
    asRace('troll');
    assert(gameState.maxInventory === config.inventory.maxEquipment, "Les autres races gardent la réserve normale");
    gameState.xp = 0; gameState.xpToNextLevel = 100000; gainXp(100);
    assert(gameState.xp === 100, "Sans bonus d'XP : XP inchangée");
    asRace('human');
    gameState.inventory = [];
    for (let i = 0; i < 9; i++) gameState.inventory.push({ category: 'weapons', name: `Arme ${i}` });
    const before = gameState.inventory.length;
    storeLootItem({ category: 'weapons', name: 'Arme de trop', baseValue: 1 });
    assert(before === 9 && gameState.inventory.length === 9, "Humain : une 10e arme est revendue d'office (réserve de 9)");
    gameState.inventory = [];
}

// --- Goule : saignement −50 %, soins reçus −20 % ---
{
    asRace('ghoul');
    assert(applyRaceDamageMods(10, 'bleed') === 5 && applyRaceDamageMods(1, 'bleed') === 1 && applyRaceDamageMods(10, 'trap') === 10 && applyRaceDamageMods(10, 'combat') === 10, "Goule : saignement −50 % (jamais sous 1), pièges et combat inchangés");
    gameState.baseMaxHp = 1000; recomputeMaxHp(); gameState.hp = 100;
    assert(applyPlayerHeal(50) === 40 && gameState.hp === 140, "Goule : soins reçus −20 % (50 -> 40)");
    gameState.hp = 1000 * 1.2 - 5; // proche du maximum : jamais au-delà
    applyPlayerHeal(100);
    assert(gameState.hp === gameState.maxHp, "Les soins restent bornés par les PV max");
    // Saignement réel, tique avant l'action.
    asRace('ghoul'); gameState.baseMaxHp = 1000; recomputeMaxHp(); gameState.hp = gameState.maxHp;
    duel();
    gameState.status.bleed = { rounds: 3, dmgPerRound: 10 };
    const hp0 = gameState.hp;
    withRand(0.5, () => tryPlayerAction());
    assert(hp0 - gameState.hp === 5, `Goule : le saignement coûte 5 PV au lieu de 10 (${hp0 - gameState.hp})`);
    asRace(null); gameState.baseMaxHp = 1000; recomputeMaxHp(); gameState.hp = gameState.maxHp;
    duel(); gameState.status.bleed = { rounds: 3, dmgPerRound: 10 };
    const hp1 = gameState.hp;
    withRand(0.5, () => tryPlayerAction());
    assert(hp1 - gameState.hp === 10, "Sans race : le saignement coûte 10 PV");
    resetTransientState();
}

// --- Gobelin : furtivité +10, fuite +15, pièges −25 % ; Troll : furtivité −10 ---
{
    asRace(null);
    const baseStealth = getStealthChance();
    asRace('goblin');
    assert(getStealthChance() === baseStealth + 10, `Gobelin : Furtivité +10 pts (${baseStealth} -> ${getStealthChance()})`);
    asRace('troll');
    assert(getStealthChance() === Math.max(0, baseStealth - 10), "Troll : Furtivité −10 pts (jamais sous 0)");

    const flee = (race, rand, enemyExtra) => {
        asRace(race); gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
        duel(enemyExtra);
        withRand(rand, () => attemptFlee());
        return !gameState.inCombat;
    };
    assert(!flee(null, 0.70) && flee('goblin', 0.70), "Gobelin : fuite 75 % au lieu de 60 % (jet à 70 : raté sans race, réussi)");
    assert(flee(null, 0.50) && !flee('dwarf', 0.50), "Nain : fuite 45 % au lieu de 60 % (jet à 50 : réussi sans race, raté)");
    assert(!flee('goblin', 0.55, { isBountyHunter: true }) && flee('goblin', 0.45, { isBountyHunter: true }), "Gobelin : contre un chasseur de primes, la fuite reste fixe à 50 %");
    assert(!flee('dwarf', 0.55, { isBountyHunter: true }) && flee('dwarf', 0.45, { isBountyHunter: true }), "Nain : idem, jamais de malus contre un chasseur de primes");

    asRace('goblin'); gameState.baseMaxHp = 1000; recomputeMaxHp(); gameState.hp = gameState.maxHp;
    const hp0 = gameState.hp;
    withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
    assert(hp0 - gameState.hp === 75, `Gobelin : un piège de 100 coûte 75 PV (${hp0 - gameState.hp})`);
    resetTransientState();
}

// --- Troll : mains nues +15 % (cumul multiplicatif avec le buff de départ) ---
{
    const unarmedMult = (race, buff) => {
        asRace(race); gameState.starterBuff = buff; gameState.equipment = { weapon: null, ranged: null, armor: null, spell: null };
        duel();
        return captureMult(() => withRand(0.5, () => attackUnarmed()));
    };
    assert(near(unarmedMult(null, null), 0.75) && near(unarmedMult('troll', null), 0.75 * 1.15), "Troll : mains nues ×1,15");
    assert(near(unarmedMult('troll', 'desperate'), 0.75 * 2 * 1.15), "Troll + Foutu pour foutu : ×2 × ×1,15 (cumul multiplicatif)");
    assert(near(unarmedMult('troll', 'boxer'), 0.75 * 1.25 * 1.15), "Troll + Boxeur : ×1,25 × ×1,15");
    assert(near(unarmedMult('elf', null), 0.75), "Une autre race : mains nues inchangées");
    resetTransientState();
}

// --- Elfe : mana +25 %, sorts +10 %, backfire −3 pts, DEF −1 ---
{
    asRace('elf');
    assert(gameState.maxMana === 125, "Elfe : mana max 125");
    gameState.mana = 125; recomputeRaceDerived();
    assert(gameState.mana === 125, "Recalculer ne change pas un mana déjà plein");
    asRace(null); gameState.mana = 50; applyRace('elf');
    assert(gameState.maxMana === 125 && gameState.mana === 63, `Le mana actuel suit la proportion (50/100 -> ${gameState.mana}/125)`);
    asRace('elf'); gameState.def = 5; gameState.equipment.armor = null;
    assert(getEffectiveDef() === 4, "Elfe : DEF −1");
    gameState.def = 0;
    assert(getEffectiveDef() === 0, "Elfe : la DEF ne tombe jamais sous 0");

    const spellFor = (race) => {
        asRace(race);
        const spell = generateTestKitSpell();
        spell.qualifiers = []; spell.mechanics = [];
        gameState.equipment.spell = spell; gameState.mana = gameState.maxMana;
        const ranged = !!spell.rangedSpell || spell.spellCategory === 'ranged';
        duel({ ranged });
        gameState.combatDistance = spell.spellCategory === 'ranged' ? 3 : 0;
        return spell;
    };
    const castMult = (race) => { spellFor(race); return captureMult(() => withRand(0.99, () => attackMagic())); };
    const ratio = castMult('elf') / castMult(null);
    assert(near(ratio, 1.1), `Elfe : sorts +10 % (×${ratio.toFixed(3)})`);
    // Backfire : 15 % de base au niveau 1 de Magie ; −3 pts pour l'Elfe. Jet à 13 : raté sans race, réussi pour l'Elfe.
    const flopped = (race) => { spellFor(race); gameState.lastPlayerActionWasBackfire = false; withRand(0.13, () => attackMagic()); return gameState.lastPlayerActionWasBackfire; };
    assert(flopped(null) === true && flopped('elf') === false, "Elfe : backfire −3 pts (jet à 13 : raté sans race, réussi)");
    resetTransientState();
}

// --- Nain : DEF +12 % (au moins +1), armure portée +15 % ---
{
    asRace(null); gameState.def = 10; gameState.equipment.armor = null;
    assert(getEffectiveDef() === 10, "Sans race : DEF de base");
    asRace('dwarf'); gameState.def = 10; gameState.equipment.armor = null;
    assert(getEffectiveDef() === 11, "Nain : DEF 10 -> 11 (+12 % arrondi, au moins +1)");
    gameState.def = 1;
    assert(getEffectiveDef() === 2, "Nain : au moins +1 même sur une petite DEF");
    gameState.def = 10; gameState.equipment.armor = { name: "Armure", category: 'armors', baseArmor: 20 };
    const armor = Math.round(20 * 1.15), total = 10 + armor;
    assert(getEffectiveDef() === total + Math.max(1, Math.round(total * 0.12)), `Nain : armure ×1,15 puis DEF +12 % (${getEffectiveDef()})`);
    asRace(null); gameState.def = 10; gameState.equipment.armor = { name: "Armure", category: 'armors', baseArmor: 20 };
    assert(getEffectiveDef() === 30, "Sans race : DEF + armure inchangées");
    resetTransientState();
}

// --- Cafard mutant : Increvable (1 fois par étage, jamais contre un boss) ---
{
    asRace('roach');
    gameState.hp = 20;
    applyPlayerDamage(50);
    assert(gameState.hp === 1 && gameState.raceLastStandFloor === 3, "Increvable : un coup mortel laisse 1 PV");
    gameState.hp = 20;
    applyPlayerDamage(50);
    assert(gameState.hp === 0, "Increvable : une seule fois par étage");
    gameState.currentFloor = 4; gameState.hp = 20;
    applyPlayerDamage(50);
    assert(gameState.hp === 1, "Increvable : de nouveau disponible à l'étage suivant");
    gameState.currentFloor = 5; gameState.hp = 20;
    applyPlayerDamage(19);
    assert(gameState.hp === 1 && gameState.raceLastStandFloor !== 5, "Un coup non mortel ne consomme pas Increvable");
    gameState.currentFloor = 6; gameState.hp = 1;
    applyPlayerDamage(5);
    assert(gameState.hp === 0, "À 1 PV, Increvable ne sauve plus (rien à laisser)");
    gameState.currentFloor = 7; gameState.hp = 20;
    duel({ isBoss: true });
    applyPlayerDamage(50);
    assert(gameState.hp === 0 && gameState.raceLastStandFloor !== 7, "Contre un boss : jamais d'Increvable");
    gameState.currentFloor = 8; gameState.inCombat = false; gameState.currentEnemy = null; gameState.hp = 10;
    withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
    assert(gameState.hp === 1, "Increvable : sauve aussi d'un piège mortel");
    asRace('troll'); gameState.hp = 20;
    applyPlayerDamage(50);
    assert(gameState.hp === 0, "Une autre race n'a pas Increvable");
    resetTransientState();
}

// --- Sauvegarde : la race est conservée ; ancienne sauvegarde / clé inconnue = aucune race ---
{
    const store = {};
    const original = global.localStorage;
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
    try {
        asRace('elf'); gameState.playerName = 'Racer'; gameState.saveEnabled = true; gameState.hp = gameState.maxHp;
        saveGame();
        const key = saveKeyForName('Racer');
        const saved = JSON.parse(store[key]);
        assert(saved.race === 'elf' && saved.maxMana === 125, "Sauvegarde : la race est écrite avec le crawler");
        gameState.race = null; gameState.maxMana = 100;
        restoreSaveForName('Racer');
        assert(gameState.race === 'elf' && gameState.maxMana === 125, "Restauration : race et mana max retrouvés");
        saved.race = 'humain-inexistant'; store[key] = JSON.stringify(saved);
        restoreSaveForName('Racer');
        assert(gameState.race === null && gameState.maxMana === 100, "Clé de race inconnue : aucune race, valeurs de base");
        delete saved.race; delete saved.raceLastStandFloor; saved.maxMana = 100; store[key] = JSON.stringify(saved);
        gameState.race = 'troll';
        restoreSaveForName('Racer');
        assert(gameState.race === null && gameState.maxHp === gameState.baseMaxHp, "Ancienne sauvegarde sans race : jamais rétro-activée");
        asRace('human'); gameState.playerName = 'Racer'; gameState.saveEnabled = true; saveGame();
        gameState.maxInventory = 8;
        restoreSaveForName('Racer');
        assert(gameState.maxInventory === config.inventory.maxEquipment + 1, "Humain restauré : 9 emplacements de réserve");
    } finally { global.localStorage = original; }
    resetTransientState();
}
