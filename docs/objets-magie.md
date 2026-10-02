# Objets (raretés, qualificatifs, familles) et magie

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/inventory.js, generator.js, items.js, spells.js.

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
  **Sorts à effet et utilitaires** (chantier 11, voir `NOTES_SORTS.md`) : `spellEffect` (catalogue `SPELL_EFFECTS` de `spells.js`,
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
