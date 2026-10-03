// sounds.js — tests régression : chantier 8, lot 0 (catalogue ZzFX, lecture par playSfx(), coupure du son et de la
// voix du présentateur, boutons 🔊/🎙️, page d'écoute). Voir sounds.js et CHANTIERS.md (chantier 8).
const { assert } = require('./_helpers.js');

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
