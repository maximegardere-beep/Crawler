# Notes — Chantier « Nouveaux sorts »

Chantier 11 du registre (`CHANTIERS.md`). Demande : de nouveaux sorts. Décisions de l'utilisateur : **tout
validé** (effets intrinsèques, sorts utilitaires, liste et chiffres) ; un sort utilitaire **consomme le tour**
(le mob riposte).

## Diagnostic de départ
- 8 sorts, tous des dégâts purs (4 mêlée, 4 distance), qui ne différaient que par dégâts, mana et portée.
- Les états d'ennemi existaient déjà et étaient gérés partout (badges, boss inclus).

## Ce qui a changé (`spells.js`, `attackMagic()`)
- **Effet intrinsèque** `spellEffect` (catalogue `SPELL_EFFECTS`, phrase d'inspection
  `describeSpellEffect()`), dégâts de base un peu plus bas pour compenser. Après un coup porté,
  `castSpellEffect()` réutilise les états existants (`resolveQualifierEffect()`) ; aveuglé =
  `status.distracted` ; la Chaîne d'Éclairs ajoute son second éclair AU coup (`options.chainPct`).
- **Catégorie `any`** (« Partout », `spellRangeLabel()`) : sorts utilitaires sans dégâts, utilisables à toute
  distance, qui consomment le tour (`castUtilitySpell()` puis `resolveEnemyReaction()`).

| Sort | Portée | Dégâts | Mana | Effet |
|---|---|---|---|---|
| Étreinte Vampirique | mêlée (ét. 2) | 5 | 16 | rend 30 % des dégâts en PV |
| Gifle Sonique | mêlée | 4 | 14 | 30 % d'étourdir (perd son prochain tour) |
| Main de Rouille | mêlée | 4 | 13 | corrode : DEF −40 % pendant 3 tours |
| Nuée de Guêpes | distance | 4 | 15 | saignement 30 % des dégâts, 3 tours |
| Flash Aveuglant | distance | 3 | 14 | 40 % de rater, 2 tours |
| Chaîne d'Éclairs | distance (ét. 4) | 7 | 24 | second éclair à 50 % |
| Cri de Terreur | distance | 2 | 12 | dégâts −35 %, 3 tours |
| Soin Express | partout | — | 20 | soigne 20 % des PV max (suit la rareté) |
| Bouclier de Mana | partout (ét. 2) | — | 18 | dégâts reçus −40 %, 2 tours (`gameState.status.manaShield`, appliqué dans `companionInterceptHit()`, décompté par `tryPlayerAction()`) |
| Pas de l'Ombre | partout | — | 15 | +2 d'écart sans jet opposé |

- Effets visuels `FX_SPELLS` (style `self` pour les utilitaires, `fxPlayerSelfSpell()`) et lueur de main
  par icône (`CRAWLER_SPELL_GLOWS`).
- Le cadeau de départ, le kit de test et les compagnons n'utilisent que des sorts offensifs.

## Tests
- `tests/regression/magic.js` : chaque effet décrit, effets appliqués (vol de vie, étourdi, corrodé,
  saignement, aveuglé, chaîne, terreur), sorts utilitaires (soin selon la rareté, bouclier sur 2 tours, pas de l'ombre plafonné),
  inspection sans ligne de dégâts ; `magic-balance.js` (parité magie/arme) mis à jour.

## À surveiller en playtest
- Bouclier de Mana + Soin Express : le combo peut rendre les combats longs trop sûrs.
- Pas de l'Ombre : relance le kiting ; l'enrage distance (chantier « rework combat ») doit rester la réponse.
- Étourdissement à 30 % (Gifle Sonique) : à ressentir, en particulier contre les boss.
