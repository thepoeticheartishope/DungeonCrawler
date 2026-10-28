// Unit tests for an idle stick man's walk (smarter enemies step 2,
// combat.js idleStep): off to a spot in another room, standing there a
// few turns, then the next; never into a room it can't reach.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyFloor, twoRooms } from './helpers.mjs';
import { state, key } from '../js/state.js';
import { MINION_LINGER_TURNS } from '../js/config.js';
import { advanceMonsters, spawnMinion } from '../js/combat.js';
import { toggleLight } from '../js/battery.js';
import { computeVisibility } from '../js/sight.js';

// A 21x21 floor: room 0 on the left (cols 1-6), room 1 on the right
// (cols 14-19), joined by a hallway along row 10 (no room). Walls
// everywhere else. The player stands far down room 0, light off, so no
// stick man notices them.
function resetFloor() {
  emptyFloor(21, {
    settings: { fogEnabled: true, lightBattery: true, simpleEnemies: false, gaze: true },
    see: false,
  });
  twoRooms();
  state.floor.look = 0;
  toggleLight();
  computeVisibility();
}

test('an idle stick man walks to a spot in another room, then stands there', () => {
  resetFloor();
  const m = spawnMinion({ row: 2, col: 3 });
  advanceMonsters();
  assert.ok(m.goal, 'it picked a goal');
  assert.equal(state.floor.chamberAt.get(key(m.goal.row, m.goal.col)), 1, 'in the other room');
  const goal = { ...m.goal };
  for (let i = 0; i < 40 && m.goal; i++) advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, goal, 'it got there');
  const [min, max] = MINION_LINGER_TURNS;
  assert.ok(m.linger >= min && m.linger <= max, 'and lingers');
  const where = { row: m.row, col: m.col };
  const turns = m.linger;
  for (let i = 0; i < turns; i++) advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, where, 'standing still while it lingers');
  advanceMonsters();
  assert.equal(state.floor.chamberAt.get(key(m.goal.row, m.goal.col)), 0, 'then off to the next room');
});

test('a room held by a relay is never a goal; with no room left it steps at random', () => {
  resetFloor();
  state.floor.heldChambers.add(1);
  const m = spawnMinion({ row: 2, col: 3 });
  advanceMonsters();
  assert.equal(m.goal, null);
  assert.ok(Math.max(Math.abs(m.row - 2), Math.abs(m.col - 3)) === 1, 'a random step');
});

test('a chase drops the idle plan', () => {
  resetFloor();
  const m = spawnMinion({ row: 2, col: 3 });
  advanceMonsters();
  assert.ok(m.goal);
  state.settings.simpleEnemies = true; // Comfort mode: the 4-step chase
  state.floor.playerRow = m.row + 3;
  state.floor.playerCol = m.col;
  advanceMonsters();
  assert.equal(m.goal, null);
});
