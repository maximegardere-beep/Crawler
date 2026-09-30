// urban-shops.js — tests régression : Villes spécialisées (marchand/professeur) : generateUrbanFloorMap()/ triggerShopEncounter()/buyShopItem()/trainSkill()/leaveShop() — villes explorables (chantier 12) : la boutique et le professeur sont des salles de leur ville.
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
        const um = gameState.floorMap;
        const start = um.citiesById[um.currentCityId];
        assert(start.id === um.roomsById[um.startRoomId].cityId, "generateUrbanFloorMap() : départ sur la place de la première ville");
        assert(start.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville de départ");
        Object.values(um.citiesById).forEach(city => {
            if (city.isStairs) {
                assert(city.role === null, "generateUrbanFloorMap() : jamais de rôle sur la ville gardienne");
            }
            const serviceRooms = city.roomIds.filter(id => ['shop', 'trainer'].includes(um.roomsById[id].type));
            assert(serviceRooms.length === (city.role ? 1 : 0), "generateUrbanFloorMap() : une salle de boutique ou de professeur seulement dans une ville qui en a le rôle");
            if (city.role === 'merchant') {
                assert(['weapons', 'ranged', 'armors', 'scrolls'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité marchand dans le bon pool (catégories d'objet)");
            } else if (city.role === 'trainer') {
                assert(['weapon', 'unarmed', 'magic', 'stealth'].includes(city.specialty),
                    "generateUrbanFloorMap() : spécialité professeur dans le bon pool (compétences réelles)");
            }
        });
        // Chantier "QoL/équilibrage" (Chantier D) : au moins un marchand ET un professeur garantis,
        // plus specializedCityChance ne gouvernant plus que les éventuelles villes supplémentaires.
        assert(Object.values(um.citiesById).some(c => c.role === 'merchant'), "generateUrbanFloorMap() : au moins une ville marchand garantie");
        assert(Object.values(um.citiesById).some(c => c.role === 'trainer'), "generateUrbanFloorMap() : au moins une ville professeur garantie");
    }
}

// generateShopStock() : 3 objets, tous de la catégorie forcée, chacun avec un prix > 0 dérivé de sa
// valeur (getItemValue(), voir SHOP_MARKUP).
{
    const stock = generateShopStock('armors');
    assert(stock.length === 3, "generateShopStock() : 3 objets générés");
    stock.forEach(item => {
        assert(item.category === 'armors', "generateShopStock() : catégorie forcée respectée");
        assert(item.price === Math.max(1, Math.round(getItemValue(item) * SHOP_MARKUP)),
            "generateShopStock() : prix = valeur × SHOP_MARKUP");
    });

    const scrollStock = generateShopStock('scrolls');
    scrollStock.forEach(item => {
        assert(item.category === 'scrolls', "generateShopStock() : catégorie 'scrolls' (parchemins) respectée aussi");
        // Chantier "QoL/équilibrage" (Chantier D) : un parchemin a une vraie valeur, donc un vrai prix
        // en boutique (pas le repli à 1 PO d'avant ce chantier).
        assert(getItemValue(item) > 0, "generateShopStock() : un parchemin a une valeur > 0 (Chantier D)");
        assert(item.price > Math.round(SHOP_MARKUP), "generateShopStock() : le prix d'un parchemin reflète sa valeur, pas le repli à 1");
    });
}

// triggerShopEncounter() : marque le choix en attente, affiche #shop-zone, ne régénère JAMAIS le
// stock d'un marchand déjà visité (stock fixe pour la partie).
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const merchantCity = { id: 'test-merchant', name: 'Testopolis', role: 'merchant', specialty: 'weapons', stock: null };
    gameState.floorMap.citiesById[merchantCity.id] = merchantCity;

    ui.shopZone.classList.add('hidden');
    triggerShopEncounter(merchantCity);
    assert(gameState.shopChoicePending === true, "triggerShopEncounter() : shopChoicePending activé");
    assert(gameState.pendingShopCityId === merchantCity.id, "triggerShopEncounter() : pendingShopCityId pointe sur la bonne ville");
    assert(ui.shopZone.classList.contains('hidden') === false, "triggerShopEncounter() : #shop-zone affiché");
    assert(merchantCity.stock.length === 3, "triggerShopEncounter() : stock généré à la première visite");
    assert(isActionBlocked() === true, "triggerShopEncounter() : isActionBlocked() true tant que le choix est en attente (masque la carte)");

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
    gameState.floorMap.citiesById[city.id] = city;
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

// sellSpell() (chantier "QoL/équilibrage", Chantier D) : vend un parchemin du grimoire au même ratio
// que sellItem() sur l'inventaire, retire l'entrée, jamais l'inventaire touché.
{
    resetTransientState();
    gameState.gold = 0;
    gameState.spellbook = [
        { name: "Parchemin A", category: 'scrolls', baseValue: 20 },
        { name: "Parchemin B", category: 'scrolls', baseValue: 10 }
    ];
    gameState.inventory = [];

    sellSpell(0);
    assert(gameState.gold === Math.max(1, Math.round(20 * SELL_VALUE_RATIO)), "sellSpell() : PO créditées au même ratio que sellItem()");
    assert(gameState.spellbook.length === 1, "sellSpell() : le parchemin vendu est retiré du grimoire");
    assert(gameState.spellbook[0].name === "Parchemin B", "sellSpell() : ne touche jamais aux autres entrées du grimoire");
    assert(gameState.inventory.length === 0, "sellSpell() : n'affecte jamais gameState.inventory");
}

// trainSkill() : coût = TRAINER_COST_PER_LEVEL × niveau ACTUEL, amène l'XP exactement au niveau
// suivant, refusé si PO insuffisantes.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const city = { id: 'test-trainer', name: 'Testville', role: 'trainer', specialty: 'magic' };
    gameState.floorMap.citiesById[city.id] = city;
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

// leaveShop() : referme #shop-zone et débloque les actions normales (la carte redevient
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

// enterRoom() sur la salle du professeur (ou du marchand) d'une ville : ouvre l'écran marchand/professeur
// plutôt qu'un événement de ville.
{
    resetTransientState();
    gameState.currentFloor = 3;
    generateUrbanFloorMap();
    const fm = gameState.floorMap;
    const room = Object.values(fm.roomsById).find(r => r.type === 'trainer');
    ui.shopZone.classList.add('hidden');
    moveToFloorRoom(room);
    enterRoom(room);
    assert(gameState.shopChoicePending === true && gameState.pendingShopCityId === room.cityId, "enterRoom() : la salle du professeur ouvre l'écran professeur de sa ville");
    assert(ui.shopZone.classList.contains('hidden') === false, "enterRoom() : #shop-zone affiché");
    leaveShop();
    const shop = Object.values(fm.roomsById).find(r => r.type === 'shop');
    moveToFloorRoom(shop);
    enterRoom(shop);
    assert(gameState.shopChoicePending === true && fm.citiesById[shop.cityId].stock.length === 3, "enterRoom() : la salle du marchand ouvre l'échoppe, stock généré");
    leaveShop();
}
