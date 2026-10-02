# Notes — Chantier 15 « Rééquilibrage du début de partie »

Le jeu est très difficile **jusqu'à ce que le crawler ait un équipement fiable** (retour de playtest). Ce fichier garde
le diagnostic chiffré, les décisions de l'utilisateur (rounds 1 et 2) et le plan en lots. Registre : `CHANTIERS.md`, chantier 15.

**Contrainte posée par l'utilisateur** : ne PAS augmenter la puissance des armes (les refontes précédentes ne doivent pas régresser) ;
corriger plutôt par des mécanismes qui ajoutent un **caractère satirique dans le ton de DCC** (l'émission protège ses débutants).

## 1. Diagnostic (mesuré, à reproduire au lot 0)

Méthode : combats à PV pleins en espérance, avec les vraies fonctions du jeu (`generateMob()`, `generateBoss()`, `rollDamage()`, gains par niveau de
`gainXp()`), mobs tirés dans tous les quartiers. Simplifications : ni fuite, ni furtivité, ni repos, ni statuts, ni mobs à distance — l'ordre de grandeur,
pas une prédiction. Les scripts d'exploration seront repris dans `tests/tools/early-curve.js` (`npm run sim:early`, lot 0).

**Constat 1 — le cadeau de départ ne change rien.** Arme Camelote : ~+2,4 ATQ ; armure : ~+1,5 DEF. Le crawler démarre à 100 PV / ATQ 10 / DEF 5.

**Constat 2 — un combat ordinaire coûte déjà la moitié des PV** (cadeau Camelote ; PV perdus / mort, depuis PV pleins) :

| | N1 | N2 | N3 | N4 | N6 |
|---|---|---|---|---|---|
| Étage 1 | 55 % / 18 % | 42 % / 10 % | 32 % / 3 % | 26 % / 3 % | 14 % / 1 % |
| Étage 2 | 72 % / 37 % | 58 % / 19 % | 45 % / 10 % | 33 % / 3 % | 20 % / 2 % |
| Étage 3 | 81 % / 55 % | 70 % / 34 % | 57 % / 17 % | 45 % / 11 % | 26 % / 2 % |

Progression : XP moyen par mob à l'étage 1 ≈ 24,6 → niveau 2 en 3 combats, 3 en 5, 4 en 8, 5 en 12, 6 en 17, 7 en 24, 8 en 32.
Un mob moyen de l'étage 1 : 60 PV, ATQ 12,4 (50 % des mobs portent un modificateur).

**Constat 3 — les élites 💀 sont la première cause de mort** : 7 % des mobs, mais à PV pleins (étages 1-3, N1-N4) **59 à 85 % de mort**. Elles restent
létales même bien niveauées (étages 3-6 : 12 à 57 % de mort selon le niveau). Les mobs ordinaires, avec ou sans modificateur, se valent (40-54 % de PV perdus).

**Constat 4 — les boss de quartier sont hors de portée trop longtemps** (P(victoire) à PV pleins, cadeau Camelote) : étage 1 → 10 % au N5, 40 % au N6, 87 % au N7 ;
étage 3 → 0 % jusqu'au N7, 22 % au N8. Or l'escalier est gardé par un boss.

**Constat 5 — pistes écartées** : le plancher de pression (10 % des PV max) ne pèse que ~2 points ; baisser les PV OU l'ATQ des mobs de 20 % aux étages 1-3 est
efficace (~−35 % de mortalité au N1) mais équivalent entre les deux, et ne règle pas les élites.

## 2. Décisions de l'utilisateur

**Round 1** : périmètre **étages 1 à 3** (tout s'éteint à l'étage 4) ; **aucune élite avant l'étage 3** (« Convention collective du Donjon ») ; **boss intérimaires
×0,75** PV et ATQ aux étages 1-3 ; options retenues : **Période d'essai** et **Armure de scénario** (écartées : Bonus Premier Sang en XP, Trousse du sponsor).
**Round 2** : élites en **rampe aux étages 3 à 5** (×1,3 / ×1,5 / ×1,65) ; **cible** : un combat ordinaire au N1-N2 de l'étage 1 coûte **≈ 35 % des PV, mort ≤ 5 %** ;
la Période d'essai s'applique à **tous les dégâts directs** (combat, pièges, saignement) ; l'Armure de scénario joue **1 fois par étage 1-3, laisse 1 PV**, aussi contre les boss.

## 3. Les mécanismes (habillage DCC)

| Mécanisme | Règle | Habillage |
|---|---|---|
| **Convention collective du Donjon** | Étages 1-2 : aucune élite (re-tirage du mob tant qu'il dépasse `eliteThreatMultiplier`) ; `eliteDamageMult` ×1,3 à l'étage 3, ×1,5 à l'étage 4, ×1,65 (inchangé) dès le 5 | Le Syndicat des Monstres refuse toute promotion « Employé du Mois » avant l'ancienneté requise ; message à la première élite de l'étage 3 |
| **Remplaçant intérimaire** | Boss de quartier / gardien d'escalier / boss de repaire des étages 1-3 : PV et ATQ ×0,75 (DEF inchangée), nom suffixé « (intérimaire) », `enemy.isInterim`, `baseName` inchangé (sprites) | « Le patron est en congé. Son stagiaire vous accueille. » Récompenses inchangées (la signature reste réservée au Coup de grâce parfait) |
| **Période d'essai** | Dégâts subis × `1 − 0,40 × max(0, (7 − niveau) / 6)` aux étages 1-3 (−40 % au N1, 0 au N7) ; arrêt net à l'arrivée sur l'étage 4 ; dérivée du niveau et de l'étage (aucun état sauvegardé) | Badge `#trial-status`, piques DeathWatch (« les sponsors ont misé sur vous… pour l'instant »), message à l'arrêt |
| **Armure de scénario** | Étages 1-3 : le premier coup mortel de chaque étage laisse 1 PV ; le reste du tour ennemi est absorbé (jamais deux frappes de rafale d'affilée) ; aussi contre les boss | « Le public n'est pas prêt pour que vous mourriez maintenant. » |

Mesure du paquet (élites décalées + Période d'essai ; PV perdus / mort ; gear supposé : Camelote à l'étage 1, Commun à l'étage 2) — amplitude de la Période d'essai :
−30 % → N1 39 % / 6 % ; −35 % → N1 37 % / 6 % ; **−40 % → N1 34 % / 4 %** (cible atteinte, retenu), N2 28 % / 1 %, N3 22 % ; étage 2 N3 24 % ; étage 3 N5 18-21 %.
Boss intérimaire + Période d'essai : étage 1 → 88 % au N5 ; étage 2 → 80 % au N6 ; étage 3 → 68 % au N7, 91 % au N8.

## 4. Plan technique (prêt à coder)

Tout dans `config.earlyGame` (valeurs ci-dessus, une seule table) ; un seul point de lecture par effet ; aucune formule de combat existante modifiée.

- **Lot 0 — outil de calibrage (CODÉ)** : `tests/tools/early-curve.js` (`npm run sim:early [n]`, jamais lancé par la CI, hasard reproductible) mesure avant/après — ordinaires, élites,
  boss ; étages 1-6 ; niveaux 1-10 — et vérifie les deux cibles validées. `config.earlyGame` posé dans `app.js` (valeurs des rounds 1-2, `enabled: true`, **rien ne le lit encore**) ;
  `enabled: false` rendra le jeu d'avant (sert au « avant » de l'outil). L'outil utilise le moteur dès qu'un mécanisme y est branché (`trialDamageMult()`, `eliteDamageMultForFloor()`,
  re-tirage de `generateMob()` : drapeau `engineHandlesFreeFloors`, intérimaire : `engineHandlesInterim`) et le modélise localement sinon — **à basculer à `true` aux lots 1 et 2**.
  Premier test : `tests/regression/early-game.js` (réglages validés + le modèle de joueur de l'outil suit `gainXp()`).
- **Lot 1 — Convention collective (CODÉ)** : `generateMob()` (generator.js) re-tire tant que l'étage ≤ `elites.freeFloors` et que le mob est élite (`threatMultiplier >= eliteThreatMultiplier`, même seuil que
  `isEliteMob()` ; ≤ 20 tentatives) — un seul point couvre tous les chemins (exploration, embuscades, sbires de repaire) ; `eliteDamageMultForFloor(floor)` (pure) lue par `resolveEnemyCounterAttack()` à la place de
  `config.mobDamageScaling.eliteDamageMult` ; **les chasseurs de primes restent sur ×1,65** (leurs stats sont calées dessus). L'outil `sim:early` utilise maintenant le moteur pour ce mécanisme
  (`engineHandlesFreeFloors`). Tests : section « Lot 1 » de `tests/regression/early-game.js` (0 élite sur 3000 mobs aux étages 1 et 2, y compris avec le décalage LABYRINTHE ; elles reviennent à l'étage 3 ; rampe ; chasseur exempt).
  Le message satirique de la première élite à l'étage 3 est reporté au lot 5 (il demande un état sauvegardé).
- **Lot 2 — Remplaçant intérimaire (CODÉ)** : `generateBoss()` (generator.js) applique `earlyInterimBossScale(floor)` (PV et ATQ ×0,75, étages ≤ `maxFloor`) — un seul point couvre le gardien d'escalier, le boss de quartier
  et le boss de repaire (l'étage 3 est urbain) ; `boss.isInterim`, nom suffixé « (intérimaire) », `baseName` inchangé (sprite unique, objet signature), DEF/XP/récompenses inchangées. `initiateCombat()` affiche une réplique
  d'accueil (3 variantes selon la longueur du nom, avec les chiffres exacts). `sim:early` utilise le moteur (`engineHandlesInterim`) : mêmes chiffres que la baseline. Un test existant (`combat-scene.js`, « nom d'origine
  conservé ») a été précisé : `baseName` = nom du boss d'origine, suffixe d'intérim autorisé. Section « Lot 2 » de `tests/regression/early-game.js` (13 quartiers × étages 1-3, étage 4 inchangé, sprite, réplique).
- **Lot 3 — Période d'essai (CODÉ)** : `trialDamageMult(level, floor)` (generator.js, pure) ; `applyTrialToDamage()` (app.js) appliquée avec `applyStarterBuffToDamage()` aux mêmes quatre points d'appel (coup encaissé via
  `companionInterceptHit()`, deux pièges, saignement) ; un coup n'est jamais réduit sous 1 PV. **Facilité des victoires protégée** : `runStats.trialAvoided` (compteur de `createEmptyRunStats()`, complété à 0 pour une ancienne sauvegarde) cumule les PV épargnés ;
  `enemy.runTrack.startTrialAvoided` borne la part de CE combat ; `recordRunEvent('win')` calcule `computeWinEase(hpLost + épargnés)` — vérifié par un test à deux combats identiques (avec/sans) et par mutation. Approximation assumée : un coup en partie absorbé ensuite par le
  compagnon ou le bouclier de mana compte quand même sa part épargnée (la facilité est alors légèrement sous-estimée, jamais surestimée). Badge `#trial-status` (pourcentage courant et règle en infobulle, masqué dès le niveau 7 ou l'étage 4) ; message de fin à l'arrivée sur
  l'étage 4 (une fois, seulement si la protection jouait encore). **Tests** : la réduction est neutralisée par défaut dans `tests/regression/_helpers.js` (11 tests existants mesurent des dégâts exacts au niveau 1) et réactivée par `withTrial()` ; section « Lot 3 » de `early-game.js`
  (courbe, piège, saignement, riposte, cumul avec Foutu pour foutu, facilité, badge, message de fin). `sim:early` utilise le moteur : mêmes chiffres que la baseline.
- **Lot 4 — Armure de scénario (CODÉ)** : `applyPlotArmor()` (app.js) dans `applyPlayerDamage()`, **avant** `applyRaceLastStand()` : un coup mortel aux étages 1-3 laisse `plotArmor.leaveHp` PV, une fois par étage (`gameState.plotArmorFloor`, sauvegardé, ancienne sauvegarde → 0 ;
  ajouté à `resetTransientState()` et `KNOWN_GAMESTATE_KEYS`), boss compris. En combat, le reste du tour ennemi est absorbé (`status.plotShield`, éteint par `tryPlayerAction()` et par chaque remise à zéro des statuts : début/fin de combat, fuite) — hors combat aucun bouclier
  (un second piège du même étage tue). **Ordre avec l'Increvable** : l'Armure passe d'abord (l'Increvable reste donc disponible pour la suite) ; vérifié par test et par mutation (ordre inversé → échec). Au passage, `applyPlayerDamage()` **renvoie les PV réellement perdus** et les deux ripostes de
  combat (mob, `executeBossStrike()`) journalisent ce montant : un coup « de 500 » absorbé affiche « inflige 9 dégâts ». Chronique : `recordRunEvent('plotArmor')` → `runStats.plotArmorUses` (pour les succès du lot 5). **Tests** : interrupteur propre `plotArmor.enabled`, neutralisé par défaut dans
  `_helpers.js` (les tests de mort — Increvable, désamorçage raté — restent valables) et réactivé par `withPlotArmor()` ; section « Lot 4 » de `early-game.js` (piège, étage par étage, coup exactement mortel, paquet coupé, rafale, bouclier éteint, journal, boss, cafard x3). `sim:early` ne la modélise pas
  (mesures par combat à PV pleins) ; `test:long` la joue.
- **Lot 5 — habillage et succès** : piques DeathWatch (thèmes `trial`, `plotArmor` ; l'émission s'ouvre dès l'arrivée à l'étage 2), journal, 1-2 succès satiriques (à proposer), doc.
- **Tests** : nouveau `tests/regression/early-game.js` (pas d'élite aux étages 1-2 sur des milliers de tirages, rampe, intérimaire, courbe de la Période d'essai, arrêt à l'étage 4,
  facilité inchangée, Armure de scénario : 1 fois par étage, reste du tour absorbé, boss compris, interaction Increvable, sauvegarde) ; `npm run test:long` une fois (boucle de combat touchée).
- **Branche** : la même que le chantier 13, `claude/chantier-13-origines` (PR #36, non mergée) — décision de l'utilisateur ; l'Armure de scénario partage son point d'accroche avec l'Increvable du Cafard.

## 5. À surveiller en playtest

- Amplitude et fin de la Période d'essai (−40 % → 0 au N7) : trop généreuse aux étages 2-3 (combats à 13-25 % des PV) ?
- Chasseurs de primes aux étages 1-2 (inchangés, toujours élites) : la prime monte-t-elle toujours aussi vite ?
- Armure de scénario : le suspense du tutoriel survit-il ? Cumul avec Increvable (Cafard) à l'étage 3.
- Étage 3 urbain : gardien d'escalier et boss de repaire intérimaires, routes à 40 % de combats avec élites ×1,3.
- Falaise de l'étage 4 (tout s'éteint d'un coup) : prévoir une rampe de sortie si le passage est trop brutal.

## 6. Baseline du lot 0 (`npm run sim:early`, 3000 mobs et 750 boss par case)

Cases : PV perdus / mort, à PV pleins ; équipement supposé : cadeau Camelote à l'étage 1, Commun à l'étage 2, un peu mieux ensuite. Les mécanismes sont ici **modélisés localement**
(le moteur ne les implémente pas encore) ; les lots 1 à 4 les remplacent par le vrai code et ces chiffres doivent rester identiques.

| Mobs ordinaires, étage 1 | N1 | N2 | N3 | N4 | N5 | N6 |
|---|---|---|---|---|---|---|
| Avant | 53 % / 13 % | 40 % / 5 % | 29 % / 1 % | 22 % / 0 % | 16 % / 0 % | 11 % / 0 % |
| **Après le paquet** | **34 % / 4 %** | 27 % / 0 % | 22 % / 0 % | 17 % / 0 % | 14 % / 0 % | 11 % / 0 % |

Étages 2 et 3, après : N1 37 % / 5 % et 40 % / 6 % ; N3 24 % et 29 %. L'étage 4 est strictement inchangé (arrêt net).
Boss de quartier, P(victoire) — étage 1 : avant 15 % au N5, 83 % au N7 ; **après 84 % au N4, 91 % au N5** ; étage 3 : avant 24 % au N7, 63 % au N8 ; après 58 % au N5, 85 % au N6.
Les deux cibles de l'utilisateur sont atteintes (≈ 35 % des PV et mort ≤ 5 % ; boss de l'étage 1 à ≥ 80 % dès le N5).

**Changement de méthode par rapport à l'exploration** : l'outil dérive les dégâts moyens d'un tour de boss de `config.bossPhases` (phase 1 ≈ 0,97 ; phase 2 ≈ 0,85 ; phase 3 = 1,4)
au lieu des constantes approximatives (0,97 / 1,07 / 1,4) du script d'exploration : les boss sortent un peu plus faciles qu'annoncé au diagnostic (ex. étage 1, avant : 15 % au N5 au lieu de 10 %).

**Constat à surveiller (nouveau)** : les élites restent létales aux étages 3 à 5 malgré la rampe — après le paquet, mort à PV pleins : étage 3 → 63 % au N1, 45 % au N3, 37 % au N4, 22 % au N5 ;
étage 4 → 59 % au N4, 47 % au N5 ; étage 5 → 54 % au N5 (inchangé par rapport à avant). La Convention collective retire la falaise des étages 1-2 mais pas celle des étages 3-5 : à reposer à l'utilisateur
au playtest (rampe plus longue ou plus douce ?).
