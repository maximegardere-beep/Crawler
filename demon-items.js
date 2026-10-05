// demon-items.js — Objets démoniaques de l'armurerie de Gorgoth le Concierge (chantier 17, lot 4).
// Catalogue PUR (aucun accès à gameState ni au DOM) : la rareté Démoniaque et les 4 objets maudits. Construction par
// buildDemonicItem(key, itemLevel) (generator.js), effets et malédictions branchés aux points existants d'app.js (section
// « OBJETS DÉMONIAQUES »), armurerie openDemonArmory(onDone) (app.js, zone #demon-armory-zone).
// Chargé juste après items.js (les qualificatifs `demonic`/`curse` vivent dans itemQualifiers, items.js).

// Rareté « Démoniaque » : volontairement HORS de itemRarities (jamais tirée par le loot, jamais atteinte par une montée de
// palier, Légendaire reste le dernier palier du tableau — exigé par tests/regression/loot.js). getRarityByKey('demoniaque')
// la résout quand même (generator.js) pour les badges, l'inspection et la couleur de carte. `valueMult: 0` : un objet
// démoniaque ne vaut rien chez un marchand — de toute façon, il est invendable.
const DEMONIC_RARITY = { key: "demoniaque", name: "Démoniaque", slots: 0, maxRank: 3, statMult: 2.2, valueMult: 0, color: "#c026d3" };

// Réglages de l'armurerie (chiffres validés au plan du chantier 17).
const DEMONIC_ARMORY = {
    keepLevelBonus: 2,  // garder son objet à une nouvelle victoire : +2 niveaux d'objet
    maxHeld: 1          // un seul objet démoniaque possédé à la fois (équipé ou en réserve)
};

// Les 4 objets (noms EXACTS du contrat partagé : le lot 5 dessine les sprites par ces noms). Stats de BASE (niveau d'objet 1,
// avant ×2,2) calées sur les meilleurs objets de base d'items.js, sans trait fixe : à rareté Démoniaque, chacun dépasse de peu
// le meilleur Légendaire de sa catégorie — la vraie différence passe par l'effet unique, payé par la malédiction.
//  - Trousseau : 13 (Marteau de Guerre 15, Tronçonneuse 14) → 28,6 contre 27 pour un Marteau Légendaire (et sans Bancal).
//  - Bleu de travail : 11 (Armure de Plates 13) → 24,2 contre 23,4 pour des Plates Légendaires (et sans Grinçant).
//  - Lance-Clés : 12 (Fusil à Pompe 15) → 26,4, volontairement sous le Fusil à Pompe Légendaire (27) : les âmes (+100 % par
//    âme, 3 au plus) font le travail en rafale.
//  - Règlement : 13 ≈ 1,6 × Météore Miniature (8, meilleur sort de base) → 28,6 contre 14,4 pour un Météore Légendaire.
const DEMONIC_ITEMS = {
    blade: {
        name: "Trousseau Ardent de Gorgoth", category: 'weapons', baseDmg: 13, baseValue: 120,
        icon: "🔥", qualifiers: ['demon_lifesteal', 'curse_potions'],
        flavor: "Un fouet de clés chauffées à blanc. Il ouvre toutes les portes, surtout celles des artères."
    },
    overalls: {
        name: "Bleu de Travail Ignifugé", category: 'armors', baseArmor: 11, baseValue: 120,
        icon: "🧯", qualifiers: ['demon_last_breath', 'curse_no_regen'],
        flavor: "La tenue réglementaire du concierge. Elle ne brûle pas. Vous, si — mais pas tout de suite."
    },
    keyLauncher: {
        name: "Lance-Clés Infernal", category: 'ranged', baseDmg: 12, baseValue: 120,
        icon: "🗝️", qualifiers: ['demon_souls', 'curse_soul_hunger'],
        flavor: "Il tire des passe-partout ardents. Il a faim des âmes de vos victimes ; à défaut, il se sert sur vous."
    },
    rulebook: {
        category: 'scrolls', baseValue: 120, qualifiers: ['demon_decree', 'curse_blood_price'],
        // Sort à distance, icône 📜 : effet FX_SPELLS["📜"] livré par le lot 5 (sans lui, fx.js retombe sur un éclair générique).
        spell: { name: "Règlement Intérieur", category: "ranged", baseDmg: 13, manaCost: 0, baseValue: 120, icon: "📜" },
        flavor: "Article 1 : le Donjon a toujours raison. Article 2 : chaque sanction se paie en sang."
    }
};

// Clés dans l'ordre du râtelier (affichage de l'armurerie).
const DEMONIC_ITEM_KEYS = ['blade', 'overalls', 'keyLauncher', 'rulebook'];

// Nom affiché d'un objet démoniaque par sa clé (null si inconnue). Pure.
function demonicItemName(key) {
    const t = DEMONIC_ITEMS[key];
    if (!t) return null;
    return t.spell ? t.spell.name : t.name;
}

// Niveau d'objet d'un objet GARDÉ à une nouvelle victoire (+keepLevelBonus). Pure.
function demonicKeptLevel(currentLevel) {
    return Math.max(1, Math.round(currentLevel || 1)) + DEMONIC_ARMORY.keepLevelBonus;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEMONIC_RARITY, DEMONIC_ARMORY, DEMONIC_ITEMS, DEMONIC_ITEM_KEYS, demonicItemName, demonicKeptLevel };
}
