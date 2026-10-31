// Furnishing: gives each room on a floor a theme, then fills it with that
// theme's pillars, papers and boxes. Runs once per
// floor, on the layout from dungeon.js. No DOM access here — mapview.js
// draws the map pieces.
//
// Anything solid (pillars, boxes, and later the chest) is only put
// down where it keeps every open tile reachable and leaves something to
// stand beside it, so furniture can never wall off a door, a corridor, or
// the stairs. Papers are placed on the same rules (so they stay out of
// doorways and off each other), though in play anyone walks over them.

import { key, parseKey } from './state.js';
import { shuffle, randInt } from './random.js';
import { FOUR_STEPS } from './grid.js';
import {
  ROOM_THEMES, PILLARS_PER_ROOM, ROOM_PILLARS, ENERGY_CELL_ROOM_CHANCE, ENERGY_CELLS_MIN, PAPER_LORE_CHANCE, PAPERS_PER_ROOM, BOX_TRAP_CHANCE, BOX_LOOT, BOX_GOLD,
} from './config.js';
import { startRoom } from './desk.js';

// Picks a key from { name: weight } tables like BOX_LOOT.
function weighted(table) {
  const entries = Object.entries(table);
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [name, w] of entries) {
    roll -= w;
    if (roll < 0) return name;
  }
  return entries[entries.length - 1][0];
}

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

function hasWallNeighbour(p, walls) {
  return FOUR_STEPS.some(([dr, dc]) => walls.has(key(p.row + dr, p.col + dc)));
}

// Free-standing floor: nothing but floor on all eight sides. Also used by
// floor.js to stand THE UNFOLDING out in its room.
export function freeStanding(p, floorKeys) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!floorKeys.has(key(p.row + dr, p.col + dc))) return false;
    }
  }
  return true;
}

// Pillars come in mirrored sets (2 or 4) around the room's middle, so a
// room reads as built rather than cluttered. Free-standing tiles only —
// a pillar against a wall would just look like more wall.
function placePillars(chamber, placer, pillars) {
  const floorKeys = new Set(chamber.floorCells.map(p => key(p.row, p.col)));
  const rows = chamber.floorCells.map(p => p.row);
  const cols = chamber.floorCells.map(p => p.col);
  const midRow = Math.min(...rows) + Math.max(...rows);   // doubled, to stay whole numbers
  const midCol = Math.min(...cols) + Math.max(...cols);
  // Try the rolled size first, then smaller ones if it doesn't fit.
  const rolled = PILLARS_PER_ROOM[Math.floor(Math.random() * PILLARS_PER_ROOM.length)];
  const counts = PILLARS_PER_ROOM.filter(n => n <= rolled).sort((a, b) => b - a);
  const slotKeys = new Set(chamber.slots.map(p => key(p.row, p.col)));
  const candidates = shuffle(chamber.floorCells.filter(p => freeStanding(p, floorKeys) && !slotKeys.has(key(p.row, p.col))));
  for (const count of counts) {
    for (const p of candidates) {
      const set = [p, { row: midRow - p.row, col: midCol - p.col }];
      if (count === 4) set.push({ row: p.row, col: midCol - p.col }, { row: midRow - p.row, col: p.col });
      const unique = [...new Map(set.map(q => [key(q.row, q.col), q])).values()];
      if (unique.length !== count) continue;
      if (!unique.every(q => floorKeys.has(key(q.row, q.col)) && freeStanding(q, floorKeys))) continue;
      if (placer.tryBlock(unique, false)) {
        unique.forEach(q => pillars.add(key(q.row, q.col)));
        return;
      }
    }
  }
}

// The floor's energy cells: each room gets one at ENERGY_CELL_ROOM_CHANCE, then
// rooms without one are topped up until there are ENERGY_CELLS_MIN (fewer
// only if the rooms are too full to take more). Energy comes only from
// these, so a floor always has a few to find. Solid, on the furniture's
// rules (never in a hallway or doorway, never cutting the floor in two),
// and never on a `taken` tile (the coin, a beat's minion, the special item).
// Never in the safe room (saferoom.js): nothing refills there but the
// charger. Returns [{ row, col, kind: 'cell' }].
export function placeEnergyCells(layout, placer, taken) {
  const free = (cells) => cells.filter(p => !taken.some(q => q.row === p.row && q.col === p.col));
  const safe = startRoom(layout);
  const rooms = layout.chambers.filter(chamber => chamber !== safe);
  const boxes = [];
  const placeIn = (chamber) => {
    const spot = placer.pick(free(chamber.floorCells), true);
    if (spot) boxes.push({ ...spot, kind: 'cell' });
    return Boolean(spot);
  };
  const without = rooms.filter(chamber => !(Math.random() < ENERGY_CELL_ROOM_CHANCE && placeIn(chamber)));
  for (const chamber of shuffle(without)) {
    if (boxes.length >= ENERGY_CELLS_MIN) break;
    placeIn(chamber);
  }
  return boxes;
}

// Rolls what a paper or box holds: a paper is lore or junk, a box is
// trapped (a question for gold) or opens on the spot. beats.js uses it too,
// so a beat's paper or box is rolled like any other.
export function rollProp(kind, theme, floorIndex) {
  if (kind === 'paper') return { kind, theme, loot: Math.random() < PAPER_LORE_CHANCE ? 'lore' : 'junk' };
  const trapped = Math.random() < BOX_TRAP_CHANCE;
  const loot = trapped ? 'gold' : weighted(BOX_LOOT);
  const gold = loot === 'gold' ? randInt(BOX_GOLD[0], BOX_GOLD[1]) + floorIndex : 0;
  return { kind, theme, loot, gold, trapped };
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

// Themes and furniture for one floor.
//   themes: one ROOM_THEMES key per chamber (same order as layout.chambers)
//   pillars: Set of tile keys
//   props: [{ row, col, kind: 'paper'|'box', theme, loot, gold, trapped }],
//     after the plan's furniture (placeFurniture)
//   placer: for main.js to put the chest down on the same rules
export function furnishFloor(layout, gridSize, floorIndex) {
  const placer = makePlacer(layout, gridSize);
  const themeKeys = Object.keys(ROOM_THEMES);
  // Deal the themes out like cards so a floor gets a mix, not four crypts.
  let deck = [];
  const themes = layout.chambers.map(() => {
    if (deck.length === 0) deck = shuffle(themeKeys);
    return deck.pop();
  });

  const pillars = new Set();
  const props = placeFurniture(layout, placer);

  layout.chambers.forEach((chamber, i) => {
    const theme = themes[i];
    const cfg = ROOM_THEMES[theme];
    const propKind = () => (Math.random() < cfg.boxShare ? 'box' : 'paper');
    // A room holds at most PAPERS_PER_ROOM papers, so it can't be littered
    // with them and gives at most that many lines.
    let papers = 0;
    const roomFull = () => papers >= PAPERS_PER_ROOM;

    if (ROOM_PILLARS && Math.random() < cfg.pillarChance) placePillars(chamber, placer, pillars);

    // The drawing's '?' spots always get something: a box, once the room
    // has its papers.
    chamber.slots.forEach(s => {
      if (!placer.tryBlock([s], true)) return;
      const kind = roomFull() ? 'box' : propKind();
      if (kind === 'paper') papers++;
      props.push({ row: s.row, col: s.col, ...rollProp(kind, theme, floorIndex) });
    });

    // A few more, mostly against the walls, where furniture would stand.
    // One that rolls a paper the room has no room for is left out.
    const extra = randInt(cfg.props[0], cfg.props[1]);
    const byWall = chamber.floorCells.filter(p => hasWallNeighbour(p, layout.walls));
    const open = chamber.floorCells.filter(p => !hasWallNeighbour(p, layout.walls));
    for (let n = 0; n < extra; n++) {
      const kind = propKind();
      if (kind === 'paper' && roomFull()) continue;
      const pool = Math.random() < 0.75 && byWall.length ? byWall : open;
      const spot = placer.pick(pool, true);
      if (!spot) continue;
      if (kind === 'paper') papers++;
      props.push({ ...spot, ...rollProp(kind, theme, floorIndex) });
    }

  });

  return { themes, pillars, props, placer };
}
