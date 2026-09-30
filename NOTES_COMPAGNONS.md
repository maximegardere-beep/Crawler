# Notes — Chantier « Rework des compagnons »

Chantier 1 du registre (`CHANTIERS.md`). Demande : les compagnons étaient mal intégrés, quasiment
inutiles, et fuyaient trop vite ; exigence ajoutée à la validation : pouvoir leur **donner des objets et
des sorts**. Tous les chiffres vivent dans `config.companions` (app.js) — valeurs de départ, à ajuster
par playtest.

## Diagnostic de départ
- Stats figées quel que soit l'étage (40-59 PV, 8-13 ATQ, 4-7 DEF) ; un niveau ne donnait rien d'autre
  que +15 à +25 % de risque de départ.
- Jet de départ à chaque niveau : ≈ 80 % des compagnons partis au bout d'environ 9 victoires.
- PV jamais rendus ; à 0 PV, perte définitive.
- Effets en valeurs fixes (coup de 3-5 dégâts, soin de 8-15 PV) : négligeables dès l'étage 3-4.
- Spécialité et stats invisibles au moment de recruter.

## Ce qui a changé

### Progression
- `generateCompanionCandidate(floor)` (generator.js) : stats de base × `getFloorScaling(étage)`, le même
  scaling que les mobs. Le crawler hostile (`companionCandidateToMob()`) en profite aussi, avec une XP à
  l'échelle de l'étage.
- Stats = base × (1 + `levelStatGain` (10 %) × (niveau − 1)) — `computeCompanionLevelStats()`, pure.
  +15 XP par victoire, 30 XP pour le niveau 2 puis ×1,3 (inchangé). Les PV gagnés sont aussi rendus.

### Loyauté (remplace `leaveChance`)
- 0-100, départ à 60. Victoire commune +2 ; Sieste ensemble +5, Sommeil +10 ; fuite réussie −5 ; tomber
  à terre −10 ; dons (voir plus bas).
- **Départ uniquement au changement d'étage** (`attemptCompanionDeparture()`, appelée par
  `advanceToNextFloor()`), et seulement sous 40 : chance = (40 − loyauté) × 2 % (`companionDepartureChance()`).
  Message d'alerte dans le journal quand la loyauté passe sous 40, risque affiché sur sa fiche.
- Parti de lui-même, il garde ce qu'on lui a donné.

### Survie
- PV régénérés comme ceux du joueur (`applyTimeElapsedRegen()`, mêmes paliers `HP_REGEN_TIERS`, coupés
  par REPAS_DE_FAMILLE comme pour le joueur).
- Repos en salle sécurisée : même part de SES PV perdus que pour le joueur (Sieste 25 %, Sommeil 100 %).
- À 0 PV : **à terre** (`companion.downed`, `checkCompanionDowned()`) — reste dans le groupe, n'agit plus
  (ni combat, ni bonus hors combat : tout passe par `activeCompanion()`/`hasActiveCompanion()`), ne
  régénère pas ; relevé par un repos ou une potion. Estompé dans la scène de combat.
- Coups encaissés : une seule fonction, `companionInterceptHit()`, utilisée par les mobs ET les boss (les
  deux blocs dupliqués ont disparu). Garde : 40 % de chance de s'interposer ; autres spécialités : 10 %
  (« pris dans la mêlée » — sans ça, armure donnée et soins n'auraient servi qu'à la Garde). Absorbe
  30-60 % du coup ; ce qu'il perd lui-même est réduit de la moitié de sa DEF (armure donnée comprise).

### Effets de spécialité
| Spécialité | En combat | Hors combat |
|---|---|---|
| Frappe d'appoint | coup à chaque attaque du joueur : 35 % de son ATQ effective | +10 % de PO trouvées |
| Garde rapprochée | ½ de sa DEF effective ajoutée à la vôtre + interceptions | −25 % de risque d'embuscade en trajet (`computeAmbushBaseChance()`, les 3 trajets) |
| Premiers secours | 25 % : soin de 6 % de vos PV max (+ 6-11 mana) après une riposte | soin de 4 % de vos PV max après chaque victoire |
| Éclaireur | +10 furtivité, +15 fuite | évite un piège sur deux |

Toutes les spécialités non-Frappe ont un **coup d'opportunité** (25 %, même ratio) — `companionCombatSupport()`.

### Dons (demande explicite)
- Depuis le panneau d'inspection d'un objet de la réserve ou d'un exemplaire du grimoire : action
  « Donner à <nom> » (`companionGiveAction()`). Depuis sa fiche : « Donner [potion] ».
- Arme de mêlée OU à distance → son emplacement arme : ATQ effective = ATQ + dégâts de l'arme
  (`getCompanionAtk()`). Armure → DEF effective (`getCompanionDef()`). Parchemin → son sort : 30 % de
  chance à chaque attaque du joueur de le lancer à la place du coup, pour 60 % de (ATQ + dégâts du
  sort), sans mana ni échec. Les qualificatifs des objets donnés ne s'appliquent pas (V1).
- Potion : soigne le compagnon et le relève s'il est à terre ; refusée s'il est en pleine forme ou si
  elle ne rend pas de PV (aucune potion gâchée).
- L'objet qu'il portait à cet emplacement vous revient (réserve / grimoire) — le compte de la réserve ne
  bouge jamais sur un échange.
- Loyauté par rareté : Camelote +2, Commun +5, Rare +8, Épique +12, Légendaire +18 ; potion +3. Un objet
  ne rapporte de la loyauté **qu'au premier don** (`item.companionGifted`), sinon donner / récupérer /
  redonner le même objet ferait monter la loyauté sans fin.
- Congédier (fiche compagnon, avec confirmation, hors situation bloquante) : il rend arme et armure dans
  la réserve (s'il reste de la place, sinon elles restent sur place) et le sort au grimoire.

### Interface
- Aperçu du candidat dans les deux zones de rencontre (`#companion-info-friendly`/`-hostile`) : nom,
  spécialité, effet, PV/ATQ/DEF.
- `#companion-status-bar` devient un bouton : nom, spécialité, PV (ou « À terre »), barre de loyauté ;
  il ouvre la fiche (`openCompanionSheet()`, dans le panneau d'inspection — `renderInspectActions()` a
  été extrait d'`openItemInspect()` pour ça).

### Sauvegardes
`normalizeCompanion()` (pure) migre un compagnon d'avant le rework : loyauté = 60 − leaveChance/2,
stats de base recalculées pour que ses stats actuelles restent EXACTEMENT les mêmes, équipement vide.

## Tests
- `tests/regression/companions.js` (nouveau domaine) : modèle et scaling, progression, loyauté et
  départ, victoire/fuite, interception et « à terre », repos, régénération, aide en combat, utilités hors
  combat (avec témoin négatif sur le piège), dons et renvoi, départ volontaire, migration.
- `tests/long_playthrough.js` : invariants loyauté/PV/à terre à chaque pas, dons exercés à chaque
  recrutement, et intégration « 30 vraies victoires sans départ, puis départ au changement d'étage à 0 de
  loyauté ».

## À surveiller en playtest
- Le compagnon est désormais nettement plus fort : coup d'opportunité pour tous, interceptions, sort
  donné. Si le jeu devient trop facile avec un compagnon, les premiers leviers sont
  `support.strikeRatio`, `support.opportunisticChance` et `strayHitChance`.
- La loyauté monte vite en jeu normal (+2 par victoire) : un compagnon ne partira que si l'on fuit
  souvent ou qu'on le laisse tomber à terre. C'était l'objectif (« fuient trop vite »), à confirmer.
- Rencontres toujours rares (3 % des tirages d'exploration) : non touché, à rediscuter.

## Hors périmètre (pour plus tard)
- Rencontres plus fréquentes, plusieurs compagnons, ordres donnés au compagnon, compagnon qui trahit.
- Qualificatifs des objets donnés non appliqués au compagnon (V1).
