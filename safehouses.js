/**
 * SAFEHOUSES.JS - Catalogue des types de salles sécurisées
 * Pure contextualisation pour l'instant (nom/icône/description) : les buffs dédiés par type
 * arriveront dans une étape ultérieure séparée. Un type est tiré au hasard pour chaque salle
 * sécurisée générée (voir generateQuadrant() dans app.js).
 */
const safehouseTypes = [
    { name: "Taverne Clandestine", icon: "🍺", desc: "Une lumière chaude filtre sous une porte dérobée. On y sert encore à boire, malgré tout." },
    { name: "Hôtel de Fortune", icon: "🛏️", desc: "Un matelas éventré, mais un matelas quand même. Le grand luxe, ici-bas." },
    { name: "Poste de Secours", icon: "⛑️", desc: "Du matériel médical périmé, mais fonctionnel. Quelqu'un est passé avant vous." },
    { name: "Bivouac de Fortune", icon: "🔥", desc: "Un feu de camp couve encore dans un bidon rouillé. Quelqu'un vient de partir, ou personne n'est jamais revenu." },
    { name: "Chapelle Improvisée", icon: "🕯️", desc: "Des bougies fondues et des prières griffonnées sur les murs. Ça ne peut pas faire de mal." },
    { name: "Vestiaire Abandonné", icon: "🚿", desc: "Des casiers ouverts, une odeur de savon rance. Étrangement rassurant." },
    { name: "Bureau de Contremaître", icon: "🗄️", desc: "Un bureau métallique et une chaise qui grince. L'ancien occupant n'est plus là pour s'en plaindre." },
    { name: "Infirmerie de Chantier", icon: "🩹", desc: "Une armoire à pharmacie à moitié pillée, mais encore utile." }
];

function pickSafehouseType() {
    return safehouseTypes[Math.floor(Math.random() * safehouseTypes.length)];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { safehouseTypes, pickSafehouseType };
}
