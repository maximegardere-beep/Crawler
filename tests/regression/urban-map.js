// urban-map.js — tests régression : Carte Urbaine : grille logique + diagonales, déclutter anti-chevauchement, caméra MONDE pannable.
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L2409 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Carte Urbaine : grille logique + diagonales (remplace le gabarit de points fixes), déclutter
// anti-chevauchement, caméra MONDE pannable (glissement + bouton Recentrer + clamping). Voir
// CLAUDE.md pour le détail.
// ===================================================================

// generateConnectedCityGrid() : région connexe par construction — cellules toutes distinctes,
// atteignables les unes des autres par adjacence 8-directions (vérifié ici par un simple parcours en
// largeur indépendant du code de génération, pour ne jamais suivre la même logique que ce qu'il teste).
{
    for (let n = 1; n <= 10; n++) {
        const cells = generateConnectedCityGrid(n);
        assert(cells.length === n, `generateConnectedCityGrid(${n}) : exactement ${n} cellules`);
        const keys = cells.map(c => `${c.gx},${c.gy}`);
        assert(new Set(keys).size === n, `generateConnectedCityGrid(${n}) : jamais deux cellules identiques`);

        // Parcours en largeur "maison" (indépendant de computeGridAdjacencyPairs()) pour vérifier la
        // connexité par adjacence 8-directions parmi les cellules choisies.
        const keySet = new Set(keys);
        const visited = new Set([keys[0]]);
        const queue = [cells[0]];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const k = `${cur.gx + dx},${cur.gy + dy}`;
                    if (keySet.has(k) && !visited.has(k)) {
                        visited.add(k);
                        queue.push({ gx: cur.gx + dx, gy: cur.gy + dy });
                    }
                }
            }
        }
        assert(visited.size === n, `generateConnectedCityGrid(${n}) : région entièrement connexe par adjacence 8-directions`);
    }
}

// computeGridAdjacencyPairs() : uniquement les paires de cellules à distance ≤ 1 sur les deux axes
// (adjacence 8-directions), jamais de connexion longue distance façon étoile.
{
    const cells = [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, { gx: 1, gy: 1 }, { gx: 5, gy: 5 }];
    const pairs = computeGridAdjacencyPairs(cells);
    const pairKeys = new Set(pairs.map(([i, j]) => [i, j].sort().join('|')));
    assert(pairKeys.has('0|1'), "computeGridAdjacencyPairs() : (0,0)-(1,0) adjacentes (orthogonal)");
    assert(pairKeys.has('1|2'), "computeGridAdjacencyPairs() : (1,0)-(1,1) adjacentes (orthogonal)");
    assert(pairKeys.has('0|2'), "computeGridAdjacencyPairs() : (0,0)-(1,1) adjacentes (diagonale)");
    assert(!pairKeys.has('0|3') && !pairKeys.has('1|3') && !pairKeys.has('2|3'),
        "computeGridAdjacencyPairs() : la cellule isolée (5,5) n'est reliée à AUCUNE autre (pas de connexion longue distance)");
}

// computeDeclutterLayout() : déterministe (aucun Math.random — même entrée -> même sortie), écarte
// deux points trop proches d'au moins minDist, ne bouge JAMAIS un point déjà assez isolé, et plafonne
// le déplacement total de chaque point à maxShift.
{
    const base = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, c: { x: 500, y: 500 } };
    const ids = ['a', 'b', 'c'];
    const result1 = computeDeclutterLayout(base, ids, { minDist: 48, iterations: 50, maxShift: 40 });
    const result2 = computeDeclutterLayout(base, ids, { minDist: 48, iterations: 50, maxShift: 40 });
    ids.forEach(id => {
        assert(result1[id].x === result2[id].x && result1[id].y === result2[id].y,
            `computeDeclutterLayout() : déterministe pour '${id}' (deux appels identiques -> même résultat)`);
    });

    const distAB = Math.hypot(result1.a.x - result1.b.x, result1.a.y - result1.b.y);
    assert(distAB >= 48 - 1e-6, "computeDeclutterLayout() : deux points trop proches sont écartés d'au moins minDist");

    assert(result1.c.x === base.c.x && result1.c.y === base.c.y,
        "computeDeclutterLayout() : un point déjà isolé (loin de tout) ne bouge pas du tout");

    const shiftA = Math.hypot(result1.a.x - base.a.x, result1.a.y - base.a.y);
    const shiftB = Math.hypot(result1.b.x - base.b.x, result1.b.y - base.b.y);
    assert(shiftA <= 40 + 1e-6 && shiftB <= 40 + 1e-6, "computeDeclutterLayout() : déplacement total plafonné à maxShift");
}

// generateUrbanFloorMap() : grille logique (gx/gy, gameplay) et position d'affichage (x/y, voir
// computeDeclutterLayout()) figées à la génération, jamais recalculées ensuite — chaque route ne
// relie que des villes adjacentes sur la grille (plus de connexion longue distance).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const cities = Object.values(gameState.urbanMap.citiesById);

    const seenCells = new Set(cities.map(c => `${c.gx},${c.gy}`));
    assert(seenCells.size === cities.length, "generateUrbanFloorMap() : jamais deux villes sur la même cellule de grille");
    cities.forEach(city => {
        // minDist (50) du déclutter reste sous l'espacement minimal garanti par la grille (70, voir
        // URBAN_GRID_CELL) : sur cette génération, x/y doivent donc coïncider exactement avec gx/gy
        // mis à l'échelle (déclutter no-op ici, voir son propre test ci-dessus pour le cas où il agit).
        assert(city.x === city.gx * URBAN_GRID_CELL && city.y === city.gy * URBAN_GRID_CELL,
            `generateUrbanFloorMap() : position d'affichage de '${city.id}' alignée sur sa cellule de grille`);
    });

    cities.forEach(city => {
        city.roads.forEach(road => {
            const other = gameState.urbanMap.citiesById[road.to];
            assert(Math.abs(city.gx - other.gx) <= 1 && Math.abs(city.gy - other.gy) <= 1,
                `generateUrbanFloorMap() : la route '${city.id}'->'${road.to}' relie bien deux cellules adjacentes`);
        });
    });

    // Les positions ne bougent jamais après coup, même après plusieurs rafraîchissements de l'UI
    const before = cities.map(c => ({ id: c.id, x: c.x, y: c.y }));
    updateUrbanMapUI();
    updateUrbanMapUI();
    const after = Object.values(gameState.urbanMap.citiesById);
    before.forEach(b => {
        const a = after.find(c => c.id === b.id);
        assert(a.x === b.x && a.y === b.y, `updateUrbanMapUI() : la position de '${b.id}' reste fixe d'un rendu à l'autre`);
    });
}

// clampCameraToBounds() : écrête un centre de caméra aux bornes du monde (fenêtre affichée centrée
// dessus) ; si le monde est plus petit que la fenêtre, centre le monde plutôt que d'écrêter sur un
// intervalle vide.
{
    const view = { w: 200, h: 240 };
    const bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };

    const inside = clampCameraToBounds({ x: 50, y: 50 }, view, bounds);
    assert(inside.x === 50 && inside.y === 50, "clampCameraToBounds() : un centre déjà dans les bornes n'est pas modifié");

    const clamped = clampCameraToBounds({ x: 5000, y: 5000 }, view, bounds);
    assert(clamped.x === 1000 - view.w / 2 && clamped.y === 1000 - view.h / 2,
        "clampCameraToBounds() : écrêté au bord du monde moins la moitié de la fenêtre");

    const tinyBounds = { minX: -10, maxX: 30, minY: -40, maxY: 0 };
    const fallback = clampCameraToBounds({ x: 9999, y: 9999 }, view, tinyBounds);
    assert(fallback.x === 10 && fallback.y === -20,
        "clampCameraToBounds() : monde plus petit que la fenêtre -> centré sur le monde (fallback)");
}

// computeDefaultWorldBounds() : boîte englobante de toutes les positions fournies, augmentée d'une
// marge fixe de chaque côté.
{
    const bounds = computeDefaultWorldBounds({ a: { x: 0, y: 10 }, b: { x: 20, y: -5 } }, 15);
    assert(bounds.minX === -15 && bounds.maxX === 35 && bounds.minY === -20 && bounds.maxY === 25,
        "computeDefaultWorldBounds() : boîte englobante + marge sur les 4 côtés");
}

// renderGraphMiniMap() : caméra MONDE — `camera` explicite prend le pas sur le centrage automatique
// sur `currentId`, et `worldBounds` écrête la vue (voir clampCameraToBounds(), déjà testé seul).
{
    const nodes = [{ id: 'a', label: 'A', icon: '🏙️' }];
    const edges = [];
    const positions = { a: { x: 0, y: 0 } };
    const svgEl = document.createElement('svg');
    // worldBounds explicite et généreux dans ces deux premiers cas : évite tout écrêtage, pour
    // isoler le comportement testé (centrage par défaut / camera explicite) de clampCameraToBounds()
    // (déjà testé seul plus haut).
    const wideBounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 }, worldBounds: wideBounds });
    assert(svgEl.getAttribute('viewBox') === "-100 -120 200 240",
        "renderGraphMiniMap() : sans camera explicite, centré sur currentId");

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 }, worldBounds: wideBounds, camera: { x: 10, y: 20 } });
    assert(svgEl.getAttribute('viewBox') === "-90 -100 200 240",
        "renderGraphMiniMap() : camera explicite prend le pas sur currentId");

    renderGraphMiniMap(svgEl, {
        nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 },
        camera: { x: 5000, y: 5000 }, worldBounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }
    });
    assert(svgEl.getAttribute('viewBox') === "800 760 200 240",
        "renderGraphMiniMap() : worldBounds écrête bien la vue (via clampCameraToBounds())");
}

// renderGraphMiniMap() : le fond décoratif (background.rects/lines) se dessine en premier calque, et
// le marqueur de gardien (goalIcon) porte SA PROPRE couleur (variant), jamais reportée sur le
// cercle de la ville elle-même (qui reste "normale"). Coordonnées MONDE (plus de 0..1 normalisé).
{
    const nodes = [
        { id: 'start', label: 'Départ', icon: '🏙️', variant: 'default' },
        { id: 'boss', label: 'Gardien', icon: '🏙️', variant: 'guarded', goalIcon: '👑' },
    ];
    const edges = [{ from: 'start', to: 'boss', distance: 2 }];
    const positions = { start: { x: 0, y: 0 }, boss: { x: 70, y: 0 } };
    const background = { rects: [{ x: -10, y: -10, w: 5, h: 5 }], lines: [{ x1: -50, y1: 0, x2: 50, y2: 0 }] };
    const svgEl = document.createElement('svg');

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'start', background });
    assert(svgEl._children.length === 3, "renderGraphMiniMap() : fond + arêtes + nœuds, dans cet ordre");
    assert(svgEl._children[0]._children.length === 2, "renderGraphMiniMap() : le calque de fond contient bien le rect ET la ligne fournis");

    const nodesGroup = svgEl._children[2];
    const bossNodeG = nodesGroup._children.find(c => c.getAttribute('data-node-id') === 'boss');
    const bossCircle = bossNodeG._children.find(c => c.getAttribute && c.getAttribute('r'));
    assert(bossCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.default.stroke,
        "renderGraphMiniMap() : le cercle de la ville gardée reste de couleur par défaut");
    const markerG = nodesGroup._children.find(c => !c.getAttribute('data-node-id')); // Seul le marqueur n'a pas de data-node-id
    const markerCircle = markerG && markerG._children.find(c => c.getAttribute && c.getAttribute('r') === '8');
    assert(!!markerCircle && markerCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.guarded.stroke,
        "renderGraphMiniMap() : le marqueur porte bien la couleur 'guarded'");
}

// renderGraphMiniMap() : node.badge (marchand/professeur...) reste accolé au cercle du nœud lui-même
// (pas un enfant séparé du groupe de nœuds, contrairement à goalIcon), et edges[].marker (ex :
// repaire) se dessine au milieu de l'arête elle-même, dans le groupe des arêtes.
{
    const nodes = [
        { id: 'a', label: 'A', icon: '🏙️', badge: '🛒' },
        { id: 'b', label: 'B', icon: '🏙️' },
    ];
    const edges = [{ from: 'a', to: 'b', marker: { icon: '💀', variant: 'guarded' } }];
    const positions = { a: { x: 0, y: 0 }, b: { x: 70, y: 0 } };
    const svgEl = document.createElement('svg');

    renderGraphMiniMap(svgEl, { nodes, edges, positions, currentId: 'a' });
    const edgesGroup = svgEl._children[0]; // Pas de background ici : arêtes en premier
    const nodesGroup = svgEl._children[1];

    const nodeAG = nodesGroup._children.find(c => c.getAttribute('data-node-id') === 'a');
    const badgeGroup = nodeAG._children.find(c => c._children && c._children.some(child => child.textContent === '🛒'));
    assert(!!badgeGroup, "renderGraphMiniMap() : node.badge rendu à l'intérieur du groupe du nœud lui-même");
    assert(nodesGroup._children.length === 2, "renderGraphMiniMap() : le badge n'ajoute PAS de nœud séparé au groupe (contrairement à goalIcon)");

    const edgeMarkerG = edgesGroup._children.find(c => c._children && c._children.some(child => child.getAttribute && child.getAttribute('r') === '8'));
    const edgeMarkerCircle = edgeMarkerG && edgeMarkerG._children.find(c => c.getAttribute('r') === '8');
    assert(!!edgeMarkerCircle && edgeMarkerCircle.getAttribute('stroke') === GRAPH_MINIMAP_VARIANT_COLORS.guarded.stroke,
        "renderGraphMiniMap() : edges[].marker rendu dans le groupe des arêtes, avec sa couleur variant");
}

// renderGraphMiniMap() : glissement (pan) — un mouvement sous le seuil (5px) reste un simple clic ;
// au-delà, le viewBox se déplace EN DIRECT (mutation d'attribut, jamais un re-rendu complet) et
// onCameraChange n'est appelé qu'UNE fois, à la fin du glissement (jamais pendant) ; le clic natif qui
// suit un vrai glissement est avalé (jamais de navigation accidentelle en relâchant sur un nœud).
// Échelle écran<->monde : test_stub.js n'expose pas getBoundingClientRect(), donc le fallback interne
// (voir renderGraphMiniMap()) retombe sur une échelle 1:1 — suffisant pour vérifier la LOGIQUE
// (seuil, clamping, callback, suppression du clic), l'échelle réelle est vérifiée en navigateur.
{
    const nodes = [{ id: 'a', label: 'A', icon: '🏙️' }, { id: 'b', label: 'B', icon: '🏙️' }];
    const edges = [];
    const positions = { a: { x: 0, y: 0 }, b: { x: 70, y: 0 } };
    const svgEl = document.createElement('svg');
    let lastCamera = null, clickedId = null;

    renderGraphMiniMap(svgEl, {
        nodes, edges, positions, currentId: 'a', viewSize: { w: 200, h: 240 },
        onNodeClick: (id) => { clickedId = id; },
        onCameraChange: (cam) => { lastCamera = cam; },
    });

    // Mouvement sous le seuil : pas de pan déclenché
    svgEl.dispatch('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 });
    svgEl.dispatch('pointermove', { clientX: 102, clientY: 101, pointerId: 1 });
    svgEl.dispatch('pointerup', { clientX: 102, clientY: 101, pointerId: 1 });
    assert(lastCamera === null, "renderGraphMiniMap() (pan) : un mouvement sous le seuil (5px) ne déclenche aucun pan");

    // Glissement franc : le viewBox bouge EN DIRECT pendant pointermove...
    svgEl.dispatch('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 });
    svgEl.dispatch('pointermove', { clientX: 60, clientY: 100, pointerId: 1 }); // -40px en x, échelle 1:1
    assert(svgEl.getAttribute('viewBox') === "-60 -120 200 240", "renderGraphMiniMap() (pan) : viewBox déplacé EN DIRECT pendant le glissement");
    assert(lastCamera === null, "renderGraphMiniMap() (pan) : onCameraChange PAS encore appelé pendant le glissement (coûteux à chaque pointermove)");
    // ...et onCameraChange n'est appelé qu'à la fin (pointerup), une seule fois
    svgEl.dispatch('pointerup', { clientX: 60, clientY: 100, pointerId: 1 });
    assert(!!lastCamera && lastCamera.x === 40 && lastCamera.y === 0, "renderGraphMiniMap() (pan) : onCameraChange appelé une fois à la fin, avec la position finale");

    // Le glissement qui vient de se terminer n'a PAS navigué (drag.moved === true empêche la
    // résolution du tap dans endDrag(), voir renderGraphMiniMap()).
    assert(clickedId === null, "renderGraphMiniMap() (pan) : un vrai glissement ne déclenche jamais de navigation, même en relâchant sur un nœud");

    // Un tap normal (sans glissement) sur la position ÉCRAN correspondant désormais à 'b' navigue
    // bien — la caméra "vécue" (liveCamera, voir renderGraphMiniMap()) est repartie du dernier
    // glissement (40,0), pas de la position du tout premier rendu (0,0) : sans ce suivi, ce tap
    // viserait la mauvaise position monde puisqu'aucun re-rendu n'a eu lieu entre les deux gestes.
    svgEl.dispatch('pointerdown', { clientX: 130, clientY: 120, pointerId: 1 });
    svgEl.dispatch('pointerup', { clientX: 130, clientY: 120, pointerId: 1 });
    assert(clickedId === 'b', "renderGraphMiniMap() (pan) : un tap normal après un glissement précédent (sans re-rendu) vise la bonne position monde");
}
