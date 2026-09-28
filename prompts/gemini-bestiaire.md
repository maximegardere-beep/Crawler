# Prompt Gemini — Crawler : sprites du bestiaire (les 39 mobs, sans les boss)

> Copie tout ce qui suit la ligne ci-dessous dans Gemini (modèle le plus capable, avec accès web et
> Canvas si possible). Les 13 boss feront l'objet d'un prompt séparé plus tard.

---

Tu es illustrateur SVG et développeur front-end. Tu travailles sur **Crawler**, un rogue-like mobile
inspiré de *Dungeon Crawler Carl* (humour sarcastique de téléréalité). HTML + JS vanilla, sans build,
affiché sur **iPhone (375 px de large)**.

Ta mission : **dessiner le bestiaire**, c'est-à-dire les 10 silhouettes d'archétype redessinées, un
détail signature pour chacun des 39 mobs et les 10 auras d'effet. Tu livres **seulement des fichiers de
sprites** (catalogues de données). Le branchement dans le moteur du jeu sera fait à part : ne modifie
aucun autre fichier.

Un essai sur un mob a déjà été validé : le **Contrôleur de Billets Zombifié**. Garde exactement ce style
et ce format pour tout le reste.

## 0. Règles absolues

1. **Lis le dépôt avant d'écrire quoi que ce soit.** Dépôt public, branche **`graphique`**. Lecture
   brute : `https://raw.githubusercontent.com/maximegardere-beep/Crawler/graphique/<chemin>`.
   À lire :
   - `prompts/reference/mob-test-controleur.js` : **l'essai validé, ta référence de style et de
     format**. Les 3 lignes de commentaire en tête listent ses défauts à ne pas reproduire.
   - `sprites/mobs.js` : les silhouettes actuelles, leur repère et `SCENE_BOSS_CROWN_SVG`.
   - `sprites/crawler.js` et `sprites/items-signature.js` : style du trait.
   - `sprites/fx.js` : `MOB_EFFECT_FX_COLORS`, les couleurs des 10 effets.
   - `bestiary.js` : `baseMobs` (noms, archétypes, `allowedTags`) et `mobModifiers` (effets).
   - `districts.js` : le quartier de chaque mob. `backdrops.js` : l'ambiance de chaque quartier, pour
     que le mob y soit lisible.
   - `index.html` : les classes `.mf-base`, `.mf-dark`, `.mf-accent` et `.mf-line`.

   **Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier.** N'invente jamais son
   contenu.
2. **Livre des fichiers complets et téléchargeables** (Canvas / pièce jointe ; sinon un `.zip` ; en
   dernier recours, un bloc de code unique par fichier avec son chemin exact en titre). Jamais de
   `// ... reste inchangé`, jamais de diff.
3. **Deux étapes avec un arrêt entre les deux.** Étape 1 : prévisualisation, puis tu attends ma
   validation. Étape 2 : les fichiers de sprites, en tenant compte de mes retours.
4. Commentaires **en français**, dans le style des fichiers `sprites/*.js` : en-tête qui explique le rôle
   du fichier, puis une ligne au-dessus de chaque mob qui décrit son signe distinctif.

## 1. Les 39 mobs (noms EXACTS, à recopier tels quels, accents et apostrophes compris)

- `beast` (1) : Rat Goulot
- `machine` (8) : Distributeur de Snacks Hanté, Photocopieuse Carnivore, Robot Défectueux, Lave-Linge
  Possédé, Imprimante à Rêves, Ordinateur en Colère, Horodateur Vengeur, Caméra de Surveillance Autonome
- `zombie` (8) : Contrôleur de Billets Zombifié (**déjà fait, reprends l'essai en corrigeant la
  bouche**), Garde-Chiourme Bureaucrate, Ouvrier à la Chaîne, Savant Dingue, Marchand Malhonnête, Garde
  du Marché, Maître-Nageur Zombifié, Présentateur Télé-Achat Hystérique
- `plant` (3) : Tulipe Géante, Ronce Étrangleuse, Frite de Piscine Étrangleuse
- `goblinoid` (2) : Gobelin Paysagiste, Stagiaire Démoniaque
- `blob` (5) : Saucisse Vivante, Fromage qui Pue, Créature en Bocaux, Monstre de Poussière, Sac de Pièces
  Vivant
- `shade` (6) : Livre Maudit, Bibliothécaire Fantôme, Encre Vivante, Ombre Suspicieuse, Miroir Brisé,
  Nuage de Chlore Ambulant
- `mannequin` (4) : Mime Aggressif (sic, garde deux « g »), Chaussette Solitaire, Cône de Chantier Fou,
  Mannequin Vitrine Possédé
- `swarm` (1) : Câble Électrique Vivant
- `vehicle` (1) : Voiture Abandonnée Rouillée

Les 13 boss réutilisent ces silhouettes d'archétype en attendant leur propre sprite (autre prompt). Les
silhouettes doivent donc rester **génériques** : c'est le détail qui fait le mob.

## 2. Décisions déjà prises (ne pas remettre en question)

- **Silhouette d'archétype + 1 détail signature par mob** : accessoire, tête, objet tenu, forme
  propre. On doit reconnaître le mob d'un coup d'œil. Exemple validé : le Contrôleur (casquette à bande
  rouge + pince à composter + sacoche). Autres pistes : sécateur et chapeau de paille pour le Gobelin
  Paysagiste, badge « STAGIAIRE » et mug pour le Stagiaire Démoniaque, tambour à hublot pour le
  Lave-Linge. Propose le reste.
- **Couleurs naturelles par mob** (palette `base`/`dark`/`accent`), qui remplacent l'ancienne teinte par
  effet.
- **Aura d'effet derrière le mob**, une par effet de `mobModifiers` : `bleed`, `burn`, `confusion`,
  `corrode`, `fear`, `light`, `poison`, `pull`, `slow`, `stun`. Couleur passée en paramètre
  (`MOB_EFFECT_FX_COLORS`).
- **Aucun liseré ni cadre de rareté ou d'élite.**

## 3. Direction artistique (obligatoire, comme l'essai validé)

- **Profil tourné vers la DROITE.** x = 0 au centre, y = 0 aux pieds, y négatif vers le haut.
- **Tout tient dans x ∈ [-24, +24]**, détail ET aura compris : c'est ce qui évite tout chevauchement
  avec le crawler au contact.
- **Hauteur** : `top` entre -40 et -88. Ordre de grandeur : le crawler mesure 92 et les mobs sont un
  peu plus petits que lui, sauf les gros (blob, vehicle) qui sont larges et bas.
- **Trait** : contour `#05060c`, épaisseur 2 à 2,5 pour le corps et 1 à 1,5 pour les détails,
  `stroke-linejoin="round"`. Aplats, une ombre, au plus un reflet clair. Yeux vifs (`mf-accent`).
  Ombre au sol `<ellipse class="scene-ground-shadow" …/>` à y = 0. Les `shade` flottent au-dessus de
  leur ombre.
- **`mf-line` = trait de 4 unités**, réservé aux membres et aux queues. Pour une bouche, une couture ou
  une ride : `stroke` et `stroke-width` explicites (0,8 à 1,5). C'était le défaut de l'essai.
- **Lisible à taille réelle** : 1 unité ≈ 1 px sur iPhone, et un détail signature fait au moins
  6 unités. Pas de texte, sauf sur un badge ou une étiquette de 5 unités minimum.
- **Plus clair et plus saturé que les décors** (sombres et désaturés). Pas de grand aplat rouge vif :
  le rouge est réservé aux yeux, au sang et aux dégâts.
- **Humour DCC** : ridicule ET menaçant (bureaucrate zombie à la cravate de travers, chaussette avec un
  regard de tueur, cône de chantier enragé).
- **Postures vivantes** : les zombies penchés en avant, bouche pendante. L'essai était un peu trop droit
  et sage.
- **Aura** : 2 ou 3 ellipses concentriques (opacité 0,12 à 0,3) + 2 ou 3 particules propres à l'effet :
  flammèches (burn), bulles (poison), cristaux (slow), étincelles en zigzag (stun), spirales
  (confusion), gouttes (bleed), volutes violettes (fear), rayons (light), éclaboussures acides
  (corrode), lignes d'aspiration vers le mob (pull). L'aura reste discrète : le mob passe avant elle.
  Elle est centrée sur un corps « moyen » (ellipses vers y = -38) et doit rester correcte derrière un
  mob bas (blob) comme derrière un mob haut (zombie).
- **Animation** : seulement les classes `mob-aura-a`, `mob-aura-b`, `mob-aura-c` sur les particules
  d'aura (décalées dans le temps) et `mob-float` pour les `shade`. Tu ne les définis pas : c'est fait
  dans le jeu, lentes et coupées quand « Réduire les animations » est activé.
- **Interdit** : `<defs>`, `id=`, gradients, filtres, `<image>`, polices externes, `Math.random()`. Au
  plus 45 éléments SVG par mob complet (silhouette + détail).

## 4. Étape 1 — Prévisualisation (à livrer seule, puis STOP)

Livre un fichier autonome **`preview/bestiaire-preview.html`** à ouvrir sur iPhone. Il ne charge rien du
dépôt : il contient une copie des nouveaux dessins et du crawler (`SCENE_CRAWLER_SVG`), pour l'échelle.
Fond de page `#0b0d14`, aucun débordement horizontal à 375 px, aucune erreur console.

1. **En haut** : bouton « Taille réelle / Zoom ×2 », case « Cadre ±24 » (cadre rouge pointillé de -24 à
   +24 et ligne à `top`), case « Réduire les animations ».
2. **39 mobs, groupés par archétype.** Chaque mob a une scène au ratio 360 × 150 : mur sombre aux
   couleurs de son quartier, sol plus sombre à partir de y = 124, mob à x = 262, crawler à x = 306.
   Sous la scène : nom exact et archétype. Deux colonnes sur 375 px.
3. **Les 10 silhouettes seules**, sans détail, côte à côte.
4. **Les 10 auras** derrière un même mob moyen, puis la même aura `burn` derrière un blob et
   derrière un zombie.
5. **Planche de contrôle** : les 39 mobs alignés à taille réelle sur une même ligne de sol (plusieurs
   rangées), pour comparer échelle et épaisseur de trait.

Ajoute ensuite la **liste des 39 détails**, une ligne par mob (« Rat Goulot — goulot de bouteille vert
planté dans le dos, queue en tire-bouchon »), et au plus 3 questions si un choix est ambigu.
**Arrête-toi** et attends mes retours.

## 5. Étape 2 — Fichiers de sprites (après validation seulement)

Quatre fichiers JS complets, qui passent `node --check`, sans DOM ni `gameState` (catalogues purs,
comme les autres `sprites/*.js`), chacun terminé par le bloc
`if (typeof module !== 'undefined' && module.exports) { module.exports = { … }; }`.

1. **`sprites/mobs.js`** (remplace l'actuel) : `SCENE_MOB_SPRITES`, avec les 10 mêmes clés au format
   `{ top, bounds: [xMin, xMax], markup, palette: { base, dark, accent } }`. Garde les classes
   `mf-base`/`mf-dark`/`mf-accent`/`mf-line` pour les parties colorées par la palette.
   `SCENE_BOSS_CROWN_SVG` est **recopié à l'identique**. Exporte `SCENE_MOB_SPRITES` et
   `SCENE_BOSS_CROWN_SVG`.
2. **`sprites/mob-details-a.js`** : déclare `const MOB_DETAILS = { … }` pour les mobs `beast`,
   `machine`, `zombie` et `goblinoid` (19 mobs).
3. **`sprites/mob-details-b.js`** : `Object.assign(MOB_DETAILS, { … })` pour `plant`, `blob`, `shade`,
   `mannequin`, `swarm` et `vehicle` (20 mobs).

   Format d'une entrée : clé = nom EXACT, valeur `{ palette: { base, dark, accent }, markup, bounds,
   top? }`. `markup` est le détail, dessiné PAR-DESSUS la silhouette de son archétype, dans le même
   repère. `bounds` = vrais x minimum et maximum du mob COMPLET (silhouette + détail). `top` seulement
   si le détail dépasse le haut de la silhouette. Un mob peut masquer une partie de sa silhouette en la
   recouvrant, mais ne redessine pas toute la silhouette dans le détail.
4. **`sprites/mob-auras.js`** : `const MOB_EFFECT_AURAS = { bleed: (color) => \`…\`, … }`, les 10
   effets, dessinés DERRIÈRE le mob.

**Avant de livrer, vérifie toi-même** :
- les 39 noms sont exactement ceux de la section 1, sans doublon ni oubli (termine par le compte :
  « 39/39 ») ;
- chaque `bounds` est bien dans [-24, 24] et correspond au dessin réel ;
- aucun markup ne contient `undefined`, `NaN`, `id=`, `<defs` ou `<image` ;
- apostrophes échappées dans les chaînes JS ; accolades et virgules correctes.

Termine par un tableau court « mob → top, bounds, nombre d'éléments SVG ». Si la réponse est trop longue
pour un seul message, livre les fichiers dans cet ordre, sur plusieurs messages, en disant lequel
suit : mobs.js + mob-auras.js, puis mob-details-a.js, puis mob-details-b.js.
