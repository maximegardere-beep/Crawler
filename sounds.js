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

const sfx = (group, label, use, params) => ({ group, label, use, params });

const SFX_CATALOG = {
    // Armes de mêlée : un son par style de coup (MELEE_SWING_STYLES, sprites/fx.js) + mains nues.
    swordSlash:   sfx('melee', "Coup d'épée", 'Arme tranchante (épée, hache, katana…).', [1.4, .05, 90, 0, .01, .12, 4, 1.2, -1, 0, 0, 0, 0, 4, 40, .1, 0, .6, .02]),
    bluntSmash:   sfx('melee', 'Coup contondant', 'Arme lourde (masse, pied-de-biche, marteau…).', [1.8, .05, 60, 0, .03, .2, 4, 2, -.5, 0, 0, 0, 0, 2, 0, .2, 0, .5, .03]),
    thrustStab:   sfx('melee', 'Estoc', 'Arme qui pique (couteau, lance, tronçonneuse…).', [1.2, .05, 300, 0, .01, .08, 2, 1.5, -12, 0, 0, 0, 0, 1, 0, 0, 0, .6, 0]),
    unarmedPunch: sfx('melee', 'Coup de poing', 'Attaque à mains nues.', [1.5, .05, 120, 0, .01, .1, 0, 2, -3, 0, 0, 0, 0, 1.5, 0, .1, 0, .5, 0]),
    // Armes à distance : un son par projectile (RANGED_PROJECTILES, sprites/fx.js).
    slingStone:   sfx('ranged', 'Lance-pierre', 'Caillou qui part en sifflant.', [1, .1, 250, .01, .03, .1, 0, 1, -6, 0, 0, 0, 0, 3, 0, 0, 0, .5, 0]),
    bowShot:      sfx('ranged', "Tir à l'arc", 'Corde qui vibre, flèche qui file.', [1.4, .05, 300, 0, .02, .2, 2, 1.5, -6, 0, 0, 0, 0, 0, 15, 0, 0, .6, .02]),
    crossbowShot: sfx('ranged', "Tir d'arbalète", 'Carreau : corde qui claque, sifflement.', [2, .05, 520, 0, .02, .18, 2, 2.2, -18, 0, 0, 0, 0, .4, 0, 0, .04, .5, .01]),
    nailGun:      sfx('ranged', 'Pistolet à clous', 'Deux clous en rafale.', [2.3, .05, 900, 0, .01, .04, 4, 1, -10, 0, 0, 0, .06, 1, 0, .1, 0, .4, 0]),
    shotgunBlast: sfx('ranged', 'Fusil', 'Détonation et plombs.', [2, .05, 80, 0, .04, .35, 4, 1.5, -.4, 0, 0, 0, 0, 5, 0, .3, 0, .6, .05]),
    blowDart:     sfx('ranged', 'Sarbacane', 'Pfft discret.', [1.6, .1, 600, 0, .01, .06, 0, 1, -4, 0, 0, 0, 0, 8, 0, 0, 0, .3, 0]),
    waterJet:     sfx('ranged', "Jet d'eau", "Pistolet à eau ou à bulles.", [1.5, .05, 200, .02, .25, .15, 0, 1, 0, 0, 0, 0, .04, 6, 0, 0, 0, .5, 0, .5]),
    confettiPop:  sfx('ranged', 'Confettis', 'Pop festif et pétillant.', [2.4, .05, 500, 0, .02, .12, 1, 1, 10, 0, 700, .04, 0, .5, 0, 0, .03, .6, 0]),
    stampThrow:   sfx('ranged', 'Tampon', 'Tampon encreur lancé : tchac.', [1.4, .05, 140, 0, .02, .1, 2, 1, -2, 0, 0, 0, 0, .5, 0, .1, 0, .5, 0]),
    pulseBeam:    sfx('ranged', "Canon à impulsions", 'Rayon laser.', [1.2, 0, 1100, 0, .06, .2, 2, 1, -30, 0, 0, 0, 0, 0, 20, 0, 0, .7, 0]),
    // Sorts : un son par école d'effet (style de FX_SPELLS, sprites/fx.js) + sort raté.
    spellZap:     sfx('spell', 'Éclair', 'Arc électrique (Éclair, Ampoule…).', [1.1, .05, 800, 0, .12, .1, 3, 1, 0, 0, 0, 0, .02, 3, 0, 0, 0, .6, 0, .6]),
    spellPunch:   sfx('spell', 'Poing magique', 'Poing de glace ou de force.', [1.3, .05, 400, 0, .04, .12, 1, 1, -8, 0, 300, .03, 0, 0, 0, 0, 0, .6, 0]),
    spellCone:    sfx('spell', 'Souffle', 'Jet de flammes ou de terreur.', [1.5, .05, 120, .04, .2, .25, 4, 1, 2, 0, 0, 0, 0, 6, 0, .05, 0, .7, .05]),
    spellArc:     sfx('spell', 'Lame spectrale', 'Lame fantomatique en arc.', [1.8, .05, 700, .02, .12, .25, 0, 1, -3, 0, 0, 0, 0, 0, 6, 0, .05, .6, 0]),
    spellSky:     sfx('spell', 'Foudre', 'Éclair qui tombe du plafond.', [2, .05, 50, 0, .08, .6, 4, 2, -.2, 0, 0, 0, 0, 8, 0, .4, 0, .6, .05]),
    spellBolt:    sfx('spell', 'Projectile magique', 'Orbe, éclat de glace, essaim.', [2.2, .05, 660, 0, .06, .18, 1, 1, -10, 0, 0, 0, 0, 0, 10, 0, .05, .6, 0]),
    spellMeteor:  sfx('spell', 'Météore', 'Boule de feu qui s\'écrase.', [1.8, .05, 400, .05, .15, .5, 4, 1.2, -6, 0, 0, 0, 0, 3, 0, .2, 0, .7, .05]),
    spellSelf:    sfx('spell', 'Sort sur soi', 'Soin, bouclier, pas de l\'ombre, capacité de classe.', [1.7, 0, 523, .03, .15, .3, 0, 1, 0, 0, 262, .06, .12, 0, 0, 0, .05, .7, 0]),
    spellBackfire: sfx('spell', 'Sort raté', 'Le sort crachote et explose.', [1.4, .1, 300, 0, .05, .35, 4, 1, -5, 0, 0, 0, 0, 4, 0, .3, 0, .6, .05, .3]),
    // Cris de mobs : un par archétype (MOB_ATTACK_STYLES, sprites/fx.js).
    goblinCry:    sfx('mob', 'Gobelinoïde', 'Cri aigu et nerveux.', [1.1, .1, 640, .02, .09, .22, 2, 1.6, -4, 0, 120, .06, 0, .2, 9, 0, 0, .8, .04]),
    beastGrowl:   sfx('mob', 'Bête', 'Grognement.', [1.5, .1, 110, .03, .15, .2, 2, 2, -1, 0, 0, 0, 0, 1, 12, 0, 0, .8, 0]),
    zombieGroan:  sfx('mob', 'Zombie', 'Râle traînant.', [1.4, .1, 150, .06, .2, .3, 2, 1.5, -.8, 0, 0, 0, 0, .5, 4, 0, 0, .7, 0, .2]),
    machineBeep:  sfx('mob', 'Machine', 'Bips de servomoteur.', [1.7, 0, 440, 0, .05, .05, 1, 1, 0, 0, -110, .05, .1, 0, 0, .1, 0, .6, 0]),
    plantRustle:  sfx('mob', 'Plante', 'Bruissement sifflant.', [1, .1, 300, .02, .1, .15, 0, 1, 0, 0, 0, 0, 0, 9, 0, 0, 0, .5, 0]),
    shadeWail:    sfx('mob', 'Ombre', 'Gémissement spectral.', [1.8, .1, 500, .08, .2, .35, 0, 1, -2, 0, 0, 0, 0, 0, 7, 0, .08, .6, 0]),
    blobSquelch:  sfx('mob', 'Blob', 'Floc gélatineux.', [1.4, .1, 90, 0, .05, .15, 0, 2, 4, 0, 0, 0, 0, .6, 25, 0, 0, .6, 0]),
    mannequinCreak: sfx('mob', 'Mannequin', 'Craquement de plastique.', [1.8, .1, 200, 0, .08, .08, 2, 1, 1, 0, 0, 0, .03, .3, 0, .2, 0, .5, 0]),
    swarmBuzz:    sfx('mob', 'Nuée', 'Bourdonnement.', [1, .05, 180, .05, .3, .15, 2, 1, 0, 0, 0, 0, 0, .2, 30, 0, 0, .6, 0, .3]),
    vehicleRev:   sfx('mob', 'Véhicule', 'Moteur qui rugit.', [1.3, .05, 220, .02, .18, .1, 2, 1, 0, 0, 55, .08, 0, .1, 0, .05, 0, .7, 0]),
    // Impacts et fins de combat.
    heavyImpact:  sfx('impact', 'Coup lourd', 'Attaque furtive, charge, télégraphe, ruée, phase 3.', [2, .05, 45, 0, .05, .4, 4, 2, -.3, 0, 0, 0, 0, 3, 0, .3, 0, .6, .03]),
    playerHurt:   sfx('impact', 'Crawler touché', 'Le crawler encaisse un coup.', [1.4, .05, 180, 0, .02, .12, 2, 1, -10, 0, 0, 0, 0, .5, 0, .1, 0, .5, 0]),
    mobDeath:     sfx('impact', 'Mob vaincu', 'Le mob s\'effondre.', [1.3, .05, 400, 0, .05, .35, 2, 1, -8, 0, 0, 0, 0, .3, 0, 0, 0, .6, 0]),
    bossDeath:    sfx('impact', 'Boss vaincu', 'Le boss s\'écroule dans un fracas.', [2, .05, 120, .02, .3, .9, 4, 1.5, -.6, 0, 0, 0, 0, 4, 0, .3, .1, .7, .05]),
    // Butin et progression (lot 2).
    goldPickup:   sfx('event', "Pièces d'or", 'PO trouvées, revente, revente d\'office.', [1, .02, 1675, 0, .06, .24, 1, 1.82, 0, 0, 837, .06]),
    itemPickup:   sfx('event', 'Objet obtenu', 'Un objet ou un sort rejoint le sac / le grimoire.', [1.2, .02, 880, 0, .05, .15, 1, 1, 0, 0, 440, .05, 0, 0, 0, 0, 0, .6, 0]),
    shopBuy:      sfx('event', 'Achat', 'Tiroir-caisse du marchand.', [1.8, 0, 1200, 0, .04, .3, 1, 1.5, 0, 0, 600, .03, 0, 0, 0, 0, .05, .6, 0]),
    potionDrink:  sfx('event', 'Potion', 'Glouglou d\'un consommable.', [1.2, .1, 300, 0, .15, .1, 0, 1, 8, 0, 0, 0, .05, 0, 0, 0, 0, .6, 0]),
    levelUp:      sfx('event', 'Montée de niveau', 'Arpège joyeux et un peu ironique.', [1.8, 0, 392, .02, .28, .35, 1, 1, 0, 0, 131, .07, .36, 0, 0, 0, .08, .7, .02]),
    skillUp:      sfx('event', 'Compétence améliorée', 'Petit carillon.', [1, 0, 660, .01, .08, .15, 0, 1, 0, 0, 220, .06, 0, 0, 0, 0, 0, .6, 0]),
    achievementUnlock: sfx('event', 'Succès débloqué', 'Ta-da des sponsors.', [1.5, 0, 523, .02, .35, .4, 1, 1, 0, 0, 196, .1, 0, 0, 0, 0, .1, .7, 0]),
    minigamePerfect: sfx('event', 'Mini-jeu : Parfait', 'Étincelles aiguës.', [2.2, 0, 1046, 0, .1, .3, 1, 1, 0, 0, 523, .04, .12, 0, 0, 0, .06, .6, 0]),
    minigameSuccess: sfx('event', 'Mini-jeu : Réussi', 'Deux notes montantes.', [1.2, 0, 784, 0, .06, .15, 1, 1, 0, 0, 262, .05, 0, 0, 0, 0, 0, .6, 0]),
    minigameFail: sfx('event', 'Mini-jeu : Raté', 'Buzzer de plateau télé.', [1.3, 0, 140, 0, .15, .15, 2, 1, -1, 0, 0, 0, 0, .1, 0, .1, 0, .7, 0]),
    // Exploration et grands moments (lot 2).
    trapSpring:   sfx('world', 'Piège', 'Déclic puis mâchoires d\'acier.', [1.8, .05, 200, 0, .02, .25, 4, 1, -4, 0, 0, 0, 0, 3, 0, .2, .02, .5, .02]),
    fleeEscape:   sfx('world', 'Fuite réussie', 'Le crawler détale.', [1.2, .05, 200, .02, .1, .15, 0, 1, 12, 0, 0, 0, 0, 2, 0, 0, 0, .5, 0]),
    restSleep:    sfx('world', 'Repos', 'Ronflement en salle sécurisée.', [1, .05, 90, .2, .3, .4, 0, 1, 1, 0, 0, 0, 0, .3, 0, 0, 0, .6, 0]),
    encounterSting: sfx('world', 'Rencontre', 'Coup de théâtre de l\'écran de rencontre.', [1.6, 0, 180, 0, .15, .3, 2, 1, -1, 0, 90, .05, 0, .2, 0, .1, .08, .7, 0]),
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
        const data = zzfxGenerate(...def.params);
        const buffer = sfxAudioContext.createBuffer(1, data.length, SFX_SAMPLE_RATE);
        buffer.getChannelData(0).set(data);
        const source = sfxAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(sfxAudioContext.destination);
        const now = sfxAudioContext.currentTime || 0;
        if (SFX_QUEUED_GROUPS.includes(def.group) && !force) {
            const at = sfxQueuedStart(now, sfxQueueEnd);
            sfxQueueEnd = at + Math.min(data.length / SFX_SAMPLE_RATE, SFX_QUEUE_MAX_GAP);
            source.start(at);
        } else {
            source.start(now);
        }
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
