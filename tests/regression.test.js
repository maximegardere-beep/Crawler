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
    gameState.hp = gameState.maxHp;
    gameState.level = 1;
    gameState.equipment = { weapon: null, armor: null, ranged: null };
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    gameState.companion = null;
    gameState.bossChoicePending = false;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.companionChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.pendingBossRoomId = null;
    gameState.pendingTravel = null;
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
    gameState.combatDistance = config.rangedCombat.maxDistance;

    const originalRandom = Math.random;
    // Séquence par cast de Magie : [pas de backfire, variance de dégâts, dé joueur bas, dé mob haut]
    // -> le mob gagne systématiquement la manche de rapprochement déclenchée par resolveEnemyReaction().
    const seq = [0.5, 0.5, 0, 0.999];
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
    assert(gameState.combatDistance < config.rangedCombat.maxDistance, "resolveEnemyReaction() : un mob de mêlée hors de portée avance quand même vers le joueur");
    assert(ui.btnFlee.disabled === false, "resolveEnemyReaction() : tant que l'écart tient, le mob de mêlée ne peut pas riposter");

    attackMagic(); // Doit combler l'écart restant (8 - 5 - 5 < 0) et enfin riposter pour de vrai
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
    // fleeChance=60 : premier appel >= 0.6 force l'échec de la fuite ; puis dé joueur bas, dé mob haut.
    const seq = [0.99, 0, 0.999];
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

console.log(`${passed} test(s) OK, ${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
