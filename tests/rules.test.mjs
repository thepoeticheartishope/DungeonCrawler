// Unit tests for the rule modules (no DOM): sight.js, light.js, passage.js,
// combat.js, moves.js, answers.js.
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
  PLAYER_LIGHT_RADIUS, PLAYER_CONE_RANGE, REVEAL_DISTANCE,
  LIGHT_TURNS_PER_STEP, MINION_CHASE_RANGE, HUNTER_SPAWN_DELAY, DARK_GOLD_MULTIPLIER,
  MAX_HEARTS, DARK_MISS_COST, GATE_QUESTIONS, GATE_MODIFIERS, GATE_WRONG_TURNS, CORE_KEYS, MINION_KINDS, MINION_TRAIL_LENGTH,
} from '../js/config.js';
import { computeVisibility, canMakeOut, shootBlock, canShoot } from '../js/sight.js';
import {
  initBossLight, advanceLight, extinguishLight, lightCoverage, lightProgress, lightConsumed,
} from '../js/light.js';
import { whatBlocks, canPassCorner } from '../js/passage.js';
import { advanceMonsters, spawnMinion, refreshTargetValidity } from '../js/combat.js';
import { stepPlayer, goldReward } from '../js/moves.js';
import { settleAnswer } from '../js/answers.js';
import { resetHaunts } from '../js/haunts.js';
import { reachGate, openGateFree } from '../js/gate.js';
import { rollCategoryModifiers } from '../js/modifiers.js';

// An open size x size floor, player in the middle facing north, fog on,
// nothing else on it. Classic combat (the gun is the game's default since
// gun plan step 9; its rules are tested in gun.test.mjs).
function resetFloor(size = 21) {
  state.floor.GRID_SIZE = size;
  state.run.roomIndex = 0;
  state.run.resting = false;
  state.floor.playerRow = Math.floor(size / 2);
  state.floor.playerCol = Math.floor(size / 2);
  state.floor.facing = 'N';
  state.floor.look = null;
  state.settings.freeLook = false;
  state.settings.fogEnabled = true;
  state.settings.gunCombat = false;
  state.settings.turnBeforeStep = false;
  state.settings.eightWays = true;
  state.floor.darkness = false;
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.bossLitSet = new Set();
  state.floor.visibleSet = new Set();
  state.floor.sightSet = new Set();
  state.floor.exploredSet = new Set();
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.minions = [];
  state.floor.chest = null;
  state.floor.props = [];
  state.floor.coin = null;
  state.floor.keys = [];
  state.floor.keysHeld = 0;
  state.floor.gateSealed = false;
  state.floor.stairs = null;
  state.run.coinsTotal = 0;
  state.run.loreQueue = [];
  state.floor.chamberAt = new Map();
  state.floor.chamberThemes = [];
  state.floor.chamberNames = [];
  state.floor.visitedChambers = new Set();
  state.battle.selectedTarget = null;
  state.run.turnCount = 0;
  state.floor.darkTurns = 0;
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

function openFloorWithBoss(size = 11) {
  resetFloor(size);
  const mid = Math.floor(size / 2);
  state.floor.boss = { row: mid, col: mid, hp: 1 };
  initBossLight();
  return mid;
}

test('the boss light starts at radius 1 and spreads one step every LIGHT_TURNS_PER_STEP turns', () => {
  const mid = openFloorWithBoss();
  assert.equal(state.floor.floorCount, 11 * 11);
  assert.equal(state.floor.bossLitSet.size, 5); // the boss tile and its four neighbours
  for (let i = 0; i < LIGHT_TURNS_PER_STEP * 2 - 1; i++) advanceLight();
  assert.equal(state.floor.bossLitSet.size, 5);
  advanceLight();
  assert.equal(state.floor.bossLitSet.size, 13); // radius 2 diamond
  assert.ok(state.floor.bossLitSet.has(key(mid - 2, mid)));
  assert.ok(lightCoverage() > 0 && lightCoverage() < 1);
});

test('the run is lost exactly when the turn budget runs out', () => {
  openFloorWithBoss();
  assert.equal(lightProgress(), 0);
  for (let i = 0; i < state.floor.lightTurnBudget - 1; i++) advanceLight();
  assert.ok(!lightConsumed());
  advanceLight();
  assert.ok(lightConsumed());
  assert.equal(lightProgress(), 1);
});

test('walls stop the light spreading', () => {
  resetFloor(11);
  for (let r = 0; r < 11; r++) state.floor.wallSet.add(key(r, 3));
  state.floor.boss = { row: 5, col: 8, hp: 1 };
  initBossLight();
  assert.equal(state.floor.floorCount, 11 * 7); // columns 4..10 only
  assert.ok(!state.floor.bossDist.has(key(5, 1)));
});

test('with no boss the light does nothing, and extinguishing clears it', () => {
  openFloorWithBoss();
  extinguishLight();
  assert.equal(state.floor.bossLitSet.size, 0);
  state.floor.boss = null;
  const turns = state.floor.lightTurns;
  advanceLight();
  assert.equal(state.floor.lightTurns, turns);
  assert.equal(lightProgress(), 0);
  assert.ok(!lightConsumed());
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

// --- combat.js: advanceMonsters ---

// The things of one type in an advanceMonsters() events list.
const ofType = (events, type, field) => events.filter(e => e.type === type).map(e => e[field]);

test('a minion within chase range steps toward the player and is reported as moved', () => {
  resetFloor(21);
  const from = { row: state.floor.playerRow - MINION_CHASE_RANGE, col: state.floor.playerCol };
  const m = spawnMinion(from);
  const events = advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: state.floor.playerRow - MINION_CHASE_RANGE + 1, col: state.floor.playerCol });
  assert.deepEqual(events, [{ type: 'minionMoved', minion: m, from }]);
  assert.equal(state.run.turnCount, 1);
});

test('a minion starts with its kind\'s hp and limbs and an empty trail', () => {
  resetFloor(21);
  for (const [name, stats] of Object.entries(MINION_KINDS)) {
    const m = spawnMinion({ row: 0, col: 0 }, name);
    assert.equal(m.kind, 'minion');
    assert.equal(m.minionKind, name);
    assert.equal(m.hpLeft, stats.hp);
    assert.equal(m.limbs, stats.limbs);
    assert.deepEqual(m.trail, []);
  }
});

test('a moving minion remembers its last MINION_TRAIL_LENGTH tiles, newest last', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.floor.playerRow - MINION_CHASE_RANGE, col: state.floor.playerCol }, 'SHARD');
  // The player backs away a tile each turn, so the minion keeps chasing
  // for more steps than its trail holds.
  const left = [];
  for (let i = 0; i < MINION_TRAIL_LENGTH + 3; i++) {
    state.floor.playerRow++;
    advanceMonsters().filter(e => e.type === 'minionMoved' && e.minion === m).forEach(e => left.push(e.from));
  }
  assert.ok(left.length > MINION_TRAIL_LENGTH, 'moved ' + left.length + ' times');
  assert.deepEqual(m.trail, left.slice(-MINION_TRAIL_LENGTH));
});

test('a minion next to the player engages from where it stands', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.floor.playerRow - 1, col: state.floor.playerCol });
  const events = advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: state.floor.playerRow - 1, col: state.floor.playerCol });
  assert.deepEqual(ofType(events, 'minionMoved', 'minion'), []);
  assert.equal(state.battle.selectedTarget, m);
});

test('an engaging minion is reported as minionEngaged, in turn order', () => {
  resetFloor(21);
  const near = spawnMinion({ row: state.floor.playerRow - 1, col: state.floor.playerCol });
  const far = spawnMinion({ row: state.floor.playerRow + 2, col: state.floor.playerCol });
  const events = advanceMonsters();
  assert.deepEqual(events, [
    { type: 'minionEngaged', minion: near },
    { type: 'minionMoved', minion: far, from: { row: state.floor.playerRow + 2, col: state.floor.playerCol } },
  ]);
});

test('a resting minion waits out its rest', () => {
  resetFloor(21);
  const m = spawnMinion({ row: state.floor.playerRow - 2, col: state.floor.playerCol });
  m.rest = 1;
  assert.deepEqual(advanceMonsters(), []);
  assert.equal(m.rest, 0);
  assert.deepEqual(ofType(advanceMonsters(), 'minionMoved', 'minion'), [m]);
});

test('the hunter wakes HUNTER_SPAWN_DELAY turns into the darkness, far from the player', () => {
  resetFloor(21);
  state.floor.darkness = true;
  for (let i = 1; i < HUNTER_SPAWN_DELAY; i++) {
    assert.deepEqual(ofType(advanceMonsters(), 'hunterWoke', 'hunter'), []);
    assert.equal(state.floor.hunter, null);
  }
  const events = advanceMonsters();
  const woke = ofType(events, 'hunterWoke', 'hunter');
  assert.equal(woke.length, 1);
  const hunter = woke[0];
  // It wakes first, then takes its first step in the same turn.
  assert.equal(events[0].type, 'hunterWoke');
  assert.equal(state.floor.hunter, hunter);
  assert.equal(hunter.kind, 'hunter');
  assert.equal(hunter.minionKind, null, 'the hunter has no minion kind');
  assert.equal(hunter.hpLeft, null);
  assert.equal(hunter.limbs, 0);
  assert.ok(state.floor.minions.includes(hunter));
  // Woke in a corner, so it's still far off after its first step (10
  // steps on a 21 floor, walking 8 ways).
  const steps = Math.max(Math.abs(hunter.row - state.floor.playerRow), Math.abs(hunter.col - state.floor.playerCol));
  assert.ok(steps >= 9, 'hunter is ' + steps + ' steps away');
  // Only ever one.
  assert.deepEqual(ofType(advanceMonsters(), 'hunterWoke', 'hunter'), []);
});

// --- moves.js: stepPlayer ---

test('turning first: a press in a new direction only turns, no step, no turn spent', () => {
  resetFloor();
  state.settings.turnBeforeStep = true;
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  const events = stepPlayer(1, 0);
  assert.deepEqual(events.map(e => e.type), ['turned']);
  assert.equal(events[0].facing, 'S');
  assert.equal(state.floor.facing, 'S');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r, c]);
  // The second press the same way steps.
  assert.deepEqual(stepPlayer(1, 0).map(e => e.type), ['stepped']);
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r + 1, c]);
});

test('turning first toward a wall changes facing; the next press there is blocked', () => {
  resetFloor();
  state.settings.turnBeforeStep = true;
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  state.floor.wallSet.add(key(r, c + 1));
  assert.deepEqual(stepPlayer(0, 1).map(e => e.type), ['turned']);
  assert.equal(state.floor.facing, 'E');
  const events = stepPlayer(0, 1);
  assert.deepEqual(events.map(e => e.type), ['blocked']);
  assert.equal(events[0].kind, 'wall');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r, c]);
});

test('by default a press in a new direction turns and steps at once', () => {
  resetFloor();
  const [r, c] = [state.floor.playerRow, state.floor.playerCol];
  assert.deepEqual(stepPlayer(1, 0).map(e => e.type), ['turned', 'stepped']);
  assert.equal(state.floor.facing, 'S');
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol], [r + 1, c]);
  // Toward a wall it turns and bumps in the same press.
  state.floor.wallSet.add(key(r + 1, c + 1));
  assert.deepEqual(stepPlayer(0, 1).map(e => e.type), ['turned', 'blocked']);
  assert.equal(state.floor.facing, 'E');
});

// --- combat.js: senseUnseen ("I see you.") ---

// A minion that will be beside the player after its next move: two steps
// straight behind them (south, while they face north), out of their light.
function minionBehind() {
  resetFloor();
  computeVisibility();
  return spawnMinion({ row: state.floor.playerRow + 3, col: state.floor.playerCol });
}

test('an unseen minion about to reach the player warns once per approach', () => {
  const m = minionBehind();
  // Its move this turn brings it to two steps away: next move, beside them.
  assert.deepEqual(ofType(advanceMonsters(), 'presenceSensed', 'minion'), [m]);
  assert.equal(Math.abs(m.row - state.floor.playerRow), 2);
  // It doesn't warn again while it keeps coming.
  state.floor.playerRow -= 1;
  computeVisibility();
  assert.deepEqual(ofType(advanceMonsters(), 'presenceSensed', 'minion'), []);
});

test('no warning for a minion the player can already see, or one resting', () => {
  const m = minionBehind();
  state.floor.facing = 'S';
  computeVisibility();
  assert.deepEqual(ofType(advanceMonsters(), 'presenceSensed', 'minion'), []);
  const r = minionBehind();
  r.rest = 3;
  r.row -= 1;
  assert.deepEqual(ofType(advanceMonsters(), 'presenceSensed', 'minion'), []);
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
  assert.deepEqual(first, { type: 'keyTaken', held: 1, total: 3, unsealed: false });
  assert.equal(state.floor.keys.length, 2);
  const second = stepPlayer(-1, 0).find(e => e.type === 'keyTaken');
  assert.deepEqual(second, { type: 'keyTaken', held: 2, total: 3, unsealed: false });
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

// --- answers.js: settleAnswer ---

// A floor with one target selected and one question showing.
function resetAnswer(target) {
  resetFloor();
  resetHaunts();
  state.run.hearts = MAX_HEARTS;
  state.battle.wager = 0;
  state.run.attempts = 1;
  state.run.correctTotal = 0;
  state.run.extraSpaceCount = 0;
  state.battle.currentQuestion = { term: 'Who built the ark?', meaning: 'Noah', difficulty: 'easy' };
  state.battle.selectedTarget = target;
}

const types = (events) => events.map(e => e.type);

test('a miss costs 1 heart, 2 in the darkness, and ends at 0 hearts with signalLost', () => {
  for (const darkness of [false, true]) {
    const chest = { row: 0, col: 0, kind: 'chest' };
    resetAnswer(chest);
    state.floor.chest = chest;
    state.floor.darkness = darkness;
    const events = settleAnswer(false, false, 'Moses');
    const rejected = events.find(e => e.type === 'rejected');
    assert.equal(rejected.cost, darkness ? DARK_MISS_COST : 1);
    assert.equal(rejected.expected, 'Noah');
    assert.equal(state.run.hearts, MAX_HEARTS - rejected.cost);
    assert.deepEqual(types(events), ['answerGiven', 'rejected', 'targetSpent']);
    assert.equal(events[0].given, 'Moses');
  }
  const chest = { row: 0, col: 0, kind: 'chest' };
  resetAnswer(chest);
  state.floor.chest = chest;
  state.run.hearts = 1;
  assert.deepEqual(types(settleAnswer(false, false, 'Moses')), ['answerGiven', 'rejected', 'signalLost']);
  assert.equal(state.floor.chest, chest, 'the target is left as it was');
});

test('a right answer adds to the run\'s correct total, a miss does not', () => {
  const chest = { row: 0, col: 0, kind: 'chest' };
  resetAnswer(chest);
  state.floor.chest = chest;
  settleAnswer(false, false, 'Moses');
  assert.equal(state.run.correctTotal, 0);
  resetAnswer(chest);
  state.floor.chest = chest;
  state.run.correctTotal = 4;
  settleAnswer(true, false, 'Noah');
  assert.equal(state.run.correctTotal, 5);
});

// --- gate.js: the boss is the gate ---

// The boss one step north of the player, the light set up, `keys` held.
function resetGate(keys) {
  resetFloor();
  resetHaunts();
  state.run.hearts = MAX_HEARTS;
  state.battle.wager = 0;
  state.battle.currentQuestion = { term: 'Who built the ark?', meaning: 'Noah', difficulty: 'easy' };
  state.floor.boss = { row: state.floor.playerRow - 1, col: state.floor.playerCol, kind: 'boss', hp: 3, max: 3 };
  state.floor.keysHeld = keys;
  initBossLight();
}

test('bumping the gate asks GATE_QUESTIONS by keys held; standing beside it does nothing', () => {
  for (let keys = 0; keys < GATE_QUESTIONS.length; keys++) {
    resetGate(keys);
    refreshTargetValidity();
    assert.equal(state.battle.selectedTarget, null, 'beside the gate is not a fight');
    const reached = stepPlayer(-1, 0).find(e => e.type === 'gateReached');
    assert.deepEqual(reached, { type: 'gateReached', questions: GATE_QUESTIONS[keys] });
    assert.equal(state.battle.selectedTarget, state.floor.boss);
    assert.equal(state.floor.boss.max, GATE_QUESTIONS[keys]);
  }
  assert.equal(GATE_QUESTIONS[CORE_KEYS], 0, 'every key opens it free');
});

test('the gate\'s questions carry GATE_MODIFIERS modifiers each, by keys held', () => {
  for (let keys = 0; keys < GATE_MODIFIERS.length; keys++) {
    resetGate(keys);
    rollCategoryModifiers(state.floor.boss, 3).forEach(mods => {
      assert.equal([].concat(mods || []).length, GATE_MODIFIERS[keys], `${keys} keys`);
    });
  }
});

test('a wrong answer at the gate feeds the light and seals it until the next key', () => {
  resetGate(1);
  stepPlayer(-1, 0);
  const before = state.floor.lightTurns;
  const events = settleAnswer(false, false, 'Moses');
  assert.deepEqual(types(events), ['answerGiven', 'rejected', 'bossHeld', 'gateSealed']);
  assert.equal(state.floor.lightTurns, before + GATE_WRONG_TURNS);
  assert.equal(state.floor.gateSealed, true);
  assert.equal(events[1].cost, 0, 'a gate miss costs no heart');
  assert.equal(state.run.hearts, MAX_HEARTS);
  assert.ok(state.floor.boss, 'the boss stays in the doorway');
  // Sealed: a bump is only a bump.
  state.battle.selectedTarget = null;
  assert.deepEqual(stepPlayer(-1, 0).map(e => e.type), ['blocked']);
  assert.equal(state.battle.selectedTarget, null);
  // The next key unseals it, at the easier level.
  state.floor.keys = [{ row: state.floor.playerRow + 1, col: state.floor.playerCol }];
  const taken = stepPlayer(1, 0).find(e => e.type === 'keyTaken');
  assert.equal(taken.unsealed, true);
  assert.equal(state.floor.gateSealed, false);
  stepPlayer(-1, 0);
  assert.equal(stepPlayer(-1, 0).find(e => e.type === 'gateReached').questions, GATE_QUESTIONS[2]);
});

test('with every key the gate gives: the boss falls and the floor goes dark', () => {
  resetGate(CORE_KEYS);
  assert.deepEqual(types(openGateFree()), ['gateOpened', 'bossDefeated', 'darknessFell']);
  assert.equal(state.floor.boss, null);
  assert.equal(state.floor.darkness, true);
});

test('boss hits count down, and the last one fires bossDefeated then darknessFell', () => {
  const boss = { row: 0, col: 0, kind: 'boss', hp: 2, max: 2 };
  resetAnswer(boss);
  state.floor.boss = boss;
  state.floor.gateSealed = false;
  const hit = settleAnswer(true, false, 'Noah');
  assert.deepEqual(types(hit), ['answerGiven', 'accepted', 'bossHit']);
  assert.equal(hit[2].hp, 1);
  assert.equal(hit[2].max, 2);
  assert.deepEqual(types(settleAnswer(true, false, 'Noah')),
    ['answerGiven', 'accepted', 'bossDefeated', 'darknessFell']);
  assert.equal(state.floor.boss, null);
  assert.equal(state.floor.darkness, true);
});

test('a chest pays 2 gold and is spent', () => {
  const chest = { row: 0, col: 0, kind: 'chest' };
  resetAnswer(chest);
  state.floor.chest = chest;
  const events = settleAnswer(true, true, 'Noah');
  assert.deepEqual(types(events), ['answerGiven', 'accepted', 'extraSpaces', 'targetSpent', 'goldGained']);
  assert.deepEqual(events[4], { type: 'goldGained', amount: 2, from: 'chest' });
  assert.equal(state.run.coinsTotal, 2);
  assert.equal(state.floor.chest, null);
  assert.equal(state.run.extraSpaceCount, 1);
});

test('a lost wager cannot take gold below 0; a won one pays it', () => {
  resetAnswer(null);
  const minion = spawnMinion({ row: 0, col: 0 });
  state.battle.selectedTarget = minion;
  state.run.coinsTotal = 1;
  state.battle.wager = 3;
  const lost = settleAnswer(false, false, 'Moses');
  assert.deepEqual(types(lost), ['answerGiven', 'rejected', 'wagerSettled', 'minionCleared']);
  assert.deepEqual(lost[2], { type: 'wagerSettled', won: false, n: 3 });
  assert.equal(state.run.coinsTotal, 0);
  assert.equal(state.battle.wager, 0);
  assert.deepEqual(state.floor.minions, []);

  state.battle.selectedTarget = spawnMinion({ row: 0, col: 0 });
  state.battle.wager = 2;
  settleAnswer(true, false, 'Noah');
  assert.equal(state.run.coinsTotal, 2);
});

test('a missed question lingers when missed again and is silenced when answered right', () => {
  resetAnswer(null);
  state.battle.selectedTarget = spawnMinion({ row: 0, col: 0 });
  assert.ok(!types(settleAnswer(false, false, 'Moses')).some(t => t.startsWith('haunt')));
  state.battle.selectedTarget = spawnMinion({ row: 0, col: 0 });
  assert.ok(types(settleAnswer(false, false, 'Moses')).includes('hauntLingers'));
  state.battle.selectedTarget = spawnMinion({ row: 0, col: 0 });
  assert.ok(types(settleAnswer(true, false, 'Noah')).includes('hauntSilenced'));
  assert.equal(state.run.hauntsSilenced, 1);
});

// --- moves.js / combat.js: items open only when bumped ---

test('standing next to an item does not select it; walking into it does', () => {
  resetFloor();
  const r = state.floor.playerRow, c = state.floor.playerCol;
  state.floor.chest = { kind: 'chest', row: r - 1, col: c };
  refreshTargetValidity();
  assert.equal(state.battle.selectedTarget, null);

  const events = stepPlayer(-1, 0);
  assert.deepEqual(events.map(e => e.type), ['itemReached']);
  assert.equal(state.battle.selectedTarget, state.floor.chest);
  assert.equal(state.floor.playerRow, r);
  assert.equal(state.run.turnCount, 0);
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
  assert.deepEqual(events.map(e => e.type), ['turned', 'blocked']);
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

test('diagonal bumps open the gate and the chest', () => {
  resetGate(0);
  const r = state.floor.playerRow, c = state.floor.playerCol;
  state.floor.boss.row = r - 1;
  state.floor.boss.col = c + 1;
  assert.deepEqual(stepPlayer(-1, 1).find(e => e.type === 'gateReached'), { type: 'gateReached', questions: GATE_QUESTIONS[0] });

  resetFloor();
  state.floor.chest = { kind: 'chest', row: state.floor.playerRow + 1, col: state.floor.playerCol - 1 };
  assert.equal(stepPlayer(1, -1).at(-1).type, 'itemReached');
  assert.equal(state.battle.selectedTarget, state.floor.chest);
});

test('a minion chases on a diagonal and engages from a diagonal tile', () => {
  resetFloor(21);
  const r = state.floor.playerRow, c = state.floor.playerCol;
  const m = spawnMinion({ row: r - 3, col: c + 3 });
  advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: r - 2, col: c + 2 }, 'straight down the diagonal');
  advanceMonsters();
  assert.deepEqual({ row: m.row, col: m.col }, { row: r - 1, col: c + 1 });
  const events = advanceMonsters();
  assert.deepEqual(ofType(events, 'minionEngaged', 'minion'), [m], 'next to the player on a diagonal');
  assert.deepEqual({ row: m.row, col: m.col }, { row: r - 1, col: c + 1 });
});

test('a corner keeps a diagonal minion from striking', () => {
  resetFloor(21);
  const r = state.floor.playerRow, c = state.floor.playerCol;
  state.floor.wallSet.add(key(r - 1, c));
  state.floor.wallSet.add(key(r, c + 1));
  const m = spawnMinion({ row: r - 1, col: c + 1 });
  refreshTargetValidity();
  assert.equal(state.battle.selectedTarget, null, 'not next to the player through a corner');
  const events = advanceMonsters();
  assert.deepEqual(ofType(events, 'minionEngaged', 'minion'), []);
  assert.notDeepEqual({ row: m.row, col: m.col }, { row: r, col: c });
});

test('8 ways off: diagonals do nothing and minions chase 4 ways, as before', () => {
  resetFloor(21);
  state.settings.eightWays = false;
  const r = state.floor.playerRow, c = state.floor.playerCol;
  assert.deepEqual(stepPlayer(-1, 1), []);
  assert.deepEqual([state.floor.playerRow, state.floor.playerCol, state.floor.facing], [r, c, 'N']);
  const m = spawnMinion({ row: r - 1, col: c + 1 });
  refreshTargetValidity();
  assert.equal(state.battle.selectedTarget, null, 'a diagonal is not next to the player');
  advanceMonsters();
  assert.equal(Math.abs(m.row - r) + Math.abs(m.col - c), 1, 'it took a straight step');
  state.settings.eightWays = true;
});
