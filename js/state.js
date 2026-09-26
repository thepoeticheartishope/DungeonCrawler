// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.hearts--`) rather than each holding their own copy.

import { GRID_SIZES, CHAMBER_TARGETS, MAX_HEARTS, MC_SAMPLE_DATA } from './config.js';

// Turns a (row, col) pair into the string key used everywhere tiles are
// stored in a Set or looked up by position.
export function key(r, c) {
  return r + ',' + c;
}

const initialGridSize = GRID_SIZES[0];

export const state = {
  GRID_SIZE: initialGridSize,
  CHAMBER_TARGET: CHAMBER_TARGETS[0],
  PLAYER_START: { row: initialGridSize - 1, col: Math.floor(initialGridSize / 2) },

  order: [],
  roomIndex: 0,
  attempts: 0,
  extraSpaceCount: 0,
  seconds: 0,
  timerHandle: null,
  hearts: MAX_HEARTS,
  turnCount: 0,
  coinsTotal: 0,
  revealOnWrong: false,
  mcMode: true, // always on for now; see startGame in main.js
  currentChoices: [],

  playerRow: undefined,
  playerCol: undefined,
  facing: 'N', // 'N'|'S'|'E'|'W' — which way the player is looking; gates the fog-of-war cone
  camRow: 0, // world-space row/col of the viewport's top-left corner
  camCol: 0,
  wallSet: new Set(),
  tileEls: [],
  turnLocked: false,

  visibleSet: new Set(),  // tiles lit right now, from the player's spot
  exploredSet: new Set(), // every tile ever seen this room (fog memory)
  fogEnabled: true,       // dev toggle can flip this off to verify layouts

  boss: null,         // { row, col, hp }
  minions: [],        // [{ row, col, hp, el }]
  // Boss light (see light.js). Reset as each room loads.
  bossDist: new Map(),   // walkable steps from the boss, per floor tile key
  floorCount: 0,         // walkable tiles in the room
  lightFullRadius: 0,    // light radius at which this floor's LIGHT_LOSS_COVERAGE is reached
  lightTurnBudget: 1,    // turns until that radius
  lightTurns: 0,         // turns spent in this room
  runEnded: false,       // the light consumed the floor; no more moves this run
  darkness: false,       // the boss has fallen on this floor (see DARK_* in config.js)
  wager: 0,              // gold staked on the current question (Gambler modifier), 0 if none
  bossLitSet: new Set(), // tiles the boss light currently reaches
  currentQuestion: null, // { term, meaning } — reshuffles after every attempt
  selectedTarget: null,  // boss, or one of the minions
  battleTarget: null,    // whichever target the battle screen last set up a turn for
  battlePhase: 'answering', // 'choosing' (pick a category) | 'answering' (question showing) | 'ended' (settled, awaiting continue)
  categoryChoices: [],   // [{ label, pool }] offered while battlePhase is 'choosing'
  lastChoiceType: null,  // choice type the player last picked in a fight (NO_REPEAT_CHOICE_TYPES)
  runeHint: null,        // question a rune just hinted at — always offered as a choice until asked
  coin: null,            // { row, col } or null once collected
  stairs: null,          // { row, col } — sits inside the boss chamber, past the boss
  chest: null,           // { row, col, el, kind: 'chest' } or null once opened/trapped
  rune: null,            // { row, col, el, kind: 'rune' } or null once read/trapped
  encounters: [],        // [{ row, col, el, kind: 'encounter', category, pool }], per-room, up to 3
  // Furniture and themes (decor.js). Reset as each floor loads.
  pillarSet: new Set(),     // pillar tiles: solid, and they block the player's light
  props: [],                // papers and boxes: [{ row, col, kind, theme, loot, gold, trapped, el, identified, searched, sprung }]
  chamberAt: new Map(),     // tile key -> which room on the floor it belongs to
  chamberThemes: [],        // theme per room
  visitedChambers: new Set(), // rooms the player has walked into (their theme line shows once)

  usingSample: true, // false once the person loads their own list
  activeData: MC_SAMPLE_DATA, // whichever list is currently in play
};
