// spells.js - Répertoire des sorts (grimoire)
// Un sort n'est pas un objet classique (items.js) : il ne s'équipe pas depuis l'inventaire mais
// depuis un inventaire magique dédié (gameState.spellbook, voir app.js), après avoir été appris en
// trouvant son parchemin. `category` distingue les sorts de Corps à corps (utilisables à écart nul,
// comme Arme/Mains nues) des sorts à Distance (utilisables uniquement à écart > 0, comme Tir) — voir
// attackMagic() dans app.js. baseDmg et manaCost de base sont mis à l'échelle par la rareté du
// parchemin trouvé, exactement comme baseDmg pour une arme classique (voir generateSpellScroll()
// dans generator.js) : un sort plus puissant coûte donc aussi plus cher en mana.
const spellCatalog = [
    { name: "Toucher Électrique", category: "melee", baseDmg: 9, manaCost: 12, icon: "⚡" },
    { name: "Poing de Glace", category: "melee", baseDmg: 11, manaCost: 15, icon: "🧊" },
    { name: "Paume Brûlante", category: "melee", baseDmg: 8, manaCost: 10, icon: "🔥" },
    { name: "Lame Spectrale", category: "melee", baseDmg: 13, manaCost: 18, icon: "👻" },
    { name: "Foudre", category: "ranged", baseDmg: 15, manaCost: 22, icon: "🌩️" },
    { name: "Boule d'Acide", category: "ranged", baseDmg: 12, manaCost: 18, icon: "🧪" },
    { name: "Projectile de Glace", category: "ranged", baseDmg: 10, manaCost: 14, icon: "❄️" },
    { name: "Météore Miniature", category: "ranged", baseDmg: 19, manaCost: 30, icon: "☄️" }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { spellCatalog };
}
