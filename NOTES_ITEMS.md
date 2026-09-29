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

**Rareté par étage** (`itemBalance.lootTables`, Camelote / Commun / Rare / Épique / Légendaire) :

| Étages | Cam. | Com. | Rare | Épi. | Lég. |
|--------|------|------|------|------|------|
| 1-2    | 12   | 65   | 20   | 3    | 0    |
| 3-5    | 8    | 55   | 28   | 8    | 1    |
| 6-9    | 5    | 42   | 34   | 15   | 4    |
| 10-14  | 3    | 33   | 34   | 22   | 8    |
| 15+    | 2    | 24   | 34   | 28   | 12   |

Élite : 25 % de monter d'un palier. Boss : +1 palier, plancher Rare, second objet 25 % (au lieu de 50 %).
Objet signature garanti à la première victoire sur ce boss, puis 20 %. Trésor de CAFET_ASSOMBRIE : +1 palier.

Mesuré (20 000 tirages) : un boss d'étage 1 donne ~77 % Rare / 20 % Épique / 3 % Légendaire.

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
