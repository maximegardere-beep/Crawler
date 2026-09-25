// magic-balance.js — tests régression : parité magie/arme (chantier "QoL/équilibrage", Chantier C) —
// à rareté égale, un sort et une arme équivalente infligent des dégâts comparables ; le mana achète
// la flexibilité (mêlée/distance sans changer d'équipement), pas un surplus de dégâts. Voir
// NOTES_QOL_EQUILIBRAGE.md pour le détail du raisonnement et des valeurs retenues.
const { assert, resetTransientState } = require('./_helpers.js');

// "Dégâts par coup" comparés en amont de rollDamage() : effectiveAtk = (gameState.atk + bonus) ×
// atkMultiplier, exactement ce que performPlayerAttack() reçoit en entrée pour l'arme
// (attackWeapon()) comme pour la magie (attackMagic()) — la mitigation/variance qui suit dans
// rollDamage() dépend de la DEF de la cible et est STRICTEMENT IDENTIQUE des deux côtés une fois ce
// chiffre calculé, donc comparer directement ce chiffre isole la seule différence qui nous intéresse.
function avgBaseDmg(pool) {
    return pool.reduce((sum, item) => sum + item.baseDmg, 0) / pool.length;
}

function effectiveWeaponDmg(playerAtk, avgWeaponBaseDmg, rarityStatMult) {
    const atkMultiplier = 1.0 + 0.04 * (1 - 1); // Niveau 1 (skill.level - 1 = 0), voir attackWeapon()
    return (playerAtk + avgWeaponBaseDmg * rarityStatMult) * atkMultiplier;
}

function effectiveSpellDmg(playerAtk, avgSpellBaseDmg, rarityStatMult, skillLevel = 1) {
    const mb = config.magicBalance;
    const atkMultiplier = mb.atkBase + mb.atkPerLevel * (skillLevel - 1);
    return (playerAtk + avgSpellBaseDmg * rarityStatMult) * atkMultiplier;
}

// Parité à rareté égale, mesurée sur les tiers Commun et Épique (comme demandé par la mission), sur
// les deux catégories (mêlée/distance) séparément — un sort mêlée n'est jamais comparé à une arme à
// distance, catégories distinctes côté joueur (voir attackWeapon()/attackRanged()/attackMagic()).
{
    resetTransientState();
    const playerAtk = gameState.atk; // 10, base fraîche après reset

    const meleeWeapons = baseItems.weapons.filter(w => !w.jokeItem);
    const meleeSpells = spellCatalog.filter(s => s.category === 'melee');
    const rangedWeapons = baseItems.ranged.filter(w => !w.jokeItem);
    const rangedSpells = spellCatalog.filter(s => s.category === 'ranged');

    const commun = itemRarities.find(r => r.key === 'commun');
    const epique = itemRarities.find(r => r.key === 'epique');

    [commun, epique].forEach(rarity => {
        const weaponMelee = effectiveWeaponDmg(playerAtk, avgBaseDmg(meleeWeapons), rarity.statMult);
        const spellMelee = effectiveSpellDmg(playerAtk, avgBaseDmg(meleeSpells), rarity.statMult);
        const meleeGap = Math.abs(weaponMelee - spellMelee) / weaponMelee;
        assert(meleeGap <= 0.15, `Parité magie/arme (mêlée, ${rarity.name}) : écart ${(meleeGap * 100).toFixed(1)}% doit rester <= 15%`);

        const weaponRanged = effectiveWeaponDmg(playerAtk, avgBaseDmg(rangedWeapons), rarity.statMult);
        const spellRanged = effectiveSpellDmg(playerAtk, avgBaseDmg(rangedSpells), rarity.statMult);
        const rangedGap = Math.abs(weaponRanged - spellRanged) / weaponRanged;
        assert(rangedGap <= 0.15, `Parité magie/arme (distance, ${rarity.name}) : écart ${(rangedGap * 100).toFixed(1)}% doit rester <= 15%`);
    });
}

// Dégâts cumulés sur un budget de mana COMPLET vs dégâts d'arme sur le même nombre de tours (l'arme
// est gratuite, donc "le même nombre de tours" est la seule base de comparaison équitable) : le mana
// limite le nombre de sorts lançables, il ne doit pas produire un total de dégâts démesurément
// supérieur — sans quoi le mana achèterait un vrai surplus, pas seulement de la flexibilité.
{
    resetTransientState();
    const playerAtk = gameState.atk;
    const commun = itemRarities.find(r => r.key === 'commun');
    const spell = spellCatalog[0]; // Toucher Électrique, melee
    const weaponAvgBaseDmg = avgBaseDmg(baseItems.weapons.filter(w => !w.jokeItem));

    const manaBudget = gameState.maxMana;
    const castsAffordable = Math.floor(manaBudget / spell.manaCost);
    const spellDmgPerCast = effectiveSpellDmg(playerAtk, spell.baseDmg, commun.statMult);
    const totalSpellDmg = spellDmgPerCast * castsAffordable;

    const weaponDmgPerHit = effectiveWeaponDmg(playerAtk, weaponAvgBaseDmg, commun.statMult);
    const totalWeaponDmg = weaponDmgPerHit * castsAffordable; // Même nombre de tours

    const ratio = totalSpellDmg / totalWeaponDmg;
    assert(ratio >= 0.5 && ratio <= 1.15, `Budget mana complet (${castsAffordable} lancers) vs même nombre de coups d'arme : ratio ${ratio.toFixed(2)} doit rester raisonnable`);
}
