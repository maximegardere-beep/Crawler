# Backlog — chiffres à valider par playtest (extrait de `CLAUDE.md`)

Les idées de fonctionnalités (sons, mini-jeux, salles narratives) vivent dans `CHANTIERS.md` ; ici ne
restent que les chiffres à valider par playtest (repris dans la section « À playtester » du registre).
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

