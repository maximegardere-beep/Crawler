// long_playthrough.js — TIER LOURD, à lancer seulement quand la modification touche la boucle de
// jeu elle-même (combat, distance, compagnon, génération d'étage). Pour un changement de contenu
// isolé (item, quartier, texte), regression.test.js suffit. Auto-résolveur : force l'issue de
// chaque état bloquant pour dérouler des centaines de pas sans attendre de vrais délais.
require('./test_stub.js');
const { loadGame } = require('./load_game.js');
loadGame();

global.setTimeout = (fn) => fn(); // déroule les ripostes différées (COMBAT_BEAT_MS) sans attendre

let failures = 0;
function assert(cond, msg) { if (!cond) { failures++; console.error("FAIL:", msg); } }

let steps = 0, floorsCleared = 0, combatsWon = 0, bossesEncountered = 0;
let stealthEncounters = 0, companionEncounters = 0, eliteMobsSeen = 0, armorMechanicProcs = 0;
const seenErrors = [];

gameState.equipment.armor = { name: "Plastron d'Essai", baseArmor: 12, category: 'armors', mechanics: ['bleed', 'heal', 'adrenaline', 'stealth'] };
gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 12, category: 'weapons' };
gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 10, category: 'ranged' };

const MAX_STEPS = 600, MAX_FLOORS = 6;

try {
    while (steps < MAX_STEPS && floorsCleared < MAX_FLOORS && gameState.hp > 0 && gameState.timeLeft > 0) {
        steps++;
        if (gameState.timeLeft < 50) gameState.timeLeft = gameState.maxTime;

        if (gameState.bossChoicePending) {
            bossesEncountered++;
            if (gameState.currentEnemy && isEliteMob(gameState.currentEnemy)) eliteMobsSeen++;
            fightBossNow();
        } else if (gameState.stealthChoicePending) {
            stealthEncounters++;
            attemptStealthAttack();
        } else if (gameState.companionChoicePending) {
            companionEncounters++;
            const candidate = gameState.pendingCompanionCandidate;
            if (candidate && candidate.disposition === 'friendly') recruitCompanion();
            else attackCompanionEncounter();
        } else if (gameState.inCombat) {
            const enemy = gameState.currentEnemy;
            if (enemy && isEliteMob(enemy)) eliteMobsSeen++;
            if (enemy) {
                for (let round = 0; round < 3 && gameState.inCombat && gameState.hp > 20; round++) {
                    const atkBefore = enemy.atk;
                    enemyCounterAttack();
                    const st = enemy.status || {};
                    if (st.bleed || st.stunned || st.slowed || st.blinded || st.corroded || st.feared || enemy.atk < atkBefore) armorMechanicProcs++;
                    if (gameState.hp <= 0) break;
                }
                if (gameState.hp > 0 && gameState.inCombat && gameState.currentEnemy) {
                    gameState.currentEnemy.hp = -9999;
                    winCombat();
                    combatsWon++;
                }
            } else {
                gameState.inCombat = false;
                gameState.currentEnemy = null;
            }
        } else {
            explore();
        }

        assert(!Number.isNaN(gameState.hp), `hp devient NaN à l'étape ${steps}`);
        assert(gameState.hp <= gameState.maxHp, `hp dépasse maxHp à l'étape ${steps}`);
        assert(gameState.combatDistance >= 0 && gameState.combatDistance <= config.rangedCombat.maxDistance, `combatDistance hors bornes à l'étape ${steps}`);
        assert(!Number.isNaN(gameState.mana) && gameState.mana >= 0 && gameState.mana <= gameState.maxMana, `mana hors bornes à l'étape ${steps}`);
        if (gameState.companion) {
            assert(gameState.companion.leaveChance >= 0 && gameState.companion.leaveChance <= 100, `leaveChance hors bornes à l'étape ${steps}`);
        }
        if (gameState.currentFloor > floorsCleared) floorsCleared = gameState.currentFloor;
        if (gameState.hp <= 0) break;
    }
} catch (err) {
    seenErrors.push(err);
}

// Intégration compagnon : force un abandon via de VRAIS winCombat() répétés
try {
    gameState.companion = { name: "Intégration Test", xp: 0, level: 1, xpToNext: 30, leaveChance: 0, specialty: { type: 'scout', label: 'Éclaireur' }, hp: 40, maxHp: 40 };
    let combatsForCompanion = 0, abandoned = false;
    while (combatsForCompanion < 60 && !abandoned) {
        gameState.inCombat = true;
        gameState.currentEnemy = { name: "Cobaye Compagnon", hp: -9999, maxHp: 50, atk: 5, def: 2, xpReward: 15, status: {} };
        winCombat();
        combatsForCompanion++;
        if (!gameState.companion) abandoned = true;
    }
    assert(abandoned, `Le compagnon doit finir par abandonner via de vrais winCombat() (${combatsForCompanion} combats)`);
    assert(gameState.companionChoicePending !== true, "Aucun choix de compagnon ne doit rester bloqué après un abandon");
} catch (err) {
    seenErrors.push(err);
}

console.log(`Simulation : ${steps} pas, étage ${floorsCleared}, ${combatsWon} combats, ${bossesEncountered} boss, ${stealthEncounters} furtifs, ${companionEncounters} rencontres compagnon, ${eliteMobsSeen} élites, ${armorMechanicProcs} procs armure.`);
if (seenErrors.length > 0) console.error(seenErrors[0].stack);

assert(seenErrors.length === 0, "Aucune exception ne doit interrompre la simulation");
assert(steps > 50, "Progression significative attendue");
assert(floorsCleared >= 2, "Au moins l'étage 2 doit être atteint");
assert(combatsWon > 0, "Au moins un combat normal gagné");
assert(bossesEncountered > 0, "Au moins un boss rencontré");

console.log(failures === 0 ? "OK — tous les invariants tiennent." : `${failures} échec(s) d'invariant.`);
process.exit(failures === 0 ? 0 : 1);
