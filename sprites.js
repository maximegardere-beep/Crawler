// sprites.js - Banque d'art SVG pour la scène de combat (chantier "refonte graphique", branche
// `graphique`). Catalogue pur, sans DOM ni dépendance à gameState (comme items.js/spells.js) :
// scene.js lit ces constantes, jamais l'inverse. Style de la maquette validée : formes plates,
// contours épais sombres (#05060c), palette désaturée, un seul accent rouge réservé aux détails de
// danger (yeux/organes de monstres, voir la suite du chantier), jamais utilisé sur le joueur.
//
// viewBox normalisée à "0 0 100 140" (portrait) pour les archétypes de mobs/compagnon, afin qu'ils
// s'alignent au même point d'ancrage (bas du sprite = sol) quelle que soit leur silhouette. Le
// joueur (corps entier, voir plus bas) utilise sa propre viewBox "0 0 100 160" — même convention
// d'ancrage bas = sol, mais gabarit dédié à son propre CSS dans index.html (#scene-player-sprite).

// Joueur vu de dos (une seule apparence pour l'instant : pas de variation par équipement dans ce
// chantier). CORPS ENTIER (viewBox 100×160, jambes+bottes incluses — pas de crop plan américain,
// contrairement à l'ancienne version) : bas du SVG = sol, ancrage cohérent avec le reste de la
// banque. Torse tapered (épaules 44 -> taille 40, plus de silhouette carrée), sac à dos bombé + patch
// tissu teinté (rupture avec le camaïeu brun d'origine), nuque peau visible sous la capuche, tête
// proportionnellement plus grosse (~28% de la largeur d'épaules) qu'avant. Toujours sans arme visible
// (déjà représentée par la carte de jeu, pas de doublon visuel). #scene-player-sprite (index.html)
// est calibré (width/right/bottom) pour ce ratio 100:160 — voir le commentaire à côté de cet élément
// si la silhouette est retouchée et change de proportions.
const PLAYER_SPRITE_SVG = `
<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">
    <!-- Jambes + bottes -->
    <path d="M39 90 Q36 112 37 132 Q37 146 40 156 L48 156 Q47 146 47 132 Q47 112 45 90 Z" fill="#5a4a34" stroke="#05060c" stroke-width="3"/>
    <path d="M61 90 Q64 112 63 132 Q63 146 60 156 L52 156 Q53 146 53 132 Q53 112 55 90 Z" fill="#5a4a34" stroke="#05060c" stroke-width="3"/>
    <path d="M37 150 Q36 157 42 159 L49 159 Q49 154 48 150 Z" fill="#241a10" stroke="#05060c" stroke-width="2.5"/>
    <path d="M63 150 Q64 157 58 159 L51 159 Q51 154 52 150 Z" fill="#241a10" stroke="#05060c" stroke-width="2.5"/>
    <!-- Bassin -->
    <path d="M32 78 Q30 86 34 92 L66 92 Q70 86 68 78 Q60 84 50 84 Q40 84 32 78 Z" fill="#5a4a34" stroke="#05060c" stroke-width="3"/>
    <!-- Bras -->
    <path d="M26 42 Q18 46 18 62 Q18 80 24 92 Q30 90 29 82 Q24 70 26 56 Q27 48 32 43 Z" fill="#4a3a24" stroke="#05060c" stroke-width="3"/>
    <path d="M74 42 Q82 46 82 62 Q82 80 76 92 Q70 90 71 82 Q76 70 74 56 Q73 48 68 43 Z" fill="#4a3a24" stroke="#05060c" stroke-width="3"/>
    <!-- Torse : silhouette tapered (épaules larges -> taille) -->
    <path d="M28 40 Q26 30 36 26 L64 26 Q74 30 72 40 L70 60 Q69 80 60 84 L40 84 Q31 80 30 60 Z" fill="#6b5638" stroke="#05060c" stroke-width="4"/>
    <!-- Sac à dos + patch tissu -->
    <rect x="35" y="34" width="30" height="38" rx="6" fill="#4a3a24" stroke="#05060c" stroke-width="3"/>
    <rect x="40" y="40" width="20" height="14" rx="3" fill="#3a6b5e" stroke="#05060c" stroke-width="2"/>
    <path d="M38 28 L38 40" stroke="#8a5a2e" stroke-width="4" stroke-linecap="round"/>
    <path d="M62 28 L62 40" stroke="#8a5a2e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="50" cy="58" r="3" fill="#9a9a9a" stroke="#05060c" stroke-width="1.5"/>
    <!-- Nuque -->
    <path d="M40 24 Q40 20 50 20 Q60 20 60 24 L58 30 L42 30 Z" fill="#c98a5e" stroke="#05060c" stroke-width="2"/>
    <!-- Tête / capuche -->
    <circle cx="50" cy="14" r="14" fill="#2f2318" stroke="#05060c" stroke-width="4"/>
    <path d="M36 10 a14 14 0 0 1 28 0 v4 h-28 z" fill="#241a10" stroke="#05060c" stroke-width="3"/>
</svg>`;

// Archétypes visuels réutilisables du bestiaire (~52 créatures, voir bestiary.js -> champ
// `visualArchetype`) : chaque entrée est une silhouette plate, teintée dynamiquement par
// scene.js (variables CSS --mob-base/--mob-dark/--mob-accent, voir les classes mob-fill-* dans
// index.html) selon l'effet du mob généré, pour varier l'apparence sans dessiner une silhouette
// par créature. Un boss réutilise la même silhouette que son archétype, agrandie et couronnée par
// scene.js plutôt qu'une silhouette dédiée.
const MOB_ARCHETYPES = {
    // Petit humanoïde chétif (gobelins, stagiaires...)
    goblinoid: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="24" ry="6" fill="#000" opacity="0.35"/>
            <rect x="34" y="78" width="12" height="34" rx="5" class="mob-fill-dark"/>
            <rect x="54" y="78" width="12" height="34" rx="5" class="mob-fill-dark"/>
            <rect x="28" y="46" width="44" height="40" rx="12" class="mob-fill-base"/>
            <circle cx="50" cy="24" r="20" class="mob-fill-base"/>
            <circle cx="42" cy="22" r="4" class="mob-fill-accent"/>
            <circle cx="58" cy="22" r="4" class="mob-fill-accent"/>
        </svg>`,
    // Bête (rat, requin...) : silhouette animale générique à 4 appuis
    beast: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="30" ry="6" fill="#000" opacity="0.35"/>
            <rect x="20" y="88" width="10" height="30" rx="4" class="mob-fill-dark"/>
            <rect x="40" y="92" width="10" height="26" rx="4" class="mob-fill-dark"/>
            <rect x="52" y="92" width="10" height="26" rx="4" class="mob-fill-dark"/>
            <rect x="72" y="88" width="10" height="30" rx="4" class="mob-fill-dark"/>
            <ellipse cx="52" cy="70" rx="38" ry="22" class="mob-fill-base"/>
            <circle cx="82" cy="50" r="16" class="mob-fill-base"/>
            <circle cx="88" cy="46" r="3.5" class="mob-fill-accent"/>
        </svg>`,
    // Humanoïde zombifié / employé du quotidien (contrôleur, bibliothécaire, ouvrier...)
    zombie: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="24" ry="6" fill="#000" opacity="0.35"/>
            <rect x="32" y="80" width="13" height="34" rx="5" class="mob-fill-dark"/>
            <rect x="55" y="80" width="13" height="34" rx="5" class="mob-fill-dark"/>
            <rect x="24" y="42" width="52" height="46" rx="10" class="mob-fill-base"/>
            <rect x="14" y="44" width="14" height="30" rx="5" class="mob-fill-dark"/>
            <rect x="72" y="44" width="14" height="30" rx="5" class="mob-fill-dark"/>
            <circle cx="50" cy="20" r="18" class="mob-fill-base"/>
            <rect x="40" y="16" width="8" height="3" class="mob-fill-accent"/>
            <rect x="52" y="16" width="8" height="3" class="mob-fill-accent"/>
        </svg>`,
    // Machine / objet du quotidien possédé (distributeur, photocopieuse, robot...)
    machine: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="28" ry="6" fill="#000" opacity="0.35"/>
            <rect x="30" y="98" width="14" height="20" class="mob-fill-dark"/>
            <rect x="56" y="98" width="14" height="20" class="mob-fill-dark"/>
            <rect x="18" y="18" width="64" height="82" rx="6" class="mob-fill-base"/>
            <rect x="28" y="30" width="44" height="26" rx="3" class="mob-fill-accent" opacity="0.85"/>
            <circle cx="34" cy="72" r="5" class="mob-fill-dark"/>
            <circle cx="50" cy="72" r="5" class="mob-fill-dark"/>
            <circle cx="66" cy="72" r="5" class="mob-fill-dark"/>
        </svg>`,
    // Végétal (tulipe géante, ronce étrangleuse, frite de piscine...)
    plant: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="22" ry="6" fill="#000" opacity="0.35"/>
            <rect x="44" y="60" width="12" height="56" rx="4" class="mob-fill-dark"/>
            <path d="M50 20 C20 30 20 70 46 66 C40 40 60 40 54 66 C80 70 80 30 50 20 Z" class="mob-fill-base"/>
            <circle cx="50" cy="40" r="6" class="mob-fill-accent"/>
        </svg>`,
    // Ombre / fantôme (ombre suspicieuse, livre maudit, nuage de chlore...)
    shade: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="24" ry="6" fill="#000" opacity="0.35"/>
            <path d="M20 120 C20 60 30 20 50 20 C70 20 80 60 80 120 C68 108 60 118 50 108 C40 118 32 108 20 120 Z" class="mob-fill-base" opacity="0.92"/>
            <circle cx="42" cy="55" r="4" class="mob-fill-accent"/>
            <circle cx="58" cy="55" r="4" class="mob-fill-accent"/>
        </svg>`,
    // Gélatine / liquide (fromage qui pue, créature en bocaux, sac de pièces...)
    blob: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="30" ry="6" fill="#000" opacity="0.35"/>
            <path d="M18 110 C10 70 30 44 50 44 C70 44 90 70 82 110 C70 122 30 122 18 110 Z" class="mob-fill-base"/>
            <circle cx="40" cy="78" r="5" class="mob-fill-accent"/>
            <circle cx="62" cy="82" r="5" class="mob-fill-accent"/>
        </svg>`,
    // Multi-membres (câble électrique vivant...)
    swarm: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="26" ry="6" fill="#000" opacity="0.35"/>
            <line x1="50" y1="70" x2="14" y2="50" class="mob-stroke-thick"/>
            <line x1="50" y1="70" x2="14" y2="90" class="mob-stroke-thick"/>
            <line x1="50" y1="70" x2="86" y2="50" class="mob-stroke-thick"/>
            <line x1="50" y1="70" x2="86" y2="90" class="mob-stroke-thick"/>
            <circle cx="50" cy="66" r="26" class="mob-fill-base"/>
            <circle cx="42" cy="60" r="4" class="mob-fill-accent"/>
            <circle cx="58" cy="60" r="4" class="mob-fill-accent"/>
        </svg>`,
    // Mannequin / objet inanimé (mannequin vitrine, chaussette, cône de chantier...)
    mannequin: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="22" ry="6" fill="#000" opacity="0.35"/>
            <rect x="36" y="76" width="10" height="34" rx="4" class="mob-fill-dark"/>
            <rect x="54" y="76" width="10" height="34" rx="4" class="mob-fill-dark"/>
            <rect x="30" y="40" width="40" height="40" rx="6" class="mob-fill-base"/>
            <circle cx="50" cy="20" r="16" class="mob-fill-base"/>
        </svg>`,
    // Véhicule / mécanique lourde (voiture rouillée, gardien du parking...)
    vehicle: `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="132" rx="34" ry="6" fill="#000" opacity="0.35"/>
            <rect x="10" y="56" width="80" height="52" rx="10" class="mob-fill-base"/>
            <circle cx="30" cy="110" r="10" class="mob-fill-dark"/>
            <circle cx="70" cy="110" r="10" class="mob-fill-dark"/>
            <circle cx="30" cy="78" r="4" class="mob-fill-accent"/>
            <circle cx="70" cy="78" r="4" class="mob-fill-accent"/>
        </svg>`
};

// Couronne de boss (chantier "rework combat" -> district bosses), superposée par scene.js sur
// n'importe quel archétype ci-dessus plutôt que dessinée par silhouette : un seul dessin, réutilisé
// pour les 13 boss du bestiaire.
const BOSS_CROWN_SVG = `
    <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 36 L14 10 L32 24 L50 4 L68 24 L86 10 L90 36 Z" fill="#caa23a" stroke="#05060c" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="14" cy="10" r="4" fill="#e8c766"/>
        <circle cx="50" cy="4" r="4" fill="#e8c766"/>
        <circle cx="86" cy="10" r="4" fill="#e8c766"/>
    </svg>`;

// Compagnon (chantier "refonte graphique", Étape 4) : une seule silhouette générique, teintée par
// spécialité (strike/guard/medic/scout, voir generator.js -> companionSpecialties) via les mêmes
// classes mob-fill-* que les archétypes de mobs ci-dessus — pas de silhouette dédiée par spécialité.
const COMPANION_SPRITE_SVG = `
<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="132" rx="20" ry="5" fill="#000" opacity="0.3"/>
    <rect x="36" y="82" width="10" height="30" rx="4" class="mob-fill-dark"/>
    <rect x="54" y="82" width="10" height="30" rx="4" class="mob-fill-dark"/>
    <rect x="30" y="48" width="40" height="38" rx="10" class="mob-fill-base"/>
    <circle cx="50" cy="26" r="16" class="mob-fill-base"/>
    <circle cx="44" cy="24" r="3" class="mob-fill-accent"/>
    <circle cx="56" cy="24" r="3" class="mob-fill-accent"/>
</svg>`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLAYER_SPRITE_SVG, MOB_ARCHETYPES, BOSS_CROWN_SVG, COMPANION_SPRITE_SVG };
}
