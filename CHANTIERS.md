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
- **PR #32 ouverte** (chantiers 9, 10 et 11, `APP_VERSION` 32) : à merger, puis tag `v32` et release
  (convention 6 de `CLAUDE.md`).
- **Tous les chantiers codés restent « à playtester »** : les chiffres sont des valeurs de départ,
  calibrées au mieux par simulation. Les points à vérifier sont regroupés plus bas (« À playtester »).
- **Prochain chantier** : rien de lancé. Candidats : 6/7 (attendent le résumé de Vibe), 8 (attend la
  décision sur l'hébergement des sons), ou une passe d'équilibrage après playtest.

## Vue d'ensemble

### À venir

| # | Chantier | Ampleur | Statut | Bloqué par |
|---|----------|---------|--------|------------|
| 6 | Mini-jeux d'exploration | ? | En attente | résumé de Vibe sur l'exploration |
| 7 | Salles spéciales à choix narratif (compétences, sans fuite) | M | Idée | à rapprocher de 6 (même zone du jeu, fusion possible) |
| 8 | Sons | M | Idée | hébergement des fichiers non tranché |

### Codés (à playtester)

| # | Chantier | Ampleur | PR | Notes |
|---|----------|---------|----|-------|
| 1 | Rework des compagnons | M | #26 | `NOTES_COMPAGNONS.md` |
| 2 | Chronique de run + succès sarcastiques | M | #27 | `NOTES_SUCCES.md` |
| 3 | Chasseurs de primes gobelins (anti-snowball) | M | #28 | `NOTES_CHASSEURS.md` |
| 4 | Émission de changement d'étage (DeathWatch) | L | #28 (+ #30 : répliques liées à la pique) | `NOTES_DEATHWATCH.md` |
| 5 | Rework de la carte + génération des étages | XL | #31 | `NOTES_CARTE.md` |
| 9 | Interface inventaire allégée | M | #32 (ouverte) | `NOTES_INTERFACE.md` |
| 10 | Expansion de la banque d'objets + refonte de la rareté | L | #32 (ouverte) | `NOTES_ITEMS.md` (section « Chantier 10 ») |
| 11 | Nouveaux sorts (effets et utilitaires) | M | #32 (ouverte) | `NOTES_SORTS.md` |

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
guildes / toilettes / réserves, étages urbains sur le même modèle.

## 6. Mini-jeux d'exploration — ? — En attente

**Demande** : mini-jeux pour pimenter le gameplay. Vibe a travaillé sur l'exploration : attendre son
résumé avant d'explorer. Voir aussi 7 (même zone du jeu, fusion possible).

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
