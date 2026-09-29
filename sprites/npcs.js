// sprites/npcs.js - Silhouettes non hostiles : compagnon, PNJ des villes spécialisées.
// Repère commun à toutes les silhouettes des fichiers sprites/*.js : x = 0 au
// centre du personnage, y = 0 au niveau du sol (les pieds), y négatif vers le haut. Chaque chaîne est le
// CONTENU d'un <g> SVG, que scene.js translate à sa position dans la scène. Contours sombres #05060c.
// Catalogue pur, sans DOM ni gameState : scene.js lit ces constantes, jamais l'inverse.

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

// Présentateur de l'émission DeathWatch (chantier 4) : costume à paillettes, brushing impeccable,
// micro tendu vers le crawler (à droite). S'étend de x = -12 à x = +22.
const SCENE_HOST_SVG = `
    <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="3"/>
    <rect x="-7" y="-26" width="6" height="25" rx="2.5" fill="#1f2433" stroke="#05060c" stroke-width="1.5"/>
    <rect x="0" y="-26" width="6" height="25" rx="2.5" fill="#1f2433" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-11 -60 Q-12 -40 -10 -24 L11 -24 Q12 -40 10 -60 Z" fill="#7c3aed" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-2 -60 L1 -48 L4 -60" fill="#f5f0e6" stroke="#05060c" stroke-width="1"/>
    <path d="M0 -57 l2 2 l-2 2 l-2 -2 z" fill="#b91c1c"/>
    <circle cx="-6" cy="-46" r="0.8" fill="#e9d5ff"/><circle cx="6" cy="-40" r="0.8" fill="#e9d5ff"/><circle cx="-4" cy="-32" r="0.8" fill="#e9d5ff"/>
    <path d="M8 -54 L18 -58" stroke="#7c3aed" stroke-width="5" stroke-linecap="round"/>
    <circle cx="19.5" cy="-58.5" r="2.6" fill="#d9a877" stroke="#05060c" stroke-width="1"/>
    <rect x="19" y="-66" width="3" height="9" rx="1" fill="#2a2d33" stroke="#05060c" stroke-width="0.8"/>
    <circle cx="20.5" cy="-68" r="3.2" fill="#6b7280" stroke="#05060c" stroke-width="1"/>
    <rect x="-2" y="-66" width="5" height="6" fill="#d9a877"/>
    <circle cx="1" cy="-73" r="9" fill="#d9a877" stroke="#05060c" stroke-width="2"/>
    <path d="M-9 -75 Q-9 -87 3 -86 Q12 -85 11 -76 Q6 -81 -2 -79 Q-6 -78 -9 -75 Z" fill="#facc15" stroke="#05060c" stroke-width="1.3"/>
    <circle cx="6" cy="-73" r="1.2" fill="#05060c"/>
    <path d="M2 -67.5 Q6 -65 10 -67.5" fill="#f5f0e6" stroke="#05060c" stroke-width="1"/>
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_COMPANION_SVG, SCENE_MERCHANT_SVG, SCENE_TRAINER_SVG, SCENE_HOST_SVG };
}
