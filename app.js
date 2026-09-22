// app.js - Moteur principal du Rogue-like textuel (Crawler)
// Conçu pour s'interfacer avec index.html

// ==========================================
// 1. ÉTAT DU JEU (State)
// ==========================================
const gameState = {
    playerName: "CRAWLER_01",
    hp: 100,
    maxHp: 100,
    atk: 10, // Dégâts de base infligés par round de combat
    def: 5,  // Réduction des dégâts subis par round de combat
    level: 1,
    xp: 0,
    xpToNextLevel: 50,
    // Compétences par type d'attaque : progressent uniquement à l'usage en combat (XP dédiée)
    skills: {
        weapon: { level: 1, xp: 0, xpToNext: 30 },
        unarmed: { level: 1, xp: 0, xpToNext: 30 },
        magic: { level: 1, xp: 0, xpToNext: 30 },
        stealth: { level: 1, xp: 0, xpToNext: 30 }
    },
    timeLeft: 100,
    maxTime: 100, // Temps alloué pour un niveau
    currentFloor: 1,
    // Reflète toujours le quartier (quadrant) où se trouve actuellement le joueur ; posé par
    // generateFloorMap() à chaque étage, puis mis à jour à chaque changement de quadrant.
    currentDistrict: null,
    inventory: [],
    maxInventory: 5,
    equipment: {
        weapon: null, // Objet de catégorie 'weapons' équipé, ou null
        armor: null,  // Objet de catégorie 'armors' équipé, ou null
        ranged: null  // Objet de catégorie 'ranged' équipé, ou null (utilisé en posture "à distance")
    },
    // Posture de combat : 'melee' (défaut, comportement historique) ou 'ranged'. Togglable en
    // combat via le bouton de posture. N'a d'effet sur les échanges que si elle diverge de la
    // nature du monstre affronté (mob.ranged) — voir getCombatRangeContext().
    stance: 'melee',
    // Écart de distance courant, actif uniquement quand stance et mob.ranged divergent (sinon 0 =
    // aucun effet, comportement identique à avant cette fonctionnalité). Voir config.rangedCombat.
    combatDistance: 0,
    status: {
        bleed: null,     // { rounds, dmgPerRound } ou null
        stunned: false,  // Rate son prochain tour si vrai
        slowed: null,    // { rounds } : dégâts infligés par le joueur divisés par 2 pendant ces rounds
        confused: null,  // { rounds } : chance de rater complètement son attaque pendant ces rounds
        disarmed: null,  // { rounds } : l'attaque à l'arme est indisponible pendant ces rounds (arrachée)
        blinded: null    // { rounds } : DEF effective réduite (moins de dégâts adverses parés) pendant ces rounds
    },
    cardsDrawnThisFloor: 0, // Compteur informatif (pièces neuves explorées cet étage), plus utilisé pour l'escalier
    inCombat: false, // Verrouille l'avancée si un combat est en cours
    currentEnemy: null, // Ennemi généré procéduralement, actif pendant un combat
    pendingStairAfterCombat: false, // Si vrai, gagner le combat en cours ouvre l'étage suivant
    pendingBossRoomId: null, // Room id de la salle de boss en cours de combat, pour la marquer vaincue à la victoire
    bossChoicePending: false, // Une salle de boss vient d'être trouvée, décision combattre/repérer en attente
    stealthChoicePending: false, // Un ennemi non repéré attend une décision (esquiver/attaque furtive)
    pendingStealthEncounter: null, // L'ennemi généré, en attente de cette décision
    pendingSneakAttack: false, // Consommé par le tout premier coup porté (bonus x2)
    pendingBossEncounter: null, // { roomId, guardsStairs } pendant que bossChoicePending est vrai
    knownLocations: [], // Lieux repérés : { id, type: 'stairs'|'boss'|'safeRoom', roomId, label }
    pendingTravel: null, // { destination, ambushesRemaining } pendant un trajet vers un lieu connu
    // Carte de l'étage courant : une zone circulaire divisée en 4 quartiers fixes, chacun un
    // graphe de pièces/couloirs (voir generateFloorMap()). roomsById aplatit les 4 quartiers en
    // un seul graphe (les jonctions inter-quartiers sont des arêtes comme les autres), ce qui
    // simplifie le calcul de distance (computeDistance()). Rien de tout ceci n'est affiché.
    floorMap: null,
    companion: null, // Compagnon actuellement recruté (ou null)
    pendingCompanionCandidate: null, // Candidat en attente de décision (recruter/laisser/fuir/attaquer)
    companionChoicePending: false // Une décision de compagnon est en attente
};

// ==========================================
// CONFIGURATION ET BASES DE DONNÉES
// ==========================================
const config = {
    // Probabilités des événements (D100), pour les pièces "normales" du graphe uniquement — les
    // salles sécurisées et les salles de boss ne sont plus tirées ici : ce sont des pièces fixes
    // posées à la génération de l'étage (voir generateFloorMap()), pas des événements aléatoires.
    // Somme = 100.
    chances: {
        // NOTE : "districtChange" et "safeRoom" ont été retirés de cette table (12+8=20 points
        // repliés sur "nothing") : le changement de quartier se fait maintenant en traversant une
        // jonction du graphe, et les salles sécurisées sont des pièces fixes du niveau. En
        // attendant le rééquilibrage complet de cette table (proposition faite, pas encore validée).
        nothing: 40,        // Rien de notable
        combat: 25,         // Rencontre hostile
        loot: 1,            // Objet généré procéduralement (rare)
        trap: 10,           // NOUVEAU : piège avec de vrais dégâts
        timeLoss: 8,        // NOUVEAU : détour qui coûte du temps
        minorFind: 6,       // NOUVEAU : petite trouvaille (soin mineur)
        audienceGift: 4,    // NOUVEAU : cadeau des spectateurs (petit bonus d'XP), clin d'œil à l'émission
        companionEncounter: 3, // NOUVEAU : rencontre d'un autre crawler (ami ou hostile, 50/50)
        flavorOnly: 3       // Pur moment narratif, sans effet mécanique (réduit de 6 à 3 pour compenser)
    },
    // "stairGuardedChance" a été retiré : l'escalier est désormais TOUJOURS gardé par le boss de
    // son quartier (placement déterministe, voir generateFloorMap()), plus un tirage au hasard.

    // Taux de croissance des stats des monstres (mobs normaux et boss) par étage de profondeur,
    // utilisés par getFloorScaling()/applyFloorScaling() dans generator.js. À l'étage 1, aucun
    // bonus (multiplicateur = 1) ; chaque étage suivant ajoute ce taux au multiplicateur.
    // Valeurs de départ, à ajuster par playtest réel (pas de combat de référence à ce stade).
    floorScaling: {
        hp: 0.22,  // +22% de PV par étage de profondeur
        atk: 0.12, // +12% d'ATQ par étage de profondeur
        def: 0.10, // +10% de DEF par étage de profondeur
        xp: 0.18   // +18% d'XP donnée par étage de profondeur (suit la difficulté accrue)
    },

    // Paramètres du combat à distance (posture "ranged" vs mobs marqués `ranged: true` dans
    // bestiary.js). Voir getCombatRangeContext()/resolveDistanceRound() dans app.js.
    rangedCombat: {
        initialDistance: 4,     // Écart de départ quand les postures divergent (en "unités")
        maxDistance: 8,         // Plafond de l'écart (ne peut pas s'éloigner indéfiniment)
        dieSides: 6,            // Taille du dé opposé lancé chaque manche par le joueur ET le mob
        levelAdvantageDivisor: 4 // Bonus au dé du joueur = floor(niveau / ce diviseur)
    }
};

// Bibliothèque de textes pour varier la narration selon la catégorie d'événement tirée
const flavorText = {
    nothing: [
        "Le couloir est vide. Le silence est oppressant.",
        "Vous n'entendez que l'écho de vos propres pas.",
        "Rien ne bouge. Même les néons semblent retenir leur souffle.",
        "Un calme suspect règne ici. Vous avancez sans encombre."
    ],
    trap: [
        { text: "Une lame dissimulée jaillit du mur et vous entaille.", dmgMin: 5, dmgMax: 15 },
        { text: "Le sol se dérobe sous vos pieds ; vous chutez lourdement.", dmgMin: 8, dmgMax: 18 },
        { text: "Un gaz corrosif s'échappe d'une conduite fissurée.", dmgMin: 5, dmgMax: 12 },
        { text: "Une décharge électrique traverse une rambarde métallique que vous touchez.", dmgMin: 6, dmgMax: 16 }
    ],
    timeLoss: [
        "Vous vous perdez dans un dédale de couloirs identiques.",
        "Une fausse porte vous fait rebrousser chemin.",
        "Vous devez attendre qu'un mécanisme de sécurité se réarme.",
        "Un détour s'impose pour éviter une zone visiblement instable."
    ],
    minorFind: [
        "Vous trouvez les restes encore mangeables d'un ancien crawler.",
        "Une trousse de premiers secours abandonnée traîne dans un coin.",
        "Une fontaine à eau, miraculeusement encore en état de marche.",
        "Un distributeur de vitamines périmées, mais ça se mange."
    ],
    audienceGift: [
        "Les spectateurs, amusés, vous envoient une prime en direct !",
        "Un sponsor anonyme salue votre performance télégénique.",
        "L'audience s'enflamme pour votre progression et vous récompense.",
        "Le producteur de l'émission juge votre parcours \"excellent pour l'audimat\"."
    ],
    flavorOnly: [
        "Une pub holographique pour des nouilles instantanées s'affiche puis disparaît.",
        "Vous croisez un panneau publicitaire vantant les mérites du Donjon.",
        "Une voix off anonyme commente votre progression, indifférente.",
        "Un vieux poster décoloré affiche le règlement de l'émission, illisible."
    ]
};

// Choisit un élément au hasard dans un tableau
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Note : les quartiers viennent de `districts` (districts.js), le catalogue d'objets de `baseItems` (items.js).

// ==========================================
// SÉLECTION DES ÉLÉMENTS DU DOM
// ==========================================
const ui = {
    playerName: document.getElementById('player-name'),
    floorLevel: document.getElementById('floor-level'),
    districtName: document.getElementById('district-name'),
    compactVitals: document.getElementById('player-vitals-compact'),
    compactHpRing: document.getElementById('compact-hp-ring'),
    compactHpValue: document.getElementById('compact-hp-value'),
    playerAtk: document.getElementById('player-atk'),
    playerDef: document.getElementById('player-def'),
    activeCard: document.getElementById('active-card'),
    cardTypeLabel: document.getElementById('card-type-label'),
    cardFloorLabel: document.getElementById('card-floor-label'),
    cardIcon: document.getElementById('card-icon'),
    cardTitle: document.getElementById('card-title'),
    cardBody: document.getElementById('card-body'),
    fullLog: document.getElementById('full-log'),
    playerLevel: document.getElementById('player-level'),
    xpBar: document.getElementById('xp-bar'),
    xpText: document.getElementById('xp-text'),
    skillWeaponLevel: document.getElementById('skill-weapon-level'),
    skillWeaponBar: document.getElementById('skill-weapon-bar'),
    skillUnarmedLevel: document.getElementById('skill-unarmed-level'),
    skillUnarmedBar: document.getElementById('skill-unarmed-bar'),
    skillMagicLevel: document.getElementById('skill-magic-level'),
    skillMagicBar: document.getElementById('skill-magic-bar'),
    skillStealthLevel: document.getElementById('skill-stealth-level'),
    skillStealthBar: document.getElementById('skill-stealth-bar'),
    timeText: document.getElementById('time-text'),
    timeBar: document.getElementById('time-bar'),
    inventoryCount: document.getElementById('inventory-count'),
    consumableQuickbar: document.getElementById('consumable-quickbar'),
    inventoryEquipmentCards: document.getElementById('inventory-equipment-cards'),
    inventoryConsumablesIcons: document.getElementById('inventory-consumables-icons'),
    equippedWeapon: document.getElementById('equipped-weapon'),
    equippedArmor: document.getElementById('equipped-armor'),
    playerStatusIcons: document.getElementById('player-status-icons'),
    combatSideEnemy: document.getElementById('combat-side-enemy'),
    combatSidePlayer: document.getElementById('combat-side-player'),
    combatEnemyHp: document.getElementById('combat-enemy-hp'),
    combatEnemyHpRing: document.getElementById('combat-enemy-hp-ring'),
    combatEnemyStatus: document.getElementById('combat-enemy-status'),
    combatEnemyDie: document.getElementById('combat-enemy-die'),
    combatPlayerHp: document.getElementById('combat-player-hp'),
    combatPlayerHpRing: document.getElementById('combat-player-hp-ring'),
    combatPlayerStatus: document.getElementById('combat-player-status'),
    combatPlayerDie: document.getElementById('combat-player-die'),
    cardStackWrapper: document.getElementById('card-stack-wrapper'),
    advanceHint: document.getElementById('advance-hint'),
    bossChoiceZone: document.getElementById('boss-choice-zone'),
    btnFightBoss: document.getElementById('btn-fight-boss'),
    btnRetreatBoss: document.getElementById('btn-retreat-boss'),
    stealthChoiceZone: document.getElementById('stealth-choice-zone'),
    btnStealthEvade: document.getElementById('btn-stealth-evade'),
    btnStealthAttack: document.getElementById('btn-stealth-attack'),
    gameOverOverlay: document.getElementById('game-over-overlay'),
    gameOverReason: document.getElementById('game-over-reason'),
    gameOverFloor: document.getElementById('game-over-floor'),
    gameOverLevel: document.getElementById('game-over-level'),
    gameOverDistrict: document.getElementById('game-over-district'),
    btnRestart: document.getElementById('btn-restart'),
    combatZone: document.getElementById('combat-zone'),
    knownLocationsContainer: document.getElementById('known-locations'),
    companionChoiceFriendly: document.getElementById('companion-choice-friendly'),
    companionChoiceHostile: document.getElementById('companion-choice-hostile'),
    btnRecruitFriendly: document.getElementById('btn-recruit-friendly'),
    btnDeclineCompanion: document.getElementById('btn-decline-companion'),
    btnFleeCompanion: document.getElementById('btn-flee-companion'),
    btnRecruitHostile: document.getElementById('btn-recruit-hostile'),
    btnAttackCompanion: document.getElementById('btn-attack-companion'),
    companionStatusBar: document.getElementById('companion-status-bar'),
    companionNameDisplay: document.getElementById('companion-name-display'),
    companionSpecialtyDisplay: document.getElementById('companion-specialty-display'),
    companionAggroBar: document.getElementById('companion-aggro-bar'),
    companionCombatIndicator: document.getElementById('companion-combat-indicator'),
    companionCombatName: document.getElementById('companion-combat-name'),
    companionCombatHpRing: document.getElementById('companion-combat-hp-ring'),
    companionCombatHp: document.getElementById('companion-combat-hp'),
    enemyName: document.getElementById('enemy-name'),
    btnAttackWeapon: document.getElementById('btn-attack-weapon'),
    btnAttackUnarmed: document.getElementById('btn-attack-unarmed'),
    btnAttackMagic: document.getElementById('btn-attack-magic'),
    btnFlee: document.getElementById('btn-flee'),
    btnStanceToggle: document.getElementById('btn-stance-toggle'),
    stanceLabel: document.getElementById('stance-label'),
    combatDistanceWrapper: document.getElementById('combat-distance-wrapper'),
    combatDistanceFill: document.getElementById('combat-distance-fill'),
    equippedRanged: document.getElementById('equipped-ranged'),
    btnDevLogs: document.getElementById('btn-dev-logs')
};

// ==========================================
// 5. AFFICHAGE ET MISE À JOUR DE L'UI
// ==========================================
function updateUI() {
    ui.playerName.innerText = gameState.playerName;
    ui.floorLevel.innerText = gameState.currentFloor;
    ui.districtName.innerText = gameState.currentDistrict;
    
    // Mise à jour des PV (anneau circulaire), ATK et DEF
    setHpRing(ui.compactHpRing, ui.compactHpValue, gameState.hp, gameState.maxHp);
    ui.playerAtk.innerText = gameState.atk;
    ui.playerDef.innerText = getEffectiveDef();

    // Le libellé d'étage sur la carte active reste toujours synchronisé
    ui.cardFloorLabel.innerText = `Étage ${gameState.currentFloor}`;

    // Icônes de statut du joueur
    let playerIcons = "";
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🩸";
    if (gameState.status.stunned) playerIcons += "💫";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
    if (gameState.status.confused && gameState.status.confused.rounds > 0) playerIcons += "🌀";
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) playerIcons += "🧲";
    if (gameState.status.blinded && gameState.status.blinded.rounds > 0) playerIcons += "✨";
    if (gameState.status.corroded && gameState.status.corroded.rounds > 0) playerIcons += "🧪";
    if (gameState.status.feared && gameState.status.feared.rounds > 0) playerIcons += "😱";
    if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) playerIcons += "💉";
    ui.playerStatusIcons.innerText = playerIcons;

    // Mise à jour du niveau et de l'XP
    ui.playerLevel.innerText = gameState.level;
    ui.xpText.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    ui.xpBar.style.width = `${Math.min(100, (gameState.xp / gameState.xpToNextLevel) * 100)}%`;

    // Mise à jour de la carte joueur (compétences)
    const skillBarMap = {
        weapon: [ui.skillWeaponLevel, ui.skillWeaponBar],
        unarmed: [ui.skillUnarmedLevel, ui.skillUnarmedBar],
        magic: [ui.skillMagicLevel, ui.skillMagicBar],
        stealth: [ui.skillStealthLevel, ui.skillStealthBar]
    };
    for (const key in skillBarMap) {
        const skill = gameState.skills[key];
        const [levelEl, barEl] = skillBarMap[key];
        levelEl.innerText = `Nv.${skill.level}`;
        barEl.style.width = `${Math.min(100, (skill.xp / skill.xpToNext) * 100)}%`;
    }
    
    // Mise à jour du temps
    ui.timeText.innerText = `${gameState.timeLeft} H`;
    const timePercentage = (gameState.timeLeft / gameState.maxTime) * 100;
    ui.timeBar.style.width = `${timePercentage}%`;
    
    // Changer la couleur de la barre si le temps est critique
    if (timePercentage <= 20) {
        ui.timeBar.classList.replace('bg-blue-600', 'bg-red-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(220, 38, 38, 1)";
    } else {
        ui.timeBar.classList.replace('bg-red-600', 'bg-blue-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(37, 99, 235, 1)";
    }

    // Gestion de l'affichage du combat : rétrécissement de la carte, panneaux latéraux PV/statut
    if (gameState.inCombat) {
        ui.advanceHint.classList.add('hidden'); // On ne peut pas avancer pendant un combat
        ui.combatZone.classList.remove('hidden');
        ui.compactVitals.classList.add('hidden'); // Les PV sont déjà affichés à droite de la carte
        ui.cardStackWrapper.style.maxWidth = '170px'; // La carte se réduit pour laisser place aux panneaux

        // Panneau joueur (toujours à jour dès qu'on est en combat)
        ui.combatSidePlayer.classList.remove('hidden');
        ui.combatSidePlayer.classList.add('flex', 'flex-col');
        setHpRing(ui.combatPlayerHpRing, ui.combatPlayerHp, gameState.hp, gameState.maxHp);
        let playerIcons = "";
        if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🔥";
        if (gameState.status.stunned) playerIcons += "💫";
        if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
        if (gameState.status.confused && gameState.status.confused.rounds > 0) playerIcons += "🌀";
        if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) playerIcons += "🧲";
        if (gameState.status.blinded && gameState.status.blinded.rounds > 0) playerIcons += "✨";
        if (gameState.status.corroded && gameState.status.corroded.rounds > 0) playerIcons += "🧪";
        if (gameState.status.feared && gameState.status.feared.rounds > 0) playerIcons += "😱";
        if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) playerIcons += "💉";
        ui.combatPlayerStatus.innerText = playerIcons || "—";

        // Indicateur compagnon (à droite, sous le panneau joueur), si un compagnon est actif
        if (gameState.companion) {
            ui.companionCombatIndicator.classList.remove('hidden');
            ui.companionCombatName.innerText = gameState.companion.name;
            setHpRing(ui.companionCombatHpRing, ui.companionCombatHp, gameState.companion.hp, gameState.companion.maxHp);
        } else {
            ui.companionCombatIndicator.classList.add('hidden');
        }

        if (gameState.currentEnemy) {
            ui.enemyName.innerText = gameState.currentEnemy.isBoss
                ? `👑 ${gameState.currentEnemy.name}`
                : gameState.currentEnemy.name;
            ui.enemyName.classList.toggle('text-yellow-400', !!gameState.currentEnemy.isBoss);

            ui.combatSideEnemy.classList.remove('hidden');
            ui.combatSideEnemy.classList.add('flex', 'flex-col');
            setHpRing(ui.combatEnemyHpRing, ui.combatEnemyHp, gameState.currentEnemy.hp, gameState.currentEnemy.maxHp);

            let enemyIcons = "";
            const enemyStatus = gameState.currentEnemy.status;
            if (enemyStatus) {
                if (enemyStatus.bleed && enemyStatus.bleed.rounds > 0) enemyIcons += "🔥";
                if (enemyStatus.stunned) enemyIcons += "💫";
                if (enemyStatus.slowed && enemyStatus.slowed.rounds > 0) enemyIcons += "🐌";
                if (enemyStatus.blinded && enemyStatus.blinded.rounds > 0) enemyIcons += "✨";
                if (enemyStatus.corroded && enemyStatus.corroded.rounds > 0) enemyIcons += "🧪";
                if (enemyStatus.feared && enemyStatus.feared.rounds > 0) enemyIcons += "😱";
            }
            ui.combatEnemyStatus.innerText = enemyIcons || "—";
        }

        // --- Posture / distance de combat ---
        if (ui.stanceLabel) ui.stanceLabel.innerText = gameState.stance === 'ranged' ? "À distance" : "Corps à corps";
        if (ui.btnAttackUnarmed) ui.btnAttackUnarmed.classList.toggle('hidden', gameState.stance === 'ranged');
        if (ui.btnAttackWeapon) {
            ui.btnAttackWeapon.innerText = gameState.stance === 'ranged' ? "🏹 Tir" : "⚔️ Arme";
        }
        const rangeCtx = getCombatRangeContext();
        if (ui.combatDistanceWrapper) {
            ui.combatDistanceWrapper.classList.toggle('hidden', !rangeCtx.active);
        }
        if (ui.combatDistanceFill && rangeCtx.active) {
            const pct = Math.round((gameState.combatDistance / config.rangedCombat.maxDistance) * 100);
            ui.combatDistanceFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
            ui.combatDistanceFill.classList.toggle('bg-cyan-600', rangeCtx.playerAdvantaged);
            ui.combatDistanceFill.classList.toggle('bg-red-600', rangeCtx.playerDisadvantaged);
        }
    } else {
        ui.advanceHint.classList.toggle('hidden', gameState.bossChoicePending || gameState.stealthChoicePending);
        ui.combatZone.classList.add('hidden');
        ui.compactVitals.classList.remove('hidden'); // On réaffiche les PV compacts hors combat
        ui.cardStackWrapper.style.maxWidth = '240px'; // Retour à la taille normale hors combat
        updateCompanionUI(); // Réaffiche/actualise la barre compagnon compacte hors combat

        ui.combatSideEnemy.classList.add('hidden');
        ui.combatSideEnemy.classList.remove('flex', 'flex-col');
        ui.combatSidePlayer.classList.add('hidden');
        ui.combatSidePlayer.classList.remove('flex', 'flex-col');
    }

    // Les distances affichées dans "Lieux connus" dépendent de la position actuelle : on les
    // rafraîchit à chaque rendu pour qu'elles restent toujours à jour sans action explicite.
    updateKnownLocationsUI();
}

// Affiche un résultat de dégâts sous forme de "dé" avec une petite animation, sur le panneau
// latéral correspondant (joueur ou ennemi). `value` peut être un nombre ou un court symbole (ex: "✗").
// Circonférence du cercle de l'anneau de vie (rayon 18 : 2 * π * 18 ≈ 113.1), utilisée pour
// convertir un pourcentage de PV en longueur de trait visible (stroke-dashoffset).
const HP_RING_CIRCUMFERENCE = 113.1;

// Calcule une couleur en dégradé vert -> jaune -> rouge selon le pourcentage de PV restant,
// via la teinte HSL (120° = vert, 60° = jaune, 0° = rouge).
function hpColor(pct) {
    const hue = Math.max(0, Math.min(120, Math.round(pct * 120)));
    return `hsl(${hue}, 85%, 45%)`;
}

// Met à jour un anneau de vie circulaire (remplissage + couleur) et le nombre affiché en son centre.
function setHpRing(ringEl, valueEl, current, max) {
    const safeMax = max > 0 ? max : 1; // évite une division par zéro si jamais max vaut 0
    const pct = Math.max(0, Math.min(1, current / safeMax));
    ringEl.style.strokeDashoffset = HP_RING_CIRCUMFERENCE * (1 - pct);
    ringEl.style.stroke = hpColor(pct);
    valueEl.innerText = Math.max(0, Math.round(current));
}

function showDie(el, value) {
    el.innerText = value;
    el.classList.remove('die-pop');
    void el.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    el.classList.add('die-pop');
}

// Retour haptique (vibration). Fonctionne sur Android/Chrome ; iOS Safari ne supporte pas du tout
// l'API Vibration, quel que soit le navigateur — aucune vibration n'y sera donc perceptible. On
// vérifie la disponibilité avant d'appeler pour ne jamais lever d'erreur sur les navigateurs sans
// support (au lieu de planter silencieusement, on ignore proprement).
function triggerHaptic(pattern = 'light') {
    if (!('vibrate' in navigator)) return;
    const patterns = {
        light: 15,           // Un dé qui touche sa cible
        medium: 30,          // Une carte qu'on tire
        heavy: [30, 40, 60],  // Victoire, défaite, montée de niveau
    };
    try {
        navigator.vibrate(patterns[pattern] || patterns.light);
    } catch (e) {
        // Certains navigateurs peuvent lever une exception si l'appel est bloqué (ex: onglet en arrière-plan)
    }
}

// Anime un dé de dégâts qui "vole" vers le compteur de PV de sa cible, façon petit coup de poing.
// `direction` : 'left' (le dé du joueur vole vers les PV ennemis, à gauche) ou 'right' (le dé de
// l'ennemi vole vers les PV du joueur, à droite). `newHpValue` est la valeur déjà décrémentée
// (le calcul des PV réels a lieu avant l'appel ; cette fonction ne fait que l'afficher au bon moment).
function animateDieHit(dieEl, direction, value, ringEl, valueEl, newHpValue, maxHpValue) {
    dieEl.innerText = value;
    dieEl.classList.remove('die-pop', 'die-hit-left', 'die-hit-right');
    void dieEl.offsetWidth;
    dieEl.classList.add('die-pop', direction === 'left' ? 'die-hit-left' : 'die-hit-right');

    // Au moment de l'impact (environ à mi-vol du dé), l'anneau de vie touché se met à jour et vibre
    setTimeout(() => {
        setHpRing(ringEl, valueEl, newHpValue, maxHpValue);
        valueEl.classList.remove('hp-hit');
        void valueEl.offsetWidth;
        valueEl.classList.add('hp-hit');
        triggerHaptic('light');
    }, 180);
}

// Fonction pour ajouter un message : sur la carte active (fond clair) ET dans le journal complet (fond sombre)
function logEvent(message, type = "normal") {
    // Couleurs adaptées au fond clair de la carte (papier crème)
    const cardColors = {
        danger: "text-red-700 font-bold",
        success: "text-green-700 font-bold",
        info: "text-blue-700 italic",
        loot: "text-amber-700 font-bold",
        normal: "text-stone-700"
    };
    const cardLine = document.createElement('p');
    cardLine.className = cardColors[type] || cardColors.normal;
    cardLine.innerText = message;
    ui.cardBody.appendChild(cardLine);
    ui.cardBody.scrollTop = ui.cardBody.scrollHeight;

    // Couleurs adaptées au fond sombre du journal complet (reprend l'ancien style)
    const logColors = {
        danger: "text-red-400 font-bold",
        success: "text-green-400",
        info: "text-blue-300 italic",
        loot: "text-yellow-400 font-bold",
        normal: "text-gray-300"
    };
    const logLine = document.createElement('div');
    logLine.className = logColors[type] || logColors.normal;
    logLine.innerText = `>> ${message}`;
    ui.fullLog.appendChild(logLine);
    ui.fullLog.scrollTop = ui.fullLog.scrollHeight;
}

// Prépare l'en-tête de la carte active (icône, titre, type) : appelé au début de chaque nouvelle
// branche d'événement dans resolveCardEvent(), avant que logEvent() ne remplisse le corps.
function setCardHeader(icon, title, typeLabel) {
    ui.cardIcon.innerText = icon;
    ui.cardTitle.innerText = title;
    ui.cardTypeLabel.innerText = typeLabel;
}

// Petite animation de "pop" à chaque nouvelle carte tirée (voir le commentaire CSS de .card-draw-anim)
function playCardDrawAnimation() {
    ui.activeCard.classList.remove('card-draw-anim');
    void ui.activeCard.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    ui.activeCard.classList.add('card-draw-anim');
}

// Fonction pour mettre à jour l'inventaire visuel
function updateInventoryUI() {
    ui.inventoryCount.innerText = gameState.inventory.length;
    ui.equippedWeapon.innerText = gameState.equipment.weapon ? formatItemDisplayName(gameState.equipment.weapon) : "Aucune";
    ui.equippedArmor.innerText = gameState.equipment.armor ? formatItemDisplayName(gameState.equipment.armor) : "Aucune";
    if (ui.equippedRanged) ui.equippedRanged.innerText = gameState.equipment.ranged ? formatItemDisplayName(gameState.equipment.ranged) : "Aucune";

    // --- Armes / armures / armes à distance : cartes façon carte à jouer, dans le déroulant ---
    ui.inventoryEquipmentCards.innerHTML = "";
    const equipmentIndices = [];
    gameState.inventory.forEach((item, i) => { if (item.category === 'weapons' || item.category === 'armors' || item.category === 'ranged') equipmentIndices.push(i); });

    if (equipmentIndices.length === 0) {
        const empty = document.createElement('p');
        empty.className = "col-span-2 text-[10px] text-gray-600 italic";
        empty.innerText = "Aucune arme ni armure en réserve.";
        ui.inventoryEquipmentCards.appendChild(empty);
    } else {
        equipmentIndices.forEach(i => {
            const item = gameState.inventory[i];
            const isWeapon = item.category === 'weapons';
            const isRanged = item.category === 'ranged';
            const icon = isWeapon ? '⚔️' : (isRanged ? '🏹' : '🛡️');
            const rarityColor = item.rarityColor || "#57534e"; // gris par défaut (objets pré-existants sans rareté)
            const card = document.createElement('div');
            card.className = "mini-card rounded-lg p-2 flex flex-col gap-1 text-center relative";
            card.style.borderColor = rarityColor;
            card.style.borderWidth = "2px";
            const statLine = (isWeapon || isRanged) ? `⚔️ ATK +${item.baseDmg}` : `🛡️ DEF +${item.baseArmor}`;
            card.innerHTML = `
                <div class="text-xl leading-none">${icon}</div>
                <div class="text-[10px] font-bold leading-tight">${item.name}</div>
                ${item.rarity ? `<div class="text-[8px] font-bold uppercase tracking-wider" style="color:${rarityColor}">${item.rarity}</div>` : ""}
                <div class="text-[9px] text-stone-600">${statLine}</div>
                <button data-action="equip" class="mt-1 text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>
                <button data-action="discard" class="absolute top-1 right-1 text-[10px] text-red-700 hover:text-red-500" title="Jeter">🗑️</button>
            `;
            card.querySelector('[data-action="equip"]').addEventListener('click', () => equipItem(i));
            card.querySelector('[data-action="discard"]').addEventListener('click', () => discardItem(i));
            ui.inventoryEquipmentCards.appendChild(card);
        });
    }

    // --- Consommables : icône seule, à la fois dans la barre de raccourci ET dans le déroulant ---
    const consumableIndices = [];
    gameState.inventory.forEach((item, i) => { if (item.category === 'consumables') consumableIndices.push(i); });

    function buildConsumableIcon(i, withDiscard) {
        const item = gameState.inventory[i];
        const wrap = document.createElement('div');
        wrap.className = "relative";
        const btn = document.createElement('button');
        btn.className = "w-9 h-9 flex items-center justify-center bg-gray-950 border border-green-900/50 rounded text-green-400 hover:brightness-125 text-lg";
        btn.innerText = "🧪";
        btn.title = `${item.name} — toucher pour utiliser`;
        btn.addEventListener('click', () => useConsumable(i));
        wrap.appendChild(btn);
        if (withDiscard) {
            const trash = document.createElement('button');
            trash.className = "absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-gray-900 border border-red-800 rounded-full text-[8px] text-red-500 hover:text-red-300";
            trash.innerText = "×";
            trash.title = "Jeter";
            trash.addEventListener('click', (e) => { e.stopPropagation(); discardItem(i); });
            wrap.appendChild(trash);
        }
        return wrap;
    }

    ui.consumableQuickbar.innerHTML = "";
    ui.inventoryConsumablesIcons.innerHTML = "";
    if (consumableIndices.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun consommable.";
        ui.inventoryConsumablesIcons.appendChild(empty);
    } else {
        consumableIndices.forEach(i => {
            ui.consumableQuickbar.appendChild(buildConsumableIcon(i, false));
            ui.inventoryConsumablesIcons.appendChild(buildConsumableIcon(i, true));
        });
    }
}

// ==========================================
// SYSTÈME D'ÉQUIPEMENT ET DE CONSOMMABLES
// ==========================================

// Retire un objet de l'inventaire sans l'utiliser ni l'équiper (bouton 🗑️)
function discardItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;
    gameState.inventory.splice(index, 1);
    logEvent(`Vous jetez [${item.name}].`, "info");
    updateInventoryUI();
}

// Équipe une arme ou une armure. L'éventuel équipement précédent retourne dans l'inventaire
// (jamais de perte d'objet lors d'un changement d'équipement).
// Nom d'affichage d'un objet : ajoute son palier de rareté entre crochets s'il n'est pas Commun
// (ex: "[Épique] Hache à Viande Tranchant et Lourd"), sinon le nom brut.
function formatItemDisplayName(item) {
    if (!item) return "Aucune";
    return item.rarity && item.rarity !== "Commun" ? `[${item.rarity}] ${item.name}` : item.name;
}

function equipItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const slot = item.category === 'weapons' ? 'weapon' : (item.category === 'ranged' ? 'ranged' : 'armor');
    const slotLabel = slot === 'weapon' ? 'Arme' : (slot === 'ranged' ? 'Arme à distance' : 'Armure');
    const previouslyEquipped = gameState.equipment[slot];

    gameState.equipment[slot] = item;
    gameState.inventory.splice(index, 1);
    if (previouslyEquipped) {
        gameState.inventory.push(previouslyEquipped);
    }

    logEvent(`Vous équipez [${formatItemDisplayName(item)}] (${slotLabel}).`, "info");
    updateUI();
    updateInventoryUI();
}

// Consomme un objet de type consommable : soigne puis disparaît de l'inventaire
function useConsumable(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const healAmount = item.heal || 0;
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
    logEvent(`Vous consommez [${item.name}] et récupérez ${healAmount} PV.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================
function resolveCardEvent() {
    // L'escalier et les salles sécurisées ne sont plus tirés ici : ce sont des pièces fixes du
    // graphe de l'étage (voir generateFloorMap() et enterRoom()). Cette fonction ne résout plus
    // que le contenu des pièces "normales".
    const d100 = Math.random() * 100;
    let cumulative = 0;

    // Rien de notable
    cumulative += config.chances.nothing;
    if (d100 < cumulative) {
        setCardHeader('🌑', 'Silence', 'Exploration');
        logEvent(pick(flavorText.nothing), "normal");
        return;
    }

    // Combat : passe d'abord par une tentative de furtivité (voir handleStealthEncounter)
    cumulative += config.chances.combat;
    if (d100 < cumulative) {
        handleStealthEncounter();
        return;
    }

    // Changement de quartier : se fait maintenant en traversant une jonction du graphe pendant
    // explore(), pas via un tirage D100 ici. Salle sécurisée : voir enterRoom() (pièce fixe).

    // Découverte d'objet (générateur procédural)
    cumulative += config.chances.loot;
    if (d100 < cumulative) {
        setCardHeader('💰', 'Trésor', 'Butin');
        logEvent("Vous trébuchez sur quelque chose de brillant...", "info");
        addLoot(getLootPowerScore(null)); // Pas de monstre : estimation par l'étage courant
        return;
    }

    // NOUVEAU : Piège dangereux (vrais dégâts, plusieurs variantes)
    cumulative += config.chances.trap;
    if (d100 < cumulative) {
        const trap = pick(flavorText.trap);
        const dmg = Math.floor(Math.random() * (trap.dmgMax - trap.dmgMin + 1)) + trap.dmgMin;
        gameState.hp = Math.max(0, gameState.hp - dmg);
        setCardHeader('⚠️', 'Piège', 'Danger');
        logEvent(`${trap.text} (-${dmg} PV)`, "danger");
        if (gameState.hp <= 0) {
            gameOver();
            return;
        }
        return;
    }

    // NOUVEAU : Détour qui coûte du temps (la ressource la plus précieuse du jeu)
    cumulative += config.chances.timeLoss;
    if (d100 < cumulative) {
        const lost = Math.floor(Math.random() * 3) + 1; // 1 à 3 heures perdues en plus
        gameState.timeLeft = Math.max(0, gameState.timeLeft - lost);
        setCardHeader('⏳', 'Contretemps', 'Danger');
        logEvent(`${pick(flavorText.timeLoss)} (-${lost}H supplémentaires)`, "danger");
        if (gameState.timeLeft <= 0) {
            gameOver(true);
            return;
        }
        return;
    }

    // NOUVEAU : Petite trouvaille (soin mineur)
    cumulative += config.chances.minorFind;
    if (d100 < cumulative) {
        const heal = Math.floor(Math.random() * 8) + 5; // 5 à 12 PV
        gameState.hp = Math.min(gameState.hp + heal, gameState.maxHp);
        setCardHeader('🎒', 'Petite Trouvaille', 'Butin');
        logEvent(`${pick(flavorText.minorFind)} (+${heal} PV)`, "success");
        return;
    }

    // NOUVEAU : Cadeau des spectateurs (petit bonus d'XP — clin d'œil au format "émission" du livre)
    cumulative += config.chances.audienceGift;
    if (d100 < cumulative) {
        const bonusXp = Math.floor(Math.random() * 6) + 5; // 5 à 10 XP
        setCardHeader('📢', 'Cadeau du Public', 'Bonus');
        logEvent(pick(flavorText.audienceGift), "success");
        gainXp(bonusXp);
        return;
    }

    // NOUVEAU : Rencontre d'un autre crawler (ami ou hostile, un seul compagnon actif à la fois)
    cumulative += config.chances.companionEncounter;
    if (d100 < cumulative) {
        if (gameState.companion) {
            // Déjà accompagné : ce tirage se résout comme un moment calme, pas de rencontre superposée
            setCardHeader('🌑', 'Silence', 'Exploration');
            logEvent(pick(flavorText.nothing), "normal");
            return;
        }

        const candidate = generateCompanionCandidate();
        gameState.pendingCompanionCandidate = candidate;
        gameState.companionChoicePending = true;

        if (candidate.disposition === 'friendly') {
            setCardHeader('🧍', candidate.name, 'Crawler Rencontré');
            logEvent(`Vous croisez ${candidate.name}, un autre crawler. Il semble pacifique et vous propose son aide.`, "info");
            ui.companionChoiceFriendly.classList.remove('hidden');
        } else {
            setCardHeader('🗡️', candidate.name, 'Crawler Hostile');
            logEvent(`Vous croisez ${candidate.name}, un autre crawler. Il vous toise avec hostilité...`, "danger");
            ui.companionChoiceHostile.classList.remove('hidden');
        }
        updateUI();
        return;
    }

    // Reste : moment purement narratif, sans effet mécanique
    setCardHeader('🎬', 'Ambiance', 'Exploration');
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
    let chance = 15 + (gameState.skills.stealth.level - 1) * 6;
    if (gameState.companion && gameState.companion.specialty.type === 'scout') chance += 10;
    if (gameState.equipment.weapon && gameState.equipment.weapon.mechanics && gameState.equipment.weapon.mechanics.includes('stealth')) chance += 15;
    if (gameState.equipment.ranged && gameState.equipment.ranged.mechanics && gameState.equipment.ranged.mechanics.includes('stealth')) chance += 15;
    if (gameState.equipment.armor && gameState.equipment.armor.mechanics && gameState.equipment.armor.mechanics.includes('stealth')) chance += 15;
    return Math.min(75, chance);
}

// Point d'entrée d'une rencontre aléatoire : tente d'abord la furtivité avant de basculer sur un
// combat classique si le monstre repère le joueur.
function handleStealthEncounter() {
    const enemy = generateMob(gameState.currentDistrict);
    const undetected = Math.random() * 100 < getStealthChance();

    if (!undetected) {
        setCardHeader('⚔️', 'Combat', 'Danger');
        logEvent(`Des bruits de pas approchent... Des créatures de ${gameState.currentDistrict} vous attaquent !`, "danger");
        initiateCombat(enemy);
        return;
    }

    gameState.pendingStealthEncounter = enemy;
    gameState.stealthChoicePending = true;
    setCardHeader('🥷', enemy ? enemy.name : 'Ombre', 'Non Repéré');
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

    const evadeChance = Math.min(85, 40 + (gameState.skills.stealth.level - 1) * 8);
    if (Math.random() * 100 < evadeChance) {
        setCardHeader('🥷', 'Évitement Réussi', 'Furtivité');
        logEvent(`Vous évitez [${enemy.name}] sans un bruit.`, "success");
        gainSkillXp('stealth', 8);
        updateUI();
    } else {
        setCardHeader('⚔️', 'Repéré !', 'Danger');
        logEvent(`[${enemy.name}] vous repère au dernier moment !`, "danger");
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

    setCardHeader('🗡️', 'Attaque Furtive', 'Combat');
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
    return gameState.inCombat || gameState.bossChoicePending || gameState.companionChoicePending || gameState.stealthChoicePending;
}

// Enregistre un lieu connu (aucun doublon) et rafraîchit le panneau
function registerKnownLocation(loc) {
    if (gameState.knownLocations.some(l => l.id === loc.id)) return;
    gameState.knownLocations.push(loc);
    updateKnownLocationsUI();
}

// Retire un lieu connu de la liste (utilisé une fois qu'il est effectivement résolu)
function removeKnownLocation(id) {
    gameState.knownLocations = gameState.knownLocations.filter(loc => loc.id !== id);
    updateKnownLocationsUI();
}

// Reconstruit la liste visuelle des lieux connus, avec la distance réelle (en coût de graphe,
// artère=1/ruelle=2) recalculée depuis la position actuelle à chaque rafraîchissement.
function updateKnownLocationsUI() {
    ui.knownLocationsContainer.innerHTML = "";

    const icons = { stairs: '🪜', boss: '👑', safeRoom: '🏥' };
    let entries = [...gameState.knownLocations];

    // Pré-calcule la distance de chaque entrée une seule fois (réutilisée pour le filtrage ET l'affichage)
    entries = entries.map(loc => ({
        loc,
        distance: gameState.floorMap ? computeDistance(gameState.floorMap.currentRoomId, loc.roomId) : null
    }));

    // Ne garder que la salle sécurisée la plus proche : plusieurs salles connues encombreraient le
    // panneau sans vraie valeur ajoutée (boss/escalier/bifurcation restent tous affichés, eux).
    let nearestSafe = null;
    entries = entries.filter(({ loc, distance }) => {
        if (loc.type !== 'safeRoom') return true;
        if (nearestSafe === null || (distance ?? Infinity) < nearestSafe.distance) nearestSafe = { loc, distance };
        return false;
    });
    if (nearestSafe) entries.push(nearestSafe);

    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun lieu repéré pour l'instant.";
        ui.knownLocationsContainer.appendChild(empty);
        return;
    }

    entries.forEach(({ loc, distance }) => {
        const row = document.createElement('button');
        row.className = "w-full flex justify-between items-center px-3 py-2 bg-gray-950 border border-gray-800 rounded text-xs text-gray-300 hover:border-blue-600 hover:bg-blue-950/30 transition-all cursor-pointer";
        const icon = loc.icon || icons[loc.type] || '📍';
        const distLabel = (distance !== null && distance !== undefined) ? ` (${distance})` : "";
        row.innerHTML = `<span>${icon} ${loc.label}${distLabel}</span><span class="text-blue-400 uppercase tracking-widest text-[10px]">Aller →</span>`;
        row.addEventListener('click', () => travelToKnownLocation(loc.id));
        ui.knownLocationsContainer.appendChild(row);
    });
}

// Décide de repartir vers un lieu connu (ou la bifurcation inexplorée la plus proche, via
// virtualLocation) : le coût en temps et le risque d'embuscade grandissent avec la distance
// réelle sur le graphe (pondérée par artère/ruelle), au lieu d'un taux fixe.
function travelToKnownLocation(id, virtualLocation = null) {
    if (isActionBlocked()) return;
    const location = virtualLocation || gameState.knownLocations.find(loc => loc.id === id);
    if (!location || !gameState.floorMap) return;

    const distance = computeDistance(gameState.floorMap.currentRoomId, location.roomId);
    if (distance === null || distance === undefined) {
        logEvent("Ce lieu semble hors d'atteinte pour l'instant...", "danger");
        return;
    }

    const timeCost = Math.max(1, Math.round(distance / 2));
    // Formule de départ, à ajuster par playtest : 9% de risque par unité de distance, plafonné à 80%
    const ambushBaseChance = Math.min(80, distance * 9);
    let ambushCount = 0;
    if (Math.random() * 100 < ambushBaseChance) {
        ambushCount = 1;
        if (Math.random() * 100 < ambushBaseChance * 0.6) ambushCount = 2;
    }

    gameState.timeLeft = Math.max(0, gameState.timeLeft - timeCost);
    gameState.pendingTravel = { destination: location, ambushesRemaining: ambushCount };
    logEvent(`Vous repartez vers : ${location.label} (${distance}, -${timeCost}H)...`, "info");
    if (ambushCount > 0) {
        logEvent("Le trajet ne s'annonce pas de tout repos...", "danger");
    }

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return;
    }
    triggerNextAmbushOrArrive();
}

// Résout la prochaine embuscade du trajet en cours, ou l'arrivée si le trajet est terminé
function triggerNextAmbushOrArrive() {
    const travel = gameState.pendingTravel;
    if (!travel) return;

    if (travel.ambushesRemaining > 0) {
        travel.ambushesRemaining -= 1;
        logEvent("Une présence hostile vous barre la route !", "danger");
        gameState.pendingStairAfterCombat = false; // Ce n'est pas encore l'arrivée
        initiateCombat(); // Mob générique du quartier actuel (pas le boss : simple embuscade de trajet)
        return;
    }

    arriveAtDestination();
}

// Arrivée effective au lieu connu : se positionne sur la pièce cible et réutilise EXACTEMENT la
// même logique d'entrée que l'exploration normale (enterRoom), pour un comportement cohérent
// que la salle soit atteinte en marchant ou via un trajet de retour.
function arriveAtDestination() {
    const travel = gameState.pendingTravel;
    if (!travel) return;
    const destination = travel.destination;
    gameState.pendingTravel = null;

    const room = gameState.floorMap && gameState.floorMap.roomsById[destination.roomId];
    if (!room) return;

    gameState.floorMap.currentRoomId = room.id;
    gameState.floorMap.currentQuadrant = room.quadrant;
    gameState.currentDistrict = gameState.floorMap.quadrants[room.quadrant].district;

    logEvent(`Vous atteignez : ${destination.label}.`, "info");
    enterRoom(room);
    updateUI();
}

// ==========================================
// COMPAGNONS (CRAWLERS RENCONTRÉS)
// ==========================================

// Cache les deux zones de choix de compagnon (ami / hostile)
function hideCompanionChoiceZones() {
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
}

// Convertit un candidat compagnon en objet compatible avec le moteur de combat existant
// (utilisé quand la rencontre tourne à l'affrontement, qu'il s'agisse du premier contact
// ou d'une trahison d'un compagnon déjà recruté).
function companionCandidateToMob(candidate) {
    return {
        name: candidate.name,
        hp: candidate.hp,
        atk: candidate.atk,
        def: candidate.def,
        xpReward: 20,
        effect: null
    };
}

// Bouton "Recruter" (présent dans les deux zones ami/hostile — la chance de succès et les
// conséquences d'un échec diffèrent selon la disposition du candidat).
function recruitCompanion() {
    const candidate = gameState.pendingCompanionCandidate;
    if (!candidate) return;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;

    const successChance = candidate.disposition === 'friendly' ? 70 : 30;
    if (Math.random() * 100 < successChance) {
        gameState.companion = candidate;
        logEvent(`${candidate.name} accepte de vous accompagner ! (Spécialité : ${candidate.specialty.label})`, "success");
        triggerHaptic('medium');
        updateCompanionUI();
        updateUI();
        return;
    }

    // Échec du recrutement
    if (candidate.disposition === 'friendly') {
        // Un crawler pacifique qui refuse ne devient hostile que dans de très rares cas (5%)
        if (Math.random() * 100 < 5) {
            logEvent(`${candidate.name} se braque brusquement et vous attaque !`, "danger");
            initiateCombat(companionCandidateToMob(candidate));
        } else {
            logEvent(`${candidate.name} décline poliment et s'éloigne.`, "info");
            updateUI();
        }
    } else {
        // Un crawler déjà hostile qui refuse passe directement à l'attaque
        logEvent(`${candidate.name} refuse et se jette sur vous !`, "danger");
        initiateCombat(companionCandidateToMob(candidate));
    }
}

// Bouton "Laisser partir" (zone ami uniquement) : aucun risque
function declineCompanion() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous laissez ${candidate ? candidate.name : "le crawler"} poursuivre son chemin.`, "info");
    updateUI();
}

// Bouton "Fuir" (zone hostile uniquement) : évite l'affrontement avant qu'il ne commence,
// donc toujours réussi (contrairement à une fuite en plein combat, plus risquée).
function fleeCompanionEncounter() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous évitez prudemment ${candidate ? candidate.name : "ce crawler hostile"}.`, "info");
    updateUI();
}

// Bouton "Attaquer" (zone hostile uniquement)
function attackCompanionEncounter() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous attaquez ${candidate ? candidate.name : "le crawler hostile"} !`, "danger");
    initiateCombat(companionCandidateToMob(candidate));
}

// Un compagnon déjà recruté qui devient trop instable (voir gainCompanionXp) se retourne contre
// le joueur : on relance exactement le même choix que pour une première rencontre hostile.
function triggerCompanionHostileTurn() {
    const companion = gameState.companion;
    if (!companion) return;

    gameState.companion = null; // Il n'est plus votre allié pendant qu'on règle la situation
    gameState.pendingCompanionCandidate = { ...companion, disposition: 'hostile' };
    gameState.companionChoicePending = true;

    setCardHeader('💢', companion.name, 'Compagnon Instable');
    logEvent(`${companion.name} craque sous la pression et se retourne contre vous !`, "danger");
    updateCompanionUI();
    ui.companionChoiceHostile.classList.remove('hidden');
    updateUI();
}

// Gain d'XP du compagnon (accordé après chaque victoire du joueur tant qu'il est actif).
// Sa progression fait grimper son agressivité ; à 100%, il devient hostile (voir explore()).
function gainCompanionXp(amount) {
    const companion = gameState.companion;
    if (!companion || !amount) return;

    companion.xp += amount;
    while (companion.xp >= companion.xpToNext) {
        companion.xp -= companion.xpToNext;
        companion.level += 1;
        companion.xpToNext = Math.round(companion.xpToNext * 1.3);

        const increment = 15 + Math.floor(Math.random() * 11); // +15 à +25 par niveau
        companion.aggressiveness = Math.min(100, companion.aggressiveness + increment);

        logEvent(`${companion.name} gagne en expérience (niveau ${companion.level}).`, "info");
        if (companion.aggressiveness >= 70 && companion.aggressiveness < 100) {
            logEvent(`${companion.name} semble de plus en plus instable... (agressivité ${companion.aggressiveness}%)`, "danger");
        }
    }
    updateCompanionUI();
}

// Reconstruit l'affichage compact du compagnon (hors combat) : nom, spécialité, barre d'agressivité
function updateCompanionUI() {
    const companion = gameState.companion;
    if (!companion) {
        ui.companionStatusBar.classList.add('hidden');
        return;
    }
    ui.companionStatusBar.classList.remove('hidden');
    ui.companionNameDisplay.innerText = companion.name;
    ui.companionSpecialtyDisplay.innerText = `(${companion.specialty.label})`;

    const aggroPct = companion.aggressiveness / 100;
    ui.companionAggroBar.style.width = `${companion.aggressiveness}%`;
    ui.companionAggroBar.style.background = hpColor(1 - aggroPct); // Vert = calme, rouge = instable
}

function nextFloor() {
    gameState.currentFloor += 1;
    gameState.cardsDrawnThisFloor = 0;
    gameState.timeLeft = gameState.maxTime; // Réinitialisation du temps
    gameState.knownLocations = []; // Les lieux repérés à l'étage précédent ne sont plus accessibles
    generateFloorMap(); // Nouvelle zone circulaire à 4 quartiers pour ce nouvel étage
    logEvent(`--- DÉBUT DE L'ÉTAGE ${gameState.currentFloor} ---`, "info");
    updateKnownLocationsUI();
    updateUI();
}

// Score de puissance (0 à 1) utilisé pour pondérer la rareté du loot obtenu (voir generateItem()
// dans generator.js) : basé sur l'XP donnée par le monstre vaincu si disponible (capture à la fois
// l'étage ET la puissance intrinsèque/les modificateurs du monstre), sinon estimé à partir du seul
// étage courant (loot "Trésor" trouvé en explorant, sans combat).
const LOOT_POWER_XP_REFERENCE = 400; // xpReward au-delà duquel le score de puissance est plafonné à 1
function getLootPowerScore(enemy) {
    if (enemy && enemy.xpReward) {
        return Math.max(0, Math.min(1, enemy.xpReward / LOOT_POWER_XP_REFERENCE));
    }
    return Math.max(0, Math.min(1, gameState.currentFloor / 20));
}

function addLoot(powerScore = 0) {
    if (gameState.inventory.length < gameState.maxInventory) {
        const item = generateItem(powerScore);
        gameState.inventory.push(item);
        logEvent(`Objet obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
    } else {
        logEvent("Vous trouvez un objet, mais votre inventaire est plein !", "danger");
    }
}

// ==========================================
// SYSTÈME DE NIVEAU ET D'EXPÉRIENCE
// ==========================================
function gainXp(amount) {
    if (!amount || amount <= 0) return;
    gameState.xp += amount;
    logEvent(`+${amount} XP`, "success");

    // On utilise une boucle "while" pour gérer le cas (rare) d'un gain d'XP
    // suffisant pour franchir plusieurs niveaux d'un coup.
    while (gameState.xp >= gameState.xpToNextLevel) {
        gameState.xp -= gameState.xpToNextLevel;
        gameState.level += 1;
        gameState.xpToNextLevel = Math.round(gameState.xpToNextLevel * 1.4); // Chaque niveau demande un peu plus d'XP

        // Gains de statistiques à la montée de niveau
        const hpGain = 15;
        const atkGain = 2;
        const defGain = 1;
        gameState.maxHp += hpGain;
        gameState.hp = gameState.maxHp; // Montée de niveau = soin complet (récompense marquante)
        gameState.atk += atkGain;
        gameState.def += defGain;

        logEvent(`⭐ NIVEAU SUPÉRIEUR ! Vous êtes maintenant niveau ${gameState.level}. (+${hpGain} PV max, +${atkGain} ATQ, +${defGain} DEF — PV entièrement restaurés)`, "success");
        triggerHaptic('heavy');
    }

    updateUI();
}

// Gain d'XP dédiée à une compétence (arme / mains nues / magie), uniquement via l'usage en combat.
// Chaque compétence progresse indépendamment des autres et du niveau général du joueur.
function gainSkillXp(skillKey, amount) {
    const skill = gameState.skills[skillKey];
    if (!skill || !amount) return;

    skill.xp += amount;
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.3);
        logEvent(`📈 Compétence "${skillLabel(skillKey)}" améliorée ! Niveau ${skill.level}.`, "success");
    }
    // Pas de updateUI() ici : on est toujours appelé en plein combat, juste après un coup porté.
    // Un rafraîchissement immédiat écraserait l'affichage des PV avant que l'animation du dé n'ait
    // eu le temps d'arriver à destination. Le prochain updateUI() naturel (riposte différée ou fin
    // de combat, au plus tard ~400ms plus tard) suffit à tout remettre à jour.
}

function skillLabel(key) {
    return { weapon: "Arme", unarmed: "Mains nues", magic: "Magie", stealth: "Furtivité" }[key] || key;
}

// ==========================================
// 4. CARTE DE L'ÉTAGE (ZONE CIRCULAIRE À 4 QUARTIERS)
// ==========================================
// Chaque étage est une zone circulaire découpée en 4 quartiers fixes, générés une fois pour
// toutes à l'arrivée sur l'étage. Chaque quartier est un petit réseau aléatoire de pièces reliées
// par des couloirs typés (artère = passage principal, ruelle = embranchement secondaire). Rien de
// tout ceci n'est affiché : c'est une mémoire interne qui alimente le système de lieux connus
// (distance réelle, risque de trajet) et la narration.

// Relie deux pièces par un couloir du type donné (dans les deux sens)
function addEdge(roomsById, aId, bId, kind) {
    if (aId === bId) return;
    roomsById[aId].neighbors.push({ to: bId, kind });
    roomsById[bId].neighbors.push({ to: aId, kind });
}

// Renvoie l'id d'une pièce parmi les plus "profondes" du quartier (BFS depuis l'entrée), pour que
// la salle de boss ne soit jamais accessible trivialement dès les premiers pas.
function pickDeepRoom(roomsById, roomIds, entryId) {
    const depth = { [entryId]: 0 };
    const queue = [entryId];
    while (queue.length > 0) {
        const currentId = queue.shift();
        roomsById[currentId].neighbors.forEach(edge => {
            if (depth[edge.to] === undefined) {
                depth[edge.to] = depth[currentId] + 1;
                queue.push(edge.to);
            }
        });
    }
    const maxDepth = Math.max(...roomIds.map(id => depth[id] || 0));
    const deepest = roomIds.filter(id => (depth[id] || 0) >= Math.max(1, maxDepth - 1));
    return deepest[Math.floor(Math.random() * deepest.length)];
}

// Génère le réseau de pièces d'un seul quartier (arbre principal + quelques ruelles annexes) et
// y place sa salle de boss ainsi que ses salles sécurisées.
function generateQuadrant(quadrantIndex, districtName, roomsById) {
    const roomCount = 10 + Math.floor(Math.random() * 5); // 10 à 14 pièces
    const roomIds = [];
    const entryId = `q${quadrantIndex}_r0`;
    roomsById[entryId] = { id: entryId, quadrant: quadrantIndex, type: 'normal', visited: false, neighbors: [] };
    roomIds.push(entryId);

    // Arbre principal : chaque nouvelle pièce se raccroche à une pièce existante, avec un biais
    // vers la plus récente pour favoriser un tronc plutôt qu'une étoile plate.
    for (let i = 1; i < roomCount; i++) {
        const newId = `q${quadrantIndex}_r${i}`;
        const parentId = Math.random() < 0.7
            ? roomIds[roomIds.length - 1]
            : roomIds[Math.floor(Math.random() * roomIds.length)];
        const kind = Math.random() < 0.4 ? 'artery' : 'alley'; // ~40% d'artères sur le tronc
        roomsById[newId] = { id: newId, quadrant: quadrantIndex, type: 'normal', visited: false, neighbors: [] };
        addEdge(roomsById, parentId, newId, kind);
        roomIds.push(newId);
    }

    // Salle de boss : parmi les pièces les plus profondes, hors entrée
    const bossId = pickDeepRoom(roomsById, roomIds, entryId);
    roomsById[bossId].type = 'boss';

    // 1 à 2 salles sécurisées parmi les pièces restantes
    const safeCandidates = roomIds.filter(id => id !== entryId && id !== bossId);
    for (let i = safeCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [safeCandidates[i], safeCandidates[j]] = [safeCandidates[j], safeCandidates[i]];
    }
    const safeCount = Math.min(safeCandidates.length, 1 + Math.floor(Math.random() * 2));
    for (let i = 0; i < safeCount; i++) {
        roomsById[safeCandidates[i]].type = 'safe';
        roomsById[safeCandidates[i]].safehouse = pickSafehouseType();
    }

    // Quelques ruelles annexes pour texturer le graphe (raccourcis, pas forcément utiles)
    const extraLoops = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < extraLoops; i++) {
        const a = roomIds[Math.floor(Math.random() * roomIds.length)];
        const b = roomIds[Math.floor(Math.random() * roomIds.length)];
        addEdge(roomsById, a, b, 'alley');
    }

    return { district: districtName, entryRoomId: entryId, bossRoomId: bossId, roomIds };
}

// Génère la carte complète du nouvel étage : 4 quartiers distincts, une jonction (artère) entre
// chaque paire de quartiers adjacents (cercle : 0-1, 1-2, 2-3, 3-0), un quartier tiré au hasard
// pour héberger l'escalier (sa salle de boss devient le gardien de l'escalier).
function generateFloorMap() {
    const pool = [...Object.keys(districts)];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosenDistricts = pool.slice(0, 4);

    const roomsById = {};
    const quadrants = [];
    for (let q = 0; q < 4; q++) {
        quadrants.push(generateQuadrant(q, chosenDistricts[q], roomsById));
    }

    // Jonctions inter-quartiers : cercle à 4 quartiers, chacun relié à ses deux voisins directs
    for (let q = 0; q < 4; q++) {
        const nextQ = (q + 1) % 4;
        const roomA = quadrants[q].roomIds[Math.floor(Math.random() * quadrants[q].roomIds.length)];
        const roomB = quadrants[nextQ].roomIds[Math.floor(Math.random() * quadrants[nextQ].roomIds.length)];
        addEdge(roomsById, roomA, roomB, 'artery'); // Jonction = artère (passage principal)
    }

    const stairsQuadrant = Math.floor(Math.random() * 4);
    roomsById[quadrants[stairsQuadrant].bossRoomId].guardsStairs = true;

    gameState.floorMap = {
        quadrants,
        roomsById,
        stairsQuadrant,
        currentQuadrant: 0,
        currentRoomId: quadrants[0].entryRoomId
    };
    roomsById[quadrants[0].entryRoomId].visited = true;
    gameState.currentDistrict = quadrants[0].district;
}

// Distance pondérée (Dijkstra) entre deux pièces du graphe de l'étage, tous quartiers confondus
// (les jonctions inter-quartiers sont des arêtes comme les autres). Une artère coûte 1, une ruelle
// coûte 2 : un trajet par ruelles paraît donc plus long/risqué qu'un trajet par artères, même à
// nombre de pièces égal. Renvoie null si aucun chemin n'existe (ne devrait pas arriver, le graphe
// de l'étage est toujours connexe par construction).
function computeDistance(fromRoomId, toRoomId) {
    if (fromRoomId === toRoomId) return 0;
    const roomsById = gameState.floorMap.roomsById;
    const dist = { [fromRoomId]: 0 };
    const visited = new Set();

    while (true) {
        let currentId = null;
        let currentCost = Infinity;
        for (const id in dist) {
            if (!visited.has(id) && dist[id] < currentCost) {
                currentCost = dist[id];
                currentId = id;
            }
        }
        if (currentId === null) break;
        if (currentId === toRoomId) return currentCost;

        visited.add(currentId);
        const room = roomsById[currentId];
        if (!room) continue;
        room.neighbors.forEach(edge => {
            const weight = edge.kind === 'artery' ? 1 : 2;
            const newCost = currentCost + weight;
            if (dist[edge.to] === undefined || newCost < dist[edge.to]) {
                dist[edge.to] = newCost;
            }
        });
    }
    return null;
}

// Point d'entrée unique pour "arriver" dans une pièce, que ce soit en explorant normalement ou en
// y retournant via un lieu connu (voir arriveAtDestination) : le comportement est donc identique
// dans les deux cas.
function enterRoom(room) {
    const firstVisit = !room.visited;
    room.visited = true;

    if (room.type === 'boss') {
        if (room.defeated) {
            setCardHeader('🏚️', 'Antre Silencieuse', 'Exploration');
            logEvent("L'antre est silencieuse désormais ; le boss a déjà été vaincu.", "normal");
            return;
        }
        triggerBossEncounter(room);
        return;
    }

    if (room.type === 'safe') {
        const safehouse = room.safehouse || { name: "Salle Sécurisée", icon: "🏥", desc: "" };
        const heal = Math.floor(Math.random() * 20) + 15; // 15 à 34 PV
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + heal);
        setCardHeader(safehouse.icon, safehouse.name, 'Repos');
        logEvent(
            firstVisit
                ? `Vous découvrez : ${safehouse.name}. ${safehouse.desc} Vous vous reposez et récupérez ${heal} PV.`
                : `Vous retrouvez ${safehouse.name} et vous reposez encore un peu (+${heal} PV).`,
            "success"
        );
        registerKnownLocation({ id: `safe-${room.id}`, type: 'safeRoom', roomId: room.id, label: safehouse.name, icon: safehouse.icon });
        return;
    }

    // Pièce normale
    if (firstVisit) {
        resolveCardEvent();
    } else {
        setCardHeader('🌑', 'Chemin Connu', 'Exploration');
        logEvent("Vous retraversez un couloir déjà exploré, rien de neuf.", "normal");
    }
}

// Présente le choix "combattre maintenant / repérer et partir" pour une salle de boss (celle qui
// garde l'escalier y compris). Le boss est généré une seule fois et mis en cache sur la pièce
// (room.bossInstance), pour rester le même monstre si le joueur repère puis revient plus tard.
function triggerBossEncounter(room) {
    if (!room.bossInstance) {
        const district = gameState.floorMap.quadrants[room.quadrant].district;
        room.bossInstance = generateBoss(district) || generateMob(district);
    }
    const boss = room.bossInstance;
    gameState.pendingBossEncounter = { roomId: room.id, guardsStairs: room.guardsStairs === true };
    gameState.bossChoicePending = true;

    setCardHeader('👑', boss.name, room.guardsStairs ? "Gardien de l'Escalier" : 'Boss de Quartier');
    logEvent(
        room.guardsStairs
            ? `🎬 Vous découvrez l'escalier vers l'étage ${gameState.currentFloor + 1}, gardé par ${boss.name} !`
            : `Vous découvrez l'antre de ${boss.name}, un boss de quartier !`,
        "danger"
    );
    logEvent("Le combattre maintenant, ou repérer l'endroit pour y revenir plus tard ?", "info");
    ui.bossChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Combattre" de la zone de choix de boss
function fightBossNow() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    if (!encounter) return;

    const room = gameState.floorMap.roomsById[encounter.roomId];
    gameState.pendingStairAfterCombat = !!encounter.guardsStairs;
    gameState.pendingBossRoomId = encounter.roomId;
    initiateCombat(room.bossInstance);
}

// Bouton "Repérer et partir" de la zone de choix de boss : mémorise l'emplacement comme lieu
// connu, sans y descendre/combattre.
function retreatFromBoss() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    if (encounter) {
        const room = gameState.floorMap.roomsById[encounter.roomId];
        const district = room ? gameState.floorMap.quadrants[room.quadrant].district : 'quartier inconnu';
        registerKnownLocation({
            id: `boss-${encounter.roomId}`,
            type: encounter.guardsStairs ? 'stairs' : 'boss',
            roomId: encounter.roomId,
            label: encounter.guardsStairs ? `Escalier gardé (${district})` : `Boss (${district})`
        });
    }
    logEvent("Vous repérez soigneusement l'endroit et repartez explorer.", "info");
    updateKnownLocationsUI();
    updateUI();
}

// ==========================================
// 5. SYSTÈME DE COMBAT
// ==========================================
function initiateCombat(forcedEnemy = null) {
    const enemy = forcedEnemy || generateMob(gameState.currentDistrict);
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;

    // Statuts remis à zéro à chaque nouveau combat (des deux côtés)
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    if (enemy) {
        enemy.status = { bleed: null, stunned: false, slowed: null, blinded: null, corroded: null, feared: null };
        enemy.maxHp = enemy.hp; // Référence pour l'anneau de vie (pourcentage de PV restants)
    }

    // Distance de combat : n'entre en jeu que si la posture du joueur diverge de la nature du
    // monstre (l'un à distance, l'autre en mêlée) — voir getCombatRangeContext(). Dans tous les
    // autres cas (les deux en mêlée, comme avant cette fonctionnalité, OU les deux à distance),
    // la distance reste à 0 et rien ne change au système d'échange classique.
    gameState.combatDistance = (enemy && isDivergentStance(enemy)) ? config.rangedCombat.initialDistance : 0;

    // Les dés de dégâts repartent à zéro visuellement (aucune action encore jouée ce combat)
    ui.combatPlayerDie.innerText = "–";
    ui.combatPlayerDie.classList.remove('die-pop');
    ui.combatEnemyDie.innerText = "–";
    ui.combatEnemyDie.classList.remove('die-pop');

    if (enemy && enemy.isBoss) {
        logEvent("--- 👑 COMBAT DE BOSS ---", "danger");
        logEvent(`${enemy.name} se dresse devant vous ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else if (enemy) {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        logEvent(`Un [${enemy.name}] apparaît ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        // Sécurité : si la génération échoue pour une raison imprévue, on ne bloque pas le jeu
        logEvent("Une présence hostile rôde, mais reste indistincte...", "danger");
    }
    if (enemy && enemy.ranged) {
        logEvent("🎯 Cet ennemi est armé à distance !", "danger");
    }
    updateUI();
}

// ==========================================
// COMBAT À DISTANCE : POSTURE, DISTANCE, CONTEXTE
// ==========================================

// Vrai si la posture du joueur diverge de la nature du monstre (l'un à distance, l'autre en
// mêlée). C'est la seule condition qui active la mécanique de distance — si les deux sont du
// même "camp" (mêlée/mêlée ou distance/distance), rien ne change au système classique.
function isDivergentStance(enemy) {
    if (!enemy) return false;
    return (!!enemy.ranged) !== (gameState.stance === 'ranged');
}

// Calcule le contexte de distance pour le combat en cours : la mécanique n'est réellement active
// que si les postures divergent ET qu'il reste de la distance à parcourir (combatDistance > 0).
//   - playerAdvantaged    : le joueur est le "tireur" (posture distance, mob en mêlée) : il agit
//                           librement, le mob ne peut pas riposter tant que la distance tient.
//   - playerDisadvantaged : le joueur est en mêlée face à un mob à distance : il ne peut pas
//                           porter de dégâts tant qu'il n'a pas comblé l'écart, et le mob tire
//                           librement pendant ce temps.
function getCombatRangeContext() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return { active: false, playerAdvantaged: false, playerDisadvantaged: false };
    const active = isDivergentStance(enemy) && gameState.combatDistance > 0;
    const playerRanged = gameState.stance === 'ranged';
    return {
        active,
        playerAdvantaged: active && playerRanged,
        playerDisadvantaged: active && !playerRanged
    };
}

// Une "manche" de distance : le joueur et le monstre jettent chacun un dé (le joueur bénéficie
// d'un bonus lié à son niveau), et l'écart évolue selon qui l'emporte. `playerWantsToWiden`
// indique le sens favorable au joueur : true quand il fuit un mob de mêlée (il veut AUGMENTER
// l'écart), false quand il rattrape un mob à distance (il veut le RÉDUIRE).
function resolveDistanceRound(enemy, playerWantsToWiden) {
    const cfg = config.rangedCombat;
    const playerRoll = 1 + Math.floor(Math.random() * cfg.dieSides) + Math.floor(gameState.level / cfg.levelAdvantageDivisor);
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll; // positif = le joueur l'emporte ce round
    const delta = playerWantsToWiden ? diff : -diff;
    gameState.combatDistance = Math.max(0, Math.min(cfg.maxDistance, gameState.combatDistance + delta));
    return { playerRoll, mobRoll, diff };
}

// Cas "joueur avantagé" (posture distance, mob en mêlée) : après un tir qui touche, au lieu
// d'une riposte classique, on résout une manche de distance (le mob tente de combler l'écart).
function resolveDistanceTickAdvantaged() {
    setCombatInputLocked(true);
    setTimeout(() => {
        const enemy = gameState.currentEnemy;
        if (!enemy) { setCombatInputLocked(false); return; }
        const { playerRoll, mobRoll } = resolveDistanceRound(enemy, true);
        if (gameState.combatDistance <= 0) {
            logEvent(`🏃 [${enemy.name}] comble l'écart et vous rattrape au corps à corps !`, "danger");
        } else {
            logEvent(`↔️ Vous maintenez la distance face à [${enemy.name}] (${playerRoll} vs ${mobRoll}).`, "info");
        }
        setCombatInputLocked(false);
        updateUI();
    }, COMBAT_BEAT_MS);
}

// Cas "joueur désavantagé" (posture mêlée, mob à distance) : au lieu d'une attaque, le joueur
// tente de combler l'écart. S'il n'y parvient pas ce tour-ci, le mob tire librement (même pipeline
// que enemyCounterAttack, pour garder l'animation et le rythme cohérents).
function performChaseAction(actionLabel) {
    if (!tryPlayerAction()) return;
    const enemy = gameState.currentEnemy;
    if (!enemy) return;
    logEvent(`Vous tentez de ${actionLabel} pour combler la distance face à [${enemy.name}]...`, "normal");
    setCombatInputLocked(true);
    setTimeout(() => {
        const { playerRoll, mobRoll } = resolveDistanceRound(enemy, false);
        if (gameState.combatDistance <= 0) {
            logEvent(`🎯 Vous atteignez [${enemy.name}] au corps à corps !`, "success");
            setCombatInputLocked(false);
            updateUI();
        } else {
            logEvent(`[${enemy.name}] vous canarde pendant votre approche (${playerRoll} vs ${mobRoll}).`, "danger");
            setCombatInputLocked(false);
            enemyCounterAttack();
        }
    }, COMBAT_BEAT_MS);
}

// Bascule la posture de combat du joueur (bouton dédié, visible uniquement en combat). Toggle
// libre (ne consomme pas de tour) : si la posture choisie fait diverger les deux camps, une
// chasse démarre (ou redémarre) avec l'écart de départ ; sinon, plus aucun effet de distance.
function togglePlayerStance() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    if (ui.btnStanceToggle && ui.btnStanceToggle.disabled) return; // Verrouillé pendant une animation de combat

    gameState.stance = gameState.stance === 'melee' ? 'ranged' : 'melee';
    const enemy = gameState.currentEnemy;
    if (isDivergentStance(enemy)) {
        gameState.combatDistance = config.rangedCombat.initialDistance;
        logEvent(`Vous passez en posture ${gameState.stance === 'ranged' ? '🎯 à distance' : '⚔️ corps à corps'} : l'écart se creuse !`, "info");
    } else {
        gameState.combatDistance = 0;
        logEvent(`Vous passez en posture ${gameState.stance === 'ranged' ? '🎯 à distance' : '⚔️ corps à corps'}.`, "info");
    }
    updateUI();
}

// Formule de mitigation multiplicative : le ratio ATQ/(ATQ+DEF) donne la part des dégâts qui passe.
// Avantage sur une formule additive (ATQ - DEF) : jamais de dégâts négatifs à écrêter artificiellement,
// et la DEF réduit toujours les dégâts proportionnellement, sans effet de seuil brutal.
// `options` permet de différencier les types d'attaque (arme / mains nues / magie) :
//   - atkMultiplier : multiplie l'ATQ de base (ex: 1.4 pour la magie, plus puissante)
//   - varianceRange : amplitude de l'aléatoire (ex: 0.35 pour la magie, plus imprévisible)
//   - defReduction  : fraction de la DEF adverse ignorée (ex: 0.35 pour les mains nues, qui passent sous la garde)
function rollDamage(attackerAtk, defenderDef, options = {}) {
    const atkMultiplier = options.atkMultiplier ?? 1;
    const varianceRange = options.varianceRange ?? 0.15;
    const defReduction = options.defReduction ?? 0;

    const effectiveAtk = attackerAtk * atkMultiplier;
    const effectiveDef = Math.max(0, defenderDef * (1 - defReduction));
    const mitigation = effectiveAtk / (effectiveAtk + effectiveDef);
    const variance = 1 + (Math.random() * varianceRange * 2 - varianceRange);
    const damage = effectiveAtk * mitigation * variance;
    return Math.max(1, Math.round(damage));
}

// DEF effective du joueur : sa DEF de base + le bonus de l'armure équipée, le cas échéant.
// Réduite de moitié tant que le joueur est ébloui (effet "light"), et encore réduite de 40% tant
// qu'il est corrodé (effet "corrode") — les deux se cumulent si les deux sont actifs à la fois.
function getEffectiveDef() {
    const armorBonus = gameState.equipment.armor ? (gameState.equipment.armor.baseArmor || 0) : 0;
    const companionBonus = (gameState.companion && gameState.companion.specialty.type === 'guard')
        ? Math.round(gameState.companion.def * 0.5)
        : 0;
    let effectiveDef = gameState.def + armorBonus + companionBonus;
    if (gameState.status.blinded && gameState.status.blinded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    if (gameState.status.corroded && gameState.status.corroded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.6);
    }
    return effectiveDef;
}

// Vérifie que le joueur peut agir (combat en cours, pas étourdi), et applique le saignement
// éventuellement en cours sur le joueur AVANT son action. Retourne false si le joueur ne peut pas
// agir ce tour-ci (combat terminé entre-temps, ou étourdi).
function tryPlayerAction() {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;

    // Saignement en cours sur le joueur : tique avant son action
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) {
        const dmg = gameState.status.bleed.dmgPerRound;
        gameState.hp -= dmg;
        gameState.status.bleed.rounds -= 1;
        if (gameState.status.bleed.rounds <= 0) gameState.status.bleed = null;
        logEvent(`🩸 Votre état vous fait perdre ${dmg} PV.`, "danger");
        if (gameState.hp <= 0) {
            gameState.hp = 0;
            gameOver();
            return false;
        }
    }

    if (gameState.status.stunned) {
        logEvent("Vous êtes étourdi et ne parvenez pas à agir ce tour-ci !", "danger");
        gameState.status.stunned = false; // L'étourdissement se consomme après ce tour manqué
        showDie(ui.combatPlayerDie, "😵");
        // Si le joueur est à l'abri grâce à la distance (mob en mêlée, écart > 0), l'étourdissement
        // ne coûte rien de plus : le mob ne peut de toute façon pas le toucher ce tour-ci.
        if (getCombatRangeContext().playerAdvantaged) {
            logEvent("Trop loin pour en profiter, l'ennemi ne peut pas riposter.", "info");
        } else {
            enemyCounterAttack();
        }
        return false;
    }

    return true;
}

// Portion commune à toute attaque du joueur : applique les dégâts, vérifie la victoire,
// et laisse l'ennemi riposter s'il survit.
// `onSurviveInsteadOfCounter` (optionnel) : si fourni et que l'ennemi survit, remplace la riposte
// classique par ce callback — utilisé quand le joueur est "avantagé" par la distance (posture à
// distance face à un mob de mêlée) : l'ennemi ne peut pas encore riposter, on résout une manche
// de distance à la place (voir resolveDistanceTickAdvantaged()).
function performPlayerAttack(attackerAtk, options, label, onSurviveInsteadOfCounter = null) {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    const enemy = gameState.currentEnemy;
    const resolveNoDamageOutcome = onSurviveInsteadOfCounter || enemyCounterAttack;

    // Un joueur confus a une chance de rater complètement son attaque (aucun dégât, tour perdu)
    if (gameState.status.confused && gameState.status.confused.rounds > 0) {
        gameState.status.confused.rounds -= 1;
        if (gameState.status.confused.rounds <= 0) gameState.status.confused = null;
        if (Math.random() * 100 < 45) {
            showDie(ui.combatPlayerDie, "❓");
            logEvent(`Désorienté, vous frappez complètement à côté de [${enemy.name}] !`, "danger");
            resolveNoDamageOutcome();
            return true;
        }
    }

    // Un joueur ralenti inflige moitié moins de dégâts, le temps que l'effet se dissipe
    let effectiveOptions = options;
    let slowedNote = "";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) {
        effectiveOptions = { ...options, atkMultiplier: (options.atkMultiplier ?? 1) * 0.5 };
        slowedNote = " (ralenti)";
        gameState.status.slowed.rounds -= 1;
        if (gameState.status.slowed.rounds <= 0) gameState.status.slowed = null;
    }

    // Un joueur apeuré (effet mob "Terrifiant") inflige lui aussi moins de dégâts, le temps de
    // reprendre ses esprits. Se cumule avec le ralentissement si les deux sont actifs.
    if (gameState.status.feared && gameState.status.feared.rounds > 0) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * 0.65 };
        slowedNote += " (apeuré)";
        gameState.status.feared.rounds -= 1;
        if (gameState.status.feared.rounds <= 0) gameState.status.feared = null;
    }

    // À l'inverse, une décharge d'adrénaline (arme "Galvanisant") booste temporairement les dégâts
    let adrenalineNote = "";
    if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * gameState.status.adrenaline.mult };
        adrenalineNote = " (galvanisé)";
        gameState.status.adrenaline.rounds -= 1;
        if (gameState.status.adrenaline.rounds <= 0) gameState.status.adrenaline = null;
    }

    // Attaque furtive réussie : le tout premier coup de ce combat porte un bonus x2 garanti
    let sneakNote = "";
    if (gameState.pendingSneakAttack) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * 2 };
        sneakNote = " (attaque furtive x2)";
        gameState.pendingSneakAttack = false;
    }

    // Un ennemi ébloui (arme "Lumineux") pare moins bien, un ennemi corrodé (arme "Corrosif")
    // aussi : sa DEF effective est réduite dans les deux cas (cumulables).
    let effectiveEnemyDef = enemy.def;
    const enemyWasBlinded = enemy.status && enemy.status.blinded && enemy.status.blinded.rounds > 0;
    if (enemyWasBlinded) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * 0.5);
        enemy.status.blinded.rounds -= 1;
        if (enemy.status.blinded.rounds <= 0) enemy.status.blinded = null;
    }
    const enemyWasCorroded = enemy.status && enemy.status.corroded && enemy.status.corroded.rounds > 0;
    if (enemyWasCorroded) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * 0.6);
        enemy.status.corroded.rounds -= 1;
        if (enemy.status.corroded.rounds <= 0) enemy.status.corroded = null;
    }

    const playerDamage = rollDamage(attackerAtk, effectiveEnemyDef, effectiveOptions);
    enemy.hp -= playerDamage;
    gameState._lastPlayerDamage = playerDamage; // Utilisé par la mécanique d'arme "Vampirique" (lifesteal)
    animateDieHit(ui.combatPlayerDie, 'left', playerDamage, ui.combatEnemyHpRing, ui.combatEnemyHp, enemy.hp, enemy.maxHp);
    logEvent(`Vous attaquez ${label}${slowedNote}${adrenalineNote}${sneakNote}${enemyWasBlinded ? " (ennemi ébloui)" : ""}${enemyWasCorroded ? " (ennemi corrodé)" : ""} et infligez ${playerDamage} dégâts à [${enemy.name}].`, "normal");

    // Compagnon "Frappe d'appoint" : porte un coup supplémentaire à chaque attaque du joueur
    if (gameState.companion && gameState.companion.specialty.type === 'strike' && enemy.hp > 0) {
        const bonusDamage = Math.max(1, Math.round(gameState.companion.atk * 0.4));
        enemy.hp -= bonusDamage;
        logEvent(`${gameState.companion.name} porte un coup supplémentaire ! (+${bonusDamage} dégâts)`, "info");
    }

    if (enemy.hp <= 0) {
        setTimeout(() => {
            logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
            winCombat();
        }, COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer avant de conclure le combat
        return true;
    }

    resolveNoDamageOutcome();
    return true;
}

// Mécaniques d'arme qui ont un vrai effet de combat (utilisées aussi par "random"/Chaotique,
// qui en tire une au hasard à chaque déclenchement).
const IMPLEMENTED_WEAPON_MECHANICS = ['bleed', 'stun', 'poison', 'slow', 'light', 'heal', 'lifesteal', 'drain', 'corrode', 'fear', 'adrenaline'];

// Résout l'effet concret d'une mécanique nommée sur l'ennemi/le joueur.
// Séparé de applyWeaponMechanic() pour que "random" (Chaotique) puisse réutiliser cette logique
// après avoir tiré une mécanique au hasard, sans dupliquer le switch.
function resolveWeaponMechanicEffect(mechanicName, weapon, enemy) {
    switch (mechanicName) {
        case 'bleed':
            enemy.status.bleed = { rounds: 3, dmgPerRound: Math.max(2, Math.round((weapon.baseDmg || 5) * 0.3)) };
            logEvent(`🩸 [${enemy.name}] se met à saigner !`, "danger");
            break;
        case 'stun':
            enemy.status.stunned = true;
            logEvent(`💫 [${enemy.name}] est étourdi par le choc !`, "danger");
            break;
        case 'poison':
            // Même compteur générique que "bleed" (dégâts sur la durée) : plus de rounds, moins de dégâts/round
            enemy.status.bleed = { rounds: 5, dmgPerRound: Math.max(1, Math.round((weapon.baseDmg || 5) * 0.15)) };
            logEvent(`☢️ [${enemy.name}] est empoisonné !`, "danger");
            break;
        case 'slow':
            enemy.status.slowed = { rounds: 2 };
            logEvent(`🐌 [${enemy.name}] est ralenti, gelé sur place !`, "danger");
            break;
        case 'light':
            enemy.status.blinded = { rounds: 2 };
            logEvent(`✨ [${enemy.name}] est ébloui par un éclat de lumière !`, "danger");
            break;
        case 'heal': {
            const healAmount = Math.max(3, Math.round((weapon.baseDmg || 5) * 0.4));
            gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
            logEvent(`💚 Votre arme régénère vos blessures (+${healAmount} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const baseAmount = gameState._lastPlayerDamage || weapon.baseDmg || 5;
            const stolen = Math.max(2, Math.round(baseAmount * 0.3));
            gameState.hp = Math.min(gameState.maxHp, gameState.hp + stolen);
            logEvent(`🧛 Vous volez ${stolen} PV à [${enemy.name}].`, "success");
            break;
        }
        case 'drain':
            enemy.atk = Math.max(1, Math.round(enemy.atk * 0.85));
            logEvent(`🌀 Vous drainez son énergie, [${enemy.name}] semble affaibli.`, "info");
            break;
        case 'corrode':
            enemy.status.corroded = { rounds: 3 };
            logEvent(`🧪 [${enemy.name}] voit son armure se corroder ! (DEF réduite)`, "danger");
            break;
        case 'fear':
            enemy.status.feared = { rounds: 3 };
            logEvent(`😱 [${enemy.name}] est pris de terreur ! (ATQ réduite)`, "danger");
            break;
        case 'adrenaline': {
            gameState.status.adrenaline = { rounds: 2, mult: 1.35 };
            logEvent("💉 Une décharge d'adrénaline vous parcourt ! (dégâts boostés)", "success");
            break;
        }
    }
}

// Applique la mécanique spéciale de l'arme équipée (Tranchant->saignement, Lourd->étourdissement, etc.),
// avec une chance de déclenchement. Appelée uniquement après une attaque à l'arme réussie.
// Applique la/les mécanique(s) spéciale(s) de l'arme équipée (Tranchant->saignement,
// Lourd->étourdissement, etc.). Un objet rare peut porter plusieurs enchantements à la fois (voir
// itemRarities) : chacun a sa PROPRE chance de se déclencher, indépendamment des autres, ce qui
// rend un objet à 2-3 enchantements sensiblement plus fiable qu'un objet à un seul.
function applyWeaponMechanic(weaponOverride = null) {
    const weapon = weaponOverride || gameState.equipment.weapon;
    const enemy = gameState.currentEnemy;
    if (!weapon || !weapon.mechanics || weapon.mechanics.length === 0 || !enemy) return;

    const triggerChance = 30; // 30% de chance, par enchantement, que celui-ci se déclenche
    weapon.mechanics.forEach(mechanic => {
        if (Math.random() * 100 >= triggerChance) return;

        if (mechanic === 'random') {
            // Chaotique : tire une mécanique au hasard parmi celles qui ont un vrai effet
            const picked = IMPLEMENTED_WEAPON_MECHANICS[Math.floor(Math.random() * IMPLEMENTED_WEAPON_MECHANICS.length)];
            resolveWeaponMechanicEffect(picked, weapon, enemy);
        } else if (IMPLEMENTED_WEAPON_MECHANICS.includes(mechanic)) {
            resolveWeaponMechanicEffect(mechanic, weapon, enemy);
        }
        // "pleasure_or_pain" (Vibrant), "aoe" (Explosif) et "darkness" (Ténébreux) restent des effets
        // purement comiques/cosmétiques, sans mécanique de combat pour l'instant. "stealth" (Silencieux)
        // n'a rien à faire ICI (pas de déclenchement pendant un échange) : il compte avant le combat,
        // dans getStealthChance(), pour éviter de se faire repérer en explorant.
    });
    // Pas de updateUI() ici, pour la même raison que dans gainSkillXp() : ne pas écraser
    // l'affichage des PV avant que l'animation du dé n'ait eu le temps d'arriver à destination.
}

// Tente d'appliquer un effet de statut au joueur selon le trait élémentaire du monstre
// (burn/poison/slow/stun/bleed/confusion/pull/light, définis dans mobModifiers). Appelée après
// une riposte ennemie réussie.
function applyMobEffectOnPlayer(enemy) {
    if (!enemy.effect) return;
    const triggerChance = 25; // 25% de chance que le trait élémentaire du monstre fasse effet
    if (Math.random() * 100 >= triggerChance) return;

    switch (enemy.effect) {
        case 'burn':
            gameState.status.bleed = { rounds: 3, dmgPerRound: 5 };
            logEvent("🔥 Vous prenez feu ! La brûlure va vous ronger quelques instants.", "danger");
            break;
        case 'poison':
            gameState.status.bleed = { rounds: 4, dmgPerRound: 4 };
            logEvent("☢️ Une sensation toxique se propage en vous.", "danger");
            break;
        case 'slow':
            gameState.status.slowed = { rounds: 2 };
            logEvent("🐌 Vos mouvements sont englués, vous vous sentez ralenti.", "danger");
            break;
        case 'stun':
            gameState.status.stunned = true;
            logEvent("⚡ Le choc vous étourdit !", "danger");
            break;
        case 'bleed':
            // Réutilise le même compteur générique que burn/poison (dégâts sur la durée),
            // avec un profil de dégâts plus lourd sur une durée plus courte.
            gameState.status.bleed = { rounds: 2, dmgPerRound: 7 };
            logEvent("🩸 Une profonde entaille vous fait perdre du sang !", "danger");
            break;
        case 'confusion':
            gameState.status.confused = { rounds: 2 };
            logEvent("🌀 Votre esprit s'embrouille, vous ne savez plus où frapper.", "danger");
            break;
        case 'pull':
            gameState.status.disarmed = { rounds: 2 };
            logEvent("🧲 Une force invisible arrache votre arme des mains !", "danger");
            break;
        case 'light':
            gameState.status.blinded = { rounds: 2 };
            logEvent("✨ Ébloui, vous peinez à parer les coups qui suivent.", "danger");
            break;
        case 'corrode':
            gameState.status.corroded = { rounds: 3 };
            logEvent("🧪 Une substance corrosive ronge votre armure ! (DEF réduite)", "danger");
            break;
        case 'fear':
            gameState.status.feared = { rounds: 3 };
            logEvent("😱 Un frisson de terreur vous paralyse ! (ATQ réduite)", "danger");
            break;
    }
}

// Durée de la pause entre l'action du joueur et la riposte de l'ennemi : juste assez pour bien
// séparer visuellement les deux dés, sans ralentir le rythme du combat.
const COMBAT_BEAT_MS = 400;

// Empêche de spammer les boutons de combat pendant la petite pause entre deux actions
function setCombatInputLocked(locked) {
    [ui.btnAttackWeapon, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnFlee, ui.btnStanceToggle].forEach(btn => {
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('opacity-40', locked);
        btn.classList.toggle('pointer-events-none', locked);
    });
}

// Riposte de l'ennemi : marque une courte pause (le temps que le dé du joueur reste bien visible)
// avant de résoudre réellement l'attaque, pour que chaque camp "joue son tour" séparément à l'écran.
function enemyCounterAttack() {
    if (!gameState.currentEnemy) return; // sécurité si le combat vient d'être résolu
    setCombatInputLocked(true);
    setTimeout(() => {
        resolveEnemyCounterAttack();
        setCombatInputLocked(false);
    }, COMBAT_BEAT_MS);
}

// Riposte de l'ennemi : tient compte de son propre saignement/étourdissement en cours,
// de l'armure équipée du joueur, et peut infliger un effet de statut selon son trait élémentaire.
function resolveEnemyCounterAttack() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return; // sécurité si le combat vient d'être résolu pendant la pause

    // Saignement en cours sur l'ennemi (infligé par une arme du joueur) : tique avant son action
    if (enemy.status && enemy.status.bleed && enemy.status.bleed.rounds > 0) {
        const dmg = enemy.status.bleed.dmgPerRound;
        enemy.hp -= dmg;
        enemy.status.bleed.rounds -= 1;
        if (enemy.status.bleed.rounds <= 0) enemy.status.bleed = null;
        logEvent(`🩸 [${enemy.name}] souffre de son saignement (-${dmg} PV).`, "danger");
        if (enemy.hp <= 0) {
            logEvent(`[${enemy.name}] succombe à ses blessures !`, "success");
            winCombat();
            return;
        }
    }

    // Étourdissement en cours sur l'ennemi : il rate son tour
    if (enemy.status && enemy.status.stunned) {
        logEvent(`[${enemy.name}] est étourdi et ne peut pas riposter !`, "info");
        enemy.status.stunned = false;
        showDie(ui.combatEnemyDie, "😴");
        updateUI();
        return;
    }

    const wasBlinded = gameState.status.blinded && gameState.status.blinded.rounds > 0;
    const wasCorroded = gameState.status.corroded && gameState.status.corroded.rounds > 0;

    // Ennemi ralenti (arme "Gelé") ou apeuré (arme "Intimidant") : sa riposte inflige moins de dégâts.
    // Les deux réductions se cumulent si l'ennemi subit les deux effets à la fois.
    let enemyAtk = enemy.atk;
    let enemySlowedNote = "";
    const enemyWasSlowed = enemy.status && enemy.status.slowed && enemy.status.slowed.rounds > 0;
    if (enemyWasSlowed) {
        enemyAtk = Math.round(enemyAtk * 0.5);
        enemySlowedNote = " (ralenti)";
        enemy.status.slowed.rounds -= 1;
        if (enemy.status.slowed.rounds <= 0) enemy.status.slowed = null;
    }
    const enemyWasFeared = enemy.status && enemy.status.feared && enemy.status.feared.rounds > 0;
    if (enemyWasFeared) {
        enemyAtk = Math.round(enemyAtk * 0.65);
        enemySlowedNote += " (apeuré)";
        enemy.status.feared.rounds -= 1;
        if (enemy.status.feared.rounds <= 0) enemy.status.feared = null;
    }

    const enemyDamage = rollDamage(enemyAtk, getEffectiveDef());
    gameState.hp -= enemyDamage;
    animateDieHit(ui.combatEnemyDie, 'right', enemyDamage, ui.combatPlayerHpRing, ui.combatPlayerHp, gameState.hp, gameState.maxHp);
    const guardNote = (gameState.companion && gameState.companion.specialty.type === 'guard')
        ? ` (réduits grâce à la garde de ${gameState.companion.name})`
        : "";
    logEvent(`[${enemy.name}]${enemySlowedNote} vous inflige ${enemyDamage} dégâts${wasBlinded ? " (vous étiez ébloui)" : ""}${wasCorroded ? " (armure corrodée)" : ""}${guardNote}.`, "danger");

    // L'éblouissement et la corrosion se dissipent d'un round à chaque riposte encaissée
    if (wasBlinded) {
        gameState.status.blinded.rounds -= 1;
        if (gameState.status.blinded.rounds <= 0) gameState.status.blinded = null;
    }
    if (wasCorroded) {
        gameState.status.corroded.rounds -= 1;
        if (gameState.status.corroded.rounds <= 0) gameState.status.corroded = null;
    }

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        setTimeout(() => gameOver(), COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer
        return;
    }

    // Compagnon "Premiers secours" : chance de soigner le joueur après la riposte ennemie
    if (gameState.companion && gameState.companion.specialty.type === 'medic' && Math.random() * 100 < 25) {
        const heal = 8 + Math.floor(Math.random() * 8); // 8 à 15 PV
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + heal);
        logEvent(`${gameState.companion.name} vous soigne rapidement ! (+${heal} PV)`, "success");
    }

    applyMobEffectOnPlayer(enemy);
    updateUI();
}

// --- Les 3 types d'attaque ---
// Chacune est reliée à sa propre compétence : plus elle est utilisée en combat, plus elle progresse
// (XP dédiée, indépendante des autres compétences et du niveau général du joueur).
const SKILL_XP_PER_USE = 3;

// Arme : la référence, équilibrée. Bénéficie du bonus de dégâts et de la mécanique spéciale
// (saignement/étourdissement) de l'arme équipée, le cas échéant.
function attackWeapon() {
    if (!tryPlayerAction()) return;

    // Arme arrachée par un effet magnétique en cours : l'attaque à l'arme est indisponible
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        if (getCombatRangeContext().playerAdvantaged) resolveDistanceTickAdvantaged(); else enemyCounterAttack();
        return;
    }

    const ctx = getCombatRangeContext();
    if (ctx.playerDisadvantaged) {
        performChaseAction("vous rapprocher");
        return;
    }

    const skill = gameState.skills.weapon;
    const atkMultiplier = 1.0 + 0.04 * (skill.level - 1); // +4% par niveau
    // En posture à distance, c'est l'arme à distance équipée qui compte (et non l'arme de mêlée)
    const equippedGear = gameState.stance === 'ranged' ? gameState.equipment.ranged : gameState.equipment.weapon;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;
    const label = gameState.stance === 'ranged' ? "à distance" : "à l'arme";

    const used = performPlayerAttack(
        effectiveAtk,
        { atkMultiplier, varianceRange: 0.15, defReduction: 0 },
        label,
        ctx.playerAdvantaged ? resolveDistanceTickAdvantaged : null
    );
    if (used) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(equippedGear); // Ne fait rien si le combat vient de se terminer ou si l'arme n'a pas de mécanique
    }
}

// Mains nues : moins puissant, mais ignore une bonne partie de la DEF adverse. Impossible en
// posture à distance (le bouton est masqué dans ce cas, ce garde-fou couvre les cas limites).
// Chaque niveau de compétence Mains nues améliore la capacité à contourner la DEF adverse.
function attackUnarmed() {
    if (!tryPlayerAction()) return;

    if (gameState.stance === 'ranged') {
        logEvent("Difficile de frapper à mains nues à cette distance !", "danger");
        return;
    }

    const ctx = getCombatRangeContext();
    if (ctx.playerDisadvantaged) {
        performChaseAction("vous rapprocher");
        return;
    }

    const skill = gameState.skills.unarmed;
    const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1)); // +3% par niveau, plafonné à 75%
    const used = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75, varianceRange: 0.10, defReduction }, "à mains nues");
    if (used) gainSkillXp('unarmed', SKILL_XP_PER_USE);
}

// Magie : la plus puissante en moyenne, mais imprévisible, et peut totalement rater (thème absurde/chaotique).
// Chaque niveau de compétence Magie réduit le risque de rater son sort ET augmente légèrement sa puissance.
// (Plus tard : nécessitera un sort appris et du mana.)
// Magie : la plus puissante en moyenne, mais imprévisible, et peut totalement rater (thème absurde/chaotique).
// Chaque niveau de compétence Magie réduit le risque de rater son sort ET augmente légèrement sa puissance.
// Pour l'instant, la Magie est considérée à la fois comme une arme de mêlée ET à distance : elle
// ignore totalement la mécanique de distance (jamais bloquée, jamais "avantagée" non plus) — un
// vrai carnet de sorts/mana viendra plus tard réviser tout ça en profondeur.
// (Plus tard : nécessitera un sort appris et du mana.)
function attackMagic() {
    if (!tryPlayerAction()) return;

    const skill = gameState.skills.magic;
    const backfireChance = Math.max(3, 15 - 1.5 * (skill.level - 1)); // 15% de base, jusqu'à 3% minimum
    const atkMultiplier = 1.4 + 0.02 * (skill.level - 1);

    if (Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        logEvent("Votre sort part de travers et fait un flop retentissant. Aucun dégât.", "danger");
        enemyCounterAttack();
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    const used = performPlayerAttack(
        gameState.atk,
        { atkMultiplier, varianceRange: 0.35, defReduction: 0 },
        "magiquement"
    );
    if (used) gainSkillXp('magic', SKILL_XP_PER_USE);
}

// Tentative de fuite : quitte le combat sans le gagner ni obtenir de loot/XP.
// En cas d'échec, l'ennemi place une attaque gratuite.
function attemptFlee() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    const enemy = gameState.currentEnemy;
    let fleeChance = 60; // 60% de réussite de base (pourra dépendre de compétences/stats plus tard)
    if (gameState.companion && gameState.companion.specialty.type === 'scout') {
        fleeChance += 15; // Compagnon "Éclaireur" : facilite la fuite
    }

    if (Math.random() * 100 < fleeChance) {
        const scoutNote = (gameState.companion && gameState.companion.specialty.type === 'scout')
            ? ` (${gameState.companion.name} vous a montré une ouverture)`
            : "";
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !${scoutNote}`, "info");
        gameState.currentEnemy = null;
        gameState.inCombat = false;
        gameState.pendingStairAfterCombat = false; // La fuite ne compte pas comme une victoire sur le gardien
        gameState.pendingBossRoomId = null; // Le boss reste vivant, la salle n'est pas marquée vaincue
        gameState.pendingSneakAttack = false; // Ne doit pas se reporter sur un combat futur
        if (gameState.pendingTravel) {
            logEvent("Vous rebroussez chemin, le trajet est annulé pour l'instant.", "info");
            gameState.pendingTravel = null;
        }
        gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null }; // Les statuts ne survivent pas au combat
        updateUI();
    } else {
        logEvent(`Votre fuite échoue ! [${enemy.name}] profite de l'ouverture.`, "danger");
        enemyCounterAttack();
    }
}

function winCombat() {
    const wasBoss = gameState.currentEnemy && gameState.currentEnemy.isBoss;

    if (wasBoss) {
        logEvent(`👑 Vous avez triomphé de ${gameState.currentEnemy.name} !`, "success");
        triggerHaptic('heavy');
    } else {
        logEvent("Vous remportez le combat !", "success");
        triggerHaptic('medium');
    }

    // Gain d'XP basé sur le monstre vaincu (valeur de repli si jamais xpReward est absent)
    const xpGained = (gameState.currentEnemy && gameState.currentEnemy.xpReward) || 10;
    gainXp(xpGained);

    // Le compagnon actif progresse aussi (fait grimper son agressivité — voir gainCompanionXp)
    if (gameState.companion) {
        gainCompanionXp(15);
    }

    // Butin : garanti pour un boss (avec une chance de second objet), sinon la chance standard.
    // La rareté du loot est pondérée par la puissance du monstre vaincu (voir getLootPowerScore).
    const lootPower = getLootPowerScore(gameState.currentEnemy);
    if (wasBoss) {
        addLoot(lootPower);
        if (Math.random() * 100 < 50) addLoot(lootPower); // 50% de chance d'un deuxième objet
    } else if (Math.random() * 100 < 40) { // 40% de chance de loot post-combat
        addLoot(lootPower);
    }

    gameState.currentEnemy = null;
    gameState.inCombat = false;
    gameState.pendingSneakAttack = false;
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null }; // Les statuts ne survivent pas au combat

    // Si ce combat était une salle de boss du quartier (escalier ou non), la salle est désormais
    // calme : on la marque vaincue et on retire le lieu connu correspondant, s'il existait.
    if (gameState.pendingBossRoomId) {
        const bossRoom = gameState.floorMap && gameState.floorMap.roomsById[gameState.pendingBossRoomId];
        if (bossRoom) bossRoom.defeated = true;
        removeKnownLocation(`boss-${gameState.pendingBossRoomId}`);
        gameState.pendingBossRoomId = null;
    }

    // Si ce combat faisait partie d'un trajet de retour vers un lieu connu (embuscade),
    // on enchaîne sur la suite du trajet (nouvelle embuscade ou arrivée à destination)
    if (gameState.pendingTravel) {
        triggerNextAmbushOrArrive();
        return;
    }

    // Si ce combat gardait un escalier, la victoire ouvre le passage vers l'étage suivant
    if (gameState.pendingStairAfterCombat) {
        gameState.pendingStairAfterCombat = false;
        logEvent("La voie vers l'escalier est libre !", "success");
        nextFloor(); // nextFloor() appelle déjà updateUI()
        return;
    }

    updateUI();
}

// ==========================================
// 2. BOUCLE DE GAMEPLAY
// ==========================================
// Depuis une pièce donnée, trouve la pièce-frontière (avec au moins un voisin non visité) la plus
// proche par BFS (hors la pièce de départ elle-même). Utilisé pour la nouvelle option "Chemin
// connu -> Bifurcation la plus proche", qui voyage jusqu'à cette pièce comme un lieu connu
// (coût en temps + risque d'embuscade proportionnels à la distance réelle).
function findNearestFrontierRoom(startRoomId) {
    const roomsById = gameState.floorMap.roomsById;
    const seen = new Set([startRoomId]);
    const queue = [startRoomId];

    while (queue.length > 0) {
        const id = queue.shift();
        const room = roomsById[id];
        const isFrontier = room.neighbors.some(edge => !roomsById[edge.to].visited);
        if (id !== startRoomId && isFrontier) return id;
        room.neighbors.forEach(edge => {
            if (!seen.has(edge.to)) {
                seen.add(edge.to);
                queue.push(edge.to);
            }
        });
    }
    return null;
}

// Étape d'exploration proprement dite : consomme le temps et avance vers un voisin non visité au
// hasard. Appelée directement dès qu'un voisin non visité existe (bifurcation ou non) ; sinon,
// c'est autoTravelToNearestFrontier() qui prend le relais.
function performExploreStep() {
    const roomsById = gameState.floorMap.roomsById;
    const current = roomsById[gameState.floorMap.currentRoomId];

    gameState.timeLeft -= 1;
    gameState.cardsDrawnThisFloor += 1;

    ui.cardBody.innerHTML = "";
    playCardDrawAnimation();

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return;
    }

    const unvisitedNeighbors = current.neighbors.filter(edge => !roomsById[edge.to].visited);
    if (unvisitedNeighbors.length === 0) {
        // Ne devrait plus arriver (explore() ne l'appelle plus dans ce cas), sécurité
        updateUI();
        return;
    }
    const nextRoomId = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)].to;
    const nextRoom = roomsById[nextRoomId];
    const changedQuadrant = nextRoom.quadrant !== gameState.floorMap.currentQuadrant;

    gameState.floorMap.currentRoomId = nextRoomId;
    gameState.floorMap.currentQuadrant = nextRoom.quadrant;

    if (changedQuadrant) {
        gameState.currentDistrict = gameState.floorMap.quadrants[nextRoom.quadrant].district;
        logEvent(`Le couloir débouche sur un nouveau secteur. Vous entrez dans : ${gameState.currentDistrict}.`, "info");
    }

    enterRoom(nextRoom);
    updateUI();
}

// Si la pièce courante n'a plus aucun voisin non visité, part automatiquement vers la bifurcation
// inexplorée la plus proche (même système de coût/risque que pour un lieu connu), sans demander
// confirmation : à égalité de distance, le choix se fait au hasard (via findNearestFrontierRoom,
// qui explore le graphe dans un ordre non biaisé).
function autoTravelToNearestFrontier() {
    const frontierRoomId = findNearestFrontierRoom(gameState.floorMap.currentRoomId);
    if (!frontierRoomId) {
        setCardHeader('🗺️', 'Étage Entièrement Exploré', 'Exploration');
        logEvent("Vous avez arpenté chaque recoin accessible de cet étage. Direction l'escalier ?", "info");
        updateUI();
        return;
    }

    const location = { id: 'frontier', type: 'frontier', roomId: frontierRoomId, label: 'Zone inexplorée la plus proche' };
    const distance = computeDistance(gameState.floorMap.currentRoomId, frontierRoomId);
    const timeCost = Math.max(1, Math.round(distance / 2));
    const ambushBaseChance = Math.min(80, distance * 9);
    let ambushCount = 0;
    if (Math.random() * 100 < ambushBaseChance) {
        ambushCount = 1;
        if (Math.random() * 100 < ambushBaseChance * 0.6) ambushCount = 2;
    }

    gameState.timeLeft = Math.max(0, gameState.timeLeft - timeCost);
    gameState.pendingTravel = { destination: location, ambushesRemaining: ambushCount };
    logEvent(`Ce secteur est entièrement connu : vous filez vers une zone inexplorée (${distance}, -${timeCost}H)...`, "info");
    if (ambushCount > 0) {
        logEvent("Le trajet ne s'annonce pas de tout repos...", "danger");
    }

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return;
    }
    triggerNextAmbushOrArrive();
}

function explore() {
    if (isActionBlocked()) return; // Sécurité si combat en cours ou décision en attente
    if (gameState.hp <= 0 || gameState.timeLeft <= 0) return; // Jeu terminé
    if (!gameState.floorMap) return; // Sécurité si la carte de l'étage n'est pas encore prête

    // Le compagnon a atteint son seuil d'agressivité : il faut d'abord régler la situation
    if (gameState.companion && gameState.companion.aggressiveness >= 100) {
        triggerCompanionHostileTurn();
        return; // Ce tour est consommé par la confrontation, pas par un tirage de carte
    }

    const roomsById = gameState.floorMap.roomsById;
    const current = roomsById[gameState.floorMap.currentRoomId];
    const hasUnvisited = current.neighbors.some(edge => !roomsById[edge.to].visited);

    if (hasUnvisited) {
        // De l'inconnu à proximité (bifurcation ou non) : on explore, sans jamais demander confirmation
        performExploreStep();
        return;
    }

    // Plus rien d'inconnu ici : on file automatiquement vers la zone inexplorée la plus proche
    autoTravelToNearestFrontier();
}

function gameOver(timeout = false) {
    gameState.inCombat = true; // Bloque toute action supplémentaire
    ui.combatZone.classList.add('hidden'); // Cache la zone de combat

    const reason = timeout
        ? "Le temps est écoulé. Le donjon s'effondre sur vous..."
        : "Vos signes vitaux sont à zéro. Fin de transmission.";

    logEvent(reason, "danger");
    logEvent("--- GAME OVER ---", "danger");
    triggerHaptic('heavy');

    // Remplissage et affichage de l'écran Game Over (recouvre toute l'interface)
    ui.gameOverReason.innerText = reason;
    ui.gameOverFloor.innerText = gameState.currentFloor;
    ui.gameOverLevel.innerText = gameState.level;
    ui.gameOverDistrict.innerText = gameState.currentDistrict;
    ui.gameOverOverlay.classList.remove('hidden');

    updateUI();
}

// Redémarre entièrement une nouvelle partie. On recharge la page plutôt que de réinitialiser
// gameState champ par champ : c'est plus robuste (aucun risque d'oublier un champ imbriqué comme
// les compétences, l'équipement ou les statuts de combat) et parfaitement adapté à un rogue-like
// où une "run" terminée n'a de toute façon rien à conserver d'une partie à l'autre.
function resetGame() {
    location.reload();
}

// ==========================================
// INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS
// ==========================================

// Toucher la carte fait office de bouton "Explorer" (explore() ignore déjà les clics pendant un combat)
ui.cardStackWrapper.addEventListener('click', () => {
    if (isActionBlocked() || gameState.hp <= 0) return;
    triggerHaptic('medium');
    explore();
});

// Bouton de redémarrage sur l'écran Game Over
ui.btnRestart.addEventListener('click', resetGame);

// Clics sur les boutons de combat
ui.btnAttackWeapon.addEventListener('click', attackWeapon);
ui.btnAttackUnarmed.addEventListener('click', attackUnarmed);
ui.btnAttackMagic.addEventListener('click', attackMagic);
ui.btnFlee.addEventListener('click', attemptFlee);
if (ui.btnStanceToggle) ui.btnStanceToggle.addEventListener('click', togglePlayerStance);

// Clics sur les boutons de choix de boss (Combattre / Repérer et partir)
ui.btnFightBoss.addEventListener('click', fightBossNow);
ui.btnRetreatBoss.addEventListener('click', retreatFromBoss);

// Clics sur les boutons de choix de furtivité (Esquiver / Attaque Furtive)
ui.btnStealthEvade.addEventListener('click', attemptStealthEvasion);
ui.btnStealthAttack.addEventListener('click', attemptStealthAttack);

// Clics sur les boutons de rencontre de compagnon
ui.btnRecruitFriendly.addEventListener('click', recruitCompanion);
ui.btnDeclineCompanion.addEventListener('click', declineCompanion);
ui.btnFleeCompanion.addEventListener('click', fleeCompanionEncounter);
ui.btnRecruitHostile.addEventListener('click', recruitCompanion);
ui.btnAttackCompanion.addEventListener('click', attackCompanionEncounter);

// Clic sur l'export des logs Dev
ui.btnDevLogs.addEventListener('click', () => {
    console.log("--- LOGS DE DÉVELOPPEMENT ---");
    console.table(gameState);
    logEvent("Statistiques système exportées dans la console (F12).", "info");
});

// Lancement du jeu
generateFloorMap();
updateUI();
updateInventoryUI();
updateKnownLocationsUI();
updateCompanionUI();

