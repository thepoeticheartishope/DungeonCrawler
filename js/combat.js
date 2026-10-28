// Pathfinding and combat/turn mechanics: adjacency, minion movement and
// spawning, and advancing a turn. Rules only — no page access. Functions
// that change what's on the map return what changed, and main.js draws it.

import { state, key } from './state.js';
import { MINION_KINDS, MINION_TRAIL_LENGTH, MINION_CHASE_RANGE, MINION_LIGHT_SIGHT, MINION_TRACK_TURNS, MINION_LINGER_TURNS, HUNTER_SPAWN_DELAY, HUNTER_REST_TURNS, HUNTER_REST_AFTER_MISS, SENSE_STEPS, DOWNED_SLOWDOWN, ONE_STICK, SAFE_ROOM } from './config.js';
import { advanceLight } from './light.js';
import { tickLight, drainLight, batteryInPlay, lightOn } from './battery.js';
import { minionStrike, struggleDial } from './gun.js';
import { keptOut } from './relays.js';
import { canPassCorner, solidProp } from './passage.js';
import { computeVisibility, clearLine, seesEnemy, hiddenFrom, FACING_VECTORS } from './sight.js';
import { waysInUse } from './look.js';
import { ductStep, crawlInto, crawlTurn } from './vents.js';
import { inSafeRoom, shutIn, liftShutters, lampLit } from './saferoom.js';

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
  if (state.floor.props.some(p => solidProp(p) && p.row === row && p.col === col)) return true;
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
  state.floor.props.forEach(p => { if (solidProp(p)) blocked.add(key(p.row, p.col)); });
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
// hunter to wake on or be thrown back to. The safe room's shutters don't
// count, so a player shut in it doesn't make the hunter wake inside; and
// never a tile of the safe room itself.
function farthestFromPlayer() {
  const blocked = new Set(state.floor.wallSet);
  state.floor.pillarSet.forEach(k => blocked.add(k));
  state.floor.props.forEach(p => { if (p.kind !== 'paper' && p.kind !== 'shutter') blocked.add(key(p.row, p.col)); });
  const start = { row: state.floor.playerRow, col: state.floor.playerCol };
  const dist = new Map([[key(start.row, start.col), 0]]);
  const queue = [start];
  let best = null;
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    if (d > 0 && !tileOccupied(cur.row, cur.col) && !inSafeRoom(cur.row, cur.col) && (!best || d > best.d)) best = { ...cur, d };
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
// be killed, so it gets no guard.
export function spawnMinion(spot, minionKind = 'SHARD') {
  const stats = MINION_KINDS[minionKind];
  const m = {
    row: spot.row, col: spot.col, kind: 'minion',
    minionKind: stats ? minionKind : null,
    guard: !!(stats && stats.guard), // the HUSK's: the first hit only breaks it (gun.js settleShot)
    trail: [],
    track: 0,      // turns it keeps searching once it reaches lastSeen with no sight of the player (0: never saw them, or lost them); combat.js notice
    lastSeen: null, // { row, col } where it last knew the player was, walked to while tracking; null once reached (lockOn)
    goal: null,    // { row, col } in another room it walks to while idle (idleStep); null when it has none
    linger: 0,     // turns it still stands at the goal it reached before picking the next
    drawn: false,  // it can see the player's light this turn
    gaze: 0,       // ms of the player's light on it so far, toward GAZE_MS (gaze.js)
    downed: false, // a shot in the dial's maim zone: it crawls at half speed and a bump finishes it (gun.js settleShot)
    grabbing: false, // downed, it reached the player and holds their ankle: they can't step away until it dies
    atDoor: null,   // { ms } it has stood at the safe room's open doorway, toward SAFE_ROOM.hesitateMs (combat.js hesitates)
    shutWait: null, // { ms } since the safe room's shutter shut it out, toward SAFE_ROOM.waitMs (shutOut)
    lifting: null,  // the hunter's { ms } with its hand on a shut shutter, toward SAFE_ROOM.hunterLiftMs (shutOut)
  };
  state.floor.minions.push(m);
  return m;
}

// How many turns apart `m` moves with the gun on: its kind's moveEvery
// (the hunter every turn), DOWNED_SLOWDOWN times that while it is down.
// The turn advance and the "I see you." warning both read it, so the
// warning waits for a downed one's real move.
export function movesEvery(m) {
  const stats = MINION_KINDS[m.minionKind];
  const every = stats ? stats.moveEvery : 1;
  return m.downed ? every * DOWNED_SLOWDOWN : every;
}

// A random free neighbouring floor tile for a wandering minion, or null if
// it's boxed in this turn. Unlike a chase, wandering never steps onto an
// item, so an idle minion doesn't sit on top of the chest. With
// `intoPlayer` (the light battery's rules) the player's tile is one of the
// choices: one that never saw them in the dark can still blunder into them.
function wanderStep(m, intoPlayer = false) {
  const out = keptOut(m);
  const isPlayer = (r, c) => intoPlayer && r === state.floor.playerRow && c === state.floor.playerCol;
  const options = neighbors(m.row, m.col)
    .filter(([r, c]) => !state.floor.wallSet.has(key(r, c)) && !out.has(key(r, c)) && (isPlayer(r, c) || !tileOccupied(r, c, m)));
  if (options.length === 0) return null;
  const [row, col] = options[Math.floor(Math.random() * options.length)];
  return { row, col };
}

// A stick man learns where the player is right now: it remembers the tile
// (`lastSeen`) and its search starts over (`track`). Its sight, a blunder
// into the player, a full eye (gaze.js) and a hurting dark shot (gun.js:
// it knows where the shot came from) all call this.
export function lockOn(m) {
  m.track = MINION_TRACK_TURNS;
  m.lastSeen = { row: state.floor.playerRow, col: state.floor.playerCol };
}

// A spot for an idle stick man to walk to: a random room other than the
// one it stands in, then a random free tile of that room it can reach.
// Rooms it can't reach (the core behind its gate, a held room) are never
// picked. A room is picked before a tile, so a big room isn't picked more
// often. Null if no other room can be reached (the tutorial's one room).
function pickGoal(m) {
  const f = state.floor;
  const blocked = blockedTilesFor(m);
  const own = f.chamberAt.get(key(m.row, m.col));
  const rooms = new Map();
  const seen = new Set([key(m.row, m.col)]);
  const queue = [{ row: m.row, col: m.col }];
  while (queue.length) {
    const cur = queue.shift();
    for (const [row, col] of neighbors(cur.row, cur.col)) {
      const k = key(row, col);
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push({ row, col });
      const room = f.chamberAt.get(k);
      if (room === undefined || room === own) continue;
      if (!rooms.has(room)) rooms.set(room, []);
      rooms.get(room).push({ row, col });
    }
  }
  const choices = [...rooms.values()];
  if (!choices.length) return null;
  const tiles = choices[Math.floor(Math.random() * choices.length)];
  return tiles[Math.floor(Math.random() * tiles.length)];
}

// An idle stick man's step: along the shortest way to its goal in another
// room, then it stands there MINION_LINGER_TURNS turns and picks the next.
// With no goal it can reach it falls back to a random step (wanderStep).
// Its way may run through the player's tile: with `intoPlayer` (the light
// battery's rules) it then blunders into them, as a random step can;
// without, it waits. Returns the next tile, or null to stand still.
function idleStep(m, intoPlayer) {
  if (m.linger > 0) {
    m.linger--;
    return null;
  }
  if (!m.goal) m.goal = pickGoal(m);
  if (!m.goal) return wanderStep(m, intoPlayer);
  const path = bfsPath({ row: m.row, col: m.col }, m.goal, blockedTilesFor(m));
  const next = path && path[1];
  const atGoal = next && next.row === m.goal.row && next.col === m.goal.col;
  if (!next || (atGoal && tileOccupied(next.row, next.col, m))) {
    m.goal = null;
    return wanderStep(m, intoPlayer);
  }
  const intoThem = next.row === state.floor.playerRow && next.col === state.floor.playerCol;
  if (intoThem && !intoPlayer) return null;
  if (atGoal) {
    m.goal = null;
    const [min, max] = MINION_LINGER_TURNS;
    m.linger = min + Math.floor(Math.random() * (max - min + 1));
  }
  return next;
}

// What a stick man knows (light battery plan step B), worked out each turn
// before it moves. Returns true while it has the player in view this turn.
// With the light on, a clear line within MINION_LIGHT_SIGHT tiles to the
// player or any tile their light is on draws it (`drawn`): the light leads
// back to the player, so it locks on to where they are. With the light
// off, one already tracking keeps locking on while it can see the player,
// and any can see them standing in the safe room's lit lamp; otherwise
// one that never saw them doesn't notice them, even right beside them.
// Out of view it walks to `lastSeen` without forgetting (smarter enemies,
// Timothy 2026-10-15: hiding and breaking the line should work, so it
// goes where it last saw them, not where they really are). Once there,
// `track` runs down a turn at a time while it searches, until it has
// lost them.
function sees(m, row, col) {
  return Math.hypot(row - m.row, col - m.col) <= MINION_LIGHT_SIGHT && clearLine(m.row, m.col, row, col);
}
function inView(m) {
  const f = state.floor;
  // In the safe room's lamp (saferoom.js), the player is lit with their
  // own light off.
  if (!lightOn()) return (m.track > 0 || lampLit(f.playerRow, f.playerCol)) && sees(m, f.playerRow, f.playerCol);
  return sees(m, f.playerRow, f.playerCol) ||
    [...f.sightSet].some(k => { const [row, col] = k.split(',').map(Number); return sees(m, row, col); });
}
function notice(m) {
  m.drawn = false;
  // Crouched behind cover from it (Timothy 2026-10-26), the player and
  // their light go unnoticed.
  if (inView(m) && !hiddenFrom(m.row, m.col)) {
    m.drawn = lightOn();
    lockOn(m);
    return true;
  }
  if (m.track > 0 && !m.lastSeen) m.track--;
  return false;
}

// A mistake's sound reached `m` (noise.js makeNoise): like being seen, it
// goes to where the sound was made (`origin`) and searches round there for
// MINION_TRACK_TURNS turns. One that has the player in view ignores it:
// seeing them wins. The hunter and the tutorial's stick man already come
// straight for the player, so they don't need to hear. Works in Comfort
// mode too (the rules stay, only the look is plain). Returns true if it
// heard.
export function hearNoise(m, origin) {
  if (m.kind === 'hunter' || m.hunts) return false;
  if (batteryInPlay() && inView(m)) return false;
  m.lastSeen = { row: origin.row, col: origin.col };
  m.track = MINION_TRACK_TURNS;
  m.goal = null;
  m.linger = 0;
  return true;
}

// Where a tracking stick man that can't see the player goes next: one step
// along the shortest way to `lastSeen`. Reaching it (or finding no way
// there, or the spot taken by another) clears `lastSeen`, so it searches
// round it from then on. Returns the next tile, or null when it searches.
function towardLastSeen(m) {
  const spot = m.lastSeen;
  const path = bfsPath({ row: m.row, col: m.col }, spot, blockedTilesFor(m));
  const next = path && path[1];
  const taken = next && next.row === spot.row && next.col === spot.col && tileOccupied(spot.row, spot.col, m);
  if (!next || taken) {
    m.lastSeen = null;
    return null;
  }
  if (next.row === spot.row && next.col === spot.col) m.lastSeen = null;
  return next;
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
// minion, zone, lapMs, count, phase }: gun.js struggleDial, harder each time
// on a floor; settled by gun.js settleStruggle), unless `canStruggle` is
// false (a reload question already open over the map, in real time):
// then it strikes as usual. A downed one (downed plan) that reaches the
// player neither strikes nor struggles: it grabs their ankle
// ({ type: 'ankleGrabbed', minion }) and holds on where it is. Stick men in a duct come first (vents.js
// crawlTurn: ventRattled, ventDropped), and a hunting one that fits may go
// into one (crawlInto: ventEntered). Last, { type: 'presenceSensed',
// minion } for each unseen one about to get next to the player
// (senseUnseen). With `minions` false (One stick: each stick man walks on
// its own clock, clockFrame) the world's beat leaves them out.
export function advanceMonsters({ canStruggle = true, minions = true } = {}) {
  state.run.turnCount++;
  advanceLight();

  // In classic combat walking around is safe: a minion that reaches the
  // player never deals damage. It engages instead — it becomes the target,
  // which puts the battle screen up, and hearts are only ever lost by
  // missing a question. With the gun on, it strikes (so does the hunter),
  // and slow kinds only move every MINION_KINDS moveEvery turns. Minions roam freely and only
  // give chase once they notice the player (notice: their light, or
  // tracking them in the dark), or in Comfort mode once the player is
  // within MINION_CHASE_RANGE walkable steps.
  // The light's battery runs down or charges first (battery.js); a light
  // that just died lights only the small circle for what follows.
  const events = tickLight();
  if (events.length) computeVisibility();
  const lightRules = batteryInPlay();
  if (state.floor.darkness) {
    state.floor.darkTurns++;
    const hunter = !state.floor.hunter && state.floor.darkTurns >= HUNTER_SPAWN_DELAY ? wakeHunter() : null;
    if (hunter) events.push({ type: 'hunterWoke', hunter });
  }
  // Stick men in a duct first (vents.js): the shudder, then the drop.
  // One that drops out moves from next turn.
  const dropped = crawlTurn();
  events.push(...dropped);
  const justOut = new Set(dropped.filter(e => e.type === 'ventDropped').map(e => e.minion));
  if (minions) {
    for (const m of state.floor.minions) {
      if (justOut.has(m)) continue;
      const moved = moveMinion(m, { canStruggle, lightRules });
      events.push(...moved.events);
      if (moved.over) break;
    }
  }
  tuckIntoDucts();
  computeVisibility();
  refreshTargetValidity();
  if (state.run.hearts > 0) events.push(...senseUnseen());
  return events;
}

// One stick man's move (the turn's, or one stick's own clock's,
// clockFrame): what it knows, then a step along a chase, a track, a
// search or its idle plan, a duct, or reaching the player. `everyTurn`
// (the shared turn) skips a slow kind's off turns; on its own clock the
// pace does that instead. `reach(m)` replaces reaching the player at once
// (one stick: it reaches first). `elapsedMs` is how long since its last
// move, for the safe room's waits (on the shared turn, SAFE_ROOM.turnMs a
// turn). Returns { events, chasing, over }: `over` when a strike took the
// last stability.
function moveMinion(m, { canStruggle = true, lightRules = batteryInPlay(), everyTurn = true, reach = null, elapsedMs = null } = {}) {
  const gun = state.settings.gunCombat;
  const events = [];
  const done = { events, chasing: false };
  // What it knows comes first, every turn, even one it won't move on.
  // The hunter keeps its own rule (new call 1): it isn't drawn by the light.
  const noticing = lightRules && m.kind !== 'hunter';
  const seen = noticing && notice(m);
  // Without the light's rules only a sound sets a stick man searching
  // (hearNoise): its search runs down the same way.
  if (!noticing && m.track > 0 && !m.lastSeen) m.track--;
  // A slow kind's off turn comes first, so a rest (a stun) is only used
  // up on a turn it would really have moved.
  // One holding the player's ankle stays put until it dies; one the
  // player is somehow no longer beside lets go.
  if (m.grabbing && isAdjacentToPlayer(m)) return done;
  m.grabbing = false;
  if (gun && everyTurn && state.run.turnCount % movesEvery(m) !== 0) return done;
  if (m.rest > 0) {
    m.rest--;
    return done;
  }
  // A strike took the last stability: the run is over, nothing else moves.
  if (state.run.hearts <= 0) return { ...done, over: true };
  const ms = elapsedMs ?? SAFE_ROOM.turnMs * (gun ? movesEvery(m) : 1);
  // The safe room shut with the player in it: to its shutter, then wait or
  // lift (shutOut).
  if (shutIn(state.floor.playerRow, state.floor.playerCol) && !inSafeRoom(m.row, m.col)) {
    const shut = shutOut(m, ms);
    if (shut) return shut;
  } else {
    m.shutWait = null;
    m.lifting = null;
  }
  // A player inside a room held by a relay can't be reached from outside
  // it, not even from the doorway (bfsPath would let the last step in).
  const sheltered = keptOut(m).has(key(state.floor.playerRow, state.floor.playerCol));
  const path = sheltered ? null : bfsPath({ row: m.row, col: m.col }, { row: state.floor.playerRow, col: state.floor.playerCol }, blockedTilesFor(m));
  // In the darkness after the boss falls, every minion hunts, from anywhere.
  const noticed = noticing ? seen : path && path.length - 1 <= MINION_CHASE_RANGE && !hiddenFrom(m.row, m.col);
  // The tutorial's stick man (m.hunts) always comes for the player.
  const chasing = path && (state.floor.darkness || noticed || m.hunts);
  // Out of view but tracking: to where it last saw them (or heard a
  // mistake, noise.js), then a search of random steps round there.
  const tracking = !chasing && m.kind !== 'hunter' && m.lastSeen && !sheltered;
  // Searching round where it last saw them: random steps. Otherwise idle:
  // off to another room (idleStep). A chase or a search drops the idle
  // plan, so it picks a fresh one once it has lost them.
  const searching = !chasing && m.kind !== 'hunter' && m.track > 0;
  if (chasing || tracking || searching) {
    m.goal = null;
    m.linger = 0;
  }
  // Hunting, one that fits takes a duct when it is quicker (vents.js):
  // into a grate now, or a step on the way to one.
  const duct = chasing ? ductStep(m, { row: state.floor.playerRow, col: state.floor.playerCol }) : tracking ? ductStep(m, m.lastSeen) : null;
  if (duct && duct.enter !== undefined) {
    events.push(...crawlInto(m, duct.enter));
    return { events, chasing: !!chasing };
  }
  if (duct && m.lastSeen && duct.step.row === m.lastSeen.row && duct.step.col === m.lastSeen.col) m.lastSeen = null;
  const next = duct ? duct.step : chasing ? path[1] : (tracking && towardLastSeen(m)) || (searching ? wanderStep(m, noticing) : idleStep(m, noticing));
  if (next && hesitates(m, next, ms)) return { events, chasing: !!chasing };
  if (next) {
    const isPlayerTile = next.row === state.floor.playerRow && next.col === state.floor.playerCol;
    // Reaching the player, even by blundering into them, it knows them.
    if (isPlayerTile && noticing) lockOn(m);

    if (isPlayerTile) {
      events.push(...(reach ? reach(m) : reachPlayer(m, { canStruggle })));
    } else {
      events.push(stepTo(m, next));
    }
  }
  // If next is null, this minion has no route around current
  // obstacles this turn — it waits rather than overlapping anything.
  return { events, chasing: !!chasing };
}

// `m` steps onto `next`, its last tiles kept for the map's trail.
// Event: minionMoved { minion, from } (from = the tile it left).
function stepTo(m, next) {
  const from = { row: m.row, col: m.col };
  m.row = next.row;
  m.col = next.col;
  m.trail = [...m.trail, from].slice(-MINION_TRAIL_LENGTH);
  return { type: 'minionMoved', minion: m, from };
}

// An open safe room (saferoom.js): a stick man whose next step takes it in
// from outside stops at the frame SAFE_ROOM.hesitateMs first, a moment for
// the player to pull the shutter (Timothy: an open door is not safe, but
// it gives them time). It stops there whether it chases, searches or only
// wanders in. The hunter doesn't stop. Returns true while it waits.
function hesitates(m, next, ms) {
  if (m.kind === 'hunter' || !inSafeRoom(next.row, next.col) || inSafeRoom(m.row, m.col)) {
    m.atDoor = null;
    return false;
  }
  if (!m.atDoor) {
    m.atDoor = { ms: 0 };
    return true;
  }
  m.atDoor.ms += ms;
  if (m.atDoor.ms < SAFE_ROOM.hesitateMs) return true;
  m.atDoor = null;
  return false;
}

// A stick man outside the safe room while it is shut with the player in
// it. One that doesn't know where they are goes about its business (null:
// moveMinion carries on). One that does (it saw or heard them) walks to
// the nearest shutter and stops at it; SAFE_ROOM.waitMs after the shutter
// first stopped it, it forgets them and wanders off (pickGoal never picks
// the shut room). The hunter walks there too and stands
// SAFE_ROOM.hunterLiftMs with its hand on the slats, then every shutter
// rolls up (saferoom.js liftShutters). `ms` = time since its last move.
// Returns { events, chasing } or null. Events: shutterWaited { minion },
// shutterGaveUp { minion }, shutterLifting { minion }, shutterLifted,
// minionMoved { minion, from }.
function shutOut(m, ms) {
  const hunter = m.kind === 'hunter';
  if (!hunter && !m.lastSeen && !(m.track > 0)) return null;
  const events = [];
  if (!hunter && !m.shutWait) {
    m.shutWait = { ms: 0 };
    events.push({ type: 'shutterWaited', minion: m });
  } else if (!hunter) {
    m.shutWait.ms += ms;
  }
  if (!hunter && m.shutWait.ms >= SAFE_ROOM.waitMs) {
    m.shutWait = null;
    m.lastSeen = null;
    m.track = 0;
    m.goal = null;
    m.linger = 0;
    return { events: [...events, { type: 'shutterGaveUp', minion: m }], chasing: false };
  }
  const next = towardShutter(m);
  if (next && !inSafeRoom(next.row, next.col)) return { events: [...events, stepTo(m, next)], chasing: true };
  if (!hunter || !next) return { events, chasing: true };
  if (!m.lifting) {
    m.lifting = { ms: 0 };
    return { events: [...events, { type: 'shutterLifting', minion: m }], chasing: true };
  }
  m.lifting.ms += ms;
  if (m.lifting.ms < SAFE_ROOM.hunterLiftMs) return { events, chasing: true };
  m.lifting = null;
  return { events: [...events, ...liftShutters()], chasing: true };
}

// The next tile on the shortest way from `m` to the player as if the safe
// room were open (its tiles count as free), or null with no way. The first
// tile of the room on it is the shutter `m` stops at.
function towardShutter(m) {
  const blocked = blockedTilesFor(m);
  state.floor.safeRoom.cells.forEach(k => blocked.delete(k));
  const path = bfsPath({ row: m.row, col: m.col }, { row: state.floor.playerRow, col: state.floor.playerCol }, blocked);
  return path && path[1];
}

// One stick (one stick plan steps C and D): a frame of the world in real
// time. The light's battery runs first, by time (battery.js drainLight).
// Then every stick man walks on its own
// clock, not on the world's shared turn. Each frame (`dtMs`) its wait runs
// down, and when it is up it moves (moveMinion) and waits again: a tile
// in ONE_STICK.wanderMs while idle, tracking or searching, chaseMs while
// it chases (a bit slower than the player walks, so they can get away),
// times its kind's moveEvery (a HUSK is slower) and a downed one's
// slowdown (movesEvery). Next to the player it doesn't strike at once: it
// reaches (startReach), and only lands if they are still within reach
// when the reach ends (reachOn): the answer to "hit from nowhere".
// Events: drainLight's (lightDied, lightCharged), moveMinion's, with each
// minionMoved given `ms` (its pace, for the map's slide),
// reachStarted { minion }, reachMissed { minion }, and reachPlayer's.
export function clockFrame(dtMs, { canStruggle = true } = {}) {
  const events = drainLight(dtMs);
  let changed = events.length > 0;
  const lightRules = batteryInPlay();
  for (const m of [...state.floor.minions]) {
    if (state.run.hearts <= 0) break;
    if (m.reaching) {
      const out = reachOn(m, dtMs, canStruggle);
      events.push(...out);
      changed = changed || out.length > 0;
      continue;
    }
    if (m.stepWait === undefined) m.stepWait = paceOf(m, false);
    m.stepWait -= dtMs;
    m.sinceMove = (m.sinceMove || 0) + dtMs;
    if (m.stepWait > 0) continue;
    const step = moveMinion(m, { canStruggle, lightRules, everyTurn: false, reach: startReach, elapsedMs: m.sinceMove });
    m.sinceMove = 0;
    const pace = paceOf(m, step.chasing);
    m.stepWait = pace;
    step.events.forEach(e => { if (e.type === 'minionMoved') e.ms = pace; });
    events.push(...step.events);
    changed = true;
    if (step.over) break;
  }
  if (!changed) return events;
  tuckIntoDucts();
  computeVisibility();
  refreshTargetValidity();
  return events;
}

// How long `m` takes over a tile on its own clock (clockFrame).
function paceOf(m, chasing) {
  return (chasing ? ONE_STICK.chaseMs : ONE_STICK.wanderMs) * movesEvery(m);
}

// `m` is next to the player and reaches for them (its tell): it stands
// for ONE_STICK.reachMs (a guarded HUSK's slower reachGuardMs) before its
// reach lands or misses (reachOn). Event: reachStarted { minion }.
function startReach(m) {
  const ms = m.guard ? ONE_STICK.reachGuardMs : ONE_STICK.reachMs;
  m.reaching = { left: ms, ms };
  return [{ type: 'reachStarted', minion: m }];
}

// A reach runs on by `dtMs`; once it is done, it lands (reachPlayer: a
// strike, a Struggle, a grab) if the player's free spot is still within
// ONE_STICK.reach tiles of its tile's centre and no relay holds them from
// it, or else misses. Either way it waits a chase step before it moves
// again. Events: none while it reaches, reachMissed { minion }, or
// reachPlayer's.
function reachOn(m, dtMs, canStruggle) {
  m.reaching.left -= dtMs;
  if (m.reaching.left > 0) return [];
  m.reaching = null;
  m.stepWait = paceOf(m, true);
  const f = state.floor;
  const at = f.playerAt && Math.floor(f.playerAt.x) === f.playerCol && Math.floor(f.playerAt.y) === f.playerRow
    ? f.playerAt : { x: f.playerCol + 0.5, y: f.playerRow + 0.5 };
  const far = Math.hypot(m.col + 0.5 - at.x, m.row + 0.5 - at.y) > ONE_STICK.reach;
  if (far || keptOut(m).has(key(f.playerRow, f.playerCol))) return [{ type: 'reachMissed', minion: m }];
  return reachPlayer(m, { canStruggle });
}

// The stick men that went into a duct leave the floor until they drop out
// (vents.js crawlTurn).
function tuckIntoDucts() {
  const gone = state.floor.minions.filter(m => m.vent);
  if (!gone.length) return;
  state.floor.minions = state.floor.minions.filter(m => !m.vent);
  state.floor.crawling.push(...gone);
}

// What `m` does on reaching the player's tile (it never takes the tile):
// a downed one grabs their ankle and holds on where it is; with the gun on,
// the first one to reach a player with no energy starts a Struggle (unless
// `canStruggle` is false), any other strikes (gun.js minionStrike); in
// classic combat it engages from where it stands. The turn advance and a
// lunge (lungeAt) both end here.
// Events: ankleGrabbed { minion }, struggleStarted { minion, zone, lapMs,
// count, phase }, minionStrike's, or minionEngaged { minion }.
export function reachPlayer(m, { canStruggle = true } = {}) {
  if (m.downed) {
    m.grabbing = true;
    return [{ type: 'ankleGrabbed', minion: m }];
  }
  if (!state.settings.gunCombat) {
    if (!state.battle.selectedTarget) state.battle.selectedTarget = m;
    return [{ type: 'minionEngaged', minion: m }];
  }
  if (canStruggle && state.run.energy <= 0 && !state.battle.struggle) {
    state.battle.struggle = { minion: m, ...struggleDial() };
    return [{ type: 'struggleStarted', ...state.battle.struggle }];
  }
  return minionStrike(m);
}

// A lunge (kill or maim plan: the dial stopped in a lunge zone, gun.js):
// `m` takes one step toward the player at once, out of turn, along the
// way it would chase them. A step onto the player is reaching them
// (reachPlayer). It goes nowhere with no way through, from outside a room
// a relay holds the player in, or while it already holds their ankle.
// Events: minionMoved { minion, from }, reachPlayer's (with One stick
// reachStarted { minion } instead), or none.
export function lungeAt(m) {
  const player = { row: state.floor.playerRow, col: state.floor.playerCol };
  if (m.grabbing || keptOut(m).has(key(player.row, player.col))) return [];
  const path = bfsPath({ row: m.row, col: m.col }, player, blockedTilesFor(m));
  if (!path || path.length < 2) return [];
  const next = path[1];
  // One stick: even a lunge reaches first, so no strike comes from nowhere.
  if (next.row === player.row && next.col === player.col) return state.settings.oneStick ? startReach(m) : reachPlayer(m);
  const moved = stepTo(m, next);
  computeVisibility();
  return [moved];
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
    if (!close || seesEnemy(m)) {
      m.sensed = false;
      continue;
    }
    if (m.sensed || m.rest > 0) continue;
    if (gun && (state.run.turnCount + 1) % movesEvery(m) !== 0) continue;
    m.sensed = true;
    events.push({ type: 'presenceSensed', minion: m });
  }
  return events;
}
