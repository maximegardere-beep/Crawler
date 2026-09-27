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
        assert(document.getElementById('safehouse-scene-crawler').innerHTML.includes(SCENE_CRAWLER_SVG), "Scène de salle sécurisée : le crawler est présent");
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
    const causes = Object.keys(EPITAPH_TEMPLATES).filter(k => k !== 'mobFaible');
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
    const saved = { urbanMap: gameState.urbanMap, district: gameState.currentDistrict, enemy: gameState.currentEnemy, inCombat: gameState.inCombat };
    gameState.currentDistrict = Object.keys(districts)[2];
    gameState.urbanMap = null;
    assert(resolveCombatBackdrop().key === gameState.currentDistrict, "Étage classique : combat dans le décor du quartier");
    gameState.urbanMap = {
        citiesById: { a: { id: 'a', name: 'Faubourg' } }, currentCityId: 'a',
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

    Object.assign(gameState, { urbanMap: saved.urbanMap, currentDistrict: saved.district, currentEnemy: saved.enemy, inCombat: saved.inCombat });
    ['cbd'].forEach(p => { delete lastBackdropKeys[p]; delete vignetteKeys[p]; });
    resetTransientState();
}
