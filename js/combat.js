// Pathfinding and combat/turn mechanics: adjacency, minion movement and
// spawning, and advancing a turn. Rules only — no page access. Functions
// that change what's on the map return what changed, and main.js draws it.

import { state, key } from './state.js';
import { MINION_KINDS, MINION_TRAIL_LENGTH, MINION_CHASE_RANGE, HUNTER_SPAWN_DELAY, HUNTER_REST_TURNS, HUNTER_REST_AFTER_MISS, SENSE_STEPS } from './config.js';
import { advanceLight } from './light.js';
import { tickLight } from './battery.js';
import { minionStrike, struggleDial } from './gun.js';
import { keptOut } from './relays.js';
import { canPassCorner } from './passage.js';
import { computeVisibility, FACING_VECTORS } from './sight.js';
import { waysInUse } from './look.js';

// True if `entity` stands on one of the tiles around the player: the 8
// around them (eight ways plan, call 4), apart from a diagonal a corner
// cuts off, so whatever can step onto the player can strike them, and the
// other way round; only the 4 beside them with DEV -> 8 ways off.
export function isAdjacentToPlayer(entity) {
  return neighbors(entity.row, entity.col).some(([r, c]) => r === state.floor.playerRow && c === state.floor.playerCol);
}

// Everything next to the player that opens the battle screen. With the
// gun on (DEV -> Combat), minions and the hunter are fought on the map, so
// they're left out. The chest opens it only when the
// player walks into it (moves.js reachItem), so walking past it never
// pulls the player into a question.
export function findAdjacentEnemies() {
  const result = [];
  // The boss is the gate (gate.js): only a bump opens it (moves.js), so
  // walking past it never starts a fight the player didn't choose.
  if (!state.settings.gunCombat) {
    for (const m of state.floor.minions) {
      if (isAdjacentToPlayer(m)) result.push(m);
    }
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
  if (state.floor.props.some(p => p.kind !== 'paper' && p.row === row && p.col === col)) return true;
  if (state.floor.boss && state.floor.boss.row === row && state.floor.boss.col === col) return true;
  if (state.floor.playerRow === row && state.floor.playerCol === col) return true;
  if (state.floor.chest && state.floor.chest.row === row && state.floor.chest.col === col) return true;
  for (const m of state.floor.minions) {
    if (m === excludeMinion) continue;
    if (m.row === row && m.col === col) return true;
  }
  return false;
}

// The order neighbors() tries the ways in: the grid ways first, in the
// order they were tried before the eight ways plan, so with 8 ways off a
// chase picks the same path as it always did.
const NEIGHBOR_ORDER = ['N', 'S', 'W', 'E', 'NE', 'SE', 'SW', 'NW'];

// The tiles a minion (or the hunter) can step to from (r, c): one step
// each way in use (look.js waysInUse: 8, or 4 with DEV -> 8 ways off),
// inside the grid, never cutting a corner (passage.js canPassCorner), the
// same rule as the player's. Paths, wandering and the warning all go
// through here.
export function neighbors(r, c) {
  const ways = waysInUse();
  return NEIGHBOR_ORDER.filter(way => ways.includes(way))
    .map(way => FACING_VECTORS[way])
    .filter(([dr, dc]) => canPassCorner(r, c, dr, dc))
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) => nr >= 0 && nr < state.floor.GRID_SIZE && nc >= 0 && nc < state.floor.GRID_SIZE);
}

// Walls, pillars, boxes, the boss, and every other minion's
// current tile, from one minion's point of view — so it paths around them instead of computing the same
// blocked step every turn. Minions are placed outside the boss chamber
// (loadRoom) and the boss holds its one doorway, so they never end up
// inside it. The chest doesn't block a chase — a monster paths straight
// through rather than getting stuck when it sits in a one-wide corridor;
// it's only an obstacle to the player.
export function blockedTilesFor(minion) {
  const blocked = new Set(state.floor.wallSet);
  keptOut(minion).forEach(k => blocked.add(k));
  state.floor.pillarSet.forEach(k => blocked.add(k));
  state.floor.props.forEach(p => { if (p.kind !== 'paper') blocked.add(key(p.row, p.col)); });
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
  state.floor.props.forEach(p => { if (p.kind !== 'paper') blocked.add(key(p.row, p.col)); });
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
// item, so an idle minion doesn't sit on top of the chest.
function wanderStep(m) {
  const out = keptOut(m);
  const options = neighbors(m.row, m.col)
    .filter(([r, c]) => !state.floor.wallSet.has(key(r, c)) && !out.has(key(r, c)) && !tileOccupied(r, c, m));
  if (options.length === 0) return null;
  const [row, col] = options[Math.floor(Math.random() * options.length)];
  return { row, col };
}

// Advances the room by one turn: the boss light spreads, minions move, and
// the turn counter increases. Called after any player action. Touches no
// page element; returns the events of the turn, in the order they happened,
// for main.js to draw: { type: 'hunterWoke', hunter }, { type: 'minionMoved',
// minion, from } (from = the tile it left, so the map can slide it) and
// { type: 'minionEngaged', minion }; with the gun on, a minion's strike
// instead, the hunter's too (gun.js minionStrike: minionStruck,
// knockedBack, signalLost). With no energy left, the first one to reach
// the player this turn starts a Struggle instead ({ type: 'struggleStarted',
// minion, hitHalf, sweepMs, count }: gun.js struggleDial, harder each time
// on a floor; settled by gun.js settleStruggle), unless `canStruggle` is
// false (a reload question already open over the map, in real time):
// then it strikes as usual. Last, { type: 'presenceSensed', minion } for
// each unseen one about to get next to the player (senseUnseen).
export function advanceMonsters({ canStruggle = true } = {}) {
  state.run.turnCount++;
  advanceLight();

  // In classic combat walking around is safe: a minion that reaches the
  // player never deals damage. It engages instead — it becomes the target,
  // which puts the battle screen up, and hearts are only ever lost by
  // missing a question. With the gun on, it strikes (so does the hunter),
  // and slow kinds only move every MINION_KINDS moveEvery turns. Minions roam freely and only
  // give chase once the player is within MINION_CHASE_RANGE walkable steps.
  const gun = state.settings.gunCombat;
  // The light's battery runs down or charges first (battery.js).
  const events = tickLight();
  if (state.floor.darkness) {
    state.floor.darkTurns++;
    const hunter = !state.floor.hunter && state.floor.darkTurns >= HUNTER_SPAWN_DELAY ? wakeHunter() : null;
    if (hunter) events.push({ type: 'hunterWoke', hunter });
  }
  for (const m of state.floor.minions) {
    // A slow kind's off turn comes first, so a rest (a stun) is only used
    // up on a turn it would really have moved.
    const stats = MINION_KINDS[m.minionKind];
    if (gun && stats && state.run.turnCount % stats.moveEvery !== 0) continue;
    if (m.rest > 0) {
      m.rest--;
      continue;
    }
    // A strike took the last stability: the run is over, nothing else moves.
    if (state.run.hearts <= 0) break;
    // A player inside a room held by a relay can't be reached from outside
    // it, not even from the doorway (bfsPath would let the last step in).
    const sheltered = keptOut(m).has(key(state.floor.playerRow, state.floor.playerCol));
    const path = sheltered ? null : bfsPath({ row: m.row, col: m.col }, { row: state.floor.playerRow, col: state.floor.playerCol }, blockedTilesFor(m));
    // In the darkness after the boss falls, every minion hunts, from anywhere.
    const chasing = path && (state.floor.darkness || path.length - 1 <= MINION_CHASE_RANGE);
    const next = chasing ? path[1] : wanderStep(m);
    if (next) {
      const isPlayerTile = next.row === state.floor.playerRow && next.col === state.floor.playerCol;

      const struggles = canStruggle && state.run.energy <= 0 && !state.battle.struggle;
      if (isPlayerTile && gun && struggles) {
        state.battle.struggle = { minion: m, ...struggleDial() };
        events.push({ type: 'struggleStarted', ...state.battle.struggle });
      } else if (isPlayerTile && gun) {
        events.push(...minionStrike(m));
      } else if (isPlayerTile) {
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
  if (state.run.hearts > 0) events.push(...senseUnseen());
  return events;
}

// The warning that lets a press turn and step at once: a minion or the
// hunter the player can't see, SENSE_STEPS walkable steps away and due to
// move next turn, will be right beside them after that move. Each one
// warns once per approach (`sensed`), and again only after it has been
// seen or has drifted off. Returns { type: 'presenceSensed', minion } per
// warning; main.js shows "I see you." once however many there are.
function senseUnseen() {
  const gun = state.settings.gunCombat;
  const player = { row: state.floor.playerRow, col: state.floor.playerCol };
  const events = [];
  for (const m of state.floor.minions) {
    const path = bfsPath({ row: m.row, col: m.col }, player, blockedTilesFor(m));
    const close = path && path.length - 1 <= SENSE_STEPS;
    if (!close || state.floor.visibleSet.has(key(m.row, m.col))) {
      m.sensed = false;
      continue;
    }
    if (m.sensed || m.rest > 0) continue;
    const stats = MINION_KINDS[m.minionKind];
    if (gun && stats && (state.run.turnCount + 1) % stats.moveEvery !== 0) continue;
    m.sensed = true;
    events.push({ type: 'presenceSensed', minion: m });
  }
  return events;
}
