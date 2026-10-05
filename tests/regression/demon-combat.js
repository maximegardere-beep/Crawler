// demon-combat.js — tests régression : chantier 17, lot 2 — moteur du combat démoniaque (Gorgoth le Concierge, demon.js +
// section « BOSS DE NIVEAU » d'app.js) : fonctions pures (stats, actes, intentions, Emprise, Cicatrices, Fatigue), combat
// complet simulé (setTimeout synchrone) jusqu'à la mise au tapis puis l'expulsion, forme finale (victoire / mort), fuite
// bloquée, sauvegarde et migration.
const { assert, resetTransientState } = require('./_helpers.js');

const T = config.demonBoss;
function seqRng(values) { let i = 0; return () => values[i++ % values.length]; }
function withRandom(value, fn) {
    const saved = Math.random;
    Math.random = typeof value === 'function' ? value : () => value;
    try { return fn(); } finally { Math.random = saved; }
}

// --- Réglages validés ---
{
    assert(T.hpMult === 5 && T.defShare === 0.40 && T.baseHitPct === 0.12 && T.perKnockout === 0.12, "Gorgoth : PV ×5, DEF 40 % de l'ATQ, coup de base 12 %, +12 % par mise au tapis");
    assert(T.maxDistanceByAct[2] === 6 && T.maxDistanceByAct[3] === 4 && T.cataclysmCountdown === 5 && T.finalCountdown === 3, "Actes : écart max 6 puis 4, compte à rebours 5 (3 au dernier souffle)");
    assert(T.cataclysmPct === 0.80 && T.cataclysmParry.perfect === 0 && T.cataclysmParry.success === 0.5, "Cataclysme : 80 % des PV max, Parade Parfaite ×0, Réussie ×0,5");
    assert(T.intents.scythe === 0.18 && T.intents.blaze === 0.15 && T.intents.whip === 0.10 && T.hiddenChance === 0.25, "Intentions : Fauche 18 %, Brasier 15 %, Fouet 10 %, 25 % masquées");
    assert(T.emprise.perTurn === 8 && T.emprise.gripGain === 25 && T.emprise.possessionReset === 40, "Emprise : +8 par tour, +25 sur une Emprise, retombe à 40 après la Possession");
    assert(T.fatigue === 0.05 && T.fatigueCap === 0.30 && T.expelTimeCost === 10, "Fatigue −5 %/mise au tapis (plafond −30 %), expulsion −10 H");
    assert(DEMON_NAME === 'Gorgoth le Concierge' && !/balrog/i.test(JSON.stringify(DEMON_INTENTS)), "Nom exact du contrat, jamais le mot interdit");
    assert(DEMON_INTENT_KEYS.join() === 'scythe,blaze,grip,guard,whip', "Cinq intentions du contrat");
}

// --- Fonctions pures ---
{
    const s0 = computeDemonStats({ maxHp: 100, atk: 20, def: 5 }, { knockouts: 0, final: false, tuning: T });
    assert(s0.hp === 500 && s0.def === 8 && s0.atk === 12, `Stats de base calées sur le joueur (PV 500, DEF 8, ATQ 12 — obtenu ${s0.hp}/${s0.def}/${s0.atk})`);
    const s2 = computeDemonStats({ maxHp: 100, atk: 20 }, { knockouts: 2, final: false, tuning: T });
    assert(s2.hp === 620 && s2.atk === 15, "+12 % de PV et de dégâts par mise au tapis passée");
    const sf = computeDemonStats({ maxHp: 100, atk: 20 }, { knockouts: 2, final: true, tuning: T });
    assert(sf.hp === Math.round(500 * 1.24 * 0.90), "Forme finale : Fatigue −5 % par mise au tapis");
    assert(demonFatigueMult(0, T) === 1 && Math.abs(demonFatigueMult(3, T) - 0.85) < 1e-9 && Math.abs(demonFatigueMult(20, T) - 0.70) < 1e-9, "Fatigue plafonnée à −30 %");

    assert(demonActFor(1, false, T) === 1 && demonActFor(0.67, false, T) === 1 && demonActFor(0.5, false, T) === 2 && demonActFor(0.2, false, T) === 3, "Actes 1/2/3 selon les PV");
    assert(demonActFor(0.1, false, T) === 3 && demonActFor(0.1, true, T) === 4 && demonActFor(0.2, true, T) === 3, "4e acte seulement en forme finale, sous 15 %");
    assert(demonMaxDistanceForAct(1, T) === null && demonMaxDistanceForAct(2, T) === 6 && demonMaxDistanceForAct(3, T) === 4, "Écart maximal par acte");
    assert(demonCountdownForAct(3, T) === 5 && demonCountdownForAct(4, T) === 3 && demonCountdownForAct(2, T) === 0, "Compte à rebours par acte");
    assert(demonChainsLeft(1, T) === 4 && demonChainsLeft(0.92, T) === 3 && demonChainsLeft(0.5, T) === 0, "Une chaîne cède tous les 8 % de PV perdus");

    const counts = {};
    for (let i = 0; i < 500; i++) {
        const it = pickDemonIntent(seqRng([((i * 37) % 100) / 100, ((i * 53) % 100) / 100]), { act: 2, distance: i % 3, lastKey: 'grip' }, T);
        counts[it.key] = (counts[it.key] || 0) + 1;
        assert(DEMON_INTENTS[it.key], "Intention tirée connue");
    }
    assert(!counts.grip, "Jamais deux fois la même intention d'affilée");
    assert(Object.keys(counts).length === 4, "Les autres intentions sont toutes tirées");
    assert(pickDemonIntent(() => 0.1, {}, T).hidden === true && pickDemonIntent(() => 0.9, {}, T).hidden === false, "Intention masquée sous 25 %");
    assert(demonSkillChance(1, T) === 8 && demonSkillChance(20, T) === 60, "Jets Furtivité/Magie : 8 % par niveau, plafond 60 %");

    let r = resolveIntentResponse('scythe', 'weapon', { distance: 0 }, T);
    assert(!r.countered, "Fauche au contact sans bonne réponse : elle porte");
    r = resolveIntentResponse('scythe', 'retreat', { distance: 2 }, T);
    assert(r.countered && r.bonusMult === 1.3 && r.empriseDelta === -10, "Fauche contrée en reculant : +30 % au prochain coup, −10 Emprise");
    assert(resolveIntentResponse('scythe', 'ranged', { distance: 3 }, T).countered, "Fauche esquivée à distance");
    assert(!resolveIntentResponse('scythe', 'retreat', { distance: 0 }, T).countered, "Recul raté (toujours au contact) : la Fauche porte");
    assert(resolveIntentResponse('blaze', 'weapon', { distance: 0 }, T).countered && !resolveIntentResponse('blaze', 'ranged', { distance: 3 }, T).countered, "Brasier : annulé au contact seulement");
    assert(resolveIntentResponse('grip', 'magic', {}, T).countered && resolveIntentResponse('grip', 'weapon', { magicResist: true }, T).countered, "Emprise annulée par la Magie ou un jet Magie");
    assert(resolveIntentResponse('grip', 'weapon', {}, T).empriseDelta === 25, "Emprise non contrée : +25");
    assert(resolveIntentResponse('guard', 'engage', {}, T).countered && !resolveIntentResponse('guard', 'weapon', {}, T).countered, "Garde brisée par la Charge seulement");
    assert(!resolveIntentResponse('whip', 'retreat', { distance: 5 }, T).countered, "Fouet : inévitable");

    let e = empriseAfterTurn(0, { hpLostPct: 10 }, T);
    assert(e.value === 13 && !e.possessed, "Emprise : +8 par tour + la moitié du % de PV perdus");
    e = empriseAfterTurn(20, { countered: true, perfect: true, bigHit: true }, T);
    assert(e.value === 0, "Emprise : −10 bonne réponse, −15 Parfait, −5 gros coup, jamais sous 0");
    e = empriseAfterTurn(70, { gripped: true }, T);
    assert(e.possessed && e.value === 40, "Possession à 100, la jauge retombe à 40");

    assert(dominantStyle({ melee: 60, ranged: 40 }, 'ranged') === 'melee', "Style dominant : au moins 50 % des dégâts");
    assert(dominantStyle({ melee: 40, ranged: 30, magic: 30 }, 'magic') === 'magic', "Sinon le style du coup final");
    assert(dominantStyle({}, null) === null, "Aucun style connu : aucune Cicatrice");

    const none = { melee: 0, ranged: 0, magic: 0, unarmed: 0 };
    assert(scarResistMult(none, 'melee', T) === 1, "Sans Cicatrice : dégâts normaux");
    assert(Math.abs(scarResistMult({ ...none, melee: 1 }, 'melee', T) - 0.8) < 1e-9 && Math.abs(scarResistMult({ ...none, melee: 3 }, 'melee', T) - 0.4) < 1e-9, "Cicatrice −20/−40/−60 %");
    assert(scarResistMult({ ...none, melee: 9 }, 'melee', T) > 0, "Cicatrice plafonnée : jamais d'immunité aux dégâts");
    assert(Math.abs(scarResistMult({ ...none, melee: 2 }, 'ranged', T) - 1.3) < 1e-9 && Math.abs(scarResistMult({ ...none, magic: 1 }, 'unarmed', T) - 1.15) < 1e-9, "Faiblesse : +15 % par cran au style opposé");
    assert(demonImmuneToStyleEffects({ ...none, magic: 3 }, 'magic', T) && !demonImmuneToStyleEffects({ ...none, magic: 2 }, 'magic', T), "Immunité aux effets au cran 3");

    const n = normalizeDemonState({ knockouts: 2, scars: { melee: 7 } });
    assert(n.knockouts === 2 && n.scars.melee === 3 && n.scars.ranged === 0 && n.expulsions === 0, "normalizeDemonState complète et plafonne");
    assert(normalizeDemonState(undefined).encounters === 0, "État vierge pour une ancienne sauvegarde");
}

function startFight(opts = {}, keepDemon = false) {
    const demon = gameState.demon;
    resetTransientState();
    if (keepDemon) gameState.demon = demon;
    gameState.currentFloor = 5;
    gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 12, category: 'weapons' };
    const result = { victory: 0, defeat: 0 };
    startDemonFight(Object.assign({ onVictory: () => { result.victory++; }, onDefeat: () => { result.defeat++; } }, opts));
    return result;
}

// --- Entrée en combat ---
{
    const res = startFight();
    const enemy = gameState.currentEnemy;
    assert(gameState.inCombat && enemy && enemy.isDemon && enemy.isBoss && enemy.baseName === DEMON_NAME && enemy.demonFinal === false, "startDemonFight : ennemi du contrat (isDemon, isBoss, baseName, demonFinal)");
    assert(enemy.hp === gameState.maxHp * 5, "PV = 5 × PV max du joueur");
    const fight = gameState.demonFight;
    assert(fight && fight.act === 1 && fight.maxActs === 3 && fight.emprise === 0 && fight.chainsLeft === 4 && fight.final === false, "demonFight initialisé (acte 1, 4 chaînes, Emprise 0)");
    assert(fight.intent && DEMON_INTENTS[fight.intent.key] && 'hidden' in fight.intent && 'revealed' in fight.intent, "Première intention annoncée dès l'entrée");
    assert(gameState.demon.encounters === 1, "Rencontre comptée");
    assert(gameState.combatDistance === T.startDistance, "Écart de départ");
    assert(startDemonFight() === false, "Pas de second combat pendant le premier");
    // Fuite impossible, sans coût de tour.
    const hp = gameState.hp;
    const intentBefore = fight.intent;
    attemptFlee();
    assert(gameState.inCombat && gameState.currentEnemy === enemy && gameState.hp === hp && fight.intent === intentBefore, "Fuite bloquée (porte scellée), le tour n'est pas consommé");
    assert(res.victory === 0 && res.defeat === 0, "Aucun callback avant la fin");
}

// --- Résolution d'une intention selon l'action du joueur ---
{
    startFight();
    const fight = gameState.demonFight;
    // Fauche, joueur recule : contrée, +30 % au prochain coup.
    fight.intent = { key: 'scythe', hidden: false, revealed: false };
    gameState.combatDistance = 1;
    const hp = gameState.hp;
    withRandom(0.99, () => attemptRetreat());
    assert(gameState.hp === hp, "Fauche contrée en reculant : aucun dégât");
    assert(fight.nextHitBonus === 1.3, "Bonus de +30 % posé pour le prochain coup");
    assert(fight.emprise === 0, "Bonne réponse : l'Emprise ne monte pas (+8 −10, borné à 0)");
    // Le coup suivant consomme le bonus.
    gameState.combatDistance = 0;
    fight.intent = { key: 'blaze', hidden: false, revealed: false };
    attackWeapon();
    assert(fight.nextHitBonus === 1, "Bonus d'ouverture consommé par le coup suivant");
    assert(fight.dmgByStyle.melee > 0, "Dégâts cumulés par style (mêlée)");

    // Fouet : ramène l'écart à 0 et frappe.
    fight.intent = { key: 'whip', hidden: false, revealed: false };
    gameState.combatDistance = 3;
    gameState.hp = gameState.maxHp;
    attemptSprint(); // n'importe quelle action
    assert(gameState.combatDistance === 0, "Fouet : écart ramené à 0");

    // Emprise non contrée : +25 (+8 par tour).
    fight.emprise = 0;
    fight.intent = { key: 'grip', hidden: false, revealed: false };
    gameState.skills.magic.level = 1;
    withRandom(0.99, () => attackUnarmed());
    assert(fight.emprise >= 33, `Emprise non contrée : +25 et +8 (obtenu ${fight.emprise})`);
}

// --- Garde : DEF ×2 sauf Charge ---
{
    startFight();
    const enemy = gameState.currentEnemy;
    const fight = gameState.demonFight;
    fight.intent = { key: 'guard', hidden: false, revealed: false };
    fight.action = 'weapon';
    let mods = demonPlayerAttackMods(enemy);
    assert(mods.defMult === 2, "Garde : DEF ×2 contre une attaque ordinaire");
    fight.action = 'engage';
    mods = demonPlayerAttackMods(enemy);
    assert(mods.defMult === 1, "Garde brisée par la Charge");
    gameState.demon.scars.melee = 2;
    gameState.lastAttackKind = 'weapon';
    mods = demonPlayerAttackMods(enemy);
    assert(Math.abs(mods.atkMult - 0.6) < 1e-9 && /Cicatrice/.test(mods.note), "Cicatrices appliquées aux dégâts du joueur");
    gameState.lastAttackKind = 'ranged';
    mods = demonPlayerAttackMods(enemy);
    assert(Math.abs(mods.atkMult - 1.3) < 1e-9, "Point faible au style opposé");
}

// --- Actes : écart resserré, compte à rebours, Cataclysme ---
{
    startFight();
    const enemy = gameState.currentEnemy;
    const fight = gameState.demonFight;
    enemy.hp = Math.round(enemy.maxHp * 0.5);
    gameState.combatDistance = 8;
    fight.intent = { key: 'grip', hidden: false, revealed: false };
    enemyCounterAttack();
    assert(fight.act === 2 && gameState.combatDistance === 6, "Acte 2 : écart ramené au maximum 6");
    assert(fight.chainsLeft === 0, "Les chaînes ont toutes cédé");
    assert(combatMaxDistance() === 6, "Écart maximal du combat resserré");
    enemy.hp = Math.round(enemy.maxHp * 0.3);
    fight.intent = { key: 'grip', hidden: false, revealed: false };
    enemyCounterAttack();
    assert(fight.act === 3 && fight.countdown === 5 && gameState.combatDistance === 4, "Acte 3 : compte à rebours 5, écart max 4");
    for (let i = 0; i < 4; i++) { gameState.hp = gameState.maxHp; fight.emprise = 0; fight.intent = { key: 'grip', hidden: false, revealed: false }; enemyCounterAttack(); }
    assert(fight.countdown === 1, "Le compte à rebours décroît d'un cran par tour");
    gameState.hp = gameState.maxHp;
    fight.emprise = 0;
    enemyCounterAttack();
    assert(gameState.hp === gameState.maxHp - Math.round(gameState.maxHp * 0.8), `Cataclysme sans Parade (pas d'interface) : 80 % des PV max (PV ${gameState.hp})`);
    assert(fight.countdown === 5, "Le compte à rebours repart à 5");
}

// --- Possession : tour perdu sans compagnon ---
{
    startFight();
    const fight = gameState.demonFight;
    fight.emprise = 95;
    fight.intent = { key: 'grip', hidden: false, revealed: false };
    withRandom(0.99, () => enemyCounterAttack());
    assert(fight.emprise === 40 && gameState.status.stunned === true, "Possession : la jauge retombe à 40, le prochain tour est perdu");
}

// --- Combat complet jusqu'à la mise au tapis ---
{
    const res = startFight();
    let turns = 0;
    while (gameState.inCombat && turns < 300) {
        turns++;
        gameState.hp = gameState.maxHp; // on mesure le moteur, pas la survie
        if (gameState.combatDistance > 0) attemptEngage(); else attackWeapon();
    }
    // Armurerie (lot 4) : onVictory n'est appelé qu'après le choix au râtelier.
    if (typeof openDemonArmory === 'function') {
        assert(gameState.demonArmoryChoicePending === true && res.victory === 0, "Mise au tapis : l'armurerie s'ouvre avant onVictory");
        leaveDemonArmory();
    }
    assert(!gameState.inCombat && !gameState.demonFight && gameState.currentEnemy === null, `Mise au tapis atteinte (${turns} tours), combat terminé`);
    assert(gameState.demon.knockouts === 1 && gameState.demon.scars.melee === 1 && gameState.demon.lastFloorFought === 5, "Mise au tapis : +1, Cicatrice du style dominant (mêlée), étage noté");
    assert(res.victory === 1 && res.defeat === 0, "onVictory appelé après la mise au tapis (et le choix à l'armurerie)");
    assert(!gameState.hasWon, "Une mise au tapis n'est jamais la victoire finale");
    // Le démon revient plus fort.
    startFight({}, true);
    assert(gameState.currentEnemy.hp === Math.round(gameState.maxHp * 5 * 1.12), "Il revient avec +12 % de PV");
    gameState.demon.scars.melee = 3;
    winCombat(); // coup fatal
    assert(gameState.demon.scars.melee === 3 && gameState.demon.knockouts === 2, "Cicatrice plafonnée au cran 3");
}

// --- Expulsion (défaite non finale) ---
{
    const res = startFight();
    gameState.timeLeft = 50;
    const fight = gameState.demonFight;
    fight.intent = { key: 'scythe', hidden: false, revealed: false };
    gameState.combatDistance = 0;
    gameState.hp = 1;
    withRandom(0.5, () => attackWeapon());
    assert(!gameState.inCombat && !gameState.demonFight && gameState.hp === 1, "Expulsion : hors combat, à 1 PV");
    assert(gameState.timeLeft === 40, "Expulsion : −10 H");
    assert(gameState.demon.expulsions === 1 && res.defeat === 1 && res.victory === 0, "Expulsion comptée, onDefeat appelé");
    assert(ui.gameOverOverlay.classList.contains('hidden'), "Jamais de Game Over hors forme finale");
    // Jamais sous 1 H.
    startFight();
    gameState.timeLeft = 4;
    gameOver(false, gameState.currentEnemy); // filet de sécurité : même issue
    assert(gameState.timeLeft === 1 && gameState.hp === 1 && !gameState.inCombat, "Expulsion : le temps ne descend jamais sous 1 H");
    startFight();
    gameState.timeLeft = 0.5;
    gameOver(false, 'bleed');
    assert(gameState.timeLeft === 0.5, "Expulsion avec moins d'1 H : le temps n'est pas réduit davantage");
}

// --- Forme finale : victoire ou mort réelle ---
{
    resetTransientState();
    gameState.currentFloor = 18;
    gameState.demon.knockouts = 2;
    let won = 0;
    startDemonFight({ final: true, onVictory: () => { won++; } });
    const enemy = gameState.currentEnemy;
    assert(enemy.demonFinal && gameState.demonFight.final && gameState.demonFight.maxActs === 4, "Forme finale : 4 actes");
    enemy.hp = Math.round(enemy.maxHp * 0.1);
    gameState.demonFight.intent = { key: 'grip', hidden: false, revealed: false };
    enemyCounterAttack();
    assert(gameState.demonFight.act === 4 && gameState.demonFight.countdown === 3, "4e acte « Dernier souffle » : compte à rebours 3");
    enemy.hp = 0;
    winCombat();
    assert(won === 1 && gameState.demon.knockouts === 2 && !gameState.inCombat, "Victoire finale : onVictory, pas de mise au tapis");

    resetTransientState();
    gameState.currentFloor = 18;
    startDemonFight({ final: true });
    gameState.saveEnabled = false;
    gameState.demonFight.intent = { key: 'scythe', hidden: false, revealed: false };
    gameState.combatDistance = 0;
    gameState.hp = 1;
    withRandom(0.5, () => attackUnarmed());
    assert(!ui.gameOverOverlay.classList.contains('hidden') && gameState.demon.expulsions === 0, "Forme finale : la défaite est une vraie mort");
    resetTransientState();
}

// --- Sauvegarde / migration ---
{
    resetTransientState();
    localStorage.clear();
    gameState.playerName = 'Concierge Test';
    gameState.saveEnabled = true;
    gameState.demon = { encounters: 3, knockouts: 2, expulsions: 1, scars: { melee: 1, ranged: 0, magic: 2, unarmed: 0 }, lastFloorFought: 7 };
    gameState.demonFight = { act: 2 };
    saveGame();
    gameState.demon = createEmptyDemonState();
    restoreSaveForName('Concierge Test');
    assert(gameState.demon.knockouts === 2 && gameState.demon.scars.magic === 2 && gameState.demon.lastFloorFought === 7, "gameState.demon sauvegardé et restauré");
    assert(gameState.demonFight === null, "Jamais restauré en plein combat démoniaque");
    // Ancienne sauvegarde sans le champ.
    const raw = JSON.parse(localStorage.getItem(saveKeyForName('Concierge Test')));
    delete raw.demon; delete raw.demonFight;
    localStorage.setItem(saveKeyForName('Ancien Concierge'), JSON.stringify(Object.assign(raw, { playerName: 'Ancien Concierge' })));
    gameState.demon.knockouts = 9;
    restoreSaveForName('Ancien Concierge');
    assert(gameState.demon.knockouts === 0 && gameState.demon.scars.melee === 0, "Ancienne sauvegarde : état démoniaque vierge (jamais celui du crawler précédent)");
    localStorage.clear();
    resetTransientState();
}
