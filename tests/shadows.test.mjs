// Unit tests for shadows (js/shadows.js, presence cues plan step C): a lamp
// near a stick man throws his shadow away from it, longer the farther he
// stands, stopped by walls; none from a lamp too far, behind a wall or out
// (after the boss falls); a window throws one for a stick man in its pool;
// and the player can see a shadow on lit floor before they see him.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { CORE_KEYS, SHADOW } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { placeLamps } from '../js/lamps.js';
import { placeWindows } from '../js/windows.js';
import { shadowsAt, shadowTiles, shadowSeen } from '../js/shadows.js';
import { seesEnemy } from '../js/sight.js';

// The School laid out (version A) on state.floor with its lamps and
// windows, the player far off in the front hall seeing nothing.
function school() {
  const plan = FLOOR_PLANS.school;
  const layout = buildPlanLayout(plan, CORE_KEYS, 'A');
  const f = state.floor;
  f.GRID_SIZE = plan.rows.length;
  f.wallSet = layout.walls;
  f.chamberAt = layout.chamberAt;
  f.pillarSet = new Set();
  f.darkness = false;
  placeWindows();
  placeLamps(layout);
  f.playerRow = 26;
  f.playerCol = 16;
  f.sightSet = new Set();
  f.visibleSet = new Set();
  state.settings.fogEnabled = true;
}

test('a lamp throws a stick man’s shadow away from it, longer the farther he stands', () => {
  school();
  // The upper hall's lamp is at (9, 16); he stands 1, then 2 tiles west
  // of it, short of where the hall ends at (9, 8).
  const near = shadowsAt({ row: 9, col: 15 });
  assert.equal(near.length, 1);
  assert.deepEqual(near[0].dir, [0, -1]);
  const far = shadowsAt({ row: 9, col: 14 });
  assert.ok(far[0].length > near[0].length, 'farther from the lamp, longer');
  assert.ok(Math.abs(far[0].length - (SHADOW.base + 2 * SHADOW.perTile)) < 1e-9);
});

test('a wall stops a shadow', () => {
  school();
  // At (9, 11) it would run west past (9, 9), but (9, 8) is wall.
  const [s] = shadowsAt({ row: 9, col: 11 });
  shadowTiles({ row: 9, col: 11 }, s).forEach(p => assert.ok(!state.floor.wallSet.has(key(p.row, p.col)), p.row + ',' + p.col));
  assert.ok(s.length < SHADOW.base + 5 * SHADOW.perTile);
});

test('no shadow from a lamp too far, behind a wall, right overhead or out', () => {
  school();
  assert.equal(shadowsAt({ row: 9, col: 16 - SHADOW.castFrom - 1 }).length, 0, 'too far');
  assert.equal(shadowsAt({ row: 5, col: 13 }).length, 0, 'in the library, the wall between');
  assert.equal(shadowsAt({ row: 9, col: 16 }).length, 0, 'right under it');
  state.floor.darkness = true;
  assert.equal(shadowsAt({ row: 9, col: 13 }).length, 0, 'the lamps are out');
});

test('a window throws a shadow, down its pool, for a stick man standing in it', () => {
  school();
  const f = state.floor;
  const [row, col] = [...f.windowLitSet][0].split(',').map(Number);
  const shadows = shadowsAt({ row, col });
  assert.ok(shadows.length >= 1);
  shadows.forEach(s => assert.ok(s.dir[0] > 0, 'away from the back wall'));
});

test('a shadow on lit floor is seen before the stick man is', () => {
  school();
  const f = state.floor;
  // He stands 4 tiles west of the upper hall's lamp, outside its pool; the
  // floor his shadow falls on, west of him, is lit for the player.
  const m = { row: 9, col: 12 };
  const [s] = shadowsAt(m);
  const tip = shadowTiles(m, s).at(-1);
  f.visibleSet = new Set([key(tip.row, tip.col)]);
  assert.ok(!seesEnemy(m), 'he isn’t seen');
  assert.ok(shadowSeen(m), 'his shadow is');
  f.visibleSet = new Set();
  assert.ok(!shadowSeen(m), 'not on dark floor');
});
