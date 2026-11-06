// Unit tests for the rule modules (no DOM): sight.js, passage.js,
// moves.js enterTile.
//
// Run: node --test tests/*.test.mjs
//
// Uses Node's built-in test runner — no dependencies. Each test sets up a
// small open floor on the shared `state` with resetFloor() and adds only the
// walls, pillars or things it needs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { REVEAL_DISTANCE } from '../js/config.js';
import { computeVisibility, canMakeOut } from '../js/sight.js';
import { whatBlocks } from '../js/passage.js';
import { enterTile } from '../js/moves.js';

// An open size x size floor, player in the middle facing north, fog on,
// nothing else on it.
function resetFloor(size = 21) {
  emptyFloor(size, {
    settings: { fogEnabled: true },
    see: false,
  });
}

// A tile relative to the player.
function rel(dr, dc) {
  return key(state.floor.playerRow + dr, state.floor.playerCol + dc);
}

// --- sight.js: computeVisibility ---

test('the ship is lit everywhere: every open tile is seen and remembered, no wall is', () => {
  resetFloor(9);
  state.floor.wallSet.add(rel(-1, 0));
  computeVisibility();
  assert.equal(state.floor.visibleSet.size, 9 * 9 - 1);
  assert.ok(!state.floor.visibleSet.has(rel(-1, 0)));
  assert.ok(state.floor.visibleSet.has(rel(-2, 0)), 'behind the wall too');
  assert.equal(state.floor.exploredSet.size, 9 * 9 - 1);
});

// --- sight.js: canMakeOut ---

test('with fog off, everything can be made out', () => {
  resetFloor();
  state.settings.fogEnabled = false;
  computeVisibility();
  assert.ok(canMakeOut(0, 0));
});

test('a tile in sight with a clear line can be made out', () => {
  resetFloor();
  computeVisibility();
  assert.ok(canMakeOut(state.floor.playerRow - 2, state.floor.playerCol + 1));
});

test('a pillar in the line of view hides what is behind it', () => {
  resetFloor();
  state.floor.pillarSet.add(rel(-1, 0));
  computeVisibility();
  // Lit, but the straight line to it passes the pillar.
  assert.ok(!canMakeOut(state.floor.playerRow - 2, state.floor.playerCol + 1));
});

test('too far cannot be made out', () => {
  resetFloor();
  computeVisibility();
  assert.ok(!canMakeOut(state.floor.playerRow - REVEAL_DISTANCE - 1, state.floor.playerCol));
});

test('a paper once made out stays identified after the player walks off', () => {
  resetFloor();
  const near = { row: state.floor.playerRow - 2, col: state.floor.playerCol, kind: 'paper', identified: false };
  const far = { row: state.floor.playerRow - REVEAL_DISTANCE - 1, col: state.floor.playerCol, kind: 'paper', identified: false };
  state.floor.props = [near, far];
  computeVisibility();
  assert.ok(near.identified);
  assert.ok(!far.identified);
  state.floor.playerRow += 8;
  computeVisibility();
  assert.ok(near.identified);
});

// --- passage.js ---

test('open floor does not block; the edge, walls and pillars do', () => {
  resetFloor(11);
  state.floor.wallSet.add(key(1, 1));
  state.floor.pillarSet.add(key(2, 2));
  assert.equal(whatBlocks(5, 5), null);
  assert.deepEqual(whatBlocks(-1, 5), { kind: 'wall' });
  assert.deepEqual(whatBlocks(5, 11), { kind: 'wall' });
  assert.deepEqual(whatBlocks(1, 1), { kind: 'wall' });
  assert.deepEqual(whatBlocks(2, 2), { kind: 'pillar' });
});

test('furniture and a shut shutter block; an open shutter is floor', () => {
  resetFloor(11);
  const desk = { row: 7, col: 7, kind: 'furniture' };
  const shut = { row: 8, col: 8, kind: 'shutter', up: false };
  state.floor.props = [desk, shut, { row: 9, col: 9, kind: 'shutter', up: true }];
  assert.deepEqual(whatBlocks(7, 7), { kind: 'furniture', thing: desk });
  assert.deepEqual(whatBlocks(8, 8), { kind: 'prop', thing: shut });
  assert.equal(whatBlocks(9, 9), null);
});

// --- moves.js: enterTile ---

// Moves the player one tile north, as free walking does, and returns what
// the new tile holds.
function stepNorth() {
  state.floor.playerRow -= 1;
  return enterTile('N');
}

test('the first step into a room fires roomEntered once', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.chamberAt.set(key(r - 1, c), 0);
  state.floor.chamberAt.set(key(r - 2, c), 0);
  const first = stepNorth();
  assert.deepEqual(first.map(e => e.type), ['stepped', 'roomEntered']);
  assert.equal(first[1].name, null, 'a room without a name');
  assert.deepEqual(stepNorth().map(e => e.type), ['stepped']);
});

test('on a fixed plan, roomEntered carries the room\'s name', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.chamberAt.set(key(r - 1, c), 0);
  state.floor.chamberNames = ['plan.ship.galley'];
  const entered = stepNorth().find(e => e.type === 'roomEntered');
  assert.equal(entered.name, 'plan.ship.galley');
});
