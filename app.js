// app.js - Initialisation du jeu (écouteurs d'événements, premier rendu).
// Le moteur vit dans engine/*.js (voir CLAUDE.md, « Moteur : engine/ ») ; ce fichier est chargé en DERNIER.

// ==========================================
// INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS
// ==========================================

// Toucher la scène d'exploration explore (-1H), sur tous les étages. Clavier : Entrée sur la scène quand elle a
// le focus.
function onExploreSceneActivated() {
    if (isActionBlocked() || gameState.hp <= 0) return;
    triggerHaptic('medium');
    explore();
}
if (ui.exploreScene) {
    ui.exploreScene.addEventListener('click', onExploreSceneActivated);
    ui.exploreScene.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') onExploreSceneActivated(); });
}
if (ui.btnToggleMap) ui.btnToggleMap.addEventListener('click', () => toggleMapPanel());

// Bouton de redémarrage sur l'écran Game Over
ui.btnRestart.addEventListener('click', resetGame);
ui.btnWinRestart.addEventListener('click', resetGame);

// Bouton "Continuer" de l'écran d'escalier (voir continueFromFloorTransition())
if (ui.btnFloorTransitionContinue) ui.btnFloorTransitionContinue.addEventListener('click', continueFromFloorTransition);
if (ui.btnPactAtk) ui.btnPactAtk.addEventListener('click', () => choosePactBlessing('atk'));
[ui.raceChoiceCards, ui.classChoiceCards].forEach(box => {
    if (box) box.addEventListener('click', (e) => {
        const card = e.target.closest('[data-origin-key]');
        if (card) selectOrigin(card.dataset.originKey);
    });
});
if (ui.btnRaceConfirm) ui.btnRaceConfirm.addEventListener('click', confirmOriginChoice);
if (ui.btnClassConfirm) ui.btnClassConfirm.addEventListener('click', confirmOriginChoice);
if (ui.raceStatus) ui.raceStatus.addEventListener('click', openOriginSheet);
if (ui.classStatus) ui.classStatus.addEventListener('click', openOriginSheet);
if (ui.btnPactHp) ui.btnPactHp.addEventListener('click', () => choosePactBlessing('hp'));

// Écran de départ : nom du crawler (bouton ou touche Entrée), puis révélation du cadeau de bienvenue
ui.btnStartConfirm.addEventListener('click', confirmPlayerName);
ui.startNameInput.addEventListener('keydown', (e) => { if (e && e.key === 'Enter') confirmPlayerName(); });
ui.btnGiftContinue.addEventListener('click', dismissGiftReveal);

// Inspection d'un objet : toucher le fond referme ; toucher un objet porté l'inspecte.
if (ui.itemInspectOverlay) {
    ui.itemInspectOverlay.addEventListener('click', (e) => { if (e && e.target === ui.itemInspectOverlay) closeItemInspect(); });
}
[['equippedWeapon', 'weapon'], ['equippedRanged', 'ranged'], ['equippedArmor', 'armor'], ['equippedSpell', 'spell']].forEach(([uiKey, slot]) => {
    if (!ui[uiKey]) return;
    ui[uiKey].classList.add('cursor-pointer');
    ui[uiKey].addEventListener('click', () => inspectEquippedSlot(slot));
});

// Écran "Nettoyer les sauvegardes" (voir openManageSaves() dans app.js)
if (ui.btnOpenManageSaves) ui.btnOpenManageSaves.addEventListener('click', openManageSaves);
if (ui.btnManageSavesClose) ui.btnManageSavesClose.addEventListener('click', closeManageSaves);
if (ui.btnManageSavesDeleteAll) ui.btnManageSavesDeleteAll.addEventListener('click', requestDeleteAllSaves);
if (ui.btnManageSavesConfirmYes) ui.btnManageSavesConfirmYes.addEventListener('click', confirmSaveDeletion);
if (ui.btnManageSavesConfirmNo) ui.btnManageSavesConfirmNo.addEventListener('click', cancelSaveDeletion);
if (ui.btnManageSavesRestoreBackup) ui.btnManageSavesRestoreBackup.addEventListener('click', restoreSavesBackup);

// Clics sur les boutons de combat
ui.btnAttackWeapon.addEventListener('click', attackWeapon);
ui.btnAttackRanged.addEventListener('click', attackRanged);
ui.btnAttackUnarmed.addEventListener('click', attackUnarmed);
if (ui.btnOccasion) ui.btnOccasion.addEventListener('click', startOccasion);
if (ui.btnClassAbility) ui.btnClassAbility.addEventListener('click', useClassAbility);
ui.btnAttackMagic.addEventListener('click', attackMagic);
if (ui.btnSprint) ui.btnSprint.addEventListener('click', attemptSprint);
if (ui.btnRetreat) ui.btnRetreat.addEventListener('click', attemptRetreat);
if (ui.btnEngage) ui.btnEngage.addEventListener('click', attemptEngage);
ui.btnFlee.addEventListener('click', attemptFlee);

// Skip au clic/Espace/Entrée (chantier "lisibilité combat", Chantier 9) : accélère le tour de beats
// en cours plutôt que d'attendre son rythme normal — voir combatSkipRequested/runCombatBeats().
// Filtre `e.target.closest('button')` : un clic sur une VRAIE action de combat (même bulle jusqu'à
// #combat-zone) ne doit jamais être réinterprété en demande de skip, seulement un clic dans l'espace
// vide de la zone (nom de l'ennemi, bannière, barre de distance...).
if (ui.combatZone) {
    ui.combatZone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        requestCombatSkip();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return; // ne gêne jamais la saisie (nom du crawler...)
    requestCombatSkip();
});

// Clics sur les boutons de choix de boss (Combattre / Repérer et partir)
ui.btnFightBoss.addEventListener('click', fightBossNow);
ui.btnRetreatBoss.addEventListener('click', retreatFromBoss);
ui.btnDescendStairs.addEventListener('click', descendStairs);
ui.btnStayOnFloor.addEventListener('click', stayOnFloor);

// Clics sur les boutons de choix de salle sécurisée (Repos / Repartir)
ui.btnNapSafehouse.addEventListener('click', () => restAtSafehouse('nap'));
ui.btnSleepSafehouse.addEventListener('click', () => restAtSafehouse('sleep'));
ui.btnLeaveSafehouse.addEventListener('click', leaveSafehouse);

// Clics sur les boutons de choix de furtivité (Esquiver / Attaque Furtive)
ui.btnStealthEvade.addEventListener('click', attemptStealthEvasion);
ui.btnStealthAttack.addEventListener('click', attemptStealthAttack);

// Clics sur les boutons de rencontre de compagnon
ui.btnRecruitFriendly.addEventListener('click', recruitCompanion);
ui.btnDeclineCompanion.addEventListener('click', declineCompanion);
ui.btnFleeCompanion.addEventListener('click', fleeCompanionEncounter);
ui.btnRecruitHostile.addEventListener('click', recruitCompanion);
ui.btnAttackCompanion.addEventListener('click', attackCompanionEncounter);
ui.companionStatusBar.addEventListener('click', openCompanionSheet);
if (ui.btnAchievements) ui.btnAchievements.addEventListener('click', openAchievementsScreen);
SHOW_TONES.forEach(t => { if (ui.showButtons && ui.showButtons[t.key]) ui.showButtons[t.key].addEventListener('click', () => answerShow(t.key)); });
if (ui.btnShowRefuse) ui.btnShowRefuse.addEventListener('click', () => answerShow('refuse'));
if (ui.btnCloseAchievements) ui.btnCloseAchievements.addEventListener('click', closeAchievementsScreen);

// Clics sur l'écran marchand/professeur (ville spécialisée)
ui.btnTrainSkill.addEventListener('click', trainSkill);
ui.btnLeaveShop.addEventListener('click', leaveShop);
if (ui.arcadeStake) {
    ui.arcadeStake.addEventListener('input', () => { arcadeMessage = { text: "", tone: "info" }; if (ui.arcadeMessage) ui.arcadeMessage.innerText = ""; updateArcadeUI(); });
    ui.shopArcadeContent.addEventListener('click', e => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-arcade-stake]') : null;
        if (btn) setArcadeStakePreset(btn.dataset.arcadeStake);
    });
}

// Clics sur le choix "plonger/poursuivre" d'un repaire repéré sur la route
ui.btnDiveLair.addEventListener('click', diveIntoLair);
ui.btnDeclineLair.addEventListener('click', declineLair);

// Barre d'icônes du bas et ses panneaux (chantier 9).
if (ui.navEquipment) ui.navEquipment.addEventListener('click', () => openInventorySheet('equipment'));
if (ui.navBag) ui.navBag.addEventListener('click', () => openInventorySheet('bag'));
if (ui.navSpellbook) ui.navSpellbook.addEventListener('click', () => openInventorySheet('spellbook'));
Object.values(INVENTORY_SHEETS).forEach(key => {
    const sheet = ui[key];
    if (!sheet || !sheet.addEventListener) return;
    sheet.addEventListener('click', (e) => {
        if (!e) return;
        const target = e.target;
        const closeBtn = target && target.closest ? target.closest('[data-close-sheet]') : null;
        if (target === sheet || closeBtn) closeInventorySheets();
    });
});
attachFloorMapPointerHandlers(ui.floorMapSvg);
if (ui.btnFloorMapGo) ui.btnFloorMapGo.addEventListener('click', confirmFloorMapTravel);
if (ui.btnFloorMapCancel) ui.btnFloorMapCancel.addEventListener('click', cancelFloorMapTravel);
if (ui.btnFloorMapZoomIn) ui.btnFloorMapZoomIn.addEventListener('click', () => zoomFloorMap(1));
if (ui.btnFloorMapZoomOut) ui.btnFloorMapZoomOut.addEventListener('click', () => zoomFloorMap(-1));
if (ui.btnFloorMapRecenter) ui.btnFloorMapRecenter.addEventListener('click', recenterFloorMap);

// Clic sur le kit de test (bouton discret)
ui.btnDevTestKit.addEventListener('click', giveTestKit);
ui.btnDevJumpUrban.addEventListener('click', devJumpToUrbanFloor);
if (ui.btnDevMinigame) ui.btnDevMinigame.addEventListener('click', devTestMinigame);
initMinigameUi(); // Mini-jeux (chantier 6) : réglage, clavier, pause d'onglet

// Lancement du jeu
generateFloorMap();
showFloorArrivalScene();
updateUI();
updateInventoryUI();
updateSpellbookUI();
updateCompanionUI();

// Indice de sauvegardes existantes sur l'écran de départ (voir listSavedCrawlerNames())
refreshStartSavesHint();

// Version affichée sur l'écran de départ (voir APP_VERSION)
if (ui.versionLabel) {
    ui.versionLabel.innerText = `PR #${APP_VERSION.pr} — ${APP_VERSION.label}`;
}

