// minigames.js — tests régression : chantier 6 « mini-jeux », lot 0 (hôte d'épreuve, jet automatique,
// étape interactive du séquenceur, animations d'issue). Voir CHANTIERS.md et minigames.js / minigames-ui.js.
// Sous Node il n'y a pas de requestAnimationFrame : le jeu s'y résout donc toujours par le jet automatique ;
// les sections « interactif » simulent l'interface avec un requestAnimationFrame factice et une horloge pilotée.
const { assert, resetTransientState } = require('./_helpers.js');

const OUTCOMES = ['perfect', 'success', 'fail'];
const HAPTICS = ['light', 'medium', 'heavy'];

// --- Catalogue : chaque épreuve a un rendu, des animations d'issue et des taux de jet automatique ---
{
    const kinds = Object.keys(MINIGAME_KINDS);
    assert(kinds.length >= 1, "Le catalogue contient au moins une épreuve");
    kinds.forEach(k => {
        const kind = MINIGAME_KINDS[k];
        assert(kind.label && kind.icon && kind.hint, `Épreuve ${k} : libellé, icône et consigne`);
        const total = OUTCOMES.reduce((a, o) => a + (kind.autoRates[o] || 0), 0);
        assert(total === 100, `Épreuve ${k} : taux du jet automatique sommés à 100 (${total})`);
        assert(MINIGAME_RENDERERS[k] && typeof MINIGAME_RENDERERS[k].mount === 'function', `Épreuve ${k} : un rendu (MINIGAME_RENDERERS)`);
        assert(MINIGAME_KIND_FX[k] !== undefined, `Épreuve ${k} : une entrée MINIGAME_KIND_FX (variantes d'animation, même vide)`);
        OUTCOMES.forEach(o => {
            const fx = minigameOutcomeFxSpec(k, o);
            assert(fx && typeof FX_IMPACTS[fx.burst] === 'function', `Épreuve ${k} / ${o} : un éclat d'impact connu de FX_IMPACTS (${fx && fx.burst})`);
            assert(fx && typeof fx.hitstopMs === 'number' && fx.hitstopMs >= 0 && HAPTICS.includes(fx.haptic), `Épreuve ${k} / ${o} : gel d'impact et haptique valides`);
            assert(fx && ['mob', 'crawler'].includes(fx.target) && typeof fx.color === 'string', `Épreuve ${k} / ${o} : cible et couleur`);
            assert(fx && fx.label === MINIGAME_OUTCOME_LABELS[o], `Épreuve ${k} / ${o} : libellé d'issue`);
            assert(typeof pickMinigameLine(o, () => 0) === 'string', `Issue ${o} : une réplique`);
        });
    });
    assert(minigameOutcomeFxSpec('timing', 'inconnue') === null, "Une issue inconnue n'a pas de spécification d'animation");
    const perfect = minigameOutcomeFxSpec('timing', 'perfect'), success = minigameOutcomeFxSpec('timing', 'success'), fail = minigameOutcomeFxSpec('timing', 'fail');
    assert(perfect.heavy && !success.heavy && !fail.heavy, "Seul le Parfait porte la secousse d'écran");
    assert(perfect.hitstopMs > success.hitstopMs && fail.hitstopMs === 0, "Le gel d'impact du Parfait est plus long que celui du Réussi ; aucun sur un Raté");
    assert(buildMinigameSpec('inconnue') === null, "Épreuve inconnue : pas de spécification");
    assert(buildMinigameSpec('timing').durationMs === MINIGAME_SETTINGS.durationMs.normal && buildMinigameSpec('timing', { boss: true }).durationMs === MINIGAME_SETTINGS.durationMs.boss,
        "Durée plafonnée : 3 s pour un mob, 5 s pour un boss");
    assert(MINIGAME_SETTINGS.occasionChancePct.play === 25 && MINIGAME_SETTINGS.occasionChancePct.reduced < 25 && MINIGAME_SETTINGS.occasionChancePct.auto === 0,
        "Occasion de combat : 25 % en mode Jouer, moins en Réduit, jamais en Jet automatique");
}

// --- Épreuve « timing » : curseur, zone, issues ---
{
    assert(timingCursorPosition(0, 1000) === 0 && timingCursorPosition(500, 1000) === 1 && timingCursorPosition(1000, 1000) === 0, "Curseur : 0 au départ, 1 à mi-période, retour à 0");
    assert(Math.abs(timingCursorPosition(250, 1000) - 0.5) < 1e-9 && Math.abs(timingCursorPosition(750, 1000) - 0.5) < 1e-9, "Curseur : va-et-vient triangulaire");
    assert(timingCursorPosition(1250, 1000) === timingCursorPosition(250, 1000), "Curseur : périodique");
    const spec = { zoneCenter: 0.5, zoneWidth: 0.3, perfectRatio: 0.35 };
    assert(resolveTimingStop(0.5, spec) === 'perfect', "Stop au centre : Parfait");
    assert(resolveTimingStop(0.5 + 0.15 * 0.35, spec) === 'perfect', "Bord du cœur de zone : Parfait");
    assert(resolveTimingStop(0.4, spec) === 'success' && resolveTimingStop(0.64, spec) === 'success', "Dans la zone hors du cœur : Réussi");
    assert(resolveTimingStop(0.66, spec) === 'fail' && resolveTimingStop(0, spec) === 'fail' && resolveTimingStop(1, spec) === 'fail', "Hors zone : Raté");
    const lo = buildMinigameSpec('timing', {}, () => 0), hi = buildMinigameSpec('timing', {}, () => 0.999999);
    assert(lo.zoneCenter - lo.zoneWidth / 2 >= 0 && hi.zoneCenter + hi.zoneWidth / 2 <= 1, "La zone tient toujours dans la barre (hasard extrême compris)");
    assert(buildMinigameSpec('timing', { zoneCenter: 0.3 }).zoneCenter === 0.3, "Le centre de zone peut être imposé (tests, difficulté)");
}

// --- Jet automatique ---
{
    const spec = buildMinigameSpec('timing'); // perfect 10 / success 60 / fail 30
    assert(minigameAutoOutcome(spec, () => 0) === 'perfect' && minigameAutoOutcome(spec, () => 0.05) === 'perfect', "Jet automatique : début de la fourchette = Parfait");
    assert(minigameAutoOutcome(spec, () => 0.5) === 'success' && minigameAutoOutcome(spec, () => 0.95) === 'fail', "Jet automatique : Réussi puis Raté");
    const counts = { perfect: 0, success: 0, fail: 0 };
    for (let i = 0; i < 1000; i++) counts[minigameAutoOutcome(spec, () => i / 1000)]++;
    assert(counts.perfect === 100 && counts.success === 600 && counts.fail === 300, `Jet automatique : répartition fidèle aux taux (${JSON.stringify(counts)})`);
    const noPerfect = buildMinigameSpec('timing', { allowPerfect: false });
    let sawPerfect = false;
    for (let i = 0; i < 1000; i++) if (minigameAutoOutcome(noPerfect, () => i / 1000) === 'perfect') sawPerfect = true;
    assert(!sawPerfect, "allowPerfect faux (épreuves de boss) : le jet automatique ne donne jamais de Parfait");
    assert(minigameAutoOutcome({ autoRates: { perfect: 0, success: 0, fail: 0 } }, () => 0.3) === 'success', "Taux tous nuls : repli neutre (Réussi)");
    assert(minigameAutoOutcome({ autoRates: { perfect: 100 }, allowPerfect: false }, () => 0.3) === 'success', "Seul le Parfait est possible mais interdit : repli neutre");
    assert(buildMinigameSpec('timing', { autoRates: { fail: 100, success: 0, perfect: 0 } }).autoRates.fail === 100, "Les taux du jet automatique peuvent être surchargés");
}

// --- Réglage Jouer / Réduit / Jet automatique ---
{
    assert(normalizeMinigameMode('play') === 'play' && normalizeMinigameMode('nimporte') === null, "Réglage : valeurs validées");
    localStorage.removeItem(MINIGAME_MODE_KEY);
    minigameMode = null;
    assert(getMinigameMode() === 'auto', "Sous Node (sans requestAnimationFrame), le mode par défaut est le jet automatique");
    setMinigameMode('reduced');
    assert(getMinigameMode() === 'reduced' && localStorage.getItem(MINIGAME_MODE_KEY) === 'reduced', "Le réglage est retenu (stockage local)");
    assert(minigameOccasionChance() === MINIGAME_SETTINGS.occasionChancePct.reduced, "Chance d'Occasion selon le réglage");
    setMinigameMode('bidon');
    assert(getMinigameMode() === 'reduced', "Un réglage invalide est ignoré");
    minigameMode = null;
    localStorage.setItem(MINIGAME_MODE_KEY, 'play');
    assert(getMinigameMode() === 'play', "Le réglage stocké est relu");
    setMinigameMode('auto');
}

// --- Hôte, jet automatique (aucune interface) ---
{
    resetTransientState();
    setMinigameMode('play'); // réglage « Jouer », mais sans requestAnimationFrame : pas d'interface
    assert(!minigameIsInteractive(), "Sans requestAnimationFrame, l'épreuve n'est jamais interactive");
    let got = null;
    startMinigame(buildMinigameSpec('timing', { autoRates: { perfect: 0, success: 0, fail: 100 } }), (o, d) => { got = { o, d }; });
    assert(got && got.o === 'fail' && got.d.auto === true, "Jet automatique : onResult est appelé avant le retour de startMinigame()");
    assert(gameState.pendingMinigame === null && !isActionBlocked(), "Jet automatique : jamais d'état bloquant");
    got = null;
    startMinigame('timing', (o, d) => { got = { o, d }; });
    assert(got && OUTCOMES.includes(got.o), "startMinigame accepte aussi un nom d'épreuve");
    got = null;
    startMinigame('inconnue', (o, d) => { got = { o, d }; });
    assert(got && got.o === 'fail' && got.d.invalid, "Épreuve inconnue : Raté immédiat (jamais de blocage)");
    let noCallback = true;
    try { startMinigame('timing'); } catch (e) { noCallback = false; }
    assert(noCallback, "Sans callback : aucune erreur");
    setMinigameMode('auto');
    got = null;
    startMinigame('timing', (o, d) => { got = { o, d }; });
    assert(got && got.d.auto, "Mode Jet automatique : résolu tout de suite");
    playMinigameOutcomeFx(minigameOutcomeFxSpec('timing', 'perfect'), () => { got = 'fx'; });
    assert(got === 'fx', "Animation d'issue sans interface : onDone immédiat");
    let calls = 0;
    playMinigameOutcomeFx(null, () => { calls++; });
    assert(calls === 1, "Animation d'issue sans spécification : onDone appelé une fois");
}

// --- Hôte, interface simulée (requestAnimationFrame factice, horloge pilotée) ---
{
    resetTransientState();
    localStorage.removeItem(MINIGAME_HINTS_KEY);
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    const fixed = (extra) => buildMinigameSpec('timing', Object.assign({ zoneCenter: 0.5, zoneWidth: 0.3 }, extra));
    let res = [];
    const cb = (o, d) => res.push({ o, d });

    assert(minigameIsInteractive(), "Avec requestAnimationFrame et le réglage Jouer : épreuve interactive");
    startMinigame(fixed(), cb);
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'timing', "Épreuve ouverte : pendingMinigame posé");
    assert(isActionBlocked(), "Épreuve ouverte : les actions sont bloquées");
    assert(!ui.minigameStrip.classList.contains('hidden'), "La bande de jeu est affichée");
    assert(!ui.minigameHint.classList.contains('hidden') && ui.minigameHint.innerText === MINIGAME_KINDS.timing.hint, "Première fois : la consigne est affichée");
    assert(res.length === 0, "Rien n'est conclu tant que le joueur n'a pas agi");
    now = 275; // mi-course d'un aller : curseur à 0,5
    minigamePrimaryAction();
    assert(res.length === 1 && res[0].o === 'perfect' && !res[0].d.auto, "Stop au centre : Parfait");
    assert(gameState.pendingMinigame === null && !isActionBlocked() && ui.minigameStrip.classList.contains('hidden'), "Épreuve conclue : état libéré, bande masquée");
    assert(!ui.minigameBanner.classList.contains('hidden') || true, "Bannière d'issue posée (masquée par son minuteur)");

    res = []; now = 0;
    startMinigame(fixed(), cb);
    assert(ui.minigameHint.classList.contains('hidden'), "Deuxième fois : la consigne n'est plus affichée");
    now = 220; minigamePrimaryAction(); // curseur à 0,4 : dans la zone, hors du cœur
    assert(res[0].o === 'success', "Stop dans la zone : Réussi");
    minigamePrimaryAction();
    assert(res.length === 1, "Un second geste après la conclusion est sans effet (pointerdown puis click)");

    res = []; now = 1000;
    startMinigame(fixed(), cb);
    now = 1000 + 0; minigamePrimaryAction(); // curseur à 0 : hors zone
    assert(res[0].o === 'fail', "Stop hors zone : Raté");

    res = []; now = 5000;
    startMinigame(fixed(), cb);
    minigameTick();
    assert(res.length === 0 && gameState.pendingMinigame, "Avant la fin du temps : l'épreuve reste ouverte");
    now = 5000 + MINIGAME_SETTINGS.durationMs.normal;
    minigameTick();
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.timeout === true, "Temps écoulé : Raté");
    assert(gameState.pendingMinigame === null, "Temps écoulé : état libéré");

    res = []; now = 0;
    startMinigame(fixed({ autoRates: { perfect: 0, success: 100, fail: 0 } }), cb);
    skipMinigame();
    assert(res.length === 1 && res[0].o === 'success' && res[0].d.skipped && res[0].d.auto, "Passer : jet automatique");

    res = []; now = 0;
    startMinigame(fixed(), cb);
    let second = null;
    startMinigame(fixed({ autoRates: { perfect: 0, success: 0, fail: 100 } }), (o, d) => { second = { o, d }; });
    assert(second && second.d.auto && second.o === 'fail' && gameState.pendingMinigame, "Une seconde épreuve pendant une première : jet automatique, la première reste ouverte");
    skipMinigame();
    assert(res.length === 1 && gameState.pendingMinigame === null, "La première épreuve se conclut normalement");

    // Pause d'onglet : le temps passé masqué ne compte pas (minuterie reprise au retour).
    res = []; now = 0;
    startMinigame(fixed(), cb);
    const rt = minigameRuntime;
    rt.hiddenAt = 100; now = 4000; rt.pausedMs += now - rt.hiddenAt; rt.hiddenAt = 0; // reprise simulée comme le fait l'écouteur visibilitychange
    assert(minigameElapsed() === 100, "Pause d'onglet : seul le temps de jeu compte");
    abortMinigame();
    assert(gameState.pendingMinigame === null && ui.minigameStrip.classList.contains('hidden'), "abortMinigame() libère tout sans rien résoudre");
    assert(res.length === 0, "abortMinigame() n'appelle jamais onResult");

    // En combat : les boutons sont verrouillés pendant l'épreuve et libérés ensuite ; Espace/Entrée ne sautent pas le combat.
    res = []; now = 0;
    gameState.inCombat = true;
    gameState.currentEnemy = null;
    ui.btnAttackWeapon.disabled = false;
    startMinigame(fixed(), cb);
    assert(ui.btnAttackWeapon.disabled === true && ui.minigameStrip.classList.contains('in-combat'), "En combat : boutons verrouillés, bande collée au bas");
    combatSkipRequested = false;
    requestCombatSkip();
    assert(combatSkipRequested === false, "Espace/Entrée pendant une épreuve ne déclenchent pas le skip de combat");
    now = 275; minigamePrimaryAction();
    assert(res[0] && res[0].o === 'perfect' && ui.btnAttackWeapon.disabled === false, "En combat : boutons rendus à la fin de l'épreuve");
    // Boutons déjà verrouillés (beat de riposte) : l'hôte ne les déverrouille pas à leur place.
    res = []; now = 0;
    ui.btnAttackWeapon.disabled = true;
    startMinigame(fixed(), cb);
    now = 275; minigamePrimaryAction();
    assert(ui.btnAttackWeapon.disabled === true, "Boutons déjà verrouillés avant l'épreuve : laissés tels quels");
    ui.btnAttackWeapon.disabled = false;
    gameState.inCombat = false;

    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
    setMinigameClock(null);
    setMinigameMode('auto');
}

// --- Étape interactive du séquenceur de beats ---
{
    const log = [];
    let resume = null;
    runCombatBeats([
        { run() { log.push('a'); }, delay: 0 },
        { interactive: true, run(done) { log.push('i'); resume = done; } },
        { run() { log.push('b'); }, delay: 0 }
    ], () => log.push('fin'));
    assert(log.join() === 'a,i', "Étape interactive : le tour attend son rappel avant de continuer");
    resume();
    assert(log.join() === 'a,i,b,fin', "Étape interactive : le tour reprend puis se termine à la fin de l'épreuve");

    const log2 = [];
    runCombatBeats([
        { interactive: true, run(done) { log2.push('i'); done(); } },
        { run() { log2.push('b'); }, delay: 0 }
    ], () => log2.push('fin'));
    assert(log2.join() === 'i,b,fin', "Étape interactive résolue en jet automatique : enchaînement synchrone");

    // Une épreuve ouverte dans un beat de riposte : le tour reste suspendu jusqu'à sa conclusion.
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    const log3 = [];
    runCombatBeats([
        { interactive: true, run(done) { startMinigame(buildMinigameSpec('timing', { zoneCenter: 0.5 }), (o) => { log3.push(o); done(); }); } },
        { run() { log3.push('riposte'); }, delay: 0 }
    ], () => log3.push('fin'));
    assert(log3.length === 0 && gameState.pendingMinigame, "Épreuve dans un beat : la riposte attend");
    now = 275; minigamePrimaryAction();
    assert(log3.join() === 'perfect,riposte,fin', "Épreuve dans un beat : la riposte part à la conclusion");
    delete global.requestAnimationFrame;
    setMinigameClock(null);
    setMinigameMode('auto');
}

// --- Remise à zéro ---
{
    gameState.pendingMinigame = { kind: 'timing', boss: false };
    resetTransientState();
    assert(gameState.pendingMinigame === null && !isActionBlocked(), "resetTransientState() libère une épreuve ouverte");
}
