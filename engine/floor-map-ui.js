// engine/floor-map-ui.js — Carte stylisée des étages (rendu, zoom, voyage).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ---------- Carte stylisée des étages classiques (chantier 5, voir NOTES_CARTE.md) ----------
// Rendu pur dans floormap.js (buildFloorMapSvg()) ; ici, le panneau : vue (zoom + caméra, préférences
// d'affichage — variables de module comme mapPanelOpen, jamais sauvegardées), salle sélectionnée et bulle
// « Y aller / Annuler » (travelToRoom()), glissement et toucher (attachés UNE fois, voir plus bas).
let floorMapZoom = FLOOR_MAP_DEFAULT_ZOOM;
let floorMapCamera = null;      // null = centrée sur le crawler ; {x, y} = centre choisi en glissant
let floorMapSelectedRoomId = null;
let floorMapLiveView = null;    // fenêtre affichée au dernier rendu (monde), pour le glissement et le toucher

// Contenu de la bulle pour une salle (pure vis-à-vis du DOM) : { title, text } ou null si hors d'atteinte.
function describeFloorMapTravel(roomId) {
    const plan = planTravelToRoom(roomId);
    if (!plan) return null;
    const risk = plan.ambushChance > 0 ? `, risque d'embuscade ${Math.round(plan.ambushChance)} %` : "";
    if (plan.exploreStep && plan.timeCost === 0) {
        return { title: `Explorer : ${plan.label}`, text: "Un pas dans l'inconnu (-1 H), comme en touchant la scène, mais par là." };
    }
    if (plan.exploreStep) {
        return { title: `Explorer : ${plan.label}`, text: `Trajet par le chemin connu (-${plan.timeCost} H${risk}), puis un pas dans l'inconnu (-1 H).` };
    }
    return { title: `Aller : ${plan.label}`, text: `Trajet par le chemin connu : -${plan.timeCost} H${risk}.` };
}

// Légende sous la carte, selon le type d'étage.
const FLOOR_MAP_LEGENDS = {
    classic: "Plein = visité · pointillé « ? » = aperçu · 👑 boss · 🪜 escalier · 🟡 vous · avenues : trajets deux fois plus rapides et plus sûrs",
    urban: "Plein = visité · pointillé « ? » = aperçu · villes calmes, routes dangereuses · 🛒 marchand · 🎓 professeur · 🎰 salle de jeux · 👑 gardien · 🪜 escalier · 💀 repaire · 🟡 vous"
};

function updateFloorMapUI() {
    if (!ui.floorMapSvg) return;
    const fm = gameState.floorMap;
    if (ui.floorMapLegend) ui.floorMapLegend.innerText = FLOOR_MAP_LEGENDS[isUrbanFloor() ? 'urban' : 'classic'];
    if (!fm || !fm.geometry) {
        ui.floorMapSvg.innerHTML = "";
        floorMapSelectedRoomId = null;
        if (ui.floorMapBubble) ui.floorMapBubble.classList.add('hidden');
        return;
    }
    const view = floorMapDefaultView(fm, floorMapZoom, floorMapCamera);
    floorMapLiveView = view;
    ui.floorMapSvg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    if (floorMapSelectedRoomId && (floorMapSelectedRoomId === fm.currentRoomId || !planTravelToRoom(floorMapSelectedRoomId))) floorMapSelectedRoomId = null;
    ui.floorMapSvg.innerHTML = buildFloorMapSvg(fm, { landmarks: listFloorLandmarks(), selectedRoomId: floorMapSelectedRoomId });

    const info = floorMapSelectedRoomId ? describeFloorMapTravel(floorMapSelectedRoomId) : null;
    if (ui.floorMapBubble) ui.floorMapBubble.classList.toggle('hidden', !info);
    if (info) {
        if (ui.floorMapBubbleTitle) ui.floorMapBubbleTitle.innerText = info.title;
        if (ui.floorMapBubbleText) ui.floorMapBubbleText.innerText = info.text;
    }
}

// Toucher la carte au point (monde) : sélectionne la salle connue la plus proche (bulle), ou referme la bulle.
function selectFloorMapRoomAt(x, y) {
    const fm = gameState.floorMap;
    if (!fm) return null;
    const id = floorMapHitTest(fm, x, y);
    floorMapSelectedRoomId = id && id !== fm.currentRoomId && planTravelToRoom(id) ? id : null;
    updateFloorMapUI();
    return floorMapSelectedRoomId;
}

// Bouton « Y aller » de la bulle.
function confirmFloorMapTravel() {
    const id = floorMapSelectedRoomId;
    floorMapSelectedRoomId = null;
    if (!id) { updateFloorMapUI(); return null; }
    const plan = travelToRoom(id);
    updateFloorMapUI();
    return plan;
}

function cancelFloorMapTravel() {
    floorMapSelectedRoomId = null;
    updateFloorMapUI();
}

// ＋ / － (index de FLOOR_MAP_ZOOMS : 0 = vue d'ensemble) et ◎ (retour sur le crawler).
function zoomFloorMap(delta) {
    floorMapZoom = Math.max(0, Math.min(FLOOR_MAP_ZOOMS.length - 1, floorMapZoom + delta));
    updateFloorMapUI();
}

function recenterFloorMap() {
    floorMapCamera = null;
    updateFloorMapUI();
}

// Glissement (souris et tactile) et toucher sur la carte : attachés UNE seule fois au <svg> (jamais à
// chaque rendu). Pendant le glissement, seul le viewBox bouge ; à la fin, la caméra est mémorisée. Un
// relâchement sous 6 px de mouvement est un toucher, résolu par position MONDE (floorMapHitTest()) —
// pas par le `click` natif, peu fiable après une capture de pointeur (constaté en navigateur réel).
function attachFloorMapPointerHandlers(svg) {
    if (!svg || !svg.addEventListener) return;
    let drag = null;
    const toWorld = (e, view) => {
        const rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0, width: view.w, height: view.h };
        // preserveAspectRatio « meet » : même échelle sur les deux axes, fenêtre centrée.
        const scale = Math.max(view.w / (rect.width || view.w), view.h / (rect.height || view.h));
        const offX = (rect.width * scale - view.w) / 2, offY = (rect.height * scale - view.h) / 2;
        return { x: view.x + (e.clientX - rect.left) * scale - offX, y: view.y + (e.clientY - rect.top) * scale - offY, scale };
    };
    svg.addEventListener('pointerdown', (e) => {
        if (!floorMapLiveView) return;
        const w = toWorld(e, floorMapLiveView);
        drag = { startX: e.clientX, startY: e.clientY, view: { ...floorMapLiveView }, scale: w.scale, moved: false, pointerId: e.pointerId };
        if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ } }
    });
    svg.addEventListener('pointermove', (e) => {
        if (!drag || !gameState.floorMap) return;
        const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) <= 6) return;
        drag.moved = true;
        const moved = clampFloorMapView({ ...drag.view, x: drag.view.x - dx * drag.scale, y: drag.view.y - dy * drag.scale }, gameState.floorMap);
        floorMapLiveView = moved;
        svg.setAttribute('viewBox', `${moved.x} ${moved.y} ${moved.w} ${moved.h}`);
    });
    const end = (e) => {
        if (!drag) return;
        if (svg.releasePointerCapture && drag.pointerId !== undefined) { try { svg.releasePointerCapture(drag.pointerId); } catch (err) { /* déjà relâché */ } }
        if (drag.moved) {
            floorMapCamera = { x: floorMapLiveView.x + floorMapLiveView.w / 2, y: floorMapLiveView.y + floorMapLiveView.h / 2 };
        } else if (e && e.type === 'pointerup' && !isActionBlocked()) {
            const w = toWorld(e, drag.view);
            selectFloorMapRoomAt(w.x, w.y);
        }
        drag = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
}

// Point d'entrée unique pour "arriver" dans une pièce, que ce soit en explorant normalement ou en
// y voyageant depuis la carte (voir arriveAtDestination) : le comportement est donc identique
// dans les deux cas.
function enterRoom(room) {
    const firstVisit = !room.visited;
    room.visited = true;

    // Étage urbain (chantier 12) : place, boutique, professeur, escalier et repaire ont leur propre entrée.
    if (isUrbanFloor() && enterUrbanRoom(room, firstVisit)) return;

    if (room.type === 'boss') {
        if (room.defeated && room.guardsStairs) {
            offerStairsChoice({ kind: 'room', roomId: room.id }); // Retour à un escalier laissé pour plus tard
            return;
        }
        if (room.defeated) {
            setSceneHeader('🏚️', 'Antre Silencieuse', 'Exploration', 'emptyLair');
            logEvent("L'antre est silencieuse désormais ; le boss a déjà été vaincu.", "normal");
            return;
        }
        triggerBossEncounter(room);
        return;
    }

    if (room.type === 'safe') {
        // Entrée à choix explicite (chantier "QoL/équilibrage" — voir restAtSafehouse()/
        // leaveSafehouse() plus bas) : plus de soin automatique ni de coût de temps à l'entrée
        // elle-même. La salle est marquée sur la carte dès l'entrée (visitée), quelle que soit l'issue
        // choisie ensuite (comportement conservé de l'ancienne version).
        const safehouse = room.safehouse || { name: "Salle Sécurisée", icon: "🏥", desc: "" };
        gameState.safehouseChoicePending = true;
        gameState.pendingSafehouseRoomId = room.id;

        setSceneHeader(safehouse.icon, safehouse.name, 'Repos');
        logEvent(
            firstVisit
                ? `Vous découvrez : ${safehouse.name}. ${safehouse.desc}`
                : `Vous retrouvez ${safehouse.name}, toujours aussi accueillant.`,
            "info"
        );

        updateSafehouseRestButtons();
        ui.safehouseChoiceZone.classList.remove('hidden');
        renderScene('safehouse');
        updateUI();
        return;
    }

    // Pièce normale
    if (firstVisit) {
        if (room.cafetRoom) {
            triggerCafetRoom(room);
            return;
        }
        resolveCardEvent();
    } else {
        setSceneHeader('🌑', 'Chemin Connu', 'Exploration', 'knownPath');
        logEvent("Vous retraversez un couloir déjà exploré, rien de neuf.", "normal");
    }
}

// Libellés des deux repos d'une salle sécurisée (boutons #btn-nap-safehouse/#btn-sleep-safehouse).
const SAFEHOUSE_REST_LABELS = { nap: '💤 Sieste', sleep: '🛌 Sommeil réparateur' };

// Ce qu'un repos rendrait maintenant (pure) : `healPct` des PV perdus et du mana manquant — le mana
// seulement si un sort est équipé. Montants AVANT le multiplicateur de soin des anomalies
// (PEAU_DE_VERRE), appliqué ensuite par applyPlayerHeal() comme à tout soin.
function safehouseRestAmounts(kind, state = gameState) {
    const rest = config.safehouse[kind];
    const hp = Math.round(rest.healPct * Math.max(0, state.maxHp - state.hp));
    const mana = state.equipment.spell ? Math.round(rest.healPct * Math.max(0, state.maxMana - state.mana)) : 0;
    return { hp, mana };
}

// Vrai si le repos `kind` est possible : garde-fou, un repos ne doit JAMAIS pouvoir amener timeLeft à 0
// (voir CLAUDE.md), sauf REPAS_DE_FAMILLE (anomalies.js) qui rend les deux repos gratuits en temps.
function canRestAtSafehouse(kind) {
    return !!gameState.anomalyEffects.freeSafehouseMeals || gameState.timeLeft - config.safehouse[kind].cost > 0;
}

// Met à jour les deux boutons de repos à l'entrée dans la salle : coût en temps, PV (et mana) rendus, et
// bouton désactivé dès l'affichage si le temps manque — visible avant toute tentative, pas seulement au clic.
function updateSafehouseRestButtons() {
    const free = gameState.anomalyEffects.freeSafehouseMeals;
    [['nap', ui.btnNapSafehouse], ['sleep', ui.btnSleepSafehouse]].forEach(([kind, btn]) => {
        if (!btn) return;
        const { hp, mana } = safehouseRestAmounts(kind);
        const lines = [free ? '0H' : `-${config.safehouse[kind].cost}H`, `+${hp} PV`];
        if (gameState.equipment.spell) lines.push(`+${mana} mana`);
        const can = canRestAtSafehouse(kind);
        btn.disabled = !can;
        btn.title = can ? "" : "Pas assez de temps pour vous reposer";
        btn.innerHTML = `<span class="block mb-0.5">${SAFEHOUSE_REST_LABELS[kind]}</span>`
            + lines.map(l => `<span class="block text-[10px] normal-case tracking-normal opacity-80 whitespace-nowrap">${l}</span>`).join('');
    });
}

// Repos dans une salle sécurisée (voir enterRoom()) : `kind` 'nap' (Sieste) ou 'sleep' (Sommeil
// réparateur), voir config.safehouse. Coûte `cost` heures (sauf REPAS_DE_FAMILLE, anomalies.js — repas
// gratuits) et rend `healPct` des PV perdus, plus la même part du mana manquant si un sort est équipé
// (safehouseRestAmounts()). Le bouton est déjà désactivé si ce coût ferait tomber timeLeft à 0 (voir
// updateSafehouseRestButtons()) : la vérification ici est une sécurité redondante, jamais le chemin normal.
function restAtSafehouse(kind = 'nap') {
    if (!gameState.safehouseChoicePending || !config.safehouse[kind]) return;
    if (!canRestAtSafehouse(kind)) return;
    const cost = config.safehouse[kind].cost;
    const freeMeals = gameState.anomalyEffects.freeSafehouseMeals;

    const amounts = safehouseRestAmounts(kind);
    if (!freeMeals) gameState.timeLeft = Math.max(0, gameState.timeLeft - cost);
    const healed = applyPlayerHeal(amounts.hp);
    let manaNote = "";
    if (amounts.mana > 0) {
        const manaBefore = gameState.mana;
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + amounts.mana);
        const manaGained = Math.round(gameState.mana - manaBefore);
        if (manaGained > 0) manaNote = `, +${manaGained} mana`;
    }

    const costNote = freeMeals ? "repas offerts par la maison, aucun temps perdu" : `-${cost}H`;
    const intro = kind === 'sleep' ? "Vous dormez à poings fermés" : "Vous piquez un petit somme";
    logEvent(`${intro} (${costNote}, +${healed} PV${manaNote}).`, "success");

    // Le compagnon se repose aussi : même part de ses PV perdus (et il se relève s'il était à terre),
    // et un repos partagé renforce sa loyauté.
    const companion = gameState.companion;
    if (companion) {
        const companionHealed = healCompanion(Math.round(config.safehouse[kind].healPct * (companion.maxHp - companion.hp)));
        const gained = changeCompanionLoyalty(config.companions.loyalty[kind]);
        logEvent(`${companion.name} en profite aussi (+${companionHealed} PV${gained > 0 ? `, +${gained} loyauté` : ""}).`, "success");
        updateCompanionUI();
    }

    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    ui.safehouseChoiceZone.classList.add('hidden');
    recordRunEvent('rest');
    updateUI();
}

// Choix "Partir" d'une salle sécurisée : gratuit, aucun effet — la salle reste visitée et déjà
// marquée sur la carte (voir listFloorLandmarks()), simplement réutilisable lors d'un futur passage.
function leaveSafehouse() {
    if (!gameState.safehouseChoicePending) return;
    gameState.safehouseChoicePending = false;
    gameState.pendingSafehouseRoomId = null;
    ui.safehouseChoiceZone.classList.add('hidden');
    logEvent("Vous reprenez votre chemin sans vous attarder.", "info");
    updateUI();
}

// CAFET_ASSOMBRIE (anomalies.js) : déclenché UNE fois, à la première visite de la pièce taguée
// room.cafetRoom (voir generateFloorMap()) — remplace l'événement aléatoire normal de cette pièce par
// un piège sévère suivi d'un trésor nettement supérieur à la normale (powerScore maximal). Réutilise
// exactement applyPlayerDamage()/gameOver()/addLoot(), aucune nouvelle formule de dégâts ou de loot.
function triggerCafetRoom(room) {
    const trapDmg = applyTrialToDamage(applyStarterBuffToDamage(applyRaceDamageMods(Math.floor(Math.random() * 12) + 10, 'trap'))); // 10 à 21 PV : nettement au-dessus d'un piège normal (~5-15)
    applyPlayerDamage(trapDmg);
    setSceneHeader('🕯️', 'Cafétéria Assombrie', 'Danger', 'cafeteria');
    logEvent(`Un piège vicieux se déclenche dans l'obscurité de la cafétéria abandonnée ! (-${trapDmg} PV)`, "danger");
    recordRunEvent('trap');
    if (gameState.hp <= 0) {
        gameOver(false, 'trap');
        return;
    }
    addLoot({ source: 'treasure' }); // Trésor nettement supérieur à la normale : monte d'un palier de rareté (voir rollLootRarity())
    logEvent("Malgré le piège, un trésor bien caché récompense votre prudence.", "success");
}

// Présente le choix "combattre maintenant / repérer et partir" pour une salle de boss (celle qui
// garde l'escalier y compris). Le boss est généré une seule fois et mis en cache sur la pièce
// (room.bossInstance), pour rester le même monstre si le joueur repère puis revient plus tard.
function triggerBossEncounter(room) {
    if (!room.bossInstance) {
        const district = roomDistrict(room) || gameState.currentDistrict;
        room.bossInstance = generateBoss(district) || generateMob(district);
    }
    const boss = room.bossInstance;
    gameState.pendingBossEncounter = { roomId: room.id, guardsStairs: room.guardsStairs === true };
    gameState.bossChoicePending = true;

    // Étage urbain (salle de l'escalier au fond de sa ville) : vignette du gardien devant l'escalier ou la Sortie.
    const urbanStairs = room.type === 'stairs';
    const title = urbanStairs && room.isExit ? "Gardien de la Sortie" : room.guardsStairs ? "Gardien de l'Escalier" : 'Boss de Quartier';
    setSceneHeader('👑', boss.name, title, urbanStairs ? { key: 'urbanGuardian', enemy: boss, isExit: room.isExit === true } : { key: 'bossSpotted', enemy: boss });
    logEvent(
        urbanStairs && room.isExit
            ? `🎬 Vous atteignez la Sortie... gardée par ${boss.name} !`
            : room.guardsStairs
                ? `🎬 Vous découvrez l'escalier vers l'étage ${gameState.currentFloor + 1}, gardé par ${boss.name} !`
                : `Vous découvrez l'antre de ${boss.name}, un boss de quartier !`,
        "danger"
    );
    logEvent("Le combattre maintenant, ou repérer l'endroit pour y revenir plus tard ?", "info");
    ui.bossChoiceZone.classList.remove('hidden');
    updateUI();
}

// Bouton "Combattre" de la zone de choix de boss (boss de quartier, gardien d'escalier ou de la Sortie).
function fightBossNow() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    if (!encounter) return;

    const room = gameState.floorMap.roomsById[encounter.roomId];
    gameState.pendingStairAfterCombat = !!encounter.guardsStairs;
    gameState.pendingBossRoomId = encounter.roomId;
    initiateCombat(room.bossInstance);
}

// Bouton "Repérer et partir" de la zone de choix de boss : l'antre reste marquée 👑 sur la carte,
// sans y descendre/combattre.
function retreatFromBoss() {
    const encounter = gameState.pendingBossEncounter;
    gameState.bossChoicePending = false;
    ui.bossChoiceZone.classList.add('hidden');
    gameState.pendingBossEncounter = null;
    // L'antre reste marquée 👑 sur la carte (salle visitée, boss non vaincu — voir listFloorLandmarks()).
    logEvent(encounter ? "Vous repérez soigneusement l'endroit (marqué sur votre carte) et repartez explorer." : "Vous repérez soigneusement l'endroit et repartez explorer.", "info");
    updateUI();
}
