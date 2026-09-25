# Crawler

Rogue-like textuel minimaliste inspiré de Dungeon Crawler Carl. GitHub Pages, HTML/JS vanilla +
Tailwind CDN, **aucun build step**.

## Fichiers
- `index.html` — UI (deck de cartes, combat, inventaire, grimoire, "Lieux connus"/"Carte Urbaine", Game Over/Victoire)
- `app.js` — moteur : état, exploration, combat, niveau/XP, compétences, équipement, magie/mana, compagnons, carte d'étage
- `bestiary.js` — monstres de base + boss de quartier (`districtBosses`)
- `items.js` — objets, raretés, enchantements (`itemModifiers.effect`)
- `spells.js` — grimoire de sorts (`spellCatalog`), catégories corps à corps/à distance
- `districts.js` — quartiers (référencent les monstres par nom)
- `safehouses.js` — types de salles sécurisées (narratif seul pour l'instant)
- `generator.js` — génération procédurale (mobs, objets, parchemins de sorts, boss, compagnons)
- `anomalies.js` — catalogue et résolution des anomalies d'étage (`ANOMALY_CATALOG`, tirage, hook `appliquerAnomalie()`)
- `tests/` — voir plus bas

## Architecture (résumé)
- Étage = zone circulaire à **4 quartiers fixes** générés à l'entrée (`generateFloorMap()`), graphe
  de pièces reliées par couloirs artère (rapide/sûr) ou ruelle (lent/risqué).
- 1 boss par quartier ; l'escalier est gardé par l'un des 4. "Repérer et partir" garde le même mob
  en cache sur sa pièce, combattable plus tard via "Lieux connus" (distance réelle par Dijkstra,
  `computeDistance()`, coût/risque de trajet proportionnels).
- Salles sécurisées : pièces fixes, thème tiré dans `safehouses.js`, deviennent un lieu connu.
  **Entrée à choix explicite** (chantier "QoL/équilibrage", voir `NOTES_QOL_EQUILIBRAGE.md`) : plus de
  soin automatique — `enterRoom()` pose `gameState.safehouseChoicePending`/`pendingSafehouseRoomId`
  (inclus dans `isActionBlocked()`) et affiche `#safehouse-choice-zone`, même famille que
  `#boss-choice-zone`. `restAtSafehouse()` coûte `config.safehouse.restCost` (2H, sauf
  REPAS_DE_FAMILLE, anomalies.js) contre un soin PV majoré (25-40, tiré au hasard) et du mana à la
  MÊME échelle si un sort est équipé ; `leaveSafehouse()` reste gratuit, sans effet — la salle reste
  de toute façon enregistrée comme lieu connu dès l'entrée, quelle que soit l'issue. Garde-fou :
  `#btn-rest-safehouse` est désactivé dès l'affichage si `timeLeft - restCost <= 0`, doublé d'une
  vérification identique dans `restAtSafehouse()` elle-même (sécurité redondante) — le repos ne peut
  donc structurellement plus amener `timeLeft` à 0, contrairement à l'ancien soin automatique.
- Exploration = un seul bouton "Explorer" : jamais de choix bloquant de navigation.
- **Combat à distance** : aucune posture côté joueur — seul `mob.ranged` détermine l'écart de départ
  (`gameState.combatDistance`, 0 si mêlée). Arme/Mains nues exigent l'écart nul, Tir l'écart > 0 (+
  arme à distance équipée pour Tir, arme pour Arme) : ce sont de simples dégâts gated par l'écart
  courant, sans manche de distance embarquée. `attemptSprint()` (S'approcher) et `attemptRetreat()`
  (S'éloigner) sont les DEUX SEULES actions qui font évoluer l'écart, toujours affichées pendant un
  combat et grisées à l'extrémité correspondante (écart nul / maximal) plutôt que masquées ; chacune
  oppose un jet avantagé du joueur à un jet du mob, jamais de dégâts — SAUF **ruée** :
  au-delà d'une marge de victoire du mob (`config.rangedCombat.rushMarginThreshold`, 3), un mob de
  MÊLÉE comble l'écart d'un coup et frappe immédiatement ce tour-ci, quel que soit l'écart de départ —
  sans ça, un joueur à l'écart maximal devient mathématiquement increvable (le delta d'une manche
  normale ne peut jamais dépasser `dieSides-1`). En dehors d'une ruée, un mob de mêlée ne peut pas
  toucher un joueur qui tient encore la distance (`getCombatRangeContext().playerAdvantaged`) ; toute
  riposte passe par `resolveEnemyReaction()` (bloque, ou fait avancer le mob d'une manche s'il n'a pas
  déjà agi ce tour, avec ruée possible) plutôt que par `enemyCounterAttack()` en direct, pour ne jamais
  laisser un mob de mêlée figé hors de portée. Chaque manche CONTESTÉE (jet de distance, via
  `resolveDistanceRound()`, `attemptSprint()` ou `attemptRetreat()`) consomme aussi un peu de
  `gameState.timeLeft` (`config.rangedCombat.timeCostPerRound`), jamais les tours d'attaque standards —
  un combat kité de bout en bout a donc un coût en temps réel, pas seulement en risque.
- **Furtivité** : détection avant rencontre aléatoire (plafond 60%), Esquiver (plafond 70%) / Attaque
  Furtive (bonus x2 garanti). Un échec d'esquive laisse le mob "alerted" (`enemy.alerted`) pour tout le
  combat qui suit : `attemptFlee()` y est bloqué, pour que la boucle "esquive ratée sans conséquence"
  ne reste pas totalement gratuite.
- **Compagnons** : 4 spécialités. `leaveChance` (0-100) grimpe avec l'XP du compagnon ; à chaque
  montée de niveau, un jet décide s'il abandonne (départ **pacifique**, raison aléatoire parmi
  `COMPANION_ABANDON_REASONS`) — ce n'est PAS un seuil dur, juste une probabilité croissante.
- **Objets** : 4 raretés (commun/rare/épique/légendaire) → slots d'enchantement + multiplicateur de
  stats. `IMPLEMENTED_WEAPON_MECHANICS` / `IMPLEMENTED_ARMOR_MECHANICS` listent les enchantements
  qui ont un vrai effet en combat ; le reste (`pleasure_or_pain`, `aoe`, `darkness`) est cosmétique
  des deux côtés. Badges visibles dans l'inventaire (`buildMechanicBadgesHtml()`), colorés si
  fonctionnels, grisés sinon. `jokeItem: true` (`items.js`) marque un objet volontairement dérisoire
  (blague DCC), exclu du tirage normal du loot (`generateItem()`) mais toujours accessible via le
  cadeau de bienvenue et le kit de test. Réserve d'équipement (armes/armures/armes à distance,
  consommables et parchemins jamais comptés, voir `addLoot()`) : `config.inventory.maxEquipment` (8,
  chantier "QoL/équilibrage", Chantier B — voir `NOTES_QOL_EQUILIBRAGE.md`) — `gameState.maxInventory`
  en est un simple alias, posé juste après la déclaration de `config` (`gameState` est déclaré avant
  `config` plus haut dans `app.js`, il ne peut donc pas le référencer dans son propre littéral).
- **Mobs élite** : `generateMob()` pose `threatMultiplier` (puissance apportée par les seuls
  modificateurs, hors scaling d'étage) via `computeThreatMultiplier()` (generator.js, fonction pure et
  testable indépendamment du pipeline aléatoire) — ATQ×PV pondéré par la DEF avec un poids modéré
  (0.5), pour qu'un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
  ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule. Au-delà de
  `config.eliteThreatMultiplier`, icône 💀 (jamais sur un boss, qui garde 👑 — voir `isEliteMob()`).
- **Scaling des dégâts mobs** (chantier "rework combat", voir `NOTES_COMBAT.md` pour le détail des
  valeurs et un écart signalé sur le critère d'acceptation) : `config.mobDamageScaling` remplace
  l'ancien `floorScaling.atk` pour les mobs — `getFloorScaling()` (generator.js) calcule désormais
  l'ATQ via une formule composée `(1 + perFloor×étage) × (1 + perMobLevel×étage)` (pas de champ
  "niveau" dédié sur les mobs, l'étage sert de proxy pour les deux facteurs, comme
  `getMobLevelEquivalent()` ailleurs) — hp/def/xp des mobs restent sur l'ancien scaling linéaire par
  PROFONDEUR. `rollDamage()` (app.js) accepte deux options supplémentaires, utilisées UNIQUEMENT côté
  dégâts mob -> joueur (`resolveEnemyCounterAttack()`, jamais `performPlayerAttack()`) :
  `pressureFloor` (dégâts bruts jamais sous cette valeur absolue, avant mitigation — 10% des PV max du
  joueur) et `minMitigation` (la défense ne peut jamais faire tomber la mitigation sous cette fraction
  des dégâts bruts — 35%). Les mobs élites (`isEliteMob()`) reçoivent en plus
  `config.mobDamageScaling.eliteDamageMult` (×1.65) sur leur ATQ effective avant `rollDamage()`.
- **Rework des boss** (chantier "rework combat", Chantier 2 — voir `NOTES_COMBAT.md` pour le détail
  des valeurs) : un boss n'est plus "un mob avec plus de PV" — son pattern d'attaque change par palier
  de PV (`getBossPhase()`, 100-66%/66-33%/<33%), via `performBossCounterAttack()` (app.js), un chemin
  de riposte totalement séparé du mob normal/élite (`resolveEnemyCounterAttack()` bascule dessus dès
  `enemy.isBoss`, avant tout calcul lié au Chantier 1 — aucun recouvrement). Phase 1 : attaque de base
  + chance de télégraphier une attaque lourde (`enemy.status.telegraph`, tour d'annonce SANS dégât,
  tour d'exécution à `telegraphHeavyMult`). Phase 2 : reprend le télégraphe (chance réduite) + frappe
  multiple (2-3 coups/tour, `executeBossStrike()` réutilisé en boucle — voir plus bas pour le plancher
  de pression), harcèlement à distance (stub minimal, pont vers un futur Chantier 3 "enrage distance"
  pas encore implémenté) et buff de défense télégraphié ("il se hérisse",
  `enemy.status.defBuffed`, DEF boss effective ×`defBuffMult` pendant `defBuffRounds` tours — lu
  symétriquement aux réductions ébloui/corrodé existantes dans `performPlayerAttack()`). Phase 3
  ("folie") : plus de télégraphe, dégâts fixes `phase3.atkMult` (+40%) et DEF effective fixe
  `phase3.defMult` (-30%, `enemy.status.frenzied`) — la défense réduite EST la fenêtre
  risque/récompense de cette phase. Toutes les valeurs dans `config.bossPhases`. **Piège identifié et
  corrigé pendant ce chantier** : le plancher de pression du Chantier 1 (`pressureFloorFrac`, pensé
  "par ATTAQUE" = par tour) se multipliait par le nombre de coups sur un multi-coups sans correctif —
  `executeBossStrike(enemy, atk, label, pressureFloorOverride)` accepte désormais un plancher réparti
  explicitement entre les frappes d'un même tour, pour que la SOMME reste le plancher standard d'un
  tour de boss. Récompenses de boss (déjà en place avant le reste du chantier 2) :
  `config.bossRewards.minRarityKey` plombe la rareté du loot aléatoire garanti, et
  `awardBossSignatureItem()` attache en plus un objet signature légendaire unique par boss
  (`bestiary.js`, `districtBosses.*.signatureItem`, cloné frais à chaque victoire).
- **Enrage distance et engagement** (chantier "rework combat", Chantier 3 — voir `NOTES_COMBAT.md`
  pour le détail des valeurs) : anti-kite générique, tous mobs confondus (boss inclus).
  `enemy.kitingRounds` (base 1 pour un boss, 0 sinon — `mobKitingBaseline()`) s'incrémente à chaque
  tour où le mob reste à distance sans pouvoir attaquer (`noteMobKitingRound()`, appelée depuis
  `resolveEnemyReaction()`/`safeEnemyCounterAttack()`), remis à sa base dès qu'il frappe
  (`resetMobKiting()`, au tout début de `resolveEnemyCounterAttack()`). Probabilité d'enrage par tour :
  `min(0.15 + 0.15×kitingRounds, 0.80)`. Déclenché (`triggerMobEnrage()`), le mob comble l'écart d'un
  coup et place une frappe bonus immédiate (`config.distanceEnrage.atkMult`, +40%, via
  `executeBossStrike()` réutilisée telle quelle) ; cette frappe d'entrée ne compte volontairement PAS
  comme "il place un coup" pour la sortie anticipée — l'état `enemy.status.enraged` (2-3 tours,
  `defMult` ÷2 sur sa DEF effective, lu par `performPlayerAttack()`) s'installe SEULEMENT APRÈS elle,
  pour laisser une vraie fenêtre de burst au joueur (sans ce choix, la durée 2-3 tours aurait été
  inatteignable, la ruée portant toujours un coup). Une frappe RÉELLEMENT réussie pendant l'état y met
  fin immédiatement (`endMobEnrage()`, détecté pour un boss via le delta de
  `gameState.floorStats.damageTaken`), suivi d'un cooldown (`cooldownRounds`). Anti-abus mêlée collée :
  `meleeGluedDamageMult` (+10%) sur tout mob dès `gameState.combatDistance <= 0`. Nouvelle action
  joueur "Charger" (`attemptEngage()`, bouton `#btn-engage`) : ferme l'écart d'un coup sans jet opposé
  et enchaîne une attaque à `config.engageAction.atkMultiplier` (+25%), au prix de
  `gameState.engageDefHalved` (DEF joueur ÷2 pour la riposte qui suit, lu par `getEffectiveDef()`,
  consommé au tout début de la PROCHAINE action par `tryPlayerAction()` — même convention que
  `lastPlayerActionWasBackfire`).
- **Séquenceur de tour en beats** (chantier "lisibilité combat" — voir `NOTES_LISIBILITE_COMBAT.md`
  pour le détail des choix) : remplace l'ancien modèle "tout s'affiche en 0ms puis un verrou fixe de
  400ms" par une file d'étapes espacées dans le temps, `runCombatBeats(steps, onDone)` (app.js) —
  `steps` est un tableau de `{run, delay, skippable}` joué par callbacks `setTimeout` CHAÎNÉS,
  jamais de Promise/async-await (une vraie Promise diffère toujours sa continuation en microtâche,
  même résolue en synchrone — incompatible avec les 113+ sites d'appel synchrones de
  `tests/regression/*.js`/`tests/long_playthrough.js`). `tests/regression/_helpers.js` stub
  `global.setTimeout` (copie du stub déjà présent dans `tests/long_playthrough.js`) pour que toute la
  chaîne de beats se déroule en synchrone sous Node — aucun test existant n'a eu besoin d'être réécrit
  pour ça. Durées centralisées dans `config.combatRhythm` (`beatActionToRiposte` 280ms,
  `beatHeavyEvent` 550ms pour télégraphe posé/exécuté, ruée d'enrage et chaque frappe de phase 3,
  `beatMultiHit` 90ms entre les frappes d'un multi-coups après la première, `beatEmptyEvent` 0ms —
  jamais consommé par le séquenceur lui-même : les événements vides — riposte bloquée, repositionnement
  raté — court-circuitent AVANT d'y entrer, dans `safeEnemyCounterAttack()`/`resolveEnemyReaction()`).
  `enemyCounterAttack()`/`resolveEnemyCounterAttack()`/`performBossCounterAttack()`/
  `performBossCounterAttackInner()`/`triggerMobEnrage()` prennent désormais un `onDone` appelé une
  fois toute la séquence visuelle jouée (déverrouille les boutons via `setCombatInputLocked(false)`) —
  les FORMULES de dégâts restent strictement inchangées, seul leur RYTHME d'affichage change.
  `enemy.lastKnownPhase` (initialisé dans `initiateCombat()`) alimente désormais la bannière de
  changement de phase (voir juste en dessous, même chantier).
- **Bannière de changement de phase boss** (chantier "lisibilité combat", même contexte que le
  séquenceur ci-dessus — voir `NOTES_LISIBILITE_COMBAT.md`) : `performBossCounterAttackInner()`
  compare la phase du tour courant à `enemy.lastKnownPhase` AVANT toute sélection de pattern
  (`phaseJustIncreased = phase > enemy.lastKnownPhase`), met à jour ce dernier dans tous les cas, puis
  passe par une closure locale `runPattern(patternSteps)` (au lieu d'appeler `runCombatBeats()`
  directement, sur les 7 branches de pattern de la fonction) qui prépend un step d'annonce
  UNIQUEMENT si la phase vient de monter — jamais à l'entrée en phase 1 (état de départ, rien à
  annoncer). `announceBossPhaseChange(enemy, phase)` affiche `#phase-transition-banner` (texte
  différent phase 2/phase 3) puis la masque via un VRAI `setTimeout(900ms)` indépendant du rythme des
  beats (pas un step de `runCombatBeats`, pour ne pas coupler sa durée d'affichage au tempo qui peut
  s'accélérer juste après, en phase 3 notamment). Badge permanent `#boss-phase-badge` (à côté du nom,
  mis à jour à chaque `updateUI()`, visible dès phase ≥ 2 sur un boss uniquement) complète la bannière
  transitoire par un rappel permanent de l'état en cours.
- **`updateUI()` centralisé en fin de riposte** (chantier "lisibilité combat", Chantier 7 — voir
  `NOTES_LISIBILITE_COMBAT.md` pour le bug exact et comment il a été trouvé) : `enemyCounterAttack()`
  et `triggerMobEnrage()` (les deux seuls points qui verrouillent l'input, Chantier 6) appellent
  `updateUI()` dans leur `onDone`, juste après `setCombatInputLocked(false)` — remplace un
  `updateUI()` ad hoc qui ne vivait QUE dans `resolveNonBossCounterAttack()` (mob normal/élite) et
  qu'AUCUNE des 7 branches de pattern boss (`performBossCounterAttackInner()`) n'avait d'équivalent :
  en jeu réel, un télégraphe posé par un boss ne rafraîchissait donc jamais `#telegraph-banner`/
  `#enemy-status-icons` avant ce correctif (masqué dans tous les scripts de vérification des
  Chantiers 1/2/5/10 précédents, qui appelaient `updateUI()` à la main). Les deux appels devenus
  redondants (fin de `resolveNonBossCounterAttack()`, branche "étourdi" de
  `resolveEnemyCounterAttack()`) sont retirés, sans changement de comportement observable (même tick
  synchrone).
- **Skip de combat** (chantier "lisibilité combat", Chantier 9 — voir `NOTES_LISIBILITE_COMBAT.md`) :
  `combatSkipRequested` (module-level, pas `gameState`, même convention que `mobExamineOpen`) est lu
  par `runCombatBeats()` — un step sans `skippable: false` explicite voit son délai ramené à 0 dès que
  le drapeau est vrai. Posé par `requestCombatSkip()` sur un clic dans `#combat-zone` (filtré via
  `e.target.closest('button')`, pour qu'un clic sur une vraie action de combat ne se réinterprète
  jamais en demande de skip) ou un `keydown` Espace/Entrée au niveau du document (jamais si le focus
  est sur un `<input>`/`<textarea>`). Remis à `false` au tout DÉBUT de `enemyCounterAttack()`/
  `triggerMobEnrage()` plutôt qu'à la fin du tour précédent — sans ça, le clic qui démarre un tour
  (qui bulle aussi jusqu'à `#combat-zone`) pré-skipperait systématiquement son propre tour. Les beats
  de mort/fin de combat (hors du tableau `steps`, voir `strikeAndCheckDeath()`) restent
  structurellement insensibles au skip, sans qu'aucun step existant ait besoin de `skippable: false`.
- **Logs de combat allégés** (chantier "lisibilité combat", Chantier 8, dernier de la série — voir
  `NOTES_LISIBILITE_COMBAT.md`) : `executeBossStrike(..., silent)` (nouveau 6ᵉ paramètre) supprime la
  ligne de log INDIVIDUELLE d'un coup (jamais les dégâts/l'animation/l'effondrement d'un compagnon,
  toujours appliqués) — utilisé UNIQUEMENT par le pattern multi-coups (phase 2 boss), qui accumule les
  montants réellement encaissés (`strikeAndCheckDeath()` les renvoie désormais) et n'affiche qu'UNE
  ligne de résumé après la dernière frappe qui atteint sa cible (jamais si le joueur meurt en cours de
  rafale). Lignes d'attaque standard (joueur et mob) raccourcies (retire le remplissage "et infligez
  ... à", déplace la note d'état du mob après les dégâts) sans retirer d'information : audit des
  mentions d'état ennemi existantes (ébloui/corrodé/garde hérissée/folie/enrage) — toutes expliquent le
  calcul du coup en cours (DEF ennemie modifiée), aucune n'est une simple redite des badges du
  Chantier 2, donc aucune n'a été retirée.
- **Progression** : `gainXp()` — `xpToNextLevel` croît ×1.25 par niveau (jusqu'ici ×1.4, resserré pour
  éviter le mur de fin de run où les niveaux cessent de tomber pendant que les mobs continuent de
  grimper). Gains à chaque niveau : PV max +15 (fixe), ATQ `2 + floor(niveau/4)`, DEF
  `1 + floor(niveau/5)` (croissants avec le niveau ATTEINT, pour rester au niveau des mobs en fin de run).
- **Écran d'escalier** (`triggerFloorTransition()`/`continueFromFloorTransition()`) : affiché à la
  place d'un passage direct à l'étage suivant, dès qu'un gardien tombe (`winCombat()`, classique ET
  urbain) ou qu'une ville-escalier non gardée est atteinte (`arriveAtCity()`). Titre sarcastique tiré
  au sort (`FLOOR_TRANSITION_TITLES`) + résumé du tally de l'étage qui vient de se terminer
  (`gameState.floorStats` : `mobsKilled`/`damageTaken`/`itemsFound`/`xpGained`), alimenté au fil de la
  partie par des hooks UNIQUES — `winCombat()`, `gainXp()`, `addLoot()` (seulement si l'objet est
  effectivement conservé, pas sur "réserve pleine"), `applyPlayerDamage()` (point de passage UNIQUE
  pour toute perte de PV : piège, saignement, riposte ennemie — remplace toute mutation directe de
  `gameState.hp`, pour qu'un futur hook d'anomalie n'ait qu'ICI à s'accrocher). Bloque via
  `gameState.floorTransitionPending` (inclus dans `isActionBlocked()`) — JAMAIS `gameState.inCombat`,
  qui collisionnerait avec la logique générique "combat sans ennemi -> on referme" présente ailleurs
  (dont l'auto-résolveur de `tests/long_playthrough.js`, qui doit connaître ce flag comme tout autre
  état bloquant, voir Tests plus bas). `advanceToNextFloor()` (l'ancien `nextFloor()`, renommé) ne fait
  effectivement avancer l'étage — génération incluse, tally remis à zéro — qu'au clic sur "Continuer" ;
  `devJumpToUrbanFloor()` (DEV) l'appelle directement, sautant délibérément l'écran. Annonce de
  l'anomalie du prochain étage via `getUpcomingAnomalyAnnouncement(nextFloor)` — stub renvoyant `null`
  tant qu'aucun système d'anomalies n'existe (chantier séparé), seul endroit à modifier pour le
  brancher réellement : le bloc d'annonce de l'écran est déjà conditionnel (masqué si `null`).
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
  ZONE_MAGIQUE), `generateQuadrant()` (`extraRoomsPct` LABYRINTHE, +50% pièces par quartier),
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
- **Magie** : un seul sort équipé à la fois (`gameState.equipment.spell`), plus de simple attaque
  magique inconditionnelle. Répertoire de base dans `spellCatalog` (`spells.js`), deux catégories —
  corps à corps ou à distance (`spellCategory`) — qui font se comporter le bouton Magie exactement
  comme Arme/Tir : grisé au mauvais écart (`attackMagic()`/`updateUI()`). Un parchemin (catégorie
  `'scrolls'`) est généré par `generateSpellScroll()` au même titre que le reste du loot
  (`generateItem()`/`addLoot()`), avec une rareté qui fait grimper puissance ET coût en mana
  ensemble (pas de slots d'enchantement, contrairement aux armes/armures). Trouvé, il rejoint
  `gameState.spellbook` (inventaire magique séparé, jamais limité) plutôt que `gameState.inventory` ;
  `equipSpell()` l'équipe et renvoie l'éventuel sort précédent dans le grimoire, sans jamais le
  perdre. Le mana (`gameState.mana`, 0-100) n'existe visuellement pour le joueur qu'une fois un sort
  équipé, et se régénère comme les PV : passif via `applyTimeElapsedRegen()` (voir plus bas),
  potions (`item.mana` dans `items.js`), aide du compagnon Médecin.
- **Régénération passive (PV/mana)** : `applyTimeElapsedRegen(hours)` — PV **dégressif** selon le %
  de PV déjà restants (`HP_REGEN_TIERS` : 10/h sous 50%, 4/h entre 50-80%, 1/h au-delà — un vrai filet
  de sécurité en dessous, un simple filet d'eau au-delà), mana à **12/h** (seulement si un sort est
  équipé). Une salle sécurisée reste le seul moyen fiable de repartir plein PV/mana (soin complet à
  l'entrée, voir `enterRoom()`), mais à un coût en temps proportionnel à ce qui est régénéré. Appliqué
  à chaque fois que `gameState.timeLeft` diminue pour une raison "normale" (`performExploreStep()`,
  `travelToKnownLocation()`, `autoTravelToNearestFrontier()`) — jamais sur la perte de temps punitive du piège "Contretemps", qui
  perdrait sinon son sens.
- **Écran de départ** : `#start-screen-overlay` (saisie du nom, `confirmPlayerName()`) puis
  `#gift-reveal-overlay` (`revealWelcomeGift()`) recouvrent l'UI de jeu au chargement — celle-ci est
  déjà entièrement initialisée en arrière-plan (aucun état de jeu propre à ces deux écrans). Le
  cadeau de bienvenue est tiré au sort pondéré (`WELCOME_GIFT_WEIGHTS`/`rollWelcomeGiftType()` :
  Arme > Rien > Tir > Magie) puis équipé directement (`generateWelcomeGiftItem()` dans
  `generator.js`, toujours au palier Commun), avec une blague sarcastique par type
  (`flavorText.welcomeGift`). `resetGame()` recharge la page : l'écran de départ réapparaît
  naturellement à chaque nouvelle partie.
- **Sauvegarde** : une entrée `localStorage` par nom de crawler (`SAVE_KEY_PREFIX`,
  `saveKeyForName()` — casse/espaces ignorés à la clé, casse d'origine conservée dans le JSON).
  Autosauvegarde via `saveGame()`, appelée en dernière ligne d'`updateUI()` (déjà invoquée après
  quasiment toute action) ; no-op tant que `gameState.saveEnabled` est faux, pour ne jamais écraser
  une sauvegarde pendant l'initialisation silencieuse au chargement, avant que le joueur n'ait
  confirmé son nom. `confirmPlayerName()` vérifie si le nom saisi correspond à une sauvegarde
  (`hasSaveForName()`) : si oui, `restoreSaveForName()` la restaure directement (aucun cadeau de
  bienvenue) ; sinon, nouveau crawler comme avant. La restauration nettoie systématiquement tout état
  transitoire/bloquant (combat en cours, choix en attente) : on atterrit toujours sur l'écran
  d'exploration normal. `listSavedCrawlerNames()` alimente l'indice affiché sur l'écran de départ.
  **Nettoyage des sauvegardes** (`#btn-open-manage-saves` sur l'écran de départ, `openManageSaves()`) :
  liste détaillée (`listSavedCrawlersDetailed()` — nom/étage/horodatage `gameState.lastSavedAt`, posé
  par `saveGame()`) avec suppression individuelle ou totale, TOUJOURS via `pendingSaveDeletion`
  (`requestDeleteSave()`/`requestDeleteAllSaves()` posent l'action, `confirmSaveDeletion()` l'exécute,
  `cancelSaveDeletion()` l'annule) — structurellement impossible de supprimer sans confirmation
  explicite, aucun appelant ne touche `localStorage.removeItem` directement. Un slot de backup UNIQUE
  (`SAVE_BACKUP_KEY`, écrasé à chaque nettoyage — pas un historique) garde le JSON brut de chaque
  sauvegarde sur le point d'être supprimée, round-trip exact ; `restoreSavesBackup()` le réécrit tel
  quel à ses clés d'origine, restaurable plusieurs fois de suite (le backup n'est effacé qu'en étant
  écrasé par un nettoyage suivant, jamais par une restauration).
- **Étages urbains** (multiples de 3 — `config.urbanFloors`, `generateUrbanFloorMap()`) : un réseau
  de villes sûres (`gameState.urbanMap.citiesById`) reliées par des routes dangereuses, en
  remplacement du donjon classique à 4 quartiers pour cet étage (`floorMap`/`urbanMap` sont
  mutuellement exclusifs, `nextFloor()` bascule sur `currentFloor % 3 === 0`). `theme` réutilise TEL
  QUEL le nom d'un quartier existant de `districts.js`/`bestiary.js` comme thématique unique de tout
  l'étage : `generateMob()`/`generateBoss()` n'ont besoin d'aucune adaptation (`gameState.currentDistrict`
  y reste aligné en permanence). Déplacement via `travelToCity()` — calqué sur
  `travelToKnownLocation()` (coût en temps + embuscades proportionnels à `computeCityDistance()`,
  Dijkstra équivalent à `computeDistance()`) — avec découverte progressive (`city.known`, révélé
  ville par ville via `revealCityNeighbors()`). Une ville (jamais la ville de départ) porte
  l'escalier, avec une chance de garde croissante avec la profondeur
  (`config.urbanFloors.stairsGuardChanceByFloor` : 20/35/50/65 % aux étages 3/6/9/12, 80 % à
  l'étage 15) ; le combat de gardien réutilise le même bloc UI que `triggerBossEncounter()`
  (`#boss-choice-zone`), dispatché séparément (`triggerUrbanBossEncounter()`/`fightUrbanBossNow()`/
  `retreatFromUrbanBoss()`, voir le dispatch dans `fightBossNow()`/`retreatFromBoss()`) car les
  données sous-jacentes (villes) ne sont pas des pièces de donjon. **Étage final** (18,
  `config.urbanFloors.finalFloor`) : la ville tirée devient la Sortie (`city.isExit`), **toujours**
  gardée (100 %, jamais de pourcentage) ; la vaincre (ou la trouver non gardée) déclenche `winGame()`
  (`gameState.hasWon`) plutôt que `nextFloor()` — écran de victoire calqué sur Game Over, jamais
  d'étage 19 généré. Côté UI, la Carte Urbaine (`#urban-map-svg`, rempli par `updateUrbanMapUI()`)
  s'affiche en **overlay directement sur la carte active** (`#urban-travel-overlay`, dernier enfant de
  `#card-stack-wrapper`) plutôt qu'en panneau séparé — l'inventaire plus bas reste toujours accessible
  normalement. Masqué dès qu'une "situation" est en cours (combat/boss/furtivité/compagnon,
  `isActionBlocked()`) : la carte redevient alors visible et se comporte exactement comme sur un étage
  classique (toggle dans `updateUI()`). Le déplacement s'y représente comme une **mini carte
  graphique** (nœuds = villes, arêtes = routes) plutôt qu'une liste, sur une **grille logique** (gx/gy
  entiers, `URBAN_GRID_CELL` = 70 unités monde par cellule) plutôt qu'un gabarit de points fixes :
  `generateConnectedCityGrid(cityCount)` fait croître une région CONNEXE par construction (chaque
  nouvelle cellule tirée adjacente à une cellule déjà choisie, départ toujours en `cells[0]`) —
  connexité garantie sans réparation après coup, contrairement à l'ancien arbre couvrant. Les routes
  sont TOUTES les paires de cellules choisies adjacentes 8-directions (`computeGridAdjacencyPairs()`,
  N/S/E/O + diagonales, jamais de connexion longue distance façon étoile) : presque toujours plus d'un
  chemin possible entre deux villes, sans étape de bouclage séparée. Position d'AFFICHAGE (`city.x`/
  `city.y`, dérivée de `gx`/`gy` × `URBAN_GRID_CELL`) passée UNE fois par `computeDeclutterLayout()`
  (répulsion pure, déterministe — aucun `Math.random()` — déplacement plafonné depuis la position de
  départ) puis figée pour de bon ; sur une grille pure l'espacement minimal (70) dépasse déjà le
  `minDist` du déclutter (50), donc cette passe est un no-op ici — conservée telle quelle pour une
  future disposition plus dense qui en aurait vraiment besoin (voir aussi `computeGraphLayout()`,
  toujours réservée à un futur layout calculé depuis rien). Un **fond décoratif** "pâtés de maisons +
  avenues" (`URBAN_MAP_BACKGROUND`, généré une seule fois avec un seed FIXE via `mulberry32()`, jamais
  `Math.random()`) couvre une étendue MONDE fixe et généreuse (`URBAN_MAP_WORLD_EXTENT`), rigoureusement
  identique d'une partie à l'autre. La **caméra** est un monde PANNABLE par glissement (souris et
  tactile) plutôt qu'un simple recentrage automatique : `gameState.urbanMap.camera` (`null` = centrée
  sur la ville courante par défaut, un `{x,y}` = position choisie par le joueur en glissant la carte,
  via `onCameraChange` de `renderGraphMiniMap()`) est réinitialisée à `null` à chaque arrivée dans une
  nouvelle ville (`arriveAtCity()`, "la caméra suit de nouveau le joueur") et par le bouton
  `#btn-recenter-map` (`recenterUrbanMap()`). Écrêtée aux limites du réseau connu
  (`computeDefaultWorldBounds()`/`clampCameraToBounds()`, marge ≥ la moitié de la fenêtre affichée —
  sans quoi une ville de bord de zone connue ne pourrait jamais être parfaitement centrée). Le gardien
  de l'escalier/Sortie garde sa ville normale (icône générique) mais son icône (👑) est dessinée à
  part, décalée d'une distance fixe en pixels sur SA route d'accès plutôt que confondue avec le cercle
  de la ville — "posté sur la route". `buildUrbanMapGraphData()` (seule partie qui connaît la forme des
  données du jeu) adapte le réseau villes/routes connu au format générique nœuds/arêtes/positions
  attendu par `renderGraphMiniMap()` — voir la section **Mini carte graphique** ci-dessous.
- **Système d'argent (PO)** : `gameState.gold`, seule monnaie du jeu. Deux sources : quelques PO
  trouvées en explorant (`config.chances.goldFind`, D100 au même titre que le reste du loot) et
  `sellItem(index)` (`SELL_VALUE_RATIO = 0.4` × `item.baseValue`, objet retiré de l'inventaire).
  Dépensée exclusivement dans les villes spécialisées (marchand/professeur, voir ci-dessous) — pas
  d'autre sink pour l'instant.
- **Villes spécialisées (marchand/professeur)** : à la génération d'un étage urbain, **une ville
  normale est TOUJOURS marchand, une autre TOUJOURS professeur** (ni départ, ni escalier/Sortie —
  chantier "QoL/équilibrage", Chantier D, voir `NOTES_QOL_EQUILIBRAGE.md` : avant ce chantier les deux
  étaient purement probabilistes et un étage urbain pouvait n'avoir ni l'un ni l'autre). Les deux
  villes garanties sont tirées sans remise (mélange Fisher-Yates) parmi les candidates restantes ;
  `config.urbanFloors.specializedCityChance` (18%) ne gouverne plus que les éventuelles villes
  spécialisées SUPPLÉMENTAIRES, tirée indépendamment par ville candidate restante (comportement
  probabiliste inchangé pour celles-là). Un marchand vend une catégorie d'objet (`city.specialty` ∈
  armes/armes à distance/armures/parchemins) ; un professeur forme UNE des 4 compétences réelles du
  joueur (`gameState.skills`, pas de "compétence armure" — contrairement aux objets, une compétence
  n'a que 4 valeurs possibles). `triggerShopEncounter(city)` (dispatché depuis `arriveAtCity()`, avant
  la résolution générique "ville sûre") ouvre `#shop-zone` et pose `gameState.shopChoicePending`
  (inclus dans `isActionBlocked()`, comme un choix de boss). `generateShopStock(specialty)` tire 3
  objets une seule fois par partie (`city.stock`, jamais régénéré), prix = `item.baseValue ×
  SHOP_MARKUP` (2.5) ; `buyShopItem()`/`sellItem()` sont les deux faces du même
  `SELL_VALUE_RATIO`/`SHOP_MARKUP`, volontairement asymétriques (acheter coûte plus cher que vendre ne
  rapporte). `sellSpell()` est le pendant de `sellItem()` pour `gameState.spellbook` (Chantier D,
  section boutique dédiée `#shop-sell-spells-list`) — les parchemins (`generateSpellScroll()`) posent
  désormais `baseValue` (dérivé du `baseDmg` NON scalé du sort de base, jamais affecté par la rareté —
  même convention que `baseValue` sur les objets classiques dans `items.js`), corrigeant au passage un
  bug préexistant où un marchand de parchemins vendait systématiquement à 2-3 PO (repli `baseValue ||
  1` dans `generateShopStock()`, faute de `baseValue` réel). `trainSkill()` paie
  `TRAINER_COST_PER_LEVEL` (20) × le niveau ACTUEL de la compétence pour l'amener exactement au niveau
  suivant (`gainSkillXp(specialty, xpToNext - xp)`) — "payer pour s'entraîner" plutôt que le grind
  combat habituel, jamais un raccourci gratuit.
- **Repaires sur les routes** : `config.urbanFloors.lairRoadsPerFloor` (1, 2 à l'étage final) routes
  du réseau urbain sont désignées "repaire" à la génération (`generateUrbanFloorMap()`), tirées parmi
  toutes les paires ville-ville reliées, `isLair`/`lairId` posés sur LES DEUX sens de la route (comme
  `distance`) pour rester détectables quel que soit le sens du trajet. `gameState.urbanMap.lairsById`
  garde l'état (`cleared`, `combatsRemaining` 2 ou 3, `bossInstance`). `travelToCity()` détecte un
  repaire uniquement sur la route DIRECTEMENT empruntée (voisin immédiat) — un trajet à plusieurs
  sauts vers une ville plus lointaine ne suit aucun chemin réel (`computeCityDistance()` ne fait que
  sommer des distances par Dijkstra) et ne peut donc pas "passer par" une route précise. Non nettoyé,
  il déclenche `triggerLairChoice()` (choix plonger/poursuivre, `gameState.lairChoicePending`, inclus
  dans `isActionBlocked()`) AVANT toute embuscade normale du trajet, qui reste en attente
  (`pendingUrbanTravel` non consommé) le temps du choix. Poursuivre (`declineLair()`) reprend le
  trajet normalement, repaire intact, re-proposé à un futur passage. Plonger (`diveIntoLair()`) lance
  le premier combat forcé ; `winCombat()` enchaîne alors seul les sbires restants puis le boss
  (`gameState.pendingLairDive.stage`, `'trash'` → `'boss'` — boss généré seulement à ce moment, jamais
  à l'avance) AVANT de reprendre le trajet interrompu, pour qu'une victoire sur un simple sbire ne
  soit jamais prise pour l'arrivée à destination ; le butin garanti d'un repaire n'est qu'un combat de
  boss normal (`winCombat()` garantit déjà du loot à tout `wasBoss`, rien de spécifique à dupliquer).
  Une fuite réussie en pleine plongée (`attemptFlee()`) annule la plongée SANS marquer le repaire
  nettoyé ni reprendre automatiquement le trajet interrompu — même comportement passif qu'une fuite
  d'embuscade urbaine normale. Visualisé sur la Carte Urbaine via `edges[].marker` (voir Mini carte
  graphique ci-dessous) : 💀 rouge tant qu'actif, 🏆 gris une fois nettoyé — jamais un `goalIcon`,
  une route reste toujours franchissable (contrairement à un gardien qui bloque le passage).
- **Mini carte graphique (réutilisable)** : `renderGraphMiniMap(svgEl, {nodes, edges, positions,
  currentId, onNodeClick, camera, viewSize, worldBounds, onCameraChange, background})` (rendu SVG,
  aucune connaissance du jeu) est le module générique — `positions` en coordonnées MONDE (unités
  arbitraires, plus de normalisation 0..1 : le viewBox reflète directement `camera ± viewSize/2`,
  aucune mise à l'échelle interne). Trois familles de marqueurs, jamais confondues : `node.goalIcon`
  (décalé sur SA route d'accès, bloque le passage — gardien 👑) vs `node.badge` (fusionné au cercle du
  nœud, ne bloque rien — marchand 🛒/professeur 🎓) vs `edges[i].marker` (au milieu de l'arête
  elle-même, n'appartient à AUCUN des deux nœuds — repaire 💀/🏆).
  **Caméra pannable** : sans `camera` explicite, centrée sur `currentId` puis, à défaut, sur la boîte
  englobante de tous les nœuds (`computeDefaultWorldBounds()` calcule des bornes par défaut si
  `worldBounds` est omis) — c'est à l'APPELANT de mémoriser un `camera` explicite d'un rendu à l'autre
  (ce module ne garde aucun état lui-même). Avec `onCameraChange`, le pan par glissement (souris ET
  tactile, `pointerdown`/`pointermove`/`pointerup`) s'active sur `svgEl` : le viewBox se déplace EN
  DIRECT pendant le glissement (mutation d'un seul attribut, jamais un re-rendu complet — coûteux à
  chaque `pointermove`, vu le volume du fond décoratif), `onCameraChange` n'étant appelé qu'UNE fois à
  la fin pour que l'appelant persiste la position. Un relâchement sous 5px de mouvement reste un
  tap/clic, résolu en retrouvant le nœud le plus proche du point relâché par distance MONDE
  (`clickableRegions`, rempli au fil du rendu) plutôt que via le `click` natif du navigateur — **ce
  dernier s'est avéré peu fiable une fois qu'un pointeur a été capturé pendant l'interaction** (même
  relâché ensuite : constaté en conditions réelles avec Playwright, pas qu'en environnement de test —
  si jamais retenté, bien re-vérifier en navigateur, pas seulement via `tests/test_stub.js`). Sans pan
  (`onCameraChange` absent), aucun pointeur n'est jamais capturé et le `click` natif classique reste
  utilisé directement sur chaque nœud, comme avant ce système. `clampCameraToBounds()` (écrêtage pur,
  testable seule) empêche le pan de sortir des `worldBounds`.
  `computeGraphLayout(nodeIds, edges, existingPositions)` (disposition par relaxation "force-directed"
  minimaliste avec ressorts + attraction centrale, sans dépendance externe) reste disponible pour un
  futur cas qui aurait vraiment besoin d'un layout calculé depuis rien plutôt qu'une grille logique —
  non utilisée par les étages urbains, mais conservée telle quelle (testée, mobilité 1/0.08 pour
  rester stable d'un rendu à l'autre) pour un futur système de navigation basé sur un graphe (mini-plan
  de donjon classique par exemple). `computeDeclutterLayout(basePositions, ids, {minDist, iterations,
  maxShift})` (répulsion PURE, sans ressort ni attraction, contrairement à `computeGraphLayout()`) est
  le second module de layout : pas un calcul depuis rien, une petite correction déterministe d'un
  layout déjà bon (la grille urbaine) pour écarter les points trop proches sans le déformer — voir
  Étages urbains ci-dessus pour son usage concret.

## Conventions de travail
1. Lire les fichiers actuels avant modification (git natif ici, pas de resync manuel nécessaire).
2. `node --check fichier.js` avant tout commit.
3. Tester avant de pousser (voir `tests/` ci-dessous) — étendre les fichiers existants, ne pas les
   recréer de zéro.
4. Incrémenter le suffixe `?v=N` sur tous les `<script>` d'`index.html` à chaque changement d'un `.js`.
5. Un correctif d'équilibrage (stats, taux, formules) se propose en LISTE à valider — jamais appliqué
   directement sans validation explicite.
6. **Versioning (à chaque merge de PR)** : incrémenter `APP_VERSION` (`app.js`), mettre à jour le
   `?v=` de TOUS les `<script>` d'`index.html` au même nombre (convention 4 ci-dessus reste valable
   pour les changements intermédiaires hors merge), puis créer un tag git `v<APP_VERSION.pr>` sur le
   commit de merge et une GitHub Release portant le même numéro. Non automatisé pour l'instant (pas de
   script de release) — à faire à la main à chaque merge.
   **État actuel (constaté, pas corrigé silencieusement — voir Tâche 5 du chantier
   "fiabilisation")** : `APP_VERSION.pr` (20) et le `?v=` d'`index.html` (57) ne sont PAS la même
   chose et ne l'ont jamais été — `APP_VERSION.pr` suit le numéro de la dernière PR mergée sur `main`
   (incrémenté une fois par PR), `?v=` suit le nombre de changements de fichiers `.js` (incrémenté
   bien plus souvent, à chaque modification d'un `.js`, y compris plusieurs fois au sein d'une même
   PR). Les deux compteurs ont donc mécaniquement des rythmes différents et n'ont pas de raison de
   converger tout seuls. La convention ci-dessus, pour être suivie à la lettre, demande de les
   FUSIONNER en un seul et même nombre à partir de maintenant — ce qui suppose de choisir un point de
   départ pour ce nombre unique (reprendre 57 ? reprendre 20 et laisser `?v=` "rattraper" son retard
   au prochain changement de `.js` ? repartir de 1 ?) : un choix qui n'appartient pas à Claude Code de
   trancher seul, laissé à la personne qui lit ceci. `package.json` (`version: "20.0.0"`, Tâche 1) suit
   pour l'instant `APP_VERSION.pr`, donc hérite de la même question.

## Tests (`/tests`, deux vitesses)
- `tests/test_stub.js` — stub DOM minimal pour exécuter le jeu sous Node. `tests/load_game.js` —
  charge les 8 fichiers sources dans l'ordre.
- `npm test` (= `node tests/regression.test.js`), `npm run test:long` (= `node tests/long_playthrough.js`),
  `npm run test:all` (les deux à la suite, s'arrête au premier échec) — voir `package.json`.
- **Rapide** (`npm test`, quelques secondes) : à lancer avant CHAQUE push. `tests/regression.test.js`
  est un AGRÉGATEUR (depuis la Tâche 2 du chantier "fiabilisation" — l'ancien fichier monolithique
  faisait ~172 Ko) : il ne fait que `require()` chaque module de `tests/regression/*.js`, regroupés
  par domaine (`meta-reset.js`, `combat.js`, `combat-scaling.js`, `combat-boss.js`,
  `combat-enrage.js`, `items.js`, `misc.js`, `magic.js`, `saves.js`,
  `floor-transition.js`, `necrologie.js`, `anomalies.js`, `urban-floors.js`, `balance.js`,
  `urban-map.js`, `urban-shops.js`, `urban-lairs.js`), dans l'ordre où chacun apparaît en tête de
  liste dans `regression.test.js` — cet
  ordre correspond à la position de la PREMIÈRE section de chaque module dans l'ancien fichier
  monolithique, pour rester aussi proche que possible de l'ordre d'exécution d'origine (les tests
  restent malgré tout indépendants : chaque section démarre par `resetTransientState()`).
  `tests/regression/_helpers.js` centralise le chargement du jeu (une seule fois, via le cache de
  `require()` — peu importe combien de modules l'importent), `assert()` et `resetTransientState()`,
  avec un compteur d'assertions PARTAGÉ (`counts`, objet muté par référence) pour que l'agrégateur
  affiche un résumé global à la fin. Étendre une feature existante : ajouter une section au module de
  domaine concerné (jamais dans `regression.test.js` directement). Nouveau domaine : nouveau fichier
  dans `tests/regression/`, puis l'ajouter à la liste de `require()` de l'agrégateur.
  `resetTransientState()` (dans `_helpers.js`) doit rester à jour : tout nouvel état
  bloquant/transitoire (`xyzChoicePending`, `pendingXyz...`) doit y être remis à zéro, sinon un échec
  aléatoire (dû à un test antérieur non lié) peut fuiter sur des tests bien plus loin dans la suite —
  voir `tests/regression/meta-reset.js` ci-dessous, qui détecte cette classe de bug AUTOMATIQUEMENT.
- **Règle : tout nouveau champ transitoire de `gameState` doit être ajouté à `resetTransientState()`
  ET répertorié dans `KNOWN_GAMESTATE_KEYS`** (`tests/regression/meta-reset.js`, Tâche 3 du chantier
  "fiabilisation"). Ce test méta détecte AUTOMATIQUEMENT (sans liste à maintenir à la main pour cette
  partie) deux classes de fuite d'état, responsables de plusieurs échecs flaky lointains par le passé
  (`timeLeft` oublié, champs d'anomalies, un cas `travelToCity`) : (1) tout champ nommé `*ChoicePending`
  ou `pending*` est délibérément "sali" (valeur truthy) puis vérifié falsy juste après
  `resetTransientState()` — cette convention de nommage est déjà strictement respectée par tout état
  bloquant/transitoire existant ; (2) toute clé de `gameState` LUE par `isActionBlocked()` doit être
  explicitement AFFECTÉE dans le corps de `resetTransientState()` (comparaison directe des deux sources
  via `.toString()`), pour qu'un nouveau `xyzChoicePending` ajouté à l'un des deux sans l'autre échoue
  immédiatement plutôt que de fuiter silencieusement. `KNOWN_GAMESTATE_KEYS` (liste blanche EXPLICITE,
  celle-ci À MAINTENIR À LA MAIN) complète ces deux mécanismes pour toute clé de `gameState` qui
  n'entre dans aucun des deux (ex. `xp`/`xpToNextLevel`/`skills`, repérés et corrigés en écrivant ce
  test — non-transitoires au sens "blocage", mais tout de même remis à un niveau de base par
  `resetTransientState()` pour l'isolation des tests) : une clé absente de `gameState` mais présente
  dans la liste (ou l'inverse) fait échouer ce test, forçant une décision consciente à chaque nouveau
  champ plutôt qu'un oubli silencieux.
- **Lourd** (`npm run test:long`, simulation ~200 pas sur plusieurs étages) : à lancer UNE fois,
  seulement si le changement touche la boucle de jeu elle-même (combat, distance, compagnon,
  génération d'étage). Pas nécessaire pour un ajout de contenu isolé (item, quartier, texte).
  Son auto-résolveur doit connaître TOUT état bloquant existant (`xyzChoicePending`) : en oublier un
  fige la simulation dessus jusqu'à épuisement du temps imparti (voir `shopChoicePending`/
  `lairChoicePending`/`floorTransitionPending`/`pactChoicePending`, ajoutés après coup).
- Les deux n'affichent que les échecs + un résumé final (pas une ligne par test réussi).
- **CI** (`.github/workflows/ci.yml`) : sur chaque push (toute branche) et chaque pull request,
  `actions/checkout` + `actions/setup-node` (Node 20) puis `npm test` et `npm run test:long` — pas de
  `npm install` (aucune dependency/devDependency), pas de cache, pas d'artefact, volontairement minimal.
  Après un push, le statut de ce workflow devient LA RÉFÉRENCE : le protocole "20+ runs consécutifs en
  local avant de pousser" reste utile pour chasser le flaky avant même d'arriver jusque-là, mais un
  push dont la CI passe au rouge doit être corrigé avant de continuer sur autre chose.

## Backlog
- Sons : hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).
- À valider par playtest réel : fréquence de changement de quartier, formule de risque des trajets
  vers lieux connus (distance × 9 %, plafond 80 %), courbes de furtivité, table D100 des événements
  (`config.chances` — une proposition de rééquilibrage a été faite, jamais validée).
- Simulation mob/joueur (voir historique) : les boss restent disproportionnellement plus punitifs
  que les mobs normaux à profondeur égale, et l'écart se rouvre en fin de run (étage 8+) sous
  l'hypothèse testée — non corrigé, à confirmer par playtest réel avant tout changement.
- Économie urbaine (PO, marchand/professeur, repaires — voir Architecture) : tous les chiffres sont
  des défauts posés sans playtest (18% de ville spécialisée, ×2.5 marchand / ×0.4 revente, ×20 coût de
  formation par niveau, 5-20 PO trouvées ×(1+étage×0.15), 1 repaire par étage urbain / 2 à l'étage
  final, 2-3 combats forcés par repaire) — "on verra à l'usage", à ajuster une fois du retour réel
  disponible plutôt qu'en tâtonnant sans données.

## Gros chantiers à venir (non commencés — demander lequel prioriser avant de s'y lancer)
- Sons
- Succès (achievements)
- Salles spéciales à choix narratif basé sur les compétences, sans fuite possible

## Notes
- GitHub Pages sert tout le dépôt tel quel : `/tests` n'affecte pas le jeu, pas besoin de l'exclure.
- Pas de framework, pas de bundler : tout doit rester exécutable en ouvrant `index.html` tel quel.
