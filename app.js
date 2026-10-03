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
    encounterIntroPending: false, // Écran plein écran de rencontre ouvert (chantier 16) : attend un tap, le callback vit hors gameState (jamais sauvegardé)
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
        // toucher à leur rareté (gérée ailleurs par rollLootRarity(), voir itemBalance dans items.js).
        nothing: 37,        // Rien de notable
        combat: 25,         // Rencontre hostile
        loot: 4,            // Objet généré procéduralement
        trap: 10,           // NOUVEAU : piège avec de vrais dégâts
        timeLoss: 8,        // NOUVEAU : détour qui coûte du temps
        minorFind: 3,       // NOUVEAU : petite trouvaille (soin mineur)
        goldFind: 3,        // NOUVEAU : quelques PO trouvées (voir sellItem() pour l'autre source)
        audienceGift: 4,    // NOUVEAU : cadeau des spectateurs (petit bonus d'XP), clin d'œil à l'émission
        companionEncounter: 3, // NOUVEAU : rencontre d'un autre crawler (ami ou hostile, 50/50)
        flavorOnly: 3       // Pur moment narratif, sans effet mécanique (réduit de 6 à 3 pour compenser)
    },
    // Table d'événements des AVENUES (chantier 5, validée par l'utilisateur) : mêmes clés et même ordre que
    // config.chances, zone plus sûre et plus fréquentée (moins de combats et de pièges, plus de crawlers et
    // de cadeaux du public). Choisie par getZoneEventTable() selon la zone de la salle (ZONE_TYPES, floorgen.js).
    avenueChances: {
        nothing: 40, combat: 12, loot: 4, trap: 3, timeLoss: 5, minorFind: 5, goldFind: 6,
        audienceGift: 8, companionEncounter: 12, flavorOnly: 5
    },
    // Étages urbains (chantier 12, tables validées par l'utilisateur, variante « routes plus dures ») : une
    // ville est calme (jamais de combat ni de piège, parfois un pickpocket), une route est dangereuse.
    cityChances: {
        nothing: 40, combat: 0, loot: 0, trap: 0, timeLoss: 0, minorFind: 6, goldFind: 12,
        audienceGift: 10, companionEncounter: 14, pickpocket: 5, flavorOnly: 13
    },
    roadChances: {
        nothing: 13, combat: 40, loot: 5, trap: 14, timeLoss: 10, minorFind: 3, goldFind: 4,
        audienceGift: 3, companionEncounter: 5, flavorOnly: 3
    },
    // Pickpocket (table des villes) : perte de `pct` % des PO, au moins `min` (si on les a), jamais plus de `max`.
    pickpocket: { pct: 10, min: 5, max: 50 },
    // "stairGuardedChance" a été retiré : l'escalier est désormais TOUJOURS gardé par le boss de
    // son quartier (placement déterministe, voir generateFloorMap()), plus un tirage au hasard.

    // Taux de croissance des stats des monstres (mobs normaux et boss) par étage de profondeur,
    // utilisés par getFloorScaling()/applyFloorScaling() dans generator.js. À l'étage 1, aucun
    // bonus (multiplicateur = 1) ; chaque étage suivant ajoute ce taux au multiplicateur.
    // Valeurs de départ, à ajuster par playtest réel (pas de combat de référence à ce stade).
    floorScaling: {
        hp: 0.22,  // +22% de PV par étage de profondeur
        atk: 0.12, // ANCIEN scaling ATQ (profondeur) — remplacé par mobDamageScaling ci-dessous pour
                    // les dégâts (chantier "rework combat"). Champ conservé pour compatibilité (lu
                    // par le repli de getFloorScaling() si config.mobDamageScaling est absent).
        def: 0.10, // +10% de DEF par étage de profondeur
        xp: 0.18   // +18% d'XP donnée par étage de profondeur (suit la difficulté accrue)
    },

    // Chantier "rework combat" — scaling des dégâts des mobs (remplace floorScaling.atk ci-dessus,
    // voir getFloorScaling() dans generator.js) : dégâts_mob = base × (1 + perFloor×étage) ×
    // (1 + perMobLevel×étage) — "niveau_mob" n'existe pas comme champ dédié sur les mobs (aucun mob
    // ne "level up" indépendamment, voir getMobLevelEquivalent()) : l'étage sert de proxy pour les
    // deux facteurs, cohérent avec le reste du scaling par étage du moteur. `pressureFloorFrac`/
    // `minMitigation`/`eliteDamageMult` sont consommés par rollDamage()/resolveEnemyCounterAttack()
    // (mob -> joueur UNIQUEMENT, jamais les dégâts infligés PAR le joueur). Valeurs fournies par la
    // consigne du chantier, non issues d'un audit d'équilibrage complet (voir NOTES_COMBAT.md).
    mobDamageScaling: {
        perFloor: 0.12,
        perMobLevel: 0.03,
        // Plancher de pression : un mob inflige TOUJOURS au moins cette fraction des PV max du
        // joueur par attaque, calculée sur les dégâts BRUTS (avant mitigation par la défense) — voir
        // rollDamage(). Empêche un joueur très défensif de rendre un mob totalement inoffensif.
        pressureFloorFrac: 0.10,
        // Cap de réduction : la défense ne peut jamais faire passer la mitigation sous cette valeur
        // (fraction des dégâts bruts qui passe malgré la défense) — voir rollDamage().
        minMitigation: 0.35,
        // Multiplicateur de dégâts dédié aux mobs élites (voir isEliteMob()), EN PLUS du scaling par
        // étage ci-dessus et des modificateurs aléatoires déjà existants (qui gonflaient surtout les
        // PV) — appliqué au moment de la riposte, voir resolveEnemyCounterAttack().
        eliteDamageMult: 1.65
    },

    // Chantier "rework combat", Chantier 2 (rework des boss) : un boss n'est plus "un mob avec plus
    // de PV" — son pattern d'attaque change par palier de PV (voir getBossPhase()/
    // performBossCounterAttack() dans app.js), sans nouvelle entité ni modélisation spatiale.
    // Uniquement du contenu + paramétrage + états sur le moteur de riposte existant. Valeurs de
    // départ posées par ce chantier, non issues d'un audit d'équilibrage complet (voir
    // NOTES_COMBAT.md) — à ajuster par playtest comme le reste des chiffres d'équilibrage du jeu.
    bossPhases: {
        // Phase 1 (100-66% PV) : chance par tour (hors télégraphe déjà en cours) de télégraphier une
        // attaque lourde au lieu d'attaquer normalement ce tour-ci (le tour d'annonce n'inflige AUCUN
        // dégât — c'est le "vrai choix" laissé au joueur : défense, esquive, burst). Phase 2 reprend
        // la même mécanique avec une chance réduite (plus occupée par ses propres patterns).
        phase1TelegraphChance: 0.30,
        phase2TelegraphChance: 0.18,
        // Multiplicateur appliqué à l'ATQ du boss au tour d'EXÉCUTION du télégraphe (après l'annonce).
        telegraphHeavyMult: 1.8,
        // Phase 2 : frappe multiple (2-3 coups dans le même tour, dégâts par coup réduits pour que le
        // total reste lisible), harcèlement à distance (pont avec le futur Chantier 3 "enrage
        // distance" — punit le joueur qui kite, mécanique volontairement minimale ici) et buff de
        // défense télégraphié ("il se hérisse" — tour d'annonce sans dégât, buff actif ensuite).
        // Chances mutuellement exclusives, tirées dans l'ordre indiqué ; le reliquat retombe sur le
        // pattern de base (télégraphe lourd ou attaque normale, comme la phase 1).
        multiStrikeChance: 0.22,
        multiStrikeTotalMult: 1.3, // Dégâts TOTAUX du multi-coups (répartis également entre les coups)
        rangedHarassChance: 0.15,
        rangedHarassMult: 0.6,
        defBuffTelegraphChance: 0.15,
        defBuffRounds: 2,
        defBuffMult: 1.6, // DEF effective du boss ×1.6 tant que le buff est actif (voir performPlayerAttack())
        // Phase 3 (<33% PV) — "phase de folie" : dégâts fixes +40%, défense fixe -30%, plus de
        // télégraphe (le boss ne "joue" plus tactique, il frappe en continu). La défense réduite crée
        // la fenêtre risque/récompense demandée par la consigne : le joueur encaisse plus par coup,
        // mais peut aussi faire tomber le boss bien plus vite tant qu'il tient le choc.
        phase3: {
            atkMult: 1.4,
            defMult: 0.7
        }
    },

    // Chantier "rework combat", Chantier 3 (enrage distance et engagement) : voir
    // noteMobKitingRound()/triggerMobEnrage()/endMobEnrage() dans app.js. Un mob (boss inclus, voir
    // config.bossPhases plus haut — le compteur d'un boss démarre à 1) accumule un tour de "kiting"
    // chaque fois qu'il reste à distance sans pouvoir attaquer ; la probabilité d'enrage par tour
    // grimpe avec ce compteur jusqu'au plafond `maxChance`. Valeurs de départ non issues d'un audit
    // d'équilibrage complet (voir NOTES_COMBAT.md) — à ajuster par playtest.
    distanceEnrage: {
        baseChance: 0.15,      // Proba d'enrage au 1er tour de kiting (formule : min(base + parRound×tours, max))
        chancePerRound: 0.15,
        maxChance: 0.80,
        atkMult: 1.40,         // Dégâts du mob +40% tant qu'il est enragé (rue initiale ET frappes suivantes)
        defMult: 0.5,          // DEF effective du mob divisée par 2 tant qu'il est enragé (lu par performPlayerAttack())
        cooldownRounds: 2,     // Tours de repos forcé après la fin d'un enrage, avant de pouvoir s'enrager de nouveau
        meleeGluedDamageMult: 1.10 // Anti-abus : un mob TOUJOURS +10% dégâts à distance nulle (collé au corps à corps)
    },

    // Chantier "rework combat", Chantier 3 : action volontaire "Charger" (attemptEngage()) — ferme
    // l'écart d'un coup et enchaîne immédiatement une attaque bonus, au prix d'une DEF joueur divisée
    // par 2 le temps de la riposte qui suit (voir gameState.engageDefHalved/getEffectiveDef()).
    engageAction: {
        atkMultiplier: 1.25
    },

    // Chantier "lisibilité combat" : durées du séquenceur de tour (voir runCombatBeats() dans app.js).
    // AUCUNE de ces valeurs ne change une formule de dégâts — uniquement le RYTHME d'affichage des
    // événements déjà calculés. `skipOnInput` est lu par le Chantier 9 (skip au clic/Espace) ; laissé
    // ici dès ce chantier pour que toute la config du rythme vive au même endroit.
    combatRhythm: {
        beatActionToRiposte: 280, // Pause entre l'action du joueur et la riposte (remplace COMBAT_BEAT_MS)
        beatEmptyEvent: 0,        // Événement sans dégât (télégraphe posé, riposte bloquée) : affichage immédiat
        beatHeavyEvent: 550,      // Télégraphe exécuté, ruée d'enrage, changement de phase boss
        beatMultiHit: 90,         // Entre chaque frappe d'un multi-coups (phase 2 boss)
        skipOnInput: true
    },

    // Paramètres du combat à distance (mobs marqués `ranged: true` dans bestiary.js). Voir
    // getCombatRangeContext()/resolveDistanceRound() dans app.js.
    rangedCombat: {
        initialDistance: 4,     // Écart de départ face à un mob à distance (en "unités")
        maxDistance: 8,         // Plafond de l'écart (ne peut pas s'éloigner indéfiniment)
        dieSides: 6,            // Taille du dé opposé lancé chaque manche par le joueur ET le mob
        levelAdvantageDivisor: 4, // Bonus au dé du joueur = floor(niveau / ce diviseur)
        // Coût en temps validé par playtest/simulation : ~0.2h par manche CONTESTÉE (jet de
        // distance, gagné ou perdu), pour qu'un combat kité de bout en bout (10-15 manches face à un
        // boss) coûte au total ~2-3h — jamais sur les tours d'attaque standards. gameState.timeLeft
        // accepte des valeurs fractionnaires (formatTimeRemaining() arrondit déjà à l'affichage),
        // donc pas besoin d'accumulateur séparé.
        timeCostPerRound: 0.2,
        // Marge de victoire (sur le dé opposé) au-delà de laquelle un mob de MÊLÉE qui tente de
        // combler l'écart réussit une "ruée" : l'écart tombe à 0 CE tour-ci (même si la formule
        // habituelle n'aurait comblé qu'une partie du chemin) et il frappe immédiatement. Sans ça, un
        // joueur qui atteint l'écart maximal devient mathématiquement increvable par un mob de mêlée
        // (le delta d'une manche normale ne peut jamais dépasser dieSides-1, donc jamais combler tout
        // l'écart depuis maxDistance) — voir resolveEnemyReaction()/attemptRetreat().
        rushMarginThreshold: 3
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
        stairsGuardChanceByFloor: { 3: 20, 6: 35, 9: 50, 12: 65, 15: 80 },
        // Chance qu'une ville normale (ni départ, ni escalier/Sortie) devienne spécialisée
        // (marchand/professeur, 50/50 ensuite) — voir generateUrbanFloorMap()/triggerShopEncounter().
        specializedCityChance: 18,
        arcadeCitiesMin: 1,         // Salles de jeux (V4) : 1 à 2 villes par étage urbain, jamais la ville de départ
        arcadeCitiesMax: 2,
        // Nombre de routes marquées "repaire" par étage urbain (voir generateUrbanFloorMap()) :
        // toujours 1, sauf à l'étage final où un second, plus généreux, s'ajoute.
        lairRoadsPerFloor: 1,
        lairRoadsFinalFloor: 2
    },

    // Salle sécurisée (voir enterRoom()/restAtSafehouse()) : entrée à choix explicite, jamais de soin
    // automatique. Trois options : Partir (gratuit), Sieste et Sommeil réparateur — chacune coûte `cost`
    // heures et rend `healPct` des PV PERDUS (et la même part du mana manquant si un sort est équipé),
    // en pourcentage plutôt qu'en valeur absolue pour rester juste à tous les niveaux. Valeurs validées
    // par l'utilisateur, à ajuster par playtest.
    safehouse: {
        nap: { cost: 2, healPct: 0.25 },
        sleep: { cost: 8, healPct: 1.0 }
    },

    // Compagnons (chantier "rework des compagnons", voir NOTES_COMPAGNONS.md et CHANTIERS.md) : valeurs
    // validées par l'utilisateur, à ajuster par playtest. Lues par les fonctions pures de generator.js
    // (section 3) et par la logique de jeu d'app.js (section COMPAGNONS).
    companions: {
        xpPerWin: 15,
        levelStatGain: 0.10, // +10 % des stats de base par niveau du compagnon
        loyalty: {
            start: 60, max: 100,
            victory: 2, nap: 5, sleep: 10, flee: -5, downed: -10,
            consumableGift: 3,
            giftByRarity: { camelote: 2, commun: 5, rare: 8, epique: 12, legendaire: 18 },
            // Jet de départ au changement d'étage, seulement sous `departureThreshold` :
            // chance = (departureThreshold − loyauté) × departurePerPoint %.
            departureThreshold: 40, departurePerPoint: 2
        },
        support: {
            strikeRatio: 0.35,         // Frappe d'appoint : coup à chaque attaque du joueur (% de l'ATQ du compagnon)
            opportunisticChance: 25,   // Autres spécialités : chance d'un coup d'opportunité au même ratio
            spellCastChance: 30,       // Sort donné : chance de le lancer à la place du coup
            spellRatio: 0.6            // ... pour 60 % de (ATQ + dégâts du sort)
        },
        guard: { interceptChance: 40, absorbMin: 0.3, absorbMax: 0.6, defShare: 0.5, ambushMult: 0.75 },
        strayHitChance: 10, // Autres spécialités : "pris dans la mêlée", même absorption que la Garde
        medic: { healChance: 25, healPct: 0.06, postVictoryHealPct: 0.04, manaMin: 6, manaMax: 11 },
        scout: { stealthBonus: 10, fleeBonus: 15, trapAvoidChance: 50 },
        striker: { goldBonusPct: 10 }
    },

    // Émission DeathWatch (chantier 4 — tableau validé par l'utilisateur, voir CHANTIERS.md) : jet
    // d`dieSides` + popularité (1 par tranche de `popularityPerAchievements` succès) contre `dc`.
    show: {
        firstFloor: 2,
        dieSides: 20,
        popularityPerAchievements: 5,
        eliteBonus: 100, // Provocation ratée : generateMob(…, eliteBonus) — deux modificateurs garantis
        answers: {
            polite: { goldMult: 0.5 },                                            // sans jet : moitié des PO d'une boîte Bronze
            retort: { dc: 8, box: 'bronze', fail: 'time', failHours: 2 },
            provoke: { dc: 12, box: 'silver', fail: 'elite' },
            insult: { dc: 16, box: 'gold', fail: 'hunter', bountyGain: 20 }
        }
    },

    // Chasseurs de primes (chantier 3 — chiffres validés par l'utilisateur, voir CHANTIERS.md et
    // NOTES_CHASSEURS.md). Prime 0-100 : +gainEasy par victoire de facilité ≥ easyEase, +gainMedium ≥
    // mediumEase, +fleeGain par fuite devant un chasseur ; ne retombe qu'en tuant un chasseur.
    bounty: {
        max: 100,
        gainEasy: 8, easyEase: 0.8,
        gainMedium: 3, mediumEase: 0.5,
        fleeGain: 10,
        tiers: { wanted: 30, hunters: 60, squad: 90 },
        encounterChance: { hunters: 10, squad: 20 }, // % des combats d'exploration / embuscades
        minCombatsBetween: 3,                         // victoires minimum entre deux chasseurs
        fleeChance: 50,                               // aucune esquive furtive possible
        rewardGoldPerPoint: 2,                        // PO = prime × étage × 2
        // Calibrage calé sur le joueur (computeBountyHunterStats(), generator.js) : ~4 de vos coups pour
        // le tuer, ~9 % de vos PV max par coup encaissé, DEF = 35 % de votre meilleure ATQ.
        hunter: { turnsToKill: 4, hitPct: 0.09, defShare: 0.35 }
    },

    // Boîtes de butin des succès (chantier 2, façon DCC — chiffres validés par l'utilisateur, voir
    // CHANTIERS.md) : ouvertes sur-le-champ au déblocage (openAchievementBox()). PO = fourchette
    // `goldBase` × (1 + perFloor × étage) × `goldMult` du palier.
    achievementBoxes: {
        goldBase: { min: 10, max: 25, perFloor: 0.15 },
        bronze: { goldChance: 60 },                                  // sinon une potion
        silver: { itemChance: 50, goldChance: 30, goldMult: 2 },     // sinon 2 potions
        gold: { goldMult: 3 }                                        // objet Rare+ garanti ET PO ×3
    },

    // Réserve d'équipement (armes/armures/armes à distance — consommables et parchemins jamais
    // comptés, voir addLoot()) : valeur de départ à playtester, centralisée ici plutôt qu'en dur sur
    // gameState.maxInventory (voir son initialisation ci-dessous).
    inventory: {
        maxEquipment: 8
    },

    // Parité magie/arme (chantier "QoL/équilibrage" — voir attackMagic()) : le mana achète la
    // flexibilité (mêlée/distance sans changer d'équipement), pas un surplus de dégâts par rapport à
    // l'arme équivalente ; le backfire reste le prix du chaos, plus punitif à haut niveau qu'avant
    // pour continuer à justifier ce risque une fois la compétence Magie montée. Valeurs de départ, à
    // ajuster par playtest (voir NOTES_COMBAT.md pour la mesure de parité qui a produit ces chiffres).
    // Rééquilibrage du début de partie (chantier 15, voir NOTES_DEBUT_DE_PARTIE.md) : l'émission protège ses débutants. Valeurs validées
    // par l'utilisateur (rounds 1 et 2), calibrées par `npm run sim:early`. `enabled: false` rend le jeu tel qu'avant le chantier (sert
    // aussi au « avant » de l'outil de calibrage). Rien ne lit encore ce bloc au lot 0 : les lots 1 à 4 branchent un mécanisme chacun.
    // Écran plein écran d'entrée en combat (chantier 16) : interrupteur global (un futur réglage joueur pourra le couper) ;
    // neutralisé par défaut dans les tests (_helpers.js), réactivé par withEncounterIntro().
    encounterIntro: { enabled: true },
    // Attaque furtive (chantier 16, lot 3) : deux départs au choix. Corps à corps = écart 0, premier coup ×2 ; de loin = écart 6,
    // premier coup ×1,5 (arme à distance ou sort offensif à distance requis) ; surgir au contact d'un mob À DISTANCE lui fait perdre son
    // premier tour. Valeurs validées par l'utilisateur.
    sneakAttack: { meleeMult: 2, rangedMult: 1.5, rangedStartDistance: 6, rangedMobSurprised: true },
    earlyGame: {
        enabled: true,
        maxFloor: 3,                                        // « tutoriel » : Période d'essai, Armure de scénario et boss intérimaires s'éteignent à l'étage 4
        elites: { freeFloors: 2, damageRamp: { 3: 1.3, 4: 1.5 } }, // Convention collective : aucune élite aux étages 1-2 ; eliteDamageMult ×1,3 / ×1,5 aux étages 3-4 (puis inchangé)
        interimBoss: { hpMult: 0.75, atkMult: 0.75 },       // Remplaçant intérimaire : PV et ATQ des boss des étages 1-3 (DEF inchangée)
        trial: { startReduction: 0.40, fadeLevel: 7 },      // Période d'essai : −40 % de dégâts subis au niveau 1, dégressif jusqu'à 0 au niveau 7
        plotArmor: { enabled: true, leaveHp: 1 }            // Armure de scénario : un coup mortel laisse ce nombre de PV, 1 fois par étage (`enabled` : interrupteur propre au mécanisme, voir tests/regression/_helpers.js)
    },

    // Buff de départ du crawler sans arme (chantier 14) : voir starterBuffInfo()/endStarterBuff().
    starterBuff: {
        damageTakenMult: 1.05,   // 'desperate' : tous les dégâts subis (mobs, boss, pièges, saignement)
        unarmedMult: 2,          // 'desperate' : attaque Mains nues, Étrangler et Charge à mains nues
        boxerUnarmedMult: 1.25,  // 'boxer' (évolution à l'étage 2) : mêmes attaques, définitif
        evolveFloor: 2
    },
    // Passifs de race (chantier 13, lot 1) : valeurs de départ à playtester. Une clé absente = neutre. Lues par originRaceEffects().
    origins: {
        // Passifs de classe et capacités actives (chantier 13, lot 3) : valeurs de départ à playtester. Lus par originClassEffects().
        classes: {
            brawler: { unarmedMult: 1.15, abilityMult: 2, stunTurns: 1 },
            duelist: { weaponMult: 1.10, abilityMult: 1.8, abilityDefIgnore: 0.5 },
            gunslinger: { rangedMult: 1.10, shots: 2, shotMult: 0.8 },
            occultist: { manaCostMult: 0.9, abilityMult: 1.6 },
            trickster: { stealthLevels: 1, dodgeTurns: 1, nextAttackMult: 2 },
            punchingBag: { maxHpMult: 1.10, braceDefMult: 2, reflectPct: 0.5 }
        },
        // Synergies race × classe (clé « race+classe », voir ORIGIN_SYNERGIES) : chaque champ REMPLACE celui de la classe quand il existe.
        synergies: {
            'troll+brawler': { stunTurns: 2, bossExposed: true },
            'elf+occultist': { abilityMult: 1.8, manaRefund: 20 },
            'goblin+trickster': { dodgeTurns: 2 },
            'dwarf+punchingBag': { reflectPct: 0.75 }
        },
        chooseFloor: 3, // étage d'arrivée où s'ouvrent les deux écrans de choix
        races: {
            human: { xpMult: 1.10, extraReserve: 1 },
            ghoul: { maxHpMult: 1.20, bleedMult: 0.5, healMult: 0.8 },
            goblin: { stealthPts: 10, fleePts: 15, trapMult: 0.75, maxHpMult: 0.90 },
            troll: { maxHpMult: 1.25, unarmedMult: 1.15, stealthPts: -10 },
            elf: { maxManaMult: 1.25, spellMult: 1.10, backfirePts: -3, defFlat: -1 },
            dwarf: { defMult: 1.12, armorMult: 1.15, fleePts: -15 },
            roach: { maxHpMult: 0.85, lastStand: true }
        }
    },
    magicBalance: {
        atkBase: 1.1,
        atkPerLevel: 0.015,
        backfireBase: 15,
        backfirePerLevel: -1.5,
        backfireMin: 3,
        // Glyphe réussi (chantier 6, minigames.js) : le sort offensif est renforcé — dégâts ×1,25 et risque de raté
        // divisé par 2. Un glyphe raté, passé ou résolu en jet automatique n'a aucun effet (sort normal, jamais de malus).
        glyphDamageMult: 1.25,
        glyphBackfireMult: 0.5
    },

    // Budget temps par étage (chantier "QoL/équilibrage" — voir advanceToNextFloor()) : grandit avec
    // la profondeur plutôt qu'un plafond fixe, pour réduire les morts "sans avoir vu l'escalier" sur
    // les étages tardifs (mobs/distances plus coûteux) sans supprimer la pression du temps. Valeur de
    // départ, à ajuster par playtest.
    floorTimeBudget: {
        base: 130,
        perFloor: 5
    }
};

// Réserve d'équipement (Chantier B, "QoL/équilibrage") : valeur réelle posée ici, juste après la
// déclaration de config (gameState est déclaré AVANT config plus haut dans ce fichier, donc son
// littéral ne peut pas référencer config.inventory.maxEquipment directement).
gameState.maxInventory = config.inventory.maxEquipment;
// Budget temps du tout premier étage (Chantier E, "QoL/équilibrage") : même contrainte d'ordre —
// advanceToNextFloor() recalcule ensuite maxTime à chaque changement d'étage (formule composée avec
// la profondeur), cette ligne ne pose que la valeur de DÉPART, avant tout advanceToNextFloor().
gameState.maxTime = config.floorTimeBudget.base;
gameState.timeLeft = gameState.maxTime;

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
    goldFind: [
        "Le portefeuille d'un crawler moins chanceux que vous.",
        "Quelques pièces coincées entre deux dalles descellées.",
        "Une caisse de pourboires, visiblement oubliée par le personnel d'entretien.",
        "Le Donjon verse une prime de participation. Modique, mais c'est le geste qui compte."
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
        armor: [
            "Protection garantie contre la pluie fine. Pour le reste, le Donjon décline toute responsabilité.",
            "Le sponsor l'a trouvée dans une benne. Il a tenu à préciser : une benne PREMIUM.",
            "Norme de sécurité respectée : la norme de 1987, abrogée depuis.",
            "Ça vous protège un peu. Surtout de l'envie de vous en séparer, tant personne n'en voudrait."
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
    hpBar: document.getElementById('hp-bar'),
    hpText: document.getElementById('hp-text'),
    xpBarMini: document.getElementById('xp-bar-mini'),
    xpTextMini: document.getElementById('xp-text-mini'),
    bottomNav: document.getElementById('bottom-nav'),
    navEquipment: document.getElementById('nav-equipment'),
    navBag: document.getElementById('nav-bag'),
    navBagCount: document.getElementById('nav-bag-count'),
    navBagDot: document.getElementById('nav-bag-dot'),
    navSpellbook: document.getElementById('nav-spellbook'),
    navSpellbookDot: document.getElementById('nav-spellbook-dot'),
    equipmentSheet: document.getElementById('equipment-sheet'),
    bagSheet: document.getElementById('bag-sheet'),
    spellbookSheet: document.getElementById('spellbook-sheet'),
    equippedSpellSheet: document.getElementById('equipped-spell-sheet'),
    playerAtk: document.getElementById('player-atk'),
    playerDef: document.getElementById('player-def'),
    playerGold: document.getElementById('player-gold'),
    // Scène d'exploration (remplace l'ancienne carte à jouer, voir setSceneHeader()) : vignette,
    // emoji de repli, type, titre et dernière ligne du journal.
    exploreStage: document.getElementById('explore-stage'),
    exploreScene: document.getElementById('explore-scene'),
    sceneTypeLabel: document.getElementById('explore-type-label'),
    sceneIcon: document.getElementById('explore-icon'),
    sceneTitle: document.getElementById('explore-title'),
    sceneLastLine: document.getElementById('explore-last-line'),
    btnToggleMap: document.getElementById('btn-toggle-map'),
    screenFxOverlay: document.getElementById('screen-fx-overlay'),
    gameMain: document.getElementById('game-main'),
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
    stairAlertBanner: document.getElementById('stair-alert-banner'),
    inventoryCount: document.getElementById('inventory-count'),
    consumableQuickbar: document.getElementById('consumable-quickbar'),
    inventoryEquipmentCards: document.getElementById('inventory-equipment-cards'),
    inventoryConsumablesIcons: document.getElementById('inventory-consumables-icons'),
    equippedWeapon: document.getElementById('equipped-weapon'),
    equippedArmor: document.getElementById('equipped-armor'),
    equippedArmorBadges: document.getElementById('equipped-armor-badges'),
    playerStatusIcons: document.getElementById('player-status-icons'),
    combatLastAction: document.getElementById('combat-last-action'),
    combatMobInfo: document.getElementById('combat-mob-info'),
    enemyStatusIcons: document.getElementById('enemy-status-icons'),
    combatEnemyDie: document.getElementById('combat-enemy-die'),
    combatPlayerStatus: document.getElementById('combat-player-status'),
    combatPlayerDie: document.getElementById('combat-player-die'),
    // Ancres des chiffres de dégâts flottants, placées sur chaque combattant par scene.js.
    sceneMobAnchor: document.getElementById('scene-mob-anchor'),
    sceneCrawlerAnchor: document.getElementById('scene-crawler-anchor'),
    advanceHint: document.getElementById('advance-hint'),
    bossChoiceZone: document.getElementById('boss-choice-zone'),
    stairsChoiceZone: document.getElementById('stairs-choice-zone'),
    btnDescendStairs: document.getElementById('btn-descend-stairs'),
    btnStayOnFloor: document.getElementById('btn-stay-on-floor'),
    btnFightBoss: document.getElementById('btn-fight-boss'),
    btnRetreatBoss: document.getElementById('btn-retreat-boss'),
    safehouseChoiceZone: document.getElementById('safehouse-choice-zone'),
    btnNapSafehouse: document.getElementById('btn-nap-safehouse'),
    btnSleepSafehouse: document.getElementById('btn-sleep-safehouse'),
    btnLeaveSafehouse: document.getElementById('btn-leave-safehouse'),
    stealthChoiceZone: document.getElementById('stealth-choice-zone'),
    encounterOverlay: document.getElementById('encounter-overlay'),
    encounterModeSelect: document.getElementById('encounter-mode-select'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    btnVoiceToggle: document.getElementById('btn-voice-toggle'),
    btnOpenSoundLab: document.getElementById('btn-open-sound-lab'),
    soundLabOverlay: document.getElementById('sound-lab-overlay'),
    soundLabList: document.getElementById('sound-lab-list'),
    btnCloseSoundLab: document.getElementById('btn-close-sound-lab'),
    encounterArt: document.getElementById('encounter-art'),
    encounterImg: document.getElementById('encounter-img'),
    encounterTitle: document.getElementById('encounter-title'),
    encounterLine: document.getElementById('encounter-line'),
    encounterHint: document.getElementById('encounter-hint'),
    encounterBanner: document.getElementById('encounter-banner'),
    btnStealthEvade: document.getElementById('btn-stealth-evade'),
    btnStealthAttack: document.getElementById('btn-stealth-attack'),
    btnStealthRanged: document.getElementById('btn-stealth-ranged'),
    gameOverOverlay: document.getElementById('game-over-overlay'),
    gameOverReason: document.getElementById('game-over-reason'),
    gameOverFloor: document.getElementById('game-over-floor'),
    gameOverLevel: document.getElementById('game-over-level'),
    gameOverDistrict: document.getElementById('game-over-district'),
    gameOverEpitaph: document.getElementById('game-over-epitaph'),
    gameOverAchievements: document.getElementById('game-over-achievements'),
    winAchievements: document.getElementById('win-achievements'),
    achievementToast: document.getElementById('achievement-toast'),
    bountyStatus: document.getElementById('bounty-status'),
    showZone: document.getElementById('show-zone'),
    minigameStrip: document.getElementById('minigame-strip'),
    minigameTitle: document.getElementById('minigame-title'),
    minigameHint: document.getElementById('minigame-hint'),
    minigameTimerBar: document.getElementById('minigame-timer-bar'),
    minigameBody: document.getElementById('minigame-body'),
    minigameSkip: document.getElementById('minigame-skip'),
    minigameBanner: document.getElementById('minigame-banner'),
    minigameModeSelect: document.getElementById('minigame-mode-select'),
    btnDevMinigame: document.getElementById('btn-dev-minigame'),
    showHost: document.getElementById('show-host'),
    showTaunt: document.getElementById('show-taunt'),
    showPopularity: document.getElementById('show-popularity'),
    showButtons: {
        polite: document.getElementById('btn-show-polite'),
        retort: document.getElementById('btn-show-retort'),
        provoke: document.getElementById('btn-show-provoke'),
        insult: document.getElementById('btn-show-insult')
    },
    btnShowRefuse: document.getElementById('btn-show-refuse'),
    achievementsCount: document.getElementById('achievements-count'),
    btnAchievements: document.getElementById('btn-achievements'),
    achievementsOverlay: document.getElementById('achievements-overlay'),
    achievementsList: document.getElementById('achievements-list'),
    achievementsTitleCount: document.getElementById('achievements-title-count'),
    btnCloseAchievements: document.getElementById('btn-close-achievements'),
    btnRestart: document.getElementById('btn-restart'),
    winOverlay: document.getElementById('win-overlay'),
    winFloor: document.getElementById('win-floor'),
    winLevel: document.getElementById('win-level'),
    btnWinRestart: document.getElementById('btn-win-restart'),
    floorTransitionOverlay: document.getElementById('floor-transition-overlay'),
    floorTransitionTitle: document.getElementById('floor-transition-title'),
    floorTransitionMobs: document.getElementById('floor-transition-mobs'),
    floorTransitionDamage: document.getElementById('floor-transition-damage'),
    floorTransitionItems: document.getElementById('floor-transition-items'),
    floorTransitionXp: document.getElementById('floor-transition-xp'),
    floorTransitionAnomaly: document.getElementById('floor-transition-anomaly'),
    floorTransitionAnomalyText: document.getElementById('floor-transition-anomaly-text'),
    btnFloorTransitionContinue: document.getElementById('btn-floor-transition-continue'),
    anomalyStatusBar: document.getElementById('anomaly-status-bar'),
    starterBuffStatus: document.getElementById('starter-buff-status'),
    trialStatus: document.getElementById('trial-status'),
    raceStatus: document.getElementById('race-status'),
    classStatus: document.getElementById('class-status'),
    raceChoiceOverlay: document.getElementById('race-choice-overlay'),
    classChoiceOverlay: document.getElementById('class-choice-overlay'),
    raceChoiceCards: document.getElementById('race-choice-cards'),
    classChoiceCards: document.getElementById('class-choice-cards'),
    btnRaceConfirm: document.getElementById('btn-race-confirm'),
    btnClassConfirm: document.getElementById('btn-class-confirm'),
    pactChoiceOverlay: document.getElementById('pact-choice-overlay'),
    btnPactAtk: document.getElementById('btn-pact-atk'),
    btnPactHp: document.getElementById('btn-pact-hp'),
    combatZone: document.getElementById('combat-zone'),
    floorMapOverlay: document.getElementById('floor-map-overlay'),
    floorMapSvg: document.getElementById('floor-map-svg'),
    floorMapLegend: document.getElementById('floor-map-legend'),
    floorMapBubble: document.getElementById('floor-map-bubble'),
    floorMapBubbleTitle: document.getElementById('floor-map-bubble-title'),
    floorMapBubbleText: document.getElementById('floor-map-bubble-text'),
    btnFloorMapGo: document.getElementById('btn-floor-map-go'),
    btnFloorMapCancel: document.getElementById('btn-floor-map-cancel'),
    btnFloorMapZoomIn: document.getElementById('btn-floor-map-zoom-in'),
    btnFloorMapZoomOut: document.getElementById('btn-floor-map-zoom-out'),
    btnFloorMapRecenter: document.getElementById('btn-floor-map-recenter'),
    companionChoiceFriendly: document.getElementById('companion-choice-friendly'),
    companionChoiceHostile: document.getElementById('companion-choice-hostile'),
    btnRecruitFriendly: document.getElementById('btn-recruit-friendly'),
    btnDeclineCompanion: document.getElementById('btn-decline-companion'),
    btnFleeCompanion: document.getElementById('btn-flee-companion'),
    btnRecruitHostile: document.getElementById('btn-recruit-hostile'),
    btnAttackCompanion: document.getElementById('btn-attack-companion'),
    shopZone: document.getElementById('shop-zone'),
    shopMerchantContent: document.getElementById('shop-merchant-content'),
    shopTrainerContent: document.getElementById('shop-trainer-content'),
    shopStockList: document.getElementById('shop-stock-list'),
    shopSellList: document.getElementById('shop-sell-list'),
    shopSellSpellsList: document.getElementById('shop-sell-spells-list'),
    shopTrainerInfo: document.getElementById('shop-trainer-info'),
    btnTrainSkill: document.getElementById('btn-train-skill'),
    btnLeaveShop: document.getElementById('btn-leave-shop'),
    shopArcadeContent: document.getElementById('shop-arcade-content'),
    arcadeStake: document.getElementById('arcade-stake'),
    arcadeStakeInfo: document.getElementById('arcade-stake-info'),
    arcadeGames: document.getElementById('arcade-games'),
    arcadeRounds: document.getElementById('arcade-rounds'),
    arcadeMessage: document.getElementById('arcade-message'),
    lairChoiceZone: document.getElementById('lair-choice-zone'),
    btnDiveLair: document.getElementById('btn-dive-lair'),
    btnDeclineLair: document.getElementById('btn-decline-lair'),
    companionStatusBar: document.getElementById('companion-status-bar'),
    companionNameDisplay: document.getElementById('companion-name-display'),
    companionSpecialtyDisplay: document.getElementById('companion-specialty-display'),
    companionLoyaltyBar: document.getElementById('companion-loyalty-bar'),
    companionHpDisplay: document.getElementById('companion-hp-display'),
    companionInfoFriendly: document.getElementById('companion-info-friendly'),
    companionInfoHostile: document.getElementById('companion-info-hostile'),
    companionCombatIndicator: document.getElementById('companion-combat-indicator'),
    companionCombatName: document.getElementById('companion-combat-name'),
    companionCombatHpRing: document.getElementById('companion-combat-hp-ring'),
    companionCombatHp: document.getElementById('companion-combat-hp'),
    enemyName: document.getElementById('enemy-name'),
    telegraphBanner: document.getElementById('telegraph-banner'),
    phaseTransitionBanner: document.getElementById('phase-transition-banner'),
    bossPhaseBadge: document.getElementById('boss-phase-badge'),
    btnAttackWeapon: document.getElementById('btn-attack-weapon'),
    btnAttackRanged: document.getElementById('btn-attack-ranged'),
    btnAttackUnarmed: document.getElementById('btn-attack-unarmed'),
    btnAttackMagic: document.getElementById('btn-attack-magic'),
    btnSprint: document.getElementById('btn-sprint'),
    btnRetreat: document.getElementById('btn-retreat'),
    btnEngage: document.getElementById('btn-engage'),
    btnOccasion: document.getElementById('btn-occasion'),
    btnClassAbility: document.getElementById('btn-class-ability'),
    finisherCinema: document.getElementById('finisher-cinema'),
    finisherCinemaText: document.getElementById('finisher-cinema-text'),
    btnFlee: document.getElementById('btn-flee'),
    distanceTensionLabel: document.getElementById('distance-tension-label'),
    equippedRanged: document.getElementById('equipped-ranged'),
    btnDevTestKit: document.getElementById('btn-dev-testkit'),
    btnDevJumpUrban: document.getElementById('btn-dev-jump-urban'),
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
    versionLabel: document.getElementById('version-label'),
    btnStartConfirm: document.getElementById('btn-start-confirm'),
    btnOpenManageSaves: document.getElementById('btn-open-manage-saves'),
    manageSavesOverlay: document.getElementById('manage-saves-overlay'),
    manageSavesList: document.getElementById('manage-saves-list'),
    manageSavesConfirm: document.getElementById('manage-saves-confirm'),
    manageSavesConfirmText: document.getElementById('manage-saves-confirm-text'),
    btnManageSavesConfirmYes: document.getElementById('btn-manage-saves-confirm-yes'),
    btnManageSavesConfirmNo: document.getElementById('btn-manage-saves-confirm-no'),
    btnManageSavesDeleteAll: document.getElementById('btn-manage-saves-delete-all'),
    btnManageSavesRestoreBackup: document.getElementById('btn-manage-saves-restore-backup'),
    btnManageSavesClose: document.getElementById('btn-manage-saves-close'),
    giftRevealOverlay: document.getElementById('gift-reveal-overlay'),
    giftRevealIcon: document.getElementById('gift-reveal-icon'),
    giftRevealTitle: document.getElementById('gift-reveal-title'),
    giftRevealItemName: document.getElementById('gift-reveal-item-name'),
    giftRevealJoke: document.getElementById('gift-reveal-joke'),
    btnGiftContinue: document.getElementById('btn-gift-continue'),
    // Inspection d'un objet (voir openItemInspect())
    itemInspectOverlay: document.getElementById('item-inspect-overlay'),
    itemInspectPanel: document.getElementById('item-inspect-panel'),
    itemInspectBody: document.getElementById('item-inspect-body'),
    itemInspectActions: document.getElementById('item-inspect-actions'),
    inventoryMax: document.getElementById('inventory-max')
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
    gameState.lastSavedAt = Date.now();
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

// Rogue-like : un crawler mort ne se restaure jamais. Une sauvegarde à 0 PV (mort pendant une partie, ou
// sauvegarde écrite avant ce correctif, qui se restaurait vivante à 0 PV) est simplement effacée — sans
// copie dans le slot de secours (SAVE_BACKUP_KEY) : une copie d'un crawler mort ne serait jamais jouable,
// et elle écraserait le backup d'un nettoyage manuel.
function isDeadSave(saved) {
    return !!saved && typeof saved.hp === 'number' && saved.hp <= 0;
}

// Efface la sauvegarde de `name` si c'est celle d'un crawler mort ; renvoie true si elle a été effacée.
function eraseDeadSaveForName(name) {
    if (!name || !name.trim()) return false;
    try {
        const key = saveKeyForName(name);
        const raw = localStorage.getItem(key);
        if (raw === null) return false;
        let saved = null;
        try { saved = JSON.parse(raw); } catch (e) { return false; }
        if (!isDeadSave(saved)) return false;
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

// À la mort (gameOver()) : la sauvegarde du crawler est effacée et l'autosauvegarde coupée, pour que
// retaper son nom lance un nouveau crawler plutôt qu'un cadavre à 0 PV.
function eraseSaveOnDeath() {
    if (!gameState.saveEnabled || !gameState.playerName) return;
    gameState.saveEnabled = false;
    try {
        localStorage.removeItem(saveKeyForName(gameState.playerName));
    } catch (e) {
        // Stockage indisponible : rien à effacer
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
    if (isDeadSave(saved)) return false; // Crawler mort : jamais restauré (voir eraseDeadSaveForName())

    // Migration douce : une sauvegarde antérieure au système d'anomalies (Tâche 4) n'a pas
    // baseMaxHp — son maxHp EST alors la vraie base (aucun multiplicateur d'anomalie n'a jamais pu
    // s'y appliquer). anomalyEffects/activeAnomalies n'ont pas besoin de migration explicite : Object.assign
    // ne touche pas les clés absentes de `saved`, qui gardent donc leurs valeurs neutres déjà posées à
    // l'initialisation de gameState.
    const needsBaseMaxHpMigration = saved.baseMaxHp === undefined;
    // Sauvegarde en plein étage urbain d'avant les villes explorables (chantier 12) : ancien réseau
    // gameState.urbanMap, regénéré plus bas au nouveau format (même numéro d'étage).
    const legacyUrbanFloor = !!saved.urbanMap;

    Object.assign(gameState, saved);
    // Champs de l'ancien réseau urbain (chantier 12) : n'existent plus.
    ['urbanMap', 'pendingUrbanTravel', 'pendingUrbanBossEncounter', 'pendingUrbanBossCityId', 'pendingUrbanAdvanceAfterCombat']
        .forEach(key => { delete gameState[key]; });
    if (needsBaseMaxHpMigration) gameState.baseMaxHp = saved.maxHp || gameState.maxHp;
    // Champs de crawler absents d'une ancienne sauvegarde : jamais ceux du crawler précédemment chargé dans cette page (Object.assign ne les écrase pas).
    if (saved.starterBuff === undefined) gameState.starterBuff = null;
    if (saved.raceLastStandFloor === undefined) gameState.raceLastStandFloor = 0;
    if (saved.plotArmorFloor === undefined) gameState.plotArmorFloor = 0;
    if (saved.eliteConventionEnded === undefined) gameState.eliteConventionEnded = (saved.currentFloor || 1) > config.earlyGame.maxFloor;
    if (!saved.race || !config.origins.races[saved.race]) gameState.race = null; // ancienne sauvegarde ou clé inconnue : aucune race
    if (!saved.crawlerClass || !ORIGIN_CLASSES[saved.crawlerClass]) gameState.crawlerClass = null;
    recomputeRaceDerived();
    // Compagnon d'une sauvegarde antérieure au rework (leaveChance, pas de loyauté ni d'équipement).
    if (gameState.companion) gameState.companion = normalizeCompanion(gameState.companion);
    // Chronique / succès (chantier 2) : complétés pour une sauvegarde antérieure ou partielle.
    gameState.runStats = normalizeRunStats(saved.runStats);
    if (!gameState.runStats.maxFloor || gameState.runStats.maxFloor < gameState.currentFloor) gameState.runStats.maxFloor = gameState.currentFloor;
    if (!gameState.achievements || typeof gameState.achievements !== 'object') gameState.achievements = {};
    // Prime (chantier 3) : complétée pour une sauvegarde antérieure ; une escouade en cours est abandonnée
    // comme tout combat (on atterrit toujours sur l'exploration).
    gameState.bounty = { ...createEmptyBounty(), ...(saved.bounty || {}) };
    gameState.pendingBountySquad = 0;
    // Émission DeathWatch en cours : abandonnée comme tout choix bloquant (celle de cet étage est perdue).
    gameState.showChoicePending = false;
    gameState.pendingShow = null;
    gameState.pendingShowAfterPact = null;
    abortMinigame(); // Mini-jeu (chantier 6) ouvert à la sauvegarde : jamais restauré
    gameState.occasion = Object.assign(createOccasionState(), { pity: (saved.occasion && saved.occasion.pity) || 0 }); // Occasion en cours : jamais restaurée, la garantie oui

    // Nettoyage de l'état transitoire/bloquant
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.combatDistance = 0;
    gameState.bossChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.stealthChoicePending = false;
    gameState.encounterIntroPending = false; // écran de rencontre (chantier 16) : jamais restauré
    gameState.pendingStealthEncounter = null;
    gameState.pendingSneakAttack = false;
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    gameState.pendingTravel = null;
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    gameState.pendingArcadeCityId = null;
    gameState.arcadeSession = null;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    gameState.pendingLairDive = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    // Choix de race/classe sauvegardé en cours : l'écran concerné est rouvert à la fin de la restauration (jamais perdu : sans lui le crawler resterait sans origine).
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    gameState.pendingPactAfterOrigin = false;
    gameState.classAbilityUsed = false;
    hideOriginOverlays();
    gameState.pendingNextFloorAnomalies = null;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    // Escalier en attente : la salle du gardien vaincu est marquée 🪜 sur la carte (listFloorLandmarks()), et une
    // ville-escalier reste sur la Carte Urbaine — le choix sera reproposé en y retournant.
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;

    // Carte d'un format antérieur (chantier 5, FLOOR_MAP_VERSION) : l'étage en cours est regénéré au nouveau
    // format (même numéro d'étage, mêmes anomalies) ; le crawler garde tout le reste.
    if (legacyUrbanFloor) {
        generateUrbanFloorMap();
        logEvent("La ville s'est réaménagée pendant votre absence : cet étage a été entièrement redessiné.", "info");
    } else if (gameState.floorMap && gameState.floorMap.version !== FLOOR_MAP_VERSION) {
        generateFloorMap();
        logEvent("Le Donjon s'est réaménagé pendant votre absence : cet étage a été entièrement redessiné.", "info");
    }

    gameState.saveEnabled = true; // Réactive l'autosave après une restauration réussie
    if (saved.classChoicePending && gameState.race) triggerClassChoice();
    else if (saved.raceChoicePending || saved.classChoicePending) triggerRaceChoice();
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
                if (saved && saved.playerName && !isDeadSave(saved)) names.push(saved.playerName);
            } catch (e) {
                // Entrée corrompue : ignorée plutôt que de faire échouer toute la liste
            }
        }
    } catch (e) {
        // localStorage indisponible : liste vide, pas d'erreur
    }
    return names;
}

// Variante détaillée de listSavedCrawlerNames() pour l'écran "Nettoyer les sauvegardes"
// (openManageSaves()) : nom, clé localStorage, étage atteint et horodatage de dernière sauvegarde.
// `floor`/`savedAt` retombent sur des valeurs neutres pour une entrée corrompue ou antérieure à
// l'ajout de `lastSavedAt` (migration douce, jamais une erreur qui casserait toute la liste).
function listSavedCrawlersDetailed() {
    const entries = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;
            try {
                const saved = JSON.parse(localStorage.getItem(key));
                if (saved && saved.playerName) {
                    entries.push({ name: saved.playerName, key, floor: saved.currentFloor || 1, savedAt: saved.lastSavedAt || null });
                }
            } catch (e) {
                // Entrée corrompue : ignorée plutôt que de faire échouer toute la liste
            }
        }
    } catch (e) {
        // localStorage indisponible : liste vide, pas d'erreur
    }
    return entries;
}

// Formatage d'affichage d'un horodatage de sauvegarde (voir listSavedCrawlersDetailed()) — "date
// inconnue" pour une sauvegarde antérieure à lastSavedAt, ou si l'environnement ne sait pas formater
// de date localisée (jamais une exception qui casserait l'écran de gestion des sauvegardes).
function formatSaveTimestamp(ts) {
    if (!ts) return "date inconnue";
    try {
        return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "date inconnue";
    }
}

// Rafraîchit l'indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames()) —
// extrait en fonction pour pouvoir être rappelé après une suppression/restauration depuis l'écran
// "Nettoyer les sauvegardes", en plus de l'appel initial au chargement du jeu.
function refreshStartSavesHint() {
    if (!ui.startSavesHint) return;
    const savedNames = listSavedCrawlerNames();
    ui.startSavesHint.classList.toggle('hidden', savedNames.length === 0);
    ui.startSavesHint.innerText = savedNames.length ? `Sauvegardes disponibles : ${savedNames.join(', ')}` : '';
}

// ==========================================
// GESTION DES SAUVEGARDES (écran de départ -> "Nettoyer les sauvegardes")
// ==========================================
// Slot de backup UNIQUE (pas un historique) : écrasé à chaque nettoyage (suppression individuelle ou
// totale), toujours au format { savedAt, entries: [{key, data}] } où `data` est le JSON brut de la
// sauvegarde (round-trip exact, sans re-sérialiser gameState). `pendingSaveDeletion` retient l'action
// en attente de confirmation ({ mode: 'single', name } ou { mode: 'all' }) — jamais de suppression
// sans passer par cet état, la confirmation est donc structurellement obligatoire.
const SAVE_BACKUP_KEY = 'crawler-save-backup';
let pendingSaveDeletion = null;

// Ouvre l'écran de gestion des sauvegardes depuis l'écran de départ.
function openManageSaves() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    updateManageSavesUI();
    if (ui.manageSavesOverlay) ui.manageSavesOverlay.classList.remove('hidden');
}

function closeManageSaves() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    if (ui.manageSavesOverlay) ui.manageSavesOverlay.classList.add('hidden');
}

// Reconstruit la liste des sauvegardes + la visibilité du bouton "Restaurer le backup" (masqué tant
// qu'aucun backup n'existe).
function updateManageSavesUI() {
    if (!ui.manageSavesList) return;
    const entries = listSavedCrawlersDetailed();

    ui.manageSavesList.innerHTML = "";
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic text-center py-2";
        empty.innerText = "Aucune sauvegarde sur cet appareil.";
        ui.manageSavesList.appendChild(empty);
    }
    entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center gap-2 px-2 py-1.5 bg-gray-950/80 border border-gray-800 rounded";
        row.innerHTML = `
            <div class="flex flex-col overflow-hidden text-left">
                <span class="text-gray-200 font-bold text-[11px] truncate">${entry.name}</span>
                <span class="text-gray-600 text-[9px]">Étage ${entry.floor} · ${formatSaveTimestamp(entry.savedAt)}</span>
            </div>
        `;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = "shrink-0 text-red-500 hover:text-red-300 text-sm px-1 transition-colors";
        deleteBtn.innerText = "🗑️";
        deleteBtn.addEventListener('click', () => requestDeleteSave(entry.name));
        row.appendChild(deleteBtn);
        ui.manageSavesList.appendChild(row);
    });

    if (ui.btnManageSavesRestoreBackup) {
        let hasBackup = false;
        try { hasBackup = localStorage.getItem(SAVE_BACKUP_KEY) !== null; } catch (e) { /* indisponible */ }
        ui.btnManageSavesRestoreBackup.classList.toggle('hidden', !hasBackup);
    }
}

// Demande confirmation avant de supprimer UNE sauvegarde (bouton 🗑️ d'une ligne).
function requestDeleteSave(name) {
    pendingSaveDeletion = { mode: 'single', name };
    if (ui.manageSavesConfirmText) {
        ui.manageSavesConfirmText.innerText = `Supprimer définitivement la sauvegarde de "${name}" ? Cette action est irréversible (un backup sera conservé, voir "Restaurer le dernier backup").`;
    }
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.remove('hidden');
}

// Demande confirmation avant de supprimer TOUTES les sauvegardes (bouton "Tout supprimer").
function requestDeleteAllSaves() {
    pendingSaveDeletion = { mode: 'all' };
    if (ui.manageSavesConfirmText) {
        ui.manageSavesConfirmText.innerText = "Supprimer DÉFINITIVEMENT toutes les sauvegardes de cet appareil ? Cette action est irréversible (un backup sera conservé, voir \"Restaurer le dernier backup\").";
    }
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.remove('hidden');
}

function cancelSaveDeletion() {
    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
}

// Exécute la suppression (individuelle ou totale) demandée, après confirmation explicite. Sauvegarde
// d'abord TOUTES les entrées concernées dans le slot de backup unique (écrase un backup précédent —
// "écrasé à chaque nettoyage"), puis les retire réellement de localStorage.
function confirmSaveDeletion() {
    if (!pendingSaveDeletion) return;
    const allEntries = listSavedCrawlersDetailed();
    const toDelete = pendingSaveDeletion.mode === 'all'
        ? allEntries
        : allEntries.filter(e => e.name === pendingSaveDeletion.name);

    if (toDelete.length > 0) {
        try {
            const backup = {
                savedAt: Date.now(),
                entries: toDelete.map(e => ({ key: e.key, data: localStorage.getItem(e.key) }))
            };
            localStorage.setItem(SAVE_BACKUP_KEY, JSON.stringify(backup));
            toDelete.forEach(e => localStorage.removeItem(e.key));
            logEvent(
                pendingSaveDeletion.mode === 'all'
                    ? `🧹 ${toDelete.length} sauvegarde(s) supprimée(s) (backup conservé).`
                    : `🧹 Sauvegarde de "${pendingSaveDeletion.name}" supprimée (backup conservé).`,
                "info"
            );
        } catch (e) {
            logEvent("Échec de la suppression (stockage indisponible).", "danger");
        }
    }

    pendingSaveDeletion = null;
    if (ui.manageSavesConfirm) ui.manageSavesConfirm.classList.add('hidden');
    updateManageSavesUI();
    refreshStartSavesHint();
}

// Restaure le backup unique (voir confirmSaveDeletion()) : réécrit chaque entrée à sa clé d'origine,
// écrasant une éventuelle sauvegarde du même nom recréée depuis. N'efface pas le backup lui-même
// (restaurable plusieurs fois de suite sans repasser par une suppression).
function restoreSavesBackup() {
    let raw;
    try {
        raw = localStorage.getItem(SAVE_BACKUP_KEY);
    } catch (e) {
        return;
    }
    if (!raw) return;

    let backup;
    try {
        backup = JSON.parse(raw);
    } catch (e) {
        return; // Backup corrompu : on ignore plutôt que de planter
    }
    if (!backup || !Array.isArray(backup.entries)) return;

    let restoredCount = 0;
    backup.entries.forEach(entry => {
        if (!entry || !entry.key || entry.data === undefined) return;
        try {
            localStorage.setItem(entry.key, entry.data);
            restoredCount++;
        } catch (e) {
            // Une entrée en échec ne doit pas bloquer les suivantes
        }
    });

    logEvent(`♻️ ${restoredCount} sauvegarde(s) restaurée(s) depuis le backup.`, "success");
    updateManageSavesUI();
    refreshStartSavesHint();
}

function updateUI() {
    applyScreenStateEffects();
    ui.playerName.innerText = gameState.playerName;
    ui.floorLevel.innerText = gameState.currentFloor;
    ui.districtName.innerText = gameState.currentDistrict;

    // Fiche du crawler sous le nom (chantier 9) : barre de PV, ATK et DEF
    setHpBar(ui.hpBar, ui.hpText, gameState.hp, gameState.maxHp);
    ui.playerAtk.innerText = gameState.atk;
    ui.playerDef.innerText = getEffectiveDef();
    if (ui.playerGold) ui.playerGold.innerText = gameState.gold;

    updateAnomalyStatusUI();
    updateStarterBuffUI();
    updateTrialStatusUI();
    updateOriginUI();

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
    if (gameState.status.manaShield && gameState.status.manaShield.rounds > 0) playerIcons += "🔰";
    ui.playerStatusIcons.innerText = playerIcons;

    // Mise à jour du niveau et de l'XP
    ui.playerLevel.innerText = gameState.level;
    ui.xpText.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    ui.xpBar.style.width = `${Math.min(100, (gameState.xp / gameState.xpToNextLevel) * 100)}%`;
    if (ui.xpBarMini) ui.xpBarMini.style.width = ui.xpBar.style.width;
    if (ui.xpTextMini) ui.xpTextMini.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    updateBottomNav();

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

    // Alerte escalier (chantier "QoL/équilibrage", Chantier E — voir NOTES_QOL_EQUILIBRAGE.md) :
    // bandeau discret sous la barre de temps dès que timeLeft/maxTime <= 25%, jamais en combat (le
    // panneau latéral PV/statut prend toute la place utile à ce moment-là, et le temps n'y est de
    // toute façon pas la ressource sur laquelle agir dans l'instant).
    if (ui.stairAlertBanner) {
        ui.stairAlertBanner.classList.toggle('hidden', timePercentage > 25 || gameState.inCombat);
    }

    // Gestion de l'affichage du combat : la scène d'exploration laisse la place à la zone de combat
    // (barres de vie, scène, boutons — voir renderScene('combat') dans scene.js pour la scène et les PV).
    if (gameState.inCombat) {
        ui.advanceHint.classList.add('hidden'); // On ne peut pas avancer pendant un combat
        ui.combatZone.classList.remove('hidden');
        ui.exploreStage.classList.add('hidden');

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
        if (gameState.status.manaShield && gameState.status.manaShield.rounds > 0) playerIcons += "🔰";
        ui.combatPlayerStatus.innerText = playerIcons;

        // Indicateur compagnon (sous la barre de vie du joueur), si un compagnon est actif
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

            renderEnemyStatusBadges(gameState.currentEnemy);

            // Badge de phase permanent (chantier "lisibilité combat", Chantier 10) : discret,
            // visible dès la phase 2 seulement (jamais en phase 1 ni sur un mob normal/élite —
            // la bannière de transition suffit pour l'ANNONCE, ce badge est le rappel permanent).
            if (ui.bossPhaseBadge) {
                const phase = gameState.currentEnemy.isBoss ? getBossPhase(gameState.currentEnemy) : 1;
                if (gameState.currentEnemy.isBoss && phase >= 2) {
                    ui.bossPhaseBadge.innerText = `Phase ${phase}`;
                    ui.bossPhaseBadge.classList.remove('hidden');
                } else {
                    ui.bossPhaseBadge.classList.add('hidden');
                }
            }
        }
        renderDistanceTension(gameState.currentEnemy);
        updateTelegraphBanner();

        // --- Distance de combat : verrouille/déverrouille Arme, Tir et Mains nues selon l'écart
        // actuel (0 = corps à corps possible, >0 = seul le Tir porte). Aucune notion de posture : ces
        // règles ne dépendent que de l'écart courant et de l'équipement.
        const distance = gameState.combatDistance || 0;
        const atMelee = distance <= 0;
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
                const spellDistanceOk = spell.spellCategory === 'any' || (spell.spellCategory === 'melee' ? atMelee : !atMelee);
                magicUsable = spellDistanceOk && gameState.mana >= getSpellManaCost(spell);
            }
            ui.btnAttackMagic.disabled = !magicUsable;
            ui.btnAttackMagic.classList.toggle('opacity-40', !magicUsable);
            ui.btnAttackMagic.classList.toggle('pointer-events-none', !magicUsable);
            ui.btnAttackMagic.innerHTML = spell
                ? `${spell.icon || '✨'} ${spell.spellName}<span class="block text-[8px] normal-case opacity-70">🔷 ${getSpellManaCost(spell)}</span>`
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
        // Charger (attemptEngage(), Chantier 3) : même disponibilité que S'approcher (un écart à
        // combler), alternative agressive qui enchaîne une attaque bonus au lieu d'un simple
        // repositionnement.
        if (ui.btnEngage) {
            const engageUsable = !!gameState.currentEnemy && distance > 0;
            ui.btnEngage.disabled = !engageUsable;
            ui.btnEngage.classList.toggle('opacity-40', !engageUsable);
            ui.btnEngage.classList.toggle('pointer-events-none', !engageUsable);
        }
        rollCombatOccasion(); // Une fois par tour (chantier 6, V2)
        updateOccasionButton();
        updateClassAbilityUI();
        // Un mob "alerted" (échec de furtivité, voir attemptStealthEvasion()) ne laisse plus fuir.
        if (ui.btnFlee) {
            const fleeUsable = !gameState.currentEnemy || !gameState.currentEnemy.alerted;
            ui.btnFlee.disabled = !fleeUsable;
            ui.btnFlee.classList.toggle('opacity-40', !fleeUsable);
            ui.btnFlee.classList.toggle('pointer-events-none', !fleeUsable);
        }
    } else {
        // Consigne sous la scène (explorer), inutile pendant un choix en attente.
        ui.advanceHint.classList.toggle('hidden', isActionBlocked());
        ui.advanceHint.innerText = "👆 Touchez la scène pour explorer (-1H)";
        if (ui.exploreScene) ui.exploreScene.setAttribute('aria-label', "Explorer (-1H)");
        updateOccasionButton();
        ui.combatZone.classList.add('hidden');
        ui.exploreStage.classList.remove('hidden');
        // Salle sécurisée et ville spécialisée ont leur propre scène (au-dessus de leurs boutons) : la
        // scène d'exploration s'efface alors, seuls son titre et la dernière ligne restent.
        if (ui.exploreScene) ui.exploreScene.classList.toggle('hidden', !!(gameState.safehouseChoicePending || gameState.shopChoicePending));
        updateCompanionUI(); // Réaffiche/actualise la barre compagnon compacte hors combat
    }

    // Scène de combat en vue latérale (scene.js) : seul point d'entrée de son rendu.
    renderScene('combat');
    renderScene('crawlers'); // posture/équipement du crawler dans les scènes hors combat

    // La carte de l'étage (carte stylisée #floor-map-overlay, chantier 5, étages classiques ET urbains) est un
    // panneau sous la scène, ouvert/fermé par #btn-toggle-map (ouvert par défaut, mapPanelOpen). Elle se masque,
    // avec son bouton, dès qu'une "situation" est en cours (combat/boss/furtivité/compagnon, voir
    // isActionBlocked()) : la scène montre alors la situation.
    const mapAvailable = !!gameState.floorMap && !isActionBlocked();
    if (ui.floorMapOverlay) ui.floorMapOverlay.classList.toggle('hidden', !mapAvailable || !gameState.floorMap || !mapPanelOpen);
    if (ui.btnToggleMap) {
        ui.btnToggleMap.classList.toggle('hidden', !mapAvailable);
        ui.btnToggleMap.innerText = mapPanelOpen ? "✕ Fermer la carte" : "🗺️ Carte";
        ui.btnToggleMap.setAttribute('aria-expanded', mapPanelOpen ? 'true' : 'false');
    }

    // La carte suit la position courante : rafraîchie à chaque rendu.
    updateFloorMapUI();

    // Autosauvegarde (no-op tant que gameState.saveEnabled est faux, voir confirmPlayerName() /
    // restoreSaveForName()) : updateUI() est déjà appelée après quasiment toute action modifiant
    // l'état, donc un seul point d'accroche suffit à couvrir toute la boucle de jeu.
    updateAchievementsButton(); // Compteur 🏆 X/N de l'en-tête (chantier 2)
    updateBountyUI(); // Badge 🎯 de la prime (chantier 3)
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
// Barre de PV horizontale de la fiche du crawler (chantier 9) : même code couleur que l'anneau (hpColor()).
function setHpBar(barEl, textEl, current, max) {
    if (!barEl) return;
    const safeMax = max > 0 ? max : 1;
    const pct = Math.max(0, Math.min(1, current / safeMax));
    barEl.style.width = `${pct * 100}%`;
    barEl.style.background = hpColor(pct);
    if (textEl) textEl.innerText = `${Math.max(0, Math.round(current))}/${Math.round(max)}`;
}

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

// Hiérarchie visuelle des impacts (chantier "lisibilité combat", Chantier 4) : secousse de l'écran,
// réservée aux moments qui doivent se distinguer d'un coup normal EN UNE MICROSECONDE (voir
// triggerHeavyImpact() ci-dessous pour la liste exacte). JAMAIS pour une frappe normale.
function screenShake() {
    if (!ui.gameMain) return;
    ui.gameMain.classList.remove('screen-shake');
    void ui.gameMain.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    ui.gameMain.classList.add('screen-shake');
}

// Flash bref sur #screen-fx-overlay, même occasions que screenShake() — voir le commentaire CSS de
// .fx-impact-flash (index.html) pour le compromis assumé avec les classes de statut joueur déjà en
// place sur ce même nœud.
function screenImpactFlash() {
    if (!ui.screenFxOverlay) return;
    ui.screenFxOverlay.classList.remove('fx-impact-flash');
    void ui.screenFxOverlay.offsetWidth;
    ui.screenFxOverlay.classList.add('fx-impact-flash');
}

// Point d'appel UNIQUE pour les deux effets ci-dessus : exécution d'un télégraphe heavy, ruée
// d'enrage et chaque frappe de phase 3 (les 3 via le flag `heavy` d'executeBossStrike(), déjà posé au
// Chantier 3) et la mort du joueur (gameOver()). Sous prefers-reduced-motion, screenShake() devient un
// no-op visuel (animation désactivée en CSS) mais screenImpactFlash() continue de jouer, comme demandé
// explicitement par la consigne.
function triggerHeavyImpact() {
    if (typeof playSfx === 'function') playSfx('heavyImpact');
    screenShake();
    screenImpactFlash();
}

// Anime un dé de dégâts qui "vole" vers la barre de vie de sa cible, façon petit coup de poing.
// `direction` : 'left' (le dé du joueur vole vers les PV ennemis, à gauche) ou 'right' (le dé de
// l'ennemi vole vers les PV du joueur, à droite). Les PV sont déjà décrémentés avant l'appel : au
// moment de l'impact (environ à mi-vol du dé), la scène et les barres de vie sont redessinées pour
// que la barre baisse au même instant, même au milieu d'une séquence de coups (voir runCombatBeats()).
function animateDieHit(dieEl, direction, value) {
    dieEl.innerText = value;
    dieEl.classList.remove('die-pop', 'die-hit-left', 'die-hit-right');
    void dieEl.offsetWidth;
    dieEl.classList.add('die-pop', direction === 'left' ? 'die-hit-left' : 'die-hit-right');

    setTimeout(() => {
        renderScene('combat');
        triggerHaptic('light');
    }, 180);
}

// Décalage horizontal (±8px) des chiffres flottants, pour que deux chiffres quasi simultanés (un
// multi-coups par exemple) ne se superposent pas exactement. Volontairement PAS Math.random() :
// cette fonction est appelée à chaque point de dégâts réel, donc consommer le flux aléatoire partagé
// y désynchroniserait les séquences Math.random fixes de nombreux tests existants
// (tests/regression/*.js) qui n'ont rien à voir avec cet effet purement cosmétique. Un compteur qui
// boucle sur un petit jeu de décalages est tout aussi efficace visuellement et ne touche à rien.
const FLOATING_DAMAGE_OFFSETS = [-7, 6, -3, 8, -8, 3, -5, 7];
let floatingDamageOffsetIndex = 0;

// Taille des chiffres de dégâts selon la PART des PV max de la cible touchée (pas le montant brut : les
// dégâts grossissent avec les étages, un « 40 » énorme à l'étage 1 est banal à l'étage 12). Linéaire
// entre `minRatio` (et en dessous : `minPx`) et `maxRatio` (et au-delà : `maxPx`) ; un coup lourd
// ajoute `heavyBonusPx`, sans jamais dépasser `maxPx`. `pop` : grossissement au sommet de l'animation,
// plus marqué pour un gros coup (coupé sous prefers-reduced-motion, qui ne garde que la taille).
const FLOATING_DAMAGE_SIZE = { minPx: 13, maxPx: 28, minRatio: 0.03, maxRatio: 0.40, heavyBonusPx: 3, popMin: 1.08, popMax: 1.3 };
function floatingDamageScale(amount, maxHp, heavy = false) {
    const cfg = FLOATING_DAMAGE_SIZE;
    const ratio = maxHp > 0 ? amount / maxHp : 0;
    const t = Math.max(0, Math.min(1, (ratio - cfg.minRatio) / (cfg.maxRatio - cfg.minRatio)));
    const fontPx = Math.min(cfg.maxPx, Math.round(cfg.minPx + t * (cfg.maxPx - cfg.minPx) + (heavy ? cfg.heavyBonusPx : 0)));
    const pop = Math.round((cfg.popMin + t * (cfg.popMax - cfg.popMin)) * 100) / 100;
    return { fontPx, pop };
}

// Chiffre de dégâts flottant (chantier "lisibilité combat", Chantier 3) : un chiffre par impact,
// monte et s'estompe au-dessus du combattant touché (ancres #scene-mob-anchor/#scene-crawler-anchor,
// placées sur chaque silhouette par scene.js — le chiffre s'ajoute EN PLUS du dé qui vole déjà,
// jamais à sa place). `toPlayer` distingue les dégâts SUBIS par le joueur (rouge/orangé) des dégâts
// qu'il INFLIGE (blanc/jaune) ; sa taille suit la part des PV max de la cible (floatingDamageScale()),
// `heavy` l'agrandit encore un peu pour un coup marquant (télégraphe exécuté, ruée d'enrage, phase 3,
// attaque furtive, charge). Fait aussi trembler le combattant touché dans la
// scène (shakeSceneFighter(), scene.js). Se nettoie lui-même après son animation
// (`animationend`), fonctionne aussi bien avec l'animation normale que le simple fondu de
// prefers-reduced-motion (les deux déclenchent cet événement).
function showFloatingDamage(containerEl, amount, { heavy = false, toPlayer = false } = {}) {
    if (!containerEl) return;
    const el = document.createElement('span');
    el.className = `floating-damage ${toPlayer ? 'floating-damage-taken' : 'floating-damage-dealt'}${heavy ? ' floating-damage-heavy' : ''}`;
    el.innerText = `-${Math.round(amount)}`;
    const target = toPlayer ? gameState : gameState.currentEnemy;
    const { fontPx, pop } = floatingDamageScale(amount, target ? target.maxHp : 0, heavy);
    el.style.fontSize = `${fontPx}px`;
    el.style.setProperty('--fd-pop', pop);
    const offsetX = FLOATING_DAMAGE_OFFSETS[floatingDamageOffsetIndex];
    floatingDamageOffsetIndex = (floatingDamageOffsetIndex + 1) % FLOATING_DAMAGE_OFFSETS.length;
    el.style.left = `calc(50% + ${offsetX}px)`;
    el.addEventListener('animationend', () => el.remove());
    containerEl.appendChild(el);
    shakeSceneFighter(toPlayer ? 'crawler' : 'mob');
}

// Nombre de lignes gardées dans le journal court de combat (#combat-last-action) ; il n'en montre
// que ce que sa hauteur fixe permet, la plus récente toujours entière en bas.
const COMBAT_LOG_LINES = 3;
// Ennemi du combat dont le journal court affiche les lignes : un nouvel ennemi le remet à zéro.
let combatLogEnemy = null;

// Ajoute un message au journal complet (qui reçoit TOUT) et à l'affichage minimal du moment : hors
// combat, il devient la dernière ligne sous la scène d'exploration (#explore-last-line, écrasée à
// chaque message) ; pendant un combat, il rejoint le journal court de la zone de combat.
function logEvent(message, type = "normal") {
    // Couleurs adaptées au fond sombre du journal complet (reprend l'ancien style)
    const logColors = {
        danger: "text-red-400 font-bold",
        success: "text-green-400",
        info: "text-blue-300 italic",
        loot: "text-yellow-400 font-bold",
        normal: "text-gray-300"
    };
    if (!gameState.inCombat && ui.sceneLastLine) {
        ui.sceneLastLine.className = `min-h-[2.6em] px-0.5 text-[11px] leading-snug line-clamp-2 ${logColors[type] || logColors.normal}`;
        ui.sceneLastLine.innerText = message;
    }

    const logLine = document.createElement('div');
    logLine.className = logColors[type] || logColors.normal;
    logLine.innerText = `>> ${message}`;
    ui.fullLog.appendChild(logLine);
    ui.fullLog.scrollTop = ui.fullLog.scrollHeight;

    if (gameState.inCombat && ui.combatLastAction) {
        if (combatLogEnemy !== gameState.currentEnemy) {
            ui.combatLastAction.innerHTML = '';
            combatLogEnemy = gameState.currentEnemy;
        }
        const shortLine = document.createElement('p');
        shortLine.className = logColors[type] || logColors.normal;
        shortLine.innerText = message;
        ui.combatLastAction.appendChild(shortLine);
        while (ui.combatLastAction.children.length > COMBAT_LOG_LINES) {
            ui.combatLastAction.removeChild(ui.combatLastAction.firstElementChild);
        }
    }
}

// Prépare la scène d'exploration pour un nouvel événement (icône de repli, titre, type) : appelé au
// début de chaque nouvelle branche d'événement dans resolveCardEvent(), avant que logEvent() n'écrive
// la dernière ligne. `scene` : vignette dessinée dans la scène (nom, ou { key, enemy } — voir
// EXPLORE_VIGNETTES dans scene.js) ; absente ou inconnue, l'emoji s'affiche à sa place.
function setSceneHeader(icon, title, typeLabel, scene) {
    ui.sceneIcon.innerText = icon;
    ui.sceneTitle.innerText = title;
    ui.sceneTypeLabel.innerText = typeLabel;
    renderScene('explore', scene);
}

// Petit fondu à chaque nouvel événement d'exploration (voir .scene-draw-anim dans index.html).
function playSceneDrawAnimation() {
    if (!ui.exploreScene) return;
    ui.exploreScene.classList.remove('scene-draw-anim');
    void ui.exploreScene.offsetWidth; // force le navigateur à relire le style pour rejouer l'animation
    ui.exploreScene.classList.add('scene-draw-anim');
}

// Scène d'arrivée sur un étage (nouvelle partie, changement d'étage, sauvegarde restaurée) : la ville
// de départ sur un étage urbain, le quartier courant sinon — jamais la vignette de l'étage précédent.
function showFloorArrivalScene() {
    const city = isUrbanFloor() ? urbanCityById(gameState.floorMap.currentCityId) : null;
    if (city) {
        setSceneHeader('🏙️', city.name, 'Ville sûre', { key: 'citySafe', cityName: city.name });
    } else {
        setSceneHeader('🚪', `Étage ${gameState.currentFloor}`, 'Exploration', 'silence');
    }
}

// Carte de l'étage (Carte Urbaine) ouverte ou fermée par #btn-toggle-map — préférence d'affichage
// seulement, jamais un état de jeu (d'où une variable de module et non un champ de gameState).
let mapPanelOpen = true;
// ---------- Barre d'icônes et panneaux d'inventaire (chantier 9 « interface inventaire allégée ») ----------
// #bottom-nav (fixée en bas, masquée en combat) ouvre trois panneaux : Équipement porté, Sac (réserve +
// consommables) et Grimoire. Une pastille signale un objet ou un sort nouveau (`item.isNew`, posé par
// storeLootItem(), retiré à l'ouverture du panneau correspondant — l'objet garde sa mention « Nouveau »
// tant que le panneau reste ouvert). Le panneau ouvert est une préférence d'affichage (variable de module).
const INVENTORY_SHEETS = { equipment: 'equipmentSheet', bag: 'bagSheet', spellbook: 'spellbookSheet' };
let openInventorySheetName = null;

function hasNewBagItems() {
    return gameState.inventory.some(item => item && item.isNew);
}

function hasNewSpells() {
    return gameState.spellbook.some(spell => spell && spell.isNew);
}

function updateBottomNav() {
    if (!ui.bottomNav) return;
    const hidden = !!gameState.inCombat;
    ui.bottomNav.classList.toggle('hidden', hidden);
    if (hidden && openInventorySheetName) closeInventorySheets();
    if (ui.navBagCount) {
        const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
        ui.navBagCount.innerText = `${equipmentCount}/${gameState.maxInventory}`;
    }
    if (ui.navBagDot) ui.navBagDot.classList.toggle('hidden', !hasNewBagItems());
    if (ui.navSpellbookDot) ui.navSpellbookDot.classList.toggle('hidden', !hasNewSpells());
}

function openInventorySheet(name) {
    if (!INVENTORY_SHEETS[name] || gameState.inCombat) return false;
    closeInventorySheets();
    if (name === 'spellbook') updateSpellbookUI(); else updateInventoryUI();
    const sheet = ui[INVENTORY_SHEETS[name]];
    if (sheet) sheet.classList.remove('hidden');
    openInventorySheetName = name;
    // Vu : la pastille disparaît (les cartes déjà affichées gardent leur mention « Nouveau »).
    if (name === 'bag') gameState.inventory.forEach(item => { if (item && item.isNew) delete item.isNew; });
    if (name === 'spellbook') gameState.spellbook.forEach(spell => { if (spell && spell.isNew) delete spell.isNew; });
    updateBottomNav();
    return true;
}

function closeInventorySheets() {
    Object.values(INVENTORY_SHEETS).forEach(key => { if (ui[key]) ui[key].classList.add('hidden'); });
    openInventorySheetName = null;
}

function toggleMapPanel(forceOpen) {
    mapPanelOpen = forceOpen === undefined ? !mapPanelOpen : !!forceOpen;
    updateUI();
}

// Fonction pour mettre à jour l'inventaire visuel
function updateInventoryUI() {
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    ui.inventoryCount.innerText = equipmentCount;
    if (ui.inventoryMax) ui.inventoryMax.innerText = gameState.maxInventory;
    updateBottomNav();
    // Objets équipés : icône (même dessin que sur le crawler, voir itemIconSvg() dans scene.js) + nom.
    const equippedLabel = (item) => item
        ? `<span class="inline-flex items-center gap-1 align-middle">${itemIconSvg(item, 22)}<span>${formatItemDisplayName(item)}</span></span>`
        : "Aucune";
    ui.equippedWeapon.innerHTML = equippedLabel(gameState.equipment.weapon);
    ui.equippedArmor.innerHTML = equippedLabel(gameState.equipment.armor);
    if (ui.equippedArmorBadges) {
        // Qualificatifs de TOUT l'équipement porté (arme, distance, armure), pas seulement de l'armure.
        ui.equippedArmorBadges.innerHTML = ['weapon', 'ranged', 'armor']
            .map(slot => buildQualifierBadgesHtml(gameState.equipment[slot]))
            .join('');
    }
    if (ui.equippedRanged) ui.equippedRanged.innerHTML = equippedLabel(gameState.equipment.ranged);

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
            // Badges de qualificatifs (arme, distance ou armure), effet exact en infobulle.
            const armorBadges = buildQualifierBadgesHtml(item);
            card.innerHTML = `
                ${item.isNew ? '<span class="absolute top-1 left-1 px-1 rounded bg-amber-400 text-[7px] font-black uppercase text-gray-900">Nouveau</span>' : ''}
                <div class="flex justify-center leading-none">${itemIconSvg(item, 40) || `<span class="text-xl">${icon}</span>`}</div>
                <div class="text-[10px] font-bold leading-tight">${item.name}</div>
                ${item.rarity ? `<div class="text-[8px] font-bold uppercase tracking-wider" style="color:${rarityColor}">${item.rarity}</div>` : ""}
                <div class="text-[9px] text-stone-600">${statLine}</div>
                ${armorBadges ? `<div class="flex gap-1 flex-wrap justify-center text-[8px]">${armorBadges}</div>` : ""}
                <button data-action="equip" class="mt-1 text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>
                <button data-action="discard" class="absolute top-1 right-1 text-[10px] text-red-700 hover:text-red-500" title="Jeter">🗑️</button>
            `;
            card.querySelector('[data-action="equip"]').addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); equipItem(i); });
            card.querySelector('[data-action="discard"]').addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); discardItem(i); });
            // Toucher la carte (hors boutons) : inspection détaillée, avec les mêmes actions.
            card.classList.add('cursor-pointer');
            card.addEventListener('click', () => openItemInspect(item, { actions: [
                { label: 'Équiper', onClick: () => equipItem(i) },
                ...companionGiveAction(() => giveItemToCompanion(i)),
                { label: 'Jeter', tone: 'danger', onClick: () => discardItem(i) }
            ] }));
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
        btn.className = "w-9 h-9 flex items-center justify-center bg-gray-950 border rounded hover:brightness-125";
        // Fiole à la couleur de ce que l'objet rend (voir consumableFlaskKind() dans scene.js) : rouge = PV,
        // bleu = mana, moitié-moitié = les deux ; la bordure du bouton reprend la même couleur.
        btn.style.borderColor = CONSUMABLE_FLASKS[consumableFlaskKind(item)].border;
        btn.innerHTML = itemIconSvg(item, 28);
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

// Regroupe les parchemins par sort (`spellName`) pour l'affichage du grimoire et de la boutique : un
// seul emplacement par sort, qui cumule toutes ses raretés. Les données restent une simple liste
// d'exemplaires (gameState.spellbook) — chaque exemplaire garde son `index` dans cette liste, pour
// s'équiper ou se vendre séparément. `equipped` (facultatif) : sort équipé, ajouté à son groupe avec
// `index: -1` (jamais vendable, voir sellSpell()). Groupes dans l'ordre de première apparition (le
// sort équipé d'abord) ; exemplaires de la rareté la plus haute à la plus basse, puis par dégâts.
const RARITY_RANK = Object.fromEntries(itemRarities.map((r, i) => [r.name, i]));
function groupSpellbook(spellbook, equipped = null) {
    const groups = [];
    const byName = {};
    const add = (spell, index) => {
        const key = spell.spellName || spell.name;
        if (!byName[key]) {
            byName[key] = { spellName: key, icon: spell.icon, spellCategory: spell.spellCategory, copies: [] };
            groups.push(byName[key]);
        }
        byName[key].copies.push({ spell, index, equipped: index === -1 });
    };
    if (equipped) add(equipped, -1);
    spellbook.forEach((spell, i) => add(spell, i));
    groups.forEach(g => g.copies.sort((a, b) =>
        (RARITY_RANK[b.spell.rarity] || 0) - (RARITY_RANK[a.spell.rarity] || 0) || (b.spell.baseDmg || 0) - (a.spell.baseDmg || 0)));
    return groups;
}

// Ligne de stats d'un exemplaire de sort (grimoire et boutique).
function spellCopyStats(spell) {
    const effect = spell.spellEffect && SPELL_EFFECTS[spell.spellEffect.kind];
    const main = spell.spellCategory === 'any' ? `${effect ? effect.label : 'Utilitaire'}${spell.spellEffect && spell.spellEffect.kind === 'heal' ? ` ${spell.spellEffect.pct} %` : ''}` : `⚔️ +${spell.baseDmg}${effect ? ` · ${effect.label}` : ''}`;
    return `${main} · 🔷 ${getSpellManaCost(spell)}`;
}

// Portée d'un sort (chantier 11 : `any` = utilitaire, utilisable à toute distance).
function spellRangeLabel(category) {
    return category === 'melee' ? "Corps à corps" : category === 'any' ? "Partout" : "À distance";
}

// Grimoire : une carte par sort (groupSpellbook()), une ligne par exemplaire — rareté, dégâts, coût en
// mana et bouton "Équiper" (voir equipSpell()) ; l'exemplaire équipé y figure avec la mention "Équipé".
// Inventaire séparé de l'équipement classique, jamais limité (voir addLoot()).
function updateSpellbookUI() {
    const spellLabel = gameState.equipment.spell ? formatItemDisplayName(gameState.equipment.spell) : "Aucun";
    if (ui.equippedSpell) ui.equippedSpell.innerText = spellLabel;
    if (ui.equippedSpellSheet) ui.equippedSpellSheet.innerText = spellLabel;
    updateBottomNav();
    if (!ui.spellbookCards) return;

    ui.spellbookCards.innerHTML = "";
    const groups = groupSpellbook(gameState.spellbook, gameState.equipment.spell);
    if (groups.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun parchemin appris pour l'instant.";
        ui.spellbookCards.appendChild(empty);
        return;
    }

    groups.forEach(group => {
        const best = group.copies[0].spell;
        const categoryLabel = spellRangeLabel(group.spellCategory);
        const card = document.createElement('div');
        card.className = "mini-card rounded-lg p-2 flex flex-col gap-1";
        card.style.borderColor = best.rarityColor || "#57534e";
        card.style.borderWidth = "2px";
        const rows = group.copies.map((copy, i) => {
            const color = copy.spell.rarityColor || "#57534e";
            const action = copy.equipped
                ? `<span class="shrink-0 text-[9px] uppercase tracking-wider font-bold text-emerald-700 px-2">Équipé</span>`
                : `<button data-copy="${i}" class="shrink-0 min-h-[32px] text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>`;
            return `<div data-inspect="${i}" class="flex items-center gap-2 border-t border-stone-300 pt-1 cursor-pointer">
                <span class="text-[8px] font-bold uppercase tracking-wider w-16 shrink-0" style="color:${color}">${copy.spell.rarity || ''}</span>
                <span class="flex-1 text-[9px] text-stone-600">${spellCopyStats(copy.spell)}</span>
                ${action}
            </div>`;
        }).join('');
        card.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xl leading-none">${group.icon || '✨'}</span>
                <span class="flex-1 min-w-0">
                    <span class="block text-[10px] font-bold leading-tight">${group.spellName}${group.copies.some(c => c.spell.isNew) ? ' <span class="ml-1 px-1 rounded bg-purple-400 text-[7px] font-black uppercase text-gray-900 align-middle">Nouveau</span>' : ''}</span>
                    <span class="block text-[9px] text-stone-500">${categoryLabel}${group.copies.length > 1 ? ` · ${group.copies.length} exemplaires` : ''}</span>
                </span>
            </div>
            ${rows}
        `;
        group.copies.forEach((copy, i) => {
            // Toucher la ligne d'un exemplaire : inspection (le bouton Équiper reste un raccourci).
            const row = card.querySelector(`[data-inspect="${i}"]`);
            if (row) row.addEventListener('click', () => openItemInspect(copy.spell, copy.equipped ? { compareTo: null } : { actions: [
                { label: 'Équiper', onClick: () => equipSpell(copy.index) },
                ...companionGiveAction(() => giveSpellToCompanion(copy.index))
            ] }));
            if (copy.equipped) return;
            const btn = card.querySelector(`[data-copy="${i}"]`);
            if (btn) btn.addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); equipSpell(copy.index); });
        });
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
// Badges de qualificatifs d'un objet (voir itemQualifiers dans items.js) : icône + nom + rang, en rouge
// pour un défaut de Camelote. L'infobulle native (`title`) donne l'effet exact, chiffres compris —
// le même texte que le panneau d'inspection (describeQualifier()).
function buildQualifierBadgesHtml(item) {
    const target = item ? (qualifierTarget(item.category) || 'weapon') : null;
    return getItemQualifierList(item).map(({ key, rank }) => {
        const q = itemQualifiers[key];
        if (!q) return '';
        const cls = q.kind === 'malus'
            ? 'bg-red-100 border-red-400 text-red-800'
            : 'bg-amber-100 border-amber-400 text-amber-800';
        const title = escapeHtmlAttr(`${formatQualifierLabel(key, rank)} — ${describeQualifier(key, target, rank)}`);
        return `<span class="px-1 py-0.5 rounded border ${cls}" title="${title}">${q.icon} ${formatQualifierLabel(key, rank)}</span>`;
    }).join('');
}

function escapeHtmlAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ==========================================
// INSPECTION D'UN OBJET (chantier "refonte des objets", étape 7)
// ==========================================
// Tout ce qu'il faut pour décider : stats, rareté, niveau d'objet, chaque qualificatif avec son effet
// exact (describeQualifier(), la même source que le moteur), valeur marchande, et comparaison chiffrée
// avec l'objet porté au même emplacement. Ouvert depuis l'inventaire, l'équipement porté, le grimoire et
// la boutique (où l'achat/la vente passent désormais par ce panneau : plus de vente d'un toucher).

const ITEM_CATEGORY_LABELS = { weapons: "Arme de mêlée", ranged: "Arme à distance", armors: "Armure", consumables: "Consommable", scrolls: "Parchemin de sort" };
const EQUIPMENT_SLOT_BY_CATEGORY = { weapons: 'weapon', ranged: 'ranged', armors: 'armor', scrolls: 'spell' };

// Stats chiffrées d'un objet, comparables entre deux objets de même catégorie. `better` : 'up' si une
// valeur plus haute est meilleure, 'down' si plus basse (coût en mana).
function describeItemStats(item) {
    if (!item) return [];
    const stats = [];
    if (item.category === 'scrolls') {
        if (item.spellCategory !== 'any') stats.push({ key: 'dmg', icon: '⚔️', label: 'Dégâts', value: item.baseDmg || 0, prefix: '+', better: 'up' });
        stats.push({ key: 'mana', icon: '🔷', label: 'Coût en mana', value: getSpellManaCost(item), better: 'down' });
        return stats;
    }
    if (item.baseDmg !== undefined) stats.push({ key: 'dmg', icon: '⚔️', label: 'Dégâts', value: item.baseDmg, prefix: '+', better: 'up' });
    if (item.baseArmor !== undefined) stats.push({ key: 'armor', icon: '🛡️', label: 'Armure', value: item.baseArmor, prefix: '+', better: 'up' });
    if (item.heal > 0) stats.push({ key: 'heal', icon: '💚', label: 'Soin', value: item.heal, suffix: ' PV', better: 'up' });
    if (item.mana > 0) stats.push({ key: 'manaGain', icon: '🔷', label: 'Mana rendu', value: item.mana, better: 'up' });
    return stats;
}

// Objet porté au même emplacement (null pour un consommable, ou si c'est l'objet lui-même).
function getEquippedCounterpart(item) {
    const slot = item && EQUIPMENT_SLOT_BY_CATEGORY[item.category];
    const equipped = slot ? gameState.equipment[slot] : null;
    return equipped && equipped !== item ? equipped : null;
}

function formatStatDelta(stat, otherValue) {
    const diff = stat.value - otherValue;
    if (diff === 0) return `<span class="text-gray-500">= identique</span>`;
    const good = stat.better === 'down' ? diff < 0 : diff > 0;
    const arrow = diff > 0 ? '▲' : '▼';
    return `<span class="${good ? 'text-emerald-400' : 'text-red-400'}">${arrow} ${diff > 0 ? '+' : '−'}${Math.abs(diff)}</span>`;
}

// HTML du panneau (fonction pure, sans DOM). `options.compareTo` : objet de comparaison (par défaut
// celui porté au même emplacement) ; `options.priceLine` : ligne de prix du contexte (boutique).
function buildItemInspectHtml(item, options = {}) {
    if (!item) return '';
    const compareTo = options.compareTo !== undefined ? options.compareTo : getEquippedCounterpart(item);
    const target = qualifierTarget(item.category);
    const rarityColor = item.rarityColor || '#9ca3af';
    const icon = itemIconSvg(item, 56) || `<span class="text-4xl leading-none">${item.icon || '✨'}</span>`;
    const level = item.itemLevel ? ` · Niveau d'objet ${item.itemLevel}` : '';
    const categoryLabel = ITEM_CATEGORY_LABELS[item.category] || '';
    const spellKind = item.category === 'scrolls' ? ` · ${spellRangeLabel(item.spellCategory).toLowerCase()}` : '';

    const otherStats = Object.fromEntries(describeItemStats(compareTo).map(s => [s.key, s.value]));
    const statsHtml = describeItemStats(item).map(stat => {
        const delta = compareTo && otherStats[stat.key] !== undefined ? ` ${formatStatDelta(stat, otherStats[stat.key])}` : '';
        return `<li class="flex justify-between gap-2"><span>${stat.icon} ${stat.label}</span><span class="font-bold text-gray-100">${stat.prefix || ''}${stat.value}${stat.suffix || ''}${delta}</span></li>`;
    }).join('');

    const spellEffectText = item.category === 'scrolls' ? describeSpellEffect(item.spellEffect) : '';
    const spellEffectHtml = spellEffectText
        ? `<div class="border-l-2 pl-2 border-purple-500"><p class="font-bold text-purple-200">${item.icon || '✨'} Effet du sort</p><p class="text-gray-400">${spellEffectText}</p></div>`
        : '';
    const qualifiers = getItemQualifierList(item);
    const qualifiersHtml = spellEffectHtml + (qualifiers.length > 0
        ? qualifiers.map(({ key, rank }) => {
            const q = itemQualifiers[key];
            if (!q) return '';
            const malus = q.kind === 'malus';
            return `<div class="border-l-2 pl-2 ${malus ? 'border-red-600' : 'border-amber-500'}">
                <p class="font-bold ${malus ? 'text-red-300' : 'text-amber-200'}">${q.icon} ${formatQualifierLabel(key, rank)}${malus ? ' <span class="text-[9px] uppercase tracking-wider text-red-400">défaut</span>' : ''}</p>
                <p class="text-gray-400">${describeQualifier(key, target || 'weapon', rank)}</p>
            </div>`;
        }).join('')
        : `<p class="text-gray-500 italic">${item.category === 'consumables' ? 'Un consommable ne porte jamais de qualificatif.' : 'Aucun qualificatif.'}</p>`);

    const value = getItemValue(item);
    const forgedHtml = item.forgedByPerfect ? `<p class="text-amber-300 italic">🔥 Forgée par un combat parfait : un qualificatif de plus.</p>` : '';
    const valueHtml = forgedHtml + `<p class="text-gray-400">💰 Valeur : <span class="text-yellow-300 font-bold">${value} PO</span> · revente <span class="text-emerald-300 font-bold">${getSellPrice(item)} PO</span></p>`;
    const priceHtml = options.priceLine ? `<p class="text-gray-300 font-bold">${options.priceLine}</p>` : '';

    const compareHtml = compareTo
        ? `<div class="border-t border-gray-800 pt-2">
            <p class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Actuellement porté</p>
            <p class="text-gray-300">${formatItemDisplayName(compareTo)}</p>
            ${getItemQualifierList(compareTo).length > 0 ? `<div class="flex gap-1 flex-wrap text-[9px] mt-1">${buildQualifierBadgesHtml(compareTo)}</div>` : ''}
        </div>`
        : '';

    return `<div class="flex items-center gap-3">
            <div class="shrink-0 w-14 h-14 flex items-center justify-center rounded-lg bg-gray-950 border" style="border-color:${rarityColor}">${icon}</div>
            <div class="min-w-0">
                <p class="font-bold text-sm text-gray-100 leading-tight">${item.name}</p>
                <p class="text-[10px] uppercase tracking-wider font-bold" style="color:${rarityColor}">${item.rarity || 'Commun'}${level}</p>
                <p class="text-[10px] text-gray-500">${categoryLabel}${spellKind}</p>
            </div>
        </div>
        ${statsHtml ? `<ul class="flex flex-col gap-0.5 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5">${statsHtml}</ul>` : ''}
        <div class="flex flex-col gap-1.5">${qualifiersHtml}</div>
        ${valueHtml}${priceHtml}
        ${compareHtml}`;
}

// Ouvre le panneau d'inspection. `options.actions` : [{ label, onClick, disabled, tone }] — chaque
// action referme le panneau avant de s'exécuter. Un bouton « Fermer » est toujours ajouté.
function openItemInspect(item, options = {}) {
    if (!item || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = buildItemInspectHtml(item, options);
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = item.rarityColor || '#374151';
    renderInspectActions(options.actions || []);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Boutons du panneau d'inspection (objet ou fiche compagnon) : chaque action referme le panneau avant
// de s'exécuter ; un bouton « Fermer » est toujours ajouté.
function renderInspectActions(actions) {
    ui.itemInspectActions.innerHTML = '';
    const tones = {
        primary: 'bg-amber-900/40 border-amber-600 text-amber-200 hover:bg-amber-800/50',
        good: 'bg-emerald-900/40 border-emerald-600 text-emerald-200 hover:bg-emerald-800/50',
        danger: 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/50',
        neutral: 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
    };
    [...actions, { label: 'Fermer', tone: 'neutral' }].forEach(action => {
        const btn = document.createElement('button');
        btn.className = `w-full min-h-[44px] py-2 border-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${tones[action.tone || 'primary']}`;
        btn.innerText = action.label;
        btn.disabled = !!action.disabled;
        btn.addEventListener('click', () => {
            closeItemInspect();
            if (action.onClick) action.onClick();
        });
        ui.itemInspectActions.appendChild(btn);
    });
}

function closeItemInspect() {
    if (ui.itemInspectOverlay) ui.itemInspectOverlay.classList.add('hidden');
}

// Objet porté (arme, distance, armure, sort) : inspection seule, rien à comparer.
function inspectEquippedSlot(slot) {
    const item = gameState.equipment[slot];
    if (item) openItemInspect(item, { compareTo: null });
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
    if (slot !== 'armor') endStarterBuff(); // Foutu pour foutu (chantier 14) : saute au premier équipement hors armure
    recordRunEvent('equip', { item });
    if (slot === 'armor') recomputeMaxHp(); // Robuste : les PV max dépendent de l'armure portée
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
    endStarterBuff(); // Foutu pour foutu (chantier 14)
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
    const actualHeal = applyPlayerHeal(healAmount);
    gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaAmount);
    playSfx('potionDrink');
    const parts = [];
    if (actualHeal > 0) parts.push(`${actualHeal} PV`);
    if (manaAmount > 0) parts.push(`${manaAmount} Mana`);
    logEvent(`Vous consommez [${item.name}]${parts.length ? ` et récupérez ${parts.join(" et ")}` : ""}.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// Ratio de revente : un objet de l'inventaire (équipement non équipé ou consommable) se vend à une
// fraction de sa valeur de base — jamais l'équipement actuellement porté (gameState.equipment). Un
// parchemin du grimoire se vend au même ratio (voir sellSpell() ci-dessous), jamais celui équipé
// (gameState.equipment.spell), qui ne fait justement jamais partie de gameState.spellbook. Réservé à
// l'interaction boutique (voir triggerShopEncounter()) : pas de vente "de rue" hors ville spécialisée.
const SELL_VALUE_RATIO = 0.4;

// Valeur marchande d'un objet (PO) : `value` calculée à la génération (rareté, niveau d'objet,
// qualificatifs — voir computeItemValue() dans generator.js), `baseValue` brute en repli pour un objet
// construit à la main (tests) ou antérieur à ce système.
function getItemValue(item) {
    if (!item) return 0;
    return item.value ?? item.baseValue ?? 0;
}

function getSellPrice(item) {
    return Math.max(1, Math.round(getItemValue(item) * SELL_VALUE_RATIO));
}

function sellItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const price = getSellPrice(item);
    gameState.gold += price;
    gameState.inventory.splice(index, 1);
    playSfx('goldPickup');
    logEvent(`Vous vendez [${formatItemDisplayName(item)}] pour ${price} PO.`, "success");
    updateUI();
    updateInventoryUI();
}

// Vente d'un parchemin du grimoire (chantier "QoL/équilibrage", Chantier D) — pendant de sellItem()
// pour gameState.spellbook plutôt que gameState.inventory, même ratio/logique. L'équipé
// (gameState.equipment.spell) n'est structurellement jamais dans ce tableau (voir equipSpell()), donc
// rien de plus à vérifier ici pour l'exclure.
function sellSpell(index) {
    const spell = gameState.spellbook[index];
    if (!spell) return;

    const price = getSellPrice(spell);
    gameState.gold += price;
    gameState.spellbook.splice(index, 1);
    playSfx('goldPickup');
    logEvent(`Vous vendez [${formatItemDisplayName(spell)}] pour ${price} PO.`, "success");
    updateUI();
    updateSpellbookUI();
}

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
    playSfx('trapSpring');
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
        playSfx('goldPickup');
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
    // Écran « tu l'as vu » (chantier 16) avant les boutons ; sans interface, les boutons s'affichent tout de suite.
    showEncounterIntro('unseen', enemy, () => {
        updateStealthChoiceButtons();
        ui.stealthChoiceZone.classList.remove('hidden');
        updateUI();
    });
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

// Multiplicateur du premier coup d'une attaque furtive : `pendingSneakAttack` vaut 'ranged' (tir de loin), sinon corps à corps
// (`true` des anciens appelants compris).
function sneakAttackMult() {
    return gameState.pendingSneakAttack === 'ranged' ? config.sneakAttack.rangedMult : config.sneakAttack.meleeMult;
}

// « Tirer de loin » : une arme à distance équipée, OU un sort offensif à distance équipé avec assez de mana (jamais un sort
// utilitaire « partout », ni de mêlée). « Surgir au corps à corps » reste toujours possible, mains nues comprises.
function canStealthShootFromAfar() {
    if (gameState.equipment.ranged) return true;
    const spell = gameState.equipment.spell;
    return !!(spell && spell.spellCategory === 'ranged' && gameState.mana >= getSpellManaCost(spell));
}

// Libellés et état des deux boutons d'attaque furtive (chiffres lus dans config.sneakAttack).
function updateStealthChoiceButtons() {
    const fmt = (n) => String(n).replace('.', ',');
    const cfg = config.sneakAttack;
    const canShoot = canStealthShootFromAfar();
    ui.btnStealthAttack.innerText = `🗡️ Surgir au corps à corps (×${fmt(cfg.meleeMult)})`;
    ui.btnStealthAttack.title = `Écart nul, premier coup ×${fmt(cfg.meleeMult)}.${cfg.rangedMobSurprised ? " Un tireur surpris perd son premier tour." : ""}`;
    ui.btnStealthRanged.innerText = `🏹 Tirer de loin (×${fmt(cfg.rangedMult)})`;
    ui.btnStealthRanged.disabled = !canShoot;
    ui.btnStealthRanged.title = canShoot ? `Écart ${cfg.rangedStartDistance}, premier coup ×${fmt(cfg.rangedMult)}.` : "Il faut une arme à distance équipée, ou un sort offensif à distance (avec assez de mana).";
}

// Boutons « Attaque furtive » (chantier 16, lot 3) : `mode` 'melee' (écart 0, premier coup ×2) ou 'ranged' (écart de départ
// config.sneakAttack.rangedStartDistance, premier coup ×1,5). Le mode 'ranged' est refusé sans arme ni sort à distance.
function attemptStealthAttack(mode) {
    const ranged = mode === 'ranged';
    if (ranged && gameState.pendingStealthEncounter && !canStealthShootFromAfar()) {
        logEvent("Il vous faut une arme à distance, ou un sort offensif à distance, pour tirer de loin.", "danger");
        return;
    }
    const enemy = gameState.pendingStealthEncounter;
    gameState.stealthChoicePending = false;
    ui.stealthChoiceZone.classList.add('hidden');
    gameState.pendingStealthEncounter = null;
    if (!enemy) { updateUI(); return; }

    // L'en-tête de la scène (icône/nom/type) est posé par initiateCombat() lui-même.
    logEvent(ranged ? `Vous épaulez dans l'ombre et visez [${enemy.name}] de loin !` : `Vous surgissez de l'ombre et frappez [${enemy.name}] par surprise !`, "success");
    gameState.pendingSneakAttack = ranged ? 'ranged' : 'melee';
    // Surgir au contact d'un tireur : il est pris au dépourvu et perd son premier tour (voir consumeSurprise()).
    if (!ranged && mobWantsFar(enemy) && config.sneakAttack.rangedMobSurprised) enemy.surprised = true;
    initiateCombat(enemy, { intro: false, startDistance: ranged ? config.sneakAttack.rangedStartDistance : 0 }); // l'écran « tu l'as vu » a déjà été montré avant le choix
}

// Un mob pris au dépourvu (attaque furtive au contact d'un tireur) rate sa première riposte, une seule fois.
function consumeSurprise(enemy) {
    if (!enemy || !enemy.surprised) return false;
    enemy.surprised = false;
    logEvent(`[${enemy.name}] est pris au dépourvu : le tireur rate son premier tour !`, "info");
    showDie(ui.combatEnemyDie, "😲");
    return true;
}

// ==========================================
// LIEUX CONNUS (escalier gardé, boss de quartier, salles sécurisées)
// ==========================================

// Vrai si une action de type "explorer" ou "voyager vers un lieu connu" doit être bloquée
// (combat en cours, ou décision de boss en attente).
function isActionBlocked() {
    return gameState.inCombat || gameState.bossChoicePending || gameState.companionChoicePending || gameState.stealthChoicePending || gameState.encounterIntroPending || gameState.shopChoicePending || gameState.lairChoicePending || gameState.floorTransitionPending || gameState.pactChoicePending || gameState.raceChoicePending || gameState.classChoicePending || gameState.safehouseChoicePending || gameState.stairsChoicePending || gameState.showChoicePending || !!gameState.pendingMinigame;
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
        initiateCombat(maybeSpawnBountyHunter(), { intro: 'ambush' }); // Mob générique du quartier (ou chasseur de primes), pas le boss : simple embuscade de trajet
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

// ==========================================
// COMPAGNONS (CRAWLERS RENCONTRÉS)
// ==========================================

// Chantier "rework des compagnons" (voir NOTES_COMPAGNONS.md) : stats indexées sur l'étage et qui
// montent avec ses niveaux, loyauté plutôt que départ programmé, PV rendus au repos (« à terre » au lieu
// d'être perdu), effets qui suivent la courbe, et dons d'objets / de sorts / de potions. Chiffres dans
// config.companions ; fonctions pures (stats, loyauté d'un don, chance de départ) dans generator.js.

// Compagnon qui AGIT : présent et debout. Un compagnon à terre reste dans le groupe mais n'apporte
// plus rien (ni combat, ni bonus hors combat) jusqu'au prochain repos ou soin.
function activeCompanion() {
    const c = gameState.companion;
    return c && !c.downed && c.hp > 0 ? c : null;
}

function hasActiveCompanion(type) {
    const c = activeCompanion();
    return !!c && c.specialty.type === type;
}

// Cache les deux zones de choix de compagnon (ami / hostile)
function hideCompanionChoiceZones() {
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
}

// Résumé d'un candidat, affiché AVANT la décision (spécialité, effet, stats) — pure.
function buildCompanionCandidateSummary(candidate) {
    if (!candidate) return '';
    return `<p class="font-bold text-gray-200">${candidate.name} · <span class="text-emerald-300">${candidate.specialty.label}</span></p>`
        + `<p class="text-gray-400">${candidate.specialty.desc}</p>`
        + `<p class="text-gray-500">❤️ ${candidate.maxHp} PV · ⚔️ ${candidate.atk} ATQ · 🛡️ ${candidate.def} DEF</p>`;
}

// Convertit un candidat compagnon en objet compatible avec le moteur de combat existant (rencontre qui
// tourne à l'affrontement). Ses stats sont déjà à l'échelle de l'étage (generateCompanionCandidate()) ;
// l'XP suit le même scaling que celle d'un mob.
function companionCandidateToMob(candidate) {
    return {
        name: candidate.name,
        hp: candidate.maxHp || candidate.hp,
        atk: candidate.atk,
        def: candidate.def,
        xpReward: Math.round(20 * getFloorScaling(gameState.currentFloor || 1).xpMult),
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
        logEvent(`${candidate.name} accepte de vous accompagner ! (${candidate.specialty.label} : ${candidate.specialty.desc})`, "success");
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
            initiateCombat(companionCandidateToMob(candidate), { intro: false });
        } else {
            logEvent(`${candidate.name} décline poliment et s'éloigne.`, "info");
            updateUI();
        }
    } else {
        // Un crawler déjà hostile qui refuse passe directement à l'attaque
        logEvent(`${candidate.name} refuse et se jette sur vous !`, "danger");
        initiateCombat(companionCandidateToMob(candidate), { intro: false });
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
    initiateCombat(companionCandidateToMob(candidate), { intro: false });
}

// --- Loyauté ---

// Fait varier la loyauté (bornée 0..max) et prévient UNE fois quand elle passe sous le seuil de départ.
// Renvoie la variation réellement appliquée.
function changeCompanionLoyalty(delta) {
    const c = gameState.companion;
    if (!c || !delta) return 0;
    const bal = config.companions.loyalty;
    const before = c.loyalty;
    c.loyalty = Math.max(0, Math.min(bal.max, before + delta));
    if (c.loyalty !== before) recordRunEvent('loyalty');
    if (before >= bal.departureThreshold && c.loyalty < bal.departureThreshold) {
        logEvent(`${c.name} semble de moins en moins investi(e) dans l'aventure... (loyauté ${c.loyalty}/100 : risque de départ au prochain étage)`, "danger");
    }
    return c.loyalty - before;
}

// Raisons piochées au hasard quand le compagnon quitte le groupe (voir attemptCompanionDeparture()) :
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

// Jet de départ, au changement d'étage uniquement (voir advanceToNextFloor()) : moment narratif et
// prévisible, jamais au milieu d'un combat. Aucun risque tant que la loyauté reste au-dessus du seuil
// (companionDepartureChance()). Départ toujours PACIFIQUE ; il garde ce qu'on lui a donné (contrairement
// à un renvoi, voir dismissCompanion()). Renvoie true s'il est effectivement parti.
function attemptCompanionDeparture() {
    const c = gameState.companion;
    if (!c) return false;
    const chance = companionDepartureChance(c.loyalty);
    if (chance <= 0 || Math.random() * 100 >= chance) return false;

    const reason = COMPANION_ABANDON_REASONS[Math.floor(Math.random() * COMPANION_ABANDON_REASONS.length)];
    const hasGear = Object.values(c.gear || {}).some(Boolean);
    logEvent(`${c.name} ne vous suit pas dans l'escalier : ${reason}${hasGear ? " (et garde ce que vous lui aviez donné)" : ""}.`, "danger");
    gameState.companion = null;
    updateCompanionUI();
    recordRunEvent('companionLeft');
    return true;
}

// --- Progression ---

// Gain d'XP du compagnon (après chaque victoire du joueur tant qu'il est dans le groupe, même à terre).
// Chaque niveau lui donne des stats (+levelStatGain des stats de base) — progresser le rend meilleur,
// plus jamais seulement plus instable.
function gainCompanionXp(amount) {
    const c = gameState.companion;
    if (!c || !amount) return;

    c.xp += amount;
    while (c.xp >= c.xpToNext) {
        c.xp -= c.xpToNext;
        c.level += 1;
        c.xpToNext = Math.round(c.xpToNext * 1.3);
        const oldMaxHp = c.maxHp;
        Object.assign(c, computeCompanionLevelStats(c));
        if (!c.downed) c.hp = Math.min(c.maxHp, c.hp + (c.maxHp - oldMaxHp)); // Les PV gagnés sont aussi rendus
        logEvent(`${c.name} passe niveau ${c.level} (${c.maxHp} PV, ${c.atk} ATQ, ${c.def} DEF).`, "info");
    }
    updateCompanionUI();
}

// Victoire commune : XP, loyauté et soin post-combat du compagnon Premiers secours.
function onCompanionVictory() {
    const c = gameState.companion;
    if (!c) return;
    gainCompanionXp(config.companions.xpPerWin);
    if (!gameState.companion) return;
    if (!c.downed) changeCompanionLoyalty(config.companions.loyalty.victory);
    if (hasActiveCompanion('medic') && gameState.hp < gameState.maxHp) {
        const healed = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * config.companions.medic.postVictoryHealPct)));
        if (healed > 0) logEvent(`${c.name} panse vos plaies après le combat (+${healed} PV).`, "success");
    }
}

// --- PV, à terre ---

// Soigne le compagnon (et le relève s'il était à terre). Renvoie les PV réellement rendus.
function healCompanion(amount) {
    const c = gameState.companion;
    if (!c || !(amount > 0)) return 0;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + Math.round(amount));
    if (c.downed && c.hp > 0) {
        c.downed = false;
        logEvent(`${c.name} se relève, prêt(e) à reprendre du service.`, "success");
    }
    return c.hp - before;
}

// À appeler après tout coup encaissé par le compagnon : à 0 PV, il tombe « à terre » — il reste dans le
// groupe (plus de perte définitive) mais n'aide plus jusqu'au prochain repos ou soin, et perd en loyauté.
function checkCompanionDowned() {
    const c = gameState.companion;
    if (!c || c.downed || c.hp > 0) return false;
    c.hp = 0;
    c.downed = true;
    logEvent(`${c.name} s'effondre, à terre : plus d'aide avant un repos ou une potion.`, "danger");
    changeCompanionLoyalty(config.companions.loyalty.downed);
    return true;
}

// Interception d'un coup destiné au joueur (seul point de passage, mobs ET boss) : la Garde s'interpose
// souvent (guard.interceptChance), les autres spécialités sont parfois « prises dans la mêlée »
// (strayHitChance). Le compagnon absorbe une part du coup ; son armure réduit ce qu'il perd lui-même.
// Renvoie { playerDamage, note } — l'appelant log les dégâts puis appelle checkCompanionDowned().
function companionInterceptHit(damage) {
    damage = applyTrialToDamage(applyStarterBuffToDamage(damage)); // Foutu pour foutu (chantier 14) : +5 % de dégâts subis, puis Période d'essai (chantier 15), avant bouclier et interception
    // Bouclier de Mana (sort utilitaire, chantier 11) : réduit le coup AVANT l'éventuelle interception.
    const shield = gameState.status.manaShield;
    let shieldNote = "";
    if (shield && shield.rounds > 0 && damage > 0) {
        const absorbedByShield = Math.round(damage * shield.pct / 100);
        damage -= absorbedByShield;
        if (absorbedByShield > 0) shieldNote = ` (🔰 bouclier −${absorbedByShield})`;
    }
    const res = companionInterceptHitInner(damage);
    return { playerDamage: res.playerDamage, note: shieldNote + res.note };
}

function companionInterceptHitInner(damage) {
    const c = activeCompanion();
    if (!c || !(damage > 0)) return { playerDamage: damage, note: "" };
    const bal = config.companions;
    const isGuard = c.specialty.type === 'guard';
    const chance = isGuard ? bal.guard.interceptChance : bal.strayHitChance;
    if (Math.random() * 100 >= chance) return { playerDamage: damage, note: "" };

    const absorbPct = bal.guard.absorbMin + Math.random() * (bal.guard.absorbMax - bal.guard.absorbMin);
    const absorbed = Math.min(damage, Math.round(damage * absorbPct));
    if (absorbed <= 0) return { playerDamage: damage, note: "" };
    const taken = Math.max(1, absorbed - Math.round(getCompanionDef(c) * 0.5));
    c.hp = Math.max(0, c.hp - taken);
    const verb = isGuard ? "encaisse" : "pris(e) dans la mêlée, encaisse";
    const armorNote = taken < absorbed ? `, −${taken} PV pour lui` : "";
    return { playerDamage: damage - absorbed, note: ` (${c.name} ${verb} ${absorbed} dégâts à votre place${armorNote})` };
}

// --- Aide en combat ---

// Appui du compagnon après chaque attaque du joueur (voir performPlayerAttack()) : un sort donné a une
// chance d'être lancé ; sinon la Frappe d'appoint frappe à chaque fois, les autres spécialités sur un
// coup d'opportunité. Dégâts en part de l'ATQ EFFECTIVE (arme donnée comprise), sans jet de défense.
function companionCombatSupport(enemy) {
    const c = activeCompanion();
    if (!c || !enemy || enemy.hp <= 0) return;
    const s = config.companions.support;
    const spell = c.gear && c.gear.spell;
    if (spell && spell.spellCategory !== 'any' && Math.random() * 100 < s.spellCastChance) {
        const dmg = Math.max(1, Math.round((getCompanionAtk(c) + (spell.baseDmg || 0)) * s.spellRatio * (gameState.anomalyEffects.spellMult || 1)));
        enemy.hp -= dmg;
        logEvent(`${c.name} lance [${spell.spellName || spell.name}] ! (+${dmg} dégâts)`, "info");
        return;
    }
    const isStriker = c.specialty.type === 'strike';
    if (!isStriker && Math.random() * 100 >= s.opportunisticChance) return;
    const dmg = Math.max(1, Math.round(getCompanionAtk(c) * s.strikeRatio));
    enemy.hp -= dmg;
    logEvent(`${c.name} ${isStriker ? "porte un coup supplémentaire" : "profite d'une ouverture"} ! (+${dmg} dégâts)`, "info");
}

// Compagnon Premiers secours : chance de soigner le joueur après une riposte ennemie (part de ses PV max,
// pour suivre la courbe), et de lui rendre un peu de mana si un sort est équipé.
function companionMedicAfterRiposte() {
    const c = activeCompanion();
    const m = config.companions.medic;
    if (!c || c.specialty.type !== 'medic' || Math.random() * 100 >= m.healChance) return;
    const actualHeal = applyPlayerHeal(Math.max(5, Math.round(gameState.maxHp * m.healPct)));
    logEvent(`${c.name} vous soigne rapidement ! (+${actualHeal} PV)`, "success");
    if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
        const manaGain = m.manaMin + Math.floor(Math.random() * (m.manaMax - m.manaMin + 1));
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaGain);
        logEvent(`${c.name} restaure aussi un peu de votre mana ! (+${manaGain} Mana)`, "success");
    }
}

// Risque d'embuscade d'un trajet (lieu connu, ville, zone inexplorée) : 9 % par unité de distance,
// plafonné à 80 % — réduit par un compagnon Garde (il ouvre la marche).
function computeAmbushBaseChance(distance) {
    const base = Math.min(80, distance * 9);
    return hasActiveCompanion('guard') ? base * config.companions.guard.ambushMult : base;
}

// --- Dons (objets, sorts, potions) ---

// Pose un objet sur l'emplacement du compagnon, avec la loyauté du don. Renvoie l'objet qu'il portait
// à cet emplacement (à rendre au joueur) et la loyauté gagnée.
function equipCompanionGift(item, slot) {
    const c = gameState.companion;
    const loyaltyGain = companionGiftLoyalty(item);
    item.companionGifted = true;
    const previous = c.gear[slot] || null;
    c.gear[slot] = item;
    const gained = changeCompanionLoyalty(loyaltyGain);
    recordRunEvent('companionGift', { item });
    return { previous, gained };
}

const COMPANION_SLOT_LABELS = { weapon: 'arme', armor: 'armure', spell: 'sort' };

function describeCompanionGiftEffect(c, slot, before) {
    if (slot === 'weapon') return `ATQ ${before} → ${getCompanionAtk(c)}`;
    if (slot === 'armor') return `DEF ${before} → ${getCompanionDef(c)}`;
    return `${config.companions.support.spellCastChance} % de chance de le lancer à chacune de vos attaques`;
}

// Donne un objet de la réserve (arme, arme à distance, armure — ou potion, voir
// giveConsumableToCompanion()). L'objet qu'il portait au même emplacement revient dans la réserve (le
// nombre d'objets de la réserve ne change donc jamais).
function giveItemToCompanion(index) {
    const c = gameState.companion;
    const item = gameState.inventory[index];
    if (!c || !item) return false;
    if (item.category === 'consumables') return giveConsumableToCompanion(index);
    const slot = companionGiftSlot(item);
    if (!slot || slot === 'spell') return false;

    const before = slot === 'weapon' ? getCompanionAtk(c) : getCompanionDef(c);
    gameState.inventory.splice(index, 1);
    const { previous, gained } = equipCompanionGift(item, slot);
    if (previous) gameState.inventory.push(previous);
    logEvent(`Vous donnez [${formatItemDisplayName(item)}] à ${c.name} (${describeCompanionGiftEffect(c, slot, before)}${gained > 0 ? `, +${gained} loyauté` : ""})${previous ? ` — il vous rend [${formatItemDisplayName(previous)}]` : ""}.`, "success");
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    return true;
}

// Donne un parchemin du grimoire : il l'apprend (un seul sort à la fois), l'ancien revient au grimoire.
function giveSpellToCompanion(index) {
    const c = gameState.companion;
    const spell = gameState.spellbook[index];
    if (!c || !spell) return false;
    gameState.spellbook.splice(index, 1);
    const { previous, gained } = equipCompanionGift(spell, 'spell');
    if (previous) gameState.spellbook.push(previous);
    logEvent(`Vous confiez [${formatItemDisplayName(spell)}] à ${c.name} (${describeCompanionGiftEffect(c, 'spell')}${gained > 0 ? `, +${gained} loyauté` : ""})${previous ? ` — il vous rend [${formatItemDisplayName(previous)}]` : ""}.`, "success");
    updateCompanionUI();
    updateUI();
    updateSpellbookUI();
    return true;
}

// Donne une potion : elle soigne le compagnon sur-le-champ (et le relève s'il est à terre). Refusé si la
// potion ne rend pas de PV ou s'il est déjà en pleine forme — pas de potion gâchée.
function giveConsumableToCompanion(index) {
    const c = gameState.companion;
    const item = gameState.inventory[index];
    if (!c || !item || item.category !== 'consumables') return false;
    if (!(item.heal > 0)) {
        logEvent(`${c.name} n'a que faire de [${item.name}] : aucun PV à en tirer.`, "info");
        return false;
    }
    if (!c.downed && c.hp >= c.maxHp) {
        logEvent(`${c.name} est déjà en pleine forme — gardez [${item.name}] pour plus tard.`, "info");
        return false;
    }
    gameState.inventory.splice(index, 1);
    const healed = healCompanion(item.heal);
    const gained = changeCompanionLoyalty(companionGiftLoyalty(item));
    logEvent(`${c.name} boit [${item.name}] (+${healed} PV${gained > 0 ? `, +${gained} loyauté` : ""}).`, "success");
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    return true;
}

// Potion la plus adaptée pour soigner le compagnon : la plus petite qui couvre ses PV manquants, sinon
// la plus forte. Renvoie son index dans l'inventaire, ou -1.
function findCompanionPotionIndex() {
    const c = gameState.companion;
    if (!c) return -1;
    const missing = c.maxHp - c.hp;
    let best = -1;
    gameState.inventory.forEach((item, i) => {
        if (item.category !== 'consumables' || !(item.heal > 0)) return;
        if (best === -1) { best = i; return; }
        const cur = gameState.inventory[best];
        const covers = item.heal >= missing, curCovers = cur.heal >= missing;
        if (covers && (!curCovers || item.heal < cur.heal)) best = i;
        else if (!covers && !curCovers && item.heal > cur.heal) best = i;
    });
    return best;
}

// Renvoi volontaire du compagnon (fiche compagnon) : il part en vous rendant ce que vous lui aviez donné,
// rangé comme n'importe quel butin (storeLootItem() : sort au grimoire, arme/armure dans la réserve, ou
// revendue d'office si elle est pleine).
function dismissCompanion() {
    const c = gameState.companion;
    if (!c || isActionBlocked()) return false;
    logEvent(`Vous congédiez ${c.name}, qui s'éloigne en haussant les épaules.`, "info");
    gameState.companion = null;
    ['weapon', 'armor', 'spell'].forEach(slot => {
        const item = c.gear && c.gear[slot];
        if (item) storeLootItem(item, `Rendu par ${c.name} — `);
    });
    recordRunEvent('companionDismissed');
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
    return true;
}

// Action « Donner à <nom> » ajoutée aux panneaux d'inspection de la réserve et du grimoire.
function companionGiveAction(onClick) {
    const c = gameState.companion;
    return c ? [{ label: `Donner à ${c.name}`, tone: 'good', onClick }] : [];
}

// --- Affichage ---

// Reconstruit l'affichage compact du compagnon (hors combat) : nom, spécialité, PV, barre de loyauté.
function updateCompanionUI() {
    const companion = gameState.companion;
    if (!companion) {
        ui.companionStatusBar.classList.add('hidden');
        return;
    }
    ui.companionStatusBar.classList.remove('hidden');
    ui.companionNameDisplay.innerText = companion.name;
    ui.companionSpecialtyDisplay.innerText = `(${companion.specialty.label})`;
    if (ui.companionHpDisplay) {
        ui.companionHpDisplay.innerText = companion.downed ? "À terre" : `❤️ ${companion.hp}/${companion.maxHp}`;
        ui.companionHpDisplay.style.color = companion.downed ? '#f87171' : '';
    }
    ui.companionLoyaltyBar.style.width = `${companion.loyalty}%`;
    ui.companionLoyaltyBar.style.background = hpColor(companion.loyalty / 100); // Vert = loyal, rouge = prêt à partir
    ui.companionStatusBar.title = `Loyauté ${companion.loyalty}/100 — toucher pour voir sa fiche`;
}

// Fiche du compagnon (HTML pur) : stats effectives, loyauté, équipement donné, mode d'emploi des dons.
function buildCompanionSheetHtml(c) {
    if (!c) return '';
    const threshold = config.companions.loyalty.departureThreshold;
    const loyaltyNote = c.loyalty < threshold
        ? `<span class="text-red-400">risque de départ au prochain étage (${companionDepartureChance(c.loyalty)} %)</span>`
        : `<span class="text-emerald-400">aucun risque de départ</span>`;
    const gearRow = (slot, icon) => {
        const item = c.gear && c.gear[slot];
        return `<li class="flex justify-between gap-2"><span class="shrink-0">${icon} ${COMPANION_SLOT_LABELS[slot]}</span><span class="text-gray-200 text-right">${item ? formatItemDisplayName(item) : '<span class="text-gray-600 italic">rien</span>'}</span></li>`;
    };
    return `<div>
            <p class="font-bold text-sm text-gray-100">🐾 ${c.name} <span class="text-[10px] text-gray-500">niveau ${c.level}</span></p>
            <p class="text-emerald-300 font-bold">${c.specialty.label}</p>
            <p class="text-gray-400">${c.specialty.desc}</p>
        </div>
        <ul class="flex flex-col gap-0.5 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5">
            <li class="flex justify-between"><span>❤️ PV</span><span class="font-bold ${c.downed ? 'text-red-400' : 'text-gray-100'}">${c.downed ? 'À terre' : `${c.hp}/${c.maxHp}`}</span></li>
            <li class="flex justify-between"><span>⚔️ ATQ</span><span class="font-bold text-gray-100">${getCompanionAtk(c)}</span></li>
            <li class="flex justify-between"><span>🛡️ DEF</span><span class="font-bold text-gray-100">${getCompanionDef(c)}</span></li>
            <li class="flex justify-between"><span>🤝 Loyauté</span><span class="font-bold text-gray-100">${c.loyalty}/100</span></li>
        </ul>
        <p class="text-[10px]">${loyaltyNote}</p>
        <ul class="flex flex-col gap-0.5">${gearRow('weapon', '⚔️')}${gearRow('armor', '🛡️')}${gearRow('spell', '✨')}</ul>
        <p class="text-[10px] text-gray-500">Touchez un objet de votre réserve ou un sort de votre grimoire pour le lui donner : il gagne en force et en loyauté. Une potion le soigne, et le relève s'il est à terre.</p>`;
}

function openCompanionSheet() {
    const c = gameState.companion;
    if (!c || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = buildCompanionSheetHtml(c);
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = '#047857';
    const actions = [];
    const potionIndex = findCompanionPotionIndex();
    if (potionIndex >= 0 && (c.downed || c.hp < c.maxHp)) {
        const potion = gameState.inventory[potionIndex];
        actions.push({ label: `Donner [${potion.name}] (+${potion.heal} PV)`, tone: 'good', onClick: () => giveConsumableToCompanion(potionIndex) });
    }
    actions.push({ label: 'Congédier', tone: 'danger', disabled: isActionBlocked(), onClick: openDismissCompanionConfirm });
    renderInspectActions(actions);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Confirmation du renvoi : jamais d'un seul toucher.
function openDismissCompanionConfirm() {
    const c = gameState.companion;
    if (!c || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = `<p class="font-bold text-sm text-gray-100">Congédier ${c.name} ?</p><p class="text-gray-400">Il vous rendra ce que vous lui avez donné, puis partira pour de bon.</p>`;
    renderInspectActions([{ label: `Oui, congédier ${c.name}`, tone: 'danger', onClick: dismissCompanion }]);
    ui.itemInspectOverlay.classList.remove('hidden');
}

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
    playSfx('achievementUnlock');
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
    playSfx('stairsDescend');

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

// ==========================================
// ORIGINES : CHOIX DE LA RACE ET DE LA CLASSE À L'ÉTAGE 3 (chantier 13, lot 2 — voir origins.js et CHANTIERS.md)
// ==========================================
// À l'arrivée sur l'étage 3 d'une vraie partie (`gameState.saveEnabled`, comme l'émission DeathWatch), deux écrans successifs : la race puis la
// classe, chacun avec 3 cartes tirées par pickOriginOffers() (« conditions remplies d'abord »). Toucher une carte la sélectionne, le bouton de
// confirmation valide : le choix est définitif pour le run. Ordre à l'arrivée : origine, puis Pacte du Crawler (s'il est tiré), puis émission.
// Un crawler sans race qui a déjà dépassé l'étage 3 (ancienne sauvegarde) n'est jamais concerné. Les effets de classe viennent au lot 3.
function originChoiceDue() {
    return !!gameState.saveEnabled && gameState.currentFloor === config.origins.chooseFloor && !gameState.race;
}

function originEntry(kind, key) {
    const catalog = kind === 'race' ? ORIGIN_RACES : ORIGIN_CLASSES;
    return (key && catalog[key]) || null;
}

function triggerOriginChoice(kind) {
    gameState.raceChoicePending = kind === 'race';
    gameState.classChoicePending = kind === 'class';
    gameState.pendingOriginOffers = { kind, offers: pickOriginOffers(kind, gameState), selected: null };
    setSceneHeader('🧬', kind === 'race' ? 'Choix de la race' : 'Choix de la classe', 'Origines', 'pact');
    logEvent(kind === 'race'
        ? "🧬 Étage 3 : le Donjon exige de savoir ce que vous êtes. Choisissez une race."
        : "🧬 Maintenant, ce que vous savez faire. Choisissez une classe.", "danger");
    renderOriginChoice();
}
function triggerRaceChoice() { triggerOriginChoice('race'); }
function triggerClassChoice() { triggerOriginChoice('class'); }

function hideOriginOverlays() {
    if (ui.raceChoiceOverlay) ui.raceChoiceOverlay.classList.add('hidden');
    if (ui.classChoiceOverlay) ui.classChoiceOverlay.classList.add('hidden');
}

// HTML d'une carte de choix (texte interne au jeu : aucune saisie du joueur, donc rien à échapper).
function buildOriginCardHtml(kind, offer, selected) {
    const entry = originEntry(kind, offer.key);
    if (!entry) return '';
    const lines = kind === 'race'
        ? entry.effects.map(e => `<li class="text-emerald-300">＋ ${e}</li>`).join('') + (entry.flaw ? `<li class="text-red-300">－ ${entry.flaw}</li>` : '')
        : `<li class="text-amber-300">⚡ ${entry.ability}</li><li class="text-emerald-300">＋ ${entry.style}</li>`;
    const synergy = kind === 'class' ? originSynergyFor(gameState.race, offer.key) : null;
    const synergyHtml = synergy ? `<p class="mt-1 text-[10px] text-fuchsia-300">✨ Synergie avec votre race — « ${synergy.title} » : ${synergy.effect}</p>` : '';
    const reasonColor = offer.conditionMet ? 'text-gray-400' : 'text-gray-600';
    // Une carte de race montre le crawler à son aspect (corps teinté ou dessiné, sprites/crawler-races.js).
    const portrait = kind === 'race' ? `<div class="shrink-0 w-[44px] pt-1">${buildRacePortraitSvg(offer.key, 44)}</div>` : '';
    return `<button type="button" data-origin-key="${offer.key}" class="origin-card w-full text-left p-3 rounded-lg border-2 transition-all active:scale-[0.99] flex gap-3 ${selected ? 'border-amber-400 bg-amber-900/20' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}">
            ${portrait}
            <div class="min-w-0">
            <p class="font-bold text-sm text-gray-100">${entry.icon} ${entry.name}</p>
            <ul class="mt-1 text-[11px] leading-snug space-y-0.5">${lines}</ul>
            ${synergyHtml}
            <p class="mt-1 text-[10px] italic ${reasonColor}">${offer.reason}</p>
            </div>
        </button>`;
}

function renderOriginChoice() {
    const pending = gameState.pendingOriginOffers;
    hideOriginOverlays();
    if (!pending) return;
    const kind = pending.kind;
    const overlay = kind === 'race' ? ui.raceChoiceOverlay : ui.classChoiceOverlay;
    const cards = kind === 'race' ? ui.raceChoiceCards : ui.classChoiceCards;
    const confirm = kind === 'race' ? ui.btnRaceConfirm : ui.btnClassConfirm;
    if (!overlay || !cards || !confirm) return;
    cards.innerHTML = pending.offers.map(o => buildOriginCardHtml(kind, o, o.key === pending.selected)).join('');
    const chosen = originEntry(kind, pending.selected);
    confirm.disabled = !chosen;
    confirm.innerText = chosen ? `Confirmer : ${chosen.short || chosen.name}` : 'Choisissez une carte';
    overlay.classList.remove('hidden');
}

// Sélectionne une carte de l'écran en cours (jamais une origine hors des 3 cartes proposées).
function selectOrigin(key) {
    const pending = gameState.pendingOriginOffers;
    if (!pending || !pending.offers.some(o => o.key === key)) return false;
    pending.selected = key;
    renderOriginChoice();
    return true;
}

// Valide la carte sélectionnée : la race ouvre l'écran de la classe, la classe termine le choix.
function confirmOriginChoice() {
    const pending = gameState.pendingOriginOffers;
    if (!pending || !pending.selected || !originEntry(pending.kind, pending.selected)) return false;
    const key = pending.selected;
    if (pending.kind === 'race') {
        if (!applyRace(key)) return false;
        const race = ORIGIN_RACES[key];
        logEvent(`${race.icon} Vous êtes désormais ${race.name}. ${race.flaw ? `Défaut inclus : ${race.flaw.toLowerCase()}.` : "Aucun défaut : le Donjon est vexé."}`, "success");
        triggerClassChoice();
    } else {
        gameState.crawlerClass = key;
        const cls = ORIGIN_CLASSES[key];
        logEvent(`${cls.icon} Classe : ${cls.name}.`, "success");
        const synergy = originSynergyFor(gameState.race, key);
        if (synergy) logEvent(`✨ Synergie : « ${synergy.title} » — ${synergy.effect}.`, "success");
        finishOriginChoice();
    }
    updateUI();
    return true;
}

// Fin des deux écrans : rend la main, ou ouvre ce qui attendait derrière (Pacte du Crawler, puis émission DeathWatch).
function finishOriginChoice() {
    recordRunEvent('origin'); // succès « Pièce d'identité »
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    hideOriginOverlays();
    if (gameState.pendingPactAfterOrigin) {
        gameState.pendingPactAfterOrigin = false;
        triggerPactChoice();
    } else if (gameState.pendingShowAfterPact) {
        const lastFloor = gameState.pendingShowAfterPact;
        gameState.pendingShowAfterPact = null;
        triggerShow(lastFloor);
    }
}

// Saut DEV (devJumpToUrbanFloor) : tire une race et une classe au hasard au lieu d'ouvrir les deux écrans.
function rollDevOrigin() {
    const races = Object.keys(ORIGIN_RACES), classes = Object.keys(ORIGIN_CLASSES);
    applyRace(races[Math.floor(Math.random() * races.length)]);
    gameState.crawlerClass = classes[Math.floor(Math.random() * classes.length)];
}

// Fiche d'origine : bonus, défauts, capacité, synergie (HTML interne, rien à échapper).
function buildOriginSheetHtml() {
    const race = originEntry('race', gameState.race), cls = originEntry('class', gameState.crawlerClass);
    const raceHtml = race ? `<div class="flex gap-3"><div class="shrink-0 w-[44px]">${buildRacePortraitSvg(race.key, 44)}</div><div class="min-w-0"><p class="font-bold text-sm text-gray-100">${race.icon} ${race.name}</p>
            <ul class="mt-1 text-[11px] space-y-0.5">${race.effects.map(e => `<li class="text-emerald-300">＋ ${e}</li>`).join('')}${race.flaw ? `<li class="text-red-300">－ ${race.flaw}</li>` : ''}</ul></div></div>` : '';
    const classHtml = cls ? `<div class="mt-3"><p class="font-bold text-sm text-gray-100">${cls.icon} ${cls.name}</p>
            <ul class="mt-1 text-[11px] space-y-0.5"><li class="text-amber-300">⚡ ${cls.ability} <span class="text-gray-500">(1 fois par combat)</span></li><li class="text-emerald-300">＋ ${cls.style}</li></ul></div>` : '';
    const synergy = race && cls ? originSynergyFor(race.key, cls.key) : null;
    const synergyHtml = synergy ? `<div class="mt-3 p-2 rounded border border-fuchsia-800 bg-fuchsia-950/30"><p class="font-bold text-[12px] text-fuchsia-300">✨ « ${synergy.title} »</p><p class="text-[11px] text-fuchsia-200">${synergy.effect}</p></div>` : '';
    return raceHtml + classHtml + synergyHtml;
}

function openOriginSheet() {
    if (!ui.itemInspectOverlay || !(gameState.race || gameState.crawlerClass)) return;
    ui.itemInspectBody.innerHTML = buildOriginSheetHtml();
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = '#0f766e';
    renderInspectActions([]);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Badges permanents sous le nom (race, classe) ; un toucher ouvre la fiche d'origine.
function updateOriginUI() {
    updateClassAbilityUI(); // masquée hors combat
    const race = originEntry('race', gameState.race), cls = originEntry('class', gameState.crawlerClass);
    if (ui.raceStatus) {
        ui.raceStatus.classList.toggle('hidden', !race);
        if (race) { ui.raceStatus.innerText = `${race.icon} ${race.short}`; ui.raceStatus.title = `${race.name} — ${race.effects.join(', ')}${race.flaw ? ` · Défaut : ${race.flaw}` : ''}`; }
    }
    if (ui.classStatus) {
        ui.classStatus.classList.toggle('hidden', !cls);
        if (cls) { ui.classStatus.innerText = `${cls.icon} ${cls.name}`; ui.classStatus.title = `${cls.name} — ${cls.ability} · ${cls.style}`; }
    }
}

// ==========================================
// NÉCROLOGIE (épitaphes sarcastiques)
// ==========================================
// gameState.necrologie ne garde que les NECROLOGIE_MAX_ENTRIES dernières entrées (plus récente en
// premier) — voir recordEpitaph().
const NECROLOGIE_MAX_ENTRIES = 20;
// Écart (niveau joueur - "niveau" du mob, voir getMobLevelEquivalent()) à partir duquel un mob tueur
// est jugé "très inférieur" et déclenche l'épitaphe dédiée EPITAPH_TEMPLATES.mobFaible.
const NECROLOGIE_WEAK_MOB_DELTA = 5;
// Nombre de fuites réussies ce run à partir duquel la mention spéciale est ajoutée (voir
// gameState.fleesThisRun, incrémenté par attemptFlee()).
const NECROLOGIE_FLEE_THRESHOLD = 3;

// Libellés humains de la cause de mort, utilisés pour le placeholder {{cause}} des templates.
const DEATH_CAUSE_LABELS = {
    combat: "au combat",
    backfire: "par un sort qui a mal tourné",
    trap: "dans un piège",
    bleed: "d'une hémorragie",
    timeout: "faute de temps"
};

// Pool de templates par cause de mort, tirage aléatoire (voir pick()). {{mob}}/{{etage}}/
// {{deltaNiveau}}/{{cause}} remplacés par generateEpitaph() ; mobFaible et backfire sont des pools
// DÉDIÉS qui remplacent le pool "combat" par défaut quand leur règle spéciale s'applique (voir
// generateEpitaph()), jamais combinés entre eux.
const EPITAPH_TEMPLATES = {
    combat: [
        "Ici repose {{crawler}}, terrassé(e) par [{{mob}}] à l'étage {{etage}}. Le Donjon salue un adversaire digne de ce nom.",
        "[{{mob}}] a eu le dernier mot, à l'étage {{etage}}. Les paris étaient pourtant favorables.",
        "Vaincu(e) par [{{mob}}] à l'étage {{etage}}. Une fin honorable, si on ignore les précédentes tentatives.",
        "Fin de partie : [{{mob}}] a gagné, à l'étage {{etage}}. Applaudissements timides du public.",
        "[{{mob}}] : 1. Crawler : 0. Étage {{etage}}. Le classement ne ment jamais.",
        "L'étage {{etage}} garde son secret : comment [{{mob}}] a-t-il fait, exactement ?"
    ],
    trap: [
        "Mort(e) bêtement dans un piège, à l'étage {{etage}}. Le Donjon n'a même pas eu besoin d'un monstre.",
        "Un mécanisme centenaire a eu raison du crawler à l'étage {{etage}}. L'ironie n'échappe à personne.",
        "L'étage {{etage}} avait posé un piège. Le crawler avait posé un pied dedans.",
        "Piège fatal à l'étage {{etage}}. Le Donjon note : « toujours aussi efficace »."
    ],
    bleed: [
        "Vidé(e) de son sang à l'étage {{etage}}, lentement, sûrement, sans un mot.",
        "L'hémorragie a eu le dernier mot à l'étage {{etage}}. Un bandage aurait peut-être aidé.",
        "Mort(e) de ses blessures à l'étage {{etage}}. Le sang, lui, ne ment jamais sur l'issue."
    ],
    timeout: [
        "Le temps s'est écoulé à l'étage {{etage}}, et le Donjon n'attend personne.",
        "Plus de temps, plus de chance : le Donjon s'est refermé sur l'étage {{etage}}.",
        "Le chronomètre a gagné à l'étage {{etage}}. Il gagne toujours, en fin de compte."
    ],
    // Pool dédié (chantier 3) : tué par un chasseur de primes — remplace le pool 'combat'.
    chasseurPrime: [
        "Livré(e) mort(e) par [{{mob}}] à l'étage {{etage}}. La prime a été versée le jour même.",
        "[{{mob}}] a encaissé la récompense. Le crawler, lui, a encaissé le reste. Étage {{etage}}.",
        "Recherché(e) mort(e) ou vif(ve). [{{mob}}] a choisi, à l'étage {{etage}}.",
        "Victime de son propre succès : trop fort(e), trop vite, trop recherché(e). Étage {{etage}}."
    ],
    mobFaible: [
        "Terrassé(e) par [{{mob}}], un adversaire {{deltaNiveau}} niveaux en dessous, à l'étage {{etage}}. Le Donjon en rit encore.",
        "[{{mob}}], largement plus faible, a quand même eu raison du crawler à l'étage {{etage}}. Statistiquement improbable. Historiquement vrai.",
        "Vaincu(e) par plus faible que soi ([{{mob}}], étage {{etage}}). Une leçon d'humilité, post-mortem.",
        "[{{mob}}] n'aurait jamais dû gagner. Il a gagné quand même, à l'étage {{etage}}."
    ],
    backfire: [
        "Un sort mal maîtrisé, une explosion, un silence : fin de partie à l'étage {{etage}}.",
        "Le sort est parti de travers, et le crawler avec, à l'étage {{etage}}. La magie est une maîtresse cruelle.",
        "Tué(e) par son propre sortilège à l'étage {{etage}}. Le grimoire n'assume aucune responsabilité.",
        "Backfire fatal à l'étage {{etage}} : la magie a repris ce qu'elle avait prêté."
    ]
};

// Mention ajoutée en fin d'épitaphe si gameState.fleesThisRun >= NECROLOGIE_FLEE_THRESHOLD.
const EPITAPH_FLEE_MENTIONS = [
    "Après {{fuites}} fuites ce run, la chance a fini par lui tourner le dos.",
    "{{fuites}} fuites au compteur. Celle-ci, la dernière, n'a pas eu lieu.",
    "Après avoir fui {{fuites}} fois, le Donjon a fini par le rattraper."
];

// Mention ajoutée en fin d'épitaphe si un objet équipé porte jokeItem: true (voir items.js).
const EPITAPH_RIDICULOUS_ITEM_MENTIONS = [
    "Il est mort en brandissant fièrement : {{objetRidicule}}.",
    "Équipé jusqu'au bout de {{objetRidicule}}. Un choix qui restera dans les annales.",
    "{{objetRidicule}} l'a accompagné jusqu'à la fin. On ne peut pas dire qu'il ait été bien conseillé."
];

// "Niveau" équivalent d'un mob : aucun champ de niveau explicite n'existe sur les mobs (voir
// generateMob()/generator.js, qui les met à l'échelle par ÉTAGE, pas par niveau) — l'étage courant
// est le proxy le plus direct et cohérent avec le reste du moteur de scaling.
function getMobLevelEquivalent() {
    return Math.max(1, gameState.currentFloor);
}

// Objet équipé le plus "ridicule" au moment de la mort (voir jokeItem dans items.js) : les parchemins
// ne portent jamais ce flag, seuls weapon/ranged/armor sont scrutés.
function findRidiculousEquippedItem() {
    const slots = [gameState.equipment.weapon, gameState.equipment.ranged, gameState.equipment.armor];
    return slots.find(item => item && item.jokeItem) || null;
}

// Construit l'épitaphe sarcastique pour le décès en cours, à partir du contexte réel (cause, mob
// tueur éventuel). Fonction pure hors lecture de gameState/Math.random — appelée uniquement par
// gameOver().
// Mention propre à la race du crawler (chantier 13), ajoutée à toute épitaphe : une phrase, jamais tirée au hasard.
const EPITAPH_RACE_MENTIONS = {
    human: "Humain·e jusqu'au bout : moyen·ne, mais motivé·e.",
    ghoul: "La Goule n'aura, pour une fois, eu aucune raison de se plaindre de sa mine.",
    goblin: "Le Gobelin laisse derrière lui trois égouts, deux mégots et une caméra qu'il jure ne pas avoir volée.",
    troll: "Le Troll de bureau n'aura jamais rempli sa dernière note de frais.",
    elf: "L'Elfe de salon repose enfin : le peignoir est plié, les oreilles ne le sont pas.",
    dwarf: "Le Nain de chantier est tombé casque sur la tête, ce qui, au moins, était réglementaire.",
    roach: "On dit que le Cafard survit à tout. On dit beaucoup de choses."
};

function generateEpitaph(deathContext) {
    const { cause, enemyName, bountyHunter } = deathContext;
    const floor = gameState.currentFloor;
    const fleesThisRun = gameState.fleesThisRun || 0;
    const ridiculousItem = findRidiculousEquippedItem();

    let pool = EPITAPH_TEMPLATES[cause] || EPITAPH_TEMPLATES.combat;
    let deltaNiveau = null;
    if (cause === 'combat' || cause === 'backfire') {
        const mobLevel = getMobLevelEquivalent();
        deltaNiveau = gameState.level - mobLevel;
        if (cause === 'combat' && bountyHunter) {
            pool = EPITAPH_TEMPLATES.chasseurPrime; // Règle spéciale : abattu par un chasseur de primes
        } else if (cause === 'combat' && deltaNiveau >= NECROLOGIE_WEAK_MOB_DELTA) {
            pool = EPITAPH_TEMPLATES.mobFaible; // Règle spéciale : mob très inférieur -> épitaphe dédiée
        } else if (cause === 'backfire') {
            pool = EPITAPH_TEMPLATES.backfire; // Règle spéciale : mort par backfire -> épitaphe dédiée
        }
    }

    let text = pick(pool)
        .replace(/\{\{mob\}\}/g, enemyName || "un adversaire anonyme")
        .replace(/\{\{etage\}\}/g, floor)
        .replace(/\{\{deltaNiveau\}\}/g, deltaNiveau !== null ? Math.abs(deltaNiveau) : "")
        .replace(/\{\{cause\}\}/g, DEATH_CAUSE_LABELS[cause] || "on ne sait comment")
        .replace(/\{\{crawler\}\}/g, gameState.playerName || "le crawler");

    if (fleesThisRun >= NECROLOGIE_FLEE_THRESHOLD) {
        text += " " + pick(EPITAPH_FLEE_MENTIONS).replace(/\{\{fuites\}\}/g, fleesThisRun);
    }
    const raceMention = gameState.race && EPITAPH_RACE_MENTIONS[gameState.race];
    if (raceMention) text += " " + raceMention;
    if (ridiculousItem) {
        text += " " + pick(EPITAPH_RIDICULOUS_ITEM_MENTIONS).replace(/\{\{objetRidicule\}\}/g, ridiculousItem.name);
    }
    return text;
}

// Enregistre l'épitaphe dans le journal persistant (gameState.necrologie), plus récente en premier,
// plafonné à NECROLOGIE_MAX_ENTRIES. Aucun écran de lecture dédié pour l'instant : préparé pour un
// futur journal consultable, persistant en save via le mécanisme d'autosauvegarde existant.
function recordEpitaph(text, deathContext) {
    if (!Array.isArray(gameState.necrologie)) gameState.necrologie = [];
    gameState.necrologie.unshift({
        text,
        floor: gameState.currentFloor,
        cause: deathContext.cause,
        date: Date.now()
    });
    if (gameState.necrologie.length > NECROLOGIE_MAX_ENTRIES) {
        gameState.necrologie.length = NECROLOGIE_MAX_ENTRIES;
    }
}

// Ajoute un objet généré à l'inventaire. Les consommables ne sont jamais limités (slots dédiés
// infinis) ; seuls les objets d'équipement (armes/armures/armes à distance) comptent dans la
// capacité limitée (gameState.maxInventory). Un parchemin de sort (catégorie 'scrolls') rejoint
// gameState.spellbook (inventaire magique dédié) plutôt que gameState.inventory : lui non plus
// n'est jamais limité, au même titre que les consommables (voir equipSpell()).
// `options` est transmis tel quel à generateItem() (generator.js) : `source` ('explore' | 'mob' |
// 'elite' | 'boss' | 'treasure') pilote la rareté, `itemLevel` le niveau d'objet (défaut : étage).
function addLoot(options = {}) {
    // Chanceux (qualificatif porté) : chance que le butin monte d'un palier (voir rollLootRarity()).
    const luckChance = sumEquippedQualifier('lucky', 'chance');
    storeLootItem(generateItem(luckChance > 0 ? { ...options, luckChance } : options));
}

// Range un objet déjà construit (loot ou objet signature) : grimoire, inventaire, ou perdu si la
// réserve d'équipement est pleine. `prefix` : décoration du message de log (objet signature).
function storeLootItem(item, prefix = "") {
    // Pastille « nouveau » sur la barre d'icônes (chantier 9) jusqu'à l'ouverture du Sac / du Grimoire.
    if (item.category !== 'consumables') item.isNew = true;
    if (item.category === 'scrolls') {
        gameState.spellbook.push(item);
        gameState.floorStats.itemsFound += 1;
        playSfx('itemPickup');
        logEvent(`${prefix}Sort appris : [${formatItemDisplayName(item)}] !`, "loot");
        updateSpellbookUI();
        recordRunEvent('spellLearned', { item });
        return true;
    }
    const isConsumable = item.category === 'consumables';
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    if (isConsumable || equipmentCount < gameState.maxInventory) {
        gameState.inventory.push(item);
        gameState.floorStats.itemsFound += 1;
        playSfx('itemPickup');
        logEvent(`${prefix}Objet obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
        recordRunEvent('itemStored', { item });
        return true;
    }
    // Réserve pleine : revendu d'office à LOOT_OVERFLOW_SELL_RATIO du prix de revente marchand plutôt que
    // perdu (demandé par l'utilisateur) — le seul point de passage de tout butin (exploration, combat, boss,
    // objet signature, boîte de succès), donc la règle s'applique partout sans rien dupliquer.
    const price = getOverflowSellPrice(item);
    gameState.gold += price;
    playSfx('goldPickup');
    logEvent(`${prefix}Réserve pleine : [${formatItemDisplayName(item)}] est revendu d'office pour ${price} PO (moitié du prix marchand).`, "info");
    recordRunEvent('overflowSold', { item, price });
    return false;
}

// Part du prix de revente marchand (getSellPrice()) obtenue pour un butin revendu d'office, réserve pleine.
const LOOT_OVERFLOW_SELL_RATIO = 0.5;

function getOverflowSellPrice(item) {
    return Math.max(1, Math.round(getSellPrice(item) * LOOT_OVERFLOW_SELL_RATIO));
}

// Objet signature d'un boss précis (bestiary.js, districtBosses.*.signatureItem) : depuis le chantier 6 (V3), il n'est plus garanti
// à la première victoire — il tombe à 100 % si le Coup de grâce a été PARFAIT, jamais sinon (jet automatique, mini-jeux désactivés,
// Coup de grâce raté ou seulement réussi, boss achevé autrement : pas d'objet signature). Avec 3 Parfaits ou plus dans le combat
// (Coup de grâce compris), l'arme gagne un qualificatif de plus (signatureReward()). Sa rareté suit l'étage courant (Rare, Épique,
// Légendaire dès l'étage 10 — getSignatureRarity()), au niveau d'objet du butin du boss (voir buildSignatureItem() dans generator.js).
function awardBossSignatureItem(boss, itemLevel = gameState.currentFloor, outcome = {}) {
    if (!boss || !boss.signatureItem) return;
    const reward = signatureReward(!!outcome.perfectFinisher, outcome.perfects || 0);
    if (!reward.awarded) {
        logEvent(`🗡️ Sans Coup de grâce parfait, l'objet signature de ${boss.name} vous échappe.`, "info");
        return;
    }
    const key = boss.baseName || boss.name;
    if (!gameState.signaturesAwarded.includes(key)) gameState.signaturesAwarded.push(key);
    storeLootItem(buildSignatureItem(boss.signatureItem, itemLevel, getSignatureRarity(gameState.currentFloor).key, { extraQualifier: reward.extraQualifier }), "✨ Objet signature — ");
}

// Point de passage UNIQUE pour toute perte de PV du joueur (piège, saignement, riposte ennemie...) —
// clampe à 0 et alimente le tally de l'étage en cours (gameState.floorStats.damageTaken, voir écran
// d'escalier). Remplace les mutations directes de gameState.hp dispersées dans le code de combat/
// exploration, pour ne jamais avoir à retrouver tous ces points d'appel séparément (ex : un futur
// hook d'anomalie qui multiplierait les dégâts subis n'aurait qu'ICI à s'accrocher).
// Renvoie les PV réellement perdus (après Armure de scénario et Increvable) : les journaux de combat doivent afficher ce montant-là, pas le coup d'origine.
function applyPlayerDamage(amount) {
    if (!amount || amount <= 0) return 0;
    amount = applyPlotArmor(amount); // Armure de scénario (chantier 15, lot 4) : d'abord, pour que l'Increvable du Cafard reste disponible pour la suite
    amount = applyRaceLastStand(amount); // Cafard mutant : Increvable (chantier 13)
    if (!(amount > 0)) return 0;
    gameState.hp = Math.max(0, gameState.hp - amount);
    gameState.floorStats.damageTaken += amount;
    recordRunEvent('damageTaken', { amount }); // Chronique de run (chantier 2)
    return amount;
}

// Point de passage UNIQUE pour tout gain de PV du joueur (potion, trouvaille, régénération passive,
// mécanique d'arme/armure, compagnon Médecin...) — clampe à gameState.maxHp et applique
// gameState.anomalyEffects.healingMult (voir PEAU_DE_VERRE dans anomalies.js). Renvoie le soin
// RÉELLEMENT appliqué (après multiplicateur et clamp), pour que les messages de log restent honnêtes
// même quand l'anomalie change le montant affiché.
function applyPlayerHeal(amount) {
    if (!amount || amount <= 0) return 0;
    const mult = (gameState.anomalyEffects.healingMult || 1) * (originRaceEffects().healMult || 1); // PEAU_DE_VERRE, Goule (chantier 13)
    const before = gameState.hp;
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + amount * mult);
    return Math.round(gameState.hp - before);
}

// Recalcule gameState.maxHp à partir de la vraie progression (gameState.baseMaxHp, faite avancer
// uniquement par gainXp()) × le multiplicateur de l'anomalie active (PEAU_DE_VERRE) — jamais l'inverse.
// Appelé après tout changement de l'un des deux (montée de niveau, changement d'étage). Clampe
// gameState.hp au nouveau maximum s'il le dépasse (jamais de PV "en trop" affichés).
function recomputeMaxHp() {
    const mult = gameState.anomalyEffects.playerMaxHpMult || 1;
    // Robuste (qualificatif d'armure) : PV max +%, tant que l'armure est portée.
    const sturdy = getItemQualifierValues(gameState.equipment.armor, 'sturdy', 'armor');
    const gearMult = sturdy ? 1 + sturdy.pct / 100 : 1;
    const raceMult = (originRaceEffects().maxHpMult || 1) * (originClassEffects().maxHpMult || 1); // Goule, Gobelin, Troll, Cafard ; Sac de frappe (chantier 13)
    gameState.maxHp = Math.max(1, Math.round(gameState.baseMaxHp * mult * gearMult * raceMult));
    if (gameState.hp > gameState.maxHp) gameState.hp = gameState.maxHp;
}

// ==========================================
// SYSTÈME DE NIVEAU ET D'EXPÉRIENCE
// ==========================================
function gainXp(amount) {
    if (!amount || amount <= 0) return;
    amount = Math.round(amount * (gameState.anomalyEffects.xpMult || 1) * (originRaceEffects().xpMult || 1)); // MOB_ENRAGE (anomalies.js), Humain (chantier 13)
    gameState.xp += amount;
    gameState.floorStats.xpGained += amount;
    logEvent(`+${amount} XP`, "success");

    // On utilise une boucle "while" pour gérer le cas (rare) d'un gain d'XP
    // suffisant pour franchir plusieurs niveaux d'un coup.
    if (gameState.xp >= gameState.xpToNextLevel) playSfx('levelUp'); // un seul arpège, même pour plusieurs niveaux
    while (gameState.xp >= gameState.xpToNextLevel) {
        gameState.xp -= gameState.xpToNextLevel;
        gameState.level += 1;
        gameState.xpToNextLevel = Math.round(gameState.xpToNextLevel * 1.25); // Chaque niveau demande un peu plus d'XP

        // Gains de statistiques à la montée de niveau (croissants avec le niveau atteint, pour que
        // le joueur ne décroche pas en fin de run une fois les niveaux plus rares — voir issue
        // d'équilibrage "Mur XP étages 6-9" : le scaling des mobs, lui, continue de grimper à taux
        // fixe par étage).
        const hpGain = 15;
        const atkGain = 2 + Math.floor(gameState.level / 4);
        const defGain = 1 + Math.floor(gameState.level / 5);
        gameState.baseMaxHp += hpGain;
        recomputeMaxHp(); // Applique aussi l'éventuel multiplicateur d'anomalie (PEAU_DE_VERRE) courant
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
    amount += gameState.anomalyEffects.skillXpPerActionBonus || 0; // TEMPO_CREE (anomalies.js)

    skill.xp += amount;
    if (skill.xp >= skill.xpToNext) playSfx('skillUp');
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
// 4. CARTE DE L'ÉTAGE (BOROUGH : 4 BLOCS DE QUARTIER + AVENUES)
// ==========================================
// Chantier 5 « rework de la carte » (voir NOTES_CARTE.md) : la géométrie vient du générateur PUR
// floorgen.js (generateBorough()) — 4 blocs de quartier (2 × 2) séparés par des avenues (croix +
// anneau), des salles rectangulaires reliées par des couloirs courts, 2-3 portes par bloc sur les
// avenues. Ici, on ne fait qu'habiller ce résultat pour le jeu : quartiers tirés, types de salles sûres,
// escalier, anomalies. Le reste du jeu ne voit l'étage qu'à travers roomsById / neighbors / type /
// visited, computeDistance() et enterRoom().

// Version du format de gameState.floorMap : une sauvegarde d'un format plus ancien ne peut pas reprendre
// son étage (voir restoreSaveForName()).
const FLOOR_MAP_VERSION = 2;

// Salle courante de l'étage classique (null hors étage classique).
function currentFloorRoom() {
    const fm = gameState.floorMap;
    return fm ? fm.roomsById[fm.currentRoomId] || null : null;
}

// Zone de la salle (ZONE_TYPES, floorgen.js) : 'block' ou 'avenue'.
function roomZone(room) {
    return (room && room.zone) || 'block';
}

// Quartier d'une salle : celui de son bloc ; une avenue n'appartient à aucun quartier.
function roomDistrict(room) {
    const fm = gameState.floorMap;
    if (fm && fm.kind === 'urban') return fm.theme; // Étage urbain : un seul thème pour tout l'étage
    if (!fm || !room || room.quadrant === null || room.quadrant === undefined) return null;
    return fm.quadrants[room.quadrant] ? fm.quadrants[room.quadrant].district : null;
}

// Se place dans une salle de l'étage. Le quartier courant (décor, mobs) suit le bloc où l'on se trouve ;
// sur une avenue, on garde le dernier quartier traversé. Renvoie vrai si le quartier vient de changer.
function moveToFloorRoom(room) {
    const fm = gameState.floorMap;
    fm.currentRoomId = room.id;
    if (room.cityId) fm.currentCityId = room.cityId; // Étage urbain : dernière ville traversée
    if (room.quadrant === null || room.quadrant === undefined || room.quadrant === fm.currentQuadrant) return false;
    fm.currentQuadrant = room.quadrant;
    gameState.currentDistrict = fm.quadrants[room.quadrant].district;
    return true;
}

// Génère l'étage classique : 4 quartiers distincts tirés au hasard, un bloc chacun ; l'escalier est gardé
// par le boss de l'un des 4 blocs ; départ aléatoire hors de danger (voir pickSafeStartRoom(), floorgen.js).
function generateFloorMap() {
    const pool = [...Object.keys(districts)];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // LABYRINTHE (anomalies.js) : +50 % de salles par bloc (bloc agrandi d'autant, même densité).
    const floor = generateBorough({ districts: pool.slice(0, 4), extraRoomsPct: gameState.anomalyEffects.extraRoomsPct || 0 });
    const { roomsById, quadrants } = floor;

    Object.values(roomsById).forEach(room => {
        if (room.type === 'safe') room.safehouse = pickSafehouseType();
    });

    const stairsQuadrant = Math.floor(Math.random() * 4);
    roomsById[quadrants[stairsQuadrant].bossRoomId].guardsStairs = true;

    // Départ : si c'est un tronçon d'avenue, le quartier « courant » (décor, mobs) est celui du bloc le
    // plus proche, jusqu'au premier bloc traversé.
    const start = roomsById[floor.startRoomId];
    let startQuadrant = start.quadrant;
    if (startQuadrant === null) {
        const hops = hopDistances(roomsAdjacency(roomsById), [start.id]);
        const nearest = Object.values(roomsById)
            .filter(r => r.zone === 'block')
            .sort((a, b) => (hops[a.id] - hops[b.id]) || (a.id < b.id ? -1 : 1))[0];
        startQuadrant = nearest.quadrant;
    }

    gameState.floorMap = {
        version: FLOOR_MAP_VERSION,
        geometry: floor.geometry,
        quadrants,
        roomsById,
        stairsQuadrant,
        currentQuadrant: startQuadrant,
        currentRoomId: start.id,
        startRoomId: start.id
    };
    start.visited = true;
    gameState.currentDistrict = quadrants[startQuadrant].district;

    // CAFET_ASSOMBRIE (anomalies.js) : une salle ordinaire d'un bloc au hasard (jamais le départ, un boss ou
    // une salle sûre) cache un piège sévère + un trésor nettement supérieur — voir enterRoom().
    if (gameState.anomalyEffects.cafetRoom) {
        const candidates = Object.values(roomsById).filter(r => r.type === 'normal' && r.zone === 'block' && r.id !== start.id);
        if (candidates.length > 0) {
            candidates[Math.floor(Math.random() * candidates.length)].cafetRoom = true;
        }
    }
}

// Distance de trajet (Dijkstra) entre deux salles de l'étage, tous quartiers et avenues confondus : somme
// des `cost` des couloirs empruntés — longueur réelle du couloir convertie en unités de trajet, × 0,5 sur les
// avenues (ZONE_TYPES.avenue.travelMult, floorgen.js), plus rapides et plus sûres. Le temps et le risque
// d'embuscade d'un trajet en dépendent (voir travelToRoom()). Arrondie au dixième. null si aucun chemin
// (ne devrait pas arriver, l'étage est connexe par construction).
function computeDistance(fromRoomId, toRoomId) {
    if (fromRoomId === toRoomId) return 0;
    const path = computeFloorPath(fromRoomId, toRoomId);
    return path ? Math.round(path.cost * 10) / 10 : null;
}

// Plus court chemin (Dijkstra sur les `cost`) : { cost, rooms: [ids, départ et arrivée compris] } ou null.
// `canPass(id)` limite les salles intermédiaires (ex. seulement les salles visitées, voir planTravelToRoom()).
function computeFloorPath(fromRoomId, toRoomId, canPass = null) {
    const roomsById = gameState.floorMap.roomsById;
    const dist = { [fromRoomId]: 0 };
    const prev = {};
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
        if (currentId === null) return null;
        if (currentId === toRoomId) {
            const rooms = [toRoomId];
            while (rooms[0] !== fromRoomId) rooms.unshift(prev[rooms[0]]);
            return { cost: currentCost, rooms };
        }

        visited.add(currentId);
        const room = roomsById[currentId];
        if (!room) continue;
        room.neighbors.forEach(edge => {
            // `canPass` (optionnel) : salles traversables en chemin (la destination l'est toujours).
            if (canPass && edge.to !== toRoomId && !canPass(edge.to)) return;
            const weight = edge.cost !== undefined ? edge.cost : (edge.kind === 'artery' ? 1 : 2);
            const newCost = currentCost + weight;
            if (dist[edge.to] === undefined || newCost < dist[edge.to]) {
                dist[edge.to] = newCost;
                prev[edge.to] = currentId;
            }
        });
    }
}

// ==========================================
// ÉTAGES URBAINS : VILLES EXPLORABLES (multiples de 3 — chantier 12, voir NOTES_VILLES.md)
// ==========================================
// Géométrie PURE dans floorgen.js (generateMetropolis()) : villes de 3 à 5 salles (place, auberge, boutique
// ou professeur, escalier, ruelles), routes découpées en tronçons explorés pas à pas, repaires en impasse.
// L'étage passe ensuite par EXACTEMENT la même machinerie qu'un étage classique : gameState.floorMap
// (kind 'urban'), travelToRoom()/performExploreStep()/enterRoom(), carte stylisée floormap.js.

// Noms de villes génériques, piochés sans répétition à chaque génération d'étage urbain.
const URBAN_CITY_NAMES = [
    "Vieille Ville", "Quartier Nord", "Quartier Sud", "Zone Industrielle", "Cité-Dortoir",
    "Centre Commercial Abandonné", "Faubourg", "Le Ghetto", "Quartier des Affaires",
    "Banlieue Résidentielle", "Port Fluvial", "Terminus"
];

// Vrai sur un étage urbain (villes et routes).
function isUrbanFloor() {
    const fm = gameState.floorMap;
    return !!(fm && fm.kind === 'urban');
}

// Ville d'une salle urbaine (null pour une route, un repaire ou hors étage urbain).
function roomCity(room) {
    const fm = gameState.floorMap;
    return fm && fm.citiesById && room && room.cityId ? fm.citiesById[room.cityId] || null : null;
}

// Ville par identifiant (boutique ou professeur en cours de visite, voir triggerShopEncounter()).
function urbanCityById(cityId) {
    const fm = gameState.floorMap;
    return fm && fm.citiesById && cityId ? fm.citiesById[cityId] || null : null;
}

// Génère l'étage urbain : réseau de villes (generateMetropolis(), floorgen.js), puis habillage de jeu — noms
// des villes, spécialité du marchand / du professeur, thème de chaque auberge, gardien de l'escalier (ou de
// la Sortie à l'étage final, toujours gardée), état des repaires. Départ sur la place de la première ville.
function generateUrbanFloorMap() {
    const floor = gameState.currentFloor;
    const isFinal = floor === config.urbanFloors.finalFloor;
    const theme = config.urbanFloors.themes[floor] || config.urbanFloors.themes[3];
    const metro = generateMetropolis({
        cityCount: 6 + Math.floor(floor / 9), // Légère croissance avec la profondeur
        lairCount: isFinal ? config.urbanFloors.lairRoadsFinalFloor : config.urbanFloors.lairRoadsPerFloor,
        specializedChance: config.urbanFloors.specializedCityChance,
        arcadeCount: config.urbanFloors.arcadeCitiesMin + Math.floor(Math.random() * (config.urbanFloors.arcadeCitiesMax - config.urbanFloors.arcadeCitiesMin + 1))
    });
    const namePool = [...URBAN_CITY_NAMES];
    const citiesById = {};
    metro.cities.forEach((city, i) => {
        city.name = namePool.splice(Math.floor(Math.random() * namePool.length), 1)[0] || `Secteur ${i + 1}`;
        city.specialty = city.role === 'merchant' ? pick(['weapons', 'ranged', 'armors', 'scrolls'])
            : city.role === 'trainer' ? pick(['weapon', 'unarmed', 'magic', 'stealth']) : null;
        city.stock = null; // Stock du marchand : généré une seule fois, à la première visite (triggerShopEncounter())
        city.visited = false;
        citiesById[city.id] = city;
    });
    const roomsById = metro.roomsById;
    const guardChance = config.urbanFloors.stairsGuardChanceByFloor[floor] || 50;
    Object.values(roomsById).forEach(room => {
        if (room.type === 'safe') room.safehouse = pickSafehouseType(); // Auberge : même repos qu'une salle sûre
        if (room.type === 'stairs') {
            room.isExit = isFinal;
            room.guardsStairs = true;
            room.guarded = isFinal || Math.random() * 100 < guardChance; // La Sortie est toujours gardée
            room.bossInstance = null;
            room.defeated = false;
        }
    });
    const lairsById = {};
    metro.lairs.forEach(l => {
        lairsById[l.id] = { ...l, cleared: false, combatsRemaining: 2 + Math.floor(Math.random() * 2), bossInstance: null };
    });
    const start = roomsById[metro.startRoomId];
    gameState.floorMap = {
        kind: 'urban',
        version: FLOOR_MAP_VERSION,
        theme,
        isFinalFloor: isFinal,
        geometry: { width: metro.geometry.width, height: metro.geometry.height, roads: metro.geometry.roads },
        quadrants: [],
        roomsById,
        citiesById,
        lairsById,
        currentQuadrant: null,
        currentRoomId: start.id,
        startRoomId: start.id,
        currentCityId: start.cityId
    };
    start.visited = true;
    citiesById[start.cityId].visited = true;
    // Thématique unique de l'étage : generateMob()/generateBoss() la reçoivent comme un nom de quartier.
    gameState.currentDistrict = theme;
}

// Entrée dans une salle d'un étage urbain (appelée par enterRoom()) : renvoie vrai si la salle a été gérée
// ici (place, boutique, professeur, escalier, repaire), faux pour l'auberge, les ruelles et les tronçons
// de route, qui suivent le comportement commun (repos, événement de la zone, chemin connu).
function enterUrbanRoom(room, firstVisit) {
    const city = roomCity(room);
    if (city) {
        gameState.floorMap.currentCityId = city.id;
        city.visited = true;
    }
    if (room.type === 'stairs') {
        enterUrbanStairs(room);
        return true;
    }
    if ((room.type === 'shop' || room.type === 'trainer') && city) {
        triggerShopEncounter(city);
        return true;
    }
    if (room.type === 'arcade' && city) {
        triggerArcade(city);
        return true;
    }
    if (room.type === 'lair') {
        enterLair(room);
        return true;
    }
    if (room.cityRole === 'plaza' && city) {
        setSceneHeader('🏙️', city.name, 'Ville sûre', { key: 'citySafe', cityName: city.name });
        logEvent(
            firstVisit
                ? `Vous découvrez ${city.name}. Les rues sont calmes ici — vous pouvez souffler.`
                : `Vous retrouvez la place de ${city.name}, toujours aussi tranquille.`,
            "success"
        );
        return true;
    }
    return false;
}

// Salle de l'escalier (ou de la Sortie) au fond de sa ville : gardien à combattre ou à laisser pour plus
// tard (même choix qu'un boss de quartier, triggerBossEncounter()), sinon escalier libre (choix Descendre /
// Rester) ou victoire immédiate pour la Sortie de l'étage final.
function enterUrbanStairs(room) {
    if (room.guarded && !room.defeated) {
        triggerBossEncounter(room);
        return;
    }
    if (room.isExit) {
        logEvent("La Sortie est là, grande ouverte.", "info");
        winGame();
        return;
    }
    logEvent("La voie est libre !", "success");
    offerStairsChoice({ kind: 'room', roomId: room.id });
}

// Montant volé par un pickpocket (pure) : config.pickpocket.pct % des PO, au moins `min`, au plus `max`,
// jamais plus que ce qu'on a.
function computePickpocketLoss(gold) {
    const cfg = config.pickpocket;
    if (!gold || gold <= 0) return 0;
    return Math.min(gold, Math.max(cfg.min, Math.min(cfg.max, Math.round(gold * cfg.pct / 100))));
}

// ==========================================
// REPAIRES (impasses accrochées à une route, voir generateMetropolis())
// ==========================================

// Entrée dans un repaire : choix plonger / ressortir, ou repaire déjà nettoyé.
function enterLair(room) {
    const lair = gameState.floorMap.lairsById[room.lairId];
    if (!lair || lair.cleared) {
        setSceneHeader('🏆', 'Repaire Nettoyé', 'Route', 'emptyLair');
        logEvent("Le repaire est désert : vous l'avez déjà nettoyé.", "normal");
        return;
    }
    triggerLairChoice(lair);
}

// Présente le choix "plonger / ressortir". Toujours optionnel : ressortir laisse le repaire intact, il sera
// reproposé au prochain passage.
function triggerLairChoice(lair) {
    gameState.lairChoicePending = true;
    gameState.pendingLairId = lair.id;
    setSceneHeader('💀', 'Repaire', 'Route', 'lairSpotted');
    logEvent("Un repaire hostile s'ouvre au bord de la route. Plonger dedans (combats enchaînés, butin garanti), ou ressortir sans l'affronter ?", "danger");
    ui.lairChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Plonger" : lance le premier combat forcé de la séquence (voir winCombat() pour
// l'enchaînement combats → boss → butin garanti, et attemptFlee() pour une fuite en cours de route).
function diveIntoLair() {
    const lairId = gameState.pendingLairId;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    ui.lairChoiceZone.classList.add('hidden');
    const lair = gameState.floorMap && gameState.floorMap.lairsById[lairId];
    if (!lair) return;

    gameState.pendingLairDive = { lairId, combatsLeft: lair.combatsRemaining, stage: 'trash' };
    logEvent("Vous plongez dans le repaire...", "danger");
    initiateCombat();
}

// Bouton "Ressortir" : le repaire reste intact (reproposé au prochain passage).
function declineLair() {
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    ui.lairChoiceZone.classList.add('hidden');
    setSceneHeader('💀', 'Repaire', 'Route', 'lairSpotted');
    logEvent("Vous ressortez du repaire sans bruit. Il vous attendra.", "info");
    updateUI();
}

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
    playSfx('shopBuy');
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
    playSfx('shopBuy');
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

// ---------- Carte stylisée des étages classiques (chantier 5, voir NOTES_CARTE.md) ----------
// Rendu pur dans floormap.js (buildFloorMapSvg()) ; ici, le panneau : vue (zoom + caméra, préférences
// d'affichage — variables de module comme mapPanelOpen, jamais sauvegardées), salle sélectionnée et bulle
// « Y aller / Annuler » (travelToRoom()), glissement et toucher (attachés UNE fois, voir plus bas).
let floorMapZoom = FLOOR_MAP_DEFAULT_ZOOM;
let floorMapCamera = null;      // null = centrée sur le crawler ; {x, y} = centre choisi en glissant
let floorMapSelectedRoomId = null;
let floorMapLiveView = null;    // fenêtre affichée au dernier rendu (monde), pour le glissement et le toucher

// Contenu de la bulle pour une salle (pure vis-à-vis du DOM) : { title, text } ou null si hors d'atteinte.
function describeFloorMapTravel(roomId) {
    const plan = planTravelToRoom(roomId);
    if (!plan) return null;
    const risk = plan.ambushChance > 0 ? `, risque d'embuscade ${Math.round(plan.ambushChance)} %` : "";
    if (plan.exploreStep && plan.timeCost === 0) {
        return { title: `Explorer : ${plan.label}`, text: "Un pas dans l'inconnu (-1 H), comme en touchant la scène, mais par là." };
    }
    if (plan.exploreStep) {
        return { title: `Explorer : ${plan.label}`, text: `Trajet par le chemin connu (-${plan.timeCost} H${risk}), puis un pas dans l'inconnu (-1 H).` };
    }
    return { title: `Aller : ${plan.label}`, text: `Trajet par le chemin connu : -${plan.timeCost} H${risk}.` };
}

// Légende sous la carte, selon le type d'étage.
const FLOOR_MAP_LEGENDS = {
    classic: "Plein = visité · pointillé « ? » = aperçu · 👑 boss · 🪜 escalier · 🟡 vous · avenues : trajets deux fois plus rapides et plus sûrs",
    urban: "Plein = visité · pointillé « ? » = aperçu · villes calmes, routes dangereuses · 🛒 marchand · 🎓 professeur · 🎰 salle de jeux · 👑 gardien · 🪜 escalier · 💀 repaire · 🟡 vous"
};

function updateFloorMapUI() {
    if (!ui.floorMapSvg) return;
    const fm = gameState.floorMap;
    if (ui.floorMapLegend) ui.floorMapLegend.innerText = FLOOR_MAP_LEGENDS[isUrbanFloor() ? 'urban' : 'classic'];
    if (!fm || !fm.geometry) {
        ui.floorMapSvg.innerHTML = "";
        floorMapSelectedRoomId = null;
        if (ui.floorMapBubble) ui.floorMapBubble.classList.add('hidden');
        return;
    }
    const view = floorMapDefaultView(fm, floorMapZoom, floorMapCamera);
    floorMapLiveView = view;
    ui.floorMapSvg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    if (floorMapSelectedRoomId && (floorMapSelectedRoomId === fm.currentRoomId || !planTravelToRoom(floorMapSelectedRoomId))) floorMapSelectedRoomId = null;
    ui.floorMapSvg.innerHTML = buildFloorMapSvg(fm, { landmarks: listFloorLandmarks(), selectedRoomId: floorMapSelectedRoomId });

    const info = floorMapSelectedRoomId ? describeFloorMapTravel(floorMapSelectedRoomId) : null;
    if (ui.floorMapBubble) ui.floorMapBubble.classList.toggle('hidden', !info);
    if (info) {
        if (ui.floorMapBubbleTitle) ui.floorMapBubbleTitle.innerText = info.title;
        if (ui.floorMapBubbleText) ui.floorMapBubbleText.innerText = info.text;
    }
}

// Toucher la carte au point (monde) : sélectionne la salle connue la plus proche (bulle), ou referme la bulle.
function selectFloorMapRoomAt(x, y) {
    const fm = gameState.floorMap;
    if (!fm) return null;
    const id = floorMapHitTest(fm, x, y);
    floorMapSelectedRoomId = id && id !== fm.currentRoomId && planTravelToRoom(id) ? id : null;
    updateFloorMapUI();
    return floorMapSelectedRoomId;
}

// Bouton « Y aller » de la bulle.
function confirmFloorMapTravel() {
    const id = floorMapSelectedRoomId;
    floorMapSelectedRoomId = null;
    if (!id) { updateFloorMapUI(); return null; }
    const plan = travelToRoom(id);
    updateFloorMapUI();
    return plan;
}

function cancelFloorMapTravel() {
    floorMapSelectedRoomId = null;
    updateFloorMapUI();
}

// ＋ / － (index de FLOOR_MAP_ZOOMS : 0 = vue d'ensemble) et ◎ (retour sur le crawler).
function zoomFloorMap(delta) {
    floorMapZoom = Math.max(0, Math.min(FLOOR_MAP_ZOOMS.length - 1, floorMapZoom + delta));
    updateFloorMapUI();
}

function recenterFloorMap() {
    floorMapCamera = null;
    updateFloorMapUI();
}

// Glissement (souris et tactile) et toucher sur la carte : attachés UNE seule fois au <svg> (jamais à
// chaque rendu). Pendant le glissement, seul le viewBox bouge ; à la fin, la caméra est mémorisée. Un
// relâchement sous 6 px de mouvement est un toucher, résolu par position MONDE (floorMapHitTest()) —
// pas par le `click` natif, peu fiable après une capture de pointeur (constaté en navigateur réel).
function attachFloorMapPointerHandlers(svg) {
    if (!svg || !svg.addEventListener) return;
    let drag = null;
    const toWorld = (e, view) => {
        const rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0, width: view.w, height: view.h };
        // preserveAspectRatio « meet » : même échelle sur les deux axes, fenêtre centrée.
        const scale = Math.max(view.w / (rect.width || view.w), view.h / (rect.height || view.h));
        const offX = (rect.width * scale - view.w) / 2, offY = (rect.height * scale - view.h) / 2;
        return { x: view.x + (e.clientX - rect.left) * scale - offX, y: view.y + (e.clientY - rect.top) * scale - offY, scale };
    };
    svg.addEventListener('pointerdown', (e) => {
        if (!floorMapLiveView) return;
        const w = toWorld(e, floorMapLiveView);
        drag = { startX: e.clientX, startY: e.clientY, view: { ...floorMapLiveView }, scale: w.scale, moved: false, pointerId: e.pointerId };
        if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ } }
    });
    svg.addEventListener('pointermove', (e) => {
        if (!drag || !gameState.floorMap) return;
        const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) <= 6) return;
        drag.moved = true;
        const moved = clampFloorMapView({ ...drag.view, x: drag.view.x - dx * drag.scale, y: drag.view.y - dy * drag.scale }, gameState.floorMap);
        floorMapLiveView = moved;
        svg.setAttribute('viewBox', `${moved.x} ${moved.y} ${moved.w} ${moved.h}`);
    });
    const end = (e) => {
        if (!drag) return;
        if (svg.releasePointerCapture && drag.pointerId !== undefined) { try { svg.releasePointerCapture(drag.pointerId); } catch (err) { /* déjà relâché */ } }
        if (drag.moved) {
            floorMapCamera = { x: floorMapLiveView.x + floorMapLiveView.w / 2, y: floorMapLiveView.y + floorMapLiveView.h / 2 };
        } else if (e && e.type === 'pointerup' && !isActionBlocked()) {
            const w = toWorld(e, drag.view);
            selectFloorMapRoomAt(w.x, w.y);
        }
        drag = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
}

// Point d'entrée unique pour "arriver" dans une pièce, que ce soit en explorant normalement ou en
// y voyageant depuis la carte (voir arriveAtDestination) : le comportement est donc identique
// dans les deux cas.
function enterRoom(room) {
    const firstVisit = !room.visited;
    room.visited = true;

    // Étage urbain (chantier 12) : place, boutique, professeur, escalier et repaire ont leur propre entrée.
    if (isUrbanFloor() && enterUrbanRoom(room, firstVisit)) return;

    if (room.type === 'boss') {
        if (room.defeated && room.guardsStairs) {
            offerStairsChoice({ kind: 'room', roomId: room.id }); // Retour à un escalier laissé pour plus tard
            return;
        }
        if (room.defeated) {
            setSceneHeader('🏚️', 'Antre Silencieuse', 'Exploration', 'emptyLair');
            logEvent("L'antre est silencieuse désormais ; le boss a déjà été vaincu.", "normal");
            return;
        }
        triggerBossEncounter(room);
        return;
    }

    if (room.type === 'safe') {
        // Entrée à choix explicite (chantier "QoL/équilibrage" — voir restAtSafehouse()/
        // leaveSafehouse() plus bas) : plus de soin automatique ni de coût de temps à l'entrée
        // elle-même. La salle est marquée sur la carte dès l'entrée (visitée), quelle que soit l'issue
        // choisie ensuite (comportement conservé de l'ancienne version).
        const safehouse = room.safehouse || { name: "Salle Sécurisée", icon: "🏥", desc: "" };
        gameState.safehouseChoicePending = true;
        gameState.pendingSafehouseRoomId = room.id;

        setSceneHeader(safehouse.icon, safehouse.name, 'Repos');
        logEvent(
            firstVisit
                ? `Vous découvrez : ${safehouse.name}. ${safehouse.desc}`
                : `Vous retrouvez ${safehouse.name}, toujours aussi accueillant.`,
            "info"
        );

        updateSafehouseRestButtons();
        ui.safehouseChoiceZone.classList.remove('hidden');
        renderScene('safehouse');
        updateUI();
        return;
    }

    // Pièce normale
    if (firstVisit) {
        if (room.cafetRoom) {
            triggerCafetRoom(room);
            return;
        }
        resolveCardEvent();
    } else {
        setSceneHeader('🌑', 'Chemin Connu', 'Exploration', 'knownPath');
        logEvent("Vous retraversez un couloir déjà exploré, rien de neuf.", "normal");
    }
}

// Libellés des deux repos d'une salle sécurisée (boutons #btn-nap-safehouse/#btn-sleep-safehouse).
const SAFEHOUSE_REST_LABELS = { nap: '💤 Sieste', sleep: '🛌 Sommeil réparateur' };

// Ce qu'un repos rendrait maintenant (pure) : `healPct` des PV perdus et du mana manquant — le mana
// seulement si un sort est équipé. Montants AVANT le multiplicateur de soin des anomalies
// (PEAU_DE_VERRE), appliqué ensuite par applyPlayerHeal() comme à tout soin.
function safehouseRestAmounts(kind, state = gameState) {
    const rest = config.safehouse[kind];
    const hp = Math.round(rest.healPct * Math.max(0, state.maxHp - state.hp));
    const mana = state.equipment.spell ? Math.round(rest.healPct * Math.max(0, state.maxMana - state.mana)) : 0;
    return { hp, mana };
}

// Vrai si le repos `kind` est possible : garde-fou, un repos ne doit JAMAIS pouvoir amener timeLeft à 0
// (voir CLAUDE.md), sauf REPAS_DE_FAMILLE (anomalies.js) qui rend les deux repos gratuits en temps.
function canRestAtSafehouse(kind) {
    return !!gameState.anomalyEffects.freeSafehouseMeals || gameState.timeLeft - config.safehouse[kind].cost > 0;
}

// Met à jour les deux boutons de repos à l'entrée dans la salle : coût en temps, PV (et mana) rendus, et
// bouton désactivé dès l'affichage si le temps manque — visible avant toute tentative, pas seulement au clic.
function updateSafehouseRestButtons() {
    const free = gameState.anomalyEffects.freeSafehouseMeals;
    [['nap', ui.btnNapSafehouse], ['sleep', ui.btnSleepSafehouse]].forEach(([kind, btn]) => {
        if (!btn) return;
        const { hp, mana } = safehouseRestAmounts(kind);
        const lines = [free ? '0H' : `-${config.safehouse[kind].cost}H`, `+${hp} PV`];
        if (gameState.equipment.spell) lines.push(`+${mana} mana`);
        const can = canRestAtSafehouse(kind);
        btn.disabled = !can;
        btn.title = can ? "" : "Pas assez de temps pour vous reposer";
        btn.innerHTML = `<span class="block mb-0.5">${SAFEHOUSE_REST_LABELS[kind]}</span>`
            + lines.map(l => `<span class="block text-[10px] normal-case tracking-normal opacity-80 whitespace-nowrap">${l}</span>`).join('');
    });
}

// Repos dans une salle sécurisée (voir enterRoom()) : `kind` 'nap' (Sieste) ou 'sleep' (Sommeil
// réparateur), voir config.safehouse. Coûte `cost` heures (sauf REPAS_DE_FAMILLE, anomalies.js — repas
// gratuits) et rend `healPct` des PV perdus, plus la même part du mana manquant si un sort est équipé
// (safehouseRestAmounts()). Le bouton est déjà désactivé si ce coût ferait tomber timeLeft à 0 (voir
// updateSafehouseRestButtons()) : la vérification ici est une sécurité redondante, jamais le chemin normal.
function restAtSafehouse(kind = 'nap') {
    if (!gameState.safehouseChoicePending || !config.safehouse[kind]) return;
    if (!canRestAtSafehouse(kind)) return;
    const cost = config.safehouse[kind].cost;
    const freeMeals = gameState.anomalyEffects.freeSafehouseMeals;

    const amounts = safehouseRestAmounts(kind);
    if (!freeMeals) gameState.timeLeft = Math.max(0, gameState.timeLeft - cost);
    const healed = applyPlayerHeal(amounts.hp);
    let manaNote = "";
    if (amounts.mana > 0) {
        const manaBefore = gameState.mana;
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + amounts.mana);
        const manaGained = Math.round(gameState.mana - manaBefore);
        if (manaGained > 0) manaNote = `, +${manaGained} mana`;
    }

    const costNote = freeMeals ? "repas offerts par la maison, aucun temps perdu" : `-${cost}H`;
    const intro = kind === 'sleep' ? "Vous dormez à poings fermés" : "Vous piquez un petit somme";
    logEvent(`${intro} (${costNote}, +${healed} PV${manaNote}).`, "success");
    playSfx('restSleep');

    // Le compagnon se repose aussi : même part de ses PV perdus (et il se relève s'il était à terre),
    // et un repos partagé renforce sa loyauté.
    const companion = gameState.companion;
    if (companion) {
        const companionHealed = healCompanion(Math.round(config.safehouse[kind].healPct * (companion.maxHp - companion.hp)));
        const gained = changeCompanionLoyalty(config.companions.loyalty[kind]);
        logEvent(`${companion.name} en profite aussi (+${companionHealed} PV${gained > 0 ? `, +${gained} loyauté` : ""}).`, "success");
        updateCompanionUI();
    }

    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    ui.safehouseChoiceZone.classList.add('hidden');
    recordRunEvent('rest');
    updateUI();
}

// Choix "Partir" d'une salle sécurisée : gratuit, aucun effet — la salle reste visitée et déjà
// marquée sur la carte (voir listFloorLandmarks()), simplement réutilisable lors d'un futur passage.
function leaveSafehouse() {
    if (!gameState.safehouseChoicePending) return;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    ui.safehouseChoiceZone.classList.add('hidden');
    logEvent("Vous reprenez votre chemin sans vous attarder.", "info");
    updateUI();
}

// CAFET_ASSOMBRIE (anomalies.js) : déclenché UNE fois, à la première visite de la pièce taguée
// room.cafetRoom (voir generateFloorMap()) — remplace l'événement aléatoire normal de cette pièce par
// un piège sévère suivi d'un trésor nettement supérieur à la normale (powerScore maximal). Réutilise
// exactement applyPlayerDamage()/gameOver()/addLoot(), aucune nouvelle formule de dégâts ou de loot.
function triggerCafetRoom(room) {
    const trapDmg = applyTrialToDamage(applyStarterBuffToDamage(applyRaceDamageMods(Math.floor(Math.random() * 12) + 10, 'trap'))); // 10 à 21 PV : nettement au-dessus d'un piège normal (~5-15)
    applyPlayerDamage(trapDmg);
    setSceneHeader('🕯️', 'Cafétéria Assombrie', 'Danger', 'cafeteria');
    logEvent(`Un piège vicieux se déclenche dans l'obscurité de la cafétéria abandonnée ! (-${trapDmg} PV)`, "danger");
    recordRunEvent('trap');
    if (gameState.hp <= 0) {
        gameOver(false, 'trap');
        return;
    }
    addLoot({ source: 'treasure' }); // Trésor nettement supérieur à la normale : monte d'un palier de rareté (voir rollLootRarity())
    logEvent("Malgré le piège, un trésor bien caché récompense votre prudence.", "success");
}

// Présente le choix "combattre maintenant / repérer et partir" pour une salle de boss (celle qui
// garde l'escalier y compris). Le boss est généré une seule fois et mis en cache sur la pièce
// (room.bossInstance), pour rester le même monstre si le joueur repère puis revient plus tard.
function triggerBossEncounter(room) {
    if (!room.bossInstance) {
        const district = roomDistrict(room) || gameState.currentDistrict;
        room.bossInstance = generateBoss(district) || generateMob(district);
    }
    const boss = room.bossInstance;
    gameState.pendingBossEncounter = { roomId: room.id, guardsStairs: room.guardsStairs === true };
    gameState.bossChoicePending = true;

    // Étage urbain (salle de l'escalier au fond de sa ville) : vignette du gardien devant l'escalier ou la Sortie.
    const urbanStairs = room.type === 'stairs';
    const title = urbanStairs && room.isExit ? "Gardien de la Sortie" : room.guardsStairs ? "Gardien de l'Escalier" : 'Boss de Quartier';
    setSceneHeader('👑', boss.name, title, urbanStairs ? { key: 'urbanGuardian', enemy: boss, isExit: room.isExit === true } : { key: 'bossSpotted', enemy: boss });
    logEvent(
        urbanStairs && room.isExit
            ? `🎬 Vous atteignez la Sortie... gardée par ${boss.name} !`
            : room.guardsStairs
                ? `🎬 Vous découvrez l'escalier vers l'étage ${gameState.currentFloor + 1}, gardé par ${boss.name} !`
                : `Vous découvrez l'antre de ${boss.name}, un boss de quartier !`,
        "danger"
    );
    logEvent("Le combattre maintenant, ou repérer l'endroit pour y revenir plus tard ?", "info");
    // Arrivée du boss (chantier 16) : écran plein écran la PREMIÈRE fois seulement (le boss est en cache sur sa salle,
    // les retours ne rejouent pas l'écran), avant l'affichage du choix Combattre / Repérer. Marqué vu seulement s'il a
    // réellement été affiché (réglage « Jamais », interface absente : il reste à montrer au prochain passage).
    const reveal = () => {
        ui.bossChoiceZone.classList.remove('hidden');
        updateUI();
    };
    if (boss._encounterShown) reveal();
    else boss._encounterShown = showEncounterIntro('boss', boss, reveal) === true;
}

// Bouton "Combattre" de la zone de choix de boss (boss de quartier, gardien d'escalier ou de la Sortie).
function fightBossNow() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    if (!encounter) return;

    const room = gameState.floorMap.roomsById[encounter.roomId];
    gameState.pendingStairAfterCombat = !!encounter.guardsStairs;
    gameState.pendingBossRoomId = encounter.roomId;
    initiateCombat(room.bossInstance, { intro: false }); // l'arrivée du boss a été montrée par triggerBossEncounter()
}

// Bouton "Repérer et partir" de la zone de choix de boss : l'antre reste marquée 👑 sur la carte,
// sans y descendre/combattre.
function retreatFromBoss() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    // L'antre reste marquée 👑 sur la carte (salle visitée, boss non vaincu — voir listFloorLandmarks()).
    logEvent(encounter ? "Vous repérez soigneusement l'endroit (marqué sur votre carte) et repartez explorer." : "Vous repérez soigneusement l'endroit et repartez explorer.", "info");
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

// Construit le panneau compact des infos du mob, sous la scène de combat (#combat-mob-info) :
// seulement des icônes/chiffres résumant l'ennemi, plus un bouton "Examiner" qui déplie les
// détails textuels (description des modificateurs, effet) à la demande.
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

    ui.combatMobInfo.innerHTML = `
        <div class="flex flex-wrap justify-center gap-1 text-[10px] font-bold">
            ${eliteChip}
            <span class="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-400 text-stone-700">${rangeIcon} ${rangeLabel}</span>
            <span class="px-1.5 py-0.5 rounded bg-red-100 border border-red-400 text-red-700">⚔️ +${enemy.atk}</span>
            <span class="px-1.5 py-0.5 rounded bg-blue-100 border border-blue-400 text-blue-700">🛡️ +${enemy.def}</span>
            ${effectChip}
            ${modifierChips}
        </div>
        <button id="btn-examine-mob" class="mt-2 w-full min-h-[44px] text-[10px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">🔍 Examiner</button>
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

// Badges d'état ennemi (chantier "lisibilité combat", Chantier 2) : remplace l'ancien texte
// concaténé (#combat-enemy-status, renommé #enemy-status-icons) par des badges individuels avec
// infobulle (title), pour que chaque état reste identifiable au survol plutôt qu'une suite d'emoji
// sans légende. Couvre les statuts déjà existants (saignement/étourdi/ralenti/ébloui/corrodé/apeuré)
// ET les états posés par les Chantiers 2-3 du rework combat, jamais affichés avant ce chantier
// (garde hérissée, folie, enrage, télégraphe actif — redondant avec la bannière du Chantier 1, mais
// utile pour qui ne regarde que le panneau latéral). Seule fonction à toucher #enemy-status-icons.
function renderEnemyStatusBadges(enemy) {
    if (!ui.enemyStatusIcons) return;
    const status = enemy && enemy.status;
    if (!status) {
        ui.enemyStatusIcons.innerHTML = "";
        return;
    }
    const badges = [];
    const add = (active, icon, title) => { if (active) badges.push({ icon, title }); };
    add(status.bleed && status.bleed.rounds > 0, "🔥", "Saignement");
    add(status.stunned, "💫", "Étourdi");
    add(status.immobilized && status.immobilized.rounds > 0, "🤼", "Immobilisé (ne peut pas riposter)");
    add(status.weakened && status.weakened.rounds > 0, "💪", "Affaibli (ATQ réduite)");
    add(status.exposed && status.exposed.rounds > 0, "🎯", "Exposé (DEF −30 %)");
    add(status.slowed && status.slowed.rounds > 0, "🐌", "Ralenti");
    add(status.blinded && status.blinded.rounds > 0, "✨", "Ébloui");
    add(status.corroded && status.corroded.rounds > 0, "🧪", "Corrodé (DEF réduite)");
    add(status.feared && status.feared.rounds > 0, "😱", "Apeuré (ATQ réduite)");
    add(status.defBuffed && status.defBuffed.rounds > 0, "🛡️", "Garde hérissée (DEF augmentée)");
    add(status.frenzied, "🤪", "Folie (phase 3 : dégâts +40%, DEF -30%)");
    add(status.enraged && status.enraged.rounds > 0, "😡", "Enragé (dégâts +40%, DEF divisée par 2)");
    add(status.telegraph, "👁️", "Attaque télégraphiée en cours (voir la bannière)");
    ui.enemyStatusIcons.innerHTML = badges.length
        ? badges.map(b => `<span title="${b.title}">${b.icon}</span>`).join('')
        : "";
}

// Jauge de tension anti-kite (chantier "lisibilité combat", Chantier 5) : montre la probabilité
// d'enrage AVANT qu'il n'arrive, pour que le joueur voie la tension monter plutôt que de subir la
// ruée sans prévenir. Trois états mutuellement exclusifs (voir noteMobKitingRound()/
// triggerMobEnrage()/endMobEnrage() pour la mécanique sous-jacente) :
//   - enraged actif : badge rouge fixe, plus de jauge (l'enrage a déjà eu lieu).
//   - enrageCooldown actif : badge gris (repos forcé, aucun nouveau tirage possible).
//   - kitingRounds au-dessus de sa base (mobKitingBaseline()) : jauge + % calculé avec les mêmes
//     valeurs RÉELLES que noteMobKitingRound() (config.distanceEnrage), jamais redupliquées en dur.
//   - sinon (compteur à sa base) : tout masqué, rien à montrer.
function renderDistanceTension(enemy) {
    if (!ui.distanceTensionLabel) return;
    const cfg = config.distanceEnrage;
    const status = enemy && enemy.status;
    if (!enemy || !status) {
        ui.distanceTensionLabel.classList.add('hidden');
        return;
    }
    if (status.enraged && status.enraged.rounds > 0) {
        ui.distanceTensionLabel.innerText = '😡 ENRAGÉ';
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-red-400';
        return;
    }
    if (status.enrageCooldown && status.enrageCooldown.rounds > 0) {
        ui.distanceTensionLabel.innerText = `😵 Épuisé (${status.enrageCooldown.rounds} tour${status.enrageCooldown.rounds > 1 ? 's' : ''})`;
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-500';
        return;
    }
    const baseline = mobKitingBaseline(enemy);
    const kitingRounds = enemy.kitingRounds || baseline;
    if (kitingRounds > baseline) {
        const chancePct = Math.round(Math.min(cfg.baseChance + cfg.chancePerRound * kitingRounds, cfg.maxChance) * 100);
        ui.distanceTensionLabel.innerText = `😤 Enrage imminent : ${chancePct}%`;
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-orange-400';
        return;
    }
    ui.distanceTensionLabel.classList.add('hidden');
}

// Bannière de télégraphe (chantier "lisibilité combat", Chantier 1) : affichée EN PERMANENCE tant
// que enemy.status.telegraph est actif (pas seulement au tour d'annonce, contrairement au log qui ne
// mentionne l'annonce qu'une fois) — c'est elle qui porte l'information de façon fiable, sans avoir à
// déplier le journal de combat. Appelée depuis updateUI() à chaque rendu, seule fonction à toucher
// #telegraph-banner (jamais de mutation DOM dispersée ailleurs).
function updateTelegraphBanner() {
    if (!ui.telegraphBanner) return;
    const enemy = gameState.currentEnemy;
    const telegraph = enemy && enemy.status && enemy.status.telegraph;
    if (!telegraph) {
        ui.telegraphBanner.classList.add('hidden');
        return;
    }
    const messages = {
        heavy: '⚠️ Coup dévastateur imminent — défendez-vous ou esquivez !',
        defBuff: '🛡️ Garde imminente — frappez maintenant !'
    };
    ui.telegraphBanner.innerText = messages[telegraph.type] || '⚠️ Une attaque se prépare...';
    ui.telegraphBanner.classList.remove('hidden');
}

// Bannière de changement de phase boss (chantier "lisibilité combat", Chantier 10) : transitoire
// (~900ms), prépendue au pattern du tour par runPattern() dans performBossCounterAttackInner()
// UNIQUEMENT quand la phase vient de monter (jamais en entrant en phase 1). Minutée par un VRAI
// setTimeout (comme #dev-banner ou tout autre toast ponctuel) plutôt qu'un step de runCombatBeats :
// elle doit disparaître toute seule après son délai propre, indépendamment du rythme des beats
// suivants (qui peuvent s'enchaîner bien avant ou bien après ses 900ms). Aucun Math.random() ici
// (leçon du Chantier 3) : le texte dépend uniquement de `phase`.
function announceBossPhaseChange(enemy, phase) {
    if (!ui.phaseTransitionBanner) return;
    const messages = {
        2: `😤 ${enemy.name} change de comportement — nouveaux patterns !`,
        3: `🤪 ${enemy.name} entre en folie furieuse — frappez sans relâche !`
    };
    ui.phaseTransitionBanner.innerText = messages[phase] || `${enemy.name} change de phase.`;
    ui.phaseTransitionBanner.classList.remove('hidden');
    setTimeout(() => {
        ui.phaseTransitionBanner.classList.add('hidden');
    }, 900);
}

// Remplaçant intérimaire (chantier 15, lot 2) : une réplique d'accueil par boss (choisie selon la longueur de son nom, sans hasard), avec le chiffre exact.
const INTERIM_BOSS_LINES = [
    "est en congé : c'est son stagiaire qui vous accueille. Il n'a pas l'air de savoir où est le bouton d'alarme.",
    "a posé un jour de RTT. Son remplaçant vous reçoit, un gobelet de café dans une main, le manuel de procédures dans l'autre.",
    "est « en réunion ». L'intérimaire se présente, vous serre la patte et vous demande de patienter. Il n'a jamais tué personne."
];
function interimBossLine(enemy) {
    const eg = config.earlyGame.interimBoss;
    const text = INTERIM_BOSS_LINES[(enemy.baseName || enemy.name || '').length % INTERIM_BOSS_LINES.length];
    return `🏷️ [${enemy.baseName || enemy.name}] ${text} (Remplaçant intérimaire : −${Math.round((1 - eg.hpMult) * 100)} % de PV, −${Math.round((1 - eg.atkMult) * 100)} % d'ATQ.)`;
}

// Fin de la « Convention collective du Donjon » (chantier 15, lot 5) : première élite croisée une fois les étages sans élite passés, une seule fois par crawler.
function announceEliteConventionEnd(enemy) {
    const eg = config.earlyGame;
    if (!eg.enabled || gameState.eliteConventionEnded || !isEliteMob(enemy) || enemy.isBountyHunter) return;
    if (gameState.currentFloor <= eg.elites.freeFloors) return;
    gameState.eliteConventionEnded = true;
    const mult = eliteDamageMultForFloor(gameState.currentFloor);
    const base = config.mobDamageScaling.eliteDamageMult;
    const detail = mult < base ? ` (Rampe de reprise : dégâts des élites ×${String(mult).replace('.', ',')} à cet étage, ×${String(base).replace('.', ',')} ensuite.)` : '';
    logEvent(`📜 Fin de la Convention collective du Donjon : les élites ont repris le travail. Elles n'ont pas lu l'article 4 sur le plafonnement des dégâts.${detail}`, "info");
}

// `options.intro` (chantier 16, lot 2) : écran plein écran d'entrée en combat — `false` = aucun (combat enchaîné, écran
// déjà montré par l'appelant, compagnon hostile), 'ambush' (embuscade de trajet), sinon 'spotted' ; un boss garde
// toujours 'boss' et un chasseur de primes 'hunter' (resolveEncounterKind()). L'écran bloque les actions
// (`encounterIntroPending`) et ne démarre le combat qu'au tap ; sans interface (tests Node) le combat démarre tout de suite.
function initiateCombat(forcedEnemy = null, options = {}) {
    const enemy = forcedEnemy || generateMob(gameState.currentDistrict);
    const kind = (options && options.intro === false) ? null : resolveEncounterKind(enemy, options && options.intro);
    if (kind && enemy) {
        showEncounterIntro(kind, enemy, () => beginCombat(enemy, options));
        return;
    }
    beginCombat(enemy, options);
}

// Corps du combat (ancienne initiateCombat()) : appelé tout de suite, ou au tap qui ferme l'écran de rencontre.
// `options.startDistance` : écart de départ imposé (attaque furtive, lot 3) ; sinon celui de la nature du mob.
function beginCombat(enemy, options = {}) {
    // Suivi du combat pour la chronique (chantier 2) : dégâts subis au départ, ouverture furtive, nombre
    // d'attaques portées (victoire en un coup) — voir recordRunEvent('win').
    if (enemy) enemy.runTrack = { startDamageTaken: gameState.runStats ? gameState.runStats.damageTaken : 0, startTrialAvoided: gameState.runStats ? (gameState.runStats.trialAvoided || 0) : 0, sneak: !!gameState.pendingSneakAttack, playerAttacks: 0 };
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;
    if (enemy && enemy.isInterim) logEvent(interimBossLine(enemy), "info"); // Remplaçant intérimaire (chantier 15, lot 2)
    announceEliteConventionEnd(enemy);
    // Occasions de combat (chantier 6, V2) : état remis à zéro ; la garantie compte un combat de plus sans Occasion.
    gameState.occasion = Object.assign(createOccasionState(), { pity: ((gameState.occasion && gameState.occasion.pity) || 0) + 1 });

    // En-tête de la scène d'exploration : toujours posé ici, quel que soit le chemin d'entrée en combat (embuscade
    // de trajet, compagnon qui se retourne contre vous, rencontre furtive ratée...). Avant ce correctif,
    // seuls certains appelants posaient leur propre en-tête ; les autres laissaient celui de la scène
    // PRÉCÉDENTE affiché (ex: "Silence") pendant que l'affichage basculait déjà sur le panneau
    // du mob (renderCombatMobPanel) — les deux se retrouvaient superposés au premier tour. Les combats
    // de boss gardent leur en-tête dédié, plus riche ("Gardien de l'Escalier"/"Boss de Quartier"), déjà
    // posé par triggerBossEncounter() juste avant.
    if (enemy && !enemy.isBoss) {
        setSceneHeader(isEliteMob(enemy) ? '💀' : '⚔️', enemy.name, 'Danger', { key: 'combat', enemy });
    } else if (!enemy) {
        setSceneHeader('⚔️', 'Combat', 'Danger');
    }

    // Statuts remis à zéro à chaque nouveau combat (des deux côtés)
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false };
    gameState.classAbilityUsed = false; // capacité de classe : une fois par combat (chantier 13)
    if (enemy) {
        // telegraph/defBuffed/frenzied : uniquement lus/écrits côté boss (voir performBossCounterAttack()
        // dans app.js, Chantier 2 du rework combat) — restent toujours neutres sur un mob normal/élite.
        // enraged/enrageCooldown : Chantier 3 (enrage distance), tous mobs confondus, boss inclus.
        enemy.status = { bleed: null, stunned: false, slowed: null, blinded: null, corroded: null, feared: null, distracted: null, telegraph: null, defBuffed: null, frenzied: false, enraged: null, enrageCooldown: null, immobilized: null, weakened: null, exposed: null };
        enemy.maxHp = enemy.hp; // Référence pour l'anneau de vie (pourcentage de PV restants)
        // Compteur de tours de kiting (Chantier 3) : un boss démarre à 1 (s'enrage plus vite qu'un
        // mob normal, voir NOTES_COMBAT.md Chantier 2) plutôt qu'à 0.
        enemy.kitingRounds = mobKitingBaseline(enemy);
        // Dernière phase connue (chantier "lisibilité combat") : initialisée à la phase de DÉPART pour
        // qu'aucun "changement" ne soit détecté au tout premier tour — seulement lue/mise à jour côté
        // boss (voir getBossPhase()/performBossCounterAttackInner()), neutre sur un mob normal/élite.
        enemy.lastKnownPhase = enemy.isBoss ? getBossPhase(enemy) : 1;
    }

    // Distance de combat initiale : dépend uniquement de la nature du mob (aucune notion de
    // posture côté joueur). Un mob de mêlée démarre au contact ; un mob à distance démarre à
    // l'écart de départ, que le joueur devra combler (S'approcher) ou maintenir (S'éloigner).
    gameState.combatDistance = (options && Number.isFinite(options.startDistance)) ? options.startDistance : ((enemy && mobWantsFar(enemy)) ? config.rangedCombat.initialDistance : 0);

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

    // TEMPO_CREE (anomalies.js) : les mobs frappent en premier à l'ouverture du combat — réutilise
    // exactement la riposte normale (enemyCounterAttack()/resolveEnemyCounterAttack()), jamais une
    // nouvelle formule de dégâts, simplement DÉCALÉE plus tôt dans le déroulé du combat.
    if (enemy && gameState.anomalyEffects.mobsActFirst) {
        enemyCounterAttack();
    }
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

// ==========================================
// ENRAGE PAR DISTANCE (Chantier 3 du rework combat)
// ==========================================
// Anti-kite générique, tous mobs confondus (boss inclus) : un mob accumule un "tour de kiting"
// chaque fois qu'il reste à distance sans pouvoir attaquer (mêlée hors de portée OU mob à distance
// collé au corps à corps), remis à sa base dès qu'il parvient à frapper. La probabilité d'enrage par
// tour grimpe avec ce compteur (config.distanceEnrage) jusqu'à son plafond. Voir NOTES_COMBAT.md.

// Base du compteur de kiting : un boss démarre à 1 (voir Chantier 2, "les boss s'enragent plus
// vite"), un mob normal/élite à 0.
function mobKitingBaseline(enemy) {
    return (enemy && enemy.isBoss) ? 1 : 0;
}

// Remet le compteur de kiting à sa base : appelé dès que le mob attaque réellement (peu importe le
// chemin emprunté — riposte normale, ruée classique, ruée d'enrage...), signe qu'il n'est plus "tenu
// à distance".
function resetMobKiting(enemy) {
    if (!enemy) return;
    enemy.kitingRounds = mobKitingBaseline(enemy);
}

// Un tour de plus où le mob est tenu à distance sans pouvoir agir. Renvoie true si ce tour a
// déclenché une ruée d'enrage (le mob a alors DÉJÀ attaqué — l'appelant ne doit pas logguer son
// propre message "reste hors de portée" par-dessus).
function noteMobKitingRound(enemy) {
    if (!enemy || !enemy.status) return false;
    // Déjà enragé : pas de nouveau tirage, mais ce tour de plus compte contre la durée restante de
    // l'enrage en cours (expire après 2-3 tours sans nouvelle frappe réussie entre-temps).
    if (enemy.status.enraged) {
        enemy.status.enraged.rounds -= 1;
        if (enemy.status.enraged.rounds <= 0) endMobEnrage(enemy);
        return false;
    }
    // Repos forcé après un enrage précédent : aucun nouveau tirage tant qu'il n'est pas écoulé.
    if (enemy.status.enrageCooldown && enemy.status.enrageCooldown.rounds > 0) {
        enemy.status.enrageCooldown.rounds -= 1;
        if (enemy.status.enrageCooldown.rounds <= 0) enemy.status.enrageCooldown = null;
        return false;
    }
    enemy.kitingRounds = (enemy.kitingRounds || mobKitingBaseline(enemy)) + 1;
    const cfg = config.distanceEnrage;
    const chance = Math.min(cfg.baseChance + cfg.chancePerRound * enemy.kitingRounds, cfg.maxChance);
    if (Math.random() < chance) {
        triggerMobEnrage(enemy);
        return true;
    }
    return false;
}

// Le mob perd patience : comble l'écart d'un coup et place une frappe bonus (dégâts
// +config.distanceEnrage.atkMult, via executeBossStrike() — réutilisée telle quelle, générique à
// tout mob boss ou non), sur un beat LOURD (chantier "lisibilité combat" : une ruée d'enrage est un
// moment fort, au même titre qu'un télégraphe exécuté). Cette frappe d'entrée ne compte pas comme la
// "frappe qui met fin à l'état" (voir noteMobKitingRound()/resolveEnemyCounterAttack()/
// performBossCounterAttack()) : l'état enragé s'installe SEULEMENT APRÈS elle, pour laisser une vraie
// fenêtre de 2-3 tours où sa DEF réduite reste exploitable par le joueur (et ses dégâts restent
// boostés) sur les tours suivants.
// Verrouille et déverrouille elle-même les boutons (comme enemyCounterAttack()) : contrairement à
// avant ce chantier, cette ruée passe désormais par un vrai beat et ne doit pas laisser les boutons
// actifs pendant qu'elle se joue — ses appelants (noteMobKitingRound(), dans resolveEnemyReaction()/
// safeEnemyCounterAttack()) n'ont pas besoin de savoir quand elle se termine, exactement comme ils
// n'ont jamais eu besoin de connaître le timing interne d'enemyCounterAttack().
function triggerMobEnrage(enemy) {
    const cfg = config.distanceEnrage;
    setCombatDistance(0);
    combatSkipRequested = false; // Chantier 9 : même remise à zéro qu'enemyCounterAttack()
    setCombatInputLocked(true);
    runCombatBeats([{
        run: () => {
            logEvent(`💢 [${enemy.name}] perd patience et se rue sur vous, enragé !`, "danger");
            const boostedAtk = Math.round(enemy.atk * cfg.atkMult);
            executeBossStrike(enemy, boostedAtk, `[${enemy.name}], enragé,`, undefined, true);
            resetMobKiting(enemy);
            if (gameState.hp > 0) {
                enemy.status.enraged = { rounds: 2 + Math.floor(Math.random() * 2) }; // 2 ou 3 tours
            }
        },
        delay: config.combatRhythm.beatHeavyEvent
    }], () => { setCombatInputLocked(false); updateUI(); }); // même centralisation qu'enemyCounterAttack() (Chantier 7)
}

// Fin de l'état enragé (durée écoulée, ou le mob vient de placer une frappe pendant l'état) : repos
// forcé ensuite, pour ne pas pouvoir s'enrager en boucle dès le tour suivant.
function endMobEnrage(enemy) {
    enemy.status.enraged = null;
    enemy.status.enrageCooldown = { rounds: config.distanceEnrage.cooldownRounds };
}

// Riposte "sécurisée" : bloque la riposte, sans rien faire d'autre ce tour-ci, si le mob ne peut
// actuellement pas toucher le joueur (mob de mêlée hors de portée, ou mob à distance collé au corps
// à corps). Réservée aux actions qui résolvent DÉJÀ elles-mêmes une manche de distance ce tour
// (Sprint, Reculer) : ajouter une tentative de repositionnement par-dessus doublerait leur propre
// jet. Pour tout le reste (voir resolveEnemyReaction), la riposte bloquée doit plutôt laisser le mob
// tenter de se repositionner, sans quoi il resterait figé indéfiniment. Un tour bloqué ici est aussi
// un tour de kiting (Chantier 3) : peut déclencher une ruée d'enrage à la place du simple blocage.
function safeEnemyCounterAttack() {
    const enemy = gameState.currentEnemy;
    if (!enemy) { enemyCounterAttack(); return; }
    const ctx = getCombatRangeContext();
    if (ctx.playerAdvantaged) {
        if (noteMobKitingRound(enemy)) return; // ruée d'enrage déclenchée : a déjà attaqué
        logEvent(`Trop loin : [${enemy.name}] ne peut pas riposter.`, "info");
        return;
    }
    if (ctx.mobNeedsDistance) {
        if (noteMobKitingRound(enemy)) return;
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
    if (consumeSurprise(enemy)) { updateUI(); return; } // tireur surpris : aucune réaction ce tour
    const ctx = getCombatRangeContext();

    if (ctx.playerAdvantaged) {
        const { diff } = resolveDistanceRound(enemy, true); // rafraîchit déjà l'UI via setCombatDistance()
        // Ruée : un mob de mêlée qui gagne ce jet avec une marge franche (voir
        // config.rangedCombat.rushMarginThreshold) comble l'écart d'un bond, quel que soit l'écart de
        // départ — sans ça, un joueur à l'écart maximal devient mathématiquement increvable (voir le
        // commentaire de rushMarginThreshold).
        if (diff <= -config.rangedCombat.rushMarginThreshold) {
            setCombatDistance(0);
            logEvent(`[${enemy.name}] se rue et comble l'écart d'un bond !`, "danger");
            enemyCounterAttack();
        } else if (gameState.combatDistance > 0) {
            // Tour de kiting (Chantier 3) : peut déclencher une ruée d'enrage à la place du simple blocage.
            if (!noteMobKitingRound(enemy)) {
                logEvent(`[${enemy.name}] tente de combler l'écart, mais reste hors de portée pour l'instant.`, "info");
            }
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
        } else if (!noteMobKitingRound(enemy)) {
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
// il veut le RÉDUIRE). Chaque manche CONTESTÉE consomme un peu de temps (voir
// config.rangedCombat.timeCostPerRound) — jamais les tours d'attaque standards, qui ne passent pas
// par cette fonction.
function resolveDistanceRound(enemy, playerWantsToWiden) {
    const cfg = config.rangedCombat;
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound);
    const playerRoll = 1 + Math.floor(Math.random() * cfg.dieSides) + Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
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
    // Chantier "rework combat" (scaling dégâts mobs) : options.pressureFloor (absolu, en PV) et
    // options.minMitigation ne sont JAMAIS passés par performPlayerAttack() — uniquement par
    // resolveEnemyCounterAttack() (voir config.mobDamageScaling), pour que ces deux règles restent
    // strictement des dégâts MOB -> joueur, sans toucher aux dégâts joueur -> mob.
    const pressureFloor = options.pressureFloor ?? 0;
    const minMitigation = options.minMitigation ?? 0;

    const effectiveAtk = attackerAtk * atkMultiplier;
    const effectiveDef = Math.max(0, defenderDef * (1 - defReduction));
    // Cap de réduction : la défense ne peut jamais faire tomber la mitigation sous minMitigation.
    const mitigation = Math.max(minMitigation, effectiveAtk / (effectiveAtk + effectiveDef));
    const variance = 1 + (Math.random() * varianceRange * 2 - varianceRange);
    // Plancher de pression : dégâts BRUTS (avant mitigation) jamais sous pressureFloor.
    const rawDamage = Math.max(effectiveAtk * variance, pressureFloor);
    // Seul point de passage commun aux dégâts du joueur ET des mobs (voir performPlayerAttack()/
    // resolveEnemyCounterAttack()) : anomalyEffects.allDamageMult (ADRENALINE) s'y applique donc
    // symétriquement des deux côtés sans toucher au reste de la formule.
    const damage = rawDamage * mitigation * (gameState.anomalyEffects.allDamageMult || 1);
    return Math.max(1, Math.round(damage));
}

// DEF effective du joueur : sa DEF de base + le bonus de l'armure équipée, le cas échéant.
// Réduite de moitié tant que le joueur est ébloui (effet "light"), et encore réduite de 40% tant
// qu'il est corrodé (effet "corrode") — les deux se cumulent si les deux sont actifs à la fois.
function getEffectiveDef() {
    const raceFx = originRaceEffects();
    const armorBonus = gameState.equipment.armor ? Math.round((gameState.equipment.armor.baseArmor || 0) * (raceFx.armorMult || 1)) : 0; // Nain : armure portée +15 %
    const companionBonus = hasActiveCompanion('guard')
        ? Math.round(getCompanionDef(gameState.companion) * config.companions.guard.defShare)
        : 0;
    let effectiveDef = gameState.def + armorBonus + companionBonus;
    if (raceFx.defMult) effectiveDef += Math.max(1, Math.round(effectiveDef * (raceFx.defMult - 1))); // Nain : DEF +12 % (au moins +1)
    if (raceFx.defFlat) effectiveDef = Math.max(0, effectiveDef + raceFx.defFlat); // Elfe : DEF −1
    if (gameState.status.blinded && gameState.status.blinded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    if (gameState.status.corroded && gameState.status.corroded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.6);
    }
    // "Charger" (Chantier 3, attemptEngage()) : DEF divisée par 2 pour la riposte qui suit une charge
    // volontaire — consommé (remis à faux) au tout début de la PROCHAINE action, voir tryPlayerAction(),
    // jamais ici (fonction pure, aussi appelée pour le simple affichage UI de la DEF).
    if (gameState.engageDefHalved) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    // Encaisser (Sac de frappe, chantier 13) : DEF ×2 pour la riposte qui suit la capacité.
    if (gameState.status.brace) effectiveDef = Math.round(effectiveDef * (originClassEffects().braceDefMult || 1));
    return effectiveDef;
}

// Vérifie que le joueur peut agir (combat en cours, pas étourdi), et applique le saignement
// éventuellement en cours sur le joueur AVANT son action. Retourne false si le joueur ne peut pas
// agir ce tour-ci (combat terminé entre-temps, ou étourdi).
function tryPlayerAction() {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    // Une action = un tour : l'Occasion proposée (chantier 6, V2) s'éteint, que le joueur l'ait prise ou non.
    if (gameState.occasion) { gameState.occasion.current = null; gameState.occasion.turn += 1; }
    // Un skip demandé pendant le tour précédent ne doit jamais escamoter l'effet de CETTE attaque (fx.js).
    combatSkipRequested = false;

    // Reset avant toute chose : seul un backfire posé PENDANT cette action doit pouvoir être tenu
    // responsable d'une mort ce même tour (voir attackMagic()/gameOver()).
    gameState.lastPlayerActionWasBackfire = false;
    // Même convention pour "Charger" (Chantier 3, attemptEngage()) : la DEF divisée par 2 ne doit
    // couvrir QUE la riposte qui suit la charge, jamais fuiter sur l'action suivante du joueur.
    gameState.engageDefHalved = false;
    gameState.status.plotShield = false; // Armure de scénario (chantier 15) : ne couvre que le reste du tour ennemi où elle a servi
    gameState.status.brace = null; // Encaisser (chantier 13) : ne couvre que la riposte qui suit la capacité
    // Bouclier de Mana (chantier 11) : couvre les ripostes des `rounds` actions suivant le sort.
    if (gameState.status.manaShield) {
        gameState.status.manaShield.rounds -= 1;
        if (gameState.status.manaShield.rounds <= 0) gameState.status.manaShield = null;
    }

    // Saignement en cours sur le joueur : tique avant son action
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) {
        const dmg = applyTrialToDamage(applyStarterBuffToDamage(applyRaceDamageMods(gameState.status.bleed.dmgPerRound, 'bleed')));
        applyPlayerDamage(dmg);
        gameState.status.bleed.rounds -= 1;
        if (gameState.status.bleed.rounds <= 0) gameState.status.bleed = null;
        logEvent(`🩸 Votre état vous fait perdre ${dmg} PV.`, "danger");
        if (gameState.hp <= 0) {
            gameState.hp = 0;
            gameOver(false, 'bleed');
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
    // `options.skipReaction` : un coup de capacité de classe qui n'est pas le dernier d'une rafale (Tir de barrage) ne déclenche pas la riposte.
    const react = () => { if (!options.skipReaction) resolveEnemyReaction(); };

    // Un joueur confus a une chance de rater complètement son attaque (aucun dégât, tour perdu)
    if (gameState.status.confused && gameState.status.confused.rounds > 0) {
        gameState.status.confused.rounds -= 1;
        if (gameState.status.confused.rounds <= 0) gameState.status.confused = null;
        if (Math.random() * 100 < 45) {
            showDie(ui.combatPlayerDie, "❓");
            logEvent(`Désorienté, vous frappez complètement à côté de [${enemy.name}] !`, "danger");
            react();
            return true;
        }
    }

    // Qualificatifs de l'objet utilisé pour CE coup (options.gear : arme, arme à distance ou sort ;
    // options.gearTarget : 'weapon' | 'spell') — voir itemQualifiers dans items.js.
    const gear = options.gear || null;
    const gearTarget = options.gearTarget || 'weapon';
    const gearQ = (key) => (gear ? getItemQualifierValues(gear, key, gearTarget) : null);
    const wobbly = gearQ('wobbly');
    if (wobbly && Math.random() * 100 < wobbly.chance) {
        showDie(ui.combatPlayerDie, "🥴");
        logEvent(`🥴 Votre [${gear.name}] bancal vous glisse des mains : coup complètement raté !`, "danger");
        react();
        return false;
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

    // Disparition (Filou, chantier 13) : la prochaine attaque après la capacité porte un bonus garanti.
    let vanishNote = "";
    const vanish = gameState.status.vanish;
    if (vanish && vanish.nextAttack) {
        const vanishMult = originClassEffects().nextAttackMult || 1;
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * vanishMult };
        vanishNote = ` (disparition ×${vanishMult})`;
        vanish.nextAttack = false;
    }

    // Attaque furtive réussie : le tout premier coup de ce combat porte un bonus x2 garanti
    let sneakNote = "";
    if (gameState.pendingSneakAttack) {
        const sneakMult = sneakAttackMult();
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * sneakMult };
        sneakNote = ` (attaque furtive x${String(sneakMult).replace('.', ',')})`;
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

    // Exposé (Parade ou garde brisée parfaite, chantier 6 V3) : DEF effective réduite de 30 % pendant `rounds` coups.
    const enemyWasExposed = enemy.status && enemy.status.exposed && enemy.status.exposed.rounds > 0;
    if (enemyWasExposed) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * MINIGAME_SETTINGS.boss.exposed.defMult);
        enemy.status.exposed.rounds -= 1;
        if (enemy.status.exposed.rounds <= 0) enemy.status.exposed = null;
    }

    // Boss phase 2 "il se hérisse" (voir performBossCounterAttack()) : DEF effective AUGMENTÉE tant
    // que le buff est actif — symétrique aux réductions ébloui/corrodé ci-dessus.
    const enemyWasDefBuffed = enemy.status && enemy.status.defBuffed && enemy.status.defBuffed.rounds > 0;
    if (enemyWasDefBuffed) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.bossPhases.defBuffMult);
        enemy.status.defBuffed.rounds -= 1;
        if (enemy.status.defBuffed.rounds <= 0) enemy.status.defBuffed = null;
    }
    // Boss phase 3 ("folie", voir performBossCounterAttack()) : DEF effective RÉDUITE en continu,
    // la fenêtre risque/récompense de cette phase (voir config.bossPhases.phase3).
    const enemyIsFrenzied = enemy.status && enemy.status.frenzied;
    if (enemyIsFrenzied) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.bossPhases.phase3.defMult);
    }
    // Enrage par distance (Chantier 3, tous mobs confondus, boss inclus) : DEF effective divisée par
    // 2 tant que l'état est actif (voir noteMobKitingRound()/triggerMobEnrage()) — une vraie fenêtre
    // de burst pour le joueur, en échange du fait qu'il vient d'encaisser (ou va encaisser) des coups
    // boostés en retour.
    const enemyIsEnragedForPlayer = enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0;
    if (enemyIsEnragedForPlayer) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.distanceEnrage.defMult);
    }

    // "Charger" (Chantier 3, attemptEngage()) : bonus d'ATQ déjà passé via effectiveOptions.atkMultiplier
    // par l'appelant ; en contrepartie, la DEF du JOUEUR est divisée par 2 pour la riposte qui suit —
    // consommée au tout début de la PROCHAINE action (tryPlayerAction()), même convention que
    // lastPlayerActionWasBackfire, jamais ici (getEffectiveDef() reste pure, aussi utilisée pour le
    // simple affichage UI).
    // Aiguisé/Amplifié : dégâts +% ; Perforant : part de la DEF ignorée ; Précis : coup critique.
    let gearNote = "";
    const keen = gearQ('keen') || gearQ('amplified');
    if (keen) effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * (1 + keen.pct / 100) };
    const pierce = gearQ('pierce');
    if (pierce) effectiveOptions = { ...effectiveOptions, defReduction: 1 - (1 - (effectiveOptions.defReduction ?? 0)) * (1 - pierce.pct / 100) };
    const precise = gearQ('precise');
    if (precise && Math.random() * 100 < precise.chance) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * precise.mult };
        gearNote += " (critique !)";
    }
    let playerDamage = rollDamage(attackerAtk, effectiveEnemyDef, effectiveOptions);
    // Électrique/Explosif : dégâts bonus proportionnels au coup, qui ignorent la DEF (ajoutés au coup
    // lui-même, avant le test de victoire). Explosif peut aussi blesser le porteur, sans jamais le tuer.
    const shock = gearQ('shock');
    if (shock && Math.random() * 100 < shock.chance) {
        const bonus = Math.max(1, Math.round(playerDamage * shock.pct / 100));
        playerDamage += bonus;
        gearNote += ` (⚡ +${bonus})`;
    }
    // Chaîne d'éclairs (effet de sort, chantier 11) : second éclair ajouté au coup, avant le test de victoire.
    if (options.chainPct > 0) {
        const bonus = Math.max(1, Math.round(playerDamage * options.chainPct / 100));
        playerDamage += bonus;
        gearNote += ` (⛓️ +${bonus})`;
    }
    const blast = gearQ('aoe');
    if (blast && Math.random() * 100 < blast.chance) {
        const bonus = Math.max(1, Math.round(playerDamage * blast.pct / 100));
        playerDamage += bonus;
        gearNote += ` (💥 +${bonus})`;
        if (Math.random() * 100 < blast.selfChance && gameState.hp > 1) {
            const selfDamage = Math.min(gameState.hp - 1, Math.max(1, Math.round(gameState.maxHp * blast.selfPct / 100)));
            applyPlayerDamage(selfDamage);
            logEvent(`💥 L'explosion vous roussit au passage (-${selfDamage} PV). Pour tout le monde, on avait dit.`, "danger");
        }
    }
    enemy.hp -= playerDamage;
    if (enemy.runTrack) enemy.runTrack.playerAttacks += 1;
    gameState._lastPlayerDamage = playerDamage; // Utilisé par la mécanique d'arme "Vampirique" (lifesteal)
    animateDieHit(ui.combatPlayerDie, 'left', playerDamage);
    // Effet d'attaque en 3 temps (fx.js, chantier « sprites & effets ») : le chiffre, la secousse et la
    // baisse de la barre de vie du mob attendent l'impact. Attaque furtive et charge sont les seuls coups
    // « lourds » du joueur (chiffre grossi, secousse d'écran + flash).
    const heavyHit = sneakNote !== "" || gameState.engageDefHalved;
    playPlayerAttackFx(gameState.lastAttackKind, { heavy: heavyHit, charge: gameState.engageDefHalved, heldEnemyHp: enemy.hp + playerDamage }, () => {
        showFloatingDamage(ui.sceneMobAnchor, playerDamage, { toPlayer: false, heavy: heavyHit });
        if (heavyHit) triggerHeavyImpact();
    });
    // Ligne raccourcie (chantier "lisibilité combat", Chantier 8) : retire le remplissage "et
    // infligez ... à" — toutes les notes d'état restent conservées telles quelles (chacune explique
    // le calcul du coup en cours : DEF ennemie effective modifiée, dégâts joueur modifiés — jamais de
    // pure redite de ce que les badges du Chantier 2 montrent déjà sans rapport avec CE coup précis).
    logEvent(`Vous attaquez ${label} : ${playerDamage} dégâts à [${enemy.name}]${gearNote}${slowedNote}${adrenalineNote}${sneakNote}${vanishNote}${enemyWasBlinded ? " (ennemi ébloui)" : ""}${enemyWasCorroded ? " (ennemi corrodé)" : ""}${enemyWasDefBuffed ? " (garde hérissée)" : ""}${enemyWasExposed ? " (garde ouverte)" : ""}${enemyIsFrenzied ? " (garde effondrée)" : ""}${enemyIsEnragedForPlayer ? " (garde baissée)" : ""}.`, "normal");

    // Appui du compagnon : sort donné, Frappe d'appoint ou coup d'opportunité (voir companionCombatSupport())
    companionCombatSupport(enemy);
    if (enemy.hp > 0 && options.onHit) options.onHit(enemy, playerDamage); // effet de capacité de classe posé AVANT la riposte (ex. étourdissement)

    if (enemy.hp <= 0) {
        // Coup de grâce (chantier 6, V3) : le coup fatal porté à un boss ouvre d'abord l'épreuve (si une interface la permet).
        if (offerCoupDeGrace(enemy)) return true;
        setTimeout(() => {
            logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
            winCombat();
        }, COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer avant de conclure le combat
        return true;
    }

    react();
    return true;
}

// ==========================================
// QUALIFICATIFS EN COMBAT (chantier "refonte des objets" — catalogue itemQualifiers dans items.js)
// ==========================================
// Tous les chiffres viennent de getQualifierValues() (generator.js), la même source que le texte
// d'inspection (describeQualifier()) : ce qui est écrit sur l'objet est exactement ce qui se passe.

// Qualificatifs d'un objet, avec rang. Un objet construit à la main (tests) ou antérieur à la refonte
// n'a que `mechanics` : rang I par défaut.
function getItemQualifierList(item) {
    if (!item) return [];
    if (item.qualifiers) return item.qualifiers;
    return (item.mechanics || []).map(key => ({ key, rank: 1 }));
}

// Valeurs d'un qualificatif précis porté par un objet (null s'il ne le porte pas). `target` par défaut
// déduit de la catégorie (arme si inconnue, pour les objets de test sans catégorie).
function getItemQualifierValues(item, key, target = null) {
    const entry = getItemQualifierList(item).find(q => q.key === key);
    if (!entry) return null;
    return getQualifierValues(key, target || qualifierTarget(item.category) || 'weapon', entry.rank);
}

// Somme d'un champ d'un qualificatif passif sur tout l'équipement porté (arme, arme à distance,
// armure) — Silencieux, Véloce, Chanceux, Grinçant.
function sumEquippedQualifier(key, field) {
    const slots = [['weapon', 'weapon'], ['ranged', 'weapon'], ['armor', 'armor']];
    return slots.reduce((sum, [slot, target]) => {
        const values = getItemQualifierValues(gameState.equipment[slot], key, target);
        return sum + (values && values[field] ? values[field] : 0);
    }, 0);
}

// Effets déclenchables sur une cible donnée (pioche de Chaotique) : les procs de statut/soin, hors
// Chaotique lui-même et hors bonus de dégâts (Électrique/Explosif, résolus dans performPlayerAttack()).
function getRandomizableQualifiers(target) {
    return Object.keys(itemQualifiers).filter(key => {
        const block = itemQualifiers[key][target];
        return block && itemQualifiers[key].kind === 'proc' && !block.passive && !['random', 'shock', 'aoe'].includes(key);
    });
}

// Applique l'effet d'un qualificatif déclenché. `foe` : la cible de l'arme/du sort, ou l'attaquant pour
// une armure. `baseDamage` : dégâts du coup porté (arme/sort) ou encaissé (armure) — base des effets
// sur la durée et du vol de vie. `source` ('weapon' | 'armor' | 'spell') ne change que le message.
function resolveQualifierEffect(key, v, foe, baseDamage, source = 'weapon') {
    const byArmor = source === 'armor';
    foe.status = foe.status || {};
    switch (key) {
        case 'bleed':
            foe.status.bleed = { rounds: v.rounds, dmgPerRound: Math.max(1, Math.round(baseDamage * v.pct / 100)) };
            logEvent(byArmor ? `🩸 Les pointes de votre armure entaillent [${foe.name}] !` : `🩸 [${foe.name}] se met à ${source === 'spell' ? 'brûler' : 'saigner'} !`, "danger");
            break;
        case 'poison':
            foe.status.bleed = { rounds: v.rounds, dmgPerRound: Math.max(1, Math.round(baseDamage * v.pct / 100)) };
            logEvent(byArmor ? `☢️ Votre armure empoisonne [${foe.name}] au contact !` : `☢️ [${foe.name}] est empoisonné !`, "danger");
            break;
        case 'stun':
            foe.status.stunned = true;
            logEvent(byArmor ? `💫 Le choc en retour étourdit [${foe.name}] !` : `💫 [${foe.name}] est étourdi par le choc !`, "danger");
            break;
        case 'slow':
            foe.status.slowed = { rounds: v.rounds };
            logEvent(`🐌 [${foe.name}] est gelé sur place ! (ses dégâts −50 %)`, "danger");
            break;
        case 'pleasure_or_pain':
            foe.status.distracted = { rounds: v.rounds, miss: v.miss };
            logEvent(`😬 Un bourdonnement insupportable déconcentre [${foe.name}] !`, "danger");
            break;
        case 'light':
            foe.status.blinded = { rounds: v.rounds };
            logEvent(`✨ [${foe.name}] est ébloui par un éclat de lumière ! (DEF −50 %)`, "danger");
            break;
        case 'corrode':
            foe.status.corroded = { rounds: v.rounds };
            logEvent(`🧪 L'armure de [${foe.name}] se corrode ! (DEF −40 %)`, "danger");
            break;
        case 'fear':
            foe.status.feared = { rounds: v.rounds };
            logEvent(`😱 [${foe.name}] est pris de terreur ! (dégâts −35 %)`, "danger");
            break;
        case 'adrenaline':
            gameState.status.adrenaline = { rounds: v.rounds, mult: 1 + v.pct / 100 };
            logEvent(`💉 Une décharge d'adrénaline vous parcourt ! (dégâts +${v.pct} %)`, "success");
            break;
        case 'heal': {
            const actualHeal = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * v.pct / 100)));
            logEvent(`💚 ${byArmor ? 'Votre armure' : 'Votre arme'} régénère vos blessures (+${actualHeal} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const actualHeal = applyPlayerHeal(Math.max(1, Math.round(baseDamage * v.pct / 100)));
            if (actualHeal > 0) logEvent(`🧛 ${byArmor ? 'Votre armure siphonne' : 'Vous volez'} ${actualHeal} PV${byArmor ? '' : ` à [${foe.name}]`}.`, "success");
            break;
        }
        case 'drain': {
            // Pourcentages de l'ATQ D'ORIGINE (mémorisée au premier drain), pas cumulés en cascade :
            // le plafond affiché (−40 %) est exactement le plafond réel.
            const drained = foe.drainedPct || 0;
            const step = Math.min(v.pct, v.cap - drained);
            if (step <= 0) break;
            if (foe.atkBeforeDrain === undefined) foe.atkBeforeDrain = foe.atk;
            foe.drainedPct = drained + step;
            foe.atk = Math.max(1, Math.round(foe.atkBeforeDrain * (1 - foe.drainedPct / 100)));
            logEvent(`🌀 Vous drainez [${foe.name}] : ATQ −${step} % (total −${foe.drainedPct} %).`, "info");
            break;
        }
    }
}

// Qualificatifs d'un objet déclenchés par UN coup : arme/sort après un coup porté, armure après un
// coup encaissé. Chaque qualificatif a sa PROPRE chance, indépendante des autres.
function triggerItemQualifiers(item, target, foe, baseDamage) {
    getItemQualifierList(item).forEach(({ key, rank }) => {
        const q = itemQualifiers[key];
        const v = getQualifierValues(key, target, rank);
        if (!q || !v || q.kind !== 'proc' || ['shock', 'aoe'].includes(key)) return;
        if (v.passive) {
            resolveQualifierEffect(key, v, foe, baseDamage, target); // Vampirique : chaque coup, sans jet
            return;
        }
        if (Math.random() * 100 >= v.chance) return;
        if (key === 'random') {
            const pool = getRandomizableQualifiers(target);
            const picked = pool[Math.floor(Math.random() * pool.length)];
            logEvent(`🎲 Chaotique : ${itemQualifiers[picked].name} !`, "info");
            resolveQualifierEffect(picked, getQualifierValues(picked, target, rank), foe, baseDamage, target);
            return;
        }
        resolveQualifierEffect(key, v, foe, baseDamage, target);
    });
}

// Qualificatifs de l'arme (ou du sort) qui vient de toucher. Appelée uniquement après une attaque
// réussie (performPlayerAttack() a renvoyé vrai). Pas de updateUI() ici : ne pas écraser l'affichage
// des PV avant que l'animation du coup n'arrive à destination.
function applyWeaponMechanic(weaponOverride = null) {
    const weapon = weaponOverride || gameState.equipment.weapon;
    const enemy = gameState.currentEnemy;
    if (!weapon || !enemy) return;
    triggerItemQualifiers(weapon, qualifierTarget(weapon.category) || 'weapon', enemy, gameState._lastPlayerDamage || 0);
}

// Qualificatifs de l'armure portée, à chaque coup encaissé (appelée après la riposte d'un mob, et après
// chaque frappe d'un boss). Épineux renvoie une part des dégâts sans jamais achever l'attaquant : la
// mort d'un mob se résout toujours sur une action du joueur ou un effet sur la durée.
function applyArmorMechanic(attacker, incomingDamage) {
    const armor = gameState.equipment.armor;
    if (!armor || !attacker || gameState.hp <= 0) return;
    const thorns = getItemQualifierValues(armor, 'thorns', 'armor');
    if (thorns && incomingDamage > 0 && attacker.hp > 1) {
        const reflected = Math.min(attacker.hp - 1, Math.max(1, Math.round(incomingDamage * thorns.pct / 100)));
        attacker.hp -= reflected;
        logEvent(`🌵 Votre armure épineuse renvoie ${reflected} dégâts à [${attacker.name}].`, "info");
    }
    triggerItemQualifiers(armor, 'armor', attacker, incomingDamage);
}

// Ténébreux (armure) : chance d'esquiver complètement une attaque ennemie.
function rollPlayerDodge(enemy) {
    // Disparition (Filou, chantier 13) : toute la riposte de ce tour (toutes ses frappes) est esquivée ; chaque tour esquivé consomme une charge.
    const vanish = gameState.status.vanish;
    if (vanish && (vanish.dodging || vanish.turns > 0)) {
        if (!vanish.dodging) { vanish.turns -= 1; vanish.dodging = true; }
        logEvent(`🎭 Vous n'êtes déjà plus là : l'attaque de [${enemy.name}] frappe le vide !`, "success");
        return true;
    }
    const values = getItemQualifierValues(gameState.equipment.armor, 'darkness', 'armor');
    if (!values || Math.random() * 100 >= values.chance) return false;
    logEvent(`🌑 Vous vous fondez dans l'ombre et esquivez l'attaque de [${enemy.name}] !`, "success");
    return true;
}

// Ralenti (Gelé) et apeuré (Terrifiant) réduisent les dégâts de l'ennemi ; chaque état perd un tour à
// chaque riposte. Commun aux mobs et aux boss (voir performBossCounterAttack()).
function consumeEnemyAttackDebuffs(enemy) {
    let mult = 1;
    let note = "";
    const status = enemy.status || {};
    if (status.slowed && status.slowed.rounds > 0) {
        mult *= 0.5;
        note += " (ralenti)";
        status.slowed.rounds -= 1;
        if (status.slowed.rounds <= 0) status.slowed = null;
    }
    if (status.feared && status.feared.rounds > 0) {
        mult *= 0.65;
        note += " (apeuré)";
        status.feared.rounds -= 1;
        if (status.feared.rounds <= 0) status.feared = null;
    }
    // Bras touché (Point faible, chantier 6 V2) : ATQ réduite quelques tours.
    if (status.weakened && status.weakened.rounds > 0) {
        mult *= status.weakened.mult;
        note += " (bras touché)";
        status.weakened.rounds -= 1;
        if (status.weakened.rounds <= 0) status.weakened = null;
    }
    return { mult, note };
}

// Coût en mana effectif d'un sort (Économe le réduit).
function getSpellManaCost(spell) {
    if (!spell) return 0;
    const thrifty = getItemQualifierValues(spell, 'thrifty', 'spell');
    const cost = thrifty ? Math.max(1, Math.round(spell.manaCost * (1 - thrifty.pct / 100))) : spell.manaCost;
    const classMult = originClassEffects().manaCostMult; // Occultiste de foire : coût en mana −10 % (style)
    return classMult ? Math.max(1, Math.round(cost * classMult)) : cost;
}

// Tente d'appliquer un effet de statut au joueur selon le trait élémentaire du monstre
// (burn/poison/slow/stun/bleed/confusion/pull/light, définis dans mobModifiers). Appelée après
// une riposte ennemie réussie.
function applyMobEffectOnPlayer(enemy) {
    if (!enemy.effect) return;
    const triggerChance = 25; // 25% de chance que le trait élémentaire du monstre fasse effet
    if (Math.random() * 100 >= triggerChance) return;
    // Tenace (qualificatif d'armure) : chance de résister à l'effet qui allait s'appliquer.
    const tenacious = getItemQualifierValues(gameState.equipment.armor, 'tenacious', 'armor');
    if (tenacious && Math.random() * 100 < tenacious.chance) {
        logEvent(`🛡️ Tenace, vous résistez à l'effet de [${enemy.name}].`, "success");
        return;
    }

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

// Alias historique de la pause action -> riposte, désormais piloté par config.combatRhythm
// (voir runCombatBeats() ci-dessous) plutôt qu'une constante figée. Conservé tel quel pour les
// setTimeout(..., COMBAT_BEAT_MS) de fin de combat/mort, non restructurés en beats (voir
// performBossCounterAttackInner()/resolveEnemyCounterAttack() : un décès termine la séquence, il n'a
// pas besoin d'un "beat" de plus avant l'écran Game Over).
const COMBAT_BEAT_MS = config.combatRhythm.beatActionToRiposte;

// Empêche de spammer les boutons de combat pendant la petite pause entre deux actions
function setCombatInputLocked(locked) {
    [ui.btnAttackWeapon, ui.btnAttackRanged, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnSprint, ui.btnRetreat, ui.btnEngage, ui.btnFlee, ui.btnOccasion, ui.btnClassAbility].forEach(btn => {
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('opacity-40', locked);
        btn.classList.toggle('pointer-events-none', locked);
    });
}

// ==========================================
// SÉQUENCEUR DE TOUR EN BEATS (chantier "lisibilité combat")
// ==========================================
// Remplace l'ancien modèle "tout s'affiche en 0ms puis un verrou fixe de 400ms" par une petite file
// d'étapes espacées dans le temps. Volontairement construit sur des callbacks + setTimeout (comme le
// COMBAT_BEAT_MS déjà existant), JAMAIS sur des Promises/async-await : une vraie Promise diffère
// TOUJOURS sa continuation en microtâche, même résolue de façon synchrone — un test qui appelle une
// fonction de riposte en synchrone (voir tests/regression/combat-boss.js, combat-enrage.js...) et lit
// gameState.hp juste après casserait silencieusement. En callbacks purs, un stub
// `global.setTimeout = (fn) => fn();` (voir tests/long_playthrough.js, repris dans
// tests/regression/_helpers.js pour ce chantier) rend toute la chaîne synchrone d'un bout à l'autre
// sous Node, sans toucher un seul test existant.
//
// `steps` : tableau de `{ run, delay, skippable }`. `delay` est la pause AVANT que ce step ne
// s'exécute (pas après) — un step au tout début de la liste avec un delay standard reproduit donc
// exactement le comportement historique "verrouiller, attendre, puis résoudre". `skippable` (par
// défaut true, Chantier 9) : un step qui ne le désactive PAS explicitement (`skippable: false`) voit
// son délai ramené à 0 dès que combatSkipRequested est vrai — un `setTimeout(..., 0)` plutôt qu'un
// appel synchrone direct, pour rester un vrai callback asynchrone (cohérent avec le reste de la
// chaîne, et sans particularité sous le stub de test qui exécute de toute façon tout en synchrone).
// Les beats de mort/fin de combat (voir strikeAndCheckDeath()/resolveNonBossCounterAttack()/
// performPlayerAttack()) ne passent jamais par ce tableau — ils restent donc structurellement à
// l'abri du skip sans qu'aucun step n'ait besoin de poser `skippable: false` explicitement.
let combatSkipRequested = false;

// Marque une demande de skip pour le tour de beats EN COURS — drapeau MODULE-LEVEL (pas gameState,
// même convention que mobExamineOpen) : préférence d'affichage purement transitoire, jamais persistée
// ni lue par la logique de jeu. Remis à faux au tout début du PROCHAIN tour verrouillé
// (enemyCounterAttack()/triggerMobEnrage()), pour qu'un clic qui a démarré ce tour-ci (bulle jusqu'à
// #combat-zone) ne "pré-skippe" jamais le tour SUIVANT.
function requestCombatSkip() {
    if (gameState.pendingMinigame) return; // Espace/Entrée appartiennent alors à l'épreuve ouverte (minigames-ui.js)
    if (gameState.inCombat) combatSkipRequested = true;
}

function runCombatBeats(steps, onDone) {
    function playStep(index) {
        if (index >= steps.length) {
            if (onDone) onDone();
            return;
        }
        const step = steps[index];
        // Étape interactive (chantier 6, mini-jeux) : `run(done)` ouvre une épreuve et rappelle `done` à sa fin
        // (tout de suite en jet automatique) ; le tour reprend alors, sans délai ni skip de combat (le joueur
        // a la main, le skip de l'épreuve est le sien : Passer / Échap).
        if (step.interactive) { step.run(() => playStep(index + 1)); return; }
        const skip = combatSkipRequested && step.skippable !== false;
        setTimeout(() => {
            step.run();
            playStep(index + 1);
        }, skip ? 0 : (step.delay || 0));
    }
    playStep(0);
}

// Riposte de l'ennemi : verrouille les boutons, puis laisse resolveEnemyCounterAttack() dérouler sa
// propre séquence de beats (un seul beat pour un mob normal, plusieurs pour un pattern de boss) —
// c'est ELLE qui décide du rythme exact (télégraphe, multi-coups...), pas ce point d'entrée.
// onDone (chantier "lisibilité combat", Chantier 7) déverrouille ET rafraîchit l'UI en un seul point
// centralisé — jusqu'ici seul resolveNonBossCounterAttack() appelait updateUI() en fin de riposte
// (dans son propre beat), ce qui laissait les patterns de boss (7 branches dans
// performBossCounterAttackInner(), aucune n'appelant updateUI()) sans AUCUN rafraîchissement après un
// tour de boss complet : télégraphe posé, badges d'état, jauge de tension et badge de phase restaient
// figés sur leur état d'AVANT le tour jusqu'à ce qu'un événement sans rapport force un rendu — bug
// réel, confirmé par un script de vérification (attaques répétées sur un vrai setTimeout), pas
// seulement théorique. Centraliser ici plutôt que de rajouter updateUI() dans chacune des branches.
function enemyCounterAttack() {
    if (!gameState.currentEnemy) return; // sécurité si le combat vient d'être résolu
    combatSkipRequested = false; // Chantier 9 : jamais de skip qui fuite d'un tour précédent (ou du clic qui a déclenché celui-ci)
    setCombatInputLocked(true);
    resolveEnemyCounterAttack(() => {
        endClassDefenseTurn(); // Disparition / Encaisser : valables pour CETTE riposte seulement
        setCombatInputLocked(false);
        updateUI();
    });
}

// ==========================================
// BOSS : PHASES, TÉLÉGRAPHES, PATTERNS (Chantier 2 du rework combat)
// ==========================================
// Un boss n'est plus "un mob avec plus de PV" : son comportement change par PALIER DE PV (phases),
// via des patterns d'attaque et des états temporaires uniquement — aucune nouvelle entité, aucune
// modélisation spatiale (voir config.bossPhases). Chemin totalement séparé du mob normal/élite
// (resolveEnemyCounterAttack ci-dessous) : isEliteMob() exclut déjà les boss, donc aucun
// recouvrement avec le scaling élite du Chantier 1.

// ==========================================
// ÉPREUVES DE BOSS (chantier 6, V3 — voir NOTES_MINIJEUX.md)
// ==========================================
// Trois moments : la Parade (exécution d'un coup lourd télégraphié), Briser la garde (exécution de « il se hérisse ») et le Coup de
// grâce (coup fatal). 3 épreuves de télégraphe au plus par boss (MINIGAME_SETTINGS.boss.trialCap), puis le comportement d'avant ; le Coup
// de grâce s'y ajoute (4 au plus). Un Raté n'ajoute AUCUNE pénalité : le boss fait ce qu'il aurait fait sans épreuve. Sans interface
// (tests Node, simulation longue) : jamais d'épreuve, comportement strictement inchangé. Avec interface mais en mode « Jet automatique »
// ou via « Passer » : réussite tirée selon la compétence d'Arme, jamais de Parfait (bossAutoRates()).
function ensureBossTrials(enemy) {
    if (!enemy.trials) enemy.trials = { count: 0, perfects: 0 };
    return enemy.trials;
}

// Joue une épreuve de télégraphe puis rappelle `cb(outcome)` ('fail' sans épreuve : plafond atteint ou pas d'interface).
function runBossTrial(enemy, kind, cb) {
    const trials = ensureBossTrials(enemy);
    if (typeof requestAnimationFrame !== 'function' || trials.count >= MINIGAME_SETTINGS.boss.trialCap) { cb('fail'); return; }
    trials.count += 1;
    const spec = buildMinigameSpec(kind, { boss: true, allowPerfect: false, autoRates: bossAutoRates(gameState.skills.weapon.level) });
    startMinigame(spec, (outcome, detail) => {
        if (outcome === 'perfect' && !(detail && detail.auto)) trials.perfects += 1;
        cb(outcome);
    });
}

// Parade parfaite : le coup est détourné, le crawler riposte (x1,5, sans jamais achever le boss : le coup fatal reste le sien) et la garde
// du boss s'ouvre un tour (statut « exposé »).
function parryRiposte(enemy) {
    const gear = gameState.equipment.weapon || gameState.equipment.ranged;
    const atk = gameState.atk + (gear ? (gear.baseDmg || 0) : 0);
    const dmg = Math.max(0, Math.min(enemy.hp - 1, rollDamage(atk, enemy.def, { atkMultiplier: MINIGAME_SETTINGS.boss.parry.perfectRiposteMult, varianceRange: 0.15, defReduction: 0 })));
    enemy.hp -= dmg;
    if (dmg > 0) showFloatingDamage(ui.sceneMobAnchor, dmg, { toPlayer: false, heavy: true });
    enemy.status.exposed = { rounds: MINIGAME_SETTINGS.boss.exposed.rounds };
    return dmg;
}

// Briser la garde réussi : la garde n'est pas posée ; parfait, elle s'ouvre même (statut « exposé »).
function applyGuardBreak(enemy, outcome) {
    if (outcome === 'perfect') enemy.status.exposed = { rounds: MINIGAME_SETTINGS.boss.exposed.rounds };
}

// Coup de grâce : l'épreuve dépend de la dernière attaque. Le boss est de toute façon achevé (il n'y a pas de pénalité) ; seul un Parfait
// ouvre l'objet signature. Renvoie vrai si l'épreuve a été ouverte (l'appelant ne conclut pas le combat lui-même).
function offerCoupDeGrace(enemy) {
    if (!enemy.isBoss || enemy.finisherDone || !minigameIsInteractive()) return false;
    enemy.finisherDone = true;
    const kinds = { ranged: 'target', unarmed: 'choke' };
    const kind = kinds[gameState.lastAttackKind] || 'timing';
    const base = { label: 'Coup de grâce', icon: '💀', hint: 'Un dernier effort : visez juste !', boss: true, allowPerfect: false, autoRates: bossAutoRates(gameState.skills.weapon.level) };
    const extra = kind === 'timing' ? { zoneWidth: 0.2, periodMs: 1000 }
        : kind === 'target' ? { distance: gameState.combatDistance, skillLevel: gameState.skills.weapon.level, durationMs: MINIGAME_SETTINGS.target.durationMs }
        : {};
    logEvent(`💀 Coup de grâce ! [${enemy.name}] vacille, à votre merci...`, "danger");
    startMinigame(buildMinigameSpec(kind, Object.assign(base, extra)), (outcome, detail) => {
        const perfect = outcome === 'perfect' && !(detail && detail.auto);
        const trials = ensureBossTrials(enemy);
        enemy.finisherPerfect = perfect;
        if (perfect) trials.perfects += 1;
        playFinisherCinematic(perfect, () => {
            logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
            winCombat();
        });
    });
    return true;
}

// Phase dérivée UNIQUEMENT du ratio de PV courant (aucun champ de niveau dédié sur les mobs, comme
// le reste du moteur) : 100-66% phase 1, 66-33% phase 2, en dessous phase 3 ("folie").
function getBossPhase(enemy) {
    if (!enemy || !enemy.maxHp) return 1;
    const frac = enemy.hp / enemy.maxHp;
    if (frac > 2 / 3) return 1;
    if (frac > 1 / 3) return 2;
    return 3;
}

// Une seule frappe boss : réutilise rollDamage()/l'absorption de compagnon "Garde rapprochée"/
// applyPlayerDamage() strictement comme resolveEnemyCounterAttack() (jamais réécrits) — la riposte
// multi-coups de phase 2 n'est ainsi qu'une boucle de ce même bloc, pas une nouvelle formule de
// dégâts. Renvoie les dégâts réellement encaissés par le joueur (après absorption compagnon).
// `pressureFloorOverride` : le plancher de pression (config.mobDamageScaling.pressureFloorFrac,
// Chantier 1) est pensé "au moins X% des PV max par ATTAQUE", où une attaque = UN TOUR de boss. Le
// multi-coups de phase 2 fractionne un tour en plusieurs frappes ; sans ce paramètre, chaque frappe
// re-déclencherait indépendamment le plancher ABSOLU, le multipliant par le nombre de coups (constaté
// en test : un plancher pensé pour ~10%/tour grimpait à ~30%/tour avec 3 frappes). Omis (undefined),
// la frappe utilise le plancher complet standard (cas normal : une frappe = un tour entier).
// `silent` (chantier "lisibilité combat", Chantier 8) : réservé au multi-coups — supprime la ligne de
// log INDIVIDUELLE de ce coup (mais jamais l'application des dégâts/l'animation/l'effondrement d'un
// compagnon, qui reste toujours annoncé) pour que l'appelant puisse construire UNE seule ligne de
// résumé après la rafale plutôt que N lignes quasi identiques. Renvoie toujours playerDamage, silent
// ou non, pour que ce résumé puisse être construit à partir des montants réellement encaissés.
function executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy = false, silent = false) {
    // Ténébreux (armure) : chaque frappe peut être esquivée à part entière.
    if (rollPlayerDodge(enemy)) return 0;
    // Gelé/Terrifiant : réduction posée pour tout le tour par performBossCounterAttack().
    if (enemy._debuffAtkMult && enemy._debuffAtkMult !== 1) atk = Math.max(1, Math.round(atk * enemy._debuffAtkMult));
    const pressureFloor = pressureFloorOverride !== undefined
        ? pressureFloorOverride
        : gameState.maxHp * config.mobDamageScaling.pressureFloorFrac;
    const dmg = rollDamage(atk, getEffectiveDef(), {
        pressureFloor,
        minMitigation: config.mobDamageScaling.minMitigation
    });
    // Interception par le compagnon (Garde souvent, les autres parfois) — voir companionInterceptHit()
    const intercept = companionInterceptHit(dmg);
    let playerDamage = intercept.playerDamage;
    const companionAbsorbNote = intercept.note;
    const hpBefore = gameState.hp;
    playerDamage = applyPlayerDamage(playerDamage); // montant réellement perdu (Armure de scénario / Increvable)
    applyBraceReflect(enemy, playerDamage); // Encaisser (Sac de frappe, chantier 13)
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage);
    // Effet d'attaque du mob (fx.js) : chiffre, secousse et flash à l'impact ; `silent` = multi-coups,
    // joué sans élan pour tenir dans beatMultiHit.
    playMobAttackFx(enemy, { heavy, fast: silent, heldPlayerHp: hpBefore }, () => {
        showFloatingDamage(ui.sceneCrawlerAnchor, playerDamage, { toPlayer: true, heavy }); // `heavy` : télégraphe exécuté/ruée d'enrage/phase 3, voir les appelants
        if (heavy) triggerHeavyImpact(); // Chantier 4 : même flag, mêmes 3 occasions — voir triggerHeavyImpact()
    });
    if (!silent) logEvent(`${label} inflige ${playerDamage} dégâts${companionAbsorbNote}.`, "danger");
    checkCompanionDowned(); // À 0 PV : à terre jusqu'au prochain repos ou soin (plus de perte définitive)
    applyArmorMechanic(enemy, playerDamage); // Qualificatifs d'armure : aussi contre un boss (rien si le joueur est tombé)
    return playerDamage;
}

// Riposte complète d'un boss : sélectionne et résout un pattern selon sa phase courante, puis le
// DÉROULE en un ou plusieurs beats (voir runCombatBeats()) — un seul pattern par tour, jamais
// cumulés, seul leur RYTHME d'affichage change désormais (chantier "lisibilité combat").
// Enveloppe fine autour de performBossCounterAttackInner() : gère la fin de l'état enragé (Chantier
// 3) sur UN SEUL point de sortie (son onDone, appelé une fois TOUTE la séquence de beats jouée)
// plutôt que de dupliquer la logique sur chacun des nombreux points de sortie internes. "A-t-il placé
// un coup ce tour-ci ?" est détecté via le delta de floorStats.damageTaken — point de passage UNIQUE
// de toute perte de PV joueur (voir applyPlayerDamage()), donc un signal fiable même si l'attaque
// interne a pris un chemin qui NE frappe pas (télégraphe posé, buff de défense) : dans ce cas, ce
// tour compte quand même contre la durée restante de l'enrage, comme un tour de kiting normal — seul
// un coup RÉELLEMENT porté y met fin immédiatement (voir la consigne :
// "dure 2-3 tours OU jusqu'à ce qu'il place un coup").
function performBossCounterAttack(enemy, onDone) {
    const wasEnraged = !!(enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0);
    const dmgBefore = gameState.floorStats.damageTaken;
    // Gelé/Terrifiant (qualificatifs) : réduisent aussi les frappes d'un boss, pour tout ce tour.
    enemy._debuffAtkMult = consumeEnemyAttackDebuffs(enemy).mult;
    performBossCounterAttackInner(enemy, () => {
        enemy._debuffAtkMult = 1;
        if (wasEnraged && enemy.status.enraged) {
            if (gameState.floorStats.damageTaken > dmgBefore) {
                endMobEnrage(enemy);
            } else {
                enemy.status.enraged.rounds -= 1;
                if (enemy.status.enraged.rounds <= 0) endMobEnrage(enemy);
            }
        }
        if (onDone) onDone();
    });
}

// Sélectionne le pattern (inchangé, mêmes seuils/tirages qu'avant ce chantier — voir Chantier 2 du
// rework combat) puis construit la liste de beats qui le joue. Les tirages Math.random() de
// SÉLECTION restent tous synchrones, AVANT toute construction de step, exactement comme avant : seul
// le déroulé visuel (executeBossStrike()/logEvent() à l'intérieur d'un step) est décalé dans le temps.
// Répartition heavy/normal/vide : voir config.combatRhythm et le commentaire de runCombatBeats() —
// télégraphe posé (heavy et defBuff, moment d'annonce à fort enjeu, voir la bannière du Chantier 1),
// télégraphe EXÉCUTÉ et phase 3 (folie) sont "heavy" ; l'attaque de base et le harcèlement à distance
// restent au rythme standard ; le multi-coups espace ses frappes de beatMultiHit après la première.
function performBossCounterAttackInner(enemy, onDone) {
    const phase = getBossPhase(enemy);
    const bp = config.bossPhases;
    const rhythm = config.combatRhythm;
    let enemyAtk = enemy.atk;

    // Anti-abus mêlée collée + enrage par distance (Chantier 3) : mêmes multiplicateurs que le mob
    // normal/élite (resolveEnemyCounterAttack()), appliqués ICI UNE SEULE FOIS avant la sélection de
    // pattern, donc reflétés dans TOUTES les branches ci-dessous (télégraphe, multi-coups,
    // harcèlement, attaque de base, phase 3) sans dupliquer le multiplicateur à chaque point d'usage.
    if (gameState.combatDistance <= 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.meleeGluedDamageMult);
    }
    if (enemy.status.enraged && enemy.status.enraged.rounds > 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.atkMult);
    }

    // Un coup qui vide les PV du joueur programme gameOver() — jamais un beat de plus après la mort,
    // qui n'a rien à attendre. Petit helper pour ne pas dupliquer ce garde-fou à chaque step. Renvoie
    // les dégâts réellement encaissés (Chantier 8) : le multi-coups en a besoin pour construire sa
    // ligne de résumé consolidée à partir des montants silencieux de chaque frappe.
    const strikeAndCheckDeath = (atk, label, pressureFloorOverride, heavy = false, silent = false) => {
        const dealt = executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy, silent);
        if (gameState.hp <= 0) { gameState.hp = 0; setTimeout(() => gameOver(false, enemy), COMBAT_BEAT_MS); }
        return dealt;
    };

    // Changement de phase (chantier "lisibilité combat", Chantier 10) : détecté ICI, une seule fois
    // par tour, sur la phase déjà calculée ci-dessus — enemy.lastKnownPhase (posé au Chantier 6, à
    // l'entrée en combat) est mis à jour DANS TOUS LES CAS, mais un step de bannière n'est prépendu au
    // pattern du tour QUE si la phase vient de MONTER (jamais en phase 1 : rien à annoncer en y
    // entrant, c'est l'état de départ). runPattern() (au lieu d'appeler runCombatBeats() directement)
    // centralise ce préfixe pour ne pas le dupliquer sur les 7 points de sortie de cette fonction.
    const phaseJustIncreased = phase > enemy.lastKnownPhase;
    enemy.lastKnownPhase = phase;
    const runPattern = (patternSteps) => {
        const steps = phaseJustIncreased
            ? [{ run: () => announceBossPhaseChange(enemy, phase), delay: rhythm.beatHeavyEvent }, ...patternSteps]
            : patternSteps;
        runCombatBeats(steps, onDone);
    };

    // Phase 3 ("folie") : dégâts +40% fixes, pas de télégraphe — le boss cesse d'être tactique et
    // frappe en continu. enemy.status.frenzied (lu par performPlayerAttack()) réduit symétriquement
    // sa DEF effective : la fenêtre risque/récompense de cette phase (voir config.bossPhases.phase3).
    if (phase === 3) {
        enemy.status.frenzied = true;
        enemy.status.telegraph = null; // un télégraphe en cours à l'entrée en phase 3 est abandonné
        enemyAtk = Math.round(enemyAtk * bp.phase3.atkMult);
        runPattern([
            { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}], pris de folie furieuse, vous`, undefined, true), delay: rhythm.beatHeavyEvent }
        ]);
        return;
    }
    enemy.status.frenzied = false;

    // Exécution d'un télégraphe posé au tour précédent (annoncé, donc jamais une surprise)
    if (enemy.status.telegraph) {
        const tg = enemy.status.telegraph;
        enemy.status.telegraph = null;
        if (tg.type === 'heavy') {
            const boosted = Math.round(enemyAtk * bp.telegraphHeavyMult);
            let parry = 'fail';
            runPattern([
                // Parade (chantier 6, V3) : fenêtre de timing AVANT le coup — rien ne change sans épreuve ni en cas de Raté.
                { interactive: true, run: (done) => runBossTrial(enemy, 'parry', (o) => { parry = o; done(); }) },
                {
                    run: () => {
                        if (parry === 'perfect') {
                            const riposte = parryRiposte(enemy);
                            logEvent(`🛡️ Parade parfaite ! Vous détournez l'attaque de [${enemy.name}] et ripostez (${riposte} dégâts) : sa garde est ouverte.`, "success");
                            return;
                        }
                        const parried = parry === 'success';
                        const mult = parried ? MINIGAME_SETTINGS.boss.parry.successDamageMult : 1;
                        const floor = parried ? gameState.maxHp * config.mobDamageScaling.pressureFloorFrac * mult : undefined; // le plancher de pression suit la réduction
                        strikeAndCheckDeath(Math.round(boosted * mult), `[${enemy.name}] abat son attaque annoncée${parried ? ', que vous parez à moitié,' : ''} et`, floor, true);
                    },
                    delay: rhythm.beatHeavyEvent
                }
            ]);
            return;
        }
        if (tg.type === 'defBuff') {
            let guard = 'fail';
            runPattern([
                // Briser la garde (chantier 6, V3) : un point faible à toucher avant que la garde ne monte.
                { interactive: true, run: (done) => runBossTrial(enemy, 'guard', (o) => { guard = o; done(); }) },
                {
                    run: () => {
                        if (guard === 'success' || guard === 'perfect') {
                            applyGuardBreak(enemy, guard);
                            logEvent(`🔨 Vous brisez la garde de [${enemy.name}] avant qu'elle ne monte${guard === 'perfect' ? ' : sa défense s\'ouvre même !' : '.'}`, "success");
                            return;
                        }
                        enemy.status.defBuffed = { rounds: bp.defBuffRounds };
                        logEvent(`[${enemy.name}] se hérisse : sa garde vient de monter, sans vous frapper ce tour-ci.`, "info");
                    },
                    delay: rhythm.beatHeavyEvent
                }
            ]);
            return;
        }
    }

    // Phase 2 : patterns supplémentaires (frappe multiple, harcèlement à distance, buff de défense
    // télégraphié), en plus de la base de phase 1 ci-dessous. Chances mutuellement exclusives.
    if (phase === 2) {
        const roll = Math.random();
        let threshold = bp.multiStrikeChance;
        if (roll < threshold) {
            const hits = 2 + (Math.random() < 0.5 ? 0 : 1); // 2 ou 3 coups
            const perHitAtk = Math.round(enemyAtk * (bp.multiStrikeTotalMult / hits));
            // Plancher de pression réparti entre les coups (voir le commentaire d'executeBossStrike) :
            // la SOMME sur le tour reste le plancher standard, au lieu de le multiplier par `hits`.
            const perHitPressureFloor = (gameState.maxHp * config.mobDamageScaling.pressureFloorFrac) / hits;
            logEvent(`[${enemy.name}] enchaîne ${hits} frappes rapides !`, "danger");
            // beatMultiHit entre chaque frappe (première frappe au rythme standard, comme n'importe
            // quelle riposte) — un décès en cours de rafale arrête la file (voir strikeAndCheckDeath).
            // Chaque frappe individuelle reste SILENCIEUSE (Chantier 8, lisibilité combat) : au lieu de
            // N lignes de log quasi identiques, UNE seule ligne de résumé après la dernière frappe qui
            // atteint réellement sa cible (jamais si le joueur meurt en cours de rafale — l'écran Game
            // Over prend le relais, un résumé de plus n'apporterait rien).
            const dealtAmounts = [];
            const steps = [];
            for (let i = 0; i < hits; i++) {
                steps.push({
                    run: () => {
                        if (gameState.hp <= 0) return;
                        dealtAmounts.push(strikeAndCheckDeath(perHitAtk, `Frappe ${i + 1}/${hits} :`, perHitPressureFloor, false, true));
                        if (i === hits - 1 && gameState.hp > 0) {
                            const total = dealtAmounts.reduce((sum, d) => sum + d, 0);
                            logEvent(`💥 ${dealtAmounts.length} frappes vous touchent : ${dealtAmounts.join(' + ')} = ${total} dégâts au total.`, "danger");
                        }
                    },
                    delay: i === 0 ? rhythm.beatActionToRiposte : rhythm.beatMultiHit
                });
            }
            runPattern(steps);
            return;
        }
        threshold += bp.rangedHarassChance;
        if (roll < threshold) {
            // Harcèlement à distance : mécanique volontairement minimale ici (pont avec le futur
            // Chantier 3 "enrage distance", pas encore implémenté — voir NOTES_COMBAT.md).
            const harassAtk = Math.round(enemyAtk * bp.rangedHarassMult);
            runPattern([
                { run: () => strikeAndCheckDeath(harassAtk, `[${enemy.name}] vous harcèle à distance et`), delay: rhythm.beatActionToRiposte }
            ]);
            return;
        }
        threshold += bp.defBuffTelegraphChance;
        if (roll < threshold) {
            runPattern([{
                run: () => {
                    enemy.status.telegraph = { type: 'defBuff' };
                    logEvent(`[${enemy.name}] se raidit, une garde imminente se prépare...`, "info");
                },
                delay: rhythm.beatHeavyEvent
            }]);
            return;
        }
    }

    // Phase 1 (et repli de phase 2) : chance de télégraphier une attaque lourde pour le tour
    // suivant (annonce sans dégât), sinon attaque de base normale.
    const heavyChance = phase === 1 ? bp.phase1TelegraphChance : bp.phase2TelegraphChance;
    if (Math.random() < heavyChance) {
        runPattern([{
            run: () => {
                enemy.status.telegraph = { type: 'heavy' };
                logEvent(`[${enemy.name}] prépare un coup dévastateur...`, "info");
            },
            delay: rhythm.beatHeavyEvent
        }]);
        return;
    }

    runPattern([
        { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}] vous`), delay: rhythm.beatActionToRiposte }
    ]);
}

// Riposte de l'ennemi : tient compte de son propre saignement/étourdissement en cours, de l'armure
// équipée du joueur, et peut infliger un effet de statut selon son trait élémentaire. `onDone` (voir
// runCombatBeats()) est appelé une fois TOUTE la séquence visuelle de ce tour jouée — immédiatement
// pour un mob normal (un seul beat) ou après le dernier beat d'un pattern de boss.
function resolveEnemyCounterAttack(onDone) {
    const enemy = gameState.currentEnemy;
    if (!enemy) { if (onDone) onDone(); return; } // sécurité si le combat vient d'être résolu pendant la pause
    if (consumeSurprise(enemy)) { if (onDone) onDone(); return; } // tireur surpris (attaque furtive au contact) : première riposte perdue

    // Saignement en cours sur l'ennemi (infligé par une arme du joueur) : tique avant son action.
    // Affichage immédiat (pas de beat dédié) : un tick de saignement est un petit événement annexe,
    // pas "la riposte" elle-même — voir config.combatRhythm.beatEmptyEvent.
    if (enemy.status && enemy.status.bleed && enemy.status.bleed.rounds > 0) {
        const dmg = enemy.status.bleed.dmgPerRound;
        enemy.hp -= dmg;
        enemy.status.bleed.rounds -= 1;
        if (enemy.status.bleed.rounds <= 0) enemy.status.bleed = null;
        logEvent(`🩸 [${enemy.name}] souffre de son saignement (-${dmg} PV).`, "danger");
        if (enemy.hp <= 0) {
            logEvent(`[${enemy.name}] succombe à ses blessures !`, "success");
            winCombat();
            if (onDone) onDone();
            return;
        }
    }

    // Étourdissement en cours sur l'ennemi : il rate son tour
    if (enemy.status && enemy.status.stunned) {
        logEvent(`[${enemy.name}] est étourdi et ne peut pas riposter !`, "info");
        const stunLeft = typeof enemy.status.stunned === 'number' ? enemy.status.stunned - 1 : 0; // Uppercut + synergie Troll : étourdi plusieurs tours
        enemy.status.stunned = stunLeft > 0 ? stunLeft : false;
        showDie(ui.combatEnemyDie, "😴");
        // Plus de updateUI() explicite ici (Chantier 7) : onDone() le fait déjà, centralisé.
        if (onDone) onDone();
        return;
    }

    // Immobilisé (action spéciale Immobiliser, chantier 6 V2) : il ne peut pas riposter, pendant `rounds` de ses tours.
    if (enemy.status && enemy.status.immobilized && enemy.status.immobilized.rounds > 0) {
        enemy.status.immobilized.rounds -= 1;
        if (enemy.status.immobilized.rounds <= 0) enemy.status.immobilized = null;
        logEvent(`[${enemy.name}] est immobilisé et ne peut pas riposter !`, "info");
        showDie(ui.combatEnemyDie, "🤼");
        if (onDone) onDone();
        return;
    }

    // Déconcentré (qualificatif Vibrant) : chance de rater complètement sa riposte, le temps que l'effet dure.
    if (enemy.status && enemy.status.distracted && enemy.status.distracted.rounds > 0) {
        const distracted = enemy.status.distracted;
        distracted.rounds -= 1;
        if (distracted.rounds <= 0) enemy.status.distracted = null;
        if (Math.random() * 100 < distracted.miss) {
            logEvent(`😬 [${enemy.name}], déconcentré, frappe complètement à côté !`, "info");
            showDie(ui.combatEnemyDie, "😬");
            if (onDone) onDone();
            return;
        }
    }

    // Compteur de kiting (Chantier 3) : atteindre ce point signifie que le mob RÉUSSIT à agir ce
    // tour-ci (quel que soit le chemin emprunté pour y arriver, boss ou non) — remise à sa base.
    resetMobKiting(enemy);

    // Boss : chemin de riposte totalement séparé (patterns par phase, voir performBossCounterAttack()
    // ci-dessous, Chantier 2 du rework combat) — jamais mélangé au chemin mob normal/élite ci-dessous,
    // pour ne rien changer au comportement déjà testé du Chantier 1 sur les mobs non-boss. Lui délègue
    // ENTIÈREMENT la responsabilité d'appeler onDone (sa propre séquence de beats en décide le moment).
    if (enemy.isBoss) {
        performBossCounterAttack(enemy, onDone);
        return;
    }

    // Mob normal/élite : un seul beat (le rythme standard action -> riposte, comme avant ce chantier)
    // avant de dérouler la riposte elle-même (resolveNonBossCounterAttack(), formules inchangées).
    runCombatBeats([
        { run: () => resolveNonBossCounterAttack(enemy), delay: config.combatRhythm.beatActionToRiposte }
    ], onDone);
}

function resolveNonBossCounterAttack(enemy) {
    const wasBlinded = gameState.status.blinded && gameState.status.blinded.rounds > 0;
    const wasCorroded = gameState.status.corroded && gameState.status.corroded.rounds > 0;

    // Ennemi ralenti (arme "Gelé") ou apeuré (arme "Intimidant") : sa riposte inflige moins de dégâts.
    // Les deux réductions se cumulent si l'ennemi subit les deux effets à la fois.
    const debuffs = consumeEnemyAttackDebuffs(enemy);
    let enemyAtk = debuffs.mult !== 1 ? Math.round(enemy.atk * debuffs.mult) : enemy.atk;
    const enemySlowedNote = debuffs.note;

    // Ténébreux (armure) : l'attaque entière peut être esquivée.
    if (rollPlayerDodge(enemy)) {
        showDie(ui.combatEnemyDie, "🌑");
        return;
    }

    // Élites (voir isEliteMob()) : multiplicateur de dégâts dédié, EN PLUS du scaling par étage et
    // des modificateurs aléatoires déjà existants (qui gonflaient surtout les PV) — chantier "rework
    // combat". Jamais sur un boss : isEliteMob() les exclut déjà (ils ont leur propre traitement,
    // voir Chantier 2 du même rework).
    // Rampe de la Convention collective (chantier 15) : ×1,3 / ×1,5 aux étages 3-4 ; jamais pour un chasseur de primes, dont les stats sont
    // calées sur le multiplicateur normal (computeBountyHunterStats()).
    if (isEliteMob(enemy)) {
        enemyAtk = Math.round(enemyAtk * (enemy.isBountyHunter ? config.mobDamageScaling.eliteDamageMult : eliteDamageMultForFloor(gameState.currentFloor)));
    }

    // Anti-abus mêlée collée (Chantier 3) : un mob inflige toujours +10% de dégâts à écart nul, pour
    // que rester collé au corps à corps ne devienne jamais une stratégie dominante à coût nul.
    if (gameState.combatDistance <= 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.meleeGluedDamageMult);
    }
    // Enrage par distance (Chantier 3) : dégâts +40% tant que l'état est actif (voir
    // noteMobKitingRound()/triggerMobEnrage()).
    const enemyWasEnraged = enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0;
    if (enemyWasEnraged) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.atkMult);
    }

    const enemyDamage = rollDamage(enemyAtk, getEffectiveDef(), {
        // Plancher de pression / cap de réduction : dégâts MOB -> joueur uniquement (chantier "rework
        // combat", voir config.mobDamageScaling et rollDamage()).
        pressureFloor: gameState.maxHp * config.mobDamageScaling.pressureFloorFrac,
        minMitigation: config.mobDamageScaling.minMitigation
    });

    // Compagnon : la Garde s'interpose souvent, les autres sont parfois pris dans la mêlée (en plus du
    // bonus passif de DEF de la Garde, voir getEffectiveDef()) — voir companionInterceptHit().
    const guardWasActive = hasActiveCompanion('guard');
    const intercept = companionInterceptHit(enemyDamage);
    let playerDamage = intercept.playerDamage;
    const companionAbsorbNote = intercept.note;

    const hpBefore = gameState.hp;
    playerDamage = applyPlayerDamage(playerDamage); // montant réellement perdu (Armure de scénario / Increvable)
    applyBraceReflect(enemy, playerDamage); // Encaisser (Sac de frappe, chantier 13)
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage);
    playMobAttackFx(enemy, { heldPlayerHp: hpBefore }, () => {
        showFloatingDamage(ui.sceneCrawlerAnchor, playerDamage, { toPlayer: true }); // mob normal/élite : jamais "heavy" (réservé aux moments boss/enrage)
    });
    const guardNote = guardWasActive
        ? ` (réduits grâce à la garde de ${gameState.companion.name})`
        : "";
    // Note d'état déplacée après les dégâts plutôt qu'entre le nom et "vous inflige" (chantier
    // "lisibilité combat", Chantier 8) : lecture plus naturelle, aucune info retirée.
    logEvent(`[${enemy.name}] vous inflige ${playerDamage} dégâts${enemySlowedNote}${wasBlinded ? " (vous étiez ébloui)" : ""}${wasCorroded ? " (armure corrodée)" : ""}${guardNote}${companionAbsorbNote}.`, "danger");

    // Le compagnon tombe s'il vient d'encaisser le coup de trop : à terre jusqu'au prochain repos ou soin.
    checkCompanionDowned();

    // L'éblouissement et la corrosion se dissipent d'un round à chaque riposte encaissée
    if (wasBlinded) {
        gameState.status.blinded.rounds -= 1;
        if (gameState.status.blinded.rounds <= 0) gameState.status.blinded = null;
    }
    if (wasCorroded) {
        gameState.status.corroded.rounds -= 1;
        if (gameState.status.corroded.rounds <= 0) gameState.status.corroded = null;
    }

    // Enrage par distance (Chantier 3) : une frappe RÉUSSIE pendant l'état (celle-ci, pas la ruée
    // d'entrée qui l'a déclenché — voir triggerMobEnrage()) met fin à l'état immédiatement.
    if (enemyWasEnraged) {
        endMobEnrage(enemy);
    }

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        setTimeout(() => gameOver(false, enemy), COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer
        return;
    }

    // Compagnon "Premiers secours" : chance de soigner le joueur après la riposte ennemie (et un peu de mana)
    companionMedicAfterRiposte();

    applyMobEffectOnPlayer(enemy);
    applyArmorMechanic(enemy, playerDamage);
    // Plus de updateUI() ici (chantier "lisibilité combat", Chantier 7) : centralisé dans l'onDone
    // d'enemyCounterAttack(), pour couvrir aussi les patterns de boss qui n'appelaient jamais cette
    // fonction (voir le commentaire d'enemyCounterAttack()).
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
    gameState.lastAttackKind = 'weapon'; // Posture du crawler (scene.js) : l'arme de mêlée en main

    // Arme arrachée par un effet magnétique en cours : l'attaque à l'arme est indisponible
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Écart nul garanti (voir garde ci-dessus) : sans effet sur un mob de mêlée, mais un mob à distance doit encore reculer pour tirer
        return;
    }

    const atkMultiplier = weaponAttackMultiplier('weaponMult'); // +4 % par niveau d'Arme, × style de classe (Duelliste)
    const equippedGear = gameState.equipment.weapon;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear: equippedGear }, "à l'arme");
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
    gameState.lastAttackKind = 'ranged'; // Posture du crawler (scene.js) : l'arme à distance en main

    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        return;
    }

    const atkMultiplier = weaponAttackMultiplier('rangedMult'); // Même compétence "Arme" que le corps à corps ; style Franc-tireur
    const equippedGear = gameState.equipment.ranged;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear: equippedGear }, "à distance");
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
    gameState.lastAttackKind = 'unarmed'; // Posture du crawler (scene.js) : garde du boxeur

    const skill = gameState.skills.unarmed;
    const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1)); // +3% par niveau, plafonné à 75%
    const landed = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75 * unarmedDamageMult(), varianceRange: 0.10, defReduction }, "à mains nues");
    if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
}

// ==========================================
// RACE : PASSIFS (chantier 13, lot 1 — voir origins.js et CHANTIERS.md)
// ==========================================
// `gameState.race` (clé d'ORIGIN_RACES, null = aucune : une ancienne sauvegarde ou un crawler avant l'étage 3 n'a aucun effet) choisit une entrée de
// `config.origins.races`. UN SEUL point de lecture par effet : PV max (recomputeMaxHp), XP (gainXp), soins (applyPlayerHeal), DEF (getEffectiveDef),
// mana max (recomputeRaceDerived), réserve (idem), furtivité (getStealthChance), fuite (attemptFlee), pièges et saignement (applyRaceDamageMods),
// mains nues (unarmedDamageMult), sorts (attackMagic), Increvable (applyPlayerDamage).
function originRaceEffects() {
    return (gameState.race && config.origins.races[gameState.race]) || {};
}

// Choisit la race (une seule fois par run, définitif) : pose `gameState.race` puis recalcule les valeurs dérivées.
function applyRace(key) {
    if (!config.origins.races[key]) return false;
    gameState.race = key;
    gameState.raceLastStandFloor = 0;
    recomputeRaceDerived();
    return true;
}

// PV max, mana max et emplacements de réserve dépendent de la race : recalculés au choix, à la restauration d'une sauvegarde.
function recomputeRaceDerived() {
    const fx = originRaceEffects();
    const hadMaxMana = gameState.maxMana || 100;
    gameState.maxMana = Math.round(100 * (fx.maxManaMult || 1));
    gameState.mana = Math.min(gameState.maxMana, Math.round(gameState.mana * gameState.maxMana / hadMaxMana));
    gameState.maxInventory = config.inventory.maxEquipment + (fx.extraReserve || 0);
    recomputeMaxHp();
}

// Dégâts de pièges et de saignement après la race (Gobelin : pièges −25 %, Goule : saignement −50 %) ; jamais sous 1.
function applyRaceDamageMods(amount, source) {
    const fx = originRaceEffects();
    const mult = source === 'trap' ? fx.trapMult : source === 'bleed' ? fx.bleedMult : null;
    if (!mult || !(amount > 0)) return amount;
    return Math.max(1, Math.round(amount * mult));
}

// Multiplicateur de dégâts à mains nues : buff de départ (chantier 14) × race (Troll).
function unarmedDamageMult() {
    return starterBuffUnarmedMult() * (originRaceEffects().unarmedMult || 1) * (originClassEffects().unarmedMult || 1); // + Bagarreur (style)
}

// Armure de scénario (chantier 15, lot 4, config.earlyGame.plotArmor) : aux étages 1-3, le premier coup mortel de chaque étage laisse `leaveHp` PV (aussi contre un boss), et le
// reste du tour ennemi en cours est absorbé (`status.plotShield`, uniquement en combat, éteint par la prochaine action du joueur) — jamais deux frappes d'une même rafale d'affilée.
// Passe AVANT l'Increvable du Cafard : à 1 PV aucun des deux ne rejoue, il n'y a donc pas de double vie sur un même coup.
function applyPlotArmor(amount) {
    const eg = config.earlyGame;
    if (!eg.enabled || !eg.plotArmor.enabled || gameState.currentFloor > eg.maxFloor) return amount;
    if (gameState.inCombat && gameState.status.plotShield) return 0;
    if (!(amount >= gameState.hp) || gameState.plotArmorFloor === gameState.currentFloor) return amount;
    gameState.plotArmorFloor = gameState.currentFloor;
    if (gameState.inCombat) gameState.status.plotShield = true;
    recordRunEvent('plotArmor');
    logEvent("🎬 Armure de scénario : le coup était fatal. Mais l'audience vient de grimper de 40 %, et la production a décidé que vous restiez en vie. (Un coup mortel par étage, jusqu'à l'étage 3.)", "success");
    return Math.max(0, gameState.hp - eg.plotArmor.leaveHp);
}

// Increvable (Cafard mutant) : un dégât mortel laisse 1 PV, 1 fois par étage, jamais contre un boss. Renvoie le montant à appliquer.
function applyRaceLastStand(amount) {
    const fx = originRaceEffects();
    if (!fx.lastStand || !(amount >= gameState.hp) || gameState.hp <= 1) return amount;
    if (gameState.raceLastStandFloor === gameState.currentFloor) return amount;
    if (gameState.inCombat && gameState.currentEnemy && gameState.currentEnemy.isBoss) return amount;
    gameState.raceLastStandFloor = gameState.currentFloor;
    recordRunEvent('lastStand');
    logEvent("🪳 Increvable : le coup aurait dû vous tuer, mais un cafard, ça se retourne et ça repart. Il vous reste 1 PV.", "success");
    return gameState.hp - 1;
}

// ==========================================
// CLASSE : PASSIFS DE STYLE ET CAPACITÉS ACTIVES (chantier 13, lot 3 — voir origins.js et CHANTIERS.md)
// ==========================================
// `gameState.crawlerClass` (clé d'ORIGIN_CLASSES, null = aucune) choisit une entrée de `config.origins.classes` : un passif de style (lu à son point
// d'usage : PV max, mains nues, arme, tir, coût en mana, niveau de Furtivité) et UNE capacité active, utilisable 1 fois par combat
// (`gameState.classAbilityUsed`, remis à faux dans initiateCombat()). Une capacité prend le tour : la riposte suit normalement. Les synergies
// race × classe (`config.origins.synergies`) REMPLACENT certains chiffres de la classe. Contre un boss, les statuts sont réduits (voir chaque capacité).
function originClassEffects() {
    return (gameState.crawlerClass && config.origins.classes[gameState.crawlerClass]) || {};
}

// Chiffres de la capacité en cours : ceux de la classe, remplacés champ par champ par la synergie race × classe éventuelle.
function originAbilityValues() {
    const syn = originSynergyFor(gameState.race, gameState.crawlerClass);
    return Object.assign({}, originClassEffects(), (syn && config.origins.synergies[`${syn.race}+${syn.cls}`]) || {});
}
function activeSynergy() {
    const syn = originSynergyFor(gameState.race, gameState.crawlerClass);
    return (syn && config.origins.synergies[`${syn.race}+${syn.cls}`]) || null;
}

function effectiveStealthLevel() {
    const base = (gameState.skills && gameState.skills.stealth && gameState.skills.stealth.level) || 1;
    return base + (originClassEffects().stealthLevels || 0); // Filou : Furtivité +1 niveau (style)
}

// Multiplicateur d'une attaque d'arme (mêlée ou distance) : +4 % par niveau d'Arme, × style de classe (`styleKey` : 'weaponMult' | 'rangedMult').
function weaponAttackMultiplier(styleKey) {
    const level = gameState.skills.weapon.level;
    return (1.0 + 0.04 * (level - 1)) * (originClassEffects()[styleKey] || 1);
}

// Fin de la riposte : Disparition et Encaisser ne valent que pour elle.
function endClassDefenseTurn() {
    const vanish = gameState.status && gameState.status.vanish;
    if (vanish) { vanish.dodging = false; if (vanish.turns <= 0 && !vanish.nextAttack) gameState.status.vanish = null; }
    if (gameState.status && gameState.status.brace) gameState.status.brace = null;
}

// Encaisser : une part des dégâts réellement subis revient à l'attaquant (jamais de coup fatal : l'ennemi garde au moins 1 PV, comme Épineux).
function applyBraceReflect(enemy, damageTaken) {
    if (!gameState.status.brace || !(damageTaken > 0) || !enemy) return 0;
    const pct = originAbilityValues().reflectPct || 0;
    const back = Math.min(Math.max(0, enemy.hp - 1), Math.max(1, Math.round(damageTaken * pct)));
    if (back <= 0) return 0;
    enemy.hp -= back;
    logEvent(`🛡️ Encaisser : ${back} dégâts renvoyés à [${enemy.name}] (${Math.round(pct * 100)} %).`, "success");
    return back;
}

// Disponibilité de la capacité (pure, lue par le bouton et par useClassAbility()) : { usable, reason }.
function classAbilityStatus() {
    const cls = originEntry('class', gameState.crawlerClass);
    if (!cls) return { usable: false, reason: "Aucune classe." };
    if (!gameState.inCombat || !gameState.currentEnemy) return { usable: false, reason: "Seulement en combat." };
    if (gameState.classAbilityUsed) return { usable: false, reason: "Déjà utilisée dans ce combat." };
    const disarmed = gameState.status.disarmed && gameState.status.disarmed.rounds > 0;
    switch (cls.key) {
        case 'brawler': if (gameState.combatDistance > 0) return { usable: false, reason: "Trop loin pour frapper." }; break;
        case 'duelist':
            if (!gameState.equipment.weapon) return { usable: false, reason: "Aucune arme équipée." };
            if (disarmed) return { usable: false, reason: "Arme arrachée." };
            if (gameState.combatDistance > 0) return { usable: false, reason: "Trop loin pour frapper." };
            break;
        case 'gunslinger':
            if (!gameState.equipment.ranged) return { usable: false, reason: "Aucune arme à distance." };
            if (disarmed) return { usable: false, reason: "Arme arrachée." };
            break;
        case 'occultist': if (!gameState.equipment.spell) return { usable: false, reason: "Aucun sort équipé." }; break;
    }
    return { usable: true, reason: "" };
}

// Utilise la capacité de classe. Renvoie vrai si elle a été jouée (un tour consommé).
function useClassAbility() {
    const status = classAbilityStatus();
    if (!status.usable) {
        if (gameState.inCombat) logEvent(`${status.reason} Capacité indisponible.`, "danger");
        return false;
    }
    const key = gameState.crawlerClass;
    const run = CLASS_ABILITIES[key];
    if (!run || !tryPlayerAction()) return false;
    gameState.classAbilityUsed = true;
    recordRunEvent('classAbility', { boss: !!(gameState.currentEnemy && gameState.currentEnemy.isBoss), synergy: !!activeSynergy() });
    run(originAbilityValues());
    updateUI();
    return true;
}

const CLASS_ABILITIES = {
    // Uppercut du dimanche : mains nues ×2 ; étourdit (1 tour, 2 avec la synergie Troll). Un boss n'est jamais étourdi : il est « exposé » seulement avec la synergie.
    brawler(v) {
        gameState.lastAttackKind = 'unarmed';
        const skill = gameState.skills.unarmed;
        const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1));
        const landed = performPlayerAttack(gameState.atk, {
            atkMultiplier: 0.75 * unarmedDamageMult() * v.abilityMult, varianceRange: 0.10, defReduction,
            onHit: (enemy) => {
                if (!enemy.isBoss) {
                    enemy.status.stunned = v.stunTurns > 1 ? v.stunTurns : true;
                    logEvent(`💫 Uppercut du dimanche : [${enemy.name}] voit des chandelles${v.stunTurns > 1 ? ` (${v.stunTurns} tours)` : ''} !`, "success");
                } else if (v.bossExposed) {
                    enemy.status.exposed = { rounds: 1 };
                    logEvent(`💫 Uppercut du dimanche : la garde de [${enemy.name}] est ouverte !`, "success");
                }
            }
        }, "avec un Uppercut du dimanche");
        if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
    },
    // Fendre : frappe à l'arme ×1,8 qui ignore la moitié de la DEF.
    duelist(v) {
        gameState.lastAttackKind = 'weapon';
        const gear = gameState.equipment.weapon;
        const landed = performPlayerAttack(gameState.atk + (gear.baseDmg || 0), {
            atkMultiplier: weaponAttackMultiplier('weaponMult') * v.abilityMult, varianceRange: 0.15, defReduction: v.abilityDefIgnore, gear
        }, "en fendant");
        if (landed) { gainSkillXp('weapon', SKILL_XP_PER_USE); applyWeaponMechanic(gear); }
    },
    // Tir de barrage : `shots` tirs à ×0,8 à toute distance, une seule riposte à la fin (jamais de second tir sur un ennemi déjà tombé).
    gunslinger(v) {
        gameState.lastAttackKind = 'ranged';
        const gear = gameState.equipment.ranged;
        let landedAny = false;
        for (let i = 0; i < v.shots; i++) {
            const enemy = gameState.currentEnemy;
            if (!gameState.inCombat || !enemy || enemy.hp <= 0 || gameState.pendingMinigame) break;
            const last = i === v.shots - 1;
            const landed = performPlayerAttack(gameState.atk + (gear.baseDmg || 0), {
                atkMultiplier: weaponAttackMultiplier('rangedMult') * v.shotMult, varianceRange: 0.15, defReduction: 0, gear, skipReaction: !last
            }, `en rafale (tir ${i + 1}/${v.shots})`);
            landedAny = landedAny || landed;
        }
        if (landedAny) { gainSkillXp('weapon', SKILL_XP_PER_USE); applyWeaponMechanic(gear); }
    },
    // Surcharge : le prochain sort est gratuit, plus fort et ne rate jamais (voir castEquippedSpell()) ; la synergie Elfe rend aussi du mana.
    occultist(v) {
        gameState.status.overcharge = true;
        if (v.manaRefund) gameState.mana = Math.min(gameState.maxMana, gameState.mana + v.manaRefund);
        showDie(ui.combatPlayerDie, "🔮");
        playClassAbilityFx('occultist');
        logEvent(`🔮 Surcharge : votre prochain sort sera gratuit, ×${v.abilityMult} et infaillible${v.manaRefund ? ` (+${v.manaRefund} mana)` : ''}.`, "success");
        resolveEnemyReaction();
    },
    // Disparition : la prochaine riposte (2 avec la synergie Gobelin) est esquivée et l'attaque suivante porte ×2.
    trickster(v) {
        gameState.status.vanish = { turns: v.dodgeTurns, nextAttack: true, dodging: false };
        showDie(ui.combatPlayerDie, "🎭");
        playClassAbilityFx('trickster');
        logEvent(`🎭 Disparition : vous vous fondez dans le décor (${v.dodgeTurns} riposte${v.dodgeTurns > 1 ? 's' : ''} esquivée${v.dodgeTurns > 1 ? 's' : ''}, prochaine attaque ×${v.nextAttackMult}).`, "success");
        resolveEnemyReaction();
    },
    // Encaisser : DEF ×2 pour la riposte qui suit, et une part des dégâts reçus revient à l'attaquant.
    punchingBag(v) {
        gameState.status.brace = true;
        showDie(ui.combatPlayerDie, "🛡️");
        playClassAbilityFx('punchingBag');
        logEvent(`🛡️ Encaisser : DEF ×${v.braceDefMult} pour la prochaine riposte, ${Math.round(v.reflectPct * 100)} % des dégâts renvoyés.`, "success");
        resolveEnemyReaction();
    }
};

// Bouton de capacité (bande pleine largeur au-dessus des attaques, comme #btn-occasion) : visible en combat avec une classe ; grisé quand
// la capacité est indisponible, avec la raison. Appelée par updateUI().
function updateClassAbilityUI() {
    const btn = ui.btnClassAbility;
    if (!btn) return;
    const cls = originEntry('class', gameState.crawlerClass);
    const show = !!cls && gameState.inCombat && !!gameState.currentEnemy;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    const status = classAbilityStatus();
    btn.disabled = !status.usable;
    btn.classList.toggle('opacity-40', !status.usable);
    btn.classList.toggle('pointer-events-none', !status.usable);
    btn.innerHTML = `${cls.icon} ${cls.abilityName}<span class="block text-[9px] font-normal normal-case opacity-80">${status.usable ? 'Capacité de classe · 1 fois par combat' : status.reason}</span>`;
    btn.title = `${cls.name} — ${cls.ability}`;
}

// ==========================================
// BUFF DE DÉPART « FOUTU POUR FOUTU » (chantier 14 — voir CHANTIERS.md)
// ==========================================
// Un crawler dont le cadeau de bienvenue n'est NI une arme, NI une arme à distance, NI un sort (cadeau « Armure » ou « Rien », 22 % des
// départs) démarre avec `starterBuff = 'desperate'` : +5 % de dégâts subis, dégâts ×2 à mains nues (attaque Mains nues, Étrangler, Charge
// à mains nues). Il saute dès que le crawler ÉQUIPE une arme, une arme à distance ou un sort (jamais l'armure ; un objet seulement ramassé ou
// donné à un compagnon ne compte pas) et ne revient jamais. Encore actif à l'arrivée sur l'étage 2, il évolue en 'boxer' : sans le malus,
// un simple ×1,25 à mains nues, définitif (reste après l'équipement). Chiffres : config.starterBuff.
function starterBuffUnarmedMult() {
    const cfg = config.starterBuff;
    if (gameState.starterBuff === 'desperate') return cfg.unarmedMult;
    if (gameState.starterBuff === 'boxer') return cfg.boxerUnarmedMult;
    return 1;
}

// Dégâts subis après le malus du buff (arrondi, jamais moins que le montant d'origine).
function applyStarterBuffToDamage(amount) {
    if (gameState.starterBuff !== 'desperate' || !(amount > 0)) return amount;
    return Math.max(amount, Math.round(amount * config.starterBuff.damageTakenMult));
}

// Période d'essai (chantier 15, lot 3, config.earlyGame.trial) : l'émission protège ses débutants — dégâts subis réduits aux étages 1-3, de moins en moins avec le niveau
// (trialDamageMult(), generator.js). Appliquée AUX MÊMES points que le buff de départ (coup encaissé, pièges, saignement) pour que journal et PV restent d'accord.
// Les PV épargnés sont comptés (runStats.trialAvoided) et réajoutés à la facilité des victoires : la Période d'essai ne doit pas faire monter la prime des chasseurs.
function applyTrialToDamage(amount) {
    if (!(amount > 0)) return amount;
    const mult = trialDamageMult(gameState.level, gameState.currentFloor);
    if (mult >= 1) return amount;
    const reduced = Math.min(amount, Math.max(1, Math.round(amount * mult)));
    if (reduced < amount && gameState.runStats) gameState.runStats.trialAvoided = (gameState.runStats.trialAvoided || 0) + (amount - reduced);
    return reduced;
}

// Badge « Période d'essai » : visible tant que la réduction est active (étages 1-3, niveau sous le seuil), avec le pourcentage courant et la règle en infobulle.
function updateTrialStatusUI() {
    const el = ui.trialStatus;
    if (!el) return;
    const eg = config.earlyGame;
    const mult = trialDamageMult(gameState.level, gameState.currentFloor);
    const active = mult < 1;
    el.classList.toggle('hidden', !active);
    if (!active) return;
    const pct = Math.round((1 - mult) * 100);
    el.innerText = `🎟️ Période d'essai −${pct} %`;
    el.title = `Période d'essai — l'émission protège ses débutants : −${pct} % de dégâts subis (combat, pièges, saignement), de moins en moins à chaque niveau, jusqu'au niveau ${eg.trial.fadeLevel} ; prend fin à l'arrivée sur l'étage ${eg.maxFloor + 1}.`;
}

function giveStarterBuffForGift(giftType) {
    gameState.starterBuff = (giftType === 'armor' || giftType === 'nothing') ? 'desperate' : null;
    if (gameState.starterBuff) logEvent("💢 Foutu pour foutu : sans arme, vous encaissez 5 % de plus, mais vos poings frappent deux fois plus fort — jusqu'au premier équipement.", "info");
}

// Appelée quand le crawler équipe une arme, une arme à distance ou un sort : le buff de départ saute, le Boxeur (évolué) reste.
function endStarterBuff() {
    if (gameState.starterBuff !== 'desperate') return;
    gameState.starterBuff = null;
    logEvent("💢 Foutu pour foutu s'arrête : vous voilà équipé. Le Donjon peut reprendre son rythme normal.", "info");
}

// Arrivée à l'étage `config.starterBuff.evolveFloor` : un buff encore actif devient Boxeur.
function evolveStarterBuff() {
    if (gameState.starterBuff !== 'desperate' || gameState.currentFloor < config.starterBuff.evolveFloor) return;
    gameState.starterBuff = 'boxer';
    logEvent(`🥊 Vous avez tenu jusqu'à l'étage ${gameState.currentFloor} à mains nues : le public vous sacre Boxeur. Plus de malus, et des poings durablement plus lourds (×${config.starterBuff.boxerUnarmedMult}).`, "success");
}

function updateStarterBuffUI() {
    const el = ui.starterBuffStatus;
    if (!el) return;
    const cfg = config.starterBuff;
    const info = gameState.starterBuff === 'desperate'
        ? { text: '💢 Foutu pour foutu', title: `Foutu pour foutu — dégâts subis +${Math.round((cfg.damageTakenMult - 1) * 100)} %, dégâts à mains nues ×${cfg.unarmedMult} (Étrangler compris). Saute à l'équipement d'une arme, d'une arme à distance ou d'un sort ; évolue à l'étage ${cfg.evolveFloor}.` }
        : gameState.starterBuff === 'boxer'
            ? { text: '🥊 Boxeur', title: `Boxeur — dégâts à mains nues ×${cfg.boxerUnarmedMult}, définitif.` }
            : null;
    el.classList.toggle('hidden', !info);
    if (info) { el.innerText = info.text; el.title = info.title; }
}

// ==========================================
// OCCASIONS DE COMBAT (chantier 6, V2 — voir NOTES_MINIJEUX.md)
// ==========================================
// Une Occasion est une action SPÉCIALE proposée de façon aléatoire au début d'un tour (25 % en mode Jouer, un peu plus avec le
// niveau de la compétence liée) : un bouton mis en avant, valable CE tour seulement. La prendre consomme le tour ; un échec =
// tour perdu, sans autre pénalité. Mains nues au contact : Immobiliser (puis Étrangler, proposé à coup sûr sur un mob immobilisé
// ou étourdi, jamais un boss). À distance avec une arme à distance : Cible de précision ou Point faible. Jamais en mode « Jet
// automatique » ni sans interface interactive (tests Node, simulation longue). La décision est pure : decideOccasion() (minigames.js).
function createOccasionState() {
    return { current: null, turn: 0, rolledTurn: -1, lastOfferTurn: -9, pity: 0 };
}

function occasionContext() {
    const enemy = gameState.currentEnemy;
    const st = (enemy && enemy.status) || {};
    return {
        distance: gameState.combatDistance || 0,
        hasRanged: !!gameState.equipment.ranged,
        disarmed: !!(gameState.status.disarmed && gameState.status.disarmed.rounds > 0),
        isBoss: !!(enemy && enemy.isBoss),
        immobilized: !!(st.stunned || (st.immobilized && st.immobilized.rounds > 0))
    };
}

// Tire l'Occasion du tour courant (une seule fois par tour, au premier rafraîchissement de l'interface de ce tour).
function rollCombatOccasion() {
    const occ = gameState.occasion;
    if (!occ || !gameState.inCombat || !gameState.currentEnemy || gameState.currentEnemy.hp <= 0) return; // pas d'Occasion pendant un Coup de grâce
    if (occ.rolledTurn === occ.turn) return;
    occ.rolledTurn = occ.turn;
    occ.current = null;
    if (!minigameIsInteractive()) return;
    const type = decideOccasion({
        ctx: occasionContext(), mode: getMinigameMode(),
        skillLevels: { unarmed: gameState.skills.unarmed.level, weapon: gameState.skills.weapon.level },
        turn: occ.turn, lastOfferTurn: occ.lastOfferTurn, pity: occ.pity
    });
    if (!type) return;
    occ.current = { type };
    occ.lastOfferTurn = occ.turn;
    occ.pity = 0;
}

// Bouton « ✨ Occasion » : visible seulement si une Occasion est proposée ET encore possible (la situation a pu changer pendant la riposte).
function updateOccasionButton() {
    const btn = ui.btnOccasion;
    if (!btn) return;
    const occ = gameState.occasion;
    const cur = gameState.inCombat && gameState.currentEnemy && occ && occ.current;
    const valid = !!cur && occasionStillValid(cur.type, occasionContext());
    btn.classList.toggle('hidden', !valid);
    if (valid) {
        const t = OCCASION_TYPES[cur.type];
        const label = `✨ Occasion : ${t.icon} ${t.label}`;
        if (btn.innerText !== label) btn.innerText = label;
    }
}

function buildOccasionSpec(type) {
    const unarmed = gameState.skills.unarmed.level, weapon = gameState.skills.weapon.level;
    switch (type) {
        case 'immobilize': return buildMinigameSpec('grapple', { zoneWidth: holdZoneWidth('grapple', unarmed) });
        case 'strangle': return buildMinigameSpec('choke', { zoneWidth: holdZoneWidth('choke', unarmed) });
        case 'target': return buildMinigameSpec('target', { distance: gameState.combatDistance, skillLevel: weapon });
        default: return buildMinigameSpec('weakpoint');
    }
}

function startOccasion() {
    const occ = gameState.occasion;
    if (!occ || !occ.current || !gameState.inCombat || !gameState.currentEnemy) return;
    if (gameState.pendingMinigame || (ui.btnOccasion && ui.btnOccasion.disabled)) return; // épreuve déjà ouverte, ou tour de l'ennemi en cours
    const type = occ.current.type;
    if (!occasionStillValid(type, occasionContext())) { occ.current = null; updateOccasionButton(); return; }
    occ.current = null;
    updateOccasionButton();
    startMinigame(buildOccasionSpec(type), (outcome, detail) => {
        if (!gameState.inCombat || !gameState.currentEnemy) return; // le combat s'est terminé entre-temps
        resolveOccasion(type, outcome, detail || {});
    });
}

// Applique l'issue d'une Occasion. Échec = tour perdu (la riposte suit normalement), sans autre pénalité.
function resolveOccasion(type, outcome, detail) {
    if (!tryPlayerAction()) return; // saignement mortel ou joueur étourdi : le tour est déjà réglé par tryPlayerAction()
    const enemy = gameState.currentEnemy;
    const failed = outcome === 'fail';
    const mg = MINIGAME_SETTINGS;
    const t = OCCASION_TYPES[type];
    const lostTurn = (msg) => {
        showDie(ui.combatPlayerDie, "✗");
        logEvent(msg, "danger");
        gainSkillXp(t.skill, SKILL_XP_PER_USE); // on apprend même de ses échecs, comme pour un sort raté
        resolveEnemyReaction();
    };

    if (type === 'immobilize') {
        gameState.lastAttackKind = 'unarmed'; // Posture du crawler : garde du boxeur
        if (failed) { lostTurn(`🤼 [${enemy.name}] se dégage de votre prise. Tour perdu.`); return; }
        const rounds = grappleRounds(outcome, !!enemy.isBoss);
        enemy.status.immobilized = { rounds };
        showDie(ui.combatPlayerDie, "🤼");
        logEvent(`🤼 Vous plaquez [${enemy.name}] : immobilisé ${rounds} tour${rounds > 1 ? 's' : ''}${enemy.isBoss ? " (un boss ne résiste pas plus d'un tour)" : ''}.`, "success");
        gainSkillXp('unarmed', SKILL_XP_PER_USE);
        resolveEnemyReaction();
        return;
    }

    if (type === 'strangle') {
        gameState.lastAttackKind = 'unarmed';
        if (failed) { lostTurn(`🪢 [${enemy.name}] se débat et vous échappe. Tour perdu.`); return; }
        const skill = gameState.skills.unarmed;
        const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1));
        const landed = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75 * mg.choke.damageMult * unarmedDamageMult(), varianceRange: 0.10, defReduction }, "en l'étranglant");
        if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
        return;
    }

    // Tir : Cible de précision ou Point faible, avec l'arme à distance équipée.
    gameState.lastAttackKind = 'ranged';
    const gear = gameState.equipment.ranged;
    if (failed || !gear) { lostTurn(type === 'target' ? "🎯 Votre tir passe à côté de la cible. Tour perdu." : "🦴 Vous hésitez trop longtemps : l'occasion est passée. Tour perdu."); return; }
    let mult = 1;
    let label = "d'un tir ajusté";
    if (type === 'target') {
        mult = outcome === 'perfect' ? mg.target.perfectMult : mg.target.successMult;
        label = outcome === 'perfect' ? "en plein centre de la cible" : "d'un tir ajusté";
    } else {
        const zone = WEAKPOINT_ZONES[detail.zone] || WEAKPOINT_ZONES.head;
        mult = zone.dmgMult;
        label = `sur le point faible (${zone.label.toLowerCase()})`;
        // Les effets s'appliquent AVANT le coup : la riposte qui suit en tient compte.
        if (zone.weaken) { enemy.status.weakened = { mult: zone.weaken.mult, rounds: zone.weaken.rounds }; logEvent(`💪 Le bras de [${enemy.name}] est touché : son ATQ baisse.`, "info"); }
        if (zone.push) { setCombatDistance(gameState.combatDistance + zone.push); logEvent(`🦵 La jambe de [${enemy.name}] cède : il recule d'un cran.`, "info"); }
    }
    const skill = gameState.skills.weapon;
    const atkMultiplier = (1.0 + 0.04 * (skill.level - 1)) * mult;
    const effectiveAtk = gameState.atk + (gear.baseDmg || 0);
    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear }, label);
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(gear);
    }
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
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
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
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
    const rollOnce = () => 1 + Math.floor(Math.random() * cfg.dieSides) + levelBonus;
    const playerRoll = Math.max(rollOnce(), rollOnce()); // Avantage : deux dés, le meilleur gardé
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll;

    // Ruée : un mob de mêlée qui gagne ce jet avec une marge franche vous rattrape brutalement,
    // quel que soit l'écart avant la tentative (voir config.rangedCombat.rushMarginThreshold et le
    // même mécanisme dans resolveEnemyReaction()).
    if (!mobWantsFar(enemy) && diff <= -cfg.rushMarginThreshold) {
        setCombatDistance(0);
        showDie(ui.combatPlayerDie, "🏃");
        logEvent(`🏃 [${enemy.name}] se rue et vous rattrape brutalement !`, "danger");
        enemyCounterAttack();
        return;
    }

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

// Charger : action volontaire et engagée (Chantier 3 du rework combat), alternative agressive à
// S'approcher. Ferme l'écart D'UN COUP (sans jet opposé — le prix de cette prise de risque se paie
// sur l'attaque qui suit, pas sur le rapprochement lui-même) et enchaîne IMMÉDIATEMENT une attaque
// bonus (config.engageAction.atkMultiplier, +25%), au prix d'une DEF joueur divisée par 2 pour la
// riposte qui suit (gameState.engageDefHalved, lu par getEffectiveDef() puis consommé par
// tryPlayerAction() au début de la PROCHAINE action — voir ces deux fonctions). Réutilise
// performPlayerAttack() tel quel, jamais une nouvelle formule de dégâts.
function attemptEngage() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy || gameState.combatDistance <= 0) {
        logEvent("Rien à charger : déjà au corps à corps.", "info");
        return;
    }
    if (!tryPlayerAction()) return;

    setCombatDistance(0);
    showDie(ui.combatPlayerDie, "⚔️");
    logEvent(`⚔️ Vous chargez [${enemy.name}] sans retenue, garde grande ouverte !`, "info");

    gameState.engageDefHalved = true;
    const weapon = gameState.equipment.weapon;
    gameState.lastAttackKind = weapon ? 'weapon' : 'unarmed'; // Charge : l'arme de mêlée, sinon les poings
    const weaponBonus = weapon ? (weapon.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;
    const defReduction = weapon ? 0 : 0.35; // Pas d'arme équipée : mêmes mains nues qu'attackUnarmed()
    const label = weapon ? "en chargeant à l'arme" : "en chargeant à mains nues";
    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier: config.engageAction.atkMultiplier * (weapon ? 1 : unarmedDamageMult()), defReduction, gear: weapon }, label);
    if (landed) {
        gainSkillXp(weapon ? 'weapon' : 'unarmed', SKILL_XP_PER_USE);
        if (weapon) applyWeaponMechanic(weapon);
    }
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
    const anyRange = spell.spellCategory === 'any'; // Sort utilitaire (chantier 11) : toute distance
    if (needsMelee && gameState.combatDistance > 0) {
        logEvent(`Trop loin pour lancer [${spell.spellName}] — approchez-vous !`, "danger");
        return;
    }
    if (!needsMelee && !anyRange && gameState.combatDistance <= 0) {
        logEvent(`Trop près pour lancer [${spell.spellName}] — éloignez-vous !`, "danger");
        return;
    }
    const manaCost = gameState.status.overcharge ? 0 : getSpellManaCost(spell); // Économe (qualificatif de sort) le réduit ; Surcharge : gratuit
    if (gameState.mana < manaCost) {
        logEvent(`Mana insuffisant pour lancer [${spell.spellName}] (${manaCost} requis).`, "danger");
        return;
    }
    // Glyphe (chantier 6, V1) : OPTIONNEL, proposé APRÈS les vérifications (jamais de glyphe gâché sur un sort impossible) et
    // avant l'action. Réussi, il renforce le sort ; raté, passé ou en jet automatique : sort normal, sans aucun malus.
    const glyphSpec = anyRange ? null : maybeGlyphSpec(spell);
    if (glyphSpec) {
        startMinigame(glyphSpec, (outcome, detail) => {
            if (!gameState.inCombat || !gameState.currentEnemy) return; // le combat s'est terminé entre-temps
            castEquippedSpell(spell, manaCost, !(detail && detail.auto) && outcome !== 'fail');
        });
        return;
    }
    castEquippedSpell(spell, manaCost, false);
}

// Glyphe proposé pour ce sort ? Seulement avec une interface interactive et selon le réglage (Réduit : plus rarement) ;
// jamais pour un sort utilitaire ni un sort sans motif.
function maybeGlyphSpec(spell) {
    if (!minigameIsInteractive()) return null;
    const pattern = getGlyphPattern(spell);
    if (!pattern) return null;
    const chance = MINIGAME_SETTINGS.glyph.chancePct[getMinigameMode()] || 0;
    if (Math.random() * 100 >= chance) return null;
    return buildMinigameSpec('glyph', { pattern, label: `Glyphe : ${spell.spellName}` });
}

// Lance le sort équipé (après vérifications et glyphe éventuel). `glyphBoost` : glyphe réussi.
function castEquippedSpell(spell, manaCost, glyphBoost) {
    const anyRange = spell.spellCategory === 'any';
    if (!tryPlayerAction()) return;
    gameState.lastAttackKind = 'magic'; // Posture du crawler (scene.js) : paume ouverte, lueur du sort

    gameState.mana -= manaCost;

    const skill = gameState.skills.magic;
    // Chantier "QoL/équilibrage" (Chantier C, voir NOTES_QOL_EQUILIBRAGE.md) : le mana paie la
    // flexibilité (mêlée/distance sans changer d'équipement), pas un surplus de dégâts par rapport à
    // l'arme équivalente — atkMultiplier proche de 1.0 (config.magicBalance.atkBase), à rareté égale
    // un sort et une arme infligent des dégâts comparables (voir tests/regression/magic-balance.js).
    // Le backfire reste le prix du chaos, et devient PLUS punitif à haut niveau qu'avant (plancher
    // abaissé) pour continuer à justifier ce risque une fois la compétence Magie montée.
    const mb = config.magicBalance;
    // Surcharge (Occultiste de foire, chantier 13) : ce sort est gratuit (coût déjà à 0 chez l'appelant), plus fort et ne rate jamais.
    const overcharged = !!gameState.status.overcharge;
    if (overcharged) gameState.status.overcharge = null;
    let backfireChance = Math.max(mb.backfireMin, mb.backfireBase + mb.backfirePerLevel * (skill.level - 1)) + (gameState.anomalyEffects.backfireBonusPct || 0);
    // Qualificatifs de sort : Canalisé réduit le risque d'échec (jamais sous 1 %), Bredouillant l'augmente.
    const channeled = getItemQualifierValues(spell, 'channeled', 'spell');
    if (channeled) backfireChance = Math.max(1, backfireChance - channeled.bonus);
    const stutter = getItemQualifierValues(spell, 'stutter', 'spell');
    if (stutter) backfireChance += stutter.bonus;
    if (originRaceEffects().backfirePts) backfireChance = Math.max(1, backfireChance + originRaceEffects().backfirePts); // Elfe : −3 pts (jamais sous 1 %)
    let atkMultiplier = (mb.atkBase + mb.atkPerLevel * (skill.level - 1)) * (gameState.anomalyEffects.spellMult || 1) * (originRaceEffects().spellMult || 1); // ZONE_MAGIQUE (anomalies.js), Elfe (chantier 13)
    if (overcharged) {
        const boost = (activeSynergy() && activeSynergy().abilityMult) || originClassEffects().abilityMult || 1;
        atkMultiplier *= boost;
        backfireChance = 0;
        logEvent(`🔮 Surcharge : [${spell.spellName}] jaillit, gratuit et ×${boost} !`, "success");
    }
    if (glyphBoost) {
        atkMultiplier *= mb.glyphDamageMult;
        backfireChance *= mb.glyphBackfireMult;
        logEvent(`✍️ Le glyphe renforce [${spell.spellName}] (dégâts +${Math.round((mb.glyphDamageMult - 1) * 100)} %, risque de raté ÷${Math.round(1 / mb.glyphBackfireMult)}).`, "success");
    }

    if (!overcharged && Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        playSpellBackfireFx(); // la lueur crachote et s'éteint en fumée (fx.js)
        logEvent(`[${spell.spellName}] part de travers et fait un flop retentissant. Aucun dégât (mana quand même dépensé).`, "danger");
        gameState.lastPlayerActionWasBackfire = true; // Voir gameOver()/generateEpitaph() : attribution du décès si la riposte qui suit est fatale
        recordRunEvent('backfire');
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    // Sort utilitaire (chantier 11) : aucun coup porté, mais le tour est consommé — le mob riposte.
    if (anyRange) {
        castUtilitySpell(spell);
        gainSkillXp('magic', SKILL_XP_PER_USE);
        resolveEnemyReaction();
        return;
    }

    const effect = spell.spellEffect || null;
    const effectiveAtk = gameState.atk + (spell.baseDmg || 0);
    const used = performPlayerAttack(
        effectiveAtk,
        { atkMultiplier, varianceRange: 0.35, defReduction: 0.15, gear: spell, gearTarget: 'spell', chainPct: effect && effect.kind === 'chain' ? effect.pct : 0 }, // Les sorts ignorent un peu de DEF (thématique), pas toute
        `avec [${spell.spellName}]`
    );
    if (used) {
        gainSkillXp('magic', SKILL_XP_PER_USE);
        castSpellEffect(spell);
        applyWeaponMechanic(spell); // Qualificatifs du sort (brûlure, poison, gel, vol de vie…)
    }
}

// Effet intrinsèque d'un sort offensif (chantier 11, SPELL_EFFECTS dans spells.js), après un coup porté :
// réutilise les états d'ennemi existants (resolveQualifierEffect()). La chaîne d'éclairs est déjà comptée
// dans le coup lui-même (option chainPct de performPlayerAttack()). Le vol de vie s'applique même sur le
// coup fatal ; les états, seulement sur une cible encore debout.
function castSpellEffect(spell) {
    const effect = spell && spell.spellEffect;
    const enemy = gameState.currentEnemy;
    if (!effect || !enemy) return;
    const dealt = gameState._lastPlayerDamage || 0;
    if (effect.kind === 'lifesteal') {
        resolveQualifierEffect('lifesteal', { pct: effect.pct }, enemy, dealt, 'spell');
        return;
    }
    if (enemy.hp <= 0) return;
    switch (effect.kind) {
        case 'stun': if (Math.random() * 100 < effect.chance) resolveQualifierEffect('stun', {}, enemy, dealt, 'spell'); break;
        case 'corrode': resolveQualifierEffect('corrode', { rounds: effect.rounds }, enemy, dealt, 'spell'); break;
        case 'bleed': resolveQualifierEffect('bleed', { pct: effect.pct, rounds: effect.rounds }, enemy, dealt, 'weapon'); break;
        case 'fear': resolveQualifierEffect('fear', { rounds: effect.rounds }, enemy, dealt, 'spell'); break;
        case 'blind':
            enemy.status = enemy.status || {};
            enemy.status.distracted = { rounds: effect.rounds, miss: effect.miss };
            logEvent(`💡 [${enemy.name}] est aveuglé ! (${effect.miss} % de chances de rater pendant ${effect.rounds} tours)`, "danger");
            break;
    }
}

// Sort utilitaire (catégorie `any`, chantier 11) : soin, bouclier de mana ou recul — sans jet d'attaque.
function castUtilitySpell(spell) {
    const effect = spell.spellEffect || {};
    showDie(ui.combatPlayerDie, spell.icon || '✨');
    if (effect.kind === 'heal') {
        const healed = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * effect.pct / 100)));
        logEvent(`💚 [${spell.spellName}] referme vos plaies (+${healed} PV).`, "success");
    } else if (effect.kind === 'shield') {
        gameState.status.manaShield = { rounds: effect.rounds, pct: effect.pct };
        logEvent(`🔰 [${spell.spellName}] : un bouclier de mana vous entoure (dégâts reçus −${effect.pct} % pendant ${effect.rounds} tours).`, "success");
    } else if (effect.kind === 'shadowStep') {
        const before = gameState.combatDistance;
        gameState.combatDistance = Math.min(config.rangedCombat.maxDistance, before + effect.gap);
        logEvent(`🌑 [${spell.spellName}] : vous glissez dans l'ombre et reculez (écart ${before} → ${gameState.combatDistance}).`, "success");
    }
    playPlayerAttackFx('magic', { self: true }, () => {});
}

// Tentative de fuite : quitte le combat sans le gagner ni obtenir de loot/XP.
// En cas d'échec, l'ennemi place une attaque gratuite.
function attemptFlee() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    const enemy = gameState.currentEnemy;
    // Échec de furtivité punitif (voir attemptStealthEvasion()) : ce mob-là ne laisse plus filer.
    if (enemy.alerted) {
        logEvent(`[${enemy.name}] vous a repéré et ne vous laissera pas filer aussi facilement !`, "danger");
        return;
    }
    let fleeChance = 60; // 60% de réussite de base (pourra dépendre de compétences/stats plus tard)
    const scoutHelps = hasActiveCompanion('scout') && !enemy.isBountyHunter;
    if (scoutHelps) {
        fleeChance += config.companions.scout.fleeBonus; // Compagnon "Éclaireur" : facilite la fuite
    }
    else fleeChance += originRaceEffects().fleePts || 0; // Gobelin +15, Nain −15 : jamais contre un chasseur de primes (fixe, chantier 13)
    if (enemy.isBountyHunter) fleeChance = config.bounty.fleeChance; // Chasseur de primes : une fois sur deux, sans aide

    if (Math.random() * 100 < fleeChance) {
        const scoutNote = scoutHelps
            ? ` (${gameState.companion.name} vous a montré une ouverture)`
            : "";
        gameState.currentEnemy = null;
        gameState.inCombat = false; // Avant le log : le message de fuite doit s'afficher normalement sous la scène d'exploration
        gameState.pendingStairAfterCombat = false; // La fuite ne compte pas comme une victoire sur le gardien
        gameState.pendingBossRoomId = null; // Le boss reste vivant, la salle n'est pas marquée vaincue
        gameState.pendingSneakAttack = false; // Ne doit pas se reporter sur un combat futur
        gameState.fleesThisRun = (gameState.fleesThisRun || 0) + 1; // Voir generateEpitaph() : mention spéciale à 3+ fuites
        gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false }; // Les statuts ne survivent pas au combat
        setSceneHeader('🏃', 'Fuite Réussie', 'Exploration', 'fled');
        playSfx('fleeEscape');
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !${scoutNote}`, "info");
        changeCompanionLoyalty(config.companions.loyalty.flee); // Fuir n'inspire pas confiance à votre compagnon
        recordRunEvent('flee');
        if (enemy.isBountyHunter) {
            gameState.pendingBountySquad = 0;
            addBounty(config.bounty.fleeGain);
            logEvent(`🎯 Votre fuite fait grimper votre prime (+${config.bounty.fleeGain}).`, "danger");
        }
        if (gameState.pendingTravel) {
            logEvent("Vous rebroussez chemin, le trajet est annulé pour l'instant.", "info");
            gameState.pendingTravel = null;
        }
        if (gameState.pendingLairDive) {
            logEvent("Vous fuyez le repaire, encore intact — il faudra y revenir.", "info");
            gameState.pendingLairDive = null;
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
    if (defeatedEnemy) gameState.floorStats.mobsKilled += 1;

    // Combat terminé : on sort de l'état "inCombat" avant les logs de résultat (XP/loot/victoire)
    // pour qu'ils s'affichent normalement sous la scène d'exploration, comme n'importe quel autre événement (voir
    // logEvent) — seuls les échanges de coups pendant le combat lui-même restent dans le journal court du combat.
    gameState.currentEnemy = null;
    gameState.inCombat = false;
    gameState.pendingSneakAttack = false;
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false }; // Les statuts ne survivent pas au combat

    if (defeatedEnemy && typeof playSfx === 'function') playSfx(wasBoss ? 'bossDeath' : 'mobDeath');
    if (wasBoss) {
        setSceneHeader('👑', 'Victoire !', 'Boss Vaincu', { key: 'bossVictory', enemy: defeatedEnemy });
        logEvent(`👑 Vous avez triomphé de ${defeatedEnemy.name} !`, "success");
        triggerHaptic('heavy');
    } else {
        setSceneHeader('🏆', 'Victoire !', 'Combat', { key: 'victory', enemy: defeatedEnemy });
        logEvent("Vous remportez le combat !", "success");
        triggerHaptic('medium');
    }

    // Gain d'XP basé sur le monstre vaincu (valeur de repli si jamais xpReward est absent)
    const xpGained = (defeatedEnemy && defeatedEnemy.xpReward) || 10;
    gainXp(xpGained);

    // Le compagnon progresse aussi, gagne en loyauté, et le Premiers secours panse vos plaies
    onCompanionVictory();

    // Butin (chantier "refonte des objets", voir itemBalance dans items.js) : la rareté dépend de
    // l'étage, plus de la puissance du monstre. Un boss garantit un objet (un palier au-dessus, au
    // moins Rare) avec une chance d'un second, plus son objet signature (voir
    // awardBossSignatureItem()) ; le boss d'un repaire lâche un butin d'un niveau d'objet au-dessus.
    // Un mob normal a 40 % de chance de lâcher un objet, un élite une chance de monter d'un palier.
    if (wasBoss) {
        const isLairBoss = !!(gameState.pendingLairDive && gameState.pendingLairDive.stage === 'boss');
        const itemLevel = gameState.currentFloor + (isLairBoss ? itemBalance.lairBossLevelBonus : 0);
        addLoot({ source: 'boss', itemLevel });
        if (Math.random() * 100 < itemBalance.boss.secondItemChance) addLoot({ source: 'boss', itemLevel });
        awardBossSignatureItem(defeatedEnemy, itemLevel, { perfectFinisher: !!defeatedEnemy.finisherPerfect, perfects: defeatedEnemy.trials ? defeatedEnemy.trials.perfects : 0 });
    } else if (!(defeatedEnemy && defeatedEnemy.isBountyHunter) && Math.random() * 100 < 40) { // 40% de chance de loot post-combat (un chasseur de primes paie sa propre récompense, voir onBountyVictory())
        addLoot({ source: defeatedEnemy && isEliteMob(defeatedEnemy) ? 'elite' : 'mob' });
    }

    // Chronique de run (chantier 2) : victoire, type de coup final, facilité (domination).
    if (defeatedEnemy) recordRunEvent('win', { enemy: defeatedEnemy, kind: gameState.lastAttackKind });
    // Prime (chantier 3) : récompense d'un chasseur ou hausse selon la facilité ; une escouade enchaîne
    // son Chef ici, avant toute suite de trajet.
    if (defeatedEnemy && onBountyVictory(defeatedEnemy)) return;

    // Si ce combat était une salle de boss du quartier (escalier ou non), la salle est désormais
    // calme : on la marque vaincue (son marqueur de carte passe de 👑 à 🪜 si elle gardait l'escalier).
    // Pièce / ville du gardien vaincu, gardées pour le choix d'escalier plus bas (ces deux champs sont
    // remis à zéro juste en dessous).
    const defeatedBossRoomId = gameState.pendingBossRoomId;
    if (gameState.pendingBossRoomId) {
        const bossRoom = gameState.floorMap && gameState.floorMap.roomsById[gameState.pendingBossRoomId];
        if (bossRoom) bossRoom.defeated = true;
        gameState.pendingBossRoomId = null;
    }

    // Plongée dans un repaire en cours (voir diveIntoLair()) : enchaîne les combats forcés restants, puis le
    // boss du repaire.
    if (gameState.pendingLairDive) {
        const dive = gameState.pendingLairDive;
        if (dive.stage === 'trash') {
            dive.combatsLeft -= 1;
            if (dive.combatsLeft > 0) {
                logEvent("Un autre adversaire surgit des décombres du repaire...", "danger");
                initiateCombat(null, { intro: false });
                return;
            }
            dive.stage = 'boss';
            const lair = gameState.floorMap.lairsById[dive.lairId];
            if (!lair.bossInstance) {
                lair.bossInstance = generateBoss(gameState.floorMap.theme) || generateMob(gameState.floorMap.theme);
            }
            logEvent("Le repaire se calme... jusqu'à ce qu'une présence bien plus dangereuse n'émerge de l'ombre !", "danger");
            initiateCombat(lair.bossInstance);
            return;
        }
        // dive.stage === 'boss' : le boss du repaire vient de tomber, la plongée est terminée
        // (butin déjà garanti par la branche wasBoss ci-dessus, comme tout autre boss).
        const lair = gameState.floorMap.lairsById[dive.lairId];
        lair.cleared = true;
        gameState.pendingLairDive = null;
        logEvent(`🏆 Le repaire est nettoyé ! Plus rien à craindre ici.`, "success");
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
        const stairsRoom = gameState.floorMap && gameState.floorMap.roomsById[defeatedBossRoomId];
        // Gardien de la Sortie (étage final, config.urbanFloors.finalFloor) : victoire finale.
        if (stairsRoom && stairsRoom.isExit) {
            logEvent("La voie vers la Sortie est libre !", "success");
            winGame(); // winGame() appelle déjà updateUI()
            return;
        }
        logEvent("La voie vers l'escalier est libre !", "success");
        offerStairsChoice({ kind: 'room', roomId: defeatedBossRoomId }); // offerStairsChoice() appelle déjà updateUI()
        return;
    }

    updateUI();
}

// ==========================================
// 2. BOUCLE DE GAMEPLAY
// ==========================================
// Salle aperçue (inconnue, voisine d'une salle visitée) la plus proche en distance de trajet depuis la
// salle courante, en ne passant que par des salles visitées (voir planTravelToRoom()). À égalité, au hasard.
function findNearestSeenRoom() {
    const fm = gameState.floorMap;
    let best = [];
    let bestDist = Infinity;
    Object.values(fm.roomsById).forEach(room => {
        if (!isRoomSeen(room)) return;
        const plan = planTravelToRoom(room.id);
        if (!plan) return;
        if (plan.distance < bestDist - 1e-9) { best = [room.id]; bestDist = plan.distance; }
        else if (Math.abs(plan.distance - bestDist) < 1e-9) best.push(room.id);
    });
    return best.length > 0 ? best[Math.floor(Math.random() * best.length)] : null;
}

// Étape d'exploration proprement dite : consomme le temps et avance vers un voisin non visité au
// hasard (ou vers `targetRoomId`, voisin inconnu choisi sur la carte). Appelée directement dès qu'un voisin non visité existe (bifurcation ou non) ; sinon,
// c'est autoTravelToNearestFrontier() qui prend le relais.
function performExploreStep(targetRoomId = null) {
    const roomsById = gameState.floorMap.roomsById;
    const current = roomsById[gameState.floorMap.currentRoomId];

    gameState.timeLeft -= 1;
    applyTimeElapsedRegen(1);
    gameState.cardsDrawnThisFloor += 1;

    playSceneDrawAnimation();

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
    // `targetRoomId` (exploration depuis la carte, voir exploreFromMap()) : une salle voisine inconnue précise,
    // sinon une au hasard.
    const chosen = targetRoomId && unvisitedNeighbors.find(edge => edge.to === targetRoomId);
    const nextRoomId = chosen ? chosen.to : unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)].to;
    const nextRoom = roomsById[nextRoomId];
    announceZoneChange(current, nextRoom, moveToFloorRoom(nextRoom));

    enterRoom(nextRoom);
    recordRunEvent('explore'); // Réévalue les succès liés à l'état (PO en poche, réserve pleine…)
    updateUI();
}

// Annonce le passage d'une zone à l'autre (bloc -> avenue, avenue -> bloc, bloc -> autre quartier ; ville ->
// route sur un étage urbain).
function announceZoneChange(from, to, changedQuadrant) {
    if (isUrbanFloor()) {
        if (roomZone(to) === 'road' && roomZone(from) === 'city') logEvent("Vous quittez la ville : la route est à découvert, restez sur vos gardes.", "info");
        return;
    }
    if (roomZone(to) === 'avenue' && roomZone(from) !== 'avenue') {
        logEvent("Vous débouchez sur une avenue : large, éclairée, et pleine de monde.", "info");
    } else if (roomZone(to) === 'block' && (changedQuadrant || roomZone(from) === 'avenue')) {
        logEvent(`Vous franchissez une porte. Vous entrez dans : ${gameState.currentDistrict}.`, "info");
    }
}

// Si la salle courante n'a plus aucun voisin inconnu, part automatiquement vers la salle aperçue la plus
// proche (même trajet qu'un voyage sur carte, voir travelToRoom() : temps et embuscades selon la distance,
// puis le pas dans l'inconnu), sans demander confirmation.
function autoTravelToNearestFrontier() {
    const targetId = findNearestSeenRoom();
    if (!targetId) {
        setSceneHeader('🗺️', 'Étage Entièrement Exploré', 'Exploration', 'floorCleared');
        logEvent("Vous avez arpenté chaque recoin accessible de cet étage. Direction l'escalier ?", "info");
        updateUI();
        return;
    }
    logEvent("Ce secteur est entièrement connu : vous filez vers la zone inexplorée la plus proche.", "info");
    travelToRoom(targetId);
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
// Poids du cadeau de bienvenue (#start-screen-overlay -> #gift-reveal-overlay) : on repart presque
// toujours avec QUELQUE CHOSE (« Rien » n'est plus qu'une mauvaise blague à 5 %), mais toujours de la
// Camelote (voir generateWelcomeGiftItem() dans generator.js) : le premier vrai équipement se gagne.
const WELCOME_GIFT_WEIGHTS = { weapon: 38, ranged: 25, armor: 17, spell: 15, nothing: 5 };

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
    // Un crawler mort (sauvegarde à 0 PV) ne revient pas : son nom repart sur un nouveau crawler.
    const buried = eraseDeadSaveForName(raw);

    if (raw && hasSaveForName(raw) && restoreSaveForName(raw)) {
        if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
        showFloorArrivalScene();
        logEvent(`Sauvegarde de [${gameState.playerName}] restaurée. Bon retour dans le Donjon.`, "success");
        updateUI();
        updateInventoryUI();
        updateSpellbookUI();
        return;
    }

    gameState.playerName = raw || gameState.playerName || "CRAWLER_01";
    if (ui.startScreenOverlay) ui.startScreenOverlay.classList.add('hidden');
    gameState.saveEnabled = true;
    if (buried) logEvent(`⚰️ L'ancien [${gameState.playerName}] est mort pour de bon. Un nouveau crawler reprend son nom.`, "info");
    updateUI();
    revealWelcomeGift();
}

// Tire le cadeau de bienvenue, l'équipe directement (aucun inventaire à gérer : tout est vide à cet
// instant) et affiche l'écran de révélation avec sa blague sarcastique. Un sort de bienvenue suit la
// même règle qu'un premier équipement normal (voir equipSpell()) : le mana démarre plein.
function revealWelcomeGift() {
    const type = rollWelcomeGiftType();
    const item = type === 'nothing' ? null : generateWelcomeGiftItem(type);
    giveStarterBuffForGift(type);

    if (type === 'weapon') gameState.equipment.weapon = item;
    else if (type === 'ranged') gameState.equipment.ranged = item;
    else if (type === 'armor') {
        gameState.equipment.armor = item;
        recomputeMaxHp();
    } else if (type === 'spell') {
        gameState.equipment.spell = item;
        gameState.mana = gameState.maxMana;
    }

    if (ui.giftRevealTitle) {
        const labels = { weapon: "Une arme", ranged: "Une arme à distance", armor: "Une armure", spell: "Un parchemin de sort", nothing: "Rien du tout" };
        const icons = { weapon: '⚔️', ranged: '🏹', armor: '🛡️', spell: '📜', nothing: '🎁' };
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
    endStarterBuff();

    logEvent("🧪 Kit de test : arme, arme à distance et sort légendaires équipés.", "info");
    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
}

// ==========================================
// ÉCRAN PLEIN ÉCRAN DE RENCONTRE (chantier 16, lot 1)
// ==========================================
// Overlay statique qui annonce une altercation (« il t'a vu », embuscade, « tu l'as vu », boss, chasseur) AVANT que
// le combat ou le choix de furtivité n'apparaisse : image WebP du mob si elle existe (encounters.js), sinon son sprite
// agrandi sur le décor (scene.js, renderScene('encounter')). Fermé par un tap (ou Espace/Entrée/Échap), toujours :
// jamais de fermeture automatique. Par callback (jamais de Promise, comme runCombatBeats()/startMinigame()) : sans
// interface (tests Node sans requestAnimationFrame) le callback est appelé tout de suite et rien ne s'affiche. Le
// callback vit dans une variable de module, jamais dans gameState (non sauvegardable) ; `encounterIntroPending` bloque
// les actions (isActionBlocked()). Branché (lot 2) par initiateCombat() (rencontre repérée, embuscade de trajet, boss de repaire, chasseur), handleStealthEncounter() (« tu l'as vu ») et triggerBossEncounter() (arrivée du boss, première fois seulement).
const ENCOUNTER_INTRO_MIN_MS = 450; // garde-fou : le tap qui a déclenché la rencontre ne la referme jamais
let encounterIntroCallback = null;
let encounterIntroOpenedAt = 0;

// Réglage joueur (chantier 16, lot 6), préférence d'affichage jamais sauvegardée avec le crawler : 'all' (toutes les rencontres, défaut),
// 'important' (boss, chasseurs de primes, embuscades de trajet et élites 💀 seulement) ou 'off'.
const ENCOUNTER_INTRO_MODE_KEY = 'crawler_encounter_intro_mode';
const ENCOUNTER_INTRO_MODES = ['all', 'important', 'off'];
let encounterIntroModeValue = null;

function getEncounterIntroMode() {
    if (encounterIntroModeValue) return encounterIntroModeValue;
    let stored = null;
    try { stored = localStorage.getItem(ENCOUNTER_INTRO_MODE_KEY); } catch (e) { /* stockage indisponible : réglage par défaut */ }
    encounterIntroModeValue = ENCOUNTER_INTRO_MODES.includes(stored) ? stored : 'all';
    return encounterIntroModeValue;
}

function setEncounterIntroMode(mode) {
    if (!ENCOUNTER_INTRO_MODES.includes(mode)) return;
    encounterIntroModeValue = mode;
    try { localStorage.setItem(ENCOUNTER_INTRO_MODE_KEY, mode); } catch (e) { /* idem */ }
    if (ui.encounterModeSelect) ui.encounterModeSelect.value = mode;
}

// =========================================================================
// SONS : BOUTONS ET PAGE D'ÉCOUTE (chantier 8) — moteur et catalogue dans sounds.js.
// 🔊 coupe tous les sons (voix comprise), 🎙️ la voix du présentateur seule ; préférences d'écoute
// (localStorage), jamais sauvegardées avec le crawler.
// =========================================================================
function updateSoundToggleButtons() {
    const soundOff = isSoundMuted();
    const voiceOff = isVoiceMuted();
    if (ui.btnSoundToggle) {
        ui.btnSoundToggle.innerText = soundOff ? '🔇' : '🔊';
        ui.btnSoundToggle.setAttribute('aria-pressed', soundOff ? 'true' : 'false');
        const label = soundOff ? 'Remettre les sons' : 'Couper les sons';
        ui.btnSoundToggle.setAttribute('aria-label', label);
        ui.btnSoundToggle.title = label;
    }
    if (ui.btnVoiceToggle) {
        // Voix éteinte par elle-même ou par la coupure générale : bouton barré et estompé.
        const silent = voiceOff || soundOff;
        ui.btnVoiceToggle.innerText = '🎙️';
        ui.btnVoiceToggle.classList.toggle('opacity-40', silent);
        ui.btnVoiceToggle.classList.toggle('line-through', silent);
        ui.btnVoiceToggle.setAttribute('aria-pressed', voiceOff ? 'true' : 'false');
        const label = voiceOff ? 'Remettre la voix du présentateur' : 'Couper la voix du présentateur';
        ui.btnVoiceToggle.setAttribute('aria-label', label);
        ui.btnVoiceToggle.title = soundOff && !voiceOff ? `${label} (tous les sons sont coupés)` : label;
    }
}

function toggleSoundMuted() {
    setSoundMuted(!isSoundMuted());
    updateSoundToggleButtons();
}

function toggleVoiceMuted() {
    setVoiceMuted(!isVoiceMuted());
    updateSoundToggleButtons();
}

function buildSoundLabHtml() {
    return listSfxForLab().map(section => `<section class="flex flex-col gap-1.5">
        <p class="text-[10px] text-sky-400 uppercase tracking-widest font-bold">${section.title}</p>
        ${section.sounds.map(sound => `<button type="button" data-sfx="${sound.key}" class="text-left min-h-[44px] px-3 py-2 bg-gray-950 border border-gray-700 hover:border-sky-500 rounded-lg">
            <span class="block text-xs text-gray-200 font-bold">▶ ${sound.label}</span>
            <span class="block text-[10px] text-gray-500">${sound.use}</span>
        </button>`).join('')}
    </section>`).join('');
}

function openSoundLab() {
    if (!ui.soundLabOverlay) return;
    if (ui.soundLabList) ui.soundLabList.innerHTML = buildSoundLabHtml();
    ui.soundLabOverlay.classList.remove('hidden');
}

function closeSoundLab() {
    if (ui.soundLabOverlay) ui.soundLabOverlay.classList.add('hidden');
}

// Le réglage autorise-t-il l'écran de ce type de rencontre pour cet ennemi ?
function encounterIntroWanted(kind, enemy) {
    const mode = getEncounterIntroMode();
    if (mode === 'off') return false;
    if (mode === 'all') return true;
    return kind === 'boss' || kind === 'hunter' || kind === 'ambush' || !!(enemy && isEliteMob(enemy));
}

function encounterIntroAvailable() {
    return !!(config.encounterIntro && config.encounterIntro.enabled && ui.encounterOverlay && typeof requestAnimationFrame === 'function');
}

function showEncounterIntro(kind, enemy, onContinue) {
    if (!enemy || !encounterIntroAvailable() || !encounterIntroWanted(kind, enemy)) {
        if (onContinue) onContinue();
        return false;
    }
    const text = pickEncounterText(kind, enemy.name);
    const art = resolveEncounterArt(enemy, kind);
    renderScene('encounter', { kind, enemy });
    if (ui.encounterImg) {
        ui.encounterImg.classList.add('hidden');
        if (art.src) {
            ui.encounterImg.onload = () => ui.encounterImg.classList.remove('hidden');
            ui.encounterImg.onerror = () => ui.encounterImg.classList.add('hidden'); // le sprite agrandi reste dessous
            ui.encounterImg.src = art.src;
            // Même image que la fois précédente : déjà chargée, `load` peut ne pas se redéclencher.
            if (ui.encounterImg.complete && ui.encounterImg.naturalWidth) ui.encounterImg.classList.remove('hidden');
        } else {
            ui.encounterImg.onload = ui.encounterImg.onerror = null;
        }
    }
    ui.encounterTitle.innerText = text.title;
    ui.encounterTitle.style.color = text.accent;
    ui.encounterLine.innerText = text.line;
    ui.encounterHint.innerText = text.hint;
    ui.encounterBanner.style.borderColor = text.accent;
    playSfx(kind === 'boss' || kind === 'hunter' ? 'bossSting' : 'encounterSting');
    if (typeof document.activeElement !== 'undefined' && document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Entrée ne doit pas réactiver le bouton qui a mené ici
    closeInventorySheets();
    gameState.encounterIntroPending = true;
    encounterIntroCallback = onContinue || null;
    encounterIntroOpenedAt = Date.now();
    ui.encounterOverlay.classList.add('enc-enter');
    ui.encounterOverlay.classList.remove('hidden');
    ui.encounterArt.classList.remove('enc-play');
    void ui.encounterOverlay.offsetWidth; // relance les animations à chaque ouverture
    ui.encounterOverlay.classList.remove('enc-enter');
    ui.encounterArt.classList.add('enc-play');
    if (kind === 'boss' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
    return true;
}

// Ferme l'écran puis enchaîne sur le callback. Ignoré si rien n'est ouvert ou trop tôt (tap résiduel).
function dismissEncounterIntro(force) {
    if (!gameState.encounterIntroPending) return false;
    if (!force && Date.now() - encounterIntroOpenedAt < ENCOUNTER_INTRO_MIN_MS) return false;
    const cb = encounterIntroCallback;
    encounterIntroCallback = null;
    gameState.encounterIntroPending = false;
    if (ui.encounterOverlay) ui.encounterOverlay.classList.add('hidden');
    if (ui.encounterArt) ui.encounterArt.classList.remove('enc-play');
    if (cb) cb();
    return true;
}

// DEV : prévisualiser un écran sans déclencher de combat (console du navigateur). Exemple : devPreviewEncounter('unseen', 'Rat Goulot').
function devPreviewEncounter(kind = 'spotted', mobName = null) {
    let enemy = null;
    if (mobName) {
        const boss = Object.values(districtBosses).find(b => b.name === mobName);
        const base = boss || findMobByName(mobName) || bountyHunters.find(h => h.name === mobName);
        if (base) enemy = Object.assign({}, base, { baseName: base.name, hp: base.hp || 1, isBoss: !!boss });
    }
    return showEncounterIntro(kind, enemy || generateMob(gameState.currentDistrict), null);
}

// DEV uniquement (menu déroulant, voir index.html) : saute directement à l'étage 3 (premier étage
// urbain), pour tester le réseau de villes sans traverser les étages précédents. Réinitialise tout
// état bloquant en cours (combat/boss/furtivité/compagnon) avant le saut, comme resetTransientState()
// le fait dans les tests — jamais d'étage à moitié configuré ni de combat fantôme après coup.
function devJumpToUrbanFloor() {
    gameState.inCombat = false;
    gameState.currentEnemy = null;
    gameState.bossChoicePending = false;
    gameState.stealthChoicePending = false;
    gameState.pendingStealthEncounter = null;
    gameState.companionChoicePending = false;
    gameState.pendingBossEncounter = null;
    gameState.pendingTravel = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    gameState.stairsChoicePending = false;
    gameState.pendingStairsChoice = null;
    ui.combatZone.classList.add('hidden');
    if (ui.stairsChoiceZone) ui.stairsChoiceZone.classList.add('hidden');
    ui.bossChoiceZone.classList.add('hidden');
    ui.stealthChoiceZone.classList.add('hidden');
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.add('hidden');

    if (!gameState.race) rollDevOrigin(); // Race et classe au hasard : jamais les deux écrans de choix (chantier 13)
    hideOriginOverlays();
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    gameState.currentFloor = 2; // advanceToNextFloor() incrémente : atterrit bien sur l'étage 3 (urbain)
    advanceToNextFloor(); // Raccourci DEV : saute délibérément l'écran d'escalier
    logEvent("🛠️ DEV : saut direct à l'étage 3 (urbain).", "info");
}

// `killer` précise la cause du décès quand timeout est faux : 'trap', 'bleed', un objet ennemi
// (riposte de combat — voir resolveEnemyCounterAttack()), ou omis (filet de sécurité). Sert
// uniquement à generateEpitaph() : n'affecte aucune autre logique de fin de partie.
function gameOver(timeout = false, killer = null) {
    gameState.inCombat = true; // Bloque toute action supplémentaire
    ui.combatZone.classList.add('hidden'); // Cache la zone de combat
    triggerHeavyImpact(); // Chantier 4 : la mort du joueur est l'un des 4 moments à hiérarchie forte
    playSfx('gameOverDirge');

    const reason = timeout
        ? "Le temps est écoulé. Le donjon s'effondre sur vous..."
        : "Vos signes vitaux sont à zéro. Fin de transmission.";

    let cause = 'timeout';
    let enemyName = null;
    if (!timeout) {
        if (killer === 'trap') {
            cause = 'trap';
        } else if (killer === 'bleed') {
            cause = 'bleed';
        } else if (killer && typeof killer === 'object') {
            // Un backfire de sort ce même tour rend la riposte qui suit responsable de la mort (voir
            // attackMagic()/tryPlayerAction() pour la pose/le reset de ce drapeau).
            cause = gameState.lastPlayerActionWasBackfire ? 'backfire' : 'combat';
            enemyName = killer.name;
        } else {
            cause = 'combat'; // Filet de sécurité si jamais appelé sans tueur précisé
        }
    }
    const bountyHunter = !!(killer && typeof killer === 'object' && killer.isBountyHunter); // Chantier 3 : épitaphe dédiée
    const epitaph = generateEpitaph({ cause, enemyName, bountyHunter });
    recordEpitaph(epitaph, { cause });
    // Succès posthumes (chantier 2) : même règle « mob très inférieur » que la nécrologie.
    const weakMob = cause === 'combat' && (gameState.level - getMobLevelEquivalent()) >= NECROLOGIE_WEAK_MOB_DELTA;
    recordRunEvent('death', { cause, weakMob });

    logEvent(reason, "danger");
    logEvent("--- GAME OVER ---", "danger");
    triggerHaptic('heavy');

    // Remplissage et affichage de l'écran Game Over (recouvre toute l'interface)
    ui.gameOverReason.innerText = reason;
    ui.gameOverFloor.innerText = gameState.currentFloor;
    ui.gameOverLevel.innerText = gameState.level;
    ui.gameOverDistrict.innerText = gameState.currentDistrict;
    if (ui.gameOverEpitaph) ui.gameOverEpitaph.innerText = epitaph;
    if (ui.gameOverAchievements) ui.gameOverAchievements.innerText = buildRunAchievementsSummary();
    renderScene('gameOver', { cause });
    ui.gameOverOverlay.classList.remove('hidden');

    updateUI();
    eraseSaveOnDeath(); // Après updateUI() (qui autosauvegarde) : le crawler mort ne sera jamais restauré
}

// Écran de victoire : déclenché en franchissant la Sortie de l'étage final (config.urbanFloors.finalFloor),
// une fois son gardien vaincu ou si elle n'était pas gardée. Même structure que gameOver(), en positif.
function winGame() {
    gameState.inCombat = true; // Bloque toute action supplémentaire, même logique que gameOver()
    gameState.hasWon = true;
    ui.combatZone.classList.add('hidden');
    playSfx('victoryFanfare');

    logEvent("🎉 Vous franchissez la Sortie et quittez le Donjon, vivant !", "success");
    logEvent("--- VICTOIRE ---", "success");
    triggerHaptic('heavy');

    ui.winFloor.innerText = gameState.currentFloor;
    ui.winLevel.innerText = gameState.level;
    recordRunEvent('victory'); // Sortie de secours (chantier 2)
    if (ui.winAchievements) ui.winAchievements.innerText = buildRunAchievementsSummary();
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

// Toucher la scène d'exploration explore (-1H), sur tous les étages. Clavier : Entrée sur la scène quand elle a
// le focus.
function onExploreSceneActivated() {
    if (isActionBlocked() || gameState.hp <= 0) return;
    triggerHaptic('medium');
    explore();
}
if (ui.exploreScene) {
    ui.exploreScene.addEventListener('click', onExploreSceneActivated);
    ui.exploreScene.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') onExploreSceneActivated(); });
}
if (ui.btnToggleMap) ui.btnToggleMap.addEventListener('click', () => toggleMapPanel());

// Bouton de redémarrage sur l'écran Game Over
ui.btnRestart.addEventListener('click', resetGame);
ui.btnWinRestart.addEventListener('click', resetGame);

// Bouton "Continuer" de l'écran d'escalier (voir continueFromFloorTransition())
if (ui.btnFloorTransitionContinue) ui.btnFloorTransitionContinue.addEventListener('click', continueFromFloorTransition);
if (ui.btnPactAtk) ui.btnPactAtk.addEventListener('click', () => choosePactBlessing('atk'));
[ui.raceChoiceCards, ui.classChoiceCards].forEach(box => {
    if (box) box.addEventListener('click', (e) => {
        const card = e.target.closest('[data-origin-key]');
        if (card) selectOrigin(card.dataset.originKey);
    });
});
if (ui.btnRaceConfirm) ui.btnRaceConfirm.addEventListener('click', confirmOriginChoice);
if (ui.btnClassConfirm) ui.btnClassConfirm.addEventListener('click', confirmOriginChoice);
if (ui.raceStatus) ui.raceStatus.addEventListener('click', openOriginSheet);
if (ui.classStatus) ui.classStatus.addEventListener('click', openOriginSheet);
if (ui.btnPactHp) ui.btnPactHp.addEventListener('click', () => choosePactBlessing('hp'));

// Écran de départ : nom du crawler (bouton ou touche Entrée), puis révélation du cadeau de bienvenue
ui.btnStartConfirm.addEventListener('click', confirmPlayerName);
ui.startNameInput.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') confirmPlayerName(); });
ui.btnGiftContinue.addEventListener('click', dismissGiftReveal);

// Inspection d'un objet : toucher le fond referme ; toucher un objet porté l'inspecte.
if (ui.itemInspectOverlay) {
    ui.itemInspectOverlay.addEventListener('click', (e) => { if (e && e.target === ui.itemInspectOverlay) closeItemInspect(); });
}
[['equippedWeapon', 'weapon'], ['equippedRanged', 'ranged'], ['equippedArmor', 'armor'], ['equippedSpell', 'spell']].forEach(([uiKey, slot]) => {
    if (!ui[uiKey]) return;
    ui[uiKey].classList.add('cursor-pointer');
    ui[uiKey].addEventListener('click', () => inspectEquippedSlot(slot));
});

// Écran "Nettoyer les sauvegardes" (voir openManageSaves() dans app.js)
if (ui.btnOpenManageSaves) ui.btnOpenManageSaves.addEventListener('click', openManageSaves);
if (ui.btnManageSavesClose) ui.btnManageSavesClose.addEventListener('click', closeManageSaves);
if (ui.btnManageSavesDeleteAll) ui.btnManageSavesDeleteAll.addEventListener('click', requestDeleteAllSaves);
if (ui.btnManageSavesConfirmYes) ui.btnManageSavesConfirmYes.addEventListener('click', confirmSaveDeletion);
if (ui.btnManageSavesConfirmNo) ui.btnManageSavesConfirmNo.addEventListener('click', cancelSaveDeletion);
if (ui.btnManageSavesRestoreBackup) ui.btnManageSavesRestoreBackup.addEventListener('click', restoreSavesBackup);

// Clics sur les boutons de combat
ui.btnAttackWeapon.addEventListener('click', attackWeapon);
ui.btnAttackRanged.addEventListener('click', attackRanged);
ui.btnAttackUnarmed.addEventListener('click', attackUnarmed);
if (ui.btnOccasion) ui.btnOccasion.addEventListener('click', startOccasion);
if (ui.btnClassAbility) ui.btnClassAbility.addEventListener('click', useClassAbility);
ui.btnAttackMagic.addEventListener('click', attackMagic);
if (ui.btnSprint) ui.btnSprint.addEventListener('click', attemptSprint);
if (ui.btnRetreat) ui.btnRetreat.addEventListener('click', attemptRetreat);
if (ui.btnEngage) ui.btnEngage.addEventListener('click', attemptEngage);
ui.btnFlee.addEventListener('click', attemptFlee);

// Skip au clic/Espace/Entrée (chantier "lisibilité combat", Chantier 9) : accélère le tour de beats
// en cours plutôt que d'attendre son rythme normal — voir combatSkipRequested/runCombatBeats().
// Filtre `e.target.closest('button')` : un clic sur une VRAIE action de combat (même bulle jusqu'à
// #combat-zone) ne doit jamais être réinterprété en demande de skip, seulement un clic dans l'espace
// vide de la zone (nom de l'ennemi, bannière, barre de distance...).
if (ui.combatZone) {
    ui.combatZone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        requestCombatSkip();
    });
}
// Sons (chantier 8) : boutons de coupure, page d'écoute, déverrouillage audio au premier geste.
updateSoundToggleButtons();
if (ui.btnSoundToggle) ui.btnSoundToggle.addEventListener('click', toggleSoundMuted);
if (ui.btnVoiceToggle) ui.btnVoiceToggle.addEventListener('click', toggleVoiceMuted);
if (ui.btnOpenSoundLab) ui.btnOpenSoundLab.addEventListener('click', openSoundLab);
if (ui.btnCloseSoundLab) ui.btnCloseSoundLab.addEventListener('click', closeSoundLab);
if (ui.soundLabList) {
    ui.soundLabList.addEventListener('click', (e) => {
        const button = e.target && e.target.closest ? e.target.closest('[data-sfx]') : null;
        if (button) playSfx(button.getAttribute('data-sfx'), { force: true });
    });
}
['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, () => unlockAudio(), { once: true, capture: true }));
if (ui.encounterModeSelect) {
    ui.encounterModeSelect.value = getEncounterIntroMode();
    ui.encounterModeSelect.addEventListener('change', () => setEncounterIntroMode(ui.encounterModeSelect.value));
}
// Écran de rencontre : un tap n'importe où, ou Espace/Entrée/Échap, le ferme (jamais de fermeture automatique).
if (ui.encounterOverlay) bindTap(ui.encounterOverlay, () => dismissEncounterIntro());
document.addEventListener('keydown', (e) => {
    if (gameState.encounterIntroPending && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        if (e.preventDefault) e.preventDefault();
        dismissEncounterIntro();
        return;
    }
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return; // ne gêne jamais la saisie (nom du crawler...)
    requestCombatSkip();
});

// Clics sur les boutons de choix de boss (Combattre / Repérer et partir)
ui.btnFightBoss.addEventListener('click', fightBossNow);
ui.btnRetreatBoss.addEventListener('click', retreatFromBoss);
ui.btnDescendStairs.addEventListener('click', descendStairs);
ui.btnStayOnFloor.addEventListener('click', stayOnFloor);

// Clics sur les boutons de choix de salle sécurisée (Repos / Repartir)
ui.btnNapSafehouse.addEventListener('click', () => restAtSafehouse('nap'));
ui.btnSleepSafehouse.addEventListener('click', () => restAtSafehouse('sleep'));
ui.btnLeaveSafehouse.addEventListener('click', leaveSafehouse);

// Clics sur les boutons de choix de furtivité (Esquiver / Attaque Furtive)
ui.btnStealthEvade.addEventListener('click', attemptStealthEvasion);
ui.btnStealthAttack.addEventListener('click', () => attemptStealthAttack('melee'));
ui.btnStealthRanged.addEventListener('click', () => attemptStealthAttack('ranged'));

// Clics sur les boutons de rencontre de compagnon
ui.btnRecruitFriendly.addEventListener('click', recruitCompanion);
ui.btnDeclineCompanion.addEventListener('click', declineCompanion);
ui.btnFleeCompanion.addEventListener('click', fleeCompanionEncounter);
ui.btnRecruitHostile.addEventListener('click', recruitCompanion);
ui.btnAttackCompanion.addEventListener('click', attackCompanionEncounter);
ui.companionStatusBar.addEventListener('click', openCompanionSheet);
if (ui.btnAchievements) ui.btnAchievements.addEventListener('click', openAchievementsScreen);
SHOW_TONES.forEach(t => { if (ui.showButtons && ui.showButtons[t.key]) ui.showButtons[t.key].addEventListener('click', () => answerShow(t.key)); });
if (ui.btnShowRefuse) ui.btnShowRefuse.addEventListener('click', () => answerShow('refuse'));
if (ui.btnCloseAchievements) ui.btnCloseAchievements.addEventListener('click', closeAchievementsScreen);

// Clics sur l'écran marchand/professeur (ville spécialisée)
ui.btnTrainSkill.addEventListener('click', trainSkill);
ui.btnLeaveShop.addEventListener('click', leaveShop);
if (ui.arcadeStake) {
    ui.arcadeStake.addEventListener('input', () => { arcadeMessage = { text: "", tone: "info" }; if (ui.arcadeMessage) ui.arcadeMessage.innerText = ""; updateArcadeUI(); });
    ui.shopArcadeContent.addEventListener('click', e => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-arcade-stake]') : null;
        if (btn) setArcadeStakePreset(btn.dataset.arcadeStake);
    });
}

// Clics sur le choix "plonger/poursuivre" d'un repaire repéré sur la route
ui.btnDiveLair.addEventListener('click', diveIntoLair);
ui.btnDeclineLair.addEventListener('click', declineLair);

// Barre d'icônes du bas et ses panneaux (chantier 9).
if (ui.navEquipment) ui.navEquipment.addEventListener('click', () => openInventorySheet('equipment'));
if (ui.navBag) ui.navBag.addEventListener('click', () => openInventorySheet('bag'));
if (ui.navSpellbook) ui.navSpellbook.addEventListener('click', () => openInventorySheet('spellbook'));
Object.values(INVENTORY_SHEETS).forEach(key => {
    const sheet = ui[key];
    if (!sheet || !sheet.addEventListener) return;
    sheet.addEventListener('click', (e) => {
        if (!e) return;
        const target = e.target;
        const closeBtn = target && target.closest ? target.closest('[data-close-sheet]') : null;
        if (target === sheet || closeBtn) closeInventorySheets();
    });
});
attachFloorMapPointerHandlers(ui.floorMapSvg);
if (ui.btnFloorMapGo) ui.btnFloorMapGo.addEventListener('click', confirmFloorMapTravel);
if (ui.btnFloorMapCancel) ui.btnFloorMapCancel.addEventListener('click', cancelFloorMapTravel);
if (ui.btnFloorMapZoomIn) ui.btnFloorMapZoomIn.addEventListener('click', () => zoomFloorMap(1));
if (ui.btnFloorMapZoomOut) ui.btnFloorMapZoomOut.addEventListener('click', () => zoomFloorMap(-1));
if (ui.btnFloorMapRecenter) ui.btnFloorMapRecenter.addEventListener('click', recenterFloorMap);

// Clic sur le kit de test (bouton discret)
ui.btnDevTestKit.addEventListener('click', giveTestKit);
ui.btnDevJumpUrban.addEventListener('click', devJumpToUrbanFloor);
if (ui.btnDevMinigame) ui.btnDevMinigame.addEventListener('click', devTestMinigame);
initMinigameUi(); // Mini-jeux (chantier 6) : réglage, clavier, pause d'onglet

// Lancement du jeu
generateFloorMap();
showFloorArrivalScene();
updateUI();
updateInventoryUI();
updateSpellbookUI();
updateCompanionUI();

// Indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames())
refreshStartSavesHint();

// Version affichée sur l'écran de départ (voir APP_VERSION)
if (ui.versionLabel) {
    ui.versionLabel.innerText = `PR #${APP_VERSION.pr} — ${APP_VERSION.label}`;
}

