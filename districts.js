/**
 * DISTRICTS.JS - Quartiers explorables du donjon
 * Chaque quartier référence des monstres par leur NOM (voir le catalogue dans bestiary.js),
 * pour éviter de dupliquer les stats d'un même monstre dans plusieurs quartiers.
 */

const districts = {
    "Tunnels de Métro Abandonnés": {
        mobNames: ["Rat Goulot", "Distributeur de Snacks Hanté", "Contrôleur de Billets Zombifié"]
    },

    "Jardins Carnivores": {
        mobNames: ["Tulipe Géante", "Ronce Étrangleuse", "Gobelin Paysagiste"]
    },

    "Bureaux de l'Administration Pénitentiaire": {
        mobNames: ["Photocopieuse Carnivore", "Stagiaire Démoniaque", "Garde-Chiourme Bureaucrate"]
    }
};

// Export (utile si tu passes sur un environnement modulaire avec Node ou des modules ES6)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { districts };
}
