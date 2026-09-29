// spells.js - Répertoire des sorts (grimoire)
// Un sort n'est pas un objet classique (items.js) : il ne s'équipe pas depuis l'inventaire mais
// depuis un inventaire magique dédié (gameState.spellbook, voir app.js), après avoir été appris en
// trouvant son parchemin. `category` distingue les sorts de Corps à corps (utilisables à écart nul,
// comme Arme/Mains nues) des sorts à Distance (utilisables uniquement à écart > 0, comme Tir) — voir
// attackMagic() dans app.js. baseDmg et manaCost de base sont mis à l'échelle par la rareté du
// parchemin trouvé, exactement comme baseDmg pour une arme classique (voir generateSpellScroll()
// dans generator.js) : un sort plus puissant coûte donc aussi plus cher en mana.
// Chantier "QoL/équilibrage" (Chantier C, voir NOTES_QOL_EQUILIBRAGE.md) : baseDmg réajustés pour la
// parité avec une arme de même rareté sous config.magicBalance.atkBase (1.1, contre 1.0 pour une
// arme) — mêlée légèrement relevé, distance légèrement abaissé (les deux étaient déjà proches de la
// parité à ce multiplicateur, avant même cet ajustement). manaCost réajusté pour garder le ratio
// manaCost/baseDmg dans la fourchette ~1.2-1.6 déjà en place.
// Chantier "refonte des objets" (voir NOTES_ITEMS.md) : baseDmg divisés par ~2 comme ceux des armes
// (parité conservée), puis mis à l'échelle par le niveau d'objet du parchemin comme une arme ;
// manaCost ne dépend que de la rareté (le mana reste plafonné à 100). `baseValue` explicite (valeur
// marchande de référence, même rôle que dans items.js) et `minFloor` (profondeur minimale) idem.
const spellCatalog = [
    { name: "Toucher Électrique", category: "melee", baseDmg: 5, manaCost: 13, baseValue: 16, icon: "⚡" },
    { name: "Poing de Glace", category: "melee", baseDmg: 6, manaCost: 16, baseValue: 19, icon: "🧊" },
    { name: "Paume Brûlante", category: "melee", baseDmg: 4, manaCost: 11, baseValue: 14, icon: "🔥" },
    { name: "Lame Spectrale", category: "melee", baseDmg: 7, manaCost: 19, baseValue: 22, icon: "👻", minFloor: 3 },
    { name: "Foudre", category: "ranged", baseDmg: 6, manaCost: 21, baseValue: 22, icon: "🌩️", minFloor: 2 },
    { name: "Boule d'Acide", category: "ranged", baseDmg: 5, manaCost: 17, baseValue: 18, icon: "🧪" },
    { name: "Projectile de Glace", category: "ranged", baseDmg: 4, manaCost: 13, baseValue: 14, icon: "❄️" },
    { name: "Météore Miniature", category: "ranged", baseDmg: 8, manaCost: 28, baseValue: 29, icon: "☄️", minFloor: 4 }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { spellCatalog };
}
