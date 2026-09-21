/**
 * DISTRICTS.JS - Quartiers explorables du donjon
 * Chaque quartier référence des monstres par leur NOM (voir bestiary.js).
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
    },
    "Usine de Transformation Alimentaire": {
        mobNames: ["Saucisse Vivante", "Fromage qui Pue", "Ouvrier à la Chaîne"]
    },
    "Bibliothèque des Oubliés": {
        mobNames: ["Livre Maudit", "Bibliothécaire Fantôme", "Encre Vivante"]
    },
    "Laboratoire de Fous": {
        mobNames: ["Savant Dingue", "Créature en Bocaux", "Robot Défectueux"]
    },
    "Rue des Illusions": {
        mobNames: ["Mime Aggressif", "Ombre Suspicieuse", "Miroir Brisé"]
    },
    "Catacombes des Chaussettes Perdues": {
        mobNames: ["Chaussette Solitaire", "Lave-Linge Possédé", "Monstre de Poussière"]
    },
    "Marché Noir du Donjon": {
        mobNames: ["Marchand Malhonnête", "Sac de Pièces Vivant", "Garde du Marché"]
    },
    "Salle des Machines Infernales": {
        mobNames: ["Imprimante à Rêves", "Ordinateur en Colère", "Câble Électrique Vivant"]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { districts };
}
