// _helpers.js — infrastructure partagée par tous les modules de tests/regression/*.js : charge le
// jeu UNE SEULE fois (require() met en cache, peu importe combien de modules l'importent), et fournit
// assert()/resetTransientState() avec un compteur PARTAGÉ (`counts`, objet muté par référence) pour
// que l'agrégateur (tests/regression.test.js) puisse afficher un résumé global à la fin. Extrait tel
// quel de l'ancien regression.test.js monolithique (voir Tâche 2, CLAUDE.md) — aucune logique changée.
require('../test_stub.js');
const { loadGame } = require('../load_game.js');
loadGame();

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
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    gameState.companion = null;
    gameState.bossChoicePending = false;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    if (ui.safehouseChoiceZone) ui.safehouseChoiceZone.classList.add('hidden');
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.pendingSneakAttack = false; // Même repéré par le test méta que xp/xpToNextLevel ci-dessus
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null; // Idem
    gameState.pendingBossEncounter = null;
    gameState.pendingBossRoomId = null;
    gameState.pendingStairAfterCombat = false; // Idem
    gameState.pendingTravel = null;
    gameState.urbanMap = null;
    gameState.pendingUrbanTravel = null;
    gameState.pendingUrbanBossEncounter = null;
    gameState.pendingUrbanBossCityId = null;
    gameState.pendingUrbanAdvanceAfterCombat = null;
    gameState.hasWon = false;
    gameState.saveEnabled = false; // Jamais d'autosauvegarde fantôme entre deux tests sans rapport
    gameState.gold = 0;
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
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
    if (ui.gameOverOverlay) ui.gameOverOverlay.classList.add('hidden');
}

module.exports = { assert, resetTransientState, counts };
