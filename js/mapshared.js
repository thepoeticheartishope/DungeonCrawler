// Small helpers the room view (roomview.js, roomthings.js) shares that
// aren't about how it projects the floor: which tiles are wall, and a
// steady per-tile number for wood grain and scuffs. Reads state only.

import { state, key } from './state.js';

// Whether (row, col) is wall or off the grid.
export function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

// A tile's own number from 0 to 1, the same every time, for the grain of
// wood and the scuffs on the lino. Never Math.random (the seeded tests own it).
export function grain(row, col, n) {
  let h = (row * 374761393 + col * 668265263 + n * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
