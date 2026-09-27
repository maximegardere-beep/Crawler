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
