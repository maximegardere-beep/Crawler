// starter-buff.js — tests régression : chantier 14, buff de départ « Foutu pour foutu » (crawler sans arme) et son évolution Boxeur.
// Voir CHANTIERS.md (chantier 14) et les fonctions starterBuff* / endStarterBuff / evolveStarterBuff de app.js.
const { assert, resetTransientState } = require('./_helpers.js');

const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
const captureLog = (fn) => { const lines = []; const o = logEvent; logEvent = (m) => { lines.push(String(m)); }; try { fn(); } finally { logEvent = o; } return lines; };
// Tire un cadeau de bienvenue du type voulu (poids : arme 38, tir 25, armure 17, sort 15, rien 5 sur 100).
const GIFT_ROLL = { weapon: 0.1, ranged: 0.5, armor: 0.7, spell: 0.9, nothing: 0.97 };
function freshWithGift(type) {
    resetTransientState();
    gameState.equipment = { weapon: null, ranged: null, armor: null, spell: null };
    gameState.starterBuff = null;
    withRand(GIFT_ROLL[type], () => revealWelcomeGift());
}

// --- Attribution selon le cadeau ---
{
    ['armor', 'nothing'].forEach(t => { freshWithGift(t); assert(gameState.starterBuff === 'desperate', `Cadeau « ${t} » : le buff Foutu pour foutu est actif`); });
    ['weapon', 'ranged', 'spell'].forEach(t => { freshWithGift(t); assert(gameState.starterBuff === null, `Cadeau « ${t} » : pas de buff de départ`); });
    freshWithGift('armor');
    assert(!!gameState.equipment.armor && !gameState.equipment.weapon && !gameState.equipment.ranged && !gameState.equipment.spell, "Cadeau « armure » : seule l'armure est équipée");
    assert(ui.starterBuffStatus.classList.contains('hidden') === false && /Foutu pour foutu/.test(ui.starterBuffStatus.innerText), "Badge visible, nommé « Foutu pour foutu »");
    assert(/\+5 %/.test(ui.starterBuffStatus.title) && /×2/.test(ui.starterBuffStatus.title), "Infobulle du badge : les chiffres exacts");
    freshWithGift('weapon');
    assert(ui.starterBuffStatus.classList.contains('hidden'), "Sans buff : badge masqué");
}

// --- Dégâts subis +5 % ---
{
    resetTransientState();
    gameState.starterBuff = 'desperate';
    assert(applyStarterBuffToDamage(100) === 105 && applyStarterBuffToDamage(20) === 21 && applyStarterBuffToDamage(1) === 1 && applyStarterBuffToDamage(0) === 0,
        "Foutu pour foutu : +5 % de dégâts subis (arrondi, jamais moins que le montant d'origine)");
    gameState.starterBuff = 'boxer';
    assert(applyStarterBuffToDamage(100) === 100, "Boxeur : plus aucun malus");
    gameState.starterBuff = null;
    assert(applyStarterBuffToDamage(100) === 100, "Sans buff : dégâts inchangés");

    // Sources réelles : riposte de mob, piège, saignement.
    const hit = (buff) => {
        resetTransientState();
        gameState.starterBuff = buff;
        gameState.hp = gameState.maxHp = 1000;
        const mob = { name: "Cobaye", hp: 9999, maxHp: 9999, atk: 200, def: 0, xpReward: 1, status: {}, effect: null };
        withRand(0.5, () => initiateCombat(mob));
        const before = gameState.hp;
        withRand(0.5, () => enemyCounterAttack());
        return before - gameState.hp;
    };
    const plain = hit(null), buffed = hit('desperate');
    assert(plain > 0 && buffed === Math.max(plain, Math.round(plain * 1.05)), `Riposte de mob : +5 % (${plain} -> ${buffed})`);
    resetTransientState();
    gameState.starterBuff = 'desperate';
    gameState.hp = 1000;
    withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
    assert(gameState.hp === 1000 - 105, `Piège de 100 : 105 PV perdus (${1000 - gameState.hp})`);
    resetTransientState();
}

// --- Mains nues ×2, Étrangler ×2, Charge à mains nues ×2 ; Boxeur ×1,25 ---
{
    const multOf = (buff, run, mobExtra = {}) => {
        resetTransientState();
        gameState.starterBuff = buff;
        gameState.equipment = { weapon: null, ranged: null, armor: null, spell: null };
        gameState.hp = gameState.maxHp = 1000;
        const mob = { name: "Cobaye", hp: 9999, maxHp: 9999, atk: 1, def: 0, xpReward: 1, status: {}, effect: null, ...mobExtra };
        withRand(0.5, () => initiateCombat(mob));
        let captured = null;
        const original = performPlayerAttack;
        performPlayerAttack = (atk, options) => { captured = options.atkMultiplier; return true; };
        try { withRand(0.5, () => run()); } finally { performPlayerAttack = original; }
        return captured;
    };
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    assert(near(multOf(null, () => attackUnarmed()), 0.75), "Mains nues sans buff : ×0,75 (inchangé)");
    assert(near(multOf('desperate', () => attackUnarmed()), 1.5), "Foutu pour foutu : mains nues ×2 (0,75 -> 1,5)");
    assert(near(multOf('boxer', () => attackUnarmed()), 0.75 * 1.25), "Boxeur : mains nues ×1,25");
    const choke = (buff) => multOf(buff, () => resolveOccasion('strangle', 'success', {}));
    assert(near(choke(null), 0.75 * MINIGAME_SETTINGS.choke.damageMult), "Étrangler sans buff : ×3 (inchangé)");
    assert(near(choke('desperate'), 0.75 * MINIGAME_SETTINGS.choke.damageMult * 2), "Foutu pour foutu : Étrangler compris (×3 -> ×6)");
    const engage = (buff) => multOf(buff, () => attemptEngage(), { ranged: true });
    assert(near(engage('desperate') / engage(null), 2), "Foutu pour foutu : la Charge à mains nues est aussi doublée");
    resetTransientState();
}

// --- Fin du buff : équipement d'une arme, arme à distance ou sort (jamais l'armure, jamais un simple ramassage) ---
{
    const base = () => { freshWithGift('armor'); gameState.inventory = []; gameState.spellbook = []; };
    base();
    const armor = generateItem({ category: 'armors' });
    gameState.inventory.push(armor);
    equipItem(0);
    assert(gameState.starterBuff === 'desperate', "Équiper une armure ne coupe pas le buff");
    gameState.inventory.push(generateItem({ category: 'weapons' }));
    assert(gameState.starterBuff === 'desperate', "Une arme seulement ramassée (non équipée) ne coupe pas le buff");
    const logs = captureLog(() => equipItem(gameState.inventory.length - 1));
    assert(gameState.starterBuff === null && logs.some(l => l.includes('Foutu pour foutu')), "Équiper une arme coupe le buff (avec une ligne de journal)");

    base();
    gameState.inventory.push(generateItem({ category: 'ranged' }));
    equipItem(0);
    assert(gameState.starterBuff === null, "Équiper une arme à distance coupe le buff");

    base();
    gameState.spellbook.push(generateSpellScroll ? generateSpellScroll(1) : null);
    assert(gameState.starterBuff === 'desperate', "Un sort seulement appris (grimoire) ne coupe pas le buff");
    equipSpell(0);
    assert(gameState.starterBuff === null, "Équiper un sort coupe le buff");

    // Une fois perdu, il ne revient pas : déséquiper n'existe pas, et rien ne le repose hors du cadeau de départ.
    gameState.equipment.weapon = null; gameState.equipment.spell = null;
    updateUI();
    assert(gameState.starterBuff === null, "Une fois perdu, le buff ne revient pas");

    // Un don à un compagnon ne compte pas.
    base();
    gameState.companion = generateCompanionCandidate(1);
    gameState.inventory.push(generateItem({ category: 'weapons' }));
    giveItemToCompanion(0);
    assert(gameState.starterBuff === 'desperate', "Donner une arme à un compagnon ne coupe pas le buff du joueur");
    gameState.companion = null;
    resetTransientState();
}

// --- Évolution à l'étage 2 ---
{
    freshWithGift('nothing');
    gameState.currentFloor = 1;
    const logs = captureLog(() => advanceToNextFloor());
    assert(gameState.currentFloor === 2 && gameState.starterBuff === 'boxer', "Encore actif à l'arrivée à l'étage 2 : évolue en Boxeur");
    assert(logs.some(l => l.includes('Boxeur')), "L'évolution est annoncée au journal");
    assert(/Boxeur/.test(ui.starterBuffStatus.innerText), "Le badge devient « Boxeur »");
    assert(applyStarterBuffToDamage(100) === 100, "Boxeur : le malus a disparu");

    // Le Boxeur reste après l'équipement d'une arme (en petit).
    gameState.inventory = [generateItem({ category: 'weapons' })];
    equipItem(0);
    assert(gameState.starterBuff === 'boxer', "Équiper une arme ne retire pas le Boxeur");
    assert(starterBuffUnarmedMult() === 1.25, "Boxeur : ×1,25 définitif");

    // Équipé avant l'étage 2 : aucune évolution.
    freshWithGift('armor');
    gameState.inventory = [generateItem({ category: 'weapons' })];
    equipItem(0);
    gameState.currentFloor = 1;
    advanceToNextFloor();
    assert(gameState.starterBuff === null, "Équipé avant l'étage 2 : ni buff, ni Boxeur");

    // Un crawler sans buff n'évolue pas.
    freshWithGift('weapon');
    gameState.currentFloor = 1;
    advanceToNextFloor();
    assert(gameState.starterBuff === null, "Sans buff de départ : aucune évolution");
    resetTransientState();
}

// --- Sauvegarde : le buff est conservé ; une ancienne sauvegarde sans le champ n'est jamais rétro-activée ---
{
    const store = {};
    const original = global.localStorage;
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
    try {
        freshWithGift('armor');
        gameState.playerName = 'Buffy'; gameState.saveEnabled = true; gameState.hp = gameState.maxHp;
        saveGame();
        const saved = JSON.parse(store[saveKeyForName('Buffy')]);
        assert(saved.starterBuff === 'desperate', "Sauvegarde : le buff est écrit avec le crawler");
        delete saved.starterBuff; // ancienne sauvegarde, d'avant le chantier 14
        store[saveKeyForName('Buffy')] = JSON.stringify(saved);
        gameState.starterBuff = null;
        restoreSaveForName('Buffy');
        assert(gameState.starterBuff === null, "Ancienne sauvegarde sans le champ : jamais rétro-activée");
        saved.starterBuff = 'boxer';
        store[saveKeyForName('Buffy')] = JSON.stringify(saved);
        restoreSaveForName('Buffy');
        assert(gameState.starterBuff === 'boxer', "Sauvegarde récente : le Boxeur est restauré");
    } finally { global.localStorage = original; }
    resetTransientState();
}
