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
    { name: "Météore Miniature", category: "ranged", baseDmg: 8, manaCost: 28, baseValue: 29, icon: "☄️", minFloor: 4 },

    // Chantier 11 « nouveaux sorts » (voir CHANTIERS.md, chiffres validés) : chaque nouveau sort porte un
    // EFFET intrinsèque (`spellEffect`, voir SPELL_EFFECTS ci-dessous) et des dégâts un peu plus bas pour
    // compenser. Catégorie `any` : sorts utilitaires, sans dégâts, utilisables à toute distance — ils
    // consomment le tour (le mob riposte), comme une attaque.
    { name: "Étreinte Vampirique", category: "melee", baseDmg: 5, manaCost: 16, baseValue: 24, icon: "🧛", minFloor: 2, spellEffect: { kind: 'lifesteal', pct: 30 } },
    { name: "Gifle Sonique", category: "melee", baseDmg: 4, manaCost: 14, baseValue: 20, icon: "👋", spellEffect: { kind: 'stun', chance: 30 } },
    { name: "Main de Rouille", category: "melee", baseDmg: 4, manaCost: 13, baseValue: 18, icon: "🔩", spellEffect: { kind: 'corrode', rounds: 3 } },
    { name: "Nuée de Guêpes", category: "ranged", baseDmg: 4, manaCost: 15, baseValue: 20, icon: "🐝", spellEffect: { kind: 'bleed', pct: 30, rounds: 3 } },
    { name: "Flash Aveuglant", category: "ranged", baseDmg: 3, manaCost: 14, baseValue: 18, icon: "💡", spellEffect: { kind: 'blind', miss: 40, rounds: 2 } },
    { name: "Chaîne d'Éclairs", category: "ranged", baseDmg: 7, manaCost: 24, baseValue: 30, icon: "⛓️", minFloor: 4, spellEffect: { kind: 'chain', pct: 50 } },
    { name: "Cri de Terreur", category: "ranged", baseDmg: 2, manaCost: 12, baseValue: 16, icon: "😱", spellEffect: { kind: 'fear', rounds: 3 } },
    { name: "Soin Express", category: "any", baseDmg: 0, manaCost: 20, baseValue: 26, icon: "💚", spellEffect: { kind: 'heal', pct: 20 } },
    { name: "Bouclier de Mana", category: "any", baseDmg: 0, manaCost: 18, baseValue: 24, icon: "🔰", minFloor: 2, spellEffect: { kind: 'shield', pct: 40, rounds: 2 } },
    { name: "Pas de l'Ombre", category: "any", baseDmg: 0, manaCost: 15, baseValue: 20, icon: "🌑", spellEffect: { kind: 'shadowStep', gap: 2 } }
];

// Effets intrinsèques des sorts (chantier 11) : `label` court (grimoire, bouton) et `text(v)`, la phrase
// d'inspection écrite à côté des chiffres qu'elle décrit — même principe que les qualificatifs
// (itemQualifiers) : le moteur (castSpellEffect()/castUtilitySpell() dans app.js) lit exactement ces champs.
const SPELL_EFFECTS = {
    lifesteal: { label: "Vol de vie", text: v => `Rend ${v.pct} % des dégâts infligés en PV.` },
    stun: { label: "Étourdit", text: v => `${v.chance} % de chances d'étourdir la cible : elle perd son prochain tour.` },
    corrode: { label: "Corrode", text: v => `Corrode l'armure de la cible : DEF −40 % pendant ${v.rounds} tours.` },
    bleed: { label: "Saignement", text: v => `Saignement : ${v.pct} % des dégâts du sort à chaque tour, pendant ${v.rounds} tours.` },
    blind: { label: "Aveugle", text: v => `Aveugle la cible : ${v.miss} % de chances de rater ses attaques pendant ${v.rounds} tours.` },
    chain: { label: "Chaîne", text: v => `Un second éclair frappe aussitôt pour ${v.pct} % des dégâts.` },
    fear: { label: "Terreur", text: v => `Terrorise la cible : ses dégâts −35 % pendant ${v.rounds} tours.` },
    heal: { label: "Soin", text: v => `Soigne ${v.pct} % de vos PV max. Utilisable à toute distance.` },
    shield: { label: "Bouclier", text: v => `Dégâts reçus −${v.pct} % pendant ${v.rounds} tours. Utilisable à toute distance.` },
    shadowStep: { label: "Recul", text: v => `Vous reculez de ${v.gap} cases d'un coup, sans jet opposé. Utilisable à toute distance.` }
};

// Phrase d'inspection de l'effet d'un sort (pure), ou '' s'il n'en a pas.
function describeSpellEffect(effect) {
    const def = effect && SPELL_EFFECTS[effect.kind];
    return def ? def.text(effect) : '';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { spellCatalog, SPELL_EFFECTS, describeSpellEffect };
}
