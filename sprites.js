// sprites.js - Banque d'art SVG pour la scène de combat (chantier "refonte graphique", branche
// `graphique`). Catalogue pur, sans DOM ni dépendance à gameState (comme items.js/spells.js) :
// scene.js lit ces constantes, jamais l'inverse. Style de la maquette validée : formes plates,
// contours épais sombres (#05060c), palette désaturée, un seul accent rouge réservé aux détails de
// danger (yeux/organes de monstres, voir la suite du chantier), jamais utilisé sur le joueur.
//
// viewBox normalisée à "0 0 100 140" (portrait) pour tous les sprites, afin qu'ils s'alignent au
// même point d'ancrage (bas du sprite = sol) quelle que soit leur silhouette.

// Joueur vu de dos (une seule apparence pour l'instant : pas de variation par équipement dans ce
// chantier). Casque/tête arrondie, sac à dos, silhouette trapue dans l'esprit de la maquette.
const PLAYER_SPRITE_SVG = `
<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="132" rx="26" ry="6" fill="#000" opacity="0.35"/>
    <rect x="30" y="60" width="14" height="38" rx="5" fill="#3a3f4a" stroke="#05060c" stroke-width="3"/>
    <rect x="56" y="60" width="14" height="38" rx="5" fill="#3a3f4a" stroke="#05060c" stroke-width="3"/>
    <rect x="24" y="86" width="22" height="16" rx="4" fill="#2b2f38" stroke="#05060c" stroke-width="3"/>
    <rect x="54" y="86" width="22" height="16" rx="4" fill="#2b2f38" stroke="#05060c" stroke-width="3"/>
    <rect x="8" y="40" width="16" height="32" rx="6" fill="#3a3f4a" stroke="#05060c" stroke-width="3"/>
    <rect x="76" y="40" width="16" height="32" rx="6" fill="#3a3f4a" stroke="#05060c" stroke-width="3"/>
    <rect x="22" y="34" width="56" height="52" rx="14" fill="#5b6472" stroke="#05060c" stroke-width="4"/>
    <rect x="30" y="40" width="40" height="34" rx="8" fill="#454c58" stroke="#05060c" stroke-width="3"/>
    <circle cx="50" cy="16" r="17" fill="#6b7280" stroke="#05060c" stroke-width="4"/>
    <path d="M35 12 a15 15 0 0 1 30 0 v4 h-30 z" fill="#454c58" stroke="#05060c" stroke-width="3"/>
</svg>`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLAYER_SPRITE_SVG };
}
