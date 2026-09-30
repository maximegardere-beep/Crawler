// minigames-ui.js - Hôte des mini-jeux (chantier 6, lot 0) : ouvre une épreuve dans la bande du bas de
// l'écran, gère minuterie / pause / skip / clavier, et rend l'issue (animation, bannière, haptique, une ligne
// de journal). La logique pure (issues, jet automatique, animations) est dans minigames.js.
//
// Un seul point d'entrée côté jeu : startMinigame(spec, onResult) — par CALLBACK (jamais de Promise/async, comme
// runCombatBeats(), pour rester synchrone sous les tests Node). Sans interface interactive (réglage « Jet
// automatique », prefers-reduced-motion par défaut, tests Node sans requestAnimationFrame), l'épreuve est résolue
// tout de suite par le jet automatique : onResult est alors appelé avant le retour de startMinigame().
// Pendant une épreuve ouverte : gameState.pendingMinigame (bloque les actions, voir isActionBlocked()), les
// boutons de combat sont verrouillés, Échap = Passer (jet automatique), Espace/Entrée = geste principal.

const MINIGAME_MODE_KEY = 'crawler_minigame_mode';
const MINIGAME_HINTS_KEY = 'crawler_minigame_hints';

let minigameMode = null;       // résolu à la première lecture (préférence d'affichage, jamais sauvegardée avec le crawler)
let minigameRuntime = null;    // épreuve ouverte : { spec, onResult, renderer, startedAt, pausedMs, hiddenAt, rafId, lockedByHost }
let minigameClock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
let minigameBannerTimer = null;

// Horloge injectable (tests) : les épreuves minutées se rejouent ainsi à l'instant exact voulu.
function setMinigameClock(fn) { minigameClock = fn || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())); }

// --- Réglage Jouer / Réduit / Jet automatique ---------------------------------------------------------------------
function minigameDefaultMode() {
    if (typeof requestAnimationFrame !== 'function') return 'auto'; // tests Node, simulation longue
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
    return 'play';
}

function getMinigameMode() {
    if (minigameMode) return minigameMode;
    let stored = null;
    try { stored = localStorage.getItem(MINIGAME_MODE_KEY); } catch (e) { /* stockage indisponible : réglage par défaut */ }
    minigameMode = normalizeMinigameMode(stored) || minigameDefaultMode();
    return minigameMode;
}

function setMinigameMode(mode) {
    const m = normalizeMinigameMode(mode);
    if (!m) return;
    minigameMode = m;
    try { localStorage.setItem(MINIGAME_MODE_KEY, m); } catch (e) { /* idem */ }
    if (typeof ui !== 'undefined' && ui.minigameModeSelect) ui.minigameModeSelect.value = m;
}

// Vrai si une épreuve s'affichera réellement (sinon : jet automatique immédiat).
function minigameIsInteractive() {
    return getMinigameMode() !== 'auto' && typeof requestAnimationFrame === 'function' && !!(ui && ui.minigameStrip && ui.minigameBody);
}

// Chance d'Occasion de combat par tour (V2), selon le réglage courant.
function minigameOccasionChance() {
    return MINIGAME_SETTINGS.occasionChancePct[getMinigameMode()] || 0;
}

// Indice « consigne » : affiché la première fois qu'une épreuve se joue, puis retenu.
function minigameHintSeen(kind) {
    try { return (JSON.parse(localStorage.getItem(MINIGAME_HINTS_KEY) || '[]')).includes(kind); } catch (e) { return false; }
}
function markMinigameHintSeen(kind) {
    try {
        const seen = JSON.parse(localStorage.getItem(MINIGAME_HINTS_KEY) || '[]');
        if (!seen.includes(kind)) localStorage.setItem(MINIGAME_HINTS_KEY, JSON.stringify(seen.concat(kind)));
    } catch (e) { /* idem */ }
}

// --- Rendus par épreuve -----------------------------------------------------------------------------------------
// `mount(root, spec, api)` construit l'interface dans `root` et renvoie { primary(), update(elapsedMs), destroy() }.
// `api` : { finish(outcome, detail), elapsed() }. Toute cible tactile fait au moins 44 px.
const MINIGAME_RENDERERS = {
    timing: {
        mount(root, spec, api) {
            const pct = v => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`;
            const mk = (cls) => { const el = document.createElement('div'); el.className = cls; return el; };
            const bar = mk('relative h-11 rounded bg-gray-900 border border-gray-700 overflow-hidden');
            const half = spec.zoneWidth / 2;
            const zone = mk('absolute top-0 bottom-0 bg-emerald-700/50 border-x border-emerald-400');
            zone.style.left = pct(spec.zoneCenter - half);
            zone.style.width = pct(spec.zoneWidth);
            const core = mk('absolute top-0 bottom-0 bg-yellow-400/60');
            core.style.left = pct(spec.zoneCenter - half * spec.perfectRatio);
            core.style.width = pct(spec.zoneWidth * spec.perfectRatio);
            const cursor = mk('absolute top-0 bottom-0 w-1.5 -ml-0.5 bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]');
            bar.appendChild(zone); bar.appendChild(core); bar.appendChild(cursor);
            const btn = document.createElement('button');
            btn.className = 'mt-2 w-full min-h-[48px] rounded border border-amber-500 bg-amber-900/40 text-amber-200 text-sm font-bold uppercase tracking-widest';
            btn.textContent = 'Stop';
            const position = () => timingCursorPosition(api.elapsed(), spec.periodMs);
            const stop = () => { const pos = position(); api.finish(resolveTimingStop(pos, spec), { position: pos }); };
            btn.addEventListener('pointerdown', e => { if (e && e.preventDefault) e.preventDefault(); stop(); });
            btn.addEventListener('click', stop); // clavier / lecteur d'écran ; sans effet si pointerdown a déjà conclu
            root.appendChild(bar); root.appendChild(btn);
            return {
                primary: stop,
                update() { cursor.style.left = pct(position()); },
                destroy() { /* le hôte vide `root` */ }
            };
        }
    }
};

// --- Cycle de vie -----------------------------------------------------------------------------------------------
function minigameElapsed() {
    if (!minigameRuntime) return 0;
    return Math.max(0, minigameClock() - minigameRuntime.startedAt - minigameRuntime.pausedMs);
}

function startMinigame(specOrKind, onResult) {
    const spec = typeof specOrKind === 'string' ? buildMinigameSpec(specOrKind) : specOrKind;
    if (!spec) { if (onResult) onResult('fail', { auto: true, invalid: true }); return; }
    const renderer = MINIGAME_RENDERERS[spec.kind];
    // Jet automatique : réglage, pas d'interface (Node), épreuve sans rendu, ou une autre épreuve déjà ouverte.
    if (minigameRuntime || !renderer || !minigameIsInteractive()) {
        settleMinigame(spec, minigameAutoOutcome(spec), { auto: true }, onResult);
        return;
    }

    const rt = { spec, onResult, renderer: null, startedAt: minigameClock(), pausedMs: 0, hiddenAt: 0, rafId: null, lockedByHost: false };
    minigameRuntime = rt;
    gameState.pendingMinigame = { kind: spec.kind, boss: !!spec.boss };
    // Les boutons de combat restent inertes tant que l'épreuve est ouverte (sauf s'ils le sont déjà : beat de riposte).
    if (gameState.inCombat && ui.btnAttackWeapon && !ui.btnAttackWeapon.disabled) { setCombatInputLocked(true); rt.lockedByHost = true; }

    ui.minigameStrip.classList.toggle('in-combat', !!gameState.inCombat);
    ui.minigameTitle.innerText = `${spec.icon} ${spec.label}`;
    const showHint = !minigameHintSeen(spec.kind);
    ui.minigameHint.innerText = showHint ? spec.hint : '';
    ui.minigameHint.classList.toggle('hidden', !showHint);
    if (showHint) markMinigameHintSeen(spec.kind);
    ui.minigameTimerBar.style.width = '100%';
    ui.minigameBody.innerHTML = '';
    ui.minigameStrip.classList.remove('hidden');

    rt.renderer = renderer.mount(ui.minigameBody, spec, { finish: finishMinigame, elapsed: minigameElapsed });
    minigameTick();
}

// Une image : met à jour curseur et jauge de temps, conclut par « Raté » si le temps est écoulé.
function minigameTick() {
    const rt = minigameRuntime;
    if (!rt) return;
    const el = minigameElapsed();
    if (el >= rt.spec.durationMs) { finishMinigame('fail', { timeout: true }); return; }
    ui.minigameTimerBar.style.width = `${((1 - el / rt.spec.durationMs) * 100).toFixed(1)}%`;
    if (rt.renderer && rt.renderer.update) rt.renderer.update(el);
    rt.rafId = requestAnimationFrame(minigameTick);
}

// Geste principal (Espace / Entrée) : délégué au rendu de l'épreuve ouverte.
function minigamePrimaryAction() {
    if (minigameRuntime && minigameRuntime.renderer && minigameRuntime.renderer.primary) minigameRuntime.renderer.primary();
}

// « Passer » / Échap : l'épreuve se résout par le jet automatique.
function skipMinigame() {
    if (!minigameRuntime) return;
    finishMinigame(minigameAutoOutcome(minigameRuntime.spec), { auto: true, skipped: true });
}

function finishMinigame(outcome, detail = {}) {
    const rt = minigameRuntime;
    if (!rt) return; // déjà conclue (ex. pointerdown puis click)
    minigameRuntime = null;
    if (rt.rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rt.rafId);
    try { if (rt.renderer && rt.renderer.destroy) rt.renderer.destroy(); } catch (e) { /* un rendu défaillant ne bloque jamais le jeu */ }
    gameState.pendingMinigame = null;
    if (ui.minigameStrip) ui.minigameStrip.classList.add('hidden');
    if (ui.minigameBody) ui.minigameBody.innerHTML = '';
    if (rt.lockedByHost) setCombatInputLocked(false);
    settleMinigame(rt.spec, outcome, detail, rt.onResult);
}

// Rend l'issue : une ligne de journal, l'haptique, la bannière et l'animation, puis appelle onResult. Aucun
// écran de résultat : le jeu enchaîne dès la fin de l'animation (immédiatement sans animation ni interface).
function settleMinigame(spec, outcome, detail, onResult) {
    if (!MINIGAME_OUTCOMES.includes(outcome)) outcome = 'fail';
    const fx = minigameOutcomeFxSpec(spec.kind, outcome);
    const prefix = detail && detail.auto ? '🎲 ' : '';
    logEvent(`${prefix}${spec.icon} ${spec.label} : ${fx.label} ${pickMinigameLine(outcome)}`, outcome === 'fail' ? 'danger' : 'success');
    if (!(detail && detail.auto)) {
        triggerHaptic(fx.haptic);
        showMinigameBanner(fx);
    }
    // recordRunEvent('minigame', …) : branché au lot final (succès et piques DeathWatch).
    const done = () => { if (onResult) onResult(outcome, detail); };
    if (detail && detail.auto) done(); else playMinigameOutcomeFx(fx, done);
}

// Bannière d'issue (« PARFAIT ! ») : masquée par un vrai setTimeout, indépendant du tempo des beats.
function showMinigameBanner(fx) {
    if (!ui.minigameBanner) return;
    ui.minigameBanner.innerText = fx.label;
    ui.minigameBanner.style.color = fx.color;
    ui.minigameBanner.classList.remove('hidden');
    if (minigameBannerTimer) clearTimeout(minigameBannerTimer);
    minigameBannerTimer = setTimeout(() => { ui.minigameBanner.classList.add('hidden'); minigameBannerTimer = null; }, MINIGAME_SETTINGS.bannerMs);
}

// Ferme une éventuelle épreuve ouverte sans rien résoudre (restauration de sauvegarde, remise à zéro).
function abortMinigame() {
    const rt = minigameRuntime;
    minigameRuntime = null;
    if (rt && rt.rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rt.rafId);
    gameState.pendingMinigame = null;
    if (typeof ui !== 'undefined' && ui.minigameStrip) ui.minigameStrip.classList.add('hidden');
    if (rt && rt.lockedByHost) setCombatInputLocked(false);
}

// Branchements DOM, appelés une fois par app.js après la construction de `ui`.
function initMinigameUi() {
    if (ui.minigameSkip) ui.minigameSkip.addEventListener('click', skipMinigame);
    if (ui.minigameModeSelect) {
        ui.minigameModeSelect.value = getMinigameMode();
        ui.minigameModeSelect.addEventListener('change', () => setMinigameMode(ui.minigameModeSelect.value));
    }
    document.addEventListener('keydown', e => {
        if (!minigameRuntime) return;
        if (e.key === 'Escape') { e.preventDefault(); skipMinigame(); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); minigamePrimaryAction(); }
    });
    // Onglet masqué : la minuterie s'arrête et reprend au retour (l'épreuve ne se perd pas dans le dos du joueur).
    document.addEventListener('visibilitychange', () => {
        const rt = minigameRuntime;
        if (!rt) return;
        if (document.hidden) { if (!rt.hiddenAt) rt.hiddenAt = minigameClock(); }
        else if (rt.hiddenAt) { rt.pausedMs += minigameClock() - rt.hiddenAt; rt.hiddenAt = 0; }
    });
}

// DEV : lance l'épreuve « timing » pour l'essayer en vrai (menu DEV d'index.html).
function devTestMinigame() {
    if (isActionBlocked()) return;
    startMinigame(buildMinigameSpec('timing'), (outcome, detail) => {
        logEvent(`🛠️ DEV : épreuve timing conclue (${outcome}${detail && detail.auto ? ', jet automatique' : ''}).`, 'info');
        updateUI();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getMinigameMode, setMinigameMode, minigameIsInteractive, startMinigame, finishMinigame, skipMinigame, minigameTick, minigamePrimaryAction, abortMinigame };
}
