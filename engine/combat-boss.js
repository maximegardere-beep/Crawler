// engine/combat-boss.js — Boss : phases, télégraphes, épreuves de boss.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
// ==========================================
// BOSS : PHASES, TÉLÉGRAPHES, PATTERNS (Chantier 2 du rework combat)
// ==========================================
// Un boss n'est plus "un mob avec plus de PV" : son comportement change par PALIER DE PV (phases),
// via des patterns d'attaque et des états temporaires uniquement — aucune nouvelle entité, aucune
// modélisation spatiale (voir config.bossPhases). Chemin totalement séparé du mob normal/élite
// (resolveEnemyCounterAttack ci-dessous) : isEliteMob() exclut déjà les boss, donc aucun
// recouvrement avec le scaling élite du Chantier 1.

// ==========================================
// ÉPREUVES DE BOSS (chantier 6, V3 — voir NOTES_MINIJEUX.md)
// ==========================================
// Trois moments : la Parade (exécution d'un coup lourd télégraphié), Briser la garde (exécution de « il se hérisse ») et le Coup de
// grâce (coup fatal). 3 épreuves de télégraphe au plus par boss (MINIGAME_SETTINGS.boss.trialCap), puis le comportement d'avant ; le Coup
// de grâce s'y ajoute (4 au plus). Un Raté n'ajoute AUCUNE pénalité : le boss fait ce qu'il aurait fait sans épreuve. Sans interface
// (tests Node, simulation longue) : jamais d'épreuve, comportement strictement inchangé. Avec interface mais en mode « Jet automatique »
// ou via « Passer » : réussite tirée selon la compétence d'Arme, jamais de Parfait (bossAutoRates()).
function ensureBossTrials(enemy) {
    if (!enemy.trials) enemy.trials = { count: 0, perfects: 0 };
    return enemy.trials;
}

// Joue une épreuve de télégraphe puis rappelle `cb(outcome)` ('fail' sans épreuve : plafond atteint ou pas d'interface).
function runBossTrial(enemy, kind, cb) {
    const trials = ensureBossTrials(enemy);
    if (typeof requestAnimationFrame !== 'function' || trials.count >= MINIGAME_SETTINGS.boss.trialCap) { cb('fail'); return; }
    trials.count += 1;
    const spec = buildMinigameSpec(kind, { boss: true, allowPerfect: false, autoRates: bossAutoRates(gameState.skills.weapon.level) });
    startMinigame(spec, (outcome, detail) => {
        if (outcome === 'perfect' && !(detail && detail.auto)) trials.perfects += 1;
        cb(outcome);
    });
}

// Parade parfaite : le coup est détourné, le crawler riposte (x1,5, sans jamais achever le boss : le coup fatal reste le sien) et la garde
// du boss s'ouvre un tour (statut « exposé »).
function parryRiposte(enemy) {
    const gear = gameState.equipment.weapon || gameState.equipment.ranged;
    const atk = gameState.atk + (gear ? (gear.baseDmg || 0) : 0);
    const dmg = Math.max(0, Math.min(enemy.hp - 1, rollDamage(atk, enemy.def, { atkMultiplier: MINIGAME_SETTINGS.boss.parry.perfectRiposteMult, varianceRange: 0.15, defReduction: 0 })));
    enemy.hp -= dmg;
    if (dmg > 0) showFloatingDamage(ui.sceneMobAnchor, dmg, { toPlayer: false, heavy: true });
    enemy.status.exposed = { rounds: MINIGAME_SETTINGS.boss.exposed.rounds };
    return dmg;
}

// Briser la garde réussi : la garde n'est pas posée ; parfait, elle s'ouvre même (statut « exposé »).
function applyGuardBreak(enemy, outcome) {
    if (outcome === 'perfect') enemy.status.exposed = { rounds: MINIGAME_SETTINGS.boss.exposed.rounds };
}

// Coup de grâce : l'épreuve dépend de la dernière attaque. Le boss est de toute façon achevé (il n'y a pas de pénalité) ; seul un Parfait
// ouvre l'objet signature. Renvoie vrai si l'épreuve a été ouverte (l'appelant ne conclut pas le combat lui-même).
function offerCoupDeGrace(enemy) {
    if (!enemy.isBoss || enemy.finisherDone || !minigameIsInteractive()) return false;
    enemy.finisherDone = true;
    const kinds = { ranged: 'target', unarmed: 'choke' };
    const kind = kinds[gameState.lastAttackKind] || 'timing';
    const base = { label: 'Coup de grâce', icon: '💀', hint: 'Un dernier effort : visez juste !', boss: true, allowPerfect: false, autoRates: bossAutoRates(gameState.skills.weapon.level) };
    const extra = kind === 'timing' ? { zoneWidth: 0.2, periodMs: 1000 }
        : kind === 'target' ? { distance: gameState.combatDistance, skillLevel: gameState.skills.weapon.level, durationMs: MINIGAME_SETTINGS.target.durationMs }
        : {};
    logEvent(`💀 Coup de grâce ! [${enemy.name}] vacille, à votre merci...`, "danger");
    startMinigame(buildMinigameSpec(kind, Object.assign(base, extra)), (outcome, detail) => {
        const perfect = outcome === 'perfect' && !(detail && detail.auto);
        const trials = ensureBossTrials(enemy);
        enemy.finisherPerfect = perfect;
        if (perfect) trials.perfects += 1;
        playFinisherCinematic(perfect, () => {
            logEvent(`[${enemy.name}] s'effondre, vaincu !`, "success");
            winCombat();
        });
    });
    return true;
}

// Phase dérivée UNIQUEMENT du ratio de PV courant (aucun champ de niveau dédié sur les mobs, comme
// le reste du moteur) : 100-66% phase 1, 66-33% phase 2, en dessous phase 3 ("folie").
function getBossPhase(enemy) {
    if (!enemy || !enemy.maxHp) return 1;
    const frac = enemy.hp / enemy.maxHp;
    if (frac > 2 / 3) return 1;
    if (frac > 1 / 3) return 2;
    return 3;
}

// Une seule frappe boss : réutilise rollDamage()/l'absorption de compagnon "Garde rapprochée"/
// applyPlayerDamage() strictement comme resolveEnemyCounterAttack() (jamais réécrits) — la riposte
// multi-coups de phase 2 n'est ainsi qu'une boucle de ce même bloc, pas une nouvelle formule de
// dégâts. Renvoie les dégâts réellement encaissés par le joueur (après absorption compagnon).
// `pressureFloorOverride` : le plancher de pression (config.mobDamageScaling.pressureFloorFrac,
// Chantier 1) est pensé "au moins X% des PV max par ATTAQUE", où une attaque = UN TOUR de boss. Le
// multi-coups de phase 2 fractionne un tour en plusieurs frappes ; sans ce paramètre, chaque frappe
// re-déclencherait indépendamment le plancher ABSOLU, le multipliant par le nombre de coups (constaté
// en test : un plancher pensé pour ~10%/tour grimpait à ~30%/tour avec 3 frappes). Omis (undefined),
// la frappe utilise le plancher complet standard (cas normal : une frappe = un tour entier).
// `silent` (chantier "lisibilité combat", Chantier 8) : réservé au multi-coups — supprime la ligne de
// log INDIVIDUELLE de ce coup (mais jamais l'application des dégâts/l'animation/l'effondrement d'un
// compagnon, qui reste toujours annoncé) pour que l'appelant puisse construire UNE seule ligne de
// résumé après la rafale plutôt que N lignes quasi identiques. Renvoie toujours playerDamage, silent
// ou non, pour que ce résumé puisse être construit à partir des montants réellement encaissés.
function executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy = false, silent = false) {
    // Ténébreux (armure) : chaque frappe peut être esquivée à part entière.
    if (rollPlayerDodge(enemy)) return 0;
    // Gelé/Terrifiant : réduction posée pour tout le tour par performBossCounterAttack().
    if (enemy._debuffAtkMult && enemy._debuffAtkMult !== 1) atk = Math.max(1, Math.round(atk * enemy._debuffAtkMult));
    const pressureFloor = pressureFloorOverride !== undefined
        ? pressureFloorOverride
        : gameState.maxHp * config.mobDamageScaling.pressureFloorFrac;
    const dmg = rollDamage(atk, getEffectiveDef(), {
        pressureFloor,
        minMitigation: config.mobDamageScaling.minMitigation
    });
    // Interception par le compagnon (Garde souvent, les autres parfois) — voir companionInterceptHit()
    const intercept = companionInterceptHit(dmg);
    let playerDamage = intercept.playerDamage;
    const companionAbsorbNote = intercept.note;
    const hpBefore = gameState.hp;
    playerDamage = applyPlayerDamage(playerDamage); // montant réellement perdu (Armure de scénario / Increvable)
    applyBraceReflect(enemy, playerDamage); // Encaisser (Sac de frappe, chantier 13)
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage);
    // Effet d'attaque du mob (fx.js) : chiffre, secousse et flash à l'impact ; `silent` = multi-coups,
    // joué sans élan pour tenir dans beatMultiHit.
    playMobAttackFx(enemy, { heavy, fast: silent, heldPlayerHp: hpBefore }, () => {
        showFloatingDamage(ui.sceneCrawlerAnchor, playerDamage, { toPlayer: true, heavy }); // `heavy` : télégraphe exécuté/ruée d'enrage/phase 3, voir les appelants
        if (heavy) triggerHeavyImpact(); // Chantier 4 : même flag, mêmes 3 occasions — voir triggerHeavyImpact()
    });
    if (!silent) logEvent(`${label} inflige ${playerDamage} dégâts${companionAbsorbNote}.`, "danger");
    checkCompanionDowned(); // À 0 PV : à terre jusqu'au prochain repos ou soin (plus de perte définitive)
    applyArmorMechanic(enemy, playerDamage); // Qualificatifs d'armure : aussi contre un boss (rien si le joueur est tombé)
    return playerDamage;
}

// Riposte complète d'un boss : sélectionne et résout un pattern selon sa phase courante, puis le
// DÉROULE en un ou plusieurs beats (voir runCombatBeats()) — un seul pattern par tour, jamais
// cumulés, seul leur RYTHME d'affichage change désormais (chantier "lisibilité combat").
// Enveloppe fine autour de performBossCounterAttackInner() : gère la fin de l'état enragé (Chantier
// 3) sur UN SEUL point de sortie (son onDone, appelé une fois TOUTE la séquence de beats jouée)
// plutôt que de dupliquer la logique sur chacun des nombreux points de sortie internes. "A-t-il placé
// un coup ce tour-ci ?" est détecté via le delta de floorStats.damageTaken — point de passage UNIQUE
// de toute perte de PV joueur (voir applyPlayerDamage()), donc un signal fiable même si l'attaque
// interne a pris un chemin qui NE frappe pas (télégraphe posé, buff de défense) : dans ce cas, ce
// tour compte quand même contre la durée restante de l'enrage, comme un tour de kiting normal — seul
// un coup RÉELLEMENT porté y met fin immédiatement (voir la consigne :
// "dure 2-3 tours OU jusqu'à ce qu'il place un coup").
function performBossCounterAttack(enemy, onDone) {
    const wasEnraged = !!(enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0);
    const dmgBefore = gameState.floorStats.damageTaken;
    // Gelé/Terrifiant (qualificatifs) : réduisent aussi les frappes d'un boss, pour tout ce tour.
    enemy._debuffAtkMult = consumeEnemyAttackDebuffs(enemy).mult;
    performBossCounterAttackInner(enemy, () => {
        enemy._debuffAtkMult = 1;
        if (wasEnraged && enemy.status.enraged) {
            if (gameState.floorStats.damageTaken > dmgBefore) {
                endMobEnrage(enemy);
            } else {
                enemy.status.enraged.rounds -= 1;
                if (enemy.status.enraged.rounds <= 0) endMobEnrage(enemy);
            }
        }
        if (onDone) onDone();
    });
}

// Sélectionne le pattern (inchangé, mêmes seuils/tirages qu'avant ce chantier — voir Chantier 2 du
// rework combat) puis construit la liste de beats qui le joue. Les tirages Math.random() de
// SÉLECTION restent tous synchrones, AVANT toute construction de step, exactement comme avant : seul
// le déroulé visuel (executeBossStrike()/logEvent() à l'intérieur d'un step) est décalé dans le temps.
// Répartition heavy/normal/vide : voir config.combatRhythm et le commentaire de runCombatBeats() —
// télégraphe posé (heavy et defBuff, moment d'annonce à fort enjeu, voir la bannière du Chantier 1),
// télégraphe EXÉCUTÉ et phase 3 (folie) sont "heavy" ; l'attaque de base et le harcèlement à distance
// restent au rythme standard ; le multi-coups espace ses frappes de beatMultiHit après la première.
function performBossCounterAttackInner(enemy, onDone) {
    const phase = getBossPhase(enemy);
    const bp = config.bossPhases;
    const rhythm = config.combatRhythm;
    let enemyAtk = enemy.atk;

    // Anti-abus mêlée collée + enrage par distance (Chantier 3) : mêmes multiplicateurs que le mob
    // normal/élite (resolveEnemyCounterAttack()), appliqués ICI UNE SEULE FOIS avant la sélection de
    // pattern, donc reflétés dans TOUTES les branches ci-dessous (télégraphe, multi-coups,
    // harcèlement, attaque de base, phase 3) sans dupliquer le multiplicateur à chaque point d'usage.
    if (gameState.combatDistance <= 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.meleeGluedDamageMult);
    }
    if (enemy.status.enraged && enemy.status.enraged.rounds > 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.atkMult);
    }

    // Un coup qui vide les PV du joueur programme gameOver() — jamais un beat de plus après la mort,
    // qui n'a rien à attendre. Petit helper pour ne pas dupliquer ce garde-fou à chaque step. Renvoie
    // les dégâts réellement encaissés (Chantier 8) : le multi-coups en a besoin pour construire sa
    // ligne de résumé consolidée à partir des montants silencieux de chaque frappe.
    const strikeAndCheckDeath = (atk, label, pressureFloorOverride, heavy = false, silent = false) => {
        const dealt = executeBossStrike(enemy, atk, label, pressureFloorOverride, heavy, silent);
        if (gameState.hp <= 0) { gameState.hp = 0; setTimeout(() => gameOver(false, enemy), COMBAT_BEAT_MS); }
        return dealt;
    };

    // Changement de phase (chantier "lisibilité combat", Chantier 10) : détecté ICI, une seule fois
    // par tour, sur la phase déjà calculée ci-dessus — enemy.lastKnownPhase (posé au Chantier 6, à
    // l'entrée en combat) est mis à jour DANS TOUS LES CAS, mais un step de bannière n'est prépendu au
    // pattern du tour QUE si la phase vient de MONTER (jamais en phase 1 : rien à annoncer en y
    // entrant, c'est l'état de départ). runPattern() (au lieu d'appeler runCombatBeats() directement)
    // centralise ce préfixe pour ne pas le dupliquer sur les 7 points de sortie de cette fonction.
    const phaseJustIncreased = phase > enemy.lastKnownPhase;
    enemy.lastKnownPhase = phase;
    const runPattern = (patternSteps) => {
        const steps = phaseJustIncreased
            ? [{ run: () => announceBossPhaseChange(enemy, phase), delay: rhythm.beatHeavyEvent }, ...patternSteps]
            : patternSteps;
        runCombatBeats(steps, onDone);
    };

    // Phase 3 ("folie") : dégâts +40% fixes, pas de télégraphe — le boss cesse d'être tactique et
    // frappe en continu. enemy.status.frenzied (lu par performPlayerAttack()) réduit symétriquement
    // sa DEF effective : la fenêtre risque/récompense de cette phase (voir config.bossPhases.phase3).
    if (phase === 3) {
        enemy.status.frenzied = true;
        enemy.status.telegraph = null; // un télégraphe en cours à l'entrée en phase 3 est abandonné
        enemyAtk = Math.round(enemyAtk * bp.phase3.atkMult);
        runPattern([
            { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}], pris de folie furieuse, vous`, undefined, true), delay: rhythm.beatHeavyEvent }
        ]);
        return;
    }
    enemy.status.frenzied = false;

    // Exécution d'un télégraphe posé au tour précédent (annoncé, donc jamais une surprise)
    if (enemy.status.telegraph) {
        const tg = enemy.status.telegraph;
        enemy.status.telegraph = null;
        if (tg.type === 'heavy') {
            const boosted = Math.round(enemyAtk * bp.telegraphHeavyMult);
            let parry = 'fail';
            runPattern([
                // Parade (chantier 6, V3) : fenêtre de timing AVANT le coup — rien ne change sans épreuve ni en cas de Raté.
                { interactive: true, run: (done) => runBossTrial(enemy, 'parry', (o) => { parry = o; done(); }) },
                {
                    run: () => {
                        if (parry === 'perfect') {
                            const riposte = parryRiposte(enemy);
                            logEvent(`🛡️ Parade parfaite ! Vous détournez l'attaque de [${enemy.name}] et ripostez (${riposte} dégâts) : sa garde est ouverte.`, "success");
                            return;
                        }
                        const parried = parry === 'success';
                        const mult = parried ? MINIGAME_SETTINGS.boss.parry.successDamageMult : 1;
                        const floor = parried ? gameState.maxHp * config.mobDamageScaling.pressureFloorFrac * mult : undefined; // le plancher de pression suit la réduction
                        strikeAndCheckDeath(Math.round(boosted * mult), `[${enemy.name}] abat son attaque annoncée${parried ? ', que vous parez à moitié,' : ''} et`, floor, true);
                    },
                    delay: rhythm.beatHeavyEvent
                }
            ]);
            return;
        }
        if (tg.type === 'defBuff') {
            let guard = 'fail';
            runPattern([
                // Briser la garde (chantier 6, V3) : un point faible à toucher avant que la garde ne monte.
                { interactive: true, run: (done) => runBossTrial(enemy, 'guard', (o) => { guard = o; done(); }) },
                {
                    run: () => {
                        if (guard === 'success' || guard === 'perfect') {
                            applyGuardBreak(enemy, guard);
                            logEvent(`🔨 Vous brisez la garde de [${enemy.name}] avant qu'elle ne monte${guard === 'perfect' ? ' : sa défense s\'ouvre même !' : '.'}`, "success");
                            return;
                        }
                        enemy.status.defBuffed = { rounds: bp.defBuffRounds };
                        logEvent(`[${enemy.name}] se hérisse : sa garde vient de monter, sans vous frapper ce tour-ci.`, "info");
                    },
                    delay: rhythm.beatHeavyEvent
                }
            ]);
            return;
        }
    }

    // Phase 2 : patterns supplémentaires (frappe multiple, harcèlement à distance, buff de défense
    // télégraphié), en plus de la base de phase 1 ci-dessous. Chances mutuellement exclusives.
    if (phase === 2) {
        const roll = Math.random();
        let threshold = bp.multiStrikeChance;
        if (roll < threshold) {
            const hits = 2 + (Math.random() < 0.5 ? 0 : 1); // 2 ou 3 coups
            const perHitAtk = Math.round(enemyAtk * (bp.multiStrikeTotalMult / hits));
            // Plancher de pression réparti entre les coups (voir le commentaire d'executeBossStrike) :
            // la SOMME sur le tour reste le plancher standard, au lieu de le multiplier par `hits`.
            const perHitPressureFloor = (gameState.maxHp * config.mobDamageScaling.pressureFloorFrac) / hits;
            logEvent(`[${enemy.name}] enchaîne ${hits} frappes rapides !`, "danger");
            // beatMultiHit entre chaque frappe (première frappe au rythme standard, comme n'importe
            // quelle riposte) — un décès en cours de rafale arrête la file (voir strikeAndCheckDeath).
            // Chaque frappe individuelle reste SILENCIEUSE (Chantier 8, lisibilité combat) : au lieu de
            // N lignes de log quasi identiques, UNE seule ligne de résumé après la dernière frappe qui
            // atteint réellement sa cible (jamais si le joueur meurt en cours de rafale — l'écran Game
            // Over prend le relais, un résumé de plus n'apporterait rien).
            const dealtAmounts = [];
            const steps = [];
            for (let i = 0; i < hits; i++) {
                steps.push({
                    run: () => {
                        if (gameState.hp <= 0) return;
                        dealtAmounts.push(strikeAndCheckDeath(perHitAtk, `Frappe ${i + 1}/${hits} :`, perHitPressureFloor, false, true));
                        if (i === hits - 1 && gameState.hp > 0) {
                            const total = dealtAmounts.reduce((sum, d) => sum + d, 0);
                            logEvent(`💥 ${dealtAmounts.length} frappes vous touchent : ${dealtAmounts.join(' + ')} = ${total} dégâts au total.`, "danger");
                        }
                    },
                    delay: i === 0 ? rhythm.beatActionToRiposte : rhythm.beatMultiHit
                });
            }
            runPattern(steps);
            return;
        }
        threshold += bp.rangedHarassChance;
        if (roll < threshold) {
            // Harcèlement à distance : mécanique volontairement minimale ici (pont avec le futur
            // Chantier 3 "enrage distance", pas encore implémenté — voir NOTES_COMBAT.md).
            const harassAtk = Math.round(enemyAtk * bp.rangedHarassMult);
            runPattern([
                { run: () => strikeAndCheckDeath(harassAtk, `[${enemy.name}] vous harcèle à distance et`), delay: rhythm.beatActionToRiposte }
            ]);
            return;
        }
        threshold += bp.defBuffTelegraphChance;
        if (roll < threshold) {
            runPattern([{
                run: () => {
                    enemy.status.telegraph = { type: 'defBuff' };
                    logEvent(`[${enemy.name}] se raidit, une garde imminente se prépare...`, "info");
                },
                delay: rhythm.beatHeavyEvent
            }]);
            return;
        }
    }

    // Phase 1 (et repli de phase 2) : chance de télégraphier une attaque lourde pour le tour
    // suivant (annonce sans dégât), sinon attaque de base normale.
    const heavyChance = phase === 1 ? bp.phase1TelegraphChance : bp.phase2TelegraphChance;
    if (Math.random() < heavyChance) {
        runPattern([{
            run: () => {
                enemy.status.telegraph = { type: 'heavy' };
                logEvent(`[${enemy.name}] prépare un coup dévastateur...`, "info");
            },
            delay: rhythm.beatHeavyEvent
        }]);
        return;
    }

    runPattern([
        { run: () => strikeAndCheckDeath(enemyAtk, `[${enemy.name}] vous`), delay: rhythm.beatActionToRiposte }
    ]);
}

// Riposte de l'ennemi : tient compte de son propre saignement/étourdissement en cours, de l'armure
// équipée du joueur, et peut infliger un effet de statut selon son trait élémentaire. `onDone` (voir
// runCombatBeats()) est appelé une fois TOUTE la séquence visuelle de ce tour jouée — immédiatement
// pour un mob normal (un seul beat) ou après le dernier beat d'un pattern de boss.
function resolveEnemyCounterAttack(onDone) {
    const enemy = gameState.currentEnemy;
    if (!enemy) { if (onDone) onDone(); return; } // sécurité si le combat vient d'être résolu pendant la pause

    // Saignement en cours sur l'ennemi (infligé par une arme du joueur) : tique avant son action.
    // Affichage immédiat (pas de beat dédié) : un tick de saignement est un petit événement annexe,
    // pas "la riposte" elle-même — voir config.combatRhythm.beatEmptyEvent.
    if (enemy.status && enemy.status.bleed && enemy.status.bleed.rounds > 0) {
        const dmg = enemy.status.bleed.dmgPerRound;
        enemy.hp -= dmg;
        enemy.status.bleed.rounds -= 1;
        if (enemy.status.bleed.rounds <= 0) enemy.status.bleed = null;
        logEvent(`🩸 [${enemy.name}] souffre de son saignement (-${dmg} PV).`, "danger");
        if (enemy.hp <= 0) {
            logEvent(`[${enemy.name}] succombe à ses blessures !`, "success");
            winCombat();
            if (onDone) onDone();
            return;
        }
    }

    // Étourdissement en cours sur l'ennemi : il rate son tour
    if (enemy.status && enemy.status.stunned) {
        logEvent(`[${enemy.name}] est étourdi et ne peut pas riposter !`, "info");
        const stunLeft = typeof enemy.status.stunned === 'number' ? enemy.status.stunned - 1 : 0; // Uppercut + synergie Troll : étourdi plusieurs tours
        enemy.status.stunned = stunLeft > 0 ? stunLeft : false;
        showDie(ui.combatEnemyDie, "😴");
        // Plus de updateUI() explicite ici (Chantier 7) : onDone() le fait déjà, centralisé.
        if (onDone) onDone();
        return;
    }

    // Immobilisé (action spéciale Immobiliser, chantier 6 V2) : il ne peut pas riposter, pendant `rounds` de ses tours.
    if (enemy.status && enemy.status.immobilized && enemy.status.immobilized.rounds > 0) {
        enemy.status.immobilized.rounds -= 1;
        if (enemy.status.immobilized.rounds <= 0) enemy.status.immobilized = null;
        logEvent(`[${enemy.name}] est immobilisé et ne peut pas riposter !`, "info");
        showDie(ui.combatEnemyDie, "🤼");
        if (onDone) onDone();
        return;
    }

    // Déconcentré (qualificatif Vibrant) : chance de rater complètement sa riposte, le temps que l'effet dure.
    if (enemy.status && enemy.status.distracted && enemy.status.distracted.rounds > 0) {
        const distracted = enemy.status.distracted;
        distracted.rounds -= 1;
        if (distracted.rounds <= 0) enemy.status.distracted = null;
        if (Math.random() * 100 < distracted.miss) {
            logEvent(`😬 [${enemy.name}], déconcentré, frappe complètement à côté !`, "info");
            showDie(ui.combatEnemyDie, "😬");
            if (onDone) onDone();
            return;
        }
    }

    // Compteur de kiting (Chantier 3) : atteindre ce point signifie que le mob RÉUSSIT à agir ce
    // tour-ci (quel que soit le chemin emprunté pour y arriver, boss ou non) — remise à sa base.
    resetMobKiting(enemy);

    // Boss : chemin de riposte totalement séparé (patterns par phase, voir performBossCounterAttack()
    // ci-dessous, Chantier 2 du rework combat) — jamais mélangé au chemin mob normal/élite ci-dessous,
    // pour ne rien changer au comportement déjà testé du Chantier 1 sur les mobs non-boss. Lui délègue
    // ENTIÈREMENT la responsabilité d'appeler onDone (sa propre séquence de beats en décide le moment).
    if (enemy.isBoss) {
        performBossCounterAttack(enemy, onDone);
        return;
    }

    // Mob normal/élite : un seul beat (le rythme standard action -> riposte, comme avant ce chantier)
    // avant de dérouler la riposte elle-même (resolveNonBossCounterAttack(), formules inchangées).
    runCombatBeats([
        { run: () => resolveNonBossCounterAttack(enemy), delay: config.combatRhythm.beatActionToRiposte }
    ], onDone);
}

function resolveNonBossCounterAttack(enemy) {
    const wasBlinded = gameState.status.blinded && gameState.status.blinded.rounds > 0;
    const wasCorroded = gameState.status.corroded && gameState.status.corroded.rounds > 0;

    // Ennemi ralenti (arme "Gelé") ou apeuré (arme "Intimidant") : sa riposte inflige moins de dégâts.
    // Les deux réductions se cumulent si l'ennemi subit les deux effets à la fois.
    const debuffs = consumeEnemyAttackDebuffs(enemy);
    let enemyAtk = debuffs.mult !== 1 ? Math.round(enemy.atk * debuffs.mult) : enemy.atk;
    const enemySlowedNote = debuffs.note;

    // Ténébreux (armure) : l'attaque entière peut être esquivée.
    if (rollPlayerDodge(enemy)) {
        showDie(ui.combatEnemyDie, "🌑");
        return;
    }

    // Élites (voir isEliteMob()) : multiplicateur de dégâts dédié, EN PLUS du scaling par étage et
    // des modificateurs aléatoires déjà existants (qui gonflaient surtout les PV) — chantier "rework
    // combat". Jamais sur un boss : isEliteMob() les exclut déjà (ils ont leur propre traitement,
    // voir Chantier 2 du même rework).
    // Rampe de la Convention collective (chantier 15) : ×1,3 / ×1,5 aux étages 3-4 ; jamais pour un chasseur de primes, dont les stats sont
    // calées sur le multiplicateur normal (computeBountyHunterStats()).
    if (isEliteMob(enemy)) {
        enemyAtk = Math.round(enemyAtk * (enemy.isBountyHunter ? config.mobDamageScaling.eliteDamageMult : eliteDamageMultForFloor(gameState.currentFloor)));
    }

    // Anti-abus mêlée collée (Chantier 3) : un mob inflige toujours +10% de dégâts à écart nul, pour
    // que rester collé au corps à corps ne devienne jamais une stratégie dominante à coût nul.
    if (gameState.combatDistance <= 0) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.meleeGluedDamageMult);
    }
    // Enrage par distance (Chantier 3) : dégâts +40% tant que l'état est actif (voir
    // noteMobKitingRound()/triggerMobEnrage()).
    const enemyWasEnraged = enemy.status && enemy.status.enraged && enemy.status.enraged.rounds > 0;
    if (enemyWasEnraged) {
        enemyAtk = Math.round(enemyAtk * config.distanceEnrage.atkMult);
    }

    const enemyDamage = rollDamage(enemyAtk, getEffectiveDef(), {
        // Plancher de pression / cap de réduction : dégâts MOB -> joueur uniquement (chantier "rework
        // combat", voir config.mobDamageScaling et rollDamage()).
        pressureFloor: gameState.maxHp * config.mobDamageScaling.pressureFloorFrac,
        minMitigation: config.mobDamageScaling.minMitigation
    });

    // Compagnon : la Garde s'interpose souvent, les autres sont parfois pris dans la mêlée (en plus du
    // bonus passif de DEF de la Garde, voir getEffectiveDef()) — voir companionInterceptHit().
    const guardWasActive = hasActiveCompanion('guard');
    const intercept = companionInterceptHit(enemyDamage);
    let playerDamage = intercept.playerDamage;
    const companionAbsorbNote = intercept.note;

    const hpBefore = gameState.hp;
    playerDamage = applyPlayerDamage(playerDamage); // montant réellement perdu (Armure de scénario / Increvable)
    applyBraceReflect(enemy, playerDamage); // Encaisser (Sac de frappe, chantier 13)
    animateDieHit(ui.combatEnemyDie, 'right', playerDamage);
    playMobAttackFx(enemy, { heldPlayerHp: hpBefore }, () => {
        showFloatingDamage(ui.sceneCrawlerAnchor, playerDamage, { toPlayer: true }); // mob normal/élite : jamais "heavy" (réservé aux moments boss/enrage)
    });
    const guardNote = guardWasActive
        ? ` (réduits grâce à la garde de ${gameState.companion.name})`
        : "";
    // Note d'état déplacée après les dégâts plutôt qu'entre le nom et "vous inflige" (chantier
    // "lisibilité combat", Chantier 8) : lecture plus naturelle, aucune info retirée.
    logEvent(`[${enemy.name}] vous inflige ${playerDamage} dégâts${enemySlowedNote}${wasBlinded ? " (vous étiez ébloui)" : ""}${wasCorroded ? " (armure corrodée)" : ""}${guardNote}${companionAbsorbNote}.`, "danger");

    // Le compagnon tombe s'il vient d'encaisser le coup de trop : à terre jusqu'au prochain repos ou soin.
    checkCompanionDowned();

    // L'éblouissement et la corrosion se dissipent d'un round à chaque riposte encaissée
    if (wasBlinded) {
        gameState.status.blinded.rounds -= 1;
        if (gameState.status.blinded.rounds <= 0) gameState.status.blinded = null;
    }
    if (wasCorroded) {
        gameState.status.corroded.rounds -= 1;
        if (gameState.status.corroded.rounds <= 0) gameState.status.corroded = null;
    }

    // Enrage par distance (Chantier 3) : une frappe RÉUSSIE pendant l'état (celle-ci, pas la ruée
    // d'entrée qui l'a déclenché — voir triggerMobEnrage()) met fin à l'état immédiatement.
    if (enemyWasEnraged) {
        endMobEnrage(enemy);
    }

    if (gameState.hp <= 0) {
        gameState.hp = 0;
        setTimeout(() => gameOver(false, enemy), COMBAT_BEAT_MS); // Laisse le temps au dé/impact de se jouer
        return;
    }

    // Compagnon "Premiers secours" : chance de soigner le joueur après la riposte ennemie (et un peu de mana)
    companionMedicAfterRiposte();

    applyMobEffectOnPlayer(enemy);
    applyArmorMechanic(enemy, playerDamage);
    // Plus de updateUI() ici (chantier "lisibilité combat", Chantier 7) : centralisé dans l'onDone
    // d'enemyCounterAttack(), pour couvrir aussi les patterns de boss qui n'appelaient jamais cette
    // fonction (voir le commentaire d'enemyCounterAttack()).
}

// --- Les 3 types d'attaque ---
// Chacune est reliée à sa propre compétence : plus elle est utilisée en combat, plus elle progresse
// (XP dédiée, indépendante des autres compétences et du niveau général du joueur).
const SKILL_XP_PER_USE = 3;

// Arme : la référence, équilibrée. Bénéficie du bonus de dégâts et de la mécanique spéciale
// (saignement/étourdissement) de l'arme équipée, le cas échéant. Utilisable uniquement à distance
// nulle (corps à corps), avec une arme réellement équipée — voir attackRanged() pour l'équivalent
// à distance, et attackUnarmed() pour le repli à mains nues sans arme.
function attackWeapon() {
    if (gameState.combatDistance > 0) {
        logEvent("Trop loin pour frapper à l'arme — approchez-vous ou tirez !", "danger");
        return;
    }
    if (!gameState.equipment.weapon) {
        logEvent("Vous n'avez pas d'arme équipée — essayez à mains nues !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;
    gameState.lastAttackKind = 'weapon'; // Posture du crawler (scene.js) : l'arme de mêlée en main

    // Arme arrachée par un effet magnétique en cours : l'attaque à l'arme est indisponible
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Écart nul garanti (voir garde ci-dessus) : sans effet sur un mob de mêlée, mais un mob à distance doit encore reculer pour tirer
        return;
    }

    const atkMultiplier = weaponAttackMultiplier('weaponMult'); // +4 % par niveau d'Arme, × style de classe (Duelliste)
    const equippedGear = gameState.equipment.weapon;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear: equippedGear }, "à l'arme");
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(equippedGear); // Ne fait rien si le combat vient de se terminer ou si l'arme n'a pas de mécanique
    }
}

// Tir : équivalent à distance de l'attaque à l'arme, avec l'arme à distance équipée. Utilisable
// uniquement quand de la distance sépare le joueur du monstre ET qu'une arme à distance est
// réellement équipée — voir attackWeapon() pour l'équivalent en corps à corps.
function attackRanged() {
    if (gameState.combatDistance <= 0) {
        logEvent("Trop près pour tirer — repassez à l'Arme !", "danger");
        return;
    }
    if (!gameState.equipment.ranged) {
        logEvent("Vous n'avez pas d'arme à distance équipée !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;
    gameState.lastAttackKind = 'ranged'; // Posture du crawler (scene.js) : l'arme à distance en main

    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) {
        gameState.status.disarmed.rounds -= 1;
        if (gameState.status.disarmed.rounds <= 0) gameState.status.disarmed = null;
        showDie(ui.combatPlayerDie, "🧲");
        logEvent("Votre arme reste hors de portée, toujours attirée au loin !", "danger");
        resolveEnemyReaction(); // Un mob de mêlée hors de portée ne peut pas punir ce tour perdu, mais tente de se rapprocher
        return;
    }

    const atkMultiplier = weaponAttackMultiplier('rangedMult'); // Même compétence "Arme" que le corps à corps ; style Franc-tireur
    const equippedGear = gameState.equipment.ranged;
    const weaponBonus = equippedGear ? (equippedGear.baseDmg || 0) : 0;
    const effectiveAtk = gameState.atk + weaponBonus;

    const landed = performPlayerAttack(effectiveAtk, { atkMultiplier, varianceRange: 0.15, defReduction: 0, gear: equippedGear }, "à distance");
    if (landed) {
        gainSkillXp('weapon', SKILL_XP_PER_USE);
        applyWeaponMechanic(equippedGear);
    }
}

// Mains nues : moins puissant, mais ignore une bonne partie de la DEF adverse. Utilisable
// uniquement à distance nulle (corps à corps), comme l'attaque à l'arme.
// Chaque niveau de compétence Mains nues améliore la capacité à contourner la DEF adverse.
function attackUnarmed() {
    if (gameState.combatDistance > 0) {
        logEvent("Trop loin pour frapper à mains nues !", "danger");
        return;
    }
    if (!tryPlayerAction()) return;
    gameState.lastAttackKind = 'unarmed'; // Posture du crawler (scene.js) : garde du boxeur

    const skill = gameState.skills.unarmed;
    const defReduction = Math.min(0.75, 0.35 + 0.03 * (skill.level - 1)); // +3% par niveau, plafonné à 75%
    const landed = performPlayerAttack(gameState.atk, { atkMultiplier: 0.75 * unarmedDamageMult(), varianceRange: 0.10, defReduction }, "à mains nues");
    if (landed) gainSkillXp('unarmed', SKILL_XP_PER_USE);
}
