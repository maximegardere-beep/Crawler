// demon-ui.js — tests régression : chantier 17, lot 3 (interface de stress du combat contre Gorgoth le Concierge).
// Modèle pur demonHudModel() (sans DOM), HTML pur des chaînes et des Cicatrices, et updateDemonUI() / devPreviewDemonHud()
// sur le stub DOM avec un gameState.demonFight simulé (le moteur du lot 2 n'est pas requis).
const { assert, resetTransientState } = require('./_helpers.js');

const DEMON = { isDemon: true, isBoss: true, baseName: 'Gorgoth le Concierge', name: 'Gorgoth le Concierge', demonFinal: false, hp: 450, maxHp: 500 };
const fight = (over = {}) => Object.assign({
    act: 1, maxActs: 3, final: false, emprise: 10,
    intent: { key: 'scythe', hidden: false, revealed: false },
    countdown: null, chainsLeft: 4, possessedThisTurn: false,
    dmgByStyle: { melee: 0, ranged: 0, magic: 0, unarmed: 0 }
}, over);
const enemy = (over = {}) => Object.assign({}, DEMON, over);

// --- Visibilité ---
{
    assert(demonHudModel(null, enemy(), null).visible === false, "HUD démon : masqué sans demonFight");
    assert(demonHudModel(fight(), null, null).visible === false, "HUD démon : masqué sans ennemi");
    assert(demonHudModel(fight(), { name: 'Rat', hp: 5, maxHp: 5 }, null).visible === false, "HUD démon : masqué si l'ennemi n'est pas isDemon");
    assert(demonHudModel(fight(), enemy(), null).visible === true, "HUD démon : visible contre Gorgoth");
}

// --- Intentions : libellés, conseils, masquée / révélée ---
{
    const expected = {
        scythe: ['Fauche', 'Recule !'], blaze: ['Brasier', 'Colle-toi à lui !'], grip: ['Emprise', 'Magie ou volonté !'],
        guard: ['Garde', 'Charge pour briser la garde !'], whip: ['Fouet', 'Il va te ramener à lui']
    };
    Object.keys(expected).forEach(key => {
        const m = demonHudModel(fight({ intent: { key, hidden: false, revealed: false } }), enemy(), null);
        assert(m.intent.name === expected[key][0] && m.intent.hint === expected[key][1] && m.intent.icon && !m.intent.masked, `Intention ${key} : nom, conseil et icône`);
    });
    const masked = demonHudModel(fight({ intent: { key: 'blaze', hidden: true, revealed: false } }), enemy(), null);
    assert(masked.intent.masked && masked.intent.name === '???' && masked.intent.tone === 'hidden', "Intention masquée et non révélée : « ??? »");
    assert(!/Brasier|Colle-toi/.test(masked.intent.name + masked.intent.hint), "Intention masquée : ne trahit pas la vraie intention");
    const revealed = demonHudModel(fight({ intent: { key: 'blaze', hidden: true, revealed: true } }), enemy(), null);
    assert(!revealed.intent.masked && revealed.intent.revealed && revealed.intent.name === 'Brasier', "Intention masquée puis révélée : vrai nom, marquée révélée");
    assert(demonHudModel(fight({ intent: null }), enemy(), null).intent === null, "Pas d'intention : bannière absente");
    const unknown = demonHudModel(fight({ intent: { key: 'inconnue' } }), enemy(), null);
    assert(unknown.intent && unknown.intent.name && !unknown.intent.masked, "Intention inconnue : libellé générique, sans erreur");
}

// --- Actes ---
{
    assert(demonHudModel(fight({ act: 1 }), enemy(), null).actLabel === 'Acte I', "Acte I");
    assert(demonHudModel(fight({ act: 2 }), enemy(), null).actLabel === 'Acte II', "Acte II");
    assert(demonHudModel(fight({ act: 3 }), enemy(), null).actLabel === 'Acte III', "Acte III");
    const last = demonHudModel(fight({ act: 4, maxActs: 4, final: true }), enemy({ demonFinal: true }), null);
    assert(last.actLabel === 'Acte IV — Dernier souffle' && last.final, "Acte IV : « Dernier souffle », forme finale");
    assert(demonHudModel(fight({ act: 4, maxActs: 3 }), enemy(), null).act === 3, "Acte borné par maxActs");
    assert(demonHudModel(fight({ act: 0 }), enemy(), null).act === 1, "Acte borné à 1");
    assert(demonHudModel(fight(), enemy(), null).actMarks.join(',') === '66,33', "Repères d'acte : 66 % et 33 %");
    assert(last.actMarks.join(',') === '66,33,15', "Étage 18 : repère supplémentaire à 15 %");
}

// --- Compte à rebours ---
{
    assert(!demonHudModel(fight({ act: 2, countdown: 5 }), enemy(), null).countdown.show, "Compte à rebours masqué avant l'acte III");
    const c5 = demonHudModel(fight({ act: 3, countdown: 5 }), enemy(), null).countdown;
    assert(c5.show && c5.value === 5 && !c5.urgent && !c5.critical, "Acte III, 5 tours : affiché, calme");
    const c2 = demonHudModel(fight({ act: 3, countdown: 2 }), enemy(), null).countdown;
    assert(c2.urgent && !c2.critical, "2 tours : s'affole");
    const c1 = demonHudModel(fight({ act: 3, countdown: 1 }), enemy(), null).countdown;
    assert(c1.urgent && c1.critical, "1 tour : critique");
    assert(!demonHudModel(fight({ act: 3, countdown: null }), enemy(), null).countdown.show, "Compte à rebours null : masqué");
    assert(demonHudModel(fight({ act: 3, countdown: -3 }), enemy(), null).countdown.value === 0, "Compte à rebours borné à 0");
}

// --- Pourcentages bornés, Emprise, chaînes ---
{
    const over = demonHudModel(fight({ emprise: 180 }), enemy({ hp: 900, maxHp: 500 }), null);
    assert(over.emprise === 100 && over.hpPct === 100, "Emprise et PV bornés à 100 %");
    const under = demonHudModel(fight({ emprise: -20 }), enemy({ hp: -5 }), null);
    assert(under.emprise === 0 && under.hpPct === 0, "Emprise et PV bornés à 0 %");
    const nan = demonHudModel(fight({ emprise: 'abc' }), enemy({ hp: undefined, maxHp: 0 }), null);
    assert(nan.emprise === 0 && nan.hpPct >= 0 && nan.hpPct <= 100, "Valeurs invalides : bornées sans NaN");
    assert(demonHudModel(fight(), enemy({ hp: 250, maxHp: 500 }), null).hpPct === 50, "PV : pourcentage exact");
    assert(demonHudModel(fight({ emprise: 0 }), enemy(), null).empriseColor === '#8b5cf6', "Emprise 0 : violet");
    assert(demonHudModel(fight({ emprise: 100 }), enemy(), null).empriseColor === '#dc2626', "Emprise 100 : rouge");
    const e75 = demonHudModel(fight({ emprise: 75 }), enemy(), null), e76 = demonHudModel(fight({ emprise: 76 }), enemy(), null);
    assert(!e75.emprisePulse && e76.emprisePulse, "Pulsation de la jauge au-delà de 75");
    assert(!demonHudModel(fight({ emprise: 59 }), enemy(), null).heartbeat && demonHudModel(fight({ emprise: 60 }), enemy(), null).heartbeat, "Battement dès 60 d'Emprise");
    const v0 = demonHudModel(fight({ emprise: 0 }), enemy(), null).veilOpacity, v100 = demonHudModel(fight({ emprise: 100 }), enemy(), null).veilOpacity;
    assert(v0 === 0 && v100 > 0.5 && v100 <= 1, "Voile : transparent sans Emprise, marqué à 100");
    const ch = demonHudModel(fight({ chainsLeft: 2 }), enemy(), null);
    assert(ch.chainsLeft === 2 && ch.chains.length === 4 && ch.chains.filter(Boolean).length === 2, "Chaînes : 2 intactes sur 4");
    assert(demonHudModel(fight({ chainsLeft: 9 }), enemy(), null).chainsLeft === 4 && demonHudModel(fight({ chainsLeft: -1 }), enemy(), null).chainsLeft === 0, "Chaînes bornées 0-4");
    const html = buildDemonChainsHtml(ch);
    assert((html.match(/is-intact/g) || []).length === 2 && (html.match(/is-broken/g) || []).length === 2 && html.includes('width:'), "HTML des chaînes : 2 intactes, 2 brisées, remplissage");
    const act2 = demonHudModel(fight({ act: 2, chainsLeft: 0 }), enemy(), null);
    assert(!act2.showChains && !buildDemonChainsHtml(act2).includes('demon-chain-row') && buildDemonChainsHtml(act2).includes('demon-hp-track'), "Après l'acte I, chaînes toutes brisées : rangée masquée, barre gardée");
    assert(ch.showChains, "Acte I : rangée de chaînes affichée");
    assert(demonHudModel(fight({ possessedThisTurn: true }), enemy(), null).possessed, "Possession reprise du demonFight");
}

// --- Cicatrices ---
{
    assert(demonHudModel(fight(), enemy(), null).scars.length === 0, "Aucune Cicatrice sans gameState.demon");
    const m = demonHudModel(fight(), enemy(), { scars: { melee: 2, ranged: 0, magic: 5, unarmed: 1 } });
    assert(m.scars.length === 3, "Cicatrices : seuls les styles marqués");
    const melee = m.scars.find(s => s.style === 'melee'), magic = m.scars.find(s => s.style === 'magic'), unarmed = m.scars.find(s => s.style === 'unarmed');
    assert(melee.rank === 2 && melee.pips === '●●○' && melee.resistPct === 40, "Cicatrice mêlée cran 2 : 40 % de résistance");
    assert(/40 %/.test(melee.title) && /\+30 %/.test(melee.title) && /Distance/.test(melee.title), "Infobulle mêlée : résistance 40 %, faiblesse +30 % à distance");
    assert(magic.rank === 3 && /60 %/.test(magic.title) && /ignore leurs effets/.test(magic.title) && /Mains nues/.test(magic.title), "Cicatrice magie bornée au cran 3 : immunité aux effets, faiblesse mains nues");
    assert(unarmed.rank === 1 && /20 %/.test(unarmed.title) && /Magie/.test(unarmed.title), "Cicatrice mains nues cran 1 : faiblesse magie");
    const scarsHtml = buildDemonScarsHtml(m);
    assert((scarsHtml.match(/class="demon-scar"/g) || []).length === 3 && scarsHtml.includes('title="'), "HTML des Cicatrices : une pastille par style avec infobulle");
    assert(describeDemonScar('melee', 0).includes('aucune') && describeDemonScar('inconnu', 2) === '', "describeDemonScar() : cran 0 et style inconnu");
}

// --- updateDemonUI() sur le stub DOM ---
{
    resetTransientState();
    const hud = document.getElementById('demon-hud');
    const veil = document.getElementById('demon-emprise-veil');
    let threw = null;
    try {
        gameState.demonFight = null;
        updateDemonUI();
    } catch (e) { threw = e; }
    assert(!threw && hud.classList.contains('hidden') && veil.classList.contains('hidden'), "updateDemonUI() : demonFight null -> HUD et voile masqués, sans erreur");

    threw = null;
    const realEnemy = gameState.currentEnemy;
    const realPlaySfx = global.playSfx;
    const played = [];
    global.playSfx = (key) => { played.push(key); return false; };
    try {
        gameState.currentEnemy = enemy({ hp: 100, maxHp: 500 });
        gameState.demonFight = fight({ act: 3, emprise: 85, countdown: 2, chainsLeft: 0, intent: { key: 'scythe', hidden: false, revealed: false } });
        gameState.demon = { encounters: 1, knockouts: 1, expulsions: 0, scars: { melee: 1, ranged: 0, magic: 0, unarmed: 0 }, lastFloorFought: 4 };
        if (gameState.occasion) gameState.occasion.turn = 7;
        updateDemonUI();
    } catch (e) { threw = e; }
    assert(!threw, "updateDemonUI() : combat simulé sans erreur" + (threw ? ` (${threw.message})` : ''));
    assert(!hud.classList.contains('hidden') && !veil.classList.contains('hidden'), "updateDemonUI() : HUD et voile visibles en combat démoniaque");
    assert(document.getElementById('demon-act-label').textContent === 'Acte III', "updateDemonUI() : indicateur d'acte écrit");
    assert(document.getElementById('demon-intent-name').textContent === 'Fauche' && document.getElementById('demon-intent-hint').textContent === 'Recule !', "updateDemonUI() : bannière d'intention écrite");
    assert(document.getElementById('demon-countdown-value').textContent === '2' && document.getElementById('demon-countdown').classList.contains('demon-countdown-urgent'), "updateDemonUI() : compte à rebours qui s'affole");
    assert(document.getElementById('demon-emprise-track').classList.contains('demon-emprise-pulse'), "updateDemonUI() : jauge qui pulse à 85");
    assert(Number(veil.style.opacity) > 0.5, "updateDemonUI() : opacité du voile suit l'Emprise");
    assert(document.getElementById('demon-scars').innerHTML.includes('demon-scar'), "updateDemonUI() : Cicatrices affichées");
    assert(played.filter(k => k === 'demonHeartbeat').length === 1, "Battement : un son au premier rendu au-dessus de 60");
    updateDemonUI(); updateDemonUI();
    assert(played.filter(k => k === 'demonHeartbeat').length === 1, "Battement : au plus un par tour (rendus répétés)");
    if (gameState.occasion) {
        gameState.occasion.turn = 8;
        updateDemonUI();
        assert(played.filter(k => k === 'demonHeartbeat').length === 2, "Battement : un nouveau au tour suivant");
    }
    gameState.demonFight.possessedThisTurn = true;
    updateDemonUI();
    assert(veil.classList.contains('demon-veil-possess'), "Possession : flash violet du voile");
    gameState.demonFight.intent = { key: 'grip', hidden: true, revealed: false };
    updateDemonUI();
    assert(document.getElementById('demon-intent-name').textContent === '???', "updateDemonUI() : intention masquée -> « ??? »");

    // updateUI() masque le HUD hors combat démoniaque.
    gameState.demonFight = null;
    gameState.currentEnemy = realEnemy;
    updateUI();
    assert(hud.classList.contains('hidden') && veil.classList.contains('hidden'), "updateUI() : HUD masqué hors combat démoniaque");

    // devPreviewDemonHud() : pose un état simulé et rafraîchit.
    threw = null;
    let preview = null;
    try { preview = devPreviewDemonHud({ act: 3, emprise: 85, countdown: 2, intent: { key: 'scythe' } }); } catch (e) { threw = e; }
    assert(!threw && preview && preview.visible && preview.act === 3 && preview.emprise === 85 && preview.countdown.value === 2 && preview.intent.name === 'Fauche', "devPreviewDemonHud() : modèle simulé cohérent");
    assert(gameState.currentEnemy && gameState.currentEnemy.isDemon && gameState.currentEnemy.baseName === 'Gorgoth le Concierge', "devPreviewDemonHud() : ennemi marqué isDemon");

    global.playSfx = realPlaySfx;
    delete gameState.demonFight;
    delete gameState.demon;
    gameState.currentEnemy = null;
    hideDemonHud();
    resetTransientState();
}
