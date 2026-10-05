// scene.js - Rendu de la scène de combat en vue 2D latérale (mob à gauche, crawler à droite, sol
// horizontal) et de son décor (catalogue dans backdrops.js). Module de RENDU pur : lit
// gameState/config, ne les modifie jamais. Chargé juste avant app.js (après sprites/*.js et
// backdrops.js) ; son seul point d'entrée côté moteur est renderScene(mode) — 'combat' en fin
// d'updateUI(), 'explore' depuis setSceneHeader(), 'merchant'/'trainer' depuis updateShopUI(),
// 'safehouse' depuis enterRoom(), 'stairs'/'gameOver' depuis les écrans correspondants.
//
// Coordonnées : celles du viewBox de #combat-scene-svg (index.html), 360 x 150 unités. Le SVG
// s'adapte à la largeur de l'écran ; toutes les positions ci-dessous restent donc en unités viewBox.

const SCENE_WIDTH = 360;
const SCENE_GROUND_Y = 124;
const SCENE_MARGIN = 6;

// Crawler ancré à droite, jamais déplacé. CRAWLER_FRONT_EXTENT : distance entre son centre et son
// point le plus avancé côté mob (botte/main avant, voir CRAWLER_PARTS dans sprites/crawler.js).
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
// Extension avant du crawler courant : celle du corps dessiné de sa race (CRAWLER_RACE_BODIES, gabarit légèrement varié), sinon la constante
// commune. `raceKey` : une race précise, par défaut celle du crawler (chantier 13, lot 4).
function crawlerFrontExtent(raceKey = (typeof gameState !== 'undefined' ? gameState.race : null)) {
    const body = crawlerRaceBody(raceKey);
    return body && body.frontExtent > 0 ? body.frontExtent : CRAWLER_FRONT_EXTENT;
}
function mobContactX(frontExtent = CRAWLER_FRONT_EXTENT) {
    return CRAWLER_X - frontExtent - CONTACT_GAP - MOB_EXTENT;
}
const MOB_X_FAR = SCENE_MARGIN + MOB_EXTENT;

// Seule conversion distance de jeu -> abscisse écran. Linéaire et continue : la distance du jeu est
// entière (0..maxDistance), mais l'axe n'a aucune case — un saut de plusieurs unités d'un coup (dés,
// Charger, ruée) donne un seul glissement fluide (transition CSS sur transform). Bornée : toute valeur
// hors plage (ou invalide) est ramenée à [0, maxDistance], donc le mob reste toujours dans la scène.
function distanceToX(distance, maxDistance, frontExtent = CRAWLER_FRONT_EXTENT) {
    const max = maxDistance > 0 ? maxDistance : 1;
    const ratio = Math.max(0, Math.min(1, (Number(distance) || 0) / max));
    const contact = mobContactX(frontExtent); // = MOB_X_CONTACT pour l'extension commune
    return contact - ratio * (contact - MOB_X_FAR);
}

// Bandes de portée au sol, toujours visibles (pure, testée) : "contact" couvre la position du mob à
// l'écart nul (Arme, Mains nues, sort de corps à corps), "tir" toutes les positions à écart > 0 (Tir,
// sort à distance — aucune portée maximale dans le jeu). La frontière passe à mi-chemin entre les
// positions des écarts 0 et 1 ; la bande de contact s'arrête à l'avant du crawler.
function computeRangeBands(maxDistance, frontExtent = CRAWLER_FRONT_EXTENT) {
    const boundary = (distanceToX(0, maxDistance, frontExtent) + distanceToX(1, maxDistance, frontExtent)) / 2;
    return {
        ranged: { x1: SCENE_MARGIN, x2: boundary },
        contact: { x1: boundary, x2: CRAWLER_X - frontExtent }
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
        if (light) lights.push({ x: prop.x + light.dx, y: prop.y + light.dy, color: light.color, radius: light.radius, flicker: light.flicker, calm: light.calm });
        return `<g transform="translate(${prop.x} ${prop.y})">${kind.markup(prop, p)}</g>`;
    }).join('');

    const glowDefs = lights.map((l, i) => `
            <radialGradient id="${prefix}-glow-${i}">
                <stop offset="0%" stop-color="${l.color}" stop-opacity="0.32"/>
                <stop offset="100%" stop-color="${l.color}" stop-opacity="0"/>
            </radialGradient>`).join('');
    // Halo qui vacille (flamme, néon), qui "respire" lentement (lumière apaisée des salles
    // sécurisées), ou fixe.
    const haloClass = l => (l.flicker ? ' class="bd-halo-flicker"' : l.calm ? ' class="bd-calm-glow"' : '');
    const wallHalos = lights.map((l, i) => `<ellipse${haloClass(l)} cx="${l.x}" cy="${l.y}" rx="${l.radius}" ry="${l.radius * 0.85}" fill="url(#${prefix}-glow-${i})"/>`).join('');
    const floorHalos = lights.map((l, i) => `<ellipse${haloClass(l)} cx="${l.x}" cy="${G + 5}" rx="${l.radius * 1.1}" ry="7" fill="url(#${prefix}-glow-${i})"/>`).join('');
    // Accessoires au sol (rails, flèches peintes, brume, vapeur) : dessinés APRÈS le sol, dans
    // l'avant-plan du décor — toujours derrière les combattants.
    const floorProps = (def.floorProps || []).map(prop => {
        const kind = BACKDROP_PROPS[prop.type];
        return kind ? `<g transform="translate(${prop.x} ${prop.y})">${kind.markup(prop, p)}</g>` : '';
    }).join('');
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
            ${floorHalos}${debris}${floorProps}
            <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${prefix}-vignette)"/>
        </g>`;
}

// Dernière clé de décor dessinée, par scène (préfixe) : le décor n'est redessiné que si elle change
// (quartier ou mode), jamais à chaque updateUI(). Renvoie true si un redessin a eu lieu. `def` : fiche
// à dessiner si elle ne vient pas de SCENE_BACKDROPS (salle sécurisée).
const lastBackdropKeys = {};
function renderSceneBackdrop(container, prefix, key, def) {
    if (!container || lastBackdropKeys[prefix] === key) return false;
    container.innerHTML = composeBackdrop(def || SCENE_BACKDROPS[key], prefix);
    lastBackdropKeys[prefix] = key;
    return true;
}

// Teinte neutre de repli (compagnon de spécialité inconnue) et accent par défaut des yeux/détails de danger.
// Les mobs, eux, ont leur propre palette naturelle (voir resolveMobSprite() plus bas) ; leur effet se voit
// par une aura (sprites/mob-auras.js), plus par une teinte.
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
    bandRangedLabel: document.getElementById('scene-band-ranged-label'),
    lairProgress: document.getElementById('scene-lair-progress')
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
    el.style.setProperty('--mob-accent', tint.accent || MOB_ACCENT_COLOR);
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

// --- Crawler équipé ------------------------------------------------------------------------------------
// Clé du sprite d'un objet dans ITEM_SPRITES (sprites/items-*.js) : son nom d'origine (`baseName`, posé
// à la génération), sinon son nom exact (objets signature), sinon le plus long nom connu par lequel son
// nom commence (anciennes sauvegardes, sans `baseName`), sinon le dessin générique de sa catégorie.
function resolveItemSpriteKey(item) {
    if (!item) return null;
    if (item.baseName && ITEM_SPRITES[item.baseName]) return item.baseName;
    if (item.name && ITEM_SPRITES[item.name]) return item.name;
    const name = item.name || '';
    let best = null;
    Object.keys(ITEM_SPRITES).forEach(key => {
        if (!key.startsWith('generic:') && name.startsWith(key) && (!best || key.length > best.length)) best = key;
    });
    return best || `generic:${item.category || 'weapons'}`;
}

// Posture = dernière attaque utilisée (gameState.lastAttackKind) : l'arme de mêlée, l'arme à distance, le
// sort (paume ouverte) ou les poings (garde du boxeur). Si l'objet correspondant n'est plus équipé, ou
// avant toute attaque : arme de mêlée, sinon arme à distance, sinon sort, sinon les poings. En combat au
// contact, une arme à distance se tient canon baissé (on ne peut pas tirer à cet écart).
function crawlerPosture() {
    const eq = gameState.equipment || {};
    const kind = gameState.lastAttackKind;
    let posture;
    if (kind === 'weapon' && eq.weapon) posture = 'weapon';
    else if (kind === 'ranged' && eq.ranged) posture = 'ranged';
    else if (kind === 'magic' && eq.spell) posture = 'magic';
    else if (kind === 'unarmed') posture = 'boxer';
    else posture = eq.weapon ? 'weapon' : eq.ranged ? 'ranged' : eq.spell ? 'magic' : 'boxer';
    if (posture === 'ranged' && gameState.inCombat && (gameState.combatDistance || 0) <= 0) posture = 'rangedLowered';
    return posture;
}

// Couleurs des enchantements d'un objet (une par mécanique, 3 au plus).
function enchantColors(item) {
    return ((item && item.mechanics) || []).slice(0, 3).map(m => ENCHANT_COLORS[m] || ENCHANT_DEFAULT_COLOR);
}

function crawlerLoadout() {
    const eq = gameState.equipment || {};
    return {
        race: gameState.race || null, // aspect de la race (sprites/crawler-races.js)
        posture: crawlerPosture(),
        weapon: resolveItemSpriteKey(eq.weapon),
        ranged: resolveItemSpriteKey(eq.ranged),
        armor: resolveItemSpriteKey(eq.armor),
        glow: eq.spell ? (CRAWLER_SPELL_GLOWS[eq.spell.icon] || CRAWLER_DEFAULT_GLOW) : null,
        ench: { weapon: enchantColors(eq.weapon), ranged: enchantColors(eq.ranged), armor: enchantColors(eq.armor) }
    };
}

function crawlerLoadoutKey(l) {
    const ench = l.ench || {};
    return [l.race || '', l.posture, l.weapon, l.ranged, l.armor, l.glow, (ench.weapon || []).join(','), (ench.ranged || []).join(','), (ench.armor || []).join(',')].join('|');
}

// Étincelles d'enchantement autour du `tip` d'un sprite : une par mécanique, à sa couleur, qui
// scintillent lentement (.ench-spark, figées sous prefers-reduced-motion).
const ENCHANT_SPARK_OFFSETS = [[-4, -3], [4, 2], [-1, 6]];
function enchantSparks(sprite, colors) {
    if (!sprite || !colors || colors.length === 0) return '';
    const [tx, ty] = sprite.tip || [0, 0];
    return `<g class="ench-fx">${colors.map((c, i) => {
        const [dx, dy] = ENCHANT_SPARK_OFFSETS[i];
        const x = tx + dx;
        const y = ty + dy;
        return `<path class="ench-spark" style="animation-delay:-${(i * 0.8).toFixed(1)}s" d="M${x} ${y - 2.6} L${x + 0.8} ${y - 0.8} L${x + 2.6} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 2.6} L${x - 0.8} ${y + 0.8} L${x - 2.6} ${y} L${x - 0.8} ${y - 0.8} Z" fill="${c}" stroke="#05060c" stroke-width="0.4"/>`;
    }).join('')}</g>`;
}

// Dessin d'un objet (par sa clé de sprite), avec ses éventuelles étincelles d'enchantement.
function itemArt(key, colors) {
    const sprite = key && ITEM_SPRITES[key];
    return sprite ? sprite.art + enchantSparks(sprite, colors) : '';
}

// Type de fiole d'un consommable (voir CONSUMABLE_FLASKS) : 'mixed' s'il rend PV ET mana, 'mana' s'il
// ne rend que du mana, sinon 'heal' (y compris les consommables qui ne rendent rien).
function consumableFlaskKind(item) {
    const heal = item && item.heal > 0;
    const mana = item && item.mana > 0;
    if (heal && mana) return 'mixed';
    return mana ? 'mana' : 'heal';
}

// Fiole d'un consommable (repère -24..24) : verre, liquide à la couleur de son type, reflet, bouchon.
function consumableFlaskArt(kind) {
    const liquid = (part, f) => `<path d="${CONSUMABLE_FLASK_LIQUID[part]}" fill="${f.liquid}" stroke="${f.dark}" stroke-width="1"/>`;
    const heal = CONSUMABLE_FLASKS.heal;
    const mana = CONSUMABLE_FLASKS.mana;
    const content = kind === 'mixed'
        ? liquid('left', heal) + liquid('right', mana) + '<line x1="0" y1="0" x2="0" y2="19" stroke="#05060c" stroke-width="1"/>'
        : liquid('full', CONSUMABLE_FLASKS[kind] || heal);
    const shine = (CONSUMABLE_FLASKS[kind] || mana).shine || '#e9d5ff';
    return `<rect x="-5" y="-12" width="10" height="9" fill="#cbd5e1" fill-opacity="0.25" stroke="#e2e8f0" stroke-width="1.6"/>`
        + `<circle cx="0" cy="8" r="13" fill="#cbd5e1" fill-opacity="0.18" stroke="#e2e8f0" stroke-width="2"/>`
        + content
        + `<circle cx="-4" cy="11" r="1.6" fill="${shine}"/><circle cx="3" cy="14" r="1.1" fill="${shine}"/>`
        + `<path d="M -8 1 Q -10 6 -8 11" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`
        + `<rect x="-6" y="-19" width="12" height="7" rx="2" fill="#a16207" stroke="#05060c" stroke-width="1.2"/>`;
}

// Icône d'inventaire / de boutique d'un objet : même dessin que sur le crawler, recadré (ITEM_ICON_TRANSFORMS
// ou `icon` du sprite), avec une pastille par enchantement en bas à droite. Chaîne <svg> autonome. Un consommable
// n'a pas de sprite : c'est sa fiole (consumableFlaskArt()), sans pastille.
function itemIconSvg(item, size = 28) {
    if (item && item.category === 'consumables') {
        return `<svg class="item-icon shrink-0" viewBox="-24 -24 48 48" width="${size}" height="${size}" aria-hidden="true">${consumableFlaskArt(consumableFlaskKind(item))}</svg>`;
    }
    const key = resolveItemSpriteKey(item);
    const sprite = key && ITEM_SPRITES[key];
    if (!sprite) return '';
    const transform = sprite.icon || ITEM_ICON_TRANSFORMS[sprite.kind] || '';
    const dots = enchantColors(item).map((c, i) => `<circle cx="${18 - i * 7}" cy="18" r="3.2" fill="${c}" stroke="#05060c" stroke-width="1"/>`).join('');
    return `<svg class="item-icon shrink-0" viewBox="-24 -24 48 48" width="${size}" height="${size}" aria-hidden="true"><g transform="${transform}">${sprite.art}</g>${dots}</svg>`;
}

// Compose le crawler en couches (voir CRAWLER_PARTS/CRAWLER_ARMS) avec son équipement : objet tenu dans
// la main de la posture, l'autre arme rangée (mêlée à la hanche, distance en travers du sac), armure en
// surimpression du torse. Pure : ne dépend que de `loadout`.
function composeCrawler(l) {
    // Corps de la race : un corps dessiné (CRAWLER_RACE_BODIES) remplace couches et bras ; sinon le corps humain, teinté par la race (peau, cheveux).
    const body = crawlerRaceBody(l.race);
    const look = crawlerRaceLook(l.race);
    const tint = (markup) => tintCrawlerMarkup(markup, look);
    const parts = body ? body.parts : { base: tint(CRAWLER_PARTS.base), torso: tint(CRAWLER_PARTS.torso), head: tint(CRAWLER_PARTS.head) };
    const armSet = body && body.arms ? Object.assign({}, CRAWLER_ARMS, body.arms) : CRAWLER_ARMS;
    const baseArm = armSet[l.posture] || armSet.rest;
    const arm = body ? baseArm : Object.assign({}, baseArm, { arm: tint(baseArm.arm), after: tint(baseArm.after || ''), front: baseArm.front ? tint(baseArm.front) : baseArm.front });
    const anchors = (body && body.anchors) || {};
    const rAnchor = Object.assign({ x: 14, y: -54, rot: 55, scale: 0.8 }, anchors.stowedRanged);
    const wAnchor = Object.assign({ x: 5, y: -36, rot: 160, scale: 0.7 }, anchors.stowedWeapon);
    const [hx, hy] = arm.hand;
    const holdsWeapon = l.posture === 'weapon';
    const holdsRanged = l.posture === 'ranged' || l.posture === 'rangedLowered';
    const ench = l.ench || {};
    const stowedRanged = l.ranged && !holdsRanged
        ? `<g class="crawler-stowed-ranged" transform="translate(${rAnchor.x} ${rAnchor.y}) rotate(${rAnchor.rot}) scale(${rAnchor.scale})">${itemArt(l.ranged)}</g>` : '';
    const stowedWeapon = l.weapon && !holdsWeapon
        ? `<g class="crawler-stowed-weapon" transform="translate(${wAnchor.x} ${wAnchor.y}) rotate(${wAnchor.rot}) scale(${wAnchor.scale})">${itemArt(l.weapon)}</g>` : '';
    const armorSprite = l.armor && ITEM_SPRITES[l.armor];
    // Armure dessinée pour le torse humain (centre x 0, y -51, hauteur 36) : `anchors.armor` {x, y, scale} la recale sur le torse d'un corps dessiné.
    const aAnchor = anchors.armor;
    const armorAt = aAnchor ? ` transform="translate(${aAnchor.x || 0} ${aAnchor.y}) scale(${aAnchor.scale || 1}) translate(0 51)"` : '';
    const armorMarkup = l.armor ? `<g class="crawler-armor"${armorAt}>${itemArt(l.armor, ench.armor)}</g>` : '';
    const armorBack = armorSprite && armorSprite.layer === 'back' ? armorMarkup : '';
    const armor = armorSprite && armorSprite.layer !== 'back' ? armorMarkup : '';
    let held = '';
    // `data-t` : transformation de repos de l'objet tenu, que fx.js complète pendant un coup.
    const heldAt = rot => `class="crawler-held" data-t="translate(${hx} ${hy}) rotate(${rot})" transform="translate(${hx} ${hy}) rotate(${rot})"`;
    if (holdsWeapon && l.weapon) held = `<g ${heldAt(-12)}>${itemArt(l.weapon, ench.weapon)}</g>`;
    if (holdsRanged && l.ranged) held = `<g ${heldAt(l.posture === 'rangedLowered' ? -35 : 0)}>${itemArt(l.ranged, ench.ranged)}</g>`;
    if (l.posture === 'magic') {
        const c = l.glow || CRAWLER_DEFAULT_GLOW;
        held = `<g class="crawler-spell-glow"><circle cx="${hx - 3}" cy="${hy - 6}" r="7" fill="${c}" opacity="0.3"/><circle cx="${hx - 3}" cy="${hy - 6}" r="3.2" fill="${c}" opacity="0.85"/></g>`;
    }
    return `<g class="crawler" data-posture="${l.posture}"${l.race ? ` data-race="${l.race}"` : ''}>${parts.base}${armorBack}${stowedRanged}${stowedWeapon}${parts.torso}${armor}` +
        `${arm.arm}${held}${arm.after || ''}${parts.head}${arm.front ? `<g class="crawler-front">${arm.front}</g>` : ''}</g>`;
}

// Portrait d'une race (sans équipement, au repos), pour les cartes de choix et la fiche d'origine : un <svg> autonome (pure).
function buildRacePortraitSvg(raceKey, size = 56) {
    const markup = composeCrawler({ race: raceKey, posture: 'rest', weapon: null, ranged: null, armor: null, glow: null, ench: {} });
    return `<svg class="origin-portrait" width="${size}" height="${Math.round(size * 98 / 60)}" viewBox="-28 -94 60 98" aria-hidden="true">${markup}</svg>`;
}

// Cadavre du crawler (écran Game Over) : celui du corps dessiné de sa race s'il existe, sinon le corps humain teinté.
function crawlerCorpseMarkup(raceKey = gameState.race) {
    const body = crawlerRaceBody(raceKey);
    if (body && body.corpse) return body.corpse;
    return tintCrawlerMarkup(SCENE_CORPSE_TOPDOWN_SVG, crawlerRaceLook(raceKey));
}

// Crawler de l'état courant, avec sa clé (pour ne redessiner que quand la posture ou l'équipement change).
function currentCrawler() {
    const l = crawlerLoadout();
    return { key: crawlerLoadoutKey(l), markup: composeCrawler(l) };
}

// Met à jour le crawler d'une scène (groupe `el`) si sa posture ou son équipement a changé.
const lastCrawlerKeys = new Map();
function renderCrawlerInto(el) {
    if (!el) return;
    const c = currentCrawler();
    if (lastCrawlerKeys.get(el) === c.key) return;
    el.innerHTML = wrapSceneBody(c.markup);
    lastCrawlerKeys.set(el, c.key);
}

// Chaque silhouette est enveloppée dans un <g class="scene-body"> : le groupe extérieur porte la
// position (translate, animée par transition), le groupe intérieur la secousse d'impact, et un dernier
// groupe <g class="scene-pose"> l'élan des attaques (fx.js) — trois transformations indépendantes qui ne
// s'écrasent jamais.
function wrapSceneBody(markup) {
    return `<g class="scene-body"><g class="scene-pose">${markup}</g></g>`;
}

function ensureSceneBuilt() {
    if (sceneBuilt) return;
    placeSceneGroup(sceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
    placeSceneGroup(sceneUi.companion, COMPANION_X, SCENE_GROUND_Y);
    placeSceneAnchor(sceneUi.crawlerAnchor, CRAWLER_X, SCENE_GROUND_Y + CRAWLER_TOP + DAMAGE_ANCHOR_DROP);
    const bands = computeRangeBands(config.rangedCombat.maxDistance, crawlerFrontExtent());
    placeRangeBand(sceneUi.bandContact, sceneUi.bandContactLabel, bands.contact);
    placeRangeBand(sceneUi.bandRanged, sceneUi.bandRangedLabel, bands.ranged);
    sceneBuilt = true;
}

// --- Mobs : silhouette d'archétype + détail signature + aura d'effet (chantier « sprites & effets », phase 4)
// Nom de référence d'un mob dans MOB_DETAILS : `baseName` (posé par generateMob()/generateBoss(), avant les
// suffixes de modificateurs), sinon son nom exact, sinon le plus long nom connu par lequel son nom commence
// (« Rat Goulot Enflammé et Colossal » -> « Rat Goulot », pour les mobs sauvegardés avant `baseName`).
function resolveMobDetailKey(enemy) {
    if (!enemy) return null;
    if (enemy.baseName && MOB_DETAILS[enemy.baseName]) return enemy.baseName;
    const name = enemy.name || '';
    if (MOB_DETAILS[name]) return name;
    let best = null;
    Object.keys(MOB_DETAILS).forEach(key => {
        if (name.startsWith(key) && (!best || key.length > best.length)) best = key;
    });
    return best;
}

// Boss au sprite unique (sprites/bosses-*.js) : clé = nom d'origine ou nom exact, sinon null.
function resolveBossSpriteKey(enemy) {
    if (!enemy || typeof SCENE_BOSS_SPRITES === 'undefined') return null;
    if (enemy.baseName && SCENE_BOSS_SPRITES[enemy.baseName]) return enemy.baseName;
    return enemy.name && SCENE_BOSS_SPRITES[enemy.name] ? enemy.name : null;
}

// Objet signature tenu ou porté par un boss : dessin de ITEM_SPRITES placé par `held.transform`.
function bossHeldMarkup(held) {
    const sprite = held && ITEM_SPRITES[held.item];
    return sprite ? `<g class="boss-held" transform="${held.transform}">${sprite.art}</g>` : '';
}

// Dessin complet d'un mob (pure) : aura de son effet DERRIÈRE, silhouette de son archétype (goblinoid si
// inconnu), puis son détail signature par-dessus ; palette = celle du mob, sinon celle de l'archétype.
// `top` = point le plus haut, détail compris (couronne de boss, chiffres de dégâts, effets de fx.js).
// `opts.aura === false` : sans aura (mob à terre dans la vignette de victoire). Un boss qui a son sprite
// unique (SCENE_BOSS_SPRITES) le remplace entièrement, avec son objet signature (`held`).
function resolveMobSprite(enemy, opts) {
    const effect = enemy && enemy.effect;
    const auraFn = effect && MOB_EFFECT_AURAS[effect];
    const aura = auraFn && !(opts && opts.aura === false) ? auraFn(MOB_EFFECT_FX_COLORS[effect] || '#f8fafc') : '';
    // Boss au sprite unique : aura, objet porté dans le dos, boss, objet tenu devant.
    const bossKey = resolveBossSpriteKey(enemy);
    if (bossKey) {
        const boss = SCENE_BOSS_SPRITES[bossKey];
        const held = bossHeldMarkup(boss.held);
        const back = boss.held && boss.held.layer === 'back';
        return {
            key: `boss:${bossKey}|${aura ? effect : ''}`,
            top: boss.top,
            markup: aura + (back ? held : '') + boss.markup + (back ? '' : held),
            palette: boss.palette
        };
    }
    const archetype = enemy && SCENE_MOB_SPRITES[enemy.visualArchetype] ? enemy.visualArchetype : 'goblinoid';
    const base = SCENE_MOB_SPRITES[archetype];
    const detailKey = resolveMobDetailKey(enemy);
    const detail = detailKey ? MOB_DETAILS[detailKey] : null;
    return {
        key: `${archetype}|${detailKey || ''}|${aura ? effect : ''}`,
        top: Math.min(base.top, detail && detail.top != null ? detail.top : 0),
        markup: aura + base.markup + (detail ? detail.markup : ''),
        palette: (detail && detail.palette) || base.palette
    };
}

function renderSceneMob(enemy) {
    const sprite = resolveMobSprite(enemy);
    const spriteKey = sprite.key + (enemy.isBoss ? ':boss' : '');
    if (lastMobSpriteKey !== spriteKey) {
        const crown = enemy.isBoss
            ? `<g transform="translate(0 ${sprite.top - 2})">${SCENE_BOSS_CROWN_SVG}</g>`
            : '';
        sceneUi.mob.innerHTML = wrapSceneBody(sprite.markup + crown);
        lastMobSpriteKey = spriteKey;
    }
    applySceneTint(sceneUi.mob, sprite.palette);
    const x = distanceToX(gameState.combatDistance, config.rangedCombat.maxDistance, crawlerFrontExtent());
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

// PV « tenus » pendant un effet d'attaque (fx.js) : la barre du combattant touché ne baisse qu'à
// l'impact, pas au moment où le coup part (les dégâts, eux, sont déjà appliqués). `enemy` = l'ennemi
// concerné (un autre ennemi n'est jamais affecté), `player` = vrai si les PV du crawler sont tenus.
const sceneVitalsHold = { enemy: null, enemyHp: 0, player: false, playerHp: 0 };

// Barres de vie au-dessus de la scène : nom + PV actuels/max de chaque combattant.
function renderSceneVitals(enemy) {
    const enemyMax = enemy.maxHp || enemy.hp;
    const enemyHp = sceneVitalsHold.enemy === enemy ? sceneVitalsHold.enemyHp : enemy.hp;
    const playerHp = sceneVitalsHold.player ? sceneVitalsHold.playerHp : gameState.hp;
    sceneUi.enemyHpBar.style.width = `${hpPercent(enemyHp, enemyMax)}%`;
    sceneUi.enemyHpText.innerText = `PV ${Math.round(Math.max(0, enemyHp))}/${Math.round(enemyMax)}`;
    sceneUi.playerHpBar.style.width = `${hpPercent(playerHp, gameState.maxHp)}%`;
    sceneUi.playerHpText.innerText = `PV ${Math.round(Math.max(0, playerHp))}/${Math.round(gameState.maxHp)}`;
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
    // À terre (rework des compagnons) : il reste dans la scène, mais estompé — il n'agit plus.
    sceneUi.companion.style.opacity = companion.downed ? '0.35' : '';
    if (lastCompanionKey !== specialty) {
        sceneUi.companion.innerHTML = wrapSceneBody(SCENE_COMPANION_SVG);
        applySceneTint(sceneUi.companion, COMPANION_SPECIALTY_TINTS[specialty] || MOB_DEFAULT_TINT);
        lastCompanionKey = specialty;
    }
}

// Rendu de la scène de combat, appelé via renderScene('combat') en fin d'updateUI() (app.js) après
// chaque action (et au moment de l'impact d'un coup, voir animateDieHit()). Ne fait rien hors
// combat : la scène vit dans #combat-zone, que updateUI() masque déjà dans ce cas.
// Décor du combat en cours : celui du quartier sur un étage classique ; sur un étage urbain (villes
// explorables, chantier 12), la route (embuscade, tronçon, gardien de l'escalier) ou le repaire pendant une
// plongée (URBAN_COMBAT_BACKDROPS).
function resolveCombatBackdrop() {
    if (typeof isUrbanFloor === 'function' && isUrbanFloor()) {
        const kind = gameState.pendingLairDive ? 'lair' : 'road';
        return { key: `urban:${kind}`, def: URBAN_COMBAT_BACKDROPS[kind] };
    }
    const key = resolveBackdropKey(gameState.currentDistrict);
    return { key, def: SCENE_BACKDROPS[key] };
}

// Progression d'une plongée dans un repaire, en haut de la scène : un pion par sbire (plein = vaincu,
// cerclé = en cours) puis la couronne du boss. Vide hors plongée ; redessinée seulement si elle change.
function lairProgressState() {
    const dive = gameState.pendingLairDive;
    const fm = gameState.floorMap;
    const lair = dive && fm && fm.lairsById && fm.lairsById[dive.lairId];
    if (!lair) return null;
    const total = Math.max(1, lair.combatsRemaining);
    const done = dive.stage === 'boss' ? total : Math.max(0, total - dive.combatsLeft);
    return { total, done, boss: dive.stage === 'boss' };
}

function composeLairProgress(state) {
    if (!state) return '';
    const gap = 16;
    const count = state.total + 1;
    const x0 = SCENE_WIDTH / 2 - ((count - 1) * gap) / 2;
    const pips = [];
    for (let i = 0; i < state.total; i++) {
        const cx = x0 + i * gap;
        const current = !state.boss && i === state.done;
        const cleared = i < state.done;
        pips.push(`<circle cx="${cx}" cy="17" r="4" fill="${cleared ? '#9ca3af' : '#1f2937'}" stroke="${current ? '#f87171' : '#4b5563'}" stroke-width="${current ? 2 : 1.2}"/>`);
    }
    const crownX = x0 + state.total * gap;
    const crown = `<g transform="translate(${crownX} 22) scale(0.6)" opacity="${state.boss ? 1 : 0.45}">${SCENE_BOSS_CROWN_SVG}</g>`;
    const w = count * gap + 44;
    return `<g class="lair-progress" data-done="${state.done}" data-total="${state.total}" data-boss="${state.boss ? 1 : 0}">
        <rect x="${SCENE_WIDTH / 2 - w / 2}" y="4" width="${w}" height="22" rx="11" fill="#05060c" opacity="0.6"/>
        <text x="${x0 - 12}" y="20" text-anchor="end" font-size="7" font-weight="bold" letter-spacing="1" fill="#f87171">REPAIRE</text>
        ${pips.join('')}${crown}
    </g>`;
}

let lastLairProgressKey = null;
function renderLairProgress() {
    const state = lairProgressState();
    const key = state ? `${state.done}/${state.total}/${state.boss}` : '';
    if (key === lastLairProgressKey || !sceneUi.lairProgress) return;
    sceneUi.lairProgress.innerHTML = composeLairProgress(state);
    lastLairProgressKey = key;
}

function renderCombatScene() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy) return;
    // Combat contre Gorgoth (chantier 17) : la scène haute #demon-scene remplace celle-ci ; un autre combat la
    // referme d'abord (combattants, effets et ancres reviennent dans #combat-scene).
    if (enemy.isDemon) { renderDemonScene(); return; }
    if (demonSceneActive) deactivateDemonScene();
    ensureSceneBuilt();
    const backdrop = resolveCombatBackdrop();
    renderSceneBackdrop(sceneUi.backdrop, 'cbd', backdrop.key, backdrop.def);
    renderLairProgress();
    renderCrawlerInto(sceneUi.crawler);
    renderSceneVitals(enemy);
    renderSceneMob(enemy);
    renderSceneCompanion();
    renderRangeBands();
    renderSceneDistance();
}

// --- Scène des villes spécialisées (#shop-zone) ------------------------------------------------------
// Même décor de quartier que le combat (préfixe 'sbd', pour ne jamais partager un identifiant de
// motif avec la scène de combat), le crawler à la même place à droite, mais ni barres de vie ni bandes
// de portée : une mise en scène fixe à gauche (enseigne + comptoir + marchand, ou tableau noir +
// professeur), redessinée seulement quand le rôle ou la spécialité change.
const shopSceneUi = {
    svg: document.getElementById('shop-scene-svg'),
    backdrop: document.getElementById('shop-scene-backdrop'),
    setpiece: document.getElementById('shop-scene-setpiece'),
    crawler: document.getElementById('shop-scene-crawler')
};

let shopSceneBuilt = false;
let lastShopSetpieceKey = null;

// Positions (unités viewBox) des éléments de mise en scène, à gauche du crawler.
const SHOP_SIGN_POS = { x: 92, y: 34 };
const SHOP_MERCHANT_X = 86;
const SHOP_COUNTER = { x: 96, w: 112, h: 44 };
const TRAINER_BOARD_POS = { x: 118, y: 62 };
const SHOP_TRAINER_X = 202;

function placedProp(type, x, y, opts) {
    return `<g transform="translate(${x} ${y})">${BACKDROP_PROPS[type].markup(opts, null)}</g>`;
}

function spriteAt(markup, x) {
    return `<g transform="translate(${x} ${SCENE_GROUND_Y})">${markup}</g>`;
}

// Mise en scène d'un rôle, en SVG. Pure : ne dépend que du rôle et de la spécialité (clés inconnues ->
// premier style du catalogue, voir shopSign/shopCounter/chalkboard dans backdrops.js).
function composeShopSetpiece(role, specialty, prefix) {
    if (role === 'arcade') {
        return `
        <g class="shop-setpiece" data-role="arcade">
            ${placedProp('arcadeSign', SHOP_SIGN_POS.x, SHOP_SIGN_POS.y, {})}
            ${placedProp('arcadeCabinets', 110, SCENE_GROUND_Y, {})}
            ${placedProp('arcadeCabinets', 196, SCENE_GROUND_Y, {})}
        </g>`;
    }
    if (role === 'merchant') {
        const style = SHOP_SIGN_STYLES[specialty] || SHOP_SIGN_STYLES.weapons;
        const opts = { specialty };
        return `
        <defs>
            <radialGradient id="${prefix}-sign-glow">
                <stop offset="0%" stop-color="${style.color}" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="${style.color}" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <g class="shop-setpiece" data-role="merchant" data-specialty="${specialty}">
            <ellipse cx="${SHOP_SIGN_POS.x}" cy="${SHOP_SIGN_POS.y}" rx="70" ry="42" fill="url(#${prefix}-sign-glow)"/>
            ${placedProp('shopSign', SHOP_SIGN_POS.x, SHOP_SIGN_POS.y, opts)}
            ${spriteAt(SCENE_MERCHANT_SVG, SHOP_MERCHANT_X)}
            ${placedProp('shopCounter', SHOP_COUNTER.x, SCENE_GROUND_Y, { specialty, w: SHOP_COUNTER.w, h: SHOP_COUNTER.h })}
        </g>`;
    }
    return `
        <g class="shop-setpiece" data-role="trainer" data-specialty="${specialty}">
            ${placedProp('chalkboard', TRAINER_BOARD_POS.x, TRAINER_BOARD_POS.y, { skill: specialty })}
            ${spriteAt(SCENE_TRAINER_SVG, SHOP_TRAINER_X)}
        </g>`;
}

function ensureShopSceneBuilt() {
    if (shopSceneBuilt) return;
    placeSceneGroup(shopSceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
    shopSceneBuilt = true;
}

function renderShopScene(mode) {
    const cityId = mode === 'arcade' ? gameState.pendingArcadeCityId : gameState.pendingShopCityId;
    if (!cityId) return;
    const city = typeof urbanCityById === 'function' ? urbanCityById(cityId) : null;
    if (!city) return;
    ensureShopSceneBuilt();
    renderCrawlerInto(shopSceneUi.crawler);
    renderSceneBackdrop(shopSceneUi.backdrop, 'sbd', resolveBackdropKey(gameState.currentDistrict));
    const key = `${mode}:${city.specialty}`;
    if (lastShopSetpieceKey === key) return;
    shopSceneUi.setpiece.innerHTML = composeShopSetpiece(mode, city.specialty, 'sbd');
    shopSceneUi.svg.setAttribute('aria-label', mode === 'arcade' ? "Salle de jeux, bornes d'arcade, vous à droite" : mode === 'merchant'
        ? `Échoppe du marchand (${(SHOP_SIGN_STYLES[city.specialty] || SHOP_SIGN_STYLES.weapons).label.toLowerCase()}), vous à droite`
        : `Salle du professeur (${(TRAINER_BOARD_STYLES[city.specialty] || TRAINER_BOARD_STYLES.weapon).label.toLowerCase()}), vous à droite`);
    lastShopSetpieceKey = key;
}

// --- Scène de salle sécurisée (#safehouse-choice-zone) -----------------------------------------------
// Décor propre à l'abri (safehouseBackdropFor() dans backdrops.js : base commune + accessoires signature
// du type tiré dans safehouses.js), jamais celui du quartier ; crawler à droite, sans barres de vie ni
// bandes de portée. Redessiné seulement quand le type change (préfixe 'hbd').
const safehouseSceneUi = {
    svg: document.getElementById('safehouse-scene-svg'),
    backdrop: document.getElementById('safehouse-scene-backdrop'),
    crawler: document.getElementById('safehouse-scene-crawler')
};
let safehouseSceneBuilt = false;

function renderSafehouseScene() {
    const map = gameState.floorMap;
    const room = map && map.roomsById && map.roomsById[gameState.pendingSafehouseRoomId];
    if (!room) return;
    if (!safehouseSceneBuilt) {
        placeSceneGroup(safehouseSceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
        safehouseSceneBuilt = true;
    }
    renderCrawlerInto(safehouseSceneUi.crawler);
    const typeName = room.safehouse ? room.safehouse.name : '';
    if (renderSceneBackdrop(safehouseSceneUi.backdrop, 'hbd', `safehouse:${typeName}`, safehouseBackdropFor(typeName))) {
        safehouseSceneUi.svg.setAttribute('aria-label', `${typeName || 'Salle sécurisée'} : porte blindée, zone sûre, vous à droite`);
    }
}


// --- Scène d'exploration (#explore-scene, remplace l'ancienne carte à jouer) --------------------------
// Chaque événement d'exploration (setSceneHeader() dans app.js) peut nommer une vignette : décor du
// quartier courant en fond (préfixe 'ebd') + mise en scène de l'événement (accessoires de backdrops.js,
// silhouettes de sprites/*.js). Sans vignette, l'emoji de l'événement s'affiche à la place. Même repère
// 360 x 150 que la scène de combat, vue complète ; le crawler reste à droite, à la même place qu'en
// combat, pour que le passage exploration -> combat reste continu.
const exploreSceneUi = {
    wrap: document.getElementById('explore-scene'),
    svg: document.getElementById('explore-scene-svg'),
    backdrop: document.getElementById('explore-scene-backdrop'),
    vignette: document.getElementById('explore-scene-vignette'),
    icon: document.getElementById('explore-icon')
};

const FULL_SCENE_VIEW = { x: 0, y: 0, w: SCENE_WIDTH, h: 150 };
const NPC_CRAWLER_TINTS = {
    friendly: { base: '#3a6b6b', dark: '#264a4a', accent: '#fde68a' },
    hostile: { base: '#3a3036', dark: '#241c22', accent: '#c23b3b' }
};

function propAt(type, x, y, opts) {
    return `<g transform="translate(${x} ${y})">${BACKDROP_PROPS[type].markup({ type, ...(opts || {}) }, null)}</g>`;
}

function tintStyle(tint) {
    return `--mob-base:${tint.base};--mob-dark:${tint.dark};--mob-accent:${tint.accent || MOB_ACCENT_COLOR}`;
}

// `pose` : { opacity, cls } facultatifs — la classe CSS (animation) porte sur un groupe intérieur, pour
// ne jamais écraser la translation du groupe extérieur.
function crawlerAt(x, pose) {
    const p = pose || {};
    const fade = p.opacity != null ? ` opacity="${p.opacity}"` : '';
    const crawler = currentCrawler().markup;
    const body = p.cls ? `<g class="${p.cls}">${crawler}</g>` : crawler;
    return `<g transform="translate(${x} ${SCENE_GROUND_Y})"${fade}>${body}</g>`;
}

// Silhouette de mob posée (pose 'stand' face au crawler, 'away' dos tourné, 'down' à terre).
function mobAt(enemy, x, pose, opacity) {
    const sprite = resolveMobSprite(enemy, { aura: pose !== 'down' });
    const crown = enemy && enemy.isBoss && pose !== 'down' ? `<g transform="translate(0 ${sprite.top - 2})">${SCENE_BOSS_CROWN_SVG}</g>` : '';
    const transform = pose === 'down'
        ? `translate(${x} ${SCENE_GROUND_Y - 12}) rotate(-90)`
        : `translate(${x} ${SCENE_GROUND_Y})${pose === 'away' ? ' scale(-1 1)' : ''}`;
    const fade = opacity != null ? ` opacity="${opacity}"` : '';
    return `<g transform="${transform}" style="${tintStyle(sprite.palette)}"${fade}>${sprite.markup}${crown}</g>`;
}

// Autre crawler croisé en exploration : silhouette de compagnon agrandie, bras levé (amical) ou
// couteau et yeux rouges (hostile).
function npcCrawlerAt(x, disposition) {
    const hostile = disposition === 'hostile';
    const tint = NPC_CRAWLER_TINTS[hostile ? 'hostile' : 'friendly'];
    const extra = hostile
        ? `<path d="M9 -34 L22 -40" stroke="#b8b2a0" stroke-width="2" stroke-linecap="round"/><path d="M6 -33 L10 -35" stroke="#4a3a24" stroke-width="3"/><circle cx="3" cy="-55" r="1.4" fill="#c23b3b"/>`
        : `<path class="mf-line" d="M6 -42 L14 -60"/><circle cx="14" cy="-62" r="3" class="mf-base"/>`;
    return `<g transform="translate(${x} ${SCENE_GROUND_Y}) scale(1.3)" style="${tintStyle(tint)}">${SCENE_COMPANION_SVG}${extra}</g>`;
}

const SHADOW_OVERLAY = '<rect x="0" y="0" width="360" height="150" fill="#05060c" opacity="0.45"/>';

// --- Gorgoth le Concierge (chantier 17, lot 6) : porte colossale, mise au tapis, expulsion ------------------
// Serrures allumées de la porte : `ctx.keys` s'il est fourni, sinon demonKeysCount() (lot 1) si la fonction
// existe, sinon 0 ; toujours un entier de 0 à 4.
function demonGateKeys(ctx) {
    let n = ctx && ctx.keys != null ? ctx.keys : null;
    if (n == null && typeof demonKeysCount === 'function') {
        try { n = demonKeysCount(); } catch (e) { n = 0; }
    }
    n = Math.floor(Number(n) || 0);
    return Math.max(0, Math.min(4, n));
}

// Crawler réduit (posé au sol, mis à l'échelle depuis ses pieds) : « minuscule » devant la porte.
function crawlerScaledAt(x, scale, opacity) {
    const fade = opacity != null ? ` opacity="${opacity}"` : '';
    return `<g transform="translate(${x} ${SCENE_GROUND_Y}) scale(${scale})"${fade}>${currentCrawler().markup}</g>`;
}

// Braises qui montent (positions fixes, jamais Math.random()).
function demonEmbers(points) {
    return points.map(([x, y, r], i) => `<circle class="bd-float" style="animation-delay:-${(i * 0.7).toFixed(1)}s" cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? '#fdba74' : '#f97316'}" opacity="0.85"/>`).join('');
}

// Lettre « Z » dessinée (aucun texte SVG) : origine en haut à gauche, taille `s`.
function demonSnoreZ(x, y, s, delay) {
    return `<path class="bd-float" style="animation-delay:-${delay}s" d="M${x} ${y} h${s} l${-s} ${s * 1.1} h${s}" fill="none" stroke="#e5e7eb" stroke-width="${Math.max(1.2, s / 4).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Gorgoth assommé, étendu au sol (silhouette simplifiée : le grand sprite détaillé est celui du combat).
// Repère local : origine au sol, sous le ventre ; tête à gauche (x ≈ -86), sabots à droite.
const DEMON_KNOCKOUT_BODY = `
    <path d="M-60 -16 Q-52 -62 -6 -72 Q36 -78 58 -52 Q80 -34 92 -4 L84 0 H-50 Z" fill="#231c20" opacity="0.85"/>
    <path d="M-30 -30 Q-12 -58 18 -60 M6 -40 Q28 -66 50 -50" fill="none" stroke="#3a3034" stroke-width="3" opacity="0.8"/>
    <path d="M-70 0 Q-66 -34 -20 -38 Q40 -44 76 -20 Q94 -8 92 0 Z" fill="#2a1717" stroke="#05060c" stroke-width="2"/>
    <path d="M-40 -32 L-28 -8 L-6 -36 L10 -4 L34 -34 L50 -6 L66 -24 L72 0 H-46 Z" fill="#1e3a8a" stroke="#05060c" stroke-width="1.2" opacity="0.9"/>
    <path d="M-36 -26 l8 6 l-2 8 M6 -30 l6 8 l8 -2 M48 -18 l4 8" fill="none" stroke="#f97316" stroke-width="1.6" stroke-linecap="round"/>
    <path class="bd-halo-flicker" d="M-18 -36 l6 10 l10 -4 l6 12 M24 -40 l4 12 l12 2" fill="none" stroke="#fb923c" stroke-width="1.1" opacity="0.8"/>
    <path d="M76 -18 Q96 -24 104 -10 L106 0 H86 Z" fill="#2a1717" stroke="#05060c" stroke-width="1.5"/>
    <path d="M100 -2 l8 -6 l2 8 Z" fill="#05060c"/>
    <path d="M-30 -34 Q-44 -46 -58 -40 Q-52 -24 -34 -26" fill="#2a1717" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-60 -40 l-6 -5 M-58 -36 l-8 -1 M-58 -42 l-3 -7" stroke="#05060c" stroke-width="2" stroke-linecap="round"/>
    <circle cx="-86" cy="-18" r="18" fill="#2a1717" stroke="#05060c" stroke-width="2"/>
    <path d="M-98 -30 Q-116 -44 -126 -30 Q-114 -36 -102 -22 Z" fill="#3a2e30" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-76 -32 Q-70 -50 -54 -50 Q-66 -44 -70 -28 Z" fill="#3a2e30" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-96 -24 l6 6 M-90 -24 l-6 6 M-82 -24 l6 6 M-76 -24 l-6 6" stroke="#fb923c" stroke-width="2" stroke-linecap="round"/>
    <path d="M-94 -10 Q-86 -4 -78 -10 Q-86 -14 -94 -10 Z" fill="#05060c"/>
    <path d="M-88 -8 q3 6 6 0" fill="#e11d48"/>`;

// Casquette de concierge calcinée, tombée à côté (insigne : clé dorée). Origine : au sol.
const DEMON_FALLEN_CAP = `
    <path d="M-14 0 Q-14 -14 0 -14 Q14 -14 14 0 Z" fill="#3b4252" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-20 0 Q-6 4 14 0" fill="none" stroke="#05060c" stroke-width="3"/>
    <path d="M-20 0 Q-6 3 14 0" fill="none" stroke="#1f2430" stroke-width="2"/>
    <path d="M-14 -4 H14" stroke="#1f2430" stroke-width="2"/>
    <circle cx="0" cy="-9" r="2.4" fill="none" stroke="#facc15" stroke-width="1.2"/><path d="M2 -9 h5 M5 -9 v2" stroke="#facc15" stroke-width="1.2"/>
    <path d="M-8 -12 l3 3 M6 -12 l-2 4" stroke="#05060c" stroke-width="1" opacity="0.6"/>`;

// Étoiles et oiseaux de dessin animé qui tournent au-dessus de la tête (rotation CSS, coupée sous reduced motion).
function demonDizzyRing(cx, cy) {
    const star = (x, y, c) => `<path d="M${x} ${y - 4.5} L${x + 1.3} ${y - 1.3} L${x + 4.5} ${y - 1.3} L${x + 2} ${y + 0.8} L${x + 3} ${y + 4.2} L${x} ${y + 2.2} L${x - 3} ${y + 4.2} L${x - 2} ${y + 0.8} L${x - 4.5} ${y - 1.3} L${x - 1.3} ${y - 1.3} Z" fill="${c}" stroke="#05060c" stroke-width="0.7"/>`;
    const bird = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fde68a" stroke="#05060c" stroke-width="0.7"/><path d="M${x - 5} ${y - 4} q2.5 2 5 3 q2.5 -1 5 -3" fill="none" stroke="#05060c" stroke-width="1"/><path d="M${x + 2.4} ${y} l2 0.8 l-2 0.8 Z" fill="#f97316"/>`;
    return `<ellipse cx="${cx}" cy="${cy}" rx="22" ry="6" fill="none" stroke="#fde68a" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.6"/>
        <g class="bd-spin">${star(cx - 20, cy, '#facc15')}${star(cx + 18, cy + 2, '#fde047')}${bird(cx, cy - 6)}${bird(cx + 4, cy + 6)}${star(cx - 4, cy + 6, '#fef08a')}</g>`;
}

// Bouffées de fumée (expulsion). Positions fixes.
function demonSmoke(points) {
    return points.map(([x, y, r], i) => `<g class="bd-steam" style="animation-delay:-${(i * 0.6).toFixed(1)}s"><circle cx="${x}" cy="${y}" r="${r}" fill="#4b4548" opacity="0.55"/><circle cx="${x + r * 0.7}" cy="${y - r * 0.4}" r="${(r * 0.7).toFixed(1)}" fill="#5f585b" opacity="0.5"/></g>`).join('');
}

// Une entrée par vignette : ctx = { enemy, disposition } selon l'événement. Pures (chaîne SVG).
const EXPLORE_VIGNETTES = {
    silence: () => crawlerAt(CRAWLER_X),
    ambiance: () => propAt('cameraDrone', 232, 50) + crawlerAt(CRAWLER_X),
    knownPath: () => propAt('chalkMarks', 196, 64) + crawlerAt(CRAWLER_X),
    emptyLair: () => propAt('fallenCrown', 214, 124) + crawlerAt(CRAWLER_X),
    floorCleared: () => propAt('checkedMap', 206, 60) + crawlerAt(CRAWLER_X),
    fled: () => propAt('dustPuff', 250, 124) + crawlerAt(CRAWLER_X + 14),
    treasure: () => propAt('treasureChest', 222, 124) + crawlerAt(CRAWLER_X),
    minorFind: () => propAt('pouch', 232, 124) + crawlerAt(CRAWLER_X),
    gold: () => propAt('coinPile', 232, 124) + crawlerAt(CRAWLER_X),
    audienceGift: () => propAt('parachuteCrate', 222, 74) + crawlerAt(CRAWLER_X),
    trap: () => propAt('spikeTrap', 250, 124) + crawlerAt(CRAWLER_X, { cls: 'scene-recoil' }),
    timeLoss: () => propAt('bigClock', 206, 60) + crawlerAt(CRAWLER_X),
    cafeteria: () => propAt('darkCafeteria', 206, 124) + SHADOW_OVERLAY + crawlerAt(CRAWLER_X, { opacity: 0.8 }),
    crawlerFriendly: () => npcCrawlerAt(206, 'friendly') + crawlerAt(CRAWLER_X),
    crawlerHostile: () => npcCrawlerAt(206, 'hostile') + crawlerAt(CRAWLER_X),
    stealthUnseen: (ctx) => mobAt(ctx.enemy, 196, 'away') + crawlerAt(CRAWLER_X, { opacity: 0.7 }) + propAt('crate', 292, 124, { w: 40, h: 34 }),
    stealthEvaded: (ctx) => mobAt(ctx.enemy, 176, 'away', 0.4) + crawlerAt(CRAWLER_X),
    combat: (ctx) => mobAt(ctx.enemy, 206, 'stand') + crawlerAt(CRAWLER_X),
    bossSpotted: (ctx) => mobAt(ctx.enemy, 200, 'stand') + crawlerAt(CRAWLER_X),
    victory: (ctx) => mobAt(ctx.enemy, 236, 'down', 0.85) + crawlerAt(CRAWLER_X),
    bossVictory: (ctx) => mobAt(ctx.enemy, 226, 'down', 0.85) + propAt('fallenCrown', 258, 124) + crawlerAt(CRAWLER_X),
    pact: () => propAt('pactAltar', 212, 124) + crawlerAt(CRAWLER_X),
    citySafe: (ctx) => propAt('citySign', 222, 124, { text: ctx.cityName }) + crawlerAt(CRAWLER_X),
    urbanGuardian: (ctx) => propAt(ctx.isExit ? 'exitDoor' : 'stairsDown', 184, 124) + mobAt(ctx.enemy, 236, 'stand') + crawlerAt(CRAWLER_X),
    lairSpotted: () => propAt('lairEntrance', 212, 124) + crawlerAt(CRAWLER_X),
    // Pickpocket (villes des étages urbains, chantier 12) : un crawler louche file dans un nuage de poussière.
    pickpocket: () => propAt('dustPuff', 222, 124) + npcCrawlerAt(176, 'hostile') + crawlerAt(CRAWLER_X, { cls: 'scene-recoil' }),
    // Émission DeathWatch (chantier 4) : le plateau vient à vous — enseigne EN DIRECT, applaudimètre,
    // drone caméra, et le présentateur qui vous tend son micro.
    showStudio: () => propAt('onAirSign', 120, 42) + propAt('applauseMeter', 60, 124) + propAt('cameraDrone', 250, 30)
        + `<g transform="translate(200 124)">${SCENE_HOST_SVG}</g>` + crawlerAt(CRAWLER_X),
    // Chasseurs de primes (chantier 3) : l'avis de recherche placardé, montant de la prime courante.
    wantedPoster: (ctx) => propAt('wantedPoster', 200, 124, { value: ctx.value }) + crawlerAt(CRAWLER_X),
    stairs: () => propAt('stairsDown', 214, 124) + crawlerAt(CRAWLER_X),
    // Gorgoth le Concierge (chantier 17, lot 6). Porte colossale fermée, qui déborde du cadre : 4 serrures
    // (une allumée par clé de boss de quartier), chaînes en croix, rouge qui filtre par les jointures.
    demonGateLocked: (ctx) => propAt('colossalGate', 168, 124, { w: 172, h: 178, locks: demonGateKeys(ctx) })
        + demonEmbers([[96, 112, 1.4], [232, 96, 1.2], [150, 70, 1], [204, 40, 1.3]]) + crawlerAt(CRAWLER_X),
    // Battants entrouverts : lueur rouge intense, deux yeux au fond, crawler minuscule dans la lumière.
    demonGateOpen: () => propAt('colossalGate', 170, 124, { w: 200, h: 196, open: true })
        + '<path d="M146 124 L194 124 L262 150 L78 150 Z" fill="#f97316" opacity="0.28"/>'
        + '<g class="bd-halo-flicker"><ellipse cx="158" cy="44" rx="5" ry="2.2" fill="#fef08a"/><ellipse cx="182" cy="44" rx="5" ry="2.2" fill="#fef08a"/></g>'
        + demonEmbers([[120, 96, 1.4], [214, 80, 1.2], [168, 30, 1.1], [240, 110, 1.3], [98, 60, 1]])
        + crawlerScaledAt(206, 0.55, 0.92),
    // Mise au tapis : Gorgoth étendu, étoiles et oiseaux qui tournent, casquette tombée, ronflement « Zzz » dessiné.
    demonKnockout: () => `<g transform="translate(150 124)">${DEMON_KNOCKOUT_BODY}</g>`
        + `<g transform="translate(40 124) rotate(-18)">${DEMON_FALLEN_CAP}</g>`
        + demonDizzyRing(64, 70)
        + demonSnoreZ(78, 92, 5, 0) + demonSnoreZ(88, 76, 7, 1.2) + demonSnoreZ(102, 56, 9, 2.4)
        + crawlerAt(CRAWLER_X),
    // Expulsion : la porte s'est refermée (chaînes, sceau rouge, écriteau « FERMÉ »), le crawler est éjecté
    // dans un nuage de fumée.
    demonExpelled: () => propAt('colossalGate', 132, 124, { w: 150, h: 160, seal: true })
        + '<g transform="translate(132 104)"><path d="M-14 -10 L0 -22 L14 -10" fill="none" stroke="#8a8086" stroke-width="1.2"/><rect x="-18" y="-10" width="36" height="13" rx="1.5" fill="#d8c9a3" stroke="#05060c" stroke-width="1"/><text x="0" y="0" text-anchor="middle" font-size="7.5" font-weight="bold" letter-spacing="0.5" fill="#7f1d1d">FERMÉ</text></g>'
        + demonSmoke([[214, 116, 9], [236, 108, 7], [200, 100, 6], [256, 120, 8]])
        + '<path d="M218 92 H252 M224 104 H262 M214 80 H244" stroke="#e5e7eb" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>'
        + `<g transform="translate(292 108) rotate(28)"><g class="scene-recoil">${currentCrawler().markup}</g></g>`
};

function composeExploreVignette(key, ctx) {
    const vignette = EXPLORE_VIGNETTES[key];
    return vignette ? vignette(ctx || {}) : '';
}

// DEV uniquement (console) : affiche successivement les 4 vignettes de Gorgoth le Concierge dans la scène
// d'exploration, `delayMs` entre chacune. Renvoie la liste des vignettes montrées.
const DEMON_VIGNETTE_PREVIEW = [
    ['🔒', 'Porte colossale', 'Porte', 'demonGateLocked'],
    ['🚪', "L'antre s'ouvre", 'Porte', 'demonGateOpen'],
    ['💫', 'Gorgoth est K.O.', 'Victoire', 'demonKnockout'],
    ['💨', 'Expulsé', 'Défaite', 'demonExpelled']
];
function devPreviewDemonVignettes(delayMs = 2500) {
    DEMON_VIGNETTE_PREVIEW.forEach((args, i) => setTimeout(() => setSceneHeader(...args), i * delayMs));
    return DEMON_VIGNETTE_PREVIEW.map(args => args[3]);
}

// Dessine une vignette dans une cible { wrap, svg, backdrop, vignette, icon?, prefix, view } : décor du
// quartier courant + vignette, redessinés seulement quand ils changent. `scene` : nom de vignette ou
// { key, enemy, disposition } ; inconnu ou absent -> scène masquée (et emoji de repli réaffiché).
const vignetteKeys = {};
function renderVignetteScene(target, scene) {
    if (!target.wrap) return;
    const spec = typeof scene === 'string' ? { key: scene } : (scene || {});
    const known = !!EXPLORE_VIGNETTES[spec.key];
    const v = target.view;
    target.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    // `overlayIcon` : l'emoji de repli est posé PAR-DESSUS la scène (scène d'exploration, toujours
    // visible car c'est aussi le bouton Explorer) ; sinon, la scène et l'emoji s'échangent.
    if (!target.overlayIcon) target.wrap.classList.toggle('hidden', !known);
    if (target.icon) target.icon.classList.toggle('hidden', known);
    if (!known) return;
    renderSceneBackdrop(target.backdrop, target.prefix, resolveBackdropKey(gameState.currentDistrict));
    const enemy = spec.enemy;
    const key = [spec.key, enemy ? `${enemy.visualArchetype}:${enemy.effect}:${enemy.isBoss ? 1 : 0}` : '', spec.cityName || '', spec.isExit ? 1 : 0, spec.value ?? '', spec.key === 'demonGateLocked' ? demonGateKeys(spec) : '', currentCrawler().key].join('|');
    if (vignetteKeys[target.prefix] === key) return;
    target.vignette.innerHTML = composeExploreVignette(spec.key, spec);
    vignetteKeys[target.prefix] = key;
}

let lastExploreSpec = null;
function renderExploreScene(scene) {
    lastExploreSpec = scene === undefined ? null : scene;
    renderVignetteScene({ ...exploreSceneUi, prefix: 'ebd', view: FULL_SCENE_VIEW, overlayIcon: true }, lastExploreSpec);
}

// Après toute action (updateUI) : le crawler des scènes déjà affichées suit sa posture et son équipement
// (équiper un objet depuis l'inventaire, par exemple) sans attendre le prochain événement. Chaque rendu
// est mis en cache par clé : rien n'est redessiné si rien n'a changé.
function refreshSceneCrawlers() {
    if (lastExploreSpec) renderVignetteScene({ ...exploreSceneUi, prefix: 'ebd', view: FULL_SCENE_VIEW, overlayIcon: true }, lastExploreSpec);
    if (shopSceneBuilt) renderCrawlerInto(shopSceneUi.crawler);
    if (safehouseSceneBuilt) renderCrawlerInto(safehouseSceneUi.crawler);
}

// Écran d'escalier (#floor-transition-overlay) : même mécanique.
const stairsSceneUi = {
    wrap: document.getElementById('floor-transition-scene'),
    svg: document.getElementById('floor-transition-scene-svg'),
    backdrop: document.getElementById('floor-transition-scene-backdrop'),
    vignette: document.getElementById('floor-transition-scene-vignette'),
    icon: document.getElementById('floor-transition-icon')
};
function renderStairsScene() {
    renderVignetteScene({ ...stairsSceneUi, prefix: 'fbd', view: FULL_SCENE_VIEW }, 'stairs');
}


// --- Écran Game Over : le cadavre du crawler vu de dessus ---------------------------------------------
// Sol du quartier de la mort (même motif que la scène de combat, vu d'en haut), cadavre dans sa mare de
// sang, plots de scène de crime, mouches, indice de la cause (GAME_OVER_CAUSE_PROPS, backdrops.js ;
// cause inconnue -> aucun indice). Pure : ne lit que le catalogue.
function composeGameOverScene(cause, districtKey, prefix) {
    const def = SCENE_BACKDROPS[districtKey] || SCENE_BACKDROPS.default;
    const floorPattern = BACKDROP_FLOOR_PATTERNS[def.floor] || BACKDROP_FLOOR_PATTERNS.flagstones;
    const { w, h } = GAME_OVER_VIEW;
    const b = GAME_OVER_BODY;
    const clue = GAME_OVER_CAUSE_PROPS[cause] || '';
    const flies = [[b.x + 6, b.y - 38, 0], [b.x - 18, b.y - 20, 1.3], [b.x + 22, b.y + 4, 2.1]]
        .map(([x, y, delay]) => `<g transform="translate(${x} ${y})"><g class="go-fly" style="animation-delay:-${delay}s"><circle cx="7" cy="0" r="1.4" fill="#05060c"/><ellipse cx="7" cy="-1.6" rx="1.4" ry="0.8" fill="#d1d5db" opacity="0.6"/></g></g>`)
        .join('');
    return `
        <defs>
            ${floorPattern(`${prefix}-floor`, def.palette)}
            <radialGradient id="${prefix}-spot" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.16"/>
                <stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="${prefix}-vignette" cx="50%" cy="50%" r="72%">
                <stop offset="55%" stop-color="#000" stop-opacity="0"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0.7"/>
            </radialGradient>
        </defs>
        <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${prefix}-floor)"/>
        <rect x="0" y="0" width="${w}" height="${h}" fill="#05060c" opacity="0.35"/>
        <ellipse cx="${b.x}" cy="${b.y}" rx="120" ry="80" fill="url(#${prefix}-spot)"/>
        <g class="go-clue" data-cause="${cause}">${clue}</g>
        <g transform="translate(${b.x} ${b.y}) rotate(${b.angle})">
            <g class="go-blood-spread">${GAME_OVER_BLOOD_POOL}</g>
            ${crawlerCorpseMarkup()}
        </g>
        <g transform="translate(${b.x - 58} ${b.y + 44})">${evidenceMarker(1)}</g>
        <g transform="translate(${b.x + 62} ${b.y - 40})">${evidenceMarker(2)}</g>
        ${flies}
        <rect x="0" y="0" width="${w}" height="${h}" fill="url(#${prefix}-vignette)"/>`;
}

const gameOverSceneUi = {
    svg: document.getElementById('game-over-scene-svg'),
    content: document.getElementById('game-over-scene-content')
};
function renderGameOverScene(opts) {
    if (!gameOverSceneUi.content) return;
    const cause = (opts && opts.cause) || 'combat';
    gameOverSceneUi.content.innerHTML = composeGameOverScene(cause, resolveBackdropKey(gameState.currentDistrict), 'gbd');
}

// --- Écran plein écran de rencontre (chantier 16, lot 1) ------------------------------------------
// Repli quand le mob n'a pas encore d'image WebP (voir encounters.js) : son sprite agrandi sur le décor de
// son quartier, dans un cadre PORTRAIT 360 x 640 (le cadre de l'overlay est recadré en `cover`). Le décor 360 x 150
// est étiré pour que son sol tombe au niveau du sol de la rencontre ; les 22 % du bas restent réservés au bandeau
// de texte. Tout est pur : spécification géométrique (`encounterSceneSpec()`) + chaîne SVG (`composeEncounterScene()`).
const ENCOUNTER_VIEW = { w: 360, h: 640 };
const ENCOUNTER_BACKDROP_H = 568;                 // hauteur du décor étiré (sous : sol uni)
const ENCOUNTER_FACE_GROUND_Y = 470;              // pieds du mob de face (premier plan)
const ENCOUNTER_BACK_GROUND_Y = 372;              // pieds du mob de dos (loin, plus haut)
const ENCOUNTER_MOB_HEIGHT = { face: 400, boss: 450, back: 150 };
const ENCOUNTER_MOB_MAX_HALF_WIDTH = 165;         // le mob reste dans le cadre quelle que soit sa largeur

// Échelle, position et orientation du mob. `sprite` : résultat de resolveMobSprite() (`top` négatif, `bounds` éventuels).
// Renvoie { view, scale, x, y, flip, glow, height } ; `kind` inconnu -> 'spotted'.
function encounterSceneSpec(kind, sprite, isBoss) {
    const def = (typeof ENCOUNTER_KINDS !== 'undefined' && ENCOUNTER_KINDS[kind]) || { view: 'face' };
    const view = def.view === 'back' ? 'back' : 'face';
    const top = Math.abs((sprite && sprite.top) || 86) + (isBoss ? 16 : 0); // la couronne dépasse du sprite
    const bounds = sprite && sprite.bounds;
    const halfWidth = Math.max(MOB_EXTENT, bounds ? Math.max(Math.abs(bounds[0]), Math.abs(bounds[1])) : 0);
    const target = view === 'back' ? ENCOUNTER_MOB_HEIGHT.back : (isBoss ? ENCOUNTER_MOB_HEIGHT.boss : ENCOUNTER_MOB_HEIGHT.face);
    const maxHalf = view === 'back' ? ENCOUNTER_MOB_MAX_HALF_WIDTH / 2 : ENCOUNTER_MOB_MAX_HALF_WIDTH;
    const scale = Math.min(target / top, maxHalf / halfWidth);
    return {
        view, scale,
        x: view === 'back' ? 222 : 180,
        y: view === 'back' ? ENCOUNTER_BACK_GROUND_Y : ENCOUNTER_FACE_GROUND_Y,
        flip: view === 'back',
        glow: view === 'face',
        height: top * scale
    };
}

// Scène de repli en SVG : décor du quartier (préfixe `prefix`), halo d'accent derrière un mob de face, mob (aura et
// couronne comprises), caisse sombre au premier plan pour un mob de dos, voile sombre et vignette.
function composeEncounterScene(kind, enemy, district, prefix) {
    const sprite = resolveMobSprite(enemy, { aura: true });
    const spec = encounterSceneSpec(kind, sprite, !!(enemy && enemy.isBoss));
    const def = SCENE_BACKDROPS[resolveBackdropKey(district)];
    const k = ENCOUNTER_BACKDROP_H / BACKDROP_HEIGHT;
    const bw = BACKDROP_WIDTH * k;
    const accent = ((typeof ENCOUNTER_KINDS !== 'undefined' && ENCOUNTER_KINDS[kind]) || { accent: '#ef4444' }).accent;
    const crown = enemy && enemy.isBoss ? `<g transform="translate(0 ${sprite.top - 2})">${SCENE_BOSS_CROWN_SVG}</g>` : '';
    const sx = spec.flip ? -spec.scale : spec.scale;
    const mob = `<g transform="translate(${spec.x} ${spec.y}) scale(${sx.toFixed(3)} ${spec.scale.toFixed(3)})" style="${tintStyle(sprite.palette)}">${sprite.markup}${crown}</g>`;
    const glow = spec.glow ? `<ellipse class="enc-glow" cx="180" cy="${Math.round(spec.y - spec.height / 2)}" rx="200" ry="${Math.round(spec.height / 2 + 70)}" fill="url(#${prefix}-enc-glow)" opacity="0.5"/>` : '';
    const crate = spec.view === 'back'
        ? `<g transform="translate(70 548) scale(3.4)" opacity="0.92">${BACKDROP_PROPS.crate.markup({ type: 'crate', w: 40, h: 34 }, null)}</g>`
        : '';
    const shade = spec.view === 'back' ? 0.4 : 0.22;
    return `<svg x="${Math.round(-(bw - ENCOUNTER_VIEW.w) / 2)}" y="0" width="${Math.round(bw)}" height="${ENCOUNTER_BACKDROP_H}" viewBox="0 0 ${BACKDROP_WIDTH} ${BACKDROP_HEIGHT}" overflow="hidden">${composeBackdrop(def, prefix)}</svg>`
        + `<rect x="0" y="${ENCOUNTER_BACKDROP_H}" width="${ENCOUNTER_VIEW.w}" height="${ENCOUNTER_VIEW.h - ENCOUNTER_BACKDROP_H}" fill="${def.palette.floor}"/>`
        + `<rect x="0" y="0" width="${ENCOUNTER_VIEW.w}" height="${ENCOUNTER_VIEW.h}" fill="#05060c" opacity="${shade}"/>`
        + glow + mob + crate
        + `<defs><radialGradient id="${prefix}-enc-glow"><stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></radialGradient><radialGradient id="${prefix}-enc-vig" cx="50%" cy="42%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.75"/></radialGradient></defs>`
        + `<rect x="0" y="0" width="${ENCOUNTER_VIEW.w}" height="${ENCOUNTER_VIEW.h}" fill="url(#${prefix}-enc-vig)"/>`;
}

// Cible de l'overlay (#encounter-overlay) : redessinée à chaque ouverture (rare, jamais dans updateUI()).
const encounterSceneUi = {
    svg: document.getElementById('encounter-svg')
};
function renderEncounterScene(opts) {
    const o = opts || {};
    if (!encounterSceneUi.svg || !o.enemy) return;
    encounterSceneUi.svg.setAttribute('viewBox', `0 0 ${ENCOUNTER_VIEW.w} ${ENCOUNTER_VIEW.h}`);
    encounterSceneUi.svg.innerHTML = composeEncounterScene(o.kind, o.enemy, gameState.currentDistrict, 'xbd');
}

// --- Scène haute du combat contre Gorgoth le Concierge (chantier 17, lot 7) ------------------------------
// Gorgoth mesure ~250 unités : il ne tient pas dans la scène de combat (360 x 150, hauteur codée en dur à plusieurs
// endroits). Pendant un combat contre un ennemi `isDemon`, #demon-scene (SVG SÉPARÉ, 360 x 300) remplace donc
// #combat-scene. Voie retenue pour les effets (fx.js) et les chiffres de dégâts : les MÊMES nœuds sont déplacés
// dans la scène haute — groupes #scene-mob/#scene-companion/#scene-crawler/#scene-fx dans #demon-stage (un groupe
// décalé de DEMON_STAGE_DY : à l'intérieur, le repère est exactement celui de la scène de combat, sol en
// SCENE_GROUND_Y), ancres #scene-mob-anchor/#scene-crawler-anchor dans #demon-scene — puis remis à leur place à la
// sortie. Aucun identifiant n'est dupliqué, sceneUi/ui gardent leurs références, fx.js n'a qu'à connaître la
// position de Gorgoth (demonFxGeometry()). Le crawler garde sa place (CRAWLER_X) et sa taille normale.
const DEMON_VIEW = { w: 360, h: 300 };
const DEMON_GROUND_Y = 280;
const DEMON_STAGE_DY = DEMON_GROUND_Y - SCENE_GROUND_Y;
// Gorgoth glisse entre ces deux centres selon l'écart (même rapport que distanceToX()) : au contact, l'avant de son
// corps s'arrête à CONTACT_GAP du crawler ; au plus loin, son aile gauche reste dans le cadre.
const DEMON_X_FAR = SCENE_MARGIN - GORGOTH_GEOMETRY.bounds[0];
function demonSceneX(distance, maxDistance, frontExtent = CRAWLER_FRONT_EXTENT) {
    const max = maxDistance > 0 ? maxDistance : 1;
    const ratio = Math.max(0, Math.min(1, (Number(distance) || 0) / max));
    const contact = CRAWLER_X - frontExtent - CONTACT_GAP - GORGOTH_GEOMETRY.frontExtent;
    return Math.round((contact - ratio * (contact - DEMON_X_FAR)) * 10) / 10;
}

// Décor de l'antre : celui du lot 6 (`DEMON_LAIR_BACKDROP`, fiche 360 x 150 composée par composeBackdrop(def, 'dbd'),
// agrandie et calée sur le sol de la scène haute) devant un ciel de caverne ; sinon un décor de repli dessiné ici
// (obsidienne, veines de lave, stalactites, enseigne « LOGE DU CONCIERGE », paillasson). Pur.
const DEMON_LAIR_SCALE = 1.7;
function composeDemonBackdrop(lairDef, prefix) {
    const p = prefix || 'dmn';
    const W = DEMON_VIEW.w, H = DEMON_VIEW.h, G = DEMON_GROUND_Y;
    const sky = `<defs>
            <linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040208"/><stop offset="0.65" stop-color="#140608"/><stop offset="1" stop-color="#2a0b04"/></linearGradient>
            <radialGradient id="${p}-heat" cx="38%" cy="70%" r="55%"><stop offset="0" stop-color="#ff5a12" stop-opacity="0.38"/><stop offset="1" stop-color="#ff5a12" stop-opacity="0"/></radialGradient>
            <linearGradient id="${p}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040208" stop-opacity="1"/><stop offset="1" stop-color="#040208" stop-opacity="0"/></linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}-sky)"/>`;
    if (lairDef) {
        const k = DEMON_LAIR_SCALE;
        const bw = BACKDROP_WIDTH * k, bh = BACKDROP_HEIGHT * k;
        const y = G - BACKDROP_GROUND_Y * k;
        return `${sky}<svg x="${Math.round(-(bw - W) / 2)}" y="${Math.round(y)}" width="${Math.round(bw)}" height="${Math.round(bh)}" viewBox="0 0 ${BACKDROP_WIDTH} ${BACKDROP_HEIGHT}" overflow="hidden">${composeBackdrop(lairDef, 'dbd')}</svg>`
            + `<rect x="0" y="${Math.round(y)}" width="${W}" height="36" fill="url(#${p}-fade)"/>`
            + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}-heat)"/>`;
    }
    const stalactites = [[18, 34], [52, 22], [86, 40], [128, 18], [170, 30], [214, 16], [252, 36], [296, 20], [334, 32]]
        .map(([x, h]) => `<path d="M${x - 9} 0 L${x} ${h} L${x + 9} 0 Z" fill="#0b0810" stroke="#05060c" stroke-width="1"/>`).join('');
    const rocks = `<path d="M0 150 L22 118 L40 132 L66 96 L92 124 L118 104 L150 126 L176 92 L206 120 L236 100 L262 128 L290 98 L318 122 L340 104 L360 116 L360 ${G} L0 ${G} Z" fill="#0e0a12" stroke="#05060c" stroke-width="1.5"/>`
        + `<path d="M0 200 L30 176 L58 192 L90 170 L130 196 L170 178 L214 198 L250 174 L292 194 L330 172 L360 188 L360 ${G} L0 ${G} Z" fill="#150d12" stroke="#05060c" stroke-width="1.5"/>`;
    const veinPath = 'M66 96 L72 130 L60 160 L70 196 M176 92 L170 128 L184 150 M290 98 L298 140 L286 176 M236 100 L240 120';
    const veins = `<g class="dmn-glow"><path d="${veinPath}" fill="none" stroke="#ff5a12" stroke-width="4" opacity="0.25" stroke-linecap="round"/>`
        + `<path d="${veinPath}" fill="none" stroke="#ff8c1a" stroke-width="1.4" stroke-linecap="round"/></g>`;
    const pillars = `<path d="M330 ${G} L334 70 L352 60 L360 64 L360 ${G} Z" fill="#0a070c" stroke="#05060c" stroke-width="1.5"/><path d="M340 ${G - 10} L342 90" stroke="#ff6a1a" stroke-width="1" opacity="0.5"/>`;
    const sign = `<g transform="translate(300 54)"><path d="M-30 -24 L-26 -40 M30 -24 L26 -40" stroke="#3a3f47" stroke-width="1.6"/>
            <rect x="-40" y="-24" width="80" height="26" rx="3" fill="#1d1410" stroke="#05060c" stroke-width="1.8"/>
            <rect x="-37" y="-21" width="74" height="20" rx="2" fill="none" stroke="#d4a72c" stroke-width="0.9" opacity="0.8"/>
            <text x="0" y="-12" text-anchor="middle" font-size="7.2" font-weight="bold" font-family="sans-serif" fill="#ffb35c" letter-spacing="0.6">LOGE DU CONCIERGE</text>
            <text x="0" y="-4" text-anchor="middle" font-size="5" font-family="sans-serif" fill="#c9b79a">sonnez fort · ne réveillez pas</text></g>`;
    const floor = `<rect x="0" y="${G}" width="${W}" height="${H - G}" fill="#100a0c"/>`
        + `<line x1="0" y1="${G}" x2="${W}" y2="${G}" stroke="#05060c" stroke-width="2"/>`
        + `<g class="dmn-glow"><path d="M8 ${G + 6} L40 ${G + 12} L70 ${G + 8} M110 ${G + 14} L150 ${G + 7} L196 ${G + 15} M230 ${G + 9} L262 ${G + 16}" fill="none" stroke="#ff6a1a" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/></g>`
        + `<g transform="translate(306 ${G + 4})"><rect x="-30" y="-3" width="60" height="9" rx="2" fill="#5a3a22" stroke="#05060c" stroke-width="1.2"/><text x="0" y="3.6" text-anchor="middle" font-size="5" font-weight="bold" font-family="sans-serif" fill="#e8d5a8">ESSUYEZ VOS PIEDS</text></g>`;
    return `${sky}${stalactites}${rocks}${veins}${pillars}${sign}<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}-heat)"/>${floor}`;
}

// Avant-plan : braises qui montent (positions fixes, animations décalées) et vignette sombre.
function composeDemonFront(prefix) {
    const p = prefix || 'dmn';
    const embers = [[24, 270, 0], [70, 252, 1], [118, 276, 2], [164, 262, 0], [204, 274, 1], [244, 258, 2], [280, 272, 0], [340, 262, 1], [96, 230, 2], [186, 238, 0]]
        .map(([x, y, i]) => `<circle class="dmn-ember-rise dmn-ember-${i}" cx="${x}" cy="${y}" r="${1.2 + (i % 2) * 0.6}" fill="${i === 1 ? '#ffd27a' : '#ff7a1a'}"/>`).join('');
    return `<defs><radialGradient id="${p}-vig" cx="50%" cy="55%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient></defs>`
        + `<g pointer-events="none">${embers}<rect x="0" y="0" width="${DEMON_VIEW.w}" height="${DEMON_VIEW.h}" fill="url(#${p}-vig)"/></g>`;
}

// État lu par la scène haute (seule fonction qui lit gameState ; tout le reste est pur). `gameState.demonFight` et
// `gameState.demon` (lot 2) peuvent être absents : valeurs neutres (acte 1, 4 chaînes, aucune cicatrice).
function readDemonSceneState() {
    return {
        enemy: gameState.currentEnemy || null,
        fight: gameState.demonFight || null,
        scars: gameState.demon && gameState.demon.scars ? gameState.demon.scars : null,
        distance: gameState.combatDistance || 0,
        maxDistance: config.rangedCombat.maxDistance,
        frontExtent: crawlerFrontExtent()
    };
}

// Composition PURE de la scène haute. `state` : { enemy, fight, scars, distance, maxDistance, frontExtent, ko } (tout
// facultatif) ; `opts` : { prefix, lairDef (null = décor de repli, absent = DEMON_LAIR_BACKDROP s'il existe),
// crawlerMarkup }. Renvoie la pose et les options du sprite, sa position et ses bornes DANS LA SCÈNE (0..360 x
// 0..300), les couches (décor, Gorgoth, avant-plan) et `svg`, la scène complète autonome.
function composeDemonScene(state, opts) {
    const s = state || {};
    const o = opts || {};
    const enemy = s.enemy || {};
    const fight = s.fight || {};
    const intent = fight.intent || null;
    const ko = !!(s.ko || enemy.knockedOut || fight.knockedOut || (enemy.maxHp > 0 && enemy.hp <= 0));
    const veiled = !ko && !!(intent && intent.hidden && !intent.revealed);
    const sprite = {
        intent: intent && !veiled && GORGOTH_INTENTS.includes(intent.key) ? intent.key : null,
        veiled,
        act: Math.max(1, Math.min(4, Math.floor(Number(fight.act) || 1))),
        final: !!(fight.final || enemy.demonFinal),
        scars: gorgothScarRanks(s.scars),
        chainsLeft: fight.chainsLeft == null ? 4 : Math.max(0, Math.min(4, Math.floor(Number(fight.chainsLeft) || 0))),
        ko
    };
    const poseKey = gorgothPoseKey(sprite);
    const markup = composeGorgothSprite(sprite);
    const x = demonSceneX(s.distance, s.maxDistance, s.frontExtent);
    const top = ko ? GORGOTH_GEOMETRY.koTop : GORGOTH_GEOMETRY.top;
    const bounds = { x1: x + GORGOTH_GEOMETRY.bounds[0], x2: x + GORGOTH_GEOMETRY.bounds[1], y1: DEMON_GROUND_Y + top, y2: DEMON_GROUND_Y };
    const lairDef = o.lairDef !== undefined ? o.lairDef : (typeof DEMON_LAIR_BACKDROP !== 'undefined' ? DEMON_LAIR_BACKDROP : null);
    const prefix = o.prefix || 'dmn';
    const backdrop = composeDemonBackdrop(lairDef, prefix);
    const front = composeDemonFront(prefix);
    const sc = sprite.scars;
    const key = `${poseKey}|${sprite.veiled ? 1 : 0}|${sprite.act}|${sprite.final ? 1 : 0}|${sprite.chainsLeft}|${sc.melee}${sc.ranged}${sc.magic}${sc.unarmed}`;
    const svg = backdrop
        + `<g transform="translate(0 ${DEMON_STAGE_DY})"><g transform="translate(${x} ${SCENE_GROUND_Y})">${markup}</g>`
        + (o.crawlerMarkup ? `<g transform="translate(${CRAWLER_X} ${SCENE_GROUND_Y})">${o.crawlerMarkup}</g>` : '') + `</g>`
        + front;
    return { key, poseKey, sprite, x, groundY: DEMON_GROUND_Y, top, bounds, backdropKey: lairDef ? 'lair' : 'fallback', backdrop, markup, front, svg };
}

const demonSceneUi = {
    wrap: document.getElementById('demon-scene'),
    svg: document.getElementById('demon-scene-svg'),
    backdrop: document.getElementById('demon-scene-backdrop'),
    stage: document.getElementById('demon-stage'),
    front: document.getElementById('demon-scene-front'),
    combatScene: document.getElementById('combat-scene'),
    combatSvg: document.getElementById('combat-scene-svg')
};
let demonSceneActive = false;
let demonSceneCurrentX = null;      // abscisse courante de Gorgoth (repère de #demon-stage), lue par fx.js
let demonSceneTop = GORGOTH_GEOMETRY.top;
let lastDemonSpriteKey = null;
let lastDemonBackdropKey = null;
let lastDemonEnemy = null;

// Déplace un nœud dans `parent` (avant `before` si possible) ; le stub DOM des tests n'a ni insertBefore ni parentNode.
function moveSceneNode(node, parent, before) {
    if (!node || !parent) return;
    if (before && typeof parent.insertBefore === 'function' && before.parentNode === parent) parent.insertBefore(node, before);
    else parent.appendChild(node);
}
function placeDemonAnchor(el, x, y) {
    if (!el) return;
    el.style.left = `${(x / DEMON_VIEW.w) * 100}%`;
    el.style.top = `${(y / DEMON_VIEW.h) * 100}%`;
}

function activateDemonScene() {
    if (demonSceneActive) return;
    // Ordre : Gorgoth derrière (il est immense), puis compagnon, crawler et effets par-dessus.
    [sceneUi.mob, sceneUi.companion, sceneUi.crawler, document.getElementById('scene-fx')].forEach(n => moveSceneNode(n, demonSceneUi.stage));
    moveSceneNode(sceneUi.mobAnchor, demonSceneUi.wrap);
    moveSceneNode(sceneUi.crawlerAnchor, demonSceneUi.wrap);
    demonSceneUi.wrap.classList.remove('hidden');
    if (demonSceneUi.combatScene) demonSceneUi.combatScene.classList.add('hidden');
    placeSceneGroup(sceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
    placeSceneGroup(sceneUi.companion, COMPANION_X, SCENE_GROUND_Y);
    placeDemonAnchor(sceneUi.crawlerAnchor, CRAWLER_X, DEMON_GROUND_Y + CRAWLER_TOP + DAMAGE_ANCHOR_DROP);
    lastDemonSpriteKey = null;
    lastDemonEnemy = null;
    demonSceneActive = true;
}

// Remet chaque nœud dans la scène de combat (avant la progression de repaire, comme dans index.html) et force la
// scène classique à tout replacer au prochain rendu.
function deactivateDemonScene() {
    if (!demonSceneActive) return;
    const before = sceneUi.lairProgress;
    [sceneUi.companion, sceneUi.crawler, sceneUi.mob, document.getElementById('scene-fx')].forEach(n => moveSceneNode(n, demonSceneUi.combatSvg, before));
    moveSceneNode(sceneUi.mobAnchor, demonSceneUi.combatScene);
    moveSceneNode(sceneUi.crawlerAnchor, demonSceneUi.combatScene);
    demonSceneUi.wrap.classList.add('hidden');
    if (demonSceneUi.combatScene) demonSceneUi.combatScene.classList.remove('hidden');
    sceneBuilt = false;
    lastMobSpriteKey = null;
    lastSceneEnemy = null;
    demonSceneCurrentX = null;
    demonSceneActive = false;
}

// renderScene('demon') : affiche la scène haute pendant un combat contre un ennemi `isDemon`, sinon la referme.
// Gorgoth n'est redessiné que si sa pose, son acte, ses chaînes ou ses cicatrices changent ; sa position suit l'écart.
function renderDemonScene() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy || !enemy.isDemon || !demonSceneUi.wrap || !demonSceneUi.stage) {
        deactivateDemonScene();
        return;
    }
    activateDemonScene();
    const scene = composeDemonScene(readDemonSceneState());
    if (lastDemonBackdropKey !== scene.backdropKey) {
        demonSceneUi.backdrop.innerHTML = scene.backdrop;
        if (demonSceneUi.front) demonSceneUi.front.innerHTML = scene.front;
        lastDemonBackdropKey = scene.backdropKey;
    }
    if (lastDemonSpriteKey !== scene.key) {
        sceneUi.mob.innerHTML = wrapSceneBody(scene.markup);
        lastDemonSpriteKey = scene.key;
        if (demonSceneUi.svg) demonSceneUi.svg.setAttribute('aria-label', `Gorgoth le Concierge, colosse de magma, à gauche (${scene.poseKey === 'ko' ? 'assommé' : 'acte ' + scene.sprite.act}) ; vous à droite`);
    }
    const isNew = enemy !== lastDemonEnemy;
    if (isNew) { sceneUi.mob.classList.add('scene-no-transition'); sceneUi.mobAnchor.classList.add('scene-no-transition'); }
    placeSceneGroup(sceneUi.mob, scene.x, SCENE_GROUND_Y);
    placeDemonAnchor(sceneUi.mobAnchor, scene.x + 10, DEMON_GROUND_Y + scene.top * 0.62);
    if (isNew) {
        forceStyleFlush(sceneUi.mob);
        sceneUi.mob.classList.remove('scene-no-transition');
        sceneUi.mobAnchor.classList.remove('scene-no-transition');
        lastDemonEnemy = enemy;
    }
    demonSceneCurrentX = scene.x;
    demonSceneTop = scene.top;
    renderCrawlerInto(sceneUi.crawler);
    renderSceneCompanion();
    renderSceneVitals(enemy);
    renderSceneDistance();
}

// Géométrie de Gorgoth pour fx.js (repère de #demon-stage = repère de la scène de combat) ; null hors scène haute.
function demonFxGeometry() {
    if (!demonSceneActive || demonSceneCurrentX == null) return null;
    return { x: demonSceneCurrentX, top: demonSceneTop, front: [demonSceneCurrentX + 64, SCENE_GROUND_Y + GORGOTH_GEOMETRY.mouthY] };
}

// DEV (console) : pose un combat simulé contre Gorgoth et affiche la scène haute. `partial` : champs de
// gameState.demonFight (act, maxActs, final, intent, chainsLeft...), plus `scars` (gameState.demon.scars), `ko`,
// `distance` et `hp`/`maxHp` ; chaque appel repart d'un combat neuf (acte 1, 4 chaînes), les cicatrices restent. Ne lance
// aucun combat réel : à utiliser pour regarder le dessin.
function devPreviewDemonScene(partial) {
    const p = partial || {};
    const fightKeys = ['act', 'maxActs', 'final', 'emprise', 'countdown', 'chainsLeft', 'possessedThisTurn'];
    const fight = Object.assign({ act: 1, maxActs: 3, final: false, emprise: 0, intent: { key: 'scythe', hidden: false, revealed: false }, countdown: 5, chainsLeft: 4, possessedThisTurn: false, dmgByStyle: { melee: 0, ranged: 0, magic: 0, unarmed: 0 } });
    fightKeys.forEach(k => { if (p[k] !== undefined) fight[k] = p[k]; });
    if (p.intent) fight.intent = Object.assign({ hidden: false, revealed: false }, p.intent);
    gameState.demonFight = fight;
    if (!gameState.demon) gameState.demon = { encounters: 0, knockouts: 0, expulsions: 0, scars: { melee: 0, ranged: 0, magic: 0, unarmed: 0 }, lastFloorFought: 0 };
    if (p.scars) gameState.demon.scars = Object.assign({ melee: 0, ranged: 0, magic: 0, unarmed: 0 }, p.scars);
    const maxHp = p.maxHp || 500;
    const prevEnemy = gameState.currentEnemy && gameState.currentEnemy.isDemon ? gameState.currentEnemy : null;
    const enemy = prevEnemy || { name: GORGOTH_SPRITE_NAME, baseName: GORGOTH_SPRITE_NAME, isDemon: true, isBoss: true, visualArchetype: 'brute', atk: 20, def: 10, status: {} };
    enemy.maxHp = maxHp;
    enemy.hp = p.hp !== undefined ? p.hp : maxHp;
    enemy.demonFinal = !!fight.final;
    enemy.knockedOut = !!p.ko;
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;
    if (p.distance !== undefined) gameState.combatDistance = p.distance;
    const zone = document.getElementById('combat-zone');
    if (zone) zone.classList.remove('hidden');
    renderScene('demon');
    return composeDemonScene(readDemonSceneState()).key;
}

// Point d'entrée unique du rendu des scènes : 'combat' (#combat-zone), 'explore' (scène d'exploration,
// `opts` = nom de vignette ou { key, enemy, ... }), 'merchant' | 'trainer' | 'arcade' (#shop-zone), 'safehouse'
// (#safehouse-choice-zone), 'stairs' (écran d'escalier), 'gameOver' (cadavre vu de dessus, `opts` =
// { cause }), 'crawlers' (remet à jour le crawler des scènes affichées), 'demon' (scène haute du combat contre
// Gorgoth, #demon-scene ; la referme hors d'un tel combat) ; tout mode inconnu ne fait rien.
function renderScene(mode, opts) {
    if (mode === 'combat') renderCombatScene();
    else if (mode === 'explore') renderExploreScene(opts);
    else if (mode === 'merchant' || mode === 'trainer' || mode === 'arcade') renderShopScene(mode);
    else if (mode === 'safehouse') renderSafehouseScene();
    else if (mode === 'stairs') renderStairsScene();
    else if (mode === 'gameOver') renderGameOverScene(opts);
    else if (mode === 'crawlers') refreshSceneCrawlers();
    else if (mode === 'encounter') renderEncounterScene(opts);
    else if (mode === 'demon') renderDemonScene();
}
