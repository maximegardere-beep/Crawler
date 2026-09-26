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
    // Panneaux existants (anneau PV + badges de statut + dé + indicateur compagnon), déplacés une
    // seule fois dans les slots ci-dessus — voir relocateLegacyPanels(). Références indépendantes de
    // celles d'app.js (même `document.getElementById`, même nœud DOM), pour ne rien coupler aux
    // détails internes de `ui` côté moteur.
    legacyEnemyPanel: document.getElementById('combat-side-enemy'),
    legacyPlayerPanel: document.getElementById('combat-side-player'),
    cardStackWrapper: document.getElementById('card-stack-wrapper')
};

// Dessine le couloir une seule fois (jamais reconstruit à chaque updateUI() : rien n'y change
// pour l'instant). Contours épais sombres + palette désaturée bleu-gris, dans l'esprit de la
// maquette validée (perspective sombre, point de fuite unique, vignettage en surcouche CSS
// séparée sur #scene-vignette).
function buildCorridorSvg() {
    const vpX = 200, vpY = 128; // point de fuite
    const stroke = '#05060c';
    return `
        <rect x="0" y="0" width="400" height="300" fill="#12161f"/>
        <polygon points="0,300 400,300 ${vpX + 55},${vpY + 52} ${vpX - 55},${vpY + 52}" fill="#1b2130" stroke="${stroke}" stroke-width="3"/>
        <polygon points="0,0 400,0 ${vpX + 50},${vpY - 48} ${vpX - 50},${vpY - 48}" fill="#0d1019" stroke="${stroke}" stroke-width="3"/>
        <polygon points="0,0 0,300 ${vpX - 55},${vpY + 52} ${vpX - 50},${vpY - 48}" fill="#171c28" stroke="${stroke}" stroke-width="3"/>
        <polygon points="400,0 400,300 ${vpX + 55},${vpY + 52} ${vpX + 50},${vpY - 48}" fill="#232a39" stroke="${stroke}" stroke-width="3"/>
        <rect x="${vpX - 50}" y="${vpY - 48}" width="100" height="100" fill="#05060c" stroke="${stroke}" stroke-width="3"/>
        <line x1="90" y1="300" x2="${vpX - 40}" y2="${vpY + 40}" stroke="${stroke}" stroke-width="1.5" opacity="0.5"/>
        <line x1="310" y1="300" x2="${vpX + 40}" y2="${vpY + 40}" stroke="${stroke}" stroke-width="1.5" opacity="0.5"/>
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

// Élargit la carte (dialogue box) pour la scène : appelé APRÈS qu'app.js a fixé sa propre largeur
// (170px en combat) dans ce même passage d'updateUI() — dernière écriture gagnante, sans avoir à
// toucher la logique d'app.js elle-même.
function widenDialogueBox() {
    if (sceneUi.cardStackWrapper) {
        sceneUi.cardStackWrapper.style.maxWidth = 'none';
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
    if (!active) return;

    widenDialogueBox();
    updateSceneVitals();

    // Étapes suivantes (sprites mobs, effets) : à compléter ici.
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildCorridorSvg };
}
