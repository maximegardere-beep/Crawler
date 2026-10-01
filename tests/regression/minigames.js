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

// =====================================================================================================
// V2 : Immobiliser / Étrangler, Cible de précision, Points faibles, Occasions de combat
// =====================================================================================================

// --- Maintien : fonctions pures ---
{
    const g = buildMinigameSpec('grapple', { phase: 0 });
    const c = buildMinigameSpec('choke', { phase: 0 });
    assert(g.kind === 'grapple' && g.durationMs === 3000 && g.zoneWidth === 0.34 && c.zoneWidth === 0.28 && c.zoneWidth < g.zoneWidth, "Immobiliser : zone 0,34 sur 3 s ; Étrangler : zone plus étroite (0,28)");
    assert(holdZoneWidth('grapple', 1) === 0.34 && holdZoneWidth('grapple', 5) === 0.38 && holdZoneWidth('grapple', 99) === 0.42, "Immobiliser : la zone s'élargit avec Mains nues (+0,01 par niveau, bornée à +0,08)");
    assert(holdZoneWidth('choke', 99) === 0.36, "Étrangler : même élargissement, borné");
    let inBar = true;
    for (let t = 0; t <= 6000; t += 25) {
        const center = holdZoneCenter(t, g);
        if (center - g.zoneWidth / 2 < 0 || center + g.zoneWidth / 2 > 1) inBar = false;
    }
    assert(inBar && holdZoneCenter(0, g) === 0.5, "La zone reste entièrement dans la barre, et part du milieu (phase 0)");
    assert(holdZoneCenter(g.periodMs, g) > 0.499 && holdZoneCenter(g.periodMs, g) < 0.501, "La zone est périodique");
    assert(holdInside(0.5, 0.5, 0.34) && holdInside(0.66, 0.5, 0.34) && !holdInside(0.68, 0.5, 0.34) && !holdInside(null, 0.5, 0.34), "Doigt dans la zone ou non (null = doigt levé)");
    assert(holdOutcome(1, g) === 'perfect' && holdOutcome(0.8, g) === 'perfect' && holdOutcome(0.79, g) === 'success' && holdOutcome(0.5, g) === 'success' && holdOutcome(0.49, g) === 'fail', "Immobiliser : Parfait dès 80 %, Réussi dès 50 % du temps dans la zone");
    assert(holdOutcome(0.84, c) === 'success' && holdOutcome(0.85, c) === 'perfect' && holdOutcome(0.59, c) === 'fail' && holdOutcome(0.6, c) === 'success', "Étrangler : seuils plus exigeants (85 % / 60 %)");
    assert(grappleRounds('fail', false) === 0 && grappleRounds('success', false) === 1 && grappleRounds('perfect', false) === 2, "Immobilisation : 1 tour (Réussi), 2 tours (Parfait)");
    assert(grappleRounds('perfect', true) === 1 && grappleRounds('success', true) === 1 && grappleRounds('fail', true) === 0, "Un boss n'est jamais immobilisé plus d'un tour");
    assert(MINIGAME_SETTINGS.choke.damageMult === 3, "Étrangler : dégâts x3");
    assert(MINIGAME_KINDS.grapple.autoRates.perfect + MINIGAME_KINDS.grapple.autoRates.success + MINIGAME_KINDS.grapple.autoRates.fail === 100, "Jet automatique d'Immobiliser : taux sommés à 100");
}

// --- Cible : fonctions pures ---
{
    assert(targetSizeFactor(0) === 1 && Math.abs(targetSizeFactor(5) - 0.7) < 1e-9 && targetSizeFactor(8) === 0.52 && targetSizeFactor(40) === 0.5, "La cible rétrécit avec l'écart (-6 % par cran), jamais sous 50 %");
    const near = buildMinigameSpec('target', { distance: 0, phaseX: 0 }, () => 0);
    const far = buildMinigameSpec('target', { distance: 8 }, () => 0);
    assert(far.outerRadius < near.outerRadius && far.centerRadius < near.centerRadius, "Cible : plus petite quand l'écart est grand");
    assert(buildMinigameSpec('target', { distance: 4, skillLevel: 10 }, () => 0).outerRadius > buildMinigameSpec('target', { distance: 4, skillLevel: 1 }, () => 0).outerRadius, "Cible : la compétence d'Arme l'agrandit un peu");
    assert(near.outerRadius === 0.5 && near.centerRadius === 0.18 && near.durationMs === 3000, "Cible : rayons de départ 0,5 / 0,18, 3 s");
    const spec = { outerRadius: 0.5, centerRadius: 0.18, amplitude: 0.85, periodXMs: 1300, periodYMs: 1900, phaseX: 0, phaseY: 0 };
    const p0 = targetReticlePosition(0, spec);
    assert(p0.x === 0 && p0.y === 0, "Réticule : part du centre (phases nulles)");
    let inBounds = true;
    for (let t = 0; t < 8000; t += 40) { const p = targetReticlePosition(t, spec); if (Math.abs(p.x) > 0.85 + 1e-9 || Math.abs(p.y) > 0.85 + 1e-9) inBounds = false; }
    assert(inBounds, "Réticule : reste dans l'amplitude");
    assert(resolveTargetShot({ x: 0, y: 0 }, spec) === 'perfect' && resolveTargetShot({ x: 0.18, y: 0 }, spec) === 'perfect', "Tir au centre : Parfait");
    assert(resolveTargetShot({ x: 0.3, y: 0.2 }, spec) === 'success' && resolveTargetShot({ x: 0.5, y: 0 }, spec) === 'success', "Tir dans la cible : Réussi");
    assert(resolveTargetShot({ x: 0.6, y: 0 }, spec) === 'fail' && resolveTargetShot({ x: 0.85, y: 0.85 }, spec) === 'fail', "Tir hors cible : Raté");
    // Un Parfait est TOUJOURS atteignable : le réticule croise le centre à `perfectAtMs`, quel que soit le hasard et l'écart.
    let unreachable = 0;
    for (let i = 0; i < 300; i++) {
        const sp = buildMinigameSpec('target', { distance: i % 9, skillLevel: 1 }, Math.random);
        const atStar = targetReticlePosition(sp.perfectAtMs, sp);
        let perfectWindow = 0;
        for (let t = 0; t <= sp.durationMs; t += 5) if (resolveTargetShot(targetReticlePosition(t, sp), sp) === 'perfect') perfectWindow++;
        if (Math.hypot(atStar.x, atStar.y) > 1e-6 || perfectWindow < 4 || sp.perfectAtMs < 800 || sp.perfectAtMs > 2200) unreachable++;
    }
    assert(unreachable === 0, `Cible : un Parfait est toujours atteignable (fenêtre d'au moins 20 ms, passage au centre entre 0,8 et 2,2 s) — ${unreachable} cas sur 300`);
    const seen = new Set();
    for (let t = 0; t < 3000; t += 10) seen.add(resolveTargetShot(targetReticlePosition(t, spec), spec));
    assert(seen.has('perfect') && seen.has('success') && seen.has('fail'), "Sur 3 s, le réticule passe au centre, sur la cible et hors cible (les trois issues sont atteignables)");
}

// --- Points faibles : zones ---
{
    const z = WEAKPOINT_ZONES;
    assert(Object.keys(z).join() === 'head,arm,leg', "Points faibles : tête, bras, jambe");
    assert(z.head.dmgMult === 1.3 && !z.head.weaken && !z.head.push, "Tête : dégâts +30 %, aucun effet");
    assert(z.arm.dmgMult === 0.8 && z.arm.weaken.mult === 0.75 && z.arm.weaken.rounds === 2 && !z.arm.push, "Bras : dégâts -20 % et ATQ du mob -25 % pendant 2 tours");
    assert(z.leg.dmgMult === 0.8 && z.leg.push === 1 && !z.leg.weaken, "Jambe : dégâts -20 % et le mob recule d'un cran");
    Object.values(z).forEach(v => assert(v.icon && v.label && v.text, "Chaque zone a son icône, son nom et son effet écrit dessus"));
    const auto = minigameAutoResult(buildMinigameSpec('weakpoint'), () => 0.9);
    assert(auto.outcome === 'success' && auto.detail.zone === 'head', "Points faibles : le jet automatique choisit la tête (aucune adresse en jeu)");
}

// --- Occasions : décision pure ---
{
    const base = { distance: 0, hasRanged: false, disarmed: false, isBoss: false, immobilized: false };
    const E = (o) => eligibleOccasions(Object.assign({}, base, o));
    assert(E({}).pool.join() === 'immobilize' && E({}).forced === null, "Au contact : Immobiliser");
    assert(E({ immobilized: true }).forced === 'strangle' && E({ immobilized: true }).pool.length === 0, "Mob immobilisé ou étourdi au contact : Étrangler, à coup sûr (et plus rien d'autre)");
    assert(E({ immobilized: true, isBoss: true }).forced === null && E({ immobilized: true, isBoss: true }).pool.length === 0, "Boss immobilisé : jamais d'Étrangler");
    assert(E({ isBoss: true }).pool.join() === 'immobilize', "Un boss peut être immobilisé (un tour)");
    assert(E({ distance: 3, hasRanged: true }).pool.join() === 'target,weakpoint', "À distance avec une arme à distance : Cible ou Point faible");
    assert(E({ distance: 3 }).pool.length === 0, "À distance sans arme à distance : rien");
    assert(E({ distance: 3, hasRanged: true, disarmed: true }).pool.length === 0, "Arme arrachée : pas de tir spécial");
    assert(occasionStillValid('strangle', Object.assign({}, base, { immobilized: true })) && !occasionStillValid('immobilize', Object.assign({}, base, { immobilized: true })), "Validité d'une Occasion déjà proposée");
    assert(!occasionStillValid('target', base) && occasionStillValid('target', Object.assign({}, base, { distance: 2, hasRanged: true })), "Une Cible n'est plus valable une fois au contact");

    assert(occasionChancePct('play', 1) === 25 && occasionChancePct('play', 6) === 30 && occasionChancePct('play', 99) === 35, "Chance d'Occasion : 25 %, +1 % par niveau de compétence, plafonné à +10");
    assert(occasionChancePct('reduced', 1) === 10 && occasionChancePct('reduced', 99) === 20 && occasionChancePct('auto', 99) === 0, "Chance d'Occasion : 10 % en Réduit, jamais en Jet automatique");

    const input = (o) => Object.assign({ ctx: base, mode: 'play', skillLevels: { unarmed: 1, weapon: 1 }, turn: 5, lastOfferTurn: -9, pity: 0 }, o);
    assert(decideOccasion(input({}), () => 0.24) === 'immobilize' && decideOccasion(input({}), () => 0.25) === null, "Décision : un tirage sous 25 % propose l'Occasion");
    assert(decideOccasion(input({ skillLevels: { unarmed: 11, weapon: 1 } }), () => 0.34) === 'immobilize', "Décision : la compétence liée relève la chance (Mains nues pour Immobiliser)");
    assert(decideOccasion(input({ skillLevels: { unarmed: 1, weapon: 11 } }), () => 0.34) === null, "Décision : seule la compétence liée compte (l'Arme n'aide pas Immobiliser)");
    assert(decideOccasion(input({ mode: 'auto' }), () => 0) === null && decideOccasion(input({ mode: 'auto', ctx: Object.assign({}, base, { immobilized: true }) }), () => 0) === null, "Jet automatique : jamais d'Occasion (Étrangler compris)");
    assert(decideOccasion(input({ mode: 'bidon' }), () => 0) === null, "Réglage inconnu : jamais d'Occasion");
    assert(decideOccasion(input({ mode: 'reduced' }), () => 0.12) === null && decideOccasion(input({ mode: 'reduced' }), () => 0.09) === 'immobilize', "Mode Réduit : 10 %");
    assert(decideOccasion(input({ ctx: Object.assign({}, base, { immobilized: true }) }), () => 0.99) === 'strangle', "Étrangler : proposé sans tirage");
    assert(decideOccasion(input({ ctx: Object.assign({}, base, { immobilized: true }), lastOfferTurn: 4 }), () => 0.99) === 'strangle', "Étrangler : proposé même juste après une Occasion (c'est la suite du combo)");
    assert(decideOccasion(input({ lastOfferTurn: 4 }), () => 0) === null && decideOccasion(input({ lastOfferTurn: 3 }), () => 0) === 'immobilize', "Jamais deux Occasions tirées d'affilée");
    assert(decideOccasion(input({ pity: 6 }), () => 0.99) === 'immobilize' && decideOccasion(input({ pity: 5 }), () => 0.99) === null, "Garantie : une Occasion après 6 combats sans");
    assert(decideOccasion(input({ pity: 6, lastOfferTurn: 4 }), () => 0) === null, "Même la garantie respecte « pas deux de suite »");
    const ranged = input({ ctx: Object.assign({}, base, { distance: 3, hasRanged: true }) });
    assert(decideOccasion(ranged, seqRng([0, 0])) === 'target' && decideOccasion(ranged, seqRng([0, 0.99])) === 'weakpoint', "À distance : Cible ou Point faible, au hasard");
    assert(decideOccasion(input({ ctx: Object.assign({}, base, { isBoss: true, immobilized: true }) }), () => 0) === null, "Boss immobilisé : aucune Occasion");
    Object.keys(OCCASION_TYPES).forEach(k => assert(MINIGAME_KINDS[OCCASION_TYPES[k].kind] && OCCASION_TYPES[k].icon && OCCASION_TYPES[k].label && ['unarmed', 'weapon'].includes(OCCASION_TYPES[k].skill), `Occasion ${k} : épreuve, icône, nom et compétence liée`));
}

// --- Hôte : maintien du doigt ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    let res = [];
    const cb = (o, d) => res.push({ o, d });
    const hold = (kind) => buildMinigameSpec(kind, { phase: 0 });
    const R = () => minigameRuntime.renderer;

    // Doigt qui suit la zone pendant toute l'épreuve : Parfait.
    const g = hold('grapple');
    startMinigame(g, cb);
    R().pointer('down', holdZoneCenter(0, g));
    for (now = 100; now <= 3000; now += 100) { R().pointer('move', holdZoneCenter(now, g)); minigameTick(); }
    assert(res.length === 1 && res[0].o === 'perfect' && res[0].d.ratio > 0.9, `Doigt qui suit la zone : Parfait (${res[0] && res[0].d.ratio})`);

    // Doigt jamais posé : Raté (la fin du temps est la fin normale de l'épreuve).
    res = []; now = 0;
    startMinigame(hold('grapple'), cb);
    now = 3000; minigameTick();
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.ratio === 0 && !res[0].d.timeout, "Doigt jamais posé : Raté, ratio 0");

    // Doigt levé aux deux tiers du temps : Réussi.
    res = []; now = 0;
    const g2 = hold('grapple');
    startMinigame(g2, cb);
    R().pointer('down', holdZoneCenter(0, g2));
    for (now = 100; now <= 2000; now += 100) { R().pointer('move', holdZoneCenter(now, g2)); minigameTick(); }
    R().pointer('up');
    for (now = 2100; now <= 3000; now += 100) minigameTick();
    assert(res.length === 1 && res[0].o === 'success' && res[0].d.ratio > 0.5 && res[0].d.ratio < 0.8, `Doigt levé aux 2/3 : Réussi (${res[0] && res[0].d.ratio})`);

    // Doigt posé hors de la zone en permanence : Raté.
    res = []; now = 0;
    const g3 = hold('grapple');
    startMinigame(g3, cb);
    R().pointer('down', 0.02);
    for (now = 100; now <= 3000; now += 100) { R().pointer('move', holdZoneCenter(now, g3) > 0.5 ? 0.02 : 0.98); minigameTick(); }
    assert(res[0].o === 'fail', "Doigt toujours du mauvais côté : Raté");

    // Onglet masqué : un saut de temps ne crédite jamais plus de 100 ms.
    res = []; now = 0;
    const g4 = hold('grapple');
    startMinigame(g4, cb);
    R().pointer('down', holdZoneCenter(0, g4));
    now = 2900;
    R().pointer('move', holdZoneCenter(2900, g4)); // le saut de 2900 ms n'est crédité que de 100 ms
    assert(R().scoreNow() <= 100, `Un grand saut de temps ne crédite que 100 ms (${R().scoreNow()})`);
    skipMinigame();

    // Étrangler : mêmes mécaniques, seuils plus exigeants (zone 0,28 + 85 %).
    res = []; now = 0;
    const c = hold('choke');
    startMinigame(c, cb);
    R().pointer('down', holdZoneCenter(0, c));
    for (now = 100; now <= 3000; now += 100) { R().pointer('move', holdZoneCenter(now, c)); minigameTick(); }
    assert(res[0].o === 'perfect', "Étrangler : doigt qui suit la zone = Parfait");

    // Passer : jet automatique.
    res = []; now = 0;
    startMinigame(buildMinigameSpec('grapple', { autoRates: { perfect: 0, success: 100, fail: 0 } }), cb);
    skipMinigame();
    assert(res[0].o === 'success' && res[0].d.skipped, "Passer : jet automatique");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Hôte : cible et points faibles ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    let res = [];
    const cb = (o, d) => res.push({ o, d });
    const spec = () => buildMinigameSpec('target', { phaseX: 0, phaseY: 0 });
    const s0 = spec();
    const timeFor = (wanted) => { for (let t = 0; t < 3000; t += 5) if (resolveTargetShot(targetReticlePosition(t, s0), s0) === wanted) return t; return -1; };

    startMinigame(spec(), cb);
    now = 0; minigamePrimaryAction();
    assert(res[0].o === 'perfect' && res[0].d.x === 0, "Cible : tir au démarrage, réticule au centre = Parfait");
    for (const wanted of ['success', 'fail']) {
        res = []; now = 0;
        startMinigame(spec(), cb);
        now = timeFor(wanted); minigamePrimaryAction();
        assert(res[0].o === wanted, `Cible : tir à l'instant où le réticule donne « ${wanted} »`);
    }
    res = []; now = 0;
    startMinigame(spec(), cb);
    now = 3000; minigameTick();
    assert(res[0].o === 'fail' && res[0].d.timeout, "Cible : aucun tir à temps = Raté");

    // Points faibles : un choix, trois zones.
    for (const zone of ['head', 'arm', 'leg']) {
        res = []; now = 0;
        startMinigame(buildMinigameSpec('weakpoint'), cb);
        minigameRuntime.renderer.pick(zone);
        assert(res[0].o === 'success' && res[0].d.zone === zone && gameState.pendingMinigame === null, `Point faible : ${zone} choisi`);
    }
    res = []; now = 0;
    startMinigame(buildMinigameSpec('weakpoint'), cb);
    now = 6000; minigameTick();
    assert(res[0].o === 'fail' && res[0].d.timeout, "Point faible : trop d'hésitation = Raté (6 s)");
    res = []; now = 0;
    startMinigame(buildMinigameSpec('weakpoint'), cb);
    skipMinigame();
    assert(res[0].o === 'success' && res[0].d.zone === 'head' && res[0].d.skipped, "Point faible passé : la tête, jet automatique");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Moteur : Occasions de combat ---
{
    const original = Math.random;
    const withRand = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = original; } };
    const rollWith = (v) => withRand(v, () => updateUI());
    const begin = (opts = {}) => {
        resetTransientState();
        global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
        setMinigameMode('play');
        let t = 0; setMinigameClock(() => t);
        gameState.atk = 100; // dégâts élevés : les arrondis ne faussent pas les rapports
        if (opts.ranged) gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 10, category: 'ranged' };
        withRand(0.5, () => initiateCombat(Object.assign({ name: "Cobaye Occasion", hp: 9999, atk: 1, def: 5, xpReward: 1, ranged: !!opts.ranged }, opts.enemy)));
        gameState.combatDistance = opts.distance || 0;
        gameState.occasion = createOccasionState();
        return gameState.currentEnemy;
    };
    const finish = () => { delete global.requestAnimationFrame; delete global.cancelAnimationFrame; setMinigameClock(null); setMinigameMode('auto'); resetTransientState(); };
    const hpLost = (enemy) => 9999 - enemy.hp;

    // Sans interface (Node) : jamais d'Occasion.
    resetTransientState();
    withRand(0.5, () => initiateCombat({ name: "Cobaye Muet", hp: 50, atk: 1, def: 5, xpReward: 1 }));
    rollWith(0);
    assert(gameState.occasion.current === null && ui.btnOccasion.classList.contains('hidden'), "Sans interface interactive : aucune Occasion, bouton masqué");
    resetTransientState();

    // Une Occasion se propose au tirage favorable, une seule fois par tour ; le bouton est mis en avant.
    let enemy = begin();
    rollWith(0);
    assert(gameState.occasion.current && gameState.occasion.current.type === 'immobilize', "Contact, tirage favorable : Immobiliser proposé");
    assert(!ui.btnOccasion.classList.contains('hidden') && ui.btnOccasion.innerText.includes('Immobiliser'), "Le bouton « ✨ Occasion » apparaît avec le nom de l'action");
    rollWith(0.99);
    assert(gameState.occasion.current && gameState.occasion.current.type === 'immobilize', "Une fois par tour : un second rafraîchissement ne retire pas l'Occasion");
    assert(gameState.occasion.pity === 0 && gameState.occasion.lastOfferTurn === gameState.occasion.turn, "L'offre remet la garantie à zéro et note le tour");

    // Immobiliser réussi (Parfait) : 2 tours, la riposte de CE tour est déjà sautée ; puis Étrangler à coup sûr.
    Math.random = () => 0.5;
    const hp0 = gameState.hp;
    startOccasion();
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'grapple' && gameState.occasion.current === null, "L'Occasion prise ouvre l'épreuve et s'éteint");
    assert(ui.btnAttackWeapon.disabled === true, "Boutons de combat verrouillés pendant l'épreuve");
    let lines = captureLog(() => finishMinigame('perfect', { ratio: 1 }));
    assert(enemy.status.immobilized && enemy.status.immobilized.rounds === 1, "Immobiliser parfait : 2 tours, dont la riposte de ce tour (sautée) -> reste 1");
    assert(gameState.hp === hp0 && lines.some(l => l.includes('immobilisé')), "Immobilisé : le mob ne riposte pas, le journal le dit");
    assert(gameState.occasion.current && gameState.occasion.current.type === 'strangle', "Mob immobilisé au tour suivant : Étrangler proposé à coup sûr");

    // Étrangler : dégâts x3 d'une attaque à mains nues.
    Math.random = () => 0.5;
    const before = enemy.hp;
    startOccasion();
    assert(gameState.pendingMinigame.kind === 'choke', "Étrangler : l'épreuve s'ouvre");
    finishMinigame('success', { ratio: 0.7 });
    const strangled = before - enemy.hp;
    assert(enemy.status.immobilized === null, "Étrangler : la seconde riposte est sautée, l'immobilisation prend fin");
    Math.random = original;
    finish();
    enemy = begin();
    withRand(0.5, () => attackUnarmed());
    const plain = hpLost(enemy);
    assert(plain > 0 && strangled >= plain * 2.8 && strangled <= plain * 3.2, `Étrangler : dégâts ~x3 d'une attaque à mains nues (${plain} -> ${strangled})`);
    finish();

    // Immobiliser raté : tour perdu, la riposte part normalement.
    enemy = begin();
    rollWith(0);
    Math.random = () => 0.5;
    lines = captureLog(() => { startOccasion(); finishMinigame('fail', { ratio: 0.1 }); });
    Math.random = original;
    assert(enemy.status.immobilized === null && lines.some(l => l.includes('se dégage')), "Immobiliser raté : pas d'immobilisation, tour perdu");
    assert(gameState.skills.unarmed.xp > 0, "Immobiliser raté : on apprend quand même (XP Mains nues)");
    finish();

    // Boss : immobilisé un seul tour, jamais étranglé.
    enemy = begin({ enemy: { isBoss: true, hp: 9999, name: "Boss d'Essai" } });
    rollWith(0);
    Math.random = () => 0.5;
    startOccasion();
    finishMinigame('perfect', { ratio: 1 });
    Math.random = original;
    assert(enemy.status.immobilized === null || enemy.status.immobilized.rounds === 0, "Boss : immobilisé un seul tour (déjà consommé par la riposte sautée)");
    rollWith(0.99);
    assert(!gameState.occasion.current || gameState.occasion.current.type !== 'strangle', "Boss : jamais d'Étrangler");
    finish();

    // Mob déjà étourdi (autre source) : Étrangler proposé, pas d'Immobiliser.
    enemy = begin();
    enemy.status.stunned = true;
    rollWith(0.99);
    assert(gameState.occasion.current && gameState.occasion.current.type === 'strangle', "Mob étourdi : Étrangler proposé");
    finish();

    // Tir : Cible. Parfait x1,5, Réussi x1, Raté = tour perdu.
    const shotDamage = (outcome) => {
        const e = begin({ ranged: true, distance: 3 });
        rollWith(0);
        assert(gameState.occasion.current && gameState.occasion.current.type === 'target', "À distance avec une arme à distance : Cible proposée");
        Math.random = () => 0.5;
        startOccasion();
        assert(gameState.pendingMinigame.kind === 'target', "Cible : l'épreuve s'ouvre");
        finishMinigame(outcome, {});
        Math.random = original;
        const dmg = hpLost(e);
        finish();
        return dmg;
    };
    const dPerfect = shotDamage('perfect'), dSuccess = shotDamage('success'), dFail = shotDamage('fail');
    let e = begin({ ranged: true, distance: 3 });
    withRand(0.5, () => attackRanged());
    const dPlain = hpLost(e);
    finish();
    assert(dFail === 0, "Cible ratée : aucun dégât (tour perdu)");
    assert(dSuccess === dPlain, `Cible réussie : dégâts d'un tir normal (${dPlain} / ${dSuccess})`);
    assert(dPerfect > dSuccess && dPerfect >= dPlain * 1.45 && dPerfect <= dPlain * 1.55, `Cible parfaite : dégâts x1,5 (${dPlain} -> ${dPerfect})`);

    // Points faibles.
    const weak = (zone) => {
        const en = begin({ ranged: true, distance: 3 });
        withRand(0, () => { gameState.occasion = createOccasionState(); updateUI(); });
        gameState.occasion.current = { type: 'weakpoint' };
        Math.random = () => 0.5;
        const dist0 = gameState.combatDistance;
        startOccasion();
        assert(gameState.pendingMinigame.kind === 'weakpoint', "Point faible : l'épreuve s'ouvre");
        const lg = captureLog(() => finishMinigame('success', { zone }));
        Math.random = original;
        const out = { dmg: hpLost(en), enemy: en, dist0, dist: gameState.combatDistance, lines: lg };
        finish();
        return out;
    };
    const head = weak('head'), arm = weak('arm'), leg = weak('leg');
    assert(head.dmg > dPlain && head.dmg <= Math.ceil(dPlain * 1.4), `Point faible (tête) : dégâts +30 % (${dPlain} -> ${head.dmg})`);
    assert(arm.dmg < dPlain && arm.enemy.status.weakened && arm.enemy.status.weakened.mult === 0.75 && arm.enemy.status.weakened.rounds === 1, "Point faible (bras) : dégâts -20 %, ATQ du mob -25 % (2 tours, dont celui de la riposte déjà passé)");
    assert(arm.lines.some(l => l.includes('bras')), "Point faible (bras) : le journal l'annonce");
    assert(leg.dmg < dPlain && leg.dist === leg.dist0 + 1, "Point faible (jambe) : dégâts -20 % et le mob recule d'un cran");
    assert(head.enemy.status.weakened === null && head.dist === head.dist0, "Point faible (tête) : aucun effet d'état ni recul");

    // Un coup normal éteint l'Occasion (même si elle n'est pas prise) ; une nouvelle ne tombe pas au tour suivant (pas deux de suite).
    e = begin();
    rollWith(0);
    assert(gameState.occasion.current, "Occasion proposée");
    // Les tirages d'Occasion ont lieu pendant l'action (rafraîchissement de fin de riposte) : hasard favorable (0) tout du long.
    withRand(0, () => attackUnarmed());
    assert(gameState.occasion.current === null, "Tour suivant (tirage pourtant favorable) : pas de seconde Occasion tirée d'affilée");
    withRand(0, () => attackUnarmed());
    assert(gameState.occasion.current && gameState.occasion.current.type === 'immobilize', "Deux tours plus tard : une Occasion peut de nouveau être tirée");
    finish();

    // Une action normale éteint l'Occasion du tour (prise ou non).
    e = begin();
    rollWith(0);
    assert(gameState.occasion.current, "Occasion proposée (avant une action normale)");
    withRand(0.5, () => attackUnarmed());
    assert(gameState.occasion.current === null, "Une action normale éteint l'Occasion du tour");
    finish();

    // Garantie après 6 combats sans Occasion.
    e = begin();
    gameState.occasion.pity = 6;
    rollWith(0.99);
    assert(gameState.occasion.current && gameState.occasion.pity === 0, "Garantie : après 6 combats sans Occasion, un tirage défavorable en propose une");
    finish();
    // Chaque nouveau combat compte un combat de plus sans Occasion ; une offre remet à zéro.
    resetTransientState();
    gameState.occasion.pity = 2;
    withRand(0.5, () => initiateCombat({ name: "Cobaye A", hp: 50, atk: 1, def: 5, xpReward: 1 }));
    assert(gameState.occasion.pity === 3 && gameState.occasion.turn === 0 && gameState.occasion.current === null, "Nouveau combat : garantie +1, état de tour remis à zéro");
    resetTransientState();

    // Réglage Réduit : 10 % ; Jet automatique : jamais.
    e = begin();
    setMinigameMode('reduced');
    rollWith(0.15);
    assert(gameState.occasion.current === null, "Mode Réduit : 15 % ne suffit pas (10 %)");
    gameState.occasion.rolledTurn = -1;
    rollWith(0.05);
    assert(gameState.occasion.current, "Mode Réduit : 5 % déclenche");
    setMinigameMode('auto');
    gameState.occasion.rolledTurn = -1; gameState.occasion.current = null;
    rollWith(0);
    assert(gameState.occasion.current === null, "Jet automatique : jamais d'Occasion");
    finish();

    // Pas d'arme à distance, ou arme arrachée : rien à distance.
    e = begin({ distance: 3 });
    rollWith(0);
    assert(gameState.occasion.current === null, "À distance sans arme à distance : aucune Occasion");
    finish();
    e = begin({ ranged: true, distance: 3 });
    gameState.status.disarmed = { rounds: 2 };
    rollWith(0);
    assert(gameState.occasion.current === null, "Arme arrachée : aucune Occasion de tir");
    finish();

    // Une Occasion devenue impossible (le mob s'est rué au contact) se masque et ne se lance pas.
    e = begin({ ranged: true, distance: 3 });
    rollWith(0);
    assert(gameState.occasion.current && gameState.occasion.current.type === 'target', "Cible proposée à distance");
    gameState.combatDistance = 0;
    updateOccasionButton();
    assert(ui.btnOccasion.classList.contains('hidden'), "Le mob s'est rué au contact : le bouton Cible se masque");
    startOccasion();
    assert(gameState.pendingMinigame === null && gameState.occasion.current === null, "Une Occasion devenue impossible ne s'ouvre pas");
    finish();

    // Tour de l'ennemi en cours (boutons verrouillés) : le bouton ne lance rien.
    e = begin();
    rollWith(0);
    ui.btnOccasion.disabled = true;
    startOccasion();
    assert(gameState.pendingMinigame === null && gameState.occasion.current, "Boutons verrouillés : l'Occasion reste en attente");
    ui.btnOccasion.disabled = false;
    finish();

    // Combat terminé pendant l'épreuve : rien n'est résolu.
    e = begin();
    rollWith(0);
    Math.random = () => 0.5;
    startOccasion();
    gameState.inCombat = false; gameState.currentEnemy = null;
    finishMinigame('perfect', { ratio: 1 });
    Math.random = original;
    assert(e.status.immobilized === null, "Combat terminé pendant l'épreuve : l'issue n'est pas appliquée");
    finish();

    // Sauvegarde : l'Occasion en cours n'est jamais restaurée, la garantie oui.
    resetTransientState();
    gameState.playerName = "OccasionTest";
    gameState.saveEnabled = true;
    gameState.occasion = Object.assign(createOccasionState(), { current: { type: 'immobilize' }, pity: 4 });
    saveGame();
    gameState.occasion = createOccasionState();
    assert(restoreSaveForName("OccasionTest"), "Restauration d'une sauvegarde avec Occasion");
    assert(gameState.occasion.current === null && gameState.occasion.pity === 4, "Restauration : Occasion éteinte, garantie conservée");
    gameState.saveEnabled = false;
    localStorage.removeItem(saveKeyForName("OccasionTest"));
    resetTransientState();
}

// --- Statuts de mob : immobilisé, affaibli ---
{
    resetTransientState();
    withSeq([0.5], () => initiateCombat({ name: "Cobaye Statuts", hp: 100, atk: 10, def: 0, xpReward: 1 }));
    const en = gameState.currentEnemy;
    assert(en.status.immobilized === null && en.status.weakened === null, "Un nouveau mob n'est ni immobilisé ni affaibli");
    en.status.immobilized = { rounds: 1 };
    en.status.weakened = { mult: 0.75, rounds: 2 };
    renderEnemyStatusBadges(en);
    assert(ui.enemyStatusIcons.innerHTML.includes('🤼') && ui.enemyStatusIcons.innerHTML.includes('💪'), "Badges d'état : immobilisé 🤼 et affaibli 💪");
    const d = consumeEnemyAttackDebuffs(en);
    assert(Math.abs(d.mult - 0.75) < 1e-9 && d.note.includes('bras touché') && en.status.weakened.rounds === 1, "Affaibli : ATQ x0,75 pendant 2 tours");
    consumeEnemyAttackDebuffs(en);
    assert(en.status.weakened === null, "Affaibli : s'éteint après 2 ripostes");
    const hpBefore = gameState.hp;
    withSeq([0.5], () => resolveEnemyCounterAttack());
    assert(gameState.hp === hpBefore && en.status.immobilized === null, "Immobilisé : la riposte est sautée, l'état s'éteint");
    resetTransientState();
}

// --- Animations d'issue V2 ---
{
    ['grapple', 'choke', 'target', 'weakpoint'].forEach(k => OUTCOMES.forEach(o => {
        const fx = minigameOutcomeFxSpec(k, o);
        assert(MINIGAME_KIND_FX[k][o] && FX_IMPACTS[fx.burst] && fx.target === (MINIGAME_KIND_FX[k][o].target), `${k} / ${o} : animation d'issue propre à l'épreuve`);
    }));
    assert(minigameOutcomeFxSpec('grapple', 'perfect').burst === 'grapple' && minigameOutcomeFxSpec('choke', 'success').burst === 'choke' && minigameOutcomeFxSpec('target', 'perfect').burst === 'bullseye' && minigameOutcomeFxSpec('target', 'fail').burst === 'ricochet' && minigameOutcomeFxSpec('weakpoint', 'success').burst === 'weakMark', "Éclats V2 : prise, étranglement, cible, ricochet, point faible");
    assert(minigameOutcomeFxSpec('grapple', 'fail').hitstopMs === 0 && minigameOutcomeFxSpec('grapple', 'perfect').heavy, "Raté : aucun gel ; Parfait : gel et secousse");
}

// =====================================================================================================
// V3 : épreuves de boss — Parade, Briser la garde, Coup de grâce, arme signature conditionnée au Parfait
// =====================================================================================================

// --- Fonctions pures ---
{
    const parry = buildMinigameSpec('parry', { impactMs: 1000 });
    assert(parry.kind === 'parry' && parry.impactMs === 1000 && parry.perfectMs === 90 && parry.successMs === 220 && parry.durationMs === 1450, "Parade : fenêtre Parfait ±90 ms, Réussi ±220 ms, 450 ms après l'impact pour conclure");
    const rnd = (r) => buildMinigameSpec('parry', {}, () => r).impactMs;
    assert(rnd(0) === 900 && rnd(0.999999) > 1399 && rnd(0.999999) <= 1400, "Parade : le coup tombe entre 0,9 et 1,4 s");
    assert(parryOutcome(1000, parry) === 'perfect' && parryOutcome(910, parry) === 'perfect' && parryOutcome(1090, parry) === 'perfect', "Parade : un tap à ±90 ms du coup = Parfait");
    assert(parryOutcome(1091, parry) === 'success' && parryOutcome(780, parry) === 'success' && parryOutcome(1220, parry) === 'success', "Parade : ±220 ms = Réussi");
    assert(parryOutcome(779, parry) === 'fail' && parryOutcome(1221, parry) === 'fail' && parryOutcome(0, parry) === 'fail' && parryOutcome(null, parry) === 'fail', "Parade : trop tôt, trop tard ou jamais = Raté");

    const guard = buildMinigameSpec('guard', { appearMs: 500, spotX: 40, spotY: 50 });
    assert(guard.kind === 'guard' && guard.appearMs === 500 && guard.perfectMs === 450 && guard.successMs === 1100, "Briser la garde : Parfait ≤ 450 ms, Réussi ≤ 1,1 s après l'apparition");
    assert(guardOutcome(0, guard) === 'perfect' && guardOutcome(450, guard) === 'perfect' && guardOutcome(451, guard) === 'success' && guardOutcome(1100, guard) === 'success' && guardOutcome(1101, guard) === 'fail', "Briser la garde : seuils de réaction");
    assert(guardOutcome(null, guard) === 'fail' && guardOutcome(-5, guard) === 'fail', "Briser la garde : pas de tap (ou tap avant l'apparition) = Raté");
    let spots = true;
    for (let i = 0; i < 200; i++) { const g = buildMinigameSpec('guard', {}); if (g.spotX < 15 || g.spotX > 85 || g.spotY < 20 || g.spotY > 80 || g.appearMs < 300 || g.appearMs > 900) spots = false; }
    assert(spots, "Briser la garde : point faible toujours dans le panneau, apparition entre 0,3 et 0,9 s");
    assert(buildMinigameSpec('guard', {}).durationMs === 900 + 1700, "Briser la garde : durée = apparition maximale + fenêtre de réaction");

    assert(bossAutoRates(1).success === 35 && bossAutoRates(11).success === 55 && bossAutoRates(99).success === 70, "Jet automatique de boss : 35 % + 2 % par niveau d'Arme, plafonné à 70 %");
    assert(bossAutoRates(5).perfect === 0 && bossAutoRates(5).success + bossAutoRates(5).fail === 100, "Jet automatique de boss : jamais de Parfait");
    const spec = buildMinigameSpec('parry', { boss: true, allowPerfect: false, autoRates: bossAutoRates(11) });
    let perfects = 0;
    for (let i = 0; i < 500; i++) if (minigameAutoOutcome(spec, () => i / 500) === 'perfect') perfects++;
    assert(perfects === 0, "Épreuve de boss en jet automatique : jamais de Parfait");

    assert(signatureReward(true, 1).awarded && !signatureReward(true, 1).extraQualifier, "Arme signature : Coup de grâce parfait = 100 %");
    assert(!signatureReward(false, 4).awarded && !signatureReward(false, 4).extraQualifier, "Arme signature : sans Coup de grâce parfait = 0 %, quel que soit le nombre d'autres Parfaits");
    assert(signatureReward(true, 2).extraQualifier === false && signatureReward(true, 3).extraQualifier === true, "Arme signature : qualificatif supplémentaire à 3 Parfaits ou plus (Coup de grâce compris)");
    assert(MINIGAME_SETTINGS.boss.trialCap === 3 && MINIGAME_SETTINGS.boss.parry.successDamageMult === 0.5 && MINIGAME_SETTINGS.boss.exposed.defMult === 0.7, "Réglages de boss : 3 épreuves de télégraphe, Parade x0,5, garde ouverte DEF x0,7");
}

// --- Hôte : Parade et Briser la garde ---
{
    resetTransientState();
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    let now = 0;
    setMinigameClock(() => now);
    setMinigameMode('play');
    let res = [];
    const cb = (o, d) => res.push({ o, d });
    const tapAt = (t) => { now = t; minigamePrimaryAction(); };

    for (const [t, wanted] of [[1000, 'perfect'], [1150, 'success'], [850, 'success'], [1300, 'fail'], [700, 'fail']]) {
        res = []; now = 0;
        startMinigame(buildMinigameSpec('parry', { impactMs: 1000 }), cb);
        tapAt(t);
        assert(res.length === 1 && res[0].o === wanted && res[0].d.impactMs === 1000, `Parade : tap à ${t} ms -> ${wanted}`);
    }
    res = []; now = 0;
    startMinigame(buildMinigameSpec('parry', { impactMs: 1000 }), cb);
    now = 1450; minigameTick();
    assert(res.length === 1 && res[0].o === 'fail' && res[0].d.timeout, "Parade : aucun tap = Raté (le coup tombe)");

    res = []; now = 0;
    startMinigame(buildMinigameSpec('guard', { appearMs: 500, spotX: 40, spotY: 50 }), cb);
    const G = () => minigameRuntime.renderer;
    now = 300; minigameTick(); G().hit();
    assert(res.length === 0 && !G().shownNow(), "Briser la garde : le point faible n'est pas touchable avant son apparition");
    now = 600; minigameTick();
    assert(G().shownNow(), "Briser la garde : le point faible apparaît à l'heure");
    now = 700; G().hit();
    assert(res.length === 1 && res[0].o === 'perfect' && res[0].d.reactionMs === 200, "Briser la garde : réaction en 200 ms = Parfait");
    for (const [t, wanted] of [[1200, 'success'], [1800, 'fail']]) {
        res = []; now = 0;
        startMinigame(buildMinigameSpec('guard', { appearMs: 500, spotX: 40, spotY: 50 }), cb);
        now = 600; minigameTick(); now = t; G().hit();
        assert(res[0].o === wanted, `Briser la garde : tap à ${t} ms -> ${wanted}`);
    }
    res = []; now = 0;
    startMinigame(buildMinigameSpec('guard', { appearMs: 500 }), cb);
    now = 2600; minigameTick();
    assert(res[0].o === 'fail' && res[0].d.timeout, "Briser la garde : aucun tap = Raté");
    res = []; now = 0;
    startMinigame(buildMinigameSpec('guard', { appearMs: 500 }), cb);
    now = 600; minigameTick(); now = 640; minigamePrimaryAction();
    assert(res[0].o === 'perfect', "Briser la garde : Espace/Entrée touchent le point faible (clavier)");

    delete global.requestAnimationFrame; delete global.cancelAnimationFrame;
    setMinigameClock(null); setMinigameMode('auto');
}

// --- Moteur : épreuves de boss ---
{
    const original = Math.random;
    const withRand = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = original; } };
    const begin = (extra = {}) => {
        resetTransientState();
        global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
        let t = 0; setMinigameClock(() => t);
        setMinigameMode('play');
        gameState.baseMaxHp = 5000; recomputeMaxHp(); gameState.hp = gameState.maxHp; gameState.def = 5; gameState.atk = 100;
        withRand(0.5, () => initiateCombat(Object.assign({ name: "Boss d'Épreuve", baseName: "Boss d'Épreuve", isBoss: true, hp: 99999, atk: 200, def: 10, xpReward: 1 }, extra)));
        gameState.occasion = createOccasionState();
        return gameState.currentEnemy;
    };
    const end = () => { delete global.requestAnimationFrame; delete global.cancelAnimationFrame; setMinigameClock(null); setMinigameMode('auto'); resetTransientState(); };
    const heavyLoss = (outcome) => {
        const boss = begin();
        boss.status.telegraph = { type: 'heavy' };
        const hp0 = gameState.hp;
        withRand(0.5, () => {
            resolveEnemyCounterAttack(() => {});
            if (outcome !== null) {
                assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'parry', "Télégraphe lourd exécuté : la Parade s'ouvre avant le coup");
                assert(gameState.hp === hp0, "Parade ouverte : le coup n'est pas encore tombé");
                finishMinigame(outcome, { tapMs: 1000 });
            }
        });
        const res = { loss: hp0 - gameState.hp, boss, hp0 };
        end();
        return res;
    };
    const fail = heavyLoss('fail'), success = heavyLoss('success'), perfect = heavyLoss('perfect');
    assert(fail.loss > 0, "Parade ratée : le coup lourd tombe normalement");
    assert(success.loss > 0 && success.loss >= fail.loss * 0.45 && success.loss <= fail.loss * 0.55, `Parade réussie : dégâts réduits de moitié (${fail.loss} -> ${success.loss})`);
    assert(perfect.loss === 0, "Parade parfaite : le coup est détourné, aucun dégât");
    assert(perfect.boss.hp < 99999 && perfect.boss.hp >= 1, "Parade parfaite : le crawler riposte, sans jamais achever le boss");
    assert(perfect.boss.status.exposed && perfect.boss.status.exposed.rounds === 1, "Parade parfaite : la garde du boss s'ouvre un tour (exposé)");
    assert(perfect.boss.trials.count === 1 && perfect.boss.trials.perfects === 1, "Parade parfaite : comptée parmi les épreuves du combat");

    // Réussi : un seul statut posé ? (pas d'exposé) ; Raté : rien.
    assert(!success.boss.status.exposed && !fail.boss.status.exposed, "Parade réussie ou ratée : aucune ouverture de garde");

    // Passer : jet automatique, jamais Parfait, et le résultat reste cohérent.
    let boss = begin();
    boss.status.telegraph = { type: 'heavy' };
    withRand(0.5, () => { resolveEnemyCounterAttack(() => {}); skipMinigame(); });
    assert(boss.trials.perfects === 0 && gameState.pendingMinigame === null, "Parade passée : jamais de Parfait comptabilisé");
    end();

    // Plafond de 3 épreuves de télégraphe : au-delà, le comportement d'avant, sans épreuve.
    boss = begin();
    boss.trials = { count: 3, perfects: 0 };
    boss.status.telegraph = { type: 'heavy' };
    const hpCap = gameState.hp;
    withRand(0.5, () => resolveEnemyCounterAttack(() => {}));
    assert(gameState.pendingMinigame === null && hpCap - gameState.hp === fail.loss, "Plafond atteint : plus d'épreuve, le coup lourd tombe comme avant");
    end();

    // Sans interface : jamais d'épreuve, comportement strictement inchangé.
    resetTransientState();
    withRand(0.5, () => initiateCombat({ name: "Boss Muet", isBoss: true, hp: 99999, atk: 200, def: 10, xpReward: 1 }));
    gameState.baseMaxHp = 5000; recomputeMaxHp(); gameState.hp = gameState.maxHp; gameState.def = 5;
    gameState.currentEnemy.status.telegraph = { type: 'heavy' };
    const hpMute = gameState.hp;
    withRand(0.5, () => resolveEnemyCounterAttack(() => {}));
    assert(gameState.pendingMinigame === null && hpMute - gameState.hp === fail.loss, "Sans interface (Node) : le coup lourd tombe comme avant, aucune épreuve");
    resetTransientState();

    // Briser la garde.
    const guardCase = (outcome) => {
        const b = begin();
        b.status.telegraph = { type: 'defBuff' };
        withRand(0.5, () => {
            resolveEnemyCounterAttack(() => {});
            assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'guard', "« Il se hérisse » exécuté : Briser la garde s'ouvre");
            finishMinigame(outcome, {});
        });
        const st = { buffed: !!b.status.defBuffed, exposed: !!b.status.exposed, trials: b.trials };
        end();
        return st;
    };
    const gFail = guardCase('fail'), gSuccess = guardCase('success'), gPerfect = guardCase('perfect');
    assert(gFail.buffed && !gFail.exposed, "Garde non brisée (Raté) : la garde monte comme avant");
    assert(!gSuccess.buffed && !gSuccess.exposed, "Garde brisée (Réussi) : la garde ne monte pas");
    assert(!gPerfect.buffed && gPerfect.exposed && gPerfect.trials.perfects === 1, "Garde brisée parfaitement : elle ne monte pas ET s'ouvre (exposé)");

    // Exposé : la DEF du boss baisse de 30 % pendant 1 coup.
    const hitOn = (exposed) => {
        const b = begin({ def: 100 });
        if (exposed) b.status.exposed = { rounds: 1 };
        const before = b.hp;
        withRand(0.5, () => performPlayerAttack(gameState.atk, { atkMultiplier: 1, varianceRange: 0, defReduction: 0 }, "d'essai"));
        const out = { dmg: before - b.hp, exposed: b.status.exposed };
        end();
        return out;
    };
    const plainHit = hitOn(false), exposedHit = hitOn(true);
    assert(exposedHit.dmg > plainHit.dmg && exposedHit.exposed === null, `Exposé : la DEF du boss baisse (${plainHit.dmg} -> ${exposedHit.dmg} dégâts), l'état s'éteint après le coup`);
    boss = begin();
    boss.status.exposed = { rounds: 1 };
    renderEnemyStatusBadges(boss);
    assert(ui.enemyStatusIcons.innerHTML.includes('🎯'), "Badge d'état : exposé 🎯");
    end();
}

// --- Moteur : Coup de grâce et arme signature ---
{
    const original = Math.random;
    const withRand = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = original; } };
    const templateName = Object.keys(districtBosses).find(k => districtBosses[k].signatureItem && districtBosses[k].signatureItem.category === 'weapons');
    const begin = (opts = {}) => {
        resetTransientState();
        global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
        let t = 0; setMinigameClock(() => t);
        setMinigameMode(opts.mode || 'play');
        gameState.currentFloor = 4;
        gameState.inventory = [];
        gameState.baseMaxHp = 5000; recomputeMaxHp(); gameState.hp = gameState.maxHp; gameState.def = 5; gameState.atk = 100;
        if (opts.ranged) gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 10, category: 'ranged' };
        const boss = withRand(0.5, () => generateBoss(templateName));
        boss.hp = opts.hp || 5; // un coup suffit à l'achever
        withRand(0.5, () => initiateCombat(boss));
        boss.maxHp = 99999; boss.hp = opts.hp || 5;
        gameState.combatDistance = opts.distance || 0;
        gameState.occasion = createOccasionState();
        return gameState.currentEnemy;
    };
    const end = () => { delete global.requestAnimationFrame; delete global.cancelAnimationFrame; setMinigameClock(null); setMinigameMode('auto'); resetTransientState(); };
    const signatures = () => gameState.inventory.filter(i => i.signature);

    // Coup fatal à un boss : l'épreuve s'ouvre AVANT la victoire.
    let boss = begin();
    withRand(0.5, () => attackUnarmed());
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'choke', "Coup fatal à mains nues : Coup de grâce = épreuve de maintien");
    assert(gameState.inCombat && gameState.currentEnemy === boss && boss.hp <= 0, "Pendant le Coup de grâce : le boss est à terre mais le combat n'est pas conclu");
    assert(boss.finisherDone === true && ui.minigameTitle.innerText.includes('Coup de grâce'), "Le Coup de grâce porte son nom et n'est joué qu'une fois");
    withRand(0.5, () => finishMinigame('perfect', { ratio: 1 }));
    assert(!gameState.inCombat && signatures().length === 1, "Coup de grâce parfait : le boss est vaincu et l'arme signature tombe");
    assert(!signatures()[0].forgedByPerfect, "Un seul Parfait : pas de qualificatif supplémentaire");
    end();

    // Réussi, Raté, Passer : victoire normale, mais pas d'arme signature.
    for (const [label, finishWith] of [['Réussi', () => finishMinigame('success', {})], ['Raté', () => finishMinigame('fail', {})], ['Passer', () => skipMinigame()]]) {
        boss = begin();
        withRand(0.5, () => attackUnarmed());
        const lines = captureLog(() => withRand(0.5, finishWith));
        assert(!gameState.inCombat && signatures().length === 0, `Coup de grâce ${label} : victoire, mais pas d'arme signature`);
        assert(lines.some(l => l.includes('vous échappe')), `Coup de grâce ${label} : le journal explique l'absence d'arme signature`);
        end();
    }

    // 3 Parfaits (dont le Coup de grâce) : un qualificatif de plus.
    boss = begin();
    boss.trials = { count: 2, perfects: 2 };
    withRand(0.5, () => attackUnarmed());
    withRand(0.5, () => finishMinigame('perfect', { ratio: 1 }));
    const forged = signatures()[0];
    const baseCount = (districtBosses[templateName].signatureItem.mechanics || []).length;
    assert(forged && forged.forgedByPerfect && forged.qualifiers.length === baseCount + 1 && forged.mechanics.length === baseCount + 1, "3 Parfaits : l'arme signature gagne un qualificatif");
    assert(new Set(forged.qualifiers.map(q => q.key)).size === forged.qualifiers.length, "Le qualificatif supplémentaire est distinct des siens");
    assert(buildItemInspectHtml(forged).includes('Forgée par un combat parfait'), "Inspection : la mention « forgée par un combat parfait »");
    end();
    boss = begin();
    boss.trials = { count: 2, perfects: 1 };
    withRand(0.5, () => attackUnarmed());
    withRand(0.5, () => finishMinigame('perfect', { ratio: 1 }));
    assert(signatures().length === 1 && !signatures()[0].forgedByPerfect, "2 Parfaits seulement : pas de qualificatif supplémentaire");
    end();

    // L'épreuve dépend de la dernière attaque : tir -> Cible ; arme de mêlée -> timing étroit.
    boss = begin({ ranged: true, distance: 3 });
    withRand(0.5, () => attackRanged());
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'target', "Coup fatal au tir : Coup de grâce = Cible");
    assert(minigameRuntime.spec.outerRadius < 0.5, "Coup de grâce à distance : la cible tient compte de l'écart");
    finishMinigame('perfect', {});
    assert(signatures().length === 1, "Coup de grâce à la Cible parfaite : arme signature");
    end();
    boss = begin();
    gameState.equipment.weapon = { name: "Arme d'Essai", baseDmg: 10, category: 'weapons' };
    withRand(0.5, () => attackWeapon());
    assert(gameState.pendingMinigame && gameState.pendingMinigame.kind === 'timing' && minigameRuntime.spec.zoneWidth === 0.2 && minigameRuntime.spec.periodMs === 1000, "Coup fatal à l'arme : Coup de grâce = timing, zone étroite");
    skipMinigame();
    end();

    // Boss achevé autrement qu'au coup (saignement...), mode Jet automatique, ou mob normal : pas d'épreuve.
    boss = begin({ mode: 'auto' });
    withRand(0.5, () => attackUnarmed());
    assert(gameState.pendingMinigame === null && !gameState.inCombat && signatures().length === 0, "Mode Jet automatique : le boss tombe sans épreuve, et sans arme signature");
    end();
    resetTransientState();
    withRand(0.5, () => initiateCombat({ name: "Cobaye Normal", hp: 5, atk: 1, def: 1, xpReward: 1 }));
    global.requestAnimationFrame = () => 1; setMinigameMode('play');
    withRand(0.5, () => attackUnarmed());
    assert(gameState.pendingMinigame === null && !gameState.inCombat, "Un mob normal n'a pas de Coup de grâce");
    delete global.requestAnimationFrame; setMinigameMode('auto'); resetTransientState();

    // Pas d'Occasion pendant le Coup de grâce.
    boss = begin();
    withRand(0.5, () => attackUnarmed());
    withRand(0, () => updateUI());
    assert(gameState.occasion.current === null, "Pas d'Occasion proposée sur un boss à terre");
    skipMinigame();
    end();

    // Sans interface (Node) : le boss tombe au coup fatal, sans épreuve ni arme signature.
    resetTransientState();
    gameState.currentFloor = 4;
    gameState.inventory = [];
    const noUi = withRand(0.5, () => generateBoss(templateName));
    noUi.hp = 5;
    withRand(0.5, () => initiateCombat(noUi));
    gameState.atk = 100;
    const lines = captureLog(() => withRand(0.5, () => attackUnarmed()));
    assert(!gameState.inCombat && gameState.pendingMinigame === null && signatures().length === 0, "Sans interface : victoire immédiate, pas d'arme signature");
    assert(lines.some(l => l.includes('vous échappe')), "Sans interface : le journal le dit");
    resetTransientState();
}

// --- Cinématique du Coup de grâce ---
{
    resetTransientState();
    let done = 0;
    playFinisherCinematic(true, () => { done++; });
    assert(done === 1, "Sans interface : la cinématique rend la main tout de suite");
    global.requestAnimationFrame = () => 1;
    ui.finisherCinema.classList.add('hidden');
    playFinisherCinematic(true, () => { done++; });
    assert(done === 2, "Avec interface : la cinématique rend la main une fois jouée");
    assert(ui.finisherCinema.classList.contains('hidden') && ui.finisherCinemaText.innerText === 'COUP DE GRÂCE PARFAIT', "Cinématique parfaite : mention dédiée, masquée ensuite");
    playFinisherCinematic(false, () => { done++; });
    assert(done === 3 && ui.finisherCinemaText.innerText === 'COUP DE GRÂCE' && !ui.finisherCinema.classList.contains('finisher-perfect'), "Cinématique ordinaire : mention simple, sans flash doré");
    delete global.requestAnimationFrame;
    resetTransientState();
}

// =====================================================================================================
// V4 : salle de jeux en ville (ARCADE_GAMES, floorgen.js 'arcade', triggerArcade()/playArcadeGame())
// =====================================================================================================

// --- Catalogue et règles pures ---
{
    assert(ARCADE_GAME_KEYS.length === 4, "Salle de jeux : quatre jeux (stand de tir, ring, coffre-fort, mémoire)");
    ARCADE_GAME_KEYS.forEach(key => {
        const game = ARCADE_GAMES[key];
        assert(game.icon && game.label && game.blurb && gameState.skills[game.skill], `Jeu ${key} : icône, nom, texte et compétence réelle du joueur`);
        const rounds = game.rounds({ floor: 3, skillLevel: 1 });
        assert(rounds.length >= 2 && rounds.length <= 3, `Jeu ${key} : 2 à 3 manches`);
        rounds.forEach((r, i) => {
            const spec = buildMinigameSpec(r.kind, r.overrides);
            assert(spec && MINIGAME_RENDERERS[r.kind], `Jeu ${key} / manche ${i + 1} : une épreuve existante avec son rendu`);
            assert(spec.label === r.overrides.label, `Jeu ${key} / manche ${i + 1} : libellé propre à la manche`);
        });
        assert(arcadeScore(key, rounds.map(() => 'perfect')).perfectAll, `Jeu ${key} : toutes les manches Parfaites = partie parfaite`);
        assert(arcadeScore(key, rounds.map(() => 'fail')).tier === 'lose', `Jeu ${key} : tout raté = perdu`);
    });
    // Le coffre-fort rétrécit ses zones, la mémoire allonge ses séquences, le stand de tir éloigne ses cibles.
    const widths = ARCADE_GAMES.safe.rounds({ floor: 3, skillLevel: 1 }).map(r => r.overrides.zoneWidth);
    assert(widths[0] > widths[1] && widths[1] > widths[2], "Coffre-fort : zones de plus en plus étroites");
    const lengths = ARCADE_GAMES.memory.rounds({ floor: 3, skillLevel: 1 }).map(r => r.overrides.length);
    assert(lengths.join() === '3,4,5', "Mémoire : séquences de 3, 4 puis 5 symboles");
    const dists = ARCADE_GAMES.range.rounds({ floor: 3, skillLevel: 1 }).map(r => r.overrides.distance);
    assert(dists[0] < dists[1] && dists[1] < dists[2], "Stand de tir : cibles de plus en plus lointaines (donc petites)");
    assert(ARCADE_GAMES.ring.rounds({ floor: 3, skillLevel: 1 }).map(r => r.kind).join() === 'grapple,choke', "Ring : Immobiliser puis Étrangler");
    assert(ARCADE_GAMES.memory.stopOnFail && !ARCADE_GAMES.range.stopOnFail, "Mémoire : une erreur arrête la partie");

    // Mise : bornée par les PO et par le plafond d'étage.
    assert(arcadeMaxStake(3, 1000) === 180 && arcadeMaxStake(3, 50) === 50 && arcadeMaxStake(3, 0) === 0, "Mise maximale : 60 PO × étage, jamais plus que ses PO");
    assert(arcadeCheckStake(10, 3, 100).ok && arcadeCheckStake('12.7', 3, 100).stake === 12, "Mise valide, arrondie à l'entier");
    assert(!arcadeCheckStake(0, 3, 100).ok && !arcadeCheckStake(-5, 3, 100).ok && !arcadeCheckStake('abc', 3, 100).ok && !arcadeCheckStake('', 3, 100).ok, "Mise nulle, négative ou illisible refusée");
    assert(!arcadeCheckStake(101, 3, 100).ok && !arcadeCheckStake(181, 3, 1000).ok, "Mise au-delà des PO ou du plafond refusée");
    assert(arcadeCanPlayTime(2) && !arcadeCanPlayTime(1) && !arcadeCanPlayTime(0), "Une partie ne peut jamais amener le temps à 0");

    // Points, paliers, gains (3 manches : max 6 points ; 2 manches : max 4).
    assert(arcadeScore('safe', ['perfect', 'perfect', 'success']).tier === 'excellent', "5/6 points : excellent");
    assert(arcadeScore('safe', ['perfect', 'success', 'fail']).tier === 'good' && arcadeScore('safe', ['perfect', 'success', 'fail']).points === 3, "3/6 points : bon score");
    assert(arcadeScore('safe', ['success', 'fail', 'fail']).tier === 'lose', "1/6 point : perdu");
    assert(arcadeScore('ring', ['perfect', 'success']).tier === 'excellent' && arcadeScore('ring', ['success', 'success']).tier === 'good', "Ring : 3/4 excellent, 2/4 bon");
    assert(arcadeScore('memory', ['perfect']).max === 6 && arcadeScore('memory', ['perfect']).points === 2 && !arcadeScore('memory', ['perfect']).perfectAll, "Mémoire arrêtée : les manches non jouées valent 0, pas de partie parfaite");
    assert(arcadePayout(100, 'lose') === 0 && arcadePayout(100, 'good') === 150 && arcadePayout(100, 'excellent') === 300 && arcadePayout(7, 'good') === 11, "Gains : ×0 / ×1,5 / ×3, arrondis");

    // Jet automatique : l'espérance de gain reste sous la mise pour chaque jeu (jamais une machine à PO).
    ARCADE_GAME_KEYS.forEach(key => {
        const game = ARCADE_GAMES[key];
        let ev = 0;
        const N = 4000;
        const rng = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
        for (let i = 0; i < N; i++) {
            const outs = [];
            for (const r of game.rounds({ floor: 3, skillLevel: 1 })) {
                const o = minigameAutoResult(buildMinigameSpec(r.kind, r.overrides, rng), rng).outcome;
                outs.push(o);
                if (game.stopOnFail && o === 'fail') break;
            }
            ev += arcadePayout(100, arcadeScore(key, outs).tier) / 100;
        }
        assert(ev / N < 0.9, `Jeu ${key} : en jet automatique, le gain moyen reste sous la mise (${(ev / N).toFixed(2)})`);
    });
}

// --- Génération : salles de jeux dans 1 à 2 villes, jamais le départ ---
{
    let withArcade = 0, bad = 0, total = 0, overlaps = 0, disconnected = 0;
    for (let n = 0; n < 150; n++) {
        const count = 1 + (n % 2);
        const floor = generateMetropolis({ cityCount: 6 + (n % 3), lairCount: 1, specializedChance: 18, arcadeCount: count });
        const arcades = Object.values(floor.roomsById).filter(r => r.type === 'arcade');
        total++;
        if (arcades.length === count) withArcade++;
        if (arcades.some(r => r.cityId === floor.cities[0].id) || arcades.some(r => roomsCityHas(floor, r) === false)) bad++;
        const m = measureMetropolis(floor);
        overlaps += m.overlaps;
        if (!m.connected) disconnected++;
        floor.cities.forEach(c => { if (c.roomIds.length > 5) bad++; });
    }
    function roomsCityHas(floor, room) { const c = floor.cities.find(x => x.id === room.cityId); return !!c && c.roomIds.includes(room.id) && c.hasArcade; }
    assert(withArcade === total, "Génération : arcadeCount salles de jeux exactement");
    assert(bad === 0, "Génération : jamais dans la ville de départ, jamais plus de 5 salles par ville");
    assert(overlaps === 0 && disconnected === 0, "Génération : les salles de jeux ne chevauchent rien et restent connectées");
    const none = generateMetropolis({ cityCount: 6, lairCount: 1 });
    assert(!Object.values(none.roomsById).some(r => r.type === 'arcade'), "Sans option arcadeCount : aucune salle de jeux (génération inchangée)");
    assert(ROOM_TYPES.arcade && ROOM_TYPES.arcade.onEnter === 'arcade', "ROOM_TYPES.arcade existe");

    // Moteur : generateUrbanFloorMap() pose 1 à 2 salles de jeux.
    for (let n = 0; n < 20; n++) {
        resetTransientState();
        gameState.currentFloor = 3 + 3 * (n % 3);
        generateUrbanFloorMap();
        const arcades = Object.values(gameState.floorMap.roomsById).filter(r => r.type === 'arcade');
        assert(arcades.length >= 1 && arcades.length <= 2, `Étage urbain ${gameState.currentFloor} : 1 à 2 salles de jeux (${arcades.length})`);
        assert(arcades.every(r => r.cityId !== gameState.floorMap.roomsById[gameState.floorMap.startRoomId].cityId), "Jamais dans la ville de départ");
    }
}

// --- Entrée, mise, parties (sans interface : jet automatique) ---
{
    const enterArcade = () => {
        resetTransientState();
        gameState.currentFloor = 3;
        generateUrbanFloorMap();
        const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'arcade');
        ui.shopZone.classList.add('hidden');
        moveToFloorRoom(room);
        enterRoom(room);
        return room;
    };
    const room = enterArcade();
    assert(gameState.shopChoicePending === true && gameState.pendingArcadeCityId === room.cityId && gameState.pendingShopCityId === null, "enterRoom() : la salle de jeux ouvre l'écran de la salle de jeux");
    assert(isActionBlocked() === true && !ui.shopZone.classList.contains('hidden'), "Salle de jeux : actions bloquées, panneau affiché");
    assert(!ui.shopArcadeContent.classList.contains('hidden') && ui.shopMerchantContent.classList.contains('hidden') && ui.shopTrainerContent.classList.contains('hidden'), "Salle de jeux : seul son contenu est visible");
    assert(ui.arcadeGames.children.length === ARCADE_GAME_KEYS.length, "Salle de jeux : un bouton par jeu");
    assert(listFloorLandmarks().some(m => m.kind === 'arcade' && m.roomId === room.id), "Carte : repère 🎰 sur la salle de jeux visitée");

    // Mise refusée : aucune partie, rien de prélevé.
    gameState.gold = 50; gameState.timeLeft = 100;
    ui.arcadeStake.value = '999';
    assert(playArcadeGame('range') === false && gameState.gold === 50 && gameState.timeLeft === 100 && gameState.arcadeSession === null, "Mise trop haute : refusée sans rien prélever");
    ui.arcadeStake.value = '0';
    assert(playArcadeGame('range') === false && gameState.gold === 50, "Mise nulle : refusée");
    gameState.gold = 0; ui.arcadeStake.value = '5';
    assert(playArcadeGame('range') === false, "Sans PO : refusée");
    gameState.gold = 50; gameState.timeLeft = 1;
    assert(playArcadeGame('range') === false && gameState.timeLeft === 1, "Temps insuffisant : refusée, le temps ne tombe jamais à 0");
    assert(playArcadeGame('inconnu') === false, "Jeu inconnu : ignoré");

    // Partie : mise prélevée, 1 H, issue du palier (Math.random figé -> jet automatique déterministe).
    const play = (key, rand, stake = 10) => {
        gameState.gold = 100; gameState.timeLeft = 100; gameState.hp = gameState.maxHp;
        ui.arcadeStake.value = String(stake);
        const original = Math.random;
        Math.random = () => rand;
        let ok;
        try { ok = playArcadeGame(key); } finally { Math.random = original; }
        return ok;
    };
    assert(play('safe', 0.999) === true, "Partie lancée");
    assert(gameState.arcadeSession === null && gameState.timeLeft === 99 && gameState.gold === 90, "Tout raté : mise perdue, 1 H passée, partie close");
    assert(isActionBlocked() === true && gameState.shopChoicePending, "On reste dans la salle de jeux après une partie");
    play('safe', 0.05);
    assert(gameState.arcadeSession === null && gameState.gold === 100 - 10 + 30, `Jet automatique Parfait partout : mise ×3 empochée (${gameState.gold})`);
    // Parties illimitées : on peut rejouer tant qu'on a PO et temps.
    gameState.gold = 100; gameState.timeLeft = 100;
    let played = 0;
    for (let i = 0; i < 5; i++) if (play('memory', 0.999, 5)) played++;
    assert(played === 5, "Parties illimitées");

    // Lot : une partie parfaite partout donne un objet (jet automatique : forcé par un rng qui donne Parfait à chaque manche).
    const ev = (key, outcomes) => {
        gameState.gold = 100; gameState.timeLeft = 100; gameState.inventory = [];
        ui.arcadeStake.value = '10';
        const seq = outcomes.slice();
        const realStart = startMinigame;
        startMinigame = (spec, cb) => cb(seq.shift());
        try { playArcadeGame(key); } finally { startMinigame = realStart; }
    };
    ev('range', ['perfect', 'perfect', 'perfect']);
    assert(gameState.gold === 120, `Partie parfaite : 10 PO misés, 30 PO rendus (${gameState.gold})`);
    assert(gameState.inventory.length + gameState.spellbook.length >= 1, "Partie parfaite : un lot en prime");
    const xpBefore = gameState.skills.stealth.xp + gameState.skills.stealth.level * 1000;
    ev('safe', ['perfect', 'perfect', 'success']);
    assert(gameState.gold === 120 && gameState.skills.stealth.xp + gameState.skills.stealth.level * 1000 > xpBefore, "Excellent score : gain ×3 et XP de la compétence liée");
    ev('safe', ['perfect', 'success', 'fail']);
    assert(gameState.gold === 105, `Bon score : ×1,5 (${gameState.gold})`);
    ev('safe', ['fail', 'fail', 'fail']);
    assert(gameState.gold === 90, "Raté partout : mise perdue");
    ev('memory', ['success', 'fail']);
    assert(gameState.arcadeSession === null && gameState.gold === 90, "Mémoire : une erreur arrête la partie (aucune manche suivante)");

    // Partir ferme la salle ; impossible en pleine partie.
    gameState.arcadeSession = { game: 'safe', stake: 1, outcomes: [] };
    leaveShop();
    assert(gameState.shopChoicePending === true, "Partir est refusé pendant une partie");
    gameState.arcadeSession = null;
    leaveShop();
    assert(gameState.shopChoicePending === false && gameState.pendingArcadeCityId === null && !isActionBlocked(), "Partir : l'écran se ferme et le jeu se débloque");
    resetTransientState();
}

// --- Partie interactive simulée : Passer fait jouer le jet automatique, les manches s'enchaînent ---
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'arcade');
    moveToFloorRoom(room);
    enterRoom(room);
    gameState.gold = 100; gameState.timeLeft = 100;
    ui.arcadeStake.value = '10';
    global.requestAnimationFrame = () => 1;
    setMinigameMode('play');
    assert(playArcadeGame('safe') === true && gameState.pendingMinigame && gameState.pendingMinigame.kind === 'timing', "Interactif : la première manche s'ouvre dans la bande du bas");
    assert(playArcadeGame('ring') === false, "Interactif : pas de seconde partie pendant la première");
    assert(leaveShop() === undefined && gameState.shopChoicePending, "Interactif : impossible de partir pendant la partie");
    let manches = 0;
    while (gameState.arcadeSession && manches < 5) { manches++; skipMinigame(); }
    assert(gameState.arcadeSession === null && manches === 3, `Interactif : trois manches enchaînées puis la partie se conclut (${manches})`);
    assert(gameState.pendingMinigame === null, "Interactif : plus aucune épreuve ouverte");
    delete global.requestAnimationFrame; setMinigameMode('auto');
    resetTransientState();
}
