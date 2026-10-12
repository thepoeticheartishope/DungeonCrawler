// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.run.hearts--`) rather than each holding their own copy.
//
// Grouped by how long a value lives:
//   settings — picked on the start screen (or the DEV panel); outlive every run
//   run      — one run, from startGame() to the end screen
//   floor    — one floor, rebuilt by buildFloor() in floor.js
//   battle   — the fight on the battle screen right now

import { MAX_HEARTS, MC_SAMPLE_DATA, ENERGY_START, TURN_BEFORE_STEP } from './config.js';
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
    enemyTendrils: 'random', // DEV -> Tendrils: each stick enemy's own random tendril style, or one of stickforms.js TENDRIL_STYLES for all
    enemyPose: 'random',    // DEV -> Look: each stick enemy's own random pose, or one stickforms.js STICK_POSES id for all
    simpleEnemies: false,   // start screen option (comfort): every minion on the map is a still 'e' (tell 'E'), no form, no motion; remembered
    playerName: '',         // the name typed on the start screen ('' = none); kept across runs and remembered
    mcMode: true, // always on for now; see startGame in main.js
    fogEnabled: true,       // dev toggle can flip this off to verify layouts
    isoCameraGlide: true,   // dev toggle: the isometric camera glides after the player (false: locked to them)
    turnBeforeStep: TURN_BEFORE_STEP, // a press in a new direction only turns (true) or turns and steps (false); DEV -> Turn flips it
    minigame: 'roll',       // DEV -> Minigame: 'roll' (minigames roll as usual), 'off' (never), or a minigame id (always, when it fits)
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
    rounds: [],            // the group label each held round of energy was loaded from (gun.js), oldest first; null for a plain round (the start's, a DEV fill). Kept to state.run.energy's length by gun.js
    weakTo: {},            // minion kind -> the reload group label it's weak to, rolled per run (gun.js rollWeaknesses); empty for a set with no groups
    weakKnown: new Set(),  // minion kinds whose weakness the player has found (a shot landed on one)
    nextPath: null,        // the way down chosen at a between-rest's stairs (floors.js FLOOR_PATHS), for the next depth; buildFloor takes it
    bonusSlack: 0,         // turns bought at THE UNFOLDING for the next depth's light budget (light.js initBossLight spends it)
    turnCount: 0,
    coinsTotal: 0,
    energy: ENERGY_START, // energy held (0 to ENERGY_MAX, js/gun.js): the gun spends 1 a shot; carried from floor to floor
    reloadIndex: 0,        // reloads settled this run; picks the next category in the reload rotation (gun.js)
    lastMinigame: null,    // the minigame the last question ran as, or null if it was a plain question (minigames.js: never the same twice in a row)
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

    boss: null,         // { row, col, hp, max }: hp = right answers the gate still asks, max = how many it asked (gate.js)
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
    goals: [],             // this floor's side goals: [{ id, pay }] from FLOOR_GOALS (goals.js rollGoals); none on a rest floor
    heldChambers: new Set(), // rooms held by a relay (relays.js): no boss light, no minion from outside
    relayTurnsWon: 0,      // light turns relays have taken back on this floor (capped at RELAY_TURNS_CAP)
    path: null,            // the way down the player took to this depth (floors.js FLOOR_PATHS), or null
    stairsAlt: null,       // a between-rest's second stairs: { row, col, path, hidden } (hidden until scouted); null elsewhere
    misses: 0,             // wrong answers on this floor, questions and reloads (the noMiss goal)
    struggles: 0,          // Struggles started on this floor; each one makes the next dial harder (gun.js struggleDial)
    bossLitSet: new Set(), // tiles the boss light currently reaches
    lastChoiceType: null,  // choice type the player last picked in a fight (NO_REPEAT_CHOICE_TYPES)
    coin: null,            // { row, col } or null once collected
    plan: null,            // the fixed plan this floor is built from (plans.js): { name (text.js key), version: 'A' | 'B' }, or null for a random floor or a rest
    keys: [],              // the floor's keys still lying where dungeon.js put them: [{ row, col }] (CORE_KEYS on a depth, none on a rest)
    keysHeld: 0,           // keys the player has taken on this floor
    gateSealed: false,     // a wrong answer at the gate (the boss) since the last key: it won't fight until another key is taken (gate.js)
    keySpots: [],          // on a fixed plan (plans.js), every spot a key could be in: [{ row, col }]; the light's walk sweeps them all. Empty on a random floor or a rest
    keyRoute: 0,           // steps of the shortest walk from the start through every key (every key spot on a fixed plan) to the boss (light.js); the light's budget is this plus slack
    beats: [],             // [{ kind, row, col, at }] the recipe's beats and where they landed, `at` = step of the walk out to the farthest key (beats.js)
    stairs: null,          // { row, col } — sits inside the boss chamber, past the boss
    chest: null,           // { row, col, el, kind: 'chest' } or null once opened/trapped
    exchange: null,        // THE UNFOLDING on a rest floor: { row, col, kind: 'exchange' }, or null on a depth
    exchangeBought: new Set(), // once-per-rest items (exchange.js) already bought on this floor
    // Furniture and themes (decor.js). Reset as each floor loads.
    pillarSet: new Set(),     // pillar tiles: solid, and they block the player's light
    props: [],                // papers and boxes: [{ row, col, kind, theme, loot, gold, trapped, identified, searched, sprung }]
    chamberAt: new Map(),     // tile key -> which room on the floor it belongs to
    doorSet: new Set(),       // doorway tiles: each room's open doors and inner doors (isoview.js draws an arch over each)
    chamberThemes: [],        // theme per room
    chamberNames: [],         // text.js key of each room's name on a fixed plan (plans.js), same order as chamberAt's rooms; empty on a random floor or a rest
    visitedChambers: new Set(), // rooms the player has walked into (their theme line shows once)
  },

  battle: {
    currentChoices: [],
    minigame: null,        // the minigame the current question runs as (minigames.js rollMinigame), or null for a plain question
    wager: 0,              // gold staked on the current question (Gambler modifier), 0 if none
    currentQuestion: null, // { term, meaning } — reshuffles after every attempt
    selectedTarget: null,  // boss, or one of the minions
    battleTarget: null,    // whichever target the battle screen last set up a turn for
    battlePhase: 'answering', // 'choosing' (pick a category) | 'answering' (question showing) | 'ended' (settled, awaiting continue)
    categoryChoices: [],   // [{ label, pool }] offered while battlePhase is 'choosing'
    aim: null,             // a gun shot that landed and waits for the damage bar: { target, zones: [{ tier, from, to }], matched } (gun.js damageZones; matched: the round was from the group the target is weak to)
    struggle: null,        // a minion (or the hunter) that reached the player with no energy, waiting on the Struggle dial: { minion, hitHalf, sweepMs, count } (gun.js struggleDial)
  },
};
