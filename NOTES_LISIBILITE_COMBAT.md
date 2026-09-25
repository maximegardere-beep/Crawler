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

`#telegraph-banner` (index.html, sous `#enemy-name` dans `#combat-zone`) + `updateTelegraphBanner()`
(app.js, appelée depuis `updateUI()`). Affichée EN PERMANENCE tant que `enemy.status.telegraph` est
actif (pas seulement au tour d'annonce) : `type: 'heavy'` → "⚠️ Coup dévastateur imminent —
défendez-vous ou esquivez !", `type: 'defBuff'` → "🛡️ Garde imminente — frappez maintenant !". Pulse
CSS discret (`telegraphPulse`, 1.1s) désactivé sous `prefers-reduced-motion: reduce` (bordure/couleur
seules restent le signal). Masquée automatiquement quand `enemy.status.telegraph` redevient `null`
(exécution, entrée en phase 3, fin de combat) — aucun état supplémentaire à gérer, `updateUI()` relit
l'état réel à chaque rendu. Pas de dépendance au séquenceur de beats (Chantier 6) : l'affichage est
continu, pas lié au timing d'un événement précis.

## Chantier 2 — Badges d'état ennemi

**Décision prise pendant l'exploration** : `#combat-enemy-status`/`ui.combatEnemyStatus` existait déjà
au bon endroit visuel (panneau latéral `#combat-side-enemy`) mais en simple `<span>` texte concaténé,
sans tooltip possible. Plutôt que de créer un second nœud concurrent, RENOMMÉ en `#enemy-status-icons`/
`ui.enemyStatusIcons` (vérifié au préalable : aucun test n'y faisait référence) et son rendu bascule
en `innerHTML` de badges individuels `<span title="...">`. Fonction unique `renderEnemyStatusBadges(enemy)`
(app.js), appelée depuis `updateUI()`.

Couvre les 6 statuts déjà affichés avant ce chantier (saignement 🔥, étourdi 💫, ralenti 🐌, ébloui ✨,
corrodé 🧪, apeuré 😱) + les 4 nouveaux posés par le rework combat mais jamais montrés visuellement
jusqu'ici : garde hérissée 🛡️ (`defBuffed`), folie 🤪 (`frenzied`), enragé 😡 (`enraged`), télégraphe
actif 👁️ (`telegraph` — redondance volontaire avec la bannière du Chantier 1, utile pour qui ne
regarde que le panneau latéral compact). Icône `🤪` choisie pour "Folie" plutôt que `🔥` (déjà pris par
le saignement) — cohérent avec le texte de la future bannière de changement de phase du Chantier 10
("🤪 [Nom] entre en folie furieuse").

## Chantier 3 — Chiffres de dégâts flottants

`showFloatingDamage(containerEl, amount, {heavy, toPlayer})` (app.js) appelée aux 3 points de dégâts
RÉELS existants : `performPlayerAttack()` (dégâts infligés, jamais heavy), `executeBossStrike()`
(dégâts subis, `heavy` transmis par l'appelant), `resolveNonBossCounterAttack()` (dégâts subis,
jamais heavy — réservé aux moments boss/enrage). `executeBossStrike()`/le helper interne
`strikeAndCheckDeath()` de `performBossCounterAttackInner()` reçoivent un nouveau paramètre `heavy`,
posé `true` uniquement pour : exécution de télégraphe heavy, chaque frappe de phase 3, ruée d'enrage
(`triggerMobEnrage()`) — jamais pour l'attaque de base, le harcèlement à distance ou le multi-coups.

**Écart détecté et corrigé pendant l'implémentation** : le décalage horizontal ±8px (pour éviter que
deux chiffres quasi simultanés — un multi-coups — ne se superposent exactement) utilisait initialement
`Math.random()`. Comme cette fonction est appelée à CHAQUE dégât réel, elle consommait le flux
aléatoire partagé par les tests, désynchronisant deux séquences `Math.random` fixes pré-existantes
(`tests/regression/combat.js`, scénario `attackMagic()` double-cast — un effet de bord purement
cosmétique n'a pas sa place dans ce flux). Corrigé en remplaçant par un compteur cyclique sur un petit
jeu de décalages fixes (`FLOATING_DAMAGE_OFFSETS`) — visuellement tout aussi efficace, et qui ne touche
plus jamais au hasard partagé. Aucune autre modification de test nécessaire pour ce chantier.

`position: relative` ajouté à `#combat-side-enemy`/`#combat-side-player` (repère pour le
`position: absolute` du chiffre). Sous `prefers-reduced-motion: reduce`, l'animation de montée/fondu
(`floatDamage`, 450ms) est remplacée par un simple fondu (`floatDamageFadeOnly`, 200ms) — les deux
déclenchent `animationend`, donc le nettoyage du nœud (`el.remove()`) fonctionne dans les deux cas
sans code dupliqué.

## Chantier 5 — Jauge de tension anti-kite

`renderDistanceTension(enemy)` (app.js, appelée depuis `updateUI()`) — 3 états mutuellement exclusifs
sous `#combat-distance-wrapper` (`#distance-tension-label` + classe `distance-tension` sur
`#combat-distance-fill`) :
- `enemy.status.enraged` actif : badge rouge fixe "😡 ENRAGÉ", plus de jauge.
- `enemy.status.enrageCooldown` actif : badge gris "😵 Épuisé (N tour(s))".
- `enemy.kitingRounds > mobKitingBaseline(enemy)` : "😤 Enrage imminent : NN%" + pulse orangé/rouge
  sur la barre de distance elle-même. `NN%` calculé avec les valeurs RÉELLES de
  `config.distanceEnrage` (jamais redupliquées en dur), exactement la même formule que
  `noteMobKitingRound()`.
- Compteur à sa base : tout masqué.

Aucun écart signalé : mapping direct de la mécanique déjà en place (Chantier 3 du rework combat),
juste rendue visible pour la première fois.

## Chantier 4 — Hiérarchie visuelle des impacts

`screenShake()` (secousse `<main id="game-main">`, translate ±2-3px sur 6 étapes/250ms) +
`screenImpactFlash()` (flash bref sur `#screen-fx-overlay`, nouvelle classe `.fx-impact-flash`
distincte des `fx-*` de statut joueur déjà en place) réunis dans `triggerHeavyImpact()`, appelée aux 4
moments EXACTS demandés — 3 via le flag `heavy` déjà posé au Chantier 3 (`executeBossStrike()` :
télégraphe exécuté, ruée d'enrage, chaque frappe de phase 3 — un seul point d'accroche, pas 3 sites
séparés) et le 4ᵉ directement dans `gameOver()` (mort du joueur, timeout inclus — la consigne ne
distingue pas les deux).

**Compromis assumé, documenté en CSS** : `.fx-impact-flash` partage `#screen-fx-overlay` avec les
classes de statut joueur déjà présentes (`fx-low-hp`, `fx-burn`...), qui ciblent elles aussi
`box-shadow`. La propriété `animation` étant unique par élément (pas de fusion possible entre deux
classes qui la déclarent chacune), un pulse de statut en cours est visuellement MIS EN PAUSE pendant
le bref flash (~300ms) plutôt que combiné — jamais perdu, il reprend normalement dès que la classe de
flash est retirée. Jugé un compromis acceptable pour un effet aussi court plutôt que de fusionner deux
`box-shadow` différents dans une seule keyframe combinatoire.

`prefers-reduced-motion: reduce` désactive `screen-shake` (`animation: none`) mais PAS
`fx-impact-flash`, conformément à la consigne explicite ("pas de shake, garde le flash") — un bref
changement d'opacité/couleur n'est pas le type de mouvement spatial visé par cette préférence,
contrairement à une translation de tout l'écran.

## Chantier 10 — Bannière de changement de phase boss

Détection dans `performBossCounterAttackInner(enemy, onDone)` : `enemy.lastKnownPhase` (posé au
Chantier 6, à l'entrée en combat, à la phase de DÉPART — jamais de fausse annonce au tour 1) est
comparé à la phase du tour courant AVANT toute sélection de pattern, puis mis à jour dans TOUS LES
CAS (`phaseJustIncreased = phase > enemy.lastKnownPhase; enemy.lastKnownPhase = phase;`). Le step de
bannière n'est prépendu qu'en cas de montée — jamais en repli (un boss ne redescend jamais de phase,
mais le code ne suppose rien de plus que "monté par rapport au dernier tour connu").

`runPattern(patternSteps)` (closure locale à `performBossCounterAttackInner`, capture `onDone` et
`phaseJustIncreased`) remplace les 7 appels directs à `runCombatBeats([...], onDone)` de la fonction —
centralise le préfixe de bannière en UN SEUL endroit plutôt que de le dupliquer sur chaque branche de
pattern (phase 3, télégraphe exécuté ×2, multi-coups, harcèlement à distance, télégraphe posé ×2, base
phase 1/repli phase 2). Le step de bannière utilise `rhythm.beatHeavyEvent` comme délai (moment fort,
cohérent avec le traitement du télégraphe au Chantier 1/6).

`announceBossPhaseChange(enemy, phase)` : affiche `#phase-transition-banner` (texte spécifique par
phase — seules les phases 2 et 3 existent comme cibles, la phase 1 est l'état de départ et ne
déclenche jamais ce step) puis la masque via un VRAI `setTimeout(..., 900)` — délibérément PAS un
step de `runCombatBeats` : la bannière doit disparaître sur son propre délai mur-horloge, indépendant
du rythme des beats suivants (qui peuvent s'enchaîner bien avant ses 900ms, en particulier en
phase 3 où le rythme redevient très rapide). Aucun `Math.random()` dans cette fonction (leçon du
Chantier 3) : le texte ne dépend que de `phase`, jamais d'un tirage.

Badge permanent `#boss-phase-badge` (à côté du nom de l'ennemi, jamais confondu avec la bannière
transitoire) : mis à jour à chaque `updateUI()` plutôt que dans `performBossCounterAttackInner` —
visible dès que `gameState.currentEnemy.isBoss && getBossPhase(...) >= 2`, masqué en phase 1 et sur
tout mob non-boss. Cohabite avec `#enemy-name` dans un conteneur flex commun ; `#enemy-name` est
passé de `<div>` stylé à `<span>` non stylé dans un wrapper `<div>` qui porte les classes — l'héritage
CSS (`color`/`font-weight`/`font-size`/`text-align`) préserve l'apparence sans dupliquer les classes.

Vérifié fonctionnellement (script ad-hoc, hors suite de tests) : phase 1→2 déclenche la bannière
"change de comportement" et affiche "Phase 2" ; 2→3 déclenche "entre en folie furieuse" et affiche
"Phase 3" ; un mob normal ne montre jamais le badge ; la bannière se masque bien après son délai de
900ms (testé avec un vrai `setTimeout`, hors stub synchrone des tests). Aucune régression sur
`npm test` (10 runs consécutifs) ni `npm run test:long` — `enemy.lastKnownPhase` étant `undefined`
sur les enemies construits directement par les tests (sans passer par `initiateCombat()`),
`phase > undefined` vaut `false` en JS, donc `phaseJustIncreased` reste correctement faux sans
exception ni bannière parasite.

## Chantier 7 — Découpler le verrou d'input du beat

_À compléter._

## Chantier 9 — Skip et accessibilité

_À compléter._

## Chantier 8 — Réduire la charge textuelle des logs

_À compléter._
