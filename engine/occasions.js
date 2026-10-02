// engine/occasions.js — Occasions de combat (mini-jeux V2).
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// OCCASIONS DE COMBAT (chantier 6, V2 — voir NOTES_MINIJEUX.md)
// ==========================================
// Une Occasion est une action SPÉCIALE proposée de façon aléatoire au début d'un tour (25 % en mode Jouer, un peu plus avec le
// niveau de la compétence liée) : un bouton mis en avant, valable CE tour seulement. La prendre consomme le tour ; un échec =
// tour perdu, sans autre pénalité. Mains nues au contact : Immobiliser (puis Étrangler, proposé à coup sûr sur un mob immobilisé
// ou étourdi, jamais un boss). À distance avec une arme à distance : Cible de précision ou Point faible. Jamais en mode « Jet
// automatique » ni sans interface interactive (tests Node, simulation longue). La décision est pure : decideOccasion() (minigames.js).
function createOccasionState() {
    return { current: null, turn: 0, rolledTurn: -1, lastOfferTurn: -9, pity: 0 };
}

function occasionContext() {
    const enemy = gameState.currentEnemy;
    const st = (enemy && enemy.status) || {};
    return {
        distance: gameState.combatDistance || 0,
        hasRanged: !!gameState.equipment.ranged,
        disarmed: !!(gameState.status.disarmed && gameState.status.disarmed.rounds > 0),
        isBoss: !!(enemy && enemy.isBoss),
        immobilized: !!(st.stunned || (st.immobilized && st.immobilized.rounds > 0))
    };
}

// Tire l'Occasion du tour courant (une seule fois par tour, au premier rafraîchissement de l'interface de ce tour).
function rollCombatOccasion() {
    const occ = gameState.occasion;
    if (!occ || !gameState.inCombat || !gameState.currentEnemy || gameState.currentEnemy.hp <= 0) return; // pas d'Occasion pendant un Coup de grâce
    if (occ.rolledTurn === occ.turn) return;
    occ.rolledTurn = occ.turn;
    occ.current = null;
    if (!minigameIsInteractive()) return;
    const type = decideOccasion({
        ctx: occasionContext(), mode: getMinigameMode(),
        skillLevels: { unarmed: gameState.skills.unarmed.level, weapon: gameState.skills.weapon.level },
        turn: occ.turn, lastOfferTurn: occ.lastOfferTurn, pity: occ.pity
    });
    if (!type) return;
    occ.current = { type };
    occ.lastOfferTurn = occ.turn;
    occ.pity = 0;
}

// Bouton « ✨ Occasion » : visible seulement si une Occasion est proposée ET encore possible (la situation a pu changer pendant la riposte).
function updateOccasionButton() {
    const btn = ui.btnOccasion;
    if (!btn) return;
    const occ = gameState.occasion;
    const cur = gameState.inCombat && gameState.currentEnemy && occ && occ.current;
    const valid = !!cur && occasionStillValid(cur.type, occasionContext());
    btn.classList.toggle('hidden', !valid);
    if (valid) {
        const t = OCCASION_TYPES[cur.type];
        const label = `✨ Occasion : ${t.icon} ${t.label}`;
        if (btn.innerText !== label) btn.innerText = label;
    }
}

function buildOccasionSpec(type) {
    const unarmed = gameState.skills.unarmed.level, weapon = gameState.skills.weapon.level;
    switch (type) {
        case 'immobilize': return buildMinigameSpec('grapple', { zoneWidth: holdZoneWidth('grapple', unarmed) });
        case 'strangle': return buildMinigameSpec('choke', { zoneWidth: holdZoneWidth('choke', unarmed) });
        case 'target': return buildMinigameSpec('target', { distance: gameState.combatDistance, skillLevel: weapon });
        default: return buildMinigameSpec('weakpoint');
    }
}

function startOccasion() {
    const occ = gameState.occasion;
    if (!occ || !occ.current || !gameState.inCombat || !gameState.currentEnemy) return;
    if (gameState.pendingMinigame || (ui.btnOccasion && ui.btnOccasion.disabled)) return; // épreuve déjà ouverte, ou tour de l'ennemi en cours
    const type = occ.current.type;
    if (!occasionStillValid(type, occasionContext())) { occ.current = null; updateOccasionButton(); return; }
    occ.current = null;
    updateOccasionButton();
    startMinigame(buildOccasionSpec(type), (outcome, detail) => {
        if (!gameState.inCombat || !gameState.currentEnemy) return; // le combat s'est terminé entre-temps
        resolveOccasion(type, outcome, detail || {});
    });
}

// Applique l'issue d'une Occasion. Échec = tour perdu (la riposte suit normalement), sans autre pénalité.
function resolveOccasion(type, outcome, detail) {
    if (!tryPlayerAction()) return; // saignement mortel ou joueur étourdi : le tour est déjà réglé par tryPlayerAction()
    const enemy = gameState.currentEnemy;
    const failed = outcome === 'fail';
    const mg = MINIGAME_SETTINGS;
    const t = OCCASION_TYPES[type];
    const lostTurn = (msg) => {
        showDie(ui.combatPlayerDie, "✗");
        logEvent(msg, "danger");
        gainSkillXp(t.skill, SKILL_XP_PER_USE); // on apprend même de ses échecs, comme pour un sort raté
        resolveEnemyReaction();
    };

    if (type === 'immobilize') {
        gameState.lastAttackKind = 'unarmed'; // Posture du crawler : garde du boxeur
        if (failed) { lostTurn(`🤼 [${enemy.name}] se dégage de votre prise. Tour perdu.`); return; }
        const rounds = grappleRounds(outcome, !!enemy.isBoss);
        enemy.status.immobilized = { rounds };
        showDie(ui.combatPlayerDie, "🤼");
        logEvent(`🤼 Vous plaquez [${enemy.name}] : immobilisé ${rounds} tour${rounds > 1 ? 's' : ''}${enemy.isBoss ? " (un boss ne résiste pas plus d'un tour)" : ''}.`, "success");
        gainSkillXp('unarmed', SKILL_XP_PER_USE);
        resolveEnemyReaction();
        return;
    }

    if (type === 'strangle') {
        gameState.lastAttackKind = 'unarmed';
        if (failed) { lostTurn(`🪢 [${enemy.name}] se débat et vous échappe. Tour perdu.`); return; }
        const skill = gameState.skills.unarmed;
        const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1));
        const landed = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75 * mg.choke.damageMult * unarmedDamageMult(), varianceRange: 0.10, defReduction }, "en l'étranglant");
        if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
        return;
    }

    // Tir : Cible de précision ou Point faible, avec l'arme à distance équipée.
    gameState.lastAttackKind = 'ranged';
    const gear = gameState.equipment.ranged;
    if (failed || !gear) { lostTurn(type === 'target' ? "🎯 Votre tir passe à côté de la cible. Tour perdu." : "🦴 Vous hésitez trop longtemps : l'occasion est passée. Tour perdu."); return; }
    let mult = 1;
    let label = "d'un tir ajusté";
    if (type === 'target') {
        mult = outcome === 'perfect' ? mg.target.perfectMult : mg.target.successMult;
        label = outcome === 'perfect' ? "en plein centre de la cible" : "d'un tir ajusté";
    } else {
        const zone = WEAKPOINT_ZONES[detail.zone] || WEAKPOINT_ZONES.head;
        mult = zone.dmgMult;
        label = `sur le point faible (${zone.label.toLowerCase()})`;
        // Les effets s'appliquent AVANT le coup : la riposte qui suit en tient compte.
        if (zone.weaken) { enemy.status.weakened = { mult: zone.weaken.mult, rounds: zone.weaken.rounds }; logEvent(`💪 Le bras de [${enemy.name}] est touché : son ATQ baisse.`, "info"); }
        if (zone.push) { setCombatDistance(gameState.combatDistance + zone.push); logEvent(`🦵 La jambe de [${enemy.name}] cède : il recule d'un cran.`, "info"); }
    }
    const skill = gameState.skills.weapon;
    const atkMultiplier = (1.0 + 0.04 * (skill.level - 1)) * mult;
    const effectiveAtk = gameState.atk + (gear.baseDmg || 0);
    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear }, label);
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(gear);
    }
}

// S'approcher : action dédiée au rapprochement, à la place d'une attaque. Toujours disponible dès
// qu'un écart sépare les deux camps (distance > 0 — grisé sinon, voir updateUI()), quel que soit le
// type de mob. Ne porte JAMAIS de dégâts et ne déclenche aucune mécanique d'arme ni XP de
// compétence : en échange, le jet de rapprochement bénéficie d'un avantage (deux dés lancés, le
// meilleur est gardé). Progression garantie : même un jet perdant réduit l'écart d'au moins 1 — le
// mob peut ralentir l'approche, jamais la bloquer totalement. Le joueur reste exposé pendant sa
// course : la riposte est tentée immédiatement après (bloquée si un mob de mêlée est toujours hors
// de portée à l'issue du jet — voir safeEnemyCounterAttack()).
function attemptSprint() {
    if (!tryPlayerAction()) return;
    const enemy = gameState.currentEnemy;
    if (!enemy || gameState.combatDistance <= 0) {
        logEvent("Rien à rattraper pour l'instant.", "info");
        return;
    }

    const cfg = config.rangedCombat;
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
    const rollOnce = () => 1 + Math.floor(Math.random() * cfg.dieSides) + levelBonus;
    const playerRoll = Math.max(rollOnce(), rollOnce()); // Avantage : deux dés, le meilleur gardé
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll;
    // Progression garantie : au moins 1 point d'écart comblé, même si le mob gagne le jet.
    const closingDiff = Math.max(diff, 1);

    setCombatDistance(gameState.combatDistance - closingDiff);
    showDie(ui.combatPlayerDie, "🏃");

    if (gameState.combatDistance <= 0) {
        logEvent(`🏃 Vous foncez et comblez l'écart face à [${enemy.name}] !`, "success");
    } else if (closingDiff === diff) {
        logEvent(`🏃 Vous gagnez du terrain sur [${enemy.name}], mais l'écart n'est pas encore comblé.`, "info");
    } else {
        logEvent(`🏃 [${enemy.name}] esquive votre charge, mais vous grignotez tout de même du terrain.`, "info");
    }
    // Riposte bloquée si un mob de mêlée reste hors de portée à l'issue du jet ; sinon normale
    // (mob à distance qui tire librement, ou mob de mêlée désormais à portée).
    safeEnemyCounterAttack();
}

// S'éloigner : symétrique de S'approcher, dans l'autre sens sur l'écart. Toujours disponible tant
// qu'il reste de la marge (distance < maxDistance — grisé sinon, voir updateUI()), y compris quand
// le joueur est DÉJÀ à distance : le jet, avantagé de la même façon (deux dés, le meilleur gardé),
// pousse alors l'écart encore plus loin. Ne porte jamais de coup, ne déclenche aucune XP. Si le mob
// reste au contact à l'issue du jet, il riposte normalement ; si l'écart s'est ouvert (ou creusé),
// safeEnemyCounterAttack() bloque la riposte d'un mob de mêlée désormais hors de portée.
function attemptRetreat() {
    if (!tryPlayerAction()) return;
    const enemy = gameState.currentEnemy;
    if (!enemy || gameState.combatDistance >= config.rangedCombat.maxDistance) {
        logEvent("Impossible de vous éloigner davantage.", "info");
        return;
    }

    const cfg = config.rangedCombat;
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound); // Manche contestée (voir resolveDistanceRound())
    const levelBonus = Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
    const rollOnce = () => 1 + Math.floor(Math.random() * cfg.dieSides) + levelBonus;
    const playerRoll = Math.max(rollOnce(), rollOnce()); // Avantage : deux dés, le meilleur gardé
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll;

    // Ruée : un mob de mêlée qui gagne ce jet avec une marge franche vous rattrape brutalement,
    // quel que soit l'écart avant la tentative (voir config.rangedCombat.rushMarginThreshold et le
    // même mécanisme dans resolveEnemyReaction()).
    if (!mobWantsFar(enemy) && diff <= -cfg.rushMarginThreshold) {
        setCombatDistance(0);
        showDie(ui.combatPlayerDie, "🏃");
        logEvent(`🏃 [${enemy.name}] se rue et vous rattrape brutalement !`, "danger");
        enemyCounterAttack();
        return;
    }

    const before = gameState.combatDistance;
    setCombatDistance(gameState.combatDistance + diff);
    showDie(ui.combatPlayerDie, "🏃");

    if (gameState.combatDistance > before) {
        logEvent(`↔️ Vous prenez du champ face à [${enemy.name}] !`, "success");
    } else {
        logEvent(`[${enemy.name}] vous colle et vous empêche de vous éloigner.`, "danger");
    }
    safeEnemyCounterAttack();
}

// Charger : action volontaire et engagée (Chantier 3 du rework combat), alternative agressive à
// S'approcher. Ferme l'écart D'UN COUP (sans jet opposé — le prix de cette prise de risque se paie
// sur l'attaque qui suit, pas sur le rapprochement lui-même) et enchaîne IMMÉDIATEMENT une attaque
// bonus (config.engageAction.atkMultiplier, +25%), au prix d'une DEF joueur divisée par 2 pour la
// riposte qui suit (gameState.engageDefHalved, lu par getEffectiveDef() puis consommé par
// tryPlayerAction() au début de la PROCHAINE action — voir ces deux fonctions). Réutilise
// performPlayerAttack() tel quel, jamais une nouvelle formule de dégâts.
function attemptEngage() {
    const enemy = gameState.currentEnemy;
    if (!gameState.inCombat || !enemy || gameState.combatDistance <= 0) {
        logEvent("Rien à charger : déjà au corps à corps.", "info");
        return;
    }
    if (!tryPlayerAction()) return;

    setCombatDistance(0);
    showDie(ui.combatPlayerDie, "⚔️");
    logEvent(`⚔️ Vous chargez [${enemy.name}] sans retenue, garde grande ouverte !`, "info");

    gameState.engageDefHalved = true;
    const weapon = gameState.equipment.weapon;
    gameState.lastAttackKind = weapon ? 'weapon' : 'unarmed'; // Charge : l'arme de mêlée, sinon les poings
    const weaponBonus = weapon ? (weapon.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;
    const defReduction = weapon ? 0 : 0.35; // Pas d'arme équipée : mêmes mains nues qu'attackUnarmed()
    const label = weapon ? "en chargeant à l'arme" : "en chargeant à mains nues";
    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier: config.engageAction.atkMultiplier * (weapon ? 1 : unarmedDamageMult()), defReduction, gear: weapon }, label);
    if (landed) {
        gainSkillXp(weapon ? 'weapon' : 'unarmed', SKILL_XP_PER_USE);
        if (weapon) applyWeaponMechanic(weapon);
    }
}

// Magie : la plus puissante en moyenne, mais imprévisible, et peut totalement rater (thème
// absurde/chaotique). Chaque niveau de compétence Magie réduit le risque de rater son sort ET
// augmente légèrement sa puissance. Un seul sort équipé à la fois (gameState.equipment.spell, voir
// equipSpell()) : sa catégorie (melee/ranged) le fait se comporter exactement comme Arme/Tir —
// utilisable uniquement à l'écart correspondant, grisé sinon (voir updateUI()). Consomme du mana à
// chaque tentative, réussie ou non (le sort "part" quand même) ; insuffisant, il ne peut pas être
// lancé du tout.
function attackMagic() {
    const spell = gameState.equipment.spell;
    if (!spell) {
        logEvent("Vous n'avez aucun sort équipé — direction le Grimoire !", "danger");
        return;
    }
    const needsMelee = spell.spellCategory === 'melee';
    const anyRange = spell.spellCategory === 'any'; // Sort utilitaire (chantier 11) : toute distance
    if (needsMelee && gameState.combatDistance > 0) {
        logEvent(`Trop loin pour lancer [${spell.spellName}] — approchez-vous !`, "danger");
        return;
    }
    if (!needsMelee && !anyRange && gameState.combatDistance <= 0) {
        logEvent(`Trop près pour lancer [${spell.spellName}] — éloignez-vous !`, "danger");
        return;
    }
    const manaCost = gameState.status.overcharge ? 0 : getSpellManaCost(spell); // Économe (qualificatif de sort) le réduit ; Surcharge : gratuit
    if (gameState.mana < manaCost) {
        logEvent(`Mana insuffisant pour lancer [${spell.spellName}] (${manaCost} requis).`, "danger");
        return;
    }
    // Glyphe (chantier 6, V1) : OPTIONNEL, proposé APRÈS les vérifications (jamais de glyphe gâché sur un sort impossible) et
    // avant l'action. Réussi, il renforce le sort ; raté, passé ou en jet automatique : sort normal, sans aucun malus.
    const glyphSpec = anyRange ? null : maybeGlyphSpec(spell);
    if (glyphSpec) {
        startMinigame(glyphSpec, (outcome, detail) => {
            if (!gameState.inCombat || !gameState.currentEnemy) return; // le combat s'est terminé entre-temps
            castEquippedSpell(spell, manaCost, !(detail && detail.auto) && outcome !== 'fail');
        });
        return;
    }
    castEquippedSpell(spell, manaCost, false);
}

// Glyphe proposé pour ce sort ? Seulement avec une interface interactive et selon le réglage (Réduit : plus rarement) ;
// jamais pour un sort utilitaire ni un sort sans motif.
function maybeGlyphSpec(spell) {
    if (!minigameIsInteractive()) return null;
    const pattern = getGlyphPattern(spell);
    if (!pattern) return null;
    const chance = MINIGAME_SETTINGS.glyph.chancePct[getMinigameMode()] || 0;
    if (Math.random() * 100 >= chance) return null;
    return buildMinigameSpec('glyph', { pattern, label: `Glyphe : ${spell.spellName}` });
}

// Lance le sort équipé (après vérifications et glyphe éventuel). `glyphBoost` : glyphe réussi.
function castEquippedSpell(spell, manaCost, glyphBoost) {
    const anyRange = spell.spellCategory === 'any';
    if (!tryPlayerAction()) return;
    gameState.lastAttackKind = 'magic'; // Posture du crawler (scene.js) : paume ouverte, lueur du sort

    gameState.mana -= manaCost;

    const skill = gameState.skills.magic;
    // Chantier "QoL/équilibrage" (Chantier C, voir NOTES_QOL_EQUILIBRAGE.md) : le mana paie la
    // flexibilité (mêlée/distance sans changer d'équipement), pas un surplus de dégâts par rapport à
    // l'arme équivalente — atkMultiplier proche de 1.0 (config.magicBalance.atkBase), à rareté égale
    // un sort et une arme infligent des dégâts comparables (voir tests/regression/magic-balance.js).
    // Le backfire reste le prix du chaos, et devient PLUS punitif à haut niveau qu'avant (plancher
    // abaissé) pour continuer à justifier ce risque une fois la compétence Magie montée.
    const mb = config.magicBalance;
    // Surcharge (Occultiste de foire, chantier 13) : ce sort est gratuit (coût déjà à 0 chez l'appelant), plus fort et ne rate jamais.
    const overcharged = !!gameState.status.overcharge;
    if (overcharged) gameState.status.overcharge = null;
    let backfireChance = Math.max(mb.backfireMin, mb.backfireBase + mb.backfirePerLevel * (skill.level - 1)) + (gameState.anomalyEffects.backfireBonusPct || 0);
    // Qualificatifs de sort : Canalisé réduit le risque d'échec (jamais sous 1 %), Bredouillant l'augmente.
    const channeled = getItemQualifierValues(spell, 'channeled', 'spell');
    if (channeled) backfireChance = Math.max(1, backfireChance - channeled.bonus);
    const stutter = getItemQualifierValues(spell, 'stutter', 'spell');
    if (stutter) backfireChance += stutter.bonus;
    if (originRaceEffects().backfirePts) backfireChance = Math.max(1, backfireChance + originRaceEffects().backfirePts); // Elfe : −3 pts (jamais sous 1 %)
    let atkMultiplier = (mb.atkBase + mb.atkPerLevel * (skill.level - 1)) * (gameState.anomalyEffects.spellMult || 1) * (originRaceEffects().spellMult || 1); // ZONE_MAGIQUE (anomalies.js), Elfe (chantier 13)
    if (overcharged) {
        const boost = (activeSynergy() && activeSynergy().abilityMult) || originClassEffects().abilityMult || 1;
        atkMultiplier *= boost;
        backfireChance = 0;
        logEvent(`🔮 Surcharge : [${spell.spellName}] jaillit, gratuit et ×${boost} !`, "success");
    }
    if (glyphBoost) {
        atkMultiplier *= mb.glyphDamageMult;
        backfireChance *= mb.glyphBackfireMult;
        logEvent(`✍️ Le glyphe renforce [${spell.spellName}] (dégâts +${Math.round((mb.glyphDamageMult - 1) * 100)} %, risque de raté ÷${Math.round(1 / mb.glyphBackfireMult)}).`, "success");
    }

    if (!overcharged && Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        playSpellBackfireFx(); // la lueur crachote et s'éteint en fumée (fx.js)
        logEvent(`[${spell.spellName}] part de travers et fait un flop retentissant. Aucun dégât (mana quand même dépensé).`, "danger");
        gameState.lastPlayerActionWasBackfire = true; // Voir gameOver()/generateEpitaph() : attribution du décès si la riposte qui suit est fatale
        recordRunEvent('backfire');
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    // Sort utilitaire (chantier 11) : aucun coup porté, mais le tour est consommé — le mob riposte.
    if (anyRange) {
        castUtilitySpell(spell);
        gainSkillXp('magic', SKILL_XP_PER_USE);
        resolveEnemyReaction();
        return;
    }

    const effect = spell.spellEffect || null;
    const effectiveAtk = gameState.atk + (spell.baseDmg || 0);
    const used = performPlayerAttack(
        effectiveAtk,
        { atkMultiplier, varianceRange: 0.35, defReduction: 0.15, gear: spell, gearTarget: 'spell', chainPct: effect && effect.kind === 'chain' ? effect.pct : 0 }, // Les sorts ignorent un peu de DEF (thématique), pas toute
        `avec [${spell.spellName}]`
    );
    if (used) {
        gainSkillXp('magic', SKILL_XP_PER_USE);
        castSpellEffect(spell);
        applyWeaponMechanic(spell); // Qualificatifs du sort (brûlure, poison, gel, vol de vie…)
    }
}

// Effet intrinsèque d'un sort offensif (chantier 11, SPELL_EFFECTS dans spells.js), après un coup porté :
// réutilise les états d'ennemi existants (resolveQualifierEffect()). La chaîne d'éclairs est déjà comptée
// dans le coup lui-même (option chainPct de performPlayerAttack()). Le vol de vie s'applique même sur le
// coup fatal ; les états, seulement sur une cible encore debout.
function castSpellEffect(spell) {
    const effect = spell && spell.spellEffect;
    const enemy = gameState.currentEnemy;
    if (!effect || !enemy) return;
    const dealt = gameState._lastPlayerDamage || 0;
    if (effect.kind === 'lifesteal') {
        resolveQualifierEffect('lifesteal', { pct: effect.pct }, enemy, dealt, 'spell');
        return;
    }
    if (enemy.hp <= 0) return;
    switch (effect.kind) {
        case 'stun': if (Math.random() * 100 < effect.chance) resolveQualifierEffect('stun', {}, enemy, dealt, 'spell'); break;
        case 'corrode': resolveQualifierEffect('corrode', { rounds: effect.rounds }, enemy, dealt, 'spell'); break;
        case 'bleed': resolveQualifierEffect('bleed', { pct: effect.pct, rounds: effect.rounds }, enemy, dealt, 'weapon'); break;
        case 'fear': resolveQualifierEffect('fear', { rounds: effect.rounds }, enemy, dealt, 'spell'); break;
        case 'blind':
            enemy.status = enemy.status || {};
            enemy.status.distracted = { rounds: effect.rounds, miss: effect.miss };
            logEvent(`💡 [${enemy.name}] est aveuglé ! (${effect.miss} % de chances de rater pendant ${effect.rounds} tours)`, "danger");
            break;
    }
}

// Sort utilitaire (catégorie `any`, chantier 11) : soin, bouclier de mana ou recul — sans jet d'attaque.
function castUtilitySpell(spell) {
    const effect = spell.spellEffect || {};
    showDie(ui.combatPlayerDie, spell.icon || '✨');
    if (effect.kind === 'heal') {
        const healed = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * effect.pct / 100)));
        logEvent(`💚 [${spell.spellName}] referme vos plaies (+${healed} PV).`, "success");
    } else if (effect.kind === 'shield') {
        gameState.status.manaShield = { rounds: effect.rounds, pct: effect.pct };
        logEvent(`🔰 [${spell.spellName}] : un bouclier de mana vous entoure (dégâts reçus −${effect.pct} % pendant ${effect.rounds} tours).`, "success");
    } else if (effect.kind === 'shadowStep') {
        const before = gameState.combatDistance;
        gameState.combatDistance = Math.min(config.rangedCombat.maxDistance, before + effect.gap);
        logEvent(`🌑 [${spell.spellName}] : vous glissez dans l'ombre et reculez (écart ${before} → ${gameState.combatDistance}).`, "success");
    }
    playPlayerAttackFx('magic', { self: true }, () => {});
}

// Tentative de fuite : quitte le combat sans le gagner ni obtenir de loot/XP.
// En cas d'échec, l'ennemi place une attaque gratuite.
function attemptFlee() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    const enemy = gameState.currentEnemy;
    // Échec de furtivité punitif (voir attemptStealthEvasion()) : ce mob-là ne laisse plus filer.
    if (enemy.alerted) {
        logEvent(`[${enemy.name}] vous a repéré et ne vous laissera pas filer aussi facilement !`, "danger");
        return;
    }
    let fleeChance = 60; // 60% de réussite de base (pourra dépendre de compétences/stats plus tard)
    const scoutHelps = hasActiveCompanion('scout') && !enemy.isBountyHunter;
    if (scoutHelps) {
        fleeChance += config.companions.scout.fleeBonus; // Compagnon "Éclaireur" : facilite la fuite
    }
    else fleeChance += originRaceEffects().fleePts || 0; // Gobelin +15, Nain −15 : jamais contre un chasseur de primes (fixe, chantier 13)
    if (enemy.isBountyHunter) fleeChance = config.bounty.fleeChance; // Chasseur de primes : une fois sur deux, sans aide

    if (Math.random() * 100 < fleeChance) {
        const scoutNote = scoutHelps
            ? ` (${gameState.companion.name} vous a montré une ouverture)`
            : "";
        gameState.currentEnemy = null;
        gameState.inCombat = false; // Avant le log : le message de fuite doit s'afficher normalement sous la scène d'exploration
        gameState.pendingStairAfterCombat = false; // La fuite ne compte pas comme une victoire sur le gardien
        gameState.pendingBossRoomId = null; // Le boss reste vivant, la salle n'est pas marquée vaincue
        gameState.pendingSneakAttack = false; // Ne doit pas se reporter sur un combat futur
        gameState.fleesThisRun = (gameState.fleesThisRun || 0) + 1; // Voir generateEpitaph() : mention spéciale à 3+ fuites
        gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false }; // Les statuts ne survivent pas au combat
        setSceneHeader('🏃', 'Fuite Réussie', 'Exploration', 'fled');
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !${scoutNote}`, "info");
        changeCompanionLoyalty(config.companions.loyalty.flee); // Fuir n'inspire pas confiance à votre compagnon
        recordRunEvent('flee');
        if (enemy.isBountyHunter) {
            gameState.pendingBountySquad = 0;
            addBounty(config.bounty.fleeGain);
            logEvent(`🎯 Votre fuite fait grimper votre prime (+${config.bounty.fleeGain}).`, "danger");
        }
        if (gameState.pendingTravel) {
            logEvent("Vous rebroussez chemin, le trajet est annulé pour l'instant.", "info");
            gameState.pendingTravel = null;
        }
        if (gameState.pendingLairDive) {
            logEvent("Vous fuyez le repaire, encore intact — il faudra y revenir.", "info");
            gameState.pendingLairDive = null;
        }
        updateUI();
    } else {
        logEvent(`Votre fuite échoue ! [${enemy.name}] profite de l'ouverture.`, "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir cette fuite ratée, mais tente de se rapprocher
    }
}

function winCombat() {
    const defeatedEnemy = gameState.currentEnemy;
    const wasBoss = defeatedEnemy && defeatedEnemy.isBoss;
    if (defeatedEnemy) gameState.floorStats.mobsKilled += 1;

    // Combat terminé : on sort de l'état "inCombat" avant les logs de résultat (XP/loot/victoire)
    // pour qu'ils s'affichent normalement sous la scène d'exploration, comme n'importe quel autre événement (voir
    // logEvent) — seuls les échanges de coups pendant le combat lui-même restent dans le journal court du combat.
    gameState.currentEnemy = null;
    gameState.inCombat = false;
    gameState.pendingSneakAttack = false;
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false }; // Les statuts ne survivent pas au combat

    if (wasBoss) {
        setSceneHeader('👑', 'Victoire !', 'Boss Vaincu', { key: 'bossVictory', enemy: defeatedEnemy });
        logEvent(`👑 Vous avez triomphé de ${defeatedEnemy.name} !`, "success");
        triggerHaptic('heavy');
    } else {
        setSceneHeader('🏆', 'Victoire !', 'Combat', { key: 'victory', enemy: defeatedEnemy });
        logEvent("Vous remportez le combat !", "success");
        triggerHaptic('medium');
    }

    // Gain d'XP basé sur le monstre vaincu (valeur de repli si jamais xpReward est absent)
    const xpGained = (defeatedEnemy && defeatedEnemy.xpReward) || 10;
    gainXp(xpGained);

    // Le compagnon progresse aussi, gagne en loyauté, et le Premiers secours panse vos plaies
    onCompanionVictory();

    // Butin (chantier "refonte des objets", voir itemBalance dans items.js) : la rareté dépend de
    // l'étage, plus de la puissance du monstre. Un boss garantit un objet (un palier au-dessus, au
    // moins Rare) avec une chance d'un second, plus son objet signature (voir
    // awardBossSignatureItem()) ; le boss d'un repaire lâche un butin d'un niveau d'objet au-dessus.
    // Un mob normal a 40 % de chance de lâcher un objet, un élite une chance de monter d'un palier.
    if (wasBoss) {
        const isLairBoss = !!(gameState.pendingLairDive && gameState.pendingLairDive.stage === 'boss');
        const itemLevel = gameState.currentFloor + (isLairBoss ? itemBalance.lairBossLevelBonus : 0);
        addLoot({ source: 'boss', itemLevel });
        if (Math.random() * 100 < itemBalance.boss.secondItemChance) addLoot({ source: 'boss', itemLevel });
        awardBossSignatureItem(defeatedEnemy, itemLevel, { perfectFinisher: !!defeatedEnemy.finisherPerfect, perfects: defeatedEnemy.trials ? defeatedEnemy.trials.perfects : 0 });
    } else if (!(defeatedEnemy && defeatedEnemy.isBountyHunter) && Math.random() * 100 < 40) { // 40% de chance de loot post-combat (un chasseur de primes paie sa propre récompense, voir onBountyVictory())
        addLoot({ source: defeatedEnemy && isEliteMob(defeatedEnemy) ? 'elite' : 'mob' });
    }

    // Chronique de run (chantier 2) : victoire, type de coup final, facilité (domination).
    if (defeatedEnemy) recordRunEvent('win', { enemy: defeatedEnemy, kind: gameState.lastAttackKind });
    // Prime (chantier 3) : récompense d'un chasseur ou hausse selon la facilité ; une escouade enchaîne
    // son Chef ici, avant toute suite de trajet.
    if (defeatedEnemy && onBountyVictory(defeatedEnemy)) return;

    // Si ce combat était une salle de boss du quartier (escalier ou non), la salle est désormais
    // calme : on la marque vaincue (son marqueur de carte passe de 👑 à 🪜 si elle gardait l'escalier).
    // Pièce / ville du gardien vaincu, gardées pour le choix d'escalier plus bas (ces deux champs sont
    // remis à zéro juste en dessous).
    const defeatedBossRoomId = gameState.pendingBossRoomId;
    if (gameState.pendingBossRoomId) {
        const bossRoom = gameState.floorMap && gameState.floorMap.roomsById[gameState.pendingBossRoomId];
        if (bossRoom) bossRoom.defeated = true;
        gameState.pendingBossRoomId = null;
    }

    // Plongée dans un repaire en cours (voir diveIntoLair()) : enchaîne les combats forcés restants, puis le
    // boss du repaire.
    if (gameState.pendingLairDive) {
        const dive = gameState.pendingLairDive;
        if (dive.stage === 'trash') {
            dive.combatsLeft -= 1;
            if (dive.combatsLeft > 0) {
                logEvent("Un autre adversaire surgit des décombres du repaire...", "danger");
                initiateCombat();
                return;
            }
            dive.stage = 'boss';
            const lair = gameState.floorMap.lairsById[dive.lairId];
            if (!lair.bossInstance) {
                lair.bossInstance = generateBoss(gameState.floorMap.theme) || generateMob(gameState.floorMap.theme);
            }
            logEvent("Le repaire se calme... jusqu'à ce qu'une présence bien plus dangereuse n'émerge de l'ombre !", "danger");
            initiateCombat(lair.bossInstance);
            return;
        }
        // dive.stage === 'boss' : le boss du repaire vient de tomber, la plongée est terminée
        // (butin déjà garanti par la branche wasBoss ci-dessus, comme tout autre boss).
        const lair = gameState.floorMap.lairsById[dive.lairId];
        lair.cleared = true;
        gameState.pendingLairDive = null;
        logEvent(`🏆 Le repaire est nettoyé ! Plus rien à craindre ici.`, "success");
    }

    // Si ce combat faisait partie d'un trajet de retour vers un lieu connu (embuscade),
    // on enchaîne sur la suite du trajet (nouvelle embuscade ou arrivée à destination)
    if (gameState.pendingTravel) {
        triggerNextAmbushOrArrive();
        return;
    }
    // Si ce combat gardait un escalier, la victoire ouvre le passage vers l'étage suivant
    if (gameState.pendingStairAfterCombat) {
        gameState.pendingStairAfterCombat = false;
        const stairsRoom = gameState.floorMap && gameState.floorMap.roomsById[defeatedBossRoomId];
        // Gardien de la Sortie (étage final, config.urbanFloors.finalFloor) : victoire finale.
        if (stairsRoom && stairsRoom.isExit) {
            logEvent("La voie vers la Sortie est libre !", "success");
            winGame(); // winGame() appelle déjà updateUI()
            return;
        }
        logEvent("La voie vers l'escalier est libre !", "success");
        offerStairsChoice({ kind: 'room', roomId: defeatedBossRoomId }); // offerStairsChoice() appelle déjà updateUI()
        return;
    }

    updateUI();
}
