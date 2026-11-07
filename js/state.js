// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.run.hearts--`) rather than each holding their own copy.
//
// Grouped by how long a value lives:
//   settings — picked on the start screen (or the DEV panel); outlive every run
//   run      — one run, from startGame() to the end screen
//   floor    — the ship's floor, rebuilt by buildShipFloor() in floor.js
//   battle   — the fight on the battle screen right now

import { MAX_HEARTS, MC_SAMPLE_DATA, BOOK } from './config.js';

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
    factQuestions: true,    // DEV -> Fact Qs: false leaves out the questions a set's facts make (factgen.js), from the next set picked
    minigame: 'roll',       // DEV -> Minigame: 'roll' (minigames roll as usual), 'off' (never), or a minigame id (always, when it fits)
    usingSample: true, // the workshop list is the built-in sample (it can't be saved as a set); false once a list is pasted or loaded there
    activeData: MC_SAMPLE_DATA, // whichever list is currently in play
    activeDictionary: null, // the active set's word bank (sets.js wordBank: its facts file's entities), or null
    activeFacts: [],        // the active set's facts ({ fact, value, source? }, lists/facts/), or [] (none; pasted, saved and sample sets for now)
    workshopFacts: null,    // the workshop list's facts parts { entities, facts, templates } (a teacher's file, factcheck.js), or null
    workshopData: null,     // the list last loaded in the workshop (pasted, file or the sample), offered on the set screen; null until then
  },

  run: {
    roomIndex: 0,          // which danger depth (picks the recipe); a rest floor won't change it
    floorsEntered: 0,      // goes up each time a floor is built; never reset, so a retry is a new floor too (the room camera snaps on it)
    correctTotal: 0,       // right answers this run (the papers' {answered})
    seconds: 0,
    hearts: MAX_HEARTS,
    maxHearts: MAX_HEARTS, // max stability; THE UNFOLDING can raise it (js/exchange.js)
    turnCount: 0,
    coinsTotal: 0,
    trained: [],           // the ship's crew roles the player has learned at the training console this run (stations.js), e.g. ['engineer']
    crewFailures: 0,       // wrong answers while teaching the crew this run (stations.js settleBreaker); crew panic feeds on these (ship plan step C)
    ship: null,            // the ship's run (ship.js freshShipRun): { panic, streak, tragedy: { day, captain, cause, ship, planet }, and what the crew roles gave (roles.js): calmStreak, slipFactor, shields, taught: [roles], job: { role, round, right } | null, learning: { role, round } | null, onDuty: [roles] | null (roles.js noteOnDuty) }; null off the ship
    lastMinigame: null,    // the minigame the last question ran as, or null if it was a plain question (minigames.js: never the same twice in a row)
    turnLocked: false,
    runEnded: false,       // the light consumed the floor; no more moves this run
  },

  floor: {
    GRID_SIZE: initialGridSize,
    PLAYER_START: { row: initialGridSize - 1, col: Math.floor(initialGridSize / 2) },

    playerRow: undefined,
    playerCol: undefined,
    lookWant: null, // look.js swingLook: the angle the light and body are swinging round to, or null
    sneaking: false, // one stick: X switched sneaking on (creep pace, walk.js); a small push on the stick creeps too (creeping)
    creeping: false, // one stick: this frame's walk was at the creep pace (sneaking, or a small push)
    playerAt: null, // one stick (walk.js): the player's free spot in tiles, { x, y } (tile centre = col + 0.5); null = the centre of playerRow / playerCol
    facing: 'N', // 'N'|'S'|'E'|'W' — which way the player's body faces (bumps, slides, the stick man's legs)
    look: null,  // where the player aims, in radians on the grid (0 = north, +π/2 = east), or null = straight ahead; the light points here (look.js lookAngle)
    wallSet: new Set(),

    visibleSet: new Set(),  // tiles lit right now, from the player's spot
    exploredSet: new Set(), // every tile ever seen this room (fog memory)

    safeRoom: null,        // Command's shutters (saferoom.js): { chamber, cells: Set of its tile keys, doors: [keys], shut, playerIn }; null before the ship is built
    windows: [],           // windows on back walls that face the outside (windows.js): [{ row, col, room }]
    spaceSeed: 0,          // the ship's space picture seen through its windows (windows.js placeShipWindows, space.js)
    ship: false,           // the "There's Been a Tragedy" ship (floor.js buildShipFloor, plans.js ship): lit everywhere, nothing dangerous; false on every other floor
    plan: null,            // the fixed plan this floor is built from (plans.js): { name (text.js key), version: 'A' | 'B' }, or null for a random floor or a rest
    // Furniture and themes (decor.js). Reset as each floor loads.
    pillarSet: new Set(),     // pillar tiles: solid, and they block the player's light
    props: [],                // papers and boxes: [{ row, col, kind, theme, loot, gold, trapped, identified, searched, sprung }]
    chamberAt: new Map(),     // tile key -> which room on the floor it belongs to
    chamberNames: [],         // text.js key of each room's name on a fixed plan (plans.js), same order as chamberAt's rooms; empty on a random floor or a rest
    visitedChambers: new Set(), // rooms the player has walked into (their theme line shows once)
  },

  battle: {
    currentChoices: [],
    minigame: null,        // the minigame the current question runs as (minigames.js rollMinigame), or null for a plain question
    wager: 0,              // gold staked on the current question (Gambler modifier), 0 if none
    currentQuestion: null, // { question, answer } — reshuffles after every attempt
    selectedTarget: null,  // what the question is asked against; always null on the ship (minigames.js verdictClaimCount still reads it)
  },
};
