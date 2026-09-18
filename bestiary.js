/**
 * BESTIARY.JS - Bases de données pour le Rogue-Like Absurde
 * Ce fichier contient les dictionnaires nécessaires pour la génération procédurale
 * de monstres et d'objets, en utilisant un système de tags pour éviter les non-sens.
 */

// ==========================================
// 1. MODIFICATEURS DE MONSTRES (Tags)
// ==========================================
// Appliquent des multiplicateurs de stats et des effets thématiques.
const mobModifiers = {
    // Les tags mentaux (exclusifs aux créatures capables de penser, même mal)
    mental: [
        { name: "Dépressif", stats: { atk: 0.8, def: 1.0, hp: 0.8 }, desc: "Souffle bruyamment et traîne des pieds." },
        { name: "Enragé", stats: { atk: 1.5, def: 0.5, hp: 1.0 }, desc: "A la bave aux lèvres et hurle des insultes." },
        { name: "Syndiqué", stats: { atk: 0.9, def: 1.5, hp: 1.2 }, desc: "Fait des pauses obligatoires toutes les 3 attaques." },
        { name: "Zélé", stats: { atk: 1.2, def: 0.8, hp: 1.0 }, desc: "Veut vraiment la prime de fin de mois." },
        { name: "Apathique", stats: { atk: 0.5, def: 1.2, hp: 1.5 }, desc: "Vous regarde d'un air vide. S'en fout royalement." }
    ],
    
    // Les tags élémentaires (applicables à presque tout pour plus de chaos)
    elemental: [
        { name: "Enflammé", stats: { atk: 1.3, def: 0.9, hp: 1.0 }, effect: "burn", desc: "Dégage une odeur de merguez trop cuite." },
        { name: "Radioactif", stats: { atk: 1.1, def: 1.1, hp: 1.1 }, effect: "poison", desc: "Brille dans le noir avec une teinte vert fluo." },
        { name: "Suintant", stats: { atk: 0.8, def: 1.3, hp: 1.2 }, effect: "slow", desc: "Laisse une flaque visqueuse très suspecte au sol." },
        { name: "Foudroyant", stats: { atk: 1.4, def: 0.8, hp: 0.9 }, effect: "stun", desc: "Fait des étincelles. Bzzz." }
    ],
    
    // Les tags physiques (modifications corporelles)
    physical: [
        { name: "Obèse", stats: { atk: 1.0, def: 1.2, hp: 1.5 }, desc: "Prend toute la place dans le couloir." },
        { name: "Minuscule", stats: { atk: 0.5, def: 0.5, hp: 0.5 }, desc: "Facile à écraser, mais difficile à viser." }, // Implique une haute esquive théorique
        { name: "Myope", stats: { atk: 1.2, def: 0.8, hp: 1.0 }, desc: "Frappe très fort, mais souvent à côté." },
        { name: "Musculeux", stats: { atk: 1.6, def: 1.1, hp: 1.2 }, desc: "A visiblement abusé des stéroïdes de donjon." }
    ]
};

// ==========================================
// 2. MODIFICATEURS D'OBJETS (Tags)
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
// 3. QUARTIERS ET BESTIAIRE DE BASE
// ==========================================
const districts = {
    "Tunnels de Métro Abandonnés": {
        baseMobs: [
            // Un rat est organique, il peut être physique, mental ou élémentaire
            { name: "Rat Goulot", hp: 30, atk: 5, def: 2, allowedTags: ["mental", "physical", "elemental"] },
            // Un robot n'a pas de mental (pas de "Dépressif" ou "Syndiqué")
            { name: "Distributeur de Snacks Hanté", hp: 80, atk: 12, def: 15, allowedTags: ["elemental", "physical"] },
            { name: "Contrôleur de Billets Zombifié", hp: 45, atk: 8, def: 4, allowedTags: ["mental", "physical", "elemental"] }
        ]
    },
    
    "Jardins Carnivores": {
        baseMobs: [
            // Une plante n'a pas de tag mental dans notre logique, mais peut être mutante
            { name: "Tulipe Géante", hp: 40, atk: 10, def: 3, allowedTags: ["elemental", "physical"] },
            { name: "Ronce Étrangleuse", hp: 60, atk: 15, def: 5, allowedTags: ["elemental", "physical"] },
            // Les gobelins jardiniers peuvent avoir des problèmes mentaux
            { name: "Gobelin Paysagiste", hp: 35, atk: 7, def: 2, allowedTags: ["mental", "physical", "elemental"] }
        ]
    },

    "Bureaux de l'Administration Pénitentiaire": {
        baseMobs: [
            { name: "Photocopieuse Carnivore", hp: 100, atk: 18, def: 20, allowedTags: ["elemental", "physical"] }, // C'est une machine
            { name: "Stagiaire Démoniaque", hp: 25, atk: 4, def: 1, allowedTags: ["mental", "physical", "elemental"] },
            { name: "Garde-Chiourme Bureaucrate", hp: 70, atk: 11, def: 8, allowedTags: ["mental", "physical"] }
        ]
    }
};

// ==========================================
// 4. OBJETS DE BASE
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
        { name: "Barre Céréalière Douteuse", heal: 25, baseValue: 10, allowedTags: ["quality", "effect"] }, // Une barre céréalière "Lourde" ? Pourquoi pas.
        { name: "Boisson Énergisante Radioactive", heal: 50, baseValue: 25, allowedTags: ["quality"] }
    ]
};

// Export (utile si tu passes sur un environnement modulaire avec Node ou des modules ES6)
// Si utilisé directement en script tag dans index.html, tu peux supprimer cette ligne.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mobModifiers, itemModifiers, districts, baseItems };
}
