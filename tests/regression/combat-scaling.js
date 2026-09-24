// combat-scaling.js — tests régression : Chantier 1 du rework combat (scaling des dégâts des mobs).
// Voir config.mobDamageScaling (app.js), getFloorScaling() (generator.js), rollDamage()/
// resolveEnemyCounterAttack() (app.js), et NOTES_COMBAT.md pour l'écart signalé sur le critère
// d'acceptation (25-35% de PV perdus/combat à l'étage 20).
const { assert, resetTransientState } = require('./_helpers.js');

// Formule composée : dégâts_mob = base × (1 + perFloor×étage) × (1 + perMobLevel×étage).
// "niveau_mob" n'existe pas comme champ dédié sur les mobs (voir getMobLevelEquivalent() ailleurs
// dans le moteur, même principe) : l'étage sert de proxy pour les deux facteurs — voir le commentaire
// de getFloorScaling() dans generator.js pour le détail de cette interprétation.
{
    const r = config.mobDamageScaling;
    for (const floor of [1, 10, 20]) {
        const expected = (1 + r.perFloor * floor) * (1 + r.perMobLevel * floor);
        const actual = getFloorScaling(floor).atkMult;
        assert(Math.abs(actual - expected) < 1e-9,
            `getFloorScaling(${floor}).atkMult suit la formule composée (attendu ${expected.toFixed(4)}, obtenu ${actual.toFixed(4)})`);
    }
    // Croissance strictement supérieure à l'ancien scaling linéaire (floorScaling.atk seul, par
    // PROFONDEUR) : c'est le point du chantier — l'ancien scaling était jugé quasi inexistant.
    const oldAtk20 = 1 + (20 - 1) * config.floorScaling.atk;
    assert(getFloorScaling(20).atkMult > oldAtk20,
        "getFloorScaling(20).atkMult : la nouvelle formule dépasse largement l'ancien scaling linéaire par profondeur");
    // hp/def/xp restent sur l'ancien scaling linéaire par PROFONDEUR (hors périmètre du Chantier 1,
    // qui ne concerne QUE les dégâts/ATQ des mobs).
    const depth20 = 20 - 1;
    assert(Math.abs(getFloorScaling(20).hpMult - (1 + depth20 * config.floorScaling.hp)) < 1e-9,
        "getFloorScaling() : hpMult reste sur l'ancien scaling linéaire par profondeur (hors périmètre Chantier 1)");
    assert(Math.abs(getFloorScaling(20).defMult - (1 + depth20 * config.floorScaling.def)) < 1e-9,
        "getFloorScaling() : defMult reste sur l'ancien scaling linéaire par profondeur (hors périmètre Chantier 1)");
}

// Plancher de pression : rollDamage() ne descend jamais sous pressureFloor (dégâts BRUTS, avant
// mitigation), même face à une défense écrasante.
{
    const originalRandom = Math.random;
    Math.random = () => 0.5; // variance neutre
    const dmg = rollDamage(1, 100000, { pressureFloor: 50, minMitigation: 0 });
    Math.random = originalRandom;
    // minMitigation=0 ici : la mitigation seule écraserait quasiment tout (def énorme), donc si le
    // résultat reste proche de 50, c'est bien le plancher de pression qui a joué avant mitigation —
    // en pratique la mitigation quasi nulle domine, donc on vérifie plutôt le cas minMitigation>0 ci-dessous.
    assert(dmg >= 1, "rollDamage() : ne renvoie jamais moins de 1 dégât (comportement préexistant)");
}
{
    // Cas réaliste combiné : pressureFloor ET minMitigation ensemble (comme resolveEnemyCounterAttack()).
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    const dmg = rollDamage(1, 100000, { pressureFloor: 50, minMitigation: 0.35 });
    Math.random = originalRandom;
    // rawDamage = max(1*variance, 50) = 50 ; mitigation = max(0.35, ~0) = 0.35 -> damage = 50*0.35 = 17.5 -> round 18
    assert(dmg === Math.round(50 * 0.35), `rollDamage() : plancher de pression (50) × cap de mitigation (0.35) donne bien ${Math.round(50 * 0.35)} (obtenu ${dmg})`);
}

// Cap de réduction : la mitigation ne descend jamais sous minMitigation, même à défense écrasante.
{
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    const dmgCapped = rollDamage(10, 100000, { minMitigation: 0.35 });
    const dmgUncapped = rollDamage(10, 100000, { minMitigation: 0 });
    Math.random = originalRandom;
    assert(dmgCapped > dmgUncapped,
        "rollDamage() : minMitigation relève bien les dégâts par rapport à une mitigation non plafonnée face à une défense écrasante");
}

// Sans options (dégâts joueur -> mob, performPlayerAttack()) : comportement STRICTEMENT inchangé
// (pressureFloor/minMitigation valent 0 par défaut) — le Chantier 1 ne touche QUE les dégâts mob -> joueur.
{
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    const dmgNoOptions = rollDamage(20, 15);
    Math.random = () => 0.5;
    const dmgExplicitZero = rollDamage(20, 15, { pressureFloor: 0, minMitigation: 0 });
    Math.random = originalRandom;
    assert(dmgNoOptions === dmgExplicitZero,
        "rollDamage() : sans options, comportement identique à pressureFloor=0/minMitigation=0 (dégâts joueur -> mob inchangés)");
}

// Élites : ×config.mobDamageScaling.eliteDamageMult appliqué à enemyAtk avant rollDamage() (voir
// resolveEnemyCounterAttack()) — testé ici directement sur la valeur d'entrée, pas via un combat réel.
{
    const baseAtk = 40;
    const eliteAtk = Math.round(baseAtk * config.mobDamageScaling.eliteDamageMult);
    assert(eliteAtk === Math.round(40 * 1.65), "config.mobDamageScaling.eliteDamageMult vaut bien 1.65 (valeur de la consigne)");
}

// --- Simulation Monte Carlo : mesure du % de PV perdus par un joueur "à niveau" (niveau = étage,
// stats de base sans équipement) sur un combat typique à l'étage 20, contre un mob non-élite.
// ÉCART SIGNALÉ (voir NOTES_COMBAT.md) : la consigne demande 25-35% de PV perdus par combat à l'étage
// 20 pour un joueur "optimal". Mesuré ici : ~10-20%, PAS 25-35%. Cause identifiée : ce chantier ne
// touche QUE le scaling des DÉGÂTS mobs (consigne explicite) — ni le scaling des PV mobs (resté
// linéaire par profondeur, floorScaling.hp), ni la croissance d'ATQ du joueur (resté tel quel). Le
// joueur "à niveau" atteint un ATQ qui tue le mob en 2-3 tours, trop vite pour que le nouveau taux de
// dégâts par coup s'accumule jusqu'à 25-35% du total. Corriger ce point demanderait de toucher le
// scaling des PV mobs et/ou la courbe de progression du joueur — explicitement HORS PÉRIMÈTRE de ce
// chantier ("ne modifie pas d'autres mécaniques déjà traitées par ailleurs" / "ne réécris pas le
// moteur de combat"). Signalé plutôt que corrigé unilatéralement, comme demandé.
{
    resetTransientState();
    gameState.level = 1; gameState.xp = 0; gameState.xpToNextLevel = 50;
    gameState.hp = 100; gameState.maxHp = 100; gameState.baseMaxHp = 100; gameState.atk = 10; gameState.def = 5;
    while (gameState.level < 20) gainXp(gameState.xpToNextLevel); // "à niveau" = niveau 20 à l'étage 20
    gameState.currentFloor = 20;
    const districtName = Object.keys(districts)[0];

    const originalRandom = Math.random;
    let totalPctLost = 0;
    const N = 150;
    for (let i = 0; i < N; i++) {
        let callCount = 0;
        // Force un mob SANS modificateur (cas "typique", pas élite) : le premier jet de generateMob()
        // décide du nombre de modificateurs (roll <= 15 -> 2, <= 50 -> 1) — on le force au-dessus de 50.
        Math.random = () => { callCount++; return callCount === 1 ? 0.9 : originalRandom(); };
        const mob = generateMob(districtName);
        Math.random = originalRandom;

        let hp = gameState.maxHp, mobHp = mob.hp, rounds = 0;
        while (hp > 0 && mobHp > 0 && rounds < 50) {
            rounds++;
            mobHp -= rollDamage(gameState.atk, mob.def);
            if (mobHp <= 0) break;
            hp -= rollDamage(mob.atk, gameState.def, {
                pressureFloor: gameState.maxHp * config.mobDamageScaling.pressureFloorFrac,
                minMitigation: config.mobDamageScaling.minMitigation
            });
        }
        totalPctLost += Math.min(1, (gameState.maxHp - Math.max(0, hp)) / gameState.maxHp);
    }
    const avgPct = totalPctLost / N * 100;
    // Sanity check large (comportement ACTUEL mesuré, pas le critère d'acceptation de la consigne —
    // voir le commentaire ci-dessus) : évite une régression silencieuse de cette mesure elle-même.
    assert(avgPct > 5 && avgPct < 25,
        `Simulation étage 20 (150 combats) : % PV perdus mesuré hors plage attendue de CETTE mesure (5-25%, obtenu ${avgPct.toFixed(1)}%) — voir NOTES_COMBAT.md pour l'écart déjà signalé face au critère d'acceptation de la consigne (25-35%)`);
}
