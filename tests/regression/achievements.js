// achievements.js — tests régression : chronique de run + succès sarcastiques + boîtes façon DCC
// (chantier 2, voir NOTES_SUCCES.md), et revente d'office du butin trouvé réserve pleine.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(values, fn) {
    const original = Math.random;
    let i = 0;
    Math.random = () => (Array.isArray(values) ? values[Math.min(i++, values.length - 1)] : values);
    try { return fn(); } finally { Math.random = original; }
}

function startRealGame() {
    resetTransientState();
    gameState.playerName = "Testeur";
    gameState.saveEnabled = true; // Les succès ne se débloquent que dans une vraie partie
    gameState.currentFloor = 1;
    gameState.inventory = [];
    gameState.gold = 0;
}

function fillReserve() {
    gameState.inventory = [];
    for (let i = 0; i < gameState.maxInventory; i++) gameState.inventory.push({ name: `Filler ${i}`, category: 'weapons' });
}

// --- Revente d'office, réserve pleine ---
{
    resetTransientState();
    fillReserve();
    const item = generateItem({ category: 'armors', rarityKey: 'epique', jitter: false });
    const expected = Math.max(1, Math.round(getSellPrice(item) * 0.5));
    assert(getOverflowSellPrice(item) === expected, "Revente d'office : 50 % du prix de revente marchand");
    assert(storeLootItem(item) === false, "Réserve pleine : l'objet n'est pas rangé");
    assert(gameState.gold === expected && !gameState.inventory.includes(item), "Réserve pleine : l'objet est revendu d'office (PO créditées)");
    assert(gameState.runStats.overflowSold === 1, "Revente d'office comptée dans la chronique");
    const potion = generateItem({ category: 'consumables', rarityKey: 'commun' });
    assert(storeLootItem(potion) === true && gameState.inventory.includes(potion), "Un consommable se range toujours, réserve pleine ou non");
    gameState.inventory = [];
}

// --- Catalogue ---
{
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    assert(ACHIEVEMENTS.length === 38 && ids.size === 38, "Catalogue : 38 succès (35 + 3 chasseurs de primes), identifiants uniques");
    assert(ACHIEVEMENTS.every(a => a.icon && a.title && a.text && typeof a.check === 'function' && ACHIEVEMENT_TIERS[a.tier]), "Catalogue : chaque succès a icône, titre, texte, palier valide et condition");
    assert(ACHIEVEMENTS.filter(a => a.posthumous).length === 4 && ACHIEVEMENTS.filter(a => a.posthumous).every(a => a.secret), "Catalogue : 4 succès posthumes, tous secrets");
    assert(ACHIEVEMENTS.filter(a => a.tier === 'gold').length === 4, "Catalogue : 4 succès Or (Régicide, Collectionneur, Abysses, Sortie)");
    const fresh = createEmptyRunStats();
    assert(ACHIEVEMENTS.every(a => { try { return a.check(fresh, { type: 'explore' }, { ...gameState, inventory: [], gold: 0, equipment: {}, companion: null, signaturesAwarded: [], hasWon: false, maxInventory: 8 }) === false; } catch (e) { return false; } }),
        "Catalogue : aucun succès débloqué sur une chronique vierge");
    const merged = normalizeRunStats({ kills: 3 });
    assert(merged.kills === 3 && merged.bossKills === 0 && Array.isArray(merged.recentWins), "normalizeRunStats() : complète une chronique ancienne sans perdre ses valeurs");
}

// --- Domination (pour les chasseurs de primes) ---
{
    assert(computeWinEase(0, 100) === 1 && computeWinEase(40, 100) === 0 && computeWinEase(20, 100) === 0.5, "Facilité d'une victoire : 1 sans dégât, 0 à 40 % des PV max");
    assert(computeDominance([{ ease: 1 }, { ease: 1 }]) === 0, "Domination nulle sous 3 victoires");
    assert(computeDominance([{ ease: 1 }, { ease: 0.5 }, { ease: 0 }]) === 0.5, "Domination = moyenne des facilités");
}

// --- Verrou : jamais de succès hors d'une vraie partie ---
{
    resetTransientState();
    gameState.saveEnabled = false;
    recordRunEvent('win', { enemy: { name: "Rat", runTrack: { startDamageTaken: 0, playerAttacks: 1 } }, kind: 'weapon' });
    assert(gameState.runStats.kills === 1, "La chronique compte même hors partie confirmée");
    assert(Object.keys(gameState.achievements).length === 0, "Aucun succès débloqué tant que la partie n'est pas lancée (saveEnabled)");
}

// --- Vraie victoire : chronique + succès + boîte ---
{
    startRealGame();
    const enemy = { name: "Rat de test", hp: 10, maxHp: 10, atk: 1, def: 0, xpReward: 5 };
    initiateCombat(enemy);
    assert(enemy.runTrack && enemy.runTrack.playerAttacks === 0, "initiateCombat() pose le suivi du combat");
    enemy.runTrack.playerAttacks = 1;
    enemy.hp = 0;
    gameState.lastAttackKind = 'unarmed';
    const goldBefore = gameState.gold, invBefore = gameState.inventory.length;
    withRandom(0.99, () => winCombat()); // 0.99 : pas de butin de combat ; boîtes Bronze → potion
    const s = gameState.runStats;
    assert(s.kills === 1 && s.unarmedKills === 1 && s.oneShotKills === 1 && s.flawlessWins === 1, "Victoire : tués, mains nues, un seul coup, sans dégât");
    assert(s.recentWins.length === 1 && s.recentWins[0].ease === 1, "Victoire : facilité enregistrée");
    assert(gameState.achievements.first_kill && gameState.achievements.one_shot, "Succès débloqués : Première victime, Coup de maître");
    assert(gameState.inventory.length === invBefore + 2 && gameState.gold === goldBefore, "Deux boîtes Bronze ouvertes (jet 0,99 → une potion chacune)");
    const invAfter = gameState.inventory.length;
    recordRunEvent('win', { enemy: { name: "Autre", runTrack: { startDamageTaken: 0, playerAttacks: 1 } } });
    assert(gameState.inventory.length === invAfter, "Un succès déjà débloqué ne rapporte jamais une seconde boîte");
    gameState.saveEnabled = false;
}

// --- Boîtes : contenu selon le palier (config.achievementBoxes) ---
{
    startRealGame();
    withRandom(0, () => openAchievementBox('bronze'));
    const g = config.achievementBoxes.goldBase;
    assert(gameState.gold === Math.round(g.min * (1 + g.perFloor * 1)), "Boîte Bronze (jet bas) : PO, fourchette × (1 + 0,15 × étage)");
    startRealGame();
    withRandom(0.99, () => openAchievementBox('bronze'));
    assert(gameState.inventory.length === 1 && gameState.inventory[0].category === 'consumables', "Boîte Bronze (jet haut) : une potion");
    startRealGame();
    withRandom([0.1, 0.5], () => openAchievementBox('silver'));
    assert(gameState.inventory.length === 1 || gameState.spellbook.length === 1, "Boîte Argent (jet bas) : un objet trésor");
    startRealGame();
    withRandom([0.6, 0], () => openAchievementBox('silver'));
    assert(gameState.gold === Math.round(g.min * 1.15 * 2), "Boîte Argent (jet moyen) : double de PO");
    startRealGame();
    withRandom([0.95, 0.99], () => openAchievementBox('silver'));
    assert(gameState.inventory.filter(i => i.category === 'consumables').length === 2, "Boîte Argent (jet haut) : deux potions");
    startRealGame();
    openAchievementBox('gold');
    const items = [...gameState.inventory, ...gameState.spellbook];
    assert(items.length === 1 && ['rare', 'epique', 'legendaire'].includes(items[0].rarityKey), "Boîte Or : un objet Rare minimum");
    assert(gameState.gold >= Math.round(g.min * 1.15 * 3), "Boîte Or : et le triple de PO");
    startRealGame();
    fillReserve();
    withRandom(0.1, () => openAchievementBox('silver'));
    assert(gameState.gold > 0 || gameState.spellbook.length === 1, "Boîte, réserve pleine : l'objet est revendu d'office");
    gameState.inventory = [];
    gameState.saveEnabled = false;
}

// --- Événements de la chronique → succès ---
{
    startRealGame();
    gameState.currentFloor = 6;
    recordRunEvent('floor');
    assert(gameState.achievements.floor3 && gameState.achievements.floor6 && !gameState.achievements.floor9, "Progression : Touriste et Citadin à l'étage 6");
    for (let i = 0; i < 3; i++) recordRunEvent('trap');
    assert(gameState.achievements.traps3, "Jambes de coton : 3 pièges sur un même étage");
    recordRunEvent('trap');
    gameState.currentFloor = 7;
    recordRunEvent('floor');
    assert(gameState.runStats.trapsThisFloor === 0, "Compteur de pièges remis à zéro à chaque étage");
    recordRunEvent('descend', { timeLeft: 3 });
    assert(gameState.achievements.late_descent, "Retardataire chronique : descendre avec moins de 5 H");
    gameState.gold = 1000;
    recordRunEvent('explore');
    assert(gameState.achievements.miser, "Radin : 1 000 PO en poche");
    for (let i = 0; i < 5; i++) recordRunEvent('backfire');
    assert(gameState.achievements.abracadaboom, "Abracadabroum : 5 sorts ratés");
    gameState.runStats.spellsLearned = []; // une boîte Argent ouverte plus haut a pu donner un parchemin
    delete gameState.achievements.bookworm;
    ['A', 'B', 'C', 'D'].forEach(n => recordRunEvent('spellLearned', { item: { spellName: n } }));
    recordRunEvent('spellLearned', { item: { spellName: 'A' } });
    assert(gameState.runStats.spellsLearned.length === 4 && !gameState.achievements.bookworm, "Rat de bibliothèque : un sort déjà appris ne compte pas deux fois");
    recordRunEvent('spellLearned', { item: { spellName: 'E' } });
    assert(gameState.achievements.bookworm, "Rat de bibliothèque : 5 sorts DIFFÉRENTS");
    gameState.equipment.weapon = { name: "Bâton", category: 'weapons', rarityKey: 'camelote', baseDmg: 1 };
    gameState.equipment.armor = { name: "Carton", category: 'armors', rarityKey: 'camelote', baseArmor: 1 };
    recordRunEvent('equip');
    assert(gameState.achievements.junk_style, "Style Camelote : arme ET armure Camelote");
    gameState.saveEnabled = false;
}

// --- Compagnon : succès sociaux, branchés sur les vraies fonctions ---
{
    startRealGame();
    gameState.companion = generateCompanionCandidate(1);
    const junk = generateItem({ category: 'weapons', rarityKey: 'camelote', jitter: false });
    gameState.inventory = [junk];
    giveItemToCompanion(0);
    assert(gameState.achievements.poisoned_gift, "Cadeau empoisonné : offrir de la Camelote à son compagnon");
    gameState.companion.loyalty = 99;
    changeCompanionLoyalty(5);
    assert(gameState.achievements.bff, "Meilleurs amis : loyauté 100");
    dismissCompanion();
    assert(gameState.achievements.sms_breakup, "Rupture par SMS : congédier son compagnon");
    gameState.companion = generateCompanionCandidate(1);
    gameState.companion.loyalty = 0;
    withRandom(0, () => attemptCompanionDeparture());
    assert(gameState.achievements.ghosted, "Ghosté : un compagnon vous quitte");
    gameState.inventory = [];
    gameState.saveEnabled = false;
}

// --- Posthumes : débloqués à la mort, aucune boîte ---
{
    startRealGame();
    const goldBefore = gameState.gold, invBefore = gameState.inventory.length;
    gameState.hp = 0;
    recordRunEvent('death', { cause: 'backfire', weakMob: false });
    assert(gameState.achievements.first_corpse && gameState.achievements.backfire_death, "Mort par backfire : Premier cadavre + Mort par sa propre main");
    assert(!gameState.achievements.weak_mob_death && !gameState.achievements.timeout_death, "Seuls les succès posthumes qui correspondent à la cause");
    assert(gameState.gold === goldBefore && gameState.inventory.length === invBefore, "Boîte posthume : rien n'est livré");
    assert(gameOver.toString().includes("recordRunEvent('death'"), "gameOver() émet l'événement de mort");
    assert(winGame.toString().includes("recordRunEvent('victory')"), "winGame() émet l'événement de victoire");
    gameState.hp = gameState.maxHp;
    recordRunEvent('explore');
    assert(!gameState.achievements.weak_mob_death, "Un succès posthume ne se débloque jamais hors d'une mort");
    gameState.saveEnabled = false;
    if (ui.gameOverOverlay) ui.gameOverOverlay.classList.add('hidden');
}

// --- Affichage ---
{
    startRealGame();
    gameState.achievements = { first_kill: { floor: 2, at: 0 } };
    const html = buildAchievementsListHtml();
    assert(html.includes("Première victime") && html.includes("Étage 2"), "Écran Succès : succès débloqué avec son étage");
    assert(!html.includes("Rupture par SMS") && html.includes("???"), "Écran Succès : secrets verrouillés masqués");
    assert(html.includes("Touriste"), "Écran Succès : succès non secrets verrouillés visibles");
    assert(countUnlockedAchievements() === 1, "Compteur de succès débloqués");
    updateAchievementsButton();
    assert(ui.achievementsCount.innerText === `1/${ACHIEVEMENTS.length}`, "Bouton 🏆 : X/N");
    assert(buildRunAchievementsSummary().includes("Première victime"), "Écrans de fin : succès du run listés");
    gameState.achievements = {};
    assert(restoreSaveForName.toString().includes('normalizeRunStats'), "restoreSaveForName() migre la chronique");
    gameState.saveEnabled = false;
}
