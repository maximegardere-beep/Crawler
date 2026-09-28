// sprites/items-signature.js - Sprites des objets signature des boss (bestiary.js,
// districtBosses.*.signatureItem, légendaires et uniques). Clé = nom exact de l'objet ; mêmes repères que
// items-melee.js / items-ranged.js / items-armor.js selon leur catégorie.
Object.assign(ITEM_SPRITES, {
    'Sifflet du Chef de Gare Nécrosé': {
        kind: 'melee', tip: [-6, -30],
        art: `
        <rect x="-1.5" y="-18" width="3" height="26" fill="#1e3350" stroke="#05060c" stroke-width="1"/>
        <path d="M-9 -30 H4 Q9 -30 9 -24 Q9 -18 3 -18 H-2 Z" fill="#caa23a" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <circle cx="3" cy="-24" r="2" fill="#05060c"/><path d="M-9 -30 v4" stroke="#05060c" stroke-width="1"/>
        <path d="M0 -18 q4 6 1 12" fill="none" stroke="#9ca3af" stroke-width="0.8" stroke-dasharray="1 1"/>`
    },
    'Tronçon de Liane Toxique': {
        kind: 'melee', tip: [-3, -36],
        art: `
        <path d="M0 8 Q-3 -8 2 -18 Q6 -28 -3 -36" fill="none" stroke="#05060c" stroke-width="5" stroke-linecap="round"/>
        <path d="M0 8 Q-3 -8 2 -18 Q6 -28 -3 -36" fill="none" stroke="#4d7c0f" stroke-width="3" stroke-linecap="round"/>
        <path d="M-1 -4 l-4 -2 M3 -15 l4 -2 M3 -26 l4 1 M-2 -32 l-4 -1" stroke="#a3e635" stroke-width="1.2"/>
        <circle cx="-3" cy="-39" r="1.4" fill="#a3e635" class="bd-blink"/>`
    },
    'Couperet du Boucher Sans Visage': {
        kind: 'melee', tip: [-9, -24],
        art: `
        <rect x="-1.8" y="-4" width="3.6" height="12" rx="1" fill="#3a2a1c" stroke="#05060c" stroke-width="1"/>
        <path d="M2 -4 V-32 H-18 Q-20 -18 -15 -4 Z" fill="#8a9098" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-17 -28 Q-19 -18 -14 -8" fill="none" stroke="#7f1d1d" stroke-width="2.4" opacity="0.8"/>
        <circle cx="-3" cy="-27" r="1.6" fill="#05060c"/>`
    },
    'Seringue Géante du Professeur Démentiel': {
        kind: 'melee', tip: [0, -40],
        art: `
        <rect x="-4" y="-28" width="8" height="24" rx="1.5" fill="#e0f2fe" stroke="#05060c" stroke-width="1.2" opacity="0.95"/>
        <rect x="-3" y="-20" width="6" height="15" fill="#4ade80" opacity="0.85"/>
        <path d="M-6 -4 H6 M0 -4 V8 M-4 8 H4" stroke="#05060c" stroke-width="1.6"/>
        <path d="M0 -28 V-40" stroke="#9ca3af" stroke-width="1.2"/><circle cx="0" cy="-41" r="0.8" fill="#4ade80" class="bd-blink"/>`
    },
    'Canne-Épée du Baron des Ombres': {
        kind: 'melee', tip: [0, -36],
        art: `
        <path d="M0 -8 V-36" stroke="#d1d5db" stroke-width="2"/>
        <rect x="-1.8" y="-8" width="3.6" height="16" rx="1.5" fill="#111827" stroke="#05060c" stroke-width="1"/>
        <circle cx="0" cy="-8" r="2.6" fill="#9ca3af" stroke="#05060c" stroke-width="1"/>
        <path d="M0 -36 l-1 3 h2 Z" fill="#d1d5db"/>`
    },
    'Barre de Péage Maudite': {
        kind: 'melee', tip: [0, -36],
        art: `
        <rect x="-2.5" y="-36" width="5" height="44" rx="1" fill="#f5f5f4" stroke="#05060c" stroke-width="1.2"/>
        ${[-32, -22, -12, -2].map(y => `<rect x="-2.5" y="${y}" width="5" height="5" fill="#c23b3b"/>`).join('')}
        <circle cx="0" cy="-38" r="1.8" fill="#dc2626" class="bd-blink"/>`
    },
    'Dents du Grand Requin Gonflable': {
        kind: 'melee', tip: [-6, -28],
        art: `
        <rect x="-1.5" y="-12" width="3" height="20" fill="#6b7280" stroke="#05060c" stroke-width="1"/>
        <path d="M-12 -22 Q0 -36 12 -22 Q0 -10 -12 -22 Z" fill="#60a5fa" stroke="#05060c" stroke-width="1.4"/>
        <path d="M-8 -22 l2 -3 l2 3 l2 -3 l2 3 l2 -3 l2 3" fill="#f5f5f4" stroke="#05060c" stroke-width="0.6"/>
        <circle cx="6" cy="-27" r="1" fill="#05060c"/>`
    },
    'Micro Électrifié de l\'Animateur Vedette': {
        kind: 'melee', tip: [0, -30],
        art: `
        <path d="M-2 -18 L-1.5 6 H1.5 L2 -18 Z" fill="#1f2937" stroke="#05060c" stroke-width="1"/>
        <circle cx="0" cy="-23" r="6" fill="#9ca3af" stroke="#05060c" stroke-width="1.3"/>
        <path d="M-4 -25 h8 M-5 -22 h10 M-4 -19 h8" stroke="#6b7280" stroke-width="0.8"/>
        <path d="M-7 -30 l-3 -2 l1 3 l-3 -1" fill="none" stroke="#fde047" stroke-width="1.1" class="bd-blink"/>
        <path d="M0 6 q4 6 -2 10" fill="none" stroke="#111827" stroke-width="1.2"/>`
    },
    'Tampon Encreur du Directeur': {
        kind: 'ranged', tip: [-20, 0],
        art: `
        <rect x="-4" y="-3" width="12" height="6" rx="3" fill="#6b4a2a" stroke="#05060c" stroke-width="1.1"/>
        <rect x="-10" y="-5" width="6" height="10" fill="#4a3a24" stroke="#05060c" stroke-width="1"/>
        <rect x="-18" y="-8" width="8" height="16" rx="1" fill="#1f2937" stroke="#05060c" stroke-width="1.2"/>
        <rect x="-20" y="-7" width="2.4" height="14" fill="#b91c1c"/>`
    },
    'Canon à Impulsions de l\'IA Malveillante': {
        kind: 'ranged', tip: [-28, -1],
        art: `
        <path d="M-24 -5 H6 Q10 -5 10 -1 V4 H-24 Z" fill="#e5e7eb" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="-28" y="-3.5" width="5" height="6" rx="1" fill="#6b7280" stroke="#05060c" stroke-width="0.8"/>
        <circle cx="-8" cy="-0.5" r="2.6" fill="#dc2626" stroke="#05060c" stroke-width="0.8" class="bd-blink"/>
        <path d="M-20 -5 V4 M-14 -5 V4" stroke="#9ca3af" stroke-width="0.8"/>
        <rect x="-2" y="4" width="4" height="7" fill="#9ca3af" stroke="#05060c" stroke-width="0.8"/>`
    },
    'Reliure du Gardien des Mots Perdus': {
        kind: 'armor', tip: [-6, -58],
        art: `
        <rect x="-11" y="-66" width="21" height="30" rx="1.5" fill="#5b2d1a" stroke="#05060c" stroke-width="1.8"/>
        <rect x="-8" y="-62" width="15" height="22" fill="none" stroke="#caa23a" stroke-width="1"/>
        <path d="M-5 -55 h9 M-5 -51 h7 M-5 -47 h9" stroke="#caa23a" stroke-width="0.8" opacity="0.8"/>
        <circle cx="-0.5" cy="-58" r="1.6" fill="#caa23a"/>`
    },
    'Cape en Lambeaux du Maître des Illusions': {
        kind: 'armor', layer: 'back', tip: [16, -40], icon: 'scale(0.85) translate(-10 41)',
        art: `
        <path d="M-4 -68 L10 -68 Q24 -46 24 -14 L20 -18 L17 -12 L13 -18 L9 -12 L5 -18 Q8 -46 -4 -68 Z" fill="#5b21b6" stroke="#05060c" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M6 -60 Q14 -44 14 -24" fill="none" stroke="#7c3aed" stroke-width="1.2"/>
        <circle cx="12" cy="-50" r="1" fill="#e9d5ff" class="bd-blink"/>`
    },
    'Chaussette Royale Dépareillée': {
        kind: 'armor', tip: [-6, -56],
        art: `
        <path d="M-9 -66 L8 -40 L12 -44 L4 -58 L-2 -68 Z" fill="#7c3aed" stroke="#05060c" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M-6 -62 L7 -46 M-3 -64 L9 -48" stroke="#facc15" stroke-width="1.2"/>
        <path d="M8 -40 Q14 -34 10 -32 Q5 -32 6 -38 Z" fill="#7c3aed" stroke="#05060c" stroke-width="1.2"/>
        <path d="M-4 -70 l2 -3 l1 2 l2 -3 l1 3 l2 -2 l0 3 Z" fill="#facc15" stroke="#05060c" stroke-width="0.6"/>`
    }
});
