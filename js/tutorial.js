// The tutorial room (tutorial chamber plan, ideas/tutorial-chamber-plan.md
// outside the repo): one hand-drawn room, never generated, that a new
// player wakes in before the run. It plays out in stages, the same every
// time (Timothy's script):
//   dark   the light won't come on; "You can't leave. Don't try."
//   spot   after TUTORIAL_SPOT_TURNS a light falls from above on one spot
//   name   walking toward it: "You can do this. I trust you." and a barrel
//          (a box) in the light asks the player's name
//   fight  "Be ready." The light comes on and a slow stick man comes from
//          the far side of the room, always for the player
//   key    it falls and leaves a key
//   open   the key opens the door at the top; through it, the run begins
// It shows the game's central mechanics, so when a core mechanic is added,
// the tutorial gets a beat for it.
// floor.js buildTutorialFloor() builds the room from TUTORIAL_ROOM; main.js
// calls tutorialTurn() after each spent turn and settleName() for the
// barrel's answer. No DOM access here.

import { state, key } from './state.js';
import {
  ENERGY_MAX, LIGHT_BATTERY_MAX, PLAYER_NAME_MAX_LENGTH, TUTORIAL_MINION_HP, TUTORIAL_MINION_KIND,
  TUTORIAL_SPOT_NEAR, TUTORIAL_SPOT_RADIUS, TUTORIAL_SPOT_TURNS,
} from './config.js';
import { computeVisibility } from './sight.js';
import { spawnMinion } from './combat.js';
import { addRounds } from './gun.js';

// The room: '#' wall, '.' floor, 'S' where the player wakes, 'D' the
// locked door (in the top wall), 'L' the middle of the light from above,
// 'o' a pillar, 'b' an empty box. Furniture is there to bump into, not to
// use. The floor inside is 8 tiles each way (Timothy).
export const TUTORIAL_ROOM = [
  '####D#####',
  '#........#',
  '#.o....b.#',
  '#........#',
  '#......L.#',
  '#........#',
  '#.b......#',
  '#......o.#',
  '#...S....#',
  '##########',
];

// TUTORIAL_ROOM as tiles: { size, walls, roomTiles (Set of keys), start,
// door, spot, pillars, boxes } (all positions { row, col }). The door is
// floor, not wall: it is shut by passage.js whatBlocks until it opens.
export function parseTutorialRoom(rows = TUTORIAL_ROOM) {
  const room = { size: rows.length, walls: new Set(), roomTiles: new Set(), pillars: [], boxes: [] };
  rows.forEach((line, row) => [...line].forEach((ch, col) => {
    const at = { row, col };
    if (ch === '#') { room.walls.add(key(row, col)); return; }
    if (ch === 'D') { room.door = at; return; }
    room.roomTiles.add(key(row, col));
    if (ch === 'S') room.start = at;
    if (ch === 'L') room.spot = at;
    if (ch === 'o') room.pillars.push(at);
    if (ch === 'b') room.boxes.push(at);
  }));
  return room;
}

// A fresh tutorial's own state, for state.floor.tutorial.
export function freshTutorial(room) {
  return { stage: 'dark', turns: 0, door: room.door, spot: room.spot, roomTiles: room.roomTiles, minion: null, minionAt: null };
}

// The light that won't come on: off, locked and steady (battery.js: a
// steady light neither runs down nor charges).
export function darkLight() {
  return { on: false, charge: 0, locked: true, steady: true };
}

// Chebyshev steps from the player to (row, col).
function stepsTo(p) {
  return Math.max(Math.abs(p.row - state.floor.playerRow), Math.abs(p.col - state.floor.playerCol));
}

// Moves the tutorial on after a spent turn (`events` are the turn's).
// Returns the events that adds, in order: spotLit; then kindSpoken
// { line } and barrelAppeared { prop } once the player walks toward the
// light; keyDropped { row, col } once the stick man is gone (shot, or
// cleared in classic combat); doorUnlocked once the key is taken. None
// off the tutorial.
export function tutorialTurn(events) {
  const tut = state.floor.tutorial;
  if (!tut) return [];
  if (tut.stage === 'dark') {
    tut.turns++;
    if (tut.turns < TUTORIAL_SPOT_TURNS) return [];
    tut.stage = 'spot';
    lightSpot(tut.spot);
    return [{ type: 'spotLit' }];
  }
  if (tut.stage === 'spot') {
    if (stepsTo(tut.spot) > TUTORIAL_SPOT_NEAR) return [];
    tut.stage = 'name';
    return [{ type: 'kindSpoken', line: 'tut.trust' }, { type: 'barrelAppeared', prop: placeBarrel(tut.spot) }];
  }
  if (tut.stage === 'fight') {
    if (state.floor.minions.includes(tut.minion)) {
      tut.minionAt = { row: tut.minion.row, col: tut.minion.col };
      return [];
    }
    const at = tut.minionAt;
    state.floor.keys.push({ row: at.row, col: at.col });
    tut.stage = 'key';
    return [{ type: 'keyDropped', row: at.row, col: at.col }];
  }
  if (tut.stage === 'key' && events.some(e => e.type === 'keyTaken')) {
    tut.stage = 'open';
    return [{ type: 'doorUnlocked' }];
  }
  return [];
}

// The light from above: every room tile within TUTORIAL_SPOT_RADIUS of
// `spot` is lit (state.floor.spotSet; sight.js adds it to what is seen).
function lightSpot(spot) {
  const f = state.floor;
  f.spotSet = new Set();
  for (let r = spot.row - TUTORIAL_SPOT_RADIUS; r <= spot.row + TUTORIAL_SPOT_RADIUS; r++) {
    for (let c = spot.col - TUTORIAL_SPOT_RADIUS; c <= spot.col + TUTORIAL_SPOT_RADIUS; c++) {
      if (!f.wallSet.has(key(r, c))) f.spotSet.add(key(r, c));
    }
  }
  computeVisibility();
}

// The barrel that asks the player's name: a box in the middle of the
// light, or beside it if the player stands there. moves.js examineProp
// asks its question (nameAsked) instead of opening it.
function placeBarrel(spot) {
  const f = state.floor;
  const free = p => !f.wallSet.has(key(p.row, p.col)) && !f.pillarSet.has(key(p.row, p.col)) &&
    !(p.row === f.playerRow && p.col === f.playerCol) && !f.props.some(q => q.row === p.row && q.col === p.col);
  const around = [[0, 0], [-1, 0], [0, 1], [0, -1], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]
    .map(([dr, dc]) => ({ row: spot.row + dr, col: spot.col + dc }));
  const at = around.find(free) || spot;
  const prop = {
    row: at.row, col: at.col, kind: 'box', theme: f.chamberThemes[0], loot: 'junk', gold: 0, trapped: false,
    asks: 'name', identified: false, searched: false, sprung: false,
  };
  f.props.push(prop);
  computeVisibility();
  return prop;
}

// The barrel's answer. Any name that isn't blank is right (Timothy's call
// a): it becomes the player's name. Then the light comes on and stays on,
// the energy is filled, and a slow stick man comes from the far side of
// the room. Returns [] for a blank answer (nothing happens), else
// nameGiven { name }, kindSpoken { line: 'tut.ready' }, lightSwitched { on: true }.
export function settleName(raw) {
  const f = state.floor;
  const tut = f.tutorial;
  const name = raw.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  if (!tut || tut.stage !== 'name' || !name) return [];
  state.settings.playerName = name;
  const barrel = f.props.find(p => p.asks === 'name');
  if (barrel) barrel.searched = true;
  f.light = { on: true, charge: LIGHT_BATTERY_MAX, locked: false, steady: true };
  if (state.run.energy < ENERGY_MAX) addRounds(ENERGY_MAX - state.run.energy);
  const m = spawnMinion(farthestTile(), TUTORIAL_MINION_KIND);
  m.hpLeft = TUTORIAL_MINION_HP;
  m.hunts = true;
  tut.minion = m;
  tut.minionAt = { row: m.row, col: m.col };
  tut.stage = 'fight';
  computeVisibility();
  return [{ type: 'nameGiven', name }, { type: 'kindSpoken', line: 'tut.ready' }, { type: 'lightSwitched', on: true }];
}

// The free room tile the most walkable steps from the player: the other
// side of the room, wherever they stand.
function farthestTile() {
  const f = state.floor;
  const blocked = k => f.wallSet.has(k) || f.pillarSet.has(k) || f.props.some(p => p.kind !== 'paper' && key(p.row, p.col) === k);
  const start = key(f.playerRow, f.playerCol);
  const dist = new Map([[start, 0]]);
  const queue = [{ row: f.playerRow, col: f.playerCol }];
  let far = queue[0];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    if (d > dist.get(key(far.row, far.col))) far = cur;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { row: cur.row + dr, col: cur.col + dc };
      const k = key(next.row, next.col);
      if (dist.has(k) || blocked(k) || !f.tutorial.roomTiles.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(next);
    }
  }
  return far;
}
