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

- **Tous les chantiers du registre sont codés**, sauf 6, 7 et 8 (pas encore explorés).
- **Tous les chantiers codés restent « à playtester »** : les chiffres sont des valeurs de départ,
  calibrées au mieux par simulation. Les points à vérifier sont regroupés plus bas (« À playtester »).
- **PR #32 mergée** (chantiers 9, 10 et 11) : tag `v32` et release à créer (convention 6 de `CLAUDE.md`).
- **Chantier 12 (villes explorables) codé** sur la branche, avec deux correctifs (crawler mort non restaurable,
  barre du bas agrandie) : une seule PR à ouvrir. Ensuite : 13 (race et classe à l'étage 3) et 6 (mini-jeux),
  cadrés.

## Vue d'ensemble

### À venir

| # | Chantier | Ampleur | Statut | Bloqué par |
|---|----------|---------|--------|------------|
| 6 | Mini-jeux (adresse, glyphes, combat, stand) | XL | En cours (lot 0, V1, V2, V3 et V4 codés) | `NOTES_MINIJEUX.md` |
| 7 | Salles spéciales à choix narratif (compétences, sans fuite) | M | Idée | à rapprocher de 6 (même zone du jeu, fusion possible) |
| 8 | Sons | M | Idée | hébergement des fichiers non tranché |
| 13 | Race et classe choisies à l'étage 3 | L | Exploré (cadrage, en pause) | liste chiffrée à valider |

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
Reste : lot final (succès, piques DeathWatch, `recordRunEvent('minigame')`).

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

## 13. Race et classe à l'étage 3 — L — Exploré (cadrage)

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
(menu débloqué par la façon de jouer), **silhouettes dédiées par race** (dessins à part, prompts Gemini comme
le bestiaire).

**⏸ En pause** (à la demande de l'utilisateur, on avance sur le chantier 6). Reste à faire : liste chiffrée des
6 races / 6 classes (bonus, capacités actives, conditions de déblocage) à valider, puis plan en lots.

## 7. Salles spéciales à choix narratif — M — Idée (ancien backlog de `CLAUDE.md`)

Salles à choix narratif basé sur les compétences, sans fuite possible. Le chantier 5 a prévu la place :
un nouveau type de salle = une entrée de `ROOM_TYPES` (+ son effet dans `enterRoom()`).

## 8. Sons — M — Idée (ancien backlog de `CLAUDE.md`)

Hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).

## 9. Interface inventaire allégée — M — Codé (PR #32, ouverte)

**Demande** : passer les PV et les stats sous le nom du crawler ; une icône pour l'équipement porté, une
autre pour l'inventaire — alléger l'interface sans perdre d'information.

**Décisions** : barre d'icônes **fixée en bas de l'écran**, **masquée en combat**, **pastilles** « nouveau »
sur le Sac et le Grimoire.

**Livré** : fiche du crawler sous le nom, barre 🛡️ / 🎒 / 📖 / 🏆, panneaux, pastilles — voir
`NOTES_INTERFACE.md`.

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
