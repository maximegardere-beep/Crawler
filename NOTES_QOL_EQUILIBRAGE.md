# Notes — Chantier "QoL/équilibrage"

Cinq chantiers issus d'un playtest, indépendants les uns des autres : salles sécurisées, réserve
d'équipement, parité magie/arme, économie urbaine, budget temps par étage. Voir CLAUDE.md pour le
résumé côté architecture ; ce fichier détaille le raisonnement et les valeurs retenues, chantier par
chantier, au fil de l'implémentation.

## Chantier A — Salle sécurisée à choix

**Problème** : le soin (15-34 PV) était automatique à l'entrée d'une salle sécurisée, sans coût de
temps direct — mais le coût de temps *dérivé* (`ceil(missingHp/10) + ceil(missingMana/12)`) pouvait
suffire, à lui seul, à amener `gameState.timeLeft` à 0 et déclencher `gameOver(true)` **alors même
que le joueur n'avait rien décidé** : une salle censée être un point de répit pouvait tuer par
surprise.

**Solution retenue** : entrée à choix explicite, même famille UI que `#boss-choice-zone`.
- `config.safehouse = { restCost: 2, restHpMin: 25, restHpMax: 40 }` — valeurs de départ, à ajuster
  par playtest.
- `enterRoom()` ne soigne plus rien : pose `gameState.safehouseChoicePending`/
  `pendingSafehouseRoomId`, log de découverte (sans soin), enregistre le lieu connu (comportement
  conservé, indépendant de l'issue du choix), affiche `#safehouse-choice-zone`.
- `restAtSafehouse()` : coûte `restCost` (2H, sauf REPAS_DE_FAMILLE — anomalies.js, séjour gratuit
  en temps), soigne un montant PV tiré dans `[restHpMin, restHpMax]`, et restaure du mana au
  **même montant** (clampé séparément à `maxMana`) si un sort est équipé — "même échelle" au sens où
  c'est le même tirage aléatoire appliqué aux deux jauges, pas une formule séparée.
- `leaveSafehouse()` : gratuit, aucun effet — la salle reste un lieu connu réutilisable (déjà
  enregistré à l'entrée, pas seulement au repos).
- **Garde-fou double** : le bouton Repos est désactivé dès l'affichage (`ui.btnRestSafehouse.disabled`)
  si `timeLeft - restCost <= 0`, ET `restAtSafehouse()` refait la même vérification en interne avant
  d'agir (no-op si jamais appelée malgré un bouton désactivé — défense en profondeur, pas un chemin
  normal). Résultat : structurellement, plus aucun `gameOver(true)` ne peut provenir d'une salle
  sécurisée.

**Écart au texte de la mission** : le texte proposait de calculer `restCost` dynamiquement à partir
des PV/mana manquants (comme l'ancien système), mais avec un montant de soin fixe par palier —
finalement un coût **fixe** (2H) a été préféré à un coût variable, pour deux raisons : (1) c'est ce
que demande explicitement le critère d'acceptation final ("le repos coûte 2H"), (2) un coût variable
aurait redemandé la même classe de calcul "combien de temps ce soin va-t-il coûter" que le bug
d'origine, avec le même risque de complexité inutile pour un gain de réalisme marginal.

**Tests** : nouveau domaine `tests/regression/safehouses.js` (ajouté à `regression.test.js`) — entrée
sans soin auto, coût/soin de `restAtSafehouse()` dans la fourchette attendue, mana restauré à la même
échelle, `leaveSafehouse()` gratuit et sans effet, garde-fou (bouton désactivé + no-op protégé, jamais
de Game Over), REPAS_DE_FAMILLE rend le repos gratuit et ignore le garde-fou. `tests/long_playthrough.js`
: nouvelle branche d'auto-résolution (alterne repos/repartir), compteur `safehouseEncounters` dans le
résumé final (13 sur la dernière simulation de validation, aucun blocage constaté).

---

## Chantier B — Réserve d'équipement 5 → 8

**Problème** : la limite de 5 objets d'équipement (armes/armures/armes à distance — consommables et
parchemins déjà hors quota) était en dur sur `gameState.maxInventory`, sans point de config.

**Solution retenue** : `config.inventory.maxEquipment = 8` (valeur de départ, à ajuster par
playtest), avec `gameState.maxInventory` conservé comme simple alias pour ne rien casser des
appelants existants (`addLoot()`, `awardBossSignatureItem()`, `buyShopItem()` — tous lisaient déjà
`gameState.maxInventory` dynamiquement, aucun n'avait la valeur `5` en dur). Contrainte d'ordre de
déclaration : `gameState` est déclaré avant `config` dans `app.js`, donc l'alias ne peut pas être posé
dans le littéral de `gameState` lui-même — il est assigné juste après la fermeture de l'objet
`config` (`gameState.maxInventory = config.inventory.maxEquipment;`), avant tout code de jeu.

**Tests** : aucun nouveau test nécessaire — la suite existante (`urban-shops.js`, `floor-transition.js`)
paramétrait déjà ses boucles sur `gameState.maxInventory` plutôt que sur la valeur `5` en dur, donc le
changement passe sans modification (`npm test` : 2175 tests OK après ce chantier).

## Chantier C — Parité magie/arme

_À compléter._

## Chantier D — Économie : marchand/professeur garantis + vente des parchemins

_À compléter._

## Chantier E — Budget temps par étage + alerte escalier

_À compléter._
