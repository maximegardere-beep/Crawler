// sprites/items-armor.js - Sprites des armures de items.js (baseItems.armors). Clé = nom exact de l'objet.
// Dessinées directement dans le repère du crawler (sprites/crawler.js : torse entre x -11..11 et
// y -69..-33, sac vers x 7..20), sans jamais couvrir la tête ni la main qui tient l'arme. `layer` : 'torso'
// (défaut, par-dessus le torse) ou 'back' (derrière le torse : dos, cape). `tip` : où scintillent les
// enchantements. `icon` : cadrage de l'icône d'inventaire (repère -24..24), écrit « scale(s) translate(-cx -cy) »
// pour recentrer le point (cx, cy) de l'armure.
Object.assign(ITEM_SPRITES, {
    'Couvercle de Poubelle': {
        kind: 'armor', layer: 'back', tip: [22, -58], icon: 'scale(1.25) translate(-21 52)',
        art: `
        <ellipse cx="21" cy="-52" rx="5" ry="15" fill="#8a9098" stroke="#05060c" stroke-width="1.6"/>
        <ellipse cx="21.5" cy="-52" rx="3" ry="10" fill="none" stroke="#5b6168" stroke-width="1"/>
        <rect x="22" y="-55" width="3" height="6" rx="1" fill="#5b6168"/>`
    },
    'Costume Trois-Pièces Déchiré': {
        kind: 'armor', tip: [-4, -58],
        art: `
        <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L10 -33 L-10 -33 Z" fill="#1e293b" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M-4 -69 L-9 -56 L-6 -52 L-10 -40 M-4 -69 L-1 -58" fill="none" stroke="#0f172a" stroke-width="1.4"/>
        <path d="M-5 -68 L-1 -58 L-8 -58 Z" fill="#f5f0e0"/>
        <path d="M-5 -60 l2 2 l-1 8 l-2 -2 Z" fill="#b91c1c"/>
        <path d="M6 -40 l3 4 l-2 3" fill="none" stroke="#475569" stroke-width="1.2"/>`
    },
    'Gilet Haute Visibilité': {
        kind: 'armor', tip: [0, -60],
        art: `
        <path d="M-10 -62 Q-8 -68 -3 -68 L-2 -60 L4 -60 L5 -68 Q10 -67 10 -60 L9 -38 L-9 -38 Z" fill="#d9f99d" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M-9 -50 H9 M-9 -44 H9" stroke="#9ca3af" stroke-width="2.2"/>
        <path d="M-9 -50 H9 M-9 -44 H9" stroke="#e5e7eb" stroke-width="0.8"/>`
    },
    'Armure de Carton': {
        kind: 'armor', tip: [-6, -60],
        art: `
        <rect x="-13" y="-66" width="26" height="30" rx="1" fill="#b08850" stroke="#05060c" stroke-width="1.8"/>
        <rect x="-13" y="-54" width="26" height="4" fill="#d6c08a" opacity="0.8"/>
        <text x="0" y="-40" text-anchor="middle" font-size="4.5" font-weight="bold" fill="#7a1f1f">FRAGILE</text>
        <path d="M-8 -62 v5 l-2 -2 M-8 -57 l2 -2" stroke="#05060c" stroke-width="0.8" fill="none"/>`
    },
    'Plastron de Coquillage': {
        kind: 'armor', tip: [-4, -56],
        art: `
        <path d="M-10 -44 Q-12 -58 -3 -60 Q3 -58 1 -44 Z" fill="#f9a8d4" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-9 -46 L-4 -58 M-6 -45 L-4 -58 M-3 -45 L-4 -58 M0 -45 L-3 -58" stroke="#db2777" stroke-width="0.8" opacity="0.8"/>
        <path d="M0 -44 Q-1 -57 6 -58 Q12 -56 10 -44 Z" fill="#fbcfe8" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-3 -62 Q2 -66 7 -60" fill="none" stroke="#a16207" stroke-width="1.2"/>`
    },
    'Rideau de Douche Camouflage': {
        kind: 'armor', layer: 'back', tip: [14, -44], icon: 'scale(0.9) translate(-7 42)',
        art: `
        <path d="M-6 -68 L14 -68 Q22 -48 20 -16 L2 -20 Q6 -44 -6 -68 Z" fill="#4d5a3a" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M2 -62 q4 -2 6 2 q-4 3 -6 -2 Z M10 -44 q5 -1 6 3 q-5 2 -6 -3 Z M6 -30 q4 0 5 3 q-4 2 -5 -3 Z" fill="#6b7a3a"/>
        <path d="M4 -56 q3 3 0 5 Z M14 -34 q3 2 1 4 Z" fill="#2f3a24"/>
        ${[-4, 1, 6, 11].map(x => `<circle cx="${x}" cy="-68" r="1.5" fill="none" stroke="#d1d5db" stroke-width="0.8"/>`).join('')}`
    },
    'Combinaison de Plongée': {
        kind: 'armor', tip: [-4, -58],
        art: `
        <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L10 -33 L-10 -33 Z" fill="#111827" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M-10 -52 L10 -44" stroke="#0ea5e9" stroke-width="2.4"/>
        <path d="M0 -68 V-36" stroke="#6b7280" stroke-width="1" stroke-dasharray="1.5 1"/>`
    },
    'Gilet Pare-Balles Périmé': {
        kind: 'armor', tip: [-5, -58],
        art: `
        <path d="M-10 -62 Q-9 -68 -3 -68 L6 -68 Q10 -67 10 -61 L9 -38 L-9 -38 Z" fill="#3f4a2f" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
        <rect x="-8" y="-50" width="6" height="7" rx="1" fill="#33402a" stroke="#05060c" stroke-width="0.9"/>
        <rect x="1" y="-50" width="6" height="7" rx="1" fill="#33402a" stroke="#05060c" stroke-width="0.9"/>
        <circle cx="-2" cy="-59" r="1.6" fill="#05060c"/><path d="M-4 -61 l4 4 M0 -61 l-4 4" stroke="#6b7280" stroke-width="0.5"/>`
    },
    'Bouclier en Polystyrène': {
        kind: 'armor', layer: 'back', tip: [22, -60], icon: 'scale(1.2) translate(-21 52)',
        art: `
        <rect x="16" y="-68" width="10" height="32" rx="2" fill="#f1f5f9" stroke="#05060c" stroke-width="1.5"/>
        <circle cx="19" cy="-60" r="0.8" fill="#cbd5e1"/><circle cx="23" cy="-50" r="0.8" fill="#cbd5e1"/><circle cx="20" cy="-43" r="0.8" fill="#cbd5e1"/>
        <path d="M26 -46 l2 1 l-1 2 l2 1" fill="none" stroke="#cbd5e1" stroke-width="0.8"/>`
    },
    'Manteau en Cuir de Skaï Renforcé': {
        kind: 'armor', tip: [-6, -56], icon: 'scale(0.8) translate(0 42)',
        art: `
        <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L13 -16 L-12 -16 Z" fill="#1f1d1f" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M-4 -69 L-8 -52 L-3 -48 L-4 -16" fill="none" stroke="#3f3a3f" stroke-width="1.3"/>
        ${[-62, -54, -46].map(y => `<circle cx="7" cy="${y}" r="0.9" fill="#9ca3af"/>`).join('')}
        <path d="M-12 -30 H13" stroke="#3f3a3f" stroke-width="2"/>`
    },
    'Bouée Canard Renforcée': {
        kind: 'armor', tip: [-17, -46], icon: 'scale(0.95) translate(4 40)',
        art: `
        <ellipse cx="0" cy="-38" rx="17" ry="5.5" fill="#facc15" stroke="#05060c" stroke-width="1.5"/>
        <ellipse cx="0" cy="-39.5" rx="11" ry="2" fill="#05060c" opacity="0.25"/>
        <circle cx="-17" cy="-45" r="4.5" fill="#facc15" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-21 -45 l-5 1 l5 2 Z" fill="#fb923c" stroke="#05060c" stroke-width="0.7"/>
        <circle cx="-18" cy="-46" r="0.9" fill="#05060c"/>`
    },
    'Gilet de Sécurité Chantier': {
        kind: 'armor', tip: [-4, -60],
        art: `
        <path d="M-10 -62 Q-8 -68 -3 -68 L-2 -60 L4 -60 L5 -68 Q10 -67 10 -60 L9 -38 L-9 -38 Z" fill="#ea580c" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M-9 -48 H9" stroke="#f5f5f4" stroke-width="2.4"/>
        <rect x="-8" y="-45" width="5" height="5" fill="#c2410c" stroke="#05060c" stroke-width="0.7"/>
        <path d="M5 -45 v5 M7 -45 v5" stroke="#6b7280" stroke-width="1.2"/>`
    },

    // Chantier 10 « expansion de la banque d'objets » : Militaire / Arsenal, et un objet blague.
    'Armure Anti-Émeute': {
        kind: 'armor', tip: [-4, -58],
        art: `
        <path d="M-12 -62 Q-11 -69 -3 -69 L4 -69 Q12 -69 12 -62 L11 -34 L-11 -34 Z" fill="#1f2937" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
        <rect x="-8" y="-63" width="7" height="10" rx="1.5" fill="#374151" stroke="#05060c" stroke-width="0.9"/>
        <rect x="1" y="-63" width="7" height="10" rx="1.5" fill="#374151" stroke="#05060c" stroke-width="0.9"/>
        <rect x="-8" y="-50" width="16" height="13" rx="2" fill="#374151" stroke="#05060c" stroke-width="0.9"/>
        <text x="0" y="-41" text-anchor="middle" font-size="4" font-weight="bold" fill="#fde047">POLICE</text>`
    },
    'Cotte de Mailles': {
        kind: 'armor', tip: [-3, -56],
        art: `
        <path d="M-12 -61 Q-11 -69 -3 -69 L4 -69 Q12 -69 12 -61 L12 -33 L-12 -33 Z" fill="#9ca3af" stroke="#05060c" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="-10" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-7" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-4" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-1" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="2" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="5" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="8" cy="-64" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-8.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-5.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-2.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="0.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="3.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="6.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="9.5" cy="-61" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-10" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-7" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-4" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-1" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="2" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="5" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="8" cy="-58" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-8.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-5.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-2.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="0.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="3.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="6.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="9.5" cy="-55" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-10" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-7" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-4" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-1" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="2" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="5" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="8" cy="-52" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-8.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-5.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-2.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="0.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="3.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="6.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="9.5" cy="-49" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-10" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-7" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-4" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-1" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="2" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="5" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="8" cy="-46" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-8.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-5.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-2.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="0.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="3.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="6.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="9.5" cy="-43" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-10" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-7" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-4" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-1" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="2" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="5" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="8" cy="-40" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-8.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-5.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="-2.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="0.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="3.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="6.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/><circle cx="9.5" cy="-37" r="1.4" fill="none" stroke="#4b5563" stroke-width="0.6"/>
        <path d="M-12 -35 H12" stroke="#4b5563" stroke-width="1.4"/>`
    },
    'Tenue de Démineur': {
        kind: 'armor', tip: [-6, -60],
        art: `
        <path d="M-14 -60 Q-13 -70 -4 -70 L4 -70 Q14 -70 14 -60 L13 -31 L-13 -31 Z" fill="#4d5a3a" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-7 -70 Q0 -66 7 -70" fill="none" stroke="#2f3a24" stroke-width="2.4"/>
        <rect x="-9" y="-62" width="18" height="22" rx="3" fill="#5f6e48" stroke="#05060c" stroke-width="1"/>
        <path d="M-9 -55 H9 M-9 -48 H9" stroke="#3a4630" stroke-width="1"/>
        <rect x="-4" y="-38" width="8" height="4" rx="1" fill="#fde047" stroke="#05060c" stroke-width="0.7"/>`
    },
    'Armure de Plates': {
        kind: 'armor', tip: [-4, -58],
        art: `
        <path d="M-12 -60 Q-11 -69 -3 -69 L4 -69 Q12 -69 12 -60 L11 -33 L-11 -33 Z" fill="#b8bec6" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-11 -58 Q0 -52 11 -58" fill="none" stroke="#6b7280" stroke-width="1.2"/>
        <path d="M0 -66 V-36" stroke="#6b7280" stroke-width="1"/>
        <path d="M-11 -46 H11 M-11 -40 H11" stroke="#6b7280" stroke-width="1"/>
        <path d="M-15 -66 Q-11 -71 -5 -68 L-6 -60 Q-12 -61 -15 -66 Z" fill="#cfd5dc" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-6 -64 q4 -2 8 0" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.7"/>`
    },
    'Poncho en Sac-Poubelle': {
        kind: 'armor', tip: [-2, -56],
        art: `
        <path d="M-13 -62 Q-6 -70 0 -69 Q6 -70 13 -62 L12 -36 Q0 -32 -12 -36 Z" fill="#111827" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M-8 -60 Q-6 -48 -8 -38 M5 -62 Q7 -50 5 -38" fill="none" stroke="#4b5563" stroke-width="0.9"/>
        <path d="M-3 -67 q3 -2 6 0" stroke="#fbbf24" stroke-width="1.2" fill="none"/>`
    }
});
