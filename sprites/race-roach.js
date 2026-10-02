// sprites/race-roach.js — Corps du Cafard mutant : dos bombé en carapace (frontExtent 14).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Antennes, carapace brune luisante à la
// place de la capuche, yeux à facettes, mandibule.
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    roach: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="15" ry="3.2"/>
    <rect x="-2.5" y="-26" width="4.5" height="22" rx="2" fill="#5a4632" stroke="#05060c" stroke-width="1.6"/>
    <rect x="-8" y="-26" width="4.5" height="22" rx="2" fill="#4a3a28" stroke="#05060c" stroke-width="1.6"/>
    <path d="M-11 -4 h7 v4 h-9 z" fill="#24160b" stroke="#05060c" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M-4.5 -4 h7 v4 h-9 z" fill="#24160b" stroke="#05060c" stroke-width="1.4" stroke-linejoin="round"/>
    <rect x="9" y="-46" width="9" height="17" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="10.5" y="-41" width="6" height="5" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.1"/>`,
            torso: `
    <path d="M-9 -50 Q-13 -58 -6 -62 L4 -63 Q10 -60 8 -52 L6 -28 L-8 -28 Z" fill="#5a4632" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-2 -62 Q10 -78 15 -60 Q15 -50 7 -46 Q0 -48 -2 -56 Z" fill="#24160b" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M6 -66 q4 -1 5 3" stroke="#7a4a26" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M9 -61 q3 0 4 3" stroke="#7a4a26" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M-7 -30 h13" stroke="#3a2a18" stroke-width="2.5"/>`,
            head: `
    <rect x="-4" y="-63" width="5" height="6" fill="#7a4a26"/>
    <circle cx="-4" cy="-62" r="7" fill="#7a4a26" stroke="#05060c" stroke-width="2"/>
    <path d="M-7 -68 Q-12 -76 -18 -74 M-5.5 -69 Q-8 -78 -14 -80" fill="none" stroke="#05060c" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="-8" cy="-64" r="2" fill="#24160b"/>
    <circle cx="-6" cy="-61.5" r="1.6" fill="#24160b"/>
    <circle cx="-8.5" cy="-60.5" r="1.4" fill="#24160b"/>
    <circle cx="-8.6" cy="-64.6" r="0.5" fill="#d9a05a"/>
    <path d="M-10.5 -59 q-1.5 1 -0.5 2" stroke="#05060c" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-11" y="-50" width="5.5" height="18" rx="3" fill="#5a4632" stroke="#05060c" stroke-width="1.8"/>
    <circle cx="-8.5" cy="-32" r="2.8" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>`, hand: [-8.5, -32] },
            weapon: { arm: `
    <path d="M-6 -54 L-9 -44 L-13 -41" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -54 L-9 -44 L-13 -41" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-14, -42], after: `
    <circle cx="-14" cy="-42" r="2.8" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-6 -54 L-13 -50 L-17 -49" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -54 L-13 -50 L-17 -49" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-18, -50], after: `
    <circle cx="-18" cy="-50" r="2.8" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-6 -54 L-9 -44 L-11 -38" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -54 L-9 -44 L-11 -38" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -37], after: `
    <circle cx="-12" cy="-37" r="2.8" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-6 -54 L-11 -58 L-15 -64" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -54 L-11 -58 L-15 -64" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-16, -65], after: `
    <path d="M-19 -68 l-1.5 -3 M-16.5 -69 l0 -3.5 M-14 -68 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-19 -68 l-1.5 -3 M-16.5 -69 l0 -3.5 M-14 -68 l1.5 -3" stroke="#7a4a26" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-16" cy="-65" r="3.2" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-6 -54 L-9 -45 L-12 -56" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -54 L-9 -45 L-12 -56" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-13, -59], after: `
    <circle cx="-13" cy="-59" r="3.1" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-8" cy="-60" r="2.9" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 14,
        anchors: {
            stowedRanged: { x: 13, y: -48, rot: 55, scale: 0.7 },
            stowedWeapon: { x: 4, y: -32, rot: 160, scale: 0.62 },
            armor: { x: -0.5, y: -46, scale: 0.95 }
        },
        corpse: `
    <path d="M-6 8 L-15 42" stroke="#05060c" stroke-width="8" stroke-linecap="round"/>
    <path d="M-6 8 L-15 42" stroke="#5a4632" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M6 8 L13 25 L20 42" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 8 L13 25 L20 42" fill="none" stroke="#4a3a28" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-16" cy="46" rx="4" ry="5.5" transform="rotate(18 -16 46)" fill="#24160b" stroke="#05060c" stroke-width="1.4"/>
    <ellipse cx="22" cy="44" rx="4" ry="5.5" transform="rotate(-22 22 44)" fill="#24160b" stroke="#05060c" stroke-width="1.4"/>
    <path d="M-11 -18 L-26 -30" stroke="#05060c" stroke-width="8" stroke-linecap="round"/>
    <path d="M-11 -18 L-26 -30" stroke="#5a4632" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="-27.5" cy="-31.5" r="3" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>
    <path d="M11 -16 L25 -10 L33 -1" fill="none" stroke="#05060c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 -16 L25 -10 L33 -1" fill="none" stroke="#5a4632" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="34.5" cy="0" r="3" fill="#7a4a26" stroke="#05060c" stroke-width="1.2"/>
    <rect x="-12" y="-26" width="24" height="36" rx="8" fill="#5a4632" stroke="#05060c" stroke-width="2.2"/>
    <rect x="-9" y="-22" width="18" height="26" rx="5" fill="#24160b" stroke="#05060c" stroke-width="2"/>
    <path d="M-4 -18 q5 -1.5 6 2 M2 -12 q4 -0.5 4 3" stroke="#7a4a26" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <rect x="-6" y="-8" width="9" height="7" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.1"/>
    <circle cx="0" cy="-40" r="7.5" fill="#7a4a26" stroke="#05060c" stroke-width="2"/>
    <circle cx="-3" cy="-42" r="1.8" fill="#24160b"/>
    <circle cx="1" cy="-41" r="1.5" fill="#24160b"/>
    <path d="M-6 -46 Q-12 -54 -18 -51 M-2 -47 Q-5 -57 -11 -60" fill="none" stroke="#05060c" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M-7 -38 q-2 2 -0.5 3.5 M7 -38 q2 2 0.5 3.5" stroke="#05060c" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
        tint: { skin: '#7a4a26', hair: '#24160b' }
    }
});
