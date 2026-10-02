# Tests — détail (extrait de `CLAUDE.md`)

> Fiche lue à la demande ; l'essentiel (commandes, règles) est dans `CLAUDE.md`.

- `tests/test_stub.js` — stub DOM minimal pour exécuter le jeu sous Node. `tests/load_game.js` —
  charge les fichiers sources dans l'ordre (`GAME_FILES`).
- Outils de développement : `npm run check` (syntaxe de tous les fichiers + `npm test` ; `-- --long` ajoute la simulation longue), `npm run where -- nom` (où est défini ce symbole), `npm run bump` (incrémente le `?v=` d'`index.html`). `tests/load_game.js` charge chaque fichier de `GAME_FILES` comme un script distinct, dans l'ordre d'`index.html` (comme le navigateur) ; `load-order.js` vérifie que les deux listes concordent.
- `npm test` (= `node tests/regression.test.js`), `npm run test:long` (= `node tests/long_playthrough.js`),
  `npm run test:all` (les deux à la suite, s'arrête au premier échec) — voir `package.json`.
- `npm run sim:floors [n] [labyrinthe]` (`tests/tools/floor-sim.js`, outil de calibrage, jamais lancé par la
  CI) : génère n étages avec `floorgen.js` et affiche salles/bloc, culs-de-sac, profondeur du boss, portes,
  croisements, temps — à relancer avant toute retouche de `FLOOR_LAYOUT` ; `npm run sim:floors [n] urbain`
  mesure les étages urbains (salles par ville, tronçons par route, départ → escalier) avant toute retouche de
  `METRO_LAYOUT`.
- `npm run sim:items` (`tests/tools/item-curve.js`, outil de calibrage, jamais lancé par la CI) :
  répartition des raretés par étage et source, courbe de puissance selon l'équipement, valeur marchande
  — à relancer avant toute retouche de `itemBalance`/`itemRarities`.
- `npm run sim:early [n]` (`tests/tools/early-curve.js`, outil de calibrage, jamais lancé par la CI) : coût d'un combat en début de partie (PV perdus, mort, boss) avant/après le paquet `config.earlyGame`
  (chantier 15, voir `NOTES_DEBUT_DE_PARTIE.md`) — à relancer avant toute retouche de ce bloc ou du scaling des mobs aux étages 1-6.
- **Rapide** (`npm test`, quelques secondes) : à lancer avant CHAQUE push. `tests/regression.test.js`
  est un AGRÉGATEUR (depuis la Tâche 2 du chantier "fiabilisation" — l'ancien fichier monolithique
  faisait ~172 Ko) : il ne fait que `require()` chaque module de `tests/regression/*.js`, regroupés
  par domaine (`meta-reset.js`, `combat.js`, `combat-scene.js`, `combat-scaling.js`, `combat-boss.js`,
  `combat-enrage.js`, `items.js`, `loot.js`, `misc.js`, `magic.js`, `saves.js`,
  `floor-transition.js`, `necrologie.js`, `anomalies.js`, `urban-floors.js`, `balance.js`,
  `urban-map.js`, `urban-shops.js`, `urban-lairs.js`, `safehouses.js`, `companions.js`, `achievements.js`, `bounty.js`, `deathwatch.js`, `floor-map.js`, `inventory-ui.js`, `minigames.js`, `starter-buff.js`, `origins.js`, `races.js`, `origin-choice.js`, `classes.js`, `crawler-races.js`, `origins-flavor.js`, `early-game.js`, `load-order.js`), dans l'ordre où chacun apparaît en tête de
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
  `lairChoicePending`/`floorTransitionPending`/`pactChoicePending`/`stairsChoicePending` — la simulation
  descend toujours —, `showChoicePending`, ajoutés après coup).
- Les deux n'affichent que les échecs + un résumé final (pas une ligne par test réussi).
- **CI** (`.github/workflows/ci.yml`) : sur chaque push (toute branche) et chaque pull request,
  `actions/checkout` + `actions/setup-node` (Node 20) puis `npm test` et `npm run test:long` — pas de
  `npm install` (aucune dependency/devDependency), pas de cache, pas d'artefact, volontairement minimal.
  Après un push, le statut de ce workflow devient LA RÉFÉRENCE : le protocole "20+ runs consécutifs en
  local avant de pousser" reste utile pour chasser le flaky avant même d'arriver jusque-là, mais un
  push dont la CI passe au rouge doit être corrigé avant de continuer sur autre chose.

