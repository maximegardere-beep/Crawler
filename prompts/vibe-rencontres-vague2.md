# Prompt Vibe — VAGUE 2 : les mobs (face + dos) et les chasseurs de primes

> À coller dans Vibe une fois les retouches des boss validées (voir `prompts/vibe-test-rencontres.md` pour le brief d'origine). Généré à partir de
> `encounterArtTargets()` (`encounters.js`) : l'ordre est celui de la puissance de base des mobs, du plus dangereux au plus faible.

---

Tu es illustrateur SVG. Tu travailles sur **Crawler** (rogue-like mobile, humour sarcastique façon Dungeon Crawler Carl). Tu as livré les 13 écrans de boss
(cadrage « face », SVG 750 x 1334) : ils sont intégrés au jeu. Cette vague produit les écrans des **39 mobs** (chacun en `face` ET en `back`) et des
**3 chasseurs de primes** (`face` seulement). Même style, même format, mêmes règles : **ne dérive pas** d'une image à l'autre.

## 0. Ressources (lis-les AVANT de dessiner)

Dépôt public : https://github.com/maximegardere-beep/Crawler — lecture brute : `https://raw.githubusercontent.com/maximegardere-beep/Crawler/claude/chantier-16-rencontres/<chemin>`

| Fichier | Pourquoi |
|---|---|
| `assets/mobs/*-face.svg` | **tes 13 boss déjà livrés : la référence de style** (trait, aplats, contour #05060c, ombres, aura, décor) |
| `sprites/mob-details-a.js`, `sprites/mob-details-b.js` | le **détail signature et la palette** de chacun des 39 mobs (clé = nom exact) : un mob doit rester reconnaissable |
| `sprites/mobs.js` | les 10 silhouettes d'archétype (zombie, beast, machine, plant, blob, shade, mannequin, goblinoid, swarm, vehicle) |
| `sprites/mob-auras.js` + `MOB_EFFECT_FX_COLORS` dans `sprites/fx.js` | les auras par effet (feu, poison, électricité…) : un mob peut en porter une, mais l'aura est OPTIONNELLE ici (un mob ordinaire n'a pas d'effet fixe) |
| `bestiary.js` | stats, archétype, `ranged` ; chasseurs de primes (`bountyHunters`) |
| `districts.js` | quel mob vit dans quel quartier |
| `backdrops.js` (`SCENE_BACKDROPS`) | palette et **accessoires de décor de chaque quartier** (reprends-en 2 ou 3) |
| `prompts/vibe-test-rencontres.md` | le brief d'origine (format, cadrages, nommage) : il s'applique toujours |

Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier. N'invente jamais son contenu.

## 1. Format (inchangé)

SVG 750 x 1334 (viewBox identique), aplats, contour #05060c, aucun texte, aucun script, aucune image externe, identifiants (`id=`) en **ASCII** (sans accent), < 20 Ko.
Sujet dans les 78 % du haut (les 22 % du bas sont couverts par le bandeau de texte : sol et ombre seulement). Nommage : `assets/mobs/<slug>-face.svg` et `<slug>-back.svg`.

## 2. Les deux cadrages (à lire attentivement, c'est ce qui a coûté des retouches sur les boss)

- **face — « il t'a vu »** : plan américain, caméra à hauteur de crawler avec **légère contre-plongée**. Le mob occupe **60 à 75 % de la hauteur**, **vient vers nous** (épaule/bras
  avancé, corps en diagonale, JAMAIS une pose frontale symétrique figée), regard (ou œil, voyant, objectif) **braqué sur le spectateur**, expression furieuse mais drôle.
  Un mob sans visage doit « regarder » (un œil, un voyant). Ajoute de la dynamique (poussière, éclats, objet brandi). **L'objet ou le détail signature du mob (voir `mob-details-*.js`) doit
  être bien visible et à sa vraie place.**
- **back — « tu l'as vu »** : le mob est **de dos ou de trois-quarts dos, au loin** (25 à 40 % de la hauteur, dans la moitié haute), **occupé à une activité propre à lui** qui
  explique pourquoi il ne nous voit pas, dans le même décor. Vue depuis une **cachette** au premier plan (caisse, pilier, angle de mur sombre). Un détail comique est bienvenu.
  **C'est le MÊME personnage que sa face** (mêmes couleurs, proportions, accessoire) : si tu peux partir de l'image face, fais-le.
- **Aura (face seulement, optionnelle)** : halo irrégulier fait de 2 ou 3 aplats superposés + éclats/particules ; jamais 3 ellipses concentriques parfaites.
- **Décor** : celui du quartier du mob (palette et 2 ou 3 accessoires de sa fiche `SCENE_BACKDROPS`), plus sombre et moins saturé que le mob.

## 3. Les 39 mobs, du plus dangereux au plus faible

| # | Mob (nom exact) | Archétype | Combat | Quartier (décor) | Slug |
|---|---|---|---|---|---|
| 1 | **Lave-Linge Possédé** | machine | distance | Catacombes des Chaussettes Perdues | `lave-linge-possede` |
| 2 | **Ordinateur en Colère** | machine | distance | Salle des Machines Infernales | `ordinateur-en-colere` |
| 3 | **Garde du Marché** | zombie | distance | Marché Noir du Donjon | `garde-du-marche` |
| 4 | **Voiture Abandonnée Rouillée** | vehicle | mêlée | Parking Souterrain Maudit | `voiture-abandonnee-rouillee` |
| 5 | **Photocopieuse Carnivore** | machine | distance | Bureaux de l'Administration Pénitentiaire | `photocopieuse-carnivore` |
| 6 | **Robot Défectueux** | machine | distance | Laboratoire de Fous | `robot-defectueux` |
| 7 | **Distributeur de Snacks Hanté** | machine | mêlée | Tunnels de Métro Abandonnés | `distributeur-de-snacks-hante` |
| 8 | **Ronce Étrangleuse** | plant | mêlée | Jardins Carnivores | `ronce-etrangleuse` |
| 9 | **Garde-Chiourme Bureaucrate** | zombie | distance | Bureaux de l'Administration Pénitentiaire | `garde-chiourme-bureaucrate` |
| 10 | **Ouvrier à la Chaîne** | zombie | mêlée | Usine de Transformation Alimentaire | `ouvrier-a-la-chaine` |
| 11 | **Imprimante à Rêves** | machine | mêlée | Salle des Machines Infernales | `imprimante-a-reves` |
| 12 | **Créature en Bocaux** | blob | mêlée | Laboratoire de Fous | `creature-en-bocaux` |
| 13 | **Savant Dingue** | zombie | distance | Laboratoire de Fous | `savant-dingue` |
| 14 | **Maître-Nageur Zombifié** | zombie | distance | Piscine Municipale Désaffectée | `maitre-nageur-zombifie` |
| 15 | **Présentateur Télé-Achat Hystérique** | zombie | mêlée | Studio de Télé-Achat Abandonné | `presentateur-tele-achat-hysterique` |
| 16 | **Horodateur Vengeur** | machine | distance | Parking Souterrain Maudit | `horodateur-vengeur` |
| 17 | **Mannequin Vitrine Possédé** | mannequin | mêlée | Studio de Télé-Achat Abandonné | `mannequin-vitrine-possede` |
| 18 | **Marchand Malhonnête** | zombie | distance | Marché Noir du Donjon | `marchand-malhonnete` |
| 19 | **Ombre Suspicieuse** | shade | mêlée | Rue des Illusions | `ombre-suspicieuse` |
| 20 | **Saucisse Vivante** | blob | mêlée | Usine de Transformation Alimentaire | `saucisse-vivante` |
| 21 | **Caméra de Surveillance Autonome** | machine | distance | Studio de Télé-Achat Abandonné | `camera-de-surveillance-autonome` |
| 22 | **Miroir Brisé** | shade | distance | Rue des Illusions | `miroir-brise` |
| 23 | **Bibliothécaire Fantôme** | shade | distance | Bibliothèque des Oubliés | `bibliothecaire-fantome` |
| 24 | **Fromage qui Pue** | blob | mêlée | Usine de Transformation Alimentaire | `fromage-qui-pue` |
| 25 | **Sac de Pièces Vivant** | blob | mêlée | Marché Noir du Donjon | `sac-de-pieces-vivant` |
| 26 | **Frite de Piscine Étrangleuse** | plant | mêlée | Piscine Municipale Désaffectée | `frite-de-piscine-etrangleuse` |
| 27 | **Mime Aggressif** | mannequin | mêlée | Rue des Illusions | `mime-aggressif` |
| 28 | **Nuage de Chlore Ambulant** | shade | mêlée | Piscine Municipale Désaffectée | `nuage-de-chlore-ambulant` |
| 29 | **Tulipe Géante** | plant | mêlée | Jardins Carnivores | `tulipe-geante` |
| 30 | **Contrôleur de Billets Zombifié** | zombie | mêlée | Tunnels de Métro Abandonnés | `controleur-de-billets-zombifie` |
| 31 | **Livre Maudit** | shade | mêlée | Bibliothèque des Oubliés | `livre-maudit` |
| 32 | **Câble Électrique Vivant** | swarm | mêlée | Salle des Machines Infernales | `cable-electrique-vivant` |
| 33 | **Encre Vivante** | shade | mêlée | Bibliothèque des Oubliés | `encre-vivante` |
| 34 | **Cône de Chantier Fou** | mannequin | mêlée | Parking Souterrain Maudit | `cone-de-chantier-fou` |
| 35 | **Monstre de Poussière** | blob | mêlée | Catacombes des Chaussettes Perdues | `monstre-de-poussiere` |
| 36 | **Gobelin Paysagiste** | goblinoid | mêlée | Jardins Carnivores | `gobelin-paysagiste` |
| 37 | **Rat Goulot** | beast | mêlée | Tunnels de Métro Abandonnés | `rat-goulot` |
| 38 | **Stagiaire Démoniaque** | goblinoid | mêlée | Bureaux de l'Administration Pénitentiaire | `stagiaire-demoniaque` |
| 39 | **Chaussette Solitaire** | mannequin | mêlée | Catacombes des Chaussettes Perdues | `chaussette-solitaire` |

### Ordre de production (6 mobs = 12 images par lot)

- **Lot 1** : Lave-Linge Possédé · Ordinateur en Colère · Garde du Marché · Voiture Abandonnée Rouillée · Photocopieuse Carnivore · Robot Défectueux
- **Lot 2** : Distributeur de Snacks Hanté · Ronce Étrangleuse · Garde-Chiourme Bureaucrate · Ouvrier à la Chaîne · Imprimante à Rêves · Créature en Bocaux
- **Lot 3** : Savant Dingue · Maître-Nageur Zombifié · Présentateur Télé-Achat Hystérique · Horodateur Vengeur · Mannequin Vitrine Possédé · Marchand Malhonnête
- **Lot 4** : Ombre Suspicieuse · Saucisse Vivante · Caméra de Surveillance Autonome · Miroir Brisé · Bibliothécaire Fantôme · Fromage qui Pue
- **Lot 5** : Sac de Pièces Vivant · Frite de Piscine Étrangleuse · Mime Aggressif · Nuage de Chlore Ambulant · Tulipe Géante · Contrôleur de Billets Zombifié
- **Lot 6** : Livre Maudit · Câble Électrique Vivant · Encre Vivante · Cône de Chantier Fou · Monstre de Poussière · Gobelin Paysagiste
- **Lot 7** : Rat Goulot · Stagiaire Démoniaque · Chaussette Solitaire

## 4. Les 3 chasseurs de primes (`face` seulement, après les mobs)

- **Gobelin Pisteur de Primes** (`gobelin-pisteur-de-primes`)
- **Gobelin Cogneur de Primes** (`gobelin-cogneur-de-primes`)
- **Chef d'Escouade Gobelin** (`chef-d-escouade-gobelin`)

Ce sont des gobelins chasseurs de primes (archétype goblinoïde, voir `bountyHunters` dans `bestiary.js`). Ils te **traquent** : posture de chasseur, avis de recherche (formes
illisibles, aucune lettre) placardé derrière ou tenu en main, arme prête (arc pour le Pisteur, grosse masse pour le Cogneur, le Chef d'Escouade plus imposant avec un insigne). Décor : le quartier courant, au choix.

## 5. Livraison (par lots)

1. **Un lot à la fois**. Pour chaque lot : d'abord une **page d'aperçu HTML autonome** (iPhone, portrait, avec le bandeau de 22 % en bas) montrant les 12 images, puis **attends mon feu vert**.
2. Ensuite les fichiers SVG complets (jamais de « reste inchangé »), nommés exactement selon la section 1, plus une courte liste « ce qui est dessiné » par mob.
3. Commentaires en français. Aucun texte dans les images.
4. **Auto-contrôle avant livraison** (coche-le pour chaque image) : sujet dans la zone, détail signature visible, regard braqué sur nous (face) ou occupé (back), même personnage face/back,
   pas de pose frontale figée, `id=` ASCII, aucun `<text>`, < 20 Ko.
5. Si tu dérives (style, proportions, couleurs) au fil d'un lot, **dis-le** et reprends depuis une image de référence plutôt que de continuer.

Commence par le **lot 1** (les 6 mobs les plus dangereux).
