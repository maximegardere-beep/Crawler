# Crawler

Rogue-like textuel minimaliste inspiré de Dungeon Crawler Carl. GitHub Pages, HTML/JS vanilla +
Tailwind CDN, **aucun build step**.

## Fichiers
- `index.html` — UI (scène d'exploration, combat, inventaire, grimoire, carte de l'étage / "Carte Urbaine", Game Over/Victoire)
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
- `deathwatch.js` — émission DeathWatch (catalogue pur : présentateur, piques à trous (avec `theme`),
  répliques par thème de pique et par ton, réactions, `pickShowTaunt()`/`getShowReplyLines()`/
  `fillShowTemplate()`), chargé juste après `achievements.js`
- `floorgen.js` — génération PURE des étages classiques (chantier 5, voir `NOTES_CARTE.md`) : réglages
  `FLOOR_LAYOUT`, catalogues `ROOM_TYPES`/`ZONE_TYPES`, `generateBorough()` (hasard injectable,
  `createFloorRng(seed)`), mesures `measureBorough()` ; chargé après `deathwatch.js`
- `floormap.js` — rendu PUR de la carte stylisée des étages classiques (`buildFloorMapSvg()`,
  `floorMapHitTest()`, zooms `FLOOR_MAP_ZOOMS`), chargé après `floorgen.js`
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
- `CHANTIERS.md` — registre des chantiers planifiés (voir « Gros chantiers à venir »)

## Architecture (résumé)
- **Étage classique = un « borough »** (chantier 5 « rework de la carte », voir `NOTES_CARTE.md`) :
  `generateFloorMap()` habille le résultat du générateur PUR `generateBorough()` (`floorgen.js`) —
  4 blocs de quartier (2 × 2, un quartier chacun) séparés par des **avenues** (croix + anneau, 12
  tronçons = salles de la zone `avenue`, `quadrant: null`). Chaque bloc : 12-14 salles rectangulaires
  (géométrie réelle `x/y/w/h` en cases, taille S/M/L), jamais collées, reliées par un arbre couvrant
  minimal + 1-3 boucles courtes (aucun couloir croisé), grande salle de boss à ≥ 3 salles des 2-3
  **portes** qui donnent sur les avenues (jamais dans un boss), 1-2 salles sûres à mi-profondeur. Tout
  réglage dans `FLOOR_LAYOUT` ; ajouter un type de salle = une entrée de `ROOM_TYPES` (+ son effet dans
  `enterRoom()`), une zone = une entrée de `ZONE_TYPES`. `npm run sim:floors` mesure la qualité sur des
  centaines d'étages. Départ aléatoire hors de danger (`pickSafeStartRoom()` : salle ordinaire ou
  avenue, ≥ 3 salles de tout boss) ; sur une avenue, le quartier courant (décor, mobs) reste le dernier
  bloc traversé (`moveToFloorRoom()`, `roomDistrict()`, `roomZone()`). Couloirs `{ to, length, cost,
  kind: 'corridor'|'door'|'avenue' }` : `computeDistance()`/`computeFloorPath()` (Dijkstra) somment les
  `cost` = longueur réelle / `cellsPerDistanceUnit` × `ZONE_TYPES[zone].travelMult` (avenues ×0,5 :
  temps ET risque de trajet deux fois moindres). Table d'événements par zone : `getZoneEventTable()`
  (`config.chances` dans un bloc, `config.avenueChances` sur une avenue : moins de combats/pièges, plus
  de crawlers, PO et cadeaux du public) ; chasseurs de primes ×2 sur les avenues
  (`ZONE_TYPES.avenue.hunterMult`, `maybeSpawnBountyHunter()`). `gameState.floorMap.version` =
  `FLOOR_MAP_VERSION` : une sauvegarde d'un format antérieur voit son étage en cours regénéré à la
  restauration (même numéro d'étage), le crawler garde tout le reste.
- 1 boss par quartier ; l'escalier est gardé par l'un des 4. "Repérer et partir" garde le même mob
  en cache sur sa pièce (marqué 👑 sur la carte), combattable plus tard en y retournant par la carte.
- **Carte + voyage** (plus de liste « Lieux connus ») : `#floor-map-overlay` (panneau sous la scène,
  ouvert/fermé par `#btn-toggle-map` comme la Carte Urbaine, masqué pendant une situation), rendu par
  `buildFloorMapSvg()` (`floormap.js`) : blocs teintés (nom du quartier une fois visité, sinon « ??? »),
  avenues toujours visibles, brouillard (salle visitée pleine, *aperçue* — voisine d'une visitée,
  `isRoomSeen()` — en pointillé « ? », inconnue invisible), repères `listFloorLandmarks()` DÉRIVÉS des
  salles (👑 boss repéré, 🪜 escalier libre, salle sûre visitée — aucun registre séparé), pion du crawler.
  Zoom ＋/－ (`zoomFloorMap()`, `FLOOR_MAP_ZOOMS`), ◎ (`recenterFloorMap()`), glissement souris/tactile
  (`attachFloorMapPointerHandlers()`, attaché UNE fois ; tap résolu par `floorMapHitTest()` en coordonnées
  monde). Vue/zoom/sélection = variables de module (préférences d'affichage, jamais sauvegardées).
  Toucher une salle visitée ou aperçue → bulle `#floor-map-bubble` (`describeFloorMapTravel()` : temps,
  risque) → « Y aller » (`confirmFloorMapTravel()` → `travelToRoom()`). **M1** : vers une salle visitée,
  trajet par le chemin CONNU (`planTravelToRoom()`, seulement des salles visitées), temps
  `max(1, round(distance/2))`, embuscades `computeAmbushBaseChance()`, arrivée par `enterRoom()`.
  **P1** (explorer depuis la carte, choix de l'utilisateur à la place de portes N/S/E/O dans la scène) :
  vers une salle aperçue, trajet jusqu'à sa voisine visitée la plus proche puis le pas d'exploration
  dans l'inconnu (`performExploreStep(targetRoomId)`, −1 H, événement tiré) — un seul geste
  (`gameState.pendingTravel.exploreRoomId`). Toucher la scène reste l'exploration au hasard ; sans voisin
  inconnu, `autoTravelToNearestFrontier()` file vers la salle aperçue la plus proche (`findNearestSeenRoom()`).
- Salles sécurisées : pièces fixes, thème tiré dans `safehouses.js`, marquées sur la carte dès l'entrée.
  **Entrée à choix explicite** (chantier "QoL/équilibrage", voir `NOTES_QOL_EQUILIBRAGE.md`) : plus de
  soin automatique — `enterRoom()` pose `gameState.safehouseChoicePending`/`pendingSafehouseRoomId`
  (inclus dans `isActionBlocked()`) et affiche `#safehouse-choice-zone`, même famille que
  `#boss-choice-zone`. **Trois options** : `restAtSafehouse('nap')` (Sieste, `config.safehouse.nap` :
  2H, 25 % des PV PERDUS) et `restAtSafehouse('sleep')` (Sommeil réparateur, `config.safehouse.sleep` :
  8H, 100 % des PV perdus), la même part du mana manquant si un sort est équipé
  (`safehouseRestAmounts(kind)`, pure — en pourcentage plutôt qu'en valeur absolue pour rester juste à
  tous les niveaux ; soin ensuite réduit par PEAU_DE_VERRE via `applyPlayerHeal()` comme tout soin),
  gratuits en temps sous REPAS_DE_FAMILLE (anomalies.js) ; `leaveSafehouse()` (Partir) reste gratuit,
  sans effet — la salle reste de toute façon marquée sur la carte dès l'entrée, quelle que soit
  l'issue. `updateSafehouseRestButtons()` écrit sur chaque bouton son coût et ce qu'il rendra. Garde-fou :
  chaque bouton (`#btn-nap-safehouse`/`#btn-sleep-safehouse`) est désactivé dès l'affichage si SON coût
  ferait tomber `timeLeft` à 0 (`canRestAtSafehouse(kind)`), doublé d'une vérification identique dans
  `restAtSafehouse()` elle-même (sécurité redondante) — un repos ne peut donc structurellement jamais
  amener `timeLeft` à 0.
- Exploration = toucher la scène d'exploration (`#explore-scene`, -1H) : jamais de choix bloquant de
  navigation. **Plus de carte à jouer** : la scène (vignette de l'événement, voir « Scène d'exploration »
  plus bas), son titre (`#explore-title`) et la DERNIÈRE ligne du journal (`#explore-last-line`, écrasée
  par chaque `logEvent()` hors combat) sont le seul affichage minimal ; tout le détail va dans le
  journal complet (repliable).
- **Combat à distance** : aucune posture côté joueur — seul `mob.ranged` détermine l'écart de départ
  (`gameState.combatDistance`, 0 si mêlée). Arme/Mains nues exigent l'écart nul, Tir l'écart > 0 (+
  arme à distance équipée pour Tir, arme pour Arme) : ce sont de simples dégâts gated par l'écart
  courant, sans manche de distance embarquée. `attemptSprint()` (S'approcher) et `attemptRetreat()`
  (S'éloigner) sont les DEUX SEULES actions qui font évoluer l'écart, toujours affichées pendant un
  combat et grisées à l'extrémité correspondante (écart nul / maximal) plutôt que masquées ; chacune
  oppose un jet avantagé du joueur à un jet du mob, jamais de dégâts — SAUF **ruée** :
  au-delà d'une marge de victoire du mob (`config.rangedCombat.rushMarginThreshold`, 3), un mob de
  MÊLÉE comble l'écart d'un coup et frappe immédiatement ce tour-ci, quel que soit l'écart de départ —
  sans ça, un joueur à l'écart maximal devient mathématiquement increvable (le delta d'une manche
  normale ne peut jamais dépasser `dieSides-1`). En dehors d'une ruée, un mob de mêlée ne peut pas
  toucher un joueur qui tient encore la distance (`getCombatRangeContext().playerAdvantaged`) ; toute
  riposte passe par `resolveEnemyReaction()` (bloque, ou fait avancer le mob d'une manche s'il n'a pas
  déjà agi ce tour, avec ruée possible) plutôt que par `enemyCounterAttack()` en direct, pour ne jamais
  laisser un mob de mêlée figé hors de portée. Chaque manche CONTESTÉE (jet de distance, via
  `resolveDistanceRound()`, `attemptSprint()` ou `attemptRetreat()`) consomme aussi un peu de
  `gameState.timeLeft` (`config.rangedCombat.timeCostPerRound`), jamais les tours d'attaque standards —
  un combat kité de bout en bout a donc un coût en temps réel, pas seulement en risque.
- **Furtivité** : détection avant rencontre aléatoire (plafond 60%), Esquiver (plafond 70%) / Attaque
  Furtive (bonus x2 garanti). Un échec d'esquive laisse le mob "alerted" (`enemy.alerted`) pour tout le
  combat qui suit : `attemptFlee()` y est bloqué, pour que la boucle "esquive ratée sans conséquence"
  ne reste pas totalement gratuite.
- **Compagnons** (chantier « rework des compagnons », voir `NOTES_COMPAGNONS.md`, chiffres dans
  `config.companions`) : 4 spécialités. Stats de base indexées sur l'étage à l'embauche
  (`generateCompanionCandidate(floor)`, même `getFloorScaling()` que les mobs), +10 % par niveau
  (`computeCompanionLevelStats()`, pure — generator.js, section 3, avec `getCompanionAtk()`/
  `getCompanionDef()` = stats + arme/armure données, `companionGiftLoyalty()`,
  `companionDepartureChance()`, `normalizeCompanion()` pour migrer une sauvegarde d'avant le rework).
  **Loyauté** 0-100 (départ 60) au lieu de `leaveChance` : victoire +2, repos partagé +5/+10, fuite −5,
  à terre −10, dons ; **départ uniquement au changement d'étage** (`attemptCompanionDeparture()` dans
  `advanceToNextFloor()`) sous 40 de loyauté, départ pacifique (il garde ses cadeaux). À 0 PV :
  **à terre** (`companion.downed`, `checkCompanionDowned()`), reste dans le groupe mais n'agit plus
  jusqu'à un repos ou une potion — tout effet passe par `activeCompanion()`/`hasActiveCompanion(type)`.
  PV régénérés comme le joueur et rendus au repos. Coups encaissés : `companionInterceptHit()` (seul point,
  mobs et boss). Aide : `companionCombatSupport()` (après chaque attaque du joueur : sort donné, Frappe
  d'appoint, coup d'opportunité), `companionMedicAfterRiposte()`, `onCompanionVictory()` ; hors combat :
  pièges (Éclaireur), PO (Frappe), embuscades (`computeAmbushBaseChance()`, Garde). **Dons** :
  `giveItemToCompanion()`/`giveSpellToCompanion()`/`giveConsumableToCompanion()` (action « Donner à »
  des panneaux d'inspection via `companionGiveAction()`), emplacements `companion.gear` arme (mêlée ou
  distance)/armure/sort, l'ancien objet revient au joueur, loyauté une seule fois par objet
  (`item.companionGifted`). Fiche : `#companion-status-bar` → `openCompanionSheet()` (potion, Congédier
  avec confirmation → `dismissCompanion()`, qui rend les cadeaux).
- **Objets** (chantier "refonte des objets", voir `NOTES_ITEMS.md` pour les chiffres et la courbe
  visée) : TOUT objet (arme, distance, armure, consommable, parchemin, signature de boss, cadeau, kit de
  test) passe par les constructeurs uniques de `generator.js` (`buildItem()`/`buildSpellScroll()`/
  `buildSignatureItem()`). Deux axes de puissance : **niveau d'objet** (`item.itemLevel` = étage
  d'obtention, +1 pour un boss de repaire ; stats × `1 + itemBalance.levelScaling.equipment × (niveau−1)`,
  soins à `levelScaling.heal`, jamais le mana ni le coût en mana) et **rareté** (`itemRarities`, 5
  paliers : Camelote ×0,7 / Commun ×1 / Rare ×1,25 / Épique ×1,5 / Légendaire ×1,8 — slots de
  qualificatifs, rang maximal, `valueMult`). Les meilleurs objets de base ont une profondeur minimale
  (`minFloor`, `pickBaseItem()`). Rareté tirée selon l'ÉTAGE (`rollLootRarity({ source, floor })`,
  tables `itemBalance.lootTables` — refonte validée du chantier 10 : Légendaire « miraculeux » avant l'étage
  10, vrai espoir vers le 15), plus selon la puissance du monstre : `source` 'elite' (20 % de +1 palier),
  'boss' (+1 palier, plancher `getBossMinRarityKey()` : aucun aux étages 1-3, Rare dès 4, Épique dès 12),
  'treasure' (+1 palier) ; `luckChance` (qualificatif Chanceux porté). Plafond des montées
  (`itemBalance.upgradeCaps`, `getUpgradeCapRarity()`) : jusqu'à l'étage 4, une montée ne dépasse jamais
  Épique — seul le tirage de base peut aller au-delà, et il n'est jamais rabaissé. Valeur marchande
  `computeItemValue()` → `item.value` (rareté × niveau d'objet × qualificatifs), lue via `getItemValue()`
  (repli `baseValue` pour un objet construit à la main) par la revente et le marchand.
  **Qualificatifs** (`itemQualifiers`, clé = mécanique, aussi copiée dans `item.mechanics` pour le rendu) :
  `item.qualifiers = [{ key, rank }]`, rang I-III = `rarity.maxRank` (Rare I, Épique II, Légendaire III ;
  signature au rang maximal de SA rareté). Chaque qualificatif définit ses valeurs PAR CIBLE (`weapon` = mêlée et
  distance, `armor`, `spell`) et sa phrase d'inspection `text(v)` à côté des chiffres qu'elle décrit —
  `getQualifierValues()`/`describeQualifier()` (generator.js) sont la SEULE source des chiffres, lue à la
  fois par le moteur et par l'affichage. Trois types : `proc` (chance par coup porté/encaissé,
  `triggerItemQualifiers()`/`resolveQualifierEffect()`), `passive` (Aiguisé, Précis, Perforant — lus
  par `performPlayerAttack()` via `options.gear` ; Silencieux, Véloce, Chanceux — `sumEquippedQualifier()` ;
  Robuste — `recomputeMaxHp()` ; Ténébreux — `rollPlayerDodge()` ; Tenace — `applyMobEffectOnPlayer()` ;
  Économe/Canalisé — `attackMagic()`/`getSpellManaCost()`) et `malus` (défauts de Camelote, un seul :
  Rouillé/Fêlé déjà comptés dans les stats, Bancal, Grinçant, Bredouillant). Électrique/Explosif ajoutent
  leurs dégâts AU coup (avant le test de victoire) ; Épineux n'achève jamais ; Gelé/Terrifiant et
  l'armure agissent aussi contre un boss (`consumeEnemyAttackDebuffs()`, `enemy._debuffAtkMult`,
  `applyArmorMechanic()` dans `executeBossStrike()`). Tout nouveau qualificatif doit avoir sa couleur
  dans `ENCHANT_COLORS` (exigé par `tests/regression/items.js`). Badges (`buildQualifierBadgesHtml()`,
  effet exact en infobulle) et **panneau d'inspection** (`openItemInspect(item, { actions, compareTo,
  priceLine })`, HTML pur `buildItemInspectHtml()`, `#item-inspect-overlay`) : ouvert depuis les cartes
  d'inventaire, l'équipement porté, le grimoire et la boutique (achat/vente uniquement par ce panneau).
  `jokeItem: true` (`items.js`) marque un objet volontairement dérisoire (blague DCC), qui ne tombe
  qu'au palier Camelote. **Familles d'objets** (chantier 10, `ITEM_FAMILIES` : Bricolage 10 / Standard 6 /
  Militaire 3 / Arsenal 1) : `base.family` fixe la FRÉQUENCE d'un objet de base, indépendante de sa rareté —
  `pickBaseItem()` tire au poids (`baseItemWeight()`, objets blagues à `itemBalance.jokeWeightMult`, boutiques
  à `itemBalance.shopFamilyBoost` via l'option `familyMult` de `generateItem()`) ; le cadeau de départ passe par
  le même tirage. **Trait fixe** (`base.trait`, clé d'`itemQualifiers`) : compromis permanent d'un gros objet
  (Grinçant pour les objets bruyants, Bancal pour les lourds), ajouté par `withFixedTrait()` en plus des
  qualificatifs tirés (`{ fixed: true }`, n'occupe aucun emplacement). Refonte de la rareté (tables, plafond
  des montées, boss, objet signature) validée et appliquée : voir `CHANTIERS.md`, chantier 10. Réserve d'équipement (armes/armures/armes à distance,
  consommables et parchemins jamais comptés, voir `addLoot()`) : `config.inventory.maxEquipment` (8,
  chantier "QoL/équilibrage", Chantier B — voir `NOTES_QOL_EQUILIBRAGE.md`) — `gameState.maxInventory`
  en est un simple alias, posé juste après la déclaration de `config` (`gameState` est déclaré avant
  `config` plus haut dans `app.js`, il ne peut donc pas le référencer dans son propre littéral).
- **Mobs élite** : `generateMob()` pose `threatMultiplier` (puissance apportée par les seuls
  modificateurs, hors scaling d'étage) via `computeThreatMultiplier()` (generator.js, fonction pure et
  testable indépendamment du pipeline aléatoire) — ATQ×PV pondéré par la DEF avec un poids modéré
  (0.5), pour qu'un tank pur (ATQ en baisse, DEF/PV en hausse) pèse plus lourd que le seul produit
  ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule. Au-delà de
  `config.eliteThreatMultiplier`, icône 💀 (jamais sur un boss, qui garde 👑 — voir `isEliteMob()`).
- **Scaling des dégâts mobs** (chantier "rework combat", voir `NOTES_COMBAT.md` pour le détail des
  valeurs et un écart signalé sur le critère d'acceptation) : `config.mobDamageScaling` remplace
  l'ancien `floorScaling.atk` pour les mobs — `getFloorScaling()` (generator.js) calcule désormais
  l'ATQ via une formule composée `(1 + perFloor×étage) × (1 + perMobLevel×étage)` (pas de champ
  "niveau" dédié sur les mobs, l'étage sert de proxy pour les deux facteurs, comme
  `getMobLevelEquivalent()` ailleurs) — hp/def/xp des mobs restent sur l'ancien scaling linéaire par
  PROFONDEUR. `rollDamage()` (app.js) accepte deux options supplémentaires, utilisées UNIQUEMENT côté
  dégâts mob -> joueur (`resolveEnemyCounterAttack()`, jamais `performPlayerAttack()`) :
  `pressureFloor` (dégâts bruts jamais sous cette valeur absolue, avant mitigation — 10% des PV max du
  joueur) et `minMitigation` (la défense ne peut jamais faire tomber la mitigation sous cette fraction
  des dégâts bruts — 35%). Les mobs élites (`isEliteMob()`) reçoivent en plus
  `config.mobDamageScaling.eliteDamageMult` (×1.65) sur leur ATQ effective avant `rollDamage()`.
- **Rework des boss** (chantier "rework combat", Chantier 2 — voir `NOTES_COMBAT.md` pour le détail
  des valeurs) : un boss n'est plus "un mob avec plus de PV" — son pattern d'attaque change par palier
  de PV (`getBossPhase()`, 100-66%/66-33%/<33%), via `performBossCounterAttack()` (app.js), un chemin
  de riposte totalement séparé du mob normal/élite (`resolveEnemyCounterAttack()` bascule dessus dès
  `enemy.isBoss`, avant tout calcul lié au Chantier 1 — aucun recouvrement). Phase 1 : attaque de base
  + chance de télégraphier une attaque lourde (`enemy.status.telegraph`, tour d'annonce SANS dégât,
  tour d'exécution à `telegraphHeavyMult`). Phase 2 : reprend le télégraphe (chance réduite) + frappe
  multiple (2-3 coups/tour, `executeBossStrike()` réutilisé en boucle — voir plus bas pour le plancher
  de pression), harcèlement à distance (stub minimal, pont vers un futur Chantier 3 "enrage distance"
  pas encore implémenté) et buff de défense télégraphié ("il se hérisse",
  `enemy.status.defBuffed`, DEF boss effective ×`defBuffMult` pendant `defBuffRounds` tours — lu
  symétriquement aux réductions ébloui/corrodé existantes dans `performPlayerAttack()`). Phase 3
  ("folie") : plus de télégraphe, dégâts fixes `phase3.atkMult` (+40%) et DEF effective fixe
  `phase3.defMult` (-30%, `enemy.status.frenzied`) — la défense réduite EST la fenêtre
  risque/récompense de cette phase. Toutes les valeurs dans `config.bossPhases`. **Piège identifié et
  corrigé pendant ce chantier** : le plancher de pression du Chantier 1 (`pressureFloorFrac`, pensé
  "par ATTAQUE" = par tour) se multipliait par le nombre de coups sur un multi-coups sans correctif —
  `executeBossStrike(enemy, atk, label, pressureFloorOverride)` accepte désormais un plancher réparti
  explicitement entre les frappes d'un même tour, pour que la SOMME reste le plancher standard d'un
  tour de boss. Récompenses de boss (revues par le chantier "refonte des objets") : un objet garanti
  (`itemBalance.boss` : +1 palier, plancher selon l'étage, second objet à 25 %) et l'objet signature
  du boss, dont la rareté suit l'étage (`getSignatureRarity()` : Rare 1-4, Épique 5-9, Légendaire 10+) (`bestiary.js`, `districtBosses.*.signatureItem`, stats de base mises à l'échelle par
  `buildSignatureItem()`), garanti à la PREMIÈRE victoire sur ce boss dans la partie
  (`gameState.signaturesAwarded`) puis à 20 % (`awardBossSignatureItem()`).
- **Enrage distance et engagement** (chantier "rework combat", Chantier 3 — voir `NOTES_COMBAT.md`
  pour le détail des valeurs) : anti-kite générique, tous mobs confondus (boss inclus).
  `enemy.kitingRounds` (base 1 pour un boss, 0 sinon — `mobKitingBaseline()`) s'incrémente à chaque
  tour où le mob reste à distance sans pouvoir attaquer (`noteMobKitingRound()`, appelée depuis
  `resolveEnemyReaction()`/`safeEnemyCounterAttack()`), remis à sa base dès qu'il frappe
  (`resetMobKiting()`, au tout début de `resolveEnemyCounterAttack()`). Probabilité d'enrage par tour :
  `min(0.15 + 0.15×kitingRounds, 0.80)`. Déclenché (`triggerMobEnrage()`), le mob comble l'écart d'un
  coup et place une frappe bonus immédiate (`config.distanceEnrage.atkMult`, +40%, via
  `executeBossStrike()` réutilisée telle quelle) ; cette frappe d'entrée ne compte volontairement PAS
  comme "il place un coup" pour la sortie anticipée — l'état `enemy.status.enraged` (2-3 tours,
  `defMult` ÷2 sur sa DEF effective, lu par `performPlayerAttack()`) s'installe SEULEMENT APRÈS elle,
  pour laisser une vraie fenêtre de burst au joueur (sans ce choix, la durée 2-3 tours aurait été
  inatteignable, la ruée portant toujours un coup). Une frappe RÉELLEMENT réussie pendant l'état y met
  fin immédiatement (`endMobEnrage()`, détecté pour un boss via le delta de
  `gameState.floorStats.damageTaken`), suivi d'un cooldown (`cooldownRounds`). Anti-abus mêlée collée :
  `meleeGluedDamageMult` (+10%) sur tout mob dès `gameState.combatDistance <= 0`. Nouvelle action
  joueur "Charger" (`attemptEngage()`, bouton `#btn-engage`) : ferme l'écart d'un coup sans jet opposé
  et enchaîne une attaque à `config.engageAction.atkMultiplier` (+25%), au prix de
  `gameState.engageDefHalved` (DEF joueur ÷2 pour la riposte qui suit, lu par `getEffectiveDef()`,
  consommé au tout début de la PROCHAINE action par `tryPlayerAction()` — même convention que
  `lastPlayerActionWasBackfire`).
- **Séquenceur de tour en beats** (chantier "lisibilité combat" — voir `NOTES_LISIBILITE_COMBAT.md`
  pour le détail des choix) : remplace l'ancien modèle "tout s'affiche en 0ms puis un verrou fixe de
  400ms" par une file d'étapes espacées dans le temps, `runCombatBeats(steps, onDone)` (app.js) —
  `steps` est un tableau de `{run, delay, skippable}` joué par callbacks `setTimeout` CHAÎNÉS,
  jamais de Promise/async-await (une vraie Promise diffère toujours sa continuation en microtâche,
  même résolue en synchrone — incompatible avec les 113+ sites d'appel synchrones de
  `tests/regression/*.js`/`tests/long_playthrough.js`). `tests/regression/_helpers.js` stub
  `global.setTimeout` (copie du stub déjà présent dans `tests/long_playthrough.js`) pour que toute la
  chaîne de beats se déroule en synchrone sous Node — aucun test existant n'a eu besoin d'être réécrit
  pour ça. Durées centralisées dans `config.combatRhythm` (`beatActionToRiposte` 280ms,
  `beatHeavyEvent` 550ms pour télégraphe posé/exécuté, ruée d'enrage et chaque frappe de phase 3,
  `beatMultiHit` 90ms entre les frappes d'un multi-coups après la première, `beatEmptyEvent` 0ms —
  jamais consommé par le séquenceur lui-même : les événements vides — riposte bloquée, repositionnement
  raté — court-circuitent AVANT d'y entrer, dans `safeEnemyCounterAttack()`/`resolveEnemyReaction()`).
  `enemyCounterAttack()`/`resolveEnemyCounterAttack()`/`performBossCounterAttack()`/
  `performBossCounterAttackInner()`/`triggerMobEnrage()` prennent désormais un `onDone` appelé une
  fois toute la séquence visuelle jouée (déverrouille les boutons via `setCombatInputLocked(false)`) —
  les FORMULES de dégâts restent strictement inchangées, seul leur RYTHME d'affichage change.
  `enemy.lastKnownPhase` (initialisé dans `initiateCombat()`) alimente désormais la bannière de
  changement de phase (voir juste en dessous, même chantier).
- **Bannière de changement de phase boss** (chantier "lisibilité combat", même contexte que le
  séquenceur ci-dessus — voir `NOTES_LISIBILITE_COMBAT.md`) : `performBossCounterAttackInner()`
  compare la phase du tour courant à `enemy.lastKnownPhase` AVANT toute sélection de pattern
  (`phaseJustIncreased = phase > enemy.lastKnownPhase`), met à jour ce dernier dans tous les cas, puis
  passe par une closure locale `runPattern(patternSteps)` (au lieu d'appeler `runCombatBeats()`
  directement, sur les 7 branches de pattern de la fonction) qui prépend un step d'annonce
  UNIQUEMENT si la phase vient de monter — jamais à l'entrée en phase 1 (état de départ, rien à
  annoncer). `announceBossPhaseChange(enemy, phase)` affiche `#phase-transition-banner` (texte
  différent phase 2/phase 3) puis la masque via un VRAI `setTimeout(900ms)` indépendant du rythme des
  beats (pas un step de `runCombatBeats`, pour ne pas coupler sa durée d'affichage au tempo qui peut
  s'accélérer juste après, en phase 3 notamment). Badge permanent `#boss-phase-badge` (à côté du nom,
  mis à jour à chaque `updateUI()`, visible dès phase ≥ 2 sur un boss uniquement) complète la bannière
  transitoire par un rappel permanent de l'état en cours.
- **`updateUI()` centralisé en fin de riposte** (chantier "lisibilité combat", Chantier 7 — voir
  `NOTES_LISIBILITE_COMBAT.md` pour le bug exact et comment il a été trouvé) : `enemyCounterAttack()`
  et `triggerMobEnrage()` (les deux seuls points qui verrouillent l'input, Chantier 6) appellent
  `updateUI()` dans leur `onDone`, juste après `setCombatInputLocked(false)` — remplace un
  `updateUI()` ad hoc qui ne vivait QUE dans `resolveNonBossCounterAttack()` (mob normal/élite) et
  qu'AUCUNE des 7 branches de pattern boss (`performBossCounterAttackInner()`) n'avait d'équivalent :
  en jeu réel, un télégraphe posé par un boss ne rafraîchissait donc jamais `#telegraph-banner`/
  `#enemy-status-icons` avant ce correctif (masqué dans tous les scripts de vérification des
  Chantiers 1/2/5/10 précédents, qui appelaient `updateUI()` à la main). Les deux appels devenus
  redondants (fin de `resolveNonBossCounterAttack()`, branche "étourdi" de
  `resolveEnemyCounterAttack()`) sont retirés, sans changement de comportement observable (même tick
  synchrone).
- **Skip de combat** (chantier "lisibilité combat", Chantier 9 — voir `NOTES_LISIBILITE_COMBAT.md`) :
  `combatSkipRequested` (module-level, pas `gameState`, même convention que `mobExamineOpen`) est lu
  par `runCombatBeats()` — un step sans `skippable: false` explicite voit son délai ramené à 0 dès que
  le drapeau est vrai. Posé par `requestCombatSkip()` sur un clic dans `#combat-zone` (filtré via
  `e.target.closest('button')`, pour qu'un clic sur une vraie action de combat ne se réinterprète
  jamais en demande de skip) ou un `keydown` Espace/Entrée au niveau du document (jamais si le focus
  est sur un `<input>`/`<textarea>`). Remis à `false` au tout DÉBUT de `enemyCounterAttack()`/
  `triggerMobEnrage()` plutôt qu'à la fin du tour précédent — sans ça, le clic qui démarre un tour
  (qui bulle aussi jusqu'à `#combat-zone`) pré-skipperait systématiquement son propre tour. Les beats
  de mort/fin de combat (hors du tableau `steps`, voir `strikeAndCheckDeath()`) restent
  structurellement insensibles au skip, sans qu'aucun step existant ait besoin de `skippable: false`.
- **Logs de combat allégés** (chantier "lisibilité combat", Chantier 8, dernier de la série — voir
  `NOTES_LISIBILITE_COMBAT.md`) : `executeBossStrike(..., silent)` (nouveau 6ᵉ paramètre) supprime la
  ligne de log INDIVIDUELLE d'un coup (jamais les dégâts/l'animation/l'effondrement d'un compagnon,
  toujours appliqués) — utilisé UNIQUEMENT par le pattern multi-coups (phase 2 boss), qui accumule les
  montants réellement encaissés (`strikeAndCheckDeath()` les renvoie désormais) et n'affiche qu'UNE
  ligne de résumé après la dernière frappe qui atteint sa cible (jamais si le joueur meurt en cours de
  rafale). Lignes d'attaque standard (joueur et mob) raccourcies (retire le remplissage "et infligez
  ... à", déplace la note d'état du mob après les dégâts) sans retirer d'information : audit des
  mentions d'état ennemi existantes (ébloui/corrodé/garde hérissée/folie/enrage) — toutes expliquent le
  calcul du coup en cours (DEF ennemie modifiée), aucune n'est une simple redite des badges du
  Chantier 2, donc aucune n'a été retirée.
- **Chronique de run + succès** (chantier 2, voir `NOTES_SUCCES.md`) : `gameState.runStats`
  (compteurs sur toute la partie) alimenté par un point d'entrée UNIQUE, `recordRunEvent(type, data)`,
  appelé depuis les hooks existants (`applyPlayerDamage()`, `winCombat()` — avec `enemy.runTrack` posé
  par `initiateCombat()` —, `attemptFlee()`, piège, `restAtSafehouse()`, `descendStairs()`,
  `advanceToNextFloor()`, `buyShopItem()`, flop de `attackMagic()`, `storeLootItem()`, fonctions
  compagnon, `equipItem()`, `performExploreStep()`, `gameOver()`, `winGame()`) ; tout nouveau compteur
  s'ajoute à `createEmptyRunStats()` (achievements.js). Succès **par crawler** (`gameState.achievements`,
  sauvegardé) : `evaluateAchievements()` rejoue les `check(stats, event, state)` du catalogue à chaque
  événement, **jamais tant que `gameState.saveEnabled` est faux** (chargement silencieux, tests) ;
  chaque déblocage ouvre une **boîte** façon DCC (`openAchievementBox()`, `config.achievementBoxes`,
  Bronze/Argent/Or) sauf les succès posthumes (à la mort). Indice de domination (`computeDominance()`,
  facilité des 10 dernières victoires) prêt pour les chasseurs de primes. UI : `#achievement-toast`
  (annonce non bloquante), `#btn-achievements` → `#achievements-overlay` (secrets en « ??? »), succès du
  run sur Game Over/Victoire. **Revente d'office** : `storeLootItem()`, réserve pleine, revend le butin
  pour `LOOT_OVERFLOW_SELL_RATIO` (50 %) du prix de revente marchand (`getOverflowSellPrice()`) au lieu
  de le perdre.
- **Chasseurs de primes** (chantier 3, voir `NOTES_CHASSEURS.md`, chiffres dans `config.bounty`) : prime
  `gameState.bounty.value` (0-100) qui monte avec les victoires faciles (`onBountyVictory()`, facilité de la
  chronique) et les fuites devant un chasseur, et ne retombe QU'EN tuant un chasseur ; seul point de
  modification `addBounty()` (paliers `getBountyTier()` 30/60/90, vignette `wantedPoster`, badge
  `#bounty-status`). Chasseurs (`bountyHunters` dans bestiary.js, hors `baseMobs`) générés par
  `generateBountyHunter()` avec des stats **calées sur le joueur** (`computeBountyHunterStats()`, pure,
  generator.js, à partir de `getPlayerCombatProfile()`), toujours élites, `isBountyHunter`. Apparition
  `maybeSpawnBountyHunter()` dans `handleStealthEncounter()` (avant la détection : aucune esquive) et les
  deux embuscades de trajet ; escouade à 90+ (`gameState.pendingBountySquad`, Chef enchaîné par
  `winCombat()`). Fuite à `fleeChance` (50 %) fixe. Épitaphe dédiée `EPITAPH_TEMPLATES.chasseurPrime`
  (pool spécial, comme `mobFaible`).
- **Émission DeathWatch** (chantier 4, voir `NOTES_DEATHWATCH.md`, chiffres dans `config.show`) : à
  l'arrivée sur chaque étage dès le 2, SEULEMENT dans une vraie partie (`gameState.saveEnabled`, comme les
  succès), `advanceToNextFloor()` ouvre `triggerShow(lastFloor)` (bilan de l'étage fini capturé avant sa
  remise à zéro) — ou la diffère derrière le Pacte du Crawler (`pendingShowAfterPact`, ouverte par
  `choosePactBlessing()`). Choix bloquant `gameState.showChoicePending` (dans `isActionBlocked()`) +
  `pendingShow` ; zone `#show-zone`, vignette `showStudio`. `answerShow(tone)` : Poli (sans jet, PO),
  Pique en retour / Provocation / Insulte en direct (jet d20 + popularité `getShowPopularity()` contre
  8/12/16 : boîte Bronze/Argent/Or via `openAchievementBox()`, sinon −2 H jamais mortelles / combat élite /
  +20 prime et chasseur de primes), ou Refuser.
- **Progression** : `gainXp()` — `xpToNextLevel` croît ×1.25 par niveau (jusqu'ici ×1.4, resserré pour
  éviter le mur de fin de run où les niveaux cessent de tomber pendant que les mobs continuent de
  grimper). Gains à chaque niveau : PV max +15 (fixe), ATQ `2 + floor(niveau/4)`, DEF
  `1 + floor(niveau/5)` (croissants avec le niveau ATTEINT, pour rester au niveau des mobs en fin de run).
- **Budget temps par étage** (chantier "QoL/équilibrage", Chantier E — voir `NOTES_QOL_EQUILIBRAGE.md`) :
  `gameState.maxTime` n'est plus un plafond fixe (100H) mais `config.floorTimeBudget.base +
  perFloor × (étage - 1)` (130 + 5H/étage), recalculé par `advanceToNextFloor()` à chaque changement
  d'étage (`gameState.timeLeft` remis à ce nouveau maximum, comme avant) — objectif : réduire les
  morts "sans avoir vu l'escalier" sur les étages tardifs (mobs/distances plus coûteux), sans
  supprimer la pression du temps ni la mort par épuisement, toujours possible. Alerte visuelle
  discrète (`#stair-alert-banner`, pulse `prefers-reduced-motion`-safe) affichée par `updateUI()` dès
  `timeLeft/maxTime <= 25%`, jamais en combat.
- **Choix d'escalier** (`offerStairsChoice(context)`, demandé par l'utilisateur) : un escalier libre
  (gardien vaincu dans `winCombat()`, classique ET urbain, ou ville-escalier non gardée / déjà vaincue
  atteinte par `arriveAtCity()`) ne mène plus directement à l'écran d'escalier : `#stairs-choice-zone`
  propose « Descendre » (`descendStairs()` → `triggerFloorTransition()`) ou « Rester sur l'étage »
  (`stayOnFloor()`, aucun effet, le temps continue de s'écouler). Bloque via
  `gameState.stairsChoicePending` (inclus dans `isActionBlocked()`) ; `gameState.pendingStairsChoice` =
  `{ kind: 'room', roomId }` (étage classique : la salle du gardien vaincu est marquée 🪜 « Escalier libre » sur la
  carte, `listFloorLandmarks()`, pour y revenir quoi qu'il arrive, même après une restauration de
  sauvegarde) ou `{ kind: 'city', cityId }` (étage urbain : la ville reste sur la Carte Urbaine). Le
  choix est reproposé à chaque retour : `enterRoom()` sur la salle d'un gardien d'escalier vaincu (au
  lieu de l'« antre silencieuse », gardée pour les boss de quartier) et `arriveAtCity()`. La Sortie de
  l'étage final n'y passe jamais : victoire immédiate (choix de l'utilisateur).
- **Écran d'escalier** (`triggerFloorTransition()`/`continueFromFloorTransition()`) : affiché à la
  place d'un passage direct à l'étage suivant, au clic sur « Descendre » (voir Choix d'escalier
  ci-dessus). Titre sarcastique tiré
  au sort (`FLOOR_TRANSITION_TITLES`) + résumé du tally de l'étage qui vient de se terminer
  (`gameState.floorStats` : `mobsKilled`/`damageTaken`/`itemsFound`/`xpGained`), alimenté au fil de la
  partie par des hooks UNIQUES — `winCombat()`, `gainXp()`, `addLoot()` (seulement si l'objet est
  effectivement conservé, pas sur "réserve pleine"), `applyPlayerDamage()` (point de passage UNIQUE
  pour toute perte de PV : piège, saignement, riposte ennemie — remplace toute mutation directe de
  `gameState.hp`, pour qu'un futur hook d'anomalie n'ait qu'ICI à s'accrocher). Bloque via
  `gameState.floorTransitionPending` (inclus dans `isActionBlocked()`) — JAMAIS `gameState.inCombat`,
  qui collisionnerait avec la logique générique "combat sans ennemi -> on referme" présente ailleurs
  (dont l'auto-résolveur de `tests/long_playthrough.js`, qui doit connaître ce flag comme tout autre
  état bloquant, voir Tests plus bas). `advanceToNextFloor()` (l'ancien `nextFloor()`, renommé) ne fait
  effectivement avancer l'étage — génération incluse, tally remis à zéro — qu'au clic sur "Continuer" ;
  `devJumpToUrbanFloor()` (DEV) l'appelle directement, sautant délibérément l'écran. Annonce de
  l'anomalie du prochain étage via `getUpcomingAnomalyAnnouncement(nextFloor)` — stub renvoyant `null`
  tant qu'aucun système d'anomalies n'existe (chantier séparé), seul endroit à modifier pour le
  brancher réellement : le bloc d'annonce de l'écran est déjà conditionnel (masqué si `null`).
- **Nécrologie** : `gameOver(timeout, killer)` dérive une `cause` (`'trap'`/`'bleed'`/`'combat'`/
  `'backfire'`/`'timeout'`) du contexte réel de mort — `killer` vaut `'trap'`/`'bleed'` aux deux sites
  correspondants, ou l'objet ennemi lui-même à la mort par riposte de combat
  (`resolveEnemyCounterAttack()`) ; `gameState.lastPlayerActionWasBackfire` (posé par `attackMagic()`
  au moment du flop, remis à faux en tout début de CHAQUE action par `tryPlayerAction()` — pour qu'un
  backfire ne "contamine" jamais un décès plus tardif sans rapport) requalifie alors la cause en
  `'backfire'`. `generateEpitaph(deathContext)` pioche un template dans `EPITAPH_TEMPLATES[cause]`
  (`{{mob}}`/`{{etage}}`/`{{deltaNiveau}}`/`{{cause}}`/`{{crawler}}` remplacés) — deux pools DÉDIÉS
  (`mobFaible`, `backfire`) remplacent le pool par défaut selon des règles spéciales : mob tueur "très
  inférieur" (écart `NECROLOGIE_WEAK_MOB_DELTA` entre `gameState.level` et `getMobLevelEquivalent()` —
  aucun champ de niveau explicite sur les mobs, l'étage courant sert de proxy, cohérent avec le reste
  du scaling par étage), ou cause déjà `'backfire'`. Deux mentions additionnelles, indépendantes du
  pool choisi et combinables entre elles : `gameState.fleesThisRun` (fuites RÉUSSIES depuis le début du
  run, incrémenté par `attemptFlee()`, jamais remis à zéro en cours de run) à partir de
  `NECROLOGIE_FLEE_THRESHOLD`, et le premier objet équipé (arme/distance/armure) portant
  `jokeItem: true` (voir `items.js`) s'il y en a un. `recordEpitaph()` archive le texte dans
  `gameState.necrologie` (plus récente en premier, plafonné à `NECROLOGIE_MAX_ENTRIES` — persistant en
  save via l'autosauvegarde existante, aucun écran de lecture dédié pour l'instant). Affichée pleine
  largeur sur `#game-over-epitaph` (écran Game Over).
- **Anomalies d'étage** (`anomalies.js`, module autonome au même titre que `districts.js`/
  `safehouses.js`, chargé juste avant `app.js`) : catalogue de 12 anomalies (`ANOMALY_CATALOG`, 4
  catégories : combat/ressources/exploration/mixtes) tirées à la génération de chaque étage
  (`rollAndApplyFloorAnomalies()`, appelée par `advanceToNextFloor()` AVANT `generateFloorMap()`/
  `generateUrbanFloorMap()`, pour que les effets structurels comme LABYRINTHE influencent la
  génération elle-même). Règles d'intensité (`rollFloorAnomalies(floor)`) : étages 1-2 aucune, 3-6 une
  seule tirée dans le pool restreint (`intensiteMin <= 3`), 7-11 une seule dans le pool complet, 12+
  DEUX anomalies compatibles (table `ANOMALY_INCOMPATIBILITIES`, ex. SECHERESSE+ZONE_MAGIQUE et
  PEAU_DE_VERRE+ADRENALINE interdits ; au moins une des deux doit être `negatif`/`mixte`, jamais un
  double bonus ; jusqu'à 20 tentatives puis repli sur une seule anomalie simple du pool complet).
  L'écran d'escalier (`getUpcomingAnomalyAnnouncement()`) TIRE RÉELLEMENT l'anomalie du PROCHAIN étage
  et la mémorise (`gameState.pendingNextFloorAnomalies`) pour que `rollAndApplyFloorAnomalies()` (au
  clic sur "Continuer") applique EXACTEMENT ce qui vient d'être annoncé, jamais un second tirage
  indépendant — `devJumpToUrbanFloor()` (DEV, saute l'écran) retombe alors sur un tirage à la volée,
  seul cas où `pendingNextFloorAnomalies` est absent pour l'étage ciblé.
  **Hook d'application UNIQUE** : `appliquerAnomalie(etage, anomalie)` (anomalies.js) fusionne les
  `effects` d'UNE anomalie dans `gameState.anomalyEffects` (objet plat, `createNeutralAnomalyEffects()`
  = valeurs neutres, jamais de comportement changé sans anomalie active) — multiplicatif sur les
  multiplicateurs (deux anomalies ATQ ×1.4 et ×1.2 → ×1.68), additif sur les bonus en points, OR sur
  les drapeaux. `computeAnomalyEffects(list)` est l'équivalent PUR (hors `gameState`, testable
  indépendamment, même logique que `computeThreatMultiplier()` dans `generator.js`). Chaque système de
  jeu lit `gameState.anomalyEffects.xyz` à SON point d'usage plutôt que de dupliquer une logique par
  anomalie : `rollDamage()` (`allDamageMult`, ADRENALINE, symétrique joueur/mobs), `recomputeMaxHp()`
  (`playerMaxHpMult`, PEAU_DE_VERRE — voir `gameState.baseMaxHp` ci-dessous), `applyPlayerHeal()`
  (`healingMult`, PEAU_DE_VERRE), `gainXp()` (`xpMult`, MOB_ENRAGE), `generateMob()`/`generateBoss()`
  (`mobAtkMult`, MOB_ENRAGE, appliqué comme le scaling par étage), `applyTimeElapsedRegen()`
  (`manaRegenMult` SECHERESSE, `regenOutsideSafehouseZero` REPAS_DE_FAMILLE — régén PV passive à zéro,
  cette fonction n'étant justement appelée que HORS salle sécurisée), `enterRoom()` (salle sécurisée :
  `freeSafehouseMeals` REPAS_DE_FAMILLE, séjour sans coût en temps), `generateItem()` (`potionDropMult`
  SECHERESSE, tirage pondéré de la catégorie `consumables`), `generateShopStock()` (`shopDiscountPct`
  ECONOMIE_AUSTERE), le gain d'or exploré (`goldGainMult` ECONOMIE_AUSTERE), `getStealthChance()`/
  `attemptStealthEvasion()` (`stealthCapBonus`/`detectionBonus` NOCTURNE — plafond relevé ET pénalité
  sur la chance de base, calcul indépendant : un fort investissement en Furtivité profite du plafond
  relevé, un faible subit surtout la pénalité), `attackMagic()` (`spellMult`/`backfireBonusPct`
  ZONE_MAGIQUE), `generateBorough()` (`extraRoomsPct` LABYRINTHE, +50% salles par bloc, bloc agrandi d'autant),
  `handleStealthEncounter()` (`guardedStairsBoost` LABYRINTHE, `eliteBonus` passé à `generateMob()`
  UNIQUEMENT dans le quartier qui garde l'escalier — décale les seuils du jet de modificateurs sans
  toucher au système de boss lui-même), `initiateCombat()` (`mobsActFirst` TEMPO_CREE, frappe
  d'ouverture réutilisant `enemyCounterAttack()` tel quel, seulement DÉCALÉE plus tôt), `gainSkillXp()`
  (`skillXpPerActionBonus` TEMPO_CREE, +1 XP compétence par action), `enterRoom()`/`triggerCafetRoom()`
  (`cafetRoom` CAFET_ASSOMBRIE — une pièce normale taguée à la génération, piège sévère + trésor
  `addLoot(1)` à la toute première visite, jamais revisité ensuite).
  **PACTE_DU_CRAWLER** (`forcedPactChoice`) est le seul cas à choix bloquant : `triggerPactChoice()`
  (`gameState.pactChoicePending`, inclus dans `isActionBlocked()`) à l'entrée de l'étage,
  `choosePactBlessing('atk'|'hp')` applique DIRECTEMENT un delta `{atk, hp}` (jamais un multiplicateur
  permanent, contrairement à PEAU_DE_VERRE) mémorisé dans `gameState.pactBlessingDelta` et annulé au
  tout début du PROCHAIN `advanceToNextFloor()`, avant même le tirage des nouvelles anomalies de cet
  étage. `gameState.baseMaxHp` (vraie progression, avancée uniquement par `gainXp()`) est la SOURCE DE
  VÉRITÉ des PV max ; `gameState.maxHp` (dérivé, lu partout ailleurs dans le jeu comme avant) n'est
  recalculé QUE par `recomputeMaxHp()` — appelé après toute montée de niveau, tout changement d'étage,
  et toute résolution du Pacte. Une sauvegarde antérieure à cette fonctionnalité n'a pas `baseMaxHp` :
  `restoreSaveForName()` le fait migrer depuis l'ancien `maxHp` (qui ÉTAIT la vraie base, aucun système
  d'anomalies n'existant alors), jamais un retour silencieux à 100.
  **Affichage** : badge(s) permanent(s) icône+nom (`updateAnomalyStatusUI()`, `#anomaly-status-bar`
  dans le header), description complète via l'infobulle native du navigateur (`title`, "inspection").
  Chiffres non fournis par la consigne d'origine (poids de tirage égaux, `intensiteMin` par anomalie,
  piège/trésor de CAFET_ASSOMBRIE, bonus/malus de PACTE_DU_CRAWLER) : valeurs de départ raisonnables
  posées dans `anomalies.js`/`app.js`, à ajuster par playtest réel comme le reste des chiffres
  d'équilibrage du jeu (voir Backlog).
- **Magie** : un seul sort équipé à la fois (`gameState.equipment.spell`), plus de simple attaque
  magique inconditionnelle. Répertoire de base dans `spellCatalog` (`spells.js`), deux catégories —
  corps à corps ou à distance (`spellCategory`) — qui font se comporter le bouton Magie exactement
  comme Arme/Tir : grisé au mauvais écart (`attackMagic()`/`updateUI()`). Un parchemin (catégorie
  `'scrolls'`) est généré par `generateSpellScroll()` au même titre que le reste du loot
  (`generateItem()`/`addLoot()`), même système de rareté, niveau d'objet et qualificatifs qu'une arme
  (qualificatifs de cible `spell`, appliqués après un sort réussi) ; la rareté fait grimper le coût en
  mana moitié moins vite que les dégâts (`itemBalance.spellManaRarityWeight`). Trouvé, il rejoint
  `gameState.spellbook` (inventaire magique séparé, jamais limité) plutôt que `gameState.inventory` ;
  `equipSpell()` l'équipe et renvoie l'éventuel sort précédent dans le grimoire, sans jamais le
  perdre. **Grimoire regroupé** : `groupSpellbook(spellbook, equipped)` (pure) regroupe les exemplaires
  par `spellName` pour l'AFFICHAGE seulement (`gameState.spellbook` reste une liste plate d'exemplaires,
  aucune migration) — une carte par sort, une ligne par exemplaire (rareté décroissante puis dégâts),
  chacune avec son `index` dans la liste pour `equipSpell()`/`sellSpell()` ; l'exemplaire équipé y figure
  (`index: -1`, mention « Équipé », jamais vendable). Même regroupement dans la liste de vente de la
  boutique (`#shop-sell-spells-list`), une vente par exemplaire. Le mana (`gameState.mana`, 0-100) n'existe visuellement pour le joueur qu'une fois un sort
  équipé, et se régénère comme les PV : passif via `applyTimeElapsedRegen()` (voir plus bas),
  potions (`item.mana` dans `items.js`), aide du compagnon Médecin.
  **Parité magie/arme** (chantier "QoL/équilibrage", Chantier C — voir `NOTES_QOL_EQUILIBRAGE.md`) :
  `config.magicBalance` (`atkBase` 1.1, `atkPerLevel` 0.015, `backfireBase` 15, `backfirePerLevel`
  -1.5, `backfireMin` 3) remplace les constantes qui étaient en dur dans `attackMagic()` — le mana
  achète la flexibilité (mêlée/distance sans changer d'équipement), pas un surplus de dégâts : à
  rareté égale, un sort et une arme infligent des dégâts comparables (`atkMultiplier` sort 1.1 contre
  1.0 pour une arme, `spellCatalog` réajusté en conséquence — voir
  `tests/regression/magic-balance.js`). Le plancher de backfire est ABAISSÉ (8% → 3%) : plus punitif
  à haut niveau de compétence Magie, pour que le risque reste réel même une fois la compétence montée.
  **Sorts à effet et utilitaires** (chantier 11) : `spellEffect` (catalogue `SPELL_EFFECTS` de `spells.js`,
  phrase d'inspection `describeSpellEffect()`) — après un coup porté, `castSpellEffect()` réutilise les états
  existants (`resolveQualifierEffect()` : vol de vie, étourdi, corrodé, saignement, terreur ; aveuglé = 
  `status.distracted`) ; la Chaîne d'Éclairs ajoute son second éclair AU coup (`options.chainPct` de
  `performPlayerAttack()`). Catégorie `any` (« Partout », `spellRangeLabel()`) : sorts utilitaires sans
  dégâts, utilisables à toute distance, qui consomment le tour (`castUtilitySpell()` puis
  `resolveEnemyReaction()`) — Soin Express (part des PV max, suit la rareté), Bouclier de Mana
  (`gameState.status.manaShield`, appliqué dans `companionInterceptHit()`, décompté par `tryPlayerAction()`),
  Pas de l'Ombre (+2 d'écart sans jet). Effets visuels `FX_SPELLS` (style `self` pour les utilitaires,
  `fxPlayerSelfSpell()`). Le cadeau de départ, le kit de test et les compagnons n'utilisent que des sorts
  offensifs.
- **Régénération passive (PV/mana)** : `applyTimeElapsedRegen(hours)` — PV **dégressif** selon le %
  de PV déjà restants (`HP_REGEN_TIERS` : 10/h sous 50%, 4/h entre 50-80%, 1/h au-delà — un vrai filet
  de sécurité en dessous, un simple filet d'eau au-delà), mana à **12/h** (seulement si un sort est
  équipé). Une salle sécurisée reste le seul moyen fiable de repartir plein PV/mana (Sommeil
  réparateur, 8H, voir `restAtSafehouse()`). Appliqué
  à chaque fois que `gameState.timeLeft` diminue pour une raison "normale" (`performExploreStep()`,
  `travelToRoom()`, `autoTravelToNearestFrontier()`) — jamais sur la perte de temps punitive du piège "Contretemps", qui
  perdrait sinon son sens.
- **Interface allégée** (chantier 9) : sous le nom, la fiche du crawler `#player-sheet` (barre de PV
  `setHpBar()`, mana si un sort est équipé, XP, ATQ/DEF/PO/états). **Barre d'icônes** `#bottom-nav`, fixée en
  bas de l'écran et **masquée en combat** (`updateBottomNav()`, appelée par `updateUI()`/`updateInventoryUI()`/
  `updateSpellbookUI()`) : 🛡️ Équipement / 🎒 Sac / 📖 Grimoire ouvrent chacun un panneau
  (`openInventorySheet()`/`closeInventorySheets()`, `#equipment-sheet`/`#bag-sheet`/`#spellbook-sheet`, un seul
  à la fois, refermés en combat), 🏆 les succès. Pastilles « nouveau » : `item.isNew` posé par
  `storeLootItem()` (jamais sur un consommable), retiré à l'ouverture du Sac / du Grimoire. La barre de
  consommables (`#consumable-quickbar`) reste visible dans la page.
- **Écran de départ** : `#start-screen-overlay` (saisie du nom, `confirmPlayerName()`) puis
  `#gift-reveal-overlay` (`revealWelcomeGift()`) recouvrent l'UI de jeu au chargement — celle-ci est
  déjà entièrement initialisée en arrière-plan (aucun état de jeu propre à ces deux écrans). Le
  cadeau de bienvenue est tiré au sort pondéré (`WELCOME_GIFT_WEIGHTS`/`rollWelcomeGiftType()` :
  Arme > Tir > Armure > Magie > Rien, « Rien » à 5 %) puis équipé directement
  (`generateWelcomeGiftItem()` dans `generator.js`, toujours au palier Camelote, défaut possible), avec
  une blague sarcastique par type
  (`flavorText.welcomeGift`). `resetGame()` recharge la page : l'écran de départ réapparaît
  naturellement à chaque nouvelle partie.
- **Sauvegarde** : une entrée `localStorage` par nom de crawler (`SAVE_KEY_PREFIX`,
  `saveKeyForName()` — casse/espaces ignorés à la clé, casse d'origine conservée dans le JSON).
  Autosauvegarde via `saveGame()`, appelée en dernière ligne d'`updateUI()` (déjà invoquée après
  quasiment toute action) ; no-op tant que `gameState.saveEnabled` est faux, pour ne jamais écraser
  une sauvegarde pendant l'initialisation silencieuse au chargement, avant que le joueur n'ait
  confirmé son nom. `confirmPlayerName()` vérifie si le nom saisi correspond à une sauvegarde
  (`hasSaveForName()`) : si oui, `restoreSaveForName()` la restaure directement (aucun cadeau de
  bienvenue) ; sinon, nouveau crawler comme avant. La restauration nettoie systématiquement tout état
  transitoire/bloquant (combat en cours, choix en attente) : on atterrit toujours sur l'écran
  d'exploration normal. `listSavedCrawlerNames()` alimente l'indice affiché sur l'écran de départ.
  **Nettoyage des sauvegardes** (`#btn-open-manage-saves` sur l'écran de départ, `openManageSaves()`) :
  liste détaillée (`listSavedCrawlersDetailed()` — nom/étage/horodatage `gameState.lastSavedAt`, posé
  par `saveGame()`) avec suppression individuelle ou totale, TOUJOURS via `pendingSaveDeletion`
  (`requestDeleteSave()`/`requestDeleteAllSaves()` posent l'action, `confirmSaveDeletion()` l'exécute,
  `cancelSaveDeletion()` l'annule) — structurellement impossible de supprimer sans confirmation
  explicite, aucun appelant ne touche `localStorage.removeItem` directement. Un slot de backup UNIQUE
  (`SAVE_BACKUP_KEY`, écrasé à chaque nettoyage — pas un historique) garde le JSON brut de chaque
  sauvegarde sur le point d'être supprimée, round-trip exact ; `restoreSavesBackup()` le réécrit tel
  quel à ses clés d'origine, restaurable plusieurs fois de suite (le backup n'est effacé qu'en étant
  écrasé par un nettoyage suivant, jamais par une restauration).
- **Étages urbains** (multiples de 3 — `config.urbanFloors`, `generateUrbanFloorMap()`) : un réseau
  de villes sûres (`gameState.urbanMap.citiesById`) reliées par des routes dangereuses, en
  remplacement du donjon classique à 4 quartiers pour cet étage (`floorMap`/`urbanMap` sont
  mutuellement exclusifs, `nextFloor()` bascule sur `currentFloor % 3 === 0`). `theme` réutilise TEL
  QUEL le nom d'un quartier existant de `districts.js`/`bestiary.js` comme thématique unique de tout
  l'étage : `generateMob()`/`generateBoss()` n'ont besoin d'aucune adaptation (`gameState.currentDistrict`
  y reste aligné en permanence). Déplacement via `travelToCity()` — calqué sur
  `travelToRoom()` (coût en temps + embuscades proportionnels à `computeCityDistance()`,
  Dijkstra équivalent à `computeDistance()`) — avec découverte progressive (`city.known`, révélé
  ville par ville via `revealCityNeighbors()`). Une ville (jamais la ville de départ) porte
  l'escalier, avec une chance de garde croissante avec la profondeur
  (`config.urbanFloors.stairsGuardChanceByFloor` : 20/35/50/65 % aux étages 3/6/9/12, 80 % à
  l'étage 15) ; le combat de gardien réutilise le même bloc UI que `triggerBossEncounter()`
  (`#boss-choice-zone`), dispatché séparément (`triggerUrbanBossEncounter()`/`fightUrbanBossNow()`/
  `retreatFromUrbanBoss()`, voir le dispatch dans `fightBossNow()`/`retreatFromBoss()`) car les
  données sous-jacentes (villes) ne sont pas des pièces de donjon. **Étage final** (18,
  `config.urbanFloors.finalFloor`) : la ville tirée devient la Sortie (`city.isExit`), **toujours**
  gardée (100 %, jamais de pourcentage) ; la vaincre (ou la trouver non gardée) déclenche `winGame()`
  (`gameState.hasWon`) plutôt que `nextFloor()` — écran de victoire calqué sur Game Over, jamais
  d'étage 19 généré. Côté UI, la Carte Urbaine (`#urban-map-svg`, rempli par `updateUrbanMapUI()`)
  est un **panneau sous la scène d'exploration** (`#urban-travel-overlay`, dans `#explore-stage`), ouvert
  ou fermé par le bouton `#btn-toggle-map` (« 🗺️ Carte », `toggleMapPanel()`, ouvert par défaut —
  `mapPanelOpen` est une variable de module, préférence d'affichage et non état de jeu) ; toucher la
  scène sur un étage urbain la rouvre au lieu d'explorer (pas d'exploration libre ici). Panneau et
  bouton sont masqués dès qu'une "situation" est en cours (combat/boss/furtivité/compagnon,
  `isActionBlocked()`) : la scène montre alors la situation (toggle dans `updateUI()`). Le même bouton
  ouvre la carte des étages classiques (`#floor-map-overlay`, voir « Carte + voyage » plus haut). Le déplacement s'y représente comme une **mini carte
  graphique** (nœuds = villes, arêtes = routes) plutôt qu'une liste, sur une **grille logique** (gx/gy
  entiers, `URBAN_GRID_CELL` = 70 unités monde par cellule) plutôt qu'un gabarit de points fixes :
  `generateConnectedCityGrid(cityCount)` fait croître une région CONNEXE par construction (chaque
  nouvelle cellule tirée adjacente à une cellule déjà choisie, départ toujours en `cells[0]`) —
  connexité garantie sans réparation après coup, contrairement à l'ancien arbre couvrant. Les routes
  sont TOUTES les paires de cellules choisies adjacentes 8-directions (`computeGridAdjacencyPairs()`,
  N/S/E/O + diagonales, jamais de connexion longue distance façon étoile) : presque toujours plus d'un
  chemin possible entre deux villes, sans étape de bouclage séparée. Position d'AFFICHAGE (`city.x`/
  `city.y`, dérivée de `gx`/`gy` × `URBAN_GRID_CELL`) passée UNE fois par `computeDeclutterLayout()`
  (répulsion pure, déterministe — aucun `Math.random()` — déplacement plafonné depuis la position de
  départ) puis figée pour de bon ; sur une grille pure l'espacement minimal (70) dépasse déjà le
  `minDist` du déclutter (50), donc cette passe est un no-op ici — conservée telle quelle pour une
  future disposition plus dense qui en aurait vraiment besoin (voir aussi `computeGraphLayout()`,
  toujours réservée à un futur layout calculé depuis rien). Un **fond décoratif** "pâtés de maisons +
  avenues" (`URBAN_MAP_BACKGROUND`, généré une seule fois avec un seed FIXE via `mulberry32()`, jamais
  `Math.random()`) couvre une étendue MONDE fixe et généreuse (`URBAN_MAP_WORLD_EXTENT`), rigoureusement
  identique d'une partie à l'autre. La **caméra** est un monde PANNABLE par glissement (souris et
  tactile) plutôt qu'un simple recentrage automatique : `gameState.urbanMap.camera` (`null` = centrée
  sur la ville courante par défaut, un `{x,y}` = position choisie par le joueur en glissant la carte,
  via `onCameraChange` de `renderGraphMiniMap()`) est réinitialisée à `null` à chaque arrivée dans une
  nouvelle ville (`arriveAtCity()`, "la caméra suit de nouveau le joueur") et par le bouton
  `#btn-recenter-map` (`recenterUrbanMap()`). Écrêtée aux limites du réseau connu
  (`computeDefaultWorldBounds()`/`clampCameraToBounds()`, marge ≥ la moitié de la fenêtre affichée —
  sans quoi une ville de bord de zone connue ne pourrait jamais être parfaitement centrée). Le gardien
  de l'escalier/Sortie garde sa ville normale (icône générique) mais son icône (👑) est dessinée à
  part, décalée d'une distance fixe en pixels sur SA route d'accès plutôt que confondue avec le cercle
  de la ville — "posté sur la route". `buildUrbanMapGraphData()` (seule partie qui connaît la forme des
  données du jeu) adapte le réseau villes/routes connu au format générique nœuds/arêtes/positions
  attendu par `renderGraphMiniMap()` — voir la section **Mini carte graphique** ci-dessous.
- **Système d'argent (PO)** : `gameState.gold`, seule monnaie du jeu. Deux sources : quelques PO
  trouvées en explorant (`config.chances.goldFind`, D100 au même titre que le reste du loot) et
  `sellItem(index)` (`SELL_VALUE_RATIO = 0.4` × `getItemValue(item)`, objet retiré de l'inventaire).
  Dépensée exclusivement dans les villes spécialisées (marchand/professeur, voir ci-dessous) — pas
  d'autre sink pour l'instant.
- **Villes spécialisées (marchand/professeur)** : à la génération d'un étage urbain, **une ville
  normale est TOUJOURS marchand, une autre TOUJOURS professeur** (ni départ, ni escalier/Sortie —
  chantier "QoL/équilibrage", Chantier D, voir `NOTES_QOL_EQUILIBRAGE.md` : avant ce chantier les deux
  étaient purement probabilistes et un étage urbain pouvait n'avoir ni l'un ni l'autre). Les deux
  villes garanties sont tirées sans remise (mélange Fisher-Yates) parmi les candidates restantes ;
  `config.urbanFloors.specializedCityChance` (18%) ne gouverne plus que les éventuelles villes
  spécialisées SUPPLÉMENTAIRES, tirée indépendamment par ville candidate restante (comportement
  probabiliste inchangé pour celles-là). Un marchand vend une catégorie d'objet (`city.specialty` ∈
  armes/armes à distance/armures/parchemins) ; un professeur forme UNE des 4 compétences réelles du
  joueur (`gameState.skills`, pas de "compétence armure" — contrairement aux objets, une compétence
  n'a que 4 valeurs possibles). `triggerShopEncounter(city)` (dispatché depuis `arriveAtCity()`, avant
  la résolution générique "ville sûre") ouvre `#shop-zone` et pose `gameState.shopChoicePending`
  (inclus dans `isActionBlocked()`, comme un choix de boss). `generateShopStock(specialty)` tire 3
  objets une seule fois par partie (`city.stock`, jamais régénéré), prix = `getItemValue(item) ×
  SHOP_MARKUP` (2.5) ; `buyShopItem()`/`sellItem()` sont les deux faces du même
  `SELL_VALUE_RATIO`/`SHOP_MARKUP`, volontairement asymétriques (acheter coûte plus cher que vendre ne
  rapporte). `sellSpell()` est le pendant de `sellItem()` pour `gameState.spellbook` (Chantier D,
  section boutique dédiée `#shop-sell-spells-list`) — un parchemin a une valeur calculée comme tout
  objet (`baseValue` du sort dans `spells.js` × rareté × niveau d'objet, chantier "refonte des objets"). `trainSkill()` paie
  `TRAINER_COST_PER_LEVEL` (20) × le niveau ACTUEL de la compétence pour l'amener exactement au niveau
  suivant (`gainSkillXp(specialty, xpToNext - xp)`) — "payer pour s'entraîner" plutôt que le grind
  combat habituel, jamais un raccourci gratuit.
- **Repaires sur les routes** : `config.urbanFloors.lairRoadsPerFloor` (1, 2 à l'étage final) routes
  du réseau urbain sont désignées "repaire" à la génération (`generateUrbanFloorMap()`), tirées parmi
  toutes les paires ville-ville reliées, `isLair`/`lairId` posés sur LES DEUX sens de la route (comme
  `distance`) pour rester détectables quel que soit le sens du trajet. `gameState.urbanMap.lairsById`
  garde l'état (`cleared`, `combatsRemaining` 2 ou 3, `bossInstance`). `travelToCity()` détecte un
  repaire uniquement sur la route DIRECTEMENT empruntée (voisin immédiat) — un trajet à plusieurs
  sauts vers une ville plus lointaine ne suit aucun chemin réel (`computeCityDistance()` ne fait que
  sommer des distances par Dijkstra) et ne peut donc pas "passer par" une route précise. Non nettoyé,
  il déclenche `triggerLairChoice()` (choix plonger/poursuivre, `gameState.lairChoicePending`, inclus
  dans `isActionBlocked()`) AVANT toute embuscade normale du trajet, qui reste en attente
  (`pendingUrbanTravel` non consommé) le temps du choix. Poursuivre (`declineLair()`) reprend le
  trajet normalement, repaire intact, re-proposé à un futur passage. Plonger (`diveIntoLair()`) lance
  le premier combat forcé ; `winCombat()` enchaîne alors seul les sbires restants puis le boss
  (`gameState.pendingLairDive.stage`, `'trash'` → `'boss'` — boss généré seulement à ce moment, jamais
  à l'avance) AVANT de reprendre le trajet interrompu, pour qu'une victoire sur un simple sbire ne
  soit jamais prise pour l'arrivée à destination ; le butin garanti d'un repaire n'est qu'un combat de
  boss normal (`winCombat()` garantit déjà du loot à tout `wasBoss`, rien de spécifique à dupliquer).
  Une fuite réussie en pleine plongée (`attemptFlee()`) annule la plongée SANS marquer le repaire
  nettoyé ni reprendre automatiquement le trajet interrompu — même comportement passif qu'une fuite
  d'embuscade urbaine normale. Visualisé sur la Carte Urbaine via `edges[].marker` (voir Mini carte
  graphique ci-dessous) : 💀 rouge tant qu'actif, 🏆 gris une fois nettoyé — jamais un `goalIcon`,
  une route reste toujours franchissable (contrairement à un gardien qui bloque le passage).
- **Mini carte graphique (réutilisable)** : `renderGraphMiniMap(svgEl, {nodes, edges, positions,
  currentId, onNodeClick, camera, viewSize, worldBounds, onCameraChange, background})` (rendu SVG,
  aucune connaissance du jeu) est le module générique — `positions` en coordonnées MONDE (unités
  arbitraires, plus de normalisation 0..1 : le viewBox reflète directement `camera ± viewSize/2`,
  aucune mise à l'échelle interne). Trois familles de marqueurs, jamais confondues : `node.goalIcon`
  (décalé sur SA route d'accès, bloque le passage — gardien 👑) vs `node.badge` (fusionné au cercle du
  nœud, ne bloque rien — marchand 🛒/professeur 🎓) vs `edges[i].marker` (au milieu de l'arête
  elle-même, n'appartient à AUCUN des deux nœuds — repaire 💀/🏆).
  **Caméra pannable** : sans `camera` explicite, centrée sur `currentId` puis, à défaut, sur la boîte
  englobante de tous les nœuds (`computeDefaultWorldBounds()` calcule des bornes par défaut si
  `worldBounds` est omis) — c'est à l'APPELANT de mémoriser un `camera` explicite d'un rendu à l'autre
  (ce module ne garde aucun état lui-même). Avec `onCameraChange`, le pan par glissement (souris ET
  tactile, `pointerdown`/`pointermove`/`pointerup`) s'active sur `svgEl` : le viewBox se déplace EN
  DIRECT pendant le glissement (mutation d'un seul attribut, jamais un re-rendu complet — coûteux à
  chaque `pointermove`, vu le volume du fond décoratif), `onCameraChange` n'étant appelé qu'UNE fois à
  la fin pour que l'appelant persiste la position. Un relâchement sous 5px de mouvement reste un
  tap/clic, résolu en retrouvant le nœud le plus proche du point relâché par distance MONDE
  (`clickableRegions`, rempli au fil du rendu) plutôt que via le `click` natif du navigateur — **ce
  dernier s'est avéré peu fiable une fois qu'un pointeur a été capturé pendant l'interaction** (même
  relâché ensuite : constaté en conditions réelles avec Playwright, pas qu'en environnement de test —
  si jamais retenté, bien re-vérifier en navigateur, pas seulement via `tests/test_stub.js`). Sans pan
  (`onCameraChange` absent), aucun pointeur n'est jamais capturé et le `click` natif classique reste
  utilisé directement sur chaque nœud, comme avant ce système. `clampCameraToBounds()` (écrêtage pur,
  testable seule) empêche le pan de sortir des `worldBounds`.
  `computeGraphLayout(nodeIds, edges, existingPositions)` (disposition par relaxation "force-directed"
  minimaliste avec ressorts + attraction centrale, sans dépendance externe) reste disponible pour un
  futur cas qui aurait vraiment besoin d'un layout calculé depuis rien plutôt qu'une grille logique —
  non utilisée par les étages urbains, mais conservée telle quelle (testée, mobilité 1/0.08 pour
  rester stable d'un rendu à l'autre) pour un futur système de navigation basé sur un graphe (mini-plan
  de donjon classique par exemple). `computeDeclutterLayout(basePositions, ids, {minDist, iterations,
  maxShift})` (répulsion PURE, sans ressort ni attraction, contrairement à `computeGraphLayout()`) est
  le second module de layout : pas un calcul depuis rien, une petite correction déterministe d'un
  layout déjà bon (la grille urbaine) pour écarter les points trop proches sans le déformer — voir
  Étages urbains ci-dessus pour son usage concret.

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
  **Étages urbains (scènes)** : sur un étage urbain (`gameState.urbanMap` présent), le combat ne se
  déroule jamais dans le décor du quartier — `resolveCombatBackdrop()` choisit
  `URBAN_COMBAT_BACKDROPS.road` (asphalte, glissière, panneau autoroutier, épave : embuscades de trajet
  et gardiens « postés sur la route ») ou `URBAN_COMBAT_BACKDROPS.lair` (pierre, torches à lueur rouge,
  crochets, crânes) pendant une plongée (`gameState.pendingLairDive`) ; étage classique inchangé.
  Pendant une plongée, `#scene-lair-progress` (haut de la scène) affiche un pion par sbire (plein =
  vaincu, cerclé de rouge = en cours) puis la couronne du boss (`lairProgressState()`/
  `composeLairProgress()`, total = `lair.combatsRemaining`). Vignettes : `urbanGuardian`
  (escalier ou porte « SORTIE » à l'étage final, le boss couronné posté DEVANT, entre elle et le
  crawler), `lairSpotted` (entrée de repaire défoncée, lueur rouge), `citySafe` (panneau au nom de la
  ville, à chaque arrivée en ville sûre et au début d'un étage urbain).
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

## Conventions de travail
1. Lire les fichiers actuels avant modification (git natif ici, pas de resync manuel nécessaire).
2. `node --check fichier.js` avant tout commit.
3. Tester avant de pousser (voir `tests/` ci-dessous) — étendre les fichiers existants, ne pas les
   recréer de zéro.
4. Incrémenter le suffixe `?v=N` sur tous les `<script>` d'`index.html` à chaque changement d'un `.js`.
5. Un correctif d'équilibrage (stats, taux, formules) se propose en LISTE à valider — jamais appliqué
   directement sans validation explicite.
6. **Versioning (à chaque merge de PR)** : incrémenter `APP_VERSION` (`app.js`), mettre à jour le
   `?v=` de TOUS les `<script>` d'`index.html` au même nombre (convention 4 ci-dessus reste valable
   pour les changements intermédiaires hors merge), puis créer un tag git `v<APP_VERSION.pr>` sur le
   commit de merge et une GitHub Release portant le même numéro. Non automatisé pour l'instant (pas de
   script de release) — à faire à la main à chaque merge.
   **Compteur unique depuis la PR #25** (choix de l'utilisateur) : `APP_VERSION.pr`, le tag, la release et
   `package.json` valent le numéro de la dernière PR mergée (32 : chantiers 9, 10 et 11). Le
   `?v=` d'`index.html` ne peut plus suivre ce numéro : les valeurs jusqu'à 34 ont déjà servi (entre deux
   merges, convention 4) — il ne fait donc que croître (41 à la PR #32), jamais recalé vers le bas,
   sans quoi un navigateur pourrait resservir un fichier gardé en cache sous une ancienne valeur. En cas de
   doute sur iPhone, vider le cache du site.

## Tests (`/tests`, deux vitesses)
- `tests/test_stub.js` — stub DOM minimal pour exécuter le jeu sous Node. `tests/load_game.js` —
  charge les fichiers sources dans l'ordre (`GAME_FILES`).
- `npm test` (= `node tests/regression.test.js`), `npm run test:long` (= `node tests/long_playthrough.js`),
  `npm run test:all` (les deux à la suite, s'arrête au premier échec) — voir `package.json`.
- `npm run sim:floors [n] [labyrinthe]` (`tests/tools/floor-sim.js`, outil de calibrage, jamais lancé par la
  CI) : génère n étages avec `floorgen.js` et affiche salles/bloc, culs-de-sac, profondeur du boss, portes,
  croisements, temps — à relancer avant toute retouche de `FLOOR_LAYOUT`.
- `npm run sim:items` (`tests/tools/item-curve.js`, outil de calibrage, jamais lancé par la CI) :
  répartition des raretés par étage et source, courbe de puissance selon l'équipement, valeur marchande
  — à relancer avant toute retouche de `itemBalance`/`itemRarities`.
- **Rapide** (`npm test`, quelques secondes) : à lancer avant CHAQUE push. `tests/regression.test.js`
  est un AGRÉGATEUR (depuis la Tâche 2 du chantier "fiabilisation" — l'ancien fichier monolithique
  faisait ~172 Ko) : il ne fait que `require()` chaque module de `tests/regression/*.js`, regroupés
  par domaine (`meta-reset.js`, `combat.js`, `combat-scene.js`, `combat-scaling.js`, `combat-boss.js`,
  `combat-enrage.js`, `items.js`, `loot.js`, `misc.js`, `magic.js`, `saves.js`,
  `floor-transition.js`, `necrologie.js`, `anomalies.js`, `urban-floors.js`, `balance.js`,
  `urban-map.js`, `urban-shops.js`, `urban-lairs.js`, `safehouses.js`, `companions.js`, `achievements.js`, `bounty.js`, `deathwatch.js`, `floor-map.js`, `inventory-ui.js`), dans l'ordre où chacun apparaît en tête de
  liste dans `regression.test.js` — cet
  ordre correspond à la position de la PREMIÈRE section de chaque module dans l'ancien fichier
  monolithique, pour rester aussi proche que possible de l'ordre d'exécution d'origine (les tests
  restent malgré tout indépendants : chaque section démarre par `resetTransientState()`).
  `tests/regression/_helpers.js` centralise le chargement du jeu (une seule fois, via le cache de
  `require()` — peu importe combien de modules l'importent), `assert()` et `resetTransientState()`,
  avec un compteur d'assertions PARTAGÉ (`counts`, objet muté par référence) pour que l'agrégateur
  affiche un résumé global à la fin. Étendre une feature existante : ajouter une section au module de
  domaine concerné (jamais dans `regression.test.js` directement). Nouveau domaine : nouveau fichier
  dans `tests/regression/`, puis l'ajouter à la liste de `require()` de l'agrégateur.
  `resetTransientState()` (dans `_helpers.js`) doit rester à jour : tout nouvel état
  bloquant/transitoire (`xyzChoicePending`, `pendingXyz...`) doit y être remis à zéro, sinon un échec
  aléatoire (dû à un test antérieur non lié) peut fuiter sur des tests bien plus loin dans la suite —
  voir `tests/regression/meta-reset.js` ci-dessous, qui détecte cette classe de bug AUTOMATIQUEMENT.
- **Règle : tout nouveau champ transitoire de `gameState` doit être ajouté à `resetTransientState()`
  ET répertorié dans `KNOWN_GAMESTATE_KEYS`** (`tests/regression/meta-reset.js`, Tâche 3 du chantier
  "fiabilisation"). Ce test méta détecte AUTOMATIQUEMENT (sans liste à maintenir à la main pour cette
  partie) deux classes de fuite d'état, responsables de plusieurs échecs flaky lointains par le passé
  (`timeLeft` oublié, champs d'anomalies, un cas `travelToCity`) : (1) tout champ nommé `*ChoicePending`
  ou `pending*` est délibérément "sali" (valeur truthy) puis vérifié falsy juste après
  `resetTransientState()` — cette convention de nommage est déjà strictement respectée par tout état
  bloquant/transitoire existant ; (2) toute clé de `gameState` LUE par `isActionBlocked()` doit être
  explicitement AFFECTÉE dans le corps de `resetTransientState()` (comparaison directe des deux sources
  via `.toString()`), pour qu'un nouveau `xyzChoicePending` ajouté à l'un des deux sans l'autre échoue
  immédiatement plutôt que de fuiter silencieusement. `KNOWN_GAMESTATE_KEYS` (liste blanche EXPLICITE,
  celle-ci À MAINTENIR À LA MAIN) complète ces deux mécanismes pour toute clé de `gameState` qui
  n'entre dans aucun des deux (ex. `xp`/`xpToNextLevel`/`skills`, repérés et corrigés en écrivant ce
  test — non-transitoires au sens "blocage", mais tout de même remis à un niveau de base par
  `resetTransientState()` pour l'isolation des tests) : une clé absente de `gameState` mais présente
  dans la liste (ou l'inverse) fait échouer ce test, forçant une décision consciente à chaque nouveau
  champ plutôt qu'un oubli silencieux.
- **Lourd** (`npm run test:long`, simulation ~200 pas sur plusieurs étages) : à lancer UNE fois,
  seulement si le changement touche la boucle de jeu elle-même (combat, distance, compagnon,
  génération d'étage). Pas nécessaire pour un ajout de contenu isolé (item, quartier, texte).
  Son auto-résolveur doit connaître TOUT état bloquant existant (`xyzChoicePending`) : en oublier un
  fige la simulation dessus jusqu'à épuisement du temps imparti (voir `shopChoicePending`/
  `lairChoicePending`/`floorTransitionPending`/`pactChoicePending`/`stairsChoicePending` — la simulation
  descend toujours —, `showChoicePending`, ajoutés après coup).
- Les deux n'affichent que les échecs + un résumé final (pas une ligne par test réussi).
- **CI** (`.github/workflows/ci.yml`) : sur chaque push (toute branche) et chaque pull request,
  `actions/checkout` + `actions/setup-node` (Node 20) puis `npm test` et `npm run test:long` — pas de
  `npm install` (aucune dependency/devDependency), pas de cache, pas d'artefact, volontairement minimal.
  Après un push, le statut de ce workflow devient LA RÉFÉRENCE : le protocole "20+ runs consécutifs en
  local avant de pousser" reste utile pour chasser le flaky avant même d'arriver jusque-là, mais un
  push dont la CI passe au rouge doit être corrigé avant de continuer sur autre chose.

## Backlog
- Sons : hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).
- À valider par playtest réel : fréquence de changement de quartier, formule de risque des trajets
  sur la carte (distance × 9 %, plafond 80 %, avenues ×0,5), courbes de furtivité, table D100 des événements
  (`config.chances` — une proposition de rééquilibrage a été faite, jamais validée).
- Simulation mob/joueur (voir historique) : les boss restent disproportionnellement plus punitifs
  que les mobs normaux à profondeur égale, et l'écart se rouvre en fin de run (étage 8+) sous
  l'hypothèse testée — non corrigé, à confirmer par playtest réel avant tout changement.
- Économie urbaine (PO, marchand/professeur, repaires — voir Architecture) : tous les chiffres sont
  des défauts posés sans playtest (18% de ville spécialisée, ×2.5 marchand / ×0.4 revente, ×20 coût de
  formation par niveau, 5-20 PO trouvées ×(1+étage×0.15), 1 repaire par étage urbain / 2 à l'étage
  final, 2-3 combats forcés par repaire) — "on verra à l'usage", à ajuster une fois du retour réel
  disponible plutôt qu'en tâtonnant sans données.

- **Refonte des objets** (faite, voir `NOTES_ITEMS.md`) : chiffres calibrés par simulation seulement
  (`npm run sim:items`), à confirmer par playtest — en particulier l'économie (un Légendaire vaut ~20×
  un Commun : un seul objet signature revendu finance beaucoup de boutique).

## Gros chantiers à venir
Voir **`CHANTIERS.md`** (registre des chantiers : ordre recommandé, ampleur, statut, dépendances,
décisions). Méthode : Exploré → Suggéré → Planifié → Codé. Tenir ce registre à jour à chaque étape.

## Notes
- GitHub Pages sert tout le dépôt tel quel : `/tests` n'affecte pas le jeu, pas besoin de l'exclure.
- Pas de framework, pas de bundler : tout doit rester exécutable en ouvrant `index.html` tel quel.
