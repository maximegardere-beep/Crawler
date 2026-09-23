// ==========================================
// SYSTÈME DE RARETÉ (remplace l'ancien système "quality", qui n'affectait plus vraiment les stats)
// ==========================================
// Chaque palier détermine :
//  - le nombre de slots d'enchantement (voir itemModifiers.effect ci-dessous)
//  - le multiplicateur appliqué aux stats de base de l'objet (baseDmg/baseArmor/heal)
// Un objet plus rare a donc mécaniquement plus de stats ET plus de pouvoirs — jamais l'un sans
// l'autre. `color` est utilisé par l'UI pour teinter la carte de l'objet dans l'inventaire.
const itemRarities = [
    { key: "commun",     name: "Commun",     slots: 0, statMult: 1.0, color: "#9ca3af" },
    { key: "rare",       name: "Rare",       slots: 1, statMult: 1.3, color: "#60a5fa" },
    { key: "epique",     name: "Épique",     slots: 2, statMult: 1.7, color: "#c084fc" },
    { key: "legendaire", name: "Légendaire", slots: 3, statMult: 2.3, color: "#fbbf24" }
];

const itemModifiers = {
    // Enchantements : chaque slot de rareté (voir itemRarities.slots) en pioche un dans le pool
    // accessible à ce slot. `tier` limite l'accès : le 1er slot d'un objet ne peut piocher que du
    // tier 1 (Rare et plus), le 2e slot peut aussi piocher du tier 2 (Épique et plus), le 3e slot
    // (réservé au Légendaire) peut piocher n'importe quel tier, y compris le tier 3. Plus un objet
    // est rare, plus il a de slots ET plus ses slots avancés donnent accès aux effets les plus
    // puissants — l'adjectif devient donc un vrai indicateur de pouvoir, pas que du flavor.
    effect: [
        { name: "Tranchant", mechanic: "bleed", tier: 1, desc: "Inflige des saignements à chaque coup." },
        { name: "Lourd", mechanic: "stun", tier: 1, desc: "Possibilité d'étourdir la cible." },
        { name: "Vibrant", mechanic: "pleasure_or_pain", tier: 1, desc: "Fait un bruit de bourdonnement très gênant." },
        { name: "Empoisonné", mechanic: "poison", tier: 1, desc: "Enduit de venin mortel." },
        { name: "Gelé", mechanic: "slow", tier: 1, desc: "Gèle la cible sur place." },
        { name: "Chaotique", mechanic: "random", tier: 1, desc: "Effet aléatoire à chaque utilisation." },
        { name: "Électrique", mechanic: "stun", tier: 2, desc: "Fait des étincelles à chaque coup." },
        { name: "Explosif", mechanic: "aoe", tier: 2, desc: "Explose au contact. Pour tout le monde." },
        { name: "Silencieux", mechanic: "stealth", tier: 2, desc: "Ne fait aucun bruit. Parfait pour les assassins." },
        { name: "Lumineux", mechanic: "light", tier: 2, desc: "Éclaire les ténèbres. Et aveugle les ennemis." },
        { name: "Ténébreux", mechanic: "darkness", tier: 2, desc: "Plonge tout dans l'obscurité." },
        { name: "Régénérant", mechanic: "heal", tier: 3, desc: "Soigne son porteur à chaque tour." },
        { name: "Vampirique", mechanic: "lifesteal", tier: 3, desc: "Vole la vie de ses ennemis." },
        { name: "Drainant", mechanic: "drain", tier: 3, desc: "Draine l'énergie de ses ennemis." },
        { name: "Corrosif", mechanic: "corrode", tier: 2, desc: "Ronge lentement l'armure de la cible." },
        { name: "Terrifiant", mechanic: "fear", tier: 2, desc: "Glace le sang de quiconque le regarde." },
        { name: "Galvanisant", mechanic: "adrenaline", tier: 2, desc: "Décharge une bouffée d'adrénaline à chaque coup porté." }
    ]
};

// `jokeItem: true` marque un objet volontairement dérisoire (blague DCC), exclu du tirage normal du
// loot par generateItem() (voir generator.js) : sans ce flag, ces objets étaient tirés au même titre
// que le reste et pouvaient constituer une part significative du loot early-game, souvent strictement
// inférieurs à l'équipement de départ. Ils restent accessibles via le cadeau de bienvenue
// (generateWelcomeGiftItem()) et le kit de test — le flag est volontairement simple pour rester
// réutilisable par un futur rework des qualificatifs absurdes.
const baseItems = {
    weapons: [
        { name: "Pied-de-biche", baseDmg: 8, baseValue: 10 },
        { name: "Extincteur Cabossé", baseDmg: 1, baseValue: 2, canEnchant: false, jokeItem: true },
        { name: "Agrafeuse Tactique", baseDmg: 5, baseValue: 15 },
        { name: "Épée en Pain de Mie", baseDmg: 12, baseValue: 20 },
        { name: "Hache à Viande", baseDmg: 15, baseValue: 25 },
        { name: "Bâton de Dynamite", baseDmg: 20, baseValue: 30 },
        { name: "Couteau en Beurre", baseDmg: 3, baseValue: 5, canEnchant: false, jokeItem: true },
        { name: "Lance à Feu", baseDmg: 18, baseValue: 35 },
        { name: "Gantelet Électrique", baseDmg: 14, baseValue: 28 },
        { name: "Antivol de Voiture", baseDmg: 16, baseValue: 26 },
        { name: "Pied de Parasol", baseDmg: 11, baseValue: 16 }
    ],
    // Armes à distance : utilisées uniquement en posture "à distance" (voir gameState.stance dans
    // app.js). Même système de rareté/enchantement que les armes de mêlée.
    ranged: [
        { name: "Lance-Pierre de Chantier", baseDmg: 10, baseValue: 18 },
        { name: "Arc de Fortune Rafistolé", baseDmg: 14, baseValue: 22 },
        { name: "Arbalète de Musée", baseDmg: 20, baseValue: 35 },
        { name: "Pistolet à Clous", baseDmg: 16, baseValue: 28 },
        { name: "Fusil de Chasse Rouillé", baseDmg: 25, baseValue: 45 },
        { name: "Sarbacane Improvisée", baseDmg: 6, baseValue: 8, jokeItem: true },
        { name: "Pistolet à Eau Surpuissant", baseDmg: 9, baseValue: 14 },
        { name: "Lance-Confettis Bricolé", baseDmg: 7, baseValue: 12 }
    ],
    armors: [
        { name: "Couvercle de Poubelle", baseArmor: 5, baseValue: 8 },
        { name: "Costume Trois-Pièces Déchiré", baseArmor: 2, baseValue: 20, canEnchant: false },
        { name: "Gilet Haute Visibilité", baseArmor: 3, baseValue: 5, canEnchant: false, jokeItem: true },
        { name: "Armure de Carton", baseArmor: 8, baseValue: 12 },
        { name: "Plastron de Coquillage", baseArmor: 6, baseValue: 15 },
        { name: "Rideau de Douche Camouflage", baseArmor: 0, baseValue: 8, jokeItem: true },
        { name: "Combinaison de Plongée", baseArmor: 10, baseValue: 22 },
        { name: "Gilet Pare-Balles Périmé", baseArmor: 4, baseValue: 10, canEnchant: false },
        { name: "Bouclier en Polystyrène", baseArmor: 7, baseValue: 18 },
        { name: "Manteau en Cuir de Skaï Renforcé", baseArmor: 12, baseValue: 40 },
        { name: "Bouée Canard Renforcée", baseArmor: 6, baseValue: 14 },
        { name: "Gilet de Sécurité Chantier", baseArmor: 9, baseValue: 20 }
    ],
    // Note : les enchantements sur les consommables restent purement cosmétiques pour l'instant
    // (aucune mécanique n'est câblée sur useConsumable()) — seuls `heal` et `mana` sont mis à
    // l'échelle par la rareté. canEnchant:false ici sert juste à garder certains objets volontairement
    // "nuls". `mana` restaure du mana (voir useConsumable() dans app.js) : n'a d'effet que si un sort
    // est équipé (gameState.equipment.spell), comme la barre de mana elle-même.
    consumables: [
        { name: "Café Froid", heal: 15, baseValue: 5, canEnchant: false },
        { name: "Barre Céréalière Douteuse", heal: 25, baseValue: 10 },
        { name: "Boisson Énergisante Radioactive", heal: 50, baseValue: 25, canEnchant: false },
        { name: "Kit de Premiers Secours Périmé", heal: 30, baseValue: 12 },
        { name: "Sandwich Moisissure", heal: 20, baseValue: 8, canEnchant: false },
        { name: "Pilule de Force", heal: 0, baseValue: 15 },
        { name: "Barre Protéinée Suspecte du Distributeur", heal: 40, baseValue: 20 },
        { name: "Flasque de Sirop Contre la Toux Premier Prix", heal: 35, baseValue: 18, canEnchant: false },
        { name: "Bonbon Explosif", heal: 5, baseValue: 3 },
        { name: "Perfusion de Sponsor", heal: 60, baseValue: 30 },
        { name: "Barbe à Papa Périmée", heal: 22, baseValue: 9 },
        { name: "Boisson Isotonique Suspecte", heal: 35, baseValue: 16 },
        { name: "Flasque d'Essence Arcanique", heal: 0, mana: 45, baseValue: 22, canEnchant: false },
        { name: "Chewing-gum Ectoplasmique", heal: 10, mana: 25, baseValue: 18 },
        { name: "Encre de Calamar Luminescent", heal: 0, mana: 35, baseValue: 20 }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { itemRarities, itemModifiers, baseItems };
}
