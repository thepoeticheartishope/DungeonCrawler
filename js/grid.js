// The step tables for walking the grid one tile at a time: four ways
// (no diagonals) and eight, and the one walk outward over the floor that
// counts steps. One copy, so every search over the floor tries the ways in
// the same order. No DOM access here.

import { state, key } from './state.js';

// North, south, east and west as [dRow, dCol], in the order every
// four-way search has always used.
export const FOUR_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// The four ways plus the four diagonals, as noise.js and vents.js spread.
export const EIGHT_STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

// Walkable steps (four ways) from `from` to every tile it reaches on the
// floor's grid, as a Map of tile key -> steps. `blocked` holds the keys
// that can't be walked onto. `stopAt`, if given, is a key that is reached
// but never walked through (beats.js: the boss guards its room's only door).
export function stepsFrom(from, blocked, stopAt = null) {
  const size = state.floor.GRID_SIZE;
  const steps = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const curKey = key(cur.row, cur.col);
    const d = steps.get(curKey);
    if (curKey === stopAt && d > 0) continue;
    for (const [dr, dc] of FOUR_STEPS) {
      const row = cur.row + dr, col = cur.col + dc;
      if (row < 0 || row >= size || col < 0 || col >= size) continue;
      const k = key(row, col);
      if (steps.has(k) || blocked.has(k)) continue;
      steps.set(k, d + 1);
      queue.push({ row, col });
    }
  }
  return steps;
}
