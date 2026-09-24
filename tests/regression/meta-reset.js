// meta-reset.js — Test MÉTA (Tâche 3 du chantier "fiabilisation") : détecte AUTOMATIQUEMENT les fuites
// d'état entre tests dues à un resetTransientState() incomplet, plutôt que de laisser un futur oubli
// se traduire par un échec flaky lointain (voir historique : timeLeft oublié en PR #14, champs
// d'anomalies en PR #20, un cas travelToCity — trois incidents distincts avant ce test, plus deux
// nouveaux repérés en écrivant celui-ci : xp/xpToNextLevel/skills non resetés avec level, et
// pendingCompanionCandidate/pendingSneakAttack/pendingStairAfterCombat non resetés avec leur
// ChoicePending associé — corrigés dans _helpers.js au passage).
//
// Deux mécanismes AUTOMATIQUES (ne nécessitent PAS de maintenir une liste à la main pour chaque
// nouveau champ transitoire — seule la liste blanche de complétude, plus bas, doit être étendue) :
//   1. Convention de nommage : tout champ de gameState nommé `*ChoicePending` ou `pending*` DOIT être
//      falsy (false/null) juste après resetTransientState() — cette convention est déjà strictement
//      respectée par tout état bloquant/transitoire existant dans app.js (voir CLAUDE.md).
//   2. Cohérence isActionBlocked() <-> resetTransientState() : toute clé de gameState LUE par
//      isActionBlocked() (l'OR-chain qui bloque les actions du joueur) doit être explicitement
//      AFFECTÉE (`gameState.x = ...`) dans le corps de resetTransientState() — sans quoi un nouveau
//      `xyzChoicePending` ajouté à isActionBlocked() sans l'ajouter au reset laisserait un blocage
//      fantôme se propager d'un test à l'autre.
// Complétés par une liste blanche EXPLICITE de toutes les clés connues de gameState (dérivée de
// saveGame(), qui persiste l'objet entier tel quel — donc "toutes les clés que le jeu connaît") : si
// une clé apparaît sur gameState sans être dans cette liste (ou inversement), ce test échoue et force
// une décision consciente — transitoire : ajouter le reset (+ convention de nommage si possible) ;
// persistant : ajouter juste le nom ici.
const { assert, resetTransientState } = require('./_helpers.js');

// Étendre cette liste dès qu'un nouveau champ est ajouté à gameState (voir app.js). Un champ présent
// sur gameState mais absent d'ici (ou l'inverse) fait échouer ce test délibérément.
const KNOWN_GAMESTATE_KEYS = [
    'activeAnomalies', 'anomalyEffects', 'atk', 'baseMaxHp', 'bossChoicePending',
    'cardsDrawnThisFloor', 'combatDistance', 'companion', 'companionChoicePending',
    'currentDistrict', 'currentEnemy', 'currentFloor', 'def', 'engageDefHalved', 'equipment', 'fleesThisRun',
    'floorMap', 'floorStats', 'floorTransitionPending', 'gold', 'hasWon', 'hp', 'inCombat',
    'inventory', 'knownLocations', 'lairChoicePending', 'lastPlayerActionWasBackfire',
    'lastSavedAt', 'level', 'mana', 'maxHp', 'maxInventory', 'maxMana', 'maxTime', 'necrologie',
    'pactBlessingDelta', 'pactChoicePending', 'pendingBossEncounter', 'pendingBossRoomId',
    'pendingCompanionCandidate', 'pendingLairDive', 'pendingLairId', 'pendingNextFloorAnomalies',
    'pendingShopCityId', 'pendingSneakAttack', 'pendingStairAfterCombat', 'pendingStealthEncounter',
    'pendingTravel', 'pendingUrbanAdvanceAfterCombat', 'pendingUrbanBossCityId',
    'pendingUrbanBossEncounter', 'pendingUrbanTravel', 'playerName', 'saveEnabled',
    'shopChoicePending', 'skills', 'spellbook', 'status', 'stealthChoicePending', 'timeLeft',
    'urbanMap', 'xp', 'xpToNextLevel'
];

// --- Complétude : gameState n'a ni plus ni moins de clés que la liste blanche ci-dessus ----------
{
    resetTransientState();
    const actualKeys = Object.keys(gameState);
    const known = new Set(KNOWN_GAMESTATE_KEYS);
    const unexpected = actualKeys.filter(k => !known.has(k));
    const missing = KNOWN_GAMESTATE_KEYS.filter(k => !actualKeys.includes(k));
    assert(unexpected.length === 0,
        `Test méta : nouvelle(s) clé(s) sur gameState absente(s) de KNOWN_GAMESTATE_KEYS (tests/regression/meta-reset.js) : ${unexpected.join(', ')} — ajouter le nom à la liste (et un reset dans _helpers.js si transitoire).`);
    assert(missing.length === 0,
        `Test méta : clé(s) répertoriée(s) dans KNOWN_GAMESTATE_KEYS mais absente(s) de gameState : ${missing.join(', ')} — champ renommé ou supprimé ? Mettre à jour la liste.`);
}

// --- Convention de nommage : tout champ *ChoicePending / pending* redevient falsy après reset ----
// IMPORTANT : on DIRTIE chaque champ (valeur truthy arbitraire) AVANT resetTransientState(), sinon ce
// test ne vérifierait rien — un champ qui vaut déjà false/null par défaut resterait "vert" même si
// resetTransientState() n'a AUCUNE ligne pour lui (repéré en validant ce test lui-même : une première
// version sans ce "dirtying" ne détectait pas une régression injectée délibérément).
{
    const transientByNaming = KNOWN_GAMESTATE_KEYS.filter(k => /ChoicePending$/.test(k) || /^pending/i.test(k));
    assert(transientByNaming.length >= 20,
        "Test méta : la convention de nommage *ChoicePending/pending* doit couvrir un nombre substantiel de champs (sanity check anti-régression de ce test lui-même — si ce nombre chute, la liste blanche ci-dessus a probablement un problème).");
    for (const key of transientByNaming) {
        gameState[key] = true; // Truthy arbitraire : valide aussi bien pour un booléen qu'un "pending*" objet/id
        resetTransientState();
        assert(!gameState[key],
            `Test méta : gameState.${key} (convention *ChoicePending/pending*) n'est pas falsy juste après resetTransientState(), alors qu'il a été délibérément "sali" juste avant — ajouter "gameState.${key} = false;" ou "= null;" dans _helpers.js.`);
    }
}

// --- Cohérence isActionBlocked() <-> resetTransientState() ---------------------------------------
{
    const blockingRefs = new Set();
    const refRe = /gameState\.(\w+)/g;
    const blockedSrc = isActionBlocked.toString();
    let m;
    while ((m = refRe.exec(blockedSrc))) blockingRefs.add(m[1]);
    assert(blockingRefs.size >= 5,
        "Test méta : isActionBlocked() doit référencer plusieurs champs de gameState (sanity check anti-régression de ce test lui-même).");

    const resetAssigned = new Set();
    const assignRe = /gameState\.(\w+)\s*=(?!=)/g;
    const resetSrc = resetTransientState.toString();
    while ((m = assignRe.exec(resetSrc))) resetAssigned.add(m[1]);

    for (const key of blockingRefs) {
        assert(resetAssigned.has(key),
            `Test méta : isActionBlocked() lit gameState.${key}, mais resetTransientState() ne l'affecte jamais (_helpers.js) — ajouter "gameState.${key} = ...;" dedans, sans quoi un blocage fantôme peut fuiter d'un test à l'autre.`);
    }
}
