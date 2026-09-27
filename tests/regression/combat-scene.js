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
