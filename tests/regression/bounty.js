// bounty.js — tests régression : chasseurs de primes gobelins (chantier 3, voir NOTES_CHASSEURS.md) —
// prime, paliers, chasseurs calés sur le joueur, apparition, récompense, escouade, fuite, épitaphe, succès.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(values, fn) {
    const original = Math.random;
    let i = 0;
    Math.random = () => (Array.isArray(values) ? values[Math.min(i++, values.length - 1)] : values);
    try { return fn(); } finally { Math.random = original; }
}

// Dégâts moyens d'un coup de chasseur sur ce joueur, avec la même formule que rollDamage() (sans aléa).
function expectedHunterHit(hunter, playerDef) {
    const a = hunter.atk * config.mobDamageScaling.eliteDamageMult;
    return a * Math.max(config.mobDamageScaling.minMitigation, a / (a + playerDef));
}

// --- Stats calées sur le joueur (pure) ---
{
    const weak = { maxHp: 100, atk: 20, def: 5 };
    const strong = { maxHp: 400, atk: 80, def: 40 };
    const t = config.bounty.hunter;
    const hw = computeBountyHunterStats(weak, {}, t, config.mobDamageScaling);
    const hs = computeBountyHunterStats(strong, {}, t, config.mobDamageScaling);
    assert(hw.def === 7 && hs.def === 28, "DEF du chasseur = 35 % de la meilleure ATQ du joueur");
    const hitW = 20 * 20 / (20 + hw.def), hitS = 80 * 80 / (80 + hs.def);
    assert(Math.abs(hw.hp - hitW * 4) <= 1 && Math.abs(hs.hp - hitS * 4) <= 1, "PV du chasseur = ~4 coups du joueur");
    assert(Math.abs(expectedHunterHit(hw, 5) - 9) <= 1, "Coup du chasseur ≈ 9 % des PV max (joueur faible)");
    assert(Math.abs(expectedHunterHit(hs, 40) - 36) <= 2, "Coup du chasseur ≈ 9 % des PV max (joueur fort) : il suit le joueur, pas l'étage");
    const bruiser = computeBountyHunterStats(weak, bountyHunters.find(h => h.key === 'bruiser'), t, config.mobDamageScaling);
    assert(bruiser.atk > hw.atk && bruiser.def < hw.def, "Variante Cogneur : plus d'ATQ, moins de DEF");
}

// --- Génération ---
{
    resetTransientState();
    const h = withRandom(0, () => generateBountyHunter({ player: { maxHp: 100, atk: 20, def: 5 }, bountyValue: 65, floor: 4 }));
    assert(h.isBountyHunter && isEliteMob(h) && !h.isBoss, "Chasseur : toujours élite (💀), jamais boss");
    assert(h.baseName === h.name && bountyHunters.some(v => v.name === h.name), "Chasseur : nom d'une variante du catalogue (sprite dédié)");
    assert(h.bountyValue === 65 && h.maxHp === h.hp, "Chasseur : mémorise la prime qu'il vient réclamer");
    const variants = new Set();
    for (let i = 0; i < 40; i++) variants.add(generateBountyHunter({ bountyValue: 65 }).hunterVariant);
    assert(!variants.has('chief') && variants.has('tracker') && variants.has('bruiser'), "Hors escouade : Pisteur ou Cogneur, jamais le Chef");
    const chief = generateBountyHunter({ variantKey: 'chief', bountyValue: 95 });
    assert(chief.hunterVariant === 'chief' && chief.name === "Chef d'Escouade Gobelin", "Chef d'escouade sur demande");
    assert(generateBountyHunter({ variantKey: 'tracker' }).ranged === true, "Pisteur : combat à distance");
    assert(bountyHunters.every(v => MOB_DETAILS[v.name]), "Chaque variante a son détail signature (sprite)");
}

// --- Prime et paliers ---
{
    resetTransientState();
    assert(getBountyTier(0) === 0 && getBountyTier(30) === 1 && getBountyTier(60) === 2 && getBountyTier(90) === 3, "Paliers 30 / 60 / 90");
    const push = (ease) => gameState.runStats.recentWins.push({ ease });
    push(1); onBountyVictory({ name: "Rat" });
    assert(gameState.bounty.value === 8, "Victoire facile : +8");
    push(0.6); onBountyVictory({ name: "Rat" });
    assert(gameState.bounty.value === 11, "Victoire moyenne : +3");
    push(0.2); onBountyVictory({ name: "Rat" });
    assert(gameState.bounty.value === 11, "Victoire difficile : la prime ne baisse pas (seul un chasseur tué la remet à 0)");
    assert(gameState.bounty.combatsSinceHunter === 102, "Chaque victoire compte pour l'écart entre deux chasseurs");
    addBounty(500);
    assert(gameState.bounty.value === 100, "Prime plafonnée à 100");
    updateBountyUI();
    assert(!ui.bountyStatus.classList.contains('hidden') && ui.bountyStatus.innerText === '🎯 100', "Badge 🎯 affiché avec la prime");
    gameState.bounty.value = 0;
    updateBountyUI();
    assert(ui.bountyStatus.classList.contains('hidden'), "Badge masqué sans prime");
}

// --- Apparition ---
{
    resetTransientState();
    gameState.bounty = { value: 55, huntersKilled: 0, combatsSinceHunter: 10 };
    assert(withRandom(0, () => maybeSpawnBountyHunter()) === null, "Sous 60 : jamais de chasseur");
    gameState.bounty = { value: 60, huntersKilled: 0, combatsSinceHunter: 2 };
    assert(withRandom(0, () => maybeSpawnBountyHunter()) === null, "Jamais deux chasseurs à moins de 3 victoires d'écart");
    gameState.bounty.combatsSinceHunter = 3;
    assert(withRandom(0.15, () => maybeSpawnBountyHunter()) === null, "À 60 : 10 % seulement");
    const h = withRandom(0.05, () => maybeSpawnBountyHunter());
    assert(h && h.isBountyHunter && gameState.bounty.combatsSinceHunter === 0 && !gameState.pendingBountySquad, "À 60 : un chasseur seul, l'écart repart de zéro");
    gameState.bounty = { value: 90, huntersKilled: 0, combatsSinceHunter: 5 };
    assert(withRandom(0.15, () => maybeSpawnBountyHunter()) && gameState.pendingBountySquad === 1, "À 90 : 20 %, et un Chef d'escouade suivra");

    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    gameState.bounty = { value: 70, huntersKilled: 0, combatsSinceHunter: 5 };
    withRandom(0, () => handleStealthEncounter());
    assert(gameState.inCombat && gameState.currentEnemy && gameState.currentEnemy.isBountyHunter, "Exploration : le chasseur remplace le combat");
    assert(!gameState.stealthChoicePending, "Chasseur : aucune esquive furtive possible");
    assert(triggerNextAmbushOrArrive.toString().includes('maybeSpawnBountyHunter()'),
        "Embuscades de trajet (tous étages, villes comprises) : un chasseur peut aussi s'y présenter");
    gameState.inCombat = false; gameState.currentEnemy = null;
}

// --- Victoire contre un chasseur : récompense, remise à 0, escouade ---
{
    resetTransientState();
    gameState.currentFloor = 3;
    gameState.inventory = [];
    gameState.gold = 0;
    gameState.bounty = { value: 70, huntersKilled: 0, combatsSinceHunter: 0 };
    const hunter = spawnBountyHunter('bruiser');
    initiateCombat(hunter);
    hunter.hp = 0;
    winCombat();
    assert(gameState.gold === 70 * 3 * 2, "Chasseur tué : PO = prime × étage × 2");
    assert(gameState.bounty.value === 0 && gameState.bounty.huntersKilled === 1, "Chasseur tué : prime remise à 0");
    assert(gameState.inventory.length + gameState.spellbook.length === 1, "Chasseur tué : un objet de rang élite");
    assert(!gameState.inCombat, "Chasseur seul : le combat est terminé");

    resetTransientState();
    gameState.currentFloor = 2;
    gameState.inventory = [];
    gameState.bounty = { value: 95, huntersKilled: 0, combatsSinceHunter: 0 };
    gameState.pendingBountySquad = 1;
    const first = spawnBountyHunter('tracker');
    initiateCombat(first);
    first.hp = 0;
    winCombat();
    assert(gameState.inCombat && gameState.currentEnemy.hunterVariant === 'chief', "Escouade : le Chef d'escouade enchaîne aussitôt");
    assert(gameState.currentEnemy.bountyValue === 95 && gameState.pendingBountySquad === 0, "Escouade : le Chef réclame la même prime, plus personne derrière");
    gameState.currentEnemy.hp = 0;
    winCombat();
    assert(!gameState.inCombat && gameState.bounty.huntersKilled === 2, "Escouade vaincue : fin du combat");
    gameState.inventory = [];
}

// --- Fuite devant un chasseur ---
{
    resetTransientState();
    gameState.companion = generateCompanionCandidate(1);
    gameState.companion.specialty = companionSpecialties.find(s => s.type === 'scout');
    gameState.bounty = { value: 70, huntersKilled: 0, combatsSinceHunter: 0 };
    gameState.pendingBountySquad = 1;
    const hunter = spawnBountyHunter('bruiser');
    gameState.inCombat = true; gameState.currentEnemy = hunter;
    withRandom(0.55, () => attemptFlee());
    assert(gameState.inCombat, "Fuite à 50 % : un jet de 55 échoue, même avec un Éclaireur");
    gameState.inCombat = true; gameState.currentEnemy = hunter;
    withRandom(0.4, () => attemptFlee());
    assert(!gameState.inCombat && gameState.bounty.value === 80 && gameState.pendingBountySquad === 0, "Fuite réussie : prime +10, escouade dispersée");
    gameState.companion = null;
}

// --- Épitaphe, vignette, succès, migration ---
{
    resetTransientState();
    const text = withRandom(0, () => generateEpitaph({ cause: 'combat', enemyName: 'Gobelin Pisteur de Primes', bountyHunter: true }));
    assert(text.startsWith(EPITAPH_TEMPLATES.chasseurPrime[0].split('{{')[0]), "Tué par un chasseur : épitaphe dédiée");
    assert(gameOver.toString().includes('isBountyHunter'), "gameOver() reconnaît un chasseur tueur");
    const poster = composeExploreVignette('wantedPoster', { value: 72 });
    assert(poster.includes('RECHERCHÉ') && poster.includes('PRIME 72'), "Vignette « Avis de recherche » avec le montant de la prime");

    gameState.playerName = "Testeur";
    gameState.saveEnabled = true;
    addBounty(60);
    assert(gameState.achievements.wanted && !gameState.achievements.public_enemy, "Succès « Tête mise à prix » à 60");
    addBounty(30);
    assert(gameState.achievements.public_enemy, "Succès « Ennemi public n°1 » à 90");
    for (let i = 0; i < 3; i++) recordRunEvent('hunterKilled');
    assert(gameState.achievements.hunter_hunted, "Succès « Chasseur chassé » après 3 chasseurs");
    gameState.saveEnabled = false;
    gameState.inventory = [];

    assert(restoreSaveForName.toString().includes('createEmptyBounty'), "restoreSaveForName() complète la prime d'une ancienne sauvegarde");
}
