// Shared mutable game state, plus the one helper nearly every other module
// needs. Other modules import `state` and read/write its properties
// directly (e.g. `state.hearts--`) rather than each holding their own copy.

import { GRID_SIZES, CHAMBER_TARGETS, MAX_HEARTS, TYPING_SAMPLE_DATA } from './config.js';

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
  mcMode: false,
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
  turnsSinceSpawn: 0,
  currentQuestion: null, // { term, meaning } — reshuffles after every attempt
  selectedTarget: null,  // boss, or one of the minions
  coin: null,            // { row, col } or null once collected
  chest: null,           // { row, col, el, kind: 'chest' } or null once opened/trapped
  rune: null,            // { row, col, el, kind: 'rune' } or null once read/trapped
  encounters: [],        // [{ row, col, el, kind: 'encounter', category, pool }], per-room, up to 3

  usingSample: true, // false once the person loads their own list
  activeData: TYPING_SAMPLE_DATA, // whichever list is currently in play
};
