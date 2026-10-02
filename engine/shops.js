// engine/shops.js — Villes spécialisées (marchand/professeur) et salle de jeux.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// VILLES SPÉCIALISÉES (marchand/professeur — voir generateUrbanFloorMap())
// ==========================================
const SHOP_CATEGORY_LABELS = { weapons: "Armes", ranged: "Armes à distance", armors: "Armures", scrolls: "Magie (parchemins)" };
const SHOP_MARKUP = 2.5; // Prix d'achat = valeur × ce multiplicateur (voir SELL_VALUE_RATIO pour l'inverse)
const TRAINER_COST_PER_LEVEL = 20; // Coût = ce montant × le niveau ACTUEL de la compétence

// Stock FIXE d'un marchand (3 objets de sa spécialité, générés UNE seule fois à la première visite —
// voir triggerShopEncounter()), avec une puissance proportionnelle à l'étage courant comme le reste
// du loot (voir rollLootRarity()). Chaque objet reçoit un prix d'achat dérivé de sa valeur (getItemValue()).
function generateShopStock(specialty) {
    const stock = [];
    // ECONOMIE_AUSTERE (anomalies.js) : remise fixe sur le prix d'achat, appliquée une fois à la
    // génération du stock (jamais régénéré, voir commentaire ci-dessus) — cohérent avec le fait que le
    // stock appartient à l'anomalie de CET étage précis.
    const discount = 1 - (gameState.anomalyEffects.shopDiscountPct || 0);
    for (let i = 0; i < 3; i++) {
        const item = generateItem({ source: 'explore', category: specialty, familyMult: itemBalance.shopFamilyBoost });
        item.price = Math.max(1, Math.round(getItemValue(item) * SHOP_MARKUP * discount));
        stock.push(item);
    }
    return stock;
}

// Présente l'écran marchand/professeur d'une ville spécialisée — à l'entrée de sa salle (enterUrbanRoom()).
// Bloque les autres actions (isActionBlocked()) le temps de la visite, comme un choix de boss ou de
// furtivité, pour que la Carte Urbaine se masque et laisse place à cet écran (voir updateUI()).
function triggerShopEncounter(city) {
    if (city.role === 'merchant' && !city.stock) {
        city.stock = generateShopStock(city.specialty);
    }
    gameState.shopChoicePending = true;
    gameState.pendingShopCityId = city.id;
    const isMerchant = city.role === 'merchant';

    setSceneHeader(isMerchant ? '🛒' : '🎓', city.name, isMerchant ? 'Marchand' : 'Professeur');
    logEvent(
        isMerchant
            ? `Vous entrez dans l'échoppe de ${city.name}, spécialisée en ${SHOP_CATEGORY_LABELS[city.specialty]}.`
            : `Vous trouvez le professeur de ${city.name}, spécialisé en ${skillLabel(city.specialty)}.`,
        "info"
    );
    ui.shopZone.classList.remove('hidden');
    updateShopUI();
    updateUI();
}

// Achète un objet du stock du marchand actuellement visité : déduit le prix, retire l'objet du
// stock (jamais reconstitué), et l'ajoute à l'inventaire (ou au grimoire pour un parchemin) — même
// routage que addLoot(), la réserve d'équipement limitée s'applique identiquement.
function buyShopItem(stockIndex) {
    if (!gameState.pendingShopCityId) return;
    const city = urbanCityById(gameState.pendingShopCityId);
    if (!city || !city.stock) return;
    const item = city.stock[stockIndex];
    if (!item) return;
    if (gameState.gold < item.price) {
        logEvent("Pas assez de PO pour cet achat.", "danger");
        return;
    }

    if (item.category === 'scrolls') {
        gameState.gold -= item.price;
        city.stock.splice(stockIndex, 1);
        gameState.spellbook.push(item);
        logEvent(`Vous achetez [${formatItemDisplayName(item)}] pour ${item.price} PO.`, "success");
        updateSpellbookUI();
        recordRunEvent('spellLearned', { item });
    } else {
        const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
        if (equipmentCount >= gameState.maxInventory) {
            logEvent("Votre réserve d'équipement est pleine !", "danger");
            return;
        }
        gameState.gold -= item.price;
        city.stock.splice(stockIndex, 1);
        gameState.inventory.push(item);
        logEvent(`Vous achetez [${formatItemDisplayName(item)}] pour ${item.price} PO.`, "success");
        updateInventoryUI();
    }
    recordRunEvent('purchase', { item });
    updateUI();
    updateShopUI();
}

// Paie pour gagner directement assez d'XP afin de franchir le prochain niveau de la compétence
// spécialisée du professeur — "payer pour s'entraîner" plutôt que le grind combat habituel.
function trainSkill() {
    if (!gameState.pendingShopCityId) return;
    const city = urbanCityById(gameState.pendingShopCityId);
    if (!city || city.role !== 'trainer') return;
    const skill = gameState.skills[city.specialty];
    const cost = TRAINER_COST_PER_LEVEL * skill.level;
    if (gameState.gold < cost) {
        logEvent("Pas assez de PO pour cette formation.", "danger");
        return;
    }

    gameState.gold -= cost;
    const xpNeeded = skill.xpToNext - skill.xp;
    logEvent(`Vous payez ${cost} PO pour une formation intensive en ${skillLabel(city.specialty)}.`, "success");
    gainSkillXp(city.specialty, xpNeeded);
    updateUI();
    updateShopUI();
}

// Referme l'écran marchand/professeur et rend la main normalement (Carte Urbaine, actions standards).
function leaveShop() {
    if (gameState.arcadeSession) return; // une partie est en cours : on la termine d'abord
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    gameState.pendingArcadeCityId = null;
    ui.shopZone.classList.add('hidden');
    updateUI();
}

// Reconstruit le contenu dynamique de l'écran marchand/professeur (stock/prix, ou compétence à
// former) selon le rôle de la ville actuellement visitée — n'affiche rien si aucune n'est en cours.
function updateShopUI() {
    if (!ui.shopZone) return;
    if (gameState.pendingArcadeCityId) { updateArcadeUI(); return; }
    if (!gameState.pendingShopCityId) return;
    const city = urbanCityById(gameState.pendingShopCityId);
    if (!city) return;

    ui.shopArcadeContent.classList.add('hidden');
    ui.shopArcadeContent.classList.remove('flex');
    const isMerchant = city.role === 'merchant';
    ui.shopMerchantContent.classList.toggle('hidden', !isMerchant);
    ui.shopMerchantContent.classList.toggle('flex', isMerchant);
    ui.shopTrainerContent.classList.toggle('hidden', isMerchant);
    ui.shopTrainerContent.classList.toggle('flex', !isMerchant);
    renderScene(isMerchant ? 'merchant' : 'trainer');

    if (isMerchant) {
        ui.shopStockList.innerHTML = "";
        if (city.stock.length === 0) {
            const empty = document.createElement('p');
            empty.className = "text-[10px] text-gray-600 italic";
            empty.innerText = "Stock épuisé.";
            ui.shopStockList.appendChild(empty);
        }
        city.stock.forEach((item, index) => {
            const row = document.createElement('button');
            const affordable = gameState.gold >= item.price;
            row.className = "w-full flex justify-between items-center gap-1 px-2 py-1.5 bg-gray-900/80 border border-gray-800 rounded text-[10px] text-gray-300 hover:border-yellow-600 hover:bg-yellow-950/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-800 disabled:hover:bg-gray-900/80";
            // Jamais désactivée : un objet trop cher reste inspectable (le bouton Acheter, lui, est grisé).
            if (!affordable) row.classList.add('opacity-60');
            row.innerHTML = `<span class="flex items-center gap-1.5 min-w-0">${itemIconSvg(item, 24)}<span class="truncate">${formatItemDisplayName(item)}</span></span><span class="text-yellow-400 shrink-0">${item.price} PO</span>`;
            row.addEventListener('click', () => openItemInspect(item, {
                priceLine: `Prix : ${item.price} PO (vous avez ${gameState.gold} PO)`,
                actions: [{ label: `Acheter — ${item.price} PO`, disabled: !affordable, onClick: () => buyShopItem(index) }]
            }));
            ui.shopStockList.appendChild(row);
        });

        ui.shopSellList.innerHTML = "";
        const sellable = gameState.inventory;
        if (sellable.length === 0) {
            const empty = document.createElement('p');
            empty.className = "text-[10px] text-gray-600 italic";
            empty.innerText = "Rien à vendre pour l'instant.";
            ui.shopSellList.appendChild(empty);
        }
        sellable.forEach((item, index) => {
            const price = getSellPrice(item);
            const row = document.createElement('button');
            row.className = "w-full flex justify-between items-center gap-1 px-2 py-1.5 bg-gray-900/80 border border-gray-800 rounded text-[10px] text-gray-300 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all cursor-pointer";
            row.innerHTML = `<span class="flex items-center gap-1.5 min-w-0">${itemIconSvg(item, 24)}<span class="truncate">${formatItemDisplayName(item)}</span></span><span class="text-emerald-400 shrink-0">+${price} PO</span>`;
            row.addEventListener('click', () => openItemInspect(item, {
                actions: [{ label: `Vendre — +${price} PO`, tone: 'good', onClick: () => { sellItem(index); updateShopUI(); } }]
            }));
            ui.shopSellList.appendChild(row);
        });

        // Vente de parchemins (chantier "QoL/équilibrage", Chantier D) : même présentation que la
        // vente d'inventaire ci-dessus, mais sur gameState.spellbook via sellSpell(), regroupée par sort
        // comme le grimoire (groupSpellbook()) avec une ligne — donc une vente — par exemplaire. L'équipé
        // (gameState.equipment.spell) n'y figure structurellement jamais (voir equipSpell()).
        ui.shopSellSpellsList.innerHTML = "";
        const spellGroups = groupSpellbook(gameState.spellbook);
        if (spellGroups.length === 0) {
            const empty = document.createElement('p');
            empty.className = "text-[10px] text-gray-600 italic";
            empty.innerText = "Aucun parchemin à vendre pour l'instant.";
            ui.shopSellSpellsList.appendChild(empty);
        }
        spellGroups.forEach(group => {
            const header = document.createElement('p');
            header.className = "text-[10px] font-bold text-gray-400 pt-1";
            header.innerText = `${group.icon || '✨'} ${group.spellName}`;
            ui.shopSellSpellsList.appendChild(header);
            group.copies.forEach(({ spell, index }) => {
                const price = getSellPrice(spell);
                const row = document.createElement('button');
                row.className = "w-full flex justify-between items-center gap-1 px-2 py-1.5 bg-gray-900/80 border border-gray-800 rounded text-[10px] text-gray-300 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all cursor-pointer";
                row.innerHTML = `<span class="flex items-center gap-2 min-w-0"><span class="font-bold uppercase text-[9px] shrink-0" style="color:${spell.rarityColor || '#9ca3af'}">${spell.rarity || ''}</span><span class="truncate text-gray-400">${spellCopyStats(spell)}</span></span><span class="text-emerald-400 shrink-0">+${price} PO</span>`;
                row.addEventListener('click', () => openItemInspect(spell, {
                    actions: [{ label: `Vendre — +${price} PO`, tone: 'good', onClick: () => { sellSpell(index); updateShopUI(); } }]
                }));
                ui.shopSellSpellsList.appendChild(row);
            });
        });
    } else {
        const skill = gameState.skills[city.specialty];
        const cost = TRAINER_COST_PER_LEVEL * skill.level;
        ui.shopTrainerInfo.innerText = `${skillLabel(city.specialty)} — Niveau ${skill.level}. Formation : ${cost} PO (niveau suivant garanti).`;
        ui.btnTrainSkill.disabled = gameState.gold < cost;
        ui.btnTrainSkill.classList.toggle('opacity-40', gameState.gold < cost);
        ui.btnTrainSkill.classList.toggle('cursor-not-allowed', gameState.gold < cost);
    }
}

// ---------- Salle de jeux (chantier 6, V4 — voir NOTES_MINIJEUX.md) ----------
// Quatre jeux d'argent (ARCADE_GAMES, minigames.js) : une partie = quelques manches, chacune une épreuve existante
// lancée par startMinigame(). Mise libre (plafonnée, arcadeMaxStake()), prélevée avant la partie ; 1 H par partie ; gain =
// mise × multiplicateur du palier ; un score excellent donne aussi de l'XP de compétence, une partie entièrement Parfaite un
// objet. Parties illimitées. Réutilise le blocage de la boutique (shopChoicePending) : on joue jusqu'à « Partir ».
let arcadeMessage = { text: "", tone: "info" };
const ARCADE_PIPS = { perfect: '🟡', success: '🟢', fail: '🔴' };

function arcadeSetMessage(text, tone = 'info') {
    arcadeMessage = { text, tone };
    if (ui.arcadeMessage) {
        ui.arcadeMessage.innerText = text;
        ui.arcadeMessage.className = `text-[11px] min-h-[1.5rem] ${tone === 'danger' ? 'text-red-400' : tone === 'success' ? 'text-emerald-300' : 'text-gray-300'}`;
    }
}

function triggerArcade(city) {
    gameState.shopChoicePending = true;
    gameState.pendingShopCityId = null;
    gameState.pendingArcadeCityId = city.id;
    gameState.arcadeSession = null;
    arcadeMessage = { text: "", tone: "info" };
    city.arcadeVisited = true;
    setSceneHeader('🎰', city.name, 'Salle de jeux');
    logEvent(`Les bornes clignotent dans la salle de jeux de ${city.name}. Ici, on mise ses PO sur son adresse — et le Donjon encaisse le reste.`, "info");
    ui.shopZone.classList.remove('hidden');
    updateShopUI();
    updateUI();
}

function arcadeSkillLevel(skillKey) {
    const skill = gameState.skills && gameState.skills[skillKey];
    return skill ? skill.level : 1;
}

// Lit la mise saisie (champ numérique) et la borne.
function arcadeReadStake() {
    return arcadeCheckStake(ui.arcadeStake ? ui.arcadeStake.value : 0, gameState.currentFloor, gameState.gold);
}

function setArcadeStakePreset(kind) {
    if (!ui.arcadeStake) return;
    const max = arcadeMaxStake(gameState.currentFloor, gameState.gold);
    const v = kind === 'min' ? ARCADE_SETTINGS.minStake : kind === 'half' ? Math.max(ARCADE_SETTINGS.minStake, Math.floor(max / 2)) : max;
    ui.arcadeStake.value = String(Math.min(Math.max(v, ARCADE_SETTINGS.minStake), Math.max(max, ARCADE_SETTINGS.minStake)));
    updateArcadeUI();
}

function updateArcadeUI() {
    if (!ui.shopArcadeContent || !gameState.pendingArcadeCityId) return;
    ui.shopMerchantContent.classList.add('hidden');
    ui.shopMerchantContent.classList.remove('flex');
    ui.shopTrainerContent.classList.add('hidden');
    ui.shopTrainerContent.classList.remove('flex');
    ui.shopArcadeContent.classList.remove('hidden');
    ui.shopArcadeContent.classList.add('flex');
    renderScene('arcade');
    const busy = !!gameState.arcadeSession;
    const max = arcadeMaxStake(gameState.currentFloor, gameState.gold);
    const check = arcadeReadStake();
    const timeOk = arcadeCanPlayTime(gameState.timeLeft);
    ui.arcadeStakeInfo.innerText = `Vous avez ${gameState.gold} PO · mise maximale : ${max} PO · bon score ×${ARCADE_SETTINGS.multipliers.good}, excellent ×${ARCADE_SETTINGS.multipliers.excellent}`;
    ui.arcadeStake.disabled = busy;
    ui.arcadeGames.innerHTML = '';
    ARCADE_GAME_KEYS.forEach(key => {
        const game = ARCADE_GAMES[key];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.arcadeGame = key;
        const disabled = busy || !check.ok || !timeOk;
        btn.disabled = disabled;
        btn.className = "flex flex-col items-start gap-0.5 px-2 py-2 min-h-[44px] bg-gray-900 border border-pink-700/70 hover:border-pink-400 hover:bg-pink-950/20 rounded text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed";
        btn.innerHTML = `<span class="text-xs text-pink-300 font-bold">${game.icon} ${game.label}</span><span class="text-[9px] text-gray-500">${game.blurb}</span><span class="text-[9px] text-gray-600">${skillLabel(game.skill)} niv. ${arcadeSkillLevel(game.skill)}</span>`;
        btn.addEventListener('click', () => playArcadeGame(key));
        ui.arcadeGames.appendChild(btn);
    });
    if (!busy) {
        ui.arcadeRounds.innerHTML = '';
        if (!arcadeMessage.text) {
            if (!timeOk) arcadeSetMessage("Plus assez de temps pour une partie.", 'danger');
            else if (!check.ok) arcadeSetMessage(check.reason, 'danger');
        }
    }
    ui.btnLeaveShop.disabled = busy;
}

// Affiche les manches déjà jouées (pastilles) et celles qui restent (cercles vides).
function renderArcadeRounds(total, outcomes) {
    if (!ui.arcadeRounds) return;
    const pips = [];
    for (let i = 0; i < total; i++) pips.push(outcomes[i] ? ARCADE_PIPS[outcomes[i]] : '⚪');
    ui.arcadeRounds.innerText = pips.join(' ');
}

// Lance une partie : valide la mise et le temps, prélève la mise et 1 H, puis enchaîne les manches.
function playArcadeGame(gameKey) {
    const game = ARCADE_GAMES[gameKey];
    if (!game || !gameState.pendingArcadeCityId || gameState.arcadeSession || gameState.pendingMinigame) return false;
    const check = arcadeReadStake();
    if (!check.ok) { arcadeSetMessage(check.reason, 'danger'); updateArcadeUI(); return false; }
    if (!arcadeCanPlayTime(gameState.timeLeft)) { arcadeSetMessage("Plus assez de temps pour une partie.", 'danger'); updateArcadeUI(); return false; }
    gameState.gold -= check.stake;
    gameState.timeLeft -= ARCADE_SETTINGS.hoursPerGame;
    applyTimeElapsedRegen(ARCADE_SETTINGS.hoursPerGame);
    gameState.arcadeSession = { game: gameKey, stake: check.stake, outcomes: [] };
    logEvent(`${game.icon} ${game.label} : vous misez ${check.stake} PO (−${ARCADE_SETTINGS.hoursPerGame} H).`, "info");
    arcadeSetMessage(`${game.icon} ${game.label} — mise : ${check.stake} PO.`, 'info');
    updateUI();
    updateArcadeUI();
    runArcadeRound();
    return true;
}

function runArcadeRound() {
    const session = gameState.arcadeSession;
    if (!session) return;
    const game = ARCADE_GAMES[session.game];
    const rounds = game.rounds({ floor: gameState.currentFloor, skillLevel: arcadeSkillLevel(game.skill) });
    const round = rounds[session.outcomes.length];
    if (!round) { finishArcadeGame(); return; }
    renderArcadeRounds(rounds.length, session.outcomes);
    const spec = buildMinigameSpec(round.kind, round.overrides);
    startMinigame(spec, (outcome) => {
        if (gameState.arcadeSession !== session) return; // partie abandonnée (restauration de sauvegarde, remise à zéro)
        session.outcomes.push(outcome);
        renderArcadeRounds(rounds.length, session.outcomes);
        if ((game.stopOnFail && outcome === 'fail') || session.outcomes.length >= rounds.length) finishArcadeGame();
        else runArcadeRound();
    });
}

// Conclut la partie : score, palier, gain (la mise y est comprise), XP de compétence sur excellent, objet sur Parfait partout.
function finishArcadeGame() {
    const session = gameState.arcadeSession;
    if (!session) return;
    const game = ARCADE_GAMES[session.game];
    gameState.arcadeSession = null;
    const score = arcadeScore(session.game, session.outcomes);
    const payout = arcadePayout(session.stake, score.tier);
    gameState.gold += payout;
    const net = payout - session.stake;
    const label = ARCADE_TIER_LABELS[score.tier];
    let text = `${game.icon} ${label} ${score.points}/${score.max} points — `;
    if (score.tier === 'lose') text += `la mise (${session.stake} PO) est perdue.`;
    else text += `vous empochez ${payout} PO (${net >= 0 ? '+' : ''}${net} net).`;
    logEvent(text, score.tier === 'lose' ? "danger" : "success");
    arcadeSetMessage(text, score.tier === 'lose' ? 'danger' : 'success');
    if (score.tier === 'excellent') gainSkillXp(game.skill, ARCADE_SETTINGS.skillXpOnExcellent);
    if (score.perfectAll) {
        logEvent("🎰 Partie parfaite : le gérant, blême, sort un lot de derrière le comptoir.", "success");
        arcadeSetMessage(`${text} Partie parfaite : un lot en prime !`, 'success');
        addLoot({ source: 'treasure' });
    }
    recordRunEvent('arcade', { game: session.game, stake: session.stake, payout, tier: score.tier, perfectAll: score.perfectAll });
    updateUI();
    updateArcadeUI();
}
