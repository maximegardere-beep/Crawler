// combat-scene.js — scène de combat en vue latérale (scene.js/sprites/*.js) : conversion distance ->
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

    const lastLineBefore = document.getElementById('explore-last-line').innerText;
    gameState.inCombat = true;
    renderCombatMobPanel();
    assert(document.getElementById('combat-mob-info').innerHTML.includes('Examiner'), "Infos du mob (et bouton Examiner) affichées sous la scène");
    assert(document.getElementById('explore-last-line').innerText === lastLineBefore, "renderCombatMobPanel() ne touche pas la scène d'exploration");
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
    const saved = { floorMap: gameState.floorMap, district: gameState.currentDistrict };
    const setpiece = document.getElementById('shop-scene-setpiece');
    const shopBackdrop = document.getElementById('shop-scene-backdrop');
    const cities = {
        m: { id: 'm', name: 'Échoppe', role: 'merchant', specialty: 'armors', stock: [] },
        t: { id: 't', name: 'École', role: 'trainer', specialty: 'stealth' }
    };
    gameState.floorMap = { kind: 'urban', citiesById: cities, roomsById: {}, lairsById: {} };
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
    assert(document.getElementById('shop-scene-crawler').innerHTML.includes(currentCrawler().markup), "Scène marchand : le crawler est présent");
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

    gameState.floorMap = saved.floorMap;
    gameState.currentDistrict = saved.district;
    gameState.pendingShopCityId = null;
    delete lastBackdropKeys.sbd;
    lastShopSetpieceKey = null;
}

// ===================================================================
// renderScene('safehouse') : scène de salle sécurisée (#safehouse-choice-zone). Base commune (porte
// blindée, panneau « ZONE SÛRE ») + accessoire signature propre à CHAQUE type de safehouses.js, éclairage
// chaud et apaisé : aucun rouge, aucune animation rapide.
// ===================================================================
function isRedHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 0.3 || max === min || max !== r) return false;
    const saturation = (max - min) / max;
    const hue = 60 * (((g - b) / (max - min)) % 6);
    return saturation > 0.45 && (hue < 15 || hue > 340);
}
{
    assert(isRedHex('#c23b3b') && isRedHex('#ef4444') && !isRedHex('#f59e0b') && !isRedHex('#5a4028') && !isRedHex('#15803d'), "isRedHex() : détecte le rouge, pas l'orange des flammes ni le brun du bois");

    const problems = [];
    const missing = [];
    const reds = [];
    const fast = [];
    const signatureKeys = new Set();
    safehouseTypes.forEach(type => {
        const signature = SAFEHOUSE_SIGNATURES[type.name];
        if (!signature || signature.length === 0) { missing.push(type.name); return; }
        signatureKeys.add(signature.map(prop => prop.type).sort().join('+'));
        const def = safehouseBackdropFor(type.name);
        problems.push(...backdropProblems(type.name, def));
        const markup = composeBackdrop(def, 'hbd');
        signature.forEach(prop => {
            if (!markup.includes(BACKDROP_PROPS[prop.type].markup(prop, def.palette))) missing.push(`${type.name}: ${prop.type} absent du rendu`);
        });
        if (!markup.includes('ZONE SÛRE') || !def.props.some(prop => prop.type === 'armoredDoor')) missing.push(`${type.name}: base commune incomplète`);
        (markup.match(/#[0-9a-fA-F]{6}\b/g) || []).filter(isRedHex).forEach(c => reds.push(`${type.name}: ${c}`));
        (markup.match(/bd-(flame|halo-flicker|neon-flicker|blink|crackle|steam|spin)\b/g) || []).forEach(c => fast.push(`${type.name}: ${c}`));
    });
    assert(missing.length === 0, `Chaque type de salle sécurisée a son accessoire signature, en plus de la porte blindée et du panneau ZONE SÛRE (${missing.join(' ; ')})`);
    assert(problems.length === 0, `Fiches de salle sécurisée valides (${problems.join(' ; ')})`);
    assert(signatureKeys.size === safehouseTypes.length, "Deux types de salle sécurisée n'ont jamais les mêmes accessoires signature");
    assert(reds.length === 0, `Salles sécurisées : aucune couleur rouge (${reds.join(', ')})`);
    assert(fast.length === 0, `Salles sécurisées : seulement des animations lentes (${fast.join(', ')})`);
    const orphanSignatures = Object.keys(SAFEHOUSE_SIGNATURES).filter(name => !safehouseTypes.some(t => t.name === name));
    assert(orphanSignatures.length === 0, `Chaque signature correspond à un type de safehouses.js (orphelines : ${orphanSignatures.join(', ')})`);
    assert(safehouseBackdropFor('Type Inconnu').props.length === SAFEHOUSE_BACKDROP.props.length, "Type de salle inconnu : base commune seule");
    assert(!/bd-calm-glow/.test(Object.keys(SCENE_BACKDROPS).map(k => composeBackdrop(SCENE_BACKDROPS[k], 'cbd')).join('')), "Les halos apaisés n'apparaissent jamais dans les décors de combat");

    resetTransientState();
    const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'safe');
    assert(!!room, "Scène de salle sécurisée : l'étage courant contient une salle sécurisée");
    if (room) {
        const saved = { safehouse: room.safehouse, visited: room.visited };
        const sceneBackdrop = document.getElementById('safehouse-scene-backdrop');
        const combatBefore = document.getElementById('scene-backdrop').innerHTML;
        delete lastBackdropKeys.hbd;
        room.safehouse = safehouseTypes[4];
        enterRoom(room);
        assert(sceneBackdrop.innerHTML === composeBackdrop(safehouseBackdropFor(safehouseTypes[4].name), 'hbd'), "enterRoom() : la scène de la salle sécurisée affiche le décor de son type (préfixe 'hbd')");
        assert(document.getElementById('safehouse-scene-crawler').innerHTML.includes(currentCrawler().markup), "Scène de salle sécurisée : le crawler est présent");
        assert(!/scene-band|combat-(enemy|player)-hp/.test(sceneBackdrop.innerHTML), "Scène de salle sécurisée : ni bande de portée ni barre de vie");
        assert(document.getElementById('scene-backdrop').innerHTML === combatBefore, "Scène de salle sécurisée : le décor de combat n'est pas touché");
        leaveSafehouse();
        sceneBackdrop.innerHTML = 'SENTINELLE';
        enterRoom(room);
        assert(sceneBackdrop.innerHTML === 'SENTINELLE', "Même type de salle : pas de redessin du décor");
        leaveSafehouse();
        room.safehouse = safehouseTypes[0];
        enterRoom(room);
        assert(sceneBackdrop.innerHTML.includes('TAVERNE'), "Autre type de salle : le décor est redessiné avec sa signature");
        leaveSafehouse();
        room.safehouse = saved.safehouse;
        room.visited = saved.visited;
        delete lastBackdropKeys.hbd;
    }
}

// ===================================================================
// renderScene('explore') : vignette d'événement dans la scène d'exploration (remplace l'ancienne carte à
// jouer). Chaque vignette nommée par app.js existe, se rend sans valeur manquante, tient dans la scène,
// et n'est redessinée que si elle change.
// ===================================================================
{
    const fs = require('fs');
    const path = require('path');
    const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
    const usedKeys = new Set();
    // Noms de vignette = identifiants camelCase (minuscule en tête), jamais un libellé de type affiché.
    (appSource.match(/setSceneHeader\([^\n]*\);/g) || []).forEach(call => {
        const m = /key:\s*'([a-z][A-Za-z]+)'/.exec(call) || /,\s*'([a-z][A-Za-z]+)'\s*\);$/.exec(call);
        if (m) usedKeys.add(m[1]);
    });
    const unknownUsed = [...usedKeys].filter(k => !EXPLORE_VIGNETTES[k]);
    assert(usedKeys.size >= 20, `app.js nomme bien les vignettes de ses événements (${usedKeys.size} trouvées)`);
    assert(unknownUsed.length === 0, `Chaque vignette nommée par app.js existe dans EXPLORE_VIGNETTES (inconnues : ${unknownUsed.join(', ')})`);

    const sampleMob = { name: 'Rat', visualArchetype: 'beast', effect: 'poison', isBoss: false };
    const sampleBoss = { name: 'Chef', visualArchetype: 'machine', effect: null, isBoss: true };
    const broken = [];
    const outside = [];
    Object.keys(EXPLORE_VIGNETTES).forEach(key => {
        [{}, { enemy: sampleMob }, { enemy: sampleBoss }, { enemy: { name: 'X', visualArchetype: 'inconnu' } }].forEach(ctx => {
            const markup = composeExploreVignette(key, ctx);
            if (!markup || /undefined|NaN/.test(markup)) broken.push(`${key}`);
        });
        const markup = composeExploreVignette(key, { enemy: sampleMob });
        // Positions de premier niveau (y > 0, dans la scène) — les translations internes d'un accessoire
        // sont relatives à son origine (y <= 0).
        (markup.match(/<g transform="translate\([-\d.]+ [-\d.]+\)/g) || []).forEach(t => {
            const [x, y] = /translate\(([-\d.]+) ([-\d.]+)/.exec(t).slice(1).map(parseFloat);
            if (y > 0 && (x < FULL_SCENE_VIEW.x + 8 || x > FULL_SCENE_VIEW.x + FULL_SCENE_VIEW.w - 8)) outside.push(`${key}@${x}`);
        });
    });
    assert(broken.length === 0, `Chaque vignette se rend avec ou sans ennemi (y compris archétype inconnu) sans valeur manquante (${[...new Set(broken)].join(', ')})`);
    assert(outside.length === 0, `Chaque élément de vignette tient dans la scène (${outside.join(', ')})`);
    assert(composeExploreVignette('stealthUnseen', { enemy: sampleMob }).includes('scale(-1 1)'), "Furtivité : le mob tourne le dos au crawler");
    assert(composeExploreVignette('bossSpotted', { enemy: sampleBoss }).includes(SCENE_BOSS_CROWN_SVG), "Boss repéré : couronne sur la silhouette");
    assert(composeExploreVignette('victory', { enemy: sampleMob }).includes('rotate(-90)'), "Victoire : le mob est à terre");

    resetTransientState();
    const icon = document.getElementById('explore-icon');
    const wrap = document.getElementById('explore-scene');
    const vignette = document.getElementById('explore-scene-vignette');
    delete lastBackdropKeys.ebd;
    delete vignetteKeys.ebd;
    setSceneHeader('💰', 'Trésor', 'Butin', 'treasure');
    assert(!wrap.classList.contains('hidden') && icon.classList.contains('hidden'), "setSceneHeader() avec vignette : la vignette s'affiche, l'emoji est masqué");
    assert(vignette.innerHTML === composeExploreVignette('treasure') && document.getElementById('explore-scene-backdrop').innerHTML.includes('id="ebd-wall"'), "Vignette dessinée avec le décor du quartier (préfixe 'ebd')");
    vignette.innerHTML = 'SENTINELLE';
    setSceneHeader('💰', 'Trésor', 'Butin', 'treasure');
    assert(vignette.innerHTML === 'SENTINELLE', "Même vignette : pas de redessin");
    setSceneHeader('🚪', 'Porte', 'Test');
    assert(!wrap.classList.contains('hidden') && !icon.classList.contains('hidden') && icon.innerText === '🚪', "setSceneHeader() sans vignette : l'emoji recouvre la scène, qui reste visible (c'est aussi le bouton Explorer)");
    setSceneHeader('?', 'Inconnu', 'Test', 'vignetteInexistante');
    assert(!icon.classList.contains('hidden'), "Vignette inconnue : repli sur l'emoji");
    delete lastBackdropKeys.ebd;
    delete vignetteKeys.ebd;

    const stairsWrap = document.getElementById('floor-transition-scene');
    delete vignetteKeys.fbd;
    renderScene('stairs');
    assert(!stairsWrap.classList.contains('hidden') && document.getElementById('floor-transition-scene-vignette').innerHTML === composeExploreVignette('stairs'), "Écran d'escalier : scène de l'escalier à la place de l'emoji");
    delete vignetteKeys.fbd;
    delete lastBackdropKeys.fbd;
}

// ===================================================================
// renderScene('gameOver') : le cadavre du crawler vu de dessus, dans sa mare de sang, avec un indice
// propre à CHAQUE cause de mort que gameOver() sait dériver (EPITAPH_TEMPLATES, hors pools spéciaux).
// ===================================================================
{
    const causes = Object.keys(EPITAPH_TEMPLATES).filter(k => k !== 'mobFaible' && k !== 'chasseurPrime'); // pools spéciaux, pas des causes de mort
    const missing = causes.filter(c => !GAME_OVER_CAUSE_PROPS[c]);
    assert(missing.length === 0, `Chaque cause de mort a son indice sur l'écran Game Over (manquantes : ${missing.join(', ')})`);
    const cluesDistinct = new Set(causes.map(c => GAME_OVER_CAUSE_PROPS[c]));
    assert(cluesDistinct.size === causes.length, "Deux causes de mort n'ont jamais le même indice");
    const broken = [];
    causes.concat(['causeInconnue']).forEach(cause => {
        Object.keys(SCENE_BACKDROPS).forEach(key => {
            const markup = composeGameOverScene(cause, key, 'gbd');
            if (/undefined|NaN/.test(markup) || !markup.includes(SCENE_CORPSE_TOPDOWN_SVG) || !markup.includes(GAME_OVER_BLOOD_POOL)) broken.push(`${cause}/${key}`);
        });
    });
    assert(broken.length === 0, `Écran Game Over : cadavre et mare de sang rendus pour toute cause et tout quartier (${broken.slice(0, 5).join(', ')})`);
    assert(!composeGameOverScene('causeInconnue', 'default', 'gbd').includes(GAME_OVER_CAUSE_PROPS.combat), "Cause inconnue : aucun indice, jamais celui d'une autre cause");
    assert((composeGameOverScene('combat', 'default', 'gbd').match(/#facc15/g) || []).length === 2, "Écran Game Over : deux plots de scène de crime");

    resetTransientState();
    const savedNecro = gameState.necrologie.slice();
    const content = document.getElementById('game-over-scene-content');
    gameOver(false, 'trap');
    assert(content.innerHTML.includes('data-cause="trap"') && content.innerHTML.includes(GAME_OVER_CAUSE_PROPS.trap), "gameOver() sur un piège : scène du cadavre avec la plaque à pointes");
    gameOver(true);
    assert(content.innerHTML.includes('data-cause="timeout"'), "gameOver() par épuisement du temps : indice des gravats");
    gameState.necrologie = savedNecro;
    document.getElementById('game-over-overlay').classList.add('hidden');
    resetTransientState();
}

// ===================================================================
// Étages urbains : décor de combat sur la route ou au fond d'un repaire (jamais l'intérieur du
// quartier), progression de plongée, vignettes ville/gardien/Sortie/repaire.
// ===================================================================
{
    const problems = [];
    Object.keys(URBAN_COMBAT_BACKDROPS).forEach(k => problems.push(...backdropProblems(`urbain:${k}`, URBAN_COMBAT_BACKDROPS[k])));
    assert(problems.length === 0, `Décors de combat urbains valides (${problems.join(' ; ')})`);

    resetTransientState();
    const saved = { floorMap: gameState.floorMap, district: gameState.currentDistrict, enemy: gameState.currentEnemy, inCombat: gameState.inCombat };
    gameState.currentDistrict = Object.keys(districts)[2];
    gameState.floorMap = null;
    assert(resolveCombatBackdrop().key === gameState.currentDistrict, "Étage classique : combat dans le décor du quartier");
    gameState.floorMap = {
        kind: 'urban', roomsById: {}, citiesById: { a: { id: 'a', name: 'Faubourg' } }, currentCityId: 'a',
        lairsById: { L: { id: 'L', combatsRemaining: 3, cleared: false } }
    };
    assert(resolveCombatBackdrop().key === 'urban:road' && resolveCombatBackdrop().def === URBAN_COMBAT_BACKDROPS.road, "Étage urbain : combat sur la route");
    gameState.pendingLairDive = { lairId: 'L', combatsLeft: 3, stage: 'trash' };
    assert(resolveCombatBackdrop().key === 'urban:lair', "Plongée dans un repaire : combat au fond du repaire");

    assert(JSON.stringify(lairProgressState()) === JSON.stringify({ total: 3, done: 0, boss: false }), "Progression de plongée : premier sbire en cours");
    gameState.pendingLairDive.combatsLeft = 1;
    assert(lairProgressState().done === 2, "Progression de plongée : deux sbires vaincus");
    gameState.pendingLairDive.stage = 'boss';
    const bossState = lairProgressState();
    assert(bossState.boss && bossState.done === 3, "Progression de plongée : place au boss");
    const bossMarkup = composeLairProgress(bossState);
    assert((bossMarkup.match(/<circle /g) || []).length === 3 && bossMarkup.includes(SCENE_BOSS_CROWN_SVG) && !/undefined|NaN/.test(bossMarkup), "Progression de plongée : un pion par sbire + la couronne du boss");
    assert(composeLairProgress(null) === '', "Hors plongée : aucune progression affichée");

    gameState.inCombat = true;
    gameState.currentEnemy = { name: 'Sbire', hp: 10, maxHp: 10, atk: 1, def: 0, status: {}, visualArchetype: 'beast' };
    delete lastBackdropKeys.cbd;
    renderScene('combat');
    assert(document.getElementById('scene-backdrop').innerHTML === composeBackdrop(URBAN_COMBAT_BACKDROPS.lair, 'cbd'), "renderScene('combat') en plongée : décor du repaire");
    assert(document.getElementById('scene-lair-progress').innerHTML.includes('data-boss="1"'), "renderScene('combat') en plongée : progression affichée");
    gameState.pendingLairDive = null;
    renderScene('combat');
    assert(document.getElementById('scene-backdrop').innerHTML === composeBackdrop(URBAN_COMBAT_BACKDROPS.road, 'cbd') && document.getElementById('scene-lair-progress').innerHTML === '', "Embuscade urbaine : décor de route, sans progression de repaire");

    const stairsGuard = composeExploreVignette('urbanGuardian', { enemy: { visualArchetype: 'blob', isBoss: true } });
    const exitGuard = composeExploreVignette('urbanGuardian', { enemy: { visualArchetype: 'blob', isBoss: true }, isExit: true });
    assert(stairsGuard.includes(BACKDROP_PROPS.stairsDown.markup({})) && exitGuard.includes('SORTIE') && exitGuard.includes(SCENE_BOSS_CROWN_SVG), "Gardien urbain : l'escalier ou la porte de Sortie derrière le boss couronné");
    assert(composeExploreVignette('citySafe', { cityName: 'Port Fluvial' }).includes('Port Fluvial'), "Ville sûre : panneau au nom de la ville");

    Object.assign(gameState, { floorMap: saved.floorMap, currentDistrict: saved.district, currentEnemy: saved.enemy, inCombat: saved.inCombat });
    ['cbd'].forEach(p => { delete lastBackdropKeys[p]; delete vignetteKeys[p]; });
    resetTransientState();
}

// ===================================================================
// Crawler équipé (sprites/crawler.js + sprites/items-*.js) : la posture suit la dernière attaque
// utilisée, l'objet tenu est dans la main, l'autre arme rangée, l'armure portée ; chaque objet retrouve
// son sprite par son nom d'origine (baseName), même dans une ancienne sauvegarde.
// ===================================================================
{
    // Résolution du sprite d'un objet
    ITEM_SPRITES['Objet de Test'] = { kind: 'melee', art: '<g/>' };
    assert(resolveItemSpriteKey(null) === null, "resolveItemSpriteKey() : aucun objet -> aucun sprite");
    assert(resolveItemSpriteKey({ name: 'Objet de Test Vibrant et Explosif', baseName: 'Objet de Test', category: 'weapons' }) === 'Objet de Test', "resolveItemSpriteKey() : nom d'origine (baseName) prioritaire");
    assert(resolveItemSpriteKey({ name: 'Objet de Test Vibrant', category: 'weapons' }) === 'Objet de Test', "resolveItemSpriteKey() : ancienne sauvegarde sans baseName -> retrouvé par le début du nom");
    assert(resolveItemSpriteKey({ name: 'Truc Inconnu', category: 'ranged' }) === 'generic:ranged' && resolveItemSpriteKey({ name: 'Truc', category: 'armors' }) === 'generic:armors', "resolveItemSpriteKey() : objet sans dessin -> dessin générique de sa catégorie");
    delete ITEM_SPRITES['Objet de Test'];
    ['weapons', 'ranged', 'armors'].forEach(cat => {
        const item = generateItem({ floor: 8, category: cat });
        assert(item.baseName && item.name.startsWith(item.baseName) && baseItems[cat].some(b => b.name === item.baseName), `generateItem('${cat}') : baseName = nom d'origine de l'objet`);
    });
    const broken = Object.keys(ITEM_SPRITES).filter(k => !['melee', 'ranged', 'armor'].includes(ITEM_SPRITES[k].kind) || /undefined|NaN/.test(ITEM_SPRITES[k].art));
    assert(broken.length === 0, `Chaque sprite d'équipement a un type et un dessin valides (${broken.join(', ')})`);

    resetTransientState();
    const saved = { equipment: { ...gameState.equipment }, last: gameState.lastAttackKind };
    const melee = { name: 'Pied-de-biche', baseName: 'Pied-de-biche', category: 'weapons', baseDmg: 8 };
    const ranged = { name: 'Lance-Pierre de Chantier', baseName: 'Lance-Pierre de Chantier', category: 'ranged', baseDmg: 10 };
    const armor = { name: 'Armure de Carton', baseName: 'Armure de Carton', category: 'armors', baseArmor: 8 };
    const spell = { name: 'Foudre', spellName: 'Foudre', icon: '🌩️', category: 'scrolls' };
    gameState.equipment.weapon = melee; gameState.equipment.ranged = ranged; gameState.equipment.armor = armor; gameState.equipment.spell = spell;

    gameState.lastAttackKind = null;
    assert(crawlerPosture() === 'weapon', "Posture avant toute attaque : l'arme de mêlée en main");
    gameState.lastAttackKind = 'ranged';
    assert(crawlerPosture() === 'ranged', "Posture après un tir : l'arme à distance en main");
    gameState.inCombat = true; gameState.combatDistance = 0;
    assert(crawlerPosture() === 'rangedLowered', "Arme à distance au contact : canon baissé (on ne peut pas tirer)");
    gameState.inCombat = false;
    gameState.lastAttackKind = 'magic';
    assert(crawlerPosture() === 'magic', "Posture après un sort : attaque magique");
    gameState.lastAttackKind = 'unarmed';
    assert(crawlerPosture() === 'boxer', "Posture après un coup à mains nues : garde du boxeur");
    gameState.lastAttackKind = 'ranged'; gameState.equipment.ranged = null;
    assert(crawlerPosture() === 'weapon', "Dernière arme plus équipée : repli sur l'arme de mêlée");
    gameState.equipment.weapon = null; gameState.equipment.spell = null; gameState.lastAttackKind = null;
    assert(crawlerPosture() === 'boxer', "Aucune arme ni sort : garde du boxeur");

    gameState.equipment.weapon = melee; gameState.equipment.ranged = ranged; gameState.equipment.spell = spell;
    gameState.lastAttackKind = 'weapon';
    let markup = currentCrawler().markup;
    assert(markup.includes('class="crawler-held"') && markup.includes('class="crawler-stowed-ranged"') && !markup.includes('crawler-stowed-weapon'), "Posture arme : l'arme de mêlée en main, l'arme à distance rangée dans le dos");
    assert(markup.includes('class="crawler-armor"') && markup.includes(itemArt(resolveItemSpriteKey(armor))), "L'armure équipée est portée par le crawler");
    assert(markup.indexOf('crawler-armor') < markup.indexOf('crawler-held') && markup.indexOf('crawler-held') < markup.indexOf(CRAWLER_PARTS.head), "Ordre : armure sur le torse, puis objet tenu, puis tête (jamais masquée)");
    gameState.lastAttackKind = 'ranged';
    markup = currentCrawler().markup;
    assert(markup.includes('class="crawler-stowed-weapon"') && !markup.includes('crawler-stowed-ranged'), "Posture tir : l'arme de mêlée rangée à la hanche");
    gameState.lastAttackKind = 'magic';
    markup = currentCrawler().markup;
    assert(markup.includes('crawler-spell-glow') && markup.includes(CRAWLER_SPELL_GLOWS['🌩️']), "Posture magie : lueur du sort équipé dans la paume (couleur de Foudre)");
    gameState.lastAttackKind = 'unarmed';
    markup = currentCrawler().markup;
    assert(markup.indexOf(CRAWLER_PARTS.head) < markup.lastIndexOf(CRAWLER_ARMS.boxer.front), "Garde du boxeur : un poing devant le visage");
    assert(!/undefined|NaN/.test(markup), "Crawler composé sans valeur manquante");

    // Chaque attaque fixe la posture.
    const mob = () => ({ name: 'Sac de Frappe', hp: 999, maxHp: 999, atk: 1, def: 0, status: {} });
    [['unarmed', () => attackUnarmed()], ['weapon', () => attackWeapon()]].forEach(([kind, act]) => {
        resetTransientState();
        gameState.equipment.weapon = melee;
        gameState.lastAttackKind = null;
        initiateCombat(mob());
        gameState.combatDistance = 0;
        act();
        assert(gameState.lastAttackKind === kind, `Attaque '${kind}' : la posture suit la dernière attaque utilisée`);
    });
    resetTransientState();
    gameState.equipment.ranged = ranged;
    initiateCombat(mob());
    gameState.combatDistance = 3;
    attackRanged();
    assert(gameState.lastAttackKind === 'ranged', "Tir : la posture suit la dernière attaque utilisée");

    resetTransientState();
    gameState.equipment = saved.equipment;
    gameState.lastAttackKind = saved.last;
}

// ===================================================================
// Sprites propres à chaque objet (sprites/items-melee|ranged|armor|signature.js) : chaque objet du
// catalogue (items.js) et chaque objet signature de boss (bestiary.js) a SON dessin, du bon type — un
// futur objet ajouté sans dessin fait échouer ce test au lieu de retomber silencieusement sur le
// générique. Enchantements visibles (étincelles, pastilles d'icône), icônes d'inventaire.
// ===================================================================
{
    const KIND_BY_CATEGORY = { weapons: 'melee', ranged: 'ranged', armors: 'armor' };
    const catalog = [];
    ['weapons', 'ranged', 'armors'].forEach(cat => baseItems[cat].forEach(item => catalog.push({ ...item, category: cat })));
    Object.values(districtBosses).forEach(boss => { if (boss.signatureItem) catalog.push(boss.signatureItem); });
    const missing = [];
    const wrongKind = [];
    catalog.forEach(item => {
        const sprite = ITEM_SPRITES[item.name];
        if (!sprite) { missing.push(item.name); return; }
        if (sprite.kind !== KIND_BY_CATEGORY[item.category]) wrongKind.push(`${item.name} (${sprite.kind})`);
    });
    assert(missing.length === 0, `Chaque objet du catalogue et chaque objet signature a son sprite (manquants : ${missing.join(', ')})`);
    assert(wrongKind.length === 0, `Le type de chaque sprite correspond à la catégorie de l'objet (${wrongKind.join(', ')})`);
    const orphans = Object.keys(ITEM_SPRITES).filter(k => !k.startsWith('generic:') && !catalog.some(i => i.name === k));
    assert(orphans.length === 0, `Chaque sprite correspond à un objet existant (orphelins : ${orphans.join(', ')})`);
    const badTip = Object.keys(ITEM_SPRITES).filter(k => !Array.isArray(ITEM_SPRITES[k].tip) || ITEM_SPRITES[k].tip.length !== 2);
    assert(badTip.length === 0, `Chaque sprite a son point d'enchantement (tip) (${badTip.join(', ')})`);

    const generated = generateItem({ floor: 8, category: 'ranged', rarityKey: 'commun' });
    assert(resolveItemSpriteKey(generated) === generated.baseName && !resolveItemSpriteKey(generated).startsWith('generic:'), "Un objet généré retrouve son propre sprite par son nom d'origine");

    // Icônes d'inventaire
    const icons = catalog.map(item => itemIconSvg(item, 32));
    assert(icons.every(svg => svg.startsWith('<svg') && svg.includes('viewBox="-24 -24 48 48"') && !/undefined|NaN/.test(svg)), "Chaque objet a une icône d'inventaire valide");
    const enchanted = { name: 'Pied-de-biche Empoisonné et Lourd', baseName: 'Pied-de-biche', category: 'weapons', mechanics: ['poison', 'stun'] };
    const icon = itemIconSvg(enchanted, 32);
    assert(icon.includes(ENCHANT_COLORS.poison) && icon.includes(ENCHANT_COLORS.stun), "Icône : une pastille par enchantement, à sa couleur");
    assert(itemIconSvg({ name: 'Parchemin', category: 'scrolls' }) === '', "Parchemin : pas d'icône d'équipement");

    // Fioles des consommables : rouge = PV, bleu = mana, moitié-moitié = les deux
    const kinds = baseItems.consumables.map(c => consumableFlaskKind({ ...c, category: 'consumables' }));
    assert(kinds.includes('heal') && kinds.includes('mana') && kinds.includes('mixed'), "Consommables : les trois types de fiole existent au catalogue");
    assert(consumableFlaskKind({ heal: 0, mana: 45 }) === 'mana' && consumableFlaskKind({ heal: 10, mana: 25 }) === 'mixed'
        && consumableFlaskKind({ heal: 25 }) === 'heal' && consumableFlaskKind({ heal: 0 }) === 'heal', "consumableFlaskKind : PV, mana, mixte, et 'heal' par défaut");
    const flask = kind => itemIconSvg({ name: 'Fiole', category: 'consumables', heal: kind === 'mana' ? 0 : 20, mana: kind === 'heal' ? 0 : 20 }, 28);
    assert(['heal', 'mana', 'mixed'].every(k => flask(k).startsWith('<svg') && !/undefined|NaN|id=/.test(flask(k))), "Chaque fiole est une icône valide, sans identifiant");
    assert(flask('heal').includes(CONSUMABLE_FLASKS.heal.liquid) && !flask('heal').includes(CONSUMABLE_FLASKS.mana.liquid), "Fiole de PV : liquide rouge seulement");
    assert(flask('mana').includes(CONSUMABLE_FLASKS.mana.liquid) && !flask('mana').includes(CONSUMABLE_FLASKS.heal.liquid), "Fiole de mana : liquide bleu seulement");
    assert(flask('mixed').includes(CONSUMABLE_FLASKS.mana.liquid) && flask('mixed').includes(CONSUMABLE_FLASKS.heal.liquid), "Fiole mixte : les deux liquides");
    assert(['heal', 'mana', 'mixed'].every(k => /^#[0-9a-f]{6}$/i.test(CONSUMABLE_FLASKS[k].border)), "Chaque type de fiole a sa couleur de bordure");

    // Enchantements visibles sur le crawler
    resetTransientState();
    const savedEq = { ...gameState.equipment };
    gameState.equipment.weapon = enchanted;
    gameState.equipment.armor = { name: 'Cape en Lambeaux du Maître des Illusions', category: 'armors', mechanics: ['darkness'] };
    gameState.lastAttackKind = 'weapon';
    const markup = currentCrawler().markup;
    const held = markup.slice(markup.indexOf('crawler-held'));
    assert(held.includes('ench-spark') && held.includes(ENCHANT_COLORS.poison), "Arme enchantée en main : étincelles à la couleur de l'enchantement");
    assert(markup.indexOf('crawler-armor') < markup.indexOf(CRAWLER_PARTS.torso), "Cape (couche 'back') : dessinée derrière le torse");
    gameState.equipment.weapon = { name: 'Pied-de-biche', baseName: 'Pied-de-biche', category: 'weapons' };
    gameState.equipment.armor = null;
    assert(!currentCrawler().markup.includes('ench-spark'), "Objet sans enchantement : aucune étincelle");
    gameState.equipment = savedEq;
    resetTransientState();
}

// ============================================================
// Effets d'attaque (chantier « sprites & effets », phase 3 : sprites/fx.js + fx.js)
// ============================================================
{
    const noBad = str => typeof str === 'string' && !/undefined|NaN/.test(str);

    // Catalogue : chaque arme dessinée a son style de coup / son projectile, chaque sort et chaque mob son effet
    const meleeKeys = Object.keys(ITEM_SPRITES).filter(k => ITEM_SPRITES[k].kind === 'melee');
    const rangedKeys = Object.keys(ITEM_SPRITES).filter(k => ITEM_SPRITES[k].kind === 'ranged');
    const noSwing = meleeKeys.filter(k => !FX_SWING_ANGLES[MELEE_SWING_STYLES[k]]);
    assert(noSwing.length === 0, `Chaque arme de mêlée dessinée a un style de coup (${noSwing.join(', ')})`);
    const noProj = rangedKeys.filter(k => !FX_PROJECTILES[RANGED_PROJECTILES[k]]);
    assert(noProj.length === 0, `Chaque arme à distance dessinée a son projectile (${noProj.join(', ')})`);
    const noSpell = spellCatalog.filter(s => !FX_SPELLS[s.icon]).map(s => s.name);
    assert(noSpell.length === 0, `Chaque sort de spells.js a son effet (${noSpell.join(', ')})`);
    const archetypes = Object.keys(SCENE_MOB_SPRITES);
    const noMobFx = archetypes.filter(a => !MOB_ATTACK_STYLES[a] || !FX_PROJECTILES[MOB_RANGED_PROJECTILES[a]] || !MOB_STYLE_IMPACTS[MOB_ATTACK_STYLES[a]]);
    assert(noMobFx.length === 0, `Chaque archétype de mob a son attaque au contact et son tir (${noMobFx.join(', ')})`);
    const effects = [...new Set(Object.values(mobModifiers).flat().map(m => m && m.effect).filter(Boolean))];
    const noColor = effects.filter(e => !MOB_EFFECT_FX_COLORS[e]);
    assert(noColor.length === 0, `Chaque effet de mob a sa couleur d'effet (${noColor.join(', ')})`);

    // Chaque éclat référencé existe et se dessine sans valeur manquante
    const impacts = new Set([...Object.values(MELEE_IMPACTS), ...Object.values(FX_PROJECTILES).map(p => p.impact),
        ...Object.values(FX_SPELLS).map(s => s.impact), ...Object.values(MOB_STYLE_IMPACTS), 'hit', 'slash', 'smash', 'pow']);
    const missingImpact = [...impacts].filter(n => typeof FX_IMPACTS[n] !== 'function');
    assert(missingImpact.length === 0, `Chaque éclat d'impact référencé existe (${missingImpact.join(', ')})`);
    assert(Object.keys(FX_IMPACTS).every(n => noBad(FX_IMPACTS[n]('#ff0000')) && FX_IMPACTS[n]().length > 0), "Chaque éclat se dessine (avec ou sans couleur) sans valeur manquante");
    assert(Object.values(FX_PROJECTILES).every(p => p.speed > 0 && (p.beam || noBad(p.art) && p.art.length > 0)), "Chaque projectile a une vitesse et un dessin (ou un jet)");
    assert(Object.values(FX_SPELLS).every(s => s.style !== 'bolt' && s.style !== 'meteor' || FX_PROJECTILES[s.projectile]), "Sorts à projectile : projectile connu");

    // Géométrie pure
    assert(noBad(fxCrescentPath(290, 78, 30, 8, -120, 8)) && fxCrescentPath(290, 78, 30, 8, -120, 8).endsWith('Z'), "Traînée en croissant : tracé fermé sans valeur manquante");
    assert(noBad(fxStreakPath(250, 70, 100, 90, 3)) && noBad(fxStreakPath(10, 10, 10, 10, 3)), "Traînée droite : tracé valide, même de longueur nulle");
    assert(noBad(fxZigzagPath(280, 50, 120, 90, 5)) && fxZigzagPath(0, 0, 60, 0, 5).split('L').length === 7, "Éclair : zigzag de 6 segments");
    const mid = fxArcPoint([0, 100], [100, 100], 20, 0.5);
    assert(mid.x === 50 && mid.y === 80 && Math.abs(mid.angle) < 1e-9, "Trajectoire en cloche : sommet à mi-course, vol horizontal au sommet");

    // Spécifications (pures) : ce que joue chaque attaque
    resetTransientState();
    const savedEq = { ...gameState.equipment };
    gameState.equipment.weapon = { name: 'Couteau en Beurre Tranchant', baseName: 'Couteau en Beurre', category: 'weapons', mechanics: ['bleed'] };
    let spec = playerAttackFxSpec('weapon');
    assert(spec.type === 'melee' && spec.style === 'thrust' && spec.color === ENCHANT_COLORS.bleed, "Arme de mêlée : style de l'objet, traînée à la couleur de son enchantement");
    gameState.equipment.weapon = { name: 'Bâton de Dynamite', baseName: 'Bâton de Dynamite', category: 'weapons' };
    spec = playerAttackFxSpec('weapon');
    assert(spec.impact === 'explosion' && spec.color === FX_COLORS.smash, "Dynamite : explosion à l'impact, traînée par défaut sans enchantement");
    gameState.equipment.ranged = { name: 'Pistolet à Eau Surpuissant', baseName: 'Pistolet à Eau Surpuissant', category: 'ranged' };
    spec = playerAttackFxSpec('ranged');
    assert(spec.type === 'ranged' && spec.projectile === 'water' && Array.isArray(spec.muzzle), "Arme à distance : son projectile, tiré depuis la bouche du sprite");
    gameState.equipment.spell = { spellName: 'Météore Miniature', icon: '☄️', spellCategory: 'ranged' };
    spec = playerAttackFxSpec('magic');
    assert(spec.type === 'magic' && spec.style === 'meteor' && spec.impact === 'explosion', "Sort : effet de son icône");
    gameState.equipment.spell = { spellName: 'Sort inconnu', icon: '🦄', spellCategory: 'melee' };
    assert(playerAttackFxSpec('magic').style === 'cone', "Sort inconnu : effet de repli selon sa catégorie");
    assert(playerAttackFxSpec('unarmed').impact === 'pow', "Mains nues : « PAF » à l'impact");
    gameState.equipment.weapon = null;
    assert(playerAttackFxSpec('weapon').type === 'unarmed', "Arme déséquipée : repli sur les poings");
    gameState.equipment = savedEq;
    const beast = { visualArchetype: 'beast', effect: 'poison' };
    assert(mobAttackFxSpec(beast, false).style === 'bite' && mobAttackFxSpec(beast, false).color === MOB_EFFECT_FX_COLORS.poison, "Mob au contact : attaque de son archétype, à la couleur de son effet");
    assert(mobAttackFxSpec(beast, true).type === 'ranged' && mobAttackFxSpec(beast, true).projectile === 'spit', "Mob à distance : le tir de son archétype");
    assert(mobAttackFxSpec({ visualArchetype: 'inconnu' }, false).style === MOB_ATTACK_STYLES.goblinoid, "Archétype inconnu : attaque du goblinoïde");

    // Rythme : l'impact tombe toujours avant la fin de combat / le Game Over
    assert(FX_MAX_IMPACT_MS < COMBAT_BEAT_MS, "L'impact d'un effet tombe avant le beat de fin de combat");

    // Poses animables : groupe de pose, objet tenu avec sa transformation de repos, poing avant séparé
    assert(wrapSceneBody('X') === '<g class="scene-body"><g class="scene-pose">X</g></g>', "Silhouette : groupe de pose sous le groupe de secousse");
    const weaponCrawler = composeCrawler({ posture: 'weapon', weapon: 'Pied-de-biche', ench: {} });
    const t = /class="crawler-held" data-t="([^"]+)" transform="([^"]+)"/.exec(weaponCrawler);
    assert(t && t[1] === t[2], "Objet tenu : transformation de repos (data-t) = transformation affichée");
    assert(composeCrawler({ posture: 'boxer', ench: {} }).includes('<g class="crawler-front">'), "Boxeur : poing avant dans son propre groupe (direct animé)");

    // Sans requestAnimationFrame (Node) : aucun effet dessiné, l'impact est immédiat
    resetTransientState();
    let impacted = 0;
    playPlayerAttackFx('weapon', { heldEnemyHp: 10 }, () => { impacted++; });
    playMobAttackFx({ visualArchetype: 'beast' }, { heavy: true }, () => { impacted++; });
    playSpellBackfireFx();
    assert(impacted === 2 && sceneVitalsHold.enemy === null && sceneVitalsHold.player === false, "Sans animation possible : impact immédiat, aucune barre de vie tenue");

    // Barres de vie tenues jusqu'à l'impact (renderSceneVitals)
    const mob = generateMob(gameState.currentDistrict);
    initiateCombat(mob);
    gameState.currentEnemy.hp = 5;
    sceneVitalsHold.enemy = gameState.currentEnemy; sceneVitalsHold.enemyHp = 40;
    sceneVitalsHold.player = true; sceneVitalsHold.playerHp = 7;
    renderScene('combat');
    assert(sceneUi.enemyHpText.innerText.startsWith('PV 40/') && sceneUi.playerHpText.innerText.startsWith('PV 7/'), "Barres tenues : PV d'avant le coup affichés");
    sceneVitalsHold.enemy = { other: true };
    sceneVitalsHold.player = false;
    renderScene('combat');
    assert(sceneUi.enemyHpText.innerText.startsWith('PV 5/'), "Une tenue posée pour un autre ennemi est ignorée");
    sceneVitalsHold.enemy = null;

    // Un skip demandé au tour précédent n'escamote pas l'effet de l'attaque suivante
    combatSkipRequested = true;
    gameState.equipment.weapon = gameState.equipment.weapon || { name: 'Pied-de-biche', baseName: 'Pied-de-biche', category: 'weapons', baseDmg: 5 };
    tryPlayerAction();
    assert(combatSkipRequested === false, "Nouvelle action du joueur : la demande de skip précédente est oubliée");
    resetTransientState();
}

// ============================================================
// Bestiaire (chantier « sprites & effets », phase 4 : sprites/mobs.js, mob-details-a/b.js, mob-auras.js) :
// chaque mob de baseMobs a son détail signature et sa palette, chaque effet de mob son aura, tout tient dans
// ±MOB_EXTENT (même borne que la silhouette) ; un mob ajouté sans détail fait échouer ce test.
// ============================================================
{
    const forbidden = /undefined|NaN|id=|<defs|<image|<filter|Gradient/;
    const inBounds = b => Array.isArray(b) && b.length === 2 && b[0] >= -MOB_EXTENT && b[1] <= MOB_EXTENT && b[0] < b[1];
    const isPalette = p => p && ['base', 'dark', 'accent'].every(k => /^#[0-9a-f]{6}$/i.test(p[k]));

    const archetypes = Object.keys(SCENE_MOB_SPRITES);
    const badArch = archetypes.filter(k => { const s = SCENE_MOB_SPRITES[k]; return !inBounds(s.bounds) || !isPalette(s.palette) || s.top > -40 || s.top < -88 || forbidden.test(s.markup); });
    assert(badArch.length === 0, `Silhouettes d'archétype : bornes ±${MOB_EXTENT}, palette, hauteur -40..-88, aucun élément interdit (${badArch.join(', ')})`);

    const missing = baseMobs.filter(m => !MOB_DETAILS[m.name]).map(m => m.name);
    assert(missing.length === 0, `Chaque mob de baseMobs a son détail signature (${missing.join(', ')})`);
    const orphan = Object.keys(MOB_DETAILS).filter(k => !baseMobs.some(m => m.name === k) && !bountyHunters.some(h => h.name === k));
    const missingHunters = bountyHunters.filter(h => !MOB_DETAILS[h.name]).map(h => h.name);
    assert(missingHunters.length === 0, `Chaque chasseur de primes a son détail signature (${missingHunters.join(', ')})`);
    assert(orphan.length === 0, `Chaque détail correspond à un mob existant, nom exact (${orphan.join(', ')})`);
    const badDetail = Object.keys(MOB_DETAILS).filter(k => { const d = MOB_DETAILS[k]; return !inBounds(d.bounds) || !isPalette(d.palette) || (d.top != null && (d.top > -40 || d.top < -92)) || forbidden.test(d.markup); });
    assert(badDetail.length === 0, `Détails : bornes, palette, hauteur, aucun élément interdit (${badDetail.join(', ')})`);

    const effects = new Set(Object.values(mobModifiers).flat().map(m => m && m.effect).filter(Boolean));
    Object.values(districtBosses).forEach(b => b.effect && effects.add(b.effect));
    const noAura = [...effects].filter(e => typeof MOB_EFFECT_AURAS[e] !== 'function');
    assert(noAura.length === 0, `Chaque effet de mob a son aura (${noAura.join(', ')})`);
    const badAura = Object.keys(MOB_EFFECT_AURAS).filter(e => { const a = MOB_EFFECT_AURAS[e]('#123456'); return forbidden.test(a) || !a.includes('#123456'); });
    assert(badAura.length === 0, `Auras : colorées par leur paramètre, aucun élément interdit (${badAura.join(', ')})`);

    // resolveMobSprite() : nom d'origine, suffixes de modificateurs, archétype inconnu, aura, hauteur
    const rat = resolveMobSprite({ name: 'Rat Goulot Enflammé et Colossal', visualArchetype: 'beast', effect: 'burn' });
    assert(rat.key === 'beast|Rat Goulot|burn' && rat.markup.includes(MOB_EFFECT_FX_COLORS.burn) && rat.palette === MOB_DETAILS['Rat Goulot'].palette, "Mob renommé par ses modificateurs : son détail, sa palette et l'aura de son effet");
    assert(rat.markup.indexOf(MOB_EFFECT_FX_COLORS.burn) < rat.markup.indexOf(SCENE_MOB_SPRITES.beast.markup), "L'aura est dessinée derrière le mob");
    assert(resolveMobSprite({ name: 'Rat Goulot', visualArchetype: 'beast', effect: 'burn' }, { aura: false }).key === 'beast|Rat Goulot|', "Mob à terre : sans aura");
    const unknown = resolveMobSprite({ name: 'Inconnu', visualArchetype: 'inexistant' });
    assert(unknown.key === 'goblinoid||' && unknown.palette === SCENE_MOB_SPRITES.goblinoid.palette, "Mob inconnu : silhouette et palette du goblinoïde, sans détail");
    const ctrl = resolveMobSprite({ baseName: 'Contrôleur de Billets Zombifié', name: 'X', visualArchetype: 'zombie' });
    assert(ctrl.top === MOB_DETAILS['Contrôleur de Billets Zombifié'].top, "Un détail plus haut que la silhouette relève le `top` (couronne, chiffres de dégâts)");

    // generateMob()/generateBoss() posent le nom d'origine
    resetTransientState();
    const districtName = Object.keys(districts)[0];
    const originalRandom = Math.random;
    Math.random = () => 0.001; // modificateurs garantis
    const mob = generateMob(districtName);
    Math.random = originalRandom;
    assert(mob.baseName && MOB_DETAILS[mob.baseName] && mob.name.startsWith(mob.baseName), "generateMob() : nom d'origine conservé (baseName) malgré les suffixes");
    const boss = generateBoss(districtName);
    assert(boss.baseName === boss.name, "generateBoss() : nom d'origine conservé");

    // Rendu de combat : palette du mob sur la scène, aura dessinée
    gameState.inCombat = true;
    gameState.currentEnemy = { name: 'Tulipe Géante Enflammé', baseName: 'Tulipe Géante', visualArchetype: 'plant', effect: 'burn', hp: 10, maxHp: 10, atk: 1, def: 1, status: {} };
    updateUI();
    const sceneMob = document.getElementById('scene-mob');
    assert(sceneMob.innerHTML.includes(MOB_EFFECT_FX_COLORS.burn) && sceneMob.innerHTML.includes('scene-pose'), "Scène de combat : aura et groupe de pose du mob");
    resetTransientState();
}

// ============================================================
// Boss uniques (phase 5 : sprites/bosses-a.js, bosses-b.js) : chaque sprite de boss correspond à un boss
// de districtBosses, tient son PROPRE objet signature (dessin de ITEM_SPRITES), reste dans ±MOB_EXTENT ;
// un boss sans sprite unique garde la silhouette couronnée de son archétype.
// ============================================================
{
    const forbidden = /undefined|NaN|id=|<defs|<image|<filter|Gradient/;
    const bossesByName = {};
    Object.values(districtBosses).forEach(b => { bossesByName[b.name] = b; });
    const bad = Object.keys(SCENE_BOSS_SPRITES).filter(name => {
        const s = SCENE_BOSS_SPRITES[name];
        const boss = bossesByName[name];
        return !boss || !s.held || s.held.item !== boss.signatureItem.name || !ITEM_SPRITES[s.held.item]
            || !Array.isArray(s.bounds) || s.bounds[0] < -MOB_EXTENT || s.bounds[1] > MOB_EXTENT
            || s.top > -40 || s.top < -90 || !s.palette || forbidden.test(s.markup);
    });
    assert(bad.length === 0, `Sprites de boss : boss existant, son objet signature, bornes ±${MOB_EXTENT}, hauteur, aucun élément interdit (${bad.join(', ')})`);

    const noSprite = Object.values(districtBosses).filter(b => !SCENE_BOSS_SPRITES[b.name]).map(b => b.name);
    assert(noSprite.length === 0, `Chaque boss de districtBosses a son sprite unique (${noSprite.join(', ')})`);

    const name = Object.keys(SCENE_BOSS_SPRITES)[0];
    const boss = { ...bossesByName[name], baseName: name };
    const sprite = resolveMobSprite(boss);
    const held = SCENE_BOSS_SPRITES[name].held;
    assert(sprite.key === `boss:${name}|${boss.effect}` && sprite.markup.includes(ITEM_SPRITES[held.item].art) && sprite.top === SCENE_BOSS_SPRITES[name].top, "Boss au sprite unique : son dessin, son objet signature, son aura, sa hauteur");
    const cape = Object.keys(SCENE_BOSS_SPRITES).find(n => SCENE_BOSS_SPRITES[n].held.layer === 'back');
    if (cape) {
        const m = resolveMobSprite({ ...bossesByName[cape] }).markup;
        assert(m.indexOf('boss-held') < m.indexOf(SCENE_BOSS_SPRITES[cape].markup), "Objet porté dans le dos (layer 'back') : dessiné derrière le boss");
    }
    const without = Object.values(districtBosses).find(b => !SCENE_BOSS_SPRITES[b.name]);
    if (without) assert(resolveMobSprite(without).key.startsWith(`${without.visualArchetype}|`), "Boss sans sprite unique : silhouette de son archétype");
}

// ===================================================================
// Chiffres de dégâts : taille selon la part des PV max de la cible, entre un minimum et un maximum.
// ===================================================================
{
    const cfg = FLOATING_DAMAGE_SIZE;
    assert(floatingDamageScale(1, 100).fontPx === cfg.minPx && floatingDamageScale(0, 0).fontPx === cfg.minPx, "Petit coup (ou PV max inconnus) : taille minimale");
    assert(floatingDamageScale(500, 100).fontPx === cfg.maxPx && floatingDamageScale(500, 100, true).fontPx === cfg.maxPx, "Coup énorme, même lourd : taille plafonnée au maximum");
    let growing = true;
    for (let dmg = 1; dmg <= 60; dmg++) {
        const a = floatingDamageScale(dmg - 1, 100), b = floatingDamageScale(dmg, 100);
        if (b.fontPx < a.fontPx || b.pop < a.pop) growing = false;
    }
    assert(growing, "La taille et le grossissement ne décroissent jamais quand les dégâts augmentent");
    assert(floatingDamageScale(20, 100).fontPx === floatingDamageScale(200, 1000).fontPx, "Même part des PV max, même taille (indépendant de l'étage)");
    assert(floatingDamageScale(10, 100, true).fontPx === floatingDamageScale(10, 100).fontPx + cfg.heavyBonusPx, "Coup lourd : un peu plus gros");
    assert(floatingDamageScale(1, 100).pop === cfg.popMin && floatingDamageScale(500, 100).pop === cfg.popMax, "Grossissement borné entre popMin et popMax");

    resetTransientState();
    const anchor = document.getElementById('scene-mob-anchor');
    gameState.currentEnemy = { name: 'Cible', hp: 50, maxHp: 100 };
    const before = anchor._children ? anchor._children.length : 0;
    showFloatingDamage(anchor, 40, { toPlayer: false });
    const shown = anchor._children[anchor._children.length - 1];
    assert(anchor._children.length === before + 1 && shown.style.fontSize === `${floatingDamageScale(40, 100).fontPx}px` && shown.style.getPropertyValue('--fd-pop') === floatingDamageScale(40, 100).pop,
        "showFloatingDamage : taille et grossissement calculés sur les PV max de l'ennemi");
    gameState.currentEnemy = null;
}
