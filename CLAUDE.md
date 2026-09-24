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
- `tests/` — voir plus bas

## Architecture (résumé)
- Étage = zone circulaire à **4 quartiers fixes** générés à l'entrée (`generateFloorMap()`), graphe
  de pièces reliées par couloirs artère (rapide/sûr) ou ruelle (lent/risqué).
- 1 boss par quartier ; l'escalier est gardé par l'un des 4. "Repérer et partir" garde le même mob
  en cache sur sa pièce, combattable plus tard via "Lieux connus" (distance réelle par Dijkstra,
  `computeDistance()`, coût/risque de trajet proportionnels).
- Salles sécurisées : pièces fixes, thème tiré dans `safehouses.js`, deviennent un lieu connu.
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
  cadeau de bienvenue et le kit de test.
- **Mobs élite** : `generateMob()` pose `threatMultiplier` (puissance apportée par les seuls
  modificateurs, hors scaling d'étage) via `computeThreatMultiplier()` (generator.js, fonction pure et
  testable indépendamment du pipeline aléatoire) — ATQ×PV pondéré par la DEF avec un poids modéré
  (0.5), pour qu'un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
  ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule. Au-delà de
  `config.eliteThreatMultiplier`, icône 💀 (jamais sur un boss, qui garde 👑 — voir `isEliteMob()`).
- **Progression** : `gainXp()` — `xpToNextLevel` croît ×1.25 par niveau (jusqu'ici ×1.4, resserré pour
  éviter le mur de fin de run où les niveaux cessent de tomber pendant que les mobs continuent de
  grimper). Gains à chaque niveau : PV max +15 (fixe), ATQ `2 + floor(niveau/4)`, DEF
  `1 + floor(niveau/5)` (croissants avec le niveau ATTEINT, pour rester au niveau des mobs en fin de run).
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
- **Villes spécialisées (marchand/professeur)** : à la génération d'un étage urbain, chaque ville
  normale (ni départ, ni escalier/Sortie) a `config.urbanFloors.specializedCityChance` (18%) de
  devenir marchand OU professeur (50/50), tiré indépendamment par ville. Un marchand vend une
  catégorie d'objet (`city.specialty` ∈ armes/armes à distance/armures/parchemins) ; un professeur
  forme UNE des 4 compétences réelles du joueur (`gameState.skills`, pas de "compétence armure" —
  contrairement aux objets, une compétence n'a que 4 valeurs possibles). `triggerShopEncounter(city)`
  (dispatché depuis `arriveAtCity()`, avant la résolution générique "ville sûre") ouvre `#shop-zone`
  et pose `gameState.shopChoicePending` (inclus dans `isActionBlocked()`, comme un choix de boss).
  `generateShopStock(specialty)` tire 3 objets une seule fois par partie (`city.stock`, jamais
  régénéré), prix = `item.baseValue × SHOP_MARKUP` (2.5) ; `buyShopItem()`/`sellItem()` sont les deux
  faces du même `SELL_VALUE_RATIO`/`SHOP_MARKUP`, volontairement asymétriques (acheter coûte plus cher
  que vendre ne rapporte). `trainSkill()` paie `TRAINER_COST_PER_LEVEL` (20) × le niveau ACTUEL de la
  compétence pour l'amener exactement au niveau suivant (`gainSkillXp(specialty, xpToNext - xp)`) —
  "payer pour s'entraîner" plutôt que le grind combat habituel, jamais un raccourci gratuit.
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

## Tests (`/tests`, deux vitesses)
- `tests/test_stub.js` — stub DOM minimal pour exécuter le jeu sous Node. `tests/load_game.js` —
  charge les 7 fichiers sources dans l'ordre.
- **Rapide** (`node tests/regression.test.js`, quelques secondes) : à lancer avant CHAQUE push.
  Couvre Sprint, mécaniques d'armure, icône élite, abandon de compagnon, badges, villes spécialisées
  (marchand/professeur), repaires sur les routes. Ajouter une section ici pour toute nouvelle feature
  testable unitairement. `resetTransientState()` doit rester à jour : tout nouvel état
  bloquant/transitoire (`xyzChoicePending`, `pendingXyz...`) doit y être remis à zéro, sinon un échec
  aléatoire (dû à un test antérieur non lié) peut fuiter sur des tests bien plus loin dans le fichier.
- **Lourd** (`node tests/long_playthrough.js`, simulation ~200 pas sur plusieurs étages) : à lancer
  UNE fois, seulement si le changement touche la boucle de jeu elle-même (combat, distance,
  compagnon, génération d'étage). Pas nécessaire pour un ajout de contenu isolé (item, quartier, texte).
  Son auto-résolveur doit connaître TOUT état bloquant existant (`xyzChoicePending`) : en oublier un
  fige la simulation dessus jusqu'à épuisement du temps imparti (voir `shopChoicePending`/
  `lairChoicePending`, ajoutés après coup).
- Les deux n'affichent que les échecs + un résumé final (pas une ligne par test réussi).

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
