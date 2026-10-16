// Unit tests for the tutorial room (js/tutorial.js, floor.js
// buildTutorialFloor; tutorial chamber plan): the hand-drawn room builds
// the same every time, starts dark with a light that won't come on and a
// locked door, the light from above falls after a few turns, walking to
// it brings the barrel, any non-blank name is right and closes the ring
// of dark, which only the light switched on breaks, bringing a slow
// stick man that always hunts, killing it leaves a key, and the key
// opens the door, which is the way out.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import {
  TUTORIAL_SPOT_TURNS, TUTORIAL_SPOT_NEAR, TUTORIAL_MINION_KIND, ENERGY_MAX,
} from '../js/config.js';
import { buildTutorialFloor } from '../js/floor.js';
import { TUTORIAL_ROOM, parseTutorialRoom, tutorialTurn, settleName, breakRing } from '../js/tutorial.js';
import { stepPlayer } from '../js/moves.js';
import { whatBlocks } from '../js/passage.js';
import { lightOn, tickLight, toggleLight } from '../js/battery.js';
import { advanceMonsters } from '../js/combat.js';
import { fire, readyShot, settleShot } from '../js/gun.js';

function resetRun() {
  state.settings.fogEnabled = true;
  state.settings.lightBattery = true;
  state.settings.simpleEnemies = false;
  state.settings.gunCombat = true;
  state.settings.eightWays = true;
  state.settings.freeLook = true;
  state.settings.turnBeforeStep = false;
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

test('the stick man gone leaves a key; taking it opens the door; the door is the way out', () => {
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
  assert.deepEqual(tutorialTurn(took), [{ type: 'doorUnlocked' }]);
  const door = f.tutorial.door;
  assert.equal(whatBlocks(door.row, door.col), null);

  f.playerRow = door.row + 1; f.playerCol = door.col; f.facing = 'N';
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type).slice(-1), ['tutorialLeft']);
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
  // Beside the player, north, in their light.
  m.row = f.playerRow - 1; m.col = f.playerCol;
  f.facing = 'N'; f.look = null;
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
