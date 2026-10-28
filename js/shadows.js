// Shadows (presence cues plan step C, `ideas/presence-cues-plan.md` outside
// the repo; Timothy 2026-10-28): a stick man near a light throws his shadow
// along the floor, away from it. The shadow shows only where the floor is
// lit for the player (visibleSet: their own light, a lamp's pool they see,
// a window's in their room), so it can slide into their light round a
// corner before he does. A plain dark shape: it says something is there,
// not what it is, and it is no aim help (nothing here is shootable).
//
// The lights that throw shadows: a plan's lamps while they are on (lamps.js)
// and the windows (windows.js) for one standing in a window's pool.
// roomview.js draws them from shadowsAt(), with Simple enemies too: a dark
// shape isn't creepy (Timothy's call 4).
// No DOM access here.

import { state, key } from './state.js';
import { SHADOW, WINDOW_LIGHT } from './config.js';
import { clearLine } from './sight.js';
import { lampsOn } from './lamps.js';

// The lights that throw a shadow from a stick man on tile (row, col), as
// points { row, col } on the grid: each lamp within SHADOW.castFrom tiles
// with a clear line to him, and each window whose pool he stands in (the
// light coming in from outside, high over the middle of the window).
function lightsOn(row, col) {
  const f = state.floor;
  const lamps = lampsOn() ? f.lamps.filter(l => Math.hypot(row - l.row, col - l.col) <= SHADOW.castFrom && clearLine(l.row, l.col, row, col)) : [];
  const windows = f.windowLitSet.has(key(row, col))
    ? f.windows.filter(w => w.room === f.chamberAt.get(key(row, col))).map(w => ({ row: w.row - SHADOW.windowHigh, col: w.col + 1 - WINDOW_LIGHT.slant }))
    : [];
  return [...lamps, ...windows];
}

// The shadows a stick man standing at `at` ({ row, col }, tiles, may be
// between tiles while he walks) throws: one per light on him, each
// { dir: [dRow, dCol] (a unit step away from the light), length (tiles) }.
// It grows SHADOW.perTile longer for every tile he stands from the light,
// and stops where a wall or pillar is, as light does.
export function shadowsAt(at) {
  const row = Math.round(at.row), col = Math.round(at.col);
  return lightsOn(row, col).map(l => {
    const d = Math.hypot(at.row - l.row, at.col - l.col);
    if (d < SHADOW.minFrom) return null;
    const dir = [(at.row - l.row) / d, (at.col - l.col) / d];
    return { dir, length: reach(at, dir, SHADOW.base + d * SHADOW.perTile) };
  }).filter(Boolean);
}

// How far along `dir` from `at`, up to `most` tiles, the floor runs before
// a wall or pillar stops the shadow.
function reach(at, dir, most) {
  const f = state.floor;
  for (let s = SHADOW.sample; s <= most; s += SHADOW.sample) {
    const k = key(Math.round(at.row + dir[0] * s), Math.round(at.col + dir[1] * s));
    if (f.wallSet.has(k) || f.pillarSet.has(k)) return s - SHADOW.sample;
  }
  return most;
}

// The floor tiles a shadow from `at` covers, from his feet to its tip.
export function shadowTiles(at, shadow) {
  const tiles = new Map();
  for (let s = 0; s <= shadow.length; s += SHADOW.sample) {
    const row = Math.round(at.row + shadow.dir[0] * s), col = Math.round(at.col + shadow.dir[1] * s);
    tiles.set(key(row, col), { row, col });
  }
  return [...tiles.values()];
}

// Whether the player can see a shadow of stick man `m` now: one of its
// tiles, past his own, is on floor lit for them (visibleSet). For tests
// and the warning timer of step D; roomview.js draws every shadow, and
// the dark hides what isn't lit.
export function shadowSeen(m) {
  const at = { row: m.row, col: m.col };
  return shadowsAt(at).some(s => shadowTiles(at, s).some(p => (p.row !== m.row || p.col !== m.col) && state.floor.visibleSet.has(key(p.row, p.col))));
}
