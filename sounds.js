// =========================================================================
// SONS (chantier 8, voir CHANTIERS.md) — bruitages synthétisés par ZzFX : aucun fichier audio,
// aucun CDN. Un son = une liste de paramètres ZzFX (catalogue PUR `SFX_CATALOG`), joué par le
// point d'entrée unique `playSfx(key)`. Sans `AudioContext` (tests Node), `playSfx()` ne fait rien
// et renvoie false. Deux préférences d'écoute, jamais sauvegardées avec le crawler (localStorage) :
// tout couper (`isSoundMuted()`) et couper la voix du présentateur seule (`isVoiceMuted()`).
// Chargé après minigames-ui.js, avant app.js (qui branche les boutons et la page d'écoute).
// =========================================================================

// Ordre des paramètres ZzFX : volume, randomness (désaccord à chaque lecture), frequency, attack,
// sustain, release, shape (0 sinus, 1 triangle, 2 dents de scie, 3 tangente, 4 bruit), shapeCurve,
// slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
// sustainVolume, decay, tremolo.
const SFX_GROUPS = {
    combat: 'Combat',
    mob: 'Cris de mobs',
    event: 'Événements'
};

const SFX_CATALOG = {
    swordSlash:   { group: 'combat', label: "Coup d'épée",      use: 'Coup porté avec une arme tranchante.',
                    params: [1.4, .05, 90, 0, .01, .12, 4, 1.2, -1, 0, 0, 0, 0, 4, 40, .1, 0, .6, .02] },
    crossbowShot: { group: 'combat', label: "Tir d'arbalète",   use: 'Carreau qui part : corde qui claque, sifflement.',
                    params: [2, .05, 520, 0, .02, .18, 2, 2.2, -18, 0, 0, 0, 0, .4, 0, 0, .04, .5, .01] },
    goblinCry:    { group: 'mob',    label: 'Cri de gobelin',   use: "Cri d'archétype quand le mob attaque.",
                    params: [1.1, .1, 640, .02, .09, .22, 2, 1.6, -4, 0, 120, .06, 0, .2, 9, 0, 0, .8, .04] },
    goldPickup:   { group: 'event',  label: "Pièces d'or",      use: 'Des PO trouvées en explorant.',
                    params: [1, .02, 1675, 0, .06, .24, 1, 1.82, 0, 0, 837, .06] },
    levelUp:      { group: 'event',  label: 'Montée de niveau', use: 'Arpège joyeux et un peu ironique.',
                    params: [1.8, 0, 392, .02, .28, .35, 1, 1, 0, 0, 131, .07, .36, 0, 0, 0, .08, .7, .02] }
};

const SFX_SAMPLE_RATE = 44100;
const SFX_MASTER_VOLUME = .3;

// ZzFX - Zuper Zmall Zound Zynth - Micro Edition, MIT License, Copyright 2019 Frank Force
// (https://github.com/KilledByAPixel/ZzFX). Génération PURE des échantillons (hors Web Audio,
// testable sous Node) ; seul le paramètre `randomness` fait appel au hasard.
function zzfxGenerate(volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0) {
    const R = SFX_SAMPLE_RATE, PI2 = Math.PI * 2, sign = v => v > 0 ? 1 : -1;
    let startSlide = slide *= 500 * PI2 / R / R,
        startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / R,
        b = [], t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length;
    attack = attack * R + 9; decay *= R; sustain *= R; release *= R; delay *= R;
    deltaSlide *= 500 * PI2 / R ** 3; modulation *= PI2 / R; pitchJump *= PI2 / R; pitchJumpTime *= R; repeatTime = repeatTime * R | 0;
    for (length = attack + decay + sustain + release + delay | 0; i < length; b[i++] = s) {
        if (!(++c % (bitCrush * 100 | 0))) {
            s = shape ? shape > 1 ? shape > 2 ? shape > 3 ? Math.sin((t % PI2) ** 3) : Math.max(Math.min(Math.tan(t), 1), -1) : 1 - (2 * t / PI2 % 2 + 2) % 2 : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) : Math.sin(t);
            s = (repeatTime ? 1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve * volume * SFX_MASTER_VOLUME * (i < attack ? i / attack : i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume) : i < attack + decay + sustain ? sustainVolume : i < length - delay ? (length - i - delay) / release * sustainVolume : 0);
            s = delay ? s / 2 + (delay > i ? 0 : (i < length - delay ? 1 : (length - i) / delay) * b[i - delay | 0] / 2) : s;
        }
        f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
        t += f - f * noise * (1 - (Math.sin(i) + 1) * 1e9 % 2);
        if (j && ++j > pitchJumpTime) { frequency += pitchJump; startFrequency += pitchJump; j = 0; }
        if (repeatTime && !(++r % repeatTime)) { frequency = startFrequency; slide = startSlide; j = j || 1; }
    }
    return b;
}

// --- Préférences d'écoute (réglage joueur, jamais dans gameState) ---
const SOUND_MUTE_KEY = 'crawler_sound_muted';
const VOICE_MUTE_KEY = 'crawler_voice_muted';
let soundMutedValue = null;
let voiceMutedValue = null;

function readAudioPref(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } // stockage indisponible : son actif
}

function writeAudioPref(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* idem */ }
}

function isSoundMuted() {
    if (soundMutedValue === null) soundMutedValue = readAudioPref(SOUND_MUTE_KEY);
    return soundMutedValue;
}

function setSoundMuted(on) {
    soundMutedValue = !!on;
    writeAudioPref(SOUND_MUTE_KEY, soundMutedValue);
    if (soundMutedValue) stopAnnouncerVoice();
}

// La voix du présentateur se tait si elle est coupée OU si tout le son est coupé.
function isVoiceMuted() {
    if (voiceMutedValue === null) voiceMutedValue = readAudioPref(VOICE_MUTE_KEY);
    return voiceMutedValue;
}

function setVoiceMuted(on) {
    voiceMutedValue = !!on;
    writeAudioPref(VOICE_MUTE_KEY, voiceMutedValue);
    if (voiceMutedValue) stopAnnouncerVoice();
}

function announcerVoiceEnabled() {
    return !isSoundMuted() && !isVoiceMuted();
}

function stopAnnouncerVoice() {
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (synth && typeof synth.cancel === 'function') synth.cancel();
}

// --- Lecture (Web Audio) ---
let sfxAudioContext = null;

function sfxAudioContextClass() {
    if (typeof AudioContext === 'function') return AudioContext;
    if (typeof webkitAudioContext === 'function') return webkitAudioContext; // ancien Safari
    return null;
}

// Les navigateurs mobiles n'autorisent le son qu'après un geste du joueur : appelée au premier
// toucher / clavier (voir app.js), elle crée le contexte et le réveille.
function unlockAudio() {
    const Ctx = sfxAudioContextClass();
    if (!Ctx) return false;
    try {
        if (!sfxAudioContext) sfxAudioContext = new Ctx();
        if (sfxAudioContext.state === 'suspended' && typeof sfxAudioContext.resume === 'function') sfxAudioContext.resume();
        return true;
    } catch (e) {
        return false;
    }
}

// Point d'entrée unique de tout bruitage. `force` ignore la coupure (page d'écoute seulement).
function playSfx(key, { force = false } = {}) {
    const def = SFX_CATALOG[key];
    if (!def || (!force && isSoundMuted())) return false;
    if (!unlockAudio()) return false;
    try {
        const data = zzfxGenerate(...def.params);
        const buffer = sfxAudioContext.createBuffer(1, data.length, SFX_SAMPLE_RATE);
        buffer.getChannelData(0).set(data);
        const source = sfxAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(sfxAudioContext.destination);
        source.start();
        return true;
    } catch (e) {
        return false;
    }
}

// Liste ordonnée par groupe pour la page d'écoute (pure).
function listSfxForLab() {
    return Object.keys(SFX_GROUPS).map(group => ({
        group,
        title: SFX_GROUPS[group],
        sounds: Object.keys(SFX_CATALOG).filter(key => SFX_CATALOG[key].group === group)
            .map(key => ({ key, label: SFX_CATALOG[key].label, use: SFX_CATALOG[key].use }))
    })).filter(entry => entry.sounds.length > 0);
}
