// sprites/items-ranged.js - Sprites des armes à distance de items.js (baseItems.ranged). Clé = nom exact
// de l'objet. Repère (voir sprites/items-generic.js) : prise dans la main à l'origine, bouche/flèche vers
// la GAUCHE (x négatif, le mob), crosse vers la droite. `tip` : bouche de l'arme (enchantements, et
// départ des projectiles au chantier des effets).
Object.assign(ITEM_SPRITES, {
    'Lance-Pierre de Chantier': {
        kind: 'ranged', tip: [0, -11],
        art: `
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#05060c" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M0 2 v2 M0 -1 v1" stroke="#1f2937" stroke-width="2.4"/>
        <path d="M-7 -10 Q-12 -8 -14 -4 M7 -10 Q-4 -8 -14 -4" fill="none" stroke="#1f2937" stroke-width="1"/>
        <circle cx="-14" cy="-4" r="1.6" fill="#9ca3af" stroke="#05060c" stroke-width="0.6"/>`
    },
    'Arc de Fortune Rafistolé': {
        kind: 'ranged', tip: [-10, 0],
        art: `
        <path d="M2 -24 Q-12 0 2 24" fill="none" stroke="#05060c" stroke-width="4"/>
        <path d="M2 -24 Q-12 0 2 24" fill="none" stroke="#8a6a3a" stroke-width="2.4"/>
        <path d="M2 -24 L6 0 L2 24" fill="none" stroke="#d1d5db" stroke-width="0.7"/>
        <rect x="-8" y="-12" width="5" height="4" transform="rotate(-25 -5 -10)" fill="#9ca3af" opacity="0.9"/>
        <rect x="-4" y="-3" width="4" height="6" fill="#4a3a24"/>
        <path d="M6 0 H-20" stroke="#8a6a3a" stroke-width="1.3"/><path d="M-20 0 l4 -2 v4 Z" fill="#9ca3af" stroke="#05060c" stroke-width="0.5"/>
        <path d="M6 0 l3 -2.5 M6 0 l3 2.5" stroke="#f87171" stroke-width="1.2"/>`
    },
    'Arbalète de Musée': {
        kind: 'ranged', tip: [-22, -3],
        art: `
        <path d="M-20 -3 H10 L14 2 H6 L2 -1 H-20 Z" fill="#6b4a2a" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-16 -3 Q-20 -14 -12 -20 M-16 -3 Q-20 8 -12 12" fill="none" stroke="#05060c" stroke-width="3.2"/>
        <path d="M-16 -3 Q-20 -14 -12 -20 M-16 -3 Q-20 8 -12 12" fill="none" stroke="#9ca3af" stroke-width="1.6"/>
        <path d="M-12 -20 L0 -3 L-12 12" fill="none" stroke="#d1d5db" stroke-width="0.7"/>
        <path d="M4 -3 v6" stroke="#05060c" stroke-width="1"/><rect x="5" y="4" width="6" height="4" fill="#f5f0e0" stroke="#05060c" stroke-width="0.6"/>`
    },
    'Pistolet à Clous': {
        kind: 'ranged', tip: [-18, 0],
        art: `
        <path d="M-14 -4 H6 V4 H-2 L-4 12 H-9 L-7 4 H-14 Z" fill="#e0b43a" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="-18" y="-2" width="4" height="3" fill="#3a3e44" stroke="#05060c" stroke-width="0.8"/>
        <rect x="-2" y="-8" width="8" height="4" fill="#3a3e44" stroke="#05060c" stroke-width="0.8"/>
        <path d="M6 0 q6 2 4 8" fill="none" stroke="#1f2937" stroke-width="1.4"/>`
    },
    'Fusil de Chasse Rouillé': {
        kind: 'ranged', tip: [-30, -2],
        art: `
        <rect x="-30" y="-4" width="30" height="3.4" rx="1" fill="#5b6168" stroke="#05060c" stroke-width="1.1"/>
        <circle cx="-22" cy="-2.3" r="1.1" fill="#b45309" opacity="0.8"/><circle cx="-12" cy="-2" r="0.9" fill="#b45309" opacity="0.7"/>
        <path d="M0 -4 H6 L16 -1 L17 6 L6 3 L2 2 Z" fill="#6b4a2a" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M-2 -1 l-1 5" stroke="#05060c" stroke-width="1.4"/>`
    },
    'Sarbacane Improvisée': {
        kind: 'ranged', tip: [-26, -1],
        art: `
        <rect x="-26" y="-2.5" width="34" height="3.6" rx="1.8" fill="#b08850" stroke="#05060c" stroke-width="1"/>
        <path d="M-18 -2.5 v3.6 M-6 -2.5 v3.6 M4 -2.5 v3.6" stroke="#d1d5db" stroke-width="2" opacity="0.8"/>`
    },
    'Pistolet à Eau Surpuissant': {
        kind: 'ranged', tip: [-20, -1],
        art: `
        <path d="M-16 -4 H6 Q9 -4 9 0 V3 H-2 L-4 11 H-9 L-7 3 H-16 Z" fill="#f97316" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="-20" y="-2.5" width="5" height="3" rx="1" fill="#facc15" stroke="#05060c" stroke-width="0.8"/>
        <rect x="-8" y="-13" width="12" height="9" rx="3" fill="#38bdf8" stroke="#05060c" stroke-width="1.1" opacity="0.9"/>
        <path d="M-6 -10 h6" stroke="#e0f2fe" stroke-width="1" opacity="0.8"/>`
    },
    'Lance-Confettis Bricolé': {
        kind: 'ranged', tip: [-22, -2],
        art: `
        <path d="M-20 -7 L6 -4 V3 L-20 5 Z" fill="#a78bfa" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M-12 -6 L-12 4 M-4 -5 V4" stroke="#fde047" stroke-width="1.6"/>
        <rect x="0" y="3" width="4" height="7" fill="#4a3a24" stroke="#05060c" stroke-width="0.8"/>
        <rect x="-25" y="-6" width="2" height="2" fill="#f472b6" transform="rotate(20 -24 -5)"/><rect x="-24" y="1" width="2" height="2" fill="#4ade80"/><rect x="-27" y="-2" width="2" height="2" fill="#60a5fa"/>`
    }
});
