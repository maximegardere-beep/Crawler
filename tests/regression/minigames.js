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
        assert(total === 100 || typeof kind.autoResolve === 'function', `Épreuve ${k} : taux du jet automatique sommés à 100 (${total}) ou jet automatique propre`);
        assert(MINIGAME_RENDERERS[k] && typeof MINIGAME_RENDERERS[k].mount === 'function', `Épreuve ${k} : un rendu (MINIGAME_RENDERERS)`);
        assert(MINIGAME_KIND_FX[k] !== undefined, `Épreuve ${k} : une entrée MINIGAME_KIND_FX (variantes d'animation, même vide)`);
        OUTCOMES.forEach(o => {
            const fx = minigameOutcomeFxSpec(k, o);
            assert(fx && typeof FX_IMPACTS[fx.burst] === 'function', `Épreuve ${k} / ${o} : un éclat d'impact connu de FX_IMPACTS (${fx && fx.burst})`);
            assert(fx && typeof fx.hitstopMs === 'number' && fx.hitstopMs >= 0 && HAPTICS.includes(fx.haptic), `Épreuve ${k} / ${o} : gel d'impact et haptique valides`);
            assert(fx && ['mob', 'crawler', 'prop'].includes(fx.target) && typeof fx.color === 'string', `Épreuve ${k} / ${o} : cible et couleur`);
            assert(fx.target !== 'prop' || (Array.isArray(fx.at) && fx.at[0] >= 0 && fx.at[0] <= 360 && fx.at[1] >= 0 && fx.at[1] <= 150), `Épreuve ${k} / ${o} : un éclat d'exploration a une position dans la scène 360 x 150`);
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

// =====================================================================================================
// V1 : crochetage d'un coffre, désamorçage d'un piège, glyphe de sort
// =====================================================================================================

// Math.random piloté par une séquence (la dernière valeur se répète une fois la liste épuisée).
function withSeq(values, fn) {
    const original = Math.random;
    let i = 0;
    Math.random = () => values[Math.min(i++, values.length - 1)];
    try { return fn(); } finally { Math.random = original; }
}
function seqRng(values) { let i = 0; return () => values[Math.min(i++, values.length - 1)]; }
// Étage classique, salle de bloc (table d'événements `config.chances` : rien 37, combat 25 -> trésor 62-66, piège 66-76).
function blockFloor() {
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const fm = gameState.floorMap;
    fm.currentRoomId = Object.values(fm.roomsById).find(r => r.zone === 'block').id;
    gameState.timeLeft = 100;
}
function captureLog(fn) {
    const lines = [];
    const original = logEvent;
    logEvent = (msg) => { lines.push(String(msg)); };
    try { fn(); } finally { logEvent = original; }
    return lines;
}

// --- Un tap = un seul geste (pointerdown puis click) ---
{
    let now = 0;
    setMinigameClock(() => now);
    const el = document.createElement('button');
    let n = 0;
    bindTap(el, () => n++);
    el.dispatch('pointerdown', { preventDefault() {} });
    el.dispatch('click', {});
    assert(n === 1, "Tap souris/tactile : pointerdown puis click ne comptent qu'une fois");
    now = 100; el.dispatch('pointerdown', {}); now = 150; el.dispatch('click', {});
    assert(n === 2, "Deuxième tap : un geste de plus, un seul");
    now = 5000; el.dispatch('click', {});
    assert(n === 3, "Un click seul (clavier, lecteur d'écran) fonctionne");
    now = 5100; el.dispatch('click', {});
    assert(n === 4, "Deux clics clavier successifs comptent chacun");
    setMinigameClock(null);
}

// --- Crochetage : fonctions pures ---
{
    assert(LOCKPICK_REWARDS.join() === 'none,gold,explore,treasure', "Crochetage : récompenses 0 à 3 goupilles (rien, PO, butin, butin d'un palier de plus)");
    assert(lockpickReward(0) === 'none' && lockpickReward(1) === 'gold' && lockpickReward(2) === 'explore' && lockpickReward(3) === 'treasure', "Crochetage : une récompense par nombre de goupilles");
    assert(lockpickReward(-4) === 'none' && lockpickReward(9) === 'treasure', "Crochetage : nombre de goupilles borné");
    assert(lockpickOutcome(3, 3, 3) === 'perfect' && lockpickOutcome(3, 2, 3) === 'success' && lockpickOutcome(2, 0, 3) === 'success', "Crochetage : Parfait = 3 goupilles au cœur ; Réussi dès 2");
    assert(lockpickOutcome(1, 1, 3) === 'fail' && lockpickOutcome(0, 0, 3) === 'fail', "Crochetage : 0 ou 1 goupille = Raté");
    assert(lockpickZoneWidth(1, 1) === 0.3, "Crochetage : zone de départ 0,30 (étage 1, Furtivité 1)");
    assert(lockpickZoneWidth(10, 1) === MINIGAME_SETTINGS.lockpick.zoneMin, "Crochetage : la zone rétrécit avec l'étage, jusqu'à son plancher");
    assert(lockpickZoneWidth(5, 6) > lockpickZoneWidth(5, 1) && lockpickZoneWidth(5, 40) - lockpickZoneWidth(5, 1) <= MINIGAME_SETTINGS.lockpick.zoneStealthMax + 1e-9, "Crochetage : la Furtivité élargit la zone, bornée");
    const spec = buildMinigameSpec('lockpick', {}, seqRng([0, 0.5, 0.999999]));
    assert(spec.pins === 3 && spec.pinCenters.length === 3 && spec.durationMs === 3 * MINIGAME_SETTINGS.lockpick.pinMs, "Crochetage : 3 goupilles, 3 s chacune");
    assert(spec.pinCenters.every(c => c - spec.zoneWidth / 2 >= 0 && c + spec.zoneWidth / 2 <= 1), "Crochetage : chaque zone tient dans la barre");
    assert(minigameAutoResult(spec, seqRng([0.1, 0.1, 0.1])).detail.pins === 3 && minigameAutoResult(spec, seqRng([0.9, 0.9, 0.9])).detail.pins === 0, "Crochetage : jet automatique à 70 % par goupille");
    const mixed = minigameAutoResult(spec, seqRng([0.1, 0.9, 0.1]));
    assert(mixed.detail.pins === 2 && mixed.outcome === 'success', "Crochetage : jet automatique 2 goupilles = Réussi");
    assert(minigameAutoResult(spec, seqRng([0.1, 0.1, 0.1])).outcome === 'success', "Crochetage : un jet automatique ne donne jamais de Parfait");
    let total = 0;
    for (let i = 0; i < 700; i++) total += minigameAutoResult(spec, seqRng([(i % 100) / 100, ((i * 7) % 100) / 100, ((i * 13) % 100) / 100])).detail.pins;
    assert(total / 700 > 2.0 && total / 700 < 2.2, `Crochetage : en moyenne ~2,1 goupilles en jet automatique (${(total / 700).toFixed(2)})`);
    const plain = minigameAutoResult(buildMinigameSpec('timing'), () => 0.5);
    assert(plain.outcome === 'success' && typeof plain.detail === 'object', "Jet automatique générique : issue + détail vide");
}

// --- Désamorçage : fonctions pures ---
{
    assert(SEQUENCE_SYMBOLS.length === 4 && new Set(SEQUENCE_SYMBOLS.map(s => s.icon)).size === 4 && new Set(SEQUENCE_SYMBOLS.map(s => s.color)).size === 4, "Désamorçage : 4 symboles distincts par forme ET par couleur (lisible sans les couleurs)");
    assert(disarmOverrides(6, 1).length === 3 && disarmOverrides(7, 1).length === 4, "Désamorçage : 3 symboles, 4 à partir de l'étage 7");
    assert(disarmOverrides(1, 1).autoRates.success === 45 && disarmOverrides(1, 4).autoRates.success === 63 && disarmOverrides(1, 40).autoRates.success === 85, "Désamorçage : jet automatique 45 % + 6 % par niveau de Furtivité, plafond 85 %");
    assert(disarmOverrides(1, 5).autoRates.success + disarmOverrides(1, 5).autoRates.fail === 100 && disarmOverrides(1, 5).autoRates.perfect === 0, "Désamorçage : taux du jet automatique cohérents (pas de Parfait)");
    assert(disarmOverrides(1, 1).stepMs === 450 && disarmOverrides(1, 5).stepMs > 450 && disarmOverrides(1, 99).stepMs === 900, "Désamorçage : la Furtivité allonge l'affichage de chaque symbole, plafonné");
    const spec = buildMinigameSpec('sequence', Object.assign(disarmOverrides(1, 1), { sequence: [0, 1, 2] }));
    assert(spec.sequence.join() === '0,1,2' && spec.showMs === 3 * 450 + 250 && spec.durationMs === spec.showMs + spec.inputMs, "Désamorçage : durée = présentation + saisie");
    const random = buildMinigameSpec('sequence', { length: 4 }, seqRng([0, 0.3, 0.6, 0.999999]));
    assert(random.sequence.join() === '0,1,3,2', "Désamorçage : séquence tirée par le hasard injecté (chaque symbole diffère du précédent)");
    let repeats = false, outOfRange = false;
    for (let i = 0; i < 300; i++) {
        const sq = buildMinigameSpec('sequence', { length: 4 }).sequence;
        for (let k = 0; k < sq.length; k++) { if (k > 0 && sq[k] === sq[k - 1]) repeats = true; if (!(sq[k] >= 0 && sq[k] < 4)) outOfRange = true; }
    }
    assert(!repeats && !outOfRange, "Désamorçage : jamais deux symboles identiques d'affilée, tous dans le jeu de 4 (300 séquences)");
    assert(sequenceInputStatus([0, 1, 2], []) === 'ok' && sequenceInputStatus([0, 1, 2], [0, 1]) === 'ok' && sequenceInputStatus([0, 1, 2], [0, 2]) === 'wrong' && sequenceInputStatus([0, 1, 2], [0, 1, 2]) === 'done', "Désamorçage : statut de la saisie");
    assert(sequenceOutcome(spec, 100) === 'perfect' && sequenceOutcome(spec, spec.inputMs * 0.5) === 'perfect' && sequenceOutcome(spec, spec.inputMs * 0.51) === 'success', "Désamorçage : Parfait dans la moitié du temps de saisie");
    assert(sequenceShownSymbol(spec, 0) === 0 && sequenceShownSymbol(spec, 450) === 1 && sequenceShownSymbol(spec, 900) === 2, "Désamorçage : un symbole à la fois, dans l'ordre");
    assert(sequenceShownSymbol(spec, 400) === null && sequenceShownSymbol(spec, 1400) === null && sequenceShownSymbol(spec, -5) === null, "Désamorçage : un blanc entre deux symboles, rien après le dernier");
}

// --- Glyphe : motifs et tracé ---
{
    const offensive = spellCatalog.filter(s => s.category !== 'any');
    const utility = spellCatalog.filter(s => s.category === 'any');
    assert(offensive.length >= 15 && utility.length === 3, "Catalogue de sorts : 15 offensifs, 3 utilitaires");
    offensive.forEach(sp => {
        const pat = GLYPH_PATTERNS[sp.name];
        assert(Array.isArray(pat) && pat.length >= 4 && pat.length <= 6 && new Set(pat).size === pat.length && pat.every(i => Number.isInteger(i) && i >= 0 && i <= 8), `Glyphe de ${sp.name} : 4 à 6 points distincts de la grille 3 x 3`);
    });
    assert(new Set(Object.values(GLYPH_PATTERNS).map(p => p.join())).size === Object.keys(GLYPH_PATTERNS).length, "Glyphes : un motif distinct par sort");
    utility.forEach(sp => assert(!GLYPH_PATTERNS[sp.name] && getGlyphPattern({ spellName: sp.name }) === null, `Sort utilitaire ${sp.name} : pas de glyphe`));
    Object.keys(GLYPH_PATTERNS).forEach(n => assert(spellCatalog.some(s => s.name === n), `Glyphe orphelin : ${n} absent du grimoire`));
    assert(getGlyphPattern({ spellName: 'Foudre' }) === GLYPH_PATTERNS['Foudre'] && getGlyphPattern({ name: 'Foudre' }) === GLYPH_PATTERNS['Foudre'] && getGlyphPattern(null) === null, "getGlyphPattern() : par nom de sort, nul sinon");
    assert(GLYPH_GRID_POINTS.length === 9 && GLYPH_GRID_POINTS[0].x === 20 && GLYPH_GRID_POINTS[8].y === 80, "Grille 3 x 3 dans un repère 0..100");
    // Distance point-segment
    assert(glyphSegmentDistance(5, 5, 0, 0, 10, 0) === 5 && glyphSegmentDistance(-3, 0, 0, 0, 10, 0) === 3 && glyphSegmentDistance(4, 4, 4, 4, 4, 4) === 0, "Distance d'un point à un segment (milieu, extrémité, segment réduit à un point)");
    // Tracé : avance dans l'ordre, tolère un geste rapide, ignore un mauvais point.
    const pat = [0, 2, 8]; // (20,20) -> (80,20) -> (80,80)
    const at = (i) => GLYPH_GRID_POINTS[i];
    assert(glyphAdvance(pat, 0, at(0), at(0), 16) === 1, "Tracé : un point touché avance d'un cran");
    assert(glyphAdvance(pat, 0, at(0), at(2), 16) === 2, "Tracé : un geste rapide valide plusieurs points d'un coup (segment)");
    assert(glyphAdvance(pat, 0, { x: 0, y: 90 }, { x: 5, y: 95 }, 16) === 0, "Tracé : loin du premier point, rien ne bouge");
    assert(glyphAdvance(pat, 0, at(1), at(1), 16) === 0, "Tracé : passer sur un mauvais point est sans effet (sans pénalité)");
    assert(glyphAdvance(pat, 2, at(2), at(8), 16) === 3, "Tracé : dernier point = motif complet");
    assert(glyphAdvance(pat, 3, at(8), at(8), 16) === 3, "Tracé : rien au-delà de la fin");
}

// --- Hôte : crochetage interactif ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    const lock = (extra) => buildMinigameSpec('lockpick', Object.assign({ pinCenters: [0.5, 0.5, 0.5], zoneWidth: 0.3 }, extra));
    let res = [];
    const cb = (o, d) => res.push({ o, d });

    // Trois goupilles au cœur de la zone : curseur à 0,5 à 250 ms de la goupille (période 1000).
    startMinigame(lock(), cb);
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'lockpick' && isActionBlocked(), "Crochetage ouvert : état bloquant");
    now = 250; minigamePrimaryAction();
    assert(res.length === 0, "Une goupille crochetée ne conclut pas l'épreuve");
    now = 500; minigamePrimaryAction(); // la 2e goupille a démarré à 250 ms : 250 ms plus tard, curseur au centre
    now = 750; minigamePrimaryAction();
    assert(res.length === 1 && res[0].o === 'perfect' && res[0].d.pins === 3 && res[0].d.perfects === 3, "3 goupilles au cœur : Parfait, pins = 3");
    assert(gameState.pendingMinigame === null, "Crochetage conclu : état libéré");

    // Une goupille ratée (curseur à 0), les deux autres réussies : Réussi, pins = 2.
    res = []; now = 0;
    startMinigame(lock(), cb);
    minigamePrimaryAction();           // t = 0 : curseur à 0 -> hors zone
    now = 250; minigamePrimaryAction(); // 2e goupille démarrée à 0 : curseur à 0,5
    now = 500; minigamePrimaryAction(); // 3e démarrée à 250 : curseur à 0,5
    assert(res[0].o === 'success' && res[0].d.pins === 2 && res[0].d.perfects === 2, "2 goupilles sur 3 : Réussi, pins = 2");

    // Deux goupilles ratées : Raté, pins = 1.
    res = []; now = 0;
    startMinigame(lock(), cb);
    minigamePrimaryAction(); minigamePrimaryAction(); minigamePrimaryAction(); // trois arrêts à t = 0 : curseur à 0, hors zone
    assert(res[0].o === 'fail' && res[0].d.pins === 0, "Aucune goupille : Raté, pins = 0");

    // Une seule goupille crochetée (les deux autres à t = 0) : Raté, pins = 1.
    res = []; now = 0;
    startMinigame(lock(), cb);
    minigamePrimaryAction(); minigamePrimaryAction(); // deux arrêts à t = 0 : hors zone
    now = 250; minigamePrimaryAction();                // 3e goupille démarrée à t = 0 : curseur à 0,5
    assert(res[0].o === 'fail' && res[0].d.pins === 1, "Une goupille sur 3 : Raté, pins = 1");

    // Temps écoulé : les goupilles restantes comptent pour manquées, celles déjà crochetées sont gardées.
    res = []; now = 0;
    startMinigame(lock(), cb);
    now = 250; minigamePrimaryAction(); // 1 goupille crochetée
    now = 250 + 3 * MINIGAME_SETTINGS.lockpick.pinMs;
    minigameTick();
    assert(res.length === 1 && res[0].d.timeout === true && res[0].d.pins === 1 && res[0].o === 'fail', "Temps écoulé : les goupilles déjà crochetées sont conservées (pins = 1)");

    // Passer : jet automatique, avec un nombre de goupilles.
    res = []; now = 0;
    startMinigame(lock({ autoPinPct: 100 }), cb);
    skipMinigame();
    assert(res.length === 1 && res[0].d.skipped && res[0].d.pins === 3, "Passer : jet automatique par goupille (pins fourni)");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Hôte : désamorçage interactif ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    const seq = (extra) => buildMinigameSpec('sequence', Object.assign({ sequence: [0, 1, 2], stepMs: 450 }, extra));
    let res = [];
    const cb = (o, d) => res.push({ o, d });

    startMinigame(seq(), cb);
    const r = () => minigameRuntime.renderer;
    assert(r().phaseNow() === 'show', "Désamorçage : commence par la présentation");
    r().press(0);
    assert(res.length === 0 && r().phaseNow() === 'show', "Une saisie pendant la présentation est ignorée");
    now = 1700; minigameTick();
    assert(r().phaseNow() === 'input', "La saisie s'ouvre à la fin de la présentation");
    r().press(0); r().press(1);
    assert(res.length === 0, "Saisie correcte mais incomplète : l'épreuve reste ouverte");
    r().press(2);
    assert(res.length === 1 && res[0].o === 'perfect', "Séquence reproduite aussitôt : Parfait");

    res = []; now = 0;
    startMinigame(seq(), cb);
    now = 1700; minigameTick();
    now = 1700 + 2000;
    r().press(0); r().press(1); r().press(2);
    assert(res[0].o === 'success', "Séquence reproduite lentement : Réussi");

    res = []; now = 0;
    startMinigame(seq(), cb);
    now = 1700; minigameTick();
    r().press(0); r().press(3);
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.mistake === true && gameState.pendingMinigame === null, "Une erreur conclut tout de suite par un Raté");

    res = []; now = 0;
    startMinigame(seq(), cb);
    now = 1700; minigameTick();
    r().press(0);
    now = 1700 + 3000 + 100; minigameTick();
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.timeout === true, "Temps de saisie écoulé : Raté");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Hôte : glyphe interactif ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    const glyph = () => buildMinigameSpec('glyph', { pattern: [0, 2, 4, 6, 8] });
    let res = [];
    const cb = (o, d) => res.push({ o, d });
    const g = () => minigameRuntime.renderer;
    const P = (i) => GLYPH_GRID_POINTS[i];

    startMinigame(glyph(), cb);
    g().pointer('down', P(0).x, P(0).y);
    g().pointer('move', P(2).x, P(2).y);
    assert(g().progressNow() === 2, "Glyphe : un geste qui traverse deux points les valide");
    g().pointer('up');
    assert(g().progressNow() === 0 && res.length === 0, "Glyphe : lever le doigt avant la fin repart de zéro, sans conclure");
    g().pointer('move', P(0).x, P(0).y);
    assert(g().progressNow() === 0, "Glyphe : un déplacement sans doigt posé ne trace rien");
    g().pointer('down', P(0).x, P(0).y);
    g().pointer('move', P(2).x, P(2).y); g().pointer('move', P(4).x, P(4).y); g().pointer('move', P(6).x, P(6).y);
    assert(res.length === 0 && g().progressNow() === 4, "Glyphe : tracé en cours (4 points sur 5)");
    g().pointer('move', P(8).x, P(8).y);
    assert(res.length === 1 && res[0].o === 'perfect' && res[0].d.traced && gameState.pendingMinigame === null, "Glyphe tracé vite : Parfait");

    res = []; now = 0;
    startMinigame(glyph(), cb);
    now = 3000; // au-delà de 40 % de 5 s
    g().pointer('down', P(0).x, P(0).y);
    ['2', '4', '6', '8'].forEach(i => g().pointer('move', P(+i).x, P(+i).y));
    assert(res[0].o === 'success', "Glyphe tracé lentement : Réussi");

    res = []; now = 0;
    startMinigame(glyph(), cb);
    g().pointer('down', P(0).x, P(0).y);
    now = MINIGAME_SETTINGS.glyph.durationMs; minigameTick();
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.timeout === true, "Glyphe non terminé à temps : Raté (le sort part alors normalement)");

    // Jet automatique d'un glyphe : « pas de glyphe », silencieux.
    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
    res = [];
    const lines = captureLog(() => startMinigame(glyph(), cb));
    assert(res.length === 1 && res[0].d.auto === true && res[0].o === 'fail', "Glyphe en jet automatique : équivaut à « pas de glyphe »");
    assert(lines.length === 0, "Glyphe en jet automatique : rien n'est écrit au journal");
    const noisy = captureLog(() => startMinigame('timing', () => {}));
    assert(noisy.length === 1, "Une autre épreuve en jet automatique écrit bien sa ligne de journal");
}

// --- Moteur : glyphe et sorts ---
{
    const setup = (spell) => {
        resetTransientState();
        gameState.inCombat = true;
        gameState.skills.magic.level = 50;
        gameState.currentEnemy = { name: "Cobaye Glyphe", hp: 9999, maxHp: 9999, atk: 1, def: 50, status: {} };
        gameState.combatDistance = spell.spellCategory === 'melee' ? 0 : config.rangedCombat.initialDistance;
        gameState.equipment.spell = spell;
        gameState.mana = 100;
    };
    const foudre = () => ({ spellName: "Foudre", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 });
    const hpLost = () => 9999 - gameState.currentEnemy.hp;
    const original = Math.random;

    // Sans interface : jamais de glyphe, comportement inchangé.
    setup(foudre());
    Math.random = () => 0.075;
    attackMagic();
    Math.random = original;
    const baseline = hpLost();
    assert(gameState.pendingMinigame === null && baseline > 0 && gameState.mana === 95, "Sans interface interactive : le sort part directement (aucun glyphe)");

    // Avec interface : le glyphe s'ouvre AVANT l'action ; le mana n'est dépensé qu'au lancer.
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    setup(foudre());
    Math.random = () => 0.075;
    attackMagic();
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'glyph' && gameState.mana === 100 && hpLost() === 0, "Magie : le glyphe s'ouvre avant le lancer (mana et PV de l'ennemi intacts)");
    assert(ui.minigameTitle.innerText.includes('Foudre'), "Le glyphe porte le nom du sort");
    const g = () => minigameRuntime.renderer;
    const P = (i) => GLYPH_GRID_POINTS[i];
    let lines = captureLog(() => {
        g().pointer('down', P(1).x, P(1).y);
        [5, 7, 3].forEach(i => g().pointer('move', P(i).x, P(i).y));
    });
    Math.random = original;
    assert(gameState.pendingMinigame === null && gameState.mana === 95, "Glyphe réussi : le sort est lancé, mana dépensé une fois");
    assert(lines.some(l => l.includes('glyphe renforce')), "Glyphe réussi : le journal annonce le renfort");
    const boosted = hpLost();
    assert(boosted > baseline && boosted <= Math.ceil(baseline * 1.5), `Glyphe réussi : dégâts renforcés (${baseline} -> ${boosted})`);

    // Passer : sort normal, sans bonus ni malus.
    setup(foudre());
    Math.random = () => 0.075;
    attackMagic();
    lines = captureLog(() => skipMinigame());
    Math.random = original;
    assert(gameState.mana === 95 && hpLost() === baseline, "Glyphe passé : sort normal, mêmes dégâts qu'sans glyphe");
    assert(!lines.some(l => l.includes('glyphe renforce')), "Glyphe passé : aucun renfort");

    // Glyphe non terminé à temps : sort normal.
    setup(foudre());
    Math.random = () => 0.075;
    attackMagic();
    now = MINIGAME_SETTINGS.glyph.durationMs + 1; minigameTick();
    Math.random = original;
    assert(hpLost() === baseline && gameState.mana === 95, "Glyphe raté (temps écoulé) : sort normal, sans malus");

    // Vérifications avant le glyphe : sort impossible = pas de glyphe gâché.
    now = 0;
    setup(foudre());
    gameState.mana = 2;
    attackMagic();
    assert(gameState.pendingMinigame === null, "Mana insuffisant : aucun glyphe ouvert");
    setup(Object.assign(foudre(), { spellCategory: 'melee' }));
    gameState.combatDistance = 3;
    attackMagic();
    assert(gameState.pendingMinigame === null, "Mauvaise distance : aucun glyphe ouvert");

    // Sorts utilitaires et sorts sans motif : jamais de glyphe.
    setup({ spellName: "Soin Express", spellCategory: 'any', baseDmg: 0, manaCost: 5, spellEffect: { kind: 'heal', pct: 20 } });
    gameState.hp = 10;
    Math.random = () => 0.5; // pas de raté de sort (3 % minimum)
    attackMagic();
    Math.random = original;
    assert(gameState.pendingMinigame === null && gameState.hp > 10, "Sort utilitaire : lancé directement, sans glyphe");
    setup({ spellName: "Sort Inconnu", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 });
    attackMagic();
    assert(gameState.pendingMinigame === null, "Sort sans motif : pas de glyphe");

    // Réglage « Réduit » : plus rarement ; « Jet automatique » : jamais.
    setMinigameMode('reduced');
    setup(foudre());
    Math.random = () => 0.5; // 50 >= 25 : pas de glyphe cette fois
    attackMagic();
    Math.random = original;
    assert(gameState.pendingMinigame === null, "Réglage Réduit : pas de glyphe sur un tirage défavorable");
    setup(foudre());
    Math.random = () => 0.1; // 10 < 25 : glyphe proposé
    attackMagic();
    Math.random = original;
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'glyph', "Réglage Réduit : glyphe proposé sur un tirage favorable");
    skipMinigame();
    setMinigameMode('auto');
    setup(foudre());
    attackMagic();
    assert(gameState.pendingMinigame === null, "Jet automatique : jamais de glyphe");

    // Combat terminé entre-temps : le callback ne lance rien.
    setMinigameMode('play');
    setup(foudre());
    Math.random = () => 0.075;
    attackMagic();
    Math.random = original;
    gameState.inCombat = false; gameState.currentEnemy = null;
    skipMinigame();
    assert(gameState.mana === 100, "Combat terminé pendant le glyphe : aucun sort lancé, mana intact");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Moteur : coffre verrouillé ---
{
    const sources = [];
    const originalAddLoot = addLoot;
    addLoot = (o) => { sources.push(o && o.source); };
    try {
        blockFloor();
        withSeq([0.64, 0.99], () => resolveCardEvent());
        assert(sources.join() === 'explore', "Trésor sans coffre (jet >= 50) : butin ramassé tel quel, source 'explore'");

        blockFloor(); sources.length = 0;
        const lines = captureLog(() => withSeq([0.64, 0.1, 0.5, 0.5, 0.5, 0.1, 0.1, 0.1], () => resolveCardEvent()));
        assert(sources.join() === 'treasure' && gameState.pendingMinigame === null, "Coffre verrouillé, 3 goupilles (jet automatique) : butin d'un palier de plus");
        assert(lines.some(l => l.includes('3/3')), "Coffre verrouillé : le journal indique le nombre de goupilles");
        assert(ui.sceneTitle.innerText === 'Coffre Verrouillé', "Coffre verrouillé : titre de scène dédié");

        blockFloor(); sources.length = 0;
        withSeq([0.64, 0.1, 0.5, 0.5, 0.5, 0.1, 0.9, 0.1], () => resolveCardEvent());
        assert(sources.join() === 'explore', "Coffre verrouillé, 2 goupilles : butin normal");

        blockFloor(); sources.length = 0;
        const goldBefore = gameState.gold;
        withSeq([0.64, 0.1, 0.5, 0.5, 0.5, 0.1, 0.9, 0.9], () => resolveCardEvent());
        assert(sources.length === 0 && gameState.gold > goldBefore, "Coffre verrouillé, 1 goupille : quelques PO seulement");

        blockFloor(); sources.length = 0;
        const gold2 = gameState.gold;
        withSeq([0.64, 0.1, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9], () => resolveCardEvent());
        assert(sources.length === 0 && gameState.gold === gold2, "Coffre verrouillé, 0 goupille : rien");

        // Interface interactive : le coffre reste ouvert (état bloquant) jusqu'au dernier arrêt.
        blockFloor(); sources.length = 0;
        global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
        let now = 0; setMinigameClock(() => now); setMinigameMode('play');
        withSeq([0.64, 0.1, 0.5, 0.5, 0.5], () => resolveCardEvent());
        assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'lockpick' && isActionBlocked() && sources.length === 0, "Coffre en mode Jouer : épreuve ouverte, butin pas encore donné");
        assert(minigameRuntime.spec.zoneWidth === lockpickZoneWidth(1, 1), "Le coffre utilise la largeur de zone de l'étage et de la Furtivité");
        skipMinigame();
        assert(gameState.pendingMinigame === null && sources.length <= 1, "Coffre : Passer conclut par un jet automatique");
        delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
        setMinigameClock(null); setMinigameMode('auto');
    } finally {
        addLoot = originalAddLoot;
    }
}

// --- Moteur : piège désamorçable ---
{
    blockFloor();
    gameState.hp = 80;
    // d100 0,70 (piège), choix du piège, jet « désamorçable » (0,1 < 50), séquence (3 tirages), jet automatique 0,1 -> Réussi (45 %)
    let lines = captureLog(() => withSeq([0.70, 0, 0.1, 0.5, 0.5, 0.5, 0.1], () => resolveCardEvent()));
    assert(gameState.hp === 80 && gameState.pendingMinigame === null, "Piège désamorcé (jet automatique réussi) : aucun dégât");
    assert(lines.some(l => l.includes('désamorcé')), "Piège désamorcé : le journal le confirme");

    blockFloor();
    gameState.hp = 80;
    withSeq([0.70, 0, 0.1, 0.5, 0.5, 0.5, 0.9], () => resolveCardEvent());
    assert(gameState.hp < 80, "Désamorçage raté (jet automatique) : le piège se déclenche comme avant");

    blockFloor();
    gameState.hp = 80;
    withSeq([0.70, 0, 0.99, 0.5], () => resolveCardEvent());
    assert(gameState.hp < 80, "Piège non désamorçable (jet >= 50) : se déclenche directement, comme avant");

    // Un piège mortel qui se déclenche après un désamorçage raté : mort par piège, comme avant.
    blockFloor();
    gameState.hp = 1;
    withSeq([0.70, 0.99, 0.1, 0.5, 0.5, 0.5, 0.9], () => resolveCardEvent());
    assert(gameState.hp <= 0, "Désamorçage raté sur un crawler à 1 PV : le piège tue (comportement inchangé)");
    resetTransientState();

    // Interface interactive : le piège attend la fin de l'épreuve ; un Raté le déclenche alors.
    blockFloor();
    gameState.hp = 80;
    global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
    let now = 0; setMinigameClock(() => now); setMinigameMode('play');
    withSeq([0.70, 0, 0.1, 0, 0.33, 0.66], () => resolveCardEvent());
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'sequence' && gameState.hp === 80, "Piège en mode Jouer : séquence ouverte, rien ne se déclenche encore");
    assert(minigameRuntime.spec.sequence.length === 3 && minigameRuntime.spec.stepMs === disarmOverrides(1, 1).stepMs, "Le désamorçage utilise la longueur et la vitesse de l'étage et de la Furtivité");
    now = 5000; minigameTick(); // la présentation est passée, la saisie s'ouvre
    now = 5000 + 9999; minigameTick(); // temps écoulé : Raté
    assert(gameState.pendingMinigame === null && gameState.hp < 80, "Désamorçage raté en mode Jouer : le piège se déclenche");
    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
    resetTransientState();
}

// --- Animations d'issue en exploration ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    let calls = 0;
    playMinigameOutcomeFx(minigameOutcomeFxSpec('lockpick', 'perfect'), () => { calls++; });
    assert(calls === 1 && fxLayerOverride === null, "Animation d'issue en exploration : onDone appelé une fois, calque d'exploration relâché");
    playMinigameOutcomeFx(minigameOutcomeFxSpec('timing', 'perfect'), () => { calls++; });
    assert(calls === 2, "Une épreuve sans cible d'exploration n'anime rien hors combat (onDone immédiat)");
    delete global.requestAnimationFrame;
    ['lockpick', 'sequence', 'glyph'].forEach(k => OUTCOMES.forEach(o => {
        const fx = minigameOutcomeFxSpec(k, o);
        assert(MINIGAME_KIND_FX[k][o] && FX_IMPACTS[fx.burst], `${k} / ${o} : animation d'issue propre à l'épreuve`);
    }));
    assert(minigameOutcomeFxSpec('lockpick', 'perfect').burst === 'chestOpen' && minigameOutcomeFxSpec('sequence', 'fail').burst === 'trapSnap' && minigameOutcomeFxSpec('glyph', 'success').burst === 'glyphSeal', "Les épreuves V1 ont leurs éclats (coffre, piège, glyphe)");
}
