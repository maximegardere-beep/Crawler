// _helpers.js — infrastructure partagée par tous les modules de tests/regression/*.js : charge le
// jeu UNE SEULE fois (require() met en cache, peu importe combien de modules l'importent), et fournit
// assert()/resetTransientState() avec un compteur PARTAGÉ (`counts`, objet muté par référence) pour
// que l'agrégateur (tests/regression.test.js) puisse afficher un résumé global à la fin. Extrait tel
// quel de l'ancien regression.test.js monolithique (voir Tâche 2, CLAUDE.md) — aucune logique changée.
require('../test_stub.js');
const { loadGame } = require('../load_game.js');
loadGame();

// Chantier 15 : la Période d'essai (−40 % de dégâts subis au niveau 1, étages 1-3) fausserait tous les tests qui mesurent des dégâts exacts avec le crawler
// de départ (niveau 1, étage 1) — elle est donc NEUTRALISÉE par défaut ici (réduction nulle) et n'est réactivée que par `withTrial()`, dans tests/regression/early-game.js.
// Les valeurs validées restent lues sur `EARLY_GAME_TRIAL_DEFAULTS` (copie prise juste après le chargement du jeu).
const EARLY_GAME_TRIAL_DEFAULTS = Object.assign({}, config.earlyGame.trial);
config.earlyGame.trial.startReduction = 0;
function withTrial(fn) {
    config.earlyGame.trial.startReduction = EARLY_GAME_TRIAL_DEFAULTS.startReduction;
    try { return fn(); } finally { config.earlyGame.trial.startReduction = 0; }
}

// Chantier "lisibilité combat" : le séquenceur de tour (runCombatBeats() dans app.js) espace ses
// étapes via setTimeout plutôt que Promise/async-await (voir NOTES_COMBAT.md — une vraie Promise
// diffère TOUJOURS sa continuation en microtâche, même résolue en synchrone, ce qu'aucun stub ne
// peut contourner). Avec ce stub, TOUTE la chaîne de beats se déroule en synchrone sous Node, donc
// les tests qui appellent une fonction de riposte directement (combat-boss.js, combat-enrage.js...)
// et lisent gameState.hp juste après continuent de fonctionner sans aucune modification — même
// stub que tests/long_playthrough.js (voir son commentaire), repris ici pour la suite rapide.
global.setTimeout = (fn) => fn();

const counts = { failures: 0, passed: 0 };
function assert(cond, msg) {
    if (!cond) { counts.failures++; console.error("FAIL:", msg); }
    else counts.passed++;
}

function resetTransientState() {
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.combatDistance = 0;
    // Anomalies AVANT tout calcul de PV max : gameState.maxHp est DÉRIVÉ (voir recomputeMaxHp()) de
    // baseMaxHp × anomalyEffects.playerMaxHpMult — sans ce reset ici, un test antérieur ayant tiré/
    // appliqué une anomalie (PEAU_DE_VERRE notamment) fausserait silencieusement tous les tests
    // suivants qui ne s'y attendent pas (chance de furtivité, dégâts, etc. lisent tous
    // gameState.anomalyEffects directement).
    gameState.baseMaxHp = 100;
    gameState.atk = 10;
    gameState.def = 5;
    gameState.anomalyEffects = createNeutralAnomalyEffects();
    gameState.activeAnomalies = [];
    gameState.pendingNextFloorAnomalies = null;
    gameState.pactChoicePending = false;
    gameState.pactBlessingDelta = null;
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.add('hidden');
    recomputeMaxHp();
    gameState.hp = gameState.maxHp;
    // Chantier E ("QoL/équilibrage") : maxTime dépend désormais de currentFloor (voir
    // advanceToNextFloor()), mais resetTransientState() ne touche jamais currentFloor lui-même (déjà
    // le cas avant ce chantier — chaque test qui en a besoin le fixe explicitement) ; on retombe donc
    // sur la base fixe de config.floorTimeBudget.base pour l'isolation des tests, un test qui a
    // vraiment besoin du scaling par étage appelle advanceToNextFloor() lui-même.
    gameState.maxTime = config.floorTimeBudget.base;
    gameState.timeLeft = gameState.maxTime; // Jamais de temps épuisé résiduel entre deux tests sans rapport
    gameState.level = 1;
    // xp/xpToNextLevel AVEC level : un test qui fait progresser l'XP sans forcément déclencher de
    // montée de niveau (ou partiellement) laissait ces deux-là dériver de leur défaut (0/50) — repéré
    // par le test méta (tests/regression/meta-reset.js), qui compare le jeu de clés de gameState à
    // resetTransientState() pour détecter précisément ce genre d'oubli.
    gameState.xp = 0;
    gameState.xpToNextLevel = 50;
    gameState.skills = {
        weapon: { level: 1, xp: 0, xpToNext: 30 },
        unarmed: { level: 1, xp: 0, xpToNext: 30 },
        magic: { level: 1, xp: 0, xpToNext: 30 },
        stealth: { level: 1, xp: 0, xpToNext: 30 }
    };
    gameState.equipment = { weapon: null, armor: null, ranged: null, spell: null };
    gameState.mana = gameState.maxMana;
    gameState.spellbook = [];
    gameState.signaturesAwarded = [];
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    gameState.companion = null;
    gameState.bossChoicePending = false;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;
    if (ui.safehouseChoiceZone) ui.safehouseChoiceZone.classList.add('hidden');
    gameState.stealthChoicePending = false;
    gameState.encounterIntroPending = false;
    gameState.pendingStealthEncounter = null;
    gameState.pendingSneakAttack = false; // Même repéré par le test méta que xp/xpToNextLevel ci-dessus
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null; // Idem
    gameState.pendingBossEncounter = null;
    gameState.pendingBossRoomId = null;
    gameState.pendingStairAfterCombat = false; // Idem
    gameState.pendingTravel = null;
    gameState.hasWon = false;
    gameState.saveEnabled = false; // Jamais d'autosauvegarde fantôme entre deux tests sans rapport
    gameState.gold = 0;
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    gameState.starterBuff = null; // Buff de départ (chantier 14)
    gameState.race = null; // Race (chantier 13) : aucune
    gameState.crawlerClass = null; // Classe (chantier 13, lot 2)
    gameState.classAbilityUsed = false; // Capacité de classe (chantier 13, lot 3)
    gameState.raceChoicePending = false; // Choix de race/classe à l'étage 3 (chantier 13, lot 2)
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    gameState.pendingPactAfterOrigin = false;
    hideOriginOverlays();
    gameState.raceLastStandFloor = 0;
    gameState.plotArmorFloor = 0;
    gameState.eliteConventionEnded = true; // le message de fin de la Convention n'est testé que par early-game.js
    gameState.maxMana = 100;
    gameState.maxInventory = config.inventory.maxEquipment;
    gameState.pendingArcadeCityId = null; // Salle de jeux (V4)
    gameState.arcadeSession = null;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    gameState.pendingLairDive = null;
    gameState.floorTransitionPending = false;
    gameState.floorStats = { mobsKilled: 0, damageTaken: 0, itemsFound: 0, xpGained: 0 };
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    gameState.fleesThisRun = 0;
    gameState.lastPlayerActionWasBackfire = false;
    gameState.engageDefHalved = false;
    gameState.necrologie = [];
    gameState.runStats = createEmptyRunStats(); // Chronique de run (chantier 2)
    gameState.achievements = {};
    gameState.bounty = createEmptyBounty(); // Chasseurs de primes (chantier 3)
    gameState.pendingBountySquad = 0;
    gameState.showChoicePending = false; // Émission DeathWatch (chantier 4)
    gameState.pendingShow = null;
    gameState.pendingShowAfterPact = null;
    if (ui.showZone) ui.showZone.classList.add('hidden');
    gameState.pendingMinigame = null; // Mini-jeu ouvert (chantier 6)
    gameState.occasion = createOccasionState(); // Occasions de combat (chantier 6, V2)
    gameState.demon = createEmptyDemonState(); // Gorgoth le Concierge (chantier 17) : aucun antécédent
    gameState.demonFight = null;
    abortMinigame();
    if (ui.gameOverOverlay) ui.gameOverOverlay.classList.add('hidden');
}

// Même isolation pour l'Armure de scénario (un coup mortel aux étages 1-3 laisse 1 PV) : les tests de mort (Increvable, désamorçage raté...) restent valables ; réactivée par `withPlotArmor()`.
config.earlyGame.plotArmor.enabled = false;
function withPlotArmor(fn) {
    config.earlyGame.plotArmor.enabled = true;
    try { return fn(); } finally { config.earlyGame.plotArmor.enabled = false; }
}

// Écran plein écran d'entrée en combat (chantier 16) : neutralisé par défaut (les tests de combat avec une interface simulée — requestAnimationFrame factice —
// ne doivent pas s'arrêter sur lui) ; réactivé par `withEncounterIntro()`.
config.encounterIntro.enabled = false;
function withEncounterIntro(fn) {
    config.encounterIntro.enabled = true;
    try { return fn(); } finally { config.encounterIntro.enabled = false; }
}

module.exports = { assert, resetTransientState, counts, withTrial, withPlotArmor, withEncounterIntro, EARLY_GAME_TRIAL_DEFAULTS };
