// Dungeon generation: builds a small set of rooms from shape prefabs,
// joined by hallways that attach at each room's doorway tiles (not its
// center), picks a boss room, and guarantees that room has exactly one
// entrance.
//
// This module is self-contained — it takes the grid size and chamber
// target as plain arguments instead of reading shared game state, so it
// can be tested on its own with no dependency on the rest of the game.

import { key } from './state.js';

const CHAMBER_BUFFER = 2;        // empty tiles required between chambers

const SQUARE_RANGE = [2, 3];     // side length, low to high
const RECT_SHORT = 2;            // short side of a rectangle
const RECT_LONG_RANGE = [3, 4];  // long side of a rectangle, low to high

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function solidMask(h, w) {
  return new Array(h).fill('#'.repeat(w));
}

// Each builder returns a mask: an array of equal-length strings, '#' for
// floor and '.' for non-floor, describing one room shape relative to its
// own top-left corner. Square and rectangle are solid blocks (the classic
// shape); circle/diamond/plus trim corners or arms off the bounding box,
// which is what actually makes them read as a distinct shape once placed.
const SHAPE_BUILDERS = [
  () => {
    const s = randInt(SQUARE_RANGE[0], SQUARE_RANGE[1]);
    return solidMask(s, s);
  },
  () => {
    const long = randInt(RECT_LONG_RANGE[0], RECT_LONG_RANGE[1]);
    return Math.random() < 0.5 ? solidMask(RECT_SHORT, long) : solidMask(long, RECT_SHORT);
  },
  () => ['.###.', '#####', '#####', '#####', '.###.'],
  () => ['..#..', '.###.', '#####', '.###.', '..#..'],
  () => ['..#..', '..#..', '#####', '..#..', '..#..'],
];

// Picks, among a row/column of candidate indices, whichever sits closest
// to the given center — this is what turns "somewhere on this edge" into
// one specific doorway tile per side.
function nearestIndex(indices, center) {
  let best = null;
  let bestDist = Infinity;
  for (const i of indices) {
    const d = Math.abs(i - center);
    if (d < bestDist || (d === bestDist && i < best)) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

// A doorway candidate per cardinal direction, in mask-local coordinates.
// Every shape above has at least one floor tile on each of its four
// edges, so all four directions are always available.
function computeDoors(mask) {
  const h = mask.length;
  const w = mask[0].length;
  const topFloor = [];
  const bottomFloor = [];
  const leftFloor = [];
  const rightFloor = [];
  for (let c = 0; c < w; c++) {
    if (mask[0][c] === '#') topFloor.push(c);
    if (mask[h - 1][c] === '#') bottomFloor.push(c);
  }
  for (let r = 0; r < h; r++) {
    if (mask[r][0] === '#') leftFloor.push(r);
    if (mask[r][w - 1] === '#') rightFloor.push(r);
  }
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const nCol = nearestIndex(topFloor, cx);
  const sCol = nearestIndex(bottomFloor, cx);
  const wRow = nearestIndex(leftFloor, cy);
  const eRow = nearestIndex(rightFloor, cy);
  return {
    N: nCol == null ? null : [0, nCol],
    S: sCol == null ? null : [h - 1, sCol],
    W: wRow == null ? null : [wRow, 0],
    E: eRow == null ? null : [eRow, w - 1],
  };
}

// Places a mask with its top-left corner at (r0, c0) and resolves its
// floor tiles, doorway points, and center to absolute grid coordinates.
function placeMask(mask, r0, c0) {
  const floorCells = [];
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      if (mask[r][c] === '#') floorCells.push({ row: r0 + r, col: c0 + c });
    }
  }
  const localDoors = computeDoors(mask);
  const doors = {};
  for (const dir of ['N', 'E', 'S', 'W']) {
    const d = localDoors[dir];
    doors[dir] = d ? { row: r0 + d[0], col: c0 + d[1] } : null;
  }
  const h = mask.length;
  const w = mask[0].length;
  return {
    floorCells,
    doors,
    center: { row: r0 + (h - 1) / 2, col: c0 + (w - 1) / 2 },
  };
}

function randomPlacement(gridSize) {
  const mask = SHAPE_BUILDERS[Math.floor(Math.random() * SHAPE_BUILDERS.length)]();
  const h = mask.length;
  const w = mask[0].length;
  const r0 = randInt(0, gridSize - h);
  const c0 = randInt(0, gridSize - w);
  return placeMask(mask, r0, c0);
}

// Places a random shape so that one of its floor tiles lands exactly on
// `point` (used to guarantee the player's starting chamber contains their
// spawn tile). Retries with a new random shape/offset if a given attempt
// happens to put `point` on a trimmed corner instead of a floor tile.
function placementContaining(point, gridSize) {
  for (let tries = 0; tries < 40; tries++) {
    const mask = SHAPE_BUILDERS[Math.floor(Math.random() * SHAPE_BUILDERS.length)]();
    const h = mask.length;
    const w = mask[0].length;
    if (h > gridSize || w > gridSize) continue;
    let r0 = point.row - randInt(0, h - 1);
    r0 = Math.max(0, Math.min(r0, gridSize - h));
    let c0 = point.col - randInt(0, w - 1);
    c0 = Math.max(0, Math.min(c0, gridSize - w));
    const placement = placeMask(mask, r0, c0);
    if (placement.floorCells.some(p => p.row === point.row && p.col === point.col)) {
      return placement;
    }
  }
  const s = 2;
  const r0 = Math.max(0, Math.min(point.row, gridSize - s));
  const c0 = Math.max(0, Math.min(point.col, gridSize - s));
  return placeMask(solidMask(s, s), r0, c0);
}

// All grid cells within `buffer` tiles of any floor cell in the list.
function dilate(cells, buffer) {
  const set = new Set();
  for (const { row, col } of cells) {
    for (let dr = -buffer; dr <= buffer; dr++) {
      for (let dc = -buffer; dc <= buffer; dc++) {
        set.add(key(row + dr, col + dc));
      }
    }
  }
  return set;
}

// True if placing `placement` would put its floor within `buffer` tiles
// of any already-placed chamber's floor — checked against actual floor
// tiles rather than bounding boxes, so a trimmed corner on a circle or
// diamond doesn't falsely block (or allow) a neighboring room.
function overlapsAny(placement, existingChambers, buffer) {
  const dilated = dilate(placement.floorCells, buffer);
  return existingChambers.some(ch =>
    ch.floorCells.some(p => dilated.has(key(p.row, p.col))));
}

// Builds the tile list for a one-tile-wide, single-bend hallway between
// two points, without touching the floor set yet. horizontalFirst picks
// which of the two possible L-bends to use.
function corridorCells(a, b, horizontalFirst) {
  const cells = [];
  if (horizontalFirst) {
    const stepC = a.col <= b.col ? 1 : -1;
    for (let c = a.col; c !== b.col + stepC; c += stepC) cells.push([a.row, c]);
    const stepR = a.row <= b.row ? 1 : -1;
    for (let r = a.row; r !== b.row + stepR; r += stepR) cells.push([r, b.col]);
  } else {
    const stepR = a.row <= b.row ? 1 : -1;
    for (let r = a.row; r !== b.row + stepR; r += stepR) cells.push([r, a.col]);
    const stepC = a.col <= b.col ? 1 : -1;
    for (let c = a.col; c !== b.col + stepC; c += stepC) cells.push([b.row, c]);
  }
  return cells;
}

// True if any cell in the list sits inside, or touches the edge of, the
// given floor tile set — used to keep stray corridors from grazing the
// boss room's wall and accidentally giving it a second entrance.
function touchesFloor(cells, floorTiles) {
  return cells.some(([r, c]) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (floorTiles.has(key(r + dr, c + dc))) return true;
      }
    }
    return false;
  });
}

// Carve a one-tile-wide, single-bend hallway between two doorway points.
// If avoidFloorTiles is given, prefer whichever of the two possible bends
// does not touch it.
function carveCorridor(floorSet, a, b, avoidFloorTiles) {
  const optA = corridorCells(a, b, true);
  const optB = corridorCells(a, b, false);
  let chosen;
  if (avoidFloorTiles) {
    const aTouches = touchesFloor(optA, avoidFloorTiles);
    const bTouches = touchesFloor(optB, avoidFloorTiles);
    if (aTouches && !bTouches) chosen = optB;
    else if (bTouches && !aTouches) chosen = optA;
    else chosen = Math.random() < 0.5 ? optA : optB;
  } else {
    chosen = Math.random() < 0.5 ? optA : optB;
  }
  chosen.forEach(([r, c]) => floorSet.add(key(r, c)));
}

// Falls back to any available doorway (and, failing that, the room's own
// center) if the direction picked below happens to be unavailable — none
// of the current shapes hit this case, but it keeps future shapes safe.
function anyDoor(chamber) {
  for (const dir of ['N', 'E', 'S', 'W']) {
    if (chamber.doors[dir]) return chamber.doors[dir];
  }
  return chamber.center;
}

// Picks which doorway on each chamber should be used to connect them,
// based on which one is roughly north/south/east/west of the other.
function pickDoorPair(a, b) {
  const dRow = b.center.row - a.center.row;
  const dCol = b.center.col - a.center.col;
  let aDir;
  let bDir;
  if (Math.abs(dCol) >= Math.abs(dRow)) {
    aDir = dCol >= 0 ? 'E' : 'W';
    bDir = dCol >= 0 ? 'W' : 'E';
  } else {
    aDir = dRow >= 0 ? 'S' : 'N';
    bDir = dRow >= 0 ? 'N' : 'S';
  }
  return {
    aPoint: a.doors[aDir] || anyDoor(a),
    bPoint: b.doors[bDir] || anyDoor(b),
  };
}

function chamberDist(a, b) {
  return Math.abs(a.center.row - b.center.row) + Math.abs(a.center.col - b.center.col);
}

// Counts how many separate places a corridor touches the given room's
// floor tiles — the boss room must end up with exactly one, its single
// entrance. Two shapes' worth of L-bend hallway can, in rare geometries,
// each legally avoid the room individually yet still leave it with a
// second point of contact, so this checks the real result rather than
// trusting the avoidance heuristic used while carving.
function countRoomEntrances(floorSet, roomFloorTiles) {
  let entrances = 0;
  for (const tileKey of roomFloorTiles) {
    const [r, c] = tileKey.split(',').map(Number);
    let touchesOutside = false;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(r + dr, c + dc);
      if (floorSet.has(nk) && !roomFloorTiles.has(nk)) touchesOutside = true;
    }
    if (touchesOutside) entrances++;
  }
  return entrances;
}

// One attempt at building a dungeon: a handful of prefab-shaped rooms
// joined by hallways, with a couple of extra connections so there's more
// than one route between areas. Returns null if the boss room didn't end
// up with exactly one entrance, so the caller can just try again.
function attemptGenerate(playerPos, gridSize, chamberTarget) {
  const chambers = [placementContaining(playerPos, gridSize)];

  let guard = 0;
  while (chambers.length < chamberTarget && guard < 200) {
    guard++;
    const placement = randomPlacement(gridSize);
    if (overlapsAny(placement, chambers, CHAMBER_BUFFER)) continue;
    chambers.push(placement);
  }
  if (chambers.length < 2) chambers.push(placeMask(solidMask(2, 2), 0, 0));

  const floorSet = new Set();
  chambers.forEach(ch => ch.floorCells.forEach(p => floorSet.add(key(p.row, p.col))));

  // Snapshot of just the room tiles, before any hallway is carved. This
  // lets the caller tell rooms and hallways apart later, even though
  // both end up in the same floor set once corridors are added.
  const roomTiles = new Set(floorSet);

  // The boss always camps in whichever chamber sits farthest from the
  // player's. Pick it now, before any corridors are carved, so the
  // connection steps below can protect it from getting extra entrances.
  let spawnIdx = 1;
  let maxDist = -1;
  for (let i = 1; i < chambers.length; i++) {
    const d = chamberDist(chambers[i], chambers[0]);
    if (d > maxDist) { maxDist = d; spawnIdx = i; }
  }
  const bossChamber = chambers[spawnIdx];
  const bossFloorTiles = new Set(bossChamber.floorCells.map(p => key(p.row, p.col)));

  // Connect every chamber with a hallway from its nearest already-
  // connected neighbor's facing doorway to its own. The boss room is
  // never used as a source for reaching further chambers, so it ends up
  // with exactly one incoming corridor — its single entrance. Corridors
  // between two other chambers steer away from the boss room's floor, so
  // they never graze it and accidentally open a second way in.
  // Captured when the boss chamber's one incoming corridor is carved below —
  // this is the exact tile the boss stands on, physically blocking the
  // chamber's only entrance until it's defeated.
  let bossDoorway = null;

  const connected = [0];
  while (connected.length < chambers.length) {
    let best = null;
    for (const ci of connected) {
      if (ci === spawnIdx) continue;
      for (let cj = 0; cj < chambers.length; cj++) {
        if (connected.includes(cj)) continue;
        const d = chamberDist(chambers[ci], chambers[cj]);
        if (!best || d < best.d) best = { ci, cj, d };
      }
    }
    if (!best) break;
    const isBossEntrance = best.cj === spawnIdx;
    const { aPoint, bPoint } = pickDoorPair(chambers[best.ci], chambers[best.cj]);
    // Even the entrance corridor must avoid grazing the boss room anywhere
    // other than its own doorway — one of the two L-bends can otherwise clip
    // a second boss tile on its way in, silently opening a second entrance.
    const avoidTiles = isBossEntrance
      ? new Set([...bossFloorTiles].filter(k => k !== key(bPoint.row, bPoint.col)))
      : bossFloorTiles;
    carveCorridor(floorSet, aPoint, bPoint, avoidTiles);
    connected.push(best.cj);
    if (isBossEntrance) bossDoorway = bPoint;
  }

  // Extra loop corridors give the dungeon more than one route between
  // areas, for variety. The boss room is excluded entirely here — a
  // loop touching it would give it a second entrance.
  const loopCandidates = chambers.map((_, i) => i).filter(i => i !== spawnIdx);
  const extraLoops = Math.min(3, Math.max(0, loopCandidates.length - 1));
  for (let i = 0; i < extraLoops; i++) {
    const a = loopCandidates[Math.floor(Math.random() * loopCandidates.length)];
    let b = loopCandidates[Math.floor(Math.random() * loopCandidates.length)];
    if (b === a) b = loopCandidates[(loopCandidates.indexOf(a) + 1) % loopCandidates.length];
    const { aPoint, bPoint } = pickDoorPair(chambers[a], chambers[b]);
    carveCorridor(floorSet, aPoint, bPoint, bossFloorTiles);
  }

  const walls = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const k = key(r, c);
      if (!floorSet.has(k)) walls.add(k);
    }
  }

  if (countRoomEntrances(floorSet, bossFloorTiles) !== 1) return null;

  // The boss stands exactly on its chamber's one doorway tile, physically
  // blocking entry — defeating it (main.js sets state.boss = null) is what
  // opens the way to the stairs sitting further inside the same chamber.
  // bossDoorway is only ever null if the boss chamber somehow never got
  // connected above, which the entrance-count check just ruled out; the
  // anyDoor() fallback is defensive, not expected to ever trigger.
  const doorway = bossDoorway || anyDoor(bossChamber);
  const spawn = { row: doorway.row, col: doorway.col };

  const doorwayKey = key(spawn.row, spawn.col);
  const stairsCandidates = bossChamber.floorCells.filter(p => key(p.row, p.col) !== doorwayKey);
  const stairsCell = stairsCandidates.length > 0
    ? stairsCandidates[Math.floor(Math.random() * stairsCandidates.length)]
    : bossChamber.floorCells[0]; // defensive only — every shape has >=4 floor cells
  const stairs = { row: stairsCell.row, col: stairsCell.col };

  return { walls, spawn, roomTiles, stairs };
}

// Builds a small dungeon, retrying from scratch if the boss room didn't
// come out with exactly one entrance — a rare enough outcome that
// regenerating is simpler and more robust than trying to out-think every
// L-bend/shape combination that could cause it.
export function generateDungeonLayout(playerPos, gridSize, chamberTarget) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const layout = attemptGenerate(playerPos, gridSize, chamberTarget);
    if (layout) return layout;
  }
  // Extremely unlikely fallback: a single solid room around the player,
  // with no corridors at all, so there's nothing left to get wrong.
  const size = 3;
  const r0 = Math.max(0, Math.min(playerPos.row - 1, gridSize - size));
  const c0 = Math.max(0, Math.min(playerPos.col - 1, gridSize - size));
  const room = placeMask(solidMask(size, size), r0, c0);
  const roomTiles = new Set(room.floorCells.map(p => key(p.row, p.col)));
  const walls = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const k = key(r, c);
      if (!roomTiles.has(k)) walls.add(k);
    }
  }
  const spawn = { row: r0, col: c0 };
  const stairsCandidates = room.floorCells.filter(p => !(p.row === spawn.row && p.col === spawn.col));
  const stairsCell = stairsCandidates.length > 0 ? stairsCandidates[0] : room.floorCells[0];
  return { walls, spawn, roomTiles, stairs: { row: stairsCell.row, col: stairsCell.col } };
}
