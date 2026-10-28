// Unit tests for noise.js (vents and noise plan step B): how far a
// mistake's sound carries, through grates too, and the stick men that
// hear it.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, twoRooms } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { MINION_TRACK_TURNS, NOISE_RANGES } from '../js/config.js';
import { spreadSound, makeNoise } from '../js/noise.js';
import { advanceMonsters, spawnMinion } from '../js/combat.js';
import { toggleLight } from '../js/battery.js';
import { computeVisibility } from '../js/sight.js';
import { settleReload } from '../js/gun.js';

// A 21x21 floor: room 0 on the left (cols 1-6), room 1 on the right
// (cols 14-19), joined by a hallway along row 10 (no room). Walls
// everywhere else. A grate in each room's top corner, a pair. The player
// stands at the bottom of room 0, light off, so no stick man sees them.
function resetFloor() {
  emptyFloor(21, {
    settings: { fogEnabled: true, gunCombat: false, lightBattery: true, simpleEnemies: false, gaze: true, noise: true },
    see: false,
  });
  twoRooms();
  state.floor.vents = [{ row: 1, col: 1, pair: 1, known: false }, { row: 1, col: 19, pair: 0, known: false }];
  state.floor.look = 0;
  toggleLight();
  computeVisibility();
}

const reached = (tiles, row, col) => tiles.find(t => t.row === row && t.col === col);

test('a sound spreads its range in walking steps and walls stop it', () => {
  resetFloor();
  const tiles = spreadSound({ row: 19, col: 1 }, 4);
  assert.equal(reached(tiles, 15, 1).d, 4);
  assert.equal(reached(tiles, 15, 5).d, 4, '8 ways: a diagonal is one step');
  assert.ok(!reached(tiles, 14, 1), 'not past its range');
  assert.ok(tiles.every(t => !state.floor.wallSet.has(key(t.row, t.col))), 'never on a wall');
});

test('the hallway carries a sound into the next room, the wall between does not', () => {
  resetFloor();
  // From the hallway's mouth in room 0, the far room is 8 steps along.
  const tiles = spreadSound({ row: 10, col: 6 }, 9);
  assert.equal(reached(tiles, 10, 14).d, 8);
  assert.equal(reached(tiles, 10, 15).d, 9);
  // Row 5, col 14 is 4 rows up the far room: further than a straight wall
  // crossing would make it.
  assert.ok(!reached(tiles, 5, 14), 'it went round by the hallway, not through the wall');
});

test('a grate passes the sound to its pair with the steps it had left', () => {
  resetFloor();
  const tiles = spreadSound({ row: 3, col: 1 }, 4);
  assert.equal(reached(tiles, 1, 1).d, 2);
  const far = reached(tiles, 1, 19);
  assert.equal(far.d, 2, 'out of the pair at the same step, for free');
  assert.deepEqual(far.through, [0]);
  assert.equal(reached(tiles, 3, 19).d, 4, 'and on from there');
  assert.ok(!reached(tiles, 4, 19));
});

test('a held room seals its grate: no sound gets through either way', () => {
  resetFloor();
  state.floor.heldChambers.add(1);
  assert.ok(!reached(spreadSound({ row: 3, col: 1 }, 4), 1, 19), 'the far end is sealed');
  state.floor.heldChambers = new Set([0]);
  assert.ok(!reached(spreadSound({ row: 3, col: 1 }, 4), 1, 19), 'the near end is sealed');
});

test('a stick man the sound reaches goes to where it was made and searches', () => {
  resetFloor();
  state.floor.playerRow = 5;
  // A HUSK: too big for the ducts (step C), so it walks.
  const m = spawnMinion({ row: 3, col: 17 }, 'HUSK');
  m.goal = { row: 10, col: 19 };
  const events = makeNoise('reload');
  assert.equal(events[0].type, 'noiseMade');
  assert.ok(events.some(e => e.type === 'noiseHeard' && e.minion === m), 'heard through the grate');
  assert.deepEqual(m.lastSeen, { row: 5, col: 1 });
  assert.equal(m.track, MINION_TRACK_TURNS);
  assert.equal(m.goal, null, 'its idle plan is dropped');
  const before = m.row + m.col;
  advanceMonsters();
  assert.ok(m.lastSeen, 'still walking to the sound');
  assert.notEqual(m.row + m.col, before, 'it moved');
});

test('a stick man beyond the sound does not hear it', () => {
  resetFloor();
  const m = spawnMinion({ row: 19, col: 19 }, 'SHARD');
  const events = makeNoise('struggle');
  assert.ok(!events.some(e => e.type === 'noiseHeard'));
  assert.equal(m.lastSeen, null);
  assert.equal(m.track, 0);
});

test('a stick man that can see the player ignores the sound', () => {
  resetFloor();
  toggleLight();
  computeVisibility();
  const m = spawnMinion({ row: 16, col: 1 }, 'SHARD');
  assert.ok(!makeNoise('backfire').some(e => e.type === 'noiseHeard'));
  assert.equal(m.lastSeen, null);
});

test('the hunter and the tutorial stick man do not need to hear', () => {
  resetFloor();
  const hunter = spawnMinion({ row: 17, col: 3 }, null);
  hunter.kind = 'hunter';
  const tutorial = spawnMinion({ row: 17, col: 4 }, 'SHARD');
  tutorial.hunts = true;
  assert.ok(!makeNoise('gate').some(e => e.type === 'noiseHeard'));
});

test('DEV -> Noise off: mistakes are quiet', () => {
  resetFloor();
  state.settings.noise = false;
  spawnMinion({ row: 17, col: 1 }, 'SHARD');
  assert.deepEqual(makeNoise('relay'), []);
});

test('in Comfort mode a stick man still goes to the sound and searches', () => {
  resetFloor();
  state.settings.simpleEnemies = true;
  state.floor.playerRow = 5;
  const m = spawnMinion({ row: 3, col: 17 }, 'SHARD');
  makeNoise('reload');
  assert.deepEqual(m.lastSeen, { row: 5, col: 1 });
  // The player slips away, out of its chase range.
  state.floor.playerRow = 19;
  state.floor.playerCol = 6;
  let turns = 0;
  while (m.lastSeen && turns < 40) {
    advanceMonsters();
    turns++;
  }
  assert.equal(m.lastSeen, null, 'it got there');
  for (let i = 0; i < MINION_TRACK_TURNS; i++) advanceMonsters();
  assert.equal(m.track, 0, 'its search ran down');
});

test('a wrong reload answer makes the jam\'s noise', () => {
  resetFloor();
  state.battle.currentQuestion = { question: 'q', meaning: 'a', source: 's' };
  const events = settleReload(false, { energy: 2 });
  const noise = events.find(e => e.type === 'noiseMade');
  assert.ok(noise);
  assert.equal(noise.kind, 'reload');
  assert.equal(Math.max(...noise.tiles.map(t => t.d)), NOISE_RANGES.reload);
});
