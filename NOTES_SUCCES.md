# Notes — Chantier « Chronique de run + succès sarcastiques »

Chantier 2 du registre (`CHANTIERS.md`). Décisions de l'utilisateur : récompense en **boîtes de butin
façon DCC**, succès **par crawler** (dans sa sauvegarde), **35 succès** pour la V1, et un ajout demandé
à la validation : **tout butin trouvé réserve pleine est revendu d'office à 50 % du prix marchand**.

## Revente d'office (réserve pleine)
- `storeLootItem()` est le seul point de passage de tout butin (exploration, combat, boss, objet
  signature, boîte de succès, objets rendus par un compagnon congédié). Réserve d'équipement pleine :
  l'objet n'est plus perdu, il est revendu d'office pour `getOverflowSellPrice()` =
  `LOOT_OVERFLOW_SELL_RATIO` (0,5) × `getSellPrice()` (le prix qu'en donnerait un marchand).
- Les achats en boutique restent refusés réserve pleine (ce n'est pas du butin).

## Chronique de run
- `gameState.runStats` (`createEmptyRunStats()`, achievements.js) : compteurs sur toute la partie —
  victoires (dont boss, élites, mains nues, sort, ouvertes en furtif, en un coup, sans dégât, « à un
  poil »), dégâts subis, fuites, pièges de l'étage, repos, descentes tardives, achats, sorts ratés, sorts
  distincts appris, départs/renvois de compagnon, Camelote offerte, reventes d'office, étage max.
- Un seul point d'entrée : `recordRunEvent(type, data)` (app.js), appelé par les hooks existants
  (`applyPlayerDamage()`, `winCombat()`, `attemptFlee()`, piège, `restAtSafehouse()`, `descendStairs()`,
  `advanceToNextFloor()`, `buyShopItem()`, `attackMagic()` (flop), `storeLootItem()`, fonctions
  compagnon, `equipItem()`, `performExploreStep()`, `gameOver()`, `winGame()`).
- Suivi par combat : `enemy.runTrack` (posé par `initiateCombat()` : dégâts subis au départ, ouverture
  furtive, attaques portées).
- **Indice de domination** (pour le chantier 3, chasseurs de primes) : `computeWinEase(hpLost, maxHp)`
  (1 sans dégât, 0 à partir de 40 % des PV max perdus) sur chaque victoire, gardée dans
  `runStats.recentWins` (10 dernières) ; `computeDominance()` = moyenne (0 sous 3 victoires). Pur,
  testé, pas encore utilisé par le jeu.

## Succès
- Catalogue pur `ACHIEVEMENTS` dans `achievements.js` : `{ id, icon, title, text, tier, secret?,
  posthumous?, check(stats, event, state) }`. Paliers `ACHIEVEMENT_TIERS` (Bronze/Argent/Or).
- `evaluateAchievements()` rejoue chaque condition encore verrouillée à chaque événement (garde
  anti-réentrance : une boîte ouverte émet elle-même des événements). Les succès posthumes ne sont
  évalués qu'à l'événement `death`.
- **Verrou** : aucun succès ne se débloque tant que `gameState.saveEnabled` est faux (initialisation
  silencieuse au chargement, et tous les tests qui ne le demandent pas explicitement — sinon une boîte
  ouverte au hasard fausserait les PO/l'inventaire de tests sans rapport). La chronique, elle, compte
  toujours.
- `gameState.achievements` = `{ [id]: { floor, at } }`, sauvegardé avec le crawler.
- Migration : `restoreSaveForName()` complète `runStats` (`normalizeRunStats()`) et remonte `maxFloor` à
  l'étage courant. Conséquence assumée : un crawler restauré à l'étage 9 débloque d'un coup Touriste,
  Citadin et Spéléologue au premier événement (avec leurs boîtes).

## Boîtes (chiffres validés, `config.achievementBoxes`)
| Boîte | Contenu |
|---|---|
| 🥉 Bronze | 60 % : 10-25 PO × (1 + 0,15 × étage) · 40 % : une potion |
| 🥈 Argent | 50 % : un objet « trésor » (+1 palier) · 30 % : PO × 2 · 20 % : 2 potions |
| 🥇 Or | un objet Rare minimum (source boss) **et** PO × 3 |
Succès posthume : boîte « livrée à titre posthume » (rien n'est donné).

## Affichage
- Annonce non bloquante `#achievement-toast` (3,5 s, `aria-live`), regroupée si plusieurs succès tombent
  au même moment.
- Bouton `#btn-achievements` (« 🏆 Succès X/N », dans l'en-tête, mis à jour par `updateUI()`) → écran
  `#achievements-overlay` (`buildAchievementsListHtml()`, pur) : débloqués d'abord avec leur étage, puis
  verrouillés ; un secret verrouillé reste « ??? ».
- Écrans Game Over et Victoire : `buildRunAchievementsSummary()` liste les succès du crawler.

## Tests
- `tests/regression/achievements.js` : revente d'office, catalogue (47, 6 Or, 4 posthumes ; +7 mini-jeux au chantier 6), domination,
  verrou hors partie, vraie victoire (chronique + succès + boîtes, jamais deux fois), contenu de chaque
  boîte, événements → succès, succès sociaux via les vraies fonctions compagnon, posthumes sans boîte,
  affichage.
- `tests/long_playthrough.js` : la simulation joue désormais en « vraie partie » (succès et boîtes
  actifs), avec des invariants PO / réserve / succès connus à chaque pas.

## À surveiller en playtest
- Les boîtes ajoutent du butin : une quinzaine de succès tombent sur une partie de 7 étages en
  simulation. Si l'économie s'emballe, réduire d'abord `goldBase` ou les chances d'objet.
- La revente d'office rend la réserve pleine moins pénalisante : c'était le but, mais c'est aussi une
  source de PO en plus (une trentaine de reventes par simulation de 7 étages).
