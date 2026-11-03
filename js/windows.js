// Windows (room view plan step F; Timothy 2026-10-26: their light shows
// stick men): back walls of rooms that face the outside get windows, and
// each throws a pool of light down and across its room's floor. Window
// light lights the room the player is in (windowLightHere): it counts as
// light they see by, like their own (sight.js canMakeOut), so a stick man
// standing in it is seen, and a thing in it made out, from within
// REVEAL_DISTANCE with nothing solid in between. Another room's windows
// light nothing the player can see until they walk in. Shooting
// still needs the player's own light (sight.js shootBlock).
//
// floor.js calls placeWindows() when a danger floor or a rest is built
// (the tutorial room has none: its dark is the lesson), and
// placeShipWindows() for the ship, whose windows look out into space. roomview.js draws
// the windows and their pools from state.floor.windows, with the same
// WINDOW_LIGHT shape, so what shows lit is what is lit.
// No DOM access here.

import { state, key } from './state.js';
import { WINDOW_LIGHT, SHIP_WINDOWS } from './config.js';
import { shuffle } from './random.js';

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

// The window-lit tiles of the room the player stands in (none in a
// hallway): what windows light for them now.
export function windowLightHere() {
  const f = state.floor;
  const room = f.chamberAt.get(key(f.playerRow, f.playerCol));
  if (room === undefined) return new Set();
  return new Set([...f.windowLitSet].filter(k => f.chamberAt.get(k) === room));
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
  f.windowLitSet = new Set();
  f.spaceSeed = Math.random();
}
