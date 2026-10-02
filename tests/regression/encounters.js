// encounters.js — tests régression : chantier 16, lot 0 (catalogue pur des écrans de rencontre : types, textes,
// manifeste des images, résolution, liste ordonnée des images à faire). Voir encounters.js et CHANTIERS.md (chantier 16).
const fs = require('fs');
const path = require('path');
const { assert } = require('./_helpers.js');

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
    assert(new Set(paths).size === paths.length && paths.every(p => /^assets\/mobs\/[a-z0-9-]+-(face|back)\.webp$/.test(p)), "Cibles : chemins uniques et bien formés");
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
            assert((view === 'face' || view === 'back') && ok === true, `Manifeste : « ${name} » ${view} bien formé`);
            assert(fs.existsSync(path.join(__dirname, '..', '..', encounterArtPath(name, view))), `Manifeste : le fichier ${encounterArtPath(name, view)} existe`);
        });
    });
    // Tout fichier de assets/mobs/ doit être déclaré (sinon il serait livré sans jamais s'afficher).
    const dir = path.join(__dirname, '..', '..', 'assets', 'mobs');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.webp')) : [];
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
