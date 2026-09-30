# Notes — chantier 6 « Mini-jeux »

Décisions et plan complets : `CHANTIERS.md`, chantier 6 (rounds 1 à 6). Ce fichier décrit ce qui est CODÉ.

## État

| Lot | Contenu | Statut |
|-----|---------|--------|
| 0 | Hôte d'épreuve, bande d'UI, réglage, étape interactive des beats, animations d'issue, épreuve de référence `timing` | **Codé** |
| V1 | Crochetage d'un coffre, désamorçage d'un piège, glyphe de sort | À faire |
| V2 | Mains nues (Immobiliser, Étrangler), tir (Cible, Points faibles), Occasion de combat (25 %) | À faire |
| V3 | Boss : Parade, Briser la garde, Coup de grâce (+ arme signature conditionnée au Parfait) | À faire |
| V4 | Salle de jeux en ville (stand de tir, ring) | À cadrer |
| Final | `recordRunEvent('minigame')`, succès, piques DeathWatch | À faire |

## Lot 0 — architecture

- **`minigames.js`** (catalogue PUR, chargé après `floormap.js`) : `MINIGAME_KINDS` (une entrée = une épreuve :
  libellé, icône, consigne, `autoRates`, `build(rng, overrides)`), `buildMinigameSpec(kind, overrides, rng)`,
  `minigameAutoOutcome(spec, rng)` (tirage pondéré ; `allowPerfect: false` = jamais de Parfait, pour les épreuves de
  boss), `timingCursorPosition()`/`resolveTimingStop()`, `minigameOutcomeFxSpec(kind, outcome)` (animation d'une
  issue : éclat `FX_IMPACTS`, gel d'impact, secousse, haptique, cible), `MINIGAME_SETTINGS` (durées 3 s / 5 s, bannière,
  chance d'Occasion 25 % / 10 % / 0 selon le réglage). Trois issues communes : `perfect` / `success` / `fail`.
- **`minigames-ui.js`** (hôte DOM, chargé après `fx.js`) : **`startMinigame(spec | nom, onResult)`**, par CALLBACK
  (jamais de Promise : même contrainte que `runCombatBeats()`). Sans interface interactive (réglage « Jet
  automatique », `prefers-reduced-motion` par défaut, pas de `requestAnimationFrame` = tests Node), l'épreuve est
  résolue tout de suite par le jet automatique et `onResult` est appelé AVANT le retour. Sinon : `gameState.pendingMinigame`
  (`{ kind, boss }`, dans `isActionBlocked()`), boutons de combat verrouillés (seulement s'ils ne l'étaient pas déjà),
  bande `#minigame-strip` collée au bas de l'écran (au-dessus de la barre d'icônes hors combat — la scène reste
  visible), minuterie `minigameTick()` (temps écoulé = Raté, plafond 3 s / 5 s boss), pause si l'onglet est masqué.
  Une seconde épreuve demandée pendant une première se résout par le jet automatique.
- **Rendus** : `MINIGAME_RENDERERS[kind].mount(root, spec, api)` → `{ primary(), update(ms), destroy() }`, `api` =
  `{ finish(outcome, detail), elapsed() }`. Cibles tactiles ≥ 44 px. **Clavier** : Échap = Passer (jet automatique),
  Espace/Entrée = geste principal de l'épreuve ; `requestCombatSkip()` ne les prend plus pendant une épreuve ouverte.
- **Issue** (`settleMinigame()`) : une ligne de journal (sarcastique, `pickMinigameLine()`), haptique, bannière
  `#minigame-banner` (masquée par un vrai `setTimeout`), puis `playMinigameOutcomeFx()` (fx.js, acteur `mini`) — éclat
  sur la cible, gel d'impact propre à l'issue (`fx.hitstopMs` : 120 ms pour un Parfait contre 40 ms), secousse d'écran
  (`triggerHeavyImpact()`) réservée au Parfait. **Aucune fenêtre de résultat** : `onResult` est appelé à la fin de
  l'animation (tout de suite hors combat / sans animation / en jet automatique). Nouveaux éclats : `FX_IMPACTS.perfect`
  (anneau doré) et `FX_IMPACTS.fizzle` (fumée grise).
- **Séquenceur** : `runCombatBeats()` accepte une étape `{ interactive: true, run(done) }` — le tour attend `done`
  (épreuve conclue) avant de reprendre, sans délai ni skip de combat. Prévue pour la Parade au milieu d'une riposte de boss.
- **Réglage** : `#minigame-mode-select` (⚙️ Réglages, en bas à gauche) — Jouer / Réduit / Jet automatique,
  `localStorage` (`crawler_minigame_mode`), jamais sauvegardé avec le crawler. La consigne d'une épreuve ne s'affiche
  que la première fois (`crawler_minigame_hints`). Menu DEV : « 🎮 Essayer un mini-jeu » (`devTestMinigame()`).
- **État** : `gameState.pendingMinigame` est dans `resetTransientState()`, `KNOWN_GAMESTATE_KEYS`, le nettoyage de
  `restoreSaveForName()` (`abortMinigame()`) et l'auto-résolveur de `tests/long_playthrough.js` (`skipMinigame()`).

## Ajouter une épreuve (mode d'emploi pour V1-V3)

1. Une entrée de `MINIGAME_KINDS` (`minigames.js`), avec ses `autoRates`.
2. Son rendu dans `MINIGAME_RENDERERS` (`minigames-ui.js`).
3. Une entrée de `MINIGAME_KIND_FX` (même vide) et, si besoin, des variantes d'animation par issue — exigées par
   `tests/regression/minigames.js` (une épreuve sans rendu ni entrée d'animation fait échouer les tests).
4. L'appeler depuis le moteur par `startMinigame(spec, (outcome, detail) => …)` : `detail.auto` vaut vrai en jet
   automatique. Toujours prévoir les trois issues.

## Tests

`tests/regression/minigames.js` : catalogue (chaque épreuve × issue a son éclat, son rendu…), timing pur, jet automatique
(répartition exacte sur un balayage, `allowPerfect`), réglage, hôte en jet automatique (Node), hôte interactif simulé
(`requestAnimationFrame` factice + `setMinigameClock()` pour piloter le temps : Parfait / Réussi / Raté, timeout, Passer,
double geste, deux épreuves, pause d'onglet, verrou des boutons en combat, skip de combat ignoré), étape interactive des
beats, remise à zéro. Vérifié en plus dans Chromium (bande, Stop, timeout, Échap, éclats et bannière des trois issues en
combat, état libéré, aucune erreur JS).

## À surveiller en playtest

- Lisibilité de la bande sur petit écran (hors combat, au-dessus de la barre d'icônes de 72 px).
- Durée de 3 s : trop courte / trop longue pour un crochetage ou une parade ?
- Le gel de 120 ms du Parfait et la bannière de 0,7 s : assez marquants sans casser le rythme ?
- Sous `prefers-reduced-motion` le mode par défaut est « Jet automatique » ; un joueur qui choisit « Jouer » garde un curseur qui bouge.
- Tailwind étant chargé par CDN, la mise en page de la bande n'a pu être contrôlée qu'à la logique (pas de réseau en
  environnement de test) : à regarder sur iPhone.
