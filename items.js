/**
 * ITEMS.JS - Catalogue des objets pour le Rogue-Like Absurde
 * Contient : les modificateurs d'objets (tags) et les objets de base (armes, armures, consommables).
 */

// ==========================================
// 1. MODIFICATEURS D'OBJETS (Tags)
// ==========================================
const itemModifiers = {
    quality: [
        { name: "Rouillé", valueMult: 0.5, stats: { dmg: 0.8, armor: 0.8 } },
        { name: "Immaculé", valueMult: 2.0, stats: { dmg: 1.2, armor: 1.2 } },
        { name: "De Contrebande", valueMult: 1.5, stats: { dmg: 1.5, armor: 0.5 }, desc: "L'IA du donjon n'aime pas ça." },
        { name: "Bricolé", valueMult: 0.8, stats: { dmg: 1.1, armor: 1.1 }, desc: "Tient avec du scotch de survie." }
    ],

    effect: [
        { name: "Tranchant", mechanic: "bleed", desc: "Inflige des saignements à chaque coup." },
        { name: "Lourd", mechanic: "stun", desc: "Possibilité d'étourdir la cible." },
        { name: "Vibrant", mechanic: "pleasure_or_pain", desc: "Fait un bruit de bourdonnement très gênant." }
    ]
};

// ==========================================
// 2. OBJETS DE BASE
// ==========================================
const baseItems = {
    weapons: [
        { name: "Pied-de-biche", baseDmg: 8, baseValue: 10, allowedTags: ["quality", "effect"] },
        { name: "Batte en Mousse", baseDmg: 1, baseValue: 2, allowedTags: ["quality"] }, // Impossible d'être "Tranchant"
        { name: "Agrafeuse Tactique", baseDmg: 5, baseValue: 15, allowedTags: ["quality", "effect"] }
    ],

    armors: [
        { name: "Couvercle de Poubelle", baseArmor: 5, baseValue: 8, allowedTags: ["quality", "effect"] },
        { name: "Costume Trois-Pièces Déchiré", baseArmor: 2, baseValue: 20, allowedTags: ["quality"] },
        { name: "Gilet Jaune", baseArmor: 3, baseValue: 5, allowedTags: ["quality"] } // Attire l'aggro ?
    ],

    consumables: [
        { name: "Café Froid", heal: 15, baseValue: 5, allowedTags: ["quality"] },
        { name: "Barre Céréalière Douteuse", heal: 25, baseValue: 10, allowedTags: ["quality", "effect"] },
        { name: "Boisson Énergisante Radioactive", heal: 50, baseValue: 25, allowedTags: ["quality"] }
    ]
};

// Export (utile si tu passes sur un environnement modulaire avec Node ou des modules ES6)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { itemModifiers, baseItems };
}
