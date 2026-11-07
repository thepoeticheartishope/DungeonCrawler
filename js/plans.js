// The ship's floor plan (ship plan, ideas/ship-plan.md outside the repo):
// the same every run. floor.js buildShipFloor() calls buildPlanLayout().
// The dungeon's plans and their gate, stairs, keys and versions went in
// dungeon removal steps D and E2 (the old PRs keep them).
//
// Draw the plan as rows of text, all the same length, one per grid row:
//   #  wall
//   .  floor
//   S  where the player wakes (Command)
// Rooms are rectangles of floor (r0, c0 to r1, c1, inclusive). Floor
// outside every room is hallway; a hallway tile beside a room is that
// room's doorway. The plan's and its rooms' `name`s are text.js keys: a
// room's name shows the first time the player walks in (moves.js
// roomEntered) and on the minimap.
// A room's `furniture` (room view plan step E) lists its pieces as
// [piece, row, col, width]: width tiles along the row from (row, col),
// 1 when left out. The same pieces stand there every run. decor.js puts
// them down first, as solid props of kind 'furniture' that block walking
// but not sight; one that would cut the floor in two, or stand on a
// doorway or the start, is left out. The pieces are the ones roomthings.js
// draws (FURNITURE_PIECES in config.js).
// `stations` are [kind, row, col, role] (stations.js placeStations).
// No DOM access here.

import { key } from './state.js';
import { FOUR_STEPS } from './grid.js';

export const FLOOR_PLANS = {
  // No 'a'/'b' tiles: both side halls by Command are always open, so the
  // player can walk the whole ship every run (Timothy 2026-11-02).
  ship: {
    name: 'plan.ship',
    stations: [
      ['console', 12, 14, 'engineer'],
      ['powerBoard', 12, 4, 'engineer'],
      ['crew', 12, 5, 'engineer'],
      // The other crew roles (crew roles plan, roles.js), one or two to a room.
      ['crew', 2, 13, 'navigator'],
      ['crew', 2, 19, 'pilot'],
      ['crew', 5, 13, 'gunner'], // the Bridge, by its doorway (Timothy 2026-11-01: the Bridge; the top row would wall a corner off)
      ['crew', 12, 28, 'comms'],
      ['crew', 16, 28, 'signals'], // beside Comms (facts list plan step E)
      ['crew', 2, 4, 'medic'],
      ['crew', 24, 30, 'cook'],
      ['crew', 12, 2, 'systems'],
      ['crew', 2, 27, 'science'],
      ['crew', 26, 14, 'quartermaster'],
      ['crew', 26, 18, 'sensors'],
      ['crew', 28, 3, 'lifeSupport'],
    ],
    rows: [
      '#################################',
      '#################################',
      '##.......###.........###.......##',
      '##.......###.........###.......##',
      '##.......###.........###.......##',
      '##.......###.........###.......##',
      '##.......#######.#######.......##',
      '#####.##########.##########.#####',
      '#####.....######.######.....#####',
      '#########...............#########',
      '#########.#############.#########',
      '#########.#############.#########',
      '##.....##.##.........##.##.....##',
      '##.....##.##....S....##.##.....##',
      '##.....##.##.........##.##.....##',
      '##........##.........##........##',
      '##.....##.##.........##.##.....##',
      '##.....##.##.........##.##.....##',
      '##.....##.##.........##.##.....##',
      '#########.######.######.#########',
      '#########.######.######.#########',
      '#########...............#########',
      '#####.....######.######.....#####',
      '#####.##########.##########.#####',
      '##.......####.......####.......##',
      '##.......####.......####.......##',
      '##.......####.......####.......##',
      '##.......####.......####.......##',
      '##.......###############.......##',
      '##.......###############.......##',
      '#################################',
      '#################################',
      '#################################',
    ],
    rooms: [
      { name: 'plan.ship.command', r0: 12, c0: 12, r1: 18, c1: 20, furniture: [
        ['desk', 15, 13], ['desk', 15, 19], ['desk', 17, 13], ['desk', 17, 19],
      ] },
      { name: 'plan.ship.airlock', r0: 24, c0: 13, r1: 27, c1: 19, furniture: [
        ['bench', 24, 13, 2], ['bench', 24, 18, 2],
      ] },
      { name: 'plan.ship.medBay', r0: 2, c0: 2, r1: 6, c1: 8, furniture: [
        ['bench', 4, 3, 2], ['bench', 4, 6, 2], ['sink', 2, 8],
      ] },
      { name: 'plan.ship.bridge', r0: 2, c0: 12, r1: 5, c1: 20, furniture: [
        ['table', 3, 14, 2], ['table', 3, 17, 2],
      ] },
      { name: 'plan.ship.hydroponics', r0: 2, c0: 24, r1: 6, c1: 30, furniture: [
        ['table', 4, 26, 3],
      ] },
      { name: 'plan.ship.engineRoom', r0: 12, c0: 2, r1: 18, c1: 6, furniture: [
        ['desk', 16, 3], ['desk', 16, 5],
      ] },
      { name: 'plan.ship.quarters', r0: 12, c0: 26, r1: 18, c1: 30, furniture: [
        ['sofa', 18, 27, 2], ['desk', 14, 27], ['desk', 14, 29],
      ] },
      { name: 'plan.ship.washroom', r0: 24, c0: 2, r1: 29, c1: 8, furniture: [
        ['sink', 24, 2], ['sink', 24, 3], ['stall', 25, 8], ['stall', 27, 8],
      ] },
      { name: 'plan.ship.galley', r0: 24, c0: 24, r1: 29, c1: 30, furniture: [
        ['table', 26, 26, 3], ['sofa', 29, 25, 2],
      ] },
    ],
  },
};

// The ship's layout from its plan: walls, the room tiles (every room's
// floor and doorways), each room (`chambers`: floorCells, doorKeys, name,
// furniture), which room each tile is in (`chamberAt`), and the start. A
// plan that breaks its own rules is a mistake in this file, so it throws.
export function buildPlanLayout(plan) {
  const size = plan.rows.length;
  const walls = new Set();
  const floor = new Set();
  const starts = [];
  plan.rows.forEach((row, r) => {
    if (row.length !== size) throw new Error(plan.name + ': row ' + r + ' is not ' + size + ' long');
    [...row].forEach((ch, c) => {
      (ch === '#' ? walls : floor).add(key(r, c));
      if (ch === 'S') starts.push({ row: r, col: c });
    });
  });
  if (starts.length !== 1) throw new Error(plan.name + ': needs exactly one S');

  // Each room's floor, then its doorways: hallway tiles beside it.
  const chamberAt = new Map();
  const chambers = plan.rooms.map((room, i) => {
    const floorCells = [];
    for (let r = room.r0; r <= room.r1; r++) {
      for (let c = room.c0; c <= room.c1; c++) {
        if (!floor.has(key(r, c))) continue;
        floorCells.push({ row: r, col: c });
        chamberAt.set(key(r, c), i);
      }
    }
    return { floorCells, doorKeys: new Set(), name: room.name, furniture: room.furniture || [] };
  });
  chambers.forEach((ch, i) => {
    ch.floorCells.slice().forEach(p => FOUR_STEPS.forEach(([dr, dc]) => {
      const k = key(p.row + dr, p.col + dc);
      if (!floor.has(k) || chamberAt.has(k)) return;
      chamberAt.set(k, i);
      ch.doorKeys.add(k);
      ch.floorCells.push({ row: p.row + dr, col: p.col + dc });
    }));
  });
  return { walls, roomTiles: new Set(chamberAt.keys()), chambers, chamberAt, start: starts[0] };
}
