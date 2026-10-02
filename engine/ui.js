// engine/ui.js — updateUI(), effets d'écran, journal, en-tête de scène.
// Extrait d'app.js (même ordre de chargement, même espace global) : voir CLAUDE.md, « Moteur : engine/ ».
function updateUI() {
    applyScreenStateEffects();
    ui.playerName.innerText = gameState.playerName;
    ui.floorLevel.innerText = gameState.currentFloor;
    ui.districtName.innerText = gameState.currentDistrict;

    // Fiche du crawler sous le nom (chantier 9) : barre de PV, ATK et DEF
    setHpBar(ui.hpBar, ui.hpText, gameState.hp, gameState.maxHp);
    ui.playerAtk.innerText = gameState.atk;
    ui.playerDef.innerText = getEffectiveDef();
    if (ui.playerGold) ui.playerGold.innerText = gameState.gold;

    updateAnomalyStatusUI();
    updateStarterBuffUI();
    updateTrialStatusUI();
    updateOriginUI();

    // Icônes de statut du joueur
    let playerIcons = "";
    if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🩸";
    if (gameState.status.stunned) playerIcons += "💫";
    if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
    if (gameState.status.confused && gameState.status.confused.rounds > 0) playerIcons += "🌀";
    if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) playerIcons += "🧲";
    if (gameState.status.blinded && gameState.status.blinded.rounds > 0) playerIcons += "✨";
    if (gameState.status.corroded && gameState.status.corroded.rounds > 0) playerIcons += "🧪";
    if (gameState.status.feared && gameState.status.feared.rounds > 0) playerIcons += "😱";
    if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) playerIcons += "💉";
    if (gameState.status.manaShield && gameState.status.manaShield.rounds > 0) playerIcons += "🔰";
    ui.playerStatusIcons.innerText = playerIcons;

    // Mise à jour du niveau et de l'XP
    ui.playerLevel.innerText = gameState.level;
    ui.xpText.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    ui.xpBar.style.width = `${Math.min(100, (gameState.xp / gameState.xpToNextLevel) * 100)}%`;
    if (ui.xpBarMini) ui.xpBarMini.style.width = ui.xpBar.style.width;
    if (ui.xpTextMini) ui.xpTextMini.innerText = `${gameState.xp}/${gameState.xpToNextLevel}`;
    updateBottomNav();

    // Mise à jour de la carte joueur (compétences)
    const skillBarMap = {
        weapon: [ui.skillWeaponLevel, ui.skillWeaponBar],
        unarmed: [ui.skillUnarmedLevel, ui.skillUnarmedBar],
        magic: [ui.skillMagicLevel, ui.skillMagicBar],
        stealth: [ui.skillStealthLevel, ui.skillStealthBar]
    };
    for (const key in skillBarMap) {
        const skill = gameState.skills[key];
        const [levelEl, barEl] = skillBarMap[key];
        levelEl.innerText = `Nv.${skill.level}`;
        barEl.style.width = `${Math.min(100, (skill.xp / skill.xpToNext) * 100)}%`;
    }

    // Barre de Mana : n'existe côté joueur (visuellement) qu'une fois un sort équipé, voir
    // equipSpell(). Mise à jour ici (hors combat) ET dans la zone de combat plus bas, toutes deux
    // pilotées par le même gameState.mana.
    const hasSpellEquipped = !!gameState.equipment.spell;
    if (ui.manaBarWrapper) {
        ui.manaBarWrapper.classList.toggle('hidden', !hasSpellEquipped);
        if (hasSpellEquipped) {
            ui.manaText.innerText = `${Math.round(gameState.mana)}/${gameState.maxMana}`;
            ui.manaBar.style.width = `${Math.min(100, (gameState.mana / gameState.maxMana) * 100)}%`;
        }
    }
    if (ui.combatManaWrapper) {
        ui.combatManaWrapper.classList.toggle('hidden', !hasSpellEquipped);
        if (hasSpellEquipped) {
            ui.combatManaText.innerText = `${Math.round(gameState.mana)}/${gameState.maxMana}`;
            ui.combatManaBar.style.width = `${Math.min(100, (gameState.mana / gameState.maxMana) * 100)}%`;
        }
    }

    // Mise à jour du temps
    ui.timeText.innerText = formatTimeRemaining(gameState.timeLeft);    const timePercentage = (gameState.timeLeft / gameState.maxTime) * 100;
    ui.timeBar.style.width = `${timePercentage}%`;
    
    // Changer la couleur de la barre si le temps est critique
    if (timePercentage <= 20) {
        ui.timeBar.classList.replace('bg-blue-600', 'bg-red-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(220, 38, 38, 1)";
    } else {
        ui.timeBar.classList.replace('bg-red-600', 'bg-blue-600');
        ui.timeBar.style.boxShadow = "0 0 15px rgba(37, 99, 235, 1)";
    }

    // Alerte escalier (chantier "QoL/équilibrage", Chantier E — voir NOTES_QOL_EQUILIBRAGE.md) :
    // bandeau discret sous la barre de temps dès que timeLeft/maxTime <= 25%, jamais en combat (le
    // panneau latéral PV/statut prend toute la place utile à ce moment-là, et le temps n'y est de
    // toute façon pas la ressource sur laquelle agir dans l'instant).
    if (ui.stairAlertBanner) {
        ui.stairAlertBanner.classList.toggle('hidden', timePercentage > 25 || gameState.inCombat);
    }

    // Gestion de l'affichage du combat : la scène d'exploration laisse la place à la zone de combat
    // (barres de vie, scène, boutons — voir renderScene('combat') dans scene.js pour la scène et les PV).
    if (gameState.inCombat) {
        ui.advanceHint.classList.add('hidden'); // On ne peut pas avancer pendant un combat
        ui.combatZone.classList.remove('hidden');
        ui.exploreStage.classList.add('hidden');

        let playerIcons = "";
        if (gameState.status.bleed && gameState.status.bleed.rounds > 0) playerIcons += "🔥";
        if (gameState.status.stunned) playerIcons += "💫";
        if (gameState.status.slowed && gameState.status.slowed.rounds > 0) playerIcons += "🐌";
        if (gameState.status.confused && gameState.status.confused.rounds > 0) playerIcons += "🌀";
        if (gameState.status.disarmed && gameState.status.disarmed.rounds > 0) playerIcons += "🧲";
        if (gameState.status.blinded && gameState.status.blinded.rounds > 0) playerIcons += "✨";
        if (gameState.status.corroded && gameState.status.corroded.rounds > 0) playerIcons += "🧪";
        if (gameState.status.feared && gameState.status.feared.rounds > 0) playerIcons += "😱";
        if (gameState.status.adrenaline && gameState.status.adrenaline.rounds > 0) playerIcons += "💉";
        if (gameState.status.manaShield && gameState.status.manaShield.rounds > 0) playerIcons += "🔰";
        ui.combatPlayerStatus.innerText = playerIcons;

        // Indicateur compagnon (sous la barre de vie du joueur), si un compagnon est actif
        if (gameState.companion) {
            ui.companionCombatIndicator.classList.remove('hidden');
            ui.companionCombatName.innerText = gameState.companion.name;
            setHpRing(ui.companionCombatHpRing, ui.companionCombatHp, gameState.companion.hp, gameState.companion.maxHp);
        } else {
            ui.companionCombatIndicator.classList.add('hidden');
        }

        if (gameState.currentEnemy) {
            const elite = isEliteMob(gameState.currentEnemy);
            ui.enemyName.innerText = gameState.currentEnemy.isBoss
                ? `👑 ${gameState.currentEnemy.name}`
                : elite ? `💀 ${gameState.currentEnemy.name}` : gameState.currentEnemy.name;
            ui.enemyName.classList.toggle('text-yellow-400', !!gameState.currentEnemy.isBoss);
            ui.enemyName.classList.toggle('text-red-500', elite);

            renderEnemyStatusBadges(gameState.currentEnemy);

            // Badge de phase permanent (chantier "lisibilité combat", Chantier 10) : discret,
            // visible dès la phase 2 seulement (jamais en phase 1 ni sur un mob normal/élite —
            // la bannière de transition suffit pour l'ANNONCE, ce badge est le rappel permanent).
            if (ui.bossPhaseBadge) {
                const phase = gameState.currentEnemy.isBoss ? getBossPhase(gameState.currentEnemy) : 1;
                if (gameState.currentEnemy.isBoss && phase >= 2) {
                    ui.bossPhaseBadge.innerText = `Phase ${phase}`;
                    ui.bossPhaseBadge.classList.remove('hidden');
                } else {
                    ui.bossPhaseBadge.classList.add('hidden');
                }
            }
        }
        renderDistanceTension(gameState.currentEnemy);
        updateTelegraphBanner();

        // --- Distance de combat : verrouille/déverrouille Arme, Tir et Mains nues selon l'écart
        // actuel (0 = corps à corps possible, >0 = seul le Tir porte). Aucune notion de posture : ces
        // règles ne dépendent que de l'écart courant et de l'équipement.
        const distance = gameState.combatDistance || 0;
        const atMelee = distance <= 0;
        if (ui.btnAttackWeapon) {
            const weaponUsable = atMelee && !!gameState.equipment.weapon;
            ui.btnAttackWeapon.disabled = !weaponUsable;
            ui.btnAttackWeapon.classList.toggle('opacity-40', !weaponUsable);
            ui.btnAttackWeapon.classList.toggle('pointer-events-none', !weaponUsable);
        }
        if (ui.btnAttackUnarmed) {
            ui.btnAttackUnarmed.disabled = !atMelee;
            ui.btnAttackUnarmed.classList.toggle('opacity-40', !atMelee);
            ui.btnAttackUnarmed.classList.toggle('pointer-events-none', !atMelee);
        }
        if (ui.btnAttackRanged) {
            const rangedUsable = !atMelee && !!gameState.equipment.ranged;
            ui.btnAttackRanged.disabled = !rangedUsable;
            ui.btnAttackRanged.classList.toggle('opacity-40', !rangedUsable);
            ui.btnAttackRanged.classList.toggle('pointer-events-none', !rangedUsable);
        }
        // Magie : un seul sort équipé à la fois (gameState.equipment.spell), mais sa catégorie
        // (melee/ranged) le fait se comporter exactement comme Arme/Tir — grisé au mauvais écart, ou
        // sans mana suffisant, ou sans aucun sort équipé. Le libellé du bouton reflète le sort
        // équipé (nom, icône, coût), sinon une invitation neutre à passer par le Grimoire.
        if (ui.btnAttackMagic) {
            const spell = gameState.equipment.spell;
            let magicUsable = false;
            if (spell) {
                const spellDistanceOk = spell.spellCategory === 'any' || (spell.spellCategory === 'melee' ? atMelee : !atMelee);
                magicUsable = spellDistanceOk && gameState.mana >= getSpellManaCost(spell);
            }
            ui.btnAttackMagic.disabled = !magicUsable;
            ui.btnAttackMagic.classList.toggle('opacity-40', !magicUsable);
            ui.btnAttackMagic.classList.toggle('pointer-events-none', !magicUsable);
            ui.btnAttackMagic.innerHTML = spell
                ? `${spell.icon || '✨'} ${spell.spellName}<span class="block text-[8px] normal-case opacity-70">🔷 ${getSpellManaCost(spell)}</span>`
                : `✨ Magie<span class="block text-[8px] normal-case opacity-70">(aucun sort)</span>`;
        }
        // S'approcher (attemptSprint) / S'éloigner (attemptRetreat) : TOUJOURS affichés pendant un
        // combat, jamais masqués — seulement grisés à l'extrémité correspondante (rien à combler à
        // écart nul, rien à gagner à écart maximal). Chacun booste le jet de positionnement en
        // faveur du joueur (avantage : deux dés, le meilleur gardé), quel que soit le type de mob.
        if (ui.btnSprint) {
            const approachUsable = !!gameState.currentEnemy && distance > 0;
            ui.btnSprint.disabled = !approachUsable;
            ui.btnSprint.classList.toggle('opacity-40', !approachUsable);
            ui.btnSprint.classList.toggle('pointer-events-none', !approachUsable);
        }
        if (ui.btnRetreat) {
            const retreatUsable = !!gameState.currentEnemy && distance < config.rangedCombat.maxDistance;
            ui.btnRetreat.disabled = !retreatUsable;
            ui.btnRetreat.classList.toggle('opacity-40', !retreatUsable);
            ui.btnRetreat.classList.toggle('pointer-events-none', !retreatUsable);
        }
        // Charger (attemptEngage(), Chantier 3) : même disponibilité que S'approcher (un écart à
        // combler), alternative agressive qui enchaîne une attaque bonus au lieu d'un simple
        // repositionnement.
        if (ui.btnEngage) {
            const engageUsable = !!gameState.currentEnemy && distance > 0;
            ui.btnEngage.disabled = !engageUsable;
            ui.btnEngage.classList.toggle('opacity-40', !engageUsable);
            ui.btnEngage.classList.toggle('pointer-events-none', !engageUsable);
        }
        rollCombatOccasion(); // Une fois par tour (chantier 6, V2)
        updateOccasionButton();
        updateClassAbilityUI();
        // Un mob "alerted" (échec de furtivité, voir attemptStealthEvasion()) ne laisse plus fuir.
        if (ui.btnFlee) {
            const fleeUsable = !gameState.currentEnemy || !gameState.currentEnemy.alerted;
            ui.btnFlee.disabled = !fleeUsable;
            ui.btnFlee.classList.toggle('opacity-40', !fleeUsable);
            ui.btnFlee.classList.toggle('pointer-events-none', !fleeUsable);
        }
    } else {
        // Consigne sous la scène (explorer), inutile pendant un choix en attente.
        ui.advanceHint.classList.toggle('hidden', isActionBlocked());
        ui.advanceHint.innerText = "👆 Touchez la scène pour explorer (-1H)";
        if (ui.exploreScene) ui.exploreScene.setAttribute('aria-label', "Explorer (-1H)");
        updateOccasionButton();
        ui.combatZone.classList.add('hidden');
        ui.exploreStage.classList.remove('hidden');
        // Salle sécurisée et ville spécialisée ont leur propre scène (au-dessus de leurs boutons) : la
        // scène d'exploration s'efface alors, seuls son titre et la dernière ligne restent.
        if (ui.exploreScene) ui.exploreScene.classList.toggle('hidden', !!(gameState.safehouseChoicePending || gameState.shopChoicePending));
        updateCompanionUI(); // Réaffiche/actualise la barre compagnon compacte hors combat
    }

    // Scène de combat en vue latérale (scene.js) : seul point d'entrée de son rendu.
    renderScene('combat');
    renderScene('crawlers'); // posture/équipement du crawler dans les scènes hors combat

    // La carte de l'étage (carte stylisée #floor-map-overlay, chantier 5, étages classiques ET urbains) est un
    // panneau sous la scène, ouvert/fermé par #btn-toggle-map (ouvert par défaut, mapPanelOpen). Elle se masque,
    // avec son bouton, dès qu'une "situation" est en cours (combat/boss/furtivité/compagnon, voir
    // isActionBlocked()) : la scène montre alors la situation.
    const mapAvailable = !!gameState.floorMap && !isActionBlocked();
    if (ui.floorMapOverlay) ui.floorMapOverlay.classList.toggle('hidden', !mapAvailable || !gameState.floorMap || !mapPanelOpen);
    if (ui.btnToggleMap) {
        ui.btnToggleMap.classList.toggle('hidden', !mapAvailable);
        ui.btnToggleMap.innerText = mapPanelOpen ? "✕ Fermer la carte" : "🗺️ Carte";
        ui.btnToggleMap.setAttribute('aria-expanded', mapPanelOpen ? 'true' : 'false');
    }

    // La carte suit la position courante : rafraîchie à chaque rendu.
    updateFloorMapUI();

    // Autosauvegarde (no-op tant que gameState.saveEnabled est faux, voir confirmPlayerName() /
    // restoreSaveForName()) : updateUI() est déjà appelée après quasiment toute action modifiant
    // l'état, donc un seul point d'accroche suffit à couvrir toute la boucle de jeu.
    updateAchievementsButton(); // Compteur 🏆 X/N de l'en-tête (chantier 2)
    updateBountyUI(); // Badge 🎯 de la prime (chantier 3)
    saveGame();
}

// Affiche un résultat de dégâts sous forme de "dé" avec une petite animation, sur le panneau
// latéral correspondant (joueur ou ennemi). `value` peut être un nombre ou un court symbole (ex: "✗").
// Circonférence du cercle de l'anneau de vie (rayon 18 : 2 * π * 18 ≈ 113.1), utilisée pour
// convertir un pourcentage de PV en longueur de trait visible (stroke-dashoffset).
const HP_RING_CIRCUMFERENCE = 113.1;

// Calcule une couleur en dégradé vert -> jaune -> rouge selon le pourcentage de PV restant,
// via la teinte HSL (120° = vert, 60° = jaune, 0° = rouge).
function hpColor(pct) {
    const hue = Math.max(0, Math.min(120, Math.round(pct * 120)));
    return `hsl(${hue}, 85%, 45%)`;
}

// Met à jour un anneau de vie circulaire (remplissage + couleur) et le nombre affiché en son centre.
// Barre de PV horizontale de la fiche du crawler (chantier 9) : même code couleur que l'anneau (hpColor()).
function setHpBar(barEl, textEl, current, max) {
    if (!barEl) return;
    const safeMax = max > 0 ? max : 1;
    const pct = Math.max(0, Math.min(1, current / safeMax));
    barEl.style.width = `${pct * 100}%`;
    barEl.style.background = hpColor(pct);
    if (textEl) textEl.innerText = `${Math.max(0, Math.round(current))}/${Math.round(max)}`;
}

function setHpRing(ringEl, valueEl, current, max) {
    const safeMax = max > 0 ? max : 1; // évite une division par zéro si jamais max vaut 0
    const pct = Math.max(0, Math.min(1, current / safeMax));
    ringEl.style.strokeDashoffset = HP_RING_CIRCUMFERENCE * (1 - pct);
    ringEl.style.stroke = hpColor(pct);
    valueEl.innerText = Math.max(0, Math.round(current));
}

function showDie(el, value) {
    el.innerText = value;
    el.classList.remove('die-pop');
    void el.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    el.classList.add('die-pop');
}

// Retour haptique (vibration). Fonctionne sur Android/Chrome ; iOS Safari ne supporte pas du tout
// l'API Vibration, quel que soit le navigateur — aucune vibration n'y sera donc perceptible. On
// vérifie la disponibilité avant d'appeler pour ne jamais lever d'erreur sur les navigateurs sans
// support (au lieu de planter silencieusement, on ignore proprement).
function triggerHaptic(pattern = 'light') {
    if (!('vibrate' in navigator)) return;
    const patterns = {
        light: 15,           // Un dé qui touche sa cible
        medium: 30,          // Une carte qu'on tire
        heavy: [30, 40, 60],  // Victoire, défaite, montée de niveau
    };
    try {
        navigator.vibrate(patterns[pattern] || patterns.light);
    } catch (e) {
        // Certains navigateurs peuvent lever une exception si l'appel est bloqué (ex: onglet en arrière-plan)
    }
}

// Hiérarchie visuelle des impacts (chantier "lisibilité combat", Chantier 4) : secousse de l'écran,
// réservée aux moments qui doivent se distinguer d'un coup normal EN UNE MICROSECONDE (voir
// triggerHeavyImpact() ci-dessous pour la liste exacte). JAMAIS pour une frappe normale.
function screenShake() {
    if (!ui.gameMain) return;
    ui.gameMain.classList.remove('screen-shake');
    void ui.gameMain.offsetWidth; // force le navigateur à relire le style pour pouvoir rejouer l'animation
    ui.gameMain.classList.add('screen-shake');
}

// Flash bref sur #screen-fx-overlay, même occasions que screenShake() — voir le commentaire CSS de
// .fx-impact-flash (index.html) pour le compromis assumé avec les classes de statut joueur déjà en
// place sur ce même nœud.
function screenImpactFlash() {
    if (!ui.screenFxOverlay) return;
    ui.screenFxOverlay.classList.remove('fx-impact-flash');
    void ui.screenFxOverlay.offsetWidth;
    ui.screenFxOverlay.classList.add('fx-impact-flash');
}

// Point d'appel UNIQUE pour les deux effets ci-dessus : exécution d'un télégraphe heavy, ruée
// d'enrage et chaque frappe de phase 3 (les 3 via le flag `heavy` d'executeBossStrike(), déjà posé au
// Chantier 3) et la mort du joueur (gameOver()). Sous prefers-reduced-motion, screenShake() devient un
// no-op visuel (animation désactivée en CSS) mais screenImpactFlash() continue de jouer, comme demandé
// explicitement par la consigne.
function triggerHeavyImpact() {
    screenShake();
    screenImpactFlash();
}

// Anime un dé de dégâts qui "vole" vers la barre de vie de sa cible, façon petit coup de poing.
// `direction` : 'left' (le dé du joueur vole vers les PV ennemis, à gauche) ou 'right' (le dé de
// l'ennemi vole vers les PV du joueur, à droite). Les PV sont déjà décrémentés avant l'appel : au
// moment de l'impact (environ à mi-vol du dé), la scène et les barres de vie sont redessinées pour
// que la barre baisse au même instant, même au milieu d'une séquence de coups (voir runCombatBeats()).
function animateDieHit(dieEl, direction, value) {
    dieEl.innerText = value;
    dieEl.classList.remove('die-pop', 'die-hit-left', 'die-hit-right');
    void dieEl.offsetWidth;
    dieEl.classList.add('die-pop', direction === 'left' ? 'die-hit-left' : 'die-hit-right');

    setTimeout(() => {
        renderScene('combat');
        triggerHaptic('light');
    }, 180);
}

// Décalage horizontal (±8px) des chiffres flottants, pour que deux chiffres quasi simultanés (un
// multi-coups par exemple) ne se superposent pas exactement. Volontairement PAS Math.random() :
// cette fonction est appelée à chaque point de dégâts réel, donc consommer le flux aléatoire partagé
// y désynchroniserait les séquences Math.random fixes de nombreux tests existants
// (tests/regression/*.js) qui n'ont rien à voir avec cet effet purement cosmétique. Un compteur qui
// boucle sur un petit jeu de décalages est tout aussi efficace visuellement et ne touche à rien.
const FLOATING_DAMAGE_OFFSETS = [-7, 6, -3, 8, -8, 3, -5, 7];
let floatingDamageOffsetIndex = 0;

// Taille des chiffres de dégâts selon la PART des PV max de la cible touchée (pas le montant brut : les
// dégâts grossissent avec les étages, un « 40 » énorme à l'étage 1 est banal à l'étage 12). Linéaire
// entre `minRatio` (et en dessous : `minPx`) et `maxRatio` (et au-delà : `maxPx`) ; un coup lourd
// ajoute `heavyBonusPx`, sans jamais dépasser `maxPx`. `pop` : grossissement au sommet de l'animation,
// plus marqué pour un gros coup (coupé sous prefers-reduced-motion, qui ne garde que la taille).
const FLOATING_DAMAGE_SIZE = { minPx: 13, maxPx: 28, minRatio: 0.03, maxRatio: 0.40, heavyBonusPx: 3, popMin: 1.08, popMax: 1.3 };
function floatingDamageScale(amount, maxHp, heavy = false) {
    const cfg = FLOATING_DAMAGE_SIZE;
    const ratio = maxHp > 0 ? amount / maxHp : 0;
    const t = Math.max(0, Math.min(1, (ratio - cfg.minRatio) / (cfg.maxRatio - cfg.minRatio)));
    const fontPx = Math.min(cfg.maxPx, Math.round(cfg.minPx + t * (cfg.maxPx - cfg.minPx) + (heavy ? cfg.heavyBonusPx : 0)));
    const pop = Math.round((cfg.popMin + t * (cfg.popMax - cfg.popMin)) * 100) / 100;
    return { fontPx, pop };
}

// Chiffre de dégâts flottant (chantier "lisibilité combat", Chantier 3) : un chiffre par impact,
// monte et s'estompe au-dessus du combattant touché (ancres #scene-mob-anchor/#scene-crawler-anchor,
// placées sur chaque silhouette par scene.js — le chiffre s'ajoute EN PLUS du dé qui vole déjà,
// jamais à sa place). `toPlayer` distingue les dégâts SUBIS par le joueur (rouge/orangé) des dégâts
// qu'il INFLIGE (blanc/jaune) ; sa taille suit la part des PV max de la cible (floatingDamageScale()),
// `heavy` l'agrandit encore un peu pour un coup marquant (télégraphe exécuté, ruée d'enrage, phase 3,
// attaque furtive, charge). Fait aussi trembler le combattant touché dans la
// scène (shakeSceneFighter(), scene.js). Se nettoie lui-même après son animation
// (`animationend`), fonctionne aussi bien avec l'animation normale que le simple fondu de
// prefers-reduced-motion (les deux déclenchent cet événement).
function showFloatingDamage(containerEl, amount, { heavy = false, toPlayer = false } = {}) {
    if (!containerEl) return;
    const el = document.createElement('span');
    el.className = `floating-damage ${toPlayer ? 'floating-damage-taken' : 'floating-damage-dealt'}${heavy ? ' floating-damage-heavy' : ''}`;
    el.innerText = `-${Math.round(amount)}`;
    const target = toPlayer ? gameState : gameState.currentEnemy;
    const { fontPx, pop } = floatingDamageScale(amount, target ? target.maxHp : 0, heavy);
    el.style.fontSize = `${fontPx}px`;
    el.style.setProperty('--fd-pop', pop);
    const offsetX = FLOATING_DAMAGE_OFFSETS[floatingDamageOffsetIndex];
    floatingDamageOffsetIndex = (floatingDamageOffsetIndex + 1) % FLOATING_DAMAGE_OFFSETS.length;
    el.style.left = `calc(50% + ${offsetX}px)`;
    el.addEventListener('animationend', () => el.remove());
    containerEl.appendChild(el);
    shakeSceneFighter(toPlayer ? 'crawler' : 'mob');
}

// Nombre de lignes gardées dans le journal court de combat (#combat-last-action) ; il n'en montre
// que ce que sa hauteur fixe permet, la plus récente toujours entière en bas.
const COMBAT_LOG_LINES = 3;
// Ennemi du combat dont le journal court affiche les lignes : un nouvel ennemi le remet à zéro.
let combatLogEnemy = null;

// Ajoute un message au journal complet (qui reçoit TOUT) et à l'affichage minimal du moment : hors
// combat, il devient la dernière ligne sous la scène d'exploration (#explore-last-line, écrasée à
// chaque message) ; pendant un combat, il rejoint le journal court de la zone de combat.
function logEvent(message, type = "normal") {
    // Couleurs adaptées au fond sombre du journal complet (reprend l'ancien style)
    const logColors = {
        danger: "text-red-400 font-bold",
        success: "text-green-400",
        info: "text-blue-300 italic",
        loot: "text-yellow-400 font-bold",
        normal: "text-gray-300"
    };
    if (!gameState.inCombat && ui.sceneLastLine) {
        ui.sceneLastLine.className = `min-h-[2.6em] px-0.5 text-[11px] leading-snug line-clamp-2 ${logColors[type] || logColors.normal}`;
        ui.sceneLastLine.innerText = message;
    }

    const logLine = document.createElement('div');
    logLine.className = logColors[type] || logColors.normal;
    logLine.innerText = `>> ${message}`;
    ui.fullLog.appendChild(logLine);
    ui.fullLog.scrollTop = ui.fullLog.scrollHeight;

    if (gameState.inCombat && ui.combatLastAction) {
        if (combatLogEnemy !== gameState.currentEnemy) {
            ui.combatLastAction.innerHTML = '';
            combatLogEnemy = gameState.currentEnemy;
        }
        const shortLine = document.createElement('p');
        shortLine.className = logColors[type] || logColors.normal;
        shortLine.innerText = message;
        ui.combatLastAction.appendChild(shortLine);
        while (ui.combatLastAction.children.length > COMBAT_LOG_LINES) {
            ui.combatLastAction.removeChild(ui.combatLastAction.firstElementChild);
        }
    }
}

// Prépare la scène d'exploration pour un nouvel événement (icône de repli, titre, type) : appelé au
// début de chaque nouvelle branche d'événement dans resolveCardEvent(), avant que logEvent() n'écrive
// la dernière ligne. `scene` : vignette dessinée dans la scène (nom, ou { key, enemy } — voir
// EXPLORE_VIGNETTES dans scene.js) ; absente ou inconnue, l'emoji s'affiche à sa place.
function setSceneHeader(icon, title, typeLabel, scene) {
    ui.sceneIcon.innerText = icon;
    ui.sceneTitle.innerText = title;
    ui.sceneTypeLabel.innerText = typeLabel;
    renderScene('explore', scene);
}

// Petit fondu à chaque nouvel événement d'exploration (voir .scene-draw-anim dans index.html).
function playSceneDrawAnimation() {
    if (!ui.exploreScene) return;
    ui.exploreScene.classList.remove('scene-draw-anim');
    void ui.exploreScene.offsetWidth; // force le navigateur à relire le style pour rejouer l'animation
    ui.exploreScene.classList.add('scene-draw-anim');
}

// Scène d'arrivée sur un étage (nouvelle partie, changement d'étage, sauvegarde restaurée) : la ville
// de départ sur un étage urbain, le quartier courant sinon — jamais la vignette de l'étage précédent.
function showFloorArrivalScene() {
    const city = isUrbanFloor() ? urbanCityById(gameState.floorMap.currentCityId) : null;
    if (city) {
        setSceneHeader('🏙️', city.name, 'Ville sûre', { key: 'citySafe', cityName: city.name });
    } else {
        setSceneHeader('🚪', `Étage ${gameState.currentFloor}`, 'Exploration', 'silence');
    }
}

// Carte de l'étage (Carte Urbaine) ouverte ou fermée par #btn-toggle-map — préférence d'affichage
// seulement, jamais un état de jeu (d'où une variable de module et non un champ de gameState).
let mapPanelOpen = true;
