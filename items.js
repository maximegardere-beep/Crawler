const itemModifiers = {
    quality: [
        { name: "Rouillé", valueMult: 0.5, stats: { dmg: 0.8, armor: 0.8 } },
        { name: "Immaculé", valueMult: 2.0, stats: { dmg: 1.2, armor: 1.2 } },
        { name: "De Contrebande", valueMult: 1.5, stats: { dmg: 1.5, armor: 0.5 }, desc: "L'IA du donjon n'aime pas ça." },
        { name: "Bricolé", valueMult: 0.8, stats: { dmg: 1.1, armor: 1.1 }, desc: "Tient avec du scotch de survie." },
        { name: "Légendaire", valueMult: 3.0, stats: { dmg: 1.8, armor: 1.8 }, desc: "Brille d'une lumière divine. Ou diabolique." },
        { name: "Maudit", valueMult: 0.3, stats: { dmg: 1.5, armor: 0.2 }, desc: "Donne des pouvoirs... mais à quel prix ?" },
        { name: "Enchanté", valueMult: 2.5, stats: { dmg: 1.3, armor: 1.5 }, desc: "Scintille de magie ancienne." },
        { name: "Usé", valueMult: 0.4, stats: { dmg: 0.9, armor: 0.9 }, desc: "A vu des choses... des choses horribles." },
        { name: "Neuf", valueMult: 1.2, stats: { dmg: 1.0, armor: 1.0 }, desc: "Encore dans son emballage. Probablement volé." },
        { name: "Artisanal", valueMult: 1.8, stats: { dmg: 1.2, armor: 1.2 }, desc: "Fait main par un nain bourru." },
        { name: "Défectueux", valueMult: 0.2, stats: { dmg: 0.5, armor: 0.5 }, desc: "Peut exploser à tout moment." },
        { name: "Volé", valueMult: 1.0, stats: { dmg: 1.1, armor: 0.9 }, desc: "Le vrai propriétaire le cherche." },
        { name: "Béni", valueMult: 1.5, stats: { dmg: 1.0, armor: 1.3 }, desc: "Bénit par un prêtre. Ou un charlatan." },
        { name: "Souillé", valueMult: 0.6, stats: { dmg: 0.8, armor: 0.7 }, desc: "Couvert de taches suspectes." }
    ],
    effect: [
        { name: "Tranchant", mechanic: "bleed", desc: "Inflige des saignements à chaque coup." },
        { name: "Lourd", mechanic: "stun", desc: "Possibilité d'étourdir la cible." },
        { name: "Vibrant", mechanic: "pleasure_or_pain", desc: "Fait un bruit de bourdonnement très gênant." },
        { name: "Empoisonné", mechanic: "poison", desc: "Enduit de venin mortel." },
        { name: "Gelé", mechanic: "slow", desc: "Gèle la cible sur place." },
        { name: "Électrique", mechanic: "stun", desc: "Fait des étincelles à chaque coup." },
        { name: "Explosif", mechanic: "aoe", desc: "Explose au contact. Pour tout le monde." },
        { name: "Silencieux", mechanic: "stealth", desc: "Ne fait aucun bruit. Parfait pour les assassins." },
        { name: "Lumineux", mechanic: "light", desc: "Éclaire les ténèbres. Et aveugle les ennemis." },
        { name: "Ténébreux", mechanic: "darkness", desc: "Plonge tout dans l'obscurité." },
        { name: "Régénérant", mechanic: "heal", desc: "Soigne son porteur à chaque tour." },
        { name: "Vampirique", mechanic: "lifesteal", desc: "Voler la vie de ses ennemis." },
        { name: "Chaotique", mechanic: "random", desc: "Effet aléatoire à chaque utilisation." },
        { name: "Drainant", mechanic: "drain", desc: "Draine l'énergie de ses ennemis." }
    ]
};

const baseItems = {
    weapons: [
        { name: "Pied-de-biche", baseDmg: 8, baseValue: 10, allowedTags: ["quality", "effect"] },
        { name: "Batte en Mousse", baseDmg: 1, baseValue: 2, allowedTags: ["quality"] },
        { name: "Agrafeuse Tactique", baseDmg: 5, baseValue: 15, allowedTags: ["quality", "effect"] },
        { name: "Épée en Pain de Mie", baseDmg: 12, baseValue: 20, allowedTags: ["quality", "effect"] },
        { name: "Hache à Viande", baseDmg: 15, baseValue: 25, allowedTags: ["quality", "effect"] },
        { name: "Bâton de Dynamite", baseDmg: 20, baseValue: 30, allowedTags: ["quality", "effect"] },
        { name: "Couteau en Beurre", baseDmg: 3, baseValue: 5, allowedTags: ["quality"] },
        { name: "Lance à Feu", baseDmg: 18, baseValue: 35, allowedTags: ["quality", "effect"] },
        { name: "Gantelet Électrique", baseDmg: 14, baseValue: 28, allowedTags: ["quality", "effect"] },
        { name: "Arc en Caoutchouc", baseDmg: 10, baseValue: 18, allowedTags: ["quality", "effect"] }
    ],
    armors: [
        { name: "Couvercle de Poubelle", baseArmor: 5, baseValue: 8, allowedTags: ["quality", "effect"] },
        { name: "Costume Trois-Pièces Déchiré", baseArmor: 2, baseValue: 20, allowedTags: ["quality"] },
        { name: "Gilet Jaune", baseArmor: 3, baseValue: 5, allowedTags: ["quality"] },
        { name: "Armure de Carton", baseArmor: 8, baseValue: 12, allowedTags: ["quality", "effect"] },
        { name: "Plastron de Coquillage", baseArmor: 6, baseValue: 15, allowedTags: ["quality", "effect"] },
        { name: "Cape d'Invisibilité", baseArmor: 0, baseValue: 50, allowedTags: ["quality", "effect"] },
        { name: "Combinaison de Plongée", baseArmor: 10, baseValue: 22, allowedTags: ["quality", "effect"] },
        { name: "Armure de Chevalier en Mousse", baseArmor: 4, baseValue: 10, allowedTags: ["quality"] },
        { name: "Bouclier en Polystyrène", baseArmor: 7, baseValue: 18, allowedTags: ["quality", "effect"] },
        { name: "Veste en Peau de Dragon", baseArmor: 12, baseValue: 40, allowedTags: ["quality", "effect"] }
    ],
    consumables: [
        { name: "Café Froid", heal: 15, baseValue: 5, allowedTags: ["quality"] },
        { name: "Barre Céréalière Douteuse", heal: 25, baseValue: 10, allowedTags: ["quality", "effect"] },
        { name: "Boisson Énergisante Radioactive", heal: 50, baseValue: 25, allowedTags: ["quality"] },
        { name: "Potion de Soin Maisonne", heal: 30, baseValue: 12, allowedTags: ["quality", "effect"] },
        { name: "Sandwich Moisissure", heal: 20, baseValue: 8, allowedTags: ["quality"] },
        { name: "Pilule de Force", heal: 0, baseValue: 15, allowedTags: ["quality", "effect"] },
        { name: "Champignon Magique", heal: 40, baseValue: 20, allowedTags: ["quality", "effect"] },
        { name: "Bouteille d'Eau Bénite", heal: 35, baseValue: 18, allowedTags: ["quality"] },
        { name: "Bonbon Explosif", heal: 5, baseValue: 3, allowedTags: ["effect"] },
        { name: "Potion de Régénération", heal: 60, baseValue: 30, allowedTags: ["quality", "effect"] }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { itemModifiers, baseItems };
}
