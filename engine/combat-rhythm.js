// engine/combat-rhythm.js — Qualificatifs en combat, séquenceur de tour en beats.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// QUALIFICATIFS EN COMBAT (chantier "refonte des objets" — catalogue itemQualifiers dans items.js)
// ==========================================
// Tous les chiffres viennent de getQualifierValues() (generator.js), la même source que le texte
// d'inspection (describeQualifier()) : ce qui est écrit sur l'objet est exactement ce qui se passe.

// Qualificatifs d'un objet, avec rang. Un objet construit à la main (tests) ou antérieur à la refonte
// n'a que `mechanics` : rang I par défaut.
function getItemQualifierList(item) {
    if (!item) return [];
    if (item.qualifiers) return item.qualifiers;
    return (item.mechanics || []).map(key => ({ key, rank: 1 }));
}

// Valeurs d'un qualificatif précis porté par un objet (null s'il ne le porte pas). `target` par défaut
// déduit de la catégorie (arme si inconnue, pour les objets de test sans catégorie).
function getItemQualifierValues(item, key, target = null) {
    const entry = getItemQualifierList(item).find(q => q.key === key);
    if (!entry) return null;
    return getQualifierValues(key, target || qualifierTarget(item.category) || 'weapon', entry.rank);
}

// Somme d'un champ d'un qualificatif passif sur tout l'équipement porté (arme, arme à distance,
// armure) — Silencieux, Véloce, Chanceux, Grinçant.
function sumEquippedQualifier(key, field) {
    const slots = [['weapon', 'weapon'], ['ranged', 'weapon'], ['armor', 'armor']];
    return slots.reduce((sum, [slot, target]) => {
        const values = getItemQualifierValues(gameState.equipment[slot], key, target);
        return sum + (values && values[field] ? values[field] : 0);
    }, 0);
}

// Effets déclenchables sur une cible donnée (pioche de Chaotique) : les procs de statut/soin, hors
// Chaotique lui-même et hors bonus de dégâts (Électrique/Explosif, résolus dans performPlayerAttack()).
function getRandomizableQualifiers(target) {
    return Object.keys(itemQualifiers).filter(key => {
        const block = itemQualifiers[key][target];
        return block && itemQualifiers[key].kind === 'proc' && !block.passive && !['random', 'shock', 'aoe'].includes(key);
    });
}

// Applique l'effet d'un qualificatif déclenché. `foe` : la cible de l'arme/du sort, ou l'attaquant pour
// une armure. `baseDamage` : dégâts du coup porté (arme/sort) ou encaissé (armure) — base des effets
// sur la durée et du vol de vie. `source` ('weapon' | 'armor' | 'spell') ne change que le message.
function resolveQualifierEffect(key, v, foe, baseDamage, source = 'weapon') {
    const byArmor = source === 'armor';
    foe.status = foe.status || {};
    switch (key) {
        case 'bleed':
            foe.status.bleed = { rounds: v.rounds, dmgPerRound: Math.max(1, Math.round(baseDamage * v.pct / 100)) };
            logEvent(byArmor ? `🩸 Les pointes de votre armure entaillent [${foe.name}] !` : `🩸 [${foe.name}] se met à ${source === 'spell' ? 'brûler' : 'saigner'} !`, "danger");
            break;
        case 'poison':
            foe.status.bleed = { rounds: v.rounds, dmgPerRound: Math.max(1, Math.round(baseDamage * v.pct / 100)) };
            logEvent(byArmor ? `☢️ Votre armure empoisonne [${foe.name}] au contact !` : `☢️ [${foe.name}] est empoisonné !`, "danger");
            break;
        case 'stun':
            foe.status.stunned = true;
            logEvent(byArmor ? `💫 Le choc en retour étourdit [${foe.name}] !` : `💫 [${foe.name}] est étourdi par le choc !`, "danger");
            break;
        case 'slow':
            foe.status.slowed = { rounds: v.rounds };
            logEvent(`🐌 [${foe.name}] est gelé sur place ! (ses dégâts −50 %)`, "danger");
            break;
        case 'pleasure_or_pain':
            foe.status.distracted = { rounds: v.rounds, miss: v.miss };
            logEvent(`😬 Un bourdonnement insupportable déconcentre [${foe.name}] !`, "danger");
            break;
        case 'light':
            foe.status.blinded = { rounds: v.rounds };
            logEvent(`✨ [${foe.name}] est ébloui par un éclat de lumière ! (DEF −50 %)`, "danger");
            break;
        case 'corrode':
            foe.status.corroded = { rounds: v.rounds };
            logEvent(`🧪 L'armure de [${foe.name}] se corrode ! (DEF −40 %)`, "danger");
            break;
        case 'fear':
            foe.status.feared = { rounds: v.rounds };
            logEvent(`😱 [${foe.name}] est pris de terreur ! (dégâts −35 %)`, "danger");
            break;
        case 'adrenaline':
            gameState.status.adrenaline = { rounds: v.rounds, mult: 1 + v.pct / 100 };
            logEvent(`💉 Une décharge d'adrénaline vous parcourt ! (dégâts +${v.pct} %)`, "success");
            break;
        case 'heal': {
            const actualHeal = applyPlayerHeal(Math.max(1, Math.round(gameState.maxHp * v.pct / 100)));
            logEvent(`💚 ${byArmor ? 'Votre armure' : 'Votre arme'} régénère vos blessures (+${actualHeal} PV).`, "success");
            break;
        }
        case 'lifesteal': {
            const actualHeal = applyPlayerHeal(Math.max(1, Math.round(baseDamage * v.pct / 100)));
            if (actualHeal > 0) logEvent(`🧛 ${byArmor ? 'Votre armure siphonne' : 'Vous volez'} ${actualHeal} PV${byArmor ? '' : ` à [${foe.name}]`}.`, "success");
            break;
        }
        case 'drain': {
            // Pourcentages de l'ATQ D'ORIGINE (mémorisée au premier drain), pas cumulés en cascade :
            // le plafond affiché (−40 %) est exactement le plafond réel.
            const drained = foe.drainedPct || 0;
            const step = Math.min(v.pct, v.cap - drained);
            if (step <= 0) break;
            if (foe.atkBeforeDrain === undefined) foe.atkBeforeDrain = foe.atk;
            foe.drainedPct = drained + step;
            foe.atk = Math.max(1, Math.round(foe.atkBeforeDrain * (1 - foe.drainedPct / 100)));
            logEvent(`🌀 Vous drainez [${foe.name}] : ATQ −${step} % (total −${foe.drainedPct} %).`, "info");
            break;
        }
    }
}

// Qualificatifs d'un objet déclenchés par UN coup : arme/sort après un coup porté, armure après un
// coup encaissé. Chaque qualificatif a sa PROPRE chance, indépendante des autres.
function triggerItemQualifiers(item, target, foe, baseDamage) {
    getItemQualifierList(item).forEach(({ key, rank }) => {
        const q = itemQualifiers[key];
        const v = getQualifierValues(key, target, rank);
        if (!q || !v || q.kind !== 'proc' || ['shock', 'aoe'].includes(key)) return;
        if (v.passive) {
            resolveQualifierEffect(key, v, foe, baseDamage, target); // Vampirique : chaque coup, sans jet
            return;
        }
        if (Math.random() * 100 >= v.chance) return;
        if (key === 'random') {
            const pool = getRandomizableQualifiers(target);
            const picked = pool[Math.floor(Math.random() * pool.length)];
            logEvent(`🎲 Chaotique : ${itemQualifiers[picked].name} !`, "info");
            resolveQualifierEffect(picked, getQualifierValues(picked, target, rank), foe, baseDamage, target);
            return;
        }
        resolveQualifierEffect(key, v, foe, baseDamage, target);
    });
}

// Qualificatifs de l'arme (ou du sort) qui vient de toucher. Appelée uniquement après une attaque
// réussie (performPlayerAttack() a renvoyé vrai). Pas de updateUI() ici : ne pas écraser l'affichage
// des PV avant que l'animation du coup n'arrive à destination.
function applyWeaponMechanic(weaponOverride = null) {
    const weapon = weaponOverride || gameState.equipment.weapon;
    const enemy = gameState.currentEnemy;
    if (!weapon || !enemy) return;
    triggerItemQualifiers(weapon, qualifierTarget(weapon.category) || 'weapon', enemy, gameState._lastPlayerDamage || 0);
}

// Qualificatifs de l'armure portée, à chaque coup encaissé (appelée après la riposte d'un mob, et après
// chaque frappe d'un boss). Épineux renvoie une part des dégâts sans jamais achever l'attaquant : la
// mort d'un mob se résout toujours sur une action du joueur ou un effet sur la durée.
function applyArmorMechanic(attacker, incomingDamage) {
    const armor = gameState.equipment.armor;
    if (!armor || !attacker || gameState.hp <= 0) return;
    const thorns = getItemQualifierValues(armor, 'thorns', 'armor');
    if (thorns && incomingDamage > 0 && attacker.hp > 1) {
        const reflected = Math.min(attacker.hp - 1, Math.max(1, Math.round(incomingDamage * thorns.pct / 100)));
        attacker.hp -= reflected;
        logEvent(`🌵 Votre armure épineuse renvoie ${reflected} dégâts à [${attacker.name}].`, "info");
    }
    triggerItemQualifiers(armor, 'armor', attacker, incomingDamage);
}

// Ténébreux (armure) : chance d'esquiver complètement une attaque ennemie.
function rollPlayerDodge(enemy) {
    // Disparition (Filou, chantier 13) : toute la riposte de ce tour (toutes ses frappes) est esquivée ; chaque tour esquivé consomme une charge.
    const vanish = gameState.status.vanish;
    if (vanish && (vanish.dodging || vanish.turns > 0)) {
        if (!vanish.dodging) { vanish.turns -= 1; vanish.dodging = true; }
        logEvent(`🎭 Vous n'êtes déjà plus là : l'attaque de [${enemy.name}] frappe le vide !`, "success");
        return true;
    }
    const values = getItemQualifierValues(gameState.equipment.armor, 'darkness', 'armor');
    if (!values || Math.random() * 100 >= values.chance) return false;
    logEvent(`🌑 Vous vous fondez dans l'ombre et esquivez l'attaque de [${enemy.name}] !`, "success");
    return true;
}

// Ralenti (Gelé) et apeuré (Terrifiant) réduisent les dégâts de l'ennemi ; chaque état perd un tour à
// chaque riposte. Commun aux mobs et aux boss (voir performBossCounterAttack()).
function consumeEnemyAttackDebuffs(enemy) {
    let mult = 1;
    let note = "";
    const status = enemy.status || {};
    if (status.slowed && status.slowed.rounds > 0) {
        mult *= 0.5;
        note += " (ralenti)";
        status.slowed.rounds -= 1;
        if (status.slowed.rounds <= 0) status.slowed = null;
    }
    if (status.feared && status.feared.rounds > 0) {
        mult *= 0.65;
        note += " (apeuré)";
        status.feared.rounds -= 1;
        if (status.feared.rounds <= 0) status.feared = null;
    }
    // Bras touché (Point faible, chantier 6 V2) : ATQ réduite quelques tours.
    if (status.weakened && status.weakened.rounds > 0) {
        mult *= status.weakened.mult;
        note += " (bras touché)";
        status.weakened.rounds -= 1;
        if (status.weakened.rounds <= 0) status.weakened = null;
    }
    return { mult, note };
}

// Coût en mana effectif d'un sort (Économe le réduit).
function getSpellManaCost(spell) {
    if (!spell) return 0;
    const thrifty = getItemQualifierValues(spell, 'thrifty', 'spell');
    const cost = thrifty ? Math.max(1, Math.round(spell.manaCost * (1 - thrifty.pct / 100))) : spell.manaCost;
    const classMult = originClassEffects().manaCostMult; // Occultiste de foire : coût en mana −10 % (style)
    return classMult ? Math.max(1, Math.round(cost * classMult)) : cost;
}

// Tente d'appliquer un effet de statut au joueur selon le trait élémentaire du monstre
// (burn/poison/slow/stun/bleed/confusion/pull/light, définis dans mobModifiers). Appelée après
// une riposte ennemie réussie.
function applyMobEffectOnPlayer(enemy) {
    if (!enemy.effect) return;
    const triggerChance = 25; // 25% de chance que le trait élémentaire du monstre fasse effet
    if (Math.random() * 100 >= triggerChance) return;
    // Tenace (qualificatif d'armure) : chance de résister à l'effet qui allait s'appliquer.
    const tenacious = getItemQualifierValues(gameState.equipment.armor, 'tenacious', 'armor');
    if (tenacious && Math.random() * 100 < tenacious.chance) {
        logEvent(`🛡️ Tenace, vous résistez à l'effet de [${enemy.name}].`, "success");
        return;
    }

    switch (enemy.effect) {
        case 'burn':
            gameState.status.bleed = { rounds: 3, dmgPerRound: 5 };
            logEvent("🔥 Vous prenez feu ! La brûlure va vous ronger quelques instants.", "danger");
            break;
        case 'poison':
            gameState.status.bleed = { rounds: 4, dmgPerRound: 4 };
            logEvent("☢️ Une sensation toxique se propage en vous.", "danger");
            break;
        case 'slow':
            gameState.status.slowed = { rounds: 2 };
            logEvent("🐌 Vos mouvements sont englués, vous vous sentez ralenti.", "danger");
            break;
        case 'stun':
            gameState.status.stunned = true;
            logEvent("⚡ Le choc vous étourdit !", "danger");
            break;
        case 'bleed':
            // Réutilise le même compteur générique que burn/poison (dégâts sur la durée),
            // avec un profil de dégâts plus lourd sur une durée plus courte.
            gameState.status.bleed = { rounds: 2, dmgPerRound: 7 };
            logEvent("🩸 Une profonde entaille vous fait perdre du sang !", "danger");
            break;
        case 'confusion':
            gameState.status.confused = { rounds: 2 };
            logEvent("🌀 Votre esprit s'embrouille, vous ne savez plus où frapper.", "danger");
            break;
        case 'pull':
            gameState.status.disarmed = { rounds: 2 };
            logEvent("🧲 Une force invisible arrache votre arme des mains !", "danger");
            break;
        case 'light':
            gameState.status.blinded = { rounds: 2 };
            logEvent("✨ Ébloui, vous peinez à parer les coups qui suivent.", "danger");
            break;
        case 'corrode':
            gameState.status.corroded = { rounds: 3 };
            logEvent("🧪 Une substance corrosive ronge votre armure ! (DEF réduite)", "danger");
            break;
        case 'fear':
            gameState.status.feared = { rounds: 3 };
            logEvent("😱 Un frisson de terreur vous paralyse ! (ATQ réduite)", "danger");
            break;
    }
}

// Alias historique de la pause action -> riposte, désormais piloté par config.combatRhythm
// (voir runCombatBeats() ci-dessous) plutôt qu'une constante figée. Conservé tel quel pour les
// setTimeout(..., COMBAT_BEAT_MS) de fin de combat/mort, non restructurés en beats (voir
// performBossCounterAttackInner()/resolveEnemyCounterAttack() : un décès termine la séquence, il n'a
// pas besoin d'un "beat" de plus avant l'écran Game Over).
const COMBAT_BEAT_MS = config.combatRhythm.beatActionToRiposte;

// Empêche de spammer les boutons de combat pendant la petite pause entre deux actions
function setCombatInputLocked(locked) {
    [ui.btnAttackWeapon, ui.btnAttackRanged, ui.btnAttackUnarmed, ui.btnAttackMagic, ui.btnSprint, ui.btnRetreat, ui.btnEngage, ui.btnFlee, ui.btnOccasion, ui.btnClassAbility].forEach(btn => {
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('opacity-40', locked);
        btn.classList.toggle('pointer-events-none', locked);
    });
}

// ==========================================
// SÉQUENCEUR DE TOUR EN BEATS (chantier "lisibilité combat")
// ==========================================
// Remplace l'ancien modèle "tout s'affiche en 0ms puis un verrou fixe de 400ms" par une petite file
// d'étapes espacées dans le temps. Volontairement construit sur des callbacks + setTimeout (comme le
// COMBAT_BEAT_MS déjà existant), JAMAIS sur des Promises/async-await : une vraie Promise diffère
// TOUJOURS sa continuation en microtâche, même résolue de façon synchrone — un test qui appelle une
// fonction de riposte en synchrone (voir tests/regression/combat-boss.js, combat-enrage.js...) et lit
// gameState.hp juste après casserait silencieusement. En callbacks purs, un stub
// `global.setTimeout = (fn) => fn();` (voir tests/long_playthrough.js, repris dans
// tests/regression/_helpers.js pour ce chantier) rend toute la chaîne synchrone d'un bout à l'autre
// sous Node, sans toucher un seul test existant.
//
// `steps` : tableau de `{ run, delay, skippable }`. `delay` est la pause AVANT que ce step ne
// s'exécute (pas après) — un step au tout début de la liste avec un delay standard reproduit donc
// exactement le comportement historique "verrouiller, attendre, puis résoudre". `skippable` (par
// défaut true, Chantier 9) : un step qui ne le désactive PAS explicitement (`skippable: false`) voit
// son délai ramené à 0 dès que combatSkipRequested est vrai — un `setTimeout(..., 0)` plutôt qu'un
// appel synchrone direct, pour rester un vrai callback asynchrone (cohérent avec le reste de la
// chaîne, et sans particularité sous le stub de test qui exécute de toute façon tout en synchrone).
// Les beats de mort/fin de combat (voir strikeAndCheckDeath()/resolveNonBossCounterAttack()/
// performPlayerAttack()) ne passent jamais par ce tableau — ils restent donc structurellement à
// l'abri du skip sans qu'aucun step n'ait besoin de poser `skippable: false` explicitement.
let combatSkipRequested = false;

// Marque une demande de skip pour le tour de beats EN COURS — drapeau MODULE-LEVEL (pas gameState,
// même convention que mobExamineOpen) : préférence d'affichage purement transitoire, jamais persistée
// ni lue par la logique de jeu. Remis à faux au tout début du PROCHAIN tour verrouillé
// (enemyCounterAttack()/triggerMobEnrage()), pour qu'un clic qui a démarré ce tour-ci (bulle jusqu'à
// #combat-zone) ne "pré-skippe" jamais le tour SUIVANT.
function requestCombatSkip() {
    if (gameState.pendingMinigame) return; // Espace/Entrée appartiennent alors à l'épreuve ouverte (minigames-ui.js)
    if (gameState.inCombat) combatSkipRequested = true;
}

function runCombatBeats(steps, onDone) {
    function playStep(index) {
        if (index >= steps.length) {
            if (onDone) onDone();
            return;
        }
        const step = steps[index];
        // Étape interactive (chantier 6, mini-jeux) : `run(done)` ouvre une épreuve et rappelle `done` à sa fin
        // (tout de suite en jet automatique) ; le tour reprend alors, sans délai ni skip de combat (le joueur
        // a la main, le skip de l'épreuve est le sien : Passer / Échap).
        if (step.interactive) { step.run(() => playStep(index + 1)); return; }
        const skip = combatSkipRequested && step.skippable !== false;
        setTimeout(() => {
            step.run();
            playStep(index + 1);
        }, skip ? 0 : (step.delay || 0));
    }
    playStep(0);
}

// Riposte de l'ennemi : verrouille les boutons, puis laisse resolveEnemyCounterAttack() dérouler sa
// propre séquence de beats (un seul beat pour un mob normal, plusieurs pour un pattern de boss) —
// c'est ELLE qui décide du rythme exact (télégraphe, multi-coups...), pas ce point d'entrée.
// onDone (chantier "lisibilité combat", Chantier 7) déverrouille ET rafraîchit l'UI en un seul point
// centralisé — jusqu'ici seul resolveNonBossCounterAttack() appelait updateUI() en fin de riposte
// (dans son propre beat), ce qui laissait les patterns de boss (7 branches dans
// performBossCounterAttackInner(), aucune n'appelant updateUI()) sans AUCUN rafraîchissement après un
// tour de boss complet : télégraphe posé, badges d'état, jauge de tension et badge de phase restaient
// figés sur leur état d'AVANT le tour jusqu'à ce qu'un événement sans rapport force un rendu — bug
// réel, confirmé par un script de vérification (attaques répétées sur un vrai setTimeout), pas
// seulement théorique. Centraliser ici plutôt que de rajouter updateUI() dans chacune des branches.
function enemyCounterAttack() {
    if (!gameState.currentEnemy) return; // sécurité si le combat vient d'être résolu
    combatSkipRequested = false; // Chantier 9 : jamais de skip qui fuite d'un tour précédent (ou du clic qui a déclenché celui-ci)
    setCombatInputLocked(true);
    resolveEnemyCounterAttack(() => {
        endClassDefenseTurn(); // Disparition / Encaisser : valables pour CETTE riposte seulement
        setCombatInputLocked(false);
        updateUI();
    });
}
