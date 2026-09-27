# Prompt Gemini — Crawler : sprites uniques des 13 boss (phase 5)

> Copie tout ce qui suit la ligne ci-dessous dans Gemini (modèle le plus capable, avec accès web et
> Canvas si possible).

---

Tu es illustrateur SVG et développeur front-end. Tu travailles sur **Crawler**, un rogue-like mobile
inspiré de *Dungeon Crawler Carl* (humour sarcastique de téléréalité). HTML + JS vanilla, sans build,
affiché sur **iPhone (375 px de large)**.

Ta mission : **dessiner les 13 boss**. Chacun a sa propre silhouette complète et unique, il tient ou porte
son objet signature, et il est reconnaissable au premier coup d'œil comme « le » boss de son quartier.
Tu livres **seulement des fichiers de sprites** (catalogues de données). Le branchement dans le moteur du
jeu est fait à part : ne modifie aucun autre fichier.

Le bestiaire (39 mobs) a déjà été dessiné et validé dans ce style. Les boss doivent en être la version
« tête d'affiche » : même trait, mais plus imposants, plus détaillés, plus mémorables.

## 0. Règles absolues

1. **Lis le dépôt avant d'écrire quoi que ce soit.** Dépôt public, branche **`graphique`**. Lecture
   brute : `https://raw.githubusercontent.com/maximegardere-beep/Crawler/graphique/<chemin>`.
   À lire :
   - `sprites/mobs.js`, `sprites/mob-details-a.js`, `sprites/mob-details-b.js` : **le style validé du
     bestiaire**, ta référence (trait, palettes, niveau de détail, format).
   - `sprites/mob-auras.js` : les auras d'effet, que le jeu dessinera derrière tes boss.
   - `sprites/items-signature.js` : **les 13 objets signature**, que tes boss doivent tenir ou porter (voir
     section 3). Observe leur repère : une arme de mêlée a sa prise à l'origine et sa tête vers le haut ;
     une arme à distance a sa prise à l'origine et sa bouche vers la GAUCHE ; une armure est dessinée dans
     le repère du crawler.
   - `sprites/crawler.js` : le crawler, pour l'échelle (il mesure 92 unités).
   - `sprites/mobs.js` : la couronne `SCENE_BOSS_CROWN_SVG`, que le jeu pose seul au-dessus de ton boss.
   - `bestiary.js` (`districtBosses`), `backdrops.js` (ambiance de chaque quartier), `sprites/fx.js`
     (`MOB_EFFECT_FX_COLORS`).

   **Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier.** N'invente jamais son
   contenu.
2. **Livre des fichiers complets et téléchargeables** (Canvas / pièce jointe ; sinon un `.zip` ; en
   dernier recours, un bloc de code unique par fichier avec son chemin exact en titre). Jamais de
   `// ... reste inchangé`, jamais de diff.
3. **Deux étapes avec un arrêt entre les deux.** Étape 1 : prévisualisation, puis tu attends ma
   validation. Étape 2 : les fichiers de sprites, en tenant compte de mes retours.
4. Commentaires **en français**, dans le style des fichiers `sprites/*.js` : en-tête qui explique le rôle
   du fichier, puis une ligne au-dessus de chaque boss qui décrit ses signes distinctifs.

## 1. Les 13 boss (noms EXACTS, à recopier tels quels, accents, apostrophes et parenthèses compris)

| Boss | Quartier | Archétype d'origine | Effet (aura) | Objet signature |
|---|---|---|---|---|
| Le Chef de Gare Nécrosé | Tunnels de Métro Abandonnés | `zombie` | stun | Sifflet du Chef de Gare Nécrosé (arme de mêlée) |
| La Mère-Liane | Jardins Carnivores | `plant` | poison | Tronçon de Liane Toxique (arme de mêlée) |
| Le Directeur Général (Édition Cauchemar) | Bureaux de l'Administration Pénitentiaire | `zombie` | slow (tir) | Tampon Encreur du Directeur (arme à distance) |
| Le Boucher Sans Visage | Usine de Transformation Alimentaire | `zombie` | bleed | Couperet du Boucher Sans Visage (arme de mêlée) |
| Le Gardien des Mots Perdus | Bibliothèque des Oubliés | `shade` | confusion | Reliure du Gardien des Mots Perdus (armure) |
| Le Professeur Démentiel | Laboratoire de Fous | `zombie` | poison | Seringue Géante du Professeur Démentiel (arme de mêlée) |
| Le Maître des Illusions | Rue des Illusions | `shade` | confusion | Cape en Lambeaux du Maître des Illusions (armure) |
| Le Roi des Chaussettes Solitaires | Catacombes des Chaussettes Perdues | `mannequin` | slow | Chaussette Royale Dépareillée (armure) |
| Le Baron des Ombres | Marché Noir du Donjon | `shade` | stun | Canne-Épée du Baron des Ombres (arme de mêlée) |
| L'IA Malveillante | Salle des Machines Infernales | `machine` | stun (tir) | Canon à Impulsions de l'IA Malveillante (arme à distance) |
| Le Gardien du Parking Éternel | Parking Souterrain Maudit | `vehicle` | stun | Barre de Péage Maudite (arme de mêlée) |
| Le Grand Requin Gonflable | Piscine Municipale Désaffectée | `beast` | bleed | Dents du Grand Requin Gonflable (arme de mêlée) |
| L'Animateur Vedette Immortel | Studio de Télé-Achat Abandonné | `zombie` | confusion | Micro Électrifié de l'Animateur Vedette (arme de mêlée) |

L'archétype d'origine sert d'inspiration, pas de contrainte : le Grand Requin Gonflable peut être un vrai
requin gonflable dressé sur sa queue, le Gardien du Parking une barrière de péage vivante montée sur une
voiturette… Tant qu'il tient dans le cadre, tout est permis. Les boss « tir » attaquent à distance :
qu'ils aient l'air de tirer.

## 2. Direction artistique (obligatoire, comme le bestiaire validé)

- **Profil tourné vers la DROITE** (vers le crawler). x = 0 au centre, y = 0 aux pieds, y négatif vers le
  haut.
- **Tout tient dans x ∈ [-24, +24]**, objet signature compris. C'est la seule borne qui garantit
  l'absence de chevauchement avec le crawler au contact. L'aura d'effet est ajoutée par le jeu, tu n'as
  pas à la dessiner.
- **Hauteur** : `top` entre -64 et -90, couronne exclue. Le jeu pose la couronne (13 unités) au-dessus,
  à `top - 2`. Un boss bas et large (requin, véhicule) peut descendre à -50. Les boss sont plus
  imposants que les mobs, sans jamais dépasser le crawler de plus que la couronne.
- **Trait** : contour `#05060c`, épaisseur 2,5 pour le corps et 1 à 1,5 pour les détails,
  `stroke-linejoin="round"`. Aplats, une ombre, au plus un reflet clair. Yeux vifs. Ombre au sol
  `<ellipse class="scene-ground-shadow" …/>` à y = 0. Un boss `shade` flotte au-dessus de son ombre.
- **Couleurs** : palette naturelle propre à chaque boss (`base`/`dark`/`accent`), utilisée via les classes
  `mf-base`/`mf-dark`/`mf-accent` pour les grandes surfaces ; couleurs explicites autorisées pour les
  détails. Plus clair et plus saturé que les décors sombres. Pas de grand aplat rouge vif : le rouge est
  réservé aux yeux, au sang et aux dégâts.
- **`mf-line` = trait de 4 unités**, réservé aux membres et aux queues. Pour une bouche, une couture ou
  une ride : `stroke` et `stroke-width` explicites.
- **Lisible à taille réelle** : sur iPhone, 1 unité ≈ 1 px. Le boss doit se lire en un coup d'œil ; un
  détail mesure au moins 6 unités. Pas de texte, sauf sur un badge ou une étiquette de 5 unités minimum.
- **Humour DCC, en version star de l'émission** : chaque boss est une caricature grandiloquente de son
  quartier (le Chef de Gare zombie à la casquette galonnée qui siffle la fin de ta vie, l'Animateur Vedette
  au sourire figé et au costume à paillettes, le Directeur Général derrière sa pile de dossiers).
- **Interdit** : `<defs>`, `id=`, gradients, filtres, `<image>`, polices externes, `Math.random()`. Au
  plus 70 éléments SVG par boss, objet signature non compris.

## 3. L'objet signature tenu ou porté

Tu ne redessines PAS l'objet : le jeu ajoute le dessin existant `ITEM_SPRITES['<nom>'].art` là où tu le
places. Tu fournis seulement sa position, dans un champ `held` :

```js
held: { item: '<nom exact de l objet>', transform: 'translate(x y) rotate(a) scale(s)', layer: 'front' | 'back' }
```

- `transform` est appliqué au dessin de l'objet, dans le repère du boss.
- **Arme de mêlée** (prise à l'origine, tête vers le haut) : place la prise dans la main du boss, par
  exemple `translate(16 -44) rotate(20)`.
- **Arme à distance** (bouche vers la GAUCHE dans son dessin) : le boss regarde à droite, donc retourne
  l'objet avec `scale(-1 1)` dans le `transform`. Exemple : `translate(14 -46) scale(-1 1)`.
- **Armure** (dessinée dans le repère du crawler, environ y = -66 à -38) : fais-la porter ou tenir. La
  reliure peut servir de plastron ou flotter devant lui, la cape pendre dans le dos (`layer: 'back'`), la
  chaussette royale servir de couronne ou de cape. Ajuste `translate`/`scale` pour qu'elle tombe juste.
- `layer: 'back'` = dessiné derrière le corps (cape, objet dans le dos) ; `'front'` (défaut) = devant.
- `scale` entre 0,7 et 1,3 : garde l'objet reconnaissable par rapport à celui que le joueur récupère.
- L'objet tenu doit rester dans x ∈ [-24, +24] une fois placé : compte-le dans `bounds`.

## 4. Étape 1 — Prévisualisation (à livrer seule, puis STOP)

Livre un fichier autonome **`preview/boss-preview.html`** à ouvrir sur iPhone. Il ne charge rien du dépôt :
il contient une copie de tes dessins, des 13 objets signature (depuis `sprites/items-signature.js`), du
crawler (`SCENE_CRAWLER_SVG`), de la couronne et des auras (`sprites/mob-auras.js`). Fond de page
`#0b0d14`, aucun débordement horizontal à 375 px, aucune erreur console.

1. **En haut** : bouton « Taille réelle / Zoom ×2 », case « Cadre ±24 » (cadre rouge pointillé de -24 à
   +24 et ligne à `top`), case « Aura », case « Réduire les animations ».
2. **Les 13 boss**, chacun dans une scène au ratio 360 × 150 : mur sombre aux couleurs de son quartier,
   sol plus sombre à partir de y = 124, boss à x = 262 avec sa couronne et l'aura de son effet, crawler à
   x = 306. Sous la scène : nom exact, objet signature, effet. Deux colonnes sur 375 px.
3. **Les mêmes boss à distance** (x = 60), pour vérifier qu'ils se lisent de loin.
4. **Planche de contrôle** : les 13 boss alignés à taille réelle sur une même ligne de sol, avec le
   crawler et un mob normal de chaque archétype d'origine à côté (recopié du bestiaire), pour comparer
   échelle, trait et « présence ».

Ajoute ensuite une ligne par boss (« Le Chef de Gare Nécrosé — casquette galonnée, redingote verdâtre,
lanterne, sifflet à la bouche ») et au plus 3 questions si un choix est ambigu. **Arrête-toi** et attends
mes retours.

## 5. Étape 2 — Fichiers de sprites (après validation seulement)

Deux fichiers JS complets, qui passent `node --check`, sans DOM ni `gameState` (catalogues purs, comme les
autres `sprites/*.js`), chacun terminé par le bloc
`if (typeof module !== 'undefined' && module.exports) { module.exports = { SCENE_BOSS_SPRITES }; }`.

1. **`sprites/bosses-a.js`** : déclare `const SCENE_BOSS_SPRITES = { … }` pour les 7 premiers boss du
   tableau (du Chef de Gare au Maître des Illusions).
2. **`sprites/bosses-b.js`** : `Object.assign(SCENE_BOSS_SPRITES, { … })` pour les 6 suivants (du Roi des
   Chaussettes à l'Animateur Vedette).

Format d'une entrée : clé = nom EXACT du boss, valeur
`{ top, bounds: [xMin, xMax], palette: { base, dark, accent }, markup, held: { item, transform, layer } }`.
`markup` = le boss complet SANS son objet, sa couronne ni son aura (le jeu les ajoute). `bounds` = vrais x
minimum et maximum du boss complet, objet tenu compris. `top` = son point le plus haut, couronne exclue.

**Avant de livrer, vérifie toi-même** :
- les 13 noms de boss et les 13 noms d'objets sont exactement ceux du tableau, sans doublon ni oubli
  (termine par le compte : « 13/13 ») ;
- chaque `bounds` est bien dans [-24, 24] et correspond au dessin réel, objet compris ;
- aucun markup ne contient `undefined`, `NaN`, `id=`, `<defs` ou `<image` ;
- les apostrophes sont échappées dans les chaînes JS (« L'IA Malveillante », « L'Animateur Vedette
  Immortel »), les accolades et virgules sont correctes.

Termine par un tableau court « boss → top, bounds, nombre d'éléments SVG, transform de l'objet ». Si la
réponse est trop longue pour un seul message, livre bosses-a.js puis bosses-b.js, en disant lequel suit.
