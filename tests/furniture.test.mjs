// Unit tests for a fixed plan's furniture (plans.js `furniture`, decor.js
// placeFurniture; room view plan step E): every piece the School lists
// stands in both versions, on its own room's floor, never on a doorway,
// the start, a key spot, the gate or the stairs; the floor stays whole
// round it; a bump finds it as furniture (passage.js whatBlocks), not a
// prop to examine; every piece has wording.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FOUR_STEPS } from '../js/grid.js';
import { state, key } from '../js/state.js';
import { CORE_KEYS, FURNITURE_PIECES } from '../js/config.js';
import { FLOOR_PLANS, PLAN_VERSIONS, buildPlanLayout } from '../js/plans.js';
import { furnishFloor } from '../js/decor.js';
import { whatBlocks } from '../js/passage.js';
import { TEXT } from '../js/text.js';

const school = FLOOR_PLANS.school;

// The School laid out in version `v` and furnished.
function furnished(v) {
  const layout = buildPlanLayout(school, CORE_KEYS, v);
  const { props } = furnishFloor(layout, school.rows.length, 0);
  return { layout, furniture: props.filter(p => p.kind === 'furniture') };
}

test('every piece the School lists stands, in both versions', () => {
  const listed = school.rooms.reduce((n, room) => n + (room.furniture || []).reduce((m, [, , , w = 1]) => m + w, 0), 0);
  PLAN_VERSIONS.forEach(v => assert.equal(furnished(v).furniture.length, listed, 'version ' + v));
});

test("furniture stands on its own room's floor, never on a doorway, the start, a key spot, the gate or the stairs", () => {
  PLAN_VERSIONS.forEach(v => {
    const { layout, furniture } = furnished(v);
    const reserved = new Set([layout.start, layout.spawn, layout.stairs, ...layout.keySpots].map(p => key(p.row, p.col)));
    const doors = new Set(layout.chambers.flatMap(ch => [...ch.doorKeys]));
    furniture.forEach(p => {
      const k = key(p.row, p.col);
      assert.ok(!layout.walls.has(k), 'on floor at ' + k);
      assert.ok(!reserved.has(k) && !doors.has(k), 'not reserved at ' + k);
      const room = school.rooms[layout.chamberAt.get(k)];
      assert.ok(room && (room.furniture || []).some(([, r, c, w = 1]) => r === p.row && p.col >= c && p.col < c + w), 'its own room at ' + k);
    });
  });
});

test('the floor stays whole round the furniture: the start reaches every other open tile', () => {
  PLAN_VERSIONS.forEach(v => {
    const { layout, furniture } = furnished(v);
    const size = school.rows.length;
    const solid = new Set([...layout.walls, ...furniture.map(p => key(p.row, p.col))]);
    const seen = new Set([key(layout.start.row, layout.start.col)]);
    const queue = [layout.start];
    while (queue.length) {
      const cur = queue.shift();
      FOUR_STEPS.forEach(([dr, dc]) => {
        const r = cur.row + dr, c = cur.col + dc, k = key(r, c);
        if (r < 0 || c < 0 || r >= size || c >= size || solid.has(k) || seen.has(k)) return;
        seen.add(k);
        queue.push({ row: r, col: c });
      });
    }
    let open = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!solid.has(key(r, c))) open++;
    assert.equal(seen.size, open);
  });
});

test('furniture blocks walking as furniture, not as a prop to examine', () => {
  state.floor.GRID_SIZE = 5;
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.minions = [];
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.chest = null;
  state.floor.exchange = null;
  state.floor.tutorial = null;
  state.floor.props = [{ row: 2, col: 2, kind: 'furniture', piece: 'desk', part: 'single' }];
  const block = whatBlocks(2, 2);
  assert.equal(block.kind, 'furniture');
  assert.equal(block.thing.piece, 'desk');
});

test('every piece a plan uses has wording for a bump and is a known piece', () => {
  Object.values(FLOOR_PLANS).forEach(plan => plan.rooms.forEach(room => (room.furniture || []).forEach(([piece]) => {
    assert.ok(FURNITURE_PIECES.includes(piece), 'known piece ' + piece);
    assert.ok(TEXT['furniture.' + piece], 'wording for ' + piece);
  })));
});
