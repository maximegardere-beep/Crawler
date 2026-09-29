// sprites/mob-details-b.js - Détails signature des mobs (2e moitié) : plant, blob, shade, mannequin,
// swarm et vehicle (20 mobs). Complète MOB_DETAILS déclaré dans mob-details-a.js (chargé avant).
// Repère commun aux silhouettes : x = 0 au centre, y = 0 aux pieds, y négatif vers le haut. `markup` est
// dessiné PAR-DESSUS la silhouette de l'archétype du mob (sprites/mobs.js), dans le même repère ; il peut
// en recouvrir des parties, mais ne redessine pas toute la silhouette.
//
// Format d'une entrée (clé = nom EXACT du mob, bestiary.js) :
//   palette : teintes naturelles du mob COMPLET (remplacent la palette de l'archétype) ;
//   bounds  : vrais x min et max du mob complet (silhouette + détail), toujours dans [-24, +24] ;
//   top     : seulement si le détail dépasse le haut de la silhouette.
// Catalogue pur, sans DOM ni gameState.

Object.assign(MOB_DETAILS, {
    // Tulipe Géante — corolle de tulipe rose à trois pétales, étamine jaune, pétale veiné.
    'Tulipe Géante': {
        palette: { base: '#d97a8a', dark: '#8a4a58', accent: '#fde047' },
        markup: `
            <path class="mf-base" d="M-10 -66 C-8 -46 16 -46 14 -66 L10 -57 L6 -66 L2 -57 L-2 -66 Z"/>
            <circle class="mf-accent" cx="3" cy="-52" r="1.7"/>
            <path d="M-6 -60 q9 3 16 -1" fill="none" stroke="#8a4a58" stroke-width="1.1" opacity="0.8"/>`,
        bounds: [-16, 19.5], top: -67
    },
    // Ronce Étrangleuse — épines le long de la tige, liane vrillée qui s'enroule sur elle-même.
    'Ronce Étrangleuse': {
        palette: { base: '#4a6b3a', dark: '#2f4a26', accent: '#c23b3b' },
        markup: `
            <path d="M-4 -38 l-5 -1.5 M-3 -27 l-5 -1.5 M-2 -13 l-5 -1.5" stroke="#2f4a26" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 -50 q6 4 4 10 q-2 5 -7 4" fill="none" stroke="#2f4a26" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M10 -47 l4 -2 M12 -40 l4 0" stroke="#2f4a26" stroke-width="1.6" stroke-linecap="round"/>`,
        bounds: [-16, 19.5]
    },
    // Frite de Piscine Étrangleuse — rayures rouges de frite mousse, gouttes d'eau de piscine.
    'Frite de Piscine Étrangleuse': {
        palette: { base: '#fbbf24', dark: '#c94f5a', accent: '#22d3ee' },
        markup: `
            <path d="M-6 -60 q10 3 13 12 M-4 -46 q10 3 13 11 M-2 -32 q9 2 12 10" fill="none" stroke="#c94f5a" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="16" cy="-30" r="1.7" fill="#22d3ee"/>
            <circle cx="19" cy="-25" r="1.3" fill="#22d3ee" opacity="0.8"/>`,
        bounds: [-16, 19.5]
    },
    // Saucisse Vivante — marques de grill, zigzag de moutarde.
    'Saucisse Vivante': {
        palette: { base: '#c9563f', dark: '#8a3a28', accent: '#fcd34d' },
        markup: `
            <path d="M-10 -28 l3.5 5 M0 -34 l3.5 5 M-6 -13 l3.5 5" stroke="#6b2a1c" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 -30 l3 2 l-3 2 l3 2 l-3 2" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="16" cy="-22" r="1.2" fill="#fcd34d"/>`,
        bounds: [-22.5, 22.5]
    },
    // Fromage qui Pue — trous de fromage, volutes de puanteur verte.
    'Fromage qui Pue': {
        palette: { base: '#e8c95a', dark: '#b8923a', accent: '#84cc16' },
        markup: `
            <circle cx="-8" cy="-21" r="3" fill="#b8923a" stroke="#05060c" stroke-width="1"/>
            <circle cx="2" cy="-30" r="2" fill="#b8923a" stroke="#05060c" stroke-width="0.9"/>
            <circle cx="-2" cy="-13" r="2.4" fill="#b8923a" stroke="#05060c" stroke-width="0.9"/>
            <path d="M13 -40 q3 -4 0 -8 M17 -38 q3 -3 0 -7" fill="none" stroke="#84cc16" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`,
        bounds: [-22.5, 22.5]
    },
    // Créature en Bocaux — bocal en verre posé sur le corps, étiquette, tentacule plaquée contre la paroi.
    'Créature en Bocaux': {
        palette: { base: '#79b8b0', dark: '#4a7a74', accent: '#c23b3b' },
        markup: `
            <rect x="-12" y="-50" width="24" height="5" rx="2" fill="#8a929c" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-14 -46 L-14 -8 Q-14 -2 -8 -2 L10 -2 Q16 -2 16 -8 L16 -46 Z" fill="#cde8e5" opacity="0.4" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-8 -20 q6 -4 12 0" fill="none" stroke="#4a7a74" stroke-width="2.4" stroke-linecap="round"/>
            <rect x="-8" y="-17" width="10" height="6.5" rx="1" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-6 -14 h6" stroke="#05060c" stroke-width="0.7"/>`,
        bounds: [-15.5, 17.5], top: -51
    },
    // Monstre de Poussière — plumes de poussière hérissées, plume grise plantée, miettes en suspension.
    'Monstre de Poussière': {
        palette: { base: '#8a8578', dark: '#5c5748', accent: '#c23b3b' },
        markup: `
            <path d="M-14 -30 l-4 -3 M-8 -38 l-3 -4 M4 -41 l2 -4 M12 -34 l4 -3" stroke="#5c5748" stroke-width="2" stroke-linecap="round"/>
            <path d="M14 -38 q6 -6 4 -12" fill="none" stroke="#cbd5e1" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="-15" cy="-40" r="1" fill="#e5e0cf" opacity="0.5"/>
            <circle cx="17" cy="-44" r="0.9" fill="#e5e0cf" opacity="0.5"/>`,
        bounds: [-22.5, 22.5]
    },
    // Sac de Pièces Vivant — cordon serré du sac, pièces qui s'échappent, couture.
    'Sac de Pièces Vivant': {
        palette: { base: '#caa23a', dark: '#8a6b2a', accent: '#e8e4d8' },
        markup: `
            <path d="M-5 -40 q5 3.5 10 0" fill="none" stroke="#8a6b2a" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M-4 -42 L0 -37 L4 -42" fill="none" stroke="#4a4436" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="11" cy="-33" r="2.4" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <circle cx="14" cy="-27" r="2" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-8 -19 h16" stroke="#8a6b2a" stroke-width="1" opacity="0.6"/>`,
        bounds: [-22.5, 22.5]
    },
    // Livre Maudit — livre ouvert flottant, œil jaune entre les pages, rune violette.
    'Livre Maudit': {
        palette: { base: '#5a3a7a', dark: '#3a2455', accent: '#ffd76a' },
        markup: `
            <path d="M-12 -40 L0 -36 L12 -40 L12 -22 L0 -18 L-12 -22 Z" fill="#5a3a7a" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M0 -36 L0 -18" stroke="#05060c" stroke-width="0.9"/>
            <ellipse cx="0" cy="-30" rx="3.2" ry="2.2" fill="#ffd76a"/>
            <circle cx="0" cy="-30" r="1" fill="#05060c"/>
            <path d="M-8 -25 l4 1.5" stroke="#c084fc" stroke-width="1"/>`,
        bounds: [-18, 22]
    },
    // Bibliothécaire Fantôme — lunettes rondes sur chaîne, doigt vertical « chut », nœud papillon.
    'Bibliothécaire Fantôme': {
        palette: { base: '#7c8cb8', dark: '#47536e', accent: '#ffd76a' },
        markup: `
            <circle cx="4" cy="-62" r="3" fill="none" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="11" cy="-61" r="3" fill="none" stroke="#05060c" stroke-width="1.2"/>
            <path d="M7 -61.5 h1" stroke="#05060c" stroke-width="1"/>
            <path d="M1 -59 q-3 4 -1 8" fill="none" stroke="#47536e" stroke-width="0.9"/>
            <path d="M14 -50 l1.5 -7" stroke="#7c8cb8" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M1 -14 l-3 2 l3 2 l3 -2 z" fill="#4a3a5a" stroke="#05060c" stroke-width="0.8"/>`,
        bounds: [-18, 22]
    },
    // Encre Vivante — gouttes qui coulent, plume-stiletto, éclaboussure.
    'Encre Vivante': {
        palette: { base: '#4a5a9a', dark: '#2a3a6b', accent: '#ffd76a' },
        markup: `
            <path d="M-10 -10 q-1.5 4 0 5 q1.5 -1 0 -5 z" fill="#2a3a6b" stroke="#05060c" stroke-width="0.7"/>
            <path d="M-2 -6 q-1.5 4 0 5 q1.5 -1 0 -5 z" fill="#2a3a6b" stroke="#05060c" stroke-width="0.7"/>
            <path d="M14 -50 l4 -8 l1.5 5 l-4.5 4 z" fill="#4a5a9a" stroke="#05060c" stroke-width="1"/>
            <path d="M15.5 -49 l3.5 -4" stroke="#05060c" stroke-width="0.7"/>`,
        bounds: [-18, 21]
    },
    // Ombre Suspicieuse — fedora à bande, col relevé, yeux plissés.
    'Ombre Suspicieuse': {
        palette: { base: '#3a4152', dark: '#232836', accent: '#ffd76a' },
        markup: `
            <path d="M-11 -66 Q0 -75 11 -66 L13 -63.5 L-13 -63.5 Z" fill="#232836" stroke="#05060c" stroke-width="1.2"/>
            <rect x="-9" y="-67" width="17" height="2.4" fill="#3a4152"/>
            <path d="M-11 -50 l6 4.5 l6 -4.5" fill="none" stroke="#232836" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M6 -59 h4 M11.5 -59 h4" stroke="#05060c" stroke-width="1.6" stroke-linecap="round"/>`,
        bounds: [-18, 22], top: -75
    },
    // Miroir Brisé — miroir ovale fissuré, œil rouge dans la réflexion, pied de porte-miroir.
    'Miroir Brisé': {
        palette: { base: '#aac4d8', dark: '#5f7590', accent: '#c23b3b' },
        markup: `
            <ellipse cx="3" cy="-48" rx="12" ry="16" fill="#aac4d8" opacity="0.55" stroke="#05060c" stroke-width="1.6"/>
            <path d="M3 -61 l-3 8 l4 6 M-1 -47 l6 4 M6 -56 l4 3" stroke="#05060c" stroke-width="1" fill="none"/>
            <circle class="mf-accent" cx="4" cy="-46" r="2.2"/>
            <path d="M-6 -32 h18" stroke="#5f7590" stroke-width="2.4" stroke-linecap="round"/>`,
        bounds: [-18, 22]
    },
    // Nuage de Chlore Ambulant — bouffées vert-jaune, bulles de chlore cyan.
    'Nuage de Chlore Ambulant': {
        palette: { base: '#b8d84a', dark: '#7a9a2a', accent: '#22d3ee' },
        markup: `
            <circle cx="-12" cy="-50" r="5" fill="#b8d84a" opacity="0.55"/>
            <circle cx="10" cy="-56" r="6" fill="#cbe86a" opacity="0.5"/>
            <circle cx="0" cy="-66" r="4.5" fill="#b8d84a" opacity="0.5"/>
            <circle cx="16" cy="-46" r="2" fill="#22d3ee" opacity="0.6"/>
            <circle cx="-17" cy="-40" r="1.6" fill="#22d3ee" opacity="0.5"/>`,
        bounds: [-18, 22]
    },
    // Mime Aggressif — béret noir, marinière à rayons, gants blancs en poings, froncement de sourcils.
    'Mime Aggressif': {
        palette: { base: '#d9cbb0', dark: '#2a2f3a', accent: '#c23b3b' },
        markup: `
            <ellipse cx="1" cy="-84.5" rx="8" ry="3" fill="#2a2f3a" stroke="#05060c" stroke-width="1.1"/>
            <circle cx="1" cy="-88" r="1.2" fill="#2a2f3a"/>
            <path d="M-9.5 -41 h19 M-9.5 -37 h19 M-9.5 -33 h19" stroke="#2a2f3a" stroke-width="1.7"/>
            <circle cx="-11" cy="-46" r="3.4" fill="#e8e4d8" stroke="#05060c" stroke-width="1.2"/>
            <circle cx="11" cy="-46" r="3.4" fill="#e8e4d8" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-13 -58 l10 6 M13 -58 l-10 6" stroke="#05060c" stroke-width="1.2"/>`,
        bounds: [-14.7, 14.7], top: -89
    },
    // Chaussette Solitaire — bord-côte retourné, talon rapiécé, trous, regard de tueur jaune.
    'Chaussette Solitaire': {
        palette: { base: '#c94f5a', dark: '#7a2a3a', accent: '#fde047' },
        markup: `
            <rect x="-7" y="-71" width="14" height="6.5" rx="2.5" fill="#e8e4d8" stroke="#05060c" stroke-width="1.2"/>
            <path d="M-7 -64 h14" stroke="#e8e4d8" stroke-width="1.6"/>
            <ellipse cx="2" cy="-38" rx="5" ry="4.5" fill="#e8e4d8" stroke="#05060c" stroke-width="1.1"/>
            <circle cx="-4" cy="-54" r="1.8" fill="#0b0d14"/>
            <circle cx="-5" cy="-48" r="1.4" fill="#0b0d14"/>
            <path d="M12 -40 q4 2 3 6" fill="none" stroke="#7a2a3a" stroke-width="1.2"/>`,
        bounds: [-10.5, 15.5], top: -71
    },
    // Cône de Chantier Fou — cône orange à bande blanche, yeux rouges furieux, base alourdie.
    'Cône de Chantier Fou': {
        palette: { base: '#e07a3a', dark: '#9a4a1c', accent: '#c23b3b' },
        markup: `
            <path d="M-7 -52 L0 -86 L7 -52 Z" fill="#e07a3a" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
            <path d="M-4.6 -65 h9.2" stroke="#e8e4d8" stroke-width="3"/>
            <rect x="-11" y="-53" width="22" height="5" rx="1.5" fill="#e07a3a" stroke="#05060c" stroke-width="1.2"/>
            <circle class="mf-accent" cx="-2.5" cy="-58" r="1.9"/>
            <circle class="mf-accent" cx="3.5" cy="-58" r="1.9"/>
            <path d="M-5 -61 l5 -2 l5 2" fill="none" stroke="#05060c" stroke-width="1.1"/>`,
        bounds: [-12.5, 12.5], top: -87
    },
    // Mannequin Vitrine Possédé — robe violette de vitrine, collier de perles, étiquette prix pendue.
    'Mannequin Vitrine Possédé': {
        palette: { base: '#d9cbb0', dark: '#7a4a8a', accent: '#c23b3b' },
        markup: `
            <path d="M-8 -40 L10 -40 L14 -26 L-12 -26 Z" fill="#7a4a8a" stroke="#05060c" stroke-width="1.5"/>
            <path d="M-3 -38 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0" fill="#e8e4d8"/>
            <path d="M1 -38 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0" fill="#e8e4d8"/>
            <rect x="11" y="-52" width="7" height="5" rx="0.8" fill="#e8e4d8" stroke="#05060c" stroke-width="0.8"/>
            <path d="M8 -54 q3 -1.5 3.5 1.5" fill="none" stroke="#05060c" stroke-width="0.8"/>`,
        bounds: [-13, 18]
    },
    // Câble Électrique Vivant — tête en prise électrique à deux broches, bouts dénudés cuivrés.
    'Câble Électrique Vivant': {
        palette: { base: '#c97a3a', dark: '#7a3a1c', accent: '#fde047' },
        markup: `
            <rect x="14" y="-46" width="7.5" height="7" rx="1.5" fill="#2a2f3a" stroke="#05060c" stroke-width="1.1"/>
            <rect x="21" y="-44.6" width="3" height="1.6" fill="#b8b2a0"/>
            <rect x="21" y="-41.6" width="3" height="1.6" fill="#b8b2a0"/>
            <path d="M-15 -8 l-4 4 M-13 -6 l-3 5 M-17 -10 l-1 5" stroke="#c97a3a" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M-6 -3 l-2 4 M6 -3 l2 4" stroke="#c97a3a" stroke-width="1.3" stroke-linecap="round"/>`,
        bounds: [-23, 24]
    },
    // Voiture Abandonnée Rouillée — plaques de rouille, pneu avant crevé, toile d'araignée au coin.
    'Voiture Abandonnée Rouillée': {
        palette: { base: '#a8543a', dark: '#6b3a28', accent: '#fbbf24' },
        markup: `
            <ellipse cx="-7" cy="-32" rx="4.5" ry="2.4" fill="#8a4a24" opacity="0.85"/>
            <ellipse cx="7" cy="-30" rx="3.5" ry="2" fill="#8a4a24" opacity="0.8"/>
            <path d="M-22 -27 l6 -1.5 M-22 -25 l5 2 M-21.5 -28.5 l1.5 -5" stroke="#cbd5e1" stroke-width="0.8" opacity="0.6"/>
            <path d="M-8 -38 h10" stroke="#05060c" stroke-width="0.9" opacity="0.7"/>
            <path d="M-18 -1.5 q6 -4 12 0" fill="#2a2925" stroke="#05060c" stroke-width="1"/>`,
        bounds: [-23, 23]
    },
    // Chasseurs de primes (chantier 3, bountyHunters dans bestiary.js — hors baseMobs) : chapeau de
    // chasseur, étoile de shérif en fer-blanc, et l'outil de chaque variante.
    // Gobelin Pisteur de Primes — chapeau à large bord, étoile, longue-vue en bandoulière, avis plié.
    'Gobelin Pisteur de Primes': {
        palette: { base: '#7c9a4e', dark: '#4a5e2c', accent: '#d4a72c' },
        markup: `
            <ellipse cx="2" cy="-66" rx="12.5" ry="2.4" fill="#5b3a22" stroke="#05060c" stroke-width="1.1"/>
            <path d="M-5 -67 q7 -8 13 0 z" fill="#6b4428" stroke="#05060c" stroke-width="1"/>
            <path d="M-3 -44 l1.2 2.4 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.4 -1.3 l-2.4 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3 z" fill="#d4a72c" stroke="#05060c" stroke-width="0.6"/>
            <path d="M-9 -52 L12 -30" stroke="#5b3a22" stroke-width="1.6"/>
            <rect x="9" y="-35" width="9" height="3.2" rx="1.2" fill="#8a929c" stroke="#05060c" stroke-width="0.8" transform="rotate(30 13 -33)"/>
            <rect x="-15" y="-36" width="6" height="7.5" fill="#e8e1c8" stroke="#05060c" stroke-width="0.7"/>
            <path d="M-14 -33 h4 M-14 -31 h3" stroke="#991b1b" stroke-width="0.7"/>`,
        bounds: [-16, 21]
    },
    // Gobelin Cogneur de Primes — bandana, étoile, gourdin clouté, filet roulé à la ceinture.
    'Gobelin Cogneur de Primes': {
        palette: { base: '#6f8f45', dark: '#44582a', accent: '#b91c1c' },
        markup: `
            <path d="M-8 -66 q10 -6 19 0 l-1 3 q-8 -3 -17 0 z" fill="#b91c1c" stroke="#05060c" stroke-width="1"/>
            <path d="M11 -64 l5 3 l-4 1" fill="#b91c1c" stroke="#05060c" stroke-width="0.8"/>
            <path d="M-3 -44 l1.2 2.4 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.4 -1.3 l-2.4 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3 z" fill="#d4a72c" stroke="#05060c" stroke-width="0.6"/>
            <path d="M14 -30 L21 -52" stroke="#6b4428" stroke-width="3.2" stroke-linecap="round"/>
            <circle cx="20" cy="-50" r="0.9" fill="#cbd5e1"/><circle cx="18.6" cy="-46" r="0.9" fill="#cbd5e1"/>
            <ellipse cx="-9" cy="-24" rx="5" ry="3" fill="none" stroke="#a8a29e" stroke-width="1" stroke-dasharray="1.5 1"/>`,
        bounds: [-15, 22]
    },
    // Chef d'Escouade Gobelin — chapeau à plume, grande étoile, porte-voix, cartouchière.
    "Chef d'Escouade Gobelin": {
        palette: { base: '#6a8840', dark: '#3f5224', accent: '#facc15' },
        markup: `
            <ellipse cx="2" cy="-67" rx="13" ry="2.4" fill="#3f2a1a" stroke="#05060c" stroke-width="1.1"/>
            <path d="M-6 -68 q8 -9 15 0 z" fill="#4a3220" stroke="#05060c" stroke-width="1"/>
            <path d="M8 -74 q6 -8 11 -6 q-5 2 -9 7 z" fill="#b91c1c" stroke="#05060c" stroke-width="0.7"/>
            <path d="M-3 -46 l1.6 3.2 l3.4 0.4 l-2.5 2.4 l0.7 3.4 l-3.2 -1.8 l-3.2 1.8 l0.7 -3.4 l-2.5 -2.4 l3.4 -0.4 z" fill="#facc15" stroke="#05060c" stroke-width="0.6"/>
            <path d="M-11 -50 L10 -28" stroke="#3f2a1a" stroke-width="2.2"/>
            <path d="M-8 -47 v2 M-4 -43 v2 M0 -39 v2 M4 -35 v2" stroke="#d4a72c" stroke-width="1.4"/>
            <path d="M13 -44 l7 -3 v8 z" fill="#8a929c" stroke="#05060c" stroke-width="0.8"/>`,
        bounds: [-14, 21], top: -76
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOB_DETAILS };
}
