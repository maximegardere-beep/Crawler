// sprites/race-troll.js — Corps du Troll de bureau : grand et large (environ +20 %, frontExtent 19).
// Chantier 13, lot 4 (voir NOTES_ORIGINES.md et CHANTIERS.md). Mâchoire en avant avec défense, chemise
// trop serrée, cravate de travers, badge d'entreprise.
// Repère commun aux silhouettes : x = 0 au centre, y = 0 au sol, profil tourné vers la gauche ;
// chaque chaîne est le CONTENU d'un <g> SVG. Contours #05060c, pas d'id, defs, dégradé ni filtre.
// Couches : base -> torse -> bras de posture -> tête (+ poing avant du boxeur) ; armure par-dessus le torse.
Object.assign(CRAWLER_RACE_BODIES, {
    troll: {
        parts: {
            base: `
    <ellipse class="scene-ground-shadow" cx="3" cy="0" rx="21" ry="4"/>
    <rect x="-1" y="-40" width="10" height="36" rx="4" fill="#5a4a34" stroke="#05060c" stroke-width="2"/>
    <rect x="-12" y="-40" width="10" height="36" rx="4" fill="#4a3c2a" stroke="#05060c" stroke-width="2"/>
    <path d="M-16 -6 h12 v6 h-15 z" fill="#241a10" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-4 -6 h12 v6 h-15 z" fill="#241a10" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="10" y="-78" width="13" height="26" rx="4" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="13" y="-71" width="7" height="8" rx="1.5" fill="#3a6b5e" stroke="#05060c" stroke-width="1.2"/>`,
            torso: `
    <path d="M-14 -70 Q-16 -80 -5 -82 L7 -82 Q18 -80 15 -70 L13 -38 L-12 -38 Z" fill="#b9c0cc" stroke="#05060c" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-8 -79 L-5 -75 L-7.5 -70 L-10.5 -56 L-6.5 -50 L-3 -60 L-5 -73 Z" fill="#a03030" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="-6.5" cy="-61" r="0.9" fill="#0d0f14"/>
    <rect x="1" y="-72" width="5.5" height="4" rx="1" fill="#d4d0c4" stroke="#05060c" stroke-width="1"/>
    <circle cx="3.75" cy="-70" r="0.9" fill="#05060c"/>
    <path d="M-13 -52 h26" stroke="#8f97a6" stroke-width="1.4"/>
    <circle cx="-9" cy="-45" r="0.9" fill="#05060c"/>
    <circle cx="-9" cy="-41" r="0.9" fill="#05060c"/>`,
            head: `
    <rect x="-3.5" y="-84" width="7" height="7" fill="#8d9db3"/>
    <circle cx="0" cy="-92" r="11.5" fill="#8d9db3" stroke="#05060c" stroke-width="2.5"/>
    <path d="M-11 -93 Q0 -104 11 -93 L11 -90 Q0 -97 -11 -90 Z" fill="#2b3340" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-10 -90 Q-16 -88 -15 -84 Q-12 -81 -8 -83 Z" fill="#8d9db3" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M-12.5 -83.5 l-1 -2.5" stroke="#e8e4d8" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-8 -95.5 L-2 -95" stroke="#05060c" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="-5" cy="-93" r="1.4" fill="#05060c"/>
    <path d="M10 -95 L16 -97.5 L10.5 -90.5 Z" fill="#8d9db3" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>`
        },
        arms: {
            rest: { arm: `
    <rect x="-13" y="-66" width="8" height="26" rx="4" fill="#8d9db3" stroke="#05060c" stroke-width="2"/>
    <circle cx="-9" cy="-40" r="4" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>`, hand: [-9, -40] },
            weapon: { arm: `
    <path d="M-8 -70 L-11 -56 L-16 -52" fill="none" stroke="#05060c" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-8 -70 L-11 -56 L-16 -52" fill="none" stroke="#8d9db3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-19, -53], after: `
    <circle cx="-19" cy="-53" r="4" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>` },
            ranged: { arm: `
    <path d="M-8 -70 L-16 -64 L-21 -63" fill="none" stroke="#05060c" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-8 -70 L-16 -64 L-21 -63" fill="none" stroke="#8d9db3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-22, -63], after: `
    <circle cx="-22" cy="-63" r="4" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>` },
            rangedLowered: { arm: `
    <path d="M-8 -70 L-10 -56 L-13 -50" fill="none" stroke="#05060c" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-8 -70 L-10 -56 L-13 -50" fill="none" stroke="#8d9db3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-15, -49], after: `
    <circle cx="-15" cy="-49" r="4" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>` },
            magic: { arm: `
    <path d="M-8 -70 L-13 -75 L-18 -82" fill="none" stroke="#05060c" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-8 -70 L-13 -75 L-18 -82" fill="none" stroke="#8d9db3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-19, -83], after: `
    <path d="M-22 -86 l-1.5 -3 M-19.5 -87 l0 -3.5 M-17 -86 l1.5 -3" stroke="#05060c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-22 -86 l-1.5 -3 M-19.5 -87 l0 -3.5 M-17 -86 l1.5 -3" stroke="#8d9db3" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-19" cy="-83" r="4.6" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>` },
            boxer: { arm: `
    <path d="M-8 -70 L-12 -58 L-17 -72" fill="none" stroke="#05060c" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-8 -70 L-12 -58 L-17 -72" fill="none" stroke="#8d9db3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`, hand: [-18, -75], after: `
    <circle cx="-18" cy="-75" r="4.4" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>`, front: `
    <circle cx="-11" cy="-79" r="4.2" fill="#8d9db3" stroke="#05060c" stroke-width="1.2"/>` }
        },
        frontExtent: 19,
        anchors: {
            stowedRanged: { x: 16, y: -66, rot: 55, scale: 0.85 },
            stowedWeapon: { x: 7, y: -44, rot: 160, scale: 0.75 },
            armor: { x: 0.5, y: -60, scale: 1.25 }
        },
        corpse: `
    <path d="M-8 12 L-22 50" stroke="#05060c" stroke-width="12" stroke-linecap="round"/>
    <path d="M-8 12 L-22 50" stroke="#5a4a34" stroke-width="9" stroke-linecap="round"/>
    <path d="M8 12 L17 32 L27 50" fill="none" stroke="#05060c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 12 L17 32 L27 50" fill="none" stroke="#4a3c2a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-24" cy="55" rx="6.5" ry="8" transform="rotate(20 -24 55)" fill="#241a10" stroke="#05060c" stroke-width="1.8"/>
    <ellipse cx="29" cy="54" rx="6.5" ry="8" transform="rotate(-25 29 54)" fill="#241a10" stroke="#05060c" stroke-width="1.8"/>
    <path d="M-14 -24 L-32 -42" stroke="#05060c" stroke-width="11" stroke-linecap="round"/>
    <path d="M-14 -24 L-32 -42" stroke="#4a3a24" stroke-width="8" stroke-linecap="round"/>
    <circle cx="-34" cy="-45" r="4.4" fill="#8d9db3" stroke="#05060c" stroke-width="1.4"/>
    <path d="M14 -22 L32 -16 L41 -6" fill="none" stroke="#05060c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 -22 L32 -16 L41 -6" fill="none" stroke="#4a3a24" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="42.5" cy="-4" r="4.4" fill="#8d9db3" stroke="#05060c" stroke-width="1.4"/>
    <rect x="-18" y="-30" width="36" height="44" rx="10" fill="#b9c0cc" stroke="#05060c" stroke-width="2.5"/>
    <rect x="-13" y="-25" width="26" height="32" rx="5" fill="#4a3a24" stroke="#05060c" stroke-width="2"/>
    <rect x="-7" y="-10" width="14" height="9" rx="2" fill="#3a6b5e" stroke="#05060c" stroke-width="1.3"/>
    <path d="M-16 -22 L10 8" stroke="#a03030" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <rect x="4" y="-24" width="6" height="4.5" rx="1.2" fill="#d4d0c4" stroke="#05060c" stroke-width="1.2"/>
    <circle cx="7" cy="-21.7" r="1" fill="#05060c"/>
    <circle cx="0" cy="-42" r="12" fill="#2b3340" stroke="#05060c" stroke-width="2.5"/>
    <ellipse cx="-9" cy="-42" rx="6" ry="7" fill="#8d9db3" stroke="#05060c" stroke-width="1.4"/>
    <circle cx="-11" cy="-44" r="1.6" fill="#05060c"/>
    <path d="M-14 -38 q3 2 5 1" stroke="#05060c" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
        tint: { skin: '#8d9db3', hair: '#2b3340' }
    }
});
