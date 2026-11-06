// Shared setup for the rule unit tests: one empty floor, so every test
// file starts from the same clean state instead of its own drifted copy.
// Not a test file itself (node --test runs tests/*.test.mjs only).
//
// Each file still says which settings and run values it needs, through the
// overrides; what it doesn't name is reset to the plain empty floor below.

import { state, key } from '../js/state.js';
import { MAX_HEARTS } from '../js/config.js';
import { computeVisibility } from '../js/sight.js';

// An open size × size floor with nothing on it and the player in the middle
// facing north. `settings`, `run`, `floor`
// and `battle` are laid over the defaults; `see: false` leaves what the player
// sees uncomputed (rules.test.mjs checks computeVisibility itself).
export function emptyFloor(size = 21, { settings = {}, run = {}, floor = {}, battle = {}, see = true } = {}) {
  Object.assign(state.floor, {
    GRID_SIZE: size, playerRow: Math.floor(size / 2), playerCol: Math.floor(size / 2), playerAt: null,
    facing: 'N', look: null, lookWant: null, sneaking: false, creeping: false,
    wallSet: new Set(), pillarSet: new Set(), exploredSet: new Set(),
    visibleSet: new Set(), windows: [],
    chamberAt: new Map(), visitedChambers: new Set(), chamberNames: [],
    boss: null, hunter: null, minions: [], crawling: [], vents: [], keys: [], keysHeld: 0, gateSealed: false,
    chest: null, coin: null, stairs: null, stairsAlt: null, exchange: null, tutorial: null, props: [],
    gunTarget: null, struggles: 0, misses: 0,
  }, floor);
  Object.assign(state.settings, settings);
  Object.assign(state.run, {
    roomIndex: 0, resting: false, turnCount: 0, hearts: MAX_HEARTS, coinsTotal: 0, correctTotal: 0, loreQueue: [],
  }, run);
  Object.assign(state.battle, { selectedTarget: null, aim: null, struggle: null }, battle);
  if (see) computeVisibility();
}

// Two tall rooms on a 21 × 21 floor, joined by one hallway along row 10:
// room 0 is columns 1-6, room 1 columns 14-19, rows 1-19; everything else
// is wall. The player stands at the bottom of room 0.
export function twoRooms() {
  const f = state.floor;
  f.wallSet = new Set();
  f.chamberAt = new Map();
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) {
    const room = r >= 1 && r <= 19 && c >= 1 && c <= 6 ? 0 : r >= 1 && r <= 19 && c >= 14 && c <= 19 ? 1 : null;
    if (room !== null) f.chamberAt.set(key(r, c), room);
    else if (!(r === 10 && c > 6 && c < 14)) f.wallSet.add(key(r, c));
  }
  f.playerRow = 19;
  f.playerCol = 1;
}

// Runs fn with Math.random fixed at `value`, then puts it back.
export function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}
