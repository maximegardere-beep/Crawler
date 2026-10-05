// deathwatch.js — tests régression : émission DeathWatch (chantier 4, voir NOTES_DEATHWATCH.md) —
// catalogue de piques, déclenchement à l'arrivée d'étage (après le Pacte), 4 réponses + refus, jet d20 +
// popularité, boîtes et sanctions, succès, présentation.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(values, fn) {
    const original = Math.random;
    let i = 0;
    Math.random = () => (Array.isArray(values) ? values[Math.min(i++, values.length - 1)] : values);
    try { return fn(); } finally { Math.random = original; }
}

// d20 : un tirage r donne 1 + floor(r × 20). rollFor(n) = r qui donne exactement n.
const rollFor = (n) => (n - 1) / 20 + 0.001;

function openShow(lastFloor = {}) {
    resetTransientState();
    gameState.currentFloor = 3;
    gameState.playerName = "Carl";
    gameState.inventory = [];
    gameState.gold = 0;
    triggerShow(lastFloor);
}

// --- Catalogue ---
{
    const ids = new Set(SHOW_TAUNTS.map(t => t.id));
    assert(SHOW_TAUNTS.length >= 30 && ids.size === SHOW_TAUNTS.length, "Au moins 30 piques, identifiants uniques");
    assert(SHOW_TAUNTS.filter(t => !t.when).length >= 5, "Au moins 5 piques génériques de repli");
    assert(SHOW_TAUNTS.every(t => t.theme && SHOW_REPLIES[t.theme]), "Chaque pique a un thème de répliques existant");
    assert(Object.keys(SHOW_REPLIES).every(th => SHOW_TONES.every(t => (SHOW_REPLIES[th][t.key] || []).length >= 2)),
        "Chaque thème couvre les 4 tons (au moins 2 répliques chacun)");
    assert(Object.keys(SHOW_REPLIES).every(th => SHOW_TAUNTS.some(t => t.theme === th)), "Aucun thème de répliques orphelin");
    assert(SHOW_REFUSALS.length >= 2, "Des répliques de refus");
    assert(getShowReplyLines({ theme: 'inconnu' }, 'insult').length > 0 && getShowReplyLines(null, 'polite').length > 0, "Pique sans thème connu : répliques de repli");
    assert(['retort', 'provoke', 'insult'].every(k => SHOW_REACTIONS.success[k].length && SHOW_REACTIONS.failure[k].length) && SHOW_REACTIONS.polite.length && SHOW_REACTIONS.refuse.length,
        "Une réaction du présentateur pour chaque issue");
    assert(fillShowTemplate("{{crawler}} à l'étage {{etage}} ({{inconnu}})", { crawler: 'Carl', etage: 4 }) === "Carl à l'étage 4 ({{inconnu}})", "Gabarit : trous remplis, trou inconnu laissé tel quel");
    const base = { fuites: 0, degats: 0, maxHp: 100, pvPct: 100, mobs: 0, pieges: 0, sortsRates: 0, objet: null, compagnon: null, compagnonsPartis: 0, prime: 0, or: 50, etage: 2, succes: 0, niveau: 5, mainsNues: 0, parfaits: 0, mises: 0 };
    assert(!pickShowTaunt(base, () => 0).when, "Rien de notable : pique générique");
    assert(pickShowTaunt({ ...base, fuites: 5 }, () => 0).id === 'flee1', "5 fuites : pique sur les fuites en priorité");
    assert(pickShowTaunt({ ...base, objet: 'Rideau de Douche' }, () => 0).id === 'joke1', "Objet ridicule porté : pique dédiée");
    assert(pickShowTaunt({ ...base, parfaits: 6 }, () => 0).theme === 'perfect' && pickShowTaunt({ ...base, mises: 120 }, () => 0).theme === 'gambler', "Mini-jeux : piques sur les gestes parfaits et les pertes à la salle de jeux");
    assert(pickShowTaunt({ ...base, parfaits: 4, mises: 99 }, () => 0).when === undefined, "Mini-jeux : sous les seuils, pique générique");
    const everyTauntFills = SHOW_TAUNTS.every(t => !/\{\{/.test(fillShowTemplate(t.text, { ...base, crawler: 'Carl', race: 'Gobelin', classe: 'Filou', synergieTitre: 'Roi des caniveaux', essaiPct: 30, objet: 'X', compagnon: 'Y', fuites: 7, degats: 150, pieges: 3, sortsRates: 4, prime: 70, or: 600, succes: 12, mainsNues: 6, parfaits: 8, mises: 150, demonKO: 3, demonExpulsions: 2 })));
    assert(everyTauntFills, "Chaque pique n'utilise que des trous fournis par le contexte");
    const fullCtx = { ...base, crawler: 'Carl', race: 'Gobelin', classe: 'Filou', synergieTitre: 'Roi des caniveaux', essaiPct: 30, objet: 'X', compagnon: 'Y', fuites: 7, degats: 150, pieges: 3, sortsRates: 4, prime: 70, or: 600, succes: 12, mainsNues: 6, parfaits: 8, mises: 150, demonKO: 3, demonExpulsions: 2 };
    const everyReplyFills = Object.values(SHOW_REPLIES).every(byTone => Object.values(byTone).every(lines => lines.every(l => !/\{\{/.test(fillShowTemplate(l, fullCtx)))));
    assert(everyReplyFills, "Chaque réplique n'utilise que des trous fournis par le contexte");
    // Un thème sans compagnon (parti) ne doit jamais citer {{compagnon}}, absent du contexte à ce moment-là.
    assert(Object.values(SHOW_REPLIES.palGone).every(lines => lines.every(l => !l.includes('{{compagnon}}'))), "Compagnon parti : répliques sans son nom");
}

// --- Contexte de la partie ---
{
    resetTransientState();
    gameState.fleesThisRun = 4;
    gameState.playerName = "Carl";
    const ctx = buildShowContext({ damageTaken: 120, mobsKilled: 6, traps: 2 });
    assert(ctx.crawler === 'Carl' && ctx.fuites === 4 && ctx.degats === 120 && ctx.mobs === 6 && ctx.pieges === 2, "Contexte : partie en cours + bilan de l'étage qui vient de finir");
    assert(advanceToNextFloor.toString().includes('lastFloorForShow'), "advanceToNextFloor() capture le bilan de l'étage avant de le remettre à zéro");
}

// --- Déclenchement ---
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.saveEnabled = false;
    advanceToNextFloor();
    assert(!gameState.showChoicePending, "Hors vraie partie (saveEnabled faux) : pas d'émission");
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.playerName = "Carl";
    gameState.saveEnabled = true;
    advanceToNextFloor();
    if (gameState.pactChoicePending) choosePactBlessing('hp');
    assert(gameState.currentFloor === 2 && gameState.showChoicePending && gameState.pendingShow && gameState.pendingShow.text, "Étage 2 : l'émission s'ouvre à l'arrivée");
    assert(isActionBlocked() && !ui.showZone.classList.contains('hidden'), "Émission : choix bloquant, zone affichée");
    closeShow();
    gameState.saveEnabled = false;

    resetTransientState();
    gameState.pactChoicePending = true;
    gameState.pendingShowAfterPact = { damageTaken: 5 };
    choosePactBlessing('atk');
    assert(gameState.showChoicePending && !gameState.pendingShowAfterPact, "Émission mise en attente derrière le Pacte, ouverte juste après lui");
    closeShow();
    gameState.pactBlessingDelta = null;
}

// --- Réponses ---
{
    openShow();
    assert(answerShow('polite').success === true && gameState.gold > 0 && !gameState.showChoicePending, "Poli : sans jet, petit cadeau en PO, émission refermée");
    assert(answerShow('polite') === null, "Plus aucune réponse possible une fois l'émission refermée");

    openShow();
    const goldBefore = gameState.gold, invBefore = gameState.inventory.length;
    const ok = withRandom([rollFor(8), 0, 0.99], () => answerShow('retort'));
    assert(ok.success && ok.roll === 8 && (gameState.gold > goldBefore || gameState.inventory.length > invBefore), "Pique en retour ≥ 8 : boîte Bronze");

    openShow();
    gameState.timeLeft = 50;
    const ko = withRandom(rollFor(7), () => answerShow('retort'));
    assert(!ko.success && gameState.timeLeft === 48, "Pique en retour ratée : −2 H");
    openShow();
    gameState.timeLeft = 2;
    withRandom(0, () => answerShow('retort'));
    assert(gameState.timeLeft === 1, "L'échec d'une émission ne tue jamais par épuisement du temps");

    openShow();
    gameState.currentDistrict = Object.keys(districts)[0];
    withRandom(rollFor(11), () => answerShow('provoke'));
    assert(gameState.inCombat && gameState.currentEnemy && !gameState.currentEnemy.isBountyHunter, "Provocation ratée (< 12) : combat immédiat contre un élite");
    gameState.inCombat = false; gameState.currentEnemy = null;

    openShow();
    withRandom(rollFor(15), () => answerShow('insult'));
    assert(gameState.inCombat && gameState.currentEnemy.isBountyHunter && gameState.bounty.value === 20, "Insulte ratée (< 16) : +20 prime et un chasseur de primes");
    gameState.inCombat = false; gameState.currentEnemy = null;

    openShow();
    const gold0 = gameState.gold;
    const win = withRandom([rollFor(16), 0.5, 0.5], () => answerShow('insult'));
    assert(win.success && gameState.runStats.showInsultWins === 1, "Insulte réussie (≥ 16) : comptée");
    assert(gameState.gold > gold0 && gameState.inventory.length + gameState.spellbook.length >= 1, "Insulte réussie : boîte Or (objet Rare+ et PO)");
    gameState.inventory = [];

    openShow();
    assert(answerShow('refuse').tone === 'refuse' && !gameState.showChoicePending && gameState.runStats.showRefusals === 1, "Refuser : aucun effet, compté");
}

// --- Popularité ---
{
    openShow();
    gameState.achievements = {};
    ACHIEVEMENTS.slice(0, 10).forEach(a => { gameState.achievements[a.id] = { floor: 1, at: 0 }; });
    assert(getShowPopularity() === 2, "Popularité : +1 par tranche de 5 succès");
    const r = withRandom([rollFor(6), 0, 0.99], () => answerShow('retort'));
    assert(r.total === 8 && r.success, "La popularité s'ajoute au jet (6 + 2 = 8, réussi)");
    gameState.achievements = {};
}

// --- Succès ---
{
    openShow();
    gameState.saveEnabled = true;
    withRandom([rollFor(20), 0.5, 0.5], () => answerShow('insult'));
    assert(gameState.achievements.crowd_favorite, "Succès « Chouchou du public » : insulte réussie");
    for (let i = 0; i < 3; i++) { triggerShow({}); answerShow('refuse'); }
    assert(gameState.achievements.off_air, "Succès « Interdit d'antenne » : 3 refus");
    gameState.saveEnabled = false;
    gameState.inventory = [];
}

// --- Présentation ---
{
    openShow();
    updateShowZone();
    assert(ui.showTaunt.innerText === gameState.pendingShow.text, "Zone : la pique du présentateur");
    {
        // Les répliques proposées rebondissent sur la pique : 5 fuites → pique « fuites » → répliques « fuites », trous remplis.
        resetTransientState();
        gameState.fleesThisRun = 5;
        gameState.equipment.weapon = null; gameState.equipment.ranged = null; gameState.equipment.armor = null;
        gameState.companion = null;
        withRandom(0, () => triggerShow({}));
        const taunt = SHOW_TAUNTS.find(t => t.id === gameState.pendingShow.tauntId);
        assert(taunt.theme === 'flee', "5 fuites : pique du thème fuites");
        const ctx = buildShowContext({});
        assert(SHOW_TONES.every(t => SHOW_REPLIES.flee[t.key].map(l => fillShowTemplate(l, ctx)).includes(gameState.pendingShow.replies[t.key])),
            "Chaque bouton propose une réplique du thème de la pique");
        assert(SHOW_TONES.every(t => !/\{\{/.test(gameState.pendingShow.replies[t.key])), "Répliques affichées sans trou non rempli");
        closeShow();
    }
    openShow();
    assert(ui.showButtons.provoke.innerHTML.includes('Jet ≥ 12') && ui.showButtons.provoke.innerHTML.includes(gameState.pendingShow.replies.provoke), "Bouton : réplique + enjeu (seuil, gain, risque)");
    assert(describeShowStake('polite') === "Sans jet · petit cadeau" && describeShowStake('insult').includes('chasseur de primes'), "Enjeux lisibles");
    closeShow();
    const studio = composeExploreVignette('showStudio', {});
    assert(studio.includes('EN DIRECT') && studio.includes('APPLAUDIMÈTRE'), "Vignette plateau TV : enseigne EN DIRECT et applaudimètre");
    assert(restoreSaveForName.toString().includes('gameState.showChoicePending = false'), "Restauration : une émission en cours est abandonnée");
}

// --- Gorgoth le Concierge (chantier 17, lot 9) : thème `demon` ---
{
    const demonTaunts = SHOW_TAUNTS.filter(t => t.theme === 'demon');
    assert(demonTaunts.length >= 3 && demonTaunts.every(t => t.priority === 2 && typeof t.when === 'function'), "Gorgoth : au moins 3 piques du thème demon, priorité 2");
    assert(SHOW_TONES.every(t => (SHOW_REPLIES.demon[t.key] || []).length >= 2), "Gorgoth : répliques du thème demon pour les 4 tons");
    const base = { fuites: 0, degats: 0, maxHp: 100, pvPct: 100, mobs: 0, pieges: 0, sortsRates: 0, objet: null, compagnon: null, compagnonsPartis: 0, prime: 0, or: 50, etage: 6, succes: 0, niveau: 8, mainsNues: 0, parfaits: 0, mises: 0, demonKO: 0, demonExpulsions: 0, demonFresh: false, demonExpelledFresh: false, demonScarMax: 0 };
    assert(pickShowTaunt(base, () => 0).theme !== 'demon', "Gorgoth : contexte vierge, aucune pique demon");
    assert(pickShowTaunt({ ...base, demonKO: 1, demonFresh: true }, () => 0).id === 'demon1', "Gorgoth assommé sur l'étage précédent : pique dédiée");
    assert(pickShowTaunt({ ...base, demonKO: 1, demonFresh: true, fuites: 9, mobs: 10, or: 900 }, () => 0.5).theme === 'demon', "Gorgoth assommé : passe avant les piques ordinaires");
    assert(pickShowTaunt({ ...base, demonKO: 2, demonFresh: false }, () => 0).theme !== 'demon', "Mise au tapis ancienne (pas sur l'étage qui vient de finir) : pas de pique demon");
    assert(pickShowTaunt({ ...base, demonExpulsions: 1, demonExpelledFresh: true }, () => 0).id === 'demon4', "Expulsé sur l'étage précédent : pique dédiée");
    const expelledPool = SHOW_TAUNTS.filter(t => t.theme === 'demon' && t.when({ ...base, demonExpulsions: 2, demonExpelledFresh: true }));
    assert(expelledPool.some(t => t.id === 'demon5') && !expelledPool.some(t => t.id === 'demon1'), "Deux expulsions : pique sur le récidiviste de l'expulsion, jamais celle de la mise au tapis");

    resetTransientState();
    gameState.currentFloor = 5;
    gameState.runStats = createEmptyRunStats();
    gameState.runStats.demonKnockouts = 2;
    gameState.runStats.demonLastKnockoutFloor = 4;
    gameState.runStats.demonScarMax = 2;
    let ctx = buildShowContext({});
    assert(ctx.demonKO === 2 && ctx.demonFresh === true && ctx.demonExpelledFresh === false && ctx.demonScarMax === 2 && ctx.demonExpulsions === 0, "buildShowContext() : champs Gorgoth (mise au tapis sur l'étage qui vient de finir)");
    assert(pickShowTaunt(ctx, () => 0).theme === 'demon', "Contexte réel : la pique demon est choisie");
    gameState.currentFloor = 6;
    ctx = buildShowContext({});
    assert(ctx.demonFresh === false, "buildShowContext() : mise au tapis plus ancienne, plus fraîche");
    gameState.runStats.demonExpulsions = 1;
    gameState.runStats.demonLastExpelledFloor = 5;
    ctx = buildShowContext({});
    assert(ctx.demonExpelledFresh === true && ctx.demonExpulsions === 1, "buildShowContext() : expulsion sur l'étage qui vient de finir");
    resetTransientState();
}
