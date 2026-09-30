// sprites/items-melee.js - Sprites des armes de mêlée de items.js (baseItems.weapons). Clé = nom exact de
// l'objet. Repère (voir sprites/items-generic.js) : prise dans la main à l'origine, tête/lame vers le haut
// (y négatif), manche jusqu'à y ≈ +8. `tip` : point où scintillent les enchantements (tête de l'arme).
Object.assign(ITEM_SPRITES, {
    'Pied-de-biche': {
        kind: 'melee', tip: [-4, -34],
        art: `
        <path d="M0 8 V-30 Q0 -38 -7 -37" fill="none" stroke="#05060c" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M0 8 V-30 Q0 -38 -7 -37" fill="none" stroke="#b33a2e" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M-7 -37 l-2 2" stroke="#6b7078" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M0 8 v-5" stroke="#6b7078" stroke-width="2.6"/>`
    },
    'Extincteur Cabossé': {
        kind: 'melee', tip: [0, -26],
        art: `
        <rect x="-5.5" y="-26" width="11" height="28" rx="4.5" fill="#c23b3b" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-5 -12 q3 2 0 6" fill="none" stroke="#7a1f1f" stroke-width="1.2"/>
        <rect x="-4" y="-18" width="8" height="6" rx="1" fill="#f5f0e0" opacity="0.85"/>
        <path d="M-2 -26 V-30 H4 L8 -28" fill="none" stroke="#05060c" stroke-width="1.6"/>
        <path d="M4 -29 q6 4 3 14" fill="none" stroke="#1f2937" stroke-width="1.6"/>`
    },
    'Agrafeuse Tactique': {
        kind: 'melee', tip: [-2, -26],
        art: `
        <rect x="-3" y="-24" width="7" height="30" rx="2" fill="#3a3e44" stroke="#05060c" stroke-width="1.3"/>
        <path d="M-6 -27 H1 V6 H-4 Q-6 6 -6 3 Z" fill="#4d5a3a" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-6 -12 H1 M-6 -8 H1" stroke="#2f3a24" stroke-width="1.6"/>
        <path d="M-5 -29 h4" stroke="#d1d5db" stroke-width="1.2"/>`
    },
    'Épée en Pain de Mie': {
        kind: 'melee', tip: [0, -34],
        art: `
        <path d="M-3.5 -4 V-32 Q0 -38 3.5 -32 V-4 Z" fill="#f1dfb0" stroke="#a0703a" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="-1" cy="-14" r="0.6" fill="#c9a36a"/><circle cx="1.2" cy="-22" r="0.6" fill="#c9a36a"/><circle cx="-0.6" cy="-27" r="0.5" fill="#c9a36a"/>
        <rect x="-8" y="-5" width="16" height="4.5" rx="2" fill="#d9b070" stroke="#8a5a2a" stroke-width="1.2"/>
        <rect x="-2" y="-1" width="4" height="9" rx="1.5" fill="#b07a3a" stroke="#05060c" stroke-width="1"/>`
    },
    'Hache à Viande': {
        kind: 'melee', tip: [-7, -20],
        art: `
        <rect x="-1.6" y="-4" width="3.2" height="12" rx="1" fill="#5a3d22" stroke="#05060c" stroke-width="1"/>
        <path d="M1.5 -4 V-26 H-14 Q-16 -15 -12 -4 Z" fill="#b8bec6" stroke="#05060c" stroke-width="1.3"/>
        <path d="M-12 -24 Q-15 -15 -11 -6" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.7"/>
        <circle cx="-2" cy="-22" r="1.3" fill="#05060c"/>`
    },
    'Bâton de Dynamite': {
        kind: 'melee', tip: [2, -30],
        art: `
        <rect x="-3.5" y="-22" width="7" height="30" rx="2" fill="#c23b3b" stroke="#05060c" stroke-width="1.3"/>
        <rect x="-3.5" y="-12" width="7" height="6" fill="#f5f0e0" opacity="0.9"/>
        <text x="0" y="-7.5" text-anchor="middle" font-size="4" font-weight="bold" fill="#7a1f1f">TNT</text>
        <path d="M0 -22 q0 -5 4 -7" fill="none" stroke="#1f2937" stroke-width="1.2"/>
        <g class="bd-blink"><path d="M4 -33 l1 -2.5 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 Z" fill="#fde047"/></g>`
    },
    'Couteau en Beurre': {
        kind: 'melee', tip: [0, -20],
        art: `
        <path d="M-2.2 -2 V-18 Q0 -22 2.2 -18 V-2 Z" fill="#d1d5db" stroke="#05060c" stroke-width="1.1"/>
        <path d="M-2.5 -12 q2 -3 5 -1 q0 3 -3 3 Z" fill="#fde68a" stroke="#b08a2a" stroke-width="0.6"/>
        <rect x="-2" y="-2" width="4" height="10" rx="1.6" fill="#9ca3af" stroke="#05060c" stroke-width="1"/>`
    },
    'Lance à Feu': {
        kind: 'melee', tip: [0, -38],
        art: `
        <rect x="-1.6" y="-30" width="3.2" height="38" rx="1" fill="#4a3a24" stroke="#05060c" stroke-width="1"/>
        <path d="M-3 -30 H3 L2 -35 H-2 Z" fill="#caa23a" stroke="#05060c" stroke-width="1"/>
        <g class="bd-flame"><path d="M0 -46 C4 -41 4 -37 0 -35 C-4 -37 -4 -41 0 -46 Z" fill="#f97316" stroke="#05060c" stroke-width="0.7"/>
        <path d="M0 -41 C1.8 -39 1.8 -37 0 -36 C-1.8 -37 -1.8 -39 0 -41 Z" fill="#fde047"/></g>`
    },
    'Gantelet Électrique': {
        kind: 'melee', tip: [-4, -6],
        art: `
        <path d="M-7 -6 Q-8 -12 -3 -12 H4 Q8 -12 7 -6 V4 H-6 Z" fill="#5b6470" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-6 -8 H6 M-6 -4 H6" stroke="#3a3f46" stroke-width="1"/>
        <rect x="-4" y="4" width="10" height="5" rx="1" fill="#3a3f46" stroke="#05060c" stroke-width="1"/>
        <path d="M-9 -10 l-3 2 l2 1 l-3 3" fill="none" stroke="#7dd3fc" stroke-width="1.2" class="bd-blink"/>`
    },
    'Antivol de Voiture': {
        kind: 'melee', tip: [-4, -34],
        art: `
        <rect x="-2" y="-30" width="4" height="38" rx="1.5" fill="#facc15" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-2 -30 H-8 V-24" fill="none" stroke="#05060c" stroke-width="4"/>
        <path d="M-2 -30 H-8 V-24" fill="none" stroke="#c23b3b" stroke-width="2.2"/>
        <rect x="-3" y="-4" width="6" height="6" rx="1" fill="#1f2937" stroke="#05060c" stroke-width="1"/>`
    },
    'Pied de Parasol': {
        kind: 'melee', tip: [0, -34],
        art: `
        <rect x="-1.5" y="-28" width="3" height="36" fill="#9ca3af" stroke="#05060c" stroke-width="1"/>
        <ellipse cx="0" cy="-31" rx="9" ry="4" fill="#8a8272" stroke="#05060c" stroke-width="1.3"/>
        <ellipse cx="0" cy="-32" rx="6" ry="1.8" fill="#a39b8a"/>`
    },

    // Chantier 10 « expansion de la banque d'objets » : Militaire / Arsenal, et deux objets blagues.
    "Masse d'Armes": {
        kind: 'melee', tip: [0, -25],
        art: `
        <rect x="-1.8" y="-19" width="3.6" height="27" rx="1.2" fill="#5a3d22" stroke="#05060c" stroke-width="1"/>
        <rect x="-2.4" y="2" width="4.8" height="3" fill="#2f2a24"/>
        <path d="M0 -36 l2 3.5 h-4 Z M0 -14 l2 -3.5 h-4 Z M-11 -25 l3.5 -2 v4 Z M11 -25 l-3.5 -2 v4 Z M-8 -33 l3.4 1 l-1.2 3.2 Z M8 -33 l-3.4 1 l1.2 3.2 Z M-8 -17 l3.4 -1 l-1.2 -3.2 Z M8 -17 l-3.4 -1 l1.2 -3.2 Z" fill="#c9ced6" stroke="#05060c" stroke-width="0.6"/>
        <circle cx="0" cy="-25" r="7" fill="#8b9098" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-4 -28 q2 -3 5 -3" stroke="#fff" stroke-width="0.9" fill="none" opacity="0.6"/>`
    },
    'Épée Longue': {
        kind: 'melee', tip: [0, -40],
        art: `
        <path d="M-2.4 -3 V-38 L0 -43 L2.4 -38 V-3 Z" fill="#cfd5dc" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M0 -40 V-5" stroke="#8b939c" stroke-width="0.8"/>
        <rect x="-9" y="-4.5" width="18" height="3.2" rx="1.2" fill="#a17a2a" stroke="#05060c" stroke-width="1"/>
        <rect x="-1.6" y="-1.3" width="3.2" height="8" rx="1" fill="#3a2a1a" stroke="#05060c" stroke-width="0.9"/>
        <circle cx="0" cy="7.5" r="2" fill="#a17a2a" stroke="#05060c" stroke-width="0.8"/>`
    },
    'Katana de Collection': {
        kind: 'melee', tip: [1, -38],
        art: `
        <path d="M-1.8 -4 Q-2.5 -24 1.5 -42 Q3 -24 2 -4 Z" fill="#e5e9ee" stroke="#05060c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M-0.6 -8 Q-1 -24 1.6 -38" fill="none" stroke="#9aa3ad" stroke-width="0.7"/>
        <ellipse cx="0" cy="-4" rx="4.5" ry="1.6" fill="#b08d2a" stroke="#05060c" stroke-width="0.9"/>
        <rect x="-1.7" y="-3" width="3.4" height="11" rx="1" fill="#1f1b2e" stroke="#05060c" stroke-width="0.9"/>
        <path d="M-1.7 -1 l3.4 2 M-1.7 3 l3.4 2" stroke="#e5e7eb" stroke-width="0.7"/>`
    },
    'Tronçonneuse': {
        kind: 'melee', tip: [0, -36],
        art: `
        <path d="M-3 -8 V-36 Q0 -41 3 -36 V-8 Z" fill="#9ca3af" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-3 -10 V-35 Q0 -40 3 -35 V-10" fill="none" stroke="#374151" stroke-width="1" stroke-dasharray="1.6 1.2"/>
        <rect x="-6" y="-9" width="12" height="13" rx="2.5" fill="#f97316" stroke="#05060c" stroke-width="1.3"/>
        <rect x="-3.5" y="-5.5" width="7" height="3" rx="1" fill="#1f2937"/>
        <path d="M-4 4 v4 h8 v-4" fill="none" stroke="#05060c" stroke-width="1.8"/>`
    },
    'Marteau de Guerre': {
        kind: 'melee', tip: [0, -31],
        art: `
        <rect x="-1.7" y="-27" width="3.4" height="35" rx="1" fill="#6b4a2a" stroke="#05060c" stroke-width="1"/>
        <rect x="-11" y="-37" width="22" height="10" rx="1.5" fill="#6b7280" stroke="#05060c" stroke-width="1.4"/>
        <rect x="-11" y="-37" width="22" height="3" fill="#9ca3af" opacity="0.8"/>
        <path d="M11 -35 l4 3 l-4 3 Z" fill="#6b7280" stroke="#05060c" stroke-width="1"/>
        <path d="M-2 4 h4 M-2 1 h4" stroke="#2f2a24" stroke-width="1.2"/>`
    },
    'Nouille de Piscine': {
        kind: 'melee', tip: [-6, -34],
        art: `
        <path d="M0 8 V-20 Q0 -34 -8 -36" fill="none" stroke="#05060c" stroke-width="7.2" stroke-linecap="round"/>
        <path d="M0 8 V-20 Q0 -34 -8 -36" fill="none" stroke="#f472b6" stroke-width="5.4" stroke-linecap="round"/>
        <path d="M-1 4 V-18" stroke="#fbcfe8" stroke-width="1" opacity="0.8"/>`
    },
    'Tapette à Mouches': {
        kind: 'melee', tip: [0, -26],
        art: `
        <path d="M0 8 V-18" stroke="#05060c" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M0 8 V-18" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="-7" y="-34" width="14" height="16" rx="2" fill="#22c55e" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-4 -34 V-18 M0 -34 V-18 M4 -34 V-18 M-7 -30 H7 M-7 -26 H7 M-7 -22 H7" stroke="#15803d" stroke-width="0.7"/>`
    }
});
