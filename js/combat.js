// Pathfinding and combat/turn mechanics: adjacency, minion movement and
// spawning, and advancing a turn. Rules only — no page access. Functions
// that change what's on the map return what changed, and main.js draws it.

import { state, key } from './state.js';
import { MINION_KINDS, MINION_TRAIL_LENGTH, MINION_CHASE_RANGE, HUNTER_SPAWN_DELAY, HUNTER_REST_TURNS, HUNTER_REST_AFTER_MISS } from './config.js';
import { advanceLight } from './light.js';
import { computeVisibility } from './sight.js';

export function isAdjacentToPlayer(entity) {
  return Math.abs(entity.row - state.floor.playerRow) + Math.abs(entity.col - state.floor.playerCol) === 1;
}

export function findAdjacentEnemies() {
  const result = [];
  if (state.floor.boss && isAdjacentToPlayer(state.floor.boss)) result.push(state.floor.boss);
  for (const m of state.floor.minions) {
    if (isAdjacentToPlayer(m)) result.push(m);
  }
  if (state.floor.chest && isAdjacentToPlayer(state.floor.chest)) result.push(state.floor.chest);
  if (state.floor.rune && isAdjacentToPlayer(state.floor.rune)) result.push(state.floor.rune);
  for (const e of state.floor.encounters) {
    if (isAdjacentToPlayer(e)) result.push(e);
  }
  // A trapped box only becomes something to answer once it's been
  // bumped (main.js examineProp); until then it looks like any other.
  for (const p of state.floor.props) {
    if (p.sprung && isAdjacentToPlayer(p)) result.push(p);
  }
  return result;
}

// Drops the current target if it's no longer adjacent, then auto-picks an
// adjacent enemy if one is available and nothing is targeted. A manual tap
// on any other adjacent enemy always overrides this. The caller redraws
// the targeting.
export function refreshTargetValidity() {
  if (state.battle.selectedTarget && !isAdjacentToPlayer(state.battle.selectedTarget)) {
    state.battle.selectedTarget = null;
  }
  if (!state.battle.selectedTarget) {
    const adjacent = findAdjacentEnemies();
    if (adjacent.length > 0) state.battle.selectedTarget = adjacent[0];
  }
}

// True if any player, boss, minion, item or solid piece of furniture
// currently occupies this tile (papers lie flat, so they don't count).
export function tileOccupied(row, col, excludeMinion) {
  if (state.floor.pillarSet.has(key(row, col))) return true;
  if (state.floor.props.some(p => p.kind === 'box' && p.row === row && p.col === col)) return true;
  if (state.floor.boss && state.floor.boss.row === row && state.floor.boss.col === col) return true;
  if (state.floor.playerRow === row && state.floor.playerCol === col) return true;
  if (state.floor.chest && state.floor.chest.row === row && state.floor.chest.col === col) return true;
  if (state.floor.rune && state.floor.rune.row === row && state.floor.rune.col === col) return true;
  if (state.floor.encounters.some(e => e.row === row && e.col === col)) return true;
  for (const m of state.floor.minions) {
    if (m === excludeMinion) continue;
    if (m.row === row && m.col === col) return true;
  }
  return false;
}

export function neighbors(r, c) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([nr, nc]) => nr >= 0 && nr < state.floor.GRID_SIZE && nc >= 0 && nc < state.floor.GRID_SIZE);
}

// Walls, pillars, boxes, the boss, and every other minion's
// current tile, from one minion's point of view — so it paths around them instead of computing the same
// blocked step every turn. Minions are placed outside the boss chamber
// (loadRoom) and the boss holds its one doorway, so they never end up
// inside it. Items (chest, rune, encounters) don't block a chase — a
// monster paths straight through rather than getting stuck when one sits
// in a one-wide corridor; items are only obstacles to the player.
export function blockedTilesFor(minion) {
  const blocked = new Set(state.floor.wallSet);
  state.floor.pillarSet.forEach(k => blocked.add(k));
  state.floor.props.forEach(p => { if (p.kind === 'box') blocked.add(key(p.row, p.col)); });
  if (state.floor.boss) blocked.add(key(state.floor.boss.row, state.floor.boss.col));
  for (const other of state.floor.minions) {
    if (other === minion) continue;
    blocked.add(key(other.row, other.col));
  }
  return blocked;
}

// Shortest path between two tiles, avoiding walls. Returns array of {row,col} or null.
export function bfsPath(start, target, walls) {
  const startKey = key(start.row, start.col);
  const targetKey = key(target.row, target.col);
  if (startKey === targetKey) return [start];
  const visited = new Set([startKey]);
  const queue = [[start]];
  while (queue.length) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    for (const [nr, nc] of neighbors(cur.row, cur.col)) {
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      if (walls.has(k) && k !== targetKey) continue;
      visited.add(k);
      const newPath = path.concat([{ row: nr, col: nc }]);
      if (k === targetKey) return newPath;
      queue.push(newPath);
    }
  }
  return null;
}

// The free floor tile the most walkable steps from the player, for the
// hunter to wake on or be thrown back to.
function farthestFromPlayer() {
  const blocked = new Set(state.floor.wallSet);
  state.floor.pillarSet.forEach(k => blocked.add(k));
  state.floor.props.forEach(p => { if (p.kind === 'box') blocked.add(key(p.row, p.col)); });
  const start = { row: state.floor.playerRow, col: state.floor.playerCol };
  const dist = new Map([[key(start.row, start.col), 0]]);
  const queue = [start];
  let best = null;
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    if (d > 0 && !tileOccupied(cur.row, cur.col) && (!best || d > best.d)) best = { ...cur, d };
    for (const [nr, nc] of neighbors(cur.row, cur.col)) {
      const k = key(nr, nc);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return best;
}

// Returns the hunter, or null if there's nowhere for it to wake.
function wakeHunter() {
  const spot = farthestFromPlayer();
  if (!spot) return null;
  const m = spawnMinion(spot, null);
  m.kind = 'hunter';
  m.rest = 0;
  state.floor.hunter = m;
  return m;
}

// After its question is answered, the hunter loses the trail: back to the
// far side of the floor, where it waits a few turns before hunting again.
// Returns true if it was moved (the caller redraws it in place).
export function repelHunter(m, answeredRight) {
  const spot = farthestFromPlayer();
  if (spot) {
    m.row = spot.row;
    m.col = spot.col;
  }
  m.rest = answeredRight ? HUNTER_REST_TURNS : HUNTER_REST_AFTER_MISS;
  return !!spot;
}

// Places a minion of `minionKind` (a MINION_KINDS name) on `spot` (a free
// floor tile) — buildFloor picks the tiles and kinds. The map draws it from
// state (mapview.js). The hunter is made here too, with no kind: it can't
// be killed and has no limbs to lose, so it gets no hp and no limbs.
export function spawnMinion(spot, minionKind = 'SHARD') {
  const stats = MINION_KINDS[minionKind];
  const m = {
    row: spot.row, col: spot.col, kind: 'minion',
    minionKind: stats ? minionKind : null,
    hpLeft: stats ? stats.hp : null,
    limbs: stats ? stats.limbs : 0,
    trail: [],
  };
  state.floor.minions.push(m);
  return m;
}

// A random free neighbouring floor tile for a wandering minion, or null if
// it's boxed in this turn. Unlike a chase, wandering never steps onto an
// item, so an idle minion doesn't sit on top of a chest or rune.
function wanderStep(m) {
  const options = neighbors(m.row, m.col)
    .filter(([r, c]) => !state.floor.wallSet.has(key(r, c)) && !tileOccupied(r, c, m));
  if (options.length === 0) return null;
  const [row, col] = options[Math.floor(Math.random() * options.length)];
  return { row, col };
}

// Advances the room by one turn: the boss light spreads, minions move, and
// the turn counter increases. Called after any player action. Touches no
// page element; returns the events of the turn, in the order they happened,
// for main.js to draw: { type: 'hunterWoke', hunter }, { type: 'minionMoved',
// minion, from } (from = the tile it left, so the map can slide it) and
// { type: 'minionEngaged', minion }.
export function advanceMonsters() {
  state.run.turnCount++;
  advanceLight();

  // Walking around is safe: a minion that reaches the player never deals
  // damage here. It engages instead — it becomes the target, which puts the
  // battle screen up, and hearts are only ever lost by missing a question.
  // Minions roam freely and only give chase once the player is within
  // MINION_CHASE_RANGE walkable steps.
  const events = [];
  if (state.floor.darkness) {
    state.floor.darkTurns++;
    const hunter = !state.floor.hunter && state.floor.darkTurns >= HUNTER_SPAWN_DELAY ? wakeHunter() : null;
    if (hunter) events.push({ type: 'hunterWoke', hunter });
  }
  for (const m of state.floor.minions) {
    if (m.rest > 0) {
      m.rest--;
      continue;
    }
    const path = bfsPath({ row: m.row, col: m.col }, { row: state.floor.playerRow, col: state.floor.playerCol }, blockedTilesFor(m));
    // In the darkness after the boss falls, every minion hunts, from anywhere.
    const chasing = path && (state.floor.darkness || path.length - 1 <= MINION_CHASE_RANGE);
    const next = chasing ? path[1] : wanderStep(m);
    if (next) {
      const isPlayerTile = next.row === state.floor.playerRow && next.col === state.floor.playerCol;

      if (isPlayerTile) {
        // Engage from where it stands, never occupying the player's tile.
        if (!state.battle.selectedTarget) state.battle.selectedTarget = m;
        events.push({ type: 'minionEngaged', minion: m });
      } else {
        const from = { row: m.row, col: m.col };
        m.row = next.row;
        m.col = next.col;
        m.trail = [...m.trail, from].slice(-MINION_TRAIL_LENGTH);
        events.push({ type: 'minionMoved', minion: m, from });
      }
    }
    // If next is null, this minion has no route around current
    // obstacles this turn — it waits rather than overlapping anything.
  }

  computeVisibility();
  refreshTargetValidity();
  return events;
}
