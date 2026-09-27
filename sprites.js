// sprites.js - Silhouettes de la scène de combat (vue 2D latérale). Catalogue pur, sans DOM ni
// gameState : scene.js lit ces constantes, jamais l'inverse.
//
// Repère commun à toutes les silhouettes : x = 0 au centre du personnage, y = 0 au niveau du sol
// (les pieds), y négatif vers le haut. Chaque chaîne est le CONTENU d'un <g> SVG, que scene.js
// translate à sa position dans la scène. Formes simples (tête, corps, un signe distinctif), jamais de
// détail : silhouettes génériques, contours sombres #05060c.
//
// Les mobs regardent vers la droite (vers le crawler) et tiennent tous dans [-MOB_EXTENT, +MOB_EXTENT]
// horizontalement (voir scene.js) : c'est cette borne, et non la forme exacte, qui garantit l'absence
// de chevauchement au contact. Teintes via les classes mf-* (index.html), pilotées par les variables
// CSS --mob-base/--mob-dark/--mob-accent que scene.js pose selon l'effet du mob.

// Crawler, de profil, tourné vers la gauche (vers le mob). Capuche, sac à dos, pas d'arme visible
// (l'arme est déjà représentée par l'équipement). S'étend de x = -13 (main avant) à x = +20 (sac).
const SCENE_CRAWLER_SVG = `
    <ellipse class="scene-ground-shadow" cx="3" cy="0" rx="17" ry="3.5"/>
    <rect x="-1" y="-34" width="7" height="30" rx="3" fill="#4a3c2a" stroke="#05060c" stroke-width="2"/>
    <rect x="-8" y="-34" width="7" height="30" rx="3" fill="#5a4a34" stroke="#05060c" stroke-width="2"/>
    <path d="M-12 -6 h10 v6 h-12 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-4 -6 h10 v6 h-12 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="7" y="-66" width="13" height="27" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="10" y="-60" width="7" height="8" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L10 -33 L-10 -33 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-3 -68 L7 -50" stroke="#8a5a2e" stroke-width="3" stroke-linecap="round"/>
    <rect x="-12" y="-64" width="6" height="24" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <circle cx="-9" cy="-39" r="3" fill="#c98a5e" stroke="#05060c" stroke-width="1.2"/>
    <rect x="-3" y="-74" width="5" height="7" fill="#c98a5e"/>
    <circle cx="1" cy="-81" r="10.5" fill="#2f2318" stroke="#05060c" stroke-width="2.5"/>
    <circle cx="-3" cy="-79" r="7" fill="#c98a5e"/>
    <circle cx="-6.5" cy="-80" r="1.3" fill="#05060c"/>
`;

// Compagnon, de profil, tourné vers la gauche, plus petit que le crawler. Teinté par spécialité
// (mêmes classes mf-* que les mobs). S'étend de x = -9 à x = +8.
const SCENE_COMPANION_SVG = `
    <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="11" ry="2.5"/>
    <rect class="mf-dark" x="-6" y="-24" width="5" height="23" rx="2.5"/>
    <rect class="mf-dark" x="0" y="-24" width="5" height="23" rx="2.5"/>
    <rect class="mf-base" x="-8" y="-46" width="16" height="24" rx="5"/>
    <circle class="mf-base" cx="-1" cy="-54" r="8"/>
    <circle cx="-5" cy="-55" r="1.3" fill="#05060c"/>
`;

// Un mob par silhouette (clé = `visualArchetype` dans bestiary.js). `top` : ordonnée du point le plus
// haut de la silhouette (négatif), pour poser la couronne d'un boss et les chiffres de dégâts.
const SCENE_MOB_SPRITES = {
    // Petit humanoïde — signe : grande oreille pointue.
    goblinoid: {
        top: -70,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="15" ry="3"/>
            <rect class="mf-dark" x="-8" y="-22" width="6" height="21" rx="3"/>
            <rect class="mf-dark" x="1" y="-22" width="6" height="21" rx="3"/>
            <rect class="mf-base" x="-11" y="-46" width="22" height="27" rx="8"/>
            <rect class="mf-dark" x="5" y="-42" width="13" height="5" rx="2.5"/>
            <path class="mf-base" d="M-5 -60 L-21 -70 L-9 -51 Z"/>
            <circle class="mf-base" cx="1" cy="-58" r="12"/>
            <path class="mf-base" d="M12 -60 L18 -56 L12 -53 Z"/>
            <circle class="mf-accent" cx="7" cy="-60" r="2.2"/>`
    },
    // Quadrupède — signe : queue relevée et museau.
    beast: {
        top: -47,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="22" ry="3"/>
            <path class="mf-line" d="M-18 -28 Q-24 -36 -21 -45"/>
            <rect class="mf-dark" x="-17" y="-18" width="5" height="17" rx="2"/>
            <rect class="mf-dark" x="-9" y="-18" width="5" height="17" rx="2"/>
            <rect class="mf-dark" x="5" y="-18" width="5" height="17" rx="2"/>
            <rect class="mf-dark" x="12" y="-18" width="5" height="17" rx="2"/>
            <ellipse class="mf-base" cx="-2" cy="-25" rx="19" ry="10"/>
            <path class="mf-dark" d="M11 -39 L12 -47 L17 -40 Z"/>
            <circle class="mf-base" cx="15" cy="-33" r="8"/>
            <rect class="mf-base" x="17" y="-33" width="7" height="6" rx="2"/>
            <circle class="mf-accent" cx="17" cy="-35" r="1.8"/>`
    },
    // Humanoïde zombifié — signe : bras tendu vers l'avant.
    zombie: {
        top: -77,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="15" ry="3"/>
            <rect class="mf-dark" x="-8" y="-26" width="7" height="25" rx="3"/>
            <rect class="mf-dark" x="0" y="-26" width="7" height="25" rx="3"/>
            <rect class="mf-base" x="-11" y="-56" width="22" height="32" rx="6"/>
            <rect class="mf-dark" x="3" y="-52" width="21" height="6" rx="3"/>
            <circle class="mf-base" cx="1" cy="-66" r="11"/>
            <rect class="mf-accent" x="6" y="-69" width="4" height="2.5"/>`
    },
    // Machine possédée — signe : écran et antenne.
    machine: {
        top: -74,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="20" ry="3"/>
            <rect class="mf-dark" x="-15" y="-7" width="9" height="6" rx="1.5"/>
            <rect class="mf-dark" x="6" y="-7" width="9" height="6" rx="1.5"/>
            <line x1="-8" y1="-58" x2="-8" y2="-70" stroke="#05060c" stroke-width="2"/>
            <circle class="mf-accent" cx="-8" cy="-71" r="2.6"/>
            <rect class="mf-base" x="-18" y="-58" width="36" height="52" rx="5"/>
            <rect class="mf-accent" x="0" y="-52" width="14" height="14" rx="2" opacity="0.85"/>
            <circle class="mf-dark" cx="-9" cy="-24" r="3"/>
            <circle class="mf-dark" cx="1" cy="-24" r="3"/>`
    },
    // Végétal — signe : feuilles et gueule ouverte.
    plant: {
        top: -70,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="3"/>
            <rect class="mf-dark" x="-3" y="-44" width="6" height="44" rx="2"/>
            <ellipse class="mf-dark" cx="-10" cy="-20" rx="9" ry="4" transform="rotate(-25 -10 -20)"/>
            <ellipse class="mf-dark" cx="10" cy="-30" rx="9" ry="4" transform="rotate(25 10 -30)"/>
            <circle class="mf-base" cx="2" cy="-56" r="14"/>
            <path class="mf-accent" d="M6 -56 L17 -61 L17 -51 Z"/>`
    },
    // Incorporel — signe : corps ondulé qui flotte au-dessus de son ombre.
    shade: {
        top: -80,
        markup: `
            <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="13" ry="2.5" opacity="0.6"/>
            <path class="mf-base" d="M-16 -16 C-18 -50 -10 -80 4 -80 C18 -80 22 -52 20 -16 C14 -22 10 -12 4 -18 C-2 -12 -8 -22 -16 -16 Z" opacity="0.9"/>
            <circle class="mf-accent" cx="8" cy="-60" r="2.5"/>
            <circle class="mf-accent" cx="15" cy="-60" r="2.2"/>`
    },
    // Masse gélatineuse — signe : bulles.
    blob: {
        top: -44,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="22" ry="3"/>
            <path class="mf-base" d="M-22 -2 C-24 -30 -10 -44 0 -44 C12 -44 24 -30 22 -2 Z"/>
            <circle class="mf-dark" cx="-9" cy="-18" r="3"/>
            <circle class="mf-dark" cx="-3" cy="-31" r="2"/>
            <circle class="mf-accent" cx="8" cy="-26" r="2.6"/>
            <circle class="mf-accent" cx="15" cy="-24" r="2.2"/>`
    },
    // Multi-membres — signe : câbles et étincelle.
    swarm: {
        top: -57,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="18" ry="3"/>
            <path class="mf-line" d="M0 -40 L-20 -8"/>
            <path class="mf-line" d="M0 -40 L-6 -2"/>
            <path class="mf-line" d="M0 -40 L10 -2"/>
            <path class="mf-line" d="M0 -40 L21 -10"/>
            <circle class="mf-base" cx="0" cy="-42" r="15"/>
            <path d="M16 -54 L21 -50 L17 -48 L22 -43" fill="none" stroke="var(--mob-accent, #c23b3b)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle class="mf-accent" cx="7" cy="-44" r="2.6"/>`
    },
    // Objet humanoïde inanimé — signe : tête sans visage sur pied.
    mannequin: {
        top: -87,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="12" ry="3"/>
            <rect class="mf-dark" x="-9" y="-4" width="18" height="4" rx="1"/>
            <rect class="mf-dark" x="-1.5" y="-24" width="3" height="21"/>
            <rect class="mf-base" x="-8" y="-33" width="16" height="10" rx="3"/>
            <path class="mf-base" d="M-10 -62 Q-12 -46 -7 -32 L7 -32 Q12 -46 10 -62 Z"/>
            <line x1="-10" y1="-48" x2="10" y2="-48" stroke="#05060c" stroke-width="1.5"/>
            <rect class="mf-base" x="-2.5" y="-69" width="5" height="8"/>
            <ellipse class="mf-base" cx="0" cy="-77" rx="8" ry="10"/>`
    },
    // Véhicule — signe : roues et phare avant.
    vehicle: {
        top: -40,
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="24" ry="3"/>
            <path class="mf-base" d="M-14 -26 L-8 -40 L10 -40 L16 -26 Z"/>
            <path class="mf-dark" d="M-6 -37 L9 -37 L13 -28 L-10 -28 Z"/>
            <rect class="mf-base" x="-24" y="-27" width="48" height="16" rx="4"/>
            <rect class="mf-accent" x="19" y="-23" width="4" height="5" rx="1"/>
            <circle class="mf-dark" cx="-13" cy="-8" r="7"/>
            <circle class="mf-dark" cx="13" cy="-8" r="7"/>`
    }
};

// PNJ des villes spécialisées, de profil, tournés vers la droite (vers le crawler). Même repère que
// les autres silhouettes (x = 0 au centre, y = 0 au sol). Couleurs fixes et ternes : ce ne sont pas
// des ennemis, aucun accent rouge.
// Marchand : casquette, tablier, bras posé sur le comptoir (voir shopCounter dans backdrops.js).
const SCENE_MERCHANT_SVG = `
    <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="3"/>
    <rect x="-7" y="-26" width="6" height="25" rx="2.5" fill="#2e2a33" stroke="#05060c" stroke-width="1.5"/>
    <rect x="0" y="-26" width="6" height="25" rx="2.5" fill="#2e2a33" stroke="#05060c" stroke-width="1.5"/>
    <rect x="-10" y="-58" width="20" height="34" rx="5" fill="#4a3b52" stroke="#05060c" stroke-width="2"/>
    <path d="M1 -52 H11 V-26 H1 Z" fill="#6b6150" stroke="#05060c" stroke-width="1.2"/>
    <rect x="3" y="-50" width="17" height="5" rx="2.5" fill="#3b2f45" stroke="#05060c" stroke-width="1.2"/>
    <circle cx="20" cy="-47.5" r="2.6" fill="#b98a62" stroke="#05060c" stroke-width="1"/>
    <rect x="-2" y="-64" width="5" height="6" fill="#b98a62"/>
    <circle cx="1" cy="-71" r="9" fill="#b98a62" stroke="#05060c" stroke-width="2"/>
    <path d="M-9 -73 Q-8 -82 2 -82 Q10 -82 10 -75 L15 -74 L15 -72 L-9 -72 Z" fill="#2a2330" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="6" cy="-70" r="1.2" fill="#05060c"/>
    <path d="M4 -65.5 Q7 -64 10 -65.5" fill="none" stroke="#3a2a1c" stroke-width="1.6" stroke-linecap="round"/>
`;

// Professeur : longue blouse, lunettes, barbe grise ; tend une baguette vers le tableau derrière lui.
const SCENE_TRAINER_SVG = `
    <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="3"/>
    <rect x="-6" y="-22" width="5" height="21" rx="2.5" fill="#2a2d33" stroke="#05060c" stroke-width="1.5"/>
    <rect x="1" y="-22" width="5" height="21" rx="2.5" fill="#2a2d33" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-10 -60 Q-12 -38 -12 -18 L12 -18 Q12 -38 10 -60 Z" fill="#3b4a5a" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-2 -60 L2 -46 L6 -60" fill="none" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-8 -56 L-18 -66" stroke="#3b4a5a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="-19" cy="-67" r="2.6" fill="#b98a62" stroke="#05060c" stroke-width="1"/>
    <path d="M-20 -68 L-46 -86" stroke="#a38a5a" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="-2" y="-66" width="5" height="6" fill="#b98a62"/>
    <circle cx="1" cy="-73" r="9" fill="#b98a62" stroke="#05060c" stroke-width="2"/>
    <path d="M-8 -76 Q-7 -83 1 -83 Q8 -83 9 -78 Q3 -80 -3 -77 Z" fill="#9a9a9a" stroke="#05060c" stroke-width="1"/>
    <path d="M3 -68 Q7 -62 11 -68 Q8 -66 3 -68 Z" fill="#b8b8b8" stroke="#05060c" stroke-width="0.8"/>
    <circle cx="6" cy="-73" r="2.6" fill="none" stroke="#05060c" stroke-width="1.2"/>
    <path d="M8.6 -73 H10" stroke="#05060c" stroke-width="1.2"/>
`;

// Couronne de boss, posée au-dessus de la silhouette (y = 0 = base de la couronne).
const SCENE_BOSS_CROWN_SVG = `
    <path d="M-10 0 L-9 -10 L-4 -5 L0 -13 L4 -5 L9 -10 L10 0 Z" fill="#caa23a" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_CRAWLER_SVG, SCENE_COMPANION_SVG, SCENE_MOB_SPRITES, SCENE_BOSS_CROWN_SVG, SCENE_MERCHANT_SVG, SCENE_TRAINER_SVG };
}
