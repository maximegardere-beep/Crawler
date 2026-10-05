// ==========================================
// ÉMISSION DEATHWATCH (chantier 4, voir NOTES_DEATHWATCH.md et CHANTIERS.md)
// ==========================================
// Catalogue PUR (aucun DOM, aucune écriture) : présentateur, piques à trous tirées de la partie du
// crawler, répliques par ton de réponse et réactions du présentateur. Le moteur (triggerShow() /
// answerShow() dans app.js) construit le contexte, choisit la pique et applique l'issue.
// Chargé avant app.js (même ordre dans index.html et tests/load_game.js).

const SHOW_HOST = {
    name: "Chip Brillantine",
    show: "DeathWatch",
    tagline: "L'émission qui regarde les crawlers mourir, pour que vous n'ayez pas à le faire."
};

// Les 4 tons de réponse, du plus sûr au plus risqué, + le refus. Les chiffres (seuils, boîtes,
// sanctions) vivent dans config.show (app.js) ; ici, seulement la présentation.
const SHOW_TONES = [
    { key: 'polite', icon: '😇', label: 'Poli(e)' },
    { key: 'retort', icon: '😏', label: 'Pique en retour' },
    { key: 'provoke', icon: '😈', label: 'Provocation' },
    { key: 'insult', icon: '🤬', label: 'Insulte en direct' }
];

// Piques à trous. `when(ctx)` = déclencheur (absent = pique générique, de repli) ; `theme` = famille de
// répliques du crawler (SHOW_REPLIES), pour que la réponse rebondisse sur la pique. Trous disponibles :
// {{crawler}} {{etage}} {{fuites}} {{degats}} {{mobs}} {{pieges}} {{sortsRates}} {{objet}}
// {{compagnon}} {{prime}} {{succes}} {{niveau}} {{or}} {{mainsNues}} {{race}} {{classe}} {{synergieTitre}} {{essaiPct}} {{demonKO}} {{demonExpulsions}}.
// `priority` (chantier 13) : à l'arrivée sur l'étage 3, les piques sur la race, la classe ou leur synergie passent avant toutes les autres
// (la synergie avant la race et la classe, qui se partagent le tirage) ; absent = 0. Chantier 15 : les piques sur l'Armure de scénario, le Remplaçant intérimaire
// et la fin de la Période d'essai (étage 4) sont rares et passent avant les piques ordinaires ; celle sur la Période d'essai, elle, reste de priorité 0 (sinon elle étoufferait toutes les autres aux étages 2-3).
const SHOW_TAUNTS = [
    // Fuites
    { id: 'flee1', theme: 'flee', when: c => c.fuites >= 3, text: "{{fuites}} fuites depuis le début, {{crawler}}. Vous battez le record de l'émission… en course à pied." },
    { id: 'flee2', theme: 'flee', when: c => c.fuites >= 3, text: "Nos statistiques indiquent que vous avez vu plus de dos de monstres que de faces. {{fuites}} fuites, {{crawler}} !" },
    { id: 'flee3', theme: 'flee', when: c => c.fuites >= 6, text: "{{fuites}} fuites. À ce stade, ce n'est plus de la lâcheté, c'est un style de vie." },
    // Gros dégâts sur l'étage qui vient de finir
    { id: 'hurt1', theme: 'hurt', when: c => c.degats >= c.maxHp, text: "Vous avez encaissé {{degats}} points de dégâts à l'étage précédent. Plus que vos PV max. Comment êtes-vous encore debout ?" },
    { id: 'hurt2', theme: 'hurt', when: c => c.degats >= c.maxHp, text: "{{degats}} dégâts sur un seul étage ! Nos sponsors en pansements vous remercient personnellement." },
    { id: 'hurt3', theme: 'lowhp', when: c => c.pvPct <= 30, text: "Vous arrivez avec {{pvPct}} % de vos PV, {{crawler}}. Le public a déjà ouvert les paris." },
    { id: 'hurt4', theme: 'lowhp', when: c => c.pvPct <= 30, text: "Vous avez une mine affreuse. C'est un compliment : les audiences adorent le sang frais." },
    // Étage trop facile
    { id: 'easy1', theme: 'easy', when: c => c.mobs >= 5 && c.degats === 0, text: "{{mobs}} monstres tués sans une égratignure. Vous rendez l'émission ennuyeuse, {{crawler}}. Arrêtez ça." },
    { id: 'easy2', theme: 'easy', when: c => c.mobs >= 8, text: "{{mobs}} victimes à l'étage précédent. Les monstres ont monté un syndicat pour se plaindre de vous." },
    // Pièges et sorts ratés
    { id: 'trap1', theme: 'trap', when: c => c.pieges >= 2, text: "{{pieges}} pièges déclenchés sur un seul étage. On vous a vu marcher sur une dalle marquée « PIÈGE ». En lettres capitales." },
    { id: 'trap2', theme: 'trap', when: c => c.pieges >= 2, text: "Notre équipe technique vous remercie : vos {{pieges}} pièges ont fait nos meilleurs ralentis." },
    { id: 'spell1', theme: 'spell', when: c => c.sortsRates >= 3, text: "{{sortsRates}} sorts ratés. La magie, {{crawler}}, ce n'est pas juste agiter les bras en criant." },
    { id: 'spell2', theme: 'spell', when: c => c.sortsRates >= 3, text: "Nos pompiers vous saluent : {{sortsRates}} sorts partis en fumée, et vos sourcils avec." },
    // Objet ridicule
    { id: 'joke1', theme: 'joke', when: c => !!c.objet, text: "Parlons de votre équipement. Un [{{objet}}]. En direct. Devant des milliards de spectateurs." },
    { id: 'joke2', theme: 'joke', when: c => !!c.objet, text: "Le public vote : [{{objet}}], objet le plus pathétique de la saison. Félicitations, {{crawler}}." },
    { id: 'joke3', theme: 'joke', when: c => !!c.objet, text: "Notre service juridique me demande de préciser que [{{objet}}] n'est pas un vrai équipement. Vous le saviez ?" },
    // Compagnon
    { id: 'pal1', theme: 'pal', when: c => !!c.compagnon && !c.compagnonATerre, text: "Et voici {{compagnon}} ! Le public l'adore. Vous, un peu moins. Il fait tout le travail, non ?" },
    { id: 'pal2', theme: 'palDown', when: c => !!c.compagnon && c.compagnonATerre, text: "{{compagnon}} est à terre et vous continuez à avancer. Belle mentalité d'équipe, {{crawler}}." },
    { id: 'pal3', theme: 'palGone', when: c => !c.compagnon && c.compagnonsPartis >= 1, text: "Votre compagnon vous a quitté. On a son interview exclusive : il dit que vous ronflez." },
    // Prime (chasseurs, chantier 3)
    { id: 'bounty1', theme: 'bounty', when: c => c.prime >= 30, text: "Votre tête vaut {{prime}} points de prime, {{crawler}}. Nos gobelins de la régie hésitent entre vous applaudir et vous livrer." },
    { id: 'bounty2', theme: 'bounty', when: c => c.prime >= 60, text: "Prime de {{prime}} ! Petite annonce à nos chasseurs qui nous regardent : il est ici, en plateau." },
    // Argent, succès, niveau, mains nues
    { id: 'rich', theme: 'rich', when: c => c.or >= 500, text: "{{or}} PO en poche, et toujours dans ce donjon ? Vous économisez pour vos funérailles ?" },
    { id: 'broke', theme: 'broke', when: c => c.or < 10 && c.etage >= 4, text: "{{or}} PO à l'étage {{etage}}. Même les rats du donjon ont un meilleur plan d'épargne." },
    { id: 'famous', theme: 'famous', when: c => c.succes >= 10, text: "{{succes}} succès débloqués ! Vous collectionnez les trophées comme d'autres collectionnent les cicatrices." },
    { id: 'underlevel', theme: 'underlevel', when: c => c.niveau < c.etage, text: "Niveau {{niveau}} à l'étage {{etage}} ? Soit vous êtes un génie, soit vous serez notre prochain hommage." },
    { id: 'perfect1', theme: 'perfect', when: c => c.parfaits >= 5, text: "{{parfaits}} gestes parfaits, {{crawler}}. Nos équipes vérifient que vous ne trichez pas. Vous ne trichez pas ? Dommage, ça aurait fait un meilleur épisode." },
    { id: 'perfect2', theme: 'perfect', when: c => c.parfaits >= 5, text: "Des doigts de fée ! {{parfaits}} gestes parfaits. La régie a coupé le chronomètre : trop de précision tue le suspense." },
    { id: 'gambler1', theme: 'gambler', when: c => c.mises >= 100, text: "{{mises}} PO perdus à la salle de jeux, {{crawler}}. Nos actionnaires vous remercient. La salle est à nous, bien sûr." },
    { id: 'gambler2', theme: 'gambler', when: c => c.mises >= 100, text: "On me souffle que vous avez laissé {{mises}} PO aux bornes d'arcade. La maison gagne toujours, {{crawler}}. La maison, c'est nous." },
    { id: 'boxer', theme: 'boxer', when: c => c.mainsNues >= 5, text: "{{mainsNues}} monstres tués à mains nues. Nos sponsors en armes sont vexés, {{crawler}}." },
    // Début de partie (chantier 15) : Période d'essai (`essai`, étages 2-3 tant qu'elle protège), sa fin (`finEssai`, arrivée à l'étage 4), Armure de scénario consommée sur l'étage qui vient de finir (`scenario`), Remplaçant intérimaire vaincu (`interimKills`).
    { id: 'trial1', theme: 'trial', when: c => c.essai, text: "Vous êtes toujours en période d'essai, {{crawler}} : −{{essaiPct}} % de dégâts subis, c'est la clause 7 de votre contrat. Profitez-en, elle n'est pas renouvelable." },
    { id: 'trial2', theme: 'trial', when: c => c.essai, text: "Niveau {{niveau}}, étage {{etage}}, et déjà un contrat d'intégration ! Les monstres ont reçu la consigne de frapper doucement jusqu'à confirmation de votre poste, {{crawler}}." },
    { id: 'trialEnd1', theme: 'trialEnd', priority: 2, when: c => c.finEssai, text: "Étage {{etage}} : votre période d'essai est terminée, {{crawler}}. Félicitations, vous êtes CDI. Plus de protection, plus de ménagement, et le préavis est de zéro seconde." },
    { id: 'trialEnd2', theme: 'trialEnd', priority: 2, when: c => c.finEssai, text: "La direction a le plaisir de vous confirmer à votre poste, {{crawler}}. En contrepartie, les monstres sont autorisés à frapper à pleine puissance. C'est dans les petites lignes." },
    { id: 'plot1', theme: 'plotArmor', priority: 1, when: c => c.scenario, text: "Un coup mortel, et vous voilà à 1 PV, {{crawler}}. Notre scénariste jure n'y être pour rien. Notre scénariste ment." },
    { id: 'plot2', theme: 'plotArmor', priority: 1, when: c => c.scenario, text: "Vous auriez dû mourir à l'étage précédent. Le public a hurlé, les paris étaient pris, et la production a… glissé une clause. Ne le répétez à personne, {{crawler}}." },
    { id: 'interim1', theme: 'interim', priority: 1, when: c => c.interimKills >= 1 && c.etage <= 4, text: "Vous avez battu un remplaçant intérimaire, {{crawler}}. Le vrai boss, lui, était en RTT. Ce n'est pas très glorieux, mais nos stagiaires sont inconsolables." },
    { id: 'interim2', theme: 'interim', priority: 1, when: c => c.interimKills >= 1 && c.etage <= 4, text: "Le syndicat des boss dépose une plainte : vous avez licencié un intérimaire sans préavis, {{crawler}}. La production s'en lave les mains, elle l'avait recruté la veille." },
    // Gorgoth le Concierge (chantier 17, lot 9) : mise au tapis (`demonFresh`) ou expulsion (`demonExpelledFresh`) sur l'étage qui vient de finir — rares, priorité 2.
    { id: 'demon1', theme: 'demon', priority: 2, when: c => c.demonFresh, text: "Mesdames et messieurs, {{crawler}} a mis Gorgoth le Concierge au tapis ! Il n'est qu'assommé, bien sûr. Et il a noté votre numéro d'appartement." },
    { id: 'demon2', theme: 'demon', priority: 2, when: c => c.demonFresh && c.demonKO >= 2, text: "{{demonKO}} mises au tapis du Concierge, {{crawler}}. À ce stade, ce n'est plus un combat de boss, c'est un litige de voisinage." },
    { id: 'demon3', theme: 'demon', priority: 2, when: c => c.demonFresh && c.demonScarMax >= 3, text: "Gorgoth a une nouvelle cicatrice, {{crawler}}, et elle porte votre nom. Il ne craint plus votre petit style. Il s'entraîne. La nuit. En hurlant." },
    { id: 'demon4', theme: 'demon', priority: 2, when: c => c.demonExpelledFresh, text: "Expulsé(e) par le Concierge ! {{crawler}} est ressorti(e) de l'antre à 1 PV, sans caution, sans dignité. Le replay est déjà la vidéo la plus vue de la saison." },
    { id: 'demon5', theme: 'demon', priority: 2, when: c => c.demonExpelledFresh && c.demonExpulsions >= 2, text: "{{demonExpulsions}} expulsions, {{crawler}}. Gorgoth a fait imprimer votre visage sur un panneau « INTERDIT AUX CRAWLERS ». Il est plastifié." },
    // Origine (chantier 13) : seulement juste après le choix de race et de classe (`origineFraiche`), prioritaires sur tout le reste.
    { id: 'syn_troll_brawler', theme: 'originSynergy', priority: 3, when: c => c.origineFraiche && c.synergie === 'troll+brawler', text: "« {{synergieTitre}} » ! C'est écrit sur votre carte de visite, {{crawler}}. Et ça cogne aussi fort qu'une réunion qui aurait pu être un courriel." },
    { id: 'syn_elf_occultist', theme: 'originSynergy', priority: 3, when: c => c.origineFraiche && c.synergie === 'elf+occultist', text: "« {{synergieTitre}} » ! Les sorts sont gratuits, {{crawler}}, mais le fauteuil en velours reste en supplément." },
    { id: 'syn_goblin_trickster', theme: 'originSynergy', priority: 3, when: c => c.origineFraiche && c.synergie === 'goblin+trickster', text: "« {{synergieTitre}} » ! Vous régnez sur trois égouts et un panneau « sens interdit », {{crawler}}. Un règne honorable." },
    { id: 'syn_dwarf_punchingbag', theme: 'originSynergy', priority: 3, when: c => c.origineFraiche && c.synergie === 'dwarf+punchingBag', text: "« {{synergieTitre}} » ! On cherche encore le pont-levis, {{crawler}}, mais la façade tient bon." },
    { id: 'race_human', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'human', text: "Humain·e « moyen·ne mais motivé·e ». Chez nous, on appelle ça un figurant, {{crawler}}. Motivé, c'est vrai." },
    { id: 'race_ghoul', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'ghoul', text: "Une {{race}} ! {{crawler}}, vous aviez déjà cette mine avant, ou c'est la race qui parle ?" },
    { id: 'race_goblin', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'goblin', text: "Un {{race}} de caniveau ! Chaque saison, l'un d'eux promet de ne pas voler la caméra. Je tiens les paris, {{crawler}}." },
    { id: 'race_troll', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'troll', text: "Un {{race}} de bureau ! La régie prévoit déjà une chaise renforcée et une pause café à 10 h pile, {{crawler}}." },
    { id: 'race_elf', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'elf', text: "Un {{race}} de salon ! Les oreilles pointues sont validées par notre service juridique, {{crawler}}. Le peignoir reste facultatif." },
    { id: 'race_dwarf', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'dwarf', text: "Un {{race}} de chantier ! Casque obligatoire, {{crawler}}, et interdiction de crier dans le donjon avant 7 h." },
    { id: 'race_roach', theme: 'originRace', priority: 2, when: c => c.origineFraiche && c.raceKey === 'roach', text: "Un {{race}} mutant ! On a déjà fait la blague de l'écraser. On ne la refera pas, {{crawler}}. Enfin, pas tout de suite." },
    { id: 'class_brawler', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'brawler', text: "{{classe}} ! À mains nues, en plus. Notre assureur a quitté le plateau en pleurant, {{crawler}}." },
    { id: 'class_duelist', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'duelist', text: "{{classe}} ! Vous savez que le donjon ne distribue pas d'épées gratuites, {{crawler}} ? Elles sont chères, et elles cassent." },
    { id: 'class_gunslinger', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'gunslinger', text: "{{classe}} ! Petit conseil de la production : viser, c'est mieux que prier, {{crawler}}." },
    { id: 'class_occultist', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'occultist', text: "{{classe}} ! Sans chapiteau, sans lapin, mais avec des sourcils à sacrifier. Le spectacle est lancé, {{crawler}}." },
    { id: 'class_trickster', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'trickster', text: "Un {{classe}} ! Rassurez-vous, {{crawler}} : vos poches sont déjà vides, c'est nous qui nous en sommes chargés." },
    { id: 'class_punchingbag', theme: 'originClass', priority: 2, when: c => c.origineFraiche && c.classKey === 'punchingBag', text: "{{classe}} ! Un choix de carrière courageux, {{crawler}}. Les monstres vous envoient leurs remerciements." },
    // Génériques (repli)
    { id: 'gen1', theme: 'odds', text: "Bienvenue à l'étage {{etage}}, {{crawler}} ! Nos analystes vous donnent 12 % de chances de survie. C'était avant votre arrivée." },
    { id: 'gen2', theme: 'why', text: "{{crawler}}, tout le monde se demande : pourquoi vous ? Et surtout, pourquoi encore vous ?" },
    { id: 'gen3', theme: 'mom', text: "Étage {{etage}} ! Dites bonjour à maman. Elle ne regarde pas, mais dites-lui quand même." },
    { id: 'gen4', theme: 'who', text: "Notre sondage du jour : « {{crawler}} passera-t-il l'étage {{etage}} ? » Réponse majoritaire : « Qui ? »" },
    { id: 'gen5', theme: 'scale', text: "Niveau {{niveau}}, étage {{etage}}. Sur une échelle de 1 à cadavre, vous êtes à combien, {{crawler}} ?" }
];

// Répliques du crawler, PAR THÈME de pique (`taunt.theme`) puis par ton : la réponse rebondit toujours
// sur ce que le présentateur vient de dire. Une réplique tirée par ton et par émission, affichée sur
// le bouton ; mêmes trous {{xxx}} que les piques (remplis avec le même contexte). Chaque thème doit
// couvrir les 4 tons (exigé par tests/regression/deathwatch.js).
const SHOW_REPLIES = {
    flee: {
        polite: ["« Je préfère le terme “repli stratégique”, Chip. »", "« Courir, c'est aussi du cardio. Je salue mon coach. »"],
        retort: ["« {{fuites}} fuites, et je suis toujours là. Vos stars d'avant, elles, sont au cimetière. »", "« Je cours peut-être, mais vous, Chip, vous fuyez les vrais sujets. »"],
        provoke: ["« Je ne fuis pas, je choisis mes combats. Envoyez-en un qui mérite que je reste. »", "« Mettez un monstre digne de ce nom sur ma route et vous verrez si je cours. »"],
        insult: ["« Vous voulez voir quelqu'un courir ? Attendez que je monte en plateau, Chip. »", "« Je fuis les monstres. Vous, même les miroirs vous fuient. »"]
    },
    perfect: {
        polite: ["« Merci, Chip. Une main qui ne tremble pas, c'est rare quand on vous regarde. »", "« Un peu de pratique, beaucoup de chance. Surtout de la chance. »"],
        retort: ["« {{parfaits}} gestes parfaits, et vous, un seul bon mot par saison. »", "« Je ne triche pas, Chip. Je laisse ça à votre régie. »"],
        provoke: ["« Ce n'était que l'échauffement. Prochaine épreuve : je ferme les yeux. »", "« Donnez-moi des pièges plus durs, mes doigts s'ennuient. »"],
        insult: ["« Mes doigts sont si précis que je pourrais vous retirer cette perruque sans que vous sentiez rien, Chip. »", "« Parfait, comme votre calvitie sous ce postiche. »"]
    },
    gambler: {
        polite: ["« Je soutiens l'économie locale, Chip. Quelqu'un doit le faire. »", "« Le jeu est une passion. Je la nourris, comme vos actionnaires. »"],
        retort: ["« {{mises}} PO perdus, mais au moins, moi, je savais à quoi je jouais. »", "« Si la salle est à vous, rendez-moi mon argent et appelons ça un remboursement de sponsor. »"],
        provoke: ["« La prochaine fois, je mise tout sur moi. Gardez votre monnaie prête, Chip. »", "« Vos bornes sont truquées ? Tant mieux. J'adore battre un jeu truqué. »"],
        insult: ["« Vous avez perdu bien plus que ça au casting de votre propre émission, Chip. »", "« Je parie que vous ne tiendrez pas dix saisons de plus. Cote : 1 contre 12. »"]
    },
    hurt: {
        polite: ["« Je remercie nos sponsors en pansements, ils m'ont sauvé la vie. »", "« J'encaisse, Chip. C'est mon seul talent. »"],
        retort: ["« {{degats}} dégâts, et je tiens debout. Vous, vous tomberiez pour une coupure de papier. »", "« J'ai pris des coups, oui. Vos audiences aussi, d'après ce qu'on raconte. »"],
        provoke: ["« {{degats}} dégâts ? C'était l'échauffement. Montez le niveau. »", "« Vos monstres tapent comme des stagiaires. Envoyez les titulaires. »"],
        insult: ["« Je garde une petite réserve de dégâts pour votre visage, Chip. »", "« Le seul truc qui saigne plus que moi, c'est votre crédibilité. »"]
    },
    lowhp: {
        polite: ["« Juste une mauvaise journée, Chip. Ça va passer. »", "« Je salue les parieurs : misez sur moi, la cote est excellente. »"],
        retort: ["« {{pvPct}} % de PV, c'est toujours plus que votre part d'audience. »", "« Ma mine affreuse, au moins, n'a pas besoin de trois maquilleurs. »"],
        provoke: ["« Pariez contre moi. J'adore faire perdre de l'argent aux gens. »", "« À moitié mort, je reste plus vivant que votre scénario. »"],
        insult: ["« Même à {{pvPct}} %, j'ai assez de forces pour vous arracher cette moumoute. »", "« Ouvrez les paris sur votre carrière, Chip. Elle est plus mal en point que moi. »"]
    },
    trial: {
        polite: ["« Merci, Chip. Je lirai mon contrat dès que quelqu'un aura le temps de me le donner. »", "« Une période d'essai, c'est aimable. Je promets de ne pas mourir avant la fin. »"],
        retort: ["« Chez vous, même la mort passe par les ressources humaines, Chip. »", "« −{{essaiPct}} % de dégâts, mais 100 % de vos blagues. Je préférerais l'inverse. »"],
        provoke: ["« Gardez votre clause. Je prends les coups à pleine puissance dès demain. »", "« Un contrat d'intégration ? Faites-moi plutôt signer pour le boss. »"],
        insult: ["« Votre contrat, Chip, je le plie en quatre et je vous le range quelque part. »", "« Les monstres frappent doucement ? Comme votre humour, alors. Aucune peine à l'encaisser. »"]
    },
    trialEnd: {
        polite: ["« Merci de votre confiance, Chip. Je tâcherai de la mériter jusqu'à l'étage suivant. »", "« CDI… Ça veut dire que j'ai droit à des congés payés ? »"],
        retort: ["« Ah, bien sûr : la confiance, juste avant l'addition. »", "« Un CDI sans mutuelle. Votre sens du paquet-cadeau est remarquable. »"],
        provoke: ["« Plus de protection ? Parfait. Je n'en avais pas besoin pour vous. »", "« Qu'ils frappent fort. Je commence à m'ennuyer. »"],
        insult: ["« Gardez votre CDI, Chip. Moi, je vous offre un licenciement pour faute lourde. »", "« Le préavis est de zéro seconde ? Alors la porte est par là, Chip. »"]
    },
    plotArmor: {
        polite: ["« Merci au scénariste, qui qu'il soit. Je lui dois un café. »", "« Un petit coup de pouce, Chip ? J'espère que ce n'est pas facturé. »"],
        retort: ["« Un scénariste qui m'aide ? Il doit manquer d'idées pour le final. »", "« 1 PV, c'est au moins 1 de plus que votre dignité. »"],
        provoke: ["« La prochaine fois, laissez-moi mourir. Le public aura un meilleur épisode. »", "« Dites à votre scénariste que j'ai tout vu. Et que j'attends la suite. »"],
        insult: ["« Si votre scénariste m'aime autant, pourquoi vous écrit-il, vous, Chip ? »", "« Un scénariste qui triche pour moi, un présentateur qui lit mal : c'est vous le maillon faible. »"]
    },
    demon: {
        polite: ["« Je tiens à saluer Gorgoth, un professionnel. Il m'a même tenu la porte. Sur la figure. »", "« Je suis un(e) locataire modèle, Chip. Je paie mon loyer en coups d'épée. »"],
        retort: ["« Un concierge qui garde la Sortie ? Vous avez des problèmes de recrutement, Chip. »", "« Lui, au moins, il fait son travail. On ne peut pas en dire autant de votre régie. »"],
        provoke: ["« Dites au Concierge de changer les serrures. Je reviens avec un double. »", "« Qu'il garde ses clés au chaud. Je viendrai les chercher moi-même. »"],
        insult: ["« Gorgoth a des cornes, des ailes et une casquette, et il reste plus présentable que vous, Chip. »", "« Même un démon de l'enfer a plus de charisme que votre brushing, Chip. »"]
    },
    interim: {
        polite: ["« Je ferai porter des fleurs à sa famille. Enfin, à son agence d'intérim. »", "« Il avait un joli badge, Chip. Je le garderai en souvenir. »"],
        retort: ["« Si le vrai boss est en RTT, il peut y rester. J'ai de quoi m'occuper. »", "« Un remplaçant, un stagiaire : vous avez de la suite dans les idées, Chip. »"],
        provoke: ["« Dites au vrai boss que je viendrai le chercher à son retour de vacances. »", "« Envoyez le titulaire, cette fois. Je prends mon tour. »"],
        insult: ["« Même vos intérimaires ont plus de classe que vous, Chip. Heureusement, c'est lui qui est mort. »", "« Un intérimaire, ça se remplace. Vous aussi, Chip, et sans offre d'emploi. »"]
    },
    easy: {
        polite: ["« Je m'excuse auprès des monstres. Ils méritaient mieux. »", "« Désolé pour l'ennui, Chip. J'essaierai de saigner un peu la prochaine fois. »"],
        retort: ["« Si {{mobs}} monstres, c'est ennuyeux, c'est votre casting qu'il faut revoir. »", "« Le syndicat des monstres ? Dites-leur que je prends les réclamations à l'épée. »"],
        provoke: ["« {{mobs}} à l'étage précédent. Je vise le double ici. Préparez les brancards. »", "« Vos monstres sont en carton. Sortez les vrais, si vous en avez. »"],
        insult: ["« Ennuyeux ? Moins que vos blagues, Chip. Et elles, personne n'y survit. »", "« Après les monstres, votre tour. Je fais les syndicats ET les présentateurs. »"]
    },
    trap: {
        polite: ["« Je testais les pièges pour les crawlers suivants. Service public. »", "« Merci à l'équipe technique. Les ralentis, c'est mon cadeau. »"],
        retort: ["« Vous écrivez « PIÈGE » en capitales parce que votre public ne lit que ça. »", "« Au moins, moi, je tombe dans les pièges. Vous, vous tombez dans les clichés. »"],
        provoke: ["« Vos pièges chatouillent. Posez-en des vrais la prochaine fois. »", "« {{pieges}} pièges et je suis encore là. Votre équipe technique est virée. »"],
        insult: ["« Le prochain piège, c'est vous qui marchez dessus, Chip. En direct. »", "« Le plus gros piège de ce donjon, c'est votre coupe de cheveux. »"]
    },
    spell: {
        polite: ["« La magie est un art difficile. Je salue mes sourcils disparus. »", "« Merci aux pompiers, vraiment. Ils ont été formidables. »"],
        retort: ["« {{sortsRates}} sorts ratés, mais au moins j'essaie des choses. Vous, vous répétez la même blague depuis dix saisons. »", "« Agiter les bras en criant ? C'est pourtant votre technique de présentation, Chip. »"],
        provoke: ["« Mon prochain sort, je le vise sur votre régie. Pour voir s'il rate. »", "« Mes sorts ratés font plus de dégâts que vos monstres réussis. »"],
        insult: ["« Je réserve mon prochain échec critique à votre plateau, Chip. »", "« Je n'ai peut-être plus de sourcils, mais vous n'avez jamais eu de talent. »"]
    },
    joke: {
        polite: ["« [{{objet}}] a une valeur sentimentale, Chip. »", "« Je remercie le sponsor de [{{objet}}]. Il se reconnaîtra. »"],
        retort: ["« [{{objet}}] a tué plus de monstres que votre émission n'a eu de bonnes idées. »", "« Ridicule, [{{objet}}] ? Vous portez une veste à paillettes, Chip. »"],
        provoke: ["« Avec [{{objet}}], je vais finir cet étage. Imaginez avec une vraie arme. »", "« Envoyez votre pire monstre. Je l'humilie avec [{{objet}}], en direct. »"],
        insult: ["« Je vous ferai une démonstration de [{{objet}}]. Sur vous. »", "« Le plus pathétique de la saison, Chip, c'est vous. Pas [{{objet}}]. »"]
    },
    pal: {
        polite: ["« {{compagnon}} est formidable. Applaudissez-le, il le mérite. »", "« Je dois tout à {{compagnon}}. Il le sait, je le sais. »"],
        retort: ["« {{compagnon}} fait le travail, moi je fais le spectacle. Vous devriez essayer, Chip. »", "« Au moins, j'ai quelqu'un avec moi. Vous, même votre producteur vous évite. »"],
        provoke: ["« {{compagnon}} et moi, on prend n'importe quoi. Envoyez du lourd. »", "« À deux contre votre donjon ? C'est presque injuste. Pour lui. »"],
        insult: ["« {{compagnon}} me demande de vous dire que votre émission est nulle. Je suis d'accord. »", "« {{compagnon}} a plus de charisme que vous, Chip, et il se bat sans micro. »"]
    },
    palDown: {
        polite: ["« Je vais m'occuper de {{compagnon}}, promis. Dès que j'aurai une potion. »", "« {{compagnon}} se repose. C'est mérité. »"],
        retort: ["« {{compagnon}} se relèvera. Votre carrière, par contre… »", "« Belle mentalité d'équipe ? Vous avez viré trois co-présentateurs cette saison, Chip. »"],
        provoke: ["« Je vengerai {{compagnon}}. Envoyez celui qui l'a mis à terre. »", "« Même seul, je fais le travail de deux. Envoyez-en deux. »"],
        insult: ["« Encore un mot sur {{compagnon}} et c'est vous qui finissez à terre, Chip. »", "« {{compagnon}} à terre vaut toujours mieux que vous debout. »"]
    },
    palGone: {
        polite: ["« Je lui souhaite bonne route. Et oui, je ronfle un peu. »", "« Il est parti vers de nouvelles aventures. Je suis content pour lui. »"],
        retort: ["« Il est parti, oui. Moi au moins, on ne m'a pas remplacé par un hologramme en milieu de saison. »", "« Il ronfle aussi, pour info. Mais lui n'a pas eu d'interview exclusive. »"],
        provoke: ["« Seul, je vais plus vite. Envoyez vos monstres par paquets. »", "« Pas besoin de compagnon. Votre donjon entier ne suffira pas à m'arrêter. »"],
        insult: ["« Votre interview exclusive, Chip, c'est tout le journalisme dont vous êtes capable. »", "« Même mon ex-compagnon a une meilleure diction que vous. »"]
    },
    bounty: {
        polite: ["« C'est flatteur, Chip. Je ne savais pas que je valais autant. »", "« Je salue les chasseurs de primes. Enfin… de loin. »"],
        retort: ["« {{prime}} points ? Dites à vos gobelins de faire la queue. »", "« Ma tête vaut {{prime}}. La vôtre ne se vendrait même pas en brocante. »"],
        provoke: ["« Envoyez vos chasseurs. Je collectionne leurs oreilles. »", "« {{prime}} de prime ? Montez-la. Je veux voir qui ose venir. »"],
        insult: ["« Mettez une prime sur votre moumoute, Chip. Je m'en charge gratuitement. »", "« Vos chasseurs, c'est vous qui les payez ? Ça expliquerait leur niveau. »"]
    },
    rich: {
        polite: ["« C'est pour mes vieux jours, Chip. Si j'en ai. »", "« J'investis dans l'avenir. Enfin, dans l'étage suivant. »"],
        retort: ["« {{or}} PO, c'est plus que votre cachet, non ? »", "« J'économise pour racheter votre chaîne. Et vous virer. »"],
        provoke: ["« Je paie la tournée : envoyez tous vos monstres, c'est moi qui régale. »", "« Avec {{or}} PO, je pourrais m'offrir un boss. Présentez-moi le vôtre. »"],
        insult: ["« Je vous offre {{or}} PO si vous vous taisez jusqu'à la fin de l'émission. »", "« Même avec tout mon or, je ne pourrais pas vous acheter du talent, Chip. »"]
    },
    broke: {
        polite: ["« L'argent ne fait pas le bonheur, Chip. Ni la survie. »", "« Je vis simplement. Très simplement. »"],
        retort: ["« {{or}} PO, mais pas de dettes. Contrairement à votre chaîne. »", "« Les rats ont un plan d'épargne ? Engagez-les à la compta, vous en avez besoin. »"],
        provoke: ["« Pas un sou, rien à perdre. Envoyez ce que vous voulez. »", "« Je me paierai sur la bête. Envoyez-en une bien grasse. »"],
        insult: ["« Je suis fauché, Chip, mais vous, vous êtes gratuit : personne ne paierait pour vous. »", "« Mon porte-monnaie est vide. Comme votre regard. »"]
    },
    famous: {
        polite: ["« Je dédie ces {{succes}} succès à nos fidèles spectateurs. »", "« Chaque trophée compte, Chip. Chaque cicatrice aussi. »"],
        retort: ["« {{succes}} succès. Et votre émission, combien de récompenses cette année ? Zéro ? »", "« Les cicatrices, c'est gratuit. Vos trophées de présentateur, eux, ne sont jamais arrivés. »"],
        provoke: ["« Prévoyez une vitrine plus grande, j'en ramène d'autres de cet étage. »", "« Mettez un trophée en jeu. Je le prends. »"],
        insult: ["« Mon prochain succès : « Faire pleurer Chip en direct ». »", "« {{succes}} succès pour moi, zéro pour votre talent. »"]
    },
    underlevel: {
        polite: ["« Je préfère le terme « prometteur », Chip. »", "« J'apprends vite. Du moins, j'espère. »"],
        retort: ["« Un génie, évidemment. Vous n'en avez jamais croisé, c'est pour ça que vous hésitez. »", "« Niveau {{niveau}}, et toujours plus haut que votre QI. »"],
        provoke: ["« Niveau {{niveau}} et déjà trop fort pour votre donjon. Envoyez le boss. »", "« Je monterai de niveau sur le dos de vos monstres. Envoyez-les. »"],
        insult: ["« Votre hommage, gardez-le pour votre carrière, Chip. »", "« Niveau {{niveau}}, et je vous bats quand même, présentateur de niveau zéro. »"]
    },
    boxer: {
        polite: ["« Je ne voulais vexer personne. Les armes, ce n'est pas mon truc. »", "« Mes poings remercient nos sponsors en bandages. »"],
        retort: ["« Vos sponsors vendent des armes qui cassent avant mes phalanges. »", "« {{mainsNues}} à mains nues, Chip. Vous, il vous faut un micro pour vous défendre. »"],
        provoke: ["« Envoyez un monstre plus gros, il me reste des jointures intactes. »", "« Donnez-moi votre pire. Je le fais à mains nues. »"],
        insult: ["« Mes poings ont une place réservée pour votre sourire, Chip. »", "« {{mainsNues}} monstres à mains nues. Vous serez le suivant. »"]
    },
    odds: {
        polite: ["« 12 %, c'est déjà plus que ce que j'espérais. »", "« Merci à vos analystes. Je vais essayer de les faire mentir. »"],
        retort: ["« Vos analystes prédisaient aussi que votre émission durerait. »", "« 12 % ? C'est à peu près votre part d'audience, non ? »"],
        provoke: ["« Pariez contre moi, et regardez votre argent disparaître. »", "« 12 % ? Corsez un peu l'étage {{etage}}, qu'on s'amuse. »"],
        insult: ["« Vos analystes ont 0 % de chances de garder leur emploi. Vous aussi. »", "« 12 %, c'est aussi la part de vous qui est d'origine, Chip. »"]
    },
    why: {
        polite: ["« Le destin, Chip. Et beaucoup de chance. »", "« Je me pose la même question tous les matins. »"],
        retort: ["« Pourquoi vous, Chip ? C'est la vraie question de l'émission. »", "« Pourquoi moi ? Parce que les autres sont morts. Lisez vos fiches. »"],
        provoke: ["« Pourquoi moi ? Parce que je vais gagner. Et encore moi, jusqu'au bout. »", "« Parce que votre donjon n'a pas réussi à m'en empêcher. Il peut réessayer. »"],
        insult: ["« Et vous, pourquoi encore vous ? Il n'y avait personne d'autre de disponible ? »", "« Pourquoi vous, Chip ? Personne n'ose poser la question. Moi, si. »"]
    },
    mom: {
        polite: ["« Bonjour maman ! Je mange bien, promis. »", "« Maman, si tu regardes : ne regarde pas l'étage {{etage}}. »"],
        retort: ["« Ma mère ne regarde pas, en effet. Elle a bon goût. »", "« Ma mère ne regarde pas. Comme 90 % de votre audience. »"],
        provoke: ["« Maman, prépare le champagne. Je sors bientôt. »", "« Dites à maman que je rapporte la tête du boss. »"],
        insult: ["« Et la vôtre, Chip, elle regarde ? Elle doit avoir honte. »", "« Bonjour à votre mère, Chip. Elle m'a dit de vous dire d'arrêter. »"]
    },
    who: {
        polite: ["« C'est normal, je suis discret. »", "« Qui ? Moi. Enchanté, tout le monde. »"],
        retort: ["« « Qui ? », c'est ce que les gens répondent quand on dit votre nom, Chip. »", "« Votre sondage se trompe moins souvent que vous. Gardez-le. »"],
        provoke: ["« À la fin de l'étage {{etage}}, tout le monde saura qui. »", "« Retenez bien mon nom : c'est celui qui finira votre donjon. »"],
        insult: ["« Qui ? Le type qui va vous faire virer, Chip. »", "« Quand je sortirai, c'est vous que plus personne ne reconnaîtra. »"]
    },
    originRace: {
        polite: ["« {{race}}, oui. Je vous prie de m'excuser si je ne fais pas honneur à l'étiquette, Chip. »", "« Merci, Chip. J'essaierai de ne pas décevoir l'espèce. »"],
        retort: ["« {{race}} peut-être, mais au moins, moi, ce n'est pas une perruque. »", "« Chaque race a ses défauts, Chip. La vôtre s'appelle « présentateur ». »"],
        provoke: ["« Dites au public de parier sur ma race : {{race}}, cote en hausse. »", "« Je suis {{race}} et fier(e) de l'être. Vous, vous êtes quoi, sous le fond de teint ? »"],
        insult: ["« {{race}}, c'est déjà plus qu'une personnalité. Vous, Chip, vous avez quoi ? »", "« Si je suis {{race}}, vous êtes quoi, Chip ? Une erreur de casting ? »"]
    },
    originClass: {
        polite: ["« {{classe}}, c'est le métier que je voulais, Chip. Merci de l'avoir remarqué. »", "« Je fais de mon mieux, comme tout bon {{classe}}. »"],
        retort: ["« Un {{classe}} a de la méthode, Chip. Vous, vous avez un prompteur. »", "« {{classe}}, oui. Ça demande moins de maquillage que votre job. »"],
        provoke: ["« Dites-le aux monstres : un {{classe}} arrive, et il a rendez-vous. »", "« Regardez bien, Chip. Je suis {{classe}}, pas figurant. »"],
        insult: ["« Je suis {{classe}} : je sais où frapper. Vous avez de la chance que ça ne soit pas dans votre loge, Chip. »", "« Les {{classe}}, ça tient debout tout seul. Ça ne s'accroche pas à un prompteur, Chip. »"]
    },
    originSynergy: {
        polite: ["« Merci, Chip. « {{synergieTitre}} », ça sonnera très bien sur ma pierre tombale. »", "« Un titre honorifique ! Je n'ai pas de discours préparé, Chip. »"],
        retort: ["« « {{synergieTitre}} », c'est un vrai titre. Le vôtre est affiché sur une porte de placard. »", "« Mon titre, Chip, il est mérité. Le vôtre vient d'un tirage au sort. »"],
        provoke: ["« « {{synergieTitre}} » : retenez-le, Chip, ça va faire du bruit dans le donjon. »", "« Prenez des notes, la régie. « {{synergieTitre}} », c'est le début de ma légende. »"],
        insult: ["« « {{synergieTitre}} » contre « présentateur fatigué » : devinez qui l'emporte, Chip. »", "« Mon titre est plus long que votre carrière, Chip. Et plus solide. »"]
    },
    scale: {
        polite: ["« Disons 5, Chip. Un bon 5. »", "« À peu près au milieu. C'est confortable. »"],
        retort: ["« Moins que votre émission. Elle sent le cadavre depuis des saisons. »", "« Et sur la même échelle, votre carrière est à combien ? »"],
        provoke: ["« Zéro. Et je compte y rester jusqu'à la sortie. »", "« Demandez plutôt à vos monstres. Eux, ils sont à 10. »"],
        insult: ["« Je suis à 3. Vous, Chip, vous êtes déjà embaumé. »", "« Vous sentez déjà le formol, Chip. Moi, j'ai encore du chemin. »"]
    }
};

// Refus de répondre (commun à toutes les piques).
const SHOW_REFUSALS = ["« Pas de commentaire. »", "« Coupez la caméra. »"];

// Répliques possibles pour cette pique et ce ton (pure) : celles du thème de la pique, sinon celles
// d'un thème générique (une pique sans thème ne reste jamais sans réponse).
function getShowReplyLines(taunt, toneKey) {
    const byTheme = (taunt && SHOW_REPLIES[taunt.theme]) || SHOW_REPLIES.why;
    return byTheme[toneKey] || SHOW_REPLIES.why[toneKey] || [];
}

// Réactions du présentateur selon l'issue.
const SHOW_REACTIONS = {
    polite: ["Chip sourit de toutes ses dents. « Adorable. Un petit cadeau de la production ! »", "« Enfin quelqu'un de bien élevé. La régie vous offre un pourboire. »"],
    success: {
        retort: ["Le public éclate de rire. Chip aussi, un peu jaune. « Touché ! Nos sponsors adorent. »", "« Ha ! Il a du répondant, celui-là. Boîte cadeau ! »"],
        provoke: ["L'applaudimètre s'affole. « Quel CRAN ! Mesdames et messieurs, une ovation ! »", "« J'adore ! La régie, envoyez-lui quelque chose de BIEN. »"],
        insult: ["Silence de mort en plateau… puis une ovation monstrueuse. Chip, livide : « Le public a parlé. Envoyez-lui le COFFRE. »", "« C'est… c'est le meilleur moment de la saison. Je vous déteste. Tenez. »"]
    },
    failure: {
        retort: ["Un bide. Des criquets. « Bon. On va meubler un peu, hein. » L'émission traîne en longueur.", "« C'était censé être drôle ? » L'audience décroche, et vous perdez un temps fou en plateau."],
        provoke: ["« Tant d'assurance ! » Chip claque des doigts. « Régie, envoyez-lui un invité. »", "« Vous voulez du spectacle ? En voici. » Une trappe s'ouvre dans le décor."],
        insult: ["Chip ne sourit plus. « Mesdames et messieurs, une prime spéciale sur la tête de notre invité. Chasseurs, à vous. »", "« Charmant. » Chip fait un signe. Un gobelin armé entre dans le champ."]
    },
    refuse: ["« Il refuse l'interview ! » Le public hue. Chip hausse les épaules : « On garde les images pour le bêtisier. »", "« Pas de commentaire. » Chip soupire : « Les stars, je vous jure. »"]
};

// Pique pour ce contexte (pure, `rng` injectable pour les tests) : de préférence une pique dont le
// déclencheur correspond à la partie, sinon une générique.
function pickShowTaunt(ctx, rng = Math.random) {
    const specific = SHOW_TAUNTS.filter(t => t.when && safeShowCheck(t, ctx));
    // `priority` : seules les piques de la priorité la plus haute restent en lice (origine à l'arrivée sur l'étage 3, chantier 13).
    const top = specific.reduce((max, t) => Math.max(max, t.priority || 0), 0);
    const ranked = specific.filter(t => (t.priority || 0) === top);
    const pool = ranked.length > 0 ? ranked : SHOW_TAUNTS.filter(t => !t.when);
    return pool[Math.floor(rng() * pool.length)];
}

function safeShowCheck(taunt, ctx) {
    try { return !!taunt.when(ctx); } catch (e) { return false; }
}

// Remplit les trous {{xxx}} d'un texte avec le contexte (pure).
function fillShowTemplate(text, ctx) {
    return String(text).replace(/\{\{(\w+)\}\}/g, (m, key) => (ctx[key] !== undefined && ctx[key] !== null ? String(ctx[key]) : m));
}

function pickShowLine(lines, rng = Math.random) {
    return lines[Math.floor(rng() * lines.length)];
}

if (typeof module !== 'undefined') {
    module.exports = { SHOW_HOST, SHOW_TONES, SHOW_TAUNTS, SHOW_REPLIES, SHOW_REFUSALS, SHOW_REACTIONS, getShowReplyLines, pickShowTaunt, fillShowTemplate };
}
