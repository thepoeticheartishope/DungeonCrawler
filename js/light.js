// The boss's light: it starts on the boss and spreads outward through the
// floor one step every few turns. Reaching the floor's LIGHT_LOSS_COVERAGE
// of the walkable tiles loses the run; defeating the boss puts it out. No
// DOM access here — render.js draws it, main.js decides what happens when
// it's full.

import { state, key } from './state.js';
import { LIGHT_LOSS_COVERAGE, LIGHT_TURNS_PER_STEP } from './config.js';

// Walkable steps from (row, col) to every reachable floor tile, walls only.
function stepsFrom(row, col) {
  const dist = new Map([[key(row, col), 0]]);
  const queue = [{ row, col }];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.GRID_SIZE || nc < 0 || nc >= state.GRID_SIZE) continue;
      const k = key(nr, nc);
      if (dist.has(k) || state.wallSet.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return dist;
}

// Called once per room, after the layout, boss and player start are set.
// Works out the radius at which the light covers this floor's
// LIGHT_LOSS_COVERAGE, and so how many turns the player gets before the
// steadily spreading light gets there.
export function initBossLight() {
  state.bossDist = stepsFrom(state.boss.row, state.boss.col);
  state.floorCount = state.bossDist.size;
  const coverage = LIGHT_LOSS_COVERAGE[Math.min(state.roomIndex, LIGHT_LOSS_COVERAGE.length - 1)];
  const sorted = [...state.bossDist.values()].sort((a, b) => a - b);
  const needed = Math.max(1, Math.ceil(state.floorCount * coverage));
  state.lightFullRadius = Math.max(1, sorted[needed - 1]);
  state.lightTurnBudget = state.lightFullRadius * LIGHT_TURNS_PER_STEP;
  state.lightTurns = 0;
  updateBossLit();
}

// The light moves one walkable step further every LIGHT_TURNS_PER_STEP
// turns, reaching lightFullRadius exactly when the budget runs out. It
// never drops below 1, so the boss and the tiles right around it always
// glow.
function currentRadius() {
  return Math.max(1, Math.floor(state.lightTurns / LIGHT_TURNS_PER_STEP));
}

function updateBossLit() {
  state.bossLitSet = new Set();
  if (!state.boss) return;
  const r = currentRadius();
  state.bossDist.forEach((d, k) => { if (d <= r) state.bossLitSet.add(k); });
}

// One turn passes. The light only spreads while the boss is alive.
export function advanceLight() {
  if (!state.boss) return;
  state.lightTurns++;
  updateBossLit();
}

// Puts the light out: the boss is gone, so is its glow.
export function extinguishLight() {
  state.bossLitSet = new Set();
}

// Share of the floor the light reaches, 0..1.
export function lightCoverage() {
  return state.floorCount ? state.bossLitSet.size / state.floorCount : 0;
}

// How close the light is to consuming the floor: 0 at the start of a room,
// 1 when it's reached this floor's LIGHT_LOSS_COVERAGE. Drives the eye.
export function lightProgress() {
  if (!state.boss) return 0;
  return Math.min(1, state.lightTurns / state.lightTurnBudget);
}

export function lightConsumed() {
  return !!state.boss && state.lightTurns >= state.lightTurnBudget;
}
