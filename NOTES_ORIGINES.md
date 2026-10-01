# Notes — chantier 13 « Race et classe à l'étage 3 » (origines)

Notes détaillées du chantier (décisions et plan : `CHANTIERS.md`, chantier 13). Ce fichier porte le **bilan et les chiffres** des lots 0 à 5 (début),
puis **le cahier des charges des 6 corps dessinés par Vibe** (lot 4).

## Bilan (lots 0 à 5)

| Lot | Contenu | Où |
|---|---|---|
| 0 | catalogue pur (7 races, 6 classes, 4 synergies, conditions), tirage des 3 cartes | `origins.js`, `tests/regression/origins.js` |
| 1 | passifs de race, un point de lecture par effet, Increvable | `app.js` « RACE : PASSIFS », `config.origins.races`, `races.js` |
| 2 | écrans race puis classe à l'étage 3, badges, fiche d'origine, reprise de sauvegarde | `app.js` « ORIGINES : CHOIX », `origin-choice.js` |
| 3 | passifs de style, capacité active 1 fois par combat, 4 synergies | `app.js` « CLASSE : PASSIFS… », `config.origins.classes`/`synergies`, `classes.js` |
| 4 | aspect par race : corps teinté, infrastructure des corps dessinés, gabarit variable, portraits | `sprites/crawler-races.js`, `scene.js`, `crawler-races.js` |
| 5 | piques DeathWatch, 6 succès, épitaphe par race, effets visuels des capacités sans coup | `deathwatch.js`, `achievements.js`, `fx.js`, `origins-flavor.js` |

### Chiffres de départ (tous à playtester)
- **Races** (`config.origins.races`) : Humain XP ×1,10 et +1 réserve ; Goule PV ×1,20, saignement ×0,5, soins ×0,8 ; Gobelin Furtivité +10, fuite +15, pièges ×0,75, PV ×0,90 ;
  Troll PV ×1,25, mains nues ×1,15, Furtivité −10 ; Elfe mana ×1,25, sorts ×1,10, backfire −3 pts, DEF −1 ; Nain DEF ×1,12 (au moins +1), armure ×1,15, fuite −15 ;
  Cafard PV ×0,85 et Increvable (1 fois par étage, jamais contre un boss).
- **Classes** (`config.origins.classes`) : Bagarreur mains nues ×1,15 / Uppercut ×2 ; Duelliste arme ×1,10 / Fendre ×1,8 et 50 % de DEF ignorée ; Franc-tireur tir ×1,10 /
  Tir de barrage 2 × ×0,8 ; Occultiste coût en mana ×0,9 / Surcharge ×1,6 ; Filou Furtivité +1 niveau / Disparition (1 riposte, prochaine attaque ×2) ;
  Sac de frappe PV ×1,10 / Encaisser (DEF ×2, 50 % renvoyés).
- **Synergies** (`config.origins.synergies`) : Troll + Bagarreur 2 tours d'étourdissement (« exposé » face à un boss) ; Elfe + Occultiste Surcharge ×1,8 et +20 mana ;
  Gobelin + Filou 2 ripostes esquivées ; Nain + Sac de frappe 75 % renvoyés.

### À surveiller en playtest
- **Cafard** : Increvable à chaque étage est très fort ; mesurer la part de runs où il sauve réellement.
- **Cumul multiplicatif** (Troll + Bagarreur + Boxeur du chantier 14, jusqu'à ×1,65 avant le ×2 du buff de départ) et Goule + Sac de frappe (PV ×1,32).
- **Conditions de déblocage** (runs courts : seuils de 1 à 4) : vérifier que les 3 cartes reflètent bien la façon de jouer, et que le remplissage n'impose pas de classes injouables.
- **Disparition** contre les boss à frappes multiples (toute la riposte esquivée), **Fendre** et **Tir de barrage** face aux boss, lisibilité du bouton de capacité sur mobile.
- **Armure par corps** : l'armure est dessinée une seule fois (torse humain) puis recalée par corps via `anchors.armor` (voir « Corps livrés »). Goule : alignement correct sans recalage ; à revérifier pour chaque nouveau corps (le nain, plus large, est le plus à risque).
- **Corps livrés** : Goule ✅, Gobelin ✅ (`sprites/race-goblin.js`, frontExtent 13), Troll ✅ (`sprites/race-troll.js`, frontExtent 19), Elfe ✅ (`sprites/race-elf.js`, frontExtent 14, torse de gabarit humain : armure alignée sans `anchors.armor`) — Nain, Cafard en attente. **`anchors.armor`** `{ x, y, scale }` codé (scene.js, `composeCrawler()`) : l'armure est dessinée pour le torse humain (centre `x 0, y -51`, hauteur 36) et recalée par `translate(x y) scale(s) translate(0 51)` ; réglé pour le Gobelin (`-0.5, -45, 0.85`) et le Troll (`0.5, -60, 1.25`), sans effet pour la Goule (gabarit humain). À fournir/ajuster pour chaque nouveau corps.
- **Piques DeathWatch** : 17 nouvelles, une seule émission les affiche (étage 3) ; juger leur dosage et leur ton au playtest.
- Effets visuels des capacités sans coup volontairement sobres (éclat « self » seul).

## Lot 4 — silhouettes par race

### État du code (livré)
- `sprites/crawler-races.js` : `CRAWLER_RACE_LOOKS` (teintes peau/cheveux du corps humain, **actives dès maintenant** pour 6 races), `CRAWLER_RACE_BODIES`
  (corps dessinés, remplis par les livraisons de Vibe, un fichier `sprites/race-<clé>.js` par race : Goule livrée), `crawlerRaceBody()`/`crawlerRaceLook()`/`tintCrawlerMarkup()`.
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
