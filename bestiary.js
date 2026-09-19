/**
 * BESTIARY.JS - Catalogue des monstres pour le Rogue-Like Absurde
 * Contient : les modificateurs de monstres (tags) et le catalogue plat des monstres de base.
 * Un monstre est défini ICI une seule fois, quel que soit le nombre de quartiers où il apparaît
 * (voir districts.js, qui référence les monstres par leur nom).
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
        { name: "Minuscule", stats: { atk: 0.5, def: 0.5, hp: 0.5 }, desc: "Facile à écraser, mais difficile à viser." },
        { name: "Myope", stats: { atk: 1.2, def: 0.8, hp: 1.0 }, desc: "Frappe très fort, mais souvent à côté." },
        { name: "Musculeux", stats: { atk: 1.6, def: 1.1, hp: 1.2 }, desc: "A visiblement abusé des stéroïdes de donjon." }
    ]
};

// ==========================================
// 2. CATALOGUE PLAT DES MONSTRES DE BASE
// ==========================================
// Chaque monstre est défini une seule fois. Les quartiers (districts.js) le référencent par son "name".
const baseMobs = [
    // -- Tunnels de Métro Abandonnés --
    { name: "Rat Goulot", hp: 30, atk: 5, def: 2, xpReward: 10, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Distributeur de Snacks Hanté", hp: 70, atk: 11, def: 10, xpReward: 40, allowedTags: ["elemental", "physical"] }, // Machine : pas de tag mental
    { name: "Contrôleur de Billets Zombifié", hp: 45, atk: 8, def: 4, xpReward: 15, allowedTags: ["mental", "physical", "elemental"] },

    // -- Jardins Carnivores --
    { name: "Tulipe Géante", hp: 40, atk: 10, def: 3, xpReward: 12, allowedTags: ["elemental", "physical"] }, // Plante : pas de tag mental
    { name: "Ronce Étrangleuse", hp: 60, atk: 15, def: 5, xpReward: 18, allowedTags: ["elemental", "physical"] },
    { name: "Gobelin Paysagiste", hp: 35, atk: 7, def: 2, xpReward: 12, allowedTags: ["mental", "physical", "elemental"] },

    // -- Bureaux de l'Administration Pénitentiaire --
    { name: "Photocopieuse Carnivore", hp: 100, atk: 10, def: 6, xpReward: 55, allowedTags: ["elemental", "physical"] }, // Machine
    { name: "Stagiaire Démoniaque", hp: 25, atk: 4, def: 1, xpReward: 8, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Garde-Chiourme Bureaucrate", hp: 70, atk: 11, def: 8, xpReward: 25, allowedTags: ["mental", "physical"] }
];

/**
 * Retrouve un monstre de base par son nom exact dans le catalogue.
 * @param {string} name
 * @returns {object|undefined}
 */
function findMobByName(name) {
    return baseMobs.find(mob => mob.name === name);
}

// ==========================================
// 3. BOSS DE QUARTIER
// ==========================================
// Un boss unique et curaté à la main par quartier (pas de modificateurs aléatoires, contrairement
// aux mobs standards). Affronté uniquement quand l'escalier de ce quartier est gardé.
// Volontairement très coriaces : ces combats sont censés être hors de portée en début de partie
// (fuir est la bonne décision), et devenir gagnables après quelques niveaux.
const districtBosses = {
    "Tunnels de Métro Abandonnés": {
        name: "Le Chef de Gare Nécrosé",
        hp: 220, atk: 15, def: 10, xpReward: 90, effect: "stun",
        isBoss: true
    },
    "Jardins Carnivores": {
        name: "La Mère-Liane",
        hp: 210, atk: 14, def: 9, xpReward: 90, effect: "poison",
        isBoss: true
    },
    "Bureaux de l'Administration Pénitentiaire": {
        name: "Le Directeur Général (Édition Cauchemar)",
        hp: 230, atk: 16, def: 11, xpReward: 100, effect: "slow",
        isBoss: true
    }
};

/**
 * Retrouve le boss attitré d'un quartier donné.
 * @param {string} districtName
 * @returns {object|null}
 */
function findBossForDistrict(districtName) {
    return districtBosses[districtName] || null;
}

// Export (utile si tu passes sur un environnement modulaire avec Node ou des modules ES6)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mobModifiers, baseMobs, findMobByName, districtBosses, findBossForDistrict };
}
