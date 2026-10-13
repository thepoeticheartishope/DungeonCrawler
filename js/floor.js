// Building a floor as data: layout, furniture, boss, stairs, the recipe's
// beats (beats.js), coin, the one special item and minions, plus the
// light, sight and camera that follow from them; and a rest floor's one
// quiet room (buildRestFloor). No page access — main.js loadRoom() calls
// one of them, then drawFloor() puts the result on the page.

import { state, key } from './state.js';
import { generateDungeonLayout, buildRestLayout } from './dungeon.js';
import { FLOOR_PLANS, buildPlanLayout } from './plans.js';
import { furnishFloor, rollProp, makePlacer, freeStanding, placeEnergyCells } from './decor.js';
import {
  CORE_KEYS, GATE_QUESTIONS, MINION_KIND_ORDER, MINION_MIN_START_DISTANCE, PAPERS_PER_ROOM, REST_GRID, REST_STAIRS_APART, ROOM_THEMES
} from './config.js';
import { floorRecipe, pickPaths, REST_RECIPES, restLore } from './floors.js';
import { shuffle } from './quiz.js';
import { BODY_ANGLES } from './look.js';
import { computeVisibility } from './sight.js';
import { spawnMinion } from './combat.js';
import { initBossLight } from './light.js';
import { placeBeats } from './beats.js';
import { rollGoals } from './goals.js';
import { placeRelays } from './relays.js';

// Picks a random open floor tile, avoiding walls and any tile in avoidList.
function pickCoinTile(walls, avoidList, allowedTiles) {
  const candidates = [];
  for (let r = 0; r < state.floor.GRID_SIZE; r++) {
    for (let c = 0; c < state.floor.GRID_SIZE; c++) {
      const k = key(r, c);
      if (walls.has(k)) continue;
      if (allowedTiles && !allowedTiles.has(k)) continue;
      if (avoidList.some(p => p.row === r && p.col === c)) continue;
      candidates.push({ row: r, col: c });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Walkable steps from the player's start to every tile they can reach
// without passing the boss — i.e. everything outside the boss chamber.
function stepsFromStart() {
  const blocked = new Set(state.floor.wallSet);
  state.floor.pillarSet.forEach(k => blocked.add(k));
  state.floor.props.forEach(p => { if (p.kind !== 'paper') blocked.add(key(p.row, p.col)); });
  blocked.add(key(state.floor.boss.row, state.floor.boss.col));
  const dist = new Map([[key(state.floor.PLAYER_START.row, state.floor.PLAYER_START.col), 0]]);
  const queue = [state.floor.PLAYER_START];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.floor.GRID_SIZE || nc < 0 || nc >= state.floor.GRID_SIZE) continue;
      const k = key(nr, nc);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return dist;
}

// The rest of the floor's minions (`count` of the recipe's, after any the
// beats placed), put on room tiles outside the boss chamber and at least MINION_MIN_START_DISTANCE steps
// from the player's start, so a room never opens with one in the player's
// face. Falls back to any free reachable room tile if a small room can't
// fit them that far away.
function placeMinions(roomTiles, takenTiles, count, recipe) {
  const dist = stepsFromStart();
  const isTaken = (k) => takenTiles.some(p => key(p.row, p.col) === k);
  const free = [...dist.keys()].filter(k => roomTiles.has(k) && !isTaken(k));
  const far = shuffle(free.filter(k => dist.get(k) >= MINION_MIN_START_DISTANCE));
  const near = shuffle(free.filter(k => dist.get(k) < MINION_MIN_START_DISTANCE && dist.get(k) >= 3));
  [...far, ...near].slice(0, count).forEach(k => {
    const [row, col] = k.split(',').map(Number);
    spawnMinion({ row, col }, nextMinionKind(recipe));
  });
}

// The kind of the next minion placed on this floor: the recipe's
// `minionKinds` in order, then MINION_KIND_ORDER round and round. Never
// random, so placing kinds draws no random numbers and a seeded run lays
// out the same floor as before kinds existed.
function nextMinionKind(recipe) {
  const placed = state.floor.minions.length;
  const named = recipe.minionKinds || [];
  return named[placed] || MINION_KIND_ORDER[placed % MINION_KIND_ORDER.length];
}

// Makes space for a beat's paper in its room. A room holds at most
// PAPERS_PER_ROOM papers (decor.js), and the beat's paper is the one the
// floor's pacing needs, so the room's own papers give way, oldest first.
function makeSpaceForPaper(paper) {
  const f = state.floor;
  const room = f.chamberAt.get(key(paper.row, paper.col));
  const inRoom = f.props.filter(p => p.kind === 'paper' && f.chamberAt.get(key(p.row, p.col)) === room);
  inRoom.slice(0, inRoom.length - PAPERS_PER_ROOM + 1).forEach(p => f.props.splice(f.props.indexOf(p), 1));
}

// A random floor (dungeon.js), sized by the recipe, for a recipe with no
// fixed plan.
function randomLayout(recipe) {
  return generateDungeonLayout(recipe.grid, recipe.rooms, recipe.loops,
    { startRoom: recipe.startRoom, bossRoom: recipe.bossRoom }, CORE_KEYS);
}

// The floor as data only: layout, furniture, boss, stairs, the recipe's
// beats, coin, the one special item and minions, plus the light, sight
// and camera that follow from them. No page access.
export function buildFloor() {
  state.run.floorsEntered++;
  // The way down the player chose at the last rest's stairs, if any.
  state.floor.path = state.run.nextPath;
  state.run.nextPath = null;
  state.floor.stairsAlt = null;
  const recipe = floorRecipe(state.run.roomIndex, state.floor.path);
  const plan = recipe.plan ? FLOOR_PLANS[recipe.plan] : null;
  // The floor's story joins the end of the run's queue, behind any lines
  // the player left unread upstairs, so no line is skipped.
  state.run.loreQueue.push(...(recipe.lore || []));

  state.floor.minions = [];
  state.floor.hunter = null;
  state.floor.gunTarget = null;
  state.battle.struggle = null; // a Struggle never carries over to a new floor
  state.floor.struggles = 0;    // and the dial is back to its easiest
  state.floor.misses = 0;
  state.floor.heldChambers = new Set();
  state.floor.relayTurnsWon = 0;
  state.floor.exchange = null; // THE UNFOLDING lives on rest floors only
  state.floor.darkTurns = 0;
  state.floor.props = [];
  state.floor.lastChoiceType = null;

  // A fixed plan (plans.js) is the same building every run; without one
  // the floor is random.
  const layout = plan ? buildPlanLayout(plan, CORE_KEYS) : randomLayout(recipe);
  state.floor.GRID_SIZE = plan ? plan.rows.length : recipe.grid;
  state.floor.CHAMBER_TARGET = layout.chambers.length;
  state.floor.plan = plan ? { name: plan.name, version: layout.version } : null;
  state.floor.wallSet = layout.walls;
  state.floor.PLAYER_START = { row: layout.start.row, col: layout.start.col };

  state.floor.playerRow = state.floor.PLAYER_START.row;
  state.floor.playerCol = state.floor.PLAYER_START.col;
  state.floor.facing = 'N';
  state.floor.look = BODY_ANGLES.N;

  // Each room's theme, pillars, papers and boxes (decor.js).
  const furnishing = furnishFloor(layout, state.floor.GRID_SIZE, state.run.roomIndex);
  state.floor.pillarSet = furnishing.pillars;
  state.floor.chamberAt = layout.chamberAt;
  state.floor.doorSet = doorTiles(layout);
  state.floor.chamberThemes = furnishing.themes;
  state.floor.chamberNames = plan ? layout.chambers.map(ch => ch.name) : [];
  state.floor.visitedChambers = new Set();
  furnishing.props.forEach(p => {
    state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
  });

  // The gate's full count; reachGate (gate.js) sets it again by the keys held.
  state.floor.boss = { row: layout.spawn.row, col: layout.spawn.col, hp: GATE_QUESTIONS[0], max: GATE_QUESTIONS[0], kind: 'boss' };
  state.floor.gateSealed = false;

  // The boss stands on the chamber's one doorway, so the stairs behind it
  // are unreachable until it's defeated and state.floor.boss is nulled.
  state.floor.stairs = { row: layout.stairs.row, col: layout.stairs.col };

  // The keys, each in its own room (dungeon.js picks which).
  state.floor.keys = layout.keys.map(p => ({ row: p.row, col: p.col }));
  state.floor.keySpots = (layout.keySpots || []).map(p => ({ row: p.row, col: p.col }));
  state.floor.keysHeld = 0;

  // Coin and the room's one special item only ever land in an actual room
  // tile, never a hallway — a hallway is one tile wide, so an object
  // sitting in one would force answering it (with a wrong-answer trap, for
  // a chest) just to get past. No fallback to non-room
  // tiles: if a room is too packed to fit one, it simply doesn't spawn.
  // The special item is solid, so it goes down on the same rules as the
  // furniture (never in a doorway, never cutting the floor in two).
  const roomTiles = layout.roomTiles;
  const placer = furnishing.placer;
  const fixedTiles = [state.floor.PLAYER_START, { row: state.floor.boss.row, col: state.floor.boss.col }, state.floor.stairs, ...state.floor.keys];

  // The recipe's beats go down first, along the walk to the boss, so the
  // random coin can't take their spots (beats.js).
  const beats = placeBeats(recipe.beats, layout, placer, fixedTiles);
  state.floor.beats = beats.placed;
  beats.props.forEach(p => {
    if (p.kind === 'paper') makeSpaceForPaper(p);
    state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
  });
  beats.minionTiles.forEach(p => spawnMinion(p, nextMinionKind(recipe)));

  const freeRoomTiles = new Set([...roomTiles].filter(k => !placer.blocked.has(k)));

  const takenTiles = [...fixedTiles, ...beats.minionTiles];
  const coinTile = pickCoinTile(state.floor.wallSet, takenTiles, freeRoomTiles);
  state.floor.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;

  if (state.floor.coin) takenTiles.push(state.floor.coin);

  // One special interactive extra per floor: the chest. Never more than
  // one, so the floor's one bonus/gamble stays meaningful instead of being
  // buried among several.
  state.floor.chest = null;

  const specialCandidates = [...freeRoomTiles]
    .map(k => { const [row, col] = k.split(',').map(Number); return { row, col }; })
    .filter(p => !takenTiles.some(q => q.row === p.row && q.col === p.col));
  const specialTile = beats.specialTile || placer.pick(specialCandidates);
  if (specialTile) state.floor.chest = { row: specialTile.row, col: specialTile.col, kind: 'chest' };

  const minionTaken = takenTiles.slice();
  if (state.floor.chest) minionTaken.push(state.floor.chest);

  // Energy cells, the only energy (decor.js placeEnergyCells). Classic
  // combat has no gun, so no cells.
  if (state.settings.gunCombat) {
    placeEnergyCells(layout, placer, minionTaken).forEach(p => {
      state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
      minionTaken.push(p);
    });
  }
  // Relays (relays.js), with either kind of combat.
  placeRelays(layout, placer, minionTaken).forEach(p => {
    state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
    minionTaken.push(p);
  });
  placeMinions(roomTiles, minionTaken, recipe.minions - beats.minionTiles.length, recipe);

  state.floor.darkness = false;
  initBossLight();
  rollGoals();
  state.floor.visibleSet = new Set();
  state.floor.exploredSet = new Set();
  computeVisibility();
  state.battle.selectedTarget = null;

  // The room the player wakes in counts as visited (drawFloor announces it).
  const startChamber = state.floor.chamberAt.get(key(state.floor.playerRow, state.floor.playerCol));
  if (startChamber !== undefined) state.floor.visitedChambers.add(startChamber);
}

// Clears everything dangerous a floor can hold, and the boss light's
// numbers, so nothing from the floor before reaches a rest floor. The
// budget is 1, not 0: lightProgress() divides by it.
function clearDanger() {
  const f = state.floor;
  f.boss = null;
  f.minions = [];
  f.hunter = null;
  f.gunTarget = null;
  state.battle.struggle = null;
  f.struggles = 0;
  f.misses = 0;
  f.path = null;
  f.stairsAlt = null;
  f.heldChambers = new Set();
  f.relayTurnsWon = 0;
  f.goals = [];
  f.darkness = false;
  f.darkTurns = 0;
  f.chest = null;
  f.lastChoiceType = null;
  f.beats = [];
  f.keys = [];
  f.keysHeld = 0;
  f.keySpots = [];
  f.keyRoute = 0;
  f.gateSealed = false;
  f.bossLitSet = new Set();
  f.bossDist = new Map();
  f.floorCount = 0;
  f.lightTurns = 0;
  f.lightTurnBudget = 1;
  f.lightFullRadius = 0;
  f.lightSlack = 0;
  f.lightLossShare = 0;
}

// A rest room's second stairs: a room tile off the doorways and off
// `avoid`, at least REST_STAIRS_APART steps (straight-line) from the first
// stairs and the start, so the two ways down read as two choices. Null if
// the room has no such tile.
function pickSecondStairs(layout, avoid) {
  const doors = doorTiles(layout);
  const apart = (p, q) => Math.abs(p.row - q.row) + Math.abs(p.col - q.col) >= REST_STAIRS_APART;
  const tiles = [...layout.roomTiles].filter(k => !doors.has(k)).map(k => {
    const [row, col] = k.split(',').map(Number);
    return { row, col };
  }).filter(p => !avoid.some(q => q.row === p.row && q.col === p.col) && apart(p, layout.stairs) && apart(p, layout.start));
  return tiles.length ? tiles[Math.floor(Math.random() * tiles.length)] : null;
}

// Where THE UNFOLDING stands on a rest floor: a room tile out in the open
// (floor on all eight sides) if there is one, so it reads as something
// standing in the room rather than furniture against a wall. makePlacer
// keeps it off the doorway, the start and the stairs, and away from
// anything that would cut the room in two. Never on a paper or the second
// stairs (`avoid`). Null only if
// no tile at all can hold it.
function placeExchange(layout, avoid) {
  const placer = makePlacer(layout, REST_GRID);
  const onPaper = p => avoid.some(q => q.row === p.row && q.col === p.col);
  const tiles = [...layout.roomTiles].map(k => {
    const [row, col] = k.split(',').map(Number);
    return { row, col };
  }).filter(p => !onPaper(p));
  const open = tiles.filter(p => freeStanding(p, layout.roomTiles));
  const at = placer.pick(open.length ? open : tiles);
  return at ? { row: at.row, col: at.col, kind: 'exchange' } : null;
}

// The way that faces from `from` toward `to` along the longer axis, so
// the player wakes on a rest floor looking into the room, not at the wall.
function facingToward(from, to) {
  const dr = to.row - from.row, dc = to.col - from.col;
  if (Math.abs(dr) >= Math.abs(dc)) return dr < 0 ? 'N' : 'S';
  return dc < 0 ? 'W' : 'E';
}

// Every doorway on a floor, as tile keys: each room's open doors and inner
// doors. Only the map uses them (an arch over each), so a way through
// reads from any side.
function doorTiles(layout) {
  return new Set(layout.chambers.flatMap(ch => [...ch.doorKeys]));
}

// A rest floor as data: one hand-drawn room (REST_RECIPES[kind].room) with
// the stairs, a coin, papers on the drawing's '?' spots and the rest's
// story lines queued for them. Nothing dangerous: no boss, light, minions,
// hunter, boxes or special, so a rest can never cost a heart. `kind` is 'opening', 'between' or 'epilogue'
// (run.js nextFloor()). No page access.
export function buildRestFloor(kind) {
  state.run.floorsEntered++;
  const f = state.floor;
  f.GRID_SIZE = REST_GRID;
  f.CHAMBER_TARGET = 1;
  f.plan = null;
  clearDanger();
  // A rest's story joins the queue like a depth's. The epilogue ends the
  // story, so its own line replaces whatever is left unread.
  if (kind === 'epilogue') state.run.loreQueue = [];
  state.run.loreQueue.push(...restLore(kind, state.run.roomIndex));

  const layout = buildRestLayout(REST_RECIPES[kind].room, REST_GRID);
  f.wallSet = layout.walls;
  f.PLAYER_START = { row: layout.start.row, col: layout.start.col };
  f.playerRow = f.PLAYER_START.row;
  f.playerCol = f.PLAYER_START.col;
  f.facing = facingToward(layout.start, layout.stairs);
  f.look = BODY_ANGLES[f.facing];

  const themeKeys = Object.keys(ROOM_THEMES);
  const theme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
  f.pillarSet = new Set();
  f.chamberAt = layout.chamberAt;
  f.doorSet = doorTiles(layout);
  f.chamberThemes = [theme];
  f.chamberNames = [];
  f.visitedChambers = new Set([0]);
  // Papers lie flat, so they need no placer: nobody is blocked by them.
  f.props = layout.chambers[0].slots.map(s => ({
    row: s.row, col: s.col, ...rollProp('paper', theme, state.run.roomIndex),
    identified: false, searched: false, sprung: false,
  }));

  f.stairs = { row: layout.stairs.row, col: layout.stairs.col };
  // A between-rest has two ways down (strategy plan step C): its own
  // stairs show where they lead, the second's way is hidden until scouted
  // at THE UNFOLDING.
  if (kind === 'between') {
    const [shown, hidden] = pickPaths();
    f.stairs.path = shown;
    const alt = pickSecondStairs(layout, [f.PLAYER_START, f.stairs, ...f.props]);
    if (alt) f.stairsAlt = { ...alt, path: hidden, hidden: true };
    else f.stairs.path = null;
  }
  f.exchange = placeExchange(layout, [...f.props, ...(f.stairsAlt ? [f.stairsAlt] : [])]);
  f.exchangeBought = new Set();
  const avoid = [f.PLAYER_START, f.stairs, ...f.props, ...(f.exchange ? [f.exchange] : []), ...(f.stairsAlt ? [f.stairsAlt] : [])];
  const coinTile = pickCoinTile(f.wallSet, avoid, layout.roomTiles);
  f.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;

  f.visibleSet = new Set();
  f.exploredSet = new Set();
  computeVisibility();
  state.battle.selectedTarget = null;
}
