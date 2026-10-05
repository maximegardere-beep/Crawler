// demon-scene.js — tests régression : chantier 17, lot 7 (sprite de Gorgoth le Concierge, sprites/demon.js, et scène haute
// #demon-scene, composeDemonScene()/renderScene('demon') dans scene.js, adaptation de fx.js). Voir CHANTIERS.md (chantier 17).
const fs = require('fs');
const path = require('path');
const { assert, resetTransientState } = require('./_helpers.js');
const { GAME_FILES, REPO_ROOT } = require('../load_game.js');

const forbidden = /undefined|NaN|id=|Gradient|<defs|<image|<filter|Math\.random/;
const intact = m => (m.match(/data-intact="1"/g) || []).length;
const broken = m => (m.match(/data-intact="0"/g) || []).length;

// --- Sprite : chaque intention, chaque acte, chaque cran de cicatrice, chaînes, K.O. ---
{
    assert(GORGOTH_SPRITE_NAME === 'Gorgoth le Concierge', "Sprite : nom exact du contrat");
    assert(GORGOTH_INTENTS.join() === 'scythe,blaze,grip,guard,whip', "Sprite : les 5 intentions du contrat");
    const G = GORGOTH_GEOMETRY;
    assert(G.bounds[0] < 0 && G.bounds[1] > 0 && G.top < -200 && G.koTop > G.top && G.frontExtent > 0, "Gabarit : bornes, hauteur (colosse : plus de 200 unités), K.O. plus bas");

    const bad = [];
    GORGOTH_INTENTS.concat([null]).forEach(intent => {
        [1, 2, 3, 4].forEach(act => {
            const m = composeGorgothSprite({ intent, act, chainsLeft: 4 });
            if (forbidden.test(m)) bad.push(`${intent}/${act}`);
            if (!m.includes(`data-pose="${intent || 'idle'}"`) || !m.includes(`data-act="${act}"`)) bad.push(`pose ${intent}/${act}`);
        });
    });
    assert(bad.length === 0, `Sprite : chaque intention × acte sans undefined/NaN/identifiant/dégradé, pose et acte indiqués (${bad.join(', ')})`);

    const m = k => composeGorgothSprite({ intent: k, act: 1 });
    assert(m('grip').includes(GORGOTH_PALETTE.eyeGrip) && !m('scythe').includes(GORGOTH_PALETTE.eyeGrip), "Emprise : yeux et main violets (seulement elle)");
    assert(m('blaze').includes('dmn-brazier') && !m('whip').includes('dmn-brazier'), "Brasier : brasier dans la gueule");
    assert(m('guard').includes('dmn-shield') && !m('grip').includes('dmn-shield'), "Garde : ailes repliées en bouclier");
    assert(m('whip').split('dmn-whip').length === 2 && (m('whip').match(/scale\(1\.5\)/g) || []).length === 1, "Fouet : une chaîne de clés, la dernière plus grosse");
    assert(new Set(GORGOTH_INTENTS.map(m)).size === 5, "Chaque intention a sa propre posture");
    assert(composeGorgothSprite({ intent: 'inconnue' }).includes('data-pose="idle"'), "Intention inconnue : pose de repos");
    assert(m('scythe') === m('scythe'), "Composition pure : même entrée, même dessin");

    const mane = act => (composeGorgothSprite({ intent: 'scythe', act }).match(/dmn-flame/g) || []).length;
    assert(mane(3) > mane(2) && mane(2) === mane(1), "Acte 3 : des flammes lèchent le sol (en plus de la crinière)");
    assert(composeGorgothSprite({ act: 1 }).includes('data-level="1"') && composeGorgothSprite({ act: 3 }).includes('data-level="3"') && composeGorgothSprite({ act: 3, final: true }).includes('data-level="4"'), "Crinière : un niveau par acte, +1 en forme finale");
    assert(composeGorgothSprite({ act: 4, final: true }).includes('data-final="1"'), "Forme finale signalée");
    assert(composeGorgothSprite({ act: 99 }).includes('data-act="4"') && composeGorgothSprite({ act: -2 }).includes('data-act="1"'), "Acte borné à 1-4");

    const markers = { melee: GORGOTH_PALETTE.scarMelee, ranged: GORGOTH_PALETTE.plateEdge, magic: GORGOTH_PALETTE.scarMagic, unarmed: GORGOTH_PALETTE.bandage };
    GORGOTH_SCAR_STYLES.forEach(style => {
        const lens = [0, 1, 2, 3].map(rank => composeGorgothSprite({ intent: 'whip', scars: { [style]: rank } }));
        assert(!lens[0].includes(markers[style]), `Cicatrices ${style} : rien au cran 0`);
        assert(lens[1].includes(markers[style]) && lens[1].length < lens[2].length && lens[2].length < lens[3].length, `Cicatrices ${style} : visibles dès le cran 1, une couche de plus à chaque cran`);
        assert(lens.every(x => !forbidden.test(x)), `Cicatrices ${style} : aucun élément interdit`);
        assert(composeGorgothSprite({ intent: 'whip', scars: { [style]: 9 } }) === lens[3], `Cicatrices ${style} : cran plafonné à 3`);
    });
    assert(JSON.stringify(gorgothScarRanks(null)) === '{"melee":0,"ranged":0,"magic":0,"unarmed":0}', "Cicatrices absentes : tout à 0");

    [0, 1, 2, 3, 4].forEach(n => {
        const s = composeGorgothSprite({ intent: 'scythe', chainsLeft: n });
        assert(intact(s) === n && broken(s) === 4 - n, `Chaînes : ${n} intacte(s), ${4 - n} brisée(s)`);
    });
    assert(intact(composeGorgothSprite({ chainsLeft: 1 })) === 1 && composeGorgothSprite({ chainsLeft: 1 }).includes('data-slot="nearWrist" data-intact="1"'), "Dernière chaîne : le poignet du trousseau");

    const ko = composeGorgothSprite({ ko: true, intent: 'grip', scars: { melee: 3, ranged: 3, magic: 3, unarmed: 3 }, chainsLeft: 0 });
    assert(ko.includes('data-pose="ko"') && !ko.includes(GORGOTH_PALETTE.eyeGrip) && ko.includes('dmn-ko-stars') && !forbidden.test(ko) && broken(ko) === 4, "K.O. : pose propre (prime sur l'intention), clés qui tournent, chaînes, rien d'interdit");

    const veiled = composeGorgothSprite({ intent: null, veiled: true });
    assert(veiled.includes('dmn-veil') && veiled.includes('???') && veiled.includes('data-pose="idle"'), "Intention masquée : voile de fumée, « ??? », pose de repos");
}

// --- Composition de la scène (pure) : bornes dans 0..360 x 0..300 ---
{
    const max = config.rangedCombat.maxDistance;
    const states = [];
    for (let d = 0; d <= max; d++) {
        GORGOTH_INTENTS.forEach(key => states.push({ fight: { act: 3, intent: { key }, chainsLeft: 2 }, distance: d, maxDistance: max }));
        states.push({ enemy: { hp: 0, maxHp: 100 }, distance: d, maxDistance: max });
    }
    const out = states.filter(s => {
        const sc = composeDemonScene(s, { lairDef: null });
        const b = sc.bounds;
        return b.x1 < 0 || b.x2 > DEMON_VIEW.w || b.y1 < 0 || b.y2 > DEMON_VIEW.h || !isFinite(sc.x) || /undefined|NaN/.test(sc.svg);
    });
    assert(out.length === 0, `Scène : Gorgoth tient dans 0..${DEMON_VIEW.w} x 0..${DEMON_VIEW.h} à tout écart, pose et K.O., sans undefined/NaN (${out.length} hors cadre)`);
    assert(DEMON_VIEW.w === 360 && DEMON_VIEW.h === 300 && DEMON_STAGE_DY === DEMON_GROUND_Y - SCENE_GROUND_Y, "Scène haute 360 x 300, repère de la scène de combat décalé jusqu'au sol");
    const near = composeDemonScene({ distance: 0, maxDistance: max }, { lairDef: null });
    const far = composeDemonScene({ distance: max, maxDistance: max }, { lairDef: null });
    assert(near.x > far.x && near.x + GORGOTH_GEOMETRY.frontExtent + CONTACT_GAP <= CRAWLER_X - CRAWLER_FRONT_EXTENT, "Écart : Gorgoth recule avec la distance ; au contact, l'avant de son corps s'arrête devant le crawler");
    assert(DEMON_GROUND_Y + GORGOTH_GEOMETRY.top <= 40 && -GORGOTH_GEOMETRY.top > 2.5 * -CRAWLER_TOP, "Gorgoth occupe presque toute la hauteur : plus de 2,5 fois la taille du crawler");

    const empty = composeDemonScene(null, { lairDef: null });
    assert(empty.poseKey === 'idle' && empty.sprite.act === 1 && empty.sprite.chainsLeft === 4 && !/undefined|NaN/.test(empty.svg), "État absent : repos, acte 1, 4 chaînes, aucune erreur");
    const hidden = composeDemonScene({ fight: { intent: { key: 'grip', hidden: true, revealed: false } } }, { lairDef: null });
    const revealed = composeDemonScene({ fight: { intent: { key: 'grip', hidden: true, revealed: true } } }, { lairDef: null });
    assert(hidden.poseKey === 'idle' && hidden.sprite.veiled && revealed.poseKey === 'grip' && !revealed.sprite.veiled, "Intention masquée : voilée jusqu'à sa révélation");
    const ko = composeDemonScene({ enemy: { hp: 10, maxHp: 100, knockedOut: true }, fight: { intent: { key: 'whip' } } }, { lairDef: null });
    assert(ko.poseKey === 'ko' && ko.top === GORGOTH_GEOMETRY.koTop, "K.O. : drapeau knockedOut (ou PV à 0)");
    assert(composeDemonScene({ fight: { final: true } }).sprite.final && composeDemonScene({ enemy: { demonFinal: true } }).sprite.final, "Forme finale : par le combat ou par l'ennemi");
    const scarred = composeDemonScene({ scars: { melee: 2 } }, { lairDef: null });
    assert(scarred.key !== empty.key && scarred.sprite.scars.melee === 2, "Clé de redessin : change avec les cicatrices");

    assert(empty.backdropKey === 'fallback' && empty.backdrop.includes('LOGE DU CONCIERGE') && empty.svg.includes('dmn-sky'), "Sans décor du lot 6 : décor de repli (préfixe dmn)");
    const lair = composeDemonScene(null, { lairDef: SCENE_BACKDROPS.default });
    assert(lair.backdropKey === 'lair' && lair.backdrop.includes('dbd-wall') && !/undefined|NaN/.test(lair.backdrop), "Avec une fiche de décor : composeBackdrop(def, 'dbd'), agrandie");
    const withCrawler = composeDemonScene(null, { lairDef: null, crawlerMarkup: '<g class="crawler"></g>' });
    assert(withCrawler.svg.includes(`translate(${CRAWLER_X} ${SCENE_GROUND_Y})`) && withCrawler.svg.includes('class="crawler"'), "Scène autonome : crawler à CRAWLER_X, taille normale");
}

// --- renderScene('demon') : bascule entre les deux scènes, sans erreur quand l'état est absent ---
{
    resetTransientState();
    const had = { demon: Object.prototype.hasOwnProperty.call(gameState, 'demon'), demonFight: Object.prototype.hasOwnProperty.call(gameState, 'demonFight') };
    const prev = { demon: gameState.demon, demonFight: gameState.demonFight };
    const demonScene = document.getElementById('demon-scene');
    const combatScene = document.getElementById('combat-scene');
    let threw = null;
    try { renderScene('demon'); renderScene('demon', {}); } catch (e) { threw = e; }
    assert(!threw && demonFxGeometry() === null, "renderScene('demon') hors combat : aucune erreur, scène haute inactive");

    gameState.inCombat = true;
    gameState.currentEnemy = { name: 'Gorgoth le Concierge', baseName: 'Gorgoth le Concierge', isDemon: true, isBoss: true, hp: 300, maxHp: 400, atk: 10, def: 5, status: {} };
    delete gameState.demonFight;
    try { renderScene('demon'); } catch (e) { threw = e; }
    assert(!threw && !demonScene.classList.contains('hidden') && combatScene.classList.contains('hidden'), "Combat démoniaque (sans demonFight) : #demon-scene remplace #combat-scene");
    const mob = document.getElementById('scene-mob');
    assert(mob.innerHTML.includes('class="gorgoth"') && mob.innerHTML.includes('scene-pose'), "Gorgoth dessiné dans #scene-mob (groupes de pose et de secousse conservés pour fx.js)");
    const stage = document.getElementById('demon-stage');
    assert(stage._children.includes(mob) && stage._children.includes(document.getElementById('scene-crawler')) && stage._children.includes(document.getElementById('scene-fx')), "Combattants et calque d'effets déplacés dans #demon-stage");
    assert(demonScene._children.includes(document.getElementById('scene-mob-anchor')) && demonScene._children.includes(document.getElementById('scene-crawler-anchor')), "Ancres des chiffres de dégâts déplacées dans la scène haute");
    const geo = demonFxGeometry();
    assert(geo && geo.x === demonSceneX(gameState.combatDistance, config.rangedCombat.maxDistance, crawlerFrontExtent()) && fxMobX() === geo.x && fxMobSprite().top === GORGOTH_GEOMETRY.top, "fx.js vise Gorgoth dans la scène haute");

    gameState.demonFight = null;
    try { renderScene('combat'); } catch (e) { threw = e; }
    assert(!threw && !demonScene.classList.contains('hidden'), "renderScene('combat') pendant un combat démoniaque : la scène haute reste affichée");
    gameState.demonFight = { act: 3, intent: { key: 'blaze' }, chainsLeft: 1 };
    renderScene('demon');
    assert(mob.innerHTML.includes('data-pose="blaze"') && mob.innerHTML.includes('data-act="3"'), "Changement d'intention et d'acte : Gorgoth redessiné");
    let fxThrew = null;
    try { playMobAttackFx(gameState.currentEnemy, {}, null); playPlayerAttackFx('weapon', {}, null); showFloatingDamage(ui.sceneMobAnchor, 12, {}); } catch (e) { fxThrew = e; }
    assert(!fxThrew, "Effets d'attaque et chiffres de dégâts pendant un combat démoniaque : aucune erreur");

    gameState.currentEnemy = { name: 'Rat', baseName: 'Rat', visualArchetype: 'rodent', hp: 5, maxHp: 5, atk: 1, def: 1, status: {} };
    renderScene('combat');
    assert(demonScene.classList.contains('hidden') && !combatScene.classList.contains('hidden') && demonFxGeometry() === null, "Combat ordinaire : la scène classique revient");
    assert(!mob.innerHTML.includes('gorgoth') && document.getElementById('combat-scene-svg')._children.includes(mob), "Le mob ordinaire est redessiné dans la scène classique");

    const key = devPreviewDemonScene({ act: 2, intent: { key: 'guard' }, chainsLeft: 3, scars: { magic: 1 } });
    assert(typeof key === 'string' && key.startsWith('guard|') && gameState.demonFight.act === 2 && gameState.demon.scars.magic === 1 && !demonScene.classList.contains('hidden'), "devPreviewDemonScene() : état simulé et scène affichée");
    assert(devPreviewDemonScene({ ko: true }).startsWith('ko|'), "devPreviewDemonScene({ ko }) : pose K.O.");

    gameState.inCombat = false;
    renderScene('demon');
    assert(demonScene.classList.contains('hidden'), "Fin du combat : renderScene('demon') referme la scène haute");
    ['demon', 'demonFight'].forEach(k => { if (had[k]) gameState[k] = prev[k]; else delete gameState[k]; });
    resetTransientState();
}

// --- Câblage : fichier chargé au bon rang, conteneur et animations coupées sous reduced motion ---
{
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const iBoss = html.indexOf('sprites/bosses-b.js'), iDemon = html.indexOf('<script src="sprites/demon.js'), iScene = html.indexOf('<script src="scene.js');
    assert(iBoss > 0 && iDemon > iBoss && iDemon < iScene, "index.html : sprites/demon.js chargé après bosses-b.js, avant scene.js");
    assert(GAME_FILES.indexOf('sprites/demon.js') === GAME_FILES.indexOf('sprites/bosses-b.js') + 1, "load_game.js : même rang que dans index.html");
    assert(/id="demon-scene"[^>]*aspect-ratio: 360 \/ 300/.test(html) && /id="demon-scene-svg" viewBox="0 0 360 300"/.test(html) && html.includes(`id="demon-stage" transform="translate(0 ${DEMON_STAGE_DY})"`), "index.html : #demon-scene 360 x 300, #demon-stage décalé de DEMON_STAGE_DY");
    const rm = html.slice(html.indexOf('.dmn-breathe, .dmn-flame'), html.indexOf('.dmn-breathe, .dmn-flame') + 300);
    assert(['dmn-breathe', 'dmn-flame', 'dmn-glow', 'dmn-wing', 'dmn-ember-rise', 'dmn-ko-stars'].every(c => rm.includes(c)) && rm.includes('animation: none'), "Animations de Gorgoth coupées sous prefers-reduced-motion");
    const src = fs.readFileSync(path.join(REPO_ROOT, 'sprites/demon.js'), 'utf8');
    assert(!/Math\.random|getElementById|gameState/.test(src) && !/balrog/i.test(src.replace(/^\/\/.*$/gm, '')), "sprites/demon.js : catalogue pur, sans hasard ni DOM ni gameState");
}
