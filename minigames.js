// minigames.js - Mini-jeux (chantier 6, lot 0) : catalogue et résolutions PURES, sans DOM ni gameState.
// Même principe que fx.js / floorgen.js : tout ce qui se calcule (issue d'une épreuve, jet automatique,
// position d'un curseur, spécification d'animation) vit ici et se teste sous Node ; l'hôte d'interface
// (minigames-ui.js) ne fait que l'afficher. Hasard injectable (`rng`, par défaut Math.random).
//
// Trois issues communes à toutes les épreuves : Parfait / Réussi / Raté. Un « jet automatique » (réglage
// d'accessibilité, simulation longue, tests) remplace le jeu par un tirage pondéré par `autoRates`.

const MINIGAME_OUTCOMES = ['perfect', 'success', 'fail'];
const MINIGAME_MODES = ['play', 'reduced', 'auto'];
const MINIGAME_MODE_LABELS = { play: 'Jouer', reduced: 'Réduit', auto: 'Jet automatique' };
const MINIGAME_OUTCOME_LABELS = { perfect: 'PARFAIT !', success: 'Réussi', fail: 'Raté' };

const MINIGAME_SETTINGS = {
    // Durée maximale d'une épreuve : un temps écoulé vaut « Raté », jamais une fenêtre ouverte sans fin.
    durationMs: { normal: 3000, boss: 5000 },
    bannerMs: 700,
    // Chance qu'une Occasion de combat (V2) apparaisse au début d'un tour, selon le réglage.
    occasionChancePct: { play: 25, reduced: 10, auto: 0 }
};

// Catalogue des épreuves. `build(rng, overrides)` renvoie les paramètres propres à l'épreuve ; le reste
// (durée, taux du jet automatique) est commun. Une nouvelle épreuve = une entrée ici, son rendu dans
// MINIGAME_RENDERERS (minigames-ui.js) et ses animations d'issue dans MINIGAME_KIND_FX (exigées par les tests).
const MINIGAME_KINDS = {
    // Curseur qui balaie une barre : on le stoppe dans la zone. Brique commune du crochetage, de la parade, etc.
    timing: {
        label: 'Timing',
        icon: '🎯',
        hint: 'Touchez pile dans la zone verte !',
        autoRates: { perfect: 10, success: 60, fail: 30 },
        build(rng, o) {
            const width = o.zoneWidth || 0.3;
            const margin = width / 2 + 0.05;
            return {
                zoneWidth: width,
                zoneCenter: typeof o.zoneCenter === 'number' ? o.zoneCenter : margin + rng() * (1 - 2 * margin),
                perfectRatio: o.perfectRatio || 0.35, // part de la demi-zone qui vaut Parfait
                periodMs: o.periodMs || 1100          // aller-retour complet du curseur
            };
        }
    }
};

// Spécification complète d'une épreuve (ce que reçoit startMinigame()). `overrides` : boss, durationMs,
// autoRates, allowPerfect (faux = le jet automatique ne donne jamais de Parfait), et les réglages propres à
// l'épreuve (ex. zoneWidth).
function buildMinigameSpec(kindKey, overrides = {}, rng = Math.random) {
    const kind = MINIGAME_KINDS[kindKey];
    if (!kind) return null;
    const boss = !!overrides.boss;
    return Object.assign({
        kind: kindKey,
        label: kind.label,
        icon: kind.icon,
        hint: kind.hint,
        boss,
        durationMs: overrides.durationMs || MINIGAME_SETTINGS.durationMs[boss ? 'boss' : 'normal'],
        autoRates: Object.assign({}, kind.autoRates, overrides.autoRates),
        allowPerfect: overrides.allowPerfect !== false
    }, kind.build(rng, overrides));
}

function normalizeMinigameMode(mode) {
    return MINIGAME_MODES.includes(mode) ? mode : null;
}

// Jet automatique : tirage pondéré par spec.autoRates (perfect/success/fail). `allowPerfect` faux : le poids du
// Parfait est ignoré (les épreuves de boss ne donnent jamais de Parfait en jet automatique).
function minigameAutoOutcome(spec, rng = Math.random) {
    const rates = (spec && spec.autoRates) || {};
    const weights = MINIGAME_OUTCOMES.map(o => (o === 'perfect' && spec && spec.allowPerfect === false) ? 0 : Math.max(0, rates[o] || 0));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return 'success';
    let roll = rng() * total;
    for (let i = 0; i < MINIGAME_OUTCOMES.length; i++) {
        if (roll < weights[i]) return MINIGAME_OUTCOMES[i];
        roll -= weights[i];
    }
    return MINIGAME_OUTCOMES[MINIGAME_OUTCOMES.length - 1];
}

// --- Épreuve « timing » -------------------------------------------------------------------------------------
// Position du curseur (0..1) en va-et-vient triangulaire : 0 à t=0, 1 à mi-période, retour à 0 en fin de période.
function timingCursorPosition(elapsedMs, periodMs) {
    const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
    return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
}

// Issue d'un arrêt du curseur à la position `pos` : Parfait au cœur de la zone, Réussi dans la zone, sinon Raté.
function resolveTimingStop(pos, spec) {
    const half = spec.zoneWidth / 2;
    const dist = Math.abs(pos - spec.zoneCenter);
    if (dist <= half * spec.perfectRatio) return 'perfect';
    if (dist <= half) return 'success';
    return 'fail';
}

// --- Animations d'issue (spécification pure, jouée par fx.js) ---------------------------------------------------
// `burst` : clé de FX_IMPACTS (sprites/fx.js) ; `hitstopMs` : gel à l'impact (le long gel et la secousse d'écran
// `heavy` sont réservés au Parfait) ; `target` : qui reçoit l'éclat en combat ; `haptic` : motif de triggerHaptic().
const MINIGAME_OUTCOME_FX = {
    perfect: { burst: 'perfect', color: '#facc15', hitstopMs: 120, heavy: true, haptic: 'heavy', target: 'mob', durationMs: 420 },
    success: { burst: 'hit', color: '#86efac', hitstopMs: 40, heavy: false, haptic: 'medium', target: 'mob', durationMs: 340 },
    fail: { burst: 'fizzle', color: '#9ca3af', hitstopMs: 0, heavy: false, haptic: 'light', target: 'crawler', durationMs: 340 }
};
// Variantes par épreuve et issue (une épreuve sans entrée retombe sur l'issue commune ci-dessus).
const MINIGAME_KIND_FX = {
    timing: {}
};

function minigameOutcomeFxSpec(kind, outcome) {
    const base = MINIGAME_OUTCOME_FX[outcome];
    if (!base) return null;
    const override = (MINIGAME_KIND_FX[kind] || {})[outcome] || {};
    return Object.assign({ kind, outcome, label: MINIGAME_OUTCOME_LABELS[outcome] }, base, override);
}

const MINIGAME_OUTCOME_LINES = {
    perfect: ["Le public est debout. Enfin, une partie du public.", "Un geste d'une précision indécente.", "Le présentateur en reste sans voix, chose rare."],
    success: ["Correct. Le Donjon a vu pire.", "Ça passe. Sans éclat, mais ça passe.", "Mission accomplie, techniquement."],
    fail: ["Le public soupire en chœur.", "Les doigts, ces traîtres.", "Raté. Le Donjon, lui, s'en souviendra."]
};

function pickMinigameLine(outcome, rng = Math.random) {
    const lines = MINIGAME_OUTCOME_LINES[outcome] || MINIGAME_OUTCOME_LINES.fail;
    return lines[Math.floor(rng() * lines.length) % lines.length];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MINIGAME_OUTCOMES, MINIGAME_MODES, MINIGAME_MODE_LABELS, MINIGAME_OUTCOME_LABELS, MINIGAME_SETTINGS, MINIGAME_KINDS,
        MINIGAME_OUTCOME_FX, MINIGAME_KIND_FX, buildMinigameSpec, normalizeMinigameMode, minigameAutoOutcome,
        timingCursorPosition, resolveTimingStop, minigameOutcomeFxSpec, pickMinigameLine
    };
}
