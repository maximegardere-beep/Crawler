/**
 * generators.js - Moteur de génération procédurale pour Crawler
 * Nécessite que le fichier bestiary.js soit chargé avant celui-ci.
 */

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


