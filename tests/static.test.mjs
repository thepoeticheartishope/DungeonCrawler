// Unit tests for static.js: how strong the static is by the closest
// stick man's walking steps, walls between, ducts, and the DEV switch.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { STATIC } from '../js/config.js';
import { staticLevel } from '../js/static.js';

// A 15x15 open floor with a wall down column 7 from row 0 to row 12, so
// the only way round is along rows 13-14. The player stands at (6, 6).
function resetFloor() {
  const f = state.floor;
  f.GRID_SIZE = 15;
  state.settings.staticNoise = true;
  state.settings.eightWays = true;
  f.wallSet = new Set();
  for (let r = 0; r <= 12; r++) f.wallSet.add(key(r, 7));
  f.minions = [];
  f.crawling = [];
  f.playerRow = 6;
  f.playerCol = 6;
}

const stickMan = (row, col) => ({ row, col });

test('no stick man, or one at startSteps or further, makes no static', () => {
  resetFloor();
  assert.equal(staticLevel(), 0);
  state.floor.minions = [stickMan(6 - STATIC.startSteps, 6)];
  assert.equal(staticLevel(), 0);
});

test('it rises as the closest one nears and is full beside the player', () => {
  resetFloor();
  state.floor.minions = [stickMan(2, 6)];
  const far = staticLevel();
  state.floor.minions = [stickMan(4, 6)];
  const near = staticLevel();
  state.floor.minions = [stickMan(5, 6)];
  assert.ok(far > 0 && far < near && near < 1);
  assert.equal(staticLevel(), 1);
});

test('the closest one counts, not the first', () => {
  resetFloor();
  state.floor.minions = [stickMan(2, 6), stickMan(5, 5)];
  assert.equal(staticLevel(), 1);
});

test('walking steps: one just through a wall but far round it is quiet', () => {
  resetFloor();
  state.floor.minions = [stickMan(6, 8)];
  assert.equal(staticLevel(), 0, 'two tiles away in a line, but the walk round is 7+ steps');
});

test('one in a duct is not on the floor, so it makes none', () => {
  resetFloor();
  state.floor.crawling = [stickMan(5, 6)];
  assert.equal(staticLevel(), 0);
});

test('DEV -> Static off makes none', () => {
  resetFloor();
  state.floor.minions = [stickMan(5, 6)];
  state.settings.staticNoise = false;
  assert.equal(staticLevel(), 0);
});
