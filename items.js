// ==========================================
// SYSTÈME DE RARETÉ ET NIVEAU D'OBJET (chantier "refonte des objets", voir NOTES_ITEMS.md)
// ==========================================
// Un objet généré porte deux axes de puissance, jamais l'un sans l'autre :
//  - son NIVEAU D'OBJET (`itemLevel`, l'étage où il a été obtenu — voir itemBalance.levelScaling) :
//    un objet trouvé profond est plus fort, un objet gardé trop longtemps décroche peu à peu ;
//  - sa RARETÉ (ci-dessous) : `statMult` multiplie les stats de base, `slots` donne le nombre de
//    qualificatifs (itemQualifiers) et `maxRank` leur rang maximal, `valueMult` sa valeur
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
    // Coût en mana d'un sort : suit la rareté à moitié seulement (Légendaire ×1,4 au lieu de ×1,8 pour
    // les dégâts) — un sort rare est donc aussi plus rentable par point de mana.
    spellManaRarityWeight: 0.5,
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
    // Chance (%) qu'un objet de Camelote porte un défaut (itemQualifiers, kind 'malus').
    junkMalusChance: 60,
    boss: { tierBonus: 1, minRarityKey: "rare", secondItemChance: 25, signatureRepeatChance: 20 },
    treasure: { tierBonus: 1 },
    // Le boss d'un repaire (étage urbain) lâche un butin d'un niveau d'objet au-dessus de l'étage.
    lairBossLevelBonus: 1
};

// ==========================================
// QUALIFICATIFS (chantier "refonte des objets", voir NOTES_ITEMS.md)
// ==========================================
// Clé = mécanique (aussi stockée dans item.mechanics, lue par le rendu : couleur ENCHANT_COLORS,
// étincelles, traînée d'arme). Un objet porte `item.qualifiers = [{ key, rank }]` : le RANG (I à III)
// vient de la rareté (itemRarities.maxRank : Rare I, Épique II, Légendaire III) et choisit la valeur
// de chaque tableau à 3 entrées ci-dessous. Chaque qualificatif définit son comportement PAR CIBLE —
// `weapon` (armes de mêlée et à distance), `armor`, `spell` (parchemins) : une cible absente = jamais
// tiré sur ce type d'objet. `text(v)` reçoit les valeurs du rang et produit la phrase d'inspection :
// c'est la SEULE description d'un effet, écrite à côté des chiffres qu'elle décrit pour ne jamais
// diverger du moteur (app.js lit exactement les mêmes champs).
//  - kind 'proc'    : se déclenche avec une chance `chance` (%) à chaque coup porté (arme, sort) ou
//                     encaissé (armure) ;
//  - kind 'passive' : effet permanent tant que l'objet est équipé (ou à chaque coup, sans jet) ;
//  - kind 'malus'   : défaut d'un objet de Camelote, jamais tiré ailleurs (un seul rang).
// `tier` : un objet pioche son Ne qualificatif parmi ceux de tier <= N — les plus puissants (tier 3)
// n'apparaissent qu'en 3e qualificatif, donc sur un Légendaire.
const itemQualifiers = {
    // --- Effets déclenchés ---------------------------------------------------------------------
    bleed: { name: "Tranchant", icon: "🩸", tier: 1, kind: 'proc',
        weapon: { chance: [20, 27, 35], pct: [20, 25, 30], rounds: 3, text: v => `${v.chance} % par coup : la cible saigne ${v.rounds} tours (${v.pct} % des dégâts du coup par tour).` },
        armor: { chance: [20, 27, 35], pct: [20, 25, 30], rounds: 3, text: v => `${v.chance} % quand vous êtes touché : l'attaquant saigne ${v.rounds} tours (${v.pct} % des dégâts encaissés par tour).` },
        spell: { chance: [20, 27, 35], pct: [20, 25, 30], rounds: 3, text: v => `${v.chance} % par sort : la cible brûle ${v.rounds} tours (${v.pct} % des dégâts du sort par tour).` } },
    poison: { name: "Empoisonné", icon: "☢️", tier: 1, kind: 'proc',
        weapon: { chance: [25, 32, 40], pct: [10, 13, 16], rounds: 5, text: v => `${v.chance} % par coup : la cible est empoisonnée ${v.rounds} tours (${v.pct} % des dégâts du coup par tour).` },
        armor: { chance: [25, 32, 40], pct: [10, 13, 16], rounds: 5, text: v => `${v.chance} % quand vous êtes touché : l'attaquant est empoisonné ${v.rounds} tours (${v.pct} % des dégâts encaissés par tour).` },
        spell: { chance: [25, 32, 40], pct: [10, 13, 16], rounds: 5, text: v => `${v.chance} % par sort : la cible est empoisonnée ${v.rounds} tours (${v.pct} % des dégâts du sort par tour).` } },
    stun: { name: "Lourd", icon: "💫", tier: 1, kind: 'proc',
        weapon: { chance: [10, 14, 18], text: v => `${v.chance} % par coup : la cible est étourdie et perd son prochain tour.` },
        armor: { chance: [6, 9, 12], text: v => `${v.chance} % quand vous êtes touché : l'attaquant est étourdi et perd son prochain tour.` } },
    slow: { name: "Gelé", icon: "🐌", tier: 1, kind: 'proc',
        weapon: { chance: [18, 24, 30], rounds: 2, text: v => `${v.chance} % par coup : la cible est gelée ${v.rounds} tours (ses dégâts −50 %).` },
        armor: { chance: [18, 24, 30], rounds: 2, text: v => `${v.chance} % quand vous êtes touché : l'attaquant est gelé ${v.rounds} tours (ses dégâts −50 %).` },
        spell: { chance: [18, 24, 30], rounds: 2, text: v => `${v.chance} % par sort : la cible est gelée ${v.rounds} tours (ses dégâts −50 %).` } },
    pleasure_or_pain: { name: "Vibrant", icon: "😬", tier: 1, kind: 'proc',
        weapon: { chance: [15, 20, 25], rounds: 2, miss: 30, text: v => `${v.chance} % par coup : un bourdonnement déconcentre la cible ${v.rounds} tours (${v.miss} % de chance de rater chacune de ses attaques).` },
        armor: { chance: [15, 20, 25], rounds: 2, miss: 30, text: v => `${v.chance} % quand vous êtes touché : l'attaquant est déconcentré ${v.rounds} tours (${v.miss} % de chance de rater chacune de ses attaques).` },
        spell: { chance: [15, 20, 25], rounds: 2, miss: 30, text: v => `${v.chance} % par sort : la cible est déconcentrée ${v.rounds} tours (${v.miss} % de chance de rater chacune de ses attaques).` } },
    random: { name: "Chaotique", icon: "🎲", tier: 1, kind: 'proc',
        weapon: { chance: [35, 45, 55], text: v => `${v.chance} % par coup : déclenche un effet au hasard parmi ceux d'une arme (saignement, poison, gel, étourdissement…), au rang de l'objet.` },
        armor: { chance: [35, 45, 55], text: v => `${v.chance} % quand vous êtes touché : déclenche un effet au hasard parmi ceux d'une armure, au rang de l'objet.` },
        spell: { chance: [35, 45, 55], text: v => `${v.chance} % par sort : déclenche un effet au hasard parmi ceux d'un sort, au rang de l'objet.` } },
    light: { name: "Lumineux", icon: "✨", tier: 2, kind: 'proc',
        weapon: { chance: [20, 27, 35], rounds: 2, text: v => `${v.chance} % par coup : la cible est éblouie ${v.rounds} tours (sa DEF −50 %).` },
        armor: { chance: [20, 27, 35], rounds: 2, text: v => `${v.chance} % quand vous êtes touché : l'attaquant est ébloui ${v.rounds} tours (sa DEF −50 %).` },
        spell: { chance: [20, 27, 35], rounds: 2, text: v => `${v.chance} % par sort : la cible est éblouie ${v.rounds} tours (sa DEF −50 %).` } },
    corrode: { name: "Corrosif", icon: "🧪", tier: 2, kind: 'proc',
        weapon: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % par coup : l'armure de la cible est rongée ${v.rounds} tours (sa DEF −40 %).` },
        armor: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % quand vous êtes touché : l'armure de l'attaquant est rongée ${v.rounds} tours (sa DEF −40 %).` },
        spell: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % par sort : l'armure de la cible est rongée ${v.rounds} tours (sa DEF −40 %).` } },
    fear: { name: "Terrifiant", icon: "😱", tier: 2, kind: 'proc',
        weapon: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % par coup : la cible est terrifiée ${v.rounds} tours (ses dégâts −35 %).` },
        armor: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % quand vous êtes touché : l'attaquant est terrifié ${v.rounds} tours (ses dégâts −35 %).` },
        spell: { chance: [20, 27, 35], rounds: 3, text: v => `${v.chance} % par sort : la cible est terrifiée ${v.rounds} tours (ses dégâts −35 %).` } },
    adrenaline: { name: "Galvanisant", icon: "💉", tier: 2, kind: 'proc',
        weapon: { chance: [20, 27, 35], pct: [25, 30, 35], rounds: 2, text: v => `${v.chance} % par coup : décharge d'adrénaline, vos dégâts +${v.pct} % pendant ${v.rounds} tours.` },
        armor: { chance: [20, 27, 35], pct: [25, 30, 35], rounds: 2, text: v => `${v.chance} % quand vous êtes touché : décharge d'adrénaline, vos dégâts +${v.pct} % pendant ${v.rounds} tours.` } },
    shock: { name: "Électrique", icon: "⚡", tier: 2, kind: 'proc',
        weapon: { chance: [25, 32, 40], pct: [30, 40, 50], text: v => `${v.chance} % par coup : décharge électrique, +${v.pct} % des dégâts du coup (ignorent la DEF).` },
        spell: { chance: [25, 32, 40], pct: [30, 40, 50], text: v => `${v.chance} % par sort : arc électrique, +${v.pct} % des dégâts du sort (ignorent la DEF).` } },
    aoe: { name: "Explosif", icon: "💥", tier: 2, kind: 'proc',
        weapon: { chance: [20, 25, 30], pct: [40, 55, 70], selfChance: 10, selfPct: 5, text: v => `${v.chance} % par coup : explosion, +${v.pct} % des dégâts du coup. Pour tout le monde : ${v.selfChance} % de chance de vous blesser aussi (${v.selfPct} % de vos PV max, jamais mortel).` },
        spell: { chance: [20, 25, 30], pct: [40, 55, 70], selfChance: 10, selfPct: 5, text: v => `${v.chance} % par sort : explosion, +${v.pct} % des dégâts du sort. Pour tout le monde : ${v.selfChance} % de chance de vous blesser aussi (${v.selfPct} % de vos PV max, jamais mortel).` } },
    heal: { name: "Régénérant", icon: "💚", tier: 3, kind: 'proc',
        weapon: { chance: [25, 32, 40], pct: [4, 6, 8], text: v => `${v.chance} % par coup : vous soigne de ${v.pct} % de vos PV max.` },
        armor: { chance: [25, 32, 40], pct: [4, 6, 8], text: v => `${v.chance} % quand vous êtes touché : vous soigne de ${v.pct} % de vos PV max.` } },
    drain: { name: "Drainant", icon: "🌀", tier: 3, kind: 'proc',
        weapon: { chance: [15, 20, 25], pct: [8, 10, 12], cap: 40, text: v => `${v.chance} % par coup : draine la cible, son ATQ −${v.pct} % jusqu'à la fin du combat (cumulable, jusqu'à −${v.cap} %).` },
        armor: { chance: [15, 20, 25], pct: [8, 10, 12], cap: 40, text: v => `${v.chance} % quand vous êtes touché : draine l'attaquant, son ATQ −${v.pct} % jusqu'à la fin du combat (cumulable, jusqu'à −${v.cap} %).` },
        spell: { chance: [15, 20, 25], pct: [8, 10, 12], cap: 40, text: v => `${v.chance} % par sort : draine la cible, son ATQ −${v.pct} % jusqu'à la fin du combat (cumulable, jusqu'à −${v.cap} %).` } },
    // Vampirique : passif sur une arme/un sort (chaque coup), déclenché sur une armure.
    lifesteal: { name: "Vampirique", icon: "🧛", tier: 3, kind: 'proc',
        weapon: { passive: true, pct: [8, 12, 16], text: v => `Chaque coup vous soigne de ${v.pct} % des dégâts infligés.` },
        armor: { chance: [25, 32, 40], pct: [20, 25, 30], text: v => `${v.chance} % quand vous êtes touché : vous récupérez ${v.pct} % des dégâts encaissés.` },
        spell: { passive: true, pct: [8, 12, 16], text: v => `Chaque sort vous soigne de ${v.pct} % des dégâts infligés.` } },

    // --- Effets permanents -----------------------------------------------------------------------
    keen: { name: "Aiguisé", icon: "🔪", tier: 1, kind: 'passive',
        weapon: { pct: [8, 12, 16], text: v => `Dégâts +${v.pct} %.` } },
    amplified: { name: "Amplifié", icon: "🔮", tier: 1, kind: 'passive',
        spell: { pct: [8, 12, 16], text: v => `Dégâts du sort +${v.pct} %.` } },
    thrifty: { name: "Économe", icon: "💧", tier: 1, kind: 'passive',
        spell: { pct: [10, 15, 20], text: v => `Coûte ${v.pct} % de mana en moins.` } },
    swift: { name: "Véloce", icon: "👟", tier: 1, kind: 'passive',
        weapon: { bonus: [1, 2, 3], text: v => `+${v.bonus} à vos jets de distance (S'approcher, S'éloigner).` },
        armor: { bonus: [1, 2, 3], text: v => `+${v.bonus} à vos jets de distance (S'approcher, S'éloigner).` } },
    thorns: { name: "Épineux", icon: "🌵", tier: 1, kind: 'passive',
        armor: { pct: [10, 15, 20], text: v => `Renvoie ${v.pct} % des dégâts encaissés à l'attaquant.` } },
    sturdy: { name: "Robuste", icon: "🧱", tier: 1, kind: 'passive',
        armor: { pct: [8, 12, 16], text: v => `PV max +${v.pct} %.` } },
    precise: { name: "Précis", icon: "🎯", tier: 2, kind: 'passive',
        weapon: { chance: [8, 12, 16], mult: 1.6, text: v => `${v.chance} % de coups critiques (dégâts ×${String(v.mult).replace('.', ',')}).` },
        spell: { chance: [8, 12, 16], mult: 1.6, text: v => `${v.chance} % de sorts critiques (dégâts ×${String(v.mult).replace('.', ',')}).` } },
    pierce: { name: "Perforant", icon: "🗡️", tier: 2, kind: 'passive',
        weapon: { pct: [15, 25, 35], text: v => `Ignore ${v.pct} % de la DEF de la cible.` },
        spell: { pct: [15, 25, 35], text: v => `Ignore ${v.pct} % de la DEF de la cible.` } },
    stealth: { name: "Silencieux", icon: "🤫", tier: 2, kind: 'passive',
        weapon: { bonus: [8, 12, 16], text: v => `+${v.bonus} points de chance de passer inaperçu.` },
        armor: { bonus: [8, 12, 16], text: v => `+${v.bonus} points de chance de passer inaperçu.` } },
    lucky: { name: "Chanceux", icon: "🍀", tier: 2, kind: 'passive',
        weapon: { chance: [5, 8, 12], text: v => `${v.chance} % de chance que chaque butin trouvé monte d'un palier de rareté.` },
        armor: { chance: [5, 8, 12], text: v => `${v.chance} % de chance que chaque butin trouvé monte d'un palier de rareté.` } },
    darkness: { name: "Ténébreux", icon: "🌑", tier: 2, kind: 'passive',
        armor: { chance: [6, 9, 12], text: v => `${v.chance} % de chance d'esquiver complètement une attaque.` } },
    tenacious: { name: "Tenace", icon: "🛡️", tier: 2, kind: 'passive',
        armor: { chance: [20, 30, 40], text: v => `${v.chance} % de chance de résister à chaque effet ennemi (brûlure, poison, étourdissement, peur…).` } },
    channeled: { name: "Canalisé", icon: "🧘", tier: 2, kind: 'passive',
        spell: { bonus: [3, 5, 7], text: v => `Risque d'échec du sort −${v.bonus} points (jamais sous 1 %).` } },

    // --- Défauts de la Camelote (un seul rang) ---------------------------------------------------
    rusty: { name: "Rouillé", icon: "🟫", tier: 1, kind: 'malus',
        weapon: { pct: [15], text: v => `Dégâts de l'objet −${v.pct} % (déjà compté dans ses stats).` } },
    cracked: { name: "Fêlé", icon: "💔", tier: 1, kind: 'malus',
        armor: { pct: [25], text: v => `Armure −${v.pct} % (déjà comptée dans ses stats).` } },
    wobbly: { name: "Bancal", icon: "🥴", tier: 1, kind: 'malus',
        weapon: { chance: [10], text: v => `${v.chance} % de chance de rater complètement votre attaque.` } },
    squeaky: { name: "Grinçant", icon: "🔔", tier: 1, kind: 'malus',
        weapon: { bonus: [-10], text: v => `${v.bonus} points de chance de passer inaperçu.` },
        armor: { bonus: [-10], text: v => `${v.bonus} points de chance de passer inaperçu.` } },
    stutter: { name: "Bredouillant", icon: "🤐", tier: 1, kind: 'malus',
        spell: { bonus: [8], text: v => `Risque d'échec du sort +${v.bonus} points.` } }
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
    module.exports = { itemRarities, itemBalance, itemQualifiers, baseItems };
}
