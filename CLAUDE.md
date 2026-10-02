# Crawler

Rogue-like textuel minimaliste inspiré de Dungeon Crawler Carl. GitHub Pages, HTML/JS vanilla +
Tailwind CDN, **aucun build step** (tout reste exécutable en ouvrant `index.html`). `/tests` n'affecte pas le jeu.

## Économie de tokens (à respecter à chaque session)
- **Une session par lot / par chantier** : `/clear` (ou nouvelle session) entre deux lots, `/compact` à la main dès ~150 k de contexte. Le coût vient surtout de la taille du contexte relue à chaque appel.
- **Ne jamais lire un gros fichier en entier** (`generator.js` 50 Ko, `scene.js` 57 Ko, `engine/combat.js` 51 Ko, `tests/regression/minigames.js` 116 Ko, `combat-scene.js` 70 Ko…). Trouver d'abord : `npm run where -- nomDeFonction` (fichier:ligne), ou `Grep`, puis `Read` avec `offset`/`limit` (±80 lignes). Pour un test : `Grep` sur le nom de la section.
- **Le détail se lit à la demande** : cette fiche est volontairement courte ; l'architecture est dans `docs/*.md` (table plus bas) et les chiffres d'un chantier dans `NOTES_*.md`. Ne lire que la fiche du sujet touché.
- **Documenter une seule fois** : le détail d'un lot va dans la fiche `docs/*.md` du sujet (ou `NOTES_*.md` du chantier) ; `CHANTIERS.md` : 2-3 lignes par lot ; `CLAUDE.md` : rien, sauf une règle transverse nouvelle ; description de PR : courte, elle renvoie aux notes (pas de recopie).
- **Moins d'allers-retours** : regrouper les modifications d'un même fichier (un script Python ou plusieurs `Edit` en parallèle), lancer les outils indépendants dans le même tour, une commande de vérification au lieu de dix (`npm run check`). Pas de `TaskCreate`/`TaskUpdate` pour un lot de moins de ~5 étapes.
- Sorties de commandes courtes : `| tail -5`, jamais un `cat` de fichier ou de journal.

## Moteur : `engine/` + `app.js`
Le moteur (ex-`app.js`, 9 000 lignes) est découpé en fichiers contigus, chargés dans cet ordre par `index.html` puis `tests/load_game.js` (`GAME_FILES`) ; même espace global (const/let/fonctions partagés), donc aucun import. `app.js` (écouteurs, premier rendu) est chargé EN DERNIER. Dans les fiches et notes, « app.js » désigne tout le moteur.

| Fichier | Contenu |
|---|---|
| `engine/state.js` | `gameState` (état du jeu, sauvegardé) |
| `engine/config.js` | `config` (tous les chiffres d'équilibrage) et tables |
| `engine/dom.js` | `ui` (éléments du DOM), formatage d'affichage |
| `engine/saves.js` | sauvegarde localStorage, nettoyage des sauvegardes |
| `engine/ui.js` | `updateUI()`, effets d'écran, `logEvent()`, `setSceneHeader()` |
| `engine/inventory.js` | barre d'icônes, équipement, consommables, inspection d'objet |
| `engine/events.js` | probabilités, événements d'exploration, furtivité, voyage sur carte |
| `engine/companions.js` | compagnons rencontrés et recrutés |
| `engine/chronicle.js` | chronique de run (`recordRunEvent`), succès, chasseurs de primes |
| `engine/show.js` | émission DeathWatch, UI des anomalies d'étage, Pacte |
| `engine/origins-choice.js` | choix de la race et de la classe (étage 3) |
| `engine/progression.js` | nécrologie, niveau/XP |
| `engine/floors.js` | carte d'étage (borough), étages urbains, repaires |
| `engine/shops.js` | villes spécialisées (marchand/professeur), salle de jeux |
| `engine/floor-map-ui.js` | carte stylisée (rendu, zoom, voyage) |
| `engine/combat.js` | tour de combat, distance, enrage |
| `engine/combat-rhythm.js` | qualificatifs en combat, séquenceur de beats |
| `engine/combat-boss.js` | boss (phases, télégraphes), épreuves de boss |
| `engine/origins-effects.js` | passifs de race/classe, capacités, buff de départ, Armure de scénario |
| `engine/occasions.js` | Occasions de combat |
| `engine/gameplay.js` | boucle de gameplay, écran de départ, cadeau de bienvenue |
| `app.js` | initialisation : écouteurs d'événements, premier rendu |

Un nouveau fichier de code s'ajoute à `index.html` ET à `GAME_FILES` (`tests/regression/load-order.js` échoue sinon).

## Autres fichiers
- Données pures : `bestiary.js` (mobs, boss), `items.js` (objets, raretés, qualificatifs), `spells.js`, `districts.js`, `safehouses.js`, `anomalies.js`, `achievements.js` (succès, `createEmptyRunStats()`), `origins.js` (races/classes), `deathwatch.js` (piques, répliques).
- Logique pure : `generator.js` (mobs, objets, boss, compagnons, formules), `floorgen.js` (étages), `floormap.js` (rendu de la carte), `minigames.js` (épreuves), `minigames-ui.js` (hôte DOM).
- Rendu : `scene.js` (`renderScene(mode)`), `backdrops.js` (décors), `fx.js` (effets d'attaque), `sprites/*.js` (silhouettes : crawler, races, mobs, boss, objets, effets).
- `CHANTIERS.md` : registre des chantiers. `NOTES_*.md` : détail d'un chantier (diagnostic, chiffres, « À surveiller en playtest »). `docs/fichiers.md` : description détaillée de chaque fichier.

## Où lire le détail (architecture, par sujet)
| Sujet | Fiche |
|---|---|
| Étages, carte, voyage, salles sûres, escaliers, villes, repaires, budget temps | `docs/etages-carte.md` |
| Combat à distance, furtivité, élites, début de partie (chantier 15), boss, enrage, beats, logs | `docs/combat.md` |
| Compagnons | `docs/compagnons.md` |
| Objets (raretés, qualificatifs), magie | `docs/objets-magie.md` |
| Succès, chasseurs de primes, DeathWatch, nécrologie, anomalies | `docs/meta-jeu.md` |
| Mini-jeux | `docs/minijeux.md` |
| Buff de départ, XP, régénération | `docs/progression.md` |
| Interface, écran de départ, sauvegarde, argent, boutiques | `docs/interface-sauvegarde-boutiques.md` |
| Scènes SVG (combat, décors, crawler équipé, effets, exploration, Game Over) | `docs/scenes.md` |
| Tests (détail), backlog de chiffres à playtester | `docs/tests.md`, `docs/backlog.md` |

## Conventions de travail
1. Lire avant de modifier (voir « Économie de tokens »).
2. `npm run check` avant tout commit : syntaxe de tous les fichiers + suite rapide (`npm run check -- --long` ajoute la simulation longue). `npm test` seul reste valable.
3. Étendre les tests existants (un module de `tests/regression/` par domaine), ne pas en recréer.
4. À chaque changement d'un `.js`, incrémenter le `?v=N` de tous les `<script>` d'`index.html` : `npm run bump` (un seul numéro, qui ne fait que croître).
5. Un correctif d'équilibrage (stats, taux, formules) se propose en LISTE à valider — jamais appliqué sans validation explicite.
6. Pas de versioning par tag/release : `APP_VERSION` n'est pas à maintenir.

## Règles transverses (un test échoue si on les oublie)
- Toute perte de PV du joueur passe par `applyPlayerDamage()` ; toute chronique par `recordRunEvent(type, data)` (un nouveau compteur s'ajoute à `createEmptyRunStats()`).
- Pas de Promise/async : callbacks et `setTimeout` chaînés (`runCombatBeats()`, mini-jeux, `startMinigame()`), pour rester synchrone sous Node.
- Un nouvel état transitoire de `gameState` (`xyzChoicePending`, `pendingXyz`, …) s'ajoute à `resetTransientState()` (`tests/regression/_helpers.js`) ET à `KNOWN_GAMESTATE_KEYS` (`meta-reset.js`) ; un état bloquant s'ajoute aussi à `isActionBlocked()` et à l'auto-résolveur de `tests/long_playthrough.js`. Un champ sauvegardé a un défaut dans `restoreSaveForName()`.
- Contenu à compléter ensemble : un objet de base ou signature = un sprite ; un boss = un sprite ; un quartier = un décor ; un type de salle sûre = une signature ; une épreuve = rendu + effet ; un qualificatif = une couleur `ENCHANT_COLORS` ; une vignette nommée par `setSceneHeader()` = une entrée de `EXPLORE_VIGNETTES`.
- Dans les tests, la Période d'essai et l'Armure de scénario (chantier 15) sont neutralisées par défaut : `withTrial()` / `withPlotArmor()` les réactivent.

## Tests
- `npm test` (rapide, avant CHAQUE push), `npm run test:long` (simulation, UNE fois si la boucle de jeu change : combat, distance, compagnon, génération d'étage), `npm run test:all`. Outils de calibrage, jamais lancés par la CI : `npm run sim:floors`, `sim:items`, `sim:early`.
- CI (`.github/workflows/ci.yml`) : `npm test` + `npm run test:long` à chaque push ; un push rouge se corrige avant tout autre travail.
- Détail (agrégateur, `_helpers.js`, test méta des fuites d'état, liste des modules) : `docs/tests.md`.

## Chantiers
Voir `CHANTIERS.md` (statut, décisions, points à playtester). Méthode : Exploré → Suggéré → Planifié → Codé ; tenir le registre à jour. **Questions à l'utilisateur** (jusqu'au début du code) : l'outil de questions à choix multiples, jusqu'à 4 questions par round.
