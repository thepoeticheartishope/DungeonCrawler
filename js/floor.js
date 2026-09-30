// Building a floor as data: layout, furniture, boss, stairs, coin, the one
// special item and minions, plus the light, sight and camera that follow
// from them. No page access — main.js loadRoom() calls buildFloor(), then
// drawFloor() puts the result on the page.

import { state, key } from './state.js';
import { generateDungeonLayout } from './dungeon.js';
import { furnishFloor } from './decor.js';
import {
  BOSS_HP, GRID_SIZES, CHAMBER_TARGETS, MINIONS_PER_ROOM, MINION_MIN_START_DISTANCE
} from './config.js';
import { shuffle } from './quiz.js';
import { computeVisibility, updateCamera } from './sight.js';
import { spawnMinion } from './combat.js';
import { initBossLight } from './light.js';

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

// The room's fixed set of minions (MINIONS_PER_ROOM), placed on room tiles
// outside the boss chamber and at least MINION_MIN_START_DISTANCE steps
// from the player's start, so a room never opens with one in the player's
// face. Falls back to any free reachable room tile if a small room can't
// fit them that far away.
function placeMinions(roomTiles, takenTiles) {
  const count = MINIONS_PER_ROOM[Math.min(state.run.roomIndex, MINIONS_PER_ROOM.length - 1)];
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

// The floor as data only: layout, furniture, boss, stairs, coin, the one
// special item and minions, plus the light, sight and camera that follow
// from them. No page access.
export function buildFloor() {
  state.floor.GRID_SIZE = GRID_SIZES[Math.min(state.run.roomIndex, GRID_SIZES.length - 1)];
  state.floor.CHAMBER_TARGET = CHAMBER_TARGETS[Math.min(state.run.roomIndex, CHAMBER_TARGETS.length - 1)];

  state.floor.minions = [];
  state.floor.hunter = null;
  state.floor.darkTurns = 0;
  state.floor.encounters = [];
  state.floor.props = [];
  state.floor.runeHint = null;
  state.floor.lastChoiceType = null;

  const layout = generateDungeonLayout(state.floor.GRID_SIZE, state.floor.CHAMBER_TARGET);
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
  const freeRoomTiles = new Set([...roomTiles].filter(k => !placer.blocked.has(k)));

  const coinTile = pickCoinTile(state.floor.wallSet, [state.floor.PLAYER_START, { row: state.floor.boss.row, col: state.floor.boss.col }, state.floor.stairs], freeRoomTiles);
  state.floor.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;

  const takenTiles = [state.floor.PLAYER_START, { row: state.floor.boss.row, col: state.floor.boss.col }, state.floor.stairs];
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
  const specialTile = placer.pick(specialCandidates);
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
  placeMinions(roomTiles, minionTaken);

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
