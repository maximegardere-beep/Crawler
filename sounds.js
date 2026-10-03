// =========================================================================
// SONS (chantier 8, voir CHANTIERS.md) — bruitages synthétisés par ZzFX : aucun fichier audio,
// aucun CDN. Un son = une liste de paramètres ZzFX (catalogue PUR `SFX_CATALOG`), joué par le
// point d'entrée unique `playSfx(key)`. Sans `AudioContext` (tests Node), `playSfx()` ne fait rien
// et renvoie false. Deux préférences d'écoute, jamais sauvegardées avec le crawler (localStorage) :
// tout couper (`isSoundMuted()`) et couper la voix du présentateur seule (`isVoiceMuted()`).
// Chargé après minigames-ui.js, avant sounds-recipes.js (recettes Web Audio) et app.js (boutons, page d'écoute).
// =========================================================================

// Ordre des paramètres ZzFX : volume, randomness (désaccord à chaque lecture), frequency, attack,
// sustain, release, shape (0 sinus, 1 triangle, 2 dents de scie, 3 tangente, 4 bruit), shapeCurve,
// slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
// sustainVolume, decay, tremolo.
const SFX_GROUPS = {
    melee: 'Armes de mêlée',
    ranged: 'Armes à distance',
    spell: 'Sorts',
    mob: 'Cris de mobs',
    impact: 'Impacts et fins de combat',
    event: 'Butin et progression',
    world: 'Exploration et grands moments'
};
// Groupes mis en file (lot 2) : plusieurs événements le même instant (victoire + niveau + butin) s'enchaînent
// au lieu de se superposer ; les sons de combat partent toujours tout de suite.
const SFX_QUEUED_GROUPS = ['event', 'world'];
const SFX_QUEUE_MAX_GAP = .35; // secondes au plus entre deux sons de la file

// Trois façons de fabriquer un son, sans aucun fichier :
//   sfx()     — une liste de paramètres ZzFX (rendu « 8-bit ») ;
//   layered() — plusieurs couches ZzFX décalées dans le temps : [[départ en s, paramètres], …] ;
//   recipe()  — une recette Web Audio (SFX_RECIPES, sounds-recipes.js, même clé), avec sa durée en secondes et son
//               niveau (multiplicateur, égalisé par mesure sur l'énergie moyenne des sons ZzFX).
const sfx = (group, label, use, params) => ({ group, label, use, params });
const layered = (group, label, use, layers) => ({ group, label, use, layers });
const recipe = (group, label, use, duration, level = 1) => ({ group, label, use, recipe: true, duration, level });

const SFX_CATALOG = {
    // Armes de mêlée : un son par style de coup (MELEE_SWING_STYLES, sprites/fx.js) + mains nues.
    swordSlash:   recipe('melee', "Coup d'épée", 'Arme tranchante (épée, hache, katana…).', 0.8, 1.05),
    bluntSmash:   recipe('melee', 'Coup contondant', 'Arme lourde (masse, pied-de-biche, marteau…).', 0.45, 0.76),
    thrustStab:   recipe('melee', 'Estoc', 'Arme qui pique (couteau, lance, tronçonneuse…).', 0.25, 1.14),
    unarmedPunch: recipe('melee', 'Coup de poing', 'Attaque à mains nues.', 0.25, 0.84),
    // Armes à distance : un son par projectile (RANGED_PROJECTILES, sprites/fx.js).
    slingStone:   sfx('ranged', 'Lance-pierre', 'Caillou qui part en sifflant.', [1, .1, 250, .01, .03, .1, 0, 1, -6, 0, 0, 0, 0, 3, 0, 0, 0, .5, 0]),
    bowShot:      sfx('ranged', "Tir à l'arc", 'Corde qui vibre, flèche qui file.', [1.4, .05, 300, 0, .02, .2, 2, 1.5, -6, 0, 0, 0, 0, 0, 15, 0, 0, .6, .02]),
    crossbowShot: layered('ranged', "Tir d'arbalète", 'Carreau : corde qui claque, sifflement.', [[0, [1.2, .05, 900, 0, .005, .03, 4, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, .5, 0]], [.01, [1.4, .05, 140, 0, .03, .25, 2, 1.5, -1, 0, 0, 0, 0, 0, 9, 0, 0, .6, .02]], [.05, [.6, .05, 1400, .02, .05, .15, 0, 1, -8, 0, 0, 0, 0, 6, 0, 0, 0, .4, 0]]]),
    nailGun:      sfx('ranged', 'Pistolet à clous', 'Deux clous en rafale.', [2.3, .05, 900, 0, .01, .04, 4, 1, -10, 0, 0, 0, .06, 1, 0, .1, 0, .4, 0]),
    shotgunBlast: sfx('ranged', 'Fusil', 'Détonation et plombs.', [2, .05, 80, 0, .04, .35, 4, 1.5, -.4, 0, 0, 0, 0, 5, 0, .3, 0, .6, .05]),
    blowDart:     sfx('ranged', 'Sarbacane', 'Pfft discret.', [1.6, .1, 600, 0, .01, .06, 0, 1, -4, 0, 0, 0, 0, 8, 0, 0, 0, .3, 0]),
    waterJet:     sfx('ranged', "Jet d'eau", "Pistolet à eau ou à bulles.", [1.5, .05, 200, .02, .25, .15, 0, 1, 0, 0, 0, 0, .04, 6, 0, 0, 0, .5, 0, .5]),
    confettiPop:  sfx('ranged', 'Confettis', 'Pop festif et pétillant.', [2.4, .05, 500, 0, .02, .12, 1, 1, 10, 0, 700, .04, 0, .5, 0, 0, .03, .6, 0]),
    stampThrow:   sfx('ranged', 'Tampon', 'Tampon encreur lancé : tchac.', [1.4, .05, 140, 0, .02, .1, 2, 1, -2, 0, 0, 0, 0, .5, 0, .1, 0, .5, 0]),
    pulseBeam:    sfx('ranged', "Canon à impulsions", 'Rayon laser.', [1.2, 0, 1100, 0, .06, .2, 2, 1, -30, 0, 0, 0, 0, 0, 20, 0, 0, .7, 0]),
    // Sorts : un son par école d'effet (style de FX_SPELLS, sprites/fx.js) + sort raté.
    spellZap:     recipe('spell', 'Éclair', 'Arc électrique (Éclair, Ampoule…).', 0.4, 2.22),
    spellPunch:   sfx('spell', 'Poing magique', 'Poing de glace ou de force.', [1.3, .05, 400, 0, .04, .12, 1, 1, -8, 0, 300, .03, 0, 0, 0, 0, 0, .6, 0]),
    spellCone:    recipe('spell', 'Souffle', 'Jet de flammes ou de terreur.', 0.6, 2.09),
    spellArc:     sfx('spell', 'Lame spectrale', 'Lame fantomatique en arc.', [1.8, .05, 700, .02, .12, .25, 0, 1, -3, 0, 0, 0, 0, 0, 6, 0, .05, .6, 0]),
    spellSky:     recipe('spell', 'Foudre', 'Éclair qui tombe du plafond.', 1.45, 1),
    spellBolt:    recipe('spell', 'Projectile magique', 'Orbe, éclat de glace, essaim.', 0.35, 1.45),
    spellMeteor:  sfx('spell', 'Météore', 'Boule de feu qui s\'écrase.', [1.8, .05, 400, .05, .15, .5, 4, 1.2, -6, 0, 0, 0, 0, 3, 0, .2, 0, .7, .05]),
    spellSelf:    sfx('spell', 'Sort sur soi', 'Soin, bouclier, pas de l\'ombre, capacité de classe.', [1.7, 0, 523, .03, .15, .3, 0, 1, 0, 0, 262, .06, .12, 0, 0, 0, .05, .7, 0]),
    spellBackfire: sfx('spell', 'Sort raté', 'Le sort crachote et explose.', [1.4, .1, 300, 0, .05, .35, 4, 1, -5, 0, 0, 0, 0, 4, 0, .3, 0, .6, .05, .3]),
    // Cris de mobs : un par archétype (MOB_ATTACK_STYLES, sprites/fx.js).
    goblinCry:    recipe('mob', 'Gobelinoïde', 'Cri aigu et nerveux.', 0.35, 1.6),
    beastGrowl:   recipe('mob', 'Bête', 'Grognement.', 0.6, 3.4),
    zombieGroan:  recipe('mob', 'Zombie', 'Râle traînant.', 0.85, 3.03),
    machineBeep:  recipe('mob', 'Machine', 'Bips de servomoteur.', 0.45, 1.79),
    plantRustle:  recipe('mob', 'Plante', 'Bruissement sifflant.', 0.4, 1.64),
    shadeWail:    recipe('mob', 'Ombre', 'Gémissement spectral.', 1.1, 0.78),
    blobSquelch:  recipe('mob', 'Blob', 'Floc gélatineux.', 0.4, 1.35),
    mannequinCreak: recipe('mob', 'Mannequin', 'Craquement de plastique.', 0.5, 2.6),
    swarmBuzz:    recipe('mob', 'Nuée', 'Bourdonnement.', 0.75, 1.11),
    vehicleRev:   recipe('mob', 'Véhicule', 'Moteur qui rugit.', 0.6, 1.64),
    // Impacts et fins de combat.
    heavyImpact:  sfx('impact', 'Coup lourd', 'Attaque furtive, charge, télégraphe, ruée, phase 3.', [2, .05, 45, 0, .05, .4, 4, 2, -.3, 0, 0, 0, 0, 3, 0, .3, 0, .6, .03]),
    playerHurt:   recipe('impact', 'Crawler touché', 'Le crawler encaisse un coup.', 0.25, 1.96),
    mobDeath:     recipe('impact', 'Mob vaincu', 'Le mob s\'effondre.', 0.7, 1.11),
    bossDeath:    sfx('impact', 'Boss vaincu', 'Le boss s\'écroule dans un fracas.', [2, .05, 120, .02, .3, .9, 4, 1.5, -.6, 0, 0, 0, 0, 4, 0, .3, .1, .7, .05]),
    // Butin et progression (lot 2).
    goldPickup:   recipe('event', "Pièces d'or", 'PO trouvées, revente, revente d\'office.', 0.55, 1),
    itemPickup:   recipe('event', 'Objet obtenu', 'Un objet ou un sort rejoint le sac / le grimoire.', 0.5, 1.1),
    shopBuy:      sfx('event', 'Achat', 'Tiroir-caisse du marchand.', [1.8, 0, 1200, 0, .04, .3, 1, 1.5, 0, 0, 600, .03, 0, 0, 0, 0, .05, .6, 0]),
    potionDrink:  recipe('event', 'Potion', 'Glouglou d\'un consommable.', 0.9, 1.2),
    levelUp:      recipe('event', 'Montée de niveau', 'Arpège joyeux et un peu ironique.', 0.9, 0.83),
    skillUp:      sfx('event', 'Compétence améliorée', 'Petit carillon.', [1, 0, 660, .01, .08, .15, 0, 1, 0, 0, 220, .06, 0, 0, 0, 0, 0, .6, 0]),
    achievementUnlock: sfx('event', 'Succès débloqué', 'Ta-da des sponsors.', [1.5, 0, 523, .02, .35, .4, 1, 1, 0, 0, 196, .1, 0, 0, 0, 0, .1, .7, 0]),
    minigamePerfect: recipe('event', 'Mini-jeu : Parfait', 'Étincelles aiguës.', 0.75, 1.08),
    minigameSuccess: recipe('event', 'Mini-jeu : Réussi', 'Deux notes montantes.', 0.5, 1.05),
    minigameFail: recipe('event', 'Mini-jeu : Raté', 'Buzzer de plateau télé.', 0.45, 1.02),
    // Exploration et grands moments (lot 2).
    trapSpring:   sfx('world', 'Piège', 'Déclic puis mâchoires d\'acier.', [1.8, .05, 200, 0, .02, .25, 4, 1, -4, 0, 0, 0, 0, 3, 0, .2, .02, .5, .02]),
    fleeEscape:   sfx('world', 'Fuite réussie', 'Le crawler détale.', [1.2, .05, 200, .02, .1, .15, 0, 1, 12, 0, 0, 0, 0, 2, 0, 0, 0, .5, 0]),
    restSleep:    sfx('world', 'Repos', 'Ronflement en salle sécurisée.', [1, .05, 90, .2, .3, .4, 0, 1, 1, 0, 0, 0, 0, .3, 0, 0, 0, .6, 0]),
    encounterSting: recipe('world', 'Rencontre', 'Coup de théâtre de l\'écran de rencontre.', 0.7, 0.62),
    bossSting:    sfx('world', 'Arrivée du boss', 'Accord grave et menaçant (boss, chasseur de primes).', [2, 0, 70, .02, .3, .6, 2, 1, -.3, 0, 35, .15, 0, .5, 2, .15, .15, .8, 0]),
    stairsDescend: sfx('world', 'Escalier', 'Pas qui descendent vers l\'étage suivant.', [1.3, 0, 600, 0, .5, .1, 1, 1, 0, 0, -90, .09, .1, 0, 0, 0, 0, .6, 0]),
    gameOverDirge: sfx('world', 'Game Over', 'Lamento qui s\'éteint.', [1.6, 0, 220, .05, .5, .7, 2, 1, -1.5, 0, 0, 0, 0, 0, 3, 0, .15, .7, 0, .2]),
    victoryFanfare: sfx('world', 'Victoire', 'Fanfare de sortie du Donjon.', [1.8, 0, 392, .02, .5, .5, 1, 1, 0, 0, 196, .12, .25, 0, 0, 0, .1, .7, 0])
};

// Son d'issue d'un mini-jeu (perfect / success / fail) — pure.
const SFX_MINIGAME_OUTCOMES = { perfect: 'minigamePerfect', success: 'minigameSuccess', fail: 'minigameFail' };

// Correspondances avec le catalogue des effets d'attaque (sprites/fx.js) : chaque style, projectile, école de sort et
// archétype a son son (exigé par tests/regression/sounds.js).
const SFX_MELEE_STYLES = { slash: 'swordSlash', smash: 'bluntSmash', thrust: 'thrustStab' };
const SFX_PROJECTILES = {
    stone: 'slingStone', arrow: 'bowShot', bolt: 'crossbowShot', nail: 'nailGun', pellets: 'shotgunBlast',
    dart: 'blowDart', water: 'waterJet', confetti: 'confettiPop', stamp: 'stampThrow', pulse: 'pulseBeam'
};
const SFX_SPELL_STYLES = {
    zap: 'spellZap', punch: 'spellPunch', cone: 'spellCone', arc: 'spellArc', sky: 'spellSky',
    bolt: 'spellBolt', meteor: 'spellMeteor', self: 'spellSelf'
};
const SFX_MOB_CRIES = {
    goblinoid: 'goblinCry', beast: 'beastGrowl', zombie: 'zombieGroan', machine: 'machineBeep', plant: 'plantRustle',
    shade: 'shadeWail', blob: 'blobSquelch', mannequin: 'mannequinCreak', swarm: 'swarmBuzz', vehicle: 'vehicleRev'
};

// Son d'une attaque du crawler d'après la spécification de son effet (playerAttackFxSpec(), fx.js) — pure.
function playerAttackSfxKey(spec) {
    if (!spec) return 'unarmedPunch';
    if (spec.type === 'melee') return SFX_MELEE_STYLES[spec.style] || 'bluntSmash';
    if (spec.type === 'ranged') return SFX_PROJECTILES[spec.projectile] || 'slingStone';
    if (spec.type === 'magic') return SFX_SPELL_STYLES[spec.style] || 'spellBolt';
    return 'unarmedPunch';
}

// Cri d'un mob qui attaque, selon son archétype (archétype inconnu : gobelinoïde, comme son sprite) — pure.
function mobAttackSfxKey(enemy) {
    return SFX_MOB_CRIES[enemy && enemy.visualArchetype] || SFX_MOB_CRIES.goblinoid;
}

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

// Échantillons d'un son ZzFX, simple ou en couches (pure, hors Web Audio).
function sfxSamples(def) {
    if (def.layers) {
        const parts = def.layers.map(([at, params]) => [Math.round(at * SFX_SAMPLE_RATE), zzfxGenerate(...params)]);
        const out = new Array(Math.max(...parts.map(([offset, data]) => offset + data.length))).fill(0);
        parts.forEach(([offset, data]) => { for (let i = 0; i < data.length; i++) out[offset + i] += data[i]; });
        return out;
    }
    return zzfxGenerate(...def.params);
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

// --- Voix du présentateur (lot 3) : synthèse vocale du navigateur (speechSynthesis), aucun fichier ---
// File d'attente : jamais deux répliques à la fois ; au-delà de `maxQueue` répliques en attente, les plus anciennes
// sautent. `interrupt` coupe la réplique en cours (nouvelle émission, nouvel écran de rencontre).
const ANNOUNCER_VOICE = { lang: 'fr-FR', rate: 1.08, pitch: .9, maxQueue: 3, safetyBaseMs: 1500, safetyPerCharMs: 90 };
let announcerQueue = [];
let announcerSpeaking = false;
let announcerSafetyTimer = null;

function announcerSynth() {
    return typeof speechSynthesis !== 'undefined' && speechSynthesis && typeof SpeechSynthesisUtterance === 'function' ? speechSynthesis : null;
}

// Texte prononçable (pure) : sans emoji, crochets, balises ni « PO » abrégé.
function cleanAnnouncerText(text) {
    return String(text == null ? '' : text)
        .replace(/<[^>]*>/g, ' ')
        .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
        .replace(/[\[\]{}*_]/g, '')
        .replace(/(\d+)\s*PO\b/g, "$1 pièces d'or")
        .replace(/\s+/g, ' ')
        .trim();
}

// Voix française de l'appareil (pure) : fr-FR d'abord, sinon toute voix française, sinon aucune (voix par défaut).
function pickAnnouncerVoice(voices) {
    const list = Array.isArray(voices) ? voices : [];
    const lang = v => String((v && v.lang) || '').toLowerCase().replace('_', '-');
    return list.find(v => lang(v) === 'fr-fr') || list.find(v => lang(v).startsWith('fr')) || null;
}

function speakAnnouncer(text, { interrupt = false } = {}) {
    const synth = announcerSynth();
    if (!synth || !announcerVoiceEnabled()) return false;
    const line = cleanAnnouncerText(text);
    if (!line) return false;
    if (interrupt) stopAnnouncerVoice();
    announcerQueue.push(line);
    while (announcerQueue.length > ANNOUNCER_VOICE.maxQueue) announcerQueue.shift();
    pumpAnnouncerQueue();
    return true;
}

function pumpAnnouncerQueue() {
    const synth = announcerSynth();
    if (!synth || announcerSpeaking || announcerQueue.length === 0) return;
    const line = announcerQueue.shift();
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = ANNOUNCER_VOICE.lang;
    utterance.rate = ANNOUNCER_VOICE.rate;
    utterance.pitch = ANNOUNCER_VOICE.pitch;
    const voice = pickAnnouncerVoice(typeof synth.getVoices === 'function' ? synth.getVoices() : []);
    if (voice) utterance.voice = voice;
    let finished = false;
    const next = () => {
        if (finished) return;
        finished = true;
        if (announcerSafetyTimer) { clearTimeout(announcerSafetyTimer); announcerSafetyTimer = null; }
        announcerSpeaking = false;
        pumpAnnouncerQueue();
    };
    utterance.onend = next;
    utterance.onerror = next;
    announcerSpeaking = true;
    // Filet : certains navigateurs n'émettent jamais `end` ; la file ne reste pas bloquée.
    if (typeof setTimeout === 'function') announcerSafetyTimer = setTimeout(next, ANNOUNCER_VOICE.safetyBaseMs + ANNOUNCER_VOICE.safetyPerCharMs * line.length);
    synth.speak(utterance);
}

function stopAnnouncerVoice() {
    announcerQueue = [];
    announcerSpeaking = false;
    if (announcerSafetyTimer) { clearTimeout(announcerSafetyTimer); announcerSafetyTimer = null; }
    const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (synth && typeof synth.cancel === 'function') synth.cancel();
}

// --- Lecture (Web Audio) ---
let sfxAudioContext = null;
let sfxRecipeBusNode = null;
const SFX_RECIPE_VOLUME = .9;

// Sortie commune des recettes Web Audio : un compresseur qui évite la saturation quand plusieurs sons se chevauchent.
function sfxRecipeBus(c) {
    if (!sfxRecipeBusNode || sfxRecipeBusNode.context !== c) {
        sfxRecipeBusNode = typeof c.createDynamicsCompressor === 'function' ? c.createDynamicsCompressor() : c.createGain();
        sfxRecipeBusNode.connect(c.destination);
    }
    return sfxRecipeBusNode;
}
let sfxQueueEnd = 0; // heure (contexte audio) à laquelle le dernier son de la file aura laissé la place

// Heure de départ d'un son de la file (pure) : tout de suite si la file est libre, sinon après le précédent.
function sfxQueuedStart(now, queueEnd) {
    return Math.max(now, queueEnd);
}

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
        const c = sfxAudioContext;
        const now = c.currentTime || 0;
        const recipeFn = def.recipe && typeof SFX_RECIPES !== 'undefined' ? SFX_RECIPES[key] : null;
        if (def.recipe && !recipeFn) return false;
        const data = recipeFn ? null : sfxSamples(def);
        const seconds = recipeFn ? def.duration : data.length / SFX_SAMPLE_RATE;
        let at = now;
        if (SFX_QUEUED_GROUPS.includes(def.group) && !force) {
            at = sfxQueuedStart(now, sfxQueueEnd);
            sfxQueueEnd = at + Math.min(seconds, SFX_QUEUE_MAX_GAP);
        }
        if (recipeFn) {
            const output = c.createGain();
            output.gain.value = SFX_RECIPE_VOLUME * (def.level || 1);
            output.connect(sfxRecipeBus(c));
            recipeFn(c, output, at + .005);
            return true;
        }
        const buffer = c.createBuffer(1, data.length, SFX_SAMPLE_RATE);
        buffer.getChannelData(0).set(data);
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.connect(c.destination);
        source.start(at);
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
