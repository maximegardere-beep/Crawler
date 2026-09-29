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

// Piques à trous. `when(ctx)` = déclencheur (absent = pique générique, de repli). Trous disponibles :
// {{crawler}} {{etage}} {{fuites}} {{degats}} {{mobs}} {{pieges}} {{sortsRates}} {{objet}}
// {{compagnon}} {{prime}} {{succes}} {{niveau}} {{or}} {{mainsNues}}.
const SHOW_TAUNTS = [
    // Fuites
    { id: 'flee1', when: c => c.fuites >= 3, text: "{{fuites}} fuites depuis le début, {{crawler}}. Vous battez le record de l'émission… en course à pied." },
    { id: 'flee2', when: c => c.fuites >= 3, text: "Nos statistiques indiquent que vous avez vu plus de dos de monstres que de faces. {{fuites}} fuites, {{crawler}} !" },
    { id: 'flee3', when: c => c.fuites >= 6, text: "{{fuites}} fuites. À ce stade, ce n'est plus de la lâcheté, c'est un style de vie." },
    // Gros dégâts sur l'étage qui vient de finir
    { id: 'hurt1', when: c => c.degats >= c.maxHp, text: "Vous avez encaissé {{degats}} points de dégâts à l'étage précédent. Plus que vos PV max. Comment êtes-vous encore debout ?" },
    { id: 'hurt2', when: c => c.degats >= c.maxHp, text: "{{degats}} dégâts sur un seul étage ! Nos sponsors en pansements vous remercient personnellement." },
    { id: 'hurt3', when: c => c.pvPct <= 30, text: "Vous arrivez avec {{pvPct}} % de vos PV, {{crawler}}. Le public a déjà ouvert les paris." },
    { id: 'hurt4', when: c => c.pvPct <= 30, text: "Vous avez une mine affreuse. C'est un compliment : les audiences adorent le sang frais." },
    // Étage trop facile
    { id: 'easy1', when: c => c.mobs >= 5 && c.degats === 0, text: "{{mobs}} monstres tués sans une égratignure. Vous rendez l'émission ennuyeuse, {{crawler}}. Arrêtez ça." },
    { id: 'easy2', when: c => c.mobs >= 8, text: "{{mobs}} victimes à l'étage précédent. Les monstres ont monté un syndicat pour se plaindre de vous." },
    // Pièges et sorts ratés
    { id: 'trap1', when: c => c.pieges >= 2, text: "{{pieges}} pièges déclenchés sur un seul étage. On vous a vu marcher sur une dalle marquée « PIÈGE ». En lettres capitales." },
    { id: 'trap2', when: c => c.pieges >= 2, text: "Notre équipe technique vous remercie : vos {{pieges}} pièges ont fait nos meilleurs ralentis." },
    { id: 'spell1', when: c => c.sortsRates >= 3, text: "{{sortsRates}} sorts ratés. La magie, {{crawler}}, ce n'est pas juste agiter les bras en criant." },
    { id: 'spell2', when: c => c.sortsRates >= 3, text: "Nos pompiers vous saluent : {{sortsRates}} sorts partis en fumée, et vos sourcils avec." },
    // Objet ridicule
    { id: 'joke1', when: c => !!c.objet, text: "Parlons de votre équipement. Un [{{objet}}]. En direct. Devant des milliards de spectateurs." },
    { id: 'joke2', when: c => !!c.objet, text: "Le public vote : [{{objet}}], objet le plus pathétique de la saison. Félicitations, {{crawler}}." },
    { id: 'joke3', when: c => !!c.objet, text: "Notre service juridique me demande de préciser que [{{objet}}] n'est pas un vrai équipement. Vous le saviez ?" },
    // Compagnon
    { id: 'pal1', when: c => !!c.compagnon && !c.compagnonATerre, text: "Et voici {{compagnon}} ! Le public l'adore. Vous, un peu moins. Il fait tout le travail, non ?" },
    { id: 'pal2', when: c => !!c.compagnon && c.compagnonATerre, text: "{{compagnon}} est à terre et vous continuez à avancer. Belle mentalité d'équipe, {{crawler}}." },
    { id: 'pal3', when: c => !c.compagnon && c.compagnonsPartis >= 1, text: "Votre compagnon vous a quitté. On a son interview exclusive : il dit que vous ronflez." },
    // Prime (chasseurs, chantier 3)
    { id: 'bounty1', when: c => c.prime >= 30, text: "Votre tête vaut {{prime}} points de prime, {{crawler}}. Nos gobelins de la régie hésitent entre vous applaudir et vous livrer." },
    { id: 'bounty2', when: c => c.prime >= 60, text: "Prime de {{prime}} ! Petite annonce à nos chasseurs qui nous regardent : il est ici, en plateau." },
    // Argent, succès, niveau, mains nues
    { id: 'rich', when: c => c.or >= 500, text: "{{or}} PO en poche, et toujours dans ce donjon ? Vous économisez pour vos funérailles ?" },
    { id: 'broke', when: c => c.or < 10 && c.etage >= 4, text: "{{or}} PO à l'étage {{etage}}. Même les rats du donjon ont un meilleur plan d'épargne." },
    { id: 'famous', when: c => c.succes >= 10, text: "{{succes}} succès débloqués ! Vous collectionnez les trophées comme d'autres collectionnent les cicatrices." },
    { id: 'underlevel', when: c => c.niveau < c.etage, text: "Niveau {{niveau}} à l'étage {{etage}} ? Soit vous êtes un génie, soit vous serez notre prochain hommage." },
    { id: 'boxer', when: c => c.mainsNues >= 5, text: "{{mainsNues}} monstres tués à mains nues. Nos sponsors en armes sont vexés, {{crawler}}." },
    // Génériques (repli)
    { id: 'gen1', text: "Bienvenue à l'étage {{etage}}, {{crawler}} ! Nos analystes vous donnent 12 % de chances de survie. C'était avant votre arrivée." },
    { id: 'gen2', text: "{{crawler}}, tout le monde se demande : pourquoi vous ? Et surtout, pourquoi encore vous ?" },
    { id: 'gen3', text: "Étage {{etage}} ! Dites bonjour à maman. Elle ne regarde pas, mais dites-lui quand même." },
    { id: 'gen4', text: "Notre sondage du jour : « {{crawler}} passera-t-il l'étage {{etage}} ? » Réponse majoritaire : « Qui ? »" },
    { id: 'gen5', text: "Niveau {{niveau}}, étage {{etage}}. Sur une échelle de 1 à cadavre, vous êtes à combien, {{crawler}} ?" }
];

// Répliques du crawler par ton (une tirée au hasard par émission, affichée sur le bouton).
const SHOW_REPLIES = {
    polite: ["« Merci Chip, c'est un honneur. »", "« Je salue tous nos sponsors ! »", "« Bonjour maman. »", "« Je fais de mon mieux. »", "« Quelle belle émission. »"],
    retort: ["« Et vous, Chip, votre brushing, il a survécu à combien d'étages ? »", "« Au moins, moi, je travaille. »", "« Vos audiences baissent, non ? »", "« Pas mal, pour un type qui lit un prompteur. »", "« Vous voulez venir faire un tour en bas ? »"],
    provoke: ["« Envoyez vos monstres. J'ai faim. »", "« Votre donjon est un parc d'attractions pour enfants. »", "« Je finirai cet étage avant votre pause pub. »", "« Mes pièges préférés ? Ceux de votre scénariste. »", "« Même votre boss a l'air de s'ennuyer. »"],
    insult: ["« Chip, votre émission est aussi creuse que votre regard. »", "« Allez vous faire recycler, vous et vos sponsors. »", "« Je viendrai vous chercher en plateau. Personnellement. »", "« Votre moumoute, elle est sponsorisée aussi ? »", "« Le public ne vous aime pas. Il m'aime MOI. »"],
    refuse: ["« Pas de commentaire. »", "« Coupez la caméra. »"]
};

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
        provoke: ["« Vous avez faim ? » Chip claque des doigts. « Régie, envoyez-lui un invité. »", "« Parc d'attractions, hein ? Voici une attraction. »"],
        insult: ["Chip ne sourit plus. « Mesdames et messieurs, une prime spéciale sur la tête de notre invité. Chasseurs, à vous. »", "« Personnellement, dites-vous ? » Chip fait un signe. Un gobelin armé entre dans le champ."]
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
    module.exports = { SHOW_HOST, SHOW_TONES, SHOW_TAUNTS, SHOW_REPLIES, SHOW_REACTIONS, pickShowTaunt, fillShowTemplate };
}
