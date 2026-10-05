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
    // Poids de rareté du loot selon l'étage (première ligne dont maxFloor >= étage courant). Refonte de la
    // rareté (chantier 10, validée) : un Épique reste exceptionnel avant l'étage 6, un Légendaire tient du
    // miracle avant l'étage 10 et ne devient un vrai espoir qu'à partir de l'étage 15.
    lootTables: [
        { maxFloor: 2,        weights: { camelote: 30, commun: 60, rare: 9.48, epique: 0.5, legendaire: 0.02 } },
        { maxFloor: 5,        weights: { camelote: 20, commun: 58, rare: 18,   epique: 3.8, legendaire: 0.2 } },
        { maxFloor: 9,        weights: { camelote: 12, commun: 50, rare: 28,   epique: 9,   legendaire: 1 } },
        { maxFloor: 14,       weights: { camelote: 6,  commun: 40, rare: 34,   epique: 16,  legendaire: 4 } },
        { maxFloor: Infinity, weights: { camelote: 3,  commun: 28, rare: 36,   epique: 24,  legendaire: 9 } }
    ],
    // Montées de palier après le tirage (voir rollLootRarity() dans generator.js) : un mob élite a une
    // CHANCE de monter d'un palier, un boss (ou un trésor de CAFET_ASSOMBRIE) monte TOUJOURS d'un palier.
    eliteUpgradeChance: 20,
    // Plafond des montées (élite, boss, trésor, Chanceux) : jusqu'à l'étage maxFloor, une montée ne dépasse
    // jamais ce palier — seul le tirage de base (le miracle) peut aller au-delà.
    upgradeCaps: [{ maxFloor: 4, key: "epique" }],
    // Chance (%) qu'un objet de Camelote porte un défaut (itemQualifiers, kind 'malus').
    junkMalusChance: 60,
    // Boss : +1 palier, plancher selon l'étage (aucun aux étages 1-3, Rare dès l'étage 4, Épique dès le 12).
    boss: {
        tierBonus: 1,
        minRarityByFloor: [{ fromFloor: 4, key: "rare" }, { fromFloor: 12, key: "epique" }],
        secondItemChance: 25
        // L'objet signature n'a plus de chance fixe : il exige un Coup de grâce parfait (chantier 6, V3 — voir awardBossSignatureItem()).
    },
    // Rareté de l'objet signature d'un boss selon l'étage : Rare 1-4, Épique 5-9, Légendaire 10+.
    signatureRarityByFloor: [
        { maxFloor: 4, key: "rare" },
        { maxFloor: 9, key: "epique" },
        { maxFloor: Infinity, key: "legendaire" }
    ],
    treasure: { tierBonus: 1 },
    // Le boss d'un repaire (étage urbain) lâche un butin d'un niveau d'objet au-dessus de l'étage.
    lairBossLevelBonus: 1,
    // Boutiques (chantier 10) : poids des familles Militaire / Arsenal multiplié dans le stock d'un marchand,
    // pour qu'on y trouve plus souvent du vrai matériel (à un prix en conséquence).
    shopFamilyBoost: { militaire: 2, arsenal: 3 },
    // Poids d'un objet blague (jokeItem, ne tombe qu'en Camelote) relatif à sa famille.
    jokeWeightMult: 0.5
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
        spell: { bonus: [8], text: v => `Risque d'échec du sort +${v.bonus} points.` } },

    // --- Objets démoniaques (chantier 17, lot 4 — voir demon-items.js) -----------------------------
    // Effets uniques (`demonic: true`) et malédictions (`curse: true`) de l'armurerie de Gorgoth : JAMAIS tirés au
    // hasard (exclus de rollQualifiers(), rollJunkMalus() et du bonus de forge de buildSignatureItem()), seulement posés
    // par buildDemonicItem(). Un objet démoniaque est toujours au rang III : les valeurs sont identiques à chaque rang.
    // Les effets n'agissent que sur l'objet ÉQUIPÉ ; les malédictions tant qu'on le POSSÈDE (équipé ou en réserve).
    demon_lifesteal: { name: "Ardent", icon: "🔥", tier: 3, kind: 'passive', demonic: true,
        weapon: { pct: [15, 15, 15], text: v => `Chaque coup vous soigne de ${v.pct} % des dégâts infligés.` } },
    demon_last_breath: { name: "Ignifugé", icon: "🧯", tier: 3, kind: 'passive', demonic: true,
        armor: { hp: [1, 1, 1], text: v => `Le premier coup mortel de chaque combat est annulé : il vous reste ${v.hp} PV.` } },
    demon_souls: { name: "Faucheur d'âmes", icon: "👻", tier: 3, kind: 'passive', demonic: true,
        weapon: { max: [3, 3, 3], pct: [100, 100, 100], text: v => `Chaque victoire charge une âme (${v.max} au plus) ; le tir suivant les consomme toutes : +${v.pct} % de dégâts par âme.` } },
    demon_decree: { name: "Réglementaire", icon: "📜", tier: 3, kind: 'passive', demonic: true,
        spell: { mult: [1.6, 1.6, 1.6], text: v => `Dégâts de base ×${String(v.mult).replace('.', ',')} par rapport au meilleur sort ordinaire (déjà comptés dans ses stats).` } },
    curse_potions: { name: "Gosier brûlé", icon: "🥵", tier: 1, kind: 'malus', curse: true,
        weapon: { pct: [50], text: v => `Malédiction (tant que vous le possédez) : vos potions soignent ${v.pct} % de moins.` } },
    curse_no_regen: { name: "Étouffant", icon: "🫁", tier: 1, kind: 'malus', curse: true,
        armor: { pct: [100], text: v => `Malédiction (tant que vous le possédez) : votre régénération passive de PV est réduite de ${v.pct} % (nulle).` } },
    curse_soul_hunger: { name: "Affamé", icon: "🕳️", tier: 1, kind: 'malus', curse: true,
        weapon: { pct: [3], text: v => `Malédiction : un tir sans âme vous coûte ${v.pct} % de vos PV max (jamais mortel : il vous reste au moins 1 PV).` } },
    curse_blood_price: { name: "Prix du sang", icon: "🩸", tier: 1, kind: 'malus', curse: true,
        spell: { pct: [8], text: v => `Malédiction : coûte ${v.pct} % de vos PV max au lieu du mana (jamais mortel : impossible à lancer si vos PV n'y suffisent pas).` } }
};

// `jokeItem: true` marque un objet volontairement dérisoire (blague DCC) : il ne tombe JAMAIS qu'au
// palier Camelote (voir pickBaseItem() dans generator.js), jamais au milieu du loot normal où il
// serait strictement inférieur à tout le reste. Le cadeau de départ (Camelote) y pioche volontiers.
// Stats de BASE (niveau d'objet 1, rareté Commune) : voir itemBalance pour la mise à l'échelle.
// `minFloor` (défaut 1) : étage à partir duquel un objet de base peut tomber — les meilleurs objets de
// base n'apparaissent qu'en profondeur, ce qui s'ajoute au niveau d'objet pour donner une vraie
// sensation de progression. Les objets blagues (`jokeItem`) ne tombent jamais qu'au palier Camelote.
// Chantier 10 « expansion de la banque d'objets » : `family` (ITEM_FAMILIES) fixe la FRÉQUENCE d'un objet
// de base — beaucoup de bricolage, rarement du vrai matériel — indépendamment de sa rareté (qui qualifie un
// exemplaire). `trait` : qualificatif FIXE, toujours porté quelle que soit la rareté (compromis d'un gros
// objet : bruyant, lourd…), clé d'itemQualifiers.
const ITEM_FAMILIES = {
    bricolage: { label: "Bricolage", weight: 10 },
    standard: { label: "Standard", weight: 6 },
    militaire: { label: "Militaire", weight: 3 },
    arsenal: { label: "Arsenal", weight: 1 }
};

const baseItems = {
    weapons: [
        { name: "Pied-de-biche", baseDmg: 4, baseValue: 10, family: 'bricolage' },
        { name: "Extincteur Cabossé", baseDmg: 1, baseValue: 2, canEnchant: false, jokeItem: true, family: 'bricolage' },
        { name: "Agrafeuse Tactique", baseDmg: 3, baseValue: 15, family: 'bricolage' },
        { name: "Épée en Pain de Mie", baseDmg: 6, baseValue: 20, minFloor: 2, family: 'standard' },
        { name: "Hache à Viande", baseDmg: 7, baseValue: 25, minFloor: 3, family: 'standard' },
        { name: "Bâton de Dynamite", baseDmg: 9, baseValue: 30, minFloor: 5, family: 'militaire' },
        { name: "Couteau en Beurre", baseDmg: 2, baseValue: 5, canEnchant: false, jokeItem: true, family: 'bricolage' },
        { name: "Lance à Feu", baseDmg: 8, baseValue: 35, minFloor: 4, family: 'militaire' },
        { name: "Gantelet Électrique", baseDmg: 7, baseValue: 28, minFloor: 3, family: 'standard' },
        { name: "Antivol de Voiture", baseDmg: 4, baseValue: 12, family: 'bricolage' },
        { name: "Pied de Parasol", baseDmg: 5, baseValue: 16, family: 'bricolage' },
        { name: "Masse d'Armes", baseDmg: 10, baseValue: 40, minFloor: 4, family: 'militaire' },
        { name: "Épée Longue", baseDmg: 12, baseValue: 55, minFloor: 5, family: 'militaire' },
        { name: "Katana de Collection", baseDmg: 12, baseValue: 60, minFloor: 6, family: 'militaire' },
        { name: "Tronçonneuse", baseDmg: 14, baseValue: 80, minFloor: 7, family: 'arsenal', trait: 'squeaky' },
        { name: "Marteau de Guerre", baseDmg: 15, baseValue: 90, minFloor: 9, family: 'arsenal', trait: 'wobbly' },
        { name: "Nouille de Piscine", baseDmg: 1, baseValue: 2, canEnchant: false, jokeItem: true, family: 'bricolage' },
        { name: "Tapette à Mouches", baseDmg: 2, baseValue: 3, canEnchant: false, jokeItem: true, family: 'bricolage' }
    ],
    // Armes à distance : utilisées uniquement quand un écart sépare le joueur du mob (voir
    // attackRanged() dans app.js). Même système de rareté/qualificatifs que les armes de mêlée.
    ranged: [
        { name: "Lance-Pierre de Chantier", baseDmg: 5, baseValue: 18, family: 'bricolage' },
        { name: "Arc de Fortune Rafistolé", baseDmg: 6, baseValue: 22, minFloor: 2, family: 'standard' },
        { name: "Arbalète de Musée", baseDmg: 9, baseValue: 35, minFloor: 4, family: 'standard' },
        { name: "Pistolet à Clous", baseDmg: 7, baseValue: 28, minFloor: 3, family: 'standard' },
        { name: "Fusil de Chasse Rouillé", baseDmg: 11, baseValue: 45, minFloor: 6, family: 'militaire' },
        { name: "Sarbacane Improvisée", baseDmg: 3, baseValue: 8, jokeItem: true, family: 'bricolage' },
        { name: "Pistolet à Eau Surpuissant", baseDmg: 4, baseValue: 14, family: 'bricolage' },
        { name: "Lance-Confettis Bricolé", baseDmg: 4, baseValue: 12, family: 'bricolage' },
        { name: "Arc Long de Compétition", baseDmg: 12, baseValue: 55, minFloor: 5, family: 'militaire' },
        { name: "Lance-Harpon", baseDmg: 13, baseValue: 70, minFloor: 7, family: 'arsenal' },
        { name: "Arbalète Lourde", baseDmg: 14, baseValue: 80, minFloor: 8, family: 'arsenal', trait: 'wobbly' },
        { name: "Fusil à Pompe", baseDmg: 15, baseValue: 90, minFloor: 10, family: 'arsenal', trait: 'squeaky' },
        { name: "Pistolet à Bulles", baseDmg: 2, baseValue: 3, canEnchant: false, jokeItem: true, family: 'bricolage' }
    ],
    armors: [
        { name: "Couvercle de Poubelle", baseArmor: 3, baseValue: 8, family: 'bricolage' },
        { name: "Costume Trois-Pièces Déchiré", baseArmor: 1, baseValue: 20, family: 'bricolage' },
        { name: "Gilet Haute Visibilité", baseArmor: 2, baseValue: 5, canEnchant: false, jokeItem: true, family: 'bricolage' },
        { name: "Armure de Carton", baseArmor: 5, baseValue: 12, minFloor: 2, family: 'standard' },
        { name: "Plastron de Coquillage", baseArmor: 4, baseValue: 15, family: 'standard' },
        { name: "Rideau de Douche Camouflage", baseArmor: 0, baseValue: 8, jokeItem: true, family: 'bricolage' },
        { name: "Combinaison de Plongée", baseArmor: 6, baseValue: 22, minFloor: 3, family: 'standard' },
        { name: "Gilet Pare-Balles Périmé", baseArmor: 2, baseValue: 10, family: 'bricolage' },
        { name: "Bouclier en Polystyrène", baseArmor: 4, baseValue: 18, minFloor: 2, family: 'bricolage' },
        { name: "Manteau en Cuir de Skaï Renforcé", baseArmor: 7, baseValue: 40, minFloor: 5, family: 'militaire' },
        { name: "Bouée Canard Renforcée", baseArmor: 4, baseValue: 14, family: 'bricolage' },
        { name: "Gilet de Sécurité Chantier", baseArmor: 5, baseValue: 20, minFloor: 3, family: 'standard' },
        { name: "Armure Anti-Émeute", baseArmor: 9, baseValue: 50, minFloor: 5, family: 'militaire' },
        { name: "Cotte de Mailles", baseArmor: 10, baseValue: 60, minFloor: 6, family: 'militaire' },
        { name: "Tenue de Démineur", baseArmor: 12, baseValue: 80, minFloor: 8, family: 'arsenal', trait: 'squeaky' },
        { name: "Armure de Plates", baseArmor: 13, baseValue: 90, minFloor: 9, family: 'arsenal', trait: 'squeaky' },
        { name: "Poncho en Sac-Poubelle", baseArmor: 1, baseValue: 2, canEnchant: false, jokeItem: true, family: 'bricolage' }
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
    module.exports = { itemRarities, itemBalance, itemQualifiers, ITEM_FAMILIES, baseItems };
}
