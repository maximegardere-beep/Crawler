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
        { name: "Apathique", stats: { atk: 0.5, def: 1.2, hp: 1.5 }, desc: "Vous regarde d'un air vide. S'en fout royalement." },
        { name: "Paranoïaque", stats: { atk: 1.3, def: 0.7, hp: 0.9 }, desc: "Crie 'ILS SONT PARTOUT !' avant chaque attaque." },
        { name: "Narcissique", stats: { atk: 1.1, def: 0.9, hp: 1.0 }, desc: "Passe son tour à admirer son reflet dans une flaque." },
        { name: "Bavard", stats: { atk: 0.7, def: 1.0, hp: 1.0 }, desc: "Raconte sa vie entre chaque coup. Très lassant." },
        { name: "Mégalomane", stats: { atk: 1.4, def: 0.6, hp: 0.8 }, desc: "Veut conquérir le donjon. Déjà." },
        { name: "Hypocondriaque", stats: { atk: 0.6, def: 1.3, hp: 1.4 }, desc: "Pense avoir attrapé toutes les maladies du donjon." },
        { name: "Philosophe", stats: { atk: 0.4, def: 1.1, hp: 1.3 }, desc: "Discute de l'absurdité de l'existence pendant le combat." },
        { name: "Perfectionniste", stats: { atk: 1.5, def: 0.7, hp: 0.9 }, desc: "Recommence son attaque si elle n'est pas parfaite." },
        { name: "Superstitieux", stats: { atk: 0.8, def: 1.0, hp: 1.1 }, desc: "Touche du bois avant chaque attaque." },
        { name: "Terrifiant", stats: { atk: 1.3, def: 0.7, hp: 0.9 }, effect: "fear", desc: "Son regard seul suffit à glacer le sang." }
    ],

    // Les tags élémentaires (applicables à presque tout pour plus de chaos)
    elemental: [
        { name: "Enflammé", stats: { atk: 1.3, def: 0.9, hp: 1.0 }, effect: "burn", desc: "Dégage une odeur de merguez trop cuite." },
        { name: "Radioactif", stats: { atk: 1.1, def: 1.1, hp: 1.1 }, effect: "poison", desc: "Brille dans le noir avec une teinte vert fluo." },
        { name: "Suintant", stats: { atk: 0.8, def: 1.3, hp: 1.2 }, effect: "slow", desc: "Laisse une flaque visqueuse très suspecte au sol." },
        { name: "Foudroyant", stats: { atk: 1.4, def: 0.8, hp: 0.9 }, effect: "stun", desc: "Fait des étincelles. Bzzz." },
        { name: "Glacé", stats: { atk: 0.9, def: 1.4, hp: 1.1 }, effect: "slow", desc: "Gèle les pieds de ses ennemis. Et les siens." },
        { name: "Acide", stats: { atk: 1.2, def: 0.7, hp: 1.0 }, effect: "poison", desc: "Dissout lentement tout ce qu'il touche. Même lui." },
        { name: "Électrisé", stats: { atk: 1.3, def: 0.6, hp: 0.8 }, effect: "stun", desc: "Fait grésiller les cheveux de tout le monde." },
        { name: "Nuageux", stats: { atk: 0.7, def: 1.2, hp: 1.3 }, effect: "confusion", desc: "On ne voit rien à travers lui. Pas même ses propres bras." },
        { name: "Sonique", stats: { atk: 1.1, def: 0.9, hp: 1.0 }, effect: "stun", desc: "Hurle à une fréquence insupportable." },
        { name: "Magnétique", stats: { atk: 1.0, def: 1.2, hp: 1.1 }, effect: "pull", desc: "Attire tous les objets métalliques vers lui. Même les armures." },
        { name: "Gravitationnel", stats: { atk: 1.4, def: 0.8, hp: 1.0 }, effect: "slow", desc: "Ralenti tout autour de lui. Même le temps." },
        { name: "Lumineux", stats: { atk: 0.8, def: 1.0, hp: 1.0 }, effect: "light", desc: "Éblouit ses ennemis avec une lumière aveuglante." },
        { name: "Corrosif", stats: { atk: 1.0, def: 1.2, hp: 1.1 }, effect: "corrode", desc: "Suinte un acide qui ronge armures et convictions." }
    ],

    // Les tags physiques (modifications corporelles)
    physical: [
        { name: "Obèse", stats: { atk: 1.0, def: 1.2, hp: 1.5 }, desc: "Prend toute la place dans le couloir." },
        { name: "Minuscule", stats: { atk: 0.5, def: 0.5, hp: 0.5 }, desc: "Facile à écraser, mais difficile à viser." },
        { name: "Myope", stats: { atk: 1.2, def: 0.8, hp: 1.0 }, desc: "Frappe très fort, mais souvent à côté." },
        { name: "Musculeux", stats: { atk: 1.6, def: 1.1, hp: 1.2 }, desc: "A visiblement abusé des stéroïdes de donjon." },
        { name: "Squelettique", stats: { atk: 1.1, def: 0.7, hp: 0.8 }, desc: "On voit ses os à travers sa peau. C'est dégoûtant." },
        { name: "Gélatineux", stats: { atk: 0.6, def: 1.4, hp: 1.1 }, desc: "Absorbe les coups comme un matelas." },
        { name: "Épineux", stats: { atk: 1.3, def: 1.0, hp: 1.0 }, desc: "Blesse ceux qui osent le toucher." },
        { name: "Ailé", stats: { atk: 1.0, def: 0.8, hp: 0.9 }, desc: "Volète au-dessus des pièges. Et des ennemis." },
        { name: "Multi-Bras", stats: { atk: 1.5, def: 0.7, hp: 1.0 }, desc: "Frappe 3 fois par tour. Mais rate souvent." },
        { name: "Invisible", stats: { atk: 1.2, def: 0.5, hp: 0.8 }, desc: "Disparaît et réapparaît au hasard. Très énervant." },
        { name: "Colossal", stats: { atk: 1.8, def: 1.3, hp: 2.0 }, desc: "Prend toute la pièce. Littéralement." },
        { name: "Liquide", stats: { atk: 0.8, def: 1.5, hp: 1.0 }, desc: "Passe sous les portes. Et dans les égouts." },
        { name: "Métallique", stats: { atk: 1.2, def: 1.5, hp: 1.3 }, desc: "Résiste à tout. Sauf à la rouille." }
    ]
};

const baseMobs = [
    { name: "Rat Goulot", hp: 30, atk: 5, def: 2, xpReward: 10, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Distributeur de Snacks Hanté", hp: 70, atk: 11, def: 10, xpReward: 40, allowedTags: ["elemental", "physical"] },
    { name: "Contrôleur de Billets Zombifié", hp: 45, atk: 8, def: 4, xpReward: 15, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Tulipe Géante", hp: 40, atk: 10, def: 3, xpReward: 12, allowedTags: ["elemental", "physical"] },
    { name: "Ronce Étrangleuse", hp: 60, atk: 15, def: 5, xpReward: 18, allowedTags: ["elemental", "physical"] },
    { name: "Gobelin Paysagiste", hp: 35, atk: 7, def: 2, xpReward: 12, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Photocopieuse Carnivore", hp: 100, atk: 10, def: 6, xpReward: 55, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Stagiaire Démoniaque", hp: 25, atk: 4, def: 1, xpReward: 8, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Garde-Chiourme Bureaucrate", hp: 70, atk: 11, def: 8, xpReward: 25, allowedTags: ["mental", "physical"], ranged: true },
    { name: "Saucisse Vivante", hp: 50, atk: 12, def: 3, xpReward: 15, allowedTags: ["elemental", "physical"] },
    { name: "Fromage qui Pue", hp: 80, atk: 5, def: 12, xpReward: 20, allowedTags: ["elemental", "physical"] },
    { name: "Ouvrier à la Chaîne", hp: 60, atk: 14, def: 4, xpReward: 25, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Livre Maudit", hp: 40, atk: 8, def: 5, xpReward: 18, allowedTags: ["elemental", "physical"] },
    { name: "Bibliothécaire Fantôme", hp: 55, atk: 9, def: 6, xpReward: 22, allowedTags: ["mental", "physical", "elemental"], ranged: true },
    { name: "Encre Vivante", hp: 30, atk: 10, def: 2, xpReward: 10, allowedTags: ["elemental", "physical"] },
    { name: "Savant Dingue", hp: 50, atk: 15, def: 3, xpReward: 30, allowedTags: ["mental", "physical", "elemental"], ranged: true },
    { name: "Créature en Bocaux", hp: 65, atk: 12, def: 4, xpReward: 25, allowedTags: ["elemental", "physical"] },
    { name: "Robot Défectueux", hp: 90, atk: 10, def: 8, xpReward: 40, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Mime Aggressif", hp: 45, atk: 10, def: 5, xpReward: 20, allowedTags: ["mental", "physical", "elemental"] },
    { name: "Ombre Suspicieuse", hp: 50, atk: 12, def: 3, xpReward: 25, allowedTags: ["elemental", "physical"] },
    { name: "Miroir Brisé", hp: 60, atk: 8, def: 7, xpReward: 30, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Chaussette Solitaire", hp: 20, atk: 2, def: 1, xpReward: 5, allowedTags: ["elemental", "physical"] },
    { name: "Lave-Linge Possédé", hp: 110, atk: 14, def: 8, xpReward: 50, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Monstre de Poussière", hp: 40, atk: 6, def: 3, xpReward: 10, allowedTags: ["elemental", "physical"] },
    { name: "Marchand Malhonnête", hp: 70, atk: 8, def: 6, xpReward: 35, allowedTags: ["mental", "physical", "elemental"], ranged: true },
    { name: "Sac de Pièces Vivant", hp: 50, atk: 10, def: 5, xpReward: 20, allowedTags: ["elemental", "physical"] },
    { name: "Garde du Marché", hp: 90, atk: 12, def: 7, xpReward: 45, allowedTags: ["mental", "physical", "elemental"], ranged: true },
    { name: "Imprimante à Rêves", hp: 80, atk: 10, def: 5, xpReward: 40, allowedTags: ["elemental", "physical"] },
    { name: "Ordinateur en Colère", hp: 100, atk: 15, def: 8, xpReward: 50, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Câble Électrique Vivant", hp: 30, atk: 12, def: 2, xpReward: 15, allowedTags: ["elemental", "physical"] },

    // --- Parking Souterrain Maudit ---
    { name: "Voiture Abandonnée Rouillée", hp: 95, atk: 9, def: 12, xpReward: 35, allowedTags: ["physical", "elemental"] },
    { name: "Horodateur Vengeur", hp: 55, atk: 11, def: 5, xpReward: 28, allowedTags: ["mental", "elemental"], ranged: true },
    { name: "Cône de Chantier Fou", hp: 35, atk: 8, def: 2, xpReward: 14, allowedTags: ["mental", "physical"] },

    // --- Piscine Municipale Désaffectée ---
    { name: "Maître-Nageur Zombifié", hp: 65, atk: 10, def: 6, xpReward: 26, allowedTags: ["mental", "physical"], ranged: true },
    { name: "Frite de Piscine Étrangleuse", hp: 40, atk: 13, def: 3, xpReward: 16, allowedTags: ["elemental", "physical"] },
    { name: "Nuage de Chlore Ambulant", hp: 50, atk: 9, def: 4, xpReward: 20, allowedTags: ["elemental"] },

    // --- Studio de Télé-Achat Abandonné ---
    { name: "Mannequin Vitrine Possédé", hp: 60, atk: 9, def: 7, xpReward: 24, allowedTags: ["mental", "physical"] },
    { name: "Caméra de Surveillance Autonome", hp: 45, atk: 12, def: 4, xpReward: 22, allowedTags: ["elemental", "physical"], ranged: true },
    { name: "Présentateur Télé-Achat Hystérique", hp: 50, atk: 14, def: 3, xpReward: 22, allowedTags: ["mental"] }
];

function findMobByName(name) {
    return baseMobs.find(mob => mob.name === name);
}

const districtBosses = {
    "Tunnels de Métro Abandonnés": { name: "Le Chef de Gare Nécrosé", hp: 220, atk: 15, def: 10, xpReward: 90, effect: "stun", isBoss: true },
    "Jardins Carnivores": { name: "La Mère-Liane", hp: 210, atk: 14, def: 9, xpReward: 90, effect: "poison", isBoss: true },
    "Bureaux de l'Administration Pénitentiaire": { name: "Le Directeur Général (Édition Cauchemar)", hp: 230, atk: 16, def: 11, xpReward: 100, effect: "slow", isBoss: true, ranged: true },
    "Usine de Transformation Alimentaire": { name: "Le Boucher Sans Visage", hp: 250, atk: 18, def: 12, xpReward: 110, effect: "bleed", isBoss: true },
    "Bibliothèque des Oubliés": { name: "Le Gardien des Mots Perdus", hp: 240, atk: 17, def: 10, xpReward: 120, effect: "confusion", isBoss: true },
    "Laboratoire de Fous": { name: "Le Professeur Démentiel", hp: 260, atk: 20, def: 8, xpReward: 130, effect: "poison", isBoss: true },
    "Rue des Illusions": { name: "Le Maître des Illusions", hp: 220, atk: 16, def: 9, xpReward: 100, effect: "confusion", isBoss: true },
    "Catacombes des Chaussettes Perdues": { name: "Le Roi des Chaussettes Solitaires", hp: 200, atk: 14, def: 13, xpReward: 90, effect: "slow", isBoss: true },
    "Marché Noir du Donjon": { name: "Le Baron des Ombres", hp: 270, atk: 19, def: 14, xpReward: 140, effect: "stun", isBoss: true },
    "Salle des Machines Infernales": { name: "L'IA Malveillante", hp: 300, atk: 22, def: 15, xpReward: 150, effect: "stun", isBoss: true, ranged: true },
    "Parking Souterrain Maudit": { name: "Le Gardien du Parking Éternel", hp: 235, atk: 16, def: 13, xpReward: 105, effect: "stun", isBoss: true },
    "Piscine Municipale Désaffectée": { name: "Le Grand Requin Gonflable", hp: 245, atk: 17, def: 9, xpReward: 110, effect: "bleed", isBoss: true },
    "Studio de Télé-Achat Abandonné": { name: "L'Animateur Vedette Immortel", hp: 255, atk: 18, def: 10, xpReward: 115, effect: "confusion", isBoss: true }
};

function findBossForDistrict(districtName) {
    return districtBosses[districtName] || null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mobModifiers, baseMobs, findMobByName, districtBosses, findBossForDistrict };
}
