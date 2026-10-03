# Prompt Vibe — ÉVALUATION : écrans plein écran de rencontre (chantier 16)

> But : vérifier que Vibe sait produire, de façon **cohérente avec le jeu existant**, les illustrations
> plein écran des entrées en combat, avant de lui confier les ~100 images du chantier complet.
> Copie tout ce qui suit la ligne ci-dessous dans Vibe.

---

Tu es illustrateur et directeur artistique. Tu travailles sur **Crawler**, un rogue-like mobile inspiré de
*Dungeon Crawler Carl* (humour sarcastique de téléréalité). HTML + JS vanilla, sans build, affiché sur
**iPhone (375 px de large, portrait)**.

Ceci est une **évaluation**. Je veux savoir (1) si tu sais lire ce que je te donne, (2) si tu sais
produire les images au format demandé, (3) si ton rendu reste cohérent avec le style déjà dessiné dans
le jeu. Sois honnête sur tes limites : un « je ne peux pas » argumenté vaut mieux qu'une image hors
consigne.

## 0. Le dépôt et les ressources

Dépôt public : **https://github.com/maximegardere-beep/Crawler**
Lecture brute d'un fichier : `https://raw.githubusercontent.com/maximegardere-beep/Crawler/<branche>/<chemin>`

- Les **ressources graphiques** sont sur la branche **`main`** (la branche `graphique` est périmée : ne
  l'utilise pas).
- Le **plan du chantier** est sur la branche **`claude/chantier-16-rencontres`** (section 16 de
  `CHANTIERS.md`).

À lire AVANT de dessiner :

| Fichier (branche) | Pourquoi |
|---|---|
| `CHANTIERS.md` (`claude/chantier-16-rencontres`), section « 16. Entrées en combat » | ce que l'image devient dans le jeu (overlay, cas face / dos, boss, chasseur) |
| `sprites/mobs.js` (`main`) | les 10 silhouettes d'archétype et leurs palettes naturelles : le style de base (trait, aplats, contour) |
| `sprites/mob-details-a.js`, `sprites/mob-details-b.js` | **le détail signature + la palette de chacun des 39 mobs** : ce qui fait reconnaître un mob |
| `sprites/bosses-a.js`, `sprites/bosses-b.js` | **le sprite unique de chaque boss**, avec son objet signature tenu (`held`) |
| `sprites/items-signature.js` | le dessin des 13 objets signature (le boss de l'image doit tenir/porter le même) |
| `sprites/mob-auras.js` + `MOB_EFFECT_FX_COLORS` dans `sprites/fx.js` | couleur et motif de l'aura de chaque effet (feu, poison, électricité…) |
| `sprites/crawler.js` | le joueur (le « crawler »), vu de dos/trois-quarts dos si besoin |
| `bestiary.js` | stats, archétype, effet, `ranged` de chaque mob et boss ; chasseurs de primes (`bountyHunters`) |
| `districts.js` | quels mobs vivent dans quel quartier |
| `backdrops.js` | **l'ambiance de chaque quartier** : palette (`palette`), motifs de mur/sol, accessoires (`props`) — c'est le décor d'arrière-plan de l'image |
| `prompts/gemini-boss.md`, `prompts/gemini-phase4-5-mobs.md` (`main`) | la direction artistique déjà validée (sections « direction artistique ») : elle s'applique aussi ici |
| `assets/logo.jpg` | le ton graphique général de l'app |

Pour lire un sprite SVG, **rends-le** (ouvre le SVG, ou reconstruis-le dans une page) pour le voir ; ne te
contente pas de lire le code. Le dessin final est une **version plein écran, plus riche**, du même
personnage : on doit le reconnaître au premier regard (mêmes couleurs, même accessoire signature, même
silhouette).

**Si tu ne peux pas lire une URL, dis-le et demande-moi de coller le fichier. N'invente jamais le
contenu d'un fichier.**

## 1. Le format des images

- **Portrait 750 × 1334 px** (ratio 9:16), **WebP**, qualité ≈ 80, **≤ 150 Ko** par image. Si tu ne peux
  pas produire du WebP, livre du PNG et dis-le : je convertirai.
- Affichée **plein écran** sur un téléphone, recadrée en `cover`, ancrée en haut : **le sujet reste dans
  les 70 % du haut**, bien centré. Les **22 % du bas** sont couverts par un bandeau de texte du jeu :
  y mettre seulement du sol / de l'ombre, **aucun élément important**.
- **Aucun texte** dans l'image (ni titre, ni logo, ni filigrane, ni lettres sur les panneaux : les
  enseignes sont des formes illisibles).
- Style : illustration 2D **à aplats**, **contour sombre `#05060c`**, peu de dégradés, éclairage simple
  et dramatique (une ou deux sources, comme les halos de `backdrops.js`). Plus détaillé qu'un sprite,
  mais **même univers, mêmes teintes**. Ni photoréalisme, ni 3D, ni rendu « IA lisse ». Ton : sombre et
  drôle, jamais gore. Le mob garde ses traits comiques.
- **Décor = le quartier du mob** (palette et accessoires de sa fiche `SCENE_BACKDROPS`), pas un fond
  neutre. Le quartier dessine l'ambiance, jamais plus saturé ni plus lumineux que le mob.
- Contrainte de cohérence : même mob = mêmes couleurs, mêmes proportions, même accessoire dans toutes ses
  images.

## 2. Les deux cadrages

- **`face` — « il t'a vu » (rage)** : plan américain, **caméra à hauteur de crawler**, le mob **occupe
  60-70 % de la hauteur**, vient droit vers nous, **regard (ou équivalent : œil, caméra, écran…) braqué
  sur le spectateur**, expression enragée / menaçante, posture d'attaque, légère contre-plongée. Un
  mob sans visage (machine, blob, vêtement…) doit pourtant « regarder » : un œil, un voyant, un objectif.
- **`back` — « tu l'as vu » (embuscade)** : le mob est **de dos ou de trois-quarts dos, au loin** (il ne
  fait que 25-40 % de la hauteur, dans la moitié haute), **occupé à une activité propre à lui** (qui
  explique pourquoi il ne nous voit pas), dans le même décor. On le voit **depuis une cachette**
  (premier plan : caisse, pilier, angle de mur sombre, discret). On doit comprendre : « il ne m'a pas
  repéré, je peux frapper ou filer ». Un détail comique est bienvenu.
- **Boss — `face` uniquement** : même cadrage que `face`, mais **plus imposant** (70-80 % de la
  hauteur), lumière plus dramatique, son **objet signature** bien visible, la **couronne** (voir
  `SCENE_BOSS_CROWN_SVG` dans `sprites/mobs.js`) au-dessus de la tête.

## 3. Nommage (pour l'intégration)

`assets/mobs/<slug>-<cadrage>.webp`, où `<slug>` = nom exact du mob/boss, en minuscules, **sans accents**,
tout caractère non alphanumérique remplacé par `-`, tirets en double et aux extrémités supprimés.
Exemple : « Le Chef de Gare Nécrosé » → `le-chef-de-gare-necrose-face.webp`.

## 4. Le lot de test (5 images)

| # | Nom exact | Cadrage | Quartier (décor) | À vérifier |
|---|---|---|---|---|
| 1 | **Le Chef de Gare Nécrosé** (boss, zombie, effet `stun`) | `face` | Tunnels de Métro Abandonnés | grandeur, fidélité à son sprite et à son objet signature (Sifflet) |
| 2 | **Contrôleur de Billets Zombifié** (zombie) | `face` | Tunnels de Métro Abandonnés | rage, fidélité au sprite (`mob-details-a/b.js`) |
| 3 | **Contrôleur de Billets Zombifié** | `back` | Tunnels de Métro Abandonnés | **même personnage que l'image 2** (cohérence), activité plausible |
| 4 | **Photocopieuse Carnivore** (machine, `ranged`) | `face` | Bureaux de l'Administration Pénitentiaire | mob **non humanoïde** : comment tu lui donnes un regard et une rage |
| 5 | **Gobelin Pisteur de Primes** (chasseur de primes, `ranged`, goblinoïde) | `face` | Tunnels de Métro Abandonnés (décor au choix du quartier courant) | un mob « affiche RECHERCHÉ » : il nous traque, arc/arme à distance en main |

Pour l'image 3, si tu peux la générer **à partir de l'image 2** (même personnage), fais-le et dis-moi
comment.

## 5. Ce que tu livres

1. **Un rapport de capacités** (avant de dessiner) : pour chaque ligne, « oui / non / partiellement » +
   une phrase :
   - lire les URLs du dépôt (raw.githubusercontent.com) ;
   - rendre un SVG pour le regarder ;
   - produire du WebP 750×1334 ≤ 150 Ko (sinon quel format) ;
   - garder **un même personnage cohérent** entre deux images (face / dos) ;
   - respecter « aucun texte dans l'image » ;
   - livrer plusieurs fichiers à la fois (zip ?) ;
   - **combien d'images** tu peux produire de façon fiable en une session, et si tu dérives (style,
     proportions, couleurs) au fil des images.
2. **Les 5 images** du lot de test, fichiers téléchargeables nommés selon la section 3.
3. **Une page `preview.html` autonome** (aucune dépendance au dépôt, ouvrable sur iPhone) : les 5 images
   chacune en plein écran portrait avec par-dessus, comme dans le jeu, un **bandeau semi-transparent en
   bas** (22 % de la hauteur) portant le texte d'exemple « [Nom] vous a repéré ! » et « Toucher pour
   continuer » (pour vérifier que rien d'important n'est masqué). Aucun débordement horizontal à
   375 px.
4. **Une auto-évaluation** par image : ce qui est fidèle à l'existant (couleurs, accessoire signature,
   silhouette), ce qui s'en écarte, et ce que tu ferais pour mieux coller. Puis ton **estimation** du
   temps / nombre de sessions pour livrer les 13 boss, puis les ~39 mobs en 2 cadrages.
5. **Un fichier de consignes réutilisable** `prompts/vibe-rencontres.md` (en français) : le brief que **toi**
   tu aimerais recevoir pour produire en série (par vagues : boss, mobs les plus puissants, le reste) en
   restant cohérent. Il doit contenir un **gabarit de prompt d'image par cadrage**, la liste ordonnée des
   13 boss, et ce que tu estimes nécessaire (images de référence à joindre, ordre de génération, etc.).

## 6. Règles

- **Rien n'est modifié dans le dépôt** : tu livres des fichiers, je les intégrerai.
- Deux étapes avec un arrêt : d'abord le **rapport de capacités** (point 1) ; **attends mon feu vert**
  avant de générer les images.
- Pas de `// ... reste inchangé` ni de fichiers partiels : tout fichier de code ou de texte est complet.
- Commentaires et textes en **français**.
