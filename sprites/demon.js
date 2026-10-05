// sprites/demon.js - Gorgoth le Concierge (chantier 17, lot 7) : le Boss de Niveau, colosse d'ombre et de magma
// détourné en concierge infernal — cornes recourbées, ailes de fumée, crinière de feu, bleu de travail en lambeaux,
// casquette de concierge calcinée, trousseau de clés en fusion qui lui sert de fouet, lame de feu.
// Registre À PART de SCENE_BOSS_SPRITES (dont les tests bornent les sprites à ±24 de large) : Gorgoth est dessiné
// pour la scène haute (#demon-scene, 360 x 300, voir composeDemonScene() dans scene.js) et mesure ~250 unités.
// Repère : celui de sprites/*.js — x = 0 au centre, y = 0 au sol (les pieds), y négatif vers le haut, tourné vers
// la DROITE (vers le crawler). Contours sombres #05060c. Aucun identifiant, aucun dégradé, aucun hasard :
// composeGorgothSprite() est PURE (même entrée -> même chaîne). Les classes CSS `dmn-*` (index.html) animent
// respiration, flammes, braises et fumée ; elles sont coupées sous `prefers-reduced-motion`.

const GORGOTH_SPRITE_NAME = 'Gorgoth le Concierge';

// Gabarit déclaré (testé) : `bounds` = [gauche, droite] en x, `top` = point le plus haut (crinière de l'acte 4
// comprise), `frontExtent` = avant du corps au repos (position au contact, voir demonSceneX()), `chestY`/`mouthY` :
// points visés/de départ des effets d'attaque (fx.js). La pose K.O. (assis) est plus basse (`koTop`). Bornes mesurées par
// getBBox() dans un navigateur sur toutes les poses (brasier et main tendue débordent vers le crawler : c'est voulu).
const GORGOTH_GEOMETRY = { top: -268, koTop: -240, bounds: [-135, 145], frontExtent: 76, chestY: -130, mouthY: -170 };

const GORGOTH_PALETTE = {
    outline: '#05060c',
    skin: '#2a1611', skinDark: '#170b08', skinHi: '#4a2418',
    crack: '#ff6a1a', crackHot: '#ffd27a',
    overalls: '#2f4f86', overallsDark: '#1d335e', overallsHi: '#5f86c4', stitch: '#9fbcea',
    brass: '#d4a72c', brassDark: '#7a5a12',
    cap: '#22375f', capDark: '#121c33', visor: '#0b1120',
    horn: '#4a3a30', hornDark: '#2a1f19', hornTip: '#cbbb9c',
    smoke: '#1b1621', smokeHi: '#3a3044', smokeEdge: '#ff6a1a',
    fireOuter: '#e3340b', fireMid: '#ff8c1a', fireCore: '#ffe08a',
    eye: '#ffe600', eyeGrip: '#b66cff',
    iron: '#3a3f47', ironHi: '#9aa1ab',
    blade: '#ff5a12', bladeCore: '#fff1b8',
    scarMelee: '#ffe1a0', scarMagic: '#67e8f9', plate: '#0d0b14', plateEdge: '#7c66b8', bandage: '#d9cfb6', stud: '#8d939d'
};

const GORGOTH_INTENTS = ['scythe', 'blaze', 'grip', 'guard', 'whip'];
const GORGOTH_SCAR_STYLES = ['melee', 'ranged', 'magic', 'unarmed'];

// --- Petites aides géométriques (pures) ------------------------------------------------------------------
const gorgothR = v => Math.round(v * 10) / 10;
function gorgothRot(p, deg, origin) {
    const o = origin || [0, 0];
    const a = (deg * Math.PI) / 180;
    const x = p[0], y = p[1];
    return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
}
function gorgothPt(p) { return `${gorgothR(p[0])} ${gorgothR(p[1])}`; }
function gorgothAngle(a, b) { return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI; }
function gorgothLerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
// Point et tangente (degrés) d'une courbe de Bézier cubique.
function gorgothBezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    return { p: [x, y], angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}
// Repère d'un segment de membre : origine au point `t` du segment a -> b, axe x le long du segment.
function gorgothFrame(a, b, t) {
    const p = gorgothLerp(a, b, t);
    return `translate(${gorgothPt(p)}) rotate(${gorgothR(gorgothAngle(a, b))})`;
}

// Membre épais (tracé arrondi) : contour sombre, chair, puis une veine de magma au centre.
function gorgothLimb(points, width, fill, crack) {
    const d = `M${points.map(gorgothPt).join(' L')}`;
    const P = GORGOTH_PALETTE;
    return `<path d="${d}" fill="none" stroke="${P.outline}" stroke-width="${width + 5}" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
        + (crack ? `<path d="${d}" fill="none" stroke="${P.crack}" stroke-width="1.4" stroke-dasharray="7 5 3 6" stroke-linecap="round" opacity="0.75"/>` : '');
}

// Langue de feu en goutte (pointe vers le haut, `lean` la couche vers l'arrière), en 3 couleurs empilées.
function gorgothFlame(x, y, w, h, lean, cls) {
    const P = GORGOTH_PALETTE;
    const one = (s, color) => {
        const ww = w * s, hh = h * s;
        return `<path d="M${gorgothR(x - ww / 2)} ${gorgothR(y)} Q${gorgothR(x - ww / 2)} ${gorgothR(y - hh * 0.55)} ${gorgothR(x + lean * s)} ${gorgothR(y - hh)} Q${gorgothR(x + ww / 2)} ${gorgothR(y - hh * 0.55)} ${gorgothR(x + ww / 2)} ${gorgothR(y)} Q${gorgothR(x)} ${gorgothR(y + ww * 0.35)} ${gorgothR(x - ww / 2)} ${gorgothR(y)} Z" fill="${color}"/>`;
    };
    return `<g class="${cls || 'dmn-flame'}">${one(1, P.fireOuter)}${one(0.68, P.fireMid)}${one(0.36, P.fireCore)}</g>`;
}

// Clé en fusion (anneau + tige + dents), orientée selon `angle`.
function gorgothKey(p, angle, s) {
    const P = GORGOTH_PALETTE;
    const k = s || 1;
    return `<g transform="translate(${gorgothPt(p)}) rotate(${gorgothR(angle + 90)}) scale(${k})">`
        + `<circle cx="0" cy="-4" r="3.6" fill="${P.fireMid}" stroke="#5a1a00" stroke-width="1.2"/>`
        + `<circle cx="0" cy="-4" r="1.3" fill="${P.skinDark}"/>`
        + `<path d="M-1.2 -0.6 L1.2 -0.6 L1.2 8 L3.6 8 L3.6 10 L1.2 10 L1.2 11.6 L-1.2 11.6 Z" fill="${P.fireCore}" stroke="#5a1a00" stroke-width="0.9" stroke-linejoin="round"/>`
        + `</g>`;
}

// --- Poses ---------------------------------------------------------------------------------------------------
// Une pose = squelette en coordonnées du sprite : inclinaison du torse autour des hanches (`lean`, degrés,
// positif = penché vers le crawler), tête (`head` : décalage depuis le cou, rotation), bras AVANT (le trousseau,
// dessiné devant le torse) et bras ARRIÈRE (la lame de feu, derrière), trajet du fouet (Bézier depuis la main),
// ailes (`spread` déployées, `shield` repliées devant lui), gueule ouverte, yeux. `idle` = aucune intention lisible.
const GORGOTH_HIP = [-4, -86];
// Tête volontairement grosse (lisible à petite taille), et échelle globale du dessin (repère de conception -> scène).
const GORGOTH_HEAD_SCALE = 1.35;
const GORGOTH_SCALE = 0.88;
const GORGOTH_POSES = {
    idle: {
        lean: 7, head: { dx: 6, dy: -4, rot: 4 }, wings: 'spread', eyes: 'fire',
        near: { elbow: [58, -128], hand: [64, -96], hand_kind: 'fist' },
        far: { elbow: [-58, -132], hand: [-64, -102], blade: 70, bladeLen: 84 },
        whip: [[80, -60], [62, -2], [26, -6]]
    },
    // Fauche : le trousseau armé loin en arrière au-dessus de la tête, la lame basse prête à balayer.
    scythe: {
        lean: -6, head: { dx: 6, dy: -2, rot: -4 }, wings: 'raised', eyes: 'fire',
        near: { elbow: [6, -150], hand: [-30, -170], hand_kind: 'fist' },
        far: { elbow: [-60, -132], hand: [-72, -104], blade: 172, bladeLen: 50 },
        whip: [[-70, -250], [-124, -246], [-132, -176]]
    },
    // Brasier : penché en avant, gueule grande ouverte sur un brasier qui gonfle, fissures chauffées à blanc.
    blaze: {
        lean: 15, head: { dx: 10, dy: 2, rot: 14 }, wings: 'spread', eyes: 'fire', jawOpen: true, hot: true,
        near: { elbow: [62, -118], hand: [54, -84], hand_kind: 'claw' },
        far: { elbow: [-56, -156], hand: [-72, -136], blade: -112, bladeLen: 70 },
        whip: [[70, -50], [56, -4], [24, -8]]
    },
    // Emprise : la main tendue vers le crawler, griffes ouvertes, yeux violets.
    grip: {
        lean: 11, head: { dx: 8, dy: -2, rot: 6 }, wings: 'spread', eyes: 'grip',
        near: { elbow: [64, -162], hand: [94, -158], hand_kind: 'palm' },
        far: { elbow: [-58, -132], hand: [-64, -102], blade: 70, bladeLen: 84 },
        whip: [[96, -120], [74, -40], [60, -4]]
    },
    // Garde : bras croisés, ailes repliées devant lui en bouclier ; seuls les yeux et les cornes dépassent.
    guard: {
        lean: -2, head: { dx: 2, dy: -2, rot: -4 }, wings: 'shield', eyes: 'fire',
        near: { elbow: [52, -130], hand: [22, -150], hand_kind: 'fist' },
        far: { elbow: [40, -138], hand: [30, -160], blade: -78, bladeLen: 74 },
        whip: [[10, -120], [30, -40], [8, -4]]
    },
    // Fouet : le trousseau lancé vers le crawler, la chaîne de clés claque devant lui.
    whip: {
        lean: 13, head: { dx: 8, dy: -2, rot: 8 }, wings: 'spread', eyes: 'fire',
        near: { elbow: [60, -150], hand: [84, -136], hand_kind: 'fist' },
        far: { elbow: [-58, -150], hand: [-70, -128], blade: -120, bladeLen: 70 },
        whip: [[118, -210], [146, -150], [124, -118]]
    }
};
// Jambes debout (mêmes pour toutes les poses debout) : hanche, genou, cheville, orteils.
const GORGOTH_LEGS = {
    far: [[-18, -86], [-32, -48], [-38, -14], [-18, -2]],
    near: [[8, -86], [24, -48], [18, -14], [40, -2]]
};

// --- Couches de Cicatrices (une par style, cumulatives par cran 1 à 3) -------------------------------------
// Chaque élément est placé dans le repère d'une partie : `torso` (hanches en 0,0, haut vers -y), `head` (cou en
// 0,0, tourné vers +x), ou le long d'un segment de membre (`nearUpper`, `nearFore`, `nearThigh` : x le long du
// segment depuis son point `t`, y en travers).
const GORGOTH_SCAR_LAYERS = {
    // Mêlée : entailles lumineuses, des fissures chauffées à blanc.
    melee: [
        { torso: [[6, -74, 26, -56], [14, -78, 32, -62]] },
        { torso: [[-34, -40, -18, -22]], nearUpper: [{ t: 0.5, d: [-8, -6, 8, 6] }], nearThigh: [{ t: 0.5, d: [-7, 8, 7, -8] }] },
        { torso: [[-6, -92, 34, -30], [30, -92, -4, -36]], head: [[14, -32, 30, -8]] }
    ],
    // Distance : plaques de carapace d'obsidienne qui ont poussé où les projectiles frappaient.
    ranged: [
        { torso: [[[16, -104], [40, -96], [46, -80], [24, -82]]] },
        { torso: [[[0, -60], [34, -66], [32, -40], [6, -34]]], nearFore: [{ t: 0.5, w: 22, h: 14 }] },
        { torso: [[[-40, -64], [-26, -80], [-18, -50], [-36, -40]]], head: [[[2, -30], [30, -36], [36, -26], [8, -22]]], nearThigh: [{ t: 0.45, w: 26, h: 18 }] }
    ],
    // Magie : runes de sceau gravées dans le magma.
    magic: [
        { nearFore: [{ t: 0.45 }] },
        { torso: [[12, -50], [26, -30], [-24, -60]] },
        { seal: [16, -66], head: [[20, -28]] }
    ],
    // Mains nues : bandages et bosses de fer, comme un vieux boxeur.
    unarmed: [
        { nearFore: [{ t: 0.55, bands: 3 }] },
        { studs: true, torso: [[-30, -86, -12, -98]] },
        { jaw: true, headBand: true, nearUpper: [{ t: 0.5, bands: 2 }] }
    ]
};

function gorgothScarRanks(scars) {
    const s = scars || {};
    const out = {};
    GORGOTH_SCAR_STYLES.forEach(k => { out[k] = Math.max(0, Math.min(3, Math.floor(Number(s[k]) || 0))); });
    return out;
}
// Éléments cumulés d'un style jusqu'à son cran : [{ torso: [...], ... }, ...] aplati par partie.
function gorgothScarItems(style, rank) {
    const items = {};
    (GORGOTH_SCAR_LAYERS[style] || []).slice(0, rank).forEach(layer => {
        Object.keys(layer).forEach(part => {
            const v = layer[part];
            if (Array.isArray(v) && typeof v[0] !== 'number') items[part] = (items[part] || []).concat(v);
            else items[part] = v;
        });
    });
    return items;
}

const gorgothGlowLine = (x1, y1, x2, y2, color) =>
    `<path d="M${gorgothR(x1)} ${gorgothR(y1)} L${gorgothR(x2)} ${gorgothR(y2)}" stroke="${GORGOTH_PALETTE.crack}" stroke-width="5" stroke-linecap="round" opacity="0.35"/>`
    + `<path d="M${gorgothR(x1)} ${gorgothR(y1)} L${gorgothR(x2)} ${gorgothR(y2)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
const gorgothPlate = pts => `<path d="M${pts.map(gorgothPt).join(' L')} Z" fill="${GORGOTH_PALETTE.plate}" stroke="${GORGOTH_PALETTE.plateEdge}" stroke-width="1.4" stroke-linejoin="round"/>`
    + `<path d="M${gorgothPt(gorgothLerp(pts[0], pts[1], 0.2))} L${gorgothPt(gorgothLerp(pts[0], pts[1], 0.8))}" stroke="#c4b5fd" stroke-width="0.9" opacity="0.7"/>`;
// Rune : un glyphe anguleux (choisi par sa position, sans hasard) et son halo.
const GORGOTH_RUNE_GLYPHS = ['M-3 4 L-3 -4 L3 -1 L-3 1 M0 1 L3 4', 'M-3 -4 L3 4 M3 -4 L-3 4 M0 -4 L0 4', 'M-3 4 L0 -4 L3 4 M-2 1 L2 1', 'M-3 -3 L3 -3 L-3 3 L3 3'];
function gorgothRune(x, y, i, s) {
    const k = s || 1;
    const glyph = GORGOTH_RUNE_GLYPHS[Math.abs(Math.round(i)) % GORGOTH_RUNE_GLYPHS.length];
    return `<g class="dmn-rune" transform="translate(${gorgothR(x)} ${gorgothR(y)}) scale(${k})"><circle r="6" fill="${GORGOTH_PALETTE.scarMagic}" opacity="0.18"/>`
        + `<path d="${glyph}" fill="none" stroke="${GORGOTH_PALETTE.scarMagic}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

// Cicatrices posées dans le repère d'une partie (`part` = 'torso' | 'head').
function gorgothPartScars(part, ranks) {
    const P = GORGOTH_PALETTE;
    let out = '';
    const melee = gorgothScarItems('melee', ranks.melee)[part] || [];
    melee.forEach(([a, b, c, d]) => { out += gorgothGlowLine(a, b, c, d, P.scarMelee); });
    const ranged = gorgothScarItems('ranged', ranks.ranged)[part] || [];
    ranged.forEach(pts => { out += gorgothPlate(pts); });
    const magicItems = gorgothScarItems('magic', ranks.magic);
    (magicItems[part] || []).forEach(([x, y], i) => { out += gorgothRune(x, y, x + y + i, part === 'head' ? 0.8 : 1); });
    if (part === 'torso' && magicItems.seal) {
        const [sx, sy] = magicItems.seal;
        out += `<g class="dmn-rune"><circle cx="${sx}" cy="${sy}" r="15" fill="none" stroke="${P.scarMagic}" stroke-width="1.6"/>`
            + `<circle cx="${sx}" cy="${sy}" r="10" fill="none" stroke="${P.scarMagic}" stroke-width="0.9" stroke-dasharray="2 2"/>`
            + `<path d="M${sx} ${sy - 7} L${sx + 6} ${sy + 4} L${sx - 6} ${sy + 4} Z" fill="none" stroke="${P.scarMagic}" stroke-width="1.2"/></g>`;
    }
    const unarmed = gorgothScarItems('unarmed', ranks.unarmed);
    (unarmed[part] || []).forEach(([a, b, c, d]) => {
        out += `<path d="M${a} ${b} L${c} ${d}" stroke="${P.outline}" stroke-width="8" stroke-linecap="round"/><path d="M${a} ${b} L${c} ${d}" stroke="${P.bandage}" stroke-width="5.5" stroke-linecap="round"/>`
            + `<path d="M${gorgothR((a + c) / 2 - 2)} ${gorgothR((b + d) / 2 - 3)} l3 5" stroke="#a89f86" stroke-width="1"/>`;
    });
    if (part === 'head' && unarmed.headBand) {
        out += `<path d="M-6 -30 Q14 -40 34 -30" fill="none" stroke="${P.outline}" stroke-width="7.5" stroke-linecap="round"/><path d="M-6 -30 Q14 -40 34 -30" fill="none" stroke="${P.bandage}" stroke-width="5" stroke-linecap="round"/>`
            + `<path d="M-6 -30 l-8 6 M-6 -30 l-9 1" stroke="${P.bandage}" stroke-width="3" stroke-linecap="round"/>`;
    }
    if (part === 'head' && unarmed.jaw) {
        out += `<path d="M16 2 L38 -4 L42 4 L22 10 Z" fill="${P.stud}" stroke="${P.outline}" stroke-width="1.6" stroke-linejoin="round"/>`
            + `<circle cx="24" cy="5" r="1.4" fill="#d1d5db"/><circle cx="34" cy="2" r="1.4" fill="#d1d5db"/>`;
    }
    return out;
}

// Cicatrices le long d'un segment de membre (`seg` = 'nearUpper' | 'nearFore' | 'nearThigh').
function gorgothLimbScars(seg, a, b, ranks) {
    const P = GORGOTH_PALETTE;
    let out = '';
    (gorgothScarItems('melee', ranks.melee)[seg] || []).forEach(it => {
        out += `<g transform="${gorgothFrame(a, b, it.t)}">${gorgothGlowLine(it.d[0], it.d[1], it.d[2], it.d[3], P.scarMelee)}</g>`;
    });
    (gorgothScarItems('ranged', ranks.ranged)[seg] || []).forEach(it => {
        const w = it.w / 2, h = it.h / 2;
        out += `<g transform="${gorgothFrame(a, b, it.t)}">${gorgothPlate([[-w, -h], [w, -h + 2], [w - 2, h], [-w + 3, h - 1]])}</g>`;
    });
    (gorgothScarItems('magic', ranks.magic)[seg] || []).forEach(it => {
        out += `<g transform="${gorgothFrame(a, b, it.t)}">${gorgothRune(-7, 0, 0, 0.75)}${gorgothRune(3, 0, 1, 0.75)}${gorgothRune(13, 0, 2, 0.75)}</g>`;
    });
    (gorgothScarItems('unarmed', ranks.unarmed)[seg] || []).forEach(it => {
        let bands = '';
        for (let i = 0; i < it.bands; i++) {
            const x = (i - (it.bands - 1) / 2) * 6;
            bands += `<rect x="${x - 2.4}" y="-13" width="4.8" height="26" rx="2" fill="${P.bandage}" stroke="${P.outline}" stroke-width="1.2" transform="rotate(12 ${x} 0)"/>`;
        }
        out += `<g transform="${gorgothFrame(a, b, it.t)}">${bands}</g>`;
    });
    return out;
}

// --- Parties du corps --------------------------------------------------------------------------------------
// Torse (repère : hanches en 0,0) : dos voûté de magma, salopette (bavette, bretelles, poche, badge « GORGOTH »),
// trous de brûlure, fissures de magma, cicatrices du torse.
function gorgothTorso(ranks, hot) {
    const P = GORGOTH_PALETTE;
    const crackColor = hot ? P.crackHot : P.crack;
    return `
        <path d="M-28 6 C-38 -18 -48 -52 -46 -80 C-44 -98 -26 -112 0 -112 C20 -112 36 -104 44 -90 C52 -74 48 -50 40 -30 C36 -14 32 -2 28 6 Z" fill="${P.skin}" stroke="${P.outline}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-40 -84 C-36 -100 -20 -108 -2 -108" fill="none" stroke="${P.skinHi}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
        <g class="dmn-glow">
            <path d="M-40 -58 L-31 -70 L-36 -86 L-26 -98 M-22 -104 L-12 -96 L-4 -106 M-44 -36 L-36 -46" fill="none" stroke="${P.crack}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
            <path d="M-40 -58 L-31 -70 L-36 -86 L-26 -98 M-22 -104 L-12 -96 L-4 -106 M-44 -36 L-36 -46" fill="none" stroke="${crackColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <path d="M-34 -12 C-38 -24 -38 -32 -34 -38 L-8 -44 L-6 -80 L-1 -76 L4 -84 L9 -78 L14 -86 L19 -79 L25 -86 L30 -80 L38 -84 C42 -64 40 -40 34 -20 L32 6 L-30 6 Z" fill="${P.overalls}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M-32 -16 L32 -16" stroke="${P.overallsDark}" stroke-width="3"/>
        <path d="M-30 -10 L30 -10" stroke="${P.stitch}" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.7"/>
        <path d="M-6 -78 C-14 -92 -26 -100 -34 -104" fill="none" stroke="${P.outline}" stroke-width="7" stroke-linecap="round"/>
        <path d="M-6 -78 C-14 -92 -26 -100 -34 -104" fill="none" stroke="${P.overalls}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M34 -82 C32 -94 26 -104 18 -110" fill="none" stroke="${P.outline}" stroke-width="7" stroke-linecap="round"/>
        <path d="M34 -82 C32 -94 26 -104 18 -110" fill="none" stroke="${P.overalls}" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="-5" cy="-76" r="3" fill="${P.brass}" stroke="${P.outline}" stroke-width="1.2"/>
        <circle cx="33" cy="-80" r="3" fill="${P.brass}" stroke="${P.outline}" stroke-width="1.2"/>
        <rect x="4" y="-70" width="18" height="14" rx="1.5" fill="${P.overallsDark}" stroke="${P.outline}" stroke-width="1.6"/>
        <path d="M6 -70 L6 -82 M9 -70 L11 -80" stroke="${P.ironHi}" stroke-width="2" stroke-linecap="round"/>
        <path d="M15 -70 L15 -78 M15 -80 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0" fill="none" stroke="${P.brass}" stroke-width="1.5"/>
        <rect x="-2" y="-52" width="32" height="10" rx="3" fill="#e8e2d0" stroke="${P.outline}" stroke-width="1.4"/>
        <text x="14" y="-44.6" text-anchor="middle" font-size="6.4" font-weight="bold" font-family="sans-serif" fill="#7a1d0c" letter-spacing="0.3">GORGOTH</text>
        <ellipse cx="22" cy="-30" rx="6" ry="4.5" fill="${P.skinDark}" stroke="#4a1a08" stroke-width="1"/>
        <ellipse class="dmn-glow" cx="22" cy="-30" rx="3.6" ry="2.4" fill="${crackColor}"/>
        <ellipse cx="-22" cy="-24" rx="5" ry="4" fill="${P.skinDark}" stroke="#4a1a08" stroke-width="1"/>
        <ellipse class="dmn-glow" cx="-22" cy="-24" rx="2.8" ry="2" fill="${crackColor}"/>
        <path d="M-18 -4 L-14 -10 L-10 -3 M6 -2 L10 -8 L13 -2" fill="none" stroke="${P.overallsDark}" stroke-width="1.2"/>
        ${gorgothPartScars('torso', ranks)}`;
}

// Tête (repère : cou en 0,0, tournée vers +x) : cornes (corne arrière en bélier, corne avant pointée vers le crawler),
// crâne massif à mâchoire prognathe et crocs, yeux de braise, casquette de concierge trop petite et calcinée
// (visière, insigne de clé en laiton), cicatrices de la tête.
function gorgothHead(pose, ranks, final) {
    const P = GORGOTH_PALETTE;
    const eye = pose.eyes === 'grip' ? P.eyeGrip : (final ? '#ffffff' : P.eye);
    const tip = final ? P.crackHot : P.hornTip;
    const jaw = pose.jawOpen
        ? `<path d="M2 -4 C10 6 24 16 40 14 L42 8 C30 8 18 2 10 -6 Z" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
           <path d="M14 -10 C24 -10 36 -6 42 -2 C38 6 26 8 12 2 Z" fill="${P.fireOuter}"/>
           <path class="dmn-glow" d="M18 -7 C26 -7 34 -4 38 -1 C34 4 26 5 18 1 Z" fill="${P.fireCore}"/>
           <path d="M30 -10 l2 5 l2 -5 M38 -8 l1 4 l2 -4 M28 10 l2 -5 l2 5 M36 11 l1 -4 l2 4" fill="#f5ead0" stroke="${P.outline}" stroke-width="0.8" stroke-linejoin="round"/>`
        : `<path d="M8 -4 L42 -8 C44 -2 42 4 36 6 L10 8 Z" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
           <path d="M14 -2 L40 -5" stroke="${P.crack}" stroke-width="1.4" opacity="0.85"/>
           <path d="M34 -6 l2 -7 l3 7 Z M24 -5 l2 -5 l2 5 Z" fill="#f5ead0" stroke="${P.outline}" stroke-width="1" stroke-linejoin="round"/>`;
    return `
        <path d="M2 -30 C-8 -52 -32 -60 -48 -48 C-60 -38 -56 -18 -44 -14 C-36 -12 -32 -20 -36 -25 C-42 -30 -44 -38 -36 -42 C-26 -48 -14 -40 -8 -24 Z" fill="${P.horn}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M-14 -50 l-3 7 M-26 -54 l0 8 M-38 -52 l3 7 M-48 -44 l6 4" stroke="${P.hornDark}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M-46 -24 C-42 -18 -36 -18 -36 -25" fill="none" stroke="${tip}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M-12 -18 C-16 -32 -6 -44 12 -44 C28 -44 38 -34 42 -24 L46 -14 C46 -8 42 -6 36 -6 L8 -2 C-4 0 -10 -8 -12 -18 Z" fill="${P.skin}" stroke="${P.outline}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-6 -30 C0 -40 14 -42 26 -38" fill="none" stroke="${P.skinHi}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-6 -12 L2 -20 L-2 -28 M30 -34 L36 -28" fill="none" stroke="${P.crack}" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
        ${jaw}
        <path d="M18 -28 C24 -34 34 -34 42 -26 L40 -22 C32 -26 24 -26 18 -22 Z" fill="${P.skinDark}" stroke="${P.outline}" stroke-width="1.8" stroke-linejoin="round"/>
        ${pose.eyes === 'ko'
        ? `<path d="M28 -26 L36 -18 M36 -26 L28 -18" stroke="${P.crackHot}" stroke-width="2.2" stroke-linecap="round"/>
           <path d="M30 6 C30 14 36 18 40 14 C42 10 38 6 36 6 Z" fill="#c2415d" stroke="${P.outline}" stroke-width="1.4"/>`
        : `<ellipse class="dmn-glow" cx="32" cy="-22" rx="7" ry="4" fill="${eye}" opacity="0.35"/>
        <path d="M28 -22.5 L37 -23.6 L35.5 -21 L29 -21 Z" fill="${eye}"/>
        <circle cx="34" cy="-22" r="1" fill="#fff"/>`}
        <path d="M16 -36 C18 -54 30 -68 50 -70 C58 -70 64 -66 68 -60 C60 -63 50 -61 42 -55 C34 -49 30 -42 28 -34 Z" fill="${P.horn}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M24 -50 l6 4 M34 -60 l3 7 M46 -66 l1 7" stroke="${P.hornDark}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M56 -66 C62 -66 66 -63 68 -60" fill="none" stroke="${tip}" stroke-width="2.4" stroke-linecap="round"/>
        ${pose.noCap ? '' : `<g class="dmn-cap">
            <path d="M-4 -40 C-6 -54 6 -62 20 -60 C30 -58 34 -50 32 -42 Z" fill="${P.cap}" stroke="${P.outline}" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M-5 -42 L32 -44 L33 -38 L-5 -36 Z" fill="${P.capDark}" stroke="${P.outline}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M28 -42 C38 -42 46 -40 50 -36 L46 -34 C40 -36 34 -37 28 -37 Z" fill="${P.visor}" stroke="${P.outline}" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="14" cy="-50" r="4.2" fill="${P.brass}" stroke="${P.brassDark}" stroke-width="1.2"/>
            <path d="M12.5 -51.5 a1.6 1.6 0 1 1 0.1 0 M14 -50 L17 -47 M16 -48 L17 -49" fill="none" stroke="${P.brassDark}" stroke-width="1"/>
            <path d="M2 -52 q3 -2 5 1 q-2 2 -5 -1 Z M24 -56 q3 -1 4 2 q-3 1 -4 -2 Z" fill="#0a0f1c" opacity="0.9"/>
            <path class="dmn-smoke-wisp" d="M6 -58 q-4 -6 1 -11 q4 -4 0 -9" fill="none" stroke="${P.smokeHi}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        </g>`}
        ${gorgothPartScars('head', ranks)}`;
}

// Main au bout d'un bras : poing (trousseau), griffe ou paume ouverte (Emprise, lueur violette).
function gorgothHand(p, angle, kind) {
    const P = GORGOTH_PALETTE;
    const t = `translate(${gorgothPt(p)}) rotate(${gorgothR(angle)})`;
    if (kind === 'palm') {
        return `<g transform="${t}">
            <circle class="dmn-grip-aura" cx="8" cy="0" r="22" fill="${P.eyeGrip}" opacity="0.16"/>
            <circle class="dmn-grip-aura" cx="8" cy="0" r="13" fill="${P.eyeGrip}" opacity="0.22"/>
            <path d="M-4 -10 C6 -14 14 -10 14 0 C14 10 6 14 -4 10 Z" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M8 -11 L22 -18 L18 -9 Z M12 -4 L28 -6 L20 0 Z M12 4 L27 8 L18 7 Z M6 10 L18 18 L8 13 Z" fill="${P.hornTip}" stroke="${P.outline}" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M0 -4 L6 0 L0 4" fill="none" stroke="${P.eyeGrip}" stroke-width="1.6"/>
        </g>`;
    }
    if (kind === 'claw') {
        return `<g transform="${t}">
            <circle cx="2" cy="0" r="11" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.4"/>
            <path d="M8 -8 L20 -12 L13 -3 Z M10 0 L23 2 L12 5 Z M6 7 L16 14 L6 10 Z" fill="${P.hornTip}" stroke="${P.outline}" stroke-width="1.3" stroke-linejoin="round"/>
        </g>`;
    }
    return `<g transform="${t}">
        <circle cx="2" cy="0" r="12" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.6"/>
        <path d="M8 -8 Q13 -4 12 2 M9 3 Q12 7 6 10" fill="none" stroke="${P.outline}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M-4 -6 L2 -2 L-3 4" fill="none" stroke="${P.crack}" stroke-width="1.3" opacity="0.8"/>
    </g>`;
}

// Bras : arrière-bras + avant-bras épais, manche de bleu de travail déchirée sur le haut du bras.
function gorgothArm(shoulder, elbow, hand, sleeve) {
    const P = GORGOTH_PALETTE;
    let out = gorgothLimb([shoulder, elbow], 28, P.skin, true) + gorgothLimb([elbow, hand], 25, P.skin, true);
    // Avant-bras plus massif que le bras (silhouette de brute) : renflement sombre côté coude.
    out += `<g transform="${gorgothFrame(elbow, hand, 0.35)}"><ellipse cx="0" cy="0" rx="16" ry="15" fill="${P.skin}" stroke="${P.outline}" stroke-width="2.4"/><path d="M-10 -4 L-2 2 L-6 9 M4 -9 L9 -2" fill="none" stroke="${P.crack}" stroke-width="1.5" stroke-linecap="round"/></g>`;
    if (sleeve) {
        // Lambeau de manche brûlée accroché à l'épaule.
        out += `<g transform="${gorgothFrame(shoulder, elbow, 0.12)}"><path d="M-8 -16 L12 -15 L8 -8 L14 -2 L7 4 L12 12 L-8 15 Z" fill="${P.overallsDark}" stroke="${P.outline}" stroke-width="1.6" stroke-linejoin="round"/></g>`;
    }
    return out;
}

// Jambe debout : cuisse et genou dans la salopette, bas de jambe déchiré, pied griffu.
function gorgothLeg(pts, ranks, isNear) {
    const P = GORGOTH_PALETTE;
    const [hip, knee, ankle, toe] = pts;
    const cloth = isNear ? P.overalls : P.overallsDark;
    let out = gorgothLimb([knee, ankle], 23, P.skin, true)
        + gorgothLimb([hip, knee], 34, P.skin, false)
        + gorgothLimb([hip, gorgothLerp(hip, knee, 0.7)], 36, cloth, false)
        + `<g transform="${gorgothFrame(hip, knee, 0.7)}"><path d="M-3 -19 L5 -12 L0 -5 L7 1 L1 7 L6 13 L-1 19 L-6 19 L-6 -19 Z" fill="${cloth}" stroke="${P.outline}" stroke-width="1.5" stroke-linejoin="round"/></g>`
        + `<g transform="${gorgothFrame(knee, ankle, 0.1)}"><ellipse cx="0" cy="0" rx="12" ry="14" fill="${P.skinHi}" stroke="${P.outline}" stroke-width="2"/><path d="M-6 -4 L2 0 L-4 6" fill="none" stroke="${P.crack}" stroke-width="1.4"/></g>`;
    const footAngle = gorgothAngle(ankle, toe);
    out += `<g transform="translate(${gorgothPt(ankle)}) rotate(${gorgothR(footAngle)})">
        <path d="M-10 -10 C4 -14 18 -10 24 -2 L24 6 L-10 6 Z" fill="${P.skinDark}" stroke="${P.outline}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M20 -4 L32 0 L22 4 Z M12 -2 L22 6 L10 6 Z" fill="${P.hornTip}" stroke="${P.outline}" stroke-width="1.3" stroke-linejoin="round"/>
    </g>`;
    if (isNear) out += gorgothLimbScars('nearThigh', hip, knee, ranks);
    return out;
}

// Lame de feu tenue dans la main arrière : garde de fer, lame de flammes ondulée.
function gorgothBlade(hand, angle, len, cls) {
    const P = GORGOTH_PALETTE;
    const L = len;
    return `<g transform="translate(${gorgothPt(hand)}) rotate(${gorgothR(angle)})">
        <rect x="-8" y="-3.5" width="10" height="7" rx="2" fill="${P.iron}" stroke="${P.outline}" stroke-width="1.6"/>
        <path d="M2 -9 L6 -9 L6 9 L2 9 Z" fill="${P.ironHi}" stroke="${P.outline}" stroke-width="1.4"/>
        <g class="${cls || 'dmn-blade'}">
            <path d="M6 -7 C${L * 0.3} -12 ${L * 0.55} -4 ${L * 0.7} -9 C${L * 0.85} -12 ${L} -4 ${L + 10} 0 C${L} 4 ${L * 0.85} 10 ${L * 0.7} 7 C${L * 0.5} 4 ${L * 0.3} 12 6 7 Z" fill="${P.fireOuter}" stroke="#5a1200" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6 -4 C${L * 0.35} -6 ${L * 0.6} -2 ${L * 0.85} -4 L${L + 4} 0 L${L * 0.85} 3 C${L * 0.6} 2 ${L * 0.35} 6 6 4 Z" fill="${P.blade}"/>
            <path d="M8 -1.2 L${L} 0 L8 1.2 Z" fill="${P.bladeCore}"/>
        </g>
    </g>`;
}

// Trousseau-fouet : gros anneau de fer à la main, chaîne de clés en fusion le long d'une Bézier.
function gorgothWhip(hand, ctrl, keys) {
    const P = GORGOTH_PALETTE;
    const [c1, c2, end] = ctrl;
    const d = `M${gorgothPt(hand)} C${gorgothPt(c1)} ${gorgothPt(c2)} ${gorgothPt(end)}`;
    let out = `<g class="dmn-whip">
        <path d="${d}" fill="none" stroke="${P.crack}" stroke-width="9" stroke-linecap="round" opacity="0.22"/>
        <path d="${d}" fill="none" stroke="${P.outline}" stroke-width="5" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="${P.fireMid}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="5 3"/>`;
    const n = keys || 9;
    for (let i = 1; i <= n; i++) {
        const b = gorgothBezier(hand, c1, c2, end, i / (n + 0.4));
        out += gorgothKey(b.p, b.angle, i === n ? 1.5 : 1.1);
    }
    out += `<circle cx="${gorgothR(hand[0])}" cy="${gorgothR(hand[1] + 10)}" r="10" fill="none" stroke="${P.outline}" stroke-width="5"/>
        <circle cx="${gorgothR(hand[0])}" cy="${gorgothR(hand[1] + 10)}" r="10" fill="none" stroke="${P.ironHi}" stroke-width="2.4"/>
        ${gorgothKey([hand[0] - 7, hand[1] + 18], 100, 1.2)}${gorgothKey([hand[0] + 3, hand[1] + 21], 80, 1.3)}${gorgothKey([hand[0] + 9, hand[1] + 15], 60, 1.1)}
    </g>`;
    return out;
}

// Ailes de fumée et de ténèbres, attachées en haut du dos (`root`). `mode` : 'spread' (déployées en arrière),
// 'raised' (déployées plus haut, pour armer un coup). L'aile lointaine, plus sombre, est derrière tout.
const GORGOTH_WING_PATH = 'M0 0 L-44 -72 L-100 -86 Q-90 -68 -112 -52 Q-94 -38 -106 -14 Q-86 -10 -84 14 Q-62 4 -48 30 Q-30 14 -8 32 Z';
function gorgothWing(root, mode, far) {
    const P = GORGOTH_PALETTE;
    const rot = mode === 'raised' ? 16 : 0;
    const s = far ? 0.8 : 0.95;
    const offset = far ? [16, -18] : [0, 0];
    const t = `translate(${gorgothPt([root[0] + offset[0], root[1] + offset[1]])}) rotate(${rot + (far ? 14 : 0)}) scale(${s})`;
    const fill = far ? '#110d16' : P.smoke;
    return `<g transform="${t}"><g class="dmn-wing${far ? ' dmn-wing-far' : ''}">
        <path d="${GORGOTH_WING_PATH}" fill="${fill}" stroke="${fill}" stroke-width="10" stroke-linejoin="round" opacity="0.45"/>
        <path d="${GORGOTH_WING_PATH}" fill="${fill}" stroke="${P.outline}" stroke-width="2" stroke-linejoin="round" opacity="0.94"/>
        <path class="dmn-smoke-wisp" d="M-20 -10 Q-40 -20 -60 -6 Q-74 4 -90 -4 M-30 10 Q-50 2 -66 14" fill="none" stroke="${P.smokeHi}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
        <path d="M0 0 L-44 -72 L-100 -86 M-44 -72 L-112 -52 M-44 -72 L-106 -14 M-44 -72 L-84 14 M-44 -72 L-48 30" fill="none" stroke="${P.outline}" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
        <path d="M0 0 L-44 -72 L-100 -86" fill="none" stroke="${P.skin}" stroke-width="4" stroke-linecap="round"/>
        <path d="M-44 -72 l-4 -10 l8 6 Z" fill="${P.hornTip}" stroke="${P.outline}" stroke-width="1"/>
        <g class="dmn-ember">
            <circle cx="-112" cy="-52" r="2" fill="${P.smokeEdge}"/><circle cx="-106" cy="-14" r="1.8" fill="${P.smokeEdge}"/>
            <circle cx="-84" cy="14" r="1.6" fill="${P.fireMid}"/><circle cx="-48" cy="30" r="1.8" fill="${P.smokeEdge}"/>
            <circle cx="-8" cy="32" r="1.4" fill="${P.fireMid}"/>
        </g>
    </g></g>`;
}
// Ailes repliées devant lui en bouclier (intention Garde) : deux pans de fumée sombre, nervures, braises au bord.
function gorgothWingShield() {
    const P = GORGOTH_PALETTE;
    const back = 'M-26 -184 C12 -214 76 -204 92 -160 L94 -104 Q78 -98 80 -78 Q60 -84 56 -62 Q38 -74 22 -60 Q8 -74 -10 -66 Z';
    const front = 'M-14 -170 C20 -196 70 -186 84 -150 L84 -98 Q70 -94 70 -78 Q52 -82 48 -64 Q32 -74 18 -62 Q6 -72 -6 -68 Z';
    return `<g class="dmn-shield">
        <path d="${back}" fill="#110d16" stroke="${P.outline}" stroke-width="2.2" stroke-linejoin="round" opacity="0.96"/>
        <path d="${front}" fill="${P.smoke}" stroke="${P.outline}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M-14 -170 C20 -196 70 -186 84 -150" fill="none" stroke="${P.skin}" stroke-width="5" stroke-linecap="round"/>
        <path d="M34 -186 L70 -78 M54 -182 L84 -98 M16 -184 L48 -64 M2 -178 L18 -62" fill="none" stroke="${P.outline}" stroke-width="2.2" opacity="0.85"/>
        <path class="dmn-smoke-wisp" d="M10 -140 Q30 -150 50 -136 Q64 -126 76 -134" fill="none" stroke="${P.smokeHi}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
        <path d="M84 -150 l8 -6 l-2 10 Z" fill="${P.hornTip}" stroke="${P.outline}" stroke-width="1"/>
        <g class="dmn-ember"><circle cx="84" cy="-98" r="2" fill="${P.smokeEdge}"/><circle cx="70" cy="-78" r="1.8" fill="${P.smokeEdge}"/><circle cx="48" cy="-64" r="1.8" fill="${P.fireMid}"/><circle cx="18" cy="-62" r="1.6" fill="${P.smokeEdge}"/></g>
    </g>`;
}

// Crinière de feu, derrière la tête et le long de l'échine : plus haute à chaque acte (`level` 1 à 4).
function gorgothMane(neck, level, final) {
    const k = [0.8, 1, 1.3, 1.6, 1.85][Math.max(0, Math.min(4, level))];
    const spots = [[-36, 2, 12, 26, -10], [-24, -10, 14, 32, -12], [-10, -18, 15, 36, -12], [4, -22, 14, 32, -10], [-46, 18, 11, 22, -8], [-54, 36, 10, 18, -6]];
    let out = '';
    spots.forEach(([x, y, w, h, lean], i) => {
        out += gorgothFlame(neck[0] + x, neck[1] + y, w * Math.min(1.25, k), h * k, lean * k, `dmn-flame dmn-flame-${i % 3}`);
    });
    return `<g class="dmn-mane" data-level="${level}">${out}</g>`;
}

// Chaînes (intention de mise en scène : Gorgoth a été enchaîné dans sa loge) : 4 chaînes, une par poignet et par
// cheville, scellées au sol ; elles se brisent dans l'ordre cheville arrière, cheville avant, poignet arrière,
// poignet avant. Intacte : chaîne tendue jusqu'à un anneau au sol ; brisée : bracelet, trois maillons qui
// pendent, et les restes rougeoyants près de l'anneau.
const GORGOTH_CHAIN_ORDER = ['nearWrist', 'farWrist', 'nearAnkle', 'farAnkle'];
function gorgothShackle(p, angle) {
    const P = GORGOTH_PALETTE;
    return `<g transform="translate(${gorgothPt(p)}) rotate(${gorgothR(angle)})"><rect x="-5" y="-14" width="10" height="28" rx="3" fill="${P.iron}" stroke="${P.outline}" stroke-width="1.8"/><path d="M-1 -12 L-1 12" stroke="${P.ironHi}" stroke-width="1.2"/></g>`;
}
function gorgothChainLine(a, b) {
    const P = GORGOTH_PALETTE;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10];
    const d = `M${gorgothPt(a)} Q${gorgothPt(mid)} ${gorgothPt(b)}`;
    return `<path d="${d}" fill="none" stroke="${P.outline}" stroke-width="5" stroke-linecap="round"/>`
        + `<path d="${d}" fill="none" stroke="${P.iron}" stroke-width="3.4" stroke-dasharray="5 2"/>`
        + `<path d="${d}" fill="none" stroke="${P.ironHi}" stroke-width="1.1" stroke-dasharray="3 4"/>`;
}
function gorgothChains(points, chainsLeft) {
    const P = GORGOTH_PALETTE;
    const left = Math.max(0, Math.min(4, Math.floor(Number(chainsLeft) || 0)));
    let out = '';
    GORGOTH_CHAIN_ORDER.forEach((slot, i) => {
        const c = points[slot];
        const intact = i < left;
        const stake = c.stake;
        out += `<g class="dmn-chain" data-slot="${slot}" data-intact="${intact ? 1 : 0}">`;
        out += `<ellipse cx="${gorgothR(stake[0])}" cy="-1" rx="7" ry="2.5" fill="${P.iron}" stroke="${P.outline}" stroke-width="1.4"/><rect x="${gorgothR(stake[0] - 2)}" y="-8" width="4" height="8" fill="${P.iron}" stroke="${P.outline}" stroke-width="1.2"/>`;
        if (intact) out += gorgothChainLine(c.at, [stake[0], -6]);
        else {
            out += gorgothChainLine(c.at, [c.at[0] + 3, c.at[1] + 18]);
            out += `<circle cx="${gorgothR(c.at[0] + 3)}" cy="${gorgothR(c.at[1] + 20)}" r="2.4" fill="${P.crack}" class="dmn-glow"/>`;
            out += `<path d="M${gorgothR(stake[0])} -6 L${gorgothR(stake[0] + 9)} -3" stroke="${P.outline}" stroke-width="5" stroke-linecap="round"/><path d="M${gorgothR(stake[0])} -6 L${gorgothR(stake[0] + 9)} -3" stroke="${P.iron}" stroke-width="3" stroke-dasharray="4 2"/><circle cx="${gorgothR(stake[0] + 10)}" cy="-3" r="1.8" fill="${P.crack}"/>`;
        }
        out += gorgothShackle(c.at, c.angle);
        out += `</g>`;
    });
    return out;
}

// Pose K.O. : assis par terre, adossé dans le vide, la tête renversée (yeux en croix, langue pendante), la casquette
// tombée devant lui, les ailes affaissées en flaque de fumée, des clés qui tournent au-dessus de sa tête.
function gorgothKnockedOut(ranks, chainsLeft) {
    const P = GORGOTH_PALETTE;
    const hip = [-24, -30];
    const lean = -18;
    const legs = {
        far: [[-30, -32], [16, -36], [30, -12], [50, -4]],
        near: [[-16, -30], [32, -28], [48, -10], [68, -2]]
    };
    const toWorld = p => gorgothRot(p, lean, hip);
    const nearShoulder = toWorld([30, -88]);
    const farShoulder = toWorld([-24, -92]);
    const neck = toWorld([16, -102]);
    const torsoT = `translate(${gorgothPt(hip)}) rotate(${lean})`;
    const ko = Object.assign({}, GORGOTH_POSES.idle, { eyes: 'ko', jawOpen: false, noCap: true });
    const near = { elbow: [30, -70], hand: [16, -40] };
    const far = { elbow: [-66, -80], hand: [-76, -44] };
    const wingPuddle = `<g class="dmn-wing"><path d="M-120 -2 Q-128 -40 -104 -60 Q-94 -96 -60 -100 Q-36 -118 -14 -108 L-10 -60 Q-40 -40 -60 -24 Q-86 -8 -120 -2 Z" fill="${P.smoke}" stroke="${P.outline}" stroke-width="2" opacity="0.92"/>
        <path d="M-60 -100 L-104 -60 M-60 -100 L-120 -2 M-60 -100 L-60 -24" fill="none" stroke="${P.outline}" stroke-width="2" opacity="0.8"/>
        <path class="dmn-smoke-wisp" d="M-100 -46 Q-82 -66 -64 -58 Q-46 -52 -32 -70" fill="none" stroke="${P.smokeHi}" stroke-width="3" stroke-linecap="round" opacity="0.5"/></g>`;
    const chainPts = {
        nearWrist: { at: gorgothLerp(near.elbow, near.hand, 0.72), angle: gorgothAngle(near.elbow, near.hand) + 90, stake: [8, 0] },
        farWrist: { at: gorgothLerp(far.elbow, far.hand, 0.72), angle: gorgothAngle(far.elbow, far.hand) + 90, stake: [-96, 0] },
        nearAnkle: { at: gorgothLerp(legs.near[1], legs.near[2], 0.82), angle: gorgothAngle(legs.near[1], legs.near[2]) + 90, stake: [84, 0] },
        farAnkle: { at: gorgothLerp(legs.far[1], legs.far[2], 0.82), angle: gorgothAngle(legs.far[1], legs.far[2]) + 90, stake: [-40, 0] }
    };
    const head = [neck[0] + 2, neck[1] - 2];
    const stars = [[-10, -216, 20], [24, -232, 160], [58, -214, 260], [22, -200, 330]].map(([x, y, a]) => gorgothKey([x, y], a, 1.4)).join('');
    return `<g class="gorgoth" data-pose="ko"><g transform="scale(${GORGOTH_SCALE})">
        <ellipse class="scene-ground-shadow" cx="-14" cy="0" rx="112" ry="7"/>
        ${wingPuddle}
        ${gorgothArm(farShoulder, far.elbow, far.hand, true)}${gorgothHand(far.hand, 100, 'claw')}
        ${gorgothLeg(legs.far, ranks, false)}
        <g transform="${torsoT}">${gorgothTorso(ranks, false)}</g>
        ${gorgothLeg(legs.near, ranks, true)}
        <g transform="translate(${gorgothPt(head)}) rotate(-28) scale(1.25)">${gorgothHead(ko, ranks, false)}</g>
        ${gorgothArm(nearShoulder, near.elbow, near.hand, true)}${gorgothHand(near.hand, 110, 'claw')}
        <g transform="translate(96 -3) rotate(-10)">
            <path d="M-12 0 C-14 -12 -2 -18 10 -16 C18 -14 20 -6 18 0 Z" fill="${P.cap}" stroke="${P.outline}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M14 -2 C20 -2 24 0 26 3 L16 3 Z" fill="${P.visor}" stroke="${P.outline}" stroke-width="1.4"/>
            <circle cx="3" cy="-8" r="3" fill="${P.brass}" stroke="${P.brassDark}" stroke-width="1"/>
        </g>
        ${gorgothFlame(-56, -128, 8, 14, -2, 'dmn-flame dmn-flame-0')}${gorgothFlame(-40, -138, 7, 12, -2, 'dmn-flame dmn-flame-1')}
        <path class="dmn-smoke-wisp" d="M-46 -140 q-6 -10 2 -18 q6 -8 -2 -16" fill="none" stroke="${P.smokeHi}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
        <g class="dmn-ko-stars">${stars}</g>
        ${gorgothChains(chainPts, chainsLeft)}
    </g></g>`;
}

// --- Composition -----------------------------------------------------------------------------------------
// Pose dessinée d'après l'état : 'ko', une des 5 intentions, ou 'idle' (aucune intention, ou intention masquée
// non révélée — Gorgoth reste au repos derrière un voile de fumée).
function gorgothPoseKey(o) {
    if (o && o.ko) return 'ko';
    const intent = o && o.intent;
    return intent && GORGOTH_POSES[intent] && intent !== 'idle' ? intent : 'idle';
}

// Sprite complet de Gorgoth, dans son repère (pieds en 0,0). `o` : { intent, veiled, act (1-4), final, scars
// { melee, ranged, magic, unarmed } (crans 0-3), chainsLeft (0-4), ko }. Ordre : aile lointaine, crinière, aile
// proche, jambe et bras arrière (lame), torse, jambe avant, tête, bras avant (trousseau-fouet), chaînes, puis le
// bouclier d'ailes (Garde) et le voile (intention masquée). Pure.
function composeGorgothSprite(o) {
    const opts = o || {};
    const ranks = gorgothScarRanks(opts.scars);
    if (opts.ko) return gorgothKnockedOut(ranks, opts.chainsLeft);
    const P = GORGOTH_PALETTE;
    const poseKey = gorgothPoseKey(opts);
    const pose = GORGOTH_POSES[poseKey];
    const act = Math.max(1, Math.min(4, Math.floor(Number(opts.act) || 1)));
    const final = !!opts.final;
    const level = Math.min(4, act + (final ? 1 : 0));
    const hip = GORGOTH_HIP;
    const lean = pose.lean;
    const toWorld = p => gorgothRot(p, lean, hip);
    const nearShoulder = toWorld([30, -88]);
    const farShoulder = toWorld([-24, -92]);
    const neck = toWorld([16, -102]);
    const wingRoot = toWorld([-24, -94]);
    const headPos = [neck[0] + pose.head.dx, neck[1] + pose.head.dy];
    const torsoT = `translate(${gorgothPt(hip)}) rotate(${lean})`;
    const near = pose.near, far = pose.far;
    const nearHandAngle = gorgothAngle(near.elbow, near.hand);
    const farHandAngle = gorgothAngle(far.elbow, far.hand);
    const wings = pose.wings === 'shield' ? '' : gorgothWing(wingRoot, pose.wings, false);
    const farWing = gorgothWing(wingRoot, pose.wings === 'shield' ? 'spread' : pose.wings, true);
    const hot = !!pose.hot || act >= 3;
    // Act 3+ : des flammes lèchent le sol autour de ses pieds.
    const groundFire = act >= 3
        ? [[-52, 0, 14, 24, -3], [-18, 0, 12, 20, 2], [30, 0, 13, 22, -2], [58, 0, 10, 18, 3]].map(([x, y, w, h, l], i) => gorgothFlame(x, y, w, h * (act >= 4 ? 1.4 : 1), l, `dmn-flame dmn-flame-${i % 3}`)).join('')
        : '';
    const chainPts = {
        nearWrist: { at: gorgothLerp(near.elbow, near.hand, 0.72), angle: nearHandAngle + 90, stake: [Math.min(80, Math.max(64, near.hand[0] + 16)), 0] },
        farWrist: { at: gorgothLerp(far.elbow, far.hand, 0.72), angle: farHandAngle + 90, stake: [Math.max(-110, Math.min(-84, far.hand[0] - 20)), 0] },
        nearAnkle: { at: gorgothLerp(GORGOTH_LEGS.near[1], GORGOTH_LEGS.near[2], 0.82), angle: gorgothAngle(GORGOTH_LEGS.near[1], GORGOTH_LEGS.near[2]) + 90, stake: [62, 0] },
        farAnkle: { at: gorgothLerp(GORGOTH_LEGS.far[1], GORGOTH_LEGS.far[2], 0.82), angle: gorgothAngle(GORGOTH_LEGS.far[1], GORGOTH_LEGS.far[2]) + 90, stake: [-70, 0] }
    };
    const blade = gorgothBlade(far.hand, far.blade, far.bladeLen);
    const farArm = gorgothArm(farShoulder, far.elbow, far.hand, true) + gorgothHand(far.hand, farHandAngle, 'fist');
    const nearArm = gorgothArm(nearShoulder, near.elbow, near.hand, true)
        + gorgothLimbScars('nearUpper', nearShoulder, near.elbow, ranks)
        + gorgothLimbScars('nearFore', near.elbow, near.hand, ranks)
        + (ranks.unarmed >= 2 ? `<g transform="translate(${gorgothPt(near.hand)}) rotate(${gorgothR(nearHandAngle)})"><circle cx="11" cy="-6" r="3" fill="${P.stud}" stroke="${P.outline}" stroke-width="1.2"/><circle cx="13" cy="1" r="3" fill="${P.stud}" stroke="${P.outline}" stroke-width="1.2"/><circle cx="10" cy="7" r="3" fill="${P.stud}" stroke="${P.outline}" stroke-width="1.2"/></g>` : '')
        + gorgothHand(near.hand, nearHandAngle, near.hand_kind);
    const whip = gorgothWhip(near.hand, pose.whip, poseKey === 'whip' ? 11 : 8);
    // Brasier : boule de feu qui gonfle dans la gueule (devant la tête, vers le crawler).
    const mouth = gorgothRot([40, 2], pose.head.rot, [0, 0]);
    const mouthPt = [headPos[0] + mouth[0] * GORGOTH_HEAD_SCALE, headPos[1] + mouth[1] * GORGOTH_HEAD_SCALE];
    const brazier = poseKey === 'blaze'
        ? `<g class="dmn-brazier"><circle cx="${gorgothR(mouthPt[0] + 10)}" cy="${gorgothR(mouthPt[1])}" r="22" fill="${P.fireOuter}" opacity="0.25"/>
            <circle cx="${gorgothR(mouthPt[0] + 10)}" cy="${gorgothR(mouthPt[1])}" r="13" fill="${P.fireMid}" opacity="0.85"/>
            <circle cx="${gorgothR(mouthPt[0] + 10)}" cy="${gorgothR(mouthPt[1])}" r="7" fill="${P.fireCore}"/>
            ${gorgothFlame(mouthPt[0] + 22, mouthPt[1] + 6, 9, 18, 6, 'dmn-flame dmn-flame-1')}${gorgothFlame(mouthPt[0] + 4, mouthPt[1] - 6, 8, 16, 4, 'dmn-flame dmn-flame-2')}</g>`
        : '';
    const veil = opts.veiled
        ? `<g class="dmn-veil"><ellipse cx="20" cy="-130" rx="96" ry="66" fill="#0a070d" opacity="0.62"/><path class="dmn-smoke-wisp" d="M-60 -120 Q-30 -150 0 -128 Q30 -106 60 -134 Q80 -150 96 -126" fill="none" stroke="${P.smokeHi}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
            <text x="22" y="-118" text-anchor="middle" font-size="26" font-weight="bold" font-family="sans-serif" fill="#a78bfa" opacity="0.85">???</text></g>`
        : '';
    return `<g class="gorgoth" data-pose="${poseKey}" data-act="${act}"${final ? ' data-final="1"' : ''}><g transform="scale(${GORGOTH_SCALE})">
        <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="92" ry="7"/>
        ${farWing}
        ${gorgothMane(neck, level, final)}
        ${wings}
        ${gorgothLeg(GORGOTH_LEGS.far, ranks, false)}
        ${blade}
        ${farArm}
        <g class="dmn-breathe">
            <g transform="${torsoT}">${gorgothTorso(ranks, hot)}</g>
        </g>
        ${gorgothLeg(GORGOTH_LEGS.near, ranks, true)}
        <g transform="translate(${gorgothPt(headPos)}) rotate(${pose.head.rot}) scale(${GORGOTH_HEAD_SCALE})">${gorgothHead(pose, ranks, final)}</g>
        ${brazier}
        ${whip}
        ${nearArm}
        ${gorgothChains(chainPts, opts.chainsLeft)}
        ${pose.wings === 'shield' ? gorgothWingShield() : ''}
        ${groundFire}
        ${veil}
    </g></g>`;
}
