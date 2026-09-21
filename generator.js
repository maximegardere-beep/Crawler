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

            // Transmission de l'effet élémentaire éventuel (burn/poison/slow/stun) au monstre final
            if (modifier.effect) finalMob.effect = modifier.effect;

            // Application des statistiques (Addition)
            // On s'assure que la stat existe avant de l'additionner
            if (modifier.stats) {
                for (let stat in modifier.stats) {
                    if (finalMob[stat] !== undefined) {
                        finalMob[stat] += modifier.stats[stat];
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
    return boss;
}

// ==========================================
// 2. GÉNÉRATION DES OBJETS (LOOT)
// ==========================================

/**
 * Génère un objet aléatoire en combinant un objet de base avec des adjectifs.
 * 
 * @returns {object} - L'objet final généré
 */
function generateItem() {
    // 1. Choix d'une catégorie d'objet (weapons, armors, consumables), puis d'un objet de base dedans
    const categories = Object.keys(baseItems);
    const categoryName = categories[Math.floor(Math.random() * categories.length)];
    const categoryItems = baseItems[categoryName];
    const baseItemIndex = Math.floor(Math.random() * categoryItems.length);
    const finalItem = JSON.parse(JSON.stringify(categoryItems[baseItemIndex]));
    finalItem.category = categoryName; // conserve la catégorie (utile pour l'UI/logique future)

    // 2. Jet de dés pour les modificateurs (Qualité et/ou Effet)
    // On force un peu plus le loot à avoir au moins un adjectif pour le côté RPG
    const roll = Math.random() * 100;
    let modifierCount = 0;
    
    if (roll <= 20) {
        modifierCount = 2; // 20% de chance d'objet épique
    } else if (roll <= 70) {
        modifierCount = 1; // 50% de chance d'objet normal/modifié
    }

    let appliedModifiers = [];
    let availableTags = [...finalItem.allowedTags];

    for (let i = 0; i < modifierCount; i++) {
        if (availableTags.length === 0) break;

        const tagIndex = Math.floor(Math.random() * availableTags.length);
        const selectedCategory = availableTags.splice(tagIndex, 1)[0]; 

        const modifiersList = itemModifiers[selectedCategory];
        if (modifiersList && modifiersList.length > 0) {
            const modIndex = Math.floor(Math.random() * modifiersList.length);
            const modifier = modifiersList[modIndex];
            
            appliedModifiers.push(modifier.name);
            
            // On transmet la mécanique spéciale de l'objet (bleed/stun/...), en plus des stats
            if (modifier.mechanic) finalItem.mechanic = modifier.mechanic;
            
            if (modifier.stats) {
                for (let stat in modifier.stats) {
                    if (finalItem[stat] !== undefined) {
                        finalItem[stat] += modifier.stats[stat];
                    }
                }
            }
        }
    }

    // 3. Assemblage du nom
    // Si c'est un effet de qualité (ex: Rouillé), on le met souvent avant ou juste après selon la grammaire, 
    // mais pour simplifier on concatène. Ex: "Épée Longue Rouillée et Vibrante"
    if (appliedModifiers.length === 1) {
        finalItem.name = `${finalItem.name} ${appliedModifiers[0]}`;
    } else if (appliedModifiers.length === 2) {
        finalItem.name = `${finalItem.name} ${appliedModifiers[0]} et ${appliedModifiers[1]}`;
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


