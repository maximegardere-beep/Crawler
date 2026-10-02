// load_game.js — charge bestiary/items/districts/safehouses/generator/app dans le contexte global
// courant (via vm), dans l'ordre requis par leurs dépendances. Utilisé par tous les fichiers de
// /tests : centralise la liste des fichiers sources pour ne pas la dupliquer partout.
// Attention : app.js exécute generateFloorMap()+updateUI() à son chargement (comportement normal
// du jeu) — chaque test qui a besoin d'un état précis doit réinitialiser gameState après l'appel.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_FILES = ['bestiary.js', 'items.js', 'spells.js', 'districts.js', 'safehouses.js', 'generator.js', 'anomalies.js', 'achievements.js', 'origins.js', 'deathwatch.js', 'floorgen.js', 'floormap.js', 'minigames.js', 'sprites/crawler.js', 'sprites/crawler-races.js', 'sprites/race-ghoul.js', 'sprites/race-goblin.js', 'sprites/race-troll.js', 'sprites/race-elf.js', 'sprites/race-dwarf.js', 'sprites/race-roach.js', 'sprites/npcs.js', 'sprites/mobs.js', 'sprites/mob-details-a.js', 'sprites/mob-details-b.js', 'sprites/mob-auras.js', 'sprites/bosses-a.js', 'sprites/bosses-b.js', 'sprites/items-generic.js', 'sprites/items-melee.js', 'sprites/items-ranged.js', 'sprites/items-armor.js', 'sprites/items-signature.js', 'sprites/fx.js', 'backdrops.js', 'scene.js', 'fx.js', 'minigames-ui.js', 'engine/state.js', 'engine/config.js', 'engine/dom.js', 'engine/saves.js', 'engine/ui.js', 'engine/inventory.js', 'engine/events.js', 'engine/companions.js', 'engine/chronicle.js', 'engine/show.js', 'engine/origins-choice.js', 'engine/progression.js', 'engine/floors.js', 'engine/shops.js', 'engine/floor-map-ui.js', 'engine/combat.js', 'engine/combat-rhythm.js', 'engine/combat-boss.js', 'engine/origins-effects.js', 'engine/occasions.js', 'engine/gameplay.js', 'app.js'];
const REPO_ROOT = path.join(__dirname, '..');

function loadGame() {
    // Un script par fichier, dans l'ordre : comme les <script> d'index.html (const/let partagés, mais les
    // fonctions d'un fichier ne sont pas hissées dans les fichiers précédents). Les traces d'erreur
    // nomment ainsi le vrai fichier source.
    GAME_FILES.forEach(f => {
        vm.runInThisContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), { filename: path.join(REPO_ROOT, f) });
    });
}

module.exports = { loadGame, GAME_FILES, REPO_ROOT };
