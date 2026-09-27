// scene.js - Rendu de la scène de combat en vue 2D latérale (mob à gauche, crawler à droite, sol
// horizontal) et de son décor (catalogue dans backdrops.js). Module de RENDU pur : lit
// gameState/config, ne les modifie jamais. Chargé juste avant app.js (après sprites.js et
// backdrops.js) ; son seul point d'entrée côté moteur est renderCombatScene(), appelée en fin
// d'updateUI().
//
// Coordonnées : celles du viewBox de #combat-scene-svg (index.html), 360 x 150 unités. Le SVG
// s'adapte à la largeur de l'écran ; toutes les positions ci-dessous restent donc en unités viewBox.

const SCENE_WIDTH = 360;
const SCENE_GROUND_Y = 124;
const SCENE_MARGIN = 6;

// Crawler ancré à droite, jamais déplacé. CRAWLER_FRONT_EXTENT : distance entre son centre et son
// point le plus avancé côté mob (botte/main avant, voir SCENE_CRAWLER_SVG dans sprites.js).
const CRAWLER_X = 306;
const CRAWLER_FRONT_EXTENT = 15;
// Compagnon éventuel, derrière le crawler (côté droit).
const COMPANION_X = 342;
const COMPANION_EXTENT = 10;

// Demi-largeur maximale de toute silhouette de mob (voir SCENE_MOB_SPRITES) et espace minimal gardé
// entre les deux silhouettes au contact.
const MOB_EXTENT = 24;
const CONTACT_GAP = 5;

// Position du centre du mob à l'écart nul (au contact) et à l'écart maximal.
const MOB_X_CONTACT = CRAWLER_X - CRAWLER_FRONT_EXTENT - CONTACT_GAP - MOB_EXTENT;
const MOB_X_FAR = SCENE_MARGIN + MOB_EXTENT;

// Seule conversion distance de jeu -> abscisse écran. Linéaire et continue : la distance du jeu est
// entière (0..maxDistance), mais l'axe n'a aucune case — un saut de plusieurs unités d'un coup (dés,
// Charger, ruée) donne un seul glissement fluide (transition CSS sur transform). Bornée : toute valeur
// hors plage (ou invalide) est ramenée à [0, maxDistance], donc le mob reste toujours dans la scène.
function distanceToX(distance, maxDistance) {
    const max = maxDistance > 0 ? maxDistance : 1;
    const ratio = Math.max(0, Math.min(1, (Number(distance) || 0) / max));
    return MOB_X_CONTACT - ratio * (MOB_X_CONTACT - MOB_X_FAR);
}

// Bandes de portée au sol, toujours visibles (pure, testée) : "contact" couvre la position du mob à
// l'écart nul (Arme, Mains nues, sort de corps à corps), "tir" toutes les positions à écart > 0 (Tir,
// sort à distance — aucune portée maximale dans le jeu). La frontière passe à mi-chemin entre les
// positions des écarts 0 et 1 ; la bande de contact s'arrête à l'avant du crawler.
function computeRangeBands(maxDistance) {
    const boundary = (distanceToX(0, maxDistance) + distanceToX(1, maxDistance)) / 2;
    return {
        ranged: { x1: SCENE_MARGIN, x2: boundary },
        contact: { x1: boundary, x2: CRAWLER_X - CRAWLER_FRONT_EXTENT }
    };
}

// --- Décor (catalogue dans backdrops.js) ---------------------------------------------------------
// Fiche de décor d'un quartier : son nom exact (districts.js, aussi utilisé comme thème des étages
// urbains), sinon le décor par défaut.
function resolveBackdropKey(district) {
    return Object.prototype.hasOwnProperty.call(SCENE_BACKDROPS, district) ? district : 'default';
}

// Assemble une fiche de décor en SVG, en 3 couches toujours placées AVANT (donc derrière) les
// combattants : fond (mur, ombres, plafond), milieu (halos muraux, accessoires), avant-plan (sol,
// halos au sol, débris, vignette). `prefix` rend uniques les identifiants de motifs/dégradés, pour
// que plusieurs scènes puissent coexister dans la page. Pure : ne lit que la fiche et le catalogue.
function composeBackdrop(def, prefix) {
    const p = def.palette;
    const W = BACKDROP_WIDTH;
    const H = BACKDROP_HEIGHT;
    const G = BACKDROP_GROUND_Y;
    const wallPattern = BACKDROP_WALL_PATTERNS[def.wall] || BACKDROP_WALL_PATTERNS.stone;
    const floorPattern = BACKDROP_FLOOR_PATTERNS[def.floor] || BACKDROP_FLOOR_PATTERNS.flagstones;
    const ceiling = BACKDROP_CEILINGS[def.ceiling] || BACKDROP_CEILINGS.vault;

    const lights = [];
    const props = (def.props || []).map(prop => {
        const kind = BACKDROP_PROPS[prop.type];
        if (!kind) return '';
        const light = kind.light(prop);
        if (light) lights.push({ x: prop.x + light.dx, y: prop.y + light.dy, color: light.color, radius: light.radius, flicker: light.flicker });
        return `<g transform="translate(${prop.x} ${prop.y})">${kind.markup(prop, p)}</g>`;
    }).join('');

    const glowDefs = lights.map((l, i) => `
            <radialGradient id="${prefix}-glow-${i}">
                <stop offset="0%" stop-color="${l.color}" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="${l.color}" stop-opacity="0"/>
            </radialGradient>`).join('');
    const haloClass = l => (l.flicker ? ' class="bd-halo-flicker"' : '');
    const wallHalos = lights.map((l, i) => `<ellipse${haloClass(l)} cx="${l.x}" cy="${l.y}" rx="${l.radius}" ry="${l.radius * 0.85}" fill="url(#${prefix}-glow-${i})"/>`).join('');
    const floorHalos = lights.map((l, i) => `<ellipse${haloClass(l)} cx="${l.x}" cy="${G + 5}" rx="${l.radius * 1.1}" ry="7" fill="url(#${prefix}-glow-${i})"/>`).join('');
    const debris = def.debris
        ? BACKDROP_DEBRIS.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r * 1.4}" ry="${r}" fill="${p.floorAlt}" stroke="#05060c" stroke-width="0.6"/>`).join('')
        : '';

    return `
        <defs>
            ${wallPattern(`${prefix}-wall`, p)}
            ${floorPattern(`${prefix}-floor`, p)}
            ${glowDefs}
            <linearGradient id="${prefix}-wallshade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#000" stop-opacity="0.35"/>
                <stop offset="0.25" stop-color="#000" stop-opacity="0"/>
                <stop offset="0.75" stop-color="#000" stop-opacity="0"/>
                <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
            </linearGradient>
            <radialGradient id="${prefix}-vignette" cx="50%" cy="55%" r="70%">
                <stop offset="60%" stop-color="#000" stop-opacity="0"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
            </radialGradient>
        </defs>
        <g class="bd-back">
            <rect x="0" y="0" width="${W}" height="${G}" fill="url(#${prefix}-wall)"/>
            <rect x="0" y="0" width="${W}" height="${G}" fill="url(#${prefix}-wallshade)"/>
            ${ceiling(p)}
        </g>
        <g class="bd-mid">${wallHalos}${props}</g>
        <g class="bd-front">
            <rect x="0" y="${G}" width="${W}" height="${H - G}" fill="url(#${prefix}-floor)"/>
            <rect x="0" y="${G}" width="${W}" height="3" fill="#000" opacity="0.35"/>
            <line x1="0" y1="${G}" x2="${W}" y2="${G}" stroke="#05060c" stroke-width="2"/>
            ${floorHalos}${debris}
            <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${prefix}-vignette)"/>
        </g>`;
}

// Dernière clé de décor dessinée, par scène (préfixe) : le décor n'est redessiné que si elle change
// (quartier ou mode), jamais à chaque updateUI(). Renvoie true si un redessin a eu lieu.
const lastBackdropKeys = {};
function renderSceneBackdrop(container, prefix, key) {
    if (!container || lastBackdropKeys[prefix] === key) return false;
    container.innerHTML = composeBackdrop(SCENE_BACKDROPS[key], prefix);
    lastBackdropKeys[prefix] = key;
    return true;
}

// Teintes par effet de mob : variables CSS lues par les classes mf-* (index.html). Un seul accent,
// rouge, pour les yeux/détails de danger, quel que soit l'effet.
const MOB_EFFECT_TINTS = {
    burn: { base: '#6b3a30', dark: '#4a2620' },
    poison: { base: '#4f6b3a', dark: '#33452a' },
    slow: { base: '#3a5a6b', dark: '#26414a' },
    stun: { base: '#6b5a2a', dark: '#4a3f1e' },
    confusion: { base: '#5a3a6b', dark: '#3f2a4a' },
    pull: { base: '#3a4a6b', dark: '#26304a' },
    light: { base: '#7a7550', dark: '#55512f' },
    corrode: { base: '#4a6b4a', dark: '#304a30' },
    fear: { base: '#4a2a4a', dark: '#301c30' },
    bleed: { base: '#5a2a2a', dark: '#3a1c1c' }
};
const MOB_DEFAULT_TINT = { base: '#4a5b6b', dark: '#33404a' };
const MOB_ACCENT_COLOR = '#c23b3b';

const COMPANION_SPECIALTY_TINTS = {
    strike: { base: '#6b3a30', dark: '#4a2620' },
    guard: { base: '#3a4a6b', dark: '#26304a' },
    medic: { base: '#3a6b4a', dark: '#264a30' },
    scout: { base: '#4a4f5c', dark: '#33363f' }
};

const sceneUi = {
    backdrop: document.getElementById('scene-backdrop'),
    mob: document.getElementById('scene-mob'),
    crawler: document.getElementById('scene-crawler'),
    companion: document.getElementById('scene-companion'),
    mobAnchor: document.getElementById('scene-mob-anchor'),
    crawlerAnchor: document.getElementById('scene-crawler-anchor'),
    enemyHpBar: document.getElementById('combat-enemy-hp-bar'),
    enemyHpText: document.getElementById('combat-enemy-hp-text'),
    playerHpBar: document.getElementById('combat-player-hp-bar'),
    playerHpText: document.getElementById('combat-player-hp-text'),
    playerName: document.getElementById('combat-player-name'),
    distanceLabel: document.getElementById('combat-distance-label'),
    bandContact: document.getElementById('scene-band-contact'),
    bandRanged: document.getElementById('scene-band-ranged'),
    bandContactLabel: document.getElementById('scene-band-contact-label'),
    bandRangedLabel: document.getElementById('scene-band-ranged-label')
};

// Hauteur du point d'accroche des chiffres de dégâts, sous le haut de chaque silhouette (unités
// viewBox) : assez bas pour que le chiffre ait la place de monter sans sortir de la scène.
const DAMAGE_ANCHOR_DROP = 22;
const CRAWLER_TOP = -92;

// Position d'un groupe SVG : attribut `transform` (repli universel) + propriété CSS `transform`, seule
// à pouvoir être animée par une transition CSS (voir .scene-fighter dans index.html).
function placeSceneGroup(el, x, y) {
    el.setAttribute('transform', `translate(${x} ${y})`);
    el.style.transform = `translate(${x}px, ${y}px)`;
}

function applySceneTint(el, tint) {
    el.style.setProperty('--mob-base', tint.base);
    el.style.setProperty('--mob-dark', tint.dark);
    el.style.setProperty('--mob-accent', MOB_ACCENT_COLOR);
}

// Place une ancre HTML (largeur/hauteur nulles) au-dessus d'un point de la scène, en % du cadre :
// le SVG remplit exactement #combat-scene (même ratio), donc x/360 et y/150 suffisent.
function placeSceneAnchor(el, x, y) {
    el.style.left = `${(x / SCENE_WIDTH) * 100}%`;
    el.style.top = `${(y / 150) * 100}%`;
}

function hpPercent(hp, maxHp) {
    return maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
}

function placeRangeBand(rect, label, band) {
    rect.setAttribute('x', band.x1);
    rect.setAttribute('width', band.x2 - band.x1);
    label.setAttribute('x', (band.x1 + band.x2) / 2);
}

// La bande où se trouve le mob est renforcée : c'est celle des attaques qui portent en ce moment.
function renderRangeBands() {
    const atContact = (gameState.combatDistance || 0) <= 0;
    sceneUi.bandContact.classList.toggle('is-active', atContact);
    sceneUi.bandContactLabel.classList.toggle('is-active', atContact);
    sceneUi.bandRanged.classList.toggle('is-active', !atContact);
    sceneUi.bandRangedLabel.classList.toggle('is-active', !atContact);
}

let sceneBuilt = false;
let lastMobSpriteKey = null;
// Ennemi dessiné au rendu précédent : un nouvel ennemi apparaît directement à sa place, sans glisser
// depuis la position où le précédent a fini son combat.
let lastSceneEnemy = null;
let lastCompanionKey = null;

// Chaque silhouette est enveloppée dans un <g class="scene-body"> : le groupe extérieur porte la
// position (translate, animée par transition), le groupe intérieur la secousse d'impact — deux
// transformations indépendantes qui ne s'écrasent jamais.
function wrapSceneBody(markup) {
    return `<g class="scene-body">${markup}</g>`;
}

function ensureSceneBuilt() {
    if (sceneBuilt) return;
    sceneUi.crawler.innerHTML = wrapSceneBody(SCENE_CRAWLER_SVG);
    placeSceneGroup(sceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
    placeSceneGroup(sceneUi.companion, COMPANION_X, SCENE_GROUND_Y);
    placeSceneAnchor(sceneUi.crawlerAnchor, CRAWLER_X, SCENE_GROUND_Y + CRAWLER_TOP + DAMAGE_ANCHOR_DROP);
    const bands = computeRangeBands(config.rangedCombat.maxDistance);
    placeRangeBand(sceneUi.bandContact, sceneUi.bandContactLabel, bands.contact);
    placeRangeBand(sceneUi.bandRanged, sceneUi.bandRangedLabel, bands.ranged);
    sceneBuilt = true;
}

function renderSceneMob(enemy) {
    const archetypeKey = SCENE_MOB_SPRITES[enemy.visualArchetype] ? enemy.visualArchetype : 'goblinoid';
    const sprite = SCENE_MOB_SPRITES[archetypeKey];
    const spriteKey = archetypeKey + (enemy.isBoss ? ':boss' : '');
    if (lastMobSpriteKey !== spriteKey) {
        const crown = enemy.isBoss
            ? `<g transform="translate(0 ${sprite.top - 2})">${SCENE_BOSS_CROWN_SVG}</g>`
            : '';
        sceneUi.mob.innerHTML = wrapSceneBody(sprite.markup + crown);
        lastMobSpriteKey = spriteKey;
    }
    applySceneTint(sceneUi.mob, MOB_EFFECT_TINTS[enemy.effect] || MOB_DEFAULT_TINT);
    const x = distanceToX(gameState.combatDistance, config.rangedCombat.maxDistance);
    const isNewEnemy = enemy !== lastSceneEnemy;
    if (isNewEnemy) {
        sceneUi.mob.classList.add('scene-no-transition');
        sceneUi.mobAnchor.classList.add('scene-no-transition');
    }
    placeSceneGroup(sceneUi.mob, x, SCENE_GROUND_Y);
    placeSceneAnchor(sceneUi.mobAnchor, x, SCENE_GROUND_Y + sprite.top + DAMAGE_ANCHOR_DROP);
    if (isNewEnemy) {
        forceStyleFlush(sceneUi.mob);
        sceneUi.mob.classList.remove('scene-no-transition');
        sceneUi.mobAnchor.classList.remove('scene-no-transition');
        lastSceneEnemy = enemy;
    }
}

// Force le navigateur à appliquer les styles en attente (utile pour couper puis réactiver une
// transition, ou rejouer une animation CSS). Un élément SVG n'a pas d'offsetWidth :
// getBoundingClientRect() fonctionne pour les deux.
function forceStyleFlush(el) {
    if (el && typeof el.getBoundingClientRect === 'function') el.getBoundingClientRect();
}

// Petite secousse du combattant touché ('mob' ou 'crawler'), appelée par showFloatingDamage()
// (app.js) au moment où le coup porte. Rejouable même si la précédente n'est pas finie.
function shakeSceneFighter(target) {
    const group = target === 'crawler' ? sceneUi.crawler : sceneUi.mob;
    const body = group && group.querySelector('.scene-body');
    if (!body) return;
    body.classList.remove('scene-hit');
    forceStyleFlush(body);
    body.classList.add('scene-hit');
}

// Barres de vie au-dessus de la scène : nom + PV actuels/max de chaque combattant.
function renderSceneVitals(enemy) {
    const enemyMax = enemy.maxHp || enemy.hp;
    sceneUi.enemyHpBar.style.width = `${hpPercent(enemy.hp, enemyMax)}%`;
    sceneUi.enemyHpText.innerText = `PV ${Math.round(Math.max(0, enemy.hp))}/${Math.round(enemyMax)}`;
    sceneUi.playerHpBar.style.width = `${hpPercent(gameState.hp, gameState.maxHp)}%`;
    sceneUi.playerHpText.innerText = `PV ${Math.round(Math.max(0, gameState.hp))}/${Math.round(gameState.maxHp)}`;
    sceneUi.playerName.innerText = gameState.playerName || 'Vous';
}

// Distance affichée sous la scène, dans l'unité du jeu (0 = contact).
function renderSceneDistance() {
    const max = config.rangedCombat.maxDistance;
    const distance = Math.max(0, Math.min(max, gameState.combatDistance || 0));
    sceneUi.distanceLabel.innerText = distance === 0
        ? `Distance ${distance}/${max} · au contact`
        : `Distance ${distance}/${max}`;
}

function renderSceneCompanion() {
    const companion = gameState.companion;
    sceneUi.companion.classList.toggle('hidden', !companion);
    if (!companion) return;
    const specialty = companion.specialty && companion.specialty.type;
    if (lastCompanionKey !== specialty) {
        sceneUi.companion.innerHTML = wrapSceneBody(SCENE_COMPANION_SVG);
        applySceneTint(sceneUi.companion, COMPANION_SPECIALTY_TINTS[specialty] || MOB_DEFAULT_TINT);
        lastCompanionKey = specialty;
    }
}

// Point d'entrée unique, appelé en fin d'updateUI() (app.js) après chaque action (et au moment de
// l'impact d'un coup, voir animateDieHit()). Ne fait rien hors combat : la scène vit dans
// #combat-zone, que updateUI() masque déjà dans ce cas.
function renderCombatScene() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy) return;
    ensureSceneBuilt();
    renderSceneBackdrop(sceneUi.backdrop, 'cbd', resolveBackdropKey(gameState.currentDistrict));
    renderSceneVitals(enemy);
    renderSceneMob(enemy);
    renderSceneCompanion();
    renderRangeBands();
    renderSceneDistance();
}
