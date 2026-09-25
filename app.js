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
    timeLeft: 100,
    maxTime: 100, // Temps alloué pour un niveau
    currentFloor: 1,
    // Reflète toujours le quartier (quadrant) où se trouve actuellement le joueur ; posé par
    // generateFloorMap() à chaque étage, puis mis à jour à chaque changement de quadrant.
    currentDistrict: null,
    inventory: [],
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
    shopChoicePending: false, // Un écran marchand/professeur (ville spécialisée) est ouvert
    pendingShopCityId: null, // Ville dont l'écran marchand/professeur est actuellement affiché
    lairChoicePending: false, // Un repaire vient d'être repéré sur la route empruntée : choix plonger/poursuivre
    pendingLairId: null, // Repaire (gameState.urbanMap.lairsById) dont le choix est actuellement affiché
    pendingLairDive: null, // { lairId, combatsLeft, stage: 'trash'|'boss' } pendant une plongée en cours (voir winCombat())
    floorTransitionPending: false, // L'écran d'escalier (félicitations) est affiché, voir triggerFloorTransition()
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
const APP_VERSION = { pr: 20, label: "Nettoyer les sauvegardes + écran d'escalier + nécrologie + anomalies d'étage" };

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

    // Chantier "rework combat", Chantier 2 (récompenses de boss) : rareté plancher garantie sur le
    // loot d'un boss (voir winCombat()/rollRarity() dans generator.js) — Légendaire est réservé à
    // l'objet signature garanti séparément (voir bestiary.js, districtBosses.*.signatureItem), donc
    // Épique comme plancher pour le loot ALÉATOIRE laisse une vraie place à la Légendaire "en bonus".
    bossRewards: {
        minRarityKey: 'epique'
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
        // Nombre de routes marquées "repaire" par étage urbain (voir generateUrbanFloorMap()) :
        // toujours 1, sauf à l'étage final où un second, plus généreux, s'ajoute.
        lairRoadsPerFloor: 1,
        lairRoadsFinalFloor: 2
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
    playerGold: document.getElementById('player-gold'),
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
    enemyStatusIcons: document.getElementById('enemy-status-icons'),
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
    gameOverEpitaph: document.getElementById('game-over-epitaph'),
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
    pactChoiceOverlay: document.getElementById('pact-choice-overlay'),
    btnPactAtk: document.getElementById('btn-pact-atk'),
    btnPactHp: document.getElementById('btn-pact-hp'),
    combatZone: document.getElementById('combat-zone'),
    knownLocationsSection: document.getElementById('known-locations-section'),
    knownLocationsContainer: document.getElementById('known-locations'),
    urbanTravelOverlay: document.getElementById('urban-travel-overlay'),
    urbanMapSvg: document.getElementById('urban-map-svg'),
    btnRecenterMap: document.getElementById('btn-recenter-map'),
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
    shopTrainerInfo: document.getElementById('shop-trainer-info'),
    btnTrainSkill: document.getElementById('btn-train-skill'),
    btnLeaveShop: document.getElementById('btn-leave-shop'),
    lairChoiceZone: document.getElementById('lair-choice-zone'),
    btnDiveLair: document.getElementById('btn-dive-lair'),
    btnDeclineLair: document.getElementById('btn-decline-lair'),
    companionStatusBar: document.getElementById('companion-status-bar'),
    companionNameDisplay: document.getElementById('companion-name-display'),
    companionSpecialtyDisplay: document.getElementById('companion-specialty-display'),
    companionLeaveBar: document.getElementById('companion-leave-bar'),
    companionCombatIndicator: document.getElementById('companion-combat-indicator'),
    companionCombatName: document.getElementById('companion-combat-name'),
    companionCombatHpRing: document.getElementById('companion-combat-hp-ring'),
    companionCombatHp: document.getElementById('companion-combat-hp'),
    enemyName: document.getElementById('enemy-name'),
    telegraphBanner: document.getElementById('telegraph-banner'),
    btnAttackWeapon: document.getElementById('btn-attack-weapon'),
    btnAttackRanged: document.getElementById('btn-attack-ranged'),
    btnAttackUnarmed: document.getElementById('btn-attack-unarmed'),
    btnAttackMagic: document.getElementById('btn-attack-magic'),
    btnSprint: document.getElementById('btn-sprint'),
    btnRetreat: document.getElementById('btn-retreat'),
    btnEngage: document.getElementById('btn-engage'),
    btnFlee: document.getElementById('btn-flee'),
    combatDistanceWrapper: document.getElementById('combat-distance-wrapper'),
    combatDistanceFill: document.getElementById('combat-distance-fill'),
    combatDistancePlayerIcon: document.getElementById('combat-distance-player-icon'),
    combatDistanceEnemyIcon: document.getElementById('combat-distance-enemy-icon'),
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

    // Migration douce : une sauvegarde antérieure au système d'anomalies (Tâche 4) n'a pas
    // baseMaxHp — son maxHp EST alors la vraie base (aucun multiplicateur d'anomalie n'a jamais pu
    // s'y appliquer). anomalyEffects/activeAnomalies n'ont pas besoin de migration explicite : Object.assign
    // ne touche pas les clés absentes de `saved`, qui gardent donc leurs valeurs neutres déjà posées à
    // l'initialisation de gameState.
    const needsBaseMaxHpMigration = saved.baseMaxHp === undefined;

    Object.assign(gameState, saved);
    if (needsBaseMaxHpMigration) gameState.baseMaxHp = saved.maxHp || gameState.maxHp;

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
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    gameState.pendingLairDive = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    gameState.pendingNextFloorAnomalies = null;

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

    // Mise à jour des PV (anneau circulaire), ATK et DEF
    setHpRing(ui.compactHpRing, ui.compactHpValue, gameState.hp, gameState.maxHp);
    ui.playerAtk.innerText = gameState.atk;
    ui.playerDef.innerText = getEffectiveDef();
    if (ui.playerGold) ui.playerGold.innerText = gameState.gold;

    // Le libellé d'étage sur la carte active reste toujours synchronisé
    ui.cardFloorLabel.innerText = `Étage ${gameState.currentFloor}`;
    updateAnomalyStatusUI();

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

            renderEnemyStatusBadges(gameState.currentEnemy);
        }
        updateTelegraphBanner();

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
        // Charger (attemptEngage(), Chantier 3) : même disponibilité que S'approcher (un écart à
        // combler), alternative agressive qui enchaîne une attaque bonus au lieu d'un simple
        // repositionnement.
        if (ui.btnEngage) {
            const engageUsable = !!gameState.currentEnemy && distance > 0;
            ui.btnEngage.disabled = !engageUsable;
            ui.btnEngage.classList.toggle('opacity-40', !engageUsable);
            ui.btnEngage.classList.toggle('pointer-events-none', !engageUsable);
        }
        // Un mob "alerted" (échec de furtivité, voir attemptStealthEvasion()) ne laisse plus fuir.
        if (ui.btnFlee) {
            const fleeUsable = !gameState.currentEnemy || !gameState.currentEnemy.alerted;
            ui.btnFlee.disabled = !fleeUsable;
            ui.btnFlee.classList.toggle('opacity-40', !fleeUsable);
            ui.btnFlee.classList.toggle('pointer-events-none', !fleeUsable);
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

    // "Lieux connus" (donjon classique) reste un panneau séparé ; la "Carte Urbaine" (étage urbain)
    // s'affiche elle en overlay directement sur la carte active plutôt qu'en panneau séparé, pour
    // que le déplacement entre villes reste au même endroit que l'exploration classique. Elle se
    // masque dès qu'une "situation" est en cours (combat/boss/furtivité/compagnon,
    // voir isActionBlocked()) : la carte redevient alors visible et se comporte exactement comme sur
    // un étage classique.
    if (ui.knownLocationsSection) ui.knownLocationsSection.classList.toggle('hidden', !!gameState.urbanMap);
    if (ui.urbanTravelOverlay) ui.urbanTravelOverlay.classList.toggle('hidden', !gameState.urbanMap || isActionBlocked());

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

// Décalage horizontal (±8px) des chiffres flottants, pour que deux chiffres quasi simultanés (un
// multi-coups par exemple) ne se superposent pas exactement. Volontairement PAS Math.random() :
// cette fonction est appelée à chaque point de dégâts réel, donc consommer le flux aléatoire partagé
// y désynchroniserait les séquences Math.random fixes de nombreux tests existants
// (tests/regression/*.js) qui n'ont rien à voir avec cet effet purement cosmétique. Un compteur qui
// boucle sur un petit jeu de décalages est tout aussi efficace visuellement et ne touche à rien.
const FLOATING_DAMAGE_OFFSETS = [-7, 6, -3, 8, -8, 3, -5, 7];
let floatingDamageOffsetIndex = 0;

// Chiffre de dégâts flottant (chantier "lisibilité combat", Chantier 3) : un chiffre par impact,
// monte et s'estompe au-dessus du panneau touché (#combat-side-enemy/#combat-side-player, voir leur
// `position: relative` dans index.html — le chiffre s'y ajoute EN PLUS du dé qui vole déjà,
// jamais à sa place). `toPlayer` distingue les dégâts SUBIS par le joueur (rouge/orangé) des dégâts
// qu'il INFLIGE (blanc/jaune) ; `heavy` grossit le chiffre (×1.4 environ) pour un coup marquant
// (télégraphe exécuté, ruée d'enrage, phase 3). Se nettoie lui-même après son animation
// (`animationend`), fonctionne aussi bien avec l'animation normale que le simple fondu de
// prefers-reduced-motion (les deux déclenchent cet événement).
function showFloatingDamage(containerEl, amount, { heavy = false, toPlayer = false } = {}) {
    if (!containerEl) return;
    const el = document.createElement('span');
    el.className = `floating-damage ${toPlayer ? 'floating-damage-taken' : 'floating-damage-dealt'}${heavy ? ' floating-damage-heavy' : ''}`;
    el.innerText = `-${Math.round(amount)}`;
    const offsetX = FLOATING_DAMAGE_OFFSETS[floatingDamageOffsetIndex];
    floatingDamageOffsetIndex = (floatingDamageOffsetIndex + 1) % FLOATING_DAMAGE_OFFSETS.length;
    el.style.left = `calc(50% + ${offsetX}px)`;
    el.addEventListener('animationend', () => el.remove());
    containerEl.appendChild(el);
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
    const actualHeal = applyPlayerHeal(healAmount);
    gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaAmount);
    const parts = [];
    if (actualHeal > 0) parts.push(`${actualHeal} PV`);
    if (manaAmount > 0) parts.push(`${manaAmount} Mana`);
    logEvent(`Vous consommez [${item.name}]${parts.length ? ` et récupérez ${parts.join(" et ")}` : ""}.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// Ratio de revente : un objet de l'inventaire (équipement non équipé ou consommable) se vend à une
// fraction de sa valeur de base — jamais l'équipement actuellement porté (gameState.equipment),
// jamais un sort (le grimoire n'a pas de valeur marchande). Réservé à l'interaction boutique (voir
// triggerShopEncounter()) : pas de vente "de rue" hors ville spécialisée.
const SELL_VALUE_RATIO = 0.4;
function sellItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const price = Math.max(1, Math.round((item.baseValue || 0) * SELL_VALUE_RATIO));
    gameState.gold += price;
    gameState.inventory.splice(index, 1);
    logEvent(`Vous vendez [${formatItemDisplayName(item)}] pour ${price} PO.`, "success");
    updateUI();
    updateInventoryUI();
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================

// Régénération passive de PV et de mana, proportionnelle au temps qui s'écoule en explorant ou en
// voyageant vers un lieu connu (voir performExploreStep()/travelToKnownLocation()/
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
    if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
        const manaMult = gameState.anomalyEffects.manaRegenMult || 1; // SECHERESSE (anomalies.js)
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + MANA_REGEN_PER_HOUR * hours * manaMult);
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
        applyPlayerDamage(dmg);
        setCardHeader('⚠️', 'Piège', 'Danger');
        logEvent(`${trap.text} (-${dmg} PV)`, "danger");
        if (gameState.hp <= 0) {
            gameOver(false, 'trap');
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
        const actualHeal = applyPlayerHeal(heal);
        setCardHeader('🎒', 'Petite Trouvaille', 'Butin');
        logEvent(`${pick(flavorText.minorFind)} (+${actualHeal} PV)`, "success");
        return;
    }

    // NOUVEAU : Quelques PO trouvées (voir sellItem() pour l'autre source de revenu)
    cumulative += config.chances.goldFind;
    if (d100 < cumulative) {
        const baseGold = Math.floor(Math.random() * 16) + 5; // 5 à 20 PO
        const gold = Math.round(baseGold * (1 + gameState.currentFloor * 0.15) * (gameState.anomalyEffects.goldGainMult || 1)); // Proportionnel à l'étage, ECONOMIE_AUSTERE (anomalies.js)
        gameState.gold += gold;
        setCardHeader('💰', 'Pièces d\'Or', 'Butin');
        logEvent(`${pick(flavorText.goldFind)} (+${gold} PO)`, "success");
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
    // NOCTURNE (anomalies.js) : détection des mobs accrue (pénalité sur la chance de base) mais
    // plafond relevé d'autant — récompense un fort investissement en Furtivité, punit un faible.
    chance -= gameState.anomalyEffects.detectionBonus || 0;
    return Math.max(0, Math.min(60 + (gameState.anomalyEffects.stealthCapBonus || 0), chance));
}

// Point d'entrée d'une rencontre aléatoire : tente d'abord la furtivité avant de basculer sur un
// combat classique si le monstre repère le joueur.
function handleStealthEncounter() {
    // LABYRINTHE (anomalies.js) : mobs rencontrés dans le quartier qui garde l'escalier ont plus de
    // chances d'être élite ("escalier mieux gardé") — n'affecte aucun autre quartier de l'étage.
    const inStairsQuadrant = gameState.floorMap && gameState.floorMap.currentQuadrant === gameState.floorMap.stairsQuadrant;
    const eliteBonus = (gameState.anomalyEffects.guardedStairsBoost && inStairsQuadrant) ? 25 : 0;
    const enemy = generateMob(gameState.currentDistrict, eliteBonus);
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

    const evadeChance = Math.min(70 + (gameState.anomalyEffects.stealthCapBonus || 0), 40 + (gameState.skills.stealth.level - 1) * 8); // NOCTURNE (anomalies.js)
    if (Math.random() * 100 < evadeChance) {
        setCardHeader('🥷', 'Évitement Réussi', 'Furtivité');
        logEvent(`Vous évitez [${enemy.name}] sans un bruit.`, "success");
        gainSkillXp('stealth', 5);
        updateUI();
    } else {
        // Échec punitif : le mob reste "alerted" pour tout ce combat (voir attemptFlee()), pour que
        // la boucle esquive-ratée-mais-sans-conséquence ne reste pas totalement gratuite — voir issue
        // d'équilibrage "Furtivité".  L'en-tête de la carte (icône/nom/type) est posé par
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
    return gameState.inCombat || gameState.bossChoicePending || gameState.companionChoicePending || gameState.stealthChoicePending || gameState.shopChoicePending || gameState.lairChoicePending || gameState.floorTransitionPending || gameState.pactChoicePending;
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

// Fait effectivement passer à l'étage suivant (génération incluse) — dispatché depuis l'écran
// d'escalier (voir triggerFloorTransition()/continueFromFloorTransition() plus bas), sauf pour
// devJumpToUrbanFloor() (raccourci DEV, saute délibérément l'écran).
function advanceToNextFloor() {
    gameState.currentFloor += 1;
    gameState.cardsDrawnThisFloor = 0;
    gameState.timeLeft = gameState.maxTime; // Réinitialisation du temps
    gameState.knownLocations = []; // Les lieux repérés à l'étage précédent ne sont plus accessibles
    gameState.floorMap = null;
    gameState.urbanMap = null;
    // Tally du nouvel étage repart à zéro — celui qui vient de se terminer a déjà été affiché sur
    // l'écran d'escalier (voir triggerFloorTransition()) avant cet appel.
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

    // Multiple de 3 (voir config.urbanFloors) : étage urbain (réseau villes/routes) plutôt que le
    // donjon classique à 4 quartiers.
    if (gameState.currentFloor % 3 === 0) {
        generateUrbanFloorMap();
    } else {
        generateFloorMap(); // Nouvelle zone circulaire à 4 quartiers pour ce nouvel étage
    }

    logEvent(`--- DÉBUT DE L'ÉTAGE ${gameState.currentFloor} ---`, "info");
    if (gameState.activeAnomalies.length > 0) {
        logEvent(`⚠️ Anomalie(s) active(s) : ${gameState.activeAnomalies.map(a => `${a.icon} ${a.name}`).join(', ')}.`, "danger");
    }
    updateKnownLocationsUI();
    updateUrbanMapUI();
    updateAnomalyStatusUI();

    // PACTE_DU_CRAWLER : choix forcé à l'entrée de l'étage, résolu AVANT de rendre la main au joueur
    // (isActionBlocked() le bloque comme n'importe quel autre choix en attente).
    if (gameState.anomalyEffects.forcedPactChoice) {
        triggerPactChoice();
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
    updateUI();
}

// Bouton "Continuer" de l'écran d'escalier : referme l'écran et fait effectivement passer à l'étage
// suivant (voir advanceToNextFloor()).
function continueFromFloorTransition() {
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    gameState.floorTransitionPending = false;
    advanceToNextFloor();
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
    updateUI();
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
function generateEpitaph(deathContext) {
    const { cause, enemyName } = deathContext;
    const floor = gameState.currentFloor;
    const fleesThisRun = gameState.fleesThisRun || 0;
    const ridiculousItem = findRidiculousEquippedItem();

    let pool = EPITAPH_TEMPLATES[cause] || EPITAPH_TEMPLATES.combat;
    let deltaNiveau = null;
    if (cause === 'combat' || cause === 'backfire') {
        const mobLevel = getMobLevelEquivalent();
        deltaNiveau = gameState.level - mobLevel;
        if (cause === 'combat' && deltaNiveau >= NECROLOGIE_WEAK_MOB_DELTA) {
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
function addLoot(powerScore = 0, options = {}) {
    // minRarityKey (chantier "rework combat" — loot garanti de rareté minimale sur un boss) : voir
    // winCombat()/rollRarity() dans generator.js.
    const item = generateItem(powerScore, null, options.minRarityKey || null);
    if (item.category === 'scrolls') {
        gameState.spellbook.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`Sort appris : [${formatItemDisplayName(item)}] !`, "loot");
        updateSpellbookUI();
        return;
    }
    const isConsumable = item.category === 'consumables';
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    if (isConsumable || equipmentCount < gameState.maxInventory) {
        gameState.inventory.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`Objet obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
    } else {
        logEvent("Vous trouvez un objet, mais votre réserve d'équipement est pleine !", "danger");
    }
}

// Chantier "rework combat", Chantier 2 : objet signature garanti à la défaite d'un boss précis (voir
// bestiary.js, districtBosses.*.signatureItem) — copie fraîche à chaque victoire (jamais partagée
// avec le template), toujours Légendaire, en plus du loot aléatoire déjà garanti de rareté minimale
// (voir config.bossRewards/winCombat()).
function awardBossSignatureItem(boss) {
    if (!boss || !boss.signatureItem) return;
    const item = JSON.parse(JSON.stringify(boss.signatureItem));
    const legendary = itemRarities[itemRarities.length - 1];
    item.rarity = legendary.name;
    item.rarityColor = legendary.color;

    if (item.category === 'scrolls') {
        gameState.spellbook.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`✨ Objet signature obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateSpellbookUI();
        return;
    }
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    if (equipmentCount < gameState.maxInventory) {
        gameState.inventory.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`✨ Objet signature obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
    } else {
        logEvent(`✨ ${boss.name} laissait tomber [${formatItemDisplayName(item)}], mais votre réserve d'équipement est pleine !`, "danger");
    }
}

// Point de passage UNIQUE pour toute perte de PV du joueur (piège, saignement, riposte ennemie...) —
// clampe à 0 et alimente le tally de l'étage en cours (gameState.floorStats.damageTaken, voir écran
// d'escalier). Remplace les mutations directes de gameState.hp dispersées dans le code de combat/
// exploration, pour ne jamais avoir à retrouver tous ces points d'appel séparément (ex : un futur
// hook d'anomalie qui multiplierait les dégâts subis n'aurait qu'ICI à s'accrocher).
function applyPlayerDamage(amount) {
    if (!amount || amount <= 0) return;
    gameState.hp = Math.max(0, gameState.hp - amount);
    gameState.floorStats.damageTaken += amount;
}

// Point de passage UNIQUE pour tout gain de PV du joueur (potion, trouvaille, régénération passive,
// mécanique d'arme/armure, compagnon Médecin...) — clampe à gameState.maxHp et applique
// gameState.anomalyEffects.healingMult (voir PEAU_DE_VERRE dans anomalies.js). Renvoie le soin
// RÉELLEMENT appliqué (après multiplicateur et clamp), pour que les messages de log restent honnêtes
// même quand l'anomalie change le montant affiché.
function applyPlayerHeal(amount) {
    if (!amount || amount <= 0) return 0;
    const mult = gameState.anomalyEffects.healingMult || 1;
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
    gameState.maxHp = Math.max(1, Math.round(gameState.baseMaxHp * mult));
    if (gameState.hp > gameState.maxHp) gameState.hp = gameState.maxHp;
}

// ==========================================
// SYSTÈME DE NIVEAU ET D'EXPÉRIENCE
// ==========================================
function gainXp(amount) {
    if (!amount || amount <= 0) return;
    amount = Math.round(amount * (gameState.anomalyEffects.xpMult || 1)); // MOB_ENRAGE (anomalies.js)
    gameState.xp += amount;
    gameState.floorStats.xpGained += amount;
    logEvent(`+${amount} XP`, "success");

    // On utilise une boucle "while" pour gérer le cas (rare) d'un gain d'XP
    // suffisant pour franchir plusieurs niveaux d'un coup.
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
    // LABYRINTHE (anomalies.js) : +50% de pièces par quartier (donc sur l'étage entier, 4 quartiers).
    const roomCount = Math.round((10 + Math.floor(Math.random() * 5)) * (1 + (gameState.anomalyEffects.extraRoomsPct || 0))); // 10 à 14 pièces de base
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

    // CAFET_ASSOMBRIE (anomalies.js) : une pièce normale au hasard (jamais l'entrée, un boss ou une
    // salle sécurisée) cache un piège sévère + un trésor nettement supérieur — voir enterRoom().
    if (gameState.anomalyEffects.cafetRoom) {
        const candidates = Object.values(roomsById).filter(r => r.type === 'normal' && r.id !== quadrants[0].entryRoomId);
        if (candidates.length > 0) {
            candidates[Math.floor(Math.random() * candidates.length)].cafetRoom = true;
        }
    }
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
// MINI CARTE GRAPHIQUE (réutilisable) — disposition + rendu SVG d'un graphe générique de
// nœuds/arêtes, sans AUCUNE connaissance du jeu : pensée pour être réutilisée telle quelle par
// n'importe quel système de navigation basé sur un graphe. Les étages urbains (ci-dessous) sont le
// premier appelant ; un futur mini-plan de donjon classique (pièces/couloirs de generateFloorMap())
// pourrait s'y brancher de la même façon, via son propre adaptateur nœuds/arêtes.
// ==========================================

// Calcule/actualise une disposition 2D (coordonnées normalisées 0..1) pour un ensemble de nœuds
// reliés par des arêtes, par relaxation "force-directed" minimaliste (répulsion entre tous les
// nœuds + ressort sur les arêtes vers une longueur cible + légère attraction vers le centre), sans
// dépendance externe (aucun build step, voir CLAUDE.md). `existingPositions` (optionnel, {id:{x,y}})
// sert de point de départ : les nœuds déjà positionnés convergent quasiment sur place (équilibre
// déjà proche) tandis qu'un nœud nouvellement révélé démarre sur un cercle et rejoint sa place —
// jamais de réarrangement brutal de tout le graphe à chaque nouvel appel.
function computeGraphLayout(nodeIds, edges, existingPositions = {}) {
    const positions = {};
    // Mobilité par nœud : un nœud déjà positionné lors d'un appel précédent reste (quasi) ancré —
    // seule une petite fraction des forces qu'il subit s'applique réellement — pendant qu'un nœud
    // tout juste révélé, lui, est pleinement mobile pour rejoindre sa place. Sans ça, la relaxation
    // complète (ITERATIONS élevé, nécessaire pour bien placer le nouveau nœud) réorganiserait tout
    // le graphe à chaque révélation, au lieu de se contenter d'y intégrer le nouveau venu.
    const mobility = {};
    nodeIds.forEach((id, i) => {
        if (existingPositions[id]) {
            positions[id] = { x: existingPositions[id].x, y: existingPositions[id].y };
            mobility[id] = 0.08;
        } else {
            const angle = (i / Math.max(1, nodeIds.length)) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 0.28 + Math.random() * 0.12;
            positions[id] = { x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius };
            mobility[id] = 1;
        }
    });
    if (nodeIds.length <= 1) return positions;

    const relevantEdges = edges.filter(e => positions[e.from] && positions[e.to]);
    const ITERATIONS = 120;
    const REPULSION = 0.010;
    const SPRING = 0.06;
    const SPRING_LENGTH = 0.30;
    const CENTER_PULL = 0.02;

    for (let iter = 0; iter < ITERATIONS; iter++) {
        const forces = {};
        nodeIds.forEach(id => { forces[id] = { x: 0, y: 0 }; });

        // Répulsion entre toutes les paires (petit graphe, O(n²) largement suffisant ici)
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = nodeIds[i], b = nodeIds[j];
                let dx = positions[a].x - positions[b].x;
                let dy = positions[a].y - positions[b].y;
                const distSq = dx * dx + dy * dy || 0.0001;
                const dist = Math.sqrt(distSq);
                const force = REPULSION / distSq;
                dx /= dist; dy /= dist;
                forces[a].x += dx * force; forces[a].y += dy * force;
                forces[b].x -= dx * force; forces[b].y -= dy * force;
            }
        }

        // Ressort sur les arêtes : rapproche/éloigne les voisins reliés vers SPRING_LENGTH
        relevantEdges.forEach(e => {
            let dx = positions[e.to].x - positions[e.from].x;
            let dy = positions[e.to].y - positions[e.from].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            const diff = (dist - SPRING_LENGTH) * SPRING;
            dx /= dist; dy /= dist;
            forces[e.from].x += dx * diff; forces[e.from].y += dy * diff;
            forces[e.to].x -= dx * diff; forces[e.to].y -= dy * diff;
        });

        // Légère attraction vers le centre pour ne pas dériver hors du cadre normalisé
        nodeIds.forEach(id => {
            forces[id].x += (0.5 - positions[id].x) * CENTER_PULL;
            forces[id].y += (0.5 - positions[id].y) * CENTER_PULL;
        });

        // Écrête la force totale par nœud avant application : la répulsion en 1/distSq peut devenir
        // énorme quand deux nœuds démarrent quasiment au même point (un nouveau nœud tombe par hasard
        // tout près d'un existant), provoquant sinon un "saut" d'un bord à l'autre du cadre en une
        // seule itération plutôt qu'une relaxation progressive.
        const MAX_STEP = 0.05;
        nodeIds.forEach(id => {
            const f = forces[id];
            const mag = Math.sqrt(f.x * f.x + f.y * f.y);
            if (mag > MAX_STEP) {
                f.x = (f.x / mag) * MAX_STEP;
                f.y = (f.y / mag) * MAX_STEP;
            }
            positions[id].x = Math.min(0.94, Math.max(0.06, positions[id].x + f.x * mobility[id]));
            positions[id].y = Math.min(0.94, Math.max(0.06, positions[id].y + f.y * mobility[id]));
        });
    }

    return positions;
}

// Calcule/écrête les bornes par défaut du monde pannable à partir des positions fournies, quand
// l'appelant n'en fournit pas lui-même (voir `worldBounds` de renderGraphMiniMap()) — une marge
// généreuse autour de la boîte englobante de tous les nœuds plutôt qu'un cadre pile ajusté.
function computeDefaultWorldBounds(positions, margin) {
    const pts = Object.values(positions);
    if (pts.length === 0) return { minX: -margin, maxX: margin, minY: -margin, maxY: margin };
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return {
        minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin,
        minY: Math.min(...ys) - margin, maxY: Math.max(...ys) + margin,
    };
}

// Écrête un centre de caméra pour que la fenêtre affichée (viewSize, centrée sur ce point) ne sorte
// jamais des bornes du monde (worldBounds) — fonction pure, testable indépendamment de tout DOM/
// événement pointeur. Si le monde est plus petit que la fenêtre (peu de nœuds connus), centre le
// monde plutôt que d'écrêter sur un intervalle vide/inversé.
function clampCameraToBounds(camera, viewSize, worldBounds) {
    const halfW = viewSize.w / 2, halfH = viewSize.h / 2;
    const minCx = worldBounds.minX + halfW, maxCx = worldBounds.maxX - halfW;
    const minCy = worldBounds.minY + halfH, maxCy = worldBounds.maxY - halfH;
    const x = minCx <= maxCx ? Math.min(maxCx, Math.max(minCx, camera.x)) : (worldBounds.minX + worldBounds.maxX) / 2;
    const y = minCy <= maxCy ? Math.min(maxCy, Math.max(minCy, camera.y)) : (worldBounds.minY + worldBounds.maxY) / 2;
    return { x, y };
}

// Rendu SVG générique d'un graphe déjà disposé dans un <svg> existant : `nodes` = [{id, label, icon,
// variant}], `edges` = [{from, to, distance}] (distance optionnelle, affichée seulement sur les
// arêtes reliées au nœud courant pour ne pas surcharger l'affichage), `positions` = {id:{x,y}} en
// coordonnées MONDE (unités arbitraires, pas de normalisation 0..1 — voir computeGraphLayout() ou
// une grille logique comme pour les étages urbains), `currentId` = nœud où l'on se trouve (mis en
// évidence, jamais cliquable). `variant` ('guarded'/'goal'/'default') pilote la couleur des nœuds
// autres que le courant. Trois familles de petits marqueurs, pour trois usages distincts :
//   - `goalIcon` (sur un NŒUD) : décalé sur l'arête d'accès de ce nœud plutôt que dans son propre
//     cercle (ex : un gardien "posté sur la route" plutôt que confondu avec la ville qu'il garde).
//   - `badge` (sur un NŒUD) : petite icône accolée au cercle du nœud lui-même, pour un rôle qui ne
//     bloque rien (ex : marchand/professeur) — contrairement à goalIcon, jamais décalée sur une arête.
//   - `marker` (sur une ARÊTE, `edges[i].marker = {icon, variant}`) : rendu au milieu de l'arête
//     elle-même, pour un élément qui n'appartient à AUCUN des deux nœuds qu'elle relie (ex : un
//     repaire sur une route).
// `onNodeClick(id)` est appelé au clic sur n'importe quel autre nœud (y compris son propre goalIcon).
//
// Caméra (monde pannable) : `camera` ({x,y}, optionnel) fixe le centre de la fenêtre affichée ; sans
// lui, retombe sur la position de `currentId` puis, à défaut, sur le centre de la boîte englobante de
// tous les nœuds — c'est à l'APPELANT de mémoriser un `camera` explicite d'un rendu à l'autre (ce
// module ne garde aucun état), typiquement seulement après que le joueur a fait glisser la carte
// (`onCameraChange`, voir plus bas). `viewSize` ({w,h}, monde, défaut 200×240) fixe la taille de
// cette fenêtre. `worldBounds` ({minX,maxX,minY,maxY}, optionnel) écrête le pan aux limites du monde
// (voir clampCameraToBounds()) ; à défaut, calculé depuis l'étendue des nœuds (computeDefaultWorldBounds()).
// `onCameraChange(newCamera)` (optionnel) : si fourni, le pan par glissement (souris ET tactile,
// `pointerdown`/`pointermove`/`pointerup`) est activé sur `svgEl` — le viewBox est déplacé EN DIRECT
// pendant le glissement (mutation légère d'un seul attribut, jamais un re-rendu complet du graphe/
// fond, qui serait coûteux à chaque pointermove), et `onCameraChange` n'est appelé qu'UNE fois à la
// fin du glissement, pour que l'appelant persiste la nouvelle position (elle serait sinon perdue au
// prochain rendu complet, qui repart de `camera`/`currentId`). Un déplacement de moins de 5px au
// relâchement reste un simple tap/clic : le nœud le plus proche du point relâché (par distance en
// coordonnées MONDE, voir `clickableRegions`) navigue normalement — PAS via le `click` natif du
// navigateur, constaté peu fiable une fois qu'un pointeur a été capturé pendant l'interaction (même
// relâché ensuite) ; sans pan (`onCameraChange` absent), aucun pointeur n'est jamais capturé et le
// `click` natif classique reste utilisé directement sur chaque nœud.
// `background` (optionnel, {rects, lines} en coordonnées MONDE, lines avec cx/cy optionnel pour une
// courbe) dessine une texture décorative sous les arêtes/nœuds — aucune connaissance du jeu non plus,
// l'appelant fournit le motif.
const GRAPH_MINIMAP_VARIANT_COLORS = {
    current: { fill: "#1d4ed8", stroke: "#93c5fd" },
    guarded: { fill: "#7f1d1d", stroke: "#f87171" },
    goal: { fill: "#78350f", stroke: "#fbbf24" },
    default: { fill: "#111827", stroke: "#4b5563" },
};
function renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId, onNodeClick, camera, viewSize, worldBounds, onCameraChange, background }) {
    if (!svgEl) return;
    svgEl.innerHTML = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const view = viewSize || { w: 200, h: 240 };

    // Centre de caméra : explicite (`camera`) > centré sur `currentId` > centre de la boîte
    // englobante de tous les nœuds positionnés > origine si aucun nœud.
    let cx, cy;
    if (camera) {
        cx = camera.x; cy = camera.y;
    } else if (currentId && positions[currentId]) {
        cx = positions[currentId].x; cy = positions[currentId].y;
    } else {
        const pts = Object.values(positions);
        cx = pts.length ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 0;
        cy = pts.length ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 0;
    }
    const bounds = worldBounds || computeDefaultWorldBounds(positions, Math.max(view.w, view.h) * 0.5);
    const clamped = clampCameraToBounds({ x: cx, y: cy }, view, bounds);
    cx = clamped.x; cy = clamped.y;
    svgEl.setAttribute("viewBox", `${cx - view.w / 2} ${cy - view.h / 2} ${view.w} ${view.h}`);

    if (background) {
        const bgGroup = document.createElementNS(svgNS, "g");
        (background.rects || []).forEach(r => {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", r.x); rect.setAttribute("y", r.y);
            rect.setAttribute("width", r.w); rect.setAttribute("height", r.h);
            rect.setAttribute("fill", "#1f2937");
            rect.setAttribute("opacity", r.opacity ?? 0.3);
            bgGroup.appendChild(rect);
        });
        (background.lines || []).forEach(l => {
            // Point de contrôle (cx/cy) optionnel : légèrement courbée façon avenue dessinée à la
            // main plutôt qu'un trait parfaitement rectiligne. Sans lui, reste une simple droite
            // (rétrocompatible avec un appelant générique qui ne fournirait pas de courbure).
            const hasCurve = l.cx !== undefined && l.cy !== undefined;
            const el = document.createElementNS(svgNS, hasCurve ? "path" : "line");
            if (hasCurve) {
                el.setAttribute("d", `M ${l.x1} ${l.y1} Q ${l.cx} ${l.cy} ${l.x2} ${l.y2}`);
                el.setAttribute("fill", "none");
            } else {
                el.setAttribute("x1", l.x1); el.setAttribute("y1", l.y1);
                el.setAttribute("x2", l.x2); el.setAttribute("y2", l.y2);
            }
            el.setAttribute("stroke", "#1f2937");
            el.setAttribute("stroke-width", "3");
            el.setAttribute("opacity", "0.5");
            bgGroup.appendChild(el);
        });
        svgEl.appendChild(bgGroup);
    }

    // Zones cliquables (cercle du nœud + éventuel marqueur de gardien décalé), remplies au fil du
    // rendu ci-dessous : { id, x, y, r } en coordonnées MONDE. En mode pan (onCameraChange fourni),
    // le tap/clic est résolu par distance MONDE à la fin du glissement (voir endDrag()) plutôt que
    // par le `click` natif du navigateur — constaté PEU FIABLE une fois qu'un pointeur a été capturé
    // pendant l'interaction (même relâché ensuite), pas seulement en environnement de test. Sans pan,
    // aucun pointeur n'est jamais capturé : le `click` natif classique reste utilisé directement.
    const clickableRegions = [];
    const handleNodeClick = (id) => { if (onNodeClick) onNodeClick(id); };

    if (onCameraChange) {
        const DRAG_THRESHOLD_PX = 5;
        const HIT_SLACK_PX = 4; // tolérance au-delà du rayon visuel du cercle, confort tactile
        // Caméra "vécue" : `cx`/`cy` restent figés à la position du rendu initial, mais RIEN ne
        // garantit que l'appelant re-rendra entre deux glissements/taps successifs (onCameraChange ne
        // force aucun re-rendu, volontairement — voir plus haut). Sans ce suivi mutable, un DEUXIÈME
        // glissement démarrerait à tort depuis la position du rendu initial plutôt que là où le
        // premier vient de le laisser visuellement (viewBox déjà déplacé en direct).
        let liveCamera = { x: cx, y: cy };
        let drag = null;
        svgEl.style.touchAction = "none"; // évite le scroll tactile pendant le glissement
        svgEl.style.cursor = "grab";
        svgEl.addEventListener('pointerdown', (e) => {
            const rect = svgEl.getBoundingClientRect ? svgEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
            drag = {
                startX: e.clientX, startY: e.clientY, camX: liveCamera.x, camY: liveCamera.y, moved: false, lastCam: { ...liveCamera },
                scaleX: rect.width > 0 ? view.w / rect.width : 1,
                scaleY: rect.height > 0 ? view.h / rect.height : 1,
                rectLeft: rect.left, rectTop: rect.top,
                pointerId: e.pointerId,
            };
            if (svgEl.setPointerCapture) { try { svgEl.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché, sans conséquence */ } }
        });
        svgEl.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dxPx = e.clientX - drag.startX, dyPx = e.clientY - drag.startY;
            if (!drag.moved && Math.hypot(dxPx, dyPx) <= DRAG_THRESHOLD_PX) return;
            drag.moved = true;
            svgEl.style.cursor = "grabbing";
            const liveCam = clampCameraToBounds(
                { x: drag.camX - dxPx * drag.scaleX, y: drag.camY - dyPx * drag.scaleY }, view, bounds
            );
            drag.lastCam = liveCam;
            liveCamera = liveCam;
            svgEl.setAttribute("viewBox", `${liveCam.x - view.w / 2} ${liveCam.y - view.h / 2} ${view.w} ${view.h}`);
        });
        const endDrag = (e) => {
            if (!drag) return;
            if (svgEl.releasePointerCapture && drag.pointerId !== undefined) {
                try { svgEl.releasePointerCapture(drag.pointerId); } catch (err) { /* déjà relâché */ }
            }
            svgEl.style.cursor = "grab";
            if (drag.moved) {
                onCameraChange(drag.lastCam);
            } else if (e && e.type === 'pointerup') {
                // Pas un glissement, et un VRAI relâchement (pas une annulation/sortie de zone) :
                // simple tap/clic — retrouve le nœud le plus proche du point relâché, en coordonnées
                // MONDE (caméra inchangée puisque non déplacée cette fois).
                const worldX = (drag.camX - view.w / 2) + (e.clientX - drag.rectLeft) * drag.scaleX;
                const worldY = (drag.camY - view.h / 2) + (e.clientY - drag.rectTop) * drag.scaleY;
                let best = null, bestDist = Infinity;
                clickableRegions.forEach(region => {
                    const d = Math.hypot(region.x - worldX, region.y - worldY);
                    if (d <= region.r + HIT_SLACK_PX && d < bestDist) { best = region; bestDist = d; }
                });
                if (best) handleNodeClick(best.id);
            }
            drag = null;
        };
        svgEl.addEventListener('pointerup', endDrag);
        svgEl.addEventListener('pointercancel', endDrag);
        svgEl.addEventListener('pointerleave', endDrag);
    }

    const edgesGroup = document.createElementNS(svgNS, "g");
    edges.forEach(e => {
        const from = positions[e.from], to = positions[e.to];
        if (!from || !to) return;
        const a = from, b = to;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
        line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
        line.setAttribute("stroke", "#374151");
        line.setAttribute("stroke-width", "1.5");
        edgesGroup.appendChild(line);

        if (e.distance !== undefined && (e.from === currentId || e.to === currentId)) {
            const mid = document.createElementNS(svgNS, "text");
            mid.setAttribute("x", (a.x + b.x) / 2);
            mid.setAttribute("y", (a.y + b.y) / 2);
            mid.setAttribute("text-anchor", "middle");
            mid.setAttribute("font-size", "7");
            mid.setAttribute("fill", "#60a5fa");
            mid.textContent = e.distance;
            edgesGroup.appendChild(mid);
        }

        // Marqueur d'arête (ex : repaire) : n'appartient à AUCUN des deux nœuds, rendu au milieu de
        // la route elle-même — léger décalage vertical pour ne pas chevaucher le chiffre de distance.
        if (e.marker) {
            const markerColors = GRAPH_MINIMAP_VARIANT_COLORS[e.marker.variant || 'default'];
            const markerG = document.createElementNS(svgNS, "g");
            markerG.setAttribute("transform", `translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 + 11})`);
            const markerCircle = document.createElementNS(svgNS, "circle");
            markerCircle.setAttribute("r", "8");
            markerCircle.setAttribute("fill", "#111827");
            markerCircle.setAttribute("stroke", markerColors.stroke);
            markerCircle.setAttribute("stroke-width", "1.5");
            markerG.appendChild(markerCircle);
            const markerIcon = document.createElementNS(svgNS, "text");
            markerIcon.setAttribute("text-anchor", "middle");
            markerIcon.setAttribute("dominant-baseline", "central");
            markerIcon.setAttribute("font-size", "9");
            markerIcon.textContent = e.marker.icon;
            markerG.appendChild(markerIcon);
            edgesGroup.appendChild(markerG);
        }
    });

    const nodesGroup = document.createElementNS(svgNS, "g");
    nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        const p = pos;
        const isCurrent = node.id === currentId;
        // La ville elle-même reste "normale" (couleur par défaut) même gardée : c'est le marqueur à
        // part (voir plus bas) qui porte la couleur guarded/goal, posté sur la route plutôt que
        // confondu avec la ville.
        const colors = GRAPH_MINIMAP_VARIANT_COLORS[isCurrent ? 'current' : 'default'];

        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);
        g.setAttribute("data-node-id", node.id); // Repère fiable pour retrouver ce nœud (tests, debug)
        if (!isCurrent) {
            g.style.cursor = "pointer";
            if (onCameraChange) {
                clickableRegions.push({ id: node.id, x: p.x, y: p.y, r: 10 });
            } else {
                g.addEventListener('click', () => handleNodeClick(node.id));
            }
        }

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("r", isCurrent ? "13" : "10");
        circle.setAttribute("fill", colors.fill);
        circle.setAttribute("stroke", colors.stroke);
        circle.setAttribute("stroke-width", isCurrent ? "2.5" : "1.5");
        g.appendChild(circle);

        if (node.icon) {
            const iconText = document.createElementNS(svgNS, "text");
            iconText.setAttribute("text-anchor", "middle");
            iconText.setAttribute("dominant-baseline", "central");
            iconText.setAttribute("font-size", isCurrent ? "13" : "10");
            iconText.textContent = node.icon;
            g.appendChild(iconText);
        }

        if (node.label) {
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("y", isCurrent ? "24" : "20");
            label.setAttribute("font-size", "7");
            label.setAttribute("fill", "#9ca3af");
            label.textContent = node.label.length > 12 ? node.label.slice(0, 11) + "…" : node.label;
            g.appendChild(label);
        }

        // Badge de rôle (marchand/professeur...) : accolé au cercle du nœud lui-même, jamais décalé
        // sur une arête (contrairement à goalIcon) puisqu'il ne bloque rien.
        if (node.badge) {
            const badgeOffset = (isCurrent ? 13 : 10) * 0.75;
            const badge = document.createElementNS(svgNS, "g");
            badge.setAttribute("transform", `translate(${badgeOffset}, ${badgeOffset})`);
            const badgeCircle = document.createElementNS(svgNS, "circle");
            badgeCircle.setAttribute("r", "6");
            badgeCircle.setAttribute("fill", "#111827");
            badgeCircle.setAttribute("stroke", "#fbbf24");
            badgeCircle.setAttribute("stroke-width", "1.2");
            badge.appendChild(badgeCircle);
            const badgeIcon = document.createElementNS(svgNS, "text");
            badgeIcon.setAttribute("text-anchor", "middle");
            badgeIcon.setAttribute("dominant-baseline", "central");
            badgeIcon.setAttribute("font-size", "7");
            badgeIcon.textContent = node.badge;
            badge.appendChild(badgeIcon);
            g.appendChild(badge);
        }

        nodesGroup.appendChild(g);

        // Marqueur de gardien : décalé d'une distance FIXE en pixels (pas un pourcentage du chemin —
        // une route courte collerait sinon le marqueur contre le cercle de la ville) en direction
        // d'un voisin, sur SA route d'accès plutôt que confondu avec le cercle de la ville — "posté
        // sur la route". Couleur guarded/goal portée ici, jamais par la ville elle-même (voir plus haut).
        if (node.goalIcon) {
            const MARKER_OFFSET_PX = 20;
            const neighborEdge = edges.find(e => e.from === node.id || e.to === node.id);
            const neighborId = neighborEdge && (neighborEdge.from === node.id ? neighborEdge.to : neighborEdge.from);
            const neighborPos = neighborId && positions[neighborId];
            let markerPos = p;
            if (neighborPos) {
                const dx = p.x - neighborPos.x, dy = p.y - neighborPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                markerPos = { x: p.x - (dx / dist) * MARKER_OFFSET_PX, y: p.y - (dy / dist) * MARKER_OFFSET_PX };
            }
            const markerColors = GRAPH_MINIMAP_VARIANT_COLORS[node.variant || 'default'];

            const marker = document.createElementNS(svgNS, "g");
            marker.setAttribute("transform", `translate(${markerPos.x}, ${markerPos.y})`);
            if (!isCurrent) {
                marker.style.cursor = "pointer";
                if (onCameraChange) {
                    clickableRegions.push({ id: node.id, x: markerPos.x, y: markerPos.y, r: 8 });
                } else {
                    marker.addEventListener('click', () => handleNodeClick(node.id));
                }
            }
            const markerCircle = document.createElementNS(svgNS, "circle");
            markerCircle.setAttribute("r", "8");
            markerCircle.setAttribute("fill", "#111827");
            markerCircle.setAttribute("stroke", markerColors.stroke);
            markerCircle.setAttribute("stroke-width", "1.5");
            marker.appendChild(markerCircle);
            const markerIcon = document.createElementNS(svgNS, "text");
            markerIcon.setAttribute("text-anchor", "middle");
            markerIcon.setAttribute("dominant-baseline", "central");
            markerIcon.setAttribute("font-size", "9");
            markerIcon.textContent = node.goalIcon;
            marker.appendChild(markerIcon);
            nodesGroup.appendChild(marker);
        }
    });

    svgEl.appendChild(edgesGroup);
    svgEl.appendChild(nodesGroup);
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

// Grille logique (gx, gy entiers) : chaque ville occupe une cellule, deux villes ne peuvent être
// reliées que si elles sont ADJACENTES sur la grille (8 directions : N/S/E/O + diagonales) — plus de
// connexion longue distance façon étoile. GRID_CELL (unités "monde", voir renderGraphMiniMap()) fixe
// l'espacement visuel entre deux cellules voisines.
const URBAN_GRID_CELL = 70;
const URBAN_GRID_NEIGHBOR_OFFSETS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1]
];

// Choisit `cityCount` cellules de grille formant une région CONNEXE par construction : croissance
// aléatoire depuis une cellule de départ, chaque nouvelle cellule tirée adjacente à une cellule déjà
// choisie (jamais de cellule isolée à relier après coup). Remplace l'ancien tirage dans un gabarit de
// points fixes + arbre couvrant aléatoire — la connexité n'a plus besoin d'être "réparée", elle
// découle directement de la façon dont la région est construite.
function generateConnectedCityGrid(cityCount) {
    const chosen = [{ gx: 0, gy: 0 }];
    const chosenKeys = new Set(['0,0']);

    while (chosen.length < cityCount) {
        // Cellules candidates : tout voisin libre d'une cellule déjà choisie. Reconstruit à chaque
        // itération (petits nombres ici, 6-9 villes) plutôt que maintenu incrémentalement — plus
        // simple à lire, coût négligeable.
        const candidates = [];
        chosen.forEach(cell => {
            URBAN_GRID_NEIGHBOR_OFFSETS.forEach(([dx, dy]) => {
                const gx = cell.gx + dx, gy = cell.gy + dy;
                const key = `${gx},${gy}`;
                if (!chosenKeys.has(key)) candidates.push({ gx, gy, key });
            });
        });
        // Cas limite en théorie impossible pour ce nombre de villes (une région connexe sur une
        // grille 8-directions a toujours une cellule libre adjacente), mais on ne boucle jamais à
        // l'infini si ça arrivait malgré tout.
        if (candidates.length === 0) break;

        const pickedIndex = Math.floor(Math.random() * candidates.length);
        const picked = candidates[pickedIndex];
        chosen.push({ gx: picked.gx, gy: picked.gy });
        chosenKeys.add(picked.key);
    }
    return chosen;
}

// Toutes les paires de cellules adjacentes (8 directions) parmi celles choisies — devient les routes
// du réseau. Une région issue de generateConnectedCityGrid() a presque toujours PLUS d'arêtes qu'un
// arbre couvrant (plusieurs cellules choisies se touchent sans être "parent/enfant" dans la
// croissance) : plusieurs itinéraires possibles ressortent naturellement, sans étape de bouclage
// séparée comme l'ancienne génération.
function computeGridAdjacencyPairs(cells) {
    const pairs = [];
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            const dx = Math.abs(cells[i].gx - cells[j].gx);
            const dy = Math.abs(cells[i].gy - cells[j].gy);
            if (dx <= 1 && dy <= 1) pairs.push([i, j]);
        }
    }
    return pairs;
}

// ==========================================
// DÉCLUTTER ANTI-CHEVAUCHEMENT (générique, réutilisable comme computeGraphLayout() ci-dessus, mais
// pour un usage différent : PAS un layout calculé depuis rien, une petite correction déterministe
// d'un layout déjà bon (ici la grille) pour écarter les points trop proches sans le déformer).
// ==========================================

// Écarte les points d'un layout déjà posé (ex : positions de grille) qui se retrouveraient trop
// proches les uns des autres — répulsion PURE (aucun ressort, aucune attraction centrale,
// contrairement à computeGraphLayout()), déplacement total plafonné à `maxShift` depuis la position
// de départ de chaque point pour ne jamais dénaturer la disposition logique sous-jacente. Aucun
// Math.random() : entièrement déterministe, même entrée → même sortie, itérations pures — un rendu
// répété des mêmes données donne toujours EXACTEMENT le même résultat (calculé une seule fois à la
// génération, voir generateUrbanFloorMap()).
function computeDeclutterLayout(basePositions, ids, { minDist = 48, iterations = 50, maxShift = 40 } = {}) {
    const positions = {};
    const totalShift = {};
    ids.forEach(id => {
        positions[id] = { x: basePositions[id].x, y: basePositions[id].y };
        totalShift[id] = 0;
    });

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = ids[i], b = ids[j];
                let dx = positions[a].x - positions[b].x;
                let dy = positions[a].y - positions[b].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                if (dist >= minDist) continue;

                const overlap = (minDist - dist) / 2;
                dx /= dist; dy /= dist;

                // Chaque point ne bouge que si son budget maxShift le permet encore — un point déjà
                // au bout de son budget reste immobile plutôt que de continuer à s'écarter sans fin.
                if (totalShift[a] < maxShift) {
                    const move = Math.min(overlap, maxShift - totalShift[a]);
                    positions[a].x += dx * move; positions[a].y += dy * move;
                    totalShift[a] += move;
                }
                if (totalShift[b] < maxShift) {
                    const move = Math.min(overlap, maxShift - totalShift[b]);
                    positions[b].x -= dx * move; positions[b].y -= dy * move;
                    totalShift[b] += move;
                }
            }
        }
    }
    return positions;
}

// PRNG déterministe minimal (mulberry32) : sert UNIQUEMENT à générer le fond de carte décoratif
// (voir URBAN_MAP_BACKGROUND) toujours avec le même résultat — jamais Math.random() ici, sans quoi
// le fond "sauterait" à chaque rafraîchissement au lieu de rester la texture fixe d'une seule et
// même grande ville.
function mulberry32(seed) {
    let a = seed;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Étendue fixe (unités monde) du fond décoratif — généreuse par rapport à l'étalement réel d'une
// région de villes (8 cellules maximum, voir cityCount) pour qu'un pan un peu large révèle toujours
// encore de la ville plutôt que du vide, sans dépendre de la carte effectivement générée cette partie
// (voir URBAN_MAP_BACKGROUND ci-dessous : toujours la même, quelle que soit la sélection de villes).
const URBAN_MAP_WORLD_EXTENT = URBAN_GRID_CELL * 6;

// Fond de carte décoratif "grande ville" (pâtés de maisons + quelques avenues), générique en soi
// (voir renderGraphMiniMap() : un simple bloc de rectangles/lignes en coordonnées MONDE, sans
// connaissance du jeu) mais calculé UNE FOIS ici avec un seed fixe pour rester rigoureusement
// identique d'une partie à l'autre — la même ville, seuls les quartiers accessibles diffèrent. En
// unités monde directement (plus de 0..1 normalisé, voir renderGraphMiniMap()) pour couvrir toute
// l'étendue pannable, centré sur l'origine (0,0) comme la grille logique des villes.
const URBAN_MAP_BACKGROUND = (() => {
    const rand = mulberry32(20260923);
    const rects = [];
    // Densité variable plutôt qu'un tirage uniforme : rayon biaisé vers le centre (exposant > 1)
    // pour un cœur de ville dense qui se clairsème vers la périphérie, plus crédible qu'une
    // répartition parfaitement homogène des pâtés de maisons.
    for (let i = 0; i < 320; i++) {
        const angle = rand() * Math.PI * 2;
        const radius = Math.pow(rand(), 1.7) * URBAN_MAP_WORLD_EXTENT;
        const cx = Math.cos(angle) * radius;
        const cy = Math.sin(angle) * radius;
        const w = URBAN_GRID_CELL * (0.08 + rand() * 0.14);
        const h = URBAN_GRID_CELL * (0.08 + rand() * 0.14);
        rects.push({ x: cx - w / 2, y: cy - h / 2, w, h, opacity: 0.2 + rand() * 0.35 });
    }
    // Quelques grandes avenues traversantes, légèrement courbées (point de contrôle décalé
    // perpendiculairement) pour casser la rigidité de lignes parfaitement droites — voir le rendu
    // avec point de contrôle dans renderGraphMiniMap().
    const lines = [];
    for (let i = 0; i < 8; i++) {
        const horizontal = i % 2 === 0;
        const at = (rand() * 2 - 1) * URBAN_MAP_WORLD_EXTENT;
        const bow = (rand() - 0.5) * URBAN_GRID_CELL * 1.5;
        lines.push(horizontal
            ? { x1: -URBAN_MAP_WORLD_EXTENT, y1: at, x2: URBAN_MAP_WORLD_EXTENT, y2: at, cx: 0, cy: at + bow }
            : { x1: at, y1: -URBAN_MAP_WORLD_EXTENT, x2: at, y2: URBAN_MAP_WORLD_EXTENT, cx: at + bow, cy: 0 });
    }
    return { rects, lines };
})();

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

// Génère le réseau villes/routes d'un étage urbain : une région de grille connexe (voir
// generateConnectedCityGrid()) — connexité garantie par construction, aucune réparation après coup —
// avec une route entre chaque paire de cellules adjacentes (8 directions). Une ville (autre que
// celle de départ) porte l'escalier — ou la Sortie à l'étage final (config.urbanFloors.finalFloor) —
// potentiellement gardée par un boss du thème unique de l'étage.
function generateUrbanFloorMap() {
    const floor = gameState.currentFloor;
    const isFinal = floor === config.urbanFloors.finalFloor;
    const theme = config.urbanFloors.themes[floor] || config.urbanFloors.themes[3];

    const cityCount = 6 + Math.floor(floor / 9); // Légère croissance avec la profondeur
    const namePool = [...URBAN_CITY_NAMES];

    // Région de grille CONNEXE par construction (voir generateConnectedCityGrid()) : plus de tirage
    // dans un gabarit de points fixes + arbre couvrant, la connexité découle directement de la façon
    // dont les cellules sont choisies. cells[0] devient toujours la ville de départ.
    const cells = generateConnectedCityGrid(cityCount);
    const citiesById = {};
    const cityIds = [];
    const basePositions = {};
    cells.forEach((cell, i) => {
        const id = `city-${i}`;
        const nameIndex = Math.floor(Math.random() * namePool.length);
        const name = namePool.splice(nameIndex, 1)[0] || `Secteur ${i + 1}`;
        basePositions[id] = { x: cell.gx * URBAN_GRID_CELL, y: cell.gy * URBAN_GRID_CELL };
        citiesById[id] = {
            id, name, gx: cell.gx, gy: cell.gy, x: 0, y: 0, // x/y (affichage) posés après déclutter, voir plus bas
            visited: false, known: false, roads: [],
            isStairs: false, isExit: false, guarded: false, bossInstance: null, defeated: false,
            // Ville spécialisée (marchand/professeur) : voir plus bas dans cette fonction et
            // triggerShopEncounter(). `stock` (marchand uniquement) est généré une seule fois, à la
            // première visite, pour rester le même si le joueur repart puis revient.
            role: null, specialty: null, stock: null
        };
        cityIds.push(id);
    });

    // Position d'AFFICHAGE (voir CLAUDE.md, section Carte Urbaine) : la grille logique (gx/gy,
    // gameplay — adjacence, jamais modifiée) sert de point de départ à computeDeclutterLayout(), qui
    // écarte les points trop proches une seule fois ici, avant de figer city.x/y pour de bon (jamais
    // recalculés ensuite). minDist (50) reste sous l'espacement minimal déjà garanti par la grille
    // (70, une cellule) : sur une pure grille cette passe est un no-op, elle ne sert que si une
    // future évolution de la génération rapprochait un jour deux villes davantage.
    const displayPositions = computeDeclutterLayout(basePositions, cityIds, { minDist: 50, iterations: 50, maxShift: 40 });
    cityIds.forEach(id => {
        citiesById[id].x = displayPositions[id].x;
        citiesById[id].y = displayPositions[id].y;
    });

    // Routes = toutes les paires de cellules ADJACENTES (8 directions) parmi celles choisies — pas
    // de connexion longue distance façon étoile, et presque toujours plus d'un chemin possible entre
    // deux villes (plusieurs cellules voisines se touchent sans lien de parenté direct dans la
    // croissance de la région).
    computeGridAdjacencyPairs(cells).forEach(([i, j]) => {
        addCityRoad(citiesById, cityIds[i], cityIds[j]);
    });

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

    // Villes spécialisées (marchand/professeur) : chaque ville normale (jamais le départ, jamais
    // l'escalier/la Sortie — pour ne pas cumuler un gardien ET un PNJ sur la même ville) a une
    // chance de devenir un point de vente ou de formation. Le marchand vend une catégorie d'objet
    // (voir generateShopStock()) ; le professeur forme UNE des 4 compétences réelles du joueur
    // (gameState.skills) — pas de "compétence armure", contrairement aux objets.
    candidateIds.filter(id => id !== target.id).forEach(id => {
        if (Math.random() * 100 >= config.urbanFloors.specializedCityChance) return;
        const city = citiesById[id];
        if (Math.random() < 0.5) {
            city.role = 'merchant';
            city.specialty = pick(['weapons', 'ranged', 'armors', 'scrolls']);
        } else {
            city.role = 'trainer';
            city.specialty = pick(['weapon', 'unarmed', 'magic', 'stealth']);
        }
    });

    // Repaires sur les routes : quelques routes (voir config.urbanFloors.lairRoadsPerFloor/
    // lairRoadsFinalFloor) sont désignées "repaire" — plonger dedans (triggerLairChoice()/
    // diveIntoLair() dans travelToCity()) enchaîne plusieurs combats forcés puis un boss du thème de
    // l'étage, contre un butin garanti ; le joueur peut toujours poursuivre sa route sans l'affronter.
    // isLair/lairId sont posés sur LES DEUX sens de la route (comme distance), pour rester
    // détectables quel que soit le sens du trajet emprunté.
    const allRoadPairs = [];
    const seenRoadPairs = new Set();
    cityIds.forEach(id => {
        citiesById[id].roads.forEach(road => {
            const key = [id, road.to].sort().join('|');
            if (seenRoadPairs.has(key)) return;
            seenRoadPairs.add(key);
            allRoadPairs.push({ aId: id, bId: road.to });
        });
    });
    const lairCount = Math.min(
        isFinal ? config.urbanFloors.lairRoadsFinalFloor : config.urbanFloors.lairRoadsPerFloor,
        allRoadPairs.length
    );
    const lairsById = {};
    for (let i = 0; i < lairCount; i++) {
        const pairIndex = Math.floor(Math.random() * allRoadPairs.length);
        const pair = allRoadPairs.splice(pairIndex, 1)[0];
        const lairId = `lair-${i}`;
        lairsById[lairId] = {
            id: lairId,
            cityAId: pair.aId,
            cityBId: pair.bId,
            cleared: false,
            combatsRemaining: 2 + Math.floor(Math.random() * 2), // 2 ou 3 combats forcés avant le boss
            bossInstance: null
        };
        const roadAtoB = citiesById[pair.aId].roads.find(r => r.to === pair.bId);
        const roadBtoA = citiesById[pair.bId].roads.find(r => r.to === pair.aId);
        if (roadAtoB) { roadAtoB.isLair = true; roadAtoB.lairId = lairId; }
        if (roadBtoA) { roadBtoA.isLair = true; roadBtoA.lairId = lairId; }
    }

    // camera : null = caméra auto-centrée sur la ville courante (voir updateUrbanMapUI()) ; posé
    // explicitement à la génération pour que le tout premier rendu de l'étage parte bien de là.
    gameState.urbanMap = { theme, isFinalFloor: isFinal, citiesById, currentCityId: startId, lairsById, camera: null };
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

    // Repaire sur la route directement empruntée (voir generateUrbanFloorMap()) : présente le choix
    // plonger/poursuivre AVANT de résoudre les embuscades normales du trajet — un trajet à plusieurs
    // sauts vers une ville plus lointaine ne passe pas physiquement par cette route précise, donc ne
    // déclenche rien ici (voir computeCityDistance(), qui ne suit aucun chemin réel).
    const directRoad = urbanMap.citiesById[urbanMap.currentCityId].roads.find(r => r.to === cityId);
    const lair = directRoad && directRoad.isLair ? urbanMap.lairsById[directRoad.lairId] : null;
    if (lair && !lair.cleared) {
        triggerLairChoice(lair);
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
    urbanMap.camera = null; // La caméra "suit" de nouveau la ville courante après un trajet (voir updateUrbanMapUI())
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
            triggerFloorTransition();
        }
        return;
    }

    if (city.role) {
        triggerShopEncounter(city);
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

// ==========================================
// REPAIRES SUR LES ROUTES (voir generateUrbanFloorMap())
// ==========================================

// Présente le choix "plonger / poursuivre" pour un repaire repéré sur la route directement
// empruntée — dispatché depuis travelToCity(). Toujours optionnel : poursuivre reprend le trajet
// normalement (embuscades incluses), sans aucune pénalité pour avoir décliné.
function triggerLairChoice(lair) {
    gameState.lairChoicePending = true;
    gameState.pendingLairId = lair.id;
    setCardHeader('💀', 'Repaire Repéré', 'Route Urbaine');
    logEvent("Un repaire hostile borde la route. Plonger dedans (combats enchaînés, butin garanti), ou poursuivre votre chemin sans l'affronter ?", "danger");
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
    const lair = gameState.urbanMap.lairsById[lairId];
    if (!lair) return;

    gameState.pendingLairDive = { lairId, combatsLeft: lair.combatsRemaining, stage: 'trash' };
    logEvent("Vous plongez dans le repaire...", "danger");
    initiateCombat();
}

// Bouton "Poursuivre" : le repaire reste intact (re-proposé à un futur trajet sur cette même route),
// le trajet interrompu reprend normalement.
function declineLair() {
    gameState.lairChoicePending = false;
    gameState.pendingLairId = null;
    ui.lairChoiceZone.classList.add('hidden');
    logEvent("Vous laissez le repaire tranquille et poursuivez votre route.", "info");
    triggerNextCityAmbushOrArrive();
}

// ==========================================
// VILLES SPÉCIALISÉES (marchand/professeur — voir generateUrbanFloorMap())
// ==========================================
const SHOP_CATEGORY_LABELS = { weapons: "Armes", ranged: "Armes à distance", armors: "Armures", scrolls: "Magie (parchemins)" };
const SHOP_MARKUP = 2.5; // Prix d'achat = baseValue × ce multiplicateur (voir SELL_VALUE_RATIO pour l'inverse)
const TRAINER_COST_PER_LEVEL = 20; // Coût = ce montant × le niveau ACTUEL de la compétence

// Stock FIXE d'un marchand (3 objets de sa spécialité, générés UNE seule fois à la première visite —
// voir triggerShopEncounter()), avec une puissance proportionnelle à l'étage courant comme le reste
// du loot (voir getLootPowerScore()). Chaque objet reçoit un prix d'achat dérivé de sa baseValue.
function generateShopStock(specialty) {
    const stock = [];
    // ECONOMIE_AUSTERE (anomalies.js) : remise fixe sur le prix d'achat, appliquée une fois à la
    // génération du stock (jamais régénéré, voir commentaire ci-dessus) — cohérent avec le fait que le
    // stock appartient à l'anomalie de CET étage précis.
    const discount = 1 - (gameState.anomalyEffects.shopDiscountPct || 0);
    for (let i = 0; i < 3; i++) {
        const item = generateItem(getLootPowerScore(null), specialty);
        item.price = Math.max(1, Math.round((item.baseValue || 1) * SHOP_MARKUP * discount));
        stock.push(item);
    }
    return stock;
}

// Présente l'écran marchand/professeur d'une ville spécialisée — dispatché depuis arriveAtCity().
// Bloque les autres actions (isActionBlocked()) le temps de la visite, comme un choix de boss ou de
// furtivité, pour que la Carte Urbaine se masque et laisse place à cet écran (voir updateUI()).
function triggerShopEncounter(city) {
    if (city.role === 'merchant' && !city.stock) {
        city.stock = generateShopStock(city.specialty);
    }
    gameState.shopChoicePending = true;
    gameState.pendingShopCityId = city.id;
    const isMerchant = city.role === 'merchant';

    setCardHeader(isMerchant ? '🛒' : '🎓', city.name, isMerchant ? 'Marchand' : 'Professeur');
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
    const city = gameState.urbanMap.citiesById[gameState.pendingShopCityId];
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
    updateUI();
    updateShopUI();
}

// Paie pour gagner directement assez d'XP afin de franchir le prochain niveau de la compétence
// spécialisée du professeur — "payer pour s'entraîner" plutôt que le grind combat habituel.
function trainSkill() {
    if (!gameState.pendingShopCityId) return;
    const city = gameState.urbanMap.citiesById[gameState.pendingShopCityId];
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
    gameState.shopChoicePending = false;
    gameState.pendingShopCityId = null;
    ui.shopZone.classList.add('hidden');
    updateUI();
}

// Reconstruit le contenu dynamique de l'écran marchand/professeur (stock/prix, ou compétence à
// former) selon le rôle de la ville actuellement visitée — n'affiche rien si aucune n'est en cours.
function updateShopUI() {
    if (!ui.shopZone || !gameState.pendingShopCityId || !gameState.urbanMap) return;
    const city = gameState.urbanMap.citiesById[gameState.pendingShopCityId];
    if (!city) return;

    const isMerchant = city.role === 'merchant';
    ui.shopMerchantContent.classList.toggle('hidden', !isMerchant);
    ui.shopMerchantContent.classList.toggle('flex', isMerchant);
    ui.shopTrainerContent.classList.toggle('hidden', isMerchant);
    ui.shopTrainerContent.classList.toggle('flex', !isMerchant);

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
            row.disabled = !affordable;
            row.innerHTML = `<span class="truncate">${formatItemDisplayName(item)}</span><span class="text-yellow-400 shrink-0">${item.price} PO</span>`;
            row.addEventListener('click', () => buyShopItem(index));
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
            const price = Math.max(1, Math.round((item.baseValue || 0) * SELL_VALUE_RATIO));
            const row = document.createElement('button');
            row.className = "w-full flex justify-between items-center gap-1 px-2 py-1.5 bg-gray-900/80 border border-gray-800 rounded text-[10px] text-gray-300 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all cursor-pointer";
            row.innerHTML = `<span class="truncate">${formatItemDisplayName(item)}</span><span class="text-emerald-400 shrink-0">+${price} PO</span>`;
            row.addEventListener('click', () => { sellItem(index); updateShopUI(); });
            ui.shopSellList.appendChild(row);
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

// Reconstruit le panneau "Carte Urbaine" : liste des villes connues, avec leur statut (ici / gardée /
// escalier / Sortie) et un bouton pour s'y rendre — même esprit que updateKnownLocationsUI(), mais
// pour le réseau villes/routes plutôt que les lieux connus classiques d'un donjon.
// Adapte le réseau villes/routes courant au format générique nœuds/arêtes attendu par
// computeGraphLayout()/renderGraphMiniMap() : seule fonction qui connaît la forme des données du
// jeu dans tout ce sous-système, tout le reste (disposition, rendu) est réutilisable tel quel.
function buildUrbanMapGraphData(urbanMap) {
    const knownCities = Object.values(urbanMap.citiesById).filter(c => c.known);
    const knownIds = new Set(knownCities.map(c => c.id));

    const positions = {};
    // `icon` reste générique (toujours 🏙️, un quartier normal) : le marqueur de gardien
    // (`goalIcon`) est rendu à PART par renderGraphMiniMap(), décalé sur la route d'accès plutôt que
    // dans le cercle de la ville elle-même — "les boss sont positionnés à côté des routes". Un rôle
    // marchand/professeur, lui, ne bloque rien : simple `badge` accolé au cercle de la ville.
    const nodes = knownCities.map(city => {
        positions[city.id] = { x: city.x, y: city.y };
        let variant = 'default', goalIcon = null;
        if (city.isStairs || city.isExit) {
            if (city.guarded && !city.defeated) {
                variant = 'guarded'; goalIcon = '👑';
            } else {
                variant = 'goal'; goalIcon = city.isExit ? '🚪' : '🪜';
            }
        }
        const badge = city.role === 'merchant' ? '🛒' : (city.role === 'trainer' ? '🎓' : null);
        return { id: city.id, label: city.name, icon: '🏙️', variant, goalIcon, badge };
    });

    // Une arête par route reliant deux villes CONNUES (pas de brouillard sur les routes déjà
    // révélées, mais rien à dessiner vers une ville pas encore repérée). Une route "repaire" (voir
    // generateUrbanFloorMap()) porte un marqueur dédié (edges[].marker) : rouge/💀 tant qu'elle n'est
    // pas nettoyée, gris/🏆 une fois vaincue — ni l'un ni l'autre n'est un goalIcon (une route reste
    // franchissable, contrairement à un gardien qui bloque le passage).
    const edges = [];
    const seenPairs = new Set();
    knownCities.forEach(city => {
        city.roads.forEach(road => {
            if (!knownIds.has(road.to)) return;
            const key = [city.id, road.to].sort().join('|');
            if (seenPairs.has(key)) return;
            seenPairs.add(key);
            const edge = { from: city.id, to: road.to, distance: road.distance };
            if (road.isLair) {
                const lair = urbanMap.lairsById[road.lairId];
                edge.marker = lair.cleared
                    ? { icon: '🏆', variant: 'default' }
                    : { icon: '💀', variant: 'guarded' };
            }
            edges.push(edge);
        });
    });

    return { nodes, edges, positions };
}

// Fenêtre affichée par la Carte Urbaine (unités monde, voir URBAN_GRID_CELL) — de l'ordre de 3
// cellules de large, pour toujours voir la ville courante ET ses voisines immédiates d'un coup d'œil.
const URBAN_MAP_VIEW_SIZE = { w: 230, h: 260 };

// Reconstruit la Carte Urbaine : positions déjà figées à la génération (voir generateUrbanFloorMap()/
// computeDeclutterLayout()), buildUrbanMapGraphData() les lit directement sur chaque ville ; dessine
// (renderGraphMiniMap()) le réseau de villes connues sous forme de mini-carte graphique pannable. Un
// clic sur une ville connue (directement reliée ou non : travelToCity() calcule lui-même le trajet le
// plus court) déclenche le voyage — sauf s'il suit un glissement de la carte (voir renderGraphMiniMap()).
// gameState.urbanMap.camera : `null` = caméra auto-centrée sur la ville courante (comportement par
// défaut, y compris juste après un trajet — voir arriveAtCity()) ; un objet {x,y} = position choisie
// par le joueur en faisant glisser la carte (onCameraChange ci-dessous), qui prend le dessus jusqu'au
// prochain trajet ou clic sur "Recentrer" (voir recenterUrbanMap()).
function updateUrbanMapUI() {
    if (!ui.urbanMapSvg) return;
    const urbanMap = gameState.urbanMap;
    if (!urbanMap) { ui.urbanMapSvg.innerHTML = ""; return; }

    const { nodes, edges, positions } = buildUrbanMapGraphData(urbanMap);
    // Marge >= la moitié du plus grand côté de la fenêtre affichée (voir URBAN_MAP_VIEW_SIZE) : sans
    // ça, une ville de bord de zone connue (typiquement la ville de départ, tout juste après
    // l'arrivée sur l'étage) ne pourrait jamais être parfaitement centrée, le clamping la tirerait
    // systématiquement vers l'intérieur (voir clampCameraToBounds()) — un peu de marge en plus (une
    // demi-cellule) pour pouvoir aussi regarder légèrement au-delà.
    const worldBoundsMargin = Math.max(URBAN_MAP_VIEW_SIZE.w, URBAN_MAP_VIEW_SIZE.h) / 2 + URBAN_GRID_CELL * 0.5;
    const worldBounds = computeDefaultWorldBounds(positions, worldBoundsMargin);

    renderGraphMiniMap(ui.urbanMapSvg, {
        nodes, edges, positions, currentId: urbanMap.currentCityId,
        onNodeClick: (cityId) => travelToCity(cityId),
        camera: urbanMap.camera || null,
        viewSize: URBAN_MAP_VIEW_SIZE,
        worldBounds,
        onCameraChange: (newCamera) => { gameState.urbanMap.camera = newCamera; },
        background: URBAN_MAP_BACKGROUND,
    });
}

// Bouton "Recentrer" de la Carte Urbaine : efface l'éventuelle position choisie par le joueur en
// faisant glisser la carte, pour que la caméra revienne se centrer sur la ville courante (voir
// gameState.urbanMap.camera/updateUrbanMapUI()).
function recenterUrbanMap() {
    if (!gameState.urbanMap) return;
    gameState.urbanMap.camera = null;
    updateUrbanMapUI();
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
        // Soin COMPLET (PV + mana si un sort est équipé), en contrepartie de la régénération passive
        // dégressive (voir HP_REGEN_TIERS) : une salle sécurisée reste le seul moyen fiable de
        // repartir plein PV/mana, mais le séjour coûte du temps proportionnel à ce qui est
        // effectivement régénéré — jamais de double comptage avec applyTimeElapsedRegen() sur ce
        // temps-là, on fixe directement PV/mana au maximum.
        const safehouse = room.safehouse || { name: "Salle Sécurisée", icon: "🏥", desc: "" };
        const hasSpell = !!gameState.equipment.spell;
        const missingHp = gameState.maxHp - gameState.hp;
        const missingMana = hasSpell ? (gameState.maxMana - gameState.mana) : 0;
        // REPAS_DE_FAMILLE (anomalies.js) : le séjour devient gratuit en temps — restCost reste
        // calculé pour le message de log, simplement pas déduit de gameState.timeLeft plus bas.
        const freeMeals = gameState.anomalyEffects.freeSafehouseMeals;
        const restCost = Math.ceil(missingHp / 10) + Math.ceil(missingMana / 12);

        applyPlayerHeal(missingHp); // Toujours clampé à gameState.maxHp, quel que soit healingMult
        if (hasSpell) gameState.mana = gameState.maxMana;

        setCardHeader(safehouse.icon, safehouse.name, 'Repos');
        if (restCost > 0) {
            if (!freeMeals) gameState.timeLeft = Math.max(0, gameState.timeLeft - restCost);
            const restored = hasSpell ? "PV et mana entièrement restaurés" : "PV entièrement restaurés";
            const costNote = freeMeals ? "repas offerts par la maison, aucun temps perdu" : `-${restCost}H`;
            logEvent(
                firstVisit
                    ? `Vous découvrez : ${safehouse.name}. ${safehouse.desc} Vous vous reposez longuement, ${restored} (${costNote}).`
                    : `Vous retrouvez ${safehouse.name} et vous reposez à nouveau, ${restored} (${costNote}).`,
                "success"
            );
        } else {
            logEvent(
                firstVisit
                    ? `Vous découvrez : ${safehouse.name}. ${safehouse.desc} Vous êtes déjà en pleine forme.`
                    : `Vous retrouvez ${safehouse.name}, toujours aussi accueillant.`,
                "success"
            );
        }
        registerKnownLocation({ id: `safe-${room.id}`, type: 'safeRoom', roomId: room.id, label: safehouse.name, icon: safehouse.icon });

        if (gameState.timeLeft <= 0) {
            gameOver(true);
        }
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
        setCardHeader('🌑', 'Chemin Connu', 'Exploration');
        logEvent("Vous retraversez un couloir déjà exploré, rien de neuf.", "normal");
    }
}

// CAFET_ASSOMBRIE (anomalies.js) : déclenché UNE fois, à la première visite de la pièce taguée
// room.cafetRoom (voir generateFloorMap()) — remplace l'événement aléatoire normal de cette pièce par
// un piège sévère suivi d'un trésor nettement supérieur à la normale (powerScore maximal). Réutilise
// exactement applyPlayerDamage()/gameOver()/addLoot(), aucune nouvelle formule de dégâts ou de loot.
function triggerCafetRoom(room) {
    const trapDmg = Math.floor(Math.random() * 12) + 10; // 10 à 21 PV : nettement au-dessus d'un piège normal (~5-15)
    applyPlayerDamage(trapDmg);
    setCardHeader('🕯️', 'Cafétéria Assombrie', 'Danger');
    logEvent(`Un piège vicieux se déclenche dans l'obscurité de la cafétéria abandonnée ! (-${trapDmg} PV)`, "danger");
    if (gameState.hp <= 0) {
        gameOver(false, 'trap');
        return;
    }
    addLoot(1); // Trésor nettement supérieur à la normale : score de puissance maximal (voir getRarityWeights())
    logEvent("Malgré le piège, un trésor bien caché récompense votre prudence.", "success");
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
        ui.enemyStatusIcons.innerHTML = "—";
        return;
    }
    const badges = [];
    const add = (active, icon, title) => { if (active) badges.push({ icon, title }); };
    add(status.bleed && status.bleed.rounds > 0, "🔥", "Saignement");
    add(status.stunned, "💫", "Étourdi");
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
        : "—";
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
        // telegraph/defBuffed/frenzied : uniquement lus/écrits côté boss (voir performBossCounterAttack()
        // dans app.js, Chantier 2 du rework combat) — restent toujours neutres sur un mob normal/élite.
        // enraged/enrageCooldown : Chantier 3 (enrage distance), tous mobs confondus, boss inclus.
        enemy.status = { bleed: null, stunned: false, slowed: null, blinded: null, corroded: null, feared: null, telegraph: null, defBuffed: null, frenzied: false, enraged: null, enrageCooldown: null };
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
    }], () => setCombatInputLocked(false));
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
    // "Charger" (Chantier 3, attemptEngage()) : DEF divisée par 2 pour la riposte qui suit une charge
    // volontaire — consommé (remis à faux) au tout début de la PROCHAINE action, voir tryPlayerAction(),
    // jamais ici (fonction pure, aussi appelée pour le simple affichage UI de la DEF).
    if (gameState.engageDefHalved) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    return effectiveDef;
}

// Vérifie que le joueur peut agir (combat en cours, pas étourdi), et applique le saignement
// éventuellement en cours sur le joueur AVANT son action. Retourne false si le joueur ne peut pas
// agir ce tour-ci (combat terminé entre-temps, ou étourdi).
function tryPlayerAction() {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;

    // Reset avant toute chose : seul un backfire posé PENDANT cette action doit pouvoir être tenu
    // responsable d'une mort ce même tour (voir attackMagic()/gameOver()).
    gameState.lastPlayerActionWasBackfire = false;
    // Même convention pour "Charger" (Chantier 3, attemptEngage()) : la DEF divisée par 2 ne doit
    // couvrir QUE la riposte qui suit la charge, jamais fuiter sur l'action suivante du joueur.
    gameState.engageDefHalved = false;

    // Saignement en cours sur le joueur : tique avant son action
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) {
        const dmg = gameState.status.bleed.dmgPerRound;
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
    const playerDamage = rollDamage(attackerAtk, effectiveEnemyDef, effectiveOptions);
    enemy.hp -= playerDamage;
    gameState._lastPlayerDamage = playerDamage; // Utilisé par la mécanique d'arme "Vampirique" (lifesteal)
    animateDieHit(ui.combatPlayerDie, 'left', playerDamage, ui.combatEnemyHpRing, ui.combatEnemyHp, enemy.hp, enemy.maxHp);
    showFloatingDamage(ui.combatSideEnemy, playerDamage, { toPlayer: false }); // dégâts infligés par le joueur : jamais "heavy" (réservé aux coups marquants du mob/boss)
    logEvent(`Vous attaquez ${label}${slowedNote}${adrenalineNote}${sneakNote}${enemyWasBlinded ? " (ennemi ébloui)" : ""}${enemyWasCorroded ? " (ennemi corrodé)" : ""}${enemyWasDefBuffed ? " (garde hérissée)" : ""}${enemyIsFrenzied ? " (garde effondrée par la folie)" : ""}${enemyIsEnragedForPlayer ? " (garde baissée par l'enrage)" : ""} et infligez ${playerDamage} dégâts à [${enemy.name}].`, "normal");

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
            const actualHeal = applyPlayerHeal(healAmount);
            logEvent(`💚 Votre arme régénère vos blessures (+${actualHeal} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const baseAmount = gameState._lastPlayerDamage || weapon.baseDmg || 5;
            const stolen = Math.max(2, Math.round(baseAmount * 0.3));
            const actualHeal = applyPlayerHeal(stolen);
            logEvent(`🧛 Vous volez ${actualHeal} PV à [${enemy.name}].`, "success");
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
            const actualHeal = applyPlayerHeal(healAmount);
            logEvent(`💚 Votre armure régénère vos blessures (+${actualHeal} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const stolen = Math.max(2, Math.round((incomingDamage || 0) * 0.3));
            const actualHeal = applyPlayerHeal(stolen);
            logEvent(`🧛 Votre armure vampirique siphonne ${actualHeal} PV sur le coup encaissé.`, "success");
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

// Alias historique de la pause action -> riposte, désormais piloté par config.combatRhythm
// (voir runCombatBeats() ci-dessous) plutôt qu'une constante figée. Conservé tel quel pour les
// setTimeout(..., COMBAT_BEAT_MS) de fin de combat/mort, non restructurés en beats (voir
// performBossCounterAttackInner()/resolveEnemyCounterAttack() : un décès termine la séquence, il n'a
// pas besoin d'un "beat" de plus avant l'écran Game Over).
const COMBAT_BEAT_MS = config.combatRhythm.beatActionToRiposte;

// Empêche de spammer les boutons de combat pendant la petite pause entre deux actions
function setCombatInputLocked(locked) {
    [ui.btnAttackWeapon, ui.btnAttackRanged, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnSprint, ui.btnRetreat, ui.btnEngage, ui.btnFlee].forEach(btn => {
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
// défaut true) est réservé au Chantier 9 (skip au clic/Espace) — non lu pour l'instant, juste posé
// dès ce chantier pour que la donnée existe au bon endroit.
function runCombatBeats(steps, onDone) {
    function playStep(index) {
        if (index >= steps.length) {
            if (onDone) onDone();
            return;
        }
        const step = steps[index];
        setTimeout(() => {
            step.run();
            playStep(index + 1);
        }, step.delay || 0);
    }
    playStep(0);
}

// Riposte de l'ennemi : verrouille les boutons, puis laisse resolveEnemyCounterAttack() dérouler sa
// propre séquence de beats (un seul beat pour un mob normal, plusieurs pour un pattern de boss) —
// c'est ELLE qui décide du rythme exact (télégraphe, multi-coups...), pas ce point d'entrée.
function enemyCounterAttack() {
    if (!gameState.currentEnemy) return; // sécurité si le combat vient d'être résolu
    setCombatInputLocked(true);
    resolveEnemyCounterAttack(() => setCombatInputLocked(false));
}

// ==========================================
// BOSS : PHASES, TÉLÉGRAPHES, PATTERNS (Chantier 2 du rework combat)
// ==========================================
// Un boss n'est plus "un mob avec plus de PV" : son comportement change par PALIER DE PV (phases),
// via des patterns d'attaque et des états temporaires uniquement — aucune nouvelle entité, aucune
// modélisation spatiale (voir config.bossPhases). Chemin totalement séparé du mob normal/élite
// (resolveEnemyCounterAttack ci-dessous) : isEliteMob() exclut déjà les boss, donc aucun
// recouvrement avec le scaling élite du Chantier 1.

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
function executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy = false) {
    const pressureFloor = pressureFloorOverride !== undefined
        ? pressureFloorOverride
        : gameState.maxHp * config.mobDamageScaling.pressureFloorFrac;
    const dmg = rollDamage(atk, getEffectiveDef(), {
        pressureFloor,
        minMitigation: config.mobDamageScaling.minMitigation
    });
    let playerDamage = dmg;
    let companionAbsorbNote = "";
    if (gameState.companion && gameState.companion.specialty.type === 'guard' && gameState.companion.hp > 0) {
        const interceptChance = 40;
        if (Math.random() * 100 < interceptChance) {
            const absorbPct = 0.3 + Math.random() * 0.3;
            const absorbed = Math.min(gameState.companion.hp, Math.round(dmg * absorbPct));
            playerDamage = dmg - absorbed;
            gameState.companion.hp -= absorbed;
            companionAbsorbNote = ` (${gameState.companion.name} encaisse ${absorbed} dégâts à votre place)`;
        }
    }
    applyPlayerDamage(playerDamage);
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage, ui.combatPlayerHpRing, ui.combatPlayerHp, gameState.hp, gameState.maxHp);
    showFloatingDamage(ui.combatSidePlayer, playerDamage, { toPlayer: true, heavy }); // `heavy` : télégraphe exécuté/ruée d'enrage/phase 3, voir les appelants
    logEvent(`${label} inflige ${playerDamage} dégâts${companionAbsorbNote}.`, "danger");
    if (gameState.companion && gameState.companion.hp <= 0) {
        logEvent(`${gameState.companion.name} s'effondre, à bout de forces, et ne peut plus vous accompagner...`, "danger");
        gameState.companion = null;
    }
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
    performBossCounterAttackInner(enemy, () => {
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
    // qui n'a rien à attendre. Petit helper pour ne pas dupliquer ce garde-fou à chaque step.
    const strikeAndCheckDeath = (atk, label, pressureFloorOverride, heavy = false) => {
        executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy);
        if (gameState.hp <= 0) { gameState.hp = 0; setTimeout(() => gameOver(false, enemy), COMBAT_BEAT_MS); }
    };

    // Phase 3 ("folie") : dégâts +40% fixes, pas de télégraphe — le boss cesse d'être tactique et
    // frappe en continu. enemy.status.frenzied (lu par performPlayerAttack()) réduit symétriquement
    // sa DEF effective : la fenêtre risque/récompense de cette phase (voir config.bossPhases.phase3).
    if (phase === 3) {
        enemy.status.frenzied = true;
        enemy.status.telegraph = null; // un télégraphe en cours à l'entrée en phase 3 est abandonné
        enemyAtk = Math.round(enemyAtk * bp.phase3.atkMult);
        runCombatBeats([
            { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}], pris de folie furieuse, vous`, undefined, true), delay: rhythm.beatHeavyEvent }
        ], onDone);
        return;
    }
    enemy.status.frenzied = false;

    // Exécution d'un télégraphe posé au tour précédent (annoncé, donc jamais une surprise)
    if (enemy.status.telegraph) {
        const tg = enemy.status.telegraph;
        enemy.status.telegraph = null;
        if (tg.type === 'heavy') {
            const boosted = Math.round(enemyAtk * bp.telegraphHeavyMult);
            runCombatBeats([
                { run: () => strikeAndCheckDeath(boosted, `[${enemy.name}] abat son attaque annoncée et`, undefined, true), delay: rhythm.beatHeavyEvent }
            ], onDone);
            return;
        }
        if (tg.type === 'defBuff') {
            runCombatBeats([{
                run: () => {
                    enemy.status.defBuffed = { rounds: bp.defBuffRounds };
                    logEvent(`[${enemy.name}] se hérisse : sa garde vient de monter, sans vous frapper ce tour-ci.`, "info");
                },
                delay: rhythm.beatHeavyEvent
            }], onDone);
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
            const steps = [];
            for (let i = 0; i < hits; i++) {
                steps.push({
                    run: () => { if (gameState.hp > 0) strikeAndCheckDeath(perHitAtk, `Frappe ${i + 1}/${hits} :`, perHitPressureFloor); },
                    delay: i === 0 ? rhythm.beatActionToRiposte : rhythm.beatMultiHit
                });
            }
            runCombatBeats(steps, onDone);
            return;
        }
        threshold += bp.rangedHarassChance;
        if (roll < threshold) {
            // Harcèlement à distance : mécanique volontairement minimale ici (pont avec le futur
            // Chantier 3 "enrage distance", pas encore implémenté — voir NOTES_COMBAT.md).
            const harassAtk = Math.round(enemyAtk * bp.rangedHarassMult);
            runCombatBeats([
                { run: () => strikeAndCheckDeath(harassAtk, `[${enemy.name}] vous harcèle à distance et`), delay: rhythm.beatActionToRiposte }
            ], onDone);
            return;
        }
        threshold += bp.defBuffTelegraphChance;
        if (roll < threshold) {
            runCombatBeats([{
                run: () => {
                    enemy.status.telegraph = { type: 'defBuff' };
                    logEvent(`[${enemy.name}] se raidit, une garde imminente se prépare...`, "info");
                },
                delay: rhythm.beatHeavyEvent
            }], onDone);
            return;
        }
    }

    // Phase 1 (et repli de phase 2) : chance de télégraphier une attaque lourde pour le tour
    // suivant (annonce sans dégât), sinon attaque de base normale.
    const heavyChance = phase === 1 ? bp.phase1TelegraphChance : bp.phase2TelegraphChance;
    if (Math.random() < heavyChance) {
        runCombatBeats([{
            run: () => {
                enemy.status.telegraph = { type: 'heavy' };
                logEvent(`[${enemy.name}] prépare un coup dévastateur...`, "info");
            },
            delay: rhythm.beatHeavyEvent
        }], onDone);
        return;
    }

    runCombatBeats([
        { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}] vous`), delay: rhythm.beatActionToRiposte }
    ], onDone);
}

// Riposte de l'ennemi : tient compte de son propre saignement/étourdissement en cours, de l'armure
// équipée du joueur, et peut infliger un effet de statut selon son trait élémentaire. `onDone` (voir
// runCombatBeats()) est appelé une fois TOUTE la séquence visuelle de ce tour jouée — immédiatement
// pour un mob normal (un seul beat) ou après le dernier beat d'un pattern de boss.
function resolveEnemyCounterAttack(onDone) {
    const enemy = gameState.currentEnemy;
    if (!enemy) { if (onDone) onDone(); return; } // sécurité si le combat vient d'être résolu pendant la pause

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
        enemy.status.stunned = false;
        showDie(ui.combatEnemyDie, "😴");
        updateUI();
        if (onDone) onDone();
        return;
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

    // Élites (voir isEliteMob()) : multiplicateur de dégâts dédié, EN PLUS du scaling par étage et
    // des modificateurs aléatoires déjà existants (qui gonflaient surtout les PV) — chantier "rework
    // combat". Jamais sur un boss : isEliteMob() les exclut déjà (ils ont leur propre traitement,
    // voir Chantier 2 du même rework).
    if (isEliteMob(enemy)) {
        enemyAtk = Math.round(enemyAtk * config.mobDamageScaling.eliteDamageMult);
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

    applyPlayerDamage(playerDamage);
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage, ui.combatPlayerHpRing, ui.combatPlayerHp, gameState.hp, gameState.maxHp);
    showFloatingDamage(ui.combatSidePlayer, playerDamage, { toPlayer: true }); // mob normal/élite : jamais "heavy" (réservé aux moments boss/enrage)
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

    // Compagnon "Premiers secours" : chance de soigner le joueur après la riposte ennemie, et de lui
    // restaurer un peu de mana au passage si un sort est équipé.
    if (gameState.companion && gameState.companion.specialty.type === 'medic' && Math.random() * 100 < 25) {
        const heal = 8 + Math.floor(Math.random() * 8); // 8 à 15 PV
        const actualHeal = applyPlayerHeal(heal);
        logEvent(`${gameState.companion.name} vous soigne rapidement ! (+${actualHeal} PV)`, "success");
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
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
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
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor);
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
    const weaponBonus = weapon ? (weapon.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;
    const defReduction = weapon ? 0 : 0.35; // Pas d'arme équipée : mêmes mains nues qu'attackUnarmed()
    const label = weapon ? "en chargeant à l'arme" : "en chargeant à mains nues";
    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier: config.engageAction.atkMultiplier, defReduction }, label);
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
    const backfireChance = Math.max(8, 15 - 1.5 * (skill.level - 1)) + (gameState.anomalyEffects.backfireBonusPct || 0); // 15% de base, plancher 8% (un sort chaotique garde toujours un risque) + ZONE_MAGIQUE (anomalies.js)
    const atkMultiplier = (1.25 + 0.02 * (skill.level - 1)) * (gameState.anomalyEffects.spellMult || 1); // ZONE_MAGIQUE (anomalies.js)

    if (Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        logEvent(`[${spell.spellName}] part de travers et fait un flop retentissant. Aucun dégât (mana quand même dépensé).`, "danger");
        gameState.lastPlayerActionWasBackfire = true; // Voir gameOver()/generateEpitaph() : attribution du décès si la riposte qui suit est fatale
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    const effectiveAtk = gameState.atk + (spell.baseDmg || 0);
    const used = performPlayerAttack(
        effectiveAtk,
        { atkMultiplier, varianceRange: 0.35, defReduction: 0.15 }, // Les sorts ignorent un peu de DEF (thématique), pas toute
        `avec [${spell.spellName}]`
    );
    if (used) gainSkillXp('magic', SKILL_XP_PER_USE);
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
        gameState.fleesThisRun = (gameState.fleesThisRun || 0) + 1; // Voir generateEpitaph() : mention spéciale à 3+ fuites
        gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null }; // Les statuts ne survivent pas au combat
        setCardHeader('🏃', 'Fuite Réussie', 'Exploration');
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !${scoutNote}`, "info");
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
    // Chantier "rework combat" (Chantier 2) : le loot d'un boss est en plus garanti au moins
    // config.bossRewards.minRarityKey, et un objet signature UNIQUE à ce boss tombe systématiquement
    // (voir awardBossSignatureItem()/bestiary.js).
    const lootPower = getLootPowerScore(defeatedEnemy);
    if (wasBoss) {
        addLoot(lootPower, { minRarityKey: config.bossRewards.minRarityKey });
        if (Math.random() * 100 < 50) addLoot(lootPower, { minRarityKey: config.bossRewards.minRarityKey }); // 50% de chance d'un deuxième objet
        awardBossSignatureItem(defeatedEnemy);
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

    // Plongée dans un repaire en cours (voir diveIntoLair()) : enchaîne les combats forcés restants,
    // puis le boss du repaire, AVANT de reprendre le trajet interrompu (pendingUrbanTravel) ci-dessous
    // — sinon la victoire sur un simple sbire du repaire serait prise pour l'arrivée à destination.
    if (gameState.pendingLairDive) {
        const dive = gameState.pendingLairDive;
        if (dive.stage === 'trash') {
            dive.combatsLeft -= 1;
            if (dive.combatsLeft > 0) {
                logEvent("Un autre adversaire surgit des décombres du repaire...", "danger");
                initiateCombat();
                return;
            }
            dive.stage = 'boss';
            const lair = gameState.urbanMap.lairsById[dive.lairId];
            if (!lair.bossInstance) {
                lair.bossInstance = generateBoss(gameState.urbanMap.theme) || generateMob(gameState.urbanMap.theme);
            }
            logEvent("Le repaire se calme... jusqu'à ce qu'une présence bien plus dangereuse n'émerge de l'ombre !", "danger");
            initiateCombat(lair.bossInstance);
            return;
        }
        // dive.stage === 'boss' : le boss du repaire vient de tomber, la plongée est terminée
        // (butin déjà garanti par la branche wasBoss ci-dessus, comme tout autre boss).
        const lair = gameState.urbanMap.lairsById[dive.lairId];
        lair.cleared = true;
        gameState.pendingLairDive = null;
        logEvent(`🏆 Le repaire est nettoyé ! Plus rien à craindre sur cette route.`, "success");
        if (gameState.pendingUrbanTravel) {
            triggerNextCityAmbushOrArrive();
            return;
        }
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
        triggerFloorTransition(); // triggerFloorTransition() appelle déjà updateUI()
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
            triggerFloorTransition(); // triggerFloorTransition() appelle déjà updateUI()
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
    gameState.pendingUrbanBossEncounter = null;
    gameState.pendingUrbanTravel = null;
    gameState.floorTransitionPending = false;
    gameState.pactChoicePending = false;
    ui.combatZone.classList.add('hidden');
    ui.bossChoiceZone.classList.add('hidden');
    ui.stealthChoiceZone.classList.add('hidden');
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
    if (ui.floorTransitionOverlay) ui.floorTransitionOverlay.classList.add('hidden');
    if (ui.pactChoiceOverlay) ui.pactChoiceOverlay.classList.add('hidden');

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
    const epitaph = generateEpitaph({ cause, enemyName });
    recordEpitaph(epitaph, { cause });

    logEvent(reason, "danger");
    logEvent("--- GAME OVER ---", "danger");
    triggerHaptic('heavy');

    // Remplissage et affichage de l'écran Game Over (recouvre toute l'interface)
    ui.gameOverReason.innerText = reason;
    ui.gameOverFloor.innerText = gameState.currentFloor;
    ui.gameOverLevel.innerText = gameState.level;
    ui.gameOverDistrict.innerText = gameState.currentDistrict;
    if (ui.gameOverEpitaph) ui.gameOverEpitaph.innerText = epitaph;
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

// La Carte Urbaine se superpose à la carte active (voir index.html) : ses propres clics ne doivent
// jamais atteindre le listener ci-dessus (explore() y est déjà un no-op sans floorMap, mais on évite
// quand même une vibration haptique et un log parasite à chaque trajet vers une ville).
if (ui.urbanTravelOverlay) {
    ui.urbanTravelOverlay.addEventListener('click', (e) => e.stopPropagation());
}

// Bouton de redémarrage sur l'écran Game Over
ui.btnRestart.addEventListener('click', resetGame);
ui.btnWinRestart.addEventListener('click', resetGame);

// Bouton "Continuer" de l'écran d'escalier (voir continueFromFloorTransition())
if (ui.btnFloorTransitionContinue) ui.btnFloorTransitionContinue.addEventListener('click', continueFromFloorTransition);
if (ui.btnPactAtk) ui.btnPactAtk.addEventListener('click', () => choosePactBlessing('atk'));
if (ui.btnPactHp) ui.btnPactHp.addEventListener('click', () => choosePactBlessing('hp'));

// Écran de départ : nom du crawler (bouton ou touche Entrée), puis révélation du cadeau de bienvenue
ui.btnStartConfirm.addEventListener('click', confirmPlayerName);
ui.startNameInput.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') confirmPlayerName(); });
ui.btnGiftContinue.addEventListener('click', dismissGiftReveal);

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
ui.btnAttackMagic.addEventListener('click', attackMagic);
if (ui.btnSprint) ui.btnSprint.addEventListener('click', attemptSprint);
if (ui.btnRetreat) ui.btnRetreat.addEventListener('click', attemptRetreat);
if (ui.btnEngage) ui.btnEngage.addEventListener('click', attemptEngage);
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

// Clics sur l'écran marchand/professeur (ville spécialisée)
ui.btnTrainSkill.addEventListener('click', trainSkill);
ui.btnLeaveShop.addEventListener('click', leaveShop);

// Clics sur le choix "plonger/poursuivre" d'un repaire repéré sur la route
ui.btnDiveLair.addEventListener('click', diveIntoLair);
ui.btnDeclineLair.addEventListener('click', declineLair);

// Bouton "Recentrer" de la Carte Urbaine (voir recenterUrbanMap())
if (ui.btnRecenterMap) ui.btnRecenterMap.addEventListener('click', recenterUrbanMap);

// Clic sur le kit de test (bouton discret)
ui.btnDevTestKit.addEventListener('click', giveTestKit);
ui.btnDevJumpUrban.addEventListener('click', devJumpToUrbanFloor);

// Lancement du jeu
generateFloorMap();
updateUI();
updateInventoryUI();
updateSpellbookUI();
updateKnownLocationsUI();
updateCompanionUI();

// Indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames())
refreshStartSavesHint();

// Version affichée sur l'écran de départ (voir APP_VERSION)
if (ui.versionLabel) {
    ui.versionLabel.innerText = `PR #${APP_VERSION.pr} — ${APP_VERSION.label}`;
}

