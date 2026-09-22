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
    },
    "Parking Souterrain Maudit": {
        mobNames: ["Voiture Abandonnée Rouillée", "Horodateur Vengeur", "Cône de Chantier Fou"]
    },
    "Piscine Municipale Désaffectée": {
        mobNames: ["Maître-Nageur Zombifié", "Frite de Piscine Étrangleuse", "Nuage de Chlore Ambulant"]
    },
    "Studio de Télé-Achat Abandonné": {
        mobNames: ["Mannequin Vitrine Possédé", "Caméra de Surveillance Autonome", "Présentateur Télé-Achat Hystérique"]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { districts };
}
