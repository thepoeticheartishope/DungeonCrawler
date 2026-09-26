// Dungeon generation: places rooms from the hand-drawn templates in
// rooms.js, joins them with hallways that run from door to door around
// the rooms (never through them), picks a boss room, and guarantees that
// room has exactly one entrance.
//
// This module is self-contained — it takes the grid size and chamber
// target as plain arguments instead of reading shared game state, so it
// can be tested on its own with no dependency on the rest of the game.

import { key } from './state.js';
import { randomTemplate, parseTemplate } from './rooms.js';

const CHAMBER_BUFFER = 2;    // empty tiles required between two rooms' outer walls
const EDGE_MARGIN = 1;       // tiles kept free at the grid edge, so edge doors can lead somewhere
const TURN_COST = 3;         // extra cost of a bend, so hallways run in long straight lines
const REUSE_COST = 0.5;      // cost of a step along an existing hallway, so hallways merge
const EXTRA_LOOPS_MAX = 3;   // extra hallways beyond the minimum, for more than one route

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// A parsed template placed with its top-left corner at (r0, c0), in
// absolute grid coordinates. The footprint is the whole drawing, walls
// included — hallways may not enter it.
function placeRoom(tpl, r0, c0) {
  const abs = p => ({ row: r0 + p.row, col: c0 + p.col });
  return {
    r0, c0, h: tpl.h, w: tpl.w,
    floorCells: tpl.floor.map(abs),
    doors: tpl.doors.map(d => ({ ...abs(d), exit: abs(d.exit) })),
    slots: tpl.slots.map(abs),
    innerDoors: tpl.innerDoors.map(abs),
    center: { row: r0 + (tpl.h - 1) / 2, col: c0 + (tpl.w - 1) / 2 },
  };
}

function overlaps(a, b, buffer) {
  return a.r0 - buffer < b.r0 + b.h && b.r0 - buffer < a.r0 + a.h &&
    a.c0 - buffer < b.c0 + b.w && b.c0 - buffer < a.c0 + a.w;
}

function footprintKeys(room, pad = 0) {
  const keys = [];
  for (let r = room.r0 - pad; r < room.r0 + room.h + pad; r++) {
    for (let c = room.c0 - pad; c < room.c0 + room.w + pad; c++) keys.push(key(r, c));
  }
  return keys;
}

function roomDist(a, b) {
  return Math.abs(a.center.row - b.center.row) + Math.abs(a.center.col - b.center.col);
}

// Minimal binary heap keyed on .cost, for the hallway search below.
function makeHeap() {
  const items = [];
  return {
    get size() { return items.length; },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (items[p].cost <= items[i].cost) break;
        [items[p], items[i]] = [items[i], items[p]];
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < items.length && items[l].cost < items[m].cost) m = l;
          if (r < items.length && items[r].cost < items[m].cost) m = r;
          if (m === i) break;
          [items[m], items[i]] = [items[i], items[m]];
          i = m;
        }
      }
      return top;
    },
  };
}

// Cheapest hallway from one door's outside tile to another's, avoiding
// `blocked` (every room's footprint, and the ring around the boss room).
// Bends cost extra and existing hallway is cheap, so hallways come out
// as long straight runs that join up. Returns the tiles, or null.
function routeHallway(from, to, blocked, corridors, gridSize) {
  const inBounds = (r, c) => r >= 0 && r < gridSize && c >= 0 && c < gridSize;
  const best = new Map();
  const heap = makeHeap();
  heap.push({ row: from.row, col: from.col, dir: -1, cost: 0, prev: null });
  while (heap.size) {
    const cur = heap.pop();
    if (cur.row === to.row && cur.col === to.col) {
      const cells = [];
      for (let n = cur; n; n = n.prev) cells.push({ row: n.row, col: n.col });
      return cells;
    }
    const sk = key(cur.row, cur.col) + ',' + cur.dir;
    if (best.has(sk) && best.get(sk) < cur.cost) continue;
    DIRS.forEach(([dr, dc], dir) => {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (!inBounds(nr, nc)) return;
      const nk = key(nr, nc);
      if (blocked.has(nk) && !(nr === to.row && nc === to.col)) return;
      const cost = cur.cost + (corridors.has(nk) ? REUSE_COST : 1) +
        (cur.dir !== -1 && cur.dir !== dir ? TURN_COST : 0);
      const nsk = nk + ',' + dir;
      if (best.has(nsk) && best.get(nsk) <= cost) return;
      best.set(nsk, cost);
      heap.push({ row: nr, col: nc, dir, cost, prev: cur });
    });
  }
  return null;
}

// Doors whose outside tile is on the grid and not blocked, i.e. that a
// hallway could actually reach.
function usableDoors(room, blocked, gridSize, allowExit) {
  return room.doors.filter(d => {
    const { row, col } = d.exit;
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return false;
    return !blocked.has(key(row, col)) || (allowExit && allowExit(d));
  });
}

// Tries door pairs between two rooms, closest first, until a hallway can
// be routed between them. `prefer` sorts some doors first (used for loop
// hallways, to open doors that aren't used yet).
function connect(a, b, blocked, corridors, gridSize, opts = {}) {
  const aDoors = usableDoors(a, blocked, gridSize);
  const bDoors = usableDoors(b, blocked, gridSize, opts.allowBExit);
  const pairs = [];
  for (const da of aDoors) {
    for (const db of bDoors) {
      const d = Math.abs(da.exit.row - db.exit.row) + Math.abs(da.exit.col - db.exit.col);
      const penalty = opts.penalty ? opts.penalty(da) + opts.penalty(db) : 0;
      pairs.push({ da, db, score: d + penalty });
    }
  }
  pairs.sort((x, y) => x.score - y.score);
  for (const { da, db } of pairs.slice(0, 6)) {
    const extraBlocked = opts.blockedFor ? opts.blockedFor(db) : blocked;
    const path = routeHallway(da.exit, db.exit, extraBlocked, corridors, gridSize);
    if (path) return { path, da, db };
  }
  return null;
}

// Finds every room floor tile that touches the outside world (a hallway
// or another room) — the boss room must end up with exactly one, its
// single entrance. Checked on the finished floor rather than trusted from
// the routing, so the boss always stands on the real way in.
function findRoomEntrances(floorSet, roomFloorTiles) {
  const entrances = [];
  for (const tileKey of roomFloorTiles) {
    const [r, c] = tileKey.split(',').map(Number);
    let touchesOutside = false;
    for (const [dr, dc] of DIRS) {
      const nk = key(r + dr, c + dc);
      if (floorSet.has(nk) && !roomFloorTiles.has(nk)) touchesOutside = true;
    }
    if (touchesOutside) entrances.push({ row: r, col: c });
  }
  return entrances;
}

function reachableFrom(start, floorSet) {
  const seen = new Set([key(start.row, start.col)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dr, dc] of DIRS) {
      const nk = key(cur.row + dr, cur.col + dc);
      if (!floorSet.has(nk) || seen.has(nk)) continue;
      seen.add(nk);
      queue.push({ row: cur.row + dr, col: cur.col + dc });
    }
  }
  return seen;
}

// Room floor that isn't a doorway, next to one, or a '?' spot — somewhere
// the player can start, or the stairs can sit, without blocking a way
// through.
function openInterior(room) {
  const avoid = new Set();
  [...room.openDoors, ...room.innerDoors].forEach(d => {
    avoid.add(key(d.row, d.col));
    DIRS.forEach(([dr, dc]) => avoid.add(key(d.row + dr, d.col + dc)));
  });
  room.slots.forEach(s => avoid.add(key(s.row, s.col)));
  return room.floorCells.filter(p => !avoid.has(key(p.row, p.col)));
}

// One attempt at building a dungeon. Returns null if something didn't fit
// (too few rooms placed, a hallway that couldn't be routed, the boss room
// not ending up with exactly one entrance), so the caller can try again.
function attemptGenerate(gridSize, chamberTarget) {
  const fits = (tpl) => tpl.h + 2 * EDGE_MARGIN <= gridSize && tpl.w + 2 * EDGE_MARGIN <= gridSize;

  // The player's room sits along the bottom edge, roughly centered.
  let startTpl = parseTemplate(randomTemplate());
  for (let i = 0; i < 20 && !fits(startTpl); i++) startTpl = parseTemplate(randomTemplate());
  if (!fits(startTpl)) return null;
  const startC0 = Math.floor((gridSize - startTpl.w) / 2) + randInt(-3, 3);
  const rooms = [placeRoom(startTpl, gridSize - startTpl.h - EDGE_MARGIN,
    Math.max(EDGE_MARGIN, Math.min(startC0, gridSize - startTpl.w - EDGE_MARGIN)))];

  for (let guard = 0; rooms.length < chamberTarget && guard < 300; guard++) {
    const tpl = parseTemplate(randomTemplate());
    if (!fits(tpl)) continue;
    const room = placeRoom(tpl,
      randInt(EDGE_MARGIN, gridSize - tpl.h - EDGE_MARGIN),
      randInt(EDGE_MARGIN, gridSize - tpl.w - EDGE_MARGIN));
    if (rooms.some(other => overlaps(room, other, CHAMBER_BUFFER))) continue;
    rooms.push(room);
  }
  if (rooms.length < 2) return null;

  // The boss always camps in whichever room sits farthest from the
  // player's.
  let bossIdx = 1;
  for (let i = 2; i < rooms.length; i++) {
    if (roomDist(rooms[i], rooms[0]) > roomDist(rooms[bossIdx], rooms[0])) bossIdx = i;
  }
  const bossRoom = rooms[bossIdx];

  // Hallways may not enter any room's footprint, nor the ring of tiles
  // hugging the boss room — so the only way a hallway can reach it is
  // straight into the one door picked for its entrance.
  const blocked = new Set();
  rooms.forEach(room => footprintKeys(room).forEach(k => blocked.add(k)));
  footprintKeys(bossRoom, 1).forEach(k => blocked.add(k));
  const corridors = new Set();
  const openExits = new Set();

  const carve = ({ path, da, db }) => {
    path.forEach(p => corridors.add(key(p.row, p.col)));
    openExits.add(key(da.exit.row, da.exit.col));
    openExits.add(key(db.exit.row, db.exit.col));
  };

  // Join every room to its nearest already-joined neighbour. The boss room
  // is never used as a starting point for reaching another room, so it
  // ends up with exactly one hallway — its single entrance.
  const connected = [0];
  while (connected.length < rooms.length) {
    let best = null;
    for (const ci of connected) {
      if (ci === bossIdx) continue;
      for (let cj = 0; cj < rooms.length; cj++) {
        if (connected.includes(cj)) continue;
        const d = roomDist(rooms[ci], rooms[cj]);
        if (!best || d < best.d) best = { ci, cj, d };
      }
    }
    if (!best) return null;
    const isBoss = best.cj === bossIdx;
    const opts = isBoss ? {
      allowBExit: () => true,
      blockedFor: (db) => {
        const b = new Set(blocked);
        b.delete(key(db.exit.row, db.exit.col));
        return b;
      },
    } : {};
    const hall = connect(rooms[best.ci], rooms[best.cj], blocked, corridors, gridSize, opts);
    if (!hall) return null;
    carve(hall);
    if (isBoss) blocked.delete(key(hall.db.exit.row, hall.db.exit.col));
    connected.push(best.cj);
  }

  // Extra hallways between rooms other than the boss's, preferring doors
  // nothing uses yet, so there's more than one route between areas. One
  // that can't be routed is simply skipped.
  const loopRooms = rooms.map((_, i) => i).filter(i => i !== bossIdx);
  const loops = Math.min(EXTRA_LOOPS_MAX, Math.max(0, loopRooms.length - 2));
  for (let i = 0; i < loops; i++) {
    const a = loopRooms[Math.floor(Math.random() * loopRooms.length)];
    const others = loopRooms.filter(j => j !== a);
    const b = others[Math.floor(Math.random() * others.length)];
    const hall = connect(rooms[a], rooms[b], blocked, corridors, gridSize, {
      penalty: d => openExits.has(key(d.exit.row, d.exit.col)) ? 12 : 0,
    });
    if (hall) carve(hall);
  }

  // A door stays open only if a hallway reaches the tile outside it
  // (planned or not); every other door is walled up.
  const floorSet = new Set(corridors);
  rooms.forEach(room => {
    const doorKeys = new Set(room.doors.map(d => key(d.row, d.col)));
    room.openDoors = room.doors.filter(d => corridors.has(key(d.exit.row, d.exit.col)));
    const openKeys = new Set(room.openDoors.map(d => key(d.row, d.col)));
    room.floorCells = room.floorCells.filter(p => {
      const k = key(p.row, p.col);
      return !doorKeys.has(k) || openKeys.has(k);
    });
    room.floorCells.forEach(p => floorSet.add(key(p.row, p.col)));
  });

  const bossFloorTiles = new Set(bossRoom.floorCells.map(p => key(p.row, p.col)));
  const realEntrances = findRoomEntrances(floorSet, bossFloorTiles);
  if (realEntrances.length !== 1) return null;

  const startOptions = openInterior(rooms[0]);
  if (startOptions.length === 0) return null;
  const start = startOptions[Math.floor(Math.random() * startOptions.length)];
  if (reachableFrom(start, floorSet).size !== floorSet.size) return null;

  // The boss stands exactly on its room's one real entrance tile,
  // physically blocking entry — defeating it (main.js sets state.boss =
  // null) is what opens the way to the stairs further inside.
  const spawn = realEntrances[0];

  // The stairs go somewhere in the far half of the boss room, away from
  // its door.
  const stairsOptions = openInterior(bossRoom)
    .map(p => ({ p, d: Math.abs(p.row - spawn.row) + Math.abs(p.col - spawn.col) }))
    .sort((x, y) => y.d - x.d);
  if (stairsOptions.length === 0) return null;
  const far = stairsOptions.slice(0, Math.max(1, Math.ceil(stairsOptions.length / 2)));
  const stairsCell = far[Math.floor(Math.random() * far.length)].p;

  const walls = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const k = key(r, c);
      if (!floorSet.has(k)) walls.add(k);
    }
  }

  const roomTiles = new Set();
  const chamberAt = new Map();
  const chambers = rooms.map((room, i) => {
    room.floorCells.forEach(p => {
      roomTiles.add(key(p.row, p.col));
      chamberAt.set(key(p.row, p.col), i);
    });
    return {
      floorCells: room.floorCells,
      doorKeys: new Set([...room.openDoors, ...room.innerDoors].map(d => key(d.row, d.col))),
      slots: room.slots,
      isBoss: i === bossIdx,
    };
  });

  return {
    walls, spawn, roomTiles, stairs: { row: stairsCell.row, col: stairsCell.col },
    start: { row: start.row, col: start.col }, chambers, chamberAt,
  };
}

// Builds a dungeon, retrying from scratch if an attempt didn't fit — rare
// enough that regenerating is simpler and more robust than trying to
// out-think every placement that could go wrong.
export function generateDungeonLayout(gridSize, chamberTarget) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const layout = attemptGenerate(gridSize, chamberTarget);
    if (layout) return layout;
  }
  // Extremely unlikely fallback: one plain room, boss at one end and the
  // stairs just past it, nothing left to get wrong.
  const size = Math.min(7, gridSize - 2);
  const r0 = Math.floor((gridSize - size) / 2);
  const walls = new Set();
  const floorCells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (r >= r0 && r < r0 + size && c >= r0 && c < r0 + size) floorCells.push({ row: r, col: c });
      else walls.add(key(r, c));
    }
  }
  const roomTiles = new Set(floorCells.map(p => key(p.row, p.col)));
  const chamberAt = new Map([...roomTiles].map(k => [k, 0]));
  return {
    walls, roomTiles, chamberAt,
    spawn: { row: r0, col: r0 + 1 },
    stairs: { row: r0, col: r0 },
    start: { row: r0 + size - 1, col: r0 + size - 1 },
    chambers: [{ floorCells, doorKeys: new Set(), slots: [], isBoss: true }],
  };
}
