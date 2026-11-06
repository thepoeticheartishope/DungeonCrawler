// Furnishing the ship: the plan's furniture (placeFurniture), put down on
// rules that keep every open tile reachable (makePlacer), so a piece can
// never wall off a door or a corridor. floor.js buildShipFloor() and
// stations.js use them. No DOM access here — roomview.js draws the pieces.

import { key, parseKey } from './state.js';
import { shuffle } from './random.js';
import { FOUR_STEPS } from './grid.js';

// Keeps track of what's solid on the floor and only lets something new
// be put down where the floor stays in one piece. `examinable` tiles are
// the ones the player reaches for from beside (papers, boxes, chest…) —
// each must keep at least one open neighbour.
//
// Nothing goes in a hallway: only on room floor, and never on a tile that
// is one wide (solid on both sides, left and right or above and below),
// like the gap into an alcove — there it would stand in the way even
// though a longer route around exists.
export function makePlacer(layout, gridSize) {
  const floor = new Set();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const k = key(r, c);
      if (!layout.walls.has(k)) floor.add(k);
    }
  }
  const blocked = new Set();
  const examinable = new Set();

  // Never solid: doorways and the tile either side of them, where the
  // player starts, the boss's door, the stairs and the keys.
  const reserved = new Set();
  layout.chambers.forEach(ch => ch.doorKeys.forEach(k => {
    reserved.add(k);
    const { row, col } = parseKey(k);
    FOUR_STEPS.forEach(([dr, dc]) => reserved.add(key(row + dr, col + dc)));
  }));
  // Every key spot on a fixed plan, not only this run's, so its furniture
  // stands the same every run. The ship has no boss's door or stairs.
  [layout.start, layout.spawn, layout.stairs, ...(layout.keys || []), ...(layout.keySpots || [])].filter(Boolean).forEach(p => reserved.add(key(p.row, p.col)));

  const startKey = key(layout.start.row, layout.start.col);

  const solid = (r, c) => !floor.has(key(r, c)) || blocked.has(key(r, c));
  const oneWide = (p) => (solid(p.row - 1, p.col) && solid(p.row + 1, p.col)) ||
    (solid(p.row, p.col - 1) && solid(p.row, p.col + 1));

  function stillConnected() {
    const seen = new Set([startKey]);
    const queue = [layout.start];
    while (queue.length) {
      const cur = queue.shift();
      for (const [dr, dc] of FOUR_STEPS) {
        const nk = key(cur.row + dr, cur.col + dc);
        if (!floor.has(nk) || blocked.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        queue.push({ row: cur.row + dr, col: cur.col + dc });
      }
    }
    if (seen.size !== floor.size - blocked.size) return false;
    for (const k of examinable) {
      const { row, col } = parseKey(k);
      if (!FOUR_STEPS.some(([dr, dc]) => seen.has(key(row + dr, col + dc)))) return false;
    }
    return true;
  }

  // Tries to make all of `tiles` solid at once; keeps them only if the
  // floor stays whole.
  function tryBlock(tiles, isExaminable) {
    const keys = tiles.map(p => key(p.row, p.col));
    if (keys.some(k => !floor.has(k) || blocked.has(k) || reserved.has(k))) return false;
    if (tiles.some(p => !layout.roomTiles.has(key(p.row, p.col)) || oneWide(p))) return false;
    keys.forEach(k => {
      blocked.add(k);
      if (isExaminable) examinable.add(k);
    });
    if (stillConnected()) return true;
    keys.forEach(k => {
      blocked.delete(k);
      examinable.delete(k);
    });
    return false;
  }

  return {
    blocked,
    reserved,
    tryBlock,
    // A random tile from `candidates` that can be made solid (and now
    // is), or null if none can.
    pick(candidates, isExaminable = true) {
      for (const p of shuffle(candidates)) {
        if (tryBlock([p], isExaminable)) return { row: p.row, col: p.col };
      }
      return null;
    },
  };
}

// A fixed plan's furniture (plans.js `furniture`, room view plan step E),
// put down before anything else so it stands the same every run: each
// piece's tiles become solid props of kind 'furniture' ({ piece, part }:
// 'single', or 'left' / 'mid' / 'right' along a wider one) if the floor
// stays whole and none of them is reserved (placer.tryBlock); otherwise the
// piece is left out. Furniture blocks walking but not the light, and a bump
// only says what it is.
export function placeFurniture(layout, placer) {
  const pieces = [];
  layout.chambers.forEach(chamber => (chamber.furniture || []).forEach(([piece, row, col, width = 1]) => {
    const tiles = [];
    for (let i = 0; i < width; i++) tiles.push({ row, col: col + i });
    if (!placer.tryBlock(tiles, false)) return;
    tiles.forEach((p, i) => {
      const part = width === 1 ? 'single' : i === 0 ? 'left' : i === width - 1 ? 'right' : 'mid';
      pieces.push({ row: p.row, col: p.col, kind: 'furniture', piece, part });
    });
  }));
  return pieces;
}
