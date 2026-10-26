// Windows (room view plan step F; Timothy 2026-10-26: their light shows
// stick men): back walls of rooms that face the outside get windows, and
// each throws a pool of light down and across its room's floor. Window
// light counts as light the player sees by, like their own (sight.js
// canMakeOut): a stick man standing in it is seen, and a thing in it made
// out, from within REVEAL_DISTANCE with nothing solid in between. Shooting
// still needs the player's own light (sight.js shootBlock).
//
// floor.js calls placeWindows() when a danger floor or a rest is built
// (the tutorial room has none: its dark is the lesson). roomview.js draws
// the windows and their pools from state.floor.windows, with the same
// WINDOW_LIGHT shape, so what shows lit is what is lit.
// No DOM access here.

import { state, key } from './state.js';
import { WINDOW_LIGHT } from './config.js';

// True if (row, col) is wall or off the grid.
function isWall(row, col) {
  const f = state.floor;
  return row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE || f.wallSet.has(key(row, col));
}

// Puts this floor's windows in state.floor.windows and the tiles they light
// in state.floor.windowLitSet. A window stands on a back wall that looks
// out: a wall tile with a room's floor just below it, a wall above that,
// and nothing but wall above that to the grid's edge. Along each such
// stretch of one room's wall, one window 2 tiles wide every
// WINDOW_LIGHT.every columns, never at the stretch's ends. Each is
// { row, col, room }: the wall row just above the floor, its left column,
// its room (chamberAt).
export function placeWindows() {
  const f = state.floor;
  const windows = [];
  for (let row = 1; row < f.GRID_SIZE; row++) {
    let run = null;
    const close = () => {
      if (run) for (let col = run.c0 + 1; col + 1 <= run.c1 - 1; col += WINDOW_LIGHT.every) windows.push({ row, col, room: run.room });
      run = null;
    };
    for (let col = 0; col < f.GRID_SIZE; col++) {
      const room = f.chamberAt.get(key(row + 1, col));
      const outside = room !== undefined && isWall(row, col) && !isWall(row + 1, col) &&
        Array.from({ length: row }, (_, r) => r).every(r => isWall(r, col));
      if (outside && run && run.room === room) run.c1 = col;
      else {
        close();
        if (outside) run = { c0: col, c1: col, room };
      }
    }
    close();
  }
  f.windows = windows;
  f.windowLitSet = new Set(windows.flatMap(w => windowPool(w).map(p => key(p.row, p.col))));
}

// The floor tiles window `w` lights: its pool runs WINDOW_LIGHT.length tiles
// down from the wall, leaning WINDOW_LIGHT.slant tiles across as it goes,
// WINDOW_LIGHT.inset in from the window's sides; a tile is in it when its
// middle is, on its own room's floor.
export function windowPool(w) {
  const f = state.floor;
  const tiles = [];
  const top = w.row + 1;
  for (let row = top; row + 0.5 - top <= WINDOW_LIGHT.length; row++) {
    const share = (row + 0.5 - top) / WINDOW_LIGHT.length;
    const x0 = w.col + WINDOW_LIGHT.inset + WINDOW_LIGHT.slant * share;
    const x1 = w.col + 2 - WINDOW_LIGHT.inset + WINDOW_LIGHT.slant * share;
    for (let col = Math.floor(x0); col <= Math.ceil(x1); col++) {
      if (col + 0.5 < x0 || col + 0.5 > x1) continue;
      if (isWall(row, col) || f.chamberAt.get(key(row, col)) !== w.room) continue;
      tiles.push({ row, col });
    }
  }
  return tiles;
}
