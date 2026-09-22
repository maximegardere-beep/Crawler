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
    return {
        hpMult: 1 + depth * rates.hp,
        atkMult: 1 + depth * rates.atk,
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
function generateMob(districtName) {
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

    // 1bis. Mise à l'échelle selon l'étage courant (voir section 0), avant tout modificateur
    applyFloorScaling(finalMob, typeof gameState !== 'undefined' ? gameState.currentFloor : 1);

    // 2. Jet de dés pour le nombre de modificateurs (Ex: 15% pour 2, 35% pour 1 (total 50%), 50% pour 0)
    const roll = Math.random() * 100;
    let modifierCount = 0;
    
    if (roll <= 15) {
        modifierCount = 2; // 15% de chance d'avoir 2 adjectifs (Mob d'élite)
    } else if (roll <= 50) {
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

    return finalMob;
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

    // Mise à l'échelle selon l'étage courant (voir section 0) : un boss de quartier n'a plus des
    // stats strictement identiques d'un étage à l'autre, sa base "intentionnelle" est juste
    // multipliée par la profondeur actuelle.
    applyFloorScaling(boss, typeof gameState !== 'undefined' ? gameState.currentFloor : 1);

    boss.isGenerated = true;
    boss.modifiersApplied = []; // Pas de modificateurs aléatoires sur un boss : liste vide pour l'UI
    return boss;
}

// ==========================================
// 2. GÉNÉRATION DES OBJETS (LOOT)
// ==========================================

// Poids de tirage de chaque palier de rareté selon un score de puissance `t` (0 = très faible,
// 1 = très puissant : boss profond ou mob très modifié). Interpolation linéaire entre deux jeux de
// poids : à faible puissance, presque toujours du Commun/Rare ; à haute puissance, l'Épique et le
// Légendaire deviennent des tirages courants. Valeurs de départ, à ajuster par playtest réel.
function getRarityWeights(powerScore) {
    const t = Math.max(0, Math.min(1, powerScore));
    const lerp = (low, high) => low + (high - low) * t;
    return {
        commun: lerp(70, 15),
        rare: lerp(25, 35),
        epique: lerp(4.5, 35),
        legendaire: lerp(0.5, 15)
    };
}

// Tire un palier de rareté au hasard, pondéré par le score de puissance (voir getRarityWeights()).
function rollRarity(powerScore) {
    const weights = getRarityWeights(powerScore);
    const entries = itemRarities.map(r => ({ rarity: r, weight: weights[r.key] || 0 }));
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;
    for (const e of entries) {
        if (roll < e.weight) return e.rarity;
        roll -= e.weight;
    }
    return entries[entries.length - 1].rarity;
}

/**
 * Génère un objet aléatoire, avec un palier de rareté (Commun/Rare/Épique/Légendaire) pondéré par
 * `powerScore` (0 à 1 : puissance du monstre vaincu, ou de l'étage courant à défaut de monstre —
 * voir getLootPowerScore() dans app.js). La rareté détermine à la fois le multiplicateur de stats
 * ET le nombre/la puissance des enchantements (voir itemRarities et itemModifiers.effect).
 *
 * @param {number} powerScore - Score de puissance entre 0 et 1 (voir getLootPowerScore()).
 * @returns {object} - L'objet final généré
 */
function generateItem(powerScore = 0) {
    // 1. Choix d'une catégorie d'objet (weapons, ranged, armors, consumables), puis d'un objet de
    // base dedans
    const categories = Object.keys(baseItems);
    const categoryName = categories[Math.floor(Math.random() * categories.length)];
    const categoryItems = baseItems[categoryName];
    const baseItemIndex = Math.floor(Math.random() * categoryItems.length);
    const finalItem = JSON.parse(JSON.stringify(categoryItems[baseItemIndex]));
    finalItem.category = categoryName; // conserve la catégorie (utile pour l'UI/logique future)

    // 2. Tirage du palier de rareté, puis mise à l'échelle des stats de base (avec un peu
    // d'aléatoire ±10% pour éviter que deux objets de même rareté soient rigoureusement identiques)
    const rarity = rollRarity(powerScore);
    finalItem.rarity = rarity.name;
    finalItem.rarityColor = rarity.color;

    const statMult = rarity.statMult * (0.9 + Math.random() * 0.2);
    if (finalItem.baseDmg !== undefined) finalItem.baseDmg = Math.max(1, Math.round(finalItem.baseDmg * statMult));
    if (finalItem.baseArmor !== undefined) finalItem.baseArmor = Math.round(finalItem.baseArmor * statMult);
    if (finalItem.heal !== undefined && finalItem.heal > 0) finalItem.heal = Math.round(finalItem.heal * statMult);

    // 3. Enchantements : un par slot de la rareté tirée (voir itemRarities.slots). Le Ne slot
    // pioche dans le pool des effets de tier <= N, donc plus l'objet est rare, plus ses derniers
    // slots ont accès aux effets les plus puissants (tier 3, réservé au Légendaire).
    const appliedNames = [];
    const appliedMechanics = [];
    if (finalItem.canEnchant !== false && rarity.slots > 0) {
        for (let slotIndex = 0; slotIndex < rarity.slots; slotIndex++) {
            const maxTier = slotIndex + 1;
            const pool = itemModifiers.effect.filter(e => e.tier <= maxTier && !appliedNames.includes(e.name));
            if (pool.length === 0) continue;
            const picked = pool[Math.floor(Math.random() * pool.length)];
            appliedNames.push(picked.name);
            if (picked.mechanic) appliedMechanics.push(picked.mechanic);
        }
    }
    if (appliedMechanics.length > 0) finalItem.mechanics = appliedMechanics;

    // 4. Assemblage du nom : "Nom de base Adjectif1, Adjectif2 et Adjectif3"
    if (appliedNames.length === 1) {
        finalItem.name = `${finalItem.name} ${appliedNames[0]}`;
    } else if (appliedNames.length === 2) {
        finalItem.name = `${finalItem.name} ${appliedNames[0]} et ${appliedNames[1]}`;
    } else if (appliedNames.length >= 3) {
        finalItem.name = `${finalItem.name} ${appliedNames.slice(0, -1).join(", ")} et ${appliedNames[appliedNames.length - 1]}`;
    }

    return finalItem;
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

// Spécialité procédurale : détermine comment le compagnon aide en combat une fois recruté
const companionSpecialties = [
    { type: 'strike', label: "Frappe d'appoint", desc: "Porte un coup supplémentaire à chaque attaque du joueur." },
    { type: 'guard', label: "Garde rapprochée", desc: "Réduit les dégâts subis par le joueur." },
    { type: 'medic', label: "Premiers secours", desc: "Chance de soigner le joueur en cours de combat." },
    { type: 'scout', label: "Éclaireur", desc: "Améliore les chances de fuite du joueur." }
];

/**
 * Génère un candidat compagnon rencontré au hasard : nom, stats de base, spécialité procédurale,
 * et disposition (ami/hostile) tirée 50/50, sans pondération par quartier.
 * @returns {object}
 */
function generateCompanionCandidate() {
    const name = companionNamePool[Math.floor(Math.random() * companionNamePool.length)];
    const specialty = JSON.parse(JSON.stringify(
        companionSpecialties[Math.floor(Math.random() * companionSpecialties.length)]
    ));
    const hp = 40 + Math.floor(Math.random() * 20);

    return {
        name,
        hp, maxHp: hp,
        atk: 8 + Math.floor(Math.random() * 6),
        def: 4 + Math.floor(Math.random() * 4),
        specialty,
        disposition: Math.random() < 0.5 ? 'hostile' : 'friendly', // 50/50, pas de pondération par quartier
        xp: 0,
        level: 1,
        xpToNext: 30,
        aggressiveness: 0 // Grimpe avec l'expérience du compagnon ; à 100, il devient hostile
    };
}


