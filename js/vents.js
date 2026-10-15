// Grates and the ducts between them (vents and noise plan,
// `ideas/vents-noise-plan.md` outside the repo; Timothy 2026-10-15, after
// Dead Space). Each floor gets up to VENT_PAIRS pairs of grates, each pair
// joining two rooms far apart on foot. The ducts belong to the stick men:
// the player walks over a grate but can't go in. floor.js buildFloor()
// calls placeVents(); moves.js stepPlayer() calls ventUnderfoot(). Later
// steps send noise and stick men through the ducts. No DOM access here.

import { state, key } from './state.js';
import { VENT_PAIRS, VENT_MIN_APART } from './config.js';
import { shuffle } from './quiz.js';

const STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

// The floor's grates: one spot in each room that may have one (never the
// start room, so the desk's room stays safe, nor the core), then rooms
// paired up whose spots are at least VENT_MIN_APART walking steps apart.
// A spot is room floor the placer would keep furniture off (no doorway,
// not beside one, not where the player starts), with nothing on it and
// not on a `taken` tile. Grates aren't solid, so the floor stays whole
// whatever is chosen. Fewer pairs when the floor can't fit them.
// Returns [{ row, col, pair, known: false }] (`pair` = the index of the
// other end in the list).
export function placeVents(layout, placer, taken, props) {
  const startKey = key(layout.start.row, layout.start.col);
  const used = new Set([...taken, ...props].map(p => key(p.row, p.col)));
  const free = p => {
    const k = key(p.row, p.col);
    return layout.roomTiles.has(k) && !used.has(k) && !placer.blocked.has(k) && !placer.reserved.has(k);
  };
  const spots = shuffle(layout.chambers.filter(ch => !ch.isBoss && !ch.floorCells.some(p => key(p.row, p.col) === startKey)))
    .map(ch => shuffle(ch.floorCells.filter(free))[0])
    .filter(Boolean);

  const vents = [];
  const paired = new Set();
  for (let i = 0; i < spots.length && vents.length < VENT_PAIRS * 2; i++) {
    if (paired.has(i)) continue;
    const dist = walkingSteps(spots[i], layout.walls);
    const j = spots.findIndex((p, n) => n > i && !paired.has(n) && dist.get(key(p.row, p.col)) >= VENT_MIN_APART);
    if (j === -1) continue;
    paired.add(i);
    paired.add(j);
    const at = vents.length;
    vents.push({ row: spots[i].row, col: spots[i].col, pair: at + 1, known: false });
    vents.push({ row: spots[j].row, col: spots[j].col, pair: at, known: false });
  }
  return vents;
}

// Walking steps from `from` to every floor tile, 8 ways, never cutting a
// wall's corner (the way stick men walk). A Map of tile key -> steps.
function walkingSteps(from, walls) {
  const dist = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of STEPS) {
      const row = cur.row + dr, col = cur.col + dc, k = key(row, col);
      if (dist.has(k) || walls.has(k)) continue;
      if (dr && dc && (walls.has(key(cur.row + dr, cur.col)) || walls.has(key(cur.row, cur.col + dc)))) continue;
      dist.set(k, d + 1);
      queue.push({ row, col });
    }
  }
  return dist;
}

// The grate at a tile, or null.
export function ventAt(row, col) {
  return state.floor.vents.find(v => v.row === row && v.col === col) || null;
}

// Stepping onto a grate says so, as part of the step: the player can't go
// in (the vents are theirs), but should notice the way they come.
// Returns [ventStepped] or [].
export function ventUnderfoot() {
  return ventAt(state.floor.playerRow, state.floor.playerCol) ? [{ type: 'ventStepped' }] : [];
}
