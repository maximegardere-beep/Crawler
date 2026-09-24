// combat-boss.js — tests régression : Chantier 2 du rework combat (rework des boss, 3 phases).
// Couvre getBossPhase() (seuils de phase, explicitement demandés par la consigne), le télégraphe
// (annonce sans dégât -> exécution boostée), le buff de défense télégraphié ("il se hérisse"), la
// phase 3 ("folie" : ATQ +40%/DEF -30%) et le pattern multi-coups de phase 2. Voir NOTES_COMBAT.md.
const { assert, resetTransientState } = require('./_helpers.js');

// ===================================================================
// getBossPhase() : dérivée UNIQUEMENT du ratio PV/PV max (100-66% phase 1, 66-33% phase 2, <33% phase 3)
// ===================================================================
assert(getBossPhase({ hp: 100, maxHp: 100 }) === 1, "getBossPhase() : 100% PV -> phase 1");
assert(getBossPhase({ hp: 67, maxHp: 100 }) === 1, "getBossPhase() : 67% PV -> encore phase 1");
assert(getBossPhase({ hp: 66, maxHp: 100 }) === 2, "getBossPhase() : 66% PV pile -> bascule phase 2");
assert(getBossPhase({ hp: 34, maxHp: 100 }) === 2, "getBossPhase() : 34% PV -> encore phase 2");
assert(getBossPhase({ hp: 33, maxHp: 100 }) === 3, "getBossPhase() : 33% PV pile -> bascule phase 3 (folie)");
assert(getBossPhase({ hp: 1, maxHp: 100 }) === 3, "getBossPhase() : 1% PV -> phase 3");
assert(getBossPhase({ hp: 0, maxHp: 100 }) === 3, "getBossPhase() : 0% PV -> phase 3");
assert(getBossPhase({ hp: 100, maxHp: 0 }) === 1, "getBossPhase() : maxHp absent/nul -> repli sûr phase 1 (aucune division par zéro)");
assert(getBossPhase(null) === 1, "getBossPhase() : enemy absent -> repli phase 1");

// ===================================================================
// Télégraphe (attaque lourde) : le tour d'annonce n'inflige AUCUN dégât, le tour d'exécution
// applique bp.telegraphHeavyMult — testé directement en posant enemy.status.telegraph, sans dépendre
// du tirage aléatoire qui l'aurait posé (couvert séparément plus bas).
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 1000; // large marge pour ne pas clamper à 0 avant d'avoir mesuré les dégâts réels
    gameState.hp = 1000;
    const boss = { name: "Boss Télégraphe", isBoss: true, hp: 100, maxHp: 100, atk: 100, def: 10, status: { telegraph: { type: 'heavy' } } };
    gameState.currentEnemy = boss;

    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre (rollDamage)
    resolveEnemyCounterAttack();
    Math.random = originalRandom;

    // Écart nul par défaut (resetTransientState()) : l'anti-abus mêlée collée du Chantier 3
    // (config.distanceEnrage.meleeGluedDamageMult) s'applique aussi, AVANT le multiplicateur de
    // télégraphe (voir performBossCounterAttackInner()) — DEF joueur nulle -> mitigation 1.
    const gluedAtk = Math.round(boss.atk * config.distanceEnrage.meleeGluedDamageMult);
    const expected = Math.round(gluedAtk * config.bossPhases.telegraphHeavyMult);
    assert(gameState.hp === 1000 - expected, `Télégraphe lourd exécuté : dégâts boostés (x${config.bossPhases.telegraphHeavyMult}) infligés (attendu ${expected}, obtenu ${1000 - gameState.hp})`);
    assert(boss.status.telegraph === null, "Télégraphe lourd : consommé après exécution (jamais répété)");
}

// ===================================================================
// Télégraphe (buff de défense) : le tour d'annonce/exécution "il se hérisse" n'inflige lui non plus
// aucun dégât, mais pose enemy.status.defBuffed pour les tours suivants.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 100;
    gameState.hp = 100;
    const boss = { name: "Boss Hérissé", isBoss: true, hp: 100, maxHp: 100, atk: 50, def: 10, status: { telegraph: { type: 'defBuff' } } };
    gameState.currentEnemy = boss;
    resolveEnemyCounterAttack();

    assert(gameState.hp === 100, "Télégraphe defBuff : aucun dégât ce tour-ci (juste la garde qui monte)");
    assert(boss.status.telegraph === null, "Télégraphe defBuff : consommé après exécution");
    assert(!!boss.status.defBuffed && boss.status.defBuffed.rounds === config.bossPhases.defBuffRounds, "Télégraphe defBuff : pose bien enemy.status.defBuffed pour la durée configurée");
}

// ===================================================================
// enemy.status.defBuffed augmente la DEF effective du boss côté performPlayerAttack() (symétrique
// aux réductions ébloui/corrodé déjà existantes) : un boss buffé encaisse moins de dégâts du joueur.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre des deux côtés de la comparaison

    gameState.currentEnemy = { name: "Boss A", isBoss: true, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgWithoutBuff = 1000 - gameState.currentEnemy.hp;

    gameState.currentEnemy = { name: "Boss B", isBoss: true, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null, defBuffed: { rounds: 2 } } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgWithBuff = 1000 - gameState.currentEnemy.hp;

    Math.random = originalRandom;
    assert(dmgWithBuff < dmgWithoutBuff, `defBuffed réduit bien les dégâts encaissés par le boss (sans: ${dmgWithoutBuff}, avec: ${dmgWithBuff})`);
}

// ===================================================================
// Phase 3 ("folie") : dégâts fixes +40% côté boss (config.bossPhases.phase3.atkMult), et pose
// enemy.status.frenzied (lu par performPlayerAttack() pour réduire symétriquement sa DEF effective).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 1000;
    gameState.hp = 1000;
    const boss = { name: "Boss Fou", isBoss: true, hp: 30, maxHp: 100, atk: 100, def: 10, status: {} }; // 30% PV -> phase 3
    gameState.currentEnemy = boss;

    const originalRandom = Math.random;
    Math.random = () => 0.5;
    resolveEnemyCounterAttack();
    Math.random = originalRandom;

    // Écart nul par défaut : l'anti-abus mêlée collée (Chantier 3) s'applique aussi, AVANT le
    // multiplicateur de phase 3 (voir performBossCounterAttackInner()).
    const gluedAtk3 = Math.round(boss.atk * config.distanceEnrage.meleeGluedDamageMult);
    const expected = Math.round(gluedAtk3 * config.bossPhases.phase3.atkMult);
    assert(gameState.hp === 1000 - expected, `Phase 3 : dégâts boostés de +${Math.round((config.bossPhases.phase3.atkMult - 1) * 100)}% (attendu ${expected}, obtenu ${1000 - gameState.hp})`);
    assert(boss.status.frenzied === true, "Phase 3 : pose enemy.status.frenzied");
}
{
    // Symétrique : enemy.status.frenzied réduit la DEF effective du boss côté performPlayerAttack()
    resetTransientState();
    gameState.inCombat = true;
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    gameState.currentEnemy = { name: "Boss C", isBoss: true, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgNormal = 1000 - gameState.currentEnemy.hp;

    gameState.currentEnemy = { name: "Boss D", isBoss: true, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null, frenzied: true } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgFrenzied = 1000 - gameState.currentEnemy.hp;

    Math.random = originalRandom;
    assert(dmgFrenzied > dmgNormal, `frenzied (phase 3) augmente bien les dégâts encaissés par le boss (normal: ${dmgNormal}, folie: ${dmgFrenzied})`);
}

// ===================================================================
// Phase 2 : pattern multi-coups (2-3 frappes dans le même tour, dégâts par coup réduits). Tirage
// forcé via une séquence Math.random contrôlée plutôt qu'en dépendant de la chance réelle.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 1000;
    gameState.hp = 1000;
    const boss = { name: "Boss Rafale", isBoss: true, hp: 50, maxHp: 100, atk: 100, def: 10, status: {} }; // 50% PV -> phase 2
    gameState.currentEnemy = boss;

    const originalRandom = Math.random;
    // roll(1) < multiStrikeChance -> multi-coups ; roll(2) >= 0.5 -> 3 coups ; variance neutre ensuite
    const seq = [0.001, 0.99, 0.5, 0.5, 0.5];
    let idx = 0;
    Math.random = () => seq[Math.min(idx++, seq.length - 1)];
    resolveEnemyCounterAttack();
    Math.random = originalRandom;

    const totalDealt = 1000 - gameState.hp;
    // Écart nul par défaut : l'anti-abus mêlée collée (Chantier 3) s'applique aussi, sur l'ATQ de
    // base AVANT la répartition multi-coups (voir performBossCounterAttackInner()).
    const gluedAtkMulti = Math.round(boss.atk * config.distanceEnrage.meleeGluedDamageMult);
    const expectedTotal = Math.round(gluedAtkMulti * (config.bossPhases.multiStrikeTotalMult / 3)) * 3;
    assert(totalDealt === expectedTotal, `Multi-coups phase 2 : dégâts totaux cohérents avec multiStrikeTotalMult répartis sur 3 frappes (attendu ~${expectedTotal}, obtenu ${totalDealt})`);
}
