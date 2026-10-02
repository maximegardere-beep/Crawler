# Buff de départ, progression (XP), régénération passive

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/progression.js, engine/origins-effects.js, engine/events.js.

- **Buff de départ « Foutu pour foutu »** (chantier 14, voir `CHANTIERS.md`, chiffres dans `config.starterBuff`) : `gameState.starterBuff` (`null | 'desperate' | 'boxer'`,
  sauvegardé). `revealWelcomeGift()` pose `'desperate'` pour un cadeau Armure ou Rien (22 % des départs) : +5 % de dégâts subis (`applyStarterBuffToDamage()` :
  `companionInterceptHit()`, pièges, saignement) et dégâts ×2 à mains nues (`starterBuffUnarmedMult()` : attaque Mains nues, Étrangler, Charge sans arme). Il saute à
  l'ÉQUIPEMENT d'une arme, d'une arme à distance ou d'un sort (`endStarterBuff()` dans `equipItem()`/`equipSpell()`, jamais l'armure, jamais un simple ramassage ni un don à
  un compagnon) et ne revient pas. Encore actif à l'arrivée sur l'étage 2 (`evolveStarterBuff()` dans `advanceToNextFloor()`), il devient `'boxer'` : sans malus, mains nues
  ×1,25, définitif. Badge `#starter-buff-status`. Une ancienne sauvegarde sans le champ n'est jamais rétro-activée.
- **Progression** : `gainXp()` — `xpToNextLevel` croît ×1.25 par niveau (jusqu'ici ×1.4, resserré pour
  éviter le mur de fin de run où les niveaux cessent de tomber pendant que les mobs continuent de
  grimper). Gains à chaque niveau : PV max +15 (fixe), ATQ `2 + floor(niveau/4)`, DEF
  `1 + floor(niveau/5)` (croissants avec le niveau ATTEINT, pour rester au niveau des mobs en fin de run).
- **Régénération passive (PV/mana)** : `applyTimeElapsedRegen(hours)` — PV **dégressif** selon le %
  de PV déjà restants (`HP_REGEN_TIERS` : 10/h sous 50%, 4/h entre 50-80%, 1/h au-delà — un vrai filet
  de sécurité en dessous, un simple filet d'eau au-delà), mana à **12/h** (seulement si un sort est
  équipé). Une salle sécurisée reste le seul moyen fiable de repartir plein PV/mana (Sommeil
  réparateur, 8H, voir `restAtSafehouse()`). Appliqué
  à chaque fois que `gameState.timeLeft` diminue pour une raison "normale" (`performExploreStep()`,
  `travelToRoom()`, `autoTravelToNearestFrontier()`) — jamais sur la perte de temps punitive du piège "Contretemps", qui
  perdrait sinon son sens.
