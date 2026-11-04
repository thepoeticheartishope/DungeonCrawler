// The boss's light: it starts on the boss and spreads outward through the
// floor one step every few turns. When the floor's turns run out (the
// walk through every key to the boss plus the recipe's slack)
// the run is lost; defeating the boss puts it out. No
// DOM access here — mapview.js draws it, main.js decides what happens when
// it's full.

import { state } from './state.js';
import { LIGHT_TURNS_PER_STEP, ONE_STICK, REALTIME_STEP_MS } from './config.js';

// The light's turns for `turns` of the turn game: the same, or with One
// stick (one stick plan step D) the world's beats they come to, each turn
// counted as ONE_STICK.lightTurnMs, rounded up so a cost is never lost.
// The budget, a relay's and the gate's turns all go through it.
export function lightTurnsFor(turns) {
  if (!state.settings.oneStick || turns <= 0) return turns;
  return Math.ceil(turns * ONE_STICK.lightTurnMs / REALTIME_STEP_MS);
}

// The light moves one walkable step further every LIGHT_TURNS_PER_STEP
// turns, reaching lightFullRadius exactly when the budget runs out. It
// never drops below 1, so the boss and the tiles right around it always
// glow.
function currentRadius() {
  return Math.max(1, Math.floor(state.floor.lightTurns / LIGHT_TURNS_PER_STEP));
}

// Rebuilds the lit tiles from the radius. A room held by a relay
// (relays.js) stays dark however far the light has spread. Exported for
// relays.js, which moves the light's turns.
export function updateBossLit() {
  const f = state.floor;
  f.bossLitSet = new Set();
  if (!f.boss) return;
  const r = currentRadius();
  f.bossDist.forEach((d, k) => {
    if (d <= r && !f.heldChambers.has(f.chamberAt.get(k))) f.bossLitSet.add(k);
  });
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
// 1 when the floor's turns have run out. Drives the eye.
export function lightProgress() {
  if (!state.floor.boss) return 0;
  return Math.min(1, state.floor.lightTurns / state.floor.lightTurnBudget);
}

export function lightConsumed() {
  return !!state.floor.boss && state.floor.lightTurns >= state.floor.lightTurnBudget;
}
