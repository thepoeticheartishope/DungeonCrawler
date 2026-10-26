// What the player can see: the player's light (visibleSet / sightSet /
// exploredSet), whether a tile can be made out rather than shown as
// '?', and whether a thing can be shot (canShoot / aimChance). Rules only — no DOM access here; mapview.js draws from what this
// writes.

import { state, key } from './state.js';
import { windowLightHere } from './windows.js';
import {
  PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, REVEAL_DISTANCE, LOOK_CONE_HALF, LOOK_CONE_SLACK,
} from './config.js';
import { lookAngle, angleTo, wrapAngle } from './look.js';
import { lightOn } from './battery.js';

// One step each way the body can face. The 4 grid ways, then the 4
// diagonals (eight ways plan); on screen the diagonals are straight up,
// right, down and left (grid NW is screen up).
export const FACING_VECTORS = {
  N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1],
  NE: [-1, 1], SE: [1, 1], SW: [1, -1], NW: [-1, -1],
};

// The way a one-tile step (dRow, dCol) faces, or null for none.
export function facingOf(dRow, dCol) {
  return Object.keys(FACING_VECTORS).find(way => FACING_VECTORS[way][0] === dRow && FACING_VECTORS[way][1] === dCol) || null;
}

// True if the tile at (row, col) falls within the light's 90-degree cone,
// opening where the player looks (look.js lookAngle). Each tile gets a
// little slack, shrinking with distance, so a cone at an odd angle isn't
// ragged; looking straight along a way it lights exactly the old diamond
// (tests/look.test.mjs checks). Walls are the caller's job. The player's
// own tile always passes. With the light off (battery.js) there is no cone.
export function inLookCone(row, col) {
  const dr = row - state.floor.playerRow;
  const dc = col - state.floor.playerCol;
  const dist = Math.hypot(dr, dc);
  if (dist === 0) return true;
  if (!lightOn()) return false;
  const off = Math.abs(wrapAngle(angleTo(row, col) - lookAngle()));
  return off <= LOOK_CONE_HALF + Math.atan2(LOOK_CONE_SLACK, dist);
}

// The player's own light: every open tile within PLAYER_LIGHT_RADIUS steps,
// plus open tiles up to PLAYER_CONE_RANGE steps inside the look cone (none
// with the light off: only the circle).
// Walls fully block it (a lit cone never bleeds through a wall into an
// adjacent corridor); pillars are lit themselves but cast a shadow behind. Everything the boss's light reaches is visible too
// (state.floor.bossLitSet, from light.js) — the thing that ends the run is also
// what shows the player the way — and so is the tutorial's light from above
// (state.floor.spotSet, tutorial.js).
export function computeVisibility() {
  state.floor.visibleSet = new Set([...state.floor.bossLitSet, ...state.floor.spotSet, ...windowLightHere()]);
  const startKey = key(state.floor.playerRow, state.floor.playerCol);
  state.floor.visibleSet.add(startKey);
  // The player's own light, apart from the boss's: only what the player
  // sees themselves can be made out (see canMakeOut).
  state.floor.sightSet = new Set([startKey]);
  const reach = lightOn() ? Math.max(PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE) : PLAYER_LIGHT_RADIUS;
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
        if (dist <= PLAYER_LIGHT_RADIUS || inLookCone(nr, nc)) {
          state.floor.visibleSet.add(nk);
          state.floor.sightSet.add(nk);
        }
        continue;
      }
      // Still traverse through out-of-cone tiles (a corridor can bend into
      // view further on), but only mark in-cone ones as actually visible.
      if (dist <= PLAYER_LIGHT_RADIUS || inLookCone(nr, nc)) {
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

// True if a straight line from (fromRow, fromCol) to (row, col) passes no
// wall or pillar between them (the ends don't count). A stick man's view
// of the player's light uses it too (combat.js notice).
export function clearLine(fromRow, fromCol, row, col) {
  const dr = row - fromRow;
  const dc = col - fromCol;
  const steps = Math.max(Math.abs(dr), Math.abs(dc)) * 4;
  for (let i = 1; i < steps; i++) {
    const r = Math.round(fromRow + (dr * i) / steps);
    const c = Math.round(fromCol + (dc * i) / steps);
    if ((r === row && c === col) || (r === fromRow && c === fromCol)) continue;
    const k = key(r, c);
    if (state.floor.wallSet.has(k) || state.floor.pillarSet.has(k)) return false;
  }
  return true;
}

// True if a straight line from the player's tile to (row, col) passes no
// wall or pillar — the light can creep a step around a corner, but seeing
// what something is takes a clear view of it.
function clearLineTo(row, col) {
  return clearLine(state.floor.playerRow, state.floor.playerCol, row, col);
}

// Whether the player can make out what's on (row, col), rather than a
// '?': it has to be in their own light or a window's in the room they are
// in (windows.js windowLightHere; not just the boss's), within
// REVEAL_DISTANCE, with nothing solid in between. Window light shows stick
// men too (Timothy, 2026-10-26).
export function canMakeOut(row, col) {
  if (!state.settings.fogEnabled) return true;
  if (Math.max(Math.abs(row - state.floor.playerRow), Math.abs(col - state.floor.playerCol)) > REVEAL_DISTANCE) return false;
  const k = key(row, col);
  const f = state.floor;
  const windowLit = f.windowLitSet.has(k) && f.chamberAt.get(k) === f.chamberAt.get(key(f.playerRow, f.playerCol)) && f.chamberAt.has(k);
  return (f.sightSet.has(k) || windowLit) && clearLineTo(row, col);
}

// Whether the player sees minion or hunter `m` at all. Unlike items, an
// enemy is never a '?': one the player can't make out isn't shown, so it
// can't be tracked in the dark (Timothy). Back in the light, it's there.
export function seesEnemy(m) {
  return canMakeOut(m.row, m.col);
}

// Why the player can't shoot `thing` (anything with row/col) right now, as
// a text.js key under 'gun.block.', or null if they can. It has to be in
// the player's own light (sightSet, not the boss's) with a clear line to
// it, like making a thing out, and inside the cone itself (free look plan):
// a thing lit only because it stands beside the player can't be shot until
// they look at it. Range is the light's reach in walkable steps
// (PLAYER_CONE_RANGE), so "out of range" only shows when looking toward it
// wouldn't help.
export function shootBlock(thing) {
  const dr = thing.row - state.floor.playerRow;
  const dc = thing.col - state.floor.playerCol;
  if (Math.abs(dr) + Math.abs(dc) > PLAYER_CONE_RANGE) return 'outOfRange';
  if (!state.floor.sightSet.has(key(thing.row, thing.col)) || !inLookCone(thing.row, thing.col)) return 'notInLight';
  if (!clearLineTo(thing.row, thing.col)) return 'noLineOfSight';
  return null;
}

export function canShoot(thing) {
  return shootBlock(thing) === null;
}
