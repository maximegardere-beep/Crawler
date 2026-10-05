// ==========================================
// CARTE STYLISÉE DES ÉTAGES CLASSIQUES (chantier 5 « rework de la carte », voir NOTES_CARTE.md)
// ==========================================
// Rendu PUR (aucun DOM, aucun gameState) : à partir de gameState.floorMap (géométrie de floorgen.js), produit
// le contenu SVG de la carte — blocs teintés par quartier, avenues en larges bandes, salles et couloirs
// connus, brouillard (plein = visité, pointillé = aperçu, rien = inconnu), repères (👑 boss, 🪜 escalier,
// salle sûre, 🔒/🚪/⛓️ porte colossale du chantier 17) et pion du crawler. Le panneau, le zoom, le glissement et la bulle « Y aller » vivent dans
// app.js (updateFloorMapUI()). Chargé après floorgen.js, avant app.js.
// Étages urbains (chantier 12, floorMap.kind === 'urban') : villes en blocs clairs avec leur nom (« ??? » tant
// qu'aucune de leurs salles n'est visitée), routes en bandes d'asphalte découpées en tronçons, repaires en
// impasse — même brouillard, mêmes repères, même pion (buildUrbanMapSvg()).

const FLOOR_MAP_CELL = 10; // Unités monde par case (coordonnées du SVG)

// Niveaux de zoom : largeur de la fenêtre affichée, en unités monde (la hauteur suit FLOOR_MAP_ASPECT).
// Index 0 = vue d'ensemble de l'étage ; défaut = 1.
const FLOOR_MAP_ZOOMS = [560, 320, 190];
const FLOOR_MAP_DEFAULT_ZOOM = 1;
const FLOOR_MAP_ASPECT = 0.72; // hauteur / largeur de la fenêtre

// Teinte de chaque bloc (index de quartier), sobre et distincte ; les salles visitées prennent la même
// teinte, plus claire.
const FLOOR_MAP_BLOCK_TINTS = [
    { block: '#1e3a5f', room: '#3b6ea5', edge: '#7fb0e6' },
    { block: '#3f1f4f', room: '#7a4a96', edge: '#c49be0' },
    { block: '#1f4f33', room: '#3f8a5c', edge: '#8fd6a8' },
    { block: '#4f3a1a', room: '#96733a', edge: '#e0c08a' }
];

function fmEsc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// État d'une salle pour la carte : 'visited' | 'seen' (aperçue : voisine d'une salle visitée) | 'unknown'.
function floorMapRoomState(floorMap, room) {
    if (room.visited) return 'visited';
    return room.neighbors.some(e => floorMap.roomsById[e.to] && floorMap.roomsById[e.to].visited) ? 'seen' : 'unknown';
}

function fmCenter(room) {
    return { x: (room.x + room.w / 2) * FLOOR_MAP_CELL, y: (room.y + room.h / 2) * FLOOR_MAP_CELL };
}

// Point d'arrivée d'une porte sur l'avenue : perpendiculaire au bord du bloc, au milieu de la bande.
function fmDoorEnd(floorMap, room) {
    const q = floorMap.quadrants[room.quadrant];
    const aw = floorMap.geometry.avenueWidth;
    const c = fmCenter(room);
    const b = q.block;
    if (room.doorSide === 'left') return { x: (b.x - aw / 2) * FLOOR_MAP_CELL, y: c.y };
    if (room.doorSide === 'right') return { x: (b.x + b.w + aw / 2) * FLOOR_MAP_CELL, y: c.y };
    if (room.doorSide === 'top') return { x: c.x, y: (b.y - aw / 2) * FLOOR_MAP_CELL };
    return { x: c.x, y: (b.y + b.h + aw / 2) * FLOOR_MAP_CELL };
}

// Fenêtre par défaut (centrée sur la salle courante) pour un niveau de zoom, écrêtée à l'étage.
function floorMapDefaultView(floorMap, zoomIndex, camera) {
    const g = floorMap.geometry;
    const w = FLOOR_MAP_ZOOMS[Math.max(0, Math.min(FLOOR_MAP_ZOOMS.length - 1, zoomIndex))];
    const h = w * FLOOR_MAP_ASPECT;
    const room = floorMap.roomsById[floorMap.currentRoomId];
    const center = camera || (room ? fmCenter(room) : { x: g.width * FLOOR_MAP_CELL / 2, y: g.height * FLOOR_MAP_CELL / 2 });
    return clampFloorMapView({ x: center.x - w / 2, y: center.y - h / 2, w, h }, floorMap);
}

// Écrête une fenêtre {x, y, w, h} (monde) aux limites de l'étage (+ une petite marge) ; une fenêtre plus
// grande que l'étage est centrée sur lui.
function clampFloorMapView(view, floorMap) {
    const margin = FLOOR_MAP_CELL * 2;
    const W = floorMap.geometry.width * FLOOR_MAP_CELL, H = floorMap.geometry.height * FLOOR_MAP_CELL;
    const clampAxis = (pos, size, total) => (size >= total + 2 * margin ? (total - size) / 2 : Math.min(total + margin - size, Math.max(-margin, pos)));
    return { x: clampAxis(view.x, view.w, W), y: clampAxis(view.y, view.h, H), w: view.w, h: view.h };
}

// Salle connue (visitée ou aperçue) sous le point (monde), ou null — pour le toucher sur la carte.
// Tolérance `slack` (monde) autour des petites salles, confort tactile.
function floorMapHitTest(floorMap, x, y, slack = 6) {
    let best = null, bestDist = Infinity;
    Object.values(floorMap.roomsById).forEach(room => {
        if (floorMapRoomState(floorMap, room) === 'unknown') return;
        // Tronçon de route (étage urbain) : distance au segment, moins la demi-largeur de la bande.
        if (room.seg) {
            const S = FLOOR_MAP_CELL;
            const a = { x: room.seg.x1 * S, y: room.seg.y1 * S }, b = { x: room.seg.x2 * S, y: room.seg.y2 * S };
            const dx = b.x - a.x, dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            const d = Math.max(0, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) - S);
            if (d <= slack && d < bestDist) { best = room.id; bestDist = d; }
            return;
        }
        const rx = room.x * FLOOR_MAP_CELL, ry = room.y * FLOOR_MAP_CELL, rw = room.w * FLOOR_MAP_CELL, rh = room.h * FLOOR_MAP_CELL;
        const dx = Math.max(rx - x, 0, x - (rx + rw)), dy = Math.max(ry - y, 0, y - (ry + rh));
        const d = Math.hypot(dx, dy);
        if (d <= slack && d < bestDist) { best = room.id; bestDist = d; }
    });
    return best;
}

// Contenu SVG de la carte. `options` : { landmarks: [{ roomId, icon }], selectedRoomId }.
function buildFloorMapSvg(floorMap, options = {}) {
    if (floorMap.kind === 'urban') return buildUrbanMapSvg(floorMap, options);
    const S = FLOOR_MAP_CELL;
    const g = floorMap.geometry;
    const rooms = Object.values(floorMap.roomsById);
    const state = {};
    rooms.forEach(r => { state[r.id] = floorMapRoomState(floorMap, r); });
    const current = floorMap.roomsById[floorMap.currentRoomId];
    const out = [];

    out.push(`<rect x="${-S * 4}" y="${-S * 4}" width="${(g.width + 8) * S}" height="${(g.height + 8) * S}" fill="#07090d"/>`);

    // Blocs : fond teinté ; nom du quartier dès qu'une de ses salles est visitée.
    floorMap.quadrants.forEach((q, i) => {
        const t = FLOOR_MAP_BLOCK_TINTS[i % FLOOR_MAP_BLOCK_TINTS.length];
        const b = q.block;
        const known = q.roomIds.some(id => floorMap.roomsById[id].visited);
        out.push(`<rect x="${b.x * S}" y="${b.y * S}" width="${b.w * S}" height="${b.h * S}" rx="${S}" fill="${t.block}" opacity="${known ? 0.55 : 0.28}"/>`);
        out.push(`<text x="${(b.x + b.w / 2) * S}" y="${(b.y + b.h / 2) * S}" text-anchor="middle" dominant-baseline="central" font-size="${S * 1.6}" fill="${t.edge}" opacity="0.22" font-weight="bold">${fmEsc(known ? q.district : '???')}</text>`);
    });

    // Avenues : larges bandes (toujours visibles, c'est le plan de la ville) ; tronçon visité plus clair,
    // aperçu en pointillé.
    g.intersections.forEach(it => out.push(`<rect x="${it.x * S}" y="${it.y * S}" width="${it.w * S}" height="${it.h * S}" fill="#2a2f38"/>`));
    g.segments.forEach(seg => {
        const room = floorMap.roomsById[seg.id];
        const st = room ? state[room.id] : 'unknown';
        const fill = st === 'visited' ? '#3a414d' : '#1f242c';
        out.push(`<rect x="${seg.x * S}" y="${seg.y * S}" width="${seg.w * S}" height="${seg.h * S}" fill="${fill}" data-room-id="${seg.id}"/>`);
        const mid = seg.dir === 'h'
            ? `<line x1="${seg.x * S}" y1="${(seg.y + seg.h / 2) * S}" x2="${(seg.x + seg.w) * S}" y2="${(seg.y + seg.h / 2) * S}"`
            : `<line x1="${(seg.x + seg.w / 2) * S}" y1="${seg.y * S}" x2="${(seg.x + seg.w / 2) * S}" y2="${(seg.y + seg.h) * S}"`;
        out.push(`${mid} stroke="#6b7280" stroke-width="1" stroke-dasharray="6 6" opacity="${st === 'visited' ? 0.7 : 0.3}"/>`);
        if (st === 'seen') out.push(`<rect x="${seg.x * S + 1}" y="${seg.y * S + 1}" width="${seg.w * S - 2}" height="${seg.h * S - 2}" fill="none" stroke="#9ca3af" stroke-width="1.2" stroke-dasharray="4 3"/>`);
    });

    // Porte colossale du Concierge (chantier 17) : au carrefour central, toujours visible comme les avenues (c'est
    // un monument du plan), mais touchable seulement une fois visitée ou aperçue ; son état (scellée, ouverte,
    // rescellée) se lit au repère posé par listFloorLandmarks() (app.js).
    rooms.forEach(room => {
        if (room.zone !== 'gate') return;
        const st = state[room.id];
        const x = room.x * S, y = room.y * S, w = room.w * S, h = room.h * S;
        const known = st !== 'unknown';
        out.push(`<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="3" fill="${st === 'visited' ? '#3b1212' : '#1a0b0b'}" stroke="${known ? '#f97316' : '#7c2d12'}" stroke-width="${known ? 2 : 1.2}" class="floor-map-gate"${known ? ` data-room-id="${room.id}"` : ''}/>`);
        out.push(`<line x1="${x + w / 2}" y1="${y + 1}" x2="${x + w / 2}" y2="${y + h - 1}" stroke="#f97316" stroke-width="1" opacity="${known ? 0.7 : 0.35}"/>`);
        if (st === 'seen') out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#9ca3af" stroke-width="1.2" stroke-dasharray="4 3"/>`);
    });

    // Couloirs et portes connus : au moins une extrémité visitée, l'autre visitée ou aperçue.
    rooms.forEach(room => {
        if (room.zone !== 'block') return;
        room.neighbors.forEach(e => {
            const other = floorMap.roomsById[e.to];
            if (!other) return;
            const a = state[room.id], b = state[other.id];
            if (a === 'unknown' || b === 'unknown' || (a !== 'visited' && b !== 'visited')) return;
            const dashed = a !== 'visited' || b !== 'visited';
            if (e.kind === 'corridor' && room.id < other.id) {
                const p = fmCenter(room), q = fmCenter(other);
                out.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"${dashed ? ' stroke-dasharray="3 3" opacity="0.6"' : ' opacity="0.85"'}/>`);
            } else if (e.kind === 'door') {
                const p = fmCenter(room), q = fmDoorEnd(floorMap, room);
                out.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"${dashed ? ' stroke-dasharray="3 3" opacity="0.6"' : ' opacity="0.85"'}/>`);
            }
        });
    });

    // Salles des blocs : pleines si visitées, en pointillé avec « ? » si aperçues.
    rooms.forEach(room => {
        if (room.zone !== 'block') return;
        const st = state[room.id];
        if (st === 'unknown') return;
        const t = FLOOR_MAP_BLOCK_TINTS[room.quadrant % FLOOR_MAP_BLOCK_TINTS.length];
        const x = room.x * S, y = room.y * S, w = room.w * S, h = room.h * S;
        const selected = options.selectedRoomId === room.id;
        if (st === 'visited') {
            const fill = room.type === 'safe' ? '#2f6b4a' : room.type === 'boss' ? (room.defeated ? '#4b3a3a' : '#7f1d1d') : t.room;
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${selected ? '#facc15' : t.edge}" stroke-width="${selected ? 2.5 : 1}" data-room-id="${room.id}"/>`);
        } else {
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0b0e13" stroke="${selected ? '#facc15' : '#9ca3af'}" stroke-width="${selected ? 2.5 : 1.2}" stroke-dasharray="4 3" data-room-id="${room.id}"/>`);
            out.push(`<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.min(w, h) * 0.6 + 2}" fill="#9ca3af">?</text>`);
        }
    });
    // Tronçon d'avenue (ou porte colossale) sélectionné.
    if (options.selectedRoomId && floorMap.roomsById[options.selectedRoomId] && ['avenue', 'gate'].includes(floorMap.roomsById[options.selectedRoomId].zone)) {
        const r = floorMap.roomsById[options.selectedRoomId];
        out.push(`<rect x="${r.x * S}" y="${r.y * S}" width="${r.w * S}" height="${r.h * S}" fill="none" stroke="#facc15" stroke-width="2.5"/>`);
    }

    // Repères (👑 boss, 🪜 escalier, salle sûre) au centre de leur salle.
    (options.landmarks || []).forEach(m => {
        const room = floorMap.roomsById[m.roomId];
        if (!room) return;
        const c = fmCenter(room);
        out.push(`<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" font-size="${S * 1.5}">${fmEsc(m.icon)}</text>`);
    });

    // Pion du crawler.
    if (current) {
        const c = fmCenter(current);
        out.push(`<circle cx="${c.x}" cy="${c.y}" r="${S * 0.9}" fill="#facc15" stroke="#1f2937" stroke-width="2" class="floor-map-pawn"/>`);
    }
    return out.join('');
}

// Couleurs des étages urbains : villes en « plâtre » clair, salles selon leur rôle, routes en asphalte.
const URBAN_MAP_COLORS = {
    city: '#e7dcc0', cityEdge: '#f5ecd6',
    rooms: { plaza: '#8a7a55', alley: '#6b6150', inn: '#2f6b4a', merchant: '#7a5a2a', trainer: '#4a4f8a', arcade: '#8a2f6b', stairs: '#7f1d1d' },
    asphalt: '#3a414d', asphaltDim: '#23282f', lair: '#5a1f1f', lairCleared: '#4b4b4b'
};

// Contenu SVG d'un étage urbain (même options que buildFloorMapSvg()).
function buildUrbanMapSvg(floorMap, options = {}) {
    const S = FLOOR_MAP_CELL;
    const g = floorMap.geometry;
    const rooms = Object.values(floorMap.roomsById);
    const state = {};
    rooms.forEach(r => { state[r.id] = floorMapRoomState(floorMap, r); });
    const current = floorMap.roomsById[floorMap.currentRoomId];
    const known = id => state[id] && state[id] !== 'unknown';
    const dash = (a, b) => (state[a] !== 'visited' || state[b] !== 'visited');
    const out = [];

    out.push(`<rect x="${-S * 4}" y="${-S * 4}" width="${(g.width + 8) * S}" height="${(g.height + 8) * S}" fill="#07090d"/>`);

    // Villes : bloc clair dès qu'une de leurs salles est connue ; nom une fois visitée.
    Object.values(floorMap.citiesById || {}).forEach(city => {
        const ids = (city.roomIds || []).filter(id => floorMap.roomsById[id]);
        if (!ids.some(known)) return;
        const visited = ids.some(id => floorMap.roomsById[id].visited);
        out.push(`<rect x="${city.x * S}" y="${city.y * S}" width="${city.w * S}" height="${city.h * S}" rx="${S * 1.5}" fill="${URBAN_MAP_COLORS.city}" opacity="${visited ? 0.16 : 0.07}" stroke="${URBAN_MAP_COLORS.cityEdge}" stroke-opacity="${visited ? 0.35 : 0.15}"/>`);
        out.push(`<text x="${(city.x + city.w / 2) * S}" y="${(city.y - 1) * S}" text-anchor="middle" font-size="${S * 1.5}" font-weight="bold" fill="${URBAN_MAP_COLORS.cityEdge}" opacity="${visited ? 0.75 : 0.35}">${fmEsc(visited ? city.name : '???')}</text>`);
    });

    // Routes : bande d'asphalte par tronçon connu (plus claire si visité, pointillée si aperçu), bout de rue
    // jusqu'à la place.
    (g.roads || []).forEach(road => {
        road.segmentIds.forEach(id => {
            const room = floorMap.roomsById[id];
            if (!room || !known(id)) return;
            const { x1, y1, x2, y2 } = room.seg;
            const visited = state[id] === 'visited';
            out.push(`<line x1="${x1 * S}" y1="${y1 * S}" x2="${x2 * S}" y2="${y2 * S}" stroke="${visited ? URBAN_MAP_COLORS.asphalt : URBAN_MAP_COLORS.asphaltDim}" stroke-width="${S * 2}" stroke-linecap="butt" data-room-id="${id}"/>`);
            out.push(`<line x1="${x1 * S}" y1="${y1 * S}" x2="${x2 * S}" y2="${y2 * S}" stroke="${visited ? '#9ca3af' : '#6b7280'}" stroke-width="1" stroke-dasharray="6 6" opacity="${visited ? 0.7 : 0.35}"/>`);
            if (!visited) out.push(`<text x="${(x1 + x2) / 2 * S}" y="${(y1 + y2) / 2 * S}" text-anchor="middle" dominant-baseline="central" font-size="${S * 1.3}" fill="#9ca3af">?</text>`);
        });
    });
    rooms.forEach(room => {
        room.neighbors.forEach(e => {
            const other = floorMap.roomsById[e.to];
            if (!other || room.id > other.id) return;
            if (!known(room.id) || !known(other.id) || (state[room.id] !== 'visited' && state[other.id] !== 'visited')) return;
            const cityRoom = room.zone === 'city' ? room : other.zone === 'city' ? other : null;
            const style = dash(room.id, other.id) ? ' stroke-dasharray="3 3" opacity="0.6"' : ' opacity="0.85"';
            if (e.kind === 'corridor') {
                const p = fmCenter(room), q = fmCenter(other);
                out.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#cbbf9f" stroke-width="2" stroke-linecap="round"${style}/>`);
            } else if (e.kind === 'door' && cityRoom) {
                // Place -> début de la route : du centre de la place au bout du tronçon côté ville.
                const seg = (cityRoom === room ? other : room).seg;
                const p = fmCenter(cityRoom);
                const d1 = Math.hypot(seg.x1 * S - p.x, seg.y1 * S - p.y), d2 = Math.hypot(seg.x2 * S - p.x, seg.y2 * S - p.y);
                const q = d1 < d2 ? { x: seg.x1 * S, y: seg.y1 * S } : { x: seg.x2 * S, y: seg.y2 * S };
                out.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${URBAN_MAP_COLORS.asphalt}" stroke-width="${S * 1.2}" stroke-linecap="round"${style}/>`);
            } else if (e.kind === 'door') {
                // Tronçon -> repaire (impasse).
                const p = fmCenter(room), q = fmCenter(other);
                out.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#f87171" stroke-width="2" stroke-linecap="round"${style}/>`);
            }
        });
    });

    // Salles des villes et repaires : pleines si visitées, en pointillé avec « ? » si aperçues.
    rooms.forEach(room => {
        if (room.zone === 'road') return;
        const st = state[room.id];
        if (st === 'unknown') return;
        const x = room.x * S, y = room.y * S, w = room.w * S, h = room.h * S;
        const selected = options.selectedRoomId === room.id;
        if (st === 'visited') {
            let fill = URBAN_MAP_COLORS.rooms[room.cityRole] || URBAN_MAP_COLORS.rooms.alley;
            if (room.type === 'stairs' && (!room.guarded || room.defeated)) fill = '#4b3a3a';
            if (room.type === 'lair') {
                const lair = floorMap.lairsById && floorMap.lairsById[room.lairId];
                fill = lair && lair.cleared ? URBAN_MAP_COLORS.lairCleared : URBAN_MAP_COLORS.lair;
            }
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${selected ? '#facc15' : URBAN_MAP_COLORS.cityEdge}" stroke-opacity="${selected ? 1 : 0.6}" stroke-width="${selected ? 2.5 : 1}" data-room-id="${room.id}"/>`);
        } else {
            out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0b0e13" stroke="${selected ? '#facc15' : '#9ca3af'}" stroke-width="${selected ? 2.5 : 1.2}" stroke-dasharray="4 3" data-room-id="${room.id}"/>`);
            out.push(`<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.min(w, h) * 0.6 + 2}" fill="#9ca3af">?</text>`);
        }
    });
    // Tronçon de route sélectionné.
    const sel = options.selectedRoomId && floorMap.roomsById[options.selectedRoomId];
    if (sel && sel.seg) {
        out.push(`<line x1="${sel.seg.x1 * S}" y1="${sel.seg.y1 * S}" x2="${sel.seg.x2 * S}" y2="${sel.seg.y2 * S}" stroke="#facc15" stroke-width="${S * 2.2}" stroke-opacity="0.35"/>`);
    }

    (options.landmarks || []).forEach(m => {
        const room = floorMap.roomsById[m.roomId];
        if (!room) return;
        const c = fmCenter(room);
        out.push(`<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" font-size="${S * 1.4}">${fmEsc(m.icon)}</text>`);
    });

    if (current) {
        const c = fmCenter(current);
        out.push(`<circle cx="${c.x}" cy="${c.y}" r="${S * 0.9}" fill="#facc15" stroke="#1f2937" stroke-width="2" class="floor-map-pawn"/>`);
    }
    return out.join('');
}

if (typeof module !== 'undefined') {
    module.exports = {
        FLOOR_MAP_CELL, FLOOR_MAP_ZOOMS, FLOOR_MAP_DEFAULT_ZOOM, FLOOR_MAP_ASPECT, floorMapRoomState, buildFloorMapSvg,
        floorMapHitTest, floorMapDefaultView, clampFloorMapView, buildUrbanMapSvg
    };
}
