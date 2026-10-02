// encounters.js — écrans plein écran des entrées en combat (chantier 16, lot 0, voir CHANTIERS.md).
// Catalogue PUR, sans DOM ni gameState (comme origins.js) : types de rencontre (`ENCOUNTER_KINDS`), titres et
// répliques sarcastiques, manifeste des images livrées (`ENCOUNTER_ART`), résolution de l'image d'un mob et
// liste ordonnée des images restant à faire (`encounterArtTargets()`, consigne de Vibe). Le rendu de l'overlay
// (lot 1) et le branchement dans app.js (lot 2) viennent plus tard : rien ici ne change encore le jeu.
//
// Une image = un cadrage d'un mob : `face` (« il t'a vu », le mob nous fixe avec rage) ou `back` (« tu l'as vu »,
// de dos et au loin). Elles vivent dans `assets/mobs/<slug>-<cadrage>.svg` ou `.webp` (portrait 750 x 1334) ; tant qu'un mob
// n'en a pas, l'overlay retombe sur son sprite SVG agrandi (`resolveEncounterArt()` renvoie `fallback: true`).
// Les noms de globales sont préfixés `encounter`/`ENCOUNTER` : tous les catalogues partagent l'espace global.

// Types de rencontre. `view` = cadrage de l'image ; `titles`/`lines` utilisent `{mob}` (nom du mob, remplacé par
// `fillEncounterTemplate()`) ; `accent` = couleur du bandeau (hex) ; `hint` = invite de fermeture (tap obligatoire).
const ENCOUNTER_KINDS = {
    // Le mob vous a repéré (rencontre aléatoire ratée en furtivité, esquive ratée).
    spotted: {
        view: 'face', accent: '#ef4444', hint: 'Toucher pour continuer',
        titles: ["{mob} vous a repéré !", "{mob} vous a vu !", "{mob} n'est pas content de vous voir"],
        lines: [
            "Il a l'air de vous attendre depuis un moment. Pas de chance : vous êtes en retard.",
            "Les négociations ne sont visiblement pas à l'ordre du jour.",
            "Il vous regarde comme un lundi matin regarde un crawler.",
            "Le public retient son souffle. Les paris sont ouverts."
        ]
    },
    // Embuscade de trajet : le mob vous tombe dessus.
    ambush: {
        view: 'face', accent: '#f97316', hint: 'Toucher pour continuer',
        titles: ["Embuscade ! {mob} vous tombe dessus", "{mob} jaillit de nulle part !", "Guet-apens : {mob}"],
        lines: [
            "Le trajet ne s'annonçait pas de tout repos. Il n'a pas menti.",
            "Il ne s'est pas annoncé. La politesse se perd dans ce donjon.",
            "Vous n'aviez pas prévu ce rendez-vous. Lui, si.",
            "Surprise ! La production remercie les caméras d'avoir tenu le plan."
        ]
    },
    // Le mob ne vous a pas vu (rencontre furtive, avant le choix Esquiver / Attaque furtive).
    unseen: {
        view: 'back', accent: '#38bdf8', hint: 'Toucher pour continuer',
        titles: ["Vous apercevez {mob}…", "{mob} ne vous a pas vu", "Là-bas : {mob}, de dos"],
        lines: [
            "Il est occupé. Vous aussi, mais discrètement.",
            "Il vous tourne le dos : c'est une invitation, ou un piège. Probablement les deux.",
            "Il n'a rien remarqué. Savourez ce rare moment d'avantage.",
            "Un silence précieux. Le public chuchote, lui aussi."
        ]
    },
    // Boss de quartier ou gardien d'escalier : arrivée distincte, plus solennelle.
    boss: {
        view: 'face', accent: '#facc15', hint: 'Toucher pour affronter',
        titles: ["{mob}", "{mob} se dresse devant vous", "Combat de boss : {mob}"],
        lines: [
            "La musique de l'émission monte d'un cran. Les sponsors se frottent les mains.",
            "Il a vu passer beaucoup de crawlers. Il en a gardé les os.",
            "Le public a parié contre vous. Faites-lui changer d'avis.",
            "La production vous rappelle que la sortie est de l'autre côté de lui."
        ]
    },
    // Chasseur de primes gobelin (chantier 3) : affiche RECHERCHÉ.
    hunter: {
        view: 'face', accent: '#a3e635', hint: 'Toucher pour continuer',
        titles: ["RECHERCHÉ : {mob}", "{mob} touche sa prime", "{mob} vous a retrouvé"],
        lines: [
            "Votre tête est mise à prix. Elle n'a jamais autant valu.",
            "Il a lu l'affiche. Il a même lu le montant.",
            "Les chasseurs de primes gobelins ne négocient pas. Ils invoicent.",
            "Votre popularité vient de vous rattraper."
        ]
    }
};

// Manifeste des images LIVRÉES : clé = nom exact du mob/boss/chasseur (`baseName`), valeur = cadrages disponibles
// dans `assets/mobs/`, chacun avec son format : 'svg' (illustration vectorielle, ~8-12 Ko) ou 'webp'
// (`true` = 'webp'). À compléter à chaque livraison (jamais avant que le fichier existe : un test le vérifie).
const ENCOUNTER_ART = {
    'Le Chef de Gare Nécrosé': { face: 'svg' },
    'La Mère-Liane': { face: 'svg' },
    'Le Directeur Général (Édition Cauchemar)': { face: 'svg' },
    'Le Boucher Sans Visage': { face: 'svg' },
    'Le Gardien des Mots Perdus': { face: 'svg' },
    'Le Professeur Démentiel': { face: 'svg' },
    'Le Maître des Illusions': { face: 'svg' },
    'Le Roi des Chaussettes Solitaires': { face: 'svg' },
    'Le Baron des Ombres': { face: 'svg' },
    "L'IA Malveillante": { face: 'svg' },
    'Le Gardien du Parking Éternel': { face: 'svg' },
    'Le Grand Requin Gonflable': { face: 'svg' },
    "L'Animateur Vedette Immortel": { face: 'svg' },
    // Mobs (face + dos), dessinés quartier par quartier.
    // Tunnels de Métro Abandonnés
    'Rat Goulot': { face: 'svg', back: 'svg' },
    'Distributeur de Snacks Hanté': { face: 'svg', back: 'svg' },
    'Contrôleur de Billets Zombifié': { face: 'svg', back: 'svg' },
    // Jardins Carnivores
    'Tulipe Géante': { face: 'svg', back: 'svg' },
    'Ronce Étrangleuse': { face: 'svg', back: 'svg' },
    'Gobelin Paysagiste': { face: 'svg', back: 'svg' },
    // Bureaux de l'Administration Pénitentiaire
    'Photocopieuse Carnivore': { face: 'svg', back: 'svg' },
    'Stagiaire Démoniaque': { face: 'svg', back: 'svg' },
    'Garde-Chiourme Bureaucrate': { face: 'svg', back: 'svg' },
};

const ENCOUNTER_ART_DIR = 'assets/mobs/';
const ENCOUNTER_ART_EXT = '.webp'; // extension par défaut (images non livrées, valeur `true` du manifeste)

// Nom -> fichier : minuscules, sans accents, tout caractère non alphanumérique remplacé par « - », tirets en double
// et aux extrémités supprimés (« Le Chef de Gare Nécrosé » -> « le-chef-de-gare-necrose »).
function encounterArtSlug(name) {
    return String(name || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Extension déclarée au manifeste pour un nom et un cadrage : '.svg' si l'entrée vaut 'svg', sinon '.webp' (défaut).
function encounterArtExt(name, view) {
    const entry = ENCOUNTER_ART[name];
    return entry && entry[view] === 'svg' ? '.svg' : ENCOUNTER_ART_EXT;
}

// Chemin relatif de l'image d'un nom et d'un cadrage ('face' | 'back').
function encounterArtPath(name, view) {
    return ENCOUNTER_ART_DIR + encounterArtSlug(name) + '-' + view + encounterArtExt(name, view);
}

// Cadrage d'un type de rencontre ; type inconnu -> 'face'.
function encounterKindView(kind) {
    return (ENCOUNTER_KINDS[kind] || ENCOUNTER_KINDS.spotted).view;
}

// Nom de référence d'un ennemi : `baseName` (posé avant les suffixes de modificateurs et « (intérimaire) »), sinon
// nom exact, sinon plus long nom du manifeste par lequel le nom commence (anciennes sauvegardes) — même convention
// que resolveMobSprite().
function encounterArtName(enemy) {
    if (!enemy) return null;
    if (enemy.baseName) return enemy.baseName;
    const name = enemy.name || '';
    if (ENCOUNTER_ART[name]) return name;
    const known = Object.keys(ENCOUNTER_ART).filter(k => name.indexOf(k) === 0).sort((a, b) => b.length - a.length);
    return known.length ? known[0] : name;
}

// Image à afficher pour un ennemi et un type de rencontre. Renvoie toujours { name, view, src, fallback } :
// `src` est le chemin du WebP si le manifeste le déclare, `null` sinon ; `fallback: true` = utiliser le sprite agrandi.
function resolveEncounterArt(enemy, kind) {
    const name = encounterArtName(enemy);
    const view = encounterKindView(kind);
    const entry = name ? ENCOUNTER_ART[name] : null;
    if (entry && entry[view]) return { name, view, src: encounterArtPath(name, view), fallback: false };
    return { name, view, src: null, fallback: true };
}

// Type de rencontre réel d'un ennemi : un boss garde 'boss' et un chasseur de primes 'hunter' quel que soit le type
// demandé par l'appelant (embuscade, rencontre repérée…) ; sinon le type demandé s'il existe, 'spotted' par défaut.
function resolveEncounterKind(enemy, requested) {
    if (enemy && enemy.isBoss) return 'boss';
    if (enemy && enemy.isBountyHunter) return 'hunter';
    return ENCOUNTER_KINDS[requested] && requested !== 'boss' && requested !== 'hunter' ? requested : 'spotted';
}

// Remplace {mob} par le nom du mob.
function fillEncounterTemplate(text, mobName) {
    return String(text).replace(/\{mob\}/g, mobName || 'Quelque chose');
}

// Titre et réplique d'une rencontre (hasard injectable, `rng` -> [0, 1[ ; défaut Math.random). Type inconnu -> 'spotted'.
function pickEncounterText(kind, mobName, rng) {
    const def = ENCOUNTER_KINDS[kind] || ENCOUNTER_KINDS.spotted;
    const r = typeof rng === 'function' ? rng : Math.random;
    const pick = (list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
    return {
        title: fillEncounterTemplate(pick(def.titles), mobName),
        line: fillEncounterTemplate(pick(def.lines), mobName),
        accent: def.accent,
        hint: def.hint,
        view: def.view
    };
}

// Liste ORDONNÉE de toutes les images à faire (consigne de Vibe, lot 5) : d'abord les 13 boss (`face`), puis les 3
// chasseurs de primes (`face`), puis les mobs de `baseMobs` du plus puissant au plus faible (puissance de base =
// PV x ATQ, DEF en bonus), chacun en `face` puis `back`. `done` = déjà dans le manifeste. Lit les globales de
// bestiary.js ; sans elles, liste vide.
function encounterArtTargets() {
    const targets = [];
    const push = (name, kind, views) => {
        const entry = ENCOUNTER_ART[name] || {};
        views.forEach(view => targets.push({ name, kind, view, slug: encounterArtSlug(name), path: encounterArtPath(name, view), done: !!entry[view] }));
    };
    if (typeof districtBosses !== 'undefined') Object.values(districtBosses).forEach(b => push(b.name, 'boss', ['face']));
    if (typeof bountyHunters !== 'undefined') bountyHunters.forEach(h => push(h.name, 'hunter', ['face']));
    if (typeof baseMobs !== 'undefined') {
        const power = (m) => m.hp * m.atk * (1 + m.def / 20);
        baseMobs.slice().sort((a, b) => power(b) - power(a) || a.name.localeCompare(b.name)).forEach(m => push(m.name, 'mob', ['face', 'back']));
    }
    return targets;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENCOUNTER_KINDS, ENCOUNTER_ART, encounterArtSlug, encounterArtExt, encounterArtPath, encounterKindView, encounterArtName, resolveEncounterArt, resolveEncounterKind, fillEncounterTemplate, pickEncounterText, encounterArtTargets };
}
