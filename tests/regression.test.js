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
    // Sort à distance équipé, mana surabondant : attackMagic() exige désormais un sort dont la
    // catégorie correspond à l'écart courant (voir spellCategory) et assez de mana pour le lancer.
    gameState.equipment.spell = { spellName: "Foudre", spellCategory: 'ranged', baseDmg: 10, manaCost: 5 };
    gameState.mana = 100;

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

// registerCalmCard() : régénère aussi le mana passivement, mais seulement si un sort est équipé —
// et même si les PV sont déjà pleins (les deux jauges régénèrent indépendamment l'une de l'autre).
{
    resetTransientState();
    gameState.hp = gameState.maxHp; // PV déjà pleins : ne doit pas bloquer la régén de mana
    gameState.equipment.spell = { spellName: "Test", spellCategory: 'melee', baseDmg: 5, manaCost: 5, category: 'scrolls' };
    gameState.mana = 0;
    gameState.calmCardsSinceRegen = 0;
    gameState.calmCardsRegenThreshold = 2;
    registerCalmCard();
    assert(gameState.mana === 0, "registerCalmCard() : pas encore de régénération avant d'atteindre le seuil");
    registerCalmCard();
    assert(gameState.mana > 0, "registerCalmCard() : régénère du mana au seuil, même PV pleins");
    assert(gameState.mana <= gameState.maxMana, "registerCalmCard() : ne dépasse jamais maxMana");

    resetTransientState();
    gameState.hp = gameState.maxHp;
    gameState.equipment.spell = null; // Aucun sort équipé : rien à régénérer, jamais de mana fantôme
    gameState.mana = 0;
    gameState.calmCardsSinceRegen = 0;
    gameState.calmCardsRegenThreshold = 2;
    registerCalmCard();
    registerCalmCard();
    registerCalmCard();
    assert(gameState.mana === 0, "registerCalmCard() : aucune régénération de mana sans sort équipé");
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

console.log(`${passed} test(s) OK, ${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
