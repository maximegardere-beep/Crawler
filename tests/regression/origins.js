// origins.js — tests régression : chantier 13, lot 0 (données pures des races et des classes, conditions de déblocage et tirage
// des 3 cartes de chaque écran de choix). Voir origins.js et CHANTIERS.md (chantier 13).
const { assert, resetTransientState } = require('./_helpers.js');

const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
// Hasard déterministe de qualité suffisante pour des centaines de tirages (LCG).
const lcg = (seed) => {
    let s = (Math.imul(seed + 1, 2654435761) >>> 0) || 1; // des graines consécutives donneraient des premiers tirages corrélés
    const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 5; i++) next();
    return next;
};
// État minimal lu par le catalogue (aucun accès au vrai gameState).
const mk = (over = {}) => Object.assign({
    runStats: createEmptyRunStats(),
    skills: { weapon: { level: 1 }, unarmed: { level: 1 }, magic: { level: 1 }, stealth: { level: 1 } },
    equipment: { weapon: null, ranged: null, armor: null, spell: null },
    inventory: [], spellbook: []
}, over);
const withStats = (stats, over = {}) => mk(Object.assign({ runStats: Object.assign(createEmptyRunStats(), stats) }, over));

// --- Catalogue ---
{
    const races = Object.values(ORIGIN_RACES), classes = Object.values(ORIGIN_CLASSES);
    assert(races.length === 7 && classes.length === 6, "Catalogue : 7 races et 6 classes");
    races.forEach(r => assert(r.key && r.icon && r.name && Array.isArray(r.effects) && r.effects.length > 0 && typeof r.when === 'function' && typeof r.why === 'function', `Race ${r.key} : clé, icône, nom, effets, condition et explication`));
    classes.forEach(c => assert(c.key && c.icon && c.name && c.ability && c.style && typeof c.when === 'function' && typeof c.why === 'function' && typeof c.playable === 'function', `Classe ${c.key} : clé, icône, nom, capacité, style, condition, explication et jouabilité`));
    assert(Object.entries(ORIGIN_RACES).every(([k, r]) => r.key === k) && Object.entries(ORIGIN_CLASSES).every(([k, c]) => c.key === k), "Chaque clé du catalogue est celle de son entrée");
    assert(races.filter(r => r.flaw).length === 6 && !ORIGIN_RACES.human.flaw, "Six races ont un défaut ; l'Humain n'en a aucun");
    assert(ORIGIN_RACES.human.basic === true && races.filter(r => r.basic).length === 1, "L'Humain est le seul choix de base");
    assert(ORIGIN_SYNERGIES.length === 4 && ORIGIN_SYNERGIES.every(s => ORIGIN_RACES[s.race] && ORIGIN_CLASSES[s.cls] && s.title && s.effect), "4 synergies, chacune entre une race et une classe existantes");
    assert(originSynergyFor('troll', 'brawler').title === "Cadre supérieur du pugilat" && originSynergyFor('troll', 'duelist') === null, "originSynergyFor() : trouve la synergie, null sinon");
    assert(pickOriginOffers('inconnu', mk()).length === 0, "Type de choix inconnu : aucune carte");
}

// --- Conditions de déblocage (valeurs seuils exactes) ---
{
    const R = (k, st, over) => ORIGIN_RACES[k].when(withStats(st, over));
    const C = (k, st, over) => ORIGIN_CLASSES[k].when(withStats(st, over));
    assert(R('human', {}), "Humain : toujours éligible");
    assert(!R('ghoul', {}) && R('ghoul', { clutchWins: 1 }) && !R('ghoul', { damageTaken: 99 }) && R('ghoul', { damageTaken: 100 }), "Goule : clutchWins ≥ 1 ou damageTaken ≥ 100");
    assert(!R('goblin', {}) && R('goblin', { sneakKills: 1 }) && !R('goblin', { flees: 1 }) && R('goblin', { flees: 2 }), "Gobelin : sneakKills ≥ 1 ou flees ≥ 2");
    assert(!R('troll', { unarmedKills: 2 }) && R('troll', { unarmedKills: 3 }), "Troll : unarmedKills ≥ 3");
    assert(!R('elf', { spellKills: 1 }) && R('elf', { spellKills: 2 }) && R('elf', { spellsLearned: ['Éclair'] }), "Elfe : spellKills ≥ 2 ou un sort appris");
    assert(!R('dwarf', {}) && R('dwarf', {}, { equipment: { armor: { name: 'Armure' } } }), "Nain : une armure équipée");
    assert(!R('roach', {}) && R('roach', { flees: 1 }) && R('roach', { clutchWins: 1 }), "Cafard : flees ≥ 1 ou clutchWins ≥ 1");
    assert(!C('brawler', { unarmedKills: 2 }) && C('brawler', { unarmedKills: 3 }), "Bagarreur : unarmedKills ≥ 3");
    assert(!C('duelist', {}) && C('duelist', {}, { skills: { weapon: { level: 3 } } }), "Duelliste : compétence Arme ≥ 3");
    assert(!C('gunslinger', { rangedKills: 2 }) && C('gunslinger', { rangedKills: 3 }), "Franc-tireur : rangedKills ≥ 3");
    assert(!C('occultist', { spellKills: 1 }) && C('occultist', { spellKills: 2 }), "Occultiste : spellKills ≥ 2");
    assert(!C('trickster', {}) && C('trickster', { sneakKills: 1 }) && C('trickster', { flees: 2 }), "Filou : sneakKills ≥ 1 ou flees ≥ 2");
    assert(!C('punchingBag', { damageTaken: 149 }) && C('punchingBag', { damageTaken: 150 }), "Sac de frappe : damageTaken ≥ 150");
    // Un état vide ou partiel ne plante jamais.
    assert(Object.values(ORIGIN_RACES).every(r => { try { return r.when({}) !== undefined && typeof r.why({}) === 'string'; } catch (e) { return false; } }), "Races : un état vide ne plante pas");
    assert(Object.values(ORIGIN_CLASSES).every(c => { try { return c.when(undefined) === false || c.when(undefined) === true; } catch (e) { return false; } }), "Classes : un état absent ne plante pas");
}

// --- Jouabilité des classes ---
{
    const P = (k, over) => ORIGIN_CLASSES[k].playable(mk(over));
    assert(P('brawler') && P('trickster') && P('punchingBag'), "Bagarreur, Filou et Sac de frappe sont toujours jouables");
    assert(!P('duelist') && P('duelist', { equipment: { weapon: {} } }) && P('duelist', { inventory: [{ category: 'weapons' }] }), "Duelliste : arme équipée ou en réserve");
    assert(!P('gunslinger') && P('gunslinger', { equipment: { ranged: {} } }) && P('gunslinger', { inventory: [{ category: 'ranged' }] }), "Franc-tireur : arme à distance équipée ou en réserve");
    assert(!P('occultist') && P('occultist', { equipment: { spell: {} } }) && P('occultist', { spellbook: [{}] }), "Occultiste : sort équipé ou au grimoire");
    assert(!P('duelist', { inventory: [{ category: 'ranged' }, { category: 'armors' }] }), "Une arme à distance ou une armure ne rend pas le Duelliste jouable");
}

// --- Tirage des 3 cartes ---
{
    const kinds = ['race', 'class'];
    // Toujours 3 cartes distinctes, quel que soit l'état et le hasard.
    let bad = 0;
    for (let n = 0; n < 400; n++) {
        const rng = lcg(1000 + n);
        const stats = {};
        ['clutchWins', 'damageTaken', 'sneakKills', 'flees', 'unarmedKills', 'spellKills', 'rangedKills'].forEach(k => { stats[k] = Math.floor(rng() * 200) * (rng() < 0.5 ? 0 : 1); });
        const state = withStats(stats, { skills: { weapon: { level: 1 + Math.floor(rng() * 5) } }, equipment: { armor: rng() < 0.5 ? {} : null, weapon: rng() < 0.3 ? {} : null } });
        kinds.forEach(kind => {
            const offers = pickOriginOffers(kind, state, rng);
            const keys = offers.map(o => o.key);
            if (offers.length !== 3 || new Set(keys).size !== 3 || !keys.every(k => originCatalogHas(kind, k))) bad++;
        });
    }
    function originCatalogHas(kind, k) { return !!(kind === 'race' ? ORIGIN_RACES : ORIGIN_CLASSES)[k]; }
    assert(bad === 0, "Tirage : toujours 3 cartes distinctes du bon catalogue (800 tirages)");

    // Conditions remplies d'abord.
    const trollState = withStats({ unarmedKills: 4 });
    const o1 = pickOriginOffers('race', trollState, seq([0.5]));
    assert(o1.length === 3 && o1.filter(o => o.conditionMet).map(o => o.key).sort().join() === 'human,troll', "Races : Humain (base) et Troll (4 victoires à mains nues) d'abord");
    assert(o1.filter(o => !o.conditionMet).length === 1, "Races : le reste des cartes est complété au hasard");
    assert(o1.filter(o => o.conditionMet).every(o => o.reason && o.reason !== ORIGIN_FILLER_REASON), "Les cartes à condition remplie portent leur explication");
    assert(o1.find(o => o.key === 'troll').reason === "Proposé car vous avez assommé 4 monstres à mains nues.", "Explication du Troll : le nombre réel de victoires");
    assert(o1.filter(o => !o.conditionMet).every(o => o.reason === ORIGIN_FILLER_REASON), "Une carte de remplissage l'indique");

    // Plus de 3 conditions remplies : 3 cartes, toutes à condition remplie, tirées au hasard.
    const many = withStats({ clutchWins: 1, sneakKills: 1, unarmedKills: 3, spellKills: 2, flees: 2, damageTaken: 200 }, { equipment: { armor: {} } });
    const seen = new Set();
    for (let n = 0; n < 60; n++) {
        const offers = pickOriginOffers('race', many, lcg(n + 1));
        assert(offers.length === 3 && offers.every(o => o.conditionMet), "Beaucoup de conditions remplies : 3 cartes, toutes éligibles");
        offers.forEach(o => seen.add(o.key));
    }
    assert(seen.size >= 5, `Beaucoup de conditions remplies : toutes les races éligibles ressortent au fil des tirages (${seen.size})`);

    // Rien d'éligible sauf l'Humain.
    const fresh = pickOriginOffers('race', mk(), lcg(7));
    assert(fresh[0].key === 'human' && fresh[0].conditionMet && fresh.slice(1).every(o => !o.conditionMet), "Run vierge : l'Humain, puis deux races au hasard");

    // Classes : le remplissage ne propose que des classes jouables.
    let unplayableFiller = 0;
    for (let n = 0; n < 200; n++) {
        const state = mk(); // rien d'éligible, aucun matériel
        pickOriginOffers('class', state, lcg(n + 50)).forEach(o => { if (!o.conditionMet && !ORIGIN_CLASSES[o.key].playable(state)) unplayableFiller++; });
    }
    assert(unplayableFiller === 0, "Classes : le remplissage ne propose jamais une classe injouable quand assez de classes le sont");
    const noGear = pickOriginOffers('class', mk(), lcg(3));
    assert(noGear.map(o => o.key).sort().join() === 'brawler,punchingBag,trickster', "Sans matériel ni condition : exactement les trois classes toujours jouables");

    // Une classe dont la condition est remplie reste proposée même injouable.
    const gunNoGun = withStats({ rangedKills: 5 });
    assert(!ORIGIN_CLASSES.gunslinger.playable(gunNoGun) && pickOriginOffers('class', gunNoGun, lcg(9)).some(o => o.key === 'gunslinger' && o.conditionMet), "Condition remplie mais pas d'arme à distance : le Franc-tireur est proposé quand même");

    // Avec du matériel, les classes injouables liées au matériel restent possibles en remplissage.
    const armed = mk({ equipment: { weapon: {}, ranged: {}, spell: {} } });
    const got = new Set();
    for (let n = 0; n < 200; n++) pickOriginOffers('class', armed, lcg(n + 300)).forEach(o => got.add(o.key));
    assert(got.size === 6, `Avec du matériel, les six classes peuvent être proposées (${got.size})`);

    // Pureté : le tirage ne modifie pas l'état passé.
    const snapshot = JSON.stringify(trollState);
    pickOriginOffers('race', trollState, lcg(1)); pickOriginOffers('class', trollState, lcg(2));
    assert(JSON.stringify(trollState) === snapshot, "Le tirage ne modifie jamais l'état");
    // Déterminisme : même hasard, même résultat.
    assert(JSON.stringify(pickOriginOffers('class', trollState, lcg(11))) === JSON.stringify(pickOriginOffers('class', trollState, lcg(11))), "Même hasard injecté : même tirage");
}

// --- Chronique : compteur rangedKills (condition du Franc-tireur) ---
{
    resetTransientState();
    gameState.runStats = createEmptyRunStats();
    assert(gameState.runStats.rangedKills === 0, "Chronique : rangedKills démarre à 0");
    const foe = { name: 'Cobaye', hp: 0, runTrack: {} };
    recordRunEvent('win', { enemy: foe, kind: 'ranged' });
    recordRunEvent('win', { enemy: foe, kind: 'ranged' });
    recordRunEvent('win', { enemy: foe, kind: 'weapon' });
    recordRunEvent('win', { enemy: foe, kind: 'unarmed' });
    assert(gameState.runStats.rangedKills === 2 && gameState.runStats.unarmedKills === 1, "Chronique : seules les victoires à l'arme à distance comptent");
    assert(normalizeRunStats({ kills: 5 }).rangedKills === 0, "Une ancienne chronique reçoit rangedKills = 0");
    assert(ORIGIN_CLASSES.gunslinger.when({ runStats: gameState.runStats }) === false, "2 victoires à distance : le Franc-tireur n'est pas encore débloqué");
    recordRunEvent('win', { enemy: foe, kind: 'ranged' });
    assert(ORIGIN_CLASSES.gunslinger.when({ runStats: gameState.runStats }) === true, "3 victoires à distance : le Franc-tireur est débloqué");
    resetTransientState();
}
