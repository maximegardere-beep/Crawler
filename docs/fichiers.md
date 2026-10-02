# Fichiers — description détaillée (extrait de `CLAUDE.md`)

> Fiche lue à la demande ; la carte compacte est dans `CLAUDE.md`. `app.js` d'origine est désormais découpé en `engine/*.js` (voir la table dans `CLAUDE.md`).

- `index.html` — UI (scène d'exploration, combat, inventaire, grimoire, carte de l'étage, Game Over/Victoire)
- `app.js` — moteur : état, exploration, combat, niveau/XP, compétences, équipement, magie/mana, compagnons, carte d'étage
- `bestiary.js` — monstres de base + boss de quartier (`districtBosses`)
- `items.js` — objets de base, raretés (`itemRarities`), réglages du loot (`itemBalance`), qualificatifs (`itemQualifiers`)
- `spells.js` — grimoire de sorts (`spellCatalog`), catégories corps à corps/à distance
- `districts.js` — quartiers (référencent les monstres par nom)
- `safehouses.js` — types de salles sécurisées (narratif seul pour l'instant)
- `generator.js` — génération procédurale (mobs, objets, parchemins de sorts, boss, compagnons)
- `anomalies.js` — catalogue et résolution des anomalies d'étage (`ANOMALY_CATALOG`, tirage, hook `appliquerAnomalie()`)
- `achievements.js` — chronique de run et succès (catalogue pur `ACHIEVEMENTS`, paliers, `createEmptyRunStats()`,
  indice de domination `computeDominance()`), chargé juste après `anomalies.js`
- `origins.js` — races et classes (chantier 13, lot 0, voir `CHANTIERS.md`) : catalogue PUR (`ORIGIN_RACES`, `ORIGIN_CLASSES`,
  `ORIGIN_SYNERGIES`, conditions de déblocage et de jouabilité) et tirage des 3 cartes d'un écran de choix `pickOriginOffers(kind, state, rng)`
  (hasard injectable) ; les passifs de race sont branchés dans `app.js` (lot 1, section « RACE : PASSIFS », `config.origins.races`), écrans de choix de la race puis de la classe à l'étage 3 (lot 2 : `triggerOriginChoice()`, `confirmOriginChoice()`, badges `#race-status`/`#class-status`, fiche `openOriginSheet()`, `gameState.race`/`crawlerClass`, états bloquants `raceChoicePending`/`classChoicePending`), passifs de style et capacités actives des classes (lot 3 : `config.origins.classes`/`synergies`, `useClassAbility()`, `CLASS_ABILITIES`, bouton `#btn-class-ability`, `gameState.classAbilityUsed`), habillage (lot 5 : piques DeathWatch prioritaires `priority`, 6 succès, `EPITAPH_RACE_MENTIONS`, `playClassAbilityFx()`) ; chargé après `achievements.js`, avant `deathwatch.js`
- `deathwatch.js` — émission DeathWatch (catalogue pur : présentateur, piques à trous (avec `theme`),
  répliques par thème de pique et par ton, réactions, `pickShowTaunt()`/`getShowReplyLines()`/
  `fillShowTemplate()`), chargé juste après `achievements.js`
- `floorgen.js` — génération PURE des étages (chantier 5, voir `NOTES_CARTE.md`) : réglages
  `FLOOR_LAYOUT`, catalogues `ROOM_TYPES`/`ZONE_TYPES`, `generateBorough()` (hasard injectable,
  `createFloorRng(seed)`), mesures `measureBorough()` ; étages urbains (chantier 12, voir `NOTES_VILLES.md`) :
  `METRO_LAYOUT`, `generateMetropolis()`, `measureMetropolis()` ; chargé après `deathwatch.js`
- `floormap.js` — rendu PUR de la carte stylisée des étages classiques et urbains (`buildFloorMapSvg()`,
  `buildUrbanMapSvg()`, `floorMapHitTest()`, zooms `FLOOR_MAP_ZOOMS`), chargé après `floorgen.js`
- `minigames.js` — mini-jeux (chantier 6, voir `NOTES_MINIJEUX.md`) : catalogue PUR des épreuves (`MINIGAME_KINDS`),
  jet automatique, résolution du « timing », spécification des animations d'issue ; chargé après `floormap.js`
- `minigames-ui.js` — hôte DOM des mini-jeux (`startMinigame()`, bande du bas, minuterie, rendus `MINIGAME_RENDERERS`,
  réglage Jouer / Réduit / Jet automatique) ; chargé après `fx.js`, avant `app.js`
- `sprites/` — silhouettes SVG des scènes, **découpées en petits fichiers thématiques** (pour ne relire/modifier
  que le fichier concerné) : `crawler.js` (crawler + cadavre vu de dessus), `npcs.js` (compagnon, marchand,
  professeur), `mobs.js` (10 silhouettes d'archétype avec palette naturelle, couronne de boss),
  `mob-details-a.js`/`mob-details-b.js` (`MOB_DETAILS` : détail signature + palette de chacun des 39 mobs
  de `baseMobs`, clé = nom exact), `mob-auras.js` (`MOB_EFFECT_AURAS` : une aura par effet de mob), `bosses-a.js`/`bosses-b.js`
  (`SCENE_BOSS_SPRITES` : sprite unique de chaque boss, clé = nom exact, avec `held` = objet signature
  tenu/porté),
  `items-generic.js` (registre
  `ITEM_SPRITES` des sprites d'équipement, dessins génériques de repli par catégorie, cadrages d'icône
  `ITEM_ICON_TRANSFORMS`, couleurs d'enchantement `ENCHANT_COLORS`), puis un dessin par objet, clé = nom
  exact, ajoutés au registre par `Object.assign` : `items-melee.js` (18 armes de mêlée), `items-ranged.js`
  (13 armes à distance), `items-armor.js` (17 armures), `items-signature.js` (13 objets signature de boss),
  et `fx.js` (catalogue des effets d'attaque : style de coup par arme, projectiles, sorts, attaques de mob,
  éclats d'impact). Tous chargés avant `backdrops.js`/`scene.js`,
  même ordre dans `index.html` et `tests/load_game.js` (`GAME_FILES`) — un nouveau fichier doit être ajouté
  aux DEUX.
- `backdrops.js` — décors des scènes : catalogue pur (motifs de mur/sol, plafonds, accessoires, fiches de décor `SCENE_BACKDROPS`, enseignes/tableaux des villes spécialisées)
- `scene.js` — rendu des scènes en vue latérale et de leur décor (`distanceToX()`, `composeBackdrop()`, point d'entrée unique `renderScene(mode)`)
- `fx.js` — effets d'attaque de la scène de combat (moteur en 3 temps, chargé après `scene.js`, avant `app.js`)
- `tests/` — voir plus bas
- `CHANTIERS.md` — registre des chantiers (statut, décisions, point d'étape, voir « Chantiers »)
- `NOTES_*.md` — notes détaillées d'un chantier (diagnostic, chiffres, tests, « À surveiller en playtest ») :
  `COMPAGNONS`, `ORIGINES`, `DEBUT_DE_PARTIE`, `SUCCES`, `CHASSEURS`, `DEATHWATCH`, `CARTE`, `INTERFACE`, `ITEMS`, `SORTS`, `VILLES`, `MINIJEUX`, et pour les
  chantiers antérieurs au registre `COMBAT`, `LISIBILITE_COMBAT`, `QOL_EQUILIBRAGE`

