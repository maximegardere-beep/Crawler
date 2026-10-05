# Chantier 17 — Gorgoth le Concierge (Boss de Niveau)

Registre : `CHANTIERS.md` §17. Résumé d'architecture : `CLAUDE.md` (« Boss de Niveau : Gorgoth le Concierge »).

## Demande

Un boss de niveau persistant : un démon (direction artistique « style Balrog », nom et design propres au jeu) qu'on affronte après
avoir vaincu les 4 boss de quartier d'un étage (4 clés → porte colossale → antre). Il n'est qu'assommé quand on le bat et revient. Son
armurerie contient 4 objets uniques maudits, un seul peut sortir de l'antre. Combat différent, épique et stressant, qui intègre les stats du
joueur ; il s'adapte au style qui l'a battu et garde la Sortie de l'étage 18.

## Décisions (rounds 1-3)

- Clés **par étage** (les 4 boss du même étage, perdues en descendant) ; porte au carrefour central de chaque étage classique.
- Combat en **actes** + **intentions annoncées** + **jauge d'Emprise**.
- Défaite = **expulsion** (jamais un Game Over), sauf à l'étage 18.
- Adaptation = **Cicatrices** plafonnées + faiblesse au style opposé.
- Armurerie : **1 sur 4, échangeable** ; chaque objet a une **malédiction**.
- Étage 18 : **forme finale** (4e acte, Fatigue, pas d'assommage), remplace le gardien de la Sortie.
- Scène **agrandie** (360 × 300) pour le montrer en entier. Nom : **Gorgoth le Concierge**.

## Chiffres (validés avec le plan, `config.demonBoss`)

| Levier | Valeur |
|---|---|
| PV / DEF | 5 × PV max du joueur / 40 % de son ATQ effective |
| Coup de base | 12 % des PV max du joueur (avant mitigation) |
| Montée | +12 % PV et dégâts par mise au tapis passée |
| Actes | I 100-66 %, II 66-33 % (écart max 6), III < 33 % (écart max 4, compte à rebours 5 → Cataclysme 80 % PV max, Parade Parfait ×0 / Réussi ×0,5) |
| Étage 18 | acte IV < 15 % (compte à rebours 3), Fatigue −5 % PV par mise au tapis (plafond −30 %) |
| Intentions | Fauche 18 %, Brasier 15 %, Emprise +25, Garde DEF ×2, Fouet écart → 0 + 10 % ; 25 % masquées (Furtivité 8 %/niv, max 60 %) |
| Emprise | +8/tour + ½ % PV perdus ; −10 bonne réponse, −15 Parfait, −5 gros coup ; Possession à 100, retombe à 40 |
| Cicatrices | −20 / −40 / −60 % sur le style dominant, +15 %/cran au style opposé (mêlée ↔ distance, magie ↔ mains nues) |
| Expulsion | 1 PV, −10 H (jamais sous 1 H), porte rescellée pour l'étage |
| Objets | rareté Démoniaque ×2,2, invendables, niveau = étage, +2 niveaux en gardant ; bases : Trousseau ATK 13, Bleu de Travail ARM 11, Lance-Clés ATK 12, Règlement DMG 13 |

Objets : Trousseau Ardent (vol de vie 15 % / potions −50 %), Bleu de Travail Ignifugé (annule le premier coup mortel de chaque combat /
régénération passive nulle), Lance-Clés Infernal (âmes : +100 % par âme, 3 max / tir sans âme = 3 % PV max), Règlement Intérieur (sort très
puissant / coûte 8 % des PV max au lieu du mana). Malédictions actives tant que l'objet est possédé, même en réserve.

## Livraison (9 lots parallèles, fusionnés dans `claude/chantier-17-demon`)

| Lot | Contenu | PR |
|---|---|---|
| 1 | Accès : porte, clés, badge, repères, étage 18 | #43 |
| 2 | Moteur du combat (`demon.js`, `config.demonBoss`, riposte, expulsion, mise au tapis) | #45 |
| 3 | Interface de stress (`#demon-hud`, voile d'Emprise) | #40 |
| 4 | Objets démoniaques + armurerie | #44 |
| 5 | Dessins et effets des objets | #39 |
| 6 | Antre, porte, vignettes, écran d'entrée SVG | #42 |
| 7 | Sprite de Gorgoth + scène haute | #46 |
| 8 | Sons (11 recettes Web Audio) | #38 |
| 9 | Chronique : succès, DeathWatch, épitaphes, indice Game Over | #41 |

Fusion : conflits attendus seulement (`GAME_FILES`, agrégateur de tests, `restoreSaveForName()`, `updateUI()`, résolveurs de
`long_playthrough.js`) ; doublons levés (`demonVignette()`, constantes de Cicatrices de la chronique renommées `DEMON_RUN_SCAR_*`) ;
tests de la Sortie adaptés (Gorgoth la garde désormais) ; deux tests rendus déterministes (départ voisin de la porte) ; badge « Phase N » des
boss masqué pour Gorgoth (l'acte du HUD le remplace). Parcours Chromium complet vérifié : 4 clés → porte → écran d'entrée → actes I-III →
mise au tapis → armurerie → étage 18 en forme finale, sans erreur.

## Choix faits pendant le code (à confirmer)

- Une victoire sur la forme finale ne compte pas comme une mise au tapis (succès Or séparé).
- La chronique ne compte un passage à l'armurerie que si un objet est emporté.
- Bleu de Travail : l'Armure de scénario (étages 1-3) passe d'abord, puis le Bleu, puis l'Increvable du Cafard.
- Tenter de fuir ne coûte pas le tour (message « la porte est scellée »).
- Contre Gorgoth, seule l'Occasion « Cible de précision » est proposée.

## À surveiller en playtest

- **Difficulté** : la simulation longue (`npm run test:long`) finit toujours par une expulsion — le joueur simulé ne met jamais Gorgoth au
  tapis. Indice qu'il est très dur ; leviers : `hpMult` (5 × PV), dégâts de base 12 %, vitesse de l'Emprise, Cataclysme 80 %.
- Temps : vaincre les 4 boss + Gorgoth sur un même étage tient-il dans le budget (130 H + 5/étage) ?
- Lisibilité de la scène haute et du HUD sur petit écran (le HUD + la scène 360 × 300 poussent les boutons plus bas).
- Puissance des objets démoniaques (×2,2 + effet) face à leurs malédictions ; le Bleu de Travail rend-il le jeu trop facile ?
- Fatigue d'écoute du battement de cœur quand l'Emprise reste haute.
