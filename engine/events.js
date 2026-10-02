// engine/events.js — Probabilités, événements d'exploration, furtivité, voyage sur carte.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================

// Régénération passive de PV et de mana, proportionnelle au temps qui s'écoule en explorant ou en
// voyageant sur la carte (voir performExploreStep()/travelToRoom()/
// autoTravelToNearestFrontier()) — jamais sur une perte de temps punitive (piège "Contretemps"),
// pour ne pas annuler la sanction. Le mana ne régénère que si un sort est équipé (sinon la barre
// n'existe pas côté joueur).
// Taux de PV DÉGRESSIF selon le pourcentage de PV déjà restants (voir HP_REGEN_TIERS) : un filet de
// sécurité franc sous 50%, mais un simple filet d'eau au-delà de 80%, pour qu'explorer en boucle ne
// vaille plus un soin complet en ~10 pas — voir enterRoom() pour le vrai soin complet (salle
// sécurisée), désormais la seule façon fiable de repartir plein PV/mana, à un coût en temps.
const HP_REGEN_TIERS = [
    { belowRatio: 0.5, perHour: 10 },
    { belowRatio: 0.8, perHour: 4 },
    { belowRatio: Infinity, perHour: 1 }
];
const MANA_REGEN_PER_HOUR = 12;

function applyTimeElapsedRegen(hours) {
    if (!hours || hours <= 0) return;
    // REPAS_DE_FAMILLE (anomalies.js) : plus aucune régénération passive de PV hors salle sécurisée —
    // cette fonction n'est justement appelée que HORS salle sécurisée (le soin complet à l'entrée d'une
    // salle sécurisée, voir enterRoom(), est un chemin totalement séparé).
    if (!gameState.anomalyEffects.regenOutsideSafehouseZero && gameState.hp < gameState.maxHp) {
        const hpRatio = gameState.maxHp > 0 ? gameState.hp / gameState.maxHp : 0;
        const tier = HP_REGEN_TIERS.find(t => hpRatio < t.belowRatio);
        applyPlayerHeal(tier.perHour * hours);
    }
    // Le compagnon récupère au même rythme (jamais s'il est à terre : il faut un repos ou une potion)
    const companion = gameState.companion;
    if (companion && !companion.downed && companion.hp < companion.maxHp && !gameState.anomalyEffects.regenOutsideSafehouseZero) {
        const ratio = companion.hp / companion.maxHp;
        const tier = HP_REGEN_TIERS.find(t => ratio < t.belowRatio);
        companion.hp = Math.min(companion.maxHp, companion.hp + tier.perHour * hours);
    }
    if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
        const manaMult = gameState.anomalyEffects.manaRegenMult || 1; // SECHERESSE (anomalies.js)
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + MANA_REGEN_PER_HOUR * hours * manaMult);
    }
}

// Table d'événements de la zone courante (ZONE_TYPES[zone].eventTable, floorgen.js) : config.chances dans un
// bloc de quartier, config.avenueChances sur une avenue, config.cityChances dans une ville et
// config.roadChances sur une route (étages urbains, chantier 12).
const ZONE_EVENT_TABLES = { room: 'chances', avenue: 'avenueChances', city: 'cityChances', road: 'roadChances' };
function getZoneEventTable() {
    const zone = ZONE_TYPES[roomZone(currentFloorRoom())] || ZONE_TYPES.block;
    return config[ZONE_EVENT_TABLES[zone.eventTable] || 'chances'];
}

// PO trouvées en explorant (événement « goldFind », et lot de consolation d'un coffre crocheté à moitié).
function rollGoldAmount() {
    const baseGold = Math.floor(Math.random() * 16) + 5; // 5 à 20 PO
    const strikerMult = hasActiveCompanion('strike') ? 1 + config.companions.striker.goldBonusPct / 100 : 1; // Frappe d'appoint : il a l'œil pour les pièces
    return Math.round(baseGold * (1 + gameState.currentFloor * 0.15) * (gameState.anomalyEffects.goldGainMult || 1) * strikerMult); // Proportionnel à l'étage, ECONOMIE_AUSTERE (anomalies.js)
}

// Le piège se déclenche : dégâts, journal, mort éventuelle (cause 'trap').
function springTrap(trap) {
    const dmg = applyTrialToDamage(applyStarterBuffToDamage(applyRaceDamageMods(Math.floor(Math.random() * (trap.dmgMax - trap.dmgMin + 1)) + trap.dmgMin, 'trap')));
    applyPlayerDamage(dmg);
    setSceneHeader('⚠️', 'Piège', 'Danger', 'trap');
    logEvent(`${trap.text} (-${dmg} PV)`, "danger");
    recordRunEvent('trap');
    if (gameState.hp <= 0) {
        gameOver(false, 'trap');
    }
}

// Niveau de Furtivité du crawler (règle la difficulté du crochetage et du désamorçage).
function stealthSkillLevel() {
    return effectiveStealthLevel();
}

// Coffre verrouillé (chantier 6, V1) : trois goupilles à crocheter ; le butin dépend du nombre réussi
// (LOCKPICK_REWARDS : rien / quelques PO / butin normal / butin d'un palier de rareté de plus).
function openLockedChest() {
    setSceneHeader('🔒', 'Coffre Verrouillé', 'Butin', 'treasure');
    logEvent("Un coffre verrouillé, planqué sous des gravats. Votre crochet de fortune fera l'affaire.", "info");
    const spec = buildMinigameSpec('lockpick', { zoneWidth: lockpickZoneWidth(gameState.currentFloor, stealthSkillLevel()) });
    startMinigame(spec, (outcome, detail) => {
        resolveLockedChestReward((detail && detail.pins) || 0);
        updateUI();
    });
}

function resolveLockedChestReward(pins) {
    const reward = lockpickReward(pins);
    if (reward === 'treasure') {
        logEvent(`🔓 ${pins}/3 goupilles : la serrure cède, le coffre déborde !`, "success");
        addLoot({ source: 'treasure' }); // Un palier de rareté de plus (voir rollLootRarity())
    } else if (reward === 'explore') {
        logEvent(`🔓 ${pins}/3 goupilles : la serrure s'ouvre de justesse.`, "success");
        addLoot({ source: 'explore' });
    } else if (reward === 'gold') {
        const gold = rollGoldAmount();
        gameState.gold += gold;
        logEvent(`🔓 ${pins}/3 goupille : le coffre ne livre que quelques pièces (+${gold} PO).`, "info");
    } else {
        logEvent("🔒 Aucune goupille ne cède. Le coffre garde ses secrets, et vous gardez vos ongles.", "danger");
    }
}

// Piège désamorçable (chantier 6, V1) : séquence de symboles à reproduire ; réussie, le piège est évité ; ratée, il se déclenche.
function openTrapDisarm(trap) {
    setSceneHeader('⚠️', 'Piège Détecté', 'Danger', 'trap');
    logEvent("Un mécanisme à pression, à peine caché. Un geste de travers et il se déclenche.", "info");
    const spec = buildMinigameSpec('sequence', disarmOverrides(gameState.currentFloor, stealthSkillLevel()));
    startMinigame(spec, (outcome) => {
        if (outcome === 'fail') springTrap(trap);
        else logEvent("🧰 Piège désamorcé. Personne n'applaudit, mais vous êtes entier.", "success");
        updateUI();
    });
}

function resolveCardEvent() {
    // L'escalier et les salles sécurisées ne sont plus tirés ici : ce sont des pièces fixes du
    // graphe de l'étage (voir generateFloorMap() et enterRoom()). Cette fonction ne résout plus
    // que le contenu des pièces "normales".
    const table = getZoneEventTable();
    const d100 = Math.random() * 100;
    let cumulative = 0;

    // Rien de notable
    cumulative += table.nothing;
    if (d100 < cumulative) {
        setSceneHeader('🌑', 'Silence', 'Exploration', 'silence');
        logEvent(pick(flavorText.nothing), "normal");
        return;
    }

    // Combat : passe d'abord par une tentative de furtivité (voir handleStealthEncounter)
    cumulative += table.combat;
    if (d100 < cumulative) {
        handleStealthEncounter();
        return;
    }

    // Changement de quartier : se fait maintenant en traversant une jonction du graphe pendant
    // explore(), pas via un tirage D100 ici. Salle sécurisée : voir enterRoom() (pièce fixe).

    // Découverte d'objet (générateur procédural)
    cumulative += table.loot;
    if (d100 < cumulative) {
        // Une « Trésor » sur deux est un coffre verrouillé (chantier 6, mini-jeu de crochetage) ; l'autre moitié reste
        // le butin ramassé tel quel.
        if (Math.random() * 100 < MINIGAME_SETTINGS.lockedChestPct) { openLockedChest(); return; }
        setSceneHeader('💰', 'Trésor', 'Butin', 'treasure');
        logEvent("Vous trébuchez sur quelque chose de brillant...", "info");
        addLoot({ source: 'explore' });
        return;
    }

    // NOUVEAU : Piège dangereux (vrais dégâts, plusieurs variantes)
    cumulative += table.trap;
    if (d100 < cumulative) {
        const trap = pick(flavorText.trap);
        // Compagnon Éclaireur : repère le piège à temps une fois sur deux (config.companions.scout)
        if (hasActiveCompanion('scout') && Math.random() * 100 < config.companions.scout.trapAvoidChance) {
            setSceneHeader('⚠️', 'Piège Évité', 'Danger', 'trap');
            logEvent(`${gameState.companion.name} repère le piège à temps : vous l'enjambez sans une égratignure.`, "success");
            return;
        }
        // Un piège sur deux se désamorce (chantier 6, mini-jeu de séquence) ; l'autre se déclenche comme avant.
        if (Math.random() * 100 < MINIGAME_SETTINGS.trapDisarmPct) { openTrapDisarm(trap); return; }
        springTrap(trap);
        return;
    }

    // NOUVEAU : Détour qui coûte du temps (la ressource la plus précieuse du jeu)
    cumulative += table.timeLoss;
    if (d100 < cumulative) {
        const lost = Math.floor(Math.random() * 3) + 1; // 1 à 3 heures perdues en plus
        gameState.timeLeft = Math.max(0, gameState.timeLeft - lost);
        setSceneHeader('⏳', 'Contretemps', 'Danger', 'timeLoss');
        logEvent(`${pick(flavorText.timeLoss)} (-${lost}H supplémentaires)`, "danger");
        if (gameState.timeLeft <= 0) {
            gameOver(true);
            return;
        }
        return;
    }

    // NOUVEAU : Petite trouvaille (soin mineur)
    cumulative += table.minorFind;
    if (d100 < cumulative) {
        const heal = Math.floor(Math.random() * 8) + 5; // 5 à 12 PV
        const actualHeal = applyPlayerHeal(heal);
        setSceneHeader('🎒', 'Petite Trouvaille', 'Butin', 'minorFind');
        logEvent(`${pick(flavorText.minorFind)} (+${actualHeal} PV)`, "success");
        return;
    }

    // NOUVEAU : Quelques PO trouvées (voir sellItem() pour l'autre source de revenu)
    cumulative += table.goldFind;
    if (d100 < cumulative) {
        const gold = rollGoldAmount();
        gameState.gold += gold;
        setSceneHeader('💰', 'Pièces d\'Or', 'Butin', 'gold');
        logEvent(`${pick(flavorText.goldFind)} (+${gold} PO)`, "success");
        return;
    }

    // NOUVEAU : Cadeau des spectateurs (petit bonus d'XP — clin d'œil au format "émission" du livre)
    cumulative += table.audienceGift;
    if (d100 < cumulative) {
        const bonusXp = Math.floor(Math.random() * 6) + 5; // 5 à 10 XP
        setSceneHeader('📢', 'Cadeau du Public', 'Bonus', 'audienceGift');
        logEvent(pick(flavorText.audienceGift), "success");
        gainXp(bonusXp);
        return;
    }

    // NOUVEAU : Rencontre d'un autre crawler (ami ou hostile, un seul compagnon actif à la fois)
    cumulative += table.companionEncounter;
    if (d100 < cumulative) {
        if (gameState.companion) {
            // Déjà accompagné : ce tirage se résout comme un moment calme, pas de rencontre superposée
            setSceneHeader('🌑', 'Silence', 'Exploration', 'silence');
            logEvent(pick(flavorText.nothing), "normal");
            return;
        }

        const candidate = generateCompanionCandidate(gameState.currentFloor);
        gameState.pendingCompanionCandidate = candidate;
        gameState.companionChoicePending = true;
        const summary = buildCompanionCandidateSummary(candidate);
        if (ui.companionInfoFriendly) ui.companionInfoFriendly.innerHTML = summary;
        if (ui.companionInfoHostile) ui.companionInfoHostile.innerHTML = summary;

        if (candidate.disposition === 'friendly') {
            setSceneHeader('🧍', candidate.name, 'Crawler Rencontré', 'crawlerFriendly');
            logEvent(`Vous croisez ${candidate.name}, un autre crawler. Il semble pacifique et vous propose son aide.`, "info");
            ui.companionChoiceFriendly.classList.remove('hidden');
        } else {
            setSceneHeader('🗡️', candidate.name, 'Crawler Hostile', 'crawlerHostile');
            logEvent(`Vous croisez ${candidate.name}, un autre crawler. Il vous toise avec hostilité...`, "danger");
            ui.companionChoiceHostile.classList.remove('hidden');
        }
        updateUI();
        return;
    }

    // Pickpocket (villes des étages urbains seulement, chantier 12) : quelques PO envolées.
    cumulative += table.pickpocket || 0;
    if (d100 < cumulative) {
        const stolen = computePickpocketLoss(gameState.gold);
        gameState.gold -= stolen;
        setSceneHeader('🫳', 'Pickpocket', 'Ville', 'pickpocket');
        logEvent(stolen > 0
            ? `Quelqu'un vous bouscule dans la foule... Votre bourse est plus légère. (-${stolen} PO)`
            : "Un pickpocket fouille vos poches, n'y trouve rien, et repart vexé.", stolen > 0 ? "danger" : "normal");
        return;
    }

    // Reste : moment purement narratif, sans effet mécanique
    setSceneHeader('🎬', 'Ambiance', 'Exploration', 'ambiance');
    logEvent(pick(flavorText.flavorOnly), "normal");
}

// ==========================================
// FURTIVITÉ (rencontres aléatoires uniquement — pas les boss ni les embuscades de trajet)
// ==========================================

// Chance de ne pas se faire repérer : base + niveau de la compétence Furtivité, avec un bonus
// du compagnon "Éclaireur" (logique : il repère le danger avant qu'il ne vous repère) et un bonus
// d'équipement si l'arme ou l'armure porte le modificateur "Silencieux" (mechanic 'stealth',
// jusqu'ici purement cosmétique — première vraie utilité).
function getStealthChance() {
    let chance = 15 + (effectiveStealthLevel() - 1) * 6;
    if (hasActiveCompanion('scout')) chance += config.companions.scout.stealthBonus;
    // Silencieux (bonus) et Grinçant (défaut de Camelote, bonus négatif) sur tout l'équipement porté.
    chance += sumEquippedQualifier('stealth', 'bonus') + sumEquippedQualifier('squeaky', 'bonus');
    // NOCTURNE (anomalies.js) : détection des mobs accrue (pénalité sur la chance de base) mais
    // plafond relevé d'autant — récompense un fort investissement en Furtivité, punit un faible.
    chance -= gameState.anomalyEffects.detectionBonus || 0;
    chance += originRaceEffects().stealthPts || 0; // Gobelin +10, Troll −10 (chantier 13)
    return Math.max(0, Math.min(60 + (gameState.anomalyEffects.stealthCapBonus || 0), chance));
}

// Point d'entrée d'une rencontre aléatoire : tente d'abord la furtivité avant de basculer sur un
// combat classique si le monstre repère le joueur.
function handleStealthEncounter() {
    // Chasseur de primes (chantier 3) : il vous traque — aucun jet de détection, aucune esquive possible.
    const hunter = maybeSpawnBountyHunter();
    if (hunter) {
        initiateCombat(hunter);
        return;
    }
    // LABYRINTHE (anomalies.js) : mobs rencontrés dans le quartier qui garde l'escalier ont plus de
    // chances d'être élite ("escalier mieux gardé") — n'affecte aucun autre quartier de l'étage.
    const inStairsQuadrant = gameState.floorMap && roomZone(currentFloorRoom()) === 'block' && gameState.floorMap.currentQuadrant === gameState.floorMap.stairsQuadrant;
    const eliteBonus = (gameState.anomalyEffects.guardedStairsBoost && inStairsQuadrant) ? 25 : 0;
    const enemy = generateMob(gameState.currentDistrict, eliteBonus);
    const undetected = Math.random() * 100 < getStealthChance();

    if (!undetected) {
        // L'en-tête de la scène (icône/nom/type) est posé par initiateCombat() lui-même.
        logEvent(`Des bruits de pas approchent... Des créatures de ${gameState.currentDistrict} vous attaquent !`, "danger");
        initiateCombat(enemy);
        return;
    }

    gameState.pendingStealthEncounter = enemy;
    gameState.stealthChoicePending = true;
    setSceneHeader('🥷', enemy ? enemy.name : 'Ombre', 'Non Repéré', { key: 'stealthUnseen', enemy });
    logEvent(`Vous repérez ${enemy ? `[${enemy.name}]` : "une présence"} avant qu'il ne vous voie.`, "info");
    logEvent("Tenter de l'esquiver en silence, ou frapper en traître ?", "info");
    ui.stealthChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Esquiver" : succès -> aucun combat + XP de Furtivité ; échec -> repéré, combat classique
function attemptStealthEvasion() {
    const enemy = gameState.pendingStealthEncounter;
    gameState.stealthChoicePending = false;
    ui.stealthChoiceZone.classList.add('hidden');
    gameState.pendingStealthEncounter = null;
    if (!enemy) { updateUI(); return; }

    const evadeChance = Math.min(70 + (gameState.anomalyEffects.stealthCapBonus || 0), 40 + (effectiveStealthLevel() - 1) * 8); // NOCTURNE (anomalies.js)
    if (Math.random() * 100 < evadeChance) {
        setSceneHeader('🥷', 'Évitement Réussi', 'Furtivité', { key: 'stealthEvaded', enemy });
        logEvent(`Vous évitez [${enemy.name}] sans un bruit.`, "success");
        gainSkillXp('stealth', 5);
        updateUI();
    } else {
        // Échec punitif : le mob reste "alerted" pour tout ce combat (voir attemptFlee()), pour que
        // la boucle esquive-ratée-mais-sans-conséquence ne reste pas totalement gratuite — voir issue
        // d'équilibrage "Furtivité".  L'en-tête de la scène (icône/nom/type) est posé par
        // initiateCombat() lui-même.
        enemy.alerted = true;
        logEvent(`[${enemy.name}] vous repère au dernier moment, et ne vous laissera pas filer !`, "danger");
        initiateCombat(enemy);
    }
}

// Bouton "Attaque Furtive" : le combat démarre avec un bonus x2 garanti sur le tout premier coup
function attemptStealthAttack() {
    const enemy = gameState.pendingStealthEncounter;
    gameState.stealthChoicePending = false;
    ui.stealthChoiceZone.classList.add('hidden');
    gameState.pendingStealthEncounter = null;
    if (!enemy) { updateUI(); return; }

    // L'en-tête de la scène (icône/nom/type) est posé par initiateCombat() lui-même.
    logEvent(`Vous surgissez de l'ombre et frappez [${enemy.name}] par surprise !`, "success");
    gameState.pendingSneakAttack = true;
    initiateCombat(enemy);
}

// ==========================================
// LIEUX CONNUS (escalier gardé, boss de quartier, salles sécurisées)
// ==========================================

// Vrai si une action de type "explorer" ou "voyager vers un lieu connu" doit être bloquée
// (combat en cours, ou décision de boss en attente).
function isActionBlocked() {
    return gameState.inCombat || gameState.bossChoicePending || gameState.companionChoicePending || gameState.stealthChoicePending || gameState.shopChoicePending || gameState.lairChoicePending || gameState.floorTransitionPending || gameState.pactChoicePending || gameState.raceChoicePending || gameState.classChoicePending || gameState.safehouseChoicePending || gameState.stairsChoicePending || gameState.showChoicePending || !!gameState.pendingMinigame;
}

// ---------- Voyage sur carte (chantier 5, M1 + P1 — remplace les anciens « Lieux connus ») ----------
// Plus de registre séparé : boss repérés, salles sûres et escalier libre sont lus directement dans l'état
// des salles (listFloorLandmarks()), et tout voyage passe par travelToRoom() depuis la carte.

// Salle aperçue : pas encore visitée, mais voisine d'une salle visitée (sa porte a été vue).
function isRoomSeen(room) {
    const fm = gameState.floorMap;
    return !!(fm && room && !room.visited && room.neighbors.some(e => fm.roomsById[e.to] && fm.roomsById[e.to].visited));
}

// Repères de l'étage (marqueurs de la carte) — dérivés des salles, jamais stockés à part.
function listFloorLandmarks() {
    const fm = gameState.floorMap;
    if (!fm) return [];
    const marks = [];
    Object.values(fm.roomsById).forEach(room => {
        // Étage urbain (chantier 12) : escalier / Sortie, boutique, professeur, repaire.
        const city = roomCity(room);
        const inCity = city ? ` (${city.name})` : '';
        if (room.type === 'stairs') {
            if (!room.visited) return;
            if (room.guarded && !room.defeated) marks.push({ roomId: room.id, kind: 'stairsGuarded', icon: '👑', label: `${room.isExit ? "Sortie gardée" : "Escalier gardé"}${inCity}` });
            else marks.push({ roomId: room.id, kind: room.isExit ? 'exit' : 'stairs', icon: room.isExit ? '🚪' : '🪜', label: `${room.isExit ? "Sortie" : "Escalier libre"}${inCity}` });
            return;
        }
        if (room.type === 'shop' || room.type === 'trainer') {
            if (room.visited) marks.push({ roomId: room.id, kind: room.type, icon: room.type === 'shop' ? '🛒' : '🎓', label: `${room.type === 'shop' ? "Marchand" : "Professeur"}${inCity}` });
            return;
        }
        if (room.type === 'arcade') {
            if (room.visited) marks.push({ roomId: room.id, kind: 'arcade', icon: '🎰', label: `Salle de jeux${inCity}` });
            return;
        }
        if (room.type === 'lair') {
            const lair = fm.lairsById && fm.lairsById[room.lairId];
            if (room.visited || isRoomSeen(room)) marks.push({ roomId: room.id, kind: 'lair', icon: lair && lair.cleared ? '🏆' : '💀', label: lair && lair.cleared ? "Repaire nettoyé" : "Repaire" });
            return;
        }
        if (room.type === 'boss' && (room.visited || room.defeated)) {
            if (room.defeated && room.guardsStairs) marks.push({ roomId: room.id, kind: 'stairs', icon: '🪜', label: `Escalier libre (${roomDistrict(room)})` });
            else if (!room.defeated) marks.push({ roomId: room.id, kind: room.guardsStairs ? 'stairsGuarded' : 'boss', icon: '👑', label: `${room.guardsStairs ? "Escalier gardé" : "Boss"} (${roomDistrict(room)})` });
        } else if (room.type === 'safe' && room.visited) {
            const sh = room.safehouse || { name: "Salle sûre", icon: '🛏️' };
            marks.push({ roomId: room.id, kind: 'safe', icon: sh.icon, label: city ? `Auberge${inCity}` : sh.name });
        }
    });
    return marks;
}

// Libellé court d'une salle (bulle de la carte, journal de trajet).
function floorRoomLabel(room) {
    if (!room) return "Salle";
    if (isUrbanFloor()) return urbanRoomLabel(room);
    if (!room.visited) return roomZone(room) === 'avenue' ? "Avenue inexplorée" : `Salle inconnue (${roomDistrict(room)})`;
    const mark = listFloorLandmarks().find(m => m.roomId === room.id);
    if (mark) return mark.label;
    if (roomZone(room) === 'avenue') return "Avenue";
    return `Salle (${roomDistrict(room)})`;
}

// Libellé court d'une salle d'étage urbain : place, ruelle, auberge… de sa ville, route, repaire.
const URBAN_ROOM_ROLE_LABELS = { plaza: "Place", alley: "Ruelle", inn: "Auberge", merchant: "Marchand", trainer: "Professeur", stairs: "Escalier" };
function urbanRoomLabel(room) {
    const city = roomCity(room);
    const zone = roomZone(room);
    if (!room.visited) {
        if (zone === 'road') return "Route inexplorée";
        if (zone === 'lair') return "Recoin au bord de la route";
        return city && city.visited ? `Rue inconnue (${city.name})` : "Ville inconnue";
    }
    const mark = listFloorLandmarks().find(m => m.roomId === room.id);
    if (mark) return mark.label;
    if (zone === 'road') return "Route";
    if (zone === 'lair') return "Repaire";
    return `${URBAN_ROOM_ROLE_LABELS[room.cityRole] || "Rue"}${city ? ` (${city.name})` : ''}`;
}

// Prépare un voyage vers `roomId` (pure vis-à-vis de gameState : ne modifie rien). Destination : une salle
// visitée, ou une salle APERÇUE (P1) — on marche alors jusqu'à la salle visitée voisine la plus proche
// (`viaRoomId`), puis on fait le pas dans l'inconnu (un pas d'exploration normal, -1 H, événement tiré).
// Le trajet ne passe que par des salles déjà visitées. Renvoie null si la salle n'est ni visitée ni
// aperçue, ou si c'est la salle courante. { roomId, viaRoomId, exploreStep, distance, timeCost,
// ambushChance, label }.
function planTravelToRoom(roomId) {
    const fm = gameState.floorMap;
    if (!fm) return null;
    const target = fm.roomsById[roomId];
    if (!target || roomId === fm.currentRoomId) return null;
    const visitedOnly = id => fm.roomsById[id] && fm.roomsById[id].visited;
    let viaRoomId = roomId;
    let path = null;
    if (target.visited) {
        path = computeFloorPath(fm.currentRoomId, roomId, visitedOnly);
    } else {
        if (!isRoomSeen(target)) return null;
        target.neighbors.forEach(edge => {
            if (!visitedOnly(edge.to)) return;
            const p = edge.to === fm.currentRoomId ? { cost: 0, rooms: [edge.to] } : computeFloorPath(fm.currentRoomId, edge.to, visitedOnly);
            if (p && (!path || p.cost < path.cost)) { path = p; viaRoomId = edge.to; }
        });
    }
    if (!path) return null;
    const distance = Math.round(path.cost * 10) / 10;
    return {
        roomId,
        viaRoomId,
        exploreStep: !target.visited,
        distance,
        timeCost: distance > 0 ? Math.max(1, Math.round(distance / 2)) : 0,
        ambushChance: distance > 0 ? computeAmbushBaseChance(distance) : 0,
        label: floorRoomLabel(target)
    };
}

// Voyage vers une salle de la carte (M1) ou exploration d'une salle aperçue (P1) : temps et risque
// d'embuscade selon la longueur réelle du chemin (avenues ×0,5, compagnon Garde), puis arrivée par
// enterRoom() — ou, pour une salle aperçue, le pas d'exploration dans l'inconnu. Renvoie le plan (tests).
function travelToRoom(roomId) {
    if (isActionBlocked()) return null;
    if (gameState.hp <= 0 || gameState.timeLeft <= 0) return null;
    const plan = planTravelToRoom(roomId);
    if (!plan) return null;

    // Salle aperçue juste à côté : un simple pas d'exploration vers elle.
    if (plan.exploreStep && plan.viaRoomId === gameState.floorMap.currentRoomId) {
        performExploreStep(roomId);
        return plan;
    }

    let ambushCount = 0;
    if (Math.random() * 100 < plan.ambushChance) {
        ambushCount = 1;
        if (Math.random() * 100 < plan.ambushChance * 0.6) ambushCount = 2;
    }
    gameState.timeLeft = Math.max(0, gameState.timeLeft - plan.timeCost);
    applyTimeElapsedRegen(plan.timeCost);
    gameState.pendingTravel = {
        destination: { roomId: plan.viaRoomId, label: plan.exploreStep ? floorRoomLabel(gameState.floorMap.roomsById[plan.viaRoomId]) : plan.label },
        exploreRoomId: plan.exploreStep ? roomId : null,
        ambushesRemaining: ambushCount
    };
    logEvent(plan.exploreStep
        ? `Vous traversez le terrain connu vers ${plan.label.toLowerCase()} (${plan.distance}, -${plan.timeCost}H)...`
        : `Vous repartez vers : ${plan.label} (${plan.distance}, -${plan.timeCost}H)...`, "info");
    if (ambushCount > 0) logEvent("Le trajet ne s'annonce pas de tout repos...", "danger");

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return plan;
    }
    triggerNextAmbushOrArrive();
    return plan;
}

// Résout la prochaine embuscade du trajet en cours, ou l'arrivée si le trajet est terminé
function triggerNextAmbushOrArrive() {
    const travel = gameState.pendingTravel;
    if (!travel) return;

    if (travel.ambushesRemaining > 0) {
        travel.ambushesRemaining -= 1;
        logEvent("Une présence hostile vous barre la route !", "danger");
        gameState.pendingStairAfterCombat = false; // Ce n'est pas encore l'arrivée
        initiateCombat(maybeSpawnBountyHunter()); // Mob générique du quartier (ou chasseur de primes), pas le boss : simple embuscade de trajet
        return;
    }

    arriveAtDestination();
}

// Arrivée effective : se positionne sur la salle cible et réutilise EXACTEMENT la même logique d'entrée que
// l'exploration normale (enterRoom), pour un comportement cohérent que la salle soit atteinte en marchant
// ou en voyageant. Pour une salle aperçue (P1, `exploreRoomId`), on s'arrête à la salle voisine sans y
// « entrer » de nouveau, et on fait directement le pas dans l'inconnu.
function arriveAtDestination() {
    const travel = gameState.pendingTravel;
    if (!travel) return;
    const destination = travel.destination;
    gameState.pendingTravel = null;

    const room = gameState.floorMap && gameState.floorMap.roomsById[destination.roomId];
    if (!room) return;

    moveToFloorRoom(room);

    if (travel.exploreRoomId) {
        performExploreStep(travel.exploreRoomId);
        return;
    }
    logEvent(`Vous atteignez : ${destination.label}.`, "info");
    enterRoom(room);
    updateUI();
}
