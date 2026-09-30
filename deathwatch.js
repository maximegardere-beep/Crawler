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
// {{compagnon}} {{prime}} {{succes}} {{niveau}} {{or}} {{mainsNues}}.
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
    { id: 'boxer', theme: 'boxer', when: c => c.mainsNues >= 5, text: "{{mainsNues}} monstres tués à mains nues. Nos sponsors en armes sont vexés, {{crawler}}." },
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
    const pool = specific.length > 0 ? specific : SHOW_TAUNTS.filter(t => !t.when);
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
