// engine/show.js — Émission DeathWatch et anomalies d'étage (UI).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// ÉMISSION DEATHWATCH (chantier 4 — catalogue pur dans deathwatch.js, chiffres dans config.show)
// ==========================================
// À l'arrivée sur chaque nouvel étage (dès config.show.firstFloor), un choix bloquant : le présentateur
// lance une pique tirée de la partie, le crawler répond sur l'un des 4 tons (du Poli sans risque à
// l'Insulte en direct) ou refuse. Jet d20 + popularité contre le seuil du ton : boîte de succès en cas
// de réussite, sanction sinon (voir answerShow()).

// Popularité : +1 au jet par tranche de config.show.popularityPerAchievements succès débloqués.
function getShowPopularity() {
    return Math.floor(countUnlockedAchievements() / config.show.popularityPerAchievements);
}

// Contexte des piques : la partie en cours + le bilan de l'étage qui vient de se terminer
// (`lastFloor`, capturé par advanceToNextFloor() avant la remise à zéro de floorStats).
function buildShowContext(lastFloor = {}) {
    const rs = gameState.runStats || createEmptyRunStats();
    const joke = findRidiculousEquippedItem();
    const c = gameState.companion;
    return {
        crawler: gameState.playerName || "Crawler",
        etage: gameState.currentFloor,
        fuites: gameState.fleesThisRun || 0,
        degats: lastFloor.damageTaken || 0,
        mobs: lastFloor.mobsKilled || 0,
        pieges: lastFloor.traps || 0,
        sortsRates: rs.backfires || 0,
        objet: joke ? joke.name : null,
        compagnon: c ? c.name : null,
        compagnonATerre: !!(c && c.downed),
        compagnonsPartis: (rs.companionsLeft || 0) + (rs.companionsDismissed || 0),
        prime: gameState.bounty ? gameState.bounty.value : 0,
        succes: countUnlockedAchievements(),
        niveau: gameState.level,
        or: gameState.gold,
        parfaits: rs.minigamePerfects || 0,
        mises: rs.arcadeLost || 0,
        mainsNues: rs.unarmedKills || 0,
        maxHp: gameState.maxHp,
        pvPct: gameState.maxHp > 0 ? Math.round(gameState.hp / gameState.maxHp * 100) : 0,
        // Origine (chantier 13) : piques dédiées juste après le choix de race et de classe (étage d'arrivée).
        raceKey: gameState.race || null,
        classKey: gameState.crawlerClass || null,
        race: (originEntry('race', gameState.race) || {}).short || null,
        classe: (originEntry('class', gameState.crawlerClass) || {}).name || null,
        synergie: (() => { const syn = originSynergyFor(gameState.race, gameState.crawlerClass); return syn ? `${syn.race}+${syn.cls}` : null; })(),
        synergieTitre: (originSynergyFor(gameState.race, gameState.crawlerClass) || {}).title || null,
        origineFraiche: !!gameState.race && !!gameState.crawlerClass && gameState.currentFloor === config.origins.chooseFloor,
        // Début de partie (chantier 15, lot 5) : Période d'essai en cours / terminée, Armure de scénario consommée sur l'étage fini, Remplaçants intérimaires vaincus.
        essai: config.earlyGame.enabled && gameState.currentFloor <= config.earlyGame.maxFloor && trialDamageMult(gameState.level, gameState.currentFloor) < 1,
        essaiPct: Math.round((1 - trialDamageMult(gameState.level, gameState.currentFloor)) * 100),
        finEssai: config.earlyGame.enabled && gameState.currentFloor === config.earlyGame.maxFloor + 1,
        scenario: gameState.plotArmorFloor > 0 && gameState.plotArmorFloor === gameState.currentFloor - 1,
        interimKills: rs.interimKills || 0
    };
}

// Ouvre l'émission (appelée par advanceToNextFloor(), ou par choosePactBlessing() si le Pacte passait
// avant). Pose showChoicePending (bloquant) et gameState.pendingShow (pique + répliques tirées).
function triggerShow(lastFloor = {}) {
    const ctx = buildShowContext(lastFloor);
    const taunt = pickShowTaunt(ctx);
    const replies = {};
    // Répliques tirées dans le thème de la pique : la réponse rebondit sur ce que Chip vient de dire.
    SHOW_TONES.forEach(t => { replies[t.key] = fillShowTemplate(pickShowLine(getShowReplyLines(taunt, t.key)), ctx); });
    gameState.pendingShow = { tauntId: taunt.id, text: fillShowTemplate(taunt.text, ctx), replies };
    gameState.showChoicePending = true;
    setSceneHeader('📺', SHOW_HOST.show, 'Émission', 'showStudio');
    logEvent(`📺 ${SHOW_HOST.show} — ${SHOW_HOST.name} : ${gameState.pendingShow.text}`, "info");
    updateShowZone();
    if (ui.showZone) ui.showZone.classList.remove('hidden');
}

// Enjeu affiché sous chaque bouton : seuil, gain et risque, pour décider en connaissance de cause.
function describeShowStake(toneKey) {
    const a = config.show.answers[toneKey];
    const tierLabel = (k) => `${ACHIEVEMENT_TIERS[k].box} ${ACHIEVEMENT_TIERS[k].label}`;
    const failLabels = { time: `−${a.failHours} H`, elite: "combat contre un élite", hunter: `chasseur de primes (+${a.bountyGain} prime)` };
    if (toneKey === 'polite') return "Sans jet · petit cadeau";
    return `Jet ≥ ${a.dc} · réussite : boîte ${tierLabel(a.box)} · échec : ${failLabels[a.fail]}`;
}

function updateShowZone() {
    const show = gameState.pendingShow;
    if (!show || !ui.showZone) return;
    if (ui.showHost) ui.showHost.innerText = `${SHOW_HOST.name}, présentateur de ${SHOW_HOST.show}`;
    if (ui.showTaunt) ui.showTaunt.innerText = show.text;
    if (ui.showPopularity) ui.showPopularity.innerText = `Popularité : +${getShowPopularity()} au jet (d20)`;
    SHOW_TONES.forEach(t => {
        const btn = ui.showButtons && ui.showButtons[t.key];
        if (!btn) return;
        btn.innerHTML = `<span class="block font-bold">${t.icon} ${t.label}</span>`
            + `<span class="block text-[10px] normal-case tracking-normal italic opacity-90">${show.replies[t.key]}</span>`
            + `<span class="block text-[10px] normal-case tracking-normal opacity-70">${describeShowStake(t.key)}</span>`;
    });
}

function closeShow() {
    gameState.showChoicePending = false;
    gameState.pendingShow = null;
    if (ui.showZone) ui.showZone.classList.add('hidden');
}

// Réponse du crawler (ou 'refuse'). Renvoie { tone, roll, total, success } pour les tests.
function answerShow(toneKey) {
    if (!gameState.showChoicePending || !gameState.pendingShow) return null;
    const show = gameState.pendingShow;
    closeShow();
    const s = gameState.runStats;

    if (toneKey === 'refuse') {
        logEvent(`Vous : ${pickShowLine(SHOW_REFUSALS)} — ${pickShowLine(SHOW_REACTIONS.refuse)}`, "info");
        s.showRefusals = (s.showRefusals || 0) + 1;
        recordRunEvent('show', { tone: 'refuse' });
        updateUI();
        return { tone: 'refuse', success: null };
    }

    const a = config.show.answers[toneKey];
    if (!a) return null;
    logEvent(`Vous : ${show.replies[toneKey] || ''}`, "info");

    if (toneKey === 'polite') {
        const gold = rollAchievementGold(a.goldMult);
        gameState.gold += gold;
        logEvent(`${pickShowLine(SHOW_REACTIONS.polite)} (+${gold} PO)`, "success");
        recordRunEvent('show', { tone: 'polite', success: true });
        updateUI();
        return { tone: 'polite', success: true };
    }

    const roll = 1 + Math.floor(Math.random() * config.show.dieSides);
    const popularity = getShowPopularity();
    const total = roll + popularity;
    const success = total >= a.dc;
    logEvent(`🎲 d${config.show.dieSides} : ${roll}${popularity ? ` + ${popularity} (popularité)` : ''} = ${total} — ${a.dc} requis : ${success ? 'RÉUSSITE' : 'ÉCHEC'} !`, success ? "success" : "danger");

    if (success) {
        logEvent(pickShowLine(SHOW_REACTIONS.success[toneKey]), "success");
        if (toneKey === 'insult') s.showInsultWins = (s.showInsultWins || 0) + 1;
        recordRunEvent('show', { tone: toneKey, success: true });
        openAchievementBox(a.box);
        updateUI();
        return { tone: toneKey, roll, total, success };
    }

    logEvent(pickShowLine(SHOW_REACTIONS.failure[toneKey]), "danger");
    recordRunEvent('show', { tone: toneKey, success: false });
    if (a.fail === 'time') {
        // Jamais mortel : l'audience s'ennuie, elle ne tue pas (au moins 1 H reste toujours).
        gameState.timeLeft = Math.max(1, gameState.timeLeft - a.failHours);
        logEvent(`L'émission s'éternise (−${a.failHours} H).`, "danger");
        updateUI();
    } else if (a.fail === 'elite') {
        initiateCombat(generateMob(gameState.currentDistrict, config.show.eliteBonus));
    } else if (a.fail === 'hunter') {
        addBounty(a.bountyGain);
        initiateCombat(spawnBountyHunter());
    }
    return { tone: toneKey, roll, total, success };
}

// Fait effectivement passer à l'étage suivant (génération incluse) — dispatché depuis l'écran
// d'escalier (voir triggerFloorTransition()/continueFromFloorTransition() plus bas), sauf pour
// devJumpToUrbanFloor() (raccourci DEV, saute délibérément l'écran).
function advanceToNextFloor() {
    gameState.currentFloor += 1;
    gameState.cardsDrawnThisFloor = 0;
    // Budget temps croissant par étage (chantier "QoL/équilibrage", Chantier E — voir
    // NOTES_QOL_EQUILIBRAGE.md) : plus de plafond fixe, config.floorTimeBudget.base +
    // perFloor × profondeur, pour réduire les morts "sans avoir vu l'escalier" sur les étages
    // tardifs (mobs/distances plus coûteux) sans supprimer la pression du temps.
    gameState.maxTime = config.floorTimeBudget.base + config.floorTimeBudget.perFloor * (gameState.currentFloor - 1);
    gameState.timeLeft = gameState.maxTime; // Réinitialisation du temps
    gameState.floorMap = null;
    // Tally du nouvel étage repart à zéro — celui qui vient de se terminer a déjà été affiché sur
    // l'écran d'escalier (voir triggerFloorTransition()) avant cet appel.
    // Bilan de l'étage qui vient de finir, pour les piques de l'émission DeathWatch (chantier 4).
    const lastFloorForShow = { ...gameState.floorStats, traps: gameState.runStats ? gameState.runStats.trapsThisFloor : 0 };
    gameState.floorStats = { mobsKilled: 0, damageTaken: 0, itemsFound: 0, xpGained: 0 };

    // Réversion de l'éventuelle bénédiction du Pacte du Crawler (PACTE_DU_CRAWLER, voir
    // choosePactBlessing()) DE L'ÉTAGE PRÉCÉDENT, avant même de tirer les anomalies du nouvel étage.
    if (gameState.pactBlessingDelta) {
        gameState.atk = Math.max(1, gameState.atk - gameState.pactBlessingDelta.atk);
        gameState.baseMaxHp -= gameState.pactBlessingDelta.hp;
        gameState.pactBlessingDelta = null;
    }

    // Anomalies du nouvel étage : AVANT la génération de la carte (extraRoomsPct de LABYRINTHE doit
    // influencer generateFloorMap()/generateQuadrant()) — voir rollAndApplyFloorAnomalies().
    rollAndApplyFloorAnomalies(gameState.currentFloor);
    recomputeMaxHp(); // Applique l'éventuel playerMaxHpMult du nouvel étage (PEAU_DE_VERRE)

    // Multiple de 3 (voir config.urbanFloors) : étage urbain (villes explorables reliées par des routes,
    // chantier 12) plutôt que le donjon classique à 4 quartiers.
    if (gameState.currentFloor % 3 === 0) {
        generateUrbanFloorMap();
    } else {
        generateFloorMap(); // Nouvelle zone circulaire à 4 quartiers pour ce nouvel étage
    }

    showFloorArrivalScene();
    logEvent(`--- DÉBUT DE L'ÉTAGE ${gameState.currentFloor} ---`, "info");
    evolveStarterBuff(); // Foutu pour foutu encore actif à l'étage 2 : devient Boxeur (chantier 14)
    // Fin de la Période d'essai (chantier 15) : annoncée une fois, à l'arrivée sur l'étage suivant le dernier étage protégé, si elle protégeait encore.
    if (config.earlyGame.enabled && gameState.currentFloor === config.earlyGame.maxFloor + 1 && trialDamageMult(gameState.level, config.earlyGame.maxFloor) < 1) {
        logEvent("🎟️ Votre contrat de stagiaire expire. Fin de la période d'essai : à partir d'ici, plus aucune remise sur la douleur.", "danger");
    }
    attemptCompanionDeparture(); // Seul moment où un compagnon peu loyal peut partir (voir config.companions.loyalty)
    recordRunEvent('floor');
    if (gameState.activeAnomalies.length > 0) {
        logEvent(`⚠️ Anomalie(s) active(s) : ${gameState.activeAnomalies.map(a => `${a.icon} ${a.name}`).join(', ')}.`, "danger");
    }
    updateAnomalyStatusUI();

    // PACTE_DU_CRAWLER : choix forcé à l'entrée de l'étage, résolu AVANT de rendre la main au joueur
    // (isActionBlocked() le bloque comme n'importe quel autre choix en attente).
    // Race puis classe (chantier 13) : à l'arrivée sur l'étage 3, AVANT le Pacte et l'émission, seulement dans une vraie partie.
    const originDue = originChoiceDue();
    if (originDue) triggerRaceChoice();
    if (gameState.anomalyEffects.forcedPactChoice) {
        if (originDue) gameState.pendingPactAfterOrigin = true; // ouvert par finishOriginChoice()
        else triggerPactChoice();
    }

    // Émission DeathWatch (chantier 4) : à chaque nouvel étage dès config.show.firstFloor — après le Pacte
    // s'il vient d'être proposé (jamais deux choix bloquants affichés en même temps). Comme les succès,
    // seulement dans une vraie partie (gameState.saveEnabled : nom confirmé), jamais pendant
    // l'initialisation silencieuse ni dans les tests qui ne la demandent pas.
    if (gameState.saveEnabled && gameState.currentFloor >= config.show.firstFloor) {
        if (gameState.pactChoicePending || gameState.raceChoicePending || gameState.classChoicePending) gameState.pendingShowAfterPact = lastFloorForShow;
        else triggerShow(lastFloorForShow);
    }

    updateUI();
}

// Titres sarcastiques de l'écran d'escalier (voir triggerFloorTransition()) — {{floor}} remplacé par
// l'étage qui vient d'être franchi. Tirage aléatoire à chaque transition.
const FLOOR_TRANSITION_TITLES = [
    "Vous avez survécu à l'étage {{floor}}. Vos parents seraient... perplexes.",
    "Étage {{floor}} terminé. Statistiquement, vous auriez dû mourir.",
    "Bravo, l'étage {{floor}} est derrière vous. L'audience est presque déçue.",
    "Étage {{floor}} : terminé. Le service des paris est en pleine confusion.",
    "Vous quittez l'étage {{floor}} sur vos deux jambes. Un exploit que même vous n'expliquez pas.",
    "L'étage {{floor}} vous laisse partir. Les producteurs notent ça pour plus tard.",
    "Étage {{floor}} : survécu. Le sponsor retire discrètement sa clause d'assurance-vie.",
    "Fin de l'étage {{floor}}. Le Donjon prend des notes sur ce qui a raté."
];

// Annonce de l'anomalie du PROCHAIN étage sur l'écran d'escalier : tire réellement les anomalies de
// `nextFloor` (rollFloorAnomalies(), anomalies.js) et les MÉMORISE (gameState.pendingNextFloorAnomalies)
// pour que rollAndApplyFloorAnomalies() (appelé par advanceToNextFloor() au clic sur "Continuer")
// applique exactement ce qui vient d'être annoncé, jamais un second tirage indépendant. Retourne
// { name, description } ou null (rien à annoncer) : triggerFloorTransition() gère déjà les deux cas.
function getUpcomingAnomalyAnnouncement(nextFloor) {
    const rolled = rollFloorAnomalies(nextFloor);
    gameState.pendingNextFloorAnomalies = { floor: nextFloor, anomalies: rolled };
    if (rolled.length === 0) return null;
    return {
        name: rolled.map(a => `${a.icon} ${a.name}`).join(' + '),
        description: rolled.map(a => a.description).join(' ')
    };
}

// Affiche l'écran d'escalier (félicitations) : résumé du tally de l'étage qui vient de se terminer
// (gameState.floorStats, encore intact — advanceToNextFloor() le remet à zéro APRÈS, voir le bouton
// "Continuer") et annonce de l'anomalie du prochain étage. gameState.floorTransitionPending (inclus
// dans isActionBlocked(), comme un choix de boss/marchand/repaire) plutôt que gameState.inCombat :
// cette dernière collisionnerait avec la logique générique "combat sans ennemi -> on referme" que
// plusieurs endroits appliquent (dont l'auto-résolveur de tests/long_playthrough.js), qui reste vraie
// pour un vrai combat terminé mais pas pour cet écran, qui doit rester ouvert jusqu'au clic explicite
// sur "Continuer".
function triggerFloorTransition() {
    const completedFloor = gameState.currentFloor;
    const stats = gameState.floorStats;
    gameState.floorTransitionPending = true;
    ui.combatZone.classList.add('hidden');

    if (ui.floorTransitionTitle) {
        ui.floorTransitionTitle.innerText = pick(FLOOR_TRANSITION_TITLES).replace('{{floor}}', completedFloor);
    }
    if (ui.floorTransitionMobs) ui.floorTransitionMobs.innerText = stats.mobsKilled;
    if (ui.floorTransitionDamage) ui.floorTransitionDamage.innerText = stats.damageTaken;
    if (ui.floorTransitionItems) ui.floorTransitionItems.innerText = stats.itemsFound;
    if (ui.floorTransitionXp) ui.floorTransitionXp.innerText = stats.xpGained;

    const nextFloorNumber = completedFloor + 1;
    const announcement = getUpcomingAnomalyAnnouncement(nextFloorNumber);
    if (ui.floorTransitionAnomaly) {
        ui.floorTransitionAnomaly.classList.toggle('hidden', !announcement);
        if (announcement && ui.floorTransitionAnomalyText) {
            ui.floorTransitionAnomalyText.innerText = `L'étage ${nextFloorNumber} vous est présenté par... ${announcement.name}. ${announcement.description} Bon courage.`;
        }
    }

    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.remove('hidden');
    renderScene('stairs');
    updateUI();
}

// Bouton "Continuer" de l'écran d'escalier : referme l'écran et fait effectivement passer à l'étage
// suivant (voir advanceToNextFloor()).
function continueFromFloorTransition() {
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    gameState.floorTransitionPending = false;
    advanceToNextFloor();
}

// Escalier libre (gardien vaincu, ou ville-escalier sans gardien) : au lieu de passer tout de suite à
// l'étage suivant, propose « Descendre » (écran d'escalier, voir triggerFloorTransition()) ou « Rester
// sur l'étage » (finir d'explorer, se soigner…). Bloque via gameState.stairsChoicePending (inclus dans
// isActionBlocked()), comme un choix de boss. `context` : { kind: 'room', roomId } — la salle de l'escalier
// (gardien vaincu ou escalier libre d'un étage urbain) est marquée 🪜 sur la carte, pour pouvoir y revenir
// quoi qu'il arrive. Le choix est reproposé à chaque retour (enterRoom()). La Sortie de l'étage final n'y
// passe jamais (victoire immédiate, choix de l'utilisateur).
function offerStairsChoice(context) {
    gameState.stairsChoicePending = true;
    gameState.pendingStairsChoice = context;
    setSceneHeader('🪜', 'Escalier', 'Escalier', 'stairs');
    logEvent(`L'escalier vers l'étage ${gameState.currentFloor + 1} est libre. Descendre maintenant, ou rester sur cet étage ?`, "info");
    if (ui.stairsChoiceZone) ui.stairsChoiceZone.classList.remove('hidden');
    updateUI();
}

// Referme le choix d'escalier (les deux boutons).
function closeStairsChoice() {
    const context = gameState.pendingStairsChoice;
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;
    if (ui.stairsChoiceZone) ui.stairsChoiceZone.classList.add('hidden');
    return context;
}

// Bouton « Descendre » : ouvre l'écran d'escalier (résumé de l'étage, anomalie du suivant).
function descendStairs() {
    if (!gameState.stairsChoicePending) return;
    closeStairsChoice();
    recordRunEvent('descend', { timeLeft: gameState.timeLeft });
    triggerFloorTransition(); // triggerFloorTransition() appelle déjà updateUI()
}

// Bouton « Rester sur l'étage » : aucun effet, on reprend l'exploration (le temps continue de s'écouler) ;
// l'escalier reste marqué 🪜 sur la carte.
function stayOnFloor() {
    if (!gameState.stairsChoicePending) return;
    closeStairsChoice();
    logEvent("Vous laissez l'escalier pour plus tard : il reste marqué sur votre carte.", "info");
    updateUI();
}

// ==========================================
// ANOMALIES D'ÉTAGE : UI (badge permanent + choix forcé PACTE_DU_CRAWLER)
// ==========================================

// Affiche en permanence le(s) badge(s) icône+nom des anomalies actives (voir gameState.activeAnomalies,
// posé par rollAndApplyFloorAnomalies()) dans l'UI de l'étage — description complète accessible via le
// `title` (infobulle native du navigateur, "inspection"), sans construire de modale dédiée.
function updateAnomalyStatusUI() {
    if (!ui.anomalyStatusBar) return;
    const active = gameState.activeAnomalies || [];
    if (active.length === 0) {
        ui.anomalyStatusBar.classList.add('hidden');
        ui.anomalyStatusBar.innerHTML = '';
        return;
    }
    ui.anomalyStatusBar.classList.remove('hidden');
    ui.anomalyStatusBar.innerHTML = active.map(a =>
        `<span title="${a.name} — ${a.description}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-700 text-purple-300 text-[10px] font-bold uppercase tracking-widest cursor-help">${a.icon} ${a.name}</span>`
    ).join('');
}

// PACTE_DU_CRAWLER : choix forcé à l'entrée de l'étage (voir advanceToNextFloor()). Bloque via
// gameState.pactChoicePending (inclus dans isActionBlocked()), comme un choix de boss/marchand/repaire.
function triggerPactChoice() {
    gameState.pactChoicePending = true;
    setSceneHeader('🤝', 'Pacte du Crawler', 'Anomalie', 'pact');
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.remove('hidden');
    logEvent("🤝 Le Pacte du Crawler vous est proposé : bénédiction ATQ, ou bénédiction PV ?", "danger");
}

// Chiffres non fournis par la consigne d'origine (voir anomalies.js) : bonus/malus de départ,
// à ajuster par playtest réel comme le reste des chiffres d'équilibrage du jeu.
const PACT_BLESSING_ATK_BONUS = 4;
const PACT_BLESSING_ATK_HP_PENALTY = 15;
const PACT_BLESSING_HP_BONUS = 30;
const PACT_BLESSING_HP_ATK_PENALTY = 3;

// Résout le choix du Pacte : applique directement le delta {atk, hp} (mémorisé dans
// gameState.pactBlessingDelta pour être annulé au tout début du PROCHAIN advanceToNextFloor(), voir
// ce fichier) — jamais un multiplicateur permanent, contrairement à PEAU_DE_VERRE.
function choosePactBlessing(choice) {
    if (!gameState.pactChoicePending) return;
    const atkDelta = choice === 'atk' ? PACT_BLESSING_ATK_BONUS : -PACT_BLESSING_HP_ATK_PENALTY;
    const hpDelta = choice === 'atk' ? -PACT_BLESSING_ATK_HP_PENALTY : PACT_BLESSING_HP_BONUS;

    gameState.atk = Math.max(1, gameState.atk + atkDelta);
    gameState.baseMaxHp = Math.max(1, gameState.baseMaxHp + hpDelta);
    recomputeMaxHp();
    gameState.pactBlessingDelta = { atk: atkDelta, hp: hpDelta };

    gameState.pactChoicePending = false;
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.add('hidden');
    logEvent(
        choice === 'atk'
            ? `Bénédiction ATQ acceptée : +${atkDelta} ATQ, ${hpDelta} PV max.`
            : `Bénédiction PV acceptée : +${hpDelta} PV max, ${atkDelta} ATQ.`,
        "success"
    );
    // Émission DeathWatch mise en attente derrière le Pacte (voir advanceToNextFloor()).
    if (gameState.pendingShowAfterPact) {
        const lastFloor = gameState.pendingShowAfterPact;
        gameState.pendingShowAfterPact = null;
        triggerShow(lastFloor);
    }
    updateUI();
}
