# Notes — Chantier « Interface inventaire allégée »

Chantier 9 du registre (`CHANTIERS.md`). Demande : passer les PV et les stats sous le nom du crawler, une
icône pour l'équipement porté, une autre pour l'inventaire — alléger l'interface sans perdre d'information.
Décisions de l'utilisateur : barre d'icônes **fixée en bas de l'écran**, **masquée en combat**, **pastilles**
« nouveau » sur le Sac et le Grimoire.

## Diagnostic de départ (écran de 390 px)
- PV (anneau), ATQ/DEF, PO et états loin sous la scène, la carte et le journal ; mana juste après.
- Sections Inventaire et Grimoire toujours dépliées : environ 500 px de hauteur en permanence.

## Ce qui a changé
- **Fiche du crawler** `#player-sheet` sous le nom : barre de PV horizontale (`setHpBar()`, couleur selon la
  part de PV), barre de mana si un sort est équipé, fine barre d'XP, puces ATQ · DEF · PO · états. L'ancien
  bloc de vitals a disparu.
- **Barre d'icônes** `#bottom-nav` (fixée en bas) : 🛡️ Équipement · 🎒 Sac (compteur n/8) · 📖 Grimoire ·
  🏆 Succès. `updateBottomNav()` (appelée par `updateUI()`/`updateInventoryUI()`/`updateSpellbookUI()`) la
  masque en combat.
- **Panneaux** `#equipment-sheet` / `#bag-sheet` / `#spellbook-sheet` : `openInventorySheet(name)` /
  `closeInventorySheets()`, un seul ouvert à la fois, aucun en combat (entrer en combat referme le panneau
  ouvert). Toucher un objet ouvre le panneau d'inspection habituel (actions inchangées).
- **Pastilles** : `item.isNew` posé par `storeLootItem()` (jamais sur un consommable, qui va dans la barre
  de raccourci), effacé à l'ouverture du Sac ou du Grimoire ; mention « Nouveau » sur la carte.
- La barre de consommables `#consumable-quickbar` reste visible dans la page (utile en combat).

## Tests
- `tests/regression/inventory-ui.js` : fiche (PV, couleur, XP), barre masquée en combat, pastilles (butin,
  consommable, effacement par panneau), compteur du Sac, un seul panneau ouvert, fermeture en combat.

## À surveiller en playtest
- Lisibilité de la fiche sur très petit écran quand beaucoup d'états sont actifs.
- La barre fixée en bas ne doit rien masquer en fin de page (marge basse de la page).
