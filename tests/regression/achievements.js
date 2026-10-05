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
    assert(ACHIEVEMENTS.length === 60 && ids.size === 60, "Catalogue : 60 succès (35 + 3 chasseurs de primes + 2 DeathWatch + 7 mini-jeux + 6 origines + 2 début de partie + 5 Gorgoth), identifiants uniques");
    assert(ACHIEVEMENTS.every(a => a.icon && a.title && a.text && typeof a.check === 'function' && ACHIEVEMENT_TIERS[a.tier]), "Catalogue : chaque succès a icône, titre, texte, palier valide et condition");
    assert(ACHIEVEMENTS.filter(a => a.posthumous).length === 4 && ACHIEVEMENTS.filter(a => a.posthumous).every(a => a.secret), "Catalogue : 4 succès posthumes, tous secrets");
    assert(ACHIEVEMENTS.filter(a => a.tier === 'gold').length === 7, "Catalogue : 7 succès Or (Régicide, Collectionneur, Abysses, Sortie, Main de chirurgien, La banque gagne rarement, Résiliation du bail)");
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

// --- Mini-jeux (chantier 6, lot final) : chronique et succès ---
{
    resetTransientState();
    gameState.runStats = createEmptyRunStats();
    gameState.saveEnabled = true;
    gameState.achievements = {};
    const s = () => gameState.runStats;
    recordRunEvent('minigame', { kind: 'timing', outcome: 'perfect', auto: true });
    assert(s().minigamesPlayed === 0 && s().minigamePerfects === 0, "Chronique : un jet automatique n'est ni joué ni compté");
    recordRunEvent('minigame', { kind: 'timing', outcome: 'success' });
    assert(s().minigamesPlayed === 1 && s().minigamePerfects === 0 && s().perfectStreak === 0, "Chronique : une épreuve jouée est comptée, sans Parfait");
    for (let i = 0; i < 4; i++) recordRunEvent('minigame', { kind: 'timing', outcome: 'perfect' });
    assert(s().minigamePerfects === 4 && s().perfectStreak === 4 && s().maxPerfectStreak === 4 && gameState.achievements.perfect_first && !gameState.achievements.perfect_streak5, "Chronique : série de 4 Parfaits, premier Parfait débloqué");
    recordRunEvent('minigame', { kind: 'timing', outcome: 'perfect', auto: true });
    recordRunEvent('minigame', { kind: 'timing', outcome: 'perfect' });
    assert(s().maxPerfectStreak === 5 && gameState.achievements.perfect_streak5, "Chronique : le jet automatique n'interrompt pas la série ; 5 d'affilée = Métronome");
    recordRunEvent('minigame', { kind: 'timing', outcome: 'fail' });
    assert(s().perfectStreak === 0 && s().maxPerfectStreak === 5, "Chronique : un Raté remet la série à zéro, le record reste");
    for (let i = 0; i < 20; i++) recordRunEvent('minigame', { kind: 'timing', outcome: 'perfect' });
    assert(s().minigamePerfects === 25 && gameState.achievements.perfect25, "Main de chirurgien : 25 Parfaits");

    recordRunEvent('arcade', { game: 'safe', stake: 100, payout: 0, tier: 'lose', perfectAll: false });
    assert(s().arcadeGames === 1 && s().arcadeLost === 100 && s().arcadeNet === -100 && gameState.achievements.arcade_first && !gameState.achievements.arcade_broke, "Salle de jeux : mise perdue comptée, premier jeu débloqué");
    recordRunEvent('arcade', { game: 'safe', stake: 100, payout: 0, tier: 'lose', perfectAll: false });
    assert(gameState.achievements.arcade_broke, "Tout sur le rouge : 200 PO de mises perdues");
    recordRunEvent('arcade', { game: 'range', stake: 100, payout: 300, tier: 'excellent', perfectAll: true });
    assert(s().arcadePerfectGames === 1 && s().arcadeNet === 0 && gameState.achievements.arcade_perfect && !gameState.achievements.arcade_rich, "Partie parfaite comptée, gain net cumulé");
    recordRunEvent('arcade', { game: 'range', stake: 300, payout: 900, tier: 'excellent', perfectAll: false });
    assert(s().arcadeNet === 600 && gameState.achievements.arcade_rich, "La banque gagne rarement : 500 PO de gain net");
    assert(ACHIEVEMENTS.find(a => a.id === 'arcade_broke').secret === true, "Tout sur le rouge est un succès secret");

    // Branchements réels : une épreuve jouée (interface simulée) et une partie de salle de jeux écrivent la chronique.
    gameState.runStats = createEmptyRunStats();
    global.requestAnimationFrame = () => 1;
    setMinigameMode('play');
    startMinigame('timing', () => {});
    finishMinigame('perfect');
    assert(gameState.runStats.minigamesPlayed === 1 && gameState.runStats.minigamePerfects === 1, "Hôte d'épreuve : chaque épreuve jouée écrit la chronique");
    startMinigame('timing', () => {});
    skipMinigame();
    assert(gameState.runStats.minigamesPlayed === 1, "Passer (jet automatique) n'écrit pas la chronique d'une épreuve jouée");
    delete global.requestAnimationFrame; setMinigameMode('auto');
    resetTransientState();
}

// --- Gorgoth le Concierge (chantier 17, lot 9) : chronique et succès ---
{
    const fresh = createEmptyRunStats();
    assert(fresh.demonEncounters === 0 && fresh.demonKnockouts === 0 && fresh.demonExpulsions === 0 && fresh.demonScarMax === 0 && fresh.demonArmoryPicks === 0 && fresh.demonFinalSlain === 0,
        "Gorgoth : compteurs de chronique à 0 sur un run vierge");
    const old = normalizeRunStats({ kills: 2 });
    assert(old.demonKnockouts === 0 && old.demonScarsByStyle && old.demonScarsByStyle.magic === 0, "Gorgoth : une ancienne chronique reçoit les nouveaux compteurs");
    const partial = normalizeRunStats({ demonScarsByStyle: { ranged: 2 } });
    assert(partial.demonScarsByStyle.ranged === 2 && partial.demonScarsByStyle.melee === 0, "Gorgoth : Cicatrices partielles complétées sans perte");

    startRealGame();
    gameState.currentFloor = 4;
    recordRunEvent('demonEncounter');
    assert(gameState.runStats.demonEncounters === 1, "demonEncounter : rencontre comptée");
    assert(!gameState.achievements.demon_ko1, "(contrôle) aucune mise au tapis encore");
    recordRunEvent('demonKnockout', { scarStyle: 'ranged', final: false });
    const s = gameState.runStats;
    assert(s.demonKnockouts === 1 && s.demonScarsByStyle.ranged === 1 && s.demonScarMax === 1 && s.demonLastKnockoutFloor === 4, "demonKnockout : mise au tapis, cran de Cicatrice du style, étage noté");
    assert(!!gameState.achievements.demon_ko1 && !gameState.achievements.demon_ko3, "1re mise au tapis : « Copropriétaire », pas encore « Récidiviste »");
    recordRunEvent('demonKnockout', { scarStyle: 'ranged', final: false });
    assert(!gameState.achievements.demon_scar3, "Cicatrice au cran 2 : « Tu l'as vexé » pas encore");
    recordRunEvent('demonKnockout', { scarStyle: 'ranged', final: false });
    assert(s.demonKnockouts === 3 && s.demonScarsByStyle.ranged === 3 && s.demonScarMax === 3, "Trois mises au tapis à distance : Cicatrice au cran 3");
    assert(!!gameState.achievements.demon_ko3 && !!gameState.achievements.demon_scar3, "3 mises au tapis : « Récidiviste » et « Tu l'as vexé »");
    recordRunEvent('demonKnockout', { scarStyle: 'ranged', final: false });
    assert(s.demonScarsByStyle.ranged === 3 && s.demonScarMax === 3, "Cicatrice plafonnée au cran 3");
    recordRunEvent('demonKnockout', { scarStyle: 'inconnu', final: false });
    assert(s.demonKnockouts === 5 && Object.values(s.demonScarsByStyle).reduce((a, b) => a + b, 0) === 3, "Style inconnu : mise au tapis comptée, aucune Cicatrice");

    assert(!gameState.achievements.demon_expelled, "(contrôle) jamais expulsé");
    recordRunEvent('demonExpelled');
    assert(s.demonExpulsions === 1 && s.demonLastExpelledFloor === 4 && !!gameState.achievements.demon_expelled, "demonExpelled : expulsion comptée, « Rendez-vous manqué » (secret)");
    assert(getAchievementById('demon_expelled').secret && !getAchievementById('demon_expelled').posthumous, "« Rendez-vous manqué » est secret mais jamais posthume (l'expulsion n'est pas la mort)");

    recordRunEvent('demonArmory', { itemKey: 'blade', kept: false });
    assert(s.demonArmoryPicks === 0, "demonArmory sans objet emporté : rien de compté");
    recordRunEvent('demonArmory', { itemKey: 'rulebook', kept: true });
    assert(s.demonArmoryPicks === 1, "demonArmory : objet démoniaque emporté compté");

    assert(!gameState.achievements.demon_final, "(contrôle) forme finale jamais vaincue");
    const koBefore = s.demonKnockouts;
    gameState.currentFloor = 18;
    recordRunEvent('demonKnockout', { scarStyle: 'magic', final: true });
    assert(s.demonFinalSlain === 1 && s.demonKnockouts === koBefore && s.demonScarsByStyle.magic === 0, "Victoire finale : comptée à part, ni mise au tapis ni Cicatrice");
    assert(!!gameState.achievements.demon_final && getAchievementById('demon_final').tier === 'gold', "Forme finale vaincue : « Résiliation du bail » (Or)");

    // Cicatrices persistantes (lot 2) : le cran le plus haut est repris s'il existe déjà dans gameState.demon.
    startRealGame();
    const savedDemon = gameState.demon;
    gameState.demon = { encounters: 3, knockouts: 2, expulsions: 0, scars: { melee: 3, ranged: 0, magic: 0, unarmed: 0 }, lastFloorFought: 6 };
    recordRunEvent('demonKnockout', { scarStyle: 'magic', final: false });
    assert(gameState.runStats.demonScarMax === 3 && !!gameState.achievements.demon_scar3, "Cicatrice déjà au cran 3 dans gameState.demon : « Tu l'as vexé »");
    if (savedDemon === undefined) delete gameState.demon; else gameState.demon = savedDemon;
    resetTransientState();
}
