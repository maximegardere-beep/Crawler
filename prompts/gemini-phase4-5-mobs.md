# Prompt Gemini — Crawler : sprites des mobs (phase 4) et des 13 boss (phase 5)

> Copie tout ce qui suit la ligne ci-dessous dans Gemini (modèle le plus capable, avec accès web et
> Canvas si possible).

---

Tu es illustrateur SVG et développeur front-end. Tu travailles sur **Crawler**, un rogue-like mobile
inspiré de *Dungeon Crawler Carl* (humour sarcastique de téléréalité). Pas de framework, pas d'étape de
build : HTML + JS vanilla, Tailwind en CDN, publié sur GitHub Pages. Tout se joue sur **iPhone (375 px de
large)**.

Ta mission : **redessiner les mobs de la scène de combat** en deux temps, avec une **prévisualisation à
valider AVANT** toute livraison de fichiers d'intégration.

## 0. Règles absolues

1. **Lis le dépôt toi-même avant d'écrire quoi que ce soit.** Dépôt public, branche **`graphique`** :
   `https://github.com/maximegardere-beep/Crawler/tree/graphique`. Lecture brute d'un fichier :
   `https://raw.githubusercontent.com/maximegardere-beep/Crawler/graphique/<chemin>`.
   À lire obligatoirement, dans cet ordre :
   - `CLAUDE.md` (architecture et conventions : c'est la référence, respecte-la) ;
   - `sprites/mobs.js` (les 10 silhouettes actuelles, leur format et leur repère) ;
   - `sprites/crawler.js`, `sprites/npcs.js`, `sprites/items-signature.js` (style graphique de référence) ;
   - `sprites/fx.js` (couleurs d'effet `MOB_EFFECT_FX_COLORS`) ;
   - `bestiary.js` (les 39 mobs de `baseMobs`, les 13 boss de `districtBosses`, `visualArchetype`,
     `effect`, `mobModifiers`) ;
   - `generator.js` (`generateMob()` ajoute un suffixe au nom : « Rat Goulot Enflammé ») ;
   - `scene.js` (`renderSceneMob()`, `mobAt()`, `MOB_EFFECT_TINTS`, `applySceneTint()`, `wrapSceneBody()`,
     constantes `SCENE_GROUND_Y`, `CRAWLER_X`, `MOB_EXTENT`) ;
   - `fx.js` (`fxMobSprite()` lit la hauteur `top` du sprite) ;
   - `index.html` (classes CSS `.mf-base/.mf-dark/.mf-accent/.mf-line`, bloc
     `@media (prefers-reduced-motion: reduce)`, liste des `<script>` et leur `?v=`) ;
   - `tests/load_game.js` (`GAME_FILES`) et `tests/regression/combat-scene.js` (style des tests).

   **Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier.** N'invente JAMAIS le
   contenu d'un fichier existant.
2. **Livre des fichiers, pas des extraits.** Chaque fichier livré doit être le fichier **COMPLET**, prêt à
   remplacer l'existant : pas de `// ... reste inchangé`, pas de diff, pas de « ajoute ceci ligne 400 ».
   Donne chaque fichier comme **fichier téléchargeable** (Canvas / pièce jointe). Si tu ne peux pas, fais
   une archive `.zip`. En dernier recours seulement, un bloc de code unique par fichier, avec son chemin
   exact en titre.
3. **Ne touche à rien d'autre** que ce qui est listé ici : aucune règle de jeu, aucun chiffre
   d'équilibrage, aucun texte, aucune autre fonction. Dans un fichier existant, recopie tout le reste
   **à l'identique**, caractère pour caractère.
4. **Deux étapes, avec un arrêt entre les deux.** Étape 1 : la prévisualisation seule, puis tu
   t'arrêtes et tu attends ma validation. Étape 2 : les fichiers d'intégration, une fois que j'ai
   validé (et intégré mes retours).
5. Code et commentaires **en français**, dans le style des fichiers existants (commentaire d'en-tête qui
   explique le rôle du fichier, un commentaire court au-dessus de chaque mob).

## 1. Ce qui a déjà été décidé (ne pas remettre en question)

- **10 silhouettes d'archétype + 1 détail signature par mob.** Les 39 mobs gardent leur archétype
  (`goblinoid`, `beast`, `zombie`, `machine`, `plant`, `shade`, `blob`, `mannequin`, `swarm`, `vehicle`),
  mais chacun reçoit un **détail qui le rend reconnaissable** : accessoire, forme de tête, objet tenu. Par
  exemple, sécateur et chapeau de paille pour le Gobelin Paysagiste, goulot de bouteille pour le Rat
  Goulot, badge « STAGIAIRE » et mug pour le Stagiaire Démoniaque, tambour à hublot pour le Lave-Linge
  Possédé. Propose les 39 détails toi-même à partir des noms.
- **13 boss uniques** : chaque boss de `districtBosses` a sa propre silhouette complète, pas un
  archétype + détail. Il **tient ou porte son objet signature**, en réutilisant le dessin existant
  `ITEM_SPRITES['<nom de l'objet>'].art` (sprites/items-signature.js) par `<g transform="…">`, pour que
  l'objet soit identique à celui que le joueur récupère. La couronne `SCENE_BOSS_CROWN_SVG` reste posée
  au-dessus de la tête.
- **Couleurs naturelles + aura d'effet.** Chaque mob a SES couleurs (rat gris-brun, tulipe rouge et
  verte, cône orange à bandes blanches…). La teinte par effet (`MOB_EFFECT_TINTS`) disparaît : l'effet du
  mob (`enemy.effect` : bleed, burn, confusion, corrode, fear, light, poison, pull, slow, stun) se voit
  par une **aura** derrière lui, à la couleur de `MOB_EFFECT_FX_COLORS[effet]` (sprites/fx.js).
- **Pas de liseré ni de cadre de rareté ou d'élite.**

## 2. Direction artistique (obligatoire)

- **Vue de profil, tourné vers la DROITE** (vers le crawler). Repère : x = 0 au centre, y = 0 au sol
  (les pieds), y négatif vers le haut.
- **Emprise horizontale stricte : tout dans [-24, +24]** (`MOB_EXTENT`), aura comprise. C'est ce qui
  garantit qu'aucun mob ne chevauche le crawler au contact.
- **Hauteur** : mobs entre `top` = -40 et -88 ; boss entre -60 et -88, la couronne (13 unités) au-dessus.
  Déclare le vrai `top` (point le plus haut, couronne exclue).
- **Même style que le crawler et les objets** : aplats, contour sombre `#05060c` (épaisseur 2 à 2,5 pour
  le corps, 1 à 1,5 pour les détails), `stroke-linejoin="round"`, une teinte de base, une ombre, au plus
  un reflet clair. Petits yeux vifs pour la lisibilité (accent). Ombre au sol :
  `<ellipse class="scene-ground-shadow" …/>` à y = 0. Les `shade` flottent au-dessus de leur ombre.
- **Lisibilité à taille réelle** : sur iPhone, 1 unité ≈ 1 pixel, donc un mob fait environ 50 à 85 px de
  haut. Silhouette reconnaissable d'un coup d'œil ; détail signature assez gros, au moins 6 unités.
  Pas de texte, sauf sur un badge ou une étiquette de 5 unités minimum.
- **Plus saturé et plus clair que les décors** (murs sombres, peu saturés). Évite le rouge vif en grand
  aplat : le rouge est réservé aux yeux, au sang et aux dégâts.
- **Humour DCC** : le mob est ridicule ET menaçant à la fois (bureaucrate zombie à la cravate de
  travers, chaussette avec un air de tueur).
- **Aura d'effet** : 2 ou 3 ellipses concentriques semi-transparentes (opacité 0,12 à 0,3) derrière le
  corps, plus 2 ou 3 petites particules propres à l'effet : flammèches (burn), bulles (poison),
  cristaux (slow), étincelles (stun), spirales (confusion), gouttes (bleed), fumée violette (fear), rayons
  (light), éclaboussures acides (corrode), lignes d'aspiration (pull). Elle doit rester discrète : le mob
  passe avant son aura.
- **Techniquement interdit** : `<defs>`, `id=`, gradients, filtres, `<image>`, polices externes,
  `Math.random()`. Plusieurs scènes affichent des mobs en même temps : un identifiant SVG entrerait en
  collision. Au plus 45 éléments SVG par mob, aura comprise ; un boss peut aller jusqu'à 70.
- **Animation (facultative)** : uniquement par classes CSS lentes (≥ 1,5 s), par exemple
  `.mob-aura-pulse` ou `.mob-float`, à ajouter dans `index.html` ET à couper dans le bloc
  `@media (prefers-reduced-motion: reduce)` existant.

## 3. Étape 1 — Prévisualisation (à livrer seule, puis STOP)

Livre **un seul fichier autonome** `preview/mobs-preview.html`, que j'ouvrirai sur mon iPhone. Il ne
charge rien du dépôt : il contient une copie des nouveaux dessins et du crawler (`SCENE_CRAWLER_SVG`
de sprites/crawler.js, pour l'échelle).

Contenu :
1. En haut : bouton « Taille réelle / Zoom ×2 », case « Cadre ±24 » (trace un cadre rouge pointillé de
   x = -24 à +24 et une ligne à `top`), case « Réduire les animations ».
2. **Section « 39 mobs »** : pour chacun, une scène au ratio 360 × 150 (fond `#1a1d26` avec un sol plus
   sombre à y = 124), le mob posé à x = 262 (position au contact), le crawler à x = 306. Sous la
   scène : nom, archétype, effet. Deux colonnes sur 375 px.
3. **Section « Auras »** : un même mob répété avec les 10 effets.
4. **Section « 13 boss »** : même présentation, couronne comprise, avec le nom de l'objet signature.
5. **Section « Contrôle »** : planche compacte de tous les mobs côte à côte à taille réelle, pour
   vérifier qu'ils ont tous la même échelle et la même épaisseur de trait.

Aucun débordement horizontal à 375 px, aucune erreur console.

Avec la prévisualisation, donne la **liste des 39 détails signature et des 13 boss** en une ligne
chacun (« Rat Goulot — goulot de bouteille vert sur le dos, queue en tire-bouchon »), puis
**arrête-toi** et attends mes retours.

## 4. Étape 2 — Fichiers d'intégration (après validation seulement)

### Nouveaux fichiers ou fichiers réécrits (catalogues purs, sans DOM ni gameState)
- `sprites/mobs.js` : les 10 silhouettes redessinées, même clés. Format par archétype :
  `{ top, bounds: [xMin, xMax], markup, palette: { base, dark, accent } }`. `palette` sert de couleurs
  par défaut. Garde les classes `mf-base`/`mf-dark`/`mf-accent`/`mf-line` pour les parties colorées
  par la palette. Garde `SCENE_BOSS_CROWN_SVG` tel quel.
- `sprites/mob-details.js` : `MOB_DETAILS`, clé = nom EXACT de `baseMobs`, valeur
  `{ palette: { base, dark, accent }, markup }`. `markup` est le détail signature, dessiné par-dessus
  la silhouette, dans le même repère. Plus `MOB_EFFECT_AURAS`, clé = effet, valeur = fonction
  `(color) => markup` dessinée DERRIÈRE le mob.
- `sprites/bosses.js` : `SCENE_BOSS_SPRITES`, clé = nom EXACT du boss, valeur
  `{ top, bounds, markup, palette }`. L'objet signature est repris de `ITEM_SPRITES` : ce fichier est donc
  chargé APRÈS `sprites/items-signature.js`.

Les fichiers restent courts et thématiques : c'est la règle du projet, pour qu'on ne relise que le
fichier concerné. Si `mob-details.js` dépasse environ 350 lignes, coupe-le en deux (par exemple
`mob-details-a.js` : archétypes goblinoid à machine, `mob-details-b.js` : le reste), chacun ajouté au
registre par `Object.assign`.

### Fichiers existants à modifier (livrés COMPLETS)
- `scene.js` :
  - ajoute `resolveMobSprite(enemy)` (pure). Elle renvoie
    `{ key, top, markup, palette, aura }` en suivant cette priorité :
    1. boss présent dans `SCENE_BOSS_SPRITES` ;
    2. sinon, silhouette de l'archétype + `MOB_DETAILS[nom]` (palette du mob, sinon celle de
       l'archétype) ;
    3. archétype inconnu : `goblinoid`.

    Le nom se résout ainsi : `enemy.baseName`, puis nom exact, puis le plus long nom connu par lequel
    `enemy.name` commence (même logique que `resolveItemSpriteKey()`, pour les anciennes sauvegardes).
    L'aura vient de `MOB_EFFECT_AURAS[enemy.effect]`, colorée avec `MOB_EFFECT_FX_COLORS`.
  - `renderSceneMob()` et `mobAt()` utilisent `resolveMobSprite()`. L'aura est dessinée avant le corps.
    La palette passe par les variables CSS (`--mob-base`, `--mob-dark`, `--mob-accent`). La clé de cache
    inclut le nom résolu et l'effet. `MOB_EFFECT_TINTS` est supprimé (les compagnons gardent
    `COMPANION_SPECIALTY_TINTS`). Garde `wrapSceneBody()` : `.scene-body > .scene-pose`, nécessaire aux
    animations d'attaque de fx.js. La couronne se pose à `top - 2`.
- `fx.js` : `fxMobSprite()` renvoie `resolveMobSprite(gameState.currentEnemy)`. Rien d'autre ne change.
- `generator.js` : dans `generateMob()`, pose `finalMob.baseName = finalMob.name` **avant** l'ajout des
  suffixes de modificateurs. Même chose dans `generateBoss()`. Rien d'autre ne change.
- `index.html` : ajoute les `<script>` des nouveaux fichiers. Ordre : `sprites/mobs.js`,
  `sprites/mob-details*.js`, puis `sprites/bosses.js` juste après `sprites/items-signature.js`, toujours
  avant `sprites/fx.js`, `backdrops.js` et `scene.js`. Passe **TOUS** les `?v=` au nombre actuel + 1.
  Ajoute les éventuelles classes d'animation et leur arrêt sous reduced motion. Rien d'autre ne change.
- `tests/load_game.js` : même ordre de fichiers dans `GAME_FILES`.
- `tests/regression/combat-scene.js` : **ajoute une section à la fin** (ne modifie pas les sections
  existantes, sauf une assertion qui dépendrait de `MOB_EFFECT_TINTS`). La section vérifie que :
  - chacun des 39 `baseMobs` a son entrée `MOB_DETAILS` et chacun des 13 boss son entrée
    `SCENE_BOSS_SPRITES` ;
  - chaque effet de `mobModifiers` et de `districtBosses` a son aura ;
  - chaque `bounds` est dans [-24, 24] ;
  - chaque `top` est dans les plages ci-dessus ;
  - aucun markup ne contient `undefined`, `NaN`, `id=`, `<defs` ou `<image` ;
  - `resolveMobSprite()` retrouve le bon mob pour « Rat Goulot Enflammé et Colossal », retombe sur
    `goblinoid` pour un archétype inconnu, et choisit le sprite unique d'un boss ;
  - `generateMob()` pose `baseName`.
- `CLAUDE.md` : mets à jour la ligne `sprites/` de la section Fichiers et le paragraphe « Scène de
  combat » (silhouettes, détails, boss, auras, `resolveMobSprite()`), dans le style existant.

### Vérifie toi-même avant de livrer
- Chaque fichier JS passe `node --check`. Relis-le : pas de virgule manquante, pas d'accolade orpheline,
  apostrophes des noms échappées (« L'IA Malveillante »).
- Chaque nom de mob et de boss est recopié EXACTEMENT depuis bestiary.js (accents, apostrophes,
  parenthèses de « Le Directeur Général (Édition Cauchemar) »).
- Dans les fichiers existants, seules les zones listées ont changé. Termine par un tableau
  « fichier → zones modifiées ».
- Je lancerai `npm test` et `npm run test:long`. Signale ce qui risque d'échouer.

## 5. Format de ta réponse

- **Étape 1** : le fichier `preview/mobs-preview.html`, la liste des détails et des boss, et une ou
  deux questions si un choix visuel est ambigu. Pose-la au lieu de deviner. Rien d'autre.
- **Étape 2** (après mon feu vert) : tous les fichiers en téléchargement, le tableau des modifications,
  puis la liste des points à vérifier sur iPhone.
