// Unit tests for the warning timer (js/warning.js, presence cues plan step
// D): a stick man's first sign is noted with what gave him away (a lamp,
// his shadow), kept while he shows, forgotten after WARNING_TIMER.forgetMs
// out of view, and turned into the seconds of warning at his reach.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { CORE_KEYS, WARNING_TIMER } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { placeLamps } from '../js/lamps.js';
import { placeWindows } from '../js/windows.js';
import { noteSigns, warningAtReach, signOf } from '../js/warning.js';
import { shadowsAt, shadowTiles } from '../js/shadows.js';

// The School (version A) with its lamps, the player far off in the front
// hall, nothing lit for them; one stick man, `m`.
function school(m) {
  const plan = FLOOR_PLANS.school;
  const layout = buildPlanLayout(plan, CORE_KEYS, 'A');
  const f = state.floor;
  Object.assign(f, {
    GRID_SIZE: plan.rows.length, wallSet: layout.walls, chamberAt: layout.chamberAt, pillarSet: new Set(), darkness: false,
    playerRow: 26, playerCol: 16, sightSet: new Set(), visibleSet: new Set(), minions: [m],
  });
  placeWindows();
  placeLamps(layout);
  state.settings.fogEnabled = true;
}

test('a stick man in a lamp’s pool far off is a sign by a lamp', () => {
  const m = { row: 21, col: 16 };
  school(m);
  // The player in the front hall's doorway, looking up the corridor at it.
  state.floor.playerRow = 24;
  assert.equal(signOf(m), 'lamp');
});

test('the first sign is kept while he shows, and turned into the warning at his reach', () => {
  const m = { row: 9, col: 12 };
  school(m);
  assert.equal(signOf(m), null, 'nothing lit for the player yet');
  noteSigns(1000);
  assert.equal(m.firstSign, undefined);
  const [s] = shadowsAt(m);
  const tip = shadowTiles(m, s).at(-1);
  state.floor.visibleSet = new Set([key(tip.row, tip.col)]);
  noteSigns(2000);
  assert.deepEqual(m.firstSign, { at: 2000, kind: 'shadow' });
  noteSigns(3000);
  assert.equal(m.firstSign.at, 2000, 'the first sign stays the first');
  assert.deepEqual(warningAtReach(m, 4500), { kind: 'shadow', ms: 2500 });
  assert.deepEqual(warningAtReach(m, 5000), { kind: null, ms: 0 }, 'the approach ended with the reach');
});

test('a sign out of view for WARNING_TIMER.forgetMs is forgotten', () => {
  const m = { row: 9, col: 12 };
  school(m);
  const [s] = shadowsAt(m);
  const tip = shadowTiles(m, s).at(-1);
  state.floor.visibleSet = new Set([key(tip.row, tip.col)]);
  noteSigns(0);
  state.floor.visibleSet = new Set();
  noteSigns(100);
  noteSigns(100 + WARNING_TIMER.forgetMs - 1);
  assert.ok(m.firstSign, 'not yet');
  noteSigns(100 + WARNING_TIMER.forgetMs);
  assert.equal(m.firstSign, null);
});
