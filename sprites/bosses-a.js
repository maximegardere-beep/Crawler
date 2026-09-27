// sprites/bosses-a.js - Sprites des boss (1re moitié : du Chef de Gare Nécrosé au Maître des Illusions),
// « têtes d'affiche » des 13 quartiers (bestiary.js, districtBosses). Le bestiaire des mobs a été validé
// dans le même style ; les boss en sont la version star : silhouette propre et unique, plus imposante,
// plus détaillée, toujours lisible à taille réelle (1 unité ≈ 1 px sur iPhone).
//
// Repère commun à toutes les silhouettes des fichiers sprites/*.js : x = 0 au centre du personnage,
// y = 0 au niveau du sol (les pieds), y négatif vers le haut. Chaque `markup` est le CONTENU d'un <g>
// SVG que scene.js translate : le boss SANS sa couronne (SCENE_BOSS_CROWN_SVG, sprites/mobs.js, posée
// par le jeu à top - 2), SANS son aura d'effet (sprites/mob-auras.js) et SANS son objet signature,
// que le jeu ajoute lui-même via `held` (ITEM_SPRITES['<nom>'].art, sprites/items-signature.js).
//
// `held.transform` place le dessin de l'objet dans le repère du boss ; une arme à distance (bouche vers
// la GAUCHE dans son dessin) est retournée par scale(-1 1), le boss regardant vers la droite.
// `held.layer` : 'back' = dessiné derrière le corps (cape, objet dans le dos), 'front' = devant (défaut).
//
// `top` : ordonnée du point le plus haut du boss, couronne exclue. `bounds` : [xMin, xMax] réels du boss
// complet, objet signature compris, toujours dans [-24, +24] : c'est la borne qui garantit l'absence de
// chevauchement avec le crawler au contact. `palette` : teintes naturelles du boss (plus claires et plus
// saturées que les décors), posées par scene.js via les variables CSS --mob-base/--mob-dark/--mob-accent.
// Catalogue pur, sans DOM ni gameState.

const SCENE_BOSS_SPRITES = {
    // Le Chef de Gare Nécrosé — zombie de station : casquette galonnée, redingote verdâtre à boutons dorés,
    // lanterne au poing gauche, œil injecté, bouche pendante ; il siffle la fin de ta vie.
    'Le Chef de Gare Nécrosé': {
        top: -86,
        bounds: [-19, 19],
        palette: { base: '#6b7f6e', dark: '#3a4a42', accent: '#caa23a' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="17" ry="3"/>
            <rect class="mf-dark" x="-8" y="-18" width="6" height="17" rx="2"/>
            <rect class="mf-dark" x="2" y="-18" width="6" height="17" rx="2"/>
            <path class="mf-base" d="M-12 -68 C-15 -48 -14 -26 -15 -4 L11 -4 C12 -28 12 -52 10 -66 Z"/>
            <path class="mf-dark" d="M0 -64 L6 -62 L2 -46 L-2 -48 Z"/>
            <path class="mf-line" d="M-9 -66 L-16 -50"/>
            <circle class="mf-base" cx="-16" cy="-49" r="2.8"/>
            <rect x="-18" y="-56" width="4" height="3" fill="#3a4a42" stroke="#05060c" stroke-width="1"/>
            <path d="M-19 -56 h6 l-1 -7 h-4 Z" fill="#fde047" stroke="#05060c" stroke-width="1"/>
            <circle cx="-16" cy="-53" r="1.2" fill="#fb923c" class="bd-blink"/>
            <path class="mf-line" d="M-6 -64 L8 -62 L15 -61"/>
            <circle class="mf-base" cx="16" cy="-62" r="3"/>
            <circle cx="4" cy="-78" r="10" fill="#9cb08a" stroke="#05060c" stroke-width="2.5"/>
            <ellipse cx="11" cy="-72" rx="2.2" ry="2.8" fill="#5c3020" stroke="#05060c" stroke-width="1"/>
            <circle cx="9" cy="-79" r="2" fill="#c94f3d"/>
            <circle cx="9.5" cy="-79" r="0.8" fill="#05060c"/>
            <path d="M-6 -82 Q4 -90 14 -83 L13 -79 Q4 -85 -5 -79 Z" fill="#1e3350" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M4 -79 L17 -78 L14 -75 L3 -76 Z" fill="#1e3350" stroke="#05060c" stroke-width="1"/>
            <path d="M-6 -81 Q4 -87 14 -80" stroke="#caa23a" stroke-width="1.5" fill="none"/>
            <circle cx="4" cy="-84" r="1.5" fill="#caa23a" stroke="#05060c" stroke-width="0.6"/>
            <rect x="-13" y="-68" width="7" height="3" rx="1.5" fill="#caa23a" stroke="#05060c" stroke-width="0.8"/>
            <rect x="6" y="-68" width="7" height="3" rx="1.5" fill="#caa23a" stroke="#05060c" stroke-width="0.8"/>
            <circle cx="2" cy="-52" r="1.3" fill="#caa23a" stroke="#05060c" stroke-width="0.6"/>
            <circle cx="2" cy="-44" r="1.3" fill="#caa23a" stroke="#05060c" stroke-width="0.6"/>
            <circle cx="2" cy="-36" r="1.3" fill="#caa23a" stroke="#05060c" stroke-width="0.6"/>
            <path d="M-7 -62 l4 -2 v3 z" fill="#7f1d1d" stroke="#05060c" stroke-width="0.7"/>
            <circle cx="-5" cy="-57" r="2.4" fill="#caa23a" stroke="#05060c" stroke-width="1"/>`,
        held: { item: 'Sifflet du Chef de Gare Nécrosé', transform: 'translate(16 -62) rotate(-23) scale(0.55)', layer: 'front' }
    },
    // La Mère-Liane — plante reine des Jardins Carnivores : fleur géante couronnée de pétales rouges,
    // gueule dentée, tige noueuse, vignes griffues ; elle fouette avec le tronçon de liane de sa main.
    'La Mère-Liane': {
        top: -89,
        bounds: [-16, 20],
        palette: { base: '#6da84f', dark: '#47703a', accent: '#d95f5f' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="18" ry="3"/>
            <path class="mf-line" d="M-8 -6 Q-18 -22 -14 -44"/>
            <path class="mf-line" d="M8 -4 Q16 -20 12 -40"/>
            <ellipse class="mf-dark" cx="-15" cy="-46" rx="7" ry="3.5" transform="rotate(-30 -15 -46)"/>
            <ellipse class="mf-dark" cx="13" cy="-42" rx="7" ry="3.5" transform="rotate(25 13 -42)"/>
            <ellipse class="mf-dark" cx="-9" cy="-8" rx="8" ry="3.5" transform="rotate(-15 -9 -8)"/>
            <rect class="mf-dark" x="-4" y="-62" width="9" height="62" rx="4"/>
            <path d="M5 -50 l4 2 M5 -38 l4 2 M5 -26 l4 2" stroke="#05060c" stroke-width="1"/>
            <path class="mf-line" d="M4 -48 Q8 -49 10 -47"/>
            <circle class="mf-base" cx="10" cy="-47" r="2.5"/>
            <circle class="mf-base" cx="2" cy="-70" r="14"/>
            <ellipse class="mf-accent" cx="-10" cy="-66" rx="6" ry="9" transform="rotate(-35 -10 -66)"/>
            <ellipse class="mf-accent" cx="13" cy="-68" rx="6" ry="9" transform="rotate(30 13 -68)"/>
            <ellipse class="mf-accent" cx="0" cy="-83" rx="6" ry="6"/>
            <path class="mf-dark" d="M4 -70 Q14 -72 14 -66 Q10 -60 4 -62 Z"/>
            <path d="M6 -70 l2 3 l2 -3 l2 3" stroke="#e8e4d8" stroke-width="1.2" fill="none"/>
            <circle class="mf-accent" cx="-3" cy="-72" r="2.2"/>
            <circle cx="-3" cy="-72" r="0.9" fill="#05060c"/>
            <circle cx="-8" cy="-30" r="1.3" fill="#a3e635"/>
            <circle cx="-10" cy="-18" r="1.1" fill="#a3e635"/>`,
        held: { item: 'Tronçon de Liane Toxique', transform: 'translate(10 -47) rotate(8) scale(0.75)', layer: 'front' }
    },
    // Le Directeur Général (Édition Cauchemar) — bureaucrate zombie en costume gris derrière sa pile de
    // dossiers : lunettes cerclées, œil rouge, badge doré ; il tamponne REFUSÉ de sa main repliée.
    'Le Directeur Général (Édition Cauchemar)': {
        top: -83,
        bounds: [-22.5, 23],
        palette: { base: '#5a5a72', dark: '#33334a', accent: '#d9cbb0' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="16" ry="3"/>
            <rect class="mf-dark" x="-8" y="-16" width="6" height="15" rx="2"/>
            <rect class="mf-dark" x="2" y="-16" width="6" height="15" rx="2"/>
            <rect x="-22" y="-10" width="13" height="9" rx="1" fill="#d9cbb0" stroke="#05060c" stroke-width="1"/>
            <rect x="-21" y="-18" width="13" height="8" rx="1" fill="#e8dcc0" stroke="#05060c" stroke-width="1"/>
            <rect x="-22.5" y="-26" width="14" height="8" rx="1" fill="#d9cbb0" stroke="#05060c" stroke-width="1"/>
            <rect x="-20" y="-33" width="12" height="7" rx="1" fill="#e8dcc0" stroke="#05060c" stroke-width="1"/>
            <path class="mf-base" d="M-11 -62 C-12 -40 -12 -24 -12 -16 L10 -16 C11 -34 10 -50 9 -60 Z"/>
            <path d="M-11 -60 L1 -46 L-1 -20" stroke="#05060c" stroke-width="1.2" fill="none"/>
            <path d="M-2 -58 L3 -56 L1 -46 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="1"/>
            <path class="mf-accent" d="M-1 -58 L2 -54 L0 -44 L-2 -52 Z"/>
            <path class="mf-line" d="M-8 -58 L2 -54 L8 -53"/>
            <circle class="mf-base" cx="8" cy="-53" r="2.6"/>
            <rect x="4" y="-52" width="8" height="5" rx="1" fill="#caa23a" stroke="#05060c" stroke-width="0.8"/>
            <path d="M6 -49.5 l2 -2 l2 2 M6 -47.8 l2 -2" stroke="#05060c" stroke-width="0.7" fill="none"/>
            <circle cx="6" cy="-74" r="9" fill="#9cb0a0" stroke="#05060c" stroke-width="2.5"/>
            <path d="M-3 -79 Q-1 -70 2 -66" stroke="#33334a" stroke-width="3" fill="none" stroke-linecap="round"/>
            <circle cx="2" cy="-75" r="3.2" fill="#e8f4ff" fill-opacity="0.5" stroke="#05060c" stroke-width="1.3"/>
            <circle cx="10" cy="-75" r="3.2" fill="#e8f4ff" fill-opacity="0.5" stroke="#05060c" stroke-width="1.3"/>
            <path d="M5.2 -75 h3.6" stroke="#05060c" stroke-width="1"/>
            <circle cx="2" cy="-75" r="1.4" fill="#c94f3d"/>
            <circle cx="2" cy="-75" r="0.6" fill="#05060c"/>
            <circle cx="10" cy="-75" r="1.4" fill="#c94f3d"/>
            <path d="M0 -81 l4 2 M7 -79 l4 2" stroke="#05060c" stroke-width="1.2"/>`,
        held: { item: 'Tampon Encreur du Directeur', transform: 'translate(8 -53) scale(-0.75 0.75)', layer: 'front' }
    },
    // Le Boucher Sans Visage — colosse zombie en tablier blanc : tête entièrement bandée sans visage,
    // œil unique derrière les bandelettes, crochets à viande au flanc, couperet levé.
    'Le Boucher Sans Visage': {
        top: -85,
        bounds: [-17, 21],
        palette: { base: '#cfc8bd', dark: '#5c4c44', accent: '#7f1d1d' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="18" ry="3"/>
            <rect class="mf-dark" x="-9" y="-16" width="6" height="16" rx="2"/>
            <rect class="mf-dark" x="3" y="-16" width="6" height="16" rx="2"/>
            <path class="mf-base" d="M-15 -64 C-17 -46 -16 -28 -14 -18 L12 -18 C14 -32 14 -50 12 -62 Z"/>
            <path d="M-8 -50 L8 -50 L10 -20 L-10 -20 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="1.5"/>
            <path class="mf-accent" d="M-2 -34 q3 4 0 6 q-3 -2 0 -6 z"/>
            <path class="mf-line" d="M10 -58 L14 -50 L14 -45"/>
            <circle class="mf-base" cx="14" cy="-44" r="3"/>
            <path class="mf-line" d="M-12 -58 L-15 -42 L-14 -35"/>
            <circle class="mf-base" cx="-14" cy="-34" r="2.8"/>
            <path d="M-14 -31 q4 1 3 6" stroke="#8a9098" stroke-width="2" fill="none"/>
            <circle cx="3" cy="-76" r="10.5" fill="#c8bfae" stroke="#05060c" stroke-width="2.5"/>
            <path d="M-6 -80 L11 -72 M-6 -72 L11 -80 M-4 -85 L9 -68" stroke="#05060c" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M-6 -80 L11 -72 M-6 -72 L11 -80 M-4 -85 L9 -68" stroke="#e8e4d8" stroke-width="3" stroke-linecap="round"/>
            <circle cx="3" cy="-76" r="2" fill="#e8e4d8" stroke="#05060c" stroke-width="1"/>
            <path d="M-13 -60 l-3 5 M-10 -59 l-2 6" stroke="#7f1d1d" stroke-width="1"/>`,
        held: { item: 'Couperet du Boucher Sans Visage', transform: 'translate(14 -44) rotate(10) scale(0.8)', layer: 'front' }
    },
    // Le Gardien des Mots Perdus — spectre encapuchonné de la Bibliothèque : flotte au-dessus de son
    // ombre, capuche d'encre, yeux dorés, pages qui virevoltent ; la reliure flotte devant lui en plastron.
    'Le Gardien des Mots Perdus': {
        top: -88,
        bounds: [-20, 20],
        palette: { base: '#7c8cb8', dark: '#47536e', accent: '#ffd76a' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="13" ry="2.5" opacity="0.6"/>
            <path class="mf-base" d="M-14 -8 C-18 -36 -12 -66 0 -74 C10 -80 18 -70 18 -52 C18 -38 14 -30 16 -14 C10 -20 6 -12 0 -18 C-6 -10 -10 -20 -14 -8 Z" opacity="0.92"/>
            <path class="mf-dark" d="M-10 -74 C-12 -86 0 -88 8 -84 C14 -81 15 -76 13 -70 C6 -77 -2 -78 -10 -74 Z"/>
            <ellipse cx="2" cy="-80" rx="6" ry="7" fill="#1a1f30" stroke="#05060c" stroke-width="1.2"/>
            <circle class="mf-accent" cx="0" cy="-81" r="1.8"/>
            <circle class="mf-accent" cx="5" cy="-80" r="1.5"/>
            <path class="mf-line" d="M10 -48 Q14 -46 12 -42"/>
            <rect x="-20" y="-60" width="7" height="9" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="1" transform="rotate(-15 -20 -60)"/>
            <path d="M-18.5 -58 h4 M-18.5 -56 h3" stroke="#47536e" stroke-width="0.8"/>
            <rect x="14" y="-30" width="6" height="8" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="1" transform="rotate(12 14 -30)"/>
            <path d="M15.5 -28 h3.5 M15.5 -26 h2.5" stroke="#47536e" stroke-width="0.8"/>
            <path d="M-4 -24 q2 3 0 5 q-2 -2 0 -5 z" fill="#ffd76a" stroke="#05060c" stroke-width="0.7"/>`,
        held: { item: 'Reliure du Gardien des Mots Perdus', transform: 'translate(2 -10) scale(0.85)', layer: 'front' }
    },
    // Le Professeur Démentiel — savant fou zombie en blouse : cheveux en bataille, lunettes de protection,
    // fiole fumante au poing, sourire denté ; il brandit sa seringue géante.
    'Le Professeur Démentiel': {
        top: -86,
        bounds: [-16, 23],
        palette: { base: '#e8e4d8', dark: '#4a5a6a', accent: '#4ade80' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="15" ry="3"/>
            <rect class="mf-dark" x="-7" y="-16" width="5" height="15" rx="2"/>
            <rect class="mf-dark" x="2" y="-16" width="5" height="15" rx="2"/>
            <path class="mf-base" d="M-11 -62 C-13 -44 -12 -26 -13 -14 L11 -14 C12 -30 11 -48 10 -60 Z"/>
            <path d="M-3 -60 L2 -54 L5 -60 Z" fill="#4a5a6a" stroke="#05060c" stroke-width="1"/>
            <path class="mf-line" d="M7 -58 L11 -52 L13 -49"/>
            <circle class="mf-base" cx="13" cy="-49" r="2.6"/>
            <path class="mf-line" d="M-8 -58 L-13 -44 L-13 -39"/>
            <circle class="mf-base" cx="-13" cy="-39" r="2.6"/>
            <path d="M-15.5 -36 q-3 -6 0 -9 h5 q3 3 0 9 z" fill="#a3e635" opacity="0.85" stroke="#05060c" stroke-width="1"/>
            <circle cx="-13" cy="-40" r="0.8" fill="#4ade80"/>
            <circle cx="2" cy="-74" r="9.5" fill="#c8bfae" stroke="#05060c" stroke-width="2.5"/>
            <path class="mf-dark" d="M-7 -78 Q-10 -84 -4 -86 Q-2 -90 2 -86 Q6 -90 8 -84 Q12 -85 10 -79 Q6 -83 -2 -82 Q-6 -82 -7 -78 Z"/>
            <circle cx="0" cy="-74" r="3.6" fill="#e0f2fe" fill-opacity="0.6" stroke="#05060c" stroke-width="1.3"/>
            <circle cx="8" cy="-74" r="3.6" fill="#e0f2fe" fill-opacity="0.6" stroke="#05060c" stroke-width="1.3"/>
            <path d="M3.6 -74 h4.4" stroke="#05060c" stroke-width="1"/>
            <circle cx="0" cy="-74" r="1.4" fill="#05060c"/>
            <circle cx="8" cy="-74" r="1.4" fill="#05060c"/>
            <path d="M0 -68 Q5 -66 8 -69" fill="none" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-5" y="-52" width="5" height="6" rx="0.8" fill="#4ade80" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-4 -52 l1 -6 M-2 -52 l0 -6" stroke="#05060c" stroke-width="1.2"/>`,
        held: { item: 'Seringue Géante du Professeur Démentiel', transform: 'translate(12 -49) rotate(4) scale(0.7)', layer: 'front' }
    },
    // Le Maître des Illusions — dandy spectral de la Rue des Illusions : haut-de-forme, monocle doré,
    // sourire fin, cartes qui flottent autour de lui ; sa cape en lambeaux ondule dans son dos.
    'Le Maître des Illusions': {
        top: -90,
        bounds: [-19, 22],
        palette: { base: '#6d5a9e', dark: '#3d3059', accent: '#ffd76a' },
        markup: `
            <ellipse class="scene-ground-shadow" cx="0" cy="0" rx="12" ry="2.5" opacity="0.6"/>
            <path class="mf-base" d="M-12 -10 C-16 -34 -12 -58 -4 -66 C4 -72 12 -66 13 -52 C14 -40 12 -28 14 -12 C8 -18 4 -10 -2 -16 C-8 -8 -10 -18 -12 -10 Z" opacity="0.92"/>
            <path class="mf-dark" d="M-6 -58 L4 -58 L6 -40 L-4 -40 Z"/>
            <circle class="mf-accent" cx="0" cy="-52" r="1.1"/>
            <circle class="mf-accent" cx="0" cy="-46" r="1.1"/>
            <path class="mf-accent" d="M1 -58 l-4 -2.5 v5 z M3 -58 l4 -2.5 v5 z"/>
            <circle cx="1" cy="-58" r="1" fill="#05060c"/>
            <path class="mf-line" d="M8 -56 L12 -48 L10 -44"/>
            <circle cx="2" cy="-72" r="9" fill="#54427e" stroke="#05060c" stroke-width="2.5"/>
            <circle cx="7" cy="-72" r="3.2" fill="#e8f4ff" fill-opacity="0.5" stroke="#caa23a" stroke-width="1.3"/>
            <circle cx="7" cy="-72" r="1.3" fill="#05060c"/>
            <circle cx="-1" cy="-72" r="1.3" fill="#05060c"/>
            <path d="M-1 -66 Q4 -63 8 -66" stroke="#05060c" stroke-width="1.2" fill="none"/>
            <path d="M9 -70 q3 4 2 8" stroke="#caa23a" stroke-width="0.8" fill="none"/>
            <rect x="-5" y="-90" width="14" height="13" rx="1.5" fill="#3d3059" stroke="#05060c" stroke-width="1.5"/>
            <rect x="-5" y="-79" width="14" height="2.5" fill="#caa23a"/>
            <rect x="-8" y="-77" width="20" height="3" rx="1.5" fill="#3d3059" stroke="#05060c" stroke-width="1.5"/>
            <rect x="16" y="-58" width="6" height="8" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="1" transform="rotate(20 16 -58)"/>
            <rect x="-19" y="-44" width="6" height="8" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="1" transform="rotate(-15 -19 -44)"/>
            <path d="M14 -66 l1.5 -3 M16 -63 l3 -1" stroke="#ffd76a" stroke-width="1"/>`,
        held: { item: 'Cape en Lambeaux du Maître des Illusions', transform: 'translate(-2 -8)', layer: 'back' }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCENE_BOSS_SPRITES };
}
