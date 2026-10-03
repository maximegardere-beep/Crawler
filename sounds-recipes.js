// =========================================================================
// RECETTES WEB AUDIO DES SONS (chantier 8, suite « sons plus reconnaissables », voir NOTES_SONS.md) — pour les
// sons dont l'entrée de SFX_CATALOG (sounds.js) porte `recipe: true`. Aucun fichier audio : chaque recette assemble
// des briques (souffle de bruit filtré, choc, métal, cloche FM, voix de créature à formants…) sur le contexte audio,
// à partir de l'heure `t`, vers la sortie `dst` (gain du son puis compresseur commun, posés par playSfx()).
// Règle : une rampe exponentielle ne vise JAMAIS 0 (refusé par les navigateurs) — d'où les 0.0001 ; tout ce qui est
// lancé s'arrête avant `t + duration` du catalogue (vérifié par tests/regression/sounds.js avec un faux contexte).
// Chargé juste après sounds.js, avant app.js.
// =========================================================================

const sfxRand = (a, b) => a + Math.random() * (b - a);
const SFX_NOISE_SECONDS = 2;
const sfxNoiseBuffers = new WeakMap(); // un tampon de bruit blanc par contexte audio

function sfxNoise(c) {
    let buf = sfxNoiseBuffers.get(c);
    if (!buf) {
        buf = c.createBuffer(1, c.sampleRate * SFX_NOISE_SECONDS, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        sfxNoiseBuffers.set(c, buf);
    }
    const n = c.createBufferSource();
    n.buffer = buf;
    n.loop = true;
    return n;
}

// Enveloppe : montée en `a` jusqu'à `peak`, puis extinction en `dur`.
function sfxEnv(c, t, a, peak, dur) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    return g;
}

// Souffle : bruit passé dans un passe-bande qui balaie de f0 à f1.
function sfxWhoosh(c, dst, t, dur, f0, f1, q, peak) {
    const n = sfxNoise(c), f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = sfxEnv(c, t, dur * .45, peak, dur * .55);
    n.connect(f); f.connect(g); g.connect(dst);
    n.start(t); n.stop(t + dur + .02);
}

// Bruit filtré bref (claquement, craquement) ou long (grondement, rugissement).
function sfxBurst(c, dst, t, dur, type, freq, peak, { a = .002, f1 = null, q = .7 } = {}) {
    const n = sfxNoise(c), f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    const g = sfxEnv(c, t, a, peak, dur);
    n.connect(f); f.connect(g); g.connect(dst);
    n.start(t); n.stop(t + a + dur + .02);
}

// Note dont la hauteur glisse de f0 à f1 (choc sourd quand elle chute vite).
function sfxTone(c, dst, t, type, f0, f1, dur, peak, a = .003) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    const g = sfxEnv(c, t, a, peak, dur);
    o.connect(g); g.connect(dst);
    o.start(t); o.stop(t + a + dur + .02);
    return o;
}

// Métal : partiels inharmoniques qui s'éteignent à des vitesses différentes (lame, cloche, cymbale).
function sfxMetal(c, dst, t, base, dur, peak, ratios = [1, 2.76, 5.4, 8.93]) {
    ratios.forEach((r, i) => {
        const o = c.createOscillator();
        o.frequency.value = base * r * sfxRand(.995, 1.005);
        const g = sfxEnv(c, t, .002, peak / (i + 1.2), dur / (1 + i * .6));
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + .002 + dur / (1 + i * .6) + .02);
    });
}

// Petite cloche en synthèse FM (pièce, carillon).
function sfxBell(c, dst, t, f, peak, dur = .32) {
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(f * .1, t + .2);
    mod.connect(mg); mg.connect(car.frequency);
    const g = sfxEnv(c, t, .002, peak, dur);
    car.connect(g); g.connect(dst);
    car.start(t); mod.start(t);
    car.stop(t + dur + .02); mod.stop(t + dur + .02);
}

// Oscillation périodique d'un paramètre (vibrato, hachage, trémolo).
function sfxLfo(c, t, dur, rate, depth, param, type = 'sine') {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(rate, t);
    g.gain.value = depth;
    o.connect(g); g.connect(param);
    o.start(t); o.stop(t + dur + .02);
    return o;
}

// Voix de créature : dents de scie dont la hauteur suit un contour [[temps, Hz], …], passée dans des filtres de
// formants (une voyelle) ; `rough` hache la voix (grognement), `vib` la fait trembler.
const SFX_VOWELS = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [300, 2300, 3000], o: [500, 850, 2400], u: [330, 800, 2300] };
function sfxCreature(c, dst, t, contour, vowel, peak, { vib = 0, vibRate = 6, rough = 0, a = .03 } = {}) {
    const dur = contour[contour.length - 1][0];
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(contour[0][1], t);
    contour.slice(1).forEach(([tt, f]) => o.frequency.exponentialRampToValueAtTime(f, t + tt));
    if (vib) sfxLfo(c, t, dur, vibRate, vib, o.frequency);
    const g = sfxEnv(c, t, a, peak, Math.max(.05, dur - a));
    let src = o;
    if (rough) {
        const am = c.createGain();
        am.gain.value = 1 - rough;
        sfxLfo(c, t, dur, sfxRand(28, 36), rough, am.gain, 'square');
        o.connect(am);
        src = am;
    }
    SFX_VOWELS[vowel].forEach((f, i) => {
        const bp = c.createBiquadFilter(), fg = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
        fg.gain.value = [1, .6, .25][i];
        src.connect(bp); bp.connect(fg); fg.connect(g);
    });
    g.connect(dst);
    o.start(t); o.stop(t + Math.max(dur, a + .05) + .02);
}

// Écho (ombre) : renvoie une entrée qui sonne en direct ET répétée.
function sfxEcho(c, dst, time = .12, feedback = .35) {
    const d = c.createDelay(1), g = c.createGain(), input = c.createGain();
    d.delayTime.value = time;
    g.gain.value = feedback;
    d.connect(g); g.connect(d);
    input.connect(dst); input.connect(d); d.connect(dst);
    return input;
}

// Grains : beaucoup de petits claquements filtrés (bruissement, crépitement, grincement).
function sfxGrains(c, dst, t, dur, count, type, freq, peak, { q = 2, accel = false } = {}) {
    for (let i = 0; i < count; i++) {
        const p = accel ? Math.pow(i / count, .6) : Math.random();
        sfxBurst(c, dst, t + p * dur, sfxRand(.004, .015), type, freq * sfxRand(.8, 1.25), peak * sfxRand(.5, 1), { q });
    }
}

// Accord de dents de scie légèrement désaccordées (cuivres), filtré par un passe-bas déjà réglé.
function sfxChord(c, filter, t, dur, freqs) {
    freqs.forEach(f => [.995, 1.005].forEach(k => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * k;
        o.connect(filter);
        o.start(t); o.stop(t + dur);
    }));
}

const SFX_RECIPES = {
    // --- Armes de mêlée ---
    swordSlash(c, d, t) {
        sfxWhoosh(c, d, t, .17, 500, 2600, 1.4, .9);
        sfxBurst(c, d, t + .15, .05, 'highpass', 3000, .6);
        sfxTone(c, d, t + .15, 'sine', 170, 50, .16, .9);
        sfxMetal(c, d, t + .15, sfxRand(1700, 1900), .6, .22);
    },
    bluntSmash(c, d, t) {
        sfxWhoosh(c, d, t, .14, 250, 900, 1, .5);
        sfxTone(c, d, t + .12, 'sine', 130, 38, .28, 1);
        sfxBurst(c, d, t + .12, .13, 'lowpass', 900, .8);
        sfxBurst(c, d, t + .12, .06, 'bandpass', 320, .6, { q: 1.2 });
    },
    thrustStab(c, d, t) {
        sfxWhoosh(c, d, t, .09, 1400, 4200, 2, .6);
        sfxBurst(c, d, t + .08, .035, 'highpass', 4500, .7);
        sfxTone(c, d, t + .08, 'sine', 320, 130, .07, .45);
        sfxBurst(c, d, t + .09, .08, 'bandpass', 1800, .25, { q: 3 });
    },
    unarmedPunch(c, d, t) {
        sfxWhoosh(c, d, t, .07, 400, 1300, 1.2, .4);
        sfxTone(c, d, t + .06, 'sine', 170, 55, .13, .95);
        sfxBurst(c, d, t + .06, .05, 'lowpass', 1400, .7);
        sfxBurst(c, d, t + .06, .02, 'highpass', 2500, .35);
    },
    // --- Sorts ---
    spellZap(c, d, t) {
        const o = c.createOscillator(), hp = c.createBiquadFilter(), am = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = 58;
        hp.type = 'highpass'; hp.frequency.value = 600;
        am.gain.value = .5;
        sfxLfo(c, t, .33, 38, .5, am.gain, 'square');
        const g = sfxEnv(c, t, .01, .6, .32);
        o.connect(hp); hp.connect(am); am.connect(g); g.connect(d);
        o.start(t); o.stop(t + .35);
        sfxGrains(c, d, t, .3, 22, 'highpass', 5000, .5);
    },
    spellCone(c, d, t) {
        sfxBurst(c, d, t, .45, 'lowpass', 500, .9, { a: .1, f1: 1800, q: 1 });
        sfxBurst(c, d, t, .42, 'bandpass', 300, .5, { a: .08, q: .8 });
        sfxGrains(c, d, t + .05, .45, 14, 'highpass', 3500, .4);
    },
    spellBolt(c, d, t) {
        const o = sfxTone(c, d, t, 'sine', 950, 320, .3, .6, .01);
        sfxLfo(c, t, .31, 22, 40, o.frequency);
        sfxTone(c, d, t, 'triangle', 1900, 640, .25, .2, .01);
        sfxWhoosh(c, d, t, .3, 3000, 1200, 3, .25);
    },
    spellSky(c, d, t) {
        sfxBurst(c, d, t, .09, 'highpass', 2500, 1);
        sfxBurst(c, d, t + .02, .12, 'bandpass', 900, .7, { q: 1.5 });
        sfxTone(c, d, t + .03, 'sine', 90, 28, .6, .9);
        sfxBurst(c, d, t + .05, 1.25, 'lowpass', 420, .8, { a: .08, f1: 55 });
    },
    // --- Cris de mobs ---
    goblinCry(c, d, t) {
        sfxCreature(c, d, t, [[0, 420], [.12, 760], [.3, 430]], 'e', .9, { vib: 30, vibRate: 11 });
    },
    beastGrowl(c, d, t) {
        sfxCreature(c, d, t, [[0, 80], [.2, 105], [.55, 72]], 'o', 1, { rough: .7, a: .06 });
        sfxBurst(c, d, t, .45, 'lowpass', 700, .3, { a: .08 });
    },
    zombieGroan(c, d, t) {
        sfxCreature(c, d, t, [[0, 125], [.35, 135], [.8, 88]], 'u', 1, { vib: 5, vibRate: 4, rough: .25, a: .12 });
        sfxBurst(c, d, t + .1, .55, 'bandpass', 600, .25, { a: .15, q: 1 });
    },
    machineBeep(c, d, t) {
        sfxTone(c, d, t, 'square', 880, 880, .06, .35);
        sfxTone(c, d, t + .09, 'square', 620, 620, .06, .35);
        const o = c.createOscillator(), bp = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(260, t + .05);
        o.frequency.exponentialRampToValueAtTime(620, t + .35);
        bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
        const g = sfxEnv(c, t + .05, .04, .5, .3);
        o.connect(bp); bp.connect(g); g.connect(d);
        o.start(t + .05); o.stop(t + .41);
    },
    plantRustle(c, d, t) {
        sfxGrains(c, d, t, .35, 40, 'highpass', 3200, .6, { q: 1 });
        sfxBurst(c, d, t, .3, 'highpass', 5000, .15, { a: .05 });
        sfxGrains(c, d, t + .15, .12, 6, 'bandpass', 900, .5, { q: 4, accel: true });
    },
    shadeWail(c, d, t) {
        const e = sfxEcho(c, d, .14, .4);
        const a = sfxTone(c, e, t, 'sine', 620, 430, .55, .45, .15);
        const b = sfxTone(c, e, t, 'sine', 930, 650, .52, .2, .18);
        sfxLfo(c, t, .7, 6, 14, a.frequency);
        sfxLfo(c, t, .7, 5, 18, b.frequency);
        sfxBurst(c, e, t, .5, 'bandpass', 1200, .12, { a: .2, q: 2 });
    },
    blobSquelch(c, d, t) {
        const o = c.createOscillator(), f = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(75, t);
        o.frequency.linearRampToValueAtTime(95, t + .3);
        f.type = 'lowpass'; f.Q.value = 14;
        f.frequency.setValueAtTime(180, t);
        f.frequency.exponentialRampToValueAtTime(1600, t + .09);
        f.frequency.exponentialRampToValueAtTime(220, t + .3);
        const g = sfxEnv(c, t, .01, .8, .3);
        o.connect(f); f.connect(g); g.connect(d);
        o.start(t); o.stop(t + .33);
        sfxTone(c, d, t + .22, 'sine', 260, 620, .06, .3);
    },
    mannequinCreak(c, d, t) {
        sfxGrains(c, d, t, .38, 26, 'bandpass', 1300, .55, { q: 6, accel: true });
        sfxTone(c, d, t + .36, 'triangle', 420, 190, .07, .5);
        sfxBurst(c, d, t + .36, .04, 'bandpass', 800, .4, { q: 3 });
    },
    swarmBuzz(c, d, t) {
        const bp = c.createBiquadFilter(), am = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
        am.gain.value = .7;
        sfxLfo(c, t, .7, 24, .3, am.gain);
        const g = sfxEnv(c, t, .25, .6, .4);
        for (let i = 0; i < 6; i++) {
            const o = c.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = sfxRand(200, 250);
            o.connect(bp);
            o.start(t); o.stop(t + .7);
        }
        bp.connect(am); am.connect(g); g.connect(d);
    },
    vehicleRev(c, d, t) {
        const o = c.createOscillator(), lp = c.createBiquadFilter(), am = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(55, t);
        o.frequency.exponentialRampToValueAtTime(140, t + .3);
        o.frequency.exponentialRampToValueAtTime(90, t + .5);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.exponentialRampToValueAtTime(1400, t + .3);
        am.gain.value = .6;
        const l = sfxLfo(c, t, .52, 22, .4, am.gain, 'square');
        l.frequency.linearRampToValueAtTime(48, t + .3);
        const g = sfxEnv(c, t, .03, .8, .47);
        o.connect(lp); lp.connect(am); am.connect(g); g.connect(d);
        o.start(t); o.stop(t + .52);
    },
    // --- Impacts et fins de combat ---
    playerHurt(c, d, t) {
        sfxTone(c, d, t, 'sine', 210, 85, .1, .7);
        sfxBurst(c, d, t, .07, 'bandpass', 1100, .5, { q: 1 });
        sfxCreature(c, d, t + .02, [[0, 150], [.16, 108]], 'a', .45, { a: .01 });
    },
    mobDeath(c, d, t) {
        sfxCreature(c, d, t, [[0, 300], [.45, 85]], 'o', .6, { vib: 8, vibRate: 7, a: .02 });
        sfxTone(c, d, t + .4, 'sine', 110, 40, .25, .9);
        sfxBurst(c, d, t + .4, .22, 'lowpass', 650, .6);
    },
    // --- Butin et progression ---
    goldPickup(c, d, t) {
        [0, .055, .11, .2].forEach((o, i) => {
            sfxBell(c, d, t + o, sfxRand(2500, 3400), .35 - i * .05);
            sfxBurst(c, d, t + o, .015, 'highpass', 6000, .15);
        });
    },
    itemPickup(c, d, t) {
        sfxWhoosh(c, d, t, .1, 700, 2400, 1, .3);
        sfxBurst(c, d, t, .08, 'bandpass', 2000, .15, { q: .8 });
        sfxBell(c, d, t + .07, 1320, .35, .3);
        sfxBell(c, d, t + .15, 1980, .3, .3);
    },
    potionDrink(c, d, t) {
        sfxTone(c, d, t, 'sine', 500, 1200, .05, .6);
        sfxBurst(c, d, t, .03, 'bandpass', 1500, .5, { q: 2 });
        let o = .13;
        for (let i = 0; i < 6; i++) {
            const f = sfxRand(220, 420), b = c.createOscillator(), g = sfxEnv(c, t + o, .004, .45, .07);
            b.frequency.setValueAtTime(f, t + o);
            b.frequency.exponentialRampToValueAtTime(f * 2.4, t + o + .06);
            b.connect(g); g.connect(d);
            b.start(t + o); b.stop(t + o + .1);
            o += sfxRand(.06, .1);
        }
        sfxBurst(c, d, t + .13, o - .13, 'lowpass', 500, .25, { a: .05, f1: 250 });
    },
    levelUp(c, d, t) {
        [523, 659, 784, 1047].forEach((f, i) => {
            sfxBell(c, d, t + i * .09, f, .45, i === 3 ? .6 : .3);
            sfxTone(c, d, t + i * .09, 'triangle', f / 2, f / 2, i === 3 ? .5 : .15, .18);
        });
        sfxMetal(c, d, t + .27, 3200, .55, .12);
    },
    minigamePerfect(c, d, t) {
        [0, 1, 2, 3, 4, 5].forEach(i => sfxBell(c, d, t + i * .045, 1800 + i * 380, .28, .25));
        sfxMetal(c, d, t + .27, 2100, .5, .18);
    },
    minigameSuccess(c, d, t) {
        sfxBell(c, d, t, 880, .4, .25);
        sfxBell(c, d, t + .1, 1320, .4, .35);
    },
    minigameFail(c, d, t) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1400;
        const g = sfxEnv(c, t, .01, .5, .38);
        [110, 116.5].forEach(f => {
            const o = c.createOscillator();
            o.type = 'square'; o.frequency.value = f;
            o.connect(lp);
            o.start(t); o.stop(t + .4);
        });
        lp.connect(g); g.connect(d);
    },
    // --- Exploration et grands moments ---
    // Rencontre (option D validée) : lame dégainée très vite, accord de cuivres percutant et timbale.
    encounterSting(c, d, t) {
        sfxBurst(c, d, t, .16, 'bandpass', 2200, .5, { a: .12, f1: 5500, q: 9 });
        const s = t + .18, lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, s);
        lp.frequency.exponentialRampToValueAtTime(3500, s + .04);
        lp.frequency.exponentialRampToValueAtTime(900, s + .45);
        const g = sfxEnv(c, s, .01, .6, .45);
        sfxChord(c, lp, s, .5, [146.8, 220, 293.7]);
        lp.connect(g); g.connect(d);
        sfxTone(c, d, s, 'sine', 110, 45, .45, 1);
        sfxBurst(c, d, s, .3, 'lowpass', 300, .5);
    }
};
