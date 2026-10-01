// sprites/race-goblin.js — Corps du Gobelin de caniveau : petit (environ -15 % de hauteur), grosse tête (frontExtent 13).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Grandes oreilles pointues, long nez,
// capuche de fortune en sac plastique (plis et noeud).
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    goblin: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="13.5" ry="3.2"/>
    <rect x="-2" y="-26" width="5.5" height="22" rx="2.5" fill="#5a4a34" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-8" y="-26" width="5.5" height="22" rx="2.5" fill="#4a3c2a" stroke="#05060c" stroke-width="1.8"/>
    <path d="M-11 -4 h8 v4 h-10 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-4 -4 h8 v4 h-10 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="7.5" y="-52" width="10" height="20" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="9.5" y="-47" width="6" height="6" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
            torso: `
    <path d="M-9 -52 Q-11 -58 -4 -60 L4 -60 Q9 -58 8 -51 L7 -30 L-8 -30 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="-8" y="-38" width="15" height="3.5" fill="#3a2a18" stroke="#05060c" stroke-width="1.2"/>`,
            head: `
    <rect x="-3.5" y="-63" width="5" height="5" fill="#6aa84f"/>
    <circle cx="0" cy="-69" r="9.5" fill="#6aa84f" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-8 -76 Q0 -84 8 -76 Q11 -70 7 -65 Q0 -67 -7 -66 Q-11 -71 -8 -76 Z" fill="#2a3a1c" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-4 -79 l1 3 M2 -80 l0 3 M5 -76 l-1 3" stroke="#05060c" stroke-width="0.9" stroke-linecap="round"/>
    <path d="M7 -65 q3 2 2 4" stroke="#05060c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M7 -74 L16 -80 L9 -70 Z" fill="#6aa84f" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-7 -69 L-14 -66 L-7 -63 Z" fill="#6aa84f" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="-4.5" cy="-70" r="1.3" fill="#05060c"/>
    <path d="M-6 -63.5 q2 1.2 3.5 0.2" stroke="#05060c" stroke-width="1" fill="none" stroke-linecap="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-10" y="-50" width="5" height="16" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <circle cx="-7.5" cy="-30" r="2.3" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>`, hand: [-7.5, -30] },
            weapon: { arm: `
    <path d="M-5 -52 L-7 -42 L-11 -39" fill="none" stroke="#05060c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-5 -52 L-7 -42 L-11 -39" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -40], after: `
    <circle cx="-12" cy="-40" r="2.3" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-5 -52 L-11 -48 L-15 -47" fill="none" stroke="#05060c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-5 -52 L-11 -48 L-15 -47" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-16, -47], after: `
    <circle cx="-16" cy="-47" r="2.3" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-5 -52 L-8 -42 L-10 -36" fill="none" stroke="#05060c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-5 -52 L-8 -42 L-10 -36" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-11, -35], after: `
    <circle cx="-11" cy="-35" r="2.3" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-5 -52 L-10 -56 L-14 -61" fill="none" stroke="#05060c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-5 -52 L-10 -56 L-14 -61" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-15, -62], after: `
    <path d="M-18 -65 l-1.5 -3 M-15.5 -66 l0 -3.5 M-13 -65 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-18 -65 l-1.5 -3 M-15.5 -66 l0 -3.5 M-13 -65 l1.5 -3" stroke="#6aa84f" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-15" cy="-62" r="2.7" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-5 -52 L-8 -43 L-11 -53" fill="none" stroke="#05060c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-5 -52 L-8 -43 L-11 -53" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -56], after: `
    <circle cx="-12" cy="-56" r="2.8" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-8" cy="-58" r="2.6" fill="#6aa84f" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 13,
        anchors: {
            stowedRanged: { x: 12, y: -44, rot: 55, scale: 0.7 },
            stowedWeapon: { x: 4, y: -27, rot: 160, scale: 0.6 }
        },
        corpse: `
    <path d="M-5 8 L-13 36" stroke="#05060c" stroke-width="8" stroke-linecap="round"/>
    <path d="M-5 8 L-13 36" stroke="#5a4a34" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M5 8 L11 22 L18 36" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 8 L11 22 L18 36" fill="none" stroke="#4a3c2a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-14" cy="40" rx="4" ry="5" transform="rotate(18 -14 40)" fill="#241a10" stroke="#05060c" stroke-width="1.4"/>
    <ellipse cx="20" cy="39" rx="4" ry="5" transform="rotate(-22 20 39)" fill="#241a10" stroke="#05060c" stroke-width="1.4"/>
    <path d="M-9 -16 L-21 -27" stroke="#05060c" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M-9 -16 L-21 -27" stroke="#4a3a24" stroke-width="5" stroke-linecap="round"/>
    <circle cx="-22.5" cy="-28.5" r="2.6" fill="#6aa84f" stroke="#05060c" stroke-width="1.1"/>
    <path d="M9 -15 L21 -9 L28 -2" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9 -15 L21 -9 L28 -2" fill="none" stroke="#4a3a24" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="29.5" cy="-0.5" r="2.6" fill="#6aa84f" stroke="#05060c" stroke-width="1.1"/>
    <rect x="-11" y="-24" width="22" height="30" rx="6" fill="#6b5638" stroke="#05060c" stroke-width="2"/>
    <rect x="-8" y="-20" width="16" height="22" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.6"/>
    <rect x="-4" y="-8" width="8" height="6" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.1"/>
    <circle cx="0" cy="-36" r="10" fill="#6aa84f" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-4 -42 Q4 -49 11 -42 Q13 -36 9 -32 Q2 -34 -4 -33 Q-8 -37 -4 -42 Z" fill="#2a3a1c" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-10 -36 L-17 -33 L-10 -30 Z" fill="#6aa84f" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M10 -38 L18 -43 L12 -33 Z" fill="#6aa84f" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-9 -39 l-1 -3 M3 -43 l1 -3" stroke="#05060c" stroke-width="0.9" stroke-linecap="round"/>
    <circle cx="-5" cy="-35" r="1.2" fill="#05060c"/>`,
        tint: { skin: '#6aa84f', hair: '#2a3a1c' }
    }
});
