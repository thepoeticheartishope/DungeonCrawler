// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.run.hearts--`) rather than each holding their own copy.
//
// Grouped by how long a value lives:
//   settings — picked on the start screen (or the DEV panel); outlive every run
//   run      — one run, from startGame() to the end screen
//   floor    — the ship's floor, rebuilt by buildShipFloor() in floor.js
//   battle   — the fight on the battle screen right now

import { MAX_HEARTS, MC_SAMPLE_DATA, ENERGY_START, ONE_STICK, BOOK } from './config.js';

// Turns a (row, col) pair into the string key used everywhere tiles are
// stored in a Set or looked up by position.
export function key(r, c) {
  return r + ',' + c;
}

// The other way: a tile key back into `{ row, col }`.
export function parseKey(k) {
  const [row, col] = k.split(',').map(Number);
  return { row, col };
}

// The floor's size before the ship is built: a placeholder, since
// buildShipFloor() (floor.js) sets the real size before anything is drawn.
const initialGridSize = 37;

export const state = {
  settings: {
    revealOnWrong: false,
    soundStep: 1,           // the top bar's SOUND button: index into config.js SOUND_VOLUME.steps (0 = off); remembered (sound.js)
    playerName: '',         // the name typed on the start screen ('' = none); kept across runs and remembered
    mcMode: true, // always on for now; see startGame in main.js
    fogEnabled: true,       // dev toggle can flip this off to verify layouts
    bookPaper: BOOK.paper,  // the record book's page (bookview.js): one of BOOK.papers; DEV -> Book paper cycles it
    oneStick: ONE_STICK.on, // walk freely in real time with one stick (walk.js), not tile to tile; turns Real time on; DEV -> One stick flips it
    minigame: 'roll',       // DEV -> Minigame: 'roll' (minigames roll as usual), 'off' (never), or a minigame id (always, when it fits)
    usingSample: true, // the workshop list is the built-in sample (it can't be saved as a set); false once a list is pasted or loaded there
    activeData: MC_SAMPLE_DATA, // whichever list is currently in play
    activeDictionary: null, // the active set's subject dictionary (lists/dictionaries/), or null (pasted, saved and sample sets)
    workshopData: null,     // the list last loaded in the workshop (pasted, file or the sample), offered on the set screen; null until then
  },

  run: {
    order: [],
    roomIndex: 0,          // which danger depth (picks the recipe); a rest floor won't change it
    resting: false,        // on a rest floor (opening, between depths, or the epilogue); run.js nextFloor() flips it
    floorsEntered: 0,      // goes up each time a floor is built; never reset, so a retry is a new floor too (the room camera snaps on it)
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
    chargerTold: false,    // the kind voice has said the charger's line this run (charger.js chargerLine)
    shutterTold: false,    // the kind voice has said the safe room's line this run (saferoom.js shutterLine)
    trained: [],           // the ship's crew roles the player has learned at the training console this run (stations.js), e.g. ['engineer']
    crewFailures: 0,       // wrong answers while teaching the crew this run (stations.js settleBreaker); crew panic feeds on these (ship plan step C)
    ship: null,            // the ship's run (ship.js freshShipRun): { panic, streak, tragedy: { day, captain, cause, ship, planet }, and what the crew roles gave (roles.js): calmStreak, slipFactor, shields, taught: [roles], job: { role, round, right } | null, learning: { role, round } | null, onDuty: [roles] | null (roles.js noteOnDuty) }; null off the ship
    reloadIndex: 0,        // reloads settled this run; picks the next category in the reload rotation (gun.js)
    lastMinigame: null,    // the minigame the last question ran as, or null if it was a plain question (minigames.js: never the same twice in a row)
    turnLocked: false,
    runEnded: false,       // the light consumed the floor; no more moves this run
  },

  floor: {
    GRID_SIZE: initialGridSize,
    CHAMBER_TARGET: 1,
    PLAYER_START: { row: initialGridSize - 1, col: Math.floor(initialGridSize / 2) },

    playerRow: undefined,
    playerCol: undefined,
    lookWant: null, // one stick (look.js swingLook): the angle the light and body are swinging round to, or null
    sneaking: false, // one stick: X switched sneaking on (creep pace, walk.js); a small push on the stick creeps too (creeping)
    creeping: false, // one stick: this frame's walk was at the creep pace (sneaking, or a small push)
    playerAt: null, // one stick (walk.js): the player's free spot in tiles, { x, y } (tile centre = col + 0.5); null = the centre of playerRow / playerCol
    facing: 'N', // 'N'|'S'|'E'|'W' — which way the player's body faces (bumps, slides, the stick man's legs)
    look: null,  // where the player aims, in radians on the grid (0 = north, +π/2 = east), or null = straight ahead; the light points here, held inside the body's free arc (look.js lookAngle)
    wallSet: new Set(),

    visibleSet: new Set(),  // tiles lit right now, from the player's spot
    exploredSet: new Set(), // every tile ever seen this room (fog memory)

    boss: null,         // { row, col, hp, max }: hp = right answers the gate still asks, max = how many it asked (gate.js)
    minions: [],        // [{ row, col, hp, kind }]
    crawling: [],       // stick men in a duct (vents.js): out of play, `m.vent` { from, to, left }, back in `minions` once they drop out
    hunter: null,          // the hunter, once awake — also in state.floor.minions, with kind 'hunter'
    gunTarget: null,       // the minion (or hunter) the gun is aimed at, picked by a tap on the map (gun.js pickTarget), or null
    goals: [],             // this floor's side goals: [{ id, pay }] from FLOOR_GOALS (goals.js rollGoals); none on a rest floor
    safeRoom: null,        // Command's shutters (saferoom.js): { chamber, cells: Set of its tile keys, doors: [keys], shut, playerIn }; null before the ship is built
    path: null,            // the way down the player took to this depth (floors.js FLOOR_PATHS), or null
    stairsAlt: null,       // a between-rest's second stairs: { row, col, path, hidden } (hidden until scouted); null elsewhere
    misses: 0,             // wrong answers on this floor, questions and reloads (the noMiss goal)
    struggles: 0,          // Struggles started on this floor; each one makes the next dial harder (gun.js struggleDial)
    windows: [],           // windows on back walls that face the outside (windows.js): [{ row, col, room }]
    spaceSeed: 0,          // the ship's space picture seen through its windows (windows.js placeShipWindows, space.js)
    advanced: null,        // the advanced tutorial's station on this floor (advanced.js freshStation): { index, name, door, route, minion, told, done, open }; null on every other floor
    testRoom: null,        // the DEV test room this floor is (testroom.js TEST_ROOMS key, floor.js buildTestFloor); null on every other floor
    ship: false,           // the "There's Been a Tragedy" ship (floor.js buildShipFloor, plans.js ship): lit everywhere, nothing dangerous; false on every other floor
    tutorial: null,        // the tutorial room's progress (tutorial.js freshTutorial): { stage, turns, door, spot, roomTiles, minion, minionAt }; null on every other floor
    lastChoiceType: null,  // choice type the player last picked in a fight (NO_REPEAT_CHOICE_TYPES)
    coin: null,            // { row, col } or null once collected
    plan: null,            // the fixed plan this floor is built from (plans.js): { name (text.js key), version: 'A' | 'B' }, or null for a random floor or a rest
    vents: [],             // the floor's grates: [{ row, col, pair, known }], `pair` the index of the other end, `known` once the player has seen something come out (vents.js)
    keys: [],              // the floor's keys still lying where dungeon.js put them: [{ row, col }] (CORE_KEYS on a depth, none on a rest)
    keysHeld: 0,           // keys the player has taken on this floor
    gateSealed: false,     // a wrong answer at the gate (the boss) since the last key: it won't fight until another key is taken (gate.js)
    hidden: null,          // the player hidden in a room spot (spots.js hideIn): { row, col, from } (from: the tile they went in from), or null
    roomSpots: [],         // the plan's room spots this floor (spots.js rollSpots): [{ row, col, kind, used }], kind one of SPOT_KINDS or null (nothing this run). Empty on a random floor or a rest
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
    doorSet: new Set(),       // doorway tiles: each room's open doors and inner doors (the shoulder view drew an arch over each)
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
    aim: null,             // a gun shot that landed and waits on its dial (kill or maim plan): { target, zones: [{ tier, harm?, from, to }], lapMs, lapLimit, traits, darkArc, matched, prefer, phase: 'ready' | 'run' } (gun.js fire / dialZones; matched: the round it spends is from the group the target is weak to, prefer: that group; the round goes at READY, readyShot)
    struggle: null,        // a minion (or the hunter) that reached the player with no energy, waiting on the Struggle dial: { minion, zone: { from, to }, lapMs, count, phase: 'ready' | 'run' } (gun.js struggleDial)
  },
};
