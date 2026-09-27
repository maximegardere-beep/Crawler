// backdrops.js - Décors des scènes (combat, puis boutiques/salles sécurisées). Catalogue pur, sur le
// modèle de sprites.js : aucun DOM, aucun gameState. Uniquement des générateurs de chaînes SVG et des
// fiches de décor ; scene.js les assemble (composeBackdrop()) et décide quand redessiner.
//
// Repère : celui du viewBox des scènes (360 x 150), sol à y = BACKDROP_GROUND_Y. Le décor est toujours
// dessiné DERRIÈRE les combattants, les bandes de portée et les chiffres de dégâts, en 3 couches :
//   fond      : mur texturé (motif), plafond, ombre en pied de mur ;
//   milieu    : halos de lumière sur le mur, accessoires muraux (torches, néons, panneaux...) ;
//   avant-plan: sol texturé, halos au sol, débris, vignette sombre sur les bords.
// Style : formes plates, contours sombres #05060c, palette sombre et désaturée — toujours plus terne que
// les personnages, pour que la zone où ils se tiennent reste lisible.
//
// Motifs (murs, sols) : fonctions (id, palette) -> <pattern>, id fourni par scene.js (préfixé par
// scène, pour que plusieurs scènes puissent coexister dans la page). Accessoires : { markup(opts,
// palette), light(opts) } dans un repère local dont l'origine est le point de fixation au mur ; light()
// renvoie la source lumineuse éventuelle (décalage, couleur, rayon), dont scene.js tire les halos.

const BACKDROP_WIDTH = 360;
const BACKDROP_HEIGHT = 150;
const BACKDROP_GROUND_Y = 124;

// --- Motifs de mur ---------------------------------------------------------------------------------
// Palette lue : wall, wallAlt (variation), mortar (joints/creux).
const BACKDROP_WALL_PATTERNS = {
    stone: (id, p) => `
        <pattern id="${id}" width="48" height="28" patternUnits="userSpaceOnUse">
            <rect width="48" height="28" fill="${p.mortar}"/>
            <rect x="1" y="1" width="22" height="12" rx="2" fill="${p.wall}"/>
            <rect x="25" y="1" width="22" height="12" rx="2" fill="${p.wallAlt}"/>
            <rect x="-11" y="15" width="22" height="12" rx="2" fill="${p.wallAlt}"/>
            <rect x="13" y="15" width="22" height="12" rx="2" fill="${p.wall}"/>
            <rect x="37" y="15" width="22" height="12" rx="2" fill="${p.wallAlt}"/>
            <path d="M6 4 l5 4 l4 -1 M29 9 l6 2 M18 19 l4 5" fill="none" stroke="${p.mortar}" stroke-width="0.8"/>
        </pattern>`,
    bricks: (id, p) => `
        <pattern id="${id}" width="24" height="12" patternUnits="userSpaceOnUse">
            <rect width="24" height="12" fill="${p.mortar}"/>
            <rect x="0.6" y="0.6" width="22.8" height="4.8" fill="${p.wall}"/>
            <rect x="-11.4" y="6.6" width="22.8" height="4.8" fill="${p.wallAlt}"/>
            <rect x="12.6" y="6.6" width="22.8" height="4.8" fill="${p.wallAlt}"/>
        </pattern>`,
    concrete: (id, p) => `
        <pattern id="${id}" width="60" height="40" patternUnits="userSpaceOnUse">
            <rect width="60" height="40" fill="${p.wall}"/>
            <rect y="38.5" width="60" height="1.5" fill="${p.mortar}"/>
            <circle cx="15" cy="19" r="1.3" fill="${p.mortar}"/>
            <circle cx="45" cy="19" r="1.3" fill="${p.mortar}"/>
            <circle cx="8" cy="7" r="0.8" fill="${p.wallAlt}"/>
            <circle cx="33" cy="30" r="0.9" fill="${p.wallAlt}"/>
            <circle cx="52" cy="10" r="0.7" fill="${p.wallAlt}"/>
        </pattern>`,
    tiles: (id, p) => `
        <pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="${p.mortar}"/>
            <rect x="0.7" y="0.7" width="14.6" height="14.6" fill="${p.wall}"/>
            <path d="M2 3 h6" stroke="${p.wallAlt}" stroke-width="0.8"/>
        </pattern>`,
    sheetMetal: (id, p) => `
        <pattern id="${id}" width="40" height="30" patternUnits="userSpaceOnUse">
            <rect width="40" height="30" fill="${p.mortar}"/>
            <rect x="0.8" y="0.8" width="38.4" height="28.4" fill="${p.wall}"/>
            <circle cx="4" cy="4" r="1.2" fill="${p.wallAlt}"/>
            <circle cx="36" cy="4" r="1.2" fill="${p.wallAlt}"/>
            <circle cx="4" cy="26" r="1.2" fill="${p.wallAlt}"/>
            <circle cx="36" cy="26" r="1.2" fill="${p.wallAlt}"/>
            <path d="M12 20 l10 -6" stroke="${p.wallAlt}" stroke-width="0.7"/>
        </pattern>`,
    wood: (id, p) => `
        <pattern id="${id}" width="60" height="14" patternUnits="userSpaceOnUse">
            <rect width="60" height="14" fill="${p.wall}"/>
            <rect y="13" width="60" height="1" fill="${p.mortar}"/>
            <rect x="38" width="1" height="13" fill="${p.mortar}"/>
            <path d="M3 5 q10 -2 20 0 t14 0 M42 8 q8 2 16 0" fill="none" stroke="${p.wallAlt}" stroke-width="0.8"/>
        </pattern>`
};

// --- Motifs de sol ---------------------------------------------------------------------------------
// Palette lue : floor, floorAlt, joint. Hauteur de motif 13 : deux rangées sur les 26 unités de sol.
const BACKDROP_FLOOR_PATTERNS = {
    flagstones: (id, p) => `
        <pattern id="${id}" width="36" height="13" patternUnits="userSpaceOnUse">
            <rect width="36" height="13" fill="${p.joint}"/>
            <rect x="1" y="1" width="16" height="5" rx="1" fill="${p.floor}"/>
            <rect x="19" y="1" width="16" height="5" rx="1" fill="${p.floorAlt}"/>
            <rect x="-8" y="7.5" width="16" height="5" rx="1" fill="${p.floorAlt}"/>
            <rect x="10" y="7.5" width="16" height="5" rx="1" fill="${p.floor}"/>
            <rect x="28" y="7.5" width="16" height="5" rx="1" fill="${p.floorAlt}"/>
        </pattern>`,
    tiles: (id, p) => `
        <pattern id="${id}" width="18" height="13" patternUnits="userSpaceOnUse">
            <rect width="18" height="13" fill="${p.joint}"/>
            <rect x="0.6" y="0.6" width="16.8" height="11.8" fill="${p.floor}"/>
        </pattern>`,
    concrete: (id, p) => `
        <pattern id="${id}" width="60" height="13" patternUnits="userSpaceOnUse">
            <rect width="60" height="13" fill="${p.floor}"/>
            <circle cx="12" cy="4" r="0.8" fill="${p.floorAlt}"/>
            <circle cx="41" cy="9" r="0.9" fill="${p.floorAlt}"/>
            <path d="M24 2 l4 4 l-2 5" fill="none" stroke="${p.joint}" stroke-width="0.7"/>
        </pattern>`,
    planks: (id, p) => `
        <pattern id="${id}" width="40" height="13" patternUnits="userSpaceOnUse">
            <rect width="40" height="13" fill="${p.floor}"/>
            <rect y="6" width="40" height="0.8" fill="${p.joint}"/>
            <rect y="12.2" width="40" height="0.8" fill="${p.joint}"/>
            <rect x="26" width="0.8" height="6" fill="${p.joint}"/>
            <rect x="9" y="6.8" width="0.8" height="5.4" fill="${p.joint}"/>
        </pattern>`,
    cobbles: (id, p) => `
        <pattern id="${id}" width="14" height="13" patternUnits="userSpaceOnUse">
            <rect width="14" height="13" fill="${p.joint}"/>
            <rect x="1" y="1" width="12" height="5" rx="2.5" fill="${p.floor}"/>
            <rect x="-6" y="7.5" width="12" height="5" rx="2.5" fill="${p.floorAlt}"/>
            <rect x="8" y="7.5" width="12" height="5" rx="2.5" fill="${p.floorAlt}"/>
        </pattern>`,
    grating: (id, p) => `
        <pattern id="${id}" width="12" height="13" patternUnits="userSpaceOnUse">
            <rect width="12" height="13" fill="${p.joint}"/>
            <rect x="1" y="1" width="10" height="4.5" fill="${p.floor}"/>
            <rect x="1" y="7.5" width="10" height="4.5" fill="${p.floorAlt}"/>
        </pattern>`
};

// --- Plafonds --------------------------------------------------------------------------------------
// Bande du haut de la scène (≈ y 0-16), pour que le plafond ne reste jamais vide. Palette : ceiling,
// plus mortar/pipe selon le type.
const BACKDROP_CEILINGS = {
    // Voûte de pierre : arcs pendants et quelques concrétions.
    vault: (p) => `
        <path d="M0 0 H360 V12 Q330 20 300 12 Q270 20 240 12 Q210 20 180 12 Q150 20 120 12 Q90 20 60 12 Q30 20 0 12 Z" fill="${p.ceiling}" stroke="#05060c" stroke-width="1.5"/>
        <path d="M44 15 l2 6 l2 -6 Z M163 15 l1.5 5 l1.5 -5 Z M268 15 l2 7 l2 -7 Z" fill="${p.ceiling}" stroke="#05060c" stroke-width="1"/>`,
    // Poutres de bois apparentes.
    beams: (p) => `
        <rect x="0" y="0" width="360" height="9" fill="${p.ceiling}"/>
        <rect x="0" y="9" width="360" height="5" fill="${p.wallAlt}" stroke="#05060c" stroke-width="1"/>
        <path d="M30 14 v4 M120 14 v4 M210 14 v4 M300 14 v4" stroke="${p.mortar}" stroke-width="6"/>`,
    // Tuyauterie sous un plafond technique.
    pipes: (p) => `
        <rect x="0" y="0" width="360" height="10" fill="${p.ceiling}"/>
        <rect x="0" y="4" width="360" height="5" fill="${p.pipe}" stroke="#05060c" stroke-width="1"/>
        <rect x="0" y="11" width="360" height="3.5" fill="${p.pipe}" stroke="#05060c" stroke-width="1"/>
        <path d="M60 3 v12 M170 3 v12 M280 3 v12" stroke="#05060c" stroke-width="2"/>`
};

// --- Accessoires -----------------------------------------------------------------------------------
// Origine : point de fixation au mur. `phase` (secondes, optionnel) décale l'animation pour que deux
// accessoires identiques ne scintillent pas à l'unisson.
function backdropAnimDelay(opts) {
    return opts.phase ? ` style="animation-delay:-${opts.phase}s"` : '';
}

const BACKDROP_PROPS = {
    // Torche murale : support, manche, flamme animée.
    torch: {
        markup: (o) => `
            <rect x="-2" y="-2" width="4" height="9" fill="#2a2320" stroke="#05060c" stroke-width="1"/>
            <path d="M-3 0 L3 0 L2 -12 L-2 -12 Z" fill="#4a3a24" stroke="#05060c" stroke-width="1"/>
            <g class="bd-flame"${backdropAnimDelay(o)}>
                <path d="M0 -27 C5 -21 5 -15 0 -12 C-5 -15 -5 -21 0 -27 Z" fill="#d97706" stroke="#05060c" stroke-width="0.8"/>
                <path d="M0 -21 C2.4 -18 2.4 -15 0 -13.5 C-2.4 -15 -2.4 -18 0 -21 Z" fill="#fcd34d"/>
            </g>`,
        light: (o) => ({ dx: 0, dy: -18, color: o.lightColor || '#f59e0b', radius: o.radius || 44, flicker: true })
    },
    // Néon : cadre sombre, texte en tube lumineux ; `flicker` pour un néon qui grésille.
    neon: {
        markup: (o) => {
            const w = o.w || 44;
            const color = o.color || '#22d3ee';
            const cls = o.flicker ? 'bd-neon bd-neon-flicker' : 'bd-neon';
            return `
            <rect x="${-w / 2}" y="-9" width="${w}" height="18" rx="3" fill="#0b0d12" stroke="#05060c" stroke-width="1.5"/>
            <g class="${cls}"${backdropAnimDelay(o)}>
                <text x="0" y="3.5" text-anchor="middle" font-size="${o.fontSize || 10}" font-weight="bold" letter-spacing="1" fill="none" stroke="${color}" stroke-width="2.2" opacity="0.25">${o.text || ''}</text>
                <text x="0" y="3.5" text-anchor="middle" font-size="${o.fontSize || 10}" font-weight="bold" letter-spacing="1" fill="${color}" opacity="0.85">${o.text || ''}</text>
            </g>`;
        },
        light: (o) => ({ dx: 0, dy: 0, color: o.color || '#22d3ee', radius: o.radius || 38, flicker: !!o.flicker })
    },
    // Applique murale : lumière douce et fixe.
    sconce: {
        markup: (o) => `
            <path d="M-6 0 L6 0 L4 -6 L-4 -6 Z" fill="#3a3226" stroke="#05060c" stroke-width="1"/>
            <ellipse cx="0" cy="-8.5" rx="4.5" ry="3" fill="${o.color || '#fde68a'}" opacity="0.8"/>`,
        light: (o) => ({ dx: 0, dy: -8, color: o.color || '#fbbf24', radius: o.radius || 36, flicker: false })
    },
    // Tuyau horizontal (ou vertical) avec manchons.
    pipe: {
        markup: (o, p) => {
            const length = o.length || 80;
            const color = o.color || p.pipe || '#2a2f3a';
            const joints = [];
            for (let t = 20; t < length; t += 40) {
                joints.push(o.vertical
                    ? `<rect x="-4" y="${t}" width="8" height="4" fill="${color}" stroke="#05060c" stroke-width="1"/>`
                    : `<rect x="${t}" y="-4" width="4" height="8" fill="${color}" stroke="#05060c" stroke-width="1"/>`);
            }
            const body = o.vertical
                ? `<rect x="-2.5" y="0" width="5" height="${length}" fill="${color}" stroke="#05060c" stroke-width="1"/>`
                : `<rect x="0" y="-2.5" width="${length}" height="5" fill="${color}" stroke="#05060c" stroke-width="1"/>`;
            return body + joints.join('');
        },
        light: () => null
    },
    // Panneau (plaque de rue, signalétique) : rectangle + texte.
    sign: {
        markup: (o) => {
            const w = o.w || 50;
            const h = o.h || 14;
            return `
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.5" fill="${o.bg || '#2b3140'}" stroke="#05060c" stroke-width="1.2"/>
            <text x="0" y="${o.fontSize ? o.fontSize / 3 : 2.8}" text-anchor="middle" font-size="${o.fontSize || 7.5}" font-weight="bold" fill="${o.fg || '#9ca3af'}">${o.text || ''}</text>`;
        },
        light: () => null
    },
    // Affiche à moitié déchirée.
    poster: {
        markup: (o) => {
            const w = o.w || 22;
            const h = o.h || 30;
            const lines = [];
            for (let i = 0; i < 3; i++) lines.push(`<rect x="${-w / 2 + 3}" y="${-h / 2 + 12 + i * 5}" width="${w - 8 - i * 3}" height="1.6" fill="#05060c" opacity="0.35"/>`);
            return `
            <path d="M${-w / 2} ${-h / 2} H${w / 2} V${h / 2 - 6} L${w / 2 - 5} ${h / 2} H${-w / 2} Z" fill="${o.color || '#4b4436'}" stroke="#05060c" stroke-width="1" opacity="0.75"/>
            <rect x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="6" fill="${o.accent || '#6b3a30'}" opacity="0.6"/>
            ${lines.join('')}`;
        },
        light: () => null
    }
};

// Petits débris au sol, positions fixes (jamais Math.random() : le décor doit être identique à chaque
// rendu, et les tests partagent le flux aléatoire du jeu). [x, y, rayon].
const BACKDROP_DEBRIS = [[18, 141, 1.6], [64, 147, 1.2], [131, 139, 1.4], [178, 146, 1.1], [207, 140, 1.7], [255, 147, 1.3], [344, 142, 1.5]];

// --- Fiches de décor -------------------------------------------------------------------------------
// Chaque fiche : palette, motif de mur, motif de sol, plafond, accessoires [{ type, x, y, ...opts }],
// débris (booléen). `default` s'applique à tout quartier sans fiche dédiée (clé = nom exact du
// quartier, voir districts.js).
const SCENE_BACKDROPS = {
    default: {
        label: 'Donjon',
        palette: {
            wall: '#1e222c', wallAlt: '#1a1d26', mortar: '#111319', ceiling: '#0e1016',
            floor: '#232837', floorAlt: '#1f2331', joint: '#13161e', pipe: '#2a2f3a'
        },
        wall: 'stone',
        floor: 'flagstones',
        ceiling: 'vault',
        debris: true,
        props: [
            { type: 'torch', x: 104, y: 64 },
            { type: 'torch', x: 236, y: 64, phase: 0.7 }
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BACKDROP_WIDTH, BACKDROP_HEIGHT, BACKDROP_GROUND_Y, BACKDROP_WALL_PATTERNS, BACKDROP_FLOOR_PATTERNS,
        BACKDROP_CEILINGS, BACKDROP_PROPS, BACKDROP_DEBRIS, SCENE_BACKDROPS
    };
}
