// engine/companions.js — Compagnons (crawlers rencontrés).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// COMPAGNONS (CRAWLERS RENCONTRÉS)
// ==========================================

// Chantier "rework des compagnons" (voir NOTES_COMPAGNONS.md) : stats indexées sur l'étage et qui
// montent avec ses niveaux, loyauté plutôt que départ programmé, PV rendus au repos (« à terre » au lieu
// d'être perdu), effets qui suivent la courbe, et dons d'objets / de sorts / de potions. Chiffres dans
// config.companions ; fonctions pures (stats, loyauté d'un don, chance de départ) dans generator.js.

// Compagnon qui AGIT : présent et debout. Un compagnon à terre reste dans le groupe mais n'apporte
// plus rien (ni combat, ni bonus hors combat) jusqu'au prochain repos ou soin.
function activeCompanion() {
    const c = gameState.companion;
    return c && !c.downed && c.hp > 0 ? c : null;
}

function hasActiveCompanion(type) {
    const c = activeCompanion();
    return !!c && c.specialty.type === type;
}

// Cache les deux zones de choix de compagnon (ami / hostile)
function hideCompanionChoiceZones() {
    ui.companionChoiceFriendly.classList.add('hidden');
    ui.companionChoiceHostile.classList.add('hidden');
}

// Résumé d'un candidat, affiché AVANT la décision (spécialité, effet, stats) — pure.
function buildCompanionCandidateSummary(candidate) {
    if (!candidate) return '';
    return `<p class="font-bold text-gray-200">${candidate.name} · <span class="text-emerald-300">${candidate.specialty.label}</span></p>`
        + `<p class="text-gray-400">${candidate.specialty.desc}</p>`
        + `<p class="text-gray-500">❤️ ${candidate.maxHp} PV · ⚔️ ${candidate.atk} ATQ · 🛡️ ${candidate.def} DEF</p>`;
}

// Convertit un candidat compagnon en objet compatible avec le moteur de combat existant (rencontre qui
// tourne à l'affrontement). Ses stats sont déjà à l'échelle de l'étage (generateCompanionCandidate()) ;
// l'XP suit le même scaling que celle d'un mob.
function companionCandidateToMob(candidate) {
    return {
        name: candidate.name,
        hp: candidate.maxHp || candidate.hp,
        atk: candidate.atk,
        def: candidate.def,
        xpReward: Math.round(20 * getFloorScaling(gameState.currentFloor || 1).xpMult),
        effect: null
    };
}

// Bouton "Recruter" (présent dans les deux zones ami/hostile — la chance de succès et les
// conséquences d'un échec diffèrent selon la disposition du candidat).
function recruitCompanion() {
    const candidate = gameState.pendingCompanionCandidate;
    if (!candidate) return;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;

    const successChance = candidate.disposition === 'friendly' ? 70 : 30;
    if (Math.random() * 100 < successChance) {
        gameState.companion = candidate;
        logEvent(`${candidate.name} accepte de vous accompagner ! (${candidate.specialty.label} : ${candidate.specialty.desc})`, "success");
        triggerHaptic('medium');
        updateCompanionUI();
        updateUI();
        return;
    }

    // Échec du recrutement
    if (candidate.disposition === 'friendly') {
        // Un crawler pacifique qui refuse ne devient hostile que dans de très rares cas (5%)
        if (Math.random() * 100 < 5) {
            logEvent(`${candidate.name} se braque brusquement et vous attaque !`, "danger");
            initiateCombat(companionCandidateToMob(candidate));
        } else {
            logEvent(`${candidate.name} décline poliment et s'éloigne.`, "info");
            updateUI();
        }
    } else {
        // Un crawler déjà hostile qui refuse passe directement à l'attaque
        logEvent(`${candidate.name} refuse et se jette sur vous !`, "danger");
        initiateCombat(companionCandidateToMob(candidate));
    }
}

// Bouton "Laisser partir" (zone ami uniquement) : aucun risque
function declineCompanion() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous laissez ${candidate ? candidate.name : "le crawler"} poursuivre son chemin.`, "info");
    updateUI();
}

// Bouton "Fuir" (zone hostile uniquement) : évite l'affrontement avant qu'il ne commence,
// donc toujours réussi (contrairement à une fuite en plein combat, plus risquée).
function fleeCompanionEncounter() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous évitez prudemment ${candidate ? candidate.name : "ce crawler hostile"}.`, "info");
    updateUI();
}

// Bouton "Attaquer" (zone hostile uniquement)
function attackCompanionEncounter() {
    const candidate = gameState.pendingCompanionCandidate;
    hideCompanionChoiceZones();
    gameState.companionChoicePending = false;
    gameState.pendingCompanionCandidate = null;
    logEvent(`Vous attaquez ${candidate ? candidate.name : "le crawler hostile"} !`, "danger");
    initiateCombat(companionCandidateToMob(candidate));
}

// --- Loyauté ---

// Fait varier la loyauté (bornée 0..max) et prévient UNE fois quand elle passe sous le seuil de départ.
// Renvoie la variation réellement appliquée.
function changeCompanionLoyalty(delta) {
    const c = gameState.companion;
    if (!c || !delta) return 0;
    const bal = config.companions.loyalty;
    const before = c.loyalty;
    c.loyalty = Math.max(0, Math.min(bal.max, before + delta));
    if (c.loyalty !== before) recordRunEvent('loyalty');
    if (before >= bal.departureThreshold && c.loyalty < bal.departureThreshold) {
        logEvent(`${c.name} semble de moins en moins investi(e) dans l'aventure... (loyauté ${c.loyalty}/100 : risque de départ au prochain étage)`, "danger");
    }
    return c.loyalty - before;
}

// Raisons piochées au hasard quand le compagnon quitte le groupe (voir attemptCompanionDeparture()) :
// registre volontairement absurde/thématique, cohérent avec le reste du bestiaire et des objets.
const COMPANION_ABANDON_REASONS = [
    "en a assez de porter votre équipement de rechange",
    "a reçu une meilleure offre d'un autre groupe de crawlers",
    "prétexte une urgence familiale suspicieusement pratique",
    "estime que le partage du butin n'était pas équitable",
    "a soudainement une peur panique des escaliers",
    "part sans un mot, en emportant discrètement un souvenir",
    "a atteint sa limite de stress hebdomadaire, syndicat oblige",
    "ne supporte plus votre façon de négocier avec les distributeurs automatiques",
    "déclare que ce donjon ne correspond plus à ses valeurs",
    "s'est simplement perdu(e) en cherchant les toilettes, et n'est jamais revenu(e)"
];

// Jet de départ, au changement d'étage uniquement (voir advanceToNextFloor()) : moment narratif et
// prévisible, jamais au milieu d'un combat. Aucun risque tant que la loyauté reste au-dessus du seuil
// (companionDepartureChance()). Départ toujours PACIFIQUE ; il garde ce qu'on lui a donné (contrairement
// à un renvoi, voir dismissCompanion()). Renvoie true s'il est effectivement parti.
function attemptCompanionDeparture() {
    const c = gameState.companion;
    if (!c) return false;
    const chance = companionDepartureChance(c.loyalty);
    if (chance <= 0 || Math.random() * 100 >= chance) return false;

    const reason = COMPANION_ABANDON_REASONS[Math.floor(Math.random() * COMPANION_ABANDON_REASONS.length)];
    const hasGear = Object.values(c.gear || {}).some(Boolean);
    logEvent(`${c.name} ne vous suit pas dans l'escalier : ${reason}${hasGear ? " (et garde ce que vous lui aviez donné)" : ""}.`, "danger");
    gameState.companion = null;
    updateCompanionUI();
    recordRunEvent('companionLeft');
    return true;
}

// --- Progression ---

// Gain d'XP du compagnon (après chaque victoire du joueur tant qu'il est dans le groupe, même à terre).
// Chaque niveau lui donne des stats (+levelStatGain des stats de base) — progresser le rend meilleur,
// plus jamais seulement plus instable.
function gainCompanionXp(amount) {
    const c = gameState.companion;
    if (!c || !amount) return;

    c.xp += amount;
    while (c.xp >= c.xpToNext) {
        c.xp -= c.xpToNext;
        c.level += 1;
        c.xpToNext = Math.round(c.xpToNext * 1.3);
        const oldMaxHp = c.maxHp;
        Object.assign(c, computeCompanionLevelStats(c));
        if (!c.downed) c.hp = Math.min(c.maxHp, c.hp + (c.maxHp - oldMaxHp)); // Les PV gagnés sont aussi rendus
        logEvent(`${c.name} passe niveau ${c.level} (${c.maxHp} PV, ${c.atk} ATQ, ${c.def} DEF).`, "info");
    }
    updateCompanionUI();
}

// Victoire commune : XP, loyauté et soin post-combat du compagnon Premiers secours.
function onCompanionVictory() {
    const c = gameState.companion;
    if (!c) return;
    gainCompanionXp(config.companions.xpPerWin);
    if (!gameState.companion) return;
    if (!c.downed) changeCompanionLoyalty(config.companions.loyalty.victory);
    if (hasActiveCompanion('medic') && gameState.hp < gameState.maxHp) {
        const healed = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * config.companions.medic.postVictoryHealPct)));
        if (healed > 0) logEvent(`${c.name} panse vos plaies après le combat (+${healed} PV).`, "success");
    }
}

// --- PV, à terre ---

// Soigne le compagnon (et le relève s'il était à terre). Renvoie les PV réellement rendus.
function healCompanion(amount) {
    const c = gameState.companion;
    if (!c || !(amount > 0)) return 0;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + Math.round(amount));
    if (c.downed && c.hp > 0) {
        c.downed = false;
        logEvent(`${c.name} se relève, prêt(e) à reprendre du service.`, "success");
    }
    return c.hp - before;
}

// À appeler après tout coup encaissé par le compagnon : à 0 PV, il tombe « à terre » — il reste dans le
// groupe (plus de perte définitive) mais n'aide plus jusqu'au prochain repos ou soin, et perd en loyauté.
function checkCompanionDowned() {
    const c = gameState.companion;
    if (!c || c.downed || c.hp > 0) return false;
    c.hp = 0;
    c.downed = true;
    logEvent(`${c.name} s'effondre, à terre : plus d'aide avant un repos ou une potion.`, "danger");
    changeCompanionLoyalty(config.companions.loyalty.downed);
    return true;
}

// Interception d'un coup destiné au joueur (seul point de passage, mobs ET boss) : la Garde s'interpose
// souvent (guard.interceptChance), les autres spécialités sont parfois « prises dans la mêlée »
// (strayHitChance). Le compagnon absorbe une part du coup ; son armure réduit ce qu'il perd lui-même.
// Renvoie { playerDamage, note } — l'appelant log les dégâts puis appelle checkCompanionDowned().
function companionInterceptHit(damage) {
    damage = applyTrialToDamage(applyStarterBuffToDamage(damage)); // Foutu pour foutu (chantier 14) : +5 % de dégâts subis, puis Période d'essai (chantier 15), avant bouclier et interception
    // Bouclier de Mana (sort utilitaire, chantier 11) : réduit le coup AVANT l'éventuelle interception.
    const shield = gameState.status.manaShield;
    let shieldNote = "";
    if (shield && shield.rounds > 0 && damage > 0) {
        const absorbedByShield = Math.round(damage * shield.pct / 100);
        damage -= absorbedByShield;
        if (absorbedByShield > 0) shieldNote = ` (🔰 bouclier −${absorbedByShield})`;
    }
    const res = companionInterceptHitInner(damage);
    return { playerDamage: res.playerDamage, note: shieldNote + res.note };
}

function companionInterceptHitInner(damage) {
    const c = activeCompanion();
    if (!c || !(damage > 0)) return { playerDamage: damage, note: "" };
    const bal = config.companions;
    const isGuard = c.specialty.type === 'guard';
    const chance = isGuard ? bal.guard.interceptChance : bal.strayHitChance;
    if (Math.random() * 100 >= chance) return { playerDamage: damage, note: "" };

    const absorbPct = bal.guard.absorbMin + Math.random() * (bal.guard.absorbMax - bal.guard.absorbMin);
    const absorbed = Math.min(damage, Math.round(damage * absorbPct));
    if (absorbed <= 0) return { playerDamage: damage, note: "" };
    const taken = Math.max(1, absorbed - Math.round(getCompanionDef(c) * 0.5));
    c.hp = Math.max(0, c.hp - taken);
    const verb = isGuard ? "encaisse" : "pris(e) dans la mêlée, encaisse";
    const armorNote = taken < absorbed ? `, −${taken} PV pour lui` : "";
    return { playerDamage: damage - absorbed, note: ` (${c.name} ${verb} ${absorbed} dégâts à votre place${armorNote})` };
}

// --- Aide en combat ---

// Appui du compagnon après chaque attaque du joueur (voir performPlayerAttack()) : un sort donné a une
// chance d'être lancé ; sinon la Frappe d'appoint frappe à chaque fois, les autres spécialités sur un
// coup d'opportunité. Dégâts en part de l'ATQ EFFECTIVE (arme donnée comprise), sans jet de défense.
function companionCombatSupport(enemy) {
    const c = activeCompanion();
    if (!c || !enemy || enemy.hp <= 0) return;
    const s = config.companions.support;
    const spell = c.gear && c.gear.spell;
    if (spell && spell.spellCategory !== 'any' && Math.random() * 100 < s.spellCastChance) {
        const dmg = Math.max(1, Math.round((getCompanionAtk(c) + (spell.baseDmg || 0)) * s.spellRatio * (gameState.anomalyEffects.spellMult || 1)));
        enemy.hp -= dmg;
        logEvent(`${c.name} lance [${spell.spellName || spell.name}] ! (+${dmg} dégâts)`, "info");
        return;
    }
    const isStriker = c.specialty.type === 'strike';
    if (!isStriker && Math.random() * 100 >= s.opportunisticChance) return;
    const dmg = Math.max(1, Math.round(getCompanionAtk(c) * s.strikeRatio));
    enemy.hp -= dmg;
    logEvent(`${c.name} ${isStriker ? "porte un coup supplémentaire" : "profite d'une ouverture"} ! (+${dmg} dégâts)`, "info");
}

// Compagnon Premiers secours : chance de soigner le joueur après une riposte ennemie (part de ses PV max,
// pour suivre la courbe), et de lui rendre un peu de mana si un sort est équipé.
function companionMedicAfterRiposte() {
    const c = activeCompanion();
    const m = config.companions.medic;
    if (!c || c.specialty.type !== 'medic' || Math.random() * 100 >= m.healChance) return;
    const actualHeal = applyPlayerHeal(Math.max(5, Math.round(gameState.maxHp * m.healPct)));
    logEvent(`${c.name} vous soigne rapidement ! (+${actualHeal} PV)`, "success");
    if (gameState.equipment.spell && gameState.mana < gameState.maxMana) {
        const manaGain = m.manaMin + Math.floor(Math.random() * (m.manaMax - m.manaMin + 1));
        gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaGain);
        logEvent(`${c.name} restaure aussi un peu de votre mana ! (+${manaGain} Mana)`, "success");
    }
}

// Risque d'embuscade d'un trajet (lieu connu, ville, zone inexplorée) : 9 % par unité de distance,
// plafonné à 80 % — réduit par un compagnon Garde (il ouvre la marche).
function computeAmbushBaseChance(distance) {
    const base = Math.min(80, distance * 9);
    return hasActiveCompanion('guard') ? base * config.companions.guard.ambushMult : base;
}

// --- Dons (objets, sorts, potions) ---

// Pose un objet sur l'emplacement du compagnon, avec la loyauté du don. Renvoie l'objet qu'il portait
// à cet emplacement (à rendre au joueur) et la loyauté gagnée.
function equipCompanionGift(item, slot) {
    const c = gameState.companion;
    const loyaltyGain = companionGiftLoyalty(item);
    item.companionGifted = true;
    const previous = c.gear[slot] || null;
    c.gear[slot] = item;
    const gained = changeCompanionLoyalty(loyaltyGain);
    recordRunEvent('companionGift', { item });
    return { previous, gained };
}

const COMPANION_SLOT_LABELS = { weapon: 'arme', armor: 'armure', spell: 'sort' };

function describeCompanionGiftEffect(c, slot, before) {
    if (slot === 'weapon') return `ATQ ${before} → ${getCompanionAtk(c)}`;
    if (slot === 'armor') return `DEF ${before} → ${getCompanionDef(c)}`;
    return `${config.companions.support.spellCastChance} % de chance de le lancer à chacune de vos attaques`;
}

// Donne un objet de la réserve (arme, arme à distance, armure — ou potion, voir
// giveConsumableToCompanion()). L'objet qu'il portait au même emplacement revient dans la réserve (le
// nombre d'objets de la réserve ne change donc jamais).
function giveItemToCompanion(index) {
    const c = gameState.companion;
    const item = gameState.inventory[index];
    if (!c || !item) return false;
    if (item.category === 'consumables') return giveConsumableToCompanion(index);
    const slot = companionGiftSlot(item);
    if (!slot || slot === 'spell') return false;

    const before = slot === 'weapon' ? getCompanionAtk(c) : getCompanionDef(c);
    gameState.inventory.splice(index, 1);
    const { previous, gained } = equipCompanionGift(item, slot);
    if (previous) gameState.inventory.push(previous);
    logEvent(`Vous donnez [${formatItemDisplayName(item)}] à ${c.name} (${describeCompanionGiftEffect(c, slot, before)}${gained > 0 ? `, +${gained} loyauté` : ""})${previous ? ` — il vous rend [${formatItemDisplayName(previous)}]` : ""}.`, "success");
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    return true;
}

// Donne un parchemin du grimoire : il l'apprend (un seul sort à la fois), l'ancien revient au grimoire.
function giveSpellToCompanion(index) {
    const c = gameState.companion;
    const spell = gameState.spellbook[index];
    if (!c || !spell) return false;
    gameState.spellbook.splice(index, 1);
    const { previous, gained } = equipCompanionGift(spell, 'spell');
    if (previous) gameState.spellbook.push(previous);
    logEvent(`Vous confiez [${formatItemDisplayName(spell)}] à ${c.name} (${describeCompanionGiftEffect(c, 'spell')}${gained > 0 ? `, +${gained} loyauté` : ""})${previous ? ` — il vous rend [${formatItemDisplayName(previous)}]` : ""}.`, "success");
    updateCompanionUI();
    updateUI();
    updateSpellbookUI();
    return true;
}

// Donne une potion : elle soigne le compagnon sur-le-champ (et le relève s'il est à terre). Refusé si la
// potion ne rend pas de PV ou s'il est déjà en pleine forme — pas de potion gâchée.
function giveConsumableToCompanion(index) {
    const c = gameState.companion;
    const item = gameState.inventory[index];
    if (!c || !item || item.category !== 'consumables') return false;
    if (!(item.heal > 0)) {
        logEvent(`${c.name} n'a que faire de [${item.name}] : aucun PV à en tirer.`, "info");
        return false;
    }
    if (!c.downed && c.hp >= c.maxHp) {
        logEvent(`${c.name} est déjà en pleine forme — gardez [${item.name}] pour plus tard.`, "info");
        return false;
    }
    gameState.inventory.splice(index, 1);
    const healed = healCompanion(item.heal);
    const gained = changeCompanionLoyalty(companionGiftLoyalty(item));
    logEvent(`${c.name} boit [${item.name}] (+${healed} PV${gained > 0 ? `, +${gained} loyauté` : ""}).`, "success");
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    return true;
}

// Potion la plus adaptée pour soigner le compagnon : la plus petite qui couvre ses PV manquants, sinon
// la plus forte. Renvoie son index dans l'inventaire, ou -1.
function findCompanionPotionIndex() {
    const c = gameState.companion;
    if (!c) return -1;
    const missing = c.maxHp - c.hp;
    let best = -1;
    gameState.inventory.forEach((item, i) => {
        if (item.category !== 'consumables' || !(item.heal > 0)) return;
        if (best === -1) { best = i; return; }
        const cur = gameState.inventory[best];
        const covers = item.heal >= missing, curCovers = cur.heal >= missing;
        if (covers && (!curCovers || item.heal < cur.heal)) best = i;
        else if (!covers && !curCovers && item.heal > cur.heal) best = i;
    });
    return best;
}

// Renvoi volontaire du compagnon (fiche compagnon) : il part en vous rendant ce que vous lui aviez donné,
// rangé comme n'importe quel butin (storeLootItem() : sort au grimoire, arme/armure dans la réserve, ou
// revendue d'office si elle est pleine).
function dismissCompanion() {
    const c = gameState.companion;
    if (!c || isActionBlocked()) return false;
    logEvent(`Vous congédiez ${c.name}, qui s'éloigne en haussant les épaules.`, "info");
    gameState.companion = null;
    ['weapon', 'armor', 'spell'].forEach(slot => {
        const item = c.gear && c.gear[slot];
        if (item) storeLootItem(item, `Rendu par ${c.name} — `);
    });
    recordRunEvent('companionDismissed');
    updateCompanionUI();
    updateUI();
    updateInventoryUI();
    updateSpellbookUI();
    return true;
}

// Action « Donner à <nom> » ajoutée aux panneaux d'inspection de la réserve et du grimoire.
function companionGiveAction(onClick) {
    const c = gameState.companion;
    return c ? [{ label: `Donner à ${c.name}`, tone: 'good', onClick }] : [];
}

// --- Affichage ---

// Reconstruit l'affichage compact du compagnon (hors combat) : nom, spécialité, PV, barre de loyauté.
function updateCompanionUI() {
    const companion = gameState.companion;
    if (!companion) {
        ui.companionStatusBar.classList.add('hidden');
        return;
    }
    ui.companionStatusBar.classList.remove('hidden');
    ui.companionNameDisplay.innerText = companion.name;
    ui.companionSpecialtyDisplay.innerText = `(${companion.specialty.label})`;
    if (ui.companionHpDisplay) {
        ui.companionHpDisplay.innerText = companion.downed ? "À terre" : `❤️ ${companion.hp}/${companion.maxHp}`;
        ui.companionHpDisplay.style.color = companion.downed ? '#f87171' : '';
    }
    ui.companionLoyaltyBar.style.width = `${companion.loyalty}%`;
    ui.companionLoyaltyBar.style.background = hpColor(companion.loyalty / 100); // Vert = loyal, rouge = prêt à partir
    ui.companionStatusBar.title = `Loyauté ${companion.loyalty}/100 — toucher pour voir sa fiche`;
}

// Fiche du compagnon (HTML pur) : stats effectives, loyauté, équipement donné, mode d'emploi des dons.
function buildCompanionSheetHtml(c) {
    if (!c) return '';
    const threshold = config.companions.loyalty.departureThreshold;
    const loyaltyNote = c.loyalty < threshold
        ? `<span class="text-red-400">risque de départ au prochain étage (${companionDepartureChance(c.loyalty)} %)</span>`
        : `<span class="text-emerald-400">aucun risque de départ</span>`;
    const gearRow = (slot, icon) => {
        const item = c.gear && c.gear[slot];
        return `<li class="flex justify-between gap-2"><span class="shrink-0">${icon} ${COMPANION_SLOT_LABELS[slot]}</span><span class="text-gray-200 text-right">${item ? formatItemDisplayName(item) : '<span class="text-gray-600 italic">rien</span>'}</span></li>`;
    };
    return `<div>
            <p class="font-bold text-sm text-gray-100">🐾 ${c.name} <span class="text-[10px] text-gray-500">niveau ${c.level}</span></p>
            <p class="text-emerald-300 font-bold">${c.specialty.label}</p>
            <p class="text-gray-400">${c.specialty.desc}</p>
        </div>
        <ul class="flex flex-col gap-0.5 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5">
            <li class="flex justify-between"><span>❤️ PV</span><span class="font-bold ${c.downed ? 'text-red-400' : 'text-gray-100'}">${c.downed ? 'À terre' : `${c.hp}/${c.maxHp}`}</span></li>
            <li class="flex justify-between"><span>⚔️ ATQ</span><span class="font-bold text-gray-100">${getCompanionAtk(c)}</span></li>
            <li class="flex justify-between"><span>🛡️ DEF</span><span class="font-bold text-gray-100">${getCompanionDef(c)}</span></li>
            <li class="flex justify-between"><span>🤝 Loyauté</span><span class="font-bold text-gray-100">${c.loyalty}/100</span></li>
        </ul>
        <p class="text-[10px]">${loyaltyNote}</p>
        <ul class="flex flex-col gap-0.5">${gearRow('weapon', '⚔️')}${gearRow('armor', '🛡️')}${gearRow('spell', '✨')}</ul>
        <p class="text-[10px] text-gray-500">Touchez un objet de votre réserve ou un sort de votre grimoire pour le lui donner : il gagne en force et en loyauté. Une potion le soigne, et le relève s'il est à terre.</p>`;
}

function openCompanionSheet() {
    const c = gameState.companion;
    if (!c || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = buildCompanionSheetHtml(c);
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = '#047857';
    const actions = [];
    const potionIndex = findCompanionPotionIndex();
    if (potionIndex >= 0 && (c.downed || c.hp < c.maxHp)) {
        const potion = gameState.inventory[potionIndex];
        actions.push({ label: `Donner [${potion.name}] (+${potion.heal} PV)`, tone: 'good', onClick: () => giveConsumableToCompanion(potionIndex) });
    }
    actions.push({ label: 'Congédier', tone: 'danger', disabled: isActionBlocked(), onClick: openDismissCompanionConfirm });
    renderInspectActions(actions);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Confirmation du renvoi : jamais d'un seul toucher.
function openDismissCompanionConfirm() {
    const c = gameState.companion;
    if (!c || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = `<p class="font-bold text-sm text-gray-100">Congédier ${c.name} ?</p><p class="text-gray-400">Il vous rendra ce que vous lui avez donné, puis partira pour de bon.</p>`;
    renderInspectActions([{ label: `Oui, congédier ${c.name}`, tone: 'danger', onClick: dismissCompanion }]);
    ui.itemInspectOverlay.classList.remove('hidden');
}
