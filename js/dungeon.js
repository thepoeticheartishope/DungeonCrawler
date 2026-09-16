// Dungeon generation: builds a small set of rooms joined by hallways,
// picks a boss room, and guarantees that room has exactly one entrance.
//
// This module is self-contained — it takes the grid size and chamber
// target as plain arguments instead of reading shared game state, so it
// can be tested on its own with no dependency on the rest of the game.

import { key } from './state.js';

const SQUARE_RANGE = [2, 3];     // side length, low to high
const RECT_SHORT = 2;            // short side of a rectangle
const RECT_LONG_RANGE = [3, 4];  // long side of a rectangle, low to high
const CHAMBER_BUFFER = 2;        // empty tiles required between chambers

function rectsOverlap(a, b, buffer) {
  return !(a.c1 + buffer < b.c0 || b.c1 + buffer < a.c0 ||
    a.r1 + buffer < b.r0 || b.r1 + buffer < a.r0);
}

// Picks a chamber size. Half the time it is a square. Half the time it
// is a rectangle, in a random orientation (wide or tall).
function randomChamberSize() {
  if (Math.random() < 0.5) {
    const side = SQUARE_RANGE[0] + Math.floor(Math.random() * (SQUARE_RANGE[1] - SQUARE_RANGE[0] + 1));
    return { h: side, w: side };
  }
  const long = RECT_LONG_RANGE[0] + Math.floor(Math.random() * (RECT_LONG_RANGE[1] - RECT_LONG_RANGE[0] + 1));
  return Math.random() < 0.5 ? { h: RECT_SHORT, w: long } : { h: long, w: RECT_SHORT };
}

function randomRect(gridSize) {
  const { h, w } = randomChamberSize();
  const r0 = Math.floor(Math.random() * (gridSize - h + 1));
  const c0 = Math.floor(Math.random() * (gridSize - w + 1));
  return { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 };
}

function rectContaining(point, gridSize) {
  const { h, w } = randomChamberSize();
  let r0 = point.row - Math.floor(Math.random() * h);
  r0 = Math.max(0, Math.min(r0, gridSize - h));
  let c0 = point.col - Math.floor(Math.random() * w);
  c0 = Math.max(0, Math.min(c0, gridSize - w));
  return { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 };
}

function chamberCenter(rect) {
  return { row: Math.round((rect.r0 + rect.r1) / 2), col: Math.round((rect.c0 + rect.c1) / 2) };
}

function carveRect(floorSet, rect) {
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) floorSet.add(key(r, c));
  }
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

// True if any cell in the list sits inside, or touches the border of, rect.
function touchesRect(cells, rect) {
  return cells.some(([r, c]) =>
    r >= rect.r0 - 1 && r <= rect.r1 + 1 && c >= rect.c0 - 1 && c <= rect.c1 + 1);
}

// Carve a one-tile-wide, single-bend hallway between two points. If
// avoidRect is given, prefer whichever of the two possible bends does not
// touch it — this keeps stray corridors from grazing the boss room's wall
// and accidentally giving it a second entrance.
function carveCorridor(floorSet, a, b, avoidRect) {
  const optA = corridorCells(a, b, true);
  const optB = corridorCells(a, b, false);
  let chosen;
  if (avoidRect) {
    const aTouches = touchesRect(optA, avoidRect);
    const bTouches = touchesRect(optB, avoidRect);
    if (aTouches && !bTouches) chosen = optB;
    else if (bTouches && !aTouches) chosen = optA;
    else chosen = Math.random() < 0.5 ? optA : optB;
  } else {
    chosen = Math.random() < 0.5 ? optA : optB;
  }
  chosen.forEach(([r, c]) => floorSet.add(key(r, c)));
}

// Build a small dungeon: a handful of rooms joined by hallways, with a
// couple of extra connections so there's more than one route between areas.
export function generateDungeonLayout(playerPos, gridSize, chamberTarget) {
  const chambers = [rectContaining(playerPos, gridSize)];

  let guard = 0;
  while (chambers.length < chamberTarget && guard < 200) {
    guard++;
    const rect = randomRect(gridSize);
    if (chambers.some(ch => rectsOverlap(ch, rect, CHAMBER_BUFFER))) continue;
    chambers.push(rect);
  }
  if (chambers.length < 2) chambers.push({ r0: 0, c0: 0, r1: 1, c1: 1 });

  const floorSet = new Set();
  chambers.forEach(ch => carveRect(floorSet, ch));

  // Snapshot of just the room tiles, before any hallway is carved. This
  // lets the caller tell rooms and hallways apart later, even though
  // both end up in the same floor set once corridors are added.
  const roomTiles = new Set(floorSet);

  const centers = chambers.map(chamberCenter);

  // The boss always camps in whichever chamber sits farthest from the
  // player's. Pick it now, before any corridors are carved, so the
  // connection steps below can protect it from getting extra entrances.
  let spawnIdx = 1;
  let maxDist = -1;
  for (let i = 1; i < chambers.length; i++) {
    const d = Math.abs(centers[i].row - centers[0].row) + Math.abs(centers[i].col - centers[0].col);
    if (d > maxDist) { maxDist = d; spawnIdx = i; }
  }
  const bossRect = chambers[spawnIdx];

  // Connect every chamber with the shortest hallway to its nearest
  // already-connected neighbor. The boss room is never used as a source
  // for reaching further chambers, so it ends up with exactly one
  // incoming corridor — its single entrance. Corridors between two other
  // chambers steer away from the boss room's wall, so they never graze
  // it and accidentally open a second way in.
  const connected = [0];
  while (connected.length < chambers.length) {
    let best = null;
    for (const ci of connected) {
      if (ci === spawnIdx) continue;
      for (let cj = 0; cj < chambers.length; cj++) {
        if (connected.includes(cj)) continue;
        const d = Math.abs(centers[ci].row - centers[cj].row) + Math.abs(centers[ci].col - centers[cj].col);
        if (!best || d < best.d) best = { ci, cj, d };
      }
    }
    if (!best) break;
    const isBossEntrance = best.cj === spawnIdx;
    carveCorridor(floorSet, centers[best.ci], centers[best.cj], isBossEntrance ? null : bossRect);
    connected.push(best.cj);
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
    carveCorridor(floorSet, centers[a], centers[b], bossRect);
  }

  const walls = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const k = key(r, c);
      if (!floorSet.has(k)) walls.add(k);
    }
  }

  const spawnRect = chambers[spawnIdx];
  const spawn = {
    row: spawnRect.r0 + Math.floor(Math.random() * (spawnRect.r1 - spawnRect.r0 + 1)),
    col: spawnRect.c0 + Math.floor(Math.random() * (spawnRect.c1 - spawnRect.c0 + 1))
  };

  return { walls, spawn, roomTiles };
}
