// Building a floor as data: layout, furniture, boss, stairs, the recipe's
// beats (beats.js), coin, the one special item and minions, plus the
// light, sight and camera that follow from them; and a rest floor's one
// quiet room (buildRestFloor). No page access — main.js loadRoom() calls
// one of them, then drawFloor() puts the result on the page.

import { state, key } from './state.js';
import { generateDungeonLayout, buildRestLayout } from './dungeon.js';
import { furnishFloor, rollProp, makePlacer, freeStanding } from './decor.js';
import {
  BOSS_HP, MINION_MIN_START_DISTANCE, PAPERS_PER_ROOM, REST_GRID, ROOM_THEMES
} from './config.js';
import { floorRecipe, REST_RECIPES, restLore } from './floors.js';
import { shuffle } from './quiz.js';
import { computeVisibility, updateCamera } from './sight.js';
import { spawnMinion } from './combat.js';
import { initBossLight } from './light.js';
import { placeBeats } from './beats.js';

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
  state.floor.props.forEach(p => { if (p.kind === 'box') blocked.add(key(p.row, p.col)); });
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
function placeMinions(roomTiles, takenTiles, count) {
  const dist = stepsFromStart();
  const isTaken = (k) => takenTiles.some(p => key(p.row, p.col) === k);
  const free = [...dist.keys()].filter(k => roomTiles.has(k) && !isTaken(k));
  const far = shuffle(free.filter(k => dist.get(k) >= MINION_MIN_START_DISTANCE));
  const near = shuffle(free.filter(k => dist.get(k) < MINION_MIN_START_DISTANCE && dist.get(k) >= 3));
  [...far, ...near].slice(0, count).forEach(k => {
    const [row, col] = k.split(',').map(Number);
    spawnMinion({ row, col });
  });
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

// The floor as data only: layout, furniture, boss, stairs, the recipe's
// beats, coin, the one special item and minions, plus the light, sight
// and camera that follow from them. No page access.
export function buildFloor() {
  state.run.floorsEntered++;
  const recipe = floorRecipe(state.run.roomIndex);
  state.floor.GRID_SIZE = recipe.grid;
  state.floor.CHAMBER_TARGET = recipe.rooms;
  // The floor's story joins the end of the run's queue, behind any lines
  // the player left unread upstairs, so no line is skipped.
  state.run.loreQueue.push(...(recipe.lore || []));

  state.floor.minions = [];
  state.floor.hunter = null;
  state.floor.exchange = null; // THE UNFOLDING lives on rest floors only
  state.floor.darkTurns = 0;
  state.floor.encounters = [];
  state.floor.props = [];
  state.floor.runeHint = null;
  state.floor.lastChoiceType = null;

  const layout = generateDungeonLayout(state.floor.GRID_SIZE, state.floor.CHAMBER_TARGET, recipe.loops,
    { startRoom: recipe.startRoom, bossRoom: recipe.bossRoom });
  state.floor.wallSet = layout.walls;
  state.floor.PLAYER_START = { row: layout.start.row, col: layout.start.col };

  state.floor.playerRow = state.floor.PLAYER_START.row;
  state.floor.playerCol = state.floor.PLAYER_START.col;
  state.floor.facing = 'N';
  updateCamera();

  // Each room's theme, pillars, papers and boxes (decor.js).
  const furnishing = furnishFloor(layout, state.floor.GRID_SIZE, state.run.roomIndex);
  state.floor.pillarSet = furnishing.pillars;
  state.floor.chamberAt = layout.chamberAt;
  state.floor.doorSet = doorTiles(layout);
  state.floor.chamberThemes = furnishing.themes;
  state.floor.visitedChambers = new Set();
  furnishing.props.forEach(p => {
    state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
  });

  state.floor.boss = { row: layout.spawn.row, col: layout.spawn.col, hp: BOSS_HP, kind: 'boss' };

  // The boss stands on the chamber's one doorway, so the stairs behind it
  // are unreachable until it's defeated and state.floor.boss is nulled.
  state.floor.stairs = { row: layout.stairs.row, col: layout.stairs.col };

  // Coin and the room's one special item only ever land in an actual room
  // tile, never a hallway — a hallway is one tile wide, so an object
  // sitting in one would force answering it (with a wrong-answer trap, for
  // a chest/rune/encounter) just to get past. No fallback to non-room
  // tiles: if a room is too packed to fit one, it simply doesn't spawn.
  // The special item is solid, so it goes down on the same rules as the
  // furniture (never in a doorway, never cutting the floor in two).
  const roomTiles = layout.roomTiles;
  const placer = furnishing.placer;
  const fixedTiles = [state.floor.PLAYER_START, { row: state.floor.boss.row, col: state.floor.boss.col }, state.floor.stairs];

  // The recipe's beats go down first, along the walk to the boss, so the
  // random coin can't take their spots (beats.js).
  const beats = placeBeats(recipe.beats, layout, placer, fixedTiles);
  state.floor.beats = beats.placed;
  beats.props.forEach(p => {
    if (p.kind === 'paper') makeSpaceForPaper(p);
    state.floor.props.push({ ...p, identified: false, searched: false, sprung: false });
  });
  beats.minionTiles.forEach(p => spawnMinion(p));

  const freeRoomTiles = new Set([...roomTiles].filter(k => !placer.blocked.has(k)));

  const takenTiles = [...fixedTiles, ...beats.minionTiles];
  const coinTile = pickCoinTile(state.floor.wallSet, takenTiles, freeRoomTiles);
  state.floor.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;

  if (state.floor.coin) takenTiles.push(state.floor.coin);

  // Exactly one special interactive extra per room — a chest, a rune, or a
  // single category encounter, picked at random from whichever are
  // eligible. Never more than one at once, so the room's one bonus/gamble
  // stays meaningful instead of being buried among several.
  state.floor.chest = null;
  state.floor.rune = null;

  const byCategory = new Map();
  state.settings.activeData.forEach(item => {
    if (!item.category) return;
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  });

  const specialCandidates = [...freeRoomTiles]
    .map(k => { const [row, col] = k.split(',').map(Number); return { row, col }; })
    .filter(p => !takenTiles.some(q => q.row === p.row && q.col === p.col));
  const specialTile = beats.specialTile || placer.pick(specialCandidates);
  if (specialTile) {
    const candidates = [
      { type: 'chest' },
      { type: 'rune' },
      ...Array.from(byCategory.keys()).map(category => ({ type: 'encounter', category })),
    ];
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (chosen.type === 'chest') {
      state.floor.chest = { row: specialTile.row, col: specialTile.col, kind: 'chest' };
    } else if (chosen.type === 'rune') {
      state.floor.rune = { row: specialTile.row, col: specialTile.col, kind: 'rune' };
    } else {
      state.floor.encounters.push({
        row: specialTile.row, col: specialTile.col, kind: 'encounter',
        category: chosen.category, pool: byCategory.get(chosen.category),
      });
    }
  }

  const minionTaken = takenTiles.slice();
  [state.floor.chest, state.floor.rune, ...state.floor.encounters].forEach(item => { if (item) minionTaken.push(item); });
  placeMinions(roomTiles, minionTaken, recipe.minions - beats.minionTiles.length);

  state.floor.darkness = false;
  initBossLight();
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
  f.darkness = false;
  f.darkTurns = 0;
  f.encounters = [];
  f.chest = null;
  f.rune = null;
  f.runeHint = null;
  f.lastChoiceType = null;
  f.beats = [];
  f.bossLitSet = new Set();
  f.bossDist = new Map();
  f.floorCount = 0;
  f.lightTurns = 0;
  f.lightTurnBudget = 1;
  f.lightFullRadius = 0;
  f.lightSlack = 0;
  f.lightLossShare = 0;
}

// Where THE UNFOLDING stands on a rest floor: a room tile out in the open
// (floor on all eight sides) if there is one, so it reads as something
// standing in the room rather than furniture against a wall. makePlacer
// keeps it off the doorway, the start and the stairs, and away from
// anything that would cut the room in two. Never on a paper. Null only if
// no tile at all can hold it.
function placeExchange(layout, papers) {
  const placer = makePlacer(layout, REST_GRID);
  const onPaper = p => papers.some(paper => paper.row === p.row && paper.col === p.col);
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
  updateCamera();

  const themeKeys = Object.keys(ROOM_THEMES);
  const theme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
  f.pillarSet = new Set();
  f.chamberAt = layout.chamberAt;
  f.doorSet = doorTiles(layout);
  f.chamberThemes = [theme];
  f.visitedChambers = new Set([0]);
  // Papers lie flat, so they need no placer: nobody is blocked by them.
  f.props = layout.chambers[0].slots.map(s => ({
    row: s.row, col: s.col, ...rollProp('paper', theme, state.run.roomIndex),
    identified: false, searched: false, sprung: false,
  }));

  f.stairs = { row: layout.stairs.row, col: layout.stairs.col };
  f.exchange = placeExchange(layout, f.props);
  f.exchangeBought = new Set();
  const avoid = [f.PLAYER_START, f.stairs, ...f.props, ...(f.exchange ? [f.exchange] : [])];
  const coinTile = pickCoinTile(f.wallSet, avoid, layout.roomTiles);
  f.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;

  f.visibleSet = new Set();
  f.exploredSet = new Set();
  computeVisibility();
  state.battle.selectedTarget = null;
}
