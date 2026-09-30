# Notes — Chantier 5 « Rework de la carte + génération des étages »

Registre : `CHANTIERS.md` (tours de suggestions 1 à 5, décisions, plan final révisé). Inspiration : l'artwork
« Floors 1 & 2 » du wiki DCC, un *Borough* de 4 blocs de quartier séparés par de grandes avenues.

## Décisions de l'utilisateur
- Un seul borough de **4 blocs** par étage (un quartier chacun) + **avenues** (croix + anneau).
- Avenues = **zone explorable à part entière**, plus rapide et plus sûre, plus de crawlers, et plus de
  chasseurs de primes quand la prime est élevée. Table d'événements validée telle quelle.
- ~12-14 salles par bloc (comme avant). Ni guildes, ni toilettes, ni réserves pour l'instant, mais une
  **plateforme flexible** pour en ajouter plus tard sans refonte.
- Carte **stylisée**, en **panneau sous la scène**, zoom ＋/－/◎ et glissement, brouillard.
- Déplacement « entre-deux » : **M1** (voyage sur carte vers une salle visitée ou aperçue) + **P1**
  (explorer depuis la carte). Les portes Nord/Sud/Est/Ouest dans la scène (M2) ont été **abandonnées**.
- Départ **aléatoire mais hors de danger**. Liste « Lieux connus » **supprimée**, remplacée par la carte.
- Anciennes sauvegardes : pas de migration exigée (finalement : l'étage en cours est regénéré).

## Génération (`floorgen.js`, pur)
- `computeBoroughGeometry()` : 3 avenues verticales × 3 horizontales (largeur 3 cases), 9 carrefours,
  12 tronçons ; blocs de 21 × 15 cases (agrandis de √1,5 sous LABYRINTHE, même densité).
- `tryGenerateBlock()` : salle de boss 5 × 4 d'abord, puis salles de 1 × 1 à 4 × 3 (formes pondérées),
  1 case d'écart minimum ; couloirs = arbre couvrant minimal (Prim, entre centres — un arbre couvrant
  euclidien ne se croise jamais) en évitant de traverser une salle, puis 1-3 boucles courtes (≤ 9 cases,
  entre salles à ≥ 3 sauts dans l'arbre, sans croiser ni traverser) ; 2-3 portes sur des salles à ≤ 4 cases
  d'un bord, côtés différents de préférence, jamais le boss, toujours à ≥ 3 salles de lui ; 1-2 salles sûres
  (≤ 4 cases) à mi-profondeur depuis les portes. Un bloc raté est retenté (60 essais, une salle de moins
  tous les 15), jamais de boucle infinie.
- Avenues : un tronçon = une salle de zone `avenue` ; deux tronçons qui partagent un carrefour sont voisins.
- `cost` d'un couloir = longueur (cases) / 4 × `travelMult` de sa zone (avenues ×0,5).
- Mesures (500 étages, `npm run sim:floors`) : 0 échec, 0 chevauchement, 0 couloir croisé, 0 doublon,
  toujours connexe ; ~64 salles/étage (13/bloc + 12 avenues), ~14 % de culs-de-sac (contre 18 %), degré
  max ~4 (contre 7), boss à ≥ 3 salles des portes (contre 9 % des jonctions qui tombaient dans un boss),
  départ à ≥ 3 salles d'un boss ; ~3 ms par étage.

## Moteur (`app.js`)
- `generateFloorMap()` : 4 quartiers tirés, thèmes des salles sûres, gardien d'escalier, départ,
  CAFET_ASSOMBRIE (salle ordinaire d'un bloc, jamais le départ). `floorMap.version = FLOOR_MAP_VERSION` (2).
- `moveToFloorRoom()` : le quartier courant suit le bloc ; sur une avenue, le dernier bloc traversé.
  `announceZoneChange()` : « Vous débouchez sur une avenue » / « Vous franchissez une porte ».
- `getZoneEventTable()` : `config.chances` / `config.avenueChances` ; `maybeSpawnBountyHunter()` ×
  `ZONE_TYPES[zone].hunterMult`.
- `planTravelToRoom()` / `travelToRoom()` / `arriveAtDestination()` : M1 et P1 (voir CLAUDE.md), chemin
  par salles VISITÉES seulement (`computeFloorPath(from, to, canPass)`).
- `listFloorLandmarks()` : repères dérivés des salles (boss repéré, escalier gardé ou libre, salle sûre).
- Restauration d'une sauvegarde d'un format de carte antérieur : `generateFloorMap()` pour l'étage en cours.

| Événement | Salles (`config.chances`) | Avenues (`config.avenueChances`) |
|---|---|---|
| Rien | 37 | 40 |
| Combat | 25 | 12 |
| Butin | 4 | 4 |
| Piège | 10 | 3 |
| Contretemps | 8 | 5 |
| Petite trouvaille | 3 | 5 |
| PO | 3 | 6 |
| Cadeau du public | 4 | 8 |
| Rencontre de crawler | 3 | 12 |
| Ambiance | 3 | 5 |

## Carte (`floormap.js` + panneau `#floor-map-overlay`)
- Rendu pur `buildFloorMapSvg()` (chaîne SVG) : blocs teintés, avenues (toujours visibles), couloirs et
  portes connus, salles visitées / aperçues, repères, pion. `floorMapHitTest()` pour le toucher.
- Zooms 560 / 320 / 190 unités de large (défaut 320), fenêtre 25:18, écrêtée à l'étage.
- Bulle sous la carte (jamais par-dessus) : « Explorer : … » (salle aperçue) ou « Aller : … » (visitée),
  avec le temps et le risque d'embuscade.

## Tests
- `tests/regression/floor-map.js` : générateur (25 graines, reproductibilité, avenues, portes, coûts,
  LABYRINTHE), habillage moteur, distance, tables par zone et chasseurs, voyages M1/P1 (voisin, lointain,
  chemin connu, exploration automatique), repères, sauvegarde ancienne, rendu et panneau de la carte.
- `tests/long_playthrough.js` : un pas sur quatre passe par la carte (~40 voyages par simulation).

## À surveiller en playtest
- Coût des trajets : les distances sont maintenant réelles (un couloir ~1 unité, un tronçon d'avenue
  ~2,5 unités avant ×0,5). Si les trajets paraissent trop chers ou trop risqués, `cellsPerDistanceUnit`.
- Avenues : la table (plus de crawlers et de cadeaux) peut rendre les avenues trop attractives pour
  « farmer » ; à surveiller.
- Densité visuelle des blocs (21 × 15) et taille des salles sur petit écran.
- Dette signalée (non corrigée ici) : `renderGraphMiniMap()` (Carte Urbaine) ré-attache ses écouteurs de
  glissement à chaque rendu ; la carte des étages classiques les attache une seule fois.
