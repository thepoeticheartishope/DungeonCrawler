// Fixed floor plans: each depth is one building, the same every run, like
// the apartments in Silent Hill or the ship in Signalis (fixed floors plan,
// ideas/fixed-floors/ outside the repo). What changes from run to run is
// how it is played: which version of the building, which key spots hold
// the keys, and everything decor.js, beats.js and floor.js put down.
// floor.js buildFloor() calls buildPlanLayout() for a recipe that names a
// plan (floors.js `plan`); a recipe without one still gets a random floor
// from dungeon.js.
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
//   L  floor with a lamp over it (lamps.js): it lights a small pool round
//      it, seen from afar (presence cues plan)
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
  school: {
    name: 'plan.school',
    rows: [
      '#################################',
      '#################################',
      '##K......###........K###.......##',
      '##.......###.........###.......##',
      '##.......###.........###.......##',
      '##.......###.........###.......##',
      '##.......#######.#######......K##',
      '#####.##########.##########.#####',
      '#####..L..######.######..L..#####',
      '#########.......L.......#########',
      '#########a#############b#########',
      '#########a#############b#########',
      '##.....##a##.........##b##....K##',
      '##.....##a##....X....##b##.....##',
      '##.....##.##.........##.##.....##',
      '##.......L##.........##L.......##',
      '##.....##.##.........##.##.....##',
      '##.....##.##.........##.##.....##',
      '##K....##.##.........##.##.....##',
      '#########.######G######.#########',
      '#########.######.######.#########',
      '#########.......L.......#########',
      '#####..L..######.######..L..#####',
      '#####.##########.##########.#####',
      '##.......####.......####.......##',
      '##.......####.......####.......##',
      '##.......####...S...####.......##',
      '##.......####.......####.......##',
      '##.......###############.......##',
      '##K......###############......K##',
      '#################################',
      '#################################',
      '#################################',
    ],
    rooms: [
      { name: 'plan.school.examHall', r0: 12, c0: 12, r1: 18, c1: 20, core: true, furniture: [
        ['desk', 15, 13], ['desk', 15, 15], ['desk', 15, 17], ['desk', 15, 19],
        ['desk', 17, 13], ['desk', 17, 15], ['desk', 17, 17], ['desk', 17, 19],
      ] },
      { name: 'plan.school.frontHall', r0: 24, c0: 13, r1: 27, c1: 19, furniture: [
        ['bench', 24, 13, 2], ['bench', 24, 18, 2],
      ] },
      { name: 'plan.school.lab', r0: 2, c0: 2, r1: 6, c1: 8, furniture: [
        ['bench', 4, 3, 2], ['bench', 4, 6, 2], ['sink', 2, 8],
      ], spots: [[2, 8, ['lure']]] },
      { name: 'plan.school.library', r0: 2, c0: 12, r1: 5, c1: 20, furniture: [
        ['shelf', 3, 13, 3], ['shelf', 3, 17, 3], ['table', 5, 12, 2],
      ], spots: [[3, 14, ['takedown']], [3, 18, ['takedown']]] },
      { name: 'plan.school.artRoom', r0: 2, c0: 24, r1: 6, c1: 30, furniture: [
        ['easel', 3, 25], ['easel', 3, 29], ['table', 4, 26, 3],
      ], spots: [[4, 27, ['hide']]] },
      { name: 'plan.school.class1', r0: 12, c0: 2, r1: 18, c1: 6, furniture: [
        ['teacher', 12, 3, 2], ['desk', 14, 3], ['desk', 14, 5], ['desk', 16, 3], ['desk', 16, 5],
      ], spots: [[12, 3, ['hide']]] },
      { name: 'plan.school.class2', r0: 12, c0: 26, r1: 18, c1: 30, furniture: [
        ['teacher', 12, 27, 2], ['desk', 14, 27], ['desk', 14, 29], ['desk', 16, 27], ['desk', 16, 29],
      ], spots: [[12, 27, ['hide']]] },
      { name: 'plan.school.toilets', r0: 24, c0: 2, r1: 29, c1: 8, furniture: [
        ['sink', 24, 2], ['sink', 24, 3], ['stall', 25, 8], ['stall', 27, 8],
      ], spots: [[25, 8, ['hide']], [27, 8, ['hide']], [24, 2, ['lure']]] },
      { name: 'plan.school.staffRoom', r0: 24, c0: 24, r1: 29, c1: 30, furniture: [
        ['table', 26, 26, 3], ['sofa', 29, 25, 2],
      ], spots: [[29, 25, ['hide']]] },
    ],
  },
  // The ship (ship plan, ideas/ship-plan.md outside the repo; Timothy
  // 2026-10-30): the School's rooms as a small spaceship, for the
  // "There's Been a Tragedy" test (floor.js buildShipFloor). The center
  // room is Command, where the player starts and learns. `ship: true`: no
  // gate, stairs or keys, so only 'S' is needed. Furniture is the School's
  // pieces for now; ship pieces come later. Names are drafts.
  // `stations` (ship plan step B, stations.js): [kind, row, col, role]
  // for each role's training console in Command, its board and its crew
  // member in its own room.
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
      '#########a#############b#########',
      '#########a#############b#########',
      '##.....##a##.........##b##.....##',
      '##.....##a##....S....##b##.....##',
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
  archive: {
    name: 'plan.archive',
    rows: [
      '#####################################',
      '#####################################',
      '#####################################',
      '#############K..........#############',
      '###K......###...........###.......###',
      '###.##.##.###...........###.##.##.###',
      '###.##.##.###...........###.##.##.###',
      '###.##.##.###..........K###.##.##.###',
      '###.##.##.########.########.##.##.###',
      '###.##.##.########.########.##.##.###',
      '###...............................###',
      '###.##.##.#.#############.#.##.##.###',
      '###.##.##.#.#############.#.##.##.###',
      '###.##.##.#.#############.#.##.##.###',
      '###.##.##.#.##.........##.#.##.##.###',
      '###.##.##.#.##....X....##.#.##.##.###',
      '###.##.##.#.##.........##.#.##K##.###',
      '###.##.##.#.##.........##.#.##.##.###',
      '###.##.##.#K##.........##K#.##.##.###',
      '###.##.##.####.........####.##.##.###',
      '###.##.##.####.........####.##.##.###',
      '###.##.##.########G########.##.##.###',
      '###.##.##.########.########.##.##.###',
      '###...............................###',
      '###.##.##.###.####.########.##.##.###',
      '###.##.##.###.#.......#####.##.##.###',
      '###.##.##.###.#.......#####.##.##.###',
      '###.##.##.###.#...S...#####.##.##.###',
      '###.##.##.###.#.......#####.##.##.###',
      '###.##.##.###.#############.##.##.###',
      '###.##.##.###...........###.##.##.###',
      '###.##.##.bbb...........aaa.##.##.###',
      '###.......###...........###......K###',
      '#############..........K#############',
      '#####################################',
      '#####################################',
      '#####################################',
    ],
    rooms: [
      { name: 'plan.archive.core', r0: 14, c0: 14, r1: 20, c1: 22, core: true },
      { name: 'plan.archive.wake', r0: 25, c0: 15, r1: 28, c1: 21 },
      { name: 'plan.archive.readingRoom', r0: 3, c0: 13, r1: 7, c1: 23 },
      { name: 'plan.archive.vault', r0: 30, c0: 13, r1: 33, c1: 23 },
      { name: 'plan.archive.catalogue', r0: 12, c0: 11, r1: 18, c1: 11 },
      { name: 'plan.archive.bindery', r0: 12, c0: 25, r1: 18, c1: 25 },
    ],
  },
  observatory: {
    name: 'plan.observatory',
    rows: [
      '#########################################',
      '#########################################',
      '####K........###############........K####',
      '####.........###############.........####',
      '####.........aaaaaaaaaaaaaaa.........####',
      '####.........###############.........####',
      '####.........###############.........####',
      '############.###############.############',
      '############.###############.############',
      '##.......###.###############.###.......##',
      '##.......###.###############.###.......##',
      '##...........###############...........##',
      '##.......###.###############.###.......##',
      '##K......###.###############.###......K##',
      '############.###############.############',
      '############.###############.############',
      '############.###.........###.############',
      '############.###....X....###.############',
      '############.###.........###.############',
      '############.###.........###.############',
      '############.###.........###.############',
      '############.###.........###.############',
      '#....#######.###.........###.#######....#',
      '#....#######.#######G#######.#######....#',
      '#....#######.#######.#######.#######....#',
      '#.......................................#',
      '#....###############.###############....#',
      '#....############.......############....#',
      '#K...b###########.......############...K#',
      '#####b###########...S...#################',
      '#####b###########.......#################',
      '#####b##############.####################',
      '#####b##############.####################',
      '#####b##############.####################',
      '#####b#########...........###############',
      '#####b#########...........###############',
      '#####bbbbbbbbbb...........###############',
      '###############...........###############',
      '###############K.........K###############',
      '#########################################',
      '#########################################',
    ],
    rooms: [
      { name: 'plan.observatory.telescopeRoom', r0: 16, c0: 16, r1: 22, c1: 24, core: true },
      { name: 'plan.observatory.lobby', r0: 27, c0: 17, r1: 30, c1: 23 },
      { name: 'plan.observatory.dome', r0: 2, c0: 4, r1: 6, c1: 12 },
      { name: 'plan.observatory.darkroom', r0: 9, c0: 2, r1: 13, c1: 8 },
      { name: 'plan.observatory.bunks', r0: 22, c0: 1, r1: 28, c1: 4 },
      { name: 'plan.observatory.orrery', r0: 2, c0: 28, r1: 6, c1: 36 },
      { name: 'plan.observatory.plateStore', r0: 9, c0: 32, r1: 13, c1: 38 },
      { name: 'plan.observatory.clockRoom', r0: 22, c0: 36, r1: 28, c1: 39 },
      { name: 'plan.observatory.boilerRoom', r0: 34, c0: 15, r1: 38, c1: 25 },
    ],
  },};

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
// start, spawn = the gate, stairs, keys), plus `version`, `keySpots` and
// `lamps`.
// `version` is 'A' or 'B' (random if left out); `keyCount` key spots
// get keys. A plan that breaks its own rules is a mistake in this file,
// so it throws.
export function buildPlanLayout(plan, keyCount, version = null) {
  const v = version || PLAN_VERSIONS[Math.floor(Math.random() * PLAN_VERSIONS.length)];
  const size = plan.rows.length;
  const walls = new Set();
  const floor = new Set();
  const found = { G: [], X: [], S: [], K: [], L: [] };
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
    walls, roomTiles, chambers, chamberAt, keys, keySpots, lamps: found.L, version: v,
    start: found.S[0], spawn: found.G[0], stairs: found.X[0],
  };
}
