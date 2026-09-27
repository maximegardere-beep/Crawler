// Référence : essai Gemini validé (Contrôleur de Billets Zombifié). Défaut connu à NE PAS reproduire :
// la bouche utilise class="mf-line" (trait de 4 unités) -> doit être un trait fin explicite.
// Le détail dépasse le top de la silhouette (casquette à -84) -> déclarer top/bounds du mob complet.

const SCENE_MOB_SPRITES_TEST = {
    zombie: {
        top: -81,
        bounds: [-14, 22],
        palette: { base: '#9cb06e', dark: '#5c6b4f', accent: '#c94f3d' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="14" ry="2.8"/>
            <path class="mf-dark" d="M-9 -27 L-8 -2 L0 -2 L-1 -27 Z"/>
            <path class="mf-dark" d="M2 -27 L3 -2 L11 -2 L8 -27 Z"/>
            <path class="mf-base" d="M-11 -50 C-13 -59 -5 -64 1 -64 C8 -64 13 -58 12 -49 L11 -26 L-9 -26 Z"/>
            <path class="mf-dark" d="M1 -53 L18 -50 L18 -45 L1 -48 Z"/>
            <circle class="mf-base" cx="19" cy="-47" r="2.8"/>
            <path class="mf-dark" d="M0 -48 L15 -43 L15 -38 L0 -43 Z"/>
            <circle class="mf-base" cx="16" cy="-40" r="2.6"/>
            <circle class="mf-base" cx="2" cy="-71" r="10"/>
            <path class="mf-dark" d="M-6 -79 Q2 -83 9 -78 Q2 -75.5 -6 -79 Z"/>
            <path class="mf-line" d="M-3 -65.5 L5 -65.5"/>
            <circle class="mf-accent" cx="6" cy="-72" r="2.2"/>`
    }
};
const MOB_DETAILS_TEST = {
    'Contrôleur de Billets Zombifié': {
        palette: { base: '#9cb06e', dark: '#5c6b7c', accent: '#c94f3d' },
        markup: `
            <path class="mf-dark" d="M-8 -75 Q-8 -84 2 -84 Q11 -84 11 -75 L-8 -75 Z"/>
            <rect class="mf-accent" x="-8" y="-78" width="19" height="2.5" rx="1.2"/>
            <path class="mf-dark" d="M11 -76 L16.5 -73.5 L16.5 -70.5 L11 -73 Z"/>
            <path d="M-10 -53 L9 -41" stroke="#4a4436" stroke-width="3" stroke-linecap="round"/>
            <rect x="-15" y="-36" width="9" height="7.5" rx="1.5" fill="#4a4436" stroke="#05060c" stroke-width="1.2"/>
            <rect x="16.5" y="-52.5" width="7" height="9" rx="1.5" fill="#caa23a" stroke="#05060c" stroke-width="1.2"/>
            <rect x="20.8" y="-50" width="2.2" height="4.5" fill="#05060c"/>`
    }
};
const MOB_EFFECT_AURAS_TEST = {
    burn: (color) => `
        <ellipse cx="0" cy="-36" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-40" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="maf-a" d="M-19 -10 Q-21 -20 -15 -24 Q-16 -16 -12 -15 Q-14 -22 -9 -25 Q-13 -16 -13 -9 Z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.8"/>
        <path class="maf-b" d="M12 -12 Q15 -21 11 -26 Q10 -19 7 -18 Q9 -25 4 -29 Q9 -21 8 -13 Z" fill="${color}" opacity="0.75" stroke="#05060c" stroke-width="0.8"/>
        <path class="maf-c" d="M-8 -58 Q-10 -66 -5 -69 Q-6 -63 -2 -63 Q-5 -68 0 -70 Q-4 -64 -4 -58 Z" fill="${color}" opacity="0.7" stroke="#05060c" stroke-width="0.8"/>`,
    stun: (color) => `
        <ellipse cx="0" cy="-36" rx="23" ry="32" fill="${color}" opacity="0.12"/>
        <ellipse cx="0" cy="-38" rx="17" ry="25" fill="${color}" opacity="0.16"/>
        <ellipse cx="0" cy="-40" rx="11" ry="18" fill="${color}" opacity="0.22"/>
        <path class="maf-a" d="M-17 -57 L-13 -61 L-14 -56 L-10 -60" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="maf-b" d="M13 -51 L17 -55 L16 -50 L20 -53" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="maf-c" d="M-3 -20 L1 -24 L0 -19 L4 -22" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
};
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_MOB_SPRITES_TEST, MOB_DETAILS_TEST, MOB_EFFECT_AURAS_TEST };
}
