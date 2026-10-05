// origins-flavor.js — tests régression : chantier 13, lot 5 (habillage : piques DeathWatch prioritaires à l'arrivée sur l'étage 3, succès et chronique,
// épitaphe par race, effets visuels des capacités sans coup). Voir deathwatch.js, achievements.js, fx.js et NOTES_ORIGINES.md.
const { assert, resetTransientState } = require('./_helpers.js');

const baseCtx = { crawler: 'Carl', etage: 3, fuites: 0, degats: 0, maxHp: 100, pvPct: 100, mobs: 0, pieges: 0, sortsRates: 0, objet: null, compagnon: null, compagnonsPartis: 0,
    prime: 0, or: 50, succes: 0, niveau: 5, mainsNues: 0, parfaits: 0, mises: 0,
    raceKey: null, classKey: null, race: null, classe: null, synergie: null, synergieTitre: null, origineFraiche: false };
const fresh = (over) => Object.assign({}, baseCtx, { origineFraiche: true }, over);
const reachFloor3 = () => {
    resetTransientState();
    gameState.saveEnabled = true; gameState.currentFloor = 2;
    gameState.pendingNextFloorAnomalies = { floor: 3, anomalies: [] };
    advanceToNextFloor();
};
const choose = (race, cls) => {
    reachFloor3();
    gameState.pendingOriginOffers.offers[0].key = race; selectOrigin(race); confirmOriginChoice();
    gameState.pendingOriginOffers.offers[0].key = cls; selectOrigin(cls); confirmOriginChoice();
};

// --- Piques DeathWatch ---
{
    const raceKeys = Object.keys(ORIGIN_RACES), classKeys = Object.keys(ORIGIN_CLASSES);
    raceKeys.forEach(k => assert(SHOW_TAUNTS.some(t => t.id === `race_${k}` && t.theme === 'originRace' && t.priority === 2), `Une pique dédiée à la race ${k}`));
    classKeys.forEach(k => assert(SHOW_TAUNTS.some(t => t.id === `class_${k.toLowerCase()}` && t.theme === 'originClass' && t.priority === 2), `Une pique dédiée à la classe ${k}`));
    ORIGIN_SYNERGIES.forEach(sy => assert(SHOW_TAUNTS.some(t => t.theme === 'originSynergy' && t.priority === 3 && t.when(fresh({ synergie: `${sy.race}+${sy.cls}` }))), `Une pique dédiée à la synergie ${sy.race}+${sy.cls}`));
    assert(['originRace', 'originClass', 'originSynergy'].every(th => ['polite', 'retort', 'provoke', 'insult'].every(tone => (SHOW_REPLIES[th][tone] || []).length >= 2)), "Les 3 thèmes d'origine ont deux répliques pour chacun des 4 tons");

    // Priorité : l'origine passe avant les autres piques, la synergie avant la race et la classe.
    const hasPriority = (t) => (t.priority || 0) > 0;
    const ctxRace = fresh({ raceKey: 'goblin', classKey: 'brawler', race: 'Gobelin', classe: 'Bagarreur', fuites: 9, degats: 500 });
    for (let i = 0; i < 40; i++) {
        const t = pickShowTaunt(ctxRace, () => i / 40);
        assert(hasPriority(t) && t.priority === 2 && ['originRace', 'originClass'].includes(t.theme), "Origine fraîche : la pique d'origine passe avant les fuites et les dégâts");
    }
    const kinds = new Set(Array.from({ length: 40 }, (_, i) => pickShowTaunt(ctxRace, () => i / 40).theme));
    assert(kinds.has('originRace') && kinds.has('originClass'), "Race et classe se partagent le tirage");
    const syn = pickShowTaunt(fresh({ raceKey: 'troll', classKey: 'brawler', race: 'Troll', classe: 'Bagarreur', synergie: 'troll+brawler', synergieTitre: 'Cadre supérieur du pugilat' }), () => 0);
    assert(syn.theme === 'originSynergy' && syn.id === 'syn_troll_brawler', "Synergie : sa pique passe avant celles de la race et de la classe");
    assert(pickShowTaunt({ ...ctxRace, origineFraiche: false }, () => 0).id === 'flee3' || !hasPriority(pickShowTaunt({ ...ctxRace, origineFraiche: false }, () => 0)), "Pas d'origine fraîche : les piques habituelles reviennent");
    assert(!hasPriority(pickShowTaunt({ ...baseCtx, fuites: 5 }, () => 0)), "Sans race ni classe : aucune pique d'origine");
    assert(pickShowTaunt({ ...baseCtx, fuites: 5 }, () => 0).id === 'flee1', "Le comportement sans priorité est inchangé (fuites)");

    // Tous les trous sont fournis.
    const ctxFull = fresh({ raceKey: 'goblin', classKey: 'trickster', race: 'Gobelin', classe: 'Filou', synergie: 'goblin+trickster', synergieTitre: 'Roi des caniveaux' });
    assert(SHOW_TAUNTS.filter(t => t.theme.startsWith('origin')).every(t => !/\{\{/.test(fillShowTemplate(t.text, ctxFull))), "Piques d'origine : tous les trous remplis");
    assert(['originRace', 'originClass', 'originSynergy'].every(th => Object.values(SHOW_REPLIES[th]).every(lines => lines.every(l => !/\{\{/.test(fillShowTemplate(l, ctxFull))))), "Répliques d'origine : tous les trous remplis");
}

// --- Contexte et émission réelle à l'étage 3 ---
{
    resetTransientState();
    let ctx = buildShowContext({});
    assert(ctx.raceKey === null && ctx.origineFraiche === false && ctx.synergie === null, "Sans origine : contexte vide");
    applyRace('troll'); gameState.crawlerClass = 'brawler'; gameState.currentFloor = 3;
    ctx = buildShowContext({});
    assert(ctx.race === 'Troll' && ctx.classe === 'Bagarreur' && ctx.synergie === 'troll+brawler' && ctx.synergieTitre === "Cadre supérieur du pugilat" && ctx.origineFraiche === true, "Contexte d'origine : race, classe, synergie, fraîcheur");
    gameState.currentFloor = 4;
    assert(buildShowContext({}).origineFraiche === false, "À l'étage 4 : l'origine n'est plus « fraîche »");
    resetTransientState();

    choose('troll', 'brawler');
    assert(gameState.showChoicePending === true && gameState.pendingShow.tauntId === 'syn_troll_brawler', "Choix Troll + Bagarreur : l'émission s'ouvre sur la pique de la synergie");
    assert(gameState.pendingShow.text.includes("Cadre supérieur du pugilat") && !/\{\{/.test(gameState.pendingShow.text), "La pique cite le titre de la synergie");
    assert(Object.values(gameState.pendingShow.replies).every(r => r && !/\{\{/.test(r)), "Les 4 répliques sont remplies");
    answerShow('refuse');
    choose('ghoul', 'duelist');
    assert(/^(race_ghoul|class_duelist)$/.test(gameState.pendingShow.tauntId), "Goule + Duelliste : pique de la race ou de la classe");
    answerShow('refuse');
    resetTransientState();
}

// --- Succès et chronique ---
{
    resetTransientState(); gameState.saveEnabled = true; gameState.playerName = 'Succès';
    assert(createEmptyRunStats().classAbilities === 0 && createEmptyRunStats().lastStands === 0 && normalizeRunStats({ kills: 3 }).synergyAbilities === 0, "Chronique : nouveaux compteurs à 0, y compris sur une ancienne chronique");
    ['origin_chosen', 'ability_first', 'ability_10', 'ability_boss', 'synergy_used', 'last_stand'].forEach(id => assert(!!getAchievementById(id) && getAchievementById(id).check, `Succès ${id} au catalogue`));
    assert(!getAchievementById('last_stand').secret && ACHIEVEMENTS.filter(a => a.tier === 'gold').length === 7, "Aucun nouveau succès Or ni secret côté origines : les paliers existants sont inchangés (7 Or avec celui de Gorgoth, chantier 17)");
    assert(!gameState.achievements.origin_chosen, "(contrôle) rien de débloqué au départ");
    choose('elf', 'occultist');
    answerShow('refuse');
    assert(!!gameState.achievements.origin_chosen, "Race et classe choisies : « Pièce d'identité »");
    const spell = generateTestKitSpell(); gameState.equipment.spell = spell;
    gameState.inCombat = false; gameState.currentEnemy = null;
    initiateCombat({ name: 'Cobaye', hp: 99999, maxHp: 99999, atk: 1, def: 0, status: {}, effect: null });
    useClassAbility();
    assert(gameState.runStats.classAbilities === 1 && gameState.runStats.synergyAbilities === 1 && gameState.runStats.classAbilityBossUses === 0, "Capacité jouée avec la synergie Elfe + Occultiste : comptée, hors boss");
    assert(!!gameState.achievements.ability_first && !!gameState.achievements.synergy_used && !gameState.achievements.ability_boss, "« Coup spécial » et « Combo de salon » débloqués, pas « Spécial devant le patron »");
    gameState.inCombat = false; gameState.currentEnemy = null;
    initiateCombat({ name: 'Boss', isBoss: true, hp: 99999, maxHp: 99999, atk: 1, def: 0, status: {}, effect: null });
    useClassAbility();
    assert(gameState.runStats.classAbilityBossUses === 1 && !!gameState.achievements.ability_boss, "Capacité jouée face à un boss : « Spécial devant le patron »");
    assert(gameState.runStats.classAbilities === 2 && !gameState.achievements.ability_10, "Deux capacités jouées : « Numéro de cirque » pas encore");
    gameState.runStats.classAbilities = 9;
    recordRunEvent('classAbility', {});
    assert(!!gameState.achievements.ability_10, "Dix capacités jouées : « Numéro de cirque »");

    resetTransientState(); gameState.saveEnabled = true; gameState.currentFloor = 3; applyRace('roach');
    gameState.hp = 10; applyPlayerDamage(50);
    assert(gameState.hp === 1 && gameState.runStats.lastStands === 1 && !!gameState.achievements.last_stand, "Increvable consommé : compté, « Increvable, vraiment » débloqué");
    resetTransientState();
}

// --- Épitaphe ---
{
    resetTransientState();
    const without = generateEpitaph({ cause: 'combat', enemyName: 'Rat' });
    Object.keys(ORIGIN_RACES).forEach(k => assert(typeof EPITAPH_RACE_MENTIONS[k] === 'string' && EPITAPH_RACE_MENTIONS[k].length > 20, `Mention d'épitaphe pour la race ${k}`));
    assert(!Object.values(EPITAPH_RACE_MENTIONS).some(m => without.includes(m)), "Sans race : aucune mention de race");
    applyRace('roach');
    const withRace = generateEpitaph({ cause: 'trap' });
    assert(withRace.includes(EPITAPH_RACE_MENTIONS.roach), "Avec une race : sa mention est ajoutée à l'épitaphe");
    resetTransientState();
}

// --- Effets visuels des capacités sans coup ---
{
    ['occultist', 'trickster', 'punchingBag'].forEach(k => {
        const spec = classAbilityFxSpec(k);
        assert(spec && spec.style === 'self' && /^#[0-9a-f]{6}$/i.test(spec.color) && typeof FX_IMPACTS[spec.impact] === 'function', `Capacité ${k} : effet « self » avec une couleur et un éclat existants`);
    });
    assert(['brawler', 'duelist', 'gunslinger'].every(k => classAbilityFxSpec(k) === null), "Les capacités qui frappent n'ont pas d'effet propre (celui de leur attaque)");
    const colors = ['occultist', 'trickster', 'punchingBag'].map(k => classAbilityFxSpec(k).color);
    assert(new Set(colors).size === 3, "Trois couleurs distinctes");
    playClassAbilityFx('trickster'); playClassAbilityFx('brawler'); playClassAbilityFx('inconnue');
    assert(true, "Sans animation (tests Node) : aucun effet, aucune erreur");
}
