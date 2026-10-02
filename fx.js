// fx.js - Effets d'attaque de la scène de combat (chantier « sprites & effets », phase 3).
// Chaque attaque se joue en 3 temps : ANTICIPATION (l'attaquant arme son coup), ACTION (le coup part :
// traînée d'arme, projectile, sort) puis IMPACT (micro-gel de FX_HITSTOP_MS, éclat sur la cible, et le
// rappel `onImpact` d'app.js qui affiche le chiffre de dégâts, la secousse et le flash). Purement visuel :
// app.js a déjà appliqué les dégâts quand l'effet démarre ; seules les barres de vie de la scène
// attendent l'impact (sceneVitalsHold, scene.js). Formes et styles : sprites/fx.js.
//
// Règles : l'impact d'une attaque tombe TOUJOURS avant FX_MAX_IMPACT_MS (< COMBAT_BEAT_MS d'app.js), pour
// que le coup fatal soit vu avant l'écran de victoire / Game Over ; un nouvel effet du même attaquant
// termine le précédent (multi-coups) ; une demande de skip (combatSkipRequested, app.js) termine tout
// effet en cours sur-le-champ. Sous prefers-reduced-motion, rien ne bouge (ni pose, ni projectile) mais la
// traînée / la trajectoire est dessinée d'un coup puis s'estompe. Sans requestAnimationFrame (tests sous
// Node), aucun effet n'est dessiné : `onImpact` est appelé tout de suite. Aucun Math.random() ici (les
// tests reproduisent des séquences aléatoires fixes) : le zigzag des éclairs utilise fxJitter().

const FX_HITSTOP_MS = 40;
const FX_MAX_IMPACT_MS = 260;
const FX_SAFETY_MS = 600; // filet si requestAnimationFrame est suspendu (onglet masqué)
const FX_SVG_NS = 'http://www.w3.org/2000/svg';
const FX_PROJECTILE_SCALE = 1.5; // les projectiles sont dessinés petits : agrandis dans la scène
const activeFx = { crawler: null, mob: null, mini: null }; // mini : issue d'un mini-jeu (chantier 6)

// --- Outils -------------------------------------------------------------------------------------------
const fxClamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const fxLerp = (a, b, p) => a + (b - a) * p;
const fxEaseOut = p => 1 - Math.pow(1 - fxClamp(p), 3);
const fxEaseIn = p => Math.pow(fxClamp(p), 2);
const fxRound = v => Math.round(v * 10) / 10;

let fxJitterSeed = 7;
function fxJitter() {
    fxJitterSeed = (fxJitterSeed * 1103515245 + 12345) & 0x7fffffff;
    return fxJitterSeed / 0x7fffffff - 0.5;
}

// Calque d'effets de la scène affichée : celui du combat, sauf pendant l'issue d'un mini-jeu d'exploration (fxLayerOverride).
let fxLayerOverride = null;
function fxLayer() { return document.getElementById(fxLayerOverride || 'scene-fx'); }
function fxAnimated() {
    return typeof requestAnimationFrame === 'function' && typeof document.createElementNS === 'function' && !!fxLayer();
}
function fxReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function fxSkipRequested() { return typeof combatSkipRequested !== 'undefined' && combatSkipRequested; }

function fxAdd(markup, attrs) {
    const g = document.createElementNS(FX_SVG_NS, 'g');
    Object.keys(attrs || {}).forEach(k => g.setAttribute(k, attrs[k]));
    g.innerHTML = markup || '';
    fxLayer().appendChild(g);
    return g;
}
function fxPath(attrs) {
    const p = document.createElementNS(FX_SVG_NS, 'path');
    Object.keys(attrs).forEach(k => p.setAttribute(k, attrs[k]));
    fxLayer().appendChild(p);
    return p;
}
function fxRemove(...els) { els.forEach(el => { if (el && el.parentNode) el.parentNode.removeChild(el); }); }

// --- Géométrie (pure) -------------------------------------------------------------------------------------
// Traînée en croissant autour de (cx, cy), rayon r : angles en degrés, 0 = vers le haut, sens horaire
// (même convention que rotate() en SVG). Fine à la queue (a0), épaisse à la tête (a1).
function fxCrescentPath(cx, cy, r, a0, a1, width) {
    const n = 12;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const a = (fxLerp(a0, a1, f) * Math.PI) / 180;
        const w = width * Math.pow(f, 0.7);
        const sx = Math.sin(a);
        const sy = -Math.cos(a);
        outer.push(`${fxRound(cx + sx * (r + w * 0.35))} ${fxRound(cy + sy * (r + w * 0.35))}`);
        inner.push(`${fxRound(cx + sx * (r - w * 0.65))} ${fxRound(cy + sy * (r - w * 0.65))}`);
    }
    return `M${outer.join(' L')} L${inner.reverse().join(' L')} Z`;
}

// Traînée droite effilée de (x0, y0) (queue, fine) à (x1, y1) (tête, épaisse `w`).
function fxStreakPath(x0, y0, x1, y1, w) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * (w / 2);
    const ny = ((x1 - x0) / len) * (w / 2);
    return `M${fxRound(x0)} ${fxRound(y0)} L${fxRound(x1 + nx)} ${fxRound(y1 + ny)} L${fxRound(x1 - nx)} ${fxRound(y1 - ny)} Z`;
}

// Éclair en zigzag de A à B (nouveau tracé à chaque appel : il crépite).
function fxZigzagPath(ax, ay, bx, by, amp) {
    const n = 6;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const px = -(by - ay) / len;
    const py = (bx - ax) / len;
    const pts = [`${fxRound(ax)} ${fxRound(ay)}`];
    for (let i = 1; i < n; i++) {
        const f = i / n;
        const o = fxJitter() * 2 * amp;
        pts.push(`${fxRound(fxLerp(ax, bx, f) + px * o)} ${fxRound(fxLerp(ay, by, f) + py * o)}`);
    }
    pts.push(`${fxRound(bx)} ${fxRound(by)}`);
    return `M${pts.join(' L')}`;
}

// Point d'une trajectoire en cloche (arc > 0 : vers le haut) et son angle de vol, en degrés.
function fxArcPoint(from, to, arc, p) {
    const x = fxLerp(from[0], to[0], p);
    const y = fxLerp(from[1], to[1], p) - arc * 4 * p * (1 - p);
    const dx = to[0] - from[0];
    const dy = to[1] - from[1] - arc * 4 * (1 - 2 * p);
    return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// --- Positions dans la scène -----------------------------------------------------------------------------
function fxMobSprite() { return resolveMobSprite(gameState.currentEnemy); }
function fxMobX() { return distanceToX(gameState.combatDistance, config.rangedCombat.maxDistance, crawlerFrontExtent()); }
function fxMobHitPoint() { return [fxMobX() + 6, SCENE_GROUND_Y + fxMobSprite().top * 0.55]; }
function fxMobFront() { return [fxMobX() + 14, SCENE_GROUND_Y + fxMobSprite().top * 0.55]; }
function fxCrawlerHitPoint() { return [CRAWLER_X - 4, SCENE_GROUND_Y - 50]; }
function fxCrawlerHand() {
    const arm = CRAWLER_ARMS[crawlerPosture()] || CRAWLER_ARMS.rest;
    return [CRAWLER_X + arm.hand[0], SCENE_GROUND_Y + arm.hand[1]];
}

// --- Poses (groupes .scene-pose / .crawler-held / .crawler-front / .crawler-spell-glow) ----------------
function fxActorGroup(actor) { return actor === 'crawler' ? sceneUi.crawler : sceneUi.mob; }
function fxQuery(actor, sel) { const g = fxActorGroup(actor); return g ? g.querySelector(sel) : null; }
// Décalage + inclinaison autour des pieds (l'origine du groupe).
function fxSetPose(actor, dx, rot) {
    const el = fxQuery(actor, '.scene-pose');
    if (!el) return;
    if (!dx && !rot) el.removeAttribute('transform');
    else el.setAttribute('transform', `translate(${fxRound(dx)} 0) rotate(${fxRound(rot)})`);
}
// Objet tenu : rotation supplémentaire autour de la main, puis allonge le long de l'objet.
function fxSetHeld(rot, reach) {
    const el = fxQuery('crawler', '.crawler-held');
    if (!el) return;
    el.setAttribute('transform', `${el.getAttribute('data-t') || ''} rotate(${fxRound(rot)}) translate(0 ${fxRound(-(reach || 0))})`);
}
function fxResetHeld() {
    const el = fxQuery('crawler', '.crawler-held');
    if (el && el.getAttribute('data-t')) el.setAttribute('transform', el.getAttribute('data-t'));
}
function fxSetFrontFist(dx, dy) {
    const el = fxQuery('crawler', '.crawler-front');
    if (!el) return;
    if (!dx && !dy) el.removeAttribute('transform');
    else el.setAttribute('transform', `translate(${fxRound(dx)} ${fxRound(dy)})`);
}
function fxSetGlow(scale) {
    const el = fxQuery('crawler', '.crawler-spell-glow');
    if (!el) return;
    const arm = CRAWLER_ARMS.magic;
    const cx = arm.hand[0] - 3;
    const cy = arm.hand[1] - 6;
    if (scale === 1) el.removeAttribute('transform');
    else el.setAttribute('transform', `translate(${cx} ${cy}) scale(${fxRound(scale * 10) / 10}) translate(${-cx} ${-cy})`);
}
function fxResetCrawler() { fxSetPose('crawler', 0, 0); fxResetHeld(); fxSetFrontFist(0, 0); fxSetGlow(1); }

// --- Éclat d'impact ----------------------------------------------------------------------------------------
// Apparaît à l'impact, grossit (sauf reduced motion) puis s'estompe ; `update(ms depuis l'impact)`.
function fxBurst(name, color, x, y, { big = false, reduced = false } = {}) {
    const render = FX_IMPACTS[name] || FX_IMPACTS.hit;
    const g = fxAdd(render(color), { class: 'fx-burst', opacity: '0' });
    const base = big ? 1.65 : 1.25;
    return {
        update(ms) {
            if (ms < 0) return;
            const grow = reduced ? 1 : fxLerp(0.45, 1.15, fxEaseOut(ms / 90));
            g.setAttribute('transform', `translate(${fxRound(x)} ${fxRound(y)}) scale(${fxRound(grow * base * 100) / 100})`);
            g.setAttribute('opacity', fxRound(1 - fxClamp((ms - 90) / 150)));
        },
        el: g
    };
}

// --- Moteur -------------------------------------------------------------------------------------------------
// `fx` : { impactAt, duration, start?(), update(t), impact?(), cleanup() } — t en ms d'effet (gel exclu).
function runFx(actor, fx, onImpact) {
    if (activeFx[actor]) activeFx[actor].finish();
    const run = { impacted: false, done: false };
    activeFx[actor] = run;
    const impact = () => {
        if (run.impacted) return;
        run.impacted = true;
        if (fx.impact) fx.impact();
        if (onImpact) onImpact();
    };
    run.finish = () => {
        if (run.done) return;
        impact();
        run.done = true;
        try { fx.cleanup(); } catch (e) { /* un effet raté ne doit jamais bloquer le combat */ }
        if (activeFx[actor] === run) activeFx[actor] = null;
    };
    if (fx.start) fx.start();
    let start = null;
    let paused = 0;
    let freezeAt = 0;
    const hitstop = typeof fx.hitstopMs === 'number' ? fx.hitstopMs : FX_HITSTOP_MS; // Parfait d'un mini-jeu : gel plus long
    const tick = now => {
        if (run.done) return;
        if (start === null) start = now;
        if (fxSkipRequested()) { run.finish(); return; }
        if (freezeAt) {
            if (now - freezeAt < hitstop) { requestAnimationFrame(tick); return; }
            paused += now - freezeAt;
            freezeAt = 0;
        }
        const t = now - start - paused;
        if (!run.impacted && t >= fx.impactAt) {
            fx.update(fx.impactAt);
            impact();
            freezeAt = now; // micro-gel : tout reste figé sur la pose d'impact
        } else if (t >= fx.duration) {
            run.finish();
            return;
        } else {
            fx.update(t);
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(run.finish, fx.duration + hitstop + FX_SAFETY_MS);
}

// Fin immédiate de tous les effets en cours (skip, fin de combat).
function finishAllFx() {
    Object.keys(activeFx).forEach(actor => { if (activeFx[actor]) activeFx[actor].finish(); });
}

// Barres de vie tenues jusqu'à l'impact (voir renderSceneVitals(), scene.js).
function fxHoldVitals(side, hp) {
    if (side === 'enemy') { sceneVitalsHold.enemy = gameState.currentEnemy; sceneVitalsHold.enemyHp = hp; }
    else { sceneVitalsHold.player = true; sceneVitalsHold.playerHp = hp; }
    renderScene('combat');
}
function fxReleaseVitals(side) {
    if (side === 'enemy') sceneVitalsHold.enemy = null;
    else sceneVitalsHold.player = false;
    renderScene('combat');
}

// --- Spécifications (pures : ne lisent que gameState et les catalogues) ---------------------------------
function fxSpriteReach(key) {
    const sprite = key && ITEM_SPRITES[key];
    const tip = (sprite && sprite.tip) || [0, -30];
    return fxClamp(Math.hypot(tip[0], tip[1]), 18, 40);
}

// Effet d'une attaque du crawler selon son type ('weapon' | 'ranged' | 'magic' | 'unarmed').
function playerAttackFxSpec(kind) {
    const eq = gameState.equipment || {};
    if (kind === 'weapon' && eq.weapon) {
        const key = resolveItemSpriteKey(eq.weapon);
        const style = MELEE_SWING_STYLES[key] || 'smash';
        const ench = enchantColors(eq.weapon);
        const impact = MELEE_IMPACTS[key] || (style === 'thrust' ? 'hit' : style);
        return { type: 'melee', key, style, color: ench[0] || FX_COLORS[style], color2: ench[1] || null, impact, reach: fxSpriteReach(key) };
    }
    if (kind === 'ranged' && eq.ranged) {
        const key = resolveItemSpriteKey(eq.ranged);
        const projectile = RANGED_PROJECTILES[key] || 'stone';
        const ench = enchantColors(eq.ranged);
        const sprite = ITEM_SPRITES[key];
        return { type: 'ranged', key, projectile, color: ench[0] || FX_PROJECTILES[projectile].color, impact: FX_PROJECTILES[projectile].impact, muzzle: (sprite && sprite.tip) || [-10, 0] };
    }
    if (kind === 'magic' && eq.spell) {
        const spell = eq.spell;
        const fx = FX_SPELLS[spell.icon] || { style: spell.spellCategory === 'melee' ? 'cone' : 'bolt', projectile: 'orb', impact: 'hit' };
        const color = fx.color || CRAWLER_SPELL_GLOWS[spell.icon] || CRAWLER_DEFAULT_GLOW;
        return { type: 'magic', style: fx.style, projectile: fx.projectile || null, color, impact: fx.impact };
    }
    return { type: 'unarmed', impact: 'pow' };
}

// Effet d'une attaque de mob : au contact selon son archétype, ou son tir s'il attaque à distance.
function mobAttackFxSpec(enemy, ranged) {
    const arch = enemy && MOB_ATTACK_STYLES[enemy.visualArchetype] ? enemy.visualArchetype : 'goblinoid';
    const effectColor = (enemy && MOB_EFFECT_FX_COLORS[enemy.effect]) || null;
    if (ranged) {
        const projectile = MOB_RANGED_PROJECTILES[arch];
        return { type: 'ranged', projectile, color: effectColor || FX_PROJECTILES[projectile].color, impact: FX_PROJECTILES[projectile].impact };
    }
    const style = MOB_ATTACK_STYLES[arch];
    const color = effectColor || (style === 'claw' || style === 'bite' ? FX_COLORS.claw : FX_COLORS.mob);
    return { type: 'melee', style, color, impact: MOB_STYLE_IMPACTS[style] };
}

// --- Constructeurs d'effets -------------------------------------------------------------------------------
// Pose du crawler (penché en arrière pendant l'anticipation, fendu en avant à l'action) : `lean` de 1
// (armé) à -1 (fendu).
function fxCrawlerLean(lean, depth = 6) {
    fxSetPose('crawler', lean > 0 ? 3 * lean : depth * lean, lean > 0 ? 4 * lean : 5 * lean);
}

// Projectile(s) de `from` à `to` : { update(t), cleanup() } avec t en ms depuis le départ, et `travel`.
function fxProjectileRun(projKey, from, to, { color, flip = false, reduced = false, speed } = {}) {
    const proj = FX_PROJECTILES[projKey] || FX_PROJECTILES.stone;
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const travel = fxClamp(dist / (speed || proj.speed), 70, 170);
    const count = proj.count || 1;
    const arc = proj.arc || 0;
    const trailColor = color || proj.color;
    const els = [];
    let streak = null;
    let beam = null;
    let path = null;
    if (reduced) {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const pt = fxArcPoint(from, to, arc, i / 10); pts.push(`${fxRound(pt.x)} ${fxRound(pt.y)}`); }
        path = fxPath({ d: `M${pts.join(' L')}`, fill: 'none', stroke: trailColor, 'stroke-width': proj.beam || 1.6, 'stroke-dasharray': proj.beam ? '' : '4 3', 'stroke-linecap': 'round', opacity: '0.85', class: 'fx-trail' });
    } else if (proj.beam) {
        beam = fxPath({ d: '', stroke: '#05060c', 'stroke-width': proj.beam + 1.6, 'stroke-linecap': 'round', fill: 'none', class: 'fx-trail' });
        streak = fxPath({ d: '', stroke: trailColor, 'stroke-width': proj.beam, 'stroke-linecap': 'round', fill: 'none', class: 'fx-trail' });
    } else {
        streak = fxPath({ d: '', fill: trailColor, opacity: '0.55', class: 'fx-trail' });
        for (let i = 0; i < count; i++) {
            const art = proj.tints ? proj.art.replace(/fill="#[0-9a-f]{6}"/, `fill="${proj.tints[i % proj.tints.length]}"`) : proj.art;
            els.push(fxAdd(art, { class: 'fx-projectile', style: `color:${trailColor}`, opacity: '0' }));
        }
    }
    const flash = proj.flash && !reduced ? fxAdd(FX_IMPACTS.hit(proj.flash), { opacity: '0' }) : null;
    const offset = (i, p) => (i - (count - 1) / 2) * (proj.spread || 0) * p;
    return {
        travel,
        update(t) {
            const p = fxClamp(t / travel);
            if (flash) {
                flash.setAttribute('transform', `translate(${fxRound(from[0])} ${fxRound(from[1])}) scale(0.7)`);
                flash.setAttribute('opacity', fxRound(1 - fxClamp(t / 90)));
            }
            if (path) { path.setAttribute('opacity', fxRound(0.85 * (1 - fxClamp((t - travel) / 220)))); return; }
            if (beam) {
                const tail = fxArcPoint(from, to, 0, fxClamp((t - travel) / 110));
                const head = fxArcPoint(from, to, 0, p);
                const d = `M${fxRound(tail.x)} ${fxRound(tail.y)} L${fxRound(head.x)} ${fxRound(head.y)}`;
                beam.setAttribute('d', d);
                streak.setAttribute('d', d);
                if (t > travel + 110) { beam.setAttribute('opacity', '0'); streak.setAttribute('opacity', '0'); }
                return;
            }
            const head = fxArcPoint(from, to, arc, p);
            const tail = fxArcPoint(from, to, arc, Math.max(0, p - 0.35));
            streak.setAttribute('d', t <= travel ? fxStreakPath(tail.x, tail.y, head.x, head.y, 3.2) : '');
            els.forEach((el, i) => {
                if (t > travel) { el.setAttribute('opacity', '0'); return; }
                const pt = fxArcPoint(from, to, arc, p);
                let rot = proj.orient ? pt.angle - 180 : 0;
                if (proj.spin) rot += t * 0.9 + i * 50;
                const mirror = flip && !proj.orient ? ' scale(-1 1)' : '';
                el.setAttribute('transform', `translate(${fxRound(pt.x)} ${fxRound(pt.y + offset(i, p))}) rotate(${fxRound(rot)}) scale(${FX_PROJECTILE_SCALE})${mirror}`);
                el.setAttribute('opacity', '1');
            });
        },
        cleanup() { fxRemove(streak, beam, path, flash, ...els); }
    };
}

// Arme de mêlée du crawler : arc (slash/smash) ou estoc (thrust), traînée à la couleur de l'enchantement.
// Angles relatifs à la pose de repos (rotate(-12)) : l'arme s'arme en arrière jusqu'à `back`, balaie
// jusqu'à `a1`, et la traînée ne couvre que la partie du balayage DEVANT le crawler (à partir de `a0`),
// jamais au-dessus de sa tête.
const FX_SWING_ANGLES = {
    smash: { back: 75, a0: 20, a1: -112, width: 10 },
    slash: { back: 55, a0: 8, a1: -135, width: 7 },
    thrust: { back: 20, a0: 0, a1: -78, width: 6 }
};
function fxPlayerMelee(spec, opts, reduced) {
    const [hx, hy] = fxCrawlerHand();
    const target = fxMobHitPoint();
    const windup = opts.charge ? 150 : opts.heavy ? 130 : 100;
    const action = spec.style === 'thrust' ? 70 : 90;
    const impactAt = windup + action;
    const recover = 230;
    const baseRot = -12;
    const ang = FX_SWING_ANGLES[spec.style] || FX_SWING_ANGLES.smash;
    const R = spec.reach;
    const trail = fxPath({ d: '', fill: spec.color, opacity: '0.85', class: 'fx-trail' });
    const trail2 = spec.color2 ? fxPath({ d: '', fill: spec.color2, opacity: '0.7', class: 'fx-trail' }) : null;
    const burst = fxBurst(spec.impact, spec.color === FX_COLORS[spec.style] ? null : spec.color, target[0], target[1], { big: opts.heavy, reduced });
    // Traînée entre deux angles relatifs (from > to : le balayage va vers l'avant) ; estoc : traînée droite.
    const drawTrail = (from, to, alpha) => {
        let d = '';
        let d2 = '';
        if (spec.style === 'thrust') {
            const f = fxClamp((ang.a0 - from) / (ang.a0 - ang.a1));
            const g = fxClamp((ang.a0 - to) / (ang.a0 - ang.a1));
            const a = ((baseRot + ang.a1) * Math.PI) / 180;
            const tip = [hx + Math.sin(a) * (R + 8), hy - Math.cos(a) * (R + 8)];
            if (g > f) d = fxStreakPath(tip[0] + 26 * (1 - f), tip[1], tip[0] - 4 * g, tip[1], ang.width);
        } else if (from > to) {
            d = fxCrescentPath(hx, hy, R, baseRot + from, baseRot + to, ang.width);
            if (trail2) d2 = fxCrescentPath(hx, hy, R - 5, baseRot + from, baseRot + to, ang.width * 0.45);
        }
        trail.setAttribute('d', d);
        trail.setAttribute('opacity', fxRound(0.85 * alpha));
        if (trail2) { trail2.setAttribute('d', d2); trail2.setAttribute('opacity', fxRound(0.7 * alpha)); }
    };
    return {
        impactAt: reduced ? 120 : impactAt,
        duration: (reduced ? 120 : impactAt) + recover,
        update(t) {
            if (reduced) {
                drawTrail(ang.a0, ang.a1, t < 120 ? 1 : 1 - fxClamp((t - 120) / recover));
                burst.update(t - 120);
                return;
            }
            let rot;
            let reach = 0;
            if (t < windup) {
                const p = fxEaseOut(t / windup);
                rot = fxLerp(0, ang.back, p);
                fxCrawlerLean(p);
                drawTrail(0, 0, 1);
            } else if (t < impactAt) {
                const p = fxEaseIn((t - windup) / action);
                rot = fxLerp(ang.back, ang.a1, p);
                reach = spec.style === 'thrust' ? 10 * p : 0;
                fxCrawlerLean(1 - 2 * p, opts.charge ? 12 : 6);
                drawTrail(ang.a0, Math.min(ang.a0, rot), 1);
            } else {
                const p = fxEaseOut((t - impactAt) / recover);
                rot = fxLerp(ang.a1, 0, p);
                reach = spec.style === 'thrust' ? 10 * (1 - p) : 0;
                fxCrawlerLean(-(1 - p), opts.charge ? 12 : 6);
                drawTrail(fxLerp(ang.a0, ang.a1, fxClamp(p * 1.6)), ang.a1, 1 - p);
                burst.update(t - impactAt);
            }
            fxSetHeld(rot, reach);
        },
        cleanup() { fxRemove(trail, trail2, burst.el); fxResetCrawler(); }
    };
}

// Arme à distance du crawler : recul, éclair de bouche, projectile(s) avec traînée, éclat à l'arrivée.
function fxPlayerRanged(spec, opts, reduced) {
    const [hx, hy] = fxCrawlerHand();
    const from = [hx + spec.muzzle[0], hy + spec.muzzle[1]];
    const target = fxMobHitPoint();
    const windup = reduced ? 0 : 70;
    const shot = fxProjectileRun(spec.projectile, from, target, { color: spec.color, reduced });
    const impactAt = reduced ? 120 : windup + shot.travel;
    const recover = 240;
    const burst = fxBurst(spec.impact, spec.color, target[0], target[1], { big: opts.heavy, reduced });
    return {
        impactAt,
        duration: impactAt + recover,
        update(t) {
            if (!reduced) {
                if (t < windup) fxSetPose('crawler', 2 * fxEaseOut(t / windup), 0);
                else {
                    const k = 1 - fxEaseOut((t - windup) / 160); // recul au départ du coup
                    fxSetPose('crawler', 3 * k, 2 * k);
                    fxSetHeld(-8 * k, 0);
                }
            }
            shot.update(reduced ? (t < 120 ? 0 : t) : t - windup);
            if (t >= impactAt) burst.update(t - impactAt);
        },
        cleanup() { shot.cleanup(); fxRemove(burst.el); fxResetCrawler(); }
    };
}

// Poings du crawler : garde qui recule, direct du poing avant, « PAF » à l'impact.
function fxPlayerUnarmed(spec, opts, reduced, glowColor) {
    const target = fxMobHitPoint();
    const windup = opts.charge ? 150 : 90;
    const action = 60;
    const impactAt = reduced ? 120 : windup + action;
    const recover = 220;
    const burst = fxBurst(spec.impact, glowColor || null, target[0], target[1], { big: opts.heavy, reduced });
    const orb = glowColor && !reduced ? fxAdd(`<circle r="7" fill="${glowColor}" opacity="0.35"/><circle r="3.5" fill="${glowColor}"/>`, { opacity: '0' }) : null;
    const fist = glowColor ? [CRAWLER_ARMS.magic.hand[0] - 3, CRAWLER_ARMS.magic.hand[1] - 6] : [-11, -71];
    const [fx0, fy0] = [CRAWLER_X + fist[0] + 7, SCENE_GROUND_Y + fist[1]];
    return {
        impactAt,
        duration: impactAt + recover,
        update(t) {
            if (!reduced) {
                let jab;
                if (t < windup) { const p = fxEaseOut(t / windup); fxCrawlerLean(p); jab = -2 * p; }
                else if (t < impactAt) { const p = fxEaseIn((t - windup) / action); fxCrawlerLean(1 - 2 * p, opts.charge ? 12 : 7); jab = fxLerp(-2, 14, p); }
                else { const p = fxEaseOut((t - impactAt) / recover); fxCrawlerLean(-(1 - p), opts.charge ? 12 : 7); jab = 14 * (1 - p); }
                fxSetFrontFist(-jab, jab * 0.3);
                if (orb) {
                    orb.setAttribute('transform', `translate(${fxRound(fx0 - jab - 7)} ${fxRound(fy0 + jab * 0.3)})`);
                    orb.setAttribute('opacity', t < impactAt + 60 ? '1' : '0');
                }
            }
            if (t >= impactAt) burst.update(t - impactAt);
        },
        cleanup() { fxRemove(burst.el, orb); fxResetCrawler(); }
    };
}

// Sort utilitaire (chantier 11, style 'self') : la lueur se charge, puis l'éclat se joue sur le crawler
// lui-même (soin, bouclier, recul) — aucune cible.
function fxPlayerSelfSpell(spec, reduced) {
    const at = [CRAWLER_X - 4, SCENE_GROUND_Y - 40];
    const burst = fxBurst(spec.impact, spec.color, at[0], at[1], { big: true, reduced });
    const windup = reduced ? 0 : 120;
    const impactAt = reduced ? 60 : windup;
    return {
        impactAt,
        duration: impactAt + 320,
        update(t) {
            if (!reduced && t < windup) fxSetGlow(fxLerp(1, 2.2, fxEaseOut(t / windup)));
            else if (!reduced) fxSetGlow(fxLerp(2.2, 1, fxClamp((t - windup) / 200)));
            if (t >= impactAt) burst.update(t - impactAt);
        },
        cleanup() { fxRemove(burst.el); fxResetCrawler(); }
    };
}

// Sort du crawler : la lueur de la main se charge, puis l'effet du sort part (FX_SPELLS).
function fxPlayerSpell(spec, opts, reduced) {
    if (spec.style === 'punch') return fxPlayerUnarmed({ impact: spec.impact }, opts, reduced, spec.color);
    if (spec.style === 'self' || opts.self) return fxPlayerSelfSpell(spec, reduced);
    const arm = CRAWLER_ARMS.magic;
    const from = [CRAWLER_X + arm.hand[0] - 3, SCENE_GROUND_Y + arm.hand[1] - 6];
    const target = fxMobHitPoint();
    let windup = reduced ? 0 : 110;
    const recover = 240;
    const burst = fxBurst(spec.impact, spec.color, target[0], target[1], { big: opts.heavy || spec.style === 'meteor', reduced });
    let shot = null;
    let bolt = null;
    let boltCore = null;
    let trail = null;
    let travel = 110;
    if (spec.style === 'bolt' || spec.style === 'meteor') {
        const start = spec.style === 'meteor' ? [target[0] - 60, -12] : from;
        shot = fxProjectileRun(spec.projectile, start, target, { color: spec.color, reduced, speed: spec.style === 'meteor' ? 1.1 : undefined });
        travel = shot.travel;
    } else if (spec.style === 'zap' || spec.style === 'sky') {
        bolt = fxPath({ d: '', fill: 'none', stroke: '#05060c', 'stroke-width': '4', 'stroke-linejoin': 'round', class: 'fx-trail' });
        boltCore = fxPath({ d: '', fill: 'none', stroke: spec.color, 'stroke-width': '2', 'stroke-linejoin': 'round', class: 'fx-trail' });
        travel = 70;
    } else {
        trail = fxPath({ d: '', fill: spec.color, opacity: '0.8', class: 'fx-trail' });
        travel = 90;
    }
    const impactAt = reduced ? 120 : Math.min(windup + travel, FX_MAX_IMPACT_MS);
    if (!reduced) windup = impactAt - travel;
    const drawBolt = () => {
        const a = spec.style === 'sky' ? [target[0] + 8, 0] : from;
        const d = fxZigzagPath(a[0], a[1], target[0], target[1], spec.style === 'sky' ? 7 : 5);
        bolt.setAttribute('d', d);
        boltCore.setAttribute('d', d);
    };
    return {
        impactAt,
        duration: impactAt + recover,
        update(t) {
            if (!reduced) {
                if (t < windup) fxSetGlow(fxLerp(1, 1.9, fxEaseOut(t / windup)));
                else fxSetGlow(fxLerp(1.9, 1, fxEaseOut((t - windup) / 120)));
            }
            const s = reduced ? (t < 120 ? 1 : 1 + (t - 120) / travel) : fxClamp((t - windup) / travel, 0, 3);
            if (shot) shot.update(reduced ? (t < 120 ? 0 : t) : t - windup);
            if (bolt) {
                const visible = reduced ? t < 120 + recover * 0.6 : t >= windup && t < impactAt + 120;
                if (visible && (reduced ? !bolt.getAttribute('d') : true)) drawBolt();
                const alpha = reduced ? 1 - fxClamp((t - 120) / (recover * 0.6)) : (visible ? 1 : 0);
                bolt.setAttribute('opacity', fxRound(alpha));
                boltCore.setAttribute('opacity', fxRound(alpha));
            }
            if (trail) {
                const alpha = s <= 1 ? 1 : 1 - fxClamp((s - 1) * (travel / recover));
                if (spec.style === 'arc') {
                    trail.setAttribute('d', s > 0 ? fxCrescentPath(CRAWLER_X - 15, SCENE_GROUND_Y - 46, 32, -4, fxLerp(-4, -150, fxClamp(s)), 9) : '');
                } else {
                    const len = fxLerp(0, 1, fxClamp(s));
                    const tip = [fxLerp(from[0], target[0], len), fxLerp(from[1], target[1], len)];
                    trail.setAttribute('d', `M${fxRound(from[0])} ${fxRound(from[1] - 2)} L${fxRound(tip[0])} ${fxRound(tip[1] - 13 * len)} Q${fxRound(tip[0] - 9)} ${fxRound(tip[1])} ${fxRound(tip[0])} ${fxRound(tip[1] + 13 * len)} L${fxRound(from[0])} ${fxRound(from[1] + 2)} Z`);
                }
                trail.setAttribute('opacity', fxRound(0.8 * alpha));
            }
            if (t >= impactAt) burst.update(t - impactAt);
        },
        cleanup() { if (shot) shot.cleanup(); fxRemove(bolt, boltCore, trail, burst.el); fxResetCrawler(); }
    };
}

// Sort raté (backfire) : la lueur enfle, crachote et s'éteint dans un petit nuage de fumée.
function fxPlayerBackfire(reduced) {
    const arm = CRAWLER_ARMS.magic;
    const [x, y] = [CRAWLER_X + arm.hand[0] - 3, SCENE_GROUND_Y + arm.hand[1] - 6];
    const puff = fxAdd('<circle cx="-4" cy="0" r="4" fill="#6b7280"/><circle cx="3" cy="-3" r="5" fill="#4b5563"/><circle cx="1" cy="4" r="3.4" fill="#9ca3af"/>', { opacity: '0' });
    return {
        impactAt: reduced ? 60 : 140,
        duration: reduced ? 400 : 480,
        update(t) {
            if (!reduced) fxSetGlow(t < 140 ? fxLerp(1, 2.1, fxEaseOut(t / 140)) * (1 + 0.15 * Math.sin(t / 12)) : fxLerp(0.4, 1, fxClamp((t - 140) / 300)));
            const p = fxClamp((t - (reduced ? 60 : 140)) / 340);
            if (t >= (reduced ? 60 : 140)) {
                puff.setAttribute('transform', `translate(${x} ${fxRound(y - (reduced ? 0 : 10 * p))}) scale(${reduced ? 1 : fxRound(0.6 + p)})`);
                puff.setAttribute('opacity', fxRound(0.9 * (1 - p)));
            }
        },
        cleanup() { fxRemove(puff); fxResetCrawler(); }
    };
}

// Attaque d'un mob : il s'arme en reculant puis se fend vers le crawler (traînée, fouet, nuée), ou tire.
function fxMobAttack(spec, opts, reduced) {
    const target = fxCrawlerHitPoint();
    const sprite = fxMobSprite();
    const mobX = fxMobX();
    let windup = reduced ? 0 : opts.fast ? 0 : opts.heavy ? 180 : 100;
    const recover = opts.fast ? 90 : 200;
    const burst = fxBurst(spec.impact, spec.color, target[0], target[1], { big: opts.heavy, reduced });
    const glint = opts.heavy && !reduced ? fxAdd(FX_IMPACTS.hit('#ef4444'), { opacity: '0' }) : null;
    let shot = null;
    let trail = null;
    let action = opts.fast ? 50 : 70;
    if (spec.type === 'ranged' || spec.style === 'swarm') {
        const from = spec.type === 'ranged' ? fxMobFront() : [mobX + 10, SCENE_GROUND_Y + sprite.top * 0.5];
        shot = fxProjectileRun(spec.projectile || 'swarm', from, target, { color: spec.color, flip: true, reduced });
        action = shot.travel;
    } else if (spec.style === 'smash' || spec.style === 'slash' || spec.style === 'lash') {
        trail = fxPath({ d: '', fill: spec.style === 'lash' ? 'none' : spec.color, stroke: spec.style === 'lash' ? spec.color : 'none', 'stroke-width': '2.6', 'stroke-linecap': 'round', opacity: '0.8', class: 'fx-trail' });
    }
    const impactAt = reduced ? 120 : Math.min(windup + action, FX_MAX_IMPACT_MS);
    if (!reduced) windup = Math.max(0, impactAt - action);
    const lunge = spec.style === 'ram' ? 18 : spec.style === 'slam' ? 14 : 9;
    const pivot = [mobX + 8, SCENE_GROUND_Y + sprite.top * 0.55];
    const drawTrail = (from, to, alpha) => {
        if (!trail) return;
        if (spec.style === 'lash') {
            const a = [mobX + 12, SCENE_GROUND_Y + sprite.top * 0.6];
            const pts = [];
            for (let i = 0; i <= 10; i++) {
                const f = fxLerp(from, to, i / 10);
                pts.push(`${fxRound(fxLerp(a[0], target[0], f))} ${fxRound(fxLerp(a[1], target[1], f) - 22 * 4 * f * (1 - f))}`);
            }
            trail.setAttribute('d', to > from ? `M${pts.join(' L')}` : '');
        } else {
            trail.setAttribute('d', to > from ? fxCrescentPath(pivot[0], pivot[1], 21, fxLerp(-60, 115, from), fxLerp(-60, 115, to), spec.style === 'smash' ? 9 : 6) : '');
        }
        trail.setAttribute('opacity', fxRound(0.8 * alpha));
    };
    return {
        impactAt,
        duration: impactAt + recover,
        update(t) {
            if (reduced) {
                drawTrail(0, 1, t < 120 ? 1 : 1 - fxClamp((t - 120) / recover));
                if (shot) shot.update(t < 120 ? 0 : t);
            } else {
                const melee = spec.type !== 'ranged';
                if (t < windup) {
                    const p = fxEaseOut(t / windup);
                    fxSetPose('mob', -4 * p, -6 * p);
                    if (glint) {
                        glint.setAttribute('transform', `translate(${fxRound(mobX + 6)} ${fxRound(SCENE_GROUND_Y + sprite.top + 4)}) scale(${fxRound(0.3 + 0.5 * p)})`);
                        glint.setAttribute('opacity', '1');
                    }
                } else if (t < impactAt) {
                    const p = fxEaseIn((t - windup) / action);
                    if (melee) fxSetPose('mob', fxLerp(-4, lunge, p), fxLerp(-6, 7, p));
                    else fxSetPose('mob', -3 * (1 - p), 0);
                    drawTrail(0, p, 1);
                    if (glint) glint.setAttribute('opacity', '0');
                } else {
                    const p = fxEaseOut((t - impactAt) / recover);
                    if (melee) fxSetPose('mob', lunge * (1 - p), 7 * (1 - p));
                    drawTrail(fxClamp(p * 1.6), 1, 1 - p);
                }
                if (shot) shot.update(t - windup);
            }
            if (t >= impactAt) burst.update(t - impactAt);
        },
        cleanup() { if (shot) shot.cleanup(); fxRemove(trail, glint, burst.el); fxSetPose('mob', 0, 0); }
    };
}

// --- Points d'entrée (app.js) -----------------------------------------------------------------------------
// Attaque du crawler : `kind` = gameState.lastAttackKind ; opts.heavy (attaque furtive, charge) grossit
// l'éclat, opts.charge allonge l'élan ; opts.heldEnemyHp = PV du mob AVANT le coup (barre tenue).
function playPlayerAttackFx(kind, opts, onImpact) {
    opts = opts || {};
    if (!fxAnimated()) { if (onImpact) onImpact(); return; }
    const reduced = fxReducedMotion();
    const spec = playerAttackFxSpec(kind);
    renderScene('combat'); // posture à jour avant d'animer l'objet tenu
    let fx;
    if (spec.type === 'melee') fx = fxPlayerMelee(spec, opts, reduced);
    else if (spec.type === 'ranged') fx = fxPlayerRanged(spec, opts, reduced);
    else if (spec.type === 'magic') fx = fxPlayerSpell(spec, opts, reduced);
    else fx = fxPlayerUnarmed(spec, opts, reduced);
    const hold = typeof opts.heldEnemyHp === 'number';
    fx.start = () => { if (hold) fxHoldVitals('enemy', opts.heldEnemyHp); };
    fx.impact = () => { if (hold) fxReleaseVitals('enemy'); };
    runFx('crawler', fx, onImpact);
}

// Spécification PURE de l'effet d'une capacité de classe SANS coup porté (chantier 13) : éclat sur le crawler lui-même, réutilisant le style
// « self » des sorts utilitaires. Les capacités qui frappent (Uppercut, Fendre, Tir de barrage) jouent l'effet de leur attaque.
const CLASS_ABILITY_FX = {
    occultist: { style: 'self', color: '#c084fc', impact: 'shock' },
    trickster: { style: 'self', color: '#a78bfa', impact: 'splash' },
    punchingBag: { style: 'self', color: '#60a5fa', impact: 'smash' }
};
function classAbilityFxSpec(key) {
    return CLASS_ABILITY_FX[key] || null;
}
function playClassAbilityFx(key) {
    const spec = classAbilityFxSpec(key);
    if (!spec || !fxAnimated()) return;
    renderScene('combat');
    runFx('crawler', fxPlayerSelfSpell(spec, fxReducedMotion()), null);
}

function playSpellBackfireFx() {
    if (!fxAnimated()) return;
    renderScene('combat');
    runFx('crawler', fxPlayerBackfire(fxReducedMotion()), null);
}

// Attaque d'un mob : au contact, ou tir s'il y a de l'écart ; opts.heavy (télégraphe exécuté, ruée
// d'enrage, phase 3) : élan plus long avec un éclat rouge d'avertissement ; opts.fast (multi-coups) :
// sans élan ; opts.heldPlayerHp = PV du crawler AVANT le coup.
function playMobAttackFx(enemy, opts, onImpact) {
    opts = opts || {};
    if (!fxAnimated() || !enemy) { if (onImpact) onImpact(); return; }
    const spec = mobAttackFxSpec(enemy, (gameState.combatDistance || 0) > 0);
    const fx = fxMobAttack(spec, opts, fxReducedMotion());
    const hold = typeof opts.heldPlayerHp === 'number';
    fx.start = () => { if (hold) fxHoldVitals('player', opts.heldPlayerHp); };
    fx.impact = () => { if (hold) fxReleaseVitals('player'); };
    runFx('mob', fx, onImpact);
}

// Issue d'un mini-jeu (chantier 6) : éclat sur la cible (minigameOutcomeFxSpec(), minigames.js), gel d'impact
// propre à l'issue et, pour un Parfait, secousse d'écran. `onDone` est appelé UNE fois à la fin de l'effet (filet
// de sécurité de runFx compris) — ou tout de suite hors combat / sans animation (tests Node) : le jeu n'attend
// jamais une animation qui n'existe pas.
function playMinigameOutcomeFx(spec, onDone) {
    let called = false;
    const done = () => { if (called) return; called = true; if (onDone) onDone(); };
    // Hors combat, seule une épreuve d'exploration (cible « prop » : coffre, piège) joue un effet, sur le calque de la
    // scène d'exploration ; un effet générique sans cible d'exploration n'a rien à montrer.
    const exploring = !gameState.inCombat;
    if (!spec || (exploring && spec.target !== 'prop') || !fxAnimated()) { done(); return; }
    const reduced = fxReducedMotion();
    let x, y;
    if (exploring && spec.at) [x, y] = spec.at;
    else [x, y] = (spec.target === 'crawler' || spec.target === 'prop' || !gameState.currentEnemy) ? fxCrawlerHitPoint() : fxMobHitPoint();
    let burst = null;
    runFx('mini', {
        impactAt: 0,
        duration: spec.durationMs || 340,
        hitstopMs: spec.hitstopMs,
        start() { if (exploring) fxLayerOverride = 'explore-fx'; burst = fxBurst(spec.burst, spec.color, x, y, { big: !!spec.heavy, reduced }); },
        update(t) { if (burst) burst.update(t); },
        impact() { if (spec.heavy && typeof triggerHeavyImpact === 'function') triggerHeavyImpact(); },
        cleanup() { if (burst) fxRemove(burst.el); fxLayerOverride = null; done(); }
    }, null);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        playMinigameOutcomeFx, fxCrescentPath, fxStreakPath, fxZigzagPath, fxArcPoint, playerAttackFxSpec, mobAttackFxSpec,
        playPlayerAttackFx, playMobAttackFx, playSpellBackfireFx, finishAllFx, FX_HITSTOP_MS, FX_MAX_IMPACT_MS
    };
}
