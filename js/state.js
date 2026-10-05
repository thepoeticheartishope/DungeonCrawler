// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.run.hearts--`) rather than each holding their own copy.
//
// Grouped by how long a value lives:
//   settings — picked on the start screen (or the DEV panel); outlive every run
//   run      — one run, from startGame() to the end screen
//   floor    — one floor, rebuilt by buildFloor() in floor.js
//   battle   — the fight on the battle screen right now

import { MAX_HEARTS, MC_SAMPLE_DATA, GUN_START_ROUNDS } from './config.js';
import { FLOOR_RECIPES } from './floors.js';

// Turns a (row, col) pair into the string key used everywhere tiles are
// stored in a Set or looked up by position.
export function key(r, c) {
  return r + ',' + c;
}

const initialGridSize = FLOOR_RECIPES[0].grid;

export const state = {
  settings: {
    revealOnWrong: false,
    realTime: false,        // start screen option: the world moves on a clock (realclock.js), not after each action; remembered
    playerName: '',         // the name typed on the start screen ('' = none); kept across runs and remembered
    mcMode: true, // always on for now; see startGame in main.js
    fogEnabled: true,       // dev toggle can flip this off to verify layouts
    isoCameraGlide: true,   // dev toggle: the isometric camera glides after the player (false: locked to them)
    gunCombat: true,        // the gun on the map (gun plan; the default since step 9). DEV -> Combat switches back to classic (minions on the battle screen)
    usingSample: true, // the workshop list is the built-in sample (it can't be saved as a set); false once a list is pasted or loaded there
    activeData: MC_SAMPLE_DATA, // whichever list is currently in play
    activeDictionary: null, // the active set's subject dictionary (lists/dictionaries/), or null (pasted, saved and sample sets)
    workshopData: null,     // the list last loaded in the workshop (pasted, file or the sample), offered on the set screen; null until then
  },

  run: {
    order: [],
    roomIndex: 0,          // which danger depth (picks the recipe); a rest floor won't change it
    resting: false,        // on a rest floor (opening, between depths, or the epilogue); run.js nextFloor() flips it
    floorsEntered: 0,      // goes up each time a floor is built; never reset, so a retry is a new floor too (isoview's camera snaps on it)
    attempts: 0,
    correctTotal: 0,       // right answers this run (the papers' {answered})
    haunts: new Map(), // missed question -> attempt it was last missed on (js/haunts.js)
    hauntsTotal: 0,
    hauntsSilenced: 0,
    loreQueue: [], // story lines (text.js keys) still to be read, in order; each floor adds its recipe's lore (floors.js)
    extraSpaceCount: 0,
    seconds: 0,
    hearts: MAX_HEARTS,
    maxHearts: MAX_HEARTS, // max stability; THE UNFOLDING can raise it (js/exchange.js)
    bonusSlack: 0,         // turns bought at THE UNFOLDING for the next depth's light budget (light.js initBossLight spends it)
    turnCount: 0,
    coinsTotal: 0,
    ammo: GUN_START_ROUNDS, // rounds in the gun's chamber (js/gun.js); carried from floor to floor
    reloadIndex: 0,        // reloads settled this run; picks the next category in the reload rotation (gun.js)
    turnLocked: false,
    runEnded: false,       // the light consumed the floor; no more moves this run
  },

  floor: {
    GRID_SIZE: initialGridSize,
    CHAMBER_TARGET: FLOOR_RECIPES[0].rooms,
    PLAYER_START: { row: initialGridSize - 1, col: Math.floor(initialGridSize / 2) },

    playerRow: undefined,
    playerCol: undefined,
    facing: 'N', // 'N'|'S'|'E'|'W' — which way the player is looking; gates the fog-of-war cone
    wallSet: new Set(),

    visibleSet: new Set(),  // tiles lit right now, from the player's spot
    sightSet: new Set(),    // just the player's own light (not the boss's) — what they can make out
    exploredSet: new Set(), // every tile ever seen this room (fog memory)

    boss: null,         // { row, col, hp }
    minions: [],        // [{ row, col, hp, kind }]
    // Boss light (see light.js). Reset as each room loads.
    bossDist: new Map(),   // walkable steps from the boss, per floor tile key
    floorCount: 0,         // walkable tiles in the room
    lightFullRadius: 0,    // light radius at which the run is lost
    lightTurnBudget: 1,    // turns until that radius: the walk to the boss plus the slack
    lightSlack: 0,         // turns the budget gives beyond the walk to the boss (floors.js slack)
    lightLossShare: 0,     // share of the walkable tiles the light covers when the budget runs out
    lightTurns: 0,         // turns spent in this room
    darkness: false,       // the boss has fallen on this floor (see DARK_* in config.js)
    darkTurns: 0,          // turns since the boss fell (the hunter wakes at HUNTER_SPAWN_DELAY)
    hunter: null,          // the hunter, once awake — also in state.floor.minions, with kind 'hunter'
    gunTarget: null,       // the minion (or hunter) the gun is aimed at, picked by a tap on the map (gun.js pickTarget), or null
    bossLitSet: new Set(), // tiles the boss light currently reaches
    lastChoiceType: null,  // choice type the player last picked in a fight (NO_REPEAT_CHOICE_TYPES)
    runeHint: null,        // question a rune just hinted at — always offered as a choice until asked
    coin: null,            // { row, col } or null once collected
    beats: [],             // [{ kind, row, col, at }] the recipe's beats and where they landed, `at` = step of the walk to the boss (beats.js)
    stairs: null,          // { row, col } — sits inside the boss chamber, past the boss
    chest: null,           // { row, col, el, kind: 'chest' } or null once opened/trapped
    rune: null,            // { row, col, el, kind: 'rune' } or null once read/trapped
    exchange: null,        // THE UNFOLDING on a rest floor: { row, col, kind: 'exchange' }, or null on a depth
    exchangeBought: new Set(), // once-per-rest items (exchange.js) already bought on this floor
    encounters: [],        // [{ row, col, kind: 'encounter', category, pool }], per-room, up to 3
    // Furniture and themes (decor.js). Reset as each floor loads.
    pillarSet: new Set(),     // pillar tiles: solid, and they block the player's light
    props: [],                // papers and boxes: [{ row, col, kind, theme, loot, gold, trapped, identified, searched, sprung }]
    chamberAt: new Map(),     // tile key -> which room on the floor it belongs to
    doorSet: new Set(),       // doorway tiles: each room's open doors and inner doors (isoview.js draws an arch over each)
    chamberThemes: [],        // theme per room
    visitedChambers: new Set(), // rooms the player has walked into (their theme line shows once)
  },

  battle: {
    currentChoices: [],
    wager: 0,              // gold staked on the current question (Gambler modifier), 0 if none
    currentQuestion: null, // { term, meaning } — reshuffles after every attempt
    selectedTarget: null,  // boss, or one of the minions
    battleTarget: null,    // whichever target the battle screen last set up a turn for
    battlePhase: 'answering', // 'choosing' (pick a category) | 'answering' (question showing) | 'ended' (settled, awaiting continue)
    categoryChoices: [],   // [{ label, pool }] offered while battlePhase is 'choosing'
    aim: null,             // a gun shot that landed and waits for the damage bar: { target, hitHalf, weakWidth } (gun.js)
  },
};
