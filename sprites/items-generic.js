// sprites/items-generic.js - Registre des sprites d'équipement (ITEM_SPRITES) et dessins GÉNÉRIQUES de
// repli par catégorie, utilisés pour tout objet sans dessin propre (voir resolveItemSpriteKey() dans
// scene.js). Les dessins propres à chaque objet s'ajoutent au même registre depuis d'autres fichiers
// sprites/items-*.js (Object.assign), chargés APRÈS celui-ci.
//
// Format d'une entrée : { kind, art } —
//   kind 'melee'  : arme de mêlée, prise (main) à l'origine, tête/lame vers le haut (y négatif) ;
//   kind 'ranged' : arme à distance, prise à l'origine, bouche/flèche vers la GAUCHE (x négatif, le mob) ;
//   kind 'armor'  : armure dessinée directement dans le repère du crawler (surimpression du torse), sans
//                   jamais couvrir la tête ni la main qui tient l'arme.
// Même repère et mêmes contours (#05060c) que les silhouettes de sprites/crawler.js.
const ITEM_SPRITES = {
    // Tuyau de chantier avec manchon : l'arme de mêlée "par défaut".
    'generic:weapons': {
        kind: 'melee',
        art: `
        <rect x="-2" y="-30" width="4" height="36" rx="1.5" fill="#6b7078" stroke="#05060c" stroke-width="1.3"/>
        <rect x="-3.2" y="-31" width="6.4" height="6" rx="1" fill="#8a9098" stroke="#05060c" stroke-width="1.1"/>
        <rect x="-2.6" y="-2" width="5.2" height="8" rx="1" fill="#3a2a1c" stroke="#05060c" stroke-width="1"/>`
    },
    // Lance-pierre : l'arme à distance "par défaut".
    'generic:ranged': {
        kind: 'ranged',
        art: `
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#05060c" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M0 6 V-2 M0 -2 L-7 -10 M0 -2 L7 -10" fill="none" stroke="#8a6a3a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-7 -10 Q-12 -8 -14 -4 M7 -10 Q-4 -8 -14 -4" fill="none" stroke="#b33a2e" stroke-width="1"/>`
    },
    // Plastron de fortune : plaques grises sur le torse.
    'generic:armors': {
        kind: 'armor',
        art: `
        <path d="M-10 -58 Q-11 -64 -4 -66 L5 -66 Q10 -64 10 -57 L9 -38 L-9 -38 Z" fill="#5b6470" stroke="#05060c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-9 -52 H9 M-9 -45 H9" stroke="#3a3f46" stroke-width="1.4"/>
        <circle cx="-5" cy="-60" r="1" fill="#8a9098"/><circle cx="5" cy="-60" r="1" fill="#8a9098"/>`
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ITEM_SPRITES };
}
