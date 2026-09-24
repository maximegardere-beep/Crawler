// anomalies.js - Catalogue et résolution des anomalies d'étage (Tâche 4 du plan "chantiers").
// Module autonome (pas de dépendance à gameState au chargement, uniquement DANS le corps des
// fonctions — même convention que generator.js) : les 12 anomalies, leur tirage par tranche d'étage,
// la table d'incompatibilités, et le hook d'application UNIQUE (appliquerAnomalie()) qui replie leurs
// effets dans un objet plat consommé par app.js à chaque point d'usage concerné (dégâts, régén,
// économie, furtivité, magie...) plutôt que d'éparpiller des `if` anomalie par anomalie dans le code
// de combat.
//
// Chiffres non fournis par la consigne d'origine (poids de tirage, intensiteMin par anomalie, dégâts/
// trésor de CAFET_ASSOMBRIE, bonus/malus de PACTE_DU_CRAWLER) : valeurs de départ raisonnables, à
// ajuster par playtest réel comme le reste des chiffres d'équilibrage du jeu (voir CLAUDE.md, Backlog).

// ==========================================
// CATALOGUE (12 anomalies, 4 catégories)
// ==========================================
// `effects` : clés reconnues par mergeAnomalyEffectsInto() ci-dessous, consommées par app.js à leur
// point d'usage respectif (voir CLAUDE.md, section "Anomalies d'étage"). `tags` ∈ positif/négatif/
// mixte/cosmétique — les 12 anomalies du catalogue de départ n'ont que des effets à double tranchant
// (aucune n'est purement "positif"), sauf LABYRINTHE, purement pénalisante.
const ANOMALY_CATALOG = [
    // --- Combat / dégâts ---
    {
        id: 'ADRENALINE', name: 'Adrénaline', icon: '💉', category: 'combat',
        description: "Tous les dégâts, joueur ET mobs, sont augmentés de 40%.",
        poids: 10, intensiteMin: 4, tags: ['mixte'],
        effects: { allDamageMult: 1.4 }
    },
    {
        id: 'PEAU_DE_VERRE', name: 'Peau de Verre', icon: '🩹', category: 'combat',
        description: "PV max réduits de 30%, mais les soins reçus sont augmentés de 50%.",
        poids: 10, intensiteMin: 5, tags: ['mixte'],
        effects: { playerMaxHpMult: 0.7, healingMult: 1.5 }
    },
    {
        id: 'MOB_ENRAGE', name: 'Mobs Enragés', icon: '😡', category: 'combat',
        description: "Les mobs infligent 15% de dégâts en plus, mais rapportent 30% d'XP en plus.",
        poids: 10, intensiteMin: 3, tags: ['mixte'],
        effects: { mobAtkMult: 1.15, xpMult: 1.3 }
    },
    // --- Ressources ---
    {
        id: 'SECHERESSE', name: 'Sécheresse', icon: '🏜️', category: 'ressources',
        description: "Régénération de mana divisée par 2, mais deux fois plus de potions trouvées.",
        poids: 10, intensiteMin: 3, tags: ['mixte'],
        effects: { manaRegenMult: 0.5, potionDropMult: 2 }
    },
    {
        id: 'ECONOMIE_AUSTERE', name: 'Économie Austère', icon: '📉', category: 'ressources',
        description: "Or trouvé réduit de moitié, mais les marchands vendent 30% moins cher.",
        poids: 10, intensiteMin: 3, tags: ['mixte'],
        effects: { goldGainMult: 0.5, shopDiscountPct: 0.3 }
    },
    {
        id: 'REPAS_DE_FAMILLE', name: 'Repas de Famille', icon: '🍲', category: 'ressources',
        description: "Le séjour en salle sécurisée ne coûte plus de temps, mais aucune régénération passive hors salle sécurisée.",
        poids: 10, intensiteMin: 5, tags: ['mixte'],
        effects: { freeSafehouseMeals: true, regenOutsideSafehouseZero: true }
    },
    // --- Exploration / mécaniques ---
    {
        id: 'LABYRINTHE', name: 'Labyrinthe', icon: '🌀', category: 'exploration',
        description: "L'étage est 50% plus grand, et l'accès à l'escalier est bien mieux gardé.",
        poids: 10, intensiteMin: 6, tags: ['negatif'],
        effects: { extraRoomsPct: 0.5, guardedStairsBoost: true }
    },
    {
        id: 'NOCTURNE', name: 'Nocturne', icon: '🌙', category: 'exploration',
        description: "Plafonds de furtivité relevés de 10 points, mais détection des mobs augmentée de 10 points.",
        poids: 10, intensiteMin: 3, tags: ['mixte'],
        effects: { stealthCapBonus: 10, detectionBonus: 10 }
    },
    {
        id: 'ZONE_MAGIQUE', name: 'Zone Magique', icon: '✨', category: 'exploration',
        description: "Les sorts infligent 30% de dégâts en plus, mais le risque de backfire augmente de 5 points.",
        poids: 10, intensiteMin: 4, tags: ['mixte'],
        effects: { spellMult: 1.3, backfireBonusPct: 5 }
    },
    // --- Mixtes ---
    {
        id: 'PACTE_DU_CRAWLER', name: 'Pacte du Crawler', icon: '🤝', category: 'mixte',
        description: "Choix forcé à l'entrée de l'étage : bénédiction ATQ ou bénédiction PV — l'autre stat est nerfée en échange.",
        poids: 10, intensiteMin: 5, tags: ['mixte'],
        effects: { forcedPactChoice: true }
    },
    {
        id: 'CAFET_ASSOMBRIE', name: 'Cafétéria Assombrie', icon: '🕯️', category: 'mixte',
        description: "Une salle aléatoire de l'étage cache un piège sévère ET un trésor nettement supérieur à la normale.",
        poids: 10, intensiteMin: 3, tags: ['mixte'],
        effects: { cafetRoom: true }
    },
    {
        id: 'TEMPO_CREE', name: 'Tempo Créé', icon: '⏱️', category: 'mixte',
        description: "Les mobs frappent en premier à l'ouverture du combat, mais chaque action réussie donne 1 XP de compétence supplémentaire.",
        poids: 10, intensiteMin: 4, tags: ['mixte'],
        effects: { mobsActFirst: true, skillXpPerActionBonus: 1 }
    }
];

// Paires interdites (symétriques) — voir ROLL_ANOMALIES_MAX_ATTEMPTS ci-dessous pour leur usage.
const ANOMALY_INCOMPATIBILITIES = [
    ['SECHERESSE', 'ZONE_MAGIQUE'],
    ['PEAU_DE_VERRE', 'ADRENALINE']
];

function anomaliesAreCompatible(a, b) {
    if (!a || !b || a.id === b.id) return false;
    return !ANOMALY_INCOMPATIBILITIES.some(([x, y]) =>
        (a.id === x && b.id === y) || (a.id === y && b.id === x)
    );
}

// ==========================================
// TIRAGE PAR TRANCHE D'ÉTAGE
// ==========================================
function findAnomalyById(id) {
    return ANOMALY_CATALOG.find(a => a.id === id) || null;
}

// Tirage pondéré (poids) sur un sous-ensemble du catalogue. Pure (hors Math.random) : testable
// indépendamment du reste du pipeline, même logique que rollRarity() dans generator.js.
function pickWeightedAnomaly(pool) {
    if (!pool || pool.length === 0) return null;
    const total = pool.reduce((sum, a) => sum + (a.poids || 1), 0);
    let roll = Math.random() * total;
    for (const a of pool) {
        const w = a.poids || 1;
        if (roll < w) return a;
        roll -= w;
    }
    return pool[pool.length - 1];
}

const ROLL_ANOMALIES_MAX_ATTEMPTS = 20;

// Règles d'intensité (voir CLAUDE.md, section "Anomalies d'étage") :
//   - Étages 1-2 : aucune anomalie.
//   - Étages 3-6 : 1 anomalie, pool restreint (intensiteMin <= 3).
//   - Étages 7-11 : 1 anomalie, pool complet.
//   - Étages 12+ : 2 anomalies compatibles (table d'incompatibilités + au moins une des deux
//     non-positive), jusqu'à ROLL_ANOMALIES_MAX_ATTEMPTS tentatives, repli sur une seule anomalie
//     simple du pool complet si aucune paire compatible n'est trouvée.
// Retourne un tableau (0, 1 ou 2 entrées) de définitions d'anomalies (objets du catalogue).
function rollFloorAnomalies(floor) {
    if (floor <= 2) return [];

    const fullPool = ANOMALY_CATALOG;
    const lightPool = ANOMALY_CATALOG.filter(a => a.intensiteMin <= 3);

    if (floor <= 6) {
        const picked = pickWeightedAnomaly(lightPool);
        return picked ? [picked] : [];
    }
    if (floor <= 11) {
        const picked = pickWeightedAnomaly(fullPool);
        return picked ? [picked] : [];
    }

    // Étage 12+ : deux anomalies compatibles, au moins une non-positive.
    for (let attempt = 0; attempt < ROLL_ANOMALIES_MAX_ATTEMPTS; attempt++) {
        const a = pickWeightedAnomaly(fullPool);
        const b = pickWeightedAnomaly(fullPool.filter(x => x.id !== a.id));
        if (!a || !b || !anomaliesAreCompatible(a, b)) continue;
        const atLeastOneNonPositif = [a, b].some(x => x.tags.includes('negatif') || x.tags.includes('mixte'));
        if (atLeastOneNonPositif) return [a, b];
    }
    // Repli : une seule anomalie simple du pool complet.
    const fallback = pickWeightedAnomaly(fullPool);
    return fallback ? [fallback] : [];
}

// ==========================================
// APPLICATION DES EFFETS
// ==========================================
// Valeurs neutres : aucune anomalie active ne doit jamais changer le comportement du jeu par rapport
// à avant ce système (voir usage dans app.js, à chaque point de lecture concerné).
function createNeutralAnomalyEffects() {
    return {
        allDamageMult: 1,
        playerMaxHpMult: 1,
        healingMult: 1,
        mobAtkMult: 1,
        xpMult: 1,
        manaRegenMult: 1,
        potionDropMult: 1,
        goldGainMult: 1,
        shopDiscountPct: 0,
        freeSafehouseMeals: false,
        regenOutsideSafehouseZero: false,
        extraRoomsPct: 0,
        guardedStairsBoost: false,
        stealthCapBonus: 0,
        detectionBonus: 0,
        spellMult: 1,
        backfireBonusPct: 0,
        forcedPactChoice: false,
        cafetRoom: false,
        mobsActFirst: false,
        skillXpPerActionBonus: 0
    };
}

// Replie les effets d'UNE anomalie dans un objet d'effets déjà initialisé (neutre ou déjà partiellement
// rempli par une anomalie précédente). Multiplicatif pour les multiplicateurs (deux anomalies ×1.4 et
// ×1.2 sur la même stat -> ×1.68), additif pour les bonus en points (%, XP...), OR logique pour les
// drapeaux booléens — jamais de double application pour un même champ au sein d'une seule anomalie.
function mergeAnomalyEffectsInto(fx, anomaly) {
    const e = anomaly.effects || {};
    if (e.allDamageMult) fx.allDamageMult *= e.allDamageMult;
    if (e.playerMaxHpMult) fx.playerMaxHpMult *= e.playerMaxHpMult;
    if (e.healingMult) fx.healingMult *= e.healingMult;
    if (e.mobAtkMult) fx.mobAtkMult *= e.mobAtkMult;
    if (e.xpMult) fx.xpMult *= e.xpMult;
    if (e.manaRegenMult) fx.manaRegenMult *= e.manaRegenMult;
    if (e.potionDropMult) fx.potionDropMult *= e.potionDropMult;
    if (e.goldGainMult) fx.goldGainMult *= e.goldGainMult;
    if (e.shopDiscountPct) fx.shopDiscountPct += e.shopDiscountPct;
    if (e.freeSafehouseMeals) fx.freeSafehouseMeals = true;
    if (e.regenOutsideSafehouseZero) fx.regenOutsideSafehouseZero = true;
    if (e.extraRoomsPct) fx.extraRoomsPct += e.extraRoomsPct;
    if (e.guardedStairsBoost) fx.guardedStairsBoost = true;
    if (e.stealthCapBonus) fx.stealthCapBonus += e.stealthCapBonus;
    if (e.detectionBonus) fx.detectionBonus += e.detectionBonus;
    if (e.spellMult) fx.spellMult *= e.spellMult;
    if (e.backfireBonusPct) fx.backfireBonusPct += e.backfireBonusPct;
    if (e.forcedPactChoice) fx.forcedPactChoice = true;
    if (e.cafetRoom) fx.cafetRoom = true;
    if (e.mobsActFirst) fx.mobsActFirst = true;
    if (e.skillXpPerActionBonus) fx.skillXpPerActionBonus += e.skillXpPerActionBonus;
    return fx;
}

// Hook d'application UNIQUE (voir CLAUDE.md) : fusionne les effets d'une anomalie dans
// gameState.anomalyEffects (déjà réinitialisé à neutre par l'appelant avant le premier appel de la
// série — voir rollAndApplyFloorAnomalies() dans app.js). Signature (etage, anomalie) : `etage`
// n'influence aucun effet du catalogue actuel (tous indépendants de la profondeur), conservé pour
// permettre un futur effet scalant avec l'étage sans changer la signature de ce hook.
function appliquerAnomalie(etage, anomalie) {
    mergeAnomalyEffectsInto(gameState.anomalyEffects, anomalie);
    return gameState.anomalyEffects;
}

// Version pure (hors gameState), pour les tests : replie une LISTE d'anomalies en un objet d'effets
// neutre, sans toucher à aucun état global — vérifie le stacking indépendamment du pipeline de tirage
// aléatoire complet (même logique que computeThreatMultiplier() dans generator.js).
function computeAnomalyEffects(anomalyList) {
    const fx = createNeutralAnomalyEffects();
    (anomalyList || []).forEach(a => mergeAnomalyEffectsInto(fx, a));
    return fx;
}

// Orchestrateur appelé par advanceToNextFloor() (app.js), avant la génération de la carte du nouvel
// étage. Réutilise le tirage déjà fait par getUpcomingAnomalyAnnouncement() sur l'écran d'escalier
// (gameState.pendingNextFloorAnomalies) si présent et pour LE MÊME étage — pour que l'annonce affichée
// avant de cliquer "Continuer" corresponde exactement à ce qui est réellement appliqué ensuite — sinon
// tire à la volée (ex : devJumpToUrbanFloor(), qui saute délibérément l'écran d'escalier).
function rollAndApplyFloorAnomalies(floor) {
    let active;
    if (gameState.pendingNextFloorAnomalies && gameState.pendingNextFloorAnomalies.floor === floor) {
        active = gameState.pendingNextFloorAnomalies.anomalies;
    } else {
        active = rollFloorAnomalies(floor);
    }
    gameState.pendingNextFloorAnomalies = null;
    gameState.anomalyEffects = createNeutralAnomalyEffects();
    gameState.activeAnomalies = active;
    active.forEach(a => appliquerAnomalie(floor, a));
    return active;
}
