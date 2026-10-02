# Chronique et succès, chasseurs de primes, DeathWatch, nécrologie, anomalies d'étage

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/chronicle.js, engine/show.js, engine/progression.js, achievements.js, deathwatch.js, anomalies.js.

- **Chronique de run + succès** (chantier 2, voir `NOTES_SUCCES.md`) : `gameState.runStats`
  (compteurs sur toute la partie) alimenté par un point d'entrée UNIQUE, `recordRunEvent(type, data)`,
  appelé depuis les hooks existants (`applyPlayerDamage()`, `winCombat()` — avec `enemy.runTrack` posé
  par `initiateCombat()` —, `attemptFlee()`, piège, `restAtSafehouse()`, `descendStairs()`,
  `advanceToNextFloor()`, `buyShopItem()`, flop de `attackMagic()`, `storeLootItem()`, fonctions
  compagnon, `equipItem()`, `performExploreStep()`, `gameOver()`, `winGame()`) ; tout nouveau compteur
  s'ajoute à `createEmptyRunStats()` (achievements.js). Succès **par crawler** (`gameState.achievements`,
  sauvegardé) : `evaluateAchievements()` rejoue les `check(stats, event, state)` du catalogue à chaque
  événement, **jamais tant que `gameState.saveEnabled` est faux** (chargement silencieux, tests) ;
  chaque déblocage ouvre une **boîte** façon DCC (`openAchievementBox()`, `config.achievementBoxes`,
  Bronze/Argent/Or) sauf les succès posthumes (à la mort). Indice de domination (`computeDominance()`,
  facilité des 10 dernières victoires) prêt pour les chasseurs de primes. UI : `#achievement-toast`
  (annonce non bloquante), `#btn-achievements` → `#achievements-overlay` (secrets en « ??? »), succès du
  run sur Game Over/Victoire. **Revente d'office** : `storeLootItem()`, réserve pleine, revend le butin
  pour `LOOT_OVERFLOW_SELL_RATIO` (50 %) du prix de revente marchand (`getOverflowSellPrice()`) au lieu
  de le perdre.
- **Chasseurs de primes** (chantier 3, voir `NOTES_CHASSEURS.md`, chiffres dans `config.bounty`) : prime
  `gameState.bounty.value` (0-100) qui monte avec les victoires faciles (`onBountyVictory()`, facilité de la
  chronique) et les fuites devant un chasseur, et ne retombe QU'EN tuant un chasseur ; seul point de
  modification `addBounty()` (paliers `getBountyTier()` 30/60/90, vignette `wantedPoster`, badge
  `#bounty-status`). Chasseurs (`bountyHunters` dans bestiary.js, hors `baseMobs`) générés par
  `generateBountyHunter()` avec des stats **calées sur le joueur** (`computeBountyHunterStats()`, pure,
  generator.js, à partir de `getPlayerCombatProfile()`), toujours élites, `isBountyHunter`. Apparition
  `maybeSpawnBountyHunter()` dans `handleStealthEncounter()` (avant la détection : aucune esquive) et les
  deux embuscades de trajet ; escouade à 90+ (`gameState.pendingBountySquad`, Chef enchaîné par
  `winCombat()`). Fuite à `fleeChance` (50 %) fixe. Épitaphe dédiée `EPITAPH_TEMPLATES.chasseurPrime`
  (pool spécial, comme `mobFaible`).
- **Émission DeathWatch** (chantier 4, voir `NOTES_DEATHWATCH.md`, chiffres dans `config.show`) : à
  l'arrivée sur chaque étage dès le 2, SEULEMENT dans une vraie partie (`gameState.saveEnabled`, comme les
  succès), `advanceToNextFloor()` ouvre `triggerShow(lastFloor)` (bilan de l'étage fini capturé avant sa
  remise à zéro) — ou la diffère derrière le Pacte du Crawler (`pendingShowAfterPact`, ouverte par
  `choosePactBlessing()`). Choix bloquant `gameState.showChoicePending` (dans `isActionBlocked()`) +
  `pendingShow` ; zone `#show-zone`, vignette `showStudio`. `answerShow(tone)` : Poli (sans jet, PO),
  Pique en retour / Provocation / Insulte en direct (jet d20 + popularité `getShowPopularity()` contre
  8/12/16 : boîte Bronze/Argent/Or via `openAchievementBox()`, sinon −2 H jamais mortelles / combat élite /
  +20 prime et chasseur de primes), ou Refuser.
- **Nécrologie** : `gameOver(timeout, killer)` dérive une `cause` (`'trap'`/`'bleed'`/`'combat'`/
  `'backfire'`/`'timeout'`) du contexte réel de mort — `killer` vaut `'trap'`/`'bleed'` aux deux sites
  correspondants, ou l'objet ennemi lui-même à la mort par riposte de combat
  (`resolveEnemyCounterAttack()`) ; `gameState.lastPlayerActionWasBackfire` (posé par `attackMagic()`
  au moment du flop, remis à faux en tout début de CHAQUE action par `tryPlayerAction()` — pour qu'un
  backfire ne "contamine" jamais un décès plus tardif sans rapport) requalifie alors la cause en
  `'backfire'`. `generateEpitaph(deathContext)` pioche un template dans `EPITAPH_TEMPLATES[cause]`
  (`{{mob}}`/`{{etage}}`/`{{deltaNiveau}}`/`{{cause}}`/`{{crawler}}` remplacés) — deux pools DÉDIÉS
  (`mobFaible`, `backfire`) remplacent le pool par défaut selon des règles spéciales : mob tueur "très
  inférieur" (écart `NECROLOGIE_WEAK_MOB_DELTA` entre `gameState.level` et `getMobLevelEquivalent()` —
  aucun champ de niveau explicite sur les mobs, l'étage courant sert de proxy, cohérent avec le reste
  du scaling par étage), ou cause déjà `'backfire'`. Deux mentions additionnelles, indépendantes du
  pool choisi et combinables entre elles : `gameState.fleesThisRun` (fuites RÉUSSIES depuis le début du
  run, incrémenté par `attemptFlee()`, jamais remis à zéro en cours de run) à partir de
  `NECROLOGIE_FLEE_THRESHOLD`, et le premier objet équipé (arme/distance/armure) portant
  `jokeItem: true` (voir `items.js`) s'il y en a un. `recordEpitaph()` archive le texte dans
  `gameState.necrologie` (plus récente en premier, plafonné à `NECROLOGIE_MAX_ENTRIES` — persistant en
  save via l'autosauvegarde existante, aucun écran de lecture dédié pour l'instant). Affichée pleine
  largeur sur `#game-over-epitaph` (écran Game Over).
- **Anomalies d'étage** (`anomalies.js`, module autonome au même titre que `districts.js`/
  `safehouses.js`, chargé juste avant `app.js`) : catalogue de 12 anomalies (`ANOMALY_CATALOG`, 4
  catégories : combat/ressources/exploration/mixtes) tirées à la génération de chaque étage
  (`rollAndApplyFloorAnomalies()`, appelée par `advanceToNextFloor()` AVANT `generateFloorMap()`/
  `generateUrbanFloorMap()`, pour que les effets structurels comme LABYRINTHE influencent la
  génération elle-même). Règles d'intensité (`rollFloorAnomalies(floor)`) : étages 1-2 aucune, 3-6 une
  seule tirée dans le pool restreint (`intensiteMin <= 3`), 7-11 une seule dans le pool complet, 12+
  DEUX anomalies compatibles (table `ANOMALY_INCOMPATIBILITIES`, ex. SECHERESSE+ZONE_MAGIQUE et
  PEAU_DE_VERRE+ADRENALINE interdits ; au moins une des deux doit être `negatif`/`mixte`, jamais un
  double bonus ; jusqu'à 20 tentatives puis repli sur une seule anomalie simple du pool complet).
  L'écran d'escalier (`getUpcomingAnomalyAnnouncement()`) TIRE RÉELLEMENT l'anomalie du PROCHAIN étage
  et la mémorise (`gameState.pendingNextFloorAnomalies`) pour que `rollAndApplyFloorAnomalies()` (au
  clic sur "Continuer") applique EXACTEMENT ce qui vient d'être annoncé, jamais un second tirage
  indépendant — `devJumpToUrbanFloor()` (DEV, saute l'écran) retombe alors sur un tirage à la volée,
  seul cas où `pendingNextFloorAnomalies` est absent pour l'étage ciblé.
  **Hook d'application UNIQUE** : `appliquerAnomalie(etage, anomalie)` (anomalies.js) fusionne les
  `effects` d'UNE anomalie dans `gameState.anomalyEffects` (objet plat, `createNeutralAnomalyEffects()`
  = valeurs neutres, jamais de comportement changé sans anomalie active) — multiplicatif sur les
  multiplicateurs (deux anomalies ATQ ×1.4 et ×1.2 → ×1.68), additif sur les bonus en points, OR sur
  les drapeaux. `computeAnomalyEffects(list)` est l'équivalent PUR (hors `gameState`, testable
  indépendamment, même logique que `computeThreatMultiplier()` dans `generator.js`). Chaque système de
  jeu lit `gameState.anomalyEffects.xyz` à SON point d'usage plutôt que de dupliquer une logique par
  anomalie : `rollDamage()` (`allDamageMult`, ADRENALINE, symétrique joueur/mobs), `recomputeMaxHp()`
  (`playerMaxHpMult`, PEAU_DE_VERRE — voir `gameState.baseMaxHp` ci-dessous), `applyPlayerHeal()`
  (`healingMult`, PEAU_DE_VERRE), `gainXp()` (`xpMult`, MOB_ENRAGE), `generateMob()`/`generateBoss()`
  (`mobAtkMult`, MOB_ENRAGE, appliqué comme le scaling par étage), `applyTimeElapsedRegen()`
  (`manaRegenMult` SECHERESSE, `regenOutsideSafehouseZero` REPAS_DE_FAMILLE — régén PV passive à zéro,
  cette fonction n'étant justement appelée que HORS salle sécurisée), `enterRoom()` (salle sécurisée :
  `freeSafehouseMeals` REPAS_DE_FAMILLE, séjour sans coût en temps), `generateItem()` (`potionDropMult`
  SECHERESSE, tirage pondéré de la catégorie `consumables`), `generateShopStock()` (`shopDiscountPct`
  ECONOMIE_AUSTERE), le gain d'or exploré (`goldGainMult` ECONOMIE_AUSTERE), `getStealthChance()`/
  `attemptStealthEvasion()` (`stealthCapBonus`/`detectionBonus` NOCTURNE — plafond relevé ET pénalité
  sur la chance de base, calcul indépendant : un fort investissement en Furtivité profite du plafond
  relevé, un faible subit surtout la pénalité), `attackMagic()` (`spellMult`/`backfireBonusPct`
  ZONE_MAGIQUE), `generateBorough()` (`extraRoomsPct` LABYRINTHE, +50% salles par bloc, bloc agrandi d'autant),
  `handleStealthEncounter()` (`guardedStairsBoost` LABYRINTHE, `eliteBonus` passé à `generateMob()`
  UNIQUEMENT dans le quartier qui garde l'escalier — décale les seuils du jet de modificateurs sans
  toucher au système de boss lui-même), `initiateCombat()` (`mobsActFirst` TEMPO_CREE, frappe
  d'ouverture réutilisant `enemyCounterAttack()` tel quel, seulement DÉCALÉE plus tôt), `gainSkillXp()`
  (`skillXpPerActionBonus` TEMPO_CREE, +1 XP compétence par action), `enterRoom()`/`triggerCafetRoom()`
  (`cafetRoom` CAFET_ASSOMBRIE — une pièce normale taguée à la génération, piège sévère + trésor
  `addLoot(1)` à la toute première visite, jamais revisité ensuite).
  **PACTE_DU_CRAWLER** (`forcedPactChoice`) est le seul cas à choix bloquant : `triggerPactChoice()`
  (`gameState.pactChoicePending`, inclus dans `isActionBlocked()`) à l'entrée de l'étage,
  `choosePactBlessing('atk'|'hp')` applique DIRECTEMENT un delta `{atk, hp}` (jamais un multiplicateur
  permanent, contrairement à PEAU_DE_VERRE) mémorisé dans `gameState.pactBlessingDelta` et annulé au
  tout début du PROCHAIN `advanceToNextFloor()`, avant même le tirage des nouvelles anomalies de cet
  étage. `gameState.baseMaxHp` (vraie progression, avancée uniquement par `gainXp()`) est la SOURCE DE
  VÉRITÉ des PV max ; `gameState.maxHp` (dérivé, lu partout ailleurs dans le jeu comme avant) n'est
  recalculé QUE par `recomputeMaxHp()` — appelé après toute montée de niveau, tout changement d'étage,
  et toute résolution du Pacte. Une sauvegarde antérieure à cette fonctionnalité n'a pas `baseMaxHp` :
  `restoreSaveForName()` le fait migrer depuis l'ancien `maxHp` (qui ÉTAIT la vraie base, aucun système
  d'anomalies n'existant alors), jamais un retour silencieux à 100.
  **Affichage** : badge(s) permanent(s) icône+nom (`updateAnomalyStatusUI()`, `#anomaly-status-bar`
  dans le header), description complète via l'infobulle native du navigateur (`title`, "inspection").
  Chiffres non fournis par la consigne d'origine (poids de tirage égaux, `intensiteMin` par anomalie,
  piège/trésor de CAFET_ASSOMBRIE, bonus/malus de PACTE_DU_CRAWLER) : valeurs de départ raisonnables
  posées dans `anomalies.js`/`app.js`, à ajuster par playtest réel comme le reste des chiffres
  d'équilibrage du jeu (voir Backlog).
