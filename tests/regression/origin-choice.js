// origin-choice.js — tests régression : chantier 13, lot 2 (écrans de choix de la race puis de la classe à l'étage 3, badges, fiche d'origine,
// ordre avec le Pacte du Crawler et l'émission DeathWatch, sauvegarde). Voir app.js (section « ORIGINES : CHOIX ») et CHANTIERS.md.
const { assert, resetTransientState } = require('./_helpers.js');

const reachFloor3 = ({ saveEnabled = true, pact = false } = {}) => {
    resetTransientState();
    gameState.saveEnabled = saveEnabled;
    gameState.currentFloor = 2;
    gameState.pendingNextFloorAnomalies = { floor: 3, anomalies: pact ? [ANOMALY_CATALOG.find(a => a.id === 'PACTE_DU_CRAWLER')] : [] };
    advanceToNextFloor();
};
const withStore = (fn) => {
    const store = {};
    const original = global.localStorage;
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
    try { fn(store); } finally { global.localStorage = original; }
};

// --- Déclenchement : étage 3 d'une vraie partie, une seule fois ---
{
    reachFloor3({ saveEnabled: false });
    assert(gameState.currentFloor === 3 && !gameState.raceChoicePending && !gameState.race, "Hors vraie partie (saveEnabled faux) : aucun écran de choix");
    reachFloor3();
    assert(gameState.currentFloor === 3 && gameState.raceChoicePending === true && gameState.classChoicePending === false, "Étage 3 d'une vraie partie : l'écran de la race s'ouvre");
    assert(isActionBlocked(), "Le choix bloque les actions du joueur");
    assert(gameState.pendingOriginOffers && gameState.pendingOriginOffers.kind === 'race' && gameState.pendingOriginOffers.offers.length === 3, "3 cartes de race proposées");
    resetTransientState(); gameState.saveEnabled = true; gameState.currentFloor = 3; gameState.race = 'troll';
    advanceToNextFloor();
    assert(gameState.currentFloor === 4 && !gameState.raceChoicePending, "Étage 4 : plus de choix");
    resetTransientState(); gameState.saveEnabled = true; gameState.currentFloor = 1; advanceToNextFloor();
    assert(gameState.currentFloor === 2 && !gameState.raceChoicePending, "Étage 2 : pas de choix");
    resetTransientState(); gameState.saveEnabled = true; gameState.currentFloor = 4; gameState.race = null; advanceToNextFloor();
    assert(gameState.currentFloor === 5 && !gameState.raceChoicePending && !gameState.race, "Un crawler sans race au-delà de l'étage 3 (ancienne sauvegarde) n'est jamais concerné");
    resetTransientState();
}

// --- Les deux écrans successifs, sélection puis confirmation ---
{
    reachFloor3();
    const raceOffers = gameState.pendingOriginOffers.offers.map(o => o.key);
    assert(confirmOriginChoice() === false && !gameState.race, "Confirmer sans sélection : refusé");
    assert(selectOrigin('inconnue') === false && selectOrigin(Object.keys(ORIGIN_RACES).find(k => !raceOffers.includes(k))) === false, "Une carte hors des 3 proposées est refusée");
    const pick = raceOffers[1];
    assert(selectOrigin(pick) && gameState.pendingOriginOffers.selected === pick && !gameState.race, "Sélectionner n'applique rien (le choix n'est pas encore confirmé)");
    assert(ui.btnRaceConfirm.disabled === false && ui.btnRaceConfirm.innerText.includes(ORIGIN_RACES[pick].short), "Le bouton de confirmation nomme la carte sélectionnée");
    assert(selectOrigin(raceOffers[2]) && gameState.pendingOriginOffers.selected === raceOffers[2], "On peut changer de sélection avant de confirmer");
    selectOrigin(pick);
    assert(confirmOriginChoice() === true, "Confirmer la race");
    assert(gameState.race === pick && gameState.raceChoicePending === false && gameState.classChoicePending === true, "La race est posée, l'écran de la classe s'ouvre");
    assert(gameState.pendingOriginOffers.kind === 'class' && gameState.pendingOriginOffers.offers.length === 3 && gameState.pendingOriginOffers.selected === null, "3 cartes de classe, aucune sélection héritée");
    assert(isActionBlocked(), "Toujours bloqué pendant l'écran de la classe");
    assert(applyPlayerHeal(0) === 0 && gameState.maxHp === Math.round(100 * (config.origins.races[pick].maxHpMult || 1)), "Les passifs de la race choisie s'appliquent déjà (lot 1)");
    const classPick = gameState.pendingOriginOffers.offers[0].key;
    selectOrigin(classPick);
    confirmOriginChoice();
    assert(gameState.crawlerClass === classPick && !gameState.classChoicePending && !gameState.raceChoicePending && gameState.pendingOriginOffers === null, "La classe est posée, plus rien ne bloque");
    assert(gameState.showChoicePending === true, "Classe confirmée : l'émission DeathWatch de l'étage 3 s'ouvre (vraie partie)");
    answerShow('refuse');
    assert(!isActionBlocked(), "Les actions du joueur sont débloquées une fois l'émission passée");
    assert(ui.raceChoiceOverlay.classList.contains('hidden') && ui.classChoiceOverlay.classList.contains('hidden'), "Les deux écrans sont refermés");
    assert(confirmOriginChoice() === false && selectOrigin(classPick) === false, "Plus de choix en cours : confirmer et sélectionner sont sans effet");
    resetTransientState();
}

// --- Cartes : contenu affiché (effets, défaut, explication, synergie) ---
{
    reachFloor3();
    const html = ui.raceChoiceCards.innerHTML;
    gameState.pendingOriginOffers.offers.forEach(o => {
        const r = ORIGIN_RACES[o.key];
        assert(html.includes(r.name) && r.effects.every(e => html.includes(e)) && html.includes(o.reason), `Carte de race ${o.key} : nom, effets et explication`);
        if (r.flaw) assert(html.includes(r.flaw), `Carte de race ${o.key} : défaut affiché`);
    });
    assert((html.match(/data-origin-key=/g) || []).length === 3, "Trois cartes dans l'écran de la race");
    resetTransientState();
    // Synergie affichée sur la carte de classe pour la race choisie.
    resetTransientState(); gameState.saveEnabled = true; gameState.race = 'troll'; applyRace('troll');
    gameState.pendingOriginOffers = { kind: 'class', offers: [{ key: 'brawler', reason: 'x', conditionMet: true }, { key: 'duelist', reason: 'y', conditionMet: false }, { key: 'trickster', reason: 'z', conditionMet: false }], selected: null };
    gameState.classChoicePending = true;
    renderOriginChoice();
    assert(ui.classChoiceCards.innerHTML.includes("Cadre supérieur du pugilat") && (ui.classChoiceCards.innerHTML.match(/Synergie avec votre race/g) || []).length === 1, "Carte de classe : la synergie Troll + Bagarreur est signalée, et elle seule");
    resetTransientState();
}

// --- Ordre : origine, puis Pacte du Crawler, puis émission DeathWatch ---
{
    reachFloor3({ pact: true });
    assert(gameState.raceChoicePending && !gameState.pactChoicePending && gameState.pendingPactAfterOrigin === true, "Pacte tiré à l'étage 3 : il attend la fin du choix d'origine (jamais deux écrans à la fois)");
    assert(!gameState.showChoicePending && gameState.pendingShowAfterPact, "L'émission attend aussi");
    selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
    assert(gameState.classChoicePending && !gameState.pactChoicePending, "Entre la race et la classe, le Pacte reste en attente");
    selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
    assert(gameState.pactChoicePending === true && gameState.pendingPactAfterOrigin === false && !gameState.showChoicePending, "Classe confirmée : le Pacte s'ouvre");
    choosePactBlessing('hp');
    assert(gameState.showChoicePending === true && !gameState.pactChoicePending, "Pacte résolu : l'émission s'ouvre en dernier");
    resetTransientState();
    reachFloor3();
    assert(gameState.raceChoicePending && !gameState.showChoicePending && gameState.pendingShowAfterPact, "Sans Pacte : l'émission attend la fin du choix");
    selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
    selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
    assert(gameState.showChoicePending === true && !gameState.pendingShowAfterPact, "Classe confirmée : l'émission s'ouvre");
    resetTransientState();
}

// --- Badges et fiche d'origine ---
{
    resetTransientState();
    updateOriginUI();
    assert(ui.raceStatus.classList.contains('hidden') && ui.classStatus.classList.contains('hidden'), "Sans race ni classe : aucun badge");
    applyRace('goblin'); gameState.crawlerClass = 'trickster';
    updateOriginUI();
    assert(!ui.raceStatus.classList.contains('hidden') && ui.raceStatus.innerText.includes('Gobelin') && ui.raceStatus.title.includes('PV max −10 %'), "Badge de race : nom court et infobulle avec effets et défaut");
    assert(!ui.classStatus.classList.contains('hidden') && ui.classStatus.innerText.includes('Filou') && ui.classStatus.title.includes('Disparition'), "Badge de classe : nom et infobulle avec la capacité");
    const html = buildOriginSheetHtml();
    assert(html.includes('Gobelin de caniveau') && html.includes('Filou') && html.includes('Disparition') && html.includes('1 fois par combat'), "Fiche : race, classe et capacité");
    assert(html.includes('Roi des caniveaux') && html.includes('esquive 2 ripostes'), "Fiche : la synergie Gobelin + Filou est affichée");
    gameState.crawlerClass = 'duelist';
    assert(!buildOriginSheetHtml().includes('✨'), "Fiche : aucune synergie pour Gobelin + Duelliste");
    gameState.crawlerClass = 'trickster';
    openOriginSheet();
    assert(!ui.itemInspectOverlay.classList.contains('hidden') && ui.itemInspectBody.innerHTML.includes('Gobelin'), "Un toucher sur le badge ouvre la fiche d'origine");
    closeItemInspect();
    resetTransientState(); updateOriginUI();
    openOriginSheet();
    assert(ui.itemInspectOverlay.classList.contains('hidden'), "Sans origine, la fiche ne s'ouvre pas");
    assert(Object.values(ORIGIN_RACES).every(r => r.short), "Chaque race a un nom court pour son badge");
}

// --- Saut DEV, sauvegarde et restauration ---
{
    resetTransientState(); gameState.saveEnabled = true;
    devJumpToUrbanFloor();
    assert(gameState.currentFloor === 3 && gameState.race && gameState.crawlerClass && !gameState.raceChoicePending && !gameState.classChoicePending, "Saut DEV : race et classe tirées au hasard, aucun écran de choix");
    resetTransientState();

    withStore((store) => {
        reachFloor3(); gameState.playerName = 'Orig';
        saveGame();
        assert(JSON.parse(store[saveKeyForName('Orig')]).raceChoicePending === true, "Sauvegarde pendant l'écran de la race : le choix en attente est écrit");
        resetTransientState(); gameState.playerName = 'Autre';
        restoreSaveForName('Orig');
        assert(gameState.raceChoicePending === true && gameState.pendingOriginOffers && gameState.pendingOriginOffers.kind === 'race' && !ui.raceChoiceOverlay.classList.contains('hidden'), "Restauration pendant l'écran de la race : l'écran est rouvert");
        selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
        saveGame();
        assert(JSON.parse(store[saveKeyForName('Orig')]).classChoicePending === true, "Sauvegarde pendant l'écran de la classe");
        const race = gameState.race;
        resetTransientState(); gameState.playerName = 'Autre';
        restoreSaveForName('Orig');
        assert(gameState.race === race && gameState.classChoicePending === true && !gameState.raceChoicePending, "Restauration pendant l'écran de la classe : la race est conservée, l'écran de la classe est rouvert");
        selectOrigin(gameState.pendingOriginOffers.offers[0].key); confirmOriginChoice();
        const cls = gameState.crawlerClass;
        saveGame();
        resetTransientState(); gameState.playerName = 'Autre';
        restoreSaveForName('Orig');
        assert(gameState.race === race && gameState.crawlerClass === cls && !gameState.raceChoicePending && !gameState.classChoicePending && !isActionBlocked(), "Restauration après le choix : race et classe retrouvées, rien ne bloque");
        // Clé de classe inconnue ou absente : aucune classe, jamais celle d'un crawler chargé avant.
        const saved = JSON.parse(store[saveKeyForName('Orig')]);
        saved.crawlerClass = 'inconnue'; store[saveKeyForName('Orig')] = JSON.stringify(saved);
        gameState.crawlerClass = 'brawler';
        restoreSaveForName('Orig');
        assert(gameState.crawlerClass === null, "Clé de classe inconnue : aucune classe");
        delete saved.crawlerClass; store[saveKeyForName('Orig')] = JSON.stringify(saved);
        gameState.crawlerClass = 'brawler';
        restoreSaveForName('Orig');
        assert(gameState.crawlerClass === null, "Ancienne sauvegarde sans classe : jamais celle d'un crawler chargé avant");
    });
    resetTransientState();
}
