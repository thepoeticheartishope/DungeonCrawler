// Unit tests for free look (js/look.js) and the look cone (sight.js
// inLookCone): the free arc, turning the body, the look kept on a walk,
// the bump rule, and the cone matching the old diamond when looking
// straight along a way.
//
// Run: node --test tests/*.test.mjs
//
// Same set-up as rules.test.mjs: a small open floor on the shared `state`,
// reset before each test.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { LOOK_FREE_ARC, PLAYER_CONE_RANGE } from '../js/config.js';
import { computeVisibility, inLookCone, FACING_VECTORS } from '../js/sight.js';
import { BODY_ANGLES, lookAngle, aimLook, wantsTurn, turnBody } from '../js/look.js';
import { stepPlayer } from '../js/moves.js';

// An open size x size floor, player in the middle facing north, free look
// on, nothing else on it.
function resetFloor(size = 21) {
  state.floor.GRID_SIZE = size;
  state.run.roomIndex = 0;
  state.run.resting = false;
  state.floor.playerRow = Math.floor(size / 2);
  state.floor.playerCol = Math.floor(size / 2);
  state.floor.facing = 'N';
  state.floor.look = 0;
  state.settings.freeLook = true;
  state.settings.fogEnabled = true;
  state.settings.gunCombat = false;
  state.settings.turnBeforeStep = false;
  state.floor.darkness = false;
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.bossLitSet = new Set();
  state.floor.exploredSet = new Set();
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.minions = [];
  state.floor.chest = null;
  state.floor.props = [];
  state.floor.coin = null;
  state.floor.keys = [];
  state.floor.stairs = null;
  state.floor.stairsAlt = null;
  state.floor.exchange = null;
  state.floor.chamberAt = new Map();
  state.floor.visitedChambers = new Set();
  computeVisibility();
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

test('aiming costs no turn and moves the cone', () => {
  resetFloor();
  const turns = state.run.turnCount;
  const eastFar = key(state.floor.playerRow - 1, state.floor.playerCol + 3);
  assert.ok(!state.floor.sightSet.has(eastFar), 'out of the straight cone');
  aimLook(LOOK_FREE_ARC);
  assert.ok(state.floor.sightSet.has(eastFar), 'in it once looking 30° east');
  assert.equal(state.run.turnCount, turns);
});

test('free look off: the light stays where the body faces', () => {
  resetFloor();
  state.settings.freeLook = false;
  aimLook(25 * DEG);
  assert.equal(lookAngle(), 0);
  assert.ok(!wantsTurn());
  assert.deepEqual(turnBody(), []);
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

test('walking a new way keeps the look as far as the new arc allows', () => {
  resetFloor();
  aimLook(20 * DEG);
  stepPlayer(0, 1); // east
  assert.equal(state.floor.facing, 'E');
  assert.ok(near(lookAngle(), BODY_ANGLES.E - LOOK_FREE_ARC), 'held at the new arc\'s north edge');
  stepPlayer(0, 1);
  assert.ok(near(lookAngle(), BODY_ANGLES.E - LOOK_FREE_ARC), 'and kept while walking on');
  aimLook(BODY_ANGLES.E);
  stepPlayer(-1, 0); // north
  assert.ok(near(lookAngle(), LOOK_FREE_ARC));
});

test('free look off: walking a new way points the light straight ahead', () => {
  resetFloor();
  state.settings.freeLook = false;
  stepPlayer(0, 1);
  assert.equal(lookAngle(), BODY_ANGLES.E);
  state.settings.freeLook = true;
  assert.equal(lookAngle(), BODY_ANGLES.E, 'turning it on later doesn\'t jump');
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
  state.settings.freeLook = false;
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type), ['turned', 'blocked'], 'free look off: free, as before');
});

test('DEV turn-first stays free', () => {
  resetFloor();
  state.settings.turnBeforeStep = true;
  assert.deepEqual(stepPlayer(0, 1).map(e => e.type), ['turned']);
  state.settings.turnBeforeStep = false;
});

test('looking straight along a way, the cone lights exactly the old diamond', () => {
  resetFloor();
  const reach = 2 * PLAYER_CONE_RANGE;
  for (const [facing, [fr, fc]] of Object.entries(FACING_VECTORS)) {
    state.floor.facing = facing;
    state.floor.look = BODY_ANGLES[facing];
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const forward = dr * fr + dc * fc;
        const lateral = dr * fc - dc * fr;
        const diamond = forward >= 0 && Math.abs(lateral) <= forward;
        const cone = inLookCone(state.floor.playerRow + dr, state.floor.playerCol + dc);
        assert.equal(cone, diamond, `${facing} ${dr},${dc}`);
      }
    }
  }
});
