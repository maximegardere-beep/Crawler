// sounds.js — tests régression : chantier 8, lot 0 (catalogue ZzFX, lecture par playSfx(), coupure du son et de la
// voix du présentateur, boutons 🔊/🎙️, page d'écoute). Voir sounds.js et CHANTIERS.md (chantier 8).
const { assert, resetTransientState } = require('./_helpers.js');

// Faux AudioContext minimal : compte les contextes créés et les sons lancés.
function withFakeAudio(fn) {
    const stats = { contexts: 0, started: 0, lastLength: 0 };
    global.AudioContext = class {
        constructor() { this.state = 'running'; this.destination = {}; stats.contexts++; }
        createBuffer(channels, length) { const data = new Float32Array(length); stats.lastLength = length; return { getChannelData: () => data }; }
        createBufferSource() { return { connect() {}, start() { stats.started++; } }; }
    };
    try { fn(stats); } finally {
        delete global.AudioContext;
        sfxAudioContext = null;
        setSoundMuted(false);
        setVoiceMuted(false);
    }
}

// --- Catalogue ---
{
    const keys = Object.keys(SFX_CATALOG);
    assert(['swordSlash', 'crossbowShot', 'goblinCry', 'goldPickup', 'levelUp'].every(k => keys.includes(k)), "Sons : les 5 sons de l'échantillon validé sont au catalogue");
    keys.forEach(k => {
        const def = SFX_CATALOG[k];
        assert(SFX_GROUPS[def.group] && def.label && def.use, `Son ${k} : groupe connu, nom et usage`);
        assert(Array.isArray(def.params) && def.params.length >= 3 && def.params.length <= 20 && def.params.every(v => v === undefined || Number.isFinite(v)), `Son ${k} : paramètres ZzFX numériques (20 au plus)`);
        const data = zzfxGenerate(...def.params);
        const seconds = data.length / SFX_SAMPLE_RATE;
        const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        assert(data.every(Number.isFinite), `Son ${k} : aucun échantillon invalide`);
        assert(seconds > .05 && seconds <= 1.5, `Son ${k} : durée courte (${seconds.toFixed(2)} s)`);
        assert(peak > .1 && peak <= 1, `Son ${k} : volume audible sans saturer (pic ${peak.toFixed(2)})`);
    });
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
    assert(playSfx('goldPickup') === true && stats.started === 1 && stats.lastLength > 0, "playSfx() : un son joué avec un AudioContext");
    playSfx('levelUp');
    assert(stats.contexts === 1 && stats.started === 2, "playSfx() : un seul contexte audio réutilisé");
    setSoundMuted(true);
    assert(playSfx('goldPickup') === false && stats.started === 2, "playSfx() : rien quand le son est coupé");
    assert(playSfx('goldPickup', { force: true }) === true && stats.started === 3, "playSfx({ force }) : la page d'écoute joue même son coupé");
});

// --- Préférences de coupure ---
{
    let cancels = 0;
    global.speechSynthesis = { cancel() { cancels++; } };
    setSoundMuted(false); setVoiceMuted(false);
    assert(!isSoundMuted() && !isVoiceMuted() && announcerVoiceEnabled(), "Par défaut : sons et voix actifs");
    setVoiceMuted(true);
    assert(isVoiceMuted() && !isSoundMuted() && !announcerVoiceEnabled() && cancels === 1, "Voix coupée seule : les sons restent, la voix en cours s'arrête");
    assert(localStorage.getItem(VOICE_MUTE_KEY) === '1', "Voix coupée : préférence mémorisée");
    setVoiceMuted(false); setSoundMuted(true);
    assert(!announcerVoiceEnabled() && cancels === 2, "Sons coupés : la voix se tait aussi");
    assert(localStorage.getItem(SOUND_MUTE_KEY) === '1', "Sons coupés : préférence mémorisée");
    soundMutedValue = null; voiceMutedValue = null; // relecture depuis le stockage (nouvelle page)
    assert(isSoundMuted() && !isVoiceMuted(), "Préférences relues depuis le stockage au rechargement");
    setSoundMuted(false);
    delete global.speechSynthesis;
    stopAnnouncerVoice();
    assert(true, "stopAnnouncerVoice() : sans speechSynthesis, aucune erreur");
}

// --- Boutons 🔊 / 🎙️ ---
{
    setSoundMuted(false); setVoiceMuted(false);
    updateSoundToggleButtons();
    assert(ui.btnSoundToggle.innerText === '🔊' && ui.btnSoundToggle.getAttribute('aria-pressed') === 'false', "Bouton son : 🔊 quand le son est actif");
    toggleSoundMuted();
    assert(isSoundMuted() && ui.btnSoundToggle.innerText === '🔇' && ui.btnSoundToggle.getAttribute('aria-pressed') === 'true', "Bouton son : coupe et passe à 🔇");
    assert(ui.btnVoiceToggle.classList.contains('opacity-40') && ui.btnVoiceToggle.getAttribute('aria-pressed') === 'false', "Bouton voix : estompé quand tout est coupé, sans changer son propre réglage");
    toggleSoundMuted();
    assert(!ui.btnVoiceToggle.classList.contains('opacity-40'), "Bouton voix : de nouveau actif quand le son revient");
    toggleVoiceMuted();
    assert(isVoiceMuted() && !isSoundMuted() && ui.btnVoiceToggle.classList.contains('opacity-40') && ui.btnVoiceToggle.getAttribute('aria-pressed') === 'true', "Bouton voix : coupe la voix seule");
    toggleVoiceMuted();
    assert(!isVoiceMuted(), "Bouton voix : remet la voix");
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
    assert(stats.started === 1, "Page d'écoute : toucher un son le joue, même son coupé");
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
{
    const starts = [];
    global.AudioContext = class {
        constructor() { this.state = 'running'; this.destination = {}; this.currentTime = 10; }
        createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
        createBufferSource() { return { connect() {}, start(at) { starts.push(at); } }; }
    };
    try {
        sfxQueueEnd = 0;
        playSfx('mobDeath'); playSfx('levelUp'); playSfx('itemPickup'); playSfx('swordSlash');
        assert(starts[0] === 10 && starts[1] === 10, "File : le combat et le premier événement partent tout de suite");
        assert(Math.abs(starts[2] - (10 + SFX_QUEUE_MAX_GAP)) < 1e-9, "File : l'événement suivant attend le précédent (au plus SFX_QUEUE_MAX_GAP)");
        assert(starts[3] === 10, "File : un son de combat n'attend jamais la file");
        playSfx('goldPickup', { force: true });
        assert(starts[4] === 10, "File : la page d'écoute joue tout de suite");
    } finally {
        delete global.AudioContext;
        sfxAudioContext = null;
        sfxQueueEnd = 0;
    }
}

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
