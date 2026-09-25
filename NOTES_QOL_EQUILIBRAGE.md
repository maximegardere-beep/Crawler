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

**Écart avec l'énoncé d'origine (constaté pendant l'EXPLORE, pas corrigé silencieusement)** : la
mission suppose un point de départ `atkMultiplier ×1.4`/`backfire 15%` — ce n'était déjà plus le cas :
un chantier antérieur ("Issue 6") avait déjà réduit ces valeurs à `×1.25`/`backfire 15% base, plancher
8%`. J'ai suivi les valeurs CIBLES explicitement données par la mission pour `config.magicBalance`
(`atkBase: 1.1`, `backfireMin: 3`, etc.) telles quelles plutôt que de les recalculer à partir de l'état
réel — ce sont des instructions explicites de l'utilisateur, pas une extrapolation de ma part.

**Mesure de parité** (moyenne des `baseDmg` de base, AVANT scaling de rareté, sur les catégories
mêlée/distance séparément) :
- Armes mêlée (hors objets blague) : moyenne ≈13.2. Sorts mêlée (avant ce chantier) : moyenne ≈10.25.
- Armes distance : moyenne ≈14.4. Sorts distance (avant ce chantier) : moyenne ≈14.

À `atkMultiplier` arme 1.0 vs sort 1.1 (`config.magicBalance.atkBase`), et `gameState.atk` de base 10 :
- Mêlée : `(10+13.2)×1.0=23.2` (arme) vs `(10+10.25)×1.1=22.275` (sort) → sort ~4% SOUS l'arme.
- Distance : `(10+14.4)×1.0=24.4` (arme) vs `(10+14)×1.1=26.4` (sort) → sort ~8% AU-DESSUS de l'arme.

Les deux étaient déjà dans la tolérance ±15% demandée par la mission, mais j'ai resserré les deux vers
la parité exacte plutôt que de m'arrêter là :
- Sorts mêlée relevés : Toucher Électrique 9→10, Poing de Glace 11→12, Paume Brûlante 8→9, Lame
  Spectrale 13→14 (`spells.js`).
- Sorts distance légèrement abaissés : Foudre 15→14, Boule d'Acide 12→11, Projectile de Glace 10→9,
  Météore Miniature 19→18.
- `manaCost` réajusté pour chaque sort afin de garder le ratio `manaCost/baseDmg` dans la fourchette
  ~1.2-1.6 déjà en place (ex. Toucher Électrique 12→13, Météore Miniature 30→28).

**`attackMagic()`** (`app.js`) : les constantes en dur (`15 - 1.5×(niveau-1)` plancher 8%, `1.25 +
0.02×(niveau-1)`) sont remplacées par des lectures de `config.magicBalance` — mêmes formes de formule
(plancher/pente linéaire par niveau), seuls les paramètres changent.

**Tests** : nouveau `tests/regression/magic-balance.js` — compare `effectiveAtk = (atk + bonus) ×
atkMultiplier` (le point d'entrée commun à `rollDamage()`, AVANT mitigation/variance qui sont
identiques des deux côtés) entre arme et sort, aux tiers Commun ET Épique, sur les deux catégories ;
assert `|écart| ≤ 15%`. Second bloc : dégâts cumulés sur un budget de mana complet (100, `Toucher
Électrique` à 13 mana → 7 lancers) vs le même nombre de coups d'arme — ratio attendu entre 0.5 et 1.15
(le mana limite le NOMBRE de sorts, pas un multiplicateur de dégâts en plus). `tests/regression/balance.js`
(bloc "attackMagic() (6)", écrit pour l'ancien plancher 8%) mis à jour pour refléter le nouveau
plancher 3% — un tirage à 7.5% (sous l'ancien plancher, au-dessus du nouveau) ne backfire plus, un
tirage à 2.5% (sous le nouveau plancher) backfire toujours, même à très haut niveau. `tests/regression/magic.js`
(valeurs exactes de `generateSpellScroll()` pour "Toucher Électrique") mis à jour avec les nouvelles
valeurs de base (9→10, 12→13). `npm test` : 2261 tests OK, `npm run test:long` : aucune régression
(14 salles sécurisées, 3 boutiques, run complet jusqu'à la victoire finale simulée).

**Écart au texte de la mission (2)** : la note de documentation a été consolidée ici
(`NOTES_QOL_EQUILIBRAGE.md`) plutôt que dans une nouvelle section de `NOTES_COMBAT.md` comme suggéré
initialement — tous les autres chantiers de cette même mission (A/B/D/E) documentent déjà ici, séparer
uniquement celui-ci aurait fragmenté la lecture d'une mission par ailleurs cohérente.

## Chantier D — Économie : marchand/professeur garantis + vente des parchemins

**Problème 1** : `specializedCityChance` (18%) tiré indépendamment par ville normale d'un étage
urbain — purement probabiliste, un étage urbain pouvait donc n'avoir ni marchand ni professeur.

**Problème 2 (trouvé en explorant le code, pas dans l'énoncé d'origine)** : `generateSpellScroll()`
ne posait jamais de `baseValue` sur les parchemins. Deux conséquences : (a) `sellItem()` ne pouvait
pas vendre un parchemin (il n'était de toute façon jamais dans `gameState.inventory`, mais même le
prix aurait été 0) ; (b) `generateShopStock()` calculait déjà `item.price = (item.baseValue || 1) ×
SHOP_MARKUP`, donc un marchand de parchemins vendait tout son stock à 2-3 PO quelle que soit la
rareté — un bug actif avant même ce chantier, corrigé ici en même temps que la vente.

**Solution retenue** :
- `generateUrbanFloorMap()` : mélange Fisher-Yates des villes candidates (hors départ, hors
  escalier/Sortie), les 2 premières deviennent respectivement marchand et professeur garantis, avec
  spécialité tirée dans les mêmes pools qu'avant. `specializedCityChance` continue de s'appliquer,
  indépendamment, aux candidates restantes — comportement strictement inchangé pour celles-là.
  `cityCount` (6 à 8 sur la plage d'étages urbains 3-18) laisse toujours ≥ 2 candidates hors
  départ/cible en pratique : pas de garde spécifique pour un cas <2, jamais atteint avec la config
  actuelle.
- `generateSpellScroll()` (+ les deux variantes à rareté forcée, cadeau de bienvenue et kit de test) :
  `baseValue = round(baseDmg_NON_SCALÉ × 1.6)` — dérivé du `baseDmg` de base du sort AVANT le
  `statMult` de la rareté, exactement comme `baseValue` sur les armes/armures classiques (`items.js`),
  qui n'est jamais non plus affecté par `statMult` dans `generateItem()`. Ratio 1.6 choisi dans la
  fourchette observée `baseValue/baseDmg` (~1.5-2) des objets existants.
- `sellSpell(index)` : nouvelle fonction pendante de `sellItem()`, opère sur `gameState.spellbook`
  plutôt que `gameState.inventory` (tableaux distincts, comme `buyShopItem()` les traite déjà
  séparément) — même `SELL_VALUE_RATIO`, même structure. L'équipé (`gameState.equipment.spell`) n'est
  structurellement jamais dans `spellbook` (voir `equipSpell()`), donc rien à exclure explicitement.
  Nouvelle section boutique `#shop-sell-spells-list` (`updateShopUI()`), même présentation que la
  liste de vente d'inventaire existante.

**Écart au texte de la mission** : la mission suggérait d'étendre `sellItem()` lui-même pour
"accepter aussi le grimoire". J'ai préféré une fonction dédiée (`sellSpell()`) plutôt qu'un paramètre
supplémentaire sur `sellItem()` — les deux tableaux (`inventory`/`spellbook`) sont déjà traités
séparément partout ailleurs dans le code (`buyShopItem()`, `addLoot()`, `updateInventoryUI()`/
`updateSpellbookUI()`), donc une fonction séparée reste cohérente avec cette convention existante et
évite un paramètre booléen peu lisible sur `sellItem()`. Comportement final identique à ce que
demandait la mission.

**Tests** : `urban-shops.js` — au moins un marchand ET un professeur garantis sur 20 générations
successives (renforce le test existant de non-collision, qui reste inchangé) ; `generateShopStock('scrolls')`
pose un prix réel (> le repli à 1 PO) ; nouveau bloc `sellSpell()` (crédit PO, retrait du grimoire,
inventaire jamais touché). `magic.js` — `generateSpellScroll()` pose `baseValue` correct au palier
Commun ET ne le fait PAS grimper au palier Légendaire (non-régression du "jamais scalé par la
rareté"). `npm test` : 2259 tests OK. `npm run test:long` : 2 boutiques rencontrées sur la dernière
simulation (contre 0-1 avant ce chantier sur des runs comparables), cohérent avec la garantie.

## Chantier E — Budget temps par étage + alerte escalier

_À compléter._
