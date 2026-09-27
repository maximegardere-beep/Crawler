// combat-scene.js — scène de combat en vue latérale (scene.js/sprites.js) : conversion distance ->
// abscisse, bornes de la scène, absence de chevauchement au contact, rafraîchissement dans la même
// tick que tout changement d'écart, et couverture du bestiaire par les silhouettes.
const { assert, resetTransientState } = require('./_helpers.js');

function mobX() {
    const m = /translate\(([-\d.]+)px/.exec(document.getElementById('scene-mob').style.transform || '');
    return m ? parseFloat(m[1]) : NaN;
}

// ===================================================================
// distanceToX() : linéaire, strictement décroissante, bornée, jamais de chevauchement.
// ===================================================================
{
    const max = config.rangedCombat.maxDistance;
    assert(distanceToX(0, max) === MOB_X_CONTACT, "distanceToX(0) : le mob est à sa position de contact");
    assert(distanceToX(max, max) === MOB_X_FAR, "distanceToX(max) : le mob est à sa position la plus lointaine");
    let strictlyDecreasing = true;
    for (let d = 1; d <= max; d++) {
        if (!(distanceToX(d, max) < distanceToX(d - 1, max))) strictlyDecreasing = false;
    }
    assert(strictlyDecreasing, "distanceToX() : chaque unité d'écart en plus éloigne le mob vers la gauche");
    const half = distanceToX(max / 2, max);
    assert(Math.abs(half - (MOB_X_CONTACT + MOB_X_FAR) / 2) < 1e-9, "distanceToX() : mapping linéaire (mi-distance = mi-parcours)");
    assert(distanceToX(-3, max) === MOB_X_CONTACT && distanceToX(max + 10, max) === MOB_X_FAR, "distanceToX() : valeurs hors plage bornées");
    assert(distanceToX(undefined, max) === MOB_X_CONTACT && distanceToX(NaN, max) === MOB_X_CONTACT, "distanceToX() : valeur invalide traitée comme le contact");
    assert(distanceToX(3, 0) === MOB_X_FAR, "distanceToX() : maxDistance nul ne divise jamais par zéro");

    assert(MOB_X_CONTACT + MOB_EXTENT < CRAWLER_X - CRAWLER_FRONT_EXTENT, "Contact : la silhouette du mob s'arrête avant celle du crawler (aucun chevauchement)");
    assert(MOB_X_FAR - MOB_EXTENT >= 0, "Écart maximal : le mob reste entièrement dans la scène à gauche");
    assert(COMPANION_X + COMPANION_EXTENT <= SCENE_WIDTH, "Le compagnon reste entièrement dans la scène à droite");
}

// ===================================================================
// Rendu : le mob se déplace dans la MÊME tick que tout changement d'écart (setCombatDistance()
// appelle updateUI()), sans attendre une riposte différée.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.currentEnemy = { name: "Boucher Sans Visage", hp: 300, maxHp: 300, atk: 20, def: 10, status: {} };
    gameState.combatDistance = 0;
    updateUI();
    assert(mobX() === MOB_X_CONTACT, "Écart nul : le mob est dessiné à sa position de contact");

    const originalRandom = Math.random;
    let idx = 0;
    const seq = [0.999, 0.999, 0]; // dés du joueur au plus haut, dé du mob au plus bas -> le recul réussit
    Math.random = () => seq[(idx++) % seq.length];
    attemptRetreat();
    Math.random = originalRandom;

    assert(gameState.combatDistance > 0, "attemptRetreat() réussi : l'écart s'est rouvert");
    assert(mobX() === distanceToX(gameState.combatDistance, config.rangedCombat.maxDistance), "attemptRetreat() : le mob est redessiné à sa nouvelle position dans la même tick");
}
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.level = 1;
    gameState.equipment.ranged = { name: "Fronde d'Essai", baseDmg: 4 };
    gameState.currentEnemy = { name: "Boucher Sans Visage", hp: 300, maxHp: 300, atk: 20, def: 10, status: {}, ranged: true };
    gameState.combatDistance = 4;
    updateUI();
    const before = mobX();
    attackRanged();
    assert(mobX() === before, "attackRanged() ne déplace pas le mob (seuls S'approcher/S'éloigner/Charger changent l'écart)");
}

// ===================================================================
// Silhouettes : chaque visualArchetype du bestiaire a sa silhouette ; un mob sans archétype connu
// retombe sur une silhouette par défaut au lieu de ne rien afficher.
// ===================================================================
{
    const archetypes = new Set();
    baseMobs.forEach(m => archetypes.add(m.visualArchetype));
    Object.values(districtBosses).forEach(b => archetypes.add(b.visualArchetype));
    const missing = [...archetypes].filter(k => !SCENE_MOB_SPRITES[k]);
    assert(missing.length === 0, `Chaque visualArchetype du bestiaire a une silhouette (manquantes : ${missing.join(', ')})`);

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Inconnu", hp: 10, maxHp: 10, atk: 1, def: 1, status: {}, visualArchetype: "inexistant" };
    updateUI();
    assert(document.getElementById('scene-mob').innerHTML.includes('mf-base'), "Archétype inconnu : une silhouette par défaut est quand même dessinée");
}

// ===================================================================
// Barres de vie (nom + PV actuels/max) au-dessus de la scène et distance affichée dessous.
// ===================================================================
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.hp = 40;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 15, maxHp: 60, atk: 5, def: 2, status: {} };
    gameState.combatDistance = 3;
    updateUI();
    const el = id => document.getElementById(id);
    assert(el('combat-enemy-hp-text').innerText === 'PV 15/60', "Barre ennemie : PV actuels/max affichés");
    assert(el('combat-enemy-hp-bar').style.width === '25%', "Barre ennemie : largeur proportionnelle aux PV restants");
    assert(el('combat-player-hp-text').innerText === `PV 40/${Math.round(gameState.maxHp)}`, "Barre joueur : PV actuels/max affichés");
    assert(el('enemy-name').innerText === 'Rat Goulot', "Barre ennemie : nom du mob affiché");
    assert(el('combat-distance-label').innerText === `Distance 3/${config.rangedCombat.maxDistance}`, "Distance affichée sous la scène");

    gameState.currentEnemy.hp = -4; // un coup de grâce peut faire passer les PV sous zéro
    gameState.combatDistance = 0;
    updateUI();
    assert(el('combat-enemy-hp-text').innerText === 'PV 0/60' && el('combat-enemy-hp-bar').style.width === '0%', "Barre ennemie : jamais de PV négatifs affichés");
    assert(el('combat-distance-label').innerText.includes('au contact'), "Distance 0 : indiquée comme contact");
}

// ===================================================================
// Journal court de combat : dernières lignes seulement, remis à zéro à chaque nouvel ennemi ; infos
// du mob sous la scène (plus dans la carte d'exploration, masquée en combat).
// ===================================================================
{
    const shortLog = document.getElementById('combat-last-action');
    const lines = () => shortLog.children.map(c => c.innerText);

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    ['a', 'b', 'c', 'd', 'e'].forEach(m => logEvent(m));
    assert(lines().join(',') === 'c,d,e', "Journal court : seules les 3 dernières lignes sont gardées, la plus récente en dernier");

    gameState.currentEnemy = { name: "Autre Mob", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    logEvent('nouveau combat');
    assert(lines().join(',') === 'nouveau combat', "Journal court : un nouvel ennemi repart d'un journal vide");

    gameState.inCombat = false;
    logEvent('hors combat');
    assert(!lines().includes('hors combat'), "Journal court : les messages hors combat n'y vont pas");

    const cardBefore = document.getElementById('card-body').innerHTML;
    gameState.inCombat = true;
    renderCombatMobPanel();
    assert(document.getElementById('combat-mob-info').innerHTML.includes('Examiner'), "Infos du mob (et bouton Examiner) affichées sous la scène");
    assert(document.getElementById('card-body').innerHTML === cardBefore, "renderCombatMobPanel() ne touche plus la carte d'exploration");
}

// ===================================================================
// Bandes de portée : contiguës, dans la scène, chacune contenant les positions du mob qu'elle couvre ;
// la bande où se trouve le mob est renforcée.
// ===================================================================
{
    const max = config.rangedCombat.maxDistance;
    const bands = computeRangeBands(max);
    const inside = (b, x) => x >= b.x1 && x <= b.x2;
    assert(bands.ranged.x2 === bands.contact.x1, "Bandes de portée contiguës (aucun trou ni recouvrement)");
    assert(bands.ranged.x1 >= 0 && bands.contact.x2 <= SCENE_WIDTH, "Bandes de portée entièrement dans la scène");
    assert(bands.contact.x2 <= CRAWLER_X - CRAWLER_FRONT_EXTENT, "La bande de contact s'arrête à l'avant du crawler");
    assert(inside(bands.contact, distanceToX(0, max)) && !inside(bands.contact, distanceToX(1, max)), "Bande de contact : couvre l'écart nul, et lui seul");
    let rangedCovers = true;
    for (let d = 1; d <= max; d++) if (!inside(bands.ranged, distanceToX(d, max))) rangedCovers = false;
    assert(rangedCovers, "Bande de tir : couvre toutes les positions à écart > 0");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    const contact = document.getElementById('scene-band-contact').classList;
    const ranged = document.getElementById('scene-band-ranged').classList;
    gameState.combatDistance = 0;
    updateUI();
    assert(contact.contains('is-active') && !ranged.contains('is-active'), "Écart nul : la bande de contact est renforcée");
    gameState.combatDistance = 5;
    updateUI();
    assert(!contact.contains('is-active') && ranged.contains('is-active'), "Écart > 0 : la bande de tir est renforcée");
}

// ===================================================================
// Décors (backdrops.js + composeBackdrop()) : fiches valides, rendu sans valeur manquante, repli sur
// le décor par défaut, redessin uniquement quand la clé de décor change.
// ===================================================================
function backdropProblems(key, def) {
    const problems = [];
    ['wall', 'wallAlt', 'mortar', 'ceiling', 'floor', 'floorAlt', 'joint'].forEach(c => {
        if (!def.palette || typeof def.palette[c] !== 'string') problems.push(`${key}: couleur ${c} manquante`);
    });
    if (!BACKDROP_WALL_PATTERNS[def.wall]) problems.push(`${key}: motif de mur inconnu (${def.wall})`);
    if (!BACKDROP_FLOOR_PATTERNS[def.floor]) problems.push(`${key}: motif de sol inconnu (${def.floor})`);
    if (!BACKDROP_CEILINGS[def.ceiling]) problems.push(`${key}: plafond inconnu (${def.ceiling})`);
    [...(def.props || []), ...(def.floorProps || [])].forEach(prop => {
        if (!BACKDROP_PROPS[prop.type]) problems.push(`${key}: accessoire inconnu (${prop.type})`);
        if (!(prop.x >= 0 && prop.x <= BACKDROP_WIDTH && prop.y >= 0 && prop.y <= BACKDROP_HEIGHT)) problems.push(`${key}: accessoire ${prop.type} hors de la scène`);
    });
    (def.floorProps || []).forEach(prop => {
        if (prop.y < BACKDROP_GROUND_Y) problems.push(`${key}: accessoire au sol ${prop.type} placé au-dessus du sol`);
    });
    const markup = composeBackdrop(def, 'test');
    if (/undefined|NaN/.test(markup)) problems.push(`${key}: rendu avec une valeur manquante (undefined/NaN)`);
    ['class="bd-back"', 'class="bd-mid"', 'class="bd-front"', 'id="test-wall"', 'id="test-floor"'].forEach(part => {
        if (!markup.includes(part)) problems.push(`${key}: rendu incomplet (${part} absent)`);
    });
    return problems;
}
{
    assert(SCENE_WIDTH === BACKDROP_WIDTH && SCENE_GROUND_Y === BACKDROP_GROUND_Y, "Décor et scène partagent la même géométrie (largeur, ligne de sol)");

    const problems = [];
    Object.keys(SCENE_BACKDROPS).forEach(key => problems.push(...backdropProblems(key, SCENE_BACKDROPS[key])));
    assert(problems.length === 0, `Toutes les fiches de décor sont valides (${problems.join(' ; ')})`);

    // Chaque brique de la bibliothèque se rend seule, avec ses options par défaut.
    const palette = SCENE_BACKDROPS.default.palette;
    const libProblems = [];
    Object.keys(BACKDROP_WALL_PATTERNS).forEach(k => { if (/undefined|NaN/.test(BACKDROP_WALL_PATTERNS[k]('x', palette))) libProblems.push(`mur ${k}`); });
    Object.keys(BACKDROP_FLOOR_PATTERNS).forEach(k => { if (/undefined|NaN/.test(BACKDROP_FLOOR_PATTERNS[k]('x', palette))) libProblems.push(`sol ${k}`); });
    Object.keys(BACKDROP_CEILINGS).forEach(k => { if (/undefined|NaN/.test(BACKDROP_CEILINGS[k](palette))) libProblems.push(`plafond ${k}`); });
    Object.keys(BACKDROP_PROPS).forEach(k => { if (/undefined|NaN/.test(BACKDROP_PROPS[k].markup({ type: k }, palette))) libProblems.push(`accessoire ${k}`); });
    assert(libProblems.length === 0, `Chaque motif/plafond/accessoire se rend avec ses options par défaut (${libProblems.join(', ')})`);

    const defaultMarkup = composeBackdrop(SCENE_BACKDROPS.default, 'cbd');
    assert((defaultMarkup.match(/class="bd-flame"/g) || []).length === 2 && (defaultMarkup.match(/bd-halo-flicker/g) || []).length === 4, "Décor par défaut : deux torches animées, chacune avec un halo au mur et au sol");

    assert(resolveBackdropKey('Quartier Inexistant') === 'default' && resolveBackdropKey(undefined) === 'default' && resolveBackdropKey('constructor') === 'default', "Quartier inconnu (ou absent) : décor par défaut");

    resetTransientState();
    delete lastBackdropKeys.cbd;
    const savedDistrict = gameState.currentDistrict;
    gameState.inCombat = true;
    gameState.currentDistrict = 'Quartier Inexistant';
    gameState.currentEnemy = { name: "Rat Goulot", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    updateUI();
    const backdrop = document.getElementById('scene-backdrop');
    assert(backdrop.innerHTML === defaultMarkup, "Combat dans un quartier inconnu : la scène affiche le décor par défaut");
    backdrop.innerHTML = 'SENTINELLE';
    updateUI();
    assert(backdrop.innerHTML === 'SENTINELLE', "Le décor n'est pas redessiné à chaque updateUI() si le quartier n'a pas changé");

    const fake = { innerHTML: '' };
    assert(renderSceneBackdrop(fake, 'essai', 'default') === true && renderSceneBackdrop(fake, 'essai', 'default') === false, "renderSceneBackdrop() : un seul dessin tant que la clé ne change pas");
    delete lastBackdropKeys.cbd;
    gameState.currentDistrict = savedDistrict;
}

// ===================================================================
// Un décor par quartier : chaque quartier de districts.js (aussi thème des étages urbains) a sa fiche,
// avec 3 accessoires signature au moins (types distincts) et une source de lumière — un futur quartier
// ajouté sans décor fait échouer ce test au lieu de tomber silencieusement sur le décor par défaut.
// ===================================================================
{
    const missing = Object.keys(districts).filter(name => !Object.prototype.hasOwnProperty.call(SCENE_BACKDROPS, name));
    assert(missing.length === 0, `Chaque quartier de districts.js a son décor (manquants : ${missing.join(', ')})`);
    const orphans = Object.keys(SCENE_BACKDROPS).filter(key => key !== 'default' && !districts[key]);
    assert(orphans.length === 0, `Chaque fiche de décor correspond à un quartier existant (orphelines : ${orphans.join(', ')})`);

    const weak = [];
    Object.keys(districts).forEach(name => {
        const def = SCENE_BACKDROPS[name];
        if (!def) return;
        const all = [...(def.props || []), ...(def.floorProps || [])];
        const types = new Set(all.map(prop => prop.type));
        const lit = all.some(prop => BACKDROP_PROPS[prop.type] && BACKDROP_PROPS[prop.type].light(prop));
        if (types.size < 3) weak.push(`${name}: ${types.size} type(s) d'accessoire`);
        if (!lit) weak.push(`${name}: aucune source de lumière`);
        if (resolveBackdropKey(name) !== name) weak.push(`${name}: la fiche n'est pas sélectionnée`);
    });
    assert(weak.length === 0, `Décors de quartier complets (${weak.join(' ; ')})`);

    const distinctWalls = new Set(Object.keys(districts).map(name => SCENE_BACKDROPS[name] && `${SCENE_BACKDROPS[name].wall}|${SCENE_BACKDROPS[name].palette.wall}`));
    assert(distinctWalls.size === Object.keys(districts).length, "Deux quartiers ne partagent jamais le même mur (motif + couleur)");
}

// ===================================================================
// renderScene(mode) : scène des villes spécialisées (#shop-zone). Décor du quartier courant, crawler à
// droite, mise en scène du rôle à gauche (enseigne + comptoir + marchand, ou tableau + professeur), sans
// barres de vie ni bandes de portée ; redessinée seulement quand le rôle ou la spécialité change.
// ===================================================================
{
    resetTransientState();
    const saved = { urbanMap: gameState.urbanMap, district: gameState.currentDistrict };
    const setpiece = document.getElementById('shop-scene-setpiece');
    const shopBackdrop = document.getElementById('shop-scene-backdrop');
    const cities = {
        m: { id: 'm', name: 'Échoppe', role: 'merchant', specialty: 'armors', stock: [] },
        t: { id: 't', name: 'École', role: 'trainer', specialty: 'stealth' }
    };
    gameState.urbanMap = { citiesById: cities };
    gameState.currentDistrict = Object.keys(districts)[0];
    delete lastBackdropKeys.sbd;
    lastShopSetpieceKey = null;

    gameState.pendingShopCityId = 'm';
    updateShopUI();
    const merchantMarkup = setpiece.innerHTML;
    assert(merchantMarkup.includes('ARMURES') && merchantMarkup.includes(SHOP_SIGN_STYLES.armors.color), "Scène marchand : enseigne néon de sa spécialité (libellé + couleur), posée par updateShopUI()");
    assert(merchantMarkup.includes(SCENE_MERCHANT_SVG) && merchantMarkup.includes('data-role="merchant"'), "Scène marchand : PNJ marchand derrière le comptoir");
    assert(merchantMarkup.indexOf(SCENE_MERCHANT_SVG) < merchantMarkup.lastIndexOf('<g transform="translate(96 124)">'), "Scène marchand : le comptoir est dessiné devant le PNJ");
    assert(shopBackdrop.innerHTML === composeBackdrop(SCENE_BACKDROPS[gameState.currentDistrict], 'sbd'), "Scène marchand : décor du quartier courant en fond, identifiants préfixés 'sbd' (jamais ceux de la scène de combat)");
    assert(document.getElementById('shop-scene-crawler').innerHTML.includes(SCENE_CRAWLER_SVG), "Scène marchand : le crawler est présent");
    assert(!/scene-band|combat-(enemy|player)-hp/.test(merchantMarkup + shopBackdrop.innerHTML), "Scène marchand : ni bande de portée ni barre de vie");

    setpiece.innerHTML = 'SENTINELLE';
    renderScene('merchant');
    assert(setpiece.innerHTML === 'SENTINELLE', "Scène marchand : pas de redessin tant que rôle et spécialité ne changent pas");

    const signColors = new Set(Object.keys(SHOP_SIGN_STYLES).map(k => SHOP_SIGN_STYLES[k].color));
    const signLabels = new Set(Object.keys(SHOP_SIGN_STYLES).map(k => SHOP_SIGN_STYLES[k].label));
    const signIcons = new Set(Object.keys(SHOP_SIGN_STYLES).map(k => SHOP_SIGN_STYLES[k].icon));
    const shopCategories = Object.keys(SHOP_CATEGORY_LABELS);
    assert(shopCategories.every(k => SHOP_SIGN_STYLES[k]) && signColors.size === shopCategories.length && signLabels.size === shopCategories.length && signIcons.size === shopCategories.length,
        "Chaque spécialité de marchand a son enseigne, avec icône, libellé et couleur distincts");
    const signMarkups = shopCategories.map(k => composeShopSetpiece('merchant', k, 'x'));
    assert(signMarkups.every((m, i) => m.includes(SHOP_SIGN_STYLES[shopCategories[i]].label) && !/undefined|NaN/.test(m)), "Chaque enseigne de marchand se rend sans valeur manquante");

    gameState.pendingShopCityId = 't';
    updateShopUI();
    const trainerMarkup = setpiece.innerHTML;
    assert(trainerMarkup.includes('FURTIVITÉ') && trainerMarkup.includes(SCENE_TRAINER_SVG) && trainerMarkup.includes('#1c2621'), "Scène professeur : PNJ devant un tableau noir marqué de sa compétence");
    assert(!trainerMarkup.includes(SCENE_MERCHANT_SVG), "Scène professeur : le marchand a disparu (redessin au changement de rôle)");
    const skills = Object.keys(gameState.skills);
    assert(skills.every(k => TRAINER_BOARD_STYLES[k]) && new Set(skills.map(k => TRAINER_BOARD_STYLES[k].label)).size === skills.length,
        "Chaque compétence formable a son tableau, avec un libellé distinct");
    assert(!/undefined|NaN/.test(composeShopSetpiece('trainer', 'inconnue', 'x') + composeShopSetpiece('merchant', 'inconnue', 'x')), "Spécialité inconnue : repli sur un style existant, sans valeur manquante");

    const combatBackdrop = document.getElementById('scene-backdrop').innerHTML;
    renderScene('safehouse');
    renderScene('mode-inconnu');
    assert(setpiece.innerHTML === trainerMarkup && document.getElementById('scene-backdrop').innerHTML === combatBackdrop, "renderScene() : un mode sans scène ne touche à rien");

    gameState.urbanMap = saved.urbanMap;
    gameState.currentDistrict = saved.district;
    gameState.pendingShopCityId = null;
    delete lastBackdropKeys.sbd;
    lastShopSetpieceKey = null;
}
