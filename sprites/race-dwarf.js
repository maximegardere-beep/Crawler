// sprites/race-dwarf.js — Corps du Nain de chantier : petit et trapu (environ -20 % de hauteur, frontExtent 16).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Grande barbe rousse, casque de chantier,
// bottes de sécurité à coquille.
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    dwarf: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="17" ry="3.5"/>
    <rect x="-2" y="-26" width="8" height="22" rx="3" fill="#5a4a34" stroke="#05060c" stroke-width="2"/>
    <rect x="-11" y="-26" width="8" height="22" rx="3" fill="#4a3c2a" stroke="#05060c" stroke-width="2"/>
    <path d="M-16 -6 h12 v6 h-14 z" fill="#241a10" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="-16" y="-6" width="4" height="6" fill="#6b7280" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-6 -6 h12 v6 h-14 z" fill="#241a10" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="-6" y="-6" width="4" height="6" fill="#6b7280" stroke="#05060c" stroke-width="1.2"/>
    <rect x="8" y="-52" width="12" height="22" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="10.5" y="-46" width="7" height="7" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
            torso: `
    <path d="M-12 -54 Q-15 -63 -4 -65 L5 -65 Q15 -63 12 -53 L11 -28 L-11 -28 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="-10.5" y="-34" width="21" height="5" fill="#3a2a18" stroke="#05060c" stroke-width="1.5"/>
    <rect x="-1.5" y="-34.5" width="3" height="6" rx="1" fill="#8a7a4a" stroke="#05060c" stroke-width="1.2"/>`,
            head: `
    <rect x="-4" y="-66" width="5" height="6" fill="#d9a07a"/>
    <circle cx="-1" cy="-61" r="7.5" fill="#d9a07a" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-8 -58 Q-12 -48 -6 -40 L-3 -45 L-1 -38 L1 -45 L4 -39 Q9 -50 5 -58 Q-2 -63 -8 -58 Z" fill="#a23d14" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-10 -60 Q-10 -70 0 -70 Q10 -70 10 -60 Z" fill="#c9a227" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
    <rect x="-12.5" y="-61" width="25" height="3" rx="1.5" fill="#b8901f" stroke="#05060c" stroke-width="1.5"/>
    <path d="M3 -62 Q6 -63 8 -61" fill="#c9a227" stroke="#05060c" stroke-width="1.5"/>
    <circle cx="-4.5" cy="-62" r="1.2" fill="#05060c"/>
    <circle cx="-7" cy="-60" r="2" fill="#d9a07a" stroke="#05060c" stroke-width="1.1"/>
    <path d="M-8.5 -63.5 q3 1.5 7 0.5" stroke="#a23d14" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-12" y="-56" width="7" height="19" rx="3.5" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <circle cx="-8.5" cy="-37" r="3.4" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>`, hand: [-8.5, -37] },
            weapon: { arm: `
    <path d="M-6 -58 L-9 -46 L-14 -43" fill="none" stroke="#05060c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -58 L-9 -46 L-14 -43" fill="none" stroke="#4a3a24" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-15, -44], after: `
    <circle cx="-15" cy="-44" r="3.4" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-6 -58 L-13 -54 L-17 -53" fill="none" stroke="#05060c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -58 L-13 -54 L-17 -53" fill="none" stroke="#4a3a24" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-18, -54], after: `
    <circle cx="-18" cy="-54" r="3.4" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-6 -58 L-9 -46 L-11 -40" fill="none" stroke="#05060c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -58 L-9 -46 L-11 -40" fill="none" stroke="#4a3a24" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -39], after: `
    <circle cx="-12" cy="-39" r="3.4" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-6 -58 L-11 -62 L-15 -68" fill="none" stroke="#05060c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -58 L-11 -62 L-15 -68" fill="none" stroke="#4a3a24" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-16, -69], after: `
    <path d="M-19 -72 l-1.5 -3 M-16.5 -73 l0 -3.5 M-14 -72 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-19 -72 l-1.5 -3 M-16.5 -73 l0 -3.5 M-14 -72 l1.5 -3" stroke="#d9a07a" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-16" cy="-69" r="3.8" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-6 -58 L-9 -48 L-12 -60" fill="none" stroke="#05060c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-6 -58 L-9 -48 L-12 -60" fill="none" stroke="#4a3a24" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-13, -63], after: `
    <circle cx="-13" cy="-63" r="3.9" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-8" cy="-64" r="3.7" fill="#d9a07a" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 16,
        anchors: {
            stowedRanged: { x: 13, y: -46, rot: 55, scale: 0.72 },
            stowedWeapon: { x: 5, y: -30, rot: 160, scale: 0.62 },
            armor: { x: 0, y: -46, scale: 1.05 }
        },
        corpse: `
    <path d="M-7 10 L-18 46" stroke="#05060c" stroke-width="11" stroke-linecap="round"/>
    <path d="M-7 10 L-18 46" stroke="#5a4a34" stroke-width="8" stroke-linecap="round"/>
    <path d="M7 10 L15 28 L24 46" fill="none" stroke="#05060c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 10 L15 28 L24 46" fill="none" stroke="#4a3c2a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-20" cy="51" rx="5.5" ry="7" transform="rotate(20 -20 51)" fill="#241a10" stroke="#05060c" stroke-width="1.6"/>
    <ellipse cx="26" cy="49" rx="5.5" ry="7" transform="rotate(-24 26 49)" fill="#241a10" stroke="#05060c" stroke-width="1.6"/>
    <path d="M-13 -22 L-30 -40" stroke="#05060c" stroke-width="10" stroke-linecap="round"/>
    <path d="M-13 -22 L-30 -40" stroke="#4a3a24" stroke-width="7" stroke-linecap="round"/>
    <circle cx="-32" cy="-42" r="3.8" fill="#d9a07a" stroke="#05060c" stroke-width="1.3"/>
    <path d="M13 -20 L30 -14 L39 -4" fill="none" stroke="#05060c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13 -20 L30 -14 L39 -4" fill="none" stroke="#4a3a24" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="40.5" cy="-2.5" r="3.8" fill="#d9a07a" stroke="#05060c" stroke-width="1.3"/>
    <rect x="-15" y="-28" width="30" height="42" rx="8" fill="#6b5638" stroke="#05060c" stroke-width="2.4"/>
    <rect x="-11" y="-23" width="22" height="30" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-6" y="-9" width="12" height="9" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-11 -34 Q-16 -24 -10 -14 Q0 -18 10 -14 Q16 -24 11 -34 Q0 -40 -11 -34 Z" fill="#a23d14" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="0" cy="-42" r="11.5" fill="#c9a227" stroke="#05060c" stroke-width="2.4"/>
    <rect x="-13.5" y="-43" width="27" height="3.5" rx="1.8" fill="#b8901f" stroke="#05060c" stroke-width="1.5"/>
    <ellipse cx="-8" cy="-40" rx="5" ry="5.5" fill="#d9a07a" stroke="#05060c" stroke-width="1.3"/>
    <circle cx="-9.5" cy="-41" r="1.3" fill="#05060c"/>`,
        tint: { skin: '#d9a07a', hair: '#a23d14' }
    }
});
