// Unit tests for plans.js: the ship's plan keeps its own rules, and
// buildPlanLayout lays it out the way floor.js expects.
//
// Run: node --test tests/*.test.mjs

import { test } from 'node:test';

import assert from 'node:assert/strict';

import { FOUR_STEPS } from '../js/grid.js';

import { key } from '../js/state.js';

import { FLOOR_PLANS, buildPlanLayout } from '../js/plans.js';

import { TEXT } from '../js/text.js';

// Steps from `start` to every open tile it can reach on a size x size
// grid, never through `blocked`.
function stepsFrom(layout, size, start, blocked = new Set()) {
  const dist = new Map([[key(start.row, start.col), 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dr, dc] of FOUR_STEPS) {
      const r = cur.row + dr, c = cur.col + dc, k = key(r, c);
      if (r < 0 || c < 0 || r >= size || c >= size) continue;
      if (layout.walls.has(k) || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, dist.get(key(cur.row, cur.col)) + 1);
      queue.push({ row: r, col: c });
    }
  }
  return dist;
}

test('the ship reaches every open tile from the start', () => {
  const plan = FLOOR_PLANS.ship;
  const size = plan.rows.length;
  const layout = buildPlanLayout(plan);
  assert.equal(stepsFrom(layout, size, layout.start).size, size * size - layout.walls.size, 'tiles cut off');
});

test('each room\'s doorways are its own floor, and every room tile is in the room tiles', () => {
  const layout = buildPlanLayout(FLOOR_PLANS.ship);
  layout.chambers.forEach((ch, i) => {
    ch.doorKeys.forEach(k => assert.equal(layout.chamberAt.get(k), i, ch.name));
    ch.floorCells.forEach(p => assert.ok(layout.roomTiles.has(key(p.row, p.col)), ch.name));
  });
});

test('every plan and every room has a name with wording, and no two rooms share one', () => {
  Object.values(FLOOR_PLANS).forEach(plan => {
    assert.ok(plan.name in TEXT, plan.name);
    plan.rooms.forEach(room => assert.ok(room.name in TEXT, room.name));
    const names = plan.rooms.map(room => TEXT[room.name]);
    assert.equal(new Set(names).size, names.length, plan.name + ': two rooms share a name');
  });
});
