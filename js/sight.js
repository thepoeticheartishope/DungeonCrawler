// What the player can see and where the camera sits: the player's light
// (visibleSet / sightSet / exploredSet), whether a tile can be made out
// rather than shown as '?', and the camera offset. Rules only — no DOM
// access here; render.js draws from what this writes.

import { state, key } from './state.js';
import { PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, VIEWPORT_SIZE, REVEAL_DISTANCE } from './config.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi));
}

// Centers the viewport on the player, clamped so it never shows past the
// room's edge. Call this any time the player moves (or a room loads),
// before renderWalls()/renderFog()/positionActor() — they all read
// state.camRow/camCol to know which world tile belongs in which cell.
export function updateCamera() {
  state.camRow = clamp(state.playerRow - Math.floor(VIEWPORT_SIZE / 2), 0, state.GRID_SIZE - VIEWPORT_SIZE);
  state.camCol = clamp(state.playerCol - Math.floor(VIEWPORT_SIZE / 2), 0, state.GRID_SIZE - VIEWPORT_SIZE);
}

// Facing vectors for the cone test below.
export const FACING_VECTORS = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };

// True if the tile at (row, col) falls within a 90-degree cone opening in
// `facing`'s direction from the player — a diamond that widens as it gets
// further away, using only integer math (no trig needed on a square grid).
// The player's own tile always passes (forward = lateral = 0).
function inFacingCone(row, col) {
  const [fr, fc] = FACING_VECTORS[state.facing];
  const dr = row - state.playerRow;
  const dc = col - state.playerCol;
  const forward = dr * fr + dc * fc;       // distance projected along facing
  const lateral = dr * fc - dc * fr;       // signed distance perpendicular to it
  return forward >= 0 && Math.abs(lateral) <= forward;
}

// The player's own light: every open tile within PLAYER_LIGHT_RADIUS steps,
// plus open tiles up to PLAYER_CONE_RANGE steps inside the facing cone.
// Walls fully block it (a lit cone never bleeds through a wall into an
// adjacent corridor); pillars are lit themselves but cast a shadow behind. Everything the boss's light reaches is visible too
// (state.bossLitSet, from light.js) — the thing that ends the run is also
// what shows the player the way.
export function computeVisibility() {
  state.visibleSet = new Set(state.bossLitSet);
  const startKey = key(state.playerRow, state.playerCol);
  state.visibleSet.add(startKey);
  // The player's own light, apart from the boss's: only what the player
  // sees themselves can be made out (see canMakeOut).
  state.sightSet = new Set([startKey]);
  const reach = Math.max(PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE);
  const queue = [{ row: state.playerRow, col: state.playerCol, dist: 0 }];
  const seen = new Set([startKey]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist >= reach) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.GRID_SIZE || nc < 0 || nc >= state.GRID_SIZE) continue;
      const nk = key(nr, nc);
      if (seen.has(nk) || state.wallSet.has(nk)) continue;
      seen.add(nk);
      const dist = cur.dist + 1;
      if (state.pillarSet.has(nk)) {
        if (dist <= PLAYER_LIGHT_RADIUS || inFacingCone(nr, nc)) {
          state.visibleSet.add(nk);
          state.sightSet.add(nk);
        }
        continue;
      }
      // Still traverse through out-of-cone tiles (a corridor can bend into
      // view further on), but only mark in-cone ones as actually visible.
      if (dist <= PLAYER_LIGHT_RADIUS || inFacingCone(nr, nc)) {
        state.visibleSet.add(nk);
        state.sightSet.add(nk);
      }
      queue.push({ row: nr, col: nc, dist });
    }
  }
  // In the darkness after the boss, nothing is remembered: only what the
  // player's light touches right now can be seen.
  if (!state.darkness) state.visibleSet.forEach(k => state.exploredSet.add(k));
}

// True if a straight line from the player's tile to (row, col) passes no
// wall or pillar — the light can creep a step around a corner, but seeing
// what something is takes a clear view of it.
function clearLineTo(row, col) {
  const dr = row - state.playerRow;
  const dc = col - state.playerCol;
  const steps = Math.max(Math.abs(dr), Math.abs(dc)) * 4;
  for (let i = 1; i < steps; i++) {
    const r = Math.round(state.playerRow + (dr * i) / steps);
    const c = Math.round(state.playerCol + (dc * i) / steps);
    if (r === row && c === col) continue;
    const k = key(r, c);
    if (state.wallSet.has(k) || state.pillarSet.has(k)) return false;
  }
  return true;
}

// Whether the player can make out what's on (row, col), rather than a
// '?': it has to be in their own light (not just the boss's), within
// REVEAL_DISTANCE, with nothing solid in between.
export function canMakeOut(row, col) {
  if (!state.fogEnabled) return true;
  if (Math.max(Math.abs(row - state.playerRow), Math.abs(col - state.playerCol)) > REVEAL_DISTANCE) return false;
  return state.sightSet.has(key(row, col)) && clearLineTo(row, col);
}
