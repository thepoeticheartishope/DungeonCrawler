// What the player can see: the player's light (visibleSet / sightSet /
// exploredSet), whether a tile can be made out rather than shown as
// '?', and whether a thing can be shot (canShoot / aimChance). Rules only — no DOM access here; mapview.js draws from what this
// writes.

import { state, key } from './state.js';
import {
  PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, REVEAL_DISTANCE, AIM_FALLOFF_PER_TILE, AIM_MIN,
} from './config.js';

// Facing vectors for the cone test below.
export const FACING_VECTORS = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

// True if the tile at (row, col) falls within a 90-degree cone opening in
// `facing`'s direction from the player — a diamond that widens as it gets
// further away, using only integer math (no trig needed on a square grid).
// The player's own tile always passes (forward = lateral = 0).
function inFacingCone(row, col) {
  const [fr, fc] = FACING_VECTORS[state.floor.facing];
  const dr = row - state.floor.playerRow;
  const dc = col - state.floor.playerCol;
  const forward = dr * fr + dc * fc;       // distance projected along facing
  const lateral = dr * fc - dc * fr;       // signed distance perpendicular to it
  return forward >= 0 && Math.abs(lateral) <= forward;
}

// The player's own light: every open tile within PLAYER_LIGHT_RADIUS steps,
// plus open tiles up to PLAYER_CONE_RANGE steps inside the facing cone.
// Walls fully block it (a lit cone never bleeds through a wall into an
// adjacent corridor); pillars are lit themselves but cast a shadow behind. Everything the boss's light reaches is visible too
// (state.floor.bossLitSet, from light.js) — the thing that ends the run is also
// what shows the player the way.
export function computeVisibility() {
  state.floor.visibleSet = new Set(state.floor.bossLitSet);
  const startKey = key(state.floor.playerRow, state.floor.playerCol);
  state.floor.visibleSet.add(startKey);
  // The player's own light, apart from the boss's: only what the player
  // sees themselves can be made out (see canMakeOut).
  state.floor.sightSet = new Set([startKey]);
  const reach = Math.max(PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE);
  const queue = [{ row: state.floor.playerRow, col: state.floor.playerCol, dist: 0 }];
  const seen = new Set([startKey]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist >= reach) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.floor.GRID_SIZE || nc < 0 || nc >= state.floor.GRID_SIZE) continue;
      const nk = key(nr, nc);
      if (seen.has(nk) || state.floor.wallSet.has(nk)) continue;
      seen.add(nk);
      const dist = cur.dist + 1;
      if (state.floor.pillarSet.has(nk)) {
        if (dist <= PLAYER_LIGHT_RADIUS || inFacingCone(nr, nc)) {
          state.floor.visibleSet.add(nk);
          state.floor.sightSet.add(nk);
        }
        continue;
      }
      // Still traverse through out-of-cone tiles (a corridor can bend into
      // view further on), but only mark in-cone ones as actually visible.
      if (dist <= PLAYER_LIGHT_RADIUS || inFacingCone(nr, nc)) {
        state.floor.visibleSet.add(nk);
        state.floor.sightSet.add(nk);
      }
      queue.push({ row: nr, col: nc, dist });
    }
  }
  // In the darkness after the boss, nothing is remembered: only what the
  // player's light touches right now can be seen.
  if (!state.floor.darkness) state.floor.visibleSet.forEach(k => state.floor.exploredSet.add(k));
  // Papers and boxes don't move, so once the player has made one out it
  // keeps its real glyph from then on, even when only remembered.
  state.floor.props.forEach(p => { if (canMakeOut(p.row, p.col)) p.identified = true; });
}

// True if a straight line from the player's tile to (row, col) passes no
// wall or pillar — the light can creep a step around a corner, but seeing
// what something is takes a clear view of it.
function clearLineTo(row, col) {
  const dr = row - state.floor.playerRow;
  const dc = col - state.floor.playerCol;
  const steps = Math.max(Math.abs(dr), Math.abs(dc)) * 4;
  for (let i = 1; i < steps; i++) {
    const r = Math.round(state.floor.playerRow + (dr * i) / steps);
    const c = Math.round(state.floor.playerCol + (dc * i) / steps);
    if (r === row && c === col) continue;
    const k = key(r, c);
    if (state.floor.wallSet.has(k) || state.floor.pillarSet.has(k)) return false;
  }
  return true;
}

// Whether the player can make out what's on (row, col), rather than a
// '?': it has to be in their own light (not just the boss's), within
// REVEAL_DISTANCE, with nothing solid in between.
export function canMakeOut(row, col) {
  if (!state.settings.fogEnabled) return true;
  if (Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol)) > REVEAL_DISTANCE) return false;
  return state.floor.sightSet.has(key(row, col)) && clearLineTo(row, col);
}

// Why the player can't shoot `thing` (anything with row/col) right now, as
// a text.js key under 'gun.block.', or null if they can. It has to be in
// the player's own light (sightSet, not the boss's) with a clear line to
// it, like making a thing out. Range is the light's reach in walkable
// steps (PLAYER_CONE_RANGE), so "out of range" only shows when turning
// toward it wouldn't help.
export function shootBlock(thing) {
  const dr = thing.row - state.floor.playerRow;
  const dc = thing.col - state.floor.playerCol;
  if (Math.abs(dr) + Math.abs(dc) > PLAYER_CONE_RANGE) return 'outOfRange';
  if (!state.floor.sightSet.has(key(thing.row, thing.col))) return 'notInLight';
  if (!clearLineTo(thing.row, thing.col)) return 'noLineOfSight';
  return null;
}

export function canShoot(thing) {
  return shootBlock(thing) === null;
}

// The chance a shot at `thing` lands: 1 next to the player (diagonals
// included), less by AIM_FALLOFF_PER_TILE per tile of straight-line
// distance past the first, never below AIM_MIN. It doesn't check canShoot.
export function aimChance(thing) {
  const distance = Math.hypot(thing.row - state.floor.playerRow, thing.col - state.floor.playerCol);
  return Math.min(1, Math.max(AIM_MIN, 1 - (distance - 1) * AIM_FALLOFF_PER_TILE));
}
