// sprites/mob-details-a.js - Détails signature des mobs (1re moitié) : beast, machine, zombie et
// goblinoid (19 mobs). MOB_DETAILS complète ce fichier avec mob-details-b.js (Object.assign).
// Repère commun aux silhouettes : x = 0 au centre, y = 0 aux pieds, y négatif vers le haut. `markup` est
// dessiné PAR-DESSUS la silhouette de l'archétype du mob (sprites/mobs.js), dans le même repère ; il peut
// en recouvrir des parties, mais ne redessine pas toute la silhouette.
//
// Format d'une entrée (clé = nom EXACT du mob, bestiary.js) :
//   palette : teintes naturelles du mob COMPLET (remplacent la palette de l'archétype) ;
//   bounds  : vrais x min et max du mob complet (silhouette + détail), toujours dans [-24, +24] ;
//   top     : seulement si le détail dépasse le haut de la silhouette.
// Catalogue pur, sans DOM ni gameState.

const MOB_DETAILS = {
    // Rat Goulot — goulot de bouteille vert planté dans le dos, bouchon de liège, queue en tire-bouchon.
    'Rat Goulot': {
        palette: { base: '#8a7660', dark: '#5c4c3a', accent: '#c23b3b' },
        markup: `
            <path d="M-16 -26 Q-23 -32 -19 -40 Q-16 -44 -19 -47" fill="none" stroke="#5c4c3a" stroke-width="2" stroke-linecap="round"/>
            <rect x="-17.5" y="-39" width="4" height="9" rx="1" fill="#3a6b4a" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-16 -30 L-14 -22 L-18 -21 Z" fill="#3a6b4a" stroke="#05060c" stroke-width="1"/>
            <rect x="-18.5" y="-42.5" width="5" height="3.5" rx="1" fill="#8a5a2e" stroke="#05060c" stroke-width="1"/>`,
        bounds: [-23, 23.5], top: -46
    },
    // Distributeur de Snacks Hanté — vitrine à spirales de snacks, lueur spectrale bleue.
    'Distributeur de Snacks Hanté': {
        palette: { base: '#4a7aa8', dark: '#2f4d6b', accent: '#fbbf24' },
        markup: `
            <rect x="-9" y="-48" width="15" height="21" rx="2" fill="#16202e" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-6 -45 h9 M-6 -41 h9 M-6 -37 h9 M-6 -33 h9" stroke="#caa23a" stroke-width="1.6"/>
            <circle cx="8" cy="-43" r="2" fill="#c94f5a"/>
            <rect x="-4" y="-23" width="7" height="4.5" rx="1" fill="#caa23a" stroke="#05060c" stroke-width="0.8"/>
            <path d="M11 -50 q4 2 2 5" fill="none" stroke="#8fd7ff" stroke-width="1" opacity="0.7"/>`,
        bounds: [-18.5, 18.5]
    },
    // Photocopieuse Carnivore — gueule à crochets sur le capot, feuille à moitié mangée.
    'Photocopieuse Carnivore': {
        palette: { base: '#9aa3ad', dark: '#5f6770', accent: '#c23b3b' },
        markup: `
            <path class="mf-dark" d="M-11 -56 L11 -56 L11 -49 L-11 -49 Z"/>
            <path d="M-9 -49 L-5 -55 L-1 -49 L3 -55 L7 -49 Z" fill="#e8e4d8" stroke="#05060c" stroke-width="1"/>
            <circle class="mf-accent" cx="8" cy="-52" r="1.7"/>
            <rect x="11" y="-32" width="7" height="11" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M12.5 -28 h4 M12.5 -25 h4" stroke="#05060c" stroke-width="0.7"/>`,
        bounds: [-18.5, 18.5]
    },
    // Robot Défectueux — ressort à nu, fissure emboutie, étincelles, bras de rechange au sol.
    'Robot Défectueux': {
        palette: { base: '#b8a26a', dark: '#6b5f3f', accent: '#fde047' },
        markup: `
            <path d="M-13 -50 q3 -2 0 -4 q-3 -2 0 -4 q3 -2 0 -4" fill="none" stroke="#8a929c" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M7 -38 l4 3 l-4 3" fill="none" stroke="#05060c" stroke-width="1.1" stroke-linejoin="round"/>
            <path d="M-11 -74 l-4 -2 M-11 -71 l-4 2" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/>
            <rect x="3" y="-14" width="9" height="4" rx="1" fill="#8a929c" stroke="#05060c" stroke-width="1"/>`,
        bounds: [-18.5, 18.5]
    },
    // Lave-Linge Possédé — tambour à hublot avec chaussette rouge qui tourne, cascades de mousse.
    'Lave-Linge Possédé': {
        palette: { base: '#d6d2c4', dark: '#8a8578', accent: '#4aa8c9' },
        markup: `
            <circle cx="2" cy="-34" r="9" fill="#2a3a4a" stroke="#05060c" stroke-width="1.5"/>
            <circle cx="2" cy="-34" r="6" fill="#4aa8c9" opacity="0.55"/>
            <ellipse cx="0" cy="-31" rx="3.5" ry="2.5" fill="#c94f5a" stroke="#05060c" stroke-width="0.8"/>
            <circle cx="13" cy="-45" r="2" fill="#ffffff" opacity="0.7"/>
            <circle cx="16" cy="-41" r="1.4" fill="#ffffff" opacity="0.6"/>
            <rect x="-14" y="-52" width="6" height="4" rx="2" fill="#8a8578" stroke="#05060c" stroke-width="1"/>`,
        bounds: [-18.5, 18.5]
    },
    // Imprimante à Rêves — feuille qui sort du capot avec un nuage et une étoile dessinés.
    'Imprimante à Rêves': {
        palette: { base: '#b9c3d8', dark: '#6b7488', accent: '#c084fc' },
        markup: `
            <rect x="-3" y="-66" width="14" height="12" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="1"/>
            <path d="M1 -60 a3 3 0 1 1 5 -1 a2 2 0 1 1 3 1 z" fill="#c084fc" opacity="0.8"/>
            <path d="M2 -63 l0.8 1.6 l1.8 0.2 l-1.3 1.2 l0.3 1.8 l-1.6 -0.9 l-1.6 0.9 l0.3 -1.8 l-1.3 -1.2 l1.8 -0.2 z" fill="#fde047" opacity="0.9"/>
            <path d="M0 -70 q5 -2 9 0" fill="none" stroke="#c084fc" stroke-width="1.2" opacity="0.7"/>`,
        bounds: [-18.5, 18.5], top: -70
    },
    // Ordinateur en Colère — sourcils rouges sur l'écran, dents serrées, fumée, touche qui gicle.
    'Ordinateur en Colère': {
        palette: { base: '#5a6b8a', dark: '#37435a', accent: '#ef4444' },
        markup: `
            <path d="M6 -44 l4 -2.5 M12 -45 l4 2.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M4 -38.5 h8" stroke="#05060c" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="-8" cy="-66" r="2.5" fill="#cbd5e1" opacity="0.65"/>
            <circle cx="-4.5" cy="-70" r="2" fill="#cbd5e1" opacity="0.5"/>
            <rect x="-15" y="-30" width="4.5" height="4.5" rx="0.8" fill="#cbd5e1" stroke="#05060c" stroke-width="0.7" transform="rotate(14 -13 -28)"/>`,
        bounds: [-18.5, 18.5]
    },
    // Horodateur Vengeur — cadran à aiguille rouge, fente à pièces, ticket en train de sortir.
    'Horodateur Vengeur': {
        palette: { base: '#7c8a5a', dark: '#4a553a', accent: '#fbbf24' },
        markup: `
            <circle cx="0" cy="-46" r="5" fill="#e8e4d8" opacity="0.65" stroke="#05060c" stroke-width="1.2"/>
            <path d="M0 -46 L3.5 -48.5" stroke="#c23b3b" stroke-width="1.3" stroke-linecap="round"/>
            <rect x="-2.5" y="-59" width="5" height="1.8" fill="#05060c"/>
            <rect x="10" y="-26" width="9" height="6" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.9"/>
            <path d="M11.5 -22.5 h6" stroke="#05060c" stroke-width="0.7"/>`,
        bounds: [-18.5, 18.5]
    },
    // Caméra de Surveillance Autonome — objectif à lentille cyan braqué vers l'avant, LED rouge.
    'Caméra de Surveillance Autonome': {
        palette: { base: '#8a929c', dark: '#4f5560', accent: '#ef4444' },
        markup: `
            <rect x="10" y="-50" width="8" height="9" rx="2" fill="#2a2f3a" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="18" cy="-45.5" r="3.5" fill="#22d3ee" opacity="0.8" stroke="#05060c" stroke-width="1"/>
            <circle cx="-12" cy="-61" r="2" fill="#ef4444"/>
            <path d="M-6 -52 h6" stroke="#05060c" stroke-width="1.2"/>`,
        bounds: [-18.5, 21.5]
    },
    // Contrôleur de Billets Zombifié — casquette à bande rouge, pince à composter, sacoche (essai validé).
    'Contrôleur de Billets Zombifié': {
        palette: { base: '#9cb06e', dark: '#5c6b7c', accent: '#c94f3d' },
        markup: `
            <path class="mf-dark" d="M-8 -75 Q-8 -84 2 -84 Q11 -84 11 -75 L-8 -75 Z"/>
            <rect class="mf-accent" x="-8" y="-78" width="19" height="2.5" rx="1.2"/>
            <path class="mf-dark" d="M11 -76 L16.5 -73.5 L16.5 -70.5 L11 -73 Z"/>
            <path d="M-10 -53 L9 -41" stroke="#4a4436" stroke-width="3" stroke-linecap="round"/>
            <rect x="-15" y="-36" width="9" height="7.5" rx="1.5" fill="#4a4436" stroke="#05060c" stroke-width="1.2"/>
            <rect x="16.5" y="-52.5" width="7" height="9" rx="1.5" fill="#caa23a" stroke="#05060c" stroke-width="1.2"/>
            <rect x="20.8" y="-50" width="2.2" height="4.5" fill="#05060c"/>`,
        bounds: [-15, 22], top: -84
    },
    // Garde-Chiourme Bureaucrate — casquette plate, matraque levée, classeur à pinces, cravate de travers.
    'Garde-Chiourme Bureaucrate': {
        palette: { base: '#7c8899', dark: '#4a5563', accent: '#c94f3d' },
        markup: `
            <path class="mf-dark" d="M-4 -79 Q3 -85 11 -79 L11 -76 L-4 -76 Z"/>
            <rect class="mf-dark" x="9" y="-77" width="9" height="2.2" rx="1"/>
            <path d="M-13 -58 L-19 -75" stroke="#3a2d20" stroke-width="2.4" stroke-linecap="round"/>
            <rect x="-22" y="-80" width="5.5" height="6" rx="1.2" fill="#3a2d20" stroke="#05060c" stroke-width="1"/>
            <rect x="11" y="-44" width="8" height="11" rx="1" fill="#8a5a2e" stroke="#05060c" stroke-width="1"/>
            <rect x="13" y="-46" width="4" height="2.5" rx="1" fill="#b8b2a0" stroke="#05060c" stroke-width="0.8"/>`,
        bounds: [-22.5, 22], top: -82
    },
    // Ouvrier à la Chaîne — casque de chantier jaune, tablier de travail, clé à moche au poing.
    'Ouvrier à la Chaîne': {
        palette: { base: '#9cb06e', dark: '#4a5a6b', accent: '#fbbf24' },
        markup: `
            <path class="mf-accent" d="M-4 -80 Q6 -86 13 -79 L13 -76.5 Q3 -80 -4 -76.5 Z"/>
            <rect x="9" y="-78" width="9.5" height="2.4" rx="1.2" fill="#fbbf24" stroke="#05060c" stroke-width="1"/>
            <path class="mf-dark" d="M-7 -56 L9 -56 L11 -30 L-9 -30 Z"/>
            <circle cx="-13" cy="-46" r="2.8" fill="#8a929c" stroke="#05060c" stroke-width="1"/>
            <path d="M-13 -48.5 L-13 -44" stroke="#05060c" stroke-width="1.4"/>`,
        bounds: [-15.8, 22], top: -82
    },
    // Savant Dingue — lunettes fendues, touffe de cheveux blancs, erlenmeyer vert fumant.
    'Savant Dingue': {
        palette: { base: '#d8d2c4', dark: '#8a8578', accent: '#c94f3d' },
        markup: `
            <path d="M3 -82 q2 -4 4 -1 q1 -4 3 -2" fill="none" stroke="#e8e4d8" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="8" cy="-74" r="3" fill="none" stroke="#05060c" stroke-width="1.3"/>
            <circle cx="14.5" cy="-73" r="3" fill="none" stroke="#05060c" stroke-width="1.3"/>
            <path d="M11 -73.5 h1" stroke="#05060c" stroke-width="1"/>
            <path d="M6 -76 l2 3" stroke="#05060c" stroke-width="0.9"/>
            <path d="M16 -51 L21 -51 L20 -43 L17 -43 Z" fill="#84cc16" opacity="0.85" stroke="#05060c" stroke-width="1"/>
            <circle cx="-3" cy="-66" r="1.8" fill="#cbd5e1" opacity="0.6"/>
            <circle cx="0" cy="-62" r="1.3" fill="#cbd5e1" opacity="0.45"/>`,
        bounds: [-15, 22], top: -84
    },
    // Marchand Malhonnête — trench-coat ouvert, bourse de pièces gonflée, pièce d'or en équilibre.
    'Marchand Malhonnête': {
        palette: { base: '#9cb06e', dark: '#6b5a3f', accent: '#caa23a' },
        markup: `
            <path class="mf-dark" d="M-11 -58 L-13 -26 L-1 -26 L-2 -56 Z"/>
            <path d="M11 -33 q4 -5 8.5 -0.5 q-2 6 -8.5 4 z" fill="#8a5a2e" stroke="#05060c" stroke-width="1.1"/>
            <path d="M12 -35 q3 -3 5 -1" fill="none" stroke="#4a4436" stroke-width="1"/>
            <circle cx="18" cy="-26" r="2.2" fill="#caa23a" stroke="#05060c" stroke-width="0.8"/>
            <path d="M5 -78 l6 2.5" stroke="#05060c" stroke-width="1" stroke-linecap="round"/>`,
        bounds: [-14, 22]
    },
    // Garde du Marché — casque à crête, sagaie pointée, brassard doré.
    'Garde du Marché': {
        palette: { base: '#9cb06e', dark: '#5a3a2a', accent: '#fbbf24' },
        markup: `
            <path class="mf-dark" d="M-3 -81 Q6 -87 13 -80 L13 -77 L-3 -77 Z"/>
            <rect x="4" y="-80" width="3" height="9" rx="1.2" fill="#5a3a2a" stroke="#05060c" stroke-width="0.9"/>
            <path d="M13 -68 L-11 -22" stroke="#6b5a3a" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M13 -68 l4.5 -1.5 l-2 4.5 z" fill="#b8b2a0" stroke="#05060c" stroke-width="0.9"/>
            <rect x="-6" y="-58" width="9" height="4" rx="1" fill="#fbbf24" stroke="#05060c" stroke-width="0.9"/>`,
        bounds: [-12.5, 22], top: -82
    },
    // Maître-Nageur Zombifié — casque de bain rouge à bande blanche, sifflet, frite jaune sous le bras.
    'Maître-Nageur Zombifié': {
        palette: { base: '#9cb06e', dark: '#c94f5a', accent: '#22d3ee' },
        markup: `
            <path d="M-3 -81 Q6 -85 13 -78 L13 -74 Q4 -78 -3 -74 Z" fill="#c94f5a" stroke="#05060c" stroke-width="1.1"/>
            <path d="M-2 -79.5 q7 -3.5 14 0.5" fill="none" stroke="#e8e4d8" stroke-width="1.4"/>
            <circle cx="13" cy="-66" r="2.2" fill="#fbbf24" stroke="#05060c" stroke-width="0.9"/>
            <path d="M8 -70 q4 -2 6 2" fill="none" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-13 -46 Q-16 -30 -2 -26" fill="none" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
            <path d="M-10 -42 l3 1.5 M-9 -33 l3 1.5" stroke="#c94f5a" stroke-width="1.4"/>`,
        bounds: [-16.5, 22], top: -82
    },
    // Présentateur Télé-Achat Hystérique — costume violet criard, nœud papillon jaune, micro-casque.
    'Présentateur Télé-Achat Hystérique': {
        palette: { base: '#9cb06e', dark: '#7a4a8a', accent: '#fde047' },
        markup: `
            <path class="mf-dark" d="M-10 -60 L-9 -27 L10 -27 L9 -59 Z"/>
            <path d="M0 -58 L3 -46 L0 -40 L-3 -46 Z" fill="#fbbf24" stroke="#05060c" stroke-width="0.9"/>
            <path d="M-2 -82 Q10 -84 12.5 -75" fill="none" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="12.5" cy="-73" r="1.8" fill="#05060c"/>
            <path d="M17 -60 l3 3 M19.5 -59 l3 -3" stroke="#fde047" stroke-width="1.5" stroke-linecap="round"/>`,
        bounds: [-13, 22]
    },
    // Gobelin Paysagiste — chapeau de paille, sécateur ouvert, touffe d'herbe.
    'Gobelin Paysagiste': {
        palette: { base: '#8fae5a', dark: '#5f7a3a', accent: '#c23b3b' },
        markup: `
            <ellipse cx="3" cy="-65" rx="11" ry="2.2" fill="#d6b25a" stroke="#05060c" stroke-width="1.1"/>
            <path d="M-3 -70 q6 -4.5 11 -0.5 z" fill="#d6b25a" stroke="#05060c" stroke-width="1"/>
            <path d="M13 -38 q6 -3 7 2 q1 4 -3 4" fill="none" stroke="#8a929c" stroke-width="2" stroke-linecap="round"/>
            <path d="M13 -38 q5 4 1.5 7.5" fill="none" stroke="#5f7a3a" stroke-width="2" stroke-linecap="round"/>
            <circle cx="13.5" cy="-37" r="1.3" fill="#8a929c" stroke="#05060c" stroke-width="0.7"/>`,
        bounds: [-17, 21]
    },
    // Stagiaire Démoniaque — petites cornes, badge « STAGIAIRE », mug de café, post-it rouge.
    'Stagiaire Démoniaque': {
        palette: { base: '#8fae5a', dark: '#3a4a6b', accent: '#c23b3b' },
        markup: `
            <path d="M-2 -66 q-2 -6 -7 -6 q1 6 7 6 z" fill="#8a4a3a" stroke="#05060c" stroke-width="1"/>
            <path d="M7 -66 q0 -6 5 -7 q1 6 -5 7 z" fill="#8a4a3a" stroke="#05060c" stroke-width="1"/>
            <rect x="-8" y="-40" width="12.5" height="5.5" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <text x="-1.7" y="-36" font-size="3" font-weight="bold" fill="#3a4a6b" text-anchor="middle">STAGIAIRE</text>
            <rect x="12" y="-42" width="6" height="6.5" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.9"/>
            <path d="M18 -39 a2.5 2.5 0 1 0 2.5 2.5" fill="none" stroke="#05060c" stroke-width="0.9"/>
            <path d="M0 -57 l3 4 l-3 3" fill="none" stroke="#c23b3b" stroke-width="1.1"/>`,
        bounds: [-12.5, 21], top: -73
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOB_DETAILS };
}
