// The tutorial room (tutorial chamber plan, ideas/tutorial-chamber-plan.md
// outside the repo): one hand-drawn room, never generated, that a new
// player wakes in before the run. It plays out in stages, the same every
// time (Timothy's script):
//   dark   the light won't come on; "You can't leave. Don't try."
//   spot   after TUTORIAL_SPOT_TURNS a light falls from above on one spot
//   name   walking toward it: "You can do this. I trust you." and a barrel
//          (a box) in the light asks the player's name
//   ring   the dark closes round the player ("Die in darkness."): words
//          circle at the edge of their light and they can't step out. A
//          moment later the kind voice: "Don't let them dim your light."
//          Their light works now; switching it on breaks the ring. It
//          teaches the light by making it the only way out (Timothy:
//          teach without hand holding)
//   fight  "Be ready." A slow stick man comes from the far side of the
//          room, always for the player
//          The first shot's dial (kill or maim plan step C): at READY
//          "Breathe. Then READY.", once it runs "Stop on K to kill. M
//          drops it." It has no guard, so a maim drops it (downed plan):
//          the kind voice says "Finish it.", and a bump finishes it.
//          With One stick, the first time it reaches for the player:
//          "When it reaches, step away." (one stick plan step G)
//   key    it falls and leaves a key
//   open   the key opens the door at the top; through it, the run begins
// It shows the game's central mechanics, so when a core mechanic is added,
// the tutorial gets a beat for it.
// floor.js buildTutorialFloor() builds the room from TUTORIAL_ROOM; main.js
// calls tutorialTurn() after each spent turn, settleName() for the
// barrel's answer and breakRing() once the light is on. Lines are
// whispered { line, tone } events: 'dread' is the dungeon, 'kind' the
// voice on the player's side. No DOM access here.

import { state, key } from './state.js';
import {
  ENERGY_MAX, LIGHT_BATTERY_MAX, PLAYER_NAME_MAX_LENGTH, TUTORIAL_MINION_KIND,
  TUTORIAL_SPOT_NEAR, TUTORIAL_SPOT_RADIUS, TUTORIAL_SPOT_TURNS,
} from './config.js';
import { computeVisibility } from './sight.js';
import { spawnMinion } from './combat.js';
import { crawlInto } from './vents.js';
import { addRounds } from './gun.js';
import { lightOn } from './battery.js';
import { staticLevel } from './static.js';

// The room: '#' wall, '.' floor, 'S' where the player wakes, 'D' the
// locked door (in the top wall), 'L' the middle of the light from above,
// 'o' a pillar, 'b' an empty box, 'g' a grate (vents and noise plan step
// D: the stick man comes out of it; it has no pair). Furniture is there to
// bump into, not to use. The floor inside is 8 tiles each way (Timothy).
export const TUTORIAL_ROOM = [
  '####D#####',
  '#g.......#',
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
// door, spot, grate, pillars, boxes } (all positions { row, col }). The door is
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
    if (ch === 'g') room.grate = at;
    if (ch === 'o') room.pillars.push(at);
    if (ch === 'b') room.boxes.push(at);
  }));
  return room;
}

// A fresh tutorial's own state, for state.floor.tutorial.
export function freshTutorial(room) {
  return { stage: 'dark', turns: 0, door: room.door, spot: room.spot, roomTiles: room.roomTiles, minion: null, minionAt: null, toldReady: false, toldDial: false, toldLookUp: false, toldStatic: false, toldReach: false };
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

// The fight's first shot (kill or maim plan step C): the kind voice talks
// the player through the dial once, a line as it opens at READY and one
// once it runs. `events` are fire()'s or readyShot()'s. Returns whispered
// { line: 'tut.breathe', tone: 'kind' } on the first aimStarted,
// whispered { line: 'tut.dial', tone: 'kind' } on the first shotReady,
// else none (and none off the tutorial's fight).
export function tutorialDial(events) {
  const tut = state.floor.tutorial;
  if (!tut || tut.stage !== 'fight') return [];
  if (!tut.toldReady && events.some(e => e.type === 'aimStarted')) {
    tut.toldReady = true;
    return [{ type: 'whispered', line: 'tut.breathe', tone: 'kind' }];
  }
  if (!tut.toldDial && events.some(e => e.type === 'shotReady')) {
    tut.toldDial = true;
    return [{ type: 'whispered', line: 'tut.dial', tone: 'kind' }];
  }
  return [];
}

// Moves the tutorial on after a spent turn (`events` are the turn's).
// Returns the events that adds, in order: spotLit; then whispered
// { line, tone } and barrelAppeared { prop } once the player walks toward the
// light; whispered { line: 'tut.lookUp', tone: 'kind', wait: true } the
// first time they stand in it (see lookUpLine); whispered { line: 'tut.finish', tone: 'kind' } once the stick man
// goes down (downed plan step C: its minionDowned is in `events`), so the
// player learns a bump finishes it; whispered { line: 'tut.reach', tone:
// 'kind' } the first time it reaches for them with One stick (see
// reachLine); whispered { line: 'tut.static', tone:
// 'kind' } the first time the static shows (see staticLine); keyDropped { row, col } once the stick man is gone (shot, or
// cleared in classic combat); doorUnlocked once the key is taken. None
// off the tutorial. In the fight the energy is filled again every turn,
// so a miss never leaves the player with nothing to shoot (Timothy).
export function tutorialTurn(events) {
  const tut = state.floor.tutorial;
  if (!tut) return [];
  if (tut.stage === 'fight' && state.run.energy < ENERGY_MAX) addRounds(ENERGY_MAX - state.run.energy);
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
    return [{ type: 'whispered', line: 'tut.trust', tone: 'kind' }, { type: 'barrelAppeared', prop: placeBarrel(tut.spot) }, ...lookUpLine(tut)];
  }
  if (tut.stage === 'name') return lookUpLine(tut);
  if (tut.stage === 'fight') {
    // In the grate's duct it is still coming, not dead.
    if (state.floor.minions.includes(tut.minion) || state.floor.crawling.includes(tut.minion)) {
      tut.minionAt = { row: tut.minion.row, col: tut.minion.col };
      const downed = events.some(e => e.type === 'minionDowned' && e.minion === tut.minion);
      if (downed) return [{ type: 'whispered', line: 'tut.finish', tone: 'kind' }];
      return [...reachLine(tut, events), ...staticLine(tut)];
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

// The kind voice on the reach (one stick plan step G: the reach is the
// real-time answer to "hit from nowhere", so it gets a tutorial beat), once,
// the first time the tutorial's stick man reaches for the player
// (combat.js reachStarted, One stick only): stepped out of reach, it
// misses. Returns that whispered event, or none.
function reachLine(tut, events) {
  if (tut.toldReach || !events.some(e => e.type === 'reachStarted' && e.minion === tut.minion)) return [];
  tut.toldReach = true;
  return [{ type: 'whispered', line: 'tut.reach', tone: 'kind' }];
}

// The kind voice names the static (static.js: a new way to sense them
// gets a tutorial beat), once, the first turn of the fight it shows: the
// stick man has dropped out of the grate and is near. Not with Simple
// enemies (no static; "Enemy close." says it) or DEV -> Static off.
// Returns that whispered event, or none.
function staticLine(tut) {
  if (tut.toldStatic || state.settings.simpleEnemies || staticLevel() === 0) return [];
  tut.toldStatic = true;
  return [{ type: 'whispered', line: 'tut.static', tone: 'kind' }];
}

// The light from above: every room tile within TUTORIAL_SPOT_RADIUS of
// The kind voice's "It's watching you. Show it true light." (sky eye plan
// step B: a new way to see gets a tutorial beat), once, the first time the
// player stands in the light from above: looking up there shows the eye
// wide open (mapshared
// skyEyeOpen), so they learn an open eye is bad without being told
// (Timothy). `wait` asks main.js to hold it a moment, so it doesn't cut
// off "You can do this. I trust you." Returns that whispered event, or none.
function lookUpLine(tut) {
  if (tut.toldLookUp) return [];
  if (!state.floor.spotSet.has(key(state.floor.playerRow, state.floor.playerCol))) return [];
  tut.toldLookUp = true;
  return [{ type: 'whispered', line: 'tut.lookUp', tone: 'kind', wait: true }];
}

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
// a): it becomes the player's name. Then the dark closes in: the player
// can't step out of the ring (passage.js) until their light is on, and
// from now on it works, steady (it never runs down here). Returns [] for
// a blank answer (nothing happens), else nameGiven { name },
// whispered { line: 'tut.die', tone: 'dread' }, ringClosed.
export function settleName(raw) {
  const f = state.floor;
  const tut = f.tutorial;
  const name = raw.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  if (!tut || tut.stage !== 'name' || !name) return [];
  state.settings.playerName = name;
  const barrel = f.props.find(p => p.asks === 'name');
  if (barrel) barrel.searched = true;
  f.light = { on: false, charge: LIGHT_BATTERY_MAX, locked: false, steady: true };
  tut.stage = 'ring';
  computeVisibility();
  return [{ type: 'nameGiven', name }, { type: 'whispered', line: 'tut.die', tone: 'dread' }, { type: 'ringClosed' }];
}

// The light is on in the ring (main.js, after V or 3 taps on the look
// stick; in Comfort mode, where it is always on, once the kind voice has
// spoken): the ring breaks, the energy is filled, and the kind voice warns
// that mistakes bring them (vents and noise plan step D). A slow stick man
// is already in the grate's duct (vents.js crawlInto, quietly: no line
// for it going in): next turn the grate shudders, the turn after it climbs
// out and hunts (crawlTurn). Nothing here follows the name: giving it must
// never read as a mistake (Timothy). Events: ringBroken,
// whispered { line: 'tut.ready', tone: 'kind' }; none if the ring isn't
// closed or the light is still off.
export function breakRing() {
  const f = state.floor;
  const tut = f.tutorial;
  if (!tut || tut.stage !== 'ring' || !lightOn()) return [];
  if (state.run.energy < ENERGY_MAX) addRounds(ENERGY_MAX - state.run.energy);
  const grate = f.vents[0];
  const m = spawnMinion({ row: grate.row, col: grate.col }, TUTORIAL_MINION_KIND);
  // No guard here (kill or maim plan call 7): a maim drops it, a kill ends it.
  m.guard = false;
  m.hunts = true;
  crawlInto(m, 0);
  f.minions.splice(f.minions.indexOf(m), 1);
  f.crawling.push(m);
  tut.minion = m;
  tut.minionAt = { row: m.row, col: m.col };
  tut.stage = 'fight';
  computeVisibility();
  return [{ type: 'ringBroken' }, { type: 'whispered', line: 'tut.ready', tone: 'kind' }];
}
