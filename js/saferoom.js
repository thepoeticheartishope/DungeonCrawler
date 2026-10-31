// The safe room (safe room plan, `ideas/safe-room-plan.md` outside the repo;
// Timothy 2026-10-27): the start room of a danger floor. A shutter hangs
// over each of its doorways and a pull switch sits on the wall inside. Up,
// a shutter is open floor and a stick man stops at the frame a moment
// before it comes in. Down, it is solid like a wall: no stick man comes in
// or sees in, and one that knew where the player was gives up and wanders
// off. The hunter lifts it. A lamp lights the room, so the player's own
// light switches off as they come in; a stick man in the hall can see them
// by it while the shutter is up. The lamp goes out when the boss falls.
// The room keeps the player alive, it doesn't refill them: the battery
// doesn't charge in it (battery.js) and the charger is still the only
// top-up. floor.js buildFloor()
// calls placeSafeRoom(); moves.js calls pullShutter() on a bump and
// enterSafeRoom() on each step; combat.js asks where the room is. No DOM
// access here.

import { state, key } from './state.js';
import { FOUR_STEPS } from './grid.js';
import { startRoom } from './desk.js';
import { batteryInPlay } from './battery.js';

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
  const doors = room.floorCells.filter(p => FOUR_STEPS.some(([dr, dc]) => open(p.row + dr, p.col + dc)));
  if (!doors.length) return null;
  const nearDoor = (p) => Math.min(...doors.map(d => Math.max(Math.abs(d.row - p.row), Math.abs(d.col - p.col))));
  const wallSide = (p) => FOUR_STEPS.some(([dr, dc]) => layout.walls.has(key(p.row + dr, p.col + dc)));
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

// Whether the safe room's lamp lights (row, col): one of its tiles, while
// the lamp is on. It counts as light the player is seen by (combat.js).
export function lampLit(row, col) {
  const sr = state.floor.safeRoom;
  return !!sr && sr.lamp && sr.cells.has(key(row, col));
}

// The tiles the lamp lights for the player: the safe room's, while they
// are in it and the lamp is on (sight.js, like a window's light). None
// from outside: its light ends at the doorway.
export function lampLightHere() {
  const f = state.floor;
  return lampLit(f.playerRow, f.playerCol) ? new Set(f.safeRoom.cells) : new Set();
}

// The kind voice's line the first time in a run the player stands in the
// safe room with its switch made out (sight.js marks it `identified`), so
// they learn the room can be shut (Timothy's rule: every new mechanic gets
// a tutorial beat). Once a run, and not on a turn the voice already speaks
// (`turn`'s events), so the charger's line isn't talked over. Never on the
// ship: no one is out there to shut out (ship plan).
// Returns whispered { line: 'tut.shutter', tone: 'kind' }, or nothing.
export function shutterLine(turn = []) {
  const f = state.floor;
  if (f.ship || state.run.shutterTold || !f.safeRoom || !f.safeRoom.playerIn) return [];
  if (turn.some(e => e.type === 'whispered')) return [];
  if (!f.props.some(p => p.kind === 'switch' && p.identified)) return [];
  state.run.shutterTold = true;
  return [{ type: 'whispered', line: 'tut.shutter', tone: 'kind' }];
}

// The player has come onto a new tile (moves.js enterTile). Crossing into
// the safe room breaks every reach in progress, as a landed shot does:
// making it to the doorway is the answer to being jumped. With the lamp on
// their own light switches off (call c: the room is lit, so it neither
// drains nor fills in there), unless the battery is out of play or the
// light is held on; it stays off when they leave. Events: reachBroken
// { minion } for each one that was reaching, then lightSwitchedForLamp.
export function enterSafeRoom() {
  const f = state.floor;
  const sr = f.safeRoom;
  if (!sr) return [];
  const inside = sr.cells.has(key(f.playerRow, f.playerCol));
  const came = inside && !sr.playerIn;
  sr.playerIn = inside;
  if (!came) return [];
  const events = f.minions.filter(m => m.reaching).map(m => {
    m.reaching = null;
    return { type: 'reachBroken', minion: m };
  });
  if (sr.lamp && batteryInPlay() && f.light.on && !f.light.steady) {
    f.light.on = false;
    events.push({ type: 'lightSwitchedForLamp' });
  }
  return events;
}
