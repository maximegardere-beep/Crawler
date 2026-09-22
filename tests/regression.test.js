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

console.log(`${passed} test(s) OK, ${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
