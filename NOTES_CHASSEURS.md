# Notes — Chantier « Chasseurs de primes gobelins »

Chantier 3 du registre (`CHANTIERS.md`). Demande : des gobelins chasseurs de primes traquent les
crawlers qui tuent beaucoup de mobs facilement (anti-snowball). Décisions de l'utilisateur : force
**calée sur le joueur**, prime qui ne retombe **qu'en tuant un chasseur**, **aucune esquive furtive et
fuite une fois sur deux**. Chiffres validés, tous dans `config.bounty` (app.js).

## Prime
- `gameState.bounty = { value, huntersKilled, combatsSinceHunter }` (sauvegardé ; complété par
  `createEmptyBounty()` pour une ancienne sauvegarde).
- Monte après chaque victoire selon sa facilité (déjà calculée par la chronique du chantier 2,
  `computeWinEase()`) : ≥ 0,8 → +8 ; ≥ 0,5 → +3 ; sinon rien. Fuite réussie devant un chasseur : +10.
  Plafond 100. `addBounty()` est le seul point de modification (alerte + vignette « Avis de recherche »
  au franchissement d'un palier, événement de chronique pour les succès, badge).
- Paliers (`getBountyTier()`) : 30 avis de recherche · 60 chasseurs · 90 escouade.
- Ne retombe à 0 qu'en tuant un chasseur (`onBountyVictory()`).

## Chasseurs
- Catalogue `bountyHunters` (bestiary.js, hors `baseMobs` : jamais tirés par un quartier) : Pisteur (à
  distance, −10 % PV), Cogneur (+15 % ATQ, −10 % DEF), Chef d'escouade (+30 % PV, seulement en escouade).
- **Stats calées sur le joueur** : `computeBountyHunterStats(player, variant, tuning, damage)` (pure,
  generator.js) à partir de `getPlayerCombatProfile()` (PV max, meilleure ATQ effective parmi arme / arme
  à distance / sort, DEF effective) :
  - DEF = 35 % de votre meilleure ATQ ;
  - PV = 4 de vos coups (votre coup moyen contre cette DEF) ;
  - ATQ = de quoi vous prendre ~9 % de vos PV max par coup, en inversant la formule de `rollDamage()`
    (plancher de mitigation `minMitigation` et bonus d'élite `eliteDamageMult` compris) — ≈ 30-40 % de
    vos PV sur le combat, que vous soyez en retard ou très en avance sur l'étage.
- `generateBountyHunter()` : toujours élite (💀, `threatMultiplier` au seuil), `isBountyHunter`, prime
  réclamée mémorisée (`bountyValue`), XP comme un élite de l'étage.
- Apparition (`maybeSpawnBountyHunter()`) : dès 60, 10 % des combats d'exploration
  (`handleStealthEncounter()`, AVANT le jet de détection : aucune esquive) et des embuscades de trajet
  (lieux connus et villes) ; 20 % dès 90 ; jamais à moins de 3 victoires du précédent. À 90+, un Chef
  d'escouade suit (`gameState.pendingBountySquad`), enchaîné par `winCombat()` avant toute suite de trajet.

## Issues
- Chasseur tué : PO = prime réclamée × étage × 2, un objet de rang élite (le butin normal de 40 % ne
  s'ajoute pas), prime remise à 0. Un Chef d'escouade réclame la même prime (deux récompenses pour une
  escouade entière).
- Fuite : 50 % fixe (l'Éclaireur n'aide pas), prime +10, escouade dispersée.
- Mort : épitaphe dédiée (`EPITAPH_TEMPLATES.chasseurPrime`, pool spécial comme `mobFaible`).

## Présentation
- Badge `#bounty-status` (🎯 + valeur, couleur par palier, explication en infobulle) dans l'en-tête.
- Vignette `wantedPoster` (scene.js) + accessoire `wantedPoster` (backdrops.js) : l'affiche « RECHERCHÉ,
  MORT OU VIF, PRIME N », affichée au franchissement d'un palier.
- Sprites : un détail signature par variante dans `sprites/mob-details-b.js` (chapeau, étoile de shérif,
  longue-vue / gourdin / porte-voix), sur la silhouette `goblinoid`. `combat-scene.js` exige un détail
  pour chaque chasseur.
- 3 succès (38 au total) : « Tête mise à prix » (60, Bronze), « Ennemi public n°1 » (90, Argent),
  « Chasseur chassé » (3 chasseurs, Argent) — compteurs `runStats.maxBounty` / `huntersKilled`.

## Tests
- `tests/regression/bounty.js` : stats calées sur le joueur (faible et fort), génération et variantes,
  gains et paliers, apparition (seuils, écart, escouade), vraie victoire (récompense, remise à 0, un seul
  objet), escouade enchaînée, fuite (50 %, Éclaireur sans effet, +10), épitaphe, vignette, succès.
- `tests/long_playthrough.js` : invariant de bornes de la prime, chasseurs tués comptés dans le résumé.

## À surveiller en playtest
- La prime monte vite pour un crawler qui écrase tout (8 victoires faciles → 64) : c'est voulu, mais
  si les chasseurs deviennent trop fréquents, baisser d'abord `gainEasy` ou `encounterChance`.
- Dans la simulation longue (crawler volontairement surarmé), la prime atteint 100 à chaque partie et
  0 à 2 chasseurs sont tués sur 7 étages.
- Le calibrage vise ~9 % des PV par coup ; les boucliers temporaires (Garde du compagnon, statuts)
  réduisent encore ce chiffre, un chasseur peut donc paraître un peu mou avec un compagnon Garde.
