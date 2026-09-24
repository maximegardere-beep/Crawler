// urban-shops.js — tests régression : Villes spécialisées (marchand/professeur) : generateUrbanFloorMap()/ triggerShopEncounter()/buyShopItem()/trainSkill()/leaveShop().
// Extrait de l'ancien regression.test.js monolithique (Tâche 2, voir CLAUDE.md) : contenu inchangé, section(s) originale(s) L2681 du fichier d'origine, dans leur ordre relatif d'origine.
const { assert, resetTransientState } = require('./_helpers.js');
// ===================================================================
// Villes spécialisées (marchand/professeur) : generateUrbanFloorMap()/triggerShopEncounter()/
// buyShopItem()/trainSkill()/leaveShop(). Voir CLAUDE.md.
// ===================================================================

// generateUrbanFloorMap() : jamais de rôle sur la ville de départ ni sur la ville gardienne
// (escalier/Sortie) — un PNJ spécialisé ne se cumule jamais avec un gardien. Spécialité toujours
// dans le bon pool selon le rôle attribué.
{
    resetTransientState();
    gameState.currentFloor = 3;
    for (let i = 0; i < 20; i++) {
        generateUrbanFloorMap();
        const um = gameState.urbanMap;
        const start = um.citiesById[um.currentCityId];
        assert(start.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville de départ");
        Object.values(um.citiesById).forEach(city => {
            if (city.isStairs || city.isExit) {
                assert(city.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville gardienne");
            }
            if (city.role === 'merchant') {
                assert(['weapons', 'ranged', 'armors', 'scrolls'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité marchand dans le bon pool (catégories d'objet)");
            } else if (city.role === 'trainer') {
                assert(['weapon', 'unarmed', 'magic', 'stealth'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité professeur dans le bon pool (compétences réelles)");
            }
        });
    }
}

// generateShopStock() : 3 objets, tous de la catégorie forcée, chacun avec un prix > 0 dérivé de sa
// baseValue (voir SHOP_MARKUP).
{
    const stock = generateShopStock('armors');
    assert(stock.length === 3, "generateShopStock() : 3 objets générés");
    stock.forEach(item => {
        assert(item.category === 'armors', "generateShopStock() : catégorie forcée respectée");
        assert(item.price === Math.max(1, Math.round((item.baseValue || 1) * SHOP_MARKUP)),
            "generateShopStock() : prix = baseValue × SHOP_MARKUP");
    });

    const scrollStock = generateShopStock('scrolls');
    scrollStock.forEach(item => {
        assert(item.category === 'scrolls', "generateShopStock() : catégorie 'scrolls' (parchemins) respectée aussi");
    });
}

// triggerShopEncounter() : marque le choix en attente, affiche #shop-zone, ne régénère JAMAIS le
// stock d'un marchand déjà visité (stock fixe pour la partie).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const merchantCity = { id: 'test-merchant', name: 'Testopolis', role: 'merchant', specialty: 'weapons', stock: null };
    gameState.urbanMap.citiesById[merchantCity.id] = merchantCity;

    ui.shopZone.classList.add('hidden');
    triggerShopEncounter(merchantCity);
    assert(gameState.shopChoicePending === true, "triggerShopEncounter() : shopChoicePending activé");
    assert(gameState.pendingShopCityId === merchantCity.id, "triggerShopEncounter() : pendingShopCityId pointe sur la bonne ville");
    assert(ui.shopZone.classList.contains('hidden') === false, "triggerShopEncounter() : #shop-zone affiché");
    assert(merchantCity.stock.length === 3, "triggerShopEncounter() : stock généré à la première visite");
    assert(isActionBlocked() === true, "triggerShopEncounter() : isActionBlocked() true tant que le choix est en attente (masque la Carte Urbaine)");

    const stockBefore = merchantCity.stock;
    triggerShopEncounter(merchantCity); // Seconde visite
    assert(merchantCity.stock === stockBefore, "triggerShopEncounter() : stock JAMAIS régénéré sur une visite ultérieure");
}

// buyShopItem() : achat normal (déduit le prix, retire du stock, ajoute à l'inventaire), refusé si
// PO insuffisantes ou réserve d'équipement pleine ; un parchemin rejoint le grimoire plutôt que
// l'inventaire.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    gameState.inventory = []; // resetTransientState() ne touche pas l'inventaire : jamais implicite ici
    const city = { id: 'test-merchant-2', name: 'Testburg', role: 'merchant', specialty: 'weapons', stock: null };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingShopCityId = city.id;
    city.stock = [{ name: "Épée test", category: 'weapons', price: 50, baseValue: 20 }];
    gameState.gold = 10;

    buyShopItem(0);
    assert(city.stock.length === 1, "buyShopItem() : achat refusé si PO insuffisantes (stock inchangé)");
    assert(gameState.gold === 10, "buyShopItem() : PO inchangées si achat refusé");

    gameState.gold = 100;
    buyShopItem(0);
    assert(gameState.gold === 50, "buyShopItem() : prix déduit des PO");
    assert(city.stock.length === 0, "buyShopItem() : objet retiré du stock");
    assert(gameState.inventory.some(i => i.name === "Épée test"), "buyShopItem() : objet ajouté à l'inventaire");

    // Réserve d'équipement pleine
    city.stock = [{ name: "Hache test", category: 'weapons', price: 10, baseValue: 5 }];
    gameState.inventory = [];
    for (let i = 0; i < gameState.maxInventory; i++) {
        gameState.inventory.push({ name: `Filler ${i}`, category: 'weapons' });
    }
    buyShopItem(0);
    assert(city.stock.length === 1, "buyShopItem() : achat refusé si réserve d'équipement pleine");

    // Parchemin : rejoint le grimoire, jamais l'inventaire, jamais limité
    gameState.inventory = [];
    city.stock = [{ name: "Parchemin test", category: 'scrolls', price: 10, baseValue: 5 }];
    gameState.spellbook = [];
    buyShopItem(0);
    assert(gameState.spellbook.some(i => i.name === "Parchemin test"), "buyShopItem() : parchemin ajouté au grimoire");
    assert(gameState.inventory.length === 0, "buyShopItem() : parchemin jamais ajouté à l'inventaire");
}

// trainSkill() : coût = TRAINER_COST_PER_LEVEL × niveau ACTUEL, amène l'XP exactement au niveau
// suivant, refusé si PO insuffisantes.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const city = { id: 'test-trainer', name: 'Testville', role: 'trainer', specialty: 'magic' };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingShopCityId = city.id;
    gameState.skills.magic = { level: 3, xp: 5, xpToNext: 40 };

    gameState.gold = 10; // Coût attendu : 20 × 3 = 60, insuffisant
    trainSkill();
    assert(gameState.skills.magic.level === 3, "trainSkill() : formation refusée si PO insuffisantes (niveau inchangé)");
    assert(gameState.gold === 10, "trainSkill() : PO inchangées si formation refusée");

    gameState.gold = 100;
    trainSkill();
    assert(gameState.gold === 40, "trainSkill() : coût (20 × niveau actuel) déduit des PO");
    assert(gameState.skills.magic.level === 4, "trainSkill() : franchit exactement le niveau suivant");
    assert(gameState.skills.magic.xp === 0, "trainSkill() : XP exactement consommée jusqu'au niveau suivant, rien de plus");
}

// leaveShop() : referme #shop-zone et débloque les actions normales (Carte Urbaine redevient
// visible via isActionBlocked()).
{
    resetTransientState();
    gameState.shopChoicePending = true;
    gameState.pendingShopCityId = 'whatever';
    ui.shopZone.classList.remove('hidden');

    leaveShop();
    assert(gameState.shopChoicePending === false, "leaveShop() : shopChoicePending désactivé");
    assert(gameState.pendingShopCityId === null, "leaveShop() : pendingShopCityId réinitialisé");
    assert(ui.shopZone.classList.contains('hidden') === true, "leaveShop() : #shop-zone masqué");
    assert(isActionBlocked() === false, "leaveShop() : isActionBlocked() redevient false");
}

// arriveAtCity() : une ville avec un rôle déclenche l'écran marchand/professeur plutôt que
// l'arrivée "ville sûre" générique.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const city = { id: 'test-dispatch', name: 'Dispatchville', role: 'trainer', specialty: 'weapon', known: false, visited: false, roads: [] };
    gameState.urbanMap.citiesById[city.id] = city;
    gameState.pendingUrbanTravel = { destinationCityId: city.id, ambushesRemaining: 0 };
    ui.shopZone.classList.add('hidden');

    arriveAtCity();
    assert(gameState.shopChoicePending === true, "arriveAtCity() : dispatch vers triggerShopEncounter() pour une ville avec un rôle");
    assert(ui.shopZone.classList.contains('hidden') === false, "arriveAtCity() : #shop-zone affiché après dispatch");
}
