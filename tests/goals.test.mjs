// Unit tests for goals.js (strategy plan step A): rolling a floor's goals,
// where each stands, and scoring them on the way down; plus moves.js
// onStairs, since stepping onto the stairs now only asks.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { FLOOR_GOALS, GOALS_PER_FLOOR, GOAL_SWIFT_SHARE } from '../js/config.js';
import { rollGoals, goalState, goalMark, scoreGoals } from '../js/goals.js';
import { onStairs, stepPlayer } from '../js/moves.js';

const pay = (id) => FLOOR_GOALS.find(g => g.id === id).pay;

// A floor with a boss, two unread papers, nothing spent yet.
function resetFloor() {
  const f = state.floor;
  f.GRID_SIZE = 11;
  f.playerRow = 5;
  f.playerCol = 5;
  f.facing = 'N';
  f.wallSet = new Set();
  f.pillarSet = new Set();
  f.minions = [];
  f.hunter = null;
  f.boss = { row: 1, col: 1, hp: 3 };
  f.props = [
    { row: 2, col: 2, kind: 'paper', searched: false },
    { row: 2, col: 8, kind: 'paper', searched: false },
  ];
  f.misses = 0;
  f.struggles = 0;
  f.lightTurns = 0;
  f.lightTurnBudget = 40;
  f.stairs = null;
  f.coin = null;
  state.settings.gunCombat = true;
  state.settings.turnBeforeStep = false;
  state.run.coinsTotal = 0;
}

test('a floor rolls GOALS_PER_FLOOR different goals, all of them ones that fit', () => {
  for (let i = 0; i < 30; i++) {
    resetFloor();
    state.floor.props = [];
    state.settings.gunCombat = false;
    rollGoals();
    const ids = state.floor.goals.map(g => g.id);
    assert.equal(ids.length, GOALS_PER_FLOOR);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes('allPapers'), 'no paper goal without papers');
    assert.ok(!ids.includes('noStruggle'), 'no Struggle goal with the gun off');
  }
});

test('a miss loses NO MISSES; avoiding goals pay when kept', () => {
  resetFloor();
  state.floor.goals = [{ id: 'noMiss', pay: pay('noMiss') }, { id: 'noHunter', pay: pay('noHunter') }];
  assert.equal(goalMark('noMiss'), 'kept');
  state.floor.misses = 1;
  assert.equal(goalState('noMiss'), 'failed');
  const events = scoreGoals();
  assert.deepEqual(events, [
    { type: 'goalMissed', id: 'noMiss' },
    { type: 'goalMet', id: 'noHunter', gold: pay('noHunter') },
  ]);
  assert.equal(state.run.coinsTotal, pay('noHunter'));
});

test('ALL PAPERS pays only once every paper is read', () => {
  resetFloor();
  state.floor.goals = [{ id: 'allPapers', pay: pay('allPapers') }];
  state.floor.props[0].searched = true;
  assert.equal(goalMark('allPapers'), 'open');
  assert.deepEqual(scoreGoals(), [{ type: 'goalMissed', id: 'allPapers' }]);
  state.floor.props[1].searched = true;
  assert.equal(goalMark('allPapers'), 'kept');
});

test('SWIFT needs the boss down before the light is GOAL_SWIFT_SHARE of the way', () => {
  resetFloor();
  assert.equal(goalState('swift'), 'open');
  assert.equal(goalMark('swift'), 'open', 'boss still up: not kept yet');
  state.floor.boss = null;
  assert.equal(goalState('swift'), 'met');
  state.floor.lightTurns = state.floor.lightTurnBudget * GOAL_SWIFT_SHARE;
  assert.equal(goalState('swift'), 'failed');
});

test('the hunter waking or a Struggle loses their goals', () => {
  resetFloor();
  state.floor.hunter = { kind: 'hunter' };
  state.floor.struggles = 1;
  assert.equal(goalState('noHunter'), 'failed');
  assert.equal(goalState('noStruggle'), 'failed');
});

test('stepping onto the stairs asks and leaves the player standing on them', () => {
  resetFloor();
  state.floor.stairs = { row: 4, col: 5 };
  assert.equal(onStairs(), false);
  const events = stepPlayer(-1, 0);
  assert.ok(events.some(e => e.type === 'stepped'));
  assert.ok(events.some(e => e.type === 'stairsReached'));
  assert.equal(onStairs(), true);
  stepPlayer(1, 0);
  assert.equal(onStairs(), false);
});
