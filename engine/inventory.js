// engine/inventory.js — Barre d'icônes, équipement, consommables, inspection d'objet.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ---------- Barre d'icônes et panneaux d'inventaire (chantier 9 « interface inventaire allégée ») ----------
// #bottom-nav (fixée en bas, masquée en combat) ouvre trois panneaux : Équipement porté, Sac (réserve +
// consommables) et Grimoire. Une pastille signale un objet ou un sort nouveau (`item.isNew`, posé par
// storeLootItem(), retiré à l'ouverture du panneau correspondant — l'objet garde sa mention « Nouveau »
// tant que le panneau reste ouvert). Le panneau ouvert est une préférence d'affichage (variable de module).
const INVENTORY_SHEETS = { equipment: 'equipmentSheet', bag: 'bagSheet', spellbook: 'spellbookSheet' };
let openInventorySheetName = null;

function hasNewBagItems() {
    return gameState.inventory.some(item => item && item.isNew);
}

function hasNewSpells() {
    return gameState.spellbook.some(spell => spell && spell.isNew);
}

function updateBottomNav() {
    if (!ui.bottomNav) return;
    const hidden = !!gameState.inCombat;
    ui.bottomNav.classList.toggle('hidden', hidden);
    if (hidden && openInventorySheetName) closeInventorySheets();
    if (ui.navBagCount) {
        const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
        ui.navBagCount.innerText = `${equipmentCount}/${gameState.maxInventory}`;
    }
    if (ui.navBagDot) ui.navBagDot.classList.toggle('hidden', !hasNewBagItems());
    if (ui.navSpellbookDot) ui.navSpellbookDot.classList.toggle('hidden', !hasNewSpells());
}

function openInventorySheet(name) {
    if (!INVENTORY_SHEETS[name] || gameState.inCombat) return false;
    closeInventorySheets();
    if (name === 'spellbook') updateSpellbookUI(); else updateInventoryUI();
    const sheet = ui[INVENTORY_SHEETS[name]];
    if (sheet) sheet.classList.remove('hidden');
    openInventorySheetName = name;
    // Vu : la pastille disparaît (les cartes déjà affichées gardent leur mention « Nouveau »).
    if (name === 'bag') gameState.inventory.forEach(item => { if (item && item.isNew) delete item.isNew; });
    if (name === 'spellbook') gameState.spellbook.forEach(spell => { if (spell && spell.isNew) delete spell.isNew; });
    updateBottomNav();
    return true;
}

function closeInventorySheets() {
    Object.values(INVENTORY_SHEETS).forEach(key => { if (ui[key]) ui[key].classList.add('hidden'); });
    openInventorySheetName = null;
}

function toggleMapPanel(forceOpen) {
    mapPanelOpen = forceOpen === undefined ? !mapPanelOpen : !!forceOpen;
    updateUI();
}

// Fonction pour mettre à jour l'inventaire visuel
function updateInventoryUI() {
    const equipmentCount = gameState.inventory.filter(i => i.category !== 'consumables').length;
    ui.inventoryCount.innerText = equipmentCount;
    if (ui.inventoryMax) ui.inventoryMax.innerText = gameState.maxInventory;
    updateBottomNav();
    // Objets équipés : icône (même dessin que sur le crawler, voir itemIconSvg() dans scene.js) + nom.
    const equippedLabel = (item) => item
        ? `<span class="inline-flex items-center gap-1 align-middle">${itemIconSvg(item, 22)}<span>${formatItemDisplayName(item)}</span></span>`
        : "Aucune";
    ui.equippedWeapon.innerHTML = equippedLabel(gameState.equipment.weapon);
    ui.equippedArmor.innerHTML = equippedLabel(gameState.equipment.armor);
    if (ui.equippedArmorBadges) {
        // Qualificatifs de TOUT l'équipement porté (arme, distance, armure), pas seulement de l'armure.
        ui.equippedArmorBadges.innerHTML = ['weapon', 'ranged', 'armor']
            .map(slot => buildQualifierBadgesHtml(gameState.equipment[slot]))
            .join('');
    }
    if (ui.equippedRanged) ui.equippedRanged.innerHTML = equippedLabel(gameState.equipment.ranged);

    // --- Armes / armures / armes à distance : cartes façon carte à jouer, dans le déroulant ---
    ui.inventoryEquipmentCards.innerHTML = "";
    const equipmentIndices = [];
    gameState.inventory.forEach((item, i) => { if (item.category === 'weapons' || item.category === 'armors' || item.category === 'ranged') equipmentIndices.push(i); });

    if (equipmentIndices.length === 0) {
        const empty = document.createElement('p');
        empty.className = "col-span-2 text-[10px] text-gray-600 italic";
        empty.innerText = "Aucune arme ni armure en réserve.";
        ui.inventoryEquipmentCards.appendChild(empty);
    } else {
        equipmentIndices.forEach(i => {
            const item = gameState.inventory[i];
            const isWeapon = item.category === 'weapons';
            const isRanged = item.category === 'ranged';
            const icon = isWeapon ? '⚔️' : (isRanged ? '🏹' : '🛡️');
            const rarityColor = item.rarityColor || "#57534e"; // gris par défaut (objets pré-existants sans rareté)
            const card = document.createElement('div');
            card.className = "mini-card rounded-lg p-2 flex flex-col gap-1 text-center relative";
            card.style.borderColor = rarityColor;
            card.style.borderWidth = "2px";
            const statLine = (isWeapon || isRanged) ? `⚔️ ATK +${item.baseDmg}` : `🛡️ DEF +${item.baseArmor}`;
            // Badges de qualificatifs (arme, distance ou armure), effet exact en infobulle.
            const armorBadges = buildQualifierBadgesHtml(item);
            card.innerHTML = `
                ${item.isNew ? '<span class="absolute top-1 left-1 px-1 rounded bg-amber-400 text-[7px] font-black uppercase text-gray-900">Nouveau</span>' : ''}
                <div class="flex justify-center leading-none">${itemIconSvg(item, 40) || `<span class="text-xl">${icon}</span>`}</div>
                <div class="text-[10px] font-bold leading-tight">${item.name}</div>
                ${item.rarity ? `<div class="text-[8px] font-bold uppercase tracking-wider" style="color:${rarityColor}">${item.rarity}</div>` : ""}
                <div class="text-[9px] text-stone-600">${statLine}</div>
                ${armorBadges ? `<div class="flex gap-1 flex-wrap justify-center text-[8px]">${armorBadges}</div>` : ""}
                <button data-action="equip" class="mt-1 text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>
                <button data-action="discard" class="absolute top-1 right-1 text-[10px] text-red-700 hover:text-red-500" title="Jeter">🗑️</button>
            `;
            card.querySelector('[data-action="equip"]').addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); equipItem(i); });
            card.querySelector('[data-action="discard"]').addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); discardItem(i); });
            // Toucher la carte (hors boutons) : inspection détaillée, avec les mêmes actions.
            card.classList.add('cursor-pointer');
            card.addEventListener('click', () => openItemInspect(item, { actions: [
                { label: 'Équiper', onClick: () => equipItem(i) },
                ...companionGiveAction(() => giveItemToCompanion(i)),
                { label: 'Jeter', tone: 'danger', onClick: () => discardItem(i) }
            ] }));
            ui.inventoryEquipmentCards.appendChild(card);
        });
    }

    // --- Consommables : icône seule, à la fois dans la barre de raccourci ET dans le déroulant ---
    const consumableIndices = [];
    gameState.inventory.forEach((item, i) => { if (item.category === 'consumables') consumableIndices.push(i); });

    function buildConsumableIcon(i, withDiscard) {
        const item = gameState.inventory[i];
        const wrap = document.createElement('div');
        wrap.className = "relative";
        const btn = document.createElement('button');
        btn.className = "w-9 h-9 flex items-center justify-center bg-gray-950 border rounded hover:brightness-125";
        // Fiole à la couleur de ce que l'objet rend (voir consumableFlaskKind() dans scene.js) : rouge = PV,
        // bleu = mana, moitié-moitié = les deux ; la bordure du bouton reprend la même couleur.
        btn.style.borderColor = CONSUMABLE_FLASKS[consumableFlaskKind(item)].border;
        btn.innerHTML = itemIconSvg(item, 28);
        btn.title = `${item.name} — toucher pour utiliser`;
        btn.addEventListener('click', () => useConsumable(i));
        wrap.appendChild(btn);
        if (withDiscard) {
            const trash = document.createElement('button');
            trash.className = "absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-gray-900 border border-red-800 rounded-full text-[8px] text-red-500 hover:text-red-300";
            trash.innerText = "×";
            trash.title = "Jeter";
            trash.addEventListener('click', (e) => { e.stopPropagation(); discardItem(i); });
            wrap.appendChild(trash);
        }
        return wrap;
    }

    ui.consumableQuickbar.innerHTML = "";
    ui.inventoryConsumablesIcons.innerHTML = "";
    if (consumableIndices.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun consommable.";
        ui.inventoryConsumablesIcons.appendChild(empty);
    } else {
        consumableIndices.forEach(i => {
            ui.consumableQuickbar.appendChild(buildConsumableIcon(i, false));
            ui.inventoryConsumablesIcons.appendChild(buildConsumableIcon(i, true));
        });
    }
}

// Regroupe les parchemins par sort (`spellName`) pour l'affichage du grimoire et de la boutique : un
// seul emplacement par sort, qui cumule toutes ses raretés. Les données restent une simple liste
// d'exemplaires (gameState.spellbook) — chaque exemplaire garde son `index` dans cette liste, pour
// s'équiper ou se vendre séparément. `equipped` (facultatif) : sort équipé, ajouté à son groupe avec
// `index: -1` (jamais vendable, voir sellSpell()). Groupes dans l'ordre de première apparition (le
// sort équipé d'abord) ; exemplaires de la rareté la plus haute à la plus basse, puis par dégâts.
const RARITY_RANK = Object.fromEntries(itemRarities.map((r, i) => [r.name, i]));
function groupSpellbook(spellbook, equipped = null) {
    const groups = [];
    const byName = {};
    const add = (spell, index) => {
        const key = spell.spellName || spell.name;
        if (!byName[key]) {
            byName[key] = { spellName: key, icon: spell.icon, spellCategory: spell.spellCategory, copies: [] };
            groups.push(byName[key]);
        }
        byName[key].copies.push({ spell, index, equipped: index === -1 });
    };
    if (equipped) add(equipped, -1);
    spellbook.forEach((spell, i) => add(spell, i));
    groups.forEach(g => g.copies.sort((a, b) =>
        (RARITY_RANK[b.spell.rarity] || 0) - (RARITY_RANK[a.spell.rarity] || 0) || (b.spell.baseDmg || 0) - (a.spell.baseDmg || 0)));
    return groups;
}

// Ligne de stats d'un exemplaire de sort (grimoire et boutique).
function spellCopyStats(spell) {
    const effect = spell.spellEffect && SPELL_EFFECTS[spell.spellEffect.kind];
    const main = spell.spellCategory === 'any' ? `${effect ? effect.label : 'Utilitaire'}${spell.spellEffect && spell.spellEffect.kind === 'heal' ? ` ${spell.spellEffect.pct} %` : ''}` : `⚔️ +${spell.baseDmg}${effect ? ` · ${effect.label}` : ''}`;
    return `${main} · 🔷 ${getSpellManaCost(spell)}`;
}

// Portée d'un sort (chantier 11 : `any` = utilitaire, utilisable à toute distance).
function spellRangeLabel(category) {
    return category === 'melee' ? "Corps à corps" : category === 'any' ? "Partout" : "À distance";
}

// Grimoire : une carte par sort (groupSpellbook()), une ligne par exemplaire — rareté, dégâts, coût en
// mana et bouton "Équiper" (voir equipSpell()) ; l'exemplaire équipé y figure avec la mention "Équipé".
// Inventaire séparé de l'équipement classique, jamais limité (voir addLoot()).
function updateSpellbookUI() {
    const spellLabel = gameState.equipment.spell ? formatItemDisplayName(gameState.equipment.spell) : "Aucun";
    if (ui.equippedSpell) ui.equippedSpell.innerText = spellLabel;
    if (ui.equippedSpellSheet) ui.equippedSpellSheet.innerText = spellLabel;
    updateBottomNav();
    if (!ui.spellbookCards) return;

    ui.spellbookCards.innerHTML = "";
    const groups = groupSpellbook(gameState.spellbook, gameState.equipment.spell);
    if (groups.length === 0) {
        const empty = document.createElement('p');
        empty.className = "text-[10px] text-gray-600 italic";
        empty.innerText = "Aucun parchemin appris pour l'instant.";
        ui.spellbookCards.appendChild(empty);
        return;
    }

    groups.forEach(group => {
        const best = group.copies[0].spell;
        const categoryLabel = spellRangeLabel(group.spellCategory);
        const card = document.createElement('div');
        card.className = "mini-card rounded-lg p-2 flex flex-col gap-1";
        card.style.borderColor = best.rarityColor || "#57534e";
        card.style.borderWidth = "2px";
        const rows = group.copies.map((copy, i) => {
            const color = copy.spell.rarityColor || "#57534e";
            const action = copy.equipped
                ? `<span class="shrink-0 text-[9px] uppercase tracking-wider font-bold text-emerald-700 px-2">Équipé</span>`
                : `<button data-copy="${i}" class="shrink-0 min-h-[32px] text-[9px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">Équiper</button>`;
            return `<div data-inspect="${i}" class="flex items-center gap-2 border-t border-stone-300 pt-1 cursor-pointer">
                <span class="text-[8px] font-bold uppercase tracking-wider w-16 shrink-0" style="color:${color}">${copy.spell.rarity || ''}</span>
                <span class="flex-1 text-[9px] text-stone-600">${spellCopyStats(copy.spell)}</span>
                ${action}
            </div>`;
        }).join('');
        card.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xl leading-none">${group.icon || '✨'}</span>
                <span class="flex-1 min-w-0">
                    <span class="block text-[10px] font-bold leading-tight">${group.spellName}${group.copies.some(c => c.spell.isNew) ? ' <span class="ml-1 px-1 rounded bg-purple-400 text-[7px] font-black uppercase text-gray-900 align-middle">Nouveau</span>' : ''}</span>
                    <span class="block text-[9px] text-stone-500">${categoryLabel}${group.copies.length > 1 ? ` · ${group.copies.length} exemplaires` : ''}</span>
                </span>
            </div>
            ${rows}
        `;
        group.copies.forEach((copy, i) => {
            // Toucher la ligne d'un exemplaire : inspection (le bouton Équiper reste un raccourci).
            const row = card.querySelector(`[data-inspect="${i}"]`);
            if (row) row.addEventListener('click', () => openItemInspect(copy.spell, copy.equipped ? { compareTo: null } : { actions: [
                { label: 'Équiper', onClick: () => equipSpell(copy.index) },
                ...companionGiveAction(() => giveSpellToCompanion(copy.index))
            ] }));
            if (copy.equipped) return;
            const btn = card.querySelector(`[data-copy="${i}"]`);
            if (btn) btn.addEventListener('click', (e) => { if (e && e.stopPropagation) e.stopPropagation(); equipSpell(copy.index); });
        });
        ui.spellbookCards.appendChild(card);
    });
}

// ==========================================
// SYSTÈME D'ÉQUIPEMENT ET DE CONSOMMABLES
// ==========================================

// Retire un objet de l'inventaire sans l'utiliser ni l'équiper (bouton 🗑️)
function discardItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;
    gameState.inventory.splice(index, 1);
    logEvent(`Vous jetez [${item.name}].`, "info");
    updateInventoryUI();
}

// Équipe une arme ou une armure. L'éventuel équipement précédent retourne dans l'inventaire
// (jamais de perte d'objet lors d'un changement d'équipement).
// Nom d'affichage d'un objet : ajoute son palier de rareté entre crochets s'il n'est pas Commun
// (ex: "[Épique] Hache à Viande Tranchant et Lourd"), sinon le nom brut.
// Badges de qualificatifs d'un objet (voir itemQualifiers dans items.js) : icône + nom + rang, en rouge
// pour un défaut de Camelote. L'infobulle native (`title`) donne l'effet exact, chiffres compris —
// le même texte que le panneau d'inspection (describeQualifier()).
function buildQualifierBadgesHtml(item) {
    const target = item ? (qualifierTarget(item.category) || 'weapon') : null;
    return getItemQualifierList(item).map(({ key, rank }) => {
        const q = itemQualifiers[key];
        if (!q) return '';
        const cls = q.kind === 'malus'
            ? 'bg-red-100 border-red-400 text-red-800'
            : 'bg-amber-100 border-amber-400 text-amber-800';
        const title = escapeHtmlAttr(`${formatQualifierLabel(key, rank)} — ${describeQualifier(key, target, rank)}`);
        return `<span class="px-1 py-0.5 rounded border ${cls}" title="${title}">${q.icon} ${formatQualifierLabel(key, rank)}</span>`;
    }).join('');
}

function escapeHtmlAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ==========================================
// INSPECTION D'UN OBJET (chantier "refonte des objets", étape 7)
// ==========================================
// Tout ce qu'il faut pour décider : stats, rareté, niveau d'objet, chaque qualificatif avec son effet
// exact (describeQualifier(), la même source que le moteur), valeur marchande, et comparaison chiffrée
// avec l'objet porté au même emplacement. Ouvert depuis l'inventaire, l'équipement porté, le grimoire et
// la boutique (où l'achat/la vente passent désormais par ce panneau : plus de vente d'un toucher).

const ITEM_CATEGORY_LABELS = { weapons: "Arme de mêlée", ranged: "Arme à distance", armors: "Armure", consumables: "Consommable", scrolls: "Parchemin de sort" };
const EQUIPMENT_SLOT_BY_CATEGORY = { weapons: 'weapon', ranged: 'ranged', armors: 'armor', scrolls: 'spell' };

// Stats chiffrées d'un objet, comparables entre deux objets de même catégorie. `better` : 'up' si une
// valeur plus haute est meilleure, 'down' si plus basse (coût en mana).
function describeItemStats(item) {
    if (!item) return [];
    const stats = [];
    if (item.category === 'scrolls') {
        if (item.spellCategory !== 'any') stats.push({ key: 'dmg', icon: '⚔️', label: 'Dégâts', value: item.baseDmg || 0, prefix: '+', better: 'up' });
        stats.push({ key: 'mana', icon: '🔷', label: 'Coût en mana', value: getSpellManaCost(item), better: 'down' });
        return stats;
    }
    if (item.baseDmg !== undefined) stats.push({ key: 'dmg', icon: '⚔️', label: 'Dégâts', value: item.baseDmg, prefix: '+', better: 'up' });
    if (item.baseArmor !== undefined) stats.push({ key: 'armor', icon: '🛡️', label: 'Armure', value: item.baseArmor, prefix: '+', better: 'up' });
    if (item.heal > 0) stats.push({ key: 'heal', icon: '💚', label: 'Soin', value: item.heal, suffix: ' PV', better: 'up' });
    if (item.mana > 0) stats.push({ key: 'manaGain', icon: '🔷', label: 'Mana rendu', value: item.mana, better: 'up' });
    return stats;
}

// Objet porté au même emplacement (null pour un consommable, ou si c'est l'objet lui-même).
function getEquippedCounterpart(item) {
    const slot = item && EQUIPMENT_SLOT_BY_CATEGORY[item.category];
    const equipped = slot ? gameState.equipment[slot] : null;
    return equipped && equipped !== item ? equipped : null;
}

function formatStatDelta(stat, otherValue) {
    const diff = stat.value - otherValue;
    if (diff === 0) return `<span class="text-gray-500">= identique</span>`;
    const good = stat.better === 'down' ? diff < 0 : diff > 0;
    const arrow = diff > 0 ? '▲' : '▼';
    return `<span class="${good ? 'text-emerald-400' : 'text-red-400'}">${arrow} ${diff > 0 ? '+' : '−'}${Math.abs(diff)}</span>`;
}

// HTML du panneau (fonction pure, sans DOM). `options.compareTo` : objet de comparaison (par défaut
// celui porté au même emplacement) ; `options.priceLine` : ligne de prix du contexte (boutique).
function buildItemInspectHtml(item, options = {}) {
    if (!item) return '';
    const compareTo = options.compareTo !== undefined ? options.compareTo : getEquippedCounterpart(item);
    const target = qualifierTarget(item.category);
    const rarityColor = item.rarityColor || '#9ca3af';
    const icon = itemIconSvg(item, 56) || `<span class="text-4xl leading-none">${item.icon || '✨'}</span>`;
    const level = item.itemLevel ? ` · Niveau d'objet ${item.itemLevel}` : '';
    const categoryLabel = ITEM_CATEGORY_LABELS[item.category] || '';
    const spellKind = item.category === 'scrolls' ? ` · ${spellRangeLabel(item.spellCategory).toLowerCase()}` : '';

    const otherStats = Object.fromEntries(describeItemStats(compareTo).map(s => [s.key, s.value]));
    const statsHtml = describeItemStats(item).map(stat => {
        const delta = compareTo && otherStats[stat.key] !== undefined ? ` ${formatStatDelta(stat, otherStats[stat.key])}` : '';
        return `<li class="flex justify-between gap-2"><span>${stat.icon} ${stat.label}</span><span class="font-bold text-gray-100">${stat.prefix || ''}${stat.value}${stat.suffix || ''}${delta}</span></li>`;
    }).join('');

    const spellEffectText = item.category === 'scrolls' ? describeSpellEffect(item.spellEffect) : '';
    const spellEffectHtml = spellEffectText
        ? `<div class="border-l-2 pl-2 border-purple-500"><p class="font-bold text-purple-200">${item.icon || '✨'} Effet du sort</p><p class="text-gray-400">${spellEffectText}</p></div>`
        : '';
    const qualifiers = getItemQualifierList(item);
    const qualifiersHtml = spellEffectHtml + (qualifiers.length > 0
        ? qualifiers.map(({ key, rank }) => {
            const q = itemQualifiers[key];
            if (!q) return '';
            const malus = q.kind === 'malus';
            return `<div class="border-l-2 pl-2 ${malus ? 'border-red-600' : 'border-amber-500'}">
                <p class="font-bold ${malus ? 'text-red-300' : 'text-amber-200'}">${q.icon} ${formatQualifierLabel(key, rank)}${malus ? ' <span class="text-[9px] uppercase tracking-wider text-red-400">défaut</span>' : ''}</p>
                <p class="text-gray-400">${describeQualifier(key, target || 'weapon', rank)}</p>
            </div>`;
        }).join('')
        : `<p class="text-gray-500 italic">${item.category === 'consumables' ? 'Un consommable ne porte jamais de qualificatif.' : 'Aucun qualificatif.'}</p>`);

    const value = getItemValue(item);
    const forgedHtml = item.forgedByPerfect ? `<p class="text-amber-300 italic">🔥 Forgée par un combat parfait : un qualificatif de plus.</p>` : '';
    const valueHtml = forgedHtml + `<p class="text-gray-400">💰 Valeur : <span class="text-yellow-300 font-bold">${value} PO</span> · revente <span class="text-emerald-300 font-bold">${getSellPrice(item)} PO</span></p>`;
    const priceHtml = options.priceLine ? `<p class="text-gray-300 font-bold">${options.priceLine}</p>` : '';

    const compareHtml = compareTo
        ? `<div class="border-t border-gray-800 pt-2">
            <p class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Actuellement porté</p>
            <p class="text-gray-300">${formatItemDisplayName(compareTo)}</p>
            ${getItemQualifierList(compareTo).length > 0 ? `<div class="flex gap-1 flex-wrap text-[9px] mt-1">${buildQualifierBadgesHtml(compareTo)}</div>` : ''}
        </div>`
        : '';

    return `<div class="flex items-center gap-3">
            <div class="shrink-0 w-14 h-14 flex items-center justify-center rounded-lg bg-gray-950 border" style="border-color:${rarityColor}">${icon}</div>
            <div class="min-w-0">
                <p class="font-bold text-sm text-gray-100 leading-tight">${item.name}</p>
                <p class="text-[10px] uppercase tracking-wider font-bold" style="color:${rarityColor}">${item.rarity || 'Commun'}${level}</p>
                <p class="text-[10px] text-gray-500">${categoryLabel}${spellKind}</p>
            </div>
        </div>
        ${statsHtml ? `<ul class="flex flex-col gap-0.5 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5">${statsHtml}</ul>` : ''}
        <div class="flex flex-col gap-1.5">${qualifiersHtml}</div>
        ${valueHtml}${priceHtml}
        ${compareHtml}`;
}

// Ouvre le panneau d'inspection. `options.actions` : [{ label, onClick, disabled, tone }] — chaque
// action referme le panneau avant de s'exécuter. Un bouton « Fermer » est toujours ajouté.
function openItemInspect(item, options = {}) {
    if (!item || !ui.itemInspectOverlay) return;
    ui.itemInspectBody.innerHTML = buildItemInspectHtml(item, options);
    if (ui.itemInspectPanel) ui.itemInspectPanel.style.borderColor = item.rarityColor || '#374151';
    renderInspectActions(options.actions || []);
    ui.itemInspectOverlay.classList.remove('hidden');
}

// Boutons du panneau d'inspection (objet ou fiche compagnon) : chaque action referme le panneau avant
// de s'exécuter ; un bouton « Fermer » est toujours ajouté.
function renderInspectActions(actions) {
    ui.itemInspectActions.innerHTML = '';
    const tones = {
        primary: 'bg-amber-900/40 border-amber-600 text-amber-200 hover:bg-amber-800/50',
        good: 'bg-emerald-900/40 border-emerald-600 text-emerald-200 hover:bg-emerald-800/50',
        danger: 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/50',
        neutral: 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
    };
    [...actions, { label: 'Fermer', tone: 'neutral' }].forEach(action => {
        const btn = document.createElement('button');
        btn.className = `w-full min-h-[44px] py-2 border-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${tones[action.tone || 'primary']}`;
        btn.innerText = action.label;
        btn.disabled = !!action.disabled;
        btn.addEventListener('click', () => {
            closeItemInspect();
            if (action.onClick) action.onClick();
        });
        ui.itemInspectActions.appendChild(btn);
    });
}

function closeItemInspect() {
    if (ui.itemInspectOverlay) ui.itemInspectOverlay.classList.add('hidden');
}

// Objet porté (arme, distance, armure, sort) : inspection seule, rien à comparer.
function inspectEquippedSlot(slot) {
    const item = gameState.equipment[slot];
    if (item) openItemInspect(item, { compareTo: null });
}

function formatItemDisplayName(item) {
    if (!item) return "Aucune";
    return item.rarity && item.rarity !== "Commun" ? `[${item.rarity}] ${item.name}` : item.name;
}

function equipItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const slot = item.category === 'weapons' ? 'weapon' : (item.category === 'ranged' ? 'ranged' : 'armor');
    const slotLabel = slot === 'weapon' ? 'Arme' : (slot === 'ranged' ? 'Arme à distance' : 'Armure');
    const previouslyEquipped = gameState.equipment[slot];

    gameState.equipment[slot] = item;
    gameState.inventory.splice(index, 1);
    if (previouslyEquipped) {
        gameState.inventory.push(previouslyEquipped);
    }

    logEvent(`Vous équipez [${formatItemDisplayName(item)}] (${slotLabel}).`, "info");
    if (slot !== 'armor') endStarterBuff(); // Foutu pour foutu (chantier 14) : saute au premier équipement hors armure
    recordRunEvent('equip', { item });
    if (slot === 'armor') recomputeMaxHp(); // Robuste : les PV max dépendent de l'armure portée
    updateUI();
    updateInventoryUI();
}

// Équipe un sort depuis le grimoire (gameState.spellbook). Même principe que equipItem() : l'éventuel
// sort déjà équipé retourne dans le grimoire (jamais de perte). La toute première fois qu'un sort est
// équipé, la barre de mana apparaît pleine (comme les PV au niveau 1) — les équipements suivants ne
// la réinitialisent pas.
function equipSpell(index) {
    const spell = gameState.spellbook[index];
    if (!spell) return;

    const previouslyEquipped = gameState.equipment.spell;
    gameState.equipment.spell = spell;
    gameState.spellbook.splice(index, 1);
    if (previouslyEquipped) {
        gameState.spellbook.push(previouslyEquipped);
    } else {
        gameState.mana = gameState.maxMana;
    }

    logEvent(`Vous équipez le sort [${formatItemDisplayName(spell)}].`, "info");
    endStarterBuff(); // Foutu pour foutu (chantier 14)
    updateUI();
    updateSpellbookUI();
}

// Consomme un objet de type consommable : soigne et/ou restaure du mana, puis disparaît de
// l'inventaire. `mana` (voir items.js) n'a d'effet visible que si un sort est équipé, exactement
// comme la barre de mana elle-même — mais reste consommé normalement dans le cas contraire.
function useConsumable(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const healAmount = item.heal || 0;
    const manaAmount = item.mana || 0;
    const actualHeal = applyPlayerHeal(healAmount);
    gameState.mana = Math.min(gameState.maxMana, gameState.mana + manaAmount);
    const parts = [];
    if (actualHeal > 0) parts.push(`${actualHeal} PV`);
    if (manaAmount > 0) parts.push(`${manaAmount} Mana`);
    logEvent(`Vous consommez [${item.name}]${parts.length ? ` et récupérez ${parts.join(" et ")}` : ""}.`, "success");

    gameState.inventory.splice(index, 1);
    updateUI();
    updateInventoryUI();
}

// Ratio de revente : un objet de l'inventaire (équipement non équipé ou consommable) se vend à une
// fraction de sa valeur de base — jamais l'équipement actuellement porté (gameState.equipment). Un
// parchemin du grimoire se vend au même ratio (voir sellSpell() ci-dessous), jamais celui équipé
// (gameState.equipment.spell), qui ne fait justement jamais partie de gameState.spellbook. Réservé à
// l'interaction boutique (voir triggerShopEncounter()) : pas de vente "de rue" hors ville spécialisée.
const SELL_VALUE_RATIO = 0.4;

// Valeur marchande d'un objet (PO) : `value` calculée à la génération (rareté, niveau d'objet,
// qualificatifs — voir computeItemValue() dans generator.js), `baseValue` brute en repli pour un objet
// construit à la main (tests) ou antérieur à ce système.
function getItemValue(item) {
    if (!item) return 0;
    return item.value ?? item.baseValue ?? 0;
}

function getSellPrice(item) {
    return Math.max(1, Math.round(getItemValue(item) * SELL_VALUE_RATIO));
}

function sellItem(index) {
    const item = gameState.inventory[index];
    if (!item) return;

    const price = getSellPrice(item);
    gameState.gold += price;
    gameState.inventory.splice(index, 1);
    logEvent(`Vous vendez [${formatItemDisplayName(item)}] pour ${price} PO.`, "success");
    updateUI();
    updateInventoryUI();
}

// Vente d'un parchemin du grimoire (chantier "QoL/équilibrage", Chantier D) — pendant de sellItem()
// pour gameState.spellbook plutôt que gameState.inventory, même ratio/logique. L'équipé
// (gameState.equipment.spell) n'est structurellement jamais dans ce tableau (voir equipSpell()), donc
// rien de plus à vérifier ici pour l'exclure.
function sellSpell(index) {
    const spell = gameState.spellbook[index];
    if (!spell) return;

    const price = getSellPrice(spell);
    gameState.gold += price;
    gameState.spellbook.splice(index, 1);
    logEvent(`Vous vendez [${formatItemDisplayName(spell)}] pour ${price} PO.`, "success");
    updateUI();
    updateSpellbookUI();
}
