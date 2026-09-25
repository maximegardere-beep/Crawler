// combat.js — tests régression : Combat : distance/portée (Sprint, Retreat, resolveEnemyReaction, barre de distance), en-tête de carte au combat, Arme/Tir nécessitent une arme équipée.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L71-670 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
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
    // dés du joueur au plus bas (x2), dé du mob au plus haut -> échec net ; le 4e tirage (0.99) est le
    // jet d'enrage (Chantier 3, noteMobKitingRound() dans safeEnemyCounterAttack()) — volontairement
    // au-delà du seuil de proba pour ne pas interférer avec ce scénario, qui teste le blocage simple.
    const seq = [0, 0, 0.999, 0.99];
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
    // Jet d'enrage (Chantier 3, noteMobKitingRound()) écarté volontairement : ce scénario teste le
    // blocage simple, pas la ruée d'enrage (couverte séparément dans combat-enrage.js).
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    safeEnemyCounterAttack();
    Math.random = originalRandom;
    assert(ui.btnAttackWeapon.disabled === false, "safeEnemyCounterAttack() : aucune riposte déclenchée quand le mob de mêlée est hors de portée");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 999, def: 0, status: {} };
    gameState.combatDistance = 0; // rattrapé au corps à corps : plus aucun avantage
    assert(getCombatRangeContext().playerAdvantaged === false, "getCombatRangeContext() : plus d'avantage une fois rattrapé au corps à corps");

    // Témoin de riposte : PV avant/après plutôt que le verrouillage des boutons (chantier "lisibilité
    // combat" — sous le stub global.setTimeout de _helpers.js, toute la séquence de beats se déroule
    // en synchrone, donc les boutons sont déjà reverrouillés PUIS déverrouillés avant que cette ligne
    // ne s'exécute ; seul l'effet final — des PV perdus — reste observable après coup).
    const hpBefore = gameState.hp;
    safeEnemyCounterAttack();
    assert(gameState.hp < hpBefore, "safeEnemyCounterAttack() : la riposte se déclenche normalement au contact");
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
    // Jet d'enrage (Chantier 3, noteMobKitingRound()) écarté volontairement : ce scénario teste le
    // blocage simple, pas la ruée d'enrage (couverte séparément dans combat-enrage.js).
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    safeEnemyCounterAttack();
    Math.random = originalRandom;
    assert(ui.btnAttackWeapon.disabled === false, "safeEnemyCounterAttack() : aucune riposte déclenchée quand le mob à distance est au corps à corps");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance; // a repris ses distances
    assert(getCombatRangeContext().mobNeedsDistance === false, "getCombatRangeContext() : plus besoin de reculer une fois la distance reprise");

    const hpBefore = gameState.hp;
    safeEnemyCounterAttack();
    assert(gameState.hp < hpBefore, "safeEnemyCounterAttack() : la riposte à distance se déclenche normalement une fois l'écart repris");
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
    const hpBefore = gameState.hp;
    resolveEnemyReaction();
    Math.random = originalRandom;

    assert(gameState.combatDistance > 0, "resolveEnemyReaction() : le mob à distance parvient à reculer");
    assert(gameState.hp < hpBefore, "resolveEnemyReaction() : une fois reculé, le mob à distance tire immédiatement");
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
    // déclenchée par resolveEnemyReaction() : pas de ruée, l'écart se comble progressivement. Le 5e
    // tirage (0.99) est le jet d'enrage (Chantier 3, noteMobKitingRound()) déclenché tant que l'écart
    // n'est pas encore comblé après le premier cast — volontairement au-delà du seuil de proba pour ne
    // pas interférer avec ce scénario, qui teste le rapprochement PROGRESSIF, pas l'enrage.
    const seq = [0.5, 0.5, 0.4, 0.55, 0.99, 0.5, 0.5, 0.4, 0.55]; // playerRoll=3, mobRoll=4 (diff=-1) à chaque manche
    let idx = 0;
    Math.random = () => seq[(idx++) % seq.length];

    // Témoin qu'une riposte a bien eu lieu : des PV perdus (gameState.hp), plutôt que le verrouillage
    // des boutons. Depuis le séquenceur de beats (chantier "lisibilité combat"), le stub
    // global.setTimeout de _helpers.js déroule toute la chaîne en synchrone — les boutons sont donc
    // déjà reverrouillés PUIS déverrouillés avant que l'assertion ne s'exécute, ce qui rendrait ce
    // witness toujours faux. btnFlee reste utilisé pour l'assertion "pas encore de riposte" ci-dessous
    // (aucun effet de bord de updateUI() dessus, contrairement à btnAttackWeapon qui dépend de l'écart).
    ui.btnFlee.disabled = false;
    attackMagic();
    assert(gameState.combatDistance === 1, "resolveEnemyReaction() : un mob de mêlée hors de portée avance quand même vers le joueur");
    assert(ui.btnFlee.disabled === false, "resolveEnemyReaction() : tant que l'écart tient, le mob de mêlée ne peut pas riposter");

    const hpBefore = gameState.hp;
    attackMagic(); // Doit combler l'écart restant (2 - 1 - 1 = 0) et enfin riposter pour de vrai
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "resolveEnemyReaction() : le mob finit par combler l'écart");
    assert(gameState.hp < hpBefore, "resolveEnemyReaction() : une fois l'écart comblé, la riposte se déclenche normalement");
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
