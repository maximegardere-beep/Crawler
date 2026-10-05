// sprites/fx.js - Catalogue des effets d'attaque de la scène de combat (chantier « sprites & effets »,
// phase 3) : style de coup par arme de mêlée, projectile par arme à distance, effet par sort, attaque
// par archétype de mob, et les éclats d'impact. Catalogue pur, sans DOM ni gameState : fx.js le joue.
//
// Repères : un projectile est dessiné pointe vers la GAUCHE (x négatif, comme les armes à distance du
// crawler), centré sur sa tête ; fx.js le retourne pour un tir de mob (vers la droite). Un éclat
// d'impact est centré sur (0, 0), à la taille « normale » (fx.js le grossit puis l'estompe).
// Clés d'armes = clés de sprite de ITEM_SPRITES (sprites/items-*.js) ; tests/regression/combat-scene.js
// exige une entrée pour CHAQUE arme dessinée, chaque sort de spells.js et chaque archétype de mob.

// Couleurs par défaut des traînées et éclats (un enchantement remplace la couleur de traînée de l'arme).
const FX_COLORS = { slash: '#e2e8f0', smash: '#fcd34d', thrust: '#f1f5f9', hit: '#fff7d6', mob: '#fecaca', claw: '#ef4444' };

// Couleur de l'effet élémentaire d'un mob (bestiary.js `effect`) : ses traînées, crachats et griffures.
const MOB_EFFECT_FX_COLORS = {
    burn: '#fb923c', poison: '#84cc16', slow: '#7dd3fc', stun: '#fde047', confusion: '#c084fc',
    pull: '#818cf8', light: '#fef08a', corrode: '#bef264', fear: '#a855f7', bleed: '#ef4444'
};

// Style de coup des armes de mêlée : 'slash' (arc fin et tranchant), 'smash' (arc lourd, par-dessus
// l'épaule) ou 'thrust' (estoc droit devant).
const MELEE_SWING_STYLES = {
    'generic:weapons': 'smash',
    'Pied-de-biche': 'smash',
    'Extincteur Cabossé': 'smash',
    'Agrafeuse Tactique': 'smash',
    'Épée en Pain de Mie': 'slash',
    'Hache à Viande': 'slash',
    'Bâton de Dynamite': 'smash',
    'Couteau en Beurre': 'thrust',
    'Lance à Feu': 'thrust',
    'Gantelet Électrique': 'thrust',
    'Antivol de Voiture': 'smash',
    'Pied de Parasol': 'smash',
    "Masse d'Armes": 'smash',
    'Épée Longue': 'slash',
    'Katana de Collection': 'slash',
    'Tronçonneuse': 'thrust',
    'Marteau de Guerre': 'smash',
    'Nouille de Piscine': 'smash',
    'Tapette à Mouches': 'smash',
    'Sifflet du Chef de Gare Nécrosé': 'smash',
    'Tronçon de Liane Toxique': 'slash',
    'Couperet du Boucher Sans Visage': 'slash',
    'Seringue Géante du Professeur Démentiel': 'thrust',
    'Canne-Épée du Baron des Ombres': 'thrust',
    'Barre de Péage Maudite': 'smash',
    'Dents du Grand Requin Gonflable': 'slash',
    'Micro Électrifié de l\'Animateur Vedette': 'smash',
    // Chantier 17 : armurerie de Gorgoth le Concierge (sprites/items-demonic.js) — le fouet de clés claque en arc fin.
    'Trousseau Ardent de Gorgoth': 'slash'
};

// Éclat d'impact propre à certaines armes de mêlée (sinon celui de leur style).
const MELEE_IMPACTS = {
    'Bâton de Dynamite': 'explosion',
    'Lance à Feu': 'fire',
    'Gantelet Électrique': 'shock',
    'Micro Électrifié de l\'Animateur Vedette': 'shock',
    'Extincteur Cabossé': 'foam',
    'Seringue Géante du Professeur Démentiel': 'splash',
    'Tronçon de Liane Toxique': 'splash',
    'Tronçonneuse': 'slash',
    'Marteau de Guerre': 'pow',
    'Nouille de Piscine': 'foam',
    'Trousseau Ardent de Gorgoth': 'brand'
};

// Projectile de chaque arme à distance.
const RANGED_PROJECTILES = {
    'generic:ranged': 'stone',
    'Lance-Pierre de Chantier': 'stone',
    'Arc de Fortune Rafistolé': 'arrow',
    'Arbalète de Musée': 'bolt',
    'Pistolet à Clous': 'nail',
    'Fusil de Chasse Rouillé': 'pellets',
    'Sarbacane Improvisée': 'dart',
    'Pistolet à Eau Surpuissant': 'water',
    'Lance-Confettis Bricolé': 'confetti',
    'Arc Long de Compétition': 'arrow',
    'Lance-Harpon': 'bolt',
    'Arbalète Lourde': 'bolt',
    'Fusil à Pompe': 'pellets',
    'Pistolet à Bulles': 'water',
    'Tampon Encreur du Directeur': 'stamp',
    'Canon à Impulsions de l\'IA Malveillante': 'pulse',
    'Lance-Clés Infernal': 'emberKey'
};

// Projectiles : `art` (pointe à gauche), `speed` (unités de scène par ms), `arc` (hauteur de la cloche,
// 0 = tir tendu), `orient` (suit la trajectoire), `spin` (tourne sur lui-même), `count`/`spread`
// (plusieurs à la fois, décalés en hauteur), `beam` (jet continu au lieu d'un objet : largeur du trait),
// `flash` (éclair de bouche), `color` (traînée), `impact` (éclat à l'arrivée).
const FX_PROJECTILES = {
    stone: { speed: 0.8, arc: 12, spin: true, color: '#cbd5e1', impact: 'hit',
        art: '<circle r="2.8" fill="#8a8f98" stroke="#05060c" stroke-width="1"/><circle cx="-0.8" cy="-0.8" r="0.9" fill="#c4c9d0"/>' },
    arrow: { speed: 1.1, arc: 7, orient: true, color: '#e2e8f0', impact: 'hit',
        art: '<path d="M0 0 H15" stroke="#05060c" stroke-width="2.6"/><path d="M0 0 H15" stroke="#a0784a" stroke-width="1.2"/><path d="M-4 0 L1.5 -2.6 L1.5 2.6 Z" fill="#c4c9d0" stroke="#05060c" stroke-width="0.8"/><path d="M12 0 L16 -3 M12 0 L16 3" stroke="#e5e7eb" stroke-width="1.3"/>' },
    bolt: { speed: 1.4, arc: 2, orient: true, color: '#e2e8f0', impact: 'hit',
        art: '<path d="M0 0 H10" stroke="#05060c" stroke-width="3.2"/><path d="M0 0 H10" stroke="#6b4a2a" stroke-width="1.8"/><path d="M-3.5 0 L1.5 -3 L1.5 3 Z" fill="#9ca3af" stroke="#05060c" stroke-width="0.8"/>' },
    nail: { speed: 1.8, arc: 0, orient: true, count: 2, spread: 5, flash: '#fde68a', color: '#e5e7eb', impact: 'hit',
        art: '<path d="M-3 0 H6" stroke="#05060c" stroke-width="2.2"/><path d="M-3 0 H6" stroke="#cbd5e1" stroke-width="1.1"/><rect x="5.5" y="-2" width="1.6" height="4" fill="#9ca3af" stroke="#05060c" stroke-width="0.5"/>' },
    pellets: { speed: 2, arc: 0, count: 3, spread: 8, flash: '#fdba74', color: '#fcd34d', impact: 'smash',
        art: '<circle r="1.7" fill="#4b5563" stroke="#05060c" stroke-width="0.7"/>' },
    dart: { speed: 1.3, arc: 3, orient: true, color: '#e2e8f0', impact: 'hit',
        art: '<path d="M-2 0 H8" stroke="#05060c" stroke-width="1.8"/><path d="M-2 0 H8" stroke="#d1d5db" stroke-width="0.8"/><circle cx="9" cy="0" r="2.4" fill="#dc2626" stroke="#05060c" stroke-width="0.7"/>' },
    water: { speed: 1.2, beam: 3.2, color: '#7dd3fc', impact: 'splash', art: '' },
    confetti: { speed: 0.75, arc: 9, spin: true, count: 5, spread: 12, color: '#f9a8d4', impact: 'confetti',
        art: '<rect x="-2" y="-1.4" width="4" height="2.8" fill="#f472b6" stroke="#05060c" stroke-width="0.5"/>',
        tints: ['#f472b6', '#fde047', '#60a5fa', '#4ade80', '#fb923c'] },
    stamp: { speed: 0.9, arc: 10, spin: true, color: '#fca5a5', impact: 'stamp',
        art: '<rect x="-4" y="-2" width="8" height="4" rx="1" fill="#b91c1c" stroke="#05060c" stroke-width="0.9"/><rect x="-1.5" y="-7" width="3" height="5" fill="#4b3621" stroke="#05060c" stroke-width="0.8"/>' },
    pulse: { speed: 2.2, beam: 4.2, flash: '#67e8f9', color: '#22d3ee', impact: 'shock', art: '' },
    // Chantier 17 : clé ardente du Lance-Clés Infernal — tourne sur elle-même dans un halo, traînée de braises.
    emberKey: { speed: 1.3, arc: 4, spin: true, flash: '#fdba74', color: '#f97316', impact: 'brand',
        art: '<circle r="6.5" fill="#f97316" opacity="0.28"/><path d="M-6 0 H2.2 M-5 0 v2.3 M-3.4 0 v1.7" fill="none" stroke="#05060c" stroke-width="2.6" stroke-linecap="round"/><path d="M-6 0 H2.2 M-5 0 v2.3 M-3.4 0 v1.7" fill="none" stroke="#fb923c" stroke-width="1.3" stroke-linecap="round"/><circle cx="4.2" r="2.2" fill="none" stroke="#05060c" stroke-width="2.4"/><circle cx="4.2" r="2.2" fill="none" stroke="#fde68a" stroke-width="1.1"/><circle cx="7.6" cy="-2.6" r="0.8" fill="#fbbf24"/><circle cx="8.2" cy="2.3" r="0.6" fill="#f97316"/><circle cx="-7.6" cy="2" r="0.6" fill="#fbbf24"/>' },
    // Chantier 17 : pages-sceaux enflammées du Règlement Intérieur (trois feuillets qui volent en cloche inversée).
    sealPage: { speed: 1, arc: -8, count: 3, spread: 9, color: '#f97316', impact: 'infernalSeal',
        art: '<g transform="rotate(-12)"><rect x="-4" y="-5" width="8" height="10" rx="0.6" fill="#fde68a" stroke="#05060c" stroke-width="0.8"/><path d="M-2.6 -2.8 H2.4 M-2.6 -0.8 H1.6" stroke="#78350f" stroke-width="0.6"/><path d="M4 -5 V5" stroke="#f97316" stroke-width="1.2"/><circle cx="0.4" cy="2.2" r="1.9" fill="#7e22ce" stroke="#05060c" stroke-width="0.6"/><path d="M3 -5 Q5.6 -7.4 4.6 -9.6 Q7.6 -6.6 5.4 -4.2 Z" fill="#f97316" stroke="#05060c" stroke-width="0.4"/></g>' },
    // Tirs de mobs (et de sorts) : couleur = celle de l'effet du mob, posée par fx.js.
    spit: { speed: 0.85, arc: 14, color: '#84cc16', impact: 'splash',
        art: '<ellipse rx="4" ry="2.8" fill="currentColor" stroke="#05060c" stroke-width="0.9"/><circle cx="3.5" cy="-1" r="1.3" fill="currentColor"/>' },
    thorn: { speed: 1.3, arc: 4, orient: true, count: 2, spread: 6, color: '#86efac', impact: 'hit',
        art: '<path d="M-4 0 L4 -2 L4 2 Z" fill="#3f6212" stroke="#05060c" stroke-width="0.8"/>' },
    wisp: { speed: 0.9, arc: -10, color: '#c084fc', impact: 'hit',
        art: '<circle r="6" fill="currentColor" opacity="0.3"/><circle r="3" fill="currentColor"/><path d="M2 0 Q6 -3 10 0 Q6 3 2 0 Z" fill="currentColor" opacity="0.6"/>' },
    swarm: { speed: 0.9, arc: 6, count: 5, spread: 10, color: '#a3a3a3', impact: 'hit',
        art: '<circle r="1.4" fill="#1f2937" stroke="#d4d4d8" stroke-width="0.4"/>' },
    shard: { speed: 1.4, arc: 0, orient: true, color: '#bae6fd', impact: 'frost',
        art: '<path d="M-6 0 L0 -2.6 L6 0 L0 2.6 Z" fill="#bae6fd" stroke="#0c4a6e" stroke-width="0.8"/><path d="M-6 0 H6" stroke="#f0f9ff" stroke-width="0.6"/>' },
    orb: { speed: 0.8, arc: 22, spin: true, color: '#a3e635', impact: 'splash',
        art: '<circle r="6" fill="currentColor" opacity="0.28"/><circle r="3.6" fill="currentColor" stroke="#05060c" stroke-width="0.8"/><circle cx="-1.2" cy="-1.2" r="1.1" fill="#f7fee7"/>' },
    fireball: { speed: 1, arc: 0, color: '#fb923c', impact: 'fire',
        art: '<circle r="6.5" fill="#f97316" opacity="0.3"/><path d="M-4 0 Q-4 -4.5 1 -4 Q9 -2 12 0 Q9 2 1 4 Q-4 4.5 -4 0 Z" fill="#fb923c"/><circle cx="-1" r="2.6" fill="#fde68a"/>' }
};

// Effet de chaque sort (clé = icône de spells.js) : `style` —
//   'zap' (arc électrique de la main à la cible), 'punch' (poing lumineux), 'cone' (jet de flammes),
//   'arc' (lame spectrale en arc de cercle), 'sky' (éclair qui tombe du plafond sur la cible),
//   'bolt' (projectile de FX_PROJECTILES, clé `projectile`), 'meteor' (boule de feu qui tombe en
//   diagonale depuis le haut de la scène) ; `color` : lueur ; `impact` : éclat à l'arrivée.
const FX_SPELLS = {
    '⚡': { style: 'zap', color: '#fde047', impact: 'shock' },
    '🧊': { style: 'punch', color: '#7dd3fc', impact: 'frost' },
    '🔥': { style: 'cone', color: '#fb923c', impact: 'fire' },
    '👻': { style: 'arc', color: '#c7d2fe', impact: 'slash' },
    '🌩️': { style: 'sky', color: '#fde047', impact: 'shock' },
    '🧪': { style: 'bolt', projectile: 'orb', color: '#a3e635', impact: 'splash' },
    '❄️': { style: 'bolt', projectile: 'shard', color: '#7dd3fc', impact: 'frost' },
    '☄️': { style: 'meteor', projectile: 'fireball', color: '#f97316', impact: 'explosion' },
    // Chantier 11 « nouveaux sorts »
    '🧛': { style: 'arc', color: '#dc2626', impact: 'slash' },
    '👋': { style: 'punch', color: '#e0f2fe', impact: 'pow' },
    '🔩': { style: 'punch', color: '#b45309', impact: 'splash' },
    '🐝': { style: 'bolt', projectile: 'pellets', color: '#facc15', impact: 'hit' },
    '💡': { style: 'zap', color: '#fef9c3', impact: 'shock' },
    '⛓️': { style: 'sky', color: '#93c5fd', impact: 'shock' },
    '😱': { style: 'cone', color: '#a78bfa', impact: 'pow' },
    // Sorts utilitaires (catégorie `any`) : l'effet se joue sur le crawler lui-même (style 'self').
    '💚': { style: 'self', color: '#4ade80', impact: 'foam' },
    '🔰': { style: 'self', color: '#60a5fa', impact: 'frost' },
    '🌑': { style: 'self', color: '#6b7280', impact: 'foam' },
    // Chantier 17 : Règlement Intérieur (armurerie de Gorgoth, DEMONIC_SPELL_ICON de sprites/items-demonic.js).
    '📜': { style: 'bolt', projectile: 'sealPage', color: '#f97316', impact: 'infernalSeal' }
};

// Attaque au contact de chaque archétype de mob (sprites/mobs.js) : 'smash', 'slash' (arc au bout du
// bras), 'claw' (griffures sur le crawler), 'bite' (morsure), 'lash' (fouet de liane), 'slam' (le mob se
// jette de tout son poids), 'swarm' (la nuée fond sur le crawler), 'ram' (charge d'un véhicule).
const MOB_ATTACK_STYLES = {
    goblinoid: 'smash', beast: 'bite', zombie: 'claw', machine: 'smash', plant: 'lash',
    shade: 'claw', blob: 'slam', mannequin: 'slash', swarm: 'swarm', vehicle: 'ram'
};
// Tir de chaque archétype quand le mob attaque à distance (FX_PROJECTILES).
const MOB_RANGED_PROJECTILES = {
    goblinoid: 'stone', beast: 'spit', zombie: 'spit', machine: 'nail', plant: 'thorn',
    shade: 'wisp', blob: 'spit', mannequin: 'nail', swarm: 'swarm', vehicle: 'pellets'
};
// Éclat d'impact de chaque style d'attaque de mob au contact.
const MOB_STYLE_IMPACTS = {
    smash: 'smash', slash: 'slash', claw: 'claw', bite: 'bite', lash: 'slash', slam: 'splash', swarm: 'hit', ram: 'smash'
};

// Éclats d'impact : fonction (couleur) -> contenu SVG centré sur (0, 0).
function fxStarPath(points, outer, inner) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI * i) / points - Math.PI / 2;
        pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
    }
    return `M${pts.join(' L')} Z`;
}

const FX_IMPACTS = {
    hit: c => `<path d="${fxStarPath(8, 9, 3.2)}" fill="${c || FX_COLORS.hit}" stroke="#05060c" stroke-width="0.8"/><circle r="2.6" fill="#fff"/>`,
    slash: c => `<path d="M-11 9 L11 -9" stroke="#05060c" stroke-width="5" stroke-linecap="round"/><path d="M-11 9 L11 -9" stroke="${c || '#fff'}" stroke-width="2.6" stroke-linecap="round"/><path d="M-7 3 L6 -8" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity="0.8"/>`,
    smash: c => `<circle r="12" fill="none" stroke="${c || FX_COLORS.smash}" stroke-width="1.6" opacity="0.8"/><path d="${fxStarPath(6, 10, 4)}" fill="${c || FX_COLORS.smash}" stroke="#05060c" stroke-width="0.9"/><circle r="3" fill="#fff"/><circle cx="-13" cy="-4" r="1.4" fill="#a8a29e"/><circle cx="12" cy="5" r="1.2" fill="#a8a29e"/><circle cx="3" cy="-13" r="1" fill="#a8a29e"/>`,
    pow: () => `<path d="${fxStarPath(10, 14, 8)}" fill="#fde047" stroke="#b91c1c" stroke-width="1.6" stroke-linejoin="round"/><text y="3.5" text-anchor="middle" font-size="9" font-weight="900" font-family="Arial Black, Arial, sans-serif" fill="#b91c1c">PAF</text>`,
    explosion: () => `<circle r="14" fill="#f97316" opacity="0.45"/><path d="${fxStarPath(9, 13, 7)}" fill="#fb923c" stroke="#7c2d12" stroke-width="1"/><circle r="6" fill="#fde68a"/><circle cx="-9" cy="-10" r="4" fill="#44403c" opacity="0.7"/><circle cx="8" cy="-12" r="3.2" fill="#57534e" opacity="0.6"/>`,
    fire: () => `<path d="M-9 6 Q-10 -4 -4 -12 Q-3 -4 0 -6 Q2 -14 6 -15 Q5 -6 9 -3 Q11 3 7 7 Z" fill="#f97316" stroke="#7c2d12" stroke-width="0.9"/><path d="M-4 6 Q-5 -1 -1 -6 Q1 -1 4 -3 Q6 2 3 6 Z" fill="#fde047"/>`,
    shock: c => `<path d="M-2 -13 L3 -4 L-3 -2 L4 10 M-12 -3 L-5 0 L-8 5 M12 -6 L6 -1 L10 3" fill="none" stroke="#05060c" stroke-width="3.4" stroke-linejoin="round"/><path d="M-2 -13 L3 -4 L-3 -2 L4 10 M-12 -3 L-5 0 L-8 5 M12 -6 L6 -1 L10 3" fill="none" stroke="${c || '#fde047'}" stroke-width="1.8" stroke-linejoin="round"/><circle r="3" fill="#fff" opacity="0.9"/>`,
    splash: c => `<circle r="6" fill="${c || '#7dd3fc'}" opacity="0.55"/><circle cx="-10" cy="-6" r="2.4" fill="${c || '#7dd3fc'}"/><circle cx="9" cy="-8" r="2" fill="${c || '#7dd3fc'}"/><circle cx="-7" cy="8" r="1.8" fill="${c || '#7dd3fc'}"/><circle cx="11" cy="5" r="2.6" fill="${c || '#7dd3fc'}"/><circle cx="1" cy="-12" r="1.6" fill="${c || '#7dd3fc'}"/>`,
    frost: () => `<path d="M0 -13 V13 M-11 -6.5 L11 6.5 M-11 6.5 L11 -6.5" stroke="#0c4a6e" stroke-width="3.6" stroke-linecap="round"/><path d="M0 -13 V13 M-11 -6.5 L11 6.5 M-11 6.5 L11 -6.5" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round"/><circle r="3.4" fill="#f0f9ff"/>`,
    confetti: () => ['#f472b6', '#fde047', '#60a5fa', '#4ade80', '#fb923c', '#c084fc'].map((c, i) => {
        const a = (Math.PI * 2 * i) / 6;
        return `<rect x="${(Math.cos(a) * 10 - 1.8).toFixed(1)}" y="${(Math.sin(a) * 10 - 1.2).toFixed(1)}" width="3.6" height="2.4" fill="${c}" transform="rotate(${i * 35} ${(Math.cos(a) * 10).toFixed(1)} ${(Math.sin(a) * 10).toFixed(1)})"/>`;
    }).join('') + '<path d="' + fxStarPath(5, 5, 2) + '" fill="#fff"/>',
    foam: () => `<circle cx="-5" cy="-3" r="5" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8"/><circle cx="4" cy="-5" r="4" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8"/><circle cx="3" cy="4" r="5.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8"/><circle cx="-6" cy="6" r="3" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.8"/>`,
    stamp: () => `<g transform="rotate(-14)"><rect x="-17" y="-6.5" width="34" height="13" rx="1.5" fill="none" stroke="#dc2626" stroke-width="1.8"/><text y="3.4" text-anchor="middle" font-size="8.5" font-weight="900" font-family="Arial Black, Arial, sans-serif" fill="#dc2626">REFUSÉ</text></g>`,
    claw: c => [-6, 0, 6].map(dx => `<path d="M${dx - 5} -11 Q${dx} 0 ${dx + 5} 11" fill="none" stroke="#05060c" stroke-width="3.6" stroke-linecap="round"/><path d="M${dx - 5} -11 Q${dx} 0 ${dx + 5} 11" fill="none" stroke="${c || FX_COLORS.claw}" stroke-width="1.8" stroke-linecap="round"/>`).join(''),
    // Mini-jeux (chantier 6) : Parfait = anneau doré + étoile ; Raté = volute de fumée grise qui s'éteint.
    perfect: c => `<circle r="15" fill="none" stroke="${c || '#facc15'}" stroke-width="2" opacity="0.85"/><circle r="9" fill="none" stroke="#fff" stroke-width="1" opacity="0.7"/><path d="${fxStarPath(8, 12, 4.5)}" fill="${c || '#facc15'}" stroke="#92400e" stroke-width="1"/><circle r="3.2" fill="#fff"/>`,
    fizzle: c => `<circle cx="-4" cy="2" r="5.5" fill="${c || '#9ca3af'}" opacity="0.55"/><circle cx="4" cy="-3" r="4.5" fill="${c || '#9ca3af'}" opacity="0.45"/><circle cx="-1" cy="-9" r="3.2" fill="${c || '#9ca3af'}" opacity="0.35"/><path d="M-9 8 L-5 4 M9 6 L5 3" stroke="#6b7280" stroke-width="1.4" stroke-linecap="round"/>`,
    // V1 des mini-jeux : coffre qui s'ouvre (rayons + pièces), crochet cassé, piège désarmé (coche), piège qui claque (pointes),
    // glyphe qui s'imprime (cercle runique) et glyphe qui se dissipe (fumée violette).
    chestOpen: c => `<path d="M-14 4 L-4 -12 M0 6 L0 -16 M14 4 L4 -12 M-18 -2 L-8 -6 M18 -2 L8 -6" stroke="${c || '#facc15'}" stroke-width="2.2" stroke-linecap="round"/><circle r="5" fill="#fff" opacity="0.9"/><circle cx="-9" cy="-14" r="2.6" fill="#fde047" stroke="#92400e" stroke-width="0.8"/><circle cx="10" cy="-11" r="2.2" fill="#fde047" stroke="#92400e" stroke-width="0.8"/><circle cx="2" cy="-19" r="1.8" fill="#fde047" stroke="#92400e" stroke-width="0.8"/>`,
    lockJam: c => `<path d="M-10 6 L-2 -2 M2 2 L10 -6" stroke="#05060c" stroke-width="4" stroke-linecap="round"/><path d="M-10 6 L-2 -2 M2 2 L10 -6" stroke="${c || '#9ca3af'}" stroke-width="2" stroke-linecap="round"/><path d="M-1 -7 L1 -3 M5 -9 L4 -4" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/><circle cx="-3" cy="-11" r="3" fill="${c || '#9ca3af'}" opacity="0.4"/>`,
    disarmed: c => `<circle r="13" fill="none" stroke="${c || '#4ade80'}" stroke-width="2" opacity="0.85"/><path d="M-6 0 L-1.5 5 L7 -5" fill="none" stroke="#05060c" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 0 L-1.5 5 L7 -5" fill="none" stroke="${c || '#4ade80'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    trapSnap: c => `<path d="${fxStarPath(8, 13, 4)}" fill="${c || '#ef4444'}" stroke="#05060c" stroke-width="1"/><path d="M-8 9 L-5 -2 L-2 9 M2 9 L5 -4 L8 9" fill="#e5e7eb" stroke="#05060c" stroke-width="0.9" stroke-linejoin="round"/><circle r="2.4" fill="#fff"/>`,
    glyphSeal: c => `<circle r="14" fill="none" stroke="${c || '#c084fc'}" stroke-width="1.8" opacity="0.9"/><circle r="9" fill="none" stroke="${c || '#c084fc'}" stroke-width="1" stroke-dasharray="3 2"/><path d="${fxStarPath(5, 8, 3.4)}" fill="${c || '#c084fc'}" stroke="#4c1d95" stroke-width="0.9"/><circle r="2.2" fill="#fff"/>`,
    glyphFade: c => `<path d="M-9 4 Q-4 -2 -9 -8 M0 6 Q5 -2 0 -12 M9 4 Q14 -2 9 -8" fill="none" stroke="${c || '#a78bfa'}" stroke-width="2" stroke-linecap="round" opacity="0.6"/><circle cx="-5" cy="-3" r="4" fill="${c || '#a78bfa'}" opacity="0.35"/><circle cx="5" cy="-7" r="3" fill="${c || '#a78bfa'}" opacity="0.28"/>`,
    // V2 des mini-jeux (combat) : prise (mains qui se referment), étranglement (cercle qui se resserre), cible touchée (anneaux +
    // flèche), tir qui ricoche, point faible marqué (réticule).
    grapple: c => `<path d="M-13 -6 Q-4 -12 -2 -2 M13 -6 Q4 -12 2 -2 M-13 7 Q-4 13 -2 3 M13 7 Q4 13 2 3" fill="none" stroke="#05060c" stroke-width="4" stroke-linecap="round"/><path d="M-13 -6 Q-4 -12 -2 -2 M13 -6 Q4 -12 2 -2 M-13 7 Q-4 13 -2 3 M13 7 Q4 13 2 3" fill="none" stroke="${c || '#fdba74'}" stroke-width="2.2" stroke-linecap="round"/><circle r="3" fill="#fff"/>`,
    choke: c => `<circle r="12" fill="none" stroke="#05060c" stroke-width="5"/><circle r="12" fill="none" stroke="${c || '#f87171'}" stroke-width="2.6" stroke-dasharray="5 3"/><circle r="6" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.8"/><path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
    bullseye: c => `<circle r="14" fill="none" stroke="${c || '#facc15'}" stroke-width="1.8"/><circle r="9" fill="none" stroke="#fff" stroke-width="1.4"/><circle r="4.5" fill="${c || '#facc15'}" stroke="#05060c" stroke-width="0.9"/><path d="M-16 -16 L-3 -3" stroke="#05060c" stroke-width="3.4" stroke-linecap="round"/><path d="M-16 -16 L-3 -3" stroke="#e5e7eb" stroke-width="1.6" stroke-linecap="round"/>`,
    ricochet: c => `<path d="M-14 8 L-2 -2 L4 8 L13 -4" fill="none" stroke="#05060c" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M-14 8 L-2 -2 L4 8 L13 -4" fill="none" stroke="${c || '#9ca3af'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M-3 -7 L-1 -4 M5 -9 L4 -5" stroke="#fbbf24" stroke-width="1.3" stroke-linecap="round"/>`,
    weakMark: c => `<circle r="10" fill="none" stroke="${c || '#fb923c'}" stroke-width="1.8"/><path d="M0 -15 V-6 M0 6 V15 M-15 0 H-6 M6 0 H15" stroke="${c || '#fb923c'}" stroke-width="2" stroke-linecap="round"/><circle r="2.6" fill="${c || '#fb923c'}" stroke="#05060c" stroke-width="0.8"/>`,
    // V3 (boss) : parade (étincelles croisées sur le bouclier) et garde brisée (fissure qui éclate).
    parry: c => `<path d="M-13 -13 L13 13 M13 -13 L-13 13" stroke="#05060c" stroke-width="4.4" stroke-linecap="round"/><path d="M-13 -13 L13 13 M13 -13 L-13 13" stroke="${c || '#e5e7eb'}" stroke-width="2.2" stroke-linecap="round"/><circle r="9" fill="none" stroke="${c || '#e5e7eb'}" stroke-width="1.6"/><circle r="3.4" fill="#fff"/><path d="M-15 0 H-9 M9 0 H15 M0 -15 V-9 M0 9 V15" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>`,
    guardBreak: c => `<path d="M0 -15 L-4 -5 L3 -2 L-5 8 L1 15" fill="none" stroke="#05060c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 -15 L-4 -5 L3 -2 L-5 8 L1 15" fill="none" stroke="${c || '#fdba74'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M-14 -4 L-8 -2 M12 4 L7 2 M10 -10 L6 -7" stroke="${c || '#fdba74'}" stroke-width="1.6" stroke-linecap="round"/><circle r="2.6" fill="#fff"/>`,
    // Chantier 17 (objets démoniaques) : serrure marquée au fer rouge (fouet de clés, clé ardente) et sceau de cire
    // pourpre qui s'embrase (Règlement Intérieur).
    brand: c => `<circle r="12" fill="${c || '#f97316'}" opacity="0.32"/><circle r="8" fill="none" stroke="#05060c" stroke-width="3.6"/><circle r="8" fill="none" stroke="${c || '#f97316'}" stroke-width="2"/><path d="M0 -5 A2.6 2.6 0 0 1 1.6 -0.4 L3 5 H-3 L-1.6 -0.4 A2.6 2.6 0 0 1 0 -5 Z" fill="#fde68a" stroke="#05060c" stroke-width="0.8"/><path d="M-14 -6 L-10 -4 M13 -8 L9.5 -5 M-12 9 L-9 6.5 M12 9 L9 6.5 M0 -15 V-11" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>`,
    infernalSeal: c => `<circle r="14" fill="${c || '#f97316'}" opacity="0.3"/><path d="${fxStarPath(9, 12, 10)}" fill="#7e22ce" stroke="#05060c" stroke-width="1"/><circle r="7.4" fill="none" stroke="#fbbf24" stroke-width="1"/><path d="${fxStarPath(5, 5.6, 2.3)}" fill="#fbbf24" stroke="#78350f" stroke-width="0.6"/><path d="M-9 -9 Q-11 -14 -8 -17 Q-7 -13 -5 -12 Z M9 -9 Q11 -14 8 -17 Q7 -13 5 -12 Z M0 -12 Q-2 -17 0 -20 Q2 -17 0 -12 Z" fill="#f97316" stroke="#05060c" stroke-width="0.6"/>`,
    bite: c => `<path d="M-11 -4 Q0 -14 11 -4" fill="none" stroke="#05060c" stroke-width="3"/><path d="M-11 4 Q0 14 11 4" fill="none" stroke="#05060c" stroke-width="3"/>${[-7, -2.5, 2.5, 7].map(x => `<path d="M${x - 1.8} ${-7 + Math.abs(x) * 0.35} L${x} ${-2 + Math.abs(x) * 0.35} L${x + 1.8} ${-7 + Math.abs(x) * 0.35} Z M${x - 1.8} ${7 - Math.abs(x) * 0.35} L${x} ${2 - Math.abs(x) * 0.35} L${x + 1.8} ${7 - Math.abs(x) * 0.35} Z" fill="#f8fafc" stroke="#05060c" stroke-width="0.6"/>`).join('')}<circle r="2" fill="${c || FX_COLORS.claw}"/>`
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FX_COLORS, MOB_EFFECT_FX_COLORS, MELEE_SWING_STYLES, MELEE_IMPACTS, RANGED_PROJECTILES, FX_PROJECTILES,
        FX_SPELLS, MOB_ATTACK_STYLES, MOB_RANGED_PROJECTILES, MOB_STYLE_IMPACTS, FX_IMPACTS, fxStarPath
    };
}
