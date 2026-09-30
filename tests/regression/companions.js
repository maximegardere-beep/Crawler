// companions.js — tests régression : rework des compagnons (voir NOTES_COMPAGNONS.md) — stats indexées
// sur l'étage et par niveau, loyauté et départ au changement d'étage, « à terre » au lieu d'une perte
// définitive, effets de spécialité, dons d'objets / de sorts / de potions, renvoi, migration de sauvegarde.
const { assert, resetTransientState } = require('./_helpers.js');

function withRandom(values, fn) {
    const original = Math.random;
    let i = 0;
    Math.random = () => (Array.isArray(values) ? values[Math.min(i++, values.length - 1)] : values);
    try { return fn(); } finally { Math.random = original; }
}

function makeCompanion(type = 'strike', overrides = {}) {
    const c = withRandom(0.5, () => generateCompanionCandidate(1));
    c.specialty = companionSpecialties.find(s => s.type === type);
    Object.assign(c, overrides);
    return c;
}

// --- Candidat : modèle, stats indexées sur l'étage ---
{
    resetTransientState();
    const c1 = withRandom(0.5, () => generateCompanionCandidate(1));
    const c10 = withRandom(0.5, () => generateCompanionCandidate(10));
    assert(c1.leaveChance === undefined, "Plus de leaveChance : remplacée par la loyauté");
    assert(c1.loyalty === config.companions.loyalty.start && c1.loyalty === 60, "Loyauté de départ : 60");
    assert(c1.downed === false && c1.hp === c1.maxHp, "Candidat debout, PV pleins");
    assert(c1.gear && c1.gear.weapon === null && c1.gear.armor === null && c1.gear.spell === null, "Candidat sans équipement");
    assert(c10.maxHp > c1.maxHp && c10.atk > c1.atk && c10.def >= c1.def, "Stats du candidat indexées sur l'étage (étage 10 > étage 1)");
    assert(c1.hiredFloor === 1 && c10.hiredFloor === 10, "Étage d'embauche mémorisé");
    const summary = buildCompanionCandidateSummary(c1);
    assert(summary.includes(c1.specialty.label) && summary.includes(`${c1.atk} ATQ`), "Aperçu au recrutement : spécialité et stats visibles avant de décider");
    const mob = companionCandidateToMob(c10);
    assert(mob.hp === c10.maxHp && mob.atk === c10.atk, "Crawler hostile : mêmes stats (à l'échelle de l'étage) que le candidat");
    gameState.currentFloor = 10;
    assert(companionCandidateToMob(c10).xpReward > 20, "Crawler hostile : XP à l'échelle de l'étage");
    gameState.currentFloor = 1;
}

// --- Progression : chaque niveau donne des stats, jamais un départ ---
{
    resetTransientState();
    const c = makeCompanion('guard', { xp: 0, xpToNext: 30 });
    gameState.companion = c;
    const base = { hp: c.maxHp, atk: c.atk, def: c.def };
    const stats5 = computeCompanionLevelStats({ ...c, level: 5 });
    assert(stats5.atk === Math.round(c.baseAtk * 1.4), "+10 % des stats de base par niveau (niveau 5 = ×1,4)");
    withRandom(0, () => gainCompanionXp(1000));
    assert(gameState.companion === c, "Monter de niveau ne fait jamais partir le compagnon");
    assert(c.level > 1 && c.maxHp > base.hp && c.atk > base.atk, "Monter de niveau augmente PV max et ATQ");
    assert(c.hp === c.maxHp, "Les PV gagnés en montant de niveau sont aussi rendus");
}

// --- Loyauté et départ au changement d'étage ---
{
    resetTransientState();
    assert(companionDepartureChance(40) === 0 && companionDepartureChance(90) === 0, "Aucun risque de départ à partir de 40 de loyauté");
    assert(companionDepartureChance(30) === 20 && companionDepartureChance(0) === 80, "Risque de départ = (40 − loyauté) × 2 %");

    gameState.companion = makeCompanion('scout', { loyalty: 60 });
    withRandom(0, () => attemptCompanionDeparture());
    assert(gameState.companion !== null, "Loyauté 60 : jamais de départ, même au pire jet");
    gameState.companion.loyalty = 5;
    withRandom(0.99, () => attemptCompanionDeparture());
    assert(gameState.companion !== null, "Loyauté basse : reste si le jet échoue");
    withRandom(0, () => attemptCompanionDeparture());
    assert(gameState.companion === null, "Loyauté basse : part si le jet réussit");
    assert(advanceToNextFloor.toString().includes('attemptCompanionDeparture()'), "Le jet de départ a lieu au changement d'étage");

    gameState.companion = makeCompanion('scout', { loyalty: 95 });
    changeCompanionLoyalty(50);
    assert(gameState.companion.loyalty === 100, "Loyauté plafonnée à 100");
    changeCompanionLoyalty(-500);
    assert(gameState.companion.loyalty === 0, "Loyauté jamais sous 0");
}

// --- Victoire commune : XP + loyauté + soin du Premiers secours ---
{
    resetTransientState();
    gameState.companion = makeCompanion('medic', { loyalty: 50 });
    gameState.hp = 50;
    onCompanionVictory();
    assert(gameState.companion.loyalty === 52, "Victoire commune : +2 loyauté");
    assert(gameState.companion.xp === config.companions.xpPerWin || gameState.companion.level > 1, "Victoire commune : XP du compagnon");
    assert(gameState.hp === 54, "Premiers secours : soin post-victoire de 4 % des PV max");
}

// --- Fuite : −5 loyauté ---
{
    resetTransientState();
    gameState.companion = makeCompanion('strike', { loyalty: 50 });
    gameState.inCombat = true;
    gameState.currentEnemy = { name: "Rat", hp: 10, maxHp: 10, atk: 1, def: 0 };
    withRandom(0, () => attemptFlee());
    assert(gameState.inCombat === false && gameState.companion.loyalty === 45, "Fuite réussie : −5 loyauté");
}

// --- Interception, à terre, relevé ---
{
    resetTransientState();
    const c = makeCompanion('guard', { loyalty: 50 });
    gameState.companion = c;
    const defWithGuard = getEffectiveDef();
    const res = withRandom(0, () => companionInterceptHit(40));
    assert(res.playerDamage < 40 && res.note.includes(c.name), "Garde : s'interpose et absorbe une part du coup");
    c.hp = 1;
    withRandom(0, () => companionInterceptHit(40));
    assert(checkCompanionDowned() === true, "À 0 PV, le compagnon tombe à terre");
    assert(gameState.companion === c && c.downed === true, "À terre : il reste dans le groupe (plus de perte définitive)");
    assert(c.loyalty === 40, "Tomber à terre : −10 loyauté");
    assert(activeCompanion() === null && !hasActiveCompanion('guard'), "À terre : inactif");
    assert(getEffectiveDef() < defWithGuard, "À terre : la Garde n'apporte plus sa DEF");
    const hpBefore = c.hp;
    applyTimeElapsedRegen(5);
    assert(c.hp === hpBefore, "À terre : aucune régénération passive");
    assert(healCompanion(10) === 10 && c.downed === false, "Un soin relève le compagnon");
    c.hp = Math.round(c.maxHp * 0.3);
    applyTimeElapsedRegen(1);
    assert(c.hp === Math.round(c.maxHp * 0.3) + 10, "Régénération passive du compagnon au même rythme que le joueur");

    const other = makeCompanion('medic');
    gameState.companion = other;
    const stray = withRandom(0, () => companionInterceptHit(40));
    assert(stray.playerDamage < 40, "Autres spécialités : parfois prises dans la mêlée");
    const none = withRandom(0.5, () => companionInterceptHit(40));
    assert(none.playerDamage === 40, "Autres spécialités : la plupart du temps, aucun coup encaissé");
}

// --- Repos en salle sécurisée : soin, relevé, loyauté ---
{
    resetTransientState();
    gameState.currentFloor = 1;
    generateFloorMap();
    const room = Object.values(gameState.floorMap.roomsById).find(r => r.type === 'safe');
    gameState.floorMap.currentRoomId = room.id;
    const c = makeCompanion('guard', { loyalty: 50, hp: 0, downed: true });
    gameState.companion = c;
    enterRoom(room);
    restAtSafehouse('nap');
    assert(c.downed === false && c.hp === Math.round(c.maxHp * 0.25), "Sieste : relève le compagnon avec 25 % de ses PV perdus");
    assert(c.loyalty === 55, "Sieste partagée : +5 loyauté");
    enterRoom(room);
    restAtSafehouse('sleep');
    assert(c.hp === c.maxHp && c.loyalty === 65, "Sommeil : PV pleins et +10 loyauté");
}

// --- Aide en combat ---
{
    resetTransientState();
    const striker = makeCompanion('strike');
    gameState.companion = striker;
    const enemy = { name: "Mannequin", hp: 500, maxHp: 500, atk: 1, def: 0 };
    withRandom(0.99, () => companionCombatSupport(enemy));
    assert(enemy.hp === 500 - Math.max(1, Math.round(striker.atk * 0.35)), "Frappe d'appoint : frappe à chaque attaque (35 % de son ATQ)");

    const medic = makeCompanion('medic');
    gameState.companion = medic;
    const e2 = { name: "Mannequin", hp: 500, maxHp: 500, atk: 1, def: 0 };
    withRandom(0.99, () => companionCombatSupport(e2));
    assert(e2.hp === 500, "Autres spécialités : pas de coup sans ouverture");
    withRandom(0.1, () => companionCombatSupport(e2));
    assert(e2.hp < 500, "Autres spécialités : coup d'opportunité (25 %)");

    const weapon = generateItem({ category: 'weapons', rarityKey: 'rare', jitter: false });
    medic.gear.weapon = weapon;
    assert(getCompanionAtk(medic) === medic.atk + weapon.baseDmg, "Arme donnée : ATQ effective = ATQ + dégâts de l'arme");
    let spell = generateSpellScroll({ rarityKey: 'commun', jitter: false });
    while (spell.spellCategory === 'any') spell = generateSpellScroll({ rarityKey: 'commun', jitter: false }); // un compagnon ne lance que les sorts offensifs
    medic.gear.spell = spell;
    const e3 = { name: "Mannequin", hp: 500, maxHp: 500, atk: 1, def: 0 };
    withRandom(0, () => companionCombatSupport(e3));
    assert(e3.hp === 500 - Math.round((getCompanionAtk(medic) + spell.baseDmg) * 0.6), "Sort donné : lancé (60 % de ATQ + dégâts du sort)");

    const downed = makeCompanion('strike', { hp: 0, downed: true });
    gameState.companion = downed;
    const e4 = { name: "Mannequin", hp: 500, maxHp: 500, atk: 1, def: 0 };
    companionCombatSupport(e4);
    assert(e4.hp === 500, "Un compagnon à terre ne frappe pas");
}

// --- Utilités hors combat ---
{
    resetTransientState();
    gameState.companion = makeCompanion('guard');
    assert(computeAmbushBaseChance(4) === 36 * 0.75, "Garde : −25 % de risque d'embuscade en trajet");
    gameState.companion = null;
    assert(computeAmbushBaseChance(4) === 36 && computeAmbushBaseChance(20) === 80, "Sans Garde : 9 % par unité, plafonné à 80 %");

    gameState.companion = makeCompanion('scout');
    const stealthWith = getStealthChance();
    gameState.companion.downed = true;
    assert(stealthWith - getStealthChance() === 10, "Éclaireur : +10 furtivité (rien s'il est à terre)");
    gameState.companion.downed = false;
    gameState.hp = 80;
    // d100 = 70 : piège (nothing 37 + combat 25 + loot 4 = 66 ; trap jusqu'à 76), puis jets à 0 → évité
    withRandom([0.70, 0, 0, 0], () => resolveCardEvent());
    assert(gameState.hp === 80, "Éclaireur : évite le piège quand le jet réussit");
    gameState.companion = null;
    withRandom([0.70, 0, 0, 0], () => resolveCardEvent());
    assert(gameState.hp < 80, "Contrôle : sans Éclaireur, le même tirage déclenche bien le piège");
}

// --- Dons : armes, armures, sorts, potions ---
{
    resetTransientState();
    const c = makeCompanion('strike', { loyalty: 50 });
    gameState.companion = c;
    gameState.inventory = [];
    const sword = generateItem({ category: 'weapons', rarityKey: 'rare', jitter: false });
    const bow = generateItem({ category: 'ranged', rarityKey: 'epique', jitter: false });
    const armor = generateItem({ category: 'armors', rarityKey: 'commun', jitter: false });
    gameState.inventory.push(sword, bow, armor);

    const atkBefore = getCompanionAtk(c);
    assert(giveItemToCompanion(0) === true, "Donner une arme de la réserve");
    assert(c.gear.weapon === sword && getCompanionAtk(c) === atkBefore + sword.baseDmg, "Arme donnée : équipée, ATQ en hausse");
    assert(c.loyalty === 58, "Don d'un objet Rare : +8 loyauté");
    assert(!gameState.inventory.includes(sword), "L'objet donné quitte la réserve");

    const bowIndex = gameState.inventory.indexOf(bow);
    giveItemToCompanion(bowIndex);
    assert(c.gear.weapon === bow && gameState.inventory.includes(sword), "Arme à distance donnée : remplace son arme, l'ancienne revient dans la réserve");
    assert(c.loyalty === 70, "Don d'un objet Épique : +12 loyauté");
    giveItemToCompanion(gameState.inventory.indexOf(sword));
    assert(c.gear.weapon === sword && c.loyalty === 70, "Redonner un objet déjà donné : aucune loyauté (pas de boucle infinie)");

    const defBefore = getCompanionDef(c);
    giveItemToCompanion(gameState.inventory.indexOf(armor));
    assert(c.gear.armor === armor && getCompanionDef(c) === defBefore + armor.baseArmor && c.loyalty === 75, "Armure donnée : DEF en hausse, +5 loyauté (Commun)");

    gameState.spellbook = [generateSpellScroll({ rarityKey: 'legendaire', jitter: false }), generateSpellScroll({ rarityKey: 'camelote', jitter: false })];
    const legendary = gameState.spellbook[0];
    assert(giveSpellToCompanion(0) === true && c.gear.spell === legendary, "Donner un sort du grimoire");
    assert(c.loyalty === 93 && gameState.spellbook.length === 1, "Sort Légendaire : +18 loyauté, retiré du grimoire");
    giveSpellToCompanion(0);
    assert(gameState.spellbook.includes(legendary) && gameState.spellbook.length === 1, "Nouveau sort : l'ancien revient au grimoire");

    let potion = null;
    while (!potion || !(potion.heal > 0)) potion = generateItem({ category: 'consumables', rarityKey: 'commun', jitter: false }); // pas une potion de mana seul
    const manaOnly = { name: "Fiole bleue", category: 'consumables', heal: 0, mana: 20 };
    gameState.inventory.push(manaOnly);
    c.hp = 1;
    assert(giveConsumableToCompanion(gameState.inventory.indexOf(manaOnly)) === false && gameState.inventory.includes(manaOnly), "Potion de mana seul refusée : aucun PV à en tirer");
    gameState.inventory.splice(gameState.inventory.indexOf(manaOnly), 1);
    c.hp = c.maxHp;
    gameState.inventory.push(potion);
    const potionIndex = gameState.inventory.indexOf(potion);
    assert(giveConsumableToCompanion(potionIndex) === false && gameState.inventory.includes(potion), "Potion refusée si le compagnon est en pleine forme");
    c.hp = 0; c.downed = true;
    assert(findCompanionPotionIndex() === potionIndex, "Potion adaptée trouvée pour le compagnon");
    assert(giveItemToCompanion(potionIndex) === true && c.downed === false && c.hp > 0, "Une potion relève le compagnon à terre");
    assert(!gameState.inventory.includes(potion), "La potion est consommée");

    const sheet = buildCompanionSheetHtml(c);
    assert(sheet.includes(c.name) && sheet.includes('Loyauté') && sheet.includes(sword.name), "Fiche compagnon : loyauté et équipement donné");
    assert(companionGiveAction(() => {}).length === 1, "Action « Donner » proposée tant qu'il y a un compagnon");

    // Renvoi : il rend ce qu'on lui a donné
    const inventoryBefore = gameState.inventory.length;
    assert(dismissCompanion() === true && gameState.companion === null, "Congédier : le compagnon part");
    assert(gameState.inventory.includes(sword) && gameState.inventory.includes(armor) && gameState.inventory.length === inventoryBefore + 2, "Congédier : arme et armure rendues dans la réserve");
    assert(gameState.spellbook.some(s => s.rarityKey === 'camelote'), "Congédier : sort rendu au grimoire");
    gameState.companion = null;
    assert(companionGiveAction(() => {}).length === 0, "Pas d'action « Donner » sans compagnon");
}

// --- Départ volontaire : il garde ses cadeaux ---
{
    resetTransientState();
    const c = makeCompanion('guard', { loyalty: 0 });
    c.gear.weapon = generateItem({ category: 'weapons', rarityKey: 'rare', jitter: false });
    gameState.companion = c;
    gameState.inventory = [];
    withRandom(0, () => attemptCompanionDeparture());
    assert(gameState.companion === null && gameState.inventory.length === 0, "Départ volontaire : il garde ce qu'on lui a donné");
}

// --- Migration d'une sauvegarde antérieure au rework ---
{
    const old = { name: "Doc Ferraille", xp: 5, level: 3, xpToNext: 50, leaveChance: 40, specialty: { type: 'strike', label: 'Frappe' }, hp: 20, maxHp: 50, atk: 11, def: 5 };
    const c = normalizeCompanion(old);
    assert(c.leaveChance === undefined && c.loyalty === 40, "Migration : leaveChance 40 → loyauté 40");
    assert(c.gear && c.downed === false && c.hp === 20, "Migration : équipement vide, PV conservés");
    const stats = computeCompanionLevelStats(c);
    assert(stats.atk === 11 && stats.maxHp === 50 && stats.def === 5, "Migration : les stats actuelles sont conservées exactement");
    assert(normalizeCompanion({ ...old, hp: 0 }).downed === true, "Migration : un compagnon à 0 PV est à terre");
    assert(restoreSaveForName.toString().includes('normalizeCompanion'), "restoreSaveForName() migre le compagnon");
}

assert(typeof triggerCompanionHostileTurn === 'undefined', "L'ancien mécanisme triggerCompanionHostileTurn() a bien été retiré");
assert(typeof attemptCompanionAbandon === 'undefined', "L'ancien départ à chaque niveau (attemptCompanionAbandon()) a bien été retiré");
