// early-curve.js — OUTIL DE CALIBRAGE (chantier 15 « rééquilibrage du début de partie »), jamais lancé par la CI.
// `npm run sim:early [n]` : mesure, étage par étage (1 à 6) et niveau par niveau, ce que coûte un combat en début de partie —
// part des PV perdus et probabilité de mort, à PV pleins — pour les mobs ordinaires, les élites 💀 et les boss de quartier,
// AVANT (sans le paquet `config.earlyGame`) et APRÈS (avec). Sert à valider chaque réglage du chantier par des chiffres
// (voir NOTES_DEBUT_DE_PARTIE.md) avant de le proposer à l'utilisateur.
//
// Modèle volontairement simple (espérances, pas de variance de dégâts) :
//  - mobs et boss : les VRAIS générateurs du jeu (generateMob()/generateBoss()), tirés dans tous les quartiers ;
//  - dégâts : espérance de rollDamage() ; côté mob -> joueur, plancher de pression et mitigation minimale comme
//    resolveEnemyCounterAttack() ; élites × eliteDamageMult ;
//  - joueur : PV/ATQ/DEF par niveau comme gainXp() ; équipement supposé par étage (GEAR_BY_FLOOR : cadeau Camelote à l'étage 1,
//    Commun ensuite — hypothèse moyenne, voir sim:items) ; ni fuite, ni furtivité, ni repos, ni statuts, ni mobs à distance ;
//  - boss : multiplicateur de dégâts moyen par phase DÉRIVÉ de config.bossPhases (télégraphe, multi-coups, harcèlement, buff de DEF, folie).
// Le « après » lit config.earlyGame ; quand un mécanisme est branché dans le moteur (lots 1 à 4), l'outil l'utilise tel quel,
// sinon il le modélise localement (marqué « modèle local » ci-dessous). `config.earlyGame.enabled = false` redonne le jeu d'avant.
require('../test_stub.js');
const { loadGame } = require('../load_game.js');
loadGame();

const SAMPLES = Math.max(200, parseInt(process.argv[2], 10) || 3000);
const BOSS_SAMPLES = Math.max(100, Math.round(SAMPLES / 4));

// Hasard reproductible : deux lancements donnent les mêmes chiffres (generateMob()/generateBoss() lisent Math.random).
let seed = 20261002;
Math.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const EG = config.earlyGame;
const SCALING = config.mobDamageScaling;
const DISTRICTS = Object.keys(districts);
const pad = (v, n) => String(v).padStart(n);
const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
const cellText = (r) => `${pct(r.lost)}/${pct(r.dead).trim().padStart(3)}`;

// Équipement supposé (ATQ, DEF) : cadeau Camelote à l'étage 1, Commun à l'étage 2, un peu mieux ensuite.
const GEAR_BY_FLOOR = { 1: { atk: 2, def: 0 }, 2: { atk: 4, def: 3 }, 3: { atk: 6, def: 4 }, 4: { atk: 8, def: 5 }, 5: { atk: 12, def: 8 }, 6: { atk: 15, def: 10 } };
const gearFor = (floor) => GEAR_BY_FLOOR[Math.min(6, floor)];

function playerAt(level) {
    let hp = 100, atk = 10, def = 5;
    for (let l = 2; l <= level; l++) { hp += 15; atk += 2 + Math.floor(l / 4); def += 1 + Math.floor(l / 5); }
    return { level, hp, atk, def };
}

// Espérance de rollDamage() (variance moyenne 1).
function expectedDamage(atk, def, opts = {}) {
    const mitigation = Math.max(opts.minMitigation || 0, atk / (atk + def));
    return Math.max(1, Math.round(Math.max(atk, opts.pressureFloor || 0) * mitigation));
}

// --- Les quatre mécanismes du paquet : moteur s'il existe, sinon modèle local ---
const on = (floor) => EG.enabled && floor <= EG.maxFloor;
// Période d'essai : multiplicateur de dégâts subis (modèle local tant que trialDamageMult() n'existe pas dans app.js).
function trialMult(level, floor) {
    if (!on(floor)) return 1;
    if (typeof trialDamageMult === 'function') return trialDamageMult(level, floor);
    return 1 - EG.trial.startReduction * Math.max(0, (EG.trial.fadeLevel - level) / (EG.trial.fadeLevel - 1));
}
// Convention collective : multiplicateur de dégâts d'élite pour l'étage (modèle local tant que eliteDamageMultForFloor() n'existe pas).
function eliteMult(floor) {
    if (!EG.enabled) return SCALING.eliteDamageMult;
    if (typeof eliteDamageMultForFloor === 'function') return eliteDamageMultForFloor(floor);
    return EG.elites.damageRamp[floor] || SCALING.eliteDamageMult;
}
// Aucune élite aux étages 1-2 : le moteur re-tire (generateMob()) ; sinon modèle local par re-tirage ici.
const engineHandlesFreeFloors = typeof isEarlyEliteFreeFloor === 'function'; // lot 1 : generateMob() re-tire lui-même
function drawMob(floor) {
    const draw = () => generateMob(DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)]);
    let mob = draw();
    if (EG.enabled && !engineHandlesFreeFloors && floor <= EG.elites.freeFloors) {
        for (let k = 0; k < 20 && mob.threatMultiplier >= config.eliteThreatMultiplier; k++) mob = draw();
    }
    return mob;
}
// Remplaçant intérimaire : multiplicateurs PV / ATQ d'un boss (modèle local tant que generateBoss() ne les applique pas lui-même).
const engineHandlesInterim = false; // passe à true au lot 2
function bossScale(floor) {
    return EG.enabled && !engineHandlesInterim && floor <= EG.maxFloor ? EG.interimBoss : { hpMult: 1, atkMult: 1 };
}

// Dégâts moyens d'un tour de boss selon sa phase, dérivés de config.bossPhases (cf. performBossCounterAttackInner()).
function bossTurnMult(hpFraction) {
    const b = config.bossPhases;
    if (hpFraction > 0.66) return (1 - b.phase1TelegraphChance) + b.phase1TelegraphChance * b.telegraphHeavyMult / 2;
    if (hpFraction > 0.33) {
        const base = (1 - b.phase2TelegraphChance) + b.phase2TelegraphChance * b.telegraphHeavyMult / 2;
        const rest = 1 - b.multiStrikeChance - b.rangedHarassChance - b.defBuffTelegraphChance;
        return b.multiStrikeChance * b.multiStrikeTotalMult + b.rangedHarassChance * b.rangedHarassMult + rest * base; // le buff de DEF télégraphié ne frappe pas
    }
    return b.phase3.atkMult;
}

// Un combat contre `mob` (espérance) ; renvoie les PV perdus (0-1 des PV max) et si le joueur meurt.
function fight(player, mob, { boss = false, floor }) {
    const gear = gearFor(floor);
    const scale = boss ? bossScale(floor) : { hpMult: 1, atkMult: 1 };
    const isElite = !boss && mob.threatMultiplier >= config.eliteThreatMultiplier;
    const mobAtk = Math.round(mob.atk * scale.atkMult * (isElite ? eliteMult(floor) : 1));
    const playerHit = expectedDamage(player.atk + gear.atk, mob.def);
    const mobHit = expectedDamage(mobAtk, player.def + gear.def, { pressureFloor: player.hp * SCALING.pressureFloorFrac, minMitigation: SCALING.minMitigation }) * trialMult(player.level, floor);
    const mobHp = mob.hp * scale.hpMult;
    let remaining = mobHp, hp = player.hp, turns = 0;
    while (remaining > 0 && hp > 0 && turns < 300) {
        turns++; remaining -= playerHit; if (remaining <= 0) break;
        hp -= mobHit * (boss ? bossTurnMult(remaining / mobHp) : 1);
    }
    return { lost: (player.hp - Math.max(0, hp)) / player.hp, dead: hp <= 0, isElite };
}

// Mesure sur `n` mobs tirés : { ordinaires, élites } -> { lost, dead, count }.
function measureMobs(floor, level, n = SAMPLES) {
    gameState.currentFloor = floor;
    const player = playerAt(level); gameState.maxHp = player.hp;
    const acc = { ord: { lost: 0, dead: 0, count: 0 }, elite: { lost: 0, dead: 0, count: 0 } };
    for (let i = 0; i < n; i++) {
        const r = fight(player, drawMob(floor), { floor });
        const bucket = r.isElite ? acc.elite : acc.ord;
        bucket.lost += r.lost; bucket.dead += r.dead ? 1 : 0; bucket.count++;
    }
    const norm = (b) => ({ lost: b.count ? b.lost / b.count : 0, dead: b.count ? b.dead / b.count : 0, count: b.count });
    return { ord: norm(acc.ord), elite: norm(acc.elite) };
}

function measureBoss(floor, level, n = BOSS_SAMPLES) {
    gameState.currentFloor = floor;
    const player = playerAt(level); gameState.maxHp = player.hp;
    let wins = 0;
    for (let i = 0; i < n; i++) {
        const boss = generateBoss(DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)]);
        if (!fight(player, boss, { boss: true, floor }).dead) wins++;
    }
    return wins / n;
}

// Exécute `fn` avec le paquet coupé (« avant ») ou actif (« après »).
function withPackage(enabled, fn) { const saved = EG.enabled; EG.enabled = enabled; try { return fn(); } finally { EG.enabled = saved; } }

// ---------------------------------------------------------------------------------------------
console.log(`sim:early — ${SAMPLES} mobs par case, ${BOSS_SAMPLES} boss par case, hasard reproductible. Cases : PV perdus / mort, à PV pleins.`);
console.log(`Paquet : élites libres jusqu'à l'étage ${EG.elites.freeFloors}, rampe ${JSON.stringify(EG.elites.damageRamp)}, intérimaire ×${EG.interimBoss.hpMult}/${EG.interimBoss.atkMult}, essai −${EG.trial.startReduction * 100}% → N${EG.trial.fadeLevel}, scénario → ${EG.plotArmor.leaveHp} PV.`);

const LEVELS = [1, 2, 3, 4, 5, 6, 8, 10];
const results = {};
for (const label of ['avant', 'après']) {
    const enabled = label === 'après';
    withPackage(enabled, () => {
        console.log(`\n=== ${label.toUpperCase()} — mobs ordinaires (hors élites) ===`);
        console.log(`étage |${LEVELS.map(l => pad('N' + l, 9)).join('')}`);
        for (const floor of [1, 2, 3, 4]) {
            const row = LEVELS.map(l => { const m = measureMobs(floor, l); results[`${label}:ord:${floor}:${l}`] = m.ord; return pad(cellText(m.ord), 9); });
            console.log(`  ${floor}   |${row.join('')}`);
        }
        console.log(`--- ${label.toUpperCase()} — élites 💀 (part des mobs, puis PV perdus / mort) ---`);
        console.log(`étage |${LEVELS.map(l => pad('N' + l, 9)).join('')}`);
        for (const floor of [1, 2, 3, 4, 5, 6]) {
            const cells = LEVELS.map(l => { const m = measureMobs(floor, l); results[`${label}:elite:${floor}:${l}`] = m.elite; return m.elite.count >= 20 ? pad(cellText(m.elite), 9) : pad('—', 9); });
            const share = measureMobs(floor, 1).elite.count / SAMPLES;
            console.log(`  ${floor}   |${cells.join('')}   (${(share * 100).toFixed(1)} % des mobs)`);
        }
        console.log(`--- ${label.toUpperCase()} — boss de quartier : P(victoire) à PV pleins ---`);
        const BL = [3, 4, 5, 6, 7, 8, 9, 10];
        console.log(`étage |${BL.map(l => pad('N' + l, 6)).join('')}`);
        for (const floor of [1, 2, 3, 4]) {
            const row = BL.map(l => { const w = measureBoss(floor, l); results[`${label}:boss:${floor}:${l}`] = w; return pad(pct(w).trim(), 6); });
            console.log(`  ${floor}   |${row.join('')}`);
        }
    });
}

// Progression : combats nécessaires pour atteindre chaque niveau (XP moyen d'un mob de l'étage 1).
gameState.currentFloor = 1;
let xp = 0; for (let i = 0; i < SAMPLES; i++) xp += generateMob(DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)]).xpReward;
const avgXp = xp / SAMPLES; let need = 50, cumulative = 0; const rows = [];
for (let l = 2; l <= 9; l++) { cumulative += need; rows.push(`N${l}: ${Math.ceil(cumulative / avgXp)}`); need = Math.round(need * 1.25); }
console.log(`\nProgression (XP moyen d'un mob à l'étage 1 : ${avgXp.toFixed(1)}) — combats pour atteindre le niveau : ${rows.join(' · ')}`);

// Cibles validées par l'utilisateur (chantier 15, round 2) : combat ordinaire étage 1, N1 ≈ 35 % des PV et mort ≤ 5 %.
const target = results['après:ord:1:1'], before = results['avant:ord:1:1'];
const boss5 = results['après:boss:1:5'];
console.log('\n--- Cibles (étage 1, niveau 1, mobs ordinaires) ---');
console.log(`avant : ${(before.lost * 100).toFixed(0)} % des PV, mort ${(before.dead * 100).toFixed(0)} %   |   après : ${(target.lost * 100).toFixed(0)} % des PV, mort ${(target.dead * 100).toFixed(0)} %`);
const okMob = Math.abs(target.lost - 0.35) <= 0.04 && target.dead <= 0.05;
const okBoss = boss5 >= 0.8;
console.log(`cible ≈35 % des PV et mort ≤5 % : ${okMob ? 'ATTEINTE' : 'NON atteinte'} · boss de l'étage 1 battu à ≥80 % dès le niveau 5 : ${okBoss ? 'ATTEINTE' : `NON atteinte (${(boss5 * 100).toFixed(0)} %)`}`);
