// Free walking (one stick plan steps A and B): with One stick on, the player walks
// in real time at their own pace, not tile to tile. Their spot is free
// (state.floor.playerAt, in tiles), and their body slides along walls and
// furniture. The rules still see the tile they stand on (playerRow /
// playerCol): coming onto a new one runs moves.js enterTile, and pushing
// into something solid runs moves.js bumpInto, so nothing found on a tile
// or met in a bump changes. main.js calls walkFree every frame while the
// real-time clock may run. No DOM access here.

import { state } from './state.js';
import { whatBlocks } from './passage.js';
import { swingLook } from './look.js';
import { besideCover } from './sight.js';
import { enterTile, bumpInto } from './moves.js';
import { ONE_STICK } from './config.js';

// The last bump while the player keeps pushing: what it hit (a tile key)
// and the ms until pushing on bumps it again; and how long this push has
// lasted (a key tap only turns). Timing, so module vars rather than
// state, as in realclock.js.
let bumpedAt = null;
let bumpWait = 0;
let pushedMs = 0;
// Whether the player was crouched in cover last frame (coverChanged).
let inCover = false;

// The player's free spot. It is the centre of their tile whenever it isn't
// on that tile (a new floor, or a rule that moved them, such as a step on
// the d-pad), so the two never disagree.
export function freeSpot() {
  const f = state.floor;
  const at = f.playerAt;
  if (at && Math.floor(at.x) === f.playerCol && Math.floor(at.y) === f.playerRow) return at;
  f.playerAt = { x: f.playerCol + 0.5, y: f.playerRow + 0.5 };
  return f.playerAt;
}

// What stops the player's body at (row, col), or null: passage.js
// whatBlocks, and while a downed stick man holds their ankle, any tile but
// their own (downed plan, call 2).
function blockerAt(row, col) {
  const f = state.floor;
  if (row === f.playerRow && col === f.playerCol) return null;
  const holder = f.minions.find(m => m.grabbing);
  if (holder) return { kind: 'held', thing: holder };
  return whatBlocks(row, col);
}

// Moves the spot `delta` tiles along one axis ('x' = columns, 'y' = rows),
// stopping the body's edge at the first tile in the way. Only tiles the
// edge newly reaches are checked, so a stick man stepping into a tile the
// body already overlaps never pins the player. Returns what stopped it
// ({ block, row, col }) or null.
function slide(spot, axis, delta) {
  if (!delta) return null;
  const R = ONE_STICK.body;
  const across = axis === 'x' ? spot.y : spot.x;
  const lines = [];
  for (let n = Math.floor(across - R); n <= Math.ceil(across + R) - 1; n++) lines.push(n);
  // Tiles across the way nearest the centre first, so a bump names what is
  // straight ahead.
  lines.sort((a, b) => Math.abs(a + 0.5 - across) - Math.abs(b + 0.5 - across));
  const from = spot[axis];
  const to = from + delta;
  const ahead = delta > 0 ? e => Math.ceil(e + R) - 1 : e => Math.floor(e - R);
  const step = delta > 0 ? 1 : -1;
  for (let n = ahead(from) + step; step > 0 ? n <= ahead(to) : n >= ahead(to); n += step) {
    for (const m of lines) {
      const [row, col] = axis === 'x' ? [m, n] : [n, m];
      const block = blockerAt(row, col);
      if (!block) continue;
      spot[axis] = delta > 0 ? n - R : n + 1 + R;
      return { block, row, col };
    }
  }
  spot[axis] = to;
  return null;
}

// One frame of walking: the stick (or the keys) pushed `push` (0..1) toward
// (dirX, dirY) on screen (x right = east, y down = south; the camera never
// turns), for `dtMs`. The light and body swing round toward the push
// (look.js swingLook; `still` under reduced motion turns them at once) and
// hold when it stops. A move key let go within ONE_STICK.tapMs (`keys`),
// or a push on the stick inside its deadZone, only turns them: tap to look
// (one stick plan step B). Otherwise the player walks a tile in
// ONE_STICK.walkMs, or creeps one in sneakMs while sneaking or under a
// push below `creep`, diagonals as fast as straight lines. A push that
// gets less than ONE_STICK.bumpProgress of its way bumps what stopped it
// (moves.js bumpInto) once, then again every bumpRepeatMs while it goes
// on; letting go (no push) ends it. A creep stays crouched once let go
// (`creeping`), until the player walks at full pace, so they can hide in
// cover from the stick too. Events: swingLook's, enterTile's
// (stepped { free: true } and what the tile holds) and bumpInto's, or
// heldFast { minion } while a downed one holds the ankle; then
// coverTaken (coverChanged).
export function walkFree(dirX, dirY, { push = 1, dtMs = 0, keys = false, still = false } = {}) {
  const f = state.floor;
  const ms = Math.min(dtMs, ONE_STICK.frameMs);
  const len = Math.hypot(dirX, dirY);
  if (len) {
    f.lookWant = Math.atan2(dirX, -dirY);
    pushedMs += ms;
  } else {
    pushedMs = 0;
    bumpedAt = null;
    bumpWait = 0;
  }
  const events = swingLook(ms, still);
  if (!len || (keys && pushedMs <= ONE_STICK.tapMs) || push < ONE_STICK.deadZone) return [...events, ...coverChanged()];
  const spot = freeSpot();
  bumpWait = Math.max(0, bumpWait - ms);
  f.creeping = f.sneaking || push < ONE_STICK.creep;
  const reach = ms / (f.creeping ? ONE_STICK.sneakMs : ONE_STICK.walkMs);
  const [ux, uy] = [dirX / len, dirY / len];

  const [x0, y0] = [spot.x, spot.y];
  const hitX = slide(spot, 'x', ux * reach);
  const hitY = slide(spot, 'y', uy * reach);
  const row = Math.floor(spot.y);
  const col = Math.floor(spot.x);
  if (row !== f.playerRow || col !== f.playerCol) {
    f.playerRow = row;
    f.playerCol = col;
    events.push(...enterTile(f.facing, true));
  }

  const hit = Math.abs(ux) >= Math.abs(uy) ? hitX || hitY : hitY || hitX;
  const stuck = Math.hypot(spot.x - x0, spot.y - y0) < reach * ONE_STICK.bumpProgress;
  if (hit && stuck) events.push(...bump(hit));
  return [...events, ...coverChanged()];
}

// Says when the player has just crouched in cover (sight.js besideCover:
// quieter, and hidden from stick men on its far side), once each time.
// Event: coverTaken.
function coverChanged() {
  const now = besideCover();
  if (now === inCover) return [];
  inCover = now;
  return now ? [{ type: 'coverTaken' }] : [];
}

// Switches sneaking on or off (X): the player creeps, slow and crouched,
// until it is switched off. Event: sneakSwitched { on }.
export function switchSneak() {
  state.floor.sneaking = !state.floor.sneaking;
  // Switched off, a crouch left from creeping goes too: they stand.
  if (!state.floor.sneaking) state.floor.creeping = false;
  return [{ type: 'sneakSwitched', on: state.floor.sneaking }];
}

// A bump into what `hit` found, unless the push already bumped it and
// ONE_STICK.bumpRepeatMs hasn't passed.
function bump(hit) {
  const at = hit.row + ',' + hit.col;
  if (bumpedAt === at && bumpWait > 0) return [];
  bumpedAt = at;
  bumpWait = ONE_STICK.bumpRepeatMs;
  if (hit.block.kind === 'held') return [{ type: 'heldFast', minion: hit.block.thing }];
  return bumpInto(hit.block);
}

// Forgets the bump in progress (a new floor, or the walk paused).
export function resetWalk() {
  bumpedAt = null;
  bumpWait = 0;
  pushedMs = 0;
  inCover = false;
}
