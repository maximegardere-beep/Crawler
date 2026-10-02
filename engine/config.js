// engine/config.js — Configuration et bases de données (config.*).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
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
