# Mini-jeux (épreuves, Occasions, boss, salle de jeux)

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : minigames.js, minigames-ui.js, engine/occasions.js, engine/shops.js.

- **Mini-jeux** (chantier 6, lot 0, V1, V2, V3, V4 et lot final codés — crochetage, désamorçage, glyphe, Occasions de combat, épreuves de boss, salle de jeux ; voir
  `NOTES_MINIJEUX.md` ; le reste du chantier est planifié dans `CHANTIERS.md`) : toute épreuve passe par UN point d'entrée, `startMinigame(spec, onResult)` (minigames-ui.js), par
  callback (jamais de Promise, comme `runCombatBeats()`). Trois issues communes `perfect`/`success`/`fail`. Sans
  interface interactive (réglage « Jet automatique », `prefers-reduced-motion` par défaut, tests Node sans
  `requestAnimationFrame`), l'épreuve est résolue par `minigameAutoOutcome()` et `onResult` est appelé avant le retour ;
  sinon `gameState.pendingMinigame` (dans `isActionBlocked()`) et la bande `#minigame-strip` en bas de l'écran (jamais
  un overlay plein écran), minuterie plafonnée (temps écoulé = Raté), Échap = Passer, Espace/Entrée = geste principal.
  L'issue se joue par `playMinigameOutcomeFx()` (fx.js, acteur `mini`, spécification pure `minigameOutcomeFxSpec()` :
  gel d'impact et secousse d'écran réservés au Parfait) puis enchaîne sans fenêtre de résultat. `runCombatBeats()`
  accepte une étape `{ interactive: true, run(done) }`. **Ajouter une épreuve** : entrée de `MINIGAME_KINDS`, rendu dans
  `MINIGAME_RENDERERS`, entrée de `MINIGAME_KIND_FX` (exigés par `tests/regression/minigames.js`) ; un tap passe par
  `bindTap()` (pointerdown PUIS click : jamais deux écouteurs bruts). **V1** : un « Trésor » sur deux est un coffre verrouillé
  (`openLockedChest()` : 3 goupilles, butin selon le nombre — `LOCKPICK_REWARDS`), un piège sur deux se désamorce
  (`openTrapDisarm()` : séquence de 4 symboles ; raté = `springTrap()` comme avant) et `attackMagic()` propose un glyphe aux sorts
  offensifs (`maybeGlyphSpec()` puis `castEquippedSpell()` ; renfort `config.magicBalance.glyph*`, raté = sort normal). Le jet
  automatique d'une épreuve peut avoir sa propre résolution (`autoResolve`). **V2 (Occasions de combat)** : au début d'un tour,
  `rollCombatOccasion()` (appelée par `updateUI()`, une fois par tour) tire 25 % (+1 %/niveau de compétence liée, Réduit 10 %, Jet
  automatique 0, jamais deux d'affilée, garantie au 7e combat sans) via `decideOccasion()` (pure) ; `gameState.occasion` = `{ current,
  turn, rolledTurn, lastOfferTurn, pity }`, `#btn-occasion` ; toute action (`tryPlayerAction()`) l'éteint. `startOccasion()` →
  `resolveOccasion()` : Immobiliser (`enemy.status.immobilized`, riposte sautée, 1-2 tours, boss 1), Étrangler (×3, proposé à coup sûr sur un
  mob non-boss immobilisé/étourdi), Cible de précision (×1,5 / ×1) et Point faible (tête ×1,3 / bras `status.weakened` / jambe recule) ;
  échec = tour perdu. Jamais d'Occasion sans interface interactive (tests Node, simulation longue). **V3 (boss)** : `runBossTrial()` ouvre une
  Parade (exécution d'un coup lourd télégraphié : Parfait = coup détourné + riposte x1,5 + garde ouverte, Réussi = dégâts x0,5) ou « Briser la
  garde » (exécution de « il se hérisse » : la garde ne monte pas), via des étapes `interactive` de `runCombatBeats()` dans
  `performBossCounterAttackInner()` ; 3 épreuves de télégraphe au plus par boss (`MINIGAME_SETTINGS.boss.trialCap`), un Raté n'ajoute aucune pénalité,
  jamais d'épreuve sans interface (comportement d'avant). Le coup fatal à un boss ouvre d'abord le **Coup de grâce** (`offerCoupDeGrace()` dans
  `performPlayerAttack()`, épreuve selon la dernière attaque, cinématique `playFinisherCinematic()`) : seul un Parfait ouvre l'arme signature, et 3
  Parfaits ou plus dans le combat lui ajoutent un qualificatif (`signatureReward()`, `buildSignatureItem(..., { extraQualifier })`). Statut de
  boss `exposed` (DEF x0,7 un coup). Les Parfaits des épreuves se comptent dans `enemy.trials`. **V4 (salle de jeux)** : `ROOM_TYPES.arcade`
  (`generateMetropolis({ arcadeCount })`, 1 à 2 villes par étage urbain, jamais le départ) ; `enterUrbanRoom()` → `triggerArcade()` (blocage `shopChoicePending` +
  `pendingArcadeCityId`, partie en cours `gameState.arcadeSession`) ; `playArcadeGame()` prélève la mise (`arcadeCheckStake()`, plafond 60 PO × étage) et 1 H puis enchaîne les manches
  (`ARCADE_GAMES` : stand de tir, ring, coffre-fort, mémoire = épreuves existantes) ; points Parfait 2 / Réussi 1, palier bon ×1,5 / excellent ×3 (+ XP de compétence), tout
  Parfait = un lot (`arcadeScore()`/`arcadePayout()`). **Chronique** : `settleMinigame()` → `recordRunEvent('minigame')` (épreuves jouées seulement), `finishArcadeGame()` → `recordRunEvent('arcade')` ; 7 succès et 2 familles de piques DeathWatch
  (`perfect`, `gambler`) y sont liés. Tout helper pur de `minigames.js` partage l'espace
  global avec `floorgen.js` : en préfixer le nom (une collision sur `pointSegmentDistance` avait supprimé les repaires).
