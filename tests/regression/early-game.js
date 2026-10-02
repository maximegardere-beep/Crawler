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
