// Unit tests for free look (js/look.js): the free arc, turning the body,
// the look recentred on a walk, the bump rule and the shoulder view's
// sweep (one turn per body turn).
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as rules.test.mjs: a small open floor on the shared `state`,
// reset before each test.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { LOOK_FREE_ARC } from '../js/config.js';
import { BODY_ANGLES, lookAngle, aimLook, wantsTurn, turnBody, sweepLook } from '../js/look.js';
import { stepPlayer } from '../js/moves.js';

// These are the turn game's rules (the start screen's Turns option): One
// stick, the default since one stick plan step G, has its own tests.
state.settings.oneStick = false;

// An open size x size floor, player in the middle facing north, free look
// on, nothing else on it.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { fogEnabled: true },
    floor: { look: 0 },
  });
}

const DEG = Math.PI / 180;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the light follows the aim, held inside the free arc', () => {
  resetFloor();
  aimLook(20 * DEG);
  assert.ok(near(lookAngle(), 20 * DEG));
  assert.ok(!wantsTurn());
  aimLook(80 * DEG);
  assert.ok(near(lookAngle(), LOOK_FREE_ARC), 'held at the arc\'s edge');
  assert.ok(wantsTurn(), 'past the arc a turn is wanted');
  aimLook(-80 * DEG);
  assert.ok(near(lookAngle(), -LOOK_FREE_ARC));
});

test('aiming costs no turn', () => {
  resetFloor();
  const turns = state.run.turnCount;
  aimLook(LOOK_FREE_ARC);
  assert.equal(state.run.turnCount, turns);
});

test('turnBody picks the way closest to the aim', () => {
  resetFloor();
  assert.deepEqual(turnBody(), [], 'no turn wanted, no turn');
  aimLook(70 * DEG);
  assert.deepEqual(turnBody(), [{ type: 'bodyTurned', facing: 'E' }]);
  assert.equal(state.floor.facing, 'E');
  assert.ok(near(lookAngle(), 70 * DEG), 'the light now reaches the aim');
  aimLook(-170 * DEG);
  assert.deepEqual(turnBody(), [{ type: 'bodyTurned', facing: 'S' }]);
});

test('walking points the light straight ahead again', () => {
  resetFloor();
  aimLook(20 * DEG);
  stepPlayer(-1, 0); // north, the way the body faces
  assert.equal(lookAngle(), BODY_ANGLES.N, 'a step straight on recentres');
  aimLook(-25 * DEG);
  stepPlayer(0, 1); // east
  assert.equal(state.floor.facing, 'E');
  assert.equal(lookAngle(), BODY_ANGLES.E, 'a turn by walking recentres');
  assert.ok(!wantsTurn());
});

test('a bump that turns the body is a spent turn; a bump straight ahead is free', () => {
  resetFloor();
  state.floor.wallSet.add(key(state.floor.playerRow, state.floor.playerCol + 1));
  state.floor.wallSet.add(key(state.floor.playerRow - 1, state.floor.playerCol));
  const turned = stepPlayer(0, 1);
  assert.deepEqual(turned.map(e => e.type), ['turned', 'blocked', 'bodyTurned']);
  assert.equal(turned.at(-1).bumped, true);
  const ahead = stepPlayer(0, 1);
  assert.deepEqual(ahead.map(e => e.type), ['blocked'], 'already facing it: free');
});

test('turnBody picks among 8 ways', () => {
  resetFloor();
  aimLook(50 * DEG);
  assert.deepEqual(turnBody(), [{ type: 'bodyTurned', facing: 'NE' }]);
  aimLook(-140 * DEG);
  assert.deepEqual(turnBody(), [{ type: 'bodyTurned', facing: 'SW' }]);
});

// Sweeps `degrees` in one-degree steps, as the shoulder view's held sweep
// does frame by frame, and counts the body turns it reported.
function sweep(degrees) {
  let turns = 0;
  for (let i = 0; i < Math.abs(degrees); i++) {
    turns += sweepLook(Math.sign(degrees) * DEG).filter(e => e.type === 'bodyTurned').length;
  }
  return turns;
}

test('sweeping inside the free arc spends no turn', () => {
  resetFloor();
  assert.equal(sweep(25), 0);
  assert.equal(state.floor.facing, 'N');
  assert.ok(near(lookAngle(), 25 * DEG));
});

test('sweeping past the arc spends exactly one turn per body turn', () => {
  resetFloor();
  assert.equal(sweep(90), 2);
  assert.equal(state.floor.facing, 'E');
  assert.ok(Math.abs(lookAngle() - 90 * DEG) < 1e-6, 'the light swept on without a jump');
  assert.equal(sweep(-180), 4);
  assert.equal(state.floor.facing, 'W');
});
