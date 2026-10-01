// crawler-races.js — tests régression : chantier 13, lot 4 (aspect du crawler par race : corps humain teinté, corps dessinés par Vibe,
// extension avant variable, portraits des cartes de choix). Voir sprites/crawler-races.js, scene.js et NOTES_ORIGINES.md.
const { assert, resetTransientState } = require('./_helpers.js');

const HEX = /^#[0-9a-f]{6}$/i;
const REST = (race) => ({ race, posture: 'rest', weapon: null, ranged: null, armor: null, glow: null, ench: {} });
const POSTURES = Object.keys(CRAWLER_ARMS);

// --- Teintes du corps humain ---
{
    const raceKeys = Object.keys(ORIGIN_RACES).filter(k => k !== 'human');
    assert(raceKeys.every(k => CRAWLER_RACE_LOOKS[k] || CRAWLER_RACE_BODIES[k]), "Chaque race (hors Humain) a un aspect : teinte ou corps dessiné");
    assert(Object.keys(CRAWLER_RACE_LOOKS).every(k => ORIGIN_RACES[k] && k !== 'human'), "Aucune teinte pour une race inconnue, ni pour l'Humain (corps d'origine)");
    assert(Object.values(CRAWLER_RACE_LOOKS).every(l => HEX.test(l.skin) && HEX.test(l.hair)), "Chaque teinte donne une peau et des cheveux en hexadécimal");
    const skins = Object.values(CRAWLER_RACE_LOOKS).map(l => l.skin);
    assert(new Set(skins).size === skins.length && !skins.includes(CRAWLER_SKIN_BASE), "Les peaux sont toutes distinctes entre elles et de l'humain");
    assert(crawlerRaceLook('human') === null && crawlerRaceLook(null) === null && crawlerRaceLook('inconnue') === null, "Humain, aucune race ou race inconnue : pas de teinte");
    assert(tintCrawlerMarkup('<a fill="#c98a5e"/><b fill="#2f2318"/>', { skin: '#111111', hair: '#222222' }) === '<a fill="#111111"/><b fill="#222222"/>', "tintCrawlerMarkup() remplace peau et cheveux");
    assert(tintCrawlerMarkup('<a fill="#c98a5e"/>', null) === '<a fill="#c98a5e"/>', "Sans teinte : le fragment est inchangé");
}

// --- Composition du crawler ---
{
    const human = composeCrawler(REST(null));
    assert(composeCrawler(REST('human')) === human.replace('<g class="crawler" data-posture="rest">', '<g class="crawler" data-posture="rest" data-race="human">'), "Humain : le corps d'origine, sans aucune teinte");
    Object.entries(CRAWLER_RACE_LOOKS).forEach(([race, look]) => {
        POSTURES.forEach(posture => {
            const svg = composeCrawler(Object.assign(REST(race), { posture }));
            assert(svg.includes(`data-race="${race}"`) && svg.includes(look.skin) && svg.includes(look.hair), `${race}/${posture} : peau et cheveux de la race`);
            assert(!svg.includes(CRAWLER_SKIN_BASE) && !svg.includes(CRAWLER_HAIR_BASE), `${race}/${posture} : plus aucune couleur de l'humain (mains, tête, capuche)`);
            assert(!/\sid=|<defs|Gradient|<filter/i.test(svg), `${race}/${posture} : aucun id, defs, dégradé ni filtre`);
        });
    });
    // Une arme et une armure restent portées par un corps teinté.
    const armed = composeCrawler(Object.assign(REST('goblin'), { posture: 'weapon', weapon: Object.keys(ITEM_SPRITES).find(k => ITEM_SPRITES[k].kind === 'melee'), armor: Object.keys(ITEM_SPRITES).find(k => ITEM_SPRITES[k].kind === 'armor') }));
    assert(armed.includes('crawler-held') && armed.includes('crawler-armor'), "Corps teinté : l'arme tenue et l'armure sont dessinées");
    // La clé de redessin change avec la race.
    const k = (race) => crawlerLoadoutKey(Object.assign({ posture: 'rest', ench: {} }, { race }));
    assert(k('goblin') !== k('troll') && k('goblin') !== k(null), "La clé de redessin dépend de la race");
    resetTransientState();
    applyRace('elf');
    assert(crawlerLoadout().race === 'elf' && currentCrawler().markup.includes(CRAWLER_RACE_LOOKS.elf.skin), "Le crawler courant suit la race choisie");
    gameState.race = null;
    assert(crawlerLoadout().race === null && !currentCrawler().markup.includes(CRAWLER_RACE_LOOKS.elf.skin), "Sans race : le corps d'origine");
    resetTransientState();
}

// --- Validation des corps DESSINÉS (livrés par Vibe) : s'applique à chaque entrée de CRAWLER_RACE_BODIES, aujourd'hui aucune ---
{
    Object.entries(CRAWLER_RACE_BODIES).forEach(([race, body]) => {
        assert(!!ORIGIN_RACES[race], `Corps ${race} : une race existante`);
        assert(['base', 'torso', 'head'].every(p => typeof body.parts[p] === 'string' && body.parts[p].length > 20), `Corps ${race} : trois couches (base, torse, tête)`);
        assert(POSTURES.every(p => body.arms && body.arms[p] && Array.isArray(body.arms[p].hand) && body.arms[p].hand.length === 2 && body.arms[p].hand.every(Number.isFinite) && typeof body.arms[p].arm === 'string'), `Corps ${race} : un bras et un point de prise pour chacune des ${POSTURES.length} postures`);
        assert(body.frontExtent >= 12 && body.frontExtent <= 19, `Corps ${race} : extension avant dans la marge 12-19 (${body.frontExtent})`);
        const all = Object.values(body.parts).join('') + Object.values(body.arms).map(a => (a.arm || '') + (a.after || '') + (a.front || '')).join('') + (body.corpse || '');
        assert(!/\sid=|<defs|Gradient|<filter/i.test(all), `Corps ${race} : aucun id, defs, dégradé ni filtre`);
        assert(body.parts.base.includes('scene-ground-shadow'), `Corps ${race} : l'ombre au sol est dans la couche de base`);
        const svg = composeCrawler(REST(race));
        assert(svg.includes(body.parts.head) && svg.includes(body.parts.torso), `Corps ${race} : composeCrawler() utilise ses couches`);
    });
    assert(true, "(aucun corps dessiné livré : la validation s'appliquera à chaque entrée ajoutée)");
}

// --- Extension avant variable (gabarit légèrement varié) ---
{
    const max = config.rangedCombat.maxDistance;
    const sansCorps = Object.keys(CRAWLER_RACE_LOOKS).filter(r => !CRAWLER_RACE_BODIES[r]);
    assert(crawlerFrontExtent(null) === CRAWLER_FRONT_EXTENT && crawlerFrontExtent('race-inconnue') === CRAWLER_FRONT_EXTENT && sansCorps.every(r => crawlerFrontExtent(r) === CRAWLER_FRONT_EXTENT), "Sans corps dessiné : extension commune");
    assert(crawlerFrontExtent('goblin') === CRAWLER_RACE_BODIES.goblin.frontExtent, "Gobelin : extension du corps dessiné lue par crawlerFrontExtent()");
    assert(distanceToX(0, max) === MOB_X_CONTACT && distanceToX(0, max, CRAWLER_FRONT_EXTENT) === MOB_X_CONTACT, "Extension commune : position de contact inchangée");
    [12, 15, 19].forEach(ext => {
        assert(Math.abs(mobContactX(ext) - distanceToX(0, max, ext)) < 1e-9, `Extension ${ext} : distanceToX(0) = position de contact`);
        assert(distanceToX(0, max, ext) + MOB_EXTENT + CONTACT_GAP <= CRAWLER_X - ext + 1e-9, `Extension ${ext} : aucun chevauchement au contact`);
        const bands = computeRangeBands(max, ext);
        assert(bands.contact.x2 === CRAWLER_X - ext && bands.contact.x1 > bands.ranged.x1 && bands.ranged.x2 === bands.contact.x1, `Extension ${ext} : bandes de portée cohérentes`);
        assert(distanceToX(max, max, ext) === MOB_X_FAR, `Extension ${ext} : l'écart maximal garde le mob à la même place`);
    });
    assert(distanceToX(0, max, 19) < distanceToX(0, max, 12), "Un crawler plus avancé recule le point de contact du mob");
    // Un corps de test enregistré temporairement : la scène lit son extension.
    CRAWLER_RACE_BODIES.troll = { parts: { base: '<ellipse class="scene-ground-shadow"/>', torso: '<g/>', head: '<g/>' }, arms: {}, frontExtent: 19 };
    try {
        resetTransientState(); applyRace('troll');
        assert(crawlerFrontExtent() === 19 && distanceToX(0, max, crawlerFrontExtent()) === mobContactX(19), "La scène lit l'extension du corps de la race courante");
        assert(composeCrawler(REST('troll')).includes('<ellipse class="scene-ground-shadow"/>'), "Un corps dessiné remplace les couches du corps humain");
        assert(crawlerRaceLook('troll') === null, "Un corps dessiné n'est jamais teinté (sauf `tint` explicite)");
    } finally { delete CRAWLER_RACE_BODIES.troll; resetTransientState(); }
    assert(crawlerFrontExtent('troll') === CRAWLER_FRONT_EXTENT, "(contrôle) le corps de test a bien été retiré");
}

// --- Portraits, cartes de choix et cadavre ---
{
    Object.keys(ORIGIN_RACES).forEach(race => {
        const svg = buildRacePortraitSvg(race, 44);
        assert(svg.startsWith('<svg') && svg.includes('viewBox') && svg.includes('class="crawler"') && (race === 'human' || svg.includes(CRAWLER_RACE_LOOKS[race].skin)), `Portrait ${race} : un crawler à son aspect`);
    });
    resetTransientState(); gameState.saveEnabled = true;
    gameState.pendingOriginOffers = { kind: 'race', offers: [{ key: 'goblin', reason: 'x', conditionMet: true }, { key: 'troll', reason: 'y', conditionMet: true }, { key: 'human', reason: 'z', conditionMet: true }], selected: null };
    gameState.raceChoicePending = true;
    renderOriginChoice();
    assert((ui.raceChoiceCards.innerHTML.match(/class="origin-portrait"/g) || []).length === 3 && ui.raceChoiceCards.innerHTML.includes(CRAWLER_RACE_LOOKS.goblin.skin), "Chaque carte de race montre le portrait de la race");
    gameState.pendingOriginOffers = { kind: 'class', offers: [{ key: 'brawler', reason: 'x', conditionMet: true }, { key: 'duelist', reason: 'y', conditionMet: true }, { key: 'trickster', reason: 'z', conditionMet: true }], selected: null };
    gameState.raceChoicePending = false; gameState.classChoicePending = true;
    renderOriginChoice();
    assert(!ui.classChoiceCards.innerHTML.includes('origin-portrait'), "Une carte de classe n'a pas de portrait");
    resetTransientState(); applyRace('dwarf'); gameState.crawlerClass = 'brawler';
    assert(buildOriginSheetHtml().includes('origin-portrait') && buildOriginSheetHtml().includes(CRAWLER_RACE_LOOKS.dwarf.skin), "La fiche d'origine montre le portrait de la race");
    assert(crawlerCorpseMarkup('dwarf').includes(CRAWLER_RACE_LOOKS.dwarf.skin) && crawlerCorpseMarkup(null) === SCENE_CORPSE_TOPDOWN_SVG, "Cadavre du Game Over : teinté par la race, d'origine sans race");
    resetTransientState();
}
