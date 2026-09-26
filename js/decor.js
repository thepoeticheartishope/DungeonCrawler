// Furnishing: gives each room on a floor a theme, then fills it with that
// theme's pillars, papers and boxes and its floor texture. Runs once per
// floor, on the layout from dungeon.js. No DOM access here — main.js
// creates the map pieces and render.js draws them.
//
// Anything solid (pillars, papers, boxes, and later the chest/rune) is
// only put down where it keeps every open tile reachable and leaves
// something to stand beside it, so furniture can never wall off a door,
// a corridor, or the stairs.

import { key } from './state.js';
import {
  ROOM_THEMES, PILLARS_PER_ROOM, PAPER_LORE_CHANCE, BOX_LOOT, BOX_GOLD,
} from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseKey(k) {
  const [row, col] = k.split(',').map(Number);
  return { row, col };
}

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
  // player starts, the boss's door, and the stairs.
  const reserved = new Set();
  layout.chambers.forEach(ch => ch.doorKeys.forEach(k => {
    reserved.add(k);
    const { row, col } = parseKey(k);
    DIRS.forEach(([dr, dc]) => reserved.add(key(row + dr, col + dc)));
  }));
  [layout.start, layout.spawn, layout.stairs].forEach(p => reserved.add(key(p.row, p.col)));

  const startKey = key(layout.start.row, layout.start.col);

  function stillConnected() {
    const seen = new Set([startKey]);
    const queue = [layout.start];
    while (queue.length) {
      const cur = queue.shift();
      for (const [dr, dc] of DIRS) {
        const nk = key(cur.row + dr, cur.col + dc);
        if (!floor.has(nk) || blocked.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        queue.push({ row: cur.row + dr, col: cur.col + dc });
      }
    }
    if (seen.size !== floor.size - blocked.size) return false;
    for (const k of examinable) {
      const { row, col } = parseKey(k);
      if (!DIRS.some(([dr, dc]) => seen.has(key(row + dr, col + dc)))) return false;
    }
    return true;
  }

  // Tries to make all of `tiles` solid at once; keeps them only if the
  // floor stays whole.
  function tryBlock(tiles, isExaminable) {
    const keys = tiles.map(p => key(p.row, p.col));
    if (keys.some(k => !floor.has(k) || blocked.has(k) || reserved.has(k))) return false;
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
  return DIRS.some(([dr, dc]) => walls.has(key(p.row + dr, p.col + dc)));
}

// Free-standing floor: nothing but floor on all eight sides.
function freeStanding(p, floorKeys) {
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

function rollProp(kind, theme, floorIndex) {
  if (kind === 'paper') return { kind, theme, loot: Math.random() < PAPER_LORE_CHANCE ? 'lore' : 'junk' };
  const loot = weighted(BOX_LOOT);
  const gold = loot === 'gold' ? randInt(BOX_GOLD[0], BOX_GOLD[1]) + floorIndex : 0;
  return { kind, theme, loot, gold };
}

// Themes, furniture and floor texture for one floor.
//   themes: one ROOM_THEMES key per chamber (same order as layout.chambers)
//   pillars: Set of tile keys
//   props: [{ row, col, kind: 'paper'|'box', theme, loot, gold }]
//   marks: Map tile key -> theme key, for floor texture
//   placer: for main.js to put the chest/rune down on the same rules
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
  const props = [];
  const marks = new Map();

  layout.chambers.forEach((chamber, i) => {
    const theme = themes[i];
    const cfg = ROOM_THEMES[theme];
    const propKind = () => (Math.random() < cfg.boxShare ? 'box' : 'paper');

    if (Math.random() < cfg.pillarChance) placePillars(chamber, placer, pillars);

    // The drawing's '?' spots always get something.
    chamber.slots.forEach(s => {
      if (placer.tryBlock([s], true)) props.push({ row: s.row, col: s.col, ...rollProp(propKind(), theme, floorIndex) });
    });

    // A few more, mostly against the walls, where furniture would stand.
    const extra = randInt(cfg.props[0], cfg.props[1]);
    const byWall = chamber.floorCells.filter(p => hasWallNeighbour(p, layout.walls));
    const open = chamber.floorCells.filter(p => !hasWallNeighbour(p, layout.walls));
    for (let n = 0; n < extra; n++) {
      const pool = Math.random() < 0.75 && byWall.length ? byWall : open;
      const spot = placer.pick(pool, true);
      if (spot) props.push({ ...spot, ...rollProp(propKind(), theme, floorIndex) });
    }

    chamber.floorCells.forEach(p => {
      const k = key(p.row, p.col);
      if (!placer.blocked.has(k) && Math.random() < cfg.floorMark) marks.set(k, theme);
    });
  });

  return { themes, pillars, props, marks, placer };
}
