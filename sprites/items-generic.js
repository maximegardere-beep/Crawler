// sprites/items-generic.js - Registre des sprites d'équipement (ITEM_SPRITES) et dessins GÉNÉRIQUES de
// repli par catégorie, utilisés pour tout objet sans dessin propre (voir resolveItemSpriteKey() dans
// scene.js). Les dessins propres à chaque objet s'ajoutent au même registre depuis d'autres fichiers
// sprites/items-*.js (Object.assign), chargés APRÈS celui-ci.
//
// Format d'une entrée : { kind, art, tip?, layer?, icon? } —
//   kind 'melee'  : arme de mêlée, prise (main) à l'origine, tête/lame vers le haut (y négatif) ;
//   kind 'ranged' : arme à distance, prise à l'origine, bouche/flèche vers la GAUCHE (x négatif, le mob) ;
//   kind 'armor'  : armure dessinée directement dans le repère du crawler (surimpression du torse), sans
//                   jamais couvrir la tête ni la main qui tient l'arme.
// `tip` : point où scintillent les enchantements (tête de l'arme, bouche du tir, poitrine de l'armure) ;
// `layer` (armures) : 'torso' (défaut) ou 'back' (derrière le torse : dos, cape) ; `icon` : transformation
// de cadrage de l'icône d'inventaire (repère -24..24), sinon ITEM_ICON_TRANSFORMS selon le type.
// Même repère et mêmes contours (#05060c) que les silhouettes de sprites/crawler.js.
const ITEM_SPRITES = {
    // Tuyau de chantier avec manchon : l'arme de mêlée "par défaut".
    'generic:weapons': {
        kind: 'melee', tip: [0, -30],
        art: `
        <rect x="-2" y="-30" width="4" height="36" rx="1.5" fill="#6b7078" stroke="#05060c" stroke-width="1.3"/>
        <rect x="-3.2" y="-31" width="6.4" height="6" rx="1" fill="#8a9098" stroke="#05060c" stroke-width="1.1"/>
        <rect x="-2.6" y="-2" width="5.2" height="8" rx="1" fill="#3a2a1c" stroke="#05060c" stroke-width="1"/>`
    },
    // Lance-pierre : l'arme à distance "par défaut".
    'generic:ranged': {
        kind: 'ranged', tip: [0, -11],
        art: `
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#05060c" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#8a6a3a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-7 -10 Q-12 -8 -14 -4 M7 -10 Q-4 -8 -14 -4" fill="none" stroke="#b33a2e" stroke-width="1"/>`
    },
    // Plastron de fortune : plaques grises sur le torse.
    'generic:armors': {
        kind: 'armor', tip: [-4, -56],
        art: `
        <path d="M-10 -58 Q-11 -64 -4 -66 L5 -66 Q10 -64 10 -57 L9 -38 L-9 -38 Z" fill="#5b6470" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-9 -52 H9 M-9 -45 H9" stroke="#3a3f46" stroke-width="1.4"/>
        <circle cx="-5" cy="-60" r="1" fill="#8a9098"/><circle cx="5" cy="-60" r="1" fill="#8a9098"/>`
    }
};

// Cadrage par défaut de l'icône d'inventaire (repère -24..24) selon le type : l'arme de mêlée posée en
// diagonale, l'arme à distance centrée, l'armure recentrée depuis le torse du crawler.
const ITEM_ICON_TRANSFORMS = {
    melee: 'rotate(40) translate(0 13)',
    ranged: 'translate(8 0)',
    armor: 'translate(0 50)'
};

// Couleur des enchantements visibles (étincelles sur l'arme, reflets sur l'armure, pastilles de l'icône),
// par qualificatif (items.js, itemQualifiers — un par clé, exigé par tests/regression/loot.js).
// Mécanique inconnue : blanc cassé.
const ENCHANT_COLORS = {
    bleed: '#ef4444', stun: '#60a5fa', pleasure_or_pain: '#f472b6', poison: '#84cc16', slow: '#7dd3fc',
    random: '#e879f9', aoe: '#fb923c', stealth: '#94a3b8', light: '#fef08a', darkness: '#6d28d9',
    heal: '#4ade80', lifesteal: '#be123c', drain: '#a78bfa', corrode: '#bef264', fear: '#9333ea',
    adrenaline: '#facc15', shock: '#38bdf8', keen: '#e2e8f0', precise: '#f97316', pierce: '#cbd5e1',
    swift: '#2dd4bf', lucky: '#22c55e', thorns: '#65a30d', sturdy: '#b45309', tenacious: '#0ea5e9',
    amplified: '#d946ef', thrifty: '#3b82f6', channeled: '#a5b4fc',
    rusty: '#92400e', cracked: '#78716c', wobbly: '#a3a3a3', squeaky: '#d6d3d1', stutter: '#737373',
    // Objets démoniaques (chantier 17) : effets en feu/braise, malédictions en pourpre sombre.
    demon_lifesteal: '#f97316', demon_last_breath: '#fb7185', demon_souls: '#a3e635', demon_decree: '#fbbf24',
    curse_potions: '#86198f', curse_no_regen: '#701a75', curse_soul_hunger: '#581c87', curse_blood_price: '#9f1239'
};
const ENCHANT_DEFAULT_COLOR = '#f5f0e0';

// Fioles des consommables (icône de la barre de raccourci, de l'inventaire et de la boutique, voir
// consumableFlaskKind()/itemIconSvg() dans scene.js) : la couleur du liquide dit ce que l'objet rend —
// rouge = PV, bleu = mana, moitié-moitié = les deux. `border` : bordure du bouton qui porte l'icône.
const CONSUMABLE_FLASKS = {
    heal: { liquid: '#dc2626', dark: '#7f1d1d', shine: '#fca5a5', border: '#b91c1c' },
    mana: { liquid: '#2563eb', dark: '#1e3a8a', shine: '#93c5fd', border: '#1d4ed8' },
    mixed: { border: '#7e22ce' }
};
// Repère -24..24 : panse ronde centrée en (0, 8), rayon 13, col étroit et bouchon de liège ; liquide sous
// la ligne y = 0 (arc de la panse, rayon 11, qui coupe cette ligne en x = ±7.55).
const CONSUMABLE_FLASK_LIQUID = {
    full: 'M -7.55 0 A 11 11 0 1 0 7.55 0 Z',
    left: 'M 0 0 L -7.55 0 A 11 11 0 0 0 0 19 Z',
    right: 'M 0 0 L 0 19 A 11 11 0 0 0 7.55 0 Z'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ITEM_SPRITES, ITEM_ICON_TRANSFORMS, ENCHANT_COLORS, ENCHANT_DEFAULT_COLOR, CONSUMABLE_FLASKS, CONSUMABLE_FLASK_LIQUID };
}
