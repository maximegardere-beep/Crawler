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
let stealthEncounters = 0, companionEncounters = 0, companionGifts = 0, eliteMobsSeen = 0, armorMechanicProcs = 0;
let urbanFloorsSeen = 0, cityTravels = 0, mapTravels = 0, winTriggered = false;
let shopEncounters = 0, lairEncounters = 0, floorTransitionsSeen = 0, pactChoicesSeen = 0, safehouseEncounters = 0, stairsChoices = 0;
const seenErrors = [];
const huntersSeen = new Set(); // Chasseurs de primes rencontrés (chantier 3)
let showsSeen = 0;
let classAbilitiesUsed = 0; // Capacités de classe jouées (chantier 13, lot 3)
let originChoicesSeen = 0; // Race puis classe à l'étage 3 (chantier 13, lot 2) // Émissions DeathWatch (chantier 4)

gameState.equipment.armor = { name: "Plastron d'Essai", baseArmor: 12, category: 'armors', mechanics: ['bleed', 'heal', 'adrenaline', 'stealth'] };
gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 12, category: 'weapons' };
// Chantier 2 : une vraie partie (nom confirmé) pour que les succès se débloquent et que leurs boîtes
// s'ouvrent pendant la simulation — les invariants ci-dessous doivent tenir malgré ce butin en plus.
gameState.playerName = "Simulation";
gameState.saveEnabled = true;
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
        // Même principe pour les PV (hors combat) : la simulation vérifie des invariants, pas la survie — sans
        // ça, environ 1 simulation sur 16 mourait dès l'étage 1 (élite, piège, saignement) et échouait sur
        // « progression significative », y compris sur main avant le chantier 9.
        if (!gameState.inCombat && gameState.hp > 0 && gameState.hp < gameState.maxHp * 0.5) gameState.hp = gameState.maxHp;

        if (gameState.bossChoicePending) {
            bossesEncountered++;
            if (gameState.currentEnemy && isEliteMob(gameState.currentEnemy)) eliteMobsSeen++;
            fightBossNow();
        } else if (gameState.pendingMinigame) {
            skipMinigame(); // Mini-jeu (chantier 6) : jamais ouvert sous Node, mais l'auto-résolveur doit le connaître
        } else if (gameState.showChoicePending) {
            // Émission DeathWatch (chantier 4) : fait tourner les 5 réponses pour exercer boîtes et sanctions.
            showsSeen++;
            answerShow(['polite', 'retort', 'provoke', 'insult', 'refuse'][showsSeen % 5]);
        } else if (gameState.stairsChoicePending) {
            // Escalier libre (voir offerStairsChoice()) : la simulation descend toujours.
            stairsChoices++;
            descendStairs();
        } else if (gameState.safehouseChoicePending) {
            // Salle sécurisée (voir enterRoom()) : alterne sieste/sommeil/partir pour exercer les trois
            // issues — sans cette branche, la simulation resterait bloquée dessus (isActionBlocked()).
            // Un repos impossible (temps insuffisant) reste un no-op : on repart alors.
            safehouseEncounters++;
            const choice = steps % 3;
            if (choice === 0) restAtSafehouse('nap'); else if (choice === 1) restAtSafehouse('sleep');
            if (gameState.safehouseChoicePending) leaveSafehouse();
        } else if (gameState.encounterIntroPending) {
            dismissEncounterIntro(true); // écran de rencontre (chantier 16) : jamais bloqué dessus
        } else if (gameState.stealthChoicePending) {
            stealthEncounters++;
            attemptStealthAttack();
        } else if (gameState.companionChoicePending) {
            companionEncounters++;
            const candidate = gameState.pendingCompanionCandidate;
            if (candidate && candidate.disposition === 'friendly') recruitCompanion();
            else attackCompanionEncounter();
            // Rework des compagnons : exerce les dons (arme/armure de la réserve, sort du grimoire).
            if (gameState.companion && !gameState.inCombat) {
                const giftIndex = gameState.inventory.findIndex(i => i.category === 'weapons' || i.category === 'armors' || i.category === 'ranged');
                if (giftIndex >= 0 && giveItemToCompanion(giftIndex)) companionGifts++;
                if (gameState.spellbook.length > 0 && giveSpellToCompanion(0)) companionGifts++;
            }
        } else if (gameState.shopChoicePending) {
            // Ville spécialisée (marchand/professeur, voir triggerShopEncounter()) : achète/forme si
            // possible, repart dans tous les cas — pas de round-trip infini sur l'écran boutique.
            shopEncounters++;
            const shopCity = gameState.pendingArcadeCityId ? null : urbanCityById(gameState.pendingShopCityId);
            if (!shopCity) {
                // Salle de jeux (V4) : une partie de chaque jeu possible (jet automatique sous Node), puis on repart.
                gameState.gold = Math.max(gameState.gold, 20);
                ARCADE_GAME_KEYS.forEach(k => { if (gameState.arcadeSession === null) { ui.arcadeStake.value = '5'; playArcadeGame(k); } });
            } else if (shopCity.role === 'merchant') {
                const affordable = shopCity.stock.findIndex(item => gameState.gold >= item.price);
                if (affordable >= 0) buyShopItem(affordable);
            } else if (shopCity.role === 'trainer') {
                trainSkill();
            }
            leaveShop();
        } else if (gameState.demonArmoryChoicePending) {
            // Armurerie de Gorgoth (chantier 17, lot 4) : garde son objet démoniaque, sinon prend le premier du râtelier.
            if (gameState.demonArmory && gameState.demonArmory.heldKey) keepDemonicItem(); else takeDemonicItem(DEMONIC_ITEM_KEYS[0]);
        } else if (gameState.lairChoicePending) {
            // Repaire (voir triggerLairChoice()) : alterne plonger/ressortir pour exercer les
            // deux issues ; une plongée s'enchaîne ensuite via la branche inCombat ci-dessous, exactement
            // comme n'importe quel autre combat (winCombat() relance le suivant tout seul).
            lairEncounters++;
            if (steps % 2 === 0) diveIntoLair(); else declineLair();
        } else if (gameState.floorTransitionPending) {
            // Écran d'escalier (voir triggerFloorTransition()) : flag DÉDIÉ, jamais gameState.inCombat
            // (qui collisionnerait avec la branche générique ci-dessous) — sans cette branche, la
            // simulation resterait bloquée sur cet écran jusqu'à épuisement du temps imparti.
            floorTransitionsSeen++;
            continueFromFloorTransition();
        } else if (gameState.raceChoicePending || gameState.classChoicePending) {
            // Race puis classe à l'étage 3 (chantier 13, lot 2) : la simulation prend toujours la première carte proposée.
            originChoicesSeen++;
            selectOrigin(gameState.pendingOriginOffers.offers[0].key);
            confirmOriginChoice();
        } else if (gameState.pactChoicePending) {
            // Anomalie PACTE_DU_CRAWLER (voir triggerPactChoice()) : choix forcé à l'entrée de
            // l'étage, sans quoi la simulation resterait bloquée dessus (isActionBlocked()).
            pactChoicesSeen++;
            choosePactBlessing(steps % 2 === 0 ? 'atk' : 'hp');
        } else if (gameState.inCombat) {
            const enemy = gameState.currentEnemy;
            if (enemy && isEliteMob(enemy)) eliteMobsSeen++;
            // Capacité de classe (chantier 13, lot 3) : jouée dès qu'elle est disponible, pour exercer les 6 capacités dans la boucle de combat réelle.
            if (enemy && gameState.hp > gameState.maxHp * 0.5 && classAbilityStatus().usable) { classAbilitiesUsed++; useClassAbility(); }
            if (enemy && gameState.currentEnemy) {
                // Seuil à la moitié des PV max (et non 20 PV fixes) : un élite à deux modificateurs de l'étage 1
                // pouvait sinon tuer la simulation en 3 ripostes (voir le commentaire du soin plus haut).
                for (let round = 0; round < 3 && gameState.inCombat && gameState.hp > gameState.maxHp * 0.5; round++) {
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
        } else if (gameState.floorMap && (steps % 4 === 0 || (isUrbanFloor() && steps % 2 === 0))) {
            // Un pas sur quatre (un sur deux sur un étage urbain, chantier 12) passe par la carte — voyage vers
            // une salle visitée ou aperçue au hasard (travelToRoom(), M1 + P1), en priorité l'escalier libre ou
            // gardé une fois repéré, pour exercer trajets, embuscades et pas dans l'inconnu.
            const fm = gameState.floorMap;
            if (isUrbanFloor()) { urbanFloorsSeen++; cityTravels++; }
            const stairs = listFloorLandmarks().find(m => m.kind === 'stairs' || m.kind === 'stairsGuarded');
            const options = Object.values(fm.roomsById).filter(r => r.id !== fm.currentRoomId && (r.visited || isRoomSeen(r)));
            const target = stairs && stairs.roomId !== fm.currentRoomId ? stairs.roomId : (options.length > 0 ? options[Math.floor(Math.random() * options.length)].id : null);
            if (target && travelToRoom(target)) mapTravels++;
            else explore();
            assert(!!fm.roomsById[gameState.floorMap ? gameState.floorMap.currentRoomId : fm.currentRoomId], `salle courante invalide après un voyage sur carte à l'étape ${steps}`);
        } else {
            if (isUrbanFloor()) urbanFloorsSeen++;
            explore();
        }

        if (gameState.hasWon) winTriggered = true;

        assert(!Number.isNaN(gameState.hp), `hp devient NaN à l'étape ${steps}`);
        assert(Number.isFinite(gameState.gold) && gameState.gold >= 0, `PO invalides à l'étape ${steps}`);
        assert(gameState.inventory.filter(i => i.category !== 'consumables').length <= gameState.maxInventory, `réserve d'équipement dépassée à l'étape ${steps}`);
        assert(Object.keys(gameState.achievements).every(id => getAchievementById(id)), `succès inconnu enregistré à l'étape ${steps}`);
        assert(gameState.bounty.value >= 0 && gameState.bounty.value <= config.bounty.max, `prime hors bornes à l'étape ${steps}`);
        if (gameState.currentEnemy && gameState.currentEnemy.isBountyHunter) huntersSeen.add(gameState.currentEnemy);
        assert(gameState.hp <= gameState.maxHp, `hp dépasse maxHp à l'étape ${steps}`);
        assert(gameState.combatDistance >= 0 && gameState.combatDistance <= config.rangedCombat.maxDistance, `combatDistance hors bornes à l'étape ${steps}`);
        assert(!Number.isNaN(gameState.mana) && gameState.mana >= 0 && gameState.mana <= gameState.maxMana, `mana hors bornes à l'étape ${steps}`);
        if (gameState.companion) {
            const c = gameState.companion;
            assert(c.loyalty >= 0 && c.loyalty <= 100, `loyauté du compagnon hors bornes à l'étape ${steps}`);
            assert(!Number.isNaN(c.hp) && c.hp >= 0 && c.hp <= c.maxHp, `PV du compagnon hors bornes à l'étape ${steps}`);
            assert(c.downed === (c.hp <= 0) || (c.downed && c.hp === 0), `état « à terre » incohérent à l'étape ${steps}`);
        }
        if (isUrbanFloor()) {
            const fm = gameState.floorMap;
            assert(!!fm.citiesById[fm.currentCityId], `floorMap.currentCityId invalide à l'étape ${steps}`);
            assert(Object.values(fm.roomsById).filter(r => r.type === 'stairs').length === 1, `Étage urbain sans escalier unique à l'étape ${steps}`);
        }
        assert(!('urbanMap' in gameState), `l'ancien gameState.urbanMap ne doit plus exister (étape ${steps})`);
        if (gameState.currentFloor > floorsCleared) floorsCleared = gameState.currentFloor;
        if (gameState.hp <= 0 || winTriggered) break;
    }
} catch (err) {
    seenErrors.push(err);
}

// Chantier 13 (lot 2) : la simulation traverse l'étage 3 d'une vraie partie — les deux écrans (race puis classe) se sont ouverts une fois chacun et ont été résolus.
if (floorsCleared >= 3) {
    assert(originChoicesSeen === 2, `Race et classe : deux écrans résolus à l'étage 3 (vus : ${originChoicesSeen})`);
    assert(!!gameState.race && !!gameState.crawlerClass, "Race et classe posées après l'étage 3");
    assert(!gameState.raceChoicePending && !gameState.classChoicePending, "Aucun choix d'origine ne reste bloquant");
}

// Intégration PACTE_DU_CRAWLER : force le déclenchement (la probabilité réelle en simulation ne le
// garantit pas) pour vérifier que l'auto-résolveur ci-dessus (branche pactChoicePending) débloque bien
// l'écran, et que le delta est correctement annulé au tout début du advanceToNextFloor() suivant.
try {
    gameState.atk = 10;
    gameState.baseMaxHp = 100;
    recomputeMaxHp();
    triggerPactChoice();
    assert(gameState.pactChoicePending === true, "triggerPactChoice() doit bien poser le flag bloquant");
    choosePactBlessing('atk');
    assert(gameState.pactChoicePending === false, "choosePactBlessing() doit bien refermer le choix");
    assert(gameState.atk !== 10, "choosePactBlessing('atk') doit modifier gameState.atk");
    const floorBefore = gameState.currentFloor;
    gameState.currentFloor = 1; // Étage tuto : aucune anomalie tirée, seule la réversion du Pacte nous intéresse ici
    advanceToNextFloor();
    assert(gameState.atk === 10, "advanceToNextFloor() doit annuler le delta ATQ du Pacte de l'étage précédent");
    gameState.currentFloor = floorBefore; // Restaure l'état pour la suite de la simulation
} catch (err) {
    seenErrors.push(err);
}

// Intégration compagnon (rework) : de VRAIS winCombat() répétés le font progresser SANS jamais le faire
// partir ; seul un changement d'étage avec une loyauté basse peut le faire partir.
try {
    gameState.companion = generateCompanionCandidate(gameState.currentFloor || 1);
    const startAtk = gameState.companion.atk;
    for (let i = 0; i < 30; i++) {
        gameState.inCombat = true;
        gameState.currentEnemy = { name: "Cobaye Compagnon", hp: -9999, maxHp: 50, atk: 5, def: 2, xpReward: 15, status: {} };
        winCombat();
    }
    assert(gameState.companion !== null, "Le compagnon ne part jamais sur une série de victoires");
    assert(gameState.companion.level > 1 && gameState.companion.atk > startAtk, "Le compagnon progresse (niveaux + stats) au fil des victoires");
    assert(gameState.companion.loyalty === 100 || gameState.companion.loyalty > config.companions.loyalty.start, "Les victoires communes font monter la loyauté");
    gameState.companion.loyalty = 0;
    const floorBefore = gameState.currentFloor;
    let floorsTried = 0;
    while (gameState.companion && floorsTried < 20) {
        gameState.currentFloor = 1;
        advanceToNextFloor();
        floorsTried++;
    }
    assert(gameState.companion === null, `Un compagnon à 0 de loyauté finit par partir au changement d'étage (${floorsTried} étages)`);
    assert(gameState.companionChoicePending !== true, "Aucun choix de compagnon ne doit rester bloqué après un départ");
    gameState.currentFloor = floorBefore;
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
    gameState.hasWon = false;
    advanceToNextFloor(); // Génère l'étage final
    assert(isUrbanFloor() && gameState.floorMap.isFinalFloor, "L'étage final doit être un étage urbain marqué isFinalFloor");
    const exitRoom = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    assert(exitRoom && exitRoom.isExit && exitRoom.guarded, "La Sortie de l'étage final doit toujours être gardée");

    let finalSteps = 0;
    while (!gameState.hasWon && finalSteps < 200) {
        finalSteps++;
        if (gameState.timeLeft < 50) gameState.timeLeft = gameState.maxTime;
        if (!gameState.inCombat && gameState.hp < gameState.maxHp * 0.5) gameState.hp = gameState.maxHp;
        if (gameState.bossChoicePending) {
            fightBossNow();
        } else if (gameState.safehouseChoicePending) {
            leaveSafehouse(); // Étage final : pas de repos, priorité à la Sortie
        } else if (gameState.encounterIntroPending) {
            dismissEncounterIntro(true); // écran de rencontre (chantier 16) : jamais bloqué dessus
        } else if (gameState.stealthChoicePending) {
            attemptStealthAttack();
        } else if (gameState.companionChoicePending) {
            const candidate = gameState.pendingCompanionCandidate;
            if (candidate && candidate.disposition === 'friendly') recruitCompanion(); else attackCompanionEncounter();
        } else if (gameState.shopChoicePending) {
            leaveShop(); // Étage final : on ne s'attarde pas en boutique, priorité à la Sortie
        } else if (gameState.demonArmoryChoicePending) {
            // Armurerie de Gorgoth (chantier 17, lot 4) : garde son objet démoniaque, sinon prend le premier du râtelier.
            if (gameState.demonArmory && gameState.demonArmory.heldKey) keepDemonicItem(); else takeDemonicItem(DEMONIC_ITEM_KEYS[0]);
        } else if (gameState.lairChoicePending) {
            declineLair(); // Idem : on ne dévie jamais vers un repaire quand la Sortie est en vue
        } else if (gameState.floorTransitionPending) {
            continueFromFloorTransition(); // Idem : jamais bloqué sur l'écran d'escalier
        } else if (gameState.raceChoicePending || gameState.classChoicePending) {
            selectOrigin(gameState.pendingOriginOffers.offers[0].key);
            confirmOriginChoice();
        } else if (gameState.pactChoicePending) {
            pactChoicesSeen++;
            choosePactBlessing('hp'); // Priorité à la survie sur l'étage final
        } else if (gameState.pendingMinigame) {
            skipMinigame(); // Mini-jeu (chantier 6) : jamais ouvert sous Node, mais l'auto-résolveur doit le connaître
        } else if (gameState.showChoicePending) {
            showsSeen++;
            answerShow('polite'); // Émission DeathWatch : pas de risque inutile avant la Sortie
        } else if (gameState.inCombat) {
            if (gameState.currentEnemy) {
                gameState.currentEnemy.hp = -9999;
                winCombat();
            } else {
                gameState.inCombat = false;
            }
        } else if (isUrbanFloor()) {
            // Sortie visitée ou aperçue : on y va par la carte ; sinon on explore.
            if (!((exitRoom.visited || isRoomSeen(exitRoom)) && travelToRoom(exitRoom.id))) explore();
        }
    }
    reachedFinalWin = gameState.hasWon;
    assert(reachedFinalWin, `La victoire doit se déclencher en atteignant la Sortie de l'étage ${config.urbanFloors.finalFloor} (${finalSteps} pas)`);
    assert(gameState.currentFloor === config.urbanFloors.finalFloor, "Aucun étage au-delà de l'étage final ne doit jamais être généré");
} catch (err) {
    seenErrors.push(err);
}

console.log(`Simulation : ${steps} pas, étage ${floorsCleared}, ${combatsWon} combats, ${bossesEncountered} boss, ${stealthEncounters} furtifs, ${companionEncounters} rencontres compagnon (${companionGifts} dons), ${eliteMobsSeen} élites, ${armorMechanicProcs} procs armure, ${urbanFloorsSeen} pas urbains (${cityTravels} trajets), ${mapTravels} voyages sur carte, ${shopEncounters} boutiques, ${lairEncounters} repaires, ${floorTransitionsSeen} écrans d'escalier, ${pactChoicesSeen} pactes du crawler, ${safehouseEncounters} salles sécurisées, ${stairsChoices} choix d'escalier, ${Object.keys(gameState.achievements).length} succès (${gameState.runStats.overflowSold} reventes d'office), ${gameState.bounty.huntersKilled} chasseurs de primes tués (prime max ${gameState.runStats.maxBounty}, actuelle ${gameState.bounty.value}), ${showsSeen} émissions DeathWatch, ${originChoicesSeen} choix de race/classe, ${classAbilitiesUsed} capacités de classe, victoire étage 3-7=${winTriggered}, victoire étage finale=${reachedFinalWin}.`);
if (seenErrors.length > 0) console.error(seenErrors[0].stack);

assert(seenErrors.length === 0, "Aucune exception ne doit interrompre la simulation");
assert(steps > 50, "Progression significative attendue");
assert(floorsCleared >= 2, "Au moins l'étage 2 doit être atteint");
assert(combatsWon > 0, "Au moins un combat normal gagné");
assert(bossesEncountered > 0, "Au moins un boss rencontré");
assert(urbanFloorsSeen > 0, "Au moins un étage urbain (étage 3, 6...) doit avoir été traversé sur 6 étages");
assert(floorTransitionsSeen > 0, "Au moins un écran d'escalier doit avoir été traversé (la simulation ne doit jamais s'y bloquer)");

console.log(failures === 0 ? "OK — tous les invariants tiennent." : `${failures} échec(s) d'invariant.`);
process.exit(failures === 0 ? 0 : 1);
