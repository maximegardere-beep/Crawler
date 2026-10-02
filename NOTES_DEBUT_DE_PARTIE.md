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

- **Lot 0 — outil de calibrage** : `tests/tools/early-curve.js` (`npm run sim:early`, jamais lancé par la CI) — reprend les scripts d'exploration, mesure avant/après
  (ordinaires, élites, boss ; étages 1-6 ; niveaux 1-11). `config.earlyGame` posé avec les valeurs ; baseline enregistrée dans ce fichier.
- **Lot 1 — Convention collective** : `generateMob()` (generator.js) re-tire tant que l'étage ≤ `elites.freeFloors` et que le mob est élite (≤ 20 tentatives) ;
  `eliteDamageMultForFloor(floor)` (pure) lue par `resolveEnemyCounterAttack()` à la place de `config.mobDamageScaling.eliteDamageMult` ; les chasseurs de primes
  (toujours élites, calés sur le joueur) restent inchangés.
- **Lot 2 — Remplaçant intérimaire** : `generateBoss()` applique `interimBoss` à l'étage ≤ 3 (gardien d'escalier, boss de quartier, boss de repaire — l'étage 3 est urbain) ;
  suffixe de nom, `isInterim`, ligne de journal à l'entrée en combat.
- **Lot 3 — Période d'essai** : `trialDamageMult()` (pure, étage + niveau) appliquée avec `applyStarterBuffToDamage()` aux MÊMES points d'appel
  (`companionInterceptHit()`, pièges, saignement) pour que le journal et les PV restent d'accord. **Ne doit pas gonfler la facilité des victoires** (`computeWinEase()` lit les
  PV perdus : sans correctif, la prime des chasseurs monterait trop vite) → compteur des PV épargnés réajouté au calcul. Badge `#trial-status` (infobulle), message d'arrêt à l'étage 4.
- **Lot 4 — Armure de scénario** : fonction sœur de `applyRaceLastStand()` dans `applyPlayerDamage()` (ordre : scénario d'abord, Increvable ensuite ; à 1 PV aucun des deux ne rejoue) ;
  `gameState.plotArmorFloor` (sauvegardé, ancienne sauvegarde → 0) ; `gameState.status.plotShield` (reste du tour ennemi absorbé, remis à faux par `tryPlayerAction()`) ;
  à ajouter à `resetTransientState()` et `KNOWN_GAMESTATE_KEYS` ; `recordRunEvent('plotArmor')`.
- **Lot 5 — habillage et succès** : piques DeathWatch (thèmes `trial`, `plotArmor` ; l'émission s'ouvre dès l'arrivée à l'étage 2), journal, 1-2 succès satiriques (à proposer), doc.
- **Tests** : nouveau `tests/regression/early-game.js` (pas d'élite aux étages 1-2 sur des milliers de tirages, rampe, intérimaire, courbe de la Période d'essai, arrêt à l'étage 4,
  facilité inchangée, Armure de scénario : 1 fois par étage, reste du tour absorbé, boss compris, interaction Increvable, sauvegarde) ; `npm run test:long` une fois (boucle de combat touchée).
- **Branche** : empilée sur `claude/chantier-13-origines` (l'Armure de scénario partage son point d'accroche avec l'Increvable) ; à rebaser sur `main` une fois la PR #36 mergée.

## 5. À surveiller en playtest

- Amplitude et fin de la Période d'essai (−40 % → 0 au N7) : trop généreuse aux étages 2-3 (combats à 13-25 % des PV) ?
- Chasseurs de primes aux étages 1-2 (inchangés, toujours élites) : la prime monte-t-elle toujours aussi vite ?
- Armure de scénario : le suspense du tutoriel survit-il ? Cumul avec Increvable (Cafard) à l'étage 3.
- Étage 3 urbain : gardien d'escalier et boss de repaire intérimaires, routes à 40 % de combats avec élites ×1,3.
- Falaise de l'étage 4 (tout s'éteint d'un coup) : prévoir une rampe de sortie si le passage est trop brutal.
