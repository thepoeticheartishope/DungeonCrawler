// The ship's floor plan (ship plan, ideas/ship-plan.md outside the repo):
// the same every run. floor.js buildShipFloor() calls buildPlanLayout().
// The dungeon's other plans went in dungeon removal step D (the old PRs
// keep them); the layout code still reads their tiles (gate, stairs, keys,
// versions).
//
// Draw a plan as rows of text, all the same length, one per grid row:
//   #  wall
//   .  floor
//   G  the gate: the core's one way in, where the boss stands
//   X  the stairs, inside the core
//   S  where the player wakes
//   K  a key spot: CORE_KEYS of them hold a key each run
//   a  floor only in version A (wall in B)
//   b  floor only in version B (wall in A)
// Rooms are rectangles of floor (r0, c0 to r1, c1, inclusive); the one
// with `core: true` is the core. Floor outside every room is hallway. A
// hallway tile beside a room is that room's doorway, as in rooms.js.
// A plan's and its rooms' `name` are text.js keys: the room's name shows
// the first time the player walks in (moves.js roomEntered) and on the
// minimap. Depth 1 is the keeper; depths 2 and 3 are drafts Timothy will
// redraw and rename.
// A room's `furniture` (room view plan step E) lists its pieces as
// [piece, row, col, width]: width tiles along the row from (row, col),
// 1 when left out. The same pieces stand there every run. decor.js puts
// them down first, as solid props of kind 'furniture' that block walking
// but not the light; one that would cut the floor in two, or stand on a
// doorway, the start, a key spot, the gate or the stairs, is left out.
// The pieces are the ones roomview.js draws (FURNITURE_PIECES in
// config.js). Only the School is furnished so far.
// A room's `spots` (room spots plan, ideas/room-spots-plan.md outside the
// repo; Timothy 2026-10-28) are places that may hold something to help the
// player: [row, col, kinds], each on one of the room's furniture tiles,
// `kinds` what it may hold (SPOT_KINDS in config.js). Each run spots.js
// rolls each one: one of its kinds, or nothing a third of the time.
// No DOM access here.

import { key } from './state.js';
import { FOUR_STEPS } from './grid.js';
import { SPOT_KINDS } from './config.js';

export const FLOOR_PLANS = {
  // No 'a'/'b' tiles: both side halls by Command are always open, so the
  // player can walk the whole ship every run (Timothy 2026-11-02).
  ship: {
    name: 'plan.ship',
    ship: true,
    stations: [
      ['console', 12, 14, 'engineer'],
      ['powerBoard', 12, 4, 'engineer'],
      ['crew', 12, 5, 'engineer'],
      // The other crew roles (crew roles plan, roles.js), one or two to a room.
      ['crew', 2, 13, 'navigator'],
      ['crew', 2, 19, 'pilot'],
      ['crew', 5, 13, 'gunner'], // the Bridge, by its doorway (Timothy 2026-11-01: the Bridge; the top row would wall a corner off)
      ['crew', 12, 28, 'comms'],
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

export const PLAN_VERSIONS = ['A', 'B'];

// Takes `count` random items from `list`, never the same one twice.
function pickSome(list, count) {
  const pool = list.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// The key spots that will hold keys: `count` of the plan's spots, never
// two in the same room, so finding one key never gives away the room the
// next is in. A spot in a hallway counts as a room of its own.
function pickKeySpots(spots, chamberAt, count) {
  const picked = [];
  const rooms = new Set();
  for (const p of pickSome(spots, spots.length)) {
    const room = chamberAt.get(key(p.row, p.col));
    if (room !== undefined && rooms.has(room)) continue;
    if (room !== undefined) rooms.add(room);
    picked.push(p);
    if (picked.length === count) break;
  }
  return picked;
}

// Throws when one of `room`'s spots is not on one of its furniture tiles or
// names a kind spots.js doesn't know: a mistake in this file.
function checkSpots(planName, room) {
  (room.spots || []).forEach(([row, col, kinds]) => {
    const onPiece = (room.furniture || []).some(([, r, c, width = 1]) => r === row && col >= c && col < c + width);
    if (!onPiece) throw new Error(planName + ': spot ' + row + ',' + col + ' is not on furniture in ' + room.name);
    if (!kinds.length || kinds.some(k => !SPOT_KINDS.includes(k))) throw new Error(planName + ': spot ' + row + ',' + col + ' has an unknown kind');
  });
}

// A floor layout built from a fixed plan, in the same shape as dungeon.js
// generateDungeonLayout returns (walls, roomTiles, chambers, chamberAt,
// start, spawn = the gate, stairs, keys), plus `version` and `keySpots`.
// `version` is 'A' or 'B' (random if left out); `keyCount` key spots
// get keys. A plan that breaks its own rules is a mistake in this file,
// so it throws.
export function buildPlanLayout(plan, keyCount, version = null) {
  const v = version || PLAN_VERSIONS[Math.floor(Math.random() * PLAN_VERSIONS.length)];
  const size = plan.rows.length;
  const walls = new Set();
  const floor = new Set();
  const found = { G: [], X: [], S: [], K: [] };
  plan.rows.forEach((row, r) => {
    if (row.length !== size) throw new Error(plan.name + ': row ' + r + ' is not ' + size + ' long');
    [...row].forEach((ch, c) => {
      const open = ch !== '#' && (ch !== 'a' || v === 'A') && (ch !== 'b' || v === 'B');
      (open ? floor : walls).add(key(r, c));
      if (found[ch]) found[ch].push({ row: r, col: c });
    });
  });
  // A ship plan has no gate or stairs: only the start.
  (plan.ship ? ['S'] : ['G', 'X', 'S']).forEach(ch => {
    if (found[ch].length !== 1) throw new Error(plan.name + ': needs exactly one ' + ch);
  });

  // Each room's floor, then its doorways: hallway tiles beside it. The
  // gate is the core's doorway, so it counts as the core's, as the boss's
  // door does on a random floor.
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
    checkSpots(plan.name, room);
    return {
      floorCells, doorKeys: new Set(), slots: [], name: room.name, isBoss: !!room.core,
      furniture: room.furniture || [], spots: room.spots || [],
    };
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
  const roomTiles = new Set(chamberAt.keys());

  const keySpots = found.K;
  // A ship has no core, so no keys.
  const wanted = plan.ship ? 0 : keyCount;
  const keys = pickKeySpots(keySpots, chamberAt, wanted);
  if (keys.length < wanted) throw new Error(plan.name + ': not enough key spots in different rooms');
  return {
    walls, roomTiles, chambers, chamberAt, keys, keySpots, version: v,
    start: found.S[0], spawn: found.G[0], stairs: found.X[0],
  };
}
