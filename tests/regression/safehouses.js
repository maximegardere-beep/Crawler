// safehouses.js — tests régression : Salle sécurisée à choix explicite (chantier "QoL/équilibrage")
// — enterRoom()/restAtSafehouse()/leaveSafehouse() dans app.js. Nouveau domaine (voir CLAUDE.md,
// section Tests) : ajouté à la liste de require() de regression.test.js.
const { assert, resetTransientState } = require('./_helpers.js');

function findSafeRoom() {
    return Object.values(gameState.floorMap.roomsById).find(r => r.type === 'safe');
}

// enterRoom() sur une salle sécurisée : plus de soin/coût de temps automatique — pose le choix en
// attente, affiche la zone, enregistre le lieu connu, isActionBlocked() devient vrai.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.hp = 50; // PV manquants : si un soin auto avait lieu, ça se verrait immédiatement
    const hpBefore = gameState.hp;
    const timeBefore = gameState.timeLeft;

    enterRoom(room);
    assert(gameState.hp === hpBefore, "enterRoom() sur une salle sécurisée ne soigne plus automatiquement");
    assert(gameState.timeLeft === timeBefore, "enterRoom() sur une salle sécurisée ne coûte rien à l'entrée elle-même");
    assert(gameState.safehouseChoicePending === true, "enterRoom() pose safehouseChoicePending");
    assert(gameState.pendingSafehouseRoomId === room.id, "enterRoom() mémorise la salle en attente");
    assert(room.visited === true, "enterRoom() marque la salle visitée comme les autres");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === false, "enterRoom() affiche #safehouse-choice-zone");
    assert(isActionBlocked() === true, "isActionBlocked() est vrai tant que le choix de salle sécurisée est en attente");
    assert(listFloorLandmarks().some(m => m.roomId === room.id && m.kind === 'safe'), "enterRoom() : la salle est marquée sur la carte dès l'entrée");
}

// Sieste / Sommeil réparateur : coût en temps de config.safehouse[kind].cost, soin = healPct des PV
// PERDUS (et du mana manquant si un sort est équipé), referment le choix.
function enterSafeRoomWith({ hp, mana = 0, spell = false, timeLeft = null }) {
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.maxHp = gameState.baseMaxHp = 100;
    gameState.hp = hp;
    gameState.equipment.spell = spell ? { spellName: "Test", spellCategory: 'melee', baseDmg: 5, manaCost: 5, category: 'scrolls' } : null;
    gameState.mana = mana;
    if (timeLeft !== null) gameState.timeLeft = timeLeft;
    enterRoom(room);
    return room;
}
{
    assert(config.safehouse.nap.cost === 2 && config.safehouse.nap.healPct === 0.25, "Sieste : 2H pour 25% des PV perdus (valeurs validées)");
    assert(config.safehouse.sleep.cost === 8 && config.safehouse.sleep.healPct === 1, "Sommeil réparateur : 8H pour 100% des PV perdus (valeurs validées)");

    enterSafeRoomWith({ hp: 20, mana: 40, spell: true });
    const timeBefore = gameState.timeLeft;
    assert(ui.btnNapSafehouse.innerHTML.includes('+20 PV') && ui.btnNapSafehouse.innerHTML.includes('+15 mana') && ui.btnNapSafehouse.innerHTML.includes('-2H'),
        "Bouton Sieste : affiche le coût et ce qu'il rendra (25% de 80 PV perdus, 25% de 60 mana manquant)");
    assert(ui.btnSleepSafehouse.innerHTML.includes('+80 PV') && ui.btnSleepSafehouse.innerHTML.includes('-8H'), "Bouton Sommeil : affiche le coût et le soin complet");
    restAtSafehouse('nap');
    assert(gameState.timeLeft === timeBefore - 2, "Sieste : déduit exactement 2H");
    assert(gameState.hp === 40, "Sieste : rend 25% des PV perdus (20 -> 40 sur 100)");
    assert(gameState.mana === 55, "Sieste : rend 25% du mana manquant quand un sort est équipé (40 -> 55)");
    assert(gameState.safehouseChoicePending === false && gameState.pendingSafehouseRoomId === null, "Sieste : referme le choix");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === true, "Sieste : masque #safehouse-choice-zone");

    enterSafeRoomWith({ hp: 20, mana: 40, spell: true });
    const timeBefore2 = gameState.timeLeft;
    restAtSafehouse('sleep');
    assert(gameState.timeLeft === timeBefore2 - 8, "Sommeil réparateur : déduit exactement 8H");
    assert(gameState.hp === 100 && gameState.mana === gameState.maxMana, "Sommeil réparateur : PV et mana au maximum");

    enterSafeRoomWith({ hp: 60, mana: 10, spell: false });
    restAtSafehouse('nap');
    assert(gameState.hp === 70 && gameState.mana === 10, "Sieste sans sort équipé : soigne les PV, ne touche pas au mana");

    enterSafeRoomWith({ hp: 100 });
    assert(ui.btnNapSafehouse.innerHTML.includes('+0 PV'), "PV déjà pleins : la sieste annonce +0 PV");

    enterSafeRoomWith({ hp: 20 });
    gameState.anomalyEffects.healingMult = 0.5;
    restAtSafehouse('sleep');
    assert(gameState.hp === 60, "Sommeil réparateur sous PEAU_DE_VERRE : le soin est réduit comme tout soin (80 × 0.5)");
    gameState.anomalyEffects.healingMult = 1;

    enterSafeRoomWith({ hp: 20 });
    restAtSafehouse('inconnu');
    assert(gameState.safehouseChoicePending === true && gameState.hp === 20, "Repos d'un type inconnu : aucun effet");
}

// leaveSafehouse() : gratuit, aucun effet, referme le choix — la salle reste un lieu connu réutilisable.
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = findSafeRoom();
    gameState.floorMap.currentRoomId = room.id;
    gameState.hp = 10;
    const timeBefore = gameState.timeLeft;

    enterRoom(room);
    leaveSafehouse();

    assert(gameState.hp === 10, "leaveSafehouse() n'a aucun effet sur les PV");
    assert(gameState.timeLeft === timeBefore, "leaveSafehouse() ne coûte aucun temps");
    assert(gameState.safehouseChoicePending === false, "leaveSafehouse() referme le choix");
    assert(ui.safehouseChoiceZone.classList.contains('hidden') === true, "leaveSafehouse() masque #safehouse-choice-zone");
    assert(listFloorLandmarks().some(m => m.roomId === room.id && m.kind === 'safe'), "leaveSafehouse() : la salle reste marquée sur la carte (repartir n'annule rien)");
}

// Garde-fou : chaque bouton de repos est désactivé (et restAtSafehouse() reste un no-op) si SON coût
// ferait tomber timeLeft à 0 ou moins — un repos ne doit JAMAIS déclencher gameOver(true).
{
    enterSafeRoomWith({ hp: 10, timeLeft: 8 }); // Sieste possible (8-2 > 0), sommeil non (8-8 = 0)
    assert(ui.btnNapSafehouse.disabled === false, "Sieste possible avec 8H restantes");
    assert(ui.btnSleepSafehouse.disabled === true, "Sommeil désactivé si ses 8H feraient tomber timeLeft à 0");
    restAtSafehouse('sleep'); // Appelé directement malgré le bouton désactivé : doit rester un no-op protégé
    assert(gameState.hp === 10 && gameState.timeLeft === 8 && gameState.safehouseChoicePending === true, "Sommeil bloqué : aucun soin, aucun temps déduit, choix toujours ouvert");

    enterSafeRoomWith({ hp: 10, timeLeft: 2 });
    assert(ui.btnNapSafehouse.disabled === true && ui.btnSleepSafehouse.disabled === true, "Avec 2H restantes, les deux repos sont désactivés");
    restAtSafehouse('nap');
    assert(gameState.hp === 10 && gameState.timeLeft === 2 && gameState.safehouseChoicePending === true, "Sieste bloquée : no-op protégé");
    assert(ui.gameOverOverlay.classList.contains('hidden') === true, "Le repos ne doit jamais déclencher l'écran Game Over");
}

// REPAS_DE_FAMILLE (anomalies.js) : les deux repos deviennent gratuits en temps, jamais bloqués par le garde-fou.
{
    ['nap', 'sleep'].forEach(kind => {
        resetTransientState();
        gameState.anomalyEffects.freeSafehouseMeals = true;
        enterSafeRoomWith({ hp: 10, timeLeft: 1 });
        gameState.anomalyEffects.freeSafehouseMeals = true;
        updateSafehouseRestButtons();
        const btn = kind === 'nap' ? ui.btnNapSafehouse : ui.btnSleepSafehouse;
        assert(btn.disabled === false && btn.innerHTML.includes('0H'), `REPAS_DE_FAMILLE : ${kind} reste actif et gratuit même à timeLeft très bas`);
        restAtSafehouse(kind);
        assert(gameState.timeLeft === 1 && gameState.hp > 10, `REPAS_DE_FAMILLE : ${kind} ne déduit aucun temps et soigne normalement`);
        gameState.anomalyEffects.freeSafehouseMeals = false;
    });
}
