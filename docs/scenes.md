# Scènes SVG : combat, décors, crawler équipé, effets d'attaque, exploration, Game Over, boutique, salle sécurisée

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : scene.js, backdrops.js, fx.js, sprites/*.js.

- **Scène de combat (vue 2D latérale)** : `#combat-zone` (index.html), de haut en bas : barres de vie
  (nom + PV actuels/max, mob à gauche, crawler à droite, badges d'état, dés), bannière de télégraphe,
  scène SVG (`#combat-scene-svg`, viewBox 360x150), distance "x/8" + jauge de tension, journal court,
  mana, boutons (≥ 44 px), infos du mob (`renderCombatMobPanel()` → `#combat-mob-info`). La carte
  d'exploration est masquée en combat. **Rendu séparé de la logique** : `scene.js` ne fait que lire
  `gameState`/`config` ; son seul point d'entrée est `renderScene(mode)` ('combat' en fin
  d'`updateUI()` et à l'impact d'un coup via `animateDieHit()`, voir plus bas). `distanceToX(distance, max)` est
  l'UNIQUE conversion distance de jeu → abscisse : linéaire, bornée, crawler fixe à droite
  (`CRAWLER_X`), mob entre `MOB_X_FAR` et `MOB_X_CONTACT` — ce dernier calculé depuis les gabarits
  (`CRAWLER_FRONT_EXTENT`, `MOB_EXTENT`, `CONTACT_GAP`) pour qu'aucun chevauchement ne soit possible
  au contact. La distance de jeu reste un entier 0..`maxDistance` : seul le rendu est continu
  (transition CSS sur `transform`, coupée à l'apparition d'un nouvel ennemi). Toute silhouette de mob
  doit tenir dans ±`MOB_EXTENT` (tests dans `combat-scene.js`). Deux bandes de portée permanentes au
  sol (`computeRangeBands()`) : contact (écart 0) et tir (écart > 0, aucune portée maximale dans le
  jeu), celle où se trouve le mob est renforcée. Journal court : `logEvent()` garde, en combat, les
  `COMBAT_LOG_LINES` dernières lignes dans `#combat-last-action` (remis à zéro à chaque nouvel ennemi).
  Secousse du combattant touché : `shakeSceneFighter()`, appelée par `showFloatingDamage()`, dont les
  chiffres s'accrochent aux ancres `#scene-mob-anchor`/`#scene-crawler-anchor` qui suivent la scène.
  **Taille des chiffres** : `floatingDamageScale(amount, maxHp, heavy)` (app.js, pure) — selon la PART des
  PV max de la cible (jamais le montant brut, qui grossit avec les étages), linéaire entre
  `FLOATING_DAMAGE_SIZE.minRatio` (3 %, 13 px) et `maxRatio` (40 %, 28 px), +3 px pour un coup lourd sans
  dépasser le maximum ; grossissement au sommet de l'animation `--fd-pop` (1.08 → 1.3), coupé sous
  `prefers-reduced-motion` (la taille reste).
  **Bestiaire** (phase 4, dessins livrés par Gemini puis branchés) : `resolveMobSprite(enemy, opts)`
  (scene.js, pure) compose chaque mob = aura de son effet DERRIÈRE (`MOB_EFFECT_AURAS[enemy.effect]`, couleur
  `MOB_EFFECT_FX_COLORS`, particules `.mob-aura-a/b/c` coupées sous reduced motion ; `opts.aura === false`
  pour un mob à terre) + silhouette de son `visualArchetype` (archétype inconnu → `goblinoid`) + détail
  signature `MOB_DETAILS[nom]` par-dessus ; palette naturelle du mob (sinon de l'archétype) posée en
  variables CSS `--mob-base/--mob-dark/--mob-accent` — l'ancienne teinte par effet (`MOB_EFFECT_TINTS`) a
  disparu, l'effet se voit par l'aura. Nom de référence : `enemy.baseName` (posé par `generateMob()` AVANT
  les suffixes de modificateurs, et par `generateBoss()`), sinon nom exact, sinon plus long nom connu en
  préfixe (anciennes sauvegardes). `top` renvoyé = détail compris (couronne de boss, chiffres, fx.js via
  `fxMobSprite()`). Utilisé par `renderSceneMob()` (clé de cache archétype|détail|effet) et `mobAt()`
  (vignettes d'exploration). **Boss uniques** (phase 5) : un boss présent dans `SCENE_BOSS_SPRITES`
  (`resolveBossSpriteKey()` : `baseName` ou nom exact) remplace silhouette + détail par son propre dessin
  (`{ top, bounds, palette, markup, held }`), avec son objet signature repris TEL QUEL de `ITEM_SPRITES`
  (`bossHeldMarkup()`, placé par `held.transform`, derrière le corps si `held.layer === 'back'`) ; la
  couronne et l'aura restent ajoutées par le jeu. Les 13 boss ont leur sprite (exigé par `combat-scene.js`) ;
  un futur boss sans sprite unique garderait la silhouette couronnée de son archétype. `combat-scene.js` exige un détail pour CHAQUE mob de
  `baseMobs` (et aucun détail orphelin), une aura pour CHAQUE effet, des `bounds` dans ±`MOB_EXTENT`, des
  palettes valides et aucun `id=`/`<defs>`/gradient/filtre.
  **Décor** (`backdrops.js`, catalogue pur sur le modèle de `sprites/*.js`, chargé avant `scene.js`) :
  `#scene-backdrop`, premier enfant du SVG, donc TOUJOURS derrière combattants, bandes et chiffres.
  Bibliothèques : `BACKDROP_WALL_PATTERNS` / `BACKDROP_FLOOR_PATTERNS` (fonctions `(id, palette)` →
  `<pattern>`), `BACKDROP_CEILINGS`, `BACKDROP_PROPS` (`{ markup(opts, palette), light(opts) }`, origine
  = point de fixation au mur ; `light()` décrit la source dont `composeBackdrop()` tire un halo au mur et
  au sol). Fiche = palette + mur + sol + plafond + accessoires muraux (`props`) + accessoires au sol
  (`floorProps` : rails, flèches, brume, vapeur — dessinés après le sol, toujours derrière les
  combattants) + débris. Une fiche par quartier (clé = nom exact de `districts.js`, aussi thème des
  étages urbains, lu via `resolveBackdropKey(gameState.currentDistrict)`) ; `SCENE_BACKDROPS.default`
  ne sert que de repli. `combat-scene.js` exige que CHAQUE quartier de `districts.js` ait sa fiche
  (≥ 3 types d'accessoires, ≥ 1 source de lumière, mur distinct des autres quartiers) : ajouter un
  quartier sans décor fait échouer les tests. `composeBackdrop(def, prefix)` (pure) produit
  3 couches — fond (mur, ombres, plafond), milieu (halos, accessoires), avant-plan (sol, halos au sol,
  débris, vignette) — avec des identifiants préfixés par scène. `renderSceneBackdrop()` ne redessine
  que si la clé change (`lastBackdropKeys`), jamais à chaque `updateUI()`. Animations CSS uniquement
  (`.bd-flame`, `.bd-halo-flicker`, `.bd-neon-flicker`, `.bd-spin`, `.bd-blink`, `.bd-steam`,
  `.bd-float`, `.bd-dust`, `.bd-crackle`, `.bd-ripple`, `.bd-mist`), coupées sous `prefers-reduced-motion`. Aucun
  `Math.random()` dans un décor (positions fixes, voir `BACKDROP_DEBRIS`). Le décor ne touche jamais à
  `distanceToX()`, aux gabarits ni aux bandes de portée ; il reste plus sombre et moins saturé que les
  personnages. Toute fiche est validée automatiquement par `tests/regression/combat-scene.js`.
  **`renderScene(mode)`** est le point d'entrée unique de toutes les scènes : `'combat'` appelle
  `renderCombatScene()` (rendu inchangé), `'merchant'`/`'trainer'` la scène de `#shop-zone` (appelée par
  `updateShopUI()`), `'safehouse'` la scène de `#safehouse-choice-zone` (appelée par `enterRoom()`),
  `'explore'` la scène d'exploration (appelée par `setSceneHeader()`), `'stairs'` celle de l'écran
  d'escalier (`triggerFloorTransition()`), `'gameOver'` l'écran de mort ; un mode inconnu ne fait rien.
  **Crawler équipé** (chantier « sprites & effets », phase 1) : le crawler est composé en COUCHES
  (`CRAWLER_PARTS` base/torse/tête + un bras avant par posture `CRAWLER_ARMS`, sprites/crawler.js) par
  `composeCrawler(loadout)` (scene.js, pure), utilisé par TOUTES les scènes (combat, exploration,
  marchand/professeur, salle sécurisée, escalier) via `currentCrawler()`/`renderCrawlerInto()` (redessin
  seulement si la clé posture+équipement change ; `renderScene('crawlers')`, appelé par `updateUI()`,
  rafraîchit les scènes hors combat déjà affichées). **Posture = dernière attaque utilisée**
  (`gameState.lastAttackKind`, posé par `attackWeapon/attackRanged/attackUnarmed/attackMagic/
  attemptEngage` juste après `tryPlayerAction()`, sauvegardé avec le reste) : `weapon` (arme de mêlée
  levée), `ranged` (arme à distance pointée ; `rangedLowered` canon baissé en combat au contact),
  `magic` (paume ouverte + lueur à la couleur du sort, `CRAWLER_SPELL_GLOWS` par icône), `boxer` (mains
  nues, garde haute, un poing devant le visage) — `crawlerPosture()` retombe sur arme > distance > sort >
  poings si l'objet de la dernière attaque n'est plus équipé. L'arme non tenue est rangée (mêlée à la
  hanche, distance en travers du sac), l'armure est portée en surimpression du torse (jamais la tête ni la
  main). Sprite d'un objet : `resolveItemSpriteKey(item)` — `item.baseName` (nom d'origine, posé par
  `generateItem()`/`generateWelcomeGiftItem()`/`generateTestKitItem()`), sinon nom exact (objets
  signature), sinon plus long nom connu par lequel le nom commence (anciennes sauvegardes sans
  `baseName`), sinon `generic:<catégorie>`. **Sprites d'objets** (phase 2) : `{ kind, art, tip, layer?,
  icon? }` — `kind` 'melee' (prise à l'origine, tête vers le haut), 'ranged' (bouche vers la gauche),
  'armor' (dessinée dans le repère du crawler, `layer: 'back'` pour le dos/une cape, derrière le torse) ;
  `tip` = point où scintillent les **enchantements** (`enchantSparks()` : une étincelle `.ench-spark` par
  mécanique, à sa couleur `ENCHANT_COLORS`, sur l'arme tenue et l'armure). **Icônes** : `itemIconSvg(item,
  size)` (scene.js) réutilise le même dessin, recadré (`sprite.icon` ou `ITEM_ICON_TRANSFORMS[kind]`, repère
  -24..24, écrit `scale(s) translate(-cx -cy)`), avec une pastille par enchantement — utilisée pour
  l'équipement porté, les cartes de l'inventaire et les listes achat/vente de la boutique (parchemins :
  aucune icône). `combat-scene.js` vérifie postures, ordre des couches, résolution des sprites, que chaque
  attaque fixe la posture, et que CHAQUE objet de `baseItems` et CHAQUE objet signature de `districtBosses`
  a son propre sprite du bon type (un objet ajouté sans dessin fait échouer les tests). **Consommables** :
  pas de sprite, `itemIconSvg()` dessine une fiole (`consumableFlaskArt()`, couleurs `CONSUMABLE_FLASKS`
  dans `sprites/items-generic.js`) selon `consumableFlaskKind(item)` — rouge = PV, bleu = mana seul,
  moitié-moitié = PV et mana ; le bouton de la barre de raccourci / de l'inventaire prend la bordure du
  même type.
  **Effets d'attaque** (phase 3, `fx.js` + catalogue `sprites/fx.js`) : chaque attaque se joue en 3 temps
  — anticipation (l'attaquant s'arme : `.scene-pose`, objet tenu `.crawler-held` via sa transformation de
  repos `data-t`, poing avant `.crawler-front`, lueur `.crawler-spell-glow`), action (traînée d'arme en
  croissant à la couleur du 1er enchantement, estoc, projectile(s) avec traînée, jet continu, sort) puis
  impact (micro-gel `FX_HITSTOP_MS` 40 ms + éclat `FX_IMPACTS`). Points d'entrée appelés par app.js :
  `playPlayerAttackFx(kind, opts, onImpact)` (depuis `performPlayerAttack()`, `kind` =
  `gameState.lastAttackKind`), `playMobAttackFx(enemy, opts, onImpact)` (depuis `executeBossStrike()` et
  `resolveNonBossCounterAttack()` ; tir si écart > 0, sinon attaque au contact de son archétype, à la
  couleur de son effet `MOB_EFFECT_FX_COLORS`) et `playSpellBackfireFx()` (sort raté). **Purement visuel** :
  les dégâts sont appliqués AVANT l'effet ; `onImpact` affiche le chiffre, la secousse du combattant et,
  pour un coup lourd, secousse d'écran + flash (`triggerHeavyImpact()` — côté joueur : attaque furtive et
  charge seulement ; côté mob : télégraphe exécuté, ruée d'enrage, phase 3). Les barres de vie de la scène
  attendent l'impact (`sceneVitalsHold`, scene.js, posé/levé par fx.js). Règles : impact toujours avant
  `FX_MAX_IMPACT_MS` (260 ms < `COMBAT_BEAT_MS`, pour voir le coup fatal avant victoire/Game Over) ; un
  nouvel effet du même attaquant termine le précédent (multi-coups, `opts.fast` sans élan) ; le skip
  (`combatSkipRequested`, remis à faux par `tryPlayerAction()`) termine l'effet en cours ; sous
  `prefers-reduced-motion`, rien ne bouge mais traînée / trajectoire (pointillés) sont dessinées d'un coup
  puis s'estompent ; sans `requestAnimationFrame` (tests Node), rien n'est dessiné et `onImpact` est
  immédiat. Aucun `Math.random()` (zigzag des éclairs : `fxJitter()`). Spécifications pures et testées :
  `playerAttackFxSpec(kind)`, `mobAttackFxSpec(enemy, ranged)`. Catalogue : `MELEE_SWING_STYLES`
  (slash/smash/thrust, angles `FX_SWING_ANGLES`) et `MELEE_IMPACTS` par arme, `RANGED_PROJECTILES` →
  `FX_PROJECTILES`, `FX_SPELLS` par icône de sort, `MOB_ATTACK_STYLES`/`MOB_RANGED_PROJECTILES` par
  archétype. `combat-scene.js` exige une entrée pour CHAQUE arme dessinée, chaque sort, chaque archétype
  et chaque effet de mob.
  **Scène d'exploration** (`#explore-scene`, remplace l'ancienne carte à jouer) : `setSceneHeader(icon,
  title, typeLabel, scene)` pose le type (pastille en haut à gauche), le titre et la vignette — nom
  (`'treasure'`, `'trap'`…) ou `{ key, enemy }` ; sans 4ᵉ argument ou nom inconnu, l'emoji `#explore-icon`
  recouvre la scène (qui reste visible, c'est aussi le bouton Explorer — `overlayIcon`).
  `showFloorArrivalScene()` pose la scène d'arrivée (quartier, ou ville de départ sur un étage urbain) à
  chaque nouvel étage, au lancement et à la restauration d'une sauvegarde. Salle sécurisée et ville
  spécialisée ont leur propre scène : la scène d'exploration s'y efface (titre + dernière ligne gardés).
  `EXPLORE_VIGNETTES` (scene.js, fonctions pures) : calme (`silence`, `ambiance` drone caméra de
  l'émission, `knownPath` craie « DÉJÀ VU », `emptyLair` couronne tombée, `floorCleared`, `fled`), butin
  (`treasure`, `minorFind`, `gold`, `audienceGift` colis parachuté), danger (`trap`, `timeLoss` horloge
  qui s'emballe, `cafeteria`), rencontre (`crawlerFriendly`/`crawlerHostile`, silhouette de compagnon
  agrandie), furtivité (`stealthUnseen` mob de dos + crawler caché derrière une caisse, `stealthEvaded`),
  combat (`combat`, `bossSpotted`, `victory`/`bossVictory` mob à terre via `mobAt(enemy, x, pose)`),
  `pact` (autel), `stairs`, `citySafe`, `urbanGuardian`, `lairSpotted`. Décor du quartier courant en fond
  (préfixe `'ebd'` pour l'exploration, `'fbd'` pour l'escalier), vue complète 360 x 150
  (`FULL_SCENE_VIEW`), crawler à `CRAWLER_X` comme en combat (passage exploration -> combat continu) —
  toute vignette doit tenir dans la scène. `renderVignetteScene()` ne redessine que si
  vignette/ennemi changent (`vignetteKeys`). Les accessoires correspondants vivent dans `BACKDROP_PROPS`
  (`treasureChest`, `coinPile`, `pouch`, `parachuteCrate`, `cameraDrone`, `spikeTrap`, `bigClock`,
  `chalkMarks`, `fallenCrown`, `checkedMap`, `dustPuff`, `darkCafeteria`, `stairsDown`, `pactAltar`).
  `combat-scene.js` lit `app.js` et exige que chaque vignette nommée par un `setSceneHeader()` existe :
  une faute de frappe dans un nom fait échouer les tests au lieu de retomber silencieusement sur l'emoji.
  **Étages urbains (scènes)** : sur un étage urbain (`isUrbanFloor()`), le combat ne se
  déroule jamais dans le décor du quartier — `resolveCombatBackdrop()` choisit
  `URBAN_COMBAT_BACKDROPS.road` (asphalte, glissière, panneau autoroutier, épave : combats de route et
  gardien de l'escalier) ou `URBAN_COMBAT_BACKDROPS.lair` (pierre, torches à lueur rouge,
  crochets, crânes) pendant une plongée (`gameState.pendingLairDive`) ; étage classique inchangé.
  Pendant une plongée, `#scene-lair-progress` (haut de la scène) affiche un pion par sbire (plein =
  vaincu, cerclé de rouge = en cours) puis la couronne du boss (`lairProgressState()`/
  `composeLairProgress()`, total = `lair.combatsRemaining`). Vignettes : `urbanGuardian`
  (escalier ou porte « SORTIE » à l'étage final, le boss couronné posté DEVANT, entre elle et le
  crawler), `lairSpotted` (entrée de repaire défoncée, lueur rouge), `citySafe` (panneau au nom de la
  ville, sur sa place et au début d'un étage urbain), `pickpocket` (crawler louche qui file).
  **Écran Game Over** (`renderScene('gameOver', { cause })`, appelé par `gameOver()`, remplace l'ancien
  emoji 💀) : seule scène VUE DE DESSUS — sol du quartier de la mort (même motif de sol que son décor),
  cadavre `SCENE_CORPSE_TOPDOWN_SVG` (sprites/crawler.js, face contre terre, sac encore sur le dos) dans
  `GAME_OVER_BLOOD_POOL` (s'étale une fois, `.go-blood-spread`), deux plots jaunes de scène de crime
  (`evidenceMarker()`), mouches (`.go-fly`), et un indice par cause (`GAME_OVER_CAUSE_PROPS` : empreintes
  griffues pour `combat`, plaque à pointes pour `trap`, traînée de sang pour `bleed`, brûlure + grimoire
  fumant pour `backfire`, gravats + sablier pour `timeout`). `composeGameOverScene(cause, district,
  prefix)` est pure (préfixe `'gbd'`). `combat-scene.js` exige un indice distinct pour CHAQUE cause de
  `EPITAPH_TEMPLATES` (hors pool `mobFaible`) : une nouvelle cause de mort sans indice fait échouer les
  tests.
  **Scène des villes spécialisées** (`#shop-scene-svg`, au-dessus des listes d'achat/vente et des
  boutons, qui restent intacts) : même décor du quartier courant (préfixe `'sbd'`, jamais d'identifiant
  partagé avec la scène de combat `'cbd'`), crawler à `CRAWLER_X`, ni barres de vie ni bandes de portée.
  Mise en scène à gauche, `composeShopSetpiece(role, specialty, prefix)` (pure) : marchand = enseigne néon
  (`shopSign`, style `SHOP_SIGN_STYLES[city.specialty]` — icône, libellé et couleur distincts pour
  weapons/ranged/armors/scrolls, largeur calée sur le libellé) + PNJ `SCENE_MERCHANT_SVG` derrière un
  comptoir (`shopCounter`, marchandises de la spécialité posées dessus) ; professeur = tableau noir
  (`chalkboard`, croquis + libellé `TRAINER_BOARD_STYLES[city.specialty]`, une entrée par compétence de
  `gameState.skills`) + PNJ `SCENE_TRAINER_SVG` qui le désigne de sa baguette. Redessinée seulement quand
  `rôle:spécialité` change (`lastShopSetpieceKey`).
  **Scène de salle sécurisée** (`#safehouse-scene-svg`, au-dessus des boutons Sieste/Sommeil/Partir) :
  décor PROPRE à l'abri, jamais celui du quartier (les décors de quartier contiennent du rouge) —
  `safehouseBackdropFor(type)` (backdrops.js, pure) = `SAFEHOUSE_BACKDROP` (béton chaud, porte blindée
  `armoredDoor`, panneau `safeZonePanel` « ZONE SÛRE », applique) + `SAFEHOUSE_SIGNATURES[room.safehouse.name]`
  (accessoires signature par type de `safehouses.js`, à gauche de la porte ; type inconnu → base seule),
  dessinée par le même `composeBackdrop()` (préfixe `'hbd'`, `renderSceneBackdrop(..., def)` accepte une
  fiche hors `SCENE_BACKDROPS`), redessinée seulement quand le type change. Éclairage apaisé : halos
  `light.calm` (classe `.bd-calm-glow`, respiration 6 s) et flammes `.bd-calm-flame` (3,4 s), coupés sous
  `prefers-reduced-motion`. `combat-scene.js` exige une signature pour CHAQUE type de `safehouses.js`
  (rendue, distincte des autres), aucune couleur rouge (`isRedHex()`) ni animation rapide
  (`bd-flame`/`bd-halo-flicker`/`bd-neon-flicker`…) : ajouter un type sans signature fait échouer les tests.
