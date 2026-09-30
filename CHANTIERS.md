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
| 1 | Rework des compagnons | M | **Codé** — à playtester | — |
| 2 | Chronique de run + Succès sarcastiques | M | **Codé** — à playtester | — |
| 3 | Chasseurs de primes gobelins (anti-snowball) | M | **Codé** — à playtester | 2 (fait) |
| 4 | Émission de changement d'étage (DeathWatch) | L | **Codé** — à playtester | 2, 1, 3 (faits) |
| 5 | Rework de la carte + génération des étages | XL | **Suggestions tour 5** (M2 remplacé, à valider) | — |
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

## 1. Rework des compagnons — M — Codé (à playtester)

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
- **Validé par l'utilisateur** (blocs A à E), avec une exigence : bien intégrer la possibilité de
  **donner des objets ET des sorts** au compagnon.
- Arbitrages pris pour les points laissés ouverts (à ajuster par playtest) :
  - Garde hors combat : −25 % de risque d'embuscade sur les trajets. Frappe d'appoint hors combat :
    +10 % de PO trouvées.
  - Aucune perte de loyauté liée à la revente d'objets (trop punitif sans que le joueur le voie venir).
  - Les compagnons non-Garde peuvent aussi prendre un coup (10 %, « pris dans la mêlée ») : sans ça,
    l'armure donnée et le soin d'un compagnon n'auraient aucun intérêt hors Garde.

### Planifié (lots)
1. **Modèle + progression + loyauté** : `config.companions` (tous les chiffres), candidat indexé sur
   l'étage, +10 %/niveau, loyauté 0-100 (départ 60) remplaçant `leaveChance`, jet de départ au
   changement d'étage, migration des anciennes sauvegardes, crawler hostile à l'échelle.
2. **Survie + effets** : PV régénérés comme le joueur, rendus au repos (Sieste/Sommeil), « à terre » à
   0 PV jusqu'au prochain repos ou soin ; une seule fonction d'interception (boss + mobs) ; appui de
   combat (Frappe d'appoint à chaque attaque, coup d'opportunité 25 % pour les autres) ; utilités hors
   combat (pièges, PO, embuscades, soin post-victoire).
3. **Dons** (demande explicite) : depuis le panneau d'inspection d'un objet de la réserve ou d'un
   exemplaire du grimoire, « Donner à <nom> ».
   - Arme (mêlée ou distance) → son arme : +ATQ (dégâts de l'arme). Armure → +DEF (moins de dégâts
     encaissés, meilleure garde). Parchemin → son sort : 30 % de chance à chaque attaque du joueur de le
     lancer (60 % de son ATQ + dégâts du sort, sans mana ni échec).
   - Potion → soigne le compagnon (et le relève s'il est à terre).
   - L'objet qu'il portait à cet emplacement vous revient (réserve ou grimoire).
   - Loyauté selon la rareté (Camelote +2, Commun +5, Rare +8, Épique +12, Légendaire +18 ; potion
     +3), **une seule fois par objet** (redonner un objet qu'il vous a rendu ne rapporte rien).
   - S'il part de lui-même, il garde ce qu'on lui a donné ; si vous le congédiez, il vous le rend.
4. **UI + tests + doc** : aperçu au recrutement (spécialité, effet, stats), barre loyauté + PV,
   fiche compagnon (équipement, potion, Congédier), tests de régression, `NOTES_COMPAGNONS.md`.

### Codé
Les 4 lots sont livrés (détail et points à surveiller : `NOTES_COMPAGNONS.md`). Restent hors périmètre
(bloc F) : fréquence des rencontres, plusieurs compagnons, ordres donnés au compagnon, trahison ;
qualificatifs des objets donnés non appliqués au compagnon (V1).

---

## 2. Chronique de run + Succès sarcastiques — M — Codé (à playtester)

**Demande** : système de succès sarcastiques.

### Exploré (état actuel)
- **Compteurs existants, tous partiels** : `floorStats` (mobs tués, dégâts subis, objets, XP — remis à
  zéro à chaque étage), `fleesThisRun` (fuites du run, seul compteur « run »), `signaturesAwarded`,
  `necrologie` (épitaphes, dans la sauvegarde du crawler). Rien sur les boss/élites tués, les coups
  critiques, les morts évitées de justesse, l'or gagné/dépensé, les pièges, les sorts ratés…
- **Hooks uniques déjà en place** (le travail de fond est fait) : `winCombat()`, `applyPlayerDamage()`,
  `applyPlayerHeal()`, `gainXp()`, `storeLootItem()`, `attemptFlee()`, `gameOver(cause)`, `winGame()`,
  `advanceToNextFloor()`, `restAtSafehouse()`, `buyShopItem()`/`sellItem()`, `attackMagic()` (flop),
  les fonctions compagnon. Brancher un compteur = une ligne par hook.
- **Persistance** : une entrée `localStorage` par crawler (`SAVE_KEY_PREFIX`), et `resetGame()` recharge
  la page. **Rien ne survit à la mort d'un crawler** hors de sa sauvegarde : des succès « entre les
  parties » demandent une clé à part (comme `SAVE_BACKUP_KEY`), jamais effacée par le nettoyage des
  sauvegardes.
- **Affichage** : bannière de phase boss (`#phase-transition-banner`) = modèle d'annonce non bloquante ;
  panneau d'inspection = modèle de fiche ; écran de départ = point d'entrée hors partie.

### Suggéré (à valider)
**A. Chronique de run (socle, sert aussi aux chantiers 3 et 4)** — `gameState.runStats`, sauvegardé
avec le crawler, jamais remis à zéro pendant le run : mobs/élites/boss tués (et par type d'attaque :
arme, tir, mains nues, sort, attaque furtive), dégâts infligés/subis, plus gros coup, victoires « à un
fil » (< 10 % PV), fuites, pièges, sorts ratés, PO gagnées/dépensées, objets vendus, Camelote portée,
compagnons recrutés/à terre/dons, siestes/sommeils, étages atteints. Plus un **indice de domination**
(fonction pure) : moyenne glissante des dernières victoires, PV perdus rapportés aux PV max et écart
niveau/étage — c'est lui que les chasseurs de primes liront.

**B. Succès** — catalogue pur `achievements.js` (`{ id, icon, title, text, secret?, check(stats, event) }`),
évalué par `recordRunEvent(event)` aux hooks ci-dessus. Première fournée d'une trentaine, en 4 familles :
- *Combat* : « Premier sang (le vôtre) », « Le Rat de trop » (mort face à un mob très inférieur),
  « Pacifiste contrarié » (10 victoires à mains nues), « Kiteur professionnel » (gagner sans jamais
  être touché), « À un poil de cul » (gagner à 1 PV), « Couronné » (1er boss), « Régicide en série » (10 boss).
- *Fuite & survie* : « Stratégie de repli » (10 fuites), « Le temps, c'est de la mort » (mort par
  épuisement du temps), « Jambes de coton » (3 pièges sur un même étage).
- *Économie & objets* : « Soldes monstres » (tout acheter chez un marchand), « Style Camelote » (finir un
  étage tout équipé de Camelote), « Collectionneur » (5 objets signature), « Radin » (1 000 PO sans rien
  dépenser).
- *Social* : « Meilleurs amis » (loyauté 100), « Ghosté » (compagnon parti), « Cadeau empoisonné »
  (donner un objet Camelote à un compagnon), « Congédié par SMS ».
- *Magie & chaos* : « Abracadabroum » (5 sorts ratés), « Mort par sa propre main » (mort par backfire).
- *Progression* : étages 3/6/9/12/15, « Sortie » (victoire finale), « Premier cadavre ».
Des secrets (« ??? » tant qu'ils ne sont pas débloqués) pour garder de la surprise.

**C. Persistance entre les parties** : clé `localStorage` dédiée — succès débloqués (date, nom du
crawler, étage) + quelques compteurs à vie (parties, morts, boss) pour les succès « méta » (« Habitué
des pompes funèbres » : 10 morts). Jamais touchée par le nettoyage des sauvegardes.

**D. Affichage** : annonce non bloquante « 🏆 Succès débloqué » (quelques secondes, dans le style de la
bannière de phase, jamais pendant un beat de combat important), écran « Succès » (compteur X/N,
débloqués + verrouillés, secrets masqués) accessible depuis l'écran de départ ET en jeu, et la liste des
succès du run sur l'écran Game Over / Victoire.

**E. Récompense — à trancher** :
1. *Cosmétique pur* (V1 la plus simple, aucun impact d'équilibrage).
2. *Boîtes de butin façon DCC* : chaque succès donne une boîte (Bronze / Argent / Or selon sa
   difficulté) ouverte sur-le-champ — PO, potion ou objet (rareté selon la boîte, via `addLoot()`).
   Très fidèle au livre, mais c'est de l'équilibrage (convention 5) : chiffres à valider.

### Décisions (validées par l'utilisateur)
- **Récompense : boîtes de butin façon DCC** (Bronze / Argent / Or), chiffres validés ci-dessous.
- **Succès PAR CRAWLER** (dans sa sauvegarde, perdus avec elle) — pas de collection globale ni de
  compteurs « à vie ». Les succès de mort restent, débloqués sur l'écran Game Over (boîte livrée « à
  titre posthume », donc sans effet).
- **35 succès** pour la V1 (catalogue ci-dessous, validé tel quel).
- **Ajout demandé à la validation** : tout butin trouvé réserve pleine (exploration, combat, boss, objet
  signature, boîte de succès) est **revendu d'office à 50 % du prix de revente marchand**, au lieu d'être
  perdu.

### Chiffres des boîtes (validés)
| Boîte | Contenu |
|---|---|
| 🥉 Bronze | 60 % : 10-25 PO × (1 + 0,15 × étage) · 40 % : une potion |
| 🥈 Argent | 50 % : un objet « trésor » (+1 palier de rareté) · 30 % : le double de PO du Bronze · 20 % : 2 potions |
| 🥇 Or | un objet garanti Rare minimum (+1 palier, comme un boss) **et** le triple de PO du Bronze |

### Catalogue (35 — B = Bronze, A = Argent, O = Or, 🔒 = secret)
- **Combat** : 🩸 Premier sang (le vôtre) (B) · 🗡️ Première victime (B) · 💥 Coup de maître — tuer d'un
  seul coup (B) · 🪶 À un poil — gagner avec ≤ 5 % de PV (A) · 🧤 Intouchable — 10 victoires sans une
  égratignure (A) · 🥊 Pacifiste contrarié — 10 victoires à mains nues (A) · 🔪 Dans le dos — 10
  victoires ouvertes par une attaque furtive (A) · 🧙 Magicien du dimanche — 25 victoires achevées au sort
  (A) · 💀 Élitiste — 5 élites (A) · 👑 Couronné — 1er boss (A) · 👑 Régicide en série — 10 boss (O).
- **Fuite & survie** : 🏃 Stratégie de repli — 10 fuites (B) · 🦶 Jambes de coton — 3 pièges sur un même
  étage (B) · 🛌 Syndicaliste — 10 repos (B) · ⏳ Retardataire chronique — descendre avec moins de 5 H (A).
- **Économie & objets** : 🧦 Style Camelote — arme ET armure Camelote portées (B) · 🗃️ Accumulateur —
  réserve pleine (B) · 🛒 Client fidèle — 5 achats (A) · 💰 Radin — 1 000 PO en poche (A) · ✨
  Collectionneur — 3 objets signature (O).
- **Social** : 🤝 Meilleurs amis — loyauté 100 (A) · 🎁 Cadeau empoisonné (B 🔒) · 📱 Rupture par SMS
  (B 🔒) · 👻 Ghosté (B 🔒).
- **Magie** : 🎆 Abracadabroum — 5 sorts ratés (B) · 📚 Rat de bibliothèque — 5 sorts différents (A).
- **Progression** : 🪜 Touriste — étage 3 (B) · 🏙️ Citadin — étage 6 (A) · 🧗 Spéléologue confirmé —
  étage 9 (A) · 🕳️ Abonné aux abysses — étage 12 (O) · 🚪 Sortie de secours — victoire finale (O).
- **Posthumes** (🔒) : ⚰️ Premier cadavre · 🐀 Le Rat de trop · 🔥 Mort par sa propre main · ⌛ Le temps,
  c'est de la mort.

### Planifié (lots)
0. **Revente d'office** réserve pleine (50 % du prix de revente), dans `storeLootItem()` — seul point de
   passage de tout butin.
1. **Chronique** : `gameState.runStats` (sauvegardé, migré à zéro) + un seul point d'entrée
   `recordRunEvent(type, data)` appelé depuis les hooks existants ; indice de domination pur
   (`computeDominance()`) pour le chantier 3.
2. **Catalogue** `achievements.js` (nouveau fichier, `index.html` ET `GAME_FILES`) ; `gameState.achievements`.
3. **Boîtes** : `config.achievementBoxes`, ouverture immédiate au déblocage.
4. **Affichage** : annonce non bloquante, bouton 🏆 X/N → écran Succès, succès du run sur Game Over / Victoire.
5. **Tests** (`tests/regression/achievements.js`, simulation longue) + `NOTES_SUCCES.md`.

### Codé
Les 6 lots sont livrés (détail : `NOTES_SUCCES.md`). En plus de la demande : les objets rendus par un
compagnon congédié passent aussi par la revente d'office (ils étaient perdus réserve pleine).
L'indice de domination est calculé et testé, mais pas encore utilisé : c'est le point d'entrée du
chantier 3.

## 3. Chasseurs de primes gobelins — M — Codé (à playtester)

**Demande** : des gobelins chasseurs de primes traquent les crawlers qui tuent beaucoup de mobs
facilement (anti-snowball).

### Exploré (état actuel)
- **Socle prêt (chantier 2)** : chaque victoire enregistre sa facilité (`computeWinEase()` : 1 sans
  dégât, 0 à 40 % des PV max perdus) dans `runStats.recentWins`, et `computeDominance()` en fait la
  moyenne glissante sur 10 victoires. Rien ne l'utilise encore.
- **Aucun frein au snowball aujourd'hui** : les mobs ne scalent que sur l'ÉTAGE (`getFloorScaling()`,
  `getMobLevelEquivalent()` = étage). Un crawler en avance (bon objet signature, compagnon équipé, boîtes
  de succès) écrase tout l'étage sans contrepartie.
- **Points d'accroche** : `resolveCardEvent()` (tirage D100 de l'exploration) → `handleStealthEncounter()`
  (détection, esquive, attaque furtive) → `initiateCombat()` ; embuscades de trajet (lieux connus, villes)
  ; `winCombat()` / `attemptFlee()` (issue) ; villes urbaines (marchand) pour un éventuel paiement.
- **Mob dédié possible sans toucher au bestiaire des quartiers** : l'archétype `goblinoid` existe
  (silhouette + palette) ; un chasseur défini hors `baseMobs` n'exige pas de détail signature dans les
  tests, mais peut en avoir un. `isEliteMob()` / icône 💀 / `config.mobDamageScaling.eliteDamageMult`
  s'appliquent à tout mob marqué élite.

### Suggéré (à valider)
**A. Prime (0-100), la « tête mise à prix »** — `gameState.bounty`, visible dans l'en-tête (🎯 + jauge).
- Monte avec les victoires FACILES : facilité ≥ 0,8 → +8 ; 0,5-0,8 → +3.
- Redescend : victoire difficile (facilité < 0,5) → −5 ; nouvel étage → −10 ; payer en ville (voir C).
- Paliers : 30 = « Avis de recherche » (alerte, rien d'autre) ; 60 = chasseurs en maraude ; 90 = escouade.

**B. Les chasseurs** — « Gobelin Chasseur de Primes » (+ variantes Pisteur à distance / Cogneur au
contact, Chef d'escouade à 90+).
- Rencontre : dès 60 de prime, une partie des combats d'exploration et des embuscades de trajet sont
  remplacés par un chasseur (≈ 10 % à 60, ≈ 20 % à 90, jamais deux d'affilée).
- **Force indexée sur le JOUEUR** (PV max, ATQ et DEF effectives, niveau), pas sur l'étage : c'est ce qui
  en fait un vrai frein au snowball, calibré pour qu'un combat coûte environ 30-40 % de vos PV.
- Ils vous traquent : **aucune esquive furtive possible**, et fuir ne marche qu'une fois sur deux (et
  fait monter la prime de +10).
- Escouade (90+) : deux chasseurs d'affilée.

**C. Issues**
- Tuer un chasseur : une récompense égale à la prime (PO ≈ prime × étage × 2), un objet de rang
  « élite », et la prime retombe à 0 (« votre tête ne vaut plus rien, pour l'instant »).
- Racheter sa tête chez un marchand d'étage urbain : coût ≈ prime × étage × 4 PO, prime remise à 0.
- Mourir face à un chasseur : épitaphe dédiée dans la nécrologie.

**D. Présentation** : vignette « AVIS DE RECHERCHE » (affiche avec votre silhouette) au passage des
paliers, sprite dédié (gobelin à chapeau, badge et filet), 2-3 succès bonus (« Tête mise à prix »,
« Chasseur chassé » après 3 chasseurs, « Casier judiciaire vierge » en rachetant sa prime).

### Décisions (utilisateur)
- **Force calée sur le JOUEUR**, pas sur l'étage.
- **La prime ne redescend QU'EN tuant un chasseur** (retombe alors à 0). Pas de baisse avec les combats
  difficiles ni les étages, pas de rachat chez le marchand (le point C « racheter sa tête » est abandonné).
- **Aucune esquive furtive ; fuite une fois sur deux**, et une fuite réussie fait monter la prime de +10.

### Chiffres (validés par l'utilisateur)
| Élément | Valeur |
|---|---|
| Gain de prime par victoire | facilité ≥ 0,8 : +8 · 0,5-0,8 : +3 · < 0,5 : 0 · fuite devant un chasseur : +10 |
| Paliers | 30 avis de recherche · 60 chasseurs en maraude · 90 escouade (2 chasseurs d'affilée) |
| Chance qu'un combat / une embuscade soit un chasseur | 10 % dès 60 · 20 % dès 90 · au moins 3 combats entre deux chasseurs |
| Stats du chasseur | DEF = 35 % de votre meilleure ATQ ; PV = ce qu'il faut pour tenir ~4 de vos coups ; ATQ = ce qu'il faut pour vous prendre ~9 % de vos PV max par coup (≈ 30-40 % sur le combat) — élite 💀 |
| Variantes | Pisteur (à distance, −10 % PV) · Cogneur (+15 % ATQ, −10 % DEF) · Chef d'escouade à 90+ (+30 % PV) |
| Récompense | PO = prime × étage × 2 · un objet de rang élite · prime remise à 0 |

### Planifié (lots)
1. **Prime** : `gameState.bounty` (valeur, chasseurs tués, combats depuis le dernier chasseur), gains
   après chaque victoire (facilité déjà calculée par la chronique), badge 🎯 dans l'en-tête, alertes aux
   paliers.
2. **Chasseurs** : catalogue `bountyHunters` (bestiary.js), `computeBountyHunterStats()` pure (calée sur le
   joueur), apparition dans `handleStealthEncounter()` (sans jet de détection) et dans les embuscades de
   trajet (lieux connus et villes), escouade enchaînée par `winCombat()`.
3. **Issues** : récompense et remise à 0 à la victoire ; fuite à 50 % et +10 ; épitaphe dédiée.
4. **Présentation** : sprite de gobelin chasseur (détail signature), vignette « AVIS DE RECHERCHE »,
   3 succès bonus (« Tête mise à prix » 60, « Ennemi public n°1 » 90, « Chasseur chassé » 3 chasseurs).
5. **Tests** (`tests/regression/bounty.js`, simulation longue) + `NOTES_CHASSEURS.md`.

### Codé
Les 5 lots sont livrés (détail et points à surveiller : `NOTES_CHASSEURS.md`). Précision apportée en
codant : un chasseur tué ne donne QUE sa récompense (pas en plus le butin normal de 40 % d'un mob).

## 4. Émission de changement d'étage (DeathWatch) — L — Codé (à playtester)

**Demande** : émission au changement d'étage, dialogues plus ou moins risqués, choix avec lancer de dés ;
risqué = danger mais grosse récompense si réussite. Exemple : DeathWatch — le commentateur reprend des
éléments de la partie du crawler et lui envoie des piques ; plusieurs réponses prédéfinies plus ou moins
provocatrices ; cadeaux, ou envoyé contre des mobs/crawlers plus ou moins difficiles.

### Exploré (état actuel)
- **Moment** : « Descendre » → écran d'escalier (`triggerFloorTransition()`, bilan + annonce d'anomalie,
  `floorTransitionPending`) → « Continuer » → `advanceToNextFloor()`. Précédent utile : le Pacte du
  Crawler (`triggerPactChoice()`) est un choix bloquant posé À L'ARRIVÉE sur le nouvel étage
  (`pactChoicePending`, dans `isActionBlocked()`) — le bon modèle pour une émission dont la conséquence
  peut être un combat (impossible pendant l'écran d'escalier, qui n'est pas une scène de jeu).
- **Matière pour les piques** (chantier 2) : `runStats` (fuites, pièges, sorts ratés, victoires à mains
  nues, à un poil…), `floorStats` de l'étage qui vient de finir, nécrologie, compagnon (loyauté, à terre,
  congédié), objet ridicule porté (`jokeItem`, déjà utilisé par les épitaphes), prime (chantier 3), succès.
  Le moteur de gabarits à trous des épitaphes (`{{mob}}`, `{{etage}}`…) se réutilise tel quel.
- **Dés** : `config.rangedCombat.dieSides` (d6 opposés) et l'animation `showDie()` existent déjà.
- **Récompenses prêtes** : boîtes Bronze/Argent/Or (`openAchievementBox()`), PO, potions, XP du public
  (`audienceGift`). **Sanctions prêtes** : combat forcé (`initiateCombat()`, mob élite via `generateMob(…,
  eliteBonus)`), crawler hostile (`companionCandidateToMob()`), chasseur de primes (`spawnBountyHunter()` /
  `addBounty()`), perte de temps ou de PO.
- **Décor** : drone caméra de l'émission (`cameraDrone`), PNJ marchand/professeur dessinés, vignettes
  d'exploration — de quoi composer un plateau TV sans nouvel archétype.

### Suggéré (à valider)
**A. L'émission** : à l'arrivée sur un nouvel étage, un écran « 📺 DeathWatch » (bloquant, comme le
Pacte) : plateau TV (présentateur, drone caméra, applaudimètre), le présentateur lance UNE pique tirée
de votre partie (« 12 fuites, [Nom]. Vous battez le record de l'étage… en course à pied. »), puis vous
répondez.

**B. Quatre réponses, du plus sûr au plus risqué** (jet d20 + petit bonus de popularité = 1 par tranche
de 5 succès) :
| Réponse | Jet | Réussite | Échec |
|---|---|---|---|
| 😇 Poli(e) | aucun | petit cadeau (PO) | — |
| 😏 Pique en retour | ≥ 8 | boîte Bronze | l'audience s'ennuie : −2 H |
| 😈 Provocation | ≥ 12 | boîte Argent | combat immédiat contre un mob élite |
| 🤬 Insulte en direct | ≥ 16 | boîte Or | un chasseur de primes est lâché sur vous (+20 prime et combat) |
Un « Refuser l'interview » (aucun effet, le public boude) reste possible.

**C. Contenu** : ~30 piques à trous classées par déclencheur (fuites, pièges, sorts ratés, objet
ridicule, compagnon, prime, dégâts de l'étage, repli générique), ~5 réparties par ton de réponse, et une
réaction du présentateur par issue. Plusieurs présentateurs possibles plus tard (rotation).

**D. Présentation** : overlay dédié avec une scène « plateau TV » (même moteur de vignettes), le dé qui
roule (`showDie()`), le verdict et la récompense/sanction dans le journal. Succès bonus possibles
(« Chouchou du public », « Interdit d'antenne »).

### Décisions (utilisateur)
- **À chaque étage dès le 2**, à l'arrivée (après le Pacte du Crawler s'il y en a un).
- **Tableau B validé tel quel** (seuils 8 / 12 / 16 sur d20 + popularité, boîtes Bronze / Argent / Or,
  sanctions −2 H / mob élite / chasseur de primes +20, refus possible). « Petit cadeau » du Poli : la
  moitié des PO d'une boîte Bronze.
- **Un seul présentateur** (DeathWatch), bien écrit ; d'autres émissions plus tard.

### Planifié (lots)
1. **Catalogue pur** `deathwatch.js` (nouveau, `index.html` ET `GAME_FILES`) : présentateur, ~30 piques à
   trous avec leur déclencheur, répliques par ton, réactions du présentateur, `pickShowTaunt()` /
   `fillShowTemplate()` purs.
2. **Moteur** : `triggerShow()` à l'arrivée d'étage (`showChoicePending`/`pendingShow`, dans
   `isActionBlocked()`), contexte tiré de la partie (bilan de l'étage fini capturé avant sa remise à zéro),
   `answerShow(tone)` (jet, boîte ou sanction), file d'attente derrière le Pacte.
3. **Présentation** : vignette « plateau TV » (présentateur, enseigne EN DIRECT, drone caméra,
   applaudimètre), zone de réponses avec l'enjeu de chaque bouton.
4. **Succès** : « Chouchou du public » (réussir l'insulte en direct), « Interdit d'antenne » (refuser 3 fois).
5. **Tests** (`tests/regression/deathwatch.js`, simulation longue) + `NOTES_DEATHWATCH.md`.

### Codé
Les 5 lots sont livrés (détail et points à surveiller : `NOTES_DEATHWATCH.md`). Précisions apportées en
codant : l'émission n'a lieu que dans une vraie partie (nom confirmé), comme les succès ; l'échec « −2 H »
ne peut jamais tuer (au moins 1 H reste).

## 5. Rework de la carte + génération des étages — XL — Suggestions tour 5 (M2 remplacé)

**Demande** : zoom, réseau plus complexe et logique, bouton carte pour les étages non urbains ; **revoir
la génération des couloirs et des salles, de mauvaise qualité**. Méthode demandée : prendre le temps,
**plusieurs tours de suggestions et d'itérations** avant le plan final et le code.
**Inspiration** (artwork du wiki DCC, « Floors 1 & 2, The Tutorial Floors ») : un *Borough* = 4 blocs de
quartier séparés par de grandes avenues ; chaque bloc est un dédale de salles rectangulaires reliées par
des couloirs, avec une salle de boss de quartier, des salles sûres, (beaucoup de) toilettes et une guilde
tutoriel ; les avenues se prolongent au-delà du borough.

### Exploré (état actuel — `generateFloorMap()` / `generateQuadrant()`, app.js)
Mesures sur 500 étages générés :
- **Aucune géométrie** : une pièce n'a ni position ni taille, seulement une liste de voisins. ~48 pièces
  identiques par étage (10-14 par quartier, jamais selon la profondeur). Une carte ne peut donc être
  qu'un dessin arbitraire du graphe — c'est pour ça qu'elle n'existe pas encore.
- **Couloirs arbitraires** : le type « artère »/« ruelle » est tiré au hasard (40/60) sans lien avec la
  structure ; les « boucles » relient deux pièces quelconques du quartier (raccourcis incohérents, 2,4 %
  de couloirs en double).
- **Structure pauvre** : arbre en « tronc » (70 % des nouvelles pièces se raccrochent à la dernière),
  profondeur max ~5,6, 18 % de culs-de-sac, degré max 7 ; aucune salle n'a de taille ni de fonction
  hors boss / salle sûre.
- **Jonctions entre quartiers** : une seule par paire voisine (anneau 0-1-2-3), entre deux pièces tirées
  au hasard → **9 % débouchent directement dans une salle de boss**, 12 % dans une salle sûre.
- **Exploration** : toucher la scène fait avancer vers un voisin non visité au hasard ; sans voisin
  inconnu, trajet automatique vers la bifurcation la plus proche. Le joueur ne choisit jamais sa direction.
- **Réutilisable** : la mini-carte graphique générique (`renderGraphMiniMap()` : caméra, pan, marqueurs)
  et le brouillard « villes connues » des étages urbains ; tout le reste du jeu ne voit l'étage qu'à
  travers `roomsById`, `neighbors`, `computeDistance()`, `enterRoom()`, les lieux connus et les anomalies
  (LABYRINTHE, CAFET_ASSOMBRIE).

### Suggestions — tour 1 (direction générale, rien de figé)
Piste « Borough » (prototype jetable dessiné pour la discussion, hors dépôt) :
- **Étage = une grille** : 4 blocs de quartier (2×2) séparés par des avenues ; chaque bloc a une vraie
  géométrie (grille de cases).
- **Salles** rectangulaires de tailles variées, placées sans chevauchement ; grande salle de boss au fond
  du bloc ; salles sûres ; 2-3 portes par bloc sur les avenues (jamais dans une salle de boss).
- **Couloirs** courts : arbre couvrant minimal entre salles voisines + quelques boucles LOCALES ; la
  longueur réelle du couloir remplace « artère/ruelle » pour le coût et le risque des trajets.
- **Avenues** = réseau de transit entre blocs (rapide), point de passage obligé d'un quartier à l'autre.
- **Carte** : dessin fidèle salles + couloirs, brouillard de guerre (pièces visitées, portes aperçues),
  zoom et pan (moteur des étages urbains).

Questions ouvertes pour le tour 2 : échelle (un borough par étage ou plusieurs en profondeur), rôle des
avenues, types de salles (toilettes, guildes…), liberté de déplacement, style de la carte, étages urbains.

### Réponses au tour 1 (utilisateur)
1. **Échelle** : un seul borough de 4 quartiers par étage (simple).
2. **Avenues** : zone à part entière — plus rapide et plus sûre, plus de crawlers, et plus de chasseurs de
   primes quand la prime est élevée.
3. **Types de salles** : ni guildes, ni toilettes, ni réserves pour l'instant — mais une **plateforme
   flexible** qui permette plus tard des correctifs et des ajouts sans refonte.
4. **Déplacement** : un entre-deux entre « au hasard » et « libre » → idées demandées.
5. **Carte** : **stylisée** (pas un plan fidèle).
6. **Étages urbains** : on verra après.

### Suggestions — tour 2 (maquette jetable : carte stylisée + vue joueur, hors dépôt)
**Déplacement « entre-deux » (4 idées, cumulables)**
- **M1 — Voyage sur carte** : toucher sur la carte une pièce déjà visitée ou *aperçue* (porte vue) = y
  aller, avec coût en temps et risque d'embuscade selon la longueur réelle du chemin (le système des lieux
  connus, généralisé à toute la zone connue). L'inconnu, lui, reste à découvrir en explorant.
- **M2 — Portes aux bifurcations** : dans une salle à 2+ sorties inconnues, la scène montre 2-3 portes
  (gauche / fond / droite) ; toucher une porte = explorer par là, toucher ailleurs = au hasard comme
  aujourd'hui. Jamais bloquant.
- **M3 — Cap** : choisir un cap sur la carte (une porte d'avenue, un coin inexploré) ; l'exploration s'en
  rapproche à chaque pas quand c'est possible.
- **M4 — Flair** (plus tard, lié à la Furtivité / l'Éclaireur) : chance d'entrevoir ce qu'il y a derrière
  une porte (danger, butin) avant de choisir.
- Recommandation : **M1 + M2** pour la V1, M3/M4 plus tard.

**Avenues (zone à part entière)** : un réseau de tronçons et de carrefours autour et entre les 4 blocs ;
seul passage d'un quartier à l'autre (2-3 portes par bloc, jamais dans une salle de boss). On peut y
explorer comme dans un bloc, avec **sa propre table d'événements** : moins de combats et de pièges, plus de
rencontres de crawlers, chasseurs de primes plus fréquents dès que la prime est élevée ; déplacements
moins coûteux en temps.

**Carte stylisée** : blocs teintés par quartier, salles en pastilles de 3 tailles (S / M / L), couloirs en
traits droits, avenues en larges bandes avec leurs carrefours ; brouillard (plein = visité, pointillé =
aperçu, rien = inconnu) ; zoom et pan (moteur de la carte urbaine).

**Plateforme flexible (le cœur du chantier)**
- `floorgen.js` (pur) : génère la géométrie (blocs, salles, couloirs, portes, avenues) à partir de
  réglages centralisés — changer une taille, un nombre de salles ou de boucles = une valeur à modifier.
- `ROOM_TYPES` (catalogue) : un type de salle = une entrée (libellé, icône, style sur la carte, taille,
  placement : profondeur / près d'une porte, nombre par bloc, événement à l'entrée). Ajouter plus tard des
  toilettes ou une guilde = une entrée + son effet, sans toucher au générateur.
- `ZONE_TYPES` : chaque zone (bloc de quartier, avenue, et plus tard d'autres) pointe vers sa table
  d'événements et ses coûts de déplacement.
- Compatibilité : chaque salle garde `id` / `neighbors` / `type` / `visited` (le reste du jeu continue de
  fonctionner), avec en plus sa géométrie et son état « aperçu » ; la distance de trajet vient de la
  longueur réelle des couloirs.

### Questions pour le tour 3
1. Déplacement : M1 + M2 ? M3 / M4 dès maintenant ou plus tard ?
2. Avenues : exploration libre (comme un bloc) ou simple transit avec événements pendant le trajet ?
3. Taille d'un quartier : ~12-14 salles comme aujourd'hui, ou plus avec la profondeur ?
4. Carte : panneau sous la scène (comme la carte urbaine) ou plein écran ?
5. Sauvegardes en cours : l'étage actuel reste jouable sans carte, la nouvelle génération arrive au
   prochain étage — ok ?

### Réponses au tour 2 (utilisateur)
1. **Déplacement : M1 (voyage sur carte) + M2 (portes aux bifurcations).** M3/M4 plus tard.
2. **Avenues : exploration libre**, comme dans un bloc.
3. **Taille** : même nombre de salles qu'aujourd'hui (~12-14 par quartier).
4. **Carte : panneau sous la scène** (comme la carte urbaine).
5. **Sauvegardes** : on peut supprimer les anciennes, pas de migration nécessaire.

### Suggestions — tour 3 (le détail, pour converger vers le plan final)
Maquette jetable (hors dépôt) : scène avec 3 portes (M2) + panneau carte, et voyage sur carte (M1).

**A. Génération d'un bloc de quartier** (grille de 22 × 16 cases, réglable)
1. Salle de boss d'abord : grande (5 × 4), placée loin des portes.
2. Puis ~11-13 salles de 1 × 1 à 4 × 3 cases, jamais collées (1 case d'écart minimum) ; 1 à 2 salles sûres
   (petites, à mi-profondeur). Taille S / M / L déduite de la surface, pour la carte.
3. Couloirs : arbre couvrant minimal entre salles voisines + 1 à 3 boucles COURTES (seulement entre
   salles proches) ; aucun doublon possible.
4. 2 à 3 portes sur les avenues, sur des salles au bord du bloc, jamais la salle de boss ; la salle de boss
   est au moins à 3 salles de toute porte.
5. Garde-fous vérifiés à la génération (sinon on régénère) : bloc connexe, boss atteignable, profondeur
   du boss, nombre de salles.

**B. Avenues** : une croix + un anneau autour des 4 blocs, découpés en *tronçons* (≈ 12-16 au total) et
*carrefours* ; chaque tronçon est une « salle » de la zone avenue, reliée aux portes des blocs qui la
bordent. Explorer une avenue = avancer d'un tronçon (−1 H) avec sa propre table d'événements.
Proposition de table (**à valider**, D100, à côté de celle des salles actuelles) :
| Événement | Salles (actuel) | Avenue (proposé) |
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
+ chasseurs de primes **deux fois plus fréquents** sur les avenues quand la prime est ≥ 60 ;
+ trajets sur carte qui empruntent une avenue : **temps ×0,5 et risque d'embuscade ×0,5** sur ces tronçons.

**C. Départ et escalier** : arrivée sur l'étage au carrefour central (zone avenue, sûre) ; l'escalier reste
gardé par le boss d'un des 4 quartiers (inchangé) ; le quartier courant = celui du bloc où l'on se trouve
(les avenues gardent le dernier quartier traversé pour le décor et les mobs).

**D. M2 — portes** : dans une salle à 2+ sorties inconnues, la scène montre une porte par sortie (3 max),
étiquetée par sa direction réelle sur la carte (Nord / Est / Sud / Ouest) et un indice (« vers l'avenue »,
ou l'icône de la salle si elle est déjà aperçue). Toucher une porte = y aller ; toucher la scène ailleurs =
au hasard. Une seule sortie inconnue : pas de porte, comme aujourd'hui.

**E. M1 — voyage sur carte** : toucher une salle visitée ou *aperçue* (voisine d'une salle visitée) ouvre
une bulle : destination, temps, risque, « Y aller / Annuler ». Temps et risque viennent de la longueur
réelle du chemin (mêmes règles qu'aujourd'hui : ~9 % de risque par unité de distance, plafonné à 80 %,
réduit par un compagnon Garde et par les avenues). La liste « Lieux connus » disparaît, remplacée par la
carte (boss repérés, salles sûres et escalier y sont marqués).

**F. Carte (panneau sous la scène)** : ouverte par « 🗺️ Carte », boutons ＋ / － / ◎ (recentrer), pan au
doigt ; vue d'ensemble dézoomée (4 blocs + avenues) ou zoom sur le bloc courant ; brouillard : plein =
visité, pointillé = aperçu, rien = inconnu ; marqueurs 👑 boss repéré, 🪜 escalier, 🛏 salle sûre, pion jaune
= vous.

**G. Plateforme flexible (modèle de données)**
- `FLOOR_LAYOUT` (réglages) : taille des blocs et des avenues, nombre de salles, tailles min/max, nombre de
  boucles et de portes, profondeur minimale du boss.
- `ROOM_TYPES` : `{ key, label, icon, mapStyle, size, placement: { depth, nearDoor, perBlock }, onEnter }` —
  aujourd'hui `normal`, `boss`, `safe` ; demain toilettes, guilde… = une entrée.
- `ZONE_TYPES` : `{ key, eventTable, timeMult, ambushMult, hunterMult }` — `block` et `avenue`.
- Salle = `{ id, zone, block, x, y, w, h, size, type, neighbors: [{ to, length }], visited, seen }` : le reste
  du jeu garde `id` / `neighbors` / `type` / `visited` ; `computeDistance()` utilise `length`.
- Anomalies : LABYRINTHE = +50 % de salles par bloc (grille agrandie d'autant) ; CAFET_ASSOMBRIE inchangée.
- Sauvegardes : les anciennes deviennent incompatibles (version de format) — proposées à la suppression.

### Questions pour le tour 4
1. Table d'événements des avenues : ok, ou à retoucher ?
2. Départ au carrefour central : ok ?
3. Suppression de la liste « Lieux connus » au profit de la carte : ok, ou la garder en raccourci ?
4. Portes étiquetées par direction réelle (Nord/Est…) ou simplement gauche / fond / droite ?
5. Autre chose à ajouter avant que je rédige le plan final (lots, ordre, tests) ?

### Réponses au tour 3 (utilisateur)
1. Table d'événements des avenues : **validée telle quelle** (et chasseurs ×2 sur les avenues dès 60 de prime,
   temps et risque ×0,5 sur les tronçons d'avenue).
2. Départ : **aléatoire, mais hors de danger** (pas au carrefour central).
3. Liste « Lieux connus » : **supprimée**, remplacée par la carte.
4. Portes étiquetées **Nord / Sud / Est / Ouest**.

### Décisions consolidées
- Un seul borough de 4 blocs de quartier (2 × 2) + avenues (croix + anneau), ~12-14 salles par bloc.
- Avenues = zone explorable à part entière (table ci-dessus, validée).
- Déplacement : exploration au hasard par défaut + **M2** portes N/S/E/O aux bifurcations + **M1** voyage sur
  carte vers toute salle visitée ou aperçue.
- Carte **stylisée**, **panneau sous la scène**, zoom ＋/－/◎ et pan, brouillard visité / aperçu / inconnu.
- **Départ aléatoire sûr** : une salle normale ou un tronçon d'avenue tiré au hasard, jamais une salle de boss
  ni à moins de 3 salles d'une salle de boss, sans événement à l'arrivée.
- Plateforme flexible : `FLOOR_LAYOUT`, `ROOM_TYPES`, `ZONE_TYPES` (ajouter un type de salle ou de zone = une
  entrée de catalogue).
- Anciennes sauvegardes incompatibles, proposées à la suppression. Étages urbains : inchangés pour l'instant.

### Plan final proposé (à valider avant de coder)
Découpé en lots testables, livrés dans cet ordre sur une même branche :
1. **Générateur pur `floorgen.js`** (+ `FLOOR_LAYOUT`, `ROOM_TYPES`, `ZONE_TYPES`) : blocs (salles, couloirs,
   portes), avenues (tronçons, carrefours), liens bloc ↔ avenue, garde-fous (connexité, profondeur du boss,
   portes jamais sur un boss, aucun chevauchement), départ aléatoire sûr. Hasard injectable pour des tests
   reproductibles. Outil `npm run sim:floors` (mêmes mesures que le diagnostic) pour vérifier la qualité
   sur des centaines d'étages.
2. **Branchement moteur** : `generateFloorMap()` délègue au générateur ; salles compatibles (`id` /
   `neighbors` / `type` / `visited` + géométrie et état « aperçu ») ; `computeDistance()` sur la longueur réelle
   × multiplicateurs de zone ; table d'événements par zone (`resolveCardEvent()`), chasseurs ×2 sur les
   avenues ; LABYRINTHE (+50 % de salles) et CAFET_ASSOMBRIE adaptées ; sauvegarde versionnée.
3. **M1 — voyage sur carte** : `travelToRoom()` (généralise le trajet vers un lieu connu : temps, embuscades,
   Garde, avenues) ; suppression de « Lieux connus » (`knownLocations` : boss repéré, salle sûre, escalier
   libre deviennent des marqueurs portés par la salle elle-même).
4. **Carte stylisée** : rendu (blocs teintés, salles S/M/L, couloirs, avenues, marqueurs, brouillard), zoom ＋/－/◎
   et pan (moteur de la carte urbaine), bulle « Y aller / Annuler » ; bouton « 🗺️ Carte » actif sur tous les
   étages.
5. **M2 — portes N/S/E/O** : vignette de bifurcation (une porte par sortie inconnue, 3 max, direction réelle +
   indice), toucher une porte = y aller, ailleurs = au hasard.
6. **Tests et documentation** : nouveaux domaines `tests/regression/floorgen.js` et `floor-map.js` ; tests
   existants adaptés (salles sûres par quartier, lieux connus, LABYRINTHE, escalier libre) ; simulation longue
   (exploration, portes, voyages) ; `NOTES_CARTE.md` ; `CLAUDE.md` (sections étage, lieux connus, carte).

Validation visuelle dans Chromium à chaque lot qui touche l'écran (4 et 5). Points à surveiller signalés
d'avance : les tests qui s'appuient sur l'ancienne structure (`generateQuadrant()`, lieux connus) seront
réécrits, pas contournés ; la simulation longue devra connaître les nouveaux états (bulle de trajet).

### Retour sur le plan final (utilisateur)
- **M2 abandonné** : pas de portes Nord / Sud / Est / Ouest dans la scène. Nouvelles propositions demandées pour
  l'« entre-deux » entre exploration au hasard et déplacement libre.

### Suggestions — tour 5 (remplacer M2, sans portes dans la scène)
Principe commun : la scène reste un simple bouton « Explorer » (un toucher = −1 H, au hasard). Le choix de
direction, quand il existe, passe ailleurs.
- **P1 — Explorer depuis la carte** : sur la carte, les salles *aperçues* (voisines d'une salle visitée,
  encore inconnues) sont touchables comme les salles visitées ; toucher une salle aperçue voisine = y entrer
  (même coût qu'un pas d'exploration, événement tiré à l'entrée). Plus loin, le trajet passe par M1 puis fait
  le dernier pas dans l'inconnu. Aucun nouvel écran : la carte devient la manette.
- **P2 — Cap** (ancien M3, avancé en V1) : poser un cap sur la carte (un quartier, une porte d'avenue, un coin
  non exploré). Chaque toucher de la scène choisit alors, parmi les sorties inconnues, celle qui rapproche du
  cap (sinon au hasard). Rappel discret dans la scène (petite boussole ➜ nom du cap), annulable.
- **P3 — Humeur d'exploration** : un réglage à 3 crans près du bouton Explorer, qui biaise le hasard sans rien
  imposer — *Prudent* (préfère les salles déjà aperçues sans danger, s'éloigne des boss repérés),
  *Curieux* (préfère les grandes salles et l'inconnu), *Pressé* (préfère les avenues et le quartier de
  l'escalier). Zéro choix par pas, juste une tendance.
- **P4 — Flair** (ancien M4, plus tard) : avec la Furtivité ou un Éclaireur, les salles aperçues affichent
  parfois un indice sur la carte (❗ danger, ✨ butin, 💤 calme), pour choisir en connaissance de cause.
- **Recommandation** : **P1 + P2** pour la V1 (tout passe par la carte, qui est déjà au programme : peu de code
  en plus et une seule logique), P3 en option si le hasard reste trop frustrant au playtest, P4 plus tard.
- Impact sur le plan : le lot 5 (portes) est remplacé par « P1 + P2 sur la carte » ; les lots 1 à 4 et 6
  sont inchangés.

### Questions pour le tour 6
1. P1 + P2 en V1 ? P3 tout de suite ou seulement si besoin ? P4 plus tard ?
2. P1 : toucher une salle aperçue lointaine = voyage (M1) jusqu'à la dernière salle connue puis le pas dans
   l'inconnu, en un seul geste — ok ?
3. P2 : cap effacé automatiquement une fois atteint (quartier atteint, zone explorée) — ok ?

### Décisions
- (plan final en attente de validation)

## 6. Mini-jeux d'exploration — ? — En attente

**Demande** : mini-jeux pour pimenter le gameplay. Vibe a travaillé sur l'exploration : attendre son
résumé avant d'explorer. Voir aussi 7 (même zone du jeu, fusion possible).

## 7. Salles spéciales à choix narratif — M — Idée (ancien backlog de `CLAUDE.md`)

Salles à choix narratif basé sur les compétences, sans fuite possible.

## 8. Sons — M — Idée (ancien backlog de `CLAUDE.md`)

Hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).
