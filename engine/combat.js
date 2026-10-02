// engine/combat.js — Combat : tour, distance, enrage.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// 5. SYSTÈME DE COMBAT
// ==========================================

// Icônes associées à chaque effet élémentaire/mental de mobModifiers (voir bestiary.js), pour le
// panneau compact affiché sur la carte pendant un combat.
const EFFECT_ICONS = {
    burn: '🔥', poison: '☠️', slow: '🐌', stun: '⚡', fear: '😱',
    confusion: '🌀', pull: '🧲', light: '✨', corrode: '🧪'
};
const EFFECT_LABELS = {
    burn: 'Brûlure', poison: 'Poison', slow: 'Ralentissement', stun: 'Étourdissement', fear: 'Peur',
    confusion: 'Confusion', pull: 'Attraction', light: 'Aveuglement', corrode: 'Corrosion'
};

let mobExamineOpen = false; // État transitoire du bouton "Examiner" (pas de sauvegarde nécessaire)

// Construit le panneau compact des infos du mob, sous la scène de combat (#combat-mob-info) :
// seulement des icônes/chiffres résumant l'ennemi, plus un bouton "Examiner" qui déplie les
// détails textuels (description des modificateurs, effet) à la demande.
function renderCombatMobPanel() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return;
    mobExamineOpen = false;

    const rangeIcon = enemy.ranged ? '🏹' : '🗡️';
    const rangeLabel = enemy.ranged ? 'DIST' : 'CAC';
    const modifiers = enemy.modifiersApplied || [];
    const eliteChip = isEliteMob(enemy)
        ? `<span class="px-1.5 py-0.5 rounded bg-stone-900 border border-red-600 text-red-500">💀 DANGEREUX</span>`
        : '';
    const effectChip = enemy.effect
        ? `<span class="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-400 text-purple-800">${EFFECT_ICONS[enemy.effect] || '❔'} ${EFFECT_LABELS[enemy.effect] || enemy.effect}</span>`
        : '';
    const modifierChips = modifiers.map(m => `<span class="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-400 text-stone-700">🏷️ ${m.name}</span>`).join('');

    ui.combatMobInfo.innerHTML = `
        <div class="flex flex-wrap justify-center gap-1 text-[10px] font-bold">
            ${eliteChip}
            <span class="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-400 text-stone-700">${rangeIcon} ${rangeLabel}</span>
            <span class="px-1.5 py-0.5 rounded bg-red-100 border border-red-400 text-red-700">⚔️ +${enemy.atk}</span>
            <span class="px-1.5 py-0.5 rounded bg-blue-100 border border-blue-400 text-blue-700">🛡️ +${enemy.def}</span>
            ${effectChip}
            ${modifierChips}
        </div>
        <button id="btn-examine-mob" class="mt-2 w-full min-h-[44px] text-[10px] uppercase tracking-wider bg-stone-800 text-stone-100 rounded px-2 py-1 hover:bg-stone-700">🔍 Examiner</button>
        <div id="mob-examine-details" class="hidden mt-2 text-[10px] leading-snug text-stone-600 italic space-y-1"></div>
    `;

    const btn = document.getElementById('btn-examine-mob');
    const details = document.getElementById('mob-examine-details');
    if (btn && details) {
        btn.addEventListener('click', () => {
            mobExamineOpen = !mobExamineOpen;
            if (mobExamineOpen) {
                const lines = [`${enemy.name} — PV ${Math.round(enemy.hp)}/${enemy.maxHp || enemy.hp}, ATQ ${enemy.atk}, DEF ${enemy.def}, ${enemy.ranged ? 'combat à distance' : 'combat au corps à corps'}.`];
                modifiers.forEach(m => { if (m.desc) lines.push(`${m.name} : ${m.desc}`); });
                if (enemy.effect) lines.push(`Pouvoir : ${EFFECT_LABELS[enemy.effect] || enemy.effect}.`);
                details.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
                details.classList.remove('hidden');
                btn.innerText = '🔼 Masquer';
            } else {
                details.classList.add('hidden');
                btn.innerText = '🔍 Examiner';
            }
        });
    }
}

// Badges d'état ennemi (chantier "lisibilité combat", Chantier 2) : remplace l'ancien texte
// concaténé (#combat-enemy-status, renommé #enemy-status-icons) par des badges individuels avec
// infobulle (title), pour que chaque état reste identifiable au survol plutôt qu'une suite d'emoji
// sans légende. Couvre les statuts déjà existants (saignement/étourdi/ralenti/ébloui/corrodé/apeuré)
// ET les états posés par les Chantiers 2-3 du rework combat, jamais affichés avant ce chantier
// (garde hérissée, folie, enrage, télégraphe actif — redondant avec la bannière du Chantier 1, mais
// utile pour qui ne regarde que le panneau latéral). Seule fonction à toucher #enemy-status-icons.
function renderEnemyStatusBadges(enemy) {
    if (!ui.enemyStatusIcons) return;
    const status = enemy && enemy.status;
    if (!status) {
        ui.enemyStatusIcons.innerHTML = "";
        return;
    }
    const badges = [];
    const add = (active, icon, title) => { if (active) badges.push({ icon, title }); };
    add(status.bleed && status.bleed.rounds > 0, "🔥", "Saignement");
    add(status.stunned, "💫", "Étourdi");
    add(status.immobilized && status.immobilized.rounds > 0, "🤼", "Immobilisé (ne peut pas riposter)");
    add(status.weakened && status.weakened.rounds > 0, "💪", "Affaibli (ATQ réduite)");
    add(status.exposed && status.exposed.rounds > 0, "🎯", "Exposé (DEF −30 %)");
    add(status.slowed && status.slowed.rounds > 0, "🐌", "Ralenti");
    add(status.blinded && status.blinded.rounds > 0, "✨", "Ébloui");
    add(status.corroded && status.corroded.rounds > 0, "🧪", "Corrodé (DEF réduite)");
    add(status.feared && status.feared.rounds > 0, "😱", "Apeuré (ATQ réduite)");
    add(status.defBuffed && status.defBuffed.rounds > 0, "🛡️", "Garde hérissée (DEF augmentée)");
    add(status.frenzied, "🤪", "Folie (phase 3 : dégâts +40%, DEF -30%)");
    add(status.enraged && status.enraged.rounds > 0, "😡", "Enragé (dégâts +40%, DEF divisée par 2)");
    add(status.telegraph, "👁️", "Attaque télégraphiée en cours (voir la bannière)");
    ui.enemyStatusIcons.innerHTML = badges.length
        ? badges.map(b => `<span title="${b.title}">${b.icon}</span>`).join('')
        : "";
}

// Jauge de tension anti-kite (chantier "lisibilité combat", Chantier 5) : montre la probabilité
// d'enrage AVANT qu'il n'arrive, pour que le joueur voie la tension monter plutôt que de subir la
// ruée sans prévenir. Trois états mutuellement exclusifs (voir noteMobKitingRound()/
// triggerMobEnrage()/endMobEnrage() pour la mécanique sous-jacente) :
//   - enraged actif : badge rouge fixe, plus de jauge (l'enrage a déjà eu lieu).
//   - enrageCooldown actif : badge gris (repos forcé, aucun nouveau tirage possible).
//   - kitingRounds au-dessus de sa base (mobKitingBaseline()) : jauge + % calculé avec les mêmes
//     valeurs RÉELLES que noteMobKitingRound() (config.distanceEnrage), jamais redupliquées en dur.
//   - sinon (compteur à sa base) : tout masqué, rien à montrer.
function renderDistanceTension(enemy) {
    if (!ui.distanceTensionLabel) return;
    const cfg = config.distanceEnrage;
    const status = enemy && enemy.status;
    if (!enemy || !status) {
        ui.distanceTensionLabel.classList.add('hidden');
        return;
    }
    if (status.enraged && status.enraged.rounds > 0) {
        ui.distanceTensionLabel.innerText = '😡 ENRAGÉ';
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-red-400';
        return;
    }
    if (status.enrageCooldown && status.enrageCooldown.rounds > 0) {
        ui.distanceTensionLabel.innerText = `😵 Épuisé (${status.enrageCooldown.rounds} tour${status.enrageCooldown.rounds > 1 ? 's' : ''})`;
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-500';
        return;
    }
    const baseline = mobKitingBaseline(enemy);
    const kitingRounds = enemy.kitingRounds || baseline;
    if (kitingRounds > baseline) {
        const chancePct = Math.round(Math.min(cfg.baseChance + cfg.chancePerRound * kitingRounds, cfg.maxChance) * 100);
        ui.distanceTensionLabel.innerText = `😤 Enrage imminent : ${chancePct}%`;
        ui.distanceTensionLabel.className = 'mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-orange-400';
        return;
    }
    ui.distanceTensionLabel.classList.add('hidden');
}

// Bannière de télégraphe (chantier "lisibilité combat", Chantier 1) : affichée EN PERMANENCE tant
// que enemy.status.telegraph est actif (pas seulement au tour d'annonce, contrairement au log qui ne
// mentionne l'annonce qu'une fois) — c'est elle qui porte l'information de façon fiable, sans avoir à
// déplier le journal de combat. Appelée depuis updateUI() à chaque rendu, seule fonction à toucher
// #telegraph-banner (jamais de mutation DOM dispersée ailleurs).
function updateTelegraphBanner() {
    if (!ui.telegraphBanner) return;
    const enemy = gameState.currentEnemy;
    const telegraph = enemy && enemy.status && enemy.status.telegraph;
    if (!telegraph) {
        ui.telegraphBanner.classList.add('hidden');
        return;
    }
    const messages = {
        heavy: '⚠️ Coup dévastateur imminent — défendez-vous ou esquivez !',
        defBuff: '🛡️ Garde imminente — frappez maintenant !'
    };
    ui.telegraphBanner.innerText = messages[telegraph.type] || '⚠️ Une attaque se prépare...';
    ui.telegraphBanner.classList.remove('hidden');
}

// Bannière de changement de phase boss (chantier "lisibilité combat", Chantier 10) : transitoire
// (~900ms), prépendue au pattern du tour par runPattern() dans performBossCounterAttackInner()
// UNIQUEMENT quand la phase vient de monter (jamais en entrant en phase 1). Minutée par un VRAI
// setTimeout (comme #dev-banner ou tout autre toast ponctuel) plutôt qu'un step de runCombatBeats :
// elle doit disparaître toute seule après son délai propre, indépendamment du rythme des beats
// suivants (qui peuvent s'enchaîner bien avant ou bien après ses 900ms). Aucun Math.random() ici
// (leçon du Chantier 3) : le texte dépend uniquement de `phase`.
function announceBossPhaseChange(enemy, phase) {
    if (!ui.phaseTransitionBanner) return;
    const messages = {
        2: `😤 ${enemy.name} change de comportement — nouveaux patterns !`,
        3: `🤪 ${enemy.name} entre en folie furieuse — frappez sans relâche !`
    };
    ui.phaseTransitionBanner.innerText = messages[phase] || `${enemy.name} change de phase.`;
    ui.phaseTransitionBanner.classList.remove('hidden');
    setTimeout(() => {
        ui.phaseTransitionBanner.classList.add('hidden');
    }, 900);
}

// Remplaçant intérimaire (chantier 15, lot 2) : une réplique d'accueil par boss (choisie selon la longueur de son nom, sans hasard), avec le chiffre exact.
const INTERIM_BOSS_LINES = [
    "est en congé : c'est son stagiaire qui vous accueille. Il n'a pas l'air de savoir où est le bouton d'alarme.",
    "a posé un jour de RTT. Son remplaçant vous reçoit, un gobelet de café dans une main, le manuel de procédures dans l'autre.",
    "est « en réunion ». L'intérimaire se présente, vous serre la patte et vous demande de patienter. Il n'a jamais tué personne."
];
function interimBossLine(enemy) {
    const eg = config.earlyGame.interimBoss;
    const text = INTERIM_BOSS_LINES[(enemy.baseName || enemy.name || '').length % INTERIM_BOSS_LINES.length];
    return `🏷️ [${enemy.baseName || enemy.name}] ${text} (Remplaçant intérimaire : −${Math.round((1 - eg.hpMult) * 100)} % de PV, −${Math.round((1 - eg.atkMult) * 100)} % d'ATQ.)`;
}

// Fin de la « Convention collective du Donjon » (chantier 15, lot 5) : première élite croisée une fois les étages sans élite passés, une seule fois par crawler.
function announceEliteConventionEnd(enemy) {
    const eg = config.earlyGame;
    if (!eg.enabled || gameState.eliteConventionEnded || !isEliteMob(enemy) || enemy.isBountyHunter) return;
    if (gameState.currentFloor <= eg.elites.freeFloors) return;
    gameState.eliteConventionEnded = true;
    const mult = eliteDamageMultForFloor(gameState.currentFloor);
    const base = config.mobDamageScaling.eliteDamageMult;
    const detail = mult < base ? ` (Rampe de reprise : dégâts des élites ×${String(mult).replace('.', ',')} à cet étage, ×${String(base).replace('.', ',')} ensuite.)` : '';
    logEvent(`📜 Fin de la Convention collective du Donjon : les élites ont repris le travail. Elles n'ont pas lu l'article 4 sur le plafonnement des dégâts.${detail}`, "info");
}

function initiateCombat(forcedEnemy = null) {
    const enemy = forcedEnemy || generateMob(gameState.currentDistrict);
    // Suivi du combat pour la chronique (chantier 2) : dégâts subis au départ, ouverture furtive, nombre
    // d'attaques portées (victoire en un coup) — voir recordRunEvent('win').
    if (enemy) enemy.runTrack = { startDamageTaken: gameState.runStats ? gameState.runStats.damageTaken : 0, startTrialAvoided: gameState.runStats ? (gameState.runStats.trialAvoided || 0) : 0, sneak: !!gameState.pendingSneakAttack, playerAttacks: 0 };
    gameState.currentEnemy = enemy;
    gameState.inCombat = true;
    if (enemy && enemy.isInterim) logEvent(interimBossLine(enemy), "info"); // Remplaçant intérimaire (chantier 15, lot 2)
    announceEliteConventionEnd(enemy);
    // Occasions de combat (chantier 6, V2) : état remis à zéro ; la garantie compte un combat de plus sans Occasion.
    gameState.occasion = Object.assign(createOccasionState(), { pity: ((gameState.occasion && gameState.occasion.pity) || 0) + 1 });

    // En-tête de la scène d'exploration : toujours posé ici, quel que soit le chemin d'entrée en combat (embuscade
    // de trajet, compagnon qui se retourne contre vous, rencontre furtive ratée...). Avant ce correctif,
    // seuls certains appelants posaient leur propre en-tête ; les autres laissaient celui de la scène
    // PRÉCÉDENTE affiché (ex: "Silence") pendant que l'affichage basculait déjà sur le panneau
    // du mob (renderCombatMobPanel) — les deux se retrouvaient superposés au premier tour. Les combats
    // de boss gardent leur en-tête dédié, plus riche ("Gardien de l'Escalier"/"Boss de Quartier"), déjà
    // posé par triggerBossEncounter() juste avant.
    if (enemy && !enemy.isBoss) {
        setSceneHeader(isEliteMob(enemy) ? '💀' : '⚔️', enemy.name, 'Danger', { key: 'combat', enemy });
    } else if (!enemy) {
        setSceneHeader('⚔️', 'Combat', 'Danger');
    }

    // Statuts remis à zéro à chaque nouveau combat (des deux côtés)
    gameState.status = { bleed: null, stunned: false, slowed: null, confused: null, disarmed: null, blinded: null, corroded: null, feared: null, adrenaline: null, plotShield: false };
    gameState.classAbilityUsed = false; // capacité de classe : une fois par combat (chantier 13)
    if (enemy) {
        // telegraph/defBuffed/frenzied : uniquement lus/écrits côté boss (voir performBossCounterAttack()
        // dans app.js, Chantier 2 du rework combat) — restent toujours neutres sur un mob normal/élite.
        // enraged/enrageCooldown : Chantier 3 (enrage distance), tous mobs confondus, boss inclus.
        enemy.status = { bleed: null, stunned: false, slowed: null, blinded: null, corroded: null, feared: null, distracted: null, telegraph: null, defBuffed: null, frenzied: false, enraged: null, enrageCooldown: null, immobilized: null, weakened: null, exposed: null };
        enemy.maxHp = enemy.hp; // Référence pour l'anneau de vie (pourcentage de PV restants)
        // Compteur de tours de kiting (Chantier 3) : un boss démarre à 1 (s'enrage plus vite qu'un
        // mob normal, voir NOTES_COMBAT.md Chantier 2) plutôt qu'à 0.
        enemy.kitingRounds = mobKitingBaseline(enemy);
        // Dernière phase connue (chantier "lisibilité combat") : initialisée à la phase de DÉPART pour
        // qu'aucun "changement" ne soit détecté au tout premier tour — seulement lue/mise à jour côté
        // boss (voir getBossPhase()/performBossCounterAttackInner()), neutre sur un mob normal/élite.
        enemy.lastKnownPhase = enemy.isBoss ? getBossPhase(enemy) : 1;
    }

    // Distance de combat initiale : dépend uniquement de la nature du mob (aucune notion de
    // posture côté joueur). Un mob de mêlée démarre au contact ; un mob à distance démarre à
    // l'écart de départ, que le joueur devra combler (S'approcher) ou maintenir (S'éloigner).
    gameState.combatDistance = (enemy && mobWantsFar(enemy)) ? config.rangedCombat.initialDistance : 0;

    // Les dés de dégâts repartent à zéro visuellement (aucune action encore jouée ce combat)
    ui.combatPlayerDie.innerText = "–";
    ui.combatPlayerDie.classList.remove('die-pop');
    ui.combatEnemyDie.innerText = "–";
    ui.combatEnemyDie.classList.remove('die-pop');

    if (enemy && enemy.isBoss) {
        logEvent("--- 👑 COMBAT DE BOSS ---", "danger");
        logEvent(`${enemy.name} se dresse devant vous ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else if (enemy && isEliteMob(enemy)) {
        logEvent("--- 💀 RENCONTRE DANGEREUSE ---", "danger");
        logEvent(`[${enemy.name}] apparaît, visiblement bien plus coriace que la normale ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else if (enemy) {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        logEvent(`Un [${enemy.name}] apparaît ! (PV: ${Math.round(enemy.hp)} | ATQ: ${enemy.atk} | DEF: ${enemy.def})`, "danger");
    } else {
        logEvent("--- COMBAT INITIÉ ---", "danger");
        // Sécurité : si la génération échoue pour une raison imprévue, on ne bloque pas le jeu
        logEvent("Une présence hostile rôde, mais reste indistincte...", "danger");
    }
    if (enemy && enemy.ranged) {
        logEvent("🎯 Cet ennemi est armé à distance !", "danger");
    }
    renderCombatMobPanel();
    updateUI();

    // TEMPO_CREE (anomalies.js) : les mobs frappent en premier à l'ouverture du combat — réutilise
    // exactement la riposte normale (enemyCounterAttack()/resolveEnemyCounterAttack()), jamais une
    // nouvelle formule de dégâts, simplement DÉCALÉE plus tôt dans le déroulé du combat.
    if (enemy && gameState.anomalyEffects.mobsActFirst) {
        enemyCounterAttack();
    }
}

// ==========================================
// COMBAT À DISTANCE : DISTANCE, CONTEXTE
// ==========================================
// Aucune notion de posture côté joueur : seule la nature du mob compte (mob.ranged, fixe pour tout
// le combat). L'écart de départ dépend uniquement d'elle (voir initiateCombat()) ; ensuite, il
// n'évolue plus que via les actions dédiées du joueur — S'approcher (attemptSprint, réduit l'écart)
// et S'éloigner (attemptRetreat, l'augmente) — toujours disponibles, chacune opposant un jet du
// joueur (avantagé) à un jet du mob, quel que soit son type. Les attaques (Arme/Tir/Mains nues)
// sont de simples dégâts, strictement gated par l'écart courant : plus aucune manche de distance
// ne se glisse dans une attaque.

function mobWantsFar(enemy) {
    return !!(enemy && enemy.ranged);
}

// Contexte de portée courant, symétrique dans les deux sens :
//   - playerAdvantaged : un mob de mêlée tenu à distance (écart > 0) ne peut pas toucher le joueur.
//   - mobNeedsDistance : un mob à distance collé au corps à corps (écart == 0) ne peut PAS non plus
//     tirer directement — il doit d'abord reculer pour reprendre ses distances (symétrique du
//     joueur, qui doit s'éloigner pour utiliser Tir). Avant ce garde-fou, un mob "à distance" tirait
//     sans condition, même au contact.
function getCombatRangeContext() {
    const enemy = gameState.currentEnemy;
    const distance = gameState.combatDistance || 0;
    const playerAdvantaged = !!enemy && !mobWantsFar(enemy) && distance > 0;
    const mobNeedsDistance = !!enemy && mobWantsFar(enemy) && distance <= 0;
    return { distance, playerAdvantaged, mobNeedsDistance };
}

// ==========================================
// ENRAGE PAR DISTANCE (Chantier 3 du rework combat)
// ==========================================
// Anti-kite générique, tous mobs confondus (boss inclus) : un mob accumule un "tour de kiting"
// chaque fois qu'il reste à distance sans pouvoir attaquer (mêlée hors de portée OU mob à distance
// collé au corps à corps), remis à sa base dès qu'il parvient à frapper. La probabilité d'enrage par
// tour grimpe avec ce compteur (config.distanceEnrage) jusqu'à son plafond. Voir NOTES_COMBAT.md.

// Base du compteur de kiting : un boss démarre à 1 (voir Chantier 2, "les boss s'enragent plus
// vite"), un mob normal/élite à 0.
function mobKitingBaseline(enemy) {
    return (enemy && enemy.isBoss) ? 1 : 0;
}

// Remet le compteur de kiting à sa base : appelé dès que le mob attaque réellement (peu importe le
// chemin emprunté — riposte normale, ruée classique, ruée d'enrage...), signe qu'il n'est plus "tenu
// à distance".
function resetMobKiting(enemy) {
    if (!enemy) return;
    enemy.kitingRounds = mobKitingBaseline(enemy);
}

// Un tour de plus où le mob est tenu à distance sans pouvoir agir. Renvoie true si ce tour a
// déclenché une ruée d'enrage (le mob a alors DÉJÀ attaqué — l'appelant ne doit pas logguer son
// propre message "reste hors de portée" par-dessus).
function noteMobKitingRound(enemy) {
    if (!enemy || !enemy.status) return false;
    // Déjà enragé : pas de nouveau tirage, mais ce tour de plus compte contre la durée restante de
    // l'enrage en cours (expire après 2-3 tours sans nouvelle frappe réussie entre-temps).
    if (enemy.status.enraged) {
        enemy.status.enraged.rounds -= 1;
        if (enemy.status.enraged.rounds <= 0) endMobEnrage(enemy);
        return false;
    }
    // Repos forcé après un enrage précédent : aucun nouveau tirage tant qu'il n'est pas écoulé.
    if (enemy.status.enrageCooldown && enemy.status.enrageCooldown.rounds > 0) {
        enemy.status.enrageCooldown.rounds -= 1;
        if (enemy.status.enrageCooldown.rounds <= 0) enemy.status.enrageCooldown = null;
        return false;
    }
    enemy.kitingRounds = (enemy.kitingRounds || mobKitingBaseline(enemy)) + 1;
    const cfg = config.distanceEnrage;
    const chance = Math.min(cfg.baseChance + cfg.chancePerRound * enemy.kitingRounds, cfg.maxChance);
    if (Math.random() < chance) {
        triggerMobEnrage(enemy);
        return true;
    }
    return false;
}

// Le mob perd patience : comble l'écart d'un coup et place une frappe bonus (dégâts
// +config.distanceEnrage.atkMult, via executeBossStrike() — réutilisée telle quelle, générique à
// tout mob boss ou non), sur un beat LOURD (chantier "lisibilité combat" : une ruée d'enrage est un
// moment fort, au même titre qu'un télégraphe exécuté). Cette frappe d'entrée ne compte pas comme la
// "frappe qui met fin à l'état" (voir noteMobKitingRound()/resolveEnemyCounterAttack()/
// performBossCounterAttack()) : l'état enragé s'installe SEULEMENT APRÈS elle, pour laisser une vraie
// fenêtre de 2-3 tours où sa DEF réduite reste exploitable par le joueur (et ses dégâts restent
// boostés) sur les tours suivants.
// Verrouille et déverrouille elle-même les boutons (comme enemyCounterAttack()) : contrairement à
// avant ce chantier, cette ruée passe désormais par un vrai beat et ne doit pas laisser les boutons
// actifs pendant qu'elle se joue — ses appelants (noteMobKitingRound(), dans resolveEnemyReaction()/
// safeEnemyCounterAttack()) n'ont pas besoin de savoir quand elle se termine, exactement comme ils
// n'ont jamais eu besoin de connaître le timing interne d'enemyCounterAttack().
function triggerMobEnrage(enemy) {
    const cfg = config.distanceEnrage;
    setCombatDistance(0);
    combatSkipRequested = false; // Chantier 9 : même remise à zéro qu'enemyCounterAttack()
    setCombatInputLocked(true);
    runCombatBeats([{
        run: () => {
            logEvent(`💢 [${enemy.name}] perd patience et se rue sur vous, enragé !`, "danger");
            const boostedAtk = Math.round(enemy.atk * cfg.atkMult);
            executeBossStrike(enemy, boostedAtk, `[${enemy.name}], enragé,`, undefined, true);
            resetMobKiting(enemy);
            if (gameState.hp > 0) {
                enemy.status.enraged = { rounds: 2 + Math.floor(Math.random() * 2) }; // 2 ou 3 tours
            }
        },
        delay: config.combatRhythm.beatHeavyEvent
    }], () => { setCombatInputLocked(false); updateUI(); }); // même centralisation qu'enemyCounterAttack() (Chantier 7)
}

// Fin de l'état enragé (durée écoulée, ou le mob vient de placer une frappe pendant l'état) : repos
// forcé ensuite, pour ne pas pouvoir s'enrager en boucle dès le tour suivant.
function endMobEnrage(enemy) {
    enemy.status.enraged = null;
    enemy.status.enrageCooldown = { rounds: config.distanceEnrage.cooldownRounds };
}

// Riposte "sécurisée" : bloque la riposte, sans rien faire d'autre ce tour-ci, si le mob ne peut
// actuellement pas toucher le joueur (mob de mêlée hors de portée, ou mob à distance collé au corps
// à corps). Réservée aux actions qui résolvent DÉJÀ elles-mêmes une manche de distance ce tour
// (Sprint, Reculer) : ajouter une tentative de repositionnement par-dessus doublerait leur propre
// jet. Pour tout le reste (voir resolveEnemyReaction), la riposte bloquée doit plutôt laisser le mob
// tenter de se repositionner, sans quoi il resterait figé indéfiniment. Un tour bloqué ici est aussi
// un tour de kiting (Chantier 3) : peut déclencher une ruée d'enrage à la place du simple blocage.
function safeEnemyCounterAttack() {
    const enemy = gameState.currentEnemy;
    if (!enemy) { enemyCounterAttack(); return; }
    const ctx = getCombatRangeContext();
    if (ctx.playerAdvantaged) {
        if (noteMobKitingRound(enemy)) return; // ruée d'enrage déclenchée : a déjà attaqué
        logEvent(`Trop loin : [${enemy.name}] ne peut pas riposter.`, "info");
        return;
    }
    if (ctx.mobNeedsDistance) {
        if (noteMobKitingRound(enemy)) return;
        logEvent(`Trop près : [${enemy.name}] ne peut pas tirer au corps à corps.`, "info");
        return;
    }
    enemyCounterAttack();
}

// Réaction par défaut du mob à la fin d'un tour du joueur (attaque, Magie, étourdissement, fuite
// ratée...). Un mob hors d'état de frapper immédiatement (mêlée hors de portée, ou à distance collé
// au contact) ne reste pas pour autant totalement figé : il tente de se repositionner (même
// mécanique que resolveDistanceRound), et frappe immédiatement s'il y parvient.
function resolveEnemyReaction() {
    const enemy = gameState.currentEnemy;
    if (!enemy) return;
    const ctx = getCombatRangeContext();

    if (ctx.playerAdvantaged) {
        const { diff } = resolveDistanceRound(enemy, true); // rafraîchit déjà l'UI via setCombatDistance()
        // Ruée : un mob de mêlée qui gagne ce jet avec une marge franche (voir
        // config.rangedCombat.rushMarginThreshold) comble l'écart d'un bond, quel que soit l'écart de
        // départ — sans ça, un joueur à l'écart maximal devient mathématiquement increvable (voir le
        // commentaire de rushMarginThreshold).
        if (diff <= -config.rangedCombat.rushMarginThreshold) {
            setCombatDistance(0);
            logEvent(`[${enemy.name}] se rue et comble l'écart d'un bond !`, "danger");
            enemyCounterAttack();
        } else if (gameState.combatDistance > 0) {
            // Tour de kiting (Chantier 3) : peut déclencher une ruée d'enrage à la place du simple blocage.
            if (!noteMobKitingRound(enemy)) {
                logEvent(`[${enemy.name}] tente de combler l'écart, mais reste hors de portée pour l'instant.`, "info");
            }
        } else {
            logEvent(`[${enemy.name}] parvient à combler l'écart !`, "danger");
            enemyCounterAttack();
        }
        return;
    }

    if (ctx.mobNeedsDistance) {
        resolveDistanceRound(enemy, false); // le joueur veut RÉDUIRE l'écart (le coller) ce round-ci
        if (gameState.combatDistance > 0) {
            logEvent(`[${enemy.name}] recule pour reprendre ses distances et ouvre le feu !`, "danger");
            enemyCounterAttack();
        } else if (!noteMobKitingRound(enemy)) {
            logEvent(`[${enemy.name}] tente de reculer pour tirer, mais vous le collez au corps à corps.`, "info");
        }
        return;
    }

    enemyCounterAttack();
}

// Point de passage UNIQUE pour toute modification de l'écart de combat en cours de round (clampe
// et rafraîchit systématiquement la barre de distance). Avant ce correctif, plusieurs chemins
// modifiaient gameState.combatDistance directement sans jamais appeler updateUI() dans la foulée
// (recul réussi dont la riposte se retrouve bloquée par safeEnemyCounterAttack(), tir qui maintient
// l'écart sans provoquer de riposte...) : la barre restait figée sur l'ancien écart jusqu'à ce
// qu'une AUTRE action déclenche enfin un rendu. Particulièrement visible en duel long face à un
// boss de mêlée (seul cas où le cycle recul/tir dure assez longtemps pour que le décalage saute
// aux yeux). Les 3 assignations directes dans initiateCombat() restent volontairement en dehors :
// un updateUI() à ce stade rendrait un état transitoire (avant que renderCombatMobPanel() etc.
// n'aient fini d'installer la carte de combat) ; l'updateUI() déjà garanti en fin de fonction suffit.
function setCombatDistance(value) {
    gameState.combatDistance = Math.max(0, Math.min(config.rangedCombat.maxDistance, value));
    updateUI();
}

// Une "manche" de distance : le joueur et le monstre jettent chacun un dé (le joueur bénéficie
// d'un bonus lié à son niveau), et l'écart évolue selon qui l'emporte. `playerWantsToWiden`
// indique le sens favorable au joueur pour cette manche (true = il veut AUGMENTER l'écart, false =
// il veut le RÉDUIRE). Chaque manche CONTESTÉE consomme un peu de temps (voir
// config.rangedCombat.timeCostPerRound) — jamais les tours d'attaque standards, qui ne passent pas
// par cette fonction.
function resolveDistanceRound(enemy, playerWantsToWiden) {
    const cfg = config.rangedCombat;
    gameState.timeLeft = Math.max(0, gameState.timeLeft - cfg.timeCostPerRound);
    const playerRoll = 1 + Math.floor(Math.random() * cfg.dieSides) + Math.floor(gameState.level / cfg.levelAdvantageDivisor) + sumEquippedQualifier('swift', 'bonus'); // Véloce
    const mobRoll = 1 + Math.floor(Math.random() * cfg.dieSides);
    const diff = playerRoll - mobRoll; // positif = le joueur l'emporte ce round
    const delta = playerWantsToWiden ? diff : -diff;
    setCombatDistance(gameState.combatDistance + delta);
    return { playerRoll, mobRoll, diff };
}

// Formule de mitigation multiplicative : le ratio ATQ/(ATQ+DEF) donne la part des dégâts qui passe.
// Avantage sur une formule additive (ATQ - DEF) : jamais de dégâts négatifs à écrêter artificiellement,
// et la DEF réduit toujours les dégâts proportionnellement, sans effet de seuil brutal.
// `options` permet de différencier les types d'attaque (arme / mains nues / magie) :
//   - atkMultiplier : multiplie l'ATQ de base (ex: 1.4 pour la magie, plus puissante)
//   - varianceRange : amplitude de l'aléatoire (ex: 0.35 pour la magie, plus imprévisible)
//   - defReduction  : fraction de la DEF adverse ignorée (ex: 0.35 pour les mains nues, qui passent sous la garde)
function rollDamage(attackerAtk, defenderDef, options = {}) {
    const atkMultiplier = options.atkMultiplier ?? 1;
    const varianceRange = options.varianceRange ?? 0.15;
    const defReduction = options.defReduction ?? 0;
    // Chantier "rework combat" (scaling dégâts mobs) : options.pressureFloor (absolu, en PV) et
    // options.minMitigation ne sont JAMAIS passés par performPlayerAttack() — uniquement par
    // resolveEnemyCounterAttack() (voir config.mobDamageScaling), pour que ces deux règles restent
    // strictement des dégâts MOB -> joueur, sans toucher aux dégâts joueur -> mob.
    const pressureFloor = options.pressureFloor ?? 0;
    const minMitigation = options.minMitigation ?? 0;

    const effectiveAtk = attackerAtk * atkMultiplier;
    const effectiveDef = Math.max(0, defenderDef * (1 - defReduction));
    // Cap de réduction : la défense ne peut jamais faire tomber la mitigation sous minMitigation.
    const mitigation = Math.max(minMitigation, effectiveAtk / (effectiveAtk + effectiveDef));
    const variance = 1 + (Math.random() * varianceRange * 2 - varianceRange);
    // Plancher de pression : dégâts BRUTS (avant mitigation) jamais sous pressureFloor.
    const rawDamage = Math.max(effectiveAtk * variance, pressureFloor);
    // Seul point de passage commun aux dégâts du joueur ET des mobs (voir performPlayerAttack()/
    // resolveEnemyCounterAttack()) : anomalyEffects.allDamageMult (ADRENALINE) s'y applique donc
    // symétriquement des deux côtés sans toucher au reste de la formule.
    const damage = rawDamage * mitigation * (gameState.anomalyEffects.allDamageMult || 1);
    return Math.max(1, Math.round(damage));
}

// DEF effective du joueur : sa DEF de base + le bonus de l'armure équipée, le cas échéant.
// Réduite de moitié tant que le joueur est ébloui (effet "light"), et encore réduite de 40% tant
// qu'il est corrodé (effet "corrode") — les deux se cumulent si les deux sont actifs à la fois.
function getEffectiveDef() {
    const raceFx = originRaceEffects();
    const armorBonus = gameState.equipment.armor ? Math.round((gameState.equipment.armor.baseArmor || 0) * (raceFx.armorMult || 1)) : 0; // Nain : armure portée +15 %
    const companionBonus = hasActiveCompanion('guard')
        ? Math.round(getCompanionDef(gameState.companion) * config.companions.guard.defShare)
        : 0;
    let effectiveDef = gameState.def + armorBonus + companionBonus;
    if (raceFx.defMult) effectiveDef += Math.max(1, Math.round(effectiveDef * (raceFx.defMult - 1))); // Nain : DEF +12 % (au moins +1)
    if (raceFx.defFlat) effectiveDef = Math.max(0, effectiveDef + raceFx.defFlat); // Elfe : DEF −1
    if (gameState.status.blinded && gameState.status.blinded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    if (gameState.status.corroded && gameState.status.corroded.rounds > 0) {
        effectiveDef = Math.round(effectiveDef * 0.6);
    }
    // "Charger" (Chantier 3, attemptEngage()) : DEF divisée par 2 pour la riposte qui suit une charge
    // volontaire — consommé (remis à faux) au tout début de la PROCHAINE action, voir tryPlayerAction(),
    // jamais ici (fonction pure, aussi appelée pour le simple affichage UI de la DEF).
    if (gameState.engageDefHalved) {
        effectiveDef = Math.round(effectiveDef * 0.5);
    }
    // Encaisser (Sac de frappe, chantier 13) : DEF ×2 pour la riposte qui suit la capacité.
    if (gameState.status.brace) effectiveDef = Math.round(effectiveDef * (originClassEffects().braceDefMult || 1));
    return effectiveDef;
}

// Vérifie que le joueur peut agir (combat en cours, pas étourdi), et applique le saignement
// éventuellement en cours sur le joueur AVANT son action. Retourne false si le joueur ne peut pas
// agir ce tour-ci (combat terminé entre-temps, ou étourdi).
function tryPlayerAction() {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    // Une action = un tour : l'Occasion proposée (chantier 6, V2) s'éteint, que le joueur l'ait prise ou non.
    if (gameState.occasion) { gameState.occasion.current = null; gameState.occasion.turn += 1; }
    // Un skip demandé pendant le tour précédent ne doit jamais escamoter l'effet de CETTE attaque (fx.js).
    combatSkipRequested = false;

    // Reset avant toute chose : seul un backfire posé PENDANT cette action doit pouvoir être tenu
    // responsable d'une mort ce même tour (voir attackMagic()/gameOver()).
    gameState.lastPlayerActionWasBackfire = false;
    // Même convention pour "Charger" (Chantier 3, attemptEngage()) : la DEF divisée par 2 ne doit
    // couvrir QUE la riposte qui suit la charge, jamais fuiter sur l'action suivante du joueur.
    gameState.engageDefHalved = false;
    gameState.status.plotShield = false; // Armure de scénario (chantier 15) : ne couvre que le reste du tour ennemi où elle a servi
    gameState.status.brace = null; // Encaisser (chantier 13) : ne couvre que la riposte qui suit la capacité
    // Bouclier de Mana (chantier 11) : couvre les ripostes des `rounds` actions suivant le sort.
    if (gameState.status.manaShield) {
        gameState.status.manaShield.rounds -= 1;
        if (gameState.status.manaShield.rounds <= 0) gameState.status.manaShield = null;
    }

    // Saignement en cours sur le joueur : tique avant son action
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) {
        const dmg = applyTrialToDamage(applyStarterBuffToDamage(applyRaceDamageMods(gameState.status.bleed.dmgPerRound, 'bleed')));
        applyPlayerDamage(dmg);
        gameState.status.bleed.rounds -= 1;
        if (gameState.status.bleed.rounds <= 0) gameState.status.bleed = null;
        logEvent(`🩸 Votre état vous fait perdre ${dmg} PV.`, "danger");
        if (gameState.hp <= 0) {
            gameState.hp = 0;
            gameOver(false, 'bleed');
            return false;
        }
    }

    if (gameState.status.stunned) {
        logEvent("Vous êtes étourdi et ne parvenez pas à agir ce tour-ci !", "danger");
        gameState.status.stunned = false; // L'étourdissement se consomme après ce tour manqué
        showDie(ui.combatPlayerDie, "😵");
        // resolveEnemyReaction() gère la protection par distance : un mob de mêlée hors de portée
        // ne peut pas profiter de l'étourdissement, mais tente quand même de combler l'écart.
        resolveEnemyReaction();
        return false;
    }

    return true;
}

// Portion commune à toute attaque du joueur : applique les dégâts, vérifie la victoire, et laisse
// l'ennemi réagir s'il survit (resolveEnemyReaction() : riposte normale, ou tentative de
// rapprochement si un mob de mêlée est hors de portée — voir getCombatRangeContext()).
function performPlayerAttack(attackerAtk, options, label) {
    if (!gameState.inCombat || !gameState.currentEnemy) return false;
    const enemy = gameState.currentEnemy;
    // `options.skipReaction` : un coup de capacité de classe qui n'est pas le dernier d'une rafale (Tir de barrage) ne déclenche pas la riposte.
    const react = () => { if (!options.skipReaction) resolveEnemyReaction(); };

    // Un joueur confus a une chance de rater complètement son attaque (aucun dégât, tour perdu)
    if (gameState.status.confused && gameState.status.confused.rounds > 0) {
        gameState.status.confused.rounds -= 1;
        if (gameState.status.confused.rounds <= 0) gameState.status.confused = null;
        if (Math.random() * 100 < 45) {
            showDie(ui.combatPlayerDie, "❓");
            logEvent(`Désorienté, vous frappez complètement à côté de [${enemy.name}] !`, "danger");
            react();
            return true;
        }
    }

    // Qualificatifs de l'objet utilisé pour CE coup (options.gear : arme, arme à distance ou sort ;
    // options.gearTarget : 'weapon' | 'spell') — voir itemQualifiers dans items.js.
    const gear = options.gear || null;
    const gearTarget = options.gearTarget || 'weapon';
    const gearQ = (key) => (gear ? getItemQualifierValues(gear, key, gearTarget) : null);
    const wobbly = gearQ('wobbly');
    if (wobbly && Math.random() * 100 < wobbly.chance) {
        showDie(ui.combatPlayerDie, "🥴");
        logEvent(`🥴 Votre [${gear.name}] bancal vous glisse des mains : coup complètement raté !`, "danger");
        react();
        return false;
    }

    // Un joueur ralenti inflige moitié moins de dégâts, le temps que l'effet se dissipe
    let effectiveOptions = options;
    let slowedNote = "";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) {
        effectiveOptions = { ...options, atkMultiplier: (options.atkMultiplier ?? 1) * 0.5 };
        slowedNote = " (ralenti)";
        gameState.status.slowed.rounds -= 1;
        if (gameState.status.slowed.rounds <= 0) gameState.status.slowed = null;
    }

    // Un joueur apeuré (effet mob "Terrifiant") inflige lui aussi moins de dégâts, le temps de
    // reprendre ses esprits. Se cumule avec le ralentissement si les deux sont actifs.
    if (gameState.status.feared && gameState.status.feared.rounds > 0) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * 0.65 };
        slowedNote += " (apeuré)";
        gameState.status.feared.rounds -= 1;
        if (gameState.status.feared.rounds <= 0) gameState.status.feared = null;
    }

    // À l'inverse, une décharge d'adrénaline (arme "Galvanisant") booste temporairement les dégâts
    let adrenalineNote = "";
    if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * gameState.status.adrenaline.mult };
        adrenalineNote = " (galvanisé)";
        gameState.status.adrenaline.rounds -= 1;
        if (gameState.status.adrenaline.rounds <= 0) gameState.status.adrenaline = null;
    }

    // Disparition (Filou, chantier 13) : la prochaine attaque après la capacité porte un bonus garanti.
    let vanishNote = "";
    const vanish = gameState.status.vanish;
    if (vanish && vanish.nextAttack) {
        const vanishMult = originClassEffects().nextAttackMult || 1;
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * vanishMult };
        vanishNote = ` (disparition ×${vanishMult})`;
        vanish.nextAttack = false;
    }

    // Attaque furtive réussie : le tout premier coup de ce combat porte un bonus x2 garanti
    let sneakNote = "";
    if (gameState.pendingSneakAttack) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * 2 };
        sneakNote = " (attaque furtive x2)";
        gameState.pendingSneakAttack = false;
    }

    // Un ennemi ébloui (arme "Lumineux") pare moins bien, un ennemi corrodé (arme "Corrosif")
    // aussi : sa DEF effective est réduite dans les deux cas (cumulables).
    let effectiveEnemyDef = enemy.def;
    const enemyWasBlinded = enemy.status && enemy.status.blinded && enemy.status.blinded.rounds > 0;
    if (enemyWasBlinded) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * 0.5);
        enemy.status.blinded.rounds -= 1;
        if (enemy.status.blinded.rounds <= 0) enemy.status.blinded = null;
    }
    const enemyWasCorroded = enemy.status && enemy.status.corroded && enemy.status.corroded.rounds > 0;
    if (enemyWasCorroded) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * 0.6);
        enemy.status.corroded.rounds -= 1;
        if (enemy.status.corroded.rounds <= 0) enemy.status.corroded = null;
    }

    // Exposé (Parade ou garde brisée parfaite, chantier 6 V3) : DEF effective réduite de 30 % pendant `rounds` coups.
    const enemyWasExposed = enemy.status && enemy.status.exposed && enemy.status.exposed.rounds > 0;
    if (enemyWasExposed) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * MINIGAME_SETTINGS.boss.exposed.defMult);
        enemy.status.exposed.rounds -= 1;
        if (enemy.status.exposed.rounds <= 0) enemy.status.exposed = null;
    }

    // Boss phase 2 "il se hérisse" (voir performBossCounterAttack()) : DEF effective AUGMENTÉE tant
    // que le buff est actif — symétrique aux réductions ébloui/corrodé ci-dessus.
    const enemyWasDefBuffed = enemy.status && enemy.status.defBuffed && enemy.status.defBuffed.rounds > 0;
    if (enemyWasDefBuffed) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.bossPhases.defBuffMult);
        enemy.status.defBuffed.rounds -= 1;
        if (enemy.status.defBuffed.rounds <= 0) enemy.status.defBuffed = null;
    }
    // Boss phase 3 ("folie", voir performBossCounterAttack()) : DEF effective RÉDUITE en continu,
    // la fenêtre risque/récompense de cette phase (voir config.bossPhases.phase3).
    const enemyIsFrenzied = enemy.status && enemy.status.frenzied;
    if (enemyIsFrenzied) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.bossPhases.phase3.defMult);
    }
    // Enrage par distance (Chantier 3, tous mobs confondus, boss inclus) : DEF effective divisée par
    // 2 tant que l'état est actif (voir noteMobKitingRound()/triggerMobEnrage()) — une vraie fenêtre
    // de burst pour le joueur, en échange du fait qu'il vient d'encaisser (ou va encaisser) des coups
    // boostés en retour.
    const enemyIsEnragedForPlayer = enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0;
    if (enemyIsEnragedForPlayer) {
        effectiveEnemyDef = Math.round(effectiveEnemyDef * config.distanceEnrage.defMult);
    }

    // "Charger" (Chantier 3, attemptEngage()) : bonus d'ATQ déjà passé via effectiveOptions.atkMultiplier
    // par l'appelant ; en contrepartie, la DEF du JOUEUR est divisée par 2 pour la riposte qui suit —
    // consommée au tout début de la PROCHAINE action (tryPlayerAction()), même convention que
    // lastPlayerActionWasBackfire, jamais ici (getEffectiveDef() reste pure, aussi utilisée pour le
    // simple affichage UI).
    // Aiguisé/Amplifié : dégâts +% ; Perforant : part de la DEF ignorée ; Précis : coup critique.
    let gearNote = "";
    const keen = gearQ('keen') || gearQ('amplified');
    if (keen) effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * (1 + keen.pct / 100) };
    const pierce = gearQ('pierce');
    if (pierce) effectiveOptions = { ...effectiveOptions, defReduction: 1 - (1 - (effectiveOptions.defReduction ?? 0)) * (1 - pierce.pct / 100) };
    const precise = gearQ('precise');
    if (precise && Math.random() * 100 < precise.chance) {
        effectiveOptions = { ...effectiveOptions, atkMultiplier: (effectiveOptions.atkMultiplier ?? 1) * precise.mult };
        gearNote += " (critique !)";
    }
    let playerDamage = rollDamage(attackerAtk, effectiveEnemyDef, effectiveOptions);
    // Électrique/Explosif : dégâts bonus proportionnels au coup, qui ignorent la DEF (ajoutés au coup
    // lui-même, avant le test de victoire). Explosif peut aussi blesser le porteur, sans jamais le tuer.
    const shock = gearQ('shock');
    if (shock && Math.random() * 100 < shock.chance) {
        const bonus = Math.max(1, Math.round(playerDamage * shock.pct / 100));
        playerDamage += bonus;
        gearNote += ` (⚡ +${bonus})`;
    }
    // Chaîne d'éclairs (effet de sort, chantier 11) : second éclair ajouté au coup, avant le test de victoire.
    if (options.chainPct > 0) {
        const bonus = Math.max(1, Math.round(playerDamage * options.chainPct / 100));
        playerDamage += bonus;
        gearNote += ` (⛓️ +${bonus})`;
    }
    const blast = gearQ('aoe');
    if (blast && Math.random() * 100 < blast.chance) {
        const bonus = Math.max(1, Math.round(playerDamage * blast.pct / 100));
        playerDamage += bonus;
        gearNote += ` (💥 +${bonus})`;
        if (Math.random() * 100 < blast.selfChance && gameState.hp > 1) {
            const selfDamage = Math.min(gameState.hp - 1, Math.max(1, Math.round(gameState.maxHp * blast.selfPct / 100)));
            applyPlayerDamage(selfDamage);
            logEvent(`💥 L'explosion vous roussit au passage (-${selfDamage} PV). Pour tout le monde, on avait dit.`, "danger");
        }
    }
    enemy.hp -= playerDamage;
    if (enemy.runTrack) enemy.runTrack.playerAttacks += 1;
    gameState._lastPlayerDamage = playerDamage; // Utilisé par la mécanique d'arme "Vampirique" (lifesteal)
    animateDieHit(ui.combatPlayerDie, 'left', playerDamage);
    // Effet d'attaque en 3 temps (fx.js, chantier « sprites & effets ») : le chiffre, la secousse et la
    // baisse de la barre de vie du mob attendent l'impact. Attaque furtive et charge sont les seuls coups
    // « lourds » du joueur (chiffre grossi, secousse d'écran + flash).
    const heavyHit = sneakNote !== "" || gameState.engageDefHalved;
    playPlayerAttackFx(gameState.lastAttackKind, { heavy: heavyHit, charge: gameState.engageDefHalved, heldEnemyHp: enemy.hp + playerDamage }, () => {
        showFloatingDamage(ui.sceneMobAnchor, playerDamage, { toPlayer: false, heavy: heavyHit });
        if (heavyHit) triggerHeavyImpact();
    });
    // Ligne raccourcie (chantier "lisibilité combat", Chantier 8) : retire le remplissage "et
    // infligez ... à" — toutes les notes d'état restent conservées telles quelles (chacune explique
    // le calcul du coup en cours : DEF ennemie effective modifiée, dégâts joueur modifiés — jamais de
    // pure redite de ce que les badges du Chantier 2 montrent déjà sans rapport avec CE coup précis).
    logEvent(`Vous attaquez ${label} : ${playerDamage} dégâts à [${enemy.name}]${gearNote}${slowedNote}${adrenalineNote}${sneakNote}${vanishNote}${enemyWasBlinded ? " (ennemi ébloui)" : ""}${enemyWasCorroded ? " (ennemi corrodé)" : ""}${enemyWasDefBuffed ? " (garde hérissée)" : ""}${enemyWasExposed ? " (garde ouverte)" : ""}${enemyIsFrenzied ? " (garde effondrée)" : ""}${enemyIsEnragedForPlayer ? " (garde baissée)" : ""}.`, "normal");

    // Appui du compagnon : sort donné, Frappe d'appoint ou coup d'opportunité (voir companionCombatSupport())
    companionCombatSupport(enemy);
    if (enemy.hp > 0 && options.onHit) options.onHit(enemy, playerDamage); // effet de capacité de classe posé AVANT la riposte (ex. étourdissement)

    if (enemy.hp <= 0) {
        // Coup de grâce (chantier 6, V3) : le coup fatal porté à un boss ouvre d'abord l'épreuve (si une interface la permet).
        if (offerCoupDeGrace(enemy)) return true;
        setTimeout(() => {
            logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
            winCombat();
        }, COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer avant de conclure le combat
        return true;
    }

    react();
    return true;
}
