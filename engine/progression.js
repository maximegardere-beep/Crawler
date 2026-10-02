// engine/progression.js — Nécrologie, niveau et expérience.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// NÉCROLOGIE (épitaphes sarcastiques)
// ==========================================
// gameState.necrologie ne garde que les NECROLOGIE_MAX_ENTRIES dernières entrées (plus récente en
// premier) — voir recordEpitaph().
const NECROLOGIE_MAX_ENTRIES = 20;
// Écart (niveau joueur - "niveau" du mob, voir getMobLevelEquivalent()) à partir duquel un mob tueur
// est jugé "très inférieur" et déclenche l'épitaphe dédiée EPITAPH_TEMPLATES.mobFaible.
const NECROLOGIE_WEAK_MOB_DELTA = 5;
// Nombre de fuites réussies ce run à partir duquel la mention spéciale est ajoutée (voir
// gameState.fleesThisRun, incrémenté par attemptFlee()).
const NECROLOGIE_FLEE_THRESHOLD = 3;

// Libellés humains de la cause de mort, utilisés pour le placeholder {{cause}} des templates.
const DEATH_CAUSE_LABELS = {
    combat: "au combat",
    backfire: "par un sort qui a mal tourné",
    trap: "dans un piège",
    bleed: "d'une hémorragie",
    timeout: "faute de temps"
};

// Pool de templates par cause de mort, tirage aléatoire (voir pick()). {{mob}}/{{etage}}/
// {{deltaNiveau}}/{{cause}} remplacés par generateEpitaph() ; mobFaible et backfire sont des pools
// DÉDIÉS qui remplacent le pool "combat" par défaut quand leur règle spéciale s'applique (voir
// generateEpitaph()), jamais combinés entre eux.
const EPITAPH_TEMPLATES = {
    combat: [
        "Ici repose {{crawler}}, terrassé(e) par [{{mob}}] à l'étage {{etage}}. Le Donjon salue un adversaire digne de ce nom.",
        "[{{mob}}] a eu le dernier mot, à l'étage {{etage}}. Les paris étaient pourtant favorables.",
        "Vaincu(e) par [{{mob}}] à l'étage {{etage}}. Une fin honorable, si on ignore les précédentes tentatives.",
        "Fin de partie : [{{mob}}] a gagné, à l'étage {{etage}}. Applaudissements timides du public.",
        "[{{mob}}] : 1. Crawler : 0. Étage {{etage}}. Le classement ne ment jamais.",
        "L'étage {{etage}} garde son secret : comment [{{mob}}] a-t-il fait, exactement ?"
    ],
    trap: [
        "Mort(e) bêtement dans un piège, à l'étage {{etage}}. Le Donjon n'a même pas eu besoin d'un monstre.",
        "Un mécanisme centenaire a eu raison du crawler à l'étage {{etage}}. L'ironie n'échappe à personne.",
        "L'étage {{etage}} avait posé un piège. Le crawler avait posé un pied dedans.",
        "Piège fatal à l'étage {{etage}}. Le Donjon note : « toujours aussi efficace »."
    ],
    bleed: [
        "Vidé(e) de son sang à l'étage {{etage}}, lentement, sûrement, sans un mot.",
        "L'hémorragie a eu le dernier mot à l'étage {{etage}}. Un bandage aurait peut-être aidé.",
        "Mort(e) de ses blessures à l'étage {{etage}}. Le sang, lui, ne ment jamais sur l'issue."
    ],
    timeout: [
        "Le temps s'est écoulé à l'étage {{etage}}, et le Donjon n'attend personne.",
        "Plus de temps, plus de chance : le Donjon s'est refermé sur l'étage {{etage}}.",
        "Le chronomètre a gagné à l'étage {{etage}}. Il gagne toujours, en fin de compte."
    ],
    // Pool dédié (chantier 3) : tué par un chasseur de primes — remplace le pool 'combat'.
    chasseurPrime: [
        "Livré(e) mort(e) par [{{mob}}] à l'étage {{etage}}. La prime a été versée le jour même.",
        "[{{mob}}] a encaissé la récompense. Le crawler, lui, a encaissé le reste. Étage {{etage}}.",
        "Recherché(e) mort(e) ou vif(ve). [{{mob}}] a choisi, à l'étage {{etage}}.",
        "Victime de son propre succès : trop fort(e), trop vite, trop recherché(e). Étage {{etage}}."
    ],
    mobFaible: [
        "Terrassé(e) par [{{mob}}], un adversaire {{deltaNiveau}} niveaux en dessous, à l'étage {{etage}}. Le Donjon en rit encore.",
        "[{{mob}}], largement plus faible, a quand même eu raison du crawler à l'étage {{etage}}. Statistiquement improbable. Historiquement vrai.",
        "Vaincu(e) par plus faible que soi ([{{mob}}], étage {{etage}}). Une leçon d'humilité, post-mortem.",
        "[{{mob}}] n'aurait jamais dû gagner. Il a gagné quand même, à l'étage {{etage}}."
    ],
    backfire: [
        "Un sort mal maîtrisé, une explosion, un silence : fin de partie à l'étage {{etage}}.",
        "Le sort est parti de travers, et le crawler avec, à l'étage {{etage}}. La magie est une maîtresse cruelle.",
        "Tué(e) par son propre sortilège à l'étage {{etage}}. Le grimoire n'assume aucune responsabilité.",
        "Backfire fatal à l'étage {{etage}} : la magie a repris ce qu'elle avait prêté."
    ]
};

// Mention ajoutée en fin d'épitaphe si gameState.fleesThisRun >= NECROLOGIE_FLEE_THRESHOLD.
const EPITAPH_FLEE_MENTIONS = [
    "Après {{fuites}} fuites ce run, la chance a fini par lui tourner le dos.",
    "{{fuites}} fuites au compteur. Celle-ci, la dernière, n'a pas eu lieu.",
    "Après avoir fui {{fuites}} fois, le Donjon a fini par le rattraper."
];

// Mention ajoutée en fin d'épitaphe si un objet équipé porte jokeItem: true (voir items.js).
const EPITAPH_RIDICULOUS_ITEM_MENTIONS = [
    "Il est mort en brandissant fièrement : {{objetRidicule}}.",
    "Équipé jusqu'au bout de {{objetRidicule}}. Un choix qui restera dans les annales.",
    "{{objetRidicule}} l'a accompagné jusqu'à la fin. On ne peut pas dire qu'il ait été bien conseillé."
];

// "Niveau" équivalent d'un mob : aucun champ de niveau explicite n'existe sur les mobs (voir
// generateMob()/generator.js, qui les met à l'échelle par ÉTAGE, pas par niveau) — l'étage courant
// est le proxy le plus direct et cohérent avec le reste du moteur de scaling.
function getMobLevelEquivalent() {
    return Math.max(1, gameState.currentFloor);
}

// Objet équipé le plus "ridicule" au moment de la mort (voir jokeItem dans items.js) : les parchemins
// ne portent jamais ce flag, seuls weapon/ranged/armor sont scrutés.
function findRidiculousEquippedItem() {
    const slots = [gameState.equipment.weapon, gameState.equipment.ranged, gameState.equipment.armor];
    return slots.find(item => item && item.jokeItem) || null;
}

// Construit l'épitaphe sarcastique pour le décès en cours, à partir du contexte réel (cause, mob
// tueur éventuel). Fonction pure hors lecture de gameState/Math.random — appelée uniquement par
// gameOver().
// Mention propre à la race du crawler (chantier 13), ajoutée à toute épitaphe : une phrase, jamais tirée au hasard.
const EPITAPH_RACE_MENTIONS = {
    human: "Humain·e jusqu'au bout : moyen·ne, mais motivé·e.",
    ghoul: "La Goule n'aura, pour une fois, eu aucune raison de se plaindre de sa mine.",
    goblin: "Le Gobelin laisse derrière lui trois égouts, deux mégots et une caméra qu'il jure ne pas avoir volée.",
    troll: "Le Troll de bureau n'aura jamais rempli sa dernière note de frais.",
    elf: "L'Elfe de salon repose enfin : le peignoir est plié, les oreilles ne le sont pas.",
    dwarf: "Le Nain de chantier est tombé casque sur la tête, ce qui, au moins, était réglementaire.",
    roach: "On dit que le Cafard survit à tout. On dit beaucoup de choses."
};

function generateEpitaph(deathContext) {
    const { cause, enemyName, bountyHunter } = deathContext;
    const floor = gameState.currentFloor;
    const fleesThisRun = gameState.fleesThisRun || 0;
    const ridiculousItem = findRidiculousEquippedItem();

    let pool = EPITAPH_TEMPLATES[cause] || EPITAPH_TEMPLATES.combat;
    let deltaNiveau = null;
    if (cause === 'combat' || cause === 'backfire') {
        const mobLevel = getMobLevelEquivalent();
        deltaNiveau = gameState.level - mobLevel;
        if (cause === 'combat' && bountyHunter) {
            pool = EPITAPH_TEMPLATES.chasseurPrime; // Règle spéciale : abattu par un chasseur de primes
        } else if (cause === 'combat' && deltaNiveau >= NECROLOGIE_WEAK_MOB_DELTA) {
            pool = EPITAPH_TEMPLATES.mobFaible; // Règle spéciale : mob très inférieur -> épitaphe dédiée
        } else if (cause === 'backfire') {
            pool = EPITAPH_TEMPLATES.backfire; // Règle spéciale : mort par backfire -> épitaphe dédiée
        }
    }

    let text = pick(pool)
        .replace(/\{\{mob\}\}/g, enemyName || "un adversaire anonyme")
        .replace(/\{\{etage\}\}/g, floor)
        .replace(/\{\{deltaNiveau\}\}/g, deltaNiveau !== null ? Math.abs(deltaNiveau) : "")
        .replace(/\{\{cause\}\}/g, DEATH_CAUSE_LABELS[cause] || "on ne sait comment")
        .replace(/\{\{crawler\}\}/g, gameState.playerName || "le crawler");

    if (fleesThisRun >= NECROLOGIE_FLEE_THRESHOLD) {
        text += " " + pick(EPITAPH_FLEE_MENTIONS).replace(/\{\{fuites\}\}/g, fleesThisRun);
    }
    const raceMention = gameState.race && EPITAPH_RACE_MENTIONS[gameState.race];
    if (raceMention) text += " " + raceMention;
    if (ridiculousItem) {
        text += " " + pick(EPITAPH_RIDICULOUS_ITEM_MENTIONS).replace(/\{\{objetRidicule\}\}/g, ridiculousItem.name);
    }
    return text;
}

// Enregistre l'épitaphe dans le journal persistant (gameState.necrologie), plus récente en premier,
// plafonné à NECROLOGIE_MAX_ENTRIES. Aucun écran de lecture dédié pour l'instant : préparé pour un
// futur journal consultable, persistant en save via le mécanisme d'autosauvegarde existant.
function recordEpitaph(text, deathContext) {
    if (!Array.isArray(gameState.necrologie)) gameState.necrologie = [];
    gameState.necrologie.unshift({
        text,
        floor: gameState.currentFloor,
        cause: deathContext.cause,
        date: Date.now()
    });
    if (gameState.necrologie.length > NECROLOGIE_MAX_ENTRIES) {
        gameState.necrologie.length = NECROLOGIE_MAX_ENTRIES;
    }
}

// Ajoute un objet généré à l'inventaire. Les consommables ne sont jamais limités (slots dédiés
// infinis) ; seuls les objets d'équipement (armes/armures/armes à distance) comptent dans la
// capacité limitée (gameState.maxInventory). Un parchemin de sort (catégorie 'scrolls') rejoint
// gameState.spellbook (inventaire magique dédié) plutôt que gameState.inventory : lui non plus
// n'est jamais limité, au même titre que les consommables (voir equipSpell()).
// `options` est transmis tel quel à generateItem() (generator.js) : `source` ('explore' | 'mob' |
// 'elite' | 'boss' | 'treasure') pilote la rareté, `itemLevel` le niveau d'objet (défaut : étage).
function addLoot(options = {}) {
    // Chanceux (qualificatif porté) : chance que le butin monte d'un palier (voir rollLootRarity()).
    const luckChance = sumEquippedQualifier('lucky', 'chance');
    storeLootItem(generateItem(luckChance > 0 ? { ...options, luckChance } : options));
}

// Range un objet déjà construit (loot ou objet signature) : grimoire, inventaire, ou perdu si la
// réserve d'équipement est pleine. `prefix` : décoration du message de log (objet signature).
function storeLootItem(item, prefix = "") {
    // Pastille « nouveau » sur la barre d'icônes (chantier 9) jusqu'à l'ouverture du Sac / du Grimoire.
    if (item.category !== 'consumables') item.isNew = true;
    if (item.category === 'scrolls') {
        gameState.spellbook.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`${prefix}Sort appris : [${formatItemDisplayName(item)}] !`, "loot");
        updateSpellbookUI();
        recordRunEvent('spellLearned', { item });
        return true;
    }
    const isConsumable = item.category === 'consumables';
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    if (isConsumable || equipmentCount < gameState.maxInventory) {
        gameState.inventory.push(item);
        gameState.floorStats.itemsFound += 1;
        logEvent(`${prefix}Objet obtenu : [${formatItemDisplayName(item)}] !`, "loot");
        updateInventoryUI();
        recordRunEvent('itemStored', { item });
        return true;
    }
    // Réserve pleine : revendu d'office à LOOT_OVERFLOW_SELL_RATIO du prix de revente marchand plutôt que
    // perdu (demandé par l'utilisateur) — le seul point de passage de tout butin (exploration, combat, boss,
    // objet signature, boîte de succès), donc la règle s'applique partout sans rien dupliquer.
    const price = getOverflowSellPrice(item);
    gameState.gold += price;
    logEvent(`${prefix}Réserve pleine : [${formatItemDisplayName(item)}] est revendu d'office pour ${price} PO (moitié du prix marchand).`, "info");
    recordRunEvent('overflowSold', { item, price });
    return false;
}

// Part du prix de revente marchand (getSellPrice()) obtenue pour un butin revendu d'office, réserve pleine.
const LOOT_OVERFLOW_SELL_RATIO = 0.5;

function getOverflowSellPrice(item) {
    return Math.max(1, Math.round(getSellPrice(item) * LOOT_OVERFLOW_SELL_RATIO));
}

// Objet signature d'un boss précis (bestiary.js, districtBosses.*.signatureItem) : depuis le chantier 6 (V3), il n'est plus garanti
// à la première victoire — il tombe à 100 % si le Coup de grâce a été PARFAIT, jamais sinon (jet automatique, mini-jeux désactivés,
// Coup de grâce raté ou seulement réussi, boss achevé autrement : pas d'objet signature). Avec 3 Parfaits ou plus dans le combat
// (Coup de grâce compris), l'arme gagne un qualificatif de plus (signatureReward()). Sa rareté suit l'étage courant (Rare, Épique,
// Légendaire dès l'étage 10 — getSignatureRarity()), au niveau d'objet du butin du boss (voir buildSignatureItem() dans generator.js).
function awardBossSignatureItem(boss, itemLevel = gameState.currentFloor, outcome = {}) {
    if (!boss || !boss.signatureItem) return;
    const reward = signatureReward(!!outcome.perfectFinisher, outcome.perfects || 0);
    if (!reward.awarded) {
        logEvent(`🗡️ Sans Coup de grâce parfait, l'objet signature de ${boss.name} vous échappe.`, "info");
        return;
    }
    const key = boss.baseName || boss.name;
    if (!gameState.signaturesAwarded.includes(key)) gameState.signaturesAwarded.push(key);
    storeLootItem(buildSignatureItem(boss.signatureItem, itemLevel, getSignatureRarity(gameState.currentFloor).key, { extraQualifier: reward.extraQualifier }), "✨ Objet signature — ");
}

// Point de passage UNIQUE pour toute perte de PV du joueur (piège, saignement, riposte ennemie...) —
// clampe à 0 et alimente le tally de l'étage en cours (gameState.floorStats.damageTaken, voir écran
// d'escalier). Remplace les mutations directes de gameState.hp dispersées dans le code de combat/
// exploration, pour ne jamais avoir à retrouver tous ces points d'appel séparément (ex : un futur
// hook d'anomalie qui multiplierait les dégâts subis n'aurait qu'ICI à s'accrocher).
// Renvoie les PV réellement perdus (après Armure de scénario et Increvable) : les journaux de combat doivent afficher ce montant-là, pas le coup d'origine.
function applyPlayerDamage(amount) {
    if (!amount || amount <= 0) return 0;
    amount = applyPlotArmor(amount); // Armure de scénario (chantier 15, lot 4) : d'abord, pour que l'Increvable du Cafard reste disponible pour la suite
    amount = applyRaceLastStand(amount); // Cafard mutant : Increvable (chantier 13)
    if (!(amount > 0)) return 0;
    gameState.hp = Math.max(0, gameState.hp - amount);
    gameState.floorStats.damageTaken += amount;
    recordRunEvent('damageTaken', { amount }); // Chronique de run (chantier 2)
    return amount;
}

// Point de passage UNIQUE pour tout gain de PV du joueur (potion, trouvaille, régénération passive,
// mécanique d'arme/armure, compagnon Médecin...) — clampe à gameState.maxHp et applique
// gameState.anomalyEffects.healingMult (voir PEAU_DE_VERRE dans anomalies.js). Renvoie le soin
// RÉELLEMENT appliqué (après multiplicateur et clamp), pour que les messages de log restent honnêtes
// même quand l'anomalie change le montant affiché.
function applyPlayerHeal(amount) {
    if (!amount || amount <= 0) return 0;
    const mult = (gameState.anomalyEffects.healingMult || 1) * (originRaceEffects().healMult || 1); // PEAU_DE_VERRE, Goule (chantier 13)
    const before = gameState.hp;
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + amount * mult);
    return Math.round(gameState.hp - before);
}

// Recalcule gameState.maxHp à partir de la vraie progression (gameState.baseMaxHp, faite avancer
// uniquement par gainXp()) × le multiplicateur de l'anomalie active (PEAU_DE_VERRE) — jamais l'inverse.
// Appelé après tout changement de l'un des deux (montée de niveau, changement d'étage). Clampe
// gameState.hp au nouveau maximum s'il le dépasse (jamais de PV "en trop" affichés).
function recomputeMaxHp() {
    const mult = gameState.anomalyEffects.playerMaxHpMult || 1;
    // Robuste (qualificatif d'armure) : PV max +%, tant que l'armure est portée.
    const sturdy = getItemQualifierValues(gameState.equipment.armor, 'sturdy', 'armor');
    const gearMult = sturdy ? 1 + sturdy.pct / 100 : 1;
    const raceMult = (originRaceEffects().maxHpMult || 1) * (originClassEffects().maxHpMult || 1); // Goule, Gobelin, Troll, Cafard ; Sac de frappe (chantier 13)
    gameState.maxHp = Math.max(1, Math.round(gameState.baseMaxHp * mult * gearMult * raceMult));
    if (gameState.hp > gameState.maxHp) gameState.hp = gameState.maxHp;
}

// ==========================================
// SYSTÈME DE NIVEAU ET D'EXPÉRIENCE
// ==========================================
function gainXp(amount) {
    if (!amount || amount <= 0) return;
    amount = Math.round(amount * (gameState.anomalyEffects.xpMult || 1) * (originRaceEffects().xpMult || 1)); // MOB_ENRAGE (anomalies.js), Humain (chantier 13)
    gameState.xp += amount;
    gameState.floorStats.xpGained += amount;
    logEvent(`+${amount} XP`, "success");

    // On utilise une boucle "while" pour gérer le cas (rare) d'un gain d'XP
    // suffisant pour franchir plusieurs niveaux d'un coup.
    while (gameState.xp >= gameState.xpToNextLevel) {
        gameState.xp -= gameState.xpToNextLevel;
        gameState.level += 1;
        gameState.xpToNextLevel = Math.round(gameState.xpToNextLevel * 1.25); // Chaque niveau demande un peu plus d'XP

        // Gains de statistiques à la montée de niveau (croissants avec le niveau atteint, pour que
        // le joueur ne décroche pas en fin de run une fois les niveaux plus rares — voir issue
        // d'équilibrage "Mur XP étages 6-9" : le scaling des mobs, lui, continue de grimper à taux
        // fixe par étage).
        const hpGain = 15;
        const atkGain = 2 + Math.floor(gameState.level / 4);
        const defGain = 1 + Math.floor(gameState.level / 5);
        gameState.baseMaxHp += hpGain;
        recomputeMaxHp(); // Applique aussi l'éventuel multiplicateur d'anomalie (PEAU_DE_VERRE) courant
        gameState.hp = gameState.maxHp; // Montée de niveau = soin complet (récompense marquante)
        gameState.atk += atkGain;
        gameState.def += defGain;

        logEvent(`⭐ NIVEAU SUPÉRIEUR ! Vous êtes maintenant niveau ${gameState.level}. (+${hpGain} PV max, +${atkGain} ATQ, +${defGain} DEF — PV entièrement restaurés)`, "success");
        triggerHaptic('heavy');
    }

    updateUI();
}

// Gain d'XP dédiée à une compétence (arme / mains nues / magie), uniquement via l'usage en combat.
// Chaque compétence progresse indépendamment des autres et du niveau général du joueur.
function gainSkillXp(skillKey, amount) {
    const skill = gameState.skills[skillKey];
    if (!skill || !amount) return;
    amount += gameState.anomalyEffects.skillXpPerActionBonus || 0; // TEMPO_CREE (anomalies.js)

    skill.xp += amount;
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.3);
        logEvent(`📈 Compétence "${skillLabel(skillKey)}" améliorée ! Niveau ${skill.level}.`, "success");
    }
    // Pas de updateUI() ici : on est toujours appelé en plein combat, juste après un coup porté.
    // Un rafraîchissement immédiat écraserait l'affichage des PV avant que l'animation du dé n'ait
    // eu le temps d'arriver à destination. Le prochain updateUI() naturel (riposte différée ou fin
    // de combat, au plus tard ~400ms plus tard) suffit à tout remettre à jour.
}

function skillLabel(key) {
    return { weapon: "Arme", unarmed: "Mains nues", magic: "Magie", stealth: "Furtivité" }[key] || key;
}
