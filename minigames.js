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
    },
    // --- V2 : actions spéciales de combat, proposées par des « Occasions » ---
    occasion: {
        skillBonusPerLevel: 1, skillBonusMax: 10,           // la chance monte un peu avec le niveau de la compétence liée
        pityCombats: 6                                      // garantie : une Occasion au plus tard au 7e combat sans aucune
    },
    // Immobiliser (mains nues) : on garde le doigt dans une zone qui bouge ; la part du temps passée dedans fait l'issue.
    grapple: { durationMs: 3000, zoneWidth: 0.34, periodMs: 1700, perfectRatio: 0.8, successRatio: 0.5, roundsSuccess: 1, roundsPerfect: 2, roundsBoss: 1,
        zonePerSkill: 0.01, zoneSkillMax: 0.08 },
    // Étrangler (finisseur sur un mob immobilisé / étourdi, jamais un boss) : zone plus étroite, seuils plus exigeants, dégâts x3.
    choke: { durationMs: 3000, zoneWidth: 0.28, periodMs: 1500, perfectRatio: 0.85, successRatio: 0.6, damageMult: 3,
        zonePerSkill: 0.01, zoneSkillMax: 0.08 },
    // Cible de précision (tir) : un réticule balaie la cible ; la cible rétrécit avec l'écart de combat.
    target: { durationMs: 3000, outerRadius: 0.5, centerRadius: 0.18, amplitude: 0.85, periodXMs: 1600, periodYMs: 2300,
        perfectPassFromMs: 800, perfectPassToMs: 2200, // le réticule passe EXACTEMENT au centre à un instant tiré dans cette fenêtre
        distanceShrink: 0.06, minSizeFactor: 0.5, radiusPerSkill: 0.004, radiusSkillMax: 0.04, perfectMult: 1.5, successMult: 1 },
    weakpoint: { durationMs: 6000 }
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
    // Immobiliser / Étrangler (V2) : même geste (garder le doigt dans une zone qui bouge, pendant toute la durée), deux épreuves
    // pour que leurs issues, leurs seuils et leurs animations restent distincts. Le temps écoulé est la FIN normale de l'épreuve.
    grapple: {
        label: 'Immobiliser', icon: '🤼', hint: 'Gardez le doigt dans la zone qui bouge.',
        autoRates: { perfect: 10, success: 45, fail: 45 },
        build(rng, o) { return buildHoldParams(MINIGAME_SETTINGS.grapple, rng, o); }
    },
    choke: {
        label: 'Étrangler', icon: '🪢', hint: 'Serrez : gardez le doigt dans la zone, sans la lâcher.',
        autoRates: { perfect: 5, success: 45, fail: 50 },
        build(rng, o) { return buildHoldParams(MINIGAME_SETTINGS.choke, rng, o); }
    },
    // Cible de précision (V2) : un tap fait partir le tir, là où se trouve le réticule à cet instant.
    target: {
        label: 'Cible', icon: '🎯', hint: 'Touchez quand le réticule est sur la cible.',
        autoRates: { perfect: 10, success: 40, fail: 50 },
        build(rng, o) {
            const cfg = MINIGAME_SETTINGS.target;
            const f = targetSizeFactor(o.distance || 0);
            const bonus = Math.min(cfg.radiusSkillMax, cfg.radiusPerSkill * Math.max(0, (o.skillLevel || 1) - 1));
            // Phases choisies pour que le réticule croise le centre à `perfectAtMs` : un Parfait est toujours atteignable
            // (avec des phases libres, les deux oscillations pouvaient ne jamais se retrouver au centre pendant les 3 s).
            const perfectAtMs = cfg.perfectPassFromMs + rng() * (cfg.perfectPassToMs - cfg.perfectPassFromMs);
            return {
                outerRadius: Math.min(0.9, (cfg.outerRadius + bonus) * f),
                centerRadius: Math.min(0.5, (cfg.centerRadius + bonus / 2) * f),
                amplitude: cfg.amplitude, periodXMs: cfg.periodXMs, periodYMs: cfg.periodYMs,
                perfectAtMs,
                phaseX: typeof o.phaseX === 'number' ? o.phaseX : -(perfectAtMs / cfg.periodXMs) * Math.PI * 2,
                phaseY: typeof o.phaseY === 'number' ? o.phaseY : -(perfectAtMs / cfg.periodYMs) * Math.PI * 2,
                durationMs: o.durationMs || cfg.durationMs
            };
        }
    },
    // Points faibles (V2) : un choix tactique, sans adresse. Seule l'hésitation (temps écoulé) est un Raté.
    weakpoint: {
        label: 'Point faible', icon: '🦴', hint: 'Choisissez où frapper.',
        autoRates: { perfect: 0, success: 100, fail: 0 },
        build(rng, o) { return { durationMs: o.durationMs || MINIGAME_SETTINGS.weakpoint.durationMs }; },
        autoResolve() { return { outcome: 'success', detail: { zone: 'head' } }; }
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

// --- V2 : maintien (Immobiliser / Étrangler) ---------------------------------------------------------------------
function buildHoldParams(cfg, rng, o) {
    const width = o.zoneWidth || cfg.zoneWidth;
    return {
        zoneWidth: width,
        periodMs: o.periodMs || cfg.periodMs,
        phase: typeof o.phase === 'number' ? o.phase : rng() * Math.PI * 2,
        perfectRatio: o.perfectRatio || cfg.perfectRatio,
        successRatio: o.successRatio || cfg.successRatio,
        durationMs: o.durationMs || cfg.durationMs
    };
}

// Largeur de la zone selon le niveau de la compétence liée (Mains nues) : +0,01 par niveau, bornée.
function holdZoneWidth(kindKey, skillLevel) {
    const cfg = MINIGAME_SETTINGS[kindKey];
    return Math.round((cfg.zoneWidth + Math.min(cfg.zoneSkillMax, cfg.zonePerSkill * Math.max(0, skillLevel - 1))) * 1000) / 1000;
}

// Centre de la zone (0..1) : va-et-vient sinusoïdal, toujours entièrement dans la barre.
function holdZoneCenter(elapsedMs, spec) {
    const amp = 0.5 - spec.zoneWidth / 2 - 0.02;
    return 0.5 + amp * Math.sin((elapsedMs / spec.periodMs) * Math.PI * 2 + spec.phase);
}

function holdInside(cursorX, center, zoneWidth) {
    return cursorX !== null && cursorX !== undefined && Math.abs(cursorX - center) <= zoneWidth / 2;
}

// Issue selon la part du temps passée dans la zone (0..1).
function holdOutcome(ratio, spec) {
    if (ratio >= spec.perfectRatio) return 'perfect';
    return ratio >= spec.successRatio ? 'success' : 'fail';
}

// Immobiliser : nombre de tours d'immobilisation (Parfait = 2 ; Réussi = 1 ; un boss n'est jamais immobilisé plus d'un tour).
function grappleRounds(outcome, isBoss) {
    const c = MINIGAME_SETTINGS.grapple;
    if (outcome === 'fail') return 0;
    if (isBoss) return c.roundsBoss;
    return outcome === 'perfect' ? c.roundsPerfect : c.roundsSuccess;
}

// --- V2 : cible de précision ---------------------------------------------------------------------------------------
// La cible rétrécit avec l'écart de combat (-6 % par cran, jamais sous 50 %).
function targetSizeFactor(distance) {
    const c = MINIGAME_SETTINGS.target;
    return Math.max(c.minSizeFactor, 1 - c.distanceShrink * Math.max(0, distance));
}

// Position du réticule (repère -1..1) : deux oscillations de périodes différentes (trajet de Lissajous).
function targetReticlePosition(elapsedMs, spec) {
    return {
        x: spec.amplitude * Math.sin((elapsedMs / spec.periodXMs) * Math.PI * 2 + spec.phaseX),
        y: spec.amplitude * Math.sin((elapsedMs / spec.periodYMs) * Math.PI * 2 + spec.phaseY)
    };
}

// Tir à la position `pos` : Parfait au centre, Réussi dans la cible, sinon Raté.
function resolveTargetShot(pos, spec) {
    const d = Math.hypot(pos.x, pos.y);
    if (d <= spec.centerRadius) return 'perfect';
    return d <= spec.outerRadius ? 'success' : 'fail';
}

// --- V2 : points faibles -------------------------------------------------------------------------------------------
// Chaque zone échange des dégâts contre un effet (chiffres de départ, à valider en playtest).
const WEAKPOINT_ZONES = {
    head: { icon: '🎯', label: 'Tête', text: 'Dégâts +30 %', dmgMult: 1.3 },
    arm: { icon: '💪', label: 'Bras', text: 'ATQ du mob −25 % (2 tours), dégâts −20 %', dmgMult: 0.8, weaken: { mult: 0.75, rounds: 2 } },
    leg: { icon: '🦵', label: 'Jambe', text: 'Le mob recule d\'un cran, dégâts −20 %', dmgMult: 0.8, push: 1 }
};

// --- V2 : Occasions de combat ----------------------------------------------------------------------------------------
// Une Occasion est une action spéciale proposée de façon aléatoire au début d'un tour (bouton mis en avant, ce tour seulement).
const OCCASION_TYPES = {
    immobilize: { icon: '🤼', label: 'Immobiliser', kind: 'grapple', skill: 'unarmed' },
    strangle: { icon: '🪢', label: 'Étrangler', kind: 'choke', skill: 'unarmed' },
    target: { icon: '🎯', label: 'Viser', kind: 'target', skill: 'weapon' },
    weakpoint: { icon: '🦴', label: 'Point faible', kind: 'weakpoint', skill: 'weapon' }
};

// Occasions possibles dans cette situation. ctx : { distance, hasRanged, disarmed, isBoss, immobilized }.
//  - `forced` : Étrangler, proposé à coup sûr (sans tirage) dès qu'un mob non-boss au contact est immobilisé / étourdi ;
//  - `pool` : le reste, tiré au sort (au contact : Immobiliser ; à distance avec une arme à distance : Cible ou Point faible).
function eligibleOccasions(ctx) {
    const out = { forced: null, pool: [] };
    if (ctx.distance <= 0) {
        if (ctx.immobilized) { if (!ctx.isBoss) out.forced = 'strangle'; }
        else out.pool.push('immobilize');
    } else if (ctx.hasRanged && !ctx.disarmed) {
        out.pool.push('target', 'weakpoint');
    }
    return out;
}

function occasionStillValid(type, ctx) {
    const e = eligibleOccasions(ctx);
    return e.forced === type || e.pool.includes(type);
}

// Chance d'Occasion d'un tour : base du réglage + un peu selon le niveau de la compétence liée.
function occasionChancePct(mode, skillLevel) {
    const base = MINIGAME_SETTINGS.occasionChancePct[mode] || 0;
    if (base <= 0) return 0;
    const c = MINIGAME_SETTINGS.occasion;
    return base + Math.min(c.skillBonusMax, c.skillBonusPerLevel * Math.max(0, (skillLevel || 1) - 1));
}

// Décide de l'Occasion de CE tour (pure). input : { ctx, mode, skillLevels: { unarmed, weapon }, turn, lastOfferTurn, pity }.
// Jamais en Jet automatique ; Étrangler est garanti ; jamais deux Occasions tirées d'affilée ; garantie après `pityCombats` combats sans.
function decideOccasion(input, rng = Math.random) {
    if (input.mode === 'auto' || !MINIGAME_MODES.includes(input.mode)) return null;
    const e = eligibleOccasions(input.ctx);
    if (e.forced) return e.forced;
    if (!e.pool.length) return null;
    if (input.lastOfferTurn === input.turn - 1) return null; // pas deux Occasions de suite
    const pityHit = input.pity >= MINIGAME_SETTINGS.occasion.pityCombats;
    if (!pityHit) {
        const skill = OCCASION_TYPES[e.pool[0]].skill;
        const chance = occasionChancePct(input.mode, (input.skillLevels || {})[skill]);
        if (rng() * 100 >= chance) return null;
    }
    return e.pool[Math.min(e.pool.length - 1, Math.floor(rng() * e.pool.length))];
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
    // Combat (V2) : l'éclat tombe sur le mob (prise, étranglement, impact de tir) ; un Raté se perd à côté.
    grapple: {
        perfect: { burst: 'grapple', color: '#facc15', target: 'mob', durationMs: 460 },
        success: { burst: 'grapple', color: '#fdba74', target: 'mob', durationMs: 380 },
        fail: { burst: 'fizzle', color: '#9ca3af', target: 'mob', durationMs: 340 }
    },
    choke: {
        perfect: { burst: 'choke', color: '#f87171', target: 'mob', durationMs: 460 },
        success: { burst: 'choke', color: '#fca5a5', target: 'mob', durationMs: 380 },
        fail: { burst: 'fizzle', color: '#9ca3af', target: 'mob', durationMs: 340 }
    },
    target: {
        perfect: { burst: 'bullseye', color: '#facc15', target: 'mob', durationMs: 460 },
        success: { burst: 'bullseye', color: '#fde68a', target: 'mob', durationMs: 380 },
        fail: { burst: 'ricochet', color: '#9ca3af', target: 'mob', durationMs: 340 }
    },
    weakpoint: {
        perfect: { burst: 'weakMark', color: '#f87171', target: 'mob', durationMs: 420 },
        success: { burst: 'weakMark', color: '#fb923c', target: 'mob', durationMs: 380 },
        fail: { burst: 'ricochet', color: '#9ca3af', target: 'mob', durationMs: 340 }
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
        sequenceOutcome, sequenceShownSymbol, GLYPH_GRID_POINTS, GLYPH_PATTERNS, getGlyphPattern, glyphSegmentDistance, glyphAdvance,
        buildHoldParams, holdZoneWidth, holdZoneCenter, holdInside, holdOutcome, grappleRounds, targetSizeFactor, targetReticlePosition,
        resolveTargetShot, WEAKPOINT_ZONES, OCCASION_TYPES, eligibleOccasions, occasionStillValid, occasionChancePct, decideOccasion
    };
}
