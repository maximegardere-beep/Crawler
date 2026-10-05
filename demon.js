// demon.js — Gorgoth le Concierge, Boss de Niveau (chantier 17, lot 2 : moteur du combat démoniaque).
// Module PUR, sur le modèle d'origins.js / encounters.js : aucune lecture de gameState ni du DOM, tous les
// paramètres sont explicites et le hasard est injectable (`rng`). Les chiffres vivent dans `config.demonBoss`
// (app.js), passés ici en paramètre `tuning` — la même source pour le moteur et les tests.
// Le branchement (riposte, mort, expulsion, mise au tapis, sauvegarde) vit dans app.js, section
// « BOSS DE NIVEAU : GORGOTH LE CONCIERGE ». Les noms de globales sont préfixés `demon`/`DEMON` : tous les
// catalogues partagent l'espace global.

const DEMON_NAME = 'Gorgoth le Concierge';

// Les quatre styles d'attaque du crawler (clés de `gameState.demon.scars` et de `demonFight.dmgByStyle`).
const DEMON_STYLES = ['melee', 'ranged', 'magic', 'unarmed'];
// Style opposé : chaque cran de Cicatrice sur un style rend Gorgoth plus fragile au style opposé.
const DEMON_OPPOSITE_STYLE = { melee: 'ranged', ranged: 'melee', magic: 'unarmed', unarmed: 'magic' };
// `gameState.lastAttackKind` → style de Cicatrice.
const DEMON_ATTACK_KIND_STYLES = { weapon: 'melee', ranged: 'ranged', magic: 'magic', unarmed: 'unarmed' };

// Intentions annoncées (une par tour). `answer` = la bonne réponse, affichée au joueur ; `hitKey` = clé du
// pourcentage de PV max du joueur dans `tuning.intents` (coup avant mitigation), absente pour une intention sans dégâts.
const DEMON_INTENTS = {
    scythe: {
        label: 'Fauche', icon: '🌙',
        description: 'Un revers de lame ardente au ras du sol.',
        answer: "Tenez-vous à distance, ou reculez (S'éloigner) : esquivée, et votre prochain coup porte +30 %."
    },
    blaze: {
        label: 'Brasier', icon: '🔥',
        description: 'Il crache une nappe de feu sur toute la salle.',
        answer: 'Collez-vous à lui : au contact, le brasier passe au-dessus de vous.'
    },
    grip: {
        label: 'Emprise', icon: '🫳',
        description: 'Sa volonté se referme sur votre esprit (+25 Emprise).',
        answer: "Attaquez à la Magie (ou comptez sur votre compétence Magie pour lui résister)."
    },
    guard: {
        label: 'Garde', icon: '🛡️',
        description: 'Il croise ses avant-bras de basalte : DEF ×2 ce tour-ci.',
        answer: 'Chargez-le : la charge brise sa garde.'
    },
    whip: {
        label: 'Fouet', icon: '⛓️',
        description: 'Son trousseau de clés ardent vous happe et vous ramène au contact.',
        answer: "Inévitable : préparez-vous à le recevoir (dégâts légers, écart ramené à 0)."
    }
};
const DEMON_INTENT_KEYS = Object.keys(DEMON_INTENTS);

// Statistiques de Gorgoth, calées sur le profil du crawler (`getPlayerCombatProfile()` : { maxHp, atk, def }).
// PV = hpMult × PV max du joueur ; DEF = defShare × ATQ effective ; coup de base (ATQ) = baseHitPct × PV max.
// Chaque mise au tapis passée ajoute `perKnockout` aux PV et aux dégâts ; la forme finale (étage 18) perd
// en plus `fatigue` PV par mise au tapis passée (plafond `fatigueCap`).
function computeDemonStats(profile, { knockouts = 0, final = false, tuning } = {}) {
    const p = profile || {};
    const maxHp = Math.max(1, p.maxHp || 1);
    const ko = Math.max(0, knockouts || 0);
    const growth = 1 + tuning.perKnockout * ko;
    const fatigue = final ? demonFatigueMult(ko, tuning) : 1;
    return {
        hp: Math.max(1, Math.round(maxHp * tuning.hpMult * growth * fatigue)),
        atk: Math.max(1, Math.round(maxHp * tuning.baseHitPct * growth)),
        def: Math.max(0, Math.round((p.atk || 0) * tuning.defShare)),
        growth,
        fatigue
    };
}

// Acte courant selon le ratio de PV restants : 1 (> act2At), 2 (> act3At), 3 ; 4 (« Dernier souffle ») sous
// `finalActAt` en forme finale seulement.
function demonActFor(hpRatio, final, tuning) {
    const r = Number.isFinite(hpRatio) ? hpRatio : 1;
    if (final && r < tuning.finalActAt) return 4;
    if (r > tuning.act2At) return 1;
    if (r > tuning.act3At) return 2;
    return 3;
}

// Écart maximal autorisé par l'acte (la salle se resserre) ; `null` = aucun plafond propre (celui du combat).
function demonMaxDistanceForAct(act, tuning) {
    const cap = tuning.maxDistanceByAct ? tuning.maxDistanceByAct[act] : undefined;
    return Number.isFinite(cap) ? cap : null;
}

// Compte à rebours du Cataclysme à l'entrée d'un acte (0 = aucun compte à rebours dans cet acte).
function demonCountdownForAct(act, tuning) {
    if (act >= 4) return tuning.finalCountdown;
    if (act >= 3) return tuning.cataclysmCountdown;
    return 0;
}

// Chaînes encore intactes à l'acte 1 : une se brise tous les `chainBreakPct` de PV perdus (purement visuel/sonore).
function demonChainsLeft(hpRatio, tuning) {
    const lost = Math.max(0, 1 - (Number.isFinite(hpRatio) ? hpRatio : 1));
    return Math.max(0, Math.min(tuning.chains, tuning.chains - Math.floor(lost / tuning.chainBreakPct + 1e-9)));
}

// Tire l'intention du prochain tour : poids de base de `tuning.intentWeights`, Fouet et Brasier favorisés à
// distance, Fauche au contact, Emprise plus fréquente à partir de l'acte 2 ; jamais deux fois la même d'affilée.
// `hidden` : intention masquée « ??? » (chance `tuning.hiddenChance`).
function pickDemonIntent(rng, { act = 1, distance = 0, lastKey = null } = {}, tuning) {
    const rand = typeof rng === 'function' ? rng : () => 0.5;
    const weights = {};
    DEMON_INTENT_KEYS.forEach(key => {
        let w = (tuning.intentWeights && tuning.intentWeights[key]) || 1;
        if (distance > 0 && (key === 'blaze' || key === 'whip')) w *= 1.5;
        if (distance <= 0 && key === 'scythe') w *= 1.5;
        if (act >= 2 && key === 'grip') w *= 1.5;
        if (key === lastKey) w = 0;
        weights[key] = w;
    });
    const total = DEMON_INTENT_KEYS.reduce((sum, k) => sum + weights[k], 0);
    let roll = rand() * total;
    let key = DEMON_INTENT_KEYS.find(k => weights[k] > 0) || 'scythe';
    for (const k of DEMON_INTENT_KEYS) {
        if (weights[k] <= 0) continue;
        if (roll < weights[k]) { key = k; break; }
        roll -= weights[k];
    }
    return { key, hidden: rand() < tuning.hiddenChance, revealed: false };
}

// Chance (%) de révéler une intention masquée (compétence Furtivité) ou de résister à l'Emprise (compétence Magie).
function demonSkillChance(level, tuning) {
    return Math.min(tuning.skillChanceMax, tuning.skillChancePerLevel * Math.max(0, level || 0));
}

// Résout l'intention annoncée face à l'action du joueur ce tour-ci. `action` ∈ 'weapon'|'ranged'|'unarmed'|
// 'magic'|'sprint'|'retreat'|'engage'|'other' ; `ctx.distance` = écart APRÈS l'action du joueur ;
// `ctx.magicResist` = jet de compétence Magie réussi (Emprise). Renvoie { countered, bonusMult, empriseDelta } :
// `countered` = l'intention est annulée (bonne réponse), `bonusMult` = multiplicateur du prochain coup du joueur,
// `empriseDelta` = variation de la jauge propre à l'intention (hors hausse par tour).
function resolveIntentResponse(intentKey, action, ctx = {}, tuning = null) {
    const distance = ctx.distance || 0;
    const good = tuning ? -tuning.emprise.goodAnswer : -10;
    const gripGain = tuning ? tuning.emprise.gripGain : 25;
    const scytheBonus = tuning ? tuning.scytheCounterBonus : 1.3;
    switch (intentKey) {
        case 'scythe':
            // Reculer n'esquive que si l'écart s'est réellement ouvert (un recul raté ou une ruée laisse au contact).
            if (distance > 0) return { countered: true, bonusMult: action === 'retreat' ? scytheBonus : 1, empriseDelta: good };
            return { countered: false, bonusMult: 1, empriseDelta: 0 };
        case 'blaze':
            if (distance <= 0) return { countered: true, bonusMult: 1, empriseDelta: good };
            return { countered: false, bonusMult: 1, empriseDelta: 0 };
        case 'grip':
            if (action === 'magic' || ctx.magicResist) return { countered: true, bonusMult: 1, empriseDelta: good };
            return { countered: false, bonusMult: 1, empriseDelta: gripGain };
        case 'guard':
            if (action === 'engage') return { countered: true, bonusMult: 1, empriseDelta: good };
            return { countered: false, bonusMult: 1, empriseDelta: 0 };
        case 'whip':
        default:
            return { countered: false, bonusMult: 1, empriseDelta: 0 };
    }
}

// Jauge d'Emprise après un tour de Gorgoth : +perTurn, + la moitié du % de PV perdus, + l'Emprise de l'intention
// (non contrée), −goodAnswer par bonne réponse, −perfect par Parfait, −bigHit pour un gros coup du joueur. Bornée à
// [0, max]. `possessed` : la jauge a atteint le maximum (Possession) — `value` est alors déjà retombée à `possessionReset`.
function empriseAfterTurn(emprise, { hpLostPct = 0, countered = false, perfect = false, bigHit = false, gripped = false } = {}, tuning) {
    const e = tuning.emprise;
    let v = (emprise || 0) + e.perTurn + Math.max(0, hpLostPct) * e.hpLostFactor;
    if (gripped) v += e.gripGain;
    if (countered) v -= e.goodAnswer;
    if (perfect) v -= e.perfect;
    if (bigHit) v -= e.bigHit;
    v = Math.max(0, Math.min(e.max, Math.round(v)));
    if (v >= e.max) return { value: e.possessionReset, possessed: true };
    return { value: v, possessed: false };
}

// Style dominant d'un combat : celui qui a infligé au moins `share` (50 %) des dégâts, sinon le style du coup final.
function dominantStyle(dmgByStyle, finalStyle, share = 0.5) {
    const d = dmgByStyle || {};
    const total = DEMON_STYLES.reduce((sum, s) => sum + Math.max(0, d[s] || 0), 0);
    if (total > 0) {
        const top = DEMON_STYLES.find(s => (d[s] || 0) / total >= share);
        if (top) return top;
    }
    return DEMON_STYLES.includes(finalStyle) ? finalStyle : null;
}

// Multiplicateur des dégâts d'un style contre Gorgoth : résistance de SA Cicatrice (−20/−40/−60 %, plafonnée au
// cran 3 — jamais d'immunité aux dégâts) × faiblesse due aux Cicatrices du style opposé (+15 % par cran).
function scarResistMult(scars, style, tuning) {
    if (!DEMON_STYLES.includes(style)) return 1;
    const s = scars || {};
    const maxRank = tuning.scarResist.length - 1;
    const own = Math.max(0, Math.min(maxRank, s[style] || 0));
    const opposite = Math.max(0, Math.min(maxRank, s[DEMON_OPPOSITE_STYLE[style]] || 0));
    return (1 - tuning.scarResist[own]) * (1 + tuning.scarWeaknessPerRank * opposite);
}

// Au cran maximal, Gorgoth ignore les effets (qualificatifs, effets de sort) de ce style.
function demonImmuneToStyleEffects(scars, style, tuning) {
    return !!scars && DEMON_STYLES.includes(style) && (scars[style] || 0) >= tuning.scarResist.length - 1;
}

// Fatigue de la forme finale : −fatigue PV par mise au tapis passée, plafonnée à −fatigueCap.
function demonFatigueMult(knockouts, tuning) {
    return 1 - Math.min(tuning.fatigueCap, tuning.fatigue * Math.max(0, knockouts || 0));
}

// État persistant vierge (sauvegardé dans gameState.demon).
function createEmptyDemonState() {
    return { encounters: 0, knockouts: 0, expulsions: 0, scars: { melee: 0, ranged: 0, magic: 0, unarmed: 0 }, lastFloorFought: 0 };
}

// Complète un état persistant partiel ou absent (ancienne sauvegarde).
function normalizeDemonState(saved) {
    const base = createEmptyDemonState();
    if (!saved || typeof saved !== 'object') return base;
    const scars = Object.assign({}, base.scars, saved.scars || {});
    DEMON_STYLES.forEach(s => { scars[s] = Math.max(0, Math.min(3, Math.floor(scars[s] || 0))); });
    return {
        encounters: Math.max(0, saved.encounters || 0),
        knockouts: Math.max(0, saved.knockouts || 0),
        expulsions: Math.max(0, saved.expulsions || 0),
        scars,
        lastFloorFought: Math.max(0, saved.lastFloorFought || 0)
    };
}
