// sounds.js — tests régression : chantier 8, lot 0 (catalogue ZzFX, lecture par playSfx(), coupure du son et de la
// voix du présentateur, boutons 🔊/🎙️, page d'écoute). Voir sounds.js et CHANTIERS.md (chantier 8).
const { assert, resetTransientState, withEncounterIntro } = require('./_helpers.js');

// Faux AudioContext (graphe Web Audio enregistré, sans son) : chaque nœud, chaque départ/arrêt et chaque automatisation
// de paramètre est noté ; une rampe exponentielle vers 0 ou moins est notée comme erreur (refusée par les navigateurs).
function makeFakeAudioContextClass(stats) {
    return class FakeAudioContext {
        constructor() { this.state = 'running'; this.destination = { connect() {} }; this.sampleRate = 8000; this.currentTime = stats.now || 0; stats.contexts++; }
        _param(value = 0) {
            return {
                value,
                setValueAtTime(v) { this.value = v; },
                linearRampToValueAtTime(v) { this.value = v; },
                exponentialRampToValueAtTime(v) { if (!(v > 0)) stats.badRamps++; this.value = v; }
            };
        }
        _node(extra = {}) {
            return Object.assign({ context: this, connect() {}, disconnect() {} }, extra);
        }
        _source(kind) {
            return this._node({
                kind,
                start(at) { stats.started++; stats.starts.push(at === undefined ? 0 : at); },
                stop(at) { stats.stops.push(at); }
            });
        }
        createBuffer(channels, length) { const data = new Float32Array(length); stats.lastLength = length; return { length, getChannelData: () => data }; }
        createBufferSource() { return Object.assign(this._source('buffer'), { buffer: null, loop: false }); }
        createOscillator() { return Object.assign(this._source('osc'), { type: 'sine', frequency: this._param(440), detune: this._param(0) }); }
        createGain() { return this._node({ gain: this._param(1) }); }
        createBiquadFilter() { return this._node({ type: 'lowpass', frequency: this._param(350), Q: this._param(1) }); }
        createDelay() { return this._node({ delayTime: this._param(0) }); }
        createDynamicsCompressor() { return this._node({}); }
    };
}

function withFakeAudio(fn, now = 0) {
    const stats = { contexts: 0, started: 0, lastLength: 0, starts: [], stops: [], badRamps: 0, now };
    global.AudioContext = makeFakeAudioContextClass(stats);
    try { fn(stats); } finally {
        delete global.AudioContext;
        sfxAudioContext = null;
        sfxRecipeBusNode = null;
        sfxQueueEnd = 0;
        setSoundMuted(false);
    }
}

// --- Catalogue ---
{
    const keys = Object.keys(SFX_CATALOG);
    assert(['swordSlash', 'crossbowShot', 'goblinCry', 'goldPickup', 'levelUp'].every(k => keys.includes(k)), "Sons : les 5 sons de l'échantillon validé sont au catalogue");
    keys.forEach(k => {
        const def = SFX_CATALOG[k];
        assert(SFX_GROUPS[def.group] && def.label && def.use, `Son ${k} : groupe connu, nom et usage`);
        if (def.recipe) {
            assert(typeof SFX_RECIPES[k] === 'function', `Son ${k} : sa recette Web Audio existe`);
            assert(def.duration > .05 && def.duration <= 1.5 && def.level > 0 && def.level <= 4, `Son ${k} : durée courte et niveau raisonnable`);
            return;
        }
        const lists = def.layers ? def.layers.map(([at, params]) => { assert(at >= 0 && at < 1, `Son ${k} : couche qui démarre dans la première seconde`); return params; }) : [def.params];
        lists.forEach(params => assert(Array.isArray(params) && params.length >= 3 && params.length <= 20 && params.every(v => v === undefined || Number.isFinite(v)), `Son ${k} : paramètres ZzFX numériques (20 au plus)`));
        const data = sfxSamples(def);
        const seconds = data.length / SFX_SAMPLE_RATE;
        const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        assert(data.every(Number.isFinite), `Son ${k} : aucun échantillon invalide`);
        assert(seconds > .05 && seconds <= 1.5, `Son ${k} : durée courte (${seconds.toFixed(2)} s)`);
        assert(peak > .1 && peak <= 1, `Son ${k} : volume audible sans saturer (pic ${peak.toFixed(2)})`);
    });
    assert(Object.keys(SFX_RECIPES).every(k => SFX_CATALOG[k] && SFX_CATALOG[k].recipe), "Recettes : aucune recette orpheline, chacune déclarée `recipe` au catalogue");
    const lab = listSfxForLab();
    assert(lab.reduce((n, section) => n + section.sounds.length, 0) === keys.length, "listSfxForLab() : chaque son du catalogue apparaît une fois");
    assert(lab.every(section => section.title && section.sounds.length > 0), "listSfxForLab() : sections titrées, jamais vides");
}

// --- Lecture sans Web Audio (Node) ---
{
    assert(typeof AudioContext === 'undefined' && playSfx('goldPickup') === false && unlockAudio() === false, "playSfx() : sans AudioContext, aucun son et aucune erreur");
    assert(playSfx('inconnu') === false, "playSfx() : un son inconnu ne joue rien");
}

// --- Lecture avec Web Audio ---
withFakeAudio(stats => {
    assert(playSfx('slingStone') === true && stats.started === 1 && stats.lastLength > 0, "playSfx() : un son ZzFX joué avec un AudioContext");
    playSfx('nailGun');
    assert(stats.contexts === 1 && stats.started === 2, "playSfx() : un seul contexte audio réutilisé");
    const before = stats.started;
    assert(playSfx('crossbowShot') === true && stats.started === before + 1, "playSfx() : un son en couches = un seul tampon mélangé");
    const beforeRecipe = stats.started;
    assert(playSfx('goldPickup') === true && stats.started > beforeRecipe && stats.badRamps === 0, "playSfx() : une recette Web Audio jouée");
    setSoundMuted(true);
    const muted = stats.started;
    assert(playSfx('slingStone') === false && playSfx('goldPickup') === false && stats.started === muted, "playSfx() : rien quand le son est coupé");
    assert(playSfx('slingStone', { force: true }) === true && stats.started === muted + 1, "playSfx({ force }) : la page d'écoute joue même son coupé");
});

// --- Recettes Web Audio : chacune se joue sans erreur, dans sa durée ---
Object.keys(SFX_CATALOG).filter(k => SFX_CATALOG[k].recipe).forEach(k => {
    withFakeAudio(stats => {
        let ok = true;
        try { ok = playSfx(k, { force: true }); } catch (e) { ok = false; }
        const t0 = 5;
        const end = t0 + SFX_CATALOG[k].duration + .05;
        assert(ok && stats.started > 0, `Recette ${k} : se joue sans erreur`);
        assert(stats.badRamps === 0, `Recette ${k} : aucune rampe exponentielle vers 0`);
        assert(stats.starts.every(at => at >= t0) && stats.stops.every(at => at <= end), `Recette ${k} : tout démarre à l'heure et s'arrête dans la durée déclarée`);
    }, 5);
});

// --- Préférence de coupure ---
{
    setSoundMuted(false);
    assert(!isSoundMuted(), "Par défaut : sons actifs");
    setSoundMuted(true);
    assert(isSoundMuted() && localStorage.getItem(SOUND_MUTE_KEY) === '1', "Sons coupés : préférence mémorisée");
    soundMutedValue = null; // relecture depuis le stockage (nouvelle page)
    assert(isSoundMuted(), "Préférence relue depuis le stockage au rechargement");
    setSoundMuted(false);
    assert(typeof speakAnnouncer === 'undefined' && typeof setVoiceMuted === 'undefined' && !ui.btnVoiceToggle, "Voix de synthèse retirée : plus de présentateur parlé ni de bouton 🎙️");
}

// --- Bouton 🔊 ---
{
    setSoundMuted(false);
    updateSoundToggleButtons();
    assert(ui.btnSoundToggle.innerText === '🔊' && ui.btnSoundToggle.getAttribute('aria-pressed') === 'false', "Bouton son : 🔊 quand le son est actif");
    toggleSoundMuted();
    assert(isSoundMuted() && ui.btnSoundToggle.innerText === '🔇' && ui.btnSoundToggle.getAttribute('aria-pressed') === 'true', "Bouton son : coupe et passe à 🔇");
    toggleSoundMuted();
    assert(!isSoundMuted() && ui.btnSoundToggle.innerText === '🔊', "Bouton son : remet le son");
}

// --- Page d'écoute ---
withFakeAudio(stats => {
    openSoundLab();
    assert(!ui.soundLabOverlay.classList.contains('hidden'), "Page d'écoute : s'ouvre");
    const html = ui.soundLabList.innerHTML;
    assert(Object.keys(SFX_CATALOG).every(k => html.includes(`data-sfx="${k}"`)), "Page d'écoute : un bouton par son du catalogue");
    setSoundMuted(true);
    const button = { getAttribute: () => 'goblinCry' };
    ui.soundLabList.dispatch('click', { target: { closest: () => button } });
    assert(stats.started > 0, "Page d'écoute : toucher un son le joue, même son coupé");
    closeSoundLab();
    assert(ui.soundLabOverlay.classList.contains('hidden'), "Page d'écoute : se referme");
});

// --- Lot 1 : couverture du catalogue de combat ---
{
    const has = key => !!SFX_CATALOG[key];
    const swingStyles = [...new Set(Object.values(MELEE_SWING_STYLES))];
    assert(swingStyles.every(style => has(SFX_MELEE_STYLES[style])), "Sons de combat : chaque style de coup de mêlée a son son");
    const projectiles = [...new Set(Object.values(RANGED_PROJECTILES))];
    assert(projectiles.every(p => has(SFX_PROJECTILES[p])), "Sons de combat : chaque projectile d'arme à distance a son son");
    const spellStyles = [...new Set(Object.values(FX_SPELLS).map(fx => fx.style))];
    assert(spellStyles.every(style => has(SFX_SPELL_STYLES[style])), "Sons de combat : chaque école de sort a son son");
    assert(Object.keys(MOB_ATTACK_STYLES).every(arch => has(SFX_MOB_CRIES[arch])), "Sons de combat : chaque archétype de mob a son cri");
    const mapped = [...Object.values(SFX_MELEE_STYLES), ...Object.values(SFX_PROJECTILES), ...Object.values(SFX_SPELL_STYLES), ...Object.values(SFX_MOB_CRIES)];
    assert(mapped.every(has), "Sons de combat : toute correspondance pointe vers un son du catalogue");
    assert(['unarmedPunch', 'spellBackfire', 'heavyImpact', 'playerHurt', 'mobDeath', 'bossDeath'].every(has), "Sons de combat : mains nues, sort raté, coup lourd, crawler touché, mob et boss vaincus");
    assert(new Set(Object.values(SFX_MOB_CRIES)).size === Object.keys(SFX_MOB_CRIES).length, "Sons de combat : un cri distinct par archétype");

    assert(playerAttackSfxKey({ type: 'melee', style: 'thrust' }) === 'thrustStab' && playerAttackSfxKey({ type: 'ranged', projectile: 'bolt' }) === 'crossbowShot', "playerAttackSfxKey() : mêlée par style, distance par projectile");
    assert(playerAttackSfxKey({ type: 'magic', style: 'sky' }) === 'spellSky' && playerAttackSfxKey({ type: 'unarmed' }) === 'unarmedPunch' && playerAttackSfxKey(null) === 'unarmedPunch', "playerAttackSfxKey() : sort par école, mains nues par défaut");
    assert(mobAttackSfxKey({ visualArchetype: 'blob' }) === 'blobSquelch' && mobAttackSfxKey({ visualArchetype: 'inconnu' }) === 'goblinCry' && mobAttackSfxKey(null) === 'goblinCry', "mobAttackSfxKey() : cri de l'archétype, gobelinoïde par défaut");
}

// --- Lot 1 : branchements (playSfx espionné) ---
{
    const realPlay = playSfx;
    const played = [];
    global.playSfx = key => { played.push(key); return true; };
    const savedEq = gameState.equipment, savedHp = gameState.hp;
    try {
        gameState.equipment = Object.assign({}, savedEq, { weapon: null, ranged: null, spell: null });
        let impacted = false;
        playPlayerAttackFx('unarmed', {}, () => { impacted = true; });
        assert(played[0] === 'unarmedPunch' && impacted, "Attaque à mains nues : son joué, impact appelé");

        played.length = 0;
        gameState.hp = 50;
        playMobAttackFx({ visualArchetype: 'zombie', name: 'Test' }, { heldPlayerHp: 60 }, () => {});
        assert(played.join(',') === 'zombieGroan,playerHurt', "Coup de mob encaissé : cri de l'archétype puis « touché »");

        played.length = 0;
        playMobAttackFx({ visualArchetype: 'zombie', name: 'Test' }, { heldPlayerHp: 50 }, () => {});
        assert(played.join(',') === 'zombieGroan', "Coup de mob sans perte de PV : le cri seul");

        played.length = 0;
        playMobAttackFx({ visualArchetype: 'zombie', name: 'Test' }, { fast: true, heldPlayerHp: 60 }, () => {});
        assert(played.join(',') === 'playerHurt', "Multi-coups : pas de cri à chaque frappe");

        played.length = 0;
        playSpellBackfireFx();
        triggerHeavyImpact();
        assert(played.join(',') === 'spellBackfire,heavyImpact', "Sort raté et coup lourd : leur son");
    } finally {
        global.playSfx = realPlay;
        gameState.equipment = savedEq;
        gameState.hp = savedHp;
    }
}

// --- Lot 1 : victoire (mob vaincu / boss vaincu) ---
{
    const realPlay = playSfx;
    const played = [];
    global.playSfx = key => { played.push(key); return true; };
    try {
        resetTransientState();
        gameState.currentFloor = 2;
        const mob = generateMob(gameState.currentDistrict || Object.keys(districts)[0]);
        initiateCombat(mob, { intro: false });
        mob.hp = 0;
        played.length = 0;
        winCombat();
        assert(played.includes('mobDeath') && !played.includes('bossDeath'), "Victoire contre un mob : son « mob vaincu »");

        resetTransientState();
        const boss = generateBoss(gameState.currentDistrict || Object.keys(districts)[0]);
        initiateCombat(boss, { intro: false });
        boss.hp = 0;
        played.length = 0;
        winCombat();
        assert(played.includes('bossDeath') && !played.includes('mobDeath'), "Victoire contre un boss : son « boss vaincu »");
    } finally {
        global.playSfx = realPlay;
        resetTransientState();
    }
}

// --- Lot 2 : catalogue des événements ---
{
    const has = key => !!SFX_CATALOG[key];
    const lot2 = ['goldPickup', 'itemPickup', 'shopBuy', 'potionDrink', 'levelUp', 'skillUp', 'achievementUnlock', 'minigamePerfect', 'minigameSuccess',
        'minigameFail', 'trapSpring', 'fleeEscape', 'restSleep', 'encounterSting', 'bossSting', 'stairsDescend', 'gameOverDirge', 'victoryFanfare'];
    assert(lot2.every(has), "Sons d'événements : butin, progression, mini-jeux, exploration et grands moments au catalogue");
    assert(MINIGAME_OUTCOMES.every(o => has(SFX_MINIGAME_OUTCOMES[o])), "Sons d'événements : chaque issue de mini-jeu a son son");
    assert(lot2.every(k => SFX_QUEUED_GROUPS.includes(SFX_CATALOG[k].group)), "Sons d'événements : tous mis en file");
    assert(['melee', 'ranged', 'spell', 'mob', 'impact'].every(g => !SFX_QUEUED_GROUPS.includes(g)), "Sons de combat : jamais mis en file");
    assert(sfxQueuedStart(5, 3) === 5 && sfxQueuedStart(5, 5.3) === 5.3, "sfxQueuedStart() : tout de suite si la file est libre, sinon après le précédent");
}

// --- Lot 2 : file d'attente des événements ---
withFakeAudio(stats => {
    const firstStart = (key) => { const from = stats.starts.length; playSfx(key); return Math.min(...stats.starts.slice(from)); };
    sfxQueueEnd = 0;
    const death = firstStart('mobDeath'), level = firstStart('levelUp'), item = firstStart('itemPickup'), slash = firstStart('slingStone');
    assert(death >= 10 && death < 10.01 && level >= 10 && level < 10.01, "File : le combat et le premier événement partent tout de suite");
    assert(item >= 10 + SFX_QUEUE_MAX_GAP && item < 10 + SFX_QUEUE_MAX_GAP + .01, "File : l'événement suivant attend le précédent (au plus SFX_QUEUE_MAX_GAP)");
    assert(slash === 10, "File : un son de combat n'attend jamais la file");
    const forced = (() => { const from = stats.starts.length; playSfx('goldPickup', { force: true }); return Math.min(...stats.starts.slice(from)); })();
    assert(forced < 10.01, "File : la page d'écoute joue tout de suite");
}, 10);

// --- Lot 2 : branchements (playSfx espionné) ---
{
    const realPlay = playSfx;
    const played = [];
    global.playSfx = key => { played.push(key); return true; };
    const take = () => { const out = played.slice(); played.length = 0; return out; };
    try {
        resetTransientState();
        gameState.gold = 0;
        gameState.inventory = [{ name: 'Potion Test', category: 'consumables', heal: 10, baseValue: 10 }];
        sellItem(0);
        assert(take().includes('goldPickup'), "Revente : son des pièces");

        gameState.inventory = [{ name: 'Potion Test', category: 'consumables', heal: 10, baseValue: 10 }];
        useConsumable(0);
        assert(take().includes('potionDrink'), "Potion bue : son de la potion");

        storeLootItem({ name: 'Potion Test', category: 'consumables', heal: 10, baseValue: 10 });
        assert(take().includes('itemPickup'), "Objet obtenu : son du butin");

        gameState.hp = gameState.maxHp;
        springTrap({ dmgMin: 1, dmgMax: 1, text: 'Un piège de test.' });
        assert(take().includes('trapSpring'), "Piège : son du piège");

        gameState.xp = 0;
        gainXp(gameState.xpToNextLevel * 3);
        assert(take().filter(k => k === 'levelUp').length === 1, "Plusieurs niveaux d'un coup : un seul arpège");
        gainXp(1);
        assert(!take().includes('levelUp'), "Gain d'XP sans niveau : pas d'arpège");

        const skill = gameState.skills.weapon;
        gainSkillXp('weapon', skill.xpToNext - skill.xp);
        assert(take().includes('skillUp'), "Compétence améliorée : son du carillon");

        showAchievementToast([{ icon: '🏆', title: 'Test' }]);
        assert(take().includes('achievementUnlock'), "Succès débloqué : son du ta-da");

        const spec = { kind: 'timing', icon: '🎯', label: 'Test' };
        settleMinigame(spec, 'perfect', {}, () => {});
        settleMinigame(spec, 'fail', {}, () => {});
        assert(take().filter(k => k.startsWith('minigame')).join(',') === 'minigamePerfect,minigameFail', "Mini-jeu joué : son de son issue");
        settleMinigame(spec, 'success', { auto: true }, () => {});
        assert(!take().some(k => k.startsWith('minigame')), "Mini-jeu en jet automatique : silence");
    } finally {
        global.playSfx = realPlay;
        resetTransientState();
    }
}

// --- Écran de rencontre : coup de théâtre sonore (accord grave pour boss et chasseurs) ---
{
    const realPlay = playSfx;
    const played = [];
    global.playSfx = key => { played.push(key); return true; };
    global.requestAnimationFrame = () => 0;
    try {
        resetTransientState();
        const enemy = generateMob(gameState.currentDistrict || Object.keys(districts)[0]);
        withEncounterIntro(() => {
            assert(showEncounterIntro('spotted', enemy, null) === true && played.includes('encounterSting'), "Rencontre : coup de théâtre sonore");
            dismissEncounterIntro(true);
            played.length = 0;
            showEncounterIntro('boss', Object.assign({}, Object.values(districtBosses)[0], { isBoss: true }), null);
            assert(played.includes('bossSting'), "Arrivée d'un boss : accord grave");
            dismissEncounterIntro(true);
        });
    } finally {
        global.playSfx = realPlay;
        delete global.requestAnimationFrame;
        resetTransientState();
    }
}

// --- Chantier 17, lot 8 : les 11 sons de Gorgoth le Concierge (contrat partagé) ---
{
    const expected = ['demonRoar', 'demonWhip', 'demonBlaze', 'demonAct', 'demonChainBreak', 'demonPossession',
        'demonHeartbeat', 'demonCataclysm', 'demonKnockout', 'demonGateOpen', 'demonKeyGet'];
    assert(Array.isArray(DEMON_SFX_KEYS) && DEMON_SFX_KEYS.length === 11 && expected.every(k => DEMON_SFX_KEYS.includes(k)), "Gorgoth : DEMON_SFX_KEYS liste les 11 clés du contrat");
    assert(DEMON_SFX_KEYS.every(k => SFX_CATALOG[k] && SFX_CATALOG[k].recipe && typeof SFX_RECIPES[k] === 'function'), "Gorgoth : chaque son est au catalogue, en recette Web Audio");
    const groups = { demonRoar: 'mob', demonWhip: 'mob', demonBlaze: 'mob', demonAct: 'event', demonChainBreak: 'impact', demonPossession: 'event',
        demonHeartbeat: 'world', demonCataclysm: 'impact', demonKnockout: 'event', demonGateOpen: 'world', demonKeyGet: 'event' };
    assert(DEMON_SFX_KEYS.every(k => SFX_CATALOG[k].group === groups[k]), "Gorgoth : chaque son dans le groupe du contrat (file d'attente des événements respectée)");
    assert(SFX_CATALOG.demonHeartbeat.duration <= 1, "Gorgoth : un battement de cœur dure au plus 1 s");
    const lab = listSfxForLab();
    const section = lab.find(s => s.group === 'gorgoth');
    assert(section && section.title === SFX_LAB_SECTIONS.gorgoth && section.sounds.map(s => s.key).join(',') === DEMON_SFX_KEYS.join(','), "Page d'écoute : les sons de Gorgoth regroupés dans leur section, dans l'ordre du contrat");
    assert(lab.filter(s => s.group !== 'gorgoth').every(s => s.sounds.every(e => !DEMON_SFX_KEYS.includes(e.key))), "Page d'écoute : un son de Gorgoth n'apparaît pas aussi dans son groupe");
    assert(playSfx('demonInconnu') === false, "playSfx() : une clé démoniaque inconnue est un no-op silencieux");
    withFakeAudio(stats => {
        assert(DEMON_SFX_KEYS.every(k => playSfx(k, { force: true }) === true) && stats.badRamps === 0, "Gorgoth : les 11 sons se jouent avec Web Audio, sans rampe vers 0");
        assert(playSfx('demonInconnu', { force: true }) === false, "playSfx() : clé inconnue, rien même forcé");
    });
}
