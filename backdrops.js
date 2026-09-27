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
    // Verrière de serre : grands carreaux sur un fouillis de tiges sombres.
    glass: (id, p) => `
        <pattern id="${id}" width="30" height="40" patternUnits="userSpaceOnUse">
            <rect width="30" height="40" fill="${p.wall}"/>
            <path d="M4 40 q7 -14 2 -27 M19 40 q-5 -11 4 -24" fill="none" stroke="${p.wallAlt}" stroke-width="3" stroke-linecap="round"/>
            <rect width="30" height="40" fill="none" stroke="${p.mortar}" stroke-width="2.5"/>
            <path d="M5 7 l7 -3" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
        </pattern>`,
    // Rayonnages de livres (quatre étagères sur la hauteur du mur).
    bookshelf: (id, p) => `
        <pattern id="${id}" width="44" height="31" patternUnits="userSpaceOnUse">
            <rect width="44" height="31" fill="${p.mortar}"/>
            <rect x="3" y="8" width="4" height="19" fill="${p.wall}"/>
            <rect x="7.5" y="11" width="3" height="16" fill="${p.bookA || p.wallAlt}"/>
            <rect x="11" y="7" width="5" height="20" fill="${p.wallAlt}"/>
            <rect x="16.5" y="10" width="3.5" height="17" fill="${p.bookB || p.wall}"/>
            <path d="M21 27 L27 12 L30 13 L24 27 Z" fill="${p.wall}"/>
            <rect x="31" y="9" width="4" height="18" fill="${p.bookA || p.wallAlt}"/>
            <rect x="35.5" y="12" width="3" height="15" fill="${p.wall}"/>
            <rect y="27" width="44" height="4" fill="${p.wallAlt}"/>
            <rect width="2" height="31" fill="${p.wallAlt}"/>
        </pattern>`,
    // Bureau administratif : lambris bas, cimaise, mur uni au-dessus (motif de la hauteur du mur).
    panels: (id, p) => `
        <pattern id="${id}" width="50" height="124" patternUnits="userSpaceOnUse">
            <rect width="50" height="124" fill="${p.wall}"/>
            <rect y="78" width="50" height="46" fill="${p.wallAlt}"/>
            <rect y="76" width="50" height="3" fill="${p.mortar}"/>
            <rect x="49" y="78" width="1" height="46" fill="${p.mortar}"/>
            <rect x="6" y="86" width="38" height="30" fill="none" stroke="${p.mortar}" stroke-width="1"/>
        </pattern>`,
    // Rideau de scène à plis verticaux.
    curtain: (id, p) => `
        <pattern id="${id}" width="20" height="40" patternUnits="userSpaceOnUse">
            <rect width="20" height="40" fill="${p.wall}"/>
            <rect x="0" width="6" height="40" fill="${p.wallAlt}"/>
            <rect x="11" width="2.5" height="40" fill="${p.mortar}"/>
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
        <path d="M60 3 v12 M170 3 v12 M280 3 v12" stroke="#05060c" stroke-width="2"/>`,
    // Verrière de serre : montants métalliques et vitres.
    glass: (p) => {
        const mullions = [];
        for (let x = 0; x <= 360; x += 30) mullions.push(`<path d="M${x} 0 V16" stroke="${p.mortar}" stroke-width="2"/>`);
        return `
        <rect x="0" y="0" width="360" height="16" fill="${p.ceiling}"/>
        ${mullions.join('')}
        <path d="M12 12 l10 -8 M132 12 l10 -8 M252 12 l10 -8" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
        <line x1="0" y1="16" x2="360" y2="16" stroke="#05060c" stroke-width="2"/>`;
    },
    // Faux plafond en dalles.
    panels: (p) => {
        const joints = [];
        for (let x = 30; x < 360; x += 30) joints.push(`<path d="M${x} 0 V12" stroke="${p.mortar}" stroke-width="1"/>`);
        return `
        <rect x="0" y="0" width="360" height="12" fill="${p.ceiling}"/>
        ${joints.join('')}
        <line x1="0" y1="12" x2="360" y2="12" stroke="#05060c" stroke-width="1.5"/>`;
    },
    // Ciel de nuit (rue) : quelques étoiles pâles.
    night: () => `
        <rect x="0" y="0" width="360" height="18" fill="#07080f"/>
        <circle cx="34" cy="6" r="0.8" fill="#cbd5e1" opacity="0.5"/>
        <circle cx="118" cy="11" r="0.7" fill="#cbd5e1" opacity="0.4"/>
        <circle cx="205" cy="5" r="0.9" fill="#cbd5e1" opacity="0.5"/>
        <circle cx="290" cy="9" r="0.7" fill="#cbd5e1" opacity="0.4"/>
        <path d="M330 4 a5 5 0 1 0 5 8 a4 4 0 1 1 -5 -8 Z" fill="#d6d3c4" opacity="0.35"/>`,
    // Bâches de marché à festons, deux tons.
    tarp: (p) => {
        const scallops = [];
        for (let x = 0; x < 360; x += 24) scallops.push(`<path d="M${x} 10 Q${x + 12} 20 ${x + 24} 10 Z" fill="${(x / 24) % 2 ? p.ceiling : p.tarpAlt || p.wallAlt}" stroke="#05060c" stroke-width="1"/>`);
        return `
        <rect x="0" y="0" width="360" height="10" fill="${p.ceiling}"/>
        ${scallops.join('')}`;
    },
    // Poutres de béton (parking, usine).
    girders: (p) => `
        <rect x="0" y="0" width="360" height="9" fill="${p.ceiling}"/>
        <rect x="0" y="9" width="360" height="3" fill="${p.mortar}"/>
        <rect x="40" y="9" width="16" height="9" fill="${p.ceiling}" stroke="#05060c" stroke-width="1"/>
        <rect x="170" y="9" width="16" height="9" fill="${p.ceiling}" stroke="#05060c" stroke-width="1"/>
        <rect x="300" y="9" width="16" height="9" fill="${p.ceiling}" stroke="#05060c" stroke-width="1"/>`,
    // Rampe d'éclairage de studio (treillis).
    rig: (p) => {
        const truss = [];
        for (let x = 0; x < 360; x += 12) truss.push(`L${x + 6} 11 L${x + 12} 5`);
        return `
        <rect x="0" y="0" width="360" height="5" fill="${p.ceiling}"/>
        <path d="M0 5 ${truss.join(' ')}" fill="none" stroke="${p.pipe}" stroke-width="1.2"/>
        <line x1="0" y1="11" x2="360" y2="11" stroke="${p.pipe}" stroke-width="1.5"/>`;
    }
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
    },

    // --- Signalétique, éclairages -------------------------------------------------------------------
    // Tube fluorescent nu (quai, bureau, parking) ; `flicker` pour un tube défaillant. Origine : centre.
    tubeLight: {
        markup: (o) => {
            const w = o.w || 50;
            return `
            <rect x="${-w / 2 - 3}" y="-3.5" width="${w + 6}" height="7" rx="2" fill="#1a1d24" stroke="#05060c" stroke-width="1"/>
            <rect class="${o.flicker ? 'bd-neon-flicker' : 'bd-tube'}"${backdropAnimDelay(o)} x="${-w / 2}" y="-1.5" width="${w}" height="3" rx="1.5" fill="${o.color || '#e0f2fe'}" opacity="0.7"/>`;
        },
        light: (o) => ({ dx: 0, dy: 6, color: o.color || '#e0f2fe', radius: o.radius || (o.w || 50), flicker: !!o.flicker })
    },
    // Plan de ligne délavé. Origine : centre.
    lineMap: {
        markup: (o) => {
            const w = o.w || 64;
            const h = o.h || 26;
            const stops = [-w / 2 + 6, -w / 2 + 18, -6, 6, 18, w / 2 - 6];
            return `
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.5" fill="#3a3c38" stroke="#05060c" stroke-width="1.2"/>
            <path d="M${-w / 2 + 6} 3 H-6 L6 -4 H${w / 2 - 6}" fill="none" stroke="${o.color || '#8a5a3a'}" stroke-width="2.2" opacity="0.7"/>
            ${stops.map((x, i) => `<circle cx="${x}" cy="${i < 3 ? 3 : -4}" r="1.6" fill="#b8b2a0"/>`).join('')}
            <rect x="${-w / 2 + 4}" y="${-h / 2 + 3}" width="${w / 3}" height="2" fill="#b8b2a0" opacity="0.5"/>`;
        },
        light: () => null
    },
    // Horloge murale. Origine : centre.
    clock: {
        markup: () => `
            <circle r="9" fill="#bdb8a6" opacity="0.5" stroke="#05060c" stroke-width="1.5"/>
            <path d="M0 0 V-6 M0 0 L4 2" stroke="#05060c" stroke-width="1.5" stroke-linecap="round"/>`,
        light: () => null
    },
    // Classeur métallique posé au sol. Origine : milieu du bas (au sol).
    cabinet: {
        markup: (o) => {
            const w = o.w || 22;
            const h = o.h || 44;
            const drawers = [];
            for (let i = 0; i < 4; i++) {
                const y = -h + 3 + i * ((h - 4) / 4);
                drawers.push(`<rect x="${-w / 2 + 2.5}" y="${y}" width="${w - 5}" height="${(h - 4) / 4 - 2}" fill="none" stroke="#05060c" stroke-width="0.8"/><rect x="-3" y="${y + 3}" width="6" height="1.6" fill="#05060c"/>`);
            }
            return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${o.color || '#343a37'}" stroke="#05060c" stroke-width="1.2"/>${drawers.join('')}`;
        },
        light: () => null
    },
    // Fenêtre à barreaux (lueur froide de l'extérieur). Origine : centre.
    barredWindow: {
        markup: (o) => {
            const w = o.w || 30;
            const h = o.h || 22;
            const bars = [];
            for (let x = -w / 2 + 6; x < w / 2; x += 6) bars.push(`<path d="M${x} ${-h / 2} V${h / 2}" stroke="#05060c" stroke-width="2"/>`);
            return `
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#1b2638" stroke="#05060c" stroke-width="2"/>
            ${bars.join('')}`;
        },
        light: () => ({ dx: 0, dy: 0, color: '#93c5fd', radius: 26, flicker: false })
    },

    // --- Industrie ----------------------------------------------------------------------------------
    // Tapis roulant au fond de la salle. Origine : extrémité gauche, hauteur du tapis ; `legs` : hauteur
    // des pieds jusqu'au sol.
    conveyor: {
        markup: (o) => {
            const length = o.length || 200;
            const legs = o.legs || 0;
            const parts = [];
            for (let x = 12; x < length; x += 26) parts.push(`<circle cx="${x}" cy="1" r="3" fill="#1f1e1b" stroke="#05060c" stroke-width="0.8"/>`);
            for (let x = 20; legs && x < length; x += 90) parts.push(`<rect x="${x}" y="5" width="4" height="${legs}" fill="#2a2925" stroke="#05060c" stroke-width="0.8"/>`);
            for (let x = 30; x < length; x += 70) parts.push(`<rect x="${x}" y="-9" width="14" height="6" rx="1" fill="#4a3f2c" stroke="#05060c" stroke-width="0.8"/>`);
            return `<rect x="0" y="-3" width="${length}" height="8" rx="3" fill="#2b2a26" stroke="#05060c" stroke-width="1.2"/>${parts.join('')}`;
        },
        light: () => null
    },
    // Crochet de boucherie suspendu. Origine : point d'accroche au plafond.
    hook: {
        markup: (o) => {
            const len = o.len || 26;
            return `<path d="M0 0 V${len} M0 ${len} q0 6 -4 6 q-3 0 -3 -3" fill="none" stroke="#6b6f75" stroke-width="1.6" stroke-linecap="round"/>`;
        },
        light: () => null
    },
    // Engrenage qui tourne lentement. Origine : centre ; `reverse` pour le sens inverse.
    gear: {
        markup: (o) => {
            const r = o.r || 16;
            const teeth = o.teeth || Math.max(8, Math.round(r / 2));
            const pts = [];
            for (let i = 0; i < teeth; i++) {
                const a = (i / teeth) * Math.PI * 2;
                const step = (Math.PI * 2) / teeth;
                [[a, r * 0.8], [a + step * 0.15, r], [a + step * 0.45, r], [a + step * 0.6, r * 0.8]].forEach(([ang, rad]) => {
                    pts.push(`${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`);
                });
            }
            return `
            <g class="bd-spin${o.reverse ? ' bd-spin-rev' : ''}">
                <polygon points="${pts.join(' ')}" fill="${o.color || '#3a3630'}" stroke="#05060c" stroke-width="1.2"/>
                <circle r="${(r * 0.35).toFixed(1)}" fill="#1c1a17" stroke="#05060c" stroke-width="1"/>
            </g>`;
        },
        light: () => null
    },
    // Manomètre. Origine : centre.
    gauge: {
        markup: (o) => `
            <rect x="-2" y="7" width="4" height="8" fill="#3a3630" stroke="#05060c" stroke-width="0.8"/>
            <circle r="7.5" fill="#b8b09a" opacity="0.5" stroke="#05060c" stroke-width="1.5"/>
            <path d="M0 0 L${o.needle === 'high' ? '4 -4' : '-4 -3'}" stroke="#7f1d1d" stroke-width="1.4" stroke-linecap="round"/>`,
        light: () => null
    },
    // Voyant rouge qui clignote. Origine : centre.
    redLight: {
        markup: (o) => `
            <circle r="3.5" fill="#3b1111" stroke="#05060c" stroke-width="1"/>
            <circle class="bd-blink"${backdropAnimDelay(o)} r="2.2" fill="#dc2626"/>`,
        light: () => ({ dx: 0, dy: 0, color: '#ef4444', radius: 14, flicker: true })
    },
    // Bouffées de vapeur au-dessus d'une bouche au sol. Origine : la bouche (au sol).
    steam: {
        markup: () => `
            <rect x="-7" y="-2" width="14" height="3" fill="#1c1d20" stroke="#05060c" stroke-width="0.8"/>
            <circle class="bd-steam" cx="0" cy="-8" r="5" fill="#cbd5e1"/>
            <circle class="bd-steam" style="animation-delay:-1.1s" cx="-3" cy="-8" r="4" fill="#cbd5e1"/>
            <circle class="bd-steam" style="animation-delay:-2.2s" cx="3" cy="-8" r="4.5" fill="#cbd5e1"/>`,
        light: () => null
    },

    // --- Savoir, magie, science ---------------------------------------------------------------------
    // Livre qui flotte. Origine : centre.
    floatingBook: {
        markup: (o) => `
            <g class="bd-float"${backdropAnimDelay(o)}>
                <path d="M-8 0 L0 -3 L8 0 L8 5 L0 2 L-8 5 Z" fill="${o.color || '#4a3328'}" stroke="#05060c" stroke-width="1"/>
                <path d="M0 -3 V2" stroke="#05060c" stroke-width="0.8"/>
            </g>`,
        light: () => null
    },
    // Chandelier suspendu à trois bougies. Origine : point d'accroche au plafond.
    chandelier: {
        markup: (o) => {
            const len = o.len || 14;
            const candles = [-12, 0, 12].map((x, i) => `
                <rect x="${x - 1.5}" y="${len - 1}" width="3" height="5" fill="#d6cfb8"/>
                <path class="bd-flame" style="animation-delay:-${(i * 0.4 + (o.phase || 0)).toFixed(1)}s" d="M${x} ${len - 7} C${x + 2} ${len - 4} ${x + 2} ${len - 2} ${x} ${len - 1} C${x - 2} ${len - 2} ${x - 2} ${len - 4} ${x} ${len - 7} Z" fill="#fcd34d"/>`).join('');
            return `
            <path d="M0 0 V${len}" stroke="#4a3f2c" stroke-width="1.2"/>
            <path d="M-14 ${len + 4} Q0 ${len + 10} 14 ${len + 4}" fill="none" stroke="#6b5a3a" stroke-width="2"/>
            ${candles}`;
        },
        light: (o) => ({ dx: 0, dy: (o.len || 14), color: '#fbbf24', radius: 46, flicker: true })
    },
    // Poussière en suspension. Origine : centre de la zone ; `w` : largeur.
    dust: {
        markup: (o) => {
            const w = o.w || 120;
            const motes = [[-0.45, -8], [-0.3, 6], [-0.12, -2], [0.05, 9], [0.2, -6], [0.36, 3], [0.46, -10]];
            return `<g class="bd-dust"${backdropAnimDelay(o)}>${motes.map(([fx, y]) => `<circle cx="${(fx * w).toFixed(1)}" cy="${y}" r="0.9" fill="#e5e0cf" opacity="0.35"/>`).join('')}</g>`;
        },
        light: () => null
    },
    // Étagère murale. Origine : extrémité gauche.
    shelf: {
        markup: (o) => {
            const len = o.length || 50;
            return `
            <rect x="0" y="0" width="${len}" height="3" fill="#3b2f22" stroke="#05060c" stroke-width="1"/>
            <path d="M6 3 l0 6 l6 -6 M${len - 6} 3 l0 6 l-6 -6" fill="none" stroke="#05060c" stroke-width="1"/>`;
        },
        light: () => null
    },
    // Bocal au liquide luminescent. Origine : milieu du fond (posé sur une étagère).
    jar: {
        markup: (o) => `
            <rect x="-5" y="-14" width="10" height="14" rx="2" fill="#0f1720" stroke="#05060c" stroke-width="1"/>
            <rect x="-4" y="-9" width="8" height="8" rx="1" fill="${o.color || '#4ade80'}" opacity="0.65"/>
            <rect x="-4.5" y="-16" width="9" height="2.5" fill="#3a3a3a" stroke="#05060c" stroke-width="0.6"/>`,
        light: (o) => ({ dx: 0, dy: -6, color: o.color || '#4ade80', radius: 20, flicker: false })
    },
    // Tableau noir couvert d'équations. Origine : centre.
    equationBoard: {
        markup: (o) => {
            const w = o.w || 90;
            const h = o.h || 40;
            return `
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#1c2621" stroke="#4a3a24" stroke-width="3"/>
            <g fill="#cfd8cc" opacity="0.5" font-size="6.5">
                <text x="${-w / 2 + 6}" y="${-h / 2 + 10}">E=mc²+?</text>
                <text x="${-w / 2 + 10}" y="${-h / 2 + 21}">∫f(x)dx≠√-1</text>
                <text x="${-w / 2 + 6}" y="${-h / 2 + 32}">π≈3,2 !!</text>
            </g>
            <path d="M${w / 2 - 30} ${-h / 2 + 8} q8 10 -2 18 t10 8" fill="none" stroke="#cfd8cc" stroke-width="0.8" opacity="0.45"/>`;
        },
        light: () => null
    },
    // Bobine électrique qui crépite. Origine : milieu du bas (au sol).
    teslaCoil: {
        markup: () => `
            <rect x="-8" y="-6" width="16" height="6" fill="#2b2e35" stroke="#05060c" stroke-width="1"/>
            <rect x="-4" y="-34" width="8" height="28" fill="#6b4f2a" stroke="#05060c" stroke-width="1"/>
            <path d="M-4 -30 h8 M-4 -25 h8 M-4 -20 h8 M-4 -15 h8 M-4 -10 h8" stroke="#3b2c18" stroke-width="1"/>
            <circle cy="-40" r="7" fill="#3a3f4a" stroke="#05060c" stroke-width="1.2"/>
            <path class="bd-crackle" d="M5 -44 l7 -4 l-3 5 l8 -3 M-5 -45 l-6 -5 l1 5 l-7 -2" fill="none" stroke="#c4b5fd" stroke-width="1.3" stroke-linecap="round"/>`,
        light: () => ({ dx: 0, dy: -40, color: '#a78bfa', radius: 34, flicker: true })
    },

    // --- Rue, marché ------------------------------------------------------------------------------------
    // Lampadaire. Origine : pied (au sol).
    streetLamp: {
        markup: () => `
            <rect x="-2" y="-72" width="4" height="72" fill="#22252c" stroke="#05060c" stroke-width="1"/>
            <path d="M0 -70 Q0 -76 10 -76" fill="none" stroke="#22252c" stroke-width="3"/>
            <path d="M5 -76 L15 -76 L13 -70 L7 -70 Z" fill="#2b2e35" stroke="#05060c" stroke-width="1"/>
            <ellipse cx="10" cy="-69" rx="3" ry="1.8" fill="#fde68a" opacity="0.85"/>`,
        light: () => ({ dx: 10, dy: -64, color: '#fbbf24', radius: 42, flicker: false })
    },
    // Façade d'immeuble légèrement déformée (illusion). Origine : milieu du bas ; `skew` en degrés.
    facade: {
        markup: (o) => {
            const w = o.w || 70;
            const h = o.h || 96;
            const windows = [];
            let i = 0;
            for (let y = -h + 10; y < -18; y += 22) {
                for (let x = -w / 2 + 8; x < w / 2 - 12; x += 20) {
                    const lit = (i * 7 + 3) % 5 === 0;
                    windows.push(`<rect x="${x}" y="${y}" width="12" height="13" fill="${lit ? '#e8c46a' : '#0b0d14'}" opacity="${lit ? 0.35 : 0.9}" stroke="#05060c" stroke-width="0.8"/>`);
                    i++;
                }
            }
            return `
            <g transform="skewX(${o.skew || 0})">
                <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${o.color || '#2b2433'}" stroke="#05060c" stroke-width="1.2"/>
                <rect x="${-w / 2 - 3}" y="${-h - 4}" width="${w + 6}" height="5" fill="#05060c" opacity="0.6"/>
                ${windows.join('')}
            </g>`;
        },
        light: () => null
    },
    // Nappe de brume au ras du sol. Origine : centre ; `w` : largeur.
    mist: {
        markup: (o) => {
            const w = o.w || 360;
            return `
            <g class="bd-mist">
                <ellipse cx="0" cy="0" rx="${w / 2}" ry="7" fill="#cbd5e1" opacity="0.07"/>
                <ellipse cx="${w * 0.15}" cy="-4" rx="${w / 3}" ry="5" fill="#cbd5e1" opacity="0.06"/>
            </g>`;
        },
        light: () => null
    },
    // Étal bâché. Origine : milieu du bas (au sol).
    stall: {
        markup: (o) => {
            const w = o.w || 80;
            const stripes = [];
            for (let x = -w / 2; x < w / 2; x += 10) stripes.push(`<rect x="${x}" y="-56" width="5" height="8" fill="${o.stripe || '#3b2020'}"/>`);
            return `
            <rect x="${-w / 2 + 3}" y="-54" width="3" height="54" fill="#2a2320" stroke="#05060c" stroke-width="0.8"/>
            <rect x="${w / 2 - 6}" y="-54" width="3" height="54" fill="#2a2320" stroke="#05060c" stroke-width="0.8"/>
            <rect x="${-w / 2}" y="-56" width="${w}" height="8" fill="${o.color || '#4a3a2a'}" stroke="#05060c" stroke-width="1"/>
            ${stripes.join('')}
            <rect x="${-w / 2}" y="-22" width="${w}" height="4" fill="#3b2f22" stroke="#05060c" stroke-width="1"/>
            <rect x="${-w / 2 + 2}" y="-18" width="${w - 4}" height="18" fill="${o.cloth || '#2e2626'}" stroke="#05060c" stroke-width="0.8"/>
            <rect x="${-w / 2 + 8}" y="-29" width="10" height="7" fill="#5a4a34" stroke="#05060c" stroke-width="0.8"/>
            <circle cx="${w / 2 - 16}" cy="-25" r="3.5" fill="#6b5a2a" stroke="#05060c" stroke-width="0.8"/>`;
        },
        light: () => null
    },
    // Lampion de papier suspendu. Origine : point d'accroche.
    lantern: {
        markup: (o) => {
            const len = o.len || 10;
            return `
            <path d="M0 0 V${len}" stroke="#4a3f2c" stroke-width="0.8"/>
            <rect x="-2.5" y="${len}" width="5" height="2" fill="#2a2320"/>
            <ellipse cx="0" cy="${len + 9}" rx="5.5" ry="7" fill="${o.color || '#c2410c'}" opacity="0.75" stroke="#05060c" stroke-width="0.8"/>
            <rect x="-2.5" y="${len + 15.5}" width="5" height="2" fill="#2a2320"/>`;
        },
        light: (o) => ({ dx: 0, dy: (o.len || 10) + 9, color: o.color || '#f97316', radius: 30, flicker: true })
    },
    // Caisse en bois. Origine : milieu du bas (au sol).
    crate: {
        markup: (o) => {
            const w = o.w || 22;
            const h = o.h || 18;
            return `
            <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="#4a3a24" stroke="#05060c" stroke-width="1.2"/>
            <path d="M${-w / 2} ${-h} L${w / 2} 0 M${-w / 2} ${-h / 2} H${w / 2}" stroke="#2a2016" stroke-width="1.2"/>`;
        },
        light: () => null
    },

    // --- Catacombes -------------------------------------------------------------------------------------
    // Niche creusée dans la pierre, remplie de chaussettes orphelines. Origine : centre.
    sockNiche: {
        markup: (o) => {
            const colors = o.colors || ['#5a4a6b', '#6b3a30', '#3a5a6b', '#6b6040'];
            const socks = colors.map((c, i) => `<path d="M${-9 + i * 5} ${-2 + (i % 2) * 2} v7 q0 3 3 3 h4 v-3 h-3 v-7 Z" fill="${c}" opacity="0.7" stroke="#05060c" stroke-width="0.6"/>`).join('');
            return `
            <path d="M-13 12 V-2 Q-13 -13 0 -13 Q13 -13 13 -2 V12 Z" fill="#0d0c10" stroke="#05060c" stroke-width="1.5"/>
            ${socks}`;
        },
        light: () => null
    },
    // Fil à linge tendu, chaussettes accrochées. Origine : extrémité gauche.
    clothesline: {
        markup: (o) => {
            const len = o.length || 200;
            const colors = ['#5a4a6b', '#6b3a30', '#3a5a6b', '#6b6040', '#4a5b3a'];
            const socks = [];
            let i = 0;
            for (let x = 22; x < len - 10; x += 38) {
                const t = x / len;
                const y = 4 * 8 * t * (1 - t);
                socks.push(`<path d="M${x} ${(y + 1).toFixed(1)} v8 q0 3 3 3 h4 v-3 h-3 v-8 Z" fill="${colors[i % colors.length]}" opacity="0.65" stroke="#05060c" stroke-width="0.6"/>`);
                i++;
            }
            return `<path d="M0 0 Q${len / 2} 16 ${len} 0" fill="none" stroke="#6b6f75" stroke-width="0.8"/>${socks.join('')}`;
        },
        light: () => null
    },

    // --- Parking --------------------------------------------------------------------------------------
    // Pilier de béton, bande rayée jaune/noir en pied. Origine : milieu du bas (au sol).
    stripedPillar: {
        markup: (o) => {
            const w = o.w || 18;
            const h = o.h || 110;
            const stripes = [];
            for (let i = 0; i < 5; i++) stripes.push(`<rect x="${-w / 2}" y="${-34 + i * 6}" width="${w}" height="3" fill="#8a7424" opacity="0.8"/>`);
            return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${o.color || '#34363a'}" stroke="#05060c" stroke-width="1.2"/><rect x="${-w / 2}" y="-34" width="${w}" height="30" fill="#141414"/>${stripes.join('')}`;
        },
        light: () => null
    },
    // Numéro de place peint sur le mur. Origine : centre.
    bayNumber: {
        markup: (o) => `
            <text x="0" y="6" text-anchor="middle" font-size="17" font-weight="bold" fill="#a3a3a3" opacity="0.35">${o.text || 'P'}</text>
            <rect x="-12" y="10" width="24" height="2" fill="#a3a3a3" opacity="0.3"/>`,
        light: () => null
    },
    // Flèche peinte au sol. Origine : centre (au sol).
    floorArrow: {
        markup: (o) => `<path d="M${o.reverse ? '18 -3 H-6 V-7 L-18 0 L-6 7 V3 H18 Z' : '-18 -3 H6 V-7 L18 0 L6 7 V3 H-18 Z'}" transform="scale(1 0.55)" fill="#d4d4d4" opacity="0.22"/>`,
        light: () => null
    },
    // Bande peinte au sol (bord de quai, marquage). Origine : extrémité gauche (au sol).
    floorStripe: {
        markup: (o) => `<rect x="0" y="0" width="${o.length || 360}" height="${o.h || 2}" fill="${o.color || '#a38a2a'}" opacity="0.45"/>`,
        light: () => null
    },
    // Voie ferrée (rails + traverses) vue de profil. Origine : extrémité gauche (au sol).
    rails: {
        markup: (o) => {
            const len = o.length || 360;
            const sleepers = [];
            for (let x = 4; x < len; x += 16) sleepers.push(`<rect x="${x}" y="1" width="7" height="3" fill="#2a2320"/>`);
            return `${sleepers.join('')}<rect x="0" y="-1" width="${len}" height="2" fill="#6b6f75" opacity="0.8"/><rect x="0" y="8" width="${len}" height="2" fill="#6b6f75" opacity="0.6"/>`;
        },
        light: () => null
    },

    // --- Piscine ----------------------------------------------------------------------------------------
    // Échelle de bassin. Origine : bord du bassin (au sol).
    poolLadder: {
        markup: () => `
            <path d="M-8 0 V-26 Q-8 -34 0 -34 Q6 -34 6 -28" fill="none" stroke="#9ca3af" stroke-width="2" opacity="0.6"/>
            <path d="M2 0 V-26 Q2 -34 10 -34 Q16 -34 16 -28" fill="none" stroke="#9ca3af" stroke-width="2" opacity="0.6"/>
            <path d="M-8 -8 H2 M-8 -17 H2" stroke="#9ca3af" stroke-width="1.5" opacity="0.5"/>`,
        light: () => null
    },
    // Plongeoir. Origine : pied du support (au sol).
    divingBoard: {
        markup: () => `
            <rect x="-4" y="-30" width="8" height="30" fill="#3a3f46" stroke="#05060c" stroke-width="1"/>
            <rect x="-34" y="-33" width="50" height="3.5" rx="1" fill="#b8b09a" opacity="0.55" stroke="#05060c" stroke-width="0.8"/>`,
        light: () => null
    },
    // Reflets d'eau ondulant sur le mur. Origine : centre ; `w` : largeur.
    caustics: {
        markup: (o) => {
            const w = o.w || 300;
            const lines = [-12, -4, 5, 13].map((y, i) => {
                const segs = [];
                for (let x = -w / 2; x < w / 2; x += 30) segs.push(`q7 ${i % 2 ? -4 : 4} 15 0 t15 0`);
                return `<path d="M${-w / 2} ${y} ${segs.join(' ')}" fill="none" stroke="#7dd3fc" stroke-width="1.4" opacity="0.16"/>`;
            });
            return `<g class="bd-ripple">${lines.join('')}</g>`;
        },
        light: () => null
    },

    // --- Studio -------------------------------------------------------------------------------------------
    // Projecteur accroché à la rampe, faisceau vers le bas. Origine : point d'accroche.
    spotlight: {
        markup: (o) => {
            const dir = o.reverse ? -1 : 1;
            return `
            <path d="M0 0 V6" stroke="#22252c" stroke-width="2"/>
            <path d="M${dir * 4} 12 L${dir * 60} 110 L${dir * 10} 110 Z" fill="#fef9c3" opacity="0.05"/>
            <rect x="-6" y="5" width="12" height="9" rx="2" fill="#2b2e35" stroke="#05060c" stroke-width="1" transform="rotate(${dir * 30} 0 9)"/>`;
        },
        light: (o) => ({ dx: (o.reverse ? -1 : 1) * 30, dy: 70, color: '#fef3c7', radius: 38, flicker: false })
    },
    // Décor de plateau en carton (soleil couchant + palmier). Origine : milieu du bas (au sol).
    cardboardSet: {
        markup: () => `
            <path d="M-4 0 L-14 -40 M4 0 L14 -40" stroke="#3b2f22" stroke-width="2"/>
            <rect x="-30" y="-62" width="60" height="50" fill="#5a4636" opacity="0.7" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-18 -12 a18 18 0 0 1 36 0 Z" fill="#8a5a2a" opacity="0.6"/>
            <path d="M8 -12 Q10 -34 6 -46 M6 -46 q-10 -2 -16 6 M6 -46 q9 -4 15 4 M6 -46 q-2 -8 -10 -10" fill="none" stroke="#2f3a22" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`,
        light: () => null
    },
    // Caméra de plateau sur trépied, voyant rouge. Origine : milieu du bas (au sol).
    tvCamera: {
        markup: () => `
            <path d="M0 -34 L-11 0 M0 -34 L11 0 M0 -34 V0" stroke="#2b2e35" stroke-width="2"/>
            <rect x="-10" y="-46" width="22" height="13" rx="2" fill="#2b2e35" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-17" y="-43" width="8" height="7" fill="#1c1e23" stroke="#05060c" stroke-width="1"/>
            <circle class="bd-blink" cx="8" cy="-42" r="1.6" fill="#dc2626"/>`,
        light: () => null
    },

    // --- Serre ------------------------------------------------------------------------------------------
    // Plante à mâchoires, en arrière-plan. Origine : pied (au sol).
    jawPlant: {
        markup: (o) => {
            const h = o.h || 50;
            return `
            <path d="M0 0 Q-6 ${-h / 2} 4 ${-h}" fill="none" stroke="#1f3a24" stroke-width="4" stroke-linecap="round"/>
            <path d="M4 ${-h} q-14 -4 -14 -14 q10 -2 16 8 Z" fill="#26442c" stroke="#05060c" stroke-width="1"/>
            <path d="M4 ${-h} q14 -4 14 -14 q-10 -2 -16 8 Z" fill="#2c4d31" stroke="#05060c" stroke-width="1"/>
            <path d="M-6 ${-h - 12} l2 3 l2 -3 l2 3 M8 ${-h - 12} l2 3 l2 -3 l2 3" fill="none" stroke="#d6d3c4" stroke-width="0.8" opacity="0.5"/>`;
        },
        light: () => null
    },
    // Liane qui pend du plafond. Origine : point d'accroche.
    vine: {
        markup: (o) => {
            const len = o.len || 50;
            const leaves = [];
            for (let y = 10; y < len; y += 12) leaves.push(`<ellipse cx="${(y / 12) % 2 ? 4 : -4}" cy="${y}" rx="4" ry="2" fill="#2a4a30" transform="rotate(${(y / 12) % 2 ? 30 : -30} ${(y / 12) % 2 ? 4 : -4} ${y})"/>`);
            return `<path d="M0 0 q6 ${len / 4} 0 ${len / 2} t0 ${len / 2}" fill="none" stroke="#1f3a24" stroke-width="2.5"/>${leaves.join('')}`;
        },
        light: () => null
    },
    // Rai de lumière filtrée tombant de la verrière. Origine : point haut.
    lightShaft: {
        markup: (o) => `<path d="M-10 0 L10 0 L46 108 L-20 108 Z" fill="${o.color || '#86efac'}" opacity="0.06"/>`,
        light: (o) => ({ dx: 14, dy: 70, color: o.color || '#86efac', radius: 44, flicker: false })
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
    },

    "Tunnels de Métro Abandonnés": {
        label: 'Quai de métro',
        palette: {
            wall: '#393c37', wallAlt: '#33362f', mortar: '#1c1e1a', ceiling: '#121412',
            floor: '#26282a', floorAlt: '#222426', joint: '#151617', pipe: '#2b2f33'
        },
        wall: 'tiles', floor: 'concrete', ceiling: 'pipes', debris: true,
        props: [
            { type: 'sign', x: 184, y: 32, text: 'STATION OUBLI', w: 86, h: 13, bg: '#1e3350', fg: '#b8c4d4' },
            { type: 'lineMap', x: 72, y: 66, w: 62, h: 26, color: '#9a4a3a' },
            { type: 'tubeLight', x: 96, y: 21, w: 52, flicker: true },
            { type: 'tubeLight', x: 286, y: 21, w: 52, phase: 2 },
            { type: 'poster', x: 262, y: 74, w: 20, h: 28, color: '#4a4436', accent: '#1e3350' }
        ],
        floorProps: [
            { type: 'floorStripe', x: 0, y: 125.5, length: 360, color: '#a38a2a' },
            { type: 'rails', x: 0, y: 146, length: 360 }
        ]
    },

    "Jardins Carnivores": {
        label: 'Serre',
        palette: {
            wall: '#1b2a21', wallAlt: '#223428', mortar: '#0f1812', ceiling: '#16241b',
            floor: '#2b2519', floorAlt: '#262116', joint: '#15120c', pipe: '#2a3a2e'
        },
        wall: 'glass', floor: 'planks', ceiling: 'glass', debris: true,
        props: [
            { type: 'lightShaft', x: 150, y: 16 },
            { type: 'jawPlant', x: 92, y: 124, h: 34 },
            { type: 'jawPlant', x: 232, y: 124, h: 48 },
            { type: 'vine', x: 40, y: 16, len: 56 },
            { type: 'vine', x: 322, y: 16, len: 40 }
        ]
    },

    "Bureaux de l'Administration Pénitentiaire": {
        label: 'Bureaux',
        palette: {
            wall: '#2c3531', wallAlt: '#242c28', mortar: '#151a17', ceiling: '#1a1e1c',
            floor: '#2a2b27', floorAlt: '#262723', joint: '#161714', pipe: '#2e3431'
        },
        wall: 'panels', floor: 'tiles', ceiling: 'panels', debris: false,
        props: [
            { type: 'tubeLight', x: 108, y: 19, w: 54, color: '#e2f0e6', flicker: true },
            { type: 'tubeLight', x: 262, y: 19, w: 54, color: '#e2f0e6' },
            { type: 'barredWindow', x: 58, y: 50 },
            { type: 'clock', x: 186, y: 40 },
            { type: 'sign', x: 262, y: 54, text: 'ACCÈS RÉSERVÉ', w: 68, bg: '#4a1d1d', fg: '#cbbf9f' },
            { type: 'cabinet', x: 150, y: 124, w: 22, h: 40 }
        ]
    },

    "Usine de Transformation Alimentaire": {
        label: 'Usine',
        palette: {
            wall: '#34322a', wallAlt: '#2e2c25', mortar: '#1a1914', ceiling: '#15140f',
            floor: '#262624', floorAlt: '#222220', joint: '#131312', pipe: '#34363a'
        },
        wall: 'tiles', floor: 'grating', ceiling: 'girders', debris: false,
        props: [
            { type: 'conveyor', x: 0, y: 44, length: 360, legs: 75 },
            { type: 'hook', x: 70, y: 12, len: 20 },
            { type: 'hook', x: 104, y: 12, len: 14 },
            { type: 'hook', x: 138, y: 12, len: 22 },
            { type: 'tubeLight', x: 256, y: 22, w: 50, color: '#fef3c7' }
        ],
        floorProps: [
            { type: 'steam', x: 206, y: 125 },
            { type: 'steam', x: 36, y: 125 }
        ]
    },

    "Bibliothèque des Oubliés": {
        label: 'Bibliothèque',
        palette: {
            wall: '#33261a', wallAlt: '#2a1f15', mortar: '#150f0a', ceiling: '#1a120c',
            floor: '#2b2118', floorAlt: '#261d15', joint: '#140e0a', pipe: '#3a2c1f',
            bookA: '#33202b', bookB: '#1d2833'
        },
        wall: 'bookshelf', floor: 'planks', ceiling: 'beams', debris: false,
        props: [
            { type: 'chandelier', x: 110, y: 14 },
            { type: 'chandelier', x: 262, y: 14, phase: 0.6 },
            { type: 'floatingBook', x: 58, y: 52 },
            { type: 'floatingBook', x: 190, y: 42, phase: 1.2, color: '#2f3d4a' },
            { type: 'floatingBook', x: 322, y: 58, phase: 2 },
            { type: 'dust', x: 180, y: 84, w: 220 }
        ]
    },

    "Laboratoire de Fous": {
        label: 'Laboratoire',
        palette: {
            wall: '#262c2f', wallAlt: '#20262a', mortar: '#12171a', ceiling: '#121618',
            floor: '#24292b', floorAlt: '#1f2426', joint: '#121518', pipe: '#2c3438'
        },
        wall: 'tiles', floor: 'tiles', ceiling: 'pipes', debris: false,
        props: [
            { type: 'shelf', x: 28, y: 68, length: 78 },
            { type: 'jar', x: 44, y: 68, color: '#4ade80' },
            { type: 'jar', x: 66, y: 68, color: '#c084fc' },
            { type: 'jar', x: 88, y: 68, color: '#22d3ee' },
            { type: 'equationBoard', x: 190, y: 54 },
            { type: 'teslaCoil', x: 252, y: 124 }
        ]
    },

    "Rue des Illusions": {
        label: 'Rue',
        palette: {
            wall: '#221c2a', wallAlt: '#1d1824', mortar: '#110e15', ceiling: '#07080f',
            floor: '#27242d', floorAlt: '#222029', joint: '#141218', pipe: '#2a2530'
        },
        wall: 'bricks', floor: 'cobbles', ceiling: 'night', debris: true,
        props: [
            { type: 'facade', x: 72, y: 124, w: 86, h: 100, skew: 6, color: '#2b2336' },
            { type: 'facade', x: 252, y: 124, w: 92, h: 92, skew: -5, color: '#262032' },
            { type: 'streetLamp', x: 158, y: 124 },
            { type: 'streetLamp', x: 338, y: 124 }
        ],
        floorProps: [
            { type: 'mist', x: 180, y: 130, w: 380 }
        ]
    },

    "Catacombes des Chaussettes Perdues": {
        label: 'Catacombes',
        palette: {
            wall: '#2a2622', wallAlt: '#24211d', mortar: '#12100e', ceiling: '#100e0c',
            floor: '#26221e', floorAlt: '#221f1b', joint: '#12100e', pipe: '#2a2622'
        },
        wall: 'stone', floor: 'flagstones', ceiling: 'vault', debris: true,
        props: [
            { type: 'clothesline', x: 8, y: 24, length: 344 },
            { type: 'sockNiche', x: 60, y: 70 },
            { type: 'sockNiche', x: 170, y: 66, colors: ['#3a5a6b', '#6b6040', '#5a4a6b'] },
            { type: 'sockNiche', x: 272, y: 72, colors: ['#6b3a30', '#4a5b3a', '#6b6040', '#3a5a6b'] },
            { type: 'torch', x: 116, y: 74 },
            { type: 'torch', x: 222, y: 74, phase: 0.5 }
        ]
    },

    "Marché Noir du Donjon": {
        label: 'Marché noir',
        palette: {
            wall: '#2a2118', wallAlt: '#241c14', mortar: '#120e09', ceiling: '#3a2622', tarpAlt: '#262a38',
            floor: '#2a241e', floorAlt: '#26201b', joint: '#140f0b', pipe: '#2e261d'
        },
        wall: 'wood', floor: 'cobbles', ceiling: 'tarp', debris: true,
        props: [
            { type: 'stall', x: 82, y: 124, w: 90, color: '#4a2f2a', stripe: '#2f3d4a' },
            { type: 'sign', x: 208, y: 46, text: 'PAS CHER !!', w: 56, bg: '#3b2f1d', fg: '#cfae66' },
            { type: 'lantern', x: 30, y: 16, len: 6, color: '#c2410c' },
            { type: 'lantern', x: 160, y: 16, len: 12, color: '#b91c1c', phase: 0.8 },
            { type: 'lantern', x: 296, y: 16, len: 4, color: '#d97706', phase: 1.5 },
            { type: 'crate', x: 214, y: 124 },
            { type: 'crate', x: 238, y: 124, w: 18, h: 14 }
        ]
    },

    "Salle des Machines Infernales": {
        label: 'Salle des machines',
        palette: {
            wall: '#2f2a25', wallAlt: '#3a332b', mortar: '#161310', ceiling: '#141210',
            floor: '#26231f', floorAlt: '#221f1b', joint: '#12100d', pipe: '#3a342c'
        },
        wall: 'sheetMetal', floor: 'grating', ceiling: 'pipes', debris: false,
        props: [
            { type: 'gear', x: 62, y: 60, r: 22 },
            { type: 'gear', x: 95, y: 36, r: 13, reverse: true },
            { type: 'gauge', x: 182, y: 46 },
            { type: 'gauge', x: 206, y: 46, needle: 'high' },
            { type: 'redLight', x: 150, y: 30 },
            { type: 'redLight', x: 262, y: 30, phase: 0.8 },
            { type: 'pipe', x: 230, y: 86, length: 120 }
        ],
        floorProps: [
            { type: 'steam', x: 122, y: 125 }
        ]
    },

    "Parking Souterrain Maudit": {
        label: 'Parking',
        palette: {
            wall: '#2c2e30', wallAlt: '#27292b', mortar: '#17181a', ceiling: '#18191b',
            floor: '#27292b', floorAlt: '#232527', joint: '#151617', pipe: '#2c2f33'
        },
        wall: 'concrete', floor: 'concrete', ceiling: 'girders', debris: true,
        props: [
            { type: 'stripedPillar', x: 36, y: 124, h: 112 },
            { type: 'stripedPillar', x: 236, y: 124, h: 112 },
            { type: 'bayNumber', x: 104, y: 62, text: 'B12' },
            { type: 'bayNumber', x: 170, y: 62, text: 'B13' },
            { type: 'tubeLight', x: 140, y: 21, w: 56, color: '#dbeafe', flicker: true }
        ],
        floorProps: [
            { type: 'floorArrow', x: 60, y: 141 },
            { type: 'floorArrow', x: 200, y: 141 }
        ]
    },

    "Piscine Municipale Désaffectée": {
        label: 'Piscine',
        palette: {
            wall: '#1f3441', wallAlt: '#1b2e3a', mortar: '#11202a', ceiling: '#121c24',
            floor: '#223440', floorAlt: '#1e2f3a', joint: '#122029', pipe: '#2a3a45'
        },
        wall: 'tiles', floor: 'tiles', ceiling: 'girders', debris: false,
        props: [
            { type: 'caustics', x: 180, y: 58, w: 360 },
            { type: 'sign', x: 150, y: 32, text: 'PROFONDEUR 2 M', w: 72, bg: '#1d3b4a', fg: '#9fb8c4' },
            { type: 'poolLadder', x: 68, y: 124 },
            { type: 'divingBoard', x: 226, y: 124 },
            { type: 'tubeLight', x: 300, y: 21, w: 50, color: '#bae6fd' }
        ]
    },

    "Studio de Télé-Achat Abandonné": {
        label: 'Studio TV',
        palette: {
            wall: '#261c22', wallAlt: '#1f171c', mortar: '#130d11', ceiling: '#0e0c0e',
            floor: '#221e20', floorAlt: '#1e1a1c', joint: '#120f11', pipe: '#3a3a40'
        },
        wall: 'curtain', floor: 'planks', ceiling: 'rig', debris: false,
        props: [
            { type: 'neon', x: 180, y: 34, text: 'ON AIR', w: 62, color: '#f43f5e', flicker: true },
            { type: 'spotlight', x: 58, y: 11 },
            { type: 'spotlight', x: 302, y: 11, reverse: true },
            { type: 'cardboardSet', x: 108, y: 124 },
            { type: 'tvCamera', x: 252, y: 124 }
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BACKDROP_WIDTH, BACKDROP_HEIGHT, BACKDROP_GROUND_Y, BACKDROP_WALL_PATTERNS, BACKDROP_FLOOR_PATTERNS,
        BACKDROP_CEILINGS, BACKDROP_PROPS, BACKDROP_DEBRIS, SCENE_BACKDROPS
    };
}
