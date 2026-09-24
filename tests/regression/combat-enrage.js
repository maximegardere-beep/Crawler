// combat-enrage.js — tests régression : Chantier 3 du rework combat (enrage distance et engagement).
// Couvre le compteur de kiting (base boss/normal), la formule de proba d'enrage et son plafond à 80%
// (explicitement demandés par la consigne), le déclenchement/la fin de l'état enragé, l'anti-abus
// mêlée collée, et l'action volontaire "Charger" (attemptEngage()). Voir NOTES_COMBAT.md.
const { assert, resetTransientState } = require('./_helpers.js');

// ===================================================================
// mobKitingBaseline() : un boss démarre à 1 (s'enrage plus vite, voir Chantier 2), un mob normal à 0.
// ===================================================================
assert(mobKitingBaseline({ isBoss: true }) === 1, "mobKitingBaseline() : un boss démarre à 1");
assert(mobKitingBaseline({ isBoss: false }) === 0, "mobKitingBaseline() : un mob normal démarre à 0");
assert(mobKitingBaseline({}) === 0, "mobKitingBaseline() : isBoss absent -> traité comme un mob normal");

// ===================================================================
// Formule de proba d'enrage : min(baseChance + chancePerRound × tours, maxChance) — plafond à 80%
// explicitement demandé par la consigne, vérifié ici indépendamment de tout tirage aléatoire réel.
// ===================================================================
{
    const cfg = config.distanceEnrage;
    const chanceAt = (rounds) => Math.min(cfg.baseChance + cfg.chancePerRound * rounds, cfg.maxChance);
    assert(Math.abs(chanceAt(1) - 0.30) < 1e-9, "Proba d'enrage à 1 tour de kiting : baseChance + 1×chancePerRound (0.30)");
    assert(Math.abs(chanceAt(2) - 0.45) < 1e-9, "Proba d'enrage à 2 tours de kiting : 0.45");
    assert(Math.abs(chanceAt(3) - 0.60) < 1e-9, "Proba d'enrage à 3 tours de kiting : 0.60");
    assert(chanceAt(100) === cfg.maxChance, "Proba d'enrage plafonnée à maxChance (0.80) même à un compteur très élevé");
    assert(cfg.maxChance === 0.80, "config.distanceEnrage.maxChance vaut bien 80% (valeur explicitement demandée par la consigne)");
}

// ===================================================================
// noteMobKitingRound() : incrémente le compteur, et déclenche triggerMobEnrage() quand le tirage
// tombe sous la proba courante — testé en contrôlant Math.random directement, sans dépendre de la
// vraie chance (déterministe).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.hp = gameState.maxHp = 1000;
    gameState.def = 0;
    const enemy = { name: "Mob Kité", isBoss: false, hp: 100, maxHp: 100, atk: 20, def: 5, status: { enraged: null, enrageCooldown: null }, kitingRounds: 0 };
    gameState.currentEnemy = enemy;

    const originalRandom = Math.random;
    Math.random = () => 0.99; // toujours au-dessus de la proba (30% au 1er tour) -> pas d'enrage
    const triggered = noteMobKitingRound(enemy);
    Math.random = originalRandom;

    assert(triggered === false, "noteMobKitingRound() : ne déclenche pas l'enrage si le tirage échoue");
    assert(enemy.kitingRounds === 1, "noteMobKitingRound() : incrémente bien le compteur de kiting");
    assert(enemy.status.enraged === null, "noteMobKitingRound() : pas d'état enragé posé si le tirage échoue");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.hp = gameState.maxHp = 1000;
    gameState.def = 0;
    const enemy = { name: "Mob Kité", isBoss: false, hp: 100, maxHp: 100, atk: 20, def: 5, status: { enraged: null, enrageCooldown: null }, kitingRounds: 0 };
    gameState.currentEnemy = enemy;

    const originalRandom = Math.random;
    Math.random = () => 0.01; // toujours sous la proba -> enrage garanti
    const triggered = noteMobKitingRound(enemy);
    Math.random = originalRandom;

    assert(triggered === true, "noteMobKitingRound() : déclenche l'enrage si le tirage réussit");
    assert(gameState.combatDistance === 0, "triggerMobEnrage() : comble l'écart d'un coup (ruée)");
    assert(!!enemy.status.enraged && enemy.status.enraged.rounds >= 2 && enemy.status.enraged.rounds <= 3,
        "triggerMobEnrage() : pose enemy.status.enraged avec une durée de 2 ou 3 tours");
    assert(gameState.hp < 1000, "triggerMobEnrage() : la ruée porte un coup immédiat");
}

// ===================================================================
// Cooldown après un enrage : pas de nouveau tirage tant qu'il n'est pas écoulé.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    const enemy = { name: "Mob Reposé", isBoss: false, status: { enraged: null, enrageCooldown: { rounds: 2 } }, kitingRounds: 3 };
    gameState.currentEnemy = enemy;

    const originalRandom = Math.random;
    Math.random = () => 0.01; // tirage qui aurait garanti l'enrage hors cooldown
    const triggered = noteMobKitingRound(enemy);
    Math.random = originalRandom;

    assert(triggered === false, "noteMobKitingRound() : aucun tirage tant que le cooldown n'est pas écoulé");
    assert(enemy.status.enrageCooldown.rounds === 1, "noteMobKitingRound() : décrémente le cooldown");
    assert(enemy.status.enraged === null, "noteMobKitingRound() : pas d'enrage pendant le cooldown");
}

// ===================================================================
// Fin de l'enrage sur une frappe réussie PENDANT l'état (pas la ruée d'entrée elle-même) : vérifié
// via resolveEnemyCounterAttack() sur un mob normal déjà enragé (pas la ruée qui l'a déclenché).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 1000;
    gameState.hp = 1000;
    // ATQ assez élevé pour dépasser le plancher de pression (Chantier 1, 10% des PV max joueur =
    // 100 ici) une fois les multiplicateurs appliqués, sans quoi le plancher masquerait le calcul.
    const enemy = { name: "Mob Enragé", isBoss: false, hp: 100, maxHp: 100, atk: 200, def: 5, status: { enraged: { rounds: 3 }, enrageCooldown: null } };
    gameState.currentEnemy = enemy;

    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre
    resolveEnemyCounterAttack();
    Math.random = originalRandom;

    assert(enemy.status.enraged === null, "resolveEnemyCounterAttack() : une frappe réussie pendant l'enrage y met fin immédiatement");
    assert(!!enemy.status.enrageCooldown && enemy.status.enrageCooldown.rounds === config.distanceEnrage.cooldownRounds,
        "resolveEnemyCounterAttack() : pose le cooldown après la fin de l'enrage");
    // Dégâts boostés (+atkMult) ET anti-abus mêlée collée (écart nul par défaut) cumulés.
    const expected = Math.round(Math.round(enemy.atk * config.distanceEnrage.meleeGluedDamageMult) * config.distanceEnrage.atkMult);
    assert(gameState.hp === 1000 - expected, `resolveEnemyCounterAttack() : dégâts enragés cohérents avec atkMult × meleeGluedDamageMult (attendu ${expected}, obtenu ${1000 - gameState.hp})`);
}

// ===================================================================
// enemy.status.enraged réduit la DEF effective du mob côté performPlayerAttack() (symétrique aux
// autres statuts de DEF déjà couverts pour les boss) — vaut aussi pour un mob normal.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    gameState.currentEnemy = { name: "Mob E", isBoss: false, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgNormal = 1000 - gameState.currentEnemy.hp;

    gameState.currentEnemy = { name: "Mob F", isBoss: false, hp: 1000, maxHp: 1000, atk: 10, def: 100, status: { bleed: null, enraged: { rounds: 2 } } };
    performPlayerAttack(200, {}, "avec un gourdin");
    const dmgEnraged = 1000 - gameState.currentEnemy.hp;

    Math.random = originalRandom;
    assert(dmgEnraged > dmgNormal, `enraged réduit bien la DEF effective du mob, donc augmente les dégâts encaissés (normal: ${dmgNormal}, enragé: ${dmgEnraged})`);
}

// ===================================================================
// Anti-abus mêlée collée : +meleeGluedDamageMult sur un mob normal aussi (pas seulement les boss,
// déjà couvert dans combat-boss.js), uniquement à écart nul.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.def = 0;
    gameState.maxHp = 1000;
    gameState.hp = 1000;
    gameState.combatDistance = 0;
    gameState.currentEnemy = { name: "Mob Collé", isBoss: false, hp: 100, maxHp: 100, atk: 100, def: 5, status: {} };

    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre
    resolveEnemyCounterAttack();
    Math.random = originalRandom;

    const dmgGlued = 1000 - gameState.hp;
    assert(dmgGlued === Math.round(100 * config.distanceEnrage.meleeGluedDamageMult), `Anti-abus mêlée collée : dégâts mob normal +${Math.round((config.distanceEnrage.meleeGluedDamageMult - 1) * 100)}% à écart nul (obtenu ${dmgGlued})`);
}

// ===================================================================
// "Charger" (attemptEngage()) : ferme l'écart, applique le bonus d'ATQ configuré, et divise la DEF
// du joueur par 2 pour la riposte qui suit (consommé au début de l'action suivante).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.def = 100;
    gameState.hp = gameState.maxHp = 1000;
    gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 5 };
    gameState.currentEnemy = { name: "Cible d'Entraînement", hp: 9999, maxHp: 9999, atk: 10, def: 500, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance;

    assert(gameState.engageDefHalved === false, "attemptEngage() : engageDefHalved retombe à faux après resetTransientState()");

    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre
    const hpBefore = gameState.currentEnemy.hp;
    attemptEngage();
    Math.random = originalRandom;

    assert(gameState.combatDistance === 0, "attemptEngage() : ferme l'écart d'un coup, sans jet opposé");
    assert(gameState.currentEnemy.hp < hpBefore, "attemptEngage() : enchaîne bien une attaque (dégâts portés)");
    assert(gameState.engageDefHalved === true, "attemptEngage() : pose engageDefHalved pour la riposte qui suit");
}
{
    // engageDefHalved réduit bien la DEF effective lue par getEffectiveDef()
    resetTransientState();
    gameState.def = 100;
    gameState.equipment.armor = null;
    const defNormal = getEffectiveDef();
    gameState.engageDefHalved = true;
    const defHalved = getEffectiveDef();
    assert(defHalved === Math.round(defNormal * 0.5), `getEffectiveDef() : engageDefHalved divise bien la DEF effective par 2 (normal: ${defNormal}, réduite: ${defHalved})`);
}
{
    // Consommé au début de l'action SUIVANTE (tryPlayerAction()), même convention que
    // lastPlayerActionWasBackfire.
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cible", hp: 50, maxHp: 50, atk: 1, def: 0, status: {} };
    gameState.engageDefHalved = true;
    tryPlayerAction();
    assert(gameState.engageDefHalved === false, "tryPlayerAction() : consomme engageDefHalved au tout début de l'action suivante");
}
{
    // Rien à charger : déjà au contact -> ne consomme aucune action, aucun effet
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cible", hp: 50, maxHp: 50, atk: 1, def: 0, status: {} };
    gameState.combatDistance = 0;
    const hpBefore = gameState.currentEnemy.hp;
    attemptEngage();
    assert(gameState.currentEnemy.hp === hpBefore, "attemptEngage() : aucun effet si déjà au corps à corps (rien à charger)");
    assert(gameState.engageDefHalved === false, "attemptEngage() : n'active pas engageDefHalved si l'action n'a pas eu lieu");
}
