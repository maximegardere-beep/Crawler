// sprites/mob-auras.js - Auras d'effet des mobs, dessinées DERRIÈRE la silhouette (une par effet de
// `mobModifiers` dans bestiary.js : bleed, burn, confusion, corrode, fear, light, poison, pull, slow,
// stun). Repère commun aux silhouettes : x = 0 au centre, y = 0 aux pieds, y négatif vers le haut.
// Catalogue pur, sans DOM ni gameState : scene.js insère la chaîne AVANT le markup du mob.
//
// Chaque aura : 2 ou 3 ellipses concentriques (opacité 0,12 à 0,3), centrées sur un corps « moyen »
// (vers y = -38), donc correcte derrière un mob bas (blob) comme derrière un mob haut (zombie) ;
// puis 2 ou 3 particules propres à l'effet, portant les classes mob-aura-a/b/c (décalées dans le temps
// dans index.html, lentes, coupées quand « Réduire les animations » est activé — ce fichier ne les
// définit PAS). La couleur est passée en paramètre : MOB_EFFECT_FX_COLORS (sprites/fx.js). L'aura reste
// discrète (le mob passe avant elle) et tient dans x ∈ [-24, +24].

const MOB_EFFECT_AURAS = {
    // Saignement : gouttes qui perlent autour du mob.
    bleed: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-19 -12 q-1.5 4 0 5.5 q1.5 -1.5 0 -5.5 z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-b" d="M14 -8 q-1.5 4 0 5.5 q1.5 -1.5 0 -5.5 z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-c" d="M-9 -63 q-1.5 4 0 5.5 q1.5 -1.5 0 -5.5 z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>`,
    // Brûlure : flammèches qui lèchent le mob.
    burn: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-19 -10 Q-21 -20 -15 -24 Q-16 -16 -12 -15 Q-14 -22 -9 -25 Q-13 -16 -13 -9 Z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.8"/>
        <path class="mob-aura-b" d="M12 -12 Q15 -21 11 -26 Q10 -19 7 -18 Q9 -25 4 -29 Q9 -21 8 -13 Z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.8"/>
        <path class="mob-aura-c" d="M-8 -58 Q-10 -66 -5 -69 Q-6 -63 -2 -63 Q-5 -68 0 -70 Q-4 -64 -4 -58 Z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.8"/>`,
    // Confusion : spirales qui virevoltent.
    confusion: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-20 -20 a4.5 4.5 0 1 1 4.5 4.5 a3 3 0 1 0 -4.5 -4.5" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" opacity="0.8"/>
        <path class="mob-aura-b" d="M13 -48 a4.5 4.5 0 1 1 4.5 4.5 a3 3 0 1 0 -4.5 -4.5" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" opacity="0.8"/>
        <path class="mob-aura-c" d="M-4 -64 a3.5 3.5 0 1 1 3.5 3.5 a2.3 2.3 0 1 0 -3.5 -3.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>`,
    // Corrosion : éclaboussures acides.
    corrode: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-18 -14 q4 -3 6 1 q-1 4 -6 2 z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-b" d="M11 -20 q5 -2 6 3 q-2 4 -6 1 z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-c" d="M-6 -60 q4 -2 5 2 q-1 3 -5 1 z" fill="${color}" opacity="0.65" stroke="#05060c" stroke-width="0.7"/>`,
    // Terreur : volutes violettes qui s'enroulent.
    fear: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-19 -24 q6 6 0 12 q-6 -6 0 -12" fill="${color}" opacity="0.6"/>
        <path class="mob-aura-b" d="M13 -40 q6 6 0 12 q-6 -6 0 -12" fill="${color}" opacity="0.6"/>
        <path class="mob-aura-c" d="M-3 -64 q5 5 0 10 q-5 -5 0 -10" fill="${color}" opacity="0.55"/>`,
    // Lumière : rayons qui partent du mob.
    light: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-22 -70 L-18 -46 M-24 -56 L-13 -52" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
        <path class="mob-aura-b" d="M22 -66 L18 -44 M23 -52 L12 -49" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
        <path class="mob-aura-c" d="M0 -74 L1.5 -60" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.65"/>`,
    // Poison : bulles qui montent.
    poison: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <circle class="mob-aura-a" cx="-18" cy="-16" r="2.6" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <circle class="mob-aura-b" cx="13" cy="-13" r="2" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <circle class="mob-aura-c" cx="-4" cy="-64" r="2.3" fill="${color}" opacity="0.65" stroke="#05060c" stroke-width="0.7"/>`,
    // Attraction : lignes d'aspiration vers le mob.
    pull: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-22 -22 L-11 -30 M-23 -38 L-12 -40" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
        <path class="mob-aura-b" d="M22 -20 L11 -28 M23 -52 L12 -50" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
        <path class="mob-aura-c" d="M-24 -54 L-12 -50" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.65"/>`,
    // Ralentissement : cristaux glacés.
    slow: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-19 -20 l2.6 -4 l2.6 4 l-2.6 4 z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-b" d="M13 -46 l2.6 -4 l2.6 4 l-2.6 4 z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.7"/>
        <path class="mob-aura-c" d="M-6 -64 l2.2 -3.5 l2.2 3.5 l-2.2 3.5 z" fill="${color}" opacity="0.65" stroke="#05060c" stroke-width="0.7"/>`,
    // Étourdissement : étincelles en zigzag.
    stun: (color) => `
        <ellipse cx="0" cy="-38" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-38" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="mob-aura-a" d="M-17 -57 L-13 -61 L-14 -56 L-10 -60" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        <path class="mob-aura-b" d="M13 -51 L17 -55 L16 -50 L20 -53" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        <path class="mob-aura-c" d="M-3 -20 L1 -24 L0 -19 L4 -22" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOB_EFFECT_AURAS };
}
