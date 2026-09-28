# Prompt Gemini — TEST sur un seul mob (avant de lancer le chantier complet)

> But : vérifier sur UN mob que le style de Gemini te plaît et que son format de livraison s'intègre au
> jeu. Copie tout ce qui suit la ligne ci-dessous dans Gemini.

---

Tu es illustrateur SVG et développeur front-end. Tu travailles sur **Crawler**, un rogue-like mobile
inspiré de *Dungeon Crawler Carl* (humour sarcastique de téléréalité). Pas de framework, pas d'étape de
build : HTML + JS vanilla, affiché sur **iPhone (375 px de large)**.

Ceci est un **essai sur un seul mob**. Il sert à valider ton style graphique et ton format de livraison
avant de te confier les 39 mobs et les 13 boss. Soigne-le comme un échantillon de ton meilleur travail.

## 1. Lis d'abord le dépôt

Dépôt public, branche **`graphique`**. Lecture brute d'un fichier :
`https://raw.githubusercontent.com/maximegardere-beep/Crawler/graphique/<chemin>`

1. `prompts/gemini-phase4-5-mobs.md` : le brief du chantier complet. **Ses sections 0, 1 et 2
   (règles absolues, décisions validées, direction artistique) s'appliquent intégralement à cet
   essai.** Les formats de la section 4 aussi.
2. `sprites/mobs.js` : la silhouette actuelle `zombie`, son repère et les classes `mf-*`.
3. `sprites/crawler.js` et `sprites/items-signature.js` : le style de référence (trait, aplats,
   contours).
4. `sprites/fx.js` : `MOB_EFFECT_FX_COLORS`.
5. `bestiary.js` : l'entrée « Contrôleur de Billets Zombifié » et le modificateur « Enflammé »
   (effet `burn`).
6. `backdrops.js` : la fiche `SCENE_BACKDROPS['Tunnels de Métro Abandonnés']`, le quartier où vit ce
   mob. Contente-toi de reprendre sa palette et son ambiance.

**Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier.** N'invente jamais le
contenu d'un fichier.

## 2. Le mob à dessiner

**Contrôleur de Billets Zombifié**, archétype `zombie`, dans le quartier « Tunnels de Métro
Abandonnés ». Au combat, il apparaît souvent avec le modificateur **Enflammé** (effet `burn`).

À livrer :
1. **La silhouette d'archétype `zombie` redessinée.** Elle servira ensuite aux 12 autres zombies :
   Garde du Marché, Ouvrier à la Chaîne, Savant Dingue, Maître-Nageur Zombifié… Elle doit donc rester
   générique : pas d'uniforme, pas d'accessoire propre au contrôleur.
2. **Le détail signature du Contrôleur**, dessiné par-dessus la silhouette : par exemple casquette
   d'agent, pince à composter, sacoche, gilet d'uniforme. C'est à toi de proposer. On doit
   reconnaître « un contrôleur zombie » d'un coup d'œil à taille réelle.
3. **Ses couleurs naturelles** (palette `base`/`dark`/`accent`) : peau verdâtre de zombie, uniforme
   délavé.
4. **L'aura `burn`** : ellipses semi-transparentes + 2 ou 3 flammèches, à la couleur
   `MOB_EFFECT_FX_COLORS.burn`.
5. **L'aura `stun`**, à la couleur `MOB_EFFECT_FX_COLORS.stun`, pour montrer que ton système d'auras
   se décline d'un effet à l'autre.

Rappels essentiels (le détail complet est dans le brief) : vue de profil tournée vers la **droite** ;
x = 0 au centre, y = 0 aux pieds ; **tout tient dans x ∈ [-24, +24]**, aura comprise ; `top` entre
-60 et -88 ; contour `#05060c` ; aplats ; ombre au sol `class="scene-ground-shadow"`. Interdit :
`<defs>`, `id=`, gradients, filtres, `Math.random()`. Au plus 45 éléments SVG, aura comprise.

## 3. Ce que tu livres (2 fichiers téléchargeables, complets)

Donne-les comme **fichiers téléchargeables** (Canvas / pièce jointe). Si tu ne peux pas, fais un
`.zip`. En dernier recours seulement, un bloc de code unique par fichier, avec son chemin en titre.

### Fichier A — `preview/test-controleur.html` (autonome, pour mon iPhone)
Page autonome, qui ne charge rien du dépôt. Elle contient une copie du crawler
(`SCENE_CRAWLER_SVG`), pour l'échelle. Fond de page sombre `#0b0d14`, aucun débordement horizontal à
375 px, aucune erreur console.
1. En haut : bouton « Taille réelle / Zoom ×3 », case « Cadre ±24 » (cadre rouge pointillé de x = -24 à
   +24 et ligne horizontale à `top`), case « Réduire les animations ».
2. **Scène 1 — au contact** : cadre au ratio 360 × 150, fond aux couleurs du tunnel de métro (mur sombre,
   sol plus sombre à partir de y = 124). Le Contrôleur est à x = 262, aura `burn`, le crawler à x = 306.
3. **Scène 2 — à distance** : même scène, le Contrôleur à x = 30, le crawler à x = 306.
4. **Planche de variantes**, côte à côte : silhouette `zombie` seule (sans détail), Contrôleur sans aura,
   avec aura `burn`, avec aura `stun`.
5. **Planche d'échelle** : l'ancien zombie (recopié tel quel depuis `sprites/mobs.js`) à côté du nouveau,
   à taille réelle, pour comparer hauteur et épaisseur de trait.

### Fichier B — `sprites/mob-test.js` (au format final exact)
Fichier JS complet qui déclare les données **exactement** dans le format de la section 4 du brief,
pour que je vérifie qu'elles se branchent sans retouche :
```js
const SCENE_MOB_SPRITES_TEST = { zombie: { top, bounds: [xMin, xMax], markup, palette: { base, dark, accent } } };
const MOB_DETAILS_TEST = { 'Contrôleur de Billets Zombifié': { palette: { base, dark, accent }, markup } };
const MOB_EFFECT_AURAS_TEST = { burn: (color) => `…`, stun: (color) => `…` };
```
Mets un commentaire d'en-tête en français, dans le style des fichiers `sprites/*.js`. Utilise les
classes `mf-base`/`mf-dark`/`mf-accent`/`mf-line` pour les parties colorées par la palette, et ajoute
le bloc `module.exports` final comme dans les autres fichiers. Le fichier doit passer `node --check`.
Dans `markup`, `bounds` doit correspondre aux vrais x minimum et maximum du dessin.

## 4. Format de ta réponse (court)

1. Les 2 fichiers.
2. En 3 à 5 lignes : ce qui rend le Contrôleur reconnaissable, et tes choix de couleurs.
3. `top`, `bounds` et le nombre d'éléments SVG du zombie seul, du Contrôleur complet et de chaque
   aura.
4. Au plus 2 questions si un choix visuel est ambigu. Pose-les au lieu de deviner.

Ne fais rien d'autre : pas d'autres mobs, pas de modification de fichiers existants.
