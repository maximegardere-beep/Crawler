// urban-map.js — tests régression : carte des étages urbains (chantier 12 « villes explorables », voir
// NOTES_VILLES.md) — la carte stylisée des étages classiques (floormap.js) dessine aussi les villes, les
// routes et les repaires ; scène d'exploration et bouton Carte sur tous les étages.
const { assert, resetTransientState } = require('./_helpers.js');

// buildUrbanMapSvg() (via buildFloorMapSvg()) : ville en « ??? » tant qu'aucune de ses salles n'est visitée,
// puis son nom ; routes par tronçon selon le brouillard ; repères (boutique, escalier) ; pion.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    const start = fm.citiesById[fm.currentCityId];
    const other = Object.values(fm.citiesById).find(c => c.id !== start.id);
    let svg = buildFloorMapSvg(fm, { landmarks: listFloorLandmarks() });
    assert(svg.includes(start.name) && !svg.includes(other.name), "Carte urbaine : nom de la ville de départ, jamais celui d'une ville inconnue");
    assert(svg.includes('floor-map-pawn') && !/undefined|NaN/.test(svg), "Carte urbaine : pion du crawler, aucune valeur manquante");
    const firstRoad = fm.geometry.roads.find(r => r.a === start.id || r.b === start.id);
    const nearSeg = firstRoad.a === start.id ? firstRoad.segmentIds[0] : firstRoad.segmentIds[firstRoad.segmentIds.length - 1];
    assert(floorMapRoomState(fm, fm.roomsById[nearSeg]) === 'seen' && svg.includes(`data-room-id="${nearSeg}"`), "Carte urbaine : le premier tronçon d'une route partant de la place est aperçu et dessiné");
    const farSeg = firstRoad.a === start.id ? firstRoad.segmentIds[firstRoad.segmentIds.length - 1] : firstRoad.segmentIds[0];
    assert(!svg.includes(`data-room-id="${farSeg}"`), "Carte urbaine : un tronçon inconnu n'est pas dessiné (brouillard)");

    // Toute la ville voisine visitée : son nom apparaît, ses repères aussi.
    other.roomIds.forEach(id => { fm.roomsById[id].visited = true; });
    svg = buildFloorMapSvg(fm, { landmarks: listFloorLandmarks() });
    assert(svg.includes(other.name), "Carte urbaine : le nom d'une ville apparaît une fois visitée");

    // Toucher un tronçon de route (diagonal ou non) : distance au segment, pas à sa boîte englobante.
    fm.roomsById[nearSeg].visited = true;
    const seg = fm.roomsById[nearSeg].seg;
    const S = FLOOR_MAP_CELL;
    const mid = { x: (seg.x1 + seg.x2) / 2 * S, y: (seg.y1 + seg.y2) / 2 * S };
    assert(floorMapHitTest(fm, mid.x, mid.y) === nearSeg, "Carte urbaine : toucher le milieu d'un tronçon le sélectionne");
    resetTransientState();
}

// Repères urbains : escalier gardé 👑 puis libre 🪜, Sortie 🚪, marchand 🛒, professeur 🎓, auberge, repaire 💀/🏆.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    Object.values(fm.roomsById).forEach(r => { r.visited = true; });
    const stairs = Object.values(fm.roomsById).find(r => r.type === 'stairs');
    stairs.guarded = true;
    let marks = listFloorLandmarks();
    const icon = id => (marks.find(m => m.roomId === id) || {}).icon;
    assert(icon(stairs.id) === '👑', "Repère : escalier gardé 👑");
    stairs.defeated = true;
    marks = listFloorLandmarks();
    assert(icon(stairs.id) === '🪜', "Repère : escalier libre 🪜 une fois le gardien vaincu");
    const shop = Object.values(fm.roomsById).find(r => r.type === 'shop');
    const trainer = Object.values(fm.roomsById).find(r => r.type === 'trainer');
    const lairRoom = Object.values(fm.roomsById).find(r => r.type === 'lair');
    assert(icon(shop.id) === '🛒' && icon(trainer.id) === '🎓', "Repères : marchand 🛒, professeur 🎓");
    assert(icon(lairRoom.id) === '💀', "Repère : repaire 💀 tant qu'il n'est pas nettoyé");
    fm.lairsById[lairRoom.lairId].cleared = true;
    marks = listFloorLandmarks();
    assert(icon(lairRoom.id) === '🏆', "Repère : repaire nettoyé 🏆");
    const inn = Object.values(fm.roomsById).find(r => r.type === 'safe');
    assert(marks.find(m => m.roomId === inn.id).label.startsWith('Auberge'), "Repère : l'auberge de chaque ville");
    assert(floorRoomLabel(fm.roomsById[fm.startRoomId]).startsWith('Place'), "Libellé : la place d'une ville");

    resetTransientState();
    gameState.currentFloor = config.urbanFloors.finalFloor;
    generateUrbanFloorMap();
    const exit = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'stairs');
    exit.visited = true;
    exit.defeated = true;
    assert(listFloorLandmarks().find(m => m.roomId === exit.id).icon === '🚪', "Repère : Sortie 🚪 de l'étage final");
    resetTransientState();
}

// ===================================================================
// Scène d'exploration : dernière ligne du journal sous la scène, scène d'arrivée d'étage, bouton Carte
// (#btn-toggle-map) qui ouvre/ferme la carte de l'étage, et toucher la scène qui explore — sur tous les
// étages (un étage urbain s'explore aussi, chantier 12).
// ===================================================================
{
    resetTransientState();
    const saved = { floor: gameState.currentFloor, floorMap: gameState.floorMap, district: gameState.currentDistrict, timeLeft: gameState.timeLeft };
    const lastLine = document.getElementById('explore-last-line');
    const fullLog = document.getElementById('full-log');
    const before = fullLog.children.length;
    logEvent('Premier message', 'normal');
    logEvent('Second message', 'danger');
    assert(lastLine.innerText === 'Second message' && lastLine.className.includes('text-red-400'), "logEvent() hors combat : seule la dernière ligne reste sous la scène, avec sa couleur");
    assert(fullLog.children.length === before + 2, "logEvent() : chaque message rejoint le journal complet");

    // Étage classique : scène du quartier, titre « Étage N », toucher la scène explore.
    gameState.currentFloor = 1;
    generateFloorMap();
    showFloorArrivalScene();
    assert(ui.sceneTitle.innerText === `Étage ${gameState.currentFloor}` && document.getElementById('explore-scene-vignette').innerHTML.includes('translate'), "Arrivée sur un étage classique : scène du quartier, titre de l'étage");
    updateUI();
    assert(!ui.btnToggleMap.classList.contains('hidden'), "Étage classique : bouton Carte présent");
    assert(ui.floorMapOverlay.classList.contains('hidden') === !mapPanelOpen, "Étage classique : la carte de l'étage suit le bouton Carte");
    const timeBefore = gameState.timeLeft;
    onExploreSceneActivated();
    assert(gameState.timeLeft < timeBefore || isActionBlocked() || gameState.inCombat, "Étage classique : toucher la scène explore");
    resetTransientState(); // l'exploration ci-dessus a pu ouvrir un combat ou un choix
    gameState.safehouseChoicePending = true;
    updateUI();
    assert(ui.exploreScene.classList.contains('hidden') && !ui.sceneTitle.classList.contains('hidden'), "Salle sécurisée : sa propre scène remplace la scène d'exploration (titre conservé)");
    gameState.safehouseChoicePending = false;
    updateUI();
    assert(!ui.exploreScene.classList.contains('hidden'), "Choix résolu : la scène d'exploration revient");
    resetTransientState();

    // Étage urbain : scène de la ville de départ, même carte, toucher la scène explore aussi.
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const start = gameState.floorMap.citiesById[gameState.floorMap.currentCityId];
    showFloorArrivalScene();
    assert(ui.sceneTitle.innerText === start.name && document.getElementById('explore-scene-vignette').innerHTML.includes(start.name), "Arrivée sur un étage urbain : panneau de la ville de départ");
    toggleMapPanel(true);
    assert(!ui.btnToggleMap.classList.contains('hidden') && !ui.floorMapOverlay.classList.contains('hidden'), "Étage urbain : bouton Carte visible, carte stylisée ouverte");
    assert(ui.floorMapSvg.innerHTML.includes(start.name), "Étage urbain : la carte dessine la ville de départ");
    ui.btnToggleMap.dispatch('click', {});
    assert(ui.floorMapOverlay.classList.contains('hidden') && ui.btnToggleMap.innerText.includes('Carte'), "Bouton Carte : ferme la carte");
    const timeUrban = gameState.timeLeft;
    onExploreSceneActivated();
    assert(gameState.timeLeft < timeUrban, "Étage urbain : toucher la scène explore (-1 H)");
    resetTransientState();
    gameState.bossChoicePending = true;
    updateUI();
    assert(ui.btnToggleMap.classList.contains('hidden') && ui.floorMapOverlay.classList.contains('hidden'), "Situation en cours : carte et bouton masqués, la scène montre la situation");

    resetTransientState();
    toggleMapPanel(true);
    Object.assign(gameState, { currentFloor: saved.floor, floorMap: saved.floorMap, currentDistrict: saved.district, timeLeft: saved.timeLeft });
    updateUI();
}
