// Beats: the recipe's ordered interactions along the walk from the player's
// start to the boss (floors.js `beats`, e.g. paper -> box -> minion ->
// special). buildFloor() in floor.js calls placeBeats() once the furniture
// is down. Each beat lands on a room tile beside its share of that walk,
// so the player meets them in the recipe's order. That is where a floor's
// pacing comes from (Timothy: pacing from interaction, not map shape).
// Whatever the recipe doesn't list stays random.
// No DOM access here.

import { state, key } from './state.js';
import { MINION_MIN_START_DISTANCE } from './config.js';
import { rollProp } from './decor.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// The beat kinds a recipe may list. Papers and boxes are extra furniture,
// a minion is one of the floor's own minions, and the special is the
// floor's one chest / rune / encounter.
export const BEAT_KINDS = ['paper', 'box', 'minion', 'special'];

// Solid beats stand one tile beside the walk, where the player sees them
// and can bump them without being made to walk around. Papers and minions
// go on the walk itself: a paper is read by stepping onto it, and a minion
// is meant to be met.
const BESIDE_THE_WALK = { paper: 0, box: 1, minion: 0, special: 1 };

// Tiles nobody walks through when the floor is built: walls, pillars and
// boxes. Papers lie flat, so they don't count.
function solidTiles() {
  const f = state.floor;
  const solid = new Set(f.wallSet);
  f.pillarSet.forEach(k => solid.add(k));
  f.props.forEach(p => { if (p.kind !== 'paper') solid.add(key(p.row, p.col)); });
  return solid;
}

// Open neighbours of a tile, inside the grid and not solid.
function openNeighbours(p, solid) {
  const size = state.floor.GRID_SIZE;
  return DIRS
    .map(([dr, dc]) => ({ row: p.row + dr, col: p.col + dc }))
    .filter(q => q.row >= 0 && q.row < size && q.col >= 0 && q.col < size && !solid.has(key(q.row, q.col)));
}

// Walkable steps from `from` to every tile it reaches. The boss's tile is
// reached but never walked through: it guards the only door into its room,
// so nothing behind it counts.
function stepsFrom(from, solid) {
  const f = state.floor;
  const bossKey = key(f.boss.row, f.boss.col);
  const steps = new Map([[key(from.row, from.col), 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const curKey = key(cur.row, cur.col);
    if (curKey === bossKey && steps.get(curKey) > 0) continue;
    openNeighbours(cur, solid).forEach(q => {
      const k = key(q.row, q.col);
      if (steps.has(k)) return;
      steps.set(k, steps.get(curKey) + 1);
      queue.push(q);
    });
  }
  return steps;
}

// Where along the walk from the start to the boss each tile lies. `at` is
// how far along, in steps of the shortest walk: a tile's steps from the
// start, as a share of its steps from the start plus its steps on to the
// boss. On the walk itself that is exactly the step it's on; a side room
// counts as far along as it is on the way. `off` is how far the player
// strays from the walk to reach it (half the detour: there and back).
// Only tiles the player can reach before the boss count.
function progressAlong(solid) {
  const f = state.floor;
  const fromStart = stepsFrom(f.PLAYER_START, solid);
  const toBoss = stepsFrom(f.boss, solid);
  const walk = fromStart.get(key(f.boss.row, f.boss.col));
  const progress = new Map();
  if (!walk) return { walk: 0, progress };
  fromStart.forEach((ds, k) => {
    const db = toBoss.get(k);
    if (db === undefined || db === 0) return;
    progress.set(k, { at: walk * ds / (ds + db), off: (ds + db - walk) / 2, fromStart: ds });
  });
  return { walk, progress };
}

// Room floor that nothing stands on yet, away from the doors. Beats never
// go in a hallway or a doorway: the walk leaves each room by a door, and a
// beat there would be the last thing in reach, crowding out the next one.
function isFreeRoomTile(k, ctx) {
  return ctx.roomTiles.has(k) && !ctx.nearDoor.has(k) && !ctx.placer.blocked.has(k) && !ctx.taken.has(k);
}

// Every doorway and the tiles beside it, as keys.
function tilesNearDoors(layout) {
  const near = new Set();
  layout.chambers.forEach(ch => ch.doorKeys.forEach(k => {
    const [row, col] = k.split(',').map(Number);
    near.add(k);
    DIRS.forEach(([dr, dc]) => near.add(key(row + dr, col + dc)));
  }));
  return near;
}

// The stretch of the walk that has room floor beside it, as [first, last]
// `at`. The last steps to the boss are usually a hallway, so aiming beats
// at the whole walk would leave the last ones nowhere to go.
function roomStretch(ctx) {
  const ats = [...ctx.progress].filter(([k]) => isFreeRoomTile(k, ctx)).map(([, where]) => where.at);
  return ats.length ? [Math.min(...ats), Math.max(...ats)] : null;
}

// Room tiles a beat of this kind may use, best first: nearest to its aim
// along the walk, then nearest to its wanted distance from the walk (which
// counts half: a step aside matters less than a step along). Only
// tiles no earlier than the previous beat, so the order always holds (two
// beats may share a stretch, in a small room). Ties are shuffled so the
// same recipe still gives different floors.
function candidatesFor(kind, target, afterAt, ctx) {
  const tiles = [];
  ctx.progress.forEach((where, k) => {
    if (where.at < afterAt || !isFreeRoomTile(k, ctx)) return;
    if (kind === 'minion' && where.fromStart < MINION_MIN_START_DISTANCE) return;
    const [row, col] = k.split(',').map(Number);
    tiles.push({ row, col, at: where.at, score: Math.abs(where.at - target) + Math.abs(where.off - BESIDE_THE_WALK[kind]) / 2 });
  });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.sort((a, b) => a.score - b.score);
}

// Puts one beat down on the best tile that takes it. Papers, boxes and the
// special go through the furniture placer, so they never wall anything
// off; a minion only needs a free tile. Returns the tile, or null.
function placeOne(kind, candidates, ctx) {
  if (kind === 'minion') return candidates[0] || null;
  return candidates.find(p => ctx.placer.tryBlock([p], true)) || null;
}

// Places the recipe's beats, in order, along the walk from the start to
// the boss. Beat i of n (from 0) aims at i/n of the stretch that has rooms
// beside it: the first is met near the start (the plan's paper in sight of
// the waking spot), and the last is left room before the stretch ends, so
// it isn't crowded out by the one before.
//   beats      list of BEAT_KINDS from the floor's recipe
//   layout     the floor's layout from dungeon.js (room tiles and doors)
//   placer     the floor's furniture placer (decor.js makePlacer)
//   taken      tiles already spoken for (start, boss, stairs)
// Returns what buildFloor() puts on the floor:
//   props        new papers and boxes, rolled like any other
//   specialTile  where the special goes, or null to place it at random
//   minionTiles  where some of the floor's minions start
//   placed       [{ kind, row, col, at }] every beat that found a tile
// A beat with no room left is skipped: a missing paper or box simply
// doesn't appear, and the special and minions go down at random as before.
export function placeBeats(beats, layout, placer, taken) {
  const result = { props: [], specialTile: null, minionTiles: [], placed: [] };
  if (!beats || beats.length === 0) return result;
  const { walk, progress } = progressAlong(solidTiles());
  if (walk < 2) return result;
  const ctx = {
    roomTiles: layout.roomTiles, nearDoor: tilesNearDoors(layout), placer, progress,
    taken: new Set(taken.map(p => key(p.row, p.col))),
  };
  const stretch = roomStretch(ctx);
  if (!stretch) return result;
  const [first, last] = stretch;
  let afterAt = 0;
  beats.forEach((kind, i) => {
    const target = first + (last - first) * i / beats.length;
    const tile = placeOne(kind, candidatesFor(kind, target, afterAt, ctx), ctx);
    if (!tile) return;
    afterAt = tile.at;
    const k = key(tile.row, tile.col);
    ctx.taken.add(k);
    result.placed.push({ kind, row: tile.row, col: tile.col, at: tile.at });
    if (kind === 'special') result.specialTile = { row: tile.row, col: tile.col };
    if (kind === 'minion') result.minionTiles.push({ row: tile.row, col: tile.col });
    if (kind === 'paper' || kind === 'box') {
      const theme = state.floor.chamberThemes[state.floor.chamberAt.get(k)];
      result.props.push({ row: tile.row, col: tile.col, ...rollProp(kind, theme, state.run.roomIndex) });
    }
  });
  return result;
}
