/**
 * generators.js - Moteur de génération procédurale pour Crawler
 * Nécessite que le fichier bestiary.js soit chargé avant celui-ci.
 */

// ==========================================
// 0. SCALING PAR ÉTAGE
// ==========================================
// Calcule les multiplicateurs de statistiques appliqués aux monstres (mobs normaux et boss) selon
// la profondeur actuelle du donjon. À l'étage 1, tous les multiplicateurs valent 1 (aucun bonus).
// Les taux de croissance sont centralisés dans config.floorScaling (voir app.js) pour rester
// ajustables par playtest sans toucher à cette fonction.
function getFloorScaling(floor) {
    const f = Math.max(1, floor || 1);
    const depth = f - 1; // 0 au rez-de-chaussée (étage 1), croît ensuite avec la profondeur
    // Valeurs de repli si config.floorScaling n'existe pas encore (ex: ancien cache navigateur)
    const rates = (typeof config !== 'undefined' && config.floorScaling)
        ? config.floorScaling
        : { hp: 0.22, atk: 0.12, def: 0.10, xp: 0.18 };
    const dmgRates = (typeof config !== 'undefined' && config.mobDamageScaling)
        ? config.mobDamageScaling
        : { perFloor: 0.12, perMobLevel: 0.03 };
    // ATQ (chantier "rework combat", scaling dégâts mobs) : formule composée dégâts_mob = base ×
    // (1 + 0.12×étage) × (1 + 0.03×niveau_mob), remplace l'ancien scaling linéaire par profondeur.
    // Utilise `f` (l'étage réel, PAS `depth`) pour les deux facteurs : un mob à l'étage 1 tape déjà
    // plus fort que sa base, plus de "premier étage gratuit" — c'est le point de ce chantier (le
    // scaling précédent était jugé quasi inexistant). `niveau_mob` n'a pas de champ dédié sur les mobs
    // (voir getMobLevelEquivalent() dans app.js, même principe) : l'étage sert de proxy pour les
    // deux facteurs, cohérent avec le reste du moteur qui scale les mobs par étage plutôt que par
    // niveau propre. hp/def/xp gardent l'ancien scaling linéaire par PROFONDEUR (depth) : seul le
    // scaling des dégâts (ATQ) était visé par ce chantier.
    const atkMult = (1 + dmgRates.perFloor * f) * (1 + dmgRates.perMobLevel * f);
    return {
        hpMult: 1 + depth * rates.hp,
        atkMult,
        defMult: 1 + depth * rates.def,
        xpMult: 1 + depth * rates.xp
    };
}

// Applique les multiplicateurs de scaling à un monstre fraîchement cloné (mob normal OU boss),
// AVANT tout autre traitement (modificateurs aléatoires, etc.) afin que les adjectifs restent
// proportionnels aux stats déjà mises à l'échelle. Modifie l'objet reçu en place.
function applyFloorScaling(mob, floor) {
    const scale = getFloorScaling(floor);
    if (mob.hp !== undefined) mob.hp = Math.round(mob.hp * scale.hpMult);
    if (mob.atk !== undefined) mob.atk = Math.round(mob.atk * scale.atkMult);
    if (mob.def !== undefined) mob.def = Math.round(mob.def * scale.defMult);
    if (mob.xpReward !== undefined) mob.xpReward = Math.round(mob.xpReward * scale.xpMult);
    return mob;
}

// ==========================================
// 1. GÉNÉRATION DES MOBS
// ==========================================

/**
 * Génère un monstre aléatoire basé sur le quartier actuel,
 * en lui appliquant potentiellement 1 ou 2 modificateurs.
 * 
 * @param {string} districtName - Le nom du quartier actuel
 * @returns {object} - L'objet du monstre final généré
 */
// `eliteBonus` (points de pourcentage, défaut 0) : décale les seuils du jet de modificateurs
// ci-dessous — voir LABYRINTHE dans anomalies.js (mobs rencontrés dans le quartier de l'escalier
// plus susceptibles d'être élite quand cette anomalie est active), passé par app.js au moment de
// l'encounter, jamais lu ici directement depuis gameState.
function generateMob(districtName, eliteBonus = 0, _redraw = 0) {
    // 1. Récupération du quartier et d'un nom de monstre autorisé dans ce quartier
    const district = districts[districtName];
    if (!district || !district.mobNames || district.mobNames.length === 0) {
        console.error(`Erreur: Quartier "${districtName}" introuvable ou vide.`);
        return null;
    }

    const mobName = district.mobNames[Math.floor(Math.random() * district.mobNames.length)];

    // 2. Récupération des stats complètes du monstre dans le catalogue (bestiary.js)
    const baseMob = findMobByName(mobName);
    if (!baseMob) {
        console.error(`Erreur: Monstre "${mobName}" introuvable dans le catalogue (bestiary.js).`);
        return null;
    }
    // On fait une copie profonde pour ne pas altérer la base de données
    const finalMob = JSON.parse(JSON.stringify(baseMob));
    finalMob.baseName = finalMob.name; // Nom d'origine, avant les suffixes de modificateurs (sprite du mob, scene.js)

    // 1bis. Mise à l'échelle selon l'étage courant (voir section 0), avant tout modificateur
    applyFloorScaling(finalMob, typeof gameState !== 'undefined' ? gameState.currentFloor : 1);

    // 1ter. MOB_ENRAGE (anomalies.js) : multiplicateur d'ATQ de l'anomalie active sur l'étage, au même
    // titre que le scaling par étage — fait donc partie de la "puissance de référence" ci-dessous, pas
    // de threatMultiplier (qui ne mesure que la puissance apportée par les modificateurs).
    if (typeof gameState !== 'undefined' && gameState.anomalyEffects && gameState.anomalyEffects.mobAtkMult !== 1) {
        finalMob.atk = Math.max(1, Math.round(finalMob.atk * gameState.anomalyEffects.mobAtkMult));
    }

    // Puissance de référence (ATQ x PV) juste après le scaling d'étage mais AVANT tout
    // modificateur : sert à isoler la part de puissance apportée par les seuls modificateurs
    // (voir finalMob.threatMultiplier plus bas), indépendamment de la profondeur de l'étage.
    const preModifierPower = finalMob.atk * finalMob.hp;
    const preModifierDef = finalMob.def;

    // 2. Jet de dés pour le nombre de modificateurs (Ex: 15% pour 2, 35% pour 1 (total 50%), 50% pour 0)
    const roll = Math.random() * 100;
    let modifierCount = 0;

    if (roll <= 15 + eliteBonus) {
        modifierCount = 2; // 15% de chance d'avoir 2 adjectifs (Mob d'élite), +eliteBonus
    } else if (roll <= 50 + eliteBonus) {
        modifierCount = 1; // 35% de chance d'avoir 1 adjectif (Mob spécial)
    }

    // 3. Application des modificateurs
    let appliedModifiers = [];
    // Copie complète (nom + description + effet) de chaque modificateur appliqué, conservée sur le
    // mob final pour l'UI de combat (panneau "Examiner" : détails textuels sans avoir à deviner
    // depuis le nom composé ou l'unique champ `effect`).
    let modifiersApplied = [];
    // On clone les tags autorisés pour pouvoir en retirer à chaque tirage
    let availableTags = [...finalMob.allowedTags];

    for (let i = 0; i < modifierCount; i++) {
        // Si le mob n'a plus de catégories disponibles, on arrête
        if (availableTags.length === 0) break;

        // Choix aléatoire d'une catégorie (ex: "mental") et retrait de la liste pour éviter les doublons
        const tagIndex = Math.floor(Math.random() * availableTags.length);
        const selectedCategory = availableTags.splice(tagIndex, 1)[0]; 

        // Choix aléatoire d'un modificateur dans cette catégorie
        const modifiersList = mobModifiers[selectedCategory];
        if (modifiersList && modifiersList.length > 0) {
            const modIndex = Math.floor(Math.random() * modifiersList.length);
            const modifier = modifiersList[modIndex];
            
            appliedModifiers.push(modifier.name);
            modifiersApplied.push({ name: modifier.name, desc: modifier.desc || "", effect: modifier.effect || null });

            // Transmission de l'effet élémentaire éventuel (burn/poison/slow/stun) au monstre final
            if (modifier.effect) finalMob.effect = modifier.effect;

            // Application des statistiques (Multiplication)
            // Les valeurs de mobModifiers.*.stats sont des multiplicateurs (ex: 1.5 = +50%,
            // 0.8 = -20%), pas des deltas : on les applique donc en multipliant la stat déjà mise
            // à l'échelle par l'étage (voir applyFloorScaling plus haut), puis on arrondit.
            if (modifier.stats) {
                for (let stat in modifier.stats) {
                    if (finalMob[stat] !== undefined) {
                        finalMob[stat] = Math.round(finalMob[stat] * modifier.stats[stat]);
                        // Sécurité : on empêche une stat de descendre en dessous de 1
                        if (finalMob[stat] < 1) finalMob[stat] = 1; 
                    }
                }
            }
        }
    }

    // 4. Assemblage du nom final
    // Ex: "Gobelin des Tunnels" + "Obèse" + "et Dépressif" = "Gobelin des Tunnels Obèse et Dépressif"
    if (appliedModifiers.length === 1) {
        finalMob.name = `${finalMob.name} ${appliedModifiers[0]}`;
    } else if (appliedModifiers.length === 2) {
        finalMob.name = `${finalMob.name} ${appliedModifiers[0]} et ${appliedModifiers[1]}`;
    }

    // Tag supplémentaire pour dire à notre boucle de jeu qu'il est prêt
    finalMob.isGenerated = true;
    finalMob.modifiersApplied = modifiersApplied;

    // Multiplicateur de menace apporté par les seuls modificateurs (1 = aucun bonus) — voir
    // computeThreatMultiplier() juste en dessous.
    finalMob.threatMultiplier = computeThreatMultiplier(finalMob.atk, finalMob.hp, finalMob.def, preModifierPower, preModifierDef);

    // Convention collective du Donjon (chantier 15) : aucune élite aux étages 1-2 — le mob est re-tiré tant qu'il en serait une
    // (même seuil que isEliteMob() : `>=`). Le plafond de tentatives n'est qu'un garde-fou : à ~7 % d'élites, 20 échecs de suite n'arrivent pas.
    if (_redraw < EARLY_ELITE_REDRAW_LIMIT && isEarlyEliteFreeFloor(typeof gameState !== 'undefined' ? gameState.currentFloor : 1)
        && finalMob.threatMultiplier >= config.eliteThreatMultiplier) {
        return generateMob(districtName, eliteBonus, _redraw + 1);
    }

    return finalMob;
}

// ==========================================
// CONVENTION COLLECTIVE DU DONJON (chantier 15, lot 1 — voir NOTES_DEBUT_DE_PARTIE.md)
// ==========================================
// Le paquet de début de partie vit dans config.earlyGame (app.js) ; `enabled: false` redonne le jeu d'avant.
const EARLY_ELITE_REDRAW_LIMIT = 20;

// Étage sans aucune élite (« le Syndicat des Monstres refuse toute promotion avant l'ancienneté requise »).
function isEarlyEliteFreeFloor(floor) {
    const eg = typeof config !== 'undefined' ? config.earlyGame : null;
    return !!(eg && eg.enabled && eg.elites && floor <= eg.elites.freeFloors);
}

// Multiplicateur de dégâts d'une élite à cet étage : rampe de la Convention collective (config.earlyGame.elites.damageRamp)
// aux étages qu'elle nomme, sinon le multiplicateur normal (config.mobDamageScaling.eliteDamageMult). Pure.
function eliteDamageMultForFloor(floor) {
    const base = config.mobDamageScaling.eliteDamageMult;
    const eg = config.earlyGame;
    if (!eg || !eg.enabled || !eg.elites || !eg.elites.damageRamp) return base;
    const ramp = eg.elites.damageRamp[floor];
    return ramp !== undefined ? ramp : base;
}

// Comparé à config.eliteThreatMultiplier côté app.js pour décider de l'affichage de l'icône 💀 : un
// "Colossal" isolé (x3.6) ou une combinaison de deux modificateurs plus modestes peut suffire à
// franchir le seuil, indépendamment du nombre d'adjectifs affichés dans le nom. La DEF entre avec un
// poids modéré (0.5) : un tank pur (ex. "Syndiqué", ATQ ↓ mais DEF ×1.5) doit peser un peu plus lourd
// que le seul produit ATQ×PV ne le capturait, sans laisser la DEF dominer le score à elle seule (voir
// issue d'équilibrage "métrique d'élite"). Extraite en fonction pure (plutôt que laissée inline dans
// generateMob()) pour rester testable indépendamment du pipeline aléatoire complet.
function computeThreatMultiplier(atk, hp, def, preModifierPower, preModifierDef) {
    if (preModifierPower <= 0) return 1;
    const defFactor = (def && preModifierDef > 0) ? (def / preModifierDef) : 1;
    return (atk * hp * (1 + 0.5 * (defFactor - 1))) / preModifierPower;
}

// ==========================================
// CHASSEURS DE PRIMES (chantier 3, voir NOTES_CHASSEURS.md)
// ==========================================

/**
 * Stats d'un chasseur de primes, CALÉES SUR LE JOUEUR (pure) — c'est ce qui en fait un frein au snowball :
 * un crawler très en avance sur l'étage affronte un chasseur à sa mesure, pas un mob de l'étage.
 *  - DEF = defShare × votre meilleure ATQ ;
 *  - PV  = de quoi encaisser `turnsToKill` de vos coups (votre coup moyen contre CETTE DEF) ;
 *  - ATQ = de quoi vous retirer `hitPct` de vos PV max par coup, en tenant compte de votre DEF, du
 *          plancher de mitigation et du bonus d'élite (config.mobDamageScaling), comme n'importe quel mob.
 * @param {{maxHp:number, atk:number, def:number}} player ATQ = meilleure ATQ effective, DEF = DEF effective
 * @param {{hpMult?:number, atkMult?:number, defMult?:number}} variant
 * @param {{turnsToKill:number, hitPct:number, defShare:number}} tuning
 * @param {{eliteDamageMult:number, minMitigation:number}} damage
 */
function computeBountyHunterStats(player, variant = {}, tuning, damage) {
    const t = tuning || { turnsToKill: 4, hitPct: 0.09, defShare: 0.35 };
    const d = damage || { eliteDamageMult: 1.65, minMitigation: 0.35 };
    const pAtk = Math.max(1, player.atk || 1);
    const pDef = Math.max(0, player.def || 0);
    const def = Math.max(0, Math.round(pAtk * t.defShare * (variant.defMult ?? 1)));
    const playerHit = pAtk * pAtk / (pAtk + def);
    const hp = Math.max(10, Math.round(playerHit * t.turnsToKill * (variant.hpMult ?? 1)));
    // ATQ effective visée (après bonus d'élite) : dégâts = a × max(minMitigation, a / (a + DEF joueur)).
    const target = Math.max(1, (player.maxHp || 100) * t.hitPct);
    let effAtk = (target + Math.sqrt(target * target + 4 * target * pDef)) / 2;
    if (effAtk / (effAtk + pDef) < d.minMitigation) effAtk = target / d.minMitigation;
    const atk = Math.max(1, Math.round(effAtk / d.eliteDamageMult * (variant.atkMult ?? 1)));
    return { hp, atk, def };
}

/**
 * Génère un chasseur de primes. `options` : { variantKey, player, bountyValue, floor }. Toujours élite
 * (💀, bonus de dégâts d'élite), jamais un boss ; `isBountyHunter` le distingue partout ailleurs
 * (pas d'esquive furtive, fuite à 50 %, récompense, épitaphe).
 */
function generateBountyHunter(options = {}) {
    const bountyValue = options.bountyValue || 0;
    const pool = bountyHunters.filter(h => h.minBounty <= bountyValue && h.key !== 'chief');
    const variant = (options.variantKey && bountyHunters.find(h => h.key === options.variantKey))
        || pool[Math.floor(Math.random() * pool.length)] || bountyHunters[0];
    const bal = (typeof config !== 'undefined' && config.bounty) ? config.bounty.hunter : undefined;
    const dmg = (typeof config !== 'undefined' && config.mobDamageScaling) ? config.mobDamageScaling : undefined;
    const stats = computeBountyHunterStats(options.player || { maxHp: 100, atk: 10, def: 5 }, variant, bal, dmg);
    const floor = options.floor || 1;
    const eliteThreshold = (typeof config !== 'undefined' && config.eliteThreatMultiplier) || 1.8;
    return {
        name: variant.name,
        baseName: variant.name,
        hp: stats.hp, maxHp: stats.hp, atk: stats.atk, def: stats.def,
        xpReward: Math.round(30 * getFloorScaling(floor).xpMult),
        effect: null,
        ranged: !!variant.ranged,
        visualArchetype: variant.visualArchetype,
        threatMultiplier: eliteThreshold, // Toujours élite (voir isEliteMob() dans app.js)
        modifiersApplied: [],
        isBountyHunter: true,
        hunterVariant: variant.key,
        bountyValue
    };
}

// ==========================================
// 1bis. GÉNÉRATION DU BOSS DE QUARTIER
// ==========================================

/**
 * Récupère le boss attitré d'un quartier (catalogue curaté dans bestiary.js).
 * Contrairement à generateMob(), aucun modificateur aléatoire n'est appliqué :
 * un boss de quartier a des stats fixes et intentionnelles.
 *
 * @param {string} districtName
 * @returns {object|null}
 */
function generateBoss(districtName) {
    const bossTemplate = findBossForDistrict(districtName);
    if (!bossTemplate) {
        console.error(`Erreur: Aucun boss défini pour le quartier "${districtName}".`);
        return null;
    }
    const boss = JSON.parse(JSON.stringify(bossTemplate));
    boss.baseName = boss.name;

    // Mise à l'échelle selon l'étage courant (voir section 0) : un boss de quartier n'a plus des
    // stats strictement identiques d'un étage à l'autre, sa base "intentionnelle" est juste
    // multipliée par la profondeur actuelle.
    applyFloorScaling(boss, typeof gameState !== 'undefined' ? gameState.currentFloor : 1);

    // MOB_ENRAGE (anomalies.js) : même multiplicateur d'ATQ que les mobs normaux de l'étage, au même
    // titre que le scaling par étage ci-dessus — n'est PAS un "modificateur aléatoire" (stats fixes du
    // boss inchangées sinon), donc ne contredit pas le commentaire ci-dessous.
    if (typeof gameState !== 'undefined' && gameState.anomalyEffects && gameState.anomalyEffects.mobAtkMult !== 1) {
        boss.atk = Math.max(1, Math.round(boss.atk * gameState.anomalyEffects.mobAtkMult));
    }

    // Remplaçant intérimaire (chantier 15, lot 2) : aux étages du « tutoriel », le patron est en congé et son stagiaire reçoit à sa place —
    // PV et ATQ réduits (DEF, XP et récompenses inchangées ; `baseName` inchangé pour le sprite et l'objet signature).
    const interim = earlyInterimBossScale(typeof gameState !== 'undefined' ? gameState.currentFloor : 1);
    if (interim) {
        boss.hp = Math.max(1, Math.round(boss.hp * interim.hpMult));
        boss.atk = Math.max(1, Math.round(boss.atk * interim.atkMult));
        boss.isInterim = true;
        boss.name = `${boss.name} (intérimaire)`;
    }

    boss.isGenerated = true;
    boss.modifiersApplied = []; // Pas de modificateurs aléatoires sur un boss : liste vide pour l'UI
    return boss;
}

// Période d'essai (chantier 15, lot 3) : multiplicateur de dégâts subis selon le niveau et l'étage (1 = aucun effet). −startReduction au niveau 1,
// dégressif linéaire jusqu'à 0 au niveau fadeLevel ; arrêt net au-delà de config.earlyGame.maxFloor. Dérivé du niveau et de l'étage : aucun état sauvegardé. Pure.
function trialDamageMult(level, floor) {
    const eg = typeof config !== 'undefined' ? config.earlyGame : null;
    if (!eg || !eg.enabled || !eg.trial || floor > eg.maxFloor || level >= eg.trial.fadeLevel) return 1;
    const lvl = Math.max(1, level);
    return 1 - eg.trial.startReduction * (eg.trial.fadeLevel - lvl) / (eg.trial.fadeLevel - 1);
}

// Multiplicateurs PV / ATQ d'un boss intérimaire à cet étage (config.earlyGame.interimBoss, étages ≤ maxFloor), ou null. Pure.
function earlyInterimBossScale(floor) {
    const eg = typeof config !== 'undefined' ? config.earlyGame : null;
    if (!eg || !eg.enabled || !eg.interimBoss || floor > eg.maxFloor) return null;
    return { hpMult: eg.interimBoss.hpMult, atkMult: eg.interimBoss.atkMult };
}

// ==========================================
// 2. GÉNÉRATION DES OBJETS (LOOT)
// ==========================================
// Chantier "refonte des objets" (voir NOTES_ITEMS.md) : TOUT objet — arme, arme à distance,
// armure, consommable, parchemin de sort, cadeau de départ, kit de test, objet signature de boss —
// passe par les mêmes briques pures ci-dessous (rareté, niveau d'objet, stats, valeur), pour qu'un
// réglage d'équilibrage (itemBalance, items.js) s'applique partout d'un coup.

// Étage courant, sans dépendre de gameState quand ce fichier est chargé seul.
function currentFloorForLoot() {
    return (typeof gameState !== 'undefined' && gameState.currentFloor) || 1;
}

function getRarityByKey(key) {
    return itemRarities.find(r => r.key === key) || null;
}

// Palier `steps` crans plus haut (ou plus bas si négatif), borné aux paliers existants.
function shiftRarity(rarity, steps) {
    const index = itemRarities.indexOf(rarity);
    return itemRarities[Math.max(0, Math.min(itemRarities.length - 1, index + steps))];
}

// Poids de rareté du loot à un étage donné (première ligne de itemBalance.lootTables qui le couvre).
function getLootRarityWeights(floor) {
    const f = Math.max(1, floor || 1);
    const tables = itemBalance.lootTables;
    return (tables.find(row => f <= row.maxFloor) || tables[tables.length - 1]).weights;
}

// Plafond des montées de palier à un étage (itemBalance.upgradeCaps), ou null s'il n'y en a pas.
function getUpgradeCapRarity(floor) {
    const f = Math.max(1, floor || 1);
    const row = (itemBalance.upgradeCaps || []).find(r => f <= r.maxFloor);
    return row ? getRarityByKey(row.key) : null;
}

// Plancher de rareté du butin d'un boss à un étage (itemBalance.boss.minRarityByFloor), ou null.
function getBossMinRarityKey(floor) {
    const f = Math.max(1, floor || 1);
    let key = null;
    (itemBalance.boss.minRarityByFloor || []).forEach(r => { if (f >= r.fromFloor) key = r.key; });
    return key;
}

// Rareté de l'objet signature d'un boss vaincu à un étage (itemBalance.signatureRarityByFloor).
function getSignatureRarity(floor) {
    const f = Math.max(1, floor || 1);
    const rows = itemBalance.signatureRarityByFloor;
    return getRarityByKey((rows.find(r => f <= r.maxFloor) || rows[rows.length - 1]).key);
}

/**
 * Tire la rareté d'un objet de loot. `source` : 'explore' (trouvé en explorant, marchand) | 'mob' |
 * 'elite' (CHANCE de monter d'un palier) | 'boss' (monte toujours d'un palier, plancher selon l'étage) |
 * 'treasure' (trésor exceptionnel, monte toujours d'un palier). `luckChance` (%) : chance de monter d'un
 * palier (qualificatif Chanceux de l'équipement porté, voir addLoot() dans app.js). Les montées sont
 * plafonnées aux premiers étages (itemBalance.upgradeCaps) sans jamais rabaisser le tirage de base.
 * `minRarityKey` : plancher supplémentaire optionnel, appliqué en dernier (boîte Or, par exemple).
 */
function rollLootRarity({ source = 'explore', floor = currentFloorForLoot(), minRarityKey = null, luckChance = 0 } = {}) {
    const weights = getLootRarityWeights(floor);
    const total = itemRarities.reduce((sum, r) => sum + (weights[r.key] || 0), 0);
    let roll = Math.random() * total;
    let rarity = itemRarities[1]; // Commun, par sécurité (poids tous nuls)
    for (const r of itemRarities) {
        const w = weights[r.key] || 0;
        if (roll < w) { rarity = r; break; }
        roll -= w;
    }
    const base = rarity;
    if (source === 'elite' && Math.random() * 100 < itemBalance.eliteUpgradeChance) rarity = shiftRarity(rarity, 1);
    if (source === 'boss') rarity = shiftRarity(rarity, itemBalance.boss.tierBonus);
    if (source === 'treasure') rarity = shiftRarity(rarity, itemBalance.treasure.tierBonus);
    if (luckChance > 0 && Math.random() * 100 < luckChance) rarity = shiftRarity(rarity, 1); // Chanceux (qualificatif porté)
    const cap = getUpgradeCapRarity(floor);
    if (cap) {
        const capIndex = Math.max(itemRarities.indexOf(base), itemRarities.indexOf(cap));
        if (itemRarities.indexOf(rarity) > capIndex) rarity = itemRarities[capIndex];
    }
    const minKeys = [minRarityKey, source === 'boss' ? getBossMinRarityKey(floor) : null].filter(Boolean);
    minKeys.forEach(key => {
        const min = getRarityByKey(key);
        if (min && itemRarities.indexOf(rarity) < itemRarities.indexOf(min)) rarity = min;
    });
    return rarity;
}

// Multiplicateur de niveau d'objet : 1 au niveau 1, puis +perLevel par niveau (voir itemBalance).
// `kind` : 'equipment' (dégâts/armure) ou 'heal' (soins des consommables).
function getItemLevelMult(itemLevel, kind = 'equipment') {
    return 1 + itemBalance.levelScaling[kind] * (Math.max(1, itemLevel || 1) - 1);
}

// Stat moyenne (sans aléa) d'une stat de base à une rareté et un niveau d'objet donnés — fonction
// pure, utilisée par buildItem() et par l'outil de calibrage (tests/tools/item-curve.js).
function computeItemStat(baseStat, rarityKey, itemLevel, kind = 'equipment') {
    return baseStat * getRarityByKey(rarityKey).statMult * getItemLevelMult(itemLevel, kind);
}

// Valeur marchande d'un objet (PO) : croît fortement avec la rareté, plus doucement avec le niveau
// d'objet et le nombre de qualificatifs — voir itemBalance.value. Base de la revente (sellItem()) et
// du prix du marchand (generateShopStock()).
function computeItemValue(baseValue, rarityKey, itemLevel, enchantCount = 0) {
    const rarity = getRarityByKey(rarityKey) || itemRarities[1];
    const v = itemBalance.value;
    const levelMult = 1 + v.perLevel * (Math.max(1, itemLevel || 1) - 1);
    return Math.max(1, Math.round((baseValue || 0) * rarity.valueMult * levelMult * (1 + v.perEnchant * enchantCount)));
}

// Objet de base tiré dans un pool : seulement ceux déjà accessibles à cet étage (`minFloor`), et les
// objets blagues (`jokeItem`) uniquement au palier Camelote. Tirage PONDÉRÉ par la famille de l'objet
// (chantier 10, ITEM_FAMILIES : beaucoup de bricolage, rarement du vrai matériel) ; `familyMult` (option)
// multiplie le poids de certaines familles (boutiques, voir itemBalance.shopFamilyBoost).
function baseItemWeight(base, familyMult = null) {
    if (base.dropWeight !== undefined) return base.dropWeight;
    const family = ITEM_FAMILIES[base.family] || ITEM_FAMILIES.standard;
    const jokeMult = base.jokeItem ? itemBalance.jokeWeightMult : 1; // objets blagues : moins fréquents que le reste du bricolage
    return family.weight * jokeMult * ((familyMult && familyMult[base.family]) || 1);
}

function pickBaseItem(pool, floor, rarity, familyMult = null) {
    const allowJokes = rarity.key === 'camelote';
    let candidates = pool.filter(b => (b.minFloor || 1) <= floor && (allowJokes || !b.jokeItem));
    if (candidates.length === 0) candidates = pool.filter(b => !b.jokeItem);
    if (candidates.length === 0) candidates = pool;
    const total = candidates.reduce((sum, b) => sum + baseItemWeight(b, familyMult), 0);
    let roll = Math.random() * total;
    for (const b of candidates) {
        roll -= baseItemWeight(b, familyMult);
        if (roll < 0) return b;
    }
    return candidates[candidates.length - 1];
}

// --- Qualificatifs (itemQualifiers, items.js) ---------------------------------------------------

// Cible d'un qualificatif selon la catégorie d'objet : armes de mêlée ET à distance partagent la cible
// 'weapon' ; consommables : aucune (jamais de qualificatif).
function qualifierTarget(category) {
    if (category === 'weapons' || category === 'ranged') return 'weapon';
    if (category === 'armors') return 'armor';
    if (category === 'scrolls') return 'spell';
    return null;
}

// Valeurs d'un qualificatif pour une cible et un rang (1 à 3) : chaque tableau du catalogue est
// réduit à la valeur de ce rang, les scalaires sont repris tels quels. null si ce qualificatif
// n'existe pas pour cette cible.
function getQualifierValues(key, target, rank = 1) {
    const q = itemQualifiers[key];
    const block = q && q[target];
    if (!block) return null;
    const values = {};
    for (const field in block) {
        if (field === 'text') continue;
        const raw = block[field];
        values[field] = Array.isArray(raw) ? raw[Math.min(raw.length, Math.max(1, rank)) - 1] : raw;
    }
    return values;
}

// Phrase d'inspection exacte d'un qualificatif (chiffres du rang compris).
function describeQualifier(key, target, rank = 1) {
    const values = getQualifierValues(key, target, rank);
    return values ? itemQualifiers[key][target].text(values) : '';
}

const QUALIFIER_RANK_LABELS = ['', 'I', 'II', 'III'];

// "Tranchant II" (les défauts de Camelote, à rang unique, n'affichent pas de rang).
function formatQualifierLabel(key, rank = 1) {
    const q = itemQualifiers[key];
    if (!q) return key;
    return q.kind === 'malus' ? q.name : `${q.name} ${QUALIFIER_RANK_LABELS[rank] || rank}`;
}

// Un qualificatif par slot de la rareté, tous au rang maximal de la rareté (Rare I, Épique II,
// Légendaire III). Le Ne slot pioche parmi les qualificatifs de tier <= N, jamais deux fois le même.
function rollQualifiers(rarity, target) {
    const picked = [];
    for (let slotIndex = 0; slotIndex < rarity.slots; slotIndex++) {
        const pool = Object.keys(itemQualifiers).filter(key => {
            const q = itemQualifiers[key];
            return q[target] && q.kind !== 'malus' && q.tier <= slotIndex + 1 && !picked.some(p => p.key === key);
        });
        if (pool.length === 0) continue;
        picked.push({ key: pool[Math.floor(Math.random() * pool.length)], rank: rarity.maxRank });
    }
    return picked;
}

// Camelote : itemBalance.junkMalusChance % de chance de porter UN défaut (itemQualifiers kind 'malus').
function rollJunkMalus(target) {
    if (Math.random() * 100 >= itemBalance.junkMalusChance) return [];
    const pool = Object.keys(itemQualifiers).filter(key => itemQualifiers[key].kind === 'malus' && itemQualifiers[key][target]);
    if (pool.length === 0) return [];
    return [{ key: pool[Math.floor(Math.random() * pool.length)], rank: 1 }];
}

// Pose les qualificatifs sur un objet : `qualifiers` (source de vérité, avec rangs), `mechanics`
// (clés seules, lues par le rendu : couleurs, étincelles, traînée), nom complété, et défauts de
// stats "Rouillé"/"Fêlé" directement comptés dans baseDmg/baseArmor (l'inspection montre le vrai chiffre).
function applyQualifiers(item, qualifiers, target) {
    if (qualifiers.length === 0) return;
    item.qualifiers = qualifiers;
    item.mechanics = qualifiers.map(q => q.key);
    item.name = formatEnchantedName(item.name, qualifiers.map(q => itemQualifiers[q.key].name));
    qualifiers.forEach(q => {
        const values = getQualifierValues(q.key, target, q.rank);
        if (q.key === 'rusty' && item.baseDmg !== undefined) item.baseDmg = Math.max(1, Math.round(item.baseDmg * (1 - values.pct / 100)));
        if (q.key === 'cracked' && item.baseArmor !== undefined) item.baseArmor = Math.round(item.baseArmor * (1 - values.pct / 100));
    });
}

// Nombre de qualificatifs qui AJOUTENT de la valeur (les défauts n'en ajoutent pas).
function countValuableQualifiers(qualifiers) {
    return (qualifiers || []).filter(q => itemQualifiers[q.key] && itemQualifiers[q.key].kind !== 'malus').length;
}

// "Nom de base Adjectif1, Adjectif2 et Adjectif3"
function formatEnchantedName(baseName, names) {
    if (names.length === 0) return baseName;
    if (names.length === 1) return `${baseName} ${names[0]}`;
    return `${baseName} ${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

// Qualificatifs d'un objet tiré au sort selon sa rareté (défaut de Camelote, ou un par slot).
function rollItemQualifiers(item, rarity, target) {
    if (!target) return [];
    if (rarity.key === 'camelote') return rollJunkMalus(target);
    if (item.canEnchant === false || rarity.slots === 0) return [];
    return rollQualifiers(rarity, target);
}

function applyRarity(item, rarity) {
    item.rarity = rarity.name;
    item.rarityKey = rarity.key;
    item.rarityColor = rarity.color;
}

// Aléa ±statJitter pour que deux objets identiques ne soient jamais rigoureusement pareils —
// `jitter: false` le coupe (objets fixes, tests).
function statJitterMult(jitter) {
    if (jitter === false) return 1;
    return 1 + (Math.random() * 2 - 1) * itemBalance.statJitter;
}

/**
 * Construit un objet (arme, arme à distance, armure ou consommable) à partir d'un objet de base, d'une
 * rareté et d'un niveau d'objet. Seule fonction qui met des stats d'objet à l'échelle.
 */
function buildItem(base, category, rarity, itemLevel, options = {}) {
    const item = JSON.parse(JSON.stringify(base));
    item.category = category;
    item.baseName = base.name; // nom d'origine, avant qualificatifs : clé du sprite (resolveItemSpriteKey())
    applyRarity(item, rarity);
    item.itemLevel = Math.max(1, itemLevel || 1);

    const mult = rarity.statMult * statJitterMult(options.jitter);
    const levelMult = getItemLevelMult(item.itemLevel, 'equipment');
    if (item.baseDmg !== undefined) item.baseDmg = Math.max(1, Math.round(item.baseDmg * mult * levelMult));
    if (item.baseArmor !== undefined) item.baseArmor = Math.round(item.baseArmor * mult * levelMult);
    if (item.heal > 0) item.heal = Math.round(item.heal * mult * getItemLevelMult(item.itemLevel, 'heal'));
    if (item.mana > 0) item.mana = Math.round(item.mana * mult);

    const target = qualifierTarget(category);
    const qualifiers = withFixedTrait(base, options.qualifiers || rollItemQualifiers(item, rarity, target), target);
    applyQualifiers(item, qualifiers, target);
    item.value = computeItemValue(base.baseValue, rarity.key, item.itemLevel, countValuableQualifiers(qualifiers));
    return item;
}

// Trait fixe d'un objet de base (chantier 10, `base.trait`) : ajouté en tête de ses qualificatifs, toujours,
// quelle que soit la rareté (compromis d'un gros objet : Grinçant, Bancal…) — jamais en double.
function withFixedTrait(base, qualifiers, target) {
    if (!base.trait || !target || !itemQualifiers[base.trait] || !getQualifierValues(base.trait, target, 1)) return qualifiers;
    if (qualifiers.some(q => q.key === base.trait)) return qualifiers;
    return [{ key: base.trait, rank: 1, fixed: true }, ...qualifiers];
}

/**
 * Construit un parchemin de sort (même système de rareté/niveau d'objet qu'une arme). La rareté fait
 * grimper baseDmg ET manaCost (ce dernier à moitié seulement, voir itemBalance.spellManaRarityWeight) ;
 * le niveau d'objet ne fait grimper que baseDmg (le mana reste plafonné à 100). Le résultat rejoint gameState.spellbook, pas gameState.inventory (voir addLoot() dans app.js).
 */
function buildSpellScroll(base, rarity, itemLevel, options = {}) {
    const scroll = JSON.parse(JSON.stringify(base));
    scroll.category = 'scrolls';
    scroll.spellCategory = base.category; // 'melee' | 'ranged' | 'any' (utilitaire) — voir attackMagic() dans app.js
    scroll.spellName = base.name;
    applyRarity(scroll, rarity);
    scroll.itemLevel = Math.max(1, itemLevel || 1);

    const jitter = statJitterMult(options.jitter);
    const manaMult = 1 + (rarity.statMult - 1) * itemBalance.spellManaRarityWeight;
    scroll.baseDmg = Math.max(1, Math.round(base.baseDmg * rarity.statMult * jitter * getItemLevelMult(scroll.itemLevel, 'equipment')));
    scroll.manaCost = Math.max(5, Math.round(base.manaCost * manaMult * jitter));
    scroll.name = `Parchemin : ${base.name}`;
    // Soin Express (chantier 11) : la part de PV soignée suit la rareté du parchemin, comme des dégâts.
    if (scroll.spellEffect && scroll.spellEffect.kind === 'heal') {
        scroll.spellEffect = { ...scroll.spellEffect, pct: Math.round(base.spellEffect.pct * rarity.statMult) };
    }
    const qualifiers = options.qualifiers || rollItemQualifiers(scroll, rarity, 'spell');
    applyQualifiers(scroll, qualifiers, 'spell');
    scroll.value = computeItemValue(base.baseValue, rarity.key, scroll.itemLevel, countValuableQualifiers(qualifiers));
    return scroll;
}

/**
 * Génère un parchemin de sort aléatoire. `options` : { floor, itemLevel, source, rarityKey,
 * minRarityKey, jitter } — voir generateItem().
 */
function generateSpellScroll(options = {}) {
    const floor = options.floor ?? currentFloorForLoot();
    const itemLevel = options.itemLevel ?? floor;
    const pool = spellCatalog.filter(s => (s.minFloor || 1) <= floor);
    const candidates = pool.length > 0 ? pool : spellCatalog;
    const base = candidates[Math.floor(Math.random() * candidates.length)];
    const rarity = options.rarityKey
        ? getRarityByKey(options.rarityKey)
        : rollLootRarity({ source: options.source, floor, minRarityKey: options.minRarityKey, luckChance: options.luckChance });
    return buildSpellScroll(base, rarity, itemLevel, options);
}

/**
 * Génère un objet de loot aléatoire. `options` :
 *  - floor (défaut : étage courant) — pilote la table de rareté et les objets de base accessibles ;
 *  - itemLevel (défaut : floor) ;
 *  - source ('explore' | 'mob' | 'elite' | 'boss' | 'treasure', voir rollLootRarity()) ;
 *  - category — impose la catégorie au lieu de la tirer (stock d'un marchand spécialisé) ;
 *  - rarityKey — impose la rareté ; minRarityKey — plancher de rareté ;
 *  - jitter: false — coupe l'aléa ±10 % sur les stats.
 * "scrolls" (parchemins) n'a pas d'entrée dans baseItems : c'est le grimoire (spellCatalog) qui lui sert
 * de pool, via generateSpellScroll() — même chance de tirage que les 4 autres catégories.
 */
function generateItem(options = {}) {
    const floor = options.floor ?? currentFloorForLoot();
    const itemLevel = options.itemLevel ?? floor;
    const categories = [...Object.keys(baseItems), 'scrolls'];
    // SECHERESSE (anomalies.js) : double la chance de tirer un consommable (potion) — tirage pondéré
    // uniquement dans ce cas précis.
    const potionMult = (typeof gameState !== 'undefined' && gameState.anomalyEffects) ? (gameState.anomalyEffects.potionDropMult || 1) : 1;
    let categoryName = options.category || null;
    if (!categoryName) {
        if (potionMult !== 1 && categories.includes('consumables')) {
            const weights = categories.map(c => c === 'consumables' ? potionMult : 1);
            const total = weights.reduce((sum, w) => sum + w, 0);
            let roll = Math.random() * total;
            categoryName = categories[categories.length - 1];
            for (let i = 0; i < categories.length; i++) {
                if (roll < weights[i]) { categoryName = categories[i]; break; }
                roll -= weights[i];
            }
        } else {
            categoryName = categories[Math.floor(Math.random() * categories.length)];
        }
    }
    if (categoryName === 'scrolls') return generateSpellScroll({ ...options, floor, itemLevel });

    const rarity = options.rarityKey
        ? getRarityByKey(options.rarityKey)
        : rollLootRarity({ source: options.source, floor, minRarityKey: options.minRarityKey, luckChance: options.luckChance });
    const base = pickBaseItem(baseItems[categoryName], floor, rarity, options.familyMult || null);
    return buildItem(base, categoryName, rarity, itemLevel, options);
}

/**
 * Objet signature d'un boss (bestiary.js, districtBosses.*.signatureItem) : sa rareté suit l'étage où le
 * boss tombe (getSignatureRarity() : Rare, puis Épique, Légendaire seulement dès l'étage 10), mis à
 * l'échelle par le niveau d'objet comme tout objet, mais sans aléa ni qualificatif aléatoire (son
 * mécanisme thématique est fixe, au rang maximal de sa rareté).
 */
function buildSignatureItem(template, itemLevel, rarityKey = getSignatureRarity(currentFloorForLoot()).key, options = {}) {
    const rarity = getRarityByKey(rarityKey) || itemRarities[itemRarities.length - 1];
    const item = JSON.parse(JSON.stringify(template));
    applyRarity(item, rarity);
    item.itemLevel = Math.max(1, itemLevel || 1);
    const levelMult = getItemLevelMult(item.itemLevel, 'equipment');
    if (item.baseDmg !== undefined) item.baseDmg = Math.max(1, Math.round(item.baseDmg * rarity.statMult * levelMult));
    if (item.baseArmor !== undefined) item.baseArmor = Math.round(item.baseArmor * rarity.statMult * levelMult);
    // Son mécanisme thématique fixe, au rang maximal de sa rareté — le nom de l'objet reste celui du boss.
    const rank = Math.max(1, rarity.maxRank);
    item.qualifiers = (item.mechanics || []).map(key => ({ key, rank }));
    // Forgée par un Coup de grâce parfait (chantier 6, V3) avec 3 Parfaits ou plus dans le combat : un qualificatif de plus, tiré parmi
    // ceux que cette cible n'a pas déjà, au rang maximal de la rareté. Le nom de l'objet reste celui du boss.
    if (options.extraQualifier) {
        const target = qualifierTarget(item.category);
        const pool = Object.keys(itemQualifiers).filter(key => target && itemQualifiers[key][target] && itemQualifiers[key].kind !== 'malus' && !item.qualifiers.some(q => q.key === key));
        if (pool.length) {
            const key = pool[Math.floor(Math.random() * pool.length)];
            item.qualifiers.push({ key, rank });
            item.mechanics = (item.mechanics || []).concat(key);
            item.forgedByPerfect = true;
        }
    }
    item.value = computeItemValue(template.baseValue, rarity.key, item.itemLevel, countValuableQualifiers(item.qualifiers));
    return item;
}

/**
 * Génère l'objet du cadeau de bienvenue (écran de départ, voir revealWelcomeGift() dans app.js).
 * `type` ('weapon'/'ranged'/'armor'/'spell', jamais 'nothing' — géré à part par l'appelant) est déjà
 * tiré au hasard pondéré par rollWelcomeGiftType() ; toujours au palier Camelote (objets blagues
 * compris, un défaut possible), niveau d'objet 1 : on démarre presque toujours équipé, mais mal.
 *
 * @param {string} type - 'weapon' | 'ranged' | 'armor' | 'spell'
 * @returns {object|null}
 */
function generateWelcomeGiftItem(type) {
    const junk = getRarityByKey('camelote');
    const categoryName = { weapon: 'weapons', ranged: 'ranged', armor: 'armors' }[type];
    if (categoryName) {
        // Même tirage pondéré que le loot (familles, objets blagues à demi-poids) : environ un cadeau sur trois
        // reste une blague, comme avant l'arrivée des nouveaux objets blagues.
        return buildItem(pickBaseItem(baseItems[categoryName], 1, junk), categoryName, junk, 1, { jitter: false });
    }
    if (type === 'spell') {
        // Toujours un sort offensif : un crawler de départ avec un simple sort de soin n'aurait aucune attaque.
        const pool = spellCatalog.filter(s => (s.minFloor || 1) <= 1 && s.category !== 'any');
        return buildSpellScroll(pool[Math.floor(Math.random() * pool.length)], junk, 1, { jitter: false });
    }
    return null;
}

/**
 * Génère une arme ou une arme à distance de test, toujours au palier Légendaire (tous les slots
 * d'enchantement) et au niveau d'objet de l'étage courant — bouton de test discret (voir giveTestKit()
 * dans app.js), sans lien avec la progression normale d'une run.
 *
 * @param {string} categoryName - 'weapons' | 'ranged'
 * @returns {object}
 */
function generateTestKitItem(categoryName) {
    const pool = baseItems[categoryName].filter(b => !b.jokeItem);
    const base = pool[Math.floor(Math.random() * pool.length)];
    return buildItem(base, categoryName, itemRarities[itemRarities.length - 1], currentFloorForLoot(), { jitter: false });
}

/**
 * Génère un sort de test, toujours au palier Légendaire — même esprit que generateTestKitItem().
 * @returns {object}
 */
function generateTestKitSpell() {
    const pool = spellCatalog.filter(s => s.category !== 'any'); // un sort offensif, comme le cadeau de départ
    const base = pool[Math.floor(Math.random() * pool.length)];
    return buildSpellScroll(base, itemRarities[itemRarities.length - 1], currentFloorForLoot(), { jitter: false });
}

// ==========================================
// 3. GÉNÉRATION DES COMPAGNONS (CRAWLERS RENCONTRÉS)
// ==========================================
// Petit jeu de données propre aux compagnons : trop réduit pour justifier un fichier dédié
// (contrairement aux monstres/objets/quartiers), donc regroupé ici avec sa génération.

const companionNamePool = [
    "Steve-Trois-Doigts", "Barbara la Vive", "Mordicaï", "Chip Cachalot",
    "Nadia Sans-Peur", "Gunther l'Endurci", "Lucky Numéro 9", "Prunelle",
    "Doc Ferraille", "Kenji le Silencieux"
];

// Spécialité procédurale : détermine comment le compagnon aide une fois recruté. `desc` est affiché au
// recrutement et sur sa fiche : il résume l'effet en combat ET hors combat (chiffres dans config.companions).
const companionSpecialties = [
    { type: 'strike', label: "Frappe d'appoint", desc: "Frappe à chacune de vos attaques. Hors combat : +10 % de PO trouvées." },
    { type: 'guard', label: "Garde rapprochée", desc: "Ajoute la moitié de sa DEF à la vôtre et encaisse souvent des coups à votre place. Hors combat : moins d'embuscades en trajet." },
    { type: 'medic', label: "Premiers secours", desc: "Vous soigne parfois en combat et après chaque victoire. Rend aussi un peu de mana." },
    { type: 'scout', label: "Éclaireur", desc: "Meilleure furtivité et fuite. Hors combat : évite un piège sur deux." }
];

// Réglages compagnons (config.companions dans app.js), avec repli si config n'existe pas encore.
function companionBalance() {
    return (typeof config !== 'undefined' && config.companions) ? config.companions : null;
}

/**
 * Stats d'un compagnon à son niveau (pure) : base (fixée à l'embauche, déjà indexée sur l'étage) ×
 * (1 + levelStatGain × (niveau − 1)). Ne touche PAS aux PV courants.
 */
function computeCompanionLevelStats(companion) {
    const gain = (companionBalance() || { levelStatGain: 0.10 }).levelStatGain;
    const mult = 1 + gain * Math.max(0, (companion.level || 1) - 1);
    return {
        maxHp: Math.max(1, Math.round(companion.baseHp * mult)),
        atk: Math.max(1, Math.round(companion.baseAtk * mult)),
        def: Math.max(0, Math.round(companion.baseDef * mult))
    };
}

// ATQ / DEF effectives d'un compagnon : ses stats + l'arme / l'armure qu'on lui a données.
function getCompanionAtk(companion) {
    if (!companion) return 0;
    const weapon = companion.gear && companion.gear.weapon;
    return (companion.atk || 0) + (weapon ? (weapon.baseDmg || 0) : 0);
}

function getCompanionDef(companion) {
    if (!companion) return 0;
    const armor = companion.gear && companion.gear.armor;
    return (companion.def || 0) + (armor ? (armor.baseArmor || 0) : 0);
}

// Emplacement du compagnon qui reçoit un objet donné : arme (mêlée OU distance, il n'en porte qu'une),
// armure ou sort ; null pour un consommable (utilisé sur-le-champ) ou tout autre objet.
function companionGiftSlot(item) {
    if (!item) return null;
    if (item.category === 'weapons' || item.category === 'ranged') return 'weapon';
    if (item.category === 'armors') return 'armor';
    if (item.category === 'scrolls') return 'spell';
    return null;
}

// Loyauté rapportée par un don (pure). Un objet déjà donné une fois (`companionGifted`, posé au premier
// don) ne rapporte plus rien : sans ça, donner / récupérer / redonner le même objet ferait monter la
// loyauté à l'infini.
function companionGiftLoyalty(item) {
    const bal = companionBalance();
    if (!item || !bal) return 0;
    if (item.category === 'consumables') return bal.loyalty.consumableGift;
    if (item.companionGifted) return 0;
    return bal.loyalty.giftByRarity[item.rarityKey] ?? bal.loyalty.giftByRarity.commun;
}

// Chance (%) qu'un compagnon quitte le groupe au changement d'étage (pure) : nulle au-dessus du seuil.
function companionDepartureChance(loyalty) {
    const bal = companionBalance();
    const threshold = bal ? bal.loyalty.departureThreshold : 40;
    const perPoint = bal ? bal.loyalty.departurePerPoint : 2;
    if (loyalty >= threshold) return 0;
    return Math.min(100, (threshold - loyalty) * perPoint);
}

/**
 * Génère un candidat compagnon rencontré au hasard : nom, stats de base INDEXÉES SUR L'ÉTAGE (même
 * getFloorScaling() que les mobs, pour qu'il reste utile en profondeur), spécialité procédurale, et
 * disposition (ami/hostile) tirée 50/50, sans pondération par quartier.
 * @param {number} [floor] étage de la rencontre (défaut : étage courant)
 * @returns {object}
 */
function generateCompanionCandidate(floor) {
    const f = floor ?? ((typeof gameState !== 'undefined' && gameState.currentFloor) || 1);
    const scaling = getFloorScaling(f);
    const name = companionNamePool[Math.floor(Math.random() * companionNamePool.length)];
    const specialty = JSON.parse(JSON.stringify(
        companionSpecialties[Math.floor(Math.random() * companionSpecialties.length)]
    ));
    const bal = companionBalance();

    const companion = {
        name,
        baseHp: Math.round((40 + Math.floor(Math.random() * 20)) * scaling.hpMult),
        baseAtk: Math.round((8 + Math.floor(Math.random() * 6)) * scaling.atkMult),
        baseDef: Math.round((4 + Math.floor(Math.random() * 4)) * scaling.defMult),
        specialty,
        disposition: Math.random() < 0.5 ? 'hostile' : 'friendly', // 50/50, pas de pondération par quartier
        hiredFloor: f,
        xp: 0,
        level: 1,
        xpToNext: 30,
        // Loyauté (0-100) : monte avec ce que vit le groupe (victoires, repos, dons), baisse quand vous
        // fuyez ou qu'il tombe. Seul un compagnon peu loyal risque de partir, au changement d'étage.
        loyalty: bal ? bal.loyalty.start : 60,
        downed: false, // À terre (0 PV) : inactif jusqu'au prochain repos ou soin
        gear: { weapon: null, armor: null, spell: null }
    };
    Object.assign(companion, computeCompanionLevelStats(companion));
    companion.hp = companion.maxHp;
    return companion;
}

/**
 * Migration douce d'un compagnon venant d'une sauvegarde antérieure au rework (pure, renvoie une copie) :
 * `leaveChance` → loyauté, stats courantes → stats de base (les niveaux d'avant ne donnaient rien, donc
 * on garde exactement les stats actuelles), équipement vide.
 */
function normalizeCompanion(companion) {
    if (!companion) return null;
    const c = { ...companion };
    const gain = (companionBalance() || { levelStatGain: 0.10 }).levelStatGain;
    const levelMult = 1 + gain * Math.max(0, (c.level || 1) - 1);
    if (c.baseHp === undefined) c.baseHp = (c.maxHp || c.hp || 40) / levelMult;
    if (c.baseAtk === undefined) c.baseAtk = (c.atk || 8) / levelMult;
    if (c.baseDef === undefined) c.baseDef = (c.def || 4) / levelMult;
    if (c.loyalty === undefined) {
        const start = companionBalance() ? companionBalance().loyalty.start : 60;
        c.loyalty = Math.max(0, Math.min(100, Math.round(start - (c.leaveChance || 0) / 2)));
    }
    delete c.leaveChance;
    if (!c.gear) c.gear = { weapon: null, armor: null, spell: null };
    if (c.downed === undefined) c.downed = (c.hp || 0) <= 0;
    if (!c.maxHp) Object.assign(c, computeCompanionLevelStats(c));
    return c;
}


