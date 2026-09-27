// sprites/mobs.js - Silhouettes des mobs (une par `visualArchetype`, bestiary.js) et couronne de boss.
// Repère commun à toutes les silhouettes des fichiers sprites/*.js : x = 0 au
// centre du personnage, y = 0 au niveau du sol (les pieds), y négatif vers le haut. Chaque chaîne est le
// CONTENU d'un <g> SVG, que scene.js translate à sa position dans la scène. Contours sombres #05060c.
// Catalogue pur, sans DOM ni gameState : scene.js lit ces constantes, jamais l'inverse.
//
// Les mobs regardent vers la droite (vers le crawler) et tiennent tous dans [-24, +24] horizontalement,
// silhouette ET détail ET aura compris : c'est cette borne qui garantit l'absence de chevauchement au
// contact. Teintes via les classes mf-* (index.html), pilotées par les variables CSS
// --mob-base/--mob-dark/--mob-accent que scene.js pose selon la palette propre du mob (remplace
// l'ancienne teinte par effet). Les silhouettes restent GÉNÉRIQUES : c'est le détail signature de
// mob-details-a.js / mob-details-b.js qui fait le mob, et les boss les réutilisent telles quelles
// (couronnées) en attendant leurs sprites dédiés.
//
// `top` : ordonnée du point le plus haut de la silhouette (négatif), pour poser la couronne d'un boss
// et les chiffres de dégâts. `bounds` : [xMin, xMax] réels de la silhouette seule. `palette` : teintes
// naturelles par archétype, qu'un mob peut remplacer par les siennes dans son détail.

const SCENE_MOB_SPRITES = {
    // Quadrupède — signe : queue relevée et museau.
    beast: {
        top: -46,
        bounds: [-23, 23.5],
        palette: { base: '#8a7660', dark: '#5c4c3a', accent: '#c23b3b' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="20" ry="3"/>
            <path class="mf-line" d="M-16 -26 Q-21 -34 -18 -43"/>
            <rect class="mf-dark" x="-15" y="-16" width="5" height="15" rx="2"/>
            <rect class="mf-dark" x="-7" y="-16" width="5" height="15" rx="2"/>
            <rect class="mf-dark" x="5" y="-16" width="5" height="15" rx="2"/>
            <rect class="mf-dark" x="12" y="-16" width="5" height="15" rx="2"/>
            <ellipse class="mf-base" cx="-2" cy="-24" rx="17" ry="9.5"/>
            <circle class="mf-base" cx="13" cy="-32" r="7.5"/>
            <path class="mf-dark" d="M9 -38 L7 -46 L14 -40 Z"/>
            <rect class="mf-base" x="15" y="-33" width="7" height="5.5" rx="2"/>
            <circle cx="21" cy="-31.5" r="1.2" fill="#05060c"/>
            <circle class="mf-accent" cx="15" cy="-34.5" r="1.6"/>`
    },
    // Machine possédée — signe : écran-œil et antenne.
    machine: {
        top: -74,
        bounds: [-18.5, 18.5],
        palette: { base: '#59919a', dark: '#3a5f66', accent: '#fbbf24' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="18" ry="3"/>
            <rect class="mf-dark" x="-14" y="-7" width="9" height="6" rx="1.5"/>
            <rect class="mf-dark" x="5" y="-7" width="9" height="6" rx="1.5"/>
            <line x1="-8" y1="-56" x2="-8" y2="-70" stroke="#05060c" stroke-width="2"/>
            <circle class="mf-accent" cx="-8" cy="-71" r="2.6"/>
            <rect class="mf-base" x="-17" y="-56" width="34" height="50" rx="4"/>
            <rect class="mf-accent" x="6" y="-48" width="10" height="8" rx="1.5" opacity="0.85"/>
            <circle class="mf-dark" cx="-9" cy="-24" r="3"/>
            <circle class="mf-dark" cx="1" cy="-24" r="3"/>`
    },
    // Humanoïde zombifié — signe : penché en avant, bras tendu, bouche pendante (trait fin explicite).
    zombie: {
        top: -83,
        bounds: [-16, 22],
        palette: { base: '#9cb06e', dark: '#5c6b4f', accent: '#c94f3d' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="2.8"/>
            <path class="mf-dark" d="M-9 -26 L-8 -2 L0 -2 L-1 -26 Z"/>
            <path class="mf-dark" d="M2 -26 L3 -2 L11 -2 L8 -26 Z"/>
            <path class="mf-base" d="M-12 -52 C-14 -61 -6 -66 0 -66 C8 -66 13 -60 12 -51 L10 -25 L-10 -25 Z"/>
            <path class="mf-dark" d="M2 -55 L18 -52 L18 -46 L2 -49 Z"/>
            <circle class="mf-base" cx="19" cy="-49" r="2.8"/>
            <path class="mf-dark" d="M-1 -50 L-14 -42 L-12 -37 L-1 -45 Z"/>
            <circle class="mf-base" cx="6" cy="-73" r="10"/>
            <path d="M-1 -66 Q6 -62.5 12 -66.5" fill="none" stroke="#05060c" stroke-width="1.2" stroke-linecap="round"/>
            <circle class="mf-accent" cx="10" cy="-74" r="2.2"/>`
    },
    // Végétal — signe : feuilles et gueule ouverte.
    plant: {
        top: -67,
        bounds: [-16, 19.5],
        palette: { base: '#6da84f', dark: '#47703a', accent: '#d95f5f' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="3"/>
            <rect class="mf-dark" x="-2.5" y="-42" width="5" height="42" rx="2"/>
            <ellipse class="mf-dark" cx="-10" cy="-20" rx="9" ry="4" transform="rotate(-25 -10 -20)"/>
            <ellipse class="mf-dark" cx="10" cy="-30" rx="9" ry="4" transform="rotate(25 10 -30)"/>
            <circle class="mf-base" cx="4" cy="-54" r="13"/>
            <path class="mf-accent" d="M8 -52 L19 -57 L19 -47 Z"/>
            <path d="M8 -52 L16 -54.5 L15 -49.5 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>`
    },
    // Petit humanoïde — signe : grande oreille pointue et sourire de filou.
    goblinoid: {
        top: -68,
        bounds: [-17, 14],
        palette: { base: '#8fae5a', dark: '#5f7a3a', accent: '#c23b3b' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="13" ry="2.6"/>
            <rect class="mf-dark" x="-8" y="-22" width="6" height="21" rx="3"/>
            <rect class="mf-dark" x="1" y="-22" width="6" height="21" rx="3"/>
            <rect class="mf-base" x="-10" y="-46" width="20" height="26" rx="7"/>
            <path class="mf-dark" d="M4 -42 L13 -38 L13 -33 L4 -37 Z"/>
            <circle class="mf-base" cx="3" cy="-57" r="11"/>
            <path class="mf-base" d="M-5 -62 L-16 -55 L-6 -51 Z"/>
            <path d="M-2 -52 Q4 -49 9 -53" fill="none" stroke="#05060c" stroke-width="1.1" stroke-linecap="round"/>
            <circle class="mf-accent" cx="8" cy="-59" r="2"/>`
    },
    // Masse gélatineuse — signe : bulles, large et basse.
    blob: {
        top: -42,
        bounds: [-22.5, 22.5],
        palette: { base: '#79b8b0', dark: '#4a7a74', accent: '#e0b04a' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="21" ry="3"/>
            <path class="mf-base" d="M-21 -2 C-23 -28 -10 -42 0 -42 C11 -42 22 -28 21 -2 Z"/>
            <circle class="mf-dark" cx="-9" cy="-16" r="3"/>
            <circle class="mf-dark" cx="-3" cy="-29" r="2"/>
            <circle class="mf-accent" cx="8" cy="-24" r="2.6"/>
            <circle class="mf-accent" cx="15" cy="-19" r="2.2"/>`
    },
    // Incorporel — signe : corps ondulé qui flotte au-dessus de son ombre.
    shade: {
        top: -80,
        bounds: [-18, 22],
        palette: { base: '#7c8cb8', dark: '#47536e', accent: '#ffd76a' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="13" ry="2.5" opacity="0.6"/>
            <path class="mf-base" d="M-16 -16 C-18 -50 -10 -80 4 -80 C18 -80 22 -52 20 -16 C14 -22 10 -12 4 -18 C-2 -12 -8 -22 -16 -16 Z" opacity="0.9"/>
            <circle class="mf-accent" cx="8" cy="-60" r="2.5"/>
            <circle class="mf-accent" cx="15" cy="-60" r="2.2"/>`
    },
    // Objet humanoïde inanimé — signe : tête sans visage sur pied, bras ballants.
    mannequin: {
        top: -87,
        bounds: [-10.5, 10.5],
        palette: { base: '#d9cbb0', dark: '#8a7c62', accent: '#c23b3b' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="12" ry="3"/>
            <rect class="mf-dark" x="-9" y="-4" width="18" height="4" rx="1"/>
            <rect class="mf-dark" x="-1.5" y="-24" width="3" height="21"/>
            <rect class="mf-base" x="-8" y="-33" width="16" height="10" rx="3"/>
            <path class="mf-base" d="M-10 -62 Q-12 -46 -7 -32 L7 -32 Q12 -46 10 -62 Z"/>
            <path class="mf-base" d="M-11 -58 Q-13 -46 -9 -40"/>
            <path class="mf-base" d="M11 -58 Q13 -46 9 -40"/>
            <line x1="-10" y1="-48" x2="10" y2="-48" stroke="#05060c" stroke-width="1.5"/>
            <rect class="mf-base" x="-2.5" y="-69" width="5" height="8"/>
            <ellipse class="mf-base" cx="0" cy="-77" rx="8" ry="10"/>`
    },
    // Multi-membres — signe : câbles et étincelle.
    swarm: {
        top: -57,
        bounds: [-23, 23],
        palette: { base: '#c97a3a', dark: '#7a3a1c', accent: '#fde047' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="18" ry="3"/>
            <path class="mf-line" d="M0 -40 L-20 -8"/>
            <path class="mf-line" d="M0 -40 L-6 -2"/>
            <path class="mf-line" d="M0 -40 L10 -2"/>
            <path class="mf-line" d="M0 -40 L21 -10"/>
            <circle class="mf-base" cx="0" cy="-42" r="14"/>
            <path d="M16 -54 L21 -50 L17 -48 L22 -43" fill="none" stroke="var(--mob-accent, #fde047)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle class="mf-accent" cx="7" cy="-44" r="2.6"/>`
    },
    // Véhicule — signe : roues et phare avant, large et bas.
    vehicle: {
        top: -40,
        bounds: [-23, 23],
        palette: { base: '#a8543a', dark: '#6b3a28', accent: '#fbbf24' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="24" ry="3"/>
            <path class="mf-base" d="M-14 -26 L-8 -40 L10 -40 L16 -26 Z"/>
            <path class="mf-dark" d="M-6 -37 L9 -37 L13 -28 L-10 -28 Z"/>
            <rect class="mf-base" x="-22" y="-27" width="44" height="16" rx="4"/>
            <rect class="mf-accent" x="17" y="-23" width="4" height="5" rx="1"/>
            <circle class="mf-dark" cx="-12" cy="-8" r="7"/>
            <circle class="mf-dark" cx="12" cy="-8" r="7"/>
            <circle cx="-12" cy="-8" r="2" fill="#0b0d14"/>
            <circle cx="12" cy="-8" r="2" fill="#0b0d14"/>`
    }
};

// Couronne de boss, posée au-dessus de la silhouette (y = 0 = base de la couronne).
const SCENE_BOSS_CROWN_SVG = `
    <path d="M-10 0 L-9 -10 L-4 -5 L0 -13 L4 -5 L9 -10 L10 0 Z" fill="#caa23a" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_MOB_SPRITES, SCENE_BOSS_CROWN_SVG };
}
