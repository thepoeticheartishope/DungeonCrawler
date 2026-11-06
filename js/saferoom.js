// The safe room (safe room plan, `ideas/safe-room-plan.md` outside the repo;
// Timothy 2026-10-27): Command, where the ship's run starts. A shutter
// hangs over each of its doorways and works like an automatic door: up
// while the player is near (autoShutters), down and solid otherwise.
// floor.js buildShipFloor() calls placeSafeRoom() and autoShutters();
// moves.js calls autoShutters() and enterSafeRoom() on each step; music.js
// asks whether the player is in it. No DOM access here.

import { state, key, parseKey } from './state.js';
import { FOUR_STEPS } from './grid.js';
import { SHIP_DOOR_REACH } from './config.js';

// The room holding `layout.start` (Command on the ship), or undefined.
function startRoom(layout) {
  const startKey = key(layout.start.row, layout.start.col);
  return layout.chambers.find(ch => ch.floorCells.some(p => key(p.row, p.col) === startKey));
}

// The start room's shutters, or null if it has no doorway. Its doorways
// are its own tiles with open floor outside the room beside them.
// Returns { safeRoom, props }: safeRoom for state.floor.safeRoom, props =
// a 'shutter' on each doorway ({ up: true }).
export function placeSafeRoom(layout) {
  const room = startRoom(layout);
  if (!room) return null;
  const chamber = layout.chamberAt.get(key(room.floorCells[0].row, room.floorCells[0].col));
  const cells = new Set(room.floorCells.map(p => key(p.row, p.col)));
  const size = state.floor.GRID_SIZE;
  const open = (r, c) => r >= 0 && c >= 0 && r < size && c < size && !layout.walls.has(key(r, c)) && !cells.has(key(r, c));
  const doors = room.floorCells.filter(p => FOUR_STEPS.some(([dr, dc]) => open(p.row + dr, p.col + dc)));
  if (!doors.length) return null;
  return {
    safeRoom: { chamber, cells, doors: doors.map(p => key(p.row, p.col)), shut: false, playerIn: true },
    props: doors.map(p => ({ row: p.row, col: p.col, kind: 'shutter', up: true })),
  };
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

// On the ship (Timothy 2026-11-02): Command's shutters work like
// automatic doors. They roll up while the player is within SHIP_DOOR_REACH
// tiles of a doorway and drop once they walk away, so there is nothing to
// bump. A shutter in the player's own doorway is always in reach, so it
// never drops on them. No events: the
// slats moving (roomthings.js) is all it shows.
export function autoShutters() {
  const f = state.floor;
  const sr = f.safeRoom;
  if (!sr) return;
  const near = sr.doors.some(k => {
    const { row, col } = parseKey(k);
    return Math.max(Math.abs(row - f.playerRow), Math.abs(col - f.playerCol)) <= SHIP_DOOR_REACH;
  });
  sr.shut = !near;
  shutters().forEach(p => { p.up = near; });
}

// The player has come onto a new tile (moves.js enterTile): notes
// whether they are in the safe room now (music.js plays its music there).
// No events.
export function enterSafeRoom() {
  const sr = state.floor.safeRoom;
  if (!sr) return [];
  sr.playerIn = sr.cells.has(key(state.floor.playerRow, state.floor.playerCol));
  return [];
}
