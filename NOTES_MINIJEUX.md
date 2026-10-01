# Notes — chantier 6 « Mini-jeux »

Décisions et plan complets : `CHANTIERS.md`, chantier 6 (rounds 1 à 6). Ce fichier décrit ce qui est CODÉ.

## État

| Lot | Contenu | Statut |
|-----|---------|--------|
| 0 | Hôte d'épreuve, bande d'UI, réglage, étape interactive des beats, animations d'issue, épreuve de référence `timing` | **Codé** |
| V1 | Crochetage d'un coffre, désamorçage d'un piège, glyphe de sort | **Codé** |
| V2 | Mains nues (Immobiliser, Étrangler), tir (Cible, Points faibles), Occasion de combat (25 %) | **Codé** |
| V3 | Boss : Parade, Briser la garde, Coup de grâce (+ arme signature conditionnée au Parfait) | **Codé** |
| V4 | Salle de jeux en ville (stand de tir, ring, coffre-fort, mémoire) | **Codé** |
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

## V1 — crochetage, désamorçage, glyphe

Réglages (chiffres de départ, à valider en playtest) dans `MINIGAME_SETTINGS` (minigames.js) ; glyphe renforcé dans
`config.magicBalance` (`glyphDamageMult` 1,25, `glyphBackfireMult` 0,5).

- **Crochetage** (`lockpick`) : « Trésor » de l'exploration → une fois sur deux (`lockedChestPct` 50) un **coffre verrouillé**
  (`openLockedChest()`, scène « Coffre Verrouillé »). Trois goupilles à caler tour à tour (un curseur, une zone par goupille, un
  seul arrêt par goupille, réussi ou non). Récompense selon le nombre de goupilles (`LOCKPICK_REWARDS`) : 3 = butin d'un
  palier de rareté de plus (`source: 'treasure'`), 2 = butin normal, 1 = quelques PO (`rollGoldAmount()`), 0 = rien. Zone 0,30
  à l'étage 1, −0,02 par étage jusqu'à 0,12, +0,01 par niveau de Furtivité (jusqu'à +0,08) : `lockpickZoneWidth()`. Issue
  affichée : Parfait = 3 goupilles au cœur, Réussi = au moins 2, sinon Raté. Temps écoulé : les goupilles déjà crochetées sont
  gardées (`renderer.timeout()`). **Jet automatique** : 70 % par goupille (`autoResolve`, jamais de Parfait).
- **Désamorçage** (`sequence`) : un piège sur deux (`trapDisarmPct` 50, après l'Éclaireur) devient désamorçable
  (`openTrapDisarm()`). 4 symboles distincts par forme ET couleur (▲ ● ■ ◆), affichés un par un (jamais deux identiques
  d'affilée) puis à reproduire ; 3 symboles, 4 dès l'étage 7 ; temps d'affichage 450 ms + 40 ms par niveau de Furtivité
  (max 900) ; saisie 3 s. Une erreur ou un temps écoulé = le piège se déclenche (`springTrap()`, comportement d'avant, mort
  comprise) ; réussi = évité ; Parfait = saisie en moitié du temps. **Jet automatique** : 45 % + 6 % par niveau de Furtivité,
  plafond 85 % (`disarmOverrides()`).
- **Glyphe** (`glyph`) : proposé à chaque sort **offensif** (jamais un sort utilitaire), APRÈS les vérifications (mana, écart) et
  avant l'action (`maybeGlyphSpec()` → `castEquippedSpell()`). Grille 3 × 3, 4 à 6 points numérotés à relier dans l'ordre, un motif
  par sort (`GLYPH_PATTERNS`, clé = nom exact). Lever le doigt avant la fin repart de zéro (dans les 5 s) ; passer près d'un mauvais
  point est sans effet ; un geste rapide valide plusieurs points (distance au segment, `glyphAdvance()`). Réussi (Parfait si tracé en
  moins de 40 % du temps) : dégâts +25 % et risque de raté ÷2 ; raté, temps écoulé ou « Passer » : **sort normal, sans malus**.
  Réglage Jouer : toujours proposé ; Réduit : 25 % ; Jet automatique : jamais (`glyph.chancePct`). Un jet automatique de glyphe
  vaut « pas de glyphe » et n'écrit rien au journal (`quietAuto`).
- **Hôte** : `autoResolve(spec, rng)` d'une épreuve (jet automatique propre, renvoie `{ outcome, detail }`), `renderer.timeout()`,
  `bindTap()` (un tap = pointerdown PUIS click : le click qui suit est ignoré — bug réel trouvé en navigateur, qui comptait deux
  goupilles par tap), boutons de combat rendus seulement au rappel de `onResult` (pas de double action pendant l'éclat).
  Espace/Entrée ne sont interceptés que si l'épreuve a un geste principal (`renderer.primary`).
- **Animations d'issue** : calque `#explore-fx` dans la scène d'exploration (`fxLayerOverride`) ; éclats `chestOpen`/`lockJam`
  (coffre), `disarmed`/`trapSnap` (piège), `glyphSeal`/`glyphFade` (glyphe), posés sur l'accessoire de la vignette
  (`target: 'prop'`, `at`) ou sur le crawler en combat.
- **Attention** : `minigames.js` est chargé dans le même contexte global que `floorgen.js` — un nom de fonction commun écrase l'autre
  (`pointSegmentDistance` existait déjà : le générateur d'étages urbains ne produisait plus aucun repaire). Préfixer les helpers.

### Effets sur l'équilibrage (jet automatique = « joueur moyen »), à suivre en playtest

- Butin : un « Trésor » sur deux est un coffre ; en jet automatique, 78 % des coffres donnent un objet (contre 100 % avant) et
  34 % d'entre eux avec un palier de rareté de plus : environ −11 % d'objets issus de ces événements, mais plus rares.
- Pièges : 50 % sont désamorçables ; en jet automatique, 45 % de réussite à Furtivité 1 (≈ −22 % de pièges déclenchés), 63 %
  à Furtivité 4 (≈ −32 %).
- Glyphe : +25 % de dégâts sur les sorts, uniquement pour qui joue le mini-jeu (aucun malus pour les autres).

## V2 — Occasions de combat : Immobiliser, Étrangler, Cible, Point faible

Chiffres (départ, à valider en playtest) dans `MINIGAME_SETTINGS` (`occasion`, `grapple`, `choke`, `target`, `weakpoint`) ; pure et
testée : `decideOccasion()` (minigames.js).

- **Occasion** : au début d'un tour, **25 %** de chance (réglage Jouer ; Réduit 10 % ; Jet automatique 0), **+1 % par niveau de la compétence
  liée** (Mains nues pour Immobiliser, Arme pour Cible / Point faible), plafonné à +10. Un bouton « ✨ Occasion : … » (`#btn-occasion`,
  pulsation coupée sous `prefers-reduced-motion`) s'ajoute aux actions pour CE tour seulement ; toute action normale l'éteint. **Jamais
  deux Occasions tirées d'affilée** ; **garantie** : au 7e combat sans Occasion, la première situation éligible en propose une
  (`gameState.occasion.pity`, conservée en sauvegarde). Sans interface interactive (tests Node, simulation longue) : jamais d'Occasion.
  Tirage fait une fois par tour au premier rafraîchissement (`rollCombatOccasion()`, appelé par `updateUI()`), `gameState.occasion`
  = `{ current, turn, rolledTurn, lastOfferTurn, pity }` ; le bouton se masque si la situation a changé (mob rué au contact…).
- **Immobiliser** (mains nues, au contact) : garder le doigt dans une zone qui bouge (3 s, zone 0,34 + 0,01 par niveau de Mains nues,
  jusqu'à +0,08). Part du temps dans la zone : ≥ 80 % Parfait, ≥ 50 % Réussi. Réussi = **1 tour** d'immobilisation, Parfait = **2 tours** ; un
  boss : toujours 1 tour. Le mob immobilisé ne riposte pas (`status.immobilized`, branche dans `resolveEnemyCounterAttack()`, badge 🤼) : la
  riposte du tour de la prise est déjà sautée. Raté : tour perdu, la riposte suit.
- **Étrangler** (finisseur) : proposé **à coup sûr** (sans tirage) sur un mob non-boss, au contact, immobilisé OU étourdi. Zone plus étroite (0,28),
  seuils 85 % / 60 %. Réussi / Parfait : une attaque à mains nues à **dégâts ×3**, jamais un boss. Raté : tour perdu.
- **Cible de précision** (arme à distance équipée, écart > 0) : un réticule (trajet de Lissajous) balaie une cible ; un tap tire là où il est.
  Centre = Parfait (**×1,5**), cible = Réussi (×1), hors cible = Raté (tour perdu). La cible rétrécit de 6 % par cran d'écart (plancher 50 %) et grandit un
  peu avec la compétence Arme. Le réticule croise **exactement le centre** à un instant tiré entre 0,8 et 2,2 s : un Parfait est toujours atteignable
  (bug trouvé en navigateur : avec des phases libres, il pouvait ne jamais passer au centre).
- **Point faible** (même condition) : trois zones, un choix tactique sans adresse (seule l'hésitation, 6 s, est un Raté) — **Tête** dégâts ×1,3 ;
  **Bras** dégâts ×0,8 et ATQ du mob ×0,75 pendant 2 tours (`status.weakened`, lu par `consumeEnemyAttackDebuffs()`, badge 💪) ; **Jambe** dégâts
  ×0,8 et le mob recule d'un cran. Les effets s'appliquent AVANT le coup, la riposte qui suit en tient compte.
- **Jet automatique / Passer** : Immobiliser 10 / 45 / 45 %, Étrangler 5 / 45 / 50 %, Cible 10 / 40 / 50 % (Parfait / Réussi / Raté) ; Point faible : la tête.
  (Les Occasions ne se proposent pas en Jet automatique ; ces taux ne servent qu'à « Passer » en cours d'épreuve.)
- **Suivi du doigt** (`holdRenderer`) : `renderer.pointer(type, x)` testable sans DOM ; le temps crédité entre deux échantillons est plafonné à
  100 ms (un onglet masqué ne crédite jamais des secondes d'un coup).
- **Animations** : éclats `grapple` (mains qui se referment), `choke` (cercle qui se resserre), `bullseye` (anneaux + flèche), `ricochet`, `weakMark`
  (réticule) sur le mob.
- **Posture du crawler** : Immobiliser / Étrangler = garde du boxeur ; Cible / Point faible = arme à distance pointée.

### À surveiller en playtest (V2)

- **Puissance de la prise** : un Immobiliser Parfait neutralise 2 ripostes, puis l'Étranglement frappe à ×2,25 de l'ATQ (0,75 × 3, DEF ignorée à 35 %+) :
  à bas niveau cela dépasse un coup d'arme ; la valeur relative baisse quand l'arme progresse. Sur un élite, c'est un combo très rentable.
- **Fréquence réelle** : ~30 % au premier tour (25 % + garantie), soit environ une Occasion par combat de 3-4 tours.
- **Cible à grand écart** : à 8 crans la cible vaut ×0,52 (fenêtre Parfait ≈ ±17 ms) : volontairement dure ; à vérifier au doigt.
- **Clavier** : Immobiliser / Étrangler n'ont pas d'équivalent clavier (le suivi est au pointeur) ; Cible : Espace/Entrée tire ; Échap = Passer partout.

## V3 — épreuves de boss

Chiffres (départ, à valider en playtest) dans `MINIGAME_SETTINGS.boss`. Logique pure : `parryOutcome()`, `guardOutcome()`, `bossAutoRates()`, `signatureReward()`.

- **Parade** (exécution d'un coup lourd télégraphié) : un anneau se resserre sur un bouclier, le coup tombe entre 0,9 et 1,4 s ; un tap (ou Espace/Entrée)
  à ±90 ms = **Parfait** (coup détourné, le crawler riposte à x1,5 SANS jamais achever le boss, et la garde du boss s'ouvre un tour : statut `exposed`,
  DEF x0,7), à ±220 ms = **Réussi** (dégâts x0,5, plancher de pression réduit en proportion), sinon **Raté** (le coup lourd tombe comme avant).
- **Briser la garde** (exécution de « il se hérisse ») : un point faible apparaît à un endroit tiré (0,3-0,9 s) ; le toucher en ≤ 450 ms = Parfait (la garde
  ne monte pas ET s'ouvre), ≤ 1,1 s = Réussi (la garde ne monte pas), sinon Raté (elle monte comme avant). Espace/Entrée touchent le point faible.
- **Rythme** : 3 épreuves de télégraphe au plus par boss (`trialCap`, compteur `enemy.trials`) ; au-delà, le comportement d'avant. Le Coup de grâce s'y
  ajoute : 4 épreuves au plus. **Jamais d'épreuve sans interface** (tests Node, simulation longue) : comportement strictement inchangé.
- **Coup de grâce** : le coup FATAL porté à un boss (`performPlayerAttack()`) n'achève pas tout de suite : `offerCoupDeGrace()` ouvre l'épreuve (une seule fois par
  boss, `finisherDone`), choisie selon la dernière attaque — tir : Cible ; mains nues : maintien (Étrangler) ; arme / sort : timing à zone étroite (0,20,
  période 1 s). Le boss est de toute façon achevé (aucune pénalité) ; la cinématique (`#finisher-cinema` : bandes de cinéma, flash — doré si Parfait —, mention,
  750 ms ; sans mouvement sous `prefers-reduced-motion`) précède la victoire. Pas d'Occasion proposée sur un boss à terre.
- **Arme signature** : **100 % avec un Coup de grâce parfait, 0 % sans** (plus de garantie à la première victoire, plus de chance de répétition ;
  `itemBalance.boss.signatureRepeatChance` supprimé). Un Raté, un Réussi, « Passer », le mode Jet automatique, des mini-jeux sans interface ou un boss achevé
  autrement (saignement, compagnon) : pas d'arme signature (une ligne de journal l'explique). **3 Parfaits ou plus** dans le combat (Coup de grâce compris) : un
  qualificatif de plus, distinct des siens, au rang maximal de la rareté (`item.forgedByPerfect`, mention dans l'inspection). Le nom reste celui du boss.
- **Jet automatique / Passer** : réussite 35 % + 2 % par niveau d'Arme (plafond 70 %), jamais de Parfait.
- **Animations** : éclats `parry` (étincelles croisées, sur le crawler) et `guardBreak` (fissure, sur le boss) ; la Parade et le Parfait portent le gel d'impact et la
  secousse d'écran ; le Coup de grâce a sa cinématique.

### À surveiller en playtest (V3)

- **Économie des armes signature** : en jet automatique (ou sans interface) on n'en obtient plus jamais — c'est voulu, mais à confronter au ressenti ;
  pour les autres, un Coup de grâce Raté « coûte » l'arme : frustration possible, surtout si l'épreuve (timing étroit) est dure.
- **Puissance de la Parade** : un Parfait annule un coup lourd (x1,8) ET inflige une riposte ET ouvre la garde ; sur un boss à 3-4 télégraphes, l'écart entre
  un joueur adroit et un joueur qui passe devient grand (voulu : « Passer » ne change rien au boss d'avant, seul le jeu apporte un avantage).
- **Fenêtres** : ±90 ms (Parfait de la Parade) et 450 ms (Briser la garde) à vérifier au doigt sur iPhone.
- **Boss achevé par un coup non direct** (saignement, compagnon, riposte d'armure) : jamais d'arme signature ; à confirmer que ça n'arrive pas trop souvent.

## V4 — salle de jeux en ville

- **Génération** : `ROOM_TYPES.arcade` (🎰, `onEnter: 'arcade'`) ; `generateMetropolis({ arcadeCount })` pose une salle de jeux dans `arcadeCount` villes tirées sans remise
  parmi les villes autres que celle du départ (`city.hasArcade`, rôle de salle `arcade`) — le hasard n'est consommé que si `arcadeCount > 0`, donc un appel sans
  l'option génère exactement comme avant. `generateUrbanFloorMap()` demande 1 à 2 salles (`config.urbanFloors.arcadeCitiesMin/Max`). Jamais plus de 5 salles par ville
  (une ville avec marchand + salle de jeux : place, auberge, marchand, jeux, ruelle). Carte : couleur `URBAN_MAP_COLORS.rooms.arcade`, repère 🎰 une fois visitée.
- **Moteur** (`app.js`, section « Salle de jeux ») : `enterUrbanRoom()` → `triggerArcade(city)` ; réutilise `shopChoicePending` (blocage) avec `gameState.pendingArcadeCityId`
  (jamais `pendingShopCityId`, une ville peut être marchand ET salle de jeux) et `gameState.arcadeSession` (partie en cours : `{ game, stake, outcomes }`).
  `playArcadeGame(clé)` : valide la mise (`arcadeCheckStake()`) et le temps (`arcadeCanPlayTime()` : une partie ne peut jamais amener `timeLeft` à 0), prélève la mise et
  1 H (régénération normale), enchaîne les manches par `startMinigame()` (`runArcadeRound()`), conclut par `finishArcadeGame()`. « Partir » est refusé pendant une partie.
- **Règles pures** (`minigames.js`, `ARCADE_SETTINGS`, `ARCADE_GAMES`) : chaque jeu = suite de manches, chacune une épreuve EXISTANTE (aucun nouveau rendu) :
  stand de tir = 3 × `target` (distances 2/3/4, compétence Arme) ; ring = `grapple` puis `choke` (Mains nues) ; coffre-fort = 3 × `timing` (zones .30/.22/.15, périodes
  plus rapides, Furtivité) ; mémoire = 3 × `sequence` (3/4/5 symboles, Furtivité, **une erreur arrête la partie**). Points : Parfait 2 / Réussi 1 / Raté 0 ; palier selon la part
  des points maximaux : ≥ 50 % bon (mise ×1,5), ≥ 75 % excellent (×3 + 10 XP de la compétence liée), sinon perdu ; **tout Parfait = partie parfaite → un lot**
  (`addLoot({ source: 'treasure' })`). Gain brut = mise × multiplicateur (la mise y est comprise). Mise maximale = 60 PO × étage (et jamais plus que ses PO).
- **Jet automatique / Réduit** : un jeu se joue épreuve par épreuve comme ailleurs ; en jet automatique l'espérance de gain reste sous la mise (mesurée : tir ≈ 0,41,
  ring ≈ 0,63, coffre-fort ≈ 0,72, mémoire ≈ 0,14 ; testée < 0,9) — la salle de jeux n'est jamais une machine à PO sans y jouer ; un joueur adroit (Parfaits) gagne jusqu'à ×3.
- **UI** : `#shop-arcade-content` dans `#shop-zone` (mise numérique + Min/½/Max, 4 boutons de jeu avec compétence liée, pastilles 🟡🟢🔴⚪ des manches, message de
  résultat) ; scène `renderScene('arcade')` (enseigne néon « SALLE DE JEUX », bornes d'arcade ; props `arcadeSign`/`arcadeCabinets`). Hors combat, seules les épreuves
  d'exploration (`target: 'prop'`) jouent un éclat : en salle de jeux, le retour est la bannière d'issue + l'haptique + le message.

### À surveiller en playtest (V4)

- **Plafond de mise** (60 PO × étage = 180 PO à l'étage 3) et multiplicateurs (×1,5 / ×3) : posés sans données. Un joueur adroit enchaîne les Parfaits : à surveiller si
  l'argent ne perd plus toute valeur (1 H par partie est le seul frein ; le temps d'un étage, 130 H +5/étage, reste large).
- Fréquence des salles de jeux (1 à 2 villes sur 6-8) et valeur de l'objet de la partie parfaite (palier « trésor ») ; difficulté réelle au doigt du coffre-fort (zone .15).

## Ajouter une épreuve (mode d'emploi pour V1-V4)

1. Une entrée de `MINIGAME_KINDS` (`minigames.js`), avec ses `autoRates`.
2. Son rendu dans `MINIGAME_RENDERERS` (`minigames-ui.js`).
3. Une entrée de `MINIGAME_KIND_FX` (même vide) et, si besoin, des variantes d'animation par issue — exigées par
   `tests/regression/minigames.js` (une épreuve sans rendu ni entrée d'animation fait échouer les tests).
4. L'appeler depuis le moteur par `startMinigame(spec, (outcome, detail) => …)` : `detail.auto` vaut vrai en jet
   automatique. Toujours prévoir les trois issues. Un tap passe par `bindTap()`, jamais deux écouteurs bruts.
5. Préfixer tout helper pur (noms globaux partagés avec `floorgen.js`, `scene.js`…).

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
