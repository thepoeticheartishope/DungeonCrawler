// Unit tests for windows (js/windows.js, room view plan step F): the
// School's windows stand on the back walls that face the outside (the lab,
// the library and the art room); their light stays on their own room's
// floor; and window light shows a stick man as the player's own light does
// (sight.js canMakeOut / seesEnemy), but only the player's own light lets
// them shoot it (shootBlock).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key } from '../js/state.js';
import { CORE_KEYS } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { placeWindows, windowPool } from '../js/windows.js';
import { seesEnemy, shootBlock } from '../js/sight.js';

// The School laid out (version A) on state.floor, with its windows.
function school() {
  const plan = FLOOR_PLANS.school;
  const layout = buildPlanLayout(plan, CORE_KEYS, 'a');
  const f = state.floor;
  f.GRID_SIZE = plan.rows.length;
  f.wallSet = layout.walls;
  f.chamberAt = layout.chamberAt;
  f.pillarSet = new Set();
  placeWindows();
  return plan;
}

test("the School's windows are on the outside walls of the lab, the library and the art room", () => {
  const plan = school();
  const rooms = new Set(state.floor.windows.map(w => plan.rooms[w.room].name));
  assert.deepEqual([...rooms].sort(), ['plan.school.artRoom', 'plan.school.lab', 'plan.school.library']);
  state.floor.windows.forEach(w => {
    for (let r = 0; r <= w.row; r++) assert.ok(state.floor.wallSet.has(key(r, w.col)) && state.floor.wallSet.has(key(r, w.col + 1)), 'wall above ' + w.col);
  });
});

test("a window's light stays on its own room's floor, and every window lights some", () => {
  school();
  state.floor.windows.forEach(w => {
    const pool = windowPool(w);
    assert.ok(pool.length > 0);
    pool.forEach(p => {
      assert.ok(!state.floor.wallSet.has(key(p.row, p.col)));
      assert.equal(state.floor.chamberAt.get(key(p.row, p.col)), w.room);
      assert.ok(state.floor.windowLitSet.has(key(p.row, p.col)));
    });
  });
});

test('a stick man in window light is seen, but can only be shot in the player’s own light', () => {
  school();
  const f = state.floor;
  state.settings.fogEnabled = true;
  const lit = [...f.windowLitSet][0].split(',').map(Number);
  const m = { row: lit[0], col: lit[1] };
  f.playerRow = m.row + 2;
  f.playerCol = m.col;
  while (f.wallSet.has(key(f.playerRow, f.playerCol))) f.playerRow--;
  f.sightSet = new Set([key(f.playerRow, f.playerCol)]);
  assert.ok(seesEnemy(m), 'seen in window light');
  assert.ok(shootBlock(m) !== null, 'not shootable without the player’s own light');
  f.windowLitSet = new Set();
  assert.ok(!seesEnemy(m), 'not seen once the window light is gone');
});
