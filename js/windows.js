// The ship's windows (Timothy 2026-11-02): windows into space on the
// rooms' back walls. floor.js buildShipFloor() calls placeShipWindows();
// roomview.js and roomsky.js draw them from state.floor.windows.
// No DOM access here.

import { state, key } from './state.js';
import { SHIP_WINDOWS } from './config.js';
import { shuffle } from './random.js';

// True if (row, col) is wall or off the grid.
function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

// Puts the ship's windows in state.floor.windows (Timothy 2026-11-02: the
// space outside, seen through windows scattered through the rooms, never
// more than two to a room). A ship window stands on a room's back wall: a
// wall tile with that room's floor just below it and wall just above it,
// two tiles wide, never at the wall's ends, so the frame sits on wall.
// Each room gets one, or two with SHIP_WINDOWS.twoChance, at random spots
// at least SHIP_WINDOWS.gap tiles apart. Space gives no light, so they
// light no floor (the ship is lit everywhere anyway). Each is
// { row, col, room, view }: `view` (0..1 across and down) is where in the
// run's space picture (space.js) its glass looks, and
// state.floor.spaceSeed is that picture's seed.
export function placeShipWindows() {
  const f = state.floor;
  const spots = new Map();
  for (let row = 1; row < f.GRID_SIZE - 1; row++) {
    for (let col = 1; col + 2 < f.GRID_SIZE; col++) {
      const room = f.chamberAt.get(key(row + 1, col));
      const fits = room !== undefined && [col - 1, col, col + 1, col + 2].every(c => isWall(row, c) && isWall(row - 1, c)) &&
        [col, col + 1].every(c => !isWall(row + 1, c) && f.chamberAt.get(key(row + 1, c)) === room);
      if (!fits) continue;
      if (!spots.has(room)) spots.set(room, []);
      spots.get(room).push({ row, col, room });
    }
  }
  const windows = [];
  spots.forEach(list => {
    const want = Math.random() < SHIP_WINDOWS.twoChance ? 2 : 1;
    const picked = [];
    shuffle(list).forEach(s => {
      if (picked.length < want && picked.every(p => p.row !== s.row || Math.abs(p.col - s.col) >= 2 + SHIP_WINDOWS.gap)) picked.push(s);
    });
    picked.forEach(s => windows.push({ ...s, view: { x: Math.random(), y: Math.random() } }));
  });
  f.windows = windows;
  f.spaceSeed = Math.random();
}
