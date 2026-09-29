// Unit tests for the rule modules (no DOM): sight.js, light.js, passage.js,
// combat.js.
//
// Run: node --test tests/*.test.mjs
//
// Uses Node's built-in test runner — no dependencies. Each test sets up a
// small open floor on the shared `state` with resetFloor() and adds only the
// walls, pillars or things it needs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import {
  PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, REVEAL_DISTANCE, VIEWPORT_SIZE,
  LIGHT_TURNS_PER_STEP, MINION_CHASE_RANGE, HUNTER_SPAWN_DELAY,
} from '../js/config.js';
import { computeVisibility, canMakeOut, updateCamera } from '../js/sight.js';
import {
  initBossLight, advanceLight, extinguishLight, lightCoverage, lightProgress, lightConsumed,
} from '../js/light.js';
import { whatBlocks } from '../js/passage.js';
import { advanceMonsters, spawnMinion } from '../js/combat.js';

// An open size x size floor, player in the middle facing north, fog on,
// nothing else on it.
function resetFloor(size = 21) {
  state.GRID_SIZE = size;
  state.roomIndex = 0;
  state.playerRow = Math.floor(size / 2);
  state.playerCol = Math.floor(size / 2);
  state.facing = 'N';
  state.fogEnabled = true;
  state.darkness = false;
  state.wallSet = new Set();
  state.pillarSet = new Set();
  state.bossLitSet = new Set();
  state.visibleSet = new Set();
  state.sightSet = new Set();
  state.exploredSet = new Set();
  state.boss = null;
  state.hunter = null;
  state.minions = [];
  state.chest = null;
  state.rune = null;
  state.encounters = [];
  state.props = [];
  state.selectedTarget = null;
  state.turnCount = 0;
  state.darkTurns = 0;
}

// A tile relative to the player.
function rel(dr, dc) {
  return key(state.playerRow + dr, state.playerCol + dc);
}

// --- sight.js: computeVisibility ---

test('the player always sees their own tile', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.visibleSet.has(rel(0, 0)));
  assert.ok(state.sightSet.has(rel(0, 0)));
});

test('the light radius reaches every side, even behind the player', () => {
  resetFloor();
  computeVisibility();
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.ok(state.sightSet.has(rel(dr * PLAYER_LIGHT_RADIUS, dc * PLAYER_LIGHT_RADIUS)));
  }
  // Behind, past the radius: dark.
  assert.ok(!state.visibleSet.has(rel(PLAYER_LIGHT_RADIUS + 1, 0)));
});

test('the facing cone reaches PLAYER_CONE_RANGE ahead and widens, but no further', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.sightSet.has(rel(-PLAYER_CONE_RANGE, 0)));
  assert.ok(!state.visibleSet.has(rel(-PLAYER_CONE_RANGE - 1, 0)));
  // Two ahead, one across: inside the widening cone (lateral <= forward).
  assert.ok(state.sightSet.has(rel(-2, 1)));
  // One ahead, two across: outside the cone and past the radius.
  assert.ok(!state.visibleSet.has(rel(-1, 2)));
});

test('turning changes which way the cone points', () => {
  resetFloor();
  state.facing = 'E';
  computeVisibility();
  assert.ok(state.sightSet.has(rel(0, PLAYER_CONE_RANGE)));
  assert.ok(!state.visibleSet.has(rel(-PLAYER_CONE_RANGE, 0)));
});

test('walls block the light and are not lit themselves', () => {
  resetFloor();
  for (let c = 0; c < state.GRID_SIZE; c++) state.wallSet.add(key(state.playerRow - 2, c));
  computeVisibility();
  assert.ok(state.sightSet.has(rel(-1, 0)));
  assert.ok(!state.visibleSet.has(rel(-2, 0)));
  assert.ok(!state.visibleSet.has(rel(-3, 0)));
});

test('a pillar is lit but casts a shadow behind it', () => {
  resetFloor();
  state.pillarSet.add(rel(-2, 0));
  computeVisibility();
  assert.ok(state.sightSet.has(rel(-2, 0)));
  assert.ok(!state.visibleSet.has(rel(-3, 0)));
});

test("the boss's light is visible but is not the player's sight", () => {
  resetFloor();
  const far = key(0, 0);
  state.bossLitSet = new Set([far]);
  computeVisibility();
  assert.ok(state.visibleSet.has(far));
  assert.ok(!state.sightSet.has(far));
});

test('visible tiles are remembered, except in the darkness', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.exploredSet.has(rel(-1, 0)));

  resetFloor();
  state.darkness = true;
  computeVisibility();
  assert.equal(state.exploredSet.size, 0);
});

// --- sight.js: canMakeOut ---

test('with fog off, everything can be made out', () => {
  resetFloor();
  state.fogEnabled = false;
  computeVisibility();
  assert.ok(canMakeOut(0, 0));
});

test('a tile in sight with a clear line can be made out', () => {
  resetFloor();
  computeVisibility();
  assert.ok(canMakeOut(state.playerRow - 2, state.playerCol + 1));
});

test('a pillar in the line of view hides what is behind it', () => {
  resetFloor();
  state.pillarSet.add(rel(-1, 0));
  computeVisibility();
  // Still lit, around the pillar's side...
  assert.ok(state.sightSet.has(rel(-2, 1)));
  // ...but the straight line to it passes the pillar.
  assert.ok(!canMakeOut(state.playerRow - 2, state.playerCol + 1));
});

test('only boss light, or too far, cannot be made out', () => {
  resetFloor();
  state.bossLitSet = new Set([rel(-1, 3)]);
  computeVisibility();
  assert.ok(!canMakeOut(state.playerRow - 1, state.playerCol + 3));
  assert.ok(!canMakeOut(state.playerRow - REVEAL_DISTANCE - 1, state.playerCol));
});

// --- sight.js: updateCamera ---

test('the camera centres on the player', () => {
  resetFloor(33);
  updateCamera();
  const half = Math.floor(VIEWPORT_SIZE / 2);
  assert.equal(state.camRow, state.playerRow - half);
  assert.equal(state.camCol, state.playerCol - half);
});

test("the camera never shows past the floor's edge", () => {
  resetFloor(33);
  state.playerRow = 0;
  state.playerCol = 32;
  updateCamera();
  assert.equal(state.camRow, 0);
  assert.equal(state.camCol, 33 - VIEWPORT_SIZE);
});

// --- light.js ---

function openFloorWithBoss(size = 11) {
  resetFloor(size);
  const mid = Math.floor(size / 2);
  state.boss = { row: mid, col: mid, hp: 1 };
  initBossLight();
  return mid;
}

test('the boss light starts at radius 1 and spreads one step every LIGHT_TURNS_PER_STEP turns', () => {
  const mid = openFloorWithBoss();
  assert.equal(state.floorCount, 11 * 11);
  assert.equal(state.bossLitSet.size, 5); // the boss tile and its four neighbours
  for (let i = 0; i < LIGHT_TURNS_PER_STEP * 2 - 1; i++) advanceLight();
  assert.equal(state.bossLitSet.size, 5);
  advanceLight();
  assert.equal(state.bossLitSet.size, 13); // radius 2 diamond
  assert.ok(state.bossLitSet.has(key(mid - 2, mid)));
  assert.ok(lightCoverage() > 0 && lightCoverage() < 1);
});

test('the run is lost exactly when the turn budget runs out', () => {
  openFloorWithBoss();
  assert.equal(lightProgress(), 0);
  for (let i = 0; i < state.lightTurnBudget - 1; i++) advanceLight();
  assert.ok(!lightConsumed());
  advanceLight();
  assert.ok(lightConsumed());
  assert.equal(lightProgress(), 1);
});

test('walls stop the light spreading', () => {
  resetFloor(11);
  for (let r = 0; r < 11; r++) state.wallSet.add(key(r, 3));
  state.boss = { row: 5, col: 8, hp: 1 };
  initBossLight();
  assert.equal(state.floorCount, 11 * 7); // columns 4..10 only
  assert.ok(!state.bossDist.has(key(5, 1)));
});

test('with no boss the light does nothing, and extinguishing clears it', () => {
  openFloorWithBoss();
  extinguishLight();
  assert.equal(state.bossLitSet.size, 0);
  state.boss = null;
  const turns = state.lightTurns;
  advanceLight();
  assert.equal(state.lightTurns, turns);
  assert.equal(lightProgress(), 0);
  assert.ok(!lightConsumed());
});

// --- passage.js ---

test('open floor does not block; the edge, walls and pillars do', () => {
  resetFloor(11);
  state.wallSet.add(key(1, 1));
  state.pillarSet.add(key(2, 2));
  assert.equal(whatBlocks(5, 5), null);
  assert.deepEqual(whatBlocks(-1, 5), { kind: 'wall' });
  assert.deepEqual(whatBlocks(5, 11), { kind: 'wall' });
  assert.deepEqual(whatBlocks(1, 1), { kind: 'wall' });
  assert.deepEqual(whatBlocks(2, 2), { kind: 'pillar' });
});

test('actors block and report what they are', () => {
  resetFloor(11);
  const minion = { row: 3, col: 3 };
  const encounter = { row: 4, col: 4 };
  state.boss = { row: 1, col: 5 };
  state.hunter = { row: 2, col: 5 };
  state.minions = [minion];
  state.chest = { row: 6, col: 6 };
  state.rune = { row: 7, col: 7 };
  state.encounters = [encounter];
  assert.equal(whatBlocks(1, 5).kind, 'boss');
  assert.equal(whatBlocks(2, 5).kind, 'hunter');
  assert.equal(whatBlocks(3, 3).thing, minion);
  assert.equal(whatBlocks(4, 4).thing, encounter);
  assert.equal(whatBlocks(6, 6).kind, 'chest');
  assert.equal(whatBlocks(7, 7).kind, 'rune');
});

test('boxes block but papers lie flat', () => {
  resetFloor(11);
  const box = { row: 8, col: 8, kind: 'box' };
  state.props = [box, { row: 9, col: 9, kind: 'paper' }];
  assert.deepEqual(whatBlocks(8, 8), { kind: 'prop', thing: box });
  assert.equal(whatBlocks(9, 9), null);
});

// --- combat.js: advanceMonsters ---

// The things of one type in an advanceMonsters() events list.
const ofType = (events, type, field) => events.filter(e => e.type === type).map(e => e[field]);

test('a minion within chase range steps toward the player and is reported as moved', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.playerRow - MINION_CHASE_RANGE, col: state.playerCol });
  const events = advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: state.playerRow - MINION_CHASE_RANGE + 1, col: state.playerCol });
  assert.deepEqual(events, [{ type: 'minionMoved', minion: m }]);
  assert.equal(state.turnCount, 1);
});

test('a minion next to the player engages from where it stands', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.playerRow - 1, col: state.playerCol });
  const events = advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: state.playerRow - 1, col: state.playerCol });
  assert.deepEqual(ofType(events, 'minionMoved', 'minion'), []);
  assert.equal(state.selectedTarget, m);
});

test('an engaging minion is reported as minionEngaged, in turn order', () => {
  resetFloor(21);
  const near = spawnMinion({ row: state.playerRow - 1, col: state.playerCol });
  const far = spawnMinion({ row: state.playerRow + 2, col: state.playerCol });
  const events = advanceMonsters();
  assert.deepEqual(events, [
    { type: 'minionEngaged', minion: near },
    { type: 'minionMoved', minion: far },
  ]);
});

test('a resting minion waits out its rest', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.playerRow - 2, col: state.playerCol });
  m.rest = 1;
  assert.deepEqual(advanceMonsters(), []);
  assert.equal(m.rest, 0);
  assert.deepEqual(ofType(advanceMonsters(), 'minionMoved', 'minion'), [m]);
});

test('the hunter wakes HUNTER_SPAWN_DELAY turns into the darkness, far from the player', () => {
  resetFloor(21);
  state.darkness = true;
  for (let i = 1; i < HUNTER_SPAWN_DELAY; i++) {
    assert.deepEqual(ofType(advanceMonsters(), 'hunterWoke', 'hunter'), []);
    assert.equal(state.hunter, null);
  }
  const events = advanceMonsters();
  const woke = ofType(events, 'hunterWoke', 'hunter');
  assert.equal(woke.length, 1);
  const hunter = woke[0];
  // It wakes first, then takes its first step in the same turn.
  assert.equal(events[0].type, 'hunterWoke');
  assert.equal(state.hunter, hunter);
  assert.equal(hunter.kind, 'hunter');
  assert.ok(state.minions.includes(hunter));
  // Woke in a corner, so it's still far off after its first step.
  const steps = Math.abs(hunter.row - state.playerRow) + Math.abs(hunter.col - state.playerCol);
  assert.ok(steps >= 18, 'hunter is ' + steps + ' steps away');
  // Only ever one.
  assert.deepEqual(ofType(advanceMonsters(), 'hunterWoke', 'hunter'), []);
});
