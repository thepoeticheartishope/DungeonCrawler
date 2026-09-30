// The boss's light: it starts on the boss and spreads outward through the
// floor one step every few turns. Reaching the floor's loss coverage (floors.js)
// of the walkable tiles loses the run; defeating the boss puts it out. No
// DOM access here — render.js draws it, main.js decides what happens when
// it's full.

import { state, key } from './state.js';
import { LIGHT_TURNS_PER_STEP } from './config.js';
import { floorRecipe } from './floors.js';

// Walkable steps from (row, col) to every reachable floor tile, walls only.
function stepsFrom(row, col) {
  const dist = new Map([[key(row, col), 0]]);
  const queue = [{ row, col }];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.floor.GRID_SIZE || nc < 0 || nc >= state.floor.GRID_SIZE) continue;
      const k = key(nr, nc);
      if (dist.has(k) || state.floor.wallSet.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return dist;
}

// Called once per room, after the layout, boss and player start are set.
// Works out the radius at which the light covers this floor's
// loss coverage (floors.js), and so how many turns the player gets before the
// steadily spreading light gets there.
export function initBossLight() {
  state.floor.bossDist = stepsFrom(state.floor.boss.row, state.floor.boss.col);
  state.floor.floorCount = state.floor.bossDist.size;
  const coverage = floorRecipe(state.run.roomIndex).lossCoverage;
  const sorted = [...state.floor.bossDist.values()].sort((a, b) => a - b);
  const needed = Math.max(1, Math.ceil(state.floor.floorCount * coverage));
  state.floor.lightFullRadius = Math.max(1, sorted[needed - 1]);
  state.floor.lightTurnBudget = state.floor.lightFullRadius * LIGHT_TURNS_PER_STEP;
  state.floor.lightTurns = 0;
  updateBossLit();
}

// The light moves one walkable step further every LIGHT_TURNS_PER_STEP
// turns, reaching lightFullRadius exactly when the budget runs out. It
// never drops below 1, so the boss and the tiles right around it always
// glow.
function currentRadius() {
  return Math.max(1, Math.floor(state.floor.lightTurns / LIGHT_TURNS_PER_STEP));
}

function updateBossLit() {
  state.floor.bossLitSet = new Set();
  if (!state.floor.boss) return;
  const r = currentRadius();
  state.floor.bossDist.forEach((d, k) => { if (d <= r) state.floor.bossLitSet.add(k); });
}

// One turn passes. The light only spreads while the boss is alive.
export function advanceLight() {
  if (!state.floor.boss) return;
  state.floor.lightTurns++;
  updateBossLit();
}

// Puts the light out: the boss is gone, so is its glow.
export function extinguishLight() {
  state.floor.bossLitSet = new Set();
}

// Share of the floor the light reaches, 0..1.
export function lightCoverage() {
  return state.floor.floorCount ? state.floor.bossLitSet.size / state.floor.floorCount : 0;
}

// How close the light is to consuming the floor: 0 at the start of a room,
// 1 when it's reached this floor's loss coverage (floors.js). Drives the eye.
export function lightProgress() {
  if (!state.floor.boss) return 0;
  return Math.min(1, state.floor.lightTurns / state.floor.lightTurnBudget);
}

export function lightConsumed() {
  return !!state.floor.boss && state.floor.lightTurns >= state.floor.lightTurnBudget;
}
