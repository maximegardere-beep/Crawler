/**
 * APP.JS - Moteur du Rogue-Like Textuel
 * Gère l'état, les probabilités et la mise à jour de l'interface.
 * Intègre la forge procédurale (bestiary.js et generator.js).
 */

// ==========================================
// 1. ÉTAT DU JEU (STATE)
// ==========================================
let gameState = {
    crawlerName: "Carl",
    hp: 100,
    maxHp: 100,
    timeLeft: 100, // 100 heures pour finir le niveau
    currentLevel: 1,
    currentDistrict: "Tunnels de Métro Abandonnés",
    inventory: [],
    maxInventory: 5,
    cardsDrawn: 0, 
    inCombat: false 
};

// Variable pour stocker le mob actif en cours de combat
let currentActiveMob = null;

// ==========================================
// CONFIGURATION DE L'INTERFACE (DOM Elements)
// ==========================================
const DOM = {
    name: document.getElementById('crawler-name'),
    hp: document.getElementById('hp-display'),
    level: document.getElementById('level-display'),
    district: document.getElementById('district-display'),
    time: document.getElementById('time-display'),
    log: document.getElementById('log-container'),
    inventory: document.getElementById('inventory-container'),
    
    btnAdvance: document.getElementById('btn-advance'),
    btnVictory: document.getElementById('btn-victory'),
    btnDefeat: document.getElementById('btn-defeat'),
    btnDevLog: document.getElementById('btn-dev-logs')
};

// ==========================================
// 2. BOUCLE DE GAMEPLAY & MÉCANIQUES
// ==========================================

function advanceTime() {
    if (gameState.timeLeft <= 0 || gameState.hp <= 0 || gameState.inCombat) return;

    gameState.timeLeft--;
    gameState.cardsDrawn++;
    
    updateUI();

    if (gameState.timeLeft <= 0) {
        triggerGameOver("Temps écoulé ! Le niveau s'est effondré sur vous.");
        return;
    }

    resolveCardEvent();
}

// ==========================================
// 3. MOTEUR DE PROBABILITÉS
// ==========================================

function resolveCardEvent() {
    const baseStairChance = (gameState.cardsDrawn * 1.5) / gameState.currentLevel; 
    const stairChance = Math.min(85, baseStairChance); 
    
    const rollStair = Math.random() * 100;

    if (rollStair <= stairChance) {
        handleStairsEncounter();
        return;
    }

    const rollEvent = Math.floor(Math.random() * 100) + 1;

    if (rollEvent <= 25) {
        addLog("Le silence du donjon est pesant. Rien à signaler.", "text-gray-400");
    } else if (rollEvent <= 50) {
        initiateCombat();
    } else if (rollEvent <= 65) {
        changeDistrict();
    } else if (rollEvent <= 75) {
        const heal = 20;
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + heal);
        addLog(`Salle sécurisée découverte. Vous vous reposez et récupérez ${heal} PV.`, "text-green-400");
        updateUI();
    } else if (rollEvent <= 76) {
        // Utilisation du générateur procédural d'objets de generator.js
        const item = generateItem();
        findItemObject(item);
    } else {
        addLog("Événement mineur : Vous déclenchez un piège inoffensif qui vous asperge de paillettes.", "text-blue-300");
    }
}

function handleStairsEncounter() {
    const guardedChance = 20;
    const rollGuard = Math.random() * 100;

    if (rollGuard <= guardedChance) {
        addLog("Vous trouvez l'escalier vers l'étage inférieur, mais il est GARDÉ !", "text-red-500 font-bold");
        initiateCombat();
    } else {
        addLog("Vous trouvez l'escalier ! Vous descendez au niveau suivant.", "text-yellow-400 font-bold");
        levelUp();
    }
}

function changeDistrict() {
    const districtKeys = typeof districts !== 'undefined' ? Object.keys(districts) : ["Tunnels de Métro Abandonnés", "Jardins Carnivores"];
    const randomDistrict = districtKeys[Math.floor(Math.random() * districtKeys.length)];
    gameState.currentDistrict = randomDistrict;
    addLog(`L'environnement change brutalement. Vous entrez dans : ${randomDistrict}.`, "text-purple-400");
    updateUI();
}

function findItemObject(item) {
    if (gameState.inventory.length < gameState.maxInventory) {
        gameState.inventory.push(item);
        addLog(`Objet obtenu : [${item.name}] (${item.type} - Stat: ${item.stat}) !`, "text-yellow-300 font-bold");
        updateInventoryUI();
    } else {
        addLog(`Vous trouvez [${item.name}], mais votre inventaire est plein !`, "text-red-400");
    }
}

// ==========================================
// 4. FONCTIONS DE COMBAT (CONNECTÉES AU BESTIAIRE)
// ==========================================

function initiateCombat() {
    gameState.inCombat = true;
    
    // Génération procédurale du mob en fonction du quartier actuel via generator.js
    currentActiveMob = typeof generateMob === 'function' ? generateMob(gameState.currentDistrict) : { name: "Rat Géant", hp: 20, atk: 8 };
    
    addLog(`COMBAT INITIÉ ! Un [${currentActiveMob.name}] féroce vous attaque ! (PV: ${currentActiveMob.hp} | ATK: ${currentActiveMob.atk})`, "text-red-500 font-bold");
    
    if(DOM.btnAdvance) DOM.btnAdvance.disabled = true;
    if(DOM.btnVictory) DOM.btnVictory.classList.remove('hidden');
    if(DOM.btnDefeat) DOM.btnDefeat.classList.remove('hidden');
}

function endCombat() {
    gameState.inCombat = false;
    currentActiveMob = null;
    
    if(DOM.btnAdvance) DOM.btnAdvance.disabled = false;
    if(DOM.btnVictory) DOM.btnVictory.classList.add('hidden');
    if(DOM.btnDefeat) DOM.btnDefeat.classList.add('hidden');
}

// Liée au bouton "Test Victoire" -> Génère un objet procédural via generator.js
function combatVictory() {
    if (!gameState.inCombat) return;
    
    const mobName = currentActiveMob ? currentActiveMob.name : "l'ennemi";
    addLog(`Victoire éclatante ! Vous avez éliminé : ${mobName}.`, "text-green-500 font-bold");
    
    // Utilisation du générateur d'objets procéduraux
    const generatedLoot = typeof generateItem === 'function' ? generateItem() : { name: "Épée Rouillée", type: "weapon", stat: 10 };
    findItemObject(generatedLoot);
    
    endCombat();
}

// Liée au bouton "Test Défaite"
function combatDefeat() {
    if (!gameState.inCombat) return;
    
    const damage = currentActiveMob ? currentActiveMob.atk : (Math.floor(Math.random() * 20) + 10);
    gameState.hp -= damage;
    addLog(`Défaite... Vous subissez ${damage} dégâts en fuyant.`, "text-red-400");
    
    updateUI();
    endCombat();

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        triggerGameOver("Vous avez succombé à vos blessures lors d'un combat.");
    }
}

// ==========================================
// 5. AFFICHAGE ET LOGIQUE GLOBALE
// ==========================================

function updateUI() {
    if(DOM.name) DOM.name.textContent = gameState.crawlerName;
    if(DOM.hp) DOM.hp.textContent = `${gameState.hp} / ${gameState.maxHp}`;
    if(DOM.level) DOM.level.textContent = `Niveau ${gameState.currentLevel}`;
    if(DOM.district) DOM.district.textContent = gameState.currentDistrict;
    if(DOM.time) DOM.time.textContent = `${gameState.timeLeft} H`;
    
    updateInventoryUI();
}

function updateInventoryUI() {
    if(DOM.inventory) {
        DOM.inventory.innerHTML = "";
        for (let i = 0; i < gameState.maxInventory; i++) {
            const slot = document.createElement('div');
            slot.className = "bg-gray-800 border border-gray-600 p-2 rounded text-xs flex items-center justify-center text-center overflow-hidden";
            
            if (i < gameState.inventory.length) {
                slot.textContent = gameState.inventory[i].name;
                slot.classList.add('text-yellow-400', 'font-semibold', 'border-yellow-900');
            } else {
                slot.textContent = "+";
                slot.classList.add('text-gray-600');
            }
            DOM.inventory.appendChild(slot);
        }
    }
}

function addLog(message, cssClasses = "text-white") {
    if(!DOM.log) return;
    
    const entry = document.createElement('p');
    entry.className = `mb-2 border-b border-gray-700 pb-1 ${cssClasses}`;
    entry.textContent = `> ${message}`;
    
    DOM.log.prepend(entry);
}

function levelUp() {
    gameState.currentLevel++;
    gameState.timeLeft = 100;
    gameState.cardsDrawn = 0;
    updateUI();
}

function triggerGameOver(reason) {
    addLog(`GAME OVER : ${reason}`, "text-red-600 font-black text-xl");
    if(DOM.btnAdvance) DOM.btnAdvance.disabled = true;
}

function showDevLogs() {
    console.log("=== DEV LOGS ===");
    console.table(gameState);
    alert("Stats exportées dans la console du navigateur (F12) !");
}

// ==========================================
// INITIALISATION
// ==========================================

if(DOM.btnAdvance) DOM.btnAdvance.addEventListener('click', advanceTime);
if(DOM.btnVictory) DOM.btnVictory.addEventListener('click', combatVictory);
if(DOM.btnDefeat) DOM.btnDefeat.addEventListener('click', combatDefeat);
if(DOM.btnDevLog) DOM.btnDevLog.addEventListener('click', showDevLogs);

if(DOM.btnVictory) DOM.btnVictory.classList.add('hidden');
if(DOM.btnDefeat) DOM.btnDefeat.classList.add('hidden');

updateUI();
addLog("Vous entrez dans le donjon. Le système enregistre votre progression. Appuyez sur Avancer.", "text-cyan-400");
