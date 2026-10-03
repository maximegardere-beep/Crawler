# Notes — Chantier « Sons »

Chantier 8 du registre (`CHANTIERS.md`). Demande : intégrer des effets audio, par la méthode la plus simple.

## Méthodes proposées (03/10/2026)
1. **Sons synthétisés ZzFX/jsfxr** : aucun fichier, une liste de paramètres par son — **retenue**.
2. Fichiers dans `assets/sfx/` + `new Audio()` : simple, mais latence et chevauchements sur mobile.
3. Fichiers + Web Audio API (préchargés) : sans latence, plus de code.
4. Howler.js (cdnjs) + sprite audio : le plus robuste pour la musique, dépendance externe.
5. Bonus : voix du présentateur par `speechSynthesis` — **retenue**.

## Décisions de l'utilisateur
- ZzFX : tranche la question d'hébergement (aucun fichier audio, aucun CDN, hors ligne).
- Périmètre : bruitages de combat, bruitages d'interface / événements, voix DeathWatch partout (piques et
  réactions, succès, écrans de rencontre). Ambiance / musique : non retenue (exigerait des fichiers).
- Combat détaillé : un son par famille d'arme, par projectile, par école de sort, un cri par archétype de mob.
- Son **activé par défaut** ; un bouton 🔊/🔇 (tout couper) et, demandé à la validation du plan, un bouton 🎙️
  (couper la voix du présentateur seule), tous deux dans l'en-tête.
- Page d'écoute de tous les sons. Claude compose tout le catalogue (sans écoute), l'utilisateur ajuste.
- Échantillon de 5 sons validé avant le code (coup d'épée, tir d'arbalète, cri de gobelin, pièces d'or, niveau).

## Livraison (`sounds.js`, chargé après `minigames-ui.js`, avant `app.js`)
- **Socle (lot 0)** : catalogue PUR `SFX_CATALOG` (`{ group, label, use, params }`, groupes `SFX_GROUPS`),
  génération pure `zzfxGenerate()` (ZzFX Micro, MIT, Frank Force), point d'entrée unique `playSfx(key, { force })`
  (no-op sans `AudioContext` : tests Node), `unlockAudio()` au premier `pointerdown`/`keydown`. Préférences
  d'écoute hors `gameState` (`localStorage` `crawler_sound_muted` / `crawler_voice_muted`) : `isSoundMuted()`,
  `isVoiceMuted()`, `announcerVoiceEnabled()`. Boutons `#btn-sound-toggle` / `#btn-voice-toggle`
  (`updateSoundToggleButtons()`, app.js, section « SONS »), page d'écoute `#sound-lab-overlay` (⚙️ Réglages →
  🎧 Écouter les sons, `openSoundLab()`, joue même son coupé).
- **Combat (lot 1)** : 36 sons — 3 styles de mêlée + mains nues, 10 projectiles, 8 écoles de sort + sort raté,
  10 cris d'archétype, coup lourd, crawler touché, mob et boss vaincus. Correspondances `SFX_MELEE_STYLES`,
  `SFX_PROJECTILES`, `SFX_SPELL_STYLES`, `SFX_MOB_CRIES`, `playerAttackSfxKey(spec)` / `mobAttackSfxKey(enemy)`.
  Joués au départ du coup par `playPlayerAttackFx()` / `playMobAttackFx()` (fx.js, même sous mouvement réduit ;
  cri jamais répété dans un multi-coups ; « touché » seulement si des PV sont réellement perdus),
  `playSpellBackfireFx()`, `playClassAbilityFx()`, `triggerHeavyImpact()`, `winCombat()`.
- **Événements (lot 2)** : 18 sons (groupes `event` et `world`) — PO, objet obtenu, achat / formation, potion,
  niveau (un seul arpège pour plusieurs niveaux), compétence, succès, issues de mini-jeu (`SFX_MINIGAME_OUTCOMES`,
  jamais en jet automatique), piège, fuite, repos, écran de rencontre (accord grave pour boss et chasseurs),
  escalier, Game Over, victoire. **File d'attente** : ces sons s'enchaînent (`sfxQueuedStart()`, au plus
  `SFX_QUEUE_MAX_GAP` = 0,35 s d'écart) au lieu de se superposer ; les sons de combat partent tout de suite.
- **Voix (lot 3)** : `speakAnnouncer(text, { interrupt })` — `speechSynthesis`, voix française de l'appareil
  (`pickAnnouncerVoice()` : fr-FR, sinon toute voix française), texte nettoyé (`cleanAnnouncerText()` : sans
  emoji, balise ni crochet, « PO » en toutes lettres), réglages `ANNOUNCER_VOICE` (débit 1,08, hauteur 0,9).
  File : jamais deux répliques à la fois, 3 en attente au plus (les plus anciennes sautent), filet de sécurité
  si `end` ne vient jamais ; `interrupt` coupe la réplique en cours. Lit la pique DeathWatch (`triggerShow()`,
  interrompt), la réaction de Chip (`answerShow()`), l'annonce de succès (`showAchievementToast()`) et titre +
  réplique de l'écran de rencontre (`showEncounterIntro()`, interrompt). Coupée par 🎙️ ou 🔊.

## Tests (`tests/regression/sounds.js`)
Catalogue (durée ≤ 1,5 s, pic audible sans saturer, aucun échantillon invalide), couverture (chaque style de
mêlée, projectile, école de sort et archétype a son son), lecture et coupure avec un faux `AudioContext`, file
d'attente, boutons, page d'écoute, branchements (playSfx espionné), voix avec une fausse synthèse vocale (file,
interruption, coupure, émission, succès, rencontre).

## À surveiller en playtest
- **Écoute réelle** : tous les paramètres ont été composés sans écoute (seules durée et intensité vérifiées) —
  à ajuster via la page d'écoute (page en ligne ou ⚙️ Réglages).
- Volume relatif combat / événements, fatigue d'écoute (cris à chaque riposte, son de coup à chaque attaque).
- Voix : qualité très variable selon le téléphone ; débit et hauteur (`ANNOUNCER_VOICE`) ; fréquence des
  annonces (chaque écran de rencontre parle — un réglage plus fin pourrait suivre).
- iOS : déblocage du son au premier geste à confirmer sur appareil réel.
