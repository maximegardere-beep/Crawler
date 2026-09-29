# Notes — Chantier « Émission DeathWatch »

Chantier 4 du registre (`CHANTIERS.md`). Demande : une émission au changement d'étage où le
commentateur reprend des éléments de la partie et envoie des piques ; plusieurs réponses plus ou moins
provocatrices, avec un jet de dés — plus c'est risqué, plus la récompense est grosse, et plus l'échec
fait mal. Décisions de l'utilisateur : **à chaque étage dès le 2**, **tableau de réponses validé tel
quel**, **un seul présentateur** pour la V1.

## Déroulé
- `advanceToNextFloor()` capture le bilan de l'étage qui vient de finir (`floorStats` + pièges) AVANT sa
  remise à zéro, puis ouvre l'émission (`triggerShow()`) à l'arrivée — ou la met en attente
  (`gameState.pendingShowAfterPact`) si le Pacte du Crawler vient d'être proposé : `choosePactBlessing()`
  l'ouvre juste après. Jamais deux choix bloquants à l'écran.
- **Seulement dans une vraie partie** (`gameState.saveEnabled`, comme les succès) : jamais pendant
  l'initialisation silencieuse, jamais dans les tests qui ne la demandent pas (sinon chaque test qui
  change d'étage resterait bloqué dessus).
- `gameState.showChoicePending` (dans `isActionBlocked()`) + `gameState.pendingShow` (`{ tauntId, text,
  replies }`). Une restauration de sauvegarde abandonne l'émission en cours (on atterrit toujours sur
  l'exploration).

## Catalogue (`deathwatch.js`, pur)
- Présentateur `SHOW_HOST` : Chip Brillantine.
- 31 piques à trous (`SHOW_TAUNTS`) avec leur déclencheur `when(ctx)` : fuites, gros dégâts, PV bas, étage
  trop facile, pièges, sorts ratés, objet ridicule porté, compagnon (présent, à terre, parti), prime,
  argent, succès, niveau, mains nues — plus 5 génériques de repli. `pickShowTaunt()` préfère une pique
  dont le déclencheur correspond à la partie. Contexte construit par `buildShowContext()` (app.js).
- 5 répliques par ton (`SHOW_REPLIES`, une tirée par émission et affichée sur le bouton) et les réactions
  du présentateur par issue (`SHOW_REACTIONS`).

## Réponses (`config.show`, chiffres validés)
Jet **d20 + popularité** (+1 par tranche de 5 succès débloqués) contre le seuil du ton :
| Réponse | Jet | Réussite | Échec |
|---|---|---|---|
| 😇 Poli(e) | aucun | la moitié des PO d'une boîte Bronze | — |
| 😏 Pique en retour | ≥ 8 | boîte Bronze | −2 H (jamais sous 1 H : une émission ne tue pas) |
| 😈 Provocation | ≥ 12 | boîte Argent | combat immédiat contre un mob à deux modificateurs (élite) |
| 🤬 Insulte en direct | ≥ 16 | boîte Or | +20 de prime et un chasseur de primes aussitôt |
| 🔇 Refuser | — | — | — (le public boude) |
Les boîtes sont celles des succès (`openAchievementBox()`), les sanctions réutilisent `initiateCombat()`,
`generateMob(…, eliteBonus)`, `addBounty()` et `spawnBountyHunter()`. Chaque bouton affiche sa réplique
et son enjeu (`describeShowStake()`).

## Présentation
- Vignette `showStudio` (scene.js) : enseigne `onAirSign` « EN DIRECT », `applauseMeter`, drone caméra et
  le présentateur `SCENE_HOST_SVG` (sprites/npcs.js), micro tendu vers le crawler, sur le décor du
  quartier (le plateau vient à vous).
- Zone `#show-zone` sous la scène : présentateur, pique, popularité, 4 réponses + Refuser.
- 2 succès (40 au total) : « Chouchou du public » (réussir l'insulte en direct, Argent) et « Interdit
  d'antenne » (3 refus, Bronze, secret) — compteurs `runStats.showInsultWins` / `showRefusals`.

## Tests
- `tests/regression/deathwatch.js` : catalogue (taille, génériques, répliques, réactions, trous tous
  fournis), choix de la pique selon la partie, contexte, déclenchement (vraie partie seulement, après le
  Pacte), chaque réponse (succès et échec, temps jamais mortel), popularité, succès, présentation.
- `tests/long_playthrough.js` : l'auto-résolveur fait tourner les 5 réponses (Poli seulement sur l'étage
  final) ; ~6 émissions par simulation.

## À surveiller en playtest
- La réponse Poli est toujours rentable (PO sans risque) : si tout le monde la choisit, la rendre
  plus maigre ou la remplacer par un simple bonus de popularité.
- L'Insulte ratée lance un chasseur calé sur le joueur ET monte la prime de 20 : c'est la sanction la
  plus lourde du jeu hors boss, voulue ainsi par le tableau validé.
- Un seul présentateur : les piques peuvent se répéter sur une longue partie (31 piques, dont ~5
  génériques) ; d'autres émissions sont prévues plus tard.
