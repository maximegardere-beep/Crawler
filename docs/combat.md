# Combat : distance, furtivité, mobs élite, début de partie, boss, enrage, séquenceur de beats, logs

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/combat*.js, engine/origins-effects.js, generator.js, bestiary.js.

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
- **Mobs élite** : `generateMob()` pose `threatMultiplier` (puissance apportée par les seuls
  modificateurs, hors scaling d'étage) via `computeThreatMultiplier()` (generator.js, fonction pure et
  testable indépendamment du pipeline aléatoire) — ATQ×PV pondéré par la DEF avec un poids modéré
  (0.5), pour qu'un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
  ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule. Au-delà de
  `config.eliteThreatMultiplier`, icône 💀 (jamais sur un boss, qui garde 👑 — voir `isEliteMob()`).
  **Convention collective du Donjon** (chantier 15, lot 1, `config.earlyGame.elites`, voir `NOTES_DEBUT_DE_PARTIE.md`) : aux étages 1-2 `generateMob()` re-tire le mob tant qu'il serait une élite
  (`isEarlyEliteFreeFloor()`, tous les chemins de génération couverts d'un coup) ; aux étages 3-4 `eliteDamageMultForFloor()` (generator.js, pure) donne ×1,3 / ×1,5 à la place de ×1,65, lu par
  `resolveEnemyCounterAttack()` — jamais pour un chasseur de primes (ses stats sont calées sur ×1,65). `config.earlyGame.enabled = false` redonne le comportement d'avant.
  **Remplaçant intérimaire** (lot 2) : `generateBoss()` applique `earlyInterimBossScale()` (PV et ATQ ×0,75, étages ≤ `config.earlyGame.maxFloor`, DEF/XP/récompenses inchangées) et pose `boss.isInterim` + le suffixe « (intérimaire) » au nom
  (`baseName` inchangé : sprite et objet signature) — gardien d'escalier, boss de quartier et boss de repaire d'un coup ; `initiateCombat()` affiche une réplique d'accueil (`interimBossLine()`).
  **Période d'essai** (lot 3) : `trialDamageMult(level, floor)` (generator.js, pure) = `1 − 0,40 × (7 − niveau)/6` aux étages ≤ `maxFloor` (aucun état sauvegardé), appliquée par `applyTrialToDamage()` (app.js) AUX MÊMES points que le buff de
  départ — coup encaissé (`companionInterceptHit()`), pièges, saignement — pour que journal et PV restent d'accord ; badge `#trial-status` (`updateTrialStatusUI()`), message de fin à l'arrivée sur l'étage 4. Les PV épargnés
  sont comptés (`runStats.trialAvoided`) et réajoutés à la facilité des victoires (`recordRunEvent('win')`) : la prime des chasseurs ne grimpe pas plus vite. Dans les tests, la réduction est NEUTRALISÉE par défaut (`_helpers.js`) et réactivée par `withTrial()`.
  **Armure de scénario** (lot 4) : `applyPlotArmor()` (app.js), appelée par `applyPlayerDamage()` AVANT `applyRaceLastStand()` (l'Increvable du Cafard reste disponible : à 1 PV aucun des deux ne rejoue) — aux étages ≤ `maxFloor`, le premier coup mortel de chaque étage
  (`gameState.plotArmorFloor`, sauvegardé, ancienne sauvegarde → 0) laisse `plotArmor.leaveHp` PV, boss compris ; en combat, le reste du tour ennemi est absorbé (`status.plotShield`, éteint par `tryPlayerAction()` et aux fins/débuts de combat). `applyPlayerDamage()` renvoie désormais
  les PV réellement perdus et les deux ripostes de combat (mob, `executeBossStrike()`) journalisent ce montant. `recordRunEvent('plotArmor')` → `runStats.plotArmorUses`. Interrupteur propre `plotArmor.enabled`, neutralisé par défaut dans les tests (`withPlotArmor()`).
  **Habillage** (lot 5) : piques DeathWatch `trial`/`trialEnd`/`plotArmor`/`interim` (champs `essai`, `essaiPct`, `finEssai`, `scenario`, `interimKills` de `buildShowContext()`), succès `plot_armor`/`interim_slain` (`runStats.interimKills`), et `announceEliteConventionEnd()` (message unique à la première élite, `gameState.eliteConventionEnded`).
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
  tour de boss. Récompenses de boss (revues par le chantier "refonte des objets") : un objet garanti
  (`itemBalance.boss` : +1 palier, plancher selon l'étage, second objet à 25 %) et l'objet signature
  du boss, dont la rareté suit l'étage (`getSignatureRarity()` : Rare 1-4, Épique 5-9, Légendaire 10+) (`bestiary.js`, `districtBosses.*.signatureItem`, stats de base mises à l'échelle par
  `buildSignatureItem()`), **exclusivement offert par un Coup de grâce parfait** (chantier 6, V3 : 100 % avec, 0 % sans — ni garantie à la
  première victoire, ni chance de répétition ; `awardBossSignatureItem()`, `gameState.signaturesAwarded` ne sert plus qu'au succès « collectionneur »).
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
