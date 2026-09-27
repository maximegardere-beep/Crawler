// scene.js - Rendu de la scène de combat en vue 2D latérale (mob à gauche, crawler à droite, sol
// horizontal). Module de RENDU pur : lit gameState/config, ne les modifie jamais. Chargé juste avant
// app.js ; son seul point d'entrée côté moteur est renderCombatScene(), appelée en fin d'updateUI().
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
    mob: document.getElementById('scene-mob'),
    crawler: document.getElementById('scene-crawler'),
    companion: document.getElementById('scene-companion')
};

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

let sceneBuilt = false;
let lastMobSpriteKey = null;
let lastCompanionKey = null;

function ensureSceneBuilt() {
    if (sceneBuilt) return;
    sceneUi.crawler.innerHTML = SCENE_CRAWLER_SVG;
    placeSceneGroup(sceneUi.crawler, CRAWLER_X, SCENE_GROUND_Y);
    placeSceneGroup(sceneUi.companion, COMPANION_X, SCENE_GROUND_Y);
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
        sceneUi.mob.innerHTML = sprite.markup + crown;
        lastMobSpriteKey = spriteKey;
    }
    applySceneTint(sceneUi.mob, MOB_EFFECT_TINTS[enemy.effect] || MOB_DEFAULT_TINT);
    placeSceneGroup(sceneUi.mob, distanceToX(gameState.combatDistance, config.rangedCombat.maxDistance), SCENE_GROUND_Y);
}

function renderSceneCompanion() {
    const companion = gameState.companion;
    sceneUi.companion.classList.toggle('hidden', !companion);
    if (!companion) return;
    const specialty = companion.specialty && companion.specialty.type;
    if (lastCompanionKey !== specialty) {
        sceneUi.companion.innerHTML = SCENE_COMPANION_SVG;
        applySceneTint(sceneUi.companion, COMPANION_SPECIALTY_TINTS[specialty] || MOB_DEFAULT_TINT);
        lastCompanionKey = specialty;
    }
}

// Point d'entrée unique, appelé en fin d'updateUI() (app.js) après chaque action. Ne fait rien hors
// combat : la scène vit dans #combat-zone, que updateUI() masque déjà dans ce cas.
function renderCombatScene() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy) return;
    ensureSceneBuilt();
    renderSceneMob(enemy);
    renderSceneCompanion();
}
