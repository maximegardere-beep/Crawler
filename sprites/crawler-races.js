// sprites/crawler-races.js - Aspect du crawler par RACE (chantier 13, lot 4 — voir CHANTIERS.md et NOTES_ORIGINES.md).
// Catalogue pur, sans DOM ni gameState (scene.js le lit). Deux niveaux, du plus simple au plus riche :
//   1. CRAWLER_RACE_LOOKS : le corps humain de sprites/crawler.js TEINTÉ (peau, cheveux/capuche) — actif dès qu'une race est choisie, il
//      reste le repli de toute race dont le corps n'est pas encore dessiné ;
//   2. CRAWLER_RACE_BODIES : un corps COMPLET dessiné par race (livré par Vibe, un à la fois) — { parts, arms, frontExtent, anchors?, corpse?,
//      tint? }, même repère et mêmes couches que CRAWLER_PARTS/CRAWLER_ARMS. Vide tant qu'aucun dessin n'est livré. Le gabarit peut varier
//      légèrement (frontExtent de 12 à 19, hauteur ±20 %) : scene.js lit alors l'extension du corps courant pour le contact et les bandes.
// Chargé juste après sprites/crawler.js, avant scene.js (même ordre dans index.html et tests/load_game.js — GAME_FILES).

// Couleurs du crawler humain remplacées par la teinte d'une race (voir sprites/crawler.js : peau = tête, cou, mains ; cheveux = capuche).
const CRAWLER_SKIN_BASE = '#c98a5e';
const CRAWLER_HAIR_BASE = '#2f2318';

// Humain : aucune entrée (corps d'origine). `skin`/`hair` : couleurs hexadécimales de remplacement.
const CRAWLER_RACE_LOOKS = {
    ghoul: { skin: '#93a58c', hair: '#3b4237' },   // peau grise-verdâtre
    goblin: { skin: '#6aa84f', hair: '#2a3a1c' },   // vert gobelin
    troll: { skin: '#8d9db3', hair: '#2b3340' },    // gris-bleu de bureau
    elf: { skin: '#ecd3b8', hair: '#d6c27a' },      // peau claire, cheveux blonds
    dwarf: { skin: '#d9a07a', hair: '#a23d14' },    // teint hâlé, barbe rousse
    roach: { skin: '#7a4a26', hair: '#24160b' }     // brun chitineux
};

// Corps dessinés par race (clé = clé d'ORIGIN_RACES). Forme attendue d'une entrée (validée par tests/regression/crawler-races.js) :
//   { parts: { base, torso, head }, arms: { rest, weapon, ranged, rangedLowered, magic, boxer } (chacun { arm, hand: [x, y], after?, front? }),
//     frontExtent: 12..19, anchors?: { stowedRanged: { x, y, rot, scale }, stowedWeapon: { x, y, rot, scale } }, corpse?: '<svg markup>', tint?: { skin, hair } }
const CRAWLER_RACE_BODIES = {};

function crawlerRaceBody(raceKey) {
    return (raceKey && Object.prototype.hasOwnProperty.call(CRAWLER_RACE_BODIES, raceKey)) ? CRAWLER_RACE_BODIES[raceKey] : null;
}

// Teinte d'une race (null pour l'humain ou une race inconnue) ; un corps dessiné peut porter la sienne (`tint`), sinon aucune teinte.
function crawlerRaceLook(raceKey) {
    const body = crawlerRaceBody(raceKey);
    if (body) return body.tint || null;
    return (raceKey && Object.prototype.hasOwnProperty.call(CRAWLER_RACE_LOOKS, raceKey)) ? CRAWLER_RACE_LOOKS[raceKey] : null;
}

// Remplace la peau et les cheveux du crawler humain dans un fragment SVG (sans effet si `look` est nul).
function tintCrawlerMarkup(markup, look) {
    if (!look || !markup) return markup;
    let out = markup;
    if (look.skin) out = out.split(CRAWLER_SKIN_BASE).join(look.skin);
    if (look.hair) out = out.split(CRAWLER_HAIR_BASE).join(look.hair);
    return out;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CRAWLER_SKIN_BASE, CRAWLER_HAIR_BASE, CRAWLER_RACE_LOOKS, CRAWLER_RACE_BODIES, crawlerRaceBody, crawlerRaceLook, tintCrawlerMarkup };
}
