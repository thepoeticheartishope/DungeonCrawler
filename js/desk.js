// The reflective desk (Timothy, 2026-10-15): one desk in the room the
// player starts each floor in. Bumping it heals to full, once a floor, so
// walking back to the first room is a choice worth weighing. floor.js
// buildFloor() calls placeDesk(); moves.js examineProp() calls useDesk().
// No DOM access here.

import { state, key } from './state.js';

// The floor's one desk, in the room holding `layout.start`, on the
// furniture's rules (never in a doorway, never cutting the floor in two),
// never on a `taken` tile. Null if the room has no spot for it.
// Returns { row, col, kind: 'desk' } or null.
export function placeDesk(layout, placer, taken) {
  const startKey = key(layout.start.row, layout.start.col);
  const room = layout.chambers.find(ch => ch.floorCells.some(p => key(p.row, p.col) === startKey));
  if (!room) return null;
  const free = room.floorCells.filter(p => !taken.some(q => q.row === p.row && q.col === p.col));
  const spot = placer.pick(free, true);
  return spot ? { ...spot, kind: 'desk' } : null;
}

// Bumping the desk. With stability already full it does nothing and stays
// unused, so a bump at full can't waste the floor's one heal. Otherwise it
// heals to full and is spent until the next floor. No turn is spent.
// Events: deskUntouched, or deskHealed { healed }.
export function useDesk(desk) {
  const missing = state.run.maxHearts - state.run.hearts;
  if (missing <= 0) return [{ type: 'deskUntouched' }];
  desk.searched = true;
  state.run.hearts = state.run.maxHearts;
  return [{ type: 'deskHealed', healed: missing }];
}
