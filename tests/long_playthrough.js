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
let urbanFloorsSeen = 0, cityTravels = 0, winTriggered = false;
let shopEncounters = 0, lairEncounters = 0;
const seenErrors = [];

gameState.equipment.armor = { name: "Plastron d'Essai", baseArmor: 12, category: 'armors', mechanics: ['bleed', 'heal', 'adrenaline', 'stealth'] };
gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 12, category: 'weapons' };
gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 10, category: 'ranged' };

// MAX_FLOORS=7 (et non 6) : la boucle s'arrête dès que floorsCleared atteint ce plafond, donc
// s'arrêter à 6 quitterait la simulation à l'INSTANT où l'étage 6 (urbain) est atteint, sans jamais
// vraiment le traverser. 7 garantit un vrai passage sur les DEUX étages urbains (3 et 6) de cette
// plage, ainsi que la transition étage urbain -> étage classique (7) en sortie.
const MAX_STEPS = 600, MAX_FLOORS = 7;

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
        } else if (gameState.shopChoicePending) {
            // Ville spécialisée (marchand/professeur, voir triggerShopEncounter()) : achète/forme si
            // possible, repart dans tous les cas — pas de round-trip infini sur l'écran boutique.
            shopEncounters++;
            const shopCity = gameState.urbanMap.citiesById[gameState.pendingShopCityId];
            if (shopCity.role === 'merchant') {
                const affordable = shopCity.stock.findIndex(item => gameState.gold >= item.price);
                if (affordable >= 0) buyShopItem(affordable);
            } else if (shopCity.role === 'trainer') {
                trainSkill();
            }
            leaveShop();
        } else if (gameState.lairChoicePending) {
            // Repaire repéré (voir triggerLairChoice()) : alterne plonger/poursuivre pour exercer les
            // deux issues ; une plongée s'enchaîne ensuite via la branche inCombat ci-dessous, exactement
            // comme n'importe quel autre combat (winCombat() relance le suivant tout seul).
            lairEncounters++;
            if (steps % 2 === 0) diveIntoLair(); else declineLair();
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
        } else if (gameState.urbanMap) {
            // Étage urbain (multiple de 3) : explore() ne fait rien ici (floorMap est null), donc on
            // simule un déplacement vers une ville connue à la place — en priorité la ville gardienne
            // (escalier/Sortie) une fois repérée, sinon une ville connue au hasard pour continuer à
            // révéler le réseau (voir generateUrbanFloorMap()/travelToCity() dans app.js).
            urbanFloorsSeen++;
            const urbanMap = gameState.urbanMap;
            const reachable = Object.values(urbanMap.citiesById).filter(c => c.known && c.id !== urbanMap.currentCityId);
            if (reachable.length > 0) {
                const target = reachable.find(c => c.isStairs || c.isExit) || reachable[Math.floor(Math.random() * reachable.length)];
                travelToCity(target.id);
                cityTravels++;
            }
        } else {
            explore();
        }

        if (gameState.hasWon) winTriggered = true;

        assert(!Number.isNaN(gameState.hp), `hp devient NaN à l'étape ${steps}`);
        assert(gameState.hp <= gameState.maxHp, `hp dépasse maxHp à l'étape ${steps}`);
        assert(gameState.combatDistance >= 0 && gameState.combatDistance <= config.rangedCombat.maxDistance, `combatDistance hors bornes à l'étape ${steps}`);
        assert(!Number.isNaN(gameState.mana) && gameState.mana >= 0 && gameState.mana <= gameState.maxMana, `mana hors bornes à l'étape ${steps}`);
        if (gameState.companion) {
            assert(gameState.companion.leaveChance >= 0 && gameState.companion.leaveChance <= 100, `leaveChance hors bornes à l'étape ${steps}`);
        }
        if (gameState.urbanMap) {
            const um = gameState.urbanMap;
            assert(!!um.citiesById[um.currentCityId], `urbanMap.currentCityId invalide à l'étape ${steps}`);
            assert(Object.values(um.citiesById).some(c => c.isStairs || c.isExit), `Aucune ville gardienne (escalier/Sortie) à l'étape ${steps}`);
        }
        assert(!(gameState.floorMap && gameState.urbanMap), `floorMap et urbanMap ne devraient jamais être définis simultanément (étape ${steps})`);
        if (gameState.currentFloor > floorsCleared) floorsCleared = gameState.currentFloor;
        if (gameState.hp <= 0 || winTriggered) break;
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

// Intégration étage final : force l'arrivée à l'étage 18 (urbain, final) et vérifie que la victoire
// se déclenche bien en atteignant sa Sortie, gardée ou non, sans jamais générer d'étage 19.
let reachedFinalWin = false;
try {
    gameState.currentFloor = config.urbanFloors.finalFloor - 1;
    gameState.hp = gameState.maxHp;
    gameState.inCombat = false;
    gameState.bossChoicePending = false;
    gameState.pendingUrbanBossEncounter = null;
    gameState.hasWon = false;
    nextFloor(); // Génère l'étage final
    assert(gameState.urbanMap && gameState.urbanMap.isFinalFloor, "L'étage final doit générer un urbanMap marqué isFinalFloor");
    assert(Object.values(gameState.urbanMap.citiesById).some(c => c.isExit && c.guarded), "La Sortie de l'étage final doit toujours être gardée");

    let finalSteps = 0;
    while (!gameState.hasWon && finalSteps < 200) {
        finalSteps++;
        if (gameState.timeLeft < 50) gameState.timeLeft = gameState.maxTime;
        if (gameState.bossChoicePending) {
            fightBossNow();
        } else if (gameState.shopChoicePending) {
            leaveShop(); // Étage final : on ne s'attarde pas en boutique, priorité à la Sortie
        } else if (gameState.lairChoicePending) {
            declineLair(); // Idem : on ne dévie jamais vers un repaire quand la Sortie est en vue
        } else if (gameState.inCombat) {
            if (gameState.currentEnemy) {
                gameState.currentEnemy.hp = -9999;
                winCombat();
            } else {
                gameState.inCombat = false;
            }
        } else if (gameState.urbanMap) {
            const um = gameState.urbanMap;
            const reachable = Object.values(um.citiesById).filter(c => c.known && c.id !== um.currentCityId);
            if (reachable.length > 0) {
                const target = reachable.find(c => c.isExit) || reachable[Math.floor(Math.random() * reachable.length)];
                travelToCity(target.id);
            }
        }
    }
    reachedFinalWin = gameState.hasWon;
    assert(reachedFinalWin, `La victoire doit se déclencher en atteignant la Sortie de l'étage ${config.urbanFloors.finalFloor} (${finalSteps} pas)`);
    assert(gameState.currentFloor === config.urbanFloors.finalFloor, "Aucun étage au-delà de l'étage final ne doit jamais être généré");
} catch (err) {
    seenErrors.push(err);
}

console.log(`Simulation : ${steps} pas, étage ${floorsCleared}, ${combatsWon} combats, ${bossesEncountered} boss, ${stealthEncounters} furtifs, ${companionEncounters} rencontres compagnon, ${eliteMobsSeen} élites, ${armorMechanicProcs} procs armure, ${urbanFloorsSeen} pas urbains (${cityTravels} trajets), ${shopEncounters} boutiques, ${lairEncounters} repaires, victoire étage 3-7=${winTriggered}, victoire étage finale=${reachedFinalWin}.`);
if (seenErrors.length > 0) console.error(seenErrors[0].stack);

assert(seenErrors.length === 0, "Aucune exception ne doit interrompre la simulation");
assert(steps > 50, "Progression significative attendue");
assert(floorsCleared >= 2, "Au moins l'étage 2 doit être atteint");
assert(combatsWon > 0, "Au moins un combat normal gagné");
assert(bossesEncountered > 0, "Au moins un boss rencontré");
assert(urbanFloorsSeen > 0, "Au moins un étage urbain (étage 3, 6...) doit avoir été traversé sur 6 étages");

console.log(failures === 0 ? "OK — tous les invariants tiennent." : `${failures} échec(s) d'invariant.`);
process.exit(failures === 0 ? 0 : 1);
