// Unit tests for the run's shape (run.js nextFloor()) and rest floors
// (floor.js buildRestFloor()).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { MC_SAMPLE_DATA, REST_GRID } from '../js/config.js';
import { nextFloor } from '../js/run.js';
import { buildFloor, buildRestFloor } from '../js/floor.js';
import { lightProgress, lightConsumed } from '../js/light.js';

const REST_KINDS = ['opening', 'between', 'epilogue'];
const FLOORS_PER_KIND = 20;

// A fresh run of `depths` danger floors, standing on the opening rest.
function startRun(depths = 3) {
  state.settings.activeData = MC_SAMPLE_DATA;
  state.run.order = MC_SAMPLE_DATA.slice(0, depths);
  state.run.roomIndex = 0;
  state.run.resting = true;
}

test('a run goes opening -> depth -> rest -> ... -> epilogue -> win', () => {
  startRun(3);
  const seen = ['rest:opening'];
  for (let i = 0; i < 20; i++) {
    const next = nextFloor();
    if (next.kind === 'win') { seen.push('win'); break; }
    seen.push(next.kind === 'rest' ? 'rest:' + next.rest : 'depth' + (state.run.roomIndex + 1));
  }
  assert.deepEqual(seen, [
    'rest:opening', 'depth1', 'rest:between', 'depth2', 'rest:between', 'depth3', 'rest:epilogue', 'win',
  ]);
});

test('a rest floor never changes the depth the next danger floor uses', () => {
  startRun(3);
  nextFloor();
  assert.equal(state.run.roomIndex, 0);
  assert.equal(state.run.resting, false);
  nextFloor();
  assert.equal(state.run.resting, true);
  assert.equal(state.run.roomIndex, 1);
  nextFloor();
  assert.equal(state.run.roomIndex, 1);
  assert.equal(state.run.resting, false);
});

test('a rest floor holds nothing dangerous, even after a depth in the darkness', () => {
  for (const kind of REST_KINDS) {
    for (let i = 0; i < FLOORS_PER_KIND; i++) {
      startRun();
      state.run.resting = false;
      buildFloor();
      // Leave the depth the way a played floor would: boss down, the dark, a hunter.
      state.floor.boss = null;
      state.floor.darkness = true;
      state.floor.darkTurns = 9;
      state.floor.hunter = { row: 1, col: 1, kind: 'hunter' };
      state.run.resting = true;
      buildRestFloor(kind);
      const f = state.floor;
      assert.equal(f.GRID_SIZE, REST_GRID);
      assert.equal(f.boss, null);
      assert.equal(f.minions.length, 0);
      assert.equal(f.hunter, null);
      assert.equal(f.darkness, false);
      assert.equal(f.darkTurns, 0);
      assert.equal(f.chest, null);
      assert.equal(f.rune, null);
      assert.equal(f.encounters.length, 0);
      assert.equal(f.beats.length, 0);
      assert.equal(f.bossLitSet.size, 0);
      assert.equal(f.pillarSet.size, 0);
      assert.ok(f.props.every(p => p.kind === 'paper'), kind + ': only papers, so no trapped box');
      assert.ok(f.props.length > 0, kind + ': has its papers');
      assert.equal(lightProgress(), 0);
      assert.equal(lightConsumed(), false);
    }
  }
});

test('a rest floor has stairs and a coin on its room floor, apart from the start', () => {
  for (const kind of REST_KINDS) {
    for (let i = 0; i < FLOORS_PER_KIND; i++) {
      startRun();
      buildRestFloor(kind);
      const f = state.floor;
      const onFloor = p => !f.wallSet.has(key(p.row, p.col));
      const same = (a, b) => a.row === b.row && a.col === b.col;
      assert.ok(onFloor(f.stairs), kind + ': stairs on floor');
      assert.ok(f.coin && onFloor(f.coin), kind + ': coin on floor');
      assert.ok(!same(f.coin, f.stairs) && !same(f.coin, f.PLAYER_START), kind + ': coin on its own tile');
      assert.ok(!same(f.stairs, f.PLAYER_START), kind + ': stairs away from the start');
      assert.ok(onFloor({ row: f.playerRow, col: f.playerCol }), kind + ': player on floor');
    }
  }
});

test('the opening rest wakes the player in the wake room with one paper', () => {
  startRun();
  buildRestFloor('opening');
  assert.equal(state.floor.props.length, 1);
});

test('building a rest floor counts as entering a floor', () => {
  startRun();
  const before = state.run.floorsEntered;
  buildRestFloor('between');
  assert.equal(state.run.floorsEntered, before + 1);
});
