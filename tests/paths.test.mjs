// Unit tests for choosing the next floor (strategy plan step C): a
// between-rest's two stairs, floors.js FLOOR_PATHS changing the next
// depth's recipe, and scouting the hidden stairs at THE UNFOLDING.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { MC_SAMPLE_DATA, REST_STAIRS_APART } from '../js/config.js';
import { buildFloor, buildRestFloor } from '../js/floor.js';
import { FLOOR_RECIPES, FLOOR_PATHS, floorRecipe } from '../js/floors.js';
import { stepPlayer, stairsHere } from '../js/moves.js';
import { buy } from '../js/exchange.js';
import { TEXT } from '../js/text.js';

// Standing on the between-rest after depth 1.
function startBetween() {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.settings.gunCombat = true;
  state.run.order = MC_SAMPLE_DATA.slice(0, 3);
  state.run.roomIndex = 1;
  state.run.resting = true;
  state.run.coinsTotal = 10;
  state.run.nextPath = null;
  buildRestFloor('between');
}

const steps = (p, q) => Math.abs(p.row - q.row) + Math.abs(p.col - q.col);

test('a between-rest has two stairs, apart, with two different ways down', () => {
  for (let i = 0; i < 30; i++) {
    startBetween();
    const { stairs, stairsAlt } = state.floor;
    assert.ok(stairsAlt, 'second stairs');
    assert.ok(stairsAlt.hidden, 'the second way starts hidden');
    assert.ok(FLOOR_PATHS[stairs.path] && FLOOR_PATHS[stairsAlt.path]);
    assert.notEqual(stairs.path, stairsAlt.path);
    assert.ok(steps(stairs, stairsAlt) >= REST_STAIRS_APART);
    assert.ok(!state.floor.wallSet.has(stairsAlt.row + ',' + stairsAlt.col));
  }
});

test('the opening and epilogue rests have one way down', () => {
  for (const kind of ['opening', 'epilogue']) {
    state.run.roomIndex = kind === 'opening' ? 0 : 3;
    buildRestFloor(kind);
    assert.equal(state.floor.stairsAlt, null, kind);
  }
});

test('stepping onto the hidden stairs says so; scouting shows the way', () => {
  startBetween();
  const alt = state.floor.stairsAlt;
  state.floor.playerRow = alt.row + 1;
  state.floor.playerCol = alt.col;
  state.floor.wallSet.delete(alt.row + 1 + ',' + alt.col);
  const events = stepPlayer(-1, 0);
  const reached = events.find(e => e.type === 'stairsReached');
  assert.deepEqual({ path: reached.path, hidden: reached.hidden }, { path: alt.path, hidden: true });
  assert.equal(stairsHere(), alt);
  const bought = buy('scout');
  assert.deepEqual(bought.map(e => e.type), ['itemBought', 'stairsScouted']);
  assert.equal(alt.hidden, false);
  assert.equal(buy('scout')[0].reason, 'noHidden', 'only once');
});

test('a path changes the next depth\'s minions and light, and only that depth', () => {
  const base = FLOOR_RECIPES[1];
  const crowded = floorRecipe(1, 'crowded');
  assert.equal(crowded.minions, base.minions + FLOOR_PATHS.crowded.minions);
  assert.equal(crowded.minionKinds.length, crowded.minions);
  assert.ok(crowded.slack[0] > base.slack[0], 'slower light');
  const hurried = floorRecipe(1, 'hurried');
  assert.ok(hurried.slack[1] < base.slack[1], 'faster light');
  assert.ok(floorRecipe(1, 'stalked').minionKinds.every(k => k !== 'SHARD'));
  assert.equal(floorRecipe(1), base, 'no path: the table as it is');

  startBetween();
  state.run.nextPath = 'crowded';
  state.run.resting = false;
  buildFloor();
  assert.equal(state.floor.path, 'crowded');
  assert.equal(state.run.nextPath, null, 'taken by this depth');
  assert.equal(state.floor.minions.length, crowded.minions);
});

test('every way down has wording', () => {
  Object.keys(FLOOR_PATHS).forEach(p => assert.ok(TEXT['path.' + p], p));
});
