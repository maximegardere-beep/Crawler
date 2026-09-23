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
    // Mana (0-100, fixe) : n'existe concrètement pour le joueur qu'une fois un sort équipé (voir
    // equipSpell()) — la barre correspondante reste masquée tant que gameState.equipment.spell est
    // null. Se régénère comme les PV : passif (voir applyTimeElapsedRegen()), potions, aide
    // compagnon. Voir attackMagic().
    mana: 100,
    maxMana: 100,
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
        ranged: null, // Objet de catégorie 'ranged' équipé, ou null
        spell: null   // Parchemin (catégorie 'scrolls') équipé, ou null — voir equipSpell()
    },
    // Inventaire magique : parchemins de sorts appris (trouvés en loot) mais pas équipés. Séparé de
    // `inventory` (voir spells.js/generateSpellScroll()) : un sort ne compte pas dans maxInventory,
    // pas plus qu'un consommable. Le sort actuellement équipé n'y figure jamais (voir equipSpell()).
    spellbook: [],
    // Écart de distance courant (0 = corps à corps). Aucune notion de posture : la distance de
    // départ dépend uniquement de la nature du mob (mob.ranged), et n'évolue ensuite que via les
    // actions dédiées S'approcher/S'éloigner (attemptSprint/attemptRetreat) — voir config.rangedCombat.
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
    // Étage urbain (multiples de 3 — voir generateUrbanFloorMap()) : réseau de villes sûres reliées
    // par des routes dangereuses, exclusif de floorMap (l'un des deux vaut toujours null). Une seule
    // ville porte l'escalier (ou la Sortie à l'étage final), potentiellement gardée par un boss
    // généré depuis le thème unique de l'étage (theme, réutilise un quartier existant de districts.js
    // au même titre qu'un quartier classique — voir gameState.currentDistrict).
    urbanMap: null,
    pendingUrbanTravel: null, // { destinationCityId, ambushesRemaining } pendant un trajet entre villes
    pendingUrbanBossEncounter: null, // { cityId, isExit } pendant un choix combattre/repérer urbain
    pendingUrbanBossCityId: null, // Ville dont le combat de boss est en cours, pour la marquer vaincue à la victoire
    pendingUrbanAdvanceAfterCombat: null, // 'nextFloor' | 'win' | null : ce que la victoire du combat en cours déclenche
    hasWon: false, // Vrai une fois la Sortie de l'étage final franchie (voir winGame())
    companion: null, // Compagnon actuellement recruté (ou null)
    pendingCompanionCandidate: null, // Candidat en attente de décision (recruter/laisser/fuir/attaquer)
    companionChoicePending: false, // Une décision de compagnon est en attente
    // Autosauvegarde (voir saveGame()) : faux pendant l'initialisation silencieuse au chargement de
    // la page (avant que le joueur n'ait confirmé son nom), pour ne jamais écraser une sauvegarde
    // existante avec un état par défaut. Activé par confirmPlayerName()/restoreSaveForName().
    saveEnabled: false
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
        // loot/minorFind rééquilibrés (1->4 / 6->3, validé) : moins de petites trouvailles de PV
        // (régénération désormais surtout passive, voir applyTimeElapsedRegen()), plus d'objets sans
        // toucher à leur rareté (gérée ailleurs par rollRarity()/getLootPowerScore()).
        nothing: 40,        // Rien de notable
        combat: 25,         // Rencontre hostile
        loot: 4,            // Objet généré procéduralement
        trap: 10,           // NOUVEAU : piège avec de vrais dégâts
        timeLoss: 8,        // NOUVEAU : détour qui coûte du temps
        minorFind: 3,       // NOUVEAU : petite trouvaille (soin mineur)
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

    // Paramètres du combat à distance (mobs marqués `ranged: true` dans bestiary.js). Voir
    // getCombatRangeContext()/resolveDistanceRound() dans app.js.
    rangedCombat: {
        initialDistance: 4,     // Écart de départ face à un mob à distance (en "unités")
        maxDistance: 8,         // Plafond de l'écart (ne peut pas s'éloigner indéfiniment)
        dieSides: 6,            // Taille du dé opposé lancé chaque manche par le joueur ET le mob
        levelAdvantageDivisor: 4 // Bonus au dé du joueur = floor(niveau / ce diviseur)
    },

    // Seuil de mob.threatMultiplier (voir generateMob() dans generator.js) à partir duquel un mob
    // NON-boss est signalé comme dangereux par l'icône 💀 (nom du combat, panneau "Examiner",
    // annonce de rencontre). 1.8 correspond environ à un seul modificateur "Musculeux"/"Colossal",
    // ou à deux modificateurs plus modestes combinés — valeur de départ, à ajuster par playtest.
    eliteThreatMultiplier: 1.8,

    // Étages urbains (multiples de 3 — voir generateUrbanFloorMap()). "theme" réutilise TEL QUEL le
    // nom d'un quartier existant (districts.js/bestiary.js) comme thématique unique de tout l'étage :
    // generateMob()/generateBoss() n'ont besoin d'aucune adaptation, ils reçoivent simplement ce nom
    // à la place d'un nom de quartier classique (voir gameState.currentDistrict). Aucun contenu neuf
    // à maintenir en double. stairsGuardChanceByFloor : probabilité (croissante avec la profondeur)
    // que la ville de l'escalier soit gardée ; la Sortie de l'étage final, elle, est TOUJOURS gardée
    // (dernier obstacle avant la victoire), pas de pourcentage à consulter pour elle.
    urbanFloors: {
        finalFloor: 18,
        themes: {
            3: "Rue des Illusions",
            6: "Parking Souterrain Maudit",
            9: "Marché Noir du Donjon",
            12: "Studio de Télé-Achat Abandonné",
            15: "Bureaux de l'Administration Pénitentiaire",
            18: "Salle des Machines Infernales"
        },
        stairsGuardChanceByFloor: { 3: 20, 6: 35, 9: 50, 12: 65, 15: 80 }
    }
};

// Un mob non-boss est "élite" si ses modificateurs (voir threatMultiplier dans generateMob())
// dépassent le seuil de config.eliteThreatMultiplier. Les boss ont déjà leur propre signal (👑) :
// on ne les affuble jamais d'un 💀 en plus, même si un jour ils portaient des modificateurs.
function isEliteMob(mob) {
    return !!mob && !mob.isBoss && (mob.threatMultiplier || 1) >= config.eliteThreatMultiplier;
}

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
    ],
    // Blagues sarcastiques accompagnant le cadeau de bienvenue de l'écran de départ (voir
    // revealWelcomeGift()), une par type de cadeau possible — même ton que audienceGift/flavorOnly
    // ci-dessus (émission de téléréalité indifférente au sort du candidat).
    welcomeGift: {
        weapon: [
            "Le sponsor a économisé sur la qualité. Sans doute pour financer le champagne des producteurs.",
            "Cadeau certifié \"à peine fonctionnel\" par le service qualité du Donjon.",
            "L'audience trouve ça \"charmant\". Vous, vous trouvez ça inquiétant.",
            "Fabriqué avec amour. Et probablement du scotch."
        ],
        ranged: [
            "Portée maximale : optimiste. Précision : discutable. Ambiance : garantie.",
            "Le stagiaire chargé du stock d'armes a fait ce qu'il a pu avec ce qu'il restait.",
            "Ceci a été \"testé\" par un précédent candidat. Il n'a pas survécu pour donner son avis.",
            "Le règlement exige un cadeau à distance. Personne n'a précisé qu'il devait toucher sa cible."
        ],
        spell: [
            "Un parchemin visiblement récupéré dans les objets trouvés d'un crawler précédent. Paix à son âme.",
            "La magie, ça se mérite. Ceci, en revanche, ça se subit.",
            "Le service magie du Donjon vous souhaite \"bonne chance\", entre guillemets bien sentis.",
            "Testé en interne. Les résultats n'ont pas été jugés diffusables à l'antenne."
        ],
        nothing: [
            "Le budget cadeaux a été réaffecté aux paris des spectateurs sur votre espérance de vie.",
            "Le Donjon vous souhaite la bienvenue. C'est tout. C'est le cadeau.",
            "Un stagiaire a \"oublié\" votre cadeau. Le Donjon présente ses excuses, pas un remplacement.",
            "Sponsorisé par personne. Financé par rien. Bienvenue quand même."
        ]
    }
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
    screenFxOverlay: document.getElementById('screen-fx-overlay'),
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
    equippedArmorBadges: document.getElementById('equipped-armor-badges'),
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
    winOverlay: document.getElementById('win-overlay'),
    winFloor: document.getElementById('win-floor'),
    winLevel: document.getElementById('win-level'),
    btnWinRestart: document.getElementById('btn-win-restart'),
    combatZone: document.getElementById('combat-zone'),
    knownLocationsSection: document.getElementById('known-locations-section'),
    knownLocationsContainer: document.getElementById('known-locations'),
    urbanMapSection: document.getElementById('urban-map-section'),
    urbanMapContainer: document.getElementById('urban-map-container'),
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
    companionLeaveBar: document.getElementById('companion-leave-bar'),
    companionCombatIndicator: document.getElementById('companion-combat-indicator'),
    companionCombatName: document.getElementById('companion-combat-name'),
    companionCombatHpRing: document.getElementById('companion-combat-hp-ring'),
    companionCombatHp: document.getElementById('companion-combat-hp'),
    enemyName: document.getElementById('enemy-name'),
    btnAttackWeapon: document.getElementById('btn-attack-weapon'),
    btnAttackRanged: document.getElementById('btn-attack-ranged'),
    btnAttackUnarmed: document.getElementById('btn-attack-unarmed'),
    btnAttackMagic: document.getElementById('btn-attack-magic'),
    btnSprint: document.getElementById('btn-sprint'),
    btnRetreat: document.getElementById('btn-retreat'),
    btnFlee: document.getElementById('btn-flee'),
    combatDistanceWrapper: document.getElementById('combat-distance-wrapper'),
    combatDistanceFill: document.getElementById('combat-distance-fill'),
    combatDistancePlayerIcon: document.getElementById('combat-distance-player-icon'),
    combatDistanceEnemyIcon: document.getElementById('combat-distance-enemy-icon'),
    equippedRanged: document.getElementById('equipped-ranged'),
    btnDevTestKit: document.getElementById('btn-dev-testkit'),
    equippedSpell: document.getElementById('equipped-spell'),
    spellbookCards: document.getElementById('spellbook-cards'),
    manaBarWrapper: document.getElementById('mana-bar-wrapper'),
    manaText: document.getElementById('mana-text'),
    manaBar: document.getElementById('mana-bar'),
    combatManaWrapper: document.getElementById('combat-mana-wrapper'),
    combatManaText: document.getElementById('combat-mana-text'),
    combatManaBar: document.getElementById('combat-mana-bar'),
    startScreenOverlay: document.getElementById('start-screen-overlay'),
    startNameInput: document.getElementById('start-name-input'),
    startSavesHint: document.getElementById('start-saves-hint'),
    btnStartConfirm: document.getElementById('btn-start-confirm'),
    giftRevealOverlay: document.getElementById('gift-reveal-overlay'),
    giftRevealIcon: document.getElementById('gift-reveal-icon'),
    giftRevealTitle: document.getElementById('gift-reveal-title'),
    giftRevealItemName: document.getElementById('gift-reveal-item-name'),
    giftRevealJoke: document.getElementById('gift-reveal-joke'),
    btnGiftContinue: document.getElementById('btn-gift-continue')
};

// ==========================================
// 5. AFFICHAGE ET MISE À JOUR DE L'UI
// ==========================================
// Formate un nombre d'heures restantes en "Xj Yh" (ou juste "Yh" si moins d'un jour plein),
// pour rester lisible sur le badge compact une fois le temps alloué augmenté au-delà de 24H.
function formatTimeRemaining(hours) {
    const total = Math.max(0, Math.round(hours));
    const days = Math.floor(total / 24);
    const rem = total % 24;
    return days > 0 ? `${days}j ${rem}h` : `${rem}h`;
}

// Empile sur l'overlay d'ambiance les classes correspondant aux états critiques actuellement actifs
// (PV bas, saignement/brûlure, confusion, aveuglement, corrosion, peur) : plusieurs peuvent être
// visibles à la fois. Appelé à chaque updateUI(), aussi bien en combat que hors combat (un
// saignement ou une confusion peuvent survivre un instant après un combat interrompu par une fuite).
function applyScreenStateEffects() {
    if (!ui.screenFxOverlay) return;
    const classes = {
        'fx-low-hp': gameState.maxHp > 0 && (gameState.hp / gameState.maxHp) <= 0.25 && gameState.hp > 0,
        'fx-burn': !!(gameState.status.bleed && gameState.status.bleed.rounds > 0),
        'fx-confused': !!(gameState.status.confused && gameState.status.confused.rounds > 0),
        'fx-blinded': !!(gameState.status.blinded && gameState.status.blinded.rounds > 0),
        'fx-corroded': !!(gameState.status.corroded && gameState.status.corroded.rounds > 0),
        'fx-feared': !!(gameState.status.feared && gameState.status.feared.rounds > 0)
    };
    for (const cls in classes) {
        ui.screenFxOverlay.classList.toggle(cls, classes[cls]);
    }
}

// ==========================================
// SAUVEGARDE (localStorage, une entrée par nom de crawler)
// ==========================================
// Une sauvegarde par nom de crawler (saisi sur l'écran de départ, voir confirmPlayerName()) :
// c'est le nom qui identifie la partie, pas un slot numéroté. Clé normalisée (espaces + casse
// ignorés) pour que "Barbara" et "barbara " pointent vers la même sauvegarde, tout en conservant la
// casse d'origine dans gameState.playerName (restaurée depuis le JSON, jamais depuis la saisie).
const SAVE_KEY_PREFIX = 'crawler-save::';

function saveKeyForName(name) {
    return SAVE_KEY_PREFIX + name.trim().toLowerCase();
}

// Sauvegarde tout gameState tel quel (y compris un éventuel combat en cours) : restoreSaveForName()
// se charge de nettoyer l'état transitoire au chargement plutôt que d'essayer de ne jamais sauver
// en pleine action, ce qui serait bien plus fragile (nombreux points d'appel à traquer).
function saveGame() {
    if (!gameState.saveEnabled || !gameState.playerName) return;
    try {
        localStorage.setItem(saveKeyForName(gameState.playerName), JSON.stringify(gameState));
    } catch (e) {
        // Quota dépassé ou localStorage indisponible (navigation privée, contexte restreint...) :
        // on continue à jouer sans persistance plutôt que de planter.
    }
}

function hasSaveForName(name) {
    if (!name || !name.trim()) return false;
    try {
        return localStorage.getItem(saveKeyForName(name)) !== null;
    } catch (e) {
        return false;
    }
}

// Restaure une sauvegarde par-dessus le gameState courant (Object.assign, pas un remplacement pur :
// un champ absent d'une ancienne sauvegarde garde sa valeur par défaut plutôt que de devenir
// undefined). Atterrit TOUJOURS sur l'écran d'exploration normal, jamais en plein combat ni sur un
// choix bloquant, même si la sauvegarde datait d'un de ces instants.
function restoreSaveForName(name) {
    let raw;
    try {
        raw = localStorage.getItem(saveKeyForName(name));
    } catch (e) {
        return false;
    }
    if (!raw) return false;

    let saved;
    try {
        saved = JSON.parse(raw);
    } catch (e) {
        return false; // Sauvegarde corrompue : on ignore plutôt que de planter
    }

    Object.assign(gameState, saved);

    // Nettoyage de l'état transitoire/bloquant
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.combatDistance = 0;
    gameState.bossChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.pendingSneakAttack = false;
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    gameState.pendingTravel = null;

    gameState.saveEnabled = true; // Réactive l'autosave après une restauration réussie
    return true;
}

// Noms des crawlers ayant une sauvegarde (indice affiché sur l'écran de départ) : on relit
// directement gameState.playerName DANS chaque sauvegarde plutôt que la clé normalisée, pour
// afficher la casse d'origine.
function listSavedCrawlerNames() {
    const names = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                if (saved && saved.playerName) names.push(saved.playerName);
            } catch (e) {
                // Entrée corrompue : ignorée plutôt que de faire échouer toute la liste
            }
        }
    } catch (e) {
        // localStorage indisponible : liste vide, pas d'erreur
    }
    return names;
}

function updateUI() {
    applyScreenStateEffects();
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

    // Barre de Mana : n'existe côté joueur (visuellement) qu'une fois un sort équipé, voir
    // equipSpell(). Mise à jour ici (hors combat) ET dans la zone de combat plus bas, toutes deux
    // pilotées par le même gameState.mana.
    const hasSpellEquipped = !!gameState.equipment.spell;
    if (ui.manaBarWrapper) {
        ui.manaBarWrapper.classList.toggle('hidden', !hasSpellEquipped);
        if (hasSpellEquipped) {
            ui.manaText.innerText = `${Math.round(gameState.mana)}/${gameState.maxMana}`;
            ui.manaBar.style.width = `${Math.min(100, (gameState.mana / gameState.maxMana) * 100)}%`;
        }
    }
    if (ui.combatManaWrapper) {
        ui.combatManaWrapper.classList.toggle('hidden', !hasSpellEquipped);
        if (hasSpellEquipped) {
            ui.combatManaText.innerText = `${Math.round(gameState.mana)}/${gameState.maxMana}`;
            ui.combatManaBar.style.width = `${Math.min(100, (gameState.mana / gameState.maxMana) * 100)}%`;
        }
    }

    // Mise à jour du temps
    ui.timeText.innerText = formatTimeRemaining(gameState.timeLeft);    const timePercentage = (gameState.timeLeft / gameState.maxTime) * 100;
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
            const elite = isEliteMob(gameState.currentEnemy);
            ui.enemyName.innerText = gameState.currentEnemy.isBoss
                ? `👑 ${gameState.currentEnemy.name}`
                : elite ? `💀 ${gameState.currentEnemy.name}` : gameState.currentEnemy.name;
            ui.enemyName.classList.toggle('text-yellow-400', !!gameState.currentEnemy.isBoss);
            ui.enemyName.classList.toggle('text-red-500', elite);

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

        // --- Distance de combat : verrouille/déverrouille Arme, Tir et Mains nues selon l'écart
        // actuel (0 = corps à corps possible, >0 = seul le Tir porte). La barre est TOUJOURS
        // affichée pendant un combat, même à 0, pour que l'état du duel reste visible en permanence.
        // Aucune notion de posture : ces règles ne dépendent que de l'écart courant et de l'équipement.
        const distance = gameState.combatDistance || 0;
        const atMelee = distance <= 0;
        const enemyIsMelee = gameState.currentEnemy ? !mobWantsFar(gameState.currentEnemy) : false;
        if (ui.btnAttackWeapon) {
            const weaponUsable = atMelee && !!gameState.equipment.weapon;
            ui.btnAttackWeapon.disabled = !weaponUsable;
            ui.btnAttackWeapon.classList.toggle('opacity-40', !weaponUsable);
            ui.btnAttackWeapon.classList.toggle('pointer-events-none', !weaponUsable);
        }
        if (ui.btnAttackUnarmed) {
            ui.btnAttackUnarmed.disabled = !atMelee;
            ui.btnAttackUnarmed.classList.toggle('opacity-40', !atMelee);
            ui.btnAttackUnarmed.classList.toggle('pointer-events-none', !atMelee);
        }
        if (ui.btnAttackRanged) {
            const rangedUsable = !atMelee && !!gameState.equipment.ranged;
            ui.btnAttackRanged.disabled = !rangedUsable;
            ui.btnAttackRanged.classList.toggle('opacity-40', !rangedUsable);
            ui.btnAttackRanged.classList.toggle('pointer-events-none', !rangedUsable);
        }
        // Magie : un seul sort équipé à la fois (gameState.equipment.spell), mais sa catégorie
        // (melee/ranged) le fait se comporter exactement comme Arme/Tir — grisé au mauvais écart, ou
        // sans mana suffisant, ou sans aucun sort équipé. Le libellé du bouton reflète le sort
        // équipé (nom, icône, coût), sinon une invitation neutre à passer par le Grimoire.
        if (ui.btnAttackMagic) {
            const spell = gameState.equipment.spell;
            let magicUsable = false;
            if (spell) {
                const spellDistanceOk = spell.spellCategory === 'melee' ? atMelee : !atMelee;
                magicUsable = spellDistanceOk && gameState.mana >= spell.manaCost;
            }
            ui.btnAttackMagic.disabled = !magicUsable;
            ui.btnAttackMagic.classList.toggle('opacity-40', !magicUsable);
            ui.btnAttackMagic.classList.toggle('pointer-events-none', !magicUsable);
            ui.btnAttackMagic.innerHTML = spell
                ? `${spell.icon || '✨'} ${spell.spellName}<span class="block text-[8px] normal-case opacity-70">🔷 ${spell.manaCost}</span>`
                : `✨ Magie<span class="block text-[8px] normal-case opacity-70">(aucun sort)</span>`;
        }
        // S'approcher (attemptSprint) / S'éloigner (attemptRetreat) : TOUJOURS affichés pendant un
        // combat, jamais masqués — seulement grisés à l'extrémité correspondante (rien à combler à
        // écart nul, rien à gagner à écart maximal). Chacun booste le jet de positionnement en
        // faveur du joueur (avantage : deux dés, le meilleur gardé), quel que soit le type de mob.
        if (ui.btnSprint) {
            const approachUsable = !!gameState.currentEnemy && distance > 0;
            ui.btnSprint.disabled = !approachUsable;
            ui.btnSprint.classList.toggle('opacity-40', !approachUsable);
            ui.btnSprint.classList.toggle('pointer-events-none', !approachUsable);
        }
        if (ui.btnRetreat) {
            const retreatUsable = !!gameState.currentEnemy && distance < config.rangedCombat.maxDistance;
            ui.btnRetreat.disabled = !retreatUsable;
            ui.btnRetreat.classList.toggle('opacity-40', !retreatUsable);
            ui.btnRetreat.classList.toggle('pointer-events-none', !retreatUsable);
        }

        // Icônes joueur/ennemi sur la barre : le mob est TOUJOURS à gauche, le joueur TOUJOURS à
        // droite, tous deux reflétant symétriquement le même écart courant de part et d'autre du
        // centre — HOME_EDGE est la position de chaque camp à l'écart maximal, ADJACENT_GAP l'écart
        // minimal entre les deux icônes à écart nul (corps à corps), pour qu'elles restent
        // visuellement distinctes sans se superposer.
        if (ui.combatDistancePlayerIcon && ui.combatDistanceEnemyIcon && ui.combatDistanceFill) {
            const maxDist = config.rangedCombat.maxDistance || 1;
            const ratio = Math.max(0, Math.min(1, distance / maxDist));
            const HOME_EDGE = 8;
            const ADJACENT_GAP = 5;
            const half = 50 - ADJACENT_GAP / 2;
            const enemyPos = half - ratio * (half - HOME_EDGE);
            const playerPos = 100 - enemyPos;
            ui.combatDistancePlayerIcon.style.left = `${playerPos}%`;
            ui.combatDistanceEnemyIcon.style.left = `${enemyPos}%`;

            // La barre remplie relie directement les deux icônes : elle EST l'écart entre elles,
            // et non plus une simple jauge indépendante — leur mouvement et son étendue restent
            // ainsi toujours corrélés.
            const leftPos = Math.min(enemyPos, playerPos);
            const rightPos = Math.max(enemyPos, playerPos);
            ui.combatDistanceFill.style.left = `${leftPos}%`;
            ui.combatDistanceFill.style.width = `${rightPos - leftPos}%`;
            // Bleu si l'écart profite au joueur (mob de mêlée tenu à distance), rouge s'il le subit
            // (mob à distance qui tient sa portée sans qu'on puisse le rattraper), gris à écart nul.
            const playerBenefits = enemyIsMelee && distance > 0;
            const playerSuffers = !enemyIsMelee && distance > 0;
            ui.combatDistanceFill.classList.toggle('bg-cyan-600', playerBenefits);
            ui.combatDistanceFill.classList.toggle('bg-red-600', playerSuffers);
            ui.combatDistanceFill.classList.toggle('bg-gray-600', !playerBenefits && !playerSuffers);
        }
    } else {
        // Étage urbain : le tapotement de la carte n'a aucun effet (explore() se bloque déjà sur
        // gameState.floorMap === null), donc l'invite "Touchez la carte pour explorer" n'a plus lieu
        // d'être — la Carte Urbaine (liste de villes) la remplace comme mode de déplacement.
        ui.advanceHint.classList.toggle('hidden', gameState.bossChoicePending || gameState.stealthChoicePending || !!gameState.urbanMap);
        ui.combatZone.classList.add('hidden');
        ui.compactVitals.classList.remove('hidden'); // On réaffiche les PV compacts hors combat
        ui.cardStackWrapper.style.maxWidth = '240px'; // Retour à la taille normale hors combat
        updateCompanionUI(); // Réaffiche/actualise la barre compagnon compacte hors combat

        ui.combatSideEnemy.classList.add('hidden');
        ui.combatSideEnemy.classList.remove('flex', 'flex-col');
        ui.combatSidePlayer.classList.add('hidden');
        ui.combatSidePlayer.classList.remove('flex', 'flex-col');
    }

    // "Lieux connus" (donjon classique) et "Carte Urbaine" (étage urbain) sont mutuellement
    // exclusifs, comme floorMap/urbanMap eux-mêmes : un seul des deux panneaux est jamais pertinent
    // à la fois.
    if (ui.knownLocationsSection) ui.knownLocationsSection.classList.toggle('hidden', !!gameState.urbanMap);
    if (ui.urbanMapSection) ui.urbanMapSection.classList.toggle('hidden', !gameState.urbanMap);

    // Les distances affichées dans "Lieux connus" dépendent de la position actuelle : on les
    // rafraîchit à chaque rendu pour qu'elles restent toujours à jour sans action explicite.
    updateKnownLocationsUI();
    updateUrbanMapUI();

    // Autosauvegarde (no-op tant que gameState.saveEnabled est faux, voir confirmPlayerName() /
    // restoreSaveForName()) : updateUI() est déjà appelée après quasiment toute action modifiant
    // l'état, donc un seul point d'accroche suffit à couvrir toute la boucle de jeu.
    saveGame();
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

// Fonction pour ajouter un message : sur la carte active (fond clair) ET dans le journal complet (fond sombre).
// Pendant un combat, la carte n'affiche plus le flot de logs (trop de bruit visuel) : elle montre à
// la place un résumé fixe de l'ennemi (voir renderCombatMobPanel) et un bouton "Examiner". Le
// journal complet, lui, continue toujours de tout recevoir, combat ou non.
function logEvent(message, type = "normal") {
    if (!gameState.inCombat) {
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
    }

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
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    ui.inventoryCount.innerText = equipmentCount;
    ui.equippedWeapon.innerText = gameState.equipment.weapon ? formatItemDisplayName(gameState.equipment.weapon) : "Aucune";
    ui.equippedArmor.innerText = gameState.equipment.armor ? formatItemDisplayName(gameState.equipment.armor) : "Aucune";
    if (ui.equippedArmorBadges) {
        ui.equippedArmorBadges.innerHTML = gameState.equipment.armor
            ? buildMechanicBadgesHtml(gameState.equipment.armor, IMPLEMENTED_ARMOR_MECHANICS)
            : "";
    }
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
            // Badges d'enchantement : uniquement sur les armures (voir applyArmorMechanic()) — les
            // armes gardent leur affichage inchangé, leurs enchantements sont déjà tous fonctionnels.
            const armorBadges = !isWeapon && !isRanged ? buildMechanicBadgesHtml(item, IMPLEMENTED_ARMOR_MECHANICS) : "";
            card.innerHTML = `
                <div class="text-xl leading-none">${icon}</div>
                <div class="text-[10px] font-bold leading-tight">${item.name}</div>
                ${item.rarity ? `<div class="text-[8px] font-bold uppercase tracking-wider" style="color:${rarityColor}">${item.rarity}</div>` : ""}
                <div class="text-[9px] text-stone-600">${statLine}</div>
                ${armorBadges ? `<div class="flex gap-1 flex-wrap justify-center text-[8px]">${armorBadges}</div>` : ""}
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

// Grimoire : sort équipé + liste des parchemins en réserve (gameState.spellbook), chacun avec un
// bouton "Équiper" (voir equipSpell()). Même esprit que la partie équipement de updateInventoryUI(),
// mais sur un inventaire séparé, jamais limité (voir addLoot()).
function updateSpellbookUI() {
    if (ui.equippedSpell) {
        ui.equippedSpell.innerText = gameState.equipment.spell ? formatItemDisplayName(gameState.equipment.spell) : "Aucun";
    }
    if (!ui.spellbookCards) return;

    ui.spellbookCards.innerHTML = "";
    if (gameState.spellbook.length === 0) {
        const empty = document.createElement('p');
        empty.className = "col-span-2 text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun parchemin appris pour l'instant.";
        ui.spellbookCards.appendChild(empty);
        return;
    }

    gameState.spellbook.forEach((spell, i) => {
        const rarityColor = spell.rarityColor || "#57534e";
        const categoryLabel = spell.spellCategory === 'melee' ? "Corps à corps" : "À distance";
        const card = document.createElement('div');
        card.className = "mini-card rounded-lg p-2 flex flex-col gap-1 text-center relative";
        card.style.borderColor = rarityColor;
        card.style.borderWidth = "2px";
        card.innerHTML = `
            <div class="text-xl leading-none">${spell.icon || '✨'}</div>
            <div class="text-[10px] font-bold leading-tight">${spell.spellName}</div>
            ${spell.rarity ? `<div class="text-[8px] font-bold uppercase tracking-wider" style="color:${rarityColor}">${spell.rarity}</div>` : ""}
            <div class="text-[9px] text-stone-600">${categoryLabel} · ⚔️ +${spell.baseDmg} · 🔷 ${spell.manaCost}</div>
            <button data-action="equip" class="mt-1 text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>
        `;
        card.querySelector('[data-action="equip"]').addEventListener('click', () => equipSpell(i));
        ui.spellbookCards.appendChild(card);
    });
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
// Icônes/labels des mécaniques d'enchantement (voir itemModifiers.effect dans items.js). Reprend
// les mêmes émojis que les logs de combat (resolveWeaponMechanicEffect/resolveArmorMechanicEffect)
// pour rester cohérent visuellement.
const MECHANIC_ICONS = {
    bleed: '🩸', stun: '💫', poison: '☢️', slow: '🐌', light: '✨', heal: '💚',
    lifesteal: '🧛', drain: '🌀', corrode: '🧪', fear: '😱', adrenaline: '💉',
    stealth: '🤫', random: '🎲', aoe: '💥', darkness: '🌑', pleasure_or_pain: '😬'
};
const MECHANIC_LABELS = {
    bleed: 'Saignement', stun: 'Étourdissement', poison: 'Poison', slow: 'Ralentissement',
    light: 'Éblouissement', heal: 'Régénération', lifesteal: 'Vol de vie', drain: 'Drain',
    corrode: 'Corrosion', fear: 'Terreur', adrenaline: 'Adrénaline', stealth: 'Discrétion',
    random: 'Aléatoire', aoe: 'Explosion', darkness: 'Ténèbres', pleasure_or_pain: 'Vibration'
};

// Construit les badges d'enchantement d'un objet équipable : un par mécanique portée, coloré si
// elle a un effet de combat réel pour ce type d'objet (voir implementedList), grisé sinon (encore
// purement cosmétique — voir le commentaire de IMPLEMENTED_ARMOR_MECHANICS/IMPLEMENTED_WEAPON_MECHANICS).
// "stealth" (Silencieux) et "random" (Chaotique) sont toujours fonctionnels, quel que soit le type
// d'objet (détection pré-combat pour le premier, pioche parmi les mécaniques réelles pour le second).
function buildMechanicBadgesHtml(item, implementedList) {
    if (!item || !item.mechanics || item.mechanics.length === 0) return '';
    return item.mechanics.map(mechanic => {
        const icon = MECHANIC_ICONS[mechanic] || '❔';
        const label = MECHANIC_LABELS[mechanic] || mechanic;
        const isFunctional = mechanic === 'random' || mechanic === 'stealth' || implementedList.includes(mechanic);
        const cls = isFunctional
            ? 'bg-amber-100 border-amber-400 text-amber-800'
            : 'bg-stone-200 border-stone-400 text-stone-500 italic';
        const title = isFunctional ? label : `${label} (cosmétique pour l'instant)`;
        return `<span class="px-1 py-0.5 rounded border ${cls}" title="${title}">${icon} ${label}</span>`;
    }).join('');
}

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

// Équipe un sort depuis le grimoire (gameState.spellbook). Même principe que equipItem() : l'éventuel
// sort déjà équipé retourne dans le grimoire (jamais de perte). La toute première fois qu'un sort est
// équipé, la barre de mana apparaît pleine (comme les PV au niveau 1) — les équipements suivants ne
// la réinitialisent pas.
function equipSpell(index) {
    const spell = gameState.spellbook[index];
    if (!spell) return;

    const previouslyEquipped = gameState.equipment.spell;
    gameState.equipment.spell = spell;
    gameState.spellbook.splice(index, 1);
    if (previouslyEquipped) {
        gameState.spellbook.push(previouslyEquipped);
    } else {
        gameState.mana = gameState.maxMana;
    }

    logEvent(`Vous équipez le sort [${formatItemDisplayName(spell)}].`, "info");
    updateUI();
    updateSpellbookUI();
}

// Consomme un objet de type consommable : soigne et/ou restaure du mana, puis disparaît de
// l'inventaire. `mana` (voir items.js) n'a d'effet visible que si un sort est équipé, exactement
// comme la barre de mana elle-même — mais reste consommé normalement dans le cas contraire.
function useConsumable(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const healAmount = item.heal || 0;
    const manaAmount = item.mana || 0;
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
    gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaAmount);
    const parts = [];
    if (healAmount > 0) parts.push(`${healAmount} PV`);
    if (manaAmount > 0) parts.push(`${manaAmount} Mana`);
    logEvent(`Vous consommez [${item.name}]${parts.length ? ` et récupérez ${parts.join(" et ")}` : ""}.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================

// Régénération passive de PV et de mana, proportionnelle au temps qui s'écoule en explorant ou en
// voyageant vers un lieu connu (voir performExploreStep()/travelToKnownLocation()/
// autoTravelToNearestFrontier()) — jamais sur une perte de temps punitive (piège "Contretemps"),
// pour ne pas annuler la sanction. Taux fixe et prévisible, contrairement à l'ancien système basé sur
// le tirage de la carte 🌑 Silence (beaucoup plus lent et aléatoire). Le mana ne régénère que si un
// sort est équipé (sinon la barre n'existe pas côté joueur).
const HP_REGEN_PER_HOUR = 10;
const MANA_REGEN_PER_HOUR = 25;

function applyTimeElapsedRegen(hours) {
    if (!hours || hours <= 0) return;
    if (gameState.hp < gameState.maxHp) {
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + HP_REGEN_PER_HOUR * hours);
    }
    if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + MANA_REGEN_PER_HOUR * hours);
    }
}

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
        // L'en-tête de la carte (icône/nom/type) est posé par initiateCombat() lui-même.
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
        // L'en-tête de la carte (icône/nom/type) est posé par initiateCombat() lui-même.
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

    // L'en-tête de la carte (icône/nom/type) est posé par initiateCombat() lui-même.
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
    applyTimeElapsedRegen(timeCost);
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
// Raisons piochées au hasard quand le compagnon abandonne l'équipe (voir attemptCompanionAbandon()) :
// registre volontairement absurde/thématique, cohérent avec le reste du bestiaire et des objets.
const COMPANION_ABANDON_REASONS = [
    "en a assez de porter votre équipement de rechange",
    "a reçu une meilleure offre d'un autre groupe de crawlers",
    "prétexte une urgence familiale suspicieusement pratique",
    "estime que le partage du butin n'était pas équitable",
    "a soudainement une peur panique des escaliers",
    "part sans un mot, en emportant discrètement un souvenir",
    "a atteint sa limite de stress hebdomadaire, syndicat oblige",
    "ne supporte plus votre façon de négocier avec les distributeurs automatiques",
    "déclare que ce donjon ne correspond plus à ses valeurs",
    "s'est simplement perdu(e) en cherchant les toilettes, et n'est jamais revenu(e)"
];

// Tente de faire abandonner le compagnon actif : un jet contre companion.leaveChance décide s'il
// part maintenant. Contrairement à l'ancien système (seuil dur à 100% -> combat forcé), c'est une
// probabilité pure, vérifiée à chaque montée de niveau du compagnon (voir gainCompanionXp()) : le
// départ peut donc survenir bien avant que leaveChance n'atteigne 100%, ou au contraire tarder,
// selon la chance. Un départ est toujours PACIFIQUE (aucun combat) : contrairement à une rencontre
// hostile initiale (voir ui.companionChoiceHostile, un cas totalement séparé), le compagnon s'en
// va simplement, avec une raison piochée au hasard. Retourne true s'il est effectivement parti.
function attemptCompanionAbandon() {
    const companion = gameState.companion;
    if (!companion) return false;
    if (Math.random() * 100 >= companion.leaveChance) return false;

    const reason = COMPANION_ABANDON_REASONS[Math.floor(Math.random() * COMPANION_ABANDON_REASONS.length)];
    logEvent(`${companion.name} quitte l'équipe : ${reason}.`, "danger");
    gameState.companion = null;
    updateCompanionUI();
    return true;
}

// Gain d'XP du compagnon (accordé après chaque victoire du joueur tant qu'il est actif).
// Sa progression fait grimper la probabilité qu'il abandonne l'équipe (voir attemptCompanionAbandon(),
// vérifiée à chaque montée de niveau).
function gainCompanionXp(amount) {
    const companion = gameState.companion;
    if (!companion || !amount) return;

    companion.xp += amount;
    while (companion.xp >= companion.xpToNext) {
        companion.xp -= companion.xpToNext;
        companion.level += 1;
        companion.xpToNext = Math.round(companion.xpToNext * 1.3);

        const increment = 15 + Math.floor(Math.random() * 11); // +15 à +25 par niveau
        companion.leaveChance = Math.min(100, companion.leaveChance + increment);

        logEvent(`${companion.name} gagne en expérience (niveau ${companion.level}).`, "info");
        if (companion.leaveChance >= 70) {
            logEvent(`${companion.name} semble de moins en moins investi(e) dans l'aventure... (${companion.leaveChance}% de risque de départ)`, "danger");
        }

        // Jet d'abandon immédiatement après la montée de niveau : s'il part, inutile de continuer
        // à faire monter les niveaux suivants dans cette même boucle (companion.xp restant est
        // simplement perdu avec lui, comme le reste de son état).
        if (attemptCompanionAbandon()) return;
    }
    updateCompanionUI();
}

// Reconstruit l'affichage compact du compagnon (hors combat) : nom, spécialité, barre de risque de départ
function updateCompanionUI() {
    const companion = gameState.companion;
    if (!companion) {
        ui.companionStatusBar.classList.add('hidden');
        return;
    }
    ui.companionStatusBar.classList.remove('hidden');
    ui.companionNameDisplay.innerText = companion.name;
    ui.companionSpecialtyDisplay.innerText = `(${companion.specialty.label})`;

    const leavePct = companion.leaveChance / 100;
    ui.companionLeaveBar.style.width = `${companion.leaveChance}%`;
    ui.companionLeaveBar.style.background = hpColor(1 - leavePct); // Vert = fidèle, rouge = risque de départ élevé
}

function nextFloor() {
    gameState.currentFloor += 1;
    gameState.cardsDrawnThisFloor = 0;
    gameState.timeLeft = gameState.maxTime; // Réinitialisation du temps
    gameState.knownLocations = []; // Les lieux repérés à l'étage précédent ne sont plus accessibles
    gameState.floorMap = null;
    gameState.urbanMap = null;
    // Multiple de 3 (voir config.urbanFloors) : étage urbain (réseau villes/routes) plutôt que le
    // donjon classique à 4 quartiers.
    if (gameState.currentFloor % 3 === 0) {
        generateUrbanFloorMap();
    } else {
        generateFloorMap(); // Nouvelle zone circulaire à 4 quartiers pour ce nouvel étage
    }
    logEvent(`--- DÉBUT DE L'ÉTAGE ${gameState.currentFloor} ---`, "info");
    updateKnownLocationsUI();
    updateUrbanMapUI();
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

// Ajoute un objet généré à l'inventaire. Les consommables ne sont jamais limités (slots dédiés
// infinis) ; seuls les objets d'équipement (armes/armures/armes à distance) comptent dans la
// capacité limitée (gameState.maxInventory). Un parchemin de sort (catégorie 'scrolls') rejoint
// gameState.spellbook (inventaire magique dédié) plutôt que gameState.inventory : lui non plus
// n'est jamais limité, au même titre que les consommables (voir equipSpell()).
function addLoot(powerScore = 0) {
    const item = generateItem(powerScore);
    if (item.category === 'scrolls') {
        gameState.spellbook.push(item);
        logEvent(`Sort appris : [${formatItemDisplayName(item)}] !`, "loot");
        updateSpellbookUI();
        return;
    }
    const isConsumable = item.category === 'consumables';
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    if (isConsumable || equipmentCount < gameState.maxInventory) {
        gameState.inventory.push(item);
        logEvent(`Objet obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
    } else {
        logEvent("Vous trouvez un objet, mais votre réserve d'équipement est pleine !", "danger");
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

    // Salle(s) sécurisée(s) parmi les pièces restantes : 1 à 2 par quartier (jamais 0, pour garantir
    // un vrai point de répit sur chaque quartier).
    const safeCandidates = roomIds.filter(id => id !== entryId && id !== bossId);
    for (let i = safeCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [safeCandidates[i], safeCandidates[j]] = [safeCandidates[j], safeCandidates[i]];
    }
    const safeCount = Math.min(safeCandidates.length, Math.random() < 0.5 ? 2 : 1);
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

// ==========================================
// ÉTAGES URBAINS (multiples de 3 — voir config.urbanFloors)
// ==========================================
// Noms de villes génériques (pas de flavor par ville, contrairement aux quartiers) : piochés sans
// répétition à chaque génération d'étage urbain.
const URBAN_CITY_NAMES = [
    "Vieille Ville", "Quartier Nord", "Quartier Sud", "Zone Industrielle", "Cité-Dortoir",
    "Centre Commercial Abandonné", "Faubourg", "Le Ghetto", "Quartier des Affaires",
    "Banlieue Résidentielle", "Port Fluvial", "Terminus"
];

// Ajoute une route bidirectionnelle entre deux villes (aucun doublon), avec une distance 1-4 —
// même échelle que le coût de trajet des lieux connus classiques (voir travelToKnownLocation()).
function addCityRoad(citiesById, aId, bId) {
    if (aId === bId || citiesById[aId].roads.some(r => r.to === bId)) return;
    const distance = 1 + Math.floor(Math.random() * 4);
    citiesById[aId].roads.push({ to: bId, distance });
    citiesById[bId].roads.push({ to: aId, distance });
}

// Révèle (known = true) les villes directement reliées à celle donnée — découverte progressive du
// réseau au fil des trajets, pas de brouillard de guerre sur les routes elles-mêmes (seulement sur
// quelles villes existent encore au-delà de la frontière déjà atteinte).
function revealCityNeighbors(citiesById, cityId) {
    citiesById[cityId].roads.forEach(road => {
        citiesById[road.to].known = true;
    });
}

// Génère le réseau villes/routes d'un étage urbain : arbre couvrant aléatoire (garantit la
// connexité) puis quelques routes de bouclage supplémentaires, comme generateQuadrant() le fait déjà
// pour les couloirs d'un quartier classique. Une ville (autre que celle de départ) porte l'escalier
// — ou la Sortie à l'étage final (config.urbanFloors.finalFloor) — potentiellement gardée par un
// boss du thème unique de l'étage.
function generateUrbanFloorMap() {
    const floor = gameState.currentFloor;
    const isFinal = floor === config.urbanFloors.finalFloor;
    const theme = config.urbanFloors.themes[floor] || config.urbanFloors.themes[3];

    const cityCount = 6 + Math.floor(floor / 9); // Légère croissance avec la profondeur
    const namePool = [...URBAN_CITY_NAMES];
    const citiesById = {};
    const cityIds = [];
    for (let i = 0; i < cityCount; i++) {
        const id = `city-${i}`;
        const nameIndex = Math.floor(Math.random() * namePool.length);
        const name = namePool.splice(nameIndex, 1)[0] || `Secteur ${i + 1}`;
        citiesById[id] = {
            id, name, visited: false, known: false, roads: [],
            isStairs: false, isExit: false, guarded: false, bossInstance: null, defeated: false
        };
        cityIds.push(id);
    }

    // Arbre couvrant aléatoire
    const connectedIds = [cityIds[0]];
    const remainingIds = cityIds.slice(1);
    while (remainingIds.length > 0) {
        const fromId = connectedIds[Math.floor(Math.random() * connectedIds.length)];
        const toId = remainingIds.splice(Math.floor(Math.random() * remainingIds.length), 1)[0];
        addCityRoad(citiesById, fromId, toId);
        connectedIds.push(toId);
    }
    // Quelques routes de bouclage, pour offrir plusieurs itinéraires possibles
    const extraRoads = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < extraRoads; i++) {
        const a = cityIds[Math.floor(Math.random() * cityIds.length)];
        const b = cityIds[Math.floor(Math.random() * cityIds.length)];
        addCityRoad(citiesById, a, b);
    }

    // Ville de départ : toujours connue et déjà visitée
    const startId = cityIds[0];
    citiesById[startId].visited = true;
    citiesById[startId].known = true;
    revealCityNeighbors(citiesById, startId);

    // Ville de l'escalier (ou de la Sortie à l'étage final), tirée parmi les autres
    const candidateIds = cityIds.filter(id => id !== startId);
    const target = citiesById[candidateIds[Math.floor(Math.random() * candidateIds.length)]];
    if (isFinal) {
        target.isExit = true;
        target.guarded = true; // Toujours gardée : dernier obstacle avant la victoire
    } else {
        target.isStairs = true;
        const guardChance = config.urbanFloors.stairsGuardChanceByFloor[floor] || 50;
        target.guarded = Math.random() * 100 < guardChance;
    }

    gameState.urbanMap = { theme, isFinalFloor: isFinal, citiesById, currentCityId: startId };
    // Thématique unique de l'étage : generateMob()/generateBoss() la reçoivent comme un nom de
    // quartier classique, sans aucune adaptation nécessaire de leur côté.
    gameState.currentDistrict = theme;
}

// Distance pondérée (Dijkstra) entre deux villes du réseau urbain courant — même principe que
// computeDistance() pour le graphe de pièces d'un étage classique, mais sur gameState.urbanMap.
function computeCityDistance(fromCityId, toCityId) {
    if (fromCityId === toCityId) return 0;
    const citiesById = gameState.urbanMap.citiesById;
    const dist = { [fromCityId]: 0 };
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
        if (currentId === toCityId) return currentCost;

        visited.add(currentId);
        const city = citiesById[currentId];
        if (!city) continue;
        city.roads.forEach(road => {
            const newCost = currentCost + road.distance;
            if (dist[road.to] === undefined || newCost < dist[road.to]) {
                dist[road.to] = newCost;
            }
        });
    }
    return null;
}

// Voyage vers une ville connue du réseau urbain — calqué sur travelToKnownLocation() (coût en
// temps + embuscades proportionnels à la distance réelle), mais entre villes plutôt que vers un
// lieu connu de donjon classique. Les embuscades utilisent le thème unique de l'étage sans aucune
// adaptation (gameState.currentDistrict y est déjà aligné par generateUrbanFloorMap()).
function travelToCity(cityId) {
    if (isActionBlocked()) return;
    const urbanMap = gameState.urbanMap;
    if (!urbanMap) return;
    const city = urbanMap.citiesById[cityId];
    if (!city || !city.known || cityId === urbanMap.currentCityId) return;

    const distance = computeCityDistance(urbanMap.currentCityId, cityId);
    if (distance === null || distance === undefined) {
        logEvent("Cette ville semble hors d'atteinte pour l'instant...", "danger");
        return;
    }

    const timeCost = Math.max(1, Math.round(distance / 2));
    const ambushBaseChance = Math.min(80, distance * 9);
    let ambushCount = 0;
    if (Math.random() * 100 < ambushBaseChance) {
        ambushCount = 1;
        if (Math.random() * 100 < ambushBaseChance * 0.6) ambushCount = 2;
    }

    gameState.timeLeft = Math.max(0, gameState.timeLeft - timeCost);
    applyTimeElapsedRegen(timeCost);
    gameState.pendingUrbanTravel = { destinationCityId: cityId, ambushesRemaining: ambushCount };
    logEvent(`Vous prenez la route vers : ${city.name} (${distance}, -${timeCost}H)...`, "info");
    if (ambushCount > 0) {
        logEvent("La route ne s'annonce pas de tout repos...", "danger");
    }

    if (gameState.timeLeft <= 0) {
        gameOver(true);
        return;
    }
    triggerNextCityAmbushOrArrive();
}

// Résout la prochaine embuscade du trajet urbain en cours, ou l'arrivée si le trajet est terminé —
// symétrique de triggerNextAmbushOrArrive() pour les routes entre villes.
function triggerNextCityAmbushOrArrive() {
    const travel = gameState.pendingUrbanTravel;
    if (!travel) return;

    if (travel.ambushesRemaining > 0) {
        travel.ambushesRemaining -= 1;
        logEvent("Une présence hostile vous barre la route !", "danger");
        gameState.pendingUrbanAdvanceAfterCombat = null; // Ce n'est pas encore l'arrivée
        initiateCombat(); // Mob générique du thème d'étage (gameState.currentDistrict)
        return;
    }

    arriveAtCity();
}

// Arrivée effective dans une ville : marque la visite, révèle ses routes sortantes, puis résout
// l'éventuel gardien (escalier ou Sortie) — sinon simple arrivée sûre (aucun tirage D100, contrairement
// à une pièce normale de donjon : "les villes sont sûres").
function arriveAtCity() {
    const travel = gameState.pendingUrbanTravel;
    if (!travel) return;
    const urbanMap = gameState.urbanMap;
    gameState.pendingUrbanTravel = null;
    const city = urbanMap.citiesById[travel.destinationCityId];
    if (!city) return;

    urbanMap.currentCityId = city.id;
    const firstVisit = !city.visited;
    city.visited = true;
    city.known = true;
    revealCityNeighbors(urbanMap.citiesById, city.id);

    if ((city.isStairs || city.isExit) && city.guarded && !city.defeated) {
        triggerUrbanBossEncounter(city);
        return;
    }
    if ((city.isStairs || city.isExit) && (!city.guarded || city.defeated)) {
        logEvent(`Vous atteignez ${city.name}.`, "info");
        if (city.isExit) {
            winGame();
        } else {
            logEvent("La voie est libre !", "success");
            nextFloor();
        }
        return;
    }

    setCardHeader('🏙️', city.name, 'Ville sûre');
    logEvent(
        firstVisit
            ? `Vous découvrez ${city.name}. Les rues sont calmes ici — vous pouvez souffler.`
            : `Vous retrouvez ${city.name}, toujours aussi tranquille.`,
        "success"
    );
    updateUrbanMapUI();
    updateUI();
}

// Présente le choix "combattre maintenant / repérer et partir" pour la ville gardant l'escalier (ou
// la Sortie, à l'étage final) — même esprit que triggerBossEncounter(), partage le même bloc UI
// (#boss-choice-zone), mais dispatché séparément : les données sous-jacentes (villes) ne sont pas
// des pièces de donjon (voir fightBossNow()/retreatFromBoss() pour le dispatch).
function triggerUrbanBossEncounter(city) {
    if (!city.bossInstance) {
        city.bossInstance = generateBoss(gameState.urbanMap.theme) || generateMob(gameState.urbanMap.theme);
    }
    const boss = city.bossInstance;
    gameState.pendingUrbanBossEncounter = { cityId: city.id, isExit: city.isExit === true };
    gameState.bossChoicePending = true;

    setCardHeader('👑', boss.name, city.isExit ? "Gardien de la Sortie" : "Gardien de l'Escalier");
    logEvent(
        city.isExit
            ? `🎬 Vous atteignez la Sortie... gardée par ${boss.name} !`
            : `🎬 Vous découvrez l'escalier vers l'étage ${gameState.currentFloor + 1}, gardé par ${boss.name} !`,
        "danger"
    );
    logEvent("Le combattre maintenant, ou repérer l'endroit pour y revenir plus tard ?", "info");
    ui.bossChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Combattre" pour un gardien urbain (dispatché depuis fightBossNow())
function fightUrbanBossNow() {
    const encounter = gameState.pendingUrbanBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingUrbanBossEncounter = null;
    if (!encounter) return;

    const city = gameState.urbanMap.citiesById[encounter.cityId];
    gameState.pendingUrbanAdvanceAfterCombat = encounter.isExit ? 'win' : 'nextFloor';
    gameState.pendingUrbanBossCityId = encounter.cityId;
    initiateCombat(city.bossInstance);
}

// Bouton "Repérer et partir" pour un gardien urbain (dispatché depuis retreatFromBoss()) : la ville
// reste connue et visitée, donc re-sélectionnable à tout moment depuis la Carte Urbaine — aucun
// registre "lieux connus" séparé n'est nécessaire, contrairement au donjon classique.
function retreatFromUrbanBoss() {
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingUrbanBossEncounter = null;
    logEvent("Vous repérez soigneusement l'endroit et repartez explorer.", "info");
    updateUrbanMapUI();
    updateUI();
}

// Reconstruit le panneau "Carte Urbaine" : liste des villes connues, avec leur statut (ici / gardée /
// escalier / Sortie) et un bouton pour s'y rendre — même esprit que updateKnownLocationsUI(), mais
// pour le réseau villes/routes plutôt que les lieux connus classiques d'un donjon.
function updateUrbanMapUI() {
    if (!ui.urbanMapContainer) return;
    const urbanMap = gameState.urbanMap;
    ui.urbanMapContainer.innerHTML = "";
    if (!urbanMap) return;

    const known = Object.values(urbanMap.citiesById).filter(c => c.known);
    known.forEach(city => {
        const isCurrent = city.id === urbanMap.currentCityId;
        const distance = isCurrent ? 0 : computeCityDistance(urbanMap.currentCityId, city.id);

        let icon = '🏙️';
        let tag = '';
        if (city.isExit) {
            icon = '🚪';
            tag = city.defeated ? ' · Sortie libre' : (city.guarded ? ' · Sortie gardée' : ' · Sortie');
        } else if (city.isStairs) {
            icon = '🪜';
            tag = city.defeated ? ' · Escalier libre' : (city.guarded ? ' · Escalier gardé' : ' · Escalier');
        }

        const row = document.createElement('button');
        row.className = "w-full flex justify-between items-center px-3 py-2 bg-gray-950 border border-gray-800 rounded text-xs text-gray-300 hover:border-blue-600 hover:bg-blue-950/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-800 disabled:hover:bg-gray-950";
        const distLabel = (!isCurrent && distance !== null && distance !== undefined) ? ` (${distance})` : "";
        row.innerHTML = `<span>${icon} ${city.name}${tag}${isCurrent ? ' · Ici' : distLabel}</span><span class="text-blue-400 uppercase tracking-widest text-[10px]">${isCurrent ? '' : 'Aller →'}</span>`;
        if (isCurrent) {
            row.disabled = true;
        } else {
            row.addEventListener('click', () => travelToCity(city.id));
        }
        ui.urbanMapContainer.appendChild(row);
    });
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

// Bouton "Combattre" de la zone de choix de boss — dispatche vers l'équivalent urbain
// (fightUrbanBossNow()) si le gardien en attente vient d'un étage urbain plutôt que d'un donjon
// classique (voir triggerUrbanBossEncounter()), sinon comportement inchangé.
function fightBossNow() {
    if (gameState.pendingUrbanBossEncounter) {
        fightUrbanBossNow();
        return;
    }
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
// connu, sans y descendre/combattre. Dispatche vers retreatFromUrbanBoss() sur un étage urbain.
function retreatFromBoss() {
    if (gameState.pendingUrbanBossEncounter) {
        retreatFromUrbanBoss();
        return;
    }
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

// Icônes associées à chaque effet élémentaire/mental de mobModifiers (voir bestiary.js), pour le
// panneau compact affiché sur la carte pendant un combat.
const EFFECT_ICONS = {
    burn: '🔥', poison: '☠️', slow: '🐌', stun: '⚡', fear: '😱',
    confusion: '🌀', pull: '🧲', light: '✨', corrode: '🧪'
};
const EFFECT_LABELS = {
    burn: 'Brûlure', poison: 'Poison', slow: 'Ralentissement', stun: 'Étourdissement', fear: 'Peur',
    confusion: 'Confusion', pull: 'Attraction', light: 'Aveuglement', corrode: 'Corrosion'
};

let mobExamineOpen = false; // État transitoire du bouton "Examiner" (pas de sauvegarde nécessaire)

// Construit le panneau compact affiché sur la carte pendant un combat : plus aucun texte de log
// n'y défile (voir logEvent) — seulement des icônes/chiffres résumant l'ennemi, plus un bouton
// "Examiner" qui déplie les détails textuels (description des modificateurs, effet) à la demande.
function renderCombatMobPanel() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return;
    mobExamineOpen = false;

    const rangeIcon = enemy.ranged ? '🏹' : '🗡️';
    const rangeLabel = enemy.ranged ? 'DIST' : 'CAC';
    const modifiers = enemy.modifiersApplied || [];
    const eliteChip = isEliteMob(enemy)
        ? `<span class="px-1.5 py-0.5 rounded bg-stone-900 border border-red-600 text-red-500">💀 DANGEREUX</span>`
        : '';
    const effectChip = enemy.effect
        ? `<span class="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-400 text-purple-800">${EFFECT_ICONS[enemy.effect] || '❔'} ${EFFECT_LABELS[enemy.effect] || enemy.effect}</span>`
        : '';
    const modifierChips = modifiers.map(m => `<span class="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-400 text-stone-700">🏷️ ${m.name}</span>`).join('');

    ui.cardBody.innerHTML = `
        <div class="flex flex-wrap justify-center gap-1 text-[10px] font-bold">
            ${eliteChip}
            <span class="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-400 text-stone-700">${rangeIcon} ${rangeLabel}</span>
            <span class="px-1.5 py-0.5 rounded bg-red-100 border border-red-400 text-red-700">⚔️ +${enemy.atk}</span>
            <span class="px-1.5 py-0.5 rounded bg-blue-100 border border-blue-400 text-blue-700">🛡️ +${enemy.def}</span>
            ${effectChip}
            ${modifierChips}
        </div>
        <button id="btn-examine-mob" class="mt-2 w-full text-[10px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">🔍 Examiner</button>
        <div id="mob-examine-details" class="hidden mt-2 text-[10px] leading-snug text-stone-600 italic space-y-1"></div>
    `;

    const btn = document.getElementById('btn-examine-mob');
    const details = document.getElementById('mob-examine-details');
    if (btn && details) {
        btn.addEventListener('click', () => {
            mobExamineOpen = !mobExamineOpen;
            if (mobExamineOpen) {
                const lines = [`${enemy.name} — PV ${Math.round(enemy.hp)}/${enemy.maxHp || enemy.hp}, ATQ ${enemy.atk}, DEF ${enemy.def}, ${enemy.ranged ? 'combat à distance' : 'combat au corps à corps'}.`];
                modifiers.forEach(m => { if (m.desc) lines.push(`${m.name} : ${m.desc}`); });
                if (enemy.effect) lines.push(`Pouvoir : ${EFFECT_LABELS[enemy.effect] || enemy.effect}.`);
                details.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
                details.classList.remove('hidden');
                btn.innerText = '🔼 Masquer';
            } else {
                details.classList.add('hidden');
                btn.innerText = '🔍 Examiner';
            }
        });
    }
}

function initiateCombat(forcedEnemy = null) {
    const enemy = forcedEnemy || generateMob(gameState.currentDistrict);
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;

    // En-tête de la carte : toujours posé ici, quel que soit le chemin d'entrée en combat (embuscade
    // de trajet, compagnon qui se retourne contre vous, rencontre furtive ratée...). Avant ce correctif,
    // seuls certains appelants posaient leur propre en-tête ; les autres laissaient celui de la carte
    // PRÉCÉDENTE affiché (ex: "Silence") pendant que le corps de la carte basculait déjà sur le panneau
    // du mob (renderCombatMobPanel) — les deux se retrouvaient superposés au premier tour. Les combats
    // de boss gardent leur en-tête dédié, plus riche ("Gardien de l'Escalier"/"Boss de Quartier"), déjà
    // posé par triggerBossEncounter() juste avant.
    if (enemy && !enemy.isBoss) {
        setCardHeader(isEliteMob(enemy) ? '💀' : '⚔️', enemy.name, 'Danger');
    } else if (!enemy) {
        setCardHeader('⚔️', 'Combat', 'Danger');
    }

    // Statuts remis à zéro à chaque nouveau combat (des deux côtés)
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null };
    if (enemy) {
        enemy.status = { bleed: null, stunned: false, slowed: null, blinded: null, corroded: null, feared: null };
        enemy.maxHp = enemy.hp; // Référence pour l'anneau de vie (pourcentage de PV restants)
    }

    // Distance de combat initiale : dépend uniquement de la nature du mob (aucune notion de
    // posture côté joueur). Un mob de mêlée démarre au contact ; un mob à distance démarre à
    // l'écart de départ, que le joueur devra combler (S'approcher) ou maintenir (S'éloigner).
    gameState.combatDistance = (enemy && mobWantsFar(enemy)) ? config.rangedCombat.initialDistance : 0;

    // Les dés de dégâts repartent à zéro visuellement (aucune action encore jouée ce combat)
    ui.combatPlayerDie.innerText = "–";
    ui.combatPlayerDie.classList.remove('die-pop');
    ui.combatEnemyDie.innerText = "–";
    ui.combatEnemyDie.classList.remove('die-pop');

    if (enemy && enemy.isBoss) {
        logEvent("--- 👑 COMBAT DE BOSS ---", "danger");
        logEvent(`${enemy.name} se dresse devant vous ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else if (enemy && isEliteMob(enemy)) {
        logEvent("--- 💀 RENCONTRE DANGEREUSE ---", "danger");
        logEvent(`[${enemy.name}] apparaît, visiblement bien plus coriace que la normale ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
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
    renderCombatMobPanel();
    updateUI();
}

// ==========================================
// COMBAT À DISTANCE : DISTANCE, CONTEXTE
// ==========================================
// Aucune notion de posture côté joueur : seule la nature du mob compte (mob.ranged, fixe pour tout
// le combat). L'écart de départ dépend uniquement d'elle (voir initiateCombat()) ; ensuite, il
// n'évolue plus que via les actions dédiées du joueur — S'approcher (attemptSprint, réduit l'écart)
// et S'éloigner (attemptRetreat, l'augmente) — toujours disponibles, chacune opposant un jet du
// joueur (avantagé) à un jet du mob, quel que soit son type. Les attaques (Arme/Tir/Mains nues)
// sont de simples dégâts, strictement gated par l'écart courant : plus aucune manche de distance
// ne se glisse dans une attaque.

function mobWantsFar(enemy) {
    return !!(enemy && enemy.ranged);
}

// Contexte de portée courant, symétrique dans les deux sens :
//   - playerAdvantaged : un mob de mêlée tenu à distance (écart > 0) ne peut pas toucher le joueur.
//   - mobNeedsDistance : un mob à distance collé au corps à corps (écart == 0) ne peut PAS non plus
//     tirer directement — il doit d'abord reculer pour reprendre ses distances (symétrique du
//     joueur, qui doit s'éloigner pour utiliser Tir). Avant ce garde-fou, un mob "à distance" tirait
//     sans condition, même au contact.
function getCombatRangeContext() {
    const enemy = gameState.currentEnemy;
    const distance = gameState.combatDistance || 0;
    const playerAdvantaged = !!enemy && !mobWantsFar(enemy) && distance > 0;
    const mobNeedsDistance = !!enemy && mobWantsFar(enemy) && distance <= 0;
    return { distance, playerAdvantaged, mobNeedsDistance };
}

// Riposte "sécurisée" : bloque la riposte, sans rien faire d'autre ce tour-ci, si le mob ne peut
// actuellement pas toucher le joueur (mob de mêlée hors de portée, ou mob à distance collé au corps
// à corps). Réservée aux actions qui résolvent DÉJÀ elles-mêmes une manche de distance ce tour
// (Sprint, Reculer) : ajouter une tentative de repositionnement par-dessus doublerait leur propre
// jet. Pour tout le reste (voir resolveEnemyReaction), la riposte bloquée doit plutôt laisser le mob
// tenter de se repositionner, sans quoi il resterait figé indéfiniment.
function safeEnemyCounterAttack() {
    const enemy = gameState.currentEnemy;
    if (!enemy) { enemyCounterAttack(); return; }
    const ctx = getCombatRangeContext();
    if (ctx.playerAdvantaged) {
        logEvent(`Trop loin : [${enemy.name}] ne peut pas riposter.`, "info");
        return;
    }
    if (ctx.mobNeedsDistance) {
        logEvent(`Trop près : [${enemy.name}] ne peut pas tirer au corps à corps.`, "info");
        return;
    }
    enemyCounterAttack();
}

// Réaction par défaut du mob à la fin d'un tour du joueur (attaque, Magie, étourdissement, fuite
// ratée...). Un mob hors d'état de frapper immédiatement (mêlée hors de portée, ou à distance collé
// au contact) ne reste pas pour autant totalement figé : il tente de se repositionner (même
// mécanique que resolveDistanceRound), et frappe immédiatement s'il y parvient.
function resolveEnemyReaction() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return;
    const ctx = getCombatRangeContext();

    if (ctx.playerAdvantaged) {
        resolveDistanceRound(enemy, true); // rafraîchit déjà l'UI via setCombatDistance()
        if (gameState.combatDistance > 0) {
            logEvent(`[${enemy.name}] tente de combler l'écart, mais reste hors de portée pour l'instant.`, "info");
        } else {
            logEvent(`[${enemy.name}] parvient à combler l'écart !`, "danger");
            enemyCounterAttack();
        }
        return;
    }

    if (ctx.mobNeedsDistance) {
        resolveDistanceRound(enemy, false); // le joueur veut RÉDUIRE l'écart (le coller) ce round-ci
        if (gameState.combatDistance > 0) {
            logEvent(`[${enemy.name}] recule pour reprendre ses distances et ouvre le feu !`, "danger");
            enemyCounterAttack();
        } else {
            logEvent(`[${enemy.name}] tente de reculer pour tirer, mais vous le collez au corps à corps.`, "info");
        }
        return;
    }

    enemyCounterAttack();
}

// Point de passage UNIQUE pour toute modification de l'écart de combat en cours de round (clampe
// et rafraîchit systématiquement la barre de distance). Avant ce correctif, plusieurs chemins
// modifiaient gameState.combatDistance directement sans jamais appeler updateUI() dans la foulée
// (recul réussi dont la riposte se retrouve bloquée par safeEnemyCounterAttack(), tir qui maintient
// l'écart sans provoquer de riposte...) : la barre restait figée sur l'ancien écart jusqu'à ce
// qu'une AUTRE action déclenche enfin un rendu. Particulièrement visible en duel long face à un
// boss de mêlée (seul cas où le cycle recul/tir dure assez longtemps pour que le décalage saute
// aux yeux). Les 3 assignations directes dans initiateCombat() restent volontairement en dehors :
// un updateUI() à ce stade rendrait un état transitoire (avant que renderCombatMobPanel() etc.
// n'aient fini d'installer la carte de combat) ; l'updateUI() déjà garanti en fin de fonction suffit.
function setCombatDistance(value) {
    gameState.combatDistance = Math.max(0, Math.min(config.rangedCombat.maxDistance, value));
    updateUI();
}

// Une "manche" de distance : le joueur et le monstre jettent chacun un dé (le joueur bénéficie
// d'un bonus lié à son niveau), et l'écart évolue selon qui l'emporte. `playerWantsToWiden`
// indique le sens favorable au joueur pour cette manche (true = il veut AUGMENTER l'écart, false =
// il veut le RÉDUIRE).
function resolveDistanceRound(enemy, playerWantsToWiden) {
    const cfg = config.rangedCombat;
    const playerRoll = 1 + Math.floor(Math.random() * cfg.dieSides) + Math.floor(gameState.level / cfg.levelAdvantageDivisor);
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll; // positif = le joueur l'emporte ce round
    const delta = playerWantsToWiden ? diff : -diff;
    setCombatDistance(gameState.combatDistance + delta);
    return { playerRoll, mobRoll, diff };
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
        // resolveEnemyReaction() gère la protection par distance : un mob de mêlée hors de portée
        // ne peut pas profiter de l'étourdissement, mais tente quand même de combler l'écart.
        resolveEnemyReaction();
        return false;
    }

    return true;
}

// Portion commune à toute attaque du joueur : applique les dégâts, vérifie la victoire, et laisse
// l'ennemi réagir s'il survit (resolveEnemyReaction() : riposte normale, ou tentative de
// rapprochement si un mob de mêlée est hors de portée — voir getCombatRangeContext()).
function performPlayerAttack(attackerAtk, options, label) {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    const enemy = gameState.currentEnemy;

    // Un joueur confus a une chance de rater complètement son attaque (aucun dégât, tour perdu)
    if (gameState.status.confused && gameState.status.confused.rounds > 0) {
        gameState.status.confused.rounds -= 1;
        if (gameState.status.confused.rounds <= 0) gameState.status.confused = null;
        if (Math.random() * 100 < 45) {
            showDie(ui.combatPlayerDie, "❓");
            logEvent(`Désorienté, vous frappez complètement à côté de [${enemy.name}] !`, "danger");
            resolveEnemyReaction();
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

    resolveEnemyReaction();
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

// Mécaniques d'armure qui ont un vrai effet de combat, symétrique de IMPLEMENTED_WEAPON_MECHANICS.
// Avant ceci, un enchantement roulé sur une armure (autre que "Silencieux") ne servait à RIEN :
// seule l'arme équipée déclenchait applyWeaponMechanic(). Une armure Légendaire pouvait donc
// gâcher 2-3 de ses slots. Chaque mécanique retombe désormais sur l'ATTAQUANT (saignement,
// étourdissement, poison, ralentissement, éblouissement, drain, corrosion, terreur — une punition
// réactive) ou soigne/galvanise le PORTEUR (Régénérant, Vampirique, Galvanisant).
const IMPLEMENTED_ARMOR_MECHANICS = ['bleed', 'stun', 'poison', 'slow', 'light', 'heal', 'lifesteal', 'drain', 'corrode', 'fear', 'adrenaline'];

// Résout l'effet concret d'une mécanique d'armure sur l'attaquant (ou le porteur pour heal/lifesteal/
// adrenaline). Séparé de applyArmorMechanic() pour que "random" (Chaotique) puisse réutiliser cette
// logique après avoir tiré une mécanique au hasard, sans dupliquer le switch (voir resolveWeaponMechanicEffect,
// son équivalent côté arme).
function resolveArmorMechanicEffect(mechanicName, armor, attacker, incomingDamage) {
    switch (mechanicName) {
        case 'bleed':
            attacker.status.bleed = { rounds: 3, dmgPerRound: Math.max(2, Math.round((armor.baseArmor || 5) * 0.3)) };
            logEvent(`🩸 Les pointes de votre armure entaillent [${attacker.name}] !`, "danger");
            break;
        case 'stun':
            attacker.status.stunned = true;
            logEvent(`💫 Le choc en retour étourdit [${attacker.name}] !`, "danger");
            break;
        case 'poison':
            attacker.status.bleed = { rounds: 5, dmgPerRound: Math.max(1, Math.round((armor.baseArmor || 5) * 0.15)) };
            logEvent(`☢️ Votre armure empoisonne [${attacker.name}] au contact !`, "danger");
            break;
        case 'slow':
            attacker.status.slowed = { rounds: 2 };
            logEvent(`🐌 [${attacker.name}] est ralenti en vous frappant !`, "danger");
            break;
        case 'light':
            attacker.status.blinded = { rounds: 2 };
            logEvent(`✨ Un éclat de votre armure éblouit [${attacker.name}] !`, "danger");
            break;
        case 'heal': {
            const healAmount = Math.max(3, Math.round((armor.baseArmor || 5) * 0.4));
            gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
            logEvent(`💚 Votre armure régénère vos blessures (+${healAmount} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const stolen = Math.max(2, Math.round((incomingDamage || 0) * 0.3));
            gameState.hp = Math.min(gameState.maxHp, gameState.hp + stolen);
            logEvent(`🧛 Votre armure vampirique siphonne ${stolen} PV sur le coup encaissé.`, "success");
            break;
        }
        case 'drain':
            attacker.atk = Math.max(1, Math.round(attacker.atk * 0.85));
            logEvent(`🌀 Votre armure draine l'énergie de [${attacker.name}], qui semble affaibli.`, "info");
            break;
        case 'corrode':
            attacker.status.corroded = { rounds: 3 };
            logEvent(`🧪 Le contact avec votre armure corrode celle de [${attacker.name}] !`, "danger");
            break;
        case 'fear':
            attacker.status.feared = { rounds: 3 };
            logEvent(`😱 [${attacker.name}] recule, terrifié par votre armure !`, "danger");
            break;
        case 'adrenaline':
            gameState.status.adrenaline = { rounds: 2, mult: 1.35 };
            logEvent("💉 Encaisser ce coup vous galvanise ! (dégâts boostés)", "success");
            break;
    }
}

// Applique la/les mécanique(s) spéciale(s) de l'armure équipée, à chaque coup encaissé (symétrique
// de applyWeaponMechanic(), déclenchée par resolveEnemyCounterAttack() plutôt que par une attaque
// du joueur). Chaque enchantement a sa propre chance de se déclencher, indépendamment des autres.
function applyArmorMechanic(attacker, incomingDamage) {
    const armor = gameState.equipment.armor;
    if (!armor || !armor.mechanics || armor.mechanics.length === 0 || !attacker) return;

    const triggerChance = 30; // Même taux que applyWeaponMechanic(), par cohérence
    armor.mechanics.forEach(mechanic => {
        if (Math.random() * 100 >= triggerChance) return;

        if (mechanic === 'random') {
            const picked = IMPLEMENTED_ARMOR_MECHANICS[Math.floor(Math.random() * IMPLEMENTED_ARMOR_MECHANICS.length)];
            resolveArmorMechanicEffect(picked, armor, attacker, incomingDamage);
        } else if (IMPLEMENTED_ARMOR_MECHANICS.includes(mechanic)) {
            resolveArmorMechanicEffect(mechanic, armor, attacker, incomingDamage);
        }
        // "stealth" (Silencieux) reste géré à part (détection, avant combat) ; "pleasure_or_pain",
        // "aoe" et "darkness" restent cosmétiques, comme sur les armes (voir IMPLEMENTED_WEAPON_MECHANICS).
    });
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
    [ui.btnAttackWeapon, ui.btnAttackRanged, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnSprint, ui.btnRetreat, ui.btnFlee].forEach(btn => {
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

    // Compagnon "Garde rapprochée" : jet de dé pour déterminer s'il s'interpose et encaisse une
    // partie du coup à la place du joueur (en plus de son bonus passif de DEF, voir getEffectiveDef).
    // S'il tombe à 0 PV ce faisant, il est mis hors combat et quitte le groupe.
    let playerDamage = enemyDamage;
    let companionAbsorbNote = "";
    if (gameState.companion && gameState.companion.specialty.type === 'guard' && gameState.companion.hp > 0) {
        const interceptChance = 40; // 40% de chance de s'interposer sur ce coup
        if (Math.random() * 100 < interceptChance) {
            const absorbPct = 0.3 + Math.random() * 0.3; // 30% à 60% des dégâts du coup
            const absorbed = Math.min(gameState.companion.hp, Math.round(enemyDamage * absorbPct));
            playerDamage = enemyDamage - absorbed;
            gameState.companion.hp -= absorbed;
            companionAbsorbNote = ` (${gameState.companion.name} encaisse ${absorbed} dégâts à votre place)`;
        }
    }

    gameState.hp -= playerDamage;
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage, ui.combatPlayerHpRing, ui.combatPlayerHp, gameState.hp, gameState.maxHp);
    const guardNote = (gameState.companion && gameState.companion.specialty.type === 'guard')
        ? ` (réduits grâce à la garde de ${gameState.companion.name})`
        : "";
    logEvent(`[${enemy.name}]${enemySlowedNote} vous inflige ${playerDamage} dégâts${wasBlinded ? " (vous étiez ébloui)" : ""}${wasCorroded ? " (armure corrodée)" : ""}${guardNote}${companionAbsorbNote}.`, "danger");

    // Le compagnon tombe s'il vient d'encaisser le coup de trop : il quitte le groupe.
    if (gameState.companion && gameState.companion.hp <= 0) {
        logEvent(`${gameState.companion.name} s'effondre, à bout de forces, et ne peut plus vous accompagner...`, "danger");
        gameState.companion = null;
    }

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

    // Compagnon "Premiers secours" : chance de soigner le joueur après la riposte ennemie, et de lui
    // restaurer un peu de mana au passage si un sort est équipé.
    if (gameState.companion && gameState.companion.specialty.type === 'medic' && Math.random() * 100 < 25) {
        const heal = 8 + Math.floor(Math.random() * 8); // 8 à 15 PV
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + heal);
        logEvent(`${gameState.companion.name} vous soigne rapidement ! (+${heal} PV)`, "success");
        if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
            const manaGain = 6 + Math.floor(Math.random() * 6); // 6 à 11 Mana
            gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaGain);
            logEvent(`${gameState.companion.name} restaure aussi un peu de votre mana ! (+${manaGain} Mana)`, "success");
        }
    }

    applyMobEffectOnPlayer(enemy);
    applyArmorMechanic(enemy, playerDamage);
    updateUI();
}

// --- Les 3 types d'attaque ---
// Chacune est reliée à sa propre compétence : plus elle est utilisée en combat, plus elle progresse
// (XP dédiée, indépendante des autres compétences et du niveau général du joueur).
const SKILL_XP_PER_USE = 3;

// Arme : la référence, équilibrée. Bénéficie du bonus de dégâts et de la mécanique spéciale
// (saignement/étourdissement) de l'arme équipée, le cas échéant. Utilisable uniquement à distance
// nulle (corps à corps), avec une arme réellement équipée — voir attackRanged() pour l'équivalent
// à distance, et attackUnarmed() pour le repli à mains nues sans arme.
function attackWeapon() {
    if (gameState.combatDistance > 0) {
        logEvent("Trop loin pour frapper à l'arme — approchez-vous ou tirez !", "danger");
        return;
    }
    if (!gameState.equipment.weapon) {
        logEvent("Vous n'avez pas d'arme équipée — essayez à mains nues !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;

    // Arme arrachée par un effet magnétique en cours : l'attaque à l'arme est indisponible
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Écart nul garanti (voir garde ci-dessus) : sans effet sur un mob de mêlée, mais un mob à distance doit encore reculer pour tirer
        return;
    }

    const skill = gameState.skills.weapon;
    const atkMultiplier = 1.0 + 0.04 * (skill.level - 1); // +4% par niveau
    const equippedGear = gameState.equipment.weapon;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0 }, "à l'arme");
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(equippedGear); // Ne fait rien si le combat vient de se terminer ou si l'arme n'a pas de mécanique
    }
}

// Tir : équivalent à distance de l'attaque à l'arme, avec l'arme à distance équipée. Utilisable
// uniquement quand de la distance sépare le joueur du monstre ET qu'une arme à distance est
// réellement équipée — voir attackWeapon() pour l'équivalent en corps à corps.
function attackRanged() {
    if (gameState.combatDistance <= 0) {
        logEvent("Trop près pour tirer — repassez à l'Arme !", "danger");
        return;
    }
    if (!gameState.equipment.ranged) {
        logEvent("Vous n'avez pas d'arme à distance équipée !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;

    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        return;
    }

    const skill = gameState.skills.weapon; // Même compétence "Arme" que le corps à corps
    const atkMultiplier = 1.0 + 0.04 * (skill.level - 1);
    const equippedGear = gameState.equipment.ranged;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0 }, "à distance");
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(equippedGear);
    }
}

// Mains nues : moins puissant, mais ignore une bonne partie de la DEF adverse. Utilisable
// uniquement à distance nulle (corps à corps), comme l'attaque à l'arme.
// Chaque niveau de compétence Mains nues améliore la capacité à contourner la DEF adverse.
function attackUnarmed() {
    if (gameState.combatDistance > 0) {
        logEvent("Trop loin pour frapper à mains nues !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;

    const skill = gameState.skills.unarmed;
    const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1)); // +3% par niveau, plafonné à 75%
    const landed = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75, varianceRange: 0.10, defReduction }, "à mains nues");
    if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
}

// S'approcher : action dédiée au rapprochement, à la place d'une attaque. Toujours disponible dès
// qu'un écart sépare les deux camps (distance > 0 — grisé sinon, voir updateUI()), quel que soit le
// type de mob. Ne porte JAMAIS de dégâts et ne déclenche aucune mécanique d'arme ni XP de
// compétence : en échange, le jet de rapprochement bénéficie d'un avantage (deux dés lancés, le
// meilleur est gardé). Progression garantie : même un jet perdant réduit l'écart d'au moins 1 — le
// mob peut ralentir l'approche, jamais la bloquer totalement. Le joueur reste exposé pendant sa
// course : la riposte est tentée immédiatement après (bloquée si un mob de mêlée est toujours hors
// de portée à l'issue du jet — voir safeEnemyCounterAttack()).
function attemptSprint() {
    if (!tryPlayerAction()) return;
    const enemy = gameState.currentEnemy;
    if (!enemy || gameState.combatDistance <= 0) {
        logEvent("Rien à rattraper pour l'instant.", "info");
        return;
    }

    const cfg = config.rangedCombat;
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor);
    const rollOnce = () => 1 + Math.floor(Math.random() * cfg.dieSides) + levelBonus;
    const playerRoll = Math.max(rollOnce(), rollOnce()); // Avantage : deux dés, le meilleur gardé
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll;
    // Progression garantie : au moins 1 point d'écart comblé, même si le mob gagne le jet.
    const closingDiff = Math.max(diff, 1);

    setCombatDistance(gameState.combatDistance - closingDiff);
    showDie(ui.combatPlayerDie, "🏃");

    if (gameState.combatDistance <= 0) {
        logEvent(`🏃 Vous foncez et comblez l'écart face à [${enemy.name}] !`, "success");
    } else if (closingDiff === diff) {
        logEvent(`🏃 Vous gagnez du terrain sur [${enemy.name}], mais l'écart n'est pas encore comblé.`, "info");
    } else {
        logEvent(`🏃 [${enemy.name}] esquive votre charge, mais vous grignotez tout de même du terrain.`, "info");
    }
    // Riposte bloquée si un mob de mêlée reste hors de portée à l'issue du jet ; sinon normale
    // (mob à distance qui tire librement, ou mob de mêlée désormais à portée).
    safeEnemyCounterAttack();
}

// S'éloigner : symétrique de S'approcher, dans l'autre sens sur l'écart. Toujours disponible tant
// qu'il reste de la marge (distance < maxDistance — grisé sinon, voir updateUI()), y compris quand
// le joueur est DÉJÀ à distance : le jet, avantagé de la même façon (deux dés, le meilleur gardé),
// pousse alors l'écart encore plus loin. Ne porte jamais de coup, ne déclenche aucune XP. Si le mob
// reste au contact à l'issue du jet, il riposte normalement ; si l'écart s'est ouvert (ou creusé),
// safeEnemyCounterAttack() bloque la riposte d'un mob de mêlée désormais hors de portée.
function attemptRetreat() {
    if (!tryPlayerAction()) return;
    const enemy = gameState.currentEnemy;
    if (!enemy || gameState.combatDistance >= config.rangedCombat.maxDistance) {
        logEvent("Impossible de vous éloigner davantage.", "info");
        return;
    }

    const cfg = config.rangedCombat;
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor);
    const rollOnce = () => 1 + Math.floor(Math.random() * cfg.dieSides) + levelBonus;
    const playerRoll = Math.max(rollOnce(), rollOnce()); // Avantage : deux dés, le meilleur gardé
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll;

    const before = gameState.combatDistance;
    setCombatDistance(gameState.combatDistance + diff);
    showDie(ui.combatPlayerDie, "🏃");

    if (gameState.combatDistance > before) {
        logEvent(`↔️ Vous prenez du champ face à [${enemy.name}] !`, "success");
    } else {
        logEvent(`[${enemy.name}] vous colle et vous empêche de vous éloigner.`, "danger");
    }
    safeEnemyCounterAttack();
}

// Magie : la plus puissante en moyenne, mais imprévisible, et peut totalement rater (thème
// absurde/chaotique). Chaque niveau de compétence Magie réduit le risque de rater son sort ET
// augmente légèrement sa puissance. Un seul sort équipé à la fois (gameState.equipment.spell, voir
// equipSpell()) : sa catégorie (melee/ranged) le fait se comporter exactement comme Arme/Tir —
// utilisable uniquement à l'écart correspondant, grisé sinon (voir updateUI()). Consomme du mana à
// chaque tentative, réussie ou non (le sort "part" quand même) ; insuffisant, il ne peut pas être
// lancé du tout.
function attackMagic() {
    const spell = gameState.equipment.spell;
    if (!spell) {
        logEvent("Vous n'avez aucun sort équipé — direction le Grimoire !", "danger");
        return;
    }
    const needsMelee = spell.spellCategory === 'melee';
    if (needsMelee && gameState.combatDistance > 0) {
        logEvent(`Trop loin pour lancer [${spell.spellName}] — approchez-vous !`, "danger");
        return;
    }
    if (!needsMelee && gameState.combatDistance <= 0) {
        logEvent(`Trop près pour lancer [${spell.spellName}] — éloignez-vous !`, "danger");
        return;
    }
    if (gameState.mana < spell.manaCost) {
        logEvent(`Mana insuffisant pour lancer [${spell.spellName}] (${spell.manaCost} requis).`, "danger");
        return;
    }
    if (!tryPlayerAction()) return;

    gameState.mana -= spell.manaCost;

    const skill = gameState.skills.magic;
    const backfireChance = Math.max(3, 15 - 1.5 * (skill.level - 1)); // 15% de base, jusqu'à 3% minimum
    const atkMultiplier = 1.4 + 0.02 * (skill.level - 1);

    if (Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        logEvent(`[${spell.spellName}] part de travers et fait un flop retentissant. Aucun dégât (mana quand même dépensé).`, "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    const effectiveAtk = gameState.atk + (spell.baseDmg || 0);
    const used = performPlayerAttack(
        effectiveAtk,
        { atkMultiplier, varianceRange: 0.35, defReduction: 0 },
        `avec [${spell.spellName}]`
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
        gameState.currentEnemy = null;
        gameState.inCombat = false; // Avant le log : le message de fuite doit s'afficher normalement sur la carte
        gameState.pendingStairAfterCombat = false; // La fuite ne compte pas comme une victoire sur le gardien
        gameState.pendingBossRoomId = null; // Le boss reste vivant, la salle n'est pas marquée vaincue
        gameState.pendingSneakAttack = false; // Ne doit pas se reporter sur un combat futur
        gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null }; // Les statuts ne survivent pas au combat
        setCardHeader('🏃', 'Fuite Réussie', 'Exploration');
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !${scoutNote}`, "info");
        if (gameState.pendingTravel) {
            logEvent("Vous rebroussez chemin, le trajet est annulé pour l'instant.", "info");
            gameState.pendingTravel = null;
        }
        updateUI();
    } else {
        logEvent(`Votre fuite échoue ! [${enemy.name}] profite de l'ouverture.`, "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir cette fuite ratée, mais tente de se rapprocher
    }
}

function winCombat() {
    const defeatedEnemy = gameState.currentEnemy;
    const wasBoss = defeatedEnemy && defeatedEnemy.isBoss;

    // Combat terminé : on sort de l'état "inCombat" avant les logs de résultat (XP/loot/victoire)
    // pour qu'ils s'affichent normalement sur la carte, comme n'importe quel autre événement (voir
    // logEvent) — seuls les échanges de coups pendant le combat lui-même restent hors de la carte.
    gameState.currentEnemy = null;
    gameState.inCombat = false;
    gameState.pendingSneakAttack = false;
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null }; // Les statuts ne survivent pas au combat

    if (wasBoss) {
        setCardHeader('👑', 'Victoire !', 'Boss Vaincu');
        logEvent(`👑 Vous avez triomphé de ${defeatedEnemy.name} !`, "success");
        triggerHaptic('heavy');
    } else {
        setCardHeader('🏆', 'Victoire !', 'Combat');
        logEvent("Vous remportez le combat !", "success");
        triggerHaptic('medium');
    }

    // Gain d'XP basé sur le monstre vaincu (valeur de repli si jamais xpReward est absent)
    const xpGained = (defeatedEnemy && defeatedEnemy.xpReward) || 10;
    gainXp(xpGained);

    // Le compagnon actif progresse aussi (fait grimper son risque de départ — voir gainCompanionXp)
    if (gameState.companion) {
        gainCompanionXp(15);
    }

    // Butin : garanti pour un boss (avec une chance de second objet), sinon la chance standard.
    // La rareté du loot est pondérée par la puissance du monstre vaincu (voir getLootPowerScore).
    const lootPower = getLootPowerScore(defeatedEnemy);
    if (wasBoss) {
        addLoot(lootPower);
        if (Math.random() * 100 < 50) addLoot(lootPower); // 50% de chance d'un deuxième objet
    } else if (Math.random() * 100 < 40) { // 40% de chance de loot post-combat
        addLoot(lootPower);
    }

    // Si ce combat était une salle de boss du quartier (escalier ou non), la salle est désormais
    // calme : on la marque vaincue et on retire le lieu connu correspondant, s'il existait.
    if (gameState.pendingBossRoomId) {
        const bossRoom = gameState.floorMap && gameState.floorMap.roomsById[gameState.pendingBossRoomId];
        if (bossRoom) bossRoom.defeated = true;
        removeKnownLocation(`boss-${gameState.pendingBossRoomId}`);
        gameState.pendingBossRoomId = null;
    }
    // Équivalent urbain : la ville gardienne (escalier ou Sortie) est désormais vaincue, elle reste
    // simplement accessible via la Carte Urbaine (aucun registre séparé, voir retreatFromUrbanBoss()).
    if (gameState.pendingUrbanBossCityId) {
        const city = gameState.urbanMap && gameState.urbanMap.citiesById[gameState.pendingUrbanBossCityId];
        if (city) city.defeated = true;
        gameState.pendingUrbanBossCityId = null;
    }

    // Si ce combat faisait partie d'un trajet de retour vers un lieu connu (embuscade),
    // on enchaîne sur la suite du trajet (nouvelle embuscade ou arrivée à destination)
    if (gameState.pendingTravel) {
        triggerNextAmbushOrArrive();
        return;
    }
    // Équivalent urbain : embuscade de route, on enchaîne vers la suite du trajet entre villes.
    if (gameState.pendingUrbanTravel) {
        triggerNextCityAmbushOrArrive();
        return;
    }

    // Si ce combat gardait un escalier, la victoire ouvre le passage vers l'étage suivant
    if (gameState.pendingStairAfterCombat) {
        gameState.pendingStairAfterCombat = false;
        logEvent("La voie vers l'escalier est libre !", "success");
        nextFloor(); // nextFloor() appelle déjà updateUI()
        return;
    }
    // Équivalent urbain : victoire sur le gardien de l'escalier (étage suivant) ou de la Sortie
    // (victoire finale, uniquement à l'étage final — voir config.urbanFloors.finalFloor).
    if (gameState.pendingUrbanAdvanceAfterCombat) {
        const advance = gameState.pendingUrbanAdvanceAfterCombat;
        gameState.pendingUrbanAdvanceAfterCombat = null;
        if (advance === 'win') {
            logEvent("La voie vers la Sortie est libre !", "success");
            winGame(); // winGame() appelle déjà updateUI()
        } else {
            logEvent("La voie vers l'escalier est libre !", "success");
            nextFloor(); // nextFloor() appelle déjà updateUI()
        }
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
    applyTimeElapsedRegen(1);
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
    applyTimeElapsedRegen(timeCost);
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

// ==========================================
// ÉCRAN DE DÉPART ET CADEAU DE BIENVENUE
// ==========================================
// Poids du cadeau de bienvenue (#start-screen-overlay -> #gift-reveal-overlay) : Arme > Rien > Tir >
// Magie, comme demandé. Valeurs de départ, ajustables par playtest comme le reste de l'équilibrage
// du jeu (voir generateWelcomeGiftItem() dans generator.js : toujours au palier Commun, quel que
// soit le type tiré ici).
const WELCOME_GIFT_WEIGHTS = { weapon: 40, nothing: 30, ranged: 20, spell: 10 };

function rollWelcomeGiftType() {
    const total = Object.values(WELCOME_GIFT_WEIGHTS).reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (const type in WELCOME_GIFT_WEIGHTS) {
        if (roll < WELCOME_GIFT_WEIGHTS[type]) return type;
        roll -= WELCOME_GIFT_WEIGHTS[type];
    }
    return 'nothing';
}

// Confirme le nom du crawler (écran de départ). Le nom EST l'identifiant de sauvegarde (voir
// saveKeyForName()) : s'il correspond à une partie déjà sauvegardée, on la restaure directement
// (aucun cadeau de bienvenue pour une partie reprise) ; sinon on enchaîne sur le cadeau de bienvenue
// d'un nouveau crawler, comme avant. Le reste de la partie (carte d'étage, etc.) est déjà initialisé
// en arrière-plan (voir le lancement du jeu en bas de ce fichier) dans les deux cas.
function confirmPlayerName() {
    const raw = ui.startNameInput ? ui.startNameInput.value.trim() : "";

    if (raw && hasSaveForName(raw)) {
        restoreSaveForName(raw);
        if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
        logEvent(`Sauvegarde de [${gameState.playerName}] restaurée. Bon retour dans le Donjon.`, "success");
        updateUI();
        updateInventoryUI();
        updateSpellbookUI();
        return;
    }

    gameState.playerName = raw || gameState.playerName || "CRAWLER_01";
    if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
    gameState.saveEnabled = true;
    updateUI();
    revealWelcomeGift();
}

// Tire le cadeau de bienvenue, l'équipe directement (aucun inventaire à gérer : tout est vide à cet
// instant) et affiche l'écran de révélation avec sa blague sarcastique. Un sort de bienvenue suit la
// même règle qu'un premier équipement normal (voir equipSpell()) : le mana démarre plein.
function revealWelcomeGift() {
    const type = rollWelcomeGiftType();
    const item = type === 'nothing' ? null : generateWelcomeGiftItem(type);

    if (type === 'weapon') gameState.equipment.weapon = item;
    else if (type === 'ranged') gameState.equipment.ranged = item;
    else if (type === 'spell') {
        gameState.equipment.spell = item;
        gameState.mana = gameState.maxMana;
    }

    if (ui.giftRevealTitle) {
        const labels = { weapon: "Une arme", ranged: "Une arme à distance", spell: "Un parchemin de sort", nothing: "Rien du tout" };
        const icons = { weapon: '⚔️', ranged: '🏹', spell: '📜', nothing: '🎁' };
        ui.giftRevealIcon.innerText = icons[type];
        ui.giftRevealTitle.innerText = labels[type];
        ui.giftRevealItemName.innerText = item ? formatItemDisplayName(item) : "";
        ui.giftRevealItemName.classList.toggle('hidden', !item);
        ui.giftRevealJoke.innerText = pick(flavorText.welcomeGift[type]);
        ui.giftRevealOverlay.classList.remove('hidden');
    }

    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
}

// Referme l'écran de révélation du cadeau : le joueur atterrit enfin sur l'écran de jeu habituel.
function dismissGiftReveal() {
    if (ui.giftRevealOverlay) ui.giftRevealOverlay.classList.add('hidden');
}

// Kit de test (bouton discret, voir index.html) : équipe directement 1 arme, 1 arme à distance et 1
// sort, tous au palier Légendaire (pleinement enchantés, mana au max), pour tester les mécaniques de
// combat sans dépendre du loot aléatoire. Outil de développement uniquement, sans lien avec la
// progression normale d'une run — voir generateTestKitItem()/generateTestKitSpell() (generator.js).
function giveTestKit() {
    gameState.equipment.weapon = generateTestKitItem('weapons');
    gameState.equipment.ranged = generateTestKitItem('ranged');
    gameState.equipment.spell = generateTestKitSpell();
    gameState.mana = gameState.maxMana;

    logEvent("🧪 Kit de test : arme, arme à distance et sort légendaires équipés.", "info");
    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
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

// Écran de victoire : déclenché en franchissant la Sortie de l'étage final (config.urbanFloors.finalFloor),
// une fois son gardien vaincu ou si elle n'était pas gardée. Même structure que gameOver(), en positif.
function winGame() {
    gameState.inCombat = true; // Bloque toute action supplémentaire, même logique que gameOver()
    gameState.hasWon = true;
    ui.combatZone.classList.add('hidden');

    logEvent("🎉 Vous franchissez la Sortie et quittez le Donjon, vivant !", "success");
    logEvent("--- VICTOIRE ---", "success");
    triggerHaptic('heavy');

    ui.winFloor.innerText = gameState.currentFloor;
    ui.winLevel.innerText = gameState.level;
    ui.winOverlay.classList.remove('hidden');

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
ui.btnWinRestart.addEventListener('click', resetGame);

// Écran de départ : nom du crawler (bouton ou touche Entrée), puis révélation du cadeau de bienvenue
ui.btnStartConfirm.addEventListener('click', confirmPlayerName);
ui.startNameInput.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') confirmPlayerName(); });
ui.btnGiftContinue.addEventListener('click', dismissGiftReveal);

// Clics sur les boutons de combat
ui.btnAttackWeapon.addEventListener('click', attackWeapon);
ui.btnAttackRanged.addEventListener('click', attackRanged);
ui.btnAttackUnarmed.addEventListener('click', attackUnarmed);
ui.btnAttackMagic.addEventListener('click', attackMagic);
if (ui.btnSprint) ui.btnSprint.addEventListener('click', attemptSprint);
if (ui.btnRetreat) ui.btnRetreat.addEventListener('click', attemptRetreat);
ui.btnFlee.addEventListener('click', attemptFlee);

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

// Clic sur le kit de test (bouton discret)
ui.btnDevTestKit.addEventListener('click', giveTestKit);

// Lancement du jeu
generateFloorMap();
updateUI();
updateInventoryUI();
updateSpellbookUI();
updateKnownLocationsUI();
updateCompanionUI();

// Indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames())
if (ui.startSavesHint) {
    const savedNames = listSavedCrawlerNames();
    ui.startSavesHint.classList.toggle('hidden', savedNames.length === 0);
    ui.startSavesHint.innerText = savedNames.length ? `Sauvegardes disponibles : ${savedNames.join(', ')}` : '';
}

