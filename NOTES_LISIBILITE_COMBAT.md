# Notes — Lisibilité combat (séquenceur de beats, télégraphes visibles, impacts)

Valeurs appliquées et écarts/choix signalés pour les 10 chantiers de ce rework de lisibilité. Chaque
chantier a son propre commit ; ce fichier est mis à jour au fil de l'implémentation, pas réécrit à la
fin (même convention que `NOTES_COMBAT.md`).

## Chantier 6 — Séquenceur de tour en beats (socle)

**Choix d'architecture (écart assumé face à la consigne d'origine)** : la consigne demandait un
helper `await combatBeat(ms)` basé sur une vraie Promise. Vérifié AVANT d'écrire la moindre ligne
(exploration dédiée) : c'est incompatible avec la suite de tests existante — 113 sites d'appel direct
dans `tests/regression/*.js` (`combat.js`, `combat-boss.js`, `combat-enrage.js`, `balance.js`,
`magic.js`, `combat-scaling.js`) et la boucle de `tests/long_playthrough.js` sont du code SYNCHRONE
sans `await`. Une continuation `await`/`.then()` est TOUJOURS mise en file en microtâche par la
spec JS, même si la Promise se résout de façon synchrone — aucun stub ne peut contourner ça,
contrairement à `setTimeout`.

**Solution retenue** : `runCombatBeats(steps, onDone)` — une file de `{run, delay, skippable}` jouée
par callbacks `setTimeout` chaînés (`delay` = pause AVANT que le step ne s'exécute), jamais de
Promise/async-await. Stub `global.setTimeout = (fn) => fn();` ajouté à `tests/regression/_helpers.js`
(copie exacte de celui déjà présent dans `tests/long_playthrough.js`) : toute la chaîne de beats se
déroule alors en synchrone sous Node, donc les 113 sites d'appel existants n'ont eu besoin d'AUCUNE
réécriture. Validé en conditions réelles (sans stub, script Node ad hoc) : un tour normal libère les
boutons après ~280ms, un multi-coups à 3 frappes après ~470ms (280 + 2×90), un événement vide (riposte
bloquée) reste à 0ms — conforme aux critères d'acceptation de la consigne.

**Résolution d'une contradiction dans la consigne d'origine** : la description de
`beatHeavyEvent` liste "pose d'un télégraphe" comme événement LOURD, alors que la description de
`beatEmptyEvent` liste "télégraphe posé sans dégât" comme événement VIDE — les deux textes se
contredisent. Choix retenu (documenté ici plutôt que deviné silencieusement) : la pose d'un télégraphe
(heavy ET defBuff) est un moment d'annonce à fort enjeu — la bannière du Chantier 1 y sera accrochée —
et reste donc `beatHeavyEvent`. Restent "vides" (0ms, non touchés par ce chantier car déjà instantanés
avant) : riposte bloquée ("trop loin"/"trop près") et repositionnement raté (kiting), qui n'entrent
JAMAIS dans `runCombatBeats()` — ce sont des `return` anticipés de `safeEnemyCounterAttack()`/
`resolveEnemyReaction()`, en dehors du séquenceur.

**Répartition retenue** (`config.combatRhythm`, valeurs fournies par la consigne, non renégociées) :
- `beatActionToRiposte` (280ms) : attaque de base d'un mob normal/boss, harcèlement à distance,
  première frappe d'un multi-coups.
- `beatEmptyEvent` (0ms) : jamais consommé PAR le séquenceur lui-même (les événements vides court-
  circuitent avant d'y entrer) — conservé dans la config pour que la valeur existe au même endroit que
  le reste du rythme, prêt pour un futur point d'usage.
- `beatHeavyEvent` (550ms) : pose de télégraphe (heavy/defBuff), EXÉCUTION d'un télégraphe heavy,
  ruée d'enrage (`triggerMobEnrage()`), chaque frappe de phase 3 ("folie").
- `beatMultiHit` (90ms) : entre chaque frappe d'un multi-coups de phase 2 (après la première, qui
  reste à `beatActionToRiposte`).

**Bug corrigé au passage (hors périmètre strict mais nécessaire)** : `triggerMobEnrage()` (ruée
d'enrage, Chantier 3 du rework combat précédent) ne posait JAMAIS `setCombatInputLocked(true)` et
s'exécutait entièrement en synchrone, contournant tout le système de verrouillage — un vrai bug
d'incohérence, pas juste un manque de rythme. Corrigé dans ce même commit (verrouille/déverrouille
désormais comme n'importe quelle riposte).

**Champ ajouté, pas encore exploité** : `enemy.lastKnownPhase` (initialisé dans `initiateCombat()` à
la phase de départ, pour qu'aucun "changement" ne soit détecté au premier tour) — posé dès ce
chantier pour que le Chantier 10 (bannière de changement de phase) n'ait qu'à le LIRE, sans toucher à
`initiateCombat()`. La détection du changement elle-même (comparaison + mise à jour) est laissée au
Chantier 10, pas implémentée ici, pour ne pas ajouter un beat "vide" (sans bannière pour le justifier)
dans ce chantier-socle.

**Petit écart de timing assumé** : le tick de saignement ennemi et le cas "étourdi" en tout début de
`resolveEnemyCounterAttack()` restent à affichage IMMÉDIAT (aucun beat propre), alors qu'avant ce
chantier ils étaient invisiblement groupés avec le reste derrière le seul délai de 400ms
d'`enemyCounterAttack()`. Résultat observable : un tick de saignement s'affiche désormais plus tôt
qu'avant (pas de régression de rythme, juste un léger CHANGEMENT — cohérent avec la philosophie de la
consigne : les petits événements sans dégât nouveau s'affichent immédiatement).

**Tests** : 6 assertions pré-existantes (`tests/regression/combat.js` ×4, `tests/regression/balance.js`
×2) utilisaient `ui.btnFlee.disabled === true`/`ui.btnAttackWeapon.disabled === true` juste après un
appel comme témoin synchrone "une riposte a bien eu lieu" — un témoin qui ne peut plus jamais être vrai
maintenant que toute la séquence (verrouillage ET déverrouillage) se déroule en synchrone sous le stub.
Remplacées par un témoin plus direct et plus robuste : `gameState.hp` a diminué entre avant/après
l'appel (tous ces mobs de test ont `atk: 999`, dégâts garantis). Comportement du jeu inchangé, seul le
witness de test l'était devenu.

## Chantier 1 — Bannière de télégraphe

_À compléter._

## Chantier 2 — Badges d'état ennemi

_À compléter._

## Chantier 3 — Chiffres de dégâts flottants

_À compléter._

## Chantier 5 — Jauge de tension anti-kite

_À compléter._

## Chantier 4 — Hiérarchie visuelle des impacts

_À compléter._

## Chantier 10 — Bannière de changement de phase boss

_À compléter._

## Chantier 7 — Découpler le verrou d'input du beat

_À compléter._

## Chantier 9 — Skip et accessibilité

_À compléter._

## Chantier 8 — Réduire la charge textuelle des logs

_À compléter._
