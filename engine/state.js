// engine/state.js — État du jeu (gameState) — section 1 d'origine.
// Le moteur est découpé en engine/*.js (chargés dans l'ordre d'index.html, puis app.js qui initialise) : voir CLAUDE.md, « Moteur : engine/ ».
// app.js - Moteur principal du Rogue-like textuel (Crawler)
// Conçu pour s'interfacer avec index.html

// ==========================================
// 1. ÉTAT DU JEU (State)
// ==========================================
const gameState = {
    playerName: "CRAWLER_01",
    hp: 100,
    maxHp: 100,
    // Vrai maximum de PV, tel que fait progresser la seule montée de niveau (voir gainXp()) — jamais
    // touché directement par une anomalie d'étage (voir PEAU_DE_VERRE). gameState.maxHp reste la
    // valeur EFFECTIVE réellement utilisée partout ailleurs (recomputeMaxHp() la recalcule à partir de
    // celle-ci × gameState.anomalyEffects.playerMaxHpMult à chaque changement de l'un des deux).
    baseMaxHp: 100,
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
    // Valeurs réelles (config.floorTimeBudget.base) posées juste après la déclaration de `config`
    // plus bas dans ce fichier, même contrainte d'ordre que gameState.maxInventory (Chantier B).
    timeLeft: 100,
    maxTime: 100, // Temps alloué pour l'étage courant
    currentFloor: 1,
    // Reflète toujours le quartier (quadrant) où se trouve actuellement le joueur ; posé par
    // generateFloorMap() à chaque étage, puis mis à jour à chaque changement de quadrant.
    currentDistrict: null,
    inventory: [],
    // Valeur réelle posée juste après la déclaration de `config` plus bas dans ce fichier (ordre de
    // déclaration : config référence gameState par endroits, gameState ne peut donc pas référencer
    // config ici) — voir `gameState.maxInventory = config.inventory.maxEquipment;` juste après `config`.
    maxInventory: 5,
    // PO (pièces d'or) : trouvées en explorant (voir config.chances.goldFind) ou obtenues en
    // revendant un objet d'inventaire (sellItem()) — seule monnaie du jeu, dépensée dans les villes
    // spécialisées (marchand/professeur, voir generateUrbanFloorMap()).
    gold: 0,
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
    // Boss (nom de base) dont l'objet signature a déjà été obtenu dans cette partie (succès « collectionneur ») : l'objet n'est
    // plus garanti — il exige un Coup de grâce PARFAIT (chantier 6, V3, voir awardBossSignatureItem()).
    signaturesAwarded: [],
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
    safehouseChoicePending: false, // Une salle sécurisée vient d'être trouvée, décision repos/repartir en attente
    pendingSafehouseRoomId: null, // Room id de la salle sécurisée dont le choix est actuellement affiché
    lastAttackKind: null, // 'weapon' | 'ranged' | 'magic' | 'unarmed' : dernière attaque utilisée, fixe la posture du crawler dans les scènes (voir crawlerPosture() dans scene.js)
    stealthChoicePending: false, // Un ennemi non repéré attend une décision (esquiver/attaque furtive)
    pendingStealthEncounter: null, // L'ennemi généré, en attente de cette décision
    pendingSneakAttack: false, // Consommé par le tout premier coup porté (bonus x2)
    pendingBossEncounter: null, // { roomId, guardsStairs } pendant que bossChoicePending est vrai
    pendingTravel: null, // { destination, ambushesRemaining } pendant un trajet sur la carte (voir travelToRoom())
    // Carte de l'étage courant : une zone circulaire divisée en 4 quartiers fixes, chacun un
    // graphe de pièces/couloirs (voir generateFloorMap()). roomsById aplatit les 4 quartiers en
    // un seul graphe (les jonctions inter-quartiers sont des arêtes comme les autres), ce qui
    // simplifie le calcul de distance (computeDistance()). Rien de tout ceci n'est affiché.
    floorMap: null,
    // Étage urbain (multiples de 3, chantier 12 « villes explorables ») : il passe par gameState.floorMap
    // comme un étage classique (floorMap.kind === 'urban', voir generateUrbanFloorMap()).
    shopChoicePending: false, // Un écran marchand/professeur (ville spécialisée) est ouvert
    pendingShopCityId: null, // Ville dont l'écran marchand/professeur est actuellement affiché
    lairChoicePending: false, // On vient d'entrer dans un repaire (impasse d'une route) : choix plonger/ressortir
    pendingLairId: null, // Repaire (gameState.floorMap.lairsById) dont le choix est actuellement affiché
    pendingLairDive: null, // { lairId, combatsLeft, stage: 'trash'|'boss' } pendant une plongée en cours (voir winCombat())
    floorTransitionPending: false, // L'écran d'escalier (félicitations) est affiché, voir triggerFloorTransition()
    stairsChoicePending: false, // Choix « Descendre / Rester sur l'étage » affiché, voir offerStairsChoice()
    pendingStairsChoice: null, // Escalier concerné : { kind: 'room', roomId }
    hasWon: false, // Vrai une fois la Sortie de l'étage final franchie (voir winGame())
    companion: null, // Compagnon actuellement recruté (ou null)
    pendingCompanionCandidate: null, // Candidat en attente de décision (recruter/laisser/fuir/attaquer)
    companionChoicePending: false, // Une décision de compagnon est en attente
    // Autosauvegarde (voir saveGame()) : faux pendant l'initialisation silencieuse au chargement de
    // la page (avant que le joueur n'ait confirmé son nom), pour ne jamais écraser une sauvegarde
    // existante avec un état par défaut. Activé par confirmPlayerName()/restoreSaveForName().
    saveEnabled: false,
    // Horodatage (epoch ms) de la dernière sauvegarde réussie, posé par saveGame() — sert uniquement
    // d'affichage dans l'écran "Nettoyer les sauvegardes" (openManageSaves()). Absent sur une
    // sauvegarde antérieure à cette feature : traité comme "date inconnue", jamais une erreur.
    lastSavedAt: null,
    // Tally de l'étage EN COURS (mobs tués, dégâts subis, objets trouvés, XP gagnés) — voir
    // applyPlayerDamage()/winCombat()/gainXp()/addLoot(). Affiché sur l'écran d'escalier
    // (triggerFloorTransition()) puis remis à zéro par advanceToNextFloor(). Absent d'une sauvegarde
    // antérieure : retombe sur des zéros via Object.assign (jamais undefined à l'affichage, voir
    // restoreSaveForName()).
    floorStats: { mobsKilled: 0, damageTaken: 0, itemsFound: 0, xpGained: 0 },
    // Nombre de fuites RÉUSSIES depuis le début du run (voir attemptFlee()) — jamais remis à zéro en
    // cours de run, sert uniquement à la mention spéciale de generateEpitaph() ("mort en ayant fui 3+
    // fois"). Absent d'une sauvegarde antérieure : retombe sur 0 via Object.assign.
    fleesThisRun: 0,
    // Vrai seulement pendant le tour où le sort du joueur vient de partir en flop (voir attackMagic()) :
    // remis à faux au tout début de CHAQUE action joueur (tryPlayerAction()), pour que seul un décès
    // survenant DANS ce même tour (riposte immédiate de l'ennemi) soit attribué au backfire par
    // gameOver()/generateEpitaph(), jamais un décès plus tardif sans rapport.
    lastPlayerActionWasBackfire: false,
    // Vrai seulement pendant la riposte qui suit un "Charger" (attemptEngage(), Chantier 3 du rework
    // combat) : DEF joueur divisée par 2 pour ce tour-ci uniquement (voir getEffectiveDef()), remis à
    // faux au tout début de CHAQUE action joueur (tryPlayerAction()), même convention que
    // lastPlayerActionWasBackfire ci-dessus.
    engageDefHalved: false,
    // Chronique du run (chantier 2, voir achievements.js / recordRunEvent()) : compteurs sur toute la
    // partie, jamais remis à zéro en cours de run. Complétée par normalizeRunStats() à la restauration.
    runStats: createEmptyRunStats(),
    // Succès débloqués PAR CE CRAWLER : { [id]: { floor, at } } (voir unlockAchievement()).
    achievements: {},
    // Prime des chasseurs de primes (chantier 3, voir createEmptyBounty()/onBountyVictory()) : valeur
    // 0-100, chasseurs tués, victoires depuis le dernier chasseur (99 = aucun encore).
    bounty: { value: 0, huntersKilled: 0, combatsSinceHunter: 99 },
    // Escouade en cours (palier 90+) : nombre de chasseurs encore à venir après celui en combat.
    pendingBountySquad: 0,
    // Émission DeathWatch (chantier 4, voir triggerShow()/answerShow()) : choix bloquant à l'arrivée
    // d'étage ; `pendingShow` = { tauntId, text, replies } ; `pendingShowAfterPact` = bilan d'étage mis
    // de côté quand le Pacte du Crawler passe avant l'émission.
    showChoicePending: false,
    pendingShow: null,
    // Buff de départ « Foutu pour foutu » (chantier 14, voir NOTES_ITEMS.md/CHANTIERS.md) : null | 'desperate' (cadeau Armure ou Rien :
    // +5 % de dégâts subis, mains nues ×2) | 'boxer' (évolution à l'étage 2 : mains nues ×1,25, définitif). Absent d'une ancienne sauvegarde : null.
    starterBuff: null,
    // Race du crawler (chantier 13, lot 1 — voir origins.js/CHANTIERS.md) : clé d'ORIGIN_RACES, null = aucune (ancienne sauvegarde, avant l'étage 3).
    // `raceLastStandFloor` : dernier étage où « Increvable » (Cafard mutant) a servi (1 fois par étage).
    race: null,
    raceLastStandFloor: 0,
    // Armure de scénario (chantier 15, lot 4) : dernier étage où elle a servi (1 fois par étage 1-3). Absent d'une ancienne sauvegarde : 0.
    plotArmorFloor: 0,
    // Convention collective du Donjon (chantier 15, lot 5) : message de fin affiché une seule fois, à la première élite croisée. Absent d'une ancienne sauvegarde : vrai si elle a déjà dépassé les étages protégés.
    eliteConventionEnded: false,
    // Classe du crawler (chantier 13, lot 2 : choisie à l'étage 3 ; ses effets sont codés au lot 3) : clé d'ORIGIN_CLASSES, null = aucune.
    crawlerClass: null,
    classAbilityUsed: false, // capacité active de classe déjà utilisée dans CE combat (remise à faux à chaque nouveau combat)
    // Choix de l'étage 3 (race puis classe, deux écrans successifs) : `pendingOriginOffers` = { kind, offers, selected } ;
    // `pendingPactAfterOrigin` = le Pacte du Crawler attend la fin du choix (jamais deux écrans bloquants à la fois).
    raceChoicePending: false,
    classChoicePending: false,
    pendingOriginOffers: null,
    pendingPactAfterOrigin: false,
    pendingShowAfterPact: null,
    // Mini-jeu ouvert (chantier 6, minigames-ui.js) : { kind, boss } — bloque les actions le temps de l'épreuve.
    pendingMinigame: null,
    // Salle de jeux (chantier 6, V4) : ville dont on visite la salle (reprend le blocage de shopChoicePending) et partie
    // en cours { game, stake, outcomes } — voir triggerArcade()/playArcadeGame().
    pendingArcadeCityId: null,
    arcadeSession: null,
    // Occasions de combat (chantier 6, V2) : { current: { type } | null, turn, rolledTurn, lastOfferTurn, pity } — voir rollCombatOccasion().
    occasion: { current: null, turn: 0, rolledTurn: -1, lastOfferTurn: -9, pity: 0 },
    // Journal des N dernières épitaphes (voir generateEpitaph()/recordEpitaph()), plus récente en
    // premier, plafonné à NECROLOGIE_MAX_ENTRIES. Persistant en save (aucun système de lecture dédié
    // pour l'instant, préparé pour un futur "journal" consultable). Absent d'une sauvegarde antérieure :
    // retombe sur [] via Object.assign.
    necrologie: [],
    // Anomalies actives sur l'étage EN COURS (voir anomalies.js/rollAndApplyFloorAnomalies()) :
    // definitions complètes du catalogue (0, 1 ou 2 entrées selon la tranche d'étage), affichées en
    // permanence dans l'UI (voir updateAnomalyStatusUI()). Vide sur les étages 1-2 (jamais d'anomalie),
    // et par défaut sur une sauvegarde antérieure à cette feature.
    activeAnomalies: [],
    // Effets RÉSOLUS (un seul objet plat) des anomalies actives ci-dessus — voir
    // createNeutralAnomalyEffects()/appliquerAnomalie() dans anomalies.js. Neutre par défaut : aucune
    // anomalie ne change jamais le comportement du jeu par rapport à avant ce système.
    anomalyEffects: null,
    // Delta {atk, hp} appliqué directement par choosePactBlessing() (anomalie PACTE_DU_CRAWLER),
    // annulé au tout début du prochain advanceToNextFloor() — voir CLAUDE.md.
    pactBlessingDelta: null,
    // Choix forcé de bénédiction (PACTE_DU_CRAWLER) en attente — inclus dans isActionBlocked().
    pactChoicePending: false,
    // Tirage anticipé des anomalies du PROCHAIN étage (voir getUpcomingAnomalyAnnouncement()), pour
    // que rollAndApplyFloorAnomalies() applique exactement ce qui a été annoncé sur l'écran d'escalier
    // plutôt que de retirer au hasard. Purement transitoire, jamais utile hors de cette fenêtre.
    pendingNextFloorAnomalies: null
};
// anomalyEffects initialisé après coup (dépend de anomalies.js, chargé juste avant app.js — voir
// index.html) plutôt qu'en dur dans le littéral ci-dessus, pour ne dépendre que d'un seul endroit
// (createNeutralAnomalyEffects()) si sa forme change un jour.
gameState.anomalyEffects = createNeutralAnomalyEffects();

// Identifiant de version affiché sur l'écran de départ (voir #start-screen-overlay dans index.html) :
// le numéro de la dernière PR mergée sur main sert d'identifiant, à incrémenter manuellement à
// chaque nouvelle PR (voir CLAUDE.md, Conventions de travail) — pas de build step, donc pas de
// numéro de version généré automatiquement.
const APP_VERSION = { pr: 33, label: "Villes explorables (étages urbains), crawler mort définitif, barre du bas agrandie" };
