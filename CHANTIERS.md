# Registre des chantiers

Trace des planifications : chaque idée y entre, est classée, puis avance étape par étape.
Les notes détaillées d'un chantier en cours ou terminé vivent dans leur propre `NOTES_*.md`
(diagnostic, chiffres, tests, points à surveiller) ; ce registre ne garde que le statut, l'ampleur,
les dépendances et les décisions prises. L'historique complet des tours de suggestions reste dans
l'historique git de ce fichier.

## Méthode (pour chaque chantier)

**Exploré → Suggéré → Planifié → Codé**

1. **Exploré** : lecture du code existant, diagnostic chiffré de ce qui ne va pas.
2. **Suggéré** : propositions soumises à l'utilisateur. Tout chiffre d'équilibrage est une LISTE à
   valider (convention 5 de `CLAUDE.md`), jamais appliqué d'office.
3. **Planifié** : plan d'implémentation découpé en lots testables (après validation).
4. **Codé** : implémentation + tests (`npm test`, `npm run test:long` si la boucle de jeu est touchée),
   notes dans `NOTES_<CHANTIER>.md`, résumé d'architecture dans `CLAUDE.md`.

Questions : des phases Exploré à Planifié, les questions à l'utilisateur passent par l'outil de questions
à choix multiples, **jusqu'à 4 par round** (le maximum de l'outil), en plusieurs rounds si nécessaire.

Ampleur : **S** (quelques heures, un seul système) · **M** (un système + UI + tests) · **L** (plusieurs
systèmes, nouvel écran) · **XL** (refonte, à découper en lots livrables séparément).

Une fois codé, un chantier est **condensé** ici (demande, décisions, livraison) : le détail part dans son
`NOTES_*.md`.

## Point d'étape (30/09/2026)

- **Tous les chantiers du registre sont codés**, sauf 7 (pas encore exploré) ; 8 (sons) codé le 03/10/2026.
- **Tous les chantiers codés restent « à playtester »** : les chiffres sont des valeurs de départ,
  calibrées au mieux par simulation. Les points à vérifier sont regroupés plus bas (« À playtester »).
- **PR #32 mergée** (chantiers 9, 10 et 11) : tag `v32` et release non créés (le versioning par tag/release n'est plus une consigne du projet).
- **Chantier 12 (villes explorables) codé** sur la branche, avec deux correctifs (crawler mort non restaurable,
  barre du bas agrandie) : une seule PR à ouvrir. Ensuite : 13 (race et classe à l'étage 3, **planifié** le 01/10/2026) et 6 (mini-jeux),
  cadrés.

## Vue d'ensemble

### À venir

| # | Chantier | Ampleur | Statut | Bloqué par |
|---|----------|---------|--------|------------|
| 6 | Mini-jeux (adresse, glyphes, combat, stand) | XL | Codé (à playtester) | `NOTES_MINIJEUX.md` |
| 7 | Salles spéciales à choix narratif (compétences, sans fuite) | M | Idée | à rapprocher de 6 (même zone du jeu, fusion possible) |
| 13 | Race et classe choisies à l'étage 3 | L | Codé (lots 0 à 5 codés, les 6 corps de Vibe livrés, à playtester) | playtest réel avant merge pour le lot 4 — cahier des charges dans `NOTES_ORIGINES.md` |
| 14 | Buff de départ « Foutu pour foutu » (crawler sans arme) | S | Codé (à playtester) | chiffres à valider |
| 15 | Rééquilibrage du début de partie (étages 1-3) | M | Codé (lots 0 à 5 : outil `sim:early`, Convention collective, Remplaçant intérimaire, Période d'essai, Armure de scénario, habillage satirique) — à playtester | `NOTES_DEBUT_DE_PARTIE.md` — playtest réel avant merge |
| 16 | Entrées en combat : écrans plein écran par mob + départ à distance ou au corps à corps | L | Planifié — lots 0 à 3 et 6 codés (catalogue `encounters.js`, overlay + repli sprite agrandi), toutes les images livrées en SVG : 13 boss (face, Vibe), 39 mobs (face + dos) et 3 chasseurs (face) dessinés par Claude | playtest de l'ensemble (lisibilité des écrans sur téléphone) |

### Codés (à playtester)

| # | Chantier | Ampleur | PR | Notes |
|---|----------|---------|----|-------|
| 1 | Rework des compagnons | M | #26 | `NOTES_COMPAGNONS.md` |
| 2 | Chronique de run + succès sarcastiques | M | #27 | `NOTES_SUCCES.md` |
| 3 | Chasseurs de primes gobelins (anti-snowball) | M | #28 | `NOTES_CHASSEURS.md` |
| 4 | Émission de changement d'étage (DeathWatch) | L | #28 (+ #30 : répliques liées à la pique) | `NOTES_DEATHWATCH.md` |
| 5 | Rework de la carte + génération des étages | XL | #31 | `NOTES_CARTE.md` |
| 9 | Interface inventaire allégée | M | #32 | `NOTES_INTERFACE.md` |
| 10 | Expansion de la banque d'objets + refonte de la rareté | L | #32 | `NOTES_ITEMS.md` (section « Chantier 10 ») |
| 11 | Nouveaux sorts (effets et utilitaires) | M | #32 | `NOTES_SORTS.md` |
| 12 | Villes explorables (étages urbains sur le modèle de la carte) | XL | prochaine PR | `NOTES_VILLES.md` |
| 8 | Sons (ZzFX + voix du présentateur) | M | prochaine PR | `NOTES_SONS.md` |

### Chantiers antérieurs au registre

Livrés avant la création de ce registre (leur numérotation interne, « Chantier 1…10 » d'un rework, n'a
rien à voir avec les numéros ci-dessus).

| Chantier | Contenu | Notes |
|----------|---------|-------|
| Rework combat | scaling des dégâts des mobs, phases de boss, enrage distance et « Charger » | `NOTES_COMBAT.md` |
| Lisibilité combat | séquenceur de beats, bannières de phase et de télégraphe, skip, logs allégés | `NOTES_LISIBILITE_COMBAT.md` |
| QoL / équilibrage | salle sécurisée à choix, réserve de 8, parité magie/arme, villes spécialisées garanties, budget temps par étage | `NOTES_QOL_EQUILIBRAGE.md` |
| Refonte des objets | niveau d'objet, 5 raretés, qualificatifs par cible, valeur marchande, panneau d'inspection | `NOTES_ITEMS.md` |
| Sprites & effets (phases 1-5, PR #25) | crawler équipé en couches, un dessin par objet, effets d'attaque, bestiaire, boss uniques | `CLAUDE.md` (« Scène de combat ») |
| Anomalies d'étage, nécrologie, étages urbains, fiabilisation des tests | — | `CLAUDE.md` (Architecture, Tests) |

## À playtester

Leviers à regarder en premier ; le détail est dans la section « À surveiller en playtest » de chaque
`NOTES_*.md`.

- **Compagnons** (1) : trop forts ? (`support.strikeRatio`, `support.opportunisticChance`,
  `strayHitChance`) ; la loyauté monte-t-elle trop vite ? rencontres toujours rares (3 %).
- **Succès** (2) : rythme des déblocages et valeur des boîtes.
- **Chasseurs** (3) : fréquence d'apparition et difficulté (calée sur le joueur).
- **DeathWatch** (4) : attrait des réponses risquées selon la popularité.
- **Carte** (5) : coût et risque des trajets (`cellsPerDistanceUnit`), avenues trop rentables à « farmer » ?
  lisibilité des blocs sur petit écran.
- **Interface** (9) : fiche lisible avec beaucoup d'états, barre du bas qui ne masque rien.
- **Villes** (12) : durée d'un étage urbain (~56 salles), routes « plus dures » trop punitives ? auberge dans chaque
  ville trop généreuse ? pickpocket, lisibilité des routes diagonales sur petit écran.
- **Objets** (10) : rareté (Légendaire « miracle » avant l'étage 10), économie (un Légendaire vaut ~20× un
  Commun), taux de proc des qualificatifs.
- **Sons** (8) : écoute réelle de tous les sons (composés sans écoute), volume combat / événements, fatigue
  d'écoute, qualité de la voix selon le téléphone, déblocage du son sur iOS.
- **Sorts** (11) : combo Bouclier de Mana + Soin Express, Pas de l'Ombre et le kiting, étourdissement à 30 %.
- **Hérité du backlog** (`CLAUDE.md`) : table D100 des événements, furtivité, boss plus punitifs que les mobs
  en fin de run, économie urbaine.

---

## 1. Rework des compagnons — M — Codé (PR #26)

**Demande** : compagnons mal intégrés, quasiment inutiles, qui fuyaient trop vite.

**Décisions** : propositions validées (stats indexées sur l'étage, +10 %/niveau, loyauté 0-100 au lieu d'un
risque de départ, départ seulement au changement d'étage, « à terre » au lieu de la mort, effets utiles en et
hors combat), avec une exigence : pouvoir leur **donner des objets ET des sorts**. Arbitrages : Garde −25 %
d'embuscade, Frappe +10 % de PO, aucune perte de loyauté à la revente, 10 % de coup encaissé pour les
non-Garde.

**Livré** : les 4 lots (modèle + loyauté, survie + effets, dons, UI + tests) — voir `NOTES_COMPAGNONS.md`.
**Plus tard** : rencontres plus fréquentes, plusieurs compagnons, ordres, trahison, qualificatifs des objets
donnés appliqués au compagnon.

## 2. Chronique de run + succès sarcastiques — M — Codé (PR #27)

**Demande** : système de succès sarcastiques.

**Décisions** : récompense en **boîtes façon DCC** (Bronze / Argent / Or, chiffres validés), succès **par
crawler** (dans sa sauvegarde, pas de collection globale), **35 succès** pour la V1 (catalogue validé tel
quel), succès de mort débloqués « à titre posthume ». Ajout à la validation : **butin réserve pleine revendu
d'office à 50 %** du prix marchand.

**Livré** : chronique `recordRunEvent()`, catalogue `achievements.js`, boîtes, écran Succès, revente
d'office (y compris les objets rendus par un compagnon congédié), indice de domination (utilisé par le
chantier 3) — voir `NOTES_SUCCES.md`.

## 3. Chasseurs de primes gobelins — M — Codé (PR #28)

**Demande** : des gobelins chasseurs de primes traquent les crawlers qui tuent beaucoup de mobs facilement
(anti-snowball).

**Décisions** : force **calée sur le joueur** ; la prime ne retombe **qu'en tuant un chasseur** (pas de
baisse avec le temps, pas de rachat chez le marchand) ; **aucune esquive furtive, fuite une fois sur deux**
(+10 de prime si réussie). Chiffres validés (paliers 30/60/90, escouade à 90+, récompense).

**Livré** : prime, génération calée sur le joueur, variantes, vignette « AVIS DE RECHERCHE », 3 succès
bonus ; un chasseur tué ne donne que sa récompense — voir `NOTES_CHASSEURS.md`.

## 4. Émission de changement d'étage (DeathWatch) — L — Codé (PR #28, #30)

**Demande** : au changement d'étage, un commentateur reprend des éléments de la partie et envoie des
piques ; réponses plus ou moins provocatrices, jet de dés, grosse récompense ou grosse sanction.

**Décisions** : **à chaque étage dès le 2** (après le Pacte du Crawler s'il y en a un) ; tableau des
réponses **validé tel quel** (seuils 8/12/16 sur d20 + popularité, boîtes Bronze/Argent/Or, sanctions −2 H /
mob élite / chasseur +20, refus possible) ; **un seul présentateur** pour la V1.

**Livré** : émission, piques tirées de la partie, réponses à risque (PR #28) ; répliques liées au thème de
la pique et nouveau logo (PR #30). Seulement dans une vraie partie ; le « −2 H » ne tue jamais — voir
`NOTES_DEATHWATCH.md`. **Plus tard** : d'autres présentateurs / émissions.

## 5. Rework de la carte + génération des étages — XL — Codé (PR #31)

**Demande** : zoom, réseau plus complexe et logique, bouton carte sur les étages classiques ; revoir la
génération des couloirs et des salles. Inspiration : le *Borough* du wiki DCC (4 blocs de quartier séparés
par des avenues). Méthode demandée : plusieurs tours de suggestions avant le code (5 tours menés).

**Décisions** : un borough de 4 blocs + avenues (croix + anneau), avenues = zone explorable plus rapide et
plus sûre, ~12-14 salles par bloc, plateforme flexible (`FLOOR_LAYOUT`, `ROOM_TYPES`, `ZONE_TYPES`), carte
stylisée en panneau sous la scène (zoom, glissement, brouillard), départ aléatoire hors de danger, fin des
« Lieux connus ». Déplacement : **M1** (voyage sur carte) + **P1** (explorer depuis la carte) ; **M2** (portes
N/S/E/O dans la scène), **P2** (cap) et **P3** (humeur d'exploration) écartés.

**Livré** : générateur pur `floorgen.js` + `npm run sim:floors`, branchement moteur (distance réelle,
table d'événements par zone, chasseurs ×2 sur les avenues, sauvegarde versionnée), voyage M1, carte
`floormap.js`, P1 — voir `NOTES_CARTE.md`. **Plus tard** : **P4** (flair : indices sur les salles aperçues),
guildes / toilettes / réserves (étages urbains sur le même modèle : fait au chantier 12).

## 6. Mini-jeux — L — Exploré (cadrage)

**Demande** : mini-jeux pour pimenter le gameplay (Vibe devait résumer son travail sur l'exploration : à
intégrer s'il arrive, le cadrage n'attend plus).

**Cadrage (1er round)** : **jeux d'adresse courts** (au toucher, 10-20 s : crochetage au bon moment,
désamorçage de piège, mémoire de symboles…) et **glyphes pour les sorts** (tracer un symbole pour lancer un
sort). Épreuves à compétences (→ chantier 7), paris et défis de l'émission : non retenus pour l'instant.

**Exploré** :
- Point d'accroche des jeux d'adresse : les événements d'exploration (`config.chances`/`avenueChances`,
  `performExploreStep()`) — le piège (`trap`) et le butin (`loot`) sont les candidats naturels (désamorcer au
  lieu de subir, crocheter un coffre) ; ou un nouveau type de salle (`ROOM_TYPES`, prévu par le chantier 5).
- Glyphes : `attackMagic()` a déjà un jet de réussite (backfire selon la compétence Magie,
  `config.magicBalance`) — un glyphe réussi/raté pourrait moduler ce jet ou les dégâts. Contrainte forte : le
  combat est un séquenceur de beats (`runCombatBeats()`), un tracé ajoute une étape interactive au milieu.
- Contraintes communes : jouable au doigt sur iPhone (≥ 44 px), `prefers-reduced-motion`, testable sous Node
  (résolution pure séparée du rendu, comme `fx.js`), jamais bloquant pour la simulation longue.

**Décidé (round 2)** : glyphe **optionnel, pour renforcer** un sort (réussi = bonus, raté = sort normal ou
petit risque de backfire).

**Décidé (round 3)** : échec d'un jeu d'adresse = **conséquence normale de l'événement** (piège qui se
déclenche, butin réduit — jamais mortel à lui seul) ; accroche = **événements piège + coffre** existants
(`resolveCardEvent()`), pas de nouvelle salle ; accessibilité = option **« jet automatique »** (réglage + bouton
Passer, aussi utilisé par la simulation longue et les tests) ; glyphe = **relier des points dans l'ordre**, propre
à chaque sort.

**Décidé (round 4 — mini-jeux de combat et compléments)** : en plus du crochetage, du désamorçage et du glyphe :
- **Mains nues** : **Immobiliser** (prise, mob immobilisé 1-2 tours, 1 tour pour un boss) puis **Étrangler**
  (finisseur sur mob immobilisé/étourdi, dégâts ×3, jamais sur un boss).
- **Tir** : **Cible de précision** (cible plus petite quand l'écart est grand) et **Points faibles** (tête = dégâts,
  bras = −ATQ du mob, jambe = recul d'un cran).
- **Compléments** : **Parade au télégraphe** (armes de mêlée, attaque lourde annoncée d'un boss) et **stand de tir /
  ring en ville** (paris de PO, nouveau puits à PO — à cadrer à part, lié au chantier 7).
- **Déclenchement en combat** : action spéciale **proposée de manière aléatoire** au début (pas de bouton
  permanent ni de temps de recharge) ; chance et affichage à valider.
- Ampleur revue à **XL** : à livrer en trois temps — V1 (crochetage, désamorçage, glyphe), V2 (mains nues, tir,
  parade), V3 (stand / ring).

**Décidé (round 5)** : échec d'une action spéciale de combat = **tour perdu, sans autre pénalité** ; Occasion à
**25 % par tour** (bouton mis en avant pour ce tour seulement, chance un peu relevée par le niveau de la
compétence liée) ; Immobiliser = **maintenir le doigt dans une zone mouvante** (~3 s) ; stand de tir et ring =
**nouvelle salle « salle de jeux »** dans 1 à 2 villes par étage urbain (V3, à cadrer : mises, jeux, gains).

**Décidé (round 6 — mini-jeux de boss, fluidité, animations)** :
- **Épreuves de boss** (V3) : **Parade au télégraphe**, **Briser la garde** (toucher le point faible quand le boss
  se hérisse) et **Coup de grâce** (boss sous ~10 % de PV, mini-jeu selon l'arme). Épreuves de transition de phase
  **non retenues** pour l'instant. **3 à 4 épreuves par boss**, plafonné (les télégraphes suivants se résolvent
  automatiquement). Issues communes : Parfait / Réussi / Raté ; un raté = **aucune pénalité supplémentaire** (le
  comportement actuel du boss). Jet automatique possible partout (il ne donne jamais de Parfait).
- **Récompense d'un Parfait** : l'**arme signature** du boss n'est plus garantie à la 1re victoire mais
  **100 % avec un Parfait, 0 % sans** ; avec 3 Parfaits ou plus, elle reçoit en plus **un qualificatif
  supplémentaire**.
- **Fluidité** (principes retenus) : mini-jeu dans une bande en bas de `#combat-zone` (jamais un overlay plein
  écran), pas de fenêtre de résultat (l'issue passe par l'animation + une ligne de log), consigne en une icône,
  durée plafonnée (3 s mob / 5 s boss, temps écoulé = Raté), skip Espace/Entrée/Passer, pause si l'onglet perd le
  focus, anti-répétition de l'Occasion, réglage Jouer / Réduit / Jet auto, haptique, `startMinigame(spec,
  onResult)` par callbacks (jamais de Promise) avec une étape « interactive » du séquenceur de beats.
- **Animations d'issue** : trois issues (Parfait / Réussi / Raté) par épreuve, `minigameOutcomeFxSpec(kind,
  outcome)` pure et testée (une entrée exigée par épreuve × issue), gel de 120 ms et secousse d'écran réservés à
  Parfait et à la Parade. Livrées avec chaque mini-jeu.
- **Succès et piques DeathWatch** liés aux issues : lot final (`recordRunEvent('minigame', …)`).
- **Plan révisé** : lot 0 (hôte d'épreuve, bande d'UI, réglages, cadre des animations) → V1 (crochetage, désamorçage,
  glyphe) → V2 (mains nues, tir) → V3 (boss) → V4 (salle de jeux) → lot final (succès, piques, notes, version).
- **Tranché** : (1) l'arme signature est **strictement conditionnée au Parfait** (pas de plancher : sans Parfait,
  elle ne tombe pas, même à la 1re victoire) — conséquence assumée : en jet automatique (qui ne donne jamais de
  Parfait), on ne l'obtient plus ; (2) **le Parfait qui compte est celui du Coup de grâce**. Le qualificatif
  supplémentaire (3 Parfaits ou plus sur l'ensemble des épreuves du combat) s'ajoute à cette condition.
  À surveiller en playtest : économie des objets signature, frustration en cas de Coup de grâce raté.

**Livré** : **lot 0** (hôte d'épreuve `startMinigame()`, bande d'UI, réglage Jouer / Réduit / Jet automatique, étape
interactive du séquenceur, animations d'issue, épreuve de référence `timing`) — voir `NOTES_MINIJEUX.md`.
**V1 codé** (crochetage, désamorçage, glyphe — chiffres du plan validé, voir `NOTES_MINIJEUX.md` pour les effets sur
l'équilibrage). **V2 codé** (Occasions de combat à 25 % : Immobiliser, Étrangler, Cible de précision, Point faible — voir `NOTES_MINIJEUX.md`).
**V3 codé** (Parade, Briser la garde, Coup de grâce + cinématique ; arme signature conditionnée au Coup de grâce parfait — voir `NOTES_MINIJEUX.md`).
**V4 codé** (salle de jeux en ville : stand de tir, ring, coffre-fort, mémoire ; mise libre, 1 H par partie — voir `NOTES_MINIJEUX.md`).
**Lot final codé** (chronique `recordRunEvent('minigame'/'arcade')`, 7 succès, 2 piques DeathWatch). Le chantier est codé en entier ; reste le playtest (voir `NOTES_MINIJEUX.md`, « À surveiller »).

**Décidé (round 7 — V4, salle de jeux)** : **4 jeux** — stand de tir (Cible x3), ring (lutte : maintien Immobiliser puis Étrangler), coffre-fort
(crochetage de zones de plus en plus étroites) et mémoire (séquences de plus en plus longues) ; **mise libre** (plafonnée à ses PO) ; **parties illimitées,
1 H par partie** (le temps est le frein) ; gains : **PO** (mise x multiplicateur selon le score), **XP de compétence** sur un excellent score, **lot (objet)
sur un score parfait**. Salle de jeux dans 1 à 2 villes par étage urbain (décidé au round 5).

**Plan proposé** : validé (voir les rounds ci-dessus).

## 12. Villes explorables (étages urbains sur le modèle de la carte) — XL — Codé (à playtester)

**Demande** : poursuivre la refonte de la carte (chantier 5) en l'intégrant aux étages urbains.

**Décisions** : villes de **3 à 5 salles**, routes de **2 à 4 tronçons** explorés pas à pas, villes **calmes**
(pickpocket parfois), **auberge dans chaque ville**, gardien dans la salle de l'escalier au fond de sa ville,
**repaire en impasse** sur une route, ancienne Carte Urbaine **remplacée** par la carte stylisée (villes en bloc
clair + nom, routes d'asphalte), tables d'événements ville / route validées (variante **« routes plus dures »** :
Combat 40, Piège 14), **une PR à la fin**.

**Livré** : générateur pur `generateMetropolis()` + `npm run sim:floors … urbain`, étage urbain dans
`gameState.floorMap` (exploration, voyage M1/P1, carte, repères communs), tables ville / route et pickpocket,
gardien de l'escalier et de la Sortie par le choix de boss existant, repaires en impasse, rendu urbain de la
carte, retrait de l'ancien réseau (`urbanMap`, `travelToCity()`, Carte Urbaine, `renderGraphMiniMap()`),
migration des sauvegardes — voir `NOTES_VILLES.md`.

## 13. Race et classe à l'étage 3 — L — Codé (lots 0 à 5 codés, les 6 corps de Vibe livrés, à playtester)

**Demande** : un système de race et de classe à choisir « au niveau 3 ».

**Cadrage (1er round)** : **à l'arrivée sur l'étage 3**, comme dans Dungeon Crawler Carl — c'est aussi le
premier étage urbain.

**Exploré** :
- Progression actuelle : `gainXp()` (PV +15, ATQ `2 + niveau/4`, DEF `1 + niveau/5` par niveau), 4 compétences
  à l'usage (`gameState.skills` : Arme, Mains nues, Magie, Furtivité), aucune notion de race ni de classe.
- Moment : `advanceToNextFloor()` enchaîne déjà Pacte du Crawler puis émission DeathWatch à l'arrivée ; le
  choix s'y ajouterait comme un choix bloquant de plus (`xyzChoicePending`, `isActionBlocked()`,
  `resetTransientState()`, résolveur de la simulation longue), avant l'émission (le présentateur pourrait s'en
  moquer).
- Leviers existants pour des bonus : `recomputeMaxHp()`, `getEffectiveDef()`, `performPlayerAttack()`,
  compétences (`gainSkillXp()`), qualificatifs passifs (`sumEquippedQualifier()`), sprite en couches du crawler
  (`composeCrawler()` : une race pourrait changer la silhouette).

**Décidé (round 2)** : race = bonus passifs, classe = **capacité active** en combat + bonus de style ; menu
**selon la partie, façon DCC** (choix débloqués par la façon de jouer + quelques choix de base).

**Décidé (round 3)** : **6 races + 6 classes**, ton **loufoque façon DCC**, choix **tiré parmi 3 propositions**
(menu débloqué par la façon de jouer), **silhouettes dédiées par race** (dessins à part, **créés par Vibe**).

**Décidé (round 4, liste validée)** :
- **7 races** (le Raton-laveur est écarté : aucune vente avant l'étage 3, bonus de PO marginal) et **6 classes**. Chiffres = valeurs de départ, à playtester.
- **Déblocage** : « conditions remplies d'abord » — jusqu'à 3 propositions dont la condition est remplie, complétées au hasard parmi les autres (toujours 3 cartes).
- **Capacité active** : **1 fois par combat**, prend le tour, rechargée à chaque nouveau combat ; contre un boss, effets de statut réduits ou ignorés.
- **Silhouettes** : **corps complet par race** (7 corps dont l'Humain actuel), armure, bras par posture et effets à recaler pour chaque corps.
- **Flux** : **deux écrans successifs** (race puis classe), donc deux états bloquants distincts. Choix **définitif pour le run**.

**Décidé (round 5, affinage)** :
- **Matériel manquant** : le remplissage au hasard ne propose que des classes **jouables** (arme, arme à distance ou sort possédé, équipé ou en réserve ; Bagarreur, Filou et Sac de frappe le sont toujours). Une classe dont la condition est remplie reste proposée telle quelle.
- **Increvable (Cafard)** : un dégât mortel (combat, piège, saignement) laisse 1 PV, **1 fois par étage, jamais contre un boss** ; le temps écoulé ne le sauve pas.
- **Cumul** : **tout multiplicatif** (race × style de classe × Boxeur × objets), un seul opérateur dans le code ; à surveiller sur les combinaisons assumées (Troll + Bagarreur + Boxeur : 1,15 × 1,15 × 1,25).
- **Synergies race × classe** : 4 synergies **mécaniques validées** (tableau ci-dessous), plus une ligne d'explication sur chaque carte de choix (« Proposé car vous avez assommé 4 monstres à mains nues. »).
- **Humain** : XP +10 % et **+1 emplacement de réserve** (`config.inventory.maxEquipment` 8 → 9 ; `gameState.maxInventory` suit).
- **Bonus plats → pourcentages** (Nain DEF +12 % au moins +1, Elfe mana max +25 %) pour suivre la progression ; les points de furtivité/fuite du Gobelin restent des points de chance (plafonds existants).
- **Bouton de capacité** : bande dédiée pleine largeur au-dessus des attaques, sur le modèle de `#btn-occasion`, grisée « utilisée » après emploi, remise à zéro au combat suivant.

**Décidé (round 7)** :
- **Coup fatal par une capacité** : Coup de grâce normal — chaque capacité fixe `lastAttackKind` (mains nues, arme, distance, magie ; Filou et Sac de frappe gardent la dernière attaque utilisée).
- **DeathWatch** : pique **dédiée à l'arrivée** de l'étage 3, tirée d'un gabarit propre à la race, à la classe ou à la synergie (nouvelle famille dans `deathwatch.js`) ; pas de pique récurrente aux étages suivants.
- **Gobelin et chasseurs de primes** : fuite **fixe à 50 %**, le bonus de fuite ne joue que contre les mobs ordinaires.
- **Gabarits légèrement variés** : chaque corps a son propre `frontExtent` (aujourd'hui `CRAWLER_FRONT_EXTENT` = 15, constante unique) dans une marge fixe — départ proposé : 12 à 19, hauteur ±20 % — et ses points de fixation d'arme/armure. `distanceToX()`/`MOB_X_CONTACT` et les bandes de portée lisent l'extension du corps courant (fonction `crawlerFrontExtent()`), à tester sur les 7 corps (aucun chevauchement au contact). **Coût ajouté au lot 4** (recalage par corps).

**Décidé (round 8 — cas limites)** :
- **Anciennes sauvegardes** : un crawler déjà au-delà de l'étage 3 sans race ni classe reste **sans origine** (aucune rétro-activation, comme le buff du chantier 14 : `gameState.race`/`crawlerClass` absents = aucun effet).
- **Déclenchement** : **vraie partie seulement** (`gameState.saveEnabled`, comme l'émission DeathWatch et les succès), **sauf le saut DEV** : `devJumpToUrbanFloor()` tire une race et une classe au hasard au lieu d'ouvrir les deux écrans (test rapide de l'étage urbain). Les tests Node forcent le choix ; la simulation longue sait résoudre les deux états bloquants.
- **Sans dessins** : tant qu'un corps n'est pas livré, la race utilise le **corps humain actuel teinté** (couleur de peau propre à la race : vert gobelin, gris goule…) ; chaque dessin livré remplace sa teinte, un par un.
- **Affichage** : **deux badges sous le nom** (icône + libellé, comme `#anomaly-status-bar`/`#starter-buff-status`) qui ouvrent une **fiche d'origine** (bonus, défauts, capacité, synergie éventuelle, titre sarcastique), sur le modèle de la fiche compagnon (`openCompanionSheet()`).
- **Boxeur (chantier 14)** : le `starterBuff` et la race/classe sont indépendants ; leur cumul reste multiplicatif (voir « Cumul »).

| Synergie | Titre | Effet |
|---|---|---|
| Troll + Bagarreur | « Cadre supérieur du pugilat » | Uppercut étourdit 2 tours (non-boss) ; contre un boss, applique « exposé » (DEF ×0,7 un coup) |
| Elfe + Occultiste | « Archimage de salon » | Surcharge ×1,8 (au lieu de ×1,6) et rend 20 mana |
| Gobelin + Filou | « Roi des caniveaux » | Disparition esquive 2 ripostes au lieu d'une |
| Nain + Sac de frappe | « Forteresse sur pattes » | Encaisser renvoie 75 % au lieu de 50 % |


| Race | Bonus | Défaut | Proposée si… |
|---|---|---|---|
| Humain·e « Moyen·ne mais motivé·e » | XP +10 %, +1 emplacement de réserve (9 au lieu de 8) | aucun | toujours éligible (choix de base) |
| Goule | PV max +20 %, saignement −50 % | soins reçus −20 % | `clutchWins ≥ 1` ou `damageTaken ≥ 100` |
| Gobelin de caniveau | Furtivité +10 pts, fuite +15 pts, pièges −25 % | PV max −10 % | `sneakKills ≥ 1` ou `flees ≥ 2` |
| Troll de bureau | PV max +25 %, mains nues +15 % | Furtivité −10 pts | `unarmedKills ≥ 3` |
| Elfe de salon | mana max +25 %, sorts +10 %, backfire −3 pts | DEF −1 | `spellKills ≥ 2` ou un sort appris |
| Nain de chantier | DEF +12 % (au moins +1), armure portée +15 % | fuite −15 pts | une armure équipée |
| Cafard mutant | « Increvable » : 1 fois par étage, un coup mortel laisse 1 PV | PV max −15 % | `flees ≥ 1` ou `clutchWins ≥ 1` |

| Classe | Capacité active (1/combat) | Style passif | Proposée si… |
|---|---|---|---|
| Bagarreur | Uppercut du dimanche : mains nues ×2 + étourdit 1 tour | mains nues +15 % | `unarmedKills ≥ 3` |
| Duelliste | Fendre : ×1,8, ignore 50 % de la DEF | arme +10 % | compétence Arme ≥ 3 |
| Franc-tireur | Tir de barrage : 2 tirs à ×0,8, à toute distance | tir +10 % | `rangedKills ≥ 3` (nouveau compteur de chronique) |
| Occultiste de foire | Surcharge : prochain sort gratuit, ×1,6, sans backfire | coût en mana −10 % | `spellKills ≥ 2` |
| Filou | Disparition : prochaine riposte esquivée + prochaine attaque ×2 | Furtivité +1 niveau | `sneakKills ≥ 1` ou `flees ≥ 2` |
| Sac de frappe | Encaisser : DEF ×2 sur la riposte, renvoie 50 % des dégâts reçus | PV max +10 % | `damageTaken ≥ 150` |

**Lot 0 codé** : `origins.js` (catalogue pur — 7 races, 6 classes, 4 synergies, libellés d'effets et explications — et `pickOriginOffers(kind, state, rng)`), compteur `rangedKills` (`createEmptyRunStats()`, `recordRunEvent('win')` pour les victoires à l'arme à distance), `tests/regression/origins.js`. Choix d'implémentation : quand plus de 3 conditions sont remplies, les 3 cartes sont tirées au hasard parmi les éligibles ; l'Humain (choix de base) compte comme éligible ; le remplissage des classes ne propose que des classes jouables, et ne complète avec des injouables que s'il en manque pour atteindre 3. Aucun effet de jeu n'est encore branché (lots 1 à 3).

**Lot 1 codé** : `gameState.race` + `gameState.raceLastStandFloor` (sauvegardés ; absents = aucune race), `config.origins.races` (une entrée par race, clé absente = neutre), `applyRace(key)`/`recomputeRaceDerived()`/`originRaceEffects()` (app.js, section « RACE : PASSIFS »), un seul point de lecture par effet : PV max (`recomputeMaxHp()`), XP (`gainXp()`), soins (`applyPlayerHeal()`, régénération passive comprise), DEF et armure (`getEffectiveDef()`), mana max et réserve (`recomputeRaceDerived()`), Furtivité (`getStealthChance()`), fuite (`attemptFlee()`, jamais contre un chasseur de primes), pièges et saignement (`applyRaceDamageMods()`), mains nues (`unarmedDamageMult()` = buff de départ × race), sorts et backfire (`attackMagic()`), Increvable (`applyPlayerDamage()` via `applyRaceLastStand()` : 1 fois par étage, jamais contre un boss, jamais à 1 PV). Aucun écran de choix encore : une race se pose par `applyRace()` (lot 2). La restauration d'une sauvegarde ne laisse plus fuiter `starterBuff`/`race` d'un crawler chargé avant (ancienne sauvegarde sans le champ = aucun effet). Tests : `tests/regression/races.js`. Lecture retenue : « sorts +10 % » = dégâts de sorts du joueur (pas les soins ni le compagnon) ; « soins −20 % » inclut la régénération passive.

**Lot 2 codé** : deux écrans successifs (`#race-choice-overlay` puis `#class-choice-overlay`, 3 cartes chacun tirées par `pickOriginOffers()`), état `raceChoicePending`/`classChoicePending` (dans `isActionBlocked()`) + `pendingOriginOffers` = `{ kind, offers, selected }`, `crawlerClass` (posée à la confirmation ; effets au lot 3). **Toucher une carte la sélectionne, un bouton « Confirmer : … » valide** (jamais un choix définitif en un seul toucher). Déclenchement : `originChoiceDue()` (étage 3, `saveEnabled`, pas de race) dans `advanceToNextFloor()`, **avant le Pacte et l'émission** : le Pacte attend (`pendingPactAfterOrigin`, ouvert par `finishOriginChoice()`), l'émission réutilise `pendingShowAfterPact`. Chaque carte affiche effets, défaut, explication de la proposition et, sur une classe, la synergie avec la race déjà choisie. **Badges** `#race-status`/`#class-status` sous le nom (icône + nom court, infobulle) qui ouvrent la **fiche d'origine** (`openOriginSheet()`, panneau d'inspection : bonus, défaut, capacité, synergie). Saut DEV : race et classe au hasard (`rollDevOrigin()`). **Sauvegarde** : un choix en attente est écrit avec le crawler et **rouvert à la restauration** (sinon le crawler resterait sans origine), clé de classe inconnue ou absente = aucune classe, sans fuite d'un crawler chargé avant. Scène : vignette `pact` (autel) réutilisée. Tests : `tests/regression/origin-choice.js` ; la simulation longue résout les deux écrans (première carte) et vérifie qu'ils s'ouvrent une fois chacun à l'étage 3. Vérifié dans Chromium (390 px) : cartes, sélection, confirmation, badges, fiche, aucune erreur JS.

**Lot 3 codé** : `gameState.crawlerClass` + `config.origins.classes` (passifs de style) et `config.origins.synergies` (clé `race+classe`, chaque champ REMPLACE celui de la classe : `originAbilityValues()`), section « CLASSE : PASSIFS DE STYLE ET CAPACITÉS ACTIVES » d'`app.js`. **Passifs** (un point de lecture chacun) : PV max Sac de frappe (`recomputeMaxHp()`), mains nues Bagarreur (`unarmedDamageMult()`), arme Duelliste/tir Franc-tireur (`weaponAttackMultiplier()`), coût en mana Occultiste (`getSpellManaCost()`), Furtivité +1 niveau Filou (`effectiveStealthLevel()`, aussi lue par `stealthSkillLevel()` : crochetage et désamorçage). **Capacité** : `useClassAbility()` (bouton `#btn-class-ability`, bande pleine largeur au-dessus des attaques, grisée avec la raison : `classAbilityStatus()`), **1 fois par combat** (`gameState.classAbilityUsed`, remis à faux dans `initiateCombat()`), prend le tour (`tryPlayerAction()`), la riposte suit. Les 6 (`CLASS_ABILITIES`) : Uppercut (mains nues ×2 + étourdit, via le nouveau crochet `options.onHit` de `performPlayerAttack()` posé AVANT la riposte ; `status.stunned` peut valoir un nombre de tours ; un boss n'est jamais étourdi, « exposé » seulement avec la synergie Troll), Fendre (×1,8, 50 % de DEF ignorée), Tir de barrage (2 tirs à ×0,8 à toute distance, `options.skipReaction` sur le premier : une seule riposte, jamais de second tir sur un ennemi tombé), Surcharge (`status.overcharge` : prochain sort gratuit, ×1,6, jamais de backfire ; Elfe : ×1,8 et +20 mana), Disparition (`status.vanish` : `rollPlayerDodge()` esquive TOUTES les frappes de la riposte, 2 ripostes avec Gobelin ; la prochaine attaque ×2), Encaisser (`status.brace` : DEF ×2 pour la riposte, renvoi de 50 % — 75 % avec Nain — des dégâts réellement subis, `applyBraceReflect()`, l'attaquant garde toujours 1 PV). Chaque capacité fixe `lastAttackKind` quand elle frappe (Coup de grâce normal). Effets visuels : ceux de l'attaque utilisée, plus le dé et le journal pour les capacités sans coup (pas de nouvelle animation dédiée dans `fx.js`, à envisager au lot 5). Tests : `tests/regression/classes.js` ; la simulation longue joue la capacité dès qu'elle est disponible (≈ 70 usages par run).

**Lot 4 (infrastructure) codé** : `sprites/crawler-races.js` (`CRAWLER_RACE_LOOKS` = corps humain **teinté** par race, actif pour les 6 races hors Humain ; `CRAWLER_RACE_BODIES` = corps dessinés, vide tant que Vibe n'en a pas livré), `composeCrawler()` par race (couches, bras par posture, points d'accroche des armes rangées), **extension avant variable** (`crawlerFrontExtent()`, `distanceToX(…, frontExtent)`, `computeRangeBands(…, frontExtent)`, `fx.js`) pour le gabarit légèrement varié, portraits des races sur les cartes de choix et la fiche d'origine (`buildRacePortraitSvg()`), cadavre du Game Over teinté (`crawlerCorpseMarkup()`). `tests/regression/crawler-races.js` valide aussi chaque corps livré (couches, 6 postures, marge d'extension 12-19, interdits `id`/`defs`/dégradés). **Les 6 dessins de Vibe sont livrés et branchés (`sprites/race-ghoul.js`, `race-goblin.js`, `race-troll.js`, `race-elf.js`, `race-dwarf.js`, `race-roach.js`) ; armures et postures vérifiées à l'écran, armure recalée par corps via `anchors.armor`, codé), puis les brancher (fichiers `sprites/race-<clé>.js`) et ajuster l'armure par corps si besoin (`anchors.armor`, non codé).

**Lot 5 codé** : **DeathWatch** — 4 piques de synergie (priorité 3), 7 de race et 6 de classe (priorité 2), thèmes de répliques `originSynergy`/`originRace`/`originClass` (4 tons × 2 lignes) ; `pickShowTaunt()` gère maintenant `priority` (seules les piques de la plus haute priorité restent en lice : sans effet sur les piques existantes) ; contexte `race`/`classe`/`synergieTitre`/`origineFraiche` (vrai seulement à l'étage d'arrivée, une fois race ET classe choisies), donc l'émission de l'étage 3 ouvre sur l'origine, jamais plus tard. **Succès** (6, aucun Or ni secret) : Pièce d'identité, Coup spécial, Numéro de cirque, Spécial devant le patron, Combo de salon, Increvable vraiment ; compteurs de chronique `classAbilities`/`classAbilityBossUses`/`synergyAbilities`/`lastStands` (événements `classAbility`, `lastStand`, `origin`). **Épitaphe** : `EPITAPH_RACE_MENTIONS` (une phrase par race, ajoutée à toute épitaphe). **Effets visuels** des capacités sans coup : `classAbilityFxSpec()`/`playClassAbilityFx()` (fx.js, éclat « self » sur le crawler, une couleur par capacité). Tests : `tests/regression/origins-flavor.js`.

**Plan en lots** (chaque lot : `npm test`, `npm run test:long` dès que la boucle de jeu est touchée) :
- **Lot 0 — données pures (CODÉ)** : `origins.js` (`ORIGIN_RACES`, `ORIGIN_CLASSES`, conditions, `pickOriginOffers(kind, state, rng)` pure à hasard injectable), compteur `rangedKills` dans `createEmptyRunStats()`, ajout aux DEUX listes de scripts (`index.html`, `GAME_FILES`) ; tests des conditions et du tirage (toujours 3 cartes, conditions remplies d'abord).
- **Lot 1 — passifs de race (CODÉ)** : `gameState.race` (sauvegardé ; absent = aucune race, jamais de rétro-activation), `config.origins`, un seul point de lecture par effet (`recomputeMaxHp()`, `gainXp()`, `rollDamage()`, `getStealthChance()`/fuite, `applyPlayerHeal()`, piège, saignement, mana, `getEffectiveDef()`, Increvable dans `applyPlayerDamage()`) ; tests de chaque race.
- **Lot 2 — écrans de choix (CODÉ)** : `raceChoicePending` puis `classChoicePending` (deux overlays, même famille que `#pact-choice-zone`), déclenchés par `advanceToNextFloor()` à l'étage 3 AVANT le Pacte et l'émission (la généralisation de `pendingShowAfterPact` en attente commune est à faire), `resetTransientState()`, `KNOWN_GAMESTATE_KEYS`, résolveur de `long_playthrough.js`, deux badges sous le nom + fiche d'origine (round 8), saut DEV aléatoire.
- **Lot 3 — classes (CODÉ)** : `gameState.crawlerClass`, passifs de style, bouton `#btn-class-ability` (grisé une fois utilisé, remis à zéro dans `initiateCombat()`), 6 capacités via les points d'entrée existants (`performPlayerAttack()`, `resolveEnemyReaction()`…), effets visuels dans `fx.js`.
- **Lot 4 — sprites (infrastructure CODÉE, 6 dessins de Vibe livrés)** : les 6 corps sont dessinés par **Vibe** (cahier des charges : `NOTES_ORIGINES.md`) ; le corps humain teinté par race (round 8) reste le repli, `composeCrawler()` par race, armures et bras par posture recalés, icônes des cartes de choix. 
- **Lot 5 — habillage (CODÉ)** : piques DeathWatch par race/classe, succès, épitaphe, chronique ; `NOTES_ORIGINES.md` et `CLAUDE.md`.

**À surveiller en playtest** : Cafard (Increvable à chaque étage : très fort), cumul Troll/Bagarreur et Goule/Sac de frappe, fréquence réelle des conditions à l'étage 3 (runs courts : seuils bas à confirmer), interaction avec le Boxeur du chantier 14, lisibilité du bouton de capacité.

## 7. Salles spéciales à choix narratif — M — Idée (ancien backlog de `CLAUDE.md`)

Salles à choix narratif basé sur les compétences, sans fuite possible. Le chantier 5 a prévu la place :
un nouveau type de salle = une entrée de `ROOM_TYPES` (+ son effet dans `enterRoom()`).

## 8. Sons — M — Codé (à playtester)

**Demande** : intégrer des effets audio, par la méthode la plus simple.

**Décisions** : sons **synthétisés par ZzFX** (aucun fichier audio, aucun CDN — tranche l'hébergement) ; bruitages
de combat détaillés (famille d'arme, projectile, école de sort, cri par archétype) et d'événements ; **voix du
présentateur partout** (`speechSynthesis`) ; son actif par défaut, bouton 🔊 (tout couper) et bouton 🎙️ (voix
seule) dans l'en-tête ; page d'écoute ; catalogue composé par Claude, échantillon de 5 sons validé avant le code.
Ambiance / musique non retenue.

**Livré** (4 lots) : socle `sounds.js` + boutons + page d'écoute, 36 sons de combat, 18 sons d'événements (en file
d'attente), voix du présentateur (piques et réactions DeathWatch, succès, écrans de rencontre) — voir
`NOTES_SONS.md`.

## 9. Interface inventaire allégée — M — Codé (PR #32, ouverte)

**Demande** : passer les PV et les stats sous le nom du crawler ; une icône pour l'équipement porté, une
autre pour l'inventaire — alléger l'interface sans perdre d'information.

**Décisions** : barre d'icônes **fixée en bas de l'écran**, **masquée en combat**, **pastilles** « nouveau »
sur le Sac et le Grimoire.

**Livré** : fiche du crawler sous le nom, barre 🛡️ / 🎒 / 📖 / 🏆, panneaux, pastilles — voir
`NOTES_INTERFACE.md`.

## 14. Buff de départ « Foutu pour foutu » (crawler sans arme) — S — Codé (à playtester)

**Demande** : rééquilibrer le départ d'un crawler qui ne reçoit ni arme, ni arme à distance, ni sort au cadeau de bienvenue (cadeau « Armure » 17 % ou « Rien » 5 %, soit 22 % des départs — `WELCOME_GIFT_WEIGHTS`) :
un buff temporaire, « foutu pour foutu ».

**Décisions (round 1)** :
- **Buff** : **+5 % de dégâts subis** (malus, toutes sources) en échange de **dégâts ×2 à mains nues** — **Étrangler compris** (×3 → ×6 cumulés ; il ne s'applique qu'à un mob non-boss immobilisé/étourdi).
- **Qui** : tout crawler dont le cadeau est « Armure » ou « Rien » (pas de rétro-activation d'une ancienne sauvegarde : le champ absent = pas de buff).
- **Fin** : le buff saute dès que le crawler **ÉQUIPE** une arme, une arme à distance ou un sort (`equipItem()`/`equipSpell()`, jamais l'armure). Un objet ramassé mais non équipé ne coupe pas ; un don à un compagnon ne compte pas ; une fois perdu, il ne revient pas.
- **Évolution** : si le buff est **encore actif à l'arrivée sur l'étage 2** (`advanceToNextFloor()`), il évolue en **« Boxeur »** : passif plus modeste, sans le malus (+5 % subis disparaît), pour récompenser celui qui a tenu. Chiffres à valider (départ : ×1,25 mains nues ; la DEF ennemie ignorée en plus reste une option à trancher au playtest). Message sarcastique + badge qui change.

**Décidé (round 2)** : à l'équipement d'une arme, d'une arme à distance ou d'un sort, le buff de départ ET son malus sautent toujours ; le **Boxeur reste, en petit** : un simple ×1,25 sur l'attaque Mains nues (sans effet tant qu'on frappe avec l'arme), définitif — récompense d'avoir tenu jusqu'à l'étage 2. `starterBuff` passe donc à `'boxer'` (conservé) au lieu de `null`. Une fois équipé AVANT l'étage 2, rien n'évolue.

**Plan technique (prêt à coder)** :
- `gameState.starterBuff` : `null | 'desperate' | 'boxer'` (sauvegardé ; absent = `null`). Posé par `revealWelcomeGift()` quand le type tiré est `armor`/`nothing`. À ajouter à `resetTransientState()` et `KNOWN_GAMESTATE_KEYS` (règle des tests méta).
- Réglages dans `config.starterBuff` : `damageTakenMult` 1,05, `unarmedMult` 2 (Étrangler compris), `boxerUnarmedMult` 1,25.
- Un seul point de lecture par effet : mains nues dans `attackUnarmed()` (et Étrangler dans `resolveOccasion()` via le même helper), dégâts subis dans `applyPlayerDamage()` (arrondi, jamais moins que le montant d'origine).
- Fin : `endStarterBuff()` appelée par `equipItem()` (slot arme/distance) et `equipSpell()` — `'desperate'` → `null`, `'boxer'` reste ; évolution dans `advanceToNextFloor()`. Badge `#starter-buff-status` (infobulle avec les chiffres), journal sarcastique à l'activation, à l'évolution et à la perte.
- Tests : activation selon le cadeau, +5 % subis, ×2 mains nues et Étrangler, fin à l'équipement (arme/distance/sort, jamais armure), objet non équipé sans effet, évolution à l'étage 2, sauvegarde/restauration, ancienne sauvegarde sans buff.
- **Codé** : `starterBuff*()`/`endStarterBuff()`/`evolveStarterBuff()` (app.js, section « BUFF DE DÉPART »), `config.starterBuff`, badge `#starter-buff-status`, `tests/regression/starter-buff.js`. Le malus est appliqué avant bouclier de mana et interception du compagnon (`companionInterceptHit()`), et sur les pièges (`springTrap()`, `triggerCafetRoom()`) et le saignement ; la Charge à mains nues est aussi doublée (l'Étrangler et l'attaque Mains nues, comme décidé).
- Playtest : fréquence de survie à l'étage 1 d'un crawler sans arme (simulation possible via `tests/long_playthrough.js` en forçant le cadeau « Rien »).

## 10. Expansion de la banque d'objets — L — Codé (PR #32, ouverte)

**Demande** : des objets puissants mais rares (armure de plates, épée longue…) et un rééquilibrage : fréquent
de trouver un objet médiocre, rare de trouver du vrai matériel.

**Décisions** : familles **Bricolage 10 / Standard 6 / Militaire 3 / Arsenal 1**, traits fixes sur les gros
objets, liste des 13 nouveaux objets et objets blagues en plus : **tout validé**. Ajout à la validation :
**refonte de la rareté** (trop vite triviale à bas étage ; un Légendaire « miraculeux » à l'étage 1, normal
vers le 15) — tables par étage, plafond des montées (Épique jusqu'à l'étage 4), plancher des boss selon
l'étage, objet signature Rare/Épique/Légendaire selon l'étage : **validée et appliquée**.

**Livré** : familles et tirage pondéré, 13 objets (dessins et effets compris), 4 objets blagues, traits
fixes, rééquilibrage des objets existants, refonte de la rareté — voir `NOTES_ITEMS.md`.

## 11. Nouveaux sorts — M — Codé (PR #32, ouverte)

**Demande** : de nouveaux sorts.

**Décisions** : effets intrinsèques (vol de vie, étourdissement, corrosion, saignement, aveuglement, chaîne,
terreur) et sorts utilitaires utilisables à toute distance, liste et chiffres **validés tels quels** ; un
sort utilitaire **consomme le tour**.

**Livré** : 7 sorts à effet et 3 sorts utilitaires, effets visuels — voir `NOTES_SORTS.md`.

## 15. Rééquilibrage du début de partie (étages 1-3) — M — Codé (lots 0 à 5), à playtester

**Demande** : le jeu est très difficile jusqu'à l'obtention d'un équipement fiable. Pistes de l'utilisateur : PV des mobs, dégâts des mobs ; **pas de hausse de la puissance
des armes** ; correctifs au caractère satirique dans le ton de DCC. Diagnostic chiffré et plan complet : `NOTES_DEBUT_DE_PARTIE.md`.

**Constats (mesurés)** : cadeau de départ négligeable (+2,4 ATQ) ; un combat ordinaire à l'étage 1 coûte 55 % (N1) / 42 % (N2) des PV, 18 % / 10 % de mort ; les **élites 💀** (7 % des
mobs) tuent 59 à 85 % du temps aux étages 1-3 ; les boss d'escalier exigent le niveau 7 (87 %) alors que le niveau 7 demande ~24 combats.

**Décisions (rounds 1 et 2)** : périmètre étages 1-3 · **Convention collective du Donjon** (aucune élite aux étages 1-2, rampe ×1,3/×1,5/×1,65 aux étages 3-5) · **Remplaçant
intérimaire** (boss ×0,75 PV et ATQ, étages 1-3) · **Période d'essai** (−40 % de dégâts subis au N1, fondu jusqu'au N7, tous dégâts directs, arrêt à l'étage 4) · **Armure de
scénario** (1 fois par étage 1-3, un coup mortel laisse 1 PV, boss compris) · cible : combat ordinaire N1-N2 étage 1 ≈ 35 % des PV, mort ≤ 5 %. Écartés : Bonus Premier Sang (XP), Trousse du sponsor.

**Plan** : lots 0 (outil `sim:early`) à 5 (habillage), voir `NOTES_DEBUT_DE_PARTIE.md`. Même branche et même PR que le chantier 13 (`claude/chantier-13-origines`, PR #36, non mergée) : le chantier 15 s'y ajoute.

**Lot 0 codé** : `tests/tools/early-curve.js` (`npm run sim:early`), `config.earlyGame` (rien ne le lit encore), `tests/regression/early-game.js`. Baseline : voir `NOTES_DEBUT_DE_PARTIE.md`, section 6 — le paquet atteint les deux cibles (étage 1, N1 : 53 % → 34 % des PV, mort 13 % → 4 % ; boss de l'étage 1 à 91 % dès le N5). Point à reposer au playtest : les élites restent létales aux étages 3-5.

**Lot 1 codé** : Convention collective du Donjon — aucune élite aux étages 1-2 (re-tirage dans `generateMob()`), rampe des dégâts d'élite ×1,3 / ×1,5 aux étages 3-4 (`eliteDamageMultForFloor()`), chasseurs de primes exemptés. `sim:early` (moteur) : mêmes chiffres que la baseline.

**Lot 2 codé** : Remplaçant intérimaire — boss des étages 1-3 (gardien d'escalier, quartier, repaire) à ×0,75 en PV et ATQ, nom suffixé « (intérimaire) », réplique d'accueil ; récompenses inchangées. `sim:early` (moteur) : mêmes chiffres que la baseline.

**Lot 3 codé** : Période d'essai — −40 % de dégâts subis au niveau 1, dégressif jusqu'au niveau 7, étages 1-3, tous dégâts directs (coup encaissé, pièges, saignement) ; badge `#trial-status` ; facilité des victoires protégée (les chasseurs de primes ne sont pas attirés plus vite) ; message de fin à l'étage 4.

**Lot 4 codé** : Armure de scénario — un coup mortel par étage (1-3) laisse 1 PV, boss compris, reste du tour absorbé ; passe avant l'Increvable du Cafard ; `applyPlayerDamage()` renvoie les PV réellement perdus (journaux honnêtes).

**Lot 5 codé** : habillage satirique — 4 thèmes de piques DeathWatch (`trial` sur la Période d'essai, `trialEnd` à l'arrivée à l'étage 4, `plotArmor` après un coup mortel évité, `interim` après un boss intérimaire vaincu ; répliques sur les 4 tons), 2 succès Bronze (« Le scénariste vous aime », « Licenciement sans préavis », catalogue 53 → 55), message de fin de la Convention collective à la première élite croisée (une fois, `gameState.eliteConventionEnded`).
**À playtester avant merge** : élites encore létales aux étages 3-5 malgré la rampe ; le suspense du tutoriel face à l'Armure de scénario ; la falaise de l'étage 4.

## 16. Entrées en combat (fluidité et lisibilité) — L — Planifié

**Demande** : le début d'un combat est trop instantané. Un écran plein écran statique par mob (rage s'il nous attaque, de dos
et au loin en cas d'embuscade), images générées par Vibe avec un fichier de consignes, boss d'abord puis mobs les plus puissants ;
et, en embuscade, pouvoir choisir un départ à distance ou au corps à corps.

**Exploré** : `initiateCombat()` (app.js) bascule d'un coup de la scène d'exploration au combat (en-tête posé, journal, `updateUI()`),
sans temps mort. Cinq entrées y mènent : rencontre repérée (`handleStealthEncounter()`), esquive ratée (`attemptStealthEvasion()`),
attaque furtive (`attemptStealthAttack()`, `pendingSneakAttack`), embuscade de trajet (`triggerNextAmbushOrArrive()`), boss
(`triggerBossEncounter()`), chasseur de primes (`maybeSpawnBountyHunter()`). Seule la furtivité non repérée a déjà un écran
(vignette `stealthUnseen`, petite). L'écart de départ n'a qu'une règle : `mobWantsFar()` → `config.rangedCombat.initialDistance`, sinon 0.

**Décidé (round 1)** : overlay **toujours fermé par un tap** (Espace/Entrée aussi) · variantes **« il t'a vu » (face, rage)**,
**« tu l'as vu » (dos, au loin, occupé)**, **arrivée de boss** distincte, **chasseur de primes** (affiche RECHERCHÉ) · embuscade :
**Attaque furtive à 2 boutons** (corps à corps / de loin) · images **WebP dans `assets/mobs/`**.

**Plan** :
- **Lot 0 — catalogue pur `encounters.js`** (**codé**, `tests/regression/encounters.js`) (chargé avant `app.js`, ajouté à `index.html` ET `tests/load_game.js`) : `ENCOUNTER_KINDS`
  (`spotted`, `unseen`, `ambush`, `boss`, `hunter` : titre, réplique sarcastique, couleur d'accent), `encounterArtSlug(nom)`,
  manifeste `ENCOUNTER_ART` (`{ 'Nom exact': { face, back } }`, mis à jour à chaque livraison de Vibe), `resolveEncounterArt(enemy, kind)`.
  Test : chaque entrée du manifeste existe sur disque et correspond à un mob/boss réel, aucun slug en double.
- **Lot 1 — overlay `#encounter-overlay`** (**codé**, vérifié dans Chromium à 375 px ; aperçu en console : `devPreviewEncounter('spotted'|'ambush'|'unseen'|'boss'|'hunter', 'Nom exact')`) : image plein écran (`object-fit: cover`, ancrage haut), bandeau titre + « Toucher pour continuer »,
  fondu d'entrée, léger zoom lent et secousse à la révélation, coupés sous `prefers-reduced-motion`. **Repli sans image** : le mob actuel
  (`resolveMobSprite()`, aura comprise) agrandi sur le décor du quartier (`composeBackdrop()`), de face ou de dos — la fonctionnalité marche
  dès le lot 1, chaque image livrée ne fait qu'améliorer un mob. Image chargée via `<img>` avec repli sur `onerror`.
- **Lot 2 — branchement** (**codé**, vérifié dans Chromium : furtif → tap → boutons, attaque furtive → combat direct, embuscade → Espace → combat) : `initiateCombat(enemy, { intro: 'spotted'|'ambush'|'boss'|'hunter' })` joue l'overlay PUIS démarre le combat
  (callback, jamais de Promise) ; les étapes de `initiateCombat()` sont découpées en `showEncounterIntro()` → `beginCombat()`. Écran « tu l'as vu »
  (`unseen`) avant les boutons Esquiver / Attaque furtive. Blocage `gameState.encounterIntroPending` (`isActionBlocked()`, `resetTransientState()`,
  `KNOWN_GAMESTATE_KEYS`, résolveur de `tests/long_playthrough.js`). Sans interface (tests Node, `saveEnabled` faux) : appel immédiat du
  callback, comme les mini-jeux. Pas de rejouage à la restauration d'une sauvegarde.
- **Lot 3 — départ à distance ou au corps à corps** (**codé**, valeurs validées : ×2 au contact, ×1,5 de loin, écart 6, tireur surpris au contact perd son premier tour, condition arme OU sort offensif à distance) : `attemptStealthAttack(mode)` avec deux boutons « Surgir au corps à corps » (écart 0) et
  « Tirer de loin » (écart `initialDistance`, grisé sans arme à distance ni sort offensif à distance). Option `startDistance` de `initiateCombat()`
  (le `mobWantsFar()` actuel reste le défaut). Le bonus ×2 du premier coup (`pendingSneakAttack`) s'applique à l'attaque choisie ; un mob de
  mêlée tenu à distance perd donc des tours à avancer (déjà géré par les règles d'écart et la ruée). Aucune modification des formules.
- **Lot 4 — consigne Vibe `prompts/vibe-rencontres.md`** (modèle de `gemini-boss.md`) : format 750×1334 portrait, WebP q≈80 (~100 Ko), style du
  bestiaire, deux plans par mob — *face* (le mob fixe le joueur, hostile, caméra au niveau du crawler) et *dos* (de dos, loin, occupé à une
  activité propre à son archétype) —, boss : un seul plan face, plus imposant, avec son objet signature ; décor du quartier d'origine ; aucun texte.
  Nommage `assets/mobs/<slug>-face.webp` / `-back.webp`, liste ordonnée des 13 boss.
- **Lot 5 — vagues d'images** : 13 boss → mobs les plus puissants (les élites étant des modificateurs, on classe par stats de base d'étage tardif) → le reste (39 mobs
  × 2 plans). Chaque livraison = images + lignes du manifeste ; un mob sans image garde le repli du lot 1. Poids total visé ≈ 10 Mo, chargées à la demande (jamais au démarrage).
- **Lot 6 — habillage** (**codé** : réglage joueur Toujours / Importants / Jamais dans ⚙️ Réglages ; vibration de boss déjà en place ; la réplique DeathWatch de chasseur et le succès « surpris en train de bailler » sont écartés, DeathWatch n'intervenant qu'aux changements d'étage) : réglage de durée facultatif, vibration (`navigator.vibrate`) à la révélation d'un boss, réplique DeathWatch pour l'arrivée d'un chasseur,
  succès éventuel « Surpris en train de bailler » (se faire attaquer à dos tourné).

**Chiffres du lot 3 : validés** (×2 / ×1,5, écart 6, tireur surpris, arme ou sort à distance). **Restent à valider** : le tap obligatoire sur chaque rencontre (surtout les mobs ordinaires aux étages tardifs) est-il lassant ? (option envisagée si oui : tap dès le 1er étage, auto-fermeture
~3 s ensuite, à décider au playtest).

**Évaluation de Vibe** : `prompts/vibe-test-rencontres.md` (à coller dans Vibe) — rapport de capacités d'abord, puis lot de test de 5 images (boss, mob face, même mob de dos, machine non humanoïde, chasseur de primes), page d'aperçu iPhone avec bandeau, auto-évaluation, et rédaction par Vibe de sa propre consigne de série `prompts/vibe-rencontres.md`. Ressources graphiques lues sur `main` (la branche `graphique` est périmée). Le lot 4 du plan s'appuiera sur ce retour.

**Livraisons de Vibe** (format **SVG** 750 x 1334, 5-9 Ko, accepté de fait : plus léger et net que le WebP prévu, le manifeste porte l'extension par image) : **les 13 boss** en cadrage face (vague 1 terminée). Fidèles aux sprites (palette, objet signature), mais compositions très frontales et symétriques, auras en ellipses plates, décors génériques ; à corriger : sifflet du Chef de Gare (à la bouche), Mère-Liane trop fine, Boucher en cône, Gardien aux mains illisibles. Le Gardien du Parking Éternel est le plus faible (véhicule bas, ~35 % de la hauteur, beaucoup de vide au-dessus). Manquent encore : les plans de dos, le chasseur de primes, les mobs (vague 2), le rapport de capacités et la page d'aperçu. Seule retouche aux fichiers : identifiants `usine-tôle` / `machines-tôle` passés en ASCII.

**Retouches de Vibe, tour 1** : aura « vivante » (halo irrégulier, éclats propres à l'effet) et accessoires de décor ajoutés sur les 5 boss déjà réussis (Maître des Illusions, Baron des Ombres, IA Malveillante, Grand Requin Gonflable, Animateur Vedette) — appliqués aux fichiers sans changer leurs dessins. En attente : les corrections des 8 boss problématiques (Chef de Gare, Mère-Liane, Boucher, Gardien des Mots Perdus, Gardien du Parking, Professeur, Directeur, Roi des Chaussettes).

**Vague 2 (mobs) : Vibe abandonné, SVG dessinés par Claude**, quartier par quartier (ordre de `districts.js`), les 3 mobs d'un quartier en parallèle (un agent par mob, chacun produit sa paire `face` + `back` à partir de son sprite actuel, du décor du quartier et de la face du boss du quartier comme référence de style ; intégration et contrôle dans l'overlay réel par le coordinateur). `prompts/vibe-rencontres-vague2.md` reste la référence des cadrages. Les tests d'`encounters.js` ne supposent plus « 13 boss, aucun mob » (mob fictif « Mob de Test » pour le repli, contrôle de format sur toutes les vues déclarées).
- [x] Tunnels de Métro Abandonnés : Rat Goulot (tête dans une poubelle), Distributeur de Snacks Hanté (se recharge sur une prise), Contrôleur de Billets Zombifié (composte les tickets d'une file de rats).
- [x] Jardins Carnivores : Tulipe Géante (s'arrose sous une lampe horticole), Ronce Étrangleuse (étrangle un tuyau d'arrosage), Gobelin Paysagiste (décapite une haie taillée en crawler).
- [x] Bureaux de l'Administration Pénitentiaire : Photocopieuse Carnivore (mâchonne le stagiaire réparateur), Stagiaire Démoniaque (tournée du café, tour de mugs), Garde-Chiourme Bureaucrate (tamponne une montagne de dossiers).
- [x] Usine de Transformation Alimentaire : Saucisse Vivante (bronze sous la lampe chauffante), Fromage qui Pue (s'asperge de désodorisant, rat évanoui), Ouvrier à la Chaîne (boulonne les saucisses du tapis).
- [x] Bibliothèque des Oubliés : Livre Maudit (le fantôme porte le livre qui dévore un grimoire ; une retouche pour coller au sprite fantôme + livre), Bibliothécaire Fantôme (fait léviter les livres, pointe celui rangé à l'envers), Encre Vivante (repeint en noir les pages d'un livre).
- [x] Laboratoire de Fous : Savant Dingue (fait déborder un bécher, hamster électrifié), Créature en Bocaux (se tasse dans un bocal trop petit), Robot Défectueux (tabasse un terminal en erreur).
- [x] Rue des Illusions : Mime Aggressif (coincé dans sa boîte invisible), Ombre Suspicieuse (espionne aux jumelles derrière un réverbère trop fin), Miroir Brisé (se recolle au scotch).
- [x] Catacombes des Chaussettes Perdues : Chaussette Solitaire (cherche sa paire dans un tas de chaussettes), Lave-Linge Possédé (pille une niche en plein essorage), Monstre de Poussière (saute vers une chaussette sur le fil à linge).
- [x] Marché Noir du Donjon : Marchand Malhonnête (étiquette sa camelote, s'en colle une dans le dos), Sac de Pièces Vivant (vérifie une pièce sous une lanterne), Garde du Marché (« contrôle » un étal de brochettes en les goûtant).
- [x] Salle des Machines Infernales : Imprimante à Rêves (s'endort en imprimant des moutons), Ordinateur en Colère (se dispute avec sa souris qui s'enfuit), Câble Électrique Vivant (force sa prise dans une prise murale trop petite, câbles noués).
- [x] Parking Souterrain Maudit : Voiture Abandonnée Rouillée (coincée entre deux piliers en voulant se garer), Horodateur Vengeur (couvre de contraventions le pare-brise d'une voiture garée), Cône de Chantier Fou (balise une « zone de travaux » autour d'une tache d'huile).
- [x] Piscine Municipale Désaffectée : Maître-Nageur Zombifié (siffle un canard en plastique qui « court » au fond du bassin vide), Frite de Piscine Étrangleuse (s'entraîne à étrangler une bouée canard), Nuage de Chlore Ambulant (trempe ses bras dans le pédiluve, décolore un bonnet oublié).
- [x] Studio de Télé-Achat Abandonné : Mannequin Vitrine Possédé (essaie une perruque devant un écran éteint), Caméra de Surveillance Autonome (filme avec passion une plante en plastique), Présentateur Télé-Achat Hystérique (démonstration d'un éplucheur miracle devant des chaises vides).
- [x] Chasseurs de primes (face seulement, décor de route de nuit, affiche RECHERCHÉ sans lettres) : Gobelin Pisteur de Primes (compare l'avis à ta tête, arbalète armée), Gobelin Cogneur de Primes (gourdin clouté levé, filet prêt), Chef d'Escouade Gobelin (hurle dans son porte-voix, sbires au loin).
