// engine/origins-choice.js — Origines : choix de la race et de la classe (étage 3).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// ORIGINES : CHOIX DE LA RACE ET DE LA CLASSE À L'ÉTAGE 3 (chantier 13, lot 2 — voir origins.js et CHANTIERS.md)
// ==========================================
// À l'arrivée sur l'étage 3 d'une vraie partie (`gameState.saveEnabled`, comme l'émission DeathWatch), deux écrans successifs : la race puis la
// classe, chacun avec 3 cartes tirées par pickOriginOffers() (« conditions remplies d'abord »). Toucher une carte la sélectionne, le bouton de
// confirmation valide : le choix est définitif pour le run. Ordre à l'arrivée : origine, puis Pacte du Crawler (s'il est tiré), puis émission.
// Un crawler sans race qui a déjà dépassé l'étage 3 (ancienne sauvegarde) n'est jamais concerné. Les effets de classe viennent au lot 3.
function originChoiceDue() {
    return !!gameState.saveEnabled && gameState.currentFloor === config.origins.chooseFloor && !gameState.race;
}

function originEntry(kind, key) {
    const catalog = kind === 'race' ? ORIGIN_RACES : ORIGIN_CLASSES;
    return (key && catalog[key]) || null;
}

function triggerOriginChoice(kind) {
    gameState.raceChoicePending = kind === 'race';
    gameState.classChoicePending = kind === 'class';
    gameState.pendingOriginOffers = { kind, offers: pickOriginOffers(kind, gameState), selected: null };
    setSceneHeader('🧬', kind === 'race' ? 'Choix de la race' : 'Choix de la classe', 'Origines', 'pact');
    logEvent(kind === 'race'
        ? "🧬 Étage 3 : le Donjon exige de savoir ce que vous êtes. Choisissez une race."
        : "🧬 Maintenant, ce que vous savez faire. Choisissez une classe.", "danger");
    renderOriginChoice();
}
function triggerRaceChoice() { triggerOriginChoice('race'); }
function triggerClassChoice() { triggerOriginChoice('class'); }

function hideOriginOverlays() {
    if (ui.raceChoiceOverlay) ui.raceChoiceOverlay.classList.add('hidden');
    if (ui.classChoiceOverlay) ui.classChoiceOverlay.classList.add('hidden');
}

// HTML d'une carte de choix (texte interne au jeu : aucune saisie du joueur, donc rien à échapper).
function buildOriginCardHtml(kind, offer, selected) {
    const entry = originEntry(kind, offer.key);
    if (!entry) return '';
    const lines = kind === 'race'
        ? entry.effects.map(e => `<li class="text-emerald-300">＋ ${e}</li>`).join('') + (entry.flaw ? `<li class="text-red-300">－ ${entry.flaw}</li>` : '')
        : `<li class="text-amber-300">⚡ ${entry.ability}</li><li class="text-emerald-300">＋ ${entry.style}</li>`;
    const synergy = kind === 'class' ? originSynergyFor(gameState.race, offer.key) : null;
    const synergyHtml = synergy ? `<p class="mt-1 text-[10px] text-fuchsia-300">✨ Synergie avec votre race — « ${synergy.title} » : ${synergy.effect}</p>` : '';
    const reasonColor = offer.conditionMet ? 'text-gray-400' : 'text-gray-600';
    // Une carte de race montre le crawler à son aspect (corps teinté ou dessiné, sprites/crawler-races.js).
    const portrait = kind === 'race' ? `<div class="shrink-0 w-[44px] pt-1">${buildRacePortraitSvg(offer.key, 44)}</div>` : '';
    return `<button type="button" data-origin-key="${offer.key}" class="origin-card w-full text-left p-3 rounded-lg border-2 transition-all active:scale-[0.99] flex gap-3 ${selected ? 'border-amber-400 bg-amber-900/20' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}">
            ${portrait}
            <div class="min-w-0">
            <p class="font-bold text-sm text-gray-100">${entry.icon} ${entry.name}</p>
            <ul class="mt-1 text-[11px] leading-snug space-y-0.5">${lines}</ul>
            ${synergyHtml}
            <p class="mt-1 text-[10px] italic ${reasonColor}">${offer.reason}</p>
            </div>
        </button>`;
}

function renderOriginChoice() {
    const pending = gameState.pendingOriginOffers;
    hideOriginOverlays();
    if (!pending) return;
    const kind = pending.kind;
    const overlay = kind === 'race' ? ui.raceChoiceOverlay : ui.classChoiceOverlay;
    const cards = kind === 'race' ? ui.raceChoiceCards : ui.classChoiceCards;
    const confirm = kind === 'race' ? ui.btnRaceConfirm : ui.btnClassConfirm;
    if (!overlay || !cards || !confirm) return;
    cards.innerHTML = pending.offers.map(o => buildOriginCardHtml(kind, o, o.key === pending.selected)).join('');
    const chosen = originEntry(kind, pending.selected);
    confirm.disabled = !chosen;
    confirm.innerText = chosen ? `Confirmer : ${chosen.short || chosen.name}` : 'Choisissez une carte';
    overlay.classList.remove('hidden');
}

// Sélectionne une carte de l'écran en cours (jamais une origine hors des 3 cartes proposées).
function selectOrigin(key) {
    const pending = gameState.pendingOriginOffers;
    if (!pending || !pending.offers.some(o => o.key === key)) return false;
    pending.selected = key;
    renderOriginChoice();
    return true;
}

// Valide la carte sélectionnée : la race ouvre l'écran de la classe, la classe termine le choix.
function confirmOriginChoice() {
    const pending = gameState.pendingOriginOffers;
    if (!pending || !pending.selected || !originEntry(pending.kind, pending.selected)) return false;
    const key = pending.selected;
    if (pending.kind === 'race') {
        if (!applyRace(key)) return false;
        const race = ORIGIN_RACES[key];
        logEvent(`${race.icon} Vous êtes désormais ${race.name}. ${race.flaw ? `Défaut inclus : ${race.flaw.toLowerCase()}.` : "Aucun défaut : le Donjon est vexé."}`, "success");
        triggerClassChoice();
    } else {
        gameState.crawlerClass = key;
        const cls = ORIGIN_CLASSES[key];
        logEvent(`${cls.icon} Classe : ${cls.name}.`, "success");
        const synergy = originSynergyFor(gameState.race, key);
        if (synergy) logEvent(`✨ Synergie : « ${synergy.title} » — ${synergy.effect}.`, "success");
        finishOriginChoice();
    }
    updateUI();
    return true;
}

// Fin des deux écrans : rend la main, ou ouvre ce qui attendait derrière (Pacte du Crawler, puis émission DeathWatch).
function finishOriginChoice() {
    recordRunEvent('origin'); // succès « Pièce d'identité »
    gameState.raceChoicePending = false;
    gameState.classChoicePending = false;
    gameState.pendingOriginOffers = null;
    hideOriginOverlays();
    if (gameState.pendingPactAfterOrigin) {
        gameState.pendingPactAfterOrigin = false;
        triggerPactChoice();
    } else if (gameState.pendingShowAfterPact) {
        const lastFloor = gameState.pendingShowAfterPact;
        gameState.pendingShowAfterPact = null;
        triggerShow(lastFloor);
    }
}

// Saut DEV (devJumpToUrbanFloor) : tire une race et une classe au hasard au lieu d'ouvrir les deux écrans.
function rollDevOrigin() {
    const races = Object.keys(ORIGIN_RACES), classes = Object.keys(ORIGIN_CLASSES);
    applyRace(races[Math.floor(Math.random() * races.length)]);
    gameState.crawlerClass = classes[Math.floor(Math.random() * classes.length)];
}

// Fiche d'origine : bonus, défauts, capacité, synergie (HTML interne, rien à échapper).
function buildOriginSheetHtml() {
    const race = originEntry('race', gameState.race), cls = originEntry('class', gameState.crawlerClass);
    const raceHtml = race ? `<div class="flex gap-3"><div class="shrink-0 w-[44px]">${buildRacePortraitSvg(race.key, 44)}</div><div class="min-w-0"><p class="font-bold text-sm text-gray-100">${race.icon} ${race.name}</p>
            <ul class="mt-1 text-[11px] space-y-0.5">${race.effects.map(e => `<li class="text-emerald-300">＋ ${e}</li>`).join('')}${race.flaw ? `<li class="text-red-300">－ ${race.flaw}</li>` : ''}</ul></div></div>` : '';
    const classHtml = cls ? `<div class="mt-3"><p class="font-bold text-sm text-gray-100">${cls.icon} ${cls.name}</p>
            <ul class="mt-1 text-[11px] space-y-0.5"><li class="text-amber-300">⚡ ${cls.ability} <span class="text-gray-500">(1 fois par combat)</span></li><li class="text-emerald-300">＋ ${cls.style}</li></ul></div>` : '';
    const synergy = race && cls ? originSynergyFor(race.key, cls.key) : null;
    const synergyHtml = synergy ? `<div class="mt-3 p-2 rounded border border-fuchsia-800 bg-fuchsia-950/30"><p class="font-bold text-[12px] text-fuchsia-300">✨ « ${synergy.title} »</p><p class="text-[11px] text-fuchsia-200">${synergy.effect}</p></div>` : '';
    return raceHtml + classHtml + synergyHtml;
}

function openOriginSheet() {
    if (!ui.itemInspectOverlay || !(gameState.race || gameState.crawlerClass)) return;
    ui.itemInspectBody.innerHTML = buildOriginSheetHtml();
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = '#0f766e';
    renderInspectActions([]);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Badges permanents sous le nom (race, classe) ; un toucher ouvre la fiche d'origine.
function updateOriginUI() {
    updateClassAbilityUI(); // masquée hors combat
    const race = originEntry('race', gameState.race), cls = originEntry('class', gameState.crawlerClass);
    if (ui.raceStatus) {
        ui.raceStatus.classList.toggle('hidden', !race);
        if (race) { ui.raceStatus.innerText = `${race.icon} ${race.short}`; ui.raceStatus.title = `${race.name} — ${race.effects.join(', ')}${race.flaw ? ` · Défaut : ${race.flaw}` : ''}`; }
    }
    if (ui.classStatus) {
        ui.classStatus.classList.toggle('hidden', !cls);
        if (cls) { ui.classStatus.innerText = `${cls.icon} ${cls.name}`; ui.classStatus.title = `${cls.name} — ${cls.ability} · ${cls.style}`; }
    }
}
