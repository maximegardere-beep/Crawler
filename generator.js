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
function generateMob(districtName, eliteBonus = 0) {
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

    return finalMob;
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

    // MOB_ENRAGE (anomalies.js) : même multiplicateur d'ATQ que les mobs normaux de l'étage, au même
    // titre que le scaling par étage ci-dessus — n'est PAS un "modificateur aléatoire" (stats fixes du
    // boss inchangées sinon), donc ne contredit pas le commentaire ci-dessous.
    if (typeof gameState !== 'undefined' && gameState.anomalyEffects && gameState.anomalyEffects.mobAtkMult !== 1) {
        boss.atk = Math.max(1, Math.round(boss.atk * gameState.anomalyEffects.mobAtkMult));
    }

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
    // Bas de fourchette (powerScore proche de 0, ex. loot early-game) légèrement redistribué : moins
    // de Commun, plus de Rare/Épique/Légendaire — sans toucher la fréquence du loot lui-même, voir
    // issue d'équilibrage "items blagues".
    return {
        commun: lerp(60, 15),
        rare: lerp(30, 35),
        epique: lerp(5.5, 35),
        legendaire: lerp(1.5, 15)
    };
}

// Tire un palier de rareté au hasard, pondéré par le score de puissance (voir getRarityWeights()).
// `minRarityKey` (optionnel, chantier "rework combat" — loot garanti de rareté minimale sur un boss,
// voir winCombat()) relève le tirage au palier minimal donné s'il est tombé plus bas, SANS changer la
// pondération du tirage lui-même (juste un plancher après coup).
function rollRarity(powerScore, minRarityKey = null) {
    const weights = getRarityWeights(powerScore);
    const entries = itemRarities.map(r => ({ rarity: r, weight: weights[r.key] || 0 }));
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;
    let picked = entries[entries.length - 1].rarity;
    for (const e of entries) {
        if (roll < e.weight) { picked = e.rarity; break; }
        roll -= e.weight;
    }
    if (minRarityKey) {
        const minIndex = itemRarities.findIndex(r => r.key === minRarityKey);
        const pickedIndex = itemRarities.findIndex(r => r.key === picked.key);
        if (minIndex >= 0 && pickedIndex < minIndex) return itemRarities[minIndex];
    }
    return picked;
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
function generateItem(powerScore = 0, forcedCategory = null, minRarityKey = null) {
    // 1. Choix d'une catégorie d'objet (weapons, ranged, armors, consumables, scrolls), puis d'un
    // objet de base dedans. "scrolls" (parchemins de sorts) n'a pas d'entrée dans baseItems : c'est
    // le grimoire (spellCatalog, voir spells.js) qui lui sert de pool, via generateSpellScroll() —
    // même chance de tirage que les 4 autres catégories, pour rester "looté par des mobs ou trouvé"
    // exactement comme le reste de l'équipement. `forcedCategory` (optionnel) impose la catégorie au
    // lieu de la tirer — utilisé par le stock d'un marchand spécialisé (voir generateShopStock()).
    const categories = [...Object.keys(baseItems), 'scrolls'];
    // SECHERESSE (anomalies.js) : double la chance de tirer un consommable (potion) — tirage pondéré
    // uniquement dans ce cas précis, sinon comportement inchangé (même appel Math.random() qu'avant
    // ce système pour le chemin sans anomalie, voir tests).
    const potionMult = (typeof gameState !== 'undefined' && gameState.anomalyEffects) ? (gameState.anomalyEffects.potionDropMult || 1) : 1;
    let categoryName = forcedCategory;
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
    if (categoryName === 'scrolls') {
        return generateSpellScroll(powerScore, minRarityKey);
    }
    // Les objets "blagues" (jokeItem: true, voir items.js) sont exclus du loot normal : réservés au
    // cadeau de bienvenue et au kit de test, jamais tirés en jouant.
    const nonJokeItems = baseItems[categoryName].filter(item => !item.jokeItem);
    const categoryItems = nonJokeItems.length > 0 ? nonJokeItems : baseItems[categoryName];
    const baseItemIndex = Math.floor(Math.random() * categoryItems.length);
    const finalItem = JSON.parse(JSON.stringify(categoryItems[baseItemIndex]));
    finalItem.category = categoryName; // conserve la catégorie (utile pour l'UI/logique future)

    // 2. Tirage du palier de rareté, puis mise à l'échelle des stats de base (avec un peu
    // d'aléatoire ±10% pour éviter que deux objets de même rareté soient rigoureusement identiques)
    const rarity = rollRarity(powerScore, minRarityKey);
    finalItem.rarity = rarity.name;
    finalItem.rarityColor = rarity.color;

    const statMult = rarity.statMult * (0.9 + Math.random() * 0.2);
    if (finalItem.baseDmg !== undefined) finalItem.baseDmg = Math.max(1, Math.round(finalItem.baseDmg * statMult));
    if (finalItem.baseArmor !== undefined) finalItem.baseArmor = Math.round(finalItem.baseArmor * statMult);
    if (finalItem.heal !== undefined && finalItem.heal > 0) finalItem.heal = Math.round(finalItem.heal * statMult);
    if (finalItem.mana !== undefined && finalItem.mana > 0) finalItem.mana = Math.round(finalItem.mana * statMult);

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

/**
 * Génère un parchemin de sort, pioché dans le grimoire (spellCatalog, voir spells.js) puis mis à
 * l'échelle par un palier de rareté (même système que generateItem() : itemRarities/rollRarity).
 * Contrairement à une arme, un sort n'a pas de slots d'enchantement — sa rareté fait uniquement
 * grimper baseDmg ET manaCost ensemble (un sort plus puissant coûte aussi plus cher en mana).
 * Le résultat rejoint gameState.spellbook (inventaire magique), pas gameState.inventory (voir
 * addLoot() dans app.js) : `category: 'scrolls'` sert justement à ce tri.
 *
 * @param {number} powerScore - Score de puissance entre 0 et 1 (voir getLootPowerScore()).
 * @returns {object} - Le parchemin final généré
 */
function generateSpellScroll(powerScore = 0, minRarityKey = null) {
    const base = spellCatalog[Math.floor(Math.random() * spellCatalog.length)];
    const scroll = JSON.parse(JSON.stringify(base));
    scroll.category = 'scrolls';
    scroll.spellCategory = base.category; // 'melee' | 'ranged' — voir attackMagic() dans app.js
    scroll.spellName = base.name;
    // Chantier "QoL/équilibrage" (Chantier D) : baseValue absent jusqu'ici — un parchemin ne pouvait
    // ni se vendre correctement (sellItem()) ni afficher un prix marchand cohérent (generateShopStock()
    // calculait déjà baseValue×SHOP_MARKUP, mais avec le repli `|| 1`, invisible faute de baseValue).
    // Échelle sur base.baseDmg (NON scalé par la rareté — même convention que baseValue sur les objets
    // classiques dans items.js, jamais affecté par statMult dans generateItem()), ratio ≈1.6 comparable
    // aux armes (baseValue/baseDmg ≈1.5-2 sur items.js).
    scroll.baseValue = Math.round(base.baseDmg * 1.6);

    const rarity = rollRarity(powerScore, minRarityKey);
    scroll.rarity = rarity.name;
    scroll.rarityColor = rarity.color;

    const statMult = rarity.statMult * (0.9 + Math.random() * 0.2);
    scroll.baseDmg = Math.max(1, Math.round(scroll.baseDmg * statMult));
    scroll.manaCost = Math.max(5, Math.round(scroll.manaCost * statMult));

    scroll.name = `Parchemin : ${base.name}`;
    return scroll;
}

/**
 * Génère l'objet du cadeau de bienvenue (écran de départ, voir revealWelcomeGift() dans app.js).
 * `type` ('weapon'/'ranged'/'spell', jamais 'nothing' — géré à part par l'appelant) est déjà tiré au
 * hasard pondéré par rollWelcomeGiftType() ; cette fonction ne fait que construire l'objet, toujours
 * au palier de rareté le plus faible (Commun, aucun enchantement) — "toujours faible qualité", quel
 * que soit le type tiré.
 *
 * @param {string} type - 'weapon' | 'ranged' | 'spell'
 * @returns {object|null}
 */
function generateWelcomeGiftItem(type) {
    const commun = itemRarities[0];
    if (type === 'weapon' || type === 'ranged') {
        const categoryName = type === 'weapon' ? 'weapons' : 'ranged';
        const pool = baseItems[categoryName];
        const finalItem = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
        finalItem.category = categoryName;
        finalItem.rarity = commun.name;
        finalItem.rarityColor = commun.color;
        return finalItem;
    }
    if (type === 'spell') {
        const base = spellCatalog[Math.floor(Math.random() * spellCatalog.length)];
        const scroll = JSON.parse(JSON.stringify(base));
        scroll.category = 'scrolls';
        scroll.spellCategory = base.category;
        scroll.spellName = base.name;
        scroll.rarity = commun.name;
        scroll.rarityColor = commun.color;
        scroll.baseValue = Math.round(base.baseDmg * 1.6); // Même échelle que generateSpellScroll()
        scroll.name = `Parchemin : ${base.name}`;
        return scroll;
    }
    return null;
}

/**
 * Génère une arme ou une arme à distance de test, toujours au palier Légendaire (tous les slots
 * d'enchantement) — bouton de test discret (voir giveTestKit() dans app.js), pour équiper le joueur
 * en un clic avec du matériel déjà pleinement enchanté et tester les mécaniques de combat sans
 * dépendre du loot aléatoire. Volontairement séparé de generateItem() (catégorie/rareté imposées
 * plutôt que tirées au hasard) pour ne rien changer à l'ordre des tirages du loot normal du jeu.
 *
 * @param {string} categoryName - 'weapons' | 'ranged'
 * @returns {object}
 */
function generateTestKitItem(categoryName) {
    const rarity = itemRarities[itemRarities.length - 1]; // Légendaire : le palier le plus fort
    const pool = baseItems[categoryName];
    const finalItem = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
    finalItem.category = categoryName;
    finalItem.rarity = rarity.name;
    finalItem.rarityColor = rarity.color;
    if (finalItem.baseDmg !== undefined) finalItem.baseDmg = Math.max(1, Math.round(finalItem.baseDmg * rarity.statMult));

    const appliedNames = [];
    const appliedMechanics = [];
    if (finalItem.canEnchant !== false) {
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
    if (appliedNames.length === 1) {
        finalItem.name = `${finalItem.name} ${appliedNames[0]}`;
    } else if (appliedNames.length === 2) {
        finalItem.name = `${finalItem.name} ${appliedNames[0]} et ${appliedNames[1]}`;
    } else if (appliedNames.length >= 3) {
        finalItem.name = `${finalItem.name} ${appliedNames.slice(0, -1).join(", ")} et ${appliedNames[appliedNames.length - 1]}`;
    }

    return finalItem;
}

/**
 * Génère un sort de test, toujours au palier Légendaire — même esprit que generateTestKitItem(),
 * variante de generateSpellScroll() à rareté imposée plutôt que tirée au hasard.
 * @returns {object}
 */
function generateTestKitSpell() {
    const rarity = itemRarities[itemRarities.length - 1];
    const base = spellCatalog[Math.floor(Math.random() * spellCatalog.length)];
    const scroll = JSON.parse(JSON.stringify(base));
    scroll.category = 'scrolls';
    scroll.spellCategory = base.category;
    scroll.spellName = base.name;
    scroll.rarity = rarity.name;
    scroll.rarityColor = rarity.color;
    scroll.baseValue = Math.round(base.baseDmg * 1.6); // Même échelle que generateSpellScroll(), jamais scalé par la rareté
    scroll.baseDmg = Math.max(1, Math.round(scroll.baseDmg * rarity.statMult));
    scroll.manaCost = Math.max(5, Math.round(scroll.manaCost * rarity.statMult));
    scroll.name = `Parchemin : ${base.name}`;
    return scroll;
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
        // Probabilité (0-100) qu'il abandonne l'équipe : grimpe avec son expérience, vérifiée à
        // chaque montée de niveau (voir gainCompanionXp()/attemptCompanionAbandon() dans app.js).
        leaveChance: 0
    };
}


