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
    gameState.stance = 'melee';
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
// Sprint (rapprochement dédié en combat à distance contesté)
// ===================================================================
resetTransientState();
ui.btnSprint.classList.add('hidden'); // état initial reproduit depuis index.html
updateUI();
assert(ui.btnSprint.classList.contains('hidden'), "Sprint caché hors combat (état initial HTML)");

resetTransientState();
gameState.inCombat = true;
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = 0;
updateUI();
assert(ui.btnSprint.classList.contains('hidden'), "Sprint caché face à un mob de mêlée (rien à combler)");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'melee';
gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 100, maxHp: 100, atk: 10, def: 6, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
updateUI();
assert(!ui.btnSprint.classList.contains('hidden'), "Sprint visible : mêlée vs mob à distance, écart > 0");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'ranged';
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
updateUI();
assert(ui.btnSprint.classList.contains('hidden'), "Sprint caché : joueur à distance face à un mob de mêlée");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'melee';
gameState.level = 5;
gameState.currentEnemy = { name: "Fusil de Chasse Rouillé Mob", hp: 100, maxHp: 100, atk: 8, def: 4, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
const enemyHpBefore = gameState.currentEnemy.hp;
attemptSprint();
assert(gameState.currentEnemy.hp === enemyHpBefore, "Sprint ne blesse jamais l'ennemi directement");
// Un seul round peut voir le mob gagner le jet (l'écart grandit alors) : seules les bornes sont garanties ici.
assert(gameState.combatDistance >= 0 && gameState.combatDistance <= config.rangedCombat.maxDistance, "Sprint reste dans les bornes [0, maxDistance] après une seule tentative");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'melee';
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
assert(!outOfBounds, "combatDistance reste toujours dans les bornes [0, maxDistance] au fil des sprints");
assert(gameState.combatDistance === 0, `L'écart finit par être comblé après plusieurs sprints (${attempts} essais, niveau élevé)`);

{
    // Progression garantie : même si le mob gagne le jet à plate couture, l'écart se réduit d'au
    // moins 1 (jamais totalement bloqué). On force le joueur au plus bas et le mob au plus haut.
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'melee';
    gameState.level = 1;
    gameState.currentEnemy = { name: "Cible d'entraînement", hp: 9999, maxHp: 9999, atk: 1, def: 1, ranged: true, status: {} };
    gameState.combatDistance = 3;
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => { callCount++; return callCount <= 2 ? 0 : 0.999; }; // dés du joueur au plus bas, dé du mob au plus haut
    attemptSprint();
    Math.random = originalRandom;
    assert(gameState.combatDistance === 2, "Sprint : même un jet perdu pour le joueur réduit l'écart d'au moins 1 (progression garantie)");
}

// ===================================================================
// Reculer (attemptRetreat) : symétrique du Sprint, pour rouvrir l'écart
// ===================================================================
resetTransientState();
ui.btnRetreat.classList.add('hidden'); // état initial reproduit depuis index.html
updateUI();
assert(ui.btnRetreat.classList.contains('hidden'), "Reculer caché hors combat (état initial HTML)");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'ranged';
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = 0;
updateUI();
assert(!ui.btnRetreat.classList.contains('hidden'), "Reculer visible : posture à distance rattrapée au corps à corps (écart = 0)");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'ranged';
gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 100, maxHp: 100, atk: 10, def: 6, ranged: true, status: {} };
gameState.combatDistance = config.rangedCombat.initialDistance;
updateUI();
assert(ui.btnRetreat.classList.contains('hidden'), "Reculer caché : duel à distance non contesté (écart déjà tenu par les deux camps)");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'melee';
gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
gameState.combatDistance = 0;
updateUI();
assert(ui.btnRetreat.classList.contains('hidden'), "Reculer caché : joueur en posture corps à corps");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'ranged';
gameState.level = 10;
gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 100, maxHp: 100, atk: 8, def: 4, status: {} };
gameState.combatDistance = 0;
const enemyHpBeforeRetreat = gameState.currentEnemy.hp;
attemptRetreat();
assert(gameState.currentEnemy.hp === enemyHpBeforeRetreat, "Reculer ne blesse jamais l'ennemi directement");
assert(gameState.combatDistance >= 0, "Reculer ne peut qu'égaler ou augmenter l'écart initial (jamais négatif)");

resetTransientState();
gameState.inCombat = true;
gameState.stance = 'ranged';
gameState.level = 10;
gameState.currentEnemy = { name: "Cible d'entraînement", hp: 9999, maxHp: 9999, atk: 1, def: 1, status: {} };
gameState.combatDistance = 0;
let retreatAttempts = 0, retreatOutOfBounds = false;
while (gameState.combatDistance <= 0 && retreatAttempts < 200) {
    attemptRetreat();
    if (gameState.combatDistance < 0 || gameState.combatDistance > config.rangedCombat.maxDistance) retreatOutOfBounds = true;
    retreatAttempts++;
    if (gameState.hp <= 0) break;
}
assert(!retreatOutOfBounds, "combatDistance reste toujours dans les bornes [0, maxDistance] au fil des reculs");
assert(gameState.combatDistance > 0, `L'écart finit par se rouvrir après plusieurs tentatives (${retreatAttempts} essais, niveau élevé)`);

// ===================================================================
// Portée : un mob de mêlée ne peut pas toucher un joueur qui tient la distance
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged';
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 999, def: 0, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance; // contesté, joueur hors de portée
    const ctx = getCombatRangeContext();
    assert(ctx.playerAdvantaged === true, "getCombatRangeContext() : joueur avantagé (à distance face à un mob de mêlée)");

    ui.btnAttackWeapon.disabled = false;
    safeEnemyCounterAttack();
    assert(ui.btnAttackWeapon.disabled === false, "safeEnemyCounterAttack() : aucune riposte déclenchée quand le mob de mêlée est hors de portée");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged';
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
    gameState.stance = 'melee';
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 999, def: 0, ranged: true, status: {} };
    gameState.combatDistance = config.rangedCombat.initialDistance; // mob à distance : peut tirer même de loin
    assert(getCombatRangeContext().playerAdvantaged === false, "getCombatRangeContext() : un mob à distance n'est jamais hors de portée, lui");
}

// ===================================================================
// resolveEnemyReaction() : un mob de mêlée hors de portée ne reste plus figé — il tente de
// combler l'écart au lieu de rester totalement bloqué (Magie, étourdissement, fuite ratée, ...).
// Reproduit le scénario du rapport : Magie répétée face à un mob CAC en posture "à distance".
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.stance = 'ranged';
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
    assert(gameState.combatDistance < config.rangedCombat.maxDistance, "resolveEnemyReaction() : un mob de mêlée hors de portée avance quand même vers le joueur (S2 corrigé)");
    assert(ui.btnFlee.disabled === false, "resolveEnemyReaction() : tant que l'écart tient, le mob de mêlée ne peut pas riposter (S1 corrigé)");

    attackMagic(); // Doit combler l'écart restant (8 - 5 - 5 < 0) et enfin riposter pour de vrai
    Math.random = originalRandom;
    assert(gameState.combatDistance === 0, "resolveEnemyReaction() : le mob finit par combler l'écart");
    assert(ui.btnFlee.disabled === true, "resolveEnemyReaction() : une fois l'écart comblé, la riposte se déclenche normalement");
}
{
    // attemptRetreat() : si le jet réussit (écart rouvert), la riposte ne doit plus porter —
    // avant correctif, enemyCounterAttack() était inconditionnelle même après un recul réussi.
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.stance = 'ranged';
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
    assert(ui.btnFlee.disabled === false, "attemptRetreat() : aucune riposte ne se déclenche une fois l'écart rouvert (bug du rapport corrigé)");
}
{
    // Fuite ratée sans action gated : l'écart doit quand même évoluer grâce à resolveEnemyReaction().
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.stance = 'ranged';
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
// Barre de distance : le mob est toujours à gauche, le joueur toujours à droite
// ===================================================================
{
    // Constantes dupliquées depuis updateUI() (app.js) pour vérifier les positions attendues.
    const HOME_EDGE = 8, ADJACENT_GAP = 5;
    const leftPos = el => parseFloat(el.style.left);

    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'melee';
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 0; // CAC vs CAC
    updateUI();
    const enemyPos = leftPos(ui.combatDistanceEnemyIcon), playerPos = leftPos(ui.combatDistancePlayerIcon);
    assert(enemyPos < playerPos, "CAC vs CAC : le mob reste à gauche du joueur");
    assert(Math.abs(playerPos - enemyPos - ADJACENT_GAP) < 0.01, "CAC vs CAC : les deux icônes sont proches du centre mais non superposées");

    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged'; // joueur veut la distance, mob de mêlée la comble
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 8, def: 4, status: {} };
    gameState.combatDistance = config.rangedCombat.maxDistance;
    updateUI();
    assert(Math.abs(leftPos(ui.combatDistancePlayerIcon) - (100 - HOME_EDGE)) < 0.01, "Joueur à distance, écart maximal : ancré sur son bord droit");
    assert(Math.abs(leftPos(ui.combatDistanceEnemyIcon) - HOME_EDGE) < 0.01, "Mob de mêlée, écart maximal : reste sur son bord gauche (n'a pas encore rattrapé)");

    gameState.combatDistance = 0; // le mob a rattrapé le joueur au corps à corps
    updateUI();
    const closeEnemyPos = leftPos(ui.combatDistanceEnemyIcon), closePlayerPos = leftPos(ui.combatDistancePlayerIcon);
    assert(Math.abs(closePlayerPos - (100 - HOME_EDGE)) < 0.01, "Joueur à distance rattrapé : reste ancré sur son bord");
    assert(Math.abs(closePlayerPos - closeEnemyPos - ADJACENT_GAP) < 0.01, "Mob de mêlée ayant rattrapé l'écart : placé juste à côté du joueur (contact)");
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
// Recul forcé : un mob de mêlée qui rattrape un joueur en posture à distance ne débloque plus le
// corps à corps gratuitement (Arme/Mains nues restent grisés, S'éloigner devient la seule option
// jusqu'à ce que le joueur rouvre l'écart ou assume la posture corps à corps).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged';
    gameState.equipment.weapon = { name: "Gourdin d'Essai", baseDmg: 5 };
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 8, def: 4, status: {} };
    gameState.combatDistance = 0; // rattrapé au corps à corps malgré la posture à distance
    updateUI();
    assert(isForcedRetreatSituation() === true, "isForcedRetreatSituation() détecte le rattrapage non voulu");
    assert(ui.btnAttackWeapon.disabled === true, "Recul forcé : Arme grisée même avec une arme équipée");
    assert(ui.btnAttackUnarmed.disabled === true, "Recul forcé : Mains nues grisées aussi");
    assert(!ui.btnRetreat.classList.contains('hidden'), "Recul forcé : S'éloigner est bien visible");

    const hpBefore = gameState.currentEnemy.hp;
    attackWeapon();
    assert(gameState.currentEnemy.hp === hpBefore, "attackWeapon() ne porte pas en situation de recul forcé");
    attackUnarmed();
    assert(gameState.currentEnemy.hp === hpBefore, "attackUnarmed() ne porte pas en situation de recul forcé");

    // Le joueur assume finalement le corps à corps : la situation de recul forcé disparaît
    gameState.stance = 'melee';
    updateUI();
    assert(isForcedRetreatSituation() === false, "Assumer la posture CAC lève le recul forcé");
    assert(ui.btnAttackWeapon.disabled === false, "Arme redevient utilisable une fois la posture CAC assumée");
}

// ===================================================================
// togglePlayerStance() : la bascule vers le corps à corps ne doit être bloquée que si un mob de
// mêlée est activement tenu à distance (duel contesté) — pas simplement parce que combatDistance > 0
// (cas d'un échange DIST vs DIST non contesté, où l'écart est fixe mais ne "protège" personne).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged';
    gameState.currentEnemy = { name: "Molosse d'Entrepôt", hp: 50, maxHp: 50, atk: 8, def: 4, status: {} }; // CAC, contesté
    gameState.combatDistance = config.rangedCombat.initialDistance;
    togglePlayerStance();
    assert(gameState.stance === 'ranged', "togglePlayerStance() : bascule bloquée si un mob de mêlée est activement tenu à distance");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'ranged';
    gameState.currentEnemy = { name: "Photocopieuse Carnivore", hp: 50, maxHp: 50, atk: 8, def: 4, ranged: true, status: {} }; // DIST, non contesté
    gameState.combatDistance = config.rangedCombat.initialDistance;
    togglePlayerStance();
    assert(gameState.stance === 'melee', "togglePlayerStance() : bascule autorisée face à un mob DIST non contesté (bug rapporté corrigé)");
    updateUI();
    assert(!ui.btnSprint.classList.contains('hidden'), "Sprint devient visible une fois la posture CAC assumée face à un mob à distance");
}

// ===================================================================
// Arme/Tir nécessitent une arme réellement équipée (mains nues reste toujours disponible sans rien).
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.stance = 'melee';
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
    gameState.stance = 'ranged';
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
