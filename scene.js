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
    return [l.posture, l.weapon, l.ranged, l.armor, l.glow, (ench.weapon || []).join(','), (ench.ranged || []).join(','), (ench.armor || []).join(',')].join('|');
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
    const arm = CRAWLER_ARMS[l.posture] || CRAWLER_ARMS.rest;
    const [hx, hy] = arm.hand;
    const holdsWeapon = l.posture === 'weapon';
    const holdsRanged = l.posture === 'ranged' || l.posture === 'rangedLowered';
    const ench = l.ench || {};
    const stowedRanged = l.ranged && !holdsRanged
        ? `<g class="crawler-stowed-ranged" transform="translate(14 -54) rotate(55) scale(0.8)">${itemArt(l.ranged)}</g>` : '';
    const stowedWeapon = l.weapon && !holdsWeapon
        ? `<g class="crawler-stowed-weapon" transform="translate(5 -36) rotate(160) scale(0.7)">${itemArt(l.weapon)}</g>` : '';
    const armorSprite = l.armor && ITEM_SPRITES[l.armor];
    const armorMarkup = l.armor ? `<g class="crawler-armor">${itemArt(l.armor, ench.armor)}</g>` : '';
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
    return `<g class="crawler" data-posture="${l.posture}">${CRAWLER_PARTS.base}${armorBack}${stowedRanged}${stowedWeapon}${CRAWLER_PARTS.torso}${armor}` +
        `${arm.arm}${held}${arm.after || ''}${CRAWLER_PARTS.head}${arm.front ? `<g class="crawler-front">${arm.front}</g>` : ''}</g>`;
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
    const bands = computeRangeBands(config.rangedCombat.maxDistance);
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
    if (!gameState.pendingShopCityId) return;
    const city = typeof urbanCityById === 'function' ? urbanCityById(gameState.pendingShopCityId) : null;
    if (!city) return;
    ensureShopSceneBuilt();
    renderCrawlerInto(shopSceneUi.crawler);
    renderSceneBackdrop(shopSceneUi.backdrop, 'sbd', resolveBackdropKey(gameState.currentDistrict));
    const key = `${mode}:${city.specialty}`;
    if (lastShopSetpieceKey === key) return;
    shopSceneUi.setpiece.innerHTML = composeShopSetpiece(mode, city.specialty, 'sbd');
    shopSceneUi.svg.setAttribute('aria-label', mode === 'merchant'
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
    stairs: () => propAt('stairsDown', 214, 124) + crawlerAt(CRAWLER_X)
};

function composeExploreVignette(key, ctx) {
    const vignette = EXPLORE_VIGNETTES[key];
    return vignette ? vignette(ctx || {}) : '';
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
    const key = [spec.key, enemy ? `${enemy.visualArchetype}:${enemy.effect}:${enemy.isBoss ? 1 : 0}` : '', spec.cityName || '', spec.isExit ? 1 : 0, spec.value ?? '', currentCrawler().key].join('|');
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
            ${SCENE_CORPSE_TOPDOWN_SVG}
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

// Point d'entrée unique du rendu des scènes : 'combat' (#combat-zone), 'explore' (scène d'exploration,
// `opts` = nom de vignette ou { key, enemy, ... }), 'merchant' | 'trainer' (#shop-zone), 'safehouse'
// (#safehouse-choice-zone), 'stairs' (écran d'escalier), 'gameOver' (cadavre vu de dessus, `opts` =
// { cause }), 'crawlers' (remet à jour le crawler des scènes affichées) ; tout mode inconnu ne fait rien.
function renderScene(mode, opts) {
    if (mode === 'combat') renderCombatScene();
    else if (mode === 'explore') renderExploreScene(opts);
    else if (mode === 'merchant' || mode === 'trainer') renderShopScene(mode);
    else if (mode === 'safehouse') renderSafehouseScene();
    else if (mode === 'stairs') renderStairsScene();
    else if (mode === 'gameOver') renderGameOverScene(opts);
    else if (mode === 'crawlers') refreshSceneCrawlers();
}
