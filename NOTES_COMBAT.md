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

Un boss n'est plus "un mob avec plus de PV" : son pattern d'attaque change par palier de PV
(`getBossPhase()`, app.js), via des états/contenus ajoutés au moteur de riposte existant
(`performBossCounterAttack()`, appelée depuis `resolveEnemyCounterAttack()` dès `enemy.isBoss`,
chemin totalement séparé du mob normal/élite pour ne rien changer au Chantier 1) — aucune nouvelle
entité, aucune modélisation spatiale, comme demandé.

**Phases** (`config.bossPhases`, valeurs de départ non issues d'un audit d'équilibrage — à ajuster
par playtest comme le reste des chiffres du jeu) :
- **Phase 1 (100-66% PV)** : attaque de base, avec `phase1TelegraphChance` (30%) de chance par tour
  de télégraphier une attaque lourde à la place d'attaquer (`enemy.status.telegraph = {type:'heavy'}`
  — le tour d'ANNONCE n'inflige AUCUN dégât, message narratif dédié). Le tour suivant, l'attaque
  s'exécute avec `telegraphHeavyMult` (×1.8) sur l'ATQ du boss. C'est le "vrai choix" laissé au
  joueur : défense, esquive (fuite/repositionnement), ou tenter de burst le boss avant l'impact.
- **Phase 2 (66-33% PV)** : reprend le télégraphe lourd (chance réduite, `phase2TelegraphChance`
  18%, la phase étant plus occupée par ses propres patterns) et ajoute trois patterns supplémentaires
  (tirage exclusif) :
  - **Frappe multiple** (`multiStrikeChance` 22%) : 2 ou 3 coups dans le même tour, dégâts par coup
    réduits pour que le total reste lisible (`multiStrikeTotalMult` 1.3 réparti entre les coups).
  - **Harcèlement à distance** (`rangedHarassChance` 15%, `rangedHarassMult` ×0.6) : mécanique
    volontairement MINIMALE ici — un simple coup à dégâts réduits sans logique de distance propre —
    posée comme point de pont pour le futur Chantier 3 ("enrage distance", pas encore implémenté).
    Punit un joueur qui garderait ses distances sans que le Chantier 3 existe encore pour formaliser
    "l'enrage" complet.
  - **Buff de défense télégraphié** ("il se hérisse", `defBuffTelegraphChance` 15%) : même mécanique
    de télégraphe que l'attaque lourde (tour d'annonce sans dégât), mais pose
    `enemy.status.defBuffed` au lieu de frapper — DEF effective du boss ×`defBuffMult` (1.6) pendant
    `defBuffRounds` (2) tours, lu symétriquement aux réductions ébloui/corrodé déjà existantes dans
    `performPlayerAttack()`. "Frapper maintenant ou subir une garde relevée."
- **Phase 3 (<33% PV, "phase de folie")** : plus de télégraphe (le boss cesse d'être tactique) —
  dégâts fixes `phase3.atkMult` (+40%) et DEF effective fixe `phase3.defMult` (-30%, lue
  symétriquement dans `performPlayerAttack()` via `enemy.status.frenzied`). La défense réduite EST la
  fenêtre risque/récompense demandée par la consigne : le joueur encaisse plus par coup, mais peut
  aussi faire tomber le boss bien plus vite tant qu'il tient le choc — pas de mécanique d'échange
  séparée, cette lecture est documentée ici faute d'avoir été précisée davantage par la consigne
  d'origine.

**Bug de conception détecté et corrigé EN COURS DE CHANTIER** (pas un simple écart signalé — un vrai
recouvrement entre deux mécaniques du même chantier, corrigé directement) : le plancher de pression du
Chantier 1 (`pressureFloorFrac`, "≥10% des PV max joueur par ATTAQUE") suppose implicitement qu'une
attaque = un tour de boss. Le multi-coups de phase 2 fractionne un tour en plusieurs frappes ; sans
correctif, CHAQUE frappe redéclenchait indépendamment ce plancher ABSOLU, le multipliant par le nombre
de coups (~10%/tour prévu -> ~30%/tour mesuré en test avec 3 frappes). Corrigé en répartissant le
plancher entre les frappes du tour (`executeBossStrike(..., pressureFloorOverride)`) plutôt qu'en
laissant chaque frappe le redéclencher : la SOMME sur le tour reste le plancher standard d'un tour de
boss, cohérent avec l'intention du Chantier 1.

**Récompenses de boss** (implémenté avant le reste du chantier 2, déjà en place) :
`config.bossRewards.minRarityKey` ('epique') plancher la rareté du loot aléatoire garanti d'un boss
(`rollRarity()`/`generateItem()`/`generateSpellScroll()`, plombé optionnellement via `addLoot()`) ;
`awardBossSignatureItem()` attache en plus un objet signature LÉGENDAIRE unique par boss
(`bestiary.js`, `districtBosses.*.signatureItem`, cloné frais à chaque victoire — jamais le même
objet muté) — garanti à chaque victoire sur CE boss précis, pas un "une fois par partie".

**Hors périmètre, non implémenté ici** : le compteur de kiting du boss "démarre à 1" (voir consigne
du Chantier 3) — aucun champ de compteur de kiting n'existe encore nulle part dans le moteur, le
Chantier 3 doit l'introduire en premier ; ce chantier 2 ne fait qu'y préparer un point de pont
narratif (harcèlement à distance ci-dessus), sans rien câbler de réel dessus.

## Chantier 3 — Enrage distance et engagement

## Chantier 3 — Enrage distance et engagement

_À compléter._
