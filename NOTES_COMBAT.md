# Notes — Rework combat (scaling dégâts, boss, gestion de la distance)

Valeurs appliquées et écarts signalés pour les trois chantiers du rework combat. Chaque chantier a son
propre commit ; ce fichier est mis à jour au fil de l'implémentation, pas réécrit à la fin.

## Chantier 1 — Scaling des dégâts des mobs

Valeurs appliquées (`config.mobDamageScaling`, `app.js`) :
- `perFloor: 0.12`, `perMobLevel: 0.03` — formule `dégâts_mob = base × (1 + 0.12×étage) × (1 +
  0.03×niveau_mob)`, remplace l'ancien `floorScaling.atk` (scaling ATQ linéaire par PROFONDEUR) pour
  les mobs. hp/def/xp des mobs restent sur l'ancien scaling linéaire (hors périmètre de ce chantier).
- `pressureFloorFrac: 0.10` — un mob inflige toujours au moins 10% des PV max du joueur par attaque,
  calculé sur les dégâts BRUTS avant mitigation (`rollDamage()`, `options.pressureFloor`).
- `minMitigation: 0.35` — la défense ne peut jamais faire descendre la mitigation sous 35% des dégâts
  bruts (`rollDamage()`, `options.minMitigation`).
- `eliteDamageMult: 1.65` — mobs élites (`isEliteMob()`), appliqué à l'ATQ effective avant
  `rollDamage()` (`resolveEnemyCounterAttack()`), en plus du scaling par étage.

**Interprétation retenue pour "niveau_mob"** : aucun champ de niveau n'existe sur les mobs dans ce
moteur (ils scalent par ÉTAGE, pas par niveau propre — voir `getMobLevelEquivalent()` dans app.js,
même principe déjà utilisé pour la nécrologie). `niveau_mob` reprend donc l'étage courant comme proxy,
comme `getMobLevelEquivalent()` le fait déjà ailleurs. La formule appliquée est donc, en pratique,
`base × (1 + 0.12×étage) × (1 + 0.03×étage)`.

**Écart signalé — critère d'acceptation NON atteint** (« un joueur optimal à l'étage 20 doit perdre
entre 25% et 35% de ses PV par combat ») :

Mesuré par simulation Monte Carlo (voir `tests/regression/combat-scaling.js`, joueur "à niveau" =
niveau 20 à l'étage 20, stats de base sans équipement, contre un mob typique non-élite de l'étage 20,
150 combats simulés avec le moteur de dégâts réel) : **~10-20% de PV perdus par combat, PAS 25-35%.**

Cause identifiée : ce chantier ne touche QUE le scaling des DÉGÂTS des mobs (consigne explicite du
chantier). Ni le scaling des PV des mobs (resté linéaire par profondeur, `floorScaling.hp`), ni la
courbe de progression ATQ du joueur (`gainXp()`, non touchée) ne changent. Un joueur "à niveau"
atteint un ATQ qui tue le mob typique en 2-3 tours — trop rapide pour que le nouveau taux de dégâts
par coup s'accumule jusqu'à 25-35% du total sur l'ensemble du combat. Corriger ce point demanderait de
toucher le scaling des PV mobs et/ou la courbe de progression du joueur, explicitement **hors
périmètre** de ce chantier ("ne modifie pas d'autres mécaniques déjà traitées par ailleurs" / "ne
réécris pas le moteur de combat"). Signalé ici plutôt que corrigé unilatéralement, comme demandé par
la consigne.

**Anomalie secondaire observée** (non corrigée, simple constat) : dans la même simulation, un mob
ÉLITE (modificateurs aléatoires + `eliteDamageMult`) inflige en moyenne un peu MOINS de dégâts totaux
qu'un mob normal dans cet échantillon (~5% contre ~14%). Cause probable : `isEliteMob()` se base sur
`threatMultiplier`, qui pondère PV/DEF autant que l'ATQ (voir `computeThreatMultiplier()` dans
`generator.js`) — un mob peut donc devenir "élite" via un modificateur qui gonfle surtout ses PV/DEF
sans gonfler son ATQ, ce qui allonge le combat sans forcément augmenter les dégâts subis par coup.
Signalé pour information, non corrigé (touche `computeThreatMultiplier()`/`generateMob()`, hors
périmètre de ce chantier qui porte sur la formule de dégâts, pas sur la sélection des modificateurs).

## Chantier 2 — Rework des boss

_À compléter._

## Chantier 3 — Enrage distance et engagement

_À compléter._
