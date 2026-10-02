// encounters.js — tests régression : chantier 16, lot 0 (catalogue pur des écrans de rencontre : types, textes,
// manifeste des images, résolution, liste ordonnée des images à faire). Voir encounters.js et CHANTIERS.md (chantier 16).
const fs = require('fs');
const path = require('path');
const { assert, resetTransientState, withEncounterIntro } = require('./_helpers.js');

const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };

// --- Types de rencontre ---
{
    const kinds = Object.keys(ENCOUNTER_KINDS);
    assert(['spotted', 'ambush', 'unseen', 'boss', 'hunter'].every(k => kinds.includes(k)) && kinds.length === 5, "Encounters : les 5 types de rencontre existent");
    kinds.forEach(k => {
        const d = ENCOUNTER_KINDS[k];
        assert((d.view === 'face' || d.view === 'back') && /^#[0-9a-f]{6}$/i.test(d.accent) && d.hint, `Type ${k} : cadrage, couleur d'accent et invite de fermeture`);
        assert(d.titles.length >= 3 && d.lines.length >= 3, `Type ${k} : au moins 3 titres et 3 répliques`);
        assert(d.titles.every(t => t.includes('{mob}')) || k === 'boss', `Type ${k} : tous les titres citent le mob`);
        assert([...d.titles, ...d.lines].every(t => typeof t === 'string' && t.length > 0), `Type ${k} : textes non vides`);
    });
    assert(ENCOUNTER_KINDS.unseen.view === 'back' && kinds.filter(k => k !== 'unseen').every(k => ENCOUNTER_KINDS[k].view === 'face'), "Seule « tu l'as vu » (unseen) est de dos");
    assert(encounterKindView('unseen') === 'back' && encounterKindView('inconnu') === 'face', "encounterKindView() : cadrage du type, 'face' par défaut");
}

// --- Slugs et chemins ---
{
    assert(encounterArtSlug("Le Chef de Gare Nécrosé") === 'le-chef-de-gare-necrose', "Slug : minuscules, sans accents");
    assert(encounterArtSlug("L'IA Malveillante") === 'l-ia-malveillante', "Slug : apostrophe -> tiret");
    assert(encounterArtSlug("Le Directeur Général (Édition Cauchemar)") === 'le-directeur-general-edition-cauchemar', "Slug : parenthèses, tirets en double et extrémités supprimés");
    assert(encounterArtSlug("Maître-Nageur Zombifié") === 'maitre-nageur-zombifie' && encounterArtSlug("Cône de Chantier Fou") === 'cone-de-chantier-fou', "Slug : tiret existant et accents");
    assert(encounterArtSlug(null) === '' && encounterArtSlug(undefined) === '', "Slug : entrée vide -> chaîne vide");
    assert(encounterArtPath("Rat Goulot", 'back') === 'assets/mobs/rat-goulot-back.webp', "encounterArtPath() : dossier, slug, cadrage, extension");
}

// --- Cibles à produire ---
{
    const targets = encounterArtTargets();
    const bosses = Object.values(districtBosses), mobs = baseMobs;
    assert(targets.length === bosses.length + bountyHunters.length + mobs.length * 2, "Cibles : 1 plan par boss et chasseur, 2 par mob");
    const slugs = [...new Set([...bosses.map(b => b.name), ...bountyHunters.map(h => h.name), ...mobs.map(m => m.name)].map(encounterArtSlug))];
    assert(slugs.length === bosses.length + bountyHunters.length + mobs.length, "Aucun slug en double entre boss, chasseurs et mobs (sinon deux mobs écraseraient la même image)");
    const paths = targets.map(t => t.path);
    assert(new Set(paths).size === paths.length && paths.every(p => /^assets\/mobs\/[a-z0-9-]+-(face|back)\.(webp|svg)$/.test(p)), "Cibles : chemins uniques et bien formés");
    assert(targets.slice(0, bosses.length).every(t => t.kind === 'boss' && t.view === 'face'), "Ordre : les 13 boss d'abord, en face");
    assert(targets.slice(bosses.length, bosses.length + bountyHunters.length).every(t => t.kind === 'hunter'), "Ordre : puis les chasseurs de primes");
    const mobTargets = targets.filter(t => t.kind === 'mob');
    const power = (name) => { const m = mobs.find(x => x.name === name); return m.hp * m.atk * (1 + m.def / 20); };
    const firstFaces = mobTargets.filter(t => t.view === 'face').map(t => power(t.name));
    assert(firstFaces.every((p, i) => i === 0 || firstFaces[i - 1] >= p), "Ordre : mobs du plus puissant au plus faible");
    assert(mobTargets.every((t, i) => i % 2 === 0 ? t.view === 'face' : (t.view === 'back' && t.name === mobTargets[i - 1].name)), "Chaque mob : face puis dos");
    assert(targets.every(t => t.kind === 'boss' || t.kind === 'hunter' || t.kind === 'mob') && targets.every(t => typeof t.done === 'boolean'), "Cibles : type et état « fait » renseignés");
}

// --- Manifeste : cohérence avec les mobs et les fichiers ---
{
    const known = new Set([...Object.values(districtBosses).map(b => b.name), ...bountyHunters.map(h => h.name), ...baseMobs.map(m => m.name)]);
    Object.entries(ENCOUNTER_ART).forEach(([name, views]) => {
        assert(known.has(name), `Manifeste : « ${name} » est un vrai mob, boss ou chasseur`);
        Object.entries(views).forEach(([view, ok]) => {
            assert((view === 'face' || view === 'back') && (ok === true || ok === 'webp' || ok === 'svg'), `Manifeste : « ${name} » ${view} bien formé`);
            assert(fs.existsSync(path.join(__dirname, '..', '..', encounterArtPath(name, view))), `Manifeste : le fichier ${encounterArtPath(name, view)} existe`);
        });
    });
    // Tout fichier de assets/mobs/ doit être déclaré (sinon il serait livré sans jamais s'afficher).
    const dir = path.join(__dirname, '..', '..', 'assets', 'mobs');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.webp') || f.endsWith('.svg')) : [];
    const declared = new Set();
    Object.entries(ENCOUNTER_ART).forEach(([name, views]) => Object.keys(views).forEach(v => declared.add(encounterArtPath(name, v).replace('assets/mobs/', ''))));
    assert(files.every(f => declared.has(f)), "Chaque image de assets/mobs/ est déclarée dans ENCOUNTER_ART");
}

// --- Résolution de l'image ---
{
    const saved = ENCOUNTER_ART['Rat Goulot'], savedBoss = ENCOUNTER_ART['Le Chef de Gare Nécrosé'];
    try {
        const none = resolveEncounterArt({ name: 'Rat Goulot Enflammé', baseName: 'Rat Goulot' }, 'spotted');
        assert(none.fallback === true && none.src === null && none.name === 'Rat Goulot' && none.view === 'face', "Sans image au manifeste : repli sur le sprite, nom de référence = baseName");
        ENCOUNTER_ART['Rat Goulot'] = { face: true };
        const face = resolveEncounterArt({ name: 'Enragé Rat Goulot Enflammé', baseName: 'Rat Goulot' }, 'ambush');
        assert(!face.fallback && face.src === 'assets/mobs/rat-goulot-face.webp', "Image face déclarée : chemin du WebP");
        const back = resolveEncounterArt({ name: 'Rat Goulot', baseName: 'Rat Goulot' }, 'unseen');
        assert(back.fallback === true && back.view === 'back' && back.src === null, "Cadrage dos non livré : repli, même si la face existe");
        ENCOUNTER_ART['Rat Goulot'] = { face: true, back: true };
        assert(resolveEncounterArt({ baseName: 'Rat Goulot' }, 'unseen').src === 'assets/mobs/rat-goulot-back.webp', "Dos livré : chemin du WebP de dos");
        const old = resolveEncounterArt({ name: 'Rat Goulot Enflammé' }, 'spotted');
        assert(old.name === 'Rat Goulot' && old.src === 'assets/mobs/rat-goulot-face.webp', "Ancienne sauvegarde sans baseName : plus long nom connu en préfixe");
        ENCOUNTER_ART['Le Chef de Gare Nécrosé'] = { face: true };
        assert(resolveEncounterArt({ name: 'Le Chef de Gare Nécrosé (intérimaire)', baseName: 'Le Chef de Gare Nécrosé' }, 'boss').src === 'assets/mobs/le-chef-de-gare-necrose-face.webp', "Boss intérimaire : image du boss d'origine");
        assert(resolveEncounterArt(null, 'spotted').fallback === true && resolveEncounterArt({}, 'inconnu').fallback === true, "Ennemi absent ou type inconnu : repli, jamais d'exception");
    } finally {
        if (saved) ENCOUNTER_ART['Rat Goulot'] = saved; else delete ENCOUNTER_ART['Rat Goulot'];
        if (savedBoss) ENCOUNTER_ART['Le Chef de Gare Nécrosé'] = savedBoss; else delete ENCOUNTER_ART['Le Chef de Gare Nécrosé'];
    }
}

// --- Textes ---
{
    assert(fillEncounterTemplate("{mob} vous a vu, {mob} !", 'Rat') === "Rat vous a vu, Rat !" && fillEncounterTemplate("{mob}", '') === 'Quelque chose', "fillEncounterTemplate() : toutes les occurrences, repli sans nom");
    const t = pickEncounterText('spotted', 'Rat Goulot', seq([0]));
    assert(t.title === "Rat Goulot vous a repéré !" && t.line === ENCOUNTER_KINDS.spotted.lines[0] && t.view === 'face' && t.accent === ENCOUNTER_KINDS.spotted.accent, "pickEncounterText() : tirage 0 = premier titre et première réplique");
    const last = pickEncounterText('hunter', 'Gobelin', seq([0.9999999]));
    assert(last.title === ENCOUNTER_KINDS.hunter.titles[2].replace('{mob}', 'Gobelin') && last.line === ENCOUNTER_KINDS.hunter.lines[3], "pickEncounterText() : tirage proche de 1 = dernier élément, sans dépassement");
    assert(pickEncounterText('inconnu', 'X', seq([0])).title === "X vous a repéré !" && pickEncounterText('unseen', 'X').view === 'back', "pickEncounterText() : type inconnu -> spotted, hasard par défaut");
    const seen = new Set(); for (let i = 0; i < 50; i++) seen.add(pickEncounterText('boss', 'B', seq([i / 50])).line);
    assert(seen.size === ENCOUNTER_KINDS.boss.lines.length, "pickEncounterText() : toutes les répliques sont atteignables");
}

// --- Lot 1 : scène de repli (sprite agrandi sur le décor), purement géométrique ---
{
    const enemies = [
        ...baseMobs.map(m => ({ ...m, baseName: m.name })),
        ...Object.values(districtBosses).map(b => ({ ...b, baseName: b.name, isBoss: true }))
    ];
    let ok = true, why = '';
    for (const e of enemies) {
        const sprite = resolveMobSprite(e, { aura: true });
        for (const kind of Object.keys(ENCOUNTER_KINDS)) {
            const spec = encounterSceneSpec(kind, sprite, !!e.isBoss);
            const half = Math.max(MOB_EXTENT, sprite.bounds ? Math.max(Math.abs(sprite.bounds[0]), Math.abs(sprite.bounds[1])) : 0) * spec.scale;
            const topY = spec.y - spec.height;
            const maxH = spec.view === 'back' ? ENCOUNTER_MOB_HEIGHT.back : (e.isBoss ? ENCOUNTER_MOB_HEIGHT.boss : ENCOUNTER_MOB_HEIGHT.face);
            if (!(spec.scale > 0 && isFinite(spec.scale))) { ok = false; why = `${e.name}/${kind} échelle`; }
            else if (spec.x - half < -0.01 || spec.x + half > ENCOUNTER_VIEW.w + 0.01) { ok = false; why = `${e.name}/${kind} déborde en largeur`; }
            else if (topY < 0) { ok = false; why = `${e.name}/${kind} déborde en haut`; }
            else if (spec.height > maxH + 0.5) { ok = false; why = `${e.name}/${kind} trop grand`; }
            else if (spec.y > ENCOUNTER_VIEW.h * 0.78) { ok = false; why = `${e.name}/${kind} sous le bandeau`; }
            if (!ok) break;
        }
        if (!ok) break;
    }
    assert(ok, `Scène de rencontre : chaque mob et boss tient dans le cadre portrait, au-dessus du bandeau${why ? ' (' + why + ')' : ''}`);
    const rat = { ...baseMobs[0], baseName: baseMobs[0].name }, sp = resolveMobSprite(rat, { aura: true });
    const face = encounterSceneSpec('spotted', sp, false), back = encounterSceneSpec('unseen', sp, false), boss = encounterSceneSpec('boss', sp, true);
    assert(face.view === 'face' && !face.flip && face.glow && face.y === ENCOUNTER_FACE_GROUND_Y, "Cadrage face : mob de face, halo d'accent, pieds au premier plan");
    assert(back.view === 'back' && back.flip && !back.glow && back.y < face.y && back.height < face.height, "Cadrage dos : mob retourné, sans halo, plus loin et plus petit");
    assert(boss.height > face.height - 0.5 || boss.scale <= face.scale + 1e-9, "Boss : au moins aussi imposant qu'un mob (sauf limite de largeur)");
    assert(encounterSceneSpec('inconnu', sp, false).view === 'face' && encounterSceneSpec('spotted', null, false).scale > 0, "Type inconnu -> face ; sprite absent -> échelle valide");
}

{
    const mob = { ...baseMobs[0], baseName: baseMobs[0].name, effect: 'burn' };
    const boss = { ...Object.values(districtBosses)[0], baseName: Object.values(districtBosses)[0].name, isBoss: true };
    const faceSvg = composeEncounterScene('spotted', mob, 'Tunnels de Métro Abandonnés', 'xbd');
    const backSvg = composeEncounterScene('unseen', mob, 'Tunnels de Métro Abandonnés', 'xbd');
    const bossSvg = composeEncounterScene('boss', boss, 'Jardins Carnivores', 'xbd');
    assert(!/NaN|undefined/.test(faceSvg + backSvg + bossSvg), "Scène de rencontre : aucun NaN ni undefined dans le SVG");
    assert(faceSvg.includes('class="enc-glow"') && !backSvg.includes('class="enc-glow"'), "Halo d'accent seulement de face");
    assert(/scale\(-[\d.]+ [\d.]+\)/.test(backSvg) && !/scale\(-[\d.]+ [\d.]+\)/.test(faceSvg.replace(/scale\(-1 1\)/g, '')), "Mob retourné de dos uniquement");
    assert(bossSvg.includes('translate(0 ' + (resolveMobSprite(boss, { aura: true }).top - 2) + ')'), "Boss : couronne posée au-dessus du sprite");
    assert(faceSvg.includes('xbd-enc-vig') && faceSvg.includes('url(#xbd-'), "Identifiants préfixés par scène (jamais ceux du combat 'cbd' ni de l'exploration 'ebd')");
    assert(composeEncounterScene('spotted', mob, 'Quartier inconnu', 'xbd').length > 500, "Quartier inconnu : décor par défaut");
}

// --- Lot 1 : ouverture / fermeture de l'overlay ---
{
    resetTransientState();
    let calls = 0;
    const enemy = { ...baseMobs[0], baseName: baseMobs[0].name };
    // Sans interface (tests Node, pas de requestAnimationFrame) : callback immédiat, rien d'ouvert.
    assert(typeof requestAnimationFrame !== 'function', "Prérequis : pas de requestAnimationFrame sous Node");
    assert(showEncounterIntro('spotted', enemy, () => calls++) === false && calls === 1 && !gameState.encounterIntroPending, "Sans interface : callback appelé tout de suite, aucun blocage");
    assert(showEncounterIntro('spotted', null, () => calls++) === false && calls === 2, "Ennemi absent : callback appelé, jamais d'exception");

    const realNow = Date.now;
    let now = 1000000;
    Date.now = () => now;
    global.requestAnimationFrame = (fn) => 0;
    config.encounterIntro.enabled = true;
    try {
        assert(showEncounterIntro('spotted', enemy, () => calls++) === true && gameState.encounterIntroPending === true, "Avec interface : l'écran s'ouvre et bloque");
        assert(isActionBlocked(), "L'écran ouvert bloque les actions (isActionBlocked)");
        assert(!ui.encounterOverlay.classList.contains('hidden') && ui.encounterTitle.innerText.includes(enemy.name), "Overlay visible, titre au nom du mob");
        assert(dismissEncounterIntro() === false && gameState.encounterIntroPending && calls === 2, "Tap trop tôt (résiduel) : ignoré");
        now += ENCOUNTER_INTRO_MIN_MS + 1;
        assert(dismissEncounterIntro() === true && !gameState.encounterIntroPending && calls === 3, "Tap après le délai : ferme et appelle le callback une fois");
        assert(ui.encounterOverlay.classList.contains('hidden') && !isActionBlocked(), "Overlay masqué, actions débloquées");
        assert(dismissEncounterIntro(true) === false && calls === 3, "Une seconde fermeture ne rappelle pas le callback");
        showEncounterIntro('boss', Object.assign({}, Object.values(districtBosses)[0], { isBoss: true }), () => calls++);
        assert(dismissEncounterIntro(true) === true && calls === 4, "Fermeture forcée (clavier/test) sans attendre le délai");
        // Un reset des tests ne laisse jamais l'état bloqué.
        showEncounterIntro('unseen', enemy, () => calls++);
        resetTransientState();
        assert(gameState.encounterIntroPending === false && !isActionBlocked(), "resetTransientState() lève le blocage");
        dismissEncounterIntro(true);
        assert(calls === 4, "Callback d'un écran abandonné par un reset jamais rappelé");
        // Image déclarée : posée sur l'<img> ; non déclarée : cachée.
        ENCOUNTER_ART['Rat Goulot'] = { face: true };
        showEncounterIntro('spotted', { ...enemy, name: 'Rat Goulot', baseName: 'Rat Goulot' }, null);
        assert(ui.encounterImg.src === 'assets/mobs/rat-goulot-face.webp', "Image du manifeste chargée dans l'overlay");
        dismissEncounterIntro(true);
        delete ENCOUNTER_ART['Rat Goulot'];
        showEncounterIntro('spotted', enemy, null);
        assert(ui.encounterImg.classList.contains('hidden'), "Sans image au manifeste : <img> masquée, sprite de repli visible");
        dismissEncounterIntro(true);
    } finally {
        Date.now = realNow;
        config.encounterIntro.enabled = false;
        delete global.requestAnimationFrame;
        delete ENCOUNTER_ART['Rat Goulot'];
        resetTransientState();
    }
}

// --- Images SVG livrées par Vibe (format 'svg' du manifeste) ---
{
    const fsx = require('fs'), pathx = require('path');
    const delivered = Object.entries(ENCOUNTER_ART).filter(([, v]) => v.face === 'svg').map(([n]) => n);
    assert(delivered.length === Object.values(districtBosses).length && Object.values(districtBosses).every(b => delivered.includes(b.name)), "Manifeste : les 13 boss sont livrés en SVG");
    assert(encounterArtPath('Le Boucher Sans Visage', 'face') === 'assets/mobs/le-boucher-sans-visage-face.svg' && encounterArtExt('Rat Goulot', 'face') === '.webp', "encounterArtPath() : extension .svg selon le manifeste, .webp par défaut");
    const boss = { name: 'Le Boucher Sans Visage (intérimaire)', baseName: 'Le Boucher Sans Visage', isBoss: true };
    const art = resolveEncounterArt(boss, 'boss');
    assert(!art.fallback && art.src === 'assets/mobs/le-boucher-sans-visage-face.svg', "resolveEncounterArt() : chemin du SVG livré");
    assert(resolveEncounterArt(boss, 'unseen').fallback === true, "Boss livré en face seulement : le dos retombe sur le sprite");
    assert(encounterArtTargets().filter(t => t.done).length === 13 && encounterArtTargets().filter(t => t.kind === 'boss').every(t => t.done), "Cibles : les 13 boss sont marqués faits, aucun mob");
    delivered.forEach(n => {
        const f = fsx.readFileSync(pathx.join(__dirname, '..', '..', encounterArtPath(n, 'face')), 'utf8');
        assert(/<svg[^>]+width="750"[^>]+height="1334"[^>]+viewBox="0 0 750 1334"/.test(f), `SVG « ${n} » : portrait 750 x 1334`);
        assert(!/<text|<script|<image|href=|onload|onclick/i.test(f), `SVG « ${n} » : aucun texte, script, image externe ni gestionnaire`);
        assert(/^[\x00-\x7F]*$/.test((f.match(/\b(?:id|url\(#)[^"')]*/g) || []).join('')), `SVG « ${n} » : identifiants ASCII`);
        assert(f.length < 20000, `SVG « ${n} » : léger (< 20 Ko)`);
    });
}

// --- Lot 2 : branchement dans les entrées en combat ---
{
    const mob = { ...baseMobs[0], baseName: baseMobs[0].name, hp: 30, atk: 3, def: 1, xpReward: 1 };
    const boss = { ...Object.values(districtBosses)[0], baseName: Object.values(districtBosses)[0].name, isBoss: true, hp: 99, atk: 5, def: 1, xpReward: 1 };
    const hunter = { name: 'Gobelin Pisteur de Primes', baseName: 'Gobelin Pisteur de Primes', isBountyHunter: true, hp: 30, atk: 3, def: 1, xpReward: 1 };
    assert(resolveEncounterKind(boss, 'ambush') === 'boss' && resolveEncounterKind(hunter, 'ambush') === 'hunter', "resolveEncounterKind() : un boss reste 'boss', un chasseur 'hunter', même en embuscade");
    assert(resolveEncounterKind(mob, 'ambush') === 'ambush' && resolveEncounterKind(mob) === 'spotted' && resolveEncounterKind(mob, 'inconnu') === 'spotted' && resolveEncounterKind(mob, 'boss') === 'spotted', "resolveEncounterKind() : type demandé, 'spotted' par défaut, jamais 'boss'/'hunter' pour un mob ordinaire");

    // Sans interface : le combat démarre tout de suite (comportement d'avant).
    resetTransientState();
    initiateCombat(mob);
    assert(gameState.inCombat && gameState.currentEnemy === mob && !gameState.encounterIntroPending, "Sans interface : initiateCombat() démarre le combat immédiatement");

    const realNow = Date.now; let now = 5000000; Date.now = () => now;
    global.requestAnimationFrame = () => 0;
    config.encounterIntro.enabled = true;
    try {
        // Rencontre repérée : l'écran s'ouvre d'abord, le combat ne démarre qu'au tap.
        resetTransientState();
        initiateCombat(mob);
        assert(gameState.encounterIntroPending && !gameState.inCombat && gameState.currentEnemy === null, "Avec interface : l'écran précède le combat (rien ne démarre avant le tap)");
        assert(isActionBlocked() && ui.encounterTitle.innerText.includes(mob.name) && ui.encounterHint.innerText === ENCOUNTER_KINDS.spotted.hint, "Écran « il t'a vu » : actions bloquées, titre au nom du mob");
        now += ENCOUNTER_INTRO_MIN_MS + 1;
        dismissEncounterIntro();
        assert(!gameState.encounterIntroPending && gameState.inCombat && gameState.currentEnemy === mob, "Au tap : le combat démarre avec l'ennemi annoncé");
        resetTransientState();

        // Embuscade de trajet.
        initiateCombat(mob, { intro: 'ambush' });
        assert(ui.encounterTitle.innerText.includes('Embuscade') || ui.encounterTitle.innerText.includes('jaillit') || ui.encounterTitle.innerText.includes('Guet-apens'), "Embuscade : titre d'embuscade");
        dismissEncounterIntro(true); resetTransientState();

        // Boss et chasseur : leur type l'emporte.
        initiateCombat(boss, { intro: 'ambush' });
        assert(ui.encounterTitle.innerText.includes(boss.name) && ui.encounterHint.innerText.includes('affronter'), "Boss : écran d'arrivée de boss, même demandé en embuscade");
        dismissEncounterIntro(true); resetTransientState();
        initiateCombat(hunter);
        assert(ui.encounterTitle.innerText.includes('RECHERCHÉ') || ui.encounterTitle.innerText.includes('prime') || ui.encounterTitle.innerText.includes('retrouvé'), "Chasseur de primes : écran dédié");
        dismissEncounterIntro(true); resetTransientState();

        // Aucun écran : combat enchaîné, compagnon hostile, attaque furtive.
        initiateCombat(mob, { intro: false });
        assert(gameState.inCombat && !gameState.encounterIntroPending, "{ intro: false } : combat immédiat, aucun écran");
        resetTransientState();

        // Rencontre furtive : l'écran « tu l'as vu » précède les boutons Esquiver / Attaque furtive.
        const savedRandom = Math.random;
        Math.random = () => 0.0; // détecté = faux : 0 < chance de furtivité
        try {
            handleStealthEncounter();
        } finally { Math.random = savedRandom; }
        if (gameState.stealthChoicePending) {
            assert(gameState.encounterIntroPending && ui.stealthChoiceZone.classList.contains('hidden'), "Furtif non repéré : l'écran précède les boutons (zone encore masquée)");
            assert(ui.encounterHint.innerText.length > 0 && ui.encounterTitle.innerText.length > 0, "Écran « tu l'as vu » renseigné");
            dismissEncounterIntro(true);
            assert(!ui.stealthChoiceZone.classList.contains('hidden') && gameState.stealthChoicePending, "Au tap : les boutons Esquiver / Attaque furtive apparaissent");
            attemptStealthAttack();
            assert(gameState.inCombat && !gameState.encounterIntroPending && ui.encounterOverlay.classList.contains('hidden'), "Attaque furtive : combat direct, sans second écran");
        }
        resetTransientState();

        // Boss en cache : l'écran n'est montré que la première fois.
        const room = { id: 'r-test', type: 'boss', bossInstance: boss, guardsStairs: false };
        gameState.floorMap = gameState.floorMap || {};
        delete boss._encounterShown;
        triggerBossEncounter(room);
        assert(gameState.encounterIntroPending && ui.bossChoiceZone.classList.contains('hidden'), "Arrivée d'un boss : écran d'abord, choix Combattre / Repérer ensuite");
        dismissEncounterIntro(true);
        assert(!ui.bossChoiceZone.classList.contains('hidden') && gameState.bossChoicePending, "Au tap : le choix de boss apparaît");
        resetTransientState();
        triggerBossEncounter(room);
        assert(!gameState.encounterIntroPending && !ui.bossChoiceZone.classList.contains('hidden'), "Retour devant le même boss : pas de second écran");
    } finally {
        Date.now = realNow;
        config.encounterIntro.enabled = false;
        delete global.requestAnimationFrame;
        resetTransientState();
    }
    // Interrupteur global : désactivé, l'écran n'apparaît jamais, même avec une interface.
    global.requestAnimationFrame = () => 0;
    try {
        config.encounterIntro.enabled = false;
        resetTransientState();
        initiateCombat(mob);
        assert(gameState.inCombat && !gameState.encounterIntroPending, "config.encounterIntro.enabled = false : aucun écran, même avec une interface");
    } finally { delete global.requestAnimationFrame; resetTransientState(); }
}
