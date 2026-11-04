// Unit tests for the rule modules (no DOM): sight.js, passage.js,
// moves.js.
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
import { PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, REVEAL_DISTANCE, DARK_GOLD_MULTIPLIER } from '../js/config.js';
import { computeVisibility, canMakeOut, shootBlock, canShoot } from '../js/sight.js';
import { whatBlocks, canPassCorner, stepsAway } from '../js/passage.js';
import { stepPlayer, goldReward } from '../js/moves.js';

// These are the turn game's rules (the start screen's Turns option): One
// stick, the default since one stick plan step G, has its own tests.
state.settings.oneStick = false;

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

test('the player always sees their own tile', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.floor.visibleSet.has(rel(0, 0)));
  assert.ok(state.floor.sightSet.has(rel(0, 0)));
});

test('the light radius reaches every side, even behind the player', () => {
  resetFloor();
  computeVisibility();
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.ok(state.floor.sightSet.has(rel(dr * PLAYER_LIGHT_RADIUS, dc * PLAYER_LIGHT_RADIUS)));
  }
  // Behind, past the radius: dark.
  assert.ok(!state.floor.visibleSet.has(rel(PLAYER_LIGHT_RADIUS + 1, 0)));
});

test('the facing cone reaches PLAYER_CONE_RANGE ahead and widens, but no further', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.floor.sightSet.has(rel(-PLAYER_CONE_RANGE, 0)));
  assert.ok(!state.floor.visibleSet.has(rel(-PLAYER_CONE_RANGE - 1, 0)));
  // Two ahead, one across: inside the widening cone (lateral <= forward).
  assert.ok(state.floor.sightSet.has(rel(-2, 1)));
  // One ahead, two across: outside the cone and past the radius.
  assert.ok(!state.floor.visibleSet.has(rel(-1, 2)));
});

test('turning changes which way the cone points', () => {
  resetFloor();
  state.floor.facing = 'E';
  computeVisibility();
  assert.ok(state.floor.sightSet.has(rel(0, PLAYER_CONE_RANGE)));
  assert.ok(!state.floor.visibleSet.has(rel(-PLAYER_CONE_RANGE, 0)));
});

test('walls block the light and are not lit themselves', () => {
  resetFloor();
  for (let c = 0; c < state.floor.GRID_SIZE; c++) state.floor.wallSet.add(key(state.floor.playerRow - 2, c));
  computeVisibility();
  assert.ok(state.floor.sightSet.has(rel(-1, 0)));
  assert.ok(!state.floor.visibleSet.has(rel(-2, 0)));
  assert.ok(!state.floor.visibleSet.has(rel(-3, 0)));
});

test('a pillar is lit but casts a shadow behind it', () => {
  resetFloor();
  state.floor.pillarSet.add(rel(-2, 0));
  computeVisibility();
  assert.ok(state.floor.sightSet.has(rel(-2, 0)));
  // Light creeps around the pillar's sides onto the tile just behind it,
  // but a clear view is still blocked, so it can't be made out...
  assert.ok(!canMakeOut(state.floor.playerRow - 3, state.floor.playerCol));
  // ...and further back, where the way around is too long, it stays dark.
  assert.ok(!state.floor.visibleSet.has(rel(-4, 0)));
});

test("the boss's light is visible but is not the player's sight", () => {
  resetFloor();
  const far = key(0, 0);
  state.floor.bossLitSet = new Set([far]);
  computeVisibility();
  assert.ok(state.floor.visibleSet.has(far));
  assert.ok(!state.floor.sightSet.has(far));
});

test('visible tiles are remembered, except in the darkness', () => {
  resetFloor();
  computeVisibility();
  assert.ok(state.floor.exploredSet.has(rel(-1, 0)));

  resetFloor();
  state.floor.darkness = true;
  computeVisibility();
  assert.equal(state.floor.exploredSet.size, 0);
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
  // Still lit, around the pillar's side...
  assert.ok(state.floor.sightSet.has(rel(-2, 1)));
  // ...but the straight line to it passes the pillar.
  assert.ok(!canMakeOut(state.floor.playerRow - 2, state.floor.playerCol + 1));
});

test('only boss light, or too far, cannot be made out', () => {
  resetFloor();
  state.floor.bossLitSet = new Set([rel(-1, 3)]);
  computeVisibility();
  assert.ok(!canMakeOut(state.floor.playerRow - 1, state.floor.playerCol + 3));
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

// --- sight.js: shootBlock / canShoot ---

// A thing relative to the player.
function at(dr, dc) {
  return { row: state.floor.playerRow + dr, col: state.floor.playerCol + dc };
}

test('a thing in the light with a clear line can be shot', () => {
  resetFloor();
  computeVisibility();
  assert.equal(shootBlock(at(-3, 1)), null);
  assert.ok(canShoot(at(-3, 1)));
  assert.ok(canShoot(at(-PLAYER_CONE_RANGE, 0)));
  assert.ok(state.floor.sightSet.has(key(at(1, 0).row, at(1, 0).col)), 'next to the player, even behind, is lit');
  assert.equal(shootBlock(at(1, 0)), 'notInLight', 'but lit only by standing beside them, it can\'t be shot (free look plan)');
  assert.equal(shootBlock(at(0, 1)), 'notInLight');
});

test('past the light\'s reach is out of range', () => {
  resetFloor();
  computeVisibility();
  assert.equal(shootBlock(at(-PLAYER_CONE_RANGE - 1, 0)), 'outOfRange');
  assert.equal(shootBlock(at(-4, 3)), 'outOfRange', 'reach counts walkable steps');
  assert.equal(shootBlock(at(PLAYER_CONE_RANGE + 1, 0)), 'outOfRange', 'behind and far is range, not light');
  assert.ok(!canShoot(at(-PLAYER_CONE_RANGE - 1, 0)));
});

test('in range but outside the cone is not in your light', () => {
  resetFloor();
  computeVisibility();
  assert.equal(shootBlock(at(2, 0)), 'notInLight');
  assert.equal(shootBlock(at(1, 1)), 'notInLight', 'a diagonal behind needs turning toward');
  assert.equal(shootBlock(at(-1, 3)), 'notInLight');
});

test('only the boss\'s light is not enough to shoot', () => {
  resetFloor();
  state.floor.bossLitSet = new Set([rel(2, 0)]);
  computeVisibility();
  assert.equal(shootBlock(at(2, 0)), 'notInLight');
});

test('a pillar in the line blocks the shot', () => {
  resetFloor();
  state.floor.pillarSet = new Set([rel(-1, 0)]);
  computeVisibility();
  // Lit by creeping round the pillar, but there's no straight line to it.
  assert.ok(state.floor.sightSet.has(rel(-2, 1)));
  assert.equal(shootBlock(at(-2, 1)), 'noLineOfSight');
  assert.ok(canShoot(at(-1, 0)), 'the pillar tile itself can be shot at');
});

// --- light.js ---

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

test('actors block and report what they are', () => {
  resetFloor(11);
  const minion = { row: 3, col: 3 };
  state.floor.boss = { row: 1, col: 5 };
  state.floor.hunter = { row: 2, col: 5 };
  state.floor.minions = [minion];
  state.floor.chest = { row: 6, col: 6 };
  assert.equal(whatBlocks(1, 5).kind, 'boss');
  assert.equal(whatBlocks(2, 5).kind, 'hunter');
  assert.equal(whatBlocks(3, 3).thing, minion);
  assert.equal(whatBlocks(6, 6).kind, 'chest');
});

test('boxes block but papers lie flat', () => {
  resetFloor(11);
  const box = { row: 8, col: 8, kind: 'box' };
  state.floor.props = [box, { row: 9, col: 9, kind: 'paper' }];
  assert.deepEqual(whatBlocks(8, 8), { kind: 'prop', thing: box });
  assert.equal(whatBlocks(9, 9), null);
});

// --- moves.js: stepPlayer ---

test('by default a press in a new direction turns and steps at once', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  assert.deepEqual(stepPlayer(1, 0).map(e => e.type), ['turned', 'stepped']);
  assert.equal(state.floor.facing, 'S');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r + 1, c]);
  // Toward a wall it turns and bumps in the same press; the turn is spent.
  state.floor.wallSet.add(key(r + 1, c + 1));
  assert.deepEqual(stepPlayer(0, 1).map(e => e.type), ['turned', 'blocked', 'bodyTurned']);
  assert.equal(state.floor.facing, 'E');
});

test('the coin pays goldReward(1), doubled in the darkness', () => {
  for (const darkness of [false, true]) {
    resetFloor();
    state.floor.darkness = darkness;
    state.floor.coin = { row: state.floor.playerRow - 1, col: state.floor.playerCol };
    const taken = stepPlayer(-1, 0).find(e => e.type === 'coinTaken');
    assert.equal(taken.gold, goldReward(1));
    assert.equal(taken.gold, darkness ? DARK_GOLD_MULTIPLIER : 1);
    assert.equal(state.run.coinsTotal, taken.gold);
    assert.equal(state.floor.coin, null);
  }
});

test('stepping on a key takes it and counts it among the floor\'s', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.keys = [{ row: r - 1, col: c }, { row: r - 2, col: c }, { row: r + 5, col: c }];
  const first = stepPlayer(-1, 0).find(e => e.type === 'keyTaken');
  assert.deepEqual(first, { type: 'keyTaken', held: 1, total: 3 });
  assert.equal(state.floor.keys.length, 2);
  const second = stepPlayer(-1, 0).find(e => e.type === 'keyTaken');
  assert.deepEqual(second, { type: 'keyTaken', held: 2, total: 3 });
  assert.equal(whatBlocks(r + 5, c), null, 'a key never blocks');
});

test('the first step into a room fires roomEntered once', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.chamberAt.set(key(r - 1, c), 0);
  state.floor.chamberAt.set(key(r - 2, c), 0);
  state.floor.chamberThemes = ['crypt'];
  const first = stepPlayer(-1, 0);
  assert.deepEqual(first.map(e => e.type), ['stepped', 'roomEntered']);
  assert.equal(first[1].theme, 'crypt');
  assert.equal(first[1].name, null, 'a random floor\'s room has no name');
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type), ['stepped']);
});

test('on a fixed plan, roomEntered carries the room\'s name', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.chamberAt.set(key(r - 1, c), 0);
  state.floor.chamberThemes = ['crypt'];
  state.floor.chamberNames = ['plan.school.library'];
  const entered = stepPlayer(-1, 0).find(e => e.type === 'roomEntered');
  assert.equal(entered.name, 'plan.school.library');
});

test('papers give the story in order, then their own roll', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.props = [1, 2, 3].map(d => ({ row: r - d, col: c, kind: 'paper', theme: 'crypt', loot: 'junk' }));
  state.run.loreQueue = ['story.a', 'story.b'];
  const read = () => stepPlayer(-1, 0).find(e => e.type === 'paperRead');
  assert.deepEqual([read(), read(), read()].map(e => [e.loot, e.story]),
    [['story', 'story.a'], ['story', 'story.b'], ['junk', undefined]]);
  assert.deepEqual(state.run.loreQueue, []);
});

// --- eight ways (eight ways plan step A) ---

test('a diagonal step walks and faces that way', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  const events = stepPlayer(-1, 1);
  assert.deepEqual(events.map(e => e.type), ['turned', 'stepped']);
  assert.equal(events[1].facing, 'NE');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r - 1, c + 1]);
  for (const [dr, dc, way] of [[1, 1, 'SE'], [1, -1, 'SW'], [-1, -1, 'NW']]) {
    stepPlayer(dr, dc);
    assert.equal(state.floor.facing, way);
  }
});

test('the corner rule: a diagonal needs both side tiles free of walls and pillars', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  assert.ok(canPassCorner(r, c, -1, 1), 'open floor');
  state.floor.wallSet.add(key(r - 1, c));
  assert.ok(!canPassCorner(r, c, -1, 1), 'a wall on one side');
  state.floor.wallSet = new Set([key(r, c + 1)]);
  assert.ok(!canPassCorner(r, c, -1, 1), 'a wall on the other side');
  state.floor.wallSet = new Set();
  state.floor.pillarSet.add(key(r - 1, c));
  assert.ok(!canPassCorner(r, c, -1, 1), 'a pillar counts too');
  state.floor.pillarSet = new Set();
  state.floor.chest = { kind: 'chest', row: r - 1, col: c };
  state.floor.props = [{ kind: 'box', row: r, col: c + 1 }];
  assert.ok(canPassCorner(r, c, -1, 1), 'a box or a chest beside it does not (call 2)');
  assert.ok(canPassCorner(r, c, -1, 0), 'a straight step always passes');
});

test('a cut corner is a bump: no step, "corner"', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  state.floor.wallSet.add(key(r - 1, c));
  const events = stepPlayer(-1, 1);
  assert.deepEqual(events.map(e => e.type), ['turned', 'blocked', 'bodyTurned']);
  assert.equal(events[1].kind, 'corner');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r, c]);
});

test('a one-wide door cannot be entered from the side', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  // A wall row above the player with a door straight up-right of them.
  for (let col = 0; col < state.floor.GRID_SIZE; col++) if (col !== c + 1) state.floor.wallSet.add(key(r - 1, col));
  assert.equal(stepPlayer(-1, 1).find(e => e.type === 'blocked').kind, 'corner');
  stepPlayer(0, 1);
  assert.equal(stepPlayer(-1, 0).at(-1).type, 'stepped', 'straight in works');
});

test('stepsAway counts a diagonal as one step', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  assert.equal(stepsAway(r - 2, c + 2), 2);
  assert.equal(stepsAway(r + 1, c - 3), 3);
});
