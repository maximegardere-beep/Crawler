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
    cardsDrawnThisFloor: 0, // Compteur de cartes pour calculer la probabilité de l'escalier
    inCombat: false, // Verrouille l'avancée si un combat est en cours
    currentEnemy: null // Ennemi généré procéduralement, actif pendant un combat
};

// ==========================================
// CONFIGURATION ET BASES DE DONNÉES
// ==========================================
const config = {
    // Probabilités des événements (D100)
    // La somme de ces valeurs sert de seuils. L'événement mineur prend le reste.
    chances: {
        nothing: 25,         // 25%
        combat: 25,          // 25%
        districtChange: 15,  // 15%
        safeRoom: 10,        // 10%
        loot: 1              // 1%
        // Reste (24%) : Événements mineurs
    },
    stairGuardedChance: 20 // 20% de chance qu'un escalier trouvé soit gardé par des mobs
};

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
    timeText: document.getElementById('time-text'),
    timeBar: document.getElementById('time-bar'),
    eventLog: document.getElementById('event-log'),
    inventoryCount: document.getElementById('inventory-count'),
    inventoryContainer: document.getElementById('inventory'),
    btnAdvance: document.getElementById('btn-advance'),
    combatZone: document.getElementById('combat-zone'),
    enemyName: document.getElementById('enemy-name'),
    enemyHp: document.getElementById('enemy-hp'),
    btnAttack: document.getElementById('btn-attack'),
    btnDevLogs: document.getElementById('btn-dev-logs')
};

// ==========================================
// 5. AFFICHAGE ET MISE À JOUR DE L'UI
// ==========================================
function updateUI() {
    ui.playerName.innerText = gameState.playerName;
    ui.floorLevel.innerText = gameState.currentFloor;
    ui.districtName.innerText = gameState.currentDistrict;
    
    // Mise à jour des PV
    ui.currentHp.innerText = gameState.hp;
    ui.maxHp.innerText = gameState.maxHp;
    
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

    // Gestion de l'affichage de la zone de combat et des PV de l'ennemi en temps réel
    if (gameState.inCombat) {
        ui.btnAdvance.classList.add('opacity-50', 'pointer-events-none');
        ui.combatZone.classList.remove('hidden');
        if (gameState.currentEnemy) {
            ui.enemyName.innerText = gameState.currentEnemy.name;
            ui.enemyHp.innerText = Math.max(0, Math.round(gameState.currentEnemy.hp));
        }
    } else {
        ui.btnAdvance.classList.remove('opacity-50', 'pointer-events-none');
        ui.combatZone.classList.add('hidden');
    }
}

// Fonction pour ajouter un message dans le log
function logEvent(message, type = "normal") {
    const logEntry = document.createElement('div');
    
    // Couleurs selon le type d'événement
    if (type === "danger") logEntry.className = "text-red-400 font-bold drop-shadow-[0_0_2px_rgba(248,113,113,0.8)]";
    else if (type === "success") logEntry.className = "text-green-400 drop-shadow-[0_0_2px_rgba(74,222,128,0.8)]";
    else if (type === "info") logEntry.className = "text-blue-300 italic";
    else if (type === "loot") logEntry.className = "text-yellow-400 font-bold";
    else logEntry.className = "text-gray-300";

    logEntry.innerText = `>> ${message}`;
    ui.eventLog.appendChild(logEntry);
    
    // Auto-scroll vers le bas
    ui.eventLog.scrollTop = ui.eventLog.scrollHeight;
}

// Fonction pour mettre à jour l'inventaire visuel
function updateInventoryUI() {
    ui.inventoryCount.innerText = gameState.inventory.length;
    ui.inventoryContainer.innerHTML = ""; // On vide l'inventaire
    
    // On recrée les 5 cases
    for (let i = 0; i < gameState.maxInventory; i++) {
        const slot = document.createElement('div');
        slot.className = "aspect-square bg-gray-950 border border-gray-800 rounded flex items-center justify-center text-xs text-center p-1 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] overflow-hidden text-ellipsis";
        
        if (i < gameState.inventory.length) {
            slot.innerText = gameState.inventory[i].name;
            slot.title = gameState.inventory[i].name; // infobulle si le nom est tronqué visuellement
            slot.classList.add('text-yellow-500', 'border-yellow-900/50');
        } else {
            slot.innerText = "+";
            slot.classList.add('text-gray-800');
        }
        ui.inventoryContainer.appendChild(slot);
    }
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS ET ÉVÉNEMENTS
// ==========================================
function resolveCardEvent() {
    // 1. Calcul de la probabilité de trouver l'escalier
    // Formule : Augmente avec les cartes, mais l'augmentation est divisée par l'étage actuel
    // Ne dépasse jamais 95% pour garder une part d'incertitude
    let stairChance = (gameState.cardsDrawnThisFloor * 2.5) / gameState.currentFloor;
    if (stairChance > 95) stairChance = 95;

    const stairRoll = Math.random() * 100;

    // A. ÉVÉNEMENT : ESCALIER TROUVÉ
    if (stairRoll < stairChance) {
        logEvent(`Un escalier vers l'étage ${gameState.currentFloor + 1} se dresse devant vous.`, "success");
        
        // Chance que l'escalier soit gardé
        const guardedRoll = Math.random() * 100;
        if (guardedRoll < config.stairGuardedChance) {
            logEvent("Attention ! L'escalier est gardé par un Boss de palier !", "danger");
            initiateCombat();
        } else {
            nextFloor();
        }
        return; // Fin du tour
    }

    // B. ÉVÉNEMENTS CLASSIQUES (D100)
    const d100 = Math.random() * 100;
    let cumulative = 0;

    // 25% Rien ne se passe
    cumulative += config.chances.nothing;
    if (d100 < cumulative) {
        logEvent("Le couloir est vide. Le silence est oppressant.", "normal");
        return;
    }

    // 25% Combat
    cumulative += config.chances.combat;
    if (d100 < cumulative) {
        logEvent(`Des bruits de pas approchent... Des créatures de ${gameState.currentDistrict} vous attaquent !`, "danger");
        initiateCombat();
        return;
    }

    // 15% Changement de quartier
    cumulative += config.chances.districtChange;
    if (d100 < cumulative) {
        const districtNames = Object.keys(districts);
        const newDistrict = districtNames[Math.floor(Math.random() * districtNames.length)];
        gameState.currentDistrict = newDistrict;
        logEvent(`Le décor change brusquement. Vous entrez dans : ${newDistrict}.`, "info");
        return;
    }

    // 10% Salle sécurisée
    cumulative += config.chances.safeRoom;
    if (d100 < cumulative) {
        const heal = Math.floor(Math.random() * 20) + 10; // Soin entre 10 et 30 PV
        gameState.hp = Math.min(gameState.hp + heal, gameState.maxHp);
        logEvent(`Vous découvrez une salle sécurisée. Vous vous reposez et récupérez ${heal} PV.`, "success");
        return;
    }

    // 1% Découverte d'objet
    cumulative += config.chances.loot;
    if (d100 < cumulative) {
        logEvent("Vous trébuchez sur quelque chose de brillant...", "info");
        addLoot();
        return;
    }

    // Reste (24%) Événement mineur
    logEvent("Vous déclenchez un piège mineur, l'air devient toxique l'espace d'un instant.", "normal");
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
// 4. SYSTÈME DE COMBAT
// ==========================================
function initiateCombat() {
    const enemy = generateMob(gameState.currentDistrict);
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;

    logEvent("--- COMBAT INITIÉ ---", "danger");
    if (enemy) {
        logEvent(`Un [${enemy.name}] apparaît ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else {
        // Sécurité : si la génération échoue pour une raison imprévue, on ne bloque pas le jeu
        logEvent("Une présence hostile rôde, mais reste indistincte...", "danger");
    }
    updateUI();
}

// Formule de mitigation multiplicative : le ratio ATQ/(ATQ+DEF) donne la part des dégâts qui passe.
// Avantage sur une formule additive (ATQ - DEF) : jamais de dégâts négatifs à écrêter artificiellement,
// et la DEF réduit toujours les dégâts proportionnellement, sans effet de seuil brutal.
function rollDamage(attackerAtk, defenderDef) {
    const mitigation = attackerAtk / (attackerAtk + Math.max(0, defenderDef));
    const variance = 1 + (Math.random() * 0.3 - 0.15); // ±15%
    const damage = attackerAtk * mitigation * variance;
    return Math.max(1, Math.round(damage));
}

// Un clic sur "Attaquer" = un round complet (le joueur frappe, puis l'ennemi riposte s'il survit)
function fightRound() {
    if (!gameState.inCombat || !gameState.currentEnemy) return;
    const enemy = gameState.currentEnemy;

    // 1. Le joueur attaque
    const playerDamage = rollDamage(gameState.atk, enemy.def);
    enemy.hp -= playerDamage;
    logEvent(`Vous infligez ${playerDamage} dégâts à [${enemy.name}].`, "normal");

    if (enemy.hp <= 0) {
        logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
        winCombat();
        return;
    }

    // 2. L'ennemi riposte
    const enemyDamage = rollDamage(enemy.atk, gameState.def);
    gameState.hp -= enemyDamage;
    logEvent(`[${enemy.name}] vous inflige ${enemyDamage} dégâts.`, "danger");

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        gameOver();
        return;
    }

    updateUI();
}

function winCombat() {
    logEvent("Vous remportez le combat !", "success");
    // Chance d'obtenir du butin après un combat
    if (Math.random() * 100 < 40) { // 40% de chance de loot post-combat
        addLoot();
    }

    gameState.currentEnemy = null;
    gameState.inCombat = false;
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

    logEvent(`Heure ${gameState.maxTime - gameState.timeLeft} : Vous avancez dans les ténèbres...`);

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

// Clic sur le bouton Attaquer (un clic = un round de combat)
ui.btnAttack.addEventListener('click', fightRound);

// Clic sur l'export des logs Dev
ui.btnDevLogs.addEventListener('click', () => {
    console.log("--- LOGS DE DÉVELOPPEMENT ---");
    console.table(gameState);
    logEvent("Statistiques système exportées dans la console (F12).", "info");
});

// Lancement du jeu
updateUI();
updateInventoryUI();

