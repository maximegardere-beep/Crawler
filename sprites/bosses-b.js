// sprites/bosses-b.js - Sprites des boss (2e moitié : du Roi des Chaussettes Solitaires à l'Animateur
// Vedette Immortel). Complète SCENE_BOSS_SPRITES déclarée dans sprites/bosses-a.js, dont l'en-tête
// documente le repère et le format (markup sans couronne, sans aura, sans objet signature ; `held`
// place l'objet ajouté par le jeu ; `bounds` dans [-24, +24], objet compris ; `top` couronne exclue).
// Catalogue pur, sans DOM ni gameState.

Object.assign(SCENE_BOSS_SPRITES, {
    // Le Roi des Chaussettes Solitaires — mannequin de bois articulé sur son socle, tête ovale sans
    // visage, courroie, chaussette royale violet et or portée en cape dans le dos, chaussettes orphelines
    // à ses pieds.
    'Le Roi des Chaussettes Solitaires': {
        top: -83,
        bounds: [-20.5, 14.5],
        palette: { base: '#d9cbb0', dark: '#8a7c62', accent: '#7c3aed' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="13" ry="3"/>
            <rect class="mf-dark" x="-10" y="-4" width="20" height="4" rx="1"/>
            <rect class="mf-base" x="-3" y="-26" width="6" height="22" rx="2"/>
            <rect class="mf-base" x="-9" y="-34" width="18" height="10" rx="4"/>
            <path class="mf-base" d="M-10 -60 Q-12 -46 -7 -34 L7 -34 Q12 -46 10 -60 Z"/>
            <path class="mf-line" d="M-9 -56 Q-14 -48 -12 -40"/>
            <path class="mf-line" d="M9 -56 Q14 -48 12 -40"/>
            <circle class="mf-base" cx="-12" cy="-40" r="2.5"/>
            <circle class="mf-base" cx="12" cy="-40" r="2.5"/>
            <circle class="mf-dark" cx="-9" cy="-52" r="1.8"/>
            <circle class="mf-dark" cx="9" cy="-52" r="1.8"/>
            <line x1="-10" y1="-47" x2="10" y2="-47" stroke="#05060c" stroke-width="1.5"/>
            <rect class="mf-base" x="-2" y="-66" width="4" height="7"/>
            <rect x="-4" y="-60" width="8" height="3" rx="1.5" fill="#8a7c62" stroke="#05060c" stroke-width="1"/>
            <ellipse class="mf-base" cx="0" cy="-74" rx="8" ry="9"/>
            <circle class="mf-accent" cx="3" cy="-75" r="1.8"/>
            <circle cx="-3" cy="-75" r="1.6" fill="#8a7c62"/>
            <path d="M-16 -6 q4 -2 5 2 q-3 2 -5 -2 z" fill="#7c3aed" opacity="0.8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M15 -4 q-4 -1 -4 3 q3 1 4 -3 z" fill="#4d7c0f" opacity="0.8" stroke="#05060c" stroke-width="0.8"/>`,
        held: { item: 'Chaussette Royale Dépareillée', transform: 'translate(-13 -12) scale(0.8)', layer: 'back' }
    },
    // Le Baron des Ombres — dandy spectral du Marché Noir : queue-de-pie d'ombre, haut-de-forme,
    // monocle doré, moustache fine, gant blanc ; il dégaine sa canne-épée.
    'Le Baron des Ombres': {
        top: -90,
        bounds: [-16, 17],
        palette: { base: '#4a4460', dark: '#2a2438', accent: '#d1d5db' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="12" ry="2.5" opacity="0.6"/>
            <path class="mf-base" d="M-13 -12 C-17 -36 -13 -60 -6 -68 C2 -74 10 -68 11 -54 C12 -42 10 -30 8 -12 C4 -22 0 -14 -4 -22 C-8 -12 -9 -20 -13 -12 Z" opacity="0.95"/>
            <path d="M-9 -64 L-4 -72 L-3 -62 Z" fill="#2a2438" stroke="#05060c" stroke-width="1"/>
            <path d="M9 -64 L4 -72 L5 -62 Z" fill="#2a2438" stroke="#05060c" stroke-width="1"/>
            <path d="M-6 -56 L6 -56 L5 -40 L-4 -40 Z" fill="#2a2438" stroke="#05060c" stroke-width="1"/>
            <path d="M-4 -46 Q0 -44 2 -46" stroke="#d1d5db" stroke-width="1" fill="none"/>
            <path class="mf-accent" d="M1 -60 l-4 -3 v6 z M3 -60 l4 -3 v6 z"/>
            <circle cx="1" cy="-60" r="1" fill="#05060c"/>
            <path class="mf-line" d="M8 -56 L12 -54 L13 -53"/>
            <circle class="mf-accent" cx="13" cy="-52" r="2.8"/>
            <circle cx="2" cy="-74" r="8.5" fill="#3a3050" stroke="#05060c" stroke-width="2.5"/>
            <circle cx="6" cy="-74" r="3" fill="#e8f4ff" fill-opacity="0.5" stroke="#caa23a" stroke-width="1.2"/>
            <circle cx="6" cy="-74" r="1.2" fill="#ffd76a"/>
            <circle cx="-2" cy="-74" r="1.2" fill="#ffd76a"/>
            <path d="M-1 -68 Q3 -66 7 -68" stroke="#05060c" stroke-width="1" fill="none"/>
            <path d="M2 -67 q4 1.5 5 -0.5" stroke="#d1d5db" stroke-width="1.3" fill="none"/>
            <path d="M9 -70 q3 4 2 8" stroke="#caa23a" stroke-width="0.8" fill="none"/>
            <rect x="-5" y="-90" width="14" height="14" rx="1.5" fill="#2a2438" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-5" y="-80" width="14" height="2.5" fill="#caa23a"/>
            <rect x="-8" y="-77" width="20" height="3" rx="1.5" fill="#2a2438" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-13 -16 L-9 -12" stroke="#caa23a" stroke-width="1"/>`,
        held: { item: 'Canne-Épée du Baron des Ombres', transform: 'translate(13 -52) rotate(-15) scale(0.8)', layer: 'front' }
    },
    // L'IA Malveillante — baie serveur possédée sur chenilles : écran-visage furieux aux yeux rouges,
    // rangées de diodes, antenne clignotante ; son canon à impulsions pointe vers le crawler.
    "L'IA Malveillante": {
        top: -80,
        bounds: [-18, 22],
        palette: { base: '#59919a', dark: '#3a5f66', accent: '#fbbf24' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="19" ry="3"/>
            <rect class="mf-dark" x="-18" y="-12" width="36" height="10" rx="5"/>
            <circle class="mf-dark" cx="-11" cy="-6" r="6"/>
            <circle class="mf-dark" cx="11" cy="-6" r="6"/>
            <circle cx="-11" cy="-6" r="2" fill="#0b0d14" stroke="#05060c" stroke-width="1"/>
            <circle cx="11" cy="-6" r="2" fill="#0b0d14" stroke="#05060c" stroke-width="1"/>
            <rect class="mf-base" x="-15" y="-64" width="30" height="52" rx="3"/>
            <path d="M-11 -58 h22 M-11 -52 h22 M-11 -46 h22 M-11 -40 h22" stroke="#3a5f66" stroke-width="2"/>
            <circle class="mf-accent" cx="-12.5" cy="-56" r="1.2"/>
            <circle cx="-12.5" cy="-50" r="1.2" fill="#ef4444" class="bd-blink"/>
            <circle cx="-12.5" cy="-44" r="1.2" fill="#4ade80"/>
            <rect x="-9" y="-80" width="18" height="14" rx="2" fill="#0b1220" stroke="#05060c" stroke-width="2"/>
            <circle cx="-4" cy="-74" r="2.2" fill="#ef4444" class="bd-blink"/>
            <circle cx="5" cy="-74" r="2.2" fill="#ef4444"/>
            <path d="M-5 -69 l3 2 l3 -2 l3 2 l3 -2" stroke="#ef4444" stroke-width="1.2" fill="none"/>
            <line x1="12" y1="-64" x2="12" y2="-74" stroke="#05060c" stroke-width="2"/>
            <circle cx="12" cy="-75" r="2.4" fill="#fbbf24" stroke="#05060c" stroke-width="1" class="bd-blink"/>
            <path d="M14 -50 Q10 -48 3 -46" stroke="#05060c" stroke-width="5" fill="none"/>
            <path d="M14 -50 Q10 -48 3 -46" stroke="#59919a" stroke-width="3" fill="none"/>
            <path d="M-15 -70 l-2 -3 M-13 -72 l-3 -1" stroke="#fde047" stroke-width="1"/>`,
        held: { item: "Canon à Impulsions de l'IA Malveillante", transform: 'translate(2 -46) scale(-0.7 0.7)', layer: 'front' }
    },
    // Le Gardien du Parking Éternel — voiturette de service possédée : yeux de pare-brise, gyrophare,
    // plaque, éraflures ; il lève sa barrière de péage maudite comme un bras qui bloque la sortie.
    'Le Gardien du Parking Éternel': {
        top: -46,
        bounds: [-23.7, 21],
        palette: { base: '#a8543a', dark: '#6b3a28', accent: '#fbbf24' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="22" ry="3"/>
            <path class="mf-base" d="M-13 -26 L-9 -40 L9 -40 L13 -26 Z"/>
            <rect class="mf-base" x="-21" y="-26" width="42" height="18" rx="5"/>
            <path d="M-8 -38 L7 -38 L10 -27 L-10 -27 Z" fill="#1a2430" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="-4" cy="-33" r="2.4" fill="#fde047"/>
            <circle cx="-4" cy="-33" r="1" fill="#05060c"/>
            <circle cx="4" cy="-33" r="2.4" fill="#fde047"/>
            <circle cx="4" cy="-33" r="1" fill="#05060c"/>
            <path d="M-6 -24 h12" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-5 -24 l1.5 3 M-2 -24 l1.5 3 M1 -24 l1.5 3" stroke="#d1d5db" stroke-width="1"/>
            <circle class="mf-dark" cx="-12" cy="-8" r="7"/>
            <circle class="mf-dark" cx="12" cy="-8" r="7"/>
            <circle cx="-12" cy="-8" r="2.4" fill="#0b0d14" stroke="#05060c" stroke-width="1"/>
            <circle cx="12" cy="-8" r="2.4" fill="#0b0d14" stroke="#05060c" stroke-width="1"/>
            <rect class="mf-accent" x="17" y="-23" width="4" height="5" rx="1"/>
            <rect x="-6" y="-14" width="10" height="5" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-4.5 -12 h7 M-4.5 -10.5 h7" stroke="#05060c" stroke-width="0.7"/>
            <rect x="-3" y="-44" width="6" height="4" rx="1" fill="#1f2937" stroke="#05060c" stroke-width="1"/>
            <path d="M-2 -44 a2.5 2.5 0 0 1 5 0 z" fill="#ef4444" class="bd-blink"/>
            <path d="M-19 -20 q3 4 0 6" stroke="#6b3a28" stroke-width="1.2" fill="none"/>`,
        held: { item: 'Barre de Péage Maudite', transform: 'translate(-3 -24) rotate(-50) scale(0.6)', layer: 'front' }
    },
    // Le Grand Requin Gonflable — jouet de piscine possédé, dressé sur sa queue : coutures apparentes,
    // rustine, bouchon, ventre pâle, grand sourire denté ; il brandit sa propre mâchoire en trophée.
    'Le Grand Requin Gonflable': {
        top: -70,
        bounds: [-22, 19],
        palette: { base: '#7cc4f5', dark: '#3a6b9a', accent: '#e8f4ff' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="22" ry="3"/>
            <path class="mf-dark" d="M-20 -4 Q-24 -14 -16 -16 Q-8 -18 -10 -8 Z"/>
            <path class="mf-base" d="M-6 -58 L-2 -70 L4 -58 Z"/>
            <ellipse class="mf-base" cx="-2" cy="-36" rx="19" ry="26"/>
            <ellipse class="mf-accent" cx="2" cy="-30" rx="12" ry="17" opacity="0.9"/>
            <path d="M9 -38 l3 6 M11 -40 l3 6" stroke="#05060c" stroke-width="1.2"/>
            <path class="mf-dark" d="M10 -22 Q18 -18 14 -12 Q8 -14 8 -20 Z"/>
            <circle cx="8" cy="-44" r="2.6" fill="#e8f4ff" stroke="#05060c" stroke-width="1"/>
            <circle cx="8.8" cy="-44" r="1.1" fill="#05060c"/>
            <path class="mf-dark" d="M-2 -34 Q8 -32 14 -38 L14 -30 Q6 -26 -2 -28 Z"/>
            <path d="M0 -31 l2 2.5 l2 -2.5 l2 2.5 l2 -2.5 l2 2.5" stroke="#e8e4d8" stroke-width="1.2" fill="none"/>
            <path d="M-16 -22 q10 4 24 0" stroke="#3a6b9a" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
            <path d="M-14 -48 q8 4 18 0" stroke="#3a6b9a" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
            <rect x="-14" y="-26" width="6" height="5" rx="1" fill="#3a6b9a" transform="rotate(-8 -14 -26)" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-15 -25 h7 M-14 -27.5 h6" stroke="#e8f4ff" stroke-width="0.6"/>
            <circle cx="-12" cy="-12" r="2.2" fill="#3a6b9a" stroke="#05060c" stroke-width="1"/>`,
        held: { item: 'Dents du Grand Requin Gonflable', transform: 'translate(10 -28) rotate(-10) scale(0.7)', layer: 'front' }
    },
    // L'Animateur Vedette Immortel — zombie de télé-achat en costard à paillettes : banane immortelle,
    // sourire figé béat, étoile au coin de l'œil, sparkles ; il tend son micro électrifié aux lèvres.
    "L'Animateur Vedette Immortel": {
        top: -81,
        bounds: [-17, 19],
        palette: { base: '#2b2b4a', dark: '#17172e', accent: '#fde047' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="15" ry="3"/>
            <rect class="mf-dark" x="-7" y="-16" width="5" height="15" rx="2"/>
            <rect class="mf-dark" x="2" y="-16" width="5" height="15" rx="2"/>
            <path class="mf-base" d="M-11 -62 C-12 -42 -12 -26 -12 -16 L10 -16 C11 -32 10 -48 9 -60 Z"/>
            <path d="M0 -60 L-7 -48 L-4 -20 L-1 -42 Z" fill="#17172e" stroke="#05060c" stroke-width="1"/>
            <path d="M3 -60 L9 -48 L7 -20 L4 -42 Z" fill="#17172e" stroke="#05060c" stroke-width="1"/>
            <path d="M-1 -60 L4 -60 L1.5 -44 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="1"/>
            <circle class="mf-accent" cx="-6" cy="-40" r="1"/>
            <circle cx="-8" cy="-28" r="1" fill="#fde047"/>
            <circle cx="6" cy="-44" r="1" fill="#fde047"/>
            <circle cx="7" cy="-26" r="1" fill="#fde047"/>
            <circle cx="0" cy="-36" r="1" fill="#fde047"/>
            <circle cx="-4" cy="-20" r="1" fill="#fde047"/>
            <path class="mf-line" d="M7 -58 L12 -56 L14 -55"/>
            <circle class="mf-base" cx="14" cy="-56" r="2.6"/>
            <path class="mf-line" d="M-8 -58 L-13 -50 L-14 -45"/>
            <circle class="mf-base" cx="-14" cy="-44" r="2.6"/>
            <circle cx="2" cy="-72" r="9.5" fill="#c8bfae" stroke="#05060c" stroke-width="2.5"/>
            <path d="M-6 -76 Q2 -84 10 -78 Q12 -74 8 -73 Q2 -79 -4 -73 Z" fill="#3a2a1c" stroke="#05060c" stroke-width="1.5"/>
            <circle cx="0" cy="-73" r="1.5" fill="#05060c"/>
            <circle cx="6" cy="-73" r="1.5" fill="#05060c"/>
            <path d="M-2 -77 l4 1 M4 -76 l4 -1" stroke="#05060c" stroke-width="1"/>
            <path d="M-2 -67 Q2 -62 7 -66 L7 -69 Q2 -65 -2 -68 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-2 -67.5 h9" stroke="#05060c" stroke-width="0.7"/>
            <path d="M8 -76 l0.8 1.6 l1.6 0.3 l-1.2 1.1 l0.3 1.6 l-1.5 -0.8 l-1.5 0.8 l0.3 -1.6 l-1.2 -1.1 l1.6 -0.3 z" fill="#fde047"/>
            <path d="M-8 -56 l1 2 l2 0.3 l-1.5 1.4 l0.4 2 l-1.9 -1 l-1.9 1 l0.4 -2 l-1.5 -1.4 l2 -0.3 z" fill="#fde047" stroke="#05060c" stroke-width="0.6"/>`,
        held: { item: "Micro Électrifié de l'Animateur Vedette", transform: 'translate(14 -56) rotate(-20) scale(0.75)', layer: 'front' }
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_BOSS_SPRITES };
}
