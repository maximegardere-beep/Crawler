// sprites/items-demonic.js - Sprites des objets démoniaques de l'armurerie de Gorgoth le Concierge
// (chantier 17, lot 5). Clé = nom exact de l'objet ; mêmes repères que items-melee.js / items-ranged.js /
// items-armor.js selon leur catégorie (voir sprites/items-generic.js). Palette commune : obsidienne
// (#1c1917, #292524), pourpre (#581c87, #7e22ce, #a855f7) et braises (#b91c1c, #ea580c, #f97316, #fbbf24).
// Le sort « Règlement Intérieur » n'a pas de sprite d'équipement (un sort n'en a jamais) : son effet vit
// dans sprites/fx.js (FX_SPELLS, icône DEMONIC_SPELL_ICON, projectile `sealPage`) et sa lueur de paume
// ci-dessous (CRAWLER_SPELL_GLOWS) ; demonicRulebookIconSvg() en donne une icône pour l'armurerie.

// Les quatre objets du contrat du chantier 17 et leur type de dessin (exigé par tests/regression/combat-scene.js).
const DEMONIC_SPELL_ICON = '📜';
const DEMONIC_ITEM_ART = {
    'Trousseau Ardent de Gorgoth': { kind: 'melee', category: 'weapons' },
    'Bleu de Travail Ignifugé': { kind: 'armor', category: 'armors' },
    'Lance-Clés Infernal': { kind: 'ranged', category: 'ranged' },
    'Règlement Intérieur': { kind: 'spell', category: 'scrolls', icon: DEMONIC_SPELL_ICON }
};
// Noms dessinés dans ITEM_SPRITES (les trois objets d'équipement ; le sort passe par FX_SPELLS).
const DEMONIC_ITEM_SPRITE_NAMES = Object.keys(DEMONIC_ITEM_ART).filter(name => DEMONIC_ITEM_ART[name].kind !== 'spell');

// Petite clé chauffée au rouge, anneau à l'origine, tige vers +y (avant rotation) : contour noir puis métal ardent.
function demonicKeyArt(x, y, rot, scale = 1, hot = '#f97316') {
    const shaft = 'M0 1.8 V7.6 M0 5.6 H1.9 M0 7.4 H1.6';
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">`
        + `<path d="${shaft}" fill="none" stroke="#05060c" stroke-width="2.3" stroke-linecap="round"/>`
        + `<path d="${shaft}" fill="none" stroke="${hot}" stroke-width="1.1" stroke-linecap="round"/>`
        + `<circle r="1.9" fill="none" stroke="#05060c" stroke-width="2.1"/>`
        + `<circle r="1.9" fill="none" stroke="#fbbf24" stroke-width="0.9"/></g>`;
}

// Chaîne en fouet du Trousseau : tracé partagé entre le contour et le métal ardent.
const DEMONIC_WHIP_CHAIN = 'M0 -18.7 C-8 -24 -7 -30 -2 -33.5 C3 -37 3 -41.5 -3 -45';

Object.assign(ITEM_SPRITES, {
    // Fouet : un anneau de concierge géant chauffé au rouge au bout d'un manche d'obsidienne, d'où part une
    // chaîne de clés ardentes qui ondule jusqu'à une flamme.
    'Trousseau Ardent de Gorgoth': {
        kind: 'melee', tip: [-3, -46], icon: 'rotate(40) scale(0.78) translate(1 21)',
        art: `
        <rect x="-2.2" y="-6" width="4.4" height="14" rx="1.6" fill="#1c1917" stroke="#05060c" stroke-width="1.1"/>
        <path d="M-2.2 -2 H2.2 M-2.2 1.8 H2.2 M-2.2 5.4 H2.2" stroke="#7e22ce" stroke-width="0.9"/>
        <circle cx="0" cy="8.6" r="1.5" fill="#f97316" stroke="#05060c" stroke-width="0.6"/>
        <circle cx="0" cy="-12.5" r="6.2" fill="none" stroke="#05060c" stroke-width="3.9"/>
        <circle cx="0" cy="-12.5" r="6.2" fill="none" stroke="#b91c1c" stroke-width="2.1"/>
        <path d="M-4.4 -16.9 A6.2 6.2 0 0 1 4.4 -16.9" fill="none" stroke="#fbbf24" stroke-width="0.8"/>
        ${demonicKeyArt(-5.2, -8.4, 35, 1.25)}
        ${demonicKeyArt(5, -8.6, -30, 1)}
        <path d="${DEMONIC_WHIP_CHAIN}" fill="none" stroke="#05060c" stroke-width="4.2" stroke-linecap="round"/>
        <path d="${DEMONIC_WHIP_CHAIN}" fill="none" stroke="#b91c1c" stroke-width="2.3" stroke-linecap="round"/>
        <path d="${DEMONIC_WHIP_CHAIN}" fill="none" stroke="#fb923c" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.2 1.3"/>
        ${demonicKeyArt(-6.4, -26, 70, 0.85)}
        ${demonicKeyArt(1.6, -36.5, -70, 0.85)}
        <g class="bd-flame"><path d="M-3 -52.5 C1 -48.5 1.6 -45.4 -1 -43.4 C-3.6 -43.8 -5.6 -45.4 -5.1 -47.8 C-4.6 -49.4 -3.6 -50.4 -3 -52.5 Z" fill="#f97316" stroke="#05060c" stroke-width="0.7"/>
        <path d="M-3 -48.8 C-1.6 -47.2 -1.6 -45.4 -3 -44.8 C-4.2 -45.2 -4.4 -46.8 -3 -48.8 Z" fill="#fde68a"/></g>
        <circle cx="2.6" cy="-29" r="0.9" fill="#fbbf24" class="bd-blink"/>
        <circle cx="-8.2" cy="-39" r="0.7" fill="#f97316" class="bd-blink"/>`
    },
    // Arbalète-lance-clous d'obsidienne : corde ardente, évents chauffés au rouge, chargeur en anneau de clés
    // sur le dessus, et une clé brûlante engagée dans la bouche.
    'Lance-Clés Infernal': {
        kind: 'ranged', tip: [-29, -2.5], icon: 'scale(0.9) translate(5 2)',
        art: `
        <path d="M-17 -4 Q-21 -13 -14 -19 M-17 0 Q-21 9 -14 14" fill="none" stroke="#05060c" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M-17 -4 Q-21 -13 -14 -19 M-17 0 Q-21 9 -14 14" fill="none" stroke="#292524" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M-14 -19 L-6 -2 L-14 14" fill="none" stroke="#f97316" stroke-width="0.8"/>
        <path d="M11 -2 L18 -4 L19 3 L13 3 Z" fill="#1c1917" stroke="#05060c" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M-1 1 L3 1 L4 10 L-1 10 Z" fill="#292524" stroke="#05060c" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M-0.5 4 H3.5 M-0.5 7 H3.8" stroke="#7e22ce" stroke-width="0.8"/>
        <path d="M-22 -6 H5 Q10 -6 11 -2 L13 3 H4 L1 1 H-22 Z" fill="#1c1917" stroke="#05060c" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-20 -3.8 H3" stroke="#7e22ce" stroke-width="0.9"/>
        <path d="M-18 -1.6 v2 M-15 -1.6 v2 M-12 -1.6 v2" stroke="#f97316" stroke-width="1" class="bd-blink"/>
        <circle cx="15.5" cy="0" r="1" fill="#f97316" class="bd-blink"/>
        <circle cx="-6" cy="-10.5" r="4" fill="none" stroke="#05060c" stroke-width="3"/>
        <circle cx="-6" cy="-10.5" r="4" fill="none" stroke="#b91c1c" stroke-width="1.6"/>
        ${demonicKeyArt(-9, -13.5, 135, 0.7)}
        ${demonicKeyArt(-3, -13.5, -135, 0.7)}
        <rect x="-25" y="-5" width="4" height="5" rx="0.8" fill="#44403c" stroke="#05060c" stroke-width="0.9"/>
        <path d="M-23 -2.5 H-29 M-27.6 -2.5 v1.7 M-26.2 -2.5 v1.2" fill="none" stroke="#05060c" stroke-width="2" stroke-linecap="round"/>
        <path d="M-23 -2.5 H-29 M-27.6 -2.5 v1.7 M-26.2 -2.5 v1.2" fill="none" stroke="#fb923c" stroke-width="0.9" stroke-linecap="round"/>
        <circle cx="-23" cy="-2.5" r="1.2" fill="#fde68a"/>`
    },
    // Bleu de travail de concierge carbonisé : plaques d'obsidienne (épaule, poitrine), poche à clés, badge
    // « CONCIERGE » pourpre, braises qui couvent aux coutures.
    'Bleu de Travail Ignifugé': {
        kind: 'armor', tip: [-4, -58],
        art: `
        <path d="M-11 -60 Q-12 -67 -4 -69 L6 -69 Q12 -67 11 -59 L10 -33 L-10 -33 Z" fill="#26364f" stroke="#05060c" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M-10 -40 Q-6 -44 -2 -39 Q2 -42 6 -38 L10 -36.5 L10 -33 L-10 -33 Z" fill="#0c0a09" opacity="0.75"/>
        <path d="M4 -66 q3 2 2 6 q-3 -1 -2 -6 Z" fill="#0c0a09" opacity="0.6"/>
        <path d="M-4 -69 L-1 -63 L2 -69" fill="none" stroke="#15202f" stroke-width="1.4"/>
        <path d="M-1 -63 V-34" stroke="#15202f" stroke-width="1.2"/>
        <path d="M-12 -62 L-6 -68 L-3 -63 L-7 -57 Z" fill="#1c1917" stroke="#05060c" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M-10.6 -61.4 L-6.4 -66" stroke="#a855f7" stroke-width="0.7"/>
        <path d="M1 -61 L8 -62 L9 -52 L2 -50.5 Z" fill="#1c1917" stroke="#05060c" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M2.4 -59.6 L7 -60.2" stroke="#a855f7" stroke-width="0.6"/>
        <path d="M5 -57.5 l1.2 1.6 l-1.6 1.4" fill="none" stroke="#f97316" stroke-width="0.7"/>
        <circle cx="-7.6" cy="-48.2" r="1.2" fill="none" stroke="#fbbf24" stroke-width="0.8"/>
        <circle cx="-4.8" cy="-48.6" r="1.1" fill="none" stroke="#f97316" stroke-width="0.8"/>
        <rect x="-9.2" y="-47.4" width="6.6" height="6" rx="0.8" fill="#1d2a3e" stroke="#05060c" stroke-width="0.9"/>
        <path d="M-9.2 -45.4 H-2.6" stroke="#05060c" stroke-width="0.6"/>
        <rect x="1.4" y="-48.4" width="8" height="3.8" rx="0.6" fill="#581c87" stroke="#05060c" stroke-width="0.6"/>
        <text x="5.4" y="-45.7" text-anchor="middle" font-size="2.4" font-weight="700" font-family="Arial, sans-serif" textLength="7" lengthAdjust="spacingAndGlyphs" fill="#fde68a">CONCIERGE</text>
        <path d="M-10.6 -55 L-10.2 -42 M10.6 -56 L10.2 -42 M-8 -35.6 H8" fill="none" stroke="#f97316" stroke-width="0.9" stroke-dasharray="1.4 1.6" class="bd-blink"/>
        <circle cx="-6" cy="-37" r="0.9" fill="#fbbf24" class="bd-blink"/>
        <circle cx="6.5" cy="-36.4" r="0.7" fill="#f97316" class="bd-blink"/>`
    }
});

// Lueur de la paume du crawler (posture magie) quand le Règlement Intérieur est équipé : braise.
CRAWLER_SPELL_GLOWS[DEMONIC_SPELL_ICON] = '#f97316';

// Icône (repère -24..24) du Règlement Intérieur : registre relié de cuir noir, entrouvert, sceau pourpre et
// pages qui couvent. Un sort n'a pas d'icône d'équipement (itemIconSvg() renvoie '') : à l'usage de
// l'armurerie de Gorgoth (chantier 17, lot 4) ou de toute liste qui veut montrer les quatre objets.
const DEMONIC_RULEBOOK_ART = `
    <path d="M-15 -14 L0 -10 L15 -14 L15 14 L0 18 L-15 14 Z" fill="#fde68a" stroke="#05060c" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-12 -8 L-3 -6 M-12 -3 L-3 -1 M-12 2 L-5 3.6 M3 -6 L12 -8 M3 -1 L12 -3 M5 3.6 L12 2" stroke="#78350f" stroke-width="0.9"/>
    <path d="M15 -14 L17 -15 L17 13 L15 14 M-15 -14 L-17 -15 L-17 13 L-15 14" fill="#1c1917" stroke="#05060c" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M-17 13 L0 19 L17 13 L17 16 L0 22 L-17 16 Z" fill="#1c1917" stroke="#05060c" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M0 -10 V18" stroke="#05060c" stroke-width="1.2"/>
    <path d="M-15 10 Q-12 6 -9 10 Q-6 7 -3 11 L-3 15.5 L-15 12 Z M15 10 Q12 6.5 9 10 Q6 7 3 11 L3 15.5 L15 12 Z" fill="#ea580c" opacity="0.75"/>
    <circle cx="6" cy="8" r="4.2" fill="#7e22ce" stroke="#05060c" stroke-width="1"/>
    <circle cx="6" cy="8" r="2.4" fill="none" stroke="#fbbf24" stroke-width="0.8"/>
    <path d="M6 12 L4.5 17 M6 12 L7.5 17" stroke="#7e22ce" stroke-width="1.4"/>
    <g class="bd-flame"><path d="M-8 -12 C-5 -15 -5 -18 -7 -21 C-3 -19 -2 -15 -4 -12.5 Z M9 -12.5 C12 -15 12 -18 10 -20 C14 -18 14 -14.5 12 -12 Z" fill="#f97316" stroke="#05060c" stroke-width="0.6"/></g>
    <circle cx="-11" cy="-17" r="0.9" fill="#fbbf24" class="bd-blink"/>`;
function demonicRulebookIconSvg(size = 28) {
    return `<svg class="item-icon shrink-0" viewBox="-24 -24 48 48" width="${size}" height="${size}" aria-hidden="true">${DEMONIC_RULEBOOK_ART}</svg>`;
}

// Aide console (DEV) : montre tour à tour les dessins démoniaques sur le crawler de la scène d'exploration
// (fouet en main, lance-clés pointé, paume ardente du Règlement), tous avec le bleu de travail, sans rien
// sauvegarder ni toucher au moteur : l'équipement réel est remis en place juste après chaque rendu, et la
// prochaine action (updateUI) redessine le vrai crawler. `stepMs` : durée de chaque pose.
function devPreviewDemonicItems(stepMs = 1600) {
    if (typeof renderScene !== 'function' || typeof gameState === 'undefined') return [];
    const fake = name => ({ name, baseName: name, category: DEMONIC_ITEM_ART[name].category });
    const armor = fake('Bleu de Travail Ignifugé');
    const spell = { name: 'Règlement Intérieur', spellName: 'Règlement Intérieur', category: 'scrolls', spellCategory: 'ranged', icon: DEMONIC_SPELL_ICON };
    const poses = [
        { kind: 'weapon', equipment: { weapon: fake('Trousseau Ardent de Gorgoth'), ranged: fake('Lance-Clés Infernal'), armor, spell: null } },
        { kind: 'ranged', equipment: { weapon: null, ranged: fake('Lance-Clés Infernal'), armor, spell: null } },
        { kind: 'magic', equipment: { weapon: null, ranged: null, armor, spell } }
    ];
    const show = pose => {
        const savedEq = gameState.equipment;
        const savedKind = gameState.lastAttackKind;
        try {
            gameState.equipment = Object.assign({}, savedEq, pose.equipment);
            gameState.lastAttackKind = pose.kind;
            renderScene('explore', (typeof lastExploreSpec !== 'undefined' && lastExploreSpec) || 'silence');
        } finally {
            gameState.equipment = savedEq;
            gameState.lastAttackKind = savedKind;
        }
    };
    poses.forEach((pose, i) => { if (i === 0) show(pose); else setTimeout(() => show(pose), i * stepMs); });
    return poses.map(p => p.kind);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEMONIC_SPELL_ICON, DEMONIC_ITEM_ART, DEMONIC_ITEM_SPRITE_NAMES, DEMONIC_RULEBOOK_ART, demonicKeyArt, demonicRulebookIconSvg, devPreviewDemonicItems };
}
