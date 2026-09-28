// ==========================================
// SYSTÈME DE RARETÉ ET NIVEAU D'OBJET (chantier "refonte des objets", voir NOTES_ITEMS.md)
// ==========================================
// Un objet généré porte deux axes de puissance, jamais l'un sans l'autre :
//  - son NIVEAU D'OBJET (`itemLevel`, l'étage où il a été obtenu — voir itemBalance.levelScaling) :
//    un objet trouvé profond est plus fort, un objet gardé trop longtemps décroche peu à peu ;
//  - sa RARETÉ (ci-dessous) : `statMult` multiplie les stats de base, `slots` donne le nombre de
//    qualificatifs (itemModifiers.effect) et `maxRank` leur rang maximal, `valueMult` sa valeur
//    marchande. Les écarts de stats bruts entre raretés sont volontairement resserrés : la
//    différence de puissance passe surtout par les qualificatifs, lisibles à l'inspection.
// Calibrage (npm run sim:items) : un Légendaire trouvé à l'étage 4 vaut à peu près un Rare de l'étage 7
// et un Commun de l'étage 10 — surpuissant quelques étages, puis à remplacer.
// `color` teinte la carte de l'objet dans l'inventaire. L'ordre du tableau est l'ordre des paliers
// (du plus faible au plus fort) : "monter d'un palier" = index + 1.
const itemRarities = [
    { key: "camelote",   name: "Camelote",   slots: 0, maxRank: 0, statMult: 0.7,  valueMult: 0.3, color: "#a8835a" },
    { key: "commun",     name: "Commun",     slots: 0, maxRank: 0, statMult: 1.0,  valueMult: 1,   color: "#9ca3af" },
    { key: "rare",       name: "Rare",       slots: 1, maxRank: 1, statMult: 1.25, valueMult: 2.5, color: "#60a5fa" },
    { key: "epique",     name: "Épique",     slots: 2, maxRank: 2, statMult: 1.5,  valueMult: 7,   color: "#c084fc" },
    { key: "legendaire", name: "Légendaire", slots: 3, maxRank: 3, statMult: 1.8,  valueMult: 20,  color: "#fbbf24" }
];

// Réglages d'équilibrage du loot — valeurs de départ calibrées avec `npm run sim:items`
// (tests/tools/item-curve.js), à ajuster par playtest réel comme le reste des chiffres du jeu.
const itemBalance = {
    // Stat = base × statMult(rareté) × (1 + perLevel × (itemLevel − 1)) × aléa ±statJitter.
    // `equipment` (armes, armes à distance, armures, dégâts des sorts) suit à peu près la croissance
    // de l'ATQ du joueur ; `heal` (soins des consommables) celle de ses PV max. Le mana (plafonné
    // à 100) et le coût en mana des sorts ne dépendent jamais du niveau d'objet.
    levelScaling: { equipment: 0.2, heal: 0.15 },
    statJitter: 0.1,
    // Valeur = baseValue × valueMult(rareté) × (1 + perLevel × (itemLevel − 1)) × (1 + perEnchant × qualificatifs)
    value: { perLevel: 0.15, perEnchant: 0.15 },
    // Poids de rareté du loot selon l'étage (première ligne dont maxFloor >= étage courant). La
    // Camelote n'est jamais qu'un petit bruit de fond : c'est surtout le palier du cadeau de départ.
    lootTables: [
        { maxFloor: 2,        weights: { camelote: 12, commun: 65, rare: 20, epique: 3,  legendaire: 0 } },
        { maxFloor: 5,        weights: { camelote: 8,  commun: 55, rare: 28, epique: 8,  legendaire: 1 } },
        { maxFloor: 9,        weights: { camelote: 5,  commun: 42, rare: 34, epique: 15, legendaire: 4 } },
        { maxFloor: 14,       weights: { camelote: 3,  commun: 33, rare: 34, epique: 22, legendaire: 8 } },
        { maxFloor: Infinity, weights: { camelote: 2,  commun: 24, rare: 34, epique: 28, legendaire: 12 } }
    ],
    // Montées de palier après le tirage (voir rollLootRarity() dans generator.js) : un mob élite a une
    // CHANCE de monter d'un palier, un boss (ou un trésor de CAFET_ASSOMBRIE) monte TOUJOURS d'un palier,
    // avec un plancher.
    eliteUpgradeChance: 25,
    boss: { tierBonus: 1, minRarityKey: "rare", secondItemChance: 25, signatureRepeatChance: 20 },
    treasure: { tierBonus: 1 },
    // Le boss d'un repaire (étage urbain) lâche un butin d'un niveau d'objet au-dessus de l'étage.
    lairBossLevelBonus: 1
};

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

// `jokeItem: true` marque un objet volontairement dérisoire (blague DCC) : il ne tombe JAMAIS qu'au
// palier Camelote (voir pickBaseItem() dans generator.js), jamais au milieu du loot normal où il
// serait strictement inférieur à tout le reste. Le cadeau de départ (Camelote) y pioche volontiers.
// Stats de BASE (niveau d'objet 1, rareté Commune) : voir itemBalance pour la mise à l'échelle.
// `minFloor` (défaut 1) : étage à partir duquel un objet de base peut tomber — les meilleurs objets de
// base n'apparaissent qu'en profondeur, ce qui s'ajoute au niveau d'objet pour donner une vraie
// sensation de progression. Les objets blagues (`jokeItem`) ne tombent jamais qu'au palier Camelote.
const baseItems = {
    weapons: [
        { name: "Pied-de-biche", baseDmg: 4, baseValue: 10 },
        { name: "Extincteur Cabossé", baseDmg: 1, baseValue: 2, canEnchant: false, jokeItem: true },
        { name: "Agrafeuse Tactique", baseDmg: 3, baseValue: 15 },
        { name: "Épée en Pain de Mie", baseDmg: 6, baseValue: 20, minFloor: 2 },
        { name: "Hache à Viande", baseDmg: 7, baseValue: 25, minFloor: 3 },
        { name: "Bâton de Dynamite", baseDmg: 9, baseValue: 30, minFloor: 5 },
        { name: "Couteau en Beurre", baseDmg: 2, baseValue: 5, canEnchant: false, jokeItem: true },
        { name: "Lance à Feu", baseDmg: 8, baseValue: 35, minFloor: 4 },
        { name: "Gantelet Électrique", baseDmg: 7, baseValue: 28, minFloor: 3 },
        { name: "Antivol de Voiture", baseDmg: 7, baseValue: 26, minFloor: 3 },
        { name: "Pied de Parasol", baseDmg: 5, baseValue: 16 }
    ],
    // Armes à distance : utilisées uniquement quand un écart sépare le joueur du mob (voir
    // attackRanged() dans app.js). Même système de rareté/qualificatifs que les armes de mêlée.
    ranged: [
        { name: "Lance-Pierre de Chantier", baseDmg: 5, baseValue: 18 },
        { name: "Arc de Fortune Rafistolé", baseDmg: 6, baseValue: 22, minFloor: 2 },
        { name: "Arbalète de Musée", baseDmg: 9, baseValue: 35, minFloor: 4 },
        { name: "Pistolet à Clous", baseDmg: 7, baseValue: 28, minFloor: 3 },
        { name: "Fusil de Chasse Rouillé", baseDmg: 11, baseValue: 45, minFloor: 6 },
        { name: "Sarbacane Improvisée", baseDmg: 3, baseValue: 8, jokeItem: true },
        { name: "Pistolet à Eau Surpuissant", baseDmg: 4, baseValue: 14 },
        { name: "Lance-Confettis Bricolé", baseDmg: 4, baseValue: 12 }
    ],
    armors: [
        { name: "Couvercle de Poubelle", baseArmor: 3, baseValue: 8 },
        { name: "Costume Trois-Pièces Déchiré", baseArmor: 1, baseValue: 20 },
        { name: "Gilet Haute Visibilité", baseArmor: 2, baseValue: 5, canEnchant: false, jokeItem: true },
        { name: "Armure de Carton", baseArmor: 5, baseValue: 12, minFloor: 2 },
        { name: "Plastron de Coquillage", baseArmor: 4, baseValue: 15 },
        { name: "Rideau de Douche Camouflage", baseArmor: 0, baseValue: 8, jokeItem: true },
        { name: "Combinaison de Plongée", baseArmor: 6, baseValue: 22, minFloor: 3 },
        { name: "Gilet Pare-Balles Périmé", baseArmor: 2, baseValue: 10 },
        { name: "Bouclier en Polystyrène", baseArmor: 4, baseValue: 18, minFloor: 2 },
        { name: "Manteau en Cuir de Skaï Renforcé", baseArmor: 7, baseValue: 40, minFloor: 5 },
        { name: "Bouée Canard Renforcée", baseArmor: 4, baseValue: 14 },
        { name: "Gilet de Sécurité Chantier", baseArmor: 5, baseValue: 20, minFloor: 3 }
    ],
    // Les consommables n'ont jamais de qualificatif : seuls `heal` (rareté + niveau d'objet) et
    // `mana` (rareté seule) sont mis à l'échelle. `mana` restaure du mana (voir useConsumable() dans app.js) : n'a d'effet que si un sort
    // est équipé (gameState.equipment.spell), comme la barre de mana elle-même.
    consumables: [
        { name: "Café Froid", heal: 15, baseValue: 5 },
        { name: "Barre Céréalière Douteuse", heal: 25, baseValue: 10 },
        { name: "Boisson Énergisante Radioactive", heal: 50, baseValue: 25 },
        { name: "Kit de Premiers Secours Périmé", heal: 30, baseValue: 12 },
        { name: "Sandwich Moisissure", heal: 20, baseValue: 8 },
        { name: "Pilule de Force", heal: 0, baseValue: 15 },
        { name: "Barre Protéinée Suspecte du Distributeur", heal: 40, baseValue: 20 },
        { name: "Flasque de Sirop Contre la Toux Premier Prix", heal: 35, baseValue: 18 },
        { name: "Bonbon Explosif", heal: 5, baseValue: 3 },
        { name: "Perfusion de Sponsor", heal: 60, baseValue: 30 },
        { name: "Barbe à Papa Périmée", heal: 22, baseValue: 9 },
        { name: "Boisson Isotonique Suspecte", heal: 35, baseValue: 16 },
        { name: "Flasque d'Essence Arcanique", heal: 0, mana: 45, baseValue: 22 },
        { name: "Chewing-gum Ectoplasmique", heal: 10, mana: 25, baseValue: 18 },
        { name: "Encre de Calamar Luminescent", heal: 0, mana: 35, baseValue: 20 }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { itemRarities, itemBalance, itemModifiers, baseItems };
}
