# Registre des chantiers

Trace des planifications : chaque idée y entre, est classée, puis avance étape par étape.
Les notes détaillées d'un chantier en cours ou terminé vivent dans leur propre `NOTES_*.md`
(ex. `NOTES_ITEMS.md`) ; ce registre ne garde que le statut, l'ampleur, les dépendances et les
décisions prises.

## Méthode (pour chaque chantier)

**Exploré → Suggéré → Planifié → Codé**

1. **Exploré** : lecture du code existant, diagnostic chiffré de ce qui ne va pas.
2. **Suggéré** : propositions soumises à l'utilisateur. Tout chiffre d'équilibrage est une LISTE à
   valider (convention 5 de `CLAUDE.md`), jamais appliqué d'office.
3. **Planifié** : plan d'implémentation découpé en lots testables (après validation).
4. **Codé** : implémentation + tests (`npm test`, `npm run test:long` si la boucle de jeu est touchée),
   notes dans `NOTES_<CHANTIER>.md`, résumé d'architecture dans `CLAUDE.md`.

Ampleur : **S** (quelques heures, un seul système) · **M** (un système + UI + tests) · **L** (plusieurs
systèmes, nouvel écran) · **XL** (refonte, à découper en lots livrables séparément).

## Vue d'ensemble — ordre recommandé

| # | Chantier | Ampleur | Statut | Dépend de |
|---|----------|---------|--------|-----------|
| 1 | Rework des compagnons | M | **Suggéré** | — |
| 2 | Chronique de run + Succès sarcastiques | M | Idée | — |
| 3 | Chasseurs de primes gobelins (anti-snowball) | M | Idée | 2 (compteurs de run) |
| 4 | Émission de changement d'étage (DeathWatch) | L | Idée | 2 (piques), 1 et 3 (conséquences) |
| 5 | Rework de la carte (3 lots) | XL | Idée | — |
| 6 | Mini-jeux d'exploration | ? | En attente (résumé de Vibe) | — |
| 7 | Salles spéciales à choix narratif (compétences, sans fuite) | M | Idée (ancien backlog) | à rapprocher de 6 |
| 8 | Sons | M | Idée (ancien backlog) | hébergement des fichiers non tranché |

**Pourquoi cet ordre** :
- **1 d'abord** : c'est le seul système DÉJÀ en jeu qui est cassé (voir diagnostic plus bas). Ajouter du
  contenu par-dessus un système mort ne sert à rien, et les chantiers 3 et 4 veulent justement
  réutiliser des « crawlers » (alliés comme hostiles) : autant qu'ils soient solides avant.
- **2 avant 3 et 4** : les trois idées ont besoin du même socle — savoir ce qui s'est passé pendant le
  run (mobs tués, facilité des victoires, fuites, morts évitées de justesse, objets ridicules
  portés…). On le construit une fois (« chronique de run »), les succès en sont le premier
  consommateur, les chasseurs de primes et le commentateur les suivants.
- **3 avant 4** : les chasseurs de primes sont une conséquence toute trouvée pour les réponses
  provocatrices de l'émission (« envoyé contre des mobs ou crawlers plus ou moins difficiles »).
- **5 isolé** : gros, sans dépendance, découpable ; peut s'intercaler quand on veut une pause de gameplay.
- **6/7** : à réévaluer une fois le résumé de Vibe reçu — les mini-jeux et les salles narratives
  touchent le même endroit (l'exploration) et pourraient fusionner en un seul chantier.

---

## 1. Rework des compagnons — M — Suggéré

**Demande** : mal intégrés, quasiment inutiles, fuient trop vite.

### Exploré (état actuel, `app.js` + `generator.js`)
- **Stats figées** : un candidat naît avec 40-59 PV, 8-13 ATQ, 4-7 DEF (`generateCompanionCandidate()`),
  **quel que soit l'étage**, et ne gagne **rien** en montant de niveau : le seul effet d'un niveau est
  +15 à +25 % de `leaveChance`. Progresser le rend donc strictement plus mauvais.
- **Départ trop rapide** (calcul) : +15 XP par victoire, 30 XP pour le niveau 2 puis ×1,3. Jet de départ
  à chaque niveau contre `leaveChance` cumulée (~20 %, ~40 %, ~60 %, ~80 %). Résultat : ≈ 80 % des
  compagnons sont partis au bout de **~9 victoires** (moins d'un étage).
- **PV jamais rendus** : `companion.hp` ne remonte jamais (ni régénération, ni salle sécurisée). Un
  compagnon Garde s'use jusqu'à s'effondrer, et l'effondrement est définitif.
- **Effets qui ne suivent pas la courbe** : Frappe d'appoint = 40 % de SON ATQ figée (3-5 dégâts) ;
  Premiers secours = 25 % de chance de 8-15 PV fixes ; Garde = ½ de SA DEF figée + interception
  40 % ; Éclaireur = +10 furtivité, +15 fuite. Dès l'étage 3-4, l'apport devient négligeable.
- **Peu lisible au recrutement** : la zone de choix ne montre ni la spécialité, ni les stats, ni ce
  qu'elle apporte ; la spécialité n'est annoncée qu'APRÈS le recrutement.
- **Rare** : 3 % des tirages d'exploration, puis 70 % (ami) / 30 % (hostile) de réussite.
- **Crawler hostile figé** lui aussi (`companionCandidateToMob()`, 20 XP) : trivial en fin de run.
- **Aucune interaction** : pas de moyen d'entretenir sa loyauté, de le soigner ou de le congédier.
- Déjà en place et réutilisable : silhouette dans la scène de combat (`#scene-companion`), anneau de PV
  en combat, barre de risque hors combat.

### Suggéré (à valider — chiffres = propositions de départ)
**A. Il progresse vraiment**
1. Stats à l'embauche indexées sur l'étage (même taux que les mobs, `getFloorScaling()`).
2. Chaque niveau du compagnon donne des stats (proposition : +10 % PV/ATQ/DEF) au lieu de ne donner
   que du risque.

**B. Loyauté plutôt que départ programmé**
3. Remplacer `leaveChance` (qui ne fait que monter) par une **loyauté** 0-100 (départ 60) qui bouge
   selon ce que vit le groupe : + victoire commune (+2), + repos en salle sécurisée ensemble (+10),
   + partage de PO / cadeau d'objet (nouvelle action, +5 à +15 selon la valeur) ; − fuite du joueur
   (−5), − compagnon tombé à terre (−10), − mauvais partage (revente d'un objet signature ? à discuter).
4. Jet de départ **uniquement au changement d'étage** (moment narratif, prévisible), seulement si
   loyauté < 40, avec une chance égale à `40 − loyauté` × 2 %. Avertissement dans le journal dès
   loyauté < 40. Départ toujours pacifique (raisons sarcastiques conservées).

**C. Il survit et se remet**
5. PV du compagnon rendus comme ceux du joueur : régénération passive (`applyTimeElapsedRegen()`) et
   repos en salle sécurisée (Sieste/Sommeil soignent aussi le compagnon).
6. À 0 PV : **à terre** (inactif, −10 loyauté) jusqu'au prochain repos, au lieu d'être perdu
   définitivement.

**D. Des effets qui comptent, en combat ET en exploration**
7. Effets calculés sur des parts du JOUEUR ou de ses PV max, pour suivre la courbe :
   - Frappe d'appoint : coup supplémentaire à 35 % de l'ATQ du compagnon, qui lui-même scale (A).
   - Garde : interception 40 % → absorbe 30-60 % du coup (inchangé) + bonus DEF = ½ DEF compagnon (scalée).
   - Premiers secours : 25 % de chance de soigner 6 % des PV max du joueur, + petit soin après chaque
     victoire (4 % des PV max).
   - Éclaireur : +10 furtivité, +15 fuite (inchangés) + **50 % de chance d'éviter un piège** en exploration.
8. Utilité hors combat pour chacun (idée, à trier) : Éclaireur = pièges ; Premiers secours = soin post-combat ;
   Frappe d'appoint = +10 % de PO trouvées (« il fouille les cadavres ») ; Garde = −1H sur les embuscades
   de trajet ? (à discuter).

**E. Lisibilité**
9. La zone de rencontre affiche nom, spécialité + effet, PV/ATQ/DEF avant de décider.
10. Barre hors combat : loyauté (au lieu du risque) + PV du compagnon + bouton « Congédier ».
11. Crawler hostile à l'échelle de l'étage (mêmes stats que A.1, XP comme un mob du même étage).

**F. Hors périmètre (pour plus tard)** : rencontres plus fréquentes, plusieurs compagnons, actions
commandées par le joueur, compagnon qui trahit. À rediscuter avec les chantiers 3/4.

### Décisions
- (en attente de validation)

---

## 2. Chronique de run + Succès sarcastiques — M — Idée

**Demande** : système de succès sarcastiques.
**Idée de structure** :
- **Chronique de run** (socle) : compteurs et faits marquants du run dans `gameState` (sauvegardés),
  alimentés par les hooks uniques déjà existants (`winCombat()`, `applyPlayerDamage()`, `gainXp()`,
  `addLoot()`, `attemptFlee()`, `gameOver()`…) — comme `floorStats`, mais sur tout le run. Inclut un
  indicateur de « facilité » des victoires (PV perdus / ATQ du mob, niveau du joueur vs étage), dont le
  chantier 3 a besoin.
- **Succès** : catalogue pur (fichier dédié type `achievements.js`), conditions lues sur la chronique,
  titre + texte sarcastique à la DCC, annonce discrète au déblocage. Persistance **entre les parties**
  (clé `localStorage` à part, hors sauvegarde du crawler) + écran de consultation.
- Questions ouvertes : récompenses (purement cosmétiques, ou petits bonus « sponsors » à la DCC ?),
  nombre de succès pour une première version (~20-30 ?).

## 3. Chasseurs de primes gobelins — M — Idée

**Demande** : des gobelins chasseurs de primes traquent les crawlers qui tuent beaucoup de mobs
facilement (anti-snowball).
**Idée de structure** : jauge de « prime » alimentée par l'indicateur de facilité de la chronique (2) ;
au-delà de seuils, rencontres de chasseurs (mob élite dédié, qui scale sur le NIVEAU du joueur plutôt
que sur l'étage), traque visible (annonce, jauge), prime qui redescend avec des combats difficiles ou
en payant. Récompense spécifique pour qui les bat (la prime elle-même ?). Nouveaux sprites à prévoir.
À définir : fréquence maximale, si la traque peut suivre sur un étage urbain, interaction avec la furtivité.

## 4. Émission de changement d'étage (DeathWatch) — L — Idée

**Demande** : émission au changement d'étage, dialogues plus ou moins risqués, choix avec lancer de dés ;
risqué = danger mais grosse récompense si réussite. Exemple : le commentateur reprend des éléments de la
partie et envoie des piques ; plusieurs réponses prédéfinies plus ou moins provocatrices ; cadeaux, ou
envoyé contre des mobs/crawlers plus ou moins difficiles.
**Idée de structure** : s'accroche à l'écran d'escalier existant (`triggerFloorTransition()`), avant
l'annonce d'anomalie. Piques générées depuis la chronique (2) (templates à trous, comme les épitaphes
de la nécrologie). 3-4 réponses de la plus polie à la plus provocatrice, chacune avec une difficulté de
jet (réutiliser les dés du combat) et une table récompense/sanction. Sanctions : combat de mob/élite,
crawler hostile (1), chasseurs de primes (3), anomalie supplémentaire ; récompenses : objet, PO,
cadeau du public, bonus pour l'étage. Plusieurs émissions/présentateurs possibles (rotation).
À définir : fréquence (chaque étage ou aléatoire), scène dédiée (plateau TV), nombre d'émissions en V1.

## 5. Rework de la carte — XL — Idée (à découper)

**Demande** : zoom, réseau plus complexe et logique, et surtout bouton carte pour les étages non urbains.
**Découpage proposé** (livrables séparés, dans cet ordre) :
- **5a. Carte des étages classiques** (le plus attendu) : le bouton `#btn-toggle-map` existe déjà, masqué
  hors étage urbain ; `renderGraphMiniMap()` est générique et `computeGraphLayout()` avait été gardée
  exprès pour ça. Il faut un layout des pièces/quartiers, le brouillard de guerre (pièces visitées et
  lieux connus), et le déplacement vers les lieux connus depuis la carte.
- **5b. Zoom** (pincer / molette + boutons) sur le moteur commun.
- **5c. Réseau urbain plus complexe et logique** (génération des villes/routes).

## 6. Mini-jeux d'exploration — ? — En attente

**Demande** : mini-jeux pour pimenter le gameplay. Vibe a travaillé sur l'exploration : attendre son
résumé avant d'explorer. Voir aussi 7 (même zone du jeu, fusion possible).

## 7. Salles spéciales à choix narratif — M — Idée (ancien backlog de `CLAUDE.md`)

Salles à choix narratif basé sur les compétences, sans fuite possible.

## 8. Sons — M — Idée (ancien backlog de `CLAUDE.md`)

Hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).
