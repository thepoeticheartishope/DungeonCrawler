// Unit tests for a fixed plan's furniture (plans.js `furniture`, decor.js
// placeFurniture; room view plan step E): every piece the ship lists
// stands, on its own room's floor, never on a doorway or the start; the
// floor stays whole
// round it; a bump finds it as furniture (passage.js whatBlocks), not a
// prop to examine; every piece has wording.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FOUR_STEPS } from '../js/grid.js';
import { state, key } from '../js/state.js';
import { FURNITURE_PIECES } from '../js/config.js';
import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';
import { makePlacer, placeFurniture } from '../js/decor.js';
import { whatBlocks } from '../js/passage.js';
import { TEXT } from '../js/text.js';

const ship = FLOOR_PLANS.ship;

// The ship laid out and furnished, as floor.js buildShipFloor does.
function furnished() {
  const layout = buildPlanLayout(ship, 0);
  const furniture = placeFurniture(layout, makePlacer(layout, ship.rows.length));
  return { layout, furniture: furniture.filter(p => p.kind === 'furniture') };
}

test('every piece the ship lists stands', () => {
  const listed = ship.rooms.reduce((n, room) => n + (room.furniture || []).reduce((m, [, , , w = 1]) => m + w, 0), 0);
  assert.equal(furnished().furniture.length, listed);
});

test("furniture stands on its own room's floor, never on a doorway or the start", () => {
  const { layout, furniture } = furnished();
  const reserved = new Set([key(layout.start.row, layout.start.col)]);
  const doors = new Set(layout.chambers.flatMap(ch => [...ch.doorKeys]));
  furniture.forEach(p => {
    const k = key(p.row, p.col);
    assert.ok(!layout.walls.has(k), 'on floor at ' + k);
    assert.ok(!reserved.has(k) && !doors.has(k), 'not reserved at ' + k);
    const room = ship.rooms[layout.chamberAt.get(k)];
    assert.ok(room && (room.furniture || []).some(([, r, c, w = 1]) => r === p.row && p.col >= c && p.col < c + w), 'its own room at ' + k);
  });
});

test('the floor stays whole round the furniture: the start reaches every other open tile', () => {
  const { layout, furniture } = furnished();
  const size = ship.rows.length;
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

test('furniture blocks walking as furniture, not as a prop to examine', () => {
  state.floor.GRID_SIZE = 5;
  state.floor.wallSet = new Set();
  state.floor.pillarSet = new Set();
  state.floor.minions = [];
  state.floor.boss = null;
  state.floor.hunter = null;
  state.floor.chest = null;
  state.floor.exchange = null;
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
