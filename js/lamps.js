// Lamps (presence cues plan step A, `ideas/presence-cues-plan.md` outside
// the repo; Timothy 2026-10-28): fixed lights a plan puts in its halls and
// rooms (plans.js `L`), each lighting a small pool of floor round it. The
// dark hides detail, not presence: a stick man crossing a lamp's pool is
// seen from farther away than the player's own light reaches, and from
// outside the room, so the player can plan before he reaches them.
// Seeing him by lamp light is not aim help: shooting still needs the
// player's own light (sight.js shootBlock).
//
// floor.js calls placeLamps() when a floor is built. sight.js asks
// lampPoolLit (canMakeOut, computeVisibility); roomview.js draws each lamp
// hanging over its tile and its warm pool, and the minimap rings the ones
// seen (step B). A random floor or a rest has no lamps. The School's hang
// over its two hall junctions, its side corridors' crossings and its four
// hall corners (step D). The lamps go out when the boss falls, like the
// safe room's (lampsOn).
// No DOM access here.

import { state, key } from './state.js';
import { LAMP_LIGHT } from './config.js';
import { clearLine } from './sight.js';

// Puts the floor's lamps in state.floor.lamps and the tiles they light in
// state.floor.lampPoolSet, from the layout's lamp spots (`layout.lamps`,
// none on a floor that isn't from a plan).
export function placeLamps(layout) {
  const f = state.floor;
  f.lamps = (layout.lamps || []).map(p => ({ row: p.row, col: p.col }));
  f.lampPoolSet = new Set(f.lamps.flatMap(l => lampPool(l).map(p => key(p.row, p.col))));
}

// The floor tiles lamp `l` lights: those whose middle is within
// LAMP_LIGHT.radius tiles of the lamp's, with a clear line from it, so a
// lamp's light doesn't pass through a wall into the next room.
export function lampPool(l) {
  const f = state.floor;
  const r = Math.ceil(LAMP_LIGHT.radius);
  const tiles = [];
  for (let row = l.row - r; row <= l.row + r; row++) {
    for (let col = l.col - r; col <= l.col + r; col++) {
      if (Math.hypot(row - l.row, col - l.col) > LAMP_LIGHT.radius) continue;
      if (row < 0 || col < 0 || row >= f.GRID_SIZE || col >= f.GRID_SIZE) continue;
      if (f.wallSet.has(key(row, col))) continue;
      if (!clearLine(l.row, l.col, row, col)) continue;
      tiles.push({ row, col });
    }
  }
  return tiles;
}

// Whether the lamps are lit: until the boss falls (gate.js), as with the
// safe room's lamp.
export function lampsOn() {
  return !state.floor.darkness;
}

// Whether a lamp lights (row, col) right now.
export function lampPoolLit(row, col) {
  return lampsOn() && state.floor.lampPoolSet.has(key(row, col));
}
