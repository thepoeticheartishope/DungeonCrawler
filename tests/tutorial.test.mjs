// Unit tests for the tutorial room (js/tutorial.js, floor.js
// buildTutorialFloor; tutorial chamber plan): the hand-drawn room builds
// the same every time, starts dark with a light that won't come on and a
// locked door, the light from above falls after a few turns, walking to
// it brings the barrel, any non-blank name is right and closes the ring
// of dark, which only the light switched on breaks, bringing a slow
// stick man that always hunts, killing it leaves a key, and taking the
// key brings the hide and push stages: the stall and the bookcase come
// alive, a second stick man the empty book can't stop paces under the
// bookcase once the player hides, and pushed onto it, the door opens and
// is the way out.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import {
  TUTORIAL_SPOT_TURNS, TUTORIAL_SPOT_NEAR, TUTORIAL_MINION_KIND, ENERGY_MAX,
} from '../js/config.js';
import { buildTutorialFloor } from '../js/floor.js';
import { TUTORIAL_ROOM, parseTutorialRoom, tutorialTurn, tutorialDial, tutorialSteady, settleName, breakRing } from '../js/tutorial.js';
import { stepPlayer } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { lightOn, tickLight, toggleLight } from '../js/battery.js';
import { advanceMonsters } from '../js/combat.js';
import { fire, readyShot, cancelShot, settleShot, startSteady, cancelSteady } from '../js/gun.js';

function resetRun() {
  state.settings.fogEnabled = true;
  state.settings.lightBattery = true;
  state.settings.simpleEnemies = false;
  state.settings.playerName = '';
  state.run.hearts = 3;
  state.run.energy = 0;
  state.run.rounds = [];
  state.run.turnCount = 0;
  state.run.loreQueue = [];
  buildTutorialFloor();
}

// Runs tutorialTurn `n` times with no events, as n quiet turns.
function passTurns(n) {
  for (let i = 0; i < n; i++) tutorialTurn([]);
}

// Puts the player beside the spot's middle, as if they walked there.
function walkToSpot() {
  const spot = state.floor.tutorial.spot;
  state.floor.playerRow = spot.row + 1;
  state.floor.playerCol = spot.col;
}

test('the room is square, walled, with one start, door and spot', () => {
  const room = parseTutorialRoom();
  assert.ok(TUTORIAL_ROOM.every(line => line.length === TUTORIAL_ROOM.length));
  assert.ok(room.start && room.door && room.spot);
  assert.equal(room.door.row, 0, 'the door is in the top wall');
  // 8 x 8 floor inside the walls, less the pillars.
  assert.equal(room.roomTiles.size, 64);
});

test('in Comfort mode the light is always on, so the ring can break with no switch', () => {
  resetRun();
  state.settings.simpleEnemies = true;
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  assert.equal(breakRing().length, 2);
  assert.equal(state.floor.tutorial.stage, 'fight');
});

test('it wakes in the dark, the light will not come on, and the door is locked', () => {
  resetRun();
  const f = state.floor;
  assert.equal(f.tutorial.stage, 'dark');
  assert.equal(lightOn(), false);
  assert.equal(toggleLight(), 'locked');
  assert.deepEqual(tickLight(), [], 'a steady light never charges');
  assert.deepEqual(whatBlocks(f.tutorial.door.row, f.tutorial.door.col), { kind: 'door' });
  assert.equal(f.minions.length, 0);
  assert.equal(f.stairs, null);
});

test('the light from above falls after TUTORIAL_SPOT_TURNS turns and is seen', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS - 1);
  assert.equal(state.floor.tutorial.stage, 'dark');
  const events = tutorialTurn([]);
  assert.deepEqual(events.map(e => e.type), ['spotLit']);
  const spot = state.floor.tutorial.spot;
  assert.ok(state.floor.visibleSet.has(key(spot.row, spot.col)));
});

test('walking toward the light brings the kind voice and the barrel', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  assert.deepEqual(tutorialTurn([]), [], 'still far from it');
  const spot = state.floor.tutorial.spot;
  state.floor.playerRow = spot.row + TUTORIAL_SPOT_NEAR;
  state.floor.playerCol = spot.col;
  const events = tutorialTurn([]);
  assert.deepEqual(events.map(e => e.type), ['whispered', 'barrelAppeared']);
  assert.deepEqual([events[0].line, events[0].tone], ['tut.trust', 'kind']);
  const barrel = events[1].prop;
  assert.ok(state.floor.spotSet.has(key(barrel.row, barrel.col)), 'the barrel is in the light');
});

test('standing in the light the kind voice says "It\'s watching you." once, and the eye is open', async () => {
  const { skyEyeOpen } = await import('../js/mapshared.js');
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  const spot = state.floor.tutorial.spot;
  state.floor.playerRow = spot.row + TUTORIAL_SPOT_NEAR;
  state.floor.playerCol = spot.col;
  assert.ok(!tutorialTurn([]).some(e => e.line === 'tut.lookUp'), 'near the light, not in it yet');
  walkToSpot();
  const events = tutorialTurn([]);
  assert.deepEqual(events.map(e => [e.type, e.line, e.tone, e.wait]), [['whispered', 'tut.lookUp', 'kind', true]]);
  assert.equal(skyEyeOpen(), 1, 'looking up shows it wide open, with no boss here');
  assert.deepEqual(tutorialTurn([]), [], 'only once');
  // Walking straight into the light says it with "I trust you." (held back a moment).
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  assert.deepEqual(tutorialTurn([]).map(e => e.line || e.type), ['tut.trust', 'barrelAppeared', 'tut.lookUp']);
});

test('bumping the barrel asks the name; a blank answer does nothing', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  const barrel = tutorialTurn([])[1].prop;
  state.floor.playerRow = barrel.row + 1;
  state.floor.playerCol = barrel.col;
  state.floor.facing = 'N';
  const events = stepPlayer(-1, 0);
  assert.deepEqual(events.map(e => e.type), ['nameAsked']);
  assert.deepEqual(settleName('   '), []);
  assert.equal(state.floor.tutorial.stage, 'name');
});

test('any name is right: it is kept and the ring of dark closes, holding the player', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  const events = settleName('  Ada  ');
  assert.deepEqual(events.map(e => e.type), ['nameGiven', 'whispered', 'ringClosed']);
  assert.equal(state.settings.playerName, 'Ada');
  assert.deepEqual([events[1].line, events[1].tone], ['tut.die', 'dread']);
  assert.equal(state.floor.tutorial.stage, 'ring');
  assert.equal(lightOn(), false);
  const f = state.floor;
  assert.deepEqual(whatBlocks(f.playerRow - 1, f.playerCol), { kind: 'dark' }, 'it can not step out');
  assert.deepEqual(breakRing(), [], 'the light is still off');
  assert.equal(f.minions.length, 0);
});

test('switching the light on breaks the ring: energy fills, the grate shudders, a slow stick man drops out and hunts', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  assert.equal(toggleLight(), 'on', 'the light works now');
  const events = breakRing();
  assert.deepEqual(events.map(e => e.type), ['ringBroken', 'whispered']);
  assert.deepEqual([events[1].line, events[1].tone], ['tut.ready', 'kind']);
  assert.equal(state.floor.tutorial.stage, 'fight');
  assert.equal(whatBlocks(state.floor.playerRow + 1, state.floor.playerCol), null, 'free to move');
  assert.deepEqual(tickLight(), [], 'the light stays on: no battery in the tutorial');
  assert.equal(state.floor.light.on, true);
  assert.equal(state.run.energy, ENERGY_MAX);
  // It starts in the grate's duct (vents and noise plan step D).
  assert.equal(state.floor.minions.length, 0, 'nothing on the floor yet');
  const [m] = state.floor.crawling;
  assert.equal(m.minionKind, TUTORIAL_MINION_KIND);
  assert.equal(m.guard, false, 'no guard: a maim drops it (kill or maim plan call 7)');
  assert.ok(m.hunts);
  assert.deepEqual(tutorialTurn([]), [], 'in the duct it is still coming, no key');
  const grate = state.floor.vents[0];
  const rattle = advanceMonsters();
  assert.ok(rattle.some(e => e.type === 'ventRattled' && e.heard), 'the grate shudders next turn, always heard here');
  assert.ok(state.floor.crawling.includes(m));
  const drop = advanceMonsters();
  assert.ok(drop.some(e => e.type === 'ventDropped' && e.minion === m), 'and it drops out the turn after');
  assert.ok(state.floor.minions.includes(m));
  assert.equal(Math.max(Math.abs(m.row - grate.row), Math.abs(m.col - grate.col)), 1, 'beside the grate');
  // It comes out on the far side of the room and comes closer.
  const far = Math.abs(m.row - state.floor.playerRow) + Math.abs(m.col - state.floor.playerCol);
  assert.ok(far >= 5, 'far from the player');
  for (let i = 0; i < 4; i++) advanceMonsters();
  const near = Math.abs(m.row - state.floor.playerRow) + Math.abs(m.col - state.floor.playerCol);
  assert.ok(near < far, 'it came for the player');
});

test('in the fight the energy fills again every turn, so a miss never empties it', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  state.run.energy = 0;
  state.run.rounds = [];
  tutorialTurn([]);
  assert.equal(state.run.energy, ENERGY_MAX);
  assert.equal(state.run.rounds.length, ENERGY_MAX);
});

test('in the fight the light stays on (no dark shot there); after it, it switches off again', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  assert.equal(toggleLight(), 'held');
  assert.ok(lightOn(), 'still on');
  state.floor.tutorial.stage = 'key';
  assert.equal(toggleLight(), 'off');
});

// From a fresh tutorial to the key taken (the stick man gone at 3,3, the
// key picked up from below). Returns the key turn's events.
function takeKey() {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  const f = state.floor;
  advanceMonsters();
  advanceMonsters();
  const m = f.minions[0];
  m.row = 3; m.col = 3;
  tutorialTurn([]);
  f.minions = [];
  const dropped = tutorialTurn([]);
  assert.deepEqual(dropped, [{ type: 'keyDropped', row: 3, col: 3 }]);
  assert.deepEqual(f.keys, [{ row: 3, col: 3 }]);
  f.playerRow = 4; f.playerCol = 3; f.facing = 'N';
  const took = stepPlayer(-1, 0);
  assert.ok(took.some(e => e.type === 'keyTaken'));
  return took;
}

// The tutorial's stall and bookcase spots.
function tutorialSpots() {
  const spots = state.floor.tutorial.spots;
  return { stall: spots.find(s => s.kind === 'hide'), shelf: spots.find(s => s.kind === 'takedown') };
}

// Turns of the stick men and the tutorial together, as main.js runs them.
// Returns every event.
function fullTurns(n) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const turn = advanceMonsters();
    events.push(...turn, ...tutorialTurn(turn));
  }
  return events;
}

// From the key to hidden in the stall: the second stick man out of the
// grate, the player bumped into the stall from below.
function hideInStall() {
  tutorialTurn(takeKey());
  const { stall } = tutorialSpots();
  const f = state.floor;
  f.playerRow = stall.row + 1; f.playerCol = stall.col; f.facing = 'N';
  const hid = stepPlayer(-1, 0);
  assert.ok(hid.some(e => e.type === 'hid'));
  return hid;
}

test('before the key the stall and the bookcase are only furniture', () => {
  resetRun();
  const { stall, shelf } = tutorialSpots();
  assert.equal(state.floor.roomSpots.length, 0);
  assert.equal(stall.tiles.length, 1);
  assert.equal(shelf.tiles.length, 3);
  const f = state.floor;
  f.playerRow = stall.row + 1; f.playerCol = stall.col; f.facing = 'N';
  assert.ok(stepPlayer(-1, 0).some(e => e.type === 'blocked' && e.kind === 'furniture'));
});

test('taking the key leaves the door shut and the book empty, makes the spots live and sends a second stick man', () => {
  const took = takeKey();
  assert.deepEqual(tutorialTurn(took), []);
  const f = state.floor;
  assert.equal(f.tutorial.stage, 'hide');
  assert.deepEqual(whatBlocks(f.tutorial.door.row, f.tutorial.door.col), { kind: 'door' });
  assert.equal(state.run.energy, 0);
  assert.equal(f.roomSpots.length, 2);
  assert.ok(f.roomSpots.every(s => !s.used));
  assert.equal(f.crawling.length, 1, 'a stick man is in the grate\'s duct');
  assert.equal(f.tutorial.minion, f.crawling[0]);
  tutorialTurn([]);
  assert.equal(state.run.energy, 0, 'the book is not filled again');
});

test('as the second stick man drops out, the kind voice says to hide, once', () => {
  tutorialTurn(takeKey());
  const lines = fullTurns(4).filter(e => e.type === 'whispered').map(e => e.line);
  assert.deepEqual(lines, ['tut.hide']);
});

test('hidden, the stage moves to push: it paces in front of the bookcase and never gets the player', () => {
  const hid = hideInStall();
  tutorialTurn(hid);
  const f = state.floor;
  assert.equal(f.tutorial.stage, 'push');
  const m = f.tutorial.minion;
  const { shelf } = tutorialSpots();
  assert.ok(m.route && m.route.loop && !m.hunts);
  const hearts = state.run.hearts;
  const cols = new Set();
  const events = fullTurns(60);
  assert.ok(!events.some(e => e.type === 'minionStruck' || e.type === 'struggleStarted'));
  assert.equal(state.run.hearts, hearts);
  for (let i = 0; i < 30; i++) { fullTurns(1); if (m.row === shelf.row + 1) cols.add(m.col); }
  assert.ok(shelf.tiles.every(t => cols.has(t.col)), 'it passes under every tile of the bookcase');
});

test('behind the bookcase as it passes under: "Now. Push."; the push kills it and the door opens', () => {
  tutorialTurn(hideInStall());
  const f = state.floor;
  const m = f.tutorial.minion;
  const { shelf } = tutorialSpots();
  f.hidden = null;
  f.playerRow = shelf.row - 1; f.playerCol = shelf.tiles[1].col; f.facing = 'S';
  let said = [];
  for (let i = 0; i < 40 && !(m.row === shelf.row + 1 && m.col === shelf.tiles[1].col); i++) {
    said = said.concat(fullTurns(1).filter(e => e.type === 'whispered').map(e => e.line));
  }
  assert.ok(said.includes('tut.push'), 'the kind voice said to push: ' + said);
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'toppled'));
  assert.ok(push.some(e => e.type === 'minionKilled' && e.minion === m));
  assert.deepEqual(tutorialTurn(push), [{ type: 'doorUnlocked' }]);
  const door = f.tutorial.door;
  assert.equal(whatBlocks(door.row, door.col), null);
  f.playerRow = door.row + 1; f.playerCol = door.col; f.facing = 'N';
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type).slice(-1), ['tutorialLeft']);
});

test('the bookcase pushed onto nothing: "Too soon. The book, then." and the book is filled again', () => {
  tutorialTurn(hideInStall());
  const f = state.floor;
  const m = f.tutorial.minion;
  const { shelf } = tutorialSpots();
  m.row = shelf.row + 1; m.col = shelf.tiles[2].col + 2;
  f.hidden = null;
  f.playerRow = shelf.row - 1; f.playerCol = shelf.tiles[0].col; f.facing = 'S';
  const push = stepPlayer(1, 0);
  assert.ok(push.some(e => e.type === 'toppled') && !push.some(e => e.type === 'minionKilled'));
  assert.deepEqual(tutorialTurn(push).map(e => e.line), ['tut.missed']);
  assert.equal(state.run.energy, ENERGY_MAX);
  assert.equal(f.tutorial.stage, 'push', 'the door stays shut until it is gone');
});

test('the first time the static shows in the fight, the kind voice names it, once', () => {
  resetRun();
  state.settings.staticNoise = true;
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  assert.deepEqual(tutorialTurn([]), [], 'in the duct: no static yet');
  advanceMonsters();
  advanceMonsters();
  const f = state.floor;
  const m = f.minions[0];
  m.row = f.playerRow - 1; m.col = f.playerCol;
  assert.deepEqual(tutorialTurn([]), [{ type: 'whispered', line: 'tut.static', tone: 'kind' }]);
  assert.deepEqual(tutorialTurn([]), [], 'said once');
});

test('with Simple enemies or DEV -> Static off there is no static, so no line', () => {
  for (const [simple, on] of [[true, true], [false, false]]) {
    resetRun();
    state.settings.simpleEnemies = simple;
    state.settings.staticNoise = on;
    passTurns(TUTORIAL_SPOT_TURNS);
    walkToSpot();
    tutorialTurn([]);
    settleName('Ada');
    toggleLight();
    breakRing();
    advanceMonsters();
    advanceMonsters();
    const f = state.floor;
    const m = f.minions[0];
    m.row = f.playerRow - 1; m.col = f.playerCol;
    assert.deepEqual(tutorialTurn([]), []);
  }
  state.settings.staticNoise = true;
});

test('a maim drops the stick man; the kind voice says "Finish it."; a bump finishes it and the key drops', () => {
  resetRun();
  state.settings.downed = true;
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  advanceMonsters();
  advanceMonsters();
  const f = state.floor;
  const m = f.minions[0];
  // Beside the player, north, in their light. The static was named as it came.
  m.row = f.playerRow - 1; m.col = f.playerCol;
  f.facing = 'N'; f.look = null;
  f.tutorial.toldStatic = true;
  fire(m);
  readyShot();
  const zone = state.battle.aim.zones.find(z => z.tier === 'maim');
  const shot = settleShot((zone.from + zone.to) / 2);
  assert.ok(shot.some(e => e.type === 'minionDowned'), 'a maim drops it: no guard here');
  assert.deepEqual(tutorialTurn(shot), [{ type: 'whispered', line: 'tut.finish', tone: 'kind' }]);
  assert.deepEqual(tutorialTurn([]), [], 'said once');

  const finish = stepPlayer(-1, 0);
  assert.ok(finish.some(e => e.type === 'minionFinished'));
  assert.deepEqual(tutorialTurn(finish), [{ type: 'keyDropped', row: m.row, col: m.col }]);
});

test('the first shot\'s dial: the kind voice at READY and once it runs, once each, only in the fight', () => {
  resetRun();
  assert.deepEqual(tutorialDial([{ type: 'aimStarted' }]), [], 'not before the fight');
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  advanceMonsters();
  advanceMonsters();
  const f = state.floor;
  const m = f.minions[0];
  m.row = f.playerRow - 1; m.col = f.playerCol;
  f.facing = 'N'; f.look = null;
  state.run.energy = 0;
  tutorialTurn([]);
  const energy = state.run.energy;

  const opened = fire(m);
  assert.deepEqual(tutorialDial(opened), [{ type: 'whispered', line: 'tut.breathe', tone: 'kind' }]);
  assert.ok(cancelShot().length, 'BACK before READY');
  assert.equal(state.run.energy, energy, 'BACK spends nothing');
  assert.deepEqual(tutorialDial(fire(m)), [], 'said once');
  const ready = readyShot();
  assert.equal(state.run.energy, energy - 1, 'READY spends the round');
  assert.deepEqual(tutorialDial(ready), [{ type: 'whispered', line: 'tut.dial', tone: 'kind' }]);
  assert.deepEqual(tutorialDial(ready), [], 'said once');
});

test('the first steadied shot: the kind voice as it starts and when it comes to full, once each, only in the fight', () => {
  resetRun();
  assert.deepEqual(tutorialSteady([{ type: 'aimStarted' }]), [], 'not before the fight');
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  advanceMonsters();
  advanceMonsters();
  const f = state.floor;
  const m = f.minions[0];
  m.row = f.playerRow - 1; m.col = f.playerCol;
  f.facing = 'N'; f.look = null;
  state.run.energy = 0;
  tutorialTurn([]);

  const opened = fire(m);
  startSteady();
  assert.deepEqual(tutorialSteady(opened), [{ type: 'whispered', line: 'tut.hold', tone: 'kind' }]);
  assert.deepEqual(tutorialSteady([]), [], 'not yet steady');
  state.battle.aim.steady = 1;
  assert.deepEqual(tutorialSteady([]), [{ type: 'whispered', line: 'tut.steady', tone: 'kind' }]);
  assert.deepEqual(tutorialSteady([]), [], 'said once');
  cancelSteady();
  assert.deepEqual(tutorialSteady(fire(m)), [], 'the first line said once too');
});

test('with One stick, the first reach of the fight brings "When it reaches, step away." once', () => {
  resetRun();
  passTurns(TUTORIAL_SPOT_TURNS);
  walkToSpot();
  tutorialTurn([]);
  settleName('Ada');
  toggleLight();
  breakRing();
  const m = state.floor.tutorial.minion;
  const reach = [{ type: 'reachStarted', minion: m }];
  const told = tutorialTurn(reach).filter(e => e.type === 'whispered');
  assert.deepEqual(told.map(e => [e.line, e.tone]), [['tut.reach', 'kind']]);
  assert.deepEqual(tutorialTurn(reach).filter(e => e.line === 'tut.reach'), [], 'once');
});
