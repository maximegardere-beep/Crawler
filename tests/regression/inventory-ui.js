// inventory-ui.js — tests régression : chantier 9 « interface inventaire allégée » (voir CHANTIERS.md) —
// fiche du crawler sous le nom (barre de PV), barre d'icônes du bas (masquée en combat), panneaux
// Équipement / Sac / Grimoire et pastilles « nouveau ».
const { assert, resetTransientState } = require('./_helpers.js');

{
    resetTransientState();
    gameState.hp = 40; gameState.maxHp = 80;
    updateUI();
    assert(ui.hpText.innerText === '40/80' && ui.hpBar.style.width === '50%', "Fiche : barre de PV sous le nom (valeur et largeur)");
    assert(ui.hpBar.style.background === hpColor(0.5), "Fiche : couleur de la barre selon la part de PV");
    assert(ui.xpTextMini.innerText === `${gameState.xp}/${gameState.xpToNextLevel}`, "Fiche : XP visible sans déplier le profil");

    gameState.inCombat = true;
    updateUI();
    assert(ui.bottomNav.classList.contains('hidden'), "Barre d'icônes masquée en combat");
    assert(openInventorySheet('bag') === false, "Aucun panneau ne s'ouvre en combat");
    gameState.inCombat = false;
    updateUI();
    assert(!ui.bottomNav.classList.contains('hidden'), "Barre d'icônes visible hors combat");
}

{
    resetTransientState();
    gameState.inventory = [];
    gameState.spellbook = [];
    updateUI();
    assert(ui.navBagDot.classList.contains('hidden') && ui.navSpellbookDot.classList.contains('hidden'), "Pas de pastille sans nouveauté");
    storeLootItem(generateItem({ category: 'weapons', floor: 1 }));
    storeLootItem(generateSpellScroll({ floor: 1 }));
    const potion = generateItem({ category: 'consumables', floor: 1 });
    storeLootItem(potion);
    updateUI();
    assert(!potion.isNew, "Un consommable n'est jamais « nouveau » (il va dans la barre de raccourci)");
    assert(!ui.navBagDot.classList.contains('hidden') && !ui.navSpellbookDot.classList.contains('hidden'), "Butin : pastilles sur 🎒 et 📖");
    assert(ui.navBagCount.innerText === `1/${gameState.maxInventory}`, "Compteur de la réserve sur l'icône du Sac");
    assert(Array.from(ui.inventoryEquipmentCards.children).some(c => c.innerHTML.includes('Nouveau')), "Carte du Sac : mention « Nouveau »");

    assert(openInventorySheet('bag') === true && !ui.bagSheet.classList.contains('hidden'), "🎒 ouvre le panneau du Sac");
    assert(ui.navBagDot.classList.contains('hidden') && !hasNewBagItems(), "Ouvrir le Sac efface la pastille");
    assert(!ui.navSpellbookDot.classList.contains('hidden'), "… mais pas celle du Grimoire");
    openInventorySheet('spellbook');
    assert(ui.bagSheet.classList.contains('hidden') && !ui.spellbookSheet.classList.contains('hidden'), "Un seul panneau ouvert à la fois");
    assert(ui.navSpellbookDot.classList.contains('hidden'), "Ouvrir le Grimoire efface sa pastille");
    openInventorySheet('equipment');
    assert(!ui.equipmentSheet.classList.contains('hidden') && openInventorySheetName === 'equipment', "🛡️ ouvre l'équipement porté");
    closeInventorySheets();
    assert(ui.equipmentSheet.classList.contains('hidden') && openInventorySheetName === null, "Fermeture des panneaux");

    openInventorySheet('bag');
    gameState.inCombat = true;
    updateUI();
    assert(ui.bagSheet.classList.contains('hidden'), "Entrer en combat referme le panneau ouvert");
    gameState.inCombat = false;
    gameState.inventory = [];
    gameState.spellbook = [];
}
