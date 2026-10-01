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
// Lie un geste « tap » à un élément : réaction immédiate au toucher (pointerdown), mais un tap fait AUSSI naître un `click` — ignoré
// s'il suit de près un pointerdown, pour ne jamais compter deux fois. Un `click` seul (clavier, lecteur d'écran) fonctionne.
const MINIGAME_TAP_DEDUP_MS = 700;
function bindTap(el, fn) {
    let lastPointerAt = -Infinity;
    el.addEventListener('pointerdown', e => {
        if (e && e.preventDefault) e.preventDefault();
        lastPointerAt = minigameClock();
        fn();
    });
    el.addEventListener('click', () => {
        if (minigameClock() - lastPointerAt < MINIGAME_TAP_DEDUP_MS) return;
        fn();
    });
}

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
            bindTap(btn, stop);
            root.appendChild(bar); root.appendChild(btn);
            return {
                primary: stop,
                update() { cursor.style.left = pct(position()); },
                destroy() { /* le hôte vide `root` */ }
            };
        }
    }
};

// Crochetage : trois goupilles à caler tour à tour. Chaque arrêt (réussi ou non) passe à la goupille suivante ; le temps écoulé
// compte les goupilles restantes comme manquées (renderer.timeout, appelé par l'hôte).
MINIGAME_RENDERERS.lockpick = {
    mount(root, spec, api) {
        const pct = v => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`;
        const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const pinsRow = mk('div', 'flex justify-center gap-2 mb-2');
        const dots = [];
        for (let i = 0; i < spec.pins; i++) { const d = mk('span', 'w-4 h-4 rounded-full border border-gray-600 bg-gray-800'); dots.push(d); pinsRow.appendChild(d); }
        const bar = mk('div', 'relative h-11 rounded bg-gray-900 border border-gray-700 overflow-hidden');
        const half = spec.zoneWidth / 2;
        const zone = mk('div', 'absolute top-0 bottom-0 bg-emerald-700/50 border-x border-emerald-400');
        const core = mk('div', 'absolute top-0 bottom-0 bg-yellow-400/60');
        const cursor = mk('div', 'absolute top-0 bottom-0 w-1.5 -ml-0.5 bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]');
        bar.appendChild(zone); bar.appendChild(core); bar.appendChild(cursor);
        const btn = mk('button', 'mt-2 w-full min-h-[48px] rounded border border-amber-500 bg-amber-900/40 text-amber-200 text-sm font-bold uppercase tracking-widest');
        btn.textContent = 'Crocheter';
        let pin = 0, hits = 0, perfects = 0, pinStart = api.elapsed();
        const placeZone = () => {
            const c = spec.pinCenters[pin];
            zone.style.left = pct(c - half); zone.style.width = pct(spec.zoneWidth);
            core.style.left = pct(c - half * spec.perfectRatio); core.style.width = pct(spec.zoneWidth * spec.perfectRatio);
        };
        const position = () => timingCursorPosition(api.elapsed() - pinStart, spec.periodMs);
        const conclude = (extra) => api.finish(lockpickOutcome(hits, perfects, spec.pins), Object.assign({ pins: hits, perfects }, extra));
        const stop = () => {
            const r = resolveTimingStop(position(), { zoneCenter: spec.pinCenters[pin], zoneWidth: spec.zoneWidth, perfectRatio: spec.perfectRatio });
            if (r !== 'fail') hits++;
            if (r === 'perfect') perfects++;
            dots[pin].className = `w-4 h-4 rounded-full border ${r === 'fail' ? 'border-red-500 bg-red-700' : 'border-emerald-300 bg-emerald-500'}`;
            pin++;
            if (pin >= spec.pins) { conclude({}); return; }
            pinStart = api.elapsed();
            placeZone();
        };
        bindTap(btn, stop);
        placeZone();
        root.appendChild(pinsRow); root.appendChild(bar); root.appendChild(btn);
        return {
            primary: stop,
            update() { cursor.style.left = pct(position()); },
            timeout() { conclude({ timeout: true }); },
            destroy() {}
        };
    }
};

// Désamorçage : phase de présentation (un symbole à la fois), puis saisie. Une erreur conclut tout de suite par un Raté.
MINIGAME_RENDERERS.sequence = {
    mount(root, spec, api) {
        const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const stage = mk('div', 'h-16 flex items-center justify-center text-5xl font-black mb-2 rounded bg-gray-900 border border-gray-700');
        const progress = mk('div', 'text-center text-[11px] text-gray-400 mb-2');
        const row = mk('div', 'grid grid-cols-4 gap-2');
        const inputs = [];
        let phase = 'show';
        let inputStart = 0;
        const buttons = SEQUENCE_SYMBOLS.map((sym, i) => {
            const b = mk('button', 'min-h-[56px] rounded border border-gray-600 bg-gray-900 text-3xl font-black');
            b.style.color = sym.color;
            b.textContent = sym.icon;
            b.setAttribute('aria-label', sym.name);
            bindTap(b, () => press(i));
            row.appendChild(b);
            return b;
        });
        function press(i) {
            if (phase !== 'input') return; // pas de saisie pendant la présentation
            inputs.push(i);
            const status = sequenceInputStatus(spec.sequence, inputs);
            progress.innerText = `${inputs.length} / ${spec.sequence.length}`;
            if (status === 'wrong') api.finish('fail', { mistake: true });
            else if (status === 'done') api.finish(sequenceOutcome(spec, api.elapsed() - inputStart), { inputs: inputs.slice() });
        }
        progress.innerText = 'Observez…';
        root.appendChild(stage); root.appendChild(progress); root.appendChild(row);
        return {
            // Pas de `primary` : Espace/Entrée activent normalement le bouton de symbole qui a le focus.
            update(el) {
                if (phase === 'show') {
                    if (el >= spec.showMs) { phase = 'input'; inputStart = el; stage.innerText = '?'; stage.style.color = ''; progress.innerText = `0 / ${spec.sequence.length}`; return; }
                    const sym = sequenceShownSymbol(spec, el);
                    stage.innerText = sym !== null && sym !== undefined ? SEQUENCE_SYMBOLS[sym].icon : '';
                    if (sym !== null && sym !== undefined) stage.style.color = SEQUENCE_SYMBOLS[sym].color;
                }
            },
            // Accès pour les tests : phase courante et appui direct sur un symbole.
            press, phaseNow: () => phase,
            destroy() {}
        };
    }
};

// Glyphe : relier des points d'une grille 3 x 3 dans l'ordre, au doigt. Lever le doigt avant la fin repart de zéro (dans le temps
// imparti) ; la fin du tracé conclut (Parfait si rapide). Le tracé est testable sans DOM via renderer.pointer().
MINIGAME_RENDERERS.glyph = {
    mount(root, spec, api) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('class', 'mx-auto block w-full max-w-[240px] touch-none select-none');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Grille de glyphe : reliez les points numérotés dans l\'ordre');
        const order = new Map(spec.pattern.map((idx, n) => [idx, n + 1]));
        const faint = spec.pattern.map(i => `${GLYPH_GRID_POINTS[i].x},${GLYPH_GRID_POINTS[i].y}`).join(' ');
        const dotsMarkup = GLYPH_GRID_POINTS.map((p, i) => {
            const n = order.get(i);
            return `<circle cx="${p.x}" cy="${p.y}" r="${n ? 7 : 3}" fill="${n ? '#312e81' : '#374151'}" stroke="${n ? '#a78bfa' : '#4b5563'}" stroke-width="1.2" data-dot="${i}"/>` +
                (n ? `<text x="${p.x}" y="${p.y + 2.6}" text-anchor="middle" font-size="7.5" font-weight="900" fill="#e0e7ff">${n}</text>` : '');
        }).join('');
        svg.innerHTML = `<polyline points="${faint}" fill="none" stroke="#6d28d9" stroke-width="1" stroke-dasharray="2 2" opacity="0.55"/>` +
            `<polyline id="mg-glyph-trace" points="" fill="none" stroke="#c4b5fd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` + dotsMarkup;
        const trace = svg.querySelector('#mg-glyph-trace');
        root.appendChild(svg);

        let progress = 0, last = null, drawing = false, finished = false;
        const reached = [];
        const redraw = () => { if (trace && trace.setAttribute) trace.setAttribute('points', reached.map(i => `${GLYPH_GRID_POINTS[i].x},${GLYPH_GRID_POINTS[i].y}`).join(' ')); };
        const toLocal = e => {
            const r = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0, width: 100, height: 100 };
            return { x: (e.clientX - r.left) / (r.width || 100) * 100, y: (e.clientY - r.top) / (r.height || 100) * 100 };
        };
        // `type` : 'down' | 'move' | 'up' ; (x, y) dans le repère 0..100.
        function pointer(type, x, y) {
            if (finished) return;
            if (type === 'up') { if (progress < spec.pattern.length) { progress = 0; reached.length = 0; redraw(); } drawing = false; last = null; return; }
            const pt = { x, y };
            if (type === 'down') { drawing = true; last = pt; }
            if (!drawing) return;
            const before = progress;
            progress = glyphAdvance(spec.pattern, progress, last || pt, pt, spec.hitRadius);
            for (let k = before; k < progress; k++) reached.push(spec.pattern[k]);
            last = pt;
            if (progress > before) redraw();
            if (progress >= spec.pattern.length) {
                finished = true;
                const quick = api.elapsed() <= spec.durationMs * MINIGAME_SETTINGS.glyph.perfectTimeRatio;
                api.finish(quick ? 'perfect' : 'success', { traced: true });
            }
        }
        svg.addEventListener('pointerdown', e => { if (e.preventDefault) e.preventDefault(); if (svg.setPointerCapture && e.pointerId !== undefined) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* sans capture : le tracé suit quand même */ } } const p = toLocal(e); pointer('down', p.x, p.y); });
        svg.addEventListener('pointermove', e => { const p = toLocal(e); pointer('move', p.x, p.y); });
        svg.addEventListener('pointerup', () => pointer('up'));
        svg.addEventListener('pointercancel', () => pointer('up'));
        return { update() {}, pointer, progressNow: () => progress, destroy() {} };
    }
};

// Immobiliser / Étrangler (V2) : une barre avec une zone qui va et vient ; on garde le doigt dessus, la part du temps passée dans la
// zone fait l'issue. La fin du temps est la fin NORMALE de l'épreuve (renderer.timeout). Lever le doigt compte comme « hors zone ».
// Le suivi est testable sans DOM via renderer.pointer(type, x) (x dans 0..1 le long de la barre) et renderer.scoreNow().
const holdRenderer = {
    mount(root, spec, api) {
        const pct = v => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`;
        const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const bar = mk('div', 'relative h-16 rounded bg-gray-900 border border-gray-700 overflow-hidden touch-none select-none');
        bar.setAttribute('role', 'slider');
        bar.setAttribute('aria-label', 'Gardez le doigt dans la zone qui bouge');
        const zone = mk('div', 'absolute top-0 bottom-0 bg-orange-600/50 border-x-2 border-orange-300');
        zone.style.width = pct(spec.zoneWidth);
        const finger = mk('div', 'absolute top-1 bottom-1 w-3 -ml-1.5 rounded bg-amber-100 opacity-0');
        const meter = mk('div', 'mt-2 h-2 rounded-full bg-gray-900 border border-gray-800 overflow-hidden');
        const fill = mk('div', 'h-full bg-orange-400 rounded-full');
        fill.style.width = '0%';
        meter.appendChild(fill);
        bar.appendChild(zone); bar.appendChild(finger);
        root.appendChild(bar); root.appendChild(meter);

        let cursor = null, inside = 0, last = api.elapsed();
        const sample = (el) => {
            const dt = Math.min(100, Math.max(0, el - last)); // un onglet masqué ne crédite jamais d'un coup des secondes entières
            last = el;
            if (holdInside(cursor, holdZoneCenter(el, spec), spec.zoneWidth)) inside += dt;
        };
        const toX = e => {
            const r = bar.getBoundingClientRect ? bar.getBoundingClientRect() : { left: 0, width: 1 };
            return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
        };
        function pointer(type, x) {
            if (type === 'up') { sample(api.elapsed()); cursor = null; finger.style.opacity = '0'; return; }
            sample(api.elapsed()); // crédite le temps écoulé avec l'ANCIENNE position avant de la changer
            cursor = x;
            finger.style.left = pct(x); finger.style.opacity = '1';
        }
        bar.addEventListener('pointerdown', e => { if (e.preventDefault) e.preventDefault(); if (bar.setPointerCapture && e.pointerId !== undefined) { try { bar.setPointerCapture(e.pointerId); } catch (err) { /* sans capture : le suivi continue sur la barre */ } } pointer('down', toX(e)); });
        bar.addEventListener('pointermove', e => { if (cursor !== null) pointer('move', toX(e)); });
        bar.addEventListener('pointerup', () => pointer('up'));
        bar.addEventListener('pointercancel', () => pointer('up'));
        return {
            update(el) {
                sample(el);
                zone.style.left = pct(holdZoneCenter(el, spec) - spec.zoneWidth / 2);
                fill.style.width = pct(inside / spec.durationMs);
            },
            timeout() {
                sample(spec.durationMs);
                const ratio = Math.min(1, inside / spec.durationMs);
                api.finish(holdOutcome(ratio, spec), { ratio });
            },
            pointer, scoreNow: () => inside, destroy() {}
        };
    }
};
MINIGAME_RENDERERS.grapple = holdRenderer;
MINIGAME_RENDERERS.choke = holdRenderer;

// Cible de précision (V2) : un réticule balaie une cible en anneaux ; un tap (ou Espace/Entrée) tire là où il se trouve.
MINIGAME_RENDERERS.target = {
    mount(root, spec, api) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-1 -1 2 2');
        svg.setAttribute('class', 'mx-auto block w-full max-w-[220px] touch-none select-none');
        svg.setAttribute('role', 'button');
        svg.setAttribute('aria-label', 'Cible : touchez pour tirer quand le réticule est dessus');
        svg.innerHTML = `<circle r="0.96" fill="#111827" stroke="#374151" stroke-width="0.02"/>` +
            `<circle r="${spec.outerRadius}" fill="#7f1d1d" stroke="#fca5a5" stroke-width="0.02"/>` +
            `<circle r="${(spec.outerRadius + spec.centerRadius) / 2}" fill="#f8fafc" opacity="0.9"/>` +
            `<circle r="${spec.centerRadius}" fill="#dc2626" stroke="#fef08a" stroke-width="0.02"/>` +
            `<g id="mg-reticle"><circle r="0.09" fill="none" stroke="#fde047" stroke-width="0.03"/><path d="M-0.16 0 H-0.05 M0.05 0 H0.16 M0 -0.16 V-0.05 M0 0.05 V0.16" stroke="#fde047" stroke-width="0.03" stroke-linecap="round"/></g>`;
        const reticle = svg.querySelector('#mg-reticle');
        root.appendChild(svg);
        const position = () => targetReticlePosition(api.elapsed(), spec);
        const shoot = () => { const pos = position(); api.finish(resolveTargetShot(pos, spec), { x: pos.x, y: pos.y }); };
        bindTap(svg, shoot);
        return {
            primary: shoot,
            update() { const p = position(); if (reticle && reticle.setAttribute) reticle.setAttribute('transform', `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})`); },
            destroy() {}
        };
    }
};

// Points faibles (V2) : trois zones au choix, chacune avec son effet écrit dessus. Aucune adresse : seule l'hésitation est un Raté.
MINIGAME_RENDERERS.weakpoint = {
    mount(root, spec, api) {
        const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
        const row = mk('div', 'grid grid-cols-3 gap-2');
        const pressed = {};
        const pick = zone => api.finish('success', { zone });
        Object.keys(WEAKPOINT_ZONES).forEach(key => {
            const z = WEAKPOINT_ZONES[key];
            const b = mk('button', 'min-h-[72px] px-1 py-2 rounded border border-orange-700 bg-gray-900 text-orange-200 text-xs font-bold leading-tight');
            b.innerHTML = `<span class="block text-2xl" aria-hidden="true">${z.icon}</span>${z.label}<span class="block mt-1 text-[10px] font-normal text-gray-400">${z.text}</span>`;
            bindTap(b, () => pick(key));
            pressed[key] = b;
            row.appendChild(b);
        });
        root.appendChild(row);
        return { update() {}, pick, destroy() {} };
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
        const auto = minigameAutoResult(spec);
        settleMinigame(spec, auto.outcome, Object.assign({}, auto.detail, { auto: true }), onResult);
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
    if (el >= rt.spec.durationMs) {
        // Une épreuve peut compter ce qui a été réussi avant la fin du temps (goupilles) ; sinon : Raté.
        if (rt.renderer && rt.renderer.timeout) rt.renderer.timeout();
        if (minigameRuntime === rt) finishMinigame('fail', { timeout: true });
        return;
    }
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
    const auto = minigameAutoResult(minigameRuntime.spec);
    finishMinigame(auto.outcome, Object.assign({}, auto.detail, { auto: true, skipped: true }));
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
    // Les boutons de combat ne sont rendus qu'au moment de rappeler onResult (fin de l'animation d'issue) : pas de double action
    // pendant l'éclat. Si onResult lance une action, sa riposte les reverrouille aussitôt.
    settleMinigame(rt.spec, outcome, detail, (o, d) => {
        if (rt.lockedByHost) setCombatInputLocked(false);
        if (rt.onResult) rt.onResult(o, d);
    });
}

// Rend l'issue : une ligne de journal, l'haptique, la bannière et l'animation, puis appelle onResult. Aucun
// écran de résultat : le jeu enchaîne dès la fin de l'animation (immédiatement sans animation ni interface).
function settleMinigame(spec, outcome, detail, onResult) {
    if (!MINIGAME_OUTCOMES.includes(outcome)) outcome = 'fail';
    const fx = minigameOutcomeFxSpec(spec.kind, outcome);
    const prefix = detail && detail.auto ? '🎲 ' : '';
    if (!(detail && detail.auto && spec.quietAuto)) { // le jet automatique d'un glyphe équivaut à « pas de glyphe » : rien à écrire
        logEvent(`${prefix}${spec.icon} ${spec.label} : ${fx.label} ${pickMinigameLine(outcome)}`, outcome === 'fail' ? 'danger' : 'success');
    }
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
        else if ((e.key === ' ' || e.key === 'Enter') && minigameRuntime.renderer && minigameRuntime.renderer.primary) { e.preventDefault(); minigamePrimaryAction(); }
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
