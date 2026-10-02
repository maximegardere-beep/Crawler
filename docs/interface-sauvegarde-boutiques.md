# Interface allégée, écran de départ, sauvegarde, argent, villes spécialisées

> Fiche extraite de `CLAUDE.md` (lue à la demande). Dans ce texte, « app.js » désigne le moteur : `engine/*.js` + `app.js` (table dans `CLAUDE.md`). Fichiers concernés : engine/ui.js, engine/inventory.js, engine/saves.js, engine/gameplay.js, engine/shops.js.

- **Interface allégée** (chantier 9, voir `NOTES_INTERFACE.md`) : sous le nom, la fiche du crawler `#player-sheet` (barre de PV
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
  n'a que 4 valeurs possibles). `triggerShopEncounter(city)` (à l'entrée de la salle du marchand / du
  professeur, `enterUrbanRoom()`) ouvre `#shop-zone` et pose `gameState.shopChoicePending`
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
