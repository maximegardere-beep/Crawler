// ==========================================
// ORIGINES : RACES ET CLASSES (chantier 13, lot 0 — données pures ; voir CHANTIERS.md)
// ==========================================
// Catalogue PUR (aucun accès au DOM ni à `gameState`, aucune écriture) : 7 races et 6 classes proposées au crawler à son
// arrivée sur l'étage 3 (deux écrans successifs, race puis classe — lots 2 et 3), et le tirage des 3 cartes de chaque
// écran (`pickOriginOffers()`, hasard injectable). Les EFFETS (bonus, défauts, capacités) sont codés aux lots 1 et 3 ;
// ici seuls vivent leurs libellés d'affichage, leurs conditions de déblocage et leurs conditions de « jouabilité ».
// Les chiffres sont des valeurs de départ, à playtester. Chargé après `achievements.js` (il lit la chronique du run) et avant
// `app.js` — même ordre dans index.html et tests/load_game.js (GAME_FILES). Tout nom global est préfixé `origin`/`ORIGIN`.

const ORIGIN_OFFER_COUNT = 3;

// `state` = l'état du jeu (gameState) : seuls `runStats`, `skills`, `equipment`, `inventory` et `spellbook` sont lus.
function originStats(state) { return (state && state.runStats) || {}; }
function originNum(state, key) { return originStats(state)[key] || 0; }
function originSkillLevel(state, skill) { return (state && state.skills && state.skills[skill] && state.skills[skill].level) || 1; }
function originHasEquipped(state, slot) { return !!(state && state.equipment && state.equipment[slot]); }
function originHasInBag(state, category) { return !!(state && Array.isArray(state.inventory) && state.inventory.some(i => i.category === category)); }
function originSpellCount(state) { return (originStats(state).spellsLearned || []).length; }

// Races. `basic` : toujours éligible (choix de base). `when(state)` : condition de déblocage ; `why(state)` : la ligne
// d'explication affichée sur la carte quand la condition est remplie. `effects` / `flaw` : libellés des cartes.
const ORIGIN_RACES = {
    human: {
        key: 'human', icon: '🧑', name: "Humain·e « Moyen·ne mais motivé·e »", short: 'Humain·e', basic: true,
        effects: ["XP +10 %", "+1 emplacement de réserve (9 au lieu de 8)"], flaw: null,
        when: () => true,
        why: () => "Un choix de base : le Donjon en garde toujours un en stock."
    },
    ghoul: {
        key: 'ghoul', icon: '🧟', name: "Goule", short: 'Goule',
        effects: ["PV max +20 %", "Saignement −50 %"], flaw: "Soins reçus −20 %",
        when: s => originNum(s, 'clutchWins') >= 1 || originNum(s, 'damageTaken') >= 100,
        why: s => originNum(s, 'clutchWins') >= 1
            ? "Proposée car vous avez gagné un combat à un poil de la mort."
            : `Proposée car vous avez déjà encaissé ${originNum(s, 'damageTaken')} points de dégâts.`
    },
    goblin: {
        key: 'goblin', icon: '👺', name: "Gobelin de caniveau", short: 'Gobelin',
        effects: ["Furtivité +10 pts", "Fuite +15 pts", "Pièges −25 %"], flaw: "PV max −10 %",
        when: s => originNum(s, 'sneakKills') >= 1 || originNum(s, 'flees') >= 2,
        why: s => originNum(s, 'sneakKills') >= 1
            ? "Proposé car vous avez frappé un monstre dans le dos."
            : `Proposé car vous avez pris la fuite ${originNum(s, 'flees')} fois.`
    },
    troll: {
        key: 'troll', icon: '👔', name: "Troll de bureau", short: 'Troll',
        effects: ["PV max +25 %", "Mains nues +15 %"], flaw: "Furtivité −10 pts",
        when: s => originNum(s, 'unarmedKills') >= 3,
        why: s => `Proposé car vous avez assommé ${originNum(s, 'unarmedKills')} monstres à mains nues.`
    },
    elf: {
        key: 'elf', icon: '🧝', name: "Elfe de salon", short: 'Elfe',
        effects: ["Mana max +25 %", "Sorts +10 %", "Backfire −3 pts"], flaw: "DEF −1",
        when: s => originNum(s, 'spellKills') >= 2 || originSpellCount(s) >= 1,
        why: s => originNum(s, 'spellKills') >= 2
            ? `Proposée car vous avez achevé ${originNum(s, 'spellKills')} monstres au sort.`
            : "Proposée car vous avez appris un sort."
    },
    dwarf: {
        key: 'dwarf', icon: '⛏️', name: "Nain de chantier", short: 'Nain',
        effects: ["DEF +12 % (au moins +1)", "Armure portée +15 %"], flaw: "Fuite −15 pts",
        when: s => originHasEquipped(s, 'armor'),
        why: () => "Proposé car vous portez une armure."
    },
    roach: {
        key: 'roach', icon: '🪳', name: "Cafard mutant", short: 'Cafard',
        effects: ["Increvable : 1 fois par étage, un coup mortel laisse 1 PV (jamais contre un boss)"], flaw: "PV max −15 %",
        when: s => originNum(s, 'flees') >= 1 || originNum(s, 'clutchWins') >= 1,
        why: s => originNum(s, 'clutchWins') >= 1
            ? "Proposé car vous avez survécu à un cheveu."
            : "Proposé car vous avez déjà détalé devant un monstre."
    }
};

// Classes. `playable(state)` : le crawler possède de quoi s'en servir (arme, arme à distance ou sort, équipé ou en réserve) ;
// Bagarreur, Filou et Sac de frappe le sont toujours. Une classe dont la condition est remplie est proposée même injouable.
const ORIGIN_CLASSES = {
    brawler: {
        key: 'brawler', icon: '🥊', name: "Bagarreur", abilityName: 'Uppercut du dimanche',
        ability: "Uppercut du dimanche : mains nues ×2 + étourdit 1 tour", style: "Mains nues +15 %",
        when: s => originNum(s, 'unarmedKills') >= 3,
        why: s => `Proposé car vous avez assommé ${originNum(s, 'unarmedKills')} monstres à mains nues.`,
        playable: () => true
    },
    duelist: {
        key: 'duelist', icon: '⚔️', name: "Duelliste", abilityName: 'Fendre',
        ability: "Fendre : ×1,8, ignore 50 % de la DEF", style: "Arme +10 %",
        when: s => originSkillLevel(s, 'weapon') >= 3,
        why: s => `Proposé car votre compétence Arme est au niveau ${originSkillLevel(s, 'weapon')}.`,
        playable: s => originHasEquipped(s, 'weapon') || originHasInBag(s, 'weapons')
    },
    gunslinger: {
        key: 'gunslinger', icon: '🏹', name: "Franc-tireur", abilityName: 'Tir de barrage',
        ability: "Tir de barrage : 2 tirs à ×0,8, à toute distance", style: "Tir +10 %",
        when: s => originNum(s, 'rangedKills') >= 3,
        why: s => `Proposé car vous avez abattu ${originNum(s, 'rangedKills')} monstres à distance.`,
        playable: s => originHasEquipped(s, 'ranged') || originHasInBag(s, 'ranged')
    },
    occultist: {
        key: 'occultist', icon: '🔮', name: "Occultiste de foire", abilityName: 'Surcharge',
        ability: "Surcharge : prochain sort gratuit, ×1,6, sans backfire", style: "Coût en mana −10 %",
        when: s => originNum(s, 'spellKills') >= 2,
        why: s => `Proposé car vous avez achevé ${originNum(s, 'spellKills')} monstres au sort.`,
        playable: s => originHasEquipped(s, 'spell') || (Array.isArray(s && s.spellbook) && s.spellbook.length > 0)
    },
    trickster: {
        key: 'trickster', icon: '🎭', name: "Filou", abilityName: 'Disparition',
        ability: "Disparition : prochaine riposte esquivée + prochaine attaque ×2", style: "Furtivité +1 niveau",
        when: s => originNum(s, 'sneakKills') >= 1 || originNum(s, 'flees') >= 2,
        why: s => originNum(s, 'sneakKills') >= 1
            ? "Proposé car vous avez frappé un monstre dans le dos."
            : `Proposé car vous avez pris la fuite ${originNum(s, 'flees')} fois.`,
        playable: () => true
    },
    punchingBag: {
        key: 'punchingBag', icon: '🛡️', name: "Sac de frappe", abilityName: 'Encaisser',
        ability: "Encaisser : DEF ×2 sur la riposte, renvoie 50 % des dégâts reçus", style: "PV max +10 %",
        when: s => originNum(s, 'damageTaken') >= 150,
        why: s => `Proposé car vous avez encaissé ${originNum(s, 'damageTaken')} points de dégâts.`,
        playable: () => true
    }
};

// Synergies race × classe (effet mécanique codé au lot 3, titre sarcastique affiché sur la fiche d'origine).
const ORIGIN_SYNERGIES = [
    { race: 'troll', cls: 'brawler', title: "Cadre supérieur du pugilat", effect: "Uppercut étourdit 2 tours (non-boss) ; contre un boss, applique « exposé » (DEF ×0,7 un coup)" },
    { race: 'elf', cls: 'occultist', title: "Archimage de salon", effect: "Surcharge ×1,8 (au lieu de ×1,6) et rend 20 mana" },
    { race: 'goblin', cls: 'trickster', title: "Roi des caniveaux", effect: "Disparition esquive 2 ripostes au lieu d'une" },
    { race: 'dwarf', cls: 'punchingBag', title: "Forteresse sur pattes", effect: "Encaisser renvoie 75 % au lieu de 50 %" }
];

function originSynergyFor(raceKey, classKey) {
    return ORIGIN_SYNERGIES.find(s => s.race === raceKey && s.cls === classKey) || null;
}

function originCatalog(kind) {
    return kind === 'race' ? ORIGIN_RACES : kind === 'class' ? ORIGIN_CLASSES : null;
}

function originShuffle(rng, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const ORIGIN_FILLER_REASON = "Tiré au hasard : le Donjon n'a rien trouvé de plus adapté à votre style de jeu.";

// Les 3 cartes d'un écran de choix (`kind` : 'race' | 'class'). Règle validée (rounds 4 et 5) : « conditions remplies d'abord » —
// jusqu'à 3 origines dont la condition est remplie (tirées au hasard s'il y en a plus de 3), complétées au hasard parmi les autres ;
// pour les classes, le remplissage ne propose que des classes JOUABLES (si elles manquent, les injouables comblent, pour toujours
// 3 cartes). Renvoie [{ key, kind, reason, conditionMet }] ; `rng` injectable (pure, ne modifie pas `state`).
function pickOriginOffers(kind, state, rng = Math.random) {
    const catalog = originCatalog(kind);
    if (!catalog) return [];
    const all = Object.values(catalog);
    const met = originShuffle(rng, all.filter(o => o.when(state)));
    const chosen = met.slice(0, ORIGIN_OFFER_COUNT).map(o => ({ key: o.key, kind, reason: o.why(state), conditionMet: true }));
    if (chosen.length < ORIGIN_OFFER_COUNT) {
        const rest = all.filter(o => !chosen.some(c => c.key === o.key));
        const playable = kind === 'class' ? rest.filter(o => o.playable(state)) : rest;
        const unplayable = kind === 'class' ? rest.filter(o => !o.playable(state)) : [];
        const fillers = originShuffle(rng, playable).concat(originShuffle(rng, unplayable));
        fillers.slice(0, ORIGIN_OFFER_COUNT - chosen.length).forEach(o => chosen.push({ key: o.key, kind, reason: ORIGIN_FILLER_REASON, conditionMet: false }));
    }
    return chosen;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ORIGIN_OFFER_COUNT, ORIGIN_RACES, ORIGIN_CLASSES, ORIGIN_SYNERGIES, ORIGIN_FILLER_REASON, originSynergyFor, pickOriginOffers };
}
