// Unit tests for windows (js/windows.js, room view plan step F): the
// School's windows stand on the back walls that face the outside (the lab,
// the library and the art room); their light stays on their own room's
// floor; window light in the room the player is in shows a stick man as
// their own light does (sight.js canMakeOut / seesEnemy), another room's
// shows nothing; and only the player's own light lets them shoot it
// (shootBlock).
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, key, parseKey } from '../js/state.js';
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
  const m = parseKey([...f.windowLitSet][0]);
  f.playerRow = m.row + 2;
  f.playerCol = m.col;
  while (f.wallSet.has(key(f.playerRow, f.playerCol))) f.playerRow--;
  f.sightSet = new Set([key(f.playerRow, f.playerCol)]);
  assert.ok(seesEnemy(m), 'seen in window light');
  assert.ok(shootBlock(m) !== null, 'not shootable without the player’s own light');
  f.windowLitSet = new Set();
  assert.ok(!seesEnemy(m), 'not seen once the window light is gone');
});

test("another room's window light shows nothing: only the room the player is in", () => {
  school();
  const f = state.floor;
  state.settings.fogEnabled = true;
  const { row: r, col: c } = parseKey([...f.windowLitSet][0]);
  const room = f.chamberAt.get(key(r, c));
  // The hallway tile nearest it: outside the room.
  const hall = [...Array(f.GRID_SIZE).keys()].flatMap(row => [...Array(f.GRID_SIZE).keys()].map(col => ({ row, col })))
    .filter(p => !f.wallSet.has(key(p.row, p.col)) && !f.chamberAt.has(key(p.row, p.col)))
    .sort((a, b) => Math.hypot(a.row - r, a.col - c) - Math.hypot(b.row - r, b.col - c))[0];
  // In the room's doorway the window light shows it; one step out, not.
  const inside = { row: hall.row - Math.sign(hall.row - r), col: hall.col };
  f.playerRow = inside.row;
  f.playerCol = inside.col;
  f.sightSet = new Set();
  const seenInside = f.chamberAt.get(key(inside.row, inside.col)) === room && seesEnemy({ row: r, col: c });
  f.playerRow = hall.row;
  f.playerCol = hall.col;
  f.sightSet = new Set([key(hall.row, hall.col)]);
  assert.ok(!seesEnemy({ row: r, col: c }), 'from the hallway the window light shows nothing');
  assert.ok(seenInside || f.chamberAt.get(key(inside.row, inside.col)) !== room, 'inside the room it shows when in reach');
});
