// The boss's light: it starts on the boss and spreads outward through the
// floor one step every few turns. When the floor's turns run out (the
// walk through every key to the boss plus the recipe's slack, floors.js)
// the run is lost; defeating the boss puts it out. No
// DOM access here — mapview.js draws it, main.js decides what happens when
// it's full.

import { state, key } from './state.js';
import { stepsFrom } from './grid.js';
import { LIGHT_TURNS_PER_STEP, ONE_STICK, REALTIME_STEP_MS } from './config.js';
import { floorRecipe } from './floors.js';

// Called once per room, after the layout, boss, keys and player start are
// set. Works out how many turns the player gets before the light consumes
// the floor, and the radius the steadily spreading light has reached by
// then. The budget is the shortest walk from the start through every key
// to the boss (state.floor.keyRoute; the core sits beside the start, so
// the keys are the real trip) plus the recipe's slack, rounded up to whole
// light steps. On a fixed plan (plans.js) the walk goes through every key
// SPOT, not just the ones holding keys: the player can't know which hold
// them, so sweeping them all is the honest search, and the building's
// clock is then the same whichever spots the run picked (fixed floors
// plan, step C). The slack is the spare time on top of that. A recipe without slack uses its
// lossCoverage share instead (floorBudget). Turns bought at THE UNFOLDING
// (state.run.bonusSlack) are added on top and spent here, so they only
// help the next depth.
export function initBossLight() {
  state.floor.bossDist = stepsFrom(state.floor.boss, state.floor.wallSet);
  state.floor.floorCount = state.floor.bossDist.size;
  state.floor.keyRoute = keyRoute();
  const walk = lightTurnsFor(state.floor.keyRoute);
  const turns = lightTurnsFor(floorBudget(floorRecipe(state.run.roomIndex, state.floor.path), state.floor.keyRoute) + state.run.bonusSlack);
  state.run.bonusSlack = 0;
  state.floor.lightFullRadius = Math.max(1, Math.ceil(turns / LIGHT_TURNS_PER_STEP));
  state.floor.lightTurnBudget = state.floor.lightFullRadius * LIGHT_TURNS_PER_STEP;
  state.floor.lightSlack = state.floor.lightTurnBudget - walk;
  state.floor.lightLossShare = shareWithin(state.floor.lightFullRadius);
  state.floor.lightTurns = 0;
  updateBossLit();
}

// The light's turns for `turns` of the turn game: the same, or with One
// stick (one stick plan step D) the world's beats they come to, each turn
// counted as ONE_STICK.lightTurnMs, rounded up so a cost is never lost.
// The budget, a relay's and the gate's turns all go through it.
export function lightTurnsFor(turns) {
  if (!state.settings.oneStick || turns <= 0) return turns;
  return Math.ceil(turns * ONE_STICK.lightTurnMs / REALTIME_STEP_MS);
}

// Steps of the shortest walk from the player through every key on the
// floor (every key spot on a fixed plan), in the best order, ending at the
// boss. Walls only, like the light. With no keys it is just the walk to
// the boss. A key the walls cut off (never, on a built floor) counts as no
// steps. A plan has up to 8 spots, too many orders to try one by one, so
// it keeps the best walk for each set of spots seen and the spot it ended
// on, and grows those sets one spot at a time.
function keyRoute() {
  const f = state.floor;
  const here = key(f.playerRow, f.playerCol);
  const stops = f.keySpots.length ? f.keySpots : f.keys;
  if (!stops.length) return f.bossDist.get(here) || 0;
  const fromStop = stops.map(p => stepsFrom(p, state.floor.wallSet));
  const steps = (dist, p) => dist.get(key(p.row, p.col)) || 0;
  const n = stops.length;
  const all = (1 << n) - 1;
  // best[set][last]: the shortest walk from the player through `set`, ending on `last`.
  const best = Array.from({ length: all + 1 }, () => new Array(n).fill(Infinity));
  stops.forEach((p, i) => { best[1 << i][i] = fromStop[i].get(here) || 0; });
  for (let set = 1; set <= all; set++) {
    for (let last = 0; last < n; last++) {
      const sofar = best[set][last];
      if (sofar === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (set & (1 << next)) continue;
        const grown = set | (1 << next);
        best[grown][next] = Math.min(best[grown][next], sofar + steps(fromStop[last], stops[next]));
      }
    }
  }
  return Math.min(...stops.map((p, i) => best[all][i] + steps(f.bossDist, p)));
}

// Turns the floor gives before the light wins. With a slack range: the
// walk plus a slack rolled inside it. Without one: the turns until the
// light covers the recipe's lossCoverage share of the floor, as before.
function floorBudget(recipe, walk) {
  if (recipe.slack) {
    const [min, max] = recipe.slack;
    return walk + min + Math.floor(Math.random() * (max - min + 1));
  }
  const sorted = [...state.floor.bossDist.values()].sort((a, b) => a - b);
  const needed = Math.max(1, Math.ceil(state.floor.floorCount * recipe.lossCoverage));
  return sorted[needed - 1] * LIGHT_TURNS_PER_STEP;
}

// Share of the walkable tiles within `radius` steps of the boss: how much
// of the floor the light covers when it reaches that radius.
function shareWithin(radius) {
  if (!state.floor.floorCount) return 0;
  let lit = 0;
  state.floor.bossDist.forEach(d => { if (d <= radius) lit++; });
  return lit / state.floor.floorCount;
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
