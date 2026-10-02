# Étages, carte, voyage, salles sécurisées, escaliers, étages urbains, repaires

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/floors.js, engine/floor-map-ui.js, engine/events.js, engine/gameplay.js, floorgen.js, floormap.js.

- **Étage classique = un « borough »** (chantier 5 « rework de la carte », voir `NOTES_CARTE.md`) :
  `generateFloorMap()` habille le résultat du générateur PUR `generateBorough()` (`floorgen.js`) —
  4 blocs de quartier (2 × 2, un quartier chacun) séparés par des **avenues** (croix + anneau, 12
  tronçons = salles de la zone `avenue`, `quadrant: null`). Chaque bloc : 12-14 salles rectangulaires
  (géométrie réelle `x/y/w/h` en cases, taille S/M/L), jamais collées, reliées par un arbre couvrant
  minimal + 1-3 boucles courtes (aucun couloir croisé), grande salle de boss à ≥ 3 salles des 2-3
  **portes** qui donnent sur les avenues (jamais dans un boss), 1-2 salles sûres à mi-profondeur. Tout
  réglage dans `FLOOR_LAYOUT` ; ajouter un type de salle = une entrée de `ROOM_TYPES` (+ son effet dans
  `enterRoom()`), une zone = une entrée de `ZONE_TYPES`. `npm run sim:floors` mesure la qualité sur des
  centaines d'étages. Départ aléatoire hors de danger (`pickSafeStartRoom()` : salle ordinaire ou
  avenue, ≥ 3 salles de tout boss) ; sur une avenue, le quartier courant (décor, mobs) reste le dernier
  bloc traversé (`moveToFloorRoom()`, `roomDistrict()`, `roomZone()`). Couloirs `{ to, length, cost,
  kind: 'corridor'|'door'|'avenue' }` : `computeDistance()`/`computeFloorPath()` (Dijkstra) somment les
  `cost` = longueur réelle / `cellsPerDistanceUnit` × `ZONE_TYPES[zone].travelMult` (avenues ×0,5 :
  temps ET risque de trajet deux fois moindres). Table d'événements par zone : `getZoneEventTable()`
  (`config.chances` dans un bloc, `config.avenueChances` sur une avenue : moins de combats/pièges, plus
  de crawlers, PO et cadeaux du public) ; chasseurs de primes ×2 sur les avenues
  (`ZONE_TYPES.avenue.hunterMult`, `maybeSpawnBountyHunter()`). `gameState.floorMap.version` =
  `FLOOR_MAP_VERSION` : une sauvegarde d'un format antérieur voit son étage en cours regénéré à la
  restauration (même numéro d'étage), le crawler garde tout le reste.
- 1 boss par quartier ; l'escalier est gardé par l'un des 4. "Repérer et partir" garde le même mob
  en cache sur sa pièce (marqué 👑 sur la carte), combattable plus tard en y retournant par la carte.
- **Carte + voyage** (plus de liste « Lieux connus ») : `#floor-map-overlay` (panneau sous la scène,
  ouvert/fermé par `#btn-toggle-map`, masqué pendant une situation, étages classiques ET urbains), rendu par
  `buildFloorMapSvg()` (`floormap.js`) : blocs teintés (nom du quartier une fois visité, sinon « ??? »),
  avenues toujours visibles, brouillard (salle visitée pleine, *aperçue* — voisine d'une visitée,
  `isRoomSeen()` — en pointillé « ? », inconnue invisible), repères `listFloorLandmarks()` DÉRIVÉS des
  salles (👑 boss repéré, 🪜 escalier libre, salle sûre visitée — aucun registre séparé), pion du crawler.
  Zoom ＋/－ (`zoomFloorMap()`, `FLOOR_MAP_ZOOMS`), ◎ (`recenterFloorMap()`), glissement souris/tactile
  (`attachFloorMapPointerHandlers()`, attaché UNE fois ; tap résolu par `floorMapHitTest()` en coordonnées
  monde). Vue/zoom/sélection = variables de module (préférences d'affichage, jamais sauvegardées).
  Toucher une salle visitée ou aperçue → bulle `#floor-map-bubble` (`describeFloorMapTravel()` : temps,
  risque) → « Y aller » (`confirmFloorMapTravel()` → `travelToRoom()`). **M1** : vers une salle visitée,
  trajet par le chemin CONNU (`planTravelToRoom()`, seulement des salles visitées), temps
  `max(1, round(distance/2))`, embuscades `computeAmbushBaseChance()`, arrivée par `enterRoom()`.
  **P1** (explorer depuis la carte, choix de l'utilisateur à la place de portes N/S/E/O dans la scène) :
  vers une salle aperçue, trajet jusqu'à sa voisine visitée la plus proche puis le pas d'exploration
  dans l'inconnu (`performExploreStep(targetRoomId)`, −1 H, événement tiré) — un seul geste
  (`gameState.pendingTravel.exploreRoomId`). Toucher la scène reste l'exploration au hasard ; sans voisin
  inconnu, `autoTravelToNearestFrontier()` file vers la salle aperçue la plus proche (`findNearestSeenRoom()`).
- Salles sécurisées : pièces fixes, thème tiré dans `safehouses.js`, marquées sur la carte dès l'entrée.
  **Entrée à choix explicite** (chantier "QoL/équilibrage", voir `NOTES_QOL_EQUILIBRAGE.md`) : plus de
  soin automatique — `enterRoom()` pose `gameState.safehouseChoicePending`/`pendingSafehouseRoomId`
  (inclus dans `isActionBlocked()`) et affiche `#safehouse-choice-zone`, même famille que
  `#boss-choice-zone`. **Trois options** : `restAtSafehouse('nap')` (Sieste, `config.safehouse.nap` :
  2H, 25 % des PV PERDUS) et `restAtSafehouse('sleep')` (Sommeil réparateur, `config.safehouse.sleep` :
  8H, 100 % des PV perdus), la même part du mana manquant si un sort est équipé
  (`safehouseRestAmounts(kind)`, pure — en pourcentage plutôt qu'en valeur absolue pour rester juste à
  tous les niveaux ; soin ensuite réduit par PEAU_DE_VERRE via `applyPlayerHeal()` comme tout soin),
  gratuits en temps sous REPAS_DE_FAMILLE (anomalies.js) ; `leaveSafehouse()` (Partir) reste gratuit,
  sans effet — la salle reste de toute façon marquée sur la carte dès l'entrée, quelle que soit
  l'issue. `updateSafehouseRestButtons()` écrit sur chaque bouton son coût et ce qu'il rendra. Garde-fou :
  chaque bouton (`#btn-nap-safehouse`/`#btn-sleep-safehouse`) est désactivé dès l'affichage si SON coût
  ferait tomber `timeLeft` à 0 (`canRestAtSafehouse(kind)`), doublé d'une vérification identique dans
  `restAtSafehouse()` elle-même (sécurité redondante) — un repos ne peut donc structurellement jamais
  amener `timeLeft` à 0.
- Exploration = toucher la scène d'exploration (`#explore-scene`, -1H) : jamais de choix bloquant de
  navigation. **Plus de carte à jouer** : la scène (vignette de l'événement, voir « Scène d'exploration »
  plus bas), son titre (`#explore-title`) et la DERNIÈRE ligne du journal (`#explore-last-line`, écrasée
  par chaque `logEvent()` hors combat) sont le seul affichage minimal ; tout le détail va dans le
  journal complet (repliable).
- **Budget temps par étage** (chantier "QoL/équilibrage", Chantier E — voir `NOTES_QOL_EQUILIBRAGE.md`) :
  `gameState.maxTime` n'est plus un plafond fixe (100H) mais `config.floorTimeBudget.base +
  perFloor × (étage - 1)` (130 + 5H/étage), recalculé par `advanceToNextFloor()` à chaque changement
  d'étage (`gameState.timeLeft` remis à ce nouveau maximum, comme avant) — objectif : réduire les
  morts "sans avoir vu l'escalier" sur les étages tardifs (mobs/distances plus coûteux), sans
  supprimer la pression du temps ni la mort par épuisement, toujours possible. Alerte visuelle
  discrète (`#stair-alert-banner`, pulse `prefers-reduced-motion`-safe) affichée par `updateUI()` dès
  `timeLeft/maxTime <= 25%`, jamais en combat.
- **Choix d'escalier** (`offerStairsChoice(context)`, demandé par l'utilisateur) : un escalier libre
  (gardien vaincu dans `winCombat()`, classique ET urbain, ou salle d'escalier urbaine non gardée atteinte par
  `enterUrbanStairs()`) ne mène plus directement à l'écran d'escalier : `#stairs-choice-zone`
  propose « Descendre » (`descendStairs()` → `triggerFloorTransition()`) ou « Rester sur l'étage »
  (`stayOnFloor()`, aucun effet, le temps continue de s'écouler). Bloque via
  `gameState.stairsChoicePending` (inclus dans `isActionBlocked()`) ; `gameState.pendingStairsChoice` =
  `{ kind: 'room', roomId }` (la salle de l'escalier est marquée 🪜 « Escalier libre » sur la
  carte, `listFloorLandmarks()`, pour y revenir quoi qu'il arrive, même après une restauration de
  sauvegarde). Le choix est reproposé à chaque retour : `enterRoom()` sur la salle d'un gardien d'escalier
  vaincu (au lieu de l'« antre silencieuse », gardée pour les boss de quartier). La Sortie de
  l'étage final n'y passe jamais : victoire immédiate (choix de l'utilisateur).
- **Écran d'escalier** (`triggerFloorTransition()`/`continueFromFloorTransition()`) : affiché à la
  place d'un passage direct à l'étage suivant, au clic sur « Descendre » (voir Choix d'escalier
  ci-dessus). Titre sarcastique tiré
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
- **Étages urbains = villes explorables** (multiples de 3 — `config.urbanFloors`, chantier 12, voir
  `NOTES_VILLES.md`) : `generateUrbanFloorMap()` habille le générateur PUR `generateMetropolis()` (`floorgen.js`)
  dans `gameState.floorMap` avec `kind: 'urban'` (`isUrbanFloor()`) — il n'y a plus de `gameState.urbanMap`.
  6-8 villes sur une grille (région connexe, une route par paire de villes voisines en 8 directions, jamais deux
  routes croisées), chacune de 3 à 5 salles (zone `city`) : **place** au centre (`cityRole: 'plaza'`, arrivée des
  routes, départ de l'étage), **auberge** dans chaque ville (`type: 'safe'`, repos existant `restAtSafehouse()`),
  salle du **marchand** (`shop`) ou du **professeur** (`trainer`) si la ville en a le rôle, **escalier** (`stairs`)
  au fond de sa ville, ruelles. Routes (zone `road`) découpées en 2-4 tronçons (`seg`), **repaires** (zone `lair`)
  en impasse sur un tronçon. `floorMap.citiesById` (nom, `role`, `specialty`, `stock`), `lairsById`, `theme`
  (nom d'un quartier de `districts.js`, aussi `gameState.currentDistrict` pour tout l'étage), `isFinalFloor`,
  `currentCityId`. Exploration, voyage M1/P1, carte : EXACTEMENT la machinerie des étages classiques ;
  `enterRoom()` délègue à `enterUrbanRoom()` (place → scène `citySafe`, boutique/professeur →
  `triggerShopEncounter()`, escalier → `enterUrbanStairs()`, repaire → `enterLair()`) ; auberge, ruelles et
  tronçons suivent le comportement commun. Tables `config.cityChances` (ville calme : jamais de combat, de piège
  ni de contretemps ; **pickpocket** 5 %, `computePickpocketLoss()`, `config.pickpocket`) et `config.roadChances`
  (Combat 40, Piège 14) via `getZoneEventTable()` (`ZONE_EVENT_TABLES`) ; chasseurs de primes ×1,5 sur les
  routes. Escalier gardé selon `config.urbanFloors.stairsGuardChanceByFloor` (20/35/50/65/80 %) : même choix que
  les boss de quartier (`triggerBossEncounter()`, vignette `urbanGuardian`). **Étage final** (18) : la salle de
  l'escalier devient la **Sortie** (`isExit`), toujours gardée ; la vaincre (ou l'atteindre libre) déclenche
  `winGame()`. Une sauvegarde de l'ancien format (`saved.urbanMap`) voit son étage urbain regénéré.
- **Repaires** : `config.urbanFloors.lairRoadsPerFloor` (1, 2 à l'étage final) salles en impasse accrochées à
  un tronçon de route (`generateMetropolis()`), état dans `gameState.floorMap.lairsById` (`cleared`,
  `combatsRemaining` 2 ou 3, `bossInstance`). Y entrer (`enterLair()`) propose `triggerLairChoice()` (plonger /
  ressortir, `gameState.lairChoicePending`, inclus dans `isActionBlocked()`) ; ressortir (`declineLair()`) laisse
  le repaire intact, reproposé au prochain passage. Plonger (`diveIntoLair()`) lance le premier combat forcé ;
  `winCombat()` enchaîne les sbires restants puis le boss (`gameState.pendingLairDive.stage`, `'trash'` →
  `'boss'`, boss généré seulement à ce moment) ; sa victoire marque le repaire nettoyé (butin d'un boss, niveau
  d'objet +1). Une fuite en pleine plongée annule la plongée sans nettoyer le repaire. Carte : 💀 tant qu'actif,
  🏆 une fois nettoyé.
