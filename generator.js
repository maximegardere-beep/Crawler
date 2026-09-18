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
    // 1. Récupération du quartier et d'un mob de base
    const district = districts[districtName];
    if (!district || !district.baseMobs || district.baseMobs.length === 0) {
        console.error(`Erreur: Quartier "${districtName}" introuvable ou vide.`);
        return null;
    }

    const baseMobIndex = Math.floor(Math.random() * district.baseMobs.length);
    // On fait une copie profonde pour ne pas altérer la base de données
    const finalMob = JSON.parse(JSON.stringify(district.baseMobs[baseMobIndex]));
    
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
            
            // On peut ajouter des effets spéciaux ici en plus des stats
            if (modifier.effect) finalItem.specialEffect = modifier.effect;
            
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
// 3. INTÉGRATION AVEC LA BOUCLE PRINCIPALE (app.js)
// ==========================================

/* 
 * COMMENT INTÉGRER CE CODE DANS app.js :
 * 
 * 1. Lier ce fichier dans index.html :
 *    Assurez-vous de mettre les scripts dans le bon ordre à la fin du <body> :
 *    <script src="bestiary.js"></script>
 *    <script src="generators.js"></script>
 *    <script src="app.js"></script>
 * 
 * 2. Dans app.js, modifier la fonction initiateCombat() :
 *    function initiateCombat() {
 *        // On génère le mob en fonction du quartier actuel
 *        const enemy = generateMob(gameState.currentDistrict);
 *        
 *        // On stocke l'ennemi dans l'état du jeu pour s'en servir dans les boutons de combat
 *        gameState.currentEnemy = enemy; 
 *        gameState.inCombat = true;
 *        
 *        // On affiche le nom généré dans le log !
 *        addLog(`COMBAT INITIÉ ! Un [${enemy.name}] (PV: ${enemy.hp}) vous attaque.`, "text-red-500");
 *        
 *        if(DOM.btnAdvance) DOM.btnAdvance.disabled = true;
 *        if(DOM.btnVictory) DOM.btnVictory.classList.remove('hidden');
 *        if(DOM.btnDefeat) DOM.btnDefeat.classList.remove('hidden');
 *    }
 * 
 * 3. Dans app.js, modifier la fonction findItem() :
 *    function findItem() {
 *        // On remplace le nom fixe par un objet généré
 *        const newItem = generateItem();
 *        
 *        // On l'ajoute à l'inventaire
 *        gameState.inventory.push(newItem); 
 *        
 *        // On affiche son nom généré
 *        addLog(`Vous avez trouvé un objet : [${newItem.name}] !`, "text-yellow-300");
 *        updateUI(); 
 *        // Pensez à modifier updateUI() pour afficher item.name si votre inventaire stocke désormais des objets et plus de simples strings.
 *    }
 */
