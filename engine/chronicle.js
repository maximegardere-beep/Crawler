// engine/chronicle.js — Chronique de run, succès, chasseurs de primes.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// CHRONIQUE DE RUN ET SUCCÈS (chantier 2 — catalogue pur dans achievements.js, voir NOTES_SUCCES.md)
// ==========================================

// Point d'entrée UNIQUE de la chronique : chaque hook du moteur (victoire, fuite, piège, repos, achat…)
// appelle recordRunEvent(type, data), qui met à jour gameState.runStats puis évalue les succès.
// Les compteurs avancent toujours ; les succès ne se débloquent que dans une vraie partie
// (gameState.saveEnabled, posé une fois le nom du crawler confirmé — jamais pendant l'initialisation
// silencieuse au chargement ni dans les tests qui ne le demandent pas explicitement).
let achievementsEvaluating = false; // Garde anti-réentrance : une boîte ouverte émet elle-même des événements

function recordRunEvent(type, data = {}) {
    if (!gameState.runStats) gameState.runStats = createEmptyRunStats();
    const s = gameState.runStats;
    switch (type) {
        case 'damageTaken':
            s.damageTaken += data.amount || 0;
            break;
        case 'win': {
            const enemy = data.enemy || {};
            const track = enemy.runTrack || {};
            const hpLost = Math.max(0, s.damageTaken - (track.startDamageTaken ?? s.damageTaken));
            s.kills += 1;
            if (enemy.isBoss) s.bossKills += 1;
            if (enemy.isInterim) s.interimKills = (s.interimKills || 0) + 1; // Remplaçant intérimaire vaincu (chantier 15, lot 5)
            else if (typeof isEliteMob === 'function' && isEliteMob(enemy)) s.eliteKills += 1;
            if (data.kind === 'unarmed') s.unarmedKills += 1;
            if (data.kind === 'magic') s.spellKills += 1;
            if (data.kind === 'ranged') s.rangedKills += 1;
            if (track.sneak) s.sneakKills += 1;
            if (track.playerAttacks === 1) s.oneShotKills += 1;
            if (hpLost === 0) s.flawlessWins += 1;
            if (gameState.hp > 0 && gameState.hp <= gameState.maxHp * 0.05) s.clutchWins += 1;
            // Facilité : sans la Période d'essai (chantier 15) — les PV qu'elle a épargnés pendant ce combat sont réajoutés, pour ne pas gonfler la prime des chasseurs.
            const trialAvoided = Math.max(0, (s.trialAvoided || 0) - (track.startTrialAvoided ?? (s.trialAvoided || 0)));
            s.recentWins.push({ ease: computeWinEase(hpLost + trialAvoided, gameState.maxHp) });
            if (s.recentWins.length > DOMINANCE_WINDOW) s.recentWins.splice(0, s.recentWins.length - DOMINANCE_WINDOW);
            break;
        }
        case 'flee': s.flees += 1; break;
        case 'trap': s.trapsThisFloor += 1; break;
        case 'rest': s.rests += 1; break;
        case 'descend':
            if ((data.timeLeft ?? gameState.timeLeft) < 5) s.lateDescents += 1;
            break;
        case 'floor':
            s.trapsThisFloor = 0;
            s.maxFloor = Math.max(s.maxFloor || 1, gameState.currentFloor);
            break;
        case 'purchase': s.shopPurchases += 1; break;
        case 'backfire': s.backfires += 1; break;
        case 'spellLearned': {
            const name = data.item && (data.item.spellName || data.item.name);
            if (name && !s.spellsLearned.includes(name)) s.spellsLearned.push(name);
            break;
        }
        case 'companionLeft': s.companionsLeft += 1; break;
        case 'companionDismissed': s.companionsDismissed += 1; break;
        case 'companionGift':
            if (data.item && data.item.rarityKey === 'camelote') s.junkGifts += 1;
            break;
        case 'overflowSold': s.overflowSold += 1; break;
        case 'classAbility': // capacité de classe jouée (chantier 13)
            s.classAbilities += 1;
            if (data.boss) s.classAbilityBossUses += 1;
            if (data.synergy) s.synergyAbilities += 1;
            break;
        case 'lastStand': s.lastStands += 1; break; // « Increvable » consommé (chantier 13)
        case 'plotArmor': s.plotArmorUses = (s.plotArmorUses || 0) + 1; break; // « Armure de scénario » consommée (chantier 15)
        case 'bounty': s.maxBounty = Math.max(s.maxBounty || 0, data.value || 0); break;
        case 'hunterKilled': s.huntersKilled += 1; break;
        case 'minigame': // épreuve JOUÉE (jamais le jet automatique : il n'a ni mérite ni échec)
            if (data.auto) break;
            s.minigamesPlayed += 1;
            if (data.outcome === 'perfect') {
                s.minigamePerfects += 1;
                s.perfectStreak += 1;
                s.maxPerfectStreak = Math.max(s.maxPerfectStreak, s.perfectStreak);
            } else s.perfectStreak = 0;
            break;
        case 'arcade': // partie conclue à la salle de jeux
            s.arcadeGames += 1;
            if (data.perfectAll) s.arcadePerfectGames += 1;
            s.arcadeNet += (data.payout || 0) - (data.stake || 0);
            if (data.tier === 'lose') s.arcadeLost += data.stake || 0;
            break;
        default: break; // 'explore', 'equip', 'itemStored', 'loyalty', 'death', 'victory'… : simple réévaluation
    }
    evaluateAchievements({ type, ...data });
}

// Rejoue le `check` de chaque succès encore verrouillé. Les succès posthumes ne sont évalués qu'à la mort.
function evaluateAchievements(event) {
    if (!gameState.saveEnabled || achievementsEvaluating) return [];
    if (!gameState.achievements) gameState.achievements = {};
    achievementsEvaluating = true;
    const unlocked = [];
    try {
        ACHIEVEMENTS.forEach(def => {
            if (gameState.achievements[def.id]) return;
            if (def.posthumous && event.type !== 'death') return;
            let ok = false;
            try { ok = !!def.check(gameState.runStats, event, gameState); } catch (e) { ok = false; }
            if (ok) unlocked.push(def);
        });
        unlocked.forEach(def => unlockAchievement(def, event));
    } finally {
        achievementsEvaluating = false;
    }
    if (unlocked.length > 0) {
        showAchievementToast(unlocked);
        updateAchievementsButton();
    }
    return unlocked;
}

// Débloque un succès : l'inscrit dans la sauvegarde du crawler, l'annonce, et ouvre sa boîte — sauf à la
// mort (boîte « livrée à titre posthume », c'est-à-dire à personne).
function unlockAchievement(def, event = {}) {
    gameState.achievements[def.id] = { floor: gameState.currentFloor, at: Date.now() };
    const tier = ACHIEVEMENT_TIERS[def.tier] || ACHIEVEMENT_TIERS.bronze;
    logEvent(`🏆 Succès débloqué : ${def.icon} ${def.title} — ${def.text}`, "success");
    if (def.posthumous || event.type === 'death' || gameState.hp <= 0) {
        logEvent(`${tier.box} Boîte ${tier.label} livrée à titre posthume. Le public apprécie le geste.`, "info");
        return;
    }
    openAchievementBox(def.tier);
}

function rollAchievementGold(mult = 1) {
    const g = config.achievementBoxes.goldBase;
    const base = g.min + Math.floor(Math.random() * (g.max - g.min + 1));
    return Math.max(1, Math.round(base * (1 + g.perFloor * (gameState.currentFloor || 1)) * mult));
}

function giveAchievementPotion() {
    return storeLootItem(generateItem({ category: 'consumables' }), "🎁 Boîte — ");
}

// Ouvre une boîte de succès (chiffres : config.achievementBoxes, validés par l'utilisateur). Tout objet
// passe par addLoot()/storeLootItem() : réserve pleine = revente d'office, comme n'importe quel butin.
function openAchievementBox(tierKey) {
    const box = config.achievementBoxes;
    const tier = ACHIEVEMENT_TIERS[tierKey] || ACHIEVEMENT_TIERS.bronze;
    logEvent(`${tier.box} Vous ouvrez une boîte ${tier.label} de la part de vos sponsors !`, "loot");
    const roll = Math.random() * 100;
    const giveGold = (mult) => {
        const amount = rollAchievementGold(mult);
        gameState.gold += amount;
        logEvent(`🎁 Boîte — ${amount} PO !`, "loot");
        return amount;
    };
    if (tierKey === 'gold') {
        addLoot({ source: 'boss', minRarityKey: 'rare' });
        giveGold(box.gold.goldMult);
    } else if (tierKey === 'silver') {
        if (roll < box.silver.itemChance) addLoot({ source: 'treasure' });
        else if (roll < box.silver.itemChance + box.silver.goldChance) giveGold(box.silver.goldMult);
        else { giveAchievementPotion(); giveAchievementPotion(); }
    } else {
        if (roll < box.bronze.goldChance) giveGold(1);
        else giveAchievementPotion();
    }
    updateInventoryUI();
}

// --- Affichage ---

// Annonce non bloquante, en haut de l'écran, quelques secondes (jamais un choix à faire).
let achievementToastTimer = null;
function showAchievementToast(unlocked) {
    if (!ui.achievementToast || !unlocked.length) return;
    const last = unlocked[unlocked.length - 1];
    ui.achievementToast.innerHTML = unlocked.length > 1
        ? `🏆 ${unlocked.length} succès débloqués ! <span class="opacity-80">${unlocked.map(d => d.icon).join(' ')}</span>`
        : `🏆 Succès débloqué : ${last.icon} ${last.title}`;
    ui.achievementToast.classList.remove('hidden');
    if (achievementToastTimer) clearTimeout(achievementToastTimer);
    achievementToastTimer = setTimeout(() => ui.achievementToast.classList.add('hidden'), 3500);
}

function countUnlockedAchievements() {
    return Object.keys(gameState.achievements || {}).filter(id => getAchievementById(id)).length;
}

function updateAchievementsButton() {
    if (ui.achievementsCount) ui.achievementsCount.innerText = `${countUnlockedAchievements()}/${ACHIEVEMENTS.length}`;
}

// Liste des succès (HTML pur) : débloqués d'abord, puis verrouillés ; un secret verrouillé reste « ??? ».
function buildAchievementsListHtml(unlockedMap = gameState.achievements || {}) {
    const sorted = [...ACHIEVEMENTS].sort((a, b) => (unlockedMap[b.id] ? 1 : 0) - (unlockedMap[a.id] ? 1 : 0));
    return sorted.map(def => {
        const got = unlockedMap[def.id];
        const tier = ACHIEVEMENT_TIERS[def.tier] || ACHIEVEMENT_TIERS.bronze;
        const hidden = !got && def.secret;
        const title = hidden ? '???' : def.title;
        const text = hidden ? 'Succès secret.' : def.text;
        return `<li class="flex gap-2 items-start rounded border px-2 py-1.5 ${got ? 'border-amber-700/70 bg-amber-950/20' : 'border-gray-800 bg-gray-950/40 opacity-60'}">
            <span class="text-lg leading-none shrink-0">${hidden ? '❔' : def.icon}</span>
            <span class="min-w-0 flex-1">
                <span class="block font-bold ${got ? 'text-amber-200' : 'text-gray-400'}">${title} <span class="text-[9px] font-normal" style="color:${tier.color}">${tier.box} ${tier.label}</span></span>
                <span class="block text-[10px] text-gray-400">${text}</span>
                ${got ? `<span class="block text-[9px] text-gray-500">Étage ${got.floor}</span>` : ''}
            </span>
        </li>`;
    }).join('');
}

function openAchievementsScreen() {
    if (!ui.achievementsOverlay) return;
    ui.achievementsTitleCount.innerText = `${countUnlockedAchievements()}/${ACHIEVEMENTS.length}`;
    ui.achievementsList.innerHTML = buildAchievementsListHtml();
    ui.achievementsOverlay.classList.remove('hidden');
}

function closeAchievementsScreen() {
    if (ui.achievementsOverlay) ui.achievementsOverlay.classList.add('hidden');
}

// Succès du run affichés sur les écrans de fin (icônes + titres).
function buildRunAchievementsSummary() {
    const got = ACHIEVEMENTS.filter(def => (gameState.achievements || {})[def.id]);
    if (got.length === 0) return "Aucun succès. Même pas celui de la mort ? Impressionnant.";
    return `🏆 ${got.length}/${ACHIEVEMENTS.length} succès : ` + got.map(def => `${def.icon} ${def.title}`).join(' · ');
}

// ==========================================
// CHASSEURS DE PRIMES (chantier 3 — voir NOTES_CHASSEURS.md ; chiffres dans config.bounty)
// ==========================================
// La prime (gameState.bounty.value, 0-100) monte avec les victoires FACILES (facilité calculée par la
// chronique, voir computeWinEase()) et ne redescend QU'EN tuant un chasseur (choix de l'utilisateur).
// Dès le palier « chasseurs », une partie des combats d'exploration et des embuscades de trajet est
// remplacée par un chasseur calé sur le joueur (generateBountyHunter(), generator.js).

function createEmptyBounty() {
    return { value: 0, huntersKilled: 0, combatsSinceHunter: 99 };
}

// Palier de prime : 0 rien, 1 avis de recherche, 2 chasseurs en maraude, 3 escouade.
function getBountyTier(value) {
    const t = config.bounty.tiers;
    if (value >= t.squad) return 3;
    if (value >= t.hunters) return 2;
    if (value >= t.wanted) return 1;
    return 0;
}

const BOUNTY_TIER_MESSAGES = [
    null,
    "🎯 AVIS DE RECHERCHE : votre tête est mise à prix. Les gobelins chasseurs de primes commencent à prendre des notes.",
    "🎯 Votre prime attire les chasseurs : des gobelins armés rôdent désormais sur votre piste.",
    "🎯 ENNEMI PUBLIC N°1 : les chasseurs se déplacent maintenant en escouade."
];

// Profil de combat du joueur, sur lequel les chasseurs se calent : PV max, meilleure ATQ effective
// (arme, arme à distance ou sort équipé), DEF effective (armure, Garde du compagnon comprises).
function getPlayerCombatProfile() {
    const eq = gameState.equipment || {};
    const bonus = Math.max(
        eq.weapon ? (eq.weapon.baseDmg || 0) : 0,
        eq.ranged ? (eq.ranged.baseDmg || 0) : 0,
        eq.spell ? (eq.spell.baseDmg || 0) : 0
    );
    return { maxHp: gameState.maxHp, atk: gameState.atk + bonus, def: getEffectiveDef() };
}

function spawnBountyHunter(variantKey, bountyValue = gameState.bounty.value) {
    return generateBountyHunter({ variantKey, player: getPlayerCombatProfile(), bountyValue, floor: gameState.currentFloor });
}

// Remplace éventuellement le prochain combat par un chasseur (exploration et embuscades de trajet).
// Jamais sous le palier « chasseurs », jamais deux de suite (minCombatsBetween victoires d'écart) ; au
// palier « escouade », un Chef d'escouade suivra (gameState.pendingBountySquad, voir onBountyVictory()).
function maybeSpawnBountyHunter() {
    const b = gameState.bounty;
    const tier = getBountyTier(b.value);
    if (tier < 2 || b.combatsSinceHunter < config.bounty.minCombatsBetween) return null;
    // Avenues (chantier 5) : chasseurs deux fois plus fréquents (ZONE_TYPES.avenue.hunterMult, floorgen.js).
    const zone = gameState.floorMap ? (ZONE_TYPES[roomZone(currentFloorRoom())] || ZONE_TYPES.block) : ZONE_TYPES.block;
    const chance = (tier >= 3 ? config.bounty.encounterChance.squad : config.bounty.encounterChance.hunters) * zone.hunterMult;
    if (Math.random() * 100 >= chance) return null;
    b.combatsSinceHunter = 0;
    gameState.pendingBountySquad = tier >= 3 ? 1 : 0;
    const hunter = spawnBountyHunter();
    logEvent(`🎯 [${hunter.name}] vous a retrouvé${tier >= 3 ? ", escouade en renfort" : ""} ! Votre prime de ${b.value} l'intéresse beaucoup.`, "danger");
    return hunter;
}

// Fait varier la prime (bornée 0..max). Au franchissement d'un palier vers le haut : alerte, et affiche
// l'« AVIS DE RECHERCHE » sur la scène d'exploration (jamais en plein combat).
function addBounty(amount) {
    const b = gameState.bounty;
    if (!amount) return 0;
    const before = b.value;
    b.value = Math.max(0, Math.min(config.bounty.max, before + amount));
    const oldTier = getBountyTier(before), newTier = getBountyTier(b.value);
    if (newTier > oldTier) {
        logEvent(BOUNTY_TIER_MESSAGES[newTier], "danger");
        if (!gameState.inCombat) setSceneHeader('🎯', 'Avis de Recherche', 'Prime', { key: 'wantedPoster', value: b.value });
    }
    recordRunEvent('bounty', { value: b.value });
    updateBountyUI();
    return b.value - before;
}

// Après chaque victoire (winCombat()) : un chasseur tué paie sa prime et la remet à 0 (puis l'escouade
// enchaîne son Chef s'il en reste un) ; toute autre victoire fait monter la prime selon sa facilité.
// Renvoie true si un nouveau combat vient d'être lancé (winCombat() doit alors s'arrêter là).
function onBountyVictory(enemy) {
    const b = gameState.bounty;
    const cfg = config.bounty;
    if (enemy && enemy.isBountyHunter) {
        const reward = Math.round((enemy.bountyValue || 0) * gameState.currentFloor * cfg.rewardGoldPerPoint);
        gameState.gold += reward;
        b.huntersKilled += 1;
        b.value = 0;
        logEvent(`🎯 Chasseur neutralisé : vous empochez sa prime (${reward} PO). Votre tête ne vaut plus rien… pour l'instant.`, "success");
        addLoot({ source: 'elite' });
        recordRunEvent('hunterKilled');
        updateBountyUI();
        if (gameState.pendingBountySquad > 0) {
            gameState.pendingBountySquad -= 1;
            const chief = spawnBountyHunter('chief', enemy.bountyValue);
            logEvent(`🎯 [${chief.name}] surgit pour venger son équipier !`, "danger");
            initiateCombat(chief);
            return true;
        }
        return false;
    }
    b.combatsSinceHunter += 1;
    const last = gameState.runStats && gameState.runStats.recentWins[gameState.runStats.recentWins.length - 1];
    const ease = last ? last.ease : 0;
    const gain = ease >= cfg.easyEase ? cfg.gainEasy : (ease >= cfg.mediumEase ? cfg.gainMedium : 0);
    if (gain > 0) addBounty(gain);
    return false;
}

// Badge 🎯 de l'en-tête : masqué sans prime, couleur selon le palier.
function updateBountyUI() {
    if (!ui.bountyStatus) return;
    const value = gameState.bounty ? gameState.bounty.value : 0;
    ui.bountyStatus.classList.toggle('hidden', value <= 0);
    if (value <= 0) return;
    const tier = getBountyTier(value);
    const colors = ['#a8a29e', '#facc15', '#fb923c', '#ef4444'];
    const labels = ["Prime", "Avis de recherche", "Chasseurs en maraude", "Escouade"];
    ui.bountyStatus.innerText = `🎯 ${value}`;
    ui.bountyStatus.style.color = colors[tier];
    ui.bountyStatus.style.borderColor = colors[tier];
    ui.bountyStatus.title = `Prime ${value}/100 — ${labels[tier]}. Elle monte avec vos victoires faciles et ne retombe qu'en tuant un chasseur de primes.`;
}
