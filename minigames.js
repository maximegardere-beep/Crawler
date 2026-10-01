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
    occasionChancePct: { play: 25, reduced: 10, auto: 0 },
    // --- V1 : épreuves d'exploration et de sort (chiffres de départ, à valider en playtest) ---
    // Part des « Trésor » qui sont un coffre verrouillé / des pièges qui se désamorcent (le reste : comme avant).
    lockedChestPct: 50,
    trapDisarmPct: 50,
    lockpick: {
        pins: 3,
        zoneBase: 0.30, zonePerFloor: -0.02, zoneMin: 0.12, // la zone rétrécit avec l'étage…
        zonePerStealth: 0.01, zoneStealthMax: 0.08,         // …et s'élargit avec la Furtivité
        periodMs: 1000, pinMs: 3000, autoPinPct: 70         // jet automatique : 70 % par goupille
    },
    disarm: {
        lengthBase: 3, lengthFromFloor: 7, lengthLong: 4,   // 3 symboles, 4 à partir de l'étage 7
        stepMs: 450, stepPerStealthMs: 40, stepMaxMs: 900,  // temps d'affichage de chaque symbole (monte avec la Furtivité)
        inputMs: 3000, perfectInputRatio: 0.5,
        autoBasePct: 45, autoPerStealthPct: 6, autoMaxPct: 85 // jet automatique : 45 % + 6 %/niveau de Furtivité, plafond 85 %
    },
    glyph: {
        chancePct: { play: 100, reduced: 25, auto: 0 },     // un glyphe est proposé à chaque sort offensif (Réduit : plus rarement)
        durationMs: 5000, perfectTimeRatio: 0.4, hitRadius: 16
    }
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
    },
    // Crochetage d'un coffre : 3 goupilles à caler tour à tour (un curseur par goupille). L'issue dépend du nombre de
    // goupilles crochetées (LOCKPICK_REWARDS) ; Parfait = les trois au cœur de la zone.
    lockpick: {
        label: 'Crochetage',
        icon: '🔓',
        hint: 'Arrêtez le curseur dans la zone verte, trois fois de suite.',
        autoRates: { perfect: 0, success: 0, fail: 0 },
        build(rng, o) {
            const cfg = MINIGAME_SETTINGS.lockpick;
            const pins = o.pins || cfg.pins;
            const width = o.zoneWidth || 0.3;
            const margin = width / 2 + 0.05;
            const centers = [];
            for (let i = 0; i < pins; i++) centers.push(margin + rng() * (1 - 2 * margin));
            return {
                pins,
                zoneWidth: width,
                pinCenters: Array.isArray(o.pinCenters) ? o.pinCenters : centers,
                perfectRatio: o.perfectRatio || 0.35,
                periodMs: o.periodMs || cfg.periodMs,
                autoPinPct: typeof o.autoPinPct === 'number' ? o.autoPinPct : cfg.autoPinPct,
                durationMs: o.durationMs || pins * cfg.pinMs
            };
        },
        autoResolve(spec, rng) {
            let hits = 0;
            for (let i = 0; i < spec.pins; i++) if (rng() * 100 < spec.autoPinPct) hits++;
            return { outcome: lockpickOutcome(hits, 0, spec.pins), detail: { pins: hits, perfects: 0 } };
        }
    },
    // Désamorçage d'un piège : une séquence de symboles s'affiche un par un, puis on la reproduit. Une erreur ou un temps
    // écoulé = le piège se déclenche. Parfait = sans erreur et dans la moitié du temps de saisie.
    sequence: {
        label: 'Désamorçage',
        icon: '🧰',
        hint: 'Mémorisez la séquence, puis reproduisez-la.',
        autoRates: { perfect: 0, success: 45, fail: 55 },
        build(rng, o) {
            const cfg = MINIGAME_SETTINGS.disarm;
            const length = o.length || cfg.lengthBase;
            // Jamais deux symboles identiques d'affilée : le court blanc entre deux symboles ne suffit pas à les distinguer.
            const n = SEQUENCE_SYMBOLS.length;
            const sequence = Array.isArray(o.sequence) ? o.sequence : [];
            if (!sequence.length) {
                for (let i = 0; i < length; i++) {
                    sequence.push(i === 0 ? Math.floor(rng() * n) % n : (sequence[i - 1] + 1 + Math.floor(rng() * (n - 1)) % (n - 1)) % n);
                }
            }
            const stepMs = o.stepMs || cfg.stepMs;
            const showMs = sequence.length * stepMs + 250;
            const inputMs = o.inputMs || cfg.inputMs;
            return { sequence, stepMs, showMs, inputMs, durationMs: o.durationMs || showMs + inputMs };
        }
    },
    // Glyphe d'un sort offensif : relier des points d'une grille 3 x 3 dans l'ordre. OPTIONNEL : un échec ou un « Passer »
    // lance le sort normalement (jamais de malus) ; une réussite le renforce (config.magicBalance.glyph*). Un jet automatique
    // vaut « pas de glyphe » (silencieux).
    glyph: {
        label: 'Glyphe',
        icon: '✍️',
        hint: 'Reliez les points dans l\'ordre pour renforcer le sort.',
        autoRates: { perfect: 0, success: 0, fail: 100 },
        quietAuto: true,
        build(rng, o) {
            const cfg = MINIGAME_SETTINGS.glyph;
            return {
                pattern: Array.isArray(o.pattern) ? o.pattern : GLYPH_PATTERNS['Toucher Électrique'],
                hitRadius: o.hitRadius || cfg.hitRadius,
                durationMs: o.durationMs || cfg.durationMs
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
        label: overrides.label || kind.label,
        icon: overrides.icon || kind.icon,
        hint: overrides.hint || kind.hint,
        boss,
        durationMs: overrides.durationMs || MINIGAME_SETTINGS.durationMs[boss ? 'boss' : 'normal'],
        autoRates: Object.assign({}, kind.autoRates, overrides.autoRates),
        allowPerfect: overrides.allowPerfect !== false,
        quietAuto: !!kind.quietAuto // vrai : un jet automatique ne s'écrit pas au journal (ex. glyphe : « pas de glyphe »)
    }, kind.build(rng, overrides));
}

// Résultat d'un jet automatique : { outcome, detail }. Une épreuve dont l'issue ne se réduit pas à Parfait / Réussi / Raté
// (crochetage : nombre de goupilles) fournit son propre `autoResolve(spec, rng)` ; sinon, tirage pondéré par `autoRates`.
function minigameAutoResult(spec, rng = Math.random) {
    const kind = spec && MINIGAME_KINDS[spec.kind];
    if (kind && typeof kind.autoResolve === 'function') return kind.autoResolve(spec, rng);
    return { outcome: minigameAutoOutcome(spec, rng), detail: {} };
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

// --- Épreuve « crochetage » ---------------------------------------------------------------------------------------
// Récompense du coffre selon le nombre de goupilles crochetées (0 à 3) : rien / quelques PO / butin normal / butin d'un
// palier de rareté de plus (source 'treasure').
const LOCKPICK_REWARDS = ['none', 'gold', 'explore', 'treasure'];

function lockpickReward(pins) {
    return LOCKPICK_REWARDS[Math.max(0, Math.min(LOCKPICK_REWARDS.length - 1, pins | 0))];
}

// Issue affichée : Parfait = toutes les goupilles, toutes au cœur de la zone ; Réussi = au moins 2 sur 3 ; sinon Raté.
function lockpickOutcome(hits, perfects, pins) {
    if (hits >= pins && perfects >= pins) return 'perfect';
    return hits >= Math.min(2, pins) ? 'success' : 'fail';
}

// Largeur de la zone : rétrécit avec l'étage, s'élargit avec la Furtivité (bornée des deux côtés).
function lockpickZoneWidth(floor, stealthLevel) {
    const c = MINIGAME_SETTINGS.lockpick;
    const base = Math.max(c.zoneMin, c.zoneBase + c.zonePerFloor * Math.max(0, floor - 1));
    const bonus = Math.min(c.zoneStealthMax, c.zonePerStealth * Math.max(0, stealthLevel - 1));
    return Math.round((base + bonus) * 1000) / 1000;
}

// --- Épreuve « désamorçage » ---------------------------------------------------------------------------------------
const SEQUENCE_SYMBOLS = [
    { icon: '▲', color: '#f87171', name: 'triangle' },
    { icon: '●', color: '#60a5fa', name: 'rond' },
    { icon: '■', color: '#4ade80', name: 'carré' },
    { icon: '◆', color: '#facc15', name: 'losange' }
];

// Réglages d'un désamorçage selon l'étage et la Furtivité : longueur de la séquence, temps d'affichage de chaque
// symbole, taux du jet automatique (45 % + 6 % par niveau de Furtivité, plafond 85 %).
function disarmOverrides(floor, stealthLevel) {
    const c = MINIGAME_SETTINGS.disarm;
    const chance = Math.min(c.autoMaxPct, c.autoBasePct + c.autoPerStealthPct * Math.max(0, stealthLevel - 1));
    return {
        length: floor >= c.lengthFromFloor ? c.lengthLong : c.lengthBase,
        stepMs: Math.min(c.stepMaxMs, c.stepMs + c.stepPerStealthMs * Math.max(0, stealthLevel - 1)),
        autoRates: { perfect: 0, success: chance, fail: 100 - chance }
    };
}

// Où en est la saisie : 'wrong' (dernier symbole faux), 'done' (séquence complète), sinon 'ok'.
function sequenceInputStatus(sequence, inputs) {
    for (let i = 0; i < inputs.length; i++) if (inputs[i] !== sequence[i]) return 'wrong';
    return inputs.length >= sequence.length ? 'done' : 'ok';
}

// Issue d'une séquence complète : Parfait si saisie dans la moitié du temps de saisie, sinon Réussi.
function sequenceOutcome(spec, inputElapsedMs) {
    return inputElapsedMs <= spec.inputMs * MINIGAME_SETTINGS.disarm.perfectInputRatio ? 'perfect' : 'success';
}

// Symbole affiché à l'instant `elapsedMs` de la phase de présentation (null entre deux symboles, ou une fois finie).
function sequenceShownSymbol(spec, elapsedMs) {
    const i = Math.floor(elapsedMs / spec.stepMs);
    if (elapsedMs < 0 || i >= spec.sequence.length) return null;
    return (elapsedMs - i * spec.stepMs) < spec.stepMs * 0.8 ? spec.sequence[i] : null;
}

// --- Épreuve « glyphe » ------------------------------------------------------------------------------------------
// Grille 3 x 3 dans un repère 0..100 (indices 0..8, ligne par ligne) ; un motif = 4 à 6 points distincts à relier dans
// l'ordre. Un motif par sort offensif (clé = nom exact de spells.js) ; les sorts utilitaires (catégorie « any ») n'en ont pas.
const GLYPH_GRID_POINTS = Array.from({ length: 9 }, (_, i) => ({ x: 20 + (i % 3) * 30, y: 20 + Math.floor(i / 3) * 30 }));
const GLYPH_PATTERNS = {
    "Toucher Électrique": [0, 2, 4, 6, 8],
    "Poing de Glace": [1, 7, 3, 5],
    "Paume Brûlante": [6, 3, 4, 1, 2],
    "Lame Spectrale": [2, 4, 6, 3, 0],
    "Foudre": [1, 5, 7, 3],
    "Boule d'Acide": [3, 0, 1, 2, 5, 8],
    "Projectile de Glace": [0, 4, 8, 5],
    "Météore Miniature": [2, 5, 8, 4, 6],
    "Étreinte Vampirique": [0, 3, 7, 5, 2],
    "Gifle Sonique": [3, 4, 5, 2],
    "Main de Rouille": [6, 7, 8, 5, 2],
    "Nuée de Guêpes": [0, 1, 4, 7, 6],
    "Flash Aveuglant": [4, 0, 2, 8, 6],
    "Chaîne d'Éclairs": [0, 1, 4, 5, 8],
    "Cri de Terreur": [1, 3, 7, 5, 2]
};

function getGlyphPattern(spell) {
    const name = spell && (spell.spellName || spell.name);
    return (name && GLYPH_PATTERNS[name]) || null;
}

// Distance d'un point à un segment (le doigt qui glisse vite saute des points d'échantillonnage : on teste le segment).
function glyphSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Avance dans le motif : renvoie le nouvel indice de progression après le déplacement `from` -> `to` (repère 0..100).
// Plusieurs points consécutifs peuvent être validés d'un seul geste ; passer près d'un mauvais point est sans effet.
function glyphAdvance(pattern, progress, from, to, radius) {
    let p = progress;
    while (p < pattern.length) {
        const dot = GLYPH_GRID_POINTS[pattern[p]];
        if (glyphSegmentDistance(dot.x, dot.y, from.x, from.y, to.x, to.y) > radius) break;
        p++;
    }
    return p;
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
// `target: 'prop'` + `at` : hors combat, l'éclat se pose sur l'accessoire de la vignette d'exploration (repère 360 x 150).
const MINIGAME_KIND_FX = {
    timing: {},
    lockpick: {
        perfect: { burst: 'chestOpen', color: '#facc15', target: 'prop', at: [222, 104], durationMs: 460 },
        success: { burst: 'chestOpen', color: '#fde68a', target: 'prop', at: [222, 104], durationMs: 380 },
        fail: { burst: 'lockJam', color: '#9ca3af', target: 'prop', at: [222, 108], durationMs: 360 }
    },
    sequence: {
        perfect: { burst: 'disarmed', color: '#4ade80', target: 'prop', at: [250, 108], durationMs: 420 },
        success: { burst: 'disarmed', color: '#86efac', target: 'prop', at: [250, 108], durationMs: 360 },
        fail: { burst: 'trapSnap', color: '#ef4444', target: 'prop', at: [250, 108], durationMs: 360 }
    },
    glyph: {
        perfect: { burst: 'glyphSeal', color: '#c084fc', target: 'crawler', durationMs: 440 },
        success: { burst: 'glyphSeal', color: '#a78bfa', target: 'crawler', durationMs: 380 },
        fail: { burst: 'glyphFade', color: '#a78bfa', target: 'crawler', durationMs: 340 }
    }
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
        timingCursorPosition, resolveTimingStop, minigameOutcomeFxSpec, pickMinigameLine, minigameAutoResult,
        LOCKPICK_REWARDS, lockpickReward, lockpickOutcome, lockpickZoneWidth, SEQUENCE_SYMBOLS, disarmOverrides, sequenceInputStatus,
        sequenceOutcome, sequenceShownSymbol, GLYPH_GRID_POINTS, GLYPH_PATTERNS, getGlyphPattern, glyphSegmentDistance, glyphAdvance
    };
}
