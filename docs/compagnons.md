# Compagnons

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/companions.js, generator.js (section 3).

- **Compagnons** (chantier « rework des compagnons », voir `NOTES_COMPAGNONS.md`, chiffres dans
  `config.companions`) : 4 spécialités. Stats de base indexées sur l'étage à l'embauche
  (`generateCompanionCandidate(floor)`, même `getFloorScaling()` que les mobs), +10 % par niveau
  (`computeCompanionLevelStats()`, pure — generator.js, section 3, avec `getCompanionAtk()`/
  `getCompanionDef()` = stats + arme/armure données, `companionGiftLoyalty()`,
  `companionDepartureChance()`, `normalizeCompanion()` pour migrer une sauvegarde d'avant le rework).
  **Loyauté** 0-100 (départ 60) au lieu de `leaveChance` : victoire +2, repos partagé +5/+10, fuite −5,
  à terre −10, dons ; **départ uniquement au changement d'étage** (`attemptCompanionDeparture()` dans
  `advanceToNextFloor()`) sous 40 de loyauté, départ pacifique (il garde ses cadeaux). À 0 PV :
  **à terre** (`companion.downed`, `checkCompanionDowned()`), reste dans le groupe mais n'agit plus
  jusqu'à un repos ou une potion — tout effet passe par `activeCompanion()`/`hasActiveCompanion(type)`.
  PV régénérés comme le joueur et rendus au repos. Coups encaissés : `companionInterceptHit()` (seul point,
  mobs et boss). Aide : `companionCombatSupport()` (après chaque attaque du joueur : sort donné, Frappe
  d'appoint, coup d'opportunité), `companionMedicAfterRiposte()`, `onCompanionVictory()` ; hors combat :
  pièges (Éclaireur), PO (Frappe), embuscades (`computeAmbushBaseChance()`, Garde). **Dons** :
  `giveItemToCompanion()`/`giveSpellToCompanion()`/`giveConsumableToCompanion()` (action « Donner à »
  des panneaux d'inspection via `companionGiveAction()`), emplacements `companion.gear` arme (mêlée ou
  distance)/armure/sort, l'ancien objet revient au joueur, loyauté une seule fois par objet
  (`item.companionGifted`). Fiche : `#companion-status-bar` → `openCompanionSheet()` (potion, Congédier
  avec confirmation → `dismissCompanion()`, qui rend les cadeaux).
