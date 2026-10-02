// sprites/race-ghoul.js — Corps de la Goule : décharnée, légèrement voûtée (frontExtent 14).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Joues creuses, yeux cernés, haillons du
// crawler déchirés (ourlet effiloché, pièce sur l'épaule).
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    ghoul: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="2" cy="0" rx="15" ry="3.5"/>
    <rect x="-2" y="-30" width="6" height="26" rx="2.5" fill="#5a4a34" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-9" y="-30" width="6" height="26" rx="2.5" fill="#4a3c2a" stroke="#05060c" stroke-width="1.8"/>
    <path d="M-12 -4 h9 v4 h-11 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-4 -4 h9 v4 h-11 z" fill="#241a10" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="7" y="-62" width="11" height="23" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="9.5" y="-56" width="6" height="7" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
            torso: `
    <path d="M-10 -56 Q-13 -64 -5 -67 L5 -68 Q11 -66 9 -58 L8 -35 L6 -31 L3 -34 L0 -31 L-3 -33 L-6 -31 L-8 -34 Z" fill="#6b5638" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-6 -50 Q-1 -48 4 -50 M-6 -45 Q-1 -43 4 -45" stroke="#7d6a4a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M-5 -67 L-2 -60 L1 -66 Z" fill="#4a3a24" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>`,
            head: `
    <rect x="-3" y="-73" width="5" height="7" fill="#93a58c"/>
    <circle cx="0.5" cy="-79" r="10" fill="#3b4237" stroke="#05060c" stroke-width="2.2"/>
    <path d="M-8 -86 l-3 -2 M8 -83 l3 -1" stroke="#05060c" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-2.5" cy="-78" r="6.5" fill="#93a58c"/>
    <circle cx="-5" cy="-80" r="1.3" fill="#05060c"/>
    <circle cx="-5" cy="-80" r="2.6" fill="none" stroke="#5f6f5a" stroke-width="1"/>
    <path d="M-7 -74.5 q2 1.6 3.5 0.8" stroke="#6f8268" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-11.5" y="-58" width="5.5" height="20" rx="3" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <circle cx="-9" cy="-38" r="2.6" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>`, hand: [-9, -38] },
            weapon: { arm: `
    <path d="M-7 -60 L-9 -48 L-13 -45" fill="none" stroke="#05060c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -60 L-9 -48 L-13 -45" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-14, -45], after: `
    <circle cx="-14" cy="-45" r="2.6" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-7 -60 L-14 -55 L-18 -54" fill="none" stroke="#05060c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -60 L-14 -55 L-18 -54" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-19, -54], after: `
    <circle cx="-19" cy="-54" r="2.6" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-7 -60 L-9 -48 L-11 -42" fill="none" stroke="#05060c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -60 L-9 -48 L-11 -42" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-12, -41], after: `
    <circle cx="-12" cy="-41" r="2.6" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-7 -60 L-12 -64 L-16 -70" fill="none" stroke="#05060c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -60 L-12 -64 L-16 -70" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-17, -71], after: `
    <path d="M-20 -74 l-1.5 -3 M-17.5 -75 l0 -3.5 M-15 -74 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-20 -74 l-1.5 -3 M-17.5 -75 l0 -3.5 M-15 -74 l1.5 -3" stroke="#93a58c" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-17" cy="-71" r="3" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-7 -60 L-10 -50 L-14 -62" fill="none" stroke="#05060c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-7 -60 L-10 -50 L-14 -62" fill="none" stroke="#4a3a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-15, -64], after: `
    <circle cx="-15" cy="-64" r="3.2" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-10" cy="-69" r="3" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 14,
        anchors: {
            stowedRanged: { x: 12, y: -52, rot: 55, scale: 0.75 },
            stowedWeapon: { x: 4, y: -33, rot: 160, scale: 0.65 }
        },
        corpse: `
    <path d="M-6 10 L-17 44" stroke="#05060c" stroke-width="9" stroke-linecap="round"/>
    <path d="M-6 10 L-17 44" stroke="#5a4a34" stroke-width="6" stroke-linecap="round"/>
    <path d="M6 10 L14 28 L23 44" fill="none" stroke="#05060c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 10 L14 28 L23 44" fill="none" stroke="#4a3c2a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-18" cy="49" rx="4.5" ry="6" transform="rotate(18 -18 49)" fill="#241a10" stroke="#05060c" stroke-width="1.5"/>
    <ellipse cx="25" cy="47" rx="4.5" ry="6" transform="rotate(-22 25 47)" fill="#241a10" stroke="#05060c" stroke-width="1.5"/>
    <path d="M-11 -22 L-27 -36" stroke="#05060c" stroke-width="8.5" stroke-linecap="round"/>
    <path d="M-11 -22 L-27 -36" stroke="#4a3a24" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="-29" cy="-38" r="3" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>
    <path d="M11 -20 L27 -14 L36 -4" fill="none" stroke="#05060c" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 -20 L27 -14 L36 -4" fill="none" stroke="#4a3a24" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="38" cy="-2" r="3" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>
    <rect x="-12" y="-27" width="24" height="38" rx="7" fill="#6b5638" stroke="#05060c" stroke-width="2.2"/>
    <rect x="-8" y="-22" width="16" height="26" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="1.8"/>
    <rect x="-4" y="-8" width="8" height="7" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>
    <path d="M6 -12 l3 3 M-9 -6 l-2.5 -2.5" stroke="#05060c" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="0" cy="-41" r="9.5" fill="#3b4237" stroke="#05060c" stroke-width="2.2"/>
    <ellipse cx="-7" cy="-41" rx="4.5" ry="5.5" fill="#93a58c" stroke="#05060c" stroke-width="1.2"/>
    <circle cx="-8.5" cy="-43" r="1.4" fill="#05060c"/>
    <circle cx="-5" cy="-39" r="1.4" fill="#05060c"/>
    <path d="M-9.5 -37.5 q2 1.5 3.5 0.5" stroke="#6f8268" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
        tint: { skin: '#93a58c', hair: '#3b4237' }
    }
});
