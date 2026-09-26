// scene.js - Scène de combat (couloir SVG + sprites + PV) — chantier "refonte graphique",
// branche `graphique`. Pur module de RENDU : ne lit jamais que gameState/config (jamais de
// mutation), au même titre que renderEnemyStatusBadges()/updateTelegraphBanner() dans app.js.
// Chargé juste avant app.js (voir index.html + tests/load_game.js), pour que ses fonctions
// existent déjà au tout premier appel de updateUI() (celui qu'app.js déclenche lui-même à son
// propre chargement). Un seul point d'accroche côté moteur : l'appel à renderScene() en fin
// d'updateUI() (app.js) — tout le reste (DOM, styles, état interne) vit ici.
//
// Étape 1 (couloir SVG) : couloir statique en perspective à un point de fuite, neutre — pas
// encore de variation visuelle par quartier (décision explicite, voir CLAUDE.md/mission "refonte
// graphique"). Les étapes suivantes (sprite joueur/PV/dialogue, sprites mobs, effets) viendront
// compléter ce même fichier sans revenir sur le couloir lui-même.

const sceneUi = {
    view: document.getElementById('scene-view'),
    corridorSvg: document.getElementById('scene-corridor-svg'),
    playerHpBar: document.getElementById('scene-player-hp-bar'),
    playerHpText: document.getElementById('scene-player-hp-text'),
    enemyHpBar: document.getElementById('scene-enemy-hp-bar'),
    enemyHpText: document.getElementById('scene-enemy-hp-text'),
    enemyNameText: document.getElementById('scene-enemy-name-text'),
    playerSprite: document.getElementById('scene-player-sprite'),
    enemyBadgeSlot: document.getElementById('scene-enemy-badge-slot'),
    playerBadgeSlot: document.getElementById('scene-player-badge-slot'),
    mobSprite: document.getElementById('scene-mob-sprite'),
    companionSprite: document.getElementById('scene-companion-sprite'),
    // Panneaux existants (anneau PV + badges de statut + dé + indicateur compagnon), déplacés une
    // seule fois dans les slots ci-dessus — voir relocateLegacyPanels(). Références indépendantes de
    // celles d'app.js (même `document.getElementById`, même nœud DOM), pour ne rien coupler aux
    // détails internes de `ui` côté moteur.
    legacyEnemyPanel: document.getElementById('combat-side-enemy'),
    legacyPlayerPanel: document.getElementById('combat-side-player'),
    cardStackWrapper: document.getElementById('card-stack-wrapper'),
    // Boîte de dialogue (correctif : remplace l'ancienne carte pleine hauteur, jugée trop imposante,
    // par un bandeau en largeur). cardBody est le nœud RÉUTILISÉ (jamais copié) qu'app.js peuple
    // déjà en exploration (logEvent()) et en combat (renderCombatMobPanel()) — voir
    // relocateDialogueBody(). cardBodyHomeParent mémorise son parent d'origine (la carte
    // d'exploration) pour l'y ramener à la sortie de combat.
    dialogueBox: document.getElementById('scene-dialogue-box'),
    cardBody: document.getElementById('card-body'),
    cardBodyHomeParent: document.getElementById('card-body') ? document.getElementById('card-body').parentElement : null,
    fxLayer: document.getElementById('scene-fx-layer')
};

// Dessine le couloir une seule fois (jamais reconstruit à chaque updateUI() : rien n'y change
// pour l'instant). Contours épais sombres + palette désaturée, dans l'esprit de la maquette
// validée (perspective sombre, point de fuite unique, vignettage en surcouche CSS séparée sur
// #scene-vignette) — correctif : un peu plus de couleur (mur gauche plus froid/teal, mur droit
// plus chaud/prune, lueur ambrée au fond, lignes de fuite teintées) sans sortir du thème sombre.
function buildCorridorSvg() {
    const vpX = 200, vpY = 128; // point de fuite
    const stroke = '#05060c';
    return `
        <defs>
            <radialGradient id="scene-archway-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#caa23a" stop-opacity="0.45"/>
                <stop offset="100%" stop-color="#caa23a" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <rect x="0" y="0" width="400" height="300" fill="#12161f"/>
        <polygon points="0,300 400,300 ${vpX + 55},${vpY + 52} ${vpX - 55},${vpY + 52}" fill="#232a42" stroke="${stroke}" stroke-width="3"/>
        <polygon points="0,0 400,0 ${vpX + 50},${vpY - 48} ${vpX - 50},${vpY - 48}" fill="#12101a" stroke="${stroke}" stroke-width="3"/>
        <polygon points="0,0 0,300 ${vpX - 55},${vpY + 52} ${vpX - 50},${vpY - 48}" fill="#152430" stroke="${stroke}" stroke-width="3"/>
        <polygon points="400,0 400,300 ${vpX + 55},${vpY + 52} ${vpX + 50},${vpY - 48}" fill="#2c2438" stroke="${stroke}" stroke-width="3"/>
        <ellipse cx="${vpX}" cy="${vpY}" rx="90" ry="75" fill="url(#scene-archway-glow)"/>
        <rect x="${vpX - 50}" y="${vpY - 48}" width="100" height="100" fill="#05060c" stroke="${stroke}" stroke-width="3"/>
        <line x1="90" y1="300" x2="${vpX - 40}" y2="${vpY + 40}" stroke="#3a8f8f" stroke-width="1.5" opacity="0.4"/>
        <line x1="310" y1="300" x2="${vpX + 40}" y2="${vpY + 40}" stroke="#3a8f8f" stroke-width="1.5" opacity="0.4"/>
    `;
}

// Déplace (une seule fois, pas une copie) les panneaux PV existants dans leurs emplacements de la
// scène. app.js continue de les peupler exactement comme avant (anneau, badges de statut, dé,
// indicateur compagnon) sans jamais savoir qu'ils ont changé de parent — y compris
// showFloatingDamage(), qui cible ces mêmes nœuds par référence directe (`ui.combatSideEnemy`/
// `ui.combatSidePlayer`), continue donc de faire apparaître les chiffres flottants au bon endroit.
function relocateLegacyPanels() {
    if (sceneUi.enemyBadgeSlot && sceneUi.legacyEnemyPanel) {
        sceneUi.enemyBadgeSlot.appendChild(sceneUi.legacyEnemyPanel);
    }
    if (sceneUi.playerBadgeSlot && sceneUi.legacyPlayerPanel) {
        sceneUi.playerBadgeSlot.appendChild(sceneUi.legacyPlayerPanel);
    }
}

let sceneDomReady = false;

// Construction paresseuse (au premier appel réel de renderScene(), pas au chargement du script) :
// évite tout travail DOM tant qu'aucun combat n'a encore eu lieu.
function ensureSceneDom() {
    if (sceneDomReady) return;
    if (sceneUi.corridorSvg) {
        sceneUi.corridorSvg.innerHTML = buildCorridorSvg();
    }
    if (sceneUi.playerSprite) {
        sceneUi.playerSprite.innerHTML = PLAYER_SPRITE_SVG;
    }
    relocateLegacyPanels();
    sceneDomReady = true;
}

// Barres de vie (Étape 2) : lues directement dans gameState, indépendamment des anneaux PV
// existants (relocalisés ci-dessus pour leurs badges de statut/dé/compagnon, pas pour l'anneau
// lui-même). Même formule que le reste de l'UI (ex. ui.timeBar dans updateUI()).
function updateSceneVitals() {
    const enemy = gameState.currentEnemy;
    if (sceneUi.playerHpBar && sceneUi.playerHpText) {
        const pct = gameState.maxHp > 0 ? Math.max(0, Math.min(100, (gameState.hp / gameState.maxHp) * 100)) : 0;
        sceneUi.playerHpBar.style.width = `${pct}%`;
        sceneUi.playerHpText.innerText = `${Math.round(gameState.hp)}/${Math.round(gameState.maxHp)}`;
    }
    if (sceneUi.enemyHpBar && sceneUi.enemyHpText && enemy) {
        const maxHp = enemy.maxHp || enemy.hp;
        const pct = maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / maxHp) * 100)) : 0;
        sceneUi.enemyHpBar.style.width = `${pct}%`;
        sceneUi.enemyHpText.innerText = `${Math.round(Math.max(0, enemy.hp))}/${Math.round(maxHp)}`;
    }
    // Réutilise le libellé déjà calculé par updateUI() (icône boss/élite incluse) plutôt que de
    // redupliquer isEliteMob()/enemy.isBoss ici.
    if (sceneUi.enemyNameText && ui.enemyName) {
        sceneUi.enemyNameText.innerText = ui.enemyName.innerText;
    }
}

// Teintes par effet de mob (chantier "refonte graphique", Étape 3) : varie l'apparence des
// archétypes de sprites.js sans dessiner une silhouette par créature (~52 dans le bestiaire). Un
// SEUL accent rouge, fixe, réservé aux détails de danger (yeux/organes) quel que soit l'effet ; les
// teintes de base/ombre changent, jamais l'accent — voir sprites.js/index.html (classes mob-fill-*).
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

// Mémorise le dernier archétype injecté pour ne pas réécrire innerHTML à chaque updateUI() (le mob
// ne change pas de forme en cours de combat, seuls sa teinte/sa position bougent).
let lastMobSpriteKey = null;
// Centre courant du sprite mob (%), tenu à jour par renderMobSprite() — cible des effets d'attaque
// (voir playAttackAnimation()). Valeur de départ approximative (écart nul) tant qu'aucun combat
// n'a encore calculé de position réelle.
let lastMobCenter = { left: 40, top: 53 };
// Centre approximatif, FIXE, du sprite joueur (%) — voir sa position dans index.html
// (right:2%, bottom:-1%, width:40%). Même approximation volontaire que lastMobCenter.
const PLAYER_CENTER = { left: 78, top: 74 };

// Sprite mob (Étape 3) : silhouette selon l'archétype du mob généré (bestiary.js), teinte selon son
// effet, couronne superposée pour un boss, position le long du couloir selon gameState.combatDistance
// — remplace la barre de distance retirée à l'Étape 1 (0 = proche/grand, maxDistance = loin/petit).
function renderMobSprite() {
    const enemy = gameState.currentEnemy;
    if (!sceneUi.mobSprite || !enemy) return;

    const archetypeKey = enemy.visualArchetype || 'goblinoid';
    const spriteKey = archetypeKey + (enemy.isBoss ? ':boss' : '');
    if (lastMobSpriteKey !== spriteKey) {
        const archetypeSvg = MOB_ARCHETYPES[archetypeKey] || MOB_ARCHETYPES.goblinoid;
        const crownHtml = enemy.isBoss ? `<div class="scene-boss-crown">${BOSS_CROWN_SVG}</div>` : '';
        sceneUi.mobSprite.innerHTML = archetypeSvg + crownHtml;
        lastMobSpriteKey = spriteKey;
    }
    sceneUi.mobSprite.classList.toggle('scene-sprite-boss', !!enemy.isBoss);
    // Télégraphe (Étape 4) : même état que la bannière #telegraph-banner (updateTelegraphBanner(),
    // app.js), lu ici indépendamment pour le halo pulsé du sprite — jamais de nouvel état posé.
    sceneUi.mobSprite.classList.toggle('scene-telegraph', !!(enemy.status && enemy.status.telegraph));

    const tint = MOB_EFFECT_TINTS[enemy.effect] || MOB_DEFAULT_TINT;
    sceneUi.mobSprite.style.setProperty('--mob-base', tint.base);
    sceneUi.mobSprite.style.setProperty('--mob-dark', tint.dark);
    sceneUi.mobSprite.style.setProperty('--mob-accent', MOB_ACCENT_COLOR);

    const maxDist = (config.rangedCombat && config.rangedCombat.maxDistance) || 1;
    const ratio = Math.max(0, Math.min(1, (gameState.combatDistance || 0) / maxDist));
    // Correctif : gabarit toujours strictement inférieur à celui du joueur (30%, fixe), même à
    // l'écart nul (corps à corps) — combiné au z-index (voir index.html), le mob ne peut plus
    // jamais visuellement passer devant le joueur.
    const width = 24 - ratio * 14;
    const top = 42 - ratio * 28;
    const left = 28 - ratio * 18;
    sceneUi.mobSprite.style.width = `${width}%`;
    sceneUi.mobSprite.style.top = `${top}%`;
    sceneUi.mobSprite.style.left = `${left}%`;

    // Centre approximatif du sprite (cible des effets d'attaque, voir playAttackAnimation()) —
    // approximation volontaire (les deux axes ne partagent pas la même échelle en pixels réels,
    // le couloir n'étant pas carré), suffisante pour un effet "simplifié".
    lastMobCenter = { left: left + width / 2, top: top + width / 2 };
}

// Teintes par spécialité de compagnon (Étape 4) : même mécanisme de variables CSS que les mobs
// (mob-fill-*), sur un conteneur DOM différent — aucune collision, chaque élément porte les siennes.
const COMPANION_SPECIALTY_TINTS = {
    strike: { base: '#6b3a30', dark: '#4a2620' },
    guard: { base: '#3a4a6b', dark: '#26304a' },
    medic: { base: '#3a6b4a', dark: '#264a30' },
    scout: { base: '#4a4f5c', dark: '#33363f' }
};

let companionSpriteBuilt = false;

// Sprite compagnon (Étape 4) : visible seulement si gameState.companion est actif (silhouette
// injectée une seule fois, jamais recréée), teinté selon sa spécialité.
function renderCompanionSprite() {
    if (!sceneUi.companionSprite) return;
    const companion = gameState.companion;
    if (!companion) {
        sceneUi.companionSprite.classList.add('hidden');
        return;
    }
    if (!companionSpriteBuilt) {
        sceneUi.companionSprite.innerHTML = COMPANION_SPRITE_SVG;
        companionSpriteBuilt = true;
    }
    sceneUi.companionSprite.classList.remove('hidden');
    const tint = COMPANION_SPECIALTY_TINTS[companion.specialty && companion.specialty.type] || MOB_DEFAULT_TINT;
    sceneUi.companionSprite.style.setProperty('--mob-base', tint.base);
    sceneUi.companionSprite.style.setProperty('--mob-dark', tint.dark);
    sceneUi.companionSprite.style.setProperty('--mob-accent', MOB_ACCENT_COLOR);
}

// Correctif : remplace l'ancien élargissement de la carte (jugée trop imposante en combat, voir
// widenDialogueBox() historique) par un basculement complet — la grande carte d'exploration se
// masque entièrement, remplacée par le bandeau #scene-dialogue-box en largeur sous le couloir.
// #card-body (chips ATQ/DEF/effet + bouton Examiner, gérés par renderCombatMobPanel() dans app.js,
// ou simple narration via logEvent() hors combat) est DÉPLACÉ dedans à l'entrée en combat, puis
// ramené à sa place d'origine à la sortie — jamais copié, app.js continue de le peupler à
// l'identique sans savoir qu'il change ponctuellement de parent.
function toggleDialogueBox(active) {
    if (sceneUi.cardStackWrapper) {
        sceneUi.cardStackWrapper.classList.toggle('hidden', active);
    }
    if (!sceneUi.cardBody) return;
    const target = active ? sceneUi.dialogueBox : sceneUi.cardBodyHomeParent;
    if (target && sceneUi.cardBody.parentElement !== target) {
        target.appendChild(sceneUi.cardBody);
    }
}

// Effets d'attaque (correctif) : un élément DOM éphémère par effet, ajouté à #scene-fx-layer et
// retiré via setTimeout (jamais transitionend/animationend — sous le stub de test, ces événements
// ne sont jamais dispatchés, et un `setTimeout` y résout IMMÉDIATEMENT, voir _helpers.js/
// long_playthrough.js : le nettoyage doit donc pouvoir compter sur lui seul, pas sur un événement CSS).
function spawnFx(el, durationMs) {
    if (!sceneUi.fxLayer) return;
    sceneUi.fxLayer.appendChild(el);
    setTimeout(() => { if (el.parentElement) el.parentElement.removeChild(el); }, durationMs);
}

// Anime un projectile (physique ou magique) du joueur vers le centre courant du mob. Le départ est
// posé immédiatement, puis la cible juste après (un `setTimeout` court, jamais une Promise — voir
// runCombatBeats() dans app.js pour la même contrainte) : la transition CSS (voir index.html)
// anime alors le déplacement toute seule ; sous le stub de test, les deux affectations se
// résolvent l'une après l'autre sans attente, sans erreur.
function spawnProjectile(className, durationMs) {
    if (!sceneUi.fxLayer) return;
    const el = document.createElement('div');
    el.className = className;
    el.style.left = `${PLAYER_CENTER.left}%`;
    el.style.top = `${PLAYER_CENTER.top}%`;
    spawnFx(el, durationMs);
    setTimeout(() => {
        el.style.left = `${lastMobCenter.left}%`;
        el.style.top = `${lastMobCenter.top}%`;
    }, 16);
}

// Point d'accroche (correctif) appelé depuis attackWeapon()/attackRanged()/attackUnarmed()/
// attackMagic() (app.js) juste après une attaque jouée avec succès — jamais sur un flop de sort
// (attackMagic() ne l'appelle que dans la branche `used`). Purement cosmétique : aucune formule de
// dégâts touchée, aucun état de jeu lu au-delà de la position déjà calculée du mob/joueur.
function playAttackAnimation(kind) {
    if (!sceneUi.mobSprite) return;
    if (kind === 'melee') {
        sceneUi.mobSprite.classList.remove('scene-melee-hit');
        void sceneUi.mobSprite.offsetWidth; // force le redémarrage de l'animation CSS si déjà jouée
        sceneUi.mobSprite.classList.add('scene-melee-hit');
        const slash = document.createElement('div');
        slash.className = 'scene-slash';
        slash.style.left = `${lastMobCenter.left}%`;
        slash.style.top = `${lastMobCenter.top}%`;
        spawnFx(slash, 320);
    } else if (kind === 'rangedPhysical') {
        spawnProjectile('scene-projectile-physical', 400);
    } else if (kind === 'magicMelee') {
        const glow = document.createElement('div');
        glow.className = 'scene-magic-glow';
        glow.style.left = `${lastMobCenter.left}%`;
        glow.style.top = `${lastMobCenter.top}%`;
        spawnFx(glow, 480);
    } else if (kind === 'magicRanged') {
        spawnProjectile('scene-projectile-magic', 450);
    }
}

// Point d'accroche unique appelé depuis updateUI() (app.js), à chaque rendu. Bascule la scène
// visible/masquée selon gameState.inCombat — même convention que #combat-side-enemy/-player dans
// app.js (classe `hidden` retirée/ajoutée, `flex`/`flex-col` ajoutés seulement quand visible, pour
// ne jamais laisser les deux classes de display se disputer sur le même élément).
function renderScene() {
    if (!sceneUi.view) return;
    ensureSceneDom();
    const active = !!gameState.inCombat;
    sceneUi.view.classList.toggle('hidden', !active);
    sceneUi.view.classList.toggle('flex', active);
    sceneUi.view.classList.toggle('flex-col', active);
    toggleDialogueBox(active);
    if (!active) return;

    updateSceneVitals();
    renderMobSprite();
    renderCompanionSprite();
    // Dégâts flottants et distance visuelle : déjà couverts (Étapes 2-3, voir relocateLegacyPanels()
    // et renderMobSprite()), aucun code supplémentaire nécessaire ici.
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildCorridorSvg };
}
