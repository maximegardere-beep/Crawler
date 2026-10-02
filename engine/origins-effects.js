// engine/origins-effects.js — Race et classe (passifs, capacités), buff de départ.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// RACE : PASSIFS (chantier 13, lot 1 — voir origins.js et CHANTIERS.md)
// ==========================================
// `gameState.race` (clé d'ORIGIN_RACES, null = aucune : une ancienne sauvegarde ou un crawler avant l'étage 3 n'a aucun effet) choisit une entrée de
// `config.origins.races`. UN SEUL point de lecture par effet : PV max (recomputeMaxHp), XP (gainXp), soins (applyPlayerHeal), DEF (getEffectiveDef),
// mana max (recomputeRaceDerived), réserve (idem), furtivité (getStealthChance), fuite (attemptFlee), pièges et saignement (applyRaceDamageMods),
// mains nues (unarmedDamageMult), sorts (attackMagic), Increvable (applyPlayerDamage).
function originRaceEffects() {
    return (gameState.race && config.origins.races[gameState.race]) || {};
}

// Choisit la race (une seule fois par run, définitif) : pose `gameState.race` puis recalcule les valeurs dérivées.
function applyRace(key) {
    if (!config.origins.races[key]) return false;
    gameState.race = key;
    gameState.raceLastStandFloor = 0;
    recomputeRaceDerived();
    return true;
}

// PV max, mana max et emplacements de réserve dépendent de la race : recalculés au choix, à la restauration d'une sauvegarde.
function recomputeRaceDerived() {
    const fx = originRaceEffects();
    const hadMaxMana = gameState.maxMana || 100;
    gameState.maxMana = Math.round(100 * (fx.maxManaMult || 1));
    gameState.mana = Math.min(gameState.maxMana, Math.round(gameState.mana * gameState.maxMana / hadMaxMana));
    gameState.maxInventory = config.inventory.maxEquipment + (fx.extraReserve || 0);
    recomputeMaxHp();
}

// Dégâts de pièges et de saignement après la race (Gobelin : pièges −25 %, Goule : saignement −50 %) ; jamais sous 1.
function applyRaceDamageMods(amount, source) {
    const fx = originRaceEffects();
    const mult = source === 'trap' ? fx.trapMult : source === 'bleed' ? fx.bleedMult : null;
    if (!mult || !(amount > 0)) return amount;
    return Math.max(1, Math.round(amount * mult));
}

// Multiplicateur de dégâts à mains nues : buff de départ (chantier 14) × race (Troll).
function unarmedDamageMult() {
    return starterBuffUnarmedMult() * (originRaceEffects().unarmedMult || 1) * (originClassEffects().unarmedMult || 1); // + Bagarreur (style)
}

// Armure de scénario (chantier 15, lot 4, config.earlyGame.plotArmor) : aux étages 1-3, le premier coup mortel de chaque étage laisse `leaveHp` PV (aussi contre un boss), et le
// reste du tour ennemi en cours est absorbé (`status.plotShield`, uniquement en combat, éteint par la prochaine action du joueur) — jamais deux frappes d'une même rafale d'affilée.
// Passe AVANT l'Increvable du Cafard : à 1 PV aucun des deux ne rejoue, il n'y a donc pas de double vie sur un même coup.
function applyPlotArmor(amount) {
    const eg = config.earlyGame;
    if (!eg.enabled || !eg.plotArmor.enabled || gameState.currentFloor > eg.maxFloor) return amount;
    if (gameState.inCombat && gameState.status.plotShield) return 0;
    if (!(amount >= gameState.hp) || gameState.plotArmorFloor === gameState.currentFloor) return amount;
    gameState.plotArmorFloor = gameState.currentFloor;
    if (gameState.inCombat) gameState.status.plotShield = true;
    recordRunEvent('plotArmor');
    logEvent("🎬 Armure de scénario : le coup était fatal. Mais l'audience vient de grimper de 40 %, et la production a décidé que vous restiez en vie. (Un coup mortel par étage, jusqu'à l'étage 3.)", "success");
    return Math.max(0, gameState.hp - eg.plotArmor.leaveHp);
}

// Increvable (Cafard mutant) : un dégât mortel laisse 1 PV, 1 fois par étage, jamais contre un boss. Renvoie le montant à appliquer.
function applyRaceLastStand(amount) {
    const fx = originRaceEffects();
    if (!fx.lastStand || !(amount >= gameState.hp) || gameState.hp <= 1) return amount;
    if (gameState.raceLastStandFloor === gameState.currentFloor) return amount;
    if (gameState.inCombat && gameState.currentEnemy && gameState.currentEnemy.isBoss) return amount;
    gameState.raceLastStandFloor = gameState.currentFloor;
    recordRunEvent('lastStand');
    logEvent("🪳 Increvable : le coup aurait dû vous tuer, mais un cafard, ça se retourne et ça repart. Il vous reste 1 PV.", "success");
    return gameState.hp - 1;
}

// ==========================================
// CLASSE : PASSIFS DE STYLE ET CAPACITÉS ACTIVES (chantier 13, lot 3 — voir origins.js et CHANTIERS.md)
// ==========================================
// `gameState.crawlerClass` (clé d'ORIGIN_CLASSES, null = aucune) choisit une entrée de `config.origins.classes` : un passif de style (lu à son point
// d'usage : PV max, mains nues, arme, tir, coût en mana, niveau de Furtivité) et UNE capacité active, utilisable 1 fois par combat
// (`gameState.classAbilityUsed`, remis à faux dans initiateCombat()). Une capacité prend le tour : la riposte suit normalement. Les synergies
// race × classe (`config.origins.synergies`) REMPLACENT certains chiffres de la classe. Contre un boss, les statuts sont réduits (voir chaque capacité).
function originClassEffects() {
    return (gameState.crawlerClass && config.origins.classes[gameState.crawlerClass]) || {};
}

// Chiffres de la capacité en cours : ceux de la classe, remplacés champ par champ par la synergie race × classe éventuelle.
function originAbilityValues() {
    const syn = originSynergyFor(gameState.race, gameState.crawlerClass);
    return Object.assign({}, originClassEffects(), (syn && config.origins.synergies[`${syn.race}+${syn.cls}`]) || {});
}
function activeSynergy() {
    const syn = originSynergyFor(gameState.race, gameState.crawlerClass);
    return (syn && config.origins.synergies[`${syn.race}+${syn.cls}`]) || null;
}

function effectiveStealthLevel() {
    const base = (gameState.skills && gameState.skills.stealth && gameState.skills.stealth.level) || 1;
    return base + (originClassEffects().stealthLevels || 0); // Filou : Furtivité +1 niveau (style)
}

// Multiplicateur d'une attaque d'arme (mêlée ou distance) : +4 % par niveau d'Arme, × style de classe (`styleKey` : 'weaponMult' | 'rangedMult').
function weaponAttackMultiplier(styleKey) {
    const level = gameState.skills.weapon.level;
    return (1.0 + 0.04 * (level - 1)) * (originClassEffects()[styleKey] || 1);
}

// Fin de la riposte : Disparition et Encaisser ne valent que pour elle.
function endClassDefenseTurn() {
    const vanish = gameState.status && gameState.status.vanish;
    if (vanish) { vanish.dodging = false; if (vanish.turns <= 0 && !vanish.nextAttack) gameState.status.vanish = null; }
    if (gameState.status && gameState.status.brace) gameState.status.brace = null;
}

// Encaisser : une part des dégâts réellement subis revient à l'attaquant (jamais de coup fatal : l'ennemi garde au moins 1 PV, comme Épineux).
function applyBraceReflect(enemy, damageTaken) {
    if (!gameState.status.brace || !(damageTaken > 0) || !enemy) return 0;
    const pct = originAbilityValues().reflectPct || 0;
    const back = Math.min(Math.max(0, enemy.hp - 1), Math.max(1, Math.round(damageTaken * pct)));
    if (back <= 0) return 0;
    enemy.hp -= back;
    logEvent(`🛡️ Encaisser : ${back} dégâts renvoyés à [${enemy.name}] (${Math.round(pct * 100)} %).`, "success");
    return back;
}

// Disponibilité de la capacité (pure, lue par le bouton et par useClassAbility()) : { usable, reason }.
function classAbilityStatus() {
    const cls = originEntry('class', gameState.crawlerClass);
    if (!cls) return { usable: false, reason: "Aucune classe." };
    if (!gameState.inCombat || !gameState.currentEnemy) return { usable: false, reason: "Seulement en combat." };
    if (gameState.classAbilityUsed) return { usable: false, reason: "Déjà utilisée dans ce combat." };
    const disarmed = gameState.status.disarmed && gameState.status.disarmed.rounds > 0;
    switch (cls.key) {
        case 'brawler': if (gameState.combatDistance > 0) return { usable: false, reason: "Trop loin pour frapper." }; break;
        case 'duelist':
            if (!gameState.equipment.weapon) return { usable: false, reason: "Aucune arme équipée." };
            if (disarmed) return { usable: false, reason: "Arme arrachée." };
            if (gameState.combatDistance > 0) return { usable: false, reason: "Trop loin pour frapper." };
            break;
        case 'gunslinger':
            if (!gameState.equipment.ranged) return { usable: false, reason: "Aucune arme à distance." };
            if (disarmed) return { usable: false, reason: "Arme arrachée." };
            break;
        case 'occultist': if (!gameState.equipment.spell) return { usable: false, reason: "Aucun sort équipé." }; break;
    }
    return { usable: true, reason: "" };
}

// Utilise la capacité de classe. Renvoie vrai si elle a été jouée (un tour consommé).
function useClassAbility() {
    const status = classAbilityStatus();
    if (!status.usable) {
        if (gameState.inCombat) logEvent(`${status.reason} Capacité indisponible.`, "danger");
        return false;
    }
    const key = gameState.crawlerClass;
    const run = CLASS_ABILITIES[key];
    if (!run || !tryPlayerAction()) return false;
    gameState.classAbilityUsed = true;
    recordRunEvent('classAbility', { boss: !!(gameState.currentEnemy && gameState.currentEnemy.isBoss), synergy: !!activeSynergy() });
    run(originAbilityValues());
    updateUI();
    return true;
}

const CLASS_ABILITIES = {
    // Uppercut du dimanche : mains nues ×2 ; étourdit (1 tour, 2 avec la synergie Troll). Un boss n'est jamais étourdi : il est « exposé » seulement avec la synergie.
    brawler(v) {
        gameState.lastAttackKind = 'unarmed';
        const skill = gameState.skills.unarmed;
        const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1));
        const landed = performPlayerAttack(gameState.atk, {
            atkMultiplier: 0.75 * unarmedDamageMult() * v.abilityMult, varianceRange: 0.10, defReduction,
            onHit: (enemy) => {
                if (!enemy.isBoss) {
                    enemy.status.stunned = v.stunTurns > 1 ? v.stunTurns : true;
                    logEvent(`💫 Uppercut du dimanche : [${enemy.name}] voit des chandelles${v.stunTurns > 1 ? ` (${v.stunTurns} tours)` : ''} !`, "success");
                } else if (v.bossExposed) {
                    enemy.status.exposed = { rounds: 1 };
                    logEvent(`💫 Uppercut du dimanche : la garde de [${enemy.name}] est ouverte !`, "success");
                }
            }
        }, "avec un Uppercut du dimanche");
        if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
    },
    // Fendre : frappe à l'arme ×1,8 qui ignore la moitié de la DEF.
    duelist(v) {
        gameState.lastAttackKind = 'weapon';
        const gear = gameState.equipment.weapon;
        const landed = performPlayerAttack(gameState.atk + (gear.baseDmg || 0), {
            atkMultiplier: weaponAttackMultiplier('weaponMult') * v.abilityMult, varianceRange: 0.15, defReduction: v.abilityDefIgnore, gear
        }, "en fendant");
        if (landed) { gainSkillXp('weapon', SKILL_XP_PER_USE); applyWeaponMechanic(gear); }
    },
    // Tir de barrage : `shots` tirs à ×0,8 à toute distance, une seule riposte à la fin (jamais de second tir sur un ennemi déjà tombé).
    gunslinger(v) {
        gameState.lastAttackKind = 'ranged';
        const gear = gameState.equipment.ranged;
        let landedAny = false;
        for (let i = 0; i < v.shots; i++) {
            const enemy = gameState.currentEnemy;
            if (!gameState.inCombat || !enemy || enemy.hp <= 0 || gameState.pendingMinigame) break;
            const last = i === v.shots - 1;
            const landed = performPlayerAttack(gameState.atk + (gear.baseDmg || 0), {
                atkMultiplier: weaponAttackMultiplier('rangedMult') * v.shotMult, varianceRange: 0.15, defReduction: 0, gear, skipReaction: !last
            }, `en rafale (tir ${i + 1}/${v.shots})`);
            landedAny = landedAny || landed;
        }
        if (landedAny) { gainSkillXp('weapon', SKILL_XP_PER_USE); applyWeaponMechanic(gear); }
    },
    // Surcharge : le prochain sort est gratuit, plus fort et ne rate jamais (voir castEquippedSpell()) ; la synergie Elfe rend aussi du mana.
    occultist(v) {
        gameState.status.overcharge = true;
        if (v.manaRefund) gameState.mana = Math.min(gameState.maxMana, gameState.mana + v.manaRefund);
        showDie(ui.combatPlayerDie, "🔮");
        playClassAbilityFx('occultist');
        logEvent(`🔮 Surcharge : votre prochain sort sera gratuit, ×${v.abilityMult} et infaillible${v.manaRefund ? ` (+${v.manaRefund} mana)` : ''}.`, "success");
        resolveEnemyReaction();
    },
    // Disparition : la prochaine riposte (2 avec la synergie Gobelin) est esquivée et l'attaque suivante porte ×2.
    trickster(v) {
        gameState.status.vanish = { turns: v.dodgeTurns, nextAttack: true, dodging: false };
        showDie(ui.combatPlayerDie, "🎭");
        playClassAbilityFx('trickster');
        logEvent(`🎭 Disparition : vous vous fondez dans le décor (${v.dodgeTurns} riposte${v.dodgeTurns > 1 ? 's' : ''} esquivée${v.dodgeTurns > 1 ? 's' : ''}, prochaine attaque ×${v.nextAttackMult}).`, "success");
        resolveEnemyReaction();
    },
    // Encaisser : DEF ×2 pour la riposte qui suit, et une part des dégâts reçus revient à l'attaquant.
    punchingBag(v) {
        gameState.status.brace = true;
        showDie(ui.combatPlayerDie, "🛡️");
        playClassAbilityFx('punchingBag');
        logEvent(`🛡️ Encaisser : DEF ×${v.braceDefMult} pour la prochaine riposte, ${Math.round(v.reflectPct * 100)} % des dégâts renvoyés.`, "success");
        resolveEnemyReaction();
    }
};

// Bouton de capacité (bande pleine largeur au-dessus des attaques, comme #btn-occasion) : visible en combat avec une classe ; grisé quand
// la capacité est indisponible, avec la raison. Appelée par updateUI().
function updateClassAbilityUI() {
    const btn = ui.btnClassAbility;
    if (!btn) return;
    const cls = originEntry('class', gameState.crawlerClass);
    const show = !!cls && gameState.inCombat && !!gameState.currentEnemy;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    const status = classAbilityStatus();
    btn.disabled = !status.usable;
    btn.classList.toggle('opacity-40', !status.usable);
    btn.classList.toggle('pointer-events-none', !status.usable);
    btn.innerHTML = `${cls.icon} ${cls.abilityName}<span class="block text-[9px] font-normal normal-case opacity-80">${status.usable ? 'Capacité de classe · 1 fois par combat' : status.reason}</span>`;
    btn.title = `${cls.name} — ${cls.ability}`;
}

// ==========================================
// BUFF DE DÉPART « FOUTU POUR FOUTU » (chantier 14 — voir CHANTIERS.md)
// ==========================================
// Un crawler dont le cadeau de bienvenue n'est NI une arme, NI une arme à distance, NI un sort (cadeau « Armure » ou « Rien », 22 % des
// départs) démarre avec `starterBuff = 'desperate'` : +5 % de dégâts subis, dégâts ×2 à mains nues (attaque Mains nues, Étrangler, Charge
// à mains nues). Il saute dès que le crawler ÉQUIPE une arme, une arme à distance ou un sort (jamais l'armure ; un objet seulement ramassé ou
// donné à un compagnon ne compte pas) et ne revient jamais. Encore actif à l'arrivée sur l'étage 2, il évolue en 'boxer' : sans le malus,
// un simple ×1,25 à mains nues, définitif (reste après l'équipement). Chiffres : config.starterBuff.
function starterBuffUnarmedMult() {
    const cfg = config.starterBuff;
    if (gameState.starterBuff === 'desperate') return cfg.unarmedMult;
    if (gameState.starterBuff === 'boxer') return cfg.boxerUnarmedMult;
    return 1;
}

// Dégâts subis après le malus du buff (arrondi, jamais moins que le montant d'origine).
function applyStarterBuffToDamage(amount) {
    if (gameState.starterBuff !== 'desperate' || !(amount > 0)) return amount;
    return Math.max(amount, Math.round(amount * config.starterBuff.damageTakenMult));
}

// Période d'essai (chantier 15, lot 3, config.earlyGame.trial) : l'émission protège ses débutants — dégâts subis réduits aux étages 1-3, de moins en moins avec le niveau
// (trialDamageMult(), generator.js). Appliquée AUX MÊMES points que le buff de départ (coup encaissé, pièges, saignement) pour que journal et PV restent d'accord.
// Les PV épargnés sont comptés (runStats.trialAvoided) et réajoutés à la facilité des victoires : la Période d'essai ne doit pas faire monter la prime des chasseurs.
function applyTrialToDamage(amount) {
    if (!(amount > 0)) return amount;
    const mult = trialDamageMult(gameState.level, gameState.currentFloor);
    if (mult >= 1) return amount;
    const reduced = Math.min(amount, Math.max(1, Math.round(amount * mult)));
    if (reduced < amount && gameState.runStats) gameState.runStats.trialAvoided = (gameState.runStats.trialAvoided || 0) + (amount - reduced);
    return reduced;
}

// Badge « Période d'essai » : visible tant que la réduction est active (étages 1-3, niveau sous le seuil), avec le pourcentage courant et la règle en infobulle.
function updateTrialStatusUI() {
    const el = ui.trialStatus;
    if (!el) return;
    const eg = config.earlyGame;
    const mult = trialDamageMult(gameState.level, gameState.currentFloor);
    const active = mult < 1;
    el.classList.toggle('hidden', !active);
    if (!active) return;
    const pct = Math.round((1 - mult) * 100);
    el.innerText = `🎟️ Période d'essai −${pct} %`;
    el.title = `Période d'essai — l'émission protège ses débutants : −${pct} % de dégâts subis (combat, pièges, saignement), de moins en moins à chaque niveau, jusqu'au niveau ${eg.trial.fadeLevel} ; prend fin à l'arrivée sur l'étage ${eg.maxFloor + 1}.`;
}

function giveStarterBuffForGift(giftType) {
    gameState.starterBuff = (giftType === 'armor' || giftType === 'nothing') ? 'desperate' : null;
    if (gameState.starterBuff) logEvent("💢 Foutu pour foutu : sans arme, vous encaissez 5 % de plus, mais vos poings frappent deux fois plus fort — jusqu'au premier équipement.", "info");
}

// Appelée quand le crawler équipe une arme, une arme à distance ou un sort : le buff de départ saute, le Boxeur (évolué) reste.
function endStarterBuff() {
    if (gameState.starterBuff !== 'desperate') return;
    gameState.starterBuff = null;
    logEvent("💢 Foutu pour foutu s'arrête : vous voilà équipé. Le Donjon peut reprendre son rythme normal.", "info");
}

// Arrivée à l'étage `config.starterBuff.evolveFloor` : un buff encore actif devient Boxeur.
function evolveStarterBuff() {
    if (gameState.starterBuff !== 'desperate' || gameState.currentFloor < config.starterBuff.evolveFloor) return;
    gameState.starterBuff = 'boxer';
    logEvent(`🥊 Vous avez tenu jusqu'à l'étage ${gameState.currentFloor} à mains nues : le public vous sacre Boxeur. Plus de malus, et des poings durablement plus lourds (×${config.starterBuff.boxerUnarmedMult}).`, "success");
}

function updateStarterBuffUI() {
    const el = ui.starterBuffStatus;
    if (!el) return;
    const cfg = config.starterBuff;
    const info = gameState.starterBuff === 'desperate'
        ? { text: '💢 Foutu pour foutu', title: `Foutu pour foutu — dégâts subis +${Math.round((cfg.damageTakenMult - 1) * 100)} %, dégâts à mains nues ×${cfg.unarmedMult} (Étrangler compris). Saute à l'équipement d'une arme, d'une arme à distance ou d'un sort ; évolue à l'étage ${cfg.evolveFloor}.` }
        : gameState.starterBuff === 'boxer'
            ? { text: '🥊 Boxeur', title: `Boxeur — dégâts à mains nues ×${cfg.boxerUnarmedMult}, définitif.` }
            : null;
    el.classList.toggle('hidden', !info);
    if (info) { el.innerText = info.text; el.title = info.title; }
}
