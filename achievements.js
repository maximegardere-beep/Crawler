// ==========================================
// CHRONIQUE DE RUN + SUCCÈS SARCASTIQUES (chantier 2, voir NOTES_SUCCES.md et CHANTIERS.md)
// ==========================================
// Catalogue PUR (aucun accès au DOM, aucune écriture) : la chronique (`gameState.runStats`) est
// alimentée par recordRunEvent() dans app.js, qui évalue ensuite chaque `check(stats, event, state)`
// ci-dessous. Les succès sont PAR CRAWLER (dans sa sauvegarde) ; chacun rapporte une boîte de butin
// façon DCC selon son palier (config.achievementBoxes dans app.js), sauf les succès posthumes.
// Chargé avant app.js (même ordre dans index.html et tests/load_game.js).

// Paliers : libellé et icône de la boîte associée.
const ACHIEVEMENT_TIERS = {
    bronze: { label: 'Bronze', box: '🥉', color: '#d97706' },
    silver: { label: 'Argent', box: '🥈', color: '#9ca3af' },
    gold: { label: 'Or', box: '🥇', color: '#facc15' }
};

// Chronique vierge d'un run. Tout nouveau compteur s'ajoute ici (une sauvegarde plus ancienne est
// complétée par normalizeRunStats(), jamais laissée avec un champ undefined).
function createEmptyRunStats() {
    return {
        kills: 0, bossKills: 0, eliteKills: 0,
        unarmedKills: 0, spellKills: 0, sneakKills: 0, oneShotKills: 0,
        flawlessWins: 0, clutchWins: 0,
        damageTaken: 0,
        flees: 0,
        trapsThisFloor: 0,
        rests: 0,
        lateDescents: 0,
        shopPurchases: 0,
        backfires: 0,
        spellsLearned: [], // noms de sorts distincts
        companionsLeft: 0, companionsDismissed: 0, junkGifts: 0,
        overflowSold: 0,
        maxFloor: 1,
        // Victoires récentes (au plus DOMINANCE_WINDOW), pour l'indice de domination (chantier 3) :
        // { ease } = 1 si aucun PV perdu, 0 si ≥ DOMINANCE_HARD_FIGHT des PV max perdus.
        recentWins: []
    };
}

function normalizeRunStats(stats) {
    const base = createEmptyRunStats();
    const merged = { ...base, ...(stats || {}) };
    if (!Array.isArray(merged.spellsLearned)) merged.spellsLearned = [];
    if (!Array.isArray(merged.recentWins)) merged.recentWins = [];
    return merged;
}

const DOMINANCE_WINDOW = 10;       // victoires prises en compte
const DOMINANCE_MIN_SAMPLES = 3;   // en dessous, pas assez de recul : domination nulle
const DOMINANCE_HARD_FIGHT = 0.4;  // perdre 40 % de ses PV max = combat « difficile » (facilité 0)

// Facilité d'une victoire (pure) : 1 sans aucun PV perdu, 0 au-delà de DOMINANCE_HARD_FIGHT des PV max.
function computeWinEase(hpLost, maxHp) {
    if (!(maxHp > 0)) return 0;
    return Math.max(0, 1 - Math.min(1, (hpLost / maxHp) / DOMINANCE_HARD_FIGHT));
}

// Indice de domination (pure, 0-1) : moyenne de facilité des dernières victoires. Lu par les chasseurs
// de primes (chantier 3) — un crawler qui écrase tout sans une égratignure tend vers 1.
function computeDominance(recentWins) {
    if (!Array.isArray(recentWins) || recentWins.length < DOMINANCE_MIN_SAMPLES) return 0;
    const sample = recentWins.slice(-DOMINANCE_WINDOW);
    return sample.reduce((sum, w) => sum + (w.ease || 0), 0) / sample.length;
}

function countEquipmentInReserve(state) {
    return (state.inventory || []).filter(i => i.category !== 'consumables').length;
}

// Catalogue : { id, icon, title, text, tier, secret?, posthumous?, check(stats, event, state) }.
// `check` doit rester pur et bon marché : il est rejoué à chaque événement de la chronique.
const ACHIEVEMENTS = [
    // --- Combat ---
    { id: 'first_blood', icon: '🩸', tier: 'bronze', title: "Premier sang (le vôtre)",
        text: "Vous avez perdu vos premiers PV. Le public applaudit, pour des raisons discutables.",
        check: (s) => s.damageTaken > 0 },
    { id: 'first_kill', icon: '🗡️', tier: 'bronze', title: "Première victime",
        text: "Votre premier meurtre télévisé. Maman serait fière. Ou horrifiée. Les sondages divergent.",
        check: (s) => s.kills >= 1 },
    { id: 'one_shot', icon: '💥', tier: 'bronze', title: "Coup de maître",
        text: "Un seul coup. Le monstre n'a même pas eu le temps de regretter ses choix de vie.",
        check: (s) => s.oneShotKills >= 1 },
    { id: 'clutch', icon: '🪶', tier: 'silver', title: "À un poil",
        text: "Victoire avec presque plus rien dans le réservoir. Le médecin de l'émission a déjà rempli le certificat.",
        check: (s) => s.clutchWins >= 1 },
    { id: 'flawless10', icon: '🧤', tier: 'silver', title: "Intouchable",
        text: "Dix victoires sans une égratignure. Les scénaristes commencent à s'ennuyer.",
        check: (s) => s.flawlessWins >= 10 },
    { id: 'unarmed10', icon: '🥊', tier: 'silver', title: "Pacifiste contrarié",
        text: "Dix monstres terrassés à mains nues. Vous aviez pourtant dit que vous étiez contre la violence.",
        check: (s) => s.unarmedKills >= 10 },
    { id: 'sneak10', icon: '🔪', tier: 'silver', title: "Dans le dos",
        text: "Dix combats ouverts par derrière. L'honneur est un luxe de surface.",
        check: (s) => s.sneakKills >= 10 },
    { id: 'spell25', icon: '🧙', tier: 'silver', title: "Magicien du dimanche",
        text: "Vingt-cinq monstres achevés au sort. Vous portez presque une robe à étoiles, maintenant.",
        check: (s) => s.spellKills >= 25 },
    { id: 'elite5', icon: '💀', tier: 'silver', title: "Élitiste",
        text: "Cinq élites au tapis. Vous ne tapez plus que sur ce qui a un CV.",
        check: (s) => s.eliteKills >= 5 },
    { id: 'boss1', icon: '👑', tier: 'silver', title: "Couronné",
        text: "Votre premier boss. Il avait une famille. Enfin, probablement pas. Mais peut-être.",
        check: (s) => s.bossKills >= 1 },
    { id: 'boss10', icon: '👑', tier: 'gold', title: "Régicide en série",
        text: "Dix boss abattus. La guilde des boss envisage de porter plainte.",
        check: (s) => s.bossKills >= 10 },

    // --- Fuite & survie ---
    { id: 'flee10', icon: '🏃', tier: 'bronze', title: "Stratégie de repli",
        text: "Dix fuites réussies. Le courage, c'est surfait ; le cardio, jamais.",
        check: (s) => s.flees >= 10 },
    { id: 'traps3', icon: '🦶', tier: 'bronze', title: "Jambes de coton",
        text: "Trois pièges sur un même étage. Regarder où l'on marche est une compétence, pas une option.",
        check: (s) => s.trapsThisFloor >= 3 },
    { id: 'rest10', icon: '🛌', tier: 'bronze', title: "Syndicaliste",
        text: "Dix pauses en salle sécurisée. Vous connaissez vos droits.",
        check: (s) => s.rests >= 10 },
    { id: 'late_descent', icon: '⏳', tier: 'silver', title: "Retardataire chronique",
        text: "Vous descendez avec moins de 5 heures au compteur. Le frisson du dernier métro.",
        check: (s) => s.lateDescents >= 1 },

    // --- Économie & objets ---
    { id: 'junk_style', icon: '🧦', tier: 'bronze', title: "Style Camelote",
        text: "Arme ET armure de Camelote. Un look assumé, que personne ne vous enviera.",
        check: (s, e, g) => !!(g.equipment && g.equipment.weapon && g.equipment.armor
            && g.equipment.weapon.rarityKey === 'camelote' && g.equipment.armor.rarityKey === 'camelote') },
    { id: 'hoarder', icon: '🗃️', tier: 'bronze', title: "Accumulateur",
        text: "Réserve pleine à craquer. Vous ne jetez rien, « au cas où ».",
        check: (s, e, g) => countEquipmentInReserve(g) >= (g.maxInventory || Infinity) },
    { id: 'shopper5', icon: '🛒', tier: 'silver', title: "Client fidèle",
        text: "Cinq achats chez les marchands. Votre carte de fidélité est tachée de sang.",
        check: (s) => s.shopPurchases >= 5 },
    { id: 'miser', icon: '💰', tier: 'silver', title: "Radin",
        text: "1 000 PO en poche. Vous mourrez riche, ce qui est une façon comme une autre de mourir.",
        check: (s, e, g) => (g.gold || 0) >= 1000 },
    { id: 'collector', icon: '✨', tier: 'gold', title: "Collectionneur",
        text: "Trois objets signature de boss. Vous décorez votre sac avec les dépouilles de vos ennemis.",
        check: (s, e, g) => (g.signaturesAwarded || []).length >= 3 },

    // --- Social ---
    { id: 'bff', icon: '🤝', tier: 'silver', title: "Meilleurs amis",
        text: "Loyauté au maximum. Vous avez un ami. Dans un donjon. Profitez-en, ça ne dure jamais.",
        check: (s, e, g) => !!(g.companion && g.companion.loyalty >= 100) },
    { id: 'poisoned_gift', icon: '🎁', tier: 'bronze', secret: true, title: "Cadeau empoisonné",
        text: "Vous avez offert de la Camelote à votre compagnon. Il a souri. Il s'en souviendra.",
        check: (s) => s.junkGifts >= 1 },
    { id: 'sms_breakup', icon: '📱', tier: 'bronze', secret: true, title: "Rupture par SMS",
        text: "Vous avez congédié votre compagnon. Même pas en face, presque.",
        check: (s) => s.companionsDismissed >= 1 },
    { id: 'ghosted', icon: '👻', tier: 'bronze', secret: true, title: "Ghosté",
        text: "Votre compagnon est parti sans se retourner. Ce n'est pas vous, c'est lui. (C'est vous.)",
        check: (s) => s.companionsLeft >= 1 },

    // --- Magie & chaos ---
    { id: 'abracadaboom', icon: '🎆', tier: 'bronze', title: "Abracadabroum",
        text: "Cinq sorts ratés. La magie, c'est 10 % de talent et 90 % de sourcils brûlés.",
        check: (s) => s.backfires >= 5 },
    { id: 'bookworm', icon: '📚', tier: 'silver', title: "Rat de bibliothèque",
        text: "Cinq sorts différents appris. Vous lisez plus dans ce donjon qu'à la surface.",
        check: (s) => s.spellsLearned.length >= 5 },

    // --- Progression ---
    { id: 'floor3', icon: '🪜', tier: 'bronze', title: "Touriste",
        text: "Étage 3. Vous avez dépassé le stade du tutoriel. Presque.",
        check: (s) => s.maxFloor >= 3 },
    { id: 'floor6', icon: '🏙️', tier: 'silver', title: "Citadin",
        text: "Étage 6. Vous commencez à avoir des habitudes dans ce donjon. C'est inquiétant.",
        check: (s) => s.maxFloor >= 6 },
    { id: 'floor9', icon: '🧗', tier: 'silver', title: "Spéléologue confirmé",
        text: "Étage 9. Vous avez oublié à quoi ressemble le soleil, et c'est tant mieux : il a explosé.",
        check: (s) => s.maxFloor >= 9 },
    { id: 'floor12', icon: '🕳️', tier: 'gold', title: "Abonné aux abysses",
        text: "Étage 12. Les audiences explosent. Votre espérance de vie, beaucoup moins.",
        check: (s) => s.maxFloor >= 12 },
    { id: 'exit', icon: '🚪', tier: 'gold', title: "Sortie de secours",
        text: "Vous êtes sorti vivant. Les producteurs sont furieux. Le public, lui, exige une saison 2.",
        check: (s, e, g) => !!g.hasWon },

    // --- Posthumes (débloqués à la mort, boîte livrée à titre posthume) ---
    { id: 'first_corpse', icon: '⚰️', tier: 'bronze', secret: true, posthumous: true, title: "Premier cadavre",
        text: "Vous êtes mort. Rien de personnel : c'est l'émission.",
        check: (s, e) => e.type === 'death' },
    { id: 'weak_mob_death', icon: '🐀', tier: 'bronze', secret: true, posthumous: true, title: "Le Rat de trop",
        text: "Tué par un adversaire largement inférieur. Le replay tourne en boucle sur toutes les chaînes.",
        check: (s, e) => e.type === 'death' && !!e.weakMob },
    { id: 'backfire_death', icon: '🔥', tier: 'bronze', secret: true, posthumous: true, title: "Mort par sa propre main",
        text: "Votre propre sort vous a achevé. L'arroseur arrosé, version incandescente.",
        check: (s, e) => e.type === 'death' && e.cause === 'backfire' },
    { id: 'timeout_death', icon: '⌛', tier: 'bronze', secret: true, posthumous: true, title: "Le temps, c'est de la mort",
        text: "Le donjon s'est effondré pendant que vous flâniez. Il fallait descendre.",
        check: (s, e) => e.type === 'death' && e.cause === 'timeout' }
];

function getAchievementById(id) {
    return ACHIEVEMENTS.find(a => a.id === id) || null;
}

if (typeof module !== 'undefined') {
    module.exports = { ACHIEVEMENTS, ACHIEVEMENT_TIERS, createEmptyRunStats, normalizeRunStats, computeWinEase, computeDominance };
}
