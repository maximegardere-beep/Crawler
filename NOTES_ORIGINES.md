# Notes — chantier 13 « Race et classe à l'étage 3 » (origines)

Notes détaillées du chantier (décisions et plan : `CHANTIERS.md`, chantier 13). Ce fichier est tenu à jour lot par lot ; il porte pour
l'instant **le cahier des charges des 6 corps dessinés par Vibe** (lot 4). Sections de bilan, chiffres et « À surveiller en playtest » : au lot 5.

## Lot 4 — silhouettes par race

### État du code (livré)
- `sprites/crawler-races.js` : `CRAWLER_RACE_LOOKS` (teintes peau/cheveux du corps humain, **actives dès maintenant** pour 6 races), `CRAWLER_RACE_BODIES`
  (corps dessinés, **vide** : à remplir par les livraisons de Vibe), `crawlerRaceBody()`/`crawlerRaceLook()`/`tintCrawlerMarkup()`.
- `scene.js` : `composeCrawler()` lit le corps de la race (couches, bras par posture, points d'accroche des objets rangés), `crawlerFrontExtent()`
  (extension avant du corps courant, lue par `distanceToX()`/`computeRangeBands()`/`fx.js`), `buildRacePortraitSvg()` (cartes de choix et fiche d'origine),
  `crawlerCorpseMarkup()` (Game Over).
- Tant qu'un corps n'est pas livré, la race garde le corps humain teinté ; **livrer un corps le remplace sans toucher au reste** (une entrée de
  `CRAWLER_RACE_BODIES`). `tests/regression/crawler-races.js` valide automatiquement chaque entrée ajoutée.

### Cahier des charges d'un corps (à respecter pour chaque race)
Repère commun à `sprites/*.js` : **x = 0 au centre du personnage, y = 0 au sol (les pieds), y négatif vers le haut**, crawler **de profil, tourné vers
la gauche** (vers le mob). Chaque chaîne est le CONTENU d'un `<g>` SVG (jamais de `<svg>`). Contours `#05060c`, épaisseur 1,2 à 2,5.
Référence : le corps humain de `sprites/crawler.js` (`CRAWLER_PARTS`, `CRAWLER_ARMS`) — **à ouvrir et imiter** (même style, mêmes proportions de trait).

**Interdits** (le test échoue) : `id=`, `<defs>`, dégradés, filtres, animation, texte. Pas de `Math.random()`.

Un corps = une entrée `{ parts, arms, frontExtent, anchors?, corpse?, tint? }` :

| Champ | Contenu |
|---|---|
| `parts.base` | ombre au sol (`<ellipse class="scene-ground-shadow" …/>` obligatoire), **jambes et bottes**, **sac à dos** (garder un sac : l'arme à distance se range en travers) |
| `parts.torso` | buste (l'armure se superpose dessus, elle est dessinée dans le repère du crawler humain : ne pas dépasser ses contours de plus de ~3 unités) |
| `parts.head` | cou + tête + cheveux/capuche/oreilles/casque… (dessinée APRÈS le bras : la tête passe devant) |
| `arms` | un bras avant **par posture** : `rest`, `weapon` (arme de mêlée levée), `ranged` (bras tendu, arme à distance), `rangedLowered` (même arme, canon baissé), `magic` (paume ouverte, lueur du sort), `boxer` (garde haute, + `front` = le poing arrière dessiné après la tête). Chaque posture : `{ arm, hand: [x, y], after?, front? }` ; `hand` = point de prise où le jeu accroche l'arme (même convention que `CRAWLER_ARMS`) ; `after` = la main dessinée par-dessus l'objet tenu |
| `frontExtent` | distance entre le centre et le point le plus avancé côté mob (botte/main avant), **entre 12 et 19** (humain : 15) ; elle règle le contact avec le mob et les bandes de portée |
| `anchors` (option) | `stowedRanged` / `stowedWeapon` : `{ x, y, rot, scale }` de l'arme rangée (défauts humains : arme à distance `14, -54, 55°, 0,8` ; mêlée `5, -36, 160°, 0,7`) |
| `corpse` (option) | cadavre vu de dessus pour l'écran Game Over (repère de `SCENE_CORPSE_TOPDOWN_SVG`) ; sans lui, le cadavre humain teinté |
| `tint` (option) | `{ skin, hair }` remplaçant `#c98a5e` / `#2f2318` si le corps réutilise les couleurs de l'humain |

**Gabarit** : hauteur totale de l'humain ≈ 92 unités (de y = 0 à y ≈ −92) ; marge autorisée **±20 %** ; largeur de x = −13 (main avant) à x = +20 (sac).
Le crawler reste ancré par ses pieds (y = 0) et son centre (x = 0).

**Livraison** : un fichier par corps, `sprites/race-<clé>.js`, qui commence par `Object.assign(CRAWLER_RACE_BODIES, { <clé>: { … } });` (clé = `ghoul`,
`goblin`, `troll`, `elf`, `dwarf`, `roach` ; l'Humain garde le corps d'origine). Je les branche dans `index.html` et `tests/load_game.js` (`GAME_FILES`)
à la réception. Contrôle : `npm test` (le module `crawler-races.js` vérifie couches, postures, marge d'extension, interdits).

### Intentions par race (ton loufoque façon Dungeon Crawler Carl ; la teinte actuelle sert de point de départ)
| Race | Silhouette | Détails à montrer | Teinte actuelle (peau / cheveux) |
|---|---|---|---|
| Goule | décharnée, légèrement voûtée, `frontExtent` ~14 | joues creuses, yeux cernés, haillons du crawler déchirés | `#93a58c` / `#3b4237` |
| Gobelin de caniveau | **petit** (−15 % de hauteur), tête grosse, `frontExtent` ~13 | grandes oreilles pointues, long nez, capuche de fortune (sac plastique) | `#6aa84f` / `#2a3a1c` |
| Troll de bureau | **grand et large** (+15/20 %), `frontExtent` 19 | mâchoire en avant, chemise trop serrée, cravate de travers, petit badge d'entreprise | `#8d9db3` / `#2b3340` |
| Elfe de salon | élancé, droit, `frontExtent` ~14 | longues oreilles pointues, peignoir ou veste de salon élégante sur le gilet du crawler, pantoufles | `#ecd3b8` / `#d6c27a` |
| Nain de chantier | **petit et trapu** (−15/20 %), épaules larges, `frontExtent` ~16 | grande barbe rousse, casque de chantier, bottes de sécurité | `#d9a07a` / `#a23d14` |
| Cafard mutant | dos bombé en carapace, `frontExtent` ~14 | antennes, carapace brune luisante à la place de la capuche, yeux à facettes | `#7a4a26` / `#24160b` |

L'armure d'équipement est dessinée une seule fois (repère humain) pour toutes les races : un corps très différent (Gobelin, Nain) pourra la voir
décalée — signaler le décalage, on ajustera la position de l'armure par corps (extension prévue : `anchors.armor`).
