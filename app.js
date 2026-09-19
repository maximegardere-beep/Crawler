// app.js - Moteur principal du Rogue-like textuel (Crawler)
// Conçu pour s'interfacer avec index.html

// ==========================================
// 1. ÉTAT DU JEU (State)
// ==========================================
const gameState = {
    playerName: "CRAWLER_01",
    hp: 100,
    maxHp: 100,
    atk: 10, // Dégâts de base infligés par round de combat
    def: 5,  // Réduction des dégâts subis par round de combat
    level: 1,
    xp: 0,
    xpToNextLevel: 50,
    // Compétences par type d'attaque : progressent uniquement à l'usage en combat (XP dédiée)
    skills: {
        weapon: { level: 1, xp: 0, xpToNext: 30 },
        unarmed: { level: 1, xp: 0, xpToNext: 30 },
        magic: { level: 1, xp: 0, xpToNext: 30 }
    },
    timeLeft: 100,
    maxTime: 100, // Temps alloué pour un niveau
    currentFloor: 1,
    // Le quartier de départ est tiré parmi ceux réellement définis dans bestiary.js,
    // pour garantir que generateMob() trouvera toujours une correspondance.
    currentDistrict: (() => {
        const names = Object.keys(districts);
        return names[Math.floor(Math.random() * names.length)];
    })(),
    inventory: [],
    maxInventory: 5,
    equipment: {
        weapon: null, // Objet de catégorie 'weapons' équipé, ou null
        armor: null   // Objet de catégorie 'armors' équipé, ou null
    },
    status: {
        bleed: null,    // { rounds, dmgPerRound } ou null
        stunned: false, // Rate son prochain tour si vrai
        slowed: null    // { rounds } : dégâts infligés par le joueur divisés par 2 pendant ces rounds
    },
    cardsDrawnThisFloor: 0, // Compteur de cartes pour calculer la probabilité de l'escalier
    inCombat: false, // Verrouille l'avancée si un combat est en cours
    currentEnemy: null, // Ennemi généré procéduralement, actif pendant un combat
    pendingStairAfterCombat: false // Si vrai, gagner le combat en cours ouvre l'étage suivant
};

// ==========================================
// CONFIGURATION ET BASES DE DONNÉES
// ==========================================
const config = {
    // Probabilités des événements (D100). Somme = 100, chaque catégorie a maintenant un effet réel
    // (fini le "reste" générique qui ne faisait jamais rien).
    chances: {
        nothing: 20,        // Rien de notable
        combat: 25,         // Rencontre hostile
        districtChange: 12, // Changement de quartier
        safeRoom: 8,        // Salle sécurisée (soin conséquent)
        loot: 1,            // Objet généré procéduralement (rare)
        trap: 10,           // NOUVEAU : piège avec de vrais dégâts
        timeLoss: 8,        // NOUVEAU : détour qui coûte du temps
        minorFind: 6,       // NOUVEAU : petite trouvaille (soin mineur)
        audienceGift: 4,    // NOUVEAU : cadeau des spectateurs (petit bonus d'XP), clin d'œil à l'émission
        flavorOnly: 6       // Pur moment narratif, sans effet mécanique
    },
    stairGuardedChance: 35 // 35% (au lieu de 20%) : trouver l'escalier est un vrai enjeu, pas un détail
};

// Bibliothèque de textes pour varier la narration selon la catégorie d'événement tirée
const flavorText = {
    nothing: [
        "Le couloir est vide. Le silence est oppressant.",
        "Vous n'entendez que l'écho de vos propres pas.",
        "Rien ne bouge. Même les néons semblent retenir leur souffle.",
        "Un calme suspect règne ici. Vous avancez sans encombre."
    ],
    trap: [
        { text: "Une lame dissimulée jaillit du mur et vous entaille.", dmgMin: 5, dmgMax: 15 },
        { text: "Le sol se dérobe sous vos pieds ; vous chutez lourdement.", dmgMin: 8, dmgMax: 18 },
        { text: "Un gaz corrosif s'échappe d'une conduite fissurée.", dmgMin: 5, dmgMax: 12 },
        { text: "Une décharge électrique traverse une rambarde métallique que vous touchez.", dmgMin: 6, dmgMax: 16 }
    ],
    timeLoss: [
        "Vous vous perdez dans un dédale de couloirs identiques.",
        "Une fausse porte vous fait rebrousser chemin.",
        "Vous devez attendre qu'un mécanisme de sécurité se réarme.",
        "Un détour s'impose pour éviter une zone visiblement instable."
    ],
    minorFind: [
        "Vous trouvez les restes encore mangeables d'un ancien crawler.",
        "Une trousse de premiers secours abandonnée traîne dans un coin.",
        "Une fontaine à eau, miraculeusement encore en état de marche.",
        "Un distributeur de vitamines périmées, mais ça se mange."
    ],
    audienceGift: [
        "Les spectateurs, amusés, vous envoient une prime en direct !",
        "Un sponsor anonyme salue votre performance télégénique.",
        "L'audience s'enflamme pour votre progression et vous récompense.",
        "Le producteur de l'émission juge votre parcours \"excellent pour l'audimat\"."
    ],
    flavorOnly: [
        "Une pub holographique pour des nouilles instantanées s'affiche puis disparaît.",
        "Vous croisez un panneau publicitaire vantant les mérites du Donjon.",
        "Une voix off anonyme commente votre progression, indifférente.",
        "Un vieux poster décoloré affiche le règlement de l'émission, illisible."
    ]
};

// Choisit un élément au hasard dans un tableau
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Note : les quartiers viennent de `districts` (districts.js), le catalogue d'objets de `baseItems` (items.js).

// ==========================================
// SÉLECTION DES ÉLÉMENTS DU DOM
// ==========================================
const ui = {
    playerName: document.getElementById('player-name'),
    floorLevel: document.getElementById('floor-level'),
    districtName: document.getElementById('district-name'),
    currentHp: document.getElementById('current-hp'),
    maxHp: document.getElementById('max-hp'),
    playerAtk: document.getElementById('player-atk'),
    playerDef: document.getElementById('player-def'),
    activeCard: document.getElementById('active-card'),
    cardTypeLabel: document.getElementById('card-type-label'),
    cardFloorLabel: document.getElementById('card-floor-label'),
    cardIcon: document.getElementById('card-icon'),
    cardTitle: document.getElementById('card-title'),
    cardBody: document.getElementById('card-body'),
    fullLog: document.getElementById('full-log'),
    playerLevel: document.getElementById('player-level'),
    xpBar: document.getElementById('xp-bar'),
    xpText: document.getElementById('xp-text'),
    skillWeaponLevel: document.getElementById('skill-weapon-level'),
    skillWeaponBar: document.getElementById('skill-weapon-bar'),
    skillUnarmedLevel: document.getElementById('skill-unarmed-level'),
    skillUnarmedBar: document.getElementById('skill-unarmed-bar'),
    skillMagicLevel: document.getElementById('skill-magic-level'),
    skillMagicBar: document.getElementById('skill-magic-bar'),
    timeText: document.getElementById('time-text'),
    timeBar: document.getElementById('time-bar'),
    inventoryCount: document.getElementById('inventory-count'),
    inventoryContainer: document.getElementById('inventory'),
    equippedWeapon: document.getElementById('equipped-weapon'),
    equippedArmor: document.getElementById('equipped-armor'),
    playerStatusIcons: document.getElementById('player-status-icons'),
    combatSideEnemy: document.getElementById('combat-side-enemy'),
    combatSidePlayer: document.getElementById('combat-side-player'),
    combatEnemyHp: document.getElementById('combat-enemy-hp'),
    combatEnemyStatus: document.getElementById('combat-enemy-status'),
    combatEnemyDie: document.getElementById('combat-enemy-die'),
    combatPlayerHp: document.getElementById('combat-player-hp'),
    combatPlayerStatus: document.getElementById('combat-player-status'),
    combatPlayerDie: document.getElementById('combat-player-die'),
    cardStackWrapper: document.getElementById('card-stack-wrapper'),
    btnAdvance: document.getElementById('btn-advance'),
    combatZone: document.getElementById('combat-zone'),
    enemyName: document.getElementById('enemy-name'),
    btnAttackWeapon: document.getElementById('btn-attack-weapon'),
    btnAttackUnarmed: document.getElementById('btn-attack-unarmed'),
    btnAttackMagic: document.getElementById('btn-attack-magic'),
    btnFlee: document.getElementById('btn-flee'),
    btnDevLogs: document.getElementById('btn-dev-logs')
};

// ==========================================
// 5. AFFICHAGE ET MISE À JOUR DE L'UI
// ==========================================
function updateUI() {
    ui.playerName.innerText = gameState.playerName;
    ui.floorLevel.innerText = gameState.currentFloor;
    ui.districtName.innerText = gameState.currentDistrict;
    
    // Mise à jour des PV, ATK et DEF
    ui.currentHp.innerText = gameState.hp;
    ui.maxHp.innerText = gameState.maxHp;
    ui.playerAtk.innerText = gameState.atk;
    ui.playerDef.innerText = getEffectiveDef();

    // Le libellé d'étage sur la carte active reste toujours synchronisé
    ui.cardFloorLabel.innerText = `Étage ${gameState.currentFloor}`;

    // Icônes de statut du joueur
    let playerIcons = "";
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🩸";
    if (gameState.status.stunned) playerIcons += "💫";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
    ui.playerStatusIcons.innerText = playerIcons;

    // Mise à jour du niveau et de l'XP
    ui.playerLevel.innerText = gameState.level;
    ui.xpText.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    ui.xpBar.style.width = `${Math.min(100, (gameState.xp / gameState.xpToNextLevel) * 100)}%`;

    // Mise à jour de la carte joueur (compétences)
    const skillBarMap = {
        weapon: [ui.skillWeaponLevel, ui.skillWeaponBar],
        unarmed: [ui.skillUnarmedLevel, ui.skillUnarmedBar],
        magic: [ui.skillMagicLevel, ui.skillMagicBar]
    };
    for (const key in skillBarMap) {
        const skill = gameState.skills[key];
        const [levelEl, barEl] = skillBarMap[key];
        levelEl.innerText = `Nv.${skill.level}`;
        barEl.style.width = `${Math.min(100, (skill.xp / skill.xpToNext) * 100)}%`;
    }
    
    // Mise à jour du temps
    ui.timeText.innerText = `${gameState.timeLeft} H`;
    const timePercentage = (gameState.timeLeft / gameState.maxTime) * 100;
    ui.timeBar.style.width = `${timePercentage}%`;
    
    // Changer la couleur de la barre si le temps est critique
    if (timePercentage <= 20) {
        ui.timeBar.classList.replace('bg-blue-600', 'bg-red-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(220, 38, 38, 1)";
    } else {
        ui.timeBar.classList.replace('bg-red-600', 'bg-blue-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(37, 99, 235, 1)";
    }

    // Gestion de l'affichage du combat : rétrécissement de la carte, panneaux latéraux PV/statut
    if (gameState.inCombat) {
        ui.btnAdvance.classList.add('opacity-50', 'pointer-events-none');
        ui.combatZone.classList.remove('hidden');
        ui.cardStackWrapper.style.maxWidth = '170px'; // La carte se réduit pour laisser place aux panneaux

        // Panneau joueur (toujours à jour dès qu'on est en combat)
        ui.combatSidePlayer.classList.remove('hidden');
        ui.combatSidePlayer.classList.add('flex', 'flex-col');
        ui.combatPlayerHp.innerText = Math.max(0, Math.round(gameState.hp));
        let playerIcons = "";
        if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🔥";
        if (gameState.status.stunned) playerIcons += "💫";
        if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
        ui.combatPlayerStatus.innerText = playerIcons || "—";

        if (gameState.currentEnemy) {
            ui.enemyName.innerText = gameState.currentEnemy.isBoss
                ? `👑 ${gameState.currentEnemy.name}`
                : gameState.currentEnemy.name;
            ui.enemyName.classList.toggle('text-yellow-400', !!gameState.currentEnemy.isBoss);

            ui.combatSideEnemy.classList.remove('hidden');
            ui.combatSideEnemy.classList.add('flex', 'flex-col');
            ui.combatEnemyHp.innerText = Math.max(0, Math.round(gameState.currentEnemy.hp));

            let enemyIcons = "";
            const enemyStatus = gameState.currentEnemy.status;
            if (enemyStatus) {
                if (enemyStatus.bleed && enemyStatus.bleed.rounds > 0) enemyIcons += "🔥";
                if (enemyStatus.stunned) enemyIcons += "💫";
            }
            ui.combatEnemyStatus.innerText = enemyIcons || "—";
        }
    } else {
        ui.btnAdvance.classList.remove('opacity-50', 'pointer-events-none');
        ui.combatZone.classList.add('hidden');
        ui.cardStackWrapper.style.maxWidth = '240px'; // Retour à la taille normale hors combat

        ui.combatSideEnemy.classList.add('hidden');
        ui.combatSideEnemy.classList.remove('flex', 'flex-col');
        ui.combatSidePlayer.classList.add('hidden');
        ui.combatSidePlayer.classList.remove('flex', 'flex-col');
    }
}

// Affiche un résultat de dégâts sous forme de "dé" avec une petite animation, sur le panneau
// latéral correspondant (joueur ou ennemi). `value` peut être un nombre ou un court symbole (ex: "✗").
function showDie(el, value) {
    el.innerText = value;
    el.classList.remove('die-pop');
    void el.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    el.classList.add('die-pop');
}

// Fonction pour ajouter un message : sur la carte active (fond clair) ET dans le journal complet (fond sombre)
function logEvent(message, type = "normal") {
    // Couleurs adaptées au fond clair de la carte (papier crème)
    const cardColors = {
        danger: "text-red-700 font-bold",
        success: "text-green-700 font-bold",
        info: "text-blue-700 italic",
        loot: "text-amber-700 font-bold",
        normal: "text-stone-700"
    };
    const cardLine = document.createElement('p');
    cardLine.className = cardColors[type] || cardColors.normal;
    cardLine.innerText = message;
    ui.cardBody.appendChild(cardLine);
    ui.cardBody.scrollTop = ui.cardBody.scrollHeight;

    // Couleurs adaptées au fond sombre du journal complet (reprend l'ancien style)
    const logColors = {
        danger: "text-red-400 font-bold",
        success: "text-green-400",
        info: "text-blue-300 italic",
        loot: "text-yellow-400 font-bold",
        normal: "text-gray-300"
    };
    const logLine = document.createElement('div');
    logLine.className = logColors[type] || logColors.normal;
    logLine.innerText = `>> ${message}`;
    ui.fullLog.appendChild(logLine);
    ui.fullLog.scrollTop = ui.fullLog.scrollHeight;
}

// Prépare l'en-tête de la carte active (icône, titre, type) : appelé au début de chaque nouvelle
// branche d'événement dans resolveCardEvent(), avant que logEvent() ne remplisse le corps.
function setCardHeader(icon, title, typeLabel) {
    ui.cardIcon.innerText = icon;
    ui.cardTitle.innerText = title;
    ui.cardTypeLabel.innerText = typeLabel;
}

// Petite animation de "pop" à chaque nouvelle carte tirée (voir le commentaire CSS de .card-draw-anim)
function playCardDrawAnimation() {
    ui.activeCard.classList.remove('card-draw-anim');
    void ui.activeCard.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    ui.activeCard.classList.add('card-draw-anim');
}

// Fonction pour mettre à jour l'inventaire visuel
function updateInventoryUI() {
    ui.inventoryCount.innerText = gameState.inventory.length;
    ui.inventoryContainer.innerHTML = ""; // On vide l'inventaire

    // Affichage de l'équipement actuel
    ui.equippedWeapon.innerText = gameState.equipment.weapon ? gameState.equipment.weapon.name : "Aucune";
    ui.equippedArmor.innerText = gameState.equipment.armor ? gameState.equipment.armor.name : "Aucune";

    // Couleur distincte par catégorie d'objet, pour repérer les types d'un coup d'œil
    const categoryStyles = {
        weapons: ['text-red-400', 'border-red-900/50'],
        armors: ['text-blue-400', 'border-blue-900/50'],
        consumables: ['text-green-400', 'border-green-900/50']
    };

    // On recrée les 5 cases
    for (let i = 0; i < gameState.maxInventory; i++) {
        const slot = document.createElement('div');
        slot.className = "aspect-square bg-gray-950 border border-gray-800 rounded flex items-center justify-center text-xs text-center p-1 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] overflow-hidden text-ellipsis";

        if (i < gameState.inventory.length) {
            const item = gameState.inventory[i];
            slot.innerText = item.name;
            slot.title = `${item.name} — touchez pour ${item.category === 'consumables' ? 'utiliser' : 'équiper'}`;
            const [textClass, borderClass] = categoryStyles[item.category] || ['text-yellow-500', 'border-yellow-900/50'];
            slot.classList.add(textClass, borderClass, 'cursor-pointer', 'hover:brightness-125');
            slot.addEventListener('click', () => useOrEquipItem(i));
        } else {
            slot.innerText = "+";
            slot.classList.add('text-gray-800');
        }
        ui.inventoryContainer.appendChild(slot);
    }
}

// ==========================================
// SYSTÈME D'ÉQUIPEMENT ET DE CONSOMMABLES
// ==========================================

// Point d'entrée unique quand on touche un objet de l'inventaire : équipe ou consomme selon la catégorie
function useOrEquipItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    if (item.category === 'consumables') {
        useConsumable(index);
    } else if (item.category === 'weapons' || item.category === 'armors') {
        equipItem(index);
    }
}

// Équipe une arme ou une armure. L'éventuel équipement précédent retourne dans l'inventaire
// (jamais de perte d'objet lors d'un changement d'équipement).
function equipItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const slot = item.category === 'weapons' ? 'weapon' : 'armor';
    const previouslyEquipped = gameState.equipment[slot];

    gameState.equipment[slot] = item;
    gameState.inventory.splice(index, 1);
    if (previouslyEquipped) {
        gameState.inventory.push(previouslyEquipped);
    }

    logEvent(`Vous équipez [${item.name}] (${slot === 'weapon' ? 'Arme' : 'Armure'}).`, "info");
    updateUI();
    updateInventoryUI();
}

// Consomme un objet de type consommable : soigne puis disparaît de l'inventaire
function useConsumable(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const healAmount = item.heal || 0;
    gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
    logEvent(`Vous consommez [${item.name}] et récupérez ${healAmount} PV.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================
function resolveCardEvent() {
    // 1. Calcul de la probabilité de trouver l'escalier
    // Nouvelle formule non-linéaire (exposant 1.4) : la chance grimpe lentement au début,
    // puis s'accélère à l'approche de la fin du temps disponible. Toujours divisée par l'étage
    // actuel, pour que les étages profonds soient plus longs à percer.
    // (Testé en simulation : ~2x plus de cartes nécessaires en moyenne qu'avant, 0% de risque
    // de ne jamais trouver l'escalier avant la fin du temps, même à l'étage 10.)
    const stairChance = Math.min(90, Math.pow(gameState.cardsDrawnThisFloor, 1.4) * (0.35 / gameState.currentFloor));
    const stairRoll = Math.random() * 100;

    // A. ÉVÉNEMENT : ESCALIER TROUVÉ (le moment fort du palier)
    if (stairRoll < stairChance) {
        setCardHeader('🪜', 'Escalier', 'Progression');
        logEvent(`🎬 Un escalier vers l'étage ${gameState.currentFloor + 1} se matérialise devant vous !`, "success");

        const guardedRoll = Math.random() * 100;
        if (guardedRoll < config.stairGuardedChance) {
            const boss = generateBoss(gameState.currentDistrict);
            setCardHeader('👑', boss ? boss.name : 'Gardien', 'Boss de Quartier');
            logEvent(
                boss
                    ? `${boss.name}, gardien de ce quartier, vous barre la route vers l'étage suivant !`
                    : "Un gardien se poste devant les marches. Il faudra le vaincre pour descendre.",
                "danger"
            );
            gameState.pendingStairAfterCombat = true; // Gagner CE combat déclenchera nextFloor()
            initiateCombat(boss); // Repli automatique sur un mob générique si boss === null
        } else {
            nextFloor();
        }
        return; // Fin du tour
    }

    // B. TABLE DES ÉVÉNEMENTS CLASSIQUES (D100) — 10 catégories, chacune avec un vrai effet
    const d100 = Math.random() * 100;
    let cumulative = 0;

    // Rien de notable
    cumulative += config.chances.nothing;
    if (d100 < cumulative) {
        setCardHeader('🌑', 'Silence', 'Exploration');
        logEvent(pick(flavorText.nothing), "normal");
        return;
    }

    // Combat
    cumulative += config.chances.combat;
    if (d100 < cumulative) {
        setCardHeader('⚔️', 'Combat', 'Danger');
        logEvent(`Des bruits de pas approchent... Des créatures de ${gameState.currentDistrict} vous attaquent !`, "danger");
        initiateCombat();
        return;
    }

    // Changement de quartier
    cumulative += config.chances.districtChange;
    if (d100 < cumulative) {
        const districtNames = Object.keys(districts);
        const newDistrict = districtNames[Math.floor(Math.random() * districtNames.length)];
        gameState.currentDistrict = newDistrict;
        setCardHeader('🧭', 'Nouveau Quartier', 'Exploration');
        logEvent(`Le décor change brusquement. Vous entrez dans : ${newDistrict}.`, "info");
        return;
    }

    // Salle sécurisée (gros soin)
    cumulative += config.chances.safeRoom;
    if (d100 < cumulative) {
        const heal = Math.floor(Math.random() * 20) + 10; // 10 à 30 PV
        gameState.hp = Math.min(gameState.hp + heal, gameState.maxHp);
        setCardHeader('🏥', 'Salle Sécurisée', 'Repos');
        logEvent(`Vous découvrez une salle sécurisée. Vous vous reposez et récupérez ${heal} PV.`, "success");
        return;
    }

    // Découverte d'objet (générateur procédural)
    cumulative += config.chances.loot;
    if (d100 < cumulative) {
        setCardHeader('💰', 'Trésor', 'Butin');
        logEvent("Vous trébuchez sur quelque chose de brillant...", "info");
        addLoot();
        return;
    }

    // NOUVEAU : Piège dangereux (vrais dégâts, plusieurs variantes)
    cumulative += config.chances.trap;
    if (d100 < cumulative) {
        const trap = pick(flavorText.trap);
        const dmg = Math.floor(Math.random() * (trap.dmgMax - trap.dmgMin + 1)) + trap.dmgMin;
        gameState.hp = Math.max(0, gameState.hp - dmg);
        setCardHeader('⚠️', 'Piège', 'Danger');
        logEvent(`${trap.text} (-${dmg} PV)`, "danger");
        if (gameState.hp <= 0) {
            gameOver();
            return;
        }
        return;
    }

    // NOUVEAU : Détour qui coûte du temps (la ressource la plus précieuse du jeu)
    cumulative += config.chances.timeLoss;
    if (d100 < cumulative) {
        const lost = Math.floor(Math.random() * 3) + 1; // 1 à 3 heures perdues en plus
        gameState.timeLeft = Math.max(0, gameState.timeLeft - lost);
        setCardHeader('⏳', 'Contretemps', 'Danger');
        logEvent(`${pick(flavorText.timeLoss)} (-${lost}H supplémentaires)`, "danger");
        if (gameState.timeLeft <= 0) {
            gameOver(true);
            return;
        }
        return;
    }

    // NOUVEAU : Petite trouvaille (soin mineur)
    cumulative += config.chances.minorFind;
    if (d100 < cumulative) {
        const heal = Math.floor(Math.random() * 8) + 5; // 5 à 12 PV
        gameState.hp = Math.min(gameState.hp + heal, gameState.maxHp);
        setCardHeader('🎒', 'Petite Trouvaille', 'Butin');
        logEvent(`${pick(flavorText.minorFind)} (+${heal} PV)`, "success");
        return;
    }

    // NOUVEAU : Cadeau des spectateurs (petit bonus d'XP — clin d'œil au format "émission" du livre)
    cumulative += config.chances.audienceGift;
    if (d100 < cumulative) {
        const bonusXp = Math.floor(Math.random() * 6) + 5; // 5 à 10 XP
        setCardHeader('📢', 'Cadeau du Public', 'Bonus');
        logEvent(pick(flavorText.audienceGift), "success");
        gainXp(bonusXp);
        return;
    }

    // Reste : moment purement narratif, sans effet mécanique
    setCardHeader('🎬', 'Ambiance', 'Exploration');
    logEvent(pick(flavorText.flavorOnly), "normal");
}

function nextFloor() {
    gameState.currentFloor += 1;
    gameState.cardsDrawnThisFloor = 0;
    gameState.timeLeft = gameState.maxTime; // Réinitialisation du temps
    logEvent(`--- DÉBUT DE L'ÉTAGE ${gameState.currentFloor} ---`, "info");
    updateUI();
}

function addLoot() {
    if (gameState.inventory.length < gameState.maxInventory) {
        const item = generateItem();
        gameState.inventory.push(item);
        logEvent(`Objet obtenu : [${item.name}] !`, "loot");
        updateInventoryUI();
    } else {
        logEvent("Vous trouvez un objet, mais votre inventaire est plein !", "danger");
    }
}

// ==========================================
// SYSTÈME DE NIVEAU ET D'EXPÉRIENCE
// ==========================================
function gainXp(amount) {
    if (!amount || amount <= 0) return;
    gameState.xp += amount;
    logEvent(`+${amount} XP`, "success");

    // On utilise une boucle "while" pour gérer le cas (rare) d'un gain d'XP
    // suffisant pour franchir plusieurs niveaux d'un coup.
    while (gameState.xp >= gameState.xpToNextLevel) {
        gameState.xp -= gameState.xpToNextLevel;
        gameState.level += 1;
        gameState.xpToNextLevel = Math.round(gameState.xpToNextLevel * 1.4); // Chaque niveau demande un peu plus d'XP

        // Gains de statistiques à la montée de niveau
        const hpGain = 15;
        const atkGain = 2;
        const defGain = 1;
        gameState.maxHp += hpGain;
        gameState.hp = gameState.maxHp; // Montée de niveau = soin complet (récompense marquante)
        gameState.atk += atkGain;
        gameState.def += defGain;

        logEvent(`⭐ NIVEAU SUPÉRIEUR ! Vous êtes maintenant niveau ${gameState.level}. (+${hpGain} PV max, +${atkGain} ATQ, +${defGain} DEF — PV entièrement restaurés)`, "success");
    }

    updateUI();
}

// Gain d'XP dédiée à une compétence (arme / mains nues / magie), uniquement via l'usage en combat.
// Chaque compétence progresse indépendamment des autres et du niveau général du joueur.
function gainSkillXp(skillKey, amount) {
    const skill = gameState.skills[skillKey];
    if (!skill || !amount) return;

    skill.xp += amount;
    while (skill.xp >= skill.xpToNext) {
        skill.xp -= skill.xpToNext;
        skill.level += 1;
        skill.xpToNext = Math.round(skill.xpToNext * 1.3);
        logEvent(`📈 Compétence "${skillLabel(skillKey)}" améliorée ! Niveau ${skill.level}.`, "success");
    }
    updateUI();
}

function skillLabel(key) {
    return { weapon: "Arme", unarmed: "Mains nues", magic: "Magie" }[key] || key;
}

// ==========================================
// 4. SYSTÈME DE COMBAT
// ==========================================
function initiateCombat(forcedEnemy = null) {
    const enemy = forcedEnemy || generateMob(gameState.currentDistrict);
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;

    // Statuts remis à zéro à chaque nouveau combat (des deux côtés)
    gameState.status = { bleed: null, stunned: false, slowed: null };
    if (enemy) {
        enemy.status = { bleed: null, stunned: false };
    }

    // Les dés de dégâts repartent à zéro visuellement (aucune action encore jouée ce combat)
    ui.combatPlayerDie.innerText = "–";
    ui.combatPlayerDie.classList.remove('die-pop');
    ui.combatEnemyDie.innerText = "–";
    ui.combatEnemyDie.classList.remove('die-pop');

    if (enemy && enemy.isBoss) {
        logEvent("--- 👑 COMBAT DE BOSS ---", "danger");
        logEvent(`${enemy.name} se dresse devant vous ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else if (enemy) {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        logEvent(`Un [${enemy.name}] apparaît ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        // Sécurité : si la génération échoue pour une raison imprévue, on ne bloque pas le jeu
        logEvent("Une présence hostile rôde, mais reste indistincte...", "danger");
    }
    updateUI();
}

// Formule de mitigation multiplicative : le ratio ATQ/(ATQ+DEF) donne la part des dégâts qui passe.
// Avantage sur une formule additive (ATQ - DEF) : jamais de dégâts négatifs à écrêter artificiellement,
// et la DEF réduit toujours les dégâts proportionnellement, sans effet de seuil brutal.
// `options` permet de différencier les types d'attaque (arme / mains nues / magie) :
//   - atkMultiplier : multiplie l'ATQ de base (ex: 1.4 pour la magie, plus puissante)
//   - varianceRange : amplitude de l'aléatoire (ex: 0.35 pour la magie, plus imprévisible)
//   - defReduction  : fraction de la DEF adverse ignorée (ex: 0.35 pour les mains nues, qui passent sous la garde)
function rollDamage(attackerAtk, defenderDef, options = {}) {
    const atkMultiplier = options.atkMultiplier ?? 1;
    const varianceRange = options.varianceRange ?? 0.15;
    const defReduction = options.defReduction ?? 0;

    const effectiveAtk = attackerAtk * atkMultiplier;
    const effectiveDef = Math.max(0, defenderDef * (1 - defReduction));
    const mitigation = effectiveAtk / (effectiveAtk + effectiveDef);
    const variance = 1 + (Math.random() * varianceRange * 2 - varianceRange);
    const damage = effectiveAtk * mitigation * variance;
    return Math.max(1, Math.round(damage));
}

// DEF effective du joueur : sa DEF de base + le bonus de l'armure équipée, le cas échéant
function getEffectiveDef() {
    const armorBonus = gameState.equipment.armor ? (gameState.equipment.armor.baseArmor || 0) : 0;
    return gameState.def + armorBonus;
}

// Vérifie que le joueur peut agir (combat en cours, pas étourdi), et applique le saignement
// éventuellement en cours sur le joueur AVANT son action. Retourne false si le joueur ne peut pas
// agir ce tour-ci (combat terminé entre-temps, ou étourdi).
function tryPlayerAction() {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;

    // Saignement en cours sur le joueur : tique avant son action
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) {
        const dmg = gameState.status.bleed.dmgPerRound;
        gameState.hp -= dmg;
        gameState.status.bleed.rounds -= 1;
        if (gameState.status.bleed.rounds <= 0) gameState.status.bleed = null;
        logEvent(`🩸 Votre état vous fait perdre ${dmg} PV.`, "danger");
        if (gameState.hp <= 0) {
            gameState.hp = 0;
            gameOver();
            return false;
        }
    }

    if (gameState.status.stunned) {
        logEvent("Vous êtes étourdi et ne parvenez pas à agir ce tour-ci !", "danger");
        gameState.status.stunned = false; // L'étourdissement se consomme après ce tour manqué
        showDie(ui.combatPlayerDie, "😵");
        enemyCounterAttack();
        return false;
    }

    return true;
}

// Portion commune à toute attaque du joueur : applique les dégâts, vérifie la victoire,
// et laisse l'ennemi riposter s'il survit.
function performPlayerAttack(attackerAtk, options, label) {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    const enemy = gameState.currentEnemy;

    // Un joueur ralenti inflige moitié moins de dégâts, le temps que l'effet se dissipe
    let effectiveOptions = options;
    let slowedNote = "";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) {
        effectiveOptions = { ...options, atkMultiplier: (options.atkMultiplier ?? 1) * 0.5 };
        slowedNote = " (ralenti)";
        gameState.status.slowed.rounds -= 1;
        if (gameState.status.slowed.rounds <= 0) gameState.status.slowed = null;
    }

    const playerDamage = rollDamage(attackerAtk, enemy.def, effectiveOptions);
    enemy.hp -= playerDamage;
    showDie(ui.combatPlayerDie, playerDamage);
    logEvent(`Vous attaquez ${label}${slowedNote} et infligez ${playerDamage} dégâts à [${enemy.name}].`, "normal");

    if (enemy.hp <= 0) {
        logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
        winCombat();
        return true;
    }

    enemyCounterAttack();
    return true;
}

// Applique la mécanique spéciale de l'arme équipée (Tranchant->saignement, Lourd->étourdissement),
// avec une chance de déclenchement. Appelée uniquement après une attaque à l'arme réussie.
function applyWeaponMechanic() {
    const weapon = gameState.equipment.weapon;
    const enemy = gameState.currentEnemy;
    if (!weapon || !weapon.mechanic || !enemy) return;

    const triggerChance = 30; // 30% de chance que la mécanique de l'arme se déclenche
    if (Math.random() * 100 >= triggerChance) return;

    if (weapon.mechanic === 'bleed') {
        enemy.status.bleed = { rounds: 3, dmgPerRound: Math.max(2, Math.round((weapon.baseDmg || 5) * 0.3)) };
        logEvent(`🩸 [${enemy.name}] se met à saigner !`, "danger");
    } else if (weapon.mechanic === 'stun') {
        enemy.status.stunned = true;
        logEvent(`💫 [${enemy.name}] est étourdi par le choc !`, "danger");
    }
    // "pleasure_or_pain" (Vibrant) reste un effet purement comique, sans mécanique de combat
    updateUI();
}

// Tente d'appliquer un effet de statut au joueur selon le trait élémentaire du monstre
// (burn/poison/slow/stun, définis dans mobModifiers). Appelée après une riposte ennemie réussie.
function applyMobEffectOnPlayer(enemy) {
    if (!enemy.effect) return;
    const triggerChance = 25; // 25% de chance que le trait élémentaire du monstre fasse effet
    if (Math.random() * 100 >= triggerChance) return;

    switch (enemy.effect) {
        case 'burn':
            gameState.status.bleed = { rounds: 3, dmgPerRound: 5 };
            logEvent("🔥 Vous prenez feu ! La brûlure va vous ronger quelques instants.", "danger");
            break;
        case 'poison':
            gameState.status.bleed = { rounds: 4, dmgPerRound: 4 };
            logEvent("☢️ Une sensation toxique se propage en vous.", "danger");
            break;
        case 'slow':
            gameState.status.slowed = { rounds: 2 };
            logEvent("🐌 Vos mouvements sont englués, vous vous sentez ralenti.", "danger");
            break;
        case 'stun':
            gameState.status.stunned = true;
            logEvent("⚡ Le choc vous étourdit !", "danger");
            break;
    }
}

// Durée de la pause entre l'action du joueur et la riposte de l'ennemi : juste assez pour bien
// séparer visuellement les deux dés, sans ralentir le rythme du combat.
const COMBAT_BEAT_MS = 400;

// Empêche de spammer les boutons de combat pendant la petite pause entre deux actions
function setCombatInputLocked(locked) {
    [ui.btnAttackWeapon, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnFlee].forEach(btn => {
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('opacity-40', locked);
        btn.classList.toggle('pointer-events-none', locked);
    });
}

// Riposte de l'ennemi : marque une courte pause (le temps que le dé du joueur reste bien visible)
// avant de résoudre réellement l'attaque, pour que chaque camp "joue son tour" séparément à l'écran.
function enemyCounterAttack() {
    if (!gameState.currentEnemy) return; // sécurité si le combat vient d'être résolu
    setCombatInputLocked(true);
    setTimeout(() => {
        resolveEnemyCounterAttack();
        setCombatInputLocked(false);
    }, COMBAT_BEAT_MS);
}

// Riposte de l'ennemi : tient compte de son propre saignement/étourdissement en cours,
// de l'armure équipée du joueur, et peut infliger un effet de statut selon son trait élémentaire.
function resolveEnemyCounterAttack() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return; // sécurité si le combat vient d'être résolu pendant la pause

    // Saignement en cours sur l'ennemi (infligé par une arme du joueur) : tique avant son action
    if (enemy.status && enemy.status.bleed && enemy.status.bleed.rounds > 0) {
        const dmg = enemy.status.bleed.dmgPerRound;
        enemy.hp -= dmg;
        enemy.status.bleed.rounds -= 1;
        if (enemy.status.bleed.rounds <= 0) enemy.status.bleed = null;
        logEvent(`🩸 [${enemy.name}] souffre de son saignement (-${dmg} PV).`, "danger");
        if (enemy.hp <= 0) {
            logEvent(`[${enemy.name}] succombe à ses blessures !`, "success");
            winCombat();
            return;
        }
    }

    // Étourdissement en cours sur l'ennemi : il rate son tour
    if (enemy.status && enemy.status.stunned) {
        logEvent(`[${enemy.name}] est étourdi et ne peut pas riposter !`, "info");
        enemy.status.stunned = false;
        showDie(ui.combatEnemyDie, "😴");
        updateUI();
        return;
    }

    const enemyDamage = rollDamage(enemy.atk, getEffectiveDef());
    gameState.hp -= enemyDamage;
    showDie(ui.combatEnemyDie, enemyDamage);
    logEvent(`[${enemy.name}] vous inflige ${enemyDamage} dégâts.`, "danger");

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        gameOver();
        return;
    }

    applyMobEffectOnPlayer(enemy);
    updateUI();
}

// --- Les 3 types d'attaque ---
// Chacune est reliée à sa propre compétence : plus elle est utilisée en combat, plus elle progresse
// (XP dédiée, indépendante des autres compétences et du niveau général du joueur).
const SKILL_XP_PER_USE = 3;

// Arme : la référence, équilibrée. Bénéficie du bonus de dégâts et de la mécanique spéciale
// (saignement/étourdissement) de l'arme équipée, le cas échéant.
function attackWeapon() {
    if (!tryPlayerAction()) return;

    const skill = gameState.skills.weapon;
    const atkMultiplier = 1.0 + 0.04 * (skill.level - 1); // +4% par niveau
    const weaponBonus = gameState.equipment.weapon ? (gameState.equipment.weapon.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const used = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0 }, "à l'arme");
    if (used) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(); // Ne fait rien si le combat vient de se terminer ou si l'arme n'a pas de mécanique
    }
}

// Mains nues : moins puissant, mais ignore une bonne partie de la DEF adverse.
// Chaque niveau de compétence Mains nues améliore la capacité à contourner la DEF adverse.
function attackUnarmed() {
    if (!tryPlayerAction()) return;

    const skill = gameState.skills.unarmed;
    const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1)); // +3% par niveau, plafonné à 75%
    const used = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75, varianceRange: 0.10, defReduction }, "à mains nues");
    if (used) gainSkillXp('unarmed', SKILL_XP_PER_USE);
}

// Magie : la plus puissante en moyenne, mais imprévisible, et peut totalement rater (thème absurde/chaotique).
// Chaque niveau de compétence Magie réduit le risque de rater son sort ET augmente légèrement sa puissance.
// (Plus tard : nécessitera un sort appris et du mana.)
function attackMagic() {
    if (!tryPlayerAction()) return;

    const skill = gameState.skills.magic;
    const backfireChance = Math.max(3, 15 - 1.5 * (skill.level - 1)); // 15% de base, jusqu'à 3% minimum
    const atkMultiplier = 1.4 + 0.02 * (skill.level - 1);

    if (Math.random() * 100 < backfireChance) {
        showDie(ui.combatPlayerDie, "✗");
        logEvent("Votre sort part de travers et fait un flop retentissant. Aucun dégât.", "danger");
        enemyCounterAttack();
        gainSkillXp('magic', SKILL_XP_PER_USE); // On apprend même de ses échecs
        return;
    }

    const used = performPlayerAttack(gameState.atk, { atkMultiplier, varianceRange: 0.35, defReduction: 0 }, "magiquement");
    if (used) gainSkillXp('magic', SKILL_XP_PER_USE);
}

// Tentative de fuite : quitte le combat sans le gagner ni obtenir de loot/XP.
// En cas d'échec, l'ennemi place une attaque gratuite.
function attemptFlee() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    const enemy = gameState.currentEnemy;
    const fleeChance = 60; // 60% de réussite (pourra dépendre de compétences/stats plus tard)

    if (Math.random() * 100 < fleeChance) {
        logEvent(`Vous parvenez à fuir [${enemy.name}] dans la confusion !`, "info");
        gameState.currentEnemy = null;
        gameState.inCombat = false;
        gameState.pendingStairAfterCombat = false; // La fuite ne compte pas comme une victoire sur le gardien
        gameState.status = { bleed: null, stunned: false, slowed: null }; // Les statuts ne survivent pas au combat
        updateUI();
    } else {
        logEvent(`Votre fuite échoue ! [${enemy.name}] profite de l'ouverture.`, "danger");
        enemyCounterAttack();
    }
}

function winCombat() {
    const wasBoss = gameState.currentEnemy && gameState.currentEnemy.isBoss;

    if (wasBoss) {
        logEvent(`👑 Vous avez triomphé de ${gameState.currentEnemy.name} !`, "success");
    } else {
        logEvent("Vous remportez le combat !", "success");
    }

    // Gain d'XP basé sur le monstre vaincu (valeur de repli si jamais xpReward est absent)
    const xpGained = (gameState.currentEnemy && gameState.currentEnemy.xpReward) || 10;
    gainXp(xpGained);

    // Butin : garanti pour un boss (avec une chance de second objet), sinon la chance standard
    if (wasBoss) {
        addLoot();
        if (Math.random() * 100 < 50) addLoot(); // 50% de chance d'un deuxième objet
    } else if (Math.random() * 100 < 40) { // 40% de chance de loot post-combat
        addLoot();
    }

    gameState.currentEnemy = null;
    gameState.inCombat = false;
    gameState.status = { bleed: null, stunned: false, slowed: null }; // Les statuts ne survivent pas au combat

    // Si ce combat gardait un escalier, la victoire ouvre le passage vers l'étage suivant
    if (gameState.pendingStairAfterCombat) {
        gameState.pendingStairAfterCombat = false;
        logEvent("La voie vers l'escalier est libre !", "success");
        nextFloor(); // nextFloor() appelle déjà updateUI()
        return;
    }

    updateUI();
}

// ==========================================
// 2. BOUCLE DE GAMEPLAY
// ==========================================
function advance() {
    if (gameState.inCombat) return; // Sécurité si le bouton est cliqué pendant un combat
    if (gameState.hp <= 0 || gameState.timeLeft <= 0) return; // Jeu terminé

    // Décrémente le temps et incrémente le compteur de cartes
    gameState.timeLeft -= 1;
    gameState.cardsDrawnThisFloor += 1;

    // Nouvelle carte : on repart d'un corps vide et on joue l'animation de tirage
    ui.cardBody.innerHTML = "";
    playCardDrawAnimation();

    if (gameState.timeLeft <= 0) {
        gameOver(true); // Game over par temps écoulé
    } else {
        resolveCardEvent();
    }
    
    updateUI();
}

function gameOver(timeout = false) {
    gameState.inCombat = true; // Bloque le bouton Avancer
    ui.combatZone.classList.add('hidden'); // Cache la zone de combat
    
    if (timeout) {
        logEvent("Le temps est écoulé. Le donjon s'effondre sur vous...", "danger");
    } else {
        logEvent("Vos signes vitaux sont à zéro. Fin de transmission.", "danger");
    }
    
    logEvent("--- GAME OVER ---", "danger");
    ui.btnAdvance.innerText = "SYSTÈME VERROUILLÉ";
    ui.btnAdvance.classList.add('border-red-600', 'text-red-500', 'pointer-events-none');
    updateUI();
}

// ==========================================
// INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS
// ==========================================

// Clic sur le bouton Avancer
ui.btnAdvance.addEventListener('click', advance);

// Clics sur les boutons de combat
ui.btnAttackWeapon.addEventListener('click', attackWeapon);
ui.btnAttackUnarmed.addEventListener('click', attackUnarmed);
ui.btnAttackMagic.addEventListener('click', attackMagic);
ui.btnFlee.addEventListener('click', attemptFlee);

// Clic sur l'export des logs Dev
ui.btnDevLogs.addEventListener('click', () => {
    console.log("--- LOGS DE DÉVELOPPEMENT ---");
    console.table(gameState);
    logEvent("Statistiques système exportées dans la console (F12).", "info");
});

// Lancement du jeu
updateUI();
updateInventoryUI();

