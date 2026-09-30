# Notes — Chantier 12 « Villes explorables » (étages urbains sur le modèle de la carte)

Registre : `CHANTIERS.md` (chantier 12). Suite du chantier 5 (`NOTES_CARTE.md`) : les étages urbains (multiples
de 3) passent par la même carte et la même exploration que les étages classiques.

## Décisions de l'utilisateur
- Villes de **3 à 5 salles** ; routes de **2 à 4 tronçons** explorés pas à pas.
- Villes **calmes** : jamais de combat ni de piège, parfois un **pickpocket**.
- **Auberge dans chaque ville** (repos Sieste / Sommeil, comme une salle sûre) — avant, un étage urbain n'offrait
  aucun repos.
- **Gardien dans la salle de l'escalier**, au fond de sa ville (la Sortie de l'étage final reste toujours gardée) ;
  **repaire en impasse** partant d'un tronçon de route.
- L'ancienne Carte Urbaine est **remplacée** par la carte stylisée : villes en bloc clair + nom (« ??? » tant
  qu'inconnue), routes en bandes d'asphalte.
- Tables d'événements validées, variante **« routes plus dures »** (voir plus bas).
- Une seule PR à la fin, avec les deux correctifs du même moment (crawler mort non restaurable, barre du bas
  agrandie).

## Génération (`floorgen.js`, pur)
- `generateMetropolis({ rng, cityCount, lairCount, specializedChance })` : réseau de 6-8 villes sur une grille
  (`generateCityGrid()`, région connexe par construction), une route par paire de villes voisines (8 directions,
  `cityGridRoads()` ; un carré de grille dont les deux diagonales existent n'en garde qu'une : deux routes ne se
  croisent jamais).
- Ville (zone `city`) : carré de 13 × 13 cases, **place** au centre (`cityRole: 'plaza'`), les autres salles aux
  angles intermédiaires (22,5° + k × 45°), qui ne gênent jamais les routes (8 directions principales) ; toutes
  reliées à la place (étoile). Salles : auberge (`type: 'safe'`), marchand (`shop`) ou professeur (`trainer`) si la
  ville en a le rôle, escalier (`stairs`) dans la ville de l'escalier, ruelles (`alley`) pour compléter.
- Rôles : ville de départ sans rôle, une ville d'escalier, un marchand et un professeur garantis (ni départ ni
  escalier), d'autres selon `specializedChance` (18 %).
- Route (zone `road`) : bande entre les bords des deux villes, découpée en 2-3 tronçons (droite) ou 3-4
  (diagonale) ; chaque tronçon est une salle (`seg: { x1, y1, x2, y2 }` pour le rendu et le toucher). La porte
  relie la place au premier tronçon.
- Repaire (zone `lair`, `type: 'lair'`) : carré de 3 × 3 à 4,5 cases de l'axe d'une route, au milieu d'un
  tronçon, jamais sur une ville, une route ou un autre repaire ; impasse.
- Réglages : `METRO_LAYOUT` ; zones `city` / `road` / `lair` dans `ZONE_TYPES` (routes : chasseurs de primes
  ×1,5), types `shop` / `trainer` / `stairs` / `lair` dans `ROOM_TYPES`.
- Mesures (`npm run sim:floors 300 urbain`) : 0 échec, 0 chevauchement, 0 route croisée, toujours connexe ;
  ~56 salles par étage, 4 par ville, 2,9 tronçons par route ; départ → escalier : 12 unités de trajet en moyenne
  (7-35), ~7 salles ; < 1 ms par étage.

## Moteur (`app.js`)
- `generateUrbanFloorMap()` : `gameState.floorMap` avec `kind: 'urban'`, `theme`, `isFinalFloor`, `citiesById`
  (nom, `role`, `specialty`, `stock`), `lairsById` (`combatsRemaining` 2-3, `cleared`, `bossInstance`), salle de
  l'escalier (`guarded` selon `stairsGuardChanceByFloor`, toujours à l'étage final, `isExit`), thème de repos de
  chaque auberge (`pickSafehouseType()`). `gameState.urbanMap` n'existe plus.
- `isUrbanFloor()`, `roomCity()`, `urbanCityById()` ; `enterRoom()` délègue à `enterUrbanRoom()` : place (scène
  `citySafe`), boutique / professeur (`triggerShopEncounter()`), escalier (`enterUrbanStairs()` : gardien par
  `triggerBossEncounter()` et sa vignette `urbanGuardian`, escalier libre → `offerStairsChoice()`, Sortie →
  `winGame()`), repaire (`enterLair()` → `triggerLairChoice()`, plonger / ressortir). Auberge, ruelles et
  tronçons suivent le comportement commun (repos, événement de la zone, chemin connu).
- `winCombat()` : gardien de la Sortie → victoire ; plongée de repaire : sbires puis boss, puis `cleared`.
- Tables `config.cityChances` / `config.roadChances` (`getZoneEventTable()`, `ZONE_EVENT_TABLES`) ; événement
  `pickpocket` (`computePickpocketLoss()`, `config.pickpocket`, vignette `pickpocket`).
- Repères (`listFloorLandmarks()`) : 👑 escalier gardé, 🪜 escalier libre, 🚪 Sortie, 🛒 marchand, 🎓 professeur,
  💀 / 🏆 repaire, auberge ; libellés `urbanRoomLabel()`.
- Sauvegarde d'un format antérieur (`saved.urbanMap`) : l'étage urbain est regénéré (même numéro), les anciens
  champs (`urbanMap`, `pendingUrban*`) sont retirés.
- Retirés : `travelToCity()`, `arriveAtCity()`, `computeCityDistance()`, gardien urbain dédié, Carte Urbaine
  (`#urban-travel-overlay`), `renderGraphMiniMap()` et ses outils (`computeGraphLayout()`,
  `computeDeclutterLayout()`, fond de pâtés de maisons).

| Événement | Quartier | Avenue | **Ville** | **Route** |
|---|---|---|---|---|
| Rien | 37 | 40 | 40 | 13 |
| Combat | 25 | 12 | 0 | 40 |
| Butin | 4 | 4 | 0 | 5 |
| Piège | 10 | 3 | 0 | 14 |
| Contretemps | 8 | 5 | 0 | 10 |
| Petite trouvaille | 3 | 5 | 6 | 3 |
| PO | 3 | 6 | 12 | 4 |
| Cadeau du public | 4 | 8 | 10 | 3 |
| Rencontre de crawler | 3 | 12 | 14 | 5 |
| Pickpocket | — | — | 5 | — |
| Ambiance | 3 | 5 | 13 | 3 |

Pickpocket : 10 % des PO, au moins 5 (si on les a), jamais plus de 50.

## Carte (`floormap.js`)
- `buildUrbanMapSvg()` (appelée par `buildFloorMapSvg()` quand `kind === 'urban'`) : ville en bloc « plâtre »
  clair dès qu'une de ses salles est connue, nom une fois visitée ; tronçons d'asphalte selon le brouillard
  (visité clair, aperçu sombre avec « ? », inconnu invisible) ; bout de rue place → route ; lien rouge vers un
  repaire ; salles colorées par rôle ; repères ; pion.
- `floorMapHitTest()` : un tronçon se touche par la distance à son segment (un tronçon diagonal a une grande
  boîte englobante).
- Légende sous la carte selon le type d'étage (`FLOOR_MAP_LEGENDS`).

## Tests
- `tests/regression/floor-map.js` : générateur pur (40 graines, reproductibilité).
- `tests/regression/urban-floors.js` : habillage, garde de l'escalier par étage (statistique), tables ville /
  route, pickpocket, exploration et voyage, gardien de l'escalier et de la Sortie, bascule classique / urbain,
  menu DEV, ancienne sauvegarde.
- `tests/regression/urban-lairs.js` : repaire en impasse, choix, plongée complète, fuite.
- `tests/regression/urban-shops.js` : rôles, stock, achat, formation, entrée par la salle.
- `tests/regression/urban-map.js` : rendu (brouillard, noms, toucher d'un tronçon), repères, scène d'exploration
  et bouton Carte sur tous les étages.
- `tests/long_playthrough.js` : les étages urbains s'explorent (un pas sur deux par la carte) ; l'étage final
  va chercher la Sortie par exploration puis voyage.

## À surveiller en playtest
- Durée d'un étage urbain : ~56 salles, dont beaucoup de tronçons de route dangereux ; la route vers l'escalier
  peut être longue (jusqu'à ~35 unités de trajet).
- Routes « plus dures » (Combat 40, Piège 14) : trop punitives pour un étage censé être une traversée ?
- Auberge dans chaque ville : repos très accessible, peut rendre les étages urbains plus faciles qu'avant.
- Pickpocket : agaçant ou drôle ?
- Lisibilité de la carte : tronçons diagonaux, villes serrées sur petit écran.
