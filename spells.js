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
const spellCatalog = [
    { name: "Toucher Électrique", category: "melee", baseDmg: 10, manaCost: 13, icon: "⚡" },
    { name: "Poing de Glace", category: "melee", baseDmg: 12, manaCost: 16, icon: "🧊" },
    { name: "Paume Brûlante", category: "melee", baseDmg: 9, manaCost: 11, icon: "🔥" },
    { name: "Lame Spectrale", category: "melee", baseDmg: 14, manaCost: 19, icon: "👻" },
    { name: "Foudre", category: "ranged", baseDmg: 14, manaCost: 21, icon: "🌩️" },
    { name: "Boule d'Acide", category: "ranged", baseDmg: 11, manaCost: 17, icon: "🧪" },
    { name: "Projectile de Glace", category: "ranged", baseDmg: 9, manaCost: 13, icon: "❄️" },
    { name: "Météore Miniature", category: "ranged", baseDmg: 18, manaCost: 28, icon: "☄️" }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { spellCatalog };
}
