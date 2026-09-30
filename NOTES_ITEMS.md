# Refonte des objets — notes d'équilibrage

Chantier demandé par l'utilisateur : trop d'objets de haute rareté dès les étages 1-2 (surtout après
les boss), pas de progression entre raretés ni avec la profondeur, prix sans rapport avec la puissance,
qualificatifs peu clairs (dont 3 sans effet), et un départ trop souvent les mains vides.

Tous les chiffres ci-dessous sont des valeurs de départ, calibrées avec `npm run sim:items`
(`tests/tools/item-curve.js`) et à confirmer par playtest réel.

## Diagnostic de départ (mesuré avant la refonte)

- Rareté pondérée par l'XP du monstre (`xpReward / 400`) : un boss d'étage 1 (90-150 XP) tirait déjà
  comme un mob d'étage 5, avec un plancher Épique → **95 % Épique, 5 % Légendaire**, plus un second objet
  une fois sur deux et un objet signature Légendaire à chaque victoire. 4 boss par étage classique.
- Aucune mise à l'échelle par profondeur : un Légendaire d'étage 1 = un Légendaire d'étage 15.
- Bonus énormes face au joueur : ATQ de base 10, ~38 au niveau 10 ; un Fusil de Chasse Légendaire
  donnait **+58**, un objet signature +28 à +36 dès l'étage 1.
- Valeur = `baseValue × 0,4` quelle que soit la rareté : un Commun et un Légendaire se revendaient pareil.
- 17 qualificatifs, dont 3 cosmétiques (Vibrant, Explosif, Ténébreux) et un doublon (Lourd/Électrique),
  tous à 30 % fixe, sans chiffre visible.

## Modèle retenu

**Niveau d'objet** (`itemLevel` = étage d'obtention, +1 pour un boss de repaire) :
`stat = base × statMult(rareté) × (1 + 0,2 × (niveau − 1)) × aléa ±10 %`. Soins : 0,15 par niveau.
Le mana et le coût en mana ne dépendent jamais du niveau d'objet (mana plafonné à 100).

**Raretés** (`itemRarities`) :

| Palier     | Stats | Qualificatifs | Rang | Valeur |
|------------|-------|---------------|------|--------|
| Camelote   | ×0,7  | 0 (+1 défaut à 60 %) | — | ×0,3 |
| Commun     | ×1    | 0             | —    | ×1     |
| Rare       | ×1,25 | 1             | I    | ×2,5   |
| Épique     | ×1,5  | 2             | II   | ×7     |
| Légendaire | ×1,8  | 3             | III  | ×20    |

**Objets de base** : dégâts des armes et des sorts divisés par ~2 (parité magie/arme conservée), armures
×0,6, et profondeur minimale (`minFloor`) pour les meilleurs (ex. Fusil de Chasse à l'étage 6).
Objets blagues uniquement en Camelote.

**Rareté par étage** (`itemBalance.lootTables`, Camelote / Commun / Rare / Épique / Légendaire) —
refonte validée au chantier 10 (l'ancienne table rendait la rareté triviale dès les premiers étages) :

| Étages | Cam. | Com. | Rare | Épi. | Lég. |
|--------|------|------|------|------|------|
| 1-2    | 30   | 60   | 9,48 | 0,5  | 0,02 |
| 3-5    | 20   | 58   | 18   | 3,8  | 0,2  |
| 6-9    | 12   | 50   | 28   | 9    | 1    |
| 10-14  | 6    | 40   | 34   | 16   | 4    |
| 15+    | 3    | 28   | 36   | 24   | 9    |

Élite : 20 % de monter d'un palier. Boss : +1 palier, plancher selon l'étage (aucun 1-3, Rare dès 4, Épique
dès 12), second objet 25 %. Trésor de CAFET_ASSOMBRIE : +1 palier. Plafond des montées (élite, boss, trésor,
Chanceux) : Épique jusqu'à l'étage 4 ; le tirage de base n'est jamais rabaissé (le « miracle »).
Objet signature : Rare aux étages 1-4, Épique 5-9, Légendaire dès 10 (rang de sa rareté), garanti à la
première victoire sur ce boss, puis 20 %.

Mesuré (`npm run sim:items`, 20 000 tirages) : boss d'étage 1 ~30 % Commun / 60 % Rare / 10 % Épique ;
étage 8 ~62 / 28 / 10 % Rare / Épique / Légendaire ; étage 15 ~66 % Épique / 34 % Légendaire.

Effet de la refonte — probabilité d'avoir vu au moins une arme de mêlée légendaire (hors objet signature)
à la fin de l'étage, sur une partie type (12 butins de mob, 1-2 élites et 2 boss par étage) :

| Étage | 1 | 2 | 3 | 5 | 8 | 10 | 12 | 15 | 18 |
|---|---|---|---|---|---|---|---|---|---|
| Avant | 1,2 % | 2,7 % | 9,2 % | 21 % | 57 % | 75 % | 88 % | 96 % | 99 % |
| Après | 0,1 % | 0,2 % | 0,8 % | 3,8 % | 23 % | 42 % | 61 % | 82 % | 95 % |

**Valeur** : `baseValue × valueMult × (1 + 0,15 × (niveau − 1)) × (1 + 0,15 × qualificatifs)`. Arme
moyenne : Commun 14 PO / Légendaire ~400 PO à l'étage 1, ~1 550 PO à l'étage 10 (revente ×0,4, achat ×2,5).

## Courbe visée

« Surpuissant quelques étages, puis à remplacer » : stats brutes (hors qualificatifs), arme moyenne
accessible à l'étage.

- Un Légendaire trouvé à l'étage 4 ≈ un Rare de l'étage 7 ≈ un Commun de l'étage 10.
- Un Légendaire trouvé à l'étage 2 ≈ un Commun de l'étage 5 (les premiers étages passent vite).
- Commun au bon niveau : +4 ATQ à l'étage 1, +17 à l'étage 10, +27 à l'étage 18 (ATQ joueur ~10 → ~100).

Ces cibles sont verrouillées par `tests/regression/loot.js` (section « Courbe de puissance »).

## Qualificatifs

32 qualificatifs dans `itemQualifiers` (items.js), chacun avec des valeurs par rang et par type d'objet,
et une phrase d'inspection générée depuis ces mêmes valeurs. Plus aucun n'est cosmétique :

- Déclenchés (arme / armure / sort) : Tranchant, Empoisonné, Lourd, Gelé, Vibrant (déconcentre),
  Chaotique, Lumineux, Corrosif, Terrifiant, Galvanisant, Électrique (dégâts bonus), Explosif (dégâts
  bonus, peut roussir le porteur sans le tuer), Régénérant, Drainant (plafond −40 % de l'ATQ d'origine),
  Vampirique (passif sur arme/sort, déclenché sur armure).
- Permanents : Aiguisé, Amplifié (sort), Économe (sort), Véloce, Épineux, Robuste, Précis, Perforant,
  Silencieux, Chanceux, Ténébreux (esquive), Tenace, Canalisé (sort).
- Défauts de Camelote : Rouillé, Fêlé, Bancal, Grinçant, Bredouillant.

Corrigé au passage : Gelé/Terrifiant et les qualificatifs d'armure n'avaient aucun effet contre un boss ;
les qualificatifs d'un sort n'étaient jamais appliqués.

## Départ

Cadeau : Arme 38 / Tir 25 / Armure 17 / Magie 15 / Rien 5, toujours en Camelote, niveau 1.

## À surveiller en playtest

- Économie : un objet signature se revend ~330 PO à l'étage 1, ~780 PO à l'étage 10 — de quoi financer
  beaucoup de boutique et de formation (20 PO × niveau de compétence).
- Étage 1 sans arme (5 % des départs, ou cadeau Magie/Armure) : le plus lent de la partie (~8 tours par
  mob moyen dans le modèle).
- Taux de proc (20-40 %) : à ressentir en jeu, en particulier Lourd (étourdissement) et Vibrant.

## Chantier 10 — expansion de la banque d'objets (voir CHANTIERS.md)
- **Familles** (`ITEM_FAMILIES`, `items.js`) : Bricolage 10 · Standard 6 · Militaire 3 · Arsenal 1 — poids du
  tirage de l'objet de BASE (`pickBaseItem()`), indépendant de la rareté. Objets blagues à demi-poids
  (`itemBalance.jokeWeightMult`), boutiques ×2 Militaire / ×3 Arsenal (`itemBalance.shopFamilyBoost`).
- **13 nouveaux objets** : Masse d'Armes (10, ét. 4), Épée Longue (12, ét. 5), Katana de Collection (12, ét. 6),
  Tronçonneuse (14, ét. 7, Grinçante), Marteau de Guerre (15, ét. 9, Bancal) ; Arc Long de Compétition (12, ét. 5),
  Lance-Harpon (13, ét. 7), Arbalète Lourde (14, ét. 8, Bancale), Fusil à Pompe (15, ét. 10, Grinçant) ; Armure
  Anti-Émeute (9, ét. 5), Cotte de Mailles (10, ét. 6), Tenue de Démineur (12, ét. 8, Grinçante), Armure de Plates
  (13, ét. 9, Grinçante).
- **Objets blagues** ajoutés : Nouille de Piscine, Tapette à Mouches, Pistolet à Bulles, Poncho en Sac-Poubelle.
- **Rééquilibrage** : Antivol de Voiture 7 → 4 dégâts, dès l'étage 1 (Bricolage) ; Bâton de Dynamite, Lance à
  Feu, Fusil de Chasse Rouillé et Manteau en Skaï Renforcé en Militaire.
- **Traits fixes** (`base.trait`) : qualificatif toujours porté, hors emplacements (`withFixedTrait()`).
- **Rareté** : refonte validée et appliquée (tables, plafond des montées, boss, objet signature) — voir
  « Rareté par étage » plus haut et CHANTIERS.md, chantier 10.

