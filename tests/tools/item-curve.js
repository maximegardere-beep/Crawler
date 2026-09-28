// item-curve.js — OUTIL DE CALIBRAGE (chantier "refonte des objets"), jamais lancé par la CI.
// `npm run sim:items` : mesure, étage par étage, (1) la répartition des raretés du loot (mob normal,
// mob élite, boss) et (2) la courbe de puissance — combien de tours pour tuer un mob/boss moyen, et
// combien de tours le joueur tient, selon l'équipement porté. Sert à valider chaque proposition
// d'équilibrage du chantier par des chiffres plutôt qu'à l'intuition (voir NOTES_ITEMS.md).
//
// Modèle volontairement simple (moyennes, pas de statuts ni d'enchantements) :
//  - progression du joueur : XP de FIGHTS_PER_FLOOR mobs moyens + BOSSES_PER_FLOOR boss par étage,
//    mêmes gains par niveau que gainXp() (app.js) ;
//  - mobs/boss : moyenne du catalogue (bestiary.js) mis à l'échelle par getFloorScaling() ;
//  - dégâts : espérance de rollDamage() (variance moyenne 1), plancher de pression et mitigation
//    minimale côté mob -> joueur comme resolveEnemyCounterAttack().
require('../test_stub.js');
const { loadGame } = require('../load_game.js');
loadGame();

const FLOORS = 18;
const FIGHTS_PER_FLOOR = 10;
const BOSSES_PER_FLOOR = 2;
const SAMPLES = 20000;

const avg = (list, key) => list.reduce((s, x) => s + (x[key] || 0), 0) / list.length;
const pct = (n) => `${(n * 100).toFixed(1)}%`.padStart(6);
const pad = (v, n) => String(v).padStart(n);

// ---------------------------------------------------------------------------------------------
// Adaptateur : l'outil doit tourner AVANT et APRÈS la refonte du générateur. Seules ces fonctions
// connaissent l'API du jeu ; le reste du script ne manipule que des nombres.
// ---------------------------------------------------------------------------------------------
const NEW_API = typeof computeItemStat === 'function';

// Objets de base accessibles à un étage (minFloor), hors objets blagues.
function basePoolAt(category, floor) {
    return baseItems[category].filter(i => !i.jokeItem && (i.minFloor || 1) <= floor);
}

// Stat moyenne (baseDmg/baseArmor) d'un objet d'une catégorie, d'une rareté et d'un niveau d'objet
// (trouvé à l'étage `itemLevel`, donc parmi les objets de base accessibles à cet étage).
function itemStat(category, rarityKey, itemLevel) {
    const statKey = category === 'armors' ? 'baseArmor' : 'baseDmg';
    const rarity = itemRarities.find(r => r.key === rarityKey);
    if (NEW_API) return computeItemStat(avg(basePoolAt(category, itemLevel), statKey), rarityKey, itemLevel);
    return avg(baseItems[category].filter(i => !i.jokeItem), statKey) * rarity.statMult;
}

// Tire la rareté d'un objet de loot pour un contexte donné ('mob' | 'elite' | 'boss' | 'explore').
function sampleRarity(context, floor) {
    if (NEW_API) return rollLootRarity({ source: context, floor }).key;
    const xpMob = avg(baseMobs, 'xpReward') * getFloorScaling(floor).xpMult;
    const xpBoss = avg(Object.values(districtBosses), 'xpReward') * getFloorScaling(floor).xpMult;
    if (context === 'explore') { gameState.currentFloor = floor; return rollRarity(getLootPowerScore(null)).key; }
    if (context === 'boss') return rollRarity(getLootPowerScore({ xpReward: xpBoss }), config.bossRewards.minRarityKey).key;
    if (context === 'elite') return rollRarity(getLootPowerScore({ xpReward: xpMob * 2.2 })).key;
    return rollRarity(getLootPowerScore({ xpReward: xpMob })).key;
}

// Valeur moyenne d'une arme (qualificatifs = slots de la rareté).
function itemValue(category, rarityKey, itemLevel) {
    if (!NEW_API) return avg(baseItems[category].filter(i => !i.jokeItem), 'baseValue');
    const rarity = itemRarities.find(r => r.key === rarityKey);
    return computeItemValue(avg(basePoolAt(category, itemLevel), 'baseValue'), rarityKey, itemLevel, rarity.slots);
}

// ---------------------------------------------------------------------------------------------
// 1. Répartition des raretés
// ---------------------------------------------------------------------------------------------
const rarityKeys = itemRarities.map(r => r.key);
console.log(`\n=== Raretés du loot (${SAMPLES} tirages par case) — ${NEW_API ? 'NOUVEAU' : 'ANCIEN'} système ===`);
for (const context of ['explore', 'mob', 'elite', 'boss']) {
    console.log(`\n-- ${context} --`);
    console.log('étage ' + rarityKeys.map(k => k.slice(0, 6).padStart(7)).join(''));
    for (const floor of [1, 2, 3, 5, 8, 12, 15, 18]) {
        const counts = Object.fromEntries(rarityKeys.map(k => [k, 0]));
        for (let i = 0; i < SAMPLES; i++) counts[sampleRarity(context, floor)]++;
        console.log(pad(floor, 5) + ' ' + rarityKeys.map(k => ' ' + pct(counts[k] / SAMPLES)).join(''));
    }
}

// ---------------------------------------------------------------------------------------------
// 2. Courbe de puissance
// ---------------------------------------------------------------------------------------------
const mobBase = { hp: avg(baseMobs, 'hp'), atk: avg(baseMobs, 'atk'), def: avg(baseMobs, 'def'), xp: avg(baseMobs, 'xpReward') };
const bosses = Object.values(districtBosses);
const bossBase = { hp: avg(bosses, 'hp'), atk: avg(bosses, 'atk'), def: avg(bosses, 'def'), xp: avg(bosses, 'xpReward') };

function scaled(base, floor) {
    const s = getFloorScaling(floor);
    return { hp: base.hp * s.hpMult, atk: base.atk * s.atkMult, def: base.def * s.defMult, xp: base.xp * s.xpMult };
}

// Joueur au DÉBUT de chaque étage (niveau atteint grâce aux étages précédents).
function playerByFloor() {
    const out = [];
    let level = 1, xp = 0, toNext = 50, atk = 10, def = 5, maxHp = 100;
    for (let floor = 1; floor <= FLOORS; floor++) {
        out.push({ floor, level, atk, def, maxHp });
        const gained = FIGHTS_PER_FLOOR * scaled(mobBase, floor).xp + BOSSES_PER_FLOOR * scaled(bossBase, floor).xp;
        xp += gained;
        while (xp >= toNext) {
            xp -= toNext; level++; toNext = Math.round(toNext * 1.25);
            maxHp += 15; atk += 2 + Math.floor(level / 4); def += 1 + Math.floor(level / 5);
        }
    }
    return out;
}

const hit = (atk, def) => atk * (atk / (atk + def));
function mobHit(mob, player, armor) {
    const def = player.def + armor;
    const raw = Math.max(mob.atk, 0.10 * player.maxHp);
    return raw * Math.max(0.35, mob.atk / (mob.atk + def));
}

// Profils d'équipement : bonus d'arme et d'armure en fonction de l'étage courant.
const PROFILES = {
    'nu': () => ({ w: 0, a: 0 }),
    'commun@étage': (f) => ({ w: itemStat('weapons', 'commun', f), a: itemStat('armors', 'commun', f) }),
    'rare@étage': (f) => ({ w: itemStat('weapons', 'rare', f), a: itemStat('armors', 'rare', f) }),
    'épique@étage': (f) => ({ w: itemStat('weapons', 'epique', f), a: itemStat('armors', 'epique', f) }),
    'légend.@étage': (f) => ({ w: itemStat('weapons', 'legendaire', f), a: itemStat('armors', 'legendaire', f) }),
    'légend.@2 gardé': () => ({ w: itemStat('weapons', 'legendaire', 2), a: itemStat('armors', 'legendaire', 2) }),
    'légend.@5 gardé': (f) => (f < 5 ? { w: 0, a: 0 } : { w: itemStat('weapons', 'legendaire', 5), a: itemStat('armors', 'legendaire', 5) })
};

const players = playerByFloor();
console.log(`\n=== Courbe de puissance (${FIGHTS_PER_FLOOR} mobs + ${BOSSES_PER_FLOOR} boss par étage) ===`);
console.log('Tours pour tuer un mob moyen (T→mob) / un boss moyen (T→boss) ; tours tenus face au mob (mob→T).');
console.log('\nétage niv  ATQ  DEF  PV | mobPV bossPV');
players.forEach(p => {
    const m = scaled(mobBase, p.floor), b = scaled(bossBase, p.floor);
    console.log(`${pad(p.floor, 5)} ${pad(p.level, 3)} ${pad(p.atk, 4)} ${pad(p.def, 4)} ${pad(p.maxHp, 4)} | ${pad(Math.round(m.hp), 5)} ${pad(Math.round(b.hp), 6)}`);
});
for (const [label, profile] of Object.entries(PROFILES)) {
    console.log(`\n-- ${label} --`);
    console.log('étage  +ATQ  +DEF | T→mob T→boss mob→T');
    players.forEach(p => {
        const gear = profile(p.floor);
        const m = scaled(mobBase, p.floor), b = scaled(bossBase, p.floor);
        const atk = p.atk + gear.w;
        const tMob = m.hp / hit(atk, m.def);
        const tBoss = b.hp / hit(atk, b.def);
        const survive = p.maxHp / mobHit(m, p, gear.a);
        console.log(`${pad(p.floor, 5)} ${pad(Math.round(gear.w), 5)} ${pad(Math.round(gear.a), 5)} | ${pad(tMob.toFixed(1), 5)} ${pad(tBoss.toFixed(1), 6)} ${pad(survive.toFixed(1), 5)}`);
    });
}

// ---------------------------------------------------------------------------------------------
// 3. Valeur marchande (arme moyenne)
// ---------------------------------------------------------------------------------------------
console.log('\n=== Valeur (PO) d\'une arme moyenne ===');
console.log('étage ' + rarityKeys.map(k => k.slice(0, 6).padStart(8)).join(''));
for (const floor of [1, 5, 10, 15, 18]) {
    console.log(pad(floor, 5) + ' ' + rarityKeys.map(k => pad(Math.round(itemValue('weapons', k, floor)), 8)).join(''));
}
