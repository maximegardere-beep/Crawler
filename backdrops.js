// backdrops.js - Décors des scènes (combat, puis boutiques/salles sécurisées). Catalogue pur, sur le
// modèle de sprites/*.js : aucun DOM, aucun gameState. Uniquement des générateurs de chaînes SVG et des
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
        </pattern>`,
    // Obsidienne de l'antre de Gorgoth (chantier 17) : gros blocs vitreux, joints de braise (mortar = lueur sourde).
    obsidian: (id, p) => `
        <pattern id="${id}" width="56" height="32" patternUnits="userSpaceOnUse">
            <rect width="56" height="32" fill="${p.mortar}"/>
            <path d="M1 1 H30 L27 15 H1 Z" fill="${p.wall}"/>
            <path d="M32 1 H55 V15 H29 Z" fill="${p.wallAlt}"/>
            <path d="M1 17 H14 L17 31 H1 Z" fill="${p.wallAlt}"/>
            <path d="M16 17 H42 L44 31 H19 Z" fill="${p.wall}"/>
            <path d="M44 17 H55 V31 H46 Z" fill="${p.wallAlt}"/>
            <path d="M6 4 l9 6 M36 4 l6 3 M24 21 l8 5" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1.2"/>
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
    // Asphalte (routes des étages urbains) : grain fin, quelques fissures.
    asphalt: (id, p) => `
        <pattern id="${id}" width="48" height="13" patternUnits="userSpaceOnUse">
            <rect width="48" height="13" fill="${p.floor}"/>
            <circle cx="7" cy="3" r="0.6" fill="${p.floorAlt}"/><circle cx="22" cy="9" r="0.7" fill="${p.joint}"/>
            <circle cx="35" cy="5" r="0.6" fill="${p.floorAlt}"/><circle cx="44" cy="11" r="0.5" fill="${p.joint}"/>
            <path d="M14 1 l3 4 l-1 4" fill="none" stroke="${p.joint}" stroke-width="0.6"/>
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

// --- Mises en scène des villes spécialisées (scène marchand / professeur) --------------------------
// Une enseigne néon par spécialité de marchand (clé = city.specialty) : libellé, couleur, icône (tracé
// centré sur 0,0, ~12 unités) et marchandises posées sur le comptoir (origine : centre du plateau).
const SHOP_SIGN_STYLES = {
    weapons: {
        label: 'ARMES', color: '#f87171',
        icon: 'M-5 5 L5 -5 M2 -6 L6 -2 M-6 3 L-3 6',
        goods: `
            <path d="M-42 -3 H-16" stroke="#9ca3af" stroke-width="2.2"/>
            <path d="M-16 -7 V1" stroke="#6b5a3a" stroke-width="2.5"/>
            <path d="M-16 -3 H-9" stroke="#4a3a24" stroke-width="3"/>
            <path d="M8 -2 H24 M8 -2 l-3 -2 l3 -2" fill="none" stroke="#9ca3af" stroke-width="1.8"/>`
    },
    ranged: {
        label: 'TIR', color: '#fbbf24',
        icon: 'M-3 -6 Q5 0 -3 6 M-3 -6 V6 M-6 0 H6 M3 -2 L6 0 L3 2',
        goods: `
            <rect x="-38" y="-15" width="9" height="15" rx="1.5" fill="#4a3a24" stroke="#05060c" stroke-width="1"/>
            <path d="M-36 -15 l-2 -8 M-33.5 -15 v-9 M-31 -15 l2 -8" stroke="#9ca3af" stroke-width="1.2"/>
            <path d="M6 -2 Q18 -16 30 -2" fill="none" stroke="#6b5a3a" stroke-width="2"/>
            <path d="M6 -2 H30" stroke="#b8b2a0" stroke-width="0.7"/>`
    },
    armors: {
        label: 'ARMURES', color: '#60a5fa',
        icon: 'M0 -6 L6 -3 Q6 4 0 7 Q-6 4 -6 -3 Z',
        goods: `
            <path d="M-40 0 Q-40 -15 -27 -15 Q-14 -15 -14 0 Z" fill="#5b6470" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-35 -7 H-19" stroke="#05060c" stroke-width="1.2"/>
            <path d="M6 0 L6 -12 Q16 -16 26 -12 L26 0 Z" fill="#4a5058" stroke="#05060c" stroke-width="1.2"/>`
    },
    scrolls: {
        label: 'GRIMOIRES', color: '#c084fc',
        icon: 'M-6 -4 H4 Q7 -4 7 -1 Q7 2 4 2 H-6 Z M-4 5 H5',
        goods: `
            <rect x="-42" y="-6" width="20" height="5" rx="2.5" fill="#cbbf9f" stroke="#05060c" stroke-width="0.8"/>
            <rect x="-38" y="-11" width="18" height="5" rx="2.5" fill="#b8ad8c" stroke="#05060c" stroke-width="0.8"/>
            <path d="M14 0 V-7 Q14 -10 11 -12 V-15 H17 V-12 Q14 -10 14 -7" fill="#5b2d7a" stroke="#05060c" stroke-width="1"/>
            <rect x="8" y="-8" width="12" height="8" rx="2" fill="#5b2d7a" stroke="#05060c" stroke-width="1"/>`
    }
};

// Un tableau noir par compétence de professeur (clé = city.specialty) : libellé et croquis à la craie
// (origine : centre du tableau).
const TRAINER_BOARD_STYLES = {
    weapon: {
        label: 'ARME',
        doodle: `
            <path d="M-44 12 L-16 -12 M-21 -15 L-13 -7 M-46 8 L-40 14" />
            <path d="M-4 -8 q14 -4 18 10 M10 0 l4 2 l1 -4" />`
    },
    unarmed: {
        label: 'MAINS NUES',
        doodle: `
            <rect x="-40" y="-12" width="18" height="16" rx="4" />
            <path d="M-40 -6 H-26 M-40 -1 H-26 M-22 -8 h6 M-22 -2 h9 M-22 4 h6" />
            <path d="M0 6 q8 -18 20 -6" />`
    },
    magic: {
        label: 'MAGIE',
        doodle: `
            <circle cx="-26" cy="-2" r="14" />
            <path d="M-26 -16 L-18 9 L-39 -7 H-13 L-34 9 Z" />
            <path d="M0 -10 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 Z" />`
    },
    stealth: {
        label: 'FURTIVITÉ',
        doodle: `
            <path d="M-44 -2 Q-30 -14 -16 -2 Q-30 10 -44 -2 Z" />
            <circle cx="-30" cy="-2" r="3" />
            <path d="M-46 10 L-14 -14" />
            <path d="M0 8 h4 M8 2 h4 M16 -4 h4" />`
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
    // --- Villes spécialisées ----------------------------------------------------------------------------
    // Enseigne néon d'un marchand : icône + libellé de sa spécialité (voir SHOP_SIGN_STYLES). Origine :
    // centre.
    shopSign: {
        markup: (o) => {
            const style = SHOP_SIGN_STYLES[o.specialty] || SHOP_SIGN_STYLES.weapons;
            // Largeur calée sur le libellé : icône à gauche, texte jamais chevauchant.
            const w = o.w || Math.max(70, 38 + style.label.length * 7.4);
            return `
            <rect x="${-w / 2}" y="-13" width="${w}" height="26" rx="4" fill="#0b0d12" stroke="#05060c" stroke-width="1.5"/>
            <g class="bd-neon">
                <path d="${style.icon}" transform="translate(${-w / 2 + 15} 0)" fill="none" stroke="${style.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.25"/>
                <path d="${style.icon}" transform="translate(${-w / 2 + 15} 0)" fill="none" stroke="${style.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
                <text x="${-w / 2 + 28}" y="3.5" font-size="10" font-weight="bold" letter-spacing="1" fill="${style.color}" opacity="0.9">${style.label}</text>
            </g>`;
        },
        light: (o) => ({ dx: 0, dy: 0, color: (SHOP_SIGN_STYLES[o.specialty] || SHOP_SIGN_STYLES.weapons).color, radius: 46, flicker: false })
    },
    // Comptoir de marchand, marchandises de sa spécialité posées dessus. Origine : milieu du bas (au sol).
    // `h` : hauteur du plateau (35 par défaut).
    shopCounter: {
        markup: (o) => {
            const w = o.w || 110;
            const h = o.h || 35;
            const style = SHOP_SIGN_STYLES[o.specialty] || SHOP_SIGN_STYLES.weapons;
            const panels = [];
            for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) panels.push(`<path d="M${x} ${-h + 7} V-2" stroke="#2a2016" stroke-width="1.2"/>`);
            return `
            <rect x="${-w / 2 + 2}" y="${-h + 5}" width="${w - 4}" height="${h - 5}" fill="#3b2c1f" stroke="#05060c" stroke-width="1.5"/>
            ${panels.join('')}
            <rect x="${-w / 2}" y="${-h}" width="${w}" height="5" rx="1" fill="#5a4430" stroke="#05060c" stroke-width="1.5"/>
            <g transform="translate(0 ${-h})">${style.goods}</g>`;
        },
        light: () => null
    },
    // Tableau noir d'un professeur : croquis à la craie de sa compétence (voir TRAINER_BOARD_STYLES).
    // Origine : centre.
    chalkboard: {
        markup: (o) => {
            const style = TRAINER_BOARD_STYLES[o.skill] || TRAINER_BOARD_STYLES.weapon;
            const w = o.w || 124;
            const h = o.h || 58;
            return `
            <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#1c2621" stroke="#4a3a24" stroke-width="3.5"/>
            <g fill="none" stroke="#d9ded4" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.6">${style.doodle}</g>
            <text x="${w / 2 - 8}" y="${h / 2 - 8}" text-anchor="end" font-size="8" font-weight="bold" letter-spacing="1" fill="#d9ded4" opacity="0.55">${style.label}</text>
            <rect x="${-w / 2 + 6}" y="${h / 2 + 1.5}" width="${w - 12}" height="3" fill="#3b2f22" stroke="#05060c" stroke-width="0.8"/>
            <rect x="${-w / 2 + 16}" y="${h / 2}" width="6" height="2" fill="#e5e0cf"/>`;
        },
        light: () => null
    },

    // --- Salle de jeux (V4) -----------------------------------------------------------------------------
    // Enseigne néon « SALLE DE JEUX » (magenta). Origine : centre.
    arcadeSign: {
        markup: () => `
            <rect x="-52" y="-13" width="104" height="26" rx="4" fill="#0b0d12" stroke="#05060c" stroke-width="1.5"/>
            <g class="bd-neon">
                <text x="0" y="-1" text-anchor="middle" font-size="9" font-weight="bold" letter-spacing="1.5" fill="#f472b6" opacity="0.9">SALLE DE JEUX</text>
                <text x="0" y="9" text-anchor="middle" font-size="7" letter-spacing="3" fill="#facc15" opacity="0.85">★ ★ ★</text>
            </g>`,
        light: () => ({ dx: 0, dy: 0, color: '#f472b6', radius: 46, flicker: false })
    },
    // Deux bornes d'arcade à écran allumé. Origine : milieu du bas (au sol).
    arcadeCabinets: {
        markup: () => {
            const cab = (x, screen) => `
            <g transform="translate(${x} 0)">
                <path d="M-15 0 V-50 L-11 -60 H11 L15 -50 V0 Z" fill="#2a1f3d" stroke="#05060c" stroke-width="1.5"/>
                <rect x="-11" y="-52" width="22" height="18" rx="2" fill="#0b0d12" stroke="#05060c" stroke-width="1"/>
                <rect x="-9" y="-50" width="18" height="14" fill="${screen}" opacity="0.8" class="bd-halo-flicker"/>
                <rect x="-12" y="-30" width="24" height="6" fill="#3b2f55" stroke="#05060c" stroke-width="1"/>
                <circle cx="-5" cy="-27" r="1.8" fill="#facc15"/><circle cx="2" cy="-27" r="1.8" fill="#f472b6"/><circle cx="8" cy="-27" r="1.8" fill="#38bdf8"/>
            </g>`;
            return cab(-22, '#38bdf8') + cab(22, '#a78bfa');
        },
        light: () => ({ dx: 0, dy: -42, color: '#a78bfa', radius: 40, flicker: true })
    },

    // --- Salles sécurisées ---------------------------------------------------------------------------
    // Éclairage chaud et apaisé : aucune couleur rouge, animations lentes (bd-calm-flame / bd-calm-glow),
    // halos qui "respirent" (light.calm) au lieu de vaciller.
    // Porte blindée à volant, dans son encadrement. Origine : milieu du bas (au sol).
    armoredDoor: {
        markup: (o) => {
            const w = o.w || 46;
            const h = o.h || 76;
            const rivets = [];
            for (let y = -h + 6; y <= -6; y += (h - 12) / 5) {
                rivets.push(`<circle cx="${-w / 2 + 3.5}" cy="${y}" r="1.1"/>`, `<circle cx="${w / 2 - 3.5}" cy="${y}" r="1.1"/>`);
            }
            const spokes = [0, 60, 120].map(a => `<path d="M-8 0 H8" transform="rotate(${a})"/>`).join('');
            return `
            <rect x="${-w / 2 - 6}" y="${-h - 6}" width="${w + 12}" height="${h + 6}" fill="#26272a" stroke="#05060c" stroke-width="1.5"/>
            <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="2" fill="#4a5058" stroke="#05060c" stroke-width="1.5"/>
            <rect x="${-w / 2 + 6}" y="${-h + 8}" width="${w - 12}" height="${h - 16}" rx="1.5" fill="none" stroke="#3a3f46" stroke-width="1.5"/>
            <g fill="#6b7078">${rivets.join('')}</g>
            <rect x="${-w / 2 - 4}" y="${-h + 10}" width="5" height="9" rx="1" fill="#34373c" stroke="#05060c" stroke-width="1"/>
            <rect x="${-w / 2 - 4}" y="-19" width="5" height="9" rx="1" fill="#34373c" stroke="#05060c" stroke-width="1"/>
            <g transform="translate(0 ${-h / 2})" fill="none" stroke="#8a9098" stroke-width="2" stroke-linecap="round">
                <circle r="8.5"/>${spokes}<circle r="2" fill="#8a9098"/>
            </g>
            <path d="M${-w / 2 + 4} -3 H${w / 2 - 4}" stroke="#a38a2a" stroke-width="2" stroke-dasharray="4 4" opacity="0.6"/>`;
        },
        light: () => null
    },
    // Panneau lumineux « ZONE SÛRE » (vert doux, respiration lente). Origine : centre.
    safeZonePanel: {
        markup: (o) => {
            const w = o.w || 90;
            const color = o.color || '#86efac';
            return `
            <rect x="${-w / 2}" y="-10" width="${w}" height="20" rx="3" fill="#0b120e" stroke="#05060c" stroke-width="1.5"/>
            <g class="bd-calm-glow"${backdropAnimDelay(o)}>
                <path d="M${-w / 2 + 7} 1 L${-w / 2 + 13} -5 L${-w / 2 + 19} 1 M${-w / 2 + 9} 0 V5 H${-w / 2 + 17} V0" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" opacity="0.9"/>
                <text x="${-w / 2 + 24}" y="3.5" font-size="9" font-weight="bold" letter-spacing="1" fill="${color}" opacity="0.9">ZONE SÛRE</text>
            </g>`;
        },
        light: (o) => ({ dx: 0, dy: 0, color: o.color || '#4ade80', radius: 40, calm: true })
    },
    // Enseigne néon apaisée (texte + icône facultative), sans grésillement. Origine : centre.
    calmNeon: {
        markup: (o) => {
            const color = o.color || '#fbbf24';
            const w = o.w || Math.max(60, 30 + (o.text || '').length * 7.4);
            const textX = o.icon ? -w / 2 + 25 : 0;
            const anchor = o.icon ? '' : ' text-anchor="middle"';
            const icon = o.icon
                ? `<path d="${o.icon}" transform="translate(${-w / 2 + 13} 0)" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`
                : '';
            return `
            <rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="4" fill="#0f0b08" stroke="#05060c" stroke-width="1.5"/>
            <g class="bd-calm-glow"${backdropAnimDelay(o)}>
                ${icon}
                <text x="${textX}" y="3.5"${anchor} font-size="10" font-weight="bold" letter-spacing="1" fill="none" stroke="${color}" stroke-width="2.2" opacity="0.25">${o.text || ''}</text>
                <text x="${textX}" y="3.5"${anchor} font-size="10" font-weight="bold" letter-spacing="1" fill="${color}" opacity="0.9">${o.text || ''}</text>
            </g>`;
        },
        light: (o) => ({ dx: 0, dy: 0, color: o.color || '#fbbf24', radius: o.radius || 44, calm: true })
    },
    // Ampoule nue suspendue au plafond. Origine : point d'accroche au plafond.
    hangingBulb: {
        markup: (o) => {
            const len = o.length || 30;
            return `
            <path d="M0 0 V${len}" stroke="#05060c" stroke-width="1"/>
            <rect x="-2.5" y="${len}" width="5" height="4" fill="#3a3226" stroke="#05060c" stroke-width="0.8"/>
            <circle cx="0" cy="${len + 8}" r="4.5" fill="#fde68a" stroke="#05060c" stroke-width="0.8" opacity="0.9"/>`;
        },
        light: (o) => ({ dx: 0, dy: (o.length || 30) + 8, color: '#fbbf24', radius: o.radius || 46, calm: true })
    },
    // Tonneau cerclé. Origine : milieu du bas (au sol).
    barrel: {
        markup: (o) => {
            const w = o.w || 26;
            const h = o.h || 32;
            return `
            <path d="M${-w / 2 + 2} ${-h} Q${-w / 2 - 2} ${-h / 2} ${-w / 2 + 2} 0 H${w / 2 - 2} Q${w / 2 + 2} ${-h / 2} ${w / 2 - 2} ${-h} Z" fill="#5a4028" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-3 ${-h + 1} V-1 M5 ${-h + 1} V-1 M-10 ${-h + 3} V-3" stroke="#3f2c1a" stroke-width="1"/>
            <path d="M${-w / 2 + 0.5} ${-h * 0.72} H${w / 2 - 0.5} M${-w / 2 + 0.5} ${-h * 0.28} H${w / 2 - 0.5}" stroke="#2f3136" stroke-width="2.5"/>
            <ellipse cx="0" cy="${-h}" rx="${w / 2 - 2}" ry="2.5" fill="#4a3420" stroke="#05060c" stroke-width="1"/>
            ${o.mug ? `<rect x="-4" y="${-h - 9}" width="7" height="8" rx="1" fill="#c9a34a" stroke="#05060c" stroke-width="0.8"/><path d="M3 ${-h - 7} h2 v4 h-2" fill="none" stroke="#05060c" stroke-width="0.8"/><path d="M-4 ${-h - 9} h7" stroke="#f5f0e0" stroke-width="1.6"/>` : ''}`;
        },
        light: () => null
    },
    // Matelas éventré posé au sol : ressorts apparents, rembourrage qui déborde, oreiller. Origine :
    // milieu du bas (au sol).
    mattress: {
        markup: (o) => {
            const w = o.w || 96;
            return `
            <rect x="${-w / 2}" y="-15" width="${w}" height="15" rx="4" fill="#6b6a55" stroke="#05060c" stroke-width="1.5"/>
            <path d="M${-w / 2 + 4} -9 H${w / 2 - 4}" stroke="#565543" stroke-width="1" stroke-dasharray="3 5"/>
            <path d="M${-w / 2 + 6} -15 q6 -6 14 -1" fill="#8a8872" stroke="#05060c" stroke-width="1"/>
            <path d="M-8 -15 q4 -9 8 -2 q3 -8 9 -1 q5 -5 7 1" fill="#d6d0b8" stroke="#05060c" stroke-width="1"/>
            <path d="M-2 -17 c-3 -5 5 -5 2 -10 M6 -16 c-3 -5 5 -5 2 -10" fill="none" stroke="#9ca3af" stroke-width="1.2"/>
            <path d="M${w / 2 - 22} -11 l6 -4 l5 3 l-4 5 Z" fill="#3f3e32" stroke="#05060c" stroke-width="0.8"/>`;
        },
        light: () => null
    },
    // Croix de premiers secours murale (verte, jamais rouge), faiblement éclairée. Origine : centre.
    firstAidSign: {
        markup: (o) => `
            <rect x="-15" y="-15" width="30" height="30" rx="3" fill="#15803d" stroke="#05060c" stroke-width="1.5"/>
            <g class="bd-calm-glow"${backdropAnimDelay(o)}>
                <path d="M-4 -10 H4 V-4 H10 V4 H4 V10 H-4 V4 H-10 V-4 H-4 Z" fill="#f0fdf4" stroke="#05060c" stroke-width="0.8" opacity="0.92"/>
            </g>`,
        light: () => ({ dx: 0, dy: 0, color: '#4ade80', radius: 36, calm: true })
    },
    // Trousse de secours posée au sol. Origine : milieu du bas (au sol).
    medkit: {
        markup: () => `
            <rect x="-15" y="-15" width="30" height="15" rx="2.5" fill="#d8d6cc" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-6 -15 v-4 h12 v4" fill="none" stroke="#05060c" stroke-width="1.8"/>
            <path d="M-2 -12 H2 V-9 H5 V-5 H2 V-2 H-2 V-5 H-5 V-9 H-2 Z" fill="#15803d"/>`,
        light: () => null
    },
    // Bidon rouillé où couve un feu de camp. Origine : milieu du bas (au sol).
    fireBarrel: {
        markup: (o) => `
            <rect x="-13" y="-30" width="26" height="30" rx="2" fill="#5b4632" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-13 -21 H13 M-13 -9 H13" stroke="#3a2c1f" stroke-width="2"/>
            <circle cx="-5" cy="-15" r="1.6" fill="#f59e0b" opacity="0.8"/>
            <circle cx="4" cy="-4" r="1.3" fill="#f59e0b" opacity="0.7"/>
            <g class="bd-calm-flame"${backdropAnimDelay(o)}>
                <path d="M-10 -30 C-11 -40 -5 -42 -4 -50 C0 -44 2 -46 3 -54 C7 -46 12 -42 10 -30 Z" fill="#d97706" stroke="#05060c" stroke-width="0.8"/>
                <path d="M-5 -30 C-5 -36 -1 -38 0 -43 C3 -38 6 -36 5 -30 Z" fill="#fcd34d"/>
            </g>`,
        light: () => ({ dx: 0, dy: -40, color: '#f59e0b', radius: 54, calm: true })
    },
    // Groupe de bougies fondues. Origine : milieu du bas (au sol).
    candles: {
        markup: (o) => {
            const sizes = [[-16, 10], [-8, 17], [0, 12], [8, 20], [16, 9]];
            return sizes.map(([x, h], i) => `
            <rect x="${x - 2.5}" y="${-h}" width="5" height="${h}" rx="1" fill="#e8e1c8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M${x} ${-h} v-2" stroke="#05060c" stroke-width="0.8"/>
            <path class="bd-calm-flame" style="animation-delay:-${(i * 0.7 + (o.phase || 0)).toFixed(1)}s" d="M${x} ${-h - 8} C${x + 2.2} ${-h - 5} ${x + 2.2} ${-h - 3} ${x} ${-h - 2} C${x - 2.2} ${-h - 3} ${x - 2.2} ${-h - 5} ${x} ${-h - 8} Z" fill="#fcd34d"/>`).join('') +
                `<path d="M-20 0 q3 -3 6 0 M10 0 q4 -3 8 0" fill="#e8e1c8" stroke="#05060c" stroke-width="0.6"/>`;
        },
        light: () => ({ dx: 0, dy: -20, color: '#fbbf24', radius: 40, calm: true })
    },
    // Prières et symboles griffonnés à la craie sur le mur. Origine : centre.
    prayerGraffiti: {
        markup: () => `
            <g fill="none" stroke="#e7e2d0" stroke-width="1.2" stroke-linecap="round" opacity="0.5">
                <path d="M-6 -22 V2 M-14 -14 H2"/>
                <path d="M-40 -18 q4 -3 8 0 t8 0 t8 0 M-42 -8 q5 -3 10 0 t10 0 M-40 4 q4 -2 8 0 t8 0"/>
                <path d="M14 -20 q5 -3 10 0 t10 0 M16 -10 q4 -2 8 0 t8 0 t8 0 M14 2 q5 -3 10 0"/>
                <circle cx="-6" cy="14" r="5"/>
            </g>
            <text x="22" y="16" text-anchor="middle" font-size="7" font-weight="bold" letter-spacing="1" fill="#e7e2d0" opacity="0.45">PITIÉ</text>`,
        light: () => null
    },
    // Rangée de casiers métalliques, deux portes ouvertes. Origine : milieu du bas (au sol).
    lockers: {
        markup: () => {
            const doors = [-24, 0, 24].map((x, i) => {
                const body = `<rect x="${x - 11}" y="-66" width="22" height="66" fill="#3f4a55" stroke="#05060c" stroke-width="1.5"/>`;
                const vents = `<path d="M${x - 5} -60 h10 M${x - 5} -57 h10 M${x - 5} -54 h10" stroke="#2a323a" stroke-width="1"/>`;
                if (i === 0) return body + vents + `<rect x="${x + 5}" y="-36" width="2" height="7" fill="#8a9098"/>`;
                const inside = `<rect x="${x - 9}" y="-64" width="18" height="62" fill="#181d22"/><path d="M${x - 9} -44 H${x + 9}" stroke="#2a323a" stroke-width="1.5"/>`;
                const hang = i === 1
                    ? `<path d="M${x - 3} -40 l-3 18 h12 l-3 -18 Z" fill="#4a5a44" stroke="#05060c" stroke-width="0.8"/>`
                    : `<rect x="${x - 4}" y="-12" width="8" height="10" rx="1.5" fill="#6b6150" stroke="#05060c" stroke-width="0.8"/>`;
                const door = `<path d="M${x + 11} -66 L${x + 19} -63 L${x + 19} -3 L${x + 11} 0 Z" fill="#4f5b67" stroke="#05060c" stroke-width="1.2"/>`;
                return body + inside + hang + door;
            }).join('');
            return doors + `<rect x="-36" y="-3" width="72" height="3" fill="#2a323a" stroke="#05060c" stroke-width="0.8"/>`;
        },
        light: () => null
    },
    // Bureau métallique avec lampe de bureau et papiers. Origine : milieu du bas (au sol).
    metalDesk: {
        markup: () => `
            <rect x="-36" y="-32" width="72" height="5" fill="#59616b" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-34" y="-27" width="4" height="27" fill="#3f454d" stroke="#05060c" stroke-width="1"/>
            <rect x="8" y="-27" width="26" height="27" fill="#4a525b" stroke="#05060c" stroke-width="1.2"/>
            <path d="M8 -18 H34 M8 -9 H34 M18 -23 h6 M18 -14 h6 M18 -5 h6" stroke="#05060c" stroke-width="1"/>
            <path d="M-24 -32 l3 -3 h14 l2 3" fill="#d6d0b8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M22 -32 V-44 L14 -50" fill="none" stroke="#2f3136" stroke-width="2"/>
            <path d="M8 -52 L18 -54 L16 -46 Z" fill="#3a5a44" stroke="#05060c" stroke-width="1"/>
            <ellipse cx="11" cy="-47" rx="3" ry="1.6" fill="#fde68a" opacity="0.9"/>`,
        light: () => ({ dx: 10, dy: -44, color: '#fbbf24', radius: 36, calm: true })
    },
    // Chaise de bureau qui grince. Origine : milieu du bas (au sol).
    officeChair: {
        markup: () => `
            <path d="M-10 0 L0 -6 L10 0 M0 -6 V-18" fill="none" stroke="#2f3136" stroke-width="2"/>
            <rect x="-10" y="-22" width="20" height="5" rx="2" fill="#3a3e44" stroke="#05060c" stroke-width="1.2"/>
            <path d="M8 -20 L12 -44" stroke="#2f3136" stroke-width="2.4"/>
            <rect x="7" y="-48" width="9" height="20" rx="3" transform="rotate(10 11 -38)" fill="#3a3e44" stroke="#05060c" stroke-width="1.2"/>`,
        light: () => null
    },
    // Armoire à pharmacie murale, porte entrouverte sur des flacons. Origine : centre.
    pharmacyCabinet: {
        markup: () => `
            <rect x="-24" y="-26" width="48" height="52" rx="2" fill="#c9c6bb" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-21" y="-23" width="42" height="46" fill="#1e2328"/>
            <path d="M-21 -6 H21 M-21 9 H21" stroke="#8a8f96" stroke-width="1.5"/>
            <rect x="-17" y="-15" width="5" height="9" rx="1" fill="#b98a3a" stroke="#05060c" stroke-width="0.6"/>
            <rect x="-10" y="-13" width="4" height="7" rx="1" fill="#6b8f71" stroke="#05060c" stroke-width="0.6"/>
            <rect x="-15" y="1" width="8" height="8" rx="1" fill="#d8d6cc" stroke="#05060c" stroke-width="0.6"/>
            <rect x="-4" y="3" width="4" height="6" rx="1" fill="#5b7fa6" stroke="#05060c" stroke-width="0.6"/>
            <path d="M0 -23 L24 -28 L24 28 L0 23 Z" fill="#d8d5ca" stroke="#05060c" stroke-width="1.2"/>
            <path d="M10 -6 H14 V-2 H18 V2 H14 V6 H10 V2 H6 V-2 H10 Z" fill="#15803d"/>`,
        light: () => null
    },

    // --- Vignettes d'exploration (scène de la carte active) ------------------------------------------
    // Coffre ouvert, trésor qui luit. Origine : milieu du bas (au sol).
    treasureChest: {
        markup: () => `
            <path d="M-20 -22 L-17 -40 L17 -40 L20 -22 Z" fill="#6b4a2a" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-17 -40 L17 -40" stroke="#c9a34a" stroke-width="2"/>
            <rect x="-20" y="-22" width="40" height="22" fill="#5a3d22" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-20 -14 H20 M-10 -22 V0 M10 -22 V0" stroke="#c9a34a" stroke-width="1.8"/>
            <ellipse cx="0" cy="-22" rx="17" ry="4" fill="#fcd34d" stroke="#05060c" stroke-width="1"/>
            <g class="bd-blink"${backdropAnimDelay({ phase: 0.4 })}><path d="M-6 -30 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 Z" fill="#fef3c7"/></g>
            <g class="bd-blink"><path d="M8 -34 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 Z" fill="#fef3c7"/></g>`,
        light: () => ({ dx: 0, dy: -26, color: '#fbbf24', radius: 44, flicker: false })
    },
    // Tas de pièces d'or. Origine : milieu du bas (au sol).
    coinPile: {
        markup: () => {
            const coins = [[-14, -3], [-6, -3], [2, -3], [10, -3], [-10, -8], [-2, -8], [6, -8], [-6, -13], [2, -13], [-2, -18]];
            return coins.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.6" fill="#e0b43a" stroke="#05060c" stroke-width="0.9"/>`).join('') + `
            <g transform="translate(17 -9) rotate(70)"><ellipse rx="5" ry="2.6" fill="#e0b43a" stroke="#05060c" stroke-width="0.9"/></g>
            <g class="bd-blink"><path d="M-4 -26 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 Z" fill="#fef3c7"/></g>`;
        },
        light: () => ({ dx: 0, dy: -10, color: '#fbbf24', radius: 30, flicker: false })
    },
    // Sacoche entrouverte : rouleau de bandage, pomme. Origine : milieu du bas (au sol).
    pouch: {
        markup: () => `
            <path d="M-16 0 Q-18 -18 -10 -22 H10 Q18 -18 16 0 Z" fill="#6b5a3a" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-12 -22 Q0 -30 12 -22" fill="#57492f" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-9" y="-30" width="10" height="9" rx="4.5" fill="#e8e1c8" stroke="#05060c" stroke-width="1"/>
            <path d="M-7 -26 H-1" stroke="#b8b2a0" stroke-width="0.8"/>
            <circle cx="6" cy="-26" r="4.5" fill="#6a9a3a" stroke="#05060c" stroke-width="1"/>
            <path d="M6 -30 l1 -3" stroke="#3a2a1c" stroke-width="1"/>`,
        light: () => null
    },
    // Colis parachuté par le public (clin d'œil à l'émission de Dungeon Crawler Carl). Origine : centre
    // de la caisse (en l'air, flotte doucement).
    parachuteCrate: {
        markup: () => `
            <g class="bd-float">
                <path d="M-26 -38 Q0 -62 26 -38 Q13 -42 0 -38 Q-13 -42 -26 -38 Z" fill="#6b4fa0" stroke="#05060c" stroke-width="1.5"/>
                <path d="M-13 -40 Q0 -54 13 -40" fill="none" stroke="#8b6fc0" stroke-width="1.2"/>
                <path d="M-26 -38 L-9 -10 M26 -38 L9 -10 M0 -38 V-10" stroke="#b8b2a0" stroke-width="0.8"/>
                <rect x="-11" y="-10" width="22" height="18" rx="1.5" fill="#caa23a" stroke="#05060c" stroke-width="1.5"/>
                <path d="M-11 -1 H11 M0 -10 V8" stroke="#8a6a24" stroke-width="1.5"/>
                <path d="M0 -3.5 c-2 -3 -6 -1 -3 2 l3 3 l3 -3 c3 -3 -1 -5 -3 -2 Z" fill="#fef3c7"/>
            </g>`,
        light: () => ({ dx: 0, dy: -2, color: '#c084fc', radius: 36, flicker: false })
    },
    // Drone caméra de l'émission qui filme le crawler (voyant REC). Origine : centre (en l'air).
    cameraDrone: {
        markup: () => `
            <g class="bd-float">
                <path d="M-16 -6 H16" stroke="#2f3136" stroke-width="2"/>
                <ellipse cx="-16" cy="-8" rx="7" ry="1.5" fill="#9ca3af" opacity="0.6"/>
                <ellipse cx="16" cy="-8" rx="7" ry="1.5" fill="#9ca3af" opacity="0.6"/>
                <rect x="-9" y="-6" width="18" height="10" rx="3" fill="#3a3e44" stroke="#05060c" stroke-width="1.2"/>
                <circle cx="-4" cy="6" r="4" fill="#1e2328" stroke="#05060c" stroke-width="1"/>
                <circle cx="-4" cy="6" r="1.8" fill="#60a5fa"/>
                <circle class="bd-blink" cx="5" cy="-2" r="1.6" fill="#ef4444"/>
            </g>`,
        light: () => null
    },
    // Piège à pointes jaillissant d'une dalle. Origine : milieu du bas (au sol).
    spikeTrap: {
        markup: () => {
            const spikes = [-18, -9, 0, 9, 18].map(x => `<path d="M${x - 3} -2 L${x} -18 L${x + 3} -2 Z" fill="#9ca3af" stroke="#05060c" stroke-width="1"/>`).join('');
            return `<rect x="-24" y="-3" width="48" height="4" fill="#2f3136" stroke="#05060c" stroke-width="1"/>${spikes}
            <path d="M-6 -12 l-4 -6 M8 -14 l5 -5" stroke="#fef3c7" stroke-width="1.2" stroke-linecap="round"/>`;
        },
        light: () => null
    },
    // Grande horloge murale dont l'aiguille s'emballe. Origine : centre.
    bigClock: {
        markup: () => `
            <circle r="24" fill="#d8d6cc" stroke="#05060c" stroke-width="2"/>
            <circle r="20" fill="none" stroke="#6b7078" stroke-width="1" stroke-dasharray="1.5 8.97"/>
            <path d="M0 0 L-8 -8" stroke="#05060c" stroke-width="2.5" stroke-linecap="round"/>
            <g class="bd-spin" style="animation-duration:1.6s"><path d="M0 0 V-18" stroke="#b45309" stroke-width="1.6" stroke-linecap="round"/><circle r="0.1" cx="0" cy="18" fill="none"/></g>
            <circle r="2" fill="#05060c"/>`,
        light: () => null
    },
    // Marques à la craie d'un chemin déjà parcouru. Origine : centre.
    chalkMarks: {
        markup: () => `
            <g fill="none" stroke="#e7e2d0" stroke-width="1.4" stroke-linecap="round" opacity="0.55">
                <path d="M-30 0 H6 M-2 -6 L6 0 L-2 6"/>
                <path d="M16 -8 l8 8 M24 -8 l-8 8"/>
            </g>
            <text x="-12" y="16" text-anchor="middle" font-size="7" font-weight="bold" letter-spacing="1" fill="#e7e2d0" opacity="0.45">DÉJÀ VU</text>`,
        light: () => null
    },
    // Couronne de boss tombée au sol. Origine : milieu du bas (au sol).
    fallenCrown: {
        markup: () => `
            <g transform="rotate(-22)">
                <path d="M-11 0 L-10 -11 L-4 -5 L0 -14 L4 -5 L10 -11 L11 0 Z" fill="#caa23a" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
            </g>
            <path d="M8 -2 l6 -2 M12 1 l5 1" stroke="#caa23a" stroke-width="1.2" stroke-linecap="round"/>`,
        light: () => null
    },
    // Plan de l'étage épinglé, toutes les zones cochées. Origine : centre.
    checkedMap: {
        markup: () => `
            <rect x="-22" y="-16" width="44" height="32" fill="#cbbf9f" stroke="#05060c" stroke-width="1.5" transform="rotate(-3)"/>
            <path d="M0 -14 V14 M-20 0 H20" stroke="#8a7a5a" stroke-width="1"/>
            <g fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M-15 -7 l3 3 l6 -6"/><path d="M5 -7 l3 3 l6 -6"/><path d="M-15 7 l3 3 l6 -6"/><path d="M5 7 l3 3 l6 -6"/>
            </g>
            <circle cx="0" cy="-17" r="2" fill="#b45309" stroke="#05060c" stroke-width="0.8"/>`,
        light: () => null
    },
    // Nuage de poussière soulevé par une fuite précipitée. Origine : milieu du bas (au sol).
    dustPuff: {
        markup: () => `
            <g class="bd-dust" fill="#9a8f7a" opacity="0.5">
                <circle cx="-10" cy="-5" r="6"/><circle cx="0" cy="-8" r="8"/><circle cx="11" cy="-4" r="5"/>
            </g>
            <path d="M18 -26 H34 M14 -18 H36 M20 -10 H32" stroke="#9a8f7a" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>`,
        light: () => null
    },
    // Cafétéria plongée dans le noir : plateau renversé, deux yeux dans l'ombre. Origine : milieu du bas.
    darkCafeteria: {
        markup: () => `
            <rect x="-40" y="-26" width="80" height="4" fill="#3a3e44" stroke="#05060c" stroke-width="1"/>
            <path d="M-34 -22 V0 M34 -22 V0" stroke="#2f3136" stroke-width="3"/>
            <g transform="translate(-10 -4) rotate(18)"><rect x="-12" y="-3" width="24" height="5" rx="1" fill="#6b7078" stroke="#05060c" stroke-width="1"/></g>
            <circle cx="14" cy="-2" r="3" fill="#b8b2a0" stroke="#05060c" stroke-width="0.8"/>
            <g class="bd-blink" style="animation-duration:4s"><circle cx="-6" cy="-44" r="1.8" fill="#fde68a"/><circle cx="2" cy="-44" r="1.8" fill="#fde68a"/></g>`,
        light: () => null
    },
    // Escalier qui descend vers l'étage suivant, lumière au fond. Origine : milieu du bas (au sol).
    stairsDown: {
        markup: () => {
            const steps = [0, 1, 2, 3, 4].map(i => `<rect x="${-30 + i * 6}" y="${-40 + i * 8}" width="${60 - i * 12}" height="8" fill="${['#3a3e44', '#34373c', '#2e3135', '#282a2e', '#212326'][i]}" stroke="#05060c" stroke-width="1"/>`).join('');
            return `<path d="M-36 -48 H36 V0 H-36 Z" fill="#111317" stroke="#05060c" stroke-width="1.5"/>
            <ellipse cx="0" cy="-6" rx="16" ry="5" fill="#93c5fd" opacity="0.35"/>${steps}
            <path d="M-36 -48 V0 M36 -48 V0" stroke="#4a5058" stroke-width="3"/>
            <path class="bd-calm-glow" d="M-7 -62 L0 -55 L7 -62 M-7 -69 L0 -62 L7 -69" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
        },
        light: () => ({ dx: 0, dy: -10, color: '#60a5fa', radius: 40, flicker: false })
    },
    // Autel du Pacte du Crawler : deux cierges et un contrat signé. Origine : milieu du bas (au sol).
    pactAltar: {
        markup: () => `
            <rect x="-26" y="-24" width="52" height="24" fill="#3b2f45" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-30" y="-28" width="60" height="5" fill="#4a3b52" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-10" y="-36" width="20" height="9" fill="#e8e1c8" stroke="#05060c" stroke-width="0.8" transform="rotate(-6)"/>
            <path d="M-6 -33 h10 M-6 -30 h7" stroke="#6b6150" stroke-width="0.8"/>
            <circle cx="5" cy="-30" r="1.8" fill="#991b1b"/>
            <rect x="-26" y="-40" width="4" height="12" fill="#e8e1c8" stroke="#05060c" stroke-width="0.6"/>
            <rect x="22" y="-40" width="4" height="12" fill="#e8e1c8" stroke="#05060c" stroke-width="0.6"/>
            <path class="bd-flame" d="M-24 -48 c2 3 2 5 0 7 c-2 -2 -2 -4 0 -7 Z" fill="#c084fc"/>
            <path class="bd-flame" style="animation-delay:-0.6s" d="M24 -48 c2 3 2 5 0 7 c-2 -2 -2 -4 0 -7 Z" fill="#c084fc"/>`,
        light: () => ({ dx: 0, dy: -40, color: '#a855f7', radius: 46, flicker: true })
    },

    // --- Étages urbains (routes, villes, repaires) ------------------------------------------------------
    // Panneau d'entrée de ville sur son poteau (nom de la ville). Origine : pied du poteau (au sol).
    citySign: {
        markup: (o) => {
            const text = o.text || 'VILLE';
            const w = Math.max(56, 16 + text.length * 5.2);
            return `
            <rect x="-2" y="-50" width="4" height="50" fill="#3a3e44" stroke="#05060c" stroke-width="1"/>
            <rect x="${-w / 2}" y="-66" width="${w}" height="18" rx="2" fill="#e8e4d4" stroke="#05060c" stroke-width="1.5"/>
            <rect x="${-w / 2 + 2}" y="-64" width="${w - 4}" height="14" rx="1" fill="none" stroke="#1e3350" stroke-width="1"/>
            <text x="0" y="-54.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e3350">${text}</text>`;
        },
        light: () => null
    },
    // Émission DeathWatch (chantier 4) : enseigne lumineuse « EN DIRECT ». Origine : point de fixation au mur.
    onAirSign: {
        markup: () => `
            <rect x="-32" y="-9" width="64" height="18" rx="3" fill="#1c1917" stroke="#05060c" stroke-width="1.4"/>
            <rect class="bd-neon-flicker" x="-29" y="-6" width="58" height="12" rx="2" fill="#b91c1c"/>
            <circle cx="-23" cy="0" r="2.4" fill="#fecaca"/>
            <text x="4" y="3" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fef2f2">EN DIRECT</text>`,
        light: () => ({ dx: 0, dy: 0, color: '#ef4444', radius: 40, flicker: true })
    },
    // Applaudimètre de plateau sur pied (chantier 4). Origine : pied, au sol.
    applauseMeter: {
        markup: () => `
            <rect x="-2" y="-34" width="4" height="34" fill="#3a3e44" stroke="#05060c" stroke-width="1"/>
            <rect x="-10" y="-70" width="20" height="38" rx="3" fill="#1f2937" stroke="#05060c" stroke-width="1.4"/>
            <rect x="-6" y="-44" width="12" height="7" fill="#16a34a"/>
            <rect x="-6" y="-52" width="12" height="7" fill="#65a30d"/>
            <rect x="-6" y="-60" width="12" height="7" fill="#ca8a04"/>
            <rect class="bd-blink" x="-6" y="-67" width="12" height="6" fill="#dc2626"/>
            <text x="0" y="-72" text-anchor="middle" font-size="4.5" font-weight="bold" fill="#e5e7eb">APPLAUDIMÈTRE</text>`,
        light: () => null
    },
    // Avis de recherche (chantier 3, chasseurs de primes) : affiche placardée sur un poteau, portrait
    // grossier du crawler, « RECHERCHÉ » et une prime. Origine : pied du poteau, au sol.
    wantedPoster: {
        markup: (o) => `
            <rect x="-2" y="-40" width="4" height="40" fill="#3a3e44" stroke="#05060c" stroke-width="1"/>
            <g transform="rotate(-3 0 -62)">
                <rect x="-22" y="-92" width="44" height="54" fill="#e3d3a8" stroke="#05060c" stroke-width="1.4"/>
                <path d="M-22 -92 l4 3 l-4 2 M22 -40 l-4 -2 l4 -3" fill="#c9b27c" stroke="none"/>
                <text x="0" y="-83" text-anchor="middle" font-size="7" font-weight="bold" fill="#7f1d1d">RECHERCHÉ</text>
                <rect x="-12" y="-79" width="24" height="22" fill="#d6c291" stroke="#5b3a22" stroke-width="0.8"/>
                <circle cx="0" cy="-72" r="4.2" fill="#5b3a22"/>
                <path d="M-8 -57 q8 -10 16 0 z" fill="#5b3a22"/>
                <path d="M-3 -73.5 l1.5 1 M3 -73.5 l-1.5 1" stroke="#e3d3a8" stroke-width="0.6"/>
                <text x="0" y="-49" text-anchor="middle" font-size="5" font-weight="bold" fill="#3b2a1a">MORT OU VIF</text>
                <text x="0" y="-42.5" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#7f1d1d">PRIME ${o.value != null ? o.value : '???'}</text>
            </g>
            <circle cx="-17" cy="-89" r="1.3" fill="#8a929c" stroke="#05060c" stroke-width="0.5"/>
            <circle cx="17" cy="-89" r="1.3" fill="#8a929c" stroke="#05060c" stroke-width="0.5"/>`,
        light: () => null
    },
    // Porte de la Sortie du donjon (étage final) : lumière du jour qui filtre. Origine : milieu du bas.
    exitDoor: {
        markup: () => `
            <rect x="-26" y="-74" width="52" height="74" fill="#26272a" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-20" y="-68" width="40" height="68" fill="#fef3c7" opacity="0.85"/>
            <path d="M-20 -68 L-6 -60 L-6 -2 L-20 0 Z" fill="#4a5058" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-22" y="-88" width="44" height="12" rx="2" fill="#15803d" stroke="#05060c" stroke-width="1.2"/>
            <text class="bd-calm-glow" x="0" y="-79" text-anchor="middle" font-size="8" font-weight="bold" letter-spacing="1" fill="#f0fdf4">SORTIE</text>`,
        light: () => ({ dx: 6, dy: -34, color: '#fef3c7', radius: 52, flicker: false })
    },
    // Entrée de repaire : porte de service défoncée, crânes, lueur rouge au fond. Origine : milieu du bas.
    lairEntrance: {
        markup: () => `
            <path d="M-30 0 V-58 Q0 -76 30 -58 V0 Z" fill="#1a1413" stroke="#05060c" stroke-width="2"/>
            <path d="M-22 0 V-52 Q0 -66 22 -52 V0 Z" fill="#0a0506"/>
            <ellipse class="bd-halo-flicker" cx="0" cy="-20" rx="16" ry="20" fill="#7f1d1d" opacity="0.55"/>
            <path d="M-22 -40 L-34 -30 L-26 -8" fill="#3a2e2a" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-26 -62 l6 10 M-18 -66 l4 12 M20 -64 l-5 11" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
            ${[[-36, 0], [34, 0], [40, -6]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-5 0 Q-6 -9 0 -9 Q6 -9 5 0 Z" fill="#d8d0b8" stroke="#05060c" stroke-width="0.8"/><circle cx="-2" cy="-5" r="1.3" fill="#05060c"/><circle cx="2" cy="-5" r="1.3" fill="#05060c"/></g>`).join('')}`,
        light: () => ({ dx: 0, dy: -24, color: '#dc2626', radius: 40, flicker: true })
    },
    // Tas de crânes et d'os. Origine : milieu du bas (au sol).
    skullPile: {
        markup: (o) => {
            const skulls = o.small ? [[0, 0]] : [[-9, 0], [9, 0], [0, -8]];
            return `<path d="M-18 0 L-10 -4 L12 -2 L20 0 Z" fill="#b8b09a" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-16 -2 L14 -8 M-4 -1 L18 -6" stroke="#d8d0b8" stroke-width="2.2" stroke-linecap="round"/>` +
                skulls.map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-6 0 Q-7 -11 0 -11 Q7 -11 6 0 Z" fill="#d8d0b8" stroke="#05060c" stroke-width="0.9"/><circle cx="-2.4" cy="-6" r="1.6" fill="#05060c"/><circle cx="2.4" cy="-6" r="1.6" fill="#05060c"/></g>`).join('');
        },
        light: () => null
    },
    // Panneau autoroutier vert suspendu. Origine : centre.
    highwaySign: {
        markup: (o) => {
            const text = o.text || 'SORTIE';
            const w = Math.max(60, 20 + text.length * 5.6);
            return `
            <path d="M${-w / 2 + 8} -30 V-12 M${w / 2 - 8} -30 V-12" stroke="#2f3136" stroke-width="2"/>
            <rect x="${-w / 2}" y="-12" width="${w}" height="24" rx="2" fill="#1f4a32" stroke="#05060c" stroke-width="1.5"/>
            <rect x="${-w / 2 + 2}" y="-10" width="${w - 4}" height="20" rx="1.5" fill="none" stroke="#cfd8cf" stroke-width="0.8" opacity="0.7"/>
            <text x="0" y="3" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#e6ece6" opacity="0.85">${text}</text>`;
        },
        light: () => null
    },
    // Glissière de sécurité le long de la route. Origine : extrémité gauche (au sol).
    guardrail: {
        markup: (o) => {
            const len = o.length || 360;
            const posts = [];
            for (let x = 10; x < len; x += 40) posts.push(`<rect x="${x}" y="-14" width="3" height="14" fill="#3a3e44" stroke="#05060c" stroke-width="0.6"/>`);
            return `${posts.join('')}<rect x="0" y="-16" width="${len}" height="5" fill="#6b7078" stroke="#05060c" stroke-width="0.8" opacity="0.8"/>`;
        },
        light: () => null
    },
    // Carcasse de voiture calcinée. Origine : milieu du bas (au sol).
    wreckedCar: {
        markup: () => `
            <path d="M-34 -6 L-30 -16 L-16 -18 L-8 -28 L14 -28 L22 -18 L34 -16 L36 -6 Z" fill="#2b2a2c" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M-6 -26 L-12 -18 L2 -18 L2 -26 Z M5 -26 V-18 L18 -18 L12 -26 Z" fill="#0b0c10"/>
            <circle cx="-20" cy="-4" r="6" fill="#141518" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="22" cy="-4" r="6" fill="#141518" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-26 -14 l8 2 M10 -14 l10 -2" stroke="#4a3a2a" stroke-width="1.5" opacity="0.8"/>`,
        light: () => null
    },
    // Cône de chantier. Origine : milieu du bas (au sol).
    trafficCone: {
        markup: () => `
            <rect x="-7" y="-2" width="14" height="2" fill="#2f3136"/>
            <path d="M-5 -2 L-1.5 -16 H1.5 L5 -2 Z" fill="#c2410c" stroke="#05060c" stroke-width="0.9"/>
            <path d="M-3.4 -8 H3.4" stroke="#e5e7eb" stroke-width="1.8" opacity="0.8"/>`,
        light: () => null
    },
    // Marquage central discontinu de la chaussée. Origine : extrémité gauche (au sol).
    roadLine: {
        markup: (o) => {
            const len = o.length || 360;
            const dashes = [];
            for (let x = 6; x < len; x += 36) dashes.push(`<rect x="${x}" y="0" width="18" height="1.8" fill="#e5e7eb" opacity="0.35"/>`);
            return dashes.join('');
        },
        light: () => null
    },

    // Rai de lumière filtrée tombant de la verrière. Origine : point haut.
    lightShaft: {
        markup: (o) => `<path d="M-10 0 L10 0 L46 108 L-20 108 Z" fill="${o.color || '#86efac'}" opacity="0.06"/>`,
        light: (o) => ({ dx: 14, dy: 70, color: o.color || '#86efac', radius: 44, flicker: false })
    },

    // --- Antre de Gorgoth le Concierge (chantier 17, lot 6) -------------------------------------------
    // Porte colossale de l'antre : arche d'obsidienne cornue, deux battants cerclés de fer, rouge qui filtre
    // par les jointures. Origine : milieu du bas (au sol). Options : `w`/`h` (par défaut 150 x 150 : elle
    // déborde du haut d'une scène de 150), `locks` (serrures allumées, 0-4 : une par clé de boss de
    // quartier), `open` (battants entrouverts, lueur intense), `chains` (chaînes en croix, par défaut quand
    // elle est fermée), `seal` (sceau rouge de porte rescellée).
    colossalGate: {
        markup: (o) => {
            const w = o.w || 150;
            const h = o.h || 150;
            const half = w / 2;
            const lit = Math.max(0, Math.min(4, Math.floor(o.locks || 0)));
            const chains = o.chains != null ? !!o.chains : !o.open;
            const r = (n) => Math.round(n * 10) / 10;
            const arch = `M${r(-half - 16)} 0 V${r(-h + 26)} Q0 ${r(-h - 34)} ${r(half + 16)} ${r(-h + 26)} V0 Z`;
            const inner = `M${r(-half)} 0 V${r(-h + 30)} Q0 ${r(-h - 14)} ${r(half)} ${r(-h + 30)} V0 Z`;
            // Cornes sur la clé de voûte et crâne aux yeux rouges (repère local centré sur le sommet de la porte,
            // à l'échelle de sa largeur : une petite porte garde des cornes à sa taille).
            const ks = r(Math.min(1, w / 150));
            const keystone = `
                <g transform="translate(0 ${r(-h)}) scale(${ks})">
                <path d="M-14 -2 Q-34 -30 -52 -22 Q-34 -18 -22 6 Z" fill="#2b2124" stroke="#05060c" stroke-width="1.5"/>
                <path d="M14 -2 Q34 -30 52 -22 Q34 -18 22 6 Z" fill="#2b2124" stroke="#05060c" stroke-width="1.5"/>
                <path d="M-15 10 Q-16 -12 0 -12 Q16 -12 15 10 L8 14 H-8 Z" fill="#3a2e30" stroke="#05060c" stroke-width="1.5"/>
                <circle class="bd-halo-flicker" cx="-6" cy="1" r="3" fill="#dc2626"/>
                <circle class="bd-halo-flicker" cx="6" cy="1" r="3" fill="#dc2626"/>
                </g>`;
            const straps = [0.22, 0.5, 0.78].map(f => r(-h * f));
            let leaves;
            if (o.open) {
                // Battants entrouverts vers l'intérieur : une gueule de lumière rouge entre les deux.
                const gap = half * 0.62;
                leaves = `
                <path d="${inner}" fill="#450a0a"/>
                <path class="bd-halo-flicker" d="M${r(-gap)} 0 V${r(-h + 34)} Q0 ${r(-h - 6)} ${r(gap)} ${r(-h + 34)} V0 Z" fill="#b91c1c" opacity="0.85"/>
                <ellipse class="bd-halo-flicker" cx="0" cy="${r(-h * 0.3)}" rx="${r(gap * 0.75)}" ry="${r(h * 0.3)}" fill="#ea580c" opacity="0.7"/>
                <ellipse cx="0" cy="${r(-h * 0.12)}" rx="${r(gap * 0.45)}" ry="${r(h * 0.12)}" fill="#fdba74" opacity="0.55"/>
                <path d="M${r(-half)} 0 V${r(-h + 30)} L${r(-gap)} ${r(-h + 40)} V-4 Z" fill="#2a2023" stroke="#05060c" stroke-width="1.5"/>
                <path d="M${r(half)} 0 V${r(-h + 30)} L${r(gap)} ${r(-h + 40)} V-4 Z" fill="#2a2023" stroke="#05060c" stroke-width="1.5"/>
                ${straps.map(y => `<path d="M${r(-half)} ${y} L${r(-gap)} ${r(y * 0.94)} M${r(half)} ${y} L${r(gap)} ${r(y * 0.94)}" stroke="#4a3f42" stroke-width="5"/>`).join('')}`;
            } else {
                const studs = [];
                straps.forEach(y => { for (let x = -half + 8; x < half - 4; x += 14) studs.push(`<circle cx="${r(x)}" cy="${y}" r="1.5"/>`); });
                leaves = `
                <path d="${inner}" fill="#251c1f" stroke="#05060c" stroke-width="1.5"/>
                <path d="M${r(-half + 8)} -6 V${r(-h + 36)} M${r(half - 8)} -6 V${r(-h + 36)}" stroke="#1a1316" stroke-width="2"/>
                ${straps.map(y => `<rect x="${r(-half)}" y="${r(y - 4)}" width="${w}" height="8" fill="#3d3336" stroke="#05060c" stroke-width="1"/><path class="bd-halo-flicker" d="M${r(-half)} ${r(y + 5)} H${r(half)}" stroke="#dc2626" stroke-width="1" opacity="0.55"/>`).join('')}
                <g fill="#6b5f62">${studs.join('')}</g>
                <path class="bd-halo-flicker" d="M0 -2 V${r(-h - 8)}" stroke="#ef4444" stroke-width="2.2" opacity="0.9"/>
                <path d="M0 -2 V${r(-h - 8)}" stroke="#fca5a5" stroke-width="0.8" opacity="0.8"/>
                <path class="bd-halo-flicker" d="M${r(-half + 2)} -1 H${r(half - 2)}" stroke="#f97316" stroke-width="2" opacity="0.8"/>`;
            }
            // Chaînes en croix (maillons alternés, positions fixes).
            let chainMarkup = '';
            if (chains) {
                const links = [];
                [[-half + 4, -h + 34, half - 4, -14], [half - 4, -h + 34, -half + 4, -14]].forEach(([x1, y1, x2, y2]) => {
                    const n = Math.max(6, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7));
                    const angle = r(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
                    for (let i = 0; i <= n; i++) {
                        const cx = r(x1 + (x2 - x1) * i / n), cy = r(y1 + (y2 - y1) * i / n);
                        links.push(`<ellipse cx="${cx}" cy="${cy}" rx="${i % 2 ? 4.2 : 4.6}" ry="${i % 2 ? 1.4 : 2.6}" transform="rotate(${angle} ${cx} ${cy})"/>`);
                    }
                });
                chainMarkup = `<g fill="none" stroke="#05060c" stroke-width="3.2">${links.join('')}</g><g fill="none" stroke="#8a8086" stroke-width="1.6">${links.join('')}</g>`;
            }
            // 4 serrures en carré autour de la jointure : allumées (clé obtenue) ou éteintes.
            const lockPos = [[-15, -0.62], [15, -0.62], [-15, -0.42], [15, -0.42]];
            const locks = o.open ? '' : lockPos.map(([x, f], i) => {
                const y = r(h * f);
                const on = i < lit;
                const glow = on ? `<circle class="bd-halo-flicker" cx="${x}" cy="${y}" r="10" fill="#f97316" opacity="0.35"/>` : '';
                return `${glow}<path d="M${x - 4} ${r(y - 4)} V${r(y - 8)} A4 4 0 0 1 ${x + 4} ${r(y - 8)} V${r(y - 4)}" fill="none" stroke="${on ? '#fdba74' : '#5a5054'}" stroke-width="2"/>
                <rect class="${on ? 'demon-lock-lit' : 'demon-lock'}" x="${x - 6}" y="${r(y - 4)}" width="12" height="10" rx="2" fill="${on ? '#f97316' : '#3a3236'}" stroke="#05060c" stroke-width="1.2"/>
                <path d="M${x} ${r(y - 1)} v4" stroke="${on ? '#fef3c7' : '#05060c'}" stroke-width="1.8" stroke-linecap="round"/>`;
            }).join('');
            const sy = r(-h * 0.52);
            const seal = o.seal ? `<g class="bd-halo-flicker" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.9"><circle cx="0" cy="${sy}" r="13"/><path d="M0 ${r(sy - 13)} L8 ${r(sy + 10)} L-12 ${r(sy - 4)} H12 L-8 ${r(sy + 10)} Z" stroke-width="1.2"/></g>` : '';
            return `
            <path d="${arch}" fill="#1a1214" stroke="#05060c" stroke-width="2"/>
            ${leaves}${chainMarkup}${locks}${seal}${keystone}
            <path d="M${r(-half - 16)} 0 h${r(w + 32)}" stroke="#05060c" stroke-width="3"/>`;
        },
        light: (o) => ({ dx: 0, dy: -Math.round((o.h || 150) * 0.4), color: '#dc2626', radius: o.open ? 90 : 56, flicker: true })
    },
    // Trône de Gorgoth : obsidienne cornue, coussin calciné, et l'attirail du concierge posé à côté (seau et
    // serpillière, panneau « sol glissant »). Origine : milieu du bas (au sol).
    demonThrone: {
        markup: () => `
            <ellipse class="bd-halo-flicker" cx="0" cy="-56" rx="46" ry="52" fill="#b91c1c" opacity="0.18"/>
            <path d="M-34 0 V-70 Q-38 -96 -52 -112 Q-30 -104 -22 -86 L-18 -100 Q0 -118 18 -100 L22 -86 Q30 -104 52 -112 Q38 -96 34 -70 V0 Z" fill="#1d1518" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
            <path d="M-24 -40 V-82 Q0 -98 24 -82 V-40 Z" fill="#2b1f22" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-22 -80 l8 10 l-4 12 M18 -86 l-6 14 l6 10" fill="none" stroke="#f97316" stroke-width="1.2" opacity="0.75"/>
            <rect x="-44" y="-42" width="88" height="12" rx="3" fill="#2b2124" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-30" y="-36" width="60" height="8" rx="3" fill="#5c1a14" stroke="#05060c" stroke-width="1"/>
            <path d="M-44 -30 V0 M44 -30 V0" stroke="#2b2124" stroke-width="8"/>
            <path class="bd-halo-flicker" d="M-6 -104 l6 -10 l6 10 Z" fill="#dc2626"/>
            <g transform="translate(-56 0)">
                <path d="M-8 0 L-10 -14 H10 L8 0 Z" fill="#4a5058" stroke="#05060c" stroke-width="1.2"/>
                <path d="M-10 -14 Q0 -20 10 -14" fill="none" stroke="#6b7078" stroke-width="1.2"/>
                <path d="M4 -16 L18 -62" stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round"/>
                <path d="M1 -14 q3 -8 7 -4 q3 -6 6 0" fill="none" stroke="#8a8070" stroke-width="2"/>
            </g>
            <g transform="translate(58 0)">
                <path d="M-8 0 L0 -22 L8 0" fill="#ca8a04" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M-3 -6 q2 -6 4 -2 q2 3 3 -1" fill="none" stroke="#05060c" stroke-width="1"/>
            </g>`,
        light: () => ({ dx: 0, dy: -70, color: '#ef4444', radius: 70, flicker: true })
    },
    // Râtelier de l'armurerie : 4 emplacements (fouet de clés, bleu de travail, lance-clés, registre).
    // Origine : centre de la planche (au mur). `taken` : clés d'emplacement vides ('blade', 'overalls',
    // 'keyLauncher', 'rulebook', mêmes clés que DEMONIC_ITEMS) — l'objet emporté laisse son crochet nu.
    armoryRack: {
        markup: (o) => {
            const taken = Array.isArray(o.taken) ? o.taken : [];
            const slot = (key, x, art) => {
                const empty = taken.includes(key);
                return `<g transform="translate(${x} 0)">
                    <path d="M0 -24 v4" stroke="#8a8086" stroke-width="1.6"/><circle cx="0" cy="-25" r="1.6" fill="#8a8086"/>
                    ${empty ? '<path d="M-7 -8 h14" stroke="#05060c" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>' : art}
                    <circle class="bd-halo-flicker" cx="0" cy="22" r="1.8" fill="${empty ? '#3a3236' : '#ef4444'}"/>
                </g>`;
            };
            const whip = `<path d="M-2 -20 L-4 -4" stroke="#3a2a20" stroke-width="3" stroke-linecap="round"/>
                <path d="M-4 -4 q-8 6 -2 12 q8 4 10 -4 q2 -8 -6 -6 q-6 2 -2 8" fill="none" stroke="#f97316" stroke-width="1.6"/>
                <g fill="#fbbf24" stroke="#05060c" stroke-width="0.5"><circle cx="-6" cy="8" r="1.6"/><circle cx="4" cy="6" r="1.6"/><circle cx="0" cy="12" r="1.6"/></g>`;
            const overalls = `<path d="M-9 -20 h18" stroke="#6b5f62" stroke-width="1.5"/>
                <path d="M-8 -19 L-7 -10 H7 L8 -19 M-7 -10 L-9 14 H-2 L0 2 L2 14 H9 L7 -10 Z" fill="#1e40af" stroke="#05060c" stroke-width="1"/>
                <path d="M-6 0 l3 -2 l-1 4 M4 6 l2 -3" stroke="#f97316" stroke-width="1"/><rect x="-3" y="-8" width="6" height="4" fill="#1e3a8a"/>`;
            const launcher = `<path d="M-12 -8 H10 V-3 H-12 Z" fill="#3d3336" stroke="#05060c" stroke-width="1"/>
                <path d="M-2 -3 L-6 8 H-1 L2 -3" fill="#3a2a20" stroke="#05060c" stroke-width="1"/>
                <path d="M8 -15 Q14 -5 8 4" fill="none" stroke="#6b5f62" stroke-width="1.6"/>
                <path d="M10 -6 h6 M14 -8 v4" stroke="#f97316" stroke-width="1.6"/><circle cx="18" cy="-6" r="2" fill="none" stroke="#f97316" stroke-width="1.4"/>`;
            const rulebook = `<rect x="-9" y="-16" width="18" height="24" rx="1.5" fill="#5c1a14" stroke="#05060c" stroke-width="1.2"/>
                <rect x="-6" y="-12" width="12" height="5" fill="#d8c9a3" opacity="0.8"/><path d="M-5 -10 h10" stroke="#5c1a14" stroke-width="0.8"/>
                <path d="M-9 4 h18" stroke="#d8c9a3" stroke-width="1.2" opacity="0.6"/><circle cx="0" cy="-1" r="2.4" fill="none" stroke="#f97316" stroke-width="1"/>`;
            return `
            <rect x="-58" y="-30" width="116" height="60" rx="3" fill="#1a1214" stroke="#05060c" stroke-width="2"/>
            <rect x="-54" y="-26" width="108" height="52" rx="2" fill="#241a1d" stroke="#3a2e30" stroke-width="1"/>
            <path d="M-58 -30 l-6 -8 M58 -30 l6 -8" stroke="#2b2124" stroke-width="4" stroke-linecap="round"/>
            ${slot('blade', -39, whip)}${slot('overalls', -13, overalls)}${slot('keyLauncher', 13, launcher)}${slot('rulebook', 39, rulebook)}`;
        },
        light: () => null
    },
    // Crevasses de lave au sol (antre). Origine : extrémité gauche (au sol). Option : `length` (360).
    lavaCracks: {
        markup: (o) => {
            const len = o.length || 360;
            const cracks = [];
            for (let x = 8, i = 0; x < len - 20; x += 46, i++) {
                const dy = [4, 10, 6, 14, 8, 12][i % 6];
                cracks.push(`M${x} ${dy} l9 -3 l7 5 l10 -2 l6 4 M${x + 16} ${dy + 2} l3 6 l-4 5`);
            }
            const d = cracks.join(' ');
            return `<path d="${d}" fill="none" stroke="#7c2d12" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
            <path class="bd-halo-flicker" d="${d}" fill="none" stroke="#f97316" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="${d}" fill="none" stroke="#fde68a" stroke-width="0.6" stroke-linecap="round" opacity="0.8"/>`;
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

// --- Combats des étages urbains -----------------------------------------------------------------------
// Sur un étage urbain, le combat n'a jamais lieu "dans" le quartier : il se déroule sur la route
// (embuscade de trajet, gardien posté sur la route) ou au fond d'un repaire (plongée). Deux fiches au
// même format que SCENE_BACKDROPS, choisies par la scène de combat quand gameState.urbanMap existe.
const URBAN_COMBAT_BACKDROPS = {
    road: {
        label: 'Route',
        palette: {
            wall: '#1a1d24', wallAlt: '#171a20', mortar: '#0e1014', ceiling: '#06070c',
            floor: '#24262b', floorAlt: '#1d1f24', joint: '#131418', pipe: '#2a2d33'
        },
        wall: 'concrete', floor: 'asphalt', ceiling: 'night', debris: true,
        props: [
            { type: 'highwaySign', x: 118, y: 36, text: 'VILLE SUIVANTE →' },
            { type: 'streetLamp', x: 28, y: 124 },
            { type: 'streetLamp', x: 232, y: 124 },
            { type: 'guardrail', x: 0, y: 124, length: 360 },
            { type: 'wreckedCar', x: 62, y: 124 },
            { type: 'trafficCone', x: 150, y: 124 }
        ],
        floorProps: [
            { type: 'floorStripe', x: 0, y: 125.5, length: 360, color: '#6b7078', h: 3 },
            { type: 'roadLine', x: 0, y: 138, length: 360 }
        ]
    },
    lair: {
        label: 'Repaire',
        palette: {
            wall: '#241a18', wallAlt: '#1f1614', mortar: '#0f0a09', ceiling: '#0c0807',
            floor: '#221816', floorAlt: '#1c1412', joint: '#0f0a09', pipe: '#2b1f1c'
        },
        wall: 'stone', floor: 'flagstones', ceiling: 'pipes', debris: true,
        props: [
            { type: 'torch', x: 70, y: 66, lightColor: '#dc2626', radius: 50 },
            { type: 'torch', x: 290, y: 66, lightColor: '#dc2626', radius: 50, phase: 0.8 },
            { type: 'hook', x: 176, y: 12, len: 40 },
            { type: 'hook', x: 204, y: 12, len: 28 },
            { type: 'skullPile', x: 120, y: 124 },
            { type: 'skullPile', x: 246, y: 124, small: true }
        ]
    }
};

// --- Antre de Gorgoth le Concierge (chantier 17, lot 6) ------------------------------------------------
// Fiche SÉPARÉE (jamais une clé de SCENE_BACKDROPS, réservées aux quartiers de districts.js), au même
// format, passée telle quelle à composeBackdrop(). Obsidienne aux joints de braise, torches à flamme rouge,
// râtelier de l'armurerie, trône vide (Gorgoth se tient devant), porte colossale entrouverte derrière le
// crawler et crevasses de lave au sol. Lue par la scène haute du combat (lot 7) si elle existe.
const DEMON_LAIR_BACKDROP = {
    label: 'Antre du Concierge',
    palette: {
        wall: '#1b1418', wallAlt: '#161014', mortar: '#3b120c', ceiling: '#0a0608',
        floor: '#1a1214', floorAlt: '#140e10', joint: '#2a0d08', pipe: '#2a1c1e'
    },
    wall: 'obsidian', floor: 'flagstones', ceiling: 'vault', debris: true,
    props: [
        { type: 'torch', x: 22, y: 70, lightColor: '#dc2626', radius: 48 },
        { type: 'armoryRack', x: 86, y: 62 },
        { type: 'demonThrone', x: 196, y: 124 },
        { type: 'torch', x: 262, y: 70, lightColor: '#dc2626', radius: 48, phase: 0.9 },
        { type: 'colossalGate', x: 330, y: 124, w: 44, h: 92, open: true }
    ],
    floorProps: [
        { type: 'lavaCracks', x: 0, y: 127, length: 360 }
    ]
};

// --- Salles sécurisées ---------------------------------------------------------------------------------
// Fiche de base commune (ne dépend pas du quartier : une salle sécurisée est un abri clos) : béton
// chaud, porte blindée, panneau « ZONE SÛRE », éclairage chaud et apaisé — aucun rouge, aucune
// animation rapide. Les accessoires signature de chaque type (safehouses.js, clé = nom exact) viennent
// s'ajouter à gauche, entre le bord et la porte ; la zone du crawler, à droite, reste dégagée.
const SAFEHOUSE_BACKDROP = {
    label: 'Salle sécurisée',
    palette: {
        wall: '#2f2a24', wallAlt: '#2a251f', mortar: '#1b1814', ceiling: '#17140f',
        floor: '#2e261d', floorAlt: '#282119', joint: '#1a1510', pipe: '#34302a'
    },
    wall: 'concrete', floor: 'planks', ceiling: 'beams', debris: false,
    props: [
        { type: 'armoredDoor', x: 214, y: 124 },
        { type: 'safeZonePanel', x: 214, y: 30 },
        { type: 'sconce', x: 262, y: 58, color: '#fde68a' }
    ]
};

const SAFEHOUSE_SIGNATURES = {
    "Taverne Clandestine": [
        { type: 'calmNeon', x: 92, y: 40, text: 'TAVERNE', color: '#fbbf24', icon: 'M-5 -5 H3 V6 H-5 Z M3 -2 H6 V3 H3' },
        { type: 'barrel', x: 62, y: 124 },
        { type: 'barrel', x: 104, y: 124, mug: true }
    ],
    "Hôtel de Fortune": [
        { type: 'hangingBulb', x: 96, y: 8, length: 26 },
        { type: 'mattress', x: 94, y: 124 }
    ],
    "Poste de Secours": [
        { type: 'firstAidSign', x: 82, y: 54 },
        { type: 'medkit', x: 118, y: 124 }
    ],
    "Bivouac de Fortune": [
        { type: 'fireBarrel', x: 96, y: 124 },
        { type: 'crate', x: 136, y: 124 }
    ],
    "Chapelle Improvisée": [
        { type: 'prayerGraffiti', x: 94, y: 58 },
        { type: 'candles', x: 94, y: 124 }
    ],
    "Vestiaire Abandonné": [
        { type: 'hangingBulb', x: 150, y: 8, length: 22 },
        { type: 'lockers', x: 90, y: 124 }
    ],
    "Bureau de Contremaître": [
        { type: 'metalDesk', x: 82, y: 124 },
        { type: 'officeChair', x: 136, y: 124 }
    ],
    "Infirmerie de Chantier": [
        { type: 'pharmacyCabinet', x: 92, y: 62 },
        { type: 'hangingBulb', x: 150, y: 8, length: 22 }
    ]
};

// Fiche complète d'une salle sécurisée : base commune + accessoires signature de son type (type
// inconnu : base seule). Pure — même format que SCENE_BACKDROPS, dessinée par composeBackdrop().
function safehouseBackdropFor(typeName) {
    const signature = Object.prototype.hasOwnProperty.call(SAFEHOUSE_SIGNATURES, typeName) ? SAFEHOUSE_SIGNATURES[typeName] : [];
    return { ...SAFEHOUSE_BACKDROP, props: [...SAFEHOUSE_BACKDROP.props, ...signature] };
}

// --- Écran Game Over (vue de DESSUS) --------------------------------------------------------------------
// Scène 280 x 170 : le sol du quartier vu d'en haut, le cadavre du crawler (SCENE_CORPSE_TOPDOWN_SVG) au
// centre dans sa mare de sang, des plots numérotés de scène de crime, des mouches, et un indice propre à
// la cause de la mort (gameOver() dans app.js). Humour noir façon Dungeon Crawler Carl : la mort est un
// épisode comme un autre.
const GAME_OVER_VIEW = { w: 280, h: 170 };
const GAME_OVER_BODY = { x: 142, y: 86, angle: -24 };

// Mare de sang, dans le repère du cadavre (centrée un peu vers la tête). S'étale une fois à l'affichage
// (.go-blood-spread, coupée sous prefers-reduced-motion).
const GAME_OVER_BLOOD_POOL = `
    <path d="M-44 -58 Q-20 -76 12 -66 Q44 -62 52 -34 Q62 -6 40 14 Q30 34 6 30 Q-18 40 -36 22 Q-60 6 -54 -22 Q-62 -44 -44 -58 Z" fill="#5c0d12" stroke="#2a0508" stroke-width="1.5"/>
    <path d="M-34 -50 Q-12 -64 14 -56 Q38 -50 42 -30 Q48 -8 30 6 Q14 22 -8 18 Q-30 22 -40 4 Q-52 -16 -34 -50 Z" fill="#7a141b"/>
    <path d="M52 -30 q14 4 18 14 q-10 2 -16 -4 Z M-54 8 q-12 8 -10 18 q8 -2 10 -10 Z" fill="#5c0d12"/>
    <ellipse cx="-14" cy="-50" rx="16" ry="4" transform="rotate(-12 -14 -50)" fill="#fff" opacity="0.1"/>`;

// Plot jaune numéroté de scène de crime. Origine : base du plot.
function evidenceMarker(n) {
    return `<path d="M-6 0 L0 -12 L6 0 Z" fill="#facc15" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>
        <text x="0" y="-2.5" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#05060c">${n}</text>`;
}

// Indice de la cause de la mort, en coordonnées de la scène.
const GAME_OVER_CAUSE_PROPS = {
    // Empreintes griffues ensanglantées qui s'éloignent : le coupable ne s'est pas attardé.
    combat: `
        <g fill="#5c0d12" opacity="0.8">
            ${[[206, 118, 20], [222, 132, 28], [238, 142, 18], [252, 156, 30]].map(([x, y, a]) => `
            <g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="4" ry="5"/><circle cx="-4" cy="-7" r="1.6"/><circle cx="0" cy="-8.5" r="1.6"/><circle cx="4" cy="-7" r="1.6"/></g>`).join('')}
        </g>`,
    // Plaque à pointes encore sortie, juste sous les bottes.
    trap: `
        <g transform="translate(146 152)">
            <rect x="-20" y="-12" width="40" height="24" rx="2" fill="#3a3e44" stroke="#05060c" stroke-width="1.5"/>
            ${[-12, 0, 12].map(x => [-5, 5].map(y => `<path d="M${x - 3} ${y + 3} L${x} ${y - 3} L${x + 3} ${y + 3} Z" fill="#9ca3af" stroke="#05060c" stroke-width="0.8"/>`).join('')).join('')}
        </g>`,
    // Longue traînée de sang : il a marché un moment avant de s'effondrer.
    bleed: `
        <path d="M280 22 Q240 30 226 46 Q210 62 184 66" fill="none" stroke="#5c0d12" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
        <g fill="#5c0d12"><circle cx="262" cy="18" r="2.5"/><circle cx="246" cy="30" r="2"/><circle cx="214" cy="52" r="2.5"/></g>`,
    // Brûlure et grimoire fumant : le sort est parti dans le mauvais sens.
    backfire: `
        <ellipse cx="70" cy="54" rx="30" ry="22" fill="#05060c" opacity="0.55"/>
        <ellipse cx="70" cy="54" rx="18" ry="12" fill="#05060c" opacity="0.5"/>
        <g transform="translate(64 50) rotate(-18)">
            <rect x="-11" y="-8" width="11" height="16" fill="#5b2d7a" stroke="#05060c" stroke-width="1.2"/>
            <rect x="0" y="-8" width="11" height="16" fill="#4a2463" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-8 -3 h6 M-8 1 h5 M3 -3 h6" stroke="#c084fc" stroke-width="0.8"/>
        </g>
        <g class="bd-steam"><circle cx="62" cy="40" r="5" fill="#9ca3af" opacity="0.35"/></g>
        <g class="bd-steam" style="animation-delay:-1.4s"><circle cx="70" cy="38" r="4" fill="#9ca3af" opacity="0.35"/></g>`,
    // Gravats tombés du plafond et sablier vide : le donjon s'est effondré à l'heure dite.
    timeout: `
        <g fill="#5a5a60" stroke="#05060c" stroke-width="1.2">
            <path d="M40 30 l14 -4 l6 10 l-12 8 Z"/><path d="M222 120 l18 -2 l2 12 l-16 4 Z"/><path d="M98 142 l10 -6 l8 8 l-10 6 Z"/>
            <path d="M200 34 l9 -2 l3 7 l-8 4 Z"/>
        </g>
        <path d="M30 70 l20 8 l8 20 M230 60 l-14 14 l4 18" fill="none" stroke="#05060c" stroke-width="1.2" opacity="0.7"/>
        <g transform="translate(58 128) rotate(70)">
            <path d="M-6 -10 H6 L0 0 L6 10 H-6 L0 0 Z" fill="#d8d6cc" fill-opacity="0.35" stroke="#caa23a" stroke-width="1.5"/>
            <path d="M-8 -10 H8 M-8 10 H8" stroke="#6b4a2a" stroke-width="2.5"/>
        </g>`,
    // Gorgoth le Concierge (chantier 17, lot 9) : empreintes de sabot calcinées, braises encore rougeoyantes, clé fondue
    // et casquette de concierge roussie abandonnée près du corps. Il est reparti travailler.
    demon: `
        <g fill="#05060c" opacity="0.7">
            ${[[34, 150, -14], [58, 124, -8], [40, 96, -16], [66, 70, -6]].map(([x, y, a]) => `
            <g transform="translate(${x} ${y}) rotate(${a})"><path d="M-7 6 Q-9 -6 -2 -9 L-1 6 Z M7 6 Q9 -6 2 -9 L1 6 Z"/><ellipse rx="11" ry="9" opacity="0.35"/></g>`).join('')}
        </g>
        <g class="bd-crackle" fill="#f59e0b" opacity="0.75">
            <circle cx="36" cy="146" r="1.4"/><circle cx="60" cy="120" r="1.2"/><circle cx="42" cy="92" r="1.3"/><circle cx="68" cy="66" r="1.1"/>
        </g>
        <g transform="translate(96 140) rotate(-30)">
            <path d="M-12 0 Q-6 -3 0 -1 Q6 2 10 0 Q14 6 8 8 Q2 10 -4 7 Q-10 6 -12 0 Z" fill="#7a5a1e" opacity="0.6"/>
            <circle cx="-8" cy="0" r="4.5" fill="none" stroke="#caa23a" stroke-width="2"/>
            <path d="M-3.5 0 H6 Q9 2 7 5 M2 0 v3 M5 0 v2" fill="none" stroke="#caa23a" stroke-width="2" stroke-linecap="round"/>
            <circle cx="7" cy="5" r="1.6" fill="#f59e0b"/>
        </g>
        <g transform="translate(226 44) rotate(18)">
            <ellipse cx="0" cy="4" rx="17" ry="5" fill="#1e2433" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-12 3 Q-12 -10 0 -11 Q12 -10 12 3 Z" fill="#2b3446" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-5" y="-6" width="10" height="4" rx="1" fill="#caa23a" stroke="#05060c" stroke-width="0.6"/>
            <path d="M-9 -4 q4 -3 7 0 M3 -8 q4 1 5 4" fill="none" stroke="#05060c" stroke-width="1.4" opacity="0.8"/>
        </g>
        <g class="bd-steam"><circle cx="222" cy="30" r="4" fill="#9ca3af" opacity="0.3"/></g>`
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BACKDROP_WIDTH, BACKDROP_HEIGHT, BACKDROP_GROUND_Y, BACKDROP_WALL_PATTERNS, BACKDROP_FLOOR_PATTERNS,
        BACKDROP_CEILINGS, BACKDROP_PROPS, BACKDROP_DEBRIS, SCENE_BACKDROPS, SHOP_SIGN_STYLES, TRAINER_BOARD_STYLES,
        SAFEHOUSE_BACKDROP, SAFEHOUSE_SIGNATURES, safehouseBackdropFor,
        GAME_OVER_VIEW, GAME_OVER_BODY, GAME_OVER_BLOOD_POOL, GAME_OVER_CAUSE_PROPS, evidenceMarker,
        URBAN_COMBAT_BACKDROPS, DEMON_LAIR_BACKDROP
    };
}
