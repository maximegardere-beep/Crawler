// necrologie.js — tests régression : Nécrologie sarcastique : generateEpitaph()/recordEpitaph(), câblage dans gameOver().
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L1455 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Nécrologie sarcastique : generateEpitaph()/recordEpitaph() (règles spéciales mob faible/backfire/
// fuites/objet ridicule) et leur câblage dans gameOver() (cause dérivée du contexte réel de mort).
// ===================================================================

// generateEpitaph() : cause 'combat' générique — placeholders bien remplacés, aucun {{...}} résiduel.
{
    resetTransientState();
    gameState.currentFloor = 5;
    gameState.level = 3;
    const originalRandom = Math.random;
    Math.random = () => 0; // Premier template de chaque pool (voir pick())
    const text = generateEpitaph({ cause: 'combat', enemyName: "Gobelin Test" });
    Math.random = originalRandom;
    assert(text.includes("Gobelin Test"), "generateEpitaph() : {{mob}} remplacé par le nom du tueur");
    assert(text.includes("5"), "generateEpitaph() : {{etage}} remplacé par l'étage courant");
    assert(!/\{\{.*?\}\}/.test(text), "generateEpitaph() : aucun placeholder résiduel dans le texte final");
}

// generateEpitaph() : causes sans mob (trap/bleed/timeout) — pool dédié, pas de {{mob}} attendu.
{
    resetTransientState();
    gameState.currentFloor = 2;
    for (const cause of ['trap', 'bleed', 'timeout']) {
        const text = generateEpitaph({ cause, enemyName: null });
        assert(typeof text === 'string' && text.length > 0, `generateEpitaph() : produit un texte non vide pour la cause '${cause}'`);
        assert(!/\{\{.*?\}\}/.test(text), `generateEpitaph() : aucun placeholder résiduel pour la cause '${cause}'`);
    }
}

// Règle spéciale : mob de niveau très inférieur (deltaNiveau >= NECROLOGIE_WEAK_MOB_DELTA) -> pool
// mobFaible dédié, distinct du pool 'combat' générique.
{
    resetTransientState();
    gameState.currentFloor = 1; // "niveau" du mob ≈ étage (voir getMobLevelEquivalent())
    gameState.level = 1 + NECROLOGIE_WEAK_MOB_DELTA; // Écart tout juste suffisant pour déclencher la règle
    const originalRandom = Math.random;
    Math.random = () => 0;
    const text = generateEpitaph({ cause: 'combat', enemyName: "Faiblard Test" });
    Math.random = originalRandom;
    assert(text === EPITAPH_TEMPLATES.mobFaible[0]
        .replace(/\{\{mob\}\}/g, "Faiblard Test")
        .replace(/\{\{etage\}\}/g, 1)
        .replace(/\{\{deltaNiveau\}\}/g, NECROLOGIE_WEAK_MOB_DELTA),
        "generateEpitaph() : mob très inférieur -> pool mobFaible dédié utilisé");

    // Juste sous le seuil : reste sur le pool 'combat' générique.
    gameState.level = NECROLOGIE_WEAK_MOB_DELTA; // Écart d'un cran sous le seuil
    Math.random = () => 0;
    const textBelow = generateEpitaph({ cause: 'combat', enemyName: "Faiblard Test" });
    Math.random = originalRandom;
    assert(textBelow === EPITAPH_TEMPLATES.combat[0]
        .replace(/\{\{mob\}\}/g, "Faiblard Test")
        .replace(/\{\{etage\}\}/g, 1)
        .replace(/\{\{crawler\}\}/g, gameState.playerName),
        "generateEpitaph() : écart juste sous le seuil -> pool 'combat' générique conservé");
}

// Règle spéciale : cause 'backfire' -> pool dédié, jamais le pool 'combat' générique.
{
    resetTransientState();
    gameState.currentFloor = 6;
    gameState.level = 6; // Aucun écart de niveau ici : seule la cause décide du pool
    const originalRandom = Math.random;
    Math.random = () => 0;
    const text = generateEpitaph({ cause: 'backfire', enemyName: "Punisher Test" });
    Math.random = originalRandom;
    assert(text === EPITAPH_TEMPLATES.backfire[0].replace(/\{\{etage\}\}/g, 6),
        "generateEpitaph() : cause 'backfire' -> pool dédié utilisé");
}

// Mention spéciale : 3+ fuites ce run -> phrase ajoutée en fin d'épitaphe ; en dessous du seuil, absente.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.fleesThisRun = NECROLOGIE_FLEE_THRESHOLD;
    const originalRandom = Math.random;
    Math.random = () => 0;
    const withMention = generateEpitaph({ cause: 'trap', enemyName: null });
    gameState.fleesThisRun = NECROLOGIE_FLEE_THRESHOLD - 1;
    const withoutMention = generateEpitaph({ cause: 'trap', enemyName: null });
    Math.random = originalRandom;
    assert(withMention.includes(String(NECROLOGIE_FLEE_THRESHOLD)), "generateEpitaph() : mention des fuites présente à partir du seuil");
    assert(!withoutMention.includes(EPITAPH_FLEE_MENTIONS[0].split('{{')[0]), "generateEpitaph() : aucune mention de fuite sous le seuil");
}

// Mention spéciale : objet équipé "ridicule" (jokeItem: true) -> mention ajoutée ; absent sinon.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.equipment.weapon = { name: "Extincteur Cabossé", jokeItem: true };
    const originalRandom = Math.random;
    Math.random = () => 0;
    const withItem = generateEpitaph({ cause: 'trap', enemyName: null });
    gameState.equipment.weapon = { name: "Épée Normale" }; // Pas de jokeItem
    const withoutItem = generateEpitaph({ cause: 'trap', enemyName: null });
    Math.random = originalRandom;
    assert(withItem.includes("Extincteur Cabossé"), "generateEpitaph() : mention de l'objet ridicule équipé présente");
    assert(!withoutItem.includes("Extincteur Cabossé"), "generateEpitaph() : aucune mention d'objet ridicule s'il n'y en a pas");
}

// recordEpitaph() : journal plafonné à NECROLOGIE_MAX_ENTRIES, plus récente en premier.
{
    resetTransientState();
    for (let i = 0; i < NECROLOGIE_MAX_ENTRIES + 5; i++) {
        gameState.currentFloor = i;
        recordEpitaph(`Épitaphe #${i}`, { cause: 'trap' });
    }
    assert(gameState.necrologie.length === NECROLOGIE_MAX_ENTRIES, "recordEpitaph() : journal plafonné à NECROLOGIE_MAX_ENTRIES entrées");
    assert(gameState.necrologie[0].text === `Épitaphe #${NECROLOGIE_MAX_ENTRIES + 4}`, "recordEpitaph() : la plus récente entrée est en tête");
}

// gameOver() : cause dérivée du contexte réel (trap/bleed/combat/backfire/timeout), épitaphe affichée
// et enregistrée dans gameState.necrologie.
{
    resetTransientState();
    gameState.currentFloor = 1;
    gameState.hp = 0;
    gameOver(false, 'trap');
    assert(gameState.necrologie.length === 1, "gameOver() : une épitaphe est bien enregistrée à la mort");
    assert(gameState.necrologie[0].cause === 'trap', "gameOver() : cause 'trap' correctement attribuée");
    assert(String(ui.gameOverEpitaph.innerText).length > 0, "gameOver() : l'épitaphe est affichée sur l'écran de mort");

    resetTransientState();
    gameState.hp = 0;
    gameOver(false, 'bleed');
    assert(gameState.necrologie[0].cause === 'bleed', "gameOver() : cause 'bleed' correctement attribuée");

    resetTransientState();
    gameState.hp = 0;
    gameOver(true);
    assert(gameState.necrologie[0].cause === 'timeout', "gameOver() : cause 'timeout' correctement attribuée");

    resetTransientState();
    gameState.hp = 0;
    gameOver(false, { name: "Ogre Test" });
    assert(gameState.necrologie[0].cause === 'combat', "gameOver() : cause 'combat' par défaut pour un tueur objet, sans backfire en cours");

    resetTransientState();
    gameState.hp = 0;
    gameState.lastPlayerActionWasBackfire = true;
    gameOver(false, { name: "Ogre Test" });
    assert(gameState.necrologie[0].cause === 'backfire', "gameOver() : cause 'backfire' attribuée si le sort du joueur vient de partir en flop");
}

// tryPlayerAction() : remet lastPlayerActionWasBackfire à faux au tout début de CHAQUE action, pour
// qu'un backfire ne "contamine" jamais un décès survenant lors d'une action ultérieure sans rapport.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Backfire", hp: 30, maxHp: 30, atk: 5, def: 2, status: {} };
    gameState.lastPlayerActionWasBackfire = true;
    tryPlayerAction();
    assert(gameState.lastPlayerActionWasBackfire === false, "tryPlayerAction() : réinitialise lastPlayerActionWasBackfire en tout début d'action");
}

// attemptFlee() : incrémente gameState.fleesThisRun UNIQUEMENT sur une fuite réussie.
{
    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Fuite", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    const originalRandom = Math.random;
    Math.random = () => 0; // < fleeChance (60%) -> fuite réussie
    attemptFlee();
    Math.random = originalRandom;
    assert(gameState.fleesThisRun === 1, "attemptFlee() : incrémente fleesThisRun sur une fuite réussie");

    resetTransientState();
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Cobaye Fuite Ratée", hp: 30, maxHp: 30, atk: 5, def: 2, status: {}, alerted: false };
    Math.random = () => 0.99; // >= fleeChance -> fuite ratée
    attemptFlee();
    Math.random = originalRandom;
    assert(gameState.fleesThisRun === 0, "attemptFlee() : n'incrémente pas fleesThisRun sur une fuite ratée");
}
