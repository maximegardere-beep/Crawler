// early-game.js — tests régression : chantier 15, rééquilibrage du début de partie (voir NOTES_DEBUT_DE_PARTIE.md).
// Lot 0 : forme et valeurs validées de `config.earlyGame`, et garde du modèle de joueur de l'outil `npm run sim:early`
// (les gains par niveau de gainXp() ne doivent pas dériver sans que l'outil le sache). Les lots 1 à 4 ajoutent leurs sections ici.
const { assert, resetTransientState, withTrial, withPlotArmor, EARLY_GAME_TRIAL_DEFAULTS } = require('./_helpers.js');

// --- Réglages validés par l'utilisateur (rounds 1 et 2) ---
{
    const eg = config.earlyGame;
    assert(!!eg && eg.enabled === true, "config.earlyGame existe et le paquet est actif par défaut");
    assert(eg.maxFloor === 3, "Périmètre : les étages 1 à 3 (tout s'éteint à l'étage 4)");
    assert(eg.elites.freeFloors === 2, "Convention collective : aucune élite aux étages 1 et 2");
    assert(eg.elites.damageRamp[3] === 1.3 && eg.elites.damageRamp[4] === 1.5 && !(5 in eg.elites.damageRamp), "Rampe des élites : ×1,3 (étage 3), ×1,5 (étage 4), puis inchangé dès le 5");
    assert(eg.elites.damageRamp[4] < config.mobDamageScaling.eliteDamageMult, "La rampe reste sous le multiplicateur d'élite normal (×1,65)");
    assert(eg.interimBoss.hpMult === 0.75 && eg.interimBoss.atkMult === 0.75, "Remplaçant intérimaire : PV et ATQ ×0,75");
    assert(EARLY_GAME_TRIAL_DEFAULTS.startReduction === 0.40 && eg.trial.fadeLevel === 7, "Période d'essai : −40 % au niveau 1, éteinte au niveau 7 (valeurs validées ; réduction neutralisée par défaut dans les tests, voir _helpers.js)");
    assert(eg.plotArmor.leaveHp === 1, "Armure de scénario : un coup mortel laisse 1 PV (interrupteur propre, neutralisé par défaut dans les tests : voir _helpers.js)");
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

// ===================================================================
// Lot 2 — Remplaçant intérimaire : boss des étages 1-3 à ×0,75 en PV et en ATQ
// ===================================================================
{
    const eg = config.earlyGame;
    const districtNames = Object.keys(districts).filter(d => !!findBossForDistrict(d));
    const bossAt = (district, floor, enabled = true) => {
        resetTransientState();
        gameState.currentFloor = floor;
        eg.enabled = enabled;
        try { return generateBoss(district); } finally { eg.enabled = true; }
    };

    assert(districtNames.length >= 13, `Les 13 quartiers ont un boss (${districtNames.length})`);
    assert(earlyInterimBossScale(1).hpMult === 0.75 && earlyInterimBossScale(3).atkMult === 0.75 && earlyInterimBossScale(4) === null, "earlyInterimBossScale() : étages 1 à 3 seulement");
    eg.enabled = false;
    assert(earlyInterimBossScale(1) === null, "earlyInterimBossScale() : paquet coupé -> null");
    eg.enabled = true;

    let allOk = true, defOk = true, rewardOk = true, nameOk = true, flagOk = true;
    districtNames.forEach(d => [1, 2, 3].forEach(f => {
        const normal = bossAt(d, f, false), interim = bossAt(d, f, true);
        if (interim.hp !== Math.max(1, Math.round(normal.hp * 0.75)) || interim.atk !== Math.max(1, Math.round(normal.atk * 0.75))) allOk = false;
        if (interim.def !== normal.def) defOk = false;
        if (interim.xpReward !== normal.xpReward || JSON.stringify(interim.signatureItem) !== JSON.stringify(normal.signatureItem)) rewardOk = false;
        if (interim.baseName !== normal.baseName || interim.name !== `${normal.name} (intérimaire)`) nameOk = false;
        if (interim.isInterim !== true || normal.isInterim) flagOk = false;
    }));
    assert(allOk, "Boss des étages 1-3 (13 quartiers) : PV et ATQ ×0,75");
    assert(defOk, "Boss intérimaire : DEF inchangée");
    assert(rewardOk, "Boss intérimaire : XP et objet signature inchangés");
    assert(nameOk, "Boss intérimaire : nom suffixé « (intérimaire) », baseName intact (sprite, objet signature)");
    assert(flagOk, "Boss intérimaire : drapeau isInterim posé (jamais sur un boss normal)");

    districtNames.forEach(d => { const a = bossAt(d, 4, true), b = bossAt(d, 4, false); if (JSON.stringify(a) !== JSON.stringify(b) || a.isInterim) allOk = false; });
    assert(allOk, "Étage 4 et au-delà : boss strictement inchangés, jamais intérimaires");
    const b1 = bossAt(districtNames[0], 1, true);
    assert(!!resolveBossSpriteKey(b1), "Boss intérimaire : son sprite unique est toujours résolu (baseName)");

    // Réplique d'accueil : une fois, à l'entrée en combat, avec les chiffres exacts ; rien pour un boss normal
    const lines = [];
    const originalLog = logEvent; logEvent = (m) => { lines.push(String(m)); };
    try {
        resetTransientState(); gameState.currentFloor = 1;
        initiateCombat(bossAt(districtNames[0], 1, true));
        const interimLines = lines.filter(l => /Remplaçant intérimaire/.test(l));
        assert(interimLines.length === 1 && /−25 % de PV/.test(interimLines[0]) && /−25 % d'ATQ/.test(interimLines[0]), "Entrée en combat contre un intérimaire : une réplique, avec les chiffres exacts");
        lines.length = 0;
        resetTransientState(); gameState.currentFloor = 4;
        initiateCombat(bossAt(districtNames[0], 4, true));
        assert(!lines.some(l => /Remplaçant intérimaire/.test(l)), "Boss normal : aucune réplique d'intérimaire");
    } finally { logEvent = originalLog; }
    resetTransientState();
}

// ===================================================================
// Lot 3 — Période d'essai : −40 % de dégâts subis au niveau 1, dégressif jusqu'au niveau 7, étages 1-3 seulement
// ===================================================================
{
    const eg = config.earlyGame;
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
    const fresh = (level, floor) => {
        resetTransientState();
        gameState.level = level; gameState.currentFloor = floor;
        gameState.baseMaxHp = 1000; recomputeMaxHp(); gameState.hp = gameState.maxHp;
        gameState.def = 0; gameState.starterBuff = null; gameState.race = null;
    };

    withTrial(() => {
        // Courbe (pure)
        assert(near(trialDamageMult(1, 1), 0.6), "trialDamageMult() : −40 % au niveau 1");
        assert(near(trialDamageMult(4, 2), 0.8), "trialDamageMult() : −20 % au niveau 4 (milieu de la courbe)");
        assert(near(trialDamageMult(7, 1), 1) && trialDamageMult(12, 3) === 1, "trialDamageMult() : plus aucun effet dès le niveau 7");
        let monotone = true; for (let l = 1; l < 7; l++) if (!(trialDamageMult(l, 1) < trialDamageMult(l + 1, 1))) monotone = false;
        assert(monotone, "trialDamageMult() : la protection décroît à chaque niveau");
        assert(trialDamageMult(1, 3) < 1 && trialDamageMult(1, 4) === 1 && trialDamageMult(1, 9) === 1, "trialDamageMult() : étages 1 à 3 seulement, arrêt net à l'étage 4");
        eg.enabled = false;
        assert(trialDamageMult(1, 1) === 1, "trialDamageMult() : paquet coupé -> aucun effet");
        eg.enabled = true;

        // Piège (100 de dégâts bruts) : 60 PV perdus au niveau 1, 100 au niveau 7 ou à l'étage 4
        fresh(1, 1); withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
        assert(gameState.maxHp - gameState.hp === 60, `Piège au niveau 1 : 60 PV au lieu de 100 (${gameState.maxHp - gameState.hp})`);
        fresh(7, 1); withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
        assert(gameState.maxHp - gameState.hp === 100, "Piège au niveau 7 : plein tarif");
        fresh(1, 4); withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
        assert(gameState.maxHp - gameState.hp === 100, "Piège à l'étage 4 : plein tarif");

        // Saignement (10 par tour) : 6 au niveau 1
        fresh(1, 1);
        withRand(0.5, () => initiateCombat({ name: "Cobaye", hp: 99999, maxHp: 99999, atk: 1, def: 0, xpReward: 1, status: {}, effect: null }));
        gameState.status.bleed = { rounds: 3, dmgPerRound: 10 };
        const hp0 = gameState.hp;
        withRand(0.5, () => tryPlayerAction());
        assert(hp0 - gameState.hp === 6, `Saignement au niveau 1 : 6 PV au lieu de 10 (${hp0 - gameState.hp})`);

        // Riposte de mob ordinaire (ATQ 100, DEF nulle, à distance 0 : ×1,1 « collé ») : ×0,6
        const riposte = (level, floor) => {
            fresh(level, floor);
            gameState.inCombat = true; gameState.combatDistance = 0;
            gameState.currentEnemy = { name: "Cobaye", isBoss: false, hp: 100, maxHp: 100, atk: 100, def: 5, threatMultiplier: 1, status: {} };
            withRand(0.5, () => resolveEnemyCounterAttack());
            return gameState.maxHp - gameState.hp;
        };
        const glued = Math.round(100 * config.distanceEnrage.meleeGluedDamageMult);
        assert(riposte(1, 1) === Math.round(glued * 0.6), `Riposte d'un mob au niveau 1, étage 1 : ×0,6 (${riposte(1, 1)})`);
        assert(riposte(1, 3) === Math.round(glued * 0.6), "Riposte à l'étage 3 : encore protégé");
        assert(riposte(1, 4) === glued, "Riposte à l'étage 4 : plein tarif");
        assert(riposte(7, 1) === glued, "Riposte au niveau 7 : plein tarif");

        // Cumul avec « Foutu pour foutu » (+5 % subis) : 100 -> 105 -> 63
        fresh(1, 1); gameState.starterBuff = 'desperate'; withRand(0, () => springTrap({ dmgMin: 100, dmgMax: 100, text: "Piège" }));
        assert(gameState.maxHp - gameState.hp === 63, `Cumul avec Foutu pour foutu : 100 -> 105 -> 63 (${gameState.maxHp - gameState.hp})`);

        // Jamais moins de 1 PV de dégâts
        fresh(1, 1); assert(applyTrialToDamage(1) === 1 && applyTrialToDamage(0) === 0, "Un coup de 1 reste à 1 (jamais 0) ; 0 reste 0");

        // La protection est comptée, et réajoutée à la facilité des victoires (la prime des chasseurs ne doit pas grimper plus vite)
        fresh(1, 1);
        gameState.runStats = createEmptyRunStats();
        assert(applyTrialToDamage(100) === 60 && gameState.runStats.trialAvoided === 40, "runStats.trialAvoided compte les PV épargnés (40)");
        const easeOfFight = (trialOn) => {
            fresh(1, 1);
            gameState.runStats = createEmptyRunStats();
            eg.trial.startReduction = trialOn ? EARLY_GAME_TRIAL_DEFAULTS.startReduction : 0;
            gameState.baseMaxHp = 100; recomputeMaxHp(); gameState.hp = gameState.maxHp;
            gameState.inCombat = true; gameState.combatDistance = 0;
            const enemy = { name: "Cobaye", isBoss: false, hp: 100, maxHp: 100, atk: 20, def: 5, threatMultiplier: 1, status: {} };
            gameState.currentEnemy = enemy;
            enemy.runTrack = { startDamageTaken: gameState.runStats.damageTaken, startTrialAvoided: gameState.runStats.trialAvoided || 0, sneak: false, playerAttacks: 3 };
            withRand(0.5, () => resolveEnemyCounterAttack());
            withRand(0.5, () => resolveEnemyCounterAttack());
            const lost = gameState.maxHp - gameState.hp;
            recordRunEvent('win', { enemy, kind: 'weapon' });
            return { ease: gameState.runStats.recentWins[gameState.runStats.recentWins.length - 1].ease, lost };
        };
        const on = easeOfFight(true), off = easeOfFight(false);
        eg.trial.startReduction = EARLY_GAME_TRIAL_DEFAULTS.startReduction;
        assert(on.lost < off.lost, `Même combat : la Période d'essai épargne des PV (${on.lost} contre ${off.lost})`);
        assert(Math.abs(on.ease - off.ease) < 0.03, `Facilité de la victoire inchangée par la Période d'essai (${on.ease.toFixed(3)} contre ${off.ease.toFixed(3)})`);
        assert(normalizeRunStats({}).trialAvoided === 0 && normalizeRunStats({ kills: 3 }).trialAvoided === 0, "Ancienne sauvegarde sans trialAvoided : complétée à 0");

        // Badge : visible au niveau 1 étages 1-3, masqué ensuite
        fresh(1, 1); updateUI();
        assert(!ui.trialStatus.classList.contains('hidden') && /−40 %/.test(ui.trialStatus.innerText) && /étage 4/.test(ui.trialStatus.title), "Badge « Période d'essai » : −40 % au niveau 1, infobulle avec la fin à l'étage 4");
        fresh(4, 2); updateUI();
        assert(/−20 %/.test(ui.trialStatus.innerText), "Badge : le pourcentage suit le niveau (−20 % au niveau 4)");
        fresh(7, 1); updateUI();
        assert(ui.trialStatus.classList.contains('hidden'), "Badge masqué dès le niveau 7");
        fresh(1, 4); updateUI();
        assert(ui.trialStatus.classList.contains('hidden'), "Badge masqué à l'étage 4");

        // Message de fin : une fois, à l'arrivée sur l'étage 4, seulement si la protection jouait encore
        const lines = [];
        const originalLog = logEvent; logEvent = (m) => { lines.push(String(m)); };
        try {
            fresh(2, 3); advanceToNextFloor();
            assert(gameState.currentFloor === 4 && lines.filter(l => /période d'essai/i.test(l)).length === 1, "Arrivée à l'étage 4 au niveau 2 : message de fin de la Période d'essai, une seule fois");
            lines.length = 0;
            fresh(8, 3); advanceToNextFloor();
            assert(!lines.some(l => /période d'essai/i.test(l)), "Arrivée à l'étage 4 au niveau 8 : rien à annoncer");
            lines.length = 0;
            fresh(2, 1); advanceToNextFloor();
            assert(!lines.some(l => /période d'essai/i.test(l)), "Arrivée à l'étage 2 : pas de message de fin");
        } finally { logEvent = originalLog; }
    });
    resetTransientState();
}

// ===================================================================
// Lot 4 — Armure de scénario : un coup mortel par étage (1-3) laisse 1 PV, boss compris
// ===================================================================
{
    const eg = config.earlyGame;
    const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
    const fresh = (floor, hp = 10) => {
        resetTransientState();
        gameState.currentFloor = floor; gameState.level = 1;
        gameState.baseMaxHp = 100; recomputeMaxHp(); gameState.hp = hp;
        gameState.def = 0; gameState.starterBuff = null; gameState.race = null;
        gameState.runStats = createEmptyRunStats();
    };
    const lethalTrap = () => withRand(0, () => springTrap({ dmgMin: 500, dmgMax: 500, text: "Piège" }));
    const captureLog = (fn) => { const lines = []; const o = logEvent; logEvent = (m) => { lines.push(String(m)); }; try { fn(); } finally { logEvent = o; } return lines; };

    withPlotArmor(() => {
        // Piège mortel : 1 PV, une fois par étage
        fresh(1);
        const lines = captureLog(lethalTrap);
        assert(gameState.hp === 1 && gameState.plotArmorFloor === 1, `Piège mortel à l'étage 1 : il reste 1 PV (${gameState.hp})`);
        assert(lines.filter(l => /Armure de scénario/.test(l)).length === 1, "Armure de scénario : une réplique à l'activation");
        assert(gameState.runStats.plotArmorUses === 1, "Chronique : plotArmorUses compté");
        assert(!gameState.status.plotShield, "Hors combat : aucun bouclier de tour (le piège suivant n'est pas gratuit)");
        lethalTrap();
        assert(gameState.hp === 0, "Second coup mortel sur le même étage : la mort");

        fresh(2); gameState.plotArmorFloor = 1; lethalTrap();
        assert(gameState.hp === 1 && gameState.plotArmorFloor === 2, "Nouvel étage : l'Armure est de nouveau disponible");
        fresh(3); lethalTrap();
        assert(gameState.hp === 1, "Étage 3 : encore protégé");
        fresh(4); lethalTrap();
        assert(gameState.hp === 0 && gameState.plotArmorFloor === 0, "Étage 4 : plus d'Armure de scénario");

        // Seuls les coups mortels la consomment ; un coup qui laisse exactement 0 PV est mortel
        fresh(1, 100); withRand(0, () => springTrap({ dmgMin: 30, dmgMax: 30, text: "Piège" }));
        assert(gameState.hp === 70 && gameState.plotArmorFloor === 0, "Un coup non mortel ne consomme pas l'Armure");
        fresh(1, 30); withRand(0, () => springTrap({ dmgMin: 30, dmgMax: 30, text: "Piège" }));
        assert(gameState.hp === 1 && gameState.plotArmorFloor === 1, "Un coup qui amènerait exactement à 0 PV est mortel : il reste 1 PV");

        // Paquet coupé -> mort comme avant
        fresh(1); eg.enabled = false; lethalTrap(); eg.enabled = true;
        assert(gameState.hp === 0, "Paquet coupé (enabled: false) : aucune Armure de scénario");

        // Combat : le reste du tour est absorbé, la prochaine action du joueur éteint le bouclier
        fresh(2, 10);
        gameState.inCombat = true;
        assert(applyPlayerDamage(500) === 9 && gameState.hp === 1 && gameState.status.plotShield === true, "Combat : coup mortel -> 9 PV perdus, il reste 1 PV, bouclier de tour posé");
        assert(applyPlayerDamage(500) === 0 && gameState.hp === 1, "Combat : la frappe suivante du même tour est absorbée (rafale)");
        withRand(0.5, () => initiateCombat({ name: "Cobaye", hp: 99999, maxHp: 99999, atk: 1, def: 0, xpReward: 1, status: {}, effect: null }));
        assert(gameState.status.plotShield === false, "Nouveau combat : bouclier éteint");
        gameState.status.plotShield = true;
        withRand(0.5, () => tryPlayerAction());
        assert(gameState.status.plotShield === false, "La prochaine action du joueur éteint le bouclier de tour");

        // Riposte d'un mob : le journal annonce les PV réellement perdus, pas le coup d'origine
        fresh(1, 10);
        gameState.inCombat = true; gameState.combatDistance = 0;
        gameState.currentEnemy = { name: "Cobaye", isBoss: false, hp: 100, maxHp: 100, atk: 500, def: 5, threatMultiplier: 1, status: {} };
        const hitLines = captureLog(() => withRand(0.5, () => resolveEnemyCounterAttack()));
        assert(gameState.hp === 1, "Riposte mortelle d'un mob : il reste 1 PV");
        assert(hitLines.some(l => /inflige 9 dégâts/.test(l)) && !hitLines.some(l => /inflige \d{3,} dégâts/.test(l)), "Journal : « inflige 9 dégâts » (montant réellement perdu)");

        // Boss : l'Armure fonctionne aussi (contrairement à l'Increvable)
        fresh(1, 10);
        gameState.inCombat = true; gameState.combatDistance = 0;
        gameState.currentEnemy = Object.assign(generateBoss(Object.keys(districts)[0]), { atk: 900 });
        gameState.currentEnemy.status = Object.assign({}, gameState.currentEnemy.status, { telegraph: null });
        gameState.currentEnemy.lastKnownPhase = 1;
        withRand(0.9, () => resolveEnemyCounterAttack());
        assert(gameState.hp >= 1 && gameState.plotArmorFloor === 1, `Contre un boss : un coup mortel laisse des PV (${gameState.hp})`);

        // Cafard : l'Armure passe avant l'Increvable, qui reste disponible pour la suite
        fresh(3, 10); applyRace('roach'); gameState.hp = 10;
        lethalTrap();
        assert(gameState.hp === 1 && gameState.plotArmorFloor === 3 && gameState.raceLastStandFloor !== 3, "Cafard à l'étage 3 : l'Armure de scénario passe d'abord, l'Increvable n'est pas gaspillé");
        gameState.hp = 10; lethalTrap();
        assert(gameState.hp === 1 && gameState.raceLastStandFloor === 3, "Cafard : second coup mortel du même étage -> Increvable");
        gameState.hp = 10; lethalTrap();
        assert(gameState.hp === 0, "Cafard : troisième coup mortel du même étage -> la mort");
    });
    resetTransientState();
}
