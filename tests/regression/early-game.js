// early-game.js — tests régression : chantier 15, rééquilibrage du début de partie (voir NOTES_DEBUT_DE_PARTIE.md).
// Lot 0 : forme et valeurs validées de `config.earlyGame`, et garde du modèle de joueur de l'outil `npm run sim:early`
// (les gains par niveau de gainXp() ne doivent pas dériver sans que l'outil le sache). Les lots 1 à 4 ajoutent leurs sections ici.
const { assert, resetTransientState } = require('./_helpers.js');

// --- Réglages validés par l'utilisateur (rounds 1 et 2) ---
{
    const eg = config.earlyGame;
    assert(!!eg && eg.enabled === true, "config.earlyGame existe et le paquet est actif par défaut");
    assert(eg.maxFloor === 3, "Périmètre : les étages 1 à 3 (tout s'éteint à l'étage 4)");
    assert(eg.elites.freeFloors === 2, "Convention collective : aucune élite aux étages 1 et 2");
    assert(eg.elites.damageRamp[3] === 1.3 && eg.elites.damageRamp[4] === 1.5 && !(5 in eg.elites.damageRamp), "Rampe des élites : ×1,3 (étage 3), ×1,5 (étage 4), puis inchangé dès le 5");
    assert(eg.elites.damageRamp[4] < config.mobDamageScaling.eliteDamageMult, "La rampe reste sous le multiplicateur d'élite normal (×1,65)");
    assert(eg.interimBoss.hpMult === 0.75 && eg.interimBoss.atkMult === 0.75, "Remplaçant intérimaire : PV et ATQ ×0,75");
    assert(eg.trial.startReduction === 0.40 && eg.trial.fadeLevel === 7, "Période d'essai : −40 % au niveau 1, éteinte au niveau 7");
    assert(eg.plotArmor.leaveHp === 1, "Armure de scénario : un coup mortel laisse 1 PV");
}

// --- Modèle de joueur de l'outil sim:early : mêmes gains par niveau que gainXp() ---
{
    resetTransientState();
    const model = (level) => { let hp = 100, atk = 10, def = 5; for (let l = 2; l <= level; l++) { hp += 15; atk += 2 + Math.floor(l / 4); def += 1 + Math.floor(l / 5); } return { hp, atk, def }; };
    const baseline = { hp: gameState.baseMaxHp, atk: gameState.atk, def: gameState.def, level: gameState.level };
    assert(baseline.hp === 100 && baseline.atk === 10 && baseline.def === 5 && baseline.level === 1, "Crawler de départ : 100 PV, ATQ 10, DEF 5, niveau 1");
    let ok = true;
    for (let target = 2; target <= 10; target++) {
        gainXp(gameState.xpToNextLevel - gameState.xp);
        const m = model(target);
        if (gameState.level !== target || gameState.baseMaxHp !== m.hp || gameState.atk !== m.atk || gameState.def !== m.def) ok = false;
    }
    assert(ok, "Niveaux 2 à 10 : PV max, ATQ et DEF suivent la formule de l'outil de calibrage");
    resetTransientState();
}

// ===================================================================
// Lot 1 — Convention collective du Donjon : aucune élite aux étages 1-2, rampe des dégâts d'élite aux étages 3-4
// ===================================================================
{
    const eg = config.earlyGame;
    const districtNames = Object.keys(districts);
    const countElites = (floor, n, eliteBonus = 0) => {
        gameState.currentFloor = floor;
        let elites = 0;
        for (let i = 0; i < n; i++) if (isEliteMob(generateMob(districtNames[i % districtNames.length], eliteBonus))) elites++;
        return elites;
    };

    resetTransientState();
    assert(isEarlyEliteFreeFloor(1) && isEarlyEliteFreeFloor(2) && !isEarlyEliteFreeFloor(3), "isEarlyEliteFreeFloor() : étages 1 et 2 seulement");
    eg.enabled = false;
    assert(!isEarlyEliteFreeFloor(1), "isEarlyEliteFreeFloor() : faux quand le paquet est coupé (enabled: false)");
    const legacyElites = countElites(1, 2000);
    eg.enabled = true;
    assert(legacyElites > 0, `Paquet coupé : des élites apparaissent à l'étage 1, comme avant le chantier (${legacyElites}/2000)`);

    assert(countElites(1, 3000) === 0, "Étage 1 : aucune élite sur 3000 mobs");
    assert(countElites(2, 3000) === 0, "Étage 2 : aucune élite sur 3000 mobs");
    assert(countElites(1, 1500, 60) === 0, "Étage 1 : aucune élite même avec le décalage LABYRINTHE (eliteBonus +60)");
    assert(countElites(3, 3000) > 0, "Étage 3 : les élites reviennent");
    assert(countElites(6, 3000) > 0, "Étage 6 : les élites sont là (paquet éteint depuis l'étage 4)");

    // Le re-tirage garde un mob valide (nom, PV, ATQ) et ne change pas la part de mobs modifiés de façon aberrante
    gameState.currentFloor = 1;
    let modified = 0;
    for (let i = 0; i < 2000; i++) { const m = generateMob(districtNames[i % districtNames.length]); if (!m || !(m.hp > 0) || !(m.atk > 0) || !m.baseName) modified = -1e9; else if (m.name !== m.baseName) modified++; }
    assert(modified > 400 && modified < 1300, `Étage 1 : le re-tirage garde des mobs valides et des modificateurs (${modified}/2000 modifiés)`);

    // Rampe des dégâts d'élite (pure)
    const base = config.mobDamageScaling.eliteDamageMult;
    assert(eliteDamageMultForFloor(1) === base && eliteDamageMultForFloor(2) === base, "eliteDamageMultForFloor() : inchangé aux étages 1-2 (aucune élite n'y apparaît)");
    assert(eliteDamageMultForFloor(3) === 1.3 && eliteDamageMultForFloor(4) === 1.5, "eliteDamageMultForFloor() : ×1,3 à l'étage 3, ×1,5 à l'étage 4");
    assert(eliteDamageMultForFloor(5) === base && eliteDamageMultForFloor(12) === base, "eliteDamageMultForFloor() : ×1,65 dès l'étage 5");
    eg.enabled = false;
    assert(eliteDamageMultForFloor(3) === base && eliteDamageMultForFloor(4) === base, "eliteDamageMultForFloor() : paquet coupé -> ×1,65 partout");
    eg.enabled = true;

    // La rampe est bien lue par la riposte (mob élite, DEF nulle, PV énormes : dégâts = ATQ élite × collé)
    const hitFor = (floor, extra = {}) => {
        resetTransientState();
        gameState.currentFloor = floor;
        gameState.inCombat = true; gameState.def = 0; gameState.maxHp = 1000; gameState.hp = 1000; gameState.combatDistance = 0;
        gameState.currentEnemy = Object.assign({ name: "Employé du Mois", isBoss: false, hp: 100, maxHp: 100, atk: 100, def: 5, threatMultiplier: 3, status: {} }, extra);
        const originalRandom = Math.random; Math.random = () => 0.5;
        resolveEnemyCounterAttack();
        Math.random = originalRandom;
        return 1000 - gameState.hp;
    };
    const glued = config.distanceEnrage.meleeGluedDamageMult;
    assert(hitFor(3) === Math.round(Math.round(100 * 1.3) * glued), "Élite à l'étage 3 : dégâts ×1,3");
    assert(hitFor(4) === Math.round(Math.round(100 * 1.5) * glued), "Élite à l'étage 4 : dégâts ×1,5");
    assert(hitFor(5) === Math.round(Math.round(100 * base) * glued), "Élite à l'étage 5 : dégâts ×1,65 (rampe terminée)");
    assert(hitFor(3, { isBountyHunter: true }) === Math.round(Math.round(100 * base) * glued), "Chasseur de primes : jamais touché par la rampe (stats calées sur ×1,65)");
    assert(hitFor(3, { threatMultiplier: 1 }) === Math.round(100 * glued), "Mob ordinaire : aucun multiplicateur d'élite");
    resetTransientState();
}
