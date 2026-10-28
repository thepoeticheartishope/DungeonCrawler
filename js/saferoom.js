// The safe room (safe room plan, `ideas/safe-room-plan.md` outside the repo;
// Timothy 2026-10-27): the start room of a danger floor. A shutter hangs
// over each of its doorways and a pull switch sits on the wall inside. Up,
// a shutter is open floor and a stick man stops at the frame a moment
// before it comes in. Down, it is solid like a wall: no stick man comes in
// or sees in, and one that knew where the player was gives up and wanders
// off. The hunter lifts it. The room keeps the player alive, it doesn't
// refill them: the charger is still the only top-up. floor.js buildFloor()
// calls placeSafeRoom(); moves.js calls pullShutter() on a bump and
// enterSafeRoom() on each step; combat.js asks where the room is. No DOM
// access here.

import { state, key } from './state.js';
import { startRoom } from './desk.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// The start room's shutters and switch, or null if it has no doorway or no
// spot for the switch. Its doorways are its own tiles with open floor
// outside the room beside them (two on the observatory's lobby). The switch
// goes on the free wall-side tile closest to a doorway that the furniture's
// rules allow (never in a doorway or right beside one, never cutting the
// floor in two), never on a `taken` tile. Returns { safeRoom, props }:
// safeRoom for state.floor.safeRoom, props = a 'shutter' on each doorway
// ({ up: true }) and the 'switch'.
export function placeSafeRoom(layout, placer, taken) {
  const room = startRoom(layout);
  if (!room) return null;
  const chamber = layout.chamberAt.get(key(room.floorCells[0].row, room.floorCells[0].col));
  const cells = new Set(room.floorCells.map(p => key(p.row, p.col)));
  const size = state.floor.GRID_SIZE;
  const open = (r, c) => r >= 0 && c >= 0 && r < size && c < size && !layout.walls.has(key(r, c)) && !cells.has(key(r, c));
  const doors = room.floorCells.filter(p => DIRS.some(([dr, dc]) => open(p.row + dr, p.col + dc)));
  if (!doors.length) return null;
  const nearDoor = (p) => Math.min(...doors.map(d => Math.max(Math.abs(d.row - p.row), Math.abs(d.col - p.col))));
  const wallSide = (p) => DIRS.some(([dr, dc]) => layout.walls.has(key(p.row + dr, p.col + dc)));
  const candidates = room.floorCells
    .filter(p => wallSide(p) && !taken.some(q => q.row === p.row && q.col === p.col))
    .map(p => ({ p, d: nearDoor(p) + Math.random() / 2 }))
    .sort((a, b) => a.d - b.d);
  const spot = candidates.find(({ p }) => placer.tryBlock([p], true));
  if (!spot) return null;
  const switchAt = { row: spot.p.row, col: spot.p.col };
  return {
    safeRoom: { chamber, cells, doors: doors.map(p => key(p.row, p.col)), switchAt, shut: false, lamp: true, playerIn: true },
    props: [...doors.map(p => ({ row: p.row, col: p.col, kind: 'shutter', up: true })), { ...switchAt, kind: 'switch' }],
  };
}

// Whether (row, col) is one of the safe room's tiles, doorways included.
export function inSafeRoom(row, col) {
  const sr = state.floor.safeRoom;
  return !!sr && sr.cells.has(key(row, col));
}

// Whether the safe room is shut with (row, col) inside it: nothing but the
// hunter gets to that tile.
export function shutIn(row, col) {
  const sr = state.floor.safeRoom;
  return !!sr && sr.shut && sr.cells.has(key(row, col));
}

// Whether the tile with key `k` holds a shutter that is down: solid, and
// no light or sight passes it (sight.js).
export function shutterDownAt(k) {
  const sr = state.floor.safeRoom;
  return !!sr && sr.shut && sr.doors.includes(k);
}

// The safe room's shutter props.
function shutters() {
  return state.floor.props.filter(p => p.kind === 'shutter');
}

// Bumping the switch, or a shutter that is down: every shutter of the room
// drops, or rolls up again. One won't drop on someone standing under it.
// No turn is spent. Events: shutterDown, shutterUp, or shutterBlocked.
export function pullShutter() {
  const f = state.floor;
  const sr = f.safeRoom;
  if (!sr) return [];
  if (!sr.shut) {
    const under = (k) => k === key(f.playerRow, f.playerCol) || f.minions.some(m => key(m.row, m.col) === k);
    if (sr.doors.some(under)) return [{ type: 'shutterBlocked' }];
  }
  sr.shut = !sr.shut;
  shutters().forEach(p => { p.up = !sr.shut; });
  return [{ type: sr.shut ? 'shutterDown' : 'shutterUp' }];
}

// The hunter has stood at a shut shutter long enough (combat.js): every
// shutter rolls up and stays up. Event: shutterLifted.
export function liftShutters() {
  const sr = state.floor.safeRoom;
  sr.shut = false;
  shutters().forEach(p => { p.up = true; });
  return [{ type: 'shutterLifted' }];
}

// The player has come onto a new tile (moves.js enterTile). Crossing into
// the safe room breaks every reach in progress, as a landed shot does:
// making it to the doorway is the answer to being jumped. Events:
// reachBroken { minion } for each one that was reaching.
export function enterSafeRoom() {
  const f = state.floor;
  const sr = f.safeRoom;
  if (!sr) return [];
  const inside = sr.cells.has(key(f.playerRow, f.playerCol));
  const came = inside && !sr.playerIn;
  sr.playerIn = inside;
  if (!came) return [];
  return f.minions.filter(m => m.reaching).map(m => {
    m.reaching = null;
    return { type: 'reachBroken', minion: m };
  });
}
