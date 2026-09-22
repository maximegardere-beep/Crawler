# Crawler

Rogue-like textuel minimaliste inspiré de Dungeon Crawler Carl. GitHub Pages, HTML/JS vanilla +
Tailwind CDN, **aucun build step**.

## Fichiers
- `index.html` — UI (deck de cartes, combat, inventaire, "Lieux connus", Game Over)
- `app.js` — moteur : état, exploration, combat, niveau/XP, compétences, équipement, compagnons, carte d'étage
- `bestiary.js` — monstres de base + boss de quartier (`districtBosses`)
- `items.js` — objets, raretés, enchantements (`itemModifiers.effect`)
- `districts.js` — quartiers (référencent les monstres par nom)
- `safehouses.js` — types de salles sécurisées (narratif seul pour l'instant)
- `generator.js` — génération procédurale (mobs, objets, boss, compagnons)
- `tests/` — voir plus bas

## Architecture (résumé)
- Étage = zone circulaire à **4 quartiers fixes** générés à l'entrée (`generateFloorMap()`), graphe
  de pièces reliées par couloirs artère (rapide/sûr) ou ruelle (lent/risqué).
- 1 boss par quartier ; l'escalier est gardé par l'un des 4. "Repérer et partir" garde le même mob
  en cache sur sa pièce, combattable plus tard via "Lieux connus" (distance réelle par Dijkstra,
  `computeDistance()`, coût/risque de trajet proportionnels).
- Salles sécurisées : pièces fixes, thème tiré dans `safehouses.js`, deviennent un lieu connu.
- Exploration = un seul bouton "Explorer" : jamais de choix bloquant de navigation.
- **Combat à distance** : aucune posture côté joueur — seul `mob.ranged` détermine l'écart de départ
  (`gameState.combatDistance`, 0 si mêlée). Arme/Mains nues exigent l'écart nul, Tir l'écart > 0 (+
  arme à distance équipée pour Tir, arme pour Arme) : ce sont de simples dégâts gated par l'écart
  courant, sans manche de distance embarquée. `attemptSprint()` (S'approcher) et `attemptRetreat()`
  (S'éloigner) sont les DEUX SEULES actions qui font évoluer l'écart, toujours affichées pendant un
  combat et grisées à l'extrémité correspondante (écart nul / maximal) plutôt que masquées ; chacune
  oppose un jet avantagé du joueur à un jet du mob, jamais de dégâts. Un mob de mêlée ne peut jamais
  toucher un joueur qui tient encore la distance (`getCombatRangeContext().playerAdvantaged`) ; toute
  riposte passe par `resolveEnemyReaction()` (bloque, ou fait avancer le mob d'une manche s'il n'a pas
  déjà agi ce tour) plutôt que par `enemyCounterAttack()` en direct, pour ne jamais laisser un mob de
  mêlée figé hors de portée.
- **Furtivité** : détection avant rencontre aléatoire, Esquiver / Attaque Furtive (bonus x2 garanti).
- **Compagnons** : 4 spécialités. `leaveChance` (0-100) grimpe avec l'XP du compagnon ; à chaque
  montée de niveau, un jet décide s'il abandonne (départ **pacifique**, raison aléatoire parmi
  `COMPANION_ABANDON_REASONS`) — ce n'est PAS un seuil dur, juste une probabilité croissante.
- **Objets** : 4 raretés (commun/rare/épique/légendaire) → slots d'enchantement + multiplicateur de
  stats. `IMPLEMENTED_WEAPON_MECHANICS` / `IMPLEMENTED_ARMOR_MECHANICS` listent les enchantements
  qui ont un vrai effet en combat ; le reste (`pleasure_or_pain`, `aoe`, `darkness`) est cosmétique
  des deux côtés. Badges visibles dans l'inventaire (`buildMechanicBadgesHtml()`), colorés si
  fonctionnels, grisés sinon.
- **Mobs élite** : `generateMob()` pose `threatMultiplier` (puissance apportée par les seuls
  modificateurs, hors scaling d'étage). Au-delà de `config.eliteThreatMultiplier`, icône 💀
  (jamais sur un boss, qui garde 👑 — voir `isEliteMob()`).

## Conventions de travail
1. Lire les fichiers actuels avant modification (git natif ici, pas de resync manuel nécessaire).
2. `node --check fichier.js` avant tout commit.
3. Tester avant de pousser (voir `tests/` ci-dessous) — étendre les fichiers existants, ne pas les
   recréer de zéro.
4. Incrémenter le suffixe `?v=N` sur tous les `<script>` d'`index.html` à chaque changement d'un `.js`.
5. Un correctif d'équilibrage (stats, taux, formules) se propose en LISTE à valider — jamais appliqué
   directement sans validation explicite.

## Tests (`/tests`, deux vitesses)
- `tests/test_stub.js` — stub DOM minimal pour exécuter le jeu sous Node. `tests/load_game.js` —
  charge les 6 fichiers sources dans l'ordre.
- **Rapide** (`node tests/regression.test.js`, quelques secondes) : à lancer avant CHAQUE push.
  Couvre Sprint, mécaniques d'armure, icône élite, abandon de compagnon, badges. Ajouter une
  section ici pour toute nouvelle feature testable unitairement.
- **Lourd** (`node tests/long_playthrough.js`, simulation ~200 pas sur plusieurs étages) : à lancer
  UNE fois, seulement si le changement touche la boucle de jeu elle-même (combat, distance,
  compagnon, génération d'étage). Pas nécessaire pour un ajout de contenu isolé (item, quartier, texte).
- Les deux n'affichent que les échecs + un résumé final (pas une ligne par test réussi).

## Backlog
- Sons : hébergement des fichiers non tranché (3 catégories : actions, ambiance, mobs).
- À valider par playtest réel : fréquence de changement de quartier, formule de risque des trajets
  vers lieux connus (distance × 9 %, plafond 80 %), courbes de furtivité, table D100 des événements
  (`config.chances` — une proposition de rééquilibrage a été faite, jamais validée).
- Simulation mob/joueur (voir historique) : les boss restent disproportionnellement plus punitifs
  que les mobs normaux à profondeur égale, et l'écart se rouvre en fin de run (étage 8+) sous
  l'hypothèse testée — non corrigé, à confirmer par playtest réel avant tout changement.

## Gros chantiers à venir (non commencés — demander lequel prioriser avant de s'y lancer)
- Magie : mana + livre de sorts
- Niveaux multiples de 3 ("urbain", façon Dungeon Crawler Carl)
- Sons
- Succès (achievements)
- Salles spéciales à choix narratif basé sur les compétences, sans fuite possible

## Notes
- GitHub Pages sert tout le dépôt tel quel : `/tests` n'affecte pas le jeu, pas besoin de l'exclure.
- Pas de framework, pas de bundler : tout doit rester exécutable en ouvrant `index.html` tel quel.
