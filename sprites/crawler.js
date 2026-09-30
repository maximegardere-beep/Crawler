// sprites/crawler.js - Le crawler (le Portefaix) : silhouette de profil de la scène, et son cadavre vu de
// dessus (écran Game Over). Découpé de l'ancien sprites.js pour que chaque fichier reste court à relire.
// Repère commun à toutes les silhouettes des fichiers sprites/*.js : x = 0 au
// centre du personnage, y = 0 au niveau du sol (les pieds), y négatif vers le haut. Chaque chaîne est le
// CONTENU d'un <g> SVG, que scene.js translate à sa position dans la scène. Contours sombres #05060c.
// Catalogue pur, sans DOM ni gameState : scene.js lit ces constantes, jamais l'inverse.

// Crawler, de profil, tourné vers la gauche (vers le mob). Capuche, sac à dos. Découpé en COUCHES pour
// porter son équipement (voir composeCrawler() dans scene.js) : ombre + jambes + sac, torse, tête, et un
// bras AVANT par posture — la posture suit la dernière attaque utilisée (arme, tir, magie, mains nues).
// Ordre de dessin : base -> [arme à distance rangée dans le dos] -> [arme de mêlée rangée à la hanche]
// -> torse -> [armure] -> bras de la posture (+ objet tenu) -> tête -> [poings du boxeur, devant le
// visage]. S'étend de x = -13 (main avant, bras au repos) à x = +20 (sac).
const CRAWLER_PARTS = {
    base: `
    <ellipse class="scene-ground-shadow" cx="3" cy="0" rx="17" ry="3.5"/>
    <rect x="-1" y="-34" width="7" height="30" rx="3" fill="#4a3c2a" stroke="#05060c" stroke-width="2"/>
    <rect x="-8" y="-34" width="7" height="30" rx="3" fill="#5a4a34" stroke="#05060c" stroke-width="2"/>
    <path d="M-12 -6 h10 v6 h-12 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-4 -6 h10 v6 h-12 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="7" y="-66" width="13" height="27" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="10" y="-60" width="7" height="8" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
    torso: `
    <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L10 -33 L-10 -33 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-3 -68 L7 -50" stroke="#8a5a2e" stroke-width="3" stroke-linecap="round"/>`,
    head: `
    <rect x="-3" y="-74" width="5" height="7" fill="#c98a5e"/>
    <circle cx="1" cy="-81" r="10.5" fill="#2f2318" stroke="#05060c" stroke-width="2.5"/>
    <circle cx="-3" cy="-79" r="7" fill="#c98a5e"/>
    <circle cx="-6.5" cy="-80" r="1.3" fill="#05060c"/>`
};

// Bras avant par posture : tracé (manche + main) et point de prise `hand` où scene.js accroche l'objet
// tenu. `rest` : bras le long du corps (aucune arme ni sort). `weapon` : arme de mêlée levée. `ranged` :
// bras tendu, arme à distance pointée vers le mob. `rangedLowered` : même arme, canon baissé (au contact,
// où l'on ne peut pas tirer). `magic` : paume ouverte vers le mob, lueur du sort. `boxer` : garde haute,
// deux poings devant le visage (le poing arrière est dessiné APRÈS la tête, voir `front`).
const crawlerSleeve = (d) => `
    <path d="${d}" fill="none" stroke="#05060c" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#4a3a24" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const crawlerHand = (x, y, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c98a5e" stroke="#05060c" stroke-width="1.2"/>`;
const CRAWLER_ARMS = {
    rest: { arm: `<rect x="-12" y="-64" width="6" height="24" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>${crawlerHand(-9, -39)}`, hand: [-9, -39] },
    weapon: { arm: crawlerSleeve('M-8 -62 L-10 -50 L-14 -46'), hand: [-15, -46], after: crawlerHand(-15, -46) },
    ranged: { arm: crawlerSleeve('M-8 -62 L-15 -58 L-19 -57'), hand: [-20, -57], after: crawlerHand(-20, -57) },
    rangedLowered: { arm: crawlerSleeve('M-8 -62 L-10 -50 L-12 -44'), hand: [-12, -43], after: crawlerHand(-12, -43) },
    magic: { arm: crawlerSleeve('M-8 -62 L-13 -66 L-17 -72'), hand: [-18, -73], after: `
    <path d="M-21 -76 l-1.5 -3 M-18.5 -77 l0 -3.5 M-16 -76 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-21 -76 l-1.5 -3 M-18.5 -77 l0 -3.5 M-16 -76 l1.5 -3" stroke="#c98a5e" stroke-width="1.2" stroke-linecap="round"/>
    ${crawlerHand(-18, -73, 3.2)}` },
    boxer: { arm: crawlerSleeve('M-8 -62 L-11 -52 L-15 -64'), hand: [-16, -66], after: crawlerHand(-16, -66, 3.8),
        front: crawlerHand(-11, -71, 3.6) }
};

// Lueur du sort équipé dans la paume (posture `magic`), par icône de sort (spells.js) ; repli violet.
const CRAWLER_SPELL_GLOWS = {
    '⚡': '#fde047', '🌩️': '#fde047', '🧊': '#7dd3fc', '❄️': '#7dd3fc',
    '🔥': '#fb923c', '☄️': '#f97316', '👻': '#c7d2fe', '🧪': '#a3e635',
    '🧛': '#dc2626', '👋': '#e0f2fe', '🔩': '#b45309', '🐝': '#facc15', '💡': '#fef9c3', '⛓️': '#93c5fd',
    '😱': '#a78bfa', '💚': '#4ade80', '🔰': '#60a5fa', '🌑': '#6b7280'
};
const CRAWLER_DEFAULT_GLOW = '#c084fc';

// Silhouette complète au repos (sans équipement) : utilisée telle quelle là où aucun état de jeu n'est
// lu, et comme référence visuelle des couleurs du crawler.
const SCENE_CRAWLER_SVG = CRAWLER_PARTS.base + CRAWLER_PARTS.torso + CRAWLER_ARMS.rest.arm + CRAWLER_PARTS.head;

// Cadavre du crawler VU DE DESSUS (écran Game Over), face contre terre : sac à dos encore sur le dos,
// bras en croix, jambes écartées. Repère : x = 0, y = 0 au milieu du torse, tête vers y négatif ;
// s'étend d'environ -42 à +42 en x et de -54 à +56 en y. Mêmes couleurs que SCENE_CRAWLER_SVG.
const SCENE_CORPSE_TOPDOWN_SVG = `
    <path d="M-7 8 L-19 50" stroke="#05060c" stroke-width="11" stroke-linecap="round"/>
    <path d="M-7 8 L-19 50" stroke="#5a4a34" stroke-width="8" stroke-linecap="round"/>
    <path d="M7 8 L16 30 L24 50" fill="none" stroke="#05060c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 8 L16 30 L24 50" fill="none" stroke="#4a3c2a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-20" cy="55" rx="5" ry="7" transform="rotate(20 -20 55)" fill="#241a10" stroke="#05060c" stroke-width="1.5"/>
    <ellipse cx="26" cy="54" rx="5" ry="7" transform="rotate(-25 26 54)" fill="#241a10" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-12 -24 L-30 -42" stroke="#05060c" stroke-width="10" stroke-linecap="round"/>
    <path d="M-12 -24 L-30 -42" stroke="#4a3a24" stroke-width="7" stroke-linecap="round"/>
    <circle cx="-33" cy="-45" r="4" fill="#c98a5e" stroke="#05060c" stroke-width="1.2"/>
    <path d="M12 -22 L30 -18 L40 -6" fill="none" stroke="#05060c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 -22 L30 -18 L40 -6" fill="none" stroke="#4a3a24" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="41" cy="-3" r="4" fill="#c98a5e" stroke="#05060c" stroke-width="1.2"/>
    <rect x="-15" y="-30" width="30" height="42" rx="8" fill="#6b5638" stroke="#05060c" stroke-width="2.5"/>
    <rect x="-11" y="-25" width="22" height="30" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="-6" y="-8" width="12" height="9" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-9 -22 H9" stroke="#2f2418" stroke-width="1.5"/>
    <path d="M-14 -28 L12 10" stroke="#8a5a2e" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    <ellipse cx="-9" cy="-42" rx="2.5" ry="3.5" fill="#c98a5e" stroke="#05060c" stroke-width="1"/>
    <circle cx="0" cy="-42" r="10" fill="#2f2318" stroke="#05060c" stroke-width="2.5"/>
    <path d="M-5 -47 Q0 -40 5 -47 M-6 -41 Q0 -36 6 -41" fill="none" stroke="#1f170f" stroke-width="1.2"/>
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CRAWLER_PARTS, CRAWLER_ARMS, CRAWLER_SPELL_GLOWS, CRAWLER_DEFAULT_GLOW, SCENE_CRAWLER_SVG, SCENE_CORPSE_TOPDOWN_SVG };
}
