// regression.test.js — suite RAPIDE (quelques secondes), à lancer avant chaque push touchant
// app.js/generator.js. Étendre ce fichier avec de nouvelles sections au fil des features plutôt
// que d'en recréer un nouveau. Pour un changement touchant la boucle de jeu elle-même
// (combat/distance/compagnon/génération d'étage), lancer aussi long_playthrough.js une fois.
require('./test_stub.js');
const { loadGame } = require('./load_game.js');
loadGame();

let failures = 0, passed = 0;
function assert(cond, msg) {
    if (!cond) { failures++; console.error("FAIL:", msg); }
    else passed++;
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
    gameState.timeLeft = gameState.maxTime; // Jamais de temps épuisé résiduel entre deux tests sans rapport
    gameState.level = 1;
    gameState.equipment = { weapon: null, armor: null, ranged: null, spell: null };
    gameState.mana = gameState.maxMana;
    gameState.spellbook = [];
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    gameState.companion = null;
    gameState.bossChoicePending = false;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.companionChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.pendingBossRoomId = null;
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
    gameState.necrologie = [];
    if (ui.gameOverOverlay) ui.gameOverOverlay.classList.add('hidden');
}

// ===================================================================
// S'approcher (attemptSprint) : action de rapprochement, TOUJOURS disponible dès qu'un écart
// sépare les deux camps (grisée à écart nul) — plus aucune dépendance à une posture du joueur.
// (Hors combat, #combat-zone est masqué dans son ensemble ; l'état .disabled des boutons qu'il
// contient n'est donc plus recalculé, comme pour Arme/Tir/Mains nues — rien à tester ici.)
// ===================================================================
resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = 0;
updateUI();
assert(ui.btnSprint.disabled === true, "S'approcher grisé : déjà au corps à corps (rien à combler)");

resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} }; // mob de mêlée
gameState.combatDistance = config.rangedCombat.initialDistance; // écart ouvert (ex: après un recul)
updateUI();
assert(ui.btnSprint.disabled === false, "S'approcher utilisable dès qu'un écart existe, même face à un mob de mêlée");

resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 100, maxHp: 100, atk: 10, def: 6, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
updateUI();
assert(ui.btnSprint.disabled === false, "S'approcher utilisable face à un mob à distance aussi");

resetTransientState();
gameState.inCombat = true;
gameState.level = 5;
gameState.currentEnemy = { name: "Fusil de Chasse Rouillé Mob", hp: 100, maxHp: 100, atk: 8, def: 4, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
const enemyHpBefore = gameState.currentEnemy.hp;
attemptSprint();
assert(gameState.currentEnemy.hp === enemyHpBefore, "S'approcher ne blesse jamais l'ennemi directement");
// Un seul round peut voir le mob gagner le jet (l'écart grandit alors) : seules les bornes sont garanties ici.
assert(gameState.combatDistance >= 0 && gameState.combatDistance <= config.rangedCombat.maxDistance, "S'approcher reste dans les bornes [0, maxDistance] après une seule tentative");

resetTransientState();
gameState.inCombat = true;
gameState.level = 10;
gameState.currentEnemy = { name: "Cible d'entraînement", hp: 9999, maxHp: 9999, atk: 1, def: 1, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
let attempts = 0, outOfBounds = false;
while (gameState.combatDistance > 0 && attempts < 200) {
    attemptSprint();
    if (gameState.combatDistance < 0 || gameState.combatDistance > config.rangedCombat.maxDistance) outOfBounds = true;
    attempts++;
    if (gameState.hp <= 0) break;
}
assert(!outOfBounds, "combatDistance reste toujours dans les bornes [0, maxDistance] au fil des approches");
assert(gameState.combatDistance === 0, `L'écart finit par être comblé après plusieurs tentatives (${attempts} essais, niveau élevé)`);

{
    // Progression garantie : même si le mob gagne le jet à plate couture, l'écart se réduit d'au
    // moins 1 (jamais totalement bloqué). On force le joueur au plus bas et le mob au plus haut.
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.currentEnemy = { name: "Cible d'entraînement", hp: 9999, maxHp: 9999, atk: 1, def: 1, ranged: true, status: {} };
    gameState.combatDistance = 3;
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => { callCount++; return callCount <= 2 ? 0 : 0.999; }; // dés du joueur au plus bas, dé du mob au plus haut
    attemptSprint();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 2, "S'approcher : même un jet perdu réduit l'écart d'au moins 1 (progression garantie)");
}
{
    // S'approcher face à un mob de mêlée actuellement hors de portée (ex: après un recul) : si le
    // jet échoue à combler l'écart, le mob reste hors de portée et ne doit PAS pouvoir riposter —
    // attemptSprint() utilise désormais safeEnemyCounterAttack() (plus seulement attemptRetreat()),
    // puisqu'un mob de mêlée peut maintenant se retrouver à distance sans notion de posture.
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {} }; // mêlée
    gameState.combatDistance = config.rangedCombat.maxDistance; // grand écart à combler
    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0, 0, 0.999]; // dés du joueur au plus bas (x2), dé du mob au plus haut -> échec net
    Math.random = () => seq[(idx++) % seq.length];
    ui.btnFlee.disabled = false;
    attemptSprint();
    Math.random = originalRandom;
    assert(gameState.combatDistance > 0, "S'approcher : jet nettement perdu, le mob de mêlée reste hors de portée");
    assert(ui.btnFlee.disabled === false, "S'approcher : riposte bloquée tant que le mob de mêlée reste hors de portée");
}

// ===================================================================
// S'éloigner (attemptRetreat) : symétrique de S'approcher, TOUJOURS disponible tant qu'il reste de
// la marge (grisé à écart maximal) — y compris quand le joueur est DÉJÀ à distance, pas seulement
// au contact.
// ===================================================================
resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = 0;
updateUI();
assert(ui.btnRetreat.disabled === false, "S'éloigner utilisable au corps à corps (rattrapé par un mob de mêlée)");

resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 100, maxHp: 100, atk: 10, def: 6, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance; // déjà à distance, pas au contact
updateUI();
assert(ui.btnRetreat.disabled === false, "S'éloigner utilisable même déjà à distance (booste le jet encore plus loin)");

resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = config.rangedCombat.maxDistance;
updateUI();
assert(ui.btnRetreat.disabled === true, "S'éloigner grisé : écart déjà maximal, rien à gagner");

resetTransientState();
gameState.inCombat = true;
gameState.level = 10;
gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 100, maxHp: 100, atk: 8, def: 4, status: {} };
gameState.combatDistance = 0;
const enemyHpBeforeRetreat = gameState.currentEnemy.hp;
attemptRetreat();
assert(gameState.currentEnemy.hp === enemyHpBeforeRetreat, "S'éloigner ne blesse jamais l'ennemi directement");
assert(gameState.combatDistance >= 0, "S'éloigner ne peut jamais rendre l'écart négatif");

resetTransientState();
gameState.inCombat = true;
gameState.level = 10;
gameState.currentEnemy = { name: "Cible d'entraînement", hp: 9999, maxHp: 9999, atk: 1, def: 1, status: {} };
gameState.combatDistance = 0;
let retreatAttempts = 0, retreatOutOfBounds = false;
while (gameState.combatDistance < config.rangedCombat.maxDistance && retreatAttempts < 200) {
    attemptRetreat();
    if (gameState.combatDistance < 0 || gameState.combatDistance > config.rangedCombat.maxDistance) retreatOutOfBounds = true;
    retreatAttempts++;
    if (gameState.hp <= 0) break;
}
assert(!retreatOutOfBounds, "combatDistance reste toujours dans les bornes [0, maxDistance] au fil des reculs");
assert(gameState.combatDistance > 0, `L'écart finit par se rouvrir après plusieurs tentatives (${retreatAttempts} essais, niveau élevé)`);

// ===================================================================
// Portée : un mob de mêlée ne peut pas toucher un joueur qui tient la distance — un mob à distance,
// lui, peut toujours tirer, quel que soit l'écart. Ne dépend plus que du type de mob (mob.ranged).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 999, def: 0, status: {} }; // mêlée
    gameState.combatDistance = config.rangedCombat.initialDistance; // hors de portée
    const ctx = getCombatRangeContext();
    assert(ctx.playerAdvantaged === true, "getCombatRangeContext() : joueur avantagé face à un mob de mêlée hors de portée");

    ui.btnAttackWeapon.disabled = false;
    safeEnemyCounterAttack();
    assert(ui.btnAttackWeapon.disabled === false, "safeEnemyCounterAttack() : aucune riposte déclenchée quand le mob de mêlée est hors de portée");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 999, def: 0, status: {} };
    gameState.combatDistance = 0; // rattrapé au corps à corps : plus aucun avantage
    assert(getCombatRangeContext().playerAdvantaged === false, "getCombatRangeContext() : plus d'avantage une fois rattrapé au corps à corps");

    ui.btnAttackWeapon.disabled = false;
    safeEnemyCounterAttack();
    assert(ui.btnAttackWeapon.disabled === true, "safeEnemyCounterAttack() : la riposte se déclenche normalement au contact (verrouillage immédiat des boutons)");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance; // mob à distance : peut tirer même de loin
    assert(getCombatRangeContext().playerAdvantaged === false, "getCombatRangeContext() : un mob à distance n'est jamais hors de portée, lui");
}

// ===================================================================
// Portée (symétrique) : un mob à distance collé au corps à corps ne peut PAS tirer directement non
// plus — il doit d'abord reculer, comme le joueur doit s'éloigner pour utiliser Tir. Bug rapporté :
// un mob "à distance" ripostait sans condition, même au contact.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = 0; // collé au corps à corps
    const ctx = getCombatRangeContext();
    assert(ctx.mobNeedsDistance === true, "getCombatRangeContext() : un mob à distance collé au contact doit reculer pour tirer");

    ui.btnAttackWeapon.disabled = false;
    safeEnemyCounterAttack();
    assert(ui.btnAttackWeapon.disabled === false, "safeEnemyCounterAttack() : aucune riposte déclenchée quand le mob à distance est au corps à corps");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance; // a repris ses distances
    assert(getCombatRangeContext().mobNeedsDistance === false, "getCombatRangeContext() : plus besoin de reculer une fois la distance reprise");

    ui.btnAttackWeapon.disabled = false;
    safeEnemyCounterAttack();
    assert(ui.btnAttackWeapon.disabled === true, "safeEnemyCounterAttack() : la riposte à distance se déclenche normalement une fois l'écart repris");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 999, def: 0, status: {} }; // mêlée
    gameState.combatDistance = 0;
    assert(getCombatRangeContext().mobNeedsDistance === false, "getCombatRangeContext() : un mob de mêlée au contact n'a jamais besoin de reculer pour frapper");
}
{
    // Reproduit le scénario rapporté : un mob à distance rattrapé au corps à corps (ex: après un
    // S'approcher du joueur) tente de reculer avant de pouvoir tirer, via resolveEnemyReaction().
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.hp = gameState.maxHp = 100;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 9999, maxHp: 9999, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = 0;

    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0, 0.999]; // dé du joueur au plus bas, dé du mob au plus haut -> le mob l'emporte et recule
    Math.random = () => seq[(idx++) % seq.length];
    ui.btnFlee.disabled = false;
    resolveEnemyReaction();
    Math.random = originalRandom;

    assert(gameState.combatDistance > 0, "resolveEnemyReaction() : le mob à distance parvient à reculer");
    assert(ui.btnFlee.disabled === true, "resolveEnemyReaction() : une fois reculé, le mob à distance tire immédiatement");
}
{
    // Même scénario, mais le joueur colle le mob et l'empêche de reculer : aucune riposte ce tour.
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.hp = gameState.maxHp = 100;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 9999, maxHp: 9999, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = 0;

    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0.999, 0]; // dé du joueur au plus haut, dé du mob au plus bas -> le joueur l'emporte et le colle
    Math.random = () => seq[(idx++) % seq.length];
    ui.btnFlee.disabled = false;
    resolveEnemyReaction();
    Math.random = originalRandom;

    assert(gameState.combatDistance === 0, "resolveEnemyReaction() : le joueur colle le mob, qui ne parvient pas à reculer");
    assert(ui.btnFlee.disabled === false, "resolveEnemyReaction() : un mob à distance collé au corps à corps ne peut pas tirer ce tour-ci");
}

// ===================================================================
// resolveEnemyReaction() : un mob de mêlée hors de portée ne reste plus figé — il tente de
// combler l'écart au lieu de rester totalement bloqué (Magie, étourdissement, fuite ratée, ...).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.hp = gameState.maxHp = 100;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {} };
    gameState.combatDistance = 2; // Petit écart : une marge étroite (1) suffit à le combler en 2 manches, sans déclencher de ruée
    // Sort à distance équipé, mana surabondant : attackMagic() exige désormais un sort dont la
    // catégorie correspond à l'écart courant (voir spellCategory) et assez de mana pour le lancer.
    gameState.equipment.spell = { spellName: "Foudre", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 };
    gameState.mana = 100;

    const originalRandom = Math.random;
    // Séquence par cast de Magie : [pas de backfire, variance de dégâts, dé joueur bas, dé mob un peu
    // plus haut] -> le mob gagne la manche de rapprochement d'une marge étroite (1, < rushMarginThreshold)
    // déclenchée par resolveEnemyReaction() : pas de ruée, l'écart se comble progressivement.
    const seq = [0.5, 0.5, 0.4, 0.55]; // playerRoll=3, mobRoll=4 (diff=-1)
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];

    // enemyCounterAttack() verrouille les boutons de combat de façon SYNCHRONE avant de différer
    // les dégâts eux-mêmes (setTimeout) : ce verrouillage sert de témoin fiable "une vraie riposte
    // a bien été déclenchée ce tour-ci", sans dépendre du délai (voir setCombatInputLocked()).
    // btnFlee (et non btnAttackWeapon) : updateUI() grise/dégrise lui-même btnAttackWeapon selon
    // l'écart courant, indépendamment de toute riposte — un témoin pollué par ce même effet de bord
    // que resolveEnemyReaction() déclenche volontairement (rafraîchir la barre après un rapprochement).
    ui.btnFlee.disabled = false;
    attackMagic();
    assert(gameState.combatDistance === 1, "resolveEnemyReaction() : un mob de mêlée hors de portée avance quand même vers le joueur");
    assert(ui.btnFlee.disabled === false, "resolveEnemyReaction() : tant que l'écart tient, le mob de mêlée ne peut pas riposter");

    attackMagic(); // Doit combler l'écart restant (2 - 1 - 1 = 0) et enfin riposter pour de vrai
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "resolveEnemyReaction() : le mob finit par combler l'écart");
    assert(ui.btnFlee.disabled === true, "resolveEnemyReaction() : une fois l'écart comblé, la riposte se déclenche normalement");
}
{
    // attemptRetreat() : si le jet réussit (écart rouvert), la riposte ne doit plus porter.
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.hp = gameState.maxHp = 100;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {} };
    gameState.combatDistance = 0; // rattrapé au corps à corps, tente de reculer

    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0.999, 0.999, 0]; // dés du joueur au plus haut, dé du mob au plus bas -> le recul réussit
    Math.random = () => seq[(idx++) % seq.length];
    ui.btnFlee.disabled = false;
    attemptRetreat();
    Math.random = originalRandom;

    assert(gameState.combatDistance > 0, "attemptRetreat() : le jet gagnant rouvre bien l'écart");
    assert(ui.btnFlee.disabled === false, "attemptRetreat() : aucune riposte ne se déclenche une fois l'écart rouvert");
}
{
    // Fuite ratée sans action gated : l'écart doit quand même évoluer grâce à resolveEnemyReaction().
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.hp = gameState.maxHp = 100;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {} };
    gameState.combatDistance = config.rangedCombat.maxDistance;

    const originalRandom = Math.random;
    let idx = 0;
    // fleeChance=60 : premier appel >= 0.6 force l'échec de la fuite ; puis dé joueur bas, dé mob un
    // peu plus haut (marge étroite 1, < rushMarginThreshold : pas de ruée).
    const seq = [0.99, 0.4, 0.55];
    Math.random = () => seq[(idx++) % seq.length];
    ui.btnFlee.disabled = false;
    attemptFlee();
    Math.random = originalRandom;

    assert(gameState.combatDistance < config.rangedCombat.maxDistance, "Fuite ratée : le mob de mêlée avance même sur un tour sans action gated");
    assert(ui.btnFlee.disabled === false, "Fuite ratée : le mob n'a pas pu riposter tant que l'écart n'est pas comblé");
}

// ===================================================================
// Barre de distance : le mob est toujours à gauche, le joueur toujours à droite, tous deux
// reflétant symétriquement le même écart (plus de notion de posture/ancrage asymétrique).
// ===================================================================
{
    // Constantes dupliquées depuis updateUI() (app.js) pour vérifier les positions attendues.
    const HOME_EDGE = 8, ADJACENT_GAP = 5;
    const leftPos = el => parseFloat(el.style.left);

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 0; // contact
    updateUI();
    const enemyPos = leftPos(ui.combatDistanceEnemyIcon), playerPos = leftPos(ui.combatDistancePlayerIcon);
    assert(enemyPos < playerPos, "Écart nul : le mob reste à gauche du joueur");
    assert(Math.abs(playerPos - enemyPos - ADJACENT_GAP) < 0.01, "Écart nul : les deux icônes sont proches du centre mais non superposées");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 8, def: 4, status: {} }; // mob de mêlée
    gameState.combatDistance = config.rangedCombat.maxDistance; // repoussé au maximum (ex: après S'éloigner)
    updateUI();
    assert(Math.abs(leftPos(ui.combatDistancePlayerIcon) - (100 - HOME_EDGE)) < 0.01, "Écart maximal : le joueur est sur son bord droit");
    assert(Math.abs(leftPos(ui.combatDistanceEnemyIcon) - HOME_EDGE) < 0.01, "Écart maximal : le mob est sur son bord gauche");

    gameState.combatDistance = 0; // le mob a rattrapé le joueur au corps à corps
    updateUI();
    const closeEnemyPos = leftPos(ui.combatDistanceEnemyIcon), closePlayerPos = leftPos(ui.combatDistancePlayerIcon);
    assert(Math.abs(closePlayerPos - closeEnemyPos - ADJACENT_GAP) < 0.01, "Une fois l'écart comblé : les deux icônes reviennent adjacentes (contact)");
}

// ===================================================================
// setCombatDistance() : la barre de distance (icônes + fill) se rafraîchit DANS LA MÊME TICK que
// tout changement de gameState.combatDistance, sans dépendre d'une riposte différée (bug rapporté :
// après un recul réussi contre un mob de mêlée, ou un tir qui maintient l'écart sans provoquer de
// riposte, le schéma restait figé sur l'ancien écart — surtout visible en duel long face à un boss).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.currentEnemy = { name: "Boucher Sans Visage", hp: 300, maxHp: 300, atk: 20, def: 10, status: {} };
    gameState.combatDistance = 0; // rattrapé au corps à corps
    updateUI();
    const beforeEnemyPos = ui.combatDistanceEnemyIcon.style.left;

    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0.999, 0.999, 0]; // dés du joueur au plus haut, dé du mob au plus bas -> le recul réussit
    Math.random = () => seq[(idx++) % seq.length];
    attemptRetreat();
    Math.random = originalRandom;

    assert(gameState.combatDistance > 0, "attemptRetreat() : le jet gagnant rouvre bien l'écart");
    assert(ui.combatDistanceEnemyIcon.style.left !== beforeEnemyPos, "attemptRetreat() : l'icône du mob bouge dans la même tick, sans attendre une riposte");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 4 };
    gameState.currentEnemy = { name: "Boucher Sans Visage", hp: 300, maxHp: 300, atk: 20, def: 10, status: {}, ranged: true };
    gameState.combatDistance = 4;
    updateUI();

    const leftBefore = ui.combatDistanceEnemyIcon.style.left;
    attackRanged();

    assert(ui.combatDistanceEnemyIcon.style.left === leftBefore, "attackRanged() n'embarque plus aucune manche de distance : l'écart ne bouge que via S'approcher/S'éloigner");
    assert(gameState.combatDistance === 4, "attackRanged() est une simple attaque gated par l'écart courant, qui ne le modifie plus lui-même");
}
// ===================================================================
// Armure : enchantements branchés (applyArmorMechanic)
// ===================================================================
function freshAttacker(overrides = {}) {
    return Object.assign({ name: "Cobaye", hp: 200, maxHp: 200, atk: 10, def: 5, status: {} }, overrides);
}

{
    const a = freshAttacker();
    resolveArmorMechanicEffect('bleed', { baseArmor: 10 }, a, 20);
    assert(a.status.bleed && a.status.bleed.rounds === 3 && a.status.bleed.dmgPerRound === 3, "Armure 'Tranchant' (bleed) inflige un saignement proportionnel à baseArmor");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('stun', { baseArmor: 10 }, a, 20);
    assert(a.status.stunned === true, "Armure 'Lourd/Électrique' (stun) étourdit l'attaquant");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('poison', { baseArmor: 10 }, a, 20);
    assert(a.status.bleed && a.status.bleed.rounds === 5, "Armure 'Empoisonné' (poison) empoisonne l'attaquant (5 rounds)");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('slow', { baseArmor: 10 }, a, 20);
    assert(a.status.slowed && a.status.slowed.rounds === 2, "Armure 'Gelé' (slow) ralentit l'attaquant");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('light', { baseArmor: 10 }, a, 20);
    assert(a.status.blinded && a.status.blinded.rounds === 2, "Armure 'Lumineux' (light) éblouit l'attaquant");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('corrode', { baseArmor: 10 }, a, 20);
    assert(a.status.corroded && a.status.corroded.rounds === 3, "Armure 'Corrosif' (corrode) corrode l'attaquant");
}
{
    const a = freshAttacker();
    resolveArmorMechanicEffect('fear', { baseArmor: 10 }, a, 20);
    assert(a.status.feared && a.status.feared.rounds === 3, "Armure 'Terrifiant' (fear) effraie l'attaquant");
}
{
    const a = freshAttacker({ atk: 20 });
    resolveArmorMechanicEffect('drain', { baseArmor: 10 }, a, 20);
    assert(a.atk === 17, "Armure 'Drainant' (drain) réduit l'ATK de l'attaquant de 15%");
}
{
    resetTransientState();
    gameState.hp = 50; gameState.maxHp = 100;
    resolveArmorMechanicEffect('heal', { baseArmor: 10 }, freshAttacker(), 20);
    assert(gameState.hp === 54, "Armure 'Régénérant' (heal) soigne le porteur, proportionnel à baseArmor");
}
{
    resetTransientState();
    gameState.hp = 50; gameState.maxHp = 100;
    resolveArmorMechanicEffect('lifesteal', { baseArmor: 10 }, freshAttacker(), 20);
    assert(gameState.hp === 56, "Armure 'Vampirique' (lifesteal) siphonne 30% des dégâts encaissés");
}
{
    resetTransientState();
    resolveArmorMechanicEffect('adrenaline', { baseArmor: 10 }, freshAttacker(), 20);
    assert(gameState.status.adrenaline && gameState.status.adrenaline.mult === 1.35, "Armure 'Galvanisant' (adrenaline) galvanise le porteur");
}
{
    resetTransientState();
    gameState.equipment.armor = { baseArmor: 10, mechanics: ['bleed'] };
    let triggered = false;
    for (let i = 0; i < 300 && !triggered; i++) {
        const a = freshAttacker();
        applyArmorMechanic(a, 20);
        if (a.status.bleed) triggered = true;
    }
    assert(triggered, "applyArmorMechanic() se déclenche statistiquement (~30% par enchantement, 300 tentatives)");
}
{
    resetTransientState();
    const a = freshAttacker();
    applyArmorMechanic(a, 20); // pas d'armure équipée
    assert(!a.status.bleed && !a.status.stunned, "applyArmorMechanic() ne fait rien sans armure équipée");
}

// ===================================================================
// Icône élite 💀
// ===================================================================
{
    const weakMob = { name: "Faible", isBoss: false, threatMultiplier: 1.0 };
    const eliteMob = { name: "Fort", isBoss: false, threatMultiplier: 3.6 };
    const boss = { name: "Boss", isBoss: true };
    assert(isEliteMob(weakMob) === false, "isEliteMob() : pas de bonus -> pas élite");
    assert(isEliteMob(eliteMob) === true, "isEliteMob() : threatMultiplier=3.6 -> élite");
    assert(isEliteMob(boss) === false, "isEliteMob() : un boss n'est jamais élite (déjà signalé par 👑)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = eliteMob;
    updateUI();
    assert(ui.enemyName.innerText.startsWith('💀'), "En-tête de combat : 💀 pour un mob élite");

    gameState.currentEnemy = boss;
    updateUI();
    assert(ui.enemyName.innerText.startsWith('👑') && !ui.enemyName.innerText.includes('💀'), "Un boss garde uniquement la couronne");

    gameState.currentEnemy = weakMob;
    updateUI();
    assert(!ui.enemyName.innerText.includes('💀') && !ui.enemyName.innerText.includes('👑'), "Un mob normal n'affiche ni couronne ni crâne");
}
{
    resetTransientState();
    gameState.currentFloor = 1;
    let sawAboveOne = true, allPositive = true;
    for (let i = 0; i < 200; i++) {
        const mob = generateMob("Tunnels de Métro Abandonnés");
        if (typeof mob.threatMultiplier !== 'number' || mob.threatMultiplier <= 0) allPositive = false;
    }
    assert(allPositive, "generateMob() pose toujours un threatMultiplier numérique positif (200 générations)");
}

// ===================================================================
// Compagnon : abandon probabiliste
// ===================================================================
{
    const candidate = generateCompanionCandidate();
    assert(typeof candidate.leaveChance === 'number' && candidate.leaveChance === 0, "generateCompanionCandidate() initialise leaveChance à 0");
    assert(candidate.aggressiveness === undefined, "Le champ 'aggressiveness' n'existe plus");
}
{
    resetTransientState();
    gameState.companion = { name: "Doc Ferraille", xp: 0, level: 1, xpToNext: 1, leaveChance: 50, specialty: { type: 'strike', label: 'Frappe' }, hp: 40, maxHp: 40 };
    const originalRandom = Math.random;
    Math.random = () => 0.01;
    gainCompanionXp(10);
    Math.random = originalRandom;
    assert(gameState.companion === null, "Le compagnon abandonne quand le jet contre leaveChance réussit");
}
{
    resetTransientState();
    gameState.companion = { name: "Nadia Sans-Peur", xp: 25, level: 1, xpToNext: 30, leaveChance: 0, specialty: { type: 'guard', label: 'Garde' }, hp: 40, maxHp: 40 };
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    gainCompanionXp(10);
    Math.random = originalRandom;
    assert(gameState.companion !== null, "Le compagnon reste si le jet d'abandon échoue");
    assert(gameState.companion.leaveChance > 0, "leaveChance augmente après une montée de niveau");
}
assert(typeof triggerCompanionHostileTurn === 'undefined', "L'ancien mécanisme triggerCompanionHostileTurn() a bien été retiré");

// ===================================================================
// Badges d'enchantement généralisés
// ===================================================================
{
    const armor = { baseArmor: 8, mechanics: ['bleed', 'stealth', 'aoe'] };
    const html = buildMechanicBadgesHtml(armor, IMPLEMENTED_ARMOR_MECHANICS);
    assert(html.includes('🩸') && html.includes('Saignement'), "Badge fonctionnel pour 'bleed'");
    assert(html.includes('🤫') && html.includes('Discrétion'), "Badge fonctionnel pour 'stealth' (toujours actif)");
    assert(html.includes('💥') && html.includes('cosmétique'), "Badge grisé + mention cosmétique pour 'aoe'");
    assert(buildMechanicBadgesHtml(null, IMPLEMENTED_ARMOR_MECHANICS) === '', "buildMechanicBadgesHtml() ne plante pas sans objet");
}

// ===================================================================
// En-tête de carte au démarrage d'un combat (initiateCombat) : le nom du mob remplace "Combat" et
// n'importe quel titre laissé par la carte précédente (ex: "Silence") — bug rapporté : une embuscade
// ou un combat déclenché sans passer par setCardHeader() laissait l'ancien titre affiché pendant que
// le corps de la carte basculait déjà sur le panneau du mob.
// ===================================================================
{
    resetTransientState();
    setCardHeader('🌑', 'Silence', 'Exploration'); // simule la carte précédente, comme en vraie partie
    const mob = { name: "Contrôleur de Billets Zombifié", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    initiateCombat(mob);
    assert(ui.cardTitle.innerText === mob.name, "initiateCombat() : le nom du mob remplace le titre de la carte précédente");
    assert(ui.cardIcon.innerText === '⚔️', "initiateCombat() : icône épée pour un mob normal");
    assert(ui.cardTypeLabel.innerText === 'Danger', "initiateCombat() : type 'Danger' pour un mob normal");
}
{
    resetTransientState();
    setCardHeader('🌑', 'Silence', 'Exploration');
    const eliteMob = { name: "Boucher Increvable", hp: 30, maxHp: 30, atk: 5, def: 2, threatMultiplier: 3.6, status: {} };
    initiateCombat(eliteMob);
    assert(ui.cardTitle.innerText === eliteMob.name, "initiateCombat() : nom du mob élite sur la carte aussi");
    assert(ui.cardIcon.innerText === '💀', "initiateCombat() : icône crâne pour un mob élite");
}
{
    resetTransientState();
    // En-tête plus riche posé par triggerBossEncounter() juste avant fightBossNow() -> initiateCombat()
    setCardHeader('👑', 'Le Chef de Gare Nécrosé', "Gardien de l'Escalier");
    const boss = { name: "Le Chef de Gare Nécrosé", isBoss: true, hp: 200, maxHp: 200, atk: 20, def: 10, status: {} };
    initiateCombat(boss);
    assert(ui.cardTitle.innerText === boss.name, "initiateCombat() : titre correct pour un boss");
    assert(ui.cardTypeLabel.innerText === "Gardien de l'Escalier", "initiateCombat() : n'écrase pas l'en-tête plus riche déjà posé pour un boss");
}

// ===================================================================
// Arme/Tir nécessitent une arme réellement équipée (mains nues reste toujours disponible sans rien).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 0;
    gameState.equipment.weapon = null;
    updateUI();
    assert(ui.btnAttackWeapon.disabled === true, "Arme grisée sans arme équipée");
    const hpBefore = gameState.currentEnemy.hp;
    attackWeapon();
    assert(gameState.currentEnemy.hp === hpBefore, "attackWeapon() ne porte pas sans arme équipée");

    gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 5 };
    updateUI();
    assert(ui.btnAttackWeapon.disabled === false, "Arme de nouveau utilisable une fois équipée");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 8, def: 4, ranged: true, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance;
    gameState.equipment.ranged = null;
    updateUI();
    assert(ui.btnAttackRanged.disabled === true, "Tir grisé sans arme à distance équipée");
    const hpBefore = gameState.currentEnemy.hp;
    attackRanged();
    assert(gameState.currentEnemy.hp === hpBefore, "attackRanged() ne porte pas sans arme à distance équipée");

    gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 4 };
    updateUI();
    assert(ui.btnAttackRanged.disabled === false, "Tir de nouveau utilisable une fois une arme à distance équipée");
}

// ===================================================================
// Salles sécurisées : 1 à 2 par quartier (jamais 0, jamais plus de 2) — voir generateQuadrant().
// ===================================================================
{
    let sawZero = false, sawMoreThanTwo = false, sawTwo = false;
    for (let i = 0; i < 60; i++) {
        const roomsById = {};
        generateQuadrant(0, "Quartier de Test", roomsById);
        const safeCount = Object.values(roomsById).filter(r => r.type === 'safe').length;
        if (safeCount === 0) sawZero = true;
        if (safeCount > 2) sawMoreThanTwo = true;
        if (safeCount === 2) sawTwo = true;
    }
    assert(!sawZero, "generateQuadrant() : au moins 1 salle sécurisée par quartier (jamais 0), sur 60 générations");
    assert(!sawMoreThanTwo, "generateQuadrant() : jamais plus de 2 salles sécurisées par quartier");
    assert(sawTwo, "generateQuadrant() : 2 salles sécurisées effectivement possibles (60 générations)");
}

// ===================================================================
// Magie : rework en sort équipé + mana (voir spells.js, generateSpellScroll() dans generator.js,
// equipSpell()/attackMagic() dans app.js).
// ===================================================================

// generateSpellScroll() : un sort plus rare coûte plus de mana ET frappe plus fort, comme une arme.
{
    const originalRandom = Math.random;
    // [index du sort (0 -> "Toucher Électrique", melee), jet de rareté (0 -> Commun), jitter du
    // multiplicateur de stats (0.5 -> exactement 1.0, sans le ±10% aléatoire)]
    let commonSeq = [0, 0, 0.5];
    let commonIdx = 0;
    Math.random = () => commonSeq[(commonIdx++) % commonSeq.length];
    let scroll = generateSpellScroll(0);
    Math.random = originalRandom;
    assert(scroll.category === 'scrolls', "generateSpellScroll() : catégorie 'scrolls' (pour le tri addLoot())");
    assert(scroll.spellCategory === 'melee', "generateSpellScroll() : conserve la catégorie melee/ranged du sort de base");
    assert(scroll.spellName === "Toucher Électrique", "generateSpellScroll() : conserve le nom du sort de base");
    assert(scroll.name === "Parchemin : Toucher Électrique", "generateSpellScroll() : nom d'affichage préfixé");
    assert(scroll.rarity === "Commun", "generateSpellScroll() : rareté Commun avec un jet à 0");
    assert(scroll.baseDmg === 9 && scroll.manaCost === 12, "generateSpellScroll() : stats de base inchangées au palier Commun (statMult ~1.0)");

    const seq = [0, 0.999, 0.5];
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    scroll = generateSpellScroll(0);
    Math.random = originalRandom;
    assert(scroll.rarity === "Légendaire", "generateSpellScroll() : rareté Légendaire avec un jet au plus haut");
    assert(scroll.baseDmg > 9 && scroll.manaCost > 12, "generateSpellScroll() : un sort plus rare inflige plus ET coûte plus de mana");
}

// equipSpell() : équipe depuis le grimoire, renvoie l'ancien sort équipé dedans, initialise le mana
// à plein UNIQUEMENT à la toute première équipe (jamais lors d'un changement de sort).
{
    resetTransientState();
    const scrollA = { name: "Parchemin : Toucher Électrique", spellName: "Toucher Électrique", spellCategory: 'melee', baseDmg: 9, manaCost: 12, category: 'scrolls', rarity: 'Commun' };
    const scrollB = { name: "Parchemin : Foudre", spellName: "Foudre", spellCategory: 'ranged', baseDmg: 15, manaCost: 22, category: 'scrolls', rarity: 'Rare' };
    gameState.spellbook = [scrollA];
    gameState.mana = 0;
    equipSpell(0);
    assert(gameState.equipment.spell === scrollA, "equipSpell() : équipe bien le sort choisi");
    assert(gameState.spellbook.length === 0, "equipSpell() : le sort équipé quitte le grimoire");
    assert(gameState.mana === gameState.maxMana, "equipSpell() : première équipe -> mana plein");

    gameState.mana = 40; // Simule une dépense entre-temps
    gameState.spellbook = [scrollB];
    equipSpell(0);
    assert(gameState.equipment.spell === scrollB, "equipSpell() : change bien de sort équipé");
    assert(gameState.spellbook.includes(scrollA), "equipSpell() : l'ancien sort équipé retourne dans le grimoire");
    assert(gameState.mana === 40, "equipSpell() : un changement de sort (pas une première équipe) ne réinitialise pas le mana");
}

// addLoot() : un parchemin (catégorie 'scrolls') rejoint gameState.spellbook, jamais gameState.inventory.
{
    resetTransientState();
    gameState.inventory = [];
    gameState.spellbook = [];
    const originalRandom = Math.random;
    // [catégorie -> 'scrolls' (5e sur 5, index 4), index du sort, jet de rareté, jitter statMult]
    const seq = [0.9, 0, 0, 0.5];
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    addLoot(0);
    Math.random = originalRandom;
    assert(gameState.spellbook.length === 1, "addLoot() : un parchemin rejoint le grimoire (spellbook)");
    assert(gameState.inventory.length === 0, "addLoot() : un parchemin ne rejoint jamais l'inventaire classique");
}

// attackMagic() : grisé/bloqué exactement comme Arme/Tir selon la catégorie du sort équipé et l'écart,
// plus une garde propre au mana (insuffisant -> pas de dégâts, pas de dépense).
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 9999, maxHp: 9999, atk: 5, def: 2, status: {} };
    gameState.pendingSneakAttack = false;

    // Aucun sort équipé : bloqué, aucune conséquence.
    gameState.combatDistance = 0;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Magie grisée sans aucun sort équipé");
    let hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas sans sort équipé");

    // Sort de corps à corps équipé, mais à distance : bloqué comme Arme le serait.
    gameState.equipment.spell = { spellName: "Toucher Électrique", spellCategory: 'melee', baseDmg: 9, manaCost: 12, category: 'scrolls' };
    gameState.mana = 100;
    gameState.combatDistance = config.rangedCombat.initialDistance;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort de corps à corps grisé à distance");
    hpBefore = gameState.currentEnemy.hp;
    const manaBefore = gameState.mana;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas un sort de corps à corps à distance");
    assert(gameState.mana === manaBefore, "attackMagic() ne consomme pas de mana quand le sort est indisponible");

    // Même sort, de retour au corps à corps, mais mana insuffisant : toujours bloqué.
    gameState.combatDistance = 0;
    gameState.mana = 5; // < manaCost (12)
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort grisé si le mana restant est insuffisant");
    hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    assert(gameState.currentEnemy.hp === hpBefore, "attackMagic() ne porte pas sans assez de mana");
    assert(gameState.mana === 5, "attackMagic() ne consomme aucun mana quand il en manque déjà");

    // Mana suffisant, bon écart : le sort porte et consomme son coût en mana.
    gameState.mana = 100;
    updateUI();
    assert(ui.btnAttackMagic.disabled === false, "Sort de corps à corps utilisable au contact avec assez de mana");
    const originalRandom = Math.random;
    Math.random = () => 0.5; // Évite tout backfire (15% de base au niveau 1)
    hpBefore = gameState.currentEnemy.hp;
    attackMagic();
    Math.random = originalRandom;
    assert(gameState.currentEnemy.hp < hpBefore, "attackMagic() inflige des dégâts quand le sort est utilisable");
    assert(gameState.mana === 100 - 12, "attackMagic() consomme le coût en mana du sort lancé");

    // Sort à distance équipé : symétrique (bloqué au contact, utilisable à distance).
    gameState.equipment.spell = { spellName: "Foudre", spellCategory: 'ranged', baseDmg: 15, manaCost: 20, category: 'scrolls' };
    gameState.mana = 100;
    gameState.combatDistance = 0;
    updateUI();
    assert(ui.btnAttackMagic.disabled === true, "Sort à distance grisé au corps à corps");
    gameState.combatDistance = config.rangedCombat.initialDistance;
    updateUI();
    assert(ui.btnAttackMagic.disabled === false, "Sort à distance utilisable une fois l'écart repris");
}

// useConsumable() : restaure aussi du mana quand l'objet en porte (voir items.js).
{
    resetTransientState();
    gameState.inventory = [{ name: "Flasque d'Essence Arcanique", heal: 0, mana: 45, category: 'consumables' }];
    gameState.hp = gameState.maxHp - 50;
    gameState.mana = 10;
    useConsumable(0);
    assert(gameState.mana === 55, "useConsumable() : restaure le mana porté par l'objet");
    assert(gameState.inventory.length === 0, "useConsumable() : l'objet disparaît après usage");
}

// applyTimeElapsedRegen() : régénère PV (taux DÉGRESSIF selon le % de PV restants, voir
// HP_REGEN_TIERS) et mana (12/h, seulement si un sort est équipé) au prorata des heures écoulées,
// les deux jauges régénérant indépendamment l'une de l'autre.
{
    // Palier < 50% des PV max : taux plein (10/h)
    resetTransientState();
    gameState.hp = 40; // 40% de 100
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 60, "applyTimeElapsedRegen() : palier <50% PV -> 10 PV/h");

    // Palier 50-80% : taux intermédiaire (4/h)
    resetTransientState();
    gameState.hp = 75; // 75% de 100
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 83, "applyTimeElapsedRegen() : palier 50-80% PV -> 4 PV/h");

    // Palier >= 80% : simple filet d'eau (1/h)
    resetTransientState();
    gameState.hp = 90; // 90% de 100
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'melee', baseDmg: 5, manaCost: 5, category: 'scrolls' };
    gameState.mana = 0;
    applyTimeElapsedRegen(2);
    assert(gameState.hp === 92, "applyTimeElapsedRegen() : palier >=80% PV -> 1 PV/h");
    assert(gameState.mana === 24, "applyTimeElapsedRegen() : régénère 12 mana par heure écoulée (sort équipé)");

    gameState.hp = gameState.maxHp; // PV déjà pleins : ne doit pas bloquer la régén de mana
    gameState.mana = gameState.maxMana - 10;
    applyTimeElapsedRegen(1);
    assert(gameState.hp === gameState.maxHp, "applyTimeElapsedRegen() : PV pleins -> aucun débordement au-delà de maxHp");
    assert(gameState.mana === gameState.maxMana, "applyTimeElapsedRegen() : régénère le mana même PV pleins (jauges indépendantes)");

    resetTransientState();
    gameState.equipment.spell = null; // Aucun sort équipé : rien à régénérer, jamais de mana fantôme
    gameState.mana = 0;
    applyTimeElapsedRegen(5);
    assert(gameState.mana === 0, "applyTimeElapsedRegen() : aucune régénération de mana sans sort équipé");

    resetTransientState();
    gameState.hp = gameState.maxHp - 100;
    applyTimeElapsedRegen(0);
    assert(gameState.hp === gameState.maxHp - 100, "applyTimeElapsedRegen(0) : aucun effet sans heure écoulée");
}

// ===================================================================
// Écran de départ + cadeau de bienvenue : nom du crawler puis tirage pondéré (Arme > Rien > Tir >
// Magie), toujours au palier Commun (voir WELCOME_GIFT_WEIGHTS/rollWelcomeGiftType()/
// generateWelcomeGiftItem() dans generator.js/app.js).
// ===================================================================

// rollWelcomeGiftType() : vérifie les 4 bornes exactes du tirage pondéré (poids 40/30/20/10 sur 100).
{
    const originalRandom = Math.random;
    Math.random = () => 0; // roll = 0 -> tout premier bloc (weapon, [0, 40))
    assert(rollWelcomeGiftType() === 'weapon', "rollWelcomeGiftType() : Arme en bas de plage (poids le plus fort)");
    Math.random = () => 0.45; // roll = 45 -> [40, 70) = nothing
    assert(rollWelcomeGiftType() === 'nothing', "rollWelcomeGiftType() : Rien au 2e rang de poids");
    Math.random = () => 0.75; // roll = 75 -> [70, 90) = ranged
    assert(rollWelcomeGiftType() === 'ranged', "rollWelcomeGiftType() : Tir au 3e rang de poids");
    Math.random = () => 0.95; // roll = 95 -> [90, 100) = spell
    assert(rollWelcomeGiftType() === 'spell', "rollWelcomeGiftType() : Magie au poids le plus faible");
    Math.random = originalRandom;

    const weights = Object.values(WELCOME_GIFT_WEIGHTS);
    assert(WELCOME_GIFT_WEIGHTS.weapon > WELCOME_GIFT_WEIGHTS.nothing
        && WELCOME_GIFT_WEIGHTS.nothing > WELCOME_GIFT_WEIGHTS.ranged
        && WELCOME_GIFT_WEIGHTS.ranged > WELCOME_GIFT_WEIGHTS.spell,
        "WELCOME_GIFT_WEIGHTS : ordre Arme > Rien > Tir > Magie respecté");
    assert(weights.every(w => w > 0), "WELCOME_GIFT_WEIGHTS : tous les poids restent strictement positifs");
}

// generateWelcomeGiftItem() : toujours au palier Commun (aucun enchantement), quel que soit le type.
{
    const originalRandom = Math.random;
    Math.random = () => 0;
    const weapon = generateWelcomeGiftItem('weapon');
    const ranged = generateWelcomeGiftItem('ranged');
    const spell = generateWelcomeGiftItem('spell');
    Math.random = originalRandom;

    assert(weapon.category === 'weapons' && weapon.rarity === 'Commun' && !weapon.mechanics, "generateWelcomeGiftItem('weapon') : arme Commune, sans enchantement");
    assert(ranged.category === 'ranged' && ranged.rarity === 'Commun' && !ranged.mechanics, "generateWelcomeGiftItem('ranged') : arme à distance Commune, sans enchantement");
    assert(spell.category === 'scrolls' && spell.rarity === 'Commun' && ['melee', 'ranged'].includes(spell.spellCategory), "generateWelcomeGiftItem('spell') : parchemin Commun, catégorie de sort valide");
    assert(generateWelcomeGiftItem('nothing') === null, "generateWelcomeGiftItem('nothing') : aucun objet généré");
}

// confirmPlayerName() : nom saisi (ou repli sur l'existant si vide), masque l'écran de départ, puis
// enchaîne sur revealWelcomeGift().
{
    resetTransientState();
    gameState.playerName = "CRAWLER_01";
    ui.startScreenOverlay.classList.remove('hidden');
    ui.giftRevealOverlay.classList.add('hidden');
    ui.startNameInput.value = "  Mordicaï-Deux  ";
    confirmPlayerName();
    assert(gameState.playerName === "Mordicaï-Deux", "confirmPlayerName() : nom saisi (avec espaces superflus retirés) adopté");
    assert(ui.startScreenOverlay.classList.contains('hidden'), "confirmPlayerName() : masque l'écran de départ");
    assert(!ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : enchaîne sur la révélation du cadeau");

    resetTransientState();
    gameState.playerName = "CRAWLER_01";
    ui.startNameInput.value = "   ";
    confirmPlayerName();
    assert(gameState.playerName === "CRAWLER_01", "confirmPlayerName() : nom vide -> repli sur le nom déjà existant");
}

// revealWelcomeGift() : équipe directement le bon emplacement selon le type tiré (aucun inventaire à
// gérer, tout est vide en tout début de partie) ; "nothing" ne touche à rien.
{
    resetTransientState();
    const originalRandom = Math.random;
    Math.random = () => 0; // -> 'weapon'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.weapon !== null, "revealWelcomeGift('weapon') : équipe directement une arme");
    assert(gameState.equipment.ranged === null && gameState.equipment.spell === null, "revealWelcomeGift('weapon') : ne touche à aucun autre emplacement");

    resetTransientState();
    Math.random = () => 0.75; // -> 'ranged'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.ranged !== null, "revealWelcomeGift('ranged') : équipe directement une arme à distance");

    resetTransientState();
    gameState.mana = 0;
    Math.random = () => 0.95; // -> 'spell'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.spell !== null, "revealWelcomeGift('spell') : équipe directement un sort");
    assert(gameState.mana === gameState.maxMana, "revealWelcomeGift('spell') : première équipe -> mana plein, comme equipSpell()");

    resetTransientState();
    Math.random = () => 0.45; // -> 'nothing'
    revealWelcomeGift();
    Math.random = originalRandom;
    assert(gameState.equipment.weapon === null && gameState.equipment.ranged === null && gameState.equipment.spell === null, "revealWelcomeGift('nothing') : aucun équipement, comme annoncé");
}

// dismissGiftReveal() : referme l'écran de révélation.
{
    ui.giftRevealOverlay.classList.remove('hidden');
    dismissGiftReveal();
    assert(ui.giftRevealOverlay.classList.contains('hidden'), "dismissGiftReveal() : masque l'écran de révélation du cadeau");
}

// ===================================================================
// Kit de test (bouton discret "🧪 Kit de Test", remplace l'ancien export de logs) : équipe 1 arme,
// 1 arme à distance et 1 sort, tous au palier Légendaire, pour tester les mécaniques sans dépendre
// du loot aléatoire (voir generateTestKitItem()/generateTestKitSpell() dans generator.js).
// ===================================================================
{
    const legendaire = itemRarities[itemRarities.length - 1];
    assert(legendaire.name === "Légendaire", "Sanity : le dernier palier d'itemRarities est bien Légendaire");

    for (let i = 0; i < 20; i++) {
        const weapon = generateTestKitItem('weapons');
        assert(weapon.category === 'weapons' && weapon.rarity === 'Légendaire', "generateTestKitItem('weapons') : catégorie et rareté forcées");
        if (weapon.canEnchant !== false) {
            assert(weapon.mechanics && weapon.mechanics.length === legendaire.slots, "generateTestKitItem('weapons') : tous les slots d'enchantement du palier Légendaire sont remplis");
        }

        const ranged = generateTestKitItem('ranged');
        assert(ranged.category === 'ranged' && ranged.rarity === 'Légendaire', "generateTestKitItem('ranged') : catégorie et rareté forcées");

        const spell = generateTestKitSpell();
        assert(spell.category === 'scrolls' && spell.rarity === 'Légendaire', "generateTestKitSpell() : catégorie et rareté forcées");
        assert(['melee', 'ranged'].includes(spell.spellCategory), "generateTestKitSpell() : catégorie de sort valide");
    }
}

// giveTestKit() : équipe directement les 3 emplacements et remplit le mana, en un seul appel.
{
    resetTransientState();
    gameState.equipment.weapon = null;
    gameState.equipment.ranged = null;
    gameState.equipment.spell = null;
    gameState.mana = 0;
    giveTestKit();
    assert(gameState.equipment.weapon !== null && gameState.equipment.weapon.rarity === 'Légendaire', "giveTestKit() : équipe une arme légendaire");
    assert(gameState.equipment.ranged !== null && gameState.equipment.ranged.rarity === 'Légendaire', "giveTestKit() : équipe une arme à distance légendaire");
    assert(gameState.equipment.spell !== null && gameState.equipment.spell.rarity === 'Légendaire', "giveTestKit() : équipe un sort légendaire");
    assert(gameState.mana === gameState.maxMana, "giveTestKit() : remplit le mana au maximum");
}

// ===================================================================
// Sauvegarde (localStorage, une entrée par nom de crawler) : saveGame()/restoreSaveForName()/
// hasSaveForName()/listSavedCrawlerNames() dans app.js, identification par le nom saisi sur l'écran
// de départ (voir confirmPlayerName()).
// ===================================================================
{
    localStorage.clear();

    // saveKeyForName() : espaces superflus et casse ignorés
    assert(saveKeyForName("  Barbara  ") === saveKeyForName("BARBARA"), "saveKeyForName() : espaces et casse ignorés");

    // saveGame() : no-op tant que saveEnabled est faux
    resetTransientState();
    gameState.playerName = "Test Sauvegarde";
    gameState.saveEnabled = false;
    saveGame();
    assert(!hasSaveForName("Test Sauvegarde"), "saveGame() : aucune écriture tant que saveEnabled est faux");

    // saveGame() : écrit bien sous la clé du nom une fois activé
    gameState.saveEnabled = true;
    gameState.currentFloor = 4;
    gameState.level = 7;
    saveGame();
    assert(hasSaveForName("Test Sauvegarde"), "saveGame() : écrit sous la clé du nom du crawler une fois activé");
    assert(hasSaveForName("  test sauvegarde  "), "hasSaveForName() : casse et espaces ignorés à la lecture aussi");
}

// restoreSaveForName() : restaure l'état sauvegardé, mais nettoie systématiquement tout état
// transitoire/bloquant (jamais de restauration en plein combat ou sur un choix en attente).
{
    resetTransientState();
    gameState.playerName = "Mordicaï le Sauvé";
    gameState.saveEnabled = true;
    gameState.currentFloor = 5;
    gameState.level = 9;
    gameState.hp = 42;
    gameState.equipment.weapon = { name: "Hache de Sauvegarde", baseDmg: 20, category: 'weapons' };
    // État transitoire volontairement "sale" au moment de la sauvegarde
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Ne devrait jamais revenir", hp: 50, maxHp: 50, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 5;
    gameState.bossChoicePending = true;
    saveGame();

    resetTransientState(); // Simule un rechargement de page : repart d'un état neuf
    const ok = restoreSaveForName("mordicaï le sauvé");
    assert(ok === true, "restoreSaveForName() : réussit pour un nom sauvegardé (insensible à la casse)");
    assert(gameState.playerName === "Mordicaï le Sauvé", "restoreSaveForName() : conserve la casse d'origine du nom sauvegardé");
    assert(gameState.currentFloor === 5 && gameState.level === 9 && gameState.hp === 42, "restoreSaveForName() : restaure bien la progression sauvegardée");
    assert(gameState.equipment.weapon && gameState.equipment.weapon.name === "Hache de Sauvegarde", "restoreSaveForName() : restaure bien l'équipement sauvegardé");
    assert(gameState.inCombat === false && gameState.currentEnemy === null, "restoreSaveForName() : ne restaure jamais en plein combat");
    assert(gameState.combatDistance === 0, "restoreSaveForName() : réinitialise l'écart de combat");
    assert(gameState.bossChoicePending === false, "restoreSaveForName() : ne restaure jamais sur un choix de boss en attente");
    assert(gameState.saveEnabled === true, "restoreSaveForName() : réactive l'autosauvegarde");
}

// restoreSaveForName() : migration douce d'une sauvegarde ANTÉRIEURE au système d'anomalies
// (Tâche 4) — pas de baseMaxHp dans le JSON brut : son maxHp d'alors devient la vraie base, jamais
// silencieusement retombé sur 100 (ce qui léserait un personnage déjà bien monté en niveau).
{
    resetTransientState();
    const rawOldSave = {
        playerName: "Ancien Crawler",
        currentFloor: 6,
        level: 12,
        hp: 200,
        maxHp: 250, // Ancienne sauvegarde : maxHp EST la base, aucun système d'anomalies n'existait
        atk: 30,
        def: 15
        // baseMaxHp, anomalyEffects, activeAnomalies : absents, comme toute sauvegarde pré-Tâche-4
    };
    localStorage.setItem(saveKeyForName("Ancien Crawler"), JSON.stringify(rawOldSave));

    resetTransientState();
    const ok = restoreSaveForName("ancien crawler");
    assert(ok === true, "restoreSaveForName() : restaure bien une sauvegarde brute sans baseMaxHp");
    assert(gameState.baseMaxHp === 250, "restoreSaveForName() : migration douce -> baseMaxHp reprend l'ancien maxHp (250), jamais le défaut 100");
    assert(gameState.maxHp === 250, "restoreSaveForName() : maxHp reste cohérent (aucune anomalie active à la restauration)");
    assert(gameState.activeAnomalies.length === 0 && gameState.anomalyEffects.allDamageMult === 1,
        "restoreSaveForName() : anomalyEffects/activeAnomalies retombent sur leurs valeurs neutres, jamais undefined");
    assert(gameState.pactChoicePending === false, "restoreSaveForName() : ne restaure jamais sur un Pacte du Crawler en attente");
}

// restoreSaveForName() : échec propre pour un nom sans sauvegarde, sans toucher au gameState.
{
    resetTransientState();
    gameState.playerName = "Inchangé";
    const ok = restoreSaveForName("Ce Crawler N'Existe Pas");
    assert(ok === false, "restoreSaveForName() : renvoie false pour un nom sans sauvegarde");
    assert(gameState.playerName === "Inchangé", "restoreSaveForName() : ne touche pas au gameState en cas d'échec");
}

// listSavedCrawlerNames() : recense les sauvegardes existantes, ignore les entrées corrompues.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Chip Cachalot";
    gameState.saveEnabled = true;
    saveGame();
    resetTransientState();
    gameState.playerName = "Nadia Sans-Peur";
    gameState.saveEnabled = true;
    saveGame();
    localStorage.setItem(SAVE_KEY_PREFIX + "corrompu", "{ceci n'est pas du JSON valide");

    const names = listSavedCrawlerNames();
    assert(names.includes("Chip Cachalot") && names.includes("Nadia Sans-Peur"), "listSavedCrawlerNames() : recense toutes les sauvegardes valides");
    assert(names.length === 2, "listSavedCrawlerNames() : ignore silencieusement l'entrée corrompue");
}

// confirmPlayerName() : reprend une partie existante (pas de cadeau) si le nom saisi correspond à
// une sauvegarde, sinon démarre un nouveau crawler (avec cadeau) comme avant.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Gunther l'Endurci";
    gameState.saveEnabled = true;
    gameState.currentFloor = 3;
    saveGame();

    resetTransientState();
    ui.startNameInput.value = "gunther l'endurci"; // Casse différente : doit quand même reprendre
    ui.startScreenOverlay.classList.remove('hidden');
    ui.giftRevealOverlay.classList.add('hidden');
    confirmPlayerName();
    assert(gameState.playerName === "Gunther l'Endurci", "confirmPlayerName() : reprend la sauvegarde existante (casse d'origine)");
    assert(gameState.currentFloor === 3, "confirmPlayerName() : restaure bien la progression de la sauvegarde reprise");
    assert(ui.startScreenOverlay.classList.contains('hidden'), "confirmPlayerName() : masque l'écran de départ même en reprenant une partie");
    assert(ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : aucun cadeau de bienvenue pour une partie reprise");

    resetTransientState();
    ui.startNameInput.value = "Un Tout Nouveau Crawler";
    confirmPlayerName();
    assert(gameState.playerName === "Un Tout Nouveau Crawler", "confirmPlayerName() : nom inédit -> nouveau crawler");
    assert(!ui.giftRevealOverlay.classList.contains('hidden'), "confirmPlayerName() : cadeau de bienvenue bien déclenché pour un nouveau crawler");
    assert(gameState.saveEnabled === true, "confirmPlayerName() : active l'autosauvegarde pour un nouveau crawler aussi");
}

// ===================================================================
// Gestion des sauvegardes (écran "Nettoyer les sauvegardes") : listSavedCrawlersDetailed(),
// requestDeleteSave()/requestDeleteAllSaves()/cancelSaveDeletion()/confirmSaveDeletion(),
// restoreSavesBackup(). Voir CLAUDE.md.
// ===================================================================

// listSavedCrawlersDetailed() : nom + étage + horodatage par sauvegarde, entrée corrompue ignorée.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Detail Un";
    gameState.saveEnabled = true;
    gameState.currentFloor = 6;
    saveGame();
    resetTransientState();
    gameState.playerName = "Detail Deux";
    gameState.saveEnabled = true;
    gameState.currentFloor = 11;
    saveGame();
    localStorage.setItem(SAVE_KEY_PREFIX + "corrompu", "{pas du json");

    const entries = listSavedCrawlersDetailed();
    assert(entries.length === 2, "listSavedCrawlersDetailed() : ignore l'entrée corrompue");
    const one = entries.find(e => e.name === "Detail Un");
    assert(!!one && one.floor === 6 && typeof one.savedAt === 'number', "listSavedCrawlersDetailed() : étage et horodatage corrects");
}

// formatSaveTimestamp() : jamais d'exception, "date inconnue" pour une valeur absente.
{
    assert(formatSaveTimestamp(null) === "date inconnue", "formatSaveTimestamp() : null -> date inconnue");
    assert(formatSaveTimestamp(undefined) === "date inconnue", "formatSaveTimestamp() : undefined -> date inconnue");
    assert(typeof formatSaveTimestamp(Date.now()) === 'string' && formatSaveTimestamp(Date.now()) !== "date inconnue",
        "formatSaveTimestamp() : un horodatage valide produit une date formatée");
}

// requestDeleteSave()/confirmSaveDeletion() : supprime UNE sauvegarde après confirmation, sauvegarde
// d'abord son contenu dans le slot de backup unique (jamais de suppression sans passer par
// pendingSaveDeletion, donc jamais sans confirmation explicite de l'appelant).
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "À Supprimer";
    gameState.saveEnabled = true;
    gameState.currentFloor = 4;
    saveGame();
    resetTransientState();
    gameState.playerName = "À Garder";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteSave("À Supprimer");
    assert(pendingSaveDeletion && pendingSaveDeletion.mode === 'single' && pendingSaveDeletion.name === "À Supprimer",
        "requestDeleteSave() : pose l'action en attente, ne supprime rien tout de suite");
    assert(hasSaveForName("À Supprimer"), "requestDeleteSave() : la sauvegarde existe toujours avant confirmation");

    confirmSaveDeletion();
    assert(!hasSaveForName("À Supprimer"), "confirmSaveDeletion() : supprime bien la sauvegarde visée après confirmation");
    assert(hasSaveForName("À Garder"), "confirmSaveDeletion() : ne touche jamais aux autres sauvegardes (suppression individuelle)");
    assert(pendingSaveDeletion === null, "confirmSaveDeletion() : referme l'action en attente");

    const backupRaw = localStorage.getItem(SAVE_BACKUP_KEY);
    assert(!!backupRaw, "confirmSaveDeletion() : écrit un backup avant de supprimer");
    const backup = JSON.parse(backupRaw);
    assert(backup.entries.length === 1 && backup.entries[0].key === saveKeyForName("À Supprimer"),
        "confirmSaveDeletion() : le backup contient exactement la sauvegarde supprimée");
}

// cancelSaveDeletion() : n'importe quelle suppression en attente peut être annulée sans effet.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Jamais Supprimé";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteSave("Jamais Supprimé");
    cancelSaveDeletion();
    assert(pendingSaveDeletion === null, "cancelSaveDeletion() : referme l'action en attente");
    assert(hasSaveForName("Jamais Supprimé"), "cancelSaveDeletion() : la sauvegarde n'est jamais supprimée");
}

// requestDeleteAllSaves()/confirmSaveDeletion() : supprime TOUTES les sauvegardes, toutes présentes
// dans le backup (écrasant un backup précédent).
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Tous Un";
    gameState.saveEnabled = true;
    saveGame();
    resetTransientState();
    gameState.playerName = "Tous Deux";
    gameState.saveEnabled = true;
    saveGame();

    requestDeleteAllSaves();
    assert(pendingSaveDeletion && pendingSaveDeletion.mode === 'all', "requestDeleteAllSaves() : pose l'action 'all' en attente");
    confirmSaveDeletion();
    assert(listSavedCrawlerNames().length === 0, "confirmSaveDeletion() (mode 'all') : supprime bien toutes les sauvegardes");
    const backup = JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY));
    assert(backup.entries.length === 2, "confirmSaveDeletion() (mode 'all') : le backup contient bien les DEUX sauvegardes supprimées");
}

// restoreSavesBackup() : réécrit chaque entrée du backup à sa clé d'origine, jamais d'exception sur
// un backup absent/corrompu.
{
    localStorage.clear();
    resetTransientState();
    gameState.playerName = "Restaurable";
    gameState.saveEnabled = true;
    gameState.currentFloor = 9;
    saveGame();
    requestDeleteAllSaves();
    confirmSaveDeletion();
    assert(!hasSaveForName("Restaurable"), "setup : la sauvegarde est bien supprimée avant de tester la restauration");

    restoreSavesBackup();
    assert(hasSaveForName("Restaurable"), "restoreSavesBackup() : la sauvegarde réapparaît après restauration");
    const ok = restoreSaveForName("Restaurable");
    assert(ok && gameState.currentFloor === 9, "restoreSavesBackup() : le contenu restauré est bien celui d'avant suppression");

    localStorage.removeItem(SAVE_BACKUP_KEY);
    restoreSavesBackup(); // Aucun backup : ne doit jamais lever d'exception
    localStorage.setItem(SAVE_BACKUP_KEY, "{pas du json");
    restoreSavesBackup(); // Backup corrompu : idem
}

// ===================================================================
// Écran d'escalier (félicitations) : applyPlayerDamage()/gainXp()/addLoot()/winCombat() alimentent
// gameState.floorStats, triggerFloorTransition()/continueFromFloorTransition() dans app.js.
// ===================================================================

// applyPlayerDamage() : point de passage unique pour toute perte de PV — clampe à 0, alimente
// floorStats.damageTaken, aucun effet pour un montant nul/négatif.
{
    resetTransientState();
    gameState.hp = 50;
    applyPlayerDamage(20);
    assert(gameState.hp === 30, "applyPlayerDamage() : réduit bien les PV du montant donné");
    assert(gameState.floorStats.damageTaken === 20, "applyPlayerDamage() : alimente floorStats.damageTaken");

    applyPlayerDamage(1000);
    assert(gameState.hp === 0, "applyPlayerDamage() : clampe à 0, jamais négatif");
    assert(gameState.floorStats.damageTaken === 1020, "applyPlayerDamage() : cumule bien plusieurs appels");

    const before = gameState.floorStats.damageTaken;
    applyPlayerDamage(0);
    applyPlayerDamage(-5);
    assert(gameState.floorStats.damageTaken === before, "applyPlayerDamage() : aucun effet pour un montant nul ou négatif");
}

// gainXp()/addLoot()/winCombat() : alimentent bien gameState.floorStats (xpGained/itemsFound/mobsKilled).
{
    resetTransientState();
    gainXp(30);
    assert(gameState.floorStats.xpGained === 30, "gainXp() : alimente floorStats.xpGained");

    resetTransientState();
    addLoot(0.5);
    assert(gameState.floorStats.itemsFound === 1, "addLoot() : alimente floorStats.itemsFound (objet effectivement conservé)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Tally", hp: -9999, maxHp: 30, atk: 5, def: 2, xpReward: 10, status: {} };
    winCombat();
    assert(gameState.floorStats.mobsKilled === 1, "winCombat() : alimente floorStats.mobsKilled");
    continueFromFloorTransition(); // Reprend la main normalement (l'écran d'escalier n'est PAS testé ici)
}

// addLoot() : réserve d'équipement pleine -> l'objet n'est pas conservé, ne compte donc pas dans le tally.
{
    resetTransientState();
    gameState.inventory = [];
    for (let i = 0; i < gameState.maxInventory; i++) gameState.inventory.push({ name: `Filler ${i}`, category: 'weapons' });

    const originalRandom = Math.random;
    Math.random = () => 0; // categories[0] = 'weapons' (voir generator.js) : jamais un consommable, toujours limité
    addLoot(0);
    Math.random = originalRandom;
    assert(gameState.floorStats.itemsFound === 0, "addLoot() : réserve pleine -> objet non conservé, jamais compté dans le tally");
    gameState.inventory = []; // Ne pas polluer l'inventaire pour les tests suivants (resetTransientState() ne le touche pas)
}

// getUpcomingAnomalyAnnouncement() : tire réellement l'anomalie du PROCHAIN étage (voir anomalies.js)
// et la mémorise (gameState.pendingNextFloorAnomalies) pour rollAndApplyFloorAnomalies() — couverture
// complète du tirage/stacking/incompatibilités dans la section "Anomalies d'étage" plus bas.
{
    assert(getUpcomingAnomalyAnnouncement(1) === null, "getUpcomingAnomalyAnnouncement() : aucune anomalie annoncée pour l'étage 1 (tuto)");
    assert(getUpcomingAnomalyAnnouncement(2) === null, "getUpcomingAnomalyAnnouncement() : aucune anomalie annoncée pour l'étage 2 (tuto)");

    const announcement = getUpcomingAnomalyAnnouncement(4);
    assert(announcement !== null && typeof announcement.name === 'string' && typeof announcement.description === 'string',
        "getUpcomingAnomalyAnnouncement() : renvoie {name, description} dès qu'une anomalie est tirée (étage 4)");
    assert(gameState.pendingNextFloorAnomalies && gameState.pendingNextFloorAnomalies.floor === 4 && gameState.pendingNextFloorAnomalies.anomalies.length === 1,
        "getUpcomingAnomalyAnnouncement() : mémorise le tirage exact pour rollAndApplyFloorAnomalies()");
    gameState.pendingNextFloorAnomalies = null;
}

// triggerFloorTransition() : affiche l'écran avec le résumé de l'étage QUI VIENT DE SE TERMINER
// (avant qu'advanceToNextFloor() ne remette floorStats à zéro), bloque via floorTransitionPending
// (isActionBlocked()) — jamais gameState.inCombat, qui collisionnerait avec la logique générique
// "combat sans ennemi" ailleurs dans le code (voir commentaire dans app.js).
{
    resetTransientState();
    gameState.currentFloor = 1; // Prochain étage = 2 (tuto) : jamais d'anomalie, voir rollFloorAnomalies()
    gameState.floorStats = { mobsKilled: 3, damageTaken: 12, itemsFound: 2, xpGained: 80 };

    triggerFloorTransition();
    assert(gameState.floorTransitionPending === true, "triggerFloorTransition() : pose le flag dédié");
    assert(isActionBlocked() === true, "triggerFloorTransition() : isActionBlocked() vrai tant que l'écran est affiché");
    assert(gameState.inCombat === false, "triggerFloorTransition() : n'utilise PAS gameState.inCombat pour bloquer");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === false, "triggerFloorTransition() : affiche l'overlay");
    assert(ui.floorTransitionTitle.innerText.includes("1"), "triggerFloorTransition() : le titre mentionne l'étage qui vient de se terminer (1)");
    assert(String(ui.floorTransitionMobs.innerText) === "3" && String(ui.floorTransitionDamage.innerText) === "12"
        && String(ui.floorTransitionItems.innerText) === "2" && String(ui.floorTransitionXp.innerText) === "80",
        "triggerFloorTransition() : affiche le tally exact de l'étage qui vient de se terminer");
    assert(ui.floorTransitionAnomaly.classList.contains('hidden') === true,
        "triggerFloorTransition() : le bloc anomalie reste masqué quand getUpcomingAnomalyAnnouncement() renvoie null (étage 2, tuto)");
}

// triggerFloorTransition() : le bloc anomalie s'affiche et se remplit dès qu'une anomalie est
// annoncée pour le prochain étage (voir getUpcomingAnomalyAnnouncement()).
{
    resetTransientState();
    gameState.currentFloor = 3; // Prochain étage = 4 : anomalie garantie (pool restreint non vide)
    gameState.floorStats = { mobsKilled: 0, damageTaken: 0, itemsFound: 0, xpGained: 0 };

    triggerFloorTransition();
    assert(ui.floorTransitionAnomaly.classList.contains('hidden') === false,
        "triggerFloorTransition() : affiche le bloc anomalie dès qu'une anomalie est annoncée");
    assert(ui.floorTransitionAnomalyText.innerText.includes("Bon courage"),
        "triggerFloorTransition() : le texte d'annonce suit le gabarit attendu");
    continueFromFloorTransition();
    assert(gameState.activeAnomalies.length === 1, "continueFromFloorTransition() : applique exactement l'anomalie annoncée sur l'écran d'escalier");
}

// continueFromFloorTransition() : referme l'écran, débloque, et fait RÉELLEMENT avancer l'étage
// (advanceToNextFloor()) — jamais l'inverse (l'étage n'avance jamais avant le clic explicite).
{
    resetTransientState();
    gameState.currentFloor = 4;
    gameState.floorStats = { mobsKilled: 3, damageTaken: 12, itemsFound: 2, xpGained: 80 };
    triggerFloorTransition();

    continueFromFloorTransition();
    assert(gameState.currentFloor === 5, "continueFromFloorTransition() : fait bien passer à l'étage suivant");
    assert(gameState.floorTransitionPending === false, "continueFromFloorTransition() : referme le flag de blocage");
    assert(isActionBlocked() === false, "continueFromFloorTransition() : isActionBlocked() redevient false");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === true, "continueFromFloorTransition() : masque l'overlay");
    assert(gameState.floorStats.mobsKilled === 0 && gameState.floorStats.damageTaken === 0
        && gameState.floorStats.itemsFound === 0 && gameState.floorStats.xpGained === 0,
        "continueFromFloorTransition() (via advanceToNextFloor()) : le tally repart à zéro pour le nouvel étage");
}

// winCombat() : une victoire sur un gardien d'escalier (classique ou urbain) affiche l'écran
// d'escalier AVANT de faire avancer l'étage — jamais d'avance synchrone directe.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.pendingStairAfterCombat = true;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Gardien Test", hp: -9999, maxHp: 50, atk: 5, def: 2, xpReward: 20, status: {}, isBoss: true };

    winCombat();
    assert(gameState.currentFloor === 1, "winCombat() (gardien) : n'avance PAS l'étage directement");
    assert(gameState.floorTransitionPending === true, "winCombat() (gardien) : affiche l'écran d'escalier à la place");

    continueFromFloorTransition();
    assert(gameState.currentFloor === 2, "continueFromFloorTransition() : fait avancer l'étage après coup");
}

// ===================================================================
// Nécrologie sarcastique : generateEpitaph()/recordEpitaph() (règles spéciales mob faible/backfire/
// fuites/objet ridicule) et leur câblage dans gameOver() (cause dérivée du contexte réel de mort).
// ===================================================================

// generateEpitaph() : cause 'combat' générique — placeholders bien remplacés, aucun {{...}} résiduel.
{
    resetTransientState();
    gameState.currentFloor = 5;
    gameState.level = 3;
    const originalRandom = Math.random;
    Math.random = () => 0; // Premier template de chaque pool (voir pick())
    const text = generateEpitaph({ cause: 'combat', enemyName: "Gobelin Test" });
    Math.random = originalRandom;
    assert(text.includes("Gobelin Test"), "generateEpitaph() : {{mob}} remplacé par le nom du tueur");
    assert(text.includes("5"), "generateEpitaph() : {{etage}} remplacé par l'étage courant");
    assert(!/\{\{.*?\}\}/.test(text), "generateEpitaph() : aucun placeholder résiduel dans le texte final");
}

// generateEpitaph() : causes sans mob (trap/bleed/timeout) — pool dédié, pas de {{mob}} attendu.
{
    resetTransientState();
    gameState.currentFloor = 2;
    for (const cause of ['trap', 'bleed', 'timeout']) {
        const text = generateEpitaph({ cause, enemyName: null });
        assert(typeof text === 'string' && text.length > 0, `generateEpitaph() : produit un texte non vide pour la cause '${cause}'`);
        assert(!/\{\{.*?\}\}/.test(text), `generateEpitaph() : aucun placeholder résiduel pour la cause '${cause}'`);
    }
}

// Règle spéciale : mob de niveau très inférieur (deltaNiveau >= NECROLOGIE_WEAK_MOB_DELTA) -> pool
// mobFaible dédié, distinct du pool 'combat' générique.
{
    resetTransientState();
    gameState.currentFloor = 1; // "niveau" du mob ≈ étage (voir getMobLevelEquivalent())
    gameState.level = 1 + NECROLOGIE_WEAK_MOB_DELTA; // Écart tout juste suffisant pour déclencher la règle
    const originalRandom = Math.random;
    Math.random = () => 0;
    const text = generateEpitaph({ cause: 'combat', enemyName: "Faiblard Test" });
    Math.random = originalRandom;
    assert(text === EPITAPH_TEMPLATES.mobFaible[0]
        .replace(/\{\{mob\}\}/g, "Faiblard Test")
        .replace(/\{\{etage\}\}/g, 1)
        .replace(/\{\{deltaNiveau\}\}/g, NECROLOGIE_WEAK_MOB_DELTA),
        "generateEpitaph() : mob très inférieur -> pool mobFaible dédié utilisé");

    // Juste sous le seuil : reste sur le pool 'combat' générique.
    gameState.level = NECROLOGIE_WEAK_MOB_DELTA; // Écart d'un cran sous le seuil
    Math.random = () => 0;
    const textBelow = generateEpitaph({ cause: 'combat', enemyName: "Faiblard Test" });
    Math.random = originalRandom;
    assert(textBelow === EPITAPH_TEMPLATES.combat[0]
        .replace(/\{\{mob\}\}/g, "Faiblard Test")
        .replace(/\{\{etage\}\}/g, 1)
        .replace(/\{\{crawler\}\}/g, gameState.playerName),
        "generateEpitaph() : écart juste sous le seuil -> pool 'combat' générique conservé");
}

// Règle spéciale : cause 'backfire' -> pool dédié, jamais le pool 'combat' générique.
{
    resetTransientState();
    gameState.currentFloor = 6;
    gameState.level = 6; // Aucun écart de niveau ici : seule la cause décide du pool
    const originalRandom = Math.random;
    Math.random = () => 0;
    const text = generateEpitaph({ cause: 'backfire', enemyName: "Punisher Test" });
    Math.random = originalRandom;
    assert(text === EPITAPH_TEMPLATES.backfire[0].replace(/\{\{etage\}\}/g, 6),
        "generateEpitaph() : cause 'backfire' -> pool dédié utilisé");
}

// Mention spéciale : 3+ fuites ce run -> phrase ajoutée en fin d'épitaphe ; en dessous du seuil, absente.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.fleesThisRun = NECROLOGIE_FLEE_THRESHOLD;
    const originalRandom = Math.random;
    Math.random = () => 0;
    const withMention = generateEpitaph({ cause: 'trap', enemyName: null });
    gameState.fleesThisRun = NECROLOGIE_FLEE_THRESHOLD - 1;
    const withoutMention = generateEpitaph({ cause: 'trap', enemyName: null });
    Math.random = originalRandom;
    assert(withMention.includes(String(NECROLOGIE_FLEE_THRESHOLD)), "generateEpitaph() : mention des fuites présente à partir du seuil");
    assert(!withoutMention.includes(EPITAPH_FLEE_MENTIONS[0].split('{{')[0]), "generateEpitaph() : aucune mention de fuite sous le seuil");
}

// Mention spéciale : objet équipé "ridicule" (jokeItem: true) -> mention ajoutée ; absent sinon.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.equipment.weapon = { name: "Extincteur Cabossé", jokeItem: true };
    const originalRandom = Math.random;
    Math.random = () => 0;
    const withItem = generateEpitaph({ cause: 'trap', enemyName: null });
    gameState.equipment.weapon = { name: "Épée Normale" }; // Pas de jokeItem
    const withoutItem = generateEpitaph({ cause: 'trap', enemyName: null });
    Math.random = originalRandom;
    assert(withItem.includes("Extincteur Cabossé"), "generateEpitaph() : mention de l'objet ridicule équipé présente");
    assert(!withoutItem.includes("Extincteur Cabossé"), "generateEpitaph() : aucune mention d'objet ridicule s'il n'y en a pas");
}

// recordEpitaph() : journal plafonné à NECROLOGIE_MAX_ENTRIES, plus récente en premier.
{
    resetTransientState();
    for (let i = 0; i < NECROLOGIE_MAX_ENTRIES + 5; i++) {
        gameState.currentFloor = i;
        recordEpitaph(`Épitaphe #${i}`, { cause: 'trap' });
    }
    assert(gameState.necrologie.length === NECROLOGIE_MAX_ENTRIES, "recordEpitaph() : journal plafonné à NECROLOGIE_MAX_ENTRIES entrées");
    assert(gameState.necrologie[0].text === `Épitaphe #${NECROLOGIE_MAX_ENTRIES + 4}`, "recordEpitaph() : la plus récente entrée est en tête");
}

// gameOver() : cause dérivée du contexte réel (trap/bleed/combat/backfire/timeout), épitaphe affichée
// et enregistrée dans gameState.necrologie.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.hp = 0;
    gameOver(false, 'trap');
    assert(gameState.necrologie.length === 1, "gameOver() : une épitaphe est bien enregistrée à la mort");
    assert(gameState.necrologie[0].cause === 'trap', "gameOver() : cause 'trap' correctement attribuée");
    assert(String(ui.gameOverEpitaph.innerText).length > 0, "gameOver() : l'épitaphe est affichée sur l'écran de mort");

    resetTransientState();
    gameState.hp = 0;
    gameOver(false, 'bleed');
    assert(gameState.necrologie[0].cause === 'bleed', "gameOver() : cause 'bleed' correctement attribuée");

    resetTransientState();
    gameState.hp = 0;
    gameOver(true);
    assert(gameState.necrologie[0].cause === 'timeout', "gameOver() : cause 'timeout' correctement attribuée");

    resetTransientState();
    gameState.hp = 0;
    gameOver(false, { name: "Ogre Test" });
    assert(gameState.necrologie[0].cause === 'combat', "gameOver() : cause 'combat' par défaut pour un tueur objet, sans backfire en cours");

    resetTransientState();
    gameState.hp = 0;
    gameState.lastPlayerActionWasBackfire = true;
    gameOver(false, { name: "Ogre Test" });
    assert(gameState.necrologie[0].cause === 'backfire', "gameOver() : cause 'backfire' attribuée si le sort du joueur vient de partir en flop");
}

// tryPlayerAction() : remet lastPlayerActionWasBackfire à faux au tout début de CHAQUE action, pour
// qu'un backfire ne "contamine" jamais un décès survenant lors d'une action ultérieure sans rapport.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Backfire", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    gameState.lastPlayerActionWasBackfire = true;
    tryPlayerAction();
    assert(gameState.lastPlayerActionWasBackfire === false, "tryPlayerAction() : réinitialise lastPlayerActionWasBackfire en tout début d'action");
}

// attemptFlee() : incrémente gameState.fleesThisRun UNIQUEMENT sur une fuite réussie.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Fuite", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    const originalRandom = Math.random;
    Math.random = () => 0; // < fleeChance (60%) -> fuite réussie
    attemptFlee();
    Math.random = originalRandom;
    assert(gameState.fleesThisRun === 1, "attemptFlee() : incrémente fleesThisRun sur une fuite réussie");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Fuite Ratée", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    Math.random = () => 0.99; // >= fleeChance -> fuite ratée
    attemptFlee();
    Math.random = originalRandom;
    assert(gameState.fleesThisRun === 0, "attemptFlee() : n'incrémente pas fleesThisRun sur une fuite ratée");
}

// ===================================================================
// Anomalies d'étage (anomalies.js) : tirage par tranche, incompatibilités, stacking des effets,
// hook appliquerAnomalie(), et câblage dans app.js (dégâts, PV max, furtivité, XP, PACTE_DU_CRAWLER).
// ===================================================================

// rollFloorAnomalies() : règles d'intensité par tranche d'étage.
{
    for (const floor of [1, 2]) {
        assert(rollFloorAnomalies(floor).length === 0, `rollFloorAnomalies(${floor}) : aucune anomalie sur les étages tuto`);
    }
    for (let i = 0; i < 30; i++) {
        const rolled = rollFloorAnomalies(3 + (i % 4)); // étages 3 à 6
        assert(rolled.length === 1, "rollFloorAnomalies() : exactement 1 anomalie sur les étages 3-6");
        assert(rolled[0].intensiteMin <= 3, "rollFloorAnomalies() : étages 3-6 -> uniquement le pool restreint (intensiteMin <= 3)");
    }
    for (let i = 0; i < 30; i++) {
        const rolled = rollFloorAnomalies(7 + (i % 5)); // étages 7 à 11
        assert(rolled.length === 1, "rollFloorAnomalies() : exactement 1 anomalie sur les étages 7-11");
    }
    let sawFullPoolAnomaly = false;
    for (let i = 0; i < 60; i++) {
        const rolled = rollFloorAnomalies(12);
        if (rolled.some(a => a.intensiteMin > 3)) sawFullPoolAnomaly = true;
    }
    assert(sawFullPoolAnomaly, "rollFloorAnomalies() : étages 7-11 -> pool complet (pas seulement intensiteMin <= 3), constaté sur 60 tirages");
}

// rollFloorAnomalies() : étages 12+ -> 2 anomalies, toujours compatibles, jamais 2 bonus purs.
{
    for (let i = 0; i < 60; i++) {
        const rolled = rollFloorAnomalies(12 + (i % 6));
        assert(rolled.length === 1 || rolled.length === 2, "rollFloorAnomalies() : étages 12+ -> 1 (repli) ou 2 anomalies, jamais plus");
        if (rolled.length === 2) {
            assert(anomaliesAreCompatible(rolled[0], rolled[1]), "rollFloorAnomalies() : la paire tirée est toujours compatible (table d'incompatibilités)");
            const atLeastOneNonPositif = rolled.some(a => a.tags.includes('negatif') || a.tags.includes('mixte'));
            assert(atLeastOneNonPositif, "rollFloorAnomalies() : au moins une des deux anomalies n'est pas purement positive");
        }
    }
}

// anomaliesAreCompatible() : les deux paires explicitement interdites par la consigne le sont bien,
// dans les deux sens.
{
    const secheresse = findAnomalyById('SECHERESSE');
    const zoneMagique = findAnomalyById('ZONE_MAGIQUE');
    const peauDeVerre = findAnomalyById('PEAU_DE_VERRE');
    const adrenaline = findAnomalyById('ADRENALINE');
    assert(anomaliesAreCompatible(secheresse, zoneMagique) === false, "anomaliesAreCompatible() : SECHERESSE + ZONE_MAGIQUE interdit");
    assert(anomaliesAreCompatible(zoneMagique, secheresse) === false, "anomaliesAreCompatible() : interdiction symétrique (ZONE_MAGIQUE + SECHERESSE)");
    assert(anomaliesAreCompatible(peauDeVerre, adrenaline) === false, "anomaliesAreCompatible() : PEAU_DE_VERRE + ADRENALINE interdit");
    assert(anomaliesAreCompatible(adrenaline, peauDeVerre) === false, "anomaliesAreCompatible() : interdiction symétrique (ADRENALINE + PEAU_DE_VERRE)");
    assert(anomaliesAreCompatible(secheresse, adrenaline) === true, "anomaliesAreCompatible() : une paire non listée reste compatible");
    assert(anomaliesAreCompatible(secheresse, secheresse) === false, "anomaliesAreCompatible() : une anomalie n'est jamais compatible avec elle-même");
}

// computeAnomalyEffects() : stacking multiplicatif sur une même stat (2 anomalies ATK-mult -> produit
// des deux), additif sur les bonus en points, fonction PURE (hors gameState).
{
    const doubleAdrenaline = computeAnomalyEffects([
        { effects: { allDamageMult: 1.4 } },
        { effects: { allDamageMult: 1.2 } }
    ]);
    assert(Math.abs(doubleAdrenaline.allDamageMult - 1.68) < 1e-9, "computeAnomalyEffects() : stacking multiplicatif exact (1.4 × 1.2 = 1.68)");

    const stackedPoints = computeAnomalyEffects([
        { effects: { stealthCapBonus: 10, detectionBonus: 10 } },
        { effects: { stealthCapBonus: 5 } }
    ]);
    assert(stackedPoints.stealthCapBonus === 15, "computeAnomalyEffects() : stacking additif sur les bonus en points");
    assert(stackedPoints.detectionBonus === 10, "computeAnomalyEffects() : un champ non partagé n'est pas affecté par l'autre anomalie");

    const neutral = computeAnomalyEffects([]);
    assert(neutral.allDamageMult === 1 && neutral.playerMaxHpMult === 1 && neutral.forcedPactChoice === false,
        "computeAnomalyEffects() : une liste vide renvoie des effets strictement neutres");
}

// appliquerAnomalie() : hook UNIQUE, mute bien gameState.anomalyEffects (jamais un objet séparé).
{
    resetTransientState();
    const mobEnrage = findAnomalyById('MOB_ENRAGE');
    appliquerAnomalie(5, mobEnrage);
    assert(gameState.anomalyEffects.mobAtkMult === 1.15, "appliquerAnomalie() : applique l'effet ATQ de MOB_ENRAGE sur gameState.anomalyEffects");
    assert(gameState.anomalyEffects.xpMult === 1.3, "appliquerAnomalie() : applique l'effet XP de MOB_ENRAGE sur gameState.anomalyEffects");
}

// Intégration : rollDamage() applique allDamageMult (ADRENALINE) symétriquement joueur/mobs.
{
    resetTransientState();
    const before = rollDamage(100, 20, { varianceRange: 0 });
    gameState.anomalyEffects.allDamageMult = 1.4;
    const after = rollDamage(100, 20, { varianceRange: 0 });
    assert(Math.abs(after - before * 1.4) <= 1, "rollDamage() : ADRENALINE (allDamageMult) multiplie bien le résultat final");
}

// Intégration : gainXp() applique xpMult (MOB_ENRAGE).
{
    resetTransientState();
    gameState.anomalyEffects.xpMult = 1.3;
    gainXp(100);
    assert(gameState.xp + (gameState.level > 1 ? gameState.xpToNextLevel : 0) >= 129, "gainXp() : xpMult multiplie bien le montant gagné (100 -> 130)");
}

// Intégration : recomputeMaxHp() (PEAU_DE_VERRE) — PV max dérivé de baseMaxHp, jamais l'inverse.
{
    resetTransientState();
    gameState.baseMaxHp = 100;
    gameState.hp = 100;
    gameState.anomalyEffects.playerMaxHpMult = 0.7;
    recomputeMaxHp();
    assert(gameState.maxHp === 70, "recomputeMaxHp() : applique playerMaxHpMult à baseMaxHp (100 -> 70)");
    assert(gameState.hp === 70, "recomputeMaxHp() : clampe gameState.hp au nouveau maximum s'il le dépasse");

    gameState.anomalyEffects.playerMaxHpMult = 1;
    recomputeMaxHp();
    assert(gameState.maxHp === 100, "recomputeMaxHp() : revient à la vraie base une fois l'anomalie retombée à neutre");
}

// Intégration : applyPlayerHeal() (PEAU_DE_VERRE : healingMult) — soin réellement appliqué renvoyé,
// toujours clampé à gameState.maxHp.
{
    resetTransientState();
    gameState.hp = 50;
    gameState.anomalyEffects.healingMult = 1.5;
    const healed = applyPlayerHeal(20);
    assert(healed === 30, "applyPlayerHeal() : applique healingMult (20 × 1.5 = 30)");
    assert(gameState.hp === 80, "applyPlayerHeal() : PV effectivement augmentés du montant boosté");

    gameState.hp = gameState.maxHp - 5;
    const clamped = applyPlayerHeal(50);
    assert(clamped === 5, "applyPlayerHeal() : le soin RENVOYÉ reste clampé à gameState.maxHp, jamais le montant brut boosté");
}

// Intégration : getStealthChance()/attemptStealthEvasion() (NOCTURNE : stealthCapBonus/detectionBonus).
{
    resetTransientState();
    gameState.skills.stealth.level = 20; // Sature largement le plafond de base (60%)
    const baseline = getStealthChance();
    assert(baseline === 60, "getStealthChance() : plafonne à 60% sans anomalie");

    gameState.anomalyEffects.stealthCapBonus = 10;
    gameState.anomalyEffects.detectionBonus = 10;
    const withNocturne = getStealthChance();
    assert(withNocturne === 70, "getStealthChance() (NOCTURNE) : à compétence saturée, le plafond relevé (+10) domine malgré la pénalité de détection");

    gameState.skills.stealth.level = 1; // Chance de base faible : la pénalité de détection doit mordre
    const lowSkillPenalized = getStealthChance();
    const withoutAnomaly = (() => { gameState.anomalyEffects.stealthCapBonus = 0; gameState.anomalyEffects.detectionBonus = 0; return getStealthChance(); })();
    assert(lowSkillPenalized === withoutAnomaly - 10, "getStealthChance() (NOCTURNE) : pénalise bien un faible investissement en Furtivité");
}

// Intégration : gainSkillXp() (TEMPO_CREE : skillXpPerActionBonus).
{
    resetTransientState();
    gameState.skills.weapon.xp = 0;
    gainSkillXp('weapon', 3);
    const withoutBonus = gameState.skills.weapon.xp;

    resetTransientState();
    gameState.skills.weapon.xp = 0;
    gameState.anomalyEffects.skillXpPerActionBonus = 1;
    gainSkillXp('weapon', 3);
    assert(gameState.skills.weapon.xp === withoutBonus + 1, "gainSkillXp() (TEMPO_CREE) : +1 XP de compétence supplémentaire par action");
}

// PACTE_DU_CRAWLER : choix forcé, delta appliqué directement puis annulé au tout début du PROCHAIN
// advanceToNextFloor() — jamais un multiplicateur permanent.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.atk = 10;
    gameState.baseMaxHp = 100;
    recomputeMaxHp();
    triggerPactChoice();
    assert(gameState.pactChoicePending === true, "triggerPactChoice() : pose le flag dédié");
    assert(isActionBlocked() === true, "triggerPactChoice() : isActionBlocked() vrai tant que le choix est en attente");

    choosePactBlessing('atk');
    assert(gameState.pactChoicePending === false, "choosePactBlessing() : referme le choix");
    assert(gameState.atk === 10 + PACT_BLESSING_ATK_BONUS, "choosePactBlessing('atk') : applique le bonus d'ATQ");
    assert(gameState.baseMaxHp === 100 - PACT_BLESSING_ATK_HP_PENALTY, "choosePactBlessing('atk') : applique le malus de PV max");
    assert(gameState.pactBlessingDelta.atk === PACT_BLESSING_ATK_BONUS && gameState.pactBlessingDelta.hp === -PACT_BLESSING_ATK_HP_PENALTY,
        "choosePactBlessing('atk') : mémorise le delta exact pour la réversion");

    // La réversion se fait au tout début du PROCHAIN advanceToNextFloor(), avant même le tirage des
    // nouvelles anomalies de cet étage (étage 2, tuto -> generateFloorMap() classique).
    advanceToNextFloor();
    assert(gameState.atk === 10, "advanceToNextFloor() : annule le bonus d'ATQ du Pacte de l'étage précédent");
    assert(gameState.baseMaxHp === 100, "advanceToNextFloor() : annule le malus de PV max du Pacte de l'étage précédent");
    assert(gameState.pactBlessingDelta === null, "advanceToNextFloor() : le delta est consommé, jamais réappliqué deux fois");
}

// CAFET_ASSOMBRIE : une pièce taguée room.cafetRoom déclenche piège + trésor à la première visite,
// jamais aux visites suivantes (déjà consommé par enterRoom()/triggerCafetRoom()).
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'normal' && !r.visited);
    room.cafetRoom = true;
    gameState.floorMap.currentRoomId = room.id;
    gameState.inventory = [];

    const hpBefore = gameState.hp;
    enterRoom(room);
    assert(gameState.hp < hpBefore, "triggerCafetRoom() : inflige bien des dégâts de piège à la première visite");
    assert(room.visited === true, "enterRoom() : marque la pièce visitée comme n'importe quelle autre pièce");

    const hpAfterFirst = gameState.hp;
    enterRoom(room); // Deuxième visite : chemin connu normal, plus de piège
    assert(gameState.hp === hpAfterFirst, "enterRoom() : ne redéclenche jamais le piège de CAFET_ASSOMBRIE à une visite ultérieure");
    gameState.inventory = [];
}

// ===================================================================
// Tâche 5 — Validation supplémentaire : régénération=0 gérée dans le code de soin existant (pas un
// cas spécial dans l'anomalie elle-même), robustesse du tirage sur un grand nombre d'étages, et
// migration douce d'une sauvegarde ANTÉRIEURE À TOUTES les Tâches 1-4 (aucun des nouveaux champs).
// ===================================================================

// REPAS_DE_FAMILLE : régénération PV passive à zéro hors salle sécurisée — le "cas spécial" vit dans
// applyTimeElapsedRegen() (un simple garde-fou sur un flag lu depuis gameState.anomalyEffects), jamais
// une branche dédiée dans anomalies.js : l'anomalie ne fait que poser le drapeau.
{
    resetTransientState();
    gameState.hp = 10; // Largement sous le max : sans le drapeau, la régén tenterait de soigner
    gameState.anomalyEffects.regenOutsideSafehouseZero = true;
    applyTimeElapsedRegen(5); // 5h qui, normalement, régénéreraient des PV (voir HP_REGEN_TIERS)
    assert(gameState.hp === 10, "applyTimeElapsedRegen() (REPAS_DE_FAMILLE) : aucune régénération PV hors salle sécurisée");

    gameState.anomalyEffects.regenOutsideSafehouseZero = false;
    applyTimeElapsedRegen(5);
    assert(gameState.hp > 10, "applyTimeElapsedRegen() : la régénération normale reprend dès que le drapeau retombe");
}

// Robustesse : aucun tirage/application d'anomalie ne doit jamais planter ni boucler indéfiniment,
// sur une large plage d'étages (tuto, pool restreint, pool complet, deux-anomalies).
{
    for (let floor = 1; floor <= 40; floor++) {
        for (let i = 0; i < 10; i++) {
            const rolled = rollFloorAnomalies(floor);
            assert(Array.isArray(rolled) && rolled.length <= 2, `rollFloorAnomalies(${floor}) : renvoie toujours un tableau de 0 à 2 entrées`);
            const fx = computeAnomalyEffects(rolled);
            assert(fx && !Number.isNaN(fx.allDamageMult) && !Number.isNaN(fx.playerMaxHpMult),
                `computeAnomalyEffects() : jamais de NaN pour un tirage de l'étage ${floor}`);
        }
    }
}

// Migration douce : une sauvegarde brute antérieure à TOUTES les Tâches 1-4 (aucun des champs
// introduits par ce plan) doit rester chargeable normalement, avec des valeurs par défaut saines
// partout — jamais un écran bloqué ni un champ undefined.
{
    resetTransientState();
    const veryOldSave = {
        playerName: "Fossile",
        currentFloor: 4,
        level: 3,
        hp: 80,
        maxHp: 100,
        atk: 14,
        def: 6
        // Rien d'autre : ni lastSavedAt/floorStats (Tâche 2), ni fleesThisRun/necrologie (Tâche 3),
        // ni baseMaxHp/anomalyEffects/activeAnomalies/pactChoicePending (Tâche 4).
    };
    localStorage.setItem(saveKeyForName("Fossile"), JSON.stringify(veryOldSave));

    resetTransientState();
    const ok = restoreSaveForName("fossile");
    assert(ok === true, "restoreSaveForName() : charge une sauvegarde antérieure à toutes les Tâches 1-4");
    assert(gameState.floorStats && gameState.floorStats.mobsKilled === 0, "Migration douce : floorStats retombe sur des zéros (Tâche 2)");
    assert(gameState.fleesThisRun === 0 && Array.isArray(gameState.necrologie) && gameState.necrologie.length === 0,
        "Migration douce : fleesThisRun/necrologie retombent sur leurs défauts (Tâche 3)");
    assert(gameState.baseMaxHp === 100, "Migration douce : baseMaxHp migré depuis l'ancien maxHp (Tâche 4)");
    assert(gameState.anomalyEffects.allDamageMult === 1 && gameState.activeAnomalies.length === 0,
        "Migration douce : anomalyEffects/activeAnomalies neutres (Tâche 4)");
    assert(isActionBlocked() === false, "Migration douce : le joueur atterrit toujours sur l'écran d'exploration normal, jamais bloqué");
}

// ===================================================================
// Étages urbains (multiples de 3 — voir generateUrbanFloorMap()/travelToCity()/
// triggerUrbanBossEncounter() dans app.js, config.urbanFloors).
// ===================================================================

// generateUrbanFloorMap() : thème correct par étage, une seule ville gardienne (escalier hors étage
// final, Sortie TOUJOURS gardée à l'étage final), réseau entièrement connexe.
{
    [3, 6, 9, 12, 15].forEach(floor => {
        resetTransientState();
        gameState.currentFloor = floor;
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        assert(um !== null, `generateUrbanFloorMap() : urbanMap défini à l'étage ${floor}`);
        assert(um.isFinalFloor === false, `generateUrbanFloorMap() : étage ${floor} n'est pas l'étage final`);
        assert(um.theme === config.urbanFloors.themes[floor], `generateUrbanFloorMap() : thème correct à l'étage ${floor}`);
        assert(gameState.currentDistrict === um.theme, `generateUrbanFloorMap() : currentDistrict aligné sur le thème à l'étage ${floor}`);

        const cities = Object.values(um.citiesById);
        assert(cities.filter(c => c.isStairs).length === 1, `generateUrbanFloorMap() : exactement une ville d'escalier à l'étage ${floor}`);
        assert(cities.filter(c => c.isExit).length === 0, `generateUrbanFloorMap() : aucune Sortie sur un étage non final (${floor})`);

        const allReachable = cities.every(c => computeCityDistance(um.currentCityId, c.id) !== null);
        assert(allReachable, `generateUrbanFloorMap() : réseau entièrement connexe à l'étage ${floor}`);
    });

    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const finalMap = gameState.urbanMap;
    assert(finalMap.isFinalFloor === true, "generateUrbanFloorMap() : étage final correctement marqué");
    const finalCities = Object.values(finalMap.citiesById);
    assert(finalCities.filter(c => c.isExit).length === 1, "generateUrbanFloorMap() : exactement une Sortie à l'étage final");
    assert(finalCities.filter(c => c.isStairs).length === 0, "generateUrbanFloorMap() : aucun escalier classique à l'étage final");
    assert(finalCities.find(c => c.isExit).guarded === true, "generateUrbanFloorMap() : la Sortie est TOUJOURS gardée");
}

// Probabilité de garde de l'escalier croissante avec la profondeur (statistique, nombreuses générations).
{
    Object.entries(config.urbanFloors.stairsGuardChanceByFloor).forEach(([floorStr, expectedChance]) => {
        const floor = Number(floorStr);
        let guardedCount = 0;
        const trials = 300;
        for (let i = 0; i < trials; i++) {
            resetTransientState();
            gameState.currentFloor = floor;
            generateUrbanFloorMap();
            if (Object.values(gameState.urbanMap.citiesById).find(c => c.isStairs).guarded) guardedCount++;
        }
        const observed = (guardedCount / trials) * 100;
        assert(Math.abs(observed - expectedChance) < 15, `Probabilité de garde à l'étage ${floor} : attendu ~${expectedChance}%, observé ${observed.toFixed(1)}% sur ${trials} tirages`);
    });
}

// computeCityDistance() : plus court chemin pondéré, y compris via une route de bouclage plus rapide
// qu'un détour par l'arbre couvrant.
{
    resetTransientState();
    gameState.urbanMap = {
        theme: "Test", isFinalFloor: false, currentCityId: 'a',
        citiesById: {
            a: { id: 'a', roads: [{ to: 'b', distance: 5 }, { to: 'c', distance: 1 }] },
            b: { id: 'b', roads: [{ to: 'a', distance: 5 }] },
            c: { id: 'c', roads: [{ to: 'a', distance: 1 }, { to: 'b', distance: 1 }] }
        }
    };
    assert(computeCityDistance('a', 'a') === 0, "computeCityDistance() : distance nulle vers soi-même");
    assert(computeCityDistance('a', 'b') === 2, "computeCityDistance() : emprunte le détour par 'c' (1+1=2) plutôt que la route directe (5)");
    assert(computeCityDistance('a', 'c') === 1, "computeCityDistance() : route directe la plus courte");
}

// travelToCity() : bloqué vers une ville pas encore connue, consomme du temps + régénère (voir
// applyTimeElapsedRegen()) vers une ville connue atteignable.
{
    // Le voisin ciblé doit être une ville "normale" (ni escalier ni Sortie) : y arriver quand elle
    // n'est pas gardée déclenche triggerFloorTransition() (voir arriveAtCity()), qui affiche l'écran
    // d'escalier plutôt que d'avancer directement — sans lien avec l'assertion "consomme du temps"
    // ci-dessous, mais évité quand même pour rester sur le cas nominal testé ici. Il faut aussi une
    // ville pas encore connue pour le premier test (bloqué) — sur un petit réseau (6 villes), la ville
    // de départ peut parfois se retrouver reliée directement à TOUTES les autres (aucune ville
    // inconnue restante) : on retente simplement dans ce cas plutôt que de planter sur .find()...id.
    let um, unknownCityId, safeNeighborId;
    for (let attempt = 0; attempt < 20 && !safeNeighborId; attempt++) {
        resetTransientState();
        gameState.currentFloor = 3;
        generateUrbanFloorMap();
        um = gameState.urbanMap;
        const unknownCity = Object.values(um.citiesById).find(c => !c.known);
        if (!unknownCity) continue;
        unknownCityId = unknownCity.id;
        const safeRoad = um.citiesById[um.currentCityId].roads.find(r => !um.citiesById[r.to].isStairs && !um.citiesById[r.to].isExit);
        if (safeRoad) safeNeighborId = safeRoad.to;
    }
    assert(!!safeNeighborId, "travelToCity() test : une carte urbaine avec un voisin non-escalier ET une ville encore inconnue doit être trouvable");

    const timeBefore = gameState.timeLeft;
    travelToCity(unknownCityId);
    assert(gameState.timeLeft === timeBefore, "travelToCity() : aucun effet vers une ville pas encore connue");
    assert(um.currentCityId !== unknownCityId, "travelToCity() : n'arrive pas dans une ville inconnue");

    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade (jamais sous ambushBaseChance avec un tirage haut)
    gameState.hp = gameState.maxHp - 50;
    travelToCity(safeNeighborId);
    Math.random = originalRandom;
    assert(gameState.timeLeft < timeBefore, "travelToCity() : consomme du temps");
    assert(gameState.hp > gameState.maxHp - 50, "travelToCity() : la régénération passive s'applique au temps du trajet");
}

// Gardien urbain : combattre ouvre l'étage suivant ; repérer laisse la ville re-tentable plus tard
// (aucun registre séparé, contrairement au donjon classique — voir retreatFromUrbanBoss()).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const um = gameState.urbanMap;
    const stairsCity = Object.values(um.citiesById).find(c => c.isStairs);
    stairsCity.guarded = true; // Force la garde, indépendamment du tirage

    triggerUrbanBossEncounter(stairsCity);
    assert(gameState.bossChoicePending === true, "triggerUrbanBossEncounter() : ouvre le choix combattre/repérer");
    assert(stairsCity.bossInstance !== null, "triggerUrbanBossEncounter() : génère et met en cache le boss");

    retreatFromBoss(); // Dispatché vers retreatFromUrbanBoss()
    assert(gameState.bossChoicePending === false, "retreatFromBoss() (dispatch urbain) : referme le choix");
    assert(stairsCity.defeated === false, "retreatFromUrbanBoss() : la ville reste non vaincue, re-tentable plus tard");

    triggerUrbanBossEncounter(stairsCity);
    fightBossNow(); // Dispatché vers fightUrbanBossNow()
    assert(gameState.inCombat === true, "fightBossNow() (dispatch urbain) : lance bien le combat");
    assert(gameState.pendingUrbanAdvanceAfterCombat === 'nextFloor', "fightUrbanBossNow() : victoire ouvrira l'étage suivant (pas la Sortie)");

    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.currentFloor === floorBefore, "winCombat() : n'avance pas encore l'étage, l'écran d'escalier s'affiche d'abord (voir triggerFloorTransition())");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === false, "winCombat() : affiche bien l'écran d'escalier");
    assert(stairsCity.defeated === true, "winCombat() : marque déjà la ville gardienne vaincue à ce stade");

    continueFromFloorTransition();
    assert(gameState.currentFloor === floorBefore + 1, "continueFromFloorTransition() : fait bien passer à l'étage suivant");
    assert(ui.floorTransitionOverlay.classList.contains('hidden') === true, "continueFromFloorTransition() : referme l'écran d'escalier");
}

// Gardien de la Sortie (étage final) : la victoire déclenche winGame(), jamais nextFloor().
{
    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exitCity = Object.values(gameState.urbanMap.citiesById).find(c => c.isExit);

    triggerUrbanBossEncounter(exitCity);
    fightBossNow();
    assert(gameState.pendingUrbanAdvanceAfterCombat === 'win', "fightUrbanBossNow() : la Sortie de l'étage final déclenchera la victoire");

    const floorBefore = gameState.currentFloor;
    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.hasWon === true, "winCombat() : défaite du gardien de la Sortie déclenche winGame()");
    assert(gameState.currentFloor === floorBefore, "winCombat() : la victoire n'avance jamais vers un étage au-delà de l'étage final");
}

// advanceToNextFloor() : bascule correctement entre étage classique et étage urbain selon le
// multiple de 3, jamais les deux structures définies en même temps.
{
    resetTransientState();
    gameState.currentFloor = 1; // Le prochain (2) reste classique
    advanceToNextFloor();
    assert(gameState.floorMap !== null && gameState.urbanMap === null, "advanceToNextFloor() : étage 2 reste un donjon classique");

    resetTransientState();
    gameState.currentFloor = 2; // Le prochain (3) est urbain
    advanceToNextFloor();
    assert(gameState.urbanMap !== null && gameState.floorMap === null, "advanceToNextFloor() : étage 3 devient un étage urbain");
}

// UI : "Lieux connus"/overlay "Carte Urbaine" mutuellement exclusifs, invite "Touchez la carte"
// masquée sur un étage urbain, et l'overlay se masque bien dès qu'une "situation" est en cours
// (combat/boss/furtivité/compagnon) pour laisser la carte redevenir visible (voir updateUI() dans
// app.js).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === false, "updateUI() : overlay Carte Urbaine visible sur un étage urbain hors situation");
    assert(ui.knownLocationsSection.classList.contains('hidden') === true, "updateUI() : panneau Lieux connus masqué sur un étage urbain");
    assert(ui.advanceHint.classList.contains('hidden') === true, "updateUI() : invite d'exploration masquée sur un étage urbain");

    gameState.inCombat = true;
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué en combat (situation)");
    gameState.inCombat = false;

    gameState.bossChoicePending = true;
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué pendant un choix de boss (situation)");
    gameState.bossChoicePending = false;

    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === false, "updateUI() : overlay Carte Urbaine réapparaît une fois la situation résolue");

    resetTransientState();
    updateUI();
    assert(ui.urbanTravelOverlay.classList.contains('hidden') === true, "updateUI() : overlay Carte Urbaine masqué sur un étage classique");
    assert(ui.knownLocationsSection.classList.contains('hidden') === false, "updateUI() : panneau Lieux connus visible sur un étage classique");
}

// devJumpToUrbanFloor() (menu DEV) : saute directement à l'étage 3 (urbain), quel que soit l'état
// bloquant en cours, sans jamais laisser de combat/choix fantôme derrière lui.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye DEV", hp: 10, maxHp: 10, atk: 1, def: 1, xpReward: 1, status: {} };
    devJumpToUrbanFloor();
    assert(gameState.currentFloor === 3, "devJumpToUrbanFloor() : atterrit bien sur l'étage 3");
    assert(gameState.urbanMap !== null && gameState.floorMap === null, "devJumpToUrbanFloor() : génère bien un étage urbain");
    assert(gameState.inCombat === false && gameState.currentEnemy === null, "devJumpToUrbanFloor() : ne laisse aucun combat en cours derrière lui");
    assert(gameState.bossChoicePending === false, "devJumpToUrbanFloor() : ne laisse aucun choix de boss en attente");
}

// computeGraphLayout() (générique, réutilisable — voir app.js) : toutes les positions retournées
// restent dans le cadre normalisé [0,1], un graphe sans arêtes reste malgré tout disposé (pas de
// crash), et repartir des positions déjà calculées ne les fait pas dériver loin (stabilité d'un
// rendu à l'autre, condition nécessaire pour ne pas "sauter" visuellement).
{
    const nodeIds = ['a', 'b', 'c', 'd'];
    const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'a' }];
    const positions = computeGraphLayout(nodeIds, edges, {});
    nodeIds.forEach(id => {
        assert(positions[id] && positions[id].x >= 0 && positions[id].x <= 1 && positions[id].y >= 0 && positions[id].y <= 1,
            `computeGraphLayout() : la position de '${id}' reste dans le cadre normalisé [0,1]`);
    });

    const isolated = computeGraphLayout(['solo'], [], {});
    assert(!!isolated.solo, "computeGraphLayout() : un graphe sans arêtes dispose quand même son unique nœud");

    const stabilized = computeGraphLayout(nodeIds, edges, positions);
    nodeIds.forEach(id => {
        const dx = stabilized[id].x - positions[id].x;
        const dy = stabilized[id].y - positions[id].y;
        assert(Math.sqrt(dx * dx + dy * dy) < 0.05,
            `computeGraphLayout() : repartir d'une disposition déjà stable ne fait pas dériver '${id}'`);
    });

    const withNewNode = computeGraphLayout([...nodeIds, 'e'], [...edges, { from: 'a', to: 'e' }], positions);
    nodeIds.forEach(id => {
        const dx = withNewNode[id].x - positions[id].x;
        const dy = withNewNode[id].y - positions[id].y;
        assert(Math.sqrt(dx * dx + dy * dy) < 0.35,
            `computeGraphLayout() : l'arrivée d'un nouveau nœud ('e') ne bouscule pas trop les nœuds déjà en place ('${id}')`);
    });
    assert(!!withNewNode.e, "computeGraphLayout() : le nouveau nœud reçoit bien une position");
}

// buildUrbanMapGraphData() : adaptateur urbain -> format générique nœuds/arêtes, et
// updateUrbanMapUI() : la mini carte graphique (SVG) est bien peuplée, avec un nœud par ville
// connue et un clic sur un nœud (autre que la ville courante) déclenchant le voyage.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const um = gameState.urbanMap;
    const stairsCity = Object.values(um.citiesById).find(c => c.isStairs);
    stairsCity.guarded = true; // Force la garde pour vérifier l'icône/variant 'guarded'
    stairsCity.known = true; // Garantit sa présence dans le graphe pour cette vérification ciblée

    const { nodes, edges, positions } = buildUrbanMapGraphData(um);
    const knownCount = Object.values(um.citiesById).filter(c => c.known).length;
    assert(nodes.length === knownCount, "buildUrbanMapGraphData() : un nœud par ville connue, ni plus ni moins");
    assert(edges.every(e => nodes.some(n => n.id === e.from) && nodes.some(n => n.id === e.to)),
        "buildUrbanMapGraphData() : aucune arête ne pointe vers une ville pas encore connue");
    assert(Object.keys(positions).length === nodes.length, "buildUrbanMapGraphData() : une position (fixe) par nœud connu");
    const stairsNode = nodes.find(n => n.id === stairsCity.id);
    assert(stairsNode.variant === 'guarded' && stairsNode.icon === '🏙️' && stairsNode.goalIcon === '👑',
        "buildUrbanMapGraphData() : une ville-escalier gardée garde une icône normale + un goalIcon 'guarded' à part");

    updateUrbanMapUI();
    assert(ui.urbanMapSvg._children.length === 3, "updateUrbanMapUI() : le SVG contient un fond, un groupe d'arêtes et un groupe de nœuds");
    const nodesGroup = ui.urbanMapSvg._children[2];
    // +1 : le marqueur de gardien (goalIcon) de la ville-escalier s'ajoute au groupe des nœuds, en
    // plus de son propre nœud — voir renderGraphMiniMap().
    assert(nodesGroup._children.length === nodes.length + 1, "updateUrbanMapUI() : un élément SVG par nœud du graphe, plus le marqueur de gardien");

    // Clic sur un nœud autre que la ville courante : doit déclencher travelToCity() (même mécanisme
    // que la liste précédente, juste porté par le graphe désormais). La Carte Urbaine est toujours en
    // mode pan (updateUrbanMapUI() fournit toujours onCameraChange) : le tap est résolu par
    // pointerdown/pointerup à la position MONDE du nœud (voir renderGraphMiniMap()), jamais par un
    // `click` natif (aucun listener de ce type n'est attaché aux nœuds dans ce mode).
    const otherNode = nodes.find(n => n.id !== um.currentCityId);
    const cityBefore = um.currentCityId;
    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade pour un trajet direct et prévisible
    const [vbX, vbY] = ui.urbanMapSvg.getAttribute('viewBox').split(' ').map(Number);
    const targetWorld = positions[otherNode.id];
    // scale 1:1 et rect.left/top = 0 (test_stub.js n'expose pas getBoundingClientRect(), voir son
    // fallback dans renderGraphMiniMap()) : clientX/Y = position monde - origine du viewBox.
    const clientX = targetWorld.x - vbX, clientY = targetWorld.y - vbY;
    ui.urbanMapSvg.dispatch('pointerdown', { clientX, clientY, pointerId: 1 });
    ui.urbanMapSvg.dispatch('pointerup', { clientX, clientY, pointerId: 1 });
    Math.random = originalRandom;
    // Troisième issue possible depuis PR "Repaires sur les routes" : si la route directe est un
    // repaire non nettoyé, le clic ouvre le choix plonger/poursuivre plutôt que de bouger ou combattre.
    assert(um.currentCityId !== cityBefore || gameState.inCombat || gameState.lairChoicePending,
        "updateUrbanMapUI() : cliquer un nœud du graphe déplace bien le joueur (ou déclenche une embuscade / un choix de repaire)");
}

// ===================================================================
// Équilibrage (issues validées "Vibe") : kiting (ruée + coût en temps), courbe XP, métrique d'élite,
// furtivité, magie, items blagues. Voir CLAUDE.md pour le détail des correctifs.
// ===================================================================

// Ruée (1B) : un mob de MÊLÉE qui gagne un jet de rapprochement avec une marge >= rushMarginThreshold
// comble l'écart d'un coup, même depuis un écart que le delta normal (borné par dieSides-1) ne
// pourrait jamais combler en une seule manche — sans quoi un joueur y parvenant devient
// mathématiquement increvable. Un mob à DISTANCE, lui, n'en profite jamais.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse Enragé", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 7; // Sous-maximal : un delta normal (max 5 avec dieSides=6) ne peut PAS combler seul
    ui.btnFlee.disabled = false;
    let originalRandom = Math.random;
    let seq = [0, 0.999]; // playerRoll bas (1), mobRoll haut (6) -> marge 5, largement au-dessus du seuil (3)
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];
    const timeBefore = gameState.timeLeft;
    resolveEnemyReaction();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "Ruée (resolveEnemyReaction) : comble tout l'écart d'un coup malgré un delta normal insuffisant");
    assert(ui.btnFlee.disabled === true, "Ruée (resolveEnemyReaction) : le mob frappe immédiatement (riposte synchrone)");
    assert(gameState.timeLeft < timeBefore, "Ruée : la manche contestée consomme quand même du temps (timeCostPerRound)");

    // attemptRetreat() avantage le joueur (deux dés, le meilleur gardé) : il faut donc deux tirages
    // bas pour le joueur avant le tirage haut du mob, pour obtenir la même marge de 5.
    const retreatSeq = [0, 0, 0.999];
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse Enragé 2", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 7;
    ui.btnFlee.disabled = false;
    originalRandom = Math.random;
    idx = 0;
    Math.random = () => retreatSeq[(idx++) % retreatSeq.length];
    attemptRetreat();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "Ruée (attemptRetreat) : le mob vous rattrape brutalement malgré la tentative de fuite");
    assert(ui.btnFlee.disabled === true, "Ruée (attemptRetreat) : riposte immédiate");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Tireur d'Élite", hp: 9999, maxHp: 9999, atk: 999, def: 0, status: {}, ranged: true };
    gameState.combatDistance = 7;
    originalRandom = Math.random;
    idx = 0;
    Math.random = () => retreatSeq[(idx++) % retreatSeq.length];
    attemptRetreat();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 2, "Pas de ruée pour un mob à distance : l'écart évolue selon le delta normal (7-5=2), jamais forcé à 0");
}

// Coût en temps des manches de distance CONTESTÉES (1A) : attemptSprint() et attemptRetreat()
// déduisent chacun config.rangedCombat.timeCostPerRound, jamais les tours d'attaque standards.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Distance", hp: 9999, maxHp: 9999, atk: 1, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 4;
    const timeBefore1 = gameState.timeLeft;
    attemptSprint();
    assert(gameState.timeLeft < timeBefore1, "attemptSprint() : consomme le coût d'une manche de distance");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Distance 2", hp: 9999, maxHp: 9999, atk: 1, def: 0, status: {}, ranged: false };
    gameState.combatDistance = 4;
    const timeBefore2 = gameState.timeLeft;
    attemptRetreat();
    assert(gameState.timeLeft < timeBefore2, "attemptRetreat() : consomme le coût d'une manche de distance");
}

// gainXp() (2) : courbe de niveau ×1.25 (au lieu de ×1.4), gains ATQ/DEF croissants avec le niveau
// ATTEINT (2+floor(niveau/4) / 1+floor(niveau/5)), PV max inchangé (15).
{
    resetTransientState();
    gameState.xp = 0;
    gameState.xpToNextLevel = 50;
    const hpMaxBefore = gameState.maxHp;
    gainXp(50); // Passe niveau 1 -> 2 (atkGain/defGain encore au plancher à ce niveau)
    assert(gameState.level === 2, "gainXp() : passe bien au niveau 2");
    assert(gameState.xpToNextLevel === 63, "gainXp() : xpToNextLevel suit désormais ×1.25 (round(50*1.25)=63)");
    assert(gameState.maxHp === hpMaxBefore + 15, "gainXp() : gain PV max inchangé (15)");

    resetTransientState();
    gameState.level = 3; // Le prochain niveau (4) doit donner atkGain=2+floor(4/4)=3 (première hausse)
    gameState.xp = 0;
    gameState.xpToNextLevel = 10;
    const atkBefore = gameState.atk;
    gainXp(10);
    assert(gameState.level === 4, "gainXp() : passe au niveau 4");
    assert(gameState.atk === atkBefore + 3, "gainXp() : gain ATQ croissant à partir du niveau 4 (2+floor(4/4)=3)");

    resetTransientState();
    gameState.level = 4; // Le prochain niveau (5) doit donner defGain=1+floor(5/5)=2 (première hausse)
    gameState.xp = 0;
    gameState.xpToNextLevel = 10;
    const defBefore = gameState.def;
    gainXp(10);
    assert(gameState.level === 5, "gainXp() : passe au niveau 5");
    assert(gameState.def === defBefore + 2, "gainXp() : gain DEF croissant à partir du niveau 5 (1+floor(5/5)=2)");
}

// computeThreatMultiplier() (4, generator.js) : la DEF entre désormais dans le calcul avec un poids
// modéré (0.5) — un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
// ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule.
{
    // "Syndiqué" (atk x0.9, def x1.5, hp x1.2) sur un mob de base 10/10/10 : preModifierPower=100
    const withDef = computeThreatMultiplier(9, 12, 15, 100, 10);
    assert(Math.abs(withDef - 1.35) < 0.001, "computeThreatMultiplier() : pondère bien la DEF (attendu 1.35, voir 'Syndiqué')");

    // DEF inchangée (defFactor=1) : doit redonner exactement l'ancienne formule (ATQxPV/preModifierPower)
    const noDefChange = computeThreatMultiplier(15, 15, 10, 100, 10);
    assert(Math.abs(noDefChange - 2.25) < 0.001, "computeThreatMultiplier() : DEF inchangée -> formule ATQ×PV pure (2.25)");

    // Garde-fous : aucune division par zéro
    assert(computeThreatMultiplier(10, 10, 10, 0, 10) === 1, "computeThreatMultiplier() : preModifierPower nul -> 1 (pas de crash)");
    assert(Number.isFinite(computeThreatMultiplier(10, 10, 10, 100, 0)), "computeThreatMultiplier() : preModifierDef nul -> pas de division par zéro");
}

// Furtivité (5) : plafonds abaissés (détection 60%, évitement 70%), XP réduite (5), et un mob qui
// repère le joueur au dernier moment reste "alerted" pour tout le combat : attemptFlee() y est bloqué.
{
    resetTransientState();
    gameState.skills.stealth.level = 20; // Niveau très élevé : doit quand même plafonner
    assert(getStealthChance() === 60, "getStealthChance() : plafonne désormais à 60% (au lieu de 75%)");

    resetTransientState();
    gameState.inCombat = true;
    gameState.pendingStealthEncounter = { name: "Ombre", hp: 20, maxHp: 20, atk: 5, def: 2, xpReward: 10, status: {} };
    gameState.stealthChoicePending = true;
    gameState.skills.stealth.level = 20; // Plafonne l'évitement à 70% quel que soit le niveau
    const originalRandom = Math.random;
    Math.random = () => 0.75; // > 70% (nouveau plafond) mais < 85% (ancien) : doit désormais ÉCHOUER
    attemptStealthEvasion();
    Math.random = originalRandom;
    assert(gameState.inCombat === true && gameState.currentEnemy !== null, "attemptStealthEvasion() : plafonne désormais à 70% (au lieu de 85%), échoue ici à 75%");
    assert(gameState.currentEnemy.alerted === true, "attemptStealthEvasion() (échec) : le mob reste 'alerted' pour tout le combat");

    attemptFlee();
    assert(gameState.inCombat === true, "attemptFlee() : bloqué face à un mob 'alerted'");
    updateUI();
    assert(ui.btnFlee.disabled === true, "updateUI() : bouton Fuir grisé face à un mob 'alerted'");

    // Évitement réussi : XP réduite (8 -> 5)
    resetTransientState();
    gameState.stealthChoicePending = true;
    gameState.pendingStealthEncounter = { name: "Ombre 2", hp: 20, maxHp: 20, atk: 5, def: 2, xpReward: 10, status: {} };
    gameState.skills.stealth.xp = 0;
    const xpBefore = gameState.skills.stealth.xp;
    Math.random = () => 0; // Toujours sous le plafond : évitement garanti
    attemptStealthEvasion();
    Math.random = originalRandom;
    assert(gameState.skills.stealth.xp - xpBefore === 5, "attemptStealthEvasion() (succès) : XP de Furtivité réduite à 5 (au lieu de 8)");
}

// attackMagic() (6) : plancher de backfire relevé (8%), multiplicateur de base abaissé (1.25),
// defReduction non nul (0.15) — les sorts ignorent un peu de DEF sans l'ignorer entièrement.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.skills.magic.level = 50; // Niveau très élevé : le backfire doit quand même plancher à 8%
    gameState.currentEnemy = { name: "Cobaye Magie", hp: 9999, maxHp: 9999, atk: 1, def: 50, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance;
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 };
    gameState.mana = 100;
    const originalRandom = Math.random;
    Math.random = () => 0.075; // 7.5% : sous l'ancien plancher (3%) mais sous le nouveau (8%) -> backfire
    attackMagic();
    Math.random = originalRandom;
    assert(gameState.currentEnemy.hp === 9999, "attackMagic() : plancher de backfire relevé à 8% (un tirage à 7.5% échoue désormais)");
}

// Items blagues (7) : jokeItem exclu du loot normal (generateItem()), et poids de rareté bas de
// fourchette redistribués (moins de Commun, plus de Rare/Épique/Légendaire).
{
    for (let i = 0; i < 150; i++) {
        const item = generateItem(0); // powerScore=0 : bas de fourchette, le plus favorable aux objets faibles
        assert(item.jokeItem !== true, `generateItem() : ne tire jamais un objet 'jokeItem' (obtenu: ${item.name})`);
    }
    const weights = getRarityWeights(0);
    assert(weights.commun === 60, "getRarityWeights() : poids Commun bas de fourchette réduit à 60");
    assert(weights.rare === 30, "getRarityWeights() : poids Rare bas de fourchette relevé à 30");
    assert(Math.abs(weights.epique - 5.5) < 0.001, "getRarityWeights() : poids Épique bas de fourchette relevé à 5.5");
    assert(Math.abs(weights.legendaire - 1.5) < 0.001, "getRarityWeights() : poids Légendaire bas de fourchette relevé à 1.5");

    const rideau = baseItems.armors.find(i => i.name === "Rideau de Douche Camouflage");
    assert(rideau.baseValue === 8, "items.js : Rideau de Douche Camouflage n'est plus le pire objet ET le plus cher (baseValue 50 -> 8)");
}

// ===================================================================
// Carte Urbaine : grille logique + diagonales (remplace le gabarit de points fixes), déclutter
// anti-chevauchement, caméra MONDE pannable (glissement + bouton Recentrer + clamping). Voir
// CLAUDE.md pour le détail.
// ===================================================================

// generateConnectedCityGrid() : région connexe par construction — cellules toutes distinctes,
// atteignables les unes des autres par adjacence 8-directions (vérifié ici par un simple parcours en
// largeur indépendant du code de génération, pour ne jamais suivre la même logique que ce qu'il teste).
{
    for (let n = 1; n <= 10; n++) {
        const cells = generateConnectedCityGrid(n);
        assert(cells.length === n, `generateConnectedCityGrid(${n}) : exactement ${n} cellules`);
        const keys = cells.map(c => `${c.gx},${c.gy}`);
        assert(new Set(keys).size === n, `generateConnectedCityGrid(${n}) : jamais deux cellules identiques`);

        // Parcours en largeur "maison" (indépendant de computeGridAdjacencyPairs()) pour vérifier la
        // connexité par adjacence 8-directions parmi les cellules choisies.
        const keySet = new Set(keys);
        const visited = new Set([keys[0]]);
        const queue = [cells[0]];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const k = `${cur.gx + dx},${cur.gy + dy}`;
                    if (keySet.has(k) && !visited.has(k)) {
                        visited.add(k);
                        queue.push({ gx: cur.gx + dx, gy: cur.gy + dy });
                    }
                }
            }
        }
        assert(visited.size === n, `generateConnectedCityGrid(${n}) : région entièrement connexe par adjacence 8-directions`);
    }
}

// computeGridAdjacencyPairs() : uniquement les paires de cellules à distance ≤ 1 sur les deux axes
// (adjacence 8-directions), jamais de connexion longue distance façon étoile.
{
    const cells = [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, { gx: 1, gy: 1 }, { gx: 5, gy: 5 }];
    const pairs = computeGridAdjacencyPairs(cells);
    const pairKeys = new Set(pairs.map(([i, j]) => [i, j].sort().join('|')));
    assert(pairKeys.has('0|1'), "computeGridAdjacencyPairs() : (0,0)-(1,0) adjacentes (orthogonal)");
    assert(pairKeys.has('1|2'), "computeGridAdjacencyPairs() : (1,0)-(1,1) adjacentes (orthogonal)");
    assert(pairKeys.has('0|2'), "computeGridAdjacencyPairs() : (0,0)-(1,1) adjacentes (diagonale)");
    assert(!pairKeys.has('0|3') && !pairKeys.has('1|3') && !pairKeys.has('2|3'),
        "computeGridAdjacencyPairs() : la cellule isolée (5,5) n'est reliée à AUCUNE autre (pas de connexion longue distance)");
}

// computeDeclutterLayout() : déterministe (aucun Math.random — même entrée -> même sortie), écarte
// deux points trop proches d'au moins minDist, ne bouge JAMAIS un point déjà assez isolé, et plafonne
// le déplacement total de chaque point à maxShift.
{
    const base = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, c: { x: 500, y: 500 } };
    const ids = ['a', 'b', 'c'];
    const result1 = computeDeclutterLayout(base, ids, { minDist: 48, iterations: 50, maxShift: 40 });
    const result2 = computeDeclutterLayout(base, ids, { minDist: 48, iterations: 50, maxShift: 40 });
    ids.forEach(id => {
        assert(result1[id].x === result2[id].x && result1[id].y === result2[id].y,
            `computeDeclutterLayout() : déterministe pour '${id}' (deux appels identiques -> même résultat)`);
    });

    const distAB = Math.hypot(result1.a.x - result1.b.x, result1.a.y - result1.b.y);
    assert(distAB >= 48 - 1e-6, "computeDeclutterLayout() : deux points trop proches sont écartés d'au moins minDist");

    assert(result1.c.x === base.c.x && result1.c.y === base.c.y,
        "computeDeclutterLayout() : un point déjà isolé (loin de tout) ne bouge pas du tout");

    const shiftA = Math.hypot(result1.a.x - base.a.x, result1.a.y - base.a.y);
    const shiftB = Math.hypot(result1.b.x - base.b.x, result1.b.y - base.b.y);
    assert(shiftA <= 40 + 1e-6 && shiftB <= 40 + 1e-6, "computeDeclutterLayout() : déplacement total plafonné à maxShift");
}

// generateUrbanFloorMap() : grille logique (gx/gy, gameplay) et position d'affichage (x/y, voir
// computeDeclutterLayout()) figées à la génération, jamais recalculées ensuite — chaque route ne
// relie que des villes adjacentes sur la grille (plus de connexion longue distance).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const cities = Object.values(gameState.urbanMap.citiesById);

    const seenCells = new Set(cities.map(c => `${c.gx},${c.gy}`));
    assert(seenCells.size === cities.length, "generateUrbanFloorMap() : jamais deux villes sur la même cellule de grille");
    cities.forEach(city => {
        // minDist (50) du déclutter reste sous l'espacement minimal garanti par la grille (70, voir
        // URBAN_GRID_CELL) : sur cette génération, x/y doivent donc coïncider exactement avec gx/gy
        // mis à l'échelle (déclutter no-op ici, voir son propre test ci-dessus pour le cas où il agit).
        assert(city.x === city.gx * URBAN_GRID_CELL && city.y === city.gy * URBAN_GRID_CELL,
            `generateUrbanFloorMap() : position d'affichage de '${city.id}' alignée sur sa cellule de grille`);
    });

    cities.forEach(city => {
        city.roads.forEach(road => {
            const other = gameState.urbanMap.citiesById[road.to];
            assert(Math.abs(city.gx - other.gx) <= 1 && Math.abs(city.gy - other.gy) <= 1,
                `generateUrbanFloorMap() : la route '${city.id}'->'${road.to}' relie bien deux cellules adjacentes`);
        });
    });

    // Les positions ne bougent jamais après coup, même après plusieurs rafraîchissements de l'UI
    const before = cities.map(c => ({ id: c.id, x: c.x, y: c.y }));
    updateUrbanMapUI();
    updateUrbanMapUI();
    const after = Object.values(gameState.urbanMap.citiesById);
    before.forEach(b => {
        const a = after.find(c => c.id === b.id);
        assert(a.x === b.x && a.y === b.y, `updateUrbanMapUI() : la position de '${b.id}' reste fixe d'un rendu à l'autre`);
    });
}

// clampCameraToBounds() : écrête un centre de caméra aux bornes du monde (fenêtre affichée centrée
// dessus) ; si le monde est plus petit que la fenêtre, centre le monde plutôt que d'écrêter sur un
// intervalle vide.
{
    const view = { w: 200, h: 240 };
    const bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };

    const inside = clampCameraToBounds({ x: 50, y: 50 }, view, bounds);
    assert(inside.x === 50 && inside.y === 50, "clampCameraToBounds() : un centre déjà dans les bornes n'est pas modifié");

    const clamped = clampCameraToBounds({ x: 5000, y: 5000 }, view, bounds);
    assert(clamped.x === 1000 - view.w / 2 && clamped.y === 1000 - view.h / 2,
        "clampCameraToBounds() : écrêté au bord du monde moins la moitié de la fenêtre");

    const tinyBounds = { minX: -10, maxX: 30, minY: -40, maxY: 0 };
    const fallback = clampCameraToBounds({ x: 9999, y: 9999 }, view, tinyBounds);
    assert(fallback.x === 10 && fallback.y === -20,
        "clampCameraToBounds() : monde plus petit que la fenêtre -> centré sur le monde (fallback)");
}

// computeDefaultWorldBounds() : boîte englobante de toutes les positions fournies, augmentée d'une
// marge fixe de chaque côté.
{
    const bounds = computeDefaultWorldBounds({ a: { x: 0, y: 10 }, b: { x: 20, y: -5 } }, 15);
    assert(bounds.minX === -15 && bounds.maxX === 35 && bounds.minY === -20 && bounds.maxY === 25,
        "computeDefaultWorldBounds() : boîte englobante + marge sur les 4 côtés");
}

// renderGraphMiniMap() : caméra MONDE — `camera` explicite prend le pas sur le centrage automatique
// sur `currentId`, et `worldBounds` écrête la vue (voir clampCameraToBounds(), déjà testé seul).
{
    const nodes = [{ id: 'a', label: 'A', icon: '🏙️' }];
    const edges = [];
    const positions = { a: { x: 0, y: 0 } };
    const svgEl = document.createElement('svg');
    // worldBounds explicite et généreux dans ces deux premiers cas : évite tout écrêtage, pour
    // isoler le comportement testé (centrage par défaut / camera explicite) de clampCameraToBounds()
    // (déjà testé seul plus haut).
    const wideBounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 }, worldBounds: wideBounds });
    assert(svgEl.getAttribute('viewBox') === "-100 -120 200 240",
        "renderGraphMiniMap() : sans camera explicite, centré sur currentId");

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 }, worldBounds: wideBounds, camera: { x: 10, y: 20 } });
    assert(svgEl.getAttribute('viewBox') === "-90 -100 200 240",
        "renderGraphMiniMap() : camera explicite prend le pas sur currentId");

    renderGraphMiniMap(svgEl, {
        nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 },
        camera: { x: 5000, y: 5000 }, worldBounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }
    });
    assert(svgEl.getAttribute('viewBox') === "800 760 200 240",
        "renderGraphMiniMap() : worldBounds écrête bien la vue (via clampCameraToBounds())");
}

// renderGraphMiniMap() : le fond décoratif (background.rects/lines) se dessine en premier calque, et
// le marqueur de gardien (goalIcon) porte SA PROPRE couleur (variant), jamais reportée sur le
// cercle de la ville elle-même (qui reste "normale"). Coordonnées MONDE (plus de 0..1 normalisé).
{
    const nodes = [
        { id: 'start', label: 'Départ', icon: '🏙️', variant: 'default' },
        { id: 'boss', label: 'Gardien', icon: '🏙️', variant: 'guarded', goalIcon: '👑' },
    ];
    const edges = [{ from: 'start', to: 'boss', distance: 2 }];
    const positions = { start: { x: 0, y: 0 }, boss: { x: 70, y: 0 } };
    const background = { rects: [{ x: -10, y: -10, w: 5, h: 5 }], lines: [{ x1: -50, y1: 0, x2: 50, y2: 0 }] };
    const svgEl = document.createElement('svg');

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'start', background });
    assert(svgEl._children.length === 3, "renderGraphMiniMap() : fond + arêtes + nœuds, dans cet ordre");
    assert(svgEl._children[0]._children.length === 2, "renderGraphMiniMap() : le calque de fond contient bien le rect ET la ligne fournis");

    const nodesGroup = svgEl._children[2];
    const bossNodeG = nodesGroup._children.find(c => c.getAttribute('data-node-id') === 'boss');
    const bossCircle = bossNodeG._children.find(c => c.getAttribute && c.getAttribute('r'));
    assert(bossCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.default.stroke,
        "renderGraphMiniMap() : le cercle de la ville gardée reste de couleur par défaut");
    const markerG = nodesGroup._children.find(c => !c.getAttribute('data-node-id')); // Seul le marqueur n'a pas de data-node-id
    const markerCircle = markerG && markerG._children.find(c => c.getAttribute && c.getAttribute('r') === '8');
    assert(!!markerCircle && markerCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.guarded.stroke,
        "renderGraphMiniMap() : le marqueur porte bien la couleur 'guarded'");
}

// renderGraphMiniMap() : node.badge (marchand/professeur...) reste accolé au cercle du nœud lui-même
// (pas un enfant séparé du groupe de nœuds, contrairement à goalIcon), et edges[].marker (ex :
// repaire) se dessine au milieu de l'arête elle-même, dans le groupe des arêtes.
{
    const nodes = [
        { id: 'a', label: 'A', icon: '🏙️', badge: '🛒' },
        { id: 'b', label: 'B', icon: '🏙️' },
    ];
    const edges = [{ from: 'a', to: 'b', marker: { icon: '💀', variant: 'guarded' } }];
    const positions = { a: { x: 0, y: 0 }, b: { x: 70, y: 0 } };
    const svgEl = document.createElement('svg');

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a' });
    const edgesGroup = svgEl._children[0]; // Pas de background ici : arêtes en premier
    const nodesGroup = svgEl._children[1];

    const nodeAG = nodesGroup._children.find(c => c.getAttribute('data-node-id') === 'a');
    const badgeGroup = nodeAG._children.find(c => c._children && c._children.some(child => child.textContent === '🛒'));
    assert(!!badgeGroup, "renderGraphMiniMap() : node.badge rendu à l'intérieur du groupe du nœud lui-même");
    assert(nodesGroup._children.length === 2, "renderGraphMiniMap() : le badge n'ajoute PAS de nœud séparé au groupe (contrairement à goalIcon)");

    const edgeMarkerG = edgesGroup._children.find(c => c._children && c._children.some(child => child.getAttribute && child.getAttribute('r') === '8'));
    const edgeMarkerCircle = edgeMarkerG && edgeMarkerG._children.find(c => c.getAttribute('r') === '8');
    assert(!!edgeMarkerCircle && edgeMarkerCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.guarded.stroke,
        "renderGraphMiniMap() : edges[].marker rendu dans le groupe des arêtes, avec sa couleur variant");
}

// renderGraphMiniMap() : glissement (pan) — un mouvement sous le seuil (5px) reste un simple clic ;
// au-delà, le viewBox se déplace EN DIRECT (mutation d'attribut, jamais un re-rendu complet) et
// onCameraChange n'est appelé qu'UNE fois, à la fin du glissement (jamais pendant) ; le clic natif qui
// suit un vrai glissement est avalé (jamais de navigation accidentelle en relâchant sur un nœud).
// Échelle écran<->monde : test_stub.js n'expose pas getBoundingClientRect(), donc le fallback interne
// (voir renderGraphMiniMap()) retombe sur une échelle 1:1 — suffisant pour vérifier la LOGIQUE
// (seuil, clamping, callback, suppression du clic), l'échelle réelle est vérifiée en navigateur.
{
    const nodes = [{ id: 'a', label: 'A', icon: '🏙️' }, { id: 'b', label: 'B', icon: '🏙️' }];
    const edges = [];
    const positions = { a: { x: 0, y: 0 }, b: { x: 70, y: 0 } };
    const svgEl = document.createElement('svg');
    let lastCamera = null, clickedId = null;

    renderGraphMiniMap(svgEl, {
        nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 },
        onNodeClick: (id) => { clickedId = id; },
        onCameraChange: (cam) => { lastCamera = cam; },
    });

    // Mouvement sous le seuil : pas de pan déclenché
    svgEl.dispatch('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 });
    svgEl.dispatch('pointermove', { clientX: 102, clientY: 101, pointerId: 1 });
    svgEl.dispatch('pointerup', { clientX: 102, clientY: 101, pointerId: 1 });
    assert(lastCamera === null, "renderGraphMiniMap() (pan) : un mouvement sous le seuil (5px) ne déclenche aucun pan");

    // Glissement franc : le viewBox bouge EN DIRECT pendant pointermove...
    svgEl.dispatch('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 });
    svgEl.dispatch('pointermove', { clientX: 60, clientY: 100, pointerId: 1 }); // -40px en x, échelle 1:1
    assert(svgEl.getAttribute('viewBox') === "-60 -120 200 240", "renderGraphMiniMap() (pan) : viewBox déplacé EN DIRECT pendant le glissement");
    assert(lastCamera === null, "renderGraphMiniMap() (pan) : onCameraChange PAS encore appelé pendant le glissement (coûteux à chaque pointermove)");
    // ...et onCameraChange n'est appelé qu'à la fin (pointerup), une seule fois
    svgEl.dispatch('pointerup', { clientX: 60, clientY: 100, pointerId: 1 });
    assert(!!lastCamera && lastCamera.x === 40 && lastCamera.y === 0, "renderGraphMiniMap() (pan) : onCameraChange appelé une fois à la fin, avec la position finale");

    // Le glissement qui vient de se terminer n'a PAS navigué (drag.moved === true empêche la
    // résolution du tap dans endDrag(), voir renderGraphMiniMap()).
    assert(clickedId === null, "renderGraphMiniMap() (pan) : un vrai glissement ne déclenche jamais de navigation, même en relâchant sur un nœud");

    // Un tap normal (sans glissement) sur la position ÉCRAN correspondant désormais à 'b' navigue
    // bien — la caméra "vécue" (liveCamera, voir renderGraphMiniMap()) est repartie du dernier
    // glissement (40,0), pas de la position du tout premier rendu (0,0) : sans ce suivi, ce tap
    // viserait la mauvaise position monde puisqu'aucun re-rendu n'a eu lieu entre les deux gestes.
    svgEl.dispatch('pointerdown', { clientX: 130, clientY: 120, pointerId: 1 });
    svgEl.dispatch('pointerup', { clientX: 130, clientY: 120, pointerId: 1 });
    assert(clickedId === 'b', "renderGraphMiniMap() (pan) : un tap normal après un glissement précédent (sans re-rendu) vise la bonne position monde");
}

// ===================================================================
// Villes spécialisées (marchand/professeur) : generateUrbanFloorMap()/triggerShopEncounter()/
// buyShopItem()/trainSkill()/leaveShop(). Voir CLAUDE.md.
// ===================================================================

// generateUrbanFloorMap() : jamais de rôle sur la ville de départ ni sur la ville gardienne
// (escalier/Sortie) — un PNJ spécialisé ne se cumule jamais avec un gardien. Spécialité toujours
// dans le bon pool selon le rôle attribué.
{
    resetTransientState();
    gameState.currentFloor = 3;
    for (let i = 0; i < 20; i++) {
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        const start = um.citiesById[um.currentCityId];
        assert(start.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville de départ");
        Object.values(um.citiesById).forEach(city => {
            if (city.isStairs || city.isExit) {
                assert(city.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville gardienne");
            }
            if (city.role === 'merchant') {
                assert(['weapons', 'ranged', 'armors', 'scrolls'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité marchand dans le bon pool (catégories d'objet)");
            } else if (city.role === 'trainer') {
                assert(['weapon', 'unarmed', 'magic', 'stealth'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité professeur dans le bon pool (compétences réelles)");
            }
        });
    }
}

// generateShopStock() : 3 objets, tous de la catégorie forcée, chacun avec un prix > 0 dérivé de sa
// baseValue (voir SHOP_MARKUP).
{
    const stock = generateShopStock('armors');
    assert(stock.length === 3, "generateShopStock() : 3 objets générés");
    stock.forEach(item => {
        assert(item.category === 'armors', "generateShopStock() : catégorie forcée respectée");
        assert(item.price === Math.max(1, Math.round((item.baseValue || 1) * SHOP_MARKUP)),
            "generateShopStock() : prix = baseValue × SHOP_MARKUP");
    });

    const scrollStock = generateShopStock('scrolls');
    scrollStock.forEach(item => {
        assert(item.category === 'scrolls', "generateShopStock() : catégorie 'scrolls' (parchemins) respectée aussi");
    });
}

// triggerShopEncounter() : marque le choix en attente, affiche #shop-zone, ne régénère JAMAIS le
// stock d'un marchand déjà visité (stock fixe pour la partie).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const merchantCity = { id: 'test-merchant', name: 'Testopolis', role: 'merchant', specialty: 'weapons', stock: null };
    gameState.urbanMap.citiesById[merchantCity.id] = merchantCity;

    ui.shopZone.classList.add('hidden');
    triggerShopEncounter(merchantCity);
    assert(gameState.shopChoicePending === true, "triggerShopEncounter() : shopChoicePending activé");
    assert(gameState.pendingShopCityId === merchantCity.id, "triggerShopEncounter() : pendingShopCityId pointe sur la bonne ville");
    assert(ui.shopZone.classList.contains('hidden') === false, "triggerShopEncounter() : #shop-zone affiché");
    assert(merchantCity.stock.length === 3, "triggerShopEncounter() : stock généré à la première visite");
    assert(isActionBlocked() === true, "triggerShopEncounter() : isActionBlocked() true tant que le choix est en attente (masque la Carte Urbaine)");

    const stockBefore = merchantCity.stock;
    triggerShopEncounter(merchantCity); // Seconde visite
    assert(merchantCity.stock === stockBefore, "triggerShopEncounter() : stock JAMAIS régénéré sur une visite ultérieure");
}

// buyShopItem() : achat normal (déduit le prix, retire du stock, ajoute à l'inventaire), refusé si
// PO insuffisantes ou réserve d'équipement pleine ; un parchemin rejoint le grimoire plutôt que
// l'inventaire.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    gameState.inventory = []; // resetTransientState() ne touche pas l'inventaire : jamais implicite ici
    const city = { id: 'test-merchant-2', name: 'Testburg', role: 'merchant', specialty: 'weapons', stock: null };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingShopCityId = city.id;
    city.stock = [{ name: "Épée test", category: 'weapons', price: 50, baseValue: 20 }];
    gameState.gold = 10;

    buyShopItem(0);
    assert(city.stock.length === 1, "buyShopItem() : achat refusé si PO insuffisantes (stock inchangé)");
    assert(gameState.gold === 10, "buyShopItem() : PO inchangées si achat refusé");

    gameState.gold = 100;
    buyShopItem(0);
    assert(gameState.gold === 50, "buyShopItem() : prix déduit des PO");
    assert(city.stock.length === 0, "buyShopItem() : objet retiré du stock");
    assert(gameState.inventory.some(i => i.name === "Épée test"), "buyShopItem() : objet ajouté à l'inventaire");

    // Réserve d'équipement pleine
    city.stock = [{ name: "Hache test", category: 'weapons', price: 10, baseValue: 5 }];
    gameState.inventory = [];
    for (let i = 0; i < gameState.maxInventory; i++) {
        gameState.inventory.push({ name: `Filler ${i}`, category: 'weapons' });
    }
    buyShopItem(0);
    assert(city.stock.length === 1, "buyShopItem() : achat refusé si réserve d'équipement pleine");

    // Parchemin : rejoint le grimoire, jamais l'inventaire, jamais limité
    gameState.inventory = [];
    city.stock = [{ name: "Parchemin test", category: 'scrolls', price: 10, baseValue: 5 }];
    gameState.spellbook = [];
    buyShopItem(0);
    assert(gameState.spellbook.some(i => i.name === "Parchemin test"), "buyShopItem() : parchemin ajouté au grimoire");
    assert(gameState.inventory.length === 0, "buyShopItem() : parchemin jamais ajouté à l'inventaire");
}

// trainSkill() : coût = TRAINER_COST_PER_LEVEL × niveau ACTUEL, amène l'XP exactement au niveau
// suivant, refusé si PO insuffisantes.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const city = { id: 'test-trainer', name: 'Testville', role: 'trainer', specialty: 'magic' };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingShopCityId = city.id;
    gameState.skills.magic = { level: 3, xp: 5, xpToNext: 40 };

    gameState.gold = 10; // Coût attendu : 20 × 3 = 60, insuffisant
    trainSkill();
    assert(gameState.skills.magic.level === 3, "trainSkill() : formation refusée si PO insuffisantes (niveau inchangé)");
    assert(gameState.gold === 10, "trainSkill() : PO inchangées si formation refusée");

    gameState.gold = 100;
    trainSkill();
    assert(gameState.gold === 40, "trainSkill() : coût (20 × niveau actuel) déduit des PO");
    assert(gameState.skills.magic.level === 4, "trainSkill() : franchit exactement le niveau suivant");
    assert(gameState.skills.magic.xp === 0, "trainSkill() : XP exactement consommée jusqu'au niveau suivant, rien de plus");
}

// leaveShop() : referme #shop-zone et débloque les actions normales (Carte Urbaine redevient
// visible via isActionBlocked()).
{
    resetTransientState();
    gameState.shopChoicePending = true;
    gameState.pendingShopCityId = 'whatever';
    ui.shopZone.classList.remove('hidden');

    leaveShop();
    assert(gameState.shopChoicePending === false, "leaveShop() : shopChoicePending désactivé");
    assert(gameState.pendingShopCityId === null, "leaveShop() : pendingShopCityId réinitialisé");
    assert(ui.shopZone.classList.contains('hidden') === true, "leaveShop() : #shop-zone masqué");
    assert(isActionBlocked() === false, "leaveShop() : isActionBlocked() redevient false");
}

// arriveAtCity() : une ville avec un rôle déclenche l'écran marchand/professeur plutôt que
// l'arrivée "ville sûre" générique.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const city = { id: 'test-dispatch', name: 'Dispatchville', role: 'trainer', specialty: 'weapon', known: false, visited: false, roads: [] };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingUrbanTravel = { destinationCityId: city.id, ambushesRemaining: 0 };
    ui.shopZone.classList.add('hidden');

    arriveAtCity();
    assert(gameState.shopChoicePending === true, "arriveAtCity() : dispatch vers triggerShopEncounter() pour une ville avec un rôle");
    assert(ui.shopZone.classList.contains('hidden') === false, "arriveAtCity() : #shop-zone affiché après dispatch");
}

// ===================================================================
// Repaires sur les routes : generateUrbanFloorMap()/triggerLairChoice()/diveIntoLair()/
// declineLair()/winCombat() (enchaînement combats → boss → butin). Voir CLAUDE.md.
// ===================================================================

// generateUrbanFloorMap() : exactement lairRoadsPerFloor (ou lairRoadsFinalFloor à l'étage final)
// routes marquées repaire, symétriquement dans les deux sens (isLair/lairId identiques), avec un
// lairsById cohérent (2 ou 3 combats forcés, jamais nettoyé à la génération).
{
    resetTransientState();
    for (let i = 0; i < 15; i++) {
        gameState.currentFloor = 3;
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        const lairs = Object.values(um.lairsById);
        assert(lairs.length === config.urbanFloors.lairRoadsPerFloor,
            "generateUrbanFloorMap() : exactement lairRoadsPerFloor repaires sur un étage normal");

        lairs.forEach(lair => {
            assert(lair.cleared === false, "generateUrbanFloorMap() : un repaire n'est jamais nettoyé à la génération");
            assert([2, 3].includes(lair.combatsRemaining), "generateUrbanFloorMap() : 2 ou 3 combats forcés avant le boss");
            const roadAtoB = um.citiesById[lair.cityAId].roads.find(r => r.to === lair.cityBId);
            const roadBtoA = um.citiesById[lair.cityBId].roads.find(r => r.to === lair.cityAId);
            assert(roadAtoB && roadAtoB.isLair && roadAtoB.lairId === lair.id, "generateUrbanFloorMap() : isLair posé dans le sens A→B");
            assert(roadBtoA && roadBtoA.isLair && roadBtoA.lairId === lair.id, "generateUrbanFloorMap() : isLair posé aussi dans le sens B→A");
        });
    }

    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    assert(Object.values(gameState.urbanMap.lairsById).length === config.urbanFloors.lairRoadsFinalFloor,
        "generateUrbanFloorMap() : lairRoadsFinalFloor repaires à l'étage final");
}

// travelToCity() : un repaire sur la route DIRECTEMENT empruntée déclenche le choix AVANT toute
// embuscade normale ; le trajet interrompu reste en attente, isActionBlocked() masque la Carte
// Urbaine (voir updateUI()). declineLair() reprend le trajet normalement, sans marquer le repaire
// nettoyé (re-proposé à un futur trajet).
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    const start = { id: 'lair-start', name: 'Départ Test', known: true, visited: true, roads: [] };
    const neighbor = { id: 'lair-neighbor', name: 'Voisine Test', known: true, visited: false, roads: [] };
    const lairId = 'lair-test-0';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.urbanMap = {
        theme: gameState.currentDistrict, isFinalFloor: false,
        citiesById: { [start.id]: start, [neighbor.id]: neighbor },
        currentCityId: start.id, lairsById: { [lairId]: lair }
    };

    const originalRandom = Math.random;
    Math.random = () => 0.99; // Écarte toute embuscade normale sur ce trajet
    travelToCity(neighbor.id);
    Math.random = originalRandom;

    assert(gameState.lairChoicePending === true, "travelToCity() : un repaire sur la route directe déclenche le choix AVANT toute embuscade normale");
    assert(gameState.pendingUrbanTravel && gameState.pendingUrbanTravel.destinationCityId === neighbor.id, "travelToCity() : le trajet interrompu reste en attente pendant le choix");
    assert(isActionBlocked() === true, "isActionBlocked() : vrai tant que le choix du repaire est en attente");

    declineLair();
    assert(gameState.lairChoicePending === false, "declineLair() : referme le choix");
    assert(lair.cleared === false, "declineLair() : le repaire reste intact, re-proposé plus tard");
    assert(gameState.urbanMap.currentCityId === neighbor.id, "declineLair() : le trajet interrompu reprend et aboutit normalement");
}

// diveIntoLair() + winCombat() : enchaîne exactement combatsRemaining combats de sbires (stage
// 'trash'), puis un unique combat de boss (stage 'boss', généré seulement à ce moment-là) ; sa
// victoire marque le repaire nettoyé et fait reprendre le trajet interrompu jusqu'à destination.
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    const start = { id: 'lair-start-2', name: 'Départ Test 2', known: true, visited: true, roads: [] };
    const neighbor = { id: 'lair-neighbor-2', name: 'Voisine Test 2', known: true, visited: false, roads: [] };
    const lairId = 'lair-test-1';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.urbanMap = {
        theme: gameState.currentDistrict, isFinalFloor: false,
        citiesById: { [start.id]: start, [neighbor.id]: neighbor },
        currentCityId: start.id, lairsById: { [lairId]: lair }
    };

    const originalRandom = Math.random;
    Math.random = () => 0.99;
    travelToCity(neighbor.id);
    Math.random = originalRandom;
    assert(gameState.lairChoicePending === true, "setup : choix du repaire bien déclenché");

    diveIntoLair();
    assert(gameState.inCombat === true, "diveIntoLair() : lance immédiatement le premier combat forcé");
    assert(gameState.pendingLairDive && gameState.pendingLairDive.stage === 'trash', "diveIntoLair() : commence par la vague de sbires (stage 'trash')");
    assert(gameState.pendingLairDive.combatsLeft === lair.combatsRemaining, "diveIntoLair() : combatsLeft initialisé au nombre de combats du repaire");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat === true, "winCombat() (repaire) : enchaîne directement sur le combat suivant");
    assert(gameState.pendingLairDive.stage === 'trash', "winCombat() (repaire) : reste en stage 'trash' tant qu'il reste des sbires");
    assert(gameState.pendingLairDive.combatsLeft === 1, "winCombat() (repaire) : décrémente combatsLeft");
    assert(lair.bossInstance === null, "winCombat() (repaire) : le boss n'est pas encore généré pendant la vague de sbires");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(gameState.inCombat === true, "winCombat() (repaire) : lance le combat de boss une fois les sbires épuisés");
    assert(gameState.pendingLairDive.stage === 'boss', "winCombat() (repaire) : bascule en stage 'boss'");
    assert(lair.bossInstance !== null, "winCombat() (repaire) : génère le boss du repaire à ce moment-là");
    assert(gameState.currentEnemy === lair.bossInstance, "winCombat() (repaire) : le combat en cours est bien celui du boss du repaire");
    assert(lair.cleared === false, "winCombat() (repaire) : pas encore nettoyé tant que le boss n'est pas vaincu");

    gameState.currentEnemy.hp = -9999;
    winCombat();
    assert(lair.cleared === true, "winCombat() (repaire) : marque le repaire nettoyé après la victoire sur son boss");
    assert(gameState.pendingLairDive === null, "winCombat() (repaire) : la plongée est terminée");
    assert(gameState.urbanMap.currentCityId === neighbor.id, "winCombat() (repaire) : le trajet interrompu reprend et aboutit après la plongée");
}

// attemptFlee() : fuir en pleine plongée laisse le repaire intact (jamais marqué nettoyé), sans
// forcer la reprise du trajet interrompu — même comportement passif qu'une fuite d'embuscade urbaine
// normale (voir pendingUrbanTravel, pas de reprise automatique non plus dans ce cas).
{
    resetTransientState();
    gameState.currentDistrict = "Rue des Illusions";
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Sbire Test", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    const lair = { id: 'lair-flee-0', cityAId: 'a', cityBId: 'b', cleared: false, combatsRemaining: 2, bossInstance: null };
    gameState.pendingLairDive = { lairId: lair.id, combatsLeft: 2, stage: 'trash' };
    gameState.urbanMap = { theme: gameState.currentDistrict, isFinalFloor: false, citiesById: {}, currentCityId: 'a', lairsById: { [lair.id]: lair } };

    const originalRandom = Math.random;
    Math.random = () => 0.01; // Réussite garantie (60% de base, voir attemptFlee())
    attemptFlee();
    Math.random = originalRandom;

    assert(gameState.inCombat === false, "attemptFlee() (repaire) : fuite réussie, combat terminé");
    assert(gameState.pendingLairDive === null, "attemptFlee() (repaire) : la plongée est annulée");
    assert(lair.cleared === false, "attemptFlee() (repaire) : le repaire reste intact après une fuite");
}

// buildUrbanMapGraphData() : une route repaire porte un edges[].marker dédié — rouge/💀 tant qu'elle
// n'est pas nettoyée, gris/🏆 une fois vaincue (jamais un goalIcon : une route reste franchissable).
{
    const start = { id: 'lair-map-a', name: 'A', known: true, visited: true, roads: [], x: 0.3, y: 0.5 };
    const neighbor = { id: 'lair-map-b', name: 'B', known: true, visited: false, roads: [], x: 0.7, y: 0.5 };
    const lairId = 'lair-map-0';
    start.roads.push({ to: neighbor.id, distance: 2, isLair: true, lairId });
    neighbor.roads.push({ to: start.id, distance: 2, isLair: true, lairId });
    const lair = { id: lairId, cityAId: start.id, cityBId: neighbor.id, cleared: false, combatsRemaining: 2, bossInstance: null };
    const urbanMap = { theme: "Rue des Illusions", isFinalFloor: false, citiesById: { [start.id]: start, [neighbor.id]: neighbor }, currentCityId: start.id, lairsById: { [lairId]: lair } };

    let graph = buildUrbanMapGraphData(urbanMap);
    let edge = graph.edges.find(e => (e.from === start.id && e.to === neighbor.id) || (e.from === neighbor.id && e.to === start.id));
    assert(!!edge && !!edge.marker, "buildUrbanMapGraphData() : une route repaire porte un edges[].marker");
    assert(edge.marker.icon === '💀' && edge.marker.variant === 'guarded', "buildUrbanMapGraphData() : marqueur rouge/💀 tant que le repaire n'est pas nettoyé");
    assert(edge.goalIcon === undefined && graph.nodes.every(n => n.goalIcon === null || n.goalIcon === undefined),
        "buildUrbanMapGraphData() : un repaire n'est jamais un goalIcon, une route reste franchissable");

    lair.cleared = true;
    graph = buildUrbanMapGraphData(urbanMap);
    edge = graph.edges.find(e => (e.from === start.id && e.to === neighbor.id) || (e.from === neighbor.id && e.to === start.id));
    assert(edge.marker.icon === '🏆' && edge.marker.variant === 'default', "buildUrbanMapGraphData() : marqueur 🏆 une fois le repaire nettoyé");
}

console.log(`${passed} test(s) OK, ${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
