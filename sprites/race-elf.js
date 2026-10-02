// sprites/race-elf.js — Corps de l'Elfe de salon : élancé, droit (frontExtent 14).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Longues oreilles pointues, longue
// chevelure, veste élégante ouverte sur le gilet, pantoufles à bout retroussé.
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    elf: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="15" ry="3.5"/>
    <rect x="-1" y="-34" width="5.5" height="30" rx="2.5" fill="#5a4a34" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-7" y="-34" width="5.5" height="30" rx="2.5" fill="#4a3c2a" stroke="#05060c" stroke-width="1.8"/>
    <path d="M-12.5 -5 Q-16 -7 -15.5 -4 Q-15 -1.5 -11 -1.5 L-6 -1.5 L-6 -5 Z" fill="#7a4a3c" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-6 -5 Q-9.5 -7 -9 -4 Q-8.5 -1.5 -4.5 -1.5 L0.5 -1.5 L0.5 -5 Z" fill="#7a4a3c" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="7" y="-66" width="10" height="24" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="9" y="-60" width="6" height="7" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
            torso: `
    <path d="M-9 -62 Q-10 -68 -3 -70 L4 -70 Q10 -68 9 -61 L8 -33 L-8 -33 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-3 -70 L-6 -38 L-2 -34 L1 -68 Z" fill="#57636e" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-2 -66 L1 -60" stroke="#47505a" stroke-width="1.2"/>
    <path d="M-7.5 -40 h15" stroke="#3a2a18" stroke-width="3"/>`,
            head: `
    <rect x="-3" y="-77" width="5" height="8" fill="#ecd3b8"/>
    <circle cx="0" cy="-83" r="9.5" fill="#d6c27a" stroke="#05060c" stroke-width="2.2"/>
    <path d="M6 -78 Q12 -70 10 -56" stroke="#d6c27a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="-2.5" cy="-82" r="6.5" fill="#ecd3b8"/>
    <path d="M4 -84 L13 -88.5 L6 -80 Z" fill="#ecd3b8" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="-5" cy="-84" r="1.2" fill="#05060c"/>
    <path d="M-8.5 -81.5 q1.5 1 2.5 0.5" stroke="#05060c" stroke-width="1.1" fill="none" stroke-linecap="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-11" y="-63" width="6" height="21" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <circle cx="-8" cy="-42" r="2.7" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>`, hand: [-8, -42] },
            weapon: { arm: `
    <path d="M-7 -64 L-9 -53 L-13 -50" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -64 L-9 -53 L-13 -50" fill="none" stroke="#4a3a24" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-14, -51], after: `
    <circle cx="-14" cy="-51" r="2.7" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-7 -64 L-14 -60 L-18 -59" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -64 L-14 -60 L-18 -59" fill="none" stroke="#4a3a24" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-19, -60], after: `
    <circle cx="-19" cy="-60" r="2.7" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-7 -64 L-9 -53 L-11 -47" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -64 L-9 -53 L-11 -47" fill="none" stroke="#4a3a24" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -46], after: `
    <circle cx="-12" cy="-46" r="2.7" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-7 -64 L-12 -68 L-16 -74" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -64 L-12 -68 L-16 -74" fill="none" stroke="#4a3a24" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-17, -75], after: `
    <path d="M-20 -78 l-1.5 -3 M-17.5 -79 l0 -3.5 M-15 -78 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-20 -78 l-1.5 -3 M-17.5 -79 l0 -3.5 M-15 -78 l1.5 -3" stroke="#ecd3b8" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-17" cy="-75" r="3" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-7 -64 L-10 -55 L-13 -66" fill="none" stroke="#05060c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -64 L-10 -55 L-13 -66" fill="none" stroke="#4a3a24" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-14, -68], after: `
    <circle cx="-14" cy="-68" r="3.1" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-9" cy="-73" r="3" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 14,
        anchors: {
            stowedRanged: { x: 14, y: -54, rot: 55, scale: 0.8 },
            stowedWeapon: { x: 5, y: -36, rot: 160, scale: 0.7 }
        },
        corpse: `
    <path d="M-6 9 L-17 46" stroke="#05060c" stroke-width="9" stroke-linecap="round"/>
    <path d="M-6 9 L-17 46" stroke="#5a4a34" stroke-width="6" stroke-linecap="round"/>
    <path d="M6 9 L14 27 L23 46" fill="none" stroke="#05060c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 9 L14 27 L23 46" fill="none" stroke="#4a3c2a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-18" cy="51" rx="4.8" ry="6.5" transform="rotate(18 -18 51)" fill="#7a4a3c" stroke="#05060c" stroke-width="1.5"/>
    <ellipse cx="25" cy="49" rx="4.8" ry="6.5" transform="rotate(-24 25 49)" fill="#7a4a3c" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-11 -22 L-28 -40" stroke="#05060c" stroke-width="9" stroke-linecap="round"/>
    <path d="M-11 -22 L-28 -40" stroke="#4a3a24" stroke-width="6" stroke-linecap="round"/>
    <circle cx="-30" cy="-42" r="3.4" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>
    <path d="M11 -20 L28 -14 L37 -4" fill="none" stroke="#05060c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 -20 L28 -14 L37 -4" fill="none" stroke="#4a3a24" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="38.5" cy="-2.5" r="3.4" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>
    <rect x="-13" y="-28" width="26" height="40" rx="7" fill="#6b5638" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-9 -24 L10 6 L3 8 L-8 -20 Z" fill="#57636e" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="-9" y="-22" width="18" height="28" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-5" y="-9" width="10" height="8" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>
    <circle cx="0" cy="-42" r="10" fill="#d6c27a" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-6 -50 Q-12 -56 -16 -52 M8 -48 Q15 -52 16 -46" stroke="#d6c27a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M-11 -38 L-20 -33 L-13 -44 Z" fill="#ecd3b8" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M11 -38 L20 -33 L13 -44 Z" fill="#ecd3b8" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="-8" cy="-42" rx="4.5" ry="5.5" fill="#ecd3b8" stroke="#05060c" stroke-width="1.2"/>
    <circle cx="-9.5" cy="-43.5" r="1.2" fill="#05060c"/>`,
        tint: { skin: '#ecd3b8', hair: '#d6c27a' }
    }
});
